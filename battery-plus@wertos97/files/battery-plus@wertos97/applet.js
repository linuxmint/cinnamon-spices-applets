const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;
const St = imports.gi.St;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Cairo = imports.cairo;
const Mainloop = imports.mainloop;
const Interfaces = imports.misc.interfaces;
const UPowerGlib = imports.gi.UPowerGlib;

const UUID = "battery-plus@wertos97";
const MAX_SESSION_GAP = 5 * 60;

const DEFAULT_STAT_ROWS = [
    { key: "state", show: true },
    { key: "time", show: true },
    { key: "duration", show: true },
    { key: "rate", show: true },
    { key: "voltage", show: true },
    { key: "health", show: true },
    { key: "cycles", show: true }
];

const {
    DeviceKind: UPDeviceKind,
    DeviceState: UPDeviceState
} = UPowerGlib;

// UPower: 0 unknown, 1 charging, 2 discharging, 3 empty,
//         4 fully-charged, 5 pending-charge, 6 pending-discharge

const THEMES = {
    graphite: {
        background: "#24272e", foreground: "#f4f7fb", muted: "#a9b2c0",
        accent: "#8cccff", border: "#414957", highlight: "#343a46",
        graphBackground: "#171a20",
        curve: "#f4f7fb", fill: "#8cccff", shade: "#59d966",
        grid: "#8993a3", dot: "#8cd159"
    },
    midnight: {
        background: "#111827", foreground: "#f8fafc", muted: "#94a3b8",
        accent: "#60a5fa", border: "#334155", highlight: "#1e293b",
        graphBackground: "#080e1b",
        curve: "#93c5fd", fill: "#3b82f6", shade: "#34d399",
        grid: "#64748b", dot: "#22d3ee"
    },
    forest: {
        background: "#14251c", foreground: "#f0f7f2", muted: "#9eb9a6",
        accent: "#7ee2a8", border: "#315440", highlight: "#244333",
        graphBackground: "#0c1811",
        curve: "#9af0bc", fill: "#4ade80", shade: "#facc15",
        grid: "#668574", dot: "#f6d365"
    },
    paper: {
        background: "#f7f4ed", foreground: "#25282d", muted: "#6b7078",
        accent: "#26714b", border: "#d6d0c4", highlight: "#e6dfd2",
        graphBackground: "#eeeadf",
        curve: "#25282d", fill: "#70a98b", shade: "#76b947",
        grid: "#8f918f", dot: "#26714b"
    },
    frost: {
        background: "#eff7fb", foreground: "#1d3444", muted: "#617987",
        accent: "#1677a6", border: "#bfd5df", highlight: "#d6e9f1",
        graphBackground: "#e2f0f6",
        curve: "#1677a6", fill: "#5bb4da", shade: "#55b98a",
        grid: "#7895a3", dot: "#0f8a73"
    },
    sand: {
        background: "#f5ead8", foreground: "#3e3025", muted: "#796858",
        accent: "#a3532a", border: "#d9c3a4", highlight: "#e7d2b4",
        graphBackground: "#ebdcc5",
        curve: "#70452f", fill: "#d79a62", shade: "#91a957",
        grid: "#9f8a73", dot: "#a3532a"
    }
};

function parseColor(str) {
    if (!str || typeof str !== "string")
        return null;
    str = str.trim().toLowerCase();
    let m;
    m = str.match(/^#([0-9a-f]{6})([0-9a-f]{2})?$/);
    if (m) {
        let v = m[1];
        return [parseInt(v.slice(0, 2), 16) / 255,
                parseInt(v.slice(2, 4), 16) / 255,
                parseInt(v.slice(4, 6), 16) / 255];
    }
    m = str.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/);
    if (m)
        return [parseInt(m[1] + m[1], 16) / 255,
                parseInt(m[2] + m[2], 16) / 255,
                parseInt(m[3] + m[3], 16) / 255];
    m = str.match(/^rgba?\s*\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/);
    if (m) {
        let conv = v => v.indexOf("%") >= 0
            ? parseFloat(v) / 100 : parseFloat(v) / 255;
        let rgb = [conv(m[1]), conv(m[2]), conv(m[3])];
        if (rgb.some(v => isNaN(v) || v < 0 || v > 1))
            return null;
        return rgb;
    }
    return null;
}

function colorToCss(value, fallback) {
    let rgb = parseColor(value) || parseColor(fallback);
    return "rgb(" + rgb.map(v => Math.round(v * 255)).join(",") + ")";
}

function formatHMM(totalSeconds) {
    let mins = Math.round(totalSeconds / 60);
    let h = Math.floor(mins / 60);
    let m = mins % 60;
    return h + ":" + (m < 10 ? "0" + m : m);
}

