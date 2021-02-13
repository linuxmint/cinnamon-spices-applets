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
const { Bin, DrawingArea, BoxLayout, Side, IconType, Label, ScrollView, Icon, Button, Align, Widget } = imports.gi.St;
const { GridLayout, Actor, Orientation } = imports.gi.Clutter;
const { EllipsizeMode, WrapMode } = imports.gi.Pango;
const { get_language_names } = imports.gi.GLib;
const { PolicyType } = imports.gi.Gtk;
const { addTween } = imports.ui.tweener;
// * /usr/share/cinnamon/js/
const { TextIconApplet, AllowedLayout, AppletPopupMenu, MenuItem } = imports.ui.applet;
const { PopupMenuManager, PopupSeparatorMenuItem } = imports.ui.popupMenu;
const { AppletSettings, BindingDirection } = imports.ui.settings;
const { spawnCommandLine, spawn_async, spawnCommandLineAsyncIO } = imports.misc.util;
const { SystemNotificationSource, Notification } = imports.ui.messageTray;
const { SignalManager } = imports.misc.signalManager;
const { messageTray, themeManager } = imports.ui.main;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const ByteArray = imports.byteArray;

var utils = importModule("utils");
var GetDayName = utils.GetDayName as (date: Date, locale: string, showDate: boolean, tz?: string) => string;
var GetHoursMinutes = utils.GetHoursMinutes as (date: Date, locale: string, hours24Format: boolean, tz?: string, onlyHours?: boolean) => string;
var capitalizeFirstLetter = utils.capitalizeFirstLetter as (description: string) => string;
var TempToUserConfig = utils.TempToUserConfig as (kelvin: number, units: WeatherUnits, russianStyle: boolean) => string;
var PressToUserUnits = utils.PressToUserUnits as (hpa: number, units: WeatherPressureUnits) => number;
var compassDirection = utils.compassDirection as (deg: number) => string;
var MPStoUserUnits = utils.MPStoUserUnits as (mps: number, units: WeatherWindSpeedUnits) => string;
var nonempty = utils.nonempty as (str: string) => boolean;
var AwareDateString = utils.AwareDateString as (date: Date, locale: string, hours24Format: boolean, tz?: string, ignoreMinutes?: boolean) => string;
var get = utils.get as (p: string[], o: any) => any;
const delay = utils.delay as (ms: number) => Promise<void>;
var isCoordinate = utils.isCoordinate as (text: any) => boolean;
var setTimeout = utils.setTimeout as (func: any, ms: number) => any;
const clearTimeout = utils.clearTimeout as (id: any) => void;
var MillimeterToUserUnits = utils.MillimeterToUserUnits as (mm: number, distanceUnit: DistanceUnits) => number;
var shadeHexColor = utils.shadeHexColor as (color: string, percent: number) => string;
var MetreToUserUnits = utils.MetreToUserUnits as (m: number, distanceUnit: DistanceUnits) => number;
var constructJsLocale = utils.constructJsLocale as (locale: string) => string;
var _ = utils._ as (str: string) => string;

// This always evaluates to True because "var Promise" line exists inside 
if (typeof Promise != "function") {
    var promisePoly = importModule("promise-polyfill");
    var finallyConstructor = promisePoly.finallyConstructor;
    var setTimeout = promisePoly.setTimeout as (func: any, ms: number) => any;
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

type Services = "OpenWeatherMap" | "DarkSky" | "MetNorway" | "Weatherbit" | "Yahoo" | "Climacell" | "Met Office UK" | "US Weather";
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
    WEATHERBIT: "Weatherbit",
    YAHOO: "Yahoo",
    CLIMACELL: "Climacell",
    MET_UK: "Met Office UK",
    US_WEATHER: "US Weather"
}

//----------------------------------------------------------------------
//
// Weather Applet
//
//----------------------------------------------------------------------

function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/** Stores applet instance's ID's globally,
 * Checked to make sure that instance is 
 * running for one applet ID
 */
var weatherAppletGUIDs: GUIDStore = {};

class WeatherApplet extends TextIconApplet {
    /** Stores all weather information */
    private weather: WeatherData = null;

    ///////////////////////////////////////////////////////////////////////
    ///////////////////////////////////////////////////////////////////////  

    /** Soup session (see https://bugzilla.gnome.org/show_bug.cgi?id=661323#c64) */
    private readonly _httpSession = new SessionAsync();
    /** Running applet's path*/
    public readonly appletDir: string = imports.ui.appletManager.appletMeta[UUID].path;
    private readonly msgSource: imports.ui.messageTray.SystemNotificationSource;

    public readonly currentLocale: string = null;
    public readonly log: Log;
    private readonly loop: WeatherLoop;
    public readonly config: Config;
    public readonly ui: UI;
    private lock = false;
    private refreshTriggeredWhileLocked = false;

    private provider: WeatherProvider; // API
    public readonly locProvider = new ipApi.IpApi(this); // IP location lookup
    public readonly geoLocationService = new GeoLocation(this);
    public orientation: imports.gi.St.Side;
    public locationStore: LocationStore = null;
    public displayedHourlyForecasts: number;

	/** Used for error handling, first error calls flips it
	 * to prevents displaying other errors in the current loop.
	 */
    public encounteredError: boolean = false;

    public constructor(metadata: any, orientation: imports.gi.St.Side, panelHeight: number, instanceId: number) {
        super(orientation, panelHeight, instanceId);
        this.log = new Log(instanceId);
		this.currentLocale = constructJsLocale(get_language_names()[0]);
		this.log.Debug("Applet created with instanceID " + instanceId);
        this.log.Debug("System locale is " + this.currentLocale);
        this.log.Debug("Appletdir is: " + this.appletDir);
        this._httpSession.user_agent = "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:37.0) Gecko/20100101 Firefox/37.0"; // ipapi blocks non-browsers agents, imitating browser
        this._httpSession.timeout = 10;
        this._httpSession.idle_timeout = 10;

        // importing custom translations
        imports.gettext.bindtextdomain(UUID, imports.gi.GLib.get_home_dir() + "/.local/share/locale");

        this.msgSource = new SystemNotificationSource(_("Weather Applet"));
        messageTray.add(this.msgSource);
        Session.prototype.add_feature.call(this._httpSession, new ProxyResolverDefault());
        // Manually add the icons to the icon theme - only one icons folder
        imports.gi.Gtk.IconTheme.get_default().append_search_path(this.appletDir + "/../icons");

        this.SetAppletOnPanel();
        this.config = new Config(this, instanceId, this.currentLocale);
        this.AddRefreshButton();
        this.EnsureProvider();
        this.ui = new UI(this, orientation);
        this.ui.rebuild(this.config);
        this.loop = new WeatherLoop(this, instanceId);
        GLib.getenv('XDG_CONFIG_HOME')
        this.locationStore = new LocationStore(this, Lang.bind(this, this.onLocationStorageChanged));

        this.orientation = orientation;
        try {
            this.setAllowedLayout(AllowedLayout.BOTH);
        } catch (e) {
            // vertical panel not supported
        }
        this.loop.Start();
    }

    /** Set applet on the panel with default settings */
    private SetAppletOnPanel(): void {
        this.set_applet_icon_name(APPLET_ICON);
        this.set_applet_label(_("..."));
        this.set_applet_tooltip(_("Click to open"));
    }

    public Locked(): boolean {
        return this.lock;
    }

    private Unlock(): void {
        this.lock = false;
        if (this.refreshTriggeredWhileLocked) {
            this.log.Print("Refreshing triggered by config change while refreshing, starting now...");
            this.refreshTriggeredWhileLocked = false;
            this.refreshAndRebuild();
        }

    }

    /** Into right-click context menu */
    private AddRefreshButton(): void {
        let itemLabel = _("Refresh")
        let refreshMenuItem = new MenuItem(itemLabel, REFRESH_ICON, Lang.bind(this, function() {
            this.refreshAndRebuild();
        }))
        this._applet_context_menu.addMenuItem(refreshMenuItem);
    }

	/**
	 * @returns boolean true if refresh function was locked while called
	 */
    public refreshAndRebuild(loc?: LocationData): void {
        this.loop.Resume();
        if (this.Locked()) {
            this.refreshTriggeredWhileLocked = true;
            return;
        }
        this.refreshWeather(true, loc);
    };

	/**
	 * Handles obtaining JSON over http. 
	 * returns HTTPError object on fail.
	 * @param query fully constructed url
	 * @param errorCallback do checking before generic error checking by this function, to display API specific UI errors
	 */
    public async LoadJsonAsync(query: string, errorCallback?: (message: imports.gi.Soup.Message) => AppletError, triggerUIError: boolean = true): Promise<any> {
        let json: any = await new Promise((resolve, reject) => {
            let message = Message.new('GET', query);
            this.log.Debug("URL called: " + query);
            this._httpSession.queue_message(message, (session, message) => {
                // option for provider to inject errors before general error handling
                let error: AppletError = (errorCallback != null) ? errorCallback(message) : null;
                if (error != null) {
                    this.log.Error("there is an error, " + JSON.stringify(error, null, 2))
                    this.HandleError(error);
                    reject({ code: -1, message: "bad api response", data: null, reason_phrase: "" } as HttpError);
                    return;
                }

                if (!message) {
                    reject({ code: 0, message: "no network response", reason_phrase: "no network response", data: get(["response_body", "data"], message) } as HttpError);
                    return;
                }

                if (message.status_code >= 400 && message.status_code < 500) {
                    reject({ code: message.status_code, message: "bad status code", reason_phrase: message.reason_phrase, data: get(["response_body", "data"], message) } as HttpError);
                    if (triggerUIError == true) this.HandleError({ detail: "bad api response", type: "hard", message: _("API returned status code between 400 and 500") });
                    return;
                }

                if (message.status_code > 300 || message.status_code < 200) {
                    reject({ code: message.status_code, message: "bad status code", reason_phrase: message.reason_phrase, data: get(["response_body", "data"], message) } as HttpError)
                    return;
                }

                if (get(["response_body", "data"], message) == null) {
                    reject({ code: message.status_code, message: "no response data", reason_phrase: message.reason_phrase, data: get(["response_body", "data"], message) } as HttpError);
                    return;
                }

                try {
                    this.log.Debug2("API full response: " + message.response_body.data.toString());
                    let payload = JSON.parse(message.response_body.data);
                    resolve(payload);
                } catch (e) { // Payload is not JSON
                    this.log.Error("Error: API response is not JSON. The response: " + message.response_body.data);
                    reject({ code: message.status_code, message: "bad api response - non json", reason_phrase: e } as HttpError);
                }
            });
        });
        return json;
    };

    /** Spawn a command and await for the output it gives */
    public async SpawnProcess(command: string[]): Promise<any> {
        // prepare command
        let cmd = "";
        for (let index = 0; index < command.length; index++) {
            const element = command[index];
            cmd += "'" + element + "' ";
        }
        try {
            let json = await new Promise((resolve, reject) => {
                spawnCommandLineAsyncIO(cmd, (aStdout: string, err: string, exitCode: number) => {
                    if (exitCode != 0) {
                        reject(err);
                    }
                    else {
                        resolve(aStdout);
                    }
                });
            });
            return json;
        }
        catch(e) {
            this.log.Error("Error calling command " + cmd + ", error: ");
            global.log(e);
            return null;
        }
    }

	/**
	 * Handles obtaining data over http. 
	 * @returns HTTPError object on fail.
	 * @param query fully constructed url
	 */
    public async LoadAsync(query: string): Promise<any> {
        let data = await new Promise((resolve, reject) => {
            let message = Message.new('GET', query);
            this._httpSession.queue_message(message, (session, message) => {

                if (!message) {
                    reject({ code: 0, message: "no network response", reason_phrase: "no network response" } as HttpError);
                    return;
                }

                if (message.status_code > 300 || message.status_code < 200) {
                    reject({ code: message.status_code, message: "bad status code", reason_phrase: message.reason_phrase } as HttpError);
                    return;
                }

                if (!message.response_body) {
                    reject({ code: message.status_code, message: "no response body", reason_phrase: message.reason_phrase } as HttpError);
                    return;
                }

                if (!message.response_body.data) {
                    reject({ code: message.status_code, message: "no response data", reason_phrase: message.reason_phrase } as HttpError);
                    return;
                }

                this.log.Debug2("API full response: " + message.response_body.data.toString());
                let payload = message.response_body.data;
                resolve(payload);
            });
        });
        return data;
    };

    public sendNotification(title: string, message: string, transient?: boolean) {
        let notification = new Notification(this.msgSource, _("Weather Applet") + ": " + title, message);
        if (transient) notification.setTransient((!transient) ? false : true);
        this.msgSource.notify(notification);
    }

    public SetAppletTooltip(msg: string) {
        this.set_applet_tooltip(msg);
    }

    public SetAppletIcon(iconName: string, customIcon: CustomIcons) {
        this.config.IconType() == IconType.SYMBOLIC ?
            this.set_applet_icon_symbolic_name(iconName) :
            this.set_applet_icon_name(iconName)
        if (this.config._useCustomAppletIcons) this.SetCustomIcon(customIcon);
    }

    public SetCustomIcon(iconName: CustomIcons): void {
        this.set_applet_icon_symbolic_name(iconName);
    }

    public SetAppletLabel(label: string) {
        this.set_applet_label(label);
    }

    public GetPanelHeight(): number {
        return this.panel._getScaledPanelHeight();
    }

    private async locationLookup(): Promise<void> {
        let command = "xdg-open ";
        spawnCommandLine(command + "https://cinnamon-spices.linuxmint.com/applets/view/17");
    }

