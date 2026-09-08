/*
 * Kapszula - Cinnamon panel monitor.
 *
 * This file is the RULE layer described in SPEC.md section 7:
 *   providers.js = data, capsule.js = picture, applet.js = rules.
 *
 * Responsibilities kept here and nowhere else:
 *   - reading and binding the settings (Settings.AppletSettings)
 *   - driving the three sampling cycles (fast / gpu / disk)
 *   - deciding what counts as an alert (thresholds, rolling averages)
 *   - formatting numbers for the capsule and building the tooltip
 *   - click handling and lifecycle / timer cleanup
 *
 * Identifiers and comments are English, user visible strings are Hungarian.
 */

const Applet   = imports.ui.applet;
const Settings = imports.ui.settings;
const Mainloop = imports.mainloop;
const St       = imports.gi.St;
const Clutter  = imports.gi.Clutter;
const Util     = imports.misc.util;

const UUID = "capsule-monitor@gaborkis11";

// GTop is optional at load time. The applet must degrade into a readable error
// state when gir1.2-gtop-2.0 is not installed, never throw during construction.
let GTop = null;
try {
    GTop = imports.gi.GTop;
} catch (e) {
    GTop = null;
}

// SPEC 5.1: the two display modes of an element that has byte data behind it.
// Not to be confused with ELEMENTS[].kind, which says where the value comes
// from; the mode only says how the number in the cell is written.
const MODE_PCT = "pct";
const MODE_ABS = "abs";

/*
 * SPEC 5 + SPEC 10: this table is the CATALOGUE - what the applet is able to
 * display at all, with its source kind, threshold key, tooltip label and unit.
 * It is deliberately NOT the display order any more: order and visibility come
 * from the "elements" list setting (SPEC 9) and belong to the user.
 *
 * The order written here is only the documented default order, used when no
 * list has been stored yet, and the order in which elements unknown to a stored
 * list get appended (hidden) so that a future element can still be found.
 *
 * modeKey / absFrom (SPEC 5.1): the four elements the provider backs with a
 * byte figure can show the used amount instead of the percentage. absFrom says
 * in which unit that figure arrives - SPEC 7.1 gives gpu in MiB and the rest in
 * bytes. cpu, gfx, tmp and net have no mode: for them it would be meaningless.
 */
const ELEMENTS = [
    { id: "mem", thKey: "th_mem", kind: "pct",     unit: "%", tipLabel: "Memória",      modeKey: "mode_mem", absFrom: "bytes" },
    { id: "cpu", thKey: "th_cpu", kind: "pct",     unit: "%", tipLabel: "Processzor",   sustained: true },
    { id: "gpu", thKey: "th_gpu", kind: "pct",     unit: "%", tipLabel: "Videómemória", modeKey: "mode_gpu", absFrom: "mib" },
    { id: "ssd", thKey: "th_ssd", kind: "pct",     unit: "%", tipLabel: "Lemez",        modeKey: "mode_ssd", absFrom: "bytes" },
    { id: "net", thKey: null,     kind: "net",     unit: "",  tipLabel: "Hálózat" },
    { id: "swp", thKey: "th_swp", kind: "pct",     unit: "%", tipLabel: "Swap",         modeKey: "mode_swp", absFrom: "bytes" },
    { id: "gfx", thKey: "th_gfx", kind: "pct",     unit: "%", tipLabel: "GPU terhelés" },
    { id: "tmp", thKey: "th_tmp", kind: "celsius", unit: "°", tipLabel: "Hőmérséklet",  sustained: true }
];

// id -> catalogue row, so a stored list can be resolved without a linear scan
// on every refresh.
const ELEMENT_BY_ID = (function() {
    let map = {};
    for (let i = 0; i < ELEMENTS.length; i++)
        map[ELEMENTS[i].id] = ELEMENTS[i];
    return map;
})();

// Documented defaults from SPEC 9. Used only as a fallback when a key is absent
// from settings-schema.json, so a partially written schema cannot break startup.
const DEFAULTS = {
    // SPEC 5: mem, cpu, gpu, ssd, net on; swp, gfx, tmp off - in this order.
    elements: [
        { id: "mem", show: true },  { id: "cpu", show: true },
        { id: "gpu", show: true },  { id: "ssd", show: true },
        { id: "net", show: true },  { id: "swp", show: false },
        { id: "gfx", show: false }, { id: "tmp", show: false }
    ],
    show_labels: true, fixed_width: false, fixed_width_px: 200,
    // SPEC 5.1 / 9: percentage or the used amount, per element. Percentage is
    // the default everywhere; see _elementMode() for how a bad value is read.
    mode_mem: MODE_PCT, mode_swp: MODE_PCT,
    mode_gpu: MODE_PCT, mode_ssd: MODE_PCT,
    net_color_up: "#E5484D", net_color_down: "#46A758",
    click_command: "gnome-system-monitor",
    disk_mount: "/",
    th_mem: 85, th_cpu: 90, th_gpu: 90, th_ssd: 80,
    th_swp: 50, th_gfx: 100, th_tmp: 85,
    // One value for both sustained elements (cpu and tmp); 0 disables the
    // sustain check and the instant value decides.
    cpu_sustain_sec: 10,
    refresh_fast_ms: 1000,
    refresh_gpu_ms: 5000
};

// SPEC 6.1: disk fullness changes slowly, so the 60 s cycle is deliberately
// not a setting. Hard wired constant, no schema key exists for it.
const DISK_INTERVAL_MS = 60000;

const TIMER_NAMES = ["fast", "gpu", "disk", "layout"];

// SPEC 7.3
const CAPSULE_HEIGHT_MIN = 22;
const CAPSULE_HEIGHT_MAX = 34;
const CAPSULE_HEIGHT_PAD = 8;
const LABEL_MIN_HEIGHT   = 28;

