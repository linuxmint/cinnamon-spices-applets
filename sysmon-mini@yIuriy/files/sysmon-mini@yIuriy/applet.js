const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;
const Util = imports.misc.util;
const Gettext = imports.gettext;
const St = imports.gi.St;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Clutter = imports.gi.Clutter;

const UUID = "sysmon-mini@yIuriy";
const HISTORY = 60;
const decoder = new TextDecoder();

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");

function _(text) {
    return Gettext.dgettext(UUID, text);
}

// ---------- Async file helpers ----------

function readFile(path) {
    return new Promise((resolve) => {
        Gio.File.new_for_path(path).load_contents_async(null, (file, res) => {
            try {
                let [, bytes] = file.load_contents_finish(res);
                resolve(decoder.decode(bytes));
            } catch (e) {
                resolve(null);
            }
        });
    });
}

async function readInt(path) {
    if (!path) return null;
    let text = await readFile(path);
    if (text === null) return null;
    let value = parseInt(text.trim(), 10);
    return isNaN(value) ? null : value;
}

function listDir(path) {
    return new Promise((resolve) => {
        Gio.File.new_for_path(path).enumerate_children_async("standard::name", Gio.FileQueryInfoFlags.NONE,
            GLib.PRIORITY_DEFAULT, null, (dir, res) => {
                let enumerator;
                try {
                    enumerator = dir.enumerate_children_finish(res);
                } catch (e) {
                    resolve([]);
                    return;
                }
                enumerator.next_files_async(100, GLib.PRIORITY_DEFAULT, null, (en, res2) => {
                    try {
                        resolve(en.next_files_finish(res2).map((info) => info.get_name()));
                    } catch (e) {
                        resolve([]);
                    }
                    en.close_async(GLib.PRIORITY_DEFAULT, null, null);
                });
            });
    });
}

// ---------- Sensor discovery ----------

// Returns the temperature input file for the first hwmon device matching `names` (in priority order).
async function findHwmon(names) {
    let found = {};
    for (let entry of await listDir("/sys/class/hwmon")) {
        let dir = `/sys/class/hwmon/${entry}`;
        let name = await readFile(`${dir}/name`);
        if (name !== null && !(name.trim() in found)) found[name.trim()] = dir;
    }
    for (let n of names) {
        let dir = found[n];
        if (!dir) continue;
        // Prefer the whole-chip sensor (Package / Tctl / Composite) when there is one
        for (let j = 1; j <= 16; j++) {
            let label = await readFile(`${dir}/temp${j}_label`);
            if (label && /Package|Tctl|Tdie|Composite/i.test(label))
                return `${dir}/temp${j}_input`;
        }
        if (await readInt(`${dir}/temp1_input`) !== null)
            return `${dir}/temp1_input`;
    }
    return null;
}

// Returns paths for the first battery, using energy_* (µWh/µW) or charge_* (µAh/µA) files.
async function findBattery() {
    for (let entry of await listDir("/sys/class/power_supply")) {
        let dir = `/sys/class/power_supply/${entry}`;
        let type = await readFile(`${dir}/type`);
        if (!type || type.trim() !== "Battery" || await readInt(`${dir}/capacity`) === null) continue;
        let energy = await readInt(`${dir}/energy_now`) !== null;
        return {
            capacity: `${dir}/capacity`,
            status: `${dir}/status`,
            now: `${dir}/${energy ? "energy_now" : "charge_now"}`,
            full: `${dir}/${energy ? "energy_full" : "charge_full"}`,
            rate: `${dir}/${energy ? "power_now" : "current_now"}`,
        };
    }
    return null;
}

function formatDuration(hours) {
    if (!isFinite(hours) || hours <= 0 || hours > 48) return null;
    let h = Math.floor(hours);
    let m = Math.round((hours - h) * 60);
    if (m === 60) { h++; m = 0; }
    return h ? "%dh%s".format(h, String(m).padStart(2, "0")) : _("%d min").format(m);
}

class SysMonApplet extends Applet.Applet {
    constructor(metadata, orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId);
        this.setAllowedLayout(Applet.AllowedLayout.HORIZONTAL);