    private async submitIssue(): Promise<void> {
        let command = "xdg-open ";
        spawnCommandLine(command + "https://github.com/linuxmint/cinnamon-spices-applets/issues/new");
    }

    private async saveCurrentLocation(): Promise<void> {
        if (this.config.currentLocation.locationSource == "ip-api") {
            this.sendNotification(_("Error") + " - " + _("Location Store"), _("You can't save a location obtained automatically, sorry"));
        }
        this.locationStore.SaveCurrentLocation(this.config.currentLocation);
    }

    private async deleteCurrentLocation(): Promise<void> {
        this.locationStore.DeleteCurrentLocation(this.config.currentLocation);
    }

    private onLocationStorageChanged(itemCount: number) {
        this.log.Debug("On location storage callback called, number of locations now " + itemCount.toString());
        // Hide/show location selectors based on how many items are in storage
        if (this.locationStore.ShouldShowLocationSelectors(this.config.currentLocation)) this.ui.ShowLocationSelectors();
        else this.ui.HideLocationSelectors();
    }

    public NextLocationClicked() {
        let nextLoc = this.locationStore.NextLocation(this.config.currentLocation);
        if (nextLoc == null) return;
        this.refreshAndRebuild(nextLoc);
    }

    public PreviousLocationClicked() {
        let previousLoc = this.locationStore.PreviousLocation(this.config.currentLocation);
        if (previousLoc == null) return;
        this.refreshAndRebuild(previousLoc);
    }

    /** override function */
    private on_orientation_changed(orientation: imports.gi.St.Side) {
        this.orientation = orientation;
        this.refreshWeather(true);
    };

    /** Override function */
    public _onKeySettingsUpdated(): void {
        if (this.config.keybinding != null) {
            keybindingManager.addHotKey(UUID,
                this.config.keybinding,
                Lang.bind(this, this.on_applet_clicked)
            );
        }
    }

    /** Override function */
    private on_applet_removed_from_panel(deleteConfig: any) {
        // TODO: Proper unload
        //this.unloadStylesheet();
        //Main.keybindingManager.removeHotKey(this.menu_keybinding_name);
        //this.sigMan.disconnectAllSignals();
        //this.settings && this.settings.finalize();
        //$.Debugger.destroy();
        this.log.Print("Removing applet instance...")
        this.loop.Stop();
    }

    /** Override function */
    public on_applet_clicked(event: any): void {
        this.ui.menu.toggle()
    }

    /** Override function */
    private on_applet_middle_clicked(event: any) {

    }

    /** Override function */
    private on_panel_height_changed() {
        // Implemented byApplets
    }

    //----------------------------------------------------------------------
    //
    // Methods
    //
    //----------------------------------------------------------------------

    public OpenUrl(element: imports.gi.St.Button) {
        if (!element.url) return;
        imports.gi.Gio.app_info_launch_default_for_uri(
            element.url,
            global.create_app_launch_context()
        )
    }

    public GetMaxForecastDays(): number {
        if (!this.provider) return this.config._forecastDays;
        return Math.min(this.config._forecastDays, this.provider.maxForecastSupport);
    }

    public GetMaxHourlyForecasts(): number {
        if (!this.provider) return this.config._forecastHours;
        return Math.min(this.config._forecastHours, this.provider.maxHourlyForecastSupport);
    }

	/**
	 * Lazy load provider
	 * @param force Force provider reinitialization
	 */
    private EnsureProvider(force: boolean = false): void {
        let currentName = get(["name"], this.provider) as Services;
        switch (this.config._dataService) {
            case DATA_SERVICE.DARK_SKY:           // No City Info
                if (!darkSky) var darkSky = importModule('darkSky');
                if (currentName != "DarkSky" || force) this.provider = new darkSky.DarkSky(this);
                break;
            case DATA_SERVICE.OPEN_WEATHER_MAP:   // No City Info
                if (!openWeatherMap) var openWeatherMap = importModule("openWeatherMap");
                if (currentName != "OpenWeatherMap" || force) this.provider = new openWeatherMap.OpenWeatherMap(this);
                break;
            case DATA_SERVICE.MET_NORWAY:         // No TZ or city info
                if (!metNorway) var metNorway = importModule("met_norway");
                if (currentName != "MetNorway" || force) this.provider = new metNorway.MetNorway(this);
                break;
            case DATA_SERVICE.WEATHERBIT:
                if (!weatherbit) var weatherbit = importModule("weatherbit");
                if (currentName != "Weatherbit" || force) this.provider = new weatherbit.Weatherbit(this);
                break;
            case DATA_SERVICE.YAHOO:
                if (!yahoo) var yahoo = importModule("yahoo");
                if (currentName != "Yahoo" || force) this.provider = new yahoo.Yahoo(this);
                break;
            case DATA_SERVICE.CLIMACELL:
                if (!climacell) var climacell = importModule("climacell");
                if (currentName != "Climacell" || force) this.provider = new climacell.Climacell(this);
                break;
            case DATA_SERVICE.MET_UK:
                if (!met_uk) var met_uk = importModule("met_uk");
                if (currentName != "Met Office UK" || force) this.provider = new met_uk.MetUk(this);
                break;
            case DATA_SERVICE.US_WEATHER:
                if (!us_weather) var us_weather = importModule("us_weather");
                if (currentName != "US Weather" || force) this.provider = new us_weather.USWeather(this);
                break;
            default:
                return null;
        }
    }

	/**
	 * Main function pulling data
	 * @param rebuild 
	 */
    public async refreshWeather(rebuild: boolean, location?: LocationData): Promise<RefreshState> {
        if (this.lock) {
            this.log.Print("Refreshing in progress, refresh skipped.");
            return "locked";
        }

        this.lock = true;
        this.encounteredError = false;

        let locationData: LocationData = null;
        // General call
        if (location == null) {
            try {
                locationData = await this.config.EnsureLocation();
            }
            catch (e) {
                this.log.Error(e);
                this.Unlock();
                return "error";
            }
        }
        // when user uses the location selectors
        else {
            locationData = location;
            // switching manual location switch to true in this case
            this.config.InjectLocationToConfig(location, true);
        }

        if (locationData == null) {
            // user facing errors are handled by EnsureLocation function
            this.Unlock();
            return "failure";
        }

        try {
            this.EnsureProvider();
            this.weather = null;
            let weatherInfo = await this.provider.GetWeather({ lat: locationData.lat, lon: locationData.lon, text: locationData.lat.toString() + "," + locationData.lon.toString() });
            if (weatherInfo == null) {
                this.log.Error("Unable to obtain Weather Information");
                this.HandleError({
                    type: "hard",
                    detail: "unknown",
                    message: _("Could not get weather information"),
                })
                this.Unlock();
                return "failure";
            }

            weatherInfo = this.FillInWeatherData(weatherInfo, locationData);
            this.weather = weatherInfo;

            if (rebuild) this.ui.rebuild(this.config);
            if (
                !this.ui.displayWeather(weatherInfo, this.config)
                || !this.ui.displayForecast(weatherInfo, this.config)
                || !this.ui.displayHourlyForecast(weatherInfo.hourlyForecasts, this.config, weatherInfo.location.timeZone)
                || !this.ui.displayBar(weatherInfo, this.provider, this.config)) {
                this.Unlock();
                return "failure";
            }

            this.log.Print("Weather Information refreshed");
            this.loop.ResetErrorCount();
            this.Unlock();
            return "success";
        }
        catch (e) {
            this.log.Error("Generic Error while refreshing Weather info: " + e);
            this.HandleError({ type: "hard", detail: "unknown", message: _("Unexpected Error While Refreshing Weather, please see log in Looking Glass") });
            this.Unlock();
            return "failure";
        }
    };

    /** Fills in missing weather info from location Datas  */
    private FillInWeatherData(weatherInfo: WeatherData, locationData: LocationData) {
        if (!weatherInfo.location.city) weatherInfo.location.city = locationData.city;
        if (!weatherInfo.location.country) weatherInfo.location.country = locationData.country;
        if (!weatherInfo.location.timeZone) weatherInfo.location.timeZone = locationData.timeZone;
        if (weatherInfo.coord.lat == null) weatherInfo.coord.lat = locationData.lat;
        if (weatherInfo.coord.lon == null) weatherInfo.coord.lon = locationData.lon;

        weatherInfo.hourlyForecasts = (!weatherInfo.hourlyForecasts) ? [] : weatherInfo.hourlyForecasts;

        // Estimation
        //weatherInfo.location.tzOffset = Math.round(weatherInfo.coord.lon/15) * 3600;
        return weatherInfo;
    }

    ///
    ///  Error Handling in UI
    ///

    private DisplayError(title: string, msg: string): void {
        this.set_applet_label(title);
        this.set_applet_tooltip("Click to open");
        this.set_applet_icon_name("weather-severe-alert");
        this.ui.DisplayErrorMessage(msg);
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
        "no response body": _("Service Error"),
        "no response data": _("Service Error"),
        "unusual payload": _("Service Error"),
        "import error": _("Missing Packages"),
        "location not covered": _("Location not covered"),
    }

    public HandleError(error: AppletError): void {
        if (error == null) return;
        if (this.encounteredError == true) return; // Error Already called in this loop, ignore
        this.encounteredError = true;
        this.log.Debug("User facing Error received, error: " + JSON.stringify(error, null, 2));
        if (error.type == "hard") {
            this.log.Debug("Displaying hard error");
            this.ui.rebuild(this.config);
            this.DisplayError(this.errMsg[error.detail], (!error.message) ? "" : error.message);
        }

        if (error.type == "soft") {
            // Maybe something less invasive on network related errors?
            // Nothing yet
            if (this.loop.IsDataTooOld()) {
                this.set_applet_tooltip("Click to open");
                this.set_applet_icon_name("weather-severe-alert");
                this.ui.DisplayErrorMessage(_("Could not update weather for a while...\nare you connected to the internet?"));
            }
        }

        if (error.userError) {
            this.loop.Pause();
            return;
        }

        let nextRefresh = this.loop.GetSecondsUntilNextRefresh();
        this.log.Error("Retrying in the next " + nextRefresh.toString() + " seconds...");
    }

	/** Callback handles any service specific logic, DEPRECATED.
	 * Callback should be used in LoadJsonAsync function to any Provider specific error handling 
	 */
    public HandleHTTPError(service: ApiService, error: HttpError, ctx: WeatherApplet, override?: (error: HttpError, uiError: AppletError) => AppletError) {
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
            if (!!override && override instanceof Function) {
                uiError = override(error, uiError);
            }
        }
        ctx.HandleError(uiError);
    }
}

class Log {
    private ID: number;
    private debug: boolean = false;
    private level = 1;
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

    Debug2(message: string): void {
        if (this.debug && this.level > 1) {
            this.Print(message);
        }
    }

    private GetErrorLine(): string {
        // Couldn't be more ugly, but it returns the file and line number
        let arr = (new Error).stack.split("\n").slice(-2)[0].split('/').slice(-1)[0];
        return arr;
    }
}

/** Roll-down Popup Menu */
class UI {
    // Separators
    private _separatorArea: imports.ui.popupMenu.PopupSeparatorMenuItem;
    private _separatorArea2: imports.ui.popupMenu.PopupSeparatorMenuItem;
    private _separatorAreaHourly: imports.ui.popupMenu.PopupSeparatorMenuItem;

    //Current Weather
    private _currentWeather: imports.gi.St.Bin;
    private _currentWeatherIcon: imports.gi.St.Icon;
    private _currentWeatherSummary: imports.gi.St.Label;

    private _locationBox: imports.gi.St.BoxLayout;

    private _locationButton: WeatherButton;
    private _currentWeatherLocation: imports.gi.St.Button;

    private _previousLocationButton: WeatherButton;
    private _nextLocationButton: WeatherButton;

    private _currentWeatherSunrise: imports.gi.St.Label;
    private _currentWeatherSunset: imports.gi.St.Label;
    private _currentWeatherTemperature: imports.gi.St.Label;
    private _currentWeatherHumidity: imports.gi.St.Label;
    private _currentWeatherPressure: imports.gi.St.Label;
    private _currentWeatherWind: imports.gi.St.Label;
    private _currentWeatherApiUnique: imports.gi.St.Label;
    private _currentWeatherApiUniqueCap: imports.gi.St.Label;

    // Daily Weather
    private _futureWeather: imports.gi.St.Bin;
    private _forecast: ForecastUI[];
    private _forecastBox: imports.gi.Clutter.GridLayout;

    // Bottom Bar
    private _providerCredit: imports.gi.St.Button;
    private _bar: imports.gi.St.BoxLayout;
    private _hourlyButton: imports.gi.St.Button;
    private _timestamp: imports.gi.St.Label;

    // Hourly Weather
    private _hourlyScrollView: imports.gi.St.ScrollView;
    private _hourlyBox: imports.gi.St.BoxLayout;
    private _hourlyForecasts: HourlyForecastUI[];
    private _hourlyForecastBoxes: imports.gi.St.BoxLayout[];

    // State variables
    private hourlyToggled: boolean = false;
    private lightTheme: boolean = false;

    private app: WeatherApplet;

    /** Rolldown menu itself */
    public menu: imports.ui.applet.AppletPopupMenu;
    private menuManager: imports.ui.popupMenu.PopupMenuManager;
    private signals: imports.misc.signalManager.SignalManager;