// SPEC 6.2: twenty one second buckets per direction, freshest one last.
const NET_BARS = 20;
const KIB = 1024;
const MIB = 1024 * 1024;
const GIB = 1024 * 1024 * 1024;
const TIB = 1024 * GIB;

// SPEC 5.1: the unit letters of the absolute mode, shown in the same faint 8 px
// slot as the "%" and the "°".
const UNIT_GIB = "G";
const UNIT_TIB = "T";

// Tooltip column geometry (characters, rendered in a monospace block).
const TIP_LABEL_COLS = 16;
const TIP_VALUE_COLS = 3;
const TIP_MOUNT_COLS = 14;

const EM_DASH = "—";
const ARROW_DOWN = "↓";
const ARROW_UP = "↑";

function clamp(value, low, high) {
    return value < low ? low : (value > high ? high : value);
}

// Returns a finite number or null. Every provider field is "number or null"
// per SPEC 7.1, but a defensive conversion keeps a broken provider from
// propagating NaN into the display.
function toNumber(value) {
    if (typeof value !== "number" || !isFinite(value))
        return null;
    return value;
}

function padRight(text, cols) {
    let s = String(text);
    while (s.length < cols)
        s += " ";
    return s;
}

function padLeft(text, cols) {
    let s = String(text);
    while (s.length < cols)
        s = " " + s;
    return s;
}

// Pango markup escaping for anything that comes from the system (mount paths).
function escapeMarkup(text) {
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

// Hungarian decimal separator.
function huNumber(value, decimals) {
    return value.toFixed(decimals).replace(".", ",");
}

// DEFAULTS holds one array value ("elements"). Handing the shared array itself
// out as a fallback would let a later edit rewrite the documented default, so
// list defaults are copied on the way out.
function cloneDefault(value) {
    if (!Array.isArray(value))
        return value;
    return value.map(function(row) {
        return (row && typeof row === "object") ? { id: row.id, show: row.show } : row;
    });
}

// The list widget stores real booleans, but a hand edited or older config file
// can hold "true" / 1 just as well; anything else counts as off.
function toBool(value) {
    if (typeof value === "boolean")
        return value;
    if (typeof value === "number")
        return value !== 0;
    if (typeof value === "string")
        return value === "true" || value === "1";
    return false;
}

/*
 * SPEC 10: bytes per second -> at most four characters plus a one letter unit,
 * with a Hungarian decimal comma. "0,3" "12,4" "999" "1,2".
 *
 * The unit is chosen so the number always stays below 1024, which is what caps
 * the text at four characters: k below 1 MB/s, M below 1 GB/s, G above it.
 * Under 100 the value carries one decimal, above it the decimal would not fit
 * and would not say anything either at that speed.
 */
function netSpeed(bps) {
    let value = toNumber(bps);
    if (value === null || value < 0)
        return { text: EM_DASH, unit: "" };

    let unit = "k";
    let scaled = value / KIB;
    if (value >= GIB) {
        unit = "G";
        scaled = value / GIB;
    } else if (value >= MIB) {
        unit = "M";
        scaled = value / MIB;
    }

    let text;
    if (scaled < 0.05)
        text = "0";                       // idle, without a meaningless "0,0"
    else if (scaled >= 99.95)
        text = String(Math.round(scaled)); // 100 .. 1023
    else
        text = huNumber(scaled, 1);        // 0,1 .. 99,9

    return { text: text, unit: unit };
}

/*
 * SPEC 5.1: the used amount of an element, for the absolute display mode.
 * Bytes in, "12,8" + "G" / "468" + "G" / "1,5" + "T" out, Hungarian decimal
 * comma - the same comma the network numbers use.
 *
 * Binary gigabytes, like _formatSizePair() and like every Linux disk and VRAM
 * tool. One decimal below 100, none above it, and terabytes above 1000 GB.
 *
 * An empty element reads "0", not "0,0" - the same exception netSpeed() makes
 * for an idle link. This is not a corner case: the swap cell sits at zero most
 * of the time, so "0" is what that cell shows the user most of the day, and it
 * is quieter than "0,0". Consistency across the capsule beats consistency
 * inside one formatter.
 *
 * The number is at most four characters, so with the unit letter the widest
 * result is "31,8G" = 29,5 px measured with Ubuntu 10 - which is what the 32 px
 * cell is cut for. Both boundaries are therefore tested on the ROUNDED value,
 * not the raw one: 99,97 GB must not become the five character "100,0", and
 * 999,7 GB must not become the five character "1000". A value that would round
 * up crosses the boundary instead.
 *
 * Returns { text, unit } with an empty unit when there is no figure to show;
 * that empty unit is what the caller reads as "fall back to the percentage".
 */
function absSize(bytes) {
    let value = toNumber(bytes);
    if (value === null || value < 0)
        return { text: EM_DASH, unit: "" };

    let unit = UNIT_GIB;
    let scaled = value / GIB;
    if (scaled >= 999.5) {
        unit = UNIT_TIB;
        scaled = value / TIB;
    }

    let text;
    if (scaled < 0.05)
        text = "0";                         // empty, without a noisy "0,0"
    else if (scaled >= 99.95)
        text = String(Math.round(scaled));  // 100 .. 999
    else
        text = huNumber(scaled, 1);         // 0,1 .. 99,9

    return { text: text, unit: unit };
}

/*
 * The capsule wants "#RRGGBB" (SPEC 7.2), but Cinnamon's colorchooser writes
 * back whatever Gdk.RGBA.to_string() produced, which is "rgb(229,72,77)" or
 * "rgba(229,72,77,1)". The schema default is already hex, so both shapes turn
 * up in the same key and normalising them is a rule layer job.
 */
function normalizeColor(value, fallback) {
    let text = String(value === undefined || value === null ? "" : value).trim();

    let hex = text.match(/^#([0-9a-fA-F]{6})$/);
    if (hex)
        return "#" + hex[1].toUpperCase();

    let short = text.match(/^#([0-9a-fA-F]{3})$/);
    if (short) {
        let d = short[1];
        return ("#" + d[0] + d[0] + d[1] + d[1] + d[2] + d[2]).toUpperCase();
    }

    let rgb = text.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,[^)]*)?\)$/);
    if (rgb) {
        let out = "#";
        for (let i = 1; i <= 3; i++) {
            let channel = clamp(parseInt(rgb[i], 10), 0, 255);
            out += (channel < 16 ? "0" : "") + channel.toString(16);
        }
        return out.toUpperCase();
    }

    return fallback;
}

