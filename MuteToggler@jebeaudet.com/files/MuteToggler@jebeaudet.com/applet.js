const Applet = imports.ui.applet;
const Lang = imports.lang;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;
const Util = imports.misc.util;
const Settings = imports.ui.settings;
const GLib = imports.gi.GLib;

const {to_string} = require("./lib/to-string");

const APPNAME = "MuteToggler";
const UUID = APPNAME + "@jebeaudet.com";

var VERBOSE = true; // VERBOSE value will be changed according to this applet settings.

/**
 * Usage of log and logError:
 * log("Any message here") to log the message only if VERBOSE is set to true.
 * log("Any message here", true) to log the message even if VERBOSE is set to false.
 * logError("Any error message") to log the error message regardless of the VERBOSE value.
 */
function log(message, alwaysLog=false) {
  if (VERBOSE|| alwaysLog) global.log("[" + APPNAME + "]: " + message);
}

function logError(error) {
  global.logError("\n[" + APPNAME + "]: " + error + "\n")
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(metadata, orientation, panel_height, instance_id) {
        try {
            this.settings = new Settings.AppletSettings(this, UUID, instance_id);
            VERBOSE = this.settings.getValue("verbose");
            log("Initializing applet");
            Applet.IconApplet.prototype._init.call(this, orientation, panel_height, instance_id);
            //~ this.uuid = UUID;

            this.set_applet_tooltip(_("Click to mute/unmute microphone"));

            try {
                this.settings.bindProperty(Settings.BindingDirection.IN,
                                     "keybinding",
                                     "keybinding",
                                     this.on_settings_changed,
                                     null);
                this.settings.bindProperty(Settings.BindingDirection.IN,
                                     "verbose",
                                     "verbose",
                                     this.on_settings_changed,
                                     null);

                log("Initializing settings")
            } catch (e) {
                logError(e);
                log("Error initializing from Settings, continuing.", true);
                this.settings = null;
                this.keybinding = null;
                this.verbose = true
            }

            if (this.settings) {
                this.on_settings_changed();
            }

            this.amixer = "amixer";
            const parameters = ["", " -D pulse"];
            for (let param of parameters) {
                let cmd = this.amixer + param + " scontrols";
                log("Test mixer command '" + cmd + "'");
                let [res, stdout] = GLib.spawn_command_line_sync(cmd);
                if (res && to_string(stdout).indexOf("'Capture'") != -1) {
                    this.amixer += param;
                    log("Use mixer command '" + this.amixer + "'");
                    break;
                }
            }

            this.set_not_muted_icon();
            this.is_audio_muted();

            this.refresh_loop();
            log("Done initializing applet")
        } catch (e) {
            logError(e);
        }
    },

    on_settings_changed: function() {
        if (this.keybinding != null) {
            // "unassigned" is not a valid value:
            if (this.keybinding === "unassigned")
                this.keybinding ="";
            if (this.keybinding.length > 0)
                Main.keybindingManager.addHotKey(UUID, this.keybinding, Lang.bind(this, this.on_applet_clicked));
        }

        VERBOSE = this.verbose;
    },

    refresh_loop: function() {
        this.is_audio_muted();
        Mainloop.timeout_add(1000, Lang.bind(this, this.refresh_loop));
    },

    is_audio_muted: function() {
        try {
            let cmd = [
                "sh",
                "-c",
                this.amixer + " sget Capture"
                ];
            Util.spawn_async(cmd, (stdout) => {
                try{
                    if(stdout.indexOf("] [on]") != -1){
                        this.set_not_muted_icon();
                    } else {
                        this.set_muted_icon();
                    }
                }catch(e){
                    logError(e);
                }
            });
        } catch (e) {
            logError(e);
        }
    },

    set_not_muted_icon: function() {
        this.current_icon = "not_muted";
        this.set_applet_icon_name("not_muted");
    },

    set_muted_icon: function() {
        this.current_icon = "muted";
        this.set_applet_icon_name("muted");
    },

    on_applet_clicked: function(event) {
        try{
            let cmd = [
                "sh",
                "-c",
                this.amixer + " set Capture toggle"
            ];
            Util.spawn_async(cmd, (stdout) => {
                this.is_audio_muted();
        });
        }catch(e){
            logError(e);
        }
    }
};

function MyApplet(metadata, orientation, panel_height, instance_id) {
    this._init(metadata, orientation, panel_height, instance_id);
}

function main(metadata, orientation, panel_height, instance_id) {
    let myApplet = new MyApplet(metadata, orientation, panel_height, instance_id);
    return myApplet;
}
