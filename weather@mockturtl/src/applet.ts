const DEBUG = false;
function importModule(path: string): any {
  if (typeof require !== 'undefined') {
    return require('./' + path);
  } else {
    if (!AppletDir) var AppletDir = imports.ui.appletManager.applets['weather@mockturtl'];
    return AppletDir[path];
  }
}

/**
 * /usr/share/gjs-1.0/
 * /usr/share/gnome-js/
 */
const Cairo: typeof imports.cairo = imports.cairo;
const Lang: typeof imports.lang = imports.lang;
// http://developer.gnome.org/glib/unstable/glib-The-Main-Event-Loop.html
const Main: typeof imports.ui.main = imports.ui.main;
var Mainloop: typeof imports.mainloop = imports.mainloop;
/**
 * /usr/share/gjs-1.0/overrides/
 * /usr/share/gir-1.0/
 * /usr/lib/cinnamon/
 */
const Gio: typeof imports.gi.Gio = imports.gi.Gio;
// http://developer.gnome.org/libsoup/stable/libsoup-client-howto.html
const Soup: typeof imports.gi.Soup = imports.gi.Soup;
// http://developer.gnome.org/st/stable/
const St: typeof imports.gi.St = imports.gi.St;
const GLib: typeof imports.gi.GLib = imports.gi.GLib
const GObject: typeof imports.gi.GObject = imports.gi.GObject;
const Gettext: typeof imports.gettext = imports.gettext
/**
 * /usr/share/cinnamon/js/
 */
const Applet: typeof imports.ui.applet = imports.ui.applet;
const PopupMenu: typeof imports.ui.popupMenu = imports.ui.popupMenu;
const Settings: typeof imports.ui.settings = imports.ui.settings;
const Util: typeof imports.misc.util = imports.misc.util;

var utils = importModule("utils");
var GetDayName = utils.GetDayName as (date: Date, locale:string, tz?: string) => string;
var GetHoursMinutes = utils.GetHoursMinutes as (date: Date, locale: string, hours24Format: boolean, tz?: string) => string;
var capitalizeFirstLetter = utils.capitalizeFirstLetter as (description: string) => string;
var TempToUserUnits = utils.TempToUserUnits as (kelvin: number, units: WeatherUnits) => number;
var PressToUserUnits = utils.PressToUserUnits as (hpa: number, units: WeatherPressureUnits) => number;
var compassDirection = utils.compassDirection as (deg: number) => string;
var MPStoUserUnits = utils.MPStoUserUnits as (mps: number, units: WeatherWindSpeedUnits) => number;
var nonempty = utils.nonempty as (str: string) => boolean;

// This always evaluates to True because "var Promise" line exists inside 
if (typeof Promise != "function") {
  var promisePoly = importModule("promise-polyfill");
  var finallyConstructor = promisePoly.finallyConstructor;
  var setTimeout = promisePoly.setTimeout as (func: any, ms: number) => void;
  var setTimeoutFunc = promisePoly.setTimeoutFunc;
  var isArray = promisePoly.isArray;
  var noop = promisePoly.noop;
  var bind = promisePoly.bind;
  var Promise = promisePoly.Promise as PromiseConstructor;
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
  } else if (!globalNS.Promise.prototype['finally']) {
    globalNS.Promise.prototype['finally'] = finallyConstructor;
  }
}

const ipApi = importModule('ipApi'); // Location lookup service

//----------------------------------------------------------------------
//
// Constants
//
//----------------------------------------------------------------------

const UUID = "weather@mockturtl"
const APPLET_ICON = "view-refresh-symbolic"
const REFRESH_ICON = "view-refresh";
const CMD_SETTINGS = "cinnamon-settings applets " + UUID

// Settings keys
const DATA_SERVICE = {
  OPEN_WEATHER_MAP: "OpenWeatherMap",
  DARK_SKY: "DarkSky",
}
const WEATHER_LOCATION = "location"
const WEATHER_USE_SYMBOLIC_ICONS_KEY = 'useSymbolicIcons'

/**
 * Keys matching the ones in settings-schema.json
 */
const KEYS: SettingKeys  =  {
  WEATHER_DATA_SERVICE : "dataService",
  WEATHER_API_KEY:  "apiKey",
  WEATHER_TEMPERATURE_UNIT_KEY: "temperatureUnit",
  WEATHER_TEMPERATURE_HIGH_FIRST_KEY:  "temperatureHighFirst",
  WEATHER_WIND_SPEED_UNIT_KEY: "windSpeedUnit",
  WEATHER_CITY_KEY:  "locationLabelOverride",
  WEATHER_TRANSLATE_CONDITION_KEY:  "translateCondition",
  WEATHER_VERTICAL_ORIENTATION_KEY:  "verticalOrientation",
  WEATHER_SHOW_TEXT_IN_PANEL_KEY:  "showTextInPanel",
  WEATHER_SHOW_COMMENT_IN_PANEL_KEY:  "showCommentInPanel",
  WEATHER_SHOW_SUNRISE_KEY: "showSunrise",
  WEATHER_SHOW_24HOURS_KEY:  "show24Hours",
  WEATHER_FORECAST_DAYS:  "forecastDays",
  WEATHER_REFRESH_INTERVAL: "refreshInterval",
  WEATHER_PRESSURE_UNIT_KEY: "pressureUnit",
  WEATHER_SHORT_CONDITIONS_KEY:  "shortConditions",
  WEATHER_MANUAL_LOCATION:  "manualLocation"
}

