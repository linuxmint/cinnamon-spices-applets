const Applet = imports.ui.applet;
const Settings = imports.ui.settings;
const Util = imports.misc.util;
const Main = imports.ui.main;
const GLib = imports.gi.GLib;
const Gettext = imports.gettext;
const uuid = "AlwaysOn@krivetochka";
const symbolic_icon_name = "lapt_symb_empty"
const symbolic_active_icon_name = "lapt_symb"
const colored_icon_name = "lapt_color_empty"
const colored_active_icon_name = "lapt_color"
let switcher = true


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
        this.settings.bind("choose-icon", "icon_type", this.on_iconsettings_changed);
    }

    on_applet_clicked(event) {
        if(switcher){        
            // Activate applet functions
            if (this.idle_dim_battery_switch){
                Util.spawnCommandLineAsyncIO('gsettings get org.cinnamon.settings-daemon.plugins.power idle-dim-battery', (stdout) => {
                    this.idle_dim_bat = stdout;
                });
                Util.spawnCommandLine('gsettings set org.cinnamon.settings-daemon.plugins.power idle-dim-battery false');
            }
            if (this.sleep_inactive_switch) {
                Util.spawnCommandLineAsyncIO('gsettings get org.cinnamon.settings-daemon.plugins.power sleep-inactive-ac-timeout', (stdout) => {
                    this.sleep_ac_time = stdout;
                });
                Util.spawnCommandLineAsyncIO('gsettings get org.cinnamon.settings-daemon.plugins.power sleep-inactive-battery-timeout', (stdout) => {
                    this.sleep_bat_time = stdout;
                });
                Util.spawnCommandLine('gsettings set org.cinnamon.settings-daemon.plugins.power sleep-inactive-ac-timeout 0') //sleep mode when idle
                Util.spawnCommandLine('gsettings set org.cinnamon.settings-daemon.plugins.power sleep-inactive-battery-timeout 0')
            }
            if (this.sleep_display_switch){
                Util.spawnCommandLineAsyncIO('gsettings get org.cinnamon.settings-daemon.plugins.power sleep-display-ac', (stdout) => {
                    this.sleep_disp_ac_time = stdout;
                });
                Util.spawnCommandLineAsyncIO('gsettings get org.cinnamon.settings-daemon.plugins.power sleep-display-battery', (stdout) => {
                    this.sleep_disp_bat_time = stdout;
                });
                Util.spawnCommandLine('gsettings set org.cinnamon.settings-daemon.plugins.power sleep-display-ac 0') //turning off the screen when idle
                Util.spawnCommandLine('gsettings set org.cinnamon.settings-daemon.plugins.power sleep-display-battery 0')
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
            Util.spawnCommandLine('gsettings set org.cinnamon.settings-daemon.plugins.power idle-dim-battery ' + this.idle_dim_bat)
            Util.spawnCommandLine('gsettings set org.cinnamon.settings-daemon.plugins.power sleep-inactive-ac-timeout ' + this.sleep_ac_time) //sleep mode when idle
            Util.spawnCommandLine('gsettings set org.cinnamon.settings-daemon.plugins.power sleep-inactive-battery-timeout ' + this.sleep_bat_time)
            Util.spawnCommandLine('gsettings set org.cinnamon.settings-daemon.plugins.power sleep-display-ac ' + this.sleep_disp_ac_time) //turning off the screen when idle
            Util.spawnCommandLine('gsettings set org.cinnamon.settings-daemon.plugins.power sleep-display-battery ' + this.sleep_disp_bat_time)

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

    on_iconsettings_changed(){
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
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new AlwaysOn(metadata, orientation, panel_height, instance_id);
}
