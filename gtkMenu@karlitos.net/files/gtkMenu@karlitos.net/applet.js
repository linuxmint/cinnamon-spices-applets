const Lang = imports.lang;
const Applet = imports.ui.applet;
const GLib = imports.gi.GLib;
const Gettext = imports.gettext.domain('cinnamon-applets');
const _ = Gettext.gettext;

function MyApplet(orientation) {
    this._init(orientation);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(orientation) {
        Applet.IconApplet.prototype._init.call(this, orientation);

        try {
            this.set_applet_icon_name("gnome-gmenu");
            this.set_applet_tooltip(_("launch a custom gtk menu"));
        }
        catch (e) {
            global.logError(e);
        }
     },

    on_applet_clicked: function(event) {
        GLib.spawn_command_line_async( GLib.get_home_dir() + '/.local/share/cinnamon/applets/gtkMenu@karlitos.net/gtkmenu/GtkMenu');
    }
};

function main(metadata, orientation) {
    let myApplet = new MyApplet(orientation);
    return myApplet;
}
