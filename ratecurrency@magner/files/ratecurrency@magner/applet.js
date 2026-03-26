'use strict';

// System libs
const Applet = imports.ui.applet; // main
const Settings = imports.ui.settings; // applet settings support
const St = imports.gi.St; // label, graph
const Lang = imports.lang; // for menus
const PopupMenu = imports.ui.popupMenu; // popup menu for graph and context
const Gio = imports.gi.Gio; // files
const Util = imports.misc.util; // button to go to the site (command line)
const MainLoop = imports.mainloop; // for timer update loop
const Soup = imports.gi.Soup; // http connection
const ByteArray = imports.byteArray;

// User variables
const UUID = 'ratecurrency@magner';
const APPLET_ROOT = imports.ui.appletManager.appletMeta[UUID].path;
const modules = imports.ui.appletManager.applets[UUID].modules;

const {
  fetchEUFiat,
  fetchPrevEUFiat,
  fetchEUFiatHistory,
  fetchRUFiat,
  fetchRUFiatHistory,
  fetchCrypto,
  fetchCryptoHistory,
} = modules.api;

const {
  getPrice,
  getPercent,
  getDelta,
  getTimeToUpdateFiat,
  setSign,
  setStyle,
} = modules.helpers;

const $t = modules.stringsForTranslation.$t(UUID);
const parseEUbank = modules.parseEUbank.parseData;
const parseRUbank = modules.parseRUbank.parseData;
const drawGraph = modules.graph.drawGraph;
const contextMenu = modules.contextMenu.buildContextMenu;
const notify = modules.notifications.notify;

// links
const fiatImageDirectory = '/images/fiat_money/';
const coinImageDirectory = '/images/coins/';

let httpSession;
if (Soup.MAJOR_VERSION == 2) {
    httpSession = new Soup.SessionAsync();
    Soup.Session.prototype.add_feature.call(httpSession, new Soup.ProxyResolverDefault());
} else { //version 3
    httpSession = new Soup.Session();
}

class RateCurrencyApplet extends Applet.TextIconApplet {
  constructor(metadata, orientation, panel_height, instance_id) {
    super(orientation, panel_height, instance_id);
    this.setAllowedLayout(Applet.AllowedLayout.BOTH);

    this.labelName = new St.Label({
      reactive: true,
      track_hover: true,
      style_class: 'applet-label',
    });

    this.label = new St.Label({
      reactive: true,
      track_hover: true,
      style_class: 'applet-label',
    });

    this.actor.add(this.labelName, {
      x_align: St.Align.MIDDLE,
      y_align: St.Align.MIDDLE,
      y_fill: false,
    });

    this.actor.add(this.label, {
      x_align: St.Align.MIDDLE,
      y_align: St.Align.MIDDLE,
      y_fill: false,
    });

    try {
      this.settings = new Settings.AppletSettings(this, metadata.uuid, instance_id);

      this.settings.bind('country', 'serverFiat', this.updateLabel);

      this.settings.bind('select-coin', 'cryptoConnect', this.updateLabel);
      this.settings.bind('apiKey', 'APIkey', this.updateLabel);
      this.settings.bind('coin', 'cryptoID', this.updateLabel);
      this.settings.bind('ApiInterval', 'CryptoInterval', this.updateLabel);

      this.settings.bind('currency', 'Currency', this.updateLabel);
      this.settings.bind('display', 'display', this.updateData);
      this.settings.bind('show-icon', 'showIcon', this.updateData);
      this.settings.bind('show-name', 'showName', this.updateData);

      this.settings.bind('graph-On', 'graphOn', this.showTooltip);
      this.settings.bind('graphDuration', 'duration', this.loadHistory);
      this.settings.bind('graphColor', 'graphColor');

      this.settings.bind('alert-On', 'alertOn', this.alertOnUpdate);
      this.settings.bind('alertAbove', 'alertAbove', this.alertOnUpdate);
      this.settings.bind('alertBelow', 'alertBelow', this.alertOnUpdate);
      this.settings.bind('alertType', 'alertType', this.alertOnUpdate);

      const menuManager = new PopupMenu.PopupMenuManager(this);
      this.menu = new Applet.AppletPopupMenu(this, orientation);
      menuManager.addMenu(this.menu);

      this.graph = new St.DrawingArea({ reactive: false });
      this.graph.width = 380;
      this.graph.height = 240;

      this.menu.addActor(this.graph);

      this.menu.connect('open-state-changed', Lang.bind(this, function(menu, isOpen) {
        if (isOpen) {
          this.graph.queue_repaint();
        }
      }));

      this.graph.connect('repaint', Lang.bind(this, this.drawGraph));

      this.connectionCounter = 0;
      this.graphData = {};
      this.crypto = {};
      this.fiatEU = {};
      this.fiatRU = {};

      this.showTooltip();
      contextMenu($t.messages.updateQuote, this._applet_context_menu, this.updateLabel);
      this.updateLabel();
    }
    catch (error) {
      global.logError(`Rate currency. Settings ${error}`);
    }
  }

