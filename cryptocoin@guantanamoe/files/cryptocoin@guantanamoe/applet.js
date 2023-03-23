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
const ByteArray = imports.byteArray;
const Clutter = imports.gi.Clutter;
const MessageTray = imports.ui.messageTray;
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
        this.graph.connect('repaint', Lang.bind(this, this._drawGraph));
        this.menu.addActor(this.graph); //TODO: Remove top/bottom margin
        this.graphData = {}

        this.menu.connect('open-state-changed', Lang.bind(this, function(menu, isOpen) {
            if (isOpen) {
                this.graphData = {};
                this._loadHistory(this.graph_unit, this.graph_length, this._parseGraphJSON);
            }
        }));

        this.notificationSource = new MessageTray.SystemNotificationSource();
        Main.messageTray.add(this.notificationSource);

        if (Soup.MAJOR_VERSION === 2) {
            try {
                this.httpSession = new Soup.SessionAsync();
            } catch (e){ throw 'LiveScore: Creating SessionAsync failed: ' + e; }
        } else { //version 3
            this.httpSession = new Soup.Session();
        }
        if (Soup.MAJOR_VERSION === 2) {
            try {
                Soup.Session.prototype.add_feature.call(this.httpSession, new Soup.ProxyResolverDefault());
            } catch (e){ throw 'LiveScore: Adding ProxyResolverDefault failed: ' + e; }
        }

        this.settings = new Settings.AppletSettings(this, metadata.uuid, instance_id);
        this.settings.bindProperty(Settings.BindingDirection.IN, "amount", "amount", this._update_settings);
        this.settings.bindProperty(Settings.BindingDirection.IN, "currency", "currency", this._update_settings);
        this.settings.bindProperty(Settings.BindingDirection.IN, "ticker", "ticker", this._update_settings);
        this.settings.bindProperty(Settings.BindingDirection.IN, "show-ticker-icon", "show_ticker_icon", this._update_settings);
        this.settings.bindProperty(Settings.BindingDirection.IN, "show-ticker-name", "show_ticker_name", this._update_settings);
        this.settings.bindProperty(Settings.BindingDirection.IN, "show-currency", "show_currency", this._update_settings);
        this.settings.bindProperty(Settings.BindingDirection.IN, "rates-update-interval", "rates_update_interval", this._update_settings);
        this.settings.bindProperty(Settings.BindingDirection.IN, "graph-type", "graph_type", this._updateGraphSettings);
        this.settings.bindProperty(Settings.BindingDirection.IN, "graph-unit", "graph_unit", this._updateGraphSettings);
        this.settings.bindProperty(Settings.BindingDirection.IN, "graph-length", "graph_length", this._updateGraphSettings);
        this.settings.bindProperty(Settings.BindingDirection.IN, "graph-width", "graph_width", this._updateGraphSettings);
        this.settings.bindProperty(Settings.BindingDirection.IN, "graph-height", "graph_height", this._updateGraphSettings);
        this.settings.bindProperty(Settings.BindingDirection.IN, "graph-color", "graph_color", this._updateGraphSettings);
        this.settings.bindProperty(Settings.BindingDirection.IN, "alert-enable", "alert_enable", this._updateAlertSettings);
        this.settings.bindProperty(Settings.BindingDirection.IN, "alert-any-change", "alert_any_change", this._updateAlertSettings);
        this.settings.bindProperty(Settings.BindingDirection.IN, "alert-label-color", "alert_label_color", this._updateAlertSettings);
        this.settings.bindProperty(Settings.BindingDirection.IN, "alert-on-above", "alert_on_above", this._updateAlertSettings);
        this.settings.bindProperty(Settings.BindingDirection.IN, "alert-on-below", "alert_on_below", this._updateAlertSettings);
        this.settings.bindProperty(Settings.BindingDirection.IN, "alert-on-delta-above", "alert_on_delta_above", this._updateAlertSettings);
        this.settings.bindProperty(Settings.BindingDirection.IN, "alert-on-delta-below", "alert_on_delta_below", this._updateAlertSettings);
        this.settings.bindProperty(Settings.BindingDirection.IN, "alert-delta-length", "alert_delta_length", this._updateAlertSettings);
        this.settings.bindProperty(Settings.BindingDirection.IN, "alert-delta-unit", "alert_delta_unit", this._updateAlertSettings);
        this.settings.bindProperty(Settings.BindingDirection.IN, "alert-delta-update-interval", "alert_delta_update_interval", this._updateAlertSettings);
        this.settings.bindProperty(Settings.BindingDirection.IN, "currency-format-enable", "currency_format_enable", this._update_settings);
        this.settings.bindProperty(Settings.BindingDirection.IN, "currency-format-symbol", "currency_format_symbol", this._update_settings);
        this.settings.bindProperty(Settings.BindingDirection.IN, "currency-format-name", "currency_format_name", this._update_settings);
        this.settings.bindProperty(Settings.BindingDirection.IN, "currency-format-precision", "currency_format_precision", this._update_settings);

        this._loadCurrencies();
        this._update_settings();
    },

    _loadHistory: function(unit, length, callback) {
        let message = Soup.Message.new('GET', `https://min-api.cryptocompare.com/data/${unit}?fsym=${this.ticker}&tsym=${this.currency}&limit=${length}`);
        if (Soup.MAJOR_VERSION == 2) {
            this.httpSession.queue_message(message, (session, response) => {
                if (response.status_code !== 200) {
                    global.logWarning('Failure to receive valid response from remote api');
                } else {
                    Lang.bind(this, callback)(response.response_body.data);
                }
            });
        } else { //version 3
            this.httpSession.send_and_read_async(message, Soup.MessagePriority.NORMAL, null, (session, response) => {
                if (message.get_status() !== 200) {
                    global.logWarning('Failure to receive valid response from remote api');
                } else {
                    const bytes = this.httpSession.send_and_read_finish(response);
                    Lang.bind(this, callback)(ByteArray.toString(bytes.get_data()));
                }
            });
        }
    },

    _drawGraph: function() {
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
            
            switch(this.graph_type) {
            case 'candlestick':
                this._drawCandlestickGraph(cr, width, height, minLow, maxHigh, delta, step, color);
                break;
            case 'line':
                this._drawLineGraph(cr, width, height, minLow, maxHigh, delta, step, color);
                break;
            }
        }
    },

    _drawCandlestickGraph(cr, width, height, minLow, maxHigh, delta, step, color) {
        this.graphData.Data.forEach(function(data, index) {
            const low = (height - 20)*((data.low - minLow)/delta);
            const high = (height - 20)*((data.high - minLow)/delta);
            const open = (height - 20)*((data.open - minLow)/delta);
            const close = (height - 20)*((data.close - minLow)/delta);
            const x = step / 2 + step * index;
            const top = height - 10;
            cr.setSourceRGBA(color.red/255, color.green/255, color.blue/255, 1)
            cr.moveTo(x, top - low);
            cr.setLineWidth(1);
            cr.lineTo(x, top - high);
            cr.stroke();
            cr.setSourceRGBA(color.red/255, color.green/255, color.blue/255, open < close ? 1 : .4)
            cr.moveTo(x, top - open);
            cr.setLineWidth(3);
            cr.lineTo(x, top - close);
            cr.stroke();
        });
    },

    _drawLineGraph(cr, width, height, minLow, maxHigh, delta, step, color) {
        cr.setLineWidth(1);
        cr.setSourceRGBA(color.red/255, color.green/255, color.blue/255, 1)
        this.graphData.Data.forEach(function(data, index) {
            const close = (height - 20)*((data.close - minLow)/delta);
            const x = step/2 + step*index;
            const y = height - 10 - close;
            if (index) {
                cr.lineTo(x, y);
                cr.stroke();
            }
            cr.moveTo(x, y);
        });
    },

    _update_settings: function () {
        this._update_value();
        this._loadIcon();
        this._updateGraphSettings();
        this._updateAlertSettings();
        this._updateLabel();
    },

    _update_value: function () {
        this._loadTrackers(`https://min-api.cryptocompare.com/data/pricemulti?fsyms=${this.ticker}&tsyms=${this.currency}`);
        if (this._updateTimeout) {
            Mainloop.source_remove(this._updateTimeout);
        }

        if (this.rates_update_interval == false) {
            this.rates_update_interval = 30;
        }

        this._updateTimeout = Mainloop.timeout_add(this.rates_update_interval * 1000, Lang.bind(this, this._update_value));
    },

    _updateGraphSettings: function() {
        this.graph.width = this.graph_width;
        this.graph.height = this.graph_height;
    },

    _updateAlertSettings: function() {
        if (this.alert_enable) {
            this.alertMaxValue = parseFloat(this.alert_on_above) || undefined;
            this.alertMinValue = parseFloat(this.alert_on_below) || undefined;

            this.alertDeltaMaxValue = parseFloat(this.alert_on_delta_above) || undefined;
            this.alertDeltaMinValue = parseFloat(this.alert_on_delta_below) || undefined;

            this._scheduleAlert();
        }
    },

    _scheduleAlert: function() {
        if (this.alertDeltaMaxValue || this.alertDeltaMinValue || this.alert_delta_length || this.alert_delta_update_interval) {
            this._loadHistory(this.alert_delta_unit, this.alert_delta_length, this._parseAlertJSON);
            if (this._alertTimeout) {
                Mainloop.source_remove(this._alertTimeout);
            }
            this._alertTimeout = Mainloop.timeout_add(this.alert_delta_update_interval * 1000, Lang.bind(this, this._scheduleAlert));
        }
    },

    _parseAlertJSON: function(data) {
        const response = Json.json_parse(data, null);
        if (response.hasOwnProperty('Response') && response['Response'] === 'Error') {
            global.logError(response.Message);
        } else {
            let value = response.Data[0].close;
            this.previousDeltaValue = this.deltaValue === undefined ? value : this.deltaValue;
            this.deltaValue = ((value - this.value) / value) * -100;
            this._alertOnUpdate();
        }
    },

    _parseJSON: function (data) {
        const response = Json.json_parse(data, null);
        if (response.hasOwnProperty('Response') && response['Response'] === 'Error') {
            this.set_applet_label('Error loading prices...');
            global.logError(response.Message);
        } else {
            this._updateValue(response[this.ticker][this.currency]);
        }
    },

    _updateValue: function(value) {
        this.previousValue = this.value === undefined ? value : this.value;
        this.value = value;
        this._updateLabel();
        this._alertOnUpdate();
    },

    _updateLabel: function() {
        let formattedValue = this._formatMoney(this.value * parseFloat(this.amount));
        let ticker_name = this.show_ticker_name ? `${this.ticker}:` : '';
        this.set_applet_label(`${ticker_name}${formattedValue}`);
    },

    _alertOnUpdate: function() {
        if (this.alert_enable) {

            var alert = false;

            if (this.deltaValue !== undefined) {
                if (Math.abs(this.previousDeltaValue - this.deltaValue) >= 0.01) {
                    let formattedDelta = Accounting.formatNumber(this.deltaValue, 2) + '%';
                    if (this.alertDeltaMaxValue && this.deltaValue >= this.alertDeltaMaxValue) {
                        this._notifyMessage(this.ticker, '+' + formattedDelta, 'go-top');
                        alert = true;
                    } else if (this.alertDeltaMinValue && this.deltaValue <= -this.alertDeltaMinValue) {
                        this._notifyMessage(this.ticker, formattedDelta, 'go-bottom');
                        alert = true;
                    }
                }
            }

            if (this.value !== undefined) {
                let precision = this.currencies[this.currency].precision;
                if (Math.abs(this.previousValue - this.value) >= Math.pow(10, -precision)) {
                    let formattedValue = this._formatMoney(this.value);
                    if (this.alertMaxValue && this.value >= this.alertMaxValue) {
                        this._notifyMessage(this.ticker, formattedValue, 'go-top');
                        alert = true;
                    } else if (this.alertMinValue && this.value <= this.alertMinValue) {
                        this._notifyMessage(this.ticker, formattedValue, 'go-bottom');
                        alert = true;
                    }

                    if (!alert && this.alert_any_change) {
                        var icon = this.value > this.previousValue ? 'go-up' : 'go-down';
                        icon = this.previousValue !== undefined ? icon : 'dialog-information';
                        let formattedValue = this._formatMoney(this.value);
                        this._notifyMessage(this.ticker, formattedValue, icon);
                    }
                }
            }

            this._applet_label.set_style('color: ' + (alert ? this.alert_label_color : 'inherit'));
        }
    },

    _formatMoney: function(value) {
        let symbol, name, precision;
        if (this.currency_format_enable) {
            symbol = this.currency_format_symbol;
            name = this.currency_format_name;
            precision = this.currency_format_precision;
        } else {
            let currency_config = this.currencies[this.currency];
            symbol = currency_config.symbol;
            name = this.currency;
            precision = currency_config.precision;
        }
        switch (this.show_currency) {
            case 'symbol':
                return Accounting.formatMoney(value, symbol, precision);
            case 'name':
                return `${Accounting.formatNumber(value, precision)} ${name}`;
        }
        return Accounting.formatNumber(value, precision);
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
        if (Soup.MAJOR_VERSION === 2) {
            this.httpSession.queue_message(message, (session, response) => {
                if (response.status_code !== 200) {
                    this.set_applet_label('Loading...');
                    global.logWarning('Failure to receive valid response from remote api');
                } else {
                    this._parseJSON(response.response_body.data);
                }
            });
        } else { //version 3
            this.httpSession.send_and_read_async(message, Soup.MessagePriority.NORMAL, null, (session, response) => {
                if (message.get_status() !== 200) {
                    this.set_applet_label('Loading...');
                    global.logWarning('Failure to receive valid response from remote api');
                } else {
                    const bytes = session.send_and_read_finish(response);
                    this._parseJSON(ByteArray.toString(bytes.get_data()));
                }
            });
        }
    },

    _loadIcon: function() {
        if (!this.show_ticker_icon) {
            this.hide_applet_icon();
            return;
        }

        let this_ = this;
        let message = Soup.Message.new('GET', 'https://min-api.cryptocompare.com/data/all/coinlist');
        if (Soup.MAJOR_VERSION === 2) {
            this.httpSession.queue_message(message, (session, response) => {
                if (response.status_code !== 200) {
                    this.hide_applet_icon();
                    global.logWarning('Failure to receive valid response from remote api');
                } else {
                    this._parseIconJSON(response.response_body.data);
                }
            });
        } else { //version 3
            this.httpSession.send_and_read_async(message, Soup.MessagePriority.NORMAL, null, (session, response) => {
                if (message.get_status() !== 200) {
                    this.hide_applet_icon();
                    global.logWarning('Failure to receive valid response from remote api');
                } else {
                    const bytes = session.send_and_read_finish(response);
                    this._parseIconJSON(ByteArray.toString(bytes.get_data()));
                }
            });
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
                this._applet_icon = new St.Icon({gicon, style_class: "applet-icon"});
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
        for (var currencyName in this.currencies) {
            this.currencies[currencyName] = Object.assign({
                symbol: '\u00A4',
                precision: 2
            }, this.currencies[currencyName]);
        }
    },

    _notifyMessage: function(title, message, iconName) {
        let icon = new St.Icon({
            icon_name: iconName,
            icon_type: St.IconType.SYMBOLIC,
        });
        let notification = new MessageTray.Notification(this.notificationSource, title, message, {icon});
		notification.setTransient(true);
		this.notificationSource.notify(notification);
    },

    on_applet_removed_from_panel: function() {
        this.settings.finalize();

        if (this._updateTimeout) {
            Mainloop.source_remove(this._updateTimeout);
            this._updateTimeout = undefined;
        }

        if (this._alertTimeout) {
            Mainloop.source_remove(this._alertTimeout);
            this._alertTimeout = undefined;
        }
    },

    on_applet_clicked: function(event) {
        this.menu.toggle();
    }
};

function main(metadata, orientation, panel_height, instance_id) {
    return new MyApplet(metadata, orientation, panel_height, instance_id);
}
