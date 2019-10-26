'use strict';

// System libs
const Main = imports.ui.main,
			Applet = imports.ui.applet, // main
			Settings = imports.ui.settings, // applet settings support
			Soup = imports.gi.Soup, // https connections
			St = imports.gi.St, // label, graph
			Lang = imports.lang, // for menus
			PopupMenu = imports.ui.popupMenu, // popup menu for graph and context
			Gio = imports.gi.Gio, // files
			Clutter = imports.gi.Clutter, // graph
			Util = imports.misc.util, // button to go to the site (command line)
			Mainloop = imports.mainloop, // for timer update loop
			MessageTray = imports.ui.messageTray, // for notifications
			Gettext = imports.gettext, // for translations
			GLib = imports.gi.GLib; // for translations

// User variables
const UUID = 'ratecurrency@magner',
			APPLET_ROOT = imports.ui.appletManager.appletMeta[UUID].path,
			parseEUbank = imports.ui.appletManager.applets[UUID].modules.parseEUbank,
			parseRUbank = imports.ui.appletManager.applets[UUID].modules.parseRUbank;

// links
const mainURL_EU = 'https://api.ratesapi.io/api/latest?base=EUR&symbols=',
			mainURL_RU = 'https://www.cbr-xml-daily.ru/daily_json.js',
			mainURL_Crypto = 'https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?id=',
			historyURL_EU = 'https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/',
			historyURL_RU = 'https://www.cbr.ru/scripts/XML_dynamic.asp',
			historyURL_Crypto = 'https://min-api.cryptocompare.com/data/histoday?fsym=',
			fiatImageDirectory = '/images/fiat_money/',
			coinImageDirectory = '/images/coins/';

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");

// translations
function _(str) {
	let text = Gettext.dgettext(UUID, str);
	if (text !== str && text !== '') { return text; }
	return Gettext.gettext(str);
}

// strings for translation
const fiatName = {
	'AUD': _('Australian dollar'),
	'BRL': _('Brazilian real'),
	'BGN': _('Bulgarian lev'),
	'CAD': _('Canadian dollar'),
	'CNY': _('Chinese yuan renminbi'),
	'CZK': _('Czech koruna'),
	'DKK': _('Danish krone'),
	'EUR': _('Euro'),
	'HKD': _('Hong Kong dollar'),
	'HUF': _('Hungarian forint'),
	'INR': _('Indian rupee'),
	'JPY': _('Japanese yen'),
	'NOK': _('Norwegian krone'),
	'PLN': _('Polish zloty'),
	'GBP': _('Pound sterling'),
	'RON': _('Romanian leu'),
	'RUB': _('Russian rouble'),
	'SGD': _('Singapore dollar'),
	'ZAR': _('South African rand'),
	'KRW': _('South Korean won'),
	'SEK': _('Swedish krona'),
	'CHF': _('Swiss franc'),
	'TRY': _('Turkish lira'),
	'USD': _('US dollar')
};

const msg_setKey = _('Set API key...'),
			msg_error = _('Error'),
			msg_reconnect = _('Reconnect'),
			msg_update = _('Update: '),
			msg_rank = _('Rank: #'),
			msg_1h = _('1H:'),
			msg_24h = _('24H:'),
			msg_7d = _('7D:'),
			msg_max = _('Max.: '),
			msg_min = _('Min.: '),
			msg_ru_wait = _('For the Russian server, try again in 15 seconds.'),
			msg_history = _('History for '),
			msg_day1 = _(' day'),
			msg_day2 = _(' days'),
			msg_day3 = _(' _days'), // for some countries the third declension of the word
			msg_average = _('Average:'),
			msg_tooltip = _('Click to open graph'),
			msg_updateMenu = _('Update quote');

const increase_css = '#32d74b',
			decrease_css = '#ff453a',
			increaseSign = ' \u25b4',
			decreaseSign = ' \u25be';


// http connection
const httpSession = new Soup.SessionAsync();
Soup.Session.prototype.add_feature.call(httpSession, new Soup.ProxyResolverDefault());