  connectionError(messageKey) {
    this.reset();
    this.setLabel($t.messages[messageKey]);
  }

  setLabelForFiat() {
    this.setLabel(getPrice(1, this.Currency));
    this.setIcon(this.Currency, fiatImageDirectory);
    this.setName(this.Currency);
  }
  
  $http(url, callback, key = null) {
    const RU = this.serverFiat === 'RU' && this.Currency === 'RUB';
    const EU = this.serverFiat === 'EU' && this.Currency === 'EUR';
    const isFiatConnect = RU || EU;

    if (!this.cryptoConnect && isFiatConnect) {
      this.setLabelForFiat();

      return;
    }
    else if (this.cryptoConnect && !this.APIkey) {
      this.connectionError('setKey');

      return;
    }

    const onConnectionFailed = () => {
      this.connectionError('error');

      this.connectionCounter += 1;

      // second chance to connect if there was a server error
      if (this.connectionCounter === 1) {
        if (this.timeoutID) {
          MainLoop.source_remove(this.timeoutID);
          this.timeoutID = 0;
        }

        this.connectionError('reconnect');

        this.timeoutID = MainLoop.timeout_add_seconds(3, Lang.bind(this, this.updateLabel));
      }
    };
    
    const connection = Soup.Message.new('GET', url);

    if (this.cryptoConnect && key) {
      if (Soup.MAJOR_VERSION == 2) {
        connection.request_headers.append('X-CMC_PRO_API_KEY', key);
      } else { //version 3
        connection.get_request_headers().append('X-CMC_PRO_API_KEY', key);
      }
    }

    if (Soup.MAJOR_VERSION == 2) {
      httpSession.queue_message(connection, (session, response) => {
        if (response.status_code !== Soup.KnownStatusCode.OK) {
          global.logError(`Error during download: response code ${response.status_code}: ${response.reason_phrase} - ${response.response_body.data}`);
          onConnectionFailed();

          return;
        }

        this.connectionCounter = 0;

        const { data } = response.response_body;
        Lang.bind(this, callback)(data);
      });
    } else { //version 3
      httpSession.send_and_read_async(connection, Soup.MessagePriority.NORMAL, null, (session, response) => {
        if (connection.get_status() !== Soup.Status.OK) {
          global.logError(`Error during download: response code ${connection.get_status()}: ${connection.get_reason_phrase()}`);
          onConnectionFailed();

          return;
        }

        this.connectionCounter = 0;

        const bytes = httpSession.send_and_read_finish(response);
        Lang.bind(this, callback)(ByteArray.toString(bytes.get_data()));
      });
    }
  }

  // server selection
  updateLabel() {
    this.reset();

    if (this.cryptoConnect) {
      this.updateLabelCrypto();
    }
    else if (this.serverFiat === 'RU') {
      this.updateLabelFiat(this.$http(fetchRUFiat(), this.loadRUFiat));
    }
    else {
      this.updateLabelFiat(this.$http(fetchEUFiat(this.Currency), this.loadEUFiat));
    }
  }

  // crypto currency auto update interval
  updateLabelCrypto() {
    if (this.coinTimeoutID) {
      MainLoop.source_remove(this.coinTimeoutID);
      this.coinTimeoutID = 0;
    }

    this.$http(fetchCrypto(this.cryptoID, this.Currency), this.loadCrypto, this.APIkey);
    this.coinTimeoutID = MainLoop.timeout_add_seconds(this.CryptoInterval * 60, Lang.bind(this, this.updateLabel));
  }

