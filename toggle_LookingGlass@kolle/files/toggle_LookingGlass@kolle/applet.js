const Applet = imports.ui.applet;
const Main = imports.ui.main;

// l10n
const GLib = imports.gi.GLib;
const Gettext = imports.gettext;
let UUID;

function _(str) {
    return Gettext.dgettext(UUID, str);
}

function MyApplet(metadata, orientation) {
    this._init(metadata, orientation);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(metadata, orientation) {
        Applet.IconApplet.prototype._init.call(this, orientation);

        try {
            UUID = metadata.uuid;
            Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");

            this.set_applet_icon_name("logviewer");
            this.set_applet_tooltip(_("Click here to toggle LookingGlass"));
            this.openglass = false;
        }
        catch (e) {
            global.logError(e);
        }
     },

    on_applet_clicked: function(event) {
        try {
            Main.createLookingGlass().toggle();
        } catch (e) {
            if (this.openglass)
	            Main.createLookingGlass().close();
            else
                Main.createLookingGlass().open();
            this.openglass = !this.openglass;
        }
    }
};

function main(metadata, orientation) {
    let myApplet = new MyApplet(metadata, orientation);
    return myApplet;
}