const Applet = imports.ui.applet;
const Lang = imports.lang;
const Util = imports.misc.util;
const Main = imports.ui.main;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Settings = imports.ui.settings;
const { PopupSwitchMenuItem, PopupSeparatorMenuItem } = imports.ui.popupMenu;
const Mainloop = imports.mainloop;

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

const POWER_SCHEMA = "org.cinnamon.settings-daemon.plugins.power";
const SLEEP_DISPLAY_AC_KEY = "sleep-display-ac";
const SLEEP_INACTIVE_AC_TIMEOUT_KEY = "sleep-inactive-ac-timeout";

const SCREENSAVER_COMMAND = GLib.find_program_in_path("cinnamon-screensaver-command");

class ScreenSaverInhibitor extends Applet.IconApplet {
    constructor(metadata, orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);
        this.uuid = UUID;

        this.icon_path_on = false;
        this.icon_path_off = false;

        this.power_settings = new Gio.Settings({ schema_id: POWER_SCHEMA });

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
            this.settings.bind( "locktype",
                                "locktype",
                                this.loop);
            this.settings.bind( "lockinterval",
                                "lockinterval",
                                this.loop);
            this.settings.bind( "old-sleep-display-ac",
                                "old_sleep_display_ac");
            this.settings.bind( "old-sleep-inactive-ac-timeout",
                                "old_sleep_inactive_ac_timeout");
        } catch (e) {
            this.settings = null;
            this.off_icon = "screen-inhibit-symbolic"; // "video-display-symbolic";
            this.on_icon =  "screen-inhibit-active-symbolic"; // "dialog-error-symbolic";
            this.keybinding = null;
            this.icon_path_on = false;
            this.icon_path_off = false;
            this.locktype = "normal";
            this.lockinterval = 5;
            this.old_sleep_display_ac = 0;
            this.old_sleep_inactive_ac_timeout = 0;
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

        this.loopId = null;
        this.loop();
    }

    loop() {
        if (this.loopId) {
            Mainloop.source_remove(this.loopId);
            this.loopId = null;
        }

        if (this.inhibited) {
            switch (this.locktype) {
                case "normal":
                    break;
                case "aggressive1":
                    if (SCREENSAVER_COMMAND)
                        Util.spawnCommandLineAsync(SCREENSAVER_COMMAND+" -d");
                    break;
                case "aggressive2":
                    if (SCREENSAVER_COMMAND)
                        Util.spawnCommandLineAsync(SCREENSAVER_COMMAND+" -e");
            }
        }

        this.loopId = Mainloop.timeout_add(this.lockinterval * 60000, this.loop.bind(this));
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
            this.sleep_display_ac = this.old_sleep_display_ac;
            this.sleep_inactive_ac_timeout = this.old_sleep_inactive_ac_timeout;
            this._sessionProxy.UninhibitRemote(this._inhibit);
            if (SCREENSAVER_COMMAND)
                Util.spawnCommandLineAsync(SCREENSAVER_COMMAND+" -a; "+SCREENSAVER_COMMAND+" -d");
            this._inhibit = undefined;
            this.set_applet_tooltip(ALLOW_TT);
            this.inhibited = false;
        } else {
            this.sleep_display_ac = 0;
            this.sleep_inactive_ac_timeout = 0;
            try {
                this._sessionProxy.InhibitRemote(
                    "inhibitor-screen-inhibit@mtwebster",
                    0,
                    "inhibit mode",
                    9,
                    Lang.bind(this, this._onInhibit)
                );
                if (SCREENSAVER_COMMAND)
                    Util.spawnCommandLineAsync(SCREENSAVER_COMMAND+" -e");
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

        if (SCREENSAVER_COMMAND)
            Util.spawnCommandLineAsync(SCREENSAVER_COMMAND+" -e");

        this.inhibited = true;
        this.sleep_display_ac = 0;
        this.sleep_inactive_ac_timeout = 0;

        this.update_icon();
    }

    on_applet_added_to_panel() {
        if (this.sleep_display_ac != 0 && this.sleep_display_ac != this.old_sleep_display_ac)
            this.old_sleep_display_ac = this.sleep_display_ac;

        if (this.sleep_inactive_ac_timeout != 0 && this.sleep_inactive_ac_timeout != this.old_sleep_inactive_ac_timeout)
            this.old_sleep_inactive_ac_timeout = this.sleep_inactive_ac_timeout;

        if (this.inhibit_at_startup && !this.inhibited) {
            let id = setInterval ( () => {
                if (this._sessionProxy) { // Ensures that this._sessionProxy is defined.
                    this.on_applet_clicked();
                    clearTimeout(id);
                }
            }, 300);
        }
    }

    on_applet_removed_from_panel() {
        this.sleep_display_ac = this.old_sleep_display_ac;
        this.sleep_inactive_ac_timeout = this.old_sleep_inactive_ac_timeout;
        if (this.loopId) {
            Mainloop.source_remove(this.loopId);
            this.loopId = null;
        }
    }

    reset_to_default_icons() {
        this.off_icon = HOME_DIR + "/.local/share/cinnamon/applets/screen-inhibit@mtwebster/icons/screen-inhibit-symbolic.svg";
        this.on_icon = HOME_DIR + "/.local/share/cinnamon/applets/screen-inhibit@mtwebster/icons/screen-inhibit-active-symbolic.svg";
        this.on_settings_changed();
    }

    get sleep_display_ac() {
        return this.power_settings.get_int(SLEEP_DISPLAY_AC_KEY);
    }

    set sleep_display_ac(value) {
        this.power_settings.set_int(SLEEP_DISPLAY_AC_KEY, value);
    }

    get sleep_inactive_ac_timeout() {
        return this.power_settings.get_int(SLEEP_INACTIVE_AC_TIMEOUT_KEY);
    }

    set sleep_inactive_ac_timeout(value) {
        this.power_settings.set_int(SLEEP_INACTIVE_AC_TIMEOUT_KEY, value);
    }
};

function main(metadata, orientation, panel_height, instance_id) {
    return new ScreenSaverInhibitor(metadata, orientation, panel_height, instance_id);
}
