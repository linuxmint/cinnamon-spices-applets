const Applet = imports.ui.applet;
const Settings = imports.ui.settings;
const Mainloop = imports.mainloop;
const GLib = imports.gi.GLib;
const Gettext = imports.gettext;

const UUID = "worktimeleft@CimTS";
Gettext.bindtextdomain(UUID, GLib.get_user_data_dir() + "/locale");
function _(str) { return Gettext.dgettext(UUID, str); }

function parseHM(str) {
    let m = /^\s*(\d{1,2}):(\d{2})\s*$/.exec(str || "");
    if (!m) return null;
    let h = parseInt(m[1], 10), min = parseInt(m[2], 10);
    if (h > 23 || min > 59) return null;
    return h * 60 + min;
}

function fmt(totalMin) {
    let h = Math.floor(totalMin / 60), m = totalMin % 60;
    return h + "h " + (m < 10 ? "0" : "") + m + "m";
}

class WorkTimeLeftApplet extends Applet.TextApplet {
    constructor(metadata, orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId);
        this.settings = new Settings.AppletSettings(this, metadata.uuid, instanceId);
        let keys = ["start-time", "end-time", "show-percent",
                    "workday-0", "workday-1", "workday-2", "workday-3",
                    "workday-4", "workday-5", "workday-6"];
        for (let k of keys)
            this.settings.bind(k, k.replace(/-/g, "_"), () => this._update());
        this._timer = 0;
        this._update();
    }

    // Monday = 0 ... Sunday = 6 (matches settings keys)
    _isWorkday(date) {
        let idx = (date.getDay() + 6) % 7;
        return !!this["workday_" + idx];
    }

    _compute() {
        let now = new Date();
        let start = parseHM(this.start_time), end = parseHM(this.end_time);
        if (start === null || end === null)
            return { label: _("Check times"), tip: _("Use HH:MM, e.g. 09:00") };
        let nowMin = now.getHours() * 60 + now.getMinutes();
        // Support overnight shifts (end before start)
        let overnight = end <= start;
        let shiftLen = overnight ? end + 1440 - start : end - start;
        let elapsed;
        let shiftDay = now;
        if (overnight && nowMin < end) {
            elapsed = nowMin + 1440 - start;        // shift began yesterday
            shiftDay = new Date(now.getTime() - 86400000);
        } else {
            elapsed = nowMin - start;
        }
        if (!this._isWorkday(shiftDay))
            return { label: _("No work today"), tip: _("Enjoy your day off") };
        if (elapsed < 0)
            return { label: _("Starts in") + " " + fmt(-elapsed),
                     tip: _("Shift length") + ": " + fmt(shiftLen) };
        if (elapsed >= shiftLen)
            return { label: _("Workday over"), tip: _("See you next shift") };
        let left = shiftLen - elapsed;
        let label = fmt(left) + " " + _("left");
        if (this.show_percent)
            label += " (" + Math.floor(elapsed * 100 / shiftLen) + "%)";
        return { label: label, tip: fmt(elapsed) + " " + _("worked of") + " " + fmt(shiftLen) };
    }

    _update() {
        let r = this._compute();
        this.set_applet_label(r.label);
        this.set_applet_tooltip(r.tip);
        this._schedule();
    }

    _schedule() {
        if (this._timer) Mainloop.source_remove(this._timer);
        let secs = 60 - new Date().getSeconds();   // tick on the minute
        this._timer = Mainloop.timeout_add_seconds(secs, () => {
            this._timer = 0;
            this._update();
            return false;
        });
    }

    on_applet_clicked(event) { this._update(); }

    on_applet_removed_from_panel() {
        if (this._timer) Mainloop.source_remove(this._timer);
        this._timer = 0;
        this.settings.finalize();
    }
}

function main(metadata, orientation, panelHeight, instanceId) {
    return new WorkTimeLeftApplet(metadata, orientation, panelHeight, instanceId);
}