        this.settings = new Settings.AppletSettings(this, metadata.uuid, instanceId);
        for (let key of ["update-interval", "show-graph", "graph-width", "show-temp",
                         "show-cpu", "show-ram", "show-ssd-temp", "show-icons", "ram-format",
                         "opacity", "opaque-on-hover", "graph-background",
                         "show-battery", "bat-warn", "bat-crit",
                         "cpu-warn", "cpu-crit", "ram-warn", "ram-crit", "temp-warn", "temp-crit"]) {
            let prop = key.replace(/-(\w)/g, (m, c) => c.toUpperCase());
            this.settings.bind(key, prop, () => this._onSettingsChanged());
        }

        this.cpuTempPath = null;
        this.ssdTempPath = null;
        this.batPaths = null;

        this.history = new Array(HISTORY).fill(0);
        this.prevCpu = null;
        this.cpu = 0;
        this.cores = [];
        this.mem = {};
        this.temp = null;
        this.ssdTemp = null;
        this.bat = null;
        this.timer = 0;
        this.busy = false;
        this.removed = false;

        this._buildPanel();
        this._buildMenu();
        this._onSettingsChanged();
        this._detectSensors();
    }

    async _detectSensors() {
        [this.cpuTempPath, this.ssdTempPath, this.batPaths] = await Promise.all([
            findHwmon(["coretemp", "k10temp", "zenpower", "cpu_thermal", "acpitz"]),
            findHwmon(["nvme"]),
            findBattery(),
        ]);
        if (!this.removed) this._onSettingsChanged();
    }

    // ---------- Panel ----------
    _buildPanel() {
        this.box = new St.BoxLayout({ style_class: "sysmon-box", y_align: Clutter.ActorAlign.CENTER });
        this.actor.add_child(this.box);

        this.hovered = false;
        this.actor.connect("enter-event", () => {
            this.hovered = true;
            this._applyOpacity();
            return Clutter.EVENT_PROPAGATE;
        });
        this.actor.connect("leave-event", () => {
            this.hovered = false;
            this._applyOpacity();
            return Clutter.EVENT_PROPAGATE;
        });

        let makeIcon = (name) => new St.Icon({
            icon_name: name, icon_type: St.IconType.SYMBOLIC,
            icon_size: this.getPanelIconSize(St.IconType.SYMBOLIC),
            y_align: Clutter.ActorAlign.CENTER,
        });
        let makeLabel = () => new St.Label({ style_class: "sysmon-value", y_align: Clutter.ActorAlign.CENTER });

        this.cpuIcon = makeIcon("xsi-cpu-symbolic");
        this.graph = new St.DrawingArea({ style_class: "sysmon-graph", y_expand: true });
        this.graph.connect("repaint", (area) => this._drawGraph(area));
        this.cpuLabel = makeLabel();
        this.ramIcon = makeIcon("xsi-ram-symbolic");
        this.ramLabel = makeLabel();
        this.tempIcon = makeIcon("xsi-temperature-symbolic");
        this.tempLabel = makeLabel();
        this.ssdIcon = makeIcon("xsi-drive-harddisk-solidstate-symbolic");
        this.ssdLabel = makeLabel();
        this.batIcon = makeIcon("xsi-battery-symbolic");
        this.batLabel = makeLabel();
        this.icons = [this.cpuIcon, this.ramIcon, this.tempIcon, this.ssdIcon, this.batIcon];

        // Each item is a group (icon + value): small spacing inside, larger spacing between groups
        this.groups = [
            [this.cpuIcon, this.graph, this.cpuLabel],
            [this.ramIcon, this.ramLabel],
            [this.tempIcon, this.tempLabel],
            [this.ssdIcon, this.ssdLabel],
            [this.batIcon, this.batLabel],
        ].map((children) => {
            let group = new St.BoxLayout({ style_class: "sysmon-group", y_align: Clutter.ActorAlign.CENTER });
            for (let child of children) group.add_child(child);
            this.box.add_child(group);
            return group;
        });
    }

    on_panel_height_changed() {
        let size = this.getPanelIconSize(St.IconType.SYMBOLIC);
        for (let icon of this.icons) icon.icon_size = size;
        this.graph.set_height(Math.max(12, Math.round(this._panelHeight * 0.6)));
    }

    _drawGraph(area) {
        let cr = area.get_context();
        let [w, h] = area.get_surface_size();
        let fg = area.get_theme_node().get_foreground_color();
        let [r, g, b] = this._levelRgb(this.cpu, this.cpuWarn, this.cpuCrit);

        if (this.graphBackground) {
            cr.setSourceRGBA(fg.red / 255, fg.green / 255, fg.blue / 255, 0.12);
            cr.rectangle(0, 0, w, h);
            cr.fill();
        }

        let n = this.history.length;
        let step = w / (n - 1);
        let y = (v) => h - 1 - (Math.min(v, 100) / 100) * (h - 2);

        cr.moveTo(0, h);
        for (let i = 0; i < n; i++) cr.lineTo(i * step, y(this.history[i]));
        cr.lineTo(w, h);
        cr.closePath();
        cr.setSourceRGBA(r, g, b, 0.35);
        cr.fill();

        cr.moveTo(0, y(this.history[0]));
        for (let i = 1; i < n; i++) cr.lineTo(i * step, y(this.history[i]));
        cr.setSourceRGBA(r, g, b, 1);
        cr.setLineWidth(1.2);
        cr.stroke();

        cr.$dispose();
    }

    _level(value, warn, crit) {
        if (value === null) return "sysmon-ok";
        return value >= crit ? "sysmon-crit" : value >= warn ? "sysmon-warn" : "sysmon-ok";
    }

    _levelRgb(value, warn, crit) {
        let level = this._level(value, warn, crit);
        if (level === "sysmon-crit") return [1.0, 0.42, 0.42];
        if (level === "sysmon-warn") return [0.96, 0.77, 0.26];
        return [0.56, 0.82, 0.42];
    }

    _setLevel(label, cls) {
        for (let c of ["sysmon-ok", "sysmon-warn", "sysmon-crit"]) label.remove_style_class_name(c);
        label.add_style_class_name(cls);
    }

    // ---------- Popup menu ----------
    _buildMenu() {
        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, this._orientation);
        this.menuManager.addMenu(this.menu);

        this.menu.addMenuItem(new PopupMenu.PopupMenuItem(_("Usage per core"), { reactive: false }));
        this.coreItem = new PopupMenu.PopupMenuItem("", { reactive: false });
        this.coreItem.label.add_style_class_name("sysmon-mono");
        this.menu.addMenuItem(this.coreItem);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.menu.addMenuItem(new PopupMenu.PopupMenuItem(_("Top CPU processes"), { reactive: false }));
        this.procItem = new PopupMenu.PopupMenuItem(_("Loading..."), { reactive: false });
        this.procItem.label.add_style_class_name("sysmon-mono");
        this.menu.addMenuItem(this.procItem);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        let open = new PopupMenu.PopupIconMenuItem(_("Open System Monitor"), "utilities-system-monitor", St.IconType.SYMBOLIC);
        open.connect("activate", () => Util.spawn(["gnome-system-monitor"]));
        this.menu.addMenuItem(open);

        this.menu.connect("open-state-changed", (menu, isOpen) => {
            this._applyOpacity();
            if (isOpen) {
                this._updateMenu();
                this._loadProcesses();
            }
        });
    }

    on_applet_clicked() {
        this.menu.toggle();
    }

    _updateMenu() {
        let bar = (p) => {
            let full = Math.round(p / 10);
            return "█".repeat(full) + "░".repeat(10 - full);
        };
        this.coreItem.label.set_text(this.cores
            .map((p, i) => "%s  %s %s%%".format(_("Core %s").format(String(i).padStart(2)), bar(p),
                                                 String(Math.round(p)).padStart(3)))
            .join("\n"));
    }

    _loadProcesses() {
        // Two top samples: the second one reflects current usage (the first is an average since start)
        Util.spawnCommandLineAsyncIO("", (out) => {
            if (this.removed) return;
            if (!out) {
                this.procItem.label.set_text(_("Unavailable"));
                return;
            }
            let blocks = out.split(/^\s*PID\s+USER.*$/m);
            let lines = blocks[blocks.length - 1].trim().split("\n").slice(0, 6);
            let ncpu = Math.max(1, this.cores.length);
            this.procItem.label.set_text(lines.map((line) => {
                let c = line.trim().split(/\s+/);
                let cpu = parseFloat(c[8]) / ncpu;  // normalized to 0-100% of the whole CPU
                let mem = parseFloat(c[9]);
                let name = c.slice(11).join(" ").slice(0, 22);
                return `${name.padEnd(22)} ${cpu.toFixed(1).padStart(5)}%  ${mem.toFixed(1).padStart(4)}% RAM`;
            }).join("\n"));
        }, { argv: ["env", "LC_ALL=C", "top", "-b", "-n", "2", "-d", "0.5", "-o", "%CPU", "-w", "200"] });
    }

    // ---------- Data ----------
    _parseCpu(stat) {
        if (!stat) return;
        let now = [];
        for (let line of stat.split("\n")) {
            if (!line.startsWith("cpu")) break;
            let v = line.split(/\s+/).slice(1, 9).map(Number);
            now.push([v[3] + v[4], v.reduce((a, b) => a + b, 0)]);  // [idle + iowait, total]
        }
        if (this.prevCpu) {
            let pct = now.map(([idle, total], i) => {
                let [prevIdle, prevTotal] = this.prevCpu[i] || [idle, total];
                let dt = total - prevTotal;
                return dt > 0 ? 100 * (1 - (idle - prevIdle) / dt) : 0;
            });
            this.cpu = pct[0];
            this.cores = pct.slice(1);
        }
        this.prevCpu = now;
    }

    _parseMem(info) {
        if (!info) return;
        let m = {};
        for (let line of info.split("\n")) {
            let match = line.match(/^(\w+):\s+(\d+)/);
            if (match) m[match[1]] = parseInt(match[2], 10) * 1024;
        }
        this.mem = {
            total: m.MemTotal,
            used: m.MemTotal - m.MemAvailable,
            swapTotal: m.SwapTotal,
            swapUsed: m.SwapTotal - m.SwapFree,
        };
    }

    async _readBattery() {
        let p = this.batPaths;
        if (!p) return null;
        let [cap, status, now, full, rate] = await Promise.all([
            readInt(p.capacity), readFile(p.status), readInt(p.now), readInt(p.full), readInt(p.rate),
        ]);
        if (cap === null) return null;
        status = (status || "").trim();
        let hours = null;
        if (rate > 0 && now !== null) {
            if (status === "Discharging") hours = now / rate;
            else if (status === "Charging" && full !== null) hours = (full - now) / rate;
        }
        return { cap, status, hours };
    }

    _batteryIconName() {
        let { cap, status } = this.bat;
        if (status === "Full" || (status === "Not charging" && cap >= 95))
            return "xsi-battery-level-100-charged-symbolic";
        let level = Math.min(100, Math.round(cap / 10) * 10);
        return `xsi-battery-level-${level}${status === "Charging" ? "-charging" : ""}-symbolic`;
    }

    _batteryStatusText() {
        let duration = formatDuration(this.bat.hours);
        switch (this.bat.status) {
            case "Charging":
                return duration ? _("Charging, full in about %s").format(duration) : _("Charging");
            case "Discharging":
                return duration ? _("On battery, about %s remaining").format(duration) : _("On battery");
            case "Full":
                return _("Fully charged");
            case "Not charging":
                return _("Plugged in, not charging");
            default:
                return this.bat.status;
        }
    }

    _tick() {
        if (!this.busy) this._refresh();
        return GLib.SOURCE_CONTINUE;
    }

    async _refresh() {
        this.busy = true;
        try {
            let [stat, meminfo, temp, ssdTemp, bat] = await Promise.all([
                readFile("/proc/stat"),
                readFile("/proc/meminfo"),
                readInt(this.cpuTempPath),
                readInt(this.ssdTempPath),
                this._readBattery(),
            ]);
            if (this.removed) return;
            this._parseCpu(stat);
            this._parseMem(meminfo);
            this.temp = temp !== null ? temp / 1000 : null;
            this.ssdTemp = ssdTemp !== null ? ssdTemp / 1000 : null;
            this.bat = bat;
            this._render();
        } catch (e) {
            global.logError(`${UUID}: ${e}`);
        } finally {
            this.busy = false;
        }
    }

    _render() {
        this.history.push(this.cpu);
        this.history.shift();

        let gb = (bytes) => (bytes / 1024 ** 3).toFixed(1);
        let ramPct = this.mem.total ? 100 * this.mem.used / this.mem.total : 0;

        this.cpuLabel.set_text(`${Math.round(this.cpu)}%`);
        this._setLevel(this.cpuLabel, this._level(this.cpu, this.cpuWarn, this.cpuCrit));

        this.ramLabel.set_text(this.ramFormat === "pct" ? `${Math.round(ramPct)}%` : `${gb(this.mem.used)}G`);
        this._setLevel(this.ramLabel, this._level(ramPct, this.ramWarn, this.ramCrit));

        if (this.temp !== null) {
            this.tempLabel.set_text(`${Math.round(this.temp)}°C`);
            this._setLevel(this.tempLabel, this._level(this.temp, this.tempWarn, this.tempCrit));
        }

        if (this.ssdTemp !== null) {
            this.ssdLabel.set_text(`${Math.round(this.ssdTemp)}°C`);
            this._setLevel(this.ssdLabel, this._level(this.ssdTemp, this.tempWarn, this.tempCrit));
        }

        if (this.bat) {
            this.batLabel.set_text(`${this.bat.cap}%`);
            this.batIcon.icon_name = this._batteryIconName();
            // Battery is inverted (lower is worse) and only warns while discharging
            let level = "sysmon-ok";
            if (this.bat.status === "Discharging") {
                if (this.bat.cap <= this.batCrit) level = "sysmon-crit";
                else if (this.bat.cap <= this.batWarn) level = "sysmon-warn";
            }
            this._setLevel(this.batLabel, level);
        }

        if (this.showGraph) this.graph.queue_repaint();

        let tip = [
            _("CPU: %d%% (%d cores)").format(Math.round(this.cpu), this.cores.length),
            _("RAM: %s / %s GB (%d%%)").format(gb(this.mem.used), gb(this.mem.total), Math.round(ramPct)),
            _("Swap: %s / %s GB").format(gb(this.mem.swapUsed), gb(this.mem.swapTotal)),
        ];
        if (this.temp !== null) tip.push(_("CPU temperature: %d°C").format(Math.round(this.temp)));
        if (this.ssdTemp !== null) tip.push(_("SSD temperature: %d°C").format(Math.round(this.ssdTemp)));
        if (this.bat) tip.push(_("Battery: %d%% (%s)").format(this.bat.cap, this._batteryStatusText()));
        this.set_applet_tooltip(tip.join("\n"));

        if (this.menu.isOpen) this._updateMenu();
    }

    // ---------- Settings / lifecycle ----------
    _onSettingsChanged() {
        let hasTemp = this.showTemp && this.cpuTempPath !== null;
        let hasSsd = this.showSsdTemp && this.ssdTempPath !== null;
        let hasBat = this.showBattery && this.batPaths !== null;
        let nothing = !this.showCpu && !this.showGraph && !this.showRam && !hasTemp && !hasSsd && !hasBat;

        // If everything is turned off, keep the CPU icon so the applet can still be clicked/configured
        this.cpuIcon.visible = nothing || (this.showIcons && (this.showCpu || this.showGraph));
        this.graph.visible = this.showGraph;
        this.cpuLabel.visible = this.showCpu;
        this.ramIcon.visible = this.showIcons && this.showRam;
        this.ramLabel.visible = this.showRam;
        this.tempIcon.visible = this.showIcons && hasTemp;
        this.tempLabel.visible = hasTemp;
        this.ssdIcon.visible = this.showIcons && hasSsd;
        this.ssdLabel.visible = hasSsd;
        this.batIcon.visible = this.showIcons && hasBat;
        this.batLabel.visible = hasBat;
        for (let group of this.groups) group.visible = group.get_children().some((c) => c.visible);

        this.graph.set_width(this.graphWidth);
        this.graph.set_height(Math.max(12, Math.round(this._panelHeight * 0.6)));
        this.graph.queue_repaint();
        this._applyOpacity();
        this._startTimer();
    }

    _applyOpacity() {
        let solid = this.opaqueOnHover && (this.hovered || this.menu.isOpen);
        let target = Math.round(255 * (solid ? 100 : this.opacity) / 100);
        this.box.remove_all_transitions();
        this.box.ease({ opacity: target, duration: 150, mode: Clutter.AnimationMode.EASE_OUT_QUAD });
    }

    _startTimer() {
        if (this.timer) GLib.source_remove(this.timer);
        this._tick();
        this.timer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, this.updateInterval * 1000, () => this._tick());
    }

    on_applet_removed_from_panel() {
        this.removed = true;
        if (this.timer) GLib.source_remove(this.timer);
        this.timer = 0;
        this.settings.finalize();
    }
}

function main(metadata, orientation, panelHeight, instanceId) {
    return new SysMonApplet(metadata, orientation, panelHeight, instanceId);
}