//----------------------------------------------------------------------
//
// Weather Applet
//
//----------------------------------------------------------------------

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");
function _(str: string): string {
  return Gettext.dgettext(UUID, str)
}

class WeatherApplet extends Applet.TextIconApplet {
  /** Stores all weather information */
  weather: Weather = {
    date: null, // Date object, UTC
    location: {
      city: null,
      country: null, // Country code
      tzOffset: null, // seconds
      timeZone: null,
      url: null
    },
    coord: {
      lat: null,
      lon: null,
    },
    sunrise: null, // Date object, UTC
    sunset: null, // Date object, UTC
    wind: {
      speed: null, // MPS
      degree: null, // meteorlogical degrees
    },
    temperature: null, // Kelvin
    pressure: null, // hPa
    humidity: null, // %
    condition: {
      main: null, // What API returns
      description: null, // Longer description, if not available put the same whats in main
      icon: null, // GTK weather icon names
    },
  }

  /** Stores all forecast information */
  forecasts: Array < ForecastData > = [];

  ///////////////////////////////////////////////////////////////////////
  ///////////////////////////////////////////////////////////////////////  

  // UI elements
  _currentWeather: imports.gi.St.Bin;
  _separatorArea: imports.gi.St.DrawingArea;
  _futureWeather: imports.gi.St.Bin;
  _applet_context_menu: any;
  _icon_type: string;
  _currentWeatherIcon: imports.gi.St.Icon;
  _currentWeatherSummary: imports.gi.St.Label;
  _currentWeatherLocation: imports.gi.St.Button;
  _currentWeatherSunrise: imports.gi.St.Label;
  _currentWeatherSunset: imports.gi.St.Label;
  _currentWeatherTemperature: imports.gi.St.Label;
  _currentWeatherHumidity: imports.gi.St.Label;
  _currentWeatherPressure: imports.gi.St.Label;
  _currentWeatherWind: imports.gi.St.Label;
  _currentWeatherApiUnique: imports.gi.St.Label;
  _currentWeatherApiUniqueCap: imports.gi.St.Label;
  _forecast: ForecastUI[];
  _forecastBox: imports.gi.St.BoxLayout;

  // Settings properties to bind
  _refreshInterval: number;
  _manualLocation: boolean;
  _dataService: string;
  _location: string;
  _translateCondition: boolean;
  _temperatureUnit: WeatherUnits;
  _pressureUnit: WeatherPressureUnits;
  _windSpeedUnit: WeatherWindSpeedUnits;
  _show24Hours: boolean;
  _apiKey: string;
  _forecastDays: number;
  _verticalOrientation: boolean;
  _temperatureHighFirst: boolean;
  _shortConditions: boolean;
  _showSunrise: boolean;
  _showCommentInPanel: boolean;
  _showTextInPanel: boolean;
  _locationLabelOverride: string;

  keybinding: any;
  menu: any;
  menuManager: any;
  settings: any;
  log: Log;
  currentLocale: string = null;
  systemLanguage: string = null;
  // Soup session (see https://bugzilla.gnome.org/show_bug.cgi?id=661323#c64)
  _httpSession = new Soup.SessionAsync();

  provider: WeatherProvider; // API
  locProvider = new ipApi.IpApi(this); // IP location lookup
  lastUpdated: Date = null;
  orientation: any;
  encounteredError: boolean = false;

  constructor(metadata: any, orientation: any, panelHeight: number, instanceId: number) {
    super(orientation, panelHeight, instanceId);
    this.currentLocale = this.constructJsLocale(GLib.get_language_names()[0]);
    this.systemLanguage = this.currentLocale.split('-')[0];
    this.settings = new Settings.AppletSettings(this, UUID, instanceId)
    this.log = new Log(instanceId);
    this._httpSession.user_agent = "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:37.0) Gecko/20100101 Firefox/37.0"; // ipapi blocks non-browsers agents, imitating browser
    Soup.Session.prototype.add_feature.call(this._httpSession, new Soup.ProxyResolverDefault());

    this.SetAppletOnPanel(); 
    this.AddPopupMenu(orientation);
    this.BindSettings();
    this.AddRefreshButton();
    this.BuildPopupMenu();

    this.rebuild()
    //------------------------------
    // RUN
    //------------------------------
    this.RefreshLoop();

    this.orientation = orientation;
    try {
      this.setAllowedLayout(Applet.AllowedLayout.BOTH);
      this.update_label_visible();
    } catch (e) {
      // vertical panel not supported
    }
  }

  SetAppletOnPanel(): void {
    this.set_applet_icon_name(APPLET_ICON);
    this.set_applet_label(_("..."));
    this.set_applet_tooltip(_("Click to open"));
  }

  AddPopupMenu(orientation: any) {
    this.menuManager = new PopupMenu.PopupMenuManager(this);
    this.menu = new Applet.AppletPopupMenu(this, orientation)
    if (typeof this.menu.setCustomStyleClass === "function")
      this.menu.setCustomStyleClass(STYLE_WEATHER_MENU);
    else
    {
      this.menu.actor.add_style_class_name(STYLE_WEATHER_MENU);
    }
    
    this.menuManager.addMenu(this.menu)
  }

  BindSettings() {
    for (let k in KEYS) {
      let key = KEYS[k];
      let keyProp = "_" + key;
      this.settings.bindProperty(Settings.BindingDirection.IN,
        key, keyProp, this.refreshAndRebuild, null);
    }

    // Settings what need special care
    this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL,
      WEATHER_LOCATION, ("_" + WEATHER_LOCATION), this.refreshAndRebuild, null);

