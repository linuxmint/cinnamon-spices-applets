const Applet = imports.ui.applet;
const Settings = imports.ui.settings;
const Main = imports.ui.main;
const GLib = imports.gi.GLib;
const Gettext = imports.gettext;
const Gio = imports.gi.Gio;
const uuid = "AlwaysOn@krivetochka";
const symbolic_icon_name = "lapt_symb_empty";
const symbolic_active_icon_name = "lapt_symb";
const colored_icon_name = "lapt_color_empty";
const colored_active_icon_name = "lapt_color";
const PANEL_EDIT_MODE_KEY = "panel-edit-mode";
let giosettings = new Gio.Settings({ schema: 'org.cinnamon.settings-daemon.plugins.power' });


// translation support
Gettext.bindtextdomain(uuid, GLib.get_home_dir() + "/.local/share/locale");
function _(str) {
    return Gettext.dgettext(uuid, str);
}

class AlwaysOn extends Applet.IconApplet {
    constructor (metadata, orientation, panelHeight, instance_id) {
        super(orientation, panelHeight, instance_id);
        this._uuid = metadata.uuid;
        this._isActive = false;
        this._idleDimBat = null;
        this._sleepAcTime = null;
        this._sleepBatTime = null;
        this._sleepDispAcTime = null;
        this._sleepDispBatTime = null;
        this._lidCloseAcAction = null;
        this._lidCloseBatAction = null;
        this._systemBus = Gio.DBus.system;
        this._prepareForShutdownSignalId = 0;

        this.set_applet_icon_symbolic_name(symbolic_icon_name);
        this.set_applet_tooltip(_("Click here to activate AlwaysOn"));
        this.settings = new Settings.AppletSettings(this, this._uuid, instance_id);
        this.settings.bind("idle-dim-battery", "idle_dim_battery_switch");
        this.settings.bind("sleep-inactive", "sleep_inactive_switch");
        this.settings.bind("sleep-display", "sleep_display_switch");
        this.settings.bind("lid-close-action", "lid_close_action_switch");
        this.settings.bind("notificate", "notificate");
        this.settings.bind("choose-icon", "icon_type", this.on_settings_changed);
        this.settings.bind("hide-applet", "hide_applet_switcher", this.on_settings_changed);
        this.settings.bind("key-bind", "keybind", this.on_shortcut_changed);

        this._panelEditSignalId = global.settings.connect('changed::' + PANEL_EDIT_MODE_KEY, this.on_settings_changed.bind(this));
        this._prepareForShutdownSignalId = this._systemBus.signal_subscribe(
            "org.freedesktop.login1",
            "org.freedesktop.login1.Manager",
            "PrepareForShutdown",
            "/org/freedesktop/login1",
            null,
            Gio.DBusSignalFlags.NONE,
            this._onPrepareForShutdown.bind(this)
        );
        this.on_shortcut_changed();
        this.on_settings_changed();
    }

    _onPrepareForShutdown(conn, senderName, objectPath, interfaceName, signalName, parameters) {
        let isStarting = false;

        if (parameters) {
            try {
                isStarting = parameters.deep_unpack()[0];
            } catch (e) {
                isStarting = false;
            }
        }

        if (isStarting && this._isActive) {
            this._deactivateAlwaysOn(false);
        }
    }

    _activateAlwaysOn() {
        if (this.idle_dim_battery_switch) {
            this._idleDimBat = giosettings.get_boolean('idle-dim-battery');
            giosettings.set_boolean('idle-dim-battery', false);
        }

        if (this.sleep_inactive_switch) {
            this._sleepAcTime = giosettings.get_int('sleep-inactive-ac-timeout');
            this._sleepBatTime = giosettings.get_int('sleep-inactive-battery-timeout');
            giosettings.set_int('sleep-inactive-ac-timeout', 0);
            giosettings.set_int('sleep-inactive-battery-timeout', 0);
        }

        if (this.sleep_display_switch) {
            this._sleepDispAcTime = giosettings.get_int('sleep-display-ac');
            this._sleepDispBatTime = giosettings.get_int('sleep-display-battery');
            giosettings.set_int('sleep-display-ac', 0);
            giosettings.set_int('sleep-display-battery', 0);
        }

        if (this.lid_close_action_switch) {
            this._lidCloseAcAction = giosettings.get_string('lid-close-ac-action');
            this._lidCloseBatAction = giosettings.get_string('lid-close-battery-action');
            giosettings.set_string('lid-close-ac-action', 'nothing');
            giosettings.set_string('lid-close-battery-action', 'nothing');
        }

        this._isActive = true;

        if (this.notificate) {
            Main.notify(_("AlwaysOn activated"), _("Your computer will now stay active."));
        }

        this.on_settings_changed();
        this.set_applet_tooltip(_("Deactivate AlwaysOn"));
    }

