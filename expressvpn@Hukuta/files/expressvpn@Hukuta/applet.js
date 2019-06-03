const Lang = imports.lang;
const Applet = imports.ui.applet;
const GLib = imports.gi.GLib;
const Settings = imports.ui.settings;
const MainLoop = imports.mainloop;
const UUID = "expressvpn@Hukuta";


function MyApplet(metadata, orientation, instance_id) {
    this._init(metadata, orientation, instance_id);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(metadata, orientation, instance_id) {
        Applet.IconApplet.prototype._init.call(this, orientation);

        this.server = "smart";
        this.is_connected = null;
        this.process = null;
        this.icon_connected = metadata.path + '/icon.png';
        this.icon_disconnected = metadata.path + '/icon-grey.png';
        // expressvpn installed status
        this.service_is_installed = false;

        try {
            this.settings = new Settings.AppletSettings(this, UUID, instance_id);
            this.settings.bindProperty(Settings.BindingDirection.IN, "server", "server", this._onServerChange);
            this.set_applet_icon_path(this.icon_disconnected);
            this._onServerChange();
            this.actor.connect('button-release-event', Lang.bind(this, this._onButtonReleaseEvent));
            this._getConnectionStatusSecondary();
        }
        catch (e) {
            global.logError(e);
        }

    },

    _onServerChange: function() {
        this._getConnectionStatus()
    },

    _onButtonReleaseEvent: function(actor, event) {
        if (this._applet_enabled && this.process == null) {
            if (event.get_button() == 1) {
                if (!this._draggable.inhibit) {
                    return false;
                } else {
                    if (!this.service_is_installed) {
                        this._getConnectionStatus();
                        if (!this.service_is_installed) {
                            // expressvpn is not installed
                            return false;
                        }
                    }
                    let command = "expressvpn " + (this.is_connected ? "disconnect" : "connect " + this.server);
                    this.process = MainLoop.timeout_add(2500, Lang.bind(this, this._onTimerAction));
                    this.set_applet_icon_name("network-vpn");
                    this.set_applet_tooltip("Please wait...");
                    GLib.spawn_command_line_async(command, this._getConnectionStatus);
                }
            }
        }
        return true;
    },

    _onTimerAction: function() {
        if (this._getConnectionStatus()) {
            MainLoop.source_remove(this.process);
            this.process = null;
        } else {
            this.process = MainLoop.timeout_add(2500, Lang.bind(this, this._onTimerAction));
        }
    },

    _getConnectionStatus: function() {
        let statusStr;
        try{
            statusStr = ("" + GLib.spawn_command_line_sync("expressvpn status")[1]).split("\n")[0].replace(
                /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');

        } catch (e) {
            this.set_applet_icon_path(this.icon_disconnected);

            if (e.message.indexOf("“expressvpn”") > -1) {
                // No such file or directory
                this.service_is_installed = false;
                global.logError(e.message);
                this.set_applet_tooltip("You need to install expressvpn to use this applet");
                return false;
            }

            global.logError(e);
            return false;
        }
        this.service_is_installed = true;

        let is_connected = statusStr.indexOf("Connected to") > -1;

        if (is_connected === this.is_connected)
            return false;
        this.is_connected = is_connected;
        if (is_connected) {
            this.set_applet_tooltip(statusStr + "\nClick to Disconnect");
            this.set_applet_icon_path(this.icon_connected);
        } else {
            if (statusStr.indexOf("Reconnecting") > -1) {
                this.set_applet_tooltip(statusStr);
                this.set_applet_icon_name("network-vpn");
                MainLoop.timeout_add(6000, Lang.bind(this, this._getConnectionStatusSecondary));
            } else {
                this.set_applet_tooltip(statusStr +  "\nConnect to location: " + this.server.toUpperCase());
                this.set_applet_icon_path(this.icon_disconnected);
            }

        }
        return true;
    },

    _getConnectionStatusSecondary: function() {
        if (this.process == null) {
            this._getConnectionStatus();
        }
        MainLoop.timeout_add(60000, Lang.bind(this, this._getConnectionStatusSecondary));
    }
};

function main(metadata, orientation, panel_height, instance_id) {
    let myApplet = new MyApplet(metadata, orientation, instance_id);
    return myApplet;
}