    this.settings.bindProperty(Settings.BindingDirection.IN, "keybinding",
      "keybinding", this._onKeySettingsUpdated, null);

    Main.keybindingManager.addHotKey(
      UUID, this.keybinding, Lang.bind(this, this.on_applet_clicked));

    this.updateIconType()

    this.settings.connect(SIGNAL_CHANGED + WEATHER_USE_SYMBOLIC_ICONS_KEY, Lang.bind(this, function () {
      this.updateIconType()
      this._applet_icon.icon_type = this._icon_type
      this._currentWeatherIcon.icon_type = this._icon_type
      for (let i = 0; i < this._forecastDays; i++) {
        this._forecast[i].Icon.icon_type = this._icon_type
      }
      this.refreshWeather()
    }))
  }

  /** Into context menu */
  AddRefreshButton(): void {
     let itemLabel = _("Refresh")
     let refreshMenuItem = new Applet.MenuItem(itemLabel, REFRESH_ICON, Lang.bind(this, function () {
       this.refreshWeather();
     }))
     this._applet_context_menu.addMenuItem(refreshMenuItem);
  }

  BuildPopupMenu(): void {
    //  today's forecast
    this._currentWeather = new St.Bin({ style_class: STYLE_CURRENT });
    //  tomorrow's forecast
    this._futureWeather = new St.Bin({ style_class: STYLE_FORECAST });
    //  horizontal rule
    this._separatorArea = new St.DrawingArea({ style_class: STYLE_POPUP_SEPARATOR_MENU_ITEM });
    this._separatorArea.width = 200
    this._separatorArea.connect(SIGNAL_REPAINT, Lang.bind(this, this._onSeparatorAreaRepaint))
    // build menu
    let mainBox = new St.BoxLayout({ vertical: true })

    mainBox.add_actor(this._currentWeather)
    mainBox.add_actor(this._separatorArea)
    mainBox.add_actor(this._futureWeather)
    this.menu.addActor(mainBox)
  }

  refreshAndRebuild(): void {
    this.refreshWeather(true);
  };

  async LoadJsonAsync(query: string): Promise <any> {
    let json = await new Promise((resolve: any, reject: any) => {
      let message = Soup.Message.new('GET', query);
      this._httpSession.queue_message(message, (session: any, message: any) => {

        if (!message) 
          reject({code: 0, message: "no network response", reason_phrase: "no network response"} as HttpError);

        if (message.status_code != 200) 
          reject({code: message.status_code, message: "bad status code", reason_phrase: message.reason_phrase } as HttpError)
        
        if (!message.response_body) 
          reject({code: message.status_code, message: "no reponse body", reason_phrase: message.reason_phrase} as HttpError);
        
        if (!message.response_body.data) 
          reject({code: message.status_code, message: "no respone data", reason_phrase: message.reason_phrase} as HttpError);
        
        try {
          this.log.Debug("API full response: " + message.response_body.data.toString());
          let payload = JSON.parse(message.response_body.data);
          resolve(payload);
        } catch (e) { // Payload is not JSON
          this.log.Error("Error: API response is not JSON. The response: " + message.response_body.data);
          reject({code: message.status_code, message: "bad api response - non json", reason_phrase: e} as HttpError);
        }
      });
    });
    return json;
  };

  async locationLookup(): Promise < void > {
    let command = "xdg-open ";
    Util.spawnCommandLine(command + "https://cinnamon-spices.linuxmint.com/applets/view/17");
  }

  IsDataTooOld(): boolean {
    if (!this.lastUpdated) return true;
    let oldDate = this.lastUpdated;
    // If data is at least twice as old as refreshInterval, return true
    oldDate.setMinutes(oldDate.getMinutes() + (this._refreshInterval * 2));
    return (this.lastUpdated > oldDate);
  }

  /** Refresh Loop Hooked into MainLoop */
  RefreshLoop(): void {
    /** In seconds */
    let loopInterval = 15;
    try {
      if (this.lastUpdated == null || this.encounteredError
         || new Date(this.lastUpdated.getTime() + this._refreshInterval * 60000) < new Date()) {
        this.refreshWeather(false);
      }
    } catch (e) {
      this.log.Error("Error in Main loop: " + e);
      this.encounteredError = true;
    }
    Mainloop.timeout_add_seconds(loopInterval, Lang.bind(this, function mainloopTimeout() {
      this.RefreshLoop();
    }))
  };

  // Applet Overrides
  update_label_visible(): void {
    if (this.orientation == St.Side.LEFT || this.orientation == St.Side.RIGHT)
      this.hide_applet_label(true);
    else
      this.hide_applet_label(false);
  };

  on_orientation_changed(orientation: string) {
    this.orientation = orientation;
    this.refreshWeather(true);
  };

  _onKeySettingsUpdated(): void {
    if (this.keybinding != null) {
      Main.keybindingManager.addHotKey(UUID,
        this.keybinding,
        Lang.bind(this,
          this.on_applet_clicked))
    }
  }

  on_applet_clicked(event: any): void {
    this.menu.toggle()
  }

  _onSeparatorAreaRepaint(area: any) {
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
  };

  //----------------------------------------------------------------------
  //
  // Methods
  //
  //----------------------------------------------------------------------

  updateIconType(): void {
    this._icon_type = this.settings.getValue(WEATHER_USE_SYMBOLIC_ICONS_KEY) ?
      St.IconType.SYMBOLIC :
      St.IconType.FULLCOLOR
  };

  constructJsLocale(locale: string): string {
    let jsLocale = locale.split(".")[0];
    let tmp: string[] = jsLocale.split("_");
    jsLocale = "";
    for (let i = 0; i < tmp.length; i++) {
      if (i != 0) jsLocale += "-";
      jsLocale += tmp[i];
    }
    return jsLocale;
  }

  /**
   * Main function pulling data
   * @param rebuild 
   */
  async refreshWeather(rebuild: boolean): Promise < void > {
    this.encounteredError = false;

    let locationData: LocationData = null;
    try {
      locationData = await this.ValidateLocation();
    }
    catch(e) {
      this.log.Error(e);
      return;
    }

    try {
      switch (this._dataService) {
        case DATA_SERVICE.DARK_SKY:           // No City Info
          if (darkSky == null) var darkSky = importModule('darkSky');
          this.provider = new darkSky.DarkSky(this);
          break;
        case DATA_SERVICE.OPEN_WEATHER_MAP:   // No TZ info
          if (openWeatherMap == null) var openWeatherMap = importModule("openWeatherMap");
          this.provider = new openWeatherMap.OpenWeatherMap(this);
          break;
        default:
          return;
      }

      let weatherInfo = await this.provider.GetWeather();
      if (!weatherInfo) {
        this.log.Error("Unable to obtain Weather Information");
        return;
      }

      this.wipeCurrentData();
      this.wipeForecastData();
      this.ProcessWeatherData(weatherInfo, locationData);

      if (rebuild) this.rebuild();
      if (!await this.displayWeather() || !await this.displayForecast()) return;
      this.log.Print("Weather Information refreshed");
    } 
    catch (e) {
      this.log.Error("Generic Error while refreshing Weather info: " + e);
      this.HandleError({type: "hard", detail: "unknown", message: _("Unexpected Error While Refreshing Weather, please see log in Looking Glass")});
      return;
    }

    this.lastUpdated = new Date();
    return;
  };

  /** 
   * @returns LocationData when automatic Location is on,
   * null if manual location is on and throws and error
   * if there is an issue with any of them
   */
  async ValidateLocation(): Promise<LocationData> {
    // Autmatic location
    let location: LocationData = null;
    if (!this._manualLocation) { 
      location = await this.locProvider.GetLocation();
      if (!location) reject(null);

      let loc = location.lat + "," + location.lon;
      this.settings.setValue('location', loc);
      return location;

    // Manual Location
    } else { 
      // Verifying User Input
      let loc = this._location.replace(" ", "");
      if (loc == undefined || loc == "") {
        this.HandleError({
          type: "hard",
          detail: "no location",
            noTriggerRefresh: true,
            message: _("Make sure you entered a location or use Automatic location instead")});
        reject("No location given when setting is on Manual Location");
      }
    }
    return null;
  }

  /** Injects Data into Weather and Forecast Objects to display later */
  ProcessWeatherData(weatherInfo: WeatherData, locationData: LocationData) {
    if (!!locationData) { // Automatic location
      this.weather.location.city = locationData.city;
      this.weather.location.country = locationData.country;
      this.weather.location.timeZone = locationData.timeZone;
      this.weather.coord.lat = locationData.lat;
      this.weather.coord.lon = locationData.lon;
    }

    this.weather.condition = weatherInfo.condition;
    this.weather.wind = weatherInfo.wind;
    this.weather.temperature = weatherInfo.temperature,
    this.weather.date = weatherInfo.date;
    this.weather.sunrise = weatherInfo.sunrise;
    this.weather.sunset = weatherInfo.sunset;
    this.weather.coord = weatherInfo.coord;
    this.weather.humidity = weatherInfo.humidity;
    this.weather.pressure = weatherInfo.pressure;
    if (!!weatherInfo.location.city) this.weather.location.city = weatherInfo.location.city;
    if (!!weatherInfo.location.country) this.weather.location.country = weatherInfo.location.country;
    if (!!weatherInfo.location.timeZone) this.weather.location.timeZone = weatherInfo.location.timeZone;
    if (!!weatherInfo.extra_field) this.weather.extra_field = weatherInfo.extra_field;
    this.forecasts = weatherInfo.forecasts;

    // Estimation
    //this.weather.location.tzOffset = Math.round(this.weather.coord.lon/15) * 3600;
  }

  /** Injects data from weather object into the popupMenu */
  displayWeather(): boolean {
    try {
      let mainCondition = "";
      let descriptionCondition = "";
      // Short Condition Name
      if (this.weather.condition.main != null) {
        mainCondition = this.weather.condition.main;
        if (this._translateCondition) {
          mainCondition = capitalizeFirstLetter(_(mainCondition));
        }
      }
      // Condition Description
      if (this.weather.condition.description != null) {
        descriptionCondition = capitalizeFirstLetter(this.weather.condition.description);
        if (this._translateCondition) {
          descriptionCondition = _(descriptionCondition);
        }
      }

      // Displaying Location   
      let location = "";
      if (this.weather.location.city != null && this.weather.location.country != null) {
        location = this.weather.location.city + ", " + this.weather.location.country;
      } else {
        location = Math.round(this.weather.coord.lat * 10000) / 10000 + ", " + Math.round(this.weather.coord.lon * 10000) / 10000;
      }

      // Overriding Location
      if (nonempty(this._locationLabelOverride)) {
        location = this._locationLabelOverride;
      }

      this.set_applet_tooltip(location);

      // Weather Condition
      this._currentWeatherSummary.text = descriptionCondition;

      // Weather icon
      let iconname = this.weather.condition.icon;
      if (iconname == null) {
        iconname = "weather-severe-alert";
      }
      this._currentWeatherIcon.icon_name = iconname;
      this._icon_type == St.IconType.SYMBOLIC ?
        this.set_applet_icon_symbolic_name(iconname) :
        this.set_applet_icon_name(iconname)

      // Temperature
      let temp = "";
      if (this.weather.temperature != null) {
        temp = TempToUserUnits(this.weather.temperature, this._temperatureUnit).toString();
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
      } catch (e) {
        // vertical panel not supported
      }

      // Displaying humidity
      if (this.weather.humidity != null) {
        this._currentWeatherHumidity.text = Math.round(this.weather.humidity) + "%";
      }

      // Wind
      let wind_direction = compassDirection(this.weather.wind.degree);
      this._currentWeatherWind.text = ((wind_direction != undefined) ? wind_direction + ' ' : '') + MPStoUserUnits(this.weather.wind.speed, this._windSpeedUnit) + ' ' + this._windSpeedUnit;

      // API Unique display
      this._currentWeatherApiUnique.text = "";
      this._currentWeatherApiUniqueCap.text = "";
      if (!!this.weather.extra_field) {
        this._currentWeatherApiUniqueCap.text = _(this.weather.extra_field.name);
        let value;
        switch (this.weather.extra_field.type) {
          case "percent":
            value = this.weather.extra_field.value.toString() + "%";
            break;
          case "temperature":
            value = TempToUserUnits(this.weather.extra_field.value, this._temperatureUnit) + this.unitToUnicode();
            break;
          default:
            value = _(this.weather.extra_field.value);
            break;
        }
        this._currentWeatherApiUnique.text = value;

      }

      // Pressure
      if (this.weather.pressure != null) {
        this._currentWeatherPressure.text = PressToUserUnits(this.weather.pressure, this._pressureUnit) + ' ' + _(this._pressureUnit);
      }

      // Location
      this._currentWeatherLocation.label = location;
      this._currentWeatherLocation.url = this.weather.location.url;

      // Sunset/Sunrise
      let sunriseText = "";
      let sunsetText = "";
      if (this.weather.sunrise != null && this.weather.sunset != null && this._showSunrise) {
        sunriseText = (_('Sunrise') + ': ' + GetHoursMinutes(this.weather.sunrise, this.currentLocale, this._show24Hours, this.weather.location.timeZone));
        sunsetText = (_('Sunset') + ': ' + GetHoursMinutes(this.weather.sunset, this.currentLocale, this._show24Hours, this.weather.location.timeZone));
      }

      this._currentWeatherSunrise.text = sunriseText;
      this._currentWeatherSunset.text = sunsetText;
      return true;
    } catch (e) {
      this.log.Error("DisplayWeatherError: " + e);
      return false;
    }
  };

  /** Injects data from forecasts array into popupMenu */
  displayForecast(): boolean {
    try {
      for (let i = 0; i < this._forecast.length; i++) {
        let forecastData = this.forecasts[i];
        let forecastUi = this._forecast[i];

        let t_low = TempToUserUnits(forecastData.temp_min, this._temperatureUnit);
        let t_high = TempToUserUnits(forecastData.temp_max, this._temperatureUnit);

        let first_temperature = this._temperatureHighFirst ? t_high : t_low;
        let second_temperature = this._temperatureHighFirst ? t_low : t_high;

        // Weather Condition
        let comment = "";
        if (forecastData.condition.main != null && forecastData.condition.description != null) {
          comment = (this._shortConditions) ? forecastData.condition.main : forecastData.condition.description;
          comment = capitalizeFirstLetter(comment);
          if (this._translateCondition) comment = _(comment);
        }

        // Day Names
        if (this.weather.location.timeZone == null) forecastData.date.setMilliseconds(forecastData.date.getMilliseconds() + (this.weather.location.tzOffset * 1000));
        let dayName: string = GetDayName(forecastData.date, this.currentLocale, this.weather.location.timeZone);

        if (forecastData.date) {
          let now = new Date();
          if (forecastData.date.getDate() == now.getDate()) dayName = _("Today");
          if (forecastData.date.getDate() == new Date(now.setDate(now.getDate() + 1)).getDate()) dayName = _("Tomorrow");
        }

        forecastUi.Day.text = dayName;
        forecastUi.Temperature.text = first_temperature + ' ' + '\u002F' + ' ' + second_temperature + ' ' + this.unitToUnicode();
        forecastUi.Summary.text = comment;
        forecastUi.Icon.icon_name = forecastData.condition.icon;
      }
      return true;
    } catch (e) {
        this.log.Error("DisplayForecastError " + e);
      return false;
    }
  };

  wipeCurrentData(): void {
    //Reset weather object
    this.weather.date = null;
    this.weather.location.city = null;
    this.weather.location.country = null;
    this.weather.location.timeZone = null;
    this.weather.location.tzOffset = null;
    this.weather.location.url = null;
    this.weather.coord.lat = null;
    this.weather.coord.lon = null;
    this.weather.sunrise = null;
    this.weather.sunset = null;
    this.weather.wind.degree = null;
    this.weather.wind.speed = null;
    this.weather.temperature = null;
    this.weather.pressure = null;
    this.weather.humidity = null;
    this.weather.condition.main = null;
    this.weather.condition.description = null;
    this.weather.condition.icon = null;
    this.weather.extra_field = null;
  };

  wipeForecastData(): void {
    this.forecasts = [];
  };

  destroyCurrentWeather(): void {
    if (this._currentWeather.get_child() != null)
      this._currentWeather.get_child().destroy()
  }

  destroyFutureWeather(): void {
    if (this._futureWeather.get_child() != null)
      this._futureWeather.get_child().destroy()
  }

  showLoadingUi(): void {
    this.destroyCurrentWeather()
    this.destroyFutureWeather()
    this._currentWeather.set_child(new St.Label({
      text: _('Loading current weather ...')
    }))
    this._futureWeather.set_child(new St.Label({
      text: _('Loading future weather ...')
    }))
  }

  rebuild(): void {
    this.showLoadingUi()
    this.rebuildCurrentWeatherUi()
    this.rebuildFutureWeatherUi()
  }

  rebuildCurrentWeatherUi(): void {
    this.destroyCurrentWeather()
    let textOb = {
      text: ELLIPSIS
    }

    // This will hold the icon for the current weather
    this._currentWeatherIcon = new St.Icon({
      icon_type: this._icon_type,
      icon_size: 64,
      icon_name: APPLET_ICON,
      style_class: STYLE_ICON
    })

    // Current Weather Middle Column
    this._currentWeatherLocation = new St.Button({ reactive: true, label: _('Refresh'), });
    this._currentWeatherLocation.style_class = STYLE_LOCATION_LINK;
    this._currentWeatherLocation.connect(SIGNAL_CLICKED, Lang.bind(this, function () {
      if (this._currentWeatherLocation.url == null) {
        this.refreshWeather();
      } else {
        Gio.app_info_launch_default_for_uri(
          this._currentWeatherLocation.url,
          global.create_app_launch_context()
        )
      }
    }));

    this._currentWeatherSummary = new St.Label({ text: _('Loading ...'), style_class: STYLE_SUMMARY })

    this._currentWeatherSunrise = new St.Label(textOb)
    this._currentWeatherSunset = new St.Label(textOb)
    let ab_spacerlabel = new St.Label({ text: BLANK })
    let bb_spacerlabel = new St.Label({ text: BLANK })

    let sunBox = new St.BoxLayout({ style_class: STYLE_ASTRONOMY })
    sunBox.add_actor(this._currentWeatherSunrise)
    sunBox.add_actor(ab_spacerlabel)
    sunBox.add_actor(this._currentWeatherSunset)

    let middleColumn = new St.BoxLayout({ vertical: true, style_class: STYLE_SUMMARYBOX })
    middleColumn.add_actor(this._currentWeatherLocation)
    middleColumn.add_actor(this._currentWeatherSummary)
    middleColumn.add_actor(bb_spacerlabel)
    middleColumn.add_actor(sunBox)

    // Current Weather Right Column
    this._currentWeatherTemperature = new St.Label(textOb)
    this._currentWeatherHumidity = new St.Label(textOb)
    this._currentWeatherPressure = new St.Label(textOb)
    this._currentWeatherWind = new St.Label(textOb)
    this._currentWeatherApiUnique = new St.Label({ text: '' })
    // APi Unique Caption
    this._currentWeatherApiUniqueCap = new St.Label({ text: '' });

    let rb_captions = new St.BoxLayout({ vertical: true, style_class: STYLE_DATABOX_CAPTIONS })
    let rb_values = new St.BoxLayout({vertical: true, style_class: STYLE_DATABOX_VALUES })
    rb_captions.add_actor(new St.Label({ text: _('Temperature:') }));
    rb_captions.add_actor(new St.Label({ text: _('Humidity:') }));
    rb_captions.add_actor(new St.Label({ text: _('Pressure:') }));
    rb_captions.add_actor(new St.Label({ text: _('Wind:') }));
    rb_captions.add_actor(this._currentWeatherApiUniqueCap);
    rb_values.add_actor(this._currentWeatherTemperature);
    rb_values.add_actor(this._currentWeatherHumidity);
    rb_values.add_actor(this._currentWeatherPressure);
    rb_values.add_actor(this._currentWeatherWind);
    rb_values.add_actor(this._currentWeatherApiUnique);

    let rightColumn = new St.BoxLayout({ style_class: STYLE_DATABOX });
    rightColumn.add_actor(rb_captions);
    rightColumn.add_actor(rb_values);

    // Current Weather Main Boxes
    let weatherBox = new St.BoxLayout();
    weatherBox.add_actor(middleColumn)
    weatherBox.add_actor(rightColumn)

    let box = new St.BoxLayout({ style_class: STYLE_ICONBOX })
    box.add_actor(this._currentWeatherIcon)
    box.add_actor(weatherBox)
    this._currentWeather.set_child(box)
  };

  rebuildFutureWeatherUi(): void {
    this.destroyFutureWeather();

    this._forecast = []
    this._forecastBox = new St.BoxLayout({
      vertical: this._verticalOrientation,
      style_class: STYLE_FORECAST_CONTAINER
    })
    this._futureWeather.set_child(this._forecastBox)

    for (let i = 0; i < this._forecastDays; i++) {
      let forecastWeather: ForecastUI = {
        Icon: new St.Icon,
        Day: new St.Label,
        Summary: new St.Label,
        Temperature: new St.Label,
      }

      forecastWeather.Icon = new St.Icon({
        icon_type: this._icon_type,
        icon_size: 48,
        icon_name: APPLET_ICON,
        style_class: STYLE_FORECAST_ICON
      })

      forecastWeather.Day = new St.Label({ style_class: STYLE_FORECAST_DAY })
      forecastWeather.Summary = new St.Label({ style_class: STYLE_FORECAST_SUMMARY })
      forecastWeather.Temperature = new St.Label({ style_class: STYLE_FORECAST_TEMPERATURE })

      let dataBox = new St.BoxLayout({ vertical: true, style_class: STYLE_FORECAST_DATABOX })
      dataBox.add_actor(forecastWeather.Day)
      dataBox.add_actor(forecastWeather.Summary)
      dataBox.add_actor(forecastWeather.Temperature)

      let forecastBox = new St.BoxLayout({
        style_class: STYLE_FORECAST_BOX
      })
      forecastBox.add_actor(forecastWeather.Icon)
      forecastBox.add_actor(dataBox)

      this._forecast[i] = forecastWeather
      this._forecastBox.add_actor(forecastBox)
    }
  }

  //----------------------------------------------------------------------
  //
  // Utility functions
  //
  //----------------------------------------------------------------------

  noApiKey(): boolean {
    if (this._apiKey == undefined || this._apiKey == "") {
      return true;
    }
    return false;
  };

  unitToUnicode(): string {
    return this._temperatureUnit == "fahrenheit" ? '\u2109' : '\u2103'
  }


  ///
  ///  Error Handling in UI
  ///

  private DisplayError(title: string, msg: string): void {
    this.set_applet_label(title);
    this.set_applet_tooltip("Click to open");
    this.set_applet_icon_name("weather-severe-alert");
    this._currentWeatherSunset.text = msg;
  };

  errMsg: NiceErrorDetail = { // Error messages to use
    unknown: _("Error"),
    "bad api response - non json": _("Service Error"),
    "bad key": _("Incorrect API Key"),
    "bad api response": _("Service Error"),
    "bad location format": _("Incorrect Location Format"),
    "bad status code": _("Service Error"),
    "key blocked": _("Key Blocked"),
    "location not found": _("Can't find location"),
    "no api response": _("Service Error"),
    "no key": _("No Api Key"),
    "no location": _("No Location"),
    "no network response": _("Service Error"),
    "no reponse body": _("Service Error"),
    "no respone data": _("Service Error"),
    "unusal payload": _("Service Error"),
  }

  HandleError(error: AppletError): void {
    if (this.encounteredError) return; // Error Already called in this loop, ignore
    this.encounteredError = true;

    if (error.type == "hard") {
      this.rebuild();
      this.DisplayError(this.errMsg[error.detail], (!error.message) ? "" : error.message);
    }

    if (error.type ==  "soft") {
      // Maybe something less invasive on network related errors?
      // Nothing yet
      if (this.IsDataTooOld()) {
        this.set_applet_tooltip("Click to open");
        this.set_applet_icon_name("weather-severe-alert");
        this._currentWeatherSunset.text = _("Could not update weather for a while...\nare you connected to the internet?");
      }
    }

    if (error.noTriggerRefresh) {
      this.encounteredError = false;
      return;
    }
    this.log.Error("Retrying in the next 15 seconds...");
  }

  /** Callback handles any service specific logic */
  HandleHTTPError(service: ApiService, error: HttpError, ctx: WeatherApplet, callback?: (error: HttpError, uiError: AppletError) => AppletError) {
    let uiError = {
      type: "soft",
      detail: "unknown",
      message: _("Network Error, please check logs in Looking Glass"),
      service: service
    } as AppletError;

    if (typeof error === 'string' || error instanceof String) {   
        ctx.log.Error("Error calling " + service + ": " + error.toString());
    }
    else {
        ctx.log.Error("Error calling " + service + " '" + error.message.toString() + "' Reason: " + error.reason_phrase.toString());
        uiError.detail = error.message;
        uiError.code = error.code;
        if (error.message == "bad api response - non json") uiError.type = "hard";
        if (!!callback && callback instanceof Function) uiError = callback(error, uiError);
    }
    ctx.HandleError(uiError);
  }
}

