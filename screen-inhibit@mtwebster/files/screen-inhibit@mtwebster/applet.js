const Applet = imports.ui.applet;
const Lang = imports.lang;
const Util = imports.misc.util;
const Main = imports.ui.main;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Settings = imports.ui.settings;

const UUID = 'screen-inhibit@mtwebster';
const Gettext = imports.gettext;

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale")

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

function MyApplet(metadata, orientation, panel_height, instance_id) {
    this._init(metadata, orientation, panel_height, instance_id);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(metadata, orientation, panel_height, instance_id) {
        Applet.IconApplet.prototype._init.call(this, orientation, panel_height, instance_id);
        this.uuid = "screen-inhibit@mtwebster";

        this.icon_path_on = false;
        this.icon_path_off = false;

        try {
            this.settings = new Settings.AppletSettings(this, this.uuid, instance_id);
            this.settings.bindProperty(Settings.BindingDirection.IN,
                                 "off-icon",
                                 "off_icon",
                                 this.on_settings_changed,
                                 null);
            this.settings.bindProperty(Settings.BindingDirection.IN,
                                 "on-icon",
                                 "on_icon",
                                 this.on_settings_changed,
                                 null);
            this.settings.bindProperty(Settings.BindingDirection.IN,
                                 "keybinding",
                                 "keybinding",
                                 this.on_settings_changed,
                                 null);
        } catch (e) {
            this.settings = null;
            this.off_icon = "video-display-symbolic";
            this.on_icon = "dialog-error-symbolic";
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

        if (this.settings) {
            this.on_settings_changed();
        }

        this.screen_menu_item = new Applet.MenuItem(_("Screensaver settings"), 'system-run-symbolic',
                                                    Lang.bind(this, this._screen_menu));
        this._applet_context_menu.addMenuItem(this.screen_menu_item);
    },

    on_settings_changed: function() {
        if (this.keybinding != null)
            Main.keybindingManager.addHotKey(this.uuid, this.keybinding, Lang.bind(this, this.on_applet_clicked));

        let on_file = Gio.file_new_for_path(this.on_icon);
        let off_file = Gio.file_new_for_path(this.off_icon);

        this.icon_path_on = on_file.query_exists(null);
        this.icon_path_off = off_file.query_exists(null);

        this.update_icon();
    },

    _screen_menu: function() {
        if (GLib.find_program_in_path("cinnamon-control-center")) {
            Util.spawn(['cinnamon-settings', 'screensaver']);
        }
    },

    on_applet_clicked: function(event) {
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
            }
        }
        this.update_icon();
    },

    update_icon: function() {
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
    },
};

function main(metadata, orientation, panel_height, instance_id) {
    let myApplet = new MyApplet(metadata, orientation, panel_height, instance_id);
    return myApplet;
}
