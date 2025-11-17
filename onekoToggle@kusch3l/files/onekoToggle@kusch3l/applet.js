const Applet = imports.ui.applet;
const GLib = imports.gi.GLib;
const St = imports.gi.St;
const Util = imports.misc.util;
const HOME = GLib.get_home_dir();
const UUID = "onekoToggle@kusch3l";
const APPLET_DIR = HOME + "/.local/share/cinnamon/applets/" + UUID;
const ONEKO_SCRIPT = APPLET_DIR + "/oneko.sh";
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
Gettext.bindtextdomain(UUID, HOME + "/.local/share/locale");

function _(str) {
   let customTranslation = Gettext.dgettext(UUID, str);
   if(customTranslation != str) {
      return customTranslation;
   }
   return Gettext.gettext(str);
}

class OnekoToggle extends Applet.IconApplet {
    constructor(metadata, orientation, panel_height, instanceId) {
        super(orientation, panel_height, instanceId);
        if (DEBUG) global.log("onekoToggle is initialized");
        this.orientation = orientation;
        this.updateIcon();
        this._tooltip_ok();
        // make executable the script oneko.sh:
        Util.spawnCommandLine(`/usr/bin/env bash -c 'chmod +x ${ONEKO_SCRIPT}'`);
    }

    on_applet_clicked(event) {
        //if (DEBUG) global.log(_("onekoToggle is clicked"));

        if (GLib.find_program_in_path("oneko")) {
            GLib.spawn_command_line_async(ONEKO_SCRIPT);
        } else {
            // oneko is not installed:
            if (DEBUG) global.log(_("oneko is not installed!"));
            if (GLib.find_program_in_path("pkexec")) {
                if (DEBUG) global.log(_("trying to install oneko"));
                Util.spawnCommandLineAsync(
                    "pkexec pkcon -y install oneko",
                    () => {
                        this._tooltip_ok();
                        timeout_add_seconds(
                            10,
                            () => {
                                //callback:
                                // waiting oneko installation:
                                if (GLib.find_program_in_path("oneko")) {
                                    // install is ok:
                                    this._tooltip_ok();
                                    return GLib.SOURCE_REMOVE; // stop loop
                                } else {
                                    // wait again:
                                    this._tooltip_need_install();
                                    return GLib.SOURCE_CONTINUE; // one more loop (10 seconds later)
                                }
                            }
                        )},
                    () => {
                        //errback:
                        this._tooltip_need_install();
                    }
                );
            } else {
                this._tooltip_need_install();
            }
        }


        // Delay update to allow process start/stop
        timeout_add( 250, () => {
            this.updateIcon();
            return GLib.SOURCE_REMOVE;
        });
    }

    _tooltip_ok() {
        this.set_applet_tooltip(_("Click to toggle Oneko"));
    }

    _tooltip_need_install() {
        this.set_applet_tooltip(_("Please install oneko using root rights."));
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
        if (this.checkIfProgramRunning("oneko")) {
            this.set_applet_icon_name("running");
            if (DEBUG) global.log("oneko is running");
        } else {
            this.set_applet_icon_name("stopped");
            if (DEBUG) global.log("oneko is stopped");
        }
    }

    on_applet_removed_from_panel(deleteconfig) {
        remove_all_sources();
    }
}

function main(metadata, orientation, panelHeight, instanceId) {
    return new OnekoToggle(metadata, orientation, panelHeight, instanceId);
}