    _deactivateAlwaysOn(showNotification = true) {
        if (this._idleDimBat !== null) {
            giosettings.set_boolean('idle-dim-battery', this._idleDimBat);
        }

        if (this._sleepAcTime !== null) {
            giosettings.set_int('sleep-inactive-ac-timeout', this._sleepAcTime);
        }

        if (this._sleepBatTime !== null) {
            giosettings.set_int('sleep-inactive-battery-timeout', this._sleepBatTime);
        }

        if (this._sleepDispAcTime !== null) {
            giosettings.set_int('sleep-display-ac', this._sleepDispAcTime);
        }

        if (this._sleepDispBatTime !== null) {
            giosettings.set_int('sleep-display-battery', this._sleepDispBatTime);
        }

        if (this._lidCloseAcAction !== null) {
            giosettings.set_string('lid-close-ac-action', this._lidCloseAcAction);
        }

        if (this._lidCloseBatAction !== null) {
            giosettings.set_string('lid-close-battery-action', this._lidCloseBatAction);
        }

        this._idleDimBat = null;
        this._sleepAcTime = null;
        this._sleepBatTime = null;
        this._sleepDispAcTime = null;
        this._sleepDispBatTime = null;
        this._lidCloseAcAction = null;
        this._lidCloseBatAction = null;
        this._isActive = false;

        if (showNotification && this.notificate) {
            Main.notify(_("AlwaysOn deactivated"), _("Now your computer can go to sleep."));
        }

        this.on_settings_changed();
        this.set_applet_tooltip(_("Activate AlwaysOn"));
    }

    on_applet_clicked(event) {
        if (!this._isActive) {
            this._activateAlwaysOn();
        } else {
            this._deactivateAlwaysOn();
        }
    }

    on_settings_changed() {
        // icon settings changed
        if (this.icon_type === "SYMBOLIC"){
            if (this._isActive){
                this.set_applet_icon_symbolic_name(symbolic_active_icon_name);
            }
            else{
                this.set_applet_icon_symbolic_name(symbolic_icon_name);
            }
        }
        else{
            if (this._isActive){
                this.set_applet_icon_name(colored_active_icon_name);
            }
            else{
                this.set_applet_icon_name(colored_icon_name);
            }
        }

        // hide applet setting changed
        if (!this.hide_applet_switcher || global.settings.get_boolean(PANEL_EDIT_MODE_KEY)){
                this.actor.show();
            } else {
                this.actor.hide();
            }
        }

    on_shortcut_changed() {
        Main.keybindingManager.removeHotKey(this._uuid);
        Main.keybindingManager.addHotKey(this._uuid, this.keybind, this.on_applet_clicked.bind(this));
    }

    on_applet_removed_from_panel() {
        if (this._isActive) {
            this._deactivateAlwaysOn(false);
        }

        Main.keybindingManager.removeHotKey(this._uuid);

        if (this._panelEditSignalId) {
            global.settings.disconnect(this._panelEditSignalId);
            this._panelEditSignalId = 0;
        }

        if (this._systemBus && this._prepareForShutdownSignalId) {
            this._systemBus.signal_unsubscribe(this._prepareForShutdownSignalId);
            this._prepareForShutdownSignalId = 0;
        }

        if (this.settings) {
            this.settings.finalize();
            this.settings = null;
        }
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new AlwaysOn(metadata, orientation, panel_height, instance_id);
}
