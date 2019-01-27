"use strict";
const DEBUG = false;

//----------------------------------
// imports
//----------------------------------

/**
 * /usr/share/gjs-1.0/
 * /usr/share/gnome-js/
 */
const Cairo = imports.cairo
const Lang = imports.lang
// http://developer.gnome.org/glib/unstable/glib-The-Main-Event-Loop.html
const Main = imports.ui.main
const Mainloop = imports.mainloop

/**
 * /usr/share/gjs-1.0/overrides/
 * /usr/share/gir-1.0/
 * /usr/lib/cinnamon/
 */
const Gio = imports.gi.Gio
const Gtk = imports.gi.Gtk
// http://developer.gnome.org/libsoup/stable/libsoup-client-howto.html
const Soup = imports.gi.Soup
// http://developer.gnome.org/st/stable/
const St = imports.gi.St
/**
 * /usr/share/cinnamon/js/
 */
const Applet = imports.ui.applet
const Config = imports.misc.config
const PopupMenu = imports.ui.popupMenu
const Settings = imports.ui.settings
const Util = imports.misc.util

//----------------------------------------------------------------------
//
// Constants
//
//----------------------------------------------------------------------

const UUID = "weather@mockturtl"
const APPLET_ICON = "view-refresh-symbolic"
const CMD_SETTINGS = "cinnamon-settings applets " + UUID

// Conversion Factors
const WEATHER_CONV_MPH_IN_MPS = 2.23693629
const WEATHER_CONV_KPH_IN_MPS = 3.6
const WEATHER_CONV_KNOTS_IN_MPS = 1.94384449

// Magic strings
const BLANK = '   '
const ELLIPSIS = '...'
const EN_DASH = '\u2013'


/* Some Information on More Data Service options to stay in free limit:
APIXU: 10000 calls a month
DarkSky: 1000 calls a day free
WeatherBit: 1000 calls a day, 16 Day foreast Call
AccuWeather: 50 calls a day

Openweather: max 60 calls per minute, Temporary ban and no charge
*/
const DATA_SERVICE = {
  OPEN_WEATHER_MAP: "OpenWeatherMap",
  OPEN_WEATHER_MAP_PRE: "OpenWeatherMap_prem",
  DARK_SKY: "DarkSky",
}

// Query
const SERVICE = {
  "OpenWeatherMap": {
    QUERY_URL : "https://api.openweathermap.org/data/2.5/weather?",
    FORECAST_URL: "https://api.openweathermap.org/data/2.5/forecast?"
  },
};


// Schema keys
const WEATHER_LOCATION = "location"
const WEATHER_DATA_SERVICE = "dataService"
const WEATHER_API_KEY = "apiKey"
const WEATHER_CITY_KEY = 'locationLabelOverride'
const WEATHER_REFRESH_INTERVAL = 'refreshInterval'
const WEATHER_SHOW_COMMENT_IN_PANEL_KEY = 'showCommentInPanel'
const WEATHER_VERTICAL_ORIENTATION_KEY = 'verticalOrientation'
const WEATHER_SHOW_SUNRISE_KEY = 'showSunrise'
const WEATHER_SHOW_24HOURS_KEY = 'show24Hours'
const WEATHER_FORECAST_DAYS = 'forecastDays'
const WEATHER_SHOW_TEXT_IN_PANEL_KEY = 'showTextInPanel'
const WEATHER_TRANSLATE_CONDITION_KEY = 'translateCondition'
const WEATHER_TEMPERATURE_UNIT_KEY = 'temperatureUnit'
const WEATHER_TEMPERATURE_HIGH_FIRST_KEY = 'temperatureHighFirst'
const WEATHER_PRESSURE_UNIT_KEY = 'pressureUnit'
const WEATHER_USE_SYMBOLIC_ICONS_KEY = 'useSymbolicIcons'
const WEATHER_WIND_SPEED_UNIT_KEY = 'windSpeedUnit'
const WEATHER_SHORT_CONDITIONS_KEY = 'shortConditions'

const KEYS = [,
  WEATHER_LOCATION,
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
  WEATHER_SHORT_CONDITIONS_KEY
]

// Signals
const SIGNAL_CHANGED = 'changed::'
const SIGNAL_CLICKED = 'clicked'
const SIGNAL_REPAINT = 'repaint'

// stylesheet.css
const STYLE_LOCATION_LINK = 'weather-current-location-link'
const STYLE_SUMMARYBOX = 'weather-current-summarybox'
const STYLE_SUMMARY = 'weather-current-summary'
const STYLE_DATABOX = 'weather-current-databox'
const STYLE_ICON = 'weather-current-icon'
const STYLE_ICONBOX = 'weather-current-iconbox'
const STYLE_DATABOX_CAPTIONS = 'weather-current-databox-captions'
const STYLE_ASTRONOMY = 'weather-current-astronomy'
const STYLE_FORECAST_ICON = 'weather-forecast-icon'
const STYLE_FORECAST_DATABOX = 'weather-forecast-databox'
const STYLE_FORECAST_DAY = 'weather-forecast-day'
const STYLE_CONFIG = 'weather-config'
const STYLE_DATABOX_VALUES = 'weather-current-databox-values'
const STYLE_FORECAST_SUMMARY = 'weather-forecast-summary'
const STYLE_FORECAST_TEMPERATURE = 'weather-forecast-temperature'
const STYLE_FORECAST_BOX = 'weather-forecast-box'
const STYLE_PANEL_BUTTON = 'panel-button'
const STYLE_POPUP_SEPARATOR_MENU_ITEM = 'popup-separator-menu-item'
const STYLE_CURRENT = 'current'
const STYLE_FORECAST = 'forecast'
const STYLE_WEATHER_MENU = 'weather-menu'

const WeatherPressureUnits = {
  HPA: 'hPa',
  MMHG: 'mm Hg',
  INHG: 'in Hg',
  PA: 'Pa',
  PSI: 'psi',
  ATM: 'atm',
  AT: 'at'
}

//----------------------------------------------------------------------
//
// Logging
//
//----------------------------------------------------------------------

function Log(_instanceId) {
  this.ID = _instanceId;
  this.debug = DEBUG;
}

