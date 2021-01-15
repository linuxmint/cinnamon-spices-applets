
//----------------------------------------------------------------------
//
// Weather Applet
//
//----------------------------------------------------------------------

import { Climacell } from "./climacell";
import { Config } from "./config";
import { DarkSky } from "./darkSky";
import { IpApi } from "./ipApi";
import { LocationStore } from "./locationstore";
import { Log } from "./logger";
import { WeatherLoop } from "./loop";
import { MetNorway } from "./met_norway";
import { MetUk } from "./met_uk";
import { GeoLocation } from "./nominatim";
import { OpenWeatherMap } from "./openWeatherMap";
import { ServiceMap, WeatherData, WeatherProvider, LocationData, AppletError, HttpError, CustomIcons, Services, RefreshState, NiceErrorDetail, ApiService } from "./types";
import { UI } from "./ui";
import { USWeather } from "./us_weather";
import { constructJsLocale, _, get } from "./utils";
import { Weatherbit } from "./weatherbit";
import { Yahoo } from "./yahoo";

const { TextIconApplet, AllowedLayout, AppletPopupMenu, MenuItem } = imports.ui.applet;
const { Message, Session, ProxyResolverDefault, SessionAsync } = imports.gi.Soup;
const { get_language_names } = imports.gi.GLib;
const { messageTray, themeManager } = imports.ui.main;
const { SystemNotificationSource, Notification } = imports.ui.messageTray;
const Lang: typeof imports.lang = imports.lang;
const GLib = imports.gi.GLib;
const { spawnCommandLine, spawn_async, spawnCommandLineAsyncIO } = imports.misc.util;
const { Bin, DrawingArea, BoxLayout, Side, IconType, Label, ScrollView, Icon, Button, Align, Widget } = imports.gi.St;
const keybindingManager = imports.ui.main.keybindingManager;

const UUID = "weather@mockturtl"
const APPLET_ICON = "view-refresh-symbolic"
const REFRESH_ICON = "view-refresh";
const CMD_SETTINGS = "cinnamon-settings applets " + UUID

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

export class WeatherApplet extends TextIconApplet {
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
    public readonly locProvider = new IpApi(this); // IP location lookup
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
                if (currentName != "DarkSky" || force) this.provider = new DarkSky(this);
                break;
            case DATA_SERVICE.OPEN_WEATHER_MAP:   // No City Info
                if (currentName != "OpenWeatherMap" || force) this.provider = new OpenWeatherMap(this);
                break;
            case DATA_SERVICE.MET_NORWAY:         // No TZ or city info
                if (currentName != "MetNorway" || force) this.provider = new MetNorway(this);
                break;
            case DATA_SERVICE.WEATHERBIT:
                if (currentName != "Weatherbit" || force) this.provider = new Weatherbit(this);
                break;
            case DATA_SERVICE.YAHOO:
                if (currentName != "Yahoo" || force) this.provider = new Yahoo(this);
                break;
            case DATA_SERVICE.CLIMACELL:
                if (currentName != "Climacell" || force) this.provider = new Climacell(this);
                break;
            case DATA_SERVICE.MET_UK:
                if (currentName != "Met Office UK" || force) this.provider = new MetUk(this);
                break;
            case DATA_SERVICE.US_WEATHER:
                if (currentName != "US Weather" || force) this.provider = new USWeather(this);
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