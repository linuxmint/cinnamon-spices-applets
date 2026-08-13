const { applet, settings, popupMenu, main: Main, modalDialog } = imports.ui; // eslint-disable-line
const { GLib, St, Clutter, Pango, PangoCairo, Gio } = imports.gi; // eslint-disable-line

const Gettext = imports.gettext;  // eslint-disable-line
const UUID = "nvidia-monitor@kalin91";

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale")

function _(str) {
  return Gettext.dgettext(UUID, str);
}

class NvidiaMonitorApplet extends applet.Applet {

    constructor(metadata, orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);
        this.setAllowedLayout(applet.AllowedLayout.BOTH);
        this._applet_path = metadata.path;
        this._panel_height = panel_height;
        this._app_name = metadata.name
        this._uuid = metadata.uuid;
        this._instance_id = instance_id;
        this._turn_over = false;
        this._monitorProc = null;
        this._monitorStdin = null;
        this.on_orientation_changed(orientation);
        // Inicializar historial
        this._history = [];
        this._max_history_points = 43200;

        this._updateLoopId = null;
        this._last_output = "";
        this._memUsedPercent = 0;
        this._gpuUtilPercent = 0;
        this._fanSpeedPercent = 0;
        this._tempValue = 0;
        this._sepText = " | ";

