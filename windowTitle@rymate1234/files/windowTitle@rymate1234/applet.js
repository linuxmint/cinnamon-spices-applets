const Lang = imports.lang;
const Applet = imports.ui.applet;
const GLib = imports.gi.GLib;
const Gettext = imports.gettext;
const Cinnamon = imports.gi.Cinnamon;
const Meta = imports.gi.Meta;
const UUID = "windowTitle@rymate1234";

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale")

function _(str) {
  return Gettext.dgettext(UUID, str);
}

function MyApplet(orientation) {
    this._init(orientation);
}

MyApplet.prototype = {
    __proto__: Applet.TextApplet.prototype,


    _init: function(orientation) {
        Applet.TextApplet.prototype._init.call(this, orientation);

        try {
            this.set_applet_label(_("Desktop"));
            this.set_applet_tooltip(_("This should be showing the current window title."));

            let tracker = Cinnamon.WindowTracker.get_default();
            tracker.connect('notify::focus-app', Lang.bind(this, this._onFocus));

            tracker.connect('notify::title', Lang.bind(this, this._onTitleChange));

        }
        catch (e) {
            global.logError(e);
        }
    },

    on_applet_clicked: function(event) {
        this.set_applet_label(global.display.focus_window.get_title());
    },

    _onFocus: function() {
        this.set_applet_label(global.display.focus_window.get_title());
    },  

    _onTitleChange: function() {
        this.set_applet_label(global.display.focus_window.get_title());
    }

}

function main(metadata, orientation) {
    let myApplet = new MyApplet(orientation);
    return myApplet;
}