class RateCurrencyApplet extends Applet.TextIconApplet {
	constructor(metadata, orientation, panel_height, instance_id) {
    super(orientation, panel_height, instance_id);
		this.setAllowedLayout(Applet.AllowedLayout.BOTH);

		this.labelName = new St.Label({
			reactive: true,
			track_hover: true,
			style_class: 'applet-label'
		});

		this.label = new St.Label({
			reactive: true,
			track_hover: true,
			style_class: 'applet-label'
		});

		this.actor.add(this.labelName, {
			x_align: St.Align.MIDDLE,
			y_align: St.Align.MIDDLE,
			y_fill: false
		});

		this.actor.add(this.label, {
			x_align: St.Align.MIDDLE,
			y_align: St.Align.MIDDLE,
			y_fill: false
		});

		try {
			this.settings = new Settings.AppletSettings(this, metadata.uuid, instance_id);

			this.settings.bind('country', 'serverFiat', this._updateLabel);

			this.settings.bind('select-coin', 'cryptoConnect', this._updateLabel);
			this.settings.bind('apiKey', 'APIkey', this._updateLabel);
			this.settings.bind('coin', 'cryptoID', this._updateLabel);
			this.settings.bind('ApiInterval', 'CryptoInterval', this._updateLabel);

			this.settings.bind('currency', 'Currency', this._updateLabel);
			this.settings.bind('display', 'display', this._updateData);
			this.settings.bind('show-icon', 'showIcon', this._updateData);
			this.settings.bind('show-name', 'showName', this._updateData);

			this.settings.bind('graph-On', 'graphOn', this._viewTooltip);
			this.settings.bind('graphDuration', 'duration', this._loadHistory);
			this.settings.bind('graphColor', 'graphColor');

			this.settings.bind('alert-On', 'alertOn', this._alertOnUpdate);
			this.settings.bind('alertAbove', 'alertAbove', this._alertOnUpdate);
			this.settings.bind('alertBelow', 'alertBelow', this._alertOnUpdate);
			this.settings.bind('alertType', 'alertType', this._alertOnUpdate);

			this.menuManager = new PopupMenu.PopupMenuManager(this);
			this.menu = new Applet.AppletPopupMenu(this, orientation);
			this.menuManager.addMenu(this.menu);

			this.graph = new St.DrawingArea({ reactive: false });
			this.graph.width = 380;
			this.graph.height = 240;
			this.menu.addActor(this.graph);
			this.graphData = {};

			this.menu.connect('open-state-changed', Lang.bind(this, function(menu, isOpen) {
				if (isOpen) { this.graph.queue_repaint(); }
			}));
			this.graph.connect('repaint', Lang.bind(this, this._drawGraph));

			this.notificationSource = new MessageTray.SystemNotificationSource();
			Main.messageTray.add(this.notificationSource);

			this.count = 0;
			this.Crypto = {};
			this.fiatEU = {};
			this.fiatRU = {};

			this._viewTooltip();
			this._buildContextMenu();
			this._updateLabel();
		} catch (e) { global.logError(e); }
	}

	// server selection
	_updateLabel() {
		this._clear();

		if (this.cryptoConnect) { this._updateLabelCrypto(); }
		else if (this.serverFiat === 'RU') { this._updateLabelFiat(this._connection(mainURL_RU, this._loadRU_Fiat, null)); }
		else { this._updateLabelFiat(this._connection(`${mainURL_EU}${this.Currency}`, this._loadEU_Fiat, null)); }
	}

	// crypto currency auto update interval
	_updateLabelCrypto() {
		if (this.CoinTimeoutId) {
			Mainloop.source_remove(this.CoinTimeoutId);
			this.CoinTimeoutId = 0;
		}

		this._connection(`${mainURL_Crypto}${this.cryptoID}&convert=${this.Currency}`, this._loadCrypto, this.APIkey);
		this.CoinTimeoutId = Mainloop.timeout_add_seconds(this.CryptoInterval * 60, Lang.bind(this, this._updateLabel));
	}

	// fiat currency auto update interval
	_updateLabelFiat(callback) {
		if (this.FiatTimeoutId) {
			Mainloop.source_remove(this.FiatTimeoutId);
			this.FiatTimeoutId = 0;
		}

		callback;
		// in seconds, for set milliseconds use 'timeout_add'
		this.FiatTimeoutId = Mainloop.timeout_add_seconds(this._getTimeToUpdateFiat(), Lang.bind(this, this._updateLabel));
	}

	// update every day at 23:00 (11:00 PM)
	_getTimeToUpdateFiat() {
		let now = new Date(),
				newDate = now.getHours() >= 23 ? now.getDate() + 2 : now.getDate() + 1;

		let updateDate = new Date(now.getFullYear(), now.getMonth(), newDate);
		return Math.round((updateDate - now) / 1000 - 60 * 60);
	}


