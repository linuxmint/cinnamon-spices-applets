const Applet = imports.ui.applet;
const Lang = imports.lang;
const Util = imports.misc.util;
const Main = imports.ui.main;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Settings = imports.ui.settings;
const { PopupSwitchMenuItem, PopupSeparatorMenuItem } = imports.ui.popupMenu;

const UUID = 'screen-inhibit@mtwebster';
const Gettext = imports.gettext;
const HOME_DIR = GLib.get_home_dir();

Gettext.bindtextdomain(UUID, HOME_DIR + "/.local/share/locale")

function _(str) {
  return Gettext.dgettext(UUID, str);
}

const INHIBIT_TT = _("Currently preventing screensaver");
const ALLOW_TT = _("Currently allowing screensaver");

const SessionManagerIface = '\
<node> \
    <interface name="org.gnome.SessionManager"> \
        <method name="Logout"> \
            <arg type="u" direction="in" /> \
        </method> \
        <method name="Shutdown" /> \
        <method name="CanShutdown"> \
            <arg type="b" direction="out" /> \
        </method> \
        <method name="Inhibit"> \
            <arg type="s" direction="in" /> \
            <arg type="u" direction="in" /> \
            <arg type="s" direction="in" /> \
            <arg type="u" direction="in" /> \
            <arg type="u" direction="out" /> \
        </method> \
        <method name="Uninhibit"> \
            <arg type="u" direction="in" /> \
        </method> \
    </interface> \
</node>';

var SessionManagerProxy = Gio.DBusProxy.makeProxyWrapper(SessionManagerIface);
function SessionManager(initCallback, cancellable) {
    return new SessionManagerProxy(Gio.DBus.session, 'org.gnome.SessionManager', '/org/gnome/SessionManager', initCallback, cancellable);
}

class ScreenSaverInhibitor extends Applet.IconApplet {
    constructor(metadata, orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);
        this.uuid = UUID;

        this.icon_path_on = false;
        this.icon_path_off = false;

        try {
            this.settings = new Settings.AppletSettings(this, this.uuid, instance_id);
            this.settings.bind( "off-icon",
                                "off_icon",
                                this.on_settings_changed);
            this.settings.bind( "on-icon",
                                "on_icon",
                                this.on_settings_changed);
            this.settings.bind( "keybinding",
                                "keybinding",
                                this.on_settings_changed);
            this.settings.bind( "inhibit-at-startup",
                                "inhibit_at_startup",
                                this.on_inhibit_at_startup_changed);
        } catch (e) {
            this.settings = null;
            this.off_icon = "screen-inhibit-symbolic"; // "video-display-symbolic";
            this.on_icon =  "screen-inhibit-active-symbolic"; // "dialog-error-symbolic";
            this.keybinding = null;
            this.icon_path_on = false;
            this.icon_path_off = false;
        }

        try {
            this.set_applet_icon_symbolic_name(this.off_icon);
            this.set_applet_tooltip(ALLOW_TT);

            this._inhibit = undefined;
            this.inhibited = false;

            SessionManager(Lang.bind(this, function(obj, err) {
                this._sessionProxy = obj;
            }));

            this._onInhibit = function(cookie) {
                this._inhibit = cookie;
            };
        } catch (e) {
            global.logError(e);
        }

        this.screen_menu_item = new Applet.MenuItem(_("Screensaver settings"), 'system-run-symbolic',
                                                    Lang.bind(this, this._screen_menu));
        this._applet_context_menu.addMenuItem(this.screen_menu_item);

        this.startup_menu_item = new PopupSwitchMenuItem(_("Inhibit screensaver at startup"),
            this.inhibit_at_startup, null);
        this.startup_menu_item.connect("toggled", Lang.bind(this, function() {
          this.inhibit_at_startup = !this.inhibit_at_startup;
        }));
        this._applet_context_menu.addMenuItem(new PopupSeparatorMenuItem());
        this._applet_context_menu.addMenuItem(this.startup_menu_item);

        if (this.settings) {
            this.on_settings_changed();
        }
    }

    on_inhibit_at_startup_changed() {
        this.startup_menu_item._switch.setToggleState(this.inhibit_at_startup);
    }

    on_settings_changed() {
        if (this.keybinding != null)
            Main.keybindingManager.addHotKey(this.uuid, this.keybinding, Lang.bind(this, this.on_applet_clicked));

        let on_file = Gio.file_new_for_path(this.on_icon);
        let off_file = Gio.file_new_for_path(this.off_icon);

        this.icon_path_on = on_file.query_exists(null);
        this.icon_path_off = off_file.query_exists(null);

        this.update_icon();
    }

    _screen_menu() {
        Util.spawn(['cinnamon-settings', 'screensaver']);
    }

    on_applet_clicked(event) {
        if (this._inhibit) {
            this._sessionProxy.UninhibitRemote(this._inhibit);
            this._inhibit = undefined;
            this.set_applet_tooltip(ALLOW_TT);
            this.inhibited = false;
        } else {
            try {
                this._sessionProxy.InhibitRemote("inhibitor-screen-inhibit@mtwebster",
                                                 0,
                                                 "inhibit mode",
                                                 9,
                                                 Lang.bind(this, this._onInhibit));
                this.set_applet_tooltip(INHIBIT_TT);
                this.inhibited = true;
            } catch(e) {
                global.log("Unable to inhibit screensaver: "+e);
            }
        }
        this.update_icon();
    }

    update_icon() {
        if (this.inhibited) {
            if (this.icon_path_on) {
                this.set_applet_icon_path(this.on_icon)
            } else {
                if (this.on_icon.indexOf("symbolic") > -1)
                    this.set_applet_icon_symbolic_name(this.on_icon)
                else
                    this.set_applet_icon_name(this.on_icon)
            }
        } else {
            if (this.icon_path_off) {
                this.set_applet_icon_path(this.off_icon)
            } else {
                if (this.off_icon.indexOf("symbolic") > -1)
                    this.set_applet_icon_symbolic_name(this.off_icon)
                else
                    this.set_applet_icon_name(this.off_icon)
            }
        }
    }

    inhibit_screensaver() {
        if (this._inhibit != undefined) return;

        this._sessionProxy.InhibitRemote(
          "inhibitor-screen-inhibit@mtwebster",
          0,
          "inhibit mode",
          9,
          Lang.bind(this, this._onInhibit)
        );

        this.inhibited = true;

        this.update_icon();
    }

    on_applet_added_to_panel() {
        if (this.inhibit_at_startup && !this.inhibited) {
            let id = setInterval ( () => {
                if (this._sessionProxy) { // Ensures that this._sessionProxy is defined.
                    this.on_applet_clicked();
                    clearTimeout(id);
                }
            }, 300);
        }
    }

    reset_to_default_icons() {
        this.off_icon = HOME_DIR + "/.local/share/cinnamon/applets/screen-inhibit@mtwebster/icons/screen-inhibit-symbolic.svg";
        this.on_icon = HOME_DIR + "/.local/share/cinnamon/applets/screen-inhibit@mtwebster/icons/screen-inhibit-active-symbolic.svg";
        this.on_settings_changed();
    }
};

function main(metadata, orientation, panel_height, instance_id) {
    return new ScreenSaverInhibitor(metadata, orientation, panel_height, instance_id);
}