function formatClock(epochSeconds) {
    let d = new Date(epochSeconds * 1000);
    let h = d.getHours();
    let m = d.getMinutes();
    return h + ":" + (m < 10 ? "0" + m : m);
}

function stateToString(state) {
    switch (state) {
        case UPDeviceState.CHARGING: return _("Charging");
        case UPDeviceState.DISCHARGING: return _("Discharging");
        case UPDeviceState.FULLY_CHARGED: return _("Full");
        case UPDeviceState.EMPTY: return _("Empty");
        case UPDeviceState.PENDING_CHARGE: return _("Pending charge");
        case UPDeviceState.PENDING_DISCHARGE: return _("Pending");
        default: return _("Unknown state");
    }
}

class BatteryPlusApplet extends Applet.TextIconApplet {
    constructor(metadata, orientation, panel_height, instanceId) {
        super(orientation, panel_height, instanceId);
        this.setAllowedLayout(Applet.AllowedLayout.BOTH);
        this.metadata = metadata;

        this.settings = new Settings.AppletSettings(this, UUID, instanceId);
        this.settings.bind("history_hours", "history_hours",
            () => this._redrawGraph());
        this.settings.bind("show_icon", "show_icon",
            () => this._refresh());
        this.settings.bind("show_bottom_row", "show_bottom_row",
            () => this._refresh());
        this.settings.bind("verbose_time", "verbose_time",
            () => this._refresh());
        this.settings.bind("graph_shade", "graph_shade",
            () => this._redrawGraph());
        this.settings.bind("theme", "theme",
            () => this._applyTheme());
        for (let _ck of ["background", "foreground", "muted", "accent", "border", "highlight",
                         "graph_background", "curve", "fill", "shade", "grid", "dot"])
            this.settings.bind("color_" + _ck, "color_" + _ck,
                () => this._applyTheme());
        this.settings.bind("low_notify", "low_notify");
        this.settings.bind("low_level", "low_level");
        this.settings.bind("decimals", "decimals",
            () => this._renderStats());
        this.settings.bind("stat_rows", "stat_rows",
            () => this._buildStatsBox());

        // The panel is built by the system base class (same as the clock
        // and the battery icon).
        // This keeps the alignment identical to the neighboring applets by construction.
        this.set_show_label_in_vertical_panels(false);
        this.set_applet_icon_symbolic_name("battery-good-symbolic");

        // --- popup ---
        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);

        // header
        this._titleLabel = new St.Label({ style_class: "battery-plus-title", text: "" });
        this._subLabel = new St.Label({ style_class: "battery-plus-sub", text: "" });
        let headBox = new St.BoxLayout({ vertical: true, style_class: "battery-plus-pad" });
        headBox.add_actor(this._titleLabel);
        headBox.add_actor(this._subLabel);
        let headSection = new PopupMenu.PopupMenuSection();
        headSection.addActor(headBox);
        this.menu.addMenuItem(headSection);
        this._headerSep = new PopupMenu.PopupSeparatorMenuItem();
        this.menu.addMenuItem(this._headerSep);

        // stats (rows and order come from settings)
        this._statRows = {};
        this._statNames = {};
        this._statsBox = new St.BoxLayout({ vertical: true, style_class: "battery-plus-pad" });
        this._buildStatsBox();
        let statsSection = new PopupMenu.PopupMenuSection();
        statsSection.addActor(this._statsBox);
        this.menu.addMenuItem(statsSection);

        // power profiles (if the daemon is available)
        this._profileSection = new PopupMenu.PopupMenuSection();
        this._profileTitleLabel = new St.Label({
            style_class: "battery-plus-section-label battery-plus-pad",
            text: _("Power mode")
        });
        this._profileSection.addActor(this._profileTitleLabel);
        this._profileItems = [];
        this.menu.addMenuItem(this._profileSection);
        this._profileSep = new PopupMenu.PopupSeparatorMenuItem();
        this.menu.addMenuItem(this._profileSep);
        this._initPowerProfiles();

        // graph
        let graphLabelSection = new PopupMenu.PopupMenuSection();
        this._graphTitleLabel = new St.Label({
            style_class: "battery-plus-section-label battery-plus-pad",
            text: _("Charge history")
        });
        graphLabelSection.addActor(this._graphTitleLabel);
        this.menu.addMenuItem(graphLabelSection);
        this._graph = new St.DrawingArea({ style_class: "battery-plus-graph" });
        this._graph.set_width(300);
        this._graph.set_height(130);
        this._graph.connect("repaint", () => this._drawGraph());
        this._graphFrame = new St.BoxLayout({ style_class: "battery-plus-graph-box" });
        this._graphFrame.add_actor(this._graph);
        let graphSection = new PopupMenu.PopupMenuSection();
        graphSection.addActor(this._graphFrame);
        this.menu.addMenuItem(graphSection);