	// connection to the selected server
	_connection(url, callback, key) {
		if (!this.cryptoConnect) {
			if (this.serverFiat === 'RU' && this.Currency === 'RUB' || this.serverFiat === 'EU' && this.Currency === 'EUR') {
				this._setLabel(this._getPrice(1, this.Currency), '');
				this._setIcon(this.Currency, fiatImageDirectory);
				this._setName(this.Currency);
				return;
			}
		}

		let message = Soup.Message.new('GET', url);

		if (this.cryptoConnect) {
			if (!this.APIkey) {
				this._clear();
				this._setLabel(msg_setKey, '');
				return;
			}
			if (key != null) { message.request_headers.append('X-CMC_PRO_API_KEY', key); }
		}

		httpSession.queue_message(message, Lang.bind(this, function(session, response) {
			if (response.status_code !== Soup.KnownStatusCode.OK) {
				this._clear();
				this._setLabel(msg_error, '');
				global.log(`Error during download: response code ${response.status_code}: ${response.reason_phrase} - ${response.response_body.data}`);

				this.count += 1;

				// second chance to connect if there was a server error
				if (this.count == 1) {
					if (this.TimeoutId) {
						Mainloop.source_remove(this.TimeoutId);
						this.TimeoutId = 0;
					}

					this._clear();
					this._setLabel(msg_reconnect, '');
					this.TimeoutId = Mainloop.timeout_add_seconds(3, Lang.bind(this, this._updateLabel));
				}
				return;
			}
			this.count = 0;
			Lang.bind(this, callback)(response.response_body.data, null);
		}));
	}

	// access to data without connecting to the server
	_updateData() {
		this._clear();
		if (this.cryptoConnect) { this._dataCrypto(); }
		else if (this.serverFiat === 'RU') { this._dataFiatRU(); }
		else { this._dataFiatEU(); }
	}

	// EU
	// Received data from the server. Used without reconnection without need
	_dataFiatEU() {
		if (this.display == 'money') {
			this._setLabel(`${this._getPrice(this.fiatEU['Price'], this.Currency)}${this._setSign(this.fiatEU['Delta'])}`, '');
		}
		else if (this.display == 'delta') {
			this._setLabel(this._getDelta(this.fiatEU['Delta'], this.Currency), this._setStyle(this.fiatEU['Delta']));
		}
		else { this._setLabel(this._getPercent(this.fiatEU['Percent']), this._setStyle(this.fiatEU['Percent'])); }

		this._setIcon(this.Currency, fiatImageDirectory);
		this._setName(fiatName['EUR']);
		this._alertOnUpdate();
	}

	// loading the latest data if necessary
	_loadEU_Fiat(data) {
		let response = JSON.parse(data),
				date = new Date(response['date']).toLocaleDateString(),
				result = response['rates'][this.Currency];

		this.fiatEU = {
			'Name': fiatName[this.Currency], // string
			'Price': result, // float number
			'LastUpdate': date // string
		};

		this._loadPrevPriceEU(null, response.date);
	}

	// loading previous data for calculating delta and percentage change
	_loadPrevPriceEU(data, lastDate) {
		if (!data) {
			let date = new Date(lastDate),
					result = new Date(date.getFullYear(), date.getMonth(), date.getDate() - 1);
			result = `${result.getFullYear()}-${('0' + (result.getMonth() + 1)).slice(-2)}-${result.getDate()}`;

			return this._connection(`https://api.ratesapi.io/api/${result}?base=EUR&symbols=${this.Currency}`, this._loadPrevPriceEU, null);
		}
		else {
			this.fiatEU['PrevPrice'] = JSON.parse(data).rates[this.Currency]; // float number
			this.fiatEU['Delta'] = this.fiatEU['Price'] - this.fiatEU['PrevPrice']; // float number
			this.fiatEU['Percent'] = this.fiatEU['Price'] / this.fiatEU['PrevPrice'] * 100 - 100; // float number
			this._dataFiatEU();
			this._loadHistory();
		}
	}

	// RU
	// Received data from the server. Used without reconnection without need
	_dataFiatRU() {
		if (this.display === 'money') {
			this._setLabel(`${this._getPrice(this.fiatRU['Price'], 'RUB')}${this._setSign(this.fiatRU['Delta'])}`, '');
		}
		else if (this.display === 'delta') {
			this._setLabel(this._getDelta(this.fiatRU['Delta'], 'RUB'), this._setStyle(this.fiatRU['Delta']));
		}
		else { this._setLabel(this._getPercent(this.fiatRU['Percent']), this._setStyle(this.fiatRU['Percent'])); }

		this._setIcon(this.Currency, fiatImageDirectory);
		this._setName(this.Currency);
		this._alertOnUpdate();
	}

