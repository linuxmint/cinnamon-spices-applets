// PC Pulse: a glass panel strip of live widgets (Claude Code limits, weather,
// uptime, CPU, RAM, GPU, temperatures, disk, network, battery, clock, custom
// commands). Everything is configurable from the settings dialog (right click >
// Configure, or the menu). Data comes from /proc, /sys and small JSON files;
// only weather (curl), custom commands and nvidia-smi are spawned, asynchronously.

const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;
const Mainloop = imports.mainloop;
const Util = imports.misc.util;
const St = imports.gi.St;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Clutter = imports.gi.Clutter;
const Cairo = imports.cairo;
const Pango = imports.gi.Pango;
const Cinnamon = imports.gi.Cinnamon;
let UPower = null;
try { UPower = imports.gi.UPowerGlib; } catch (e) { /* no upower: device batteries show n/a */ }

const Gettext = imports.gettext;

const UUID = "pc-pulse@puneet";
const HOME = GLib.get_home_dir();
Gettext.bindtextdomain(UUID, HOME + "/.local/share/locale");
function _(str) {
    let t = Gettext.dgettext(UUID, str);
    return t !== str ? t : Gettext.gettext(str);
}
const CENTER = Clutter.ActorAlign.CENTER;
const CLAUDE_AUTO_FILES = [
    GLib.get_user_cache_dir() + "/pc-pulse/claude-limits.json",   // written by claude-statusline.py
    HOME + "/.cache/claude-usage/limits.json",
    HOME + "/.claude/usage-widget.json",
];

// Default caption, drawing style and colour for each widget type.
const TYPES = {
    claude_week: { cap: "CLAUDE WK", style: "ring", color: "#D97757", name: "Claude weekly limit" },
    claude_5h:   { cap: "CLAUDE 5H", style: "ring", color: "#D97757", name: "Claude 5 hour limit" },
    weather:     { cap: "WEATHER", style: "weather", color: "#FFD54F", name: "Weather" },
    uptime:      { cap: "UPTIME", style: "clock", color: "#D9D9D9", name: "Uptime" },
    cpu:         { cap: "CPU", style: "graph", color: "#5AA9FF", name: "CPU usage" },
    cpu_temp:    { cap: "CPU TEMP", style: "bar", color: "#FF8A65", name: "CPU temperature" },
    load:        { cap: "LOAD", style: "graph", color: "#FFD54F", name: "Load average" },
    ram:         { cap: "RAM", style: "ring", color: "#B48CFF", name: "RAM" },
    swap:        { cap: "SWAP", style: "ring", color: "#9575CD", name: "Swap" },
    gpu:         { cap: "GPU", style: "ring", color: "#4CD6A0", name: "GPU usage" },
    gpu_temp:    { cap: "GPU TEMP", style: "bar", color: "#4CD6A0", name: "GPU temperature" },
    vram:        { cap: "VRAM", style: "ring", color: "#26C6DA", name: "GPU memory" },
    disk:        { cap: "DISK", style: "bar", color: "#90A4AE", name: "Disk space" },
    disk_io:     { cap: "DISK I/O", style: "graph", color: "#F06292", name: "Disk read+write" },
    net_down:    { cap: "DOWN", style: "graph", color: "#4FC3F7", name: "Network download" },
    net_up:      { cap: "UP", style: "graph", color: "#AED581", name: "Network upload" },
    battery:     { cap: "BATTERY", style: "ring", color: "#81C784", name: "Battery (laptop)" },
    device_bat:  { cap: "", style: "ring", color: "#81C784", name: "Bluetooth / wireless device battery" },
    clock:       { cap: "", style: "text", color: "#FFFFFF", name: "Clock / date" },
    custom:      { cap: "CUSTOM", style: "text", color: "#FFFFFF", name: "Custom command" },
};

const SETTING_KEYS = [
    "widgets", "glass_on", "glass_top", "glass_bottom", "glass_opacity", "border_color",
    "border_width", "shadow_on", "radius", "pad_x", "pad_y", "seg_spacing", "separators",
    "separator_color", "gfx_size", "ring_width", "bar_width", "graph_width", "graph_points",
    "track_color", "graph_fill", "font_family", "show_captions", "caption_size",
    "caption_color", "value_size", "value_color", "value_min_width", "text_shadow",
    "show_units", "warn_at", "warn_color", "hot_at", "hot_color", "color_value_text",
    "refresh_ms", "smooth_samples", "custom_every", "left_click", "middle_click",
    "custom_click_cmd", "menu_details", "menu_toggles", "claude_file",
    "claude_stale_hours", "claude_show_reset", "stats_cmd",
    "weather_units", "weather_every", "weather_caption", "drag_reorder", "logi_enabled", "logi_every", "strip_height", "v_offset",
];

const BATTERY_LEVELS = { Full: 100, High: 80, Normal: 55, Low: 20, Critical: 5 };
// UPower BatteryLevel enum -> [percent for the ring, text]
const UP_LEVELS = { 3: [20, "Low"], 4: [5, "Crit"], 6: [55, "OK"], 7: [80, "High"], 8: [100, "Full"] };
const UP_KINDS = { 5: "MOUSE", 6: "KEYBOARD", 8: "PHONE", 10: "TABLET", 11: "COMPUTER", 12: "GAMEPAD",
    13: "PEN", 14: "TOUCHPAD", 17: "HEADSET", 18: "SPEAKERS", 19: "HEADPHONES", 22: "REMOTE",
    23: "PRINTER", 26: "WEARABLE" };

// WMO weather codes (Open-Meteo) -> text and icon kind
const WMO = {
    0: ["Clear", "clear"], 1: ["Mainly clear", "clear"], 2: ["Partly cloudy", "partly"], 3: ["Overcast", "cloud"],
    45: ["Fog", "fog"], 48: ["Rime fog", "fog"],
    51: ["Light drizzle", "rain"], 53: ["Drizzle", "rain"], 55: ["Heavy drizzle", "rain"],
    56: ["Freezing drizzle", "rain"], 57: ["Freezing drizzle", "rain"],
    61: ["Light rain", "rain"], 63: ["Rain", "rain"], 65: ["Heavy rain", "rain"],
    66: ["Freezing rain", "rain"], 67: ["Freezing rain", "rain"],
    71: ["Light snow", "snow"], 73: ["Snow", "snow"], 75: ["Heavy snow", "snow"], 77: ["Snow grains", "snow"],
    80: ["Showers", "rain"], 81: ["Showers", "rain"], 82: ["Heavy showers", "rain"],
    85: ["Snow showers", "snow"], 86: ["Snow showers", "snow"],
    95: ["Thunderstorm", "storm"], 96: ["Thunderstorm, hail", "storm"], 99: ["Thunderstorm, hail", "storm"],
};

// ---- helpers ---------------------------------------------------------------

function readText(path) {
    try {
        let [ok, bytes] = GLib.file_get_contents(path);
        return ok ? new TextDecoder().decode(bytes) : null;
    } catch (e) {
        return null;
    }
}

function exists(path) {
    return GLib.file_test(path, GLib.FileTest.EXISTS);
}