    constructor(app: WeatherApplet, orientation: imports.gi.St.Side) {
        this.app = app;
        this.menuManager = new PopupMenuManager(this.app);
        this.menu = new AppletPopupMenu(this.app, orientation);
        // this.menu.setCustomStyleClass and 
        //this.menu.actor.add_style_class_name(STYLE_WEATHER_MENU);
        // Doesn't do shit, setting class on the box instead.
        this.menu.box.add_style_class_name(STYLE_WEATHER_MENU);
        this.app.log.Debug("Popup Menu applied classes are: " + this.menu.box.get_style_class_name());
        this.menuManager.addMenu(this.menu);
        this.menuManager._signals.connect(this.menu, "open-state-changed", this.PopupMenuToggled, this);
        this.signals = new SignalManager();
        this.lightTheme = this.IsLightTheme();
        this.BuildPopupMenu();
        // Subscribe to theme changes
        this.signals.connect(themeManager, 'theme-set', this.OnThemeChanged, this);
    }

	/**
	 * Resetting flags from Hourly scrollview when theme changed to 
	 * prevent incorrect height requests, rebuild 
	 * when switching between light and dark themes
	 * to recolor some of the text
	 */
    private OnThemeChanged(): void {
        this.HideHourlyWeather();
        let newThemeIsLight = this.IsLightTheme();
        // Theme changed between light and dark theme
        if (newThemeIsLight != this.lightTheme) {
            this.lightTheme = newThemeIsLight;
        }
        this.app.refreshAndRebuild();
    }

	/**
	 * 
	 * @param color Background color
	 */
    private IsLightTheme(): boolean {
        // using foreground color, more reliable than background color (more themes has it)
		let color = this.menu.actor.get_theme_node().get_color("color");
        // luminance between 0 and 1
		let luminance = (2126 * color.red + 7152 * color.green + 722 * color.blue) / 10000 / 255;
		// Inverse, we assume the bacground color here
		luminance = Math.abs(1 - luminance);
        this.app.log.Debug("Theme is Light: " + (luminance > 0.5));
        return (luminance > 0.5);
    }

	/**
	 * @returns color in hex styling
	 */
    private ForegroundColor(): string {
        // Get hex color without alpha, because it is not supported in css
        let hex = this.menu.actor.get_theme_node().get_foreground_color().to_string().substring(0, 7);
        return hex;
    }

    private GetTextColorStyle(): string {
        let hexColor = null;
        if (this.lightTheme) {
            // Darken default foreground color
            hexColor = shadeHexColor(this.ForegroundColor(), -0.40);
        }
        return "color: " + hexColor;
    }

    private async PopupMenuToggled(caller: any, data: any) {
        // data - true is opened, false is closed
        if (data == false) {
            await delay(100); // Closing after popup menu is closed 
            this.HideHourlyWeather();
        }
    }

    /** Creates the skeleton of the popup menu */
    private BuildPopupMenu(): void {
        //  Current Weather
        this._currentWeather = new Bin({ style_class: STYLE_CURRENT });
        //  Daily Weather
        this._futureWeather = new Bin({ style_class: STYLE_FORECAST });

        // Separators and removing styling to make them span full width 
        this._separatorArea = new PopupSeparatorMenuItem()
        this._separatorAreaHourly = new PopupSeparatorMenuItem();
        this._separatorArea2 = new PopupSeparatorMenuItem()
        this._separatorArea.actor.remove_style_class_name("popup-menu-item");
        this._separatorAreaHourly.actor.remove_style_class_name("popup-menu-item");
        this._separatorArea2.actor.remove_style_class_name("popup-menu-item");

        // Hourly Weather
        this._hourlyScrollView = new ScrollView(
            {
                hscrollbar_policy: PolicyType.AUTOMATIC,
                vscrollbar_policy: PolicyType.NEVER,
                x_fill: true,
                y_fill: true,
                y_align: Align.MIDDLE,
                x_align: Align.MIDDLE
            }
        );
        this._hourlyScrollView.overlay_scrollbars = true;
        // Stop event passing while scrolling to prevent jankyness
        let vscroll = this._hourlyScrollView.get_vscroll_bar();
        vscroll.connect("scroll-start", () => { this.menu.passEvents = true; });
        vscroll.connect("scroll-stop", () => { this.menu.passEvents = false; });
        let hscroll = this._hourlyScrollView.get_hscroll_bar();
        hscroll.connect("scroll-start", () => { this.menu.passEvents = true; });
        hscroll.connect("scroll-stop", () => { this.menu.passEvents = false; });
        this._separatorAreaHourly.actor.hide();
        this._hourlyScrollView.hide();
        this._hourlyScrollView.set_clip_to_allocation(true);
        this._hourlyBox = new BoxLayout({ style_class: "hourly-box" });
        // Only add_actor works with ScrollView for some reason, not add_child
        // and only BoxLayout results in drawn stuff inside the ScrollView.
        // (Only Boxlayout and Viewport implements St.Scrollable needed inside a scrollview)
        this._hourlyScrollView.add_actor(this._hourlyBox)

        // Bottom bar
        this._bar = new BoxLayout({ vertical: false, style_class: STYLE_BAR });

        // Add everything to the PopupMenu
        let mainBox = new BoxLayout({ vertical: true })
        mainBox.add_actor(this._currentWeather)
        mainBox.add_actor(this._separatorAreaHourly.actor);
        mainBox.add_actor(this._hourlyScrollView);
        mainBox.add_actor(this._separatorArea.actor)
        mainBox.add_actor(this._futureWeather)
        mainBox.add_actor(this._separatorArea2.actor)
        mainBox.add_actor(this._bar)
        this.menu.addActor(mainBox)
    }

    /** Fully rebuilds UI */
    public rebuild(config: Config): void {
        this.showLoadingUi();
        this.rebuildCurrentWeatherUi(config);
        this.rebuildHourlyWeatherUi(config);
        this.rebuildFutureWeatherUi(config);
        this.rebuildBar(config);
    }

	/** Changes all icon's type what are affected by
	 * the "use symbolic icons" setting
	 */
    public UpdateIconType(iconType: imports.gi.St.IconType): void {
        if (iconType == IconType.FULLCOLOR && this.app.config._useCustomMenuIcons) return;
        this._currentWeatherIcon.icon_type = iconType;
        for (let i = 0; i < this._forecast.length; i++) {
            this._forecast[i].Icon.icon_type = iconType;
        }
        for (let i = 0; i < this._hourlyForecasts.length; i++) {
            this._hourlyForecasts[i].Icon.icon_type = iconType;
        }
    }

    public DisplayErrorMessage(msg: string) {
        this._timestamp.text = msg;
    }

    public ShowHourlyWeather(): void {
        // In some cases the preferred height is not calculated
        // properly for the first time, so we work around by opening and closing it once
        this._hourlyScrollView.show();
        this._hourlyScrollView.hide();

        this.AdjustHourlyBoxItemWidth();

        let [minWidth, naturalWidth] = this._hourlyScrollView.get_preferred_width(-1);
        let [minHeight, naturalHeight] = this._hourlyScrollView.get_preferred_height(minWidth);
        this.app.log.Debug("hourlyScrollView requested height and is set to: " + naturalHeight);
        this._hourlyScrollView.set_width(minWidth);
        this._separatorAreaHourly.actor.show();
        if (!!this._hourlyButton.child) this._hourlyButton.child.icon_name = "custom-up-arrow-symbolic";
		this._hourlyScrollView.show();
		// When the srcollView is shown without animation and there is not enough vertical space
		// (or cinnamon does not think there is enough), the text gets superimposed on top of
		// each other.
		// setting the min-height forces to draw with the view's requested height without
		// interfering with animations.
		this._hourlyScrollView.style = "min-height: " + naturalHeight.toString() + "px;";

        if (global.settings.get_boolean("desktop-effects-on-menus")) {
            this._hourlyScrollView.height = 0;
            addTween(this._hourlyScrollView,
                {
                    height: naturalHeight,
                    time: 0.25,
                    onUpdate: () => { },
                    onComplete: () => {
                        this._hourlyScrollView.set_height(naturalHeight);
                    }
                });
        }

        this.hourlyToggled = true;
    }

    public HideHourlyWeather(): void {
        this._separatorAreaHourly.actor.hide();
        let hscroll = this._hourlyScrollView.get_hscroll_bar();
        if (!!this._hourlyButton.child) this._hourlyButton.child.icon_name = "custom-down-arrow-symbolic";
        if (global.settings.get_boolean("desktop-effects-on-menus")) {
            // TODO: eliminate Clutter Warnings on collapse in logs
            addTween(this._hourlyScrollView,
                {
                    height: 0,
                    time: 0.25,
                    onUpdate: () => { },
                    onComplete: () => {
                        this._hourlyScrollView.set_height(-1);
                        this._hourlyScrollView.hide();
                        // Scroll back to the start
                        hscroll.get_adjustment().set_value(0);
                    }
                }
            );
        }
        else {
            this._hourlyScrollView.set_height(-1);
            this._hourlyScrollView.hide();
        }
        this.hourlyToggled = false;
    }

    public ToggleHourlyWeather(): void {
        if (this.hourlyToggled) {
            this.HideHourlyWeather();
        }
        else {
            this.ShowHourlyWeather();
        }
    }

    public ShowLocationSelectors() {
        this._nextLocationButton.actor.show();
        this._previousLocationButton.actor.show();
    }

    public HideLocationSelectors() {
        this._nextLocationButton.actor.hide();
        this._previousLocationButton.actor.hide();
    }

    /** Injects data from weather object into the popupMenu */
    public displayWeather(weather: WeatherData, config: Config): boolean {
        try {
            // Hide/show location selectors based on how many items are in storage
            if (this.app.locationStore.ShouldShowLocationSelectors(config.currentLocation)) this.ShowLocationSelectors();
            else this.HideLocationSelectors();

            let mainCondition = "";
            let descriptionCondition = "";
            // Short Condition Name
            if (weather.condition.main != null) {
                mainCondition = weather.condition.main;
                if (config._translateCondition) {
                    mainCondition = capitalizeFirstLetter(_(mainCondition));
                }
            }
            // Condition Description
            if (weather.condition.description != null) {
                descriptionCondition = capitalizeFirstLetter(weather.condition.description);
                if (config._translateCondition) {
                    descriptionCondition = capitalizeFirstLetter(_(weather.condition.description));
                }
            }

            // Displaying Location   
            let location = "";
            if (weather.location.city != null && weather.location.country != null) {
                location = weather.location.city + ", " + weather.location.country;
            } else {
                location = Math.round(weather.coord.lat * 10000) / 10000 + ", " + Math.round(weather.coord.lon * 10000) / 10000;
            }

            // Overriding Location
            if (nonempty(config._locationLabelOverride)) {
                location = config._locationLabelOverride;
            }

            this.app.SetAppletTooltip(location + " - " + _("As of") + " " + AwareDateString(weather.date, this.app.currentLocale, config._show24Hours));

            // Weather Condition
            this._currentWeatherSummary.text = descriptionCondition;

            // Weather icon
            let iconName = weather.condition.icon;
            if (iconName == null) {
                iconName = "weather-severe-alert";
            }

            // Popup menu icons
            if (config._useCustomMenuIcons) {
                this._currentWeatherIcon.icon_name = weather.condition.customIcon;
                this.UpdateIconType(IconType.SYMBOLIC); // Hard set to symbolic as iconset is symbolic
            }
            else {
                this._currentWeatherIcon.icon_name = iconName;
                this.UpdateIconType(config.IconType()); // Revert to user setting
            }

            // Applet icon
            this.app.SetAppletIcon(iconName, weather.condition.customIcon);

            // Temperature
            let temp = "";
            if (weather.temperature != null) {
                temp = TempToUserConfig(weather.temperature, config.TemperatureUnit(), config._tempRussianStyle);
                this._currentWeatherTemperature.text = temp + " " + this.unitToUnicode(config.TemperatureUnit());
            }

            // Applet panel label
            let label = "";
            // Horizontal panels
            if (this.app.orientation != Side.LEFT && this.app.orientation != Side.RIGHT) {
                if (config._showCommentInPanel) {
                    label += mainCondition;
                }
                if (config._showTextInPanel) {
                    if (label != "") {
                        label += " ";
                    }
                    label += (temp + ' ' + this.unitToUnicode(config.TemperatureUnit()));
                }
            }
            // Vertical panels
            else {
                if (config._showTextInPanel) {
                    label = temp;
                    // Vertical panel width is more than this value then we has space
                    // to show units
                    if (this.app.GetPanelHeight() >= 35) {
                        label += this.unitToUnicode(config.TemperatureUnit());
                    }
                }
            }

            // Overriding temperature panel label
            if (nonempty(config._tempTextOverride)) {
                label = config._tempTextOverride
                    .replace("{t}", temp)
                    .replace("{u}", this.unitToUnicode(config.TemperatureUnit()))
                    .replace("{c}", mainCondition);
            }

            // Set Applet Label, even if the variables are empty
            this.app.SetAppletLabel(label);

            // Displaying humidity
            if (weather.humidity != null) {
                this._currentWeatherHumidity.text = Math.round(weather.humidity) + "%";
            }

            // Wind
            let wind_direction = compassDirection(weather.wind.degree);
            this._currentWeatherWind.text =
                (wind_direction != undefined ? _(wind_direction) + " " : "") +
                MPStoUserUnits(weather.wind.speed, config.WindSpeedUnit());
            // No need to display unit to Beaufort scale
            if (config.WindSpeedUnit() != "Beaufort") this._currentWeatherWind.text += " " + _(config.WindSpeedUnit());

            // API Unique display
            this._currentWeatherApiUnique.text = "";
            this._currentWeatherApiUniqueCap.text = "";
            if (!!weather.extra_field) {
                this._currentWeatherApiUniqueCap.text = _(weather.extra_field.name) + ":";
                let value;
                switch (weather.extra_field.type) {
                    case "percent":
                        value = weather.extra_field.value.toString() + "%";
                        break;
                    case "temperature":
                        value = TempToUserConfig(weather.extra_field.value, config.TemperatureUnit(), config._tempRussianStyle) + " " + this.unitToUnicode(config.TemperatureUnit());
                        break;
                    default:
                        value = _(weather.extra_field.value);
                        break;
                }
                this._currentWeatherApiUnique.text = value;
            }

            // Pressure
            if (weather.pressure != null) {
                this._currentWeatherPressure.text = PressToUserUnits(weather.pressure, config._pressureUnit) + ' ' + _(config._pressureUnit);
            }

            // Location
            this._currentWeatherLocation.label = location;
            this._currentWeatherLocation.url = weather.location.url;
            if (!weather.location.url) this._locationButton.disable();

            // Sunset/Sunrise
            let sunriseText = "";
            let sunsetText = "";
            if (weather.sunrise != null && weather.sunset != null && config._showSunrise) {
                sunriseText = (GetHoursMinutes(weather.sunrise, this.app.currentLocale, config._show24Hours, weather.location.timeZone));
                sunsetText = (GetHoursMinutes(weather.sunset, this.app.currentLocale, config._show24Hours, weather.location.timeZone));
            }

            this._currentWeatherSunrise.text = sunriseText;
            this._currentWeatherSunset.text = sunsetText;
            return true;
        } catch (e) {
            this.app.log.Error("DisplayWeatherError: " + e);
            return false;
        }
    };