	// loading the latest data if necessary
	_loadRU_Fiat(data) {
		let response = JSON.parse(data),
				date = new Date(response['Date']).toLocaleDateString(),
				result = response['Valute'][this.Currency];

		if (result != undefined) {
			this.fiatRU = {
				'ID': result['ID'], // string
				'Name': result['Name'], // string
				'PrevPrice': result['Previous'], // float number
				'Price': result['Value'], // float number
				'Delta': result['Value'] - result['Previous'], // float number
				'Percent': result['Value'] / result['Previous'] * 100 - 100, // float number
				'LastUpdate': date // string
			};
			this._dataFiatRU();
			this._loadHistory();
		}
		else { this._setLabel(this._getPrice(1, this.Currency), ''); }
	}


	// Crypto currency
	// Received data from the server. Used without reconnection without need
	_dataCrypto() {
		if (this.display == 'money') {
			this._setLabel(this._getPrice(this.Crypto['Price'], this.Currency), '');
		}
		else if (this.display == 'delta') {
			this._setLabel(this._getDelta(this.Crypto['Delta'], this.Currency), this._setStyle(this.Crypto['Delta']));
		}
		else { this._setLabel(this._getPercent(this.Crypto['Percent24H']), this._setStyle(this.Crypto['Percent24H'])); }

		this._setIcon(this.Crypto['Symbol'], coinImageDirectory);
		this._setName(this.Crypto['Symbol']);
		this._alertOnUpdate();
	}

	// loading the latest data if necessary
	_loadCrypto(data) {
		let response = JSON.parse(data).data[this.cryptoID],
				date = new Date(response['last_updated']).toLocaleString(),
				result = response['quote'][this.Currency];

		this.Crypto = {
			'Name': response['name'], // string
			'Symbol': response['symbol'], // string
			'Rank': response['cmc_rank'], // int number
			'PrevPrice': result['price'] / (result['percent_change_24h'] + 100) * 100, // float number
			'Price': result['price'], // float number
			'Delta': result['price'] - (result['price'] / (result['percent_change_24h'] + 100) * 100), // float number
			'Percent1H': result['percent_change_1h'], // float number
			'Percent24H': result['percent_change_24h'], // float number
			'Percent7D': result['percent_change_7d'], // float number
			'LastUpdate': date // string
		};
		this._dataCrypto();
		this._loadHistory();
	}

	_visit_website() { Util.spawnCommandLine('xdg-open https://pro.coinmarketcap.com'); }



	// PopUp graph
	on_applet_clicked(event) { if (this.graphOn) { this.menu.toggle(); } }

	// loading the latest history data if necessary
	_loadHistory() {
		if (this.cryptoConnect) {
			this._connection(`${historyURL_Crypto}${this.Crypto['Symbol']}&tsym=${this.Currency}&limit=${this.duration}`, this._loadDataCryptoHistory, null);
		}
		else if (this.serverFiat === 'RU') {
			this._connection(`${historyURL_RU}${parseRUbank._formatPeriod(this.duration)}&VAL_NM_RQ=${this.fiatRU['ID']}`, this._loadDataFiatHistoryRU, null);
		}
		else {
			this._connection(`${historyURL_EU}${this.Currency.toLowerCase()}.xml`, this._loadDataFiatHistoryEU, null);
		}
	}

	_loadDataFiatHistoryEU(data) {
		let periodDates = parseEUbank._formatPeriod(this.duration);
		let jsonOutput = parseEUbank._periodFromArray(data.toString(), periodDates[0], periodDates[1]);
		this.graphData = parseEUbank._parseXML(jsonOutput);
	}

	_loadDataFiatHistoryRU(data) { this.graphData = parseRUbank._parseXML(data.toString()); }

	_loadDataCryptoHistory(data) {
		let jsonOutput = JSON.parse(data);

		if (jsonOutput.hasOwnProperty('Response') && jsonOutput['Response'] === 'Error') {
			global.logError(jsonOutput.Message);
			return;
		}
		else { this.graphData = jsonOutput; }
	}

