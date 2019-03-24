"use strict";

var _MyApplet$prototype;

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _slicedToArray(arr, i) { return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _nonIterableRest(); }

function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance"); }

function _iterableToArrayLimit(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"] != null) _i["return"](); } finally { if (_d) throw _e; } } return _arr; }

function _arrayWithHoles(arr) { if (Array.isArray(arr)) return arr; }

function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { Promise.resolve(value).then(_next, _throw); } }

function _asyncToGenerator(fn) { return function () { var self = this, args = arguments; return new Promise(function (resolve, reject) { var gen = fn.apply(self, args); function _next(value) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value); } function _throw(err) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err); } _next(undefined); }); }; }

var DEBUG = false; //----------------------------------
// imports
//----------------------------------

/**
 * /usr/share/gjs-1.0/
 * /usr/share/gnome-js/
 */

var Cairo = imports.cairo;
var Lang = imports.lang; // http://developer.gnome.org/glib/unstable/glib-The-Main-Event-Loop.html

var Main = imports.ui.main;
var Mainloop = imports.mainloop;
/**
 * /usr/share/gjs-1.0/overrides/
 * /usr/share/gir-1.0/
 * /usr/lib/cinnamon/
 */

var Gio = imports.gi.Gio;
var Gtk = imports.gi.Gtk; // http://developer.gnome.org/libsoup/stable/libsoup-client-howto.html

var Soup = imports.gi.Soup; // http://developer.gnome.org/st/stable/

var St = imports.gi.St;
/**
 * /usr/share/cinnamon/js/
 */

var Applet = imports.ui.applet;
var Config = imports.misc.config;
var PopupMenu = imports.ui.popupMenu;
var Settings = imports.ui.settings;
var Util = imports.misc.util; //----------------------------------------------------------------------
//
// Constants
//
//----------------------------------------------------------------------

var UUID = "weather@mockturtl";
var APPLET_ICON = "view-refresh-symbolic";
var CMD_SETTINGS = "cinnamon-settings applets " + UUID; // Conversion Factors

var WEATHER_CONV_MPH_IN_MPS = 2.23693629;
var WEATHER_CONV_KPH_IN_MPS = 3.6;
var WEATHER_CONV_KNOTS_IN_MPS = 1.94384449; // Magic strings

var BLANK = '   ';
var ELLIPSIS = '...';
var EN_DASH = "\u2013";
/* Some Information on More Data Service options to stay in free limit:
APIXU: 10000 calls a month
DarkSky: 1000 calls a day free
WeatherBit: 1000 calls a day, 16 Day foreast Call
AccuWeather: 50 calls a day

Openweather: max 60 calls per minute, Temporary ban and no charge
*/

var DATA_SERVICE = {
  OPEN_WEATHER_MAP: "OpenWeatherMap",
  DARK_SKY: "DarkSky" // Schema keys

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
var KEYS = [, WEATHER_DATA_SERVICE, WEATHER_API_KEY, WEATHER_TEMPERATURE_UNIT_KEY, WEATHER_TEMPERATURE_HIGH_FIRST_KEY, WEATHER_WIND_SPEED_UNIT_KEY, WEATHER_CITY_KEY, WEATHER_TRANSLATE_CONDITION_KEY, WEATHER_VERTICAL_ORIENTATION_KEY, WEATHER_SHOW_TEXT_IN_PANEL_KEY, WEATHER_SHOW_COMMENT_IN_PANEL_KEY, WEATHER_SHOW_SUNRISE_KEY, WEATHER_SHOW_24HOURS_KEY, WEATHER_FORECAST_DAYS, WEATHER_REFRESH_INTERVAL, WEATHER_PRESSURE_UNIT_KEY, WEATHER_SHORT_CONDITIONS_KEY, WEATHER_MANUAL_LOCATION]; // Signals

var SIGNAL_CHANGED = 'changed::';
var SIGNAL_CLICKED = 'clicked';
var SIGNAL_REPAINT = 'repaint'; // stylesheet.css

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
  AT: 'at' //----------------------------------------------------------------------
  //
  // Logging
  //
  //----------------------------------------------------------------------

};

function Log(_instanceId) {
  this.ID = _instanceId;
  this.debug = DEBUG;
}

Log.prototype = {
  Print: function Print(message) {
    var msg = UUID + "#" + this.ID + ": " + message.toString();
    var debug = "";

    if (this.debug) {
      debug = this.GetErrorLine();
      global.log(msg, '\n', "On Line:", debug);
    } else {
      global.log(msg);
    }
  },
  Error: function Error(error) {
    global.logError(UUID + "#" + this.ID + ": " + error.toString(), '\n', "On Line:", this.GetErrorLine());
  },
  Debug: function Debug(message) {
    if (this.debug) {
      this.Print(message);
    }
  },
  GetErrorLine: function GetErrorLine() {
    // Couldnt be more ugly, but it returns the file and line number
    var arr = new Error().stack.split("\n").slice(-2)[0].split('/').slice(-1)[0];
    return arr;
  }
}; //----------------------------------------------------------------
//
// l10n
//
//----------------------------------------------------------------------

var GLib = imports.gi.GLib;
var Gettext = imports.gettext;
Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");

function _(str) {
  return Gettext.dgettext(UUID, str);
} //----------------------------------------------------------------
//
// l10n
//
//----------------------------------------------------------------------
//----------------------------------------------------------------------
//
// MyApplet
//
//----------------------------------------------------------------------


function MyApplet(metadata, orientation, panelHeight, instanceId) {
  this.settings = new Settings.AppletSettings(this, UUID, instanceId);
  this.log = new Log(instanceId);
  this.currentLocale = GLib.get_language_names()[0];
  this.systemLanguage = this.currentLocale.split('_')[0]; // Soup session (see https://bugzilla.gnome.org/show_bug.cgi?id=661323#c64)

  this._httpSession = new Soup.SessionAsync();
  this._httpSession.user_agent = "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:37.0) Gecko/20100101 Firefox/37.0"; // ipapi blocks non-browsers agents, imitating browser

  Soup.Session.prototype.add_feature.call(this._httpSession, new Soup.ProxyResolverDefault());
  this.provider; // API

  this.locProvider = new IpApi(this); // IP location lookup

  this.lastUpdated = null; //////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////
  ///////////                                       ////////////
  ///////////              Data Storage             ////////////
  ///////////                                       ////////////
  //////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////
  // Translation layer is necessary with multiple API choices
  // Init with null, something we can properly check for
  // 
  //  If you get the values in these objects correctly with correct units
  //  from a new API, Everything will work as intended.
  //

  this.weather = {
    dateTime: null,
    // Date object, UTC
    location: {
      city: null,
      country: null,
      // Country code
      id: null,
      // API Specific ID, not used
      tzOffset: null,
      // seconds
      timeZone: null
    },
    coord: {
      lat: null,
      lon: null
    },
    sunrise: null,
    // Date object, UTC
    sunset: null,
    // Date object, UTC
    wind: {
      speed: null,
      // MPS
      degree: null // meteorlogical degrees

    },
    main: {
      temperature: null,
      // Kelvin
      pressure: null,
      // hPa
      humidity: null,
      // %
      temp_min: null,
      // Kelvin, not used
      temp_max: null,
      // Kelvin, not used
      feelsLike: null // kelvin

    },
    condition: {
      id: null,
      // ID, not used
      main: null,
      // What API returns
      description: null,
      // Longer description, if not available put the same whats in main
      icon: null // GTK weather icon names

    },
    cloudiness: null // %

  };
  this.forecasts = []; // a forecast template
  // Same units as weather, 
  // create an object like this then push into forecasts array

  /*var aForecast = { 
    dateTime: null,             //Required
    main: {
      temp: null,
      temp_min: null,           //Required
      temp_max: null,           //Required
      pressure: null,
      sea_level: null,
      grnd_level: null,
      humidity: null,
    },
    condition: {
      id: null,
      main: null,               //Required
      description: null,        //Required
      icon: null,               //Required
    },
    clouds: null,
    wind: {
      speed: null,
      deg: null,
    }
  }*/
  ///////////////////////////////////////////////////////////////////////
  ///////////////////////////////////////////////////////////////////////  
  // Units

  this.WeatherUnits = {
    CELSIUS: 'celsius',
    FAHRENHEIT: 'fahrenheit'
  };
  this.WeatherWindSpeedUnits = {
    KPH: 'kph',
    MPH: 'mph',
    MPS: 'm/s',
    KNOTS: 'Knots'
  };
  this.errMsg = {
    // Error messages to use
    label: {
      generic: _("Error"),
      service: _("Service Error"),
      noKey: _("No Api key"),
      noLoc: _("No Location")
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
    } // DarkSky Filter words for short conditions, won't work on every language

  };
  this.DarkSkyFilterWords = [_("and"), _("until"), _("in")];

  this._init(orientation, panelHeight, instanceId);
} // Class Declaration