    /** Injects data from forecasts array into popupMenu */
    public displayForecast(weather: WeatherData, config: Config): boolean {
        try {
            if (!weather.forecasts) return false;
            let len = Math.min(this._forecast.length, weather.forecasts.length);
            for (let i = 0; i < len; i++) {
                let forecastData = weather.forecasts[i];
                let forecastUi = this._forecast[i];

                let t_low = TempToUserConfig(forecastData.temp_min, config.TemperatureUnit(), config._tempRussianStyle);
                let t_high = TempToUserConfig(forecastData.temp_max, config.TemperatureUnit(), config._tempRussianStyle);

                let first_temperature = config._temperatureHighFirst ? t_high : t_low;
                let second_temperature = config._temperatureHighFirst ? t_low : t_high;

                // Weather Condition
                let comment = "";
                if (forecastData.condition.main != null && forecastData.condition.description != null) {
                    comment = (config._shortConditions) ? forecastData.condition.main : forecastData.condition.description;
                    comment = capitalizeFirstLetter(comment);
                    if (config._translateCondition) comment = _(comment);
                }

                // Day Names
                let dayName: string = GetDayName(forecastData.date, this.app.currentLocale, this.app.config._showForecastDates, weather.location.timeZone);

                forecastUi.Day.text = dayName;
                forecastUi.Temperature.text = first_temperature;
                // As Russian Tradition, -temp...+temp
                // See https://github.com/linuxmint/cinnamon-spices-applets/issues/618
                forecastUi.Temperature.text += ((config._tempRussianStyle) ? ELLIPSIS : " " + FORWARD_SLASH + " ");
                forecastUi.Temperature.text += second_temperature + ' ' + this.unitToUnicode(config.TemperatureUnit());
                forecastUi.Summary.text = comment;
                forecastUi.Icon.icon_name = (config._useCustomMenuIcons) ? forecastData.condition.customIcon : forecastData.condition.icon;
            }
            return true;
        } catch (e) {
            this.app.HandleError({
                type: "hard",
                detail: "unknown",
                message: "Forecast parsing failed: " + e.toString(),
                userError: false
            })
            this.app.log.Error("DisplayForecastError " + e);
            return false;
        }
    };

    public displayBar(weather: WeatherData, provider: WeatherProvider, config: Config): boolean {
        this._providerCredit.label = _("Powered by") + " " + provider.prettyName;
        this._providerCredit.url = provider.website;
        this._timestamp.text = _("As of") + " " + AwareDateString(weather.date, this.app.currentLocale, config._show24Hours);
        if (weather.location.distanceFrom != null) {
            this._timestamp.text += (
                ", " + MetreToUserUnits(weather.location.distanceFrom, this.app.config.DistanceUnit())
                + this.BigDistanceUnitFor(this.app.config.DistanceUnit()) + " " + _("from you")
            );
        }
        return true;
    }

    public displayHourlyForecast(forecasts: HourlyForecastData[], config: Config, tz: string): boolean {
        let max = Math.min(forecasts.length, this._hourlyForecasts.length);
        for (let index = 0; index < max; index++) {
            const hour = forecasts[index];
            const ui = this._hourlyForecasts[index];

            ui.Hour.text = GetHoursMinutes(hour.date, this.app.currentLocale, config._show24Hours, tz, this.app.config._shortHourlyTime);
            ui.Temperature.text = TempToUserConfig(hour.temp, config.TemperatureUnit(), config._tempRussianStyle) + " " + this.unitToUnicode(config.TemperatureUnit());
            ui.Icon.icon_name = (config._useCustomMenuIcons) ? hour.condition.customIcon : hour.condition.icon;

            hour.condition.main = capitalizeFirstLetter(hour.condition.main);
            if (config._translateCondition) hour.condition.main = _(hour.condition.main);
            ui.Summary.text = hour.condition.main;
            if (!!hour.precipitation && hour.precipitation.type != "none") {
                let precipitationText = null;
                if (!!hour.precipitation.volume && hour.precipitation.volume > 0) {
                    precipitationText = MillimeterToUserUnits(hour.precipitation.volume, this.app.config.DistanceUnit()) + " " + ((this.app.config.DistanceUnit() == "metric") ? _("mm") : _("in"));
                }
                if (!!hour.precipitation.chance) {
                    precipitationText = (precipitationText == null) ? "" : (precipitationText + ", ")
                    precipitationText += (Math.round(hour.precipitation.chance).toString() + "%")
                }
                if (precipitationText != null) ui.Precipitation.text = precipitationText;
            }
        }

        this.AdjustHourlyBoxItemWidth();

        if (max <= 0) this.HideHourlyToggle();

        return true;
    }

	/** Calculates incorrect width the first time, make sure to call this
	 * after a show/hide iteration as well when the Hourly box is shown
	 */
    private AdjustHourlyBoxItemWidth(): void {
        let requiredWidth = 0;
        for (let index = 0; index < this._hourlyForecastBoxes.length; index++) {
            const ui = this._hourlyForecasts[index];
            let hourWidth = ui.Hour.get_preferred_width(-1)[1];
            let iconWidth = ui.Icon.get_preferred_width(-1)[1];
            let summaryWidth = ui.Summary.get_preferred_width(-1)[1];
            let temperatureWidth = ui.Temperature.get_preferred_width(-1)[1];
			let precipitationWidth = ui.Precipitation.get_preferred_width(-1)[1];

			// If text is bigger than icon we add some artificial padding
			// so text doesn't look too close
			if (precipitationWidth > iconWidth || summaryWidth > iconWidth) {
				if (precipitationWidth > summaryWidth) 
					precipitationWidth += 10;
				else
					summaryWidth += 10;
			}
            if (requiredWidth < hourWidth) requiredWidth = hourWidth;
            if (requiredWidth < iconWidth) requiredWidth = iconWidth;
            if (requiredWidth < summaryWidth) requiredWidth = summaryWidth;
            if (requiredWidth < temperatureWidth) requiredWidth = temperatureWidth;
            if (requiredWidth < precipitationWidth) requiredWidth = precipitationWidth;
        }

        for (let index = 0; index < this._hourlyForecastBoxes.length; index++) {
            const element = this._hourlyForecastBoxes[index];
            element.set_width(requiredWidth);
        }
    }

    private GetScrollViewHeight(): number {
        let boxItemHeight = 0;
        for (let index = 0; index < this._hourlyForecastBoxes.length; index++) {
            const ui = this._hourlyForecasts[index];

            this.app.log.Debug("Height requests of Hourly box Items: " + index);
            let hourHeight = ui.Hour.get_preferred_height(-1)[1];
            let iconHeight = ui.Icon.get_preferred_height(-1)[1];
            let summaryHeight = ui.Summary.get_preferred_height(-1)[1];
            let temperatureHeight = ui.Temperature.get_preferred_height(-1)[1];
            let precipitationHeight = ui.Precipitation.get_preferred_height(-1)[1];
            let itemheight = hourHeight + iconHeight + summaryHeight + temperatureHeight + precipitationHeight;
            if (boxItemHeight < itemheight) boxItemHeight = itemheight;
        }
        this.app.log.Debug("Final Hourly box item height is: " + boxItemHeight)
        let scrollBarHeight = this._hourlyScrollView.get_hscroll_bar().get_preferred_width(-1)[1];
        this.app.log.Debug("Scrollbar height is " + scrollBarHeight);
        let theme = this._hourlyBox.get_theme_node();
        let styling = theme.get_margin(Side.TOP) + theme.get_margin(Side.BOTTOM) + theme.get_padding(Side.TOP) + theme.get_padding(Side.BOTTOM);
        this.app.log.Debug("ScollbarBox vertical padding and margin is: " + styling);

        return (boxItemHeight + scrollBarHeight + styling);
    }

    private unitToUnicode(unit: WeatherUnits): string {
        return unit == "fahrenheit" ? '\u2109' : '\u2103'
    }

	/**
	 * 
	 * @param unit 
	 * @return km or mi, based on unit
	 */
    private BigDistanceUnitFor(unit: DistanceUnits) {
        if (unit == "imperial") return _("mi");
        return _("km");
    }

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

    private destroyBar(): void {
        this._bar.destroy_all_children();
    }

    private destroyHourlyWeather(): void {
        this._hourlyBox.destroy_all_children();
    }

    /** Destroys UI first then shows initial UI */
    private showLoadingUi(): void {
        this.destroyCurrentWeather()
        this.destroyFutureWeather()
        this.destroyBar()
        this._currentWeather.set_child(new Label({
            text: _('Loading current weather ...')
        }))
        this._futureWeather.set_child(new Label({
            text: _('Loading future weather ...')
        }))
    }

