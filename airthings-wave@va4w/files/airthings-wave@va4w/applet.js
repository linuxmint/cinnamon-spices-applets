const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;
const Main = imports.ui.main;
const St = imports.gi.St;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Clutter = imports.gi.Clutter;
const Cairo = imports.cairo;

const GOOD = "#3fb950";
const FAIR = "#e3b341";
const POOR = "#f85149";
const LINE = [0.35, 0.66, 0.90];
const OUTDOOR = [0.86, 0.56, 0.95];

// Ranges follow the levels used by the Airthings app.
const METRICS = {
    radon_st: { tile: "Radon · 24 h", noun: "radon", label: "Radon (24 h avg)", short: "Rn", unit: "Bq/m³", digits: 0, zero: true,
                good: [-Infinity, 100], fair: [-Infinity, 150] },
    radon_lt: { tile: "Radon · long term", noun: "long-term radon", label: "Radon (long-term)", short: "Rn", unit: "Bq/m³", digits: 0, zero: true,
                good: [-Infinity, 100], fair: [-Infinity, 150] },
    co2: { tile: "CO₂", noun: "CO₂", label: "CO₂", short: "CO₂", unit: "ppm", digits: 0,
           good: [-Infinity, 800], fair: [-Infinity, 1000] },
    voc: { tile: "VOC", noun: "VOC", label: "VOC", short: "VOC", unit: "ppb", digits: 0, zero: true,
           good: [-Infinity, 250], fair: [-Infinity, 2000] },
    temperature: { tile: "Temperature", noun: "temperature", label: "Temperature", short: "", unit: "°C", digits: 1,
                   good: [18, 25], fair: [15, 28] },
    humidity: { tile: "Humidity", noun: "humidity", label: "Humidity", short: "", unit: "%", digits: 0,
                good: [30, 60], fair: [25, 70] },
    pressure: { tile: "Pressure", noun: "pressure", label: "Pressure", short: "", unit: "hPa", digits: 0 },
};
const METRIC_ORDER = ["radon_st", "radon_lt", "co2", "voc", "temperature", "humidity", "pressure"];

const REPORTS = [
    ["This month", d => d.format("%Y-%m")],
    ["Last month", d => d.add_months(-1).format("%Y-%m")],
    ["This year", d => d.format("%Y")],
    ["Last year", d => d.add_years(-1).format("%Y")],
];

const RANGES = [["6 h", 6], ["24 h", 24], ["7 d", 168], ["30 d", 720], ["1 y", 8760]];

function level(metric, value) {
    let def = METRICS[metric];
    if (value === null || value === undefined || !def.good)
        return null;
    if (value >= def.good[0] && value <= def.good[1])
        return GOOD;
    if (value >= def.fair[0] && value <= def.fair[1])
        return FAIR;
    return POOR;
}

function hexToRgb(hex) {
    return [1, 3, 5].map(i => parseInt(hex.substr(i, 2), 16) / 255);
}

function niceScale(lo, hi, ticks) {
    if (hi - lo < 1e-9) {
        let pad = Math.abs(lo) * 0.05 || 1;
        lo -= pad;
        hi += pad;
    }
    let raw = (hi - lo) / ticks;
    let mag = Math.pow(10, Math.floor(Math.log10(raw)));
    let norm = raw / mag;
    let step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
    return [Math.floor(lo / step) * step, Math.ceil(hi / step) * step, step];
}

function duration(seconds) {
    let min = Math.max(1, Math.round(seconds / 60));
    if (min < 90)
        return `${min} min`;
    let h = Math.floor(min / 60);
    return min % 60 ? `${h} h ${min % 60} min` : `${h} h`;
}

function formatTime(ts, fmt) {
    return GLib.DateTime.new_from_unix_local(ts).format(fmt);
}

function ago(ts) {
    let s = Math.max(0, Math.floor(Date.now() / 1000 - ts));
    if (s < 90) return "just now";
    if (s < 5400) return `${Math.round(s / 60)} min ago`;
    if (s < 172800) return `${Math.round(s / 3600)} h ago`;
    return `${Math.round(s / 86400)} days ago`;
}

class AirthingsApplet extends Applet.TextIconApplet {
    constructor(metadata, orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId);

        this._path = metadata.path;
        this._helper = GLib.build_filenamev([metadata.path, "airthings.py"]);
        this._device = null;
        this._latest = null;
        this._history = null;
        this._error = null;
        this._busy = false;
        this._timer = 0;
        this._destroyed = false;
        this._hoverX = null;
        this._graphMetric = "radon_st";
        this._outdoor = null;
        this._co2 = null;
        this._scheduledMinutes = 0;
        this._outdoorError = null;
        this._geoResults = [];
        this._geoTimer = 0;

