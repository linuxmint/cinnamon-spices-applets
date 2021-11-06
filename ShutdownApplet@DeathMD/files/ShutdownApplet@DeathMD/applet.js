//System Shutdown and Restart Applet
const Applet = imports.ui.applet;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const Util = imports.misc.util;
const GLib = imports.gi.GLib;
const Gettext = imports.gettext;

const UUID = "ShutdownApplet@DeathMD";

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale")

function _(str) {
  return Gettext.dgettext(UUID, str);
}

function MyApplet(orientation) {
    this._init(orientation);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(orientation) {
        Applet.IconApplet.prototype._init.call(this, orientation);

        try {
            this.set_applet_icon_symbolic_name("system-shutdown");
            this.set_applet_tooltip(_("Shutdown"));
            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager.addMenu(this.menu);
            this._contentSection = new PopupMenu.PopupMenuSection();
            this.menu.addMenuItem(this._contentSection);

            this.menu.addAction(_("Screen Lock"), function(event) {
                Util.spawnCommandLine("cinnamon-screensaver-command --lock");
            });

            this.menu.addAction(_("Suspend"), function(event) {
                Util.spawnCommandLine("systemctl suspend");
            });

            this.menu.addAction(_("Restart"), function(event) {
                Util.spawnCommandLine("systemctl reboot");
            });

            this.menu.addAction(_("Log Out"), function(event) {
                Util.spawnCommandLine("gnome-session-quit --no-prompt");
            });

            this.menu.addAction(_("Shutdown"), function(event) {
                Util.spawnCommandLine("systemctl poweroff");
            });
        }
        catch (e) {
            global.logError(e);
        }
    },

    on_applet_clicked: function(event) {
        this.menu.toggle();
    }
};

function main(metadata, orientation) {
    let myApplet = new MyApplet(orientation);
    return myApplet;
}