  // fiat currency auto update interval
  updateLabelFiat(callback) {
    if (this.fiatTimeoutID) {
      MainLoop.source_remove(this.fiatTimeoutID);
      this.fiatTimeoutID = 0;
    }

    callback;

    // in seconds, for set milliseconds use 'timeout_add'
    this.fiatTimeoutID = MainLoop.timeout_add_seconds(getTimeToUpdateFiat(), Lang.bind(this, this.updateLabel));
  }

  // access to data without connecting to the server
  updateData() {
    this.reset();

    if (this.cryptoConnect) {
      this.dataLabel(this.crypto, 'crypto', this.crypto.Symbol, this.Currency, 'Percent24H');
    }
    else if (this.serverFiat === 'RU') {
      this.dataLabel(this.fiatRU, 'fiat', this.Currency, 'RUB', 'Percent');
    }
    else {
      this.dataLabel(this.fiatEU, 'fiat', $t.fiatName.EUR, this.Currency, 'Percent');
    }
  }
  
  // Received data from the server. Used without reconnection without need
  dataLabel(obj, type, name, currency, percentProp) {
    let label;
    let style;

    switch (this.display) {
      case 'money':
        if (type === 'fiat') {
          label = `${getPrice(obj.Price, currency)}${setSign(obj.Delta)}`;
        }
        else {
          label = getPrice(obj.Price, currency);
        }

        style = '';
        break;

      case 'delta':
        label = getDelta(obj.Delta, currency);
        style = setStyle(obj.Delta);
        break;

      default:
        label = getPercent(obj[percentProp]);
        style = setStyle(obj[percentProp]);
    }

    this.setLabel(label, style);

    if (type === 'fiat') {
      this.setIcon(this.Currency, fiatImageDirectory);
    }
    else {
      this.setIcon(this.crypto.Symbol, coinImageDirectory);
    }

    this.setName(name);
    this.alertOnUpdate();
  }

  // loading the latest data if necessary
  loadEUFiat(data) {
    const response = JSON.parse(data);
    const date = new Date(response.date).toLocaleDateString();
    const result = response.rates[this.Currency];

    this.fiatEU = {
      Name: $t.fiatName[this.Currency], // string
      Price: result, // float number
      LastUpdate: date, // string
    };

    this.loadPrevPriceEU(null, response.date);
  }

  // loading previous data for calculating delta and percentage change
  loadPrevPriceEU(data, lastDate) {
    if (!data) {
      const date = new Date(lastDate);
      let result = new Date(date.getFullYear(), date.getMonth(), date.getDate() - 1);

      result = `${result.getFullYear()}-${('0' + (result.getMonth() + 1)).slice(-2)}-${result.getDate()}`;

      return this.$http(fetchPrevEUFiat(result, this.Currency), this.loadPrevPriceEU);
    }
    else {
      this.fiatEU.PrevPrice = JSON.parse(data).rates[this.Currency]; // float number
      this.fiatEU.Delta = this.fiatEU.Price - this.fiatEU.PrevPrice; // float number
      this.fiatEU.Percent = this.fiatEU.Price / this.fiatEU.PrevPrice * 100 - 100; // float number

      this.dataLabel(this.fiatEU, 'fiat', $t.fiatName.EUR, this.Currency, 'Percent');
      this.loadHistory();
    }
  }

  // loading the latest data if necessary
  loadRUFiat(data) {
    const response = JSON.parse(data);
    const date = new Date(response.Date).toLocaleDateString();
    const result = response.Valute[this.Currency];

    const { ID, Name, Previous, Value } = result;

    if (result) {
      this.fiatRU = {
        ID, // string
        Name, // string
        PrevPrice: Previous, // float number
        Price: Value, // float number
        Delta: Value - Previous, // float number
        Percent: Value / Previous * 100 - 100, // float number
        LastUpdate: date, // string
      };

      this.dataLabel(this.fiatRU, 'fiat', this.Currency, 'RUB', 'Percent');
      this.loadHistory();
    }
    else {
      this.setLabel(getPrice(1, this.Currency));
    }
  }

