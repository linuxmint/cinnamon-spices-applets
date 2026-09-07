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

const {
    DeviceKind: UPDeviceKind,
    DeviceState: UPDeviceState
} = UPowerGlib;

// UPower: 0 unknown, 1 charging, 2 discharging, 3 empty,
//         4 fully-charged, 5 pending-charge, 6 pending-discharge

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
        this.settings.bind("low_notify", "low_notify");
        this.settings.bind("low_level", "low_level");

        // Panel buduje bazowa klasa systemowa (ta sama co zegar i ikona
        // baterii): ikona w rozmiarze strefy + wielolinijkowy napis.
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
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // statystyki
        this._statRows = {};
        this._statsBox = new St.BoxLayout({ vertical: true, style_class: "battery-plus-pad" });
        let statDefs = [["state", _("State")], ["time", _("Time")],
                        ["rate", _("Power")], ["voltage", _("Voltage")],
                        ["health", _("Health")], ["cycles", _("Charge cycles")]];
        for (let i = 0; i < statDefs.length; i++) {
            let row = new St.BoxLayout({});
            let n = new St.Label({ style_class: "battery-plus-stat-name", text: statDefs[i][1] });
            n.set_width(110);
            let v = new St.Label({ style_class: "battery-plus-stat-value", text: "—" });
            row.add_actor(n);
            row.add_actor(v);
            this._statsBox.add_actor(row);
            this._statRows[statDefs[i][0]] = v;
        }
        let statsSection = new PopupMenu.PopupMenuSection();
        statsSection.addActor(this._statsBox);
        this.menu.addMenuItem(statsSection);

        // power profiles (if the daemon is available)
        this._profileSection = new PopupMenu.PopupMenuSection();
        this._profileSection.addActor(new St.Label({
            style_class: "battery-plus-section-label battery-plus-pad",
            text: _("Power mode")
        }));
        this._profileItems = [];
        this.menu.addMenuItem(this._profileSection);
        this._profileSep = new PopupMenu.PopupSeparatorMenuItem();
        this.menu.addMenuItem(this._profileSep);
        this._initPowerProfiles();

        // wykres
        let graphLabelSection = new PopupMenu.PopupMenuSection();
        graphLabelSection.addActor(new St.Label({
            style_class: "battery-plus-section-label battery-plus-pad",
            text: _("Charge history")
        }));
        this.menu.addMenuItem(graphLabelSection);
        this._graph = new St.DrawingArea({ style_class: "battery-plus-graph" });
        this._graph.set_width(300);
        this._graph.set_height(130);
        this._graph.connect("repaint", () => this._drawGraph());
        let graphFrame = new St.BoxLayout({ style_class: "battery-plus-graph-box" });
        graphFrame.add_actor(this._graph);
        let graphSection = new PopupMenu.PopupMenuSection();
        graphSection.addActor(graphFrame);
        this.menu.addMenuItem(graphSection);

        this._minmaxLabel = new St.Label({ style_class: "battery-plus-graph-note", text: "" });
        let noteBox = new St.BoxLayout({ vertical: true, style_class: "battery-plus-pad" });
        noteBox.add_actor(this._minmaxLabel);
        let noteSection = new PopupMenu.PopupMenuSection();
        noteSection.addActor(noteBox);
        this.menu.addMenuItem(noteSection);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.menu.addSettingsAction(_("Power settings"), "power");

        this.menu.connect("open-state-changed",
            (menu, open) => {
                if (open) {
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

        this._historyDir = GLib.get_user_data_dir() + "/battery-plus";
        this._historyFile = this._historyDir + "/history.csv";
        try {
            Gio.File.new_for_path(this._historyDir)
                .make_directory_with_parents(null);
        } catch (e) { /* already exists */ }

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
                let rateTxt = null, voltTxt = null, cap = null, cyc = null;
                for (let line of out.split("\n")) {
                    let m;
                    m = line.match(/energy-rate:\s*([\d.,]+\s*\w+)/);
                    if (m) rateTxt = m[1].trim();
                    m = line.match(/^\s*voltage:\s*([\d.,]+\s*\w+)/);
                    if (m) voltTxt = m[1].trim();
                    m = line.match(/capacity:\s*([\d.,]+)/);
                    if (m) cap = parseFloat(m[1].replace(",", "."));
                    m = line.match(/charge-cycles:\s*(\d+)/);
                    if (m) cyc = parseInt(m[1], 10);
                }
                this._stats = { rate: rateTxt, voltage: voltTxt, capacity: cap, cycles: cyc };
                if (this._statRows.rate)
                    this._statRows.rate.set_text(
                        (rateTxt !== null) ? rateTxt : "—");
                if (this._statRows.voltage)
                    this._statRows.voltage.set_text(
                        (voltTxt !== null) ? voltTxt : "—");
                if (this._statRows.health)
                    this._statRows.health.set_text(
                        (cap !== null && !isNaN(cap))
                            ? _("%d%%").format(Math.round(cap)) : "—");
                if (this._statRows.cycles)
                    this._statRows.cycles.set_text(
                        (cyc !== null && !isNaN(cyc)) ? String(cyc) : "—");
            } catch (e) { /* ignore */ }
        });
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
        }
    }

    _logSample() {
        if (!this._devices.length)
            return;
        this._ensureHistory(() => {
            let now = Math.floor(Date.now() / 1000);
            let cutoff = now - 8 * 24 * 3600;
            this._history = this._history.filter(r => r.t >= cutoff);
            this._history.push({ t: now, v: this._pct, s: this._state });
            try {
                let text = this._history.map(r =>
                    r.t + "," + r.v + "," + r.s).join("\n") + "\n";
                GLib.file_set_contents(this._historyFile, text);
            } catch (e) {
                global.logError("[" + UUID + "] history write", String(e));
            }
            this._redrawGraph();
        });
    }

    _redrawGraph() {
        if (this._graph)
            this._graph.queue_repaint();
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

        // siatka + etykiety %
        cr.setSourceRGBA(1, 1, 1, 0.16);
        cr.setLineWidth(1);
        for (let g of [0, 25, 50, 75, 100]) {
            cr.moveTo(PAD_L, y(g));
            cr.lineTo(w - PAD_R, y(g));
            cr.stroke();
            cr.setSourceRGBA(1, 1, 1, 0.55);
            cr.moveTo(2, y(g) + 3);
            cr.showText(String(g));
            cr.setSourceRGBA(1, 1, 1, 0.16);
        }

        if (rows.length < 2) {
            cr.setSourceRGBA(1, 1, 1, 0.6);
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
            cr.setSourceRGBA(0.35, 0.85, 0.4, 0.10);
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
        cr.setSourceRGBA(0.55, 0.8, 1.0, 0.10);
        cr.fill();

        // krzywa
        cr.moveTo(x(rows[0].t), y(rows[0].v));
        for (let i = 1; i < rows.length; i++)
            cr.lineTo(x(rows[i].t), y(rows[i].v));
        cr.setSourceRGBA(1, 1, 1, 0.9);
        cr.setLineWidth(2);
        cr.stroke();

        // dot at the end
        let last = rows[rows.length - 1];
        cr.arc(x(last.t), y(last.v), 3, 0, 2 * Math.PI);
        cr.setSourceRGBA(0.55, 0.82, 0.35, 1);
        cr.fill();

        // charging-zone boundaries under the graph (no start/end hours —
        // the graph always shows the last X hours)
        cr.setFontSize(9);
        cr.setLineWidth(1);
        cr.setSourceRGBA(1, 1, 1, 0.55);
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
