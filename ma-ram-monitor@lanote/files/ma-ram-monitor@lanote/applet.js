const Applet = imports.ui.applet;
const Mainloop = imports.mainloop;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Settings = imports.ui.settings;
const Gettext = imports.gettext;

let _;

/**
 * RAM Monitor Applet for Cinnamon
 * * This applet provides real-time memory usage statistics. It is designed for 
 * visual stability by utilizing dynamic string padding and forced monospaced 
 * fonts to prevent panel "jumping" when values change.
 */
class MaRamMonitorApplet extends Applet.TextApplet {
    constructor(metadata, orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId);

        // Initialize settings and bind them to local properties
        this.settings = new Settings.AppletSettings(this, metadata.uuid, instanceId);

        // --- Core UI Settings ---
        this.settings.bindProperty(Settings.BindingDirection.IN, "mem-label", "mem_label", this._on_settings_changed, null);
        this.settings.bindProperty(Settings.BindingDirection.IN, "show-mode", "show_mode", this._on_settings_changed, null);
        this.settings.bindProperty(Settings.BindingDirection.IN, "show-total", "show_total", this._on_settings_changed, null);
        this.settings.bindProperty(Settings.BindingDirection.IN, "show-value", "show_value", this._on_settings_changed, null);
        this.settings.bindProperty(Settings.BindingDirection.IN, "show-percent", "show_percent", this._on_settings_changed, null);
        this.settings.bindProperty(Settings.BindingDirection.IN, "unit-type", "unit_type", this._on_settings_changed, null);

        // --- Loop & Threshold Settings ---
        this.settings.bindProperty(Settings.BindingDirection.IN, "frequency", "frequency", this._on_settings_changed, null);
        this.settings.bindProperty(Settings.BindingDirection.IN, "warning-usage", "warning_usage", this._on_settings_changed, null);
        this.settings.bindProperty(Settings.BindingDirection.IN, "warning-available", "warning_available", this._on_settings_changed, null);

        // --- Layout Stability & Interaction ---
        this.settings.bindProperty(Settings.BindingDirection.IN, "use-monospace", "use_monospace", this._on_settings_changed, null);
        this.settings.bindProperty(Settings.BindingDirection.IN, "padding-size", "padding_size", this._on_settings_changed, null);
        this.settings.bindProperty(Settings.BindingDirection.IN, "enable-click-launch", "enable_click_launch", null, null);
        this.settings.bindProperty(Settings.BindingDirection.IN, "custom-command", "custom_command", null, null);

        // Internal State Management
        this._isWarningActive = false;
        this._blinkState = false;

