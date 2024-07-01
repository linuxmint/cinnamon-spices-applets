const Util = imports.misc.util;
const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu; //PopupMenu
const St = imports.gi.St; //Icon
const Lang = imports.lang;
const Main = imports.ui.main;
const Mainloop = imports.mainloop; //Updating Labels
const GLib = imports.gi.GLib; //Executing Shell commands and scripts
const Gio = imports.gi.Gio;
const System = imports.system;
const Settings = imports.ui.settings; //Import settings-schema.json

const UUID = "bose@tuuxx"

const audioMode = {
    a2dp: "a2dp_sink",
    headset: "headset_head_unit",
};

function MyMenu(launcher, orientation) {
    this._init(launcher, orientation);
}

MyMenu.prototype = {
    __proto__: PopupMenu.PopupMenu.prototype,
    _init: function(launcher, orientation) {
        this._launcher = launcher;
        PopupMenu.PopupMenu.prototype._init.call(this, launcher.actor, 0.0, orientation, 0);
        Main.uiGroup.add_actor(this.actor);
        this.actor.hide();
    }
};

function MyApplet(orientation, panel_height, instance_id) {
    this._init(orientation, panel_height, instance_id);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,
    menuBattery: PopupMenu.PopupMenuItem,
    menuSettings: PopupMenu.PopupSubMenuMenuItem,
    menuSwitch: PopupMenu.PopupMenuItem,
    menuConnect: PopupMenu.PopupMenuItem,
    //path: "./.local/share/cinnamon/applets/bose@tuuxx/based-connect/based-connect",
    //address: "xx:xx:xx:xx:xx:xx", //Address of the device
    refreshTime: 3000, //time until refresh in seconds
    connection: false, //true if device is connected
    audioMode: "unknown", //audioMode

    _init: function(orientation, panel_height, instance_id) {
        Applet.IconApplet.prototype._init.call(this, orientation, panel_height, instance_id);
        this.settings = new Settings.AppletSettings(this, "bose@tuuxx", instance_id);

        //Settings
        this.settings.bind("address", // The setting key, from the setting schema file
            "address", // The property to bind the setting to - in this case it will initialize this.icon_name to the setting value
            this.on_settings_changed, // The method to call when this.icon_name has changed, so you can update your applet
            null); // Any extra information you want to pass to the callback (optional - pass null or just leave out this last argument)

        this.settings.bind("path",
            "path",
            this.on_settings_changed,
            null);


        //Stats
        this.set_applet_icon_symbolic_name("headphone"); //Icon when ending -symbolic
        //this.set_applet_icon_name("network-wireless-offline-symbolic"); //Icon Name
        this.set_applet_tooltip("Bose Headphone");

        //Menu
        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);
        this._contentSection = new PopupMenu.PopupMenuSection();
        this.menu.addMenuItem(this._contentSection);

        this.createMenu();
        this.updateData();
        this._UpdateData();
    },

    createMenu: function() {
        //System Icons liegen im Ordner: /usr/share/icons/Mint-X/
        this.menuBattery = new PopupMenu.PopupIconMenuItem("Battery", "battery-missing", St.IconType.SYMBOLIC);
        //this.menuSettings = new PopupMenu.PopupIconMenuItem("Settings", "system-run", St.IconType.SYMBOLIC);
        //this.menu.addMenuItem(this.menuSettings);
        this.menuSettings = new PopupMenu.PopupSubMenuMenuItem("Settings");
        this.menuConnect = new PopupMenu.PopupIconMenuItem("Connect", "bluetooth-active-symbolic", St.IconType.FULLCOLOR);
        this.menuSwitch = new PopupMenu.PopupIconMenuItem("Switch A2DP/HFP", "audio-x-generic-symbolic", St.IconType.SYMBOLIC);

        this.menuBattery.connect('activate', function() {
            this.updateData();
        }.bind(this));
        this.menuConnect.connect('activate', function() {
            this.switchConnection();
        }.bind(this));
        this.menuSwitch.connect('activate', function() {
            this.switchAudioSource();
        }.bind(this));

        this.menu.addMenuItem(this.menuBattery);
        this.menu.addMenuItem(this.menuConnect);
        this.menu.addMenuItem(this.menuSwitch);
    },

    updateConnection: function() {
        //Connection has changed
        if (this.connection) {
            this.menuConnect.label.set_text("Disconnect");
            this.set_applet_icon_symbolic_name("headphone"); //Icon Name
            this.menuConnect.setIconSymbolicName("bluetooth-active-symbolic");
        } else {
            this.menuConnect.label.set_text("Connect");
            this.set_applet_icon_symbolic_name("headphone-offline"); //Icon Name
            this.menuConnect.setIconSymbolicName("bluetooth-active-symbolic");
        }
    },

    checkConnection: function() {
        var out = 0;
        var res = 0;
        var newConnection = false;
        try {
            [res, out] = GLib.spawn_command_line_sync("bt-device -i " + this.address);
            if (out.toString().indexOf("Connected: 1") != -1) {
                //Device is connected
                newConnection = true;
            } else {
                //Device is disconnected
                newConnection = false;
            }
        } catch (e) {
            global.logError(e);
            newConnection = false;
        }
        log("new connection status: " + newConnection);
        //Changed connection status
        this.connection = newConnection;
        this.updateConnection();
    },

    updateBattery: function() {
        //Update Battery value and Icon
        var out = 0;
        var res = 0;
        if (this.connection) {
            [res, out] = GLib.spawn_command_line_sync(this.path + " -b " + this.address);
            out = parseInt(out);
            //Main.Util.spawnCommandLine(this.path + " -b " + this.address);
            this.menuBattery.label.set_text("Battery " + out + "%");
            this.set_applet_tooltip("BOSE " + out + "%");
        } else {
            out = -1;
            this.menuBattery.label.set_text("no Device");
            this.set_applet_tooltip("no Device connected");
        }
        log("Battery: " + out);
        this.menuBattery.setIconSymbolicName(batteryToIcon(out));
    },

    checkAudioOutput: function() {
        var out = 0;
        var res = 0;
        if (this.connection) {
            [res, out] = GLib.spawn_command_line_sync("pacmd list-cards");
            //active profile: <a2dp_sink> or
            var cardIndex = parseInt(out.toString().indexOf(this.address.replace(/:/gi, "_")));
            var outputValue = out.toString().slice(cardIndex).match("active profile: <.*>");
            var output = outputValue.toString().slice(outputValue.toString().indexOf("<") + 1, outputValue.toString().indexOf(">"));
            log("Audio Output: " + output);
            if (output == audioMode.a2dp) {
                this.audioMode = audioMode.a2dp;
                this.menuSwitch.label.set_text("Switch to Headset")
            } else if (output == audioMode.headset) {
                this.audioMode = audioMode.headset;
                this.menuSwitch.label.set_text("Switch to Audio")
            }
        }
    },

    switchAudioSource: function() {
        //Switch A2DP/HFP
        var out = 0;
        var res = 0;
        log("Switch Audio Source " + this.connection)
        if (this.connection) {
            this.checkAudioOutput();
            var mode = this.audioMode == audioMode.a2dp ? audioMode.headset : audioMode.a2dp;
            log(mode);
            var adress = this.address.replace(/:/gi, "_");
            var cmd = "pactl set-card-profile bluez_card." + adress + " " + mode;
            [res, out] = GLib.spawn_command_line_sync(cmd);
            this.checkAudioOutput();
        }
    },

    switchAudioOutput: function() {
        //Switch Audio to Headset or to other Output
        //TODO
    },

    switchConnection: function() {
        this.checkConnection();
        if (this.connection) {
            Main.Util.spawnCommandLine("bt-device --disconnect=" + this.address);
            //var [res, out] = GLib.spawn_command_line_sync("bt-device --disconnect=" + this.address);
            log(out);
        } else {
            //Main.Util.spawnCommandLine("bt-device --connect=" + this.address);
            //var [res, out] = GLib.spawn_command_line_sync("bt-device --connect=" + this.address);
            log(out);
        }
    },

    //Update all
    updateData: function() {
        log("update data");
        this.checkConnection();
        this.updateBattery();
        this.checkAudioOutput();
    },

    //Update something
    _UpdateData: function() {
        if (this._timeout) {
            Mainloop.source_remove(this._timeout);
            this._timeout = null;
        }
        this._timeout = Mainloop.timeout_add_seconds(this.refreshTime, Lang.bind(this, this._UpdateData));
        this.updateData();
    },

    on_settings_changed: function() {
        updateData();
    },

    on_applet_clicked: function() {
        this.menu.toggle();
        //Util.spawn('xkill');
    },

    basedconnectLookup: async function() {
        log("xxconnect");
        let command = "xdg-open ";
        Main.Util.spawnCommandLine(command + "https://github.com/Denton-L/based-connect");
    },

};

function log(message) {
    global.log(UUID + "#" + ": " + message);
}

function main(metadata, orientation, panel_height, instance_id) {
    return new MyApplet(orientation, panel_height, instance_id);
}

function disable() {
    Mainloop.source_remove(timeout);
}

function batteryToIcon(battery) {
    if (battery >= 80) {
        return "battery-full";
    }
    if (battery >= 50) {
        return "battery-good";
    }
    if (battery >= 20) {
        return "battery-low";
    }
    if (battery >= 0) {
        return "battery-caution";
    }
    if (battery >= 0) {
        return "battery-empty";
    }
    return "battery-missing";
}