function listDir(path) {
    let out = [];
    try {
        let dir = GLib.Dir.open(path, 0);
        let name;
        while ((name = dir.read_name()) !== null) out.push(name);
        dir.close();
    } catch (e) { /* missing dir */ }
    return out.sort();
}

// "#rgb", "#rrggbb", "rgb(r,g,b)", "rgba(r,g,b,a)" -> [r, g, b, a] in 0..1
function parseColor(str, fallback) {
    if (!str || typeof str !== "string") return fallback ? parseColor(fallback) : [1, 1, 1, 1];
    let s = str.trim();
    let m = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (m) {
        let h = m[1].length === 3 ? m[1].split("").map((c) => c + c).join("") : m[1];
        return [parseInt(h.substr(0, 2), 16) / 255, parseInt(h.substr(2, 2), 16) / 255, parseInt(h.substr(4, 2), 16) / 255, 1];
    }
    m = s.match(/^rgba?\(([^)]+)\)$/i);
    if (m) {
        let p = m[1].split(",").map((x) => parseFloat(x));
        return [p[0] / 255, p[1] / 255, p[2] / 255, p.length > 3 ? p[3] : 1];
    }
    return fallback ? parseColor(fallback) : [1, 1, 1, 1];
}

function cssColor(c, alpha) {
    let a = alpha === undefined ? c[3] : alpha;
    return "rgba(" + Math.round(c[0] * 255) + "," + Math.round(c[1] * 255) + "," + Math.round(c[2] * 255) + "," + a.toFixed(3) + ")";
}

function fmtDuration(sec) {
    sec = Math.max(0, sec);
    let d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60);
    if (d > 0) return d + "d " + h + "h";
    if (h > 0) return h + "h " + String(m).padStart(2, "0") + "m";
    return m + "m";
}

function fmtBytes(n, units) {
    let u = ["B", "K", "M", "G", "T"], i = 0;
    while (n >= 1000 && i < u.length - 1) { n /= 1024; i++; }
    let v = n >= 100 || i === 0 ? n.toFixed(0) : n.toFixed(1);
    return v + (units ? u[i] : "");
}

function fmtRate(n, units) {
    return fmtBytes(n, true) + (units ? "/s" : "");
}

function findHwmon(names) {
    for (let h of listDir("/sys/class/hwmon")) {
        let base = "/sys/class/hwmon/" + h;
        let name = (readText(base + "/name") || "").trim();
        if (names.indexOf(name) >= 0 && exists(base + "/temp1_input")) return base + "/temp1_input";
    }
    return null;
}

// ---- the applet --------------------------------------------------------------

class PcPulse extends Applet.Applet {
    constructor(metadata, orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId);
        this.setAllowedLayout(Applet.AllowedLayout.HORIZONTAL);
        this.metadata = metadata;
        this.logi = { list: [], at: 0, busy: false };

        this.settings = new Settings.AppletSettings(this, metadata.uuid, instanceId);
        for (let key of SETTING_KEYS)
            this.settings.bind(key, key, () => this._queueRebuild());

        this.st = {};          // sampler state (previous counters)
        this.hist = {};        // graph history per widget key
        this.gpuHist = [];
        this.custom = {};      // custom command output per command
        this.weather = {};     // weather result per location
        this.nvidia = null;
        this.segs = [];