Log.prototype = {
  Print: function(message) {
    let msg = UUID + "#" + this.ID + ": " + message.toString();
    let debug = "";
    if (this.debug) {
      debug = this.GetErrorLine();
      global.log(msg, '\n', "On Line:", debug);
    }
    else {
      global.log(msg);
    }   
  },

  Error: function(error) {
    global.logError(UUID + "#" + this.ID + ": " + error.toString(), '\n', "On Line:", this.GetErrorLine());
  },

  Debug: function(message) {
    if (this.debug) {
      this.Print(message);
    }
  },

  GetErrorLine: function() {
      // Couldnt be more ugly, but it returns the file and line number
      let arr = (new Error).stack.split("\n").slice(-2)[0].split('/').slice(-1)[0];
      return arr;
    }
};

//----------------------------------------------------------------
//
// l10n
//
//----------------------------------------------------------------------

const GLib = imports.gi.GLib
const Gettext = imports.gettext
Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");
function _(str) {
  return Gettext.dgettext(UUID, str)
}

const darkSky = require("darkSky");
const openWeatherMap = require("openWeatherMap");

//----------------------------------------------------------------
//
// l10n
//
//----------------------------------------------------------------------

// labelErrors
const err_parseLabel = _("Error");
const err_service = _("Service Error");
const err_noService = _("Service Unavailable");
const err_noLocation = _("No Location provided");
const err_noKey = _("No Api key Provided");

// Summary Errors
const err_wrongKey = _("Wrong API Key");
const err_locError = _("City Not found");
const err_keyBlocked = _("Key Temp. Blocked");
const err_parse = _("Cannot parse weather information :(");
const err_notCityID = _("This is not a city ID");

//----------------------------------------------------------------------
//
// MyApplet
//
//----------------------------------------------------------------------

function MyApplet(metadata, orientation, panelHeight, instanceId) {
    this.settings = new Settings.AppletSettings(this, UUID, instanceId)
    this.log = new Log(instanceId);
    this.currentLocale = GLib.get_language_names()[0];
    this.systemLanguage = this.currentLocale.split('_')[0];

    // Soup session (see https://bugzilla.gnome.org/show_bug.cgi?id=661323#c64)
    this._httpSession = new Soup.SessionAsync();
    Soup.Session.prototype.add_feature.call(this._httpSession, new Soup.ProxyResolverDefault());

    this.provider;  //API

    //////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////
    ///////////                                       ////////////
    ///////////       Weather Data Storage            ////////////
    ///////////                                       ////////////
    //////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////

    // 
    //  If you get the values in these objects correctly with correct units
    //  from a new API, Everything will work as intended.
    //
    this.weather = {
      dateTime: null,           // DateTime object, UTC
      location: {
        city: null,
        country: null,          // Country code
        id: null,               // API Specific ID, not used
        tzOffset: null,          // seconds
        timeZone: null
      },
      coord: {
        lat: 	null,
        lon: null,
      },
      sunrise: null,             // Astronomical Time
      sunset: null,              // Astronomical Time
      wind: {
        speed: null,             // MPS
        degree: null,            // meteorlogical degrees
      },
      main: {
        temperature: null,       // Kelvin
        pressure: null,          // hPa
        humidity: null,          // %
        temp_min: null,          // Kelvin, not used
        temp_max: null,          // Kelvin, not used
        feelsLike: null         // kelvin
      },
      condition: {
        id: null,                // ID, not used
        main: null,              // See condition names
        description: null,       // condition within condition group
        icon: null,              // see GTK icon names
      },
      cloudiness: null,          // %
    }
    
    this.forecasts = [];
    // Store parsed values in unified json,
    // Translation layer is necessary with multiple API choices
    // Init with null, something we can check for

    // a forecast template
    // Same units as weather, create an object like this then push into forecasts array

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
    }

    this.WeatherWindSpeedUnits = {
      KPH: 'kph',
      MPH: 'mph',
      MPS: 'm/s',
      KNOTS: 'Knots'
    }

    ///
    /// Cache
    ///
    this.coordinates = {
      lat: null,
      lon: null
    }
    this.TimeZone = null;
    this.tzOffset = null;

    this.errMsg = { // Error messages to use
      label: {
        generic: _("Error"),
        service: _("Service Error"),
        noKey: _("No Api key Provided"),
        noLoc: _("No Location provided"),
      },
      desc: {
        keyBad: _("Wrong API Key"),
        locBad: _("Wrong Location"),
        locNotFound: _("Location Not found"),
        parse: _("Parsing weather information failed :("),
        keyBlock: _("Key Temp. Blocked"),
        unknown: _("Unknown Error")
      }
    }

    this._init(orientation, panelHeight, instanceId)
}