    private rebuildCurrentWeatherUi(config: Config): void {
        this.destroyCurrentWeather()
        let textOb = {
            text: ELLIPSIS
        }

        // This will hold the icon for the current weather
        this._currentWeatherIcon = new Icon({
            icon_type: config.IconType(),
            icon_size: 64,
            icon_name: APPLET_ICON,
            style_class: STYLE_ICON
        })

        // Current Weather Middle Column
        this._locationButton = new WeatherButton({ reactive: true, label: _('Refresh'), });
        this._currentWeatherLocation = this._locationButton.actor;
        this._currentWeatherLocation.connect(SIGNAL_CLICKED, Lang.bind(this, function() {
            if (this.app.encounteredError) this.app.refreshWeather(true);
            else if (this._currentWeatherLocation.url == null) return;
            else this.app.OpenUrl(this._currentWeatherLocation);
        }));

        this._nextLocationButton = new WeatherButton({
            reactive: true,
            can_focus: true,
            child: new Icon({
                icon_type: IconType.SYMBOLIC,
                icon_size: 10,
                icon_name: "custom-right-arrow-symbolic",
                style_class: STYLE_LOCATION_SELECTOR
            }),
        });
        this._nextLocationButton.actor.connect(SIGNAL_CLICKED, Lang.bind(this.app, this.app.NextLocationClicked));

        this._previousLocationButton = new WeatherButton({
            reactive: true,
            can_focus: true,
            child: new Icon({
                icon_type: IconType.SYMBOLIC,
                icon_size: 10,
                icon_name: "custom-left-arrow-symbolic",
                style_class: STYLE_LOCATION_SELECTOR
            }),
        });
        this._previousLocationButton.actor.connect(SIGNAL_CLICKED, Lang.bind(this.app, this.app.PreviousLocationClicked));

        this._locationBox = new BoxLayout();
        this._locationBox.add(this._previousLocationButton.actor, { x_fill: false, x_align: Align.START, y_align: Align.MIDDLE, expand: false });
        this._locationBox.add(this._currentWeatherLocation, { x_fill: true, x_align: Align.MIDDLE, y_align: Align.MIDDLE, expand: true });
        this._locationBox.add(this._nextLocationButton.actor, { x_fill: false, x_align: Align.END, y_align: Align.MIDDLE, expand: false });

        // Sunset/sunrise
        this._currentWeatherSummary = new Label({ text: _('Loading ...'), style_class: STYLE_SUMMARY })
        this._currentWeatherSunrise = new Label({ text: ELLIPSIS, style: this.GetTextColorStyle() })
        this._currentWeatherSunset = new Label({ text: ELLIPSIS, style: this.GetTextColorStyle() })

        let sunriseBox = new BoxLayout();
        let sunsetBox = new BoxLayout();
        if (config._showSunrise) {
            let sunsetIcon = new Icon({
                icon_name: "sunset-symbolic",
                icon_type: IconType.SYMBOLIC,
                icon_size: 25,
                style: this.GetTextColorStyle()
            });

            let sunriseIcon = new Icon({
                icon_name: "sunrise-symbolic",
                icon_type: IconType.SYMBOLIC,
                icon_size: 25,
                style: this.GetTextColorStyle()
            });

            sunriseBox.add_actor(sunriseIcon);
            sunsetBox.add_actor(sunsetIcon);
        }

        let textOptions: imports.gi.St.AddOptions = {
            x_fill: false,
            x_align: Align.START,
            y_align: Align.MIDDLE,
            y_fill: false,
            expand: true
        }

        sunriseBox.add(this._currentWeatherSunrise, textOptions);
        sunsetBox.add(this._currentWeatherSunset, textOptions);

        let ab_spacerlabel = new Label({ text: BLANK })

        let sunBox = new BoxLayout({ style_class: STYLE_ASTRONOMY })
        sunBox.add_actor(sunriseBox)
        sunBox.add_actor(ab_spacerlabel)
        sunBox.add_actor(sunsetBox);

        let middleColumn = new BoxLayout({ vertical: true, style_class: STYLE_SUMMARYBOX })
        middleColumn.add_actor(this._locationBox)
        middleColumn.add(this._currentWeatherSummary, { expand: true, x_align: Align.START, y_align: Align.MIDDLE, x_fill: false, y_fill: false })

        // Bin is used here to horizontally center BoxLayout inside BoxLayout, normal add() function does not work here 
        let sunBin = new Bin();
        sunBin.set_child(sunBox);
        middleColumn.add_actor(sunBin);

        // Current Weather Right Column
        this._currentWeatherTemperature = new Label(textOb)
        this._currentWeatherHumidity = new Label(textOb)
        this._currentWeatherPressure = new Label(textOb)
        this._currentWeatherWind = new Label(textOb)
        this._currentWeatherApiUnique = new Label({ text: '' })
        // APi Unique Caption
        this._currentWeatherApiUniqueCap = new Label({ text: '', style: this.GetTextColorStyle() });

        let rb_captions = new BoxLayout({ vertical: true, style_class: STYLE_DATABOX_CAPTIONS })
        let rb_values = new BoxLayout({ vertical: true, style_class: STYLE_DATABOX_VALUES })
        rb_captions.add_actor(new Label({ text: _('Temperature') + ":", style: this.GetTextColorStyle() }));
        rb_captions.add_actor(new Label({ text: _('Humidity') + ":", style: this.GetTextColorStyle() }));
        rb_captions.add_actor(new Label({ text: _('Pressure') + ":", style: this.GetTextColorStyle() }));
        rb_captions.add_actor(new Label({ text: _('Wind') + ":", style: this.GetTextColorStyle() }));
        rb_captions.add_actor(this._currentWeatherApiUniqueCap);
        rb_values.add_actor(this._currentWeatherTemperature);
        rb_values.add_actor(this._currentWeatherHumidity);
        rb_values.add_actor(this._currentWeatherPressure);
		/*let windBox = new BoxLayout({vertical: false});
		let windIcon = new Icon({icon_type: IconType.SYMBOLIC, icon_name: "wind-symbolic", icon_size: 15});
		windBox.add_actor(windIcon);
		windBox.add_actor(this._currentWeatherWind);
		rb_values.add_actor(windBox);*/
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

    private rebuildFutureWeatherUi(config: Config): void {
        this.destroyFutureWeather();

        this._forecast = [];
        this._forecastBox = new GridLayout({
            /*style_class: STYLE_FORECAST_CONTAINER,*/
            orientation: config._verticalOrientation
        });
        this._forecastBox.set_column_homogeneous(true);

        let table = new Widget({
            layout_manager: this._forecastBox,
            style_class: STYLE_FORECAST_CONTAINER
        });

        this._futureWeather.set_child(table);

        let maxDays = this.app.GetMaxForecastDays();
        // User settings
        let maxRow = config._forecastRows;
        let maxCol = config._forecastColumns;

        // Fill vertically first by swapping max rows and max columns,
        // calculating correctly with the same code below
        if (config._verticalOrientation) {
            [maxRow, maxCol] = [maxCol, maxRow];
        }
        let curRow = 0;
        let curCol = 0;

        for (let i = 0; i < maxDays; i++) {
            let forecastWeather: ForecastUI = {} as ForecastUI;

            // proceed to next row
            if (curCol >= maxCol) {
                curRow++;
                curCol = 0;
            }

            // Reached the maximum number of rows
            if (curRow >= maxRow) break;

            forecastWeather.Icon = new Icon({
                icon_type: config.IconType(),
                icon_size: 48,
                icon_name: APPLET_ICON,
                style_class: STYLE_FORECAST_ICON
            });

            forecastWeather.Day = new Label({
                style_class: STYLE_FORECAST_DAY,
                reactive: true,
                style: this.GetTextColorStyle()
            });

            forecastWeather.Summary = new Label({
                /*text: Placeholders.LOADING,*/
                style_class: STYLE_FORECAST_SUMMARY,
                reactive: true
            });

            forecastWeather.Temperature = new Label({
                /*text: Placeholders.LOADING,*/
                style_class: STYLE_FORECAST_TEMPERATURE
            });

            let by = new BoxLayout({
                vertical: true,
                style_class: STYLE_FORECAST_DATABOX
            });
            by.add_actor(forecastWeather.Day);
            by.add_actor(forecastWeather.Summary);
            by.add_actor(forecastWeather.Temperature);

            let bb = new BoxLayout({
                style_class: STYLE_FORECAST_BOX
            });

            bb.add_actor(forecastWeather.Icon);
            bb.add_actor(by);

            this._forecast[i] = forecastWeather;
            if (!config._verticalOrientation) {
                this._forecastBox.attach(bb, curCol, curRow, 1, 1);
            }
            else {
                // flip back column and row variables for correct display
                this._forecastBox.attach(bb, curRow, curCol, 1, 1);
            }

            curCol++;
        }
    }

    private rebuildBar(config: Config) {
        this.destroyBar();
        this._timestamp = new Label({ text: "Placeholder" });
        this._bar.add(this._timestamp, {
            x_fill: false,
            x_align: Align.START,
            y_align: Align.MIDDLE,
            y_fill: false,
            expand: true
        })

        this._hourlyButton = new WeatherButton({
            reactive: true,
            can_focus: true,
            child: new Icon({
                icon_type: IconType.SYMBOLIC,
                icon_size: 12,
                icon_name: "custom-down-arrow-symbolic"
            }),
        }).actor;
        this._hourlyButton.connect(SIGNAL_CLICKED, Lang.bind(this, this.ToggleHourlyWeather));
        this._bar.add(this._hourlyButton, {
            x_fill: false,
            x_align: Align.MIDDLE,
            y_align: Align.MIDDLE,
            y_fill: false,
            expand: true
        })

        // Hide if Hourly forecasts are not supported
        if (this.app.GetMaxHourlyForecasts() <= 0) {
            this.HideHourlyToggle();
        }

        this._providerCredit = new WeatherButton({ label: _(ELLIPSIS), reactive: true }).actor;
        this._providerCredit.connect(SIGNAL_CLICKED, Lang.bind(this, this.app.OpenUrl));

        this._bar.add(this._providerCredit, {
            x_fill: false,
            x_align: Align.END,
            y_align: Align.MIDDLE,
            y_fill: false,
            expand: true
        });
    }

    private HideHourlyToggle() {
        this._hourlyButton.child = null;
    }

    private rebuildHourlyWeatherUi(config: Config) {
        this.destroyHourlyWeather();
        let hours = this.app.GetMaxHourlyForecasts();
        this._hourlyForecasts = [];
        this._hourlyForecastBoxes = [];

        for (let index = 0; index < hours; index++) {
            let box = new BoxLayout({ vertical: true, style_class: "hourly-box-item" });
            this._hourlyForecastBoxes.push(box);

            this._hourlyForecasts.push({
                // Override color on light theme for grey text
                Hour: new Label({ text: "Hour", style_class: "hourly-time", style: this.GetTextColorStyle() }),
                Icon: new Icon({
                    icon_type: config.IconType(),
                    icon_size: 24,
                    icon_name: APPLET_ICON,
                    style_class: "hourly-icon"
                }),
                Precipitation: new Label({ text: " ", style_class: "hourly-data" }),
                Summary: new Label({ text: _(ELLIPSIS), style_class: "hourly-data" }),
                Temperature: new Label({ text: _(ELLIPSIS), style_class: "hourly-data" })
            })

            this._hourlyForecasts[index].Summary.clutter_text.set_line_wrap(true);
            box.add_child(this._hourlyForecasts[index].Hour);
            box.add_child(this._hourlyForecasts[index].Icon);
            box.add_child(this._hourlyForecasts[index].Summary);
            box.add_child(this._hourlyForecasts[index].Temperature);
            box.add_child(this._hourlyForecasts[index].Precipitation);

            this._hourlyBox.add(box, {
                x_fill: true,
                x_align: Align.MIDDLE,
                y_align: Align.MIDDLE,
                y_fill: true,
                expand: true
            });
        }

    }
}
interface WindSpeedLocalePrefs {
	[key: string]: WeatherWindSpeedUnits;
}
interface DistanceUnitLocalePrefs {
	[key: string]: DistanceUnits;
}
class Config {
	// Info partially from https://github.com/unicode-org/cldr/blob/release-38-1/common/supplemental/units.xml
	/**
	 * Default is celsius
	 */
	fahrenheitCountries = ["bs", "bz", "ky", "pr", "pw", "us"];

	/**
	 * Default kph, gb added to mph keys
	 */
	windSpeedUnitLocales: WindSpeedLocalePrefs = {
		"fi kr no pl ru se": "m/s",
		"us gb": "mph"
	}
	
	/**
	 * Default metric
	 */
	distanceUnitLocales: DistanceUnitLocalePrefs = {
		"us gb": "imperial"
	}

    WEATHER_LOCATION = "location"
    WEATHER_USE_SYMBOLIC_ICONS_KEY = 'useSymbolicIcons'

	/**
	 * Keys matching the ones in settings-schema.json
	 */
    KEYS: SettingKeys = {
        DATA_SERVICE: "dataService",
        API_KEY: "apiKey",
        TEMPERATURE_UNIT_KEY: "temperatureUnit",
        TEMPERATURE_HIGH_FIRST: "temperatureHighFirst",
        WIND_SPEED_UNIT: "windSpeedUnit",
        DISTANCE_UNIT: "distanceUnit",
        CITY: "locationLabelOverride",
        TRANSLATE_CONDITION: "translateCondition",
        VERTICAL_ORIENTATION: "verticalOrientation",
        SHOW_TEXT_IN_PANEL: "showTextInPanel",
        TEMP_TEXT_OVERRIDE: "tempTextOverride",
        SHOW_COMMENT_IN_PANEL: "showCommentInPanel",
        SHOW_SUNRISE: "showSunrise",
        SHOW_24HOURS: "show24Hours",
        FORECAST_DAYS: "forecastDays",
        FORECAST_HOURS: "forecastHours",
        FORECAST_COLS: "forecastColumns",
        FORECAST_ROWS: "forecastRows",
        REFRESH_INTERVAL: "refreshInterval",
        PRESSURE_UNIT: "pressureUnit",
        SHORT_CONDITIONS: "shortConditions",
        MANUAL_LOCATION: "manualLocation",
        USE_CUSTOM_APPLETICONS: 'useCustomAppletIcons',
        USE_CUSTOM_MENUICONS: "useCustomMenuIcons",
        RUSSIAN_STYLE: "tempRussianStyle",
        SHORT_HOURLY_TIME: "shortHourlyTime",
        SHOW_FORECAST_DATES: "showForecastDates"
    }

    // Settings variables to bind to
    public readonly _refreshInterval: number;
    public readonly _manualLocation: boolean;
    public readonly _dataService: Services;
    private readonly _location: string;
    public readonly _translateCondition: boolean;
    private readonly _temperatureUnit: WeatherUnits;
    public readonly _pressureUnit: WeatherPressureUnits;
    private readonly _windSpeedUnit: WeatherWindSpeedUnits;
    private readonly _distanceUnit: DistanceUnits;
    public readonly _show24Hours: boolean;
    public readonly _apiKey: string;
    public readonly _forecastDays: number;
    public readonly _forecastHours: number;
    public readonly _forecastColumns: number;
    public readonly _forecastRows: number;
    public readonly _verticalOrientation: boolean;
    public readonly _temperatureHighFirst: boolean;
    public readonly _shortConditions: boolean;
    public readonly _showSunrise: boolean;
    public readonly _showCommentInPanel: boolean;
    public readonly _showTextInPanel: boolean;
    public readonly _locationLabelOverride: string;
    public readonly _useCustomAppletIcons: boolean;
    public readonly _useCustomMenuIcons: boolean;
    public readonly _tempTextOverride: string;
    public readonly _tempRussianStyle: boolean;
    public readonly _shortHourlyTime: boolean;
    public readonly _showForecastDates: boolean;

    public keybinding: any;

    /** Timeout */
    private doneTypingLocation: any = null;
    public currentLocation: LocationData = null;

    private settings: imports.ui.settings.AppletSettings;
	private app: WeatherApplet;
	private countryCode: string;

    constructor(app: WeatherApplet, instanceID: number, locale: string) {
		this.app = app;
		this.countryCode = this.GetCountryCode(locale);
        this.settings = new AppletSettings(this, UUID, instanceID);
        this.BindSettings();
    }

    /** Attaches settings to functions */
    private BindSettings() {
        for (let k in this.KEYS) {
            let key = this.KEYS[k];
            let keyProp = "_" + key;
            this.settings.bindProperty(BindingDirection.IN,
                key, keyProp, Lang.bind(this, this.OnSettingChanged), null);
        }

        // Settings what need special care
        this.settings.bindProperty(BindingDirection.BIDIRECTIONAL,
            this.WEATHER_LOCATION, ("_" + this.WEATHER_LOCATION), Lang.bind(this, this.OnLocationChanged), null);

        this.settings.bindProperty(BindingDirection.IN, "keybinding",
            "keybinding", Lang.bind(this.app, this.app._onKeySettingsUpdated), null);

        keybindingManager.addHotKey(
            UUID, this.keybinding, Lang.bind(this.app, this.app.on_applet_clicked));

        this.settings.connect(SIGNAL_CHANGED + this.WEATHER_USE_SYMBOLIC_ICONS_KEY, Lang.bind(this, this.IconTypeChanged));
    }