class Log {
  ID: number;
  debug: boolean = false;

  constructor(_instanceId: number) {
    this.ID = _instanceId;
    this.debug = DEBUG;
  }

  Print(message: string): void {
    let msg = UUID + "#" + this.ID + ": " + message.toString();
    let debug = "";
    if (this.debug) {
      debug = this.GetErrorLine();
      global.log(msg, '\n', "On Line:", debug);
    } else {
      global.log(msg);
    }
  }

  Error(error: string): void {
    global.logError(UUID + "#" + this.ID + ": " + error.toString(), '\n', "On Line:", this.GetErrorLine());
  };

  Debug(message: string): void {
    if (this.debug) {
      this.Print(message);
    }
  }

  GetErrorLine(): string {
    // Couldnt be more ugly, but it returns the file and line number
    let arr = (new Error).stack.split("\n").slice(-2)[0].split('/').slice(-1)[0];
    return arr;
  }
}

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
const STYLE_FORECAST_CONTAINER = 'weather-forecast-container'
const STYLE_PANEL_BUTTON = 'panel-button'
const STYLE_POPUP_SEPARATOR_MENU_ITEM = 'popup-separator-menu-item'
const STYLE_CURRENT = 'current'
const STYLE_FORECAST = 'forecast'
const STYLE_WEATHER_MENU = 'weather-menu'