// Class Declaration
MyApplet.prototype = {
  __proto__: Applet.TextIconApplet.prototype

, refreshAndRebuild: function refreshAndRebuild() {
    this.refreshWeather(false).then(this.rebuild());
  },

    // Override Methods: TextIconApplet
  _init: function _init(orientation, panelHeight, instanceId) {
    Applet.TextIconApplet.prototype._init.call(this, orientation, panelHeight, instanceId)

      // Interface: TextIconApplet
      this.set_applet_icon_name(APPLET_ICON)
      this.set_applet_label(_("..."))
      this.set_applet_tooltip(_("Click to open"))

      // PopupMenu
      this.menuManager = new PopupMenu.PopupMenuManager(this)
      this.menu = new Applet.AppletPopupMenu(this, orientation)
      if (typeof this.menu.setCustomStyleClass === "function")
          this.menu.setCustomStyleClass(STYLE_WEATHER_MENU);
      else
          this.menu.actor.add_style_class_name(STYLE_WEATHER_MENU);
      this.menuManager.addMenu(this.menu)

      //----------------------------------
      // bind settings
      //----------------------------------

      for (let k in KEYS) {
        let key = KEYS[k]
        let keyProp = "_" + key
        this.settings.bindProperty(Settings.BindingDirection.IN, key, keyProp,
                                   this.refreshAndRebuild, null)
      }
      this.settings.bindProperty(Settings.BindingDirection.IN,
                                 "keybinding",
                                 "keybinding",
                                 this._onKeySettingsUpdated,
                                 null)
      Main.keybindingManager.addHotKey(UUID,
                                       this.keybinding,
                                       Lang.bind(this,
                                                 this.on_applet_clicked))

      this.updateIconType()

      this.settings.connect(SIGNAL_CHANGED + WEATHER_USE_SYMBOLIC_ICONS_KEY, Lang.bind(this, function() {
        this.updateIconType()
        this._applet_icon.icon_type = this._icon_type
        this._currentWeatherIcon.icon_type = this._icon_type
        for (let i = 0; i < this._forecastDays; i++) {
          this._forecast[i].Icon.icon_type = this._icon_type
        }
        this.refreshWeather(false)
      }))

      // configuration via context menu is automatically provided in Cinnamon 2.0+
      let cinnamonVersion = Config.PACKAGE_VERSION.split('.')
      let majorVersion = parseInt(cinnamonVersion[0])
      //log("cinnamonVersion=" + cinnamonVersion +  "; majorVersion=" + majorVersion)

      // for Cinnamon 1.x, build a menu item
      if (majorVersion < 2) {
        let itemLabel = _("Settings")
        let settingsMenuItem = new Applet.MenuItem(itemLabel, Gtk.STOCK_EDIT, Lang.bind(this, function() {
            Util.spawnCommandLine(CMD_SETTINGS)
        }))
        this._applet_context_menu.addMenuItem(settingsMenuItem)
      }

      //------------------------------
      // render graphics container
      //------------------------------

      // build menu
      let mainBox = new St.BoxLayout({ vertical: true })
      this.menu.addActor(mainBox)

      //  today's forecast
      this._currentWeather = new St.Bin({ style_class: STYLE_CURRENT })
      mainBox.add_actor(this._currentWeather)

      //  horizontal rule
      this._separatorArea = new St.DrawingArea({ style_class: STYLE_POPUP_SEPARATOR_MENU_ITEM })
      this._separatorArea.width = 200
      this._separatorArea.connect(SIGNAL_REPAINT, Lang.bind(this, this._onSeparatorAreaRepaint))
      mainBox.add_actor(this._separatorArea)

      //  tomorrow's forecast
      this._futureWeather = new St.Bin({ style_class: STYLE_FORECAST })
      mainBox.add_actor(this._futureWeather)

      this.rebuild()

      //------------------------------
      // run
      //------------------------------
      Mainloop.timeout_add_seconds(3, Lang.bind(this, function mainloopTimeout() {
        this.refreshWeather(true)
      }))

      this.orientation = orientation;
      try {
          this.setAllowedLayout(Applet.AllowedLayout.BOTH);
          this.update_label_visible();
      } catch(e) {
          // vertical panel not supported
      }
   },

   locationLookup: function locationLookup() {
    let command = "xdg-open ";
    switch(this._dataService) {
      case DATA_SERVICE.OPEN_WEATHER_MAP:
        Util.spawnCommandLine(command + "https://github.com/linuxmint/cinnamon-spices-applets/tree/master/weather%40mockturtl");
        break;
      default:
        break;
    }
  },

  update_label_visible: function () {
    if (this.orientation == St.Side.LEFT || this.orientation == St.Side.RIGHT)
      this.hide_applet_label(true);
    else
      this.hide_applet_label(false);
  },

  on_orientation_changed: function (orientation) {
      this.orientation = orientation;
      this.refreshWeather()
  },

  // Override Methods: Applet
  _onKeySettingsUpdated: function _onKeySettingsUpdated() {
    if (this.keybinding != null) {
      Main.keybindingManager.addHotKey(UUID,
                                       this.keybinding,
                                       Lang.bind(this,
                                                 this.on_applet_clicked))
    }
  },

  on_applet_clicked: function on_applet_clicked(event) {
    this.menu.toggle()
  },

  _onSeparatorAreaRepaint: function onSeparatorAreaRepaint(area) {
    let cr = area.get_context()
    let themeNode = area.get_theme_node()
    let [width, height] = area.get_surface_size()
    let margin = themeNode.get_length('-margin-horizontal')
    let gradientHeight = themeNode.get_length('-gradient-height')
    let startColor = themeNode.get_color('-gradient-start')
    let endColor = themeNode.get_color('-gradient-end')
    let gradientWidth = (width - margin * 2)
    let gradientOffset = (height - gradientHeight) / 2
    let pattern = new Cairo.LinearGradient(margin, gradientOffset, width - margin, gradientOffset + gradientHeight)

    pattern.addColorStopRGBA(0, startColor.red / 255, startColor.green / 255, startColor.blue / 255, startColor.alpha / 255)
    pattern.addColorStopRGBA(0.5, endColor.red / 255, endColor.green / 255, endColor.blue / 255, endColor.alpha / 255)
    pattern.addColorStopRGBA(1, startColor.red / 255, startColor.green / 255, startColor.blue / 255, startColor.alpha / 255)
    cr.setSource(pattern)
    cr.rectangle(margin, gradientOffset, gradientWidth, gradientHeight)
    cr.fill()
  },

  //----------------------------------------------------------------------
  //
  // Methods
  //
  //----------------------------------------------------------------------

  updateIconType: function updateIconType() {
    this._icon_type = this.settings.getValue(WEATHER_USE_SYMBOLIC_ICONS_KEY) ?
                        St.IconType.SYMBOLIC :
                        St.IconType.FULLCOLOR
  },

  showError: function(title, msg) {
    this.set_applet_label(title);
    this.set_applet_tooltip("Click to open");
    this.set_applet_icon_name("weather-severe-alert");
    this._currentWeatherSunrise.text = msg;
  },

  refreshWeather: async function(recurse) {  
    try {
      // Adding resilience against bad user input
      if (this._location == undefined || this._location == "") {
        this.showError(err_noLocation, "");
        return false;
      }
      this.wipeCurrentData();
      this.wipeForecastData();
      let refreshResult;
      switch(this._dataService) {
        case DATA_SERVICE.OPEN_WEATHER_MAP:
          //
          //  No Timezone information, fetch from geolocation api
          //
          if (this.noApiKey()) {
            this.showError(err_noKey, "");
            return false;
          }
          // Constructing Query
          let forecastQuery = this.getOpenWeatherQueryString(SERVICE.OpenWeatherMap.FORECAST_URL);
          let weatherQuery = this.getOpenWeatherQueryString(SERVICE.OpenWeatherMap.QUERY_URL); 
          if (forecastQuery == "" || weatherQuery == "") {  // Couldn't construct query, abort
          this.log.Error("Location provided in an incorrect format");
            return false;
          }
          refreshResult = await this.getOpenWeatherCurrentWeather(weatherQuery);
          // get timezone if location changed, needed for processing forecasts
          if (this.coordinates.lat == null || this.coordinates.lat != this.weather.coord.lat || this.coordinates.lon != this.weather.coord.lon) {
            //this.TimeZone =
            //this.tzoffset = 
          }
          refreshResult = await this.getOpenWeatherForecast(forecastQuery);
          break;
        case DATA_SERVICE.DARK_SKY:
          //
          // No City and Country information, fetch from geolocation api
          //
          this.provider = new darkSky.DarkSky(this);
          refreshResult = await this.provider.GetWeather();
          break;
        case DATA_SERVICE.OPEN_WEATHER_MAP_PRE:
          this.provider = new openWeatherMap.OpenWeatherMap(this);
          refreshResult = await this.provider.GetWeather();
          break;
        default:
          return;
      }

      if (!refreshResult) {           // Failed
        this.log.Error("Unable to obtain Weather Information");
        Mainloop.timeout_add_seconds(30, Lang.bind(this, function mainloopTimeout() {
          this.refreshWeather(false);
        }));
        return;
      }

      this.displayWeather();
      this.displayForecast();
      this.log.Print("Weather Information refreshed");
    }
    catch(e) {  // Never break Main loop!!!!
      this.log.Error("Error while refreshing Weather info: " + e);
    }

    if (recurse) {
      Mainloop.timeout_add_seconds(this._refreshInterval * 60, Lang.bind(this, function() {
        this.refreshWeather(true)
      }))
    }
    return;
  },

  displayWeather: async function() {
    try {
      let mainCondition = "";
      let descriptionCondition = "";
      // Short Condition Name
      if (this.weather.condition.main != null) {
        mainCondition = this.weather.condition.main;
        if (this._translateCondition) {
          mainCondition = _(mainCondition);
        }
      }
      // Condition Description
      if (this.weather.condition.description != null) {
        descriptionCondition = this.capitalizeFirstLetter(this.weather.condition.description);
        if (this._translateCondition) {
          descriptionCondition = _(descriptionCondition);
        }
      }

      // Displaying Location   
      let location = "";
      if (this.weather.location.city != null && this.weather.location.country != null) {
        location = this.weather.location.city + ", " + this.weather.location.country;
        if (this.nonempty(this._locationLabelOverride)) {
          location = this._locationLabelOverride;
        }
      }
  
      this.set_applet_tooltip(location);

      // Weather Condition
      this._currentWeatherSummary.text = descriptionCondition;

      // Weather icon
      let iconname = this.weather.condition.icon;
      if (iconname == null) {
        iconname = "weather-severe-alert";
      }
      this._currentWeatherIcon.icon_name = iconname
      this._icon_type == St.IconType.SYMBOLIC ?
        this.set_applet_icon_symbolic_name(iconname) :
        this.set_applet_icon_name(iconname)

      // Temperature
      let temp = "";
      if (this.weather.main.temperature != null) {
        temp = this.TempToUserUnits(this.weather.main.temperature);
        this._currentWeatherTemperature.text = temp + ' ' + this.unitToUnicode();
        this.log.Debug("Temperature: " + this.weather.main.temperature + " Kelvin is converted to " + temp + ' ' + this.unitToUnicode());
      }

      // Set Applet Label, even if the variables are empty
      let label = "";
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
      } catch(e) {
          // vertical panel not supported
      }

      // Displaying humidity
      if (this.weather.main.humidity !=  null) {
        this._currentWeatherHumidity.text = this.weather.main.humidity + "%";
      }
      
      // Wind
      let wind_direction = this.compassDirection(this.weather.wind.degree);
      this._currentWeatherWind.text = ((wind_direction != undefined) ? wind_direction + ' ' : '') + this.MPStoUserUnits(this.weather.wind.speed) + ' ' + _(this._windSpeedUnit);
    
      // API Unique display
      switch (this._dataService) {
        case DATA_SERVICE.OPEN_WEATHER_MAP:
          if (this.weather.cloudiness != null) {
            this._currentWeatherApiUnique.text = this.weather.cloudiness + "%";
            this._currentWeatherApiUniqueCap.text = _("Cloudiness:");
          }
          break;
        case DATA_SERVICE.OPEN_WEATHER_MAP_PRE:
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
      
      // Pressure
      if (this.weather.main.pressure != null) {
        this._currentWeatherPressure.text = this.PressToUserUnits(this.weather.main.pressure) + ' ' + _(this._pressureUnit);
      }

      // location is a button
      // No URL is provided, disable it for now
      //this._currentWeatherLocation.url = tmp.length > 1 ? tmp[1] : tmp[0];
      this._currentWeatherLocation.label = location;

      // Sunset/Sunrise
      // gettext can't see these inline
      let sunriseText = "";
      let sunsetText = "";
      if (this.weather.sunrise != null && this.weather.sunset != null) {
        if (this._showSunrise) {
          sunriseText = _('Sunrise');
          sunsetText = _('Sunset');
          if (this.weather.timeZone != null) {     //have TZ, en-GB returns time in the correct format
              let sunrise = this.weather.sunrise.toLocaleString("en-GB", {timeZone: this.weather.timeZone, hour: "2-digit", minute: "2-digit"});
              let sunset = this.weather.sunrise.toLocaleString("en-GB", {timeZone: this.weather.timeZone, hour: "2-digit", minute: "2-digit"});
              sunriseText = (sunriseText + ': ' + this.timeToUserUnits(sunrise));
              sunsetText = (sunsetText + ': ' + this.timeToUserUnits(sunset));
          }
          else {   // else We assume that System TZ and Location TZ is same, covers 95% of users   
            sunriseText = (sunriseText + ': ' + this.timeToUserUnits(this.weather.sunrise.toLocaleFormat('%H:%M')));
            sunsetText = (sunsetText + ': ' + this.timeToUserUnits(this.weather.sunset.toLocaleFormat('%H:%M')));
          }         
        }
      }
      
      this._currentWeatherSunrise.text = sunriseText;
      this._currentWeatherSunset.text = sunsetText;
      return true;
    }
    catch(e) {
      this.log.Error("DisplayWeatherError: " + e);
      return false;
    }
  },

  displayForecast: async function() {
    try {
      for (let i = 0; i < this._forecast.length; i++) {
        let forecastData = this.forecasts[i];
        let forecastUi = this._forecast[i];

        let t_low = this.TempToUserUnits(forecastData.main.temp_min);
        let t_high = this.TempToUserUnits(forecastData.main.temp_max);

        let first_temperature = this._temperatureHighFirst ? t_high : t_low;
        let second_temperature = this._temperatureHighFirst ? t_low : t_high;
        let comment = "";
        if (forecastData.condition.main != null && forecastData.condition.description != null) {
          if (this._shortConditions) {
            comment = _(this.capitalizeFirstLetter(forecastData.condition.main));
          }
          else {
            comment = _(this.capitalizeFirstLetter(forecastData.condition.description));
          }
        }
        let dayName = forecastData.dateTime;
        if (this.weather.timeZone != null) {
           dayname = this.weather.sunrise.toLocaleString("en-GB", {timeZone: this.weather.timeZone, weekday: "long"});
        }
        else {
          dayName.setMilliseconds(dayName.getMilliseconds() + (this.weather.location.tzOffset * 1000));
          dayName = this.getDayName(dayName.getUTCDay());
        }       
        
        forecastUi.Day.text = dayName;
        forecastUi.Temperature.text = first_temperature + ' ' + '\u002F' + ' ' + second_temperature + ' ' + this.unitToUnicode();
        forecastUi.Summary.text = comment;
        forecastUi.Icon.icon_name = forecastData.condition.icon;
      }
      return true;
    }
    catch(e) {
      this.log.Error("DisplayForecastError" + e);
      return false;
    }
  },

  wipeCurrentData: function() {
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

  wipeForecastData: function() {
    this.forecasts = [];
  },

  destroyCurrentWeather: function destroyCurrentWeather() {
    if (this._currentWeather.get_child() != null)
      this._currentWeather.get_child().destroy()
  }

, destroyFutureWeather: function destroyFutureWeather() {
    if (this._futureWeather.get_child() != null)
      this._futureWeather.get_child().destroy()
  }

, showLoadingUi: function showLoadingUi() {
    this.destroyCurrentWeather()
    this.destroyFutureWeather()
    this._currentWeather.set_child(new St.Label({ text: _('Loading current weather ...') }))
    this._futureWeather.set_child(new St.Label({ text: _('Loading future weather ...') }))
  }

, rebuild: function rebuild() {
    this.showLoadingUi()
    this.rebuildCurrentWeatherUi()
    this.rebuildFutureWeatherUi()
  }

, rebuildCurrentWeatherUi: function rebuildCurrentWeatherUi() {
    this.destroyCurrentWeather()

    // This will hold the icon for the current weather
    this._currentWeatherIcon = new St.Icon({
      icon_type: this._icon_type,
      icon_size: 64,
      icon_name: APPLET_ICON,
      style_class: STYLE_ICON
    })

    // The summary of the current weather
    this._currentWeatherSummary = new St.Label({
      text: _('Loading ...'),
      style_class: STYLE_SUMMARY
    })

    this._currentWeatherLocation = new St.Button({
      reactive: true,
      label: _('Refresh')
    })

    this._currentWeatherLocation.style_class = STYLE_LOCATION_LINK

    // link to the details page
    this._currentWeatherLocation.connect(SIGNAL_CLICKED, Lang.bind(this, function() {
      if (this._currentWeatherLocation.url == null) {
        this.refreshWeather(false)
      } else {
        Gio.app_info_launch_default_for_uri(
          this._currentWeatherLocation.url,
          global.create_app_launch_context()
        )
      }
    }))

    let bb = new St.BoxLayout({
      vertical: true,
      style_class: STYLE_SUMMARYBOX
    })
    bb.add_actor(this._currentWeatherLocation)
    bb.add_actor(this._currentWeatherSummary)


    let textOb = { text: ELLIPSIS }
    this._currentWeatherSunrise = new St.Label(textOb)
    this._currentWeatherSunset = new St.Label(textOb)

    let ab = new St.BoxLayout({
      style_class: STYLE_ASTRONOMY
    })

    ab.add_actor(this._currentWeatherSunrise)
    let ab_spacerlabel = new St.Label({ text: BLANK })
    ab.add_actor(ab_spacerlabel)
    ab.add_actor(this._currentWeatherSunset)

    let bb_spacerlabel = new St.Label({ text: BLANK })
    bb.add_actor(bb_spacerlabel)
    bb.add_actor(ab)

    // Other labels
    this._currentWeatherTemperature = new St.Label(textOb)
    this._currentWeatherHumidity = new St.Label(textOb)
    this._currentWeatherPressure = new St.Label(textOb)
    this._currentWeatherWind = new St.Label(textOb)
    this._currentWeatherApiUnique = new St.Label({text: ''})

    // APi Unique Caption
    this._currentWeatherApiUniqueCap = new St.Label({text: ''});
    let rb = new St.BoxLayout({
      style_class: STYLE_DATABOX
    })
    let rb_captions = new St.BoxLayout({
      vertical: true,
      style_class: STYLE_DATABOX_CAPTIONS
    })
    let rb_values = new St.BoxLayout({
      vertical: true,
      style_class: STYLE_DATABOX_VALUES
    })
    rb.add_actor(rb_captions)
    rb.add_actor(rb_values)

    rb_captions.add_actor(new St.Label({text: _('Temperature:')}))
    rb_values.add_actor(this._currentWeatherTemperature)
    rb_captions.add_actor(new St.Label({text: _('Humidity:')}))
    rb_values.add_actor(this._currentWeatherHumidity)
    rb_captions.add_actor(new St.Label({text: _('Pressure:')}))
    rb_values.add_actor(this._currentWeatherPressure)
    rb_captions.add_actor(new St.Label({text: _('Wind:')}))
    rb_values.add_actor(this._currentWeatherWind)
    rb_captions.add_actor(this._currentWeatherApiUniqueCap);
    rb_values.add_actor(this._currentWeatherApiUnique)

    let xb = new St.BoxLayout()
    xb.add_actor(bb)
    xb.add_actor(rb)

    let box = new St.BoxLayout({
      style_class: STYLE_ICONBOX
    })
    box.add_actor(this._currentWeatherIcon)
    box.add_actor(xb)
    this._currentWeather.set_child(box)
  },

  rebuildFutureWeatherUi: function() {
    this.destroyFutureWeather();

    this._forecast = []
    this._forecastBox = new St.BoxLayout({ vertical: this._verticalOrientation })
    this._futureWeather.set_child(this._forecastBox)

    for (let i = 0; i < this._forecastDays; i++) {
      let forecastWeather = {}

      forecastWeather.Icon = new St.Icon({
        icon_type: this._icon_type,
        icon_size: 48,
        icon_name: APPLET_ICON,
        style_class: STYLE_FORECAST_ICON
      })
      forecastWeather.Day = new St.Label({
        style_class: STYLE_FORECAST_DAY
      })
      forecastWeather.Summary = new St.Label({
        style_class: STYLE_FORECAST_SUMMARY
      })
      forecastWeather.Temperature = new St.Label({
        style_class: STYLE_FORECAST_TEMPERATURE
      })

      let by = new St.BoxLayout({
        vertical: true,
        style_class: STYLE_FORECAST_DATABOX
      })
      by.add_actor(forecastWeather.Day)
      by.add_actor(forecastWeather.Summary)
      by.add_actor(forecastWeather.Temperature)

      let bb = new St.BoxLayout({
        style_class: STYLE_FORECAST_BOX
      })
      bb.add_actor(forecastWeather.Icon)
      bb.add_actor(by)

      this._forecast[i] = forecastWeather
      this._forecastBox.add_actor(bb)
    }
  },

  //----------------------------------------------------------------------
  //
  // Utility functions
  //
  //----------------------------------------------------------------------

  noApiKey: function() {
    if (this._apiKey == undefined || this._apiKey == "") {
      return true;
    }
    return false;
  },

  capitalizeFirstLetter: function (description) {
    if ((description == undefined || description == null)) {
      return "";
    }
    return description.charAt(0).toUpperCase() + description.slice(1);
  },

  // Takes Time in %H:%M string format
  timeToUserUnits: function(time) {
    time = time.split(':');
    //Remove Leading 0
    if (time[0].charAt(0) == "0") {
      time[0] = time[0].substr(1);
    }
    //Returnt Time based on user preference
    if(this._show24Hours) {
      return time[0] + ":" + time[1];
    }
    else {
      if (time[0] > 12) { // PM
        return (time[0] - 12) + ":" + time[1] + " Pm";
      }
      else { //AM
        return time[0] + ":" + time[1] + " Am";
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
          return Math.round ((mps * WEATHER_CONV_MPH_IN_MPS) * 10)/ 10;
        case this.WeatherWindSpeedUnits.KPH:
          //Rounding to 1 decimal
          return Math.round ((mps * WEATHER_CONV_KPH_IN_MPS) * 10)/ 10;
        case this.WeatherWindSpeedUnits.MPS:
          // Rounding to 1 decimal just in case API does not return it in the same format
          return Math.round (mps * 10)/ 10;
        case this.WeatherWindSpeedUnits.KNOTS:
          //Rounding to whole units
          return Math.round (mps * WEATHER_CONV_KNOTS_IN_MPS);
      }
  },

  // Conversion from Kelvin
  TempToUserUnits: function(kelvin) {
    if (this._temperatureUnit == this.WeatherUnits.CELSIUS) {
      return Math.round((kelvin  - 273.15));
    }
    if (this._temperatureUnit == this.WeatherUnits.FAHRENHEIT) {
      return Math.round((9/5*(kelvin - 273.15) + 32));
    }
  },

  CelsiusToKelvin: function(celsius) {
    return (celsius + 273.15);
  },

  FahrenheitToKelvin: function(fahr) {
    return ((fahr-32) / 1.8 + 273.15);
  },

  MPHtoMPS: function(speed) {
    return speed * 0.44704;
  },

  // Conversion from hPa
  PressToUserUnits: function(hpa) {
    switch (this._pressureUnit) {
      case WeatherPressureUnits.HPA:
        return hpa;
      case WeatherPressureUnits.AT:
        return Math.round((hpa * 0.001019716) * 1000)/ 1000;
      case WeatherPressureUnits.ATM:
        return Math.round((hpa * 0.0009869233) * 1000)/ 1000;
      case WeatherPressureUnits.INHG:
        return Math.round((hpa * 0.029529983071445) * 10)/ 10;
      case WeatherPressureUnits.MMHG:
        return Math.round((hpa * 0.7500638));
      case WeatherPressureUnits.MBAR:
        return Math.round((hpa * 0.029529983071445) * 10)/ 10;
      case WeatherPressureUnits.PA:
        return Math.round((hpa * 100));
      case WeatherPressureUnits.PSI:
        return Math.round((hpa * 0.01450377) * 100) / 100;
    }
  },

  isNumeric: function(n) {
    return !isNaN(parseFloat(n)) && isFinite(n);
  },

  isString: function(text) {
    if(typeof text == 'string' || text instanceof String) {
      return true;
    }
    return false;
  },

  isID: function(text) {
    return this.isNumeric(text);
  },

  isLocation: function(text) {
    text = text.split(',');
    if (text.length != 2) {
      return false;
    }

    if (this.isString(text[0]) && this.isString(text[1])) {
      return true;
    }
    return false;
  },

  isCoordinate: function(text) {
    text = text.split(',');
    if (text.length != 2) {
      return false;
    }
    if (this.isNumeric(text[0]) && this.isNumeric(text[1])) {
      return true;
    }
    return false;
  },

  unitToUnicode: function() {
    return this._temperatureUnit == this.WeatherUnits.FAHRENHEIT ? '\u2109' : '\u2103'
  }
    // Passing appropriate resolver function for the API, and the code
, weatherIconSafely: function(code, iconResolver) {
    let iconname = iconResolver(code);
    for (let i = 0; i < iconname.length; i++) {
      if (this.hasIcon(iconname[i]))
        return iconname[i]
    }
    return 'weather-severe-alert'
  }

, hasIcon: function(icon) {
    return Gtk.IconTheme.get_default().has_icon(icon + (this._icon_type == St.IconType.SYMBOLIC ? '-symbolic' : ''))
  }

, nonempty: function(str) {
    return (str != null && str.length > 0)
  },

  getDayName: function(dayNum) {
    let days = [_('Sunday'), _('Monday'), _('Tuesday'), _('Wednesday'), _('Thursday'), _('Friday'), _('Saturday')]
    return days[dayNum];
  },
  
  compassDirection: function(deg) {
    let directions = [_('N'), _('NE'), _('E'), _('SE'), _('S'), _('SW'), _('W'), _('NW')]
    return directions[Math.round(deg / 45) % directions.length]
  },

//////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////
///////////                                       ////////////
///////////       OpenWeatherMap Functions        ////////////
///////////                                       ////////////
//////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////

  getOpenWeatherCurrentWeather: async function(query) {  
    // Can use Synchronous calls, we are already in async
    this.log.Debug(query);
    let json;
    try {
      let message = Soup.Message.new('GET', query);
      this._httpSession.send_message(message);
      json =  JSON.parse(message.response_body.data);
    }
    catch(e) {
      this.log.Error("Unable to Call API: " + e);
      return false;
    }
    if (this.isOpenWeatherResponseValid(json)) {
      return this.parseOpenWeather(json);
    }
    return false;
  },

  getOpenWeatherForecast: async function(query) {
    this.log.Debug(query);
    let json;
    try {
      let message = Soup.Message.new('GET', query);
      this._httpSession.send_message(message);
      json =  JSON.parse(message.response_body.data);
    }
    catch (e) {
      this.log.Error("Unable to Call API: " + e);
      return false;
    }
    if (this.isOpenWeatherResponseValid(json)) {
      return this.parseOpenWeatherForecast(json);
    }     
    return false;
  },

  isOpenWeatherResponseValid: function(response) {
    if (!response) {
      this.showError(err_noService, "");
      return false;
    }
    let errorMsg = "OpenWeatherMap API: ";
    if (response.cod != 200) {
      
      if (response.cod == 400) {
        this.showError(err_service, err_notCityID);
      }
      if (response.cod == 401) {
        this.showError(err_service, err_wrongKey);
      }
      if (response.cod == 404) {
        this.showError(err_service, err_locError);
      }
      if (response.cod == 429) {
        this.showError(err_service, err_keyBlocked);
      }
      this.log.Error(errorMsg + response.message);
      return false;
    }
    return true;      
  },

  parseOpenWeather: function(json) {
    try {
      if (json.coord) {
        this.weather.coord.lat = json.coord.lat;
        this.weather.coord.lon = json.coord.lon;
        this.weather.location.tzOffset = Math.round(json.coord.lon/15) * 3600;
      }
      this.weather.location.city = json.name;
      this.weather.location.country = json.sys.country;
      // Keep UTC for now, it is converted to Locale what covers most of the users
      // Need proper fix later
      this.weather.dateTime = new Date((json.dt) * 1000);
      this.log.Debug(this.weather.dateTime.toUTCString());
      this.weather.sunrise = new Date((json.sys.sunrise) * 1000);
      this.weather.sunset = new Date((json.sys.sunset) * 1000);
      if (json.wind) {
        this.weather.wind.speed = json.wind.speed;
        this.weather.wind.degree = json.wind.deg;
      }
      if (json.main) {
        this.weather.main.temperature = json.main.temp;
        this.weather.main.pressure = json.main.pressure;
        this.weather.main.humidity = json.main.humidity;
        this.weather.main.temp_min = json.main.temp_min;
        this.weather.main.temp_max = json.main.temp_max;
      }
      if (json.weather[0]) {
        this.weather.condition.main = json.weather[0].main;
        this.weather.condition.description = json.weather[0].description;
        this.weather.condition.icon = this.weatherIconSafely(json.weather[0].icon, this.resolveOpenWeatherIcon); 
      }
      if (json.clouds) {
        this.weather.cloudiness = json.clouds.all;
      }   
      return true; 
    }
    catch(e) { 
      this.log.Error(e);
      this.showError(err_parseLabel, err_parse);
      return false; 
    }
  },

  parseOpenWeatherForecast: function(json) {
    try {
      // We have to Compile Day data manually because
      // we get 8 json blobs per day 
      let prevItemDate = 35;  // initialise to safe value so it never equals for the first time
      let counter = 0;       // Start counter, incremented for new days

      let forecast;
      this.weather.location.tzOffset = Math.round(json.city.coord.lon/15) * 3600;
      for (let i = 0; i < json.list.length; i++) {
        let currentDate = new Date((json.list[i].dt + this.weather.location.tzOffset) * 1000); // Check its correctness in different tz-s
        // If a item belongs to a new day, push forecast to the array and reset it.
        if (currentDate.getUTCDate() != prevItemDate) {
          counter++;
          if (forecast != undefined) {
            this.forecasts.push(forecast);
          } 
          forecast = {          // Blob Init
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
          };
          // Set safe values for min/max to work properly
          forecast.main.temp_min = 900;
          forecast.main.temp_max = -5; 
          // Return and display when we have got the required number of days
          if (counter > this._forecastDays) {
            return true;
          }    
        }
        forecast.dateTime = currentDate; // Time does not matter as long as its the same day
        // Get min max temperatures for the day
        if (json.list[i].main) {
          forecast.main.temp_min = Math.min(forecast.main.temp_min, json.list[i].main.temp_min);
          forecast.main.temp_max = Math.max(forecast.main.temp_max, json.list[i].main.temp_max);
        }
        // Get the worst weather conditions for the day
        if (json.list[i].weather[0]) {
          if (json.list[i].weather[0].id == this.getMoreSevereWeather(json.list[i].weather[0].id, forecast.condition.id)) {     
            forecast.condition.id = json.list[i].weather[0].id;
            forecast.condition.main = json.list[i].weather[0].main;
            forecast.condition.description = json.list[i].weather[0].description;
            // Replace night icons with day icons for the forecasts
            if ((json.list[i].weather[0].icon).endsWith("n")) {
              json.list[i].weather[0].icon = json.list[i].weather[0].icon.replace('n', 'd');
            }
            forecast.condition.icon = this.weatherIconSafely(json.list[i].weather[0].icon, this.resolveOpenWeatherIcon);
          }
      }
        prevItemDate = currentDate.getUTCDate();
      }
      // Ran out of items, display
      this.forecasts.push(forecast);
      forecast = {};
      return true;
    }
    catch(e) {
      this.log.Error(e);
      this.showError(err_parseLabel, err_parse);
      return false;
    }
  },

  getOpenWeatherQueryString: function(url) {
    let APIKey = this._apiKey;
    let loc = this._location;
    let query = "";
    if (this.isCoordinate(loc)) {
      let location = loc.replace(/ /g,'').split(',');
      query = url + "lat=" + location[0] + "&lon=" + location[1] + "&APPID=" + APIKey;
    }
    else if (this.isLocation(loc)) {
      loc = loc.split(',');
      query = url + "q=" + loc[0].trim() + "," + loc[1].trim() + "&APPID=" + APIKey;
    }
    else if (this.isID(loc)) {
      query = url + "id=" + loc + "&APPID=" + APIKey;
    }
    else { //bad string
      query = "";
    }

    if (query == "") { //If couldn't construct string, return it empty
      return query;
    }
    if (this._translateCondition && this.isLangSupported(this.systemLanguage, OWsupported)) { // Append Language if supported and enabled
      query = query + "&lang=" + this.systemLanguage;
    }
    return query;
  },

  getMoreSevereWeather: function(newID, prevId) {
    // https://openweathermap.org/weather-conditions
    // get the more severe weather
    if (prevId == null) {
      prevId = 900;      //Set safe value to compare correctly
    }

    // if new number first digit is smaller, return that
    if (parseInt(String(newID).substring(0, 1)) < parseInt(String(prevId).substring(0, 1))) { 
      return newID;
    }
    //if same category, return higher one
    else if (parseInt(String(newID).substring(0, 1)) == parseInt(String(prevId).substring(0, 1))) {
      if (newID > prevId) {
        return newID;
      }
      else {
        return prevId;
      }
    }
    else {
      return prevId;  // old number is higher
    }
  },

  isLangSupported: function(lang, languages) {
      if (languages.indexOf(lang) != -1) {
        return true;
      }
      return false;
  },

  resolveOpenWeatherIcon: function(iconId) {
    // https://openweathermap.org/weather-conditions
        /* fallback icons are: weather-clear-night 
        weather-clear weather-few-clouds-night weather-few-clouds 
        weather-fog weather-overcast weather-severe-alert weather-showers 
        weather-showers-scattered weather-snow weather-storm */
    switch (iconId) {
      case "10d":/* rain day */
        return ['weather-rain', 'weather-showers-scattered', 'weather-freezing-rain']
      case "10n":/* rain night */
        return ['weather-rain', 'weather-showers-scattered', 'weather-freezing-rain']
      case "09n":/* showers nigh*/
        return ['weather-showers']
      case "09d":/* showers day */
        return ['weather-showers']
      case "13d":/* snow day*/
        return ['weather-snow']
      case "13n":/* snow night */
        return ['weather-snow']
      case "50d":/* mist day */
        return ['weather-fog']
      case "50n":/* mist night */
        return ['weather-fog']
      case "04d":/* broken clouds day */
        return ['weather_overcast', 'weather-clouds', "weather-few-clouds"]
      case "04n":/* broken clouds night */
        return ['weather_overcast', 'weather-clouds', "weather-few-clouds-night"]
      case "03n":/* mostly cloudy (night) */
        return ['weather-clouds-night', 'weather-few-clouds-night']
      case "03d":/* mostly cloudy (day) */
        return ['weather-clouds', 'weather-overcast', 'weather-few-clouds']
      case "02n":/* partly cloudy (night) */
        return ['weather-few-clouds-night']
      case "02d":/* partly cloudy (day) */
        return ['weather-few-clouds']
      case "01n":/* clear (night) */
        return ['weather-clear-night']
      case "01d":/* sunny */
        return ['weather-clear']
      case "11d":/* storm day */
        return ['weather-storm']
      case "11n":/* storm night */
        return ['weather-storm']
      default:
        return ['weather-severe-alert']
    }
  }
};

const OWsupported = ["ar", "bg", "ca", "cz", "de", "el", "en", "fa", "fi",
     "fr", "gl", "hr", "hu", "it", "ja", "kr", "la", "lt", "mk", "nl", "pl",
      "pt", "ro", "ru", "se", "sk", "sl", "es", "tr", "ua", "vi", "zh_cn", "zh_tw"];

//
// For Translators
//

const shortConditionLibrary = [_("Clouds"), _("Mist"), _("Thunderstorm"), _("Rain"), _("Snow"), _("Drizzle"), _("Haze"), _("Sleet"),
_("Smoke"), _("Fog"), _("Sand"), _("Dust"), _("Sqalls"), _("Tornado"), _("Volcanic ash"), _("Clear Sky"), _("Sky is clear")];

const icons = {
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
}

//----------------------------------------------------------------------
//
// Entry point
//
//----------------------------------------------------------------------

function main(metadata, orientation, panelHeight, instanceId) {
  //log("v" + metadata.version + ", cinnamon " + Config.PACKAGE_VERSION)
  return new MyApplet(metadata, orientation, panelHeight, instanceId)
}

