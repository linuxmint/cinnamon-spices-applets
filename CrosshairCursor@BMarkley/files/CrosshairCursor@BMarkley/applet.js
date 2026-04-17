const Applet = imports.ui.applet;
const GLib = imports.gi.GLib;
const St = imports.gi.St;
const Util = imports.misc.util;
const HOME = GLib.get_home_dir();
const UUID = "CrosshairCursor@BMarkley";
const USER_DATA_DIR = GLib.get_user_data_dir()
const APPLET_DIR = USER_DATA_DIR + "/cinnamon/applets/" + UUID;
const CROSSHAIR_SCRIPT = APPLET_DIR + "/CCScript.sh";
const CROSSHAIR_DIR = APPLET_DIR + "/CrosshairCursor";
const CROSSHAIR_COMPILE = CROSSHAIR_DIR + "/Compile.sh";
const CROSSHAIR_EXEC = CROSSHAIR_DIR + "/CrosshairCursor";
const DEBUG = false;
const {
    timeout_add,
    timeout_add_seconds,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    source_remove,
    remove_all_sources
} = require("./lib/mainloopTools");
const { to_string } = require("./lib/to-string");

const Gettext = imports.gettext;
Gettext.bindtextdomain(UUID, USER_DATA_DIR + "/locale");

function _(str) {
   let customTranslation = Gettext.dgettext(UUID, str);
   if(customTranslation != str) {
      return customTranslation;
   }
   return Gettext.gettext(str);
}

class CrosshairCursorToggle extends Applet.IconApplet {
    constructor(metadata, orientation, panel_height, instanceId) {
        super(orientation, panel_height, instanceId);
        if (DEBUG) global.log("CrosshairCursor is initialized");
        this.orientation = orientation;
        this.updateIcon();
        this._tooltip_ok();
        // compile CrossHairCursor from source
        Util.spawnCommandLine(`/usr/bin/env bash -c 'chmod +x ${CROSSHAIR_COMPILE}'`);
        Util.spawnCommandLine(CROSSHAIR_COMPILE);
        // make executable the script CrosshairCursor.sh:
        Util.spawnCommandLine(`/usr/bin/env bash -c 'chmod +x ${CROSSHAIR_SCRIPT}'`);
        // make executable the CrosshairCursor executable program:
        Util.spawnCommandLine(`/usr/bin/env bash -c 'chmod +x ${CROSSHAIR_EXEC}'`);
    }

    on_applet_clicked(event) {
        //if (DEBUG) global.log(_("CrosshairCursorToggle is clicked"));
        GLib.spawn_command_line_async(CROSSHAIR_SCRIPT);
        // Delay update to allow process start/stop
        timeout_add( 250, () => {
            this.updateIcon();
            return GLib.SOURCE_REMOVE;
        });
    }
    
    _tooltip_ok() {
        this.set_applet_tooltip(_("Crosshair Cursor"));
    }

    checkIfProgramRunning(programName) {
        // Runs pgrep synchronously, returns true/false
        try {
            let [ok, stdout, stderr, status] = GLib.spawn_command_line_sync(`pgrep -x ${programName}`);
            if (ok && status === 0 && to_string(stdout).trim().length > 0) {
                return true;
            }
        } catch (e) {
            global.logError(e);
        }
        return false;
    }

    updateIcon() {
        if (this.checkIfProgramRunning("CrosshairCursor")) {
            this.set_applet_icon_name("CrosshairCursorRunning");
            if (DEBUG) global.log("CrosshairCursor is running");
        } else {
            this.set_applet_icon_name("CrosshairCursorStopped");
            if (DEBUG) global.log("CrosshairCursor is stopped");
        }
    }

    on_applet_removed_from_panel(deleteconfig) {
        remove_all_sources();
    }
}

function main(metadata, orientation, panelHeight, instanceId) {
    return new CrosshairCursorToggle(metadata, orientation, panelHeight, instanceId);
}