  // loading the latest data if necessary
  loadCrypto(data) {
    const response = JSON.parse(data).data[this.cryptoID];
    const date = new Date(response.last_updated).toLocaleString();
    const result = response.quote[this.Currency];

    const { name, symbol, cmc_rank } = response;
    const { price, percent_change_24h, percent_change_1h, percent_change_7d } = result;

    this.crypto = {
      Name: name, // string
      Symbol: symbol, // string
      Rank: cmc_rank, // int number
      PrevPrice: price / (percent_change_24h + 100) * 100, // float number
      Price: price, // float number
      Delta: price - (price / (percent_change_24h + 100) * 100), // float number
      Percent1H: percent_change_1h, // float number
      Percent24H: percent_change_24h, // float number
      Percent7D: percent_change_7d, // float number
      LastUpdate: date, // string
    };

    this.dataLabel(this.crypto, 'crypto', this.crypto.Symbol, this.Currency, 'Percent24H');
    this.loadHistory();
  }

  visitWebsite() {
    Util.spawnCommandLine('xdg-open https://pro.coinmarketcap.com');
  }

  // PopUp graph
  on_applet_clicked() {
    if (this.graphOn) {
      this.menu.toggle();
    }
  }

  // loading the latest history data if necessary
  loadHistory() {
    if (this.cryptoConnect) {
      this.$http(fetchCryptoHistory(this.crypto.Symbol, this.Currency, this.duration), this.loadDataCryptoHistory);
    }
    else if (this.serverFiat === 'RU') {
      this.$http(fetchRUFiatHistory(this.fiatRU.ID, this.duration), this.loadDataFiatHistoryRU);
    }
    else {
      this.$http(fetchEUFiatHistory(this.Currency), this.loadDataFiatHistoryEU);
    }
  }

  loadDataFiatHistoryEU(data) {
    this.graphData = parseEUbank(this.duration, data.toString());
  }

  loadDataFiatHistoryRU(data) {
    this.graphData = parseRUbank(data.toString());
  }

  loadDataCryptoHistory(data) {
    const jsonOutput = JSON.parse(data);

    if (jsonOutput.hasOwnProperty('Response') && jsonOutput.Response === 'Error') {
      global.logError(jsonOutput.Message);
    }
    else {
      this.graphData = jsonOutput;
    }
  }

  drawGraph() {
    if (!this.graph.visible) {
      return;
    }

    let labels = {};

    if (this.cryptoConnect) {
      const crypto = this.crypto || {};
      const nameCrypto = crypto.Name || '';
      const symbolCrypto = crypto.Symbol ? `(${crypto.Symbol}): ` : '';
      const priceCrypto = crypto.Price ? getPrice(crypto.Price, this.Currency) : '';
      const title = `${nameCrypto} ${symbolCrypto}${priceCrypto}`;

      const rankCrypto = crypto.Rank ? $t.messages.rank + crypto.Rank : '';

      const delta = crypto.Delta;
      const deltaCrypto = delta ? getDelta(delta, this.Currency) : '';

      const percent1HCrypto = crypto.Percent1H ? $t.messages['1h'] + getPercent(crypto.Percent1H) : '';
      const percent24HCrypto = crypto.Percent24H ? $t.messages['24h'] + getPercent(crypto.Percent24H) : '';
      const percent7DCrypto = crypto.Percent7D ? $t.messages['7d'] + getPercent(crypto.Percent7D) : '';

      const lastUpdatedCrypto = crypto.LastUpdate ? $t.messages.update + crypto.LastUpdate : '';

      labels = {
        title,
        rank: rankCrypto,
        delta,
        deltaLabel: deltaCrypto,
        percent: {
          '1H': crypto.Percent1H,
          '24H': crypto.Percent24H,
          '7D': crypto.Percent7D,
        },
        percentLabel: {
          '1H': percent1HCrypto,
          '24H': percent24HCrypto,
          '7D': percent7DCrypto,
        },
        lastUpdated: lastUpdatedCrypto,
        minLabel: min => ($t.messages.min + getPrice(min, this.Currency)),
        maxLabel: max => ($t.messages.max + getPrice(max, this.Currency)),
      };
    }
    else {
      const currency = this.serverFiat === 'EU' ? this.Currency : 'RUB';
      const baseCurrency = this.serverFiat === 'EU' ? $t.fiatName.EUR : this.Currency;
      const fiat = this.serverFiat === 'EU' ? this.fiatEU : this.fiatRU;
  
      labels = {
        name: fiat.Name || '',
        price: fiat.Price ? `1 ${baseCurrency} = ${getPrice(fiat.Price, currency)}` : '',
        delta: fiat.Delta || 0,
        deltaLabel: `\u0394 ${getDelta(fiat.Delta || 0, currency)}`,
        averageLabel: average => getPrice(average, currency),
        percent: fiat.Percent || 0,
        percentLabel: getPercent(fiat.Percent || 0),
        lastUpdate: fiat.LastUpdate ? $t.messages.update + fiat.LastUpdate : '',
        minLabel: min => ($t.messages.min + getPrice(min, currency)),
        maxLabel: max => ($t.messages.max + getPrice(max, currency)),
      };
    }

    const colors = {
      graph: this.graphColor,
      increase: '#32d74b',
      decrease: '#ff453a',
    };

    const messages = {
      average: $t.messages.average,
      history: $t.messages.history,
      days: [$t.messages.day1, $t.messages.day2, $t.messages.day3],
      wait: $t.messages.ruWait,
      error: $t.messages.error,
    };

    const [width, height] = this.graph.get_surface_size();
    const context = this.graph.get_context();

    drawGraph(width, height, context, this.graphData, labels, colors, this.duration, messages, this.cryptoConnect);
  }

