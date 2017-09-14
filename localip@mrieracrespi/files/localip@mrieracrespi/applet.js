const Applet = imports.ui.applet;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const GLib = imports.gi.GLib;
const Gettext = imports.gettext;
const UUID = "localip@mrieracrespi";
const REFRESH_INTERVAL = 60

// l10n/translation support
// ----------
Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale")

function _(str) {
  return Gettext.dgettext(UUID, str);
}

// Logging
// ----------
function log(message) {
    global.log(UUID + '#' + log.caller.name + ': ' + message);
}

function logError(error) {
    global.logError(UUID + '#' + logError.caller.name + ': ' + error);
}


// Applet
// ----------
function MyApplet(orientation) {
    this._init(orientation);
}

MyApplet.prototype = {
    __proto__: Applet.TextApplet.prototype,

    _init: function (orientation) {
        Applet.TextIconApplet.prototype._init.call(this, orientation);

        try {
            this.set_applet_icon_name("emblem-web");
            this.set_applet_tooltip(_("Your percieved location."));
            this.set_applet_label("...");
        }
        catch (error) {
            logError(error);
        }

        this.refreshLocation();
    },

    refreshLocation: function refreshLocation() {
        let [res, out] = GLib.spawn_command_line_sync(" hostname -I ")

        out = String(out).replace("\n", "");
        out = String(out).trim();
        out = String(out).replace(/ /g, " - ");

        this.set_applet_label('' + out + '');

        Mainloop.timeout_add_seconds(REFRESH_INTERVAL, Lang.bind(this, function refreshTimeout() {
            this.refreshLocation();
        }));
    }
};

function main(metadata, orientation) {
    let myapplet = new MyApplet(orientation);
    return myapplet;
}
