const UUID = "cryptocoin@guantanamoe";

const St = imports.gi.St;
const Lang = imports.lang;
const PopupMenu = imports.ui.popupMenu;
const Main = imports.ui.main;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Util = imports.misc.util;
const Mainloop = imports.mainloop;
const Applet = imports.ui.applet;
const Settings = imports.ui.settings;
const Gettext = imports.gettext;
const Soup = imports.gi.Soup;
const Json = imports.ui.appletManager.applets[UUID].json_parse;
const Accounting = imports.ui.appletManager.applets[UUID].accounting.accounting;

const AppletDirectory = imports.ui.appletManager.appletMeta[UUID].path;

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");

function _(str) {
    return Gettext.dgettext(UUID, str);
}

function MyApplet(metadata, orientation, panel_height, instance_id) {
    this._init(metadata, orientation, panel_height, instance_id);
}

MyApplet.prototype = {
    __proto__: Applet.TextIconApplet.prototype,

    _init: function(metadata, orientation, panel_height, instance_id) {
        Applet.TextIconApplet.prototype._init.call(this, orientation, panel_height, instance_id);

        try {
            this.httpSession = new Soup.SessionAsync();
        } catch (e){ throw 'LiveScore: Creating SessionAsync failed: ' + e; }
        try {
            Soup.Session.prototype.add_feature.call(this.httpSession, new Soup.ProxyResolverDefault());
        } catch (e){ throw 'LiveScore: Adding ProxyResolverDefault failed: ' + e; }

        this.settings = new Settings.AppletSettings(this, metadata.uuid, instance_id);
        this.settings.bindProperty(Settings.BindingDirection.IN, "currency", "currency", this._update_settings, null);
        this.settings.bindProperty(Settings.BindingDirection.IN, "ticker", "ticker", this._update_settings, null);
        this.settings.bindProperty(Settings.BindingDirection.IN, "show-ticker-icon", "show_ticker_icon", this._update_settings, null);
        this.settings.bindProperty(Settings.BindingDirection.IN, "show-ticker-name", "show_ticker_name", this._update_settings, null);
        this.settings.bindProperty(Settings.BindingDirection.IN, "show-currency", "show_currency", this._update_settings, null);

        this._loadCurrencies();
        this._update_settings();
    },

    _update_settings: function () {
        this._update_value();
        this._loadIcon();
    },

    _update_value: function () {
        this._loadTrackers(`https://min-api.cryptocompare.com/data/pricemulti?fsyms=${this.ticker}&tsyms=${this.currency}`);
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
            let ticker_name = this.show_ticker_name ? `${this.ticker}:` : '';
            var value = response[this.ticker][this.currency];
            switch (this.show_currency) {
                case 'symbol':
                    let currency_config = Object.assign({
                        symbol: '\u00A4',
                        precision: 2
                    }, this.currencies[this.currency]);
                    value = Accounting.formatMoney(value, currency_config.symbol,
                                                          currency_config.precision);
                    break;
                case 'name':
                    value = `${value} ${this.currency}`;
                    break;
            }
            this.set_applet_label(`${ticker_name}${value}`);
        }
    },

    _loadTrackers: function(url) {
        let this_ = this;
        let message = Soup.Message.new('GET', url);
        this.httpSession.queue_message(message, function(session,message){this_._onHandleResponse(session,message)});
    },

    _loadIcon: function() {
        if (!this.show_ticker_icon) {
            this.hide_applet_icon();
            return;
        }

        let this_ = this;
        let message = Soup.Message.new('GET', 'https://min-api.cryptocompare.com/data/all/coinlist');
        this.httpSession.queue_message(message, function(session,message){this_._onHandleIconResponse(session,message)});
    },

    _onHandleIconResponse: function (session, message) {
        if (message.status_code !== 200) {
            this.hide_applet_icon();
            global.logWarning('Failure to receive valid response from remote api');
        } else {
            this._parseIconJSON(message.response_body.data);
        }
    },

    _parseIconJSON: function (data) {
        const response = Json.json_parse(data, null);
        if (response.hasOwnProperty('Response') && response['Response'] === 'Error') {
            this.hide_applet_icon();
            global.logError(response.Message);
        } else {
            if (response.hasOwnProperty('Data') && 
                response.Data.hasOwnProperty(this.ticker) &&
                response.Data[this.ticker].hasOwnProperty('ImageUrl')) {
                let iconPath = response.Data[this.ticker].ImageUrl;
                let iconFile = Gio.file_new_for_uri(`https://www.cryptocompare.com${iconPath}`);
                let gicon = new Gio.FileIcon({ file: iconFile });
                if (this._applet_icon_box.child) this._applet_icon_box.child.destroy();
                this._applet_icon = new St.Icon({ gicon: gicon, icon_size: 16, icon_type: St.IconType.SYMBOLIC, reactive: true, track_hover: true, style_class: "applet-icon" });
                this._applet_icon_box.child = this._applet_icon;
            } else {
                this.hide_applet_icon();
                global.logWarning('Missing icon URL');
            }
        }
    },

    _loadCurrencies: function() {
        let currenciesFile = Gio.file_new_for_path(`${AppletDirectory}/currencies.json`);
        let contents = currenciesFile.load_contents(null)[1].toString();
        this.currencies = JSON.parse(contents);
    },

    on_applet_removed_from_panel: function() {
      this.settings.finalize();
    }
};

function main(metadata, orientation, panel_height, instance_id) {
    return new MyApplet(metadata, orientation, panel_height, instance_id);
}