        this._minmaxLabel = new St.Label({ style_class: "battery-plus-graph-note", text: "" });
        let noteBox = new St.BoxLayout({ vertical: true, style_class: "battery-plus-pad" });
        noteBox.add_actor(this._minmaxLabel);
        let noteSection = new PopupMenu.PopupMenuSection();
        noteSection.addActor(noteBox);
        this.menu.addMenuItem(noteSection);
        this._footerSep = new PopupMenu.PopupSeparatorMenuItem();
        this.menu.addMenuItem(this._footerSep);
        this._settingsItem = this.menu.addSettingsAction(_("Power settings"), "power");
        this._styleMenuItem(this._settingsItem);

        this.menu.connect("open-state-changed",
            (menu, open) => {
                if (open) {
                    this._applyTheme();
                    this._refreshStats();
                    this._updateProfileDots();
                    this._redrawGraph();
                }
            });

        // --- data ---
        this._devices = [];
        this._pct = 0;
        this._state = UPDeviceState.UNKNOWN;
        this._seconds = 0;
        this._batteryId = null;
        this._lowNotified = false;
        this._stats = { rate: null, voltage: null, capacity: null, cycles: null };
        this._ppd = null;
        this._activeProfile = null;
        this._history = null;
        this._historyLoading = false;
        this._historyWaiters = [];
        this._activity = null;

        this._historyDir = GLib.get_user_data_dir() + "/battery-plus";
        this._historyFile = this._historyDir + "/history.csv";
        try {
            Gio.File.new_for_path(this._historyDir)
                .make_directory_with_parents(null);
        } catch (e) { /* already exists */ }

        this._applyTheme();

        // --- csd-power proxy (same one as the system applet) ---
        this._proxy = null;
        Gio.bus_watch_name(Gio.BusType.SESSION,
            "org.cinnamon.SettingsDaemon.Power", 0,
            () => {
                Interfaces.getDBusProxyAsync("org.cinnamon.SettingsDaemon.Power",
                    (proxy, error) => {
                        if (error) {
                            global.logError("[" + UUID + "] no csd-power", error.message);
                            return;
                        }
                        this._proxy = proxy;
                        this._proxy.connect("g-properties-changed",
                            () => this._devicesChanged());
                        this._devicesChanged();
                    });
            }, null);

