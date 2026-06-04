const UUID = "compact-clock@kb";

const Applet   = imports.ui.applet;
const Settings = imports.ui.settings;
const Mainloop = imports.mainloop;
const GLib     = imports.gi.GLib;
const St       = imports.gi.St;
const Clutter  = imports.gi.Clutter;
const Pango    = imports.gi.Pango;

// ─── Helper: run `date +FORMAT` ───────────────────────────────────────────────

function shellDate(fmt) {
    try {
        let argv = ["bash", "-c", "date +'" + fmt + "'"];
        let [ok, out, , exit] = GLib.spawn_sync(
            null, argv, null,
            GLib.SpawnFlags.SEARCH_PATH,
            null
        );
        if (!ok || exit !== 0) return "";
        let s = (typeof out === "string")
            ? out
            : String.fromCharCode.apply(null, out);
        return s.trim();
    } catch(e) {
        global.logError("[compact-clock@kb] shellDate: " + e);
        return "";
    }
}

// ─── Helper: extract font-family name from a Pango font description string ────
// fontchooser stores e.g. "JetBrains Mono Bold 12"
// We strip trailing style keywords and the trailing point-size number.

function parseFontFamily(desc) {
    if (!desc) return "JetBrains Mono";
    // Remove trailing size (integer or decimal)
    let s = desc.replace(/\s+\d+(\.\d+)?\s*$/, "");
    // Remove common style / weight keywords at the end
    s = s.replace(/\s+(Bold|Italic|Regular|Light|Medium|Heavy|Black|Thin|ExtraLight|ExtraBold|SemiBold|Condensed|Expanded|Oblique|Mono)\s*$/gi, "");
    return s.trim() || "JetBrains Mono";
}

// ─── Helper: make a label that never ellipsizes ───────────────────────────────

function makeLabel(text) {
    let lbl = new St.Label({ text: text });
    // Disable ellipsis so the label always shows its full text
    // and drives its own natural width
    lbl.clutter_text.set_ellipsize(Pango.EllipsizeMode.NONE);
    lbl.clutter_text.set_line_wrap(false);
    return lbl;
}

// ─── Applet ───────────────────────────────────────────────────────────────────

function CompactClockApplet(metadata, orientation, panelHeight, instanceId) {
    this._init(metadata, orientation, panelHeight, instanceId);
}