        this.settings = new Settings.AppletSettings(this, metadata.uuid, instanceId);
        this.settings.bind("address", "address");
        this.settings.bind("interval", "interval", () => this._schedule());
        this.settings.bind("panel_metric", "panel_metric", () => this._updatePanel());
        this.settings.bind("show_icon", "show_icon", () => this._updatePanel());
        this.settings.bind("colorize", "colorize", () => this._updatePanel());
        this.settings.bind("radon_unit", "radon_unit", () => this._refreshAll());
        this.settings.bind("temp_unit", "temp_unit", () => this._refreshAll());
        this.settings.bind("retention_days", "retention_days");
        this.settings.bind("graph_range", "graph_range", () => {
            this._rangeHours = parseInt(this.graph_range) || 24;
            this._loadHistory();
        });
        this.settings.bind("co2_target", "co2_target", () => this._loadHistory());
        this.settings.bind("fast_poll", "fast_poll", () => this._schedule());
        this.settings.bind("location", "location", () => this._scheduleGeocode());
        this.settings.bind("outdoor_overlay", "outdoor_overlay", () => {
            this._loadOutdoor();
            this._updateMenu();
        });
        for (let key of ["location_query", "location_label", "location_lat", "location_lon"])
            this.settings.bind(key, key);
        this._rangeHours = parseInt(this.graph_range) || 24;
        if (METRICS[this.panel_metric])
            this._graphMetric = this.panel_metric;

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);
        this._buildMenu();
        this.menu.connect("open-state-changed", (menu, open) => {
            if (open)
                this._loadHistory();
        });

        this._updatePanel();
        this._loadHistory();
        this._poll();
        this._schedule();
        // The location may have been edited while the applet was not running.
        if (this.location.trim() !== (this.location_query || ""))
            this._geocode();
    }

    // --- units ------------------------------------------------------------

    _unit(metric) {
        if (metric.startsWith("radon") && this.radon_unit === "pci")
            return "pCi/L";
        if (metric === "temperature" && this.temp_unit === "f")
            return "°F";
        return METRICS[metric].unit;
    }

    _conv(metric, v) {
        if (v === null || v === undefined)
            return null;
        if (metric.startsWith("radon") && this.radon_unit === "pci")
            return v / 37;
        if (metric === "temperature" && this.temp_unit === "f")
            return v * 9 / 5 + 32;
        return v;
    }

    _digits(metric) {
        if (metric.startsWith("radon") && this.radon_unit === "pci")
            return 1;
        return METRICS[metric].digits;
    }

    _fmt(metric, v, withUnit = true) {
        let c = this._conv(metric, v);
        if (c === null)
            return "—";
        let s = c.toFixed(this._digits(metric));
        let u = this._unit(metric);
        return withUnit ? (u === "%" || u.startsWith("°") ? s + u : `${s} ${u}`) : s;
    }

    // --- helper process ---------------------------------------------------

    _runHelper(args, callback) {
        let proc;
        try {
            proc = Gio.Subprocess.new(["python3", this._helper, ...args],
                Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE);
        } catch (e) {
            callback({ ok: false, error: e.message });
            return;
        }
        proc.communicate_utf8_async(null, null, (p, res) => {
            let result;
            try {
                let [, stdout, stderr] = p.communicate_utf8_finish(res);
                try {
                    result = JSON.parse(stdout);
                } catch (e) {
                    let msg = (stderr || stdout || "").trim().split("\n").pop();
                    result = { ok: false, error: msg || "Helper produced no output" };
                }
            } catch (e) {
                result = { ok: false, error: e.message };
            }
            if (!this._destroyed)
                callback(result);
        });
    }

    _poll() {
        if (this._busy)
            return;
        this._busy = true;
        this._error = null;
        this._updateMenu();

        let args = ["poll", "--retention-days", String(this.retention_days)];
        if (this.address.trim())
            args.push("--address", this.address.trim());

        this._runHelper(args, res => {
            this._busy = false;
            if (res.ok) {
                this._latest = { ts: res.ts, values: res.values };
                if (this._pollMinutes() !== this._scheduledMinutes)
                    this._schedule();
                this._device = { model: res.model, serial: res.serial || (this._device && this._device.serial) };
                if (!this.address.trim() && res.address)
                    this.settings.setValue("address", res.address);
                this._loadHistory();
            } else {
                this._error = res.error;
            }
            this._updatePanel();
            this._updateMenu();
        });
    }

    // --- outdoor pressure (Open-Meteo) ----------------------------------

    _hasLocation() {
        return typeof this.location_lat === "number" && typeof this.location_lon === "number";
    }

    _scheduleGeocode() {
        // The settings entry reports every keystroke; wait until typing stops.
        if (this._geoTimer)
            GLib.source_remove(this._geoTimer);
        this._geoTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1500, () => {
            this._geoTimer = 0;
            this._geocode();
            return GLib.SOURCE_REMOVE;
        });
    }

    _geocode() {
        let query = this.location.trim();
        this._geoResults = [];
        if (!query) {
            this._setLocation(null, "");
            return;
        }
        this._runHelper(["geocode", query], res => {
            if (query !== this.location.trim())
                return;  // superseded by a newer edit
            if (res.ok && res.results.length) {
                this._geoResults = res.results;
                this._setLocation(res.results[0], query);
            } else {
                this._setLocation(null, query);
                this._outdoorError = res.ok ? `No place found for “${query}”` : res.error;
                this._updateMenu();
            }
        });
    }

    _setLocation(place, query) {
        this.settings.setValue("location_query", query);
        this.settings.setValue("location_label", place ? place.label : null);
        this.settings.setValue("location_lat", place ? place.latitude : null);
        this.settings.setValue("location_lon", place ? place.longitude : null);
        this._outdoor = null;
        this._outdoorError = null;
        this._updateLocationMenu();
        this._loadOutdoor();
        this._updateMenu();
    }

    _outdoorKey() {
        return `${this.location_lat},${this.location_lon},${this._rangeHours}`;
    }

    _loadOutdoor() {
        if (!this.outdoor_overlay || this._graphMetric !== "pressure" || !this._hasLocation())
            return;
        let key = this._outdoorKey();
        this._runHelper(["outdoor", "--lat", String(this.location_lat), "--lon", String(this.location_lon),
                         "--hours", String(this._rangeHours), "--points", "300"], res => {
            if (key !== this._outdoorKey())
                return;
            if (res.ok) {
                this._outdoor = { key, rows: res.rows };
                this._outdoorError = null;
            } else {
                this._outdoorError = res.error;
            }
            this._updateMenu();
        });
    }

    _outdoorPoints() {
        if (!this.outdoor_overlay || this._graphMetric !== "pressure" || !this._outdoor
            || this._outdoor.key !== this._outdoorKey())
            return [];
        return this._outdoor.rows;
    }

    _updateLocationMenu() {
        if (!this._locationMenu)
            return;
        this._locationMenu.menu.removeAll();
        this._locationMenu.actor.visible = this._geoResults.length > 1;
        this._locationMenu.label.text = `Outdoor location: ${this.location_label || "—"}`;
        for (let place of this._geoResults) {
            let current = place.latitude === this.location_lat && place.longitude === this.location_lon;
            let item = new PopupMenu.PopupMenuItem(`${current ? "✓ " : "    "}${place.label}`);
            item.connect("activate", () => {
                this._setLocation(place, this.location.trim());
            });
            this._locationMenu.menu.addMenuItem(item);
        }
    }

    _loadHistory() {
        this._loadOutdoor();
        let args = ["history", "--hours", String(this._rangeHours), "--points", "300",
                    "--co2-target", String(this.co2_target)];
        if (this.address.trim())
            args.push("--address", this.address.trim());
        this._runHelper(args, res => {
            if (!res.ok)
                return;
            this._history = res;
            this._co2 = res.co2 || null;
            if (this._co2)
                this._co2.fetched = Date.now() / 1000;
            if (res.device)
                this._device = res.device;
            if (res.latest && (!this._latest || res.latest.ts > this._latest.ts))
                this._latest = res.latest;
            this._updatePanel();
            this._updateMenu();
        });
    }

    _report(period) {
        let args = ["report", period.length === 4 ? "--year" : "--month", period,
                    "--co2-target", String(this.co2_target)];
        if (this.address.trim())
            args.push("--address", this.address.trim());
        if (this._hasLocation())
            args.push("--lat", String(this.location_lat), "--lon", String(this.location_lon));
        this._runHelper(args, res => {
            if (!res.ok) {
                Main.notify("Airthings report failed", res.error);
                return;
            }
            try {
                Gio.AppInfo.launch_default_for_uri(Gio.File.new_for_path(res.path).get_uri(), null);
            } catch (e) {
                Main.notify("Airthings report created", res.path);
            }
        });
    }

    _scan() {
        this._scanSection.removeAll();
        let wait = new PopupMenu.PopupMenuItem("Scanning…", { reactive: false });
        this._scanSection.addMenuItem(wait);
        this._runHelper(["scan"], res => {
            this._scanSection.removeAll();
            if (!res.ok || !res.devices.length) {
                let msg = res.ok ? "No Airthings devices found" : res.error;
                this._scanSection.addMenuItem(new PopupMenu.PopupMenuItem(msg, { reactive: false }));
                return;
            }
            for (let d of res.devices) {
                let current = d.address === this.address.trim();
                let item = new PopupMenu.PopupMenuItem(
                    `${current ? "✓ " : ""}${d.model} ${d.serial} — ${d.address} (${d.rssi} dBm)`);
                item.connect("activate", () => {
                    this.settings.setValue("address", d.address);
                    this._scanSection.removeAll();
                    this._latest = null;
                    this._history = null;
                    this._device = null;
                    this._poll();
                });
                this._scanSection.addMenuItem(item);
            }
        });
    }

    _pollMinutes() {
        let co2 = this._latest ? this._latest.values.co2 : null;
        if (this.fast_poll && typeof co2 === "number" && co2 > this.co2_target)
            return Math.min(this.interval, 5);
        return Math.max(1, this.interval);
    }

    _schedule() {
        if (this._timer)
            GLib.source_remove(this._timer);
        this._scheduledMinutes = this._pollMinutes();
        this._timer = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, this._scheduledMinutes * 60, () => {
            this._timer = 0;
            this._poll();
            this._schedule();
            return GLib.SOURCE_REMOVE;
        });
    }

    // --- fresh air estimate ----------------------------------------------

    // Estimate for the current reading: follow the observed decline if CO₂ is
    // already falling, otherwise assume an airing at the learned typical rate.
    _co2Estimate() {
        let c = this._co2;
        let cur = this._latest ? this._latest.values.co2 : null;
        if (!c || typeof cur !== "number" || cur <= this.co2_target)
            return null;
        let now = Date.now() / 1000;
        if (c.mode === "falling" && c.current === cur && c.eta_seconds !== null)
            return { mode: "falling", rate: c.rate, start: c.current_ts, current: cur,
                     eta: Math.max(0, c.eta_seconds - (now - c.fetched)) };
        if (c.typical_rate)
            return { mode: "if_aired", rate: c.typical_rate, start: now, current: cur,
                     eta: Math.log((cur - c.baseline) / (this.co2_target - c.baseline)) / c.typical_rate };
        return { mode: "unknown" };
    }

    // One short line while CO₂ is above the fresh-air level, otherwise null.
    _freshAir() {
        let est = this._co2Estimate();
        if (!est)
            return null;
        if (est.eta === undefined)
            return null;
        return est.eta < 60 ? "Fresh air any minute now" : `${duration(est.eta)} to fresh air`;
    }

    _co2Projection() {
        let est = this._co2Estimate();
        if (this._graphMetric !== "co2" || !est || !est.rate || this._rangeHours > 24)
            return [];
        let end = Math.max(est.start + 60, Date.now() / 1000 + est.eta);
        let pts = [];
        for (let i = 0; i <= 30; i++) {
            let t = est.start + (end - est.start) * i / 30;
            pts.push([t, this._co2.baseline + (est.current - this._co2.baseline) * Math.exp(-est.rate * (t - est.start))]);
        }
        return pts;
    }

    // --- panel ------------------------------------------------------------

    _isStale() {
        return !this._latest || Date.now() / 1000 - this._latest.ts > this.interval * 60 * 3;
    }

    _updatePanel() {
        if (this.show_icon)
            this.set_applet_icon_symbolic_path(GLib.build_filenamev([this._path, "icons", "airthings-symbolic.svg"]));
        else
            this.hide_applet_icon();

        let m = this.panel_metric;
        let v = this._latest && METRICS[m] ? this._latest.values[m] : null;
        let text = "";
        if (METRICS[m])
            text = this._latest ? this._fmt(m, v) : (this._error ? "!" : "…");
        this.set_applet_label(text);

        let style = null;
        let col = METRICS[m] ? level(m, v) : null;
        if (this.colorize && col && !this._isStale())
            style = `color: ${col};`;
        else if (this._isStale() && this._latest)
            style = "opacity: 0.6;";
        this._applet_label.set_style(style);

        let lines = [];
        if (this._device)
            lines.push(`Airthings ${this._device.model || ""}`.trim());
        if (this._latest) {
            for (let k of METRIC_ORDER)
                if (this._latest.values[k] !== null && this._latest.values[k] !== undefined)
                    lines.push(`${METRICS[k].label}: ${this._fmt(k, this._latest.values[k])}`);
            let fresh = this._freshAir();
            if (fresh)
                lines.push(fresh);
            lines.push(`Updated ${ago(this._latest.ts)}`);
        }
        if (this._error)
            lines.push(`Error: ${this._error}`);
        this.set_applet_tooltip(lines.join("\n") || "Airthings Wave");
    }

    // --- popup ------------------------------------------------------------

    _buildMenu() {
        // activate/hover off: a plain container that is not greyed out like reactive:false items.
        let item = new PopupMenu.PopupBaseMenuItem({ activate: false, hover: false, focusOnHover: false });
        item.actor.set_style("padding: 6px 14px;");
        let box = new St.BoxLayout({ vertical: true, x_expand: true, style: "spacing: 12px; width: 500px;" });
        item.addActor(box, { expand: true, span: -1 });
        this.menu.addMenuItem(item);

        // Header: device on the left, freshness on the right, verdict underneath.
        let header = new St.BoxLayout({ vertical: true, style: "spacing: 4px;" });
        let top = new St.BoxLayout();
        this._titleLabel = new St.Label({ x_expand: true, style: "font-weight: bold; font-size: 1.15em;" });
        this._statusLabel = new St.Label({ y_align: Clutter.ActorAlign.CENTER, style: "font-size: 0.85em; opacity: 0.6;" });
        top.add_child(this._titleLabel);
        top.add_child(this._statusLabel);
        header.add_child(top);
        this._summaryBox = new St.BoxLayout({ style: "spacing: 8px; padding: 8px 10px; border-radius: 8px;" });
        this._summaryDot = new St.Widget({ y_align: Clutter.ActorAlign.CENTER });
        this._summaryLabel = new St.Label({ x_expand: true, y_align: Clutter.ActorAlign.CENTER });
        this._summaryLabel.clutter_text.line_wrap = true;
        this._summaryBox.add_child(this._summaryDot);
        this._summaryBox.add_child(this._summaryLabel);
        header.add_child(this._summaryBox);

        // Fresh-air estimate as a plain line; clicking it shows the CO₂ graph.
        this._freshLabel = new St.Label();
        this._freshLabel.clutter_text.line_wrap = true;
        this._freshBox = new St.Button({ child: this._freshLabel, x_expand: true, x_fill: true, can_focus: false,
                                         x_align: St.Align.START });
        this._freshBox.connect("clicked", () => {
            this._graphMetric = "co2";
            this._hoverX = null;
            this._updateMenu();
        });
        header.add_child(this._freshBox);
        box.add_child(header);

        // Metric tiles; clicking one graphs that metric.
        this._grid = new St.Widget({
            x_expand: true,
            layout_manager: new Clutter.GridLayout({ column_homogeneous: true, column_spacing: 6, row_spacing: 6 }),
        });
        box.add_child(this._grid);
        this._tiles = {};
        for (let k of METRIC_ORDER) {
            let content = new St.BoxLayout({ vertical: true, x_expand: true, style: "spacing: 2px;" });
            let name = new St.Label({ text: METRICS[k].tile, style: "font-size: 0.8em; opacity: 0.65;" });
            let valueRow = new St.BoxLayout({ style: "spacing: 3px;" });
            let value = new St.Label({ style: "font-size: 1.45em; font-weight: bold;" });
            let unit = new St.Label({ y_align: Clutter.ActorAlign.END, style: "font-size: 0.8em; opacity: 0.65; padding-bottom: 2px;" });
            valueRow.add_child(value);
            valueRow.add_child(unit);
            let lvl = new St.Label({ style: "font-size: 0.8em;" });
            content.add_child(name);
            content.add_child(valueRow);
            content.add_child(lvl);
            let button = new St.Button({ child: content, x_expand: true, x_fill: true, can_focus: false, reactive: true });
            button.connect("clicked", () => {
                this._graphMetric = k;
                this._hoverX = null;
                this._loadOutdoor();
                this._updateMenu();
            });
            this._tiles[k] = { button, value, unit, lvl, shown: false };
        }

        // Graph header with a segmented range selector.
        let graphHeader = new St.BoxLayout({ style: "padding-top: 2px;" });
        this._graphTitle = new St.Label({ x_expand: true, y_align: Clutter.ActorAlign.CENTER, style: "font-weight: bold;" });
        graphHeader.add_child(this._graphTitle);
        let seg = new St.BoxLayout({ style: "background-color: rgba(128,128,128,0.15); border-radius: 8px; padding: 2px; spacing: 2px;" });
        this._rangeButtons = [];
        for (let [label, hours] of RANGES) {
            let b = new St.Button({ label, can_focus: false, reactive: true });
            b.connect("clicked", () => {
                this._rangeHours = hours;
                this._hoverX = null;
                this._loadHistory();
                this._updateMenu();
            });
            seg.add_child(b);
            this._rangeButtons.push([b, hours]);
        }
        graphHeader.add_child(seg);
        box.add_child(graphHeader);

        let graphFrame = new St.BoxLayout({ vertical: true, x_expand: true, style: "background-color: rgba(128,128,128,0.07); border-radius: 8px; padding: 6px 4px 2px 0;" });
        this._graph = new St.DrawingArea({ reactive: true, x_expand: true, style: "height: 190px;" });
        graphFrame.add_child(this._graph);
        this._graph.connect("repaint", area => this._drawGraph(area));
        this._graph.connect("motion-event", (actor, event) => {
            let [sx, sy] = event.get_coords();
            let [ok, x] = actor.transform_stage_point(sx, sy);
            this._hoverX = ok ? x : null;
            actor.queue_repaint();
            return Clutter.EVENT_PROPAGATE;
        });
        this._graph.connect("leave-event", actor => {
            this._hoverX = null;
            actor.queue_repaint();
            return Clutter.EVENT_PROPAGATE;
        });
        box.add_child(graphFrame);

        // Now / min / avg / max for the visible range.
        this._stats = {};
        let stats = new St.BoxLayout({ style: "spacing: 6px;" });
        for (let key of ["Now", "Min", "Average", "Max", "Outdoor"]) {
            let cell = new St.BoxLayout({ vertical: true, x_expand: true, style: "padding: 4px 8px; border-radius: 6px; background-color: rgba(128,128,128,0.08);" });
            cell.add_child(new St.Label({ text: key, style: "font-size: 0.75em; opacity: 0.6;" }));
            let v = new St.Label({ style: "font-weight: bold;" });
            cell.add_child(v);
            stats.add_child(cell);
            this._stats[key] = v;
            this._stats[key + "Cell"] = cell;
        }
        box.add_child(stats);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        let refresh = new PopupMenu.PopupIconMenuItem("Read sensor now", "view-refresh-symbolic", St.IconType.SYMBOLIC);
        // Override activate() so the menu stays open and shows progress.
        refresh.activate = () => this._poll();
        this.menu.addMenuItem(refresh);
        let scan = new PopupMenu.PopupIconMenuItem("Find devices…", "bluetooth-active-symbolic", St.IconType.SYMBOLIC);
        scan.activate = () => this._scan();
        this.menu.addMenuItem(scan);
        this._scanSection = new PopupMenu.PopupMenuSection();
        this.menu.addMenuItem(this._scanSection);
        let reports = new PopupMenu.PopupSubMenuMenuItem("Fresh-air report (PDF)");
        for (let [label, period] of REPORTS) {
            let item = new PopupMenu.PopupMenuItem(label);
            item.connect("activate", () => this._report(period(GLib.DateTime.new_now_local())));
            reports.menu.addMenuItem(item);
        }
        this.menu.addMenuItem(reports);
        // Alternatives when the location name matched several places.
        this._locationMenu = new PopupMenu.PopupSubMenuMenuItem("Outdoor location");
        this.menu.addMenuItem(this._locationMenu);
        this._updateLocationMenu();

        this._updateMenu();
    }

    _refreshAll() {
        this._updatePanel();
        this._updateMenu();
    }

    _updateMenu() {
        if (!this._titleLabel)
            return;
        let model = this._device && this._device.model ? this._device.model : "Wave";
        let serial = this._device && this._device.serial ? `  ·  ${this._device.serial}` : "";
        this._titleLabel.text = `Airthings ${model}${serial}`;
        this._statusLabel.text = this._busy ? "Reading sensor…"
            : this._latest ? `Updated ${ago(this._latest.ts)}` : "";

        // Status box: only the error from the last reading, or that there is no reading yet.
        let values = this._latest ? this._latest.values : {};
        let col = null, text = null;
        if (this._error)
            [col, text] = [POOR, this._error];
        else if (!this._latest)
            text = this._busy ? "Connecting to the sensor…" : "No readings yet";
        this._summaryBox.visible = !!text;
        let [r, g, b] = col ? hexToRgb(col).map(c => Math.round(c * 255)) : [128, 128, 128];
        this._summaryBox.set_style(`spacing: 8px; padding: 8px 10px; border-radius: 8px; background-color: rgba(${r},${g},${b},0.16);`);
        this._summaryDot.set_style(`width: 10px; height: 10px; border-radius: 5px; background-color: rgb(${r},${g},${b});`);
        this._summaryLabel.text = text || "";

        let fresh = this._freshAir();
        this._freshBox.visible = !!fresh;
        if (fresh)
            this._freshLabel.text = fresh;

        // Tiles: hide metrics the device does not measure (keep all until we know).
        let shown = METRIC_ORDER.filter(k => !this._latest || (values[k] !== null && values[k] !== undefined));
        if (!shown.includes(this._graphMetric) && shown.length)
            this._graphMetric = shown[0];
        let layout = this._grid.layout_manager;
        let changed = shown.join() !== (this._shownKeys || "");
        if (changed) {
            this._grid.remove_all_children();
            shown.forEach((k, i) => layout.attach(this._tiles[k].button, i % 4, Math.floor(i / 4), 1, 1));
            this._shownKeys = shown.join();
        }
        for (let k of shown) {
            let t = this._tiles[k];
            let v = values[k];
            t.value.text = this._fmt(k, v, false);
            t.unit.text = this._unit(k);
            let c = level(k, v);
            t.lvl.text = c ? `● ${c === GOOD ? "Good" : c === FAIR ? "Fair" : "Poor"}` : " ";
            t.lvl.set_style(`font-size: 0.8em; color: ${c || "transparent"};`);
            let sel = k === this._graphMetric;
            t.button.set_style("padding: 8px; border-radius: 8px; " + (sel
                ? "background-color: rgba(90,168,230,0.22); border: 1px solid rgba(90,168,230,0.8);"
                : "background-color: rgba(128,128,128,0.12); border: 1px solid transparent;"));
        }

        for (let [btn, hours] of this._rangeButtons) {
            let active = hours === this._rangeHours;
            btn.set_style("padding: 2px 10px; border-radius: 6px; font-size: 0.9em; " + (active
                ? "background-color: rgba(90,168,230,0.85); color: white; font-weight: bold;"
                : "background-color: transparent;"));
        }
        this._graphTitle.text = METRICS[this._graphMetric].label;

        let pts = this._points();
        let d = this._digits(this._graphMetric);
        let u = this._unit(this._graphMetric);
        let fmt = v => v === null || v === undefined ? "—" : `${v.toFixed(d)} ${u}`;
        let vals = pts.map(p => p[1]);
        this._stats.Now.text = fmt(this._conv(this._graphMetric, values[this._graphMetric]));
        this._stats.Min.text = fmt(vals.length ? Math.min(...vals) : null);
        this._stats.Average.text = fmt(vals.length ? vals.reduce((a, c) => a + c, 0) / vals.length : null);
        this._stats.Max.text = fmt(vals.length ? Math.max(...vals) : null);
        let out = this._outdoorPoints();
        let showOutdoor = this._graphMetric === "pressure" && this.outdoor_overlay && this._hasLocation();
        this._stats.OutdoorCell.visible = showOutdoor;
        this._stats.Outdoor.text = out.length ? fmt(out[out.length - 1][1])
            : this._outdoorError ? "unavailable" : "…";
        if (this._graphMetric === "pressure" && this.outdoor_overlay && this._outdoorError)
            this._graphTitle.text += `  ·  outdoor: ${this._outdoorError}`;
        this._graph.queue_repaint();
    }

    _points() {
        let h = this._history;
        if (!h || !h.rows)
            return [];
        let idx = h.metrics.indexOf(this._graphMetric) + 1;
        if (idx <= 0)
            return [];
        return h.rows.filter(r => r[idx] !== null).map(r => [r[0], this._conv(this._graphMetric, r[idx])]);
    }

    _drawGraph(area) {
        let cr = area.get_context();
        let [w, h] = area.get_surface_size();
        let fg = area.get_theme_node().get_foreground_color();
        let setFg = a => cr.setSourceRGBA(fg.red / 255, fg.green / 255, fg.blue / 255, a);
        cr.selectFontFace("Sans", Cairo.FontSlant.NORMAL, Cairo.FontWeight.NORMAL);
        cr.setFontSize(10);

        let padL = 42, padR = 8, padT = 8, padB = 20;
        let gw = w - padL - padR, gh = h - padT - padB;
        let metric = this._graphMetric;
        let def = METRICS[metric];
        let pts = this._points();
        let out = this._outdoorPoints();

        if (pts.length < 2 && out.length < 2) {
            setFg(0.6);
            let lines = !this._history ? ["Loading history…"]
                : ["Collecting history", "The graph fills in as readings arrive, every " + this.interval + " min"];
            lines.forEach((msg, i) => {
                setFg(i === 0 ? 0.75 : 0.5);
                cr.setFontSize(i === 0 ? 12 : 10);
                let ext = cr.textExtents(msg);
                cr.moveTo((w - ext.width) / 2, h / 2 - 4 + i * 18);
                cr.showText(msg);
            });
            cr.$dispose();
            return;
        }

        let t1 = this._history ? this._history.until : Date.now() / 1000;
        let t0 = this._history ? this._history.since : t1 - this._rangeHours * 3600;
        let vals = pts.map(p => p[1]).concat(out.map(p => p[1]));
        let lo = Math.min(...vals), hi = Math.max(...vals);
        if (def.zero)
            lo = Math.min(lo, 0);
        let proj = this._co2Projection();
        if (proj.length) {
            t1 = Math.max(t1, proj[proj.length - 1][0] + (t1 - t0) * 0.03);
            lo = Math.min(lo, this.co2_target);
            hi = Math.max(hi, proj[0][1]);
        }
        let [ymin, ymax, ystep] = niceScale(lo, hi, 4);
        let X = t => padL + (t - t0) / (t1 - t0) * gw;
        let Y = v => padT + gh - (v - ymin) / (ymax - ymin) * gh;
        let clampY = v => Math.max(padT, Math.min(padT + gh, Y(v)));

        // Quality bands behind the curve.
        if (def.good) {
            let band = (range, hex) => {
                let [r, g, b] = hexToRgb(hex);
                cr.setSourceRGBA(r, g, b, 0.08);
                let ya = clampY(this._conv(metric, range[1]) ?? Infinity);
                let yb = clampY(range[0] === -Infinity ? -Infinity : this._conv(metric, range[0]));
                if (range[1] === Infinity) ya = padT;
                if (range[0] === -Infinity) yb = padT + gh;
                cr.rectangle(padL, ya, gw, yb - ya);
                cr.fill();
            };
            // SOURCE replaces instead of blending, so the bands don't mix into each other.
            cr.setOperator(Cairo.Operator.SOURCE);
            band([-Infinity, Infinity], POOR);
            band(def.fair, FAIR);
            band(def.good, GOOD);
            cr.setOperator(Cairo.Operator.OVER);
        }

        // Grid and y labels.
        cr.setLineWidth(1);
        let decimals = ystep < 1 ? (ystep < 0.1 ? 2 : 1) : 0;
        for (let v = ymin; v <= ymax + ystep / 2; v += ystep) {
            let y = Math.round(Y(v)) + 0.5;
            setFg(0.12);
            cr.moveTo(padL, y);
            cr.lineTo(padL + gw, y);
            cr.stroke();
            setFg(0.7);
            let label = v.toFixed(decimals);
            let ext = cr.textExtents(label);
            cr.moveTo(padL - 6 - ext.width, y + 3.5);
            cr.showText(label);
        }

        // Time axis, ticks aligned to local midnight/hours.
        let span = t1 - t0;
        let steps = [3600, 7200, 10800, 21600, 43200, 86400, 172800, 604800, 2592000];
        let tstep = steps.find(s => span / s <= 6) || 2592000;
        let offset = GLib.DateTime.new_now_local().get_utc_offset() / 1e6;
        let fmt = tstep < 86400 ? "%H:%M" : (span > 90 * 86400 ? "%b" : "%d %b");
        let first = tstep === 2592000 ? null : Math.ceil((t0 + offset) / tstep) * tstep - offset;
        let ticks = [];
        if (first === null) {
            // Monthly ticks on the 1st of each month.
            let d = GLib.DateTime.new_from_unix_local(t0);
            d = GLib.DateTime.new_local(d.get_year(), d.get_month(), 1, 0, 0, 0).add_months(1);
            while (d.to_unix() < t1) {
                ticks.push(d.to_unix());
                d = d.add_months(1);
            }
        } else {
            for (let t = first; t < t1; t += tstep)
                ticks.push(t);
        }
        for (let t of ticks) {
            let x = Math.round(X(t)) + 0.5;
            setFg(0.08);
            cr.moveTo(x, padT);
            cr.lineTo(x, padT + gh);
            cr.stroke();
            setFg(0.7);
            let label = formatTime(t, fmt);
            let ext = cr.textExtents(label);
            let lx = Math.max(padL, Math.min(w - padR - ext.width, x - ext.width / 2));
            cr.moveTo(lx, h - 5);
            cr.showText(label);
        }

        // Split the series into segments wherever readings are missing.
        let gap = Math.max((this._history ? this._history.bucket : 60) * 3, this.interval * 60 * 3);
        let segments = [[]];
        for (let i = 0; i < pts.length; i++) {
            if (i > 0 && pts[i][0] - pts[i - 1][0] > gap)
                segments.push([]);
            segments[segments.length - 1].push(pts[i]);
        }

        cr.save();
        cr.rectangle(padL, padT, gw, gh);
        cr.clip();
        for (let seg of segments) {
            if (seg.length === 0)
                continue;
            if (seg.length === 1) {
                cr.setSourceRGBA(...LINE, 1);
                cr.arc(X(seg[0][0]), Y(seg[0][1]), 1.5, 0, 2 * Math.PI);
                cr.fill();
                continue;
            }
            // Area fill.
            cr.moveTo(X(seg[0][0]), padT + gh);
            for (let [t, v] of seg)
                cr.lineTo(X(t), Y(v));
            cr.lineTo(X(seg[seg.length - 1][0]), padT + gh);
            cr.closePath();
            let grad = new Cairo.LinearGradient(0, padT, 0, padT + gh);
            grad.addColorStopRGBA(0, ...LINE, 0.35);
            grad.addColorStopRGBA(1, ...LINE, 0.02);
            cr.setSource(grad);
            cr.fill();
            // Line.
            cr.setSourceRGBA(...LINE, 1);
            cr.setLineWidth(1.6);
            cr.setLineJoin(Cairo.LineJoin.ROUND);
            cr.moveTo(X(seg[0][0]), Y(seg[0][1]));
            for (let [t, v] of seg)
                cr.lineTo(X(t), Y(v));
            cr.stroke();
        }

        // CO₂: the fresh-air level, and the projected decline towards it.
        if (metric === "co2") {
            let [r, g, b] = hexToRgb(GOOD);
            cr.setSourceRGBA(r, g, b, 0.8);
            cr.setLineWidth(1);
            cr.setDash([6, 4], 0);
            let yt = Math.round(Y(this.co2_target)) + 0.5;
            cr.moveTo(padL, yt);
            cr.lineTo(padL + gw, yt);
            cr.stroke();
            cr.setDash([], 0);
        }
        if (proj.length) {
            let now = Date.now() / 1000;
            setFg(0.35);
            cr.setLineWidth(1);
            cr.setDash([2, 3], 0);
            cr.moveTo(Math.round(X(now)) + 0.5, padT);
            cr.lineTo(Math.round(X(now)) + 0.5, padT + gh);
            cr.stroke();
            cr.setSourceRGBA(...LINE, this._co2Estimate().mode === "falling" ? 0.9 : 0.55);
            cr.setLineWidth(1.8);
            cr.setDash([2, 3], 0);
            proj.forEach(([t, v], i) => i ? cr.lineTo(X(t), Y(v)) : cr.moveTo(X(t), Y(v)));
            cr.stroke();
            cr.setDash([], 0);
        }

        // Outdoor pressure as a dashed line on top.
        if (out.length) {
            let outGap = 3 * Math.max(3600, (t1 - t0) / 300);
            cr.setSourceRGBA(...OUTDOOR, 0.95);
            cr.setLineWidth(1.4);
            cr.setDash([4, 3], 0);
            out.forEach(([t, v], i) => {
                if (i === 0 || t - out[i - 1][0] > outGap)
                    cr.moveTo(X(t), Y(v));
                else
                    cr.lineTo(X(t), Y(v));
            });
            cr.stroke();
            cr.setDash([], 0);
        }
        cr.restore();

        // Marker on the most recent value.
        if (pts.length) {
            let [lt, lv] = pts[pts.length - 1];
            cr.setSourceRGBA(...LINE, 0.3);
            cr.arc(X(lt), Y(lv), 6, 0, 2 * Math.PI);
            cr.fill();
            cr.setSourceRGBA(...LINE, 1);
            cr.arc(X(lt), Y(lv), 3, 0, 2 * Math.PI);
            cr.fill();
        }

        // Where the projection reaches fresh air.
        if (proj.length) {
            let [pt, pv] = proj[proj.length - 1];
            let [r, g, b] = hexToRgb(GOOD);
            cr.setSourceRGBA(r, g, b, 1);
            cr.arc(X(pt), Y(pv), 4, 0, 2 * Math.PI);
            cr.fill();
            cr.setFontSize(10);
            let label = `fresh at ${formatTime(pt, "%H:%M")}`;
            let ext = cr.textExtents(label);
            let lx = Math.min(X(pt) - ext.width / 2, padL + gw - ext.width - 2);
            let ly = Y(pv) + 16 > padT + gh ? Y(pv) - 8 : Y(pv) + 16;
            cr.moveTo(lx, ly);
            cr.showText(label);
        }

        // Legend when two series are shown.
        if (out.length) {
            cr.setFontSize(10);
            let place = (this.location_label || "").split(",")[0];
            let entries = [["Indoor", LINE, false], [`Outdoor · ${place}`, OUTDOOR, true]];
            let lx = padL + 8, ly = padT + 6;
            let widths = entries.map(([text]) => cr.textExtents(text).width);
            let boxW = widths.reduce((a, b) => a + b, 0) + entries.length * 28 + 4;
            cr.setSourceRGBA(0, 0, 0, 0.35);
            cr.rectangle(lx - 4, ly - 2, boxW, 16);
            cr.fill();
            entries.forEach(([text, col, dashed], i) => {
                cr.setSourceRGBA(...col, 1);
                cr.setLineWidth(2);
                if (dashed)
                    cr.setDash([4, 3], 0);
                cr.moveTo(lx, ly + 6);
                cr.lineTo(lx + 16, ly + 6);
                cr.stroke();
                cr.setDash([], 0);
                setFg(0.85);
                cr.moveTo(lx + 20, ly + 10);
                cr.showText(text);
                lx += 28 + widths[i];
            });
        }

        // Hover readout: nearest reading, plus the outdoor value at that time.
        if (this._hoverX !== null && this._hoverX >= padL && this._hoverX <= padL + gw) {
            let nearest = series => series.reduce((best, p) =>
                Math.abs(X(p[0]) - this._hoverX) < Math.abs(X(best[0]) - this._hoverX) ? p : best);
            let d = this._digits(metric), u = this._unit(metric);
            let main = pts.length ? nearest(pts) : null;
            let outP = out.length ? nearest(out) : null;
            let t = main ? main[0] : outP[0];
            let x = X(t);
            setFg(0.4);
            cr.setLineWidth(1);
            cr.moveTo(Math.round(x) + 0.5, padT);
            cr.lineTo(Math.round(x) + 0.5, padT + gh);
            cr.stroke();

            let lines = [];
            let anchorY = padT + gh / 2;
            if (main) {
                anchorY = Y(main[1]);
                cr.setSourceRGBA(...LINE, 1);
                cr.arc(x, anchorY, 3.5, 0, 2 * Math.PI);
                cr.fill();
                lines.push(out.length ? `Indoor ${main[1].toFixed(d)} ${u}` : `${main[1].toFixed(d)} ${u}`);
            }
            // Only pair the outdoor value if it is close in time to the hovered point.
            if (outP && Math.abs(outP[0] - t) <= Math.max(5400, (t1 - t0) / 150)) {
                cr.setSourceRGBA(...OUTDOOR, 1);
                cr.arc(X(outP[0]), Y(outP[1]), 3.5, 0, 2 * Math.PI);
                cr.fill();
                lines.push(`Outdoor ${outP[1].toFixed(d)} ${u}`);
                if (!main)
                    anchorY = Y(outP[1]);
            }
            lines.push(formatTime(t, span > 86400 ? "%a %d %b %H:%M" : "%H:%M"));

            cr.setFontSize(11);
            let bw = Math.max(...lines.map(l => cr.textExtents(l).width)) + 12;
            let bh = lines.length * 15 + 6;
            let bx = Math.max(padL, Math.min(padL + gw - bw, x - bw / 2));
            let by = anchorY - bh - 8 < padT ? anchorY + 8 : anchorY - bh - 8;
            by = Math.min(by, padT + gh - bh);
            cr.setSourceRGBA(0, 0, 0, 0.75);
            cr.rectangle(bx, by, bw, bh);
            cr.fill();
            cr.setSourceRGBA(1, 1, 1, 1);
            lines.forEach((l, i) => {
                cr.moveTo(bx + 6, by + 15 + i * 15);
                cr.showText(l);
            });
        }

        cr.$dispose();
    }

    on_applet_clicked() {
        this.menu.toggle();
    }

    on_applet_removed_from_panel() {
        this._destroyed = true;
        if (this._timer) {
            GLib.source_remove(this._timer);
            this._timer = 0;
        }
        if (this._geoTimer) {
            GLib.source_remove(this._geoTimer);
            this._geoTimer = 0;
        }
        this.settings.finalize();
    }
}

function main(metadata, orientation, panelHeight, instanceId) {
    return new AirthingsApplet(metadata, orientation, panelHeight, instanceId);
}