function MyApplet(metadata, orientation, panel_height, instance_id) {
    this._init(metadata, orientation, panel_height, instance_id);
}

MyApplet.prototype = {
    __proto__: Applet.Applet.prototype,

    _init: function(metadata, orientation, panel_height, instance_id) {
        Applet.Applet.prototype._init.call(this, orientation, panel_height, instance_id);

        this._destroyed = false;
        this._errorMode = false;
        // NOTE: never assign to "_panelHeight" - Applet.Applet declares it as a
        // getter-only accessor (returns this.panel.height), so an assignment
        // throws in the constructor and the applet fails to load. Our own seed
        // value lives under a distinct name; see _currentPanelHeight().
        this._panelHeightPx = panel_height;
        this._logged = {};
        this._timers = { fast: 0, gpu: 0, disk: 0, layout: 0 };

        this._sampler = null;
        this._capsule = null;
        this._SamplerCtor = null;
        this._CapsuleCtor = null;

        this._values = {};
        this._mounts = [];
        this._nvidiaEnabled = null;
        this._labelsForcedOff = false;
        this._elementsSynced = false;

        // Rolling windows for the sustained elements (cpu, tmp). See _sustained().
        this._rings = { cpu: [], tmp: [] };

        try {
            this._setupTooltip();

            if (!GTop) {
                this._enterErrorMode(
                    "A Kapszula nem tud elindulni.\n\n" +
                    "A GTop (libgtop GObject introspection) nem érhető el.\n" +
                    "Linux Mint / Ubuntu: sudo apt install gir1.2-gtop-2.0\n" +
                    "Fedora: sudo dnf install libgtop2\n\n" +
                    "A telepítés után töltse újra a Cinnamont.");
                return;
            }

            let moduleError = this._loadModules();
            if (moduleError) {
                this._enterErrorMode(moduleError);
                return;
            }

            this._setupSettings();

            this._sampler = new this._SamplerCtor();
            this._applyDiskMount();

            this._buildCapsule();
            this._applyLayout();

            // Prime the caches so the panel is not blank for a whole cycle.
            this._tickDisk();
            this._tickFast();

            this._startFastTimer();
            this._startGpuTimer();
            this._startDiskTimer();

            // Last, so a write back cannot disturb the first paint: it only
            // repairs what the settings dialog will show (see the method).
            this._syncElementsSetting();
        } catch (e) {
            global.logError(UUID + ": inicializálás: " + e);
            this._enterErrorMode("A Kapszula indítása hibába futott:\n" + e);
        }
    },

    // ---------------------------------------------------------------- modules

    _loadModules: function() {
        let dir;
        try {
            dir = imports.ui.appletManager.applets[UUID];
        } catch (e) {
            return "A Kapszula moduljai nem tölthetők be:\n" + e;
        }
        if (!dir)
            return "A Kapszula moduljai nem tölthetők be.";

        try {
            if (!dir.providers || !dir.providers.Sampler)
                return "A providers.js modul hiányzik vagy nem ad Sampler konstruktort.";
            this._SamplerCtor = dir.providers.Sampler;
        } catch (e) {
            return "A providers.js modul hibába futott:\n" + e;
        }

        try {
            if (!dir.capsule || !dir.capsule.Capsule)
                return "A capsule.js modul hiányzik vagy nem ad Capsule konstruktort.";
            this._CapsuleCtor = dir.capsule.Capsule;
        } catch (e) {
            return "A capsule.js modul hibába futott:\n" + e;
        }

        return null;
    },

    // --------------------------------------------------------------- settings

    _setupSettings: function() {
        try {
            this.settings = new Settings.AppletSettings(this, UUID, this.instance_id);
        } catch (e) {
            global.logError(UUID + ": a beállítások nem hozhatók létre: " + e);
            this.settings = null;
        }

        // Layout affecting keys trigger a (debounced) full capsule rebuild.
        // SPEC 9: order and visibility now live in one list key, not in eight
        // checkboxes, so reordering is a layout change like any other.
        this._bindSetting("elements",       this._onLayoutSettingChanged);
        this._bindSetting("show_labels",    this._onLayoutSettingChanged);
        this._bindSetting("fixed_width",    this._onLayoutSettingChanged);
        this._bindSetting("fixed_width_px", this._onLayoutSettingChanged);
        // SPEC 5.1: switching an element to the absolute mode widens its cell
        // from 30 to 32 px, so the mode is a layout change like any other. It
        // goes through the same 120 ms coalescing, and setLayout() therefore
        // still never runs from the data cycle.
        for (let el of ELEMENTS) {
            if (el.modeKey)
                this._bindSetting(el.modeKey, this._onLayoutSettingChanged);
        }
        // The network colours are baked into the widgets by setLayout(), so a
        // colour change is a rebuild too - never something setValues() touches.
        this._bindSetting("net_color_up",   this._onLayoutSettingChanged);
        this._bindSetting("net_color_down", this._onLayoutSettingChanged);

        // Rule-only keys: no rebuild, just re-evaluate the current sample.
        for (let el of ELEMENTS) {
            if (el.thKey)
                this._bindSetting(el.thKey, this._onRuleSettingChanged);
        }
        this._bindSetting("cpu_sustain_sec", this._onRuleSettingChanged);

        this._bindSetting("disk_mount", this._onDiskMountChanged);
        this._bindSetting("click_command");

        this._bindSetting("refresh_fast_ms", this._onFastIntervalChanged);
        this._bindSetting("refresh_gpu_ms",  this._onGpuIntervalChanged);
        // No refresh_disk_ms key by design - see DISK_INTERVAL_MS.
    },

    // Binds a schema key onto a property of the same name. When the key is not
    // in the schema (schema still being written, older version), the documented
    // default is installed as a plain property instead of logging every startup.
    _bindSetting: function(key, callback) {
        let bound = false;
        if (this.settings && this.settings.settingsData &&
            Object.prototype.hasOwnProperty.call(this.settings.settingsData, key)) {
            try {
                bound = this.settings.bind(key, key, callback);
            } catch (e) {
                bound = false;
            }
        }
        if (!bound)
            this[key] = cloneDefault(DEFAULTS[key]);
    },

    _setting: function(key) {
        let value = this[key];
        return (value === undefined || value === null) ? DEFAULTS[key] : value;
    },

    _settingNumber: function(key) {
        let value = toNumber(this._setting(key));
        return value === null ? DEFAULTS[key] : value;
    },

    // ------------------------------------------------------------- lifecycle

    /*
     * The live panel height.
     *
     * Applet.Applet exposes the inherited getter this._panelHeight, which is
     * this.panel.height - more accurate than anything cached, but only once
     * appletManager has attached the panel, which happens AFTER main() returns.
     * During construction this.panel is still null and the getter would throw,
     * so the constructor argument stands in until then.
     */
    _currentPanelHeight: function() {
        try {
            if (this.panel)
                return this._panelHeight;
        } catch (e) {
            // Panel not attached yet; fall through to the seed value.
        }
        return this._panelHeightPx;
    },

    _setupTooltip: function() {
        // Applet.Applet already owns a Tooltips.PanelItemTooltip; reusing it
        // avoids stacking two tooltips on the same actor. Only the alignment
        // needs changing (SPEC 6.6: left aligned, multi line, Pango markup).
        try {
            if (this._applet_tooltip && this._applet_tooltip._tooltip)
                this._applet_tooltip._tooltip.set_style("text-align: left;");
        } catch (e) {
            this._logOnce("tooltip-style", "a tooltip stílusa nem állítható: " + e);
        }
    },

    _enterErrorMode: function(message) {
        this._errorMode = true;
        try {
            let iconSize = clamp(this._currentPanelHeight() - 20, 12, 22);
            let icon = new St.Icon({
                icon_name: "dialog-warning",
                icon_type: St.IconType.SYMBOLIC,
                icon_size: iconSize,
                y_align: Clutter.ActorAlign.CENTER
            });
            let label = new St.Label({
                text: "Kapszula",
                y_align: Clutter.ActorAlign.CENTER
            });
            this.actor.add_child(icon);
            this.actor.add_child(label);
        } catch (e) {
            global.logError(UUID + ": a hibajelzés nem építhető fel: " + e);
        }
        this.set_applet_tooltip(message);
    },

    _buildCapsule: function() {
        this._capsule = new this._CapsuleCtor(this._currentPanelHeight());
        if (this._capsule && this._capsule.actor)
            this.actor.add_child(this._capsule.actor);
        else
            throw new Error("a capsule.js nem adott actort");
    },

    _rebuildCapsule: function() {
        if (this._destroyed || this._errorMode || !this._CapsuleCtor)
            return;
        if (this._capsule) {
            try {
                if (this._capsule.actor && this._capsule.actor.get_parent() === this.actor)
                    this.actor.remove_child(this._capsule.actor);
                this._capsule.destroy();
            } catch (e) {
                this._logOnce("capsule-destroy", "a kapszula lebontása hibázott: " + e);
            }
            this._capsule = null;
        }
        try {
            this._buildCapsule();
            this._applyLayout();
        } catch (e) {
            global.logError(UUID + ": a kapszula újraépítése hibázott: " + e);
        }
    },

    // Called by appletManager when the applet is taken off the panel.
    on_applet_removed_from_panel: function() {
        this.destroy();
    },

    destroy: function() {
        this._destroyed = true;

        for (let name of TIMER_NAMES)
            this._removeTimer(name);

        if (this._sampler) {
            try {
                this._sampler.destroy();
            } catch (e) {
                global.logError(UUID + ": a providers lezárása hibázott: " + e);
            }
            this._sampler = null;
        }

        if (this._capsule) {
            try {
                this._capsule.destroy();
            } catch (e) {
                global.logError(UUID + ": a capsule lezárása hibázott: " + e);
            }
            this._capsule = null;
        }

        if (this.settings) {
            try {
                this.settings.finalize();
            } catch (e) {
                global.logError(UUID + ": a beállítások lezárása hibázott: " + e);
            }
            this.settings = null;
        }
    },

    on_panel_height_changed: function() {
        let height = this._currentPanelHeight();
        // _panelHeightPx is only ever compared against and refreshed here; the
        // authoritative value is always read back through _currentPanelHeight().
        if (height === this._panelHeightPx)
            return;
        this._panelHeightPx = height;
        // capsule._init() takes the panel height, so the geometry can only be
        // re-derived by rebuilding the widget tree.
        this._rebuildCapsule();
    },

    // ------------------------------------------------------------------ click

    // Left click: SPEC 6.5 - launch the configured system monitor.
    // Right click is handled by Applet.Applet itself (context menu + Beállítások).
    on_applet_clicked: function(event) {
        let command = this._errorMode ? DEFAULTS.click_command : this._setting("click_command");
        if (!command || !String(command).trim())
            return;
        try {
            Util.spawnCommandLine(String(command));
        } catch (e) {
            global.logError(UUID + ": a parancs nem indítható (" + command + "): " + e);
        }
    },

    // ----------------------------------------------------------------- timers

    _removeTimer: function(name) {
        if (!this._timers[name])
            return;
        try {
            Mainloop.source_remove(this._timers[name]);
        } catch (e) {
            // The source may have already finished; nothing to clean up.
        }
        this._timers[name] = 0;
    },

    _startFastTimer: function() {
        this._removeTimer("fast");
        if (this._destroyed || this._errorMode)
            return;
        let ms = Math.round(clamp(this._settingNumber("refresh_fast_ms"), 250, 10000));
        this._timers.fast = Mainloop.timeout_add(ms, this._onFastTimer.bind(this));
    },

    _startGpuTimer: function() {
        this._removeTimer("gpu");
        if (this._destroyed || this._errorMode)
            return;
        let ms = Math.round(clamp(this._settingNumber("refresh_gpu_ms"), 1000, 60000));
        this._timers.gpu = Mainloop.timeout_add(ms, this._onGpuTimer.bind(this));
    },

    _startDiskTimer: function() {
        this._removeTimer("disk");
        if (this._destroyed || this._errorMode)
            return;
        this._timers.disk = Mainloop.timeout_add(DISK_INTERVAL_MS, this._onDiskTimer.bind(this));
    },

    _onFastTimer: function() {
        if (this._destroyed) {
            this._timers.fast = 0;
            return false;
        }
        this._tickFast();
        return true;
    },

    _onGpuTimer: function() {
        if (this._destroyed) {
            this._timers.gpu = 0;
            return false;
        }
        this._tickGpu();
        return true;
    },

    _onDiskTimer: function() {
        if (this._destroyed) {
            this._timers.disk = 0;
            return false;
        }
        this._tickDisk();
        return true;
    },

    // ------------------------------------------------------------ sample ticks

    // 1000 ms: cpu, mem, swp, net, tmp. Only setValues()/setAlert() may run here,
    // never setLayout() - that would rebuild the widgets and make the panel jump.
    _tickFast: function() {
        if (!this._sampler)
            return;
        try {
            this._sampler.sampleFast();
        } catch (e) {
            this._logOnce("sample-fast", "sampleFast hibázott: " + e);
        }
        this._refreshDisplay();
    },

    // 5000 ms: nvidia-smi, started asynchronously by the provider. The result is
    // picked up by whichever getValues() call comes after it lands.
    _tickGpu: function() {
        if (!this._sampler)
            return;
        if (!this._nvidiaWanted())
            return;
        try {
            this._sampler.sampleGpu();
        } catch (e) {
            this._logOnce("sample-gpu", "sampleGpu hibázott: " + e);
        }
    },

    // 60000 ms: statvfs plus the fixed volume list used by the tooltip.
    _tickDisk: function() {
        if (!this._sampler)
            return;
        try {
            this._sampler.sampleDisk();
        } catch (e) {
            this._logOnce("sample-disk", "sampleDisk hibázott: " + e);
        }
        try {
            let mounts = this._sampler.listMounts();
            this._mounts = Array.isArray(mounts) ? mounts : [];
        } catch (e) {
            this._logOnce("list-mounts", "listMounts hibázott: " + e);
            this._mounts = [];
        }
    },

    // ------------------------------------------------------- settings changes

    _onLayoutSettingChanged: function() {
        if (this._destroyed || this._errorMode)
            return;
        this._updateNvidiaEnabled();
        this._requestLayout();
    },

    _onRuleSettingChanged: function() {
        if (this._destroyed || this._errorMode)
            return;
        this._refreshDisplay();
    },

    _onDiskMountChanged: function() {
        if (this._destroyed || this._errorMode)
            return;
        this._applyDiskMount();
        this._tickDisk();
        this._refreshDisplay();
    },

    _onFastIntervalChanged: function() {
        this._startFastTimer();
    },

    _onGpuIntervalChanged: function() {
        this._startGpuTimer();
    },

    _applyDiskMount: function() {
        if (!this._sampler)
            return;
        let mount = String(this._setting("disk_mount") || DEFAULTS.disk_mount).trim();
        if (!mount)
            mount = DEFAULTS.disk_mount;
        try {
            this._sampler.setDiskMount(mount);
        } catch (e) {
            this._logOnce("set-disk-mount", "setDiskMount hibázott: " + e);
        }
    },

    _nvidiaWanted: function() {
        return this._isEnabled("gpu") || this._isEnabled("gfx");
    },

    // SPEC 6.1 / task: with neither gpu nor gfx enabled the provider must not
    // spawn nvidia-smi every five seconds.
    _updateNvidiaEnabled: function() {
        if (!this._sampler)
            return;
        let wanted = this._nvidiaWanted();
        if (wanted === this._nvidiaEnabled)
            return;
        this._nvidiaEnabled = wanted;
        try {
            this._sampler.setNvidiaEnabled(wanted);
        } catch (e) {
            this._logOnce("set-nvidia", "setNvidiaEnabled hibázott: " + e);
        }
        if (wanted)
            this._tickGpu();
    },

    // ----------------------------------------------------------------- layout

    // setLayout() is a full rebuild (SPEC 7.2), so it is coalesced: the settings
    // window can fire several key changes in a row and they collapse into one.
    _requestLayout: function() {
        this._removeTimer("layout");
        if (this._destroyed || this._errorMode)
            return;
        this._timers.layout = Mainloop.timeout_add(120, (function() {
            this._timers.layout = 0;
            if (!this._destroyed)
                this._applyLayout();
            return false;
        }).bind(this));
    },

    /*
     * SPEC 10, steps 1-3: the stored list resolved against the catalogue.
     *
     * Returns [{ el, show }] in the user's order. Rows the catalogue does not
     * know are dropped (a corrupted or older config), duplicates keep their
     * first position, and every catalogue element the list does not mention is
     * appended at the end, hidden. That last step is what makes a future
     * element reachable for someone who already has a saved list - without it
     * the new element would exist in the code and nowhere else.
     */
    _orderedElements: function() {
        let stored = this._setting("elements");
        if (!Array.isArray(stored))
            stored = DEFAULTS.elements;

        let rows = [];
        let seen = {};

        for (let i = 0; i < stored.length; i++) {
            let row = stored[i];
            if (!row || typeof row !== "object")
                continue;
            let id = String(row.id === undefined || row.id === null ? "" : row.id);
            let el = ELEMENT_BY_ID[id];
            if (!el || seen[id])
                continue;
            seen[id] = true;
            rows.push({ el: el, show: toBool(row.show) });
        }

        for (let i = 0; i < ELEMENTS.length; i++) {
            let el = ELEMENTS[i];
            if (seen[el.id])
                continue;
            seen[el.id] = true;
            rows.push({ el: el, show: false });
        }

        return rows;
    },

    // SPEC 10, step 4: the visible elements, in the user's order.
    _enabledElements: function() {
        let list = [];
        let rows = this._orderedElements();
        for (let i = 0; i < rows.length; i++) {
            if (rows[i].show)
                list.push(rows[i].el);
        }
        return list;
    },

    _isEnabled: function(id) {
        let rows = this._orderedElements();
        for (let i = 0; i < rows.length; i++) {
            if (rows[i].el.id === id)
                return rows[i].show;
        }
        return false;
    },

    /*
     * Writes the normalised list back once per session, when it differs from
     * what is stored.
     *
     * _orderedElements() repairs the list in memory on every read, but the
     * settings dialog shows the stored value: a newly added element would be
     * hidden AND absent from the list widget, so the user could never switch it
     * on. Persisting the repaired list is what puts the new row on screen.
     * Once per session is enough - the catalogue cannot change while running -
     * and it also rules out a write / callback / write loop if the settings
     * backend ever stored the value back in a different shape.
     */
    _syncElementsSetting: function() {
        if (this._elementsSynced)
            return;
        this._elementsSynced = true;

        if (!this.settings || !this.settings.settingsData ||
            !Object.prototype.hasOwnProperty.call(this.settings.settingsData, "elements"))
            return;

        let stored = this._setting("elements");
        let rows = this._orderedElements();
        let wanted = rows.map(function(row) {
            return { id: row.el.id, show: row.show };
        });

        let same = Array.isArray(stored) && stored.length === wanted.length;
        if (same) {
            for (let i = 0; i < wanted.length; i++) {
                let row = stored[i];
                if (!row || typeof row !== "object" ||
                    String(row.id) !== wanted[i].id || toBool(row.show) !== wanted[i].show) {
                    same = false;
                    break;
                }
            }
        }
        if (same)
            return;

        try {
            this.settings.setValue("elements", wanted);
        } catch (e) {
            this._logOnce("sync-elements", "az elemlista nem menthető vissza: " + e);
        }
    },

    _applyLayout: function() {
        if (this._destroyed || this._errorMode || !this._capsule)
            return;

        // SPEC 7.3: the panel height is never hard coded.
        let capsuleHeight = clamp(this._currentPanelHeight() - CAPSULE_HEIGHT_PAD,
                                  CAPSULE_HEIGHT_MIN, CAPSULE_HEIGHT_MAX);
        let wantLabels = !!this._setting("show_labels");
        let roomForLabels = capsuleHeight >= LABEL_MIN_HEIGHT;
        this._labelsForcedOff = wantLabels && !roomForLabels;

        /*
         * SPEC 7.2: the capsule gets objects, not bare ids - the user's order
         * plus, per element, whether the cell has to be the wide one. It is
         * deliberately not told why: "wide" is a width, the mode behind it is a
         * rule layer concept and stays here.
         *
         * The flag comes from the setting alone, never from the current sample,
         * so a missing byte figure cannot resize a cell mid-cycle (SPEC 3.2).
         */
        let elements = this._enabledElements().map((function(el) {
            return { id: el.id, wide: this._elementMode(el) === MODE_ABS };
        }).bind(this));

        let fixedWidthPx = 0;
        if (this._setting("fixed_width"))
            fixedWidthPx = Math.round(clamp(this._settingNumber("fixed_width_px"), 100, 400));

        // SPEC 4.1: the network direction colours are settings, not alerts. They
        // are drawn into the Cairo graph and the arrows, so they can only be
        // handed over here, at rebuild time.
        let colors = {
            netUp:   normalizeColor(this._setting("net_color_up"),   DEFAULTS.net_color_up),
            netDown: normalizeColor(this._setting("net_color_down"), DEFAULTS.net_color_down)
        };

        try {
            this._capsule.setLayout(elements, wantLabels && roomForLabels, fixedWidthPx, colors);
        } catch (e) {
            global.logError(UUID + ": setLayout hibázott: " + e);
            return;
        }

        this._updateNvidiaEnabled();
        this._refreshDisplay();
    },

    // ------------------------------------------------------- rules and display

    _refreshDisplay: function() {
        if (this._destroyed || this._errorMode || !this._capsule || !this._sampler)
            return;

        let values = null;
        try {
            values = this._sampler.getValues();
        } catch (e) {
            this._logOnce("get-values", "getValues hibázott: " + e);
        }
        if (!values || typeof values !== "object")
            values = {};
        this._values = values;

        this._pushSustainSamples(values);

        let display = {};
        let anyAlert = false;
        for (let el of this._enabledElements()) {
            let cell = this._displayFor(el, values);
            display[el.id] = cell;
            if (cell && cell.alert)
                anyAlert = true;
        }

        try {
            this._capsule.setValues(display);
        } catch (e) {
            this._logOnce("set-values", "setValues hibázott: " + e);
        }
        try {
            // SPEC 6.4: any alerting element turns the whole capsule orange.
            this._capsule.setAlert(anyAlert);
        } catch (e) {
            this._logOnce("set-alert", "setAlert hibázott: " + e);
        }

        this._updateTooltip(values);
    },

    // The number of fast samples that make up the configured sustain window.
    _sustainSamples: function() {
        let seconds = this._settingNumber("cpu_sustain_sec");
        if (seconds <= 0)
            return 1;
        let periodMs = clamp(this._settingNumber("refresh_fast_ms"), 250, 10000);
        return Math.max(1, Math.round(seconds * 1000 / periodMs));
    },

    _pushRing: function(ring, value, capacity) {
        if (value === null)
            return;
        ring.push(value);
        while (ring.length > capacity)
            ring.shift();
    },

    _pushSustainSamples: function(values) {
        let capacity = this._sustainSamples();
        this._pushRing(this._rings.cpu, values.cpu ? toNumber(values.cpu.pct) : null, capacity);
        this._pushRing(this._rings.tmp, values.tmp ? toNumber(values.tmp.celsius) : null, capacity);
    },

    _ringAverage: function(ring) {
        if (!ring.length)
            return null;
        let sum = 0;
        for (let i = 0; i < ring.length; i++)
            sum += ring[i];
        return sum / ring.length;
    },

    /*
     * The sustained value used for the alert decision.
     *
     * SPEC 5.1: cpu and tmp must not alert on a spike. A compile pins the CPU
     * several times a day; if every spike flashed orange the user would stop
     * looking, and the memory alert - the whole point of the applet - would be
     * lost with it. So the rule looks at a rolling average, not the instant.
     *
     * The provider publishes cpu.avg10 (a fixed 10 s window, SPEC 7.1). That is
     * preferred at the default setting because the provider averages on its own
     * sampling clock. For any other window - and for tmp, where the contract has
     * no average field at all - the applet keeps its own ring buffer sized from
     * cpu_sustain_sec and refresh_fast_ms.
     */
    _sustainedValue: function(id, instant, providerAvg) {
        let seconds = this._settingNumber("cpu_sustain_sec");
        if (seconds <= 0)
            return instant;
        if (seconds === 10) {
            let fromProvider = toNumber(providerAvg);
            if (fromProvider !== null)
                return fromProvider;
        }
        let local = this._ringAverage(this._rings[id]);
        return local === null ? instant : local;
    },

    _threshold: function(el) {
        if (!el.thKey)
            return null;
        let value = toNumber(this._setting(el.thKey));
        if (value === null)
            return null;
        // SPEC 5: th_gfx defaults to 100, documented as "off". For a percentage
        // element a threshold of 100 or more means "never alert".
        if (el.kind === "pct" && value >= 100)
            return null;
        return value;
    },

    // One direction of the network history, padded to NET_BARS and clamped.
    // The freshest bucket is last in both the provider's array and in ours, so
    // a short array is padded on the LEFT, otherwise the graph would slide.
    _netBars: function(history) {
        let source = Array.isArray(history) ? history.slice(-NET_BARS) : [];
        let bars = [];
        while (bars.length < NET_BARS - source.length)
            bars.push(0);
        for (let i = 0; i < source.length; i++) {
            let ratio = toNumber(source[i]);
            bars.push(ratio === null ? 0 : clamp(ratio, 0, 1));
        }
        return bars;
    },

    /*
     * SPEC 5.1: how the element writes its number, "pct" or "abs".
     *
     * Anything else counts as "pct": a key still missing from the schema, an
     * older config file, a hand edited value. An element without a modeKey
     * (cpu, gfx, tmp, net) is always a percentage by nature.
     */
    _elementMode: function(el) {
        if (!el || !el.modeKey)
            return MODE_PCT;
        return String(this._setting(el.modeKey)) === MODE_ABS ? MODE_ABS : MODE_PCT;
    },

    // The used amount behind an element, always converted to bytes. SPEC 7.1
    // publishes gpu in MiB and mem / swp / ssd in bytes, and this is the only
    // place where that difference is allowed to matter.
    _usedBytes: function(el, node) {
        if (!node || !el.absFrom)
            return null;
        if (el.absFrom === "mib") {
            let mib = toNumber(node.usedMiB);
            return mib === null ? null : mib * MIB;
        }
        return toNumber(node.usedBytes);
    },

    // The plain percentage of an element, for the tooltip and the rules - the
    // number in the cell may be a gigabyte figure instead.
    _percentOf: function(el, values) {
        let node = values[el.id];
        return node ? toNumber(node.pct) : null;
    },

    // Builds one cell descriptor for capsule.setValues().
    // The unit travels with the value (SPEC 7.2) so the capsule never has to
    // know what an element means, only how wide its own boxes are.
    _displayFor: function(el, values) {
        if (el.kind === "net") {
            let net = values.net;
            if (!net)
                return null;
            let up = netSpeed(net.upBps);
            let down = netSpeed(net.downBps);
            // SPEC 6.2: the network never alerts, it has no threshold.
            return {
                barsUp:   this._netBars(net.historyUp),
                barsDown: this._netBars(net.historyDown),
                upText:   up.text,
                upUnit:   up.unit,
                downText: down.text,
                downUnit: down.unit
            };
        }

        if (el.kind === "celsius") {
            let node = values.tmp;
            let celsius = node ? toNumber(node.celsius) : null;
            if (celsius === null)
                return null;
            let judged = this._sustainedValue("tmp", celsius, node ? node.avg10 : null);
            let threshold = this._threshold(el);
            return {
                text: String(Math.round(celsius)),
                unit: el.unit,
                // No natural 0-100 scale for a temperature; 100 C is taken as a
                // full bar so the bar does not move when the threshold changes.
                ratio: clamp(celsius / 100, 0, 1),
                alert: threshold !== null && judged !== null && judged >= threshold
            };
        }

        let node = values[el.id];
        let pct = node ? toNumber(node.pct) : null;
        if (pct === null)
            return null;

        let judged = pct;
        if (el.sustained)
            judged = this._sustainedValue(el.id, pct, node.avg10);

        let threshold = this._threshold(el);

        /*
         * SPEC 5.1: the mode changes the NUMBER and nothing else.
         *
         * ratio stays the percentage, so the bar says exactly what it said
         * before - that is the whole point of the mode, the number gets more
         * telling without the proportion being lost. The alert is decided on
         * the percentage too, so an element in absolute mode goes orange at the
         * same instant it would have in percentage mode.
         */
        let text = String(Math.round(pct));
        let unit = el.unit;
        if (this._elementMode(el) === MODE_ABS) {
            let abs = absSize(this._usedBytes(el, node));
            // An empty unit means the provider gave no byte figure this cycle.
            // The cell then keeps the percentage rather than showing a dash: it
            // is already the wide cell, so the shorter text fits without moving
            // anything.
            if (abs.unit) {
                text = abs.text;
                unit = abs.unit;
            }
        }

        return {
            text: text,
            unit: unit,
            ratio: clamp(pct / 100, 0, 1),
            alert: threshold !== null && judged !== null && judged >= threshold
        };
    },

    // ---------------------------------------------------------------- tooltip

    _updateTooltip: function(values) {
        let lines = [];

        if (this._labelsForcedOff)
            lines.push("A panel túl alacsony a feliratokhoz.");

        let enabled = this._enabledElements();
        for (let el of enabled)
            lines.push(this._tooltipLine(el, values));

        if (!enabled.length)
            lines.push("Nincs bekapcsolt elem.");

        // SPEC 6.3: the tooltip lists every fixed volume separately.
        if (this._isEnabled("ssd") && this._mounts.length) {
            lines.push("");
            lines.push("Kötetek:");
            for (let entry of this._mounts) {
                if (!entry || !entry.mount)
                    continue;
                let pct = toNumber(entry.pct);
                lines.push("  " + padRight(escapeMarkup(entry.mount), TIP_MOUNT_COLS) +
                           (pct === null ? EM_DASH : padLeft(Math.round(pct), TIP_VALUE_COLS) + "%"));
            }
        }

        // A monospace block is the only way to keep SPEC 6.6's columns aligned
        // with a proportional system font.
        this.set_applet_tooltip("<tt>" + lines.join("\n") + "</tt>", true);
    },

    _tooltipLine: function(el, values) {
        let label = el.tipLabel;
        if (el.id === "ssd") {
            let mount = (values.ssd && values.ssd.mount) ?
                values.ssd.mount : this._setting("disk_mount");
            label += " (" + String(mount) + ")";
        }

        let cell = this._displayFor(el, values);
        let head = padRight(escapeMarkup(label), TIP_LABEL_COLS);
        let body;

        if (!cell) {
            body = padLeft(EM_DASH, TIP_VALUE_COLS + 1);
        } else if (el.kind === "net") {
            body = this._netTooltipBody(values.net);
        } else if (el.kind === "celsius") {
            body = padLeft(cell.text, TIP_VALUE_COLS) + " °C" +
                   this._sustainSuffix("tmp", values.tmp, " °C");
        } else {
            // Deliberately not cell.text: in absolute mode that is a gigabyte
            // figure, while the tooltip line is "percentage + the exact pair"
            // in both modes - the tooltip is where the full picture belongs.
            let pct = this._percentOf(el, values);
            body = padLeft(pct === null ? EM_DASH : Math.round(pct), TIP_VALUE_COLS) +
                   "%" + this._detailFor(el, values);
        }

        let line = head + body;
        // Bold marks which element is alerting. Colour is reserved for the
        // panel itself (SPEC 3.5: exactly one accent colour, one meaning).
        if (cell && cell.alert)
            line = "<b>" + line + "</b>";
        return line;
    },

    _detailFor: function(el, values) {
        let node = values[el.id];
        if (!node)
            return "";

        if (el.id === "cpu")
            return this._sustainSuffix("cpu", node, "%");

        if (el.id === "gpu") {
            let used = toNumber(node.usedMiB);
            let total = toNumber(node.totalMiB);
            if (used === null || total === null)
                return "";
            return "   " + this._formatSizePair(used * MIB, total * MIB);
        }

        let used = toNumber(node.usedBytes);
        let total = toNumber(node.totalBytes);
        if (used === null || total === null)
            return "";
        return "   " + this._formatSizePair(used, total);
    },

    _sustainSuffix: function(id, node, unit) {
        let seconds = this._settingNumber("cpu_sustain_sec");
        if (seconds <= 0)
            return "";
        let instant = null;
        if (node)
            instant = toNumber(id === "tmp" ? node.celsius : node.pct);
        let average = this._sustainedValue(id, instant, node ? node.avg10 : null);
        if (average === null)
            return "";
        return "   " + Math.round(seconds) + " mp átlag: " + Math.round(average) + unit;
    },

    _netTooltipBody: function(net) {
        if (!net)
            return padLeft(EM_DASH, TIP_VALUE_COLS + 1);
        let down = toNumber(net.downBps);
        let up = toNumber(net.upBps);
        if (down === null || up === null)
            return padLeft(EM_DASH, TIP_VALUE_COLS + 1);
        return ARROW_DOWN + " " + huNumber(down / MIB, 1) + "   " +
               ARROW_UP + " " + huNumber(up / MIB, 1) + " MB/s";
    },

    // Binary gigabytes, the unit every Linux disk and VRAM tool reports.
    // Both halves of a pair share the precision chosen from the total, so a
    // disk reads "98 / 468 GB" while memory reads "6,9 / 15,6 GB".
    _formatSizePair: function(usedBytes, totalBytes) {
        let used = usedBytes / GIB;
        let total = totalBytes / GIB;
        let decimals = total >= 100 ? 0 : 1;
        return huNumber(used, decimals) + " / " + huNumber(total, decimals) + " GB";
    },

    // ---------------------------------------------------------------- logging

    // SPEC 6.1: a failing subprocess must not write to the log on every cycle.
    _logOnce: function(key, message) {
        if (this._logged[key])
            return;
        this._logged[key] = true;
        global.logError(UUID + ": " + message);
    }
};

function main(metadata, orientation, panel_height, instance_id) {
    return new MyApplet(metadata, orientation, panel_height, instance_id);
}
