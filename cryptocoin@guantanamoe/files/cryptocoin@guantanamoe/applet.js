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
const Json = imports.ui.appletManager.applets[UUID].json_parse;

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");

function _(str) {
    return Gettext.dgettext(UUID, str);
}

function MyApplet(metadata, orientation, instance_id) {
    this._init(metadata, orientation, instance_id);
}

MyApplet.prototype = {
    __proto__: Applet.TextApplet.prototype,

    _init: function(metadata, orientation, instance_id) {
        Applet.TextApplet.prototype._init.call(this, orientation, instance_id);

        try {
            this.httpSession = new Soup.SessionAsync();
        } catch (e){ throw 'LiveScore: Creating SessionAsync failed: ' + e; }
        try {
            Soup.Session.prototype.add_feature.call(this.httpSession, new Soup.ProxyResolverDefault());
        } catch (e){ throw 'LiveScore: Adding ProxyResolverDefault failed: ' + e; }

        this.settings = new Settings.AppletSettings(this, metadata.uuid, instance_id);
        this.settings.bindProperty(Settings.BindingDirection.IN, "currency", "currency", this._update_value, null);
        this.settings.bindProperty(Settings.BindingDirection.IN, "ticker", "ticker", this._update_value, null);

        this._update_value();
    },

    _update_value: function () {
        let tickers = [];
        this.ticker.split(",").forEach((t) => { tickers.push(t.trim()) });
        this._loadTrackers(`https://min-api.cryptocompare.com/data/pricemulti?fsyms=${tickers.join()}&tsyms=${this.currency}`);

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
        if (response.hasOwnProperty('Response') && response['Response'] === 'Error') {
            this.set_applet_label('Error loading prices...');
            global.logError(response.Message);
        } else {
            let message = [];
            for (let tracker in response) {
                const trackerInfo = response[tracker];
                if (trackerInfo.hasOwnProperty(this.currency)) {
                    message.push(`${tracker}:${trackerInfo[this.currency]}`);
                }
            }

            this.set_applet_label(message.join(" | "));
        }
    },

    _loadTrackers: function(url) {
        let this_ = this;
        let message = Soup.Message.new('GET', url);
        this.httpSession.queue_message(message, function(session,message){this_._onHandleResponse(session,message)});
    },

    on_applet_removed_from_panel: function() {
      this.settings.finalize();
    }
};

function main(metadata, orientation, panel_height, instance_id) {
    return new MyApplet(metadata, orientation, instance_id);
}
