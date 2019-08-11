var __extends = (this && this.__extends) || (function () {
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
function importModule(path) {
    if (typeof require !== 'undefined') {
        return require('./' + path);
    }
    else {
        var AppletDir = imports.ui.appletManager.applets['weather@mockturtl'];
        return AppletDir[path];
    }
}
var Cairo = imports.cairo;
var Lang = imports.lang;
var Main = imports.ui.main;
var Mainloop = imports.mainloop;
var Gio = imports.gi.Gio;
var Gtk = imports.gi.Gtk;
var Soup = imports.gi.Soup;
var St = imports.gi.St;
var Applet = imports.ui.applet;
var Config = imports.misc.config;
var PopupMenu = imports.ui.popupMenu;
var Settings = imports.ui.settings;
var Util = imports.misc.util;
var utils = importModule("utils");
var GetDayName = utils.GetDayName;
var GetHoursMinutes = utils.GetHoursMinutes;
var capitalizeFirstLetter = utils.capitalizeFirstLetter;
var TempToUserUnits = utils.TempToUserUnits;
var PressToUserUnits = utils.PressToUserUnits;
var compassDirection = utils.compassDirection;
var MPStoUserUnits = utils.MPStoUserUnits;
var nonempty = utils.nonempty;
if (typeof Promise != "function") {
    var promisePoly = importModule("promise-polyfill");
    var finallyConstructor = promisePoly.finallyConstructor;
    var setTimeout = promisePoly.setTimeout;
    var setTimeoutFunc = promisePoly.setTimeoutFunc;
    var isArray = promisePoly.isArray;
    var noop = promisePoly.noop;
    var bind = promisePoly.bind;
    var Promise = promisePoly.Promise;
    var handle = promisePoly.handle;
    var resolve = promisePoly.resolve;
    var reject = promisePoly.reject;
    var finale = promisePoly.finale;
    var Handler = promisePoly.Handler;
    var doResolve = promisePoly.doResolve;
    Promise.prototype['catch'] = promisePoly.Promise.prototype['catch'];
    Promise.prototype.then = promisePoly.Promise.prototype.then;
    Promise.all = promisePoly.Promise.all;
    Promise.resolve = promisePoly.Promise.resolve;
    Promise.reject = promisePoly.Promise.reject;
    Promise.race = promisePoly.Promise.race;
    var globalNS = promisePoly.globalNS;
    if (!('Promise' in globalNS)) {
        globalNS['Promise'] = Promise;
    }
    else if (!globalNS.Promise.prototype['finally']) {
        globalNS.Promise.prototype['finally'] = finallyConstructor;
    }
}
var GLib = imports.gi.GLib;
var Gettext = imports.gettext;
var ipApi = importModule('ipApi');
var UUID = "weather@mockturtl";
var APPLET_ICON = "view-refresh-symbolic";
var REFRESH_ICON = "view-refresh";
var CMD_SETTINGS = "cinnamon-settings applets " + UUID;
var BLANK = '   ';
var ELLIPSIS = '...';
var EN_DASH = '\u2013';
var DATA_SERVICE = {
    OPEN_WEATHER_MAP: "OpenWeatherMap",
    DARK_SKY: "DarkSky",
};
var WEATHER_LOCATION = "location";
var WEATHER_USE_SYMBOLIC_ICONS_KEY = 'useSymbolicIcons';
var KEYS;
(function (KEYS) {
    KEYS["WEATHER_DATA_SERVICE"] = "dataService";
    KEYS["WEATHER_API_KEY"] = "apiKey";
    KEYS["WEATHER_TEMPERATURE_UNIT_KEY"] = "temperatureUnit";
    KEYS["WEATHER_TEMPERATURE_HIGH_FIRST_KEY"] = "temperatureHighFirst";
    KEYS["WEATHER_WIND_SPEED_UNIT_KEY"] = "windSpeedUnit";
    KEYS["WEATHER_CITY_KEY"] = "locationLabelOverride";
    KEYS["WEATHER_TRANSLATE_CONDITION_KEY"] = "translateCondition";
    KEYS["WEATHER_VERTICAL_ORIENTATION_KEY"] = "verticalOrientation";
    KEYS["WEATHER_SHOW_TEXT_IN_PANEL_KEY"] = "showTextInPanel";
    KEYS["WEATHER_SHOW_COMMENT_IN_PANEL_KEY"] = "showCommentInPanel";
    KEYS["WEATHER_SHOW_SUNRISE_KEY"] = "showSunrise";
    KEYS["WEATHER_SHOW_24HOURS_KEY"] = "show24Hours";
    KEYS["WEATHER_FORECAST_DAYS"] = "forecastDays";
    KEYS["WEATHER_REFRESH_INTERVAL"] = "refreshInterval";
    KEYS["WEATHER_PRESSURE_UNIT_KEY"] = "pressureUnit";
    KEYS["WEATHER_SHORT_CONDITIONS_KEY"] = "shortConditions";
    KEYS["WEATHER_MANUAL_LOCATION"] = "manualLocation";
})(KEYS || (KEYS = {}));
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
var STYLE_FORECAST_CONTAINER = 'weather-forecast-container';
var STYLE_PANEL_BUTTON = 'panel-button';
var STYLE_POPUP_SEPARATOR_MENU_ITEM = 'popup-separator-menu-item';
var STYLE_CURRENT = 'current';
var STYLE_FORECAST = 'forecast';
var STYLE_WEATHER_MENU = 'weather-menu';
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
Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");
function _(str) {
    return Gettext.dgettext(UUID, str);
}
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
        _this.locProvider = new ipApi.IpApi(_this);
        _this.lastUpdated = null;
        _this.currentLocale = _this.constructJsLocale(GLib.get_language_names()[0]);
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
        var itemLabel = _("Refresh");
        var refreshMenuItem = new Applet.MenuItem(itemLabel, REFRESH_ICON, Lang.bind(_this, function () {
            this.refreshWeather();
        }));
        _this._applet_context_menu.addMenuItem(refreshMenuItem);
        var mainBox = new St.BoxLayout({
            vertical: true
        });
        _this.menu.addActor(mainBox);
        _this._currentWeather = new St.Bin({
            style_class: STYLE_CURRENT
        });
        mainBox.add_actor(_this._currentWeather);
        _this._separatorArea = new St.DrawingArea({
            style_class: STYLE_POPUP_SEPARATOR_MENU_ITEM
        });
        _this._separatorArea.width = 200;
        _this._separatorArea.connect(SIGNAL_REPAINT, Lang.bind(_this, _this._onSeparatorAreaRepaint));
        mainBox.add_actor(_this._separatorArea);
        _this._futureWeather = new St.Bin({
            style_class: STYLE_FORECAST
        });
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
                                        reject(e);
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
    MyApplet.prototype.constructJsLocale = function (locale) {
        var jsLocale = locale.split(".")[0];
        var tmp = jsLocale.split("_");
        jsLocale = "";
        for (var i = 0; i < tmp.length; i++) {
            if (i != 0)
                jsLocale += "-";
            jsLocale += tmp[i];
        }
        return jsLocale;
    };
    MyApplet.prototype.refreshWeather = function () {
        return __awaiter(this, void 0, void 0, function () {
            var haveLocation, loc, darkSky, openWeatherMap, _a, e_1;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        this.wipeCurrentData();
                        this.wipeForecastData();
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 9, , 10]);
                        if (!!this._manualLocation) return [3, 3];
                        return [4, this.locProvider.GetLocation()];
                    case 2:
                        haveLocation = _b.sent();
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
                        _b.label = 4;
                    case 4:
                        switch (this._dataService) {
                            case DATA_SERVICE.DARK_SKY:
                                if (darkSky == null)
                                    darkSky = importModule('darkSky');
                                this.provider = new darkSky.DarkSky(this);
                                break;
                            case DATA_SERVICE.OPEN_WEATHER_MAP:
                                if (openWeatherMap == null)
                                    openWeatherMap = importModule("openWeatherMap");
                                this.provider = new openWeatherMap.OpenWeatherMap(this);
                                break;
                            default:
                                return [2];
                        }
                        return [4, this.provider.GetWeather()];
                    case 5:
                        if (!(_b.sent())) {
                            this.log.Error("Unable to obtain Weather Information");
                            this.lastUpdated = null;
                            return [2];
                        }
                        this.rebuild();
                        return [4, this.displayWeather()];
                    case 6:
                        _a = (_b.sent());
                        if (!_a) return [3, 8];
                        return [4, this.displayForecast()];
                    case 7:
                        _a = (_b.sent());
                        _b.label = 8;
                    case 8:
                        if (_a) {
                            this.log.Print("Weather Information refreshed");
                        }
                        return [3, 10];
                    case 9:
                        e_1 = _b.sent();
                        this.log.Error("Error while refreshing Weather info: " + e_1);
                        this.lastUpdated = null;
                        return [2];
                    case 10:
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
                    mainCondition = capitalizeFirstLetter(_(mainCondition));
                }
            }
            if (this.weather.condition.description != null) {
                descriptionCondition = capitalizeFirstLetter(this.weather.condition.description);
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
            if (nonempty(this._locationLabelOverride)) {
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
                temp = TempToUserUnits(this.weather.main.temperature, this._temperatureUnit).toString();
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
            var wind_direction = compassDirection(this.weather.wind.degree);
            this._currentWeatherWind.text = ((wind_direction != undefined) ? wind_direction + ' ' : '') + MPStoUserUnits(this.weather.wind.speed, this._windSpeedUnit) + ' ' + this._windSpeedUnit;
            switch (this._dataService) {
                case DATA_SERVICE.OPEN_WEATHER_MAP:
                    if (this.weather.cloudiness != null) {
                        this._currentWeatherApiUnique.text = this.weather.cloudiness + "%";
                        this._currentWeatherApiUniqueCap.text = _("Cloudiness:");
                    }
                    break;
                case DATA_SERVICE.DARK_SKY:
                    if (this.weather.main.feelsLike != null) {
                        this._currentWeatherApiUnique.text = TempToUserUnits(this.weather.main.feelsLike, this._temperatureUnit) + this.unitToUnicode();
                        this._currentWeatherApiUniqueCap.text = _("Feels like:");
                    }
                    break;
                default:
                    this._currentWeatherApiUnique.text = "";
                    this._currentWeatherApiUniqueCap.text = "";
            }
            if (this.weather.main.pressure != null) {
                this._currentWeatherPressure.text = PressToUserUnits(this.weather.main.pressure, this._pressureUnit) + ' ' + _(this._pressureUnit);
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
            if (this.weather.sunrise != null && this.weather.sunset != null && this._showSunrise) {
                sunriseText = (_('Sunrise') + ': ' + GetHoursMinutes(this.weather.sunrise, this.currentLocale, this._show24Hours, this.weather.location.timeZone));
                sunsetText = (_('Sunset') + ': ' + GetHoursMinutes(this.weather.sunset, this.currentLocale, this._show24Hours, this.weather.location.timeZone));
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
                var t_low = TempToUserUnits(forecastData.main.temp_min, this._temperatureUnit);
                var t_high = TempToUserUnits(forecastData.main.temp_max, this._temperatureUnit);
                var first_temperature = this._temperatureHighFirst ? t_high : t_low;
                var second_temperature = this._temperatureHighFirst ? t_low : t_high;
                var comment = "";
                if (forecastData.condition.main != null && forecastData.condition.description != null) {
                    comment = (this._shortConditions) ? forecastData.condition.main : forecastData.condition.description;
                    comment = capitalizeFirstLetter(comment);
                    if (this._translateCondition)
                        comment = _(comment);
                }
                if (this.weather.location.timeZone == null)
                    forecastData.dateTime.setMilliseconds(forecastData.dateTime.getMilliseconds() + (this.weather.location.tzOffset * 1000));
                var dayName = GetDayName(forecastData.dateTime, this.currentLocale, this.weather.location.timeZone);
                if (forecastData.dateTime) {
                    var now = new Date();
                    if (forecastData.dateTime.getDate() == now.getDate())
                        dayName = _("Today");
                    if (forecastData.dateTime.getDate() == new Date(now.setDate(now.getDate() + 1)).getDate())
                        dayName = _("Tomorrow");
                }
                forecastUi.Day.text = dayName;
                forecastUi.Temperature.text = first_temperature + ' ' + '\u002F' + ' ' + second_temperature + ' ' + this.unitToUnicode();
                forecastUi.Summary.text = comment;
                forecastUi.Icon.icon_name = forecastData.condition.icon;
            }
            return true;
        }
        catch (e) {
            this.log.Error("DisplayForecastError " + e);
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
        this._currentWeather.set_child(new St.Label({
            text: _('Loading current weather ...')
        }));
        this._futureWeather.set_child(new St.Label({
            text: _('Loading future weather ...')
        }));
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
        var textOb = {
            text: ELLIPSIS
        };
        this._currentWeatherSunrise = new St.Label(textOb);
        this._currentWeatherSunset = new St.Label(textOb);
        var ab = new St.BoxLayout({
            style_class: STYLE_ASTRONOMY
        });
        ab.add_actor(this._currentWeatherSunrise);
        var ab_spacerlabel = new St.Label({
            text: BLANK
        });
        ab.add_actor(ab_spacerlabel);
        ab.add_actor(this._currentWeatherSunset);
        var bb_spacerlabel = new St.Label({
            text: BLANK
        });
        bb.add_actor(bb_spacerlabel);
        bb.add_actor(ab);
        this._currentWeatherTemperature = new St.Label(textOb);
        this._currentWeatherHumidity = new St.Label(textOb);
        this._currentWeatherPressure = new St.Label(textOb);
        this._currentWeatherWind = new St.Label(textOb);
        this._currentWeatherApiUnique = new St.Label({
            text: ''
        });
        this._currentWeatherApiUniqueCap = new St.Label({
            text: ''
        });
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
        rb_captions.add_actor(new St.Label({
            text: _('Temperature:')
        }));
        rb_values.add_actor(this._currentWeatherTemperature);
        rb_captions.add_actor(new St.Label({
            text: _('Humidity:')
        }));
        rb_values.add_actor(this._currentWeatherHumidity);
        rb_captions.add_actor(new St.Label({
            text: _('Pressure:')
        }));
        rb_values.add_actor(this._currentWeatherPressure);
        rb_captions.add_actor(new St.Label({
            text: _('Wind:')
        }));
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
        this._forecastBox = new St.BoxLayout({
            vertical: this._verticalOrientation,
            style_class: STYLE_FORECAST_CONTAINER
        });
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
    MyApplet.prototype.noApiKey = function () {
        if (this._apiKey == undefined || this._apiKey == "") {
            return true;
        }
        return false;
    };
    ;
    MyApplet.prototype.unitToUnicode = function () {
        return this._temperatureUnit == "fahrenheit" ? '\u2109' : '\u2103';
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
function main(metadata, orientation, panelHeight, instanceId) {
    return new MyApplet(metadata, orientation, panelHeight, instanceId);
}
