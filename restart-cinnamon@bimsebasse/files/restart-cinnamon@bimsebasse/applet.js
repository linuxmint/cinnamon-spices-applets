const Lang = imports.lang;
const Applet = imports.ui.applet;
const GLib = imports.gi.GLib;
const Gettext = imports.gettext.domain('cinnamon-applets');
const Gtk = imports.gi.Gtk;
const _ = Gettext.gettext;

function MyApplet(metadata, orientation) {
    this._init(metadata, orientation);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(metadata, orientation) {
        Applet.IconApplet.prototype._init.call(this, orientation);
	Gtk.IconTheme.get_default().append_search_path(metadata.path);
        try {
            this.set_applet_icon_symbolic_name("restart");
            this.set_applet_tooltip(_("Click here to restart Cinnamon"));
        }
        catch (e) {
            global.logError(e);
        }
     },

    on_applet_clicked: function(event) {
        global.reexec_self();
    }
};

function main(metadata, orientation) {
    let myApplet = new MyApplet(metadata, orientation);
    return myApplet;
}