  // Alerts
  alertOnUpdate() {
    if (!this.alertOn) {
      return;
    }

    const fiat = this.serverFiat === 'RU' ? this.fiatRU : this.fiatEU;

    const price = this.cryptoConnect ? this.crypto.Price : fiat.Price;
    const currency = this.cryptoConnect || this.serverFiat === 'EU' ? this.Currency : 'RUB';
    const formatPrice = getPrice(price, currency);

    const percent = this.cryptoConnect ? this.crypto.Percent1H : fiat.Percent;
    const formatPercent = getPercent(percent || 0);

    const cryptoName = `${this.crypto.Name} (${this.crypto.Symbol})`;
    const fiatName = this.serverFiat === 'RU' ? this.fiatRU.Name : this.fiatEU.Name;

    const name = this.cryptoConnect ? cryptoName : fiatName;

    notify(name, this.alertAbove, this.alertBelow, price, formatPrice, percent, formatPercent, this.alertType);
  }

  // Labels
  reset() {
    this.hide_applet_icon();
    this.setName('');
    this.setLabel('');
  }

  setIcon(data, path) {
    if (!this.showIcon) {
      this.hide_applet_icon();

      return;
    }

    const iconFile = Gio.file_new_for_path(`${APPLET_ROOT}${path}${data.toLowerCase()}.png`);
    const gicon = new Gio.FileIcon({ file: iconFile });

    if (this._applet_icon_box.child) {
      this._applet_icon_box.child.destroy();
    }

    this._applet_icon = new St.Icon({
      gicon,
      reactive: true,
      track_hover: true,
      style_class: 'applet-icon',
    });

    this._applet_icon.set_icon_size(this.getPanelIconSize(St.IconType.FULLCOLOR) * .9);
    this._applet_icon_box.child = this._applet_icon;
  }

  setName(text) {
    // Hide empty labels
    if (!this.showName || !text) {
      this.labelName.hide();

      return;
    }

    this.labelName.set_text(`${text}: `);
    this.labelName.set_style('');
    this.labelName.show();
  }

  setLabel(text, css_style = '') {
    // Hide empty labels
    if (!text) {
      this.label.hide();

      return;
    }

    this.label.set_text(text);
    this.label.set_style(css_style);
    this.label.show();
  }

  showTooltip() {
    if (this.graphOn) {
      this.set_applet_tooltip($t.messages.tooltip);
    }
    else {
      this.set_applet_tooltip('');
    }
  }

  on_applet_removed_from_panel() {
    if (this.timeoutID) {
      MainLoop.source_remove(this.timeoutID);
      this.timeoutID = 0;
    }

    if (this.coinTimeoutID) {
      MainLoop.source_remove(this.coinTimeoutID);
      this.coinTimeoutID = 0;
    }

    if (this.fiatTimeoutID) {
      MainLoop.source_remove(this.fiatTimeoutID);
      this.fiatTimeoutID = 0;
    }

    this.settings.finalize();
  }
}

function main(metadata, orientation, panel_height, instance_id) {
  return new RateCurrencyApplet(metadata, orientation, panel_height, instance_id);
}
