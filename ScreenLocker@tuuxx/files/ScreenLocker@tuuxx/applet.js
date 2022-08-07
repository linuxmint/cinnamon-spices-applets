const Lang = imports.lang;
const Applet = imports.ui.applet;
const GLib = imports.gi.GLib;
const Gettext = imports.gettext;
const UUID = "ScreenLocker@tuuxx";
Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale")

function _(str) {
    return Gettext.dgettext(UUID, str);
}

function MyApplet(orientation, panelHeight, instance_id) {
    this._init(orientation, panelHeight, instance_id);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(orientation, panelHeight, instance_id) {
        Applet.IconApplet.prototype._init.call(this, orientation, panelHeight, instance_id);

        try {
            this.set_applet_icon_symbolic_name("system-lock-screen");
            this.set_applet_tooltip(_("Click to lock the screen immediately"));
        }
        catch (e) {
            global.logError(e);
        }
    },

    on_applet_clicked: function(event) {
        GLib.spawn_command_line_async('cinnamon-screensaver-command --lock');
    }

};

function main(metadata, orientation, panelHeight, instance_id) {
    let myApplet = new MyApplet(orientation, panelHeight, instance_id);
    return myApplet;
}
