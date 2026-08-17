const Applet = imports.ui.applet;
const Util = imports.misc.util;
const GLib = imports.gi.GLib;

function MyApplet(metadata, orientation, panel_height, instance_id) {
    this._init(metadata, orientation, panel_height, instance_id);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(metadata, orientation, panel_height, instance_id) {
        Applet.IconApplet.prototype._init.call(this, orientation, panel_height, instance_id);

        this.set_applet_tooltip(_("Click to open/toggle Gemini Sidebar"));
        this.applet_path = GLib.build_filenamev([GLib.get_user_data_dir(), "cinnamon", "applets", metadata.uuid]);
        this.set_applet_icon_path(this.applet_path + "/icon.png");
        
        // Startup autorun hatane ke liye humne yahan se initialization script line hata di hai.
    },

    on_applet_clicked: function() {
        // Direct click execute trigger
        Util.spawnCommandLine(this.applet_path + "/gemini_sidebar.py");
    }
};

function main(metadata, orientation, panel_height, instance_id) {
    return new MyApplet(metadata, orientation, panel_height, instance_id);
}
