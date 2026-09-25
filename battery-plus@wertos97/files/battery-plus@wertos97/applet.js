const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Cairo = imports.cairo;
const Mainloop = imports.mainloop;
const Interfaces = imports.misc.interfaces;
const UPowerGlib = imports.gi.UPowerGlib;

const UUID = "battery-plus@wertos97";
const MAX_SESSION_GAP = 5 * 60;
const HISTORY_FLUSH_INTERVAL = 5 * 60;
const GRAPH_PAD_L = 30;
const GRAPH_PAD_R = 8;

const UPOWER_DEVICE_IFACE = `<node>
    <interface name="org.freedesktop.UPower.Device">
        <property name="EnergyRate" type="d" access="read"/>
        <property name="Voltage" type="d" access="read"/>
        <property name="Capacity" type="d" access="read"/>
        <property name="ChargeCycles" type="i" access="read"/>
        <method name="GetHistory">
            <arg name="type" type="s" direction="in"/>
            <arg name="timespan" type="u" direction="in"/>
            <arg name="resolution" type="u" direction="in"/>
            <arg name="data" type="a(udu)" direction="out"/>
        </method>
    </interface>
</node>`;
const UPowerDeviceProxy = Gio.DBusProxy.makeProxyWrapper(UPOWER_DEVICE_IFACE);

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
        this._destroyed = false;
        this._cancellable = new Gio.Cancellable();
        this._historyLoadCancellable = new Gio.Cancellable();
        this._historyWriteCancellable = new Gio.Cancellable();
        this._csdWatchId = 0;
        this._csdProxySignalId = 0;
        this._devicesRequestInFlight = false;
        this._devicesRefreshPending = false;
        this._sampleAfterDevicesRefresh = false;
        this._batteryProxy = null;
        this._batteryProxyPath = null;
        this._batteryProxyLoading = false;
        this._batteryProxySignalId = 0;
        this._batteryProxyGeneration = 0;
        this._ppd = null;
        this._ppdSignalId = 0;
        this._graphViewEnd = null;
        this._graphViewTargetEnd = null;
        this._graphPanTimer = 0;

        this.settings = new Settings.AppletSettings(this, UUID, instanceId);
        this.settings.bind("history_hours", "history_hours",
            () => this._resetGraphView());
        this.settings.bind("zoom_minutes", "zoom_minutes",
            () => this._resetGraphView());
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
        this._graph = new St.DrawingArea({
            style_class: "battery-plus-graph",
            reactive: true
        });
        this._graph.set_width(300);
        this._graph.set_height(130);
        this._graph.connect("repaint", () => this._drawGraph());
        this._graph.connect("button-press-event",
            (actor, event) => this._onGraphButtonPress(actor, event));
        this._graph.connect("scroll-event",
            (actor, event) => this._onGraphScroll(actor, event));
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
                } else {
                    this._stopGraphPan();
                    this._graphViewEnd = null;
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
        this._activeProfile = null;
        this._history = null;
        this._historyLoading = false;
        this._historyWaiters = [];
        this._activity = null;
        this._historyRestoreGeneration = -1;

        this._historyDir = GLib.get_user_data_dir() + "/battery-plus";
        this._historyFile = this._historyDir + "/history.csv";
        this._historyFileObject = Gio.File.new_for_path(this._historyFile);
        this._historyWriteInFlight = false;
        this._historyDirty = false;
        this._historyFlushTimer = 0;
        this._nextHistoryPrune = 0;
        try {
            Gio.File.new_for_path(this._historyDir)
                .make_directory_with_parents(null);
        } catch (e) { /* already exists */ }

        this._applyTheme();

        // --- csd-power proxy (same one as the system applet) ---
        this._proxy = null;
        this._csdWatchId = Gio.bus_watch_name(Gio.BusType.SESSION,
            "org.cinnamon.SettingsDaemon.Power", 0,
            () => {
                Interfaces.getDBusProxyAsync("org.cinnamon.SettingsDaemon.Power",
                    (proxy, error) => {
                        if (this._destroyed)
                            return;
                        if (this._csdWatchId) {
                            Gio.bus_unwatch_name(this._csdWatchId);
                            this._csdWatchId = 0;
                        }
                        if (error) {
                            global.logError("[" + UUID + "] no csd-power", error.message);
                            return;
                        }
                        this._proxy = proxy;
                        this._csdProxySignalId = this._proxy.connect("g-properties-changed",
                            () => this._devicesChanged());
                        this._devicesChanged();
                    });
            }, null);

        // One minute timer refreshes estimates and records history. D-Bus
        // property signals still deliver state changes immediately.
        this._refreshTimer = Mainloop.timeout_add_seconds(60,
            () => {
                this._sampleAfterDevicesRefresh = true;
                this._devicesChanged();
                return true;
            });
    }

    on_applet_clicked(event) {
        this.menu.toggle();
    }

    on_applet_removed_from_panel() {
        if (this._destroyed)
            return;
        this._destroyed = true;
        if (this._refreshTimer) {
            Mainloop.source_remove(this._refreshTimer);
            this._refreshTimer = 0;
        }
        if (this._historyFlushTimer) {
            Mainloop.source_remove(this._historyFlushTimer);
            this._historyFlushTimer = 0;
        }
        this._stopGraphPan();
        if (this._csdWatchId) {
            Gio.bus_unwatch_name(this._csdWatchId);
            this._csdWatchId = 0;
        }
        if (this._proxy && this._csdProxySignalId) {
            this._proxy.disconnect(this._csdProxySignalId);
            this._csdProxySignalId = 0;
        }
        if (this._batteryProxy && this._batteryProxySignalId) {
            this._batteryProxy.disconnect(this._batteryProxySignalId);
            this._batteryProxySignalId = 0;
        }
        if (this._ppd && this._ppdSignalId) {
            this._ppd.disconnect(this._ppdSignalId);
            this._ppdSignalId = 0;
        }
        this._historyWaiters = [];
        this._cancellable.cancel();
        this._historyLoadCancellable.cancel();
        this._historyWriteCancellable.cancel();
        this._historyDirty = false;
        this.settings.finalize();
    }

    // --- device polling ---
    _devicesChanged() {
        if (this._destroyed || !this._proxy)
            return;
        if (this._devicesRequestInFlight) {
            this._devicesRefreshPending = true;
            return;
        }
        this._devicesRequestInFlight = true;
        this._proxy.GetDevicesRemote((result, error) => {
            this._devicesRequestInFlight = false;
            if (this._destroyed)
                return;
            if (!error) {
                this._devices = result[0];
                this._refresh();
            }
            if (this._devicesRefreshPending) {
                this._devicesRefreshPending = false;
                this._devicesChanged();
            } else if (!error && this._sampleAfterDevicesRefresh) {
                this._sampleAfterDevicesRefresh = false;
                this._logSample();
            }
        }, this._cancellable);
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
        if (!dev) {
            this._batteryId = null;
            this._pct = 0;
            this._state = UPDeviceState.UNKNOWN;
            this._seconds = 0;
            this._activity = null;
            this._clearBatteryProxy();
            this._stats = { rate: null, voltage: null, capacity: null, cycles: null };
            this.set_applet_label("—");
            this.set_applet_tooltip(stateToString(this._state));
            this._updateHeader();
            this._renderStats();
            return;
        }
        let [device_id, vendor, model, kind, icon, percentage, state, level, seconds] = dev;
        this._batteryId = device_id;
        this._ensureBatteryProxy();
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
            if (active !== null && this._activity && this._activity.state === active)
                this._recalculateActivityStart(now);
            this._recordSample(now, state, true);
            if (this.menu.isOpen)
                this._updateHeader();
        });
    }

    _recalculateActivityStart(now = Math.floor(Date.now() / 1000)) {
        if (!this._activity || this._history === null)
            return;
        let active = this._activity.state;
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
        if (d < 60)
            return _("less than a minute");
        let dd = Math.floor(d / 86400),
            hh = Math.floor(d % 86400 / 3600),
            mm = Math.floor(d % 3600 / 60);
        if (dd > 0)
            return _("%d d %d h %d min").format(dd, hh, mm);
        if (hh > 0)
            return _("%d h %d min").format(hh, mm);
        return _("%d min").format(mm);
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

    _ensureBatteryProxy() {
        if (!this._batteryId ||
            (this._batteryProxyPath === this._batteryId &&
             (this._batteryProxy || this._batteryProxyLoading)))
            return;

        this._clearBatteryProxy();
        this._batteryProxyPath = this._batteryId;
        this._batteryProxyLoading = true;
        let path = this._batteryId;
        let generation = this._batteryProxyGeneration;

        try {
            new UPowerDeviceProxy(Gio.DBus.system, "org.freedesktop.UPower", path,
                (proxy, error) => {
                    if (this._destroyed || generation !== this._batteryProxyGeneration ||
                        path !== this._batteryProxyPath)
                        return;
                    this._batteryProxyLoading = false;
                    if (error) {
                        global.logError("[" + UUID + "] no UPower device", error.message);
                        return;
                    }
                    this._batteryProxy = proxy;
                    this._batteryProxySignalId = proxy.connect("g-properties-changed",
                        () => this._refreshStats());
                    this._refreshStats();
                    this._restoreUPowerHistory();
                }, this._cancellable);
        } catch (e) {
            this._batteryProxyLoading = false;
            global.logError("[" + UUID + "] UPower device proxy", String(e));
        }
    }

    _clearBatteryProxy() {
        this._batteryProxyGeneration++;
        if (this._batteryProxy && this._batteryProxySignalId)
            this._batteryProxy.disconnect(this._batteryProxySignalId);
        this._batteryProxy = null;
        this._batteryProxyPath = null;
        this._batteryProxyLoading = false;
        this._batteryProxySignalId = 0;
    }

    // UPower properties are cached by Gio and updated through D-Bus signals.
    _refreshStats() {
        if (!this._batteryProxy) {
            this._ensureBatteryProxy();
            return;
        }
        let number = value => {
            if (value === null || value === undefined)
                return null;
            let parsed = Number(value);
            return Number.isFinite(parsed) ? parsed : null;
        };
        let cycles = number(this._batteryProxy.ChargeCycles);
        this._stats = {
            rate: number(this._batteryProxy.EnergyRate),
            voltage: number(this._batteryProxy.Voltage),
            capacity: number(this._batteryProxy.Capacity),
            cycles: cycles !== null && cycles >= 0 ? cycles : null
        };
        this._renderStats();
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
        let iface = "<node><interface name='net.hadess.PowerProfiles'>" +
            "<property name='ActiveProfile' type='s' access='readwrite'/>" +
            "<property name='Profiles' type='aa{sv}' access='read'/>" +
            "</interface></node>";
        let Proxy = Gio.DBusProxy.makeProxyWrapper(iface);
        try {
            new Proxy(Gio.DBus.system, "net.hadess.PowerProfiles",
                "/net/hadess/PowerProfiles", (proxy, error) => {
                    if (this._destroyed)
                        return;
                    if (error || !proxy.Profiles || !proxy.Profiles.length) {
                        this._ppd = null;
                        this._profileSection.hide();
                        this._profileSep.hide();
                        return;
                    }
                    this._ppd = proxy;
                    this._ppdSignalId = proxy.connect("g-properties-changed", () => {
                        try { this._activeProfile = this._ppd.ActiveProfile; } catch (e) {}
                        this._updateProfileDots();
                    });
                    this._buildProfiles();
                }, this._cancellable);
        } catch (e) {
            if (!this._destroyed) {
                this._profileSection.hide();
                this._profileSep.hide();
            }
        }
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
            item.connect("activate", () => this._setPowerProfile(key));
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
        for (let i = 0; i < this._profileItems.length; i++) {
            if (this._profileItems[i].label.get_text() === this._profileName(active))
                this._profileItems[i].setShowDot(true);
        }
    }

    _setPowerProfile(key) {
        if (!this._ppd)
            return;
        let proxy = this._ppd;
        let parameters = new GLib.Variant("(ssv)", [
            "net.hadess.PowerProfiles", "ActiveProfile",
            new GLib.Variant("s", key)
        ]);
        proxy.call("org.freedesktop.DBus.Properties.Set", parameters,
            Gio.DBusCallFlags.NONE, -1, this._cancellable, (source, result) => {
                if (this._destroyed || proxy !== this._ppd)
                    return;
                try {
                    source.call_finish(result);
                    this._activeProfile = key;
                } catch (e) {
                    try { this._activeProfile = source.ActiveProfile; } catch (ignored) {}
                    global.logError("[" + UUID + "] set power profile", String(e));
                }
                this._updateProfileDots();
            });
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
            this._historyFileObject.load_contents_async(
                this._historyLoadCancellable, (o, res) => {
                    if (this._destroyed)
                        return;
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
                    this._restoreUPowerHistory();
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

    _restoreUPowerHistory() {
        if (!this._batteryProxy || this._history === null || this._history.length >= 10)
            return;
        let proxy = this._batteryProxy;
        let generation = this._batteryProxyGeneration;
        if (this._historyRestoreGeneration === generation)
            return;
        this._historyRestoreGeneration = generation;
        proxy.GetHistoryRemote("charge", 8 * 24 * 3600, 60,
            (result, error) => {
                if (this._destroyed || proxy !== this._batteryProxy ||
                    generation !== this._batteryProxyGeneration ||
                    error || !result || !result[0])
                    return;
                let restored = [];
                for (let point of result[0]) {
                    let values = point.deepUnpack ? point.deepUnpack() : point;
                    let t = Number(values[0]), v = Number(values[1]), s = Number(values[2]);
                    if (Number.isFinite(t) && Number.isFinite(v) && Number.isFinite(s))
                        restored.push({ t: t, v: v, s: s });
                }
                if (!restored.length)
                    return;

                let byTime = {};
                for (let row of restored.concat(this._history || []))
                    byTime[row.t] = row;
                this._history = Object.keys(byTime).map(t => byTime[t])
                    .sort((a, b) => a.t - b.t);
                this._recalculateActivityStart();
                this._queueHistoryWrite(true);
                if (this.menu.isOpen)
                    this._updateHeader();
                this._redrawGraph();
            }, this._cancellable);
    }

    _logSample() {
        if (!this._batteryId)
            return;
        this._ensureHistory(() => {
            let now = Math.floor(Date.now() / 1000);
            this._recordSample(now, this._state);
            this._redrawGraph();
        });
    }

    _recordSample(timestamp, state, immediate = false) {
        this._history = this._history || [];
        if (timestamp >= this._nextHistoryPrune) {
            let cutoff = timestamp - 8 * 24 * 3600;
            let firstKept = this._history.findIndex(r => r.t >= cutoff);
            if (firstKept < 0)
                this._history.length = 0;
            else if (firstKept > 0)
                this._history.splice(0, firstKept);
            this._nextHistoryPrune = timestamp + 3600;
        }
        let last = this._history.length ? this._history[this._history.length - 1] : null;
        let sample = { t: timestamp, v: this._pct, s: state };
        if (last && last.t === timestamp)
            this._history[this._history.length - 1] = sample;
        else
            this._history.push(sample);
        this._queueHistoryWrite(immediate);
    }

    _queueHistoryWrite(immediate = false) {
        this._historyDirty = true;
        if (this._historyWriteInFlight)
            return;
        if (immediate) {
            if (this._historyFlushTimer) {
                Mainloop.source_remove(this._historyFlushTimer);
                this._historyFlushTimer = 0;
            }
            this._flushHistoryWrite();
        } else if (!this._historyFlushTimer) {
            this._historyFlushTimer = Mainloop.timeout_add_seconds(
                HISTORY_FLUSH_INTERVAL, () => {
                    this._historyFlushTimer = 0;
                    this._flushHistoryWrite();
                    return false;
                });
        }
    }

    _flushHistoryWrite() {
        if (this._historyWriteInFlight || !this._historyDirty)
            return;
        let pending = this._history.map(r =>
            r.t + "," + r.v + "," + r.s).join("\n") + "\n";
        this._historyDirty = false;
        this._historyWriteInFlight = true;
        try {
            this._historyFileObject.replace_contents_async(
                imports.byteArray.fromString(pending), null, false,
                Gio.FileCreateFlags.REPLACE_DESTINATION, this._historyWriteCancellable,
                (file, result) => {
                    let succeeded = true;
                    try {
                        file.replace_contents_finish(result);
                    } catch (e) {
                        succeeded = false;
                        if (!this._destroyed) {
                            this._historyDirty = true;
                            global.logError("[" + UUID + "] history write", String(e));
                        }
                    }
                    this._historyWriteInFlight = false;
                    if (this._historyDirty && succeeded && !this._destroyed)
                        this._flushHistoryWrite();
                    else if (this._historyDirty && !this._destroyed)
                        this._queueHistoryWrite(false);
                });
        } catch (e) {
            this._historyWriteInFlight = false;
            if (!this._destroyed) {
                this._historyDirty = true;
                global.logError("[" + UUID + "] history write", String(e));
                this._queueHistoryWrite(false);
            }
        }
    }

    _redrawGraph() {
        if (this._graph && this.menu && this.menu.isOpen)
            this._graph.queue_repaint();
    }

    _stopGraphPan() {
        if (this._graphPanTimer) {
            Mainloop.source_remove(this._graphPanTimer);
            this._graphPanTimer = 0;
        }
        this._graphViewTargetEnd = null;
    }

    _resetGraphView() {
        this._stopGraphPan();
        this._graphViewEnd = null;
        this._redrawGraph();
    }

    _graphStart(now, historySpan) {
        let start = now - historySpan;
        if (this._history && this._history.length && this._history[0].t > start)
            start = Math.min(now, this._history[0].t);
        return start;
    }

    _onGraphButtonPress(actor, event) {
        if (event.get_button() !== Clutter.BUTTON_PRIMARY)
            return Clutter.EVENT_PROPAGATE;

        if (this._graphViewEnd !== null) {
            this._resetGraphView();
            return Clutter.EVENT_STOP;
        }

        let historySpan = Math.max(1, parseInt(this.history_hours, 10) || 24) * 3600;
        let zoomSpan = Math.max(1, parseInt(this.zoom_minutes, 10) || 60) * 60;
        let now = Math.floor(Date.now() / 1000);
        let historyStart = this._graphStart(now, historySpan);
        let fullSpan = now - historyStart;
        if (zoomSpan >= fullSpan)
            return Clutter.EVENT_STOP;

        let [stageX, stageY] = event.get_coords();
        let [success, localX] = actor.transform_stage_point(stageX, stageY);
        if (!success)
            return Clutter.EVENT_STOP;

        let width = actor.width;
        let graphWidth = Math.max(1, width - GRAPH_PAD_L - GRAPH_PAD_R);
        let fraction = Math.max(0, Math.min(1,
            (localX - GRAPH_PAD_L) / graphWidth));
        let selectedTime = historyStart + fraction * fullSpan;
        this._graphViewEnd = Math.max(historyStart + zoomSpan,
            Math.min(now, selectedTime + zoomSpan / 2));
        this._graphViewTargetEnd = null;
        this._redrawGraph();
        return Clutter.EVENT_STOP;
    }

    _onGraphScroll(actor, event) {
        if (this._graphViewEnd === null)
            return Clutter.EVENT_PROPAGATE;

        let direction = event.get_scroll_direction();
        let amount = 0;
        let smooth = direction === Clutter.ScrollDirection.SMOOTH;
        if (direction === Clutter.ScrollDirection.LEFT ||
            direction === Clutter.ScrollDirection.UP) {
            amount = -1;
        } else if (direction === Clutter.ScrollDirection.RIGHT ||
                   direction === Clutter.ScrollDirection.DOWN) {
            amount = 1;
        } else if (direction === Clutter.ScrollDirection.SMOOTH) {
            let [dx] = event.get_scroll_delta();
            amount = dx;
        }
        if (amount === 0)
            return Clutter.EVENT_STOP;
        amount = smooth
            ? Math.max(-0.5, Math.min(0.5, amount))
            : Math.max(-1, Math.min(1, amount));

        let historySpan = Math.max(1, parseInt(this.history_hours, 10) || 24) * 3600;
        let zoomSpan = Math.min(historySpan,
            Math.max(1, parseInt(this.zoom_minutes, 10) || 60) * 60);
        let now = Math.floor(Date.now() / 1000);
        let historyStart = this._graphStart(now, historySpan);
        zoomSpan = Math.min(zoomSpan, now - historyStart);
        if (smooth) {
            this._stopGraphPan();
            let smoothStep = Math.max(60, zoomSpan * 0.1) * amount;
            this._graphViewEnd = Math.max(historyStart + zoomSpan,
                Math.min(now, this._graphViewEnd + smoothStep));
            this._redrawGraph();
            return Clutter.EVENT_STOP;
        }

        let step = Math.max(60, zoomSpan * 0.25) * amount;
        let currentTarget = this._graphViewTargetEnd === null
            ? this._graphViewEnd : this._graphViewTargetEnd;
        this._graphViewTargetEnd = Math.max(historyStart + zoomSpan,
            Math.min(now, currentTarget + step));
        if (!this._graphPanTimer) {
            this._graphPanTimer = Mainloop.timeout_add(16, () => {
                if (this._destroyed || this._graphViewEnd === null ||
                    this._graphViewTargetEnd === null) {
                    this._graphPanTimer = 0;
                    return false;
                }
                let distance = this._graphViewTargetEnd - this._graphViewEnd;
                if (Math.abs(distance) <= 1) {
                    this._graphViewEnd = this._graphViewTargetEnd;
                    this._graphViewTargetEnd = null;
                    this._graphPanTimer = 0;
                    this._redrawGraph();
                    return false;
                }
                this._graphViewEnd += distance * 0.3;
                this._redrawGraph();
                return true;
            });
        }
        return Clutter.EVENT_STOP;
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

        const PAD_L = GRAPH_PAD_L, PAD_R = GRAPH_PAD_R, PAD_T = 8, PAD_B = 16;
        const gw = w - PAD_L - PAD_R, gh = h - PAD_T - PAD_B;

        cr.selectFontFace("Sans", Cairo.FontSlant.NORMAL, Cairo.FontWeight.NORMAL);
        cr.setFontSize(9);

        let spanH = 24;
        try { spanH = parseInt(this.history_hours, 10) || 24; } catch (e) {}
        let now = Math.floor(Date.now() / 1000);
        let configuredSpan = spanH * 3600;
        let historyStart = this._graphStart(now, configuredSpan);
        let fullSpan = Math.max(1, now - historyStart);
        let viewSpan = fullSpan;
        let viewEnd = now;
        if (this._graphViewEnd !== null) {
            viewSpan = Math.min(fullSpan,
                Math.max(1, parseInt(this.zoom_minutes, 10) || 60) * 60);
            this._graphViewEnd = Math.max(historyStart + viewSpan,
                Math.min(now, this._graphViewEnd));
            viewEnd = this._graphViewEnd;
        }
        if (this._history === null) {
            this._ensureHistory(() => this._redrawGraph());
        }
        let cutoff = viewEnd - viewSpan;
        let allRows = (this._history || []).filter(r => r.t <= now);
        if (allRows.length && this._batteryId) {
            let current = { t: now, v: this._pct, s: this._state };
            if (allRows[allRows.length - 1].t < now)
                allRows.push(current);
            else
                allRows[allRows.length - 1] = current;
        }

        let lowerBound = value => {
            let low = 0, high = allRows.length;
            while (low < high) {
                let middle = Math.floor((low + high) / 2);
                if (allRows[middle].t < value)
                    low = middle + 1;
                else
                    high = middle;
            }
            return low;
        };
        let firstVisible = lowerBound(cutoff);
        let afterVisible = lowerBound(viewEnd);
        while (afterVisible < allRows.length && allRows[afterVisible].t <= viewEnd)
            afterVisible++;
        let rows = allRows.slice(firstVisible, afterVisible);
        let interpolate = (left, right, time) => {
            let fraction = (time - left.t) / (right.t - left.t);
            return {
                t: time,
                v: left.v + (right.v - left.v) * fraction,
                s: left.s
            };
        };
        if (firstVisible > 0 && firstVisible < allRows.length &&
            allRows[firstVisible].t > cutoff) {
            rows.unshift(interpolate(allRows[firstVisible - 1],
                allRows[firstVisible], cutoff));
        }
        if (afterVisible > 0 && afterVisible < allRows.length &&
            allRows[afterVisible - 1].t < viewEnd) {
            rows.push(interpolate(allRows[afterVisible - 1],
                allRows[afterVisible], viewEnd));
        }
        let stateRows = allRows.slice(Math.max(0, firstVisible - 1), afterVisible);

        let x = t => PAD_L + gw * (1 - (viewEnd - t) / viewSpan);
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

        if (rows.length < 1) {
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
        if (this._minmaxLabel) {
            if (this._graphViewEnd !== null) {
                this._minmaxLabel.set_text(
                    _("min %d%% • max %d%% • %s–%s").format(
                        Math.round(mn), Math.round(mx),
                        formatClock(cutoff), formatClock(viewEnd)));
            } else {
                let visibleHours = Math.round(viewSpan / 3600);
                this._minmaxLabel.set_text(
                    _("min %d%% • max %d%% • last %s").format(
                        Math.round(mn), Math.round(mx),
                        visibleHours >= 24 && visibleHours % 24 === 0
                            ? _("%d d").format(visibleHours / 24)
                            : visibleHours >= 1
                                ? _("%d h").format(visibleHours)
                                : _("%d min").format(Math.max(1,
                                    Math.round(viewSpan / 60)))));
            }
        }

        // charging zones: drop unknown states (bogus transitions
        // after startup/wake) + list of continuous runs
        const plugged = s => (s === UPDeviceState.CHARGING ||
                              s === UPDeviceState.FULLY_CHARGED ||
                              s === UPDeviceState.PENDING_CHARGE);
        let clean = [];
        let lastKnown = null;
        for (let i = 0; i < stateRows.length; i++) {
            let s = stateRows[i].s;
            if (s === UPDeviceState.UNKNOWN) {
                if (lastKnown === null)
                    continue;
                s = lastKnown;
            } else {
                lastKnown = s;
            }
            clean.push({ t: stateRows[i].t, v: stateRows[i].v, p: plugged(s) });
        }
        let runs = [], events = [];
        if (clean.length && clean[0].p && clean[0].t >= cutoff)
            events.push({ t: clean[0].t });
        let rs = -1;
        for (let i = 0; i < clean.length; i++) {
            if (i > 0 && clean[i].p !== clean[i - 1].p)
                events.push({ t: clean[i].t });
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
                        x1: x(viewEnd),
                        t0: clean[rs].t,
                        t1: viewEnd });
        }

        // zone background: one rectangle per continuous run (no seams)
        if (this.graph_shade !== false) {
            cr.setSourceRGBA(...C.shade);
            for (let i = 0; i < runs.length; i++) {
                let x0 = Math.max(PAD_L, runs[i].x0);
                let x1 = Math.min(w - PAD_R, runs[i].x1);
                cr.rectangle(x0, PAD_T, Math.max(1.5, x1 - x0), gh);
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
        cr.setSourceRGBA(...C.curve);
        if (rows.length === 1) {
            cr.arc(x(rows[0].t), y(rows[0].v), 2, 0, 2 * Math.PI);
            cr.fill();
        } else {
            cr.moveTo(x(rows[0].t), y(rows[0].v));
            for (let i = 1; i < rows.length; i++)
                cr.lineTo(x(rows[i].t), y(rows[i].v));
            cr.setLineWidth(2);
            cr.stroke();
        }

        // The dot represents the latest sample, not the end of a historical view.
        let last = rows[rows.length - 1];
        let latest = allRows.length ? allRows[allRows.length - 1] : null;
        if (latest && last.t === latest.t) {
            cr.arc(x(last.t), y(last.v), 3, 0, 2 * Math.PI);
            cr.setSourceRGBA(...C.dot);
            cr.fill();
        }

        // Keep every transition time on one line. Labels are shifted sideways
        // when necessary instead of being hidden or moved to another row.
        cr.setLineWidth(1);
        cr.setSourceRGBA(...C.text);
        let labels = [];
        for (let event of events) {
            let ex = x(event.t);
            if (ex < PAD_L || ex > w - PAD_R)
                continue;
            cr.moveTo(ex, PAD_T + gh);
            cr.lineTo(ex, PAD_T + gh + 4);
            cr.stroke();
            labels.push({ x: ex, text: formatClock(event.t) });
        }

        const labelGap = 2;
        let fontSize = 8;
        while (fontSize > 6) {
            cr.setFontSize(fontSize);
            let totalWidth = labels.reduce((sum, label) =>
                sum + cr.textExtents(label.text).width, 0) +
                Math.max(0, labels.length - 1) * labelGap;
            if (totalWidth <= gw)
                break;
            fontSize--;
        }
        cr.setFontSize(fontSize);
        for (let label of labels) {
            label.width = cr.textExtents(label.text).width;
            label.tx = Math.max(PAD_L,
                Math.min(label.x - label.width / 2, w - PAD_R - label.width));
        }
        for (let i = 1; i < labels.length; i++)
            labels[i].tx = Math.max(labels[i].tx,
                labels[i - 1].tx + labels[i - 1].width + labelGap);
        for (let i = labels.length - 1; i >= 0; i--) {
            let maxX = i === labels.length - 1
                ? w - PAD_R - labels[i].width
                : labels[i + 1].tx - labelGap - labels[i].width;
            labels[i].tx = Math.min(labels[i].tx, maxX);
        }
        for (let label of labels) {
            cr.moveTo(label.tx, h - 4);
            cr.showText(label.text);
        }
    }
}

function main(metadata, orientation, panel_height, instanceId) {
    return new BatteryPlusApplet(metadata, orientation, panel_height, instanceId);
}