MyApplet.prototype = (_MyApplet$prototype = {
  __proto__: Applet.TextIconApplet.prototype,
  refreshAndRebuild: function refreshAndRebuild() {
    this.refreshWeather().then(this.rebuild());
  },
  LoadJsonAsync: function () {
    var _LoadJsonAsync = _asyncToGenerator(
    /*#__PURE__*/
    regeneratorRuntime.mark(function _callee(query) {
      var _this = this;

      var json;
      return regeneratorRuntime.wrap(function _callee$(_context) {
        while (1) {
          switch (_context.prev = _context.next) {
            case 0:
              _context.next = 2;
              return new Promise(function (resolve, reject) {
                var message = Soup.Message.new('GET', query);

                _this._httpSession.queue_message(message, function (session, message) {
                  if (message) {
                    _this.log.Debug("API full response: " + message.response_body.data.toString());

                    try {
                      var payload = JSON.parse(message.response_body.data);
                      resolve(payload);
                    } catch (e) {
                      // Payload is not JSON
                      _this.log.Error("Error: API response is not JSON. The response: " + message.response_body.data);

                      if (_this._dataService == DATA_SERVICE.DARK_SKY) {
                        _this.log.Error("DarkSky: This usually indicates that API key is invalid.");
                      }

                      reject(null);
                    }
                  } else {
                    // No response
                    _this.log.Error("Error: No Response from API");

                    reject(null);
                  }
                });
              });

            case 2:
              json = _context.sent;
              return _context.abrupt("return", json);

            case 4:
            case "end":
              return _context.stop();
          }
        }
      }, _callee);
    }));

    function LoadJsonAsync(_x) {
      return _LoadJsonAsync.apply(this, arguments);
    }

    return LoadJsonAsync;
  }(),
  // Override Methods: TextIconApplet
  _init: function _init(orientation, panelHeight, instanceId) {
    Applet.TextIconApplet.prototype._init.call(this, orientation, panelHeight, instanceId); // Interface: TextIconApplet


    this.set_applet_icon_name(APPLET_ICON);
    this.set_applet_label(_("..."));
    this.set_applet_tooltip(_("Click to open")); // PopupMenu

    this.menuManager = new PopupMenu.PopupMenuManager(this);
    this.menu = new Applet.AppletPopupMenu(this, orientation);
    if (typeof this.menu.setCustomStyleClass === "function") this.menu.setCustomStyleClass(STYLE_WEATHER_MENU);else this.menu.actor.add_style_class_name(STYLE_WEATHER_MENU);
    this.menuManager.addMenu(this.menu); //----------------------------------
    // bind settings
    //----------------------------------

    for (var k in KEYS) {
      var key = KEYS[k];
      var keyProp = "_" + key;
      this.settings.bindProperty(Settings.BindingDirection.IN, key, keyProp, this.refreshAndRebuild, null);
    }

    this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, WEATHER_LOCATION, "_" + WEATHER_LOCATION, this.refreshAndRebuild, null);
    this.settings.bindProperty(Settings.BindingDirection.IN, "keybinding", "keybinding", this._onKeySettingsUpdated, null);
    Main.keybindingManager.addHotKey(UUID, this.keybinding, Lang.bind(this, this.on_applet_clicked));
    this.updateIconType();
    this.settings.connect(SIGNAL_CHANGED + WEATHER_USE_SYMBOLIC_ICONS_KEY, Lang.bind(this, function () {
      this.updateIconType();
      this._applet_icon.icon_type = this._icon_type;
      this._currentWeatherIcon.icon_type = this._icon_type;

      for (var i = 0; i < this._forecastDays; i++) {
        this._forecast[i].Icon.icon_type = this._icon_type;
      }

      this.refreshWeather();
    })); // configuration via context menu is automatically provided in Cinnamon 2.0+

    var cinnamonVersion = Config.PACKAGE_VERSION.split('.');
    var majorVersion = parseInt(cinnamonVersion[0]); //log("cinnamonVersion=" + cinnamonVersion +  "; majorVersion=" + majorVersion)
    // for Cinnamon 1.x, build a menu item

    if (majorVersion < 2) {
      var itemLabel = _("Settings");

      var settingsMenuItem = new Applet.MenuItem(itemLabel, Gtk.STOCK_EDIT, Lang.bind(this, function () {
        Util.spawnCommandLine(CMD_SETTINGS);
      }));

      this._applet_context_menu.addMenuItem(settingsMenuItem);
    } //------------------------------
    // render graphics container
    //------------------------------
    // build menu


    var mainBox = new St.BoxLayout({
      vertical: true
    });
    this.menu.addActor(mainBox); //  today's forecast

    this._currentWeather = new St.Bin({
      style_class: STYLE_CURRENT
    });
    mainBox.add_actor(this._currentWeather); //  horizontal rule

    this._separatorArea = new St.DrawingArea({
      style_class: STYLE_POPUP_SEPARATOR_MENU_ITEM
    });
    this._separatorArea.width = 200;

    this._separatorArea.connect(SIGNAL_REPAINT, Lang.bind(this, this._onSeparatorAreaRepaint));

    mainBox.add_actor(this._separatorArea); //  tomorrow's forecast

    this._futureWeather = new St.Bin({
      style_class: STYLE_FORECAST
    });
    mainBox.add_actor(this._futureWeather);
    this.rebuild(); //------------------------------
    // run
    //------------------------------

    this.refreshLoop();
    this.orientation = orientation;

    try {
      this.setAllowedLayout(Applet.AllowedLayout.BOTH);
      this.update_label_visible();
    } catch (e) {// vertical panel not supported
    }
  },
  locationLookup: function () {
    var _locationLookup = _asyncToGenerator(
    /*#__PURE__*/
    regeneratorRuntime.mark(function _callee2() {
      var command;
      return regeneratorRuntime.wrap(function _callee2$(_context2) {
        while (1) {
          switch (_context2.prev = _context2.next) {
            case 0:
              command = "xdg-open ";
              Util.spawnCommandLine(command + "https://cinnamon-spices.linuxmint.com/applets/view/17");

            case 2:
            case "end":
              return _context2.stop();
          }
        }
      }, _callee2);
    }));

    function locationLookup() {
      return _locationLookup.apply(this, arguments);
    }

    return locationLookup;
  }(),
  refreshLoop: function refreshLoop() {
    // Main independent Loop
    try {
      if (this.lastUpdated == null || new Date(this.lastUpdated.getTime() + this._refreshInterval * 60000) < new Date()) {
        this.refreshWeather();
      }
    } catch (e) {
      this.log.Error("Error in Main loop: " + e);
      this.lastUpdated = null;
    }

    Mainloop.timeout_add_seconds(15, Lang.bind(this, function mainloopTimeout() {
      this.refreshLoop();
    }));
  },
  update_label_visible: function update_label_visible() {
    if (this.orientation == St.Side.LEFT || this.orientation == St.Side.RIGHT) this.hide_applet_label(true);else this.hide_applet_label(false);
  },
  on_orientation_changed: function on_orientation_changed(orientation) {
    this.orientation = orientation;
    this.refreshWeather();
  },
  // Override Methods: Applet
  _onKeySettingsUpdated: function _onKeySettingsUpdated() {
    if (this.keybinding != null) {
      Main.keybindingManager.addHotKey(UUID, this.keybinding, Lang.bind(this, this.on_applet_clicked));
    }
  },
  on_applet_clicked: function on_applet_clicked(event) {
    this.menu.toggle();
  },
  _onSeparatorAreaRepaint: function onSeparatorAreaRepaint(area) {
    var cr = area.get_context();
    var themeNode = area.get_theme_node();

    var _area$get_surface_siz = area.get_surface_size(),
        _area$get_surface_siz2 = _slicedToArray(_area$get_surface_siz, 2),
        width = _area$get_surface_siz2[0],
        height = _area$get_surface_siz2[1];

    var margin = themeNode.get_length('-margin-horizontal');
    var gradientHeight = themeNode.get_length('-gradient-height');
    var startColor = themeNode.get_color('-gradient-start');
    var endColor = themeNode.get_color('-gradient-end');
    var gradientWidth = width - margin * 2;
    var gradientOffset = (height - gradientHeight) / 2;
    var pattern = new Cairo.LinearGradient(margin, gradientOffset, width - margin, gradientOffset + gradientHeight);
    pattern.addColorStopRGBA(0, startColor.red / 255, startColor.green / 255, startColor.blue / 255, startColor.alpha / 255);
    pattern.addColorStopRGBA(0.5, endColor.red / 255, endColor.green / 255, endColor.blue / 255, endColor.alpha / 255);
    pattern.addColorStopRGBA(1, startColor.red / 255, startColor.green / 255, startColor.blue / 255, startColor.alpha / 255);
    cr.setSource(pattern);
    cr.rectangle(margin, gradientOffset, gradientWidth, gradientHeight);
    cr.fill();
  },
  //----------------------------------------------------------------------
  //
  // Methods
  //
  //----------------------------------------------------------------------
  updateIconType: function updateIconType() {
    this._icon_type = this.settings.getValue(WEATHER_USE_SYMBOLIC_ICONS_KEY) ? St.IconType.SYMBOLIC : St.IconType.FULLCOLOR;
  },
  showError: function showError(title, msg) {
    this.set_applet_label(title);
    this.set_applet_tooltip("Click to open");
    this.set_applet_icon_name("weather-severe-alert");
    this._currentWeatherSunrise.text = msg;
  },
  refreshWeather: function () {
    var _refreshWeather = _asyncToGenerator(
    /*#__PURE__*/
    regeneratorRuntime.mark(function _callee3() {
      var haveLocation, loc, refreshResult;
      return regeneratorRuntime.wrap(function _callee3$(_context3) {
        while (1) {
          switch (_context3.prev = _context3.next) {
            case 0:
              this.wipeCurrentData();
              this.wipeForecastData(); // Making sure location is in place

              _context3.prev = 2;

              if (this._manualLocation) {
                _context3.next = 14;
                break;
              }

              _context3.next = 6;
              return this.locProvider.GetLocation();

            case 6:
              haveLocation = _context3.sent;

              if (haveLocation) {
                _context3.next = 12;
                break;
              }

              this.log.Error("Couldn't obtain location, retry in 15 seconds...");
              this.showError(this.errMsg.label.noLoc, this.errMsg.desc.cantGetLoc);
              this.lastUpdated = null;
              return _context3.abrupt("return");

            case 12:
              _context3.next = 19;
              break;

            case 14:
              // Manual Location
              // Adding resilience against bad user input
              loc = this._location.replace(" ", "");

              if (!(loc == undefined || loc == "")) {
                _context3.next = 19;
                break;
              }

              this.showError(this.errMsg.label.noLoc, "");
              this.log.Error("No location given when setting is on Manual Location");
              return _context3.abrupt("return");

            case 19:
              _context3.t0 = this._dataService;
              _context3.next = _context3.t0 === DATA_SERVICE.DARK_SKY ? 22 : _context3.t0 === DATA_SERVICE.OPEN_WEATHER_MAP ? 27 : 32;
              break;

            case 22:
              //
              // No City and Country information, fetch from geolocation api
              //
              this.provider = new DarkSky(this);
              _context3.next = 25;
              return this.provider.GetWeather();

            case 25:
              refreshResult = _context3.sent;
              return _context3.abrupt("break", 33);

            case 27:
              //
              //  No TZ information
              //
              this.provider = new OpenWeatherMap(this);
              _context3.next = 30;
              return this.provider.GetWeather();

            case 30:
              refreshResult = _context3.sent;
              return _context3.abrupt("break", 33);

            case 32:
              return _context3.abrupt("return");

            case 33:
              if (refreshResult) {
                _context3.next = 37;
                break;
              }

              // Failed
              this.log.Error("Unable to obtain Weather Information");
              this.lastUpdated = null;
              return _context3.abrupt("return");

            case 37:
              _context3.next = 39;
              return this.displayWeather();

            case 39:
              _context3.t1 = _context3.sent;

              if (!_context3.t1) {
                _context3.next = 44;
                break;
              }

              _context3.next = 43;
              return this.displayForecast();

            case 43:
              _context3.t1 = _context3.sent;

            case 44:
              if (!_context3.t1) {
                _context3.next = 46;
                break;
              }

              this.log.Print("Weather Information refreshed");

            case 46:
              _context3.next = 53;
              break;

            case 48:
              _context3.prev = 48;
              _context3.t2 = _context3["catch"](2);
              this.log.Error("Error while refreshing Weather info: " + _context3.t2);
              this.lastUpdated = null;
              return _context3.abrupt("return");

            case 53:
              this.lastUpdated = new Date();
              return _context3.abrupt("return");

            case 55:
            case "end":
              return _context3.stop();
          }
        }
      }, _callee3, this, [[2, 48]]);
    }));

    function refreshWeather() {
      return _refreshWeather.apply(this, arguments);
    }

    return refreshWeather;
  }(),
  displayWeather: function () {
    var _displayWeather = _asyncToGenerator(
    /*#__PURE__*/
    regeneratorRuntime.mark(function _callee4() {
      var mainCondition, descriptionCondition, location, iconname, temp, label, wind_direction, sunriseText, sunsetText, sunrise, sunset;
      return regeneratorRuntime.wrap(function _callee4$(_context4) {
        while (1) {
          switch (_context4.prev = _context4.next) {
            case 0:
              _context4.prev = 0;
              mainCondition = "";
              descriptionCondition = ""; // Short Condition Name

              if (this.weather.condition.main != null) {
                mainCondition = this.weather.condition.main;

                if (this._translateCondition) {
                  mainCondition = this.capitalizeFirstLetter(_(mainCondition));
                }
              } // Condition Description


              if (this.weather.condition.description != null) {
                descriptionCondition = this.capitalizeFirstLetter(this.weather.condition.description);

                if (this._translateCondition) {
                  descriptionCondition = _(descriptionCondition);
                }
              } // Displaying Location   


              location = "";

              if (this.weather.location.city != null && this.weather.location.country != null) {
                location = this.weather.location.city + ", " + this.weather.location.country;
              } else {
                location = Math.round(this.weather.coord.lat * 10000) / 10000 + ", " + Math.round(this.weather.coord.lon * 10000) / 10000;
              } // Overriding Location


              if (this.nonempty(this._locationLabelOverride)) {
                location = this._locationLabelOverride;
              }

              this.set_applet_tooltip(location); // Weather Condition

              this._currentWeatherSummary.text = descriptionCondition; // Weather icon

              iconname = this.weather.condition.icon;

              if (iconname == null) {
                iconname = "weather-severe-alert";
              }

              this._currentWeatherIcon.icon_name = iconname;
              this._icon_type == St.IconType.SYMBOLIC ? this.set_applet_icon_symbolic_name(iconname) : this.set_applet_icon_name(iconname); // Temperature

              temp = "";

              if (this.weather.main.temperature != null) {
                temp = this.TempToUserUnits(this.weather.main.temperature);
                this._currentWeatherTemperature.text = temp + ' ' + this.unitToUnicode();
              } // Set Applet Label, even if the variables are empty


              label = "";

              if (this._showCommentInPanel) {
                label += mainCondition;
              }

              if (this._showTextInPanel) {
                if (label != "") {
                  label += " ";
                }

                label += temp + ' ' + this.unitToUnicode();
              }

              this.set_applet_label(label);

              try {
                this.update_label_visible();
              } catch (e) {} // vertical panel not supported
              // Displaying humidity


              if (this.weather.main.humidity != null) {
                this._currentWeatherHumidity.text = Math.round(this.weather.main.humidity) + "%";
              } // Wind


              wind_direction = this.compassDirection(this.weather.wind.degree);
              this._currentWeatherWind.text = (wind_direction != undefined ? wind_direction + ' ' : '') + this.MPStoUserUnits(this.weather.wind.speed) + ' ' + this._windSpeedUnit; // API Unique display

              _context4.t0 = this._dataService;
              _context4.next = _context4.t0 === DATA_SERVICE.OPEN_WEATHER_MAP ? 27 : _context4.t0 === DATA_SERVICE.DARK_SKY ? 29 : 31;
              break;

            case 27:
              if (this.weather.cloudiness != null) {
                this._currentWeatherApiUnique.text = this.weather.cloudiness + "%";
                this._currentWeatherApiUniqueCap.text = _("Cloudiness:");
              }

              return _context4.abrupt("break", 33);

            case 29:
              if (this.weather.main.feelsLike != null) {
                this._currentWeatherApiUnique.text = this.TempToUserUnits(this.weather.main.feelsLike) + this.unitToUnicode();
                this._currentWeatherApiUniqueCap.text = _("Feels like:");
              }

              return _context4.abrupt("break", 33);

            case 31:
              this._currentWeatherApiUnique.text = "";
              this._currentWeatherApiUniqueCap.text = "";

            case 33:
              // Pressure
              if (this.weather.main.pressure != null) {
                this._currentWeatherPressure.text = this.PressToUserUnits(this.weather.main.pressure) + ' ' + _(this._pressureUnit);
              } // Location


              this._currentWeatherLocation.label = location;
              _context4.t1 = this._dataService;
              _context4.next = _context4.t1 === DATA_SERVICE.OPEN_WEATHER_MAP ? 38 : _context4.t1 === DATA_SERVICE.DARK_SKY ? 40 : 42;
              break;

            case 38:
              this._currentWeatherLocation.url = "https://openweathermap.org/city/" + this.weather.location.id;
              return _context4.abrupt("break", 43);

            case 40:
              this._currentWeatherLocation.url = "https://darksky.net/forecast/" + this.weather.coord.lat + "," + this.weather.coord.lon;
              return _context4.abrupt("break", 43);

            case 42:
              this._currentWeatherLocation.url = null;

            case 43:
              // Sunset/Sunrise
              sunriseText = "";
              sunsetText = "";

              if (this.weather.sunrise != null && this.weather.sunset != null) {
                if (this._showSunrise) {
                  sunriseText = _('Sunrise');
                  sunsetText = _('Sunset');

                  if (this.weather.location.timeZone != null) {
                    //have TZ, en-GB returns time in the correct format
                    sunrise = this.weather.sunrise.toLocaleString("en-GB", {
                      timeZone: this.weather.location.timeZone,
                      hour: "2-digit",
                      minute: "2-digit"
                    });
                    sunset = this.weather.sunset.toLocaleString("en-GB", {
                      timeZone: this.weather.location.timeZone,
                      hour: "2-digit",
                      minute: "2-digit"
                    });
                    sunriseText = sunriseText + ': ' + this.timeToUserUnits(sunrise);
                    sunsetText = sunsetText + ': ' + this.timeToUserUnits(sunset);
                  } else {
                    // else We assume that System TZ and Location TZ is same, covers 95% of users   
                    sunriseText = sunriseText + ': ' + this.timeToUserUnits(this.weather.sunrise.toLocaleFormat('%H:%M'));
                    sunsetText = sunsetText + ': ' + this.timeToUserUnits(this.weather.sunset.toLocaleFormat('%H:%M'));
                  }
                }
              }

              this._currentWeatherSunrise.text = sunriseText;
              this._currentWeatherSunset.text = sunsetText;
              return _context4.abrupt("return", true);

            case 51:
              _context4.prev = 51;
              _context4.t2 = _context4["catch"](0);
              this.log.Error("DisplayWeatherError: " + _context4.t2);
              return _context4.abrupt("return", false);

            case 55:
            case "end":
              return _context4.stop();
          }
        }
      }, _callee4, this, [[0, 51]]);
    }));

    function displayWeather() {
      return _displayWeather.apply(this, arguments);
    }

    return displayWeather;
  }(),
  displayForecast: function () {
    var _displayForecast = _asyncToGenerator(
    /*#__PURE__*/
    regeneratorRuntime.mark(function _callee5() {
      var i, forecastData, forecastUi, t_low, t_high, first_temperature, second_temperature, comment, dayName;
      return regeneratorRuntime.wrap(function _callee5$(_context5) {
        while (1) {
          switch (_context5.prev = _context5.next) {
            case 0:
              _context5.prev = 0;

              for (i = 0; i < this._forecast.length; i++) {
                forecastData = this.forecasts[i];
                forecastUi = this._forecast[i];
                t_low = this.TempToUserUnits(forecastData.main.temp_min);
                t_high = this.TempToUserUnits(forecastData.main.temp_max);
                first_temperature = this._temperatureHighFirst ? t_high : t_low;
                second_temperature = this._temperatureHighFirst ? t_low : t_high; // Weather Condition

                comment = "";

                if (forecastData.condition.main != null && forecastData.condition.description != null) {
                  if (this._shortConditions) {
                    comment = this.capitalizeFirstLetter(forecastData.condition.main);

                    if (this._translateCondition) {
                      comment = _(this.capitalizeFirstLetter(forecastData.condition.main));
                    }
                  } else {
                    comment = this.capitalizeFirstLetter(forecastData.condition.description);

                    if (this._translateCondition) {
                      comment = _(this.capitalizeFirstLetter(forecastData.condition.description));
                    }
                  }
                } // Day Names


                dayName = forecastData.dateTime;

                if (this.weather.location.timeZone != null) {
                  this.log.Debug(dayName.toLocaleString("en-GB", {
                    timeZone: this.weather.location.timeZone
                  }));
                  dayName = _(dayName.toLocaleString("en-GB", {
                    timeZone: this.weather.location.timeZone,
                    weekday: "long"
                  }));
                } else {
                  dayName.setMilliseconds(dayName.getMilliseconds() + this.weather.location.tzOffset * 1000);
                  dayName = _(this.getDayName(dayName.getUTCDay()));
                }

                forecastUi.Day.text = dayName;
                forecastUi.Temperature.text = first_temperature + ' ' + "/" + ' ' + second_temperature + ' ' + this.unitToUnicode();
                forecastUi.Summary.text = comment;
                forecastUi.Icon.icon_name = forecastData.condition.icon;
              }

              return _context5.abrupt("return", true);

            case 5:
              _context5.prev = 5;
              _context5.t0 = _context5["catch"](0);
              this.log.Error("DisplayForecastError" + _context5.t0);
              return _context5.abrupt("return", false);

            case 9:
            case "end":
              return _context5.stop();
          }
        }
      }, _callee5, this, [[0, 5]]);
    }));

    function displayForecast() {
      return _displayForecast.apply(this, arguments);
    }

    return displayForecast;
  }(),
  wipeCurrentData: function wipeCurrentData() {
    //Reset weather object
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
  },
  wipeForecastData: function wipeForecastData() {
    this.forecasts = [];
  },
  destroyCurrentWeather: function destroyCurrentWeather() {
    if (this._currentWeather.get_child() != null) this._currentWeather.get_child().destroy();
  },
  destroyFutureWeather: function destroyFutureWeather() {
    if (this._futureWeather.get_child() != null) this._futureWeather.get_child().destroy();
  },
  showLoadingUi: function showLoadingUi() {
    this.destroyCurrentWeather();
    this.destroyFutureWeather();

    this._currentWeather.set_child(new St.Label({
      text: _('Loading current weather ...')
    }));

    this._futureWeather.set_child(new St.Label({
      text: _('Loading future weather ...')
    }));
  },
  rebuild: function rebuild() {
    this.showLoadingUi();
    this.rebuildCurrentWeatherUi();
    this.rebuildFutureWeatherUi();
  },
  rebuildCurrentWeatherUi: function rebuildCurrentWeatherUi() {
    this.destroyCurrentWeather(); // This will hold the icon for the current weather

    this._currentWeatherIcon = new St.Icon({
      icon_type: this._icon_type,
      icon_size: 64,
      icon_name: APPLET_ICON,
      style_class: STYLE_ICON
    }); // The summary of the current weather

    this._currentWeatherSummary = new St.Label({
      text: _('Loading ...'),
      style_class: STYLE_SUMMARY
    });
    this._currentWeatherLocation = new St.Button({
      reactive: true,
      label: _('Refresh')
    });
    this._currentWeatherLocation.style_class = STYLE_LOCATION_LINK;

    this._currentWeatherLocation.connect(SIGNAL_CLICKED, Lang.bind(this, function () {
      if (this._currentWeatherLocation.url == null) {
        // Freezes cinnamon if this function called from here
        this.refreshWeather();
      } else {
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
    bb.add_actor(ab); // Other labels

    this._currentWeatherTemperature = new St.Label(textOb);
    this._currentWeatherHumidity = new St.Label(textOb);
    this._currentWeatherPressure = new St.Label(textOb);
    this._currentWeatherWind = new St.Label(textOb);
    this._currentWeatherApiUnique = new St.Label({
      text: ''
    }); // APi Unique Caption

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
  },
  rebuildFutureWeatherUi: function rebuildFutureWeatherUi() {
    this.destroyFutureWeather();
    this._forecast = [];
    this._forecastBox = new St.BoxLayout({
      vertical: this._verticalOrientation
    });

    this._futureWeather.set_child(this._forecastBox);

    for (var i = 0; i < this._forecastDays; i++) {
      var forecastWeather = {};
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
  },
  //----------------------------------------------------------------------
  //
  // Utility functions
  //
  //----------------------------------------------------------------------
  noApiKey: function noApiKey() {
    if (this._apiKey == undefined || this._apiKey == "") {
      return true;
    }

    return false;
  },
  capitalizeFirstLetter: function capitalizeFirstLetter(description) {
    if (description == undefined || description == null) {
      return "";
    }

    return description.charAt(0).toUpperCase() + description.slice(1);
  },
  // Takes Time in %H:%M string format
  timeToUserUnits: function timeToUserUnits(time) {
    time = time.split(':'); //Remove Leading 0

    if (time[0].charAt(0) == "0") {
      time[0] = time[0].substr(1);
    } //Returnt Time based on user preference


    if (this._show24Hours) {
      return time[0] + ":" + time[1];
    } else {
      if (time[0] > 12) {
        // PM
        return time[0] - 12 + ":" + time[1] + " pm";
      } else {
        //AM
        return time[0] + ":" + time[1] + " am";
      }
    }
  },
  KPHtoMPS: function KPHtoMPS(speed) {
    return speed / WEATHER_CONV_KPH_IN_MPS;
  },
  MPHtoMPS: function MPHtoMPS(speed) {
    return speed / WEATHER_CONV_MPH_IN_MPS;
  },
  MPStoUserUnits: function MPStoUserUnits(mps) {
    // Override wind units with our preference, takes Meter/Second wind speed
    switch (this._windSpeedUnit) {
      case this.WeatherWindSpeedUnits.MPH:
        //Rounding to 1 decimal
        return Math.round(mps * WEATHER_CONV_MPH_IN_MPS * 10) / 10;

      case this.WeatherWindSpeedUnits.KPH:
        //Rounding to 1 decimal
        return Math.round(mps * WEATHER_CONV_KPH_IN_MPS * 10) / 10;

      case this.WeatherWindSpeedUnits.MPS:
        // Rounding to 1 decimal just in case API does not return it in the same format
        return Math.round(mps * 10) / 10;

      case this.WeatherWindSpeedUnits.KNOTS:
        //Rounding to whole units
        return Math.round(mps * WEATHER_CONV_KNOTS_IN_MPS);
    }
  },
  // Conversion from Kelvin
  TempToUserUnits: function TempToUserUnits(kelvin) {
    if (this._temperatureUnit == this.WeatherUnits.CELSIUS) {
      return Math.round(kelvin - 273.15);
    }

    if (this._temperatureUnit == this.WeatherUnits.FAHRENHEIT) {
      return Math.round(9 / 5 * (kelvin - 273.15) + 32);
    }
  },
  CelsiusToKelvin: function CelsiusToKelvin(celsius) {
    return celsius + 273.15;
  },
  FahrenheitToKelvin: function FahrenheitToKelvin(fahr) {
    return (fahr - 32) / 1.8 + 273.15;
  }
}, _defineProperty(_MyApplet$prototype, "MPHtoMPS", function MPHtoMPS(speed) {
  return speed * 0.44704;
}), _defineProperty(_MyApplet$prototype, "PressToUserUnits", function PressToUserUnits(hpa) {
  switch (this._pressureUnit) {
    case WeatherPressureUnits.HPA:
      return hpa;

    case WeatherPressureUnits.AT:
      return Math.round(hpa * 0.001019716 * 1000) / 1000;

    case WeatherPressureUnits.ATM:
      return Math.round(hpa * 0.0009869233 * 1000) / 1000;

    case WeatherPressureUnits.INHG:
      return Math.round(hpa * 0.029529983071445 * 10) / 10;

    case WeatherPressureUnits.MMHG:
      return Math.round(hpa * 0.7500638);

    case WeatherPressureUnits.MBAR:
      return Math.round(hpa * 0.029529983071445 * 10) / 10;

    case WeatherPressureUnits.PA:
      return Math.round(hpa * 100);

    case WeatherPressureUnits.PSI:
      return Math.round(hpa * 0.01450377 * 100) / 100;
  }
}), _defineProperty(_MyApplet$prototype, "isNumeric", function isNumeric(n) {
  return !isNaN(parseFloat(n)) && isFinite(n);
}), _defineProperty(_MyApplet$prototype, "isString", function isString(text) {
  if (typeof text == 'string' || text instanceof String) {
    return true;
  }

  return false;
}), _defineProperty(_MyApplet$prototype, "isID", function isID(text) {
  if (text.length == 7 && this.isNumeric(text)) {
    return true;
  }

  return false;
}), _defineProperty(_MyApplet$prototype, "isCoordinate", function isCoordinate(text) {
  if (/^-?\d{1,3}(?:\.\d*)?,-?\d{1,3}(?:\.\d*)?/.test(text)) {
    return true;
  }

  return false;
}), _defineProperty(_MyApplet$prototype, "unitToUnicode", function unitToUnicode() {
  return this._temperatureUnit == this.WeatherUnits.FAHRENHEIT ? "\u2109" : "\u2103";
}), _defineProperty(_MyApplet$prototype, "weatherIconSafely", function weatherIconSafely(code, iconResolver) {
  var iconname = iconResolver(code);

  for (var i = 0; i < iconname.length; i++) {
    if (this.hasIcon(iconname[i])) return iconname[i];
  }

  return 'weather-severe-alert';
}), _defineProperty(_MyApplet$prototype, "hasIcon", function hasIcon(icon) {
  return Gtk.IconTheme.get_default().has_icon(icon + (this._icon_type == St.IconType.SYMBOLIC ? '-symbolic' : ''));
}), _defineProperty(_MyApplet$prototype, "nonempty", function nonempty(str) {
  return str != null && str.length > 0;
}), _defineProperty(_MyApplet$prototype, "getDayName", function getDayName(dayNum) {
  var days = [_('Sunday'), _('Monday'), _('Tuesday'), _('Wednesday'), _('Thursday'), _('Friday'), _('Saturday')];
  return days[dayNum];
}), _defineProperty(_MyApplet$prototype, "compassDirection", function compassDirection(deg) {
  var directions = [_('N'), _('NE'), _('E'), _('SE'), _('S'), _('SW'), _('W'), _('NW')];
  return directions[Math.round(deg / 45) % directions.length];
}), _defineProperty(_MyApplet$prototype, "isLangSupported", function isLangSupported(lang, languages) {
  if (languages.indexOf(lang) != -1) {
    return true;
  }

  return false;
}), _MyApplet$prototype); //////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////
///////////                                       ////////////
///////////                DarkSky                ////////////
///////////                                       ////////////
//////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////

function DarkSky(app) {
  //--------------------------------------------------------
  //  Properties
  //--------------------------------------------------------
  this.descriptionLinelength = 25;
  this.supportedLanguages = ['ar', 'az', 'be', 'bg', 'bs', 'ca', 'cs', 'da', 'de', 'el', 'en', 'es', 'et', 'fi', 'fr', 'he', 'hr', 'hu', 'id', 'is', 'it', 'ja', 'ka', 'ko', 'kw', 'lv', 'nb', 'nl', 'no', 'pl', 'pt', 'ro', 'ru', 'sk', 'sl', 'sr', 'sv', 'tet', 'tr', 'uk', 'x-pig-latin', 'zh', 'zh-tw'];
  this.query = "https://api.darksky.net/forecast/";
  this.queryUnits = {
    scientific: 'si',
    // speed meter/sec, temp C
    imperial: 'us',
    // speed miles/hour, temp F
    uk: 'uk2' // speed miles/hour, temp C

  };
  this.queryUnit = null; //--------------------------------------------------------
  //  Functions
  //--------------------------------------------------------

  this.GetWeather =
  /*#__PURE__*/
  _asyncToGenerator(
  /*#__PURE__*/
  regeneratorRuntime.mark(function _callee6() {
    var query, json, message;
    return regeneratorRuntime.wrap(function _callee6$(_context6) {
      while (1) {
        switch (_context6.prev = _context6.next) {
          case 0:
            query = this.ConstructQuery();

            if (!(query != "" && query != null)) {
              _context6.next = 23;
              break;
            }

            app.log.Debug("DarkSky API query: " + query);
            _context6.prev = 3;
            _context6.next = 6;
            return app.LoadJsonAsync(query);

          case 6:
            json = _context6.sent;

            if (!(json == null)) {
              _context6.next = 10;
              break;
            }

            app.showError(app.errMsg.label.service, app.errMsg.desc.noResponse);
            return _context6.abrupt("return", false);

          case 10:
            _context6.next = 17;
            break;

          case 12:
            _context6.prev = 12;
            _context6.t0 = _context6["catch"](3);
            app.log.Error("DarkSky: API call failed: " + _context6.t0);
            app.showError(app.errMsg.label.service, app.errMsg.desc.noResponse);
            return _context6.abrupt("return", false);

          case 17:
            if (json.code) {
              _context6.next = 21;
              break;
            }

            return _context6.abrupt("return", this.ParseWeather(json));

          case 21:
            this.HandleResponseErrors(json);
            return _context6.abrupt("return", false);

          case 23:
            app.log.Error("DarkSky: Could not construct query, insufficent information");
            app.showError(app.errMsg.label.service, app.errMsg.desc.locBad);
            return _context6.abrupt("return", false);

          case 26:
          case "end":
            return _context6.stop();
        }
      }
    }, _callee6, this, [[3, 12]]);
  }));

  this.ParseWeather = function (json) {
    try {
      // Current Weather
      app.weather.dateTime = new Date(json.currently.time * 1000);
      app.weather.location.timeZone = json.timezone;
      app.weather.coord.lat = json.latitude;
      app.weather.coord.lon = json.longitude;
      app.weather.sunrise = new Date(json.daily.data[0].sunriseTime * 1000);
      app.weather.sunset = new Date(json.daily.data[0].sunsetTime * 1000);
      app.weather.wind.speed = this.ToMPS(json.currently.windSpeed);
      app.weather.wind.degree = json.currently.windBearing;
      app.weather.main.temperature = this.ToKelvin(json.currently.temperature);
      app.weather.main.pressure = json.currently.pressure;
      app.weather.main.humidity = json.currently.humidity * 100; // Using Summary for both, only short description available

      app.weather.condition.main = this.GetShortCurrentSummary(json.currently.summary);
      app.weather.condition.description = json.currently.summary;
      app.weather.condition.icon = app.weatherIconSafely(json.currently.icon, this.ResolveIcon);
      app.weather.condition.cloudiness = json.currently.cloudCover * 100;
      app.weather.main.feelsLike = this.ToKelvin(json.currently.apparentTemperature); //convert
      // Forecast

      for (var i = 0; i < app._forecastDays; i++) {
        // Object
        var forecast = {
          dateTime: null,
          //Required
          main: {
            temp: null,
            temp_min: null,
            //Required
            temp_max: null,
            //Required
            pressure: null,
            sea_level: null,
            grnd_level: null,
            humidity: null
          },
          condition: {
            id: null,
            main: null,
            //Required
            description: null,
            //Required
            icon: null //Required

          },
          clouds: null,
          wind: {
            speed: null,
            deg: null
          }
        };
        var day = json.daily.data[i];
        forecast.dateTime = new Date(day.time * 1000);
        forecast.main.temp_min = this.ToKelvin(day.temperatureLow);
        forecast.main.temp_max = this.ToKelvin(day.temperatureHigh);
        forecast.condition.main = this.GetShortSummary(day.summary);
        forecast.condition.description = this.ProcessSummary(day.summary);
        forecast.condition.icon = app.weatherIconSafely(day.icon, this.ResolveIcon);
        forecast.main.pressure = day.pressure;
        forecast.main.humidity = day.humidity * 100;
        app.forecasts.push(forecast);
      }
    } catch (e) {
      app.log.Error("DarkSky payload parsing error: " + e);
      app.showError(app.errMsg.label.generic, app.errMsg.desc.parse);
      return false;
    }

    return true;
  };

  this.ConstructQuery = function () {
    this.SetQueryUnit();
    var query;

    var key = app._apiKey.replace(" ", "");

    var location = app._location.replace(" ", "");

    if (app.noApiKey()) {
      app.showError(app.errMsg.label.noKey, "");
      return "";
    }

    if (app.isCoordinate(location)) {
      query = this.query + key + "/" + location + "?exclude=minutely,hourly,flags" + "&units=" + this.queryUnit;

      if (app.isLangSupported(app.systemLanguage, this.supportedLanguages) && app._translateCondition) {
        query = query + "&lang=" + app.systemLanguage;
      }

      return query;
    } else {
      return "";
    }
  };

  this.HandleResponseErrors = function (json) {
    var code = json.code;
    var error = json.error;
    var errorMsg = "DarkSky API: ";
    app.log.Debug("DarksSky API error payload: " + json);

    switch (code) {
      case "400":
        app.log.Error(errorMsg + error);
        break;

      default:
        app.log.Error(errorMsg + error);
        break;
    }
  };

  this.ProcessSummary = function (summary) {
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

  this.GetShortSummary = function (summary) {
    var processed = summary.split(" ");
    var result = "";

    for (var i = 0; i < 2; i++) {
      if (!/[\(\)]/.test(processed[i]) && !app.DarkSkyFilterWords.includes(processed[i])) {
        result = result + processed[i] + " ";
      }
    }

    return result;
  };

  this.GetShortCurrentSummary = function (summary) {
    var processed = summary.split(" ");
    var result = "";
    var maxLoop;
    processed.length < 2 ? maxLoop = processed.length : maxLoop = 2;

    for (var i = 0; i < maxLoop; i++) {
      if (processed[i] != "and") {
        result = result + processed[i] + " ";
      }
    }

    return result;
  };

  this.ResolveIcon = function (icon) {
    switch (icon) {
      case "rain":
        return ['weather-rain', 'weather-showers-scattered', 'weather-freezing-rain'];

      case "snow":
        return ['weather-snow'];

      case "fog":
        return ['weather-fog'];
      // case "04d":/* broken clouds day */
      //   return ['weather_overcast', 'weather-clouds', "weather-few-clouds"]
      //case "04n":/* broken clouds night */
      //  return ['weather_overcast', 'weather-clouds', "weather-few-clouds-night"]
      // case "03n":/* mostly cloudy (night) */
      //   return ['weather-clouds-night', 'weather-few-clouds-night']

      case "cloudy":
        /* mostly cloudy (day) */
        return ['weather-overcast', 'weather-clouds',, 'weather-few-clouds'];

      case "partly-cloudy-night":
        return ['weather-few-clouds-night', "weather-few-clouds"];

      case "partly-cloudy-day":
        return ['weather-few-clouds'];

      case "clear-night":
        return ['weather-clear-night'];

      case "clear-day":
        return ['weather-clear'];
      // Have not seen Storm or Showers icons returned yet

      case "storm":
        return ['weather-storm'];

      case "showers":
        return ['weather-showers'];
      // There is no guarantee that there is a wind icon

      case "wind":
        return ["weather-wind", "wind", "weather-breeze", 'weather-clouds', 'weather-few-clouds'];

      default:
        return ['weather-severe-alert'];
    }
  };

  this.SetQueryUnit = function () {
    if (app._temperatureUnit == app.WeatherUnits.CELSIUS) {
      if (app._windSpeedUnit == app.WeatherWindSpeedUnits.KPH || app._windSpeedUnit == app.WeatherWindSpeedUnits.MPS) {
        this.queryUnit = this.queryUnits.scientific;
      } else {
        this.queryUnit = this.queryUnits.uk;
      }
    } else {
      this.queryUnit = this.queryUnits.imperial;
    }
  };

  this.ToKelvin = function (temp) {
    if (this.queryUnit == this.queryUnits.imperial) {
      return app.FahrenheitToKelvin(temp);
    } else {
      return app.CelsiusToKelvin(temp);
    }
  };

  this.ToMPS = function (speed) {
    if (this.queryUnit == this.queryUnits.scientific) {
      return speed;
    } else {
      return app.MPHtoMPS(speed);
    }
  };
}

; //////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////
///////////                                       ////////////
///////////                  IpApi                ////////////
///////////                                       ////////////
//////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////

function IpApi(app) {
  this.query = "https://ipapi.co/json";
  this.GetLocation =
  /*#__PURE__*/
  _asyncToGenerator(
  /*#__PURE__*/
  regeneratorRuntime.mark(function _callee7() {
    var json;
    return regeneratorRuntime.wrap(function _callee7$(_context7) {
      while (1) {
        switch (_context7.prev = _context7.next) {
          case 0:
            _context7.prev = 0;
            _context7.next = 3;
            return app.LoadJsonAsync(this.query);

          case 3:
            json = _context7.sent;

            if (!(json == null)) {
              _context7.next = 7;
              break;
            }

            // Bad response
            app.showError(app.errMsg.label.service, app.errMsg.desc.noResponse);
            return _context7.abrupt("return", false);

          case 7:
            _context7.next = 14;
            break;

          case 9:
            _context7.prev = 9;
            _context7.t0 = _context7["catch"](0);
            app.log.Error("IpApi service error: " + _context7.t0);
            app.showError(app.errMsg.label.generic, app.errMsg.desc.cantGetLoc);
            return _context7.abrupt("return", false);

          case 14:
            if (!json.error) {
              _context7.next = 17;
              break;
            }

            this.HandleErrorResponse(json);
            return _context7.abrupt("return", false);

          case 17:
            return _context7.abrupt("return", this.ParseInformation(json));

          case 18:
          case "end":
            return _context7.stop();
        }
      }
    }, _callee7, this, [[0, 9]]);
  }));

  this.ParseInformation = function (json) {
    try {
      var loc = json.latitude + "," + json.longitude; //app._location == (json.latitude + "," + json.longitude);

      app.settings.setValue('location', loc);
      app.weather.location.timeZone = json.timezone;
      app.weather.location.city = json.city;
      app.weather.location.country = json.country;
      app.log.Print("Location obtained");
      app.log.Debug("Location:" + json.latitude + "," + json.longitude);
      app.log.Debug("Location setting is now: " + app._location);
      return true;
    } catch (e) {
      app.log.Error("IPapi parsing error: " + e);
      app.showError(app.errMsg.label.generic, app.errMsg.desc.cantGetLoc);
      return false;
    }
  };

  this.HandleErrorResponse = function (json) {
    app.log.Error("IpApi error response: " + json.reason);
  };
}

;
/*

Half sanitized example payload, courtesy of gr3q
{   
  "ip": "8.8.8.8",
  "city": "Cambridge",
  "region": "England",
  "region_code": "ENG",
  "country": "GB",
  "country_name": "United Kingdom",
  "continent_code": "EU",
  "in_eu": true,
  "postal": "XX0",
  "latitude": 52.2333,
  "longitude": 0.15,
  "timezone": "Europe/London",
  "utc_offset": "+0000",
  "country_calling_code": "+44",
  "currency": "GBP",
  "languages": "en-GB,cy-GB,gd",
  "asn": "AS5089",
  "org": "Virgin Media Limited"
}

*/
//////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////
///////////                                       ////////////
///////////         OpenWeatherMap Premium        ////////////
///////////                                       ////////////
//////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////

function OpenWeatherMap(app) {
  //--------------------------------------------------------
  //  Properties
  //--------------------------------------------------------
  this.supportedLanguages = ["ar", "bg", "ca", "cz", "de", "el", "en", "fa", "fi", "fr", "gl", "hr", "hu", "it", "ja", "kr", "la", "lt", "mk", "nl", "pl", "pt", "ro", "ru", "se", "sk", "sl", "es", "tr", "ua", "vi", "zh_cn", "zh_tw"];
  this.current_url = "https://api.openweathermap.org/data/2.5/weather?";
  this.daily_url = "https://api.openweathermap.org/data/2.5/forecast/daily?"; //--------------------------------------------------------
  //  Functions
  //--------------------------------------------------------

  this.GetWeather =
  /*#__PURE__*/
  _asyncToGenerator(
  /*#__PURE__*/
  regeneratorRuntime.mark(function _callee8() {
    var currentResult, forecastResult;
    return regeneratorRuntime.wrap(function _callee8$(_context8) {
      while (1) {
        switch (_context8.prev = _context8.next) {
          case 0:
            _context8.next = 2;
            return this.GetData(this.current_url, this.ParseCurrent);

          case 2:
            currentResult = _context8.sent;
            _context8.next = 5;
            return this.GetData(this.daily_url, this.ParseForecast);

          case 5:
            forecastResult = _context8.sent;

            if (!(currentResult && forecastResult)) {
              _context8.next = 10;
              break;
            }

            return _context8.abrupt("return", true);

          case 10:
            app.log.Error("OpenWeatherMap: Could not get Weather information");
            return _context8.abrupt("return", false);

          case 12:
          case "end":
            return _context8.stop();
        }
      }
    }, _callee8, this);
  })); // A function as a function parameter 2 levels deep does not know
  // about the top level object information, has to pass it in as a paramater

  this.GetData =
  /*#__PURE__*/
  function () {
    var _ref4 = _asyncToGenerator(
    /*#__PURE__*/
    regeneratorRuntime.mark(function _callee9(baseUrl, ParseFunction) {
      var query, json;
      return regeneratorRuntime.wrap(function _callee9$(_context9) {
        while (1) {
          switch (_context9.prev = _context9.next) {
            case 0:
              query = this.ConstructQuery(baseUrl);

              if (!(query != null)) {
                _context9.next = 24;
                break;
              }

              app.log.Debug("Query: " + query);
              _context9.prev = 3;
              _context9.next = 6;
              return app.LoadJsonAsync(query);

            case 6:
              json = _context9.sent;

              if (!(json == null)) {
                _context9.next = 10;
                break;
              }

              app.showError(app.errMsg.label.service, app.errMsg.desc.noResponse);
              return _context9.abrupt("return", false);

            case 10:
              _context9.next = 16;
              break;

            case 12:
              _context9.prev = 12;
              _context9.t0 = _context9["catch"](3);
              app.log.Error("Unable to call API:", _context9.t0);
              return _context9.abrupt("return", false);

            case 16:
              if (!(json.cod == 200)) {
                _context9.next = 20;
                break;
              }

              return _context9.abrupt("return", ParseFunction(json, this));

            case 20:
              this.HandleResponseErrors(json);
              return _context9.abrupt("return", false);

            case 22:
              _context9.next = 24;
              break;

            case 24:
            case "end":
              return _context9.stop();
          }
        }
      }, _callee9, this, [[3, 12]]);
    }));

    return function (_x2, _x3) {
      return _ref4.apply(this, arguments);
    };
  }();

  this.ParseCurrent = function (json, self) {
    try {
      if (json.coord) {
        app.weather.coord.lat = json.coord.lat;
        app.weather.coord.lon = json.coord.lon;
      }

      app.weather.location.city = json.name;
      app.weather.location.country = json.sys.country;
      app.weather.location.id = json.id;
      app.weather.dateTime = new Date(json.dt * 1000);
      app.weather.sunrise = new Date(json.sys.sunrise * 1000);
      app.weather.sunset = new Date(json.sys.sunset * 1000);

      if (json.wind) {
        app.weather.wind.speed = json.wind.speed;
        app.weather.wind.degree = json.wind.deg;
      }

      if (json.main) {
        app.weather.main.temperature = json.main.temp;
        app.weather.main.pressure = json.main.pressure;
        app.weather.main.humidity = json.main.humidity;
        app.weather.main.temp_min = json.main.temp_min;
        app.weather.main.temp_max = json.main.temp_max;
      }

      if (json.weather[0]) {
        app.weather.condition.main = json.weather[0].main;
        app.weather.condition.description = json.weather[0].description;
        app.weather.condition.icon = app.weatherIconSafely(json.weather[0].icon, self.ResolveIcon);
      }

      if (json.clouds) {
        app.weather.cloudiness = json.clouds.all;
      }

      return true;
    } catch (e) {
      app.log.Error("OpenWeathermap Weather Parsing error: " + e);
      app.showError(app.errMsg.label.generic, app.errMsg.desc.parse);
      return false;
    }
  };

  this.ParseForecast = function (json, self) {
    try {
      for (var i = 0; i < app._forecastDays; i++) {
        // Object
        var forecast = {
          dateTime: null,
          //Required
          main: {
            temp: null,
            temp_min: null,
            //Required
            temp_max: null,
            //Required
            pressure: null,
            sea_level: null,
            grnd_level: null,
            humidity: null
          },
          condition: {
            id: null,
            main: null,
            //Required
            description: null,
            //Required
            icon: null //Required

          },
          clouds: null,
          wind: {
            speed: null,
            deg: null
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
          forecast.condition.icon = app.weatherIconSafely(day.weather[0].icon, self.ResolveIcon);
        }

        app.forecasts.push(forecast);
      }

      return true;
    } catch (e) {
      app.log.Error("OpenWeathermap Forecast Parsing error: " + e);
      app.showError(app.errMsg.label.generic, app.errMsg.desc.parse);
      return false;
    }
  };

  this.ConstructQuery = function (baseUrl) {
    var query = baseUrl;
    var locString = this.ParseLocation();

    if (locString != null) {
      query = query + locString + "&APPID="; // Append Language if supported and enabled

      query += "1c73f8259a86c6fd43c7163b543c8640";

      if (app._translateCondition && app.isLangSupported(app.systemLanguage, this.supportedLanguages)) {
        query = query + "&lang=" + app.systemLanguage;
      }

      return query;
    }

    app.showError(app.errMsg.label.noLoc, "");
    app.log.Error("OpenWeatherMap: No Location was provided");
    return null;
  };

  this.ParseLocation = function () {
    var loc = app._location.replace(/ /g, "");

    if (app.isCoordinate(loc)) {
      loc = loc.split(',');
      return "lat=" + loc[0] + "&lon=" + loc[1];
    } else if (app.isID(loc)) {
      return "id=" + loc;
    } else // try as a normal query
      return "q=" + loc;
  };

  this.HandleResponseErrors = function (json) {
    var errorMsg = "OpenWeather API: ";

    switch (json.cod) {
      case "400":
        app.showError(app.errMsg.label.service, app.errMsg.desc.locBad);
        break;

      case "401":
        app.showError(app.errMsg.label.service, app.errMsg.desc.keyBad);
        break;

      case "404":
        app.showError(app.errMsg.label.service, app.errMsg.desc.locNotFound);
        break;

      case "429":
        app.showError(app.errMsg.label.service, app.errMsg.desc.blocked);
        break;

      default:
        app.showError(app.errMsg.label.service, app.errMsg.desc.unknown);
        break;
    }

    ;
    app.log.Debug("OpenWeatherMap Error Code: " + json.cod);
    app.log.Error(errorMsg + json.message);
  };

  this.ResolveIcon = function (icon) {
    // https://openweathermap.org/weather-conditions

    /* fallback icons are: weather-clear-night 
    weather-clear weather-few-clouds-night weather-few-clouds 
    weather-fog weather-overcast weather-severe-alert weather-showers 
    weather-showers-scattered weather-snow weather-storm */
    switch (icon) {
      case "10d":
        /* rain day */
        return ['weather-rain', 'weather-showers-scattered', 'weather-freezing-rain'];

      case "10n":
        /* rain night */
        return ['weather-rain', 'weather-showers-scattered', 'weather-freezing-rain'];

      case "09n":
        /* showers nigh*/
        return ['weather-showers'];

      case "09d":
        /* showers day */
        return ['weather-showers'];

      case "13d":
        /* snow day*/
        return ['weather-snow'];

      case "13n":
        /* snow night */
        return ['weather-snow'];

      case "50d":
        /* mist day */
        return ['weather-fog'];

      case "50n":
        /* mist night */
        return ['weather-fog'];

      case "04d":
        /* broken clouds day */
        return ['weather_overcast', 'weather-clouds', "weather-few-clouds"];

      case "04n":
        /* broken clouds night */
        return ['weather_overcast', 'weather-clouds', "weather-few-clouds-night"];

      case "03n":
        /* mostly cloudy (night) */
        return ['weather-clouds-night', 'weather-few-clouds-night'];

      case "03d":
        /* mostly cloudy (day) */
        return ['weather-clouds', 'weather-overcast', 'weather-few-clouds'];

      case "02n":
        /* partly cloudy (night) */
        return ['weather-few-clouds-night'];

      case "02d":
        /* partly cloudy (day) */
        return ['weather-few-clouds'];

      case "01n":
        /* clear (night) */
        return ['weather-clear-night'];

      case "01d":
        /* sunny */
        return ['weather-clear'];

      case "11d":
        /* storm day */
        return ['weather-storm'];

      case "11n":
        /* storm night */
        return ['weather-storm'];

      default:
        return ['weather-severe-alert'];
    }
  };
}

; //
// For Translators
//

var openWeatherMapConditionLibrary = [// Group 2xx: Thunderstorm
_("Thunderstorm with light rain"), _("Thunderstorm with rain"), _("Thunderstorm with heavy rain"), _("Light thunderstorm"), _("Thunderstorm"), _("Heavy thunderstorm"), _("Ragged thunderstorm"), _("Thunderstorm with light drizzle"), _("Thunderstorm with drizzle"), _("Thunderstorm with heavy drizzle"), // Group 3xx: Drizzle
_("Light intensity drizzle"), _("Drizzle"), _("Heavy intensity drizzle"), _("Light intensity drizzle rain"), _("Drizzle rain"), _("Heavy intensity drizzle rain"), _("Shower rain and drizzle"), _("Heavy shower rain and drizzle"), _("Shower drizzle"), // Group 5xx: Rain
_("Light rain"), _("Moderate rain"), _("Heavy intensity rain"), _("Very heavy rain"), _("Extreme rain"), _("Freezing rain"), _("Light intensity shower rain"), _("Shower rain"), _("Heavy intensity shower rain"), _("Ragged shower rain"), // Group 6xx: Snow 
_("Light snow"), _("Snow"), _("Heavy snow"), _("Sleet"), _("Shower sleet"), _("Light rain and snow"), _("Rain and snow"), _("Light shower snow"), _("Shower snow"), _("Heavy shower snow"), // Group 7xx: Atmosphere 
_("Mist"), _("Smoke"), _("Haze"), _("Sand, dust whirls"), _("Fog"), _("Sand"), _("Dust"), _("Volcanic ash"), _("Squalls"), _("Tornado"), // Group 800: Clear 
_("Clear"), _("Clear sky"), _("Sky is clear"), // Group 80x: Clouds
_("Few clouds"), _("Scattered clouds"), _("Broken clouds"), _("Overcast clouds")];
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
  alert: 'weather-severe-alert' //----------------------------------------------------------------------
  //
  // Entry point
  //
  //----------------------------------------------------------------------

};

function main(metadata, orientation, panelHeight, instanceId) {
  //log("v" + metadata.version + ", cinnamon " + Config.PACKAGE_VERSION)
  return new MyApplet(metadata, orientation, panelHeight, instanceId);
}