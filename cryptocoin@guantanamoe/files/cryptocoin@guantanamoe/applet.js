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
const Clutter = imports.gi.Clutter;
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
        this.setAllowedLayout(Applet.AllowedLayout.BOTH);

        this.menuManager = new PopupMenu.PopupMenuManager(this);

        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);

        this.graph = new St.DrawingArea({reactive: false});
        this.graph.connect('repaint', Lang.bind(this, this._draw));
        this.menu.addActor(this.graph); //TODO: Remove top/bottom margin
        this.graphData = {}

        this.menu.connect('open-state-changed', Lang.bind(this, function(menu, isOpen) {
            if (isOpen) {
                this.graphData = {};
                this._loadGraph(`https://min-api.cryptocompare.com/data/${this.graph_unit}?fsym=${this.ticker}&tsym=${this.currency}&limit=${this.graph_length}`);
            }
        }));

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
        this.settings.bindProperty(Settings.BindingDirection.IN, "graph-unit", "graph_unit", this._update_settings, null);
        this.settings.bindProperty(Settings.BindingDirection.IN, "graph-length", "graph_length", this._update_settings, null);
        this.settings.bindProperty(Settings.BindingDirection.IN, "graph-width", "graph_width", this._update_settings, null);
        this.settings.bindProperty(Settings.BindingDirection.IN, "graph-height", "graph_height", this._update_settings, null);
        this.settings.bindProperty(Settings.BindingDirection.IN, "graph-color", "graph_color", this._update_settings, null);

        this._loadCurrencies();
        this._update_settings();
    },

    _draw: function() {
        if (!this.graph.visible) return;

        let [width, height] = this.graph.get_surface_size();
        let [res, color] = Clutter.Color.from_string(this.graph_color);

        if ('Data' in this.graphData) {
            //TODO: make use of global.ui_scale
            let step = width / this.graphData.Data.length;

            let cr = this.graph.get_context();

            var minLow = Number.POSITIVE_INFINITY;
            var maxHigh = Number.NEGATIVE_INFINITY;
            this.graphData.Data.forEach(function(data) {
                if (data.low < minLow) minLow = data.low;
                if (data.high > maxHigh) maxHigh = data.high;
            });
            var delta = maxHigh - minLow;

            cr.setSourceRGBA(color.red/255, color.green/255, color.blue/255, .2)
            cr.moveTo(0, 10);
            cr.setLineWidth(1);
            cr.lineTo(width, 10);
            cr.stroke();

            //TODO: gjs does not supports cr.textExtents('text') to check bounds

            //TODO: check text_direction
            cr.setSourceRGBA(color.red/255, color.green/255, color.blue/255, .8)
            cr.setFontSize(8);
            cr.moveTo(2, 8);
            cr.showText(this._formatMoney(maxHigh));

            cr.setSourceRGBA(color.red/255, color.green/255, color.blue/255, .2)
            cr.moveTo(0, height - 10);
            cr.setLineWidth(1);
            cr.lineTo(width, height - 10);
            cr.stroke();

            //TODO: check text_direction
            cr.setSourceRGBA(color.red/255, color.green/255, color.blue/255, .8)
            cr.setFontSize(8);
            cr.moveTo(2, height);
            cr.showText(this._formatMoney(minLow));

            this.graphData.Data.forEach(function(data, index) {
                var left = step*index;
                var low = (height - 20)*((data.low - minLow)/delta);
                var high = (height - 20)*((data.high - minLow)/delta);
                var open = (height - 20)*((data.open - minLow)/delta);
                var close = (height - 20)*((data.close - minLow)/delta);
                cr.setSourceRGBA(color.red/255, color.green/255, color.blue/255, 1)
                cr.moveTo(step/2 + step*index, height - 10 - low);
                cr.setLineWidth(1);
                cr.lineTo(step/2 + step*index, height - 10 - high);
                cr.stroke();
                cr.setSourceRGBA(color.red/255, color.green/255, color.blue/255, open < close ? 1 : .4)
                cr.moveTo(step/2 + step*index, height - 10 - open);
                cr.setLineWidth(3);
                cr.lineTo(step/2 + step*index, height - 10 - close);
                cr.stroke();
            });
        }
    },

    _update_settings: function () {
        this._update_value();
        this._loadIcon();
        this.graph.width = this.graph_width;
        this.graph.height = this.graph_height;
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
            var value = this._formatMoney(response[this.ticker][this.currency]);
            this.set_applet_label(`${ticker_name}${value}`);
        }
    },

    _formatMoney: function(value) {
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
                value = Accounting.formatMoney(value, '', 2) + ` ${this.currency}`;
                break;
        }
        return value;
    },

    _parseGraphJSON: function (data) {
        const response = Json.json_parse(data, null);
        if (response.hasOwnProperty('Response') && response['Response'] === 'Error') {
            global.logError(response.Message);
        } else {
            this.graphData = response;
            this.graph.queue_repaint();
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

    _loadGraph: function(url) {
        let this_ = this;
        let message = Soup.Message.new('GET', url);
        this.httpSession.queue_message(message, function(session,message){this_._onHandleGraphResponse(session,message)});
    },

    _onHandleIconResponse: function (session, message) {
        if (message.status_code !== 200) {
            this.hide_applet_icon();
            global.logWarning('Failure to receive valid response from remote api');
        } else {
            this._parseIconJSON(message.response_body.data);
        }
    },

    _onHandleGraphResponse: function (session, message) {
        if (message.status_code !== 200) {
            global.logWarning('Failure to receive valid response from remote api');
        } else {
            this._parseGraphJSON(message.response_body.data);
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
    },

    on_applet_clicked: function(event) {
        this.menu.toggle();
    }
};

function main(metadata, orientation, panel_height, instance_id) {
    return new MyApplet(metadata, orientation, panel_height, instance_id);
}
