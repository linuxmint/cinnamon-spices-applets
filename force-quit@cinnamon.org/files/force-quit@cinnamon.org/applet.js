const Lang = imports.lang;
const Applet = imports.ui.applet;
const GLib = imports.gi.GLib;
const Gettext = imports.gettext;
const UUID = "force-quit@cinnamon.org";

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");

function _(str) {
    return Gettext.dgettext(UUID, str);
}

function MyApplet(metadata, orientation, panelHeight, instanceId) {
    this._init(metadata, orientation, panelHeight, instanceId);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(metadata, orientation, panelHeight, instanceId) {
        Applet.IconApplet.prototype._init.call(this, orientation, panelHeight, instanceId);

        try {
            this.set_applet_icon_symbolic_name("window-close");
            this.set_applet_tooltip(_("Click here to kill a window"));
            this.actor.connect('button-release-event', Lang.bind(this, this._onButtonReleaseEvent));
        }
        catch (e) {
            global.logError(e);
        }
    },

    _onButtonReleaseEvent: function(actor, event) {
        if (this._applet_enabled) {
            if (event.get_button() == 1) {
                if (!this._draggable.inhibit) {
                    return false;
                } else {
                    GLib.spawn_command_line_async('xkill');
                }
            }
        }
        return true;
    }

};

function main(metadata, orientation, panelHeight, instanceId) {
    let myApplet = new MyApplet(metadata, orientation, panelHeight, instanceId);
    return myApplet;
}