// Magic strings
const BLANK = '   '
const ELLIPSIS = '...'
const EN_DASH = '\u2013'

//----------------------------------------------------------------------
//
// Entry point
//
//----------------------------------------------------------------------

function main(metadata: any, orientation: string, panelHeight: number, instanceId: number) {
  //log("v" + metadata.version + ", cinnamon " + Config.PACKAGE_VERSION)
  return new WeatherApplet(metadata, orientation, panelHeight, instanceId);
}


/** Units Used in Options. Change Options list if You change this! */
type WeatherUnits = 'celsius' | 'fahrenheit';

/** Units Used in Options. Change Options list if You change this! */
type WeatherWindSpeedUnits = 'kph' | 'mph' | 'm/s' | 'Knots';

/** Units used in Options. Change Options list if You change this! */
type WeatherPressureUnits = 'hPa'|'mm Hg'|'in Hg'|'Pa'|'psi'|'atm'|'at';


interface Forecast {
  dateTime: Date,
  main: {
    /** Kelvin */
    temp?: number,
    /**Kelvin */
    temp_min: number,
    /**Kelvin */
    temp_max: number,
    pressure ?: number,
    sea_level?: number,
    grnd_level?: number,
    humidity?: number,
  },
  condition: {
    id?: string,
    main: string,
    description: string,
    icon: string,
  },
  clouds?: number,
  wind?: {
    speed: number,
    deg: number,
  }
}

