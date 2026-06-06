const Applet = imports.ui.applet;
const Lang = imports.lang;
const Util = imports.misc.util;
const Main = imports.ui.main;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Settings = imports.ui.settings;
const { PopupSwitchMenuItem, PopupSeparatorMenuItem } = imports.ui.popupMenu;
//~ const Mainloop = imports.mainloop;
const {
  timeout_add_seconds,
  setInterval,
  clearInterval,
  source_exists,
  source_remove,
  remove_all_sources
} = require("./lib/mainloopTools");

const UUID = 'screen-inhibit@mtwebster';
const Gettext = imports.gettext;
const HOME_DIR = GLib.get_home_dir();
const APPLET_DIR = HOME_DIR + "/.local/share/cinnamon/applets/" + UUID;
const ICONS_DIR = APPLET_DIR + "/icons";

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

const versionCompare = (left, right) => {
    if (typeof left + typeof right != "stringstring")
        return false;
    
    let a = left.split(".");
    let b = right.split(".");
    let len = Math.min(a.length, b.length);
    
    for (let i = 0; i < len; i++) {
        let l = parseInt(a[i], 10);
        let r = parseInt(b[i], 10);
        if (isNaN(l) || isNaN(r))
            return false;
        if (l > r) {
            return 1;
        } else if (l < r) {
            return -1;
        }
    }
    
    return 0;
};

//~ const Cin_6dot4_or_more = versionCompare(GLib.getenv('CINNAMON_VERSION'), "6.4") >= 0;

const POWER_SCHEMA = "org.cinnamon.settings-daemon.plugins.power";
const POWER_SLEEP_DISPLAY_AC_KEY = "sleep-display-ac";
const POWER_SLEEP_INACTIVE_AC_TIMEOUT_KEY = "sleep-inactive-ac-timeout";

const SCREENSAVER_SCHEMA = "org.cinnamon.desktop.session";
const SCREENSAVER_IDLE_DELAY_KEY = "idle-delay";

//~ var POWER_SCHEMA2 = "org.cinnamon.settings-daemon.plugins.power";
//~ if (Cin_6dot4_or_more)
    //~ POWER_SCHEMA2 = "org.cinnamon.desktop.session";

//~ var SLEEP_DISPLAY_AC_KEY = "sleep-display-ac";
//~ if (Cin_6dot4_or_more)
    //~ SLEEP_DISPLAY_AC_KEY = "idle-delay";


const SCREENSAVER_COMMAND = GLib.find_program_in_path("cinnamon-screensaver-command");

class ScreenSaverInhibitor extends Applet.IconApplet {
    constructor(metadata, orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);
        this.uuid = UUID;

        this.icon_path_on = false;
        this.icon_path_off = false;