	_drawGraph() {
		if (!this.graph.visible) { return; }

		let [width, height] = this.graph.get_surface_size(),
				[res, color] = Clutter.Color.from_string(this.graphColor),
				colorIncrease = Clutter.Color.from_string(increase_css),
				colorDecrease = Clutter.Color.from_string(decrease_css);

		let colorPercentFiat = this.serverFiat == 'EU' ? this.fiatEU['Percent'] : this.fiatRU['Percent'],
				colorDeltaFiat = this.serverFiat == 'EU' ? this.fiatEU['Delta'] : this.fiatRU['Delta'],
				[resPercEU, colorPercent] = colorPercentFiat < 0 ? colorDecrease : colorIncrease,
				[resDeltaEU, colorDelta] = colorDeltaFiat < 0 ? colorDecrease : colorIncrease,
				[res1H, colorPercent1H] = this.Crypto['Percent1H'] < 0 ? colorDecrease : colorIncrease,
				[res24H, colorPercent24H] = this.Crypto['Percent24H'] < 0 ? colorDecrease : colorIncrease,
				[res7D, colorPercent7D] = this.Crypto['Percent7D'] < 0 ? colorDecrease : colorIncrease,
				[resDeltaCrypto, colorDeltaCrypto] = this.Crypto['Delta'] < 0 ? colorDecrease : colorIncrease;

		let nameEU = this.fiatEU['Name'] == undefined ? '' : this.fiatEU['Name'],
				priceEU = this.fiatEU['Price'] == undefined ? '' : `1 ${fiatName['EUR']} = ${this._getPrice(this.fiatEU['Price'], this.Currency)}`,
				deltaEU = this.fiatEU['Delta'] == undefined ? '' : this._getDelta(this.fiatEU['Delta'], this.Currency),
				percentEU = this.fiatEU['Percent'] == undefined ? '' : this._getPercent(this.fiatEU['Percent']),
				lastUpdateEU = this.fiatEU['LastUpdate'] == undefined ? '' : msg_update + this.fiatEU['LastUpdate'];

		let nameRU = this.fiatRU['Name'] == undefined ? '' : this.fiatRU['Name'],
				priceRU = this.fiatRU['Price'] == undefined ? '' : `1 ${this.Currency} = ` + this._getPrice(this.fiatRU['Price'], 'RUB'),
				deltaRU = this.fiatRU['Delta'] == undefined ? '' : this._getDelta(this.fiatRU['Delta'], 'RUB'),
				percentRU = this.fiatRU['Percent'] == undefined ? '' : this._getPercent(this.fiatRU['Percent']),
				lastUpdateRU = this.fiatRU['LastUpdate'] == undefined ? '' : msg_update + this.fiatRU['LastUpdate'];

		let nameCrypto = this.Crypto['Name'] == undefined ? '' : this.Crypto['Name'],
				symbolCrypto = this.Crypto['Symbol'] == undefined ? '' : `(${this.Crypto['Symbol']}): `,
				rankCrypto = this.Crypto['Rank'] == undefined ? '' : msg_rank + this.Crypto['Rank'],
				priceCrypto = this.Crypto['Price'] == undefined ? '' : this._getPrice(this.Crypto['Price'], this.Currency),
				deltaCrypto = this.Crypto['Delta'] == undefined ? '' : this._getDelta(this.Crypto['Delta'], this.Currency),
				percent1HCrypto = this.Crypto['Percent1H'] == undefined ? '' : msg_1h + this._getPercent(this.Crypto['Percent1H']),
				percent24HCrypto = this.Crypto['Percent24H'] == undefined ? '' : msg_24h + this._getPercent(this.Crypto['Percent24H']),
				percent7DCrypto = this.Crypto['Percent7D'] == undefined ? '' : msg_7d + this._getPercent(this.Crypto['Percent7D']),
				lastUpdatedCrypto = this.Crypto['LastUpdate'] == undefined ? '' : msg_update + this.Crypto['LastUpdate'];

		let cr = this.graph.get_context(),
				min = Number.POSITIVE_INFINITY,
				max = Number.NEGATIVE_INFINITY,
				average = 0,
				fontSizeTitle = 18,
				fontSizeNormal = 11;

		// EU graph
		if ('Obs' in this.graphData) {
			// Max, Min and Average price
			this.graphData.Obs.forEach(function(data) {
				if (data.value < min) { min = data.value; }
				if (data.value > max) { max = data.value; }
				average += data.value;
			});

			average = this._getPrice(average / this.graphData.Obs.length, this.Currency);
			let delta = max - min;

			// Draw graph
			let heightGraph = height - 112,
					step = (width - 110) / this.graphData.Obs.length;

			for (let i = 0; i < this.graphData.Obs.length; i++) {
				let nextIndex = i+1 === this.graphData.Obs.length ? i : i+1,
						valueLeft = height - 30 - (heightGraph * ((this.graphData.Obs[i].value - min) / delta)),
						valueRight = height - 30 - (heightGraph * ((this.graphData.Obs[nextIndex].value - min) / delta)),
						moveXleft = step / 2 + step * i,
						moveXright = step / 2 + step * (nextIndex);

				cr.setSourceRGB(color.red / 255, color.green / 255, color.blue / 255);
				cr.moveTo(moveXleft, valueLeft);
				cr.setLineWidth(2);
				cr.lineTo(moveXright, valueRight);
				cr.stroke();
			}

			max = msg_max + this._getPrice(max, this.Currency);
			min = msg_min + this._getPrice(min, this.Currency);
		}
		// RU graph
		else if ('Record' in this.graphData) {
			// Max, Min and Average price
			this.graphData.Record.forEach(function(data) {
				if (data.Value < min) { min = data.Value; }
				if (data.Value > max) { max = data.Value; }
				average += data.Value;
			});

			average = this._getPrice(average / this.graphData.Record.length, 'RUB');
			let delta = max - min;

			// Draw graph
			let heightGraph = height - 112,
					step = (width - 110) / this.graphData.Record.length;

			for (let i = 0; i < this.graphData.Record.length; i++) {
				let nextIndex = i+1 === this.graphData.Record.length ? i : i+1,
						valueLeft = height - 30 - (heightGraph * ((this.graphData.Record[i].Value - min) / delta)),
						valueRight = height - 30 - (heightGraph * ((this.graphData.Record[nextIndex].Value - min) / delta)),
						moveXleft = step / 2 + step * i,
						moveXright = step / 2 + step * (nextIndex);

				cr.setSourceRGB(color.red / 255, color.green / 255, color.blue / 255);
				cr.moveTo(moveXleft, valueLeft);
				cr.setLineWidth(2);
				cr.lineTo(moveXright, valueRight);
				cr.stroke();
			}

			max = msg_max + this._getPrice(max, 'RUB');
			min = msg_min + this._getPrice(min, 'RUB');
		}
		// Crypto graph
		else if ('Data' in this.graphData) {
			// Max and Min price
			this.graphData.Data.forEach(function(data) {
				if (data.low < min) { min = data.low; }
				if (data.high > max) { max = data.high; }
			});

			let delta = max - min;

			// Draw graph
			let heightGraph = height - 90,
					step = (width - 110) / this.graphData.Data.length;

			this.graphData.Data.forEach(function(data, index) {
				let low = heightGraph * ((data.low - min) / delta),
						high = heightGraph * ((data.high - min) / delta),
						open = heightGraph * ((data.open - min) / delta),
						close = heightGraph * ((data.close - min) / delta),
						moveX = step / 2 + step * index;

				cr.setSourceRGBA(color.red / 255, color.green / 255, color.blue / 255, 1);
				cr.moveTo(moveX, height - 30 - low);
				cr.setLineWidth(1);
				cr.lineTo(moveX, height - 30 - high);
				cr.stroke();

				cr.setSourceRGBA(color.red / 255, color.green / 255, color.blue / 255, open < close ? 1 : .4);
				cr.moveTo(moveX, height - 30 - open);
				cr.setLineWidth(3);
				cr.lineTo(moveX, height - 30 - close);
				cr.stroke();
			});
		}
		// Error
		else {
			// Error text
			this._graphText(cr, color, fontSizeTitle + 2, 15, height / 2 - (fontSizeTitle + 2), msg_error);
			this._graphText(cr, color, fontSizeNormal + 3, 15, height / 2 + (fontSizeNormal + 3), msg_ru_wait);
			return;
		}

		if (this.cryptoConnect) {
			let title = nameCrypto + ' ' + symbolCrypto + priceCrypto,
					titleSize = (width - title.length * 9) / 2,
					maxText = msg_max + this._getPrice(max, this.Currency),
					history = msg_history + this.duration + this._wordEndings(this.duration, [msg_day1, msg_day2, msg_day3]),
					historySize = width - history.length * 6.5 - 10,
					minText = msg_min + this._getPrice(min, this.Currency),
					lastDateSize = width - lastUpdatedCrypto.length * 6.5 - 10;

			this._graphText(cr, color, fontSizeTitle, titleSize, 22, title); // Title text
			this._graphText(cr, color, fontSizeNormal, 15, 45, maxText); // Max price text
			this._graphText(cr, color, fontSizeNormal, historySize, 45, history); // Count history days text
			this._graphLine(cr, color, 8, 50, width, 1); // Top line
			this._graphText(cr, color, fontSizeNormal + 1, width - 100, 80, rankCrypto); // Rank text
			this._graphText(cr, colorDeltaCrypto, fontSizeNormal, width - 100, 110, deltaCrypto); // Delta text
			this._graphText(cr, colorPercent1H, fontSizeNormal, width - 100, 150, percent1HCrypto); // Percents text
			this._graphText(cr, colorPercent24H, fontSizeNormal, width - 100, 170, percent24HCrypto); // Percents text
			this._graphText(cr, colorPercent7D, fontSizeNormal, width - 100, 190, percent7DCrypto); // Percents text
			this._graphLine(cr, color, 8, height - 16, width, 1); // Bottom line
			this._graphText(cr, color, fontSizeNormal, 15, height - 2, minText); // Min price text
			this._graphText(cr, color, fontSizeNormal, lastDateSize, height - 2, lastUpdatedCrypto); // Last update text
		}
		else {
			let name = this.serverFiat == 'EU' ? nameEU : nameRU,
					price = this.serverFiat == 'EU' ? priceEU : priceRU,
					history = msg_history + this.duration + this._wordEndings(this.duration, [msg_day1, msg_day2, msg_day3]),
					historySize = width - history.length * (fontSizeNormal/2 + 1.5) - 10,
					percent = this.serverFiat == 'EU' ? percentEU : percentRU,
					delta = '\u0394 ' + (this.serverFiat == 'EU' ? deltaEU : deltaRU),
					lastDate = this.serverFiat == 'EU' ? lastUpdateEU : lastUpdateRU,
					lastDateSize = width - lastDate.length * (fontSizeNormal/2 + 1.5) - 10;

			this._graphText(cr, color, fontSizeTitle, 30, 22, name); // Name text
			this._graphText(cr, color, fontSizeTitle, 30, 44, price); // Price text
			this._graphText(cr, color, fontSizeNormal, 15, 67, max); // Max price text
			this._graphText(cr, color, fontSizeNormal, historySize, 67, history); // Count history days text
			this._graphLine(cr, color, 8, 72, width, 1); // Top line
			this._graphText(cr, color, fontSizeNormal + 1, width - 100, 90, msg_average); // Average price text
			this._graphText(cr, color, fontSizeNormal + 1, width - 100, 108, average); // Average price text
			this._graphText(cr, colorPercent, fontSizeNormal + 3, width - 100, 160, percent); // Percents text
			this._graphText(cr, colorDelta, fontSizeNormal + 1, width - 100, 180, delta); // Delta text
			this._graphLine(cr, color, 8, height - 16, width, 1); // Bottom line
			this._graphText(cr, color, fontSizeNormal, 15, height - 2, min); // Min price text
			this._graphText(cr, color, fontSizeNormal, lastDateSize, height - 2, lastDate); // Last update text
		}
	}