interface Weather {
  date: Date,
  location: {
    city?: string,
    country?: string,
    /** In seconds */
    tzOffset: number,
    timeZone?: string,
    /** url to open 
     * service portal set to user's location
     */
    url: string
  },
  coord: {
    lat: number,
    lon: number,
  },
  /** preferably UTC */
  sunrise: Date,
  /** preferably UTC */
  sunset: Date, 
  wind: {
    /** Meter/sec */
    speed: number,
    /** Meteorological degrees */
    degree: number,
  },
  /** Kelvin */
  temperature: number,
  /** hPa */
  pressure: number,
  /** Percent, 0-100 integer (or more) */
  humidity: number,
  condition: {
    /** Short description */
    main: string, // What API returns
    /** Longer description, if not available same as main */
    description: string, // Longer description, if not available put the same whats in main
    /** GTK icon name */
    icon: string,
  },
  extra_field?: {
    name: string,
    /**
     * Refer to the type 
     */
    value: any,
    type: ExtraField
  };
}

interface WeatherData {
  date: Date;
  coord: {
    lat: number,
    lon: number,
  };
  location: {
    city?: string,
    country?: string,
    timeZone?: string,
    url: string
  },
  /** preferably in UTC */
  sunrise: Date,
  /** preferably in UTC */
  sunset: Date,
  wind: {
    /** Meter/sec */
    speed: number,
    /** Meteorological Degrees */
    degree: number,
  };
  /** In Kelvin */
  temperature: number;
  /** In hPa */
  pressure: number;
  /** In percent */
  humidity: number;
  condition: {
    /** Short description */
    main: string,
    /** Long Description */
    description: string,
    /** GTK icon name */
    icon: string
  }
  forecasts: ForecastData[];
  extra_field?: {
    name: string,
    /**
     * Refer to the type 
     */
    value: any,
    type: ExtraField
  };
}

