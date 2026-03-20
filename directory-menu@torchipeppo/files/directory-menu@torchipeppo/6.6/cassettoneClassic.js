const Util = imports.misc.util;
const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;
const St = imports.gi.St;
const Cinnamon = imports.gi.Cinnamon;
const Gettext = imports.gettext;

const Helpers = require('./helpers');

Gettext.bindtextdomain(Helpers.UUID, GLib.get_home_dir() + "/.local/share/locale");

function _(text) {
    let locText = Gettext.dgettext(Helpers.UUID, text);
    if (locText == text) {
        locText = window._(text);
    }
    return locText;
}

var ClassicCassettoneHandler = class ClassicCassettoneHandler {
    constructor(applet) {
        this.applet = applet;
    }

    open() {
        // If we attempt to open this GTK menu while a Cinnamon panel menu is
        // open, Cinnamon will freeze.
        // This can happen with the panel's context menu (but not an applet's).
        // Returning is a simple fix, but it would be nicer (and riskier?)
        // if it caused the open menu to close.
        if (global.menuStackLength) return false;

        this.applet._applet_tooltip.hide();
        this.applet._applet_tooltip.preventShow = true;

        let starting_uri = Helpers.normalizeUri(this.applet.starting_uri);

        let [x, y, o] = this._getEventPositionInfo();

        let args = {
            "starting_uri": starting_uri,
            "show_hidden": this.applet.show_hidden,
            "x": x,
            "y": y,
            "orientation": o,
            "character_limit": this.applet.limit_characters ? this.applet.character_limit : -1,
            "favorites_first": this.applet.favorites_first,
            "pinned_first": this.applet.pinned_first,
            "order_by": this.applet.order_by,
            "show_header": this.applet.show_header,
        }

        Util.spawn_async(['python3', `${this.applet.metadata.path}/../popup_menu.py`, JSON.stringify(args)]);
    }

    _getEventPositionInfo() {
        let allocation = Cinnamon.util_get_transformed_allocation(this.applet.actor);

        let x = Math.round(allocation.x1 / global.ui_scale);
        let y = Math.round(allocation.y1 / global.ui_scale);
        let w = Math.round((allocation.x2 - allocation.x1) / global.ui_scale);
        let h = Math.round((allocation.y2 - allocation.y1) / global.ui_scale);

        let final_x, final_y, final_o;

        switch (this.applet._orientation) {
            case St.Side.TOP:
                final_x = x;
                final_y = y + h;
                final_o = Gtk.PositionType.TOP;
                break;
            case St.Side.BOTTOM:
            default:
                final_x = x;
                final_y = y;
                final_o = Gtk.PositionType.BOTTOM;
                break;
            case St.Side.LEFT:
                final_x = x + w;
                final_y = y
                final_o = Gtk.PositionType.LEFT;
                break;
            case St.Side.RIGHT:
                final_x = x;
                final_y = y;
                final_o = Gtk.PositionType.RIGHT;
                break;
        }

        return [final_x, final_y, final_o];
    }

    destroy() {
        // Nothing to clean up
    }
}