    private IconTypeChanged() {
        this.app.ui.UpdateIconType(this.IconType());
        this.app.log.Debug("Symbolic icon setting changed");
	}
	
	/**
	 * @returns Units, automatic is already resolved here
	 */
	public TemperatureUnit(): WeatherUnits {
		if (this._temperatureUnit == "automatic") 
			return this.GetLocaleTemperateUnit(this.countryCode);
		return this._temperatureUnit;
	}

	/**
	 * @returns Units, automatic is already resolved here
	 */
	public WindSpeedUnit(): WeatherWindSpeedUnits {
		if (this._windSpeedUnit == "automatic") 
			return this.GetLocaleWindSpeedUnit(this.countryCode);
		return this._windSpeedUnit;
	}

	/**
	 * @returns Units, automatic is already resolved here
	 */
	public DistanceUnit(): DistanceUnits {
		if (this._distanceUnit == "automatic") return this.GetLocaleDistanceUnit(this.countryCode);
		return this._distanceUnit;
	}

	/**
	 * Gets Icon type based on user config
	 */
    public IconType(): imports.gi.St.IconType {
        return this.settings.getValue(this.WEATHER_USE_SYMBOLIC_ICONS_KEY) ?
            IconType.SYMBOLIC :
            IconType.FULLCOLOR
    };

    /** It was spamming refresh before, changed to wait until user stopped typing fro 3 seconds */
    private OnLocationChanged() {
        this.app.log.Debug("User changed location, waiting 3 seconds...");
        if (this.doneTypingLocation != null) clearTimeout(this.doneTypingLocation);
        this.doneTypingLocation = setTimeout(Lang.bind(this, this.DoneTypingLocation), 3000);
    }

    /** Called when 3 seconds is up with no change in location */
    private DoneTypingLocation() {
        this.app.log.Debug("User has finished typing, beginning refresh");
        this.doneTypingLocation = null;
        this.app.refreshAndRebuild();
    }

    private OnSettingChanged() {
        this.app.refreshAndRebuild();
    }

    public SetLocation(value: string) {
        this.settings.setValue(this.WEATHER_LOCATION, value);
    }

    public noApiKey(): boolean {
        if (this._apiKey == undefined || this._apiKey == "") {
            return true;
        }
        return false;
    };

    public InjectLocationToConfig(loc: LocationData, switchToManual: boolean = false) {
        this.app.log.Debug("Location setting is now: " + loc.entryText);
        let text = loc.entryText + ""; // Only values can be injected into settings and not references, so we add empty string to it.
        this.SetLocation(text);
        this.currentLocation = loc;
        if (switchToManual == true) this.settings.setValue(this.KEYS.MANUAL_LOCATION, true);
    }

	/** 
	 * @returns LocationData null if failed to obtain
	 * coordinates. Automatic mode looks up data through ip-api, 
	 * else it returns coordinates if it was entered. If text was entered,
	 * it looks up coordinates via geolocation api
	 */
    public async EnsureLocation(): Promise<LocationData> {
        this.currentLocation = null;
        // Automatic location
        if (!this._manualLocation) {
            let location = await this.app.locProvider.GetLocation();
            // User facing errors handled by provider
            if (!location) return null;

            this.InjectLocationToConfig(location);
            return location;
        }

        // Manual Location

        let loc = this._location;
        if (loc == undefined || loc.trim() == "") {
            this.app.HandleError({
                type: "hard",
                detail: "no location",
                userError: true,
                message: _("Make sure you entered a location or use Automatic location instead")
            });
            return null;
        }

        if (isCoordinate(loc)) {
            // Get Location
            loc = loc.replace(" ", "");
            let latlong = loc.split(",");
            let location: LocationData = {
                lat: parseFloat(latlong[0]),
                lon: parseFloat(latlong[1]),
                city: null,
                country: null,
                mobile: null,
                timeZone: null,
                entryText: loc,
                locationSource: "manual"
            }
            this.InjectLocationToConfig(location);
            return location;
        }

        this.app.log.Debug("Location is text, geolocating...")
        let locationData = await this.app.geoLocationService.GetLocation(loc);
        // User facing errors are handled by service
        if (locationData == null) return null;
        if (!!locationData.address_string) {
            this.app.log.Debug("Address found via address search, placing found full address '" + locationData.address_string + "' back to location entry");
        }

        this.InjectLocationToConfig(locationData);
        return locationData;
	}
	
	// UTILS

	private GetLocaleTemperateUnit(code: string): WeatherUnits {
		if (code == null || this.fahrenheitCountries.indexOf(code) == -1) return "celsius";
		return "fahrenheit";
	}

	private GetLocaleWindSpeedUnit(code: string): WeatherWindSpeedUnits {
		if (code == null) return "kph";

		for (const key in this.windSpeedUnitLocales) {
			if (key.indexOf(code) != -1) return this.windSpeedUnitLocales[key];
		}
		return "kph";
	}

	private GetLocaleDistanceUnit(code: string): DistanceUnits {
		if (code == null) return "metric";

		for (const key in this.distanceUnitLocales) {
			if (key.indexOf(code) != -1) return this.distanceUnitLocales[key];
		}
		return "metric";
	}

	private GetCountryCode(locale: string) {
		let splitted = locale.split("-");
		// There is no country code
		if (splitted.length < 2) return null;
	
		return splitted[1];
	}
}

class WeatherLoop {
    /** To check if data is up-to-date based on user-set refresh settings */
    private lastUpdated: Date = new Date(0);

	/** true on errors when user interaction is required.
	 * (usually on settings misconfiguration), every settings change clears it.
	 */
    private pauseRefresh: boolean = false;


    /** in seconds */
    private readonly LOOP_INTERVAL: number = 15;
    private app: WeatherApplet;
    private appletRemoved = false;
    private GUID: string;
    private instanceID: number;
	/** Slows main loop down on consecutive errors.
	 * loop seconds are multiplied by this value on errors.
	 */
    private errorCount: number = 0;

    constructor(app: WeatherApplet, instanceID: number) {
        this.app = app;
        this.instanceID = instanceID;
        this.GUID = uuidv4();
        weatherAppletGUIDs[instanceID] = this.GUID;
    }

    public IsDataTooOld(): boolean {
        if (!this.lastUpdated) return true;
        let oldDate = this.lastUpdated;
        // If data is at least twice as old as refreshInterval, return true
        oldDate.setMinutes(oldDate.getMinutes() + (this.app.config._refreshInterval * 2));
        return (this.lastUpdated > oldDate);
    }

    /** Main loop */
    public async Start(): Promise<void> {
        while (true) {
            try {
                if (this.IsStray()) return;
                if (this.app.encounteredError == true) this.IncrementErrorCount();
                this.ValidateLastUpdate();

                if (this.pauseRefresh) {
                    this.app.log.Debug("Configuration error, updating paused")
                    await delay(this.LoopInterval());
                    continue;
                }

                if (this.errorCount > 0 || this.NextUpdate() < new Date()) {
                    this.app.log.Debug("Refresh triggered in main loop with these values: lastUpdated " + ((!this.lastUpdated) ? "null" : this.lastUpdated.toLocaleString())
                        + ", errorCount " + this.errorCount.toString() + " , loopInterval " + (this.LoopInterval() / 1000).toString()
                        + " seconds, refreshInterval " + this.app.config._refreshInterval + " minutes");
                    // loop can skip 1 cycle if needed 
                    let state = await this.app.refreshWeather(false);
                    if (state == "locked") this.app.log.Print("App is currently refreshing, refresh skipped in main loop");
                    if (state == "success" || state == "locked") this.lastUpdated = new Date();
                }
                else {
                    this.app.log.Debug("No need to update yet, skipping")
                }
            } catch (e) {
                this.app.log.Error("Error in Main loop: " + e);
                this.app.encounteredError = true;
            }

            await delay(this.LoopInterval());
        }
    };

    private IsStray(): boolean {
        if (this.appletRemoved == true) return true;
        if (this.GUID != weatherAppletGUIDs[this.instanceID]) {
            this.app.log.Debug("Applet GUID: " + this.GUID);
            this.app.log.Debug("GUID stored globally: " + weatherAppletGUIDs[this.instanceID]);
            this.app.log.Print("GUID mismatch, terminating applet")
            return true;
        }
        return false;
    }

    private IncrementErrorCount(): void {
        this.app.encounteredError = false;
        this.errorCount++;
        this.app.log.Debug("Encountered error in previous loop");
        // Limiting count so timeout does not expand forever
        if (this.errorCount > 60) this.errorCount = 60;
    }

    private NextUpdate(): Date {
        return new Date(this.lastUpdated.getTime() + this.app.config._refreshInterval * 60000);
    }

    private ValidateLastUpdate(): void {
        // System time was probably changed back, reset lastUpdated value
        if (this.lastUpdated > new Date()) this.lastUpdated = new Date(0);
    }

	/**
	 * @returns milliseconds
	 */
    private LoopInterval(): number {
        return (this.errorCount > 0) ? this.LOOP_INTERVAL * this.errorCount * 1000 : this.LOOP_INTERVAL * 1000; // Increase loop timeout linearly with the number of errors
    }

    public Stop(): void {
        this.appletRemoved = true;
    }

    public Pause(): void {
        this.pauseRefresh = true;
    }

    public Resume(): void {
        this.pauseRefresh = false;
    }

    public ResetErrorCount(): void {
        this.errorCount = 0;
    }

    public GetSecondsUntilNextRefresh(): number {
        return (this.errorCount > 0) ? (this.errorCount) * this.LOOP_INTERVAL : this.LOOP_INTERVAL;
    }
}

class WeatherButton {
    public actor: imports.gi.St.Button;
    private signals = new SignalManager();
    private disabled = false;
    constructor(options: any) {
        this.actor = new Button(options);
        this.actor.add_style_class_name("popup-menu-item");

        this.actor.style = 'padding-top: 0px;padding-bottom: 0px; padding-right: 2px; padding-left: 2px; border-radius: 2px;';

        this.signals.connect(this.actor, 'enter-event', this.handleEnter, this);
        this.signals.connect(this.actor, 'leave-event', this.handleLeave, this);
    }

    handleEnter(actor?: WeatherButton) {
        if (!this.disabled) this.actor.add_style_pseudo_class('active');
        //global.set_cursor(imports.gi.Cinnamon.Cursor.POINTING_HAND);
    }

    handleLeave() {
        this.actor.remove_style_pseudo_class('active');
        //global.unset_cursor()
    }

    disable() {
        this.disabled = true;
        this.actor.reactive = false;
    }

    enable() {
        this.disabled = false;
        this.actor.reactive = true;
    }
}

/**
 * Nominatim communication interface
 */
class GeoLocation {
    private url = "https://nominatim.openstreetmap.org/search/";
    private params = "?format=json&addressdetails=1&limit=1";
    private app: WeatherApplet = null;
    private cache: LocationCache = {};

    constructor(app: WeatherApplet) {
        this.app = app;
    }

    public async GetLocation(searchText: string): Promise<LocationData> {
        try {
            searchText = searchText.trim();
            let cached = get([searchText], this.cache);
            if (cached != null) {
                this.app.log.Debug("Returning cached geolocation info for '" + searchText + "'.");
                return cached;
            }

            let locationData = await this.app.LoadJsonAsync(this.url + encodeURIComponent(searchText) + this.params);
            if (locationData.length == 0) {
                this.app.HandleError({
                    type: "hard",
                    detail: "bad location format",
                    message: _("Could not find location based on address, please check if it's right")
                })
                return null;
            }
            this.app.log.Debug("Location is found, payload: " + JSON.stringify(locationData, null, 2));
            let result: LocationData = {
                lat: parseFloat(locationData[0].lat),
                lon: parseFloat(locationData[0].lon),
                city: locationData[0].address.city || locationData[0].address.town,
                country: locationData[0].address.country,
                timeZone: null,
                mobile: null,
                address_string: locationData[0].display_name,
                entryText: this.BuildEntryText(locationData[0]),
                locationSource: "address-search"
            }
            this.cache[searchText] = result;
            return result;
        }
        catch (e) {
            this.app.log.Error("Could not geolocate, error: " + JSON.stringify(e, null, 2));
            this.app.HandleError({
                type: "soft",
                detail: "bad api response",
                message: _("Failed to call Geolocation API, see Looking Glass for errors.")
            })
            return null;
        }
	}
	
	/**
	 * Nominatim doesn't return any result if the State district is included in the search 
	 * in specific case, we have to build it from the address details omitting specific
	 * keys
	 * @param locationData 
	 */
	private BuildEntryText(locationData: any): string {
		if (locationData.address == null) return locationData.display_name;
		let entryText: string[] = [];
		for (let key in locationData.address) {
			if (key == "state_district") continue;
			if (key == "county") continue;
			if (key == "country_code") continue;
			entryText.push(locationData.address[key]);
		}
		return entryText.join(", ");
	}
}

// TODO: Switch to setting-schema based LocationStore as soon as 3.0 id Deprecated
// TODO: Make internal persistent setting when switching to location store entries and back
// Example schema entry:
/*"location-list": {
		"type" : "list",
		"description" : "Your saved locations",
		"columns" : [
			{"id": "lat", "title": "Latitude", "type": "string"},
			{"id": "lon", "title": "Longitude", "type": "string"},
			{"id": "city", "title": "City", "type": "string"},
			{"id": "country", "title": "Country", "type": "string"},
			{"id": "address_string", "title": "Full Address", "type": "string", "default": ""},
			{"id": "entryText", "title": "Text in location entry", "type": "string", "default": ""},
			{"id": "timeZone", "title": "Timezone", "type": "string", "default": ""}
		],
		"default" : []
	},
*/
class LocationStore {