        this.actor.set_style("padding: 0 3px;");
        this._pill = new St.BoxLayout({ y_align: CENTER, y_expand: true });
        this.actor.add_actor(this._pill);

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);
        this.menu.connect("open-state-changed", (m, open) => { if (open) this._buildMenu(); });

        this._addContextItems();
        this._rebuild();
    }

    // ---- settings and layout -------------------------------------------------

    _queueRebuild() {
        if (this._rebuildId) return;
        this._rebuildId = Mainloop.idle_add(() => {
            this._rebuildId = null;
            this._rebuild();
            return false;
        });
    }

    _widgets() {
        let list = Array.isArray(this.widgets) ? this.widgets : [];
        return list.filter((w) => w && w.enabled && TYPES[w.type]);
    }

    _wkey(w) {
        return w.type + "|" + (w.arg || "");
    }

    _styleOf(w) {
        if (w.style && w.style !== "auto") return w.style;
        return TYPES[w.type].style;
    }

    _colorOf(w) {
        return parseColor(w.color, TYPES[w.type].color);
    }

    _capOf(w) {
        return (w.label && w.label.trim()) ? w.label.trim() : TYPES[w.type].cap;
    }

    _textStyle(size, color) {
        let s = "font-size: " + size + "pt; font-weight: bold; color: " + color + ";";
        if (this.font_family && this.font_family.trim()) s += "font-family: \"" + this.font_family.trim() + "\";";
        if (this.text_shadow) s += "text-shadow: 0 0 2px rgba(0,0,0,0.35);";
        return s;
    }

    _rebuild() {
        try {
            this._pill.destroy_all_children();
            this.segs = [];

            let op = Math.max(0, Math.min(100, this.glass_opacity)) / 100;
            let style = "border-radius: " + this.radius + "px; padding: " + this.pad_y + "px " + this.pad_x + "px; spacing: " + this.seg_spacing + "px;";
            if (this.glass_on) {
                let top = parseColor(this.glass_top), bot = parseColor(this.glass_bottom);
                style += "background-gradient-direction: vertical;" +
                    "background-gradient-start: " + cssColor(top, top[3] * op) + ";" +
                    "background-gradient-end: " + cssColor(bot, bot[3] * op) + ";";
                if (this.border_width > 0) style += "border: " + this.border_width + "px solid " + cssColor(parseColor(this.border_color)) + ";";
                if (this.shadow_on) style += "box-shadow: inset 0 1px 0 rgba(255,255,255,0.30);";
            }
            this._pill.set_style(style);
            // Fixed height, centred in the panel with equal space above and below.
            let h = this.strip_height > 0 ? this.strip_height : Math.max(16, (this._panelHeight || 40) - 8);
            this._pill.set_height(Math.min(h, this._panelHeight || h));
            this._pill.translation_y = this.v_offset || 0;
            this.actor.set_style("padding: 0 3px;");

            this._capStyle = this._textStyle(this.caption_size, cssColor(parseColor(this.caption_color)));
            this._valStyle = this._textStyle(this.value_size, cssColor(parseColor(this.value_color))) +
                "min-width: " + this.value_min_width + "px;";

            let ws = this._widgets();
            if (ws.length === 0) {
                let l = new St.Label({ text: "PC Pulse", y_align: CENTER, style: this._valStyle });
                this._pill.add_actor(l);
            }
            ws.forEach((w, i) => {
                if (i > 0 && this.separators)
                    this._pill.add_actor(new St.Widget({
                        y_align: CENTER, height: Math.round(this.gfx_size * 0.9),
                        style: "width: 1px; margin: 0 2px; background-color: " + cssColor(parseColor(this.separator_color)) + ";",
                    }));
                this.segs.push(this._segment(w));
            });

            this._restartTimer();
            this._tick();
        } catch (e) {
            global.logError("pc-pulse rebuild: " + e + "\n" + e.stack);
        }
    }

    _segment(w) {
        let seg = { w: w, listIndex: (this.widgets || []).indexOf(w), key: this._wkey(w), style: this._styleOf(w), color: this._colorOf(w), data: null };
        let box = new St.BoxLayout({ y_align: CENTER, reactive: true, style: "spacing: 6px; padding: 0 4px;" });
        seg.box = box;
        box.connect("button-press-event", (actor, ev) => this._dragPress(seg, ev));

        let g = this.gfx_size;
        let dims = { ring: [g, g], clock: [g, g], weather: [Math.round(g * 1.2), g], bar: [this.bar_width, g], graph: [this.graph_width, g] }[seg.style];
        if (dims) {
            seg.area = new St.DrawingArea({ width: dims[0], height: dims[1], y_align: CENTER });
            seg.area.connect("repaint", (a) => {
                let cr = a.get_context();
                let [aw, ah] = a.get_surface_size();
                try { this._paint(cr, aw, ah, seg); } catch (e) { global.logError(e); }
                cr.$dispose();
            });
            box.add_actor(seg.area);
        }

        let text = new St.BoxLayout({ vertical: true, y_align: CENTER });
        let cap = this._capOf(w) || (w.type === "device_bat" ? "DEVICE" : "");
        if (this.show_captions && cap) {
            seg.cap = new St.Label({ text: cap, style: this._capStyle });
            seg.cap.clutter_text.set_ellipsize(Pango.EllipsizeMode.NONE);
            text.add_actor(seg.cap);
        }
        seg.val = new St.Label({ text: "--", style: this._valStyle });
        text.add_actor(seg.val);
        box.add_actor(text);
        this._pill.add_actor(box);
        return seg;
    }

    // ---- drag to reorder ------------------------------------------------------
    // Hold left click on a widget and drag it sideways; release to drop.
    // A press without movement stays a normal click.

    _dragPress(seg, ev) {
        if (!this.drag_reorder || ev.get_button() !== 1 || this.segs.length < 2) return Clutter.EVENT_PROPAGATE;
        this._dragEnd();
        this._drag = { seg: seg, x0: ev.get_coords()[0], active: false };
        this._dragId = global.stage.connect("captured-event", (st, e) => this._dragEvent(e));
        return Clutter.EVENT_PROPAGATE;
    }

    _dragEvent(e) {
        let d = this._drag;
        if (!d) return Clutter.EVENT_PROPAGATE;
        let t = e.type();
        if (t === Clutter.EventType.MOTION) {
            let x = e.get_coords()[0];
            if (!d.active && Math.abs(x - d.x0) > 8) {
                d.active = true;
                if (this.menu.isOpen) this.menu.close();
                d.seg.box.opacity = 170;
                global.set_cursor(Cinnamon.Cursor.DND_IN_DRAG);
            }
            if (d.active) {
                d.seg.box.translation_x = x - d.x0;
                this._dragMark(x);
                return Clutter.EVENT_STOP;
            }
        } else if (t === Clutter.EventType.BUTTON_RELEASE) {
            let wasActive = d.active;
            let x = e.get_coords()[0];
            this._dragEnd();
            if (wasActive) {
                this._dropAt(d.seg, x);
                return Clutter.EVENT_STOP;
            }
        }
        return Clutter.EVENT_PROPAGATE;
    }

    _dragTarget(seg, x) {
        let others = this.segs.filter((s) => s !== seg);
        let k = 0;
        for (let o of others) {
            let [ox] = o.box.get_transformed_position();
            if (x > ox + o.box.width / 2) k++;
        }
        return { others: others, k: k };
    }

    _dragMark(x) {
        let { others, k } = this._dragTarget(this._drag.seg, x);
        for (let i = 0; i < others.length; i++) {
            let edge = (i === k) ? "border-left: 2px solid rgba(255,255,255,0.9);" :
                (i === k - 1 && k === others.length) ? "border-right: 2px solid rgba(255,255,255,0.9);" : "";
            others[i].box.set_style("spacing: 6px; padding: 0 4px;" + edge);
        }
    }

    _dragEnd() {
        if (this._dragId) global.stage.disconnect(this._dragId);
        this._dragId = null;
        if (this._drag) {
            this._drag.seg.box.translation_x = 0;
            this._drag.seg.box.opacity = 255;
            for (let s of this.segs) s.box.set_style("spacing: 6px; padding: 0 4px;");
            global.unset_cursor();
        }
        this._drag = null;
    }

    _dropAt(seg, x) {
        let { others, k } = this._dragTarget(seg, x);
        let list = (this.widgets || []).map((w) => Object.assign({}, w));
        let from = seg.listIndex;
        if (from < 0 || from >= list.length) return;
        // anchor = list index of the widget we land before (or after, at the end)
        let anchor = k < others.length ? others[k].listIndex : others[others.length - 1].listIndex + 1;
        let [item] = list.splice(from, 1);
        if (anchor > from) anchor--;
        list.splice(anchor, 0, item);
        this.settings.setValue("widgets", list);
        this.widgets = list;
        this._queueRebuild();
    }

    _restartTimer() {
        if (this._timer) Mainloop.source_remove(this._timer);
        let ms = Math.max(250, this.refresh_ms || 1000);
        this._timer = Mainloop.timeout_add(ms, () => { this._tick(); return true; });
    }

    // ---- drawing -------------------------------------------------------------

    _alertColor(base, pct) {
        if (pct === null || pct === undefined) return base;
        if (pct >= this.hot_at) return parseColor(this.hot_color);
        if (pct >= this.warn_at) return parseColor(this.warn_color);
        return base;
    }

    _paint(cr, w, h, seg) {
        let d = seg.data || {};
        let c = this._alertColor(seg.color, d.pct);
        let track = parseColor(this.track_color);
        let dim = d.stale ? 0.45 : 1;
        cr.setLineCap(Cairo.LineCap.ROUND);
        cr.setLineJoin(Cairo.LineJoin.ROUND);

        if (seg.style === "ring") {
            let cx = w / 2, cy = h / 2, r = Math.min(w, h) / 2 - this.ring_width / 2 - 0.5;
            cr.setLineWidth(this.ring_width);
            cr.setSourceRGBA(track[0], track[1], track[2], track[3]);
            cr.arc(cx, cy, r, 0, 2 * Math.PI);
            cr.stroke();
            if (d.frac === null || d.frac === undefined) return;
            cr.setSourceRGBA(c[0], c[1], c[2], c[3] * dim);
            let f = Math.max(0.02, Math.min(1, d.frac));
            cr.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + f * 2 * Math.PI);
            cr.stroke();
        } else if (seg.style === "bar") {
            let bh = Math.max(3, this.ring_width + 1), y = (h - bh) / 2;
            this._roundRect(cr, 0, y, w, bh, bh / 2);
            cr.setSourceRGBA(track[0], track[1], track[2], track[3]);
            cr.fill();
            if (d.frac === null || d.frac === undefined) return;
            let f = Math.max(0, Math.min(1, d.frac));
            if (f <= 0) return;
            this._roundRect(cr, 0, y, Math.max(bh, w * f), bh, bh / 2);
            cr.setSourceRGBA(c[0], c[1], c[2], c[3] * dim);
            cr.fill();
        } else if (seg.style === "graph") {
            let pad = 2;
            cr.setSourceRGBA(track[0], track[1], track[2], track[3]);
            cr.rectangle(0, h - pad, w, 1);
            cr.fill();
            let pts = this.hist[seg.key] || [];
            if (pts.length < 2) return;
            let n = Math.max(2, this.graph_points);
            let max = d.scale100 ? 100 : Math.max(1e-9, ...pts);
            let step = w / (n - 1);
            let x0 = w - (pts.length - 1) * step;
            let y = (v) => h - pad - Math.max(0, Math.min(1, v / max)) * (h - 2 * pad);
            if (this.graph_fill) {
                cr.moveTo(x0, h - pad);
                for (let i = 0; i < pts.length; i++) cr.lineTo(x0 + i * step, y(pts[i]));
                cr.lineTo(w, h - pad);
                cr.closePath();
                let grad = new Cairo.LinearGradient(0, 0, 0, h);
                grad.addColorStopRGBA(0, c[0], c[1], c[2], 0.55);
                grad.addColorStopRGBA(1, c[0], c[1], c[2], 0.04);
                cr.setSource(grad);
                cr.fill();
            }
            cr.setLineWidth(1.5);
            cr.setSourceRGBA(c[0], c[1], c[2], c[3]);
            cr.moveTo(x0, y(pts[0]));
            for (let i = 1; i < pts.length; i++) cr.lineTo(x0 + i * step, y(pts[i]));
            cr.stroke();
        } else if (seg.style === "clock") {
            let cx = w / 2, cy = h / 2, r = Math.min(w, h) / 2 - 2;
            cr.setLineWidth(1.8);
            cr.setSourceRGBA(c[0], c[1], c[2], 0.85);
            cr.arc(cx, cy, r, 0, 2 * Math.PI);
            cr.stroke();
            let now = new Date();
            let ha = ((now.getHours() % 12) + now.getMinutes() / 60) / 12 * 2 * Math.PI - Math.PI / 2;
            let ma = now.getMinutes() / 60 * 2 * Math.PI - Math.PI / 2;
            cr.moveTo(cx, cy); cr.lineTo(cx + Math.cos(ha) * r * 0.5, cy + Math.sin(ha) * r * 0.5);
            cr.moveTo(cx, cy); cr.lineTo(cx + Math.cos(ma) * r * 0.78, cy + Math.sin(ma) * r * 0.78);
            cr.stroke();
        } else if (seg.style === "weather") {
            this._paintWeather(cr, w, h, d.icon || "cloud", d.isDay !== false, seg.color);
        }
    }

    _paintWeather(cr, w, h, kind, isDay, sunColor) {
        let s = Math.min(w / 1.2, h);
        let ox = (w - s * 1.2) / 2, oy = (h - s) / 2;
        let X = (v) => ox + v * s, Y = (v) => oy + v * s;
        let sun = sunColor, cloud = [0.93, 0.95, 1.0, 1];

        let drawSun = (cx, cy, r) => {
            if (isDay) {
                cr.setSourceRGBA(sun[0], sun[1], sun[2], 1);
                cr.arc(X(cx), Y(cy), r * s, 0, 2 * Math.PI);
                cr.fill();
                cr.setLineWidth(Math.max(1, s * 0.06));
                for (let i = 0; i < 8; i++) {
                    let a = i * Math.PI / 4;
                    cr.moveTo(X(cx) + Math.cos(a) * r * s * 1.45, Y(cy) + Math.sin(a) * r * s * 1.45);
                    cr.lineTo(X(cx) + Math.cos(a) * r * s * 1.85, Y(cy) + Math.sin(a) * r * s * 1.85);
                }
                cr.stroke();
            } else {
                // crescent moon
                cr.setSourceRGBA(0.95, 0.92, 0.75, 1);
                cr.arc(X(cx), Y(cy), r * s * 1.3, 0, 2 * Math.PI);
                cr.arcNegative(X(cx + r * 0.7), Y(cy - r * 0.45), r * s * 1.1, 2 * Math.PI, 0);
                cr.fill();
            }
        };
        let drawCloud = (cx, cy, k, col) => {
            cr.setSourceRGBA(col[0], col[1], col[2], col[3]);
            cr.newSubPath();
            cr.arc(X(cx - 0.22 * k), Y(cy + 0.04 * k), 0.17 * k * s, 0, 2 * Math.PI);
            cr.newSubPath();
            cr.arc(X(cx + 0.02 * k), Y(cy - 0.08 * k), 0.24 * k * s, 0, 2 * Math.PI);
            cr.newSubPath();
            cr.arc(X(cx + 0.26 * k), Y(cy + 0.05 * k), 0.16 * k * s, 0, 2 * Math.PI);
            cr.fill();
            this._roundRect(cr, X(cx - 0.39 * k), Y(cy + 0.02 * k), 0.81 * k * s, 0.19 * k * s, 0.09 * k * s);
            cr.fill();
        };

        cr.setLineCap(Cairo.LineCap.ROUND);
        if (kind === "clear") { drawSun(0.6, 0.5, 0.2); return; }
        if (kind === "partly") { drawSun(0.42, 0.36, 0.15); drawCloud(0.66, 0.6, 0.95, cloud); return; }
        let grey = kind === "storm" ? [0.70, 0.73, 0.82, 1] : cloud;
        drawCloud(0.6, kind === "cloud" || kind === "fog" ? 0.48 : 0.38, 1.05, grey);
        cr.setLineWidth(Math.max(1.2, s * 0.07));
        if (kind === "rain") {
            cr.setSourceRGBA(0.45, 0.75, 1, 1);
            for (let x of [0.38, 0.6, 0.82]) { cr.moveTo(X(x), Y(0.72)); cr.lineTo(X(x - 0.06), Y(0.92)); }
            cr.stroke();
        } else if (kind === "snow") {
            cr.setSourceRGBA(1, 1, 1, 1);
            for (let x of [0.38, 0.6, 0.82]) { cr.arc(X(x), Y(0.82), s * 0.045, 0, 2 * Math.PI); cr.fill(); }
        } else if (kind === "storm") {
            cr.setSourceRGBA(1, 0.84, 0.25, 1);
            cr.moveTo(X(0.64), Y(0.62)); cr.lineTo(X(0.52), Y(0.8)); cr.lineTo(X(0.62), Y(0.8)); cr.lineTo(X(0.54), Y(0.98));
            cr.stroke();
        } else if (kind === "fog") {
            cr.setSourceRGBA(0.85, 0.87, 0.92, 0.9);
            for (let y of [0.78, 0.92]) { cr.moveTo(X(0.25), Y(y)); cr.lineTo(X(0.95), Y(y)); }
            cr.stroke();
        }
    }

    _roundRect(cr, x, y, w, h, r) {
        cr.newSubPath();
        cr.arc(x + w - r, y + r, r, -Math.PI / 2, 0);
        cr.arc(x + w - r, y + h - r, r, 0, Math.PI / 2);
        cr.arc(x + r, y + h - r, r, Math.PI / 2, Math.PI);
        cr.arc(x + r, y + r, r, Math.PI, 1.5 * Math.PI);
        cr.closePath();
    }

    // ---- sampling ------------------------------------------------------------

    _tick() {
        try {
            this._now = GLib.get_monotonic_time() / 1e6;
            this._cache = {};
            let ws = this._widgets();
            if (ws.some((w) => ["gpu", "gpu_temp", "vram"].indexOf(w.type) >= 0)) this._pollNvidia();

            for (let seg of this.segs) {
                let d = this._read(seg.w) || { text: "n/a", pct: null, frac: null };
                seg.data = d;
                if (seg.style === "graph" && d.graph !== undefined && d.graph !== null) {
                    let hh = this.hist[seg.key] || (this.hist[seg.key] = []);
                    hh.push(d.graph);
                    while (hh.length > this.graph_points) hh.shift();
                }
                if (seg.val.get_text() !== d.text) seg.val.set_text(d.text);
                let style = this._valStyle;
                if (d.stale) style += "color: rgba(255,255,255,0.5);";
                else if (this.color_value_text && d.pct !== null && d.pct !== undefined && d.pct >= this.warn_at)
                    style += "color: " + cssColor(this._alertColor([1, 1, 1, 1], d.pct)) + ";";
                seg.val.set_style(style);
                if (seg.cap && d.cap && seg.cap.get_text() !== d.cap) seg.cap.set_text(d.cap);
                if (seg.area) seg.area.queue_repaint();
            }
            this._updateTooltip();
            if (this.menu.isOpen) this._refreshMenuDetails();
        } catch (e) {
            global.logError("pc-pulse tick: " + e + "\n" + e.stack);
        }
    }

    _rate(name, value) {
        // Per-second rate of a growing counter.
        let prev = this.st[name];
        this.st[name] = { v: value, t: this._now };
        if (!prev || this._now <= prev.t || value < prev.v) return null;
        return (value - prev.v) / (this._now - prev.t);
    }

    _meminfo() {
        if (this._cache.mem) return this._cache.mem;
        let t = readText("/proc/meminfo") || "";
        let get = (k) => { let m = t.match(new RegExp("^" + k + ":\\s+(\\d+)", "m")); return m ? Number(m[1]) * 1024 : 0; };
        return (this._cache.mem = {
            total: get("MemTotal"), avail: get("MemAvailable"),
            swapTotal: get("SwapTotal"), swapFree: get("SwapFree"),
        });
    }

    _cpu() {
        if (this._cache.cpu !== undefined) return this._cache.cpu;
        let line = (readText("/proc/stat") || "").split("\n")[0].trim().split(/\s+/).slice(1).map(Number);
        let idle = line[3] + (line[4] || 0);
        let total = line.reduce((a, b) => a + b, 0);
        let prev = this.st.cpu;
        this.st.cpu = { idle: idle, total: total };
        let pct = this._lastCpu === undefined ? null : this._lastCpu;
        if (prev && total > prev.total) pct = Math.round(100 * (1 - (idle - prev.idle) / (total - prev.total)));
        this._lastCpu = pct;
        return (this._cache.cpu = pct);
    }

    _gpuDev() {
        if (this._gpuDevChecked) return this._gpuDevPath;
        this._gpuDevChecked = true;
        this._gpuDevPath = null;
        for (let c of listDir("/sys/class/drm")) {
            if (!/^card\d+$/.test(c)) continue;
            let p = "/sys/class/drm/" + c + "/device";
            if (exists(p + "/gpu_busy_percent")) { this._gpuDevPath = p; break; }
        }
        return this._gpuDevPath;
    }

    _pollNvidia() {
        if (this._gpuDev()) return;
        if (this._nvidiaBin === undefined) this._nvidiaBin = GLib.find_program_in_path("nvidia-smi");
        if (!this._nvidiaBin || this._nvidiaBusy) return;
        if (this._nvidiaAt && this._now - this._nvidiaAt < 2) return;
        this._nvidiaBusy = true;
        this._nvidiaAt = this._now;
        this._spawn([this._nvidiaBin, "--query-gpu=utilization.gpu,temperature.gpu,memory.used,memory.total", "--format=csv,noheader,nounits"],
            (out) => {
                this._nvidiaBusy = false;
                let p = (out || "").split("\n")[0].split(",").map((x) => parseFloat(x));
                if (p.length >= 4 && !isNaN(p[0])) this.nvidia = { util: p[0], temp: p[1], used: p[2] * 1048576, total: p[3] * 1048576 };
            });
    }

    _claude() {
        if (this._cache.claude !== undefined) return this._cache.claude;
        let files = this.claude_file && this.claude_file.trim()
            ? [this.claude_file.trim().replace(/^~/, HOME)] : CLAUDE_AUTO_FILES;
        let res = null;
        for (let f of files) {
            let t = readText(f);
            if (!t) continue;
            try {
                let j = JSON.parse(t);
                res = { rl: j.rate_limits || j, saved: j.saved_at || null };
                break;
            } catch (e) { /* next */ }
        }
        return (this._cache.claude = res);
    }

    // Run argv asynchronously; cb(stdout, stderr). Never blocks the panel.
    _spawn(argv, cb) {
        try {
            Util.spawnCommandLineAsyncIO(null, (out, err) => cb(out || "", err || ""), { argv: argv });
        } catch (e) {
            cb("", String(e));
        }
    }

    _shell(cmd, cb) {
        this._spawn(["sh", "-c", cmd], cb || (() => {}));
    }

    _customOutput(cmd) {
        let c = this.custom[cmd] || (this.custom[cmd] = { out: null, at: 0, busy: false });
        if (!c.busy && (c.at === 0 || this._now - c.at >= Math.max(1, this.custom_every))) {
            c.busy = true;
            c.at = this._now;
            this._shell(cmd, (out, err) => {
                c.busy = false;
                let line = (out || err).split("\n").find((l) => l.trim()) || "";
                c.out = line.trim();
            });
        }
        return c.out;
    }

    _weatherFor(loc) {
        let c = this.weather[loc] || (this.weather[loc] = { data: null, at: 0, busy: false, err: null });
        let every = Math.max(5, this.weather_every) * 60;
        let retry = c.err ? 120 : every;
        if (!c.busy && (c.at === 0 || this._now - c.at >= retry)) {
            let m = loc.match(/^\s*(-?\d+(\.\d+)?)\s*,\s*(-?\d+(\.\d+)?)\s*$/);
            if (!m) { c.err = "Option must be latitude,longitude"; return c; }
            c.busy = true;
            c.at = this._now;
            let unit = this.weather_units === "fahrenheit" ? "&temperature_unit=fahrenheit&wind_speed_unit=mph" : "";
            let url = "https://api.open-meteo.com/v1/forecast?latitude=" + m[1] + "&longitude=" + m[3] +
                "&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,is_day" +
                "&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=1" + unit;
            this._spawn(["curl", "-s", "-m", "15", url], (out) => {
                c.busy = false;
                try {
                    let j = JSON.parse(out);
                    if (!j.current) throw new Error(j.reason || "no data");
                    c.data = j;
                    c.err = null;
                    c.got = Date.now() / 1000;
                } catch (e) {
                    c.err = "Weather fetch failed: " + e.message;
                }
            });
        }
        return c;
    }

    _upDevices() {
        if (!UPower) return null;
        if (this._cache.up) return this._cache.up;
        try {
            if (!this._upClient) this._upClient = UPower.Client.new();
            let devs = (this._upClient.get_devices() || []).filter((d) =>
                !d.power_supply && d.is_present !== false && d.kind !== 1 && d.kind !== 2 && d.model);
            return (this._cache.up = devs);
        } catch (e) {
            global.logError("pc-pulse upower: " + e);
            return (this._cache.up = []);
        }
    }

    _logiList() {
        // Exact % from Logitech HID++ devices (the kernel may only give a level).
        if (!this.logi_enabled) return [];
        let L = this.logi;
        let every = Math.max(1, this.logi_every) * 60;
        if (!L.busy && (L.at === 0 || this._now - L.at >= every)) {
            L.busy = true;
            L.at = this._now;
            this._spawn(["python3", this.metadata.path + "/logi_battery.py"], (out) => {
                L.busy = false;
                let got = null;
                try { got = JSON.parse(out.trim().split("\n").pop()); } catch (e) { /* keep last */ }
                if (got && got.length) L.list = got;
                else L.at = this._now - every + 30;   // nothing answered: try again in 30 s, keep last value
            });
        }
        return L.list || [];
    }

    _pctData(pct, text, detail) {
        return { pct: pct, frac: pct === null ? null : pct / 100, graph: pct, scale100: true, text: text, detail: detail };
    }

    _read(w) {
        let U = this.show_units;
        let pc = (v) => v === null || v === undefined ? "--" : v + (U ? "%" : "");
        switch (w.type) {
        case "cpu": {
            let p = this._cpu();
            return this._pctData(p, pc(p), "CPU " + pc(p) + " across " + GLib.get_num_processors() + " threads");
        }
        case "ram": {
            let m = this._meminfo();
            let used = m.total - m.avail;
            let p = m.total ? Math.round(100 * used / m.total) : null;
            return this._pctData(p, pc(p), "RAM " + fmtBytes(used, true) + " of " + fmtBytes(m.total, true) + " used");
        }
        case "swap": {
            let m = this._meminfo();
            if (!m.swapTotal) return { pct: null, frac: null, text: U ? "off" : "--", detail: "No swap" };
            let used = m.swapTotal - m.swapFree;
            let p = Math.round(100 * used / m.swapTotal);
            return this._pctData(p, pc(p), "Swap " + fmtBytes(used, true) + " of " + fmtBytes(m.swapTotal, true) + " used");
        }
        case "load": {
            let l = (readText("/proc/loadavg") || "0 0 0").split(" ").map(Number);
            let n = GLib.get_num_processors();
            let p = Math.round(100 * l[0] / n);
            return { pct: p, frac: Math.min(1, l[0] / n), graph: l[0], text: l[0].toFixed(2),
                detail: "Load " + l.slice(0, 3).map((x) => x.toFixed(2)).join(" / ") + " (1/5/15 min, " + n + " threads)" };
        }
        case "uptime": {
            let s = parseFloat((readText("/proc/uptime") || "0").split(" ")[0]);
            let boot = GLib.DateTime.new_now_local().add_seconds(-s);
            return { pct: null, frac: null, text: fmtDuration(s), detail: "Up " + fmtDuration(s) + ", since " + boot.format("%a %d %b %H:%M") };
        }
        case "gpu": {
            let dev = this._gpuDev();
            let raw = null;
            if (dev) raw = parseInt(readText(dev + "/gpu_busy_percent"), 10);
            else if (this.nvidia) raw = this.nvidia.util;
            if (raw === null || isNaN(raw)) return { pct: null, frac: null, text: "n/a", detail: "No GPU busy counter (AMD sysfs or nvidia-smi) found" };
            this.gpuHist.push(Math.max(0, Math.min(100, raw)));
            while (this.gpuHist.length > Math.max(1, this.smooth_samples)) this.gpuHist.shift();
            let p = Math.round(this.gpuHist.reduce((a, b) => a + b, 0) / this.gpuHist.length);
            return this._pctData(p, pc(p), "GPU " + pc(p) + " (mean of " + this.gpuHist.length + " readings, last " + raw + "%)");
        }
        case "vram": {
            let dev = this._gpuDev();
            let used = null, total = null;
            if (dev && exists(dev + "/mem_info_vram_used")) {
                used = Number(readText(dev + "/mem_info_vram_used"));
                total = Number(readText(dev + "/mem_info_vram_total"));
            } else if (this.nvidia) { used = this.nvidia.used; total = this.nvidia.total; }
            if (!total) return { pct: null, frac: null, text: "n/a", detail: "No VRAM counter found" };
            let p = Math.round(100 * used / total);
            return this._pctData(p, pc(p), "VRAM " + fmtBytes(used, true) + " of " + fmtBytes(total, true));
        }
        case "cpu_temp":
        case "gpu_temp": {
            let names = w.arg && w.arg.trim() ? [w.arg.trim()]
                : (w.type === "cpu_temp" ? ["k10temp", "coretemp", "zenpower", "cpu_thermal", "acpitz"] : ["amdgpu", "nouveau", "radeon", "i915", "xe"]);
            let ck = "hw|" + names.join(",");
            if (this.st[ck] === undefined) this.st[ck] = findHwmon(names);
            let t = null;
            if (this.st[ck]) t = Number(readText(this.st[ck])) / 1000;
            else if (w.type === "gpu_temp" && this.nvidia) t = this.nvidia.temp;
            if (t === null || isNaN(t)) return { pct: null, frac: null, text: "n/a", detail: "No " + names.join("/") + " sensor" };
            let r = Math.round(t);
            return { pct: r, frac: Math.min(1, t / 100), graph: t, scale100: true, text: r + (U ? "°C" : "°"),
                detail: (w.type === "cpu_temp" ? "CPU " : "GPU ") + t.toFixed(1) + " °C" };
        }
        case "disk": {
            let path = (w.arg && w.arg.trim()) || "/";
            let ck = "disk|" + path;
            let c = this.st[ck];
            if (!c || this._now - c.at > 10) {
                try {
                    let info = Gio.File.new_for_path(path).query_filesystem_info("filesystem::size,filesystem::free", null);
                    c = this.st[ck] = { size: info.get_attribute_uint64("filesystem::size"), free: info.get_attribute_uint64("filesystem::free"), at: this._now };
                } catch (e) {
                    return { pct: null, frac: null, text: "n/a", detail: "Cannot read " + path };
                }
            }
            let used = c.size - c.free;
            let p = c.size ? Math.round(100 * used / c.size) : null;
            return this._pctData(p, pc(p), "Disk " + path + ": " + fmtBytes(c.free, true) + " free of " + fmtBytes(c.size, true));
        }
        case "disk_io": {
            if (this._cache.io === undefined) {
                let sum = 0;
                for (let line of (readText("/proc/diskstats") || "").split("\n")) {
                    let f = line.trim().split(/\s+/);
                    if (f.length < 10 || /^(loop|ram|zram|dm-|md)/.test(f[2]) || !exists("/sys/block/" + f[2])) continue;
                    sum += Number(f[5]) + Number(f[9]);
                }
                this._cache.io = this._rate("io", sum * 512);
            }
            let r = this._cache.io;
            return { pct: null, frac: null, graph: r || 0, text: r === null ? "--" : fmtRate(r, U), detail: "Disk read + write " + (r === null ? "--" : fmtRate(r, true)) };
        }
        case "net_down":
        case "net_up": {
            let iface = (w.arg && w.arg.trim()) || "";
            let ck = "net|" + iface;
            if (this._cache[ck] === undefined) {
                let rx = 0, tx = 0;
                for (let line of (readText("/proc/net/dev") || "").split("\n").slice(2)) {
                    let parts = line.split(":");
                    if (parts.length < 2) continue;
                    let name = parts[0].trim();
                    if (iface ? name !== iface : (name === "lo" || /^(veth|docker|br-|virbr)/.test(name))) continue;
                    let f = parts[1].trim().split(/\s+/).map(Number);
                    rx += f[0]; tx += f[8];
                }
                this._cache[ck] = { rx: this._rate(ck + "rx", rx), tx: this._rate(ck + "tx", tx) };
            }
            let r = w.type === "net_down" ? this._cache[ck].rx : this._cache[ck].tx;
            return { pct: null, frac: null, graph: r || 0, text: r === null ? "--" : fmtRate(r, U),
                detail: (w.type === "net_down" ? "Download " : "Upload ") + (r === null ? "--" : fmtRate(r, true)) + (iface ? " on " + iface : " (all interfaces)") };
        }
        case "battery": {
            let name = (w.arg && w.arg.trim()) || null;
            if (!name) {
                let all = listDir("/sys/class/power_supply").filter((n) => (readText("/sys/class/power_supply/" + n + "/type") || "").trim() === "Battery");
                name = all.find((n) => /^BAT/.test(n)) || all[0];
            }
            if (!name) return { pct: null, frac: null, text: "n/a", detail: "No battery found" };
            let base = "/sys/class/power_supply/" + name;
            let cap = readText(base + "/capacity");
            let p = cap !== null ? parseInt(cap, 10) : BATTERY_LEVELS[(readText(base + "/capacity_level") || "").trim()];
            let status = (readText(base + "/status") || "").trim();
            let model = (readText(base + "/model_name") || name).trim();
            if (p === undefined || p === null || isNaN(p)) return { pct: null, frac: null, text: "?", detail: model + ": " + status };
            // Alerts run the other way for batteries: low is bad.
            let alert = p <= 10 ? this.hot_at : (p <= 20 ? this.warn_at : 0);
            return { pct: alert, frac: p / 100, graph: p, scale100: true,
                text: (cap === null ? "~" : "") + p + (U ? "%" : "") + (status === "Charging" ? "+" : ""),
                detail: model + ": " + p + "% " + (cap === null ? "(level only) " : "") + status.toLowerCase() };
        }
        case "device_bat": {
            let devs = this._upDevices() || [];
            let logi = this._logiList();
            let want = (w.arg || "").trim().toLowerCase();
            let match = (name) => !want || (name || "").toLowerCase().indexOf(want) >= 0;
            let d = devs.find((x) => match(x.model) || (want && (x.native_path || "").toLowerCase().indexOf(want) >= 0));
            let lg = logi.find((x) => d ? (x.name || "").toLowerCase() === (d.model || "").toLowerCase() : match(x.name));
            if (!d && !lg) return { pct: null, frac: null, text: "off", cap: want ? want.toUpperCase().substr(0, 10) : "DEVICE",
                detail: (want ? "\"" + w.arg + "\" not connected" : "No wireless device batteries found") +
                    (devs.length ? ". Seen: " + devs.map((x) => x.model).join(", ") : "") };
            let kind = d ? (UP_KINDS[d.kind] || "DEVICE") : "DEVICE";
            let model = d ? d.model : lg.name;
            let p, text, charging, how;
            if (lg && lg.percent) {
                p = lg.percent; text = p + (U ? "%" : ""); charging = lg.charging; how = "read from the device (HID++ " + lg.source + ")";
            } else {
                let lvl = UP_LEVELS[d.battery_level];
                p = lvl ? lvl[0] : Math.round(d.percentage);
                text = lvl ? lvl[1] : p + (U ? "%" : "");
                charging = d.state === 1;
                how = lvl ? "level " + lvl[1].toLowerCase() + " only (device reports no exact %)" : "via UPower";
            }
            let alert = p <= 10 ? this.hot_at : (p <= 20 ? this.warn_at : 0);
            return { pct: alert, frac: p / 100, graph: p, scale100: true, text: text + (charging ? "+" : ""),
                cap: w.label && w.label.trim() ? null : kind,
                detail: model + ": " + p + "%" + (charging ? ", charging" : "") + ", " + how };
        }
        case "clock": {
            let now = GLib.DateTime.new_now_local();
            let fmt = (w.arg && w.arg.trim()) || "%H:%M";
            return { pct: null, frac: null, text: now.format(fmt) || "?", detail: now.format("%A %d %B %Y, %H:%M:%S") };
        }
        case "custom": {
            let cmd = (w.arg || "").trim();
            if (!cmd) return { pct: null, frac: null, text: "set cmd", detail: "Put a shell command in the Option column" };
            let out = this._customOutput(cmd);
            if (out === null) return { pct: null, frac: null, text: "…", detail: cmd };
            let num = /^-?\d+(\.\d+)?%?$/.test(out) ? parseFloat(out) : null;
            if (num !== null && num >= 0 && num <= 100)
                return { pct: num, frac: num / 100, graph: num, scale100: true, text: out, detail: cmd + " = " + out };
            return { pct: null, frac: null, graph: num, text: out.length > 24 ? out.substr(0, 23) + "…" : out, detail: cmd + " = " + out };
        }
        case "weather": {
            let loc = (w.arg || "").trim();
            if (!loc) return { pct: null, frac: null, text: "set loc", icon: "cloud", detail: "Put latitude,longitude in the Option column (for example 51.51,-0.13)" };
            let c = this._weatherFor(loc);
            if (!c.data) return { pct: null, frac: null, text: c.err ? "n/a" : "…", icon: "cloud", detail: c.err || "Fetching weather" };
            let cur = c.data.current, day = c.data.daily || {};
            let u = (c.data.current_units || {}).temperature_2m || "°";
            let wmo = WMO[cur.weather_code] || ["Code " + cur.weather_code, "cloud"];
            let t = Math.round(cur.temperature_2m);
            let hi = day.temperature_2m_max ? Math.round(day.temperature_2m_max[0]) : null;
            let lo = day.temperature_2m_min ? Math.round(day.temperature_2m_min[0]) : null;
            let rain = day.precipitation_probability_max ? day.precipitation_probability_max[0] : null;
            let capTxt = { condition: wmo[0].toUpperCase(), feels: "FEELS " + Math.round(cur.apparent_temperature) + "°",
                range: hi !== null ? lo + "° / " + hi + "°" : null }[this.weather_caption] || null;
            if (w.label && w.label.trim()) capTxt = null;
            return { pct: null, frac: null, icon: wmo[1], isDay: cur.is_day !== 0, cap: capTxt,
                text: t + (U ? u.replace(/\s/g, "") : "°"),
                detail: wmo[0] + ", " + cur.temperature_2m + " " + u + " (feels " + cur.apparent_temperature + ")" +
                    (hi !== null ? ", today " + lo + " to " + hi : "") + (rain !== null ? ", rain " + rain + "%" : "") +
                    ", humidity " + cur.relative_humidity_2m + "%, wind " + Math.round(cur.wind_speed_10m) + " " + ((c.data.current_units || {}).wind_speed_10m || "") +
                    (c.err ? " (last update failed)" : "") };
        }
        case "claude_week":
        case "claude_5h": {
            let c = this._claude();
            let win = c && c.rl ? c.rl[w.type === "claude_week" ? "seven_day" : "five_hour"] : null;
            if (!win || win.used_percentage === undefined)
                return { pct: null, frac: null, text: "--", detail: "No Claude limit data yet. It appears after a Claude Code reply, written by the status line script." };
            let nowS = Date.now() / 1000;
            let rolled = win.resets_at && win.resets_at < nowS;
            let age = c.saved ? nowS - c.saved : null;
            let stale = rolled || (age !== null && age > this.claude_stale_hours * 3600);
            let p = rolled ? 0 : Math.round(win.used_percentage);
            let left = win.resets_at && !rolled ? fmtDuration(win.resets_at - nowS) : null;
            let capTxt = null;
            if (this.claude_show_reset && left && !(w.label && w.label.trim()))
                capTxt = (w.type === "claude_week" ? "CLAUDE · " : "5H · ") + left.split(" ")[0];
            let d = this._pctData(p, pc(p), (w.type === "claude_week" ? "Claude weekly limit " : "Claude 5 hour limit ") + p + "% used" +
                (left ? ", resets in " + left : rolled ? ", window has reset" : "") +
                (age !== null ? " (reading " + fmtDuration(age) + " old" + (stale ? ", stale" : "") + ")" : ""));
            d.stale = stale;
            d.cap = capTxt;
            return d;
        }
        }
        return null;
    }

    _updateTooltip() {
        let lines = this.segs.map((s) => s.data && s.data.detail ? s.data.detail : null).filter(Boolean);
        let what = { menu: "menu", stats: "Claude stats page", sysmon: "system monitor", settings: "settings", custom: "custom command" }[this.left_click] || "menu";
        lines.push(_("Click: %s. Right click > Configure to customise.").format(_(what)));
        this.set_applet_tooltip(lines.join("\n"));
    }

    // ---- menu ----------------------------------------------------------------

    _addContextItems() {
        let item = new PopupMenu.PopupIconMenuItem(_("Customise widgets…"), "preferences-system", St.IconType.SYMBOLIC);
        item.connect("activate", () => this.configureApplet(0));
        this._applet_context_menu.addMenuItem(item);
    }

    _buildMenu() {
        this.menu.removeAll();
        this._menuRows = [];
        let title = new PopupMenu.PopupMenuItem(_("PC Pulse"), { reactive: false });
        title.label.set_style("font-weight: bold;");
        this.menu.addMenuItem(title);

        if (this.menu_details) {
            for (let seg of this.segs) {
                let row = new PopupMenu.PopupMenuItem(TYPES[seg.w.type].name, { reactive: false });
                let val = new St.Label({ text: "" });
                row.addActor(val, { align: St.Align.END });
                this.menu.addMenuItem(row);
                this._menuRows.push({ seg: seg, val: val });
            }
            this._refreshMenuDetails();
        }

        if (this.menu_toggles) {
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            let sub = new PopupMenu.PopupSubMenuMenuItem("Show or hide widgets");
            this.menu.addMenuItem(sub);
            (this.widgets || []).forEach((w, i) => {
                if (!w || !TYPES[w.type]) return;
                let label = TYPES[w.type].name + (w.label ? " (" + w.label + ")" : "") +
                    (w.arg && ["custom", "weather"].indexOf(w.type) < 0 ? " · " + w.arg : "");
                let sw = new PopupMenu.PopupSwitchMenuItem(label, !!w.enabled);
                sw.connect("toggled", (item, state) => this._setEnabled(i, state));
                sub.menu.addMenuItem(sw);
            });
        }

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        let add = (label, icon, fn) => {
            let it = new PopupMenu.PopupIconMenuItem(label, icon, St.IconType.SYMBOLIC);
            it.connect("activate", fn);
            this.menu.addMenuItem(it);
        };
        add(_("Edit, add and reorder widgets…"), "list-add", () => this.configureApplet(0));
        add(_("Glass, colours and text…"), "preferences-desktop-theme", () => this.configureApplet(1));
        if (this.stats_cmd && this.stats_cmd.trim())
            add(_("Claude stats page"), "x-office-spreadsheet", () => this._run("stats"));
        add(_("System monitor"), "utilities-system-monitor", () => this._run("sysmon"));
    }

    _refreshMenuDetails() {
        for (let r of this._menuRows || []) {
            let d = r.seg.data || {};
            r.val.set_text(d.detail || d.text || "");
        }
    }

    _setEnabled(index, state) {
        let list = (this.widgets || []).map((w) => Object.assign({}, w));
        if (!list[index]) return;
        list[index].enabled = state;
        this.settings.setValue("widgets", list);
        this.widgets = list;
        this._queueRebuild();
    }

    // ---- clicks --------------------------------------------------------------

    _run(action) {
        try {
            if (action === "menu") this.menu.toggle();
            else if (action === "stats") { if (this.stats_cmd.trim()) this._shell(this.stats_cmd.replace(/(^|\s)~\//g, "$1" + HOME + "/")); }
            else if (action === "sysmon") this._spawn(["gnome-system-monitor"], () => {});
            else if (action === "settings") this.configureApplet(0);
            else if (action === "custom") this._shell(this.custom_click_cmd);
        } catch (e) {
            global.logError(e);
        }
    }

    on_applet_clicked() {
        if (this.menu.isOpen && this.left_click !== "menu") this.menu.close();
        this._run(this.left_click);
    }

    on_applet_middle_clicked() {
        if (this.middle_click !== "none") this._run(this.middle_click);
    }

    on_panel_height_changed() {
        this._queueRebuild();
    }

    on_applet_removed_from_panel() {
        if (this._timer) Mainloop.source_remove(this._timer);
        if (this._rebuildId) Mainloop.source_remove(this._rebuildId);
        this._timer = null;
        this._rebuildId = null;
        this.settings.finalize();
    }
}

function main(metadata, orientation, panelHeight, instanceId) {
    return new PcPulse(metadata, orientation, panelHeight, instanceId);
}
