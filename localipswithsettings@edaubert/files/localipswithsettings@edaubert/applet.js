const Applet = imports.ui.applet;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Gettext = imports.gettext;
const Util = imports.misc.util;
const Settings = imports.ui.settings
const UUID = "localipswithsettings@edaubert";
const REFRESH_INTERVAL = 60

const IP_REGEX = /[0-9]+: [\w-]+ +inet[46]? +(((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(\.)?){4}|(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))).*/;

// Translation support
// ----------
Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale")

function _(str) {
  return Gettext.dgettext(UUID, str);
}

// Logging
// ----------
function log(message) {
    global.log(UUID + '#' + global.log.caller.name + ': ' + message);
}

function logError(error) {
    global.logError(UUID + '#' + global.logError.caller.name + ': ' + error);
}

// Applet
// ----------
function MyApplet(metadata, orientation, panel_height, instanceId) {
    this._init(metadata, orientation, panel_height, instanceId);
}

MyApplet.prototype = {
    __proto__: Applet.TextApplet.prototype,

    _init: function (metadata, orientation, panel_height, instanceId) {
        Applet.TextApplet.prototype._init.call(this, orientation);

        this.settings = new Settings.AppletSettings(this, "localipswithsettings@edaubert", instanceId);

        try {
            this.set_applet_tooltip(_("Your local IPs."));
            this.set_applet_label("...");
        } catch (error) {
            global.logError(error);
        }
    },
    log: function (message) {
        if (this.debug) {
            global.log(message);
        }
    },
    logError: function (message) {
        if (this.debug) {
            global.logError(message);
        }
    },
    bindProperties: function () {
        this.refreshInterval = this.settings.getValue("refreshInterval");
        this.IPv4 = this.settings.getValue("IPv4");
        this.IPv6 = this.settings.getValue("IPv6");
        this.inet = this.settings.getValue("inet");
        this.settings.bindProperty(
            Settings.BindingDirection.IN,
            "refreshInterval",
            "refreshInterval",
            this.refreshLocation,
            null
        );
       this.settings.bindProperty(
            Settings.BindingDirection.IN,
            "IPv4",
            "IPv4",
            this.refreshLocation,
            null
        );
       this.settings.bindProperty(
            Settings.BindingDirection.IN,
            "IPv6",
            "IPv6",
            this.refreshLocation,
            null
        );
       this.settings.bindProperty(
            Settings.BindingDirection.IN,
            "inet",
            "inet",
            this.refreshLocation,
            null
        );
       this.settings.bindProperty(
            Settings.BindingDirection.IN,
            "debug",
            "debug",
            function () {},
            null
        );
    },
    unbindProperties: function () {
        this.settings.unbindProperty("refreshInterval");
        this.settings.unbindProperty("IPv4");
        this.settings.unbindProperty("IPv6");
        this.settings.unbindProperty("inet");
        this.settings.unbindProperty("debug");
    },
    refreshLocation: function refreshLocation () {
        this.log("Run refreshLocation");
        let command = ["ip", "-o"];
        if (this.IPv4 && !this.IPv6) {
            command.push("-4");
        } else if (!this.IPv4 && this.IPv6) {
            command.push("-6");
        }
        command.push("addr");

        this.log(command);

        Util.spawn_async(
            command,
            Lang.bind(this, this.processIps)
        );
        if (this.myFunctionId > 0) {
            Mainloop.source_remove(this.myFunctionId);
            this.myFunctionId = 0;
        }

        this.myFunctionId = Mainloop.timeout_add_seconds(this.refreshInterval,
            Lang.bind(this, function refreshTimeout() {
                this.refreshLocation();
            })
        );
    },
    processIps: function (out) {
        const INET_REGEX = new RegExp("[0-9]+: (" + this.inet.replace(/,/g, "|") +") +inet[46]? +(.*)");

        var ipsSplitted = String(out).split("\n");
        var ips = "";
        let first = true;

        for (var i = 0; i < ipsSplitted.length; i++) {

            this.log(ipsSplitted[i] + "\t" + INET_REGEX + "\t" + ipsSplitted[i].match(INET_REGEX));

            if (ipsSplitted[i].match(INET_REGEX)) {
                if (!first) {
                    ips = ips + " - ";
                }
                first = false;

                this.log(ipsSplitted[i]);
                this.log(ipsSplitted[i].replace(IP_REGEX, "$1"));

                ips = ips + ipsSplitted[i].replace(IP_REGEX, "$1");
            }
        }
        
        this.log(ips);

        ips = String(ips).trim();

        this.set_applet_label('' + ips + '');
    },
    on_applet_added_to_panel: function () {
        this.myFunctionId = 0;
        this.bindProperties();
        this.refreshLocation();
    },
    on_applet_removed_from_panel: function () {
        if (this.myFunctionId > 0) {
            Mainloop.source_remove(this.myFunctionId);
            this.myFunctionId = 0;
        }
        this.unbindProperties();
    }
};

function main(metadata, orientation, panel_height, instanceId) {
    let myapplet = new MyApplet(metadata, orientation, panel_height, instanceId);
    return myapplet;
}