    path: string = null; // ~/.config/weather-mockturtl/locations.json
    private file: imports.gi.Gio.File = null;
    private locations: LocationData[] = [];
    private app: WeatherApplet = null;

	/**
	 * Current head on locationstore array.
	 * Retains position even if user changes to location
	 * not in the store. It gets moved to the end of array if user
	 * saves a new location. On deletion it moves to the next index
	 */
    private currentIndex = 0;

	/**
	 * event callback for applet when location storage is modified
	 */
    private StoreChanged: (storeItemCount: number) => void = null;

	/**
	 * 
	 * @param path to storage file
	 * @param app 
	 * @param onStoreChanged called when locations are loaded from file, added or deleted
	 */
    constructor(app: WeatherApplet, onStoreChanged?: (itemCount: number) => void) {
        this.app = app;

        this.path = this.GetConfigPath() + "/weather-mockturtl/locations.json"
        this.app.log.Debug("location store path is: " + this.path);
        this.file = Gio.File.new_for_path(this.path);
        if (onStoreChanged != null) this.StoreChanged = onStoreChanged;
        this.LoadSavedLocations();
    }

    private GetConfigPath(): string {
        let configPath = GLib.getenv('XDG_CONFIG_HOME')
        if (configPath == null) configPath = GLib.get_home_dir() + "/.config"
        return configPath;
    }

    public NextLocation(currentLoc: LocationData): LocationData {
        this.app.log.Debug("Current location: " + JSON.stringify(currentLoc, null, 2));
        if (this.locations.length == 0) return currentLoc; // this should not happen, as buttons are useless in this case
        let nextIndex = null;
        if (this.InStorage(currentLoc)) { // if location is stored move to the one next to it
            nextIndex = this.FindIndex(currentLoc) + 1;
            this.app.log.Debug("Current location found in storage at index " + (nextIndex - 1).toString() + ", moving to the next index")
        }
        else { // move to the location next to the last used location
            nextIndex = this.currentIndex++;
        }

        // Rotate if reached end of array
        if (nextIndex > this.locations.length - 1) {
            nextIndex = 0;
            this.app.log.Debug("Reached end of storage, move to the beginning")
        }

        this.app.log.Debug("Switching to index " + nextIndex.toString() + "...");
        this.currentIndex = nextIndex;
        // Return copy, not original so nothing interferes with filestore
        return {
            address_string: this.locations[nextIndex].address_string,
            country: this.locations[nextIndex].country,
            city: this.locations[nextIndex].city,
            entryText: this.locations[nextIndex].entryText,
            lat: this.locations[nextIndex].lat,
            lon: this.locations[nextIndex].lon,
            mobile: this.locations[nextIndex].mobile,
            timeZone: this.locations[nextIndex].timeZone,
            locationSource: this.locations[nextIndex].locationSource,
        }
    }

    public PreviousLocation(currentLoc: LocationData): LocationData {
        if (this.locations.length == 0) return currentLoc; // this should not happen, as buttons are useless in this case
        if (this.locations.length == 0) return currentLoc; // this should not happen, as buttons are useless in this case
        let previousIndex = null;
        if (this.InStorage(currentLoc)) { // if location is stored move to the previous one
            previousIndex = this.FindIndex(currentLoc) - 1;
            this.app.log.Debug("Current location found in storage at index " + (previousIndex + 1).toString() + ", moving to the next index")
        }
        else { // move to the location previous to the last used location
            previousIndex = this.currentIndex--;
        }

        // Rotate if reached end of array
        if (previousIndex < 0) {
            previousIndex = this.locations.length - 1;
            this.app.log.Debug("Reached start of storage, move to the end")
        }

        this.app.log.Debug("Switching to index " + previousIndex.toString() + "...");
        this.currentIndex = previousIndex;
        return {
            address_string: this.locations[previousIndex].address_string,
            country: this.locations[previousIndex].country,
            city: this.locations[previousIndex].city,
            entryText: this.locations[previousIndex].entryText,
            lat: this.locations[previousIndex].lat,
            lon: this.locations[previousIndex].lon,
            mobile: this.locations[previousIndex].mobile,
            timeZone: this.locations[previousIndex].timeZone,
            locationSource: this.locations[previousIndex].locationSource,
        };
    }

    public InStorage(loc: LocationData): boolean {
        if (loc == null) return false;
        for (let index = 0; index < this.locations.length; index++) {
            const element = this.locations[index];
            if (element.lat.toString() == loc.lat.toString() && element.lon.toString() == loc.lon.toString()) return true;
        }
        return false;
    }

    public ShouldShowLocationSelectors(currentLoc: LocationData): boolean {
        let threshold = this.InStorage(currentLoc) ? 2 : 1;
        if (this.locations.length >= threshold) return true;
        else return false;
    }

    public async SaveCurrentLocation(loc: LocationData) {
        if (this.app.Locked()) {
            this.app.sendNotification(_("Warning") + " - " + _("Location Store"), _("You can only save correct locations when the applet is not refreshing"), true);
            return;
        }
        if (loc == null) {
            this.app.sendNotification(_("Warning") + " - " + _("Location Store"), _("You can't save an incorrect location"), true);
            return;
        }
        if (this.InStorage(loc)) {
            this.app.sendNotification(_("Info") + " - " + _("Location Store"), _("Location is already saved"), true);
            return;
        }
        this.locations.push(loc);
        this.currentIndex = this.locations.length - 1; // head to saved location
        this.InvokeStorageChanged();
        await this.SaveToFile();
        this.app.sendNotification(_("Success") + " - " + _("Location Store"), _("Location is saved to library"), true);

    }

    public async DeleteCurrentLocation(loc: LocationData) {
        if (this.app.Locked()) {
            this.app.sendNotification(_("Info") + " - " + _("Location Store"), _("You can't remove a location while the applet is refreshing"), true);
            return;
        }
        if (loc == null) {
            this.app.sendNotification(_("Info") + " - " + _("Location Store"), _("You can't remove an incorrect location"), true);
            return;
        }

        if (!this.InStorage(loc)) {
            this.app.sendNotification(_("Info") + " - " + _("Location Store"), _("Location is not in storage, can't delete"), true);
            return;
        }
        // Find location
        let index = this.FindIndex(loc);
        this.locations.splice(index, 1);
        // Go to to previous saved location
        this.currentIndex = this.currentIndex--;
        if (this.currentIndex < 0) this.currentIndex = this.locations.length - 1; // reached start of array
		if (this.currentIndex < 0) this.currentIndex = 0; // no items in array
		await this.SaveToFile();
        this.app.sendNotification(_("Success") + " - " + _("Location Store"), _("Location is deleted from library"), true);
		this.InvokeStorageChanged();
    }

    private InvokeStorageChanged() {
        if (this.StoreChanged == null) return;
        this.StoreChanged(this.locations.length);
    }

    private async LoadSavedLocations(): Promise<boolean> {
        let content = null;
        try {
            content = await this.LoadContents(this.file);
        }
        catch(e) {
            let error: GJSError = e;
            if (error.matches(error.domain, Gio.IOErrorEnum.NOT_FOUND)) {
                this.app.log.Print("Location store does not exist, skipping loading...")
                return true;
            }

            this.app.log.Error("Can't load locations.json, error: " + error.message);
            return false;
        }

        if (content == null) return false;

        try {
            let locations = JSON.parse(content) as LocationData[];
            this.locations = locations;
            this.app.log.Print("Saved locations are loaded in from location store at: '" + this.path + "'");
            this.app.log.Debug("Locations loaded: " + JSON.stringify(this.locations, null, 2));
            this.InvokeStorageChanged();
            return true;
        }
        catch (e) {
            this.app.log.Error("Error loading locations from store: " + (e as Error).message);
            this.app.sendNotification(_("Error") + " - " + _("Location Store"), _("Failed to load in data from location storage, please see the logs for more information"))
            return false;
        }

    }

    private async SaveToFile() {
        let writeFile = (await this.OverwriteAndGetIOStream(this.file)).get_output_stream();
        await this.WriteAsync(writeFile, JSON.stringify(this.locations, null, 2));
        await this.CloseStream(writeFile);
    }

    private FindIndex(loc: LocationData): number {
        if (loc == null) return -1;
        for (let index = 0; index < this.locations.length; index++) {
            const element = this.locations[index];
            if (element.lat.toString() == loc.lat.toString() && element.lon.toString() == loc.lon.toString()) return index;
        }
        return -1;
    }


    // --------------------------
    // IO
    // --------------------------

    /**
     * NOT WORKING, fileInfo completely empty atm
     * @param file 
     */
    private async GetFileInfo(file: imports.gi.Gio.File): Promise<imports.gi.Gio.FileInfo> {
        return new Promise((resolve, reject) => {
            file.query_info_async("", Gio.FileQueryInfoFlags.NONE, null, null, (obj, res) => {
                let result = file.query_info_finish(res);
                resolve(result);
                return result;
            });
        });
    }

    private async FileExists(file: imports.gi.Gio.File, dictionary: boolean = false): Promise<boolean> {
        try {
            return file.query_exists(null);
            /*// fileInfo doesn't work, don't use for now
            let info = await this.GetFileInfo(file);
            let type = info.get_size(); // type always 0
            return true;*/
        }
        catch (e) {
            this.app.log.Error("Cannot get file info for '" + file.get_path() + "', error: ");
            global.log(e)
            return false;
        }
    }

    /**
     * Loads contents of a file. Can throw Gio.IOErroEnum exception. (e.g file does not exist)
     * @param file 
     */
    private async LoadContents(file: imports.gi.Gio.File): Promise<string> {
        return new Promise((resolve, reject) => {
            file.load_contents_async(null, (obj, res) => {
                let result, contents = null;
                try {
                    [result, contents] = file.load_contents_finish(res);
                }
                catch(e) {
                    reject(e);
                    return e;
                }
                if (result != true) {
                    resolve(null);
                    return null;
                }
				if (contents instanceof Uint8Array) // mozjs60 future-proofing
                    contents = ByteArray.toString(contents);

                resolve(contents.toString());
                return contents.toString();
            });
        });
    }

    private async DeleteFile(file: imports.gi.Gio.File): Promise<boolean> {
        let result: boolean = await new Promise((resolve, reject) => {
            file.delete_async(null, null, (obj, res) => {
                let result = null;
                try {
                    result = file.delete_finish(res);
                }
                catch (e) {
                    let error: GJSError = e;
                    if (error.matches(error.domain, Gio.IOErrorEnum.NOT_FOUND)) {
                        resolve(true);
                        return true;
                    }

                    this.app.log.Error("Can't delete file, reason: ");
                    global.log(e);
                    resolve(false);
                    return false;
                }

                resolve(result);
                return result;
            });
        });
        return result;

    }

    private async OverwriteAndGetIOStream(file: imports.gi.Gio.File): Promise<imports.gi.Gio.IOStream> {
        if (!this.FileExists(file.get_parent())) 
            file.get_parent().make_directory_with_parents(null); //don't know if this is a blocking call or not

        return new Promise((resolve, reject) => {
            file.replace_readwrite_async(null, false, Gio.FileCreateFlags.NONE, null, null, (source_object, result) => {
                let ioStream = file.replace_readwrite_finish(result);
                resolve(ioStream);
                return ioStream;
            });
        });
    }

    private async WriteAsync(outputStream: imports.gi.Gio.OutputStream, buffer: string): Promise<boolean> {
        // normal write_async can't use normal string or ByteArray.fromString
        // so we save using write_bytes_async, seem to work well.
        let text = ByteArray.fromString(buffer);
        if (outputStream.is_closed()) return false;
		
		return new Promise((resolve: any, reject: any) => {
			outputStream.write_bytes_async(text as any, null, null, (obj, res) => {
				let ioStream = outputStream.write_bytes_finish(res);
				resolve(true);
				return true;
			});
        });
    }

