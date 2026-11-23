const Applet = imports.ui.applet;
const GLib = imports.gi.GLib;

function MyApplet(orientation, panel_height, instance_id) {
    this._init(orientation, panel_height, instance_id);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(orientation, panel_height, instance_id) {
        Applet.IconApplet.prototype._init.call(this, orientation, panel_height, instance_id);
        this.set_applet_icon_symbolic_name("video-display");
        this.set_applet_tooltip("Mirror Panel - Click to mirror panel 1 to other monitors");
    },

    on_applet_clicked: function(event) {
        let scriptPath = GLib.get_home_dir() + "/scripts/mirror-panel.js";
        GLib.spawn_async(
            null,
            ["gnome-terminal", "--", "node", scriptPath],
            null,
            GLib.SpawnFlags.SEARCH_PATH,
            null
        );
    }
};

function main(metadata, orientation, panel_height, instance_id) {
    return new MyApplet(orientation, panel_height, instance_id);
}
