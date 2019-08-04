const Applet = imports.ui.applet;
const Lang = imports.lang;
const Util = imports.misc.util;
const Main = imports.ui.main;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Settings = imports.ui.settings;

const UUID = 'notification-mute@jgillula';
const Gettext = imports.gettext;

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale")

const DEFAULT_OFF_ICON = "allow-notifications-symbolic";
const DEFAULT_ON_ICON = "mute-notifications-symbolic";

function _(str) {
  return Gettext.dgettext(UUID, str);
}

const INHIBIT_TT = _("Currently preventing notifications");
const ALLOW_TT = _("Currently allowing notifications");

function MyApplet(metadata, orientation, panel_height, instance_id) {
    this._init(metadata, orientation, panel_height, instance_id);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(metadata, orientation, panel_height, instance_id) {
        Applet.IconApplet.prototype._init.call(this, orientation, panel_height, instance_id);
        this.uuid = UUID;

        this.icon_path_on = false;
        this.icon_path_off = false;

        try {
            this.settings = new Settings.AppletSettings(this, this.uuid, instance_id);
            this.settings.bindProperty(Settings.BindingDirection.IN,
                                 "use-custom-off-icon",
                                 "use_custom_off_icon",
                                 this.on_settings_changed,
                                 null);
            this.settings.bindProperty(Settings.BindingDirection.IN,
                                 "off-icon",
                                 "off_icon",
                                 this.on_settings_changed,
                                 null);
            this.settings.bindProperty(Settings.BindingDirection.IN,
                                 "use-custom-on-icon",
                                 "use_custom_on_icon",
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
            this.off_icon = DEFAULT_OFF_ICON;
            this.on_icon = DEFAULT_ON_ICON;
            this.keybinding = null;
            this.icon_path_on = false;
            this.icon_path_off = false;
        }

        try {
            this.set_applet_icon_symbolic_name(this.off_icon);
            this.set_applet_tooltip(ALLOW_TT);

            this.inhibited = false;

            this.notif_settings = new Gio.Settings({ schema_id: "org.cinnamon.desktop.notifications" });
            this.notif_settings.connect('changed::display-notifications', Lang.bind(this, function() {
                this.set_icon_status(!this.notif_settings.get_boolean("display-notifications"));
            }));
        } catch (e) {
            global.logError(e);
        }

        if (this.settings) {
            this.on_settings_changed();
        }

        this.notification_menu_item = new Applet.MenuItem(_("Notification settings"), 'system-run-symbolic',
                                                    Lang.bind(this, this._notification_menu));
        this._applet_context_menu.addMenuItem(this.notification_menu_item);
    },

    on_settings_changed: function() {
        if (this.keybinding != null) {
            Main.keybindingManager.addHotKey(this.uuid, this.keybinding, Lang.bind(this, this.on_applet_clicked));
        }
            
        let on_file = Gio.file_new_for_path(this.on_icon);
        let off_file = Gio.file_new_for_path(this.off_icon);

        this.icon_path_on = on_file.query_exists(null);
        this.icon_path_off = off_file.query_exists(null);

        this.update_icon();
    },

    _notification_menu: function() {
        if (GLib.find_program_in_path("cinnamon-control-center")) {
            Util.spawn(['cinnamon-settings', 'notifications']);
        }
    },

    set_icon_status: function(status) {
        this.inhibited = status;
        this.update_icon();
    },
    
    on_applet_clicked: function(event) {
        if (this.inhibited) {
            this.notif_settings.set_boolean("display-notifications", true)
            this.set_applet_tooltip(ALLOW_TT);
            this.inhibited = false;
        } else {
            this.notif_settings.set_boolean("display-notifications", false)
            this.set_applet_tooltip(INHIBIT_TT);
            this.inhibited = true;
        }
        this.update_icon();
    },

    update_icon: function() {
        if (this.inhibited) {
            if (this.use_custom_on_icon) {
                if (this.icon_path_on) {
                    this.set_applet_icon_path(this.on_icon)
                } else {
                    if (this.on_icon.indexOf("symbolic") > -1) {
                        this.set_applet_icon_symbolic_name(this.on_icon)
                    } else {
                        this.set_applet_icon_name(this.on_icon)
                    }
                }
            } else {
                this.set_applet_icon_symbolic_name(DEFAULT_ON_ICON);
            }
        } else {
            if(this.use_custom_off_icon) {
                if (this.icon_path_off) {
                    this.set_applet_icon_path(this.off_icon)
                } else {
                    if (this.off_icon.indexOf("symbolic") > -1) {
                        this.set_applet_icon_symbolic_name(this.off_icon)
                    } else {
                        this.set_applet_icon_name(this.off_icon)
                    }
                }
            } else {
                this.set_applet_icon_symbolic_name(DEFAULT_OFF_ICON);
            }
        }
    },
};

function main(metadata, orientation, panel_height, instance_id) {
    let myApplet = new MyApplet(metadata, orientation, panel_height, instance_id);
    return myApplet;
}
