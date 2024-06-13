const Applet = imports.ui.applet;
const Soup = imports.gi.Soup;
const Lang = imports.lang;
const Json = imports.gi.Json;
const Mainloop = imports.mainloop;
const Settings = imports.ui.settings;
const Util = imports.misc.util;
const Gettext = imports.gettext;
const ByteArray = imports.byteArray;
const GLib = imports.gi.GLib;
const UUID = "location-detection@heimdall";

const REFRESH_INTERVAL = 30

var _httpSession;
if (Soup.MAJOR_VERSION === 2) {
  _httpSession = new Soup.SessionAsync();
  Soup.Session.prototype.add_feature.call(_httpSession, new Soup.ProxyResolverDefault());
} else {
  _httpSession = new Soup.Session();
}

// Translation support
// ----------
Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale")

function _(str) {
  return Gettext.dgettext(UUID, str);
}

// Logging
// ----------
function log(message) {
    global.log(UUID + '#' + log.caller.name + ': ' + message);
}

function logError(error) {
    global.logError(UUID + '#' + logError.caller.name + ': ' + error);
}


// Applet
// ----------
function MyApplet(metadata, orientation, panelHeight, instanceId) {
    this._init(metadata, orientation, panelHeight, instanceId);
}

MyApplet.prototype = {
    __proto__: Applet.TextIconApplet.prototype,

    _init: function (metadata, orientation, panelHeight, instanceId) {
        Applet.TextIconApplet.prototype._init.call(this, orientation, panelHeight, instanceId);

        this.settings = new Settings.AppletSettings(this, metadata.uuid, instanceId);
        this.settings.bindProperty(Settings.BindingDirection.IN, "api-key", "apiKey", this._updateAPIkey, null);

        this.GEO_IP_URL = 'http://api.ipinfodb.com/v3/ip-city/?key=' + this.apiKey + '&format=json';

        try {
            this.set_applet_tooltip(_("Your percieved location."));
        }
        catch (error) {
            logError(error);
        }

        this.refreshLocation();
    },

    loadJsonAsync: function loadJsonAsync(url, callback, error_callback) {
        let context = this;
        let message = Soup.Message.new('GET', url);

        if (Soup.MAJOR_VERSION === 2) {
            _httpSession.queue_message(message, function soupQueue(session, message) {
                if (message.status_code === 200) {
                    let jp = new Json.Parser();
                    jp.load_from_data(message.response_body.data, -1);
                    callback.call(context, jp.get_root().get_object());
                }
                else {
                    // connection to IPInfoDB failed
                    callback.call(context, null);
                }
            });
        } else {
            _httpSession.send_and_read_async(message, Soup.MessagePriority.NORMAL, null, (session, result) => {
                if (message.get_status() === 200) {
                    try {
                        const bytes = _httpSession.send_and_read_finish(result);
                        let jp = new Json.Parser();
                        jp.load_from_data(ByteArray.toString(bytes.get_data()), -1);
                        callback.call(context, jp.get_root().get_object());
                    } catch (error) {
                        global.log(error);
                    }
                } else {
                    callback.call(context, null);
                }
            });
        }
    },

    _updateAPIkey: function() {
        this.GEO_IP_URL = 'http://api.ipinfodb.com/v3/ip-city/?key=' + this.apiKey + '&format=json';
        this.refreshLocation();
    },

    _register_IPInfoDB: function() {
        Util.spawnCommandLine("xdg-open http://www.ipinfodb.com/register.php");
    },

    refreshLocation: function refreshLocation() {
        this.loadJsonAsync(this.GEO_IP_URL, function locationCallback (json) {
            if (json !== null) {
                let countryCode = json.get_string_member('countryCode');
                let ip = json.get_string_member('ipAddress');
                let countryCode2 = json.get_string_member('countryCode');

                // country code is returned from IPInfoDB in upper case
                countryCode = countryCode.charAt(0).toLowerCase() + countryCode.slice(1).toLowerCase();
                countryCode2 = countryCode.charAt(0).toUpperCase() + countryCode.slice(1).toUpperCase();

                let statusMessage = json.get_string_member('statusMessage');
                if (statusMessage == 'Your account has been suspended.') { // Do not translate this string!
                    this.set_applet_tooltip(_("Your IPInfoDB account has been suspended.") + " " + _("Please set a valid API key in the applets settings."))
                    countryCode = 'aa';
                } else if (statusMessage == 'Invalid API key.') { // Do not translate this string!
                    this.set_applet_tooltip(_("Invalid API key.") + " " + _("Please set a valid API key in the applets settings."))
                    countryCode = 'aa';
                } else {
                    this.set_applet_tooltip(countryCode2 + ' ' + ip);
                }

                this.hide_applet_icon();
                this.set_applet_icon_path( global.userdatadir + "/applets/location-detection@heimdall/flags/" + countryCode + ".png");
            }
            else {
                // error getting location
                this.set_applet_tooltip(_("Something went Wrong!"));
                this.set_applet_icon_symbolic_name ("dialog-error");

            }

            Mainloop.timeout_add_seconds(REFRESH_INTERVAL, Lang.bind(this, function refreshTimeout() {
                this.refreshLocation();
            }));
        })
    }
};

function main(metadata, orientation, panelHeight, instanceId) {
    let myapplet = new MyApplet(metadata, orientation, panelHeight, instanceId);
    return myapplet;
}