CompactClockApplet.prototype = {
    __proto__: Applet.Applet.prototype,

    _init(metadata, orientation, panelHeight, instanceId) {
        Applet.Applet.prototype._init.call(this, orientation, panelHeight, instanceId);

        this._timeout = null;
        this._panelH  = panelHeight || 40;

        // ── Settings ──────────────────────────────────────────────────────────
        this._settings = new Settings.AppletSettings(this, UUID, instanceId);

        const bind = (key, prop, cb) =>
            this._settings.bindProperty(Settings.BindingDirection.IN, key, prop, cb);

        bind("time-format",        "_timeFmt",        () => this._rebuild());
        bind("date-format",        "_dateFmt",        () => this._rebuild());
        bind("day-format",         "_dayFmt",         () => this._rebuild());
        bind("show-seconds",       "_showSeconds",    () => this._reschedule());
        bind("font-family",        "_fontDesc",       () => this._applyStyles());
        bind("day-font-size",      "_dayFontSize",    () => this._applyStyles());
        bind("time-font-size",     "_timeFontSize",   () => this._applyStyles());
        bind("date-font-size",     "_dateFontSize",   () => this._applyStyles());
        bind("day-color",          "_dayColor",       () => this._applyStyles());
        bind("time-color",         "_timeColor",      () => this._applyStyles());
        bind("date-color",         "_dateColor",      () => this._applyStyles());
        bind("separator-color",    "_sepColor",       () => this._applyStyles());
        bind("background-color",   "_bgColor",        () => this._applyStyles());
        bind("background-radius",  "_bgRadius",       () => this._applyStyles());

        // ── Root: horizontal box ──────────────────────────────────────────────
        //
        //   ┌─────────┬─┬──────────┐
        //   │  WED    │ │  03:10   │
        //   │         │ │  Jun 4   │
        //   └─────────┴─┴──────────┘
        //
        this._root = new St.BoxLayout({
            vertical:  false,
            reactive:  false,
            x_align:   Clutter.ActorAlign.CENTER,
            y_align:   Clutter.ActorAlign.CENTER
        });

        // ── Left: day-of-week ─────────────────────────────────────────────────
        this._dayLabel = makeLabel("WED");
        this._dayLabel.set_x_align(Clutter.ActorAlign.CENTER);
        this._dayLabel.set_y_align(Clutter.ActorAlign.CENTER);

        // ── Thin vertical separator ───────────────────────────────────────────
        this._sep = new St.Widget({ reactive: false });

        // ── Right: vertical stack ─────────────────────────────────────────────
        this._rightBox = new St.BoxLayout({
            vertical:  true,
            reactive:  false,
            x_align:   Clutter.ActorAlign.END,
            y_align:   Clutter.ActorAlign.CENTER
        });

        this._timeLabel = makeLabel("00:00");
        this._timeLabel.set_x_align(Clutter.ActorAlign.END);
        this._timeLabel.set_y_align(Clutter.ActorAlign.END);

        this._dateLabel = makeLabel("Jan 1");
        this._dateLabel.set_x_align(Clutter.ActorAlign.END);
        this._dateLabel.set_y_align(Clutter.ActorAlign.START);

        this._rightBox.add(this._timeLabel, { x_align: St.Align.END, expand: false });
        this._rightBox.add(this._dateLabel, { x_align: St.Align.END, expand: false });

        // ── Assemble root ─────────────────────────────────────────────────────
        this._root.add(this._dayLabel,  { y_align: St.Align.MIDDLE, expand: false });
        this._root.add(this._sep,       { y_fill: true, expand: false });
        this._root.add(this._rightBox,  { y_align: St.Align.MIDDLE, expand: false });

        this.actor.add_actor(this._root);
        this.actor.set_x_align(Clutter.ActorAlign.CENTER);
        this.actor.set_y_align(Clutter.ActorAlign.CENTER);

        // ── Render ────────────────────────────────────────────────────────────
        this._applyStyles();
        this._tick();
        this._scheduleNext();
    },

    // ── Style application ─────────────────────────────────────────────────────

    _applyStyles() {
        let ff  = parseFontFamily(this._fontDesc);
        let dfs = this._dayFontSize  || 20;
        let tfs = this._timeFontSize || 13;
        let afs = this._dateFontSize || 9;
        let dc  = this._dayColor     || "rgba(255,255,255,0.95)";
        let tc  = this._timeColor    || "rgba(255,255,255,0.92)";
        let ac  = this._dateColor    || "rgba(255,255,255,0.45)";
        let sc  = this._sepColor     || "rgba(255,255,255,0.18)";
        let bg  = this._bgColor      || "transparent";
        let br  = (this._bgRadius !== undefined) ? this._bgRadius : 6;

        // Root box: background + padding
        this._root.set_style(
            "background-color: " + bg + ";" +
            "border-radius: " + br + "px;" +
            "padding: 0 8px;"
        );

        // Day label: large, bold, left side
        this._dayLabel.set_style(
            "font-family: '" + ff + "', monospace;" +
            "font-size: "    + dfs + "px;" +
            "font-weight: 700;" +
            "letter-spacing: 1.5px;" +
            "color: " + dc + ";" +
            "padding-right: 8px;" +
            "line-height: 1;"
        );

        // Thin vertical separator (height = 55% of panel)
        let sepH = Math.round(this._panelH * 0.55);
        this._sep.set_style(
            "width: 1px;" +
            "min-height: " + sepH + "px;" +
            "max-height: " + sepH + "px;" +
            "background-color: " + sc + ";"
        );

        // Time label: top-right, monospaced
        this._timeLabel.set_style(
            "font-family: '" + ff + "', monospace;" +
            "font-size: "    + tfs + "px;" +
            "font-weight: 600;" +
            "color: " + tc + ";" +
            "line-height: 1;" +
            "margin-left: 7px;"
        );

        // Date label: bottom-right, muted
        this._dateLabel.set_style(
            "font-family: '" + ff + "', monospace;" +
            "font-size: "    + afs + "px;" +
            "font-weight: 400;" +
            "color: " + ac + ";" +
            "line-height: 1;" +
            "margin-top: 2px;" +
            "margin-left: 7px;" +
            "letter-spacing: 0.5px;"
        );

        this._tick();
    },

    // ── Format/rebuild ────────────────────────────────────────────────────────

    _rebuild() {
        this._applyStyles();
    },

    // ── Clock tick ────────────────────────────────────────────────────────────

    _tick() {
        let timeFmt = this._timeFmt || "%H:%M";
        let dateFmt = this._dateFmt || "%b %-e";
        let dayFmt  = this._dayFmt  || "%a";

        if (this._showSeconds && !timeFmt.includes("%S")) {
            timeFmt = timeFmt.replace("%M", "%M:%S");
        }

        let timeStr = shellDate(timeFmt);
        let dateStr = shellDate(dateFmt);
        let dayStr  = shellDate(dayFmt).toUpperCase();

        this._dayLabel.set_text(dayStr  || "---");
        this._timeLabel.set_text(timeStr || "--:--");
        this._dateLabel.set_text(dateStr || "---");

        this.set_applet_tooltip(dayStr + "  " + timeStr + "\n" + dateStr);
    },

    // ── Timer ─────────────────────────────────────────────────────────────────

    _scheduleNext() {
        if (this._timeout) {
            Mainloop.source_remove(this._timeout);
            this._timeout = null;
        }
        let interval = this._showSeconds ? 1 : 5;
        this._timeout = Mainloop.timeout_add_seconds(interval, () => {
            this._tick();
            return true;
        });
    },

    _reschedule() {
        this._scheduleNext();
        this._tick();
    },

    // ── Cleanup ───────────────────────────────────────────────────────────────

    on_applet_removed_from_panel() {
        if (this._timeout) {
            Mainloop.source_remove(this._timeout);
            this._timeout = null;
        }
        if (this._settings) {
            this._settings.finalize();
        }
    }
};

function main(metadata, orientation, panelHeight, instanceId) {
    return new CompactClockApplet(metadata, orientation, panelHeight, instanceId);
}