        this._buildUI(panel_height);
        try {
            this._buildMenu();
            if (!GLib.find_program_in_path('nvidia-smi')) {
                this.set_applet_label(_("nvidia-smi not found"));
                return this._show_err(_('nvidia-smi not found in PATH.\nPlease ensure NVIDIA drivers are installed.'));
            }

            this._initSettings();

            this.set_applet_tooltip(_("Displays NVIDIA GPU monitor"));

            this._on_settings_changed();
        } catch (e) {
            global.logError(e);
            this._show_err(`${_("Error initializing applet")}: ${e.message}`);
            this.set_applet_label(_("Init Error"));
        }
    }
    on_panel_height_changed() {
        this._panel_height = this.panel.height;
        this.on_orientation_changed(this.orientation);
    }

    _buildMenu() {
        try {
            if (!this.menuManager) this.menuManager = new popupMenu.PopupMenuManager(this);

            // Re-create menu carefully
            if (this.menu) {
                this.menuManager.removeMenu(this.menu);
                this.menu.destroy();
            }

            // Usar this.orientation para que el menú sepa hacia dónde abrirse (Arriba/Abajo)
            // Use St.Side enum or verify this.orientation is valid (usually 0 or 1)
            this.menu = new applet.AppletPopupMenu(this, this.orientation);

            this.menuManager.addMenu(this.menu);

            // Add Monitor Graph item
            let monitorItem = new popupMenu.PopupMenuItem(_("Open Monitor Graph"));
            monitorItem.connect('activate', () => this._openMonitor());
            this.menu.addMenuItem(monitorItem);

            const settings = new popupMenu.PopupSubMenuMenuItem(_("Settings"), true, { reactive: false });
            this.menu.addMenuItem(settings);
            this.menu.addMenuItem(new popupMenu.PopupSeparatorMenuItem());

            // Add settings items
            let appletSettings = new popupMenu.PopupIconMenuItem(_("Applet Settings"), 'speedometer-symbolic', St.IconType.SYMBOLIC);
            appletSettings.connect('activate', () => GLib.spawn_command_line_async(`xlet-settings applet ${this._uuid} -i ${this.instance_id} -t 0`));
            settings.menu.addMenuItem(appletSettings);
            let monitorSettings = new popupMenu.PopupIconMenuItem(_("Monitor Settings"), 'org.gnome.SystemMonitor-symbolic', St.IconType.SYMBOLIC);
            monitorSettings.connect('activate', () => GLib.spawn_command_line_async(`xlet-settings applet ${this._uuid} -i ${this.instance_id} -t 1`));
            settings.menu.addMenuItem(monitorSettings);
            let resetAll = new popupMenu.PopupIconMenuItem(_("Reset All Settings"), 'edit-undo-symbolic', St.IconType.SYMBOLIC);
            resetAll.connect('activate', () => {
                let confirm = new modalDialog.ConfirmDialog(_("Are you sure you want to reset all settings of '%s' to default?")
                .format(this._uuid),    () => {
                    try {
                        for (let key in this.settings.settingsData) {
                            this.settings.setValue(key, this.settings.getDefaultValue(key));
                        }
                        this.on_orientation_changed(this.orientation);
                        if (this._monitorProc) {
                            this._resetMonitor();
                        }
                    } catch (e) {
                        global.logError(`${_("Error resetting settings")}: ${e.message}`);
                        this._show_err(`${_("Error resetting settings")}: ${e.message}`);
                    }
                });
                confirm.open();
            });
            settings.menu.addMenuItem(resetAll);

        } catch (e) {
            global.logError(e);
            this._show_err(_("Error building menu: ") + e.message);
        }
    }

    _openMonitor() {
        if (this._monitorProc) {
            // Bring to front
            this._sendToMonitor({ command: "present" });
            return;
        }

        try {
            let scriptPath = GLib.build_filenamev([this._applet_path, "scripts", "monitor.py"]);

            // Get coordinates
            // Ensure allocation is up to date
            let [x, y] = this.actor.get_transformed_position();
            let [w, h] = this.actor.get_transformed_size();
            let orientation = this.orientation;

            // Calculate X axis length value
            let xLength = 60; // default seconds
            if (this.x_axis_unit === "minutes") xLength = this.x_axis_length_min;
            else if (this.x_axis_unit === "hours") xLength = this.x_axis_length_hour;
            else xLength = this.x_axis_length_sec;

            // Subprocess arguments - Explicitly invoke python3
            let args = [
                "/usr/bin/python3",
                scriptPath,
                "--x", Math.round(x).toString(),
                "--y", Math.round(y).toString(),
                "--width", Math.round(w).toString(),
                "--height", Math.round(h).toString(),
                "--orientation", orientation.toString(),
                "--interval", this.refresh_interval.toString(),
                "--color-gpu", this.gpu_color,
                "--color-mem", this.mem_color,
                "--color-temp", this.temp_color,
                "--color-fan", this.fan_color,
                "--color-bg", this.background_color,
                "--color-axis-temp", this.temp_axis_color,
                "--color-axis-pct", this.percent_axis_color,
                "--color-axis-x", this.x_axis_color,
                "--color-grid", this.guidelines_color,
                "--ysteps", this.y_axis_steps.toString(),
                "--temp-unit", this.y_axis_temp_unit,
                "--xsteps", this.x_axis_steps.toString(),
                "--xunit", this.x_axis_unit,
                "--xlength", xLength.toString()
            ];

            // Log for debugging
            global.log(`Nvidia Monitor: ${_("Launching")} ${args.join(" ")}`);

            // Subprocess with Stdin pipe
            this._monitorProc = Gio.Subprocess.new(
                args,
                Gio.SubprocessFlags.STDIN_PIPE
            );

            this._monitorStdin = this._monitorProc.get_stdin_pipe();

            // Send existing history to populate graph immediately
            if (this._history && this._history.length > 0) {
                global.log(`Nvidia Monitor: ${_("Sending")} ${this._history.length} ${_("history points")}.`);
                for (let point of this._history) {
                    this._sendToMonitor(point);
                }
            }

            // Watch for exit
            this._monitorProc.wait_check_async(null, (proc, result) => {
                try {
                    proc.wait_check_finish(result);
                } catch (e) {
                    global.logError(`Nvidia Monitor: ${_("subprocess exited with error")}: ${e.message}`);
                }
                global.log(`Nvidia Monitor: ${_("Monitor subprocess exited")}.`);
                this._monitorProc = null;
                this._monitorStdin = null;
            });

        } catch (e) {
            global.logError(`Nvidia Monitor: ${_("Error starting monitor")}: ${e.message}`);
            this._show_err(`Nvidia Monitor: ${_("Could not start monitor script")}: ${e.message}`);
        }
    }

    _closeMonitor() {
        if (this._monitorProc) {
            try {
                // Send termination signal
                this._monitorProc.force_exit();
            } catch (e) {
                global.logError(`Nvidia Monitor: ${_("Error closing monitor")}: ${e.message}`);
            }
        }
    }
    _resetMonitor() {
        if (this._monitorProc) {
            this._closeMonitor();
            GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => {
                if (this._monitorProc) {
                    return GLib.SOURCE_REMOVE;
                }
                this._openMonitor();
                return GLib.SOURCE_CONTINUE;
            });
        }
    }

    _sendToMonitor(data) {
        if (!this._monitorProc || !this._monitorStdin) return;

        try {
            let jsonStr = JSON.stringify(data) + "\n";
            // Use GLib.Bytes for safe encoding/handling
            let bytes = GLib.Bytes.new(jsonStr);
            this._monitorStdin.write_bytes(bytes, null);
            this._monitorStdin.flush(null);
        } catch (e) {
            // Broken pipe likely
            global.logError(`Nvidia Monitor: ${_("Error sending to monitor")}: ${e.message}`);
            this._monitorProc = null;
            this._monitorStdin = null;
        }
    }


    _show_err(msg) {
        let icon = new St.Icon({
            icon_name: 'dialog-warning',
            icon_type: St.IconType.FULLCOLOR,
            icon_size: 36
        });
        const title = this._app_name + " " + _("Error");
        Main.criticalNotify(title, msg, icon);
    }

    _buildUI() {
        // Create main container
        this._box = new St.BoxLayout({
            style_class: `applet-box${this._turn_over ? ' vertical' : ''}`,
            vertical: this._turn_over,
            [this._turn_over ? 'x_align' : 'y_align']: Clutter.ActorAlign.CENTER
        });
        this.actor.add(this._box);
        let sepText = this._sepText;
        // Separator string
        this._pieChartSize = Math.max(16, this._panel_height - 6);

        // 1. Temp Label
        this._label = this._add_label(this._turn_over ? "..." : _("Initializing..."));
        this._label.show();

        // 2. Sep 1
        this._sep1 = this._add_label(sepText);

        // 3. Mem Label
        this._memLabel = this._add_label("");

        // 4. Mem Pie Chart (Renamed from _pieChartArea)
        this._memPieChartArea = this._add_pieChartArea((area) => this._drawPie(area, this._memUsedPercent, _("Mem")));

        // 5. Sep 2
        this._sep2 = this._add_label(sepText);

        // 6. GPU Label
        this._gpuLabel = this._add_label("");

        // 7. GPU Pie Chart
        this._gpuPieChartArea = this._add_pieChartArea((area) => this._drawPie(area, this._gpuUtilPercent, _("GPU")));

        // 8. Sep 3
        this._sep3 = this._add_label(sepText);

        // 9. Fan Label
        this._fanLabel = this._add_label("");

        // 10. Fan Pie Chart
        this._fanPieChartArea = this._add_pieChartArea((area) => this._drawPie(area, this._fanSpeedPercent, _("Fan")));
    }

    _add_label(text) {
        if (this._turn_over & text === this._sepText) {

            const area = new St.DrawingArea({
                style_class: 'applet-label',
                reactive: true,
                x_align: St.Align.MIDDLE,
                y_align: St.Align.MIDDLE,
                width: 1,
                height: 1
            });

            area._custom_text = text;

            area.set_text = (newText) => {
                if (area._custom_text !== newText) {
                    area._custom_text = newText;
                    area.queue_repaint(); // Repaint when text changes
                }
            };

            area.connect('repaint', (actor) => this._draw_label(actor, area));

            this._add_to_box(area);
            return area;
        } else {
            const label = new St.Label({
                text: text,
                style_class: 'applet-label',
                y_align: St.Align.MIDDLE,
                x_align: St.Align.MIDDLE
            });
            if (this._turn_over) {
                let orig = label.set_text;
                label.set_text = (newText) => {
                    newText = newText.replace(/:/g, "\n");
                    let len = Math.max(...newText.split("\n").map(s => s.replace(/\./g, "").length));
                    let text_size = Math.floor(this._panel_height * 1/len * 1.2);
                    label.set_style(`font-size: ${text_size}px; max-width: ${this._panel_height}px;`);
                    orig.call(label, newText);
                }
            }
            // Fix for truncation bug
            label.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
            this._add_to_box(label);
            return label;
        }
    }

    _draw_label = (actor, area) => {
        let cr = actor.get_context();
        let [w, h] = actor.get_surface_size();

        let layout = PangoCairo.create_layout(cr);
        layout.set_text(area._custom_text || "", -1);

        let themeNode = actor.get_theme_node();
        layout.set_font_description(themeNode.get_font());
        let color = themeNode.get_foreground_color();
        if (color)
            cr.setSourceRGBA(color.red / 255, color.green / 255, color.blue / 255, color.alpha / 255);
        else
            cr.setSourceRGBA(1, 1, 1, 1);

        let [, logicalRect] = layout.get_pixel_extents();
        let textWidth = logicalRect.width;
        let textHeight = logicalRect.height;

        cr.translate(w / 2, h / 2);
        cr.rotate(Math.PI / 2);

        cr.moveTo(-textWidth / 2, -textHeight / 2);
        PangoCairo.show_layout(cr, layout);

        let reqW = textHeight + 4;
        let reqH = textWidth;

        if (Math.abs(actor.width - reqW) > 2 || Math.abs(actor.height - reqH) > 2) {
            actor.set_width(reqW);
            actor.set_height(reqH);
        }

        cr.$dispose();
    }

    _add_pieChartArea(fnCallback) {
        const res = new St.DrawingArea({
            width: this._pieChartSize,
            height: this._pieChartSize,
            style: (this._turn_over) ? 'margin-top: 2px; margin-bottom: 2px;' : 'margin-left: 2px; margin-right: 2px;'
        });
        res.connect('repaint', area => fnCallback(area));
        this._add_to_box(res);
        return res;
    }

    _add_to_box(actor) {
        let box_init
        if (this._turn_over)
            box_init = { x_fill: false, x_align: St.Align.MIDDLE }
        else
            box_init = { y_fill: false, y_align: St.Align.MIDDLE }
        this._box.add(actor, box_init);
        actor.hide();
    }

    _initSettings() {

        this.settings = new settings.AppletSettings(this, this._uuid, this._instance_id);

        // Applet Settings
        this.settings.bind("refresh-interval", "refresh_interval", () => this._on_settings_changed());
        this.settings.bind("border-color", "border_color", () => this._on_settings_changed());
        this.settings.bind("encoding", "encoding", () => this._on_settings_changed());
        this.settings.bind("show-temp", "show_temp", () => this._on_update_display());
        this.settings.bind("temp-unit", "temp_unit", () => this._on_update_display());
        this.settings.bind("show-memory", "show_memory", () => this._on_update_display());
        this.settings.bind("memory-display-mode", "memory_display_mode", () => this._on_update_display());
        this.settings.bind("show-gpu-util", "show_gpu_util", () => this._on_update_display());
        this.settings.bind("gpu-display-mode", "gpu_display_mode", () => this._on_update_display());
        this.settings.bind("show-fan-speed", "show_fan_speed", () => this._on_update_display());
        this.settings.bind("fan-display-mode", "fan_display_mode", () => this._on_update_display());

        // Monitor Colors
        this.settings.bind("temp-color", "temp_color", () => this._resetMonitor());
        this.settings.bind("mem_color", "mem_color", () => this._resetMonitor());
        this.settings.bind("gpu_color", "gpu_color", () => this._resetMonitor());
        this.settings.bind("fan_color", "fan_color", () => this._resetMonitor());
        this.settings.bind("background_color", "background_color", () => this._resetMonitor());
        this.settings.bind("temp-axis-color", "temp_axis_color", () => this._resetMonitor());
        this.settings.bind("percent-axis-color", "percent_axis_color", () => this._resetMonitor());
        this.settings.bind("x-axis-color", "x_axis_color", () => this._resetMonitor());
        this.settings.bind("guidelines-color", "guidelines_color", () => this._resetMonitor());

        // Monitor Axes
        this.settings.bind("y-axis-steps", "y_axis_steps", () => this._resetMonitor());
        this.settings.bind("y-axis-temp-unit", "y_axis_temp_unit", () => this._resetMonitor());
        this.settings.bind("x-axis-steps", "x_axis_steps", () => this._resetMonitor());
        this.settings.bind("x-axis-unit", "x_axis_unit", () => this._resetMonitor());
        this.settings.bind("x-axis-length-sec", "x_axis_length_sec", () => this._resetMonitor());
        this.settings.bind("x-axis-length-min", "x_axis_length_min", () => this._resetMonitor());
        this.settings.bind("x-axis-length-hour", "x_axis_length_hour", () => this._resetMonitor());
    }

    set_applet_label(text) {
        this._label.set_text(text);
        this._label.show();
    }

    _on_settings_changed() {
        if (this._turn_over)
            this._box.width = this._panel_height;
        else
            this._box.height = this._panel_height;
        this._box.style = `border: 1px solid ${this.border_color};`;
        if (this._updateLoopId) {
            GLib.Source.remove(this._updateLoopId);
        }
        this._decoder = new TextDecoder(this.encoding);
        this._updateLoop();
    }

    on_orientation_changed(orientation) {
        this.orientation = orientation;

        // Handle turn_over logic
        this._turn_over = (orientation % 2 === 1);

        // Rebuild menu to adjust orientation
        if (this.menu) {
            this.menu.destroy();
            this.menu = null;
            this._buildMenu()
            this._box.destroy();
            this._box = null;
            this._buildUI()
            this._on_settings_changed();
        }
    }

    _on_update_display() {
        if (this._last_output) {
            this._parse_and_display(this._last_output);
        }
    }

    _updateLoop() {
        this._update();

        let interval = Math.max(this.refresh_interval * 1000, 500);

        this._updateLoopId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, interval, () => {
            this._updateLoop();
            return false;
        });
    }

    _update() {
        try {
            // Use full path to nvidia-smi
            let [success, stdout, stderr] = GLib.spawn_command_line_sync('/usr/bin/nvidia-smi --query-gpu=temperature.gpu,memory.used,memory.total,utilization.gpu,fan.speed,timestamp --format=csv,noheader,nounits');

            if (success) {
                let output = this._decoder.decode(stdout);
                this._last_output = output;
                this._parse_and_display(output);
            } else {
                this.set_applet_label(_("Error"));
                this._show_err(_("Failed to run nvidia-smi.\n") + (stderr ? stderr.toString() : _("Unknown")));
                global.logError(`Nvidia Monitor: ${_("Failed to run nvidia-smi")}. Stderr: ${(stderr ? stderr.toString() : _("Unknown"))}`);
            }
        } catch (e) {
            global.logError(e);
            this._show_err(`Nvidia Monitor: ${_("An unexpected error occurred while running nvidia-smi.\n")} ${e.message}`);
            this.set_applet_label(_("Err"));
        }
    }

    _drawPie(area, percent, label) {
        let [width, height] = area.get_surface_size();
        let cr = area.get_context();

        let centerX = width / 2;
        let centerY = height / 2;
        let radius = Math.min(width, height) / 2 - 1;

        // Background circle (Darker gray for better text contrast)
        cr.setSourceRGBA(0.2, 0.2, 0.2, 1.0);
        cr.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        cr.fill();

        // Used portion (green to red gradient based on usage)
        let r, g, b;
        if (percent > 0) {
            // Color goes from green (low usage) to yellow to red (high usage)
            if (percent < 0.5) {
                r = percent * 2;
                g = 0.8;
                b = 0.2;
            } else {
                r = 1.0;
                g = 0.8 * (1 - (percent - 0.5) * 2);
                b = 0.2;
            }
            cr.setSourceRGBA(r, g, b, 1.0);

            // Draw pie slice starting from top (-PI/2)
            cr.moveTo(centerX, centerY);
            cr.arc(centerX, centerY, radius, -Math.PI / 2, -Math.PI / 2 + percent * 2 * Math.PI);
            cr.closePath();
            cr.fill();
        }

        // Draw Label using Pango
        if (label) {
            let layout = PangoCairo.create_layout(cr);
            layout.set_text(label, -1);

            // Dynamic font size: ~35% of diameter (increased from 25%)
            let fontSize = Math.max(8, Math.min(width, height) * 0.32);
            let desc = Pango.FontDescription.from_string("Sans Bold");
            desc.set_absolute_size(fontSize * Pango.SCALE);
            layout.set_font_description(desc);

            // Brighter Blue for contrast against dark background
            if (percent < 0.5) {
                cr.setSourceRGBA(0.7, 0.25, 0.0, 1.0);
            } else if (percent < 0.75) {
                cr.setSourceRGBA(0.15, 0.75, 0.15, 1.0);
            } else {
                cr.setSourceRGBA(1 - r, 1 - g, 1 - b, 1.0);
            }
            let [, logicalRect] = layout.get_pixel_extents();
            let textWidth = logicalRect.width;
            let textHeight = logicalRect.height;

            cr.moveTo(centerX - textWidth / 2, centerY - textHeight / 2);
            PangoCairo.show_layout(cr, layout);
        }

        // Draw border
        // Clear path to avoid connecting text end-point to the circle start (artifact fix)
        cr.newPath();
        cr.setSourceRGBA(0.7, 0.7, 0.7, 1.0);
        cr.setLineWidth(1);
        cr.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        cr.stroke();

        cr.$dispose();
    }

    _parse_and_display(output) {
        let parts = output.trim().split(',').map(function (s) { return s.trim(); });
        if (parts.length < 6) return;

        let temp = parts[0];
        let memUsed = parseFloat(parts[1]);
        let memTotal = parseFloat(parts[2]);
        let gpuUtil = parseFloat(parts[3]);
        let fanSpeed = parseFloat(parts[4]);
        let timestamp = parts[5].replace(/ /g, "_");

        // Calculate percentages
        this._memUsedPercent = memTotal > 0 ? memUsed / memTotal : 0;
        this._gpuUtilPercent = gpuUtil / 100.0;
        this._fanSpeedPercent = fanSpeed / 100.0;
        this._tempValue = parseFloat(temp);

        let visTemp = false;

        // --- POC LOGGING ---
        try {
            if (!this._logFilePath)
                this._logFilePath = `${GLib.get_tmp_dir()}/nvidia-monitor-${Math.floor(Date.now() / 1000)}.jsonl`;

            let logEntry = JSON.stringify({
                ts: timestamp,
                gpu: gpuUtil,
                mem: memUsed,
                fan: fanSpeed,
                temp: this._tempValue
            }) + "\n";

            let file = Gio.File.new_for_path(this._logFilePath);
            let outStream = file.append_to(Gio.FileCreateFlags.NONE, null);
            outStream.write_all(logEntry, null);
            outStream.close(null);
        } catch (e) {
            if (!this._logErr) { global.logError("Nvidia Monitor: Log error: " + e.message); this._logErr = true; }
        }

        // Store in history
        if (this._history.length >= this._max_history_points) {
            this._history.splice(0, 1800); // Remove oldest 30 minutes
        }
        this._history.push({
            ts: timestamp,
            gpu: gpuUtil,
            mem: this._memUsedPercent * 100,
            temp: this._tempValue,
            fan: fanSpeed
        });

        // Send to external monitor if running
        this._sendToMonitor({
            ts: timestamp,
            gpu: gpuUtil,
            mem: this._memUsedPercent * 100,
            temp: this._tempValue,
            fan: fanSpeed
        });

        // Temp logic
        if (this.show_temp) {
            let displayTemp = temp;
            if (this.temp_unit === "F") {
                displayTemp = (parseFloat(temp) * 9 / 5 + 32).toFixed(1);
            }
            let unit = "°" + this.temp_unit;
            this._label.set_text(this._turn_over ? `↓${unit}\n${displayTemp}`: `${displayTemp}${unit}`);
            this._label.show();
            visTemp = true;
        } else {
            this._label.hide();
        }

        const visMem = this._updateSection(
            this.show_memory,
            this.memory_display_mode,
            this._memLabel,
            this._memPieChartArea,
            this._turn_over ? `${_("MEM")}:${Math.floor(this._memUsedPercent * 100)}%` : Math.round(memUsed) + "MiB / " + Math.round(memTotal) + "MiB"
        );

        const visGpu = this._updateSection(
            this.show_gpu_util,
            this.gpu_display_mode,
            this._gpuLabel,
            this._gpuPieChartArea,
            this._turn_over ? `${_("GPU")}:${gpuUtil}%` : `${_("GPU")}: ${gpuUtil}%`
        );

        const visFan = this._updateSection(
            this.show_fan_speed,
            this.fan_display_mode,
            this._fanLabel,
            this._fanPieChartArea,
            this._turn_over ? `${_("FAN")}:${fanSpeed}%` : `${_("Fan")}: ${fanSpeed}%`
        );

        // Separators
        // Sep 1: between Temp and (Mem OR Gpu OR Fan)
        let rightOfTemp = visMem || visGpu || visFan;
        if (visTemp && rightOfTemp) this._sep1.show(); else this._sep1.hide();

        // Sep 2: between Mem and (Gpu OR Fan)
        let rightOfMem = visGpu || visFan;
        if (visMem && rightOfMem) this._sep2.show(); else this._sep2.hide();

        // Sep 3: between Gpu and Fan
        if (visGpu && visFan) this._sep3.show(); else this._sep3.hide();

        // If nothing is shown, show placeholder in Temp label
        if (!visTemp && !visMem && !visGpu && !visFan) {
            this._label.set_text(this._turn_over ? _("Hi!") : "Nvidia");
            this._label.show();
        }
    }

    _updateSection(show, mode, label, pieArea, textVal) {
        if (show) {
            if (mode === 'pie') {
                label.hide();
                pieArea.show();
                pieArea.queue_repaint();
            } else {
                label.set_text(textVal);
                label.show();
                pieArea.hide();
            }
            return true;
        } else {
            label.hide();
            pieArea.hide();
            return false;
        }
    }

    on_applet_removed_from_panel() {
        if (this._updateLoopId) {
            GLib.Source.remove(this._updateLoopId);
        }

        if (this._monitorProc) {
            try {
                this._monitorProc.force_exit();
            } catch (e) {
                global.logError(`Nvidia Monitor: ${_("Error terminating monitor subprocess")}: ${e.message}`);
            }
            this._monitorProc = null;
        }

        if (this.menu) {
            this.menu.destroy();
        }

        this.settings.finalize();
    }

    on_applet_clicked() {
        this.menu.toggle();
        global.log(`Nvidia Monitor: ${_("Menu toggled on click.")}`);
    }
}

function main(metadata, orientation, panel_height, instance_id) { // eslint-disable-line
    return new NvidiaMonitorApplet(metadata, orientation, panel_height, instance_id);
}