    private async CloseStream(stream: imports.gi.Gio.OutputStream | imports.gi.Gio.InputStream | imports.gi.Gio.FileIOStream): Promise<boolean> {
        return new Promise((resolve, reject) => {
            stream.close_async(null, null, (obj, res) => {
                let result = stream.close_finish(res);
                resolve(result);
                return result;
            });
        });
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
const STYLE_BAR = 'bottombar'
const STYLE_LOCATION_SELECTOR = 'location-selector'

// Magic strings
const BLANK = '   ';
const ELLIPSIS = '...';
const EN_DASH = '\u2013';
const FORWARD_SLASH = '\u002F';

//----------------------------------------------------------------------
//
// Entry point
//
//----------------------------------------------------------------------

function main(metadata: any, orientation: imports.gi.St.Side, panelHeight: number, instanceId: number) {
    return new WeatherApplet(metadata, orientation, panelHeight, instanceId);
}

type LocationCache = {
    [key: string]: LocationData
}

/** Units Used in Options. Change Options list if You change this! */
type WeatherUnits = 'automatic' | 'celsius' | 'fahrenheit';

/** Units Used in Options. Change Options list if You change this! */
type WeatherWindSpeedUnits = 'automatic' | 'kph' | 'mph' | 'm/s' | 'Knots' | 'Beaufort';

/** Units used in Options. Change Options list if You change this! */
type WeatherPressureUnits = 'hPa' | 'mm Hg' | 'in Hg' | 'Pa' | 'psi' | 'atm' | 'at';

/** Change settings-scheme if you change this! */
type DistanceUnits = 'automatic' | 'metric' | 'imperial';

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
        url: string,
        /** in metres */
        distanceFrom?: number,
        tzOffset?: number
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
    hourlyForecasts?: HourlyForecastData[]
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


interface HourlyForecastData {
    /** Set to 12:00 if possible */
    date: Date,
    /** Kelvin */
    temp: number,
    condition: Condition
    precipitation?: {
        type: PrecipitationType,
        /** in mm */
        volume?: number,
        /** % */
        chance?: number
    };
}

type PrecipitationType = "rain" | "snow" | "none" | "ice pellets" | "freezing rain";

interface LocationData {
    lat: number,
    lon: number,
    city: string,
    country: string,
    timeZone: string,
    mobile: boolean,
    address_string?: string;
    entryText: string;
    locationSource: LocationSource;
}

type LocationSource = "ip-api" | "address-search" | "manual";

interface Location {
    lat: number;
    lon: number;
    text: string;
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

interface HourlyForecastUI {
    Icon: imports.gi.St.Icon,
    Hour: imports.gi.St.Label,
    Summary: imports.gi.St.Label,
    Temperature: imports.gi.St.Label,
    Precipitation: imports.gi.St.Label
}

type SettingKeys = {
    [key: string]: string;
}

/**
 * A WeatherProvider must implement this interface.
 */
interface WeatherProvider {
    GetWeather(loc: Location): Promise<WeatherData>;
	/** Used as to extend the same named function in the Applet Class.
	 * 
	 * "this" (context) is not accessible here
	 */
    HandleHTTPError?: (error: HttpError, uiError: AppletError) => AppletError;
    prettyName: string;
    name: Services;
    maxForecastSupport: number;
    maxHourlyForecastSupport: number;
    website: string;
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
    data: any;
}

type RefreshState = "success" | "failure" | "error" | "locked";

/** hard will not force a refresh and cleans the applet ui.
 * 
 *  soft will show a subtle hint that the refresh failed (NOT IMPLEMENTED)
 */
type ErrorSeverity = "hard" | "soft";
type ApiService = "ipapi" | "darksky" | "openweathermap" | "met-norway" | "weatherbit" | "yahoo" | "climacell" | "met-uk" | "us-weather";
type ErrorDetail = "no key" | "bad key" | "no location" | "bad location format" |
    "location not found" | "no network response" | "no api response" | "location not covered" |
    "bad api response - non json" | "bad api response" | "no response body" |
    "no response data" | "unusual payload" | "key blocked" | "unknown" | "bad status code" | "import error";
type NiceErrorDetail = {
    [key in ErrorDetail]: string;
}

interface Condition {
    /** Short description */
    main: string,
    /** Long Description */
    description: string,
    /** GTK icon name */
    icon: BuiltinIcons,
    customIcon: CustomIcons
}

type GUIDStore = {
    [key: number]: string
}

interface SunTimes {
    sunrise: Date;
    sunset: Date
}

/**
 * names of icons what might be available
 */
type BuiltinIcons =
    "weather-clear" |
    "weather-clear-night" |
    "weather-few-clouds" |
    "weather-few-clouds-night" |
    "weather-clouds" |
    "weather-many-clouds" |
    "weather-overcast" |
    "weather-showers-scattered" |
    "weather-showers-scattered-day" |
    "weather-showers-scattered-night" |
    "weather-showers-day" |
    "weather-showers-night" |
    "weather-showers" |
    "weather-rain" |
    "weather-freezing-rain" |
    "weather-snow" |
    "weather-snow-day" |
    "weather-snow-night" |
    "weather-snow-rain" |
    "weather-snow-scattered" |
    "weather-snow-scattered-day" |
    "weather-snow-scattered-night" |
    "weather-storm" |
    "weather-hail" |
    "weather-fog" |
    "weather-tornado" |
    "weather-windy" |
    "weather-breeze" |
    "weather-clouds-night" |
    "weather-severe-alert";

/**
 * Available icons in icons folder
 */
type CustomIcons =
    "custom-down-arrow-symbolic" |
    "custom-up-arrow-symbolic" |
    "custom-left-arrow-symbolic" |
    "custom-right-arrow-symbolic" |
    "alien-symbolic" |
    "barometer-symbolic" |
    "celsius-symbolic" |
    "cloud-down-symbolic" |
    "cloud-refresh-symbolic" |
    "cloud-symbolic" |
    "cloud-up-symbolic" |
    "cloudy-gusts-symbolic" |
    "cloudy-symbolic" |
    "cloudy-windy-symbolic" |
    "day-cloudy-gusts-symbolic" |
    "day-cloudy-high-symbolic" |
    "day-cloudy-symbolic" |
    "day-cloudy-windy-symbolic" |
    "day-fog-symbolic" |
    "day-hail-symbolic" |
    "day-haze-symbolic" |
    "day-light-wind-symbolic" |
    "day-lightning-symbolic" |
    "day-rain-mix-symbolic" |
    "day-rain-mix-storm-symbolic" |
    "day-rain-symbolic" |
    "day-rain-wind-symbolic" |
    "day-showers-symbolic" |
    "day-sleet-storm-symbolic" |
    "day-sleet-symbolic" |
    "day-snow-symbolic" |
    "day-snow-thunderstorm-symbolic" |
    "day-snow-wind-symbolic" |
    "day-sprinkle-symbolic" |
    "day-storm-showers-symbolic" |
    "day-sunny-overcast-symbolic" |
    "day-sunny-symbolic" |
    "day-thunderstorm-symbolic" |
    "day-windy-symbolic" |
    "degrees-symbolic" |
    "direction-down-left-symbolic" |
    "direction-down-right-symbolic" |
    "direction-down-symbolic" |
    "direction-left-symbolic" |
    "direction-right-symbolic" |
    "direction-up-left-symbolic" |
    "direction-up-right-symbolic" |
    "direction-up-symbolic" |
    "dust-symbolic" |
    "earthquake-symbolic" |
    "fahrenheit-symbolic" |
    "fire-symbolic" |
    "flood-symbolic" |
    "fog-symbolic" |
    "gale-warning-symbolic" |
    "hail-symbolic" |
    "horizon-alt-symbolic" |
    "horizon-symbolic" |
    "hot-symbolic" |
    "humidity-symbolic" |
    "hurricane-symbolic" |
    "hurricane-warning-symbolic" |
    "lightning-symbolic" |
    "lunar-eclipse-symbolic" |
    "meteor-symbolic" |
    "moon-alt-first-quarter-symbolic" |
    "moon-alt-full-symbolic" |
    "moon-alt-new-symbolic" |
    "moon-alt-third-quarter-symbolic" |
    "moon-alt-waning-crescent-1-symbolic" |
    "moon-alt-waning-crescent-2-symbolic" |
    "moon-alt-waning-crescent-3-symbolic" |
    "moon-alt-waning-crescent-4-symbolic" |
    "moon-alt-waning-crescent-5-symbolic" |
    "moon-alt-waning-crescent-6-symbolic" |
    "moon-alt-waning-gibbous-1-symbolic" |
    "moon-alt-waning-gibbous-2-symbolic" |
    "moon-alt-waning-gibbous-3-symbolic" |
    "moon-alt-waning-gibbous-4-symbolic" |
    "moon-alt-waning-gibbous-5-symbolic" |
    "moon-alt-waning-gibbous-6-symbolic" |
    "moon-alt-waxing-crescent-1-symbolic" |
    "moon-alt-waxing-crescent-2-symbolic" |
    "moon-alt-waxing-crescent-3-symbolic" |
    "moon-alt-waxing-crescent-4-symbolic" |
    "moon-alt-waxing-crescent-5-symbolic" |
    "moon-alt-waxing-crescent-6-symbolic" |
    "moon-alt-waxing-gibbous-1-symbolic" |
    "moon-alt-waxing-gibbous-2-symbolic" |
    "moon-alt-waxing-gibbous-3-symbolic" |
    "moon-alt-waxing-gibbous-4-symbolic" |
    "moon-alt-waxing-gibbous-5-symbolic" |
    "moon-alt-waxing-gibbous-6-symbolic" |
    "moon-first-quarter-symbolic" |
    "moon-full-symbolic" |
    "moon-new-symbolic" |
    "moon-third-quarter-symbolic" |
    "moon-waning-crescent-1-symbolic" |
    "moon-waning-crescent-2-symbolic" |
    "moon-waning-crescent-3-symbolic" |
    "moon-waning-crescent-4-symbolic" |
    "moon-waning-crescent-5-symbolic" |
    "moon-waning-crescent-6-symbolic" |
    "moon-waning-gibbous-1-symbolic" |
    "moon-waning-gibbous-2-symbolic" |
    "moon-waning-gibbous-3-symbolic" |
    "moon-waning-gibbous-4-symbolic" |
    "moon-waning-gibbous-5-symbolic" |
    "moon-waning-gibbous-6-symbolic" |
    "moon-waxing-crescent-1-symbolic" |
    "moon-waxing-crescent-2-symbolic" |
    "moon-waxing-crescent-3-symbolic" |
    "moon-waxing-crescent-4-symbolic" |
    "moon-waxing-crescent-5-symbolic" |
    "moon-waxing-crescent-6-symbolic" |
    "moon-waxing-gibbous-1-symbolic" |
    "moon-waxing-gibbous-2-symbolic" |
    "moon-waxing-gibbous-3-symbolic" |
    "moon-waxing-gibbous-4-symbolic" |
    "moon-waxing-gibbous-5-symbolic" |
    "moon-waxing-gibbous-6-symbolic" |
    "moonrise-symbolic" |
    "moonset-symbolic" |
    "na-symbolic" |
    "night-alt-cloudy-gusts-symbolic" |
    "night-alt-cloudy-high-symbolic" |
    "night-alt-cloudy-symbolic" |
    "night-alt-cloudy-windy-symbolic" |
    "night-alt-hail-symbolic" |
    "night-alt-lightning-symbolic" |
    "night-alt-partly-cloudy-symbolic" |
    "night-alt-rain-mix-symbolic" |
    "night-alt-rain-mix-storm-symbolic" |
    "night-alt-rain-symbolic" |
    "night-alt-rain-wind-symbolic" |
    "night-alt-showers-symbolic" |
    "night-alt-sleet-storm-symbolic" |
    "night-alt-sleet-symbolic" |
    "night-alt-snow-symbolic" |
    "night-alt-snow-thunderstorm-symbolic" |
    "night-alt-snow-wind-symbolic" |
    "night-alt-sprinkle-symbolic" |
    "night-alt-storm-showers-symbolic" |
    "night-alt-thunderstorm-symbolic" |
    "night-alt-wind-symbolic" |
    "night-clear-symbolic" |
    "night-cloudy-gusts-symbolic" |
    "night-cloudy-high-symbolic" |
    "night-cloudy-symbolic" |
    "night-cloudy-windy-symbolic" |
    "night-fog-symbolic" |
    "night-hail-symbolic" |
    "night-lightning-symbolic" |
    "night-partly-cloudy-symbolic" |
    "night-rain-mix-symbolic" |
    "night-rain-symbolic" |
    "night-rain-wind-symbolic" |
    "night-showers-symbolic" |
    "night-sleet-storm-symbolic" |
    "night-sleet-symbolic" |
    "night-snow-symbolic" |
    "night-snow-thunderstorm-symbolic" |
    "night-snow-wind-symbolic" |
    "night-sprinkle-symbolic" |
    "night-storm-showers-symbolic" |
    "night-thunderstorm-symbolic" |
    "rain-mix-symbolic" |
    "rain-mix-storm-symbolic" |
    "rain-symbolic" |
    "rain-wind-symbolic" |
    "raindrop-symbolic" |
    "raindrops-symbolic" |
    "refresh-alt-symbolic" |
    "refresh-symbolic" |
    "sandstorm-symbolic" |
    "showers-symbolic" |
    "sleet-symbolic" |
    "sleet-storm-symbolic" |
    "small-craft-advisory-symbolic" |
    "smog-symbolic" |
    "smoke-symbolic" |
    "snow-symbolic" |
    "snow-storm-symbolic" |
    "snow-wind-symbolic" |
    "snowflake-cold-symbolic" |
    "solar-eclipse-symbolic" |
    "sprinkle-symbolic" |
    "stars-symbolic" |
    "storm-showers-symbolic" |
    "storm-warning-symbolic" |
    "strong-wind-symbolic" |
    "sunrise-symbolic" |
    "sunset-symbolic" |
    "thermometer-exterior-symbolic" |
    "thermometer-internal-symbolic" |
    "thermometer-symbolic" |
    "thunderstorm-symbolic" |
    "time-1-symbolic" |
    "time-10-symbolic" |
    "time-11-symbolic" |
    "time-12-symbolic" |
    "time-2-symbolic" |
    "time-3-symbolic" |
    "time-4-symbolic" |
    "time-5-symbolic" |
    "time-6-symbolic" |
    "time-7-symbolic" |
    "time-8-symbolic" |
    "time-9-symbolic" |
    "tornado-symbolic" |
    "train-symbolic" |
    "tsunami-symbolic" |
    "umbrella-symbolic" |
    "volcano-symbolic" |
    "wind-beaufort-0-symbolic" |
    "wind-beaufort-1-symbolic" |
    "wind-beaufort-10-symbolic" |
    "wind-beaufort-11-symbolic" |
    "wind-beaufort-12-symbolic" |
    "wind-beaufort-2-symbolic" |
    "wind-beaufort-3-symbolic" |
    "wind-beaufort-4-symbolic" |
    "wind-beaufort-5-symbolic" |
    "wind-beaufort-6-symbolic" |
    "wind-beaufort-7-symbolic" |
    "wind-beaufort-8-symbolic" |
    "wind-beaufort-9-symbolic" |
    "wind-deg-symbolic" |
    "windy-symbolic";
