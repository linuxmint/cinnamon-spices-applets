const Applet = imports.ui.applet;
const Lang = imports.lang;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;
const Util = imports.misc.util;
const Settings = imports.ui.settings;
const GLib = imports.gi.GLib;

const UUID = 'MuteToggler@jebeaudet.com';


MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,
    
    _init: function(metadata, orientation, panel_height, instance_id) {
        try {
            global.log("MuteToggler: Initializing applet")
            Applet.IconApplet.prototype._init.call(this, orientation, panel_height, instance_id);
            this.uuid = UUID;
            
            this.set_applet_tooltip(_("Click to mute/unmute microphone"));

            try {
                global.log("MuteToggler: Initializing settings")
                this.settings = new Settings.AppletSettings(this, this.uuid, instance_id);
                this.settings.bindProperty(Settings.BindingDirection.IN,
                                     "keybinding",
                                     "keybinding",
                                     this.on_settings_changed,
                                     null);      
            } catch (e) {
                global.logError(e);
                global.log("Error initializing from Settings, continuing.")
                this.settings = null;
                this.keybinding = null;
            }

            if (this.settings) {
                this.on_settings_changed();
            }

            this.amixer = "amixer";
            const parameters = ["", " -D pulse"];
            for (let param of parameters) {
                let cmd = this.amixer + param + " scontrols";
                global.log("MuteToggler: Test mixer command '" + cmd + "'");
                let [res, stdout] = GLib.spawn_command_line_sync(cmd);
                var string = new TextDecoder().decode(stdout);
                if (res && string.indexOf("'Capture'") != -1) {
                    this.amixer += param;
                    global.log("MuteToggler: Use mixer command '" + this.amixer + "'");
                    break;
                } 
            }
            
            this.set_not_muted_icon();
            this.is_audio_muted();
            
            this.refresh_loop();
            global.log("MuteToggler: Done initializing applet")
        } catch (e) {
            global.logError(e);
        }
    },

    on_settings_changed: function() {
        if (this.keybinding != null) {
            Main.keybindingManager.addHotKey(this.uuid, this.keybinding, Lang.bind(this, this.on_applet_clicked));
        }
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
                    global.logError(e);
                }
            });
        } catch (e) {
            global.logError(e);
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
            global.logError(e);
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
