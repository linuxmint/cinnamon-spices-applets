/**
 * @param path Filename without extension
 */
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
const { LinearGradient } = imports.cairo;
const Lang: typeof imports.lang = imports.lang;
// http://developer.gnome.org/glib/unstable/glib-The-Main-Event-Loop.html
//const Main: typeof imports.ui.main = imports.ui.main;
const keybindingManager = imports.ui.main.keybindingManager;

const { timeout_add_seconds } = imports.mainloop;
// http://developer.gnome.org/libsoup/stable/libsoup-client-howto.html
//const Soup: typeof imports.gi.Soup = imports.gi.Soup;
const { Message, Session, ProxyResolverDefault, SessionAsync } = imports.gi.Soup;
// http://developer.gnome.org/st/stable/
//const St: typeof imports.gi.St = imports.gi.St;
const { Bin, DrawingArea, BoxLayout, Side, IconType, Label, Icon, Button } = imports.gi.St;
const { get_language_names } = imports.gi.GLib;
// * /usr/share/cinnamon/js/
const { TextIconApplet, AllowedLayout, AppletPopupMenu, MenuItem} = imports.ui.applet;
const { PopupMenuManager } = imports.ui.popupMenu;
const { AppletSettings, BindingDirection } = imports.ui.settings;
const { spawnCommandLine, spawn_async } = imports.misc.util;
const { SystemNotificationSource, Notification } = imports.ui.messageTray;
const { messageTray } = imports.ui.main;

var utils = importModule("utils");
var GetDayName = utils.GetDayName as (date: Date, locale:string, tz?: string) => string;
var GetHoursMinutes = utils.GetHoursMinutes as (date: Date, locale: string, hours24Format: boolean, tz?: string) => string;
var capitalizeFirstLetter = utils.capitalizeFirstLetter as (description: string) => string;
var TempToUserUnits = utils.TempToUserUnits as (kelvin: number, units: WeatherUnits) => number;
var PressToUserUnits = utils.PressToUserUnits as (hpa: number, units: WeatherPressureUnits) => number;
var compassDirection = utils.compassDirection as (deg: number) => string;
var MPStoUserUnits = utils.MPStoUserUnits as (mps: number, units: WeatherWindSpeedUnits) => number;
var nonempty = utils.nonempty as (str: string) => boolean;
var AwareDateString = utils.AwareDateString as (date: Date, locale: string, hours24Format: boolean) => string;
const delay = utils.delay as (ms: number) => Promise<void>;

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

type Services = "OpenWeatherMap" | "DarkSky" | "MetNorway" | "Weatherbit";
type ServiceMap = {
  [key: string]: Services
}
type ServiceDescriptions = {
  [key in Services]: string
}
// Settings keys
const DATA_SERVICE: ServiceMap = {
  OPEN_WEATHER_MAP: "OpenWeatherMap",
  DARK_SKY: "DarkSky",
  MET_NORWAY: "MetNorway",
  WEATHERBIT: "Weatherbit"
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
  WEATHER_MANUAL_LOCATION:  "manualLocation",
  WEATHER_USE_CCUSTOM_APPLETICONS_KEY: 'useCustomAppletIcons'
}

/*var custom_icons = ["Cloud-Drizzle" , "Cloud-Drizzle-Alt" , "Cloud-Drizzle-Moon-Alt", "Cloud-Drizzle-Moon", "Cloud-Drizzle-Sun-Alt", 
"Cloud-Drizzle-Sun", "Cloud-Fog", "Cloud-Fog-Alt", "Cloud-Fog-Moon-Alt", "Cloud-Fog-Moon", "Cloud-Fog-Sun-Alt",
"Cloud-Fog-Sun", "Cloud-Fog", "Cloud-Hail-Alt", "Cloud-Hail-Moon-Alt", "Cloud-Hail-Moon", 
"Cloud-Hail-Sun-Alt", "Cloud-Hail-Sun", "Cloud-Hail", "Cloud-Lightning-Moon", "Cloud-Lightning-Sun", 
"Cloud-Lightning", "Cloud-Moon", "Cloud-Rain-Alt", "Cloud-Rain-Moon-Alt", "Cloud-Rain-Moon", 
"Cloud-Rain", "Cloud-Rain-Sun", "Cloud-Rain-Sun-Alt", "Cloud-Refresh", "Cloud-Snow-Alt", "Cloud-Snow-Moon-Alt","Cloud-Snow-Moon", 
"Cloud-Snow-Sun-Alt", "Cloud-Snow-Sun", "Cloud-Snow", "Cloud-Sun", "Cloud-Upload", "Cloud-Wind-Moon", 
"Cloud-Wind-Sun", "Cloud-Wind", "Cloud", "Compass-East", "Compass-North", "Compass-South", "Compass-West",
"Compass", "Degrees-Celcius", "Degrees-Fahrenheit", "Moon", "Shades", "Snowflake", 
"Sun", "Thermometer-25", "Thermometer-50", "Wind",
"Thermometer-75", "Thermometer-100", "Thermometer-Zero", "Thermometer", "Tornado", "Umbrella"];*/

