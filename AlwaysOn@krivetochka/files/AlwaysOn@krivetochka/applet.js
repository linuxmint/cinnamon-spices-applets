const Applet = imports.ui.applet;
const Settings = imports.ui.settings;
const Main = imports.ui.main;
const GLib = imports.gi.GLib;
const Gettext = imports.gettext;
const Gio = imports.gi.Gio;
const Lang = imports.lang;
const uuid = "AlwaysOn@krivetochka";
const symbolic_icon_name = "lapt_symb_empty";
const symbolic_active_icon_name = "lapt_symb";
const colored_icon_name = "lapt_color_empty";
const colored_active_icon_name = "lapt_color";
const PANEL_EDIT_MODE_KEY = "panel-edit-mode";
let giosettings = new Gio.Settings({ schema: 'org.cinnamon.settings-daemon.plugins.power' });
let switcher = true;


// translation support
Gettext.bindtextdomain(uuid, GLib.get_home_dir() + "/.local/share/locale");
function _(str) {
    return Gettext.dgettext(uuid, str);
}

class AlwaysOn extends Applet.IconApplet {
    constructor (metadata, orientation, panelHeight, instance_id) {
        super(orientation, panelHeight, instance_id);
        this.set_applet_icon_symbolic_name(symbolic_icon_name);
        this.set_applet_tooltip(_("Click here to activate AlwaysOn"));
        this.settings = new Settings.AppletSettings(this, uuid, instance_id);
        this.settings.bind("idle-dim-battery", "idle_dim_battery_switch");
        this.settings.bind("sleep-inactive", "sleep_inactive_switch");
        this.settings.bind("sleep-display", "sleep_display_switch");
        this.settings.bind("notificate", "notificate");
        this.settings.bind("choose-icon", "icon_type", this.on_settings_changed);
        this.settings.bind("hide-applet", "hide_applet_switcher", this.on_settings_changed);
        this.settings.bind("key-bind", "keybind", this.on_shortcut_changed)

        global.settings.connect('changed::' + PANEL_EDIT_MODE_KEY, Lang.bind(this, this.on_settings_changed));
        this.on_shortcut_changed();
        this.on_settings_changed();
    }

    on_applet_clicked(event) {
        if(switcher){        
            // Activate applet functions
            if (this.idle_dim_battery_switch) {
                this.idle_dim_bat = giosettings.get_boolean('idle-dim-battery');
                giosettings.set_boolean('idle-dim-battery', false);
            }
            
            if (this.sleep_inactive_switch) {
                this.sleep_ac_time = giosettings.get_int('sleep-inactive-ac-timeout');
                this.sleep_bat_time = giosettings.get_int('sleep-inactive-battery-timeout');
                giosettings.set_int('sleep-inactive-ac-timeout', 0);
                giosettings.set_int('sleep-inactive-battery-timeout', 0);
            }
            
            if (this.sleep_display_switch) {
                this.sleep_disp_ac_time = giosettings.get_int('sleep-display-ac');
                this.sleep_disp_bat_time = giosettings.get_int('sleep-display-battery');
                giosettings.set_int('sleep-display-ac', 0);
                giosettings.set_int('sleep-display-battery', 0);
            }
            
            if (this.notificate){
                Main.notify(_("AlwaysOn activated"), _("Your computer will now stay active."));
            }
            if (this.icon_type === "SYMBOLIC"){
                this.set_applet_icon_symbolic_name(symbolic_active_icon_name);
            }
            else{
                this.set_applet_icon_name(colored_active_icon_name);
            }
            this.set_applet_tooltip(_("Deactivate AlwaysOn"));
        }
        else{
            // Deactivate applet functions
            giosettings.set_boolean("idle-dim-battery", this.idle_dim_bat)
            giosettings.set_int('sleep-inactive-ac-timeout', this.sleep_ac_time);
            giosettings.set_int('sleep-inactive-battery-timeout', this.sleep_bat_time);
            giosettings.set_int('sleep-display-ac', this.sleep_disp_ac_time);
            giosettings.set_int('sleep-display-battery', this.sleep_disp_bat_time);            

            if (this.notificate){
                Main.notify(_("AlwaysOn deactivated"), _("Now your computer can go to sleep."));
            }
            if (this.icon_type === "SYMBOLIC"){
                this.set_applet_icon_symbolic_name(symbolic_icon_name);
            }
            else{
                this.set_applet_icon_name(colored_icon_name);
            }
            this.set_applet_tooltip(_("Activate AlwaysOn"));
        }
        switcher = !switcher
    }

    on_settings_changed() {
        // icon settings changed
        if (this.icon_type === "SYMBOLIC"){
            if (!switcher){
                this.set_applet_icon_symbolic_name(symbolic_active_icon_name);
            }
            else{
                this.set_applet_icon_symbolic_name(symbolic_icon_name);
            }
        }
        else{
            if (!switcher){
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
        Main.keybindingManager.addHotKey(uuid, this.keybind, Lang.bind(this, this.on_applet_clicked));
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new AlwaysOn(metadata, orientation, panel_height, instance_id);
}
