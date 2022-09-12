/* global imports, C_ */
/* eslint camelcase: "off" */

const PopupMenu = imports.ui.popupMenu;
const GLib = imports.gi.GLib;
const St = imports.gi.St;

class Worldclocks {
    constructor(box) {
//        this._separator = new PopupMenu.PopupSeparatorMenuItem();
//        box.add_actor(this._separator);

        this.actor = new St.Table({
            homogeneous: false, 
            style_class: "calendar calendar-world-list", 
            reactive: false, 
            x_expand: true });
        box.add_actor(this.actor, {expand: true});
    }

    _formatTime(time) {
        return time.format(this.settings.format).trim();
    }

    buildClocks(settings) {
        this.settings = settings;
        this.actor.destroy_all_children();
        this.clocks = [];

       if (settings.clocks.length) {
            //this._separator.actor.show();
            this.actor.show();
        } else {
            //this._separator.actor.hide();
            this.actor.hide();
        }

        settings.clocks.forEach((item, i) => {
            let label = new St.Label({text: item.label});
            this.actor.add(label, { row: i,  col: 0, x_expand: true, x_align: St.Align.START });

            let tz = GLib.TimeZone.new(item.timezone);
            let display = new St.Label({ x_align: St.Align.END, style_class: "calendar-world-time" });
            this.clocks.push({ display, tz });
            this.actor.add(display, { row: i,  col: 1, x_align: St.Align.END });
        });
    }

    updateClocks () {
        const time = GLib.DateTime.new_now_utc();
        for (let clock of this.clocks) {
            const text = this._formatTime(time.to_timezone(clock.tz));
            clock.display.set_text(text);
        }
    }
}