interface ForecastData {
  /** Set to 12:00 if possible */
  date: Date,
    /** Kelvin */
    temp_min: number,
    /** Kelvin */
    temp_max: number,
  condition: {
    /** Short description */
    main: string,
    /** Long Description */
    description: string,
    /** GTK icon name */
    icon: string,
  }
}

interface LocationData {
  lat: number,
  lon: number,
  city: string,
  country: string,
  timeZone: string
}

/** 
 * percent: value is a number from 0-100 (or more)
 * 
 * temperature: value is number in Kelvin
 * 
 * string:  is a string
*/
type ExtraField = "percent" | "temperature" | "string";

interface ForecastUI {
    Icon: imports.gi.St.Icon,
    Day: imports.gi.St.Label,
    Summary: imports.gi.St.Label,
    Temperature: imports.gi.St.Label,
}

type SettingKeys = {
  [key: string]: string;
}

interface WeatherProvider {
  GetWeather(): Promise<WeatherData>;
  /** Used as to extend the same named function int the Applet Class.
   * 
   * "this" is not accessible here
  */
  HandleHTTPError?:(error: HttpError, uiError: AppletError) => AppletError;
}

interface AppletError {
  type: ErrorSeverity;
  noTriggerRefresh?: boolean;
  detail: ErrorDetail;
  code?: number;
  message?: string;
  service?: ApiService
}

interface HttpError {
  code: number;
  message: ErrorDetail;
  reason_phrase: string;
}

/** hard will not force a refresh and cleans the applet ui.
 * 
 *  soft will show a subtle hint that the refresh failed (NOT IMPLEMENTED)
 */
type ErrorSeverity = "hard" |  "soft";
type ApiService = "ipapi" | "darksky" | "openweathermap";
type ErrorDetail = "no key" | "bad key" | "no location" | "bad location format" |
  "location not found" | "no network response" | "no api response" | 
  "bad api response - non json" | "bad api response" | "no reponse body" | 
  "no respone data" | "unusal payload" | "key blocked"| "unknown" | "bad status code";
type NiceErrorDetail = {
  [key in ErrorDetail]: string;
}