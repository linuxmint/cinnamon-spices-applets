"use strict";

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

"use strict";

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

const DATA_SERVICE = {
  OPEN_WEATHER_MAP: "OpenWeatherMap"
}

// Query
const SERVICE = {
  "OpenWeatherMap": {
    QUERY_URL : "https://api.openweathermap.org/data/2.5/weather?",
    FORECAST_URL: "https://api.openweathermap.org/data/2.5/forecast/daily?"
  },
};


// Schema keys
const WEATHER_LOCATION = "location"
const WEATHER_DATA_SERVICE = "dataService"
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

const KEYS = [,
  WEATHER_LOCATION,
  WEATHER_DATA_SERVICE,
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
  WEATHER_PRESSURE_UNIT_KEY
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

const WeatherUnits = {
  CELSIUS: 'celsius',
  FAHRENHEIT: 'fahrenheit'
}

const WeatherWindSpeedUnits = {
  KPH: 'kph',
  MPH: 'mph',
  MPS: 'm/s',
  KNOTS: 'Knots'
}

const WeatherPressureUnits = {
  HPA: 'hPa',
  MMHG: 'mm Hg',
  INHG: 'in Hg',
  PA: 'Pa',
  PSI: 'psi',
  ATM: 'atm',
  AT: 'at'
}

// Pressure conversion factors
const WEATHER_CONV_KPA_IN_MBAR = 0.1
const WEATHER_CONV_PA_IN_MBAR = 100
const WEATHER_CONV_MMHG_IN_MBAR = 750.0615613e-3
const WEATHER_CONV_INHG_IN_MBAR = 2.952998307e-2
const WEATHER_CONV_AT_IN_MBAR = 1.019716213e-3
const WEATHER_CONV_ATM_IN_MBAR = 0.986923169e-3
const WEATHER_CONV_PSI_IN_MBAR = 14.5037738e-3

const WEATHER_CONV_MBAR_IN_INHG = 3.3863886667e+1
const WEATHER_CONV_KPA_IN_INHG = 3.386389
const WEATHER_CONV_PA_IN_INHG = 3.386389e+3
const WEATHER_CONV_MMHG_IN_INHG = 25.4
const WEATHER_CONV_PSI_IN_INHG = 491.154152e-3
const WEATHER_CONV_AT_IN_INHG = 34.531554e-3
const WEATHER_CONV_ATM_IN_INHG = 33.421054e-3

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

// Store parsed values in unified json,
// Translation layer is necessary with multiple API choices
// Init with null, something we can check for
var weather = {
  dateTime: null,           // DateTime object, UTC
  location: {
    city: null,
    country: null,          // Country code
    id: null,               // API Specific ID, not used
    tzOffset: null,          // seconds
    timezone: null
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
  },
  condition: {
    id: null,                // ID, not used
    main: null,              // See condition names
    description: null,       // condition within condition group
    icon: null,              // see GTK icon names
  },
  cloudiness: null,          // %
}

var forecasts = [];

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

//----------------------------------------------------------------------
//
// Soup
//
//----------------------------------------------------------------------

// Soup session (see https://bugzilla.gnome.org/show_bug.cgi?id=661323#c64)
const _httpSession = new Soup.SessionAsync()
Soup.Session.prototype.add_feature.call(_httpSession, new Soup.ProxyResolverDefault())


//----------------------------------------------------------------------
//
// Logging
//
//----------------------------------------------------------------------

function log(message) {
  global.log(UUID + "#" + log.caller.name + ": " + message)
}

function logError(error) {
  global.logError(UUID + "#" + logError.caller.name + ": " + error)
}

//----------------------------------------------------------------
//
// l10n
//
//----------------------------------------------------------------------

const GLib = imports.gi.GLib
const Gettext = imports.gettext
Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale")
const language = GLib.get_language_names()[0].split('_')[0];

function _(str) {
  return Gettext.dgettext(UUID, str)
}

//----------------------------------------------------------------------
//
// MyApplet
//
//----------------------------------------------------------------------

function MyApplet(metadata, orientation, panelHeight, instanceId) {
  this.settings = new Settings.AppletSettings(this, UUID, instanceId)
  // Displaying forecasts from here
  this._init(orientation, panelHeight, instanceId)
}

MyApplet.prototype = {
  __proto__: Applet.TextIconApplet.prototype

, refreshAndRebuild: function refreshAndRebuild() {
    this.refreshWeather(false)
    this.rebuild()
  },

  dumpKeys: function dumpKeys() {
    for (let k in KEYS) {
      let key = KEYS[k]
      let keyProp = "_" + key
      log(keyProp + "=" + this[keyProp])
    }
  },

  locationLookup: function locationLookup() {
    let command = "xdg-open ";
    Util.spawnCommandLine(command + "https://github.com/linuxmint/cinnamon-spices-applets/tree/master/weather%40mockturtl");
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
      //log("bound settings")

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
   }

, update_label_visible: function () {
    if (this.orientation == St.Side.LEFT || this.orientation == St.Side.RIGHT)
      this.hide_applet_label(true);
    else
      this.hide_applet_label(false);
  }

, on_orientation_changed: function (orientation) {
      this.orientation = orientation;
      this.refreshWeather()
  }

  // Override Methods: Applet
, _onKeySettingsUpdated: function _onKeySettingsUpdated() {
    if (this.keybinding != null) {
      Main.keybindingManager.addHotKey(UUID,
                                       this.keybinding,
                                       Lang.bind(this,
                                                 this.on_applet_clicked))
    }
  }

, on_applet_clicked: function on_applet_clicked(event) {
    this.menu.toggle()
  }

, _onSeparatorAreaRepaint: function onSeparatorAreaRepaint(area) {
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
  }

  //----------------------------------------------------------------------
  //
  // Methods
  //
  //----------------------------------------------------------------------

, updateIconType: function updateIconType() {
    this._icon_type = this.settings.getValue(WEATHER_USE_SYMBOLIC_ICONS_KEY) ?
                        St.IconType.SYMBOLIC :
                        St.IconType.FULLCOLOR
  }

, loadJsonAsync: function loadJsonAsync(url, callback) {
    let context = this
    let message = Soup.Message.new('GET', url)
    _httpSession.queue_message(message, function soupQueue(session, message) {
      callback.call(context, JSON.parse(message.response_body.data))
    })
  },

  displayLabelError: function(errorMsg) {
    this.set_applet_label(errorMsg);
    this.set_applet_tooltip("Click to open");
    this.set_applet_icon_name("");
  },

  refreshWeather: function refreshWeather(recurse) {  
    // Adding resilience against bad user input
    if (this._location == undefined || this._location == "") {
      this.displayLabelError(_("No location provided"));
      return false;
    }
    switch(this._dataService) {
      case DATA_SERVICE.OPEN_WEATHER_MAP: 
        this.getOpenWeatherCurrentWeather();
        this.getOpenWeatherForecast();
        break;
      default:
        return false;
    }
    if (recurse) {
      Mainloop.timeout_add_seconds(this._refreshInterval * 60, Lang.bind(this, function() {
        this.refreshWeather(true)
      }))
    }
  },

  displayWeather: function() {
    let mainCondition = "";
    let descriptionCondition = "";
    // Short Condition Name
    if (weather.condition.main != null) {
      mainCondition = weather.condition.main;
      if (this._translateCondition) {
        mainCondition = _(mainCondition);
      }
    }
    // Condition Description
    if (weather.condition.description != null) {
      descriptionCondition = this.capitalizeFirstLetter(weather.condition.description);
      if (this._translateCondition) {
        descriptionCondition = _(descriptionCondition);
      }
    }

    // Displaying Location   
    let location = "";
    if (weather.location.city != null && weather.location.country != null) {
      location = weather.location.city + ", " + weather.location.country;
    }
    if (this.nonempty(this._locationLabelOverride)) {
      location = this._locationLabelOverride;
    }
    this.set_applet_tooltip(location);

    // Weather Condition
    this._currentWeatherSummary.text = descriptionCondition;

    // Weather icon
    let iconname = weather.condition.icon;
    if (iconname == null) {
      iconname = "weather-severe-alert";
    }
    this._currentWeatherIcon.icon_name = iconname
    this._icon_type == St.IconType.SYMBOLIC ?
      this.set_applet_icon_symbolic_name(iconname) :
      this.set_applet_icon_name(iconname)

    // Temperature
    let temp = "";
    if (weather.main.temperature != null) {
      temp = this.TempToUserUnits(weather.main.temperature);
      this._currentWeatherTemperature.text = temp + ' ' + this.unitToUnicode();
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
    if (weather.main.humidity !=  null) {
      this._currentWeatherHumidity.text = weather.main.humidity + "%";
    }
    
    // Wind
    let wind_direction = this.compassDirection(weather.wind.degree);
    this._currentWeatherWind.text = ((wind_direction != undefined) ? wind_direction + ' ' : '') + this.MPStoUserUnits(weather.wind.speed) + ' ' + _(this._windSpeedUnit);
   
    // API Unique display
    switch (this._dataService) {
      case DATA_SERVICE.OPEN_WEATHER_MAP:
        if (weather.cloudiness != null) {
          this._currentWeatherApiUnique.text = weather.cloudiness + "%";
          this._currentWeatherApiUniqueCap.text = _("Cloudiness:");
        }
        break;
      default: 
        this._currentWeatherApiUnique.text = "";
        this._currentWeatherApiUniqueCap.text = "";
    }
    
    // Pressure
    if (weather.main.pressure != null) {
      this._currentWeatherPressure.text = this.PressToUserUnits(weather.main.pressure) + ' ' + _(this._pressureUnit);
    }

    // location is a button
    // No URL is provided, disable it for now
    //this._currentWeatherLocation.url = tmp.length > 1 ? tmp[1] : tmp[0];
    this._currentWeatherLocation.label = _(location);

    // Sunset/Sunrise
    // gettext can't see these inline
    let sunriseText = "";
    let sunsetText = "";
    if (weather.sunrise != null && weather.sunset != null) {
      if (this._showSunrise) {
        sunriseText = _('Sunrise');
        sunsetText = _('Sunset');
        if (this._translateCondition) {
          sunriseText = _(sunriseText);
          sunsetText = _(sunsetText);
        }
        sunriseText = (sunriseText + ': ' + this.timeToUserUnits(weather.sunrise.toLocaleFormat('%H:%M')));
        sunsetText = (sunsetText + ': ' + this.timeToUserUnits(weather.sunset.toLocaleFormat('%H:%M')));
      }
    }
    
    this._currentWeatherSunrise.text = sunriseText;
    this._currentWeatherSunset.text = sunsetText;
    //Reset weather object
    weather.dateTime = null;
    weather.location.city = null;
    weather.location.country = null;
    weather.location.id = null;
    weather.coord.lat = null;
    weather.coord.lon = null;
    weather.sunrise = null;
    weather.sunset = null;
    weather.wind.degree = null;
    weather.wind.speed = null;
    weather.main.temperature = null;
    weather.main.pressure = null;
    weather.main.humidity = null;
    weather.main.temp_max = null;
    weather.main.temp_min = null;
    weather.condition.id = null;
    weather.condition.main = null;
    weather.condition.description = null;
    weather.condition.icon = null;
    weather.cloudiness = null;
  },

  displayForecast: function() {
    for (let i = 0; i < this._forecast.length; i++) {
      let forecastData = forecasts[i];
      let forecastUi = this._forecast[i];

      let t_low = this.TempToUserUnits(forecastData.main.temp_min);
      let t_high = this.TempToUserUnits(forecastData.main.temp_max);

      let first_temperature = this._temperatureHighFirst ? t_high : t_low;
      let second_temperature = this._temperatureHighFirst ? t_low : t_high;

      let comment = _(this.capitalizeFirstLetter(forecastData.condition.description));
      let dayName = forecastData.dateTime;
      dayName.setMilliseconds(dayName.getMilliseconds() + (weather.location.tzOffset * 1000));
      dayName = this.getDayName(dayName.getUTCDay());
      
      forecastUi.Day.text = dayName;
      forecastUi.Temperature.text = first_temperature + ' ' + '\u002F' + ' ' + second_temperature + ' ' + this.unitToUnicode();
      forecastUi.Summary.text = comment;
      forecastUi.Icon.icon_name = forecastData.condition.icon;
    }
    // reset array
    forecasts = [];
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
  }

, rebuildFutureWeatherUi: function rebuildFutureWeatherUi() {
    this.destroyFutureWeather()

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
        case WeatherWindSpeedUnits.MPH:
          //Rounding to 1 decimal
          return Math.round ((mps * WEATHER_CONV_MPH_IN_MPS) * 10)/ 10;
        case WeatherWindSpeedUnits.KPH:
          //Rounding to 1 decimal
          return Math.round ((mps * WEATHER_CONV_KPH_IN_MPS) * 10)/ 10;
        case WeatherWindSpeedUnits.MPS:
          // Rounding to 1 decimal just in case API does not return it in the same format
          return Math.round (mps * 10)/ 10;
        case WeatherWindSpeedUnits.KNOTS:
          //Rounding to whole units
          return Math.round (mps * WEATHER_CONV_KNOTS_IN_MPS);
      }
  },

  // Conversion from Kelvin
  TempToUserUnits: function(kelvin) {
    if (this._temperatureUnit == WeatherUnits.CELSIUS) {
      return Math.round((kelvin  - 273.15));
    }
    if (this._temperatureUnit == WeatherUnits.FAHRENHEIT) {
      return Math.round((9/5*(kelvin - 273) + 32));
    }
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

  unitToUrl: function () {
    return this._temperatureUnit == WeatherUnits.FAHRENHEIT ? 'f' : 'c'
  }

, unitToUnicode: function() {
    return this._temperatureUnit == WeatherUnits.FAHRENHEIT ? '\u2109' : '\u2103'
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
  }
, compassDirection: function(deg) {
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

  // Only have Mainloop Polling in one of the functions with API calls
  // because it will cause a exponential recursive loop otherwise

  getOpenWeatherCurrentWeather: function() {  
    let query = this.getOpenWeatherQueryString(SERVICE.OpenWeatherMap.QUERY_URL); 
    if (query == "") {
      return false;
    }
    this.loadJsonAsync(query, function(json) {
      if (!this.isOpenWeatherResponseValid(json)) {
        Mainloop.timeout_add_seconds(30, Lang.bind(this, function() {
          this.refreshWeather(false)
        }));
        return false;
      }
      this.parseOpenWeather(json);
      this.displayWeather();
      return true;
    })
  },

  getOpenWeatherForecast: function() {
    let query = this.getOpenWeatherQueryString(SERVICE.OpenWeatherMap.FORECAST_URL);
    if (query == "") {
      return false;
    }
    this.loadJsonAsync(query, function(json) {
      if (!this.isOpenWeatherResponseValid(json)) {
        return false;
      }
      this.parseOpenWeatherForecast(json);
      this.displayForecast();
      return true;
    })
  },

  isOpenWeatherResponseValid: function(response) {
    if (!response) {
      this.displayLabelError(_("Service Unavailable"));
      return false;
    }
    if (response.cod != 200) {
      this.displayLabelError(_("Service Error"));
      if (response.cod == 401) {
        this._currentWeatherSummary.text = _("Wrong API Key");
      }
      if (response.cod == 404) {
        this._currentWeatherSummary.text = _("City Not found");
      }
      if (response.cod == 429) {
        this._currentWeatherSummary.text = _("Key Temp. Blocked");
      }
      return false;
    }
    return true;      
  },

  parseOpenWeather: function(json) {
    if (json.coord) {
      weather.coord.lat = json.coord.lat;
      weather.coord.lon = json.coord.lon;
      weather.location.tzOffset = Math.round(json.coord.lon/15) * 3600;
    }
    weather.location.city = json.name;
    weather.location.country = json.sys.country;
    // Keep UTC for now, it is converted to Locale what covers most of the users
    // Need proper fix later
    weather.dateTime = new Date((json.dt) * 1000);
    weather.sunrise = new Date((json.sys.sunrise) * 1000);
    weather.sunset = new Date((json.sys.sunset) * 1000);
    if (json.wind) {
      weather.wind.speed = json.wind.speed;
      weather.wind.degree = json.wind.deg;
    }
    if (json.main) {
      weather.main.temperature = json.main.temp;
      weather.main.pressure = json.main.pressure;
      weather.main.humidity = json.main.humidity;
      weather.main.temp_min = json.main.temp_min;
      weather.main.temp_max = json.main.temp_max;
    }
    if (json.weather[0]) {
      weather.condition.main = json.weather[0].main;
      weather.condition.description = json.weather[0].description;
      weather.condition.icon = this.weatherIconSafely(json.weather[0].icon, this.resolveOpenWeatherIcon); 
    }
    if (json.clouds) {
      weather.cloudiness = json.clouds.all;
    }    
  },

  parseOpenWeatherForecast: function(json) {
    let forecast;
    for (let i = 0; i < this._forecastDays; i++) {
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
        let day = json.list[i];
        forecast.dateTime = new Date(day.dt * 1000);
        forecast.main.temp_min = day.temp.min;
        forecast.main.temp_max = day.temp.max;
        forecast.main.pressure = day.pressure;
        forecast.main.humidity = day.humidity;
        forecast.clouds = day.clouds;
        if (day.weather[0].id) {
            forecast.condition.main = day.weather[0].main;
            forecast.condition.description = day.weather[0].description;
            forecast.condition.icon = this.weatherIconSafely(day.weather[0].icon, this.resolveOpenWeatherIcon);
        }          
      forecasts.push(forecast);
      }
  },

  getOpenWeatherQueryString: function(url) {
    let APIKey = "1c73f8259a86c6fd43c7163b543c8640";
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
    if (this._translateCondition && this.isLangSupportedByOpenW(language)) { // Append Language if supported and enabled
      query = query + "&lang=" + language;
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

  isLangSupportedByOpenW: function(lang) {
    let supported = ["ar", "bg", "ca", "cz", "de", "el", "en", "fa", "fi",
     "fr", "gl", "hr", "hu", "it", "ja", "kr", "la", "lt", "mk", "nl", "pl",
      "pt", "ro", "ru", "se", "sk", "sl", "es", "tr", "ua", "vi", "zh_cn", "zh_tw"];
      if (supported.indexOf(lang) != -1) {
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

//----------------------------------------------------------------------
//
// Entry point
//
//----------------------------------------------------------------------

function main(metadata, orientation, panelHeight, instanceId) {
  //log("v" + metadata.version + ", cinnamon " + Config.PACKAGE_VERSION)
  return new MyApplet(metadata, orientation, panelHeight, instanceId)
}

