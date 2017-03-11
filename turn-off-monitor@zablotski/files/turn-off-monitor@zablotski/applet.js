const Applet = imports.ui.applet;
const Util = imports.misc.util;
const GLib = imports.gi.GLib;

const APPLET_PATH = GLib.get_home_dir() + "/.local/share/cinnamon/applets/turn-off-monitor@zablotski";
const ICON_PATH = APPLET_PATH + "/icon.png";

function MyApplet(orientation, panel_height, instance_id) {
    this._init(orientation, panel_height, instance_id);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(orientation, panel_height, instance_id) {
        Applet.IconApplet.prototype._init.call(this, orientation, panel_height, instance_id);

        this.set_applet_icon_path(ICON_PATH);
        this.set_applet_tooltip(_("Turn off monitor"));
    },

    on_applet_clicked: function() {
        Util.spawn('xset dpms force off'.split(' '));
    }
};

function main(metadata, orientation, panel_height, instance_id) {
    return new MyApplet(orientation, panel_height, instance_id);
}