//----------------------------------------------------------------------
//
// Weather Applet
//
//----------------------------------------------------------------------

imports.gettext.bindtextdomain(UUID, imports.gi.GLib.get_home_dir() + "/.local/share/locale");
function _(str: string): string {
  return imports.gettext.dgettext(UUID, str)
}

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

var weatherAppletGUIDs: GUIDStore = {};

class WeatherApplet extends TextIconApplet {
  /** Stores all weather information */
  private weather: Weather = {
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
      customIcon: null
    },
  }

  /** Stores all forecast information */
  private forecasts: Array < ForecastData > = [];

  ///////////////////////////////////////////////////////////////////////
  ///////////////////////////////////////////////////////////////////////  

  // UI elements
  private _currentWeather: imports.gi.St.Bin;
  private _separatorArea: imports.gi.St.DrawingArea;
  private _futureWeather: imports.gi.St.Bin;
  private _applet_context_menu: any;
  private _currentWeatherIcon: imports.gi.St.Icon;
  private _currentWeatherSummary: imports.gi.St.Label;
  private _currentWeatherLocation: imports.gi.St.Button;
  private _currentWeatherSunrise: imports.gi.St.Label;
  private _currentWeatherSunset: imports.gi.St.Label;
  private _currentWeatherTemperature: imports.gi.St.Label;
  private _currentWeatherHumidity: imports.gi.St.Label;
  private _currentWeatherPressure: imports.gi.St.Label;
  private _currentWeatherWind: imports.gi.St.Label;
  private _currentWeatherApiUnique: imports.gi.St.Label;
  private _currentWeatherApiUniqueCap: imports.gi.St.Label;
  private _forecast: ForecastUI[];
  private _forecastBox: imports.gi.St.BoxLayout;

  // Settings properties to bind
  // Settings are public
  public _refreshInterval: number;
  public _manualLocation: boolean;
  public _dataService: Services;
  public _location: string;
  public _translateCondition: boolean;
  public _temperatureUnit: WeatherUnits;
  public _pressureUnit: WeatherPressureUnits;
  public _windSpeedUnit: WeatherWindSpeedUnits;
  public _show24Hours: boolean;
  public _apiKey: string;
  public _forecastDays: number;
  public _verticalOrientation: boolean;
  public _temperatureHighFirst: boolean;
  public _shortConditions: boolean;
  public _showSunrise: boolean;
  public _showCommentInPanel: boolean;
  public _showTextInPanel: boolean;
  public _locationLabelOverride: string;
  public _icon_type: string;
  public _useCustomAppletIcons: boolean;

  public currentLocale: string = null;
  public systemLanguage: string = null;
  public log: Log;

  private keybinding: any;
  private menu: imports.ui.applet.AppletPopupMenu;
  private menuManager: imports.ui.popupMenu.PopupMenuManager;
  private settings: imports.ui.settings.AppletSettings;
  // Soup session (see https://bugzilla.gnome.org/show_bug.cgi?id=661323#c64)
  private _httpSession = new SessionAsync();
  public appletDir = imports.ui.appletManager.appletMeta[UUID].path;
  private msgSource: imports.ui.messageTray.SystemNotificationSource;

  private provider: WeatherProvider; // API
  private locProvider = new ipApi.IpApi(this); // IP location lookup

  /** To check if data is up-to-date based on user-set refresh settings */
  private lastUpdated: Date = new Date(0);
  private orientation: imports.gi.St.Side;
  /** Used for error handling, first error calls dibs
   * and stops diplaying the other errors after.
   * Also used for counting consecutive errors
   */
  private encounteredError: boolean = false;
  /** true on errors when user interaction is required.
   * (usually on settings misconfiguration), every settings change clears it.
   */
  private pauseRefresh: boolean = false;
  /** Slows main loop down on consecutive errors.
   * loop seconds are multpilied by this value on errors.
   */
  private errorCount: number = 0;
  /** in seconds */
  private readonly LOOP_INTERVAL: number = 15;
  private GUID: string;
  private instanceID: number;
  private appletRemoved = false;

  public constructor(metadata: any, orientation: imports.gi.St.Side, panelHeight: number, instanceId: number) {
    super(orientation, panelHeight, instanceId);
    this.instanceID = instanceId;
    this.currentLocale = this.constructJsLocale(get_language_names()[0]);
    this.systemLanguage = this.currentLocale.split('-')[0];
    this.settings = new AppletSettings(this, UUID, instanceId);
    this.log = new Log(instanceId);
    this._httpSession.user_agent = "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:37.0) Gecko/20100101 Firefox/37.0"; // ipapi blocks non-browsers agents, imitating browser
    this.msgSource = new SystemNotificationSource(_("Weather Applet"));
    messageTray.add(this.msgSource);
    Session.prototype.add_feature.call(this._httpSession, new ProxyResolverDefault());
    // Manually add the icons to the icontheme - only one icons folder
    imports.gi.Gtk.IconTheme.get_default().append_search_path(this.appletDir + "/../icons");

    this.SetAppletOnPanel(); 
    this.AddPopupMenu(orientation);
    this.BindSettings();
    this.AddRefreshButton();
    this.BuildPopupMenu();
    // generating unique GUIDs
    this.GUID = uuidv4();
    weatherAppletGUIDs[instanceId] = this.GUID;

    this.rebuild()
    //------------------------------
    // RUN
    //------------------------------
    this.RefreshLoop();

    this.orientation = orientation;
    try {
      this.setAllowedLayout(AllowedLayout.BOTH);
      this.update_label_visible();
    } catch (e) {
      // vertical panel not supported
    }
  }

  private SetAppletOnPanel(): void {
    this.set_applet_icon_name(APPLET_ICON);
    this.set_applet_label(_("..."));
    this.set_applet_tooltip(_("Click to open"));
  }

  private AddPopupMenu(orientation: any) {
    this.menuManager = new PopupMenuManager(this);
    this.menu = new AppletPopupMenu(this, orientation)
    if (typeof this.menu.setCustomStyleClass === "function")
      this.menu.setCustomStyleClass(STYLE_WEATHER_MENU);
    else
    {
      this.menu.actor.add_style_class_name(STYLE_WEATHER_MENU);
    }
    
    this.menuManager.addMenu(this.menu)
  }

  private BindSettings() {
    for (let k in KEYS) {
      let key = KEYS[k];
      let keyProp = "_" + key;
      this.settings.bindProperty(BindingDirection.IN,
        key, keyProp, this.refreshAndRebuild, null);
    }

    // Settings what need special care
    this.settings.bindProperty(BindingDirection.BIDIRECTIONAL,
      WEATHER_LOCATION, ("_" + WEATHER_LOCATION), this.refreshAndRebuild, null);

    this.settings.bindProperty(BindingDirection.IN, "keybinding",
      "keybinding", this._onKeySettingsUpdated, null);

    keybindingManager.addHotKey(
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
  private AddRefreshButton(): void {
     let itemLabel = _("Refresh")
     let refreshMenuItem = new MenuItem(itemLabel, REFRESH_ICON, Lang.bind(this, function () {
       this.refreshAndRebuild();
     }))
     this._applet_context_menu.addMenuItem(refreshMenuItem);
  }

  private BuildPopupMenu(): void {
    //  today's forecast
    this._currentWeather = new Bin({ style_class: STYLE_CURRENT });
    //  tomorrow's forecast
    this._futureWeather = new Bin({ style_class: STYLE_FORECAST });
    //  horizontal rule
    this._separatorArea = new DrawingArea({ style_class: STYLE_POPUP_SEPARATOR_MENU_ITEM });
    this._separatorArea.width = 200
    this._separatorArea.connect(SIGNAL_REPAINT, Lang.bind(this, this._onSeparatorAreaRepaint))
    // build menu
    let mainBox = new BoxLayout({ vertical: true })

    mainBox.add_actor(this._currentWeather)
    mainBox.add_actor(this._separatorArea)
    mainBox.add_actor(this._futureWeather)
    this.menu.addActor(mainBox)
  }

  private refreshAndRebuild(): void {
    this.pauseRefresh = false;
    this.refreshWeather(true);
  };

  /**
   * DEPRECATED - 
   * Handles obtaining JSON over http. 
   * returns HTTPError object on fail.
   * @param query fully constructed url
   */
  public async LoadJsonAsync(query: string): Promise <any> {
    let json = await new Promise((resolve: any, reject: any) => {
      let message = Message.new('GET', query);
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

  public async SpawnProcess(command: string[]): Promise<any> {
    let json = await new Promise((resolve: any, reject: any) => {
      spawn_async(command, (aStdout: any) => {
        resolve(aStdout);
      });
    });
    return json;
  }

  /**
   * Handles obtaining data over http. 
   * returns HTTPError object on fail.
   * @param query fully constructed url
   */
  public async LoadAsync(query: string): Promise <any> {
    let data = await new Promise((resolve: any, reject: any) => {
      let message = Message.new('GET', query);
      this._httpSession.queue_message(message, (session: any, message: any) => {

        if (!message) 
          reject({code: 0, message: "no network response", reason_phrase: "no network response"} as HttpError);

        if (message.status_code != 200) 
          reject({code: message.status_code, message: "bad status code", reason_phrase: message.reason_phrase } as HttpError)
        
        if (!message.response_body) 
          reject({code: message.status_code, message: "no reponse body", reason_phrase: message.reason_phrase} as HttpError);
        
        if (!message.response_body.data) 
          reject({code: message.status_code, message: "no respone data", reason_phrase: message.reason_phrase} as HttpError);
        
        this.log.Debug("API full response: " + message.response_body.data.toString());
        let payload = message.response_body.data;
        resolve(payload);
      });
    });
    return data;
  };

  public sendNotification(title: string, message: string, transient?: boolean) {
    let notification = new Notification(this.msgSource, title, message);
    if (transient) notification.setTransient(true);
    this.msgSource.notify(notification);
  }

  private async locationLookup(): Promise < void > {
    let command = "xdg-open ";
    spawnCommandLine(command + "https://cinnamon-spices.linuxmint.com/applets/view/17");
  }

  private IsDataTooOld(): boolean {
    if (!this.lastUpdated) return true;
    let oldDate = this.lastUpdated;
    // If data is at least twice as old as refreshInterval, return true
    oldDate.setMinutes(oldDate.getMinutes() + (this._refreshInterval * 2));
    return (this.lastUpdated > oldDate);
  }

  /** Refresh Loop */
  private async RefreshLoop(): Promise<void> {
    let loopInterval = this.LOOP_INTERVAL;
    while(true) {
      try {
        this.log.Debug("Loop began")
        if (this.appletRemoved == true) return;
        this.log.Debug("Applet GUID: " + this.GUID);
        this.log.Debug("GUID stored globally: " +  weatherAppletGUIDs[this.instanceID]);
        if (this.GUID != weatherAppletGUIDs[this.instanceID]) {
          this.log.Print("GUID mismatch, terminating applet")
          return;
        }

        if (this.encounteredError) {
          this.encounteredError = false;
          this.errorCount++;
          this.log.Debug("Encountered error in previous loop");
        }
      
        // Limiting count so timeout does not expand forever
        if (this.errorCount > 60) this.errorCount = 60;
        // Linearly increasing timeout on consecutive errors
        loopInterval = (this.errorCount > 0) ? loopInterval*this.errorCount : this.LOOP_INTERVAL; // Increase loop timeout linearly with the number of errors
    
        if (this.pauseRefresh == true) {
          this.log.Debug("Configuration error, updating paused")
          await delay(loopInterval * 1000);
          continue;
        }

        let nextUpdate = new Date(this.lastUpdated.getTime() + this._refreshInterval * 60000);
        if (this.errorCount > 0 || nextUpdate < new Date()) {
          this.log.Debug("Refresh triggered in mainloop with these values: lastUpdated " + ((!this.lastUpdated) ? "null" : this.lastUpdated.toLocaleString()) + ", errorCount " + this.errorCount.toString() + " , loopInterval " + loopInterval.toString() + " seconds, refreshInterval " + this._refreshInterval + " minutes");
          let state = await this.refreshWeather(false);
          if (state == "success") {
            this.lastUpdated = new Date();
          }
        }
        else {
          this.log.Debug("No need to update yet, skipping")
        }
      } catch (e) {
        this.log.Error("Error in Main loop: " + e);
        this.encounteredError = true;
      }

      await delay(loopInterval * 1000);
    }
  };

  // Applet Overrides
  private update_label_visible(): void {
    if (this.orientation == Side.LEFT || this.orientation == Side.RIGHT)
      this.hide_applet_label(true);
    else
      this.hide_applet_label(false);
  };

  private on_orientation_changed(orientation: imports.gi.St.Side) {
    this.orientation = orientation;
    this.refreshWeather(true);
  };

  private _onKeySettingsUpdated(): void {
    if (this.keybinding != null) {
      keybindingManager.addHotKey(UUID,
        this.keybinding,
        Lang.bind(this,
          this.on_applet_clicked))
    }
  }

  private on_applet_removed_from_panel(deleteConfig: any) {
    this.log.Print("Removing applet instance...")
    this.appletRemoved = true;
  }

  private on_applet_clicked(event: any): void {
    this.menu.toggle()
  }

  private _onSeparatorAreaRepaint(area: any) {
    let cr = area.get_context()
    let themeNode = area.get_theme_node()
    let [width, height] = area.get_surface_size()
    let margin = themeNode.get_length('-margin-horizontal')
    let gradientHeight = themeNode.get_length('-gradient-height')
    let startColor = themeNode.get_color('-gradient-start')
    let endColor = themeNode.get_color('-gradient-end')
    let gradientWidth = (width - margin * 2)
    let gradientOffset = (height - gradientHeight) / 2
    let pattern = new LinearGradient(margin, gradientOffset, width - margin, gradientOffset + gradientHeight)
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

  /*private async IconTest() : Promise<void> {
    for (let i = 0; i < custom_icons.length; i++) {
      await delay(1000);
      this.SetCustomIcon(custom_icons[i] as CustomIcons);
    }
    
  }*/

  private updateIconType(): void {
    this._icon_type = this.settings.getValue(WEATHER_USE_SYMBOLIC_ICONS_KEY) ?
      IconType.SYMBOLIC :
      IconType.FULLCOLOR
  };

  private constructJsLocale(locale: string): string {
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
  private async refreshWeather(rebuild: boolean): Promise <RefreshState> {
    this.encounteredError = false;

    let locationData: LocationData = null;
    try {
      locationData = await this.ValidateLocation();
    }
    catch(e) {
      this.log.Error(e);
      return "error";
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
        case DATA_SERVICE.MET_NORWAY:         // No TZ or city info
          if (metNorway == null) var metNorway = importModule("met_norway");
          this.provider = new metNorway.MetNorway(this);
          break;
        case DATA_SERVICE.WEATHERBIT:
          if (weatherbit == null) var weatherbit = importModule("weatherbit");
          this.provider = new weatherbit.Weatherbit(this);
          break;
        default:
          return "error";
      }

      let weatherInfo = await this.provider.GetWeather();
      if (!weatherInfo) {
        this.log.Error("Unable to obtain Weather Information");
        return "failure";
      }

      this.wipeCurrentData();
      this.wipeForecastData();
      this.ProcessWeatherData(weatherInfo, locationData);

      if (rebuild) this.rebuild();
      if (!await this.displayWeather() || !await this.displayForecast()) return;
      this.log.Print("Weather Information refreshed");
      this.errorCount = 0;
      //this.IconTest();
      return "success";
    } 
    catch (e) {
      this.log.Error("Generic Error while refreshing Weather info: " + e);
      this.HandleError({type: "hard", detail: "unknown", message: _("Unexpected Error While Refreshing Weather, please see log in Looking Glass")});
      return "failure";
    }
  };

  /** 
   * @returns LocationData when automatic Location is on,
   * null if manual location is on and throws and error
   * if there is an issue with any of them
   */
  private async ValidateLocation(): Promise<LocationData> {
    // Autmatic location
    let location: LocationData = null;
    if (!this._manualLocation) { 
      location = await this.locProvider.GetLocation();
      if (!location) throw new Error(null);

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
          userError: true,
          message: _("Make sure you entered a location or use Automatic location instead")});
        throw new Error("No location given when setting is on Manual Location");
      }
    }
    return null;
  }

  /** Injects Data into Weather and Forecast Objects to display later */
  private ProcessWeatherData(weatherInfo: WeatherData, locationData: LocationData) {
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
    if (!!weatherInfo.location.url) this.weather.location.url = weatherInfo.location.url;
    if (!!weatherInfo.extra_field) this.weather.extra_field = weatherInfo.extra_field;
    this.forecasts = weatherInfo.forecasts;

    // Estimation
    //this.weather.location.tzOffset = Math.round(this.weather.coord.lon/15) * 3600;
  }

  /** Injects data from weather object into the popupMenu */
  private displayWeather(): boolean {
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
        descriptionCondition = this.weather.condition.description;
        if (this._translateCondition) {
          descriptionCondition = capitalizeFirstLetter(_(descriptionCondition));
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

      this.set_applet_tooltip(location + " - " + _("Updated") + " " + AwareDateString(this.weather.date, this.currentLocale, this._show24Hours));

      // Weather Condition
      this._currentWeatherSummary.text = descriptionCondition;

      // Weather icon
      let iconname = this.weather.condition.icon;
      if (iconname == null) {
        iconname = "weather-severe-alert";
      }
      this._currentWeatherIcon.icon_name = iconname;
      this._icon_type == IconType.SYMBOLIC ?
        this.set_applet_icon_symbolic_name(iconname) :
        this.set_applet_icon_name(iconname)
      if (this._useCustomAppletIcons) this.SetCustomIcon(this.weather.condition.customIcon);

      // Temperature
      let temp = "";
      if (this.weather.temperature != null) {
        temp = TempToUserUnits(this.weather.temperature, this._temperatureUnit).toString();
        this._currentWeatherTemperature.text = temp + ' ' + this.unitToUnicode(this._temperatureUnit);
      }

      let label = "";
      if (this.orientation != Side.LEFT && this.orientation != Side.RIGHT) {
        if (this._showCommentInPanel) {
          label += mainCondition;
        }
        if (this._showTextInPanel) {
          if (label != "") {
            label += " ";
          }
          label += (temp + ' ' + this.unitToUnicode(this._temperatureUnit));
        }
      }
      else {
        if (this._showTextInPanel) {
          label = temp;
        }
        // Vertical panel width is more than this value then we has space
        // to show units
        if (this.panel._getScaledPanelHeight() >= 35) {
          label += this.unitToUnicode(this._temperatureUnit);
        }
      }
      // Set Applet Label, even if the variables are empty
      this.set_applet_label(label);

      // Displaying humidity
      if (this.weather.humidity != null) {
        this._currentWeatherHumidity.text = Math.round(this.weather.humidity) + "%";
      }

      // Wind
      let wind_direction = compassDirection(this.weather.wind.degree);
      this._currentWeatherWind.text =
        (wind_direction != undefined ? _(wind_direction) + " " : "") +
        MPStoUserUnits(this.weather.wind.speed, this._windSpeedUnit) +
        " " +
        _(this._windSpeedUnit);

      // API Unique display
      this._currentWeatherApiUnique.text = "";
      this._currentWeatherApiUniqueCap.text = "";
      if (!!this.weather.extra_field) {
        this._currentWeatherApiUniqueCap.text = _(this.weather.extra_field.name) + ":";
        let value;
        switch (this.weather.extra_field.type) {
          case "percent":
            value = this.weather.extra_field.value.toString() + "%";
            break;
          case "temperature":
            value = TempToUserUnits(this.weather.extra_field.value, this._temperatureUnit) + this.unitToUnicode(this._temperatureUnit);
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
  private displayForecast(): boolean {
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
        forecastUi.Temperature.text = first_temperature + ' ' + '\u002F' + ' ' + second_temperature + ' ' + this.unitToUnicode(this._temperatureUnit);
        forecastUi.Summary.text = comment;
        forecastUi.Icon.icon_name = forecastData.condition.icon;
      }
      return true;
    } catch (e) {
        this.log.Error("DisplayForecastError " + e);
      return false;
    }
  };

  /** Reset weather object */
  private wipeCurrentData(): void {
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

  /** Reset forecasts array */
  private wipeForecastData(): void {
    this.forecasts = [];
  };

  /** Destroys current weather UI box */
  private destroyCurrentWeather(): void {
    if (this._currentWeather.get_child() != null)
      this._currentWeather.get_child().destroy()
  }

  /** Destroys forecast UI box */
  private destroyFutureWeather(): void {
    if (this._futureWeather.get_child() != null)
      this._futureWeather.get_child().destroy()
  }

  /** Destroys UI first then shows initial UI */
  private showLoadingUi(): void {
    this.destroyCurrentWeather()
    this.destroyFutureWeather()
    this._currentWeather.set_child(new Label({
      text: _('Loading current weather ...')
    }))
    this._futureWeather.set_child(new Label({
      text: _('Loading future weather ...')
    }))
  }

  /** Fully rebuilds UI */
  private rebuild(): void {
    this.showLoadingUi()
    this.rebuildCurrentWeatherUi()
    this.rebuildFutureWeatherUi()
  }

  private rebuildCurrentWeatherUi(): void {
    this.destroyCurrentWeather()
    let textOb = {
      text: ELLIPSIS
    }

    // This will hold the icon for the current weather
    this._currentWeatherIcon = new Icon({
      icon_type: this._icon_type,
      icon_size: 64,
      icon_name: APPLET_ICON,
      style_class: STYLE_ICON
    })

    // Current Weather Middle Column
    this._currentWeatherLocation = new Button({ reactive: true, label: _('Refresh'), });
    this._currentWeatherLocation.style_class = STYLE_LOCATION_LINK;
    this._currentWeatherLocation.connect(SIGNAL_CLICKED, Lang.bind(this, function () {
      if (this._currentWeatherLocation.url == null) {
        this.refreshWeather();
      } else {
        imports.gi.Gio.app_info_launch_default_for_uri(
          this._currentWeatherLocation.url,
          global.create_app_launch_context()
        )
      }
    }));

    this._currentWeatherSummary = new Label({ text: _('Loading ...'), style_class: STYLE_SUMMARY })

    this._currentWeatherSunrise = new Label(textOb)
    this._currentWeatherSunset = new Label(textOb)
    let ab_spacerlabel = new Label({ text: BLANK })
    let bb_spacerlabel = new Label({ text: BLANK })

    let sunBox = new BoxLayout({ style_class: STYLE_ASTRONOMY })
    sunBox.add_actor(this._currentWeatherSunrise)
    sunBox.add_actor(ab_spacerlabel)
    sunBox.add_actor(this._currentWeatherSunset)

    let middleColumn = new BoxLayout({ vertical: true, style_class: STYLE_SUMMARYBOX })
    middleColumn.add_actor(this._currentWeatherLocation)
    middleColumn.add_actor(this._currentWeatherSummary)
    middleColumn.add_actor(bb_spacerlabel)
    middleColumn.add_actor(sunBox)

    // Current Weather Right Column
    this._currentWeatherTemperature = new Label(textOb)
    this._currentWeatherHumidity = new Label(textOb)
    this._currentWeatherPressure = new Label(textOb)
    this._currentWeatherWind = new Label(textOb)
    this._currentWeatherApiUnique = new Label({ text: '' })
    // APi Unique Caption
    this._currentWeatherApiUniqueCap = new Label({ text: '' });

    let rb_captions = new BoxLayout({ vertical: true, style_class: STYLE_DATABOX_CAPTIONS })
    let rb_values = new BoxLayout({vertical: true, style_class: STYLE_DATABOX_VALUES })
    rb_captions.add_actor(new Label({ text: _('Temperature:') }));
    rb_captions.add_actor(new Label({ text: _('Humidity:') }));
    rb_captions.add_actor(new Label({ text: _('Pressure:') }));
    rb_captions.add_actor(new Label({ text: _('Wind:') }));
    rb_captions.add_actor(this._currentWeatherApiUniqueCap);
    rb_values.add_actor(this._currentWeatherTemperature);
    rb_values.add_actor(this._currentWeatherHumidity);
    rb_values.add_actor(this._currentWeatherPressure);
    rb_values.add_actor(this._currentWeatherWind);
    rb_values.add_actor(this._currentWeatherApiUnique);

    let rightColumn = new BoxLayout({ style_class: STYLE_DATABOX });
    rightColumn.add_actor(rb_captions);
    rightColumn.add_actor(rb_values);

    // Current Weather Main Boxes
    let weatherBox = new BoxLayout();
    weatherBox.add_actor(middleColumn)
    weatherBox.add_actor(rightColumn)

    let box = new BoxLayout({ style_class: STYLE_ICONBOX })
    box.add_actor(this._currentWeatherIcon)
    box.add_actor(weatherBox)
    this._currentWeather.set_child(box)
  };

  private rebuildFutureWeatherUi(): void {
    this.destroyFutureWeather();

    this._forecast = []
    this._forecastBox = new BoxLayout({
      vertical: this._verticalOrientation,
      style_class: STYLE_FORECAST_CONTAINER
    })
    this._futureWeather.set_child(this._forecastBox)

    for (let i = 0; i < this._forecastDays; i++) {
      let forecastWeather: ForecastUI = {
        Icon: new Icon,
        Day: new Label,
        Summary: new Label,
        Temperature: new Label,
      }

      forecastWeather.Icon = new Icon({
        icon_type: this._icon_type,
        icon_size: 48,
        icon_name: APPLET_ICON,
        style_class: STYLE_FORECAST_ICON
      })

      forecastWeather.Day = new Label({ style_class: STYLE_FORECAST_DAY })
      forecastWeather.Summary = new Label({ style_class: STYLE_FORECAST_SUMMARY })
      forecastWeather.Temperature = new Label({ style_class: STYLE_FORECAST_TEMPERATURE })

      let dataBox = new BoxLayout({ vertical: true, style_class: STYLE_FORECAST_DATABOX })
      dataBox.add_actor(forecastWeather.Day)
      dataBox.add_actor(forecastWeather.Summary)
      dataBox.add_actor(forecastWeather.Temperature)

      let forecastBox = new BoxLayout({
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

  public noApiKey(): boolean {
    if (this._apiKey == undefined || this._apiKey == "") {
      return true;
    }
    return false;
  };

  public SetCustomIcon(iconName: CustomIcons): void {
    this.set_applet_icon_symbolic_name(iconName + "-symbolic");
  }

  private unitToUnicode(unit: WeatherUnits): string {
    return unit == "fahrenheit" ? '\u2109' : '\u2103'
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

  private errMsg: NiceErrorDetail = { // Error messages to use
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
    "import error": _("Missing Packages")
  }

  public HandleError(error: AppletError): void {
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

    if (error.userError) {
      this.pauseRefresh = true;
      return;
    }

    let nextRefresh = (this.errorCount > 0) ? this.errorCount++ *this.LOOP_INTERVAL : this.LOOP_INTERVAL;
    this.log.Error("Retrying in the next " + nextRefresh.toString() + " seconds..." );
  }

  /** Callback handles any service specific logic */
  public HandleHTTPError(service: ApiService, error: HttpError, ctx: WeatherApplet, callback?: (error: HttpError, uiError: AppletError) => AppletError) {
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
  private ID: number;
  private debug: boolean = false;
  private appletDir: string;

  constructor(_instanceId: number) {
    this.ID = _instanceId;
    this.appletDir = imports.ui.appletManager.appletMeta[UUID].path;
    this.debug = this.DEBUG();
  }

  private DEBUG(): boolean {
    let path = this.appletDir + "/../DEBUG";
    let _debug = imports.gi.Gio.file_new_for_path(path);
    let result = _debug.query_exists(null);
    if (result) this.Print("DEBUG file found in " + path + ", enabling Debug mode");
    return result;
  };

  Print(message: string): void {
    let msg = "[" + UUID + "#" + this.ID + "]: " + message.toString();
    let debug = "";
    if (this.debug) {
      debug = this.GetErrorLine();
      global.log(msg, '\n', "On Line:", debug);
    } else {
      global.log(msg);
    }
  }

  Error(error: string): void {
    global.logError("[" + UUID + "#" + this.ID + "]: " + error.toString(), '\n', "On Line:", this.GetErrorLine());
  };

  Debug(message: string): void {
    if (this.debug) {
      this.Print(message);
    }
  }

  private GetErrorLine(): string {
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

function main(metadata: any, orientation: imports.gi.St.Side, panelHeight: number, instanceId: number) {
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
    customIcon: CustomIcons
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
    customIcon: CustomIcons
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
  condition: Condition
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
  condition: Condition
}

interface LocationData {
  lat: number,
  lon: number,
  city: string,
  country: string,
  timeZone: string,
  mobile: boolean
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

type CustomIcons = "Cloud-Drizzle" | "Cloud-Drizzle-Alt" | "Cloud-Drizzle-Moon-Alt" | "Cloud-Drizzle-Moon" | "Cloud-Drizzle-Sun-Alt" | 
"Cloud-Drizzle-Sun" | "Cloud-Fog" | "Cloud-Fog-Alt" | "Cloud-Fog-Moon-Alt" | "Cloud-Fog-Moon" | "Cloud-Fog-Sun-Alt" |
"Cloud-Fog-Sun" | "Cloud-Fog" | "Cloud-Hail-Alt" | "Cloud-Hail-Moon-Alt" | "Cloud-Hail-Moon" | 
"Cloud-Hail-Sun-Alt" | "Cloud-Hail-Sun" | "Cloud-Hail" | "Cloud-Lightning-Moon" | "Cloud-Lightning-Sun" | 
"Cloud-Lightning" | "Cloud-Moon" | "Cloud-Rain-Alt" | "Cloud-Rain-Moon-Alt" | "Cloud-Rain-Moon" | 
"Cloud-Rain" | "Cloud-Rain-Sun" | "Cloud-Rain-Sun-Alt" | "Cloud-Refresh" | "Cloud-Snow-Alt" | "Cloud-Snow-Moon-Alt" | "Cloud-Snow-Moon" | 
"Cloud-Snow-Sun-Alt" | "Cloud-Snow-Sun" | "Cloud-Snow" | "Cloud-Sun" | "Cloud-Upload" | "Cloud-Wind-Moon" | 
"Cloud-Wind-Sun" | "Cloud-Wind" | "Cloud" | "Compass-East" | "Compass-North" | "Compass-South" | "Compass-West" | 
"Compass" | "Degrees-Celcius" | "Degrees-Fahrenheit" | "Moon" | "Shades" | "Snowflake" | 
"Sun"  | "Thermometer-25" | "Thermometer-50" | "Wind" |
"Thermometer-75" | "Thermometer-100" | "Thermometer-Zero" | "Thermometer" | "Tornado" | "Umbrella";

type CustomSunOptions = "Sun-Low" | "Sun-Lower"| "Sunrise" | "Sunset";
type CustomMoonOptions = "Moon-First-Quarter" | "Moon-Full" | "Moon-Last-Quarter" | "Moon-New" | 
"Moon-Waning-Crescent" | "Moon-Waning-Gibbous" | "Moon-Waxing-Crescent" | "Moon-Waxing-Gibbous";

/**
 * A WeatherProvider must implement this interface.
 */
interface WeatherProvider {
  GetWeather(): Promise<WeatherData>;
  /** Used as to extend the same named function in the Applet Class.
   * 
   * "this" (context) is not accessible here
  */
  HandleHTTPError?:(error: HttpError, uiError: AppletError) => AppletError;
}

interface AppletError {
  type: ErrorSeverity;
  /** Stops Refresh completely until settings have changed */
  userError?: boolean;
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

type RefreshState = "success" | "failure" | "error";

/** hard will not force a refresh and cleans the applet ui.
 * 
 *  soft will show a subtle hint that the refresh failed (NOT IMPLEMENTED)
 */
type ErrorSeverity = "hard" |  "soft";
type ApiService = "ipapi" | "darksky" | "openweathermap" | "met-norway" | "weatherbit";
type ErrorDetail = "no key" | "bad key" | "no location" | "bad location format" |
  "location not found" | "no network response" | "no api response" | 
  "bad api response - non json" | "bad api response" | "no reponse body" | 
  "no respone data" | "unusal payload" | "key blocked"| "unknown" | "bad status code" | "import error";
type NiceErrorDetail = {
  [key in ErrorDetail]: string;
}

interface Condition {
  /** Short description */
  main: string,
  /** Long Description */
  description: string,
  /** GTK icon name */
  icon: string,
  customIcon: CustomIcons
}

type GUIDStore = {
  [key: number]: string
}