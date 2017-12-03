const UUID = "cryptocoin@guantanamoe";

const St = imports.gi.St;
const Lang = imports.lang;
const PopupMenu = imports.ui.popupMenu;
const Main = imports.ui.main;
const GLib = imports.gi.GLib;
const Util = imports.misc.util;
const Mainloop = imports.mainloop;
const Applet = imports.ui.applet;
const Settings = imports.ui.settings;
const Gettext = imports.gettext;
const Soup = imports.gi.Soup;

imports.searchPath.push( imports.ui.appletManager.appletMeta[UUID].path );
const Json = imports.json_parse;


Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");
const TrackerDefinition = [
    {
        "tracker":"BTC",
        "enabled":false
    },
    {
        "tracker":"ETH",
        "enabled":false
    },
    {
        "tracker":"XRP",
        "enabled":false
    }
];

function _(str) {
    return Gettext.dgettext(UUID, str);
}

function MyApplet(orientation, instance_id) {
    this._init(orientation, instance_id);
}

MyApplet.prototype = {
    __proto__: Applet.TextApplet.prototype,

    _init: function(orientation, instance_id) {
        Applet.TextApplet.prototype._init.call(this, orientation, instance_id);

        try {
            this.httpSession = new Soup.SessionAsync();
        } catch (e){ throw 'LiveScore: Creating SessionAsync failed: ' + e; }
        try {
            Soup.Session.prototype.add_feature.call(this.httpSession, new Soup.ProxyResolverDefault());
        } catch (e){ throw 'LiveScore: Adding ProxyResolverDefault failed: ' + e; }

        this.settings = new Settings.AppletSettings(this, UUID, instance_id);
        this.settings.bind("currency", "currency", this._update_value);
        this.settings.bind("track-bitcoin", "trackBTC", this._update_value);
        this.settings.bind("track-ethereal", "trackETH", this._update_value);
        this.settings.bind("track-ripple", "trackXRP", this._update_value);

        this._update_value();
    },

    _update_value: function () {
        TrackerDefinition[0].enabled = this.trackBTC;
        TrackerDefinition[1].enabled = this.trackETH;
        TrackerDefinition[2].enabled = this.trackXRP;

        const enabledTrackers = [];
        TrackerDefinition.filter((tracker) => tracker.enabled).forEach((tracker) => enabledTrackers.push(tracker.tracker));
        this._loadTrackers(`https://min-api.cryptocompare.com/data/pricemulti?fsyms=${enabledTrackers.join()}&tsyms=${this.currency}`);

        Mainloop.timeout_add(5000, Lang.bind(this, this._update_value));
    },

    _onHandleResponse: function (session, message) {
        if (message.status_code !== 200) {
            this.set_applet_label('Loading...');
            global.logWarning('Failure to receive valid response from remote api');
        } else {
            this._parseJSON(message.response_body.data);
        }
    },

    _parseJSON: function (data) {
        const response = Json.json_parse(data, null);
        if (response.Response === 'Error') {
            this.set_applet_label('Error loading prices...');
            global.logError(response.Message);
        } else {
            let message = [];
            TrackerDefinition.filter((tracker) => tracker.enabled).forEach((tracker) => {
                const price = response[tracker.tracker][this.currency];
                message.push(`${tracker.tracker}:${price}`);
            });

            this.set_applet_label(message.join(" | "));
        }
    },

    _loadTrackers: function(url) {
        let this_ = this;
        let message = Soup.Message.new('GET', url);
        this.httpSession.queue_message(message, function(session,message){this_._onHandleResponse(session,message)});
    }
};

function main(metadata, orientation, instance_id) {
    return new MyApplet(orientation, instance_id);
}