	_graphText(cr, color, FontSize, pxX, pxY, text) {
		cr.setSourceRGBA(color.red / 255, color.green / 255, color.blue / 255, .8);
		cr.setFontSize(FontSize);
		cr.moveTo(pxX, pxY);
		cr.showText(text);
	}

	_graphLine(cr, color, posX, posY, width, height) {
		cr.setSourceRGBA(color.red / 255, color.green / 255, color.blue / 255, .2);
		cr.moveTo(posX, posY);
		cr.setLineWidth(height);
		cr.lineTo(width - posX, posY);
		cr.stroke();
	}



	// Alerts
	_alertOnUpdate() {
		if (this.alertOn) {
			let MaxValue = parseFloat(this.alertAbove.replace(',', '.')) || undefined,
					MinValue = parseFloat(this.alertBelow.replace(',', '.')) || undefined;

			let price = this.cryptoConnect ? this.Crypto['Price'] : this.serverFiat === 'RU' ? this.fiatRU['Price'] : this.fiatEU['Price'];
			let percent = this.cryptoConnect ? this.Crypto['Percent1H'] : this.serverFiat === 'RU' ? this.fiatRU['Percent'] : this.fiatEU['Percent'];

			if (this.alertType === 'money') {
				let formatPrice = this.cryptoConnect || this.serverFiat === 'EU' ? this._getPrice(price, this.Currency) : this._getPrice(price, 'RUB');
				if (MaxValue !== undefined && price >= MaxValue) { this._notifyMessage(formatPrice, 'go-top'); }
				if (MinValue !== undefined && price <= MinValue) { this._notifyMessage(formatPrice, 'go-bottom'); }
			}
			else if (this.alertType === 'percentage') {
				let format = this._getPercent(percent);
				if (MaxValue !== undefined && percent >= MaxValue) { this._notifyMessage(format, 'go-top'); }
				if (MinValue !== undefined && percent <= MinValue) { this._notifyMessage(format, 'go-bottom'); }
			}
		}
	}