        this.power_settings = new Gio.Settings({ schema_id: POWER_SCHEMA });
        this.screensaver_settings = new Gio.Settings({ schema_id: SCREENSAVER_SCHEMA });

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
            this.settings.bind( "seconds-after-startup",
                                "seconds_after_startup",
                                null);
            this.settings.bind( "end-timechooser",
                                "end_time",
                                this.on_endtime_changed);
            this.settings.bind( "end-type",
                                "end_type",
                                this.on_endtime_changed);
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
            this.settings.bind( "starting-time-in-minutes",
                                "starting_time_in_minutes");
            this.settings.bind( "old-idle-delay",
                                "old_idle_delay");
        } catch (e) {
            this.settings = null;
            this.off_icon = "screen-inhibit-symbolic"; // "video-display-symbolic";
            this.on_icon =  "screen-inhibit-active-symbolic"; // "dialog-error-symbolic";
            this.keybinding = null;
            this.icon_path_on = false;
            this.icon_path_off = false;
            this.locktype = "normal";
            this.lockinterval = 5;
            this.old_sleep_display_ac = this.sleep_display_ac;
            this.old_sleep_inactive_ac_timeout = this.sleep_inactive_ac_timeout;
            this.old_idle_delay = this.idle_delay;
        }

        try {
            this.set_applet_icon_symbolic_name(this.off_icon);
            this.set_applet_tooltip(ALLOW_TT);

            this._inhibit = undefined;
            this.inhibited = false;

            //~ SessionManager(Lang.bind(this, function(obj, err) {
                //~ this._sessionProxy = obj;
            //~ }));
            SessionManager((obj, err) => {
                this._sessionProxy = obj;
            });

            this._onInhibit = function(cookie) {
                this._inhibit = cookie;
            };
        } catch (e) {
            global.logError(e);
        }

        this.screen_menu_item = new Applet.MenuItem(_("Screensaver settings"), 'system-run-symbolic',
                                                    () => { this._screen_menu() });
        this._applet_context_menu.addMenuItem(this.screen_menu_item);

        this.power_menu_item = new Applet.MenuItem(_("Power settings"), 'system-run-symbolic',
                                                    () => { this._power_menu() });
        this._applet_context_menu.addMenuItem(this.power_menu_item);

        this.startup_menu_item = new PopupSwitchMenuItem(_("Inhibit screensaver at startup"),
            this.inhibit_at_startup, null);
        this.startup_menu_item.connect("toggled", () => {
          this.inhibit_at_startup = !this.inhibit_at_startup;
        });
        this._applet_context_menu.addMenuItem(new PopupSeparatorMenuItem());
        this._applet_context_menu.addMenuItem(this.startup_menu_item);

        if (this.settings) {
            this.on_settings_changed();
        }

        this.loopId = null;
        this.loop();
    }

    loop() {
        if (source_exists(this.loopId)) {
            //~ Mainloop.source_remove(this.loopId);
            source_remove(this.loopId);
            this.loopId = null;
        }

        if (this.inhibited) {
            if (!this.is_end_time()) {
                switch (this.locktype) {
                    case "normal":
                        this.lockinterval = 1;
                        break;
                    case "aggressive1":
                        if (SCREENSAVER_COMMAND)
                            Util.spawnCommandLineAsync(SCREENSAVER_COMMAND+" -d");
                        break;
                    case "aggressive2":
                        if (SCREENSAVER_COMMAND)
                            Util.spawnCommandLineAsync(SCREENSAVER_COMMAND+" -e");
                }
            } else {
                this.starting_time_in_minutes = 0;
                this.end_type = 0;
                this.on_applet_clicked()
            }
        }

        //~ this.loopId = Mainloop.timeout_add(this.lockinterval * 60000, this.loop.bind(this));
        this.loopId = timeout_add_seconds(this.lockinterval * 60, this.loop.bind(this));
    }

    is_end_time() {
        if (this.end_type === 0)
            return false;
        const date = new Date;
        const hour = date.getHours();
        const minute = date.getMinutes();
        if (this.end_type === 2 && (hour*60+minute >= this.end_time.h*60+this.end_time.m))
            return true;
        if (this.end_type === 1 && (hour*60+minute - this.starting_time_in_minutes <= this.end_time.h*60+this.end_time.m))
            return true;
        return false;
    }

    on_endtime_changed() {
        const date = new Date;
        const hour = date.getHours();
        const minute = date.getMinutes();

        this.starting_time_in_minutes = hour*60+minute;
    }

    on_inhibit_at_startup_changed() {
        this.startup_menu_item._switch.setToggleState(this.inhibit_at_startup);
    }

    on_settings_changed() {
        if (this.keybinding != null)
            Main.keybindingManager.addHotKey(this.uuid, this.keybinding, () => { this.on_applet_clicked() });

        let on_file = Gio.file_new_for_path(this.on_icon);
        let off_file = Gio.file_new_for_path(this.off_icon);

        this.icon_path_on = on_file.query_exists(null);
        this.icon_path_off = off_file.query_exists(null);

        this.update_icon();
    }

    _screen_menu() {
        Util.spawn(['cinnamon-settings', 'screensaver']);
    }
    
    _power_menu() {
        Util.spawn(['cinnamon-settings', 'power']);
    }

    on_applet_clicked(event) {
        if (this._inhibit) {
            this.sleep_display_ac = this.old_sleep_display_ac;
            this.sleep_inactive_ac_timeout = this.old_sleep_inactive_ac_timeout;
            this.idle_delay = this.old_idle_delay;
            this._sessionProxy.UninhibitRemote(this._inhibit);
            if (SCREENSAVER_COMMAND)
                Util.spawnCommandLineAsync(SCREENSAVER_COMMAND+" -a; "+SCREENSAVER_COMMAND+" -d");
            this._inhibit = undefined;
            this.set_applet_tooltip(ALLOW_TT);
            this.inhibited = false;
        } else {
			if (this.sleep_display_ac != 0)
				this.old_sleep_display_ac = this.sleep_display_ac;
			if (this.sleep_inactive_ac_timeout != 0)
				this.old_sleep_inactive_ac_timeout = this.sleep_inactive_ac_timeout;
            if (this.idle_delay != 0)
                this.old_idle_delay = this.idle_delay;
            this.sleep_display_ac = 0;
            this.sleep_inactive_ac_timeout = 0;
            this.idle_delay = 0;
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
            
        if (this.idle_delay != 0 && this.idle_delay != this.old_idle_delay)
            this.old_idle_delay = this.idle_delay;

        if (this.inhibit_at_startup && !this.inhibited) {
            let id = setInterval ( () => {
                if (this._sessionProxy) { // Ensures that this._sessionProxy is defined.
                    clearInterval(id);
                    if (!this.inhibited)
                        this.on_applet_clicked();
                }
            }, (this.seconds_after_startup === 0) ? 300 : 1000 * this.seconds_after_startup);
        }
    }

    on_applet_removed_from_panel() {
        this.sleep_display_ac = this.old_sleep_display_ac;
        this.sleep_inactive_ac_timeout = this.old_sleep_inactive_ac_timeout;
        this.idle_delay = this.old_idle_delay;
        if (source_exists(this.loopId)) {
            //~ Mainloop.source_remove(this.loopId);
            source_remove(this.loopId);
            this.loopId = null;
        }
        remove_all_sources();
    }

    reset_to_default_icons() {
        this.off_icon = ICONS_DIR + "/screen-inhibit-symbolic.svg";
        this.on_icon = ICONS_DIR + "/screen-inhibit-active-symbolic.svg";
        this.on_settings_changed();
    }

    get sleep_display_ac() {
        //~ return Math.abs(this.power_settings.get_value(POWER_SLEEP_DISPLAY_AC_KEY));
        var ret;
        try {
            ret = this.power_settings.get_int(POWER_SLEEP_DISPLAY_AC_KEY);
        } catch(e) {
            ret = this.power_settings.get_uint(POWER_SLEEP_DISPLAY_AC_KEY);
        }
        return ret;
    }

    set sleep_display_ac(value) {
        //~ this.power_settings.set_value(POWER_SLEEP_DISPLAY_AC_KEY, Math.abs(value));
        try {
            this.power_settings.set_int(POWER_SLEEP_DISPLAY_AC_KEY, Math.abs(value));
        } catch(e) {
            this.power_settings.set_uint(POWER_SLEEP_DISPLAY_AC_KEY, Math.abs(value));
        }
    }

    get sleep_inactive_ac_timeout() {
        return this.power_settings.get_int(POWER_SLEEP_INACTIVE_AC_TIMEOUT_KEY);
    }

    set sleep_inactive_ac_timeout(value) {
        this.power_settings.set_int(POWER_SLEEP_INACTIVE_AC_TIMEOUT_KEY, Math.abs(value));
    }
    
    get idle_delay() {
        var ret;
        try {
            ret = this.screensaver_settings.get_uint(SCREENSAVER_IDLE_DELAY_KEY);
        } catch(e) {
            ret = this.screensaver_settings.get_int(SCREENSAVER_IDLE_DELAY_KEY);
        }
        return ret;
    }
    
    set idle_delay(value) {
        try {
            this.screensaver_settings.set_uint(SCREENSAVER_IDLE_DELAY_KEY, Math.abs(value));
        } catch(e) {
            this.screensaver_settings.set_int(SCREENSAVER_IDLE_DELAY_KEY, Math.abs(value));
        }
    }
};

function main(metadata, orientation, panel_height, instance_id) {
    return new ScreenSaverInhibitor(metadata, orientation, panel_height, instance_id);
}
