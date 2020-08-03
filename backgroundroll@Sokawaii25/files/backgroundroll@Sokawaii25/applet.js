const Applet = imports.ui.applet;
const Util = imports.misc.util;
const Settings = imports.ui.settings;
const GLib = imports.gi.GLib;
const Cinnamon = imports.gi.Cinnamon;
const Gio = imports.gi.Gio;

function run(cmd) {
    try {
        let [result, stdout, stderr] = GLib.spawn_command_line_sync(cmd);
        if (stdout != null) {
            return stdout.toString();
        }
    } catch (error) {
        global.logError(error.message);
    }
}

class BackgroundRoll extends Applet.IconApplet {
    constructor(metadata, orientation, panel_height, instanceId) {
        super(orientation, panel_height, instanceId);

        //VARIABLES
        this.user=run("id -un");
        this.user=this.user.trim();
        this.command="/home/"+this.user+"/.local/share/cinnamon/applets/backgroundroll@Sokawaii25/background.sh";

        //Applet Decoration
        try {
            this.set_applet_icon_path("/home/"+this.user+"/.local/share/cinnamon/applets/backgroundroll@Sokawaii25/icons/icon.svg");
            this.set_applet_tooltip("Click to change the background");
        }
        catch (e) {
            global.logError(e);
        };

        //Applet Settings
        this.settings = new Settings.AppletSettings(this, "backgroundroll@Sokawaii25", instanceId);
        this.settings.bind("Notifications", "notifs", this.on_notifs_changed);
    }

    on_notifs_changed() {
        if (this.notifs) {
            Util.spawnCommandLine("notify-send \"Background Roll\" \"Notifications activated\"");
        } else {
            Util.spawnCommandLine("notify-send \"Background Roll\" \"Notifications deactivated\"");
        }
    }

    on_applet_clicked(event) {
        Util.spawnCommandLine(this.command);

        if (this.notifs) {
            Util.spawnCommandLine("notify-send \"Background Roll\" \"Background changed\"");
        }
    }

    on_applet_removed_from_panel() {
        this.settings.finalize();
    }
}

function main(metadata, orientation, panel_height, instanceId) {
    return new BackgroundRoll(metadata, orientation, panel_height, instanceId);
}