	_notifyMessage(message, iconName) {
		let icon = new St.Icon({
			icon_name: iconName,
			icon_type: St.IconType.SYMBOLIC,
		});

		let name = this.cryptoConnect ? `${this.Crypto['Name']} (${this.Crypto['Symbol']})` : this.serverFiat === 'RU' ? this.fiatRU['Name'] : this.fiatEU['Name'];
		let notification = new MessageTray.Notification(this.notificationSource, name, message, {icon});

		notification.setTransient(true);
		this.notificationSource.notify(notification);
	}



	// Labels
	_clear() {
		this.hide_applet_icon();
		this._setName('');
		this._setLabel('', '');
	}

	_setIcon(data, path) {
		if (!this.showIcon) {
			this.hide_applet_icon();
			return;
		}

		let iconFile = Gio.file_new_for_path(APPLET_ROOT + path + data.toLowerCase() + '.png');
		let gicon = new Gio.FileIcon({ file: iconFile });

		if (this._applet_icon_box.child) this._applet_icon_box.child.destroy();
		this._applet_icon = new St.Icon({
			gicon,
			reactive: true,
			track_hover: true,
			style_class: 'applet-icon'
		});
		this._applet_icon.set_icon_size(this.getPanelIconSize(St.IconType.FULLCOLOR));
		this._applet_icon_box.child = this._applet_icon;
	}