        // Kick off the independent loops
        this._update_loop();  // Data processing
        this._blink_loop();   // Visual animation
    }

    /**
     * Handles settings changes by restarting the update loop.
     * This ensures immediate UI feedback and prevents multiple timers.
     */
    _on_settings_changed() {
        if (this._timeoutId) {
            Mainloop.source_remove(this._timeoutId);
            this._timeoutId = null;
        }
        this._update_loop();
    }

    /**
     * Asynchronous data fetching loop.
     * Uses Gio to read /proc/meminfo without blocking the main UI thread.
     */
    _update_loop() {
        let file = Gio.File.new_for_path("/proc/meminfo");

        file.load_contents_async(null, (file, res) => {
            try {
                let [success, contents] = file.load_contents_finish(res);
                if (success) {
                    this._update_ui(contents.toString());
                }
            } catch (e) {
                global.logError(`[MaRamMonitorApplet]: ` + _("Kernel read error: %s").replace("%s", e.message));
                this.set_applet_label(_("RAM error"));
            }
        });

        let interval = parseFloat(this.frequency) * 1000;
        this._timeoutId = Mainloop.timeout_add(interval, () => {
            this._update_loop();
            return false; // Manual interval control
        });
    }

    /**
     * Secondary loop for the warning animation.
     * Runs at a fixed 500ms interval for smooth blinking, regardless of data frequency.
     */
    _blink_loop() {
        if (this._isWarningActive) {
            this._blinkState = !this._blinkState;
            if (this._blinkState) this.actor.add_style_class_name("warning-blink");
            else this.actor.remove_style_class_name("warning-blink");
        } else {
            this.actor.remove_style_class_name("warning-blink");
            this._blinkState = false;
        }
        this._blinkTimeoutId = Mainloop.timeout_add(500, () => {
            this._blink_loop();
            return false;
        });
    }

    /**
     * Updates the visual representation of the applet.
     * @param {string} text Raw content from /proc/meminfo
     */
    _update_ui(text) {
        if (!text) return;

        let totalMatch = text.match(/MemTotal:\s+(\d+)/);
        let availMatch = text.match(/MemAvailable:\s+(\d+)/);

        if (!totalMatch || !availMatch) {
            this.set_applet_label(_("RAM error"));
            return;
        }

        const total = parseInt(totalMatch[1]);
        const available = parseInt(availMatch[1]);
        const used = total - available;
        const divisor = this.unit_type === "GiB" ? Math.pow(1024, 3) : Math.pow(1000, 3);

        const totalNum = (total * 1024 / divisor).toFixed(1);
        const mainNum = (this.show_mode === "used" ? (used * 1024) : (available * 1024)) / divisor;
        const pNum = (this.show_mode === "used" ? (used / total) : (available / total)) * 100;

        const NBSP = "\u00A0";
        let displayVal = mainNum.toFixed(1).toString();
        let displayTotal = totalNum.toString();
        let displayPercent = pNum.toFixed(1).toString();

        if (this.use_monospace) {
            displayVal = displayVal.padStart(this.padding_size, NBSP);
            displayTotal = displayTotal.padStart(this.padding_size, NBSP);
            displayPercent = displayPercent.padStart(this.padding_size, NBSP);
        }

        let content = "";
        if (this.show_value) {
            content += displayVal;
            if (this.show_total) content += " / " + displayTotal;
            content += " " + this.unit_type;
        }

        if (this.show_percent) {
            let spacePrefix = this.show_value ? " " : "";
            content += spacePrefix + "(" + displayPercent + "%)";
        }

        if (!this.show_value && !this.show_percent) {
            content = displayPercent + "%";
        }

        let prefixLabel = this.mem_label ? this.mem_label : "";
        this.set_applet_label(prefixLabel + content);

        let labelActor = this.actor.get_first_child();
        if (labelActor) {
            if (this.use_monospace) {
                labelActor.set_style("font-family: monospace; font-weight: bold;");
            } else {
                labelActor.set_style("");
            }
        }

        this.set_applet_tooltip(this.show_mode === "used" ? _("Used RAM") : _("Available RAM"));

        if (this.show_mode === "used") {
            this._isWarningActive = this.warning_usage < 100 && parseFloat(pNum) >= this.warning_usage;
        } else {
            this._isWarningActive = this.warning_available > 0 && parseFloat(pNum) <= this.warning_available;
        }
    }

    /**
     * Click handler to spawn a system monitor.
     * Verifies if the command exists in PATH before execution.
     */
    on_applet_clicked(event) {
        if (this.enable_click_launch && this.custom_command) {
            let cmdBase = this.custom_command.split(" ")[0];
            if (GLib.find_program_in_path(cmdBase)) {
                imports.misc.util.spawnCommandLine(this.custom_command);
            } else {
                imports.ui.main.notify(_("RAM Applet error"), _('Command "%s" not found.').replace("%s", cmdBase));
            }
        }
    }

    /**
     * Cleanup resources when the applet is removed.
     */
    on_applet_removed_from_panel() {
        if (this._timeoutId) Mainloop.source_remove(this._timeoutId);
        if (this._blinkTimeoutId) Mainloop.source_remove(this._blinkTimeoutId);
    }
}

function initTranslations(uuid) {
    Gettext.bindtextdomain(uuid, GLib.get_home_dir() + "/.local/share/cinnamon/applets/" + uuid + "/locale");
    _ = (str) => Gettext.dgettext(uuid, str);
}

function main(metadata, orientation, panelHeight, instanceId) {
    initTranslations(metadata.uuid);
    return new MaRamMonitorApplet(metadata, orientation, panelHeight, instanceId);
}