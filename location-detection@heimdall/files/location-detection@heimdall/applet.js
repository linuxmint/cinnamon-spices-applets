const Applet = imports.ui.applet;
const Soup = imports.gi.Soup;
const Lang = imports.lang;
const Json = imports.gi.Json;
const Mainloop = imports.mainloop;
const Gettext = imports.gettext.domain("cinnamon-applets");
const _ = Gettext.gettext;


const UUID = "location-detection@heimdall";

//Get your api key from IPinfoDB and place it after key= and before &format=json

const GEO_IP_URL = 'http://api.ipinfodb.com/v3/ip-city/?key=d115c954db28487f38c5d25d5dcf62a5786479b87cc852cabe8fd6f1971d7f89&format=json';



const REFRESH_INTERVAL = 30

const _httpSession = new Soup.SessionAsync();
Soup.Session.prototype.add_feature.call(_httpSession, new Soup.ProxyResolverDefault());


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
function MyApplet(orientation) {
    this._init(orientation);
}

MyApplet.prototype = {
    __proto__: Applet.TextIconApplet.prototype,

    _init: function (orientation) {
        Applet.TextIconApplet.prototype._init.call(this, orientation);

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
    },
    
    

    refreshLocation: function refreshLocation() {
        this.loadJsonAsync(GEO_IP_URL, function locationCallback (json) {
            if (json !== null) {
                let countryCode = json.get_string_member('countryCode');
                let ip = json.get_string_member('ipAddress');
		let countryCode2 = json.get_string_member('countryCode');
                
                // country code is returned from IPInfoDB in upper case
               countryCode = countryCode.charAt(0).toLowerCase() + countryCode.slice(1).toLowerCase();
	       countryCode2 = countryCode.charAt(0).toUpperCase() + countryCode.slice(1).toUpperCase();
   
                //this.set_applet_label(countryCode2 + ' ' + ip);
                this.set_applet_tooltip(_(countryCode2 + ' ' + ip));
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

function main(metadata, orientation) {
    let myapplet = new MyApplet(orientation);
    return myapplet;
}