	_setName(text) {
		if (!this.showName || text == '' || text == undefined) { // Hide empty labels
			this.labelName.hide();
			return;
		}

		this.labelName.set_text(text + ': ');
		this.labelName.set_style('');
		this.labelName.show();
	}

	_setLabel(text, css_style) {
		if (text == '' || text == undefined) { // Hide empty labels
			this.label.hide();
			return;
		}

		this.label.set_text(text);
		this.label.set_style(css_style);
		this.label.show();
	}

	_setStyle(value) {
		return value > 0 ? 'color: ' + increase_css : value < 0 ? 'color: ' + decrease_css : '';
	}

	_setSign(value) {
		return value > 0 ? increaseSign : value < 0 ? decreaseSign : '';
	}

	_getPrice(price, symbol) {
		price = parseFloat(price);
		if (typeof price != 'number') { return; }

		let options = {
			style: 'currency',
			currency: symbol.toUpperCase()
		};

		if (Math.abs(price) < 1) { options['minimumFractionDigits'] = 3; }
		return price.toLocaleString(undefined, options);
	}

	_getDelta(num, symbol) {
		if (typeof num != 'number') { return; }

		let options = {
			style: 'currency',
			currency: symbol.toUpperCase(),
			minimumFractionDigits: 0,
			maximumFractionDigits: 2
		};

		if (Math.abs(num) < 1) { options['maximumFractionDigits'] = 3; }
		return num = `${parseFloat(num).toLocaleString(undefined, options)}${this._setSign(num)}`;
	}

	_getPercent(num) {
		if (typeof num != 'number') { return; }

		let options = {
			style: 'decimal',
			minimumFractionDigits: 0,
			maximumFractionDigits: 2
		};

		return num = ` ${parseFloat(num).toLocaleString(undefined, options)}%${this._setSign(num)}`;
	}

	_wordEndings(n, titles) {
		n = parseInt(n);
		if (GLib.getenv('LANG').startsWith('ru')) { // if the system language is Russian
			return titles[(n%10 == 1 && n%100 != 11 ? 0 : n%10 >= 2 && n%10 <= 4 && (n%100 < 10 || n%100 >= 20) ? 1 : 2)];
		}
		else { return titles[(n != 1 ? 1 : 0)]; }
	}

	_viewTooltip() {
		if (this.graphOn) { this.set_applet_tooltip(msg_tooltip); }
		else { this.set_applet_tooltip(''); }
	}

	// Add update function in the right click context menu
	_buildContextMenu() {
		let menuitem = new PopupMenu.PopupIconMenuItem(msg_updateMenu, 'view-refresh', St.IconType.SYMBOLIC);
		menuitem.connect('activate', Lang.bind(this, function(event) { this._updateLabel(); }));
		this._applet_context_menu.addMenuItem(menuitem);
		this._applet_context_menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem()); // Separator
	}

	on_applet_removed_from_panel() {
		if (this.TimeoutId) {
			Mainloop.source_remove(this.TimeoutId);
			this.TimeoutId = 0;
		}
		if (this.CoinTimeoutId) {
			Mainloop.source_remove(this.CoinTimeoutId);
			this.CoinTimeoutId = 0;
		}
		if (this.FiatTimeoutId) {
			Mainloop.source_remove(this.FiatTimeoutId);
			this.FiatTimeoutId = 0;
		}
		this.settings.finalize();
	}

}

function main(metadata, orientation, panel_height, instance_id) {
	return new RateCurrencyApplet(metadata, orientation, panel_height, instance_id);
}