        // label refresh every 30 s, history log every 60 s
        this._refreshTimer = Mainloop.timeout_add_seconds(30,
            () => {
                this._devicesChanged();
                return true;
            });
        this._logTimer = Mainloop.timeout_add_seconds(60,
            () => {
                this._logSample();
                return true;
            });
    }

    on_applet_clicked(event) {
        this.menu.toggle();
    }

    on_applet_removed_from_panel() {
        if (this._refreshTimer) Mainloop.source_remove(this._refreshTimer);
        if (this._logTimer) Mainloop.source_remove(this._logTimer);
    }

    // --- device polling ---
    _devicesChanged() {
        if (!this._proxy)
            return;
        this._proxy.GetDevicesRemote((result, error) => {
            if (error)
                return;
            let devices = result[0];
            this._devices = devices;
            this._refresh();
        });
    }

    _findBattery() {
        for (let i = 0; i < this._devices.length; i++) {
            let dev = this._devices[i];
            if (dev[3] === UPDeviceKind.BATTERY)
                return dev;
        }
        return null;
    }

    _refresh() {
        let dev = this._findBattery();
        if (!dev)
            return;
        let [device_id, vendor, model, kind, icon, percentage, state, level, seconds] = dev;
        this._batteryId = device_id;
        this._pct = Math.round(percentage);
        this._state = state;
        this._seconds = seconds;
        this._observeActivityState(state);

        try {
            this._applet_icon.set_gicon(Gio.icon_new_for_string(icon));
        } catch (e) {
            this.set_applet_icon_symbolic_name("battery-good-symbolic");
        }
        if (this._applet_icon)
            this._applet_icon.visible = (this.show_icon !== false);

        // one plain label like the clock: "72%\n2:27" — no markup,
        // no margins, same class and same base widget.
        let bottom = (this.show_bottom_row === false) ? "" : this._bottomText();
        this.set_applet_label(bottom !== ""
            ? (this._pct + "%\n" + bottom)
            : (this._pct + "%"));

        let tip = this._pct + "% — " + stateToString(state);
        if ((state === UPDeviceState.CHARGING ||
             state === UPDeviceState.DISCHARGING) && seconds > 0)
            tip += " (" + this._fmtTime(seconds) + ")";
        this.set_applet_tooltip(tip);

        this._updateHeader();
        if (this.menu.isOpen)
            this._refreshStats();
        this._checkLowBattery();
        this._redrawGraph();
    }

    _fmtTime(totalSeconds) {
        if (this.verbose_time) {
            let mins = Math.round(totalSeconds / 60);
            let h = Math.floor(mins / 60);
            let m = mins % 60;
            if (h > 0)
                return _("%d h %d m").format(h, m);
            if (m > 0)
                return _("%d min").format(m);
            return _("less than a minute");
        }
        return formatHMM(totalSeconds);
    }

    _checkLowBattery() {
        let at = 20;
        try { at = parseInt(this.low_level, 10) || 20; } catch (e) {}
        if (this.low_notify && this._state === UPDeviceState.DISCHARGING &&
            this._pct <= at && !this._lowNotified) {
            this._lowNotified = true;
            try {
                let p = Gio.Subprocess.new(
                    ["notify-send", "-i", "battery-caution",
                     _("Low battery"),
                     _("%d%% remaining").format(this._pct)],
                    Gio.SubprocessFlags.NONE);
                p.wait_async(null, null, (o, res) => {
                    try { o.wait_finish(res); } catch (e) {}
                });
            } catch (e) {}
        }
        if (this._state === UPDeviceState.CHARGING ||
            this._state === UPDeviceState.FULLY_CHARGED ||
            this._pct > at + 5)
            this._lowNotified = false;
    }

    _bottomText() {
        if (this._state === UPDeviceState.FULLY_CHARGED)
            return _("Full");
        if (this._state === UPDeviceState.CHARGING ||
            this._state === UPDeviceState.DISCHARGING)
            return this._seconds > 0 ? this._fmtTime(this._seconds) : "…";
        return stateToString(this._state);
    }

    _statLabel(key) {
        switch (key) {
            case "state": return _("State");
            case "time": return _("Time");
            case "duration": return _("Activity duration");
            case "rate": return _("Power");
            case "voltage": return _("Voltage");
            case "health": return _("Health");
            case "cycles": return _("Charge cycles");
            default: return null;
        }
    }

    _buildStatsBox() {
        let kids = this._statsBox.get_children();
        for (let k of kids)
            k.destroy();
        this._statRows = {};
        this._statNames = {};
        let defs = Array.isArray(this.stat_rows) && this.stat_rows.length
            ? this.stat_rows : DEFAULT_STAT_ROWS;
        let seen = {};
        for (let r of defs) {
            if (!r || typeof r.key !== "string")
                continue;
            let key = r.key === "session" ? "duration" : r.key;
            if (seen[key])
                continue;
            let label = this._statLabel(key);
            if (!label)
                continue; // unknown key
            seen[key] = true;
            if (r.show === false)
                continue;
            let row = new St.BoxLayout({});
            let n = new St.Label({ style_class: "battery-plus-stat-name", text: label });
            n.set_width(110);
            let v = new St.Label({ style_class: "battery-plus-stat-value", text: "—" });
            row.add_actor(n);
            row.add_actor(v);
            this._statsBox.add_actor(row);
            this._statNames[key] = n;
            this._statRows[key] = v;
        }
        this._applyTheme();
        this._updateHeader();
        if (this.menu && this.menu.isOpen)
            this._refreshStats();
    }

    _observeActivityState(state) {
        let active = (state === UPDeviceState.CHARGING ||
                      state === UPDeviceState.DISCHARGING) ? state : null;
        if ((this._activity ? this._activity.state : null) === active)
            return;

        let now = Math.floor(Date.now() / 1000);
        this._activity = active === null ? null : { state: active, start: now };
        this._ensureHistory(() => {
            if (active !== null && this._activity && this._activity.state === active) {
                let start = now, nextTimestamp = now;
                for (let i = this._history.length - 1; i >= 0; i--) {
                    let row = this._history[i];
                    if (row.t > now)
                        continue;
                    if (nextTimestamp - row.t > MAX_SESSION_GAP)
                        break;
                    nextTimestamp = row.t;
                    if (row.s === UPDeviceState.UNKNOWN)
                        continue;
                    if (row.s !== active)
                        break;
                    start = row.t;
                }
                this._activity.start = Math.min(start, now);
            }
            this._recordSample(now, state);
            if (this.menu.isOpen)
                this._updateHeader();
        });
    }

    _sessionInfo() {
        if (!this._activity)
            return null;
        return {
            charging: this._activity.state === UPDeviceState.CHARGING,
            dur: Math.max(0, Math.floor(Date.now() / 1000) - this._activity.start)
        };
    }

    _sessionText(info) {
        if (!info)
            return "—";
        let d = info.dur;
        let dd = Math.floor(d / 86400),
            hh = Math.floor(d % 86400 / 3600),
            mm = Math.floor(d % 3600 / 60);
        return _("%d d %d h %d min").format(dd, hh, mm);
    }

    _updateHeader() {
        let tip = this._pct + "% — " + stateToString(this._state);
        if ((this._state === UPDeviceState.CHARGING ||
             this._state === UPDeviceState.DISCHARGING) && this._seconds > 0)
            tip += " (" + this._fmtTime(this._seconds) + ")";
        this._titleLabel.set_text(this._pct + "%");
        this._subLabel.set_text(stateToString(this._state) +
            (((this._state === UPDeviceState.CHARGING ||
               this._state === UPDeviceState.DISCHARGING) && this._seconds > 0)
                ? " • " + this._fmtTime(this._seconds) : ""));
        if (this._statRows.state)
            this._statRows.state.set_text(stateToString(this._state));
        if (this._statRows.time)
            this._statRows.time.set_text(
                ((this._state === UPDeviceState.CHARGING ||
                  this._state === UPDeviceState.DISCHARGING) && this._seconds > 0)
                    ? this._fmtTime(this._seconds) : "—");
        let si = this._sessionInfo();
        if (this._statNames.duration)
            this._statNames.duration.set_text(!si ? _("Activity duration")
                : (si.charging ? _("Charging for") : _("Discharging for")));
        if (this._statRows.duration)
            this._statRows.duration.set_text(si ? this._sessionText(si) : "—");
    }

    // --- stats from `upower -i` (on menu open and in background while open) ---
    _refreshStats() {
        if (!this._batteryId)
            return;
        let argv;
        try {
            [, argv] = GLib.shell_parse_argv("upower -i " + this._batteryId);
        } catch (e) { return; }
        if (!argv)
            return;
        let proc;
        try {
            proc = Gio.Subprocess.new(argv,
                Gio.SubprocessFlags.STDOUT_PIPE |
                Gio.SubprocessFlags.STDERR_SILENCE);
        } catch (e) { return; }
        proc.communicate_utf8_async(null, null, (p, res) => {
            try {
                let [, out] = p.communicate_utf8_finish(res);
                let rate = null, volt = null, cap = null, cyc = null;
                for (let line of out.split("\n")) {
                    let m;
                    m = line.match(/energy-rate:\s*([\d.,]+)/);
                    if (m) rate = parseFloat(m[1].replace(",", "."));
                    m = line.match(/^\s*voltage:\s*([\d.,]+)/);
                    if (m) volt = parseFloat(m[1].replace(",", "."));
                    m = line.match(/capacity:\s*([\d.,]+)/);
                    if (m) cap = parseFloat(m[1].replace(",", "."));
                    m = line.match(/charge-cycles:\s*(\d+)/);
                    if (m) cyc = parseInt(m[1], 10);
                }
                this._stats = { rate: rate, voltage: volt, capacity: cap, cycles: cyc };
                this._renderStats();
            } catch (e) { /* ignore */ }
        });
    }

    _renderStats() {
        let d = 1;
        try {
            d = parseInt(this.decimals, 10);
            if (isNaN(d)) d = 1;
        } catch (e) { d = 1; }
        d = Math.max(0, Math.min(3, d));
        let fmt = v => (v !== null && !isNaN(v) && v > 0)
            ? v.toLocaleString(undefined,
                { minimumFractionDigits: d, maximumFractionDigits: d })
            : null;
        let r = fmt(this._stats.rate), u = fmt(this._stats.voltage);
        if (this._statRows.rate)
            this._statRows.rate.set_text(r !== null ? r + " W" : "—");
        if (this._statRows.voltage)
            this._statRows.voltage.set_text(u !== null ? u + " V" : "—");
        let cap = this._stats.capacity, cyc = this._stats.cycles;
        if (this._statRows.health)
            this._statRows.health.set_text(
                (cap !== null && !isNaN(cap))
                    ? _("%d%%").format(Math.round(cap)) : "—");
        if (this._statRows.cycles)
            this._statRows.cycles.set_text(
                (cyc !== null && !isNaN(cyc)) ? String(cyc) : "—");
    }

    // --- power profiles (power-profiles-daemon, like the system applet) ---
    _initPowerProfiles() {
        this._profilesBuilt = false;
        this._ppdTries = 0;
        Mainloop.timeout_add_seconds(2, () => {
            this._ppdTries++;
            try {
                if (!this._ppd) {
                    let iface = "<node><interface name='net.hadess.PowerProfiles'>" +
                        "<property name='ActiveProfile' type='s' access='readwrite'/>" +
                        "<property name='Profiles' type='aa{sv}' access='read'/>" +
                        "</interface></node>";
                    let Proxy = Gio.DBusProxy.makeProxyWrapper(iface);
                    this._ppd = new Proxy(Gio.DBus.system,
                        "net.hadess.PowerProfiles", "/net/hadess/PowerProfiles");
                    this._ppd.connect("g-properties-changed",
                        () => {
                            try { this._activeProfile = this._ppd.ActiveProfile; } catch (e) {}
                            this._updateProfileDots();
                        });
                }
                if (this._ppd && this._ppd.Profiles && this._ppd.Profiles.length) {
                    this._buildProfiles();
                    return false;
                }
            } catch (e) {
                this._ppd = null;
            }
            if (this._ppdTries >= 5) {
                this._profileSection.hide();
                this._profileSep.hide();
                return false;
            }
            return true;
        });
    }

    _profileName(key) {
        if (key === "power-saver") return _("Power saver");
        if (key === "balanced") return _("Balanced");
        if (key === "performance") return _("Performance");
        return key;
    }

    _buildProfiles() {
        if (this._profilesBuilt)
            return;
        if (!this._ppd || !this._ppd.Profiles || !this._ppd.Profiles.length)
            return;
        this._profilesBuilt = true;
        for (let i = 0; i < this._profileItems.length; i++)
            this._profileItems[i].destroy();
        this._profileItems = [];
        let profiles = this._ppd.Profiles.deepUnpack
            ? this._ppd.Profiles.deepUnpack() : this._ppd.Profiles;
        try { this._activeProfile = this._ppd.ActiveProfile; } catch (e) {}
        for (let i = 0; i < profiles.length; i++) {
            let key = profiles[i].Profile.unpack
                ? profiles[i].Profile.unpack() : profiles[i].Profile;
            let item = new PopupMenu.PopupMenuItem(this._profileName(key));
            this._styleMenuItem(item);
            item.connect("activate", () => {
                try { this._ppd.ActiveProfile = key; } catch (e) {}
                this._activeProfile = key;
                this._updateProfileDots();
            });
            this._profileSection.addMenuItem(item);
            this._profileItems.push(item);
        }
        this._updateProfileDots();
    }

    _updateProfileDots() {
        if (!this._profileItems)
            return;
        for (let i = 0; i < this._profileItems.length; i++)
            this._profileItems[i].setShowDot(false);
        if (!this._ppd)
            return;
        let active = this._activeProfile;
        try { active = this._ppd.ActiveProfile; } catch (e) {}
        for (let i = 0; i < this._profileItems.length; i++) {
            if (this._profileItems[i].label.get_text() === this._profileName(active))
                this._profileItems[i].setShowDot(true);
        }
    }

    _styleMenuItem(item) {
        if (!item || !item.actor)
            return;
        item.actor.connect("enter-event", () => {
            let p = this._themePalette();
            item.actor.set_style("background-color: " + p.highlight + "; " +
                "color: " + p.foreground + ";");
        });
        item.actor.connect("leave-event", () => item.actor.set_style(null));
    }

    // --- history (in-memory cache, async file IO only) ---
    _ensureHistory(cb) {
        if (this._history !== null) {
            cb();
            return;
        }
        this._historyWaiters.push(cb);
        if (this._historyLoading)
            return;
        this._historyLoading = true;
        try {
            Gio.File.new_for_path(this._historyFile).load_contents_async(
                null, (o, res) => {
                    let rows = [];
                    try {
                        let [ok, contents] = o.load_contents_finish(res);
                        if (ok) {
                            let text = imports.byteArray.toString(contents);
                            for (let line of text.split("\n")) {
                                let p = line.split(",");
                                if (p.length < 3)
                                    continue;
                                let t = parseInt(p[0], 10),
                                    v = parseFloat(p[1]),
                                    s = parseInt(p[2], 10);
                                if (!isNaN(t) && !isNaN(v))
                                    rows.push({ t: t, v: v, s: s });
                            }
                        }
                    } catch (e) { /* no file yet */ }
                    this._history = rows;
                    this._historyLoading = false;
                    let ws = this._historyWaiters;
                    this._historyWaiters = [];
                    for (let w of ws) {
                        try { w(); } catch (e) {}
                    }
                });
        } catch (e) {
            this._history = [];
            this._historyLoading = false;
            let ws = this._historyWaiters;
            this._historyWaiters = [];
            for (let w of ws) {
                try { w(); } catch (callbackError) {}
            }
        }
    }

    _logSample() {
        if (!this._devices.length)
            return;
        this._ensureHistory(() => {
            let now = Math.floor(Date.now() / 1000);
            this._recordSample(now, this._state);
            this._redrawGraph();
        });
    }

    _recordSample(timestamp, state) {
        let cutoff = timestamp - 8 * 24 * 3600;
        this._history = (this._history || []).filter(r => r.t >= cutoff);
        let last = this._history.length ? this._history[this._history.length - 1] : null;
        let sample = { t: timestamp, v: this._pct, s: state };
        if (last && last.t === timestamp)
            this._history[this._history.length - 1] = sample;
        else
            this._history.push(sample);
        try {
            let text = this._history.map(r =>
                r.t + "," + r.v + "," + r.s).join("\n") + "\n";
            GLib.file_set_contents(this._historyFile, text);
        } catch (e) {
            global.logError("[" + UUID + "] history write", String(e));
        }
    }

    _redrawGraph() {
        if (this._graph)
            this._graph.queue_repaint();
    }

    _themePalette() {
        if (this.theme !== "user-defined")
            return THEMES[this.theme] || THEMES.graphite;
        let fallback = THEMES.graphite;
        return {
            background: colorToCss(this.color_background, fallback.background),
            foreground: colorToCss(this.color_foreground, fallback.foreground),
            muted: colorToCss(this.color_muted, fallback.muted),
            accent: colorToCss(this.color_accent, fallback.accent),
            border: colorToCss(this.color_border, fallback.border),
            highlight: colorToCss(this.color_highlight, fallback.highlight),
            graphBackground: colorToCss(this.color_graph_background, fallback.graphBackground),
            curve: colorToCss(this.color_curve, fallback.curve),
            fill: colorToCss(this.color_fill, fallback.fill),
            shade: colorToCss(this.color_shade, fallback.shade),
            grid: colorToCss(this.color_grid, fallback.grid),
            dot: colorToCss(this.color_dot, fallback.dot)
        };
    }

    _applyTheme() {
        if (!this.menu)
            return;
        let p = this._themePalette();
        this.menu.box.set_style("background-color: " + p.background + "; " +
            "color: " + p.foreground + "; border: 1px solid " + p.border + ";");
        let actorStyle = this.menu.actor.get_style() || "";
        actorStyle = actorStyle
            .replace(/-arrow-background-color\s*:[^;]*;?/g, "")
            .replace(/-arrow-border-color\s*:[^;]*;?/g, "")
            .replace(/color\s*:[^;]*;?/g, "");
        this.menu.actor.set_style(actorStyle + " -arrow-background-color: " + p.background +
            "; -arrow-border-color: " + p.border + "; color: " + p.foreground + ";");
        if (this._titleLabel)
            this._titleLabel.set_style("color: " + p.accent + ";");
        for (let label of [this._subLabel, this._profileTitleLabel,
                           this._graphTitleLabel, this._minmaxLabel]) {
            if (label)
                label.set_style("color: " + p.muted + ";");
        }
        for (let key of Object.keys(this._statNames || {}))
            this._statNames[key].set_style("color: " + p.muted + ";");
        if (this._graphFrame)
            this._graphFrame.set_style("background-color: " + p.graphBackground + "; " +
                "border: 1px solid " + p.border + ";");
        for (let separator of [this._headerSep, this._profileSep, this._footerSep]) {
            if (separator && separator._drawingArea)
                separator._drawingArea.set_style("-gradient-start: " + p.border + "; " +
                    "-gradient-end: " + p.border + ";");
        }
        this._redrawGraph();
    }

    _graphColors() {
        let p = this._themePalette();
        let rgba = (color, alpha) => {
            let rgb = parseColor(color) || [1, 1, 1];
            return [rgb[0], rgb[1], rgb[2], alpha];
        };
        return {
            curve: rgba(p.curve, 0.95), fill: rgba(p.fill, 0.12),
            shade: rgba(p.shade, 0.15), grid: rgba(p.grid, 0.28),
            text: rgba(p.muted, 0.9), dot: rgba(p.dot, 1)
        };
    }

    _drawGraph() {
        let area = this._graph;
        if (!area)
            return;
        let cr = area.get_context();
        let [w, h] = area.get_surface_size();
        cr.setOperator(Cairo.Operator.CLEAR);
        cr.paint();
        cr.setOperator(Cairo.Operator.OVER);

        const PAD_L = 30, PAD_R = 8, PAD_T = 8, PAD_B = 16;
        const gw = w - PAD_L - PAD_R, gh = h - PAD_T - PAD_B;

        cr.selectFontFace("Sans", Cairo.FontSlant.NORMAL, Cairo.FontWeight.NORMAL);
        cr.setFontSize(9);

        let spanH = 24;
        try { spanH = parseInt(this.history_hours, 10) || 24; } catch (e) {}
        let now = Math.floor(Date.now() / 1000);
        if (this._history === null) {
            this._ensureHistory(() => this._redrawGraph());
        }
        let rows = (this._history || []).filter(r => r.t >= now - spanH * 3600);

        let x = t => PAD_L + gw * (1 - (now - t) / (spanH * 3600));
        let y = v => PAD_T + gh * (1 - Math.max(0, Math.min(100, v)) / 100);
        let C = this._graphColors();

        // grid + % labels
        cr.setSourceRGBA(...C.grid);
        cr.setLineWidth(1);
        for (let g of [0, 25, 50, 75, 100]) {
            cr.moveTo(PAD_L, y(g));
            cr.lineTo(w - PAD_R, y(g));
            cr.stroke();
            cr.setSourceRGBA(...C.text);
            cr.moveTo(2, y(g) + 3);
            cr.showText(String(g));
            cr.setSourceRGBA(...C.grid);
        }

        if (rows.length < 2) {
            cr.setSourceRGBA(...C.text);
            cr.moveTo(PAD_L + 10, PAD_T + gh / 2);
            cr.showText(_("Collecting battery data…"));
            if (this._minmaxLabel)
                this._minmaxLabel.set_text("");
            return;
        }

        // min/max
        let mn = 100, mx = 0;
        for (let i = 0; i < rows.length; i++) {
            mn = Math.min(mn, rows[i].v);
            mx = Math.max(mx, rows[i].v);
        }
        if (this._minmaxLabel)
            this._minmaxLabel.set_text(
                _("min %d%% • max %d%% • last %s").format(
                    Math.round(mn), Math.round(mx),
                    spanH >= 24 && spanH % 24 === 0
                        ? _("%d d").format(spanH / 24)
                        : _("%d h").format(spanH)));

        // charging zones: drop unknown states (bogus transitions
        // after startup/wake) + list of continuous runs
        const plugged = s => (s === UPDeviceState.CHARGING ||
                              s === UPDeviceState.FULLY_CHARGED ||
                              s === UPDeviceState.PENDING_CHARGE);
        let clean = [];
        let lastKnown = null;
        for (let i = 0; i < rows.length; i++) {
            let s = rows[i].s;
            if (s === UPDeviceState.UNKNOWN) {
                if (lastKnown === null)
                    continue;
                s = lastKnown;
            } else {
                lastKnown = s;
            }
            clean.push({ t: rows[i].t, v: rows[i].v, p: plugged(s) });
        }
        let runs = [];
        let rs = -1;
        for (let i = 0; i < clean.length; i++) {
            if (clean[i].p && rs < 0) {
                rs = i;
            } else if (!clean[i].p && rs >= 0) {
                runs.push({ x0: x(clean[rs].t), x1: x(clean[i].t),
                            t0: clean[rs].t, t1: clean[i].t });
                rs = -1;
            }
        }
        if (rs >= 0) {
            runs.push({ x0: x(clean[rs].t),
                        x1: x(clean[clean.length - 1].t) + 1,
                        t0: clean[rs].t,
                        t1: clean[clean.length - 1].t });
        }

        // zone background: one rectangle per continuous run (no seams)
        if (this.graph_shade !== false) {
            cr.setSourceRGBA(...C.shade);
            for (let i = 0; i < runs.length; i++) {
                cr.rectangle(runs[i].x0, PAD_T,
                    Math.max(1.5, runs[i].x1 - runs[i].x0), gh);
                cr.fill();
            }
        }

        // fill under the curve
        cr.moveTo(x(rows[0].t), y(rows[0].v));
        for (let i = 1; i < rows.length; i++)
            cr.lineTo(x(rows[i].t), y(rows[i].v));
        cr.lineTo(x(rows[rows.length - 1].t), PAD_T + gh);
        cr.lineTo(x(rows[0].t), PAD_T + gh);
        cr.closePath();
        cr.setSourceRGBA(...C.fill);
        cr.fill();

        // curve
        cr.moveTo(x(rows[0].t), y(rows[0].v));
        for (let i = 1; i < rows.length; i++)
            cr.lineTo(x(rows[i].t), y(rows[i].v));
        cr.setSourceRGBA(...C.curve);
        cr.setLineWidth(2);
        cr.stroke();

        // dot at the end
        let last = rows[rows.length - 1];
        cr.arc(x(last.t), y(last.v), 3, 0, 2 * Math.PI);
        cr.setSourceRGBA(...C.dot);
        cr.fill();

        // charging-zone boundaries under the graph (no start/end hours —
        // the graph always shows the last X hours)
        cr.setFontSize(9);
        cr.setLineWidth(1);
        cr.setSourceRGBA(...C.text);
        let lastLblX = -100;
        let edge = (ex, et) => {
            if (ex < PAD_L + 4 || ex > w - PAD_R - 34)
                return;
            if (ex - lastLblX < 40)
                return;
            lastLblX = ex;
            cr.moveTo(ex, PAD_T + gh);
            cr.lineTo(ex, PAD_T + gh + 5);
            cr.stroke();
            cr.moveTo(ex + 3, h - 4);
            cr.showText(formatClock(et));
        };
        for (let i = 0; i < runs.length; i++) {
            edge(runs[i].x0, runs[i].t0);
            edge(runs[i].x1, runs[i].t1);
        }
    }
}

function main(metadata, orientation, panel_height, instanceId) {
    return new BatteryPlusApplet(metadata, orientation, panel_height, instanceId);
}
