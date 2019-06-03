// https://tc39.github.io/ecma262/#sec-array.prototype.includes
if (!Array.prototype.includes) {
  Object.defineProperty(Array.prototype, 'includes', {
    value: function(valueToFind, fromIndex) {

      if (this == null) {
        throw new TypeError('"this" is null or not defined');
      }

      // 1. Let O be ? ToObject(this value).
      var o = Object(this);

      // 2. Let len be ? ToLength(? Get(O, "length")).
      var len = o.length >>> 0;

      // 3. If len is 0, return false.
      if (len === 0) {
        return false;
      }

      // 4. Let n be ? ToInteger(fromIndex).
      //    (If fromIndex is undefined, this step produces the value 0.)
      var n = fromIndex | 0;

      // 5. If n ≥ 0, then
      //  a. Let k be n.
      // 6. Else n < 0,
      //  a. Let k be len + n.
      //  b. If k < 0, let k be 0.
      var k = Math.max(n >= 0 ? n : len - Math.abs(n), 0);

      function sameValueZero(x, y) {
        return x === y || (typeof x === 'number' && typeof y === 'number' && isNaN(x) && isNaN(y));
      }

      // 7. Repeat, while k < len
      while (k < len) {
        // a. Let elementK be the result of ? Get(O, ! ToString(k)).
        // b. If SameValueZero(valueToFind, elementK) is true, return true.
        if (sameValueZero(o[k], valueToFind)) {
          return true;
        }
        // c. Increase k by 1. 
        k++;
      }

      // 8. Return false
      return false;
    }
  });
}var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var DEBUG = false;
var Cairo = imports.cairo;
var Lang = imports.lang;
var Main = imports.ui.main;
var Mainloop = imports.mainloop;
var Gio = imports.gi.Gio;
var Gtk = imports.gi.Gtk;
var Cinnamon = imports.gi.Cinnamon;
var Soup = imports.gi.Soup;
var St = imports.gi.St;
var Applet = imports.ui.applet;
var Config = imports.misc.config;
var PopupMenu = imports.ui.popupMenu;
var Settings = imports.ui.settings;
var Util = imports.misc.util;
var UUID = "weather@mockturtl";
var APPLET_ICON = "view-refresh-symbolic";
var CMD_SETTINGS = "cinnamon-settings applets " + UUID;
var WEATHER_CONV_MPH_IN_MPS = 2.23693629;
var WEATHER_CONV_KPH_IN_MPS = 3.6;
var WEATHER_CONV_KNOTS_IN_MPS = 1.94384449;
var BLANK = '   ';
var ELLIPSIS = '...';
var EN_DASH = '\u2013';
var DATA_SERVICE = {
    OPEN_WEATHER_MAP: "OpenWeatherMap",
    DARK_SKY: "DarkSky",
};
var WEATHER_LOCATION = "location";
var WEATHER_DATA_SERVICE = "dataService";
var WEATHER_API_KEY = "apiKey";
var WEATHER_CITY_KEY = 'locationLabelOverride';
var WEATHER_REFRESH_INTERVAL = 'refreshInterval';
var WEATHER_SHOW_COMMENT_IN_PANEL_KEY = 'showCommentInPanel';
var WEATHER_VERTICAL_ORIENTATION_KEY = 'verticalOrientation';
var WEATHER_SHOW_SUNRISE_KEY = 'showSunrise';
var WEATHER_SHOW_24HOURS_KEY = 'show24Hours';
var WEATHER_FORECAST_DAYS = 'forecastDays';
var WEATHER_SHOW_TEXT_IN_PANEL_KEY = 'showTextInPanel';
var WEATHER_TRANSLATE_CONDITION_KEY = 'translateCondition';
var WEATHER_TEMPERATURE_UNIT_KEY = 'temperatureUnit';
var WEATHER_TEMPERATURE_HIGH_FIRST_KEY = 'temperatureHighFirst';
var WEATHER_PRESSURE_UNIT_KEY = 'pressureUnit';
var WEATHER_USE_SYMBOLIC_ICONS_KEY = 'useSymbolicIcons';
var WEATHER_WIND_SPEED_UNIT_KEY = 'windSpeedUnit';
var WEATHER_SHORT_CONDITIONS_KEY = 'shortConditions';
var WEATHER_MANUAL_LOCATION = "manualLocation";
var KEYS = [,
    WEATHER_DATA_SERVICE,
    WEATHER_API_KEY,
    WEATHER_TEMPERATURE_UNIT_KEY,
    WEATHER_TEMPERATURE_HIGH_FIRST_KEY,
    WEATHER_WIND_SPEED_UNIT_KEY,
    WEATHER_CITY_KEY,
    WEATHER_TRANSLATE_CONDITION_KEY,
    WEATHER_VERTICAL_ORIENTATION_KEY,
    WEATHER_SHOW_TEXT_IN_PANEL_KEY,
    WEATHER_SHOW_COMMENT_IN_PANEL_KEY,
    WEATHER_SHOW_SUNRISE_KEY,
    WEATHER_SHOW_24HOURS_KEY,
    WEATHER_FORECAST_DAYS,
    WEATHER_REFRESH_INTERVAL,
    WEATHER_PRESSURE_UNIT_KEY,
    WEATHER_SHORT_CONDITIONS_KEY,
    WEATHER_MANUAL_LOCATION
];
var SIGNAL_CHANGED = 'changed::';
var SIGNAL_CLICKED = 'clicked';
var SIGNAL_REPAINT = 'repaint';
var STYLE_LOCATION_LINK = 'weather-current-location-link';
var STYLE_SUMMARYBOX = 'weather-current-summarybox';
var STYLE_SUMMARY = 'weather-current-summary';
var STYLE_DATABOX = 'weather-current-databox';
var STYLE_ICON = 'weather-current-icon';
var STYLE_ICONBOX = 'weather-current-iconbox';
var STYLE_DATABOX_CAPTIONS = 'weather-current-databox-captions';
var STYLE_ASTRONOMY = 'weather-current-astronomy';
var STYLE_FORECAST_ICON = 'weather-forecast-icon';
var STYLE_FORECAST_DATABOX = 'weather-forecast-databox';
var STYLE_FORECAST_DAY = 'weather-forecast-day';
var STYLE_CONFIG = 'weather-config';
var STYLE_DATABOX_VALUES = 'weather-current-databox-values';
var STYLE_FORECAST_SUMMARY = 'weather-forecast-summary';
var STYLE_FORECAST_TEMPERATURE = 'weather-forecast-temperature';
var STYLE_FORECAST_BOX = 'weather-forecast-box';
var STYLE_PANEL_BUTTON = 'panel-button';
var STYLE_POPUP_SEPARATOR_MENU_ITEM = 'popup-separator-menu-item';
var STYLE_CURRENT = 'current';
var STYLE_FORECAST = 'forecast';
var STYLE_WEATHER_MENU = 'weather-menu';
var WeatherPressureUnits = {
    HPA: 'hPa',
    MMHG: 'mm Hg',
    INHG: 'in Hg',
    PA: 'Pa',
    PSI: 'psi',
    ATM: 'atm',
    AT: 'at'
};
var Log = (function () {
    function Log(_instanceId) {
        this.debug = false;
        this.ID = _instanceId;
        this.debug = DEBUG;
    }
    Log.prototype.Print = function (message) {
        var msg = UUID + "#" + this.ID + ": " + message.toString();
        var debug = "";
        if (this.debug) {
            debug = this.GetErrorLine();
            global.log(msg, '\n', "On Line:", debug);
        }
        else {
            global.log(msg);
        }
    };
    Log.prototype.Error = function (error) {
        global.logError(UUID + "#" + this.ID + ": " + error.toString(), '\n', "On Line:", this.GetErrorLine());
    };
    ;
    Log.prototype.Debug = function (message) {
        if (this.debug) {
            this.Print(message);
        }
    };
    Log.prototype.GetErrorLine = function () {
        var arr = (new Error).stack.split("\n").slice(-2)[0].split('/').slice(-1)[0];
        return arr;
    };
    return Log;
}());
var GLib = imports.gi.GLib;
var Gettext = imports.gettext;
Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");
function _(str) {
    return Gettext.dgettext(UUID, str);
}
var darkSky;
var openWeatherMap;
//var ipApi = require("./ipApi");
var MyApplet = (function (_super) {
    __extends(MyApplet, _super);
    function MyApplet(metadata, orientation, panelHeight, instanceId) {
        var _this = _super.call(this, orientation, panelHeight, instanceId) || this;
        _this.weather = {
            dateTime: null,
            location: {
                city: null,
                country: null,
                id: null,
                tzOffset: null,
                timeZone: null
            },
            coord: {
                lat: null,
                lon: null,
            },
            sunrise: null,
            sunset: null,
            wind: {
                speed: null,
                degree: null,
            },
            main: {
                temperature: null,
                pressure: null,
                humidity: null,
                temp_min: null,
                temp_max: null,
                feelsLike: null
            },
            condition: {
                id: null,
                main: null,
                description: null,
                icon: null,
            },
            cloudiness: null,
        };
        _this.forecasts = [];
        _this.WeatherUnits = {
            CELSIUS: 'celsius',
            FAHRENHEIT: 'fahrenheit'
        };
        _this.WeatherWindSpeedUnits = {
            KPH: 'kph',
            MPH: 'mph',
            MPS: 'm/s',
            KNOTS: 'Knots'
        };
        _this.errMsg = {
            label: {
                generic: _("Error"),
                service: _("Service Error"),
                noKey: _("No Api key"),
                noLoc: _("No Location"),
            },
            desc: {
                keyBad: _("Wrong API Key"),
                locBad: _("Wrong Location"),
                locNotFound: _("Location Not found"),
                parse: _("Parsing weather information failed :("),
                keyBlock: _("Key Temp. Blocked"),
                cantGetLoc: _("Could not get location"),
                unknown: _("Unknown Error"),
                noResponse: _("No/Bad response from Data Service")
            }
        };
        _this.DarkSkyFilterWords = [_("and"), _("until"), _("in")];
        _this.currentLocale = null;
        _this.systemLanguage = null;
        _this._httpSession = new Soup.SessionAsync();
        _this.locProvider = new IpApi(_this);
        _this.lastUpdated = null;
        _this.currentLocale = GLib.get_language_names()[0];
        _this.systemLanguage = _this.currentLocale.split('_')[0];
        _this.settings = new Settings.AppletSettings(_this, UUID, instanceId);
        _this.log = new Log(instanceId);
        _this._httpSession.user_agent = "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:37.0) Gecko/20100101 Firefox/37.0";
        Soup.Session.prototype.add_feature.call(_this._httpSession, new Soup.ProxyResolverDefault());
        _this.set_applet_icon_name(APPLET_ICON);
        _this.set_applet_label(_("..."));
        _this.set_applet_tooltip(_("Click to open"));
        _this.menuManager = new PopupMenu.PopupMenuManager(_this);
        _this.menu = new Applet.AppletPopupMenu(_this, orientation);
        if (typeof _this.menu.setCustomStyleClass === "function")
            _this.menu.setCustomStyleClass(STYLE_WEATHER_MENU);
        else
            _this.menu.actor.add_style_class_name(STYLE_WEATHER_MENU);
        _this.menuManager.addMenu(_this.menu);
        for (var k in KEYS) {
            var key = KEYS[k];
            var keyProp = "_" + key;
            _this.settings.bindProperty(Settings.BindingDirection.IN, key, keyProp, _this.refreshAndRebuild, null);
        }
        _this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, WEATHER_LOCATION, ("_" + WEATHER_LOCATION), _this.refreshAndRebuild, null);
        _this.settings.bindProperty(Settings.BindingDirection.IN, "keybinding", "keybinding", _this._onKeySettingsUpdated, null);
        Main.keybindingManager.addHotKey(UUID, _this.keybinding, Lang.bind(_this, _this.on_applet_clicked));
        _this.updateIconType();
        _this.settings.connect(SIGNAL_CHANGED + WEATHER_USE_SYMBOLIC_ICONS_KEY, Lang.bind(_this, function () {
            this.updateIconType();
            this._applet_icon.icon_type = this._icon_type;
            this._currentWeatherIcon.icon_type = this._icon_type;
            for (var i = 0; i < this._forecastDays; i++) {
                this._forecast[i].Icon.icon_type = this._icon_type;
            }
            this.refreshWeather();
        }));
        var cinnamonVersion = Config.PACKAGE_VERSION.split('.');
        var majorVersion = parseInt(cinnamonVersion[0]);
        if (majorVersion < 2) {
            var itemLabel = _("Settings");
            var settingsMenuItem = new Applet.MenuItem(itemLabel, Gtk.STOCK_EDIT, Lang.bind(_this, function () {
                Util.spawnCommandLine(CMD_SETTINGS);
            }));
            _this._applet_context_menu.addMenuItem(settingsMenuItem);
        }
        var mainBox = new St.BoxLayout({ vertical: true });
        _this.menu.addActor(mainBox);
        _this._currentWeather = new St.Bin({ style_class: STYLE_CURRENT });
        mainBox.add_actor(_this._currentWeather);
        _this._separatorArea = new St.DrawingArea({ style_class: STYLE_POPUP_SEPARATOR_MENU_ITEM });
        _this._separatorArea.width = 200;
        _this._separatorArea.connect(SIGNAL_REPAINT, Lang.bind(_this, _this._onSeparatorAreaRepaint));
        mainBox.add_actor(_this._separatorArea);
        _this._futureWeather = new St.Bin({ style_class: STYLE_FORECAST });
        mainBox.add_actor(_this._futureWeather);
        _this.rebuild();
        _this.refreshLoop();
        _this.orientation = orientation;
        try {
            _this.setAllowedLayout(Applet.AllowedLayout.BOTH);
            _this.update_label_visible();
        }
        catch (e) {
        }
        return _this;
    }
    MyApplet.prototype.refreshAndRebuild = function () {
        this.refreshWeather();
    };
    ;
    MyApplet.prototype.LoadJsonAsync = function (query) {
        return __awaiter(this, void 0, void 0, function () {
            var json;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4, new Promise(function (resolve, reject) {
                            var message = Soup.Message.new('GET', query);
                            _this._httpSession.queue_message(message, function (session, message) {
                                if (message) {
                                    try {
                                        if (message.status_code != 200) {
                                            reject("http response Code: " + message.status_code + ", reason: " + message.reason_phrase);
                                            return;
                                        }
                                        _this.log.Debug("API full response: " + message.response_body.data.toString());
                                        var payload = JSON.parse(message.response_body.data);
                                        resolve(payload);
                                    }
                                    catch (e) {
                                        _this.log.Error("Error: API response is not JSON. The response: " + message.response_body.data);
                                        reject(null);
                                    }
                                }
                                else {
                                    _this.log.Error("Error: No Response from API");
                                    reject(null);
                                }
                            });
                        })];
                    case 1:
                        json = _a.sent();
                        return [2, json];
                }
            });
        });
    };
    ;
    MyApplet.prototype.locationLookup = function () {
        return __awaiter(this, void 0, void 0, function () {
            var command;
            return __generator(this, function (_a) {
                command = "xdg-open ";
                Util.spawnCommandLine(command + "https://cinnamon-spices.linuxmint.com/applets/view/17");
                return [2];
            });
        });
    };
    MyApplet.prototype.refreshLoop = function () {
        try {
            if (this.lastUpdated == null || new Date(this.lastUpdated.getTime() + this._refreshInterval * 60000) < new Date()) {
                this.refreshWeather();
            }
        }
        catch (e) {
            this.log.Error("Error in Main loop: " + e);
            this.lastUpdated = null;
        }
        Mainloop.timeout_add_seconds(15, Lang.bind(this, function mainloopTimeout() {
            this.refreshLoop();
        }));
    };
    ;
    MyApplet.prototype.update_label_visible = function () {
        if (this.orientation == St.Side.LEFT || this.orientation == St.Side.RIGHT)
            this.hide_applet_label(true);
        else
            this.hide_applet_label(false);
    };
    ;
    MyApplet.prototype.on_orientation_changed = function (orientation) {
        this.orientation = orientation;
        this.refreshWeather();
    };
    ;
    MyApplet.prototype._onKeySettingsUpdated = function () {
        if (this.keybinding != null) {
            Main.keybindingManager.addHotKey(UUID, this.keybinding, Lang.bind(this, this.on_applet_clicked));
        }
    };
    MyApplet.prototype.on_applet_clicked = function (event) {
        this.menu.toggle();
    };
    MyApplet.prototype._onSeparatorAreaRepaint = function (area) {
        var cr = area.get_context();
        var themeNode = area.get_theme_node();
        var _a = area.get_surface_size(), width = _a[0], height = _a[1];
        var margin = themeNode.get_length('-margin-horizontal');
        var gradientHeight = themeNode.get_length('-gradient-height');
        var startColor = themeNode.get_color('-gradient-start');
        var endColor = themeNode.get_color('-gradient-end');
        var gradientWidth = (width - margin * 2);
        var gradientOffset = (height - gradientHeight) / 2;
        var pattern = new Cairo.LinearGradient(margin, gradientOffset, width - margin, gradientOffset + gradientHeight);
        pattern.addColorStopRGBA(0, startColor.red / 255, startColor.green / 255, startColor.blue / 255, startColor.alpha / 255);
        pattern.addColorStopRGBA(0.5, endColor.red / 255, endColor.green / 255, endColor.blue / 255, endColor.alpha / 255);
        pattern.addColorStopRGBA(1, startColor.red / 255, startColor.green / 255, startColor.blue / 255, startColor.alpha / 255);
        cr.setSource(pattern);
        cr.rectangle(margin, gradientOffset, gradientWidth, gradientHeight);
        cr.fill();
    };
    ;
    MyApplet.prototype.updateIconType = function () {
        this._icon_type = this.settings.getValue(WEATHER_USE_SYMBOLIC_ICONS_KEY) ?
            St.IconType.SYMBOLIC :
            St.IconType.FULLCOLOR;
    };
    ;
    MyApplet.prototype.showError = function (title, msg) {
        this.set_applet_label(title);
        this.set_applet_tooltip("Click to open");
        this.set_applet_icon_name("weather-severe-alert");
        this._currentWeatherSunrise.text = msg;
    };
    ;
    MyApplet.prototype.refreshWeather = function () {
        return __awaiter(this, void 0, void 0, function () {
            var haveLocation, loc, refreshResult, _a, _b, e_1;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        this.wipeCurrentData();
                        this.wipeForecastData();
                        _c.label = 1;
                    case 1:
                        _c.trys.push([1, 14, , 15]);
                        if (!!this._manualLocation) return [3, 3];
                        return [4, this.locProvider.GetLocation()];
                    case 2:
                        haveLocation = _c.sent();
                        if (!haveLocation) {
                            this.log.Error("Couldn't obtain location, retry in 15 seconds...");
                            this.showError(this.errMsg.label.noLoc, this.errMsg.desc.cantGetLoc);
                            this.lastUpdated = null;
                            return [2];
                        }
                        return [3, 4];
                    case 3:
                        loc = this._location.replace(" ", "");
                        if (loc == undefined || loc == "") {
                            this.showError(this.errMsg.label.noLoc, "");
                            this.log.Error("No location given when setting is on Manual Location");
                            return [2];
                        }
                        _c.label = 4;
                    case 4:
                        refreshResult = void 0;
                        _a = this._dataService;
                        switch (_a) {
                            case DATA_SERVICE.DARK_SKY: return [3, 5];
                            case DATA_SERVICE.OPEN_WEATHER_MAP: return [3, 7];
                        }
                        return [3, 9];
                    case 5:
                        /*if (darkSky == null) {
                            darkSky = require('./darkSky');
                        }*/
                        this.provider = new DarkSky(this);
                        return [4, this.provider.GetWeather()];
                    case 6:
                        refreshResult = _c.sent();
                        return [3, 10];
                    case 7:
                        /*if (openWeatherMap == null) {
                            openWeatherMap = require('./openWeatherMap');
                        }*/
                        this.provider = new OpenWeatherMap(this);
                        return [4, this.provider.GetWeather()];
                    case 8:
                        refreshResult = _c.sent();
                        return [3, 10];
                    case 9: return [2];
                    case 10:
                        if (!refreshResult) {
                            this.log.Error("Unable to obtain Weather Information");
                            this.lastUpdated = null;
                            return [2];
                        }
                        this.rebuild();
                        return [4, this.displayWeather()];
                    case 11:
                        _b = (_c.sent());
                        if (!_b) return [3, 13];
                        return [4, this.displayForecast()];
                    case 12:
                        _b = (_c.sent());
                        _c.label = 13;
                    case 13:
                        if (_b) {
                            this.log.Print("Weather Information refreshed");
                        }
                        return [3, 15];
                    case 14:
                        e_1 = _c.sent();
                        this.log.Error("Error while refreshing Weather info: " + e_1);
                        this.lastUpdated = null;
                        return [2];
                    case 15:
                        this.lastUpdated = new Date();
                        return [2];
                }
            });
        });
    };
    ;
    MyApplet.prototype.displayWeather = function () {
        try {
            var mainCondition = "";
            var descriptionCondition = "";
            if (this.weather.condition.main != null) {
                mainCondition = this.weather.condition.main;
                if (this._translateCondition) {
                    mainCondition = this.capitalizeFirstLetter(_(mainCondition));
                }
            }
            if (this.weather.condition.description != null) {
                descriptionCondition = this.capitalizeFirstLetter(this.weather.condition.description);
                if (this._translateCondition) {
                    descriptionCondition = _(descriptionCondition);
                }
            }
            var location = "";
            if (this.weather.location.city != null && this.weather.location.country != null) {
                location = this.weather.location.city + ", " + this.weather.location.country;
            }
            else {
                location = Math.round(this.weather.coord.lat * 10000) / 10000 + ", " + Math.round(this.weather.coord.lon * 10000) / 10000;
            }
            if (this.nonempty(this._locationLabelOverride)) {
                location = this._locationLabelOverride;
            }
            this.set_applet_tooltip(location);
            this._currentWeatherSummary.text = descriptionCondition;
            var iconname = this.weather.condition.icon;
            if (iconname == null) {
                iconname = "weather-severe-alert";
            }
            this._currentWeatherIcon.icon_name = iconname;
            this._icon_type == St.IconType.SYMBOLIC ?
                this.set_applet_icon_symbolic_name(iconname) :
                this.set_applet_icon_name(iconname);
            var temp = "";
            if (this.weather.main.temperature != null) {
                temp = this.TempToUserUnits(this.weather.main.temperature).toString();
                this._currentWeatherTemperature.text = temp + ' ' + this.unitToUnicode();
            }
            var label = "";
            if (this._showCommentInPanel) {
                label += mainCondition;
            }
            if (this._showTextInPanel) {
                if (label != "") {
                    label += " ";
                }
                label += (temp + ' ' + this.unitToUnicode());
            }
            this.set_applet_label(label);
            try {
                this.update_label_visible();
            }
            catch (e) {
            }
            if (this.weather.main.humidity != null) {
                this._currentWeatherHumidity.text = Math.round(this.weather.main.humidity) + "%";
            }
            var wind_direction = this.compassDirection(this.weather.wind.degree);
            this._currentWeatherWind.text = ((wind_direction != undefined) ? wind_direction + ' ' : '') + this.MPStoUserUnits(this.weather.wind.speed) + ' ' + this._windSpeedUnit;
            switch (this._dataService) {
                case DATA_SERVICE.OPEN_WEATHER_MAP:
                    if (this.weather.cloudiness != null) {
                        this._currentWeatherApiUnique.text = this.weather.cloudiness + "%";
                        this._currentWeatherApiUniqueCap.text = _("Cloudiness:");
                    }
                    break;
                case DATA_SERVICE.DARK_SKY:
                    if (this.weather.main.feelsLike != null) {
                        this._currentWeatherApiUnique.text = this.TempToUserUnits(this.weather.main.feelsLike) + this.unitToUnicode();
                        this._currentWeatherApiUniqueCap.text = _("Feels like:");
                    }
                    break;
                default:
                    this._currentWeatherApiUnique.text = "";
                    this._currentWeatherApiUniqueCap.text = "";
            }
            if (this.weather.main.pressure != null) {
                this._currentWeatherPressure.text = this.PressToUserUnits(this.weather.main.pressure) + ' ' + _(this._pressureUnit);
            }
            this._currentWeatherLocation.label = location;
            switch (this._dataService) {
                case DATA_SERVICE.OPEN_WEATHER_MAP:
                    this._currentWeatherLocation.url = "https://openweathermap.org/city/" + this.weather.location.id;
                    break;
                case DATA_SERVICE.DARK_SKY:
                    this._currentWeatherLocation.url = "https://darksky.net/forecast/" + this.weather.coord.lat + "," + this.weather.coord.lon;
                    break;
                default:
                    this._currentWeatherLocation.url = null;
            }
            var sunriseText = "";
            var sunsetText = "";
            if (this.weather.sunrise != null && this.weather.sunset != null) {
                if (this._showSunrise) {
                    sunriseText = _('Sunrise');
                    sunsetText = _('Sunset');
                    /*if (this.weather.location.timeZone != null) {
                        var sunrise = this.weather.sunrise.toLocaleString("en-GB", { timeZone: this.weather.location.timeZone, hour: "2-digit", minute: "2-digit" });
                        var sunset = this.weather.sunset.toLocaleString("en-GB", { timeZone: this.weather.location.timeZone, hour: "2-digit", minute: "2-digit" });
                        sunriseText = (sunriseText + ': ' + this.timeToUserUnits(sunrise));
                        sunsetText = (sunsetText + ': ' + this.timeToUserUnits(sunset));
                    }
                    else */{
                        sunriseText = (sunriseText + ': ' + this.timeToUserUnits(this.toLocaleFormat(this.weather.sunrise, '%H:%M')));
                        sunsetText = (sunsetText + ': ' + this.timeToUserUnits(this.toLocaleFormat(this.weather.sunset, '%H:%M')));
                    }
                }
            }
            this._currentWeatherSunrise.text = sunriseText;
            this._currentWeatherSunset.text = sunsetText;
            return true;
        }
        catch (e) {
            this.log.Error("DisplayWeatherError: " + e);
            return false;
        }
    };
    ;
    MyApplet.prototype.displayForecast = function () {
        try {
            for (var i = 0; i < this._forecast.length; i++) {
                var forecastData = this.forecasts[i];
                var forecastUi = this._forecast[i];
                var t_low = this.TempToUserUnits(forecastData.main.temp_min);
                var t_high = this.TempToUserUnits(forecastData.main.temp_max);
                var first_temperature = this._temperatureHighFirst ? t_high : t_low;
                var second_temperature = this._temperatureHighFirst ? t_low : t_high;
                var comment = "";
                if (forecastData.condition.main != null && forecastData.condition.description != null) {
                    if (this._shortConditions) {
                        comment = this.capitalizeFirstLetter(forecastData.condition.main);
                        if (this._translateCondition) {
                            comment = _(this.capitalizeFirstLetter(forecastData.condition.main));
                        }
                    }
                    else {
                        comment = this.capitalizeFirstLetter(forecastData.condition.description);
                        if (this._translateCondition) {
                            comment = _(this.capitalizeFirstLetter(forecastData.condition.description));
                        }
                    }
                }
                var dayName = "";
                /*if (this.weather.location.timeZone != null) {
                    this.log.Debug(forecastData.dateTime.toLocaleString("en-GB", { timeZone: this.weather.location.timeZone }));
                    dayName = _(forecastData.dateTime.toLocaleString("en-GB", { timeZone: this.weather.location.timeZone, weekday: "long" }));
                }
                else */ {
                    forecastData.dateTime.setMilliseconds(forecastData.dateTime.getMilliseconds() + (this.weather.location.tzOffset * 1000));
                    dayName = _(this.getDayName(forecastData.dateTime.getUTCDay()));
                }
                forecastUi.Day.text = dayName;
                forecastUi.Temperature.text = first_temperature + ' ' + '\u002F' + ' ' + second_temperature + ' ' + this.unitToUnicode();
                forecastUi.Summary.text = comment;
                forecastUi.Icon.icon_name = forecastData.condition.icon;
            }
            return true;
        }
        catch (e) {
            this.log.Error("DisplayForecastError" + e);
            return false;
        }
    };
    ;
    MyApplet.prototype.wipeCurrentData = function () {
        this.weather.dateTime = null;
        this.weather.location.city = null;
        this.weather.location.country = null;
        this.weather.location.id = null;
        this.weather.location.timeZone = null;
        this.weather.location.tzOffset = null;
        this.weather.coord.lat = null;
        this.weather.coord.lon = null;
        this.weather.sunrise = null;
        this.weather.sunset = null;
        this.weather.wind.degree = null;
        this.weather.wind.speed = null;
        this.weather.main.temperature = null;
        this.weather.main.pressure = null;
        this.weather.main.humidity = null;
        this.weather.main.temp_max = null;
        this.weather.main.temp_min = null;
        this.weather.condition.id = null;
        this.weather.condition.main = null;
        this.weather.condition.description = null;
        this.weather.condition.icon = null;
        this.weather.cloudiness = null;
    };
    ;
    MyApplet.prototype.wipeForecastData = function () {
        this.forecasts = [];
    };
    ;
    MyApplet.prototype.destroyCurrentWeather = function () {
        if (this._currentWeather.get_child() != null)
            this._currentWeather.get_child().destroy();
    };
    MyApplet.prototype.destroyFutureWeather = function () {
        if (this._futureWeather.get_child() != null)
            this._futureWeather.get_child().destroy();
    };
    MyApplet.prototype.showLoadingUi = function () {
        this.destroyCurrentWeather();
        this.destroyFutureWeather();
        this._currentWeather.set_child(new St.Label({ text: _('Loading current weather ...') }));
        this._futureWeather.set_child(new St.Label({ text: _('Loading future weather ...') }));
    };
    MyApplet.prototype.rebuild = function () {
        this.showLoadingUi();
        this.rebuildCurrentWeatherUi();
        this.rebuildFutureWeatherUi();
    };
    MyApplet.prototype.rebuildCurrentWeatherUi = function () {
        this.destroyCurrentWeather();
        this._currentWeatherIcon = new St.Icon({
            icon_type: this._icon_type,
            icon_size: 64,
            icon_name: APPLET_ICON,
            style_class: STYLE_ICON
        });
        this._currentWeatherSummary = new St.Label({
            text: _('Loading ...'),
            style_class: STYLE_SUMMARY
        });
        this._currentWeatherLocation = new St.Button({
            reactive: true,
            label: _('Refresh'),
        });
        this._currentWeatherLocation.style_class = STYLE_LOCATION_LINK;
        this._currentWeatherLocation.connect(SIGNAL_CLICKED, Lang.bind(this, function () {
            if (this._currentWeatherLocation.url == null) {
                this.refreshWeather();
            }
            else {
                Gio.app_info_launch_default_for_uri(this._currentWeatherLocation.url, global.create_app_launch_context());
            }
        }));
        var bb = new St.BoxLayout({
            vertical: true,
            style_class: STYLE_SUMMARYBOX
        });
        bb.add_actor(this._currentWeatherLocation);
        bb.add_actor(this._currentWeatherSummary);
        var textOb = { text: ELLIPSIS };
        this._currentWeatherSunrise = new St.Label(textOb);
        this._currentWeatherSunset = new St.Label(textOb);
        var ab = new St.BoxLayout({
            style_class: STYLE_ASTRONOMY
        });
        ab.add_actor(this._currentWeatherSunrise);
        var ab_spacerlabel = new St.Label({ text: BLANK });
        ab.add_actor(ab_spacerlabel);
        ab.add_actor(this._currentWeatherSunset);
        var bb_spacerlabel = new St.Label({ text: BLANK });
        bb.add_actor(bb_spacerlabel);
        bb.add_actor(ab);
        this._currentWeatherTemperature = new St.Label(textOb);
        this._currentWeatherHumidity = new St.Label(textOb);
        this._currentWeatherPressure = new St.Label(textOb);
        this._currentWeatherWind = new St.Label(textOb);
        this._currentWeatherApiUnique = new St.Label({ text: '' });
        this._currentWeatherApiUniqueCap = new St.Label({ text: '' });
        var rb = new St.BoxLayout({
            style_class: STYLE_DATABOX
        });
        var rb_captions = new St.BoxLayout({
            vertical: true,
            style_class: STYLE_DATABOX_CAPTIONS
        });
        var rb_values = new St.BoxLayout({
            vertical: true,
            style_class: STYLE_DATABOX_VALUES
        });
        rb.add_actor(rb_captions);
        rb.add_actor(rb_values);
        rb_captions.add_actor(new St.Label({ text: _('Temperature:') }));
        rb_values.add_actor(this._currentWeatherTemperature);
        rb_captions.add_actor(new St.Label({ text: _('Humidity:') }));
        rb_values.add_actor(this._currentWeatherHumidity);
        rb_captions.add_actor(new St.Label({ text: _('Pressure:') }));
        rb_values.add_actor(this._currentWeatherPressure);
        rb_captions.add_actor(new St.Label({ text: _('Wind:') }));
        rb_values.add_actor(this._currentWeatherWind);
        rb_captions.add_actor(this._currentWeatherApiUniqueCap);
        rb_values.add_actor(this._currentWeatherApiUnique);
        var xb = new St.BoxLayout();
        xb.add_actor(bb);
        xb.add_actor(rb);
        var box = new St.BoxLayout({
            style_class: STYLE_ICONBOX
        });
        box.add_actor(this._currentWeatherIcon);
        box.add_actor(xb);
        this._currentWeather.set_child(box);
    };
    ;
    MyApplet.prototype.rebuildFutureWeatherUi = function () {
        this.destroyFutureWeather();
        this._forecast = [];
        this._forecastBox = new St.BoxLayout({ vertical: this._verticalOrientation });
        this._futureWeather.set_child(this._forecastBox);
        for (var i = 0; i < this._forecastDays; i++) {
            var forecastWeather = {
                Icon: new St.Icon,
                Day: new St.Label,
                Summary: new St.Label,
                Temperature: new St.Label,
            };
            forecastWeather.Icon = new St.Icon({
                icon_type: this._icon_type,
                icon_size: 48,
                icon_name: APPLET_ICON,
                style_class: STYLE_FORECAST_ICON
            });
            forecastWeather.Day = new St.Label({
                style_class: STYLE_FORECAST_DAY
            });
            forecastWeather.Summary = new St.Label({
                style_class: STYLE_FORECAST_SUMMARY
            });
            forecastWeather.Temperature = new St.Label({
                style_class: STYLE_FORECAST_TEMPERATURE
            });
            var by = new St.BoxLayout({
                vertical: true,
                style_class: STYLE_FORECAST_DATABOX
            });
            by.add_actor(forecastWeather.Day);
            by.add_actor(forecastWeather.Summary);
            by.add_actor(forecastWeather.Temperature);
            var bb = new St.BoxLayout({
                style_class: STYLE_FORECAST_BOX
            });
            bb.add_actor(forecastWeather.Icon);
            bb.add_actor(by);
            this._forecast[i] = forecastWeather;
            this._forecastBox.add_actor(bb);
        }
    };
    MyApplet.prototype.toLocaleFormat = function (date, format) {
        return Cinnamon.util_format_date(format, date.getTime());
    };
    ;
    MyApplet.prototype.noApiKey = function () {
        if (this._apiKey == undefined || this._apiKey == "") {
            return true;
        }
        return false;
    };
    ;
    MyApplet.prototype.capitalizeFirstLetter = function (description) {
        if ((description == undefined || description == null)) {
            return "";
        }
        return description.charAt(0).toUpperCase() + description.slice(1);
    };
    ;
    MyApplet.prototype.timeToUserUnits = function (timeStr) {
        var time = timeStr.split(':');
        if (time[0].charAt(0) == "0") {
            time[0] = time[0].substr(1);
        }
        if (this._show24Hours) {
            return time[0] + ":" + time[1];
        }
        else {
            if (parseInt(time[0]) > 12) {
                return (parseInt(time[0]) - 12) + ":" + time[1] + " pm";
            }
            else {
                return time[0] + ":" + time[1] + " am";
            }
        }
    };
    MyApplet.prototype.KPHtoMPS = function (speed) {
        return speed / WEATHER_CONV_KPH_IN_MPS;
    };
    ;
    MyApplet.prototype.MPStoUserUnits = function (mps) {
        switch (this._windSpeedUnit) {
            case this.WeatherWindSpeedUnits.MPH:
                return Math.round((mps * WEATHER_CONV_MPH_IN_MPS) * 10) / 10;
            case this.WeatherWindSpeedUnits.KPH:
                return Math.round((mps * WEATHER_CONV_KPH_IN_MPS) * 10) / 10;
            case this.WeatherWindSpeedUnits.MPS:
                return Math.round(mps * 10) / 10;
            case this.WeatherWindSpeedUnits.KNOTS:
                return Math.round(mps * WEATHER_CONV_KNOTS_IN_MPS);
        }
    };
    MyApplet.prototype.TempToUserUnits = function (kelvin) {
        if (this._temperatureUnit == this.WeatherUnits.CELSIUS) {
            return Math.round((kelvin - 273.15));
        }
        if (this._temperatureUnit == this.WeatherUnits.FAHRENHEIT) {
            return Math.round((9 / 5 * (kelvin - 273.15) + 32));
        }
    };
    MyApplet.prototype.CelsiusToKelvin = function (celsius) {
        return (celsius + 273.15);
    };
    MyApplet.prototype.FahrenheitToKelvin = function (fahr) {
        return ((fahr - 32) / 1.8 + 273.15);
    };
    ;
    MyApplet.prototype.MPHtoMPS = function (speed) {
        return speed * 0.44704;
    };
    MyApplet.prototype.PressToUserUnits = function (hpa) {
        switch (this._pressureUnit) {
            case WeatherPressureUnits.HPA:
                return hpa;
            case WeatherPressureUnits.AT:
                return Math.round((hpa * 0.001019716) * 1000) / 1000;
            case WeatherPressureUnits.ATM:
                return Math.round((hpa * 0.0009869233) * 1000) / 1000;
            case WeatherPressureUnits.INHG:
                return Math.round((hpa * 0.029529983071445) * 10) / 10;
            case WeatherPressureUnits.MMHG:
                return Math.round((hpa * 0.7500638));
            case WeatherPressureUnits.PA:
                return Math.round((hpa * 100));
            case WeatherPressureUnits.PSI:
                return Math.round((hpa * 0.01450377) * 100) / 100;
        }
    };
    ;
    MyApplet.prototype.isNumeric = function (n) {
        return !isNaN(parseFloat(n)) && isFinite(n);
    };
    MyApplet.prototype.isString = function (text) {
        if (typeof text == 'string' || text instanceof String) {
            return true;
        }
        return false;
    };
    MyApplet.prototype.isID = function (text) {
        if (text.length == 7 && this.isNumeric(text)) {
            return true;
        }
        return false;
    };
    ;
    MyApplet.prototype.isCoordinate = function (text) {
        if (/^-?\d{1,3}(?:\.\d*)?,-?\d{1,3}(?:\.\d*)?/.test(text)) {
            return true;
        }
        return false;
    };
    MyApplet.prototype.unitToUnicode = function () {
        return this._temperatureUnit == this.WeatherUnits.FAHRENHEIT ? '\u2109' : '\u2103';
    };
    MyApplet.prototype.weatherIconSafely = function (code, iconResolver) {
        var iconname = iconResolver(code);
        for (var i = 0; i < iconname.length; i++) {
            if (this.hasIcon(iconname[i]))
                return iconname[i];
        }
        return 'weather-severe-alert';
    };
    MyApplet.prototype.hasIcon = function (icon) {
        return Gtk.IconTheme.get_default().has_icon(icon + (this._icon_type == St.IconType.SYMBOLIC ? '-symbolic' : ''));
    };
    MyApplet.prototype.nonempty = function (str) {
        return (str != null && str.length > 0);
    };
    MyApplet.prototype.getDayName = function (dayNum) {
        var days = [_('Sunday'), _('Monday'), _('Tuesday'), _('Wednesday'), _('Thursday'), _('Friday'), _('Saturday')];
        return days[dayNum];
    };
    MyApplet.prototype.compassDirection = function (deg) {
        var directions = [_('N'), _('NE'), _('E'), _('SE'), _('S'), _('SW'), _('W'), _('NW')];
        return directions[Math.round(deg / 45) % directions.length];
    };
    MyApplet.prototype.isLangSupported = function (lang, languages) {
        if (languages.indexOf(lang) != -1) {
            return true;
        }
        return false;
    };
    ;
    return MyApplet;
}(Applet.TextIconApplet));
var openWeatherMapConditionLibrary = [
    _("Thunderstorm with light rain"),
    _("Thunderstorm with rain"),
    _("Thunderstorm with heavy rain"),
    _("Light thunderstorm"),
    _("Thunderstorm"),
    _("Heavy thunderstorm"),
    _("Ragged thunderstorm"),
    _("Thunderstorm with light drizzle"),
    _("Thunderstorm with drizzle"),
    _("Thunderstorm with heavy drizzle"),
    _("Light intensity drizzle"),
    _("Drizzle"),
    _("Heavy intensity drizzle"),
    _("Light intensity drizzle rain"),
    _("Drizzle rain"),
    _("Heavy intensity drizzle rain"),
    _("Shower rain and drizzle"),
    _("Heavy shower rain and drizzle"),
    _("Shower drizzle"),
    _("Light rain"),
    _("Moderate rain"),
    _("Heavy intensity rain"),
    _("Very heavy rain"),
    _("Extreme rain"),
    _("Freezing rain"),
    _("Light intensity shower rain"),
    _("Shower rain"),
    _("Heavy intensity shower rain"),
    _("Ragged shower rain"),
    _("Light snow"),
    _("Snow"),
    _("Heavy snow"),
    _("Sleet"),
    _("Shower sleet"),
    _("Light rain and snow"),
    _("Rain and snow"),
    _("Light shower snow"),
    _("Shower snow"),
    _("Heavy shower snow"),
    _("Mist"),
    _("Smoke"),
    _("Haze"),
    _("Sand, dust whirls"),
    _("Fog"),
    _("Sand"),
    _("Dust"),
    _("Volcanic ash"),
    _("Squalls"),
    _("Tornado"),
    _("Clear"),
    _("Clear sky"),
    _("Sky is clear"),
    _("Few clouds"),
    _("Scattered clouds"),
    _("Broken clouds"),
    _("Overcast clouds")
];
var icons = {
    clear_day: 'weather-clear',
    clear_night: 'weather-clear-night',
    few_clouds_day: 'weather-few-clouds',
    few_clouds_night: 'weather-few-clouds-night',
    clouds: 'weather-clouds',
    overcast: 'weather_overcast',
    showers_scattered: 'weather-showers-scattered',
    showers: 'weather-showers',
    rain: 'weather-rain',
    rain_freezing: 'weather-freezing-rain',
    snow: 'weather-snow',
    storm: 'weather-storm',
    fog: 'weather-fog',
    alert: 'weather-severe-alert'
};
var IpApi = (function () {
    function IpApi(_app) {
        this.query = "https://ipapi.co/json";
        this.app = _app;
    }
    IpApi.prototype.GetLocation = function () {
        return __awaiter(this, void 0, void 0, function () {
            var json, e_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4, this.app.LoadJsonAsync(this.query)];
                    case 1:
                        json = _a.sent();
                        if (json == null) {
                            this.app.showError(this.app.errMsg.label.service, this.app.errMsg.desc.noResponse);
                            return [2, false];
                        }
                        return [3, 3];
                    case 2:
                        e_1 = _a.sent();
                        this.app.log.Error("IpApi service error: " + e_1);
                        this.app.showError(this.app.errMsg.label.generic, this.app.errMsg.desc.cantGetLoc);
                        return [2, false];
                    case 3:
                        if (json.error) {
                            this.HandleErrorResponse(json);
                            return [2, false];
                        }
                        return [2, this.ParseInformation(json)];
                }
            });
        });
    };
    ;
    IpApi.prototype.ParseInformation = function (json) {
        try {
            var loc = json.latitude + "," + json.longitude;
            this.app.settings.setValue('location', loc);
            this.app.weather.location.timeZone = json.timezone;
            this.app.weather.location.city = json.city;
            this.app.weather.location.country = json.country;
            this.app.log.Print("Location obtained");
            this.app.log.Debug("Location:" + json.latitude + "," + json.longitude);
            this.app.log.Debug("Location setting is now: " + this.app._location);
            return true;
        }
        catch (e) {
            this.app.log.Error("IPapi parsing error: " + e);
            this.app.showError(this.app.errMsg.label.generic, this.app.errMsg.desc.cantGetLoc);
            return false;
        }
    };
    ;
    IpApi.prototype.HandleErrorResponse = function (json) {
        this.app.log.Error("IpApi error response: " + json.reason);
    };
    ;
    return IpApi;
}());
;
var DarkSky = (function () {
    function DarkSky(_app) {
        this.descriptionLinelength = 25;
        this.supportedLanguages = [
            'ar', 'az', 'be', 'bg', 'bs', 'ca', 'cs', 'da', 'de', 'el', 'en', 'es',
            'et', 'fi', 'fr', 'he', 'hr', 'hu', 'id', 'is', 'it', 'ja', 'ka', 'ko',
            'kw', 'lv', 'nb', 'nl', 'no', 'pl', 'pt', 'ro', 'ru', 'sk', 'sl', 'sr',
            'sv', 'tet', 'tr', 'uk', 'x-pig-latin', 'zh', 'zh-tw'
        ];
        this.query = "https://api.darksky.net/forecast/";
        this.unit = null;
        this.app = _app;
    }
    DarkSky.prototype.GetWeather = function () {
        return __awaiter(this, void 0, void 0, function () {
            var query, json, e_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        query = this.ConstructQuery();
                        if (!(query != "" && query != null)) return [3, 5];
                        this.app.log.Debug("DarkSky API query: " + query);
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4, this.app.LoadJsonAsync(query)];
                    case 2:
                        json = _a.sent();
                        if (json == null) {
                            this.app.showError(this.app.errMsg.label.service, this.app.errMsg.desc.noResponse);
                            return [2, false];
                        }
                        return [3, 4];
                    case 3:
                        e_1 = _a.sent();
                        this.app.log.Error("DarkSky: API call failed: " + e_1);
                        this.app.showError(this.app.errMsg.label.service, this.app.errMsg.desc.noResponse);
                        return [2, false];
                    case 4:
                        if (!json.code) {
                            return [2, this.ParseWeather(json)];
                        }
                        else {
                            this.HandleResponseErrors(json);
                            return [2, false];
                        }
                        _a.label = 5;
                    case 5:
                        this.app.log.Error("DarkSky: Could not construct query, insufficent information");
                        this.app.showError(this.app.errMsg.label.service, this.app.errMsg.desc.locBad);
                        return [2, false];
                }
            });
        });
    };
    ;
    DarkSky.prototype.ParseWeather = function (json) {
        try {
            this.app.weather.dateTime = new Date(json.currently.time * 1000);
            this.app.weather.location.timeZone = json.timezone;
            this.app.weather.coord.lat = json.latitude;
            this.app.weather.coord.lon = json.longitude;
            this.app.weather.sunrise = new Date(json.daily.data[0].sunriseTime * 1000);
            this.app.weather.sunset = new Date(json.daily.data[0].sunsetTime * 1000);
            this.app.weather.wind.speed = this.ToMPS(json.currently.windSpeed);
            this.app.weather.wind.degree = json.currently.windBearing;
            this.app.weather.main.temperature = this.ToKelvin(json.currently.temperature);
            this.app.weather.main.pressure = json.currently.pressure;
            this.app.weather.main.humidity = json.currently.humidity * 100;
            this.app.weather.condition.main = this.GetShortCurrentSummary(json.currently.summary);
            this.app.weather.condition.description = json.currently.summary;
            this.app.weather.condition.icon = this.app.weatherIconSafely(json.currently.icon, this.ResolveIcon);
            this.app.weather.cloudiness = json.currently.cloudCover * 100;
            this.app.weather.main.feelsLike = this.ToKelvin(json.currently.apparentTemperature);
            for (var i = 0; i < this.app._forecastDays; i++) {
                var forecast = {
                    dateTime: null,
                    main: {
                        temp: null,
                        temp_min: null,
                        temp_max: null,
                        pressure: null,
                        sea_level: null,
                        grnd_level: null,
                        humidity: null,
                    },
                    condition: {
                        id: null,
                        main: null,
                        description: null,
                        icon: null,
                    },
                    clouds: null,
                    wind: {
                        speed: null,
                        deg: null,
                    }
                };
                var day = json.daily.data[i];
                forecast.dateTime = new Date(day.time * 1000);
                forecast.main.temp_min = this.ToKelvin(day.temperatureLow);
                forecast.main.temp_max = this.ToKelvin(day.temperatureHigh);
                forecast.condition.main = this.GetShortSummary(day.summary);
                forecast.condition.description = this.ProcessSummary(day.summary);
                forecast.condition.icon = this.app.weatherIconSafely(day.icon, this.ResolveIcon);
                forecast.main.pressure = day.pressure;
                forecast.main.humidity = day.humidity * 100;
                this.app.forecasts.push(forecast);
            }
        }
        catch (e) {
            this.app.log.Error("DarkSky payload parsing error: " + e);
            this.app.showError(this.app.errMsg.label.generic, this.app.errMsg.desc.parse);
            return false;
        }
        return true;
    };
    ;
    DarkSky.prototype.ConstructQuery = function () {
        this.SetQueryUnit();
        var query;
        var key = this.app._apiKey.replace(" ", "");
        var location = this.app._location.replace(" ", "");
        if (this.app.noApiKey()) {
            this.app.showError(this.app.errMsg.label.noKey, "");
            return "";
        }
        if (this.app.isCoordinate(location)) {
            query = this.query + key + "/" + location +
                "?exclude=minutely,hourly,flags" + "&units=" + this.unit;
            if (this.app.isLangSupported(this.app.systemLanguage, this.supportedLanguages) && this.app._translateCondition) {
                query = query + "&lang=" + this.app.systemLanguage;
            }
            return query;
        }
        else {
            return "";
        }
    };
    ;
    DarkSky.prototype.HandleResponseErrors = function (json) {
        var code = json.code;
        var error = json.error;
        var errorMsg = "DarkSky API: ";
        this.app.log.Debug("DarksSky API error payload: " + json);
        switch (code) {
            case "400":
                this.app.log.Error(errorMsg + error);
                break;
            default:
                this.app.log.Error(errorMsg + error);
                break;
        }
    };
    ;
    DarkSky.prototype.ProcessSummary = function (summary) {
        var processed = summary.split(" ");
        var result = "";
        var linelength = 0;
        for (var i = 0; i < processed.length; i++) {
            if (linelength + processed[i].length > this.descriptionLinelength) {
                result = result + "\n";
                linelength = 0;
            }
            result = result + processed[i] + " ";
            linelength = linelength + processed[i].length + 1;
        }
        return result;
    };
    ;
    DarkSky.prototype.GetShortSummary = function (summary) {
        var processed = summary.split(" ");
        var result = "";
        for (var i = 0; i < 2; i++) {
            if (!/[\(\)]/.test(processed[i]) && !(this.app.DarkSkyFilterWords.includes(processed[i]))) {
                result = result + processed[i] + " ";
            }
        }
        return result;
    };
    ;
    DarkSky.prototype.GetShortCurrentSummary = function (summary) {
        var processed = summary.split(" ");
        var result = "";
        var maxLoop;
        (processed.length < 2) ? maxLoop = processed.length : maxLoop = 2;
        for (var i = 0; i < maxLoop; i++) {
            if (processed[i] != "and") {
                result = result + processed[i] + " ";
            }
        }
        return result;
    };
    DarkSky.prototype.ResolveIcon = function (icon) {
        switch (icon) {
            case "rain":
                return ['weather-rain', 'weather-showers-scattered', 'weather-freezing-rain'];
            case "snow":
                return ['weather-snow'];
            case "fog":
                return ['weather-fog'];
            case "cloudy":
                return ['weather-overcast', 'weather-clouds', , 'weather-few-clouds'];
            case "partly-cloudy-night":
                return ['weather-few-clouds-night', "weather-few-clouds"];
            case "partly-cloudy-day":
                return ['weather-few-clouds'];
            case "clear-night":
                return ['weather-clear-night'];
            case "clear-day":
                return ['weather-clear'];
            case "storm":
                return ['weather-storm'];
            case "showers":
                return ['weather-showers'];
            case "wind":
                return ["weather-wind", "wind", "weather-breeze", 'weather-clouds', 'weather-few-clouds'];
            default:
                return ['weather-severe-alert'];
        }
    };
    ;
    DarkSky.prototype.SetQueryUnit = function () {
        if (this.app._temperatureUnit == this.app.WeatherUnits.CELSIUS) {
            if (this.app._windSpeedUnit == this.app.WeatherWindSpeedUnits.KPH || this.app._windSpeedUnit == this.app.WeatherWindSpeedUnits.MPS) {
                this.unit = 'si';
            }
            else {
                this.unit = 'uk2';
            }
        }
        else {
            this.unit = 'us';
        }
    };
    ;
    DarkSky.prototype.ToKelvin = function (temp) {
        if (this.unit == 'us') {
            return this.app.FahrenheitToKelvin(temp);
        }
        else {
            return this.app.CelsiusToKelvin(temp);
        }
    };
    ;
    DarkSky.prototype.ToMPS = function (speed) {
        if (this.unit == 'si') {
            return speed;
        }
        else {
            return this.app.MPHtoMPS(speed);
        }
    };
    ;
    return DarkSky;
}());
;
var OpenWeatherMap = (function () {
    function OpenWeatherMap(_app) {
        this.supportedLanguages = ["ar", "bg", "ca", "cz", "de", "el", "en", "fa", "fi",
            "fr", "gl", "hr", "hu", "it", "ja", "kr", "la", "lt", "mk", "nl", "pl",
            "pt", "ro", "ru", "se", "sk", "sl", "es", "tr", "ua", "vi", "zh_cn", "zh_tw"];
        this.current_url = "https://api.openweathermap.org/data/2.5/weather?";
        this.daily_url = "https://api.openweathermap.org/data/2.5/forecast/daily?";
        this.app = _app;
    }
    OpenWeatherMap.prototype.GetWeather = function () {
        return __awaiter(this, void 0, void 0, function () {
            var currentResult, forecastResult;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4, this.GetData(this.current_url, this.ParseCurrent)];
                    case 1:
                        currentResult = _a.sent();
                        return [4, this.GetData(this.daily_url, this.ParseForecast)];
                    case 2:
                        forecastResult = _a.sent();
                        if (currentResult && forecastResult) {
                            return [2, true];
                        }
                        else {
                            this.app.log.Error("OpenWeatherMap: Could not get Weather information");
                            return [2, false];
                        }
                        return [2];
                }
            });
        });
    };
    ;
    OpenWeatherMap.prototype.GetData = function (baseUrl, ParseFunction) {
        return __awaiter(this, void 0, void 0, function () {
            var query, json, e_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        query = this.ConstructQuery(baseUrl);
                        if (!(query != null)) return [3, 5];
                        this.app.log.Debug("Query: " + query);
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4, this.app.LoadJsonAsync(query)];
                    case 2:
                        json = _a.sent();
                        if (json == null) {
                            this.app.showError(this.app.errMsg.label.service, this.app.errMsg.desc.noResponse);
                            return [2, false];
                        }
                        return [3, 4];
                    case 3:
                        e_1 = _a.sent();
                        this.app.log.Error("Unable to call API:" + e_1);
                        return [2, false];
                    case 4:
                        if (json.cod == 200) {
                            return [2, ParseFunction(json, this)];
                        }
                        else {
                            this.HandleResponseErrors(json);
                            return [2, false];
                        }
                        return [3, 6];
                    case 5: return [2, false];
                    case 6: return [2];
                }
            });
        });
    };
    ;
    OpenWeatherMap.prototype.ParseCurrent = function (json, self) {
        try {
            if (json.coord) {
                self.app.weather.coord.lat = json.coord.lat;
                self.app.weather.coord.lon = json.coord.lon;
            }
            self.app.weather.location.city = json.name;
            self.app.weather.location.country = json.sys.country;
            self.app.weather.location.id = json.id;
            self.app.weather.dateTime = new Date((json.dt) * 1000);
            self.app.weather.sunrise = new Date((json.sys.sunrise) * 1000);
            self.app.weather.sunset = new Date((json.sys.sunset) * 1000);
            if (json.wind) {
                self.app.weather.wind.speed = json.wind.speed;
                self.app.weather.wind.degree = json.wind.deg;
            }
            if (json.main) {
                self.app.weather.main.temperature = json.main.temp;
                self.app.weather.main.pressure = json.main.pressure;
                self.app.weather.main.humidity = json.main.humidity;
                self.app.weather.main.temp_min = json.main.temp_min;
                self.app.weather.main.temp_max = json.main.temp_max;
            }
            if (json.weather[0]) {
                self.app.weather.condition.main = json.weather[0].main;
                self.app.weather.condition.description = json.weather[0].description;
                self.app.weather.condition.icon = self.app.weatherIconSafely(json.weather[0].icon, self.ResolveIcon);
            }
            if (json.clouds) {
                self.app.weather.cloudiness = json.clouds.all;
            }
            return true;
        }
        catch (e) {
            self.app.log.Error("OpenWeathermap Weather Parsing error: " + e);
            self.app.showError(self.app.errMsg.label.generic, self.app.errMsg.desc.parse);
            return false;
        }
    };
    ;
    OpenWeatherMap.prototype.ParseForecast = function (json, self) {
        try {
            for (var i = 0; i < self.app._forecastDays; i++) {
                var forecast = {
                    dateTime: null,
                    main: {
                        temp: null,
                        temp_min: null,
                        temp_max: null,
                        pressure: null,
                        sea_level: null,
                        grnd_level: null,
                        humidity: null,
                    },
                    condition: {
                        id: null,
                        main: null,
                        description: null,
                        icon: null,
                    },
                    clouds: null,
                    wind: {
                        speed: null,
                        deg: null,
                    }
                };
                var day = json.list[i];
                forecast.dateTime = new Date(day.dt * 1000);
                forecast.main.temp_min = day.temp.min;
                forecast.main.temp_max = day.temp.max;
                forecast.main.pressure = day.pressure;
                forecast.main.humidity = day.humidity;
                forecast.clouds = day.clouds;
                if (day.weather[0].id) {
                    forecast.condition.main = day.weather[0].main;
                    forecast.condition.description = day.weather[0].description;
                    forecast.condition.icon = self.app.weatherIconSafely(day.weather[0].icon, self.ResolveIcon);
                }
                self.app.forecasts.push(forecast);
            }
            return true;
        }
        catch (e) {
            self.app.log.Error("OpenWeathermap Forecast Parsing error: " + e);
            self.app.showError(self.app.errMsg.label.generic, self.app.errMsg.desc.parse);
            return false;
        }
    };
    ;
    OpenWeatherMap.prototype.ConstructQuery = function (baseUrl) {
        var query = baseUrl;
        var locString = this.ParseLocation();
        if (locString != null) {
            query = query + locString + "&APPID=";
            query += "1c73f8259a86c6fd43c7163b543c8640";
            if (this.app._translateCondition && this.app.isLangSupported(this.app.systemLanguage, this.supportedLanguages)) {
                query = query + "&lang=" + this.app.systemLanguage;
            }
            return query;
        }
        this.app.showError(this.app.errMsg.label.noLoc, "");
        this.app.log.Error("OpenWeatherMap: No Location was provided");
        return null;
    };
    ;
    OpenWeatherMap.prototype.ParseLocation = function () {
        var loc = this.app._location.replace(/ /g, "");
        if (this.app.isCoordinate(loc)) {
            var locArr = loc.split(',');
            return "lat=" + locArr[0] + "&lon=" + locArr[1];
        }
        else if (this.app.isID(loc)) {
            return "id=" + loc;
        }
        else
            return "q=" + loc;
    };
    ;
    OpenWeatherMap.prototype.HandleResponseErrors = function (json) {
        var errorMsg = "OpenWeather API: ";
        switch (json.cod) {
            case ("400"):
                this.app.showError(this.app.errMsg.label.service, this.app.errMsg.desc.locBad);
                break;
            case ("401"):
                this.app.showError(this.app.errMsg.label.service, this.app.errMsg.desc.keyBad);
                break;
            case ("404"):
                this.app.showError(this.app.errMsg.label.service, this.app.errMsg.desc.locNotFound);
                break;
            case ("429"):
                this.app.showError(this.app.errMsg.label.service, this.app.errMsg.desc.keyBlock);
                break;
            default:
                this.app.showError(this.app.errMsg.label.service, this.app.errMsg.desc.unknown);
                break;
        }
        ;
        this.app.log.Debug("OpenWeatherMap Error Code: " + json.cod);
        this.app.log.Error(errorMsg + json.message);
    };
    ;
    OpenWeatherMap.prototype.ResolveIcon = function (icon) {
        switch (icon) {
            case "10d":
                return ['weather-rain', 'weather-showers-scattered', 'weather-freezing-rain'];
            case "10n":
                return ['weather-rain', 'weather-showers-scattered', 'weather-freezing-rain'];
            case "09n":
                return ['weather-showers'];
            case "09d":
                return ['weather-showers'];
            case "13d":
                return ['weather-snow'];
            case "13n":
                return ['weather-snow'];
            case "50d":
                return ['weather-fog'];
            case "50n":
                return ['weather-fog'];
            case "04d":
                return ['weather_overcast', 'weather-clouds', "weather-few-clouds"];
            case "04n":
                return ['weather_overcast', 'weather-clouds', "weather-few-clouds-night"];
            case "03n":
                return ['weather-clouds-night', 'weather-few-clouds-night'];
            case "03d":
                return ['weather-clouds', 'weather-overcast', 'weather-few-clouds'];
            case "02n":
                return ['weather-few-clouds-night'];
            case "02d":
                return ['weather-few-clouds'];
            case "01n":
                return ['weather-clear-night'];
            case "01d":
                return ['weather-clear'];
            case "11d":
                return ['weather-storm'];
            case "11n":
                return ['weather-storm'];
            default:
                return ['weather-severe-alert'];
        }
    };
    ;
    return OpenWeatherMap;
}());
;
function main(metadata, orientation, panelHeight, instanceId) {
    return new MyApplet(metadata, orientation, panelHeight, instanceId);
}
