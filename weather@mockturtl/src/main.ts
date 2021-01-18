
//----------------------------------------------------------------------
//
// Weather Applet
//
//----------------------------------------------------------------------

import { Climacell } from "./climacell";
import { Config } from "./config";
import { LocationStore } from "./locationstore";
import { WeatherLoop } from "./loop";
import { MetUk } from "./met_uk";
import { WeatherData, WeatherProvider, LocationData, AppletError, CustomIcons, RefreshState, NiceErrorDetail } from "./types";
import { UI } from "./ui";
import { constructJsLocale, _ } from "./utils";
import { DarkSky } from "./darkSky";
import { GeoLocation } from "./nominatim";
import { OpenWeatherMap } from "./openWeatherMap";
import { USWeather } from "./us_weather";
import { Weatherbit } from "./weatherbit";
import { Yahoo } from "./yahoo";
import { MetNorway } from "./met_norway";
import { Http, HttpError, Method } from "./httpLib";
import { Logger } from "./logger";
import { APPLET_ICON, REFRESH_ICON, UUID } from "./consts";
import { Notifications } from "./notification_service";

const { TextIconApplet, AllowedLayout, MenuItem } = imports.ui.applet;
const { get_language_names } = imports.gi.GLib;
const Lang: typeof imports.lang = imports.lang;
const { spawnCommandLine, spawnCommandLineAsyncIO } = imports.misc.util;
const { IconType } = imports.gi.St;
const keybindingManager = imports.ui.main.keybindingManager;

export class WeatherApplet extends TextIconApplet {

    /** Running applet's path*/
    public readonly appletDir: string;

    public readonly currentLocale: string = null;
    private readonly loop: WeatherLoop;
    public readonly config: Config;
    public readonly ui: UI;
    private lock = false;
    private refreshTriggeredWhileLocked = false;

    private provider: WeatherProvider; // API
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
		this.appletDir = metadata.path;
		this.currentLocale = constructJsLocale(get_language_names()[0]);
		Logger.Debug("Applet created with instanceID " + instanceId);
        Logger.Debug("System locale is " + this.currentLocale);
        Logger.Debug("AppletDir is: " + this.appletDir);

        // importing custom translations
        imports.gettext.bindtextdomain(UUID, imports.gi.GLib.get_home_dir() + "/.local/share/locale");
		
        // Manually add the icons to the icon theme - only one icons folder
        imports.gi.Gtk.IconTheme.get_default().append_search_path(this.appletDir + "/../icons");

        this.SetAppletOnPanel();
        this.config = new Config(this, instanceId, this.currentLocale);
        this.AddRefreshButton();
        this.EnsureProvider();
        this.ui = new UI(this, orientation);
        this.ui.rebuild(this.config);
        this.loop = new WeatherLoop(this, instanceId);

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
            Logger.Print("Refreshing triggered by config change while refreshing, starting now...");
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
	 * Loads JSON response from specified URLs
	 * @param url URL without params
	 * @param params param object
	 * @param HandleError should return null if you want this function to handle errors, else it needs to return an applet object 
	 * @param method default is GET
	 */
	public async LoadJsonAsync<T>(url: string, params?: any, HandleError?: (message: HttpError) => boolean, method: Method = "GET"): Promise<T> {
		let response = await Http.LoadJsonAsync<T>(url, params, method);
		
		if (!response.Success) {
            // check if caller wants
            if (!!HandleError && !HandleError(response.ErrorData))
                return null;
            else {
                this.HandleHTTPError(response.ErrorData);
                return null;
            }
		}

		return response.Data;
	}

    /**
     * Handles general errors from HTTPLib
     * @param error 
     */
	private HandleHTTPError(error: HttpError): void {
		let appletError: AppletError = {
			detail: error.message,
			userError: false,
			code: error.code,
			message: this.errMsg[error.message],
			type: "soft"
		};

		switch(error.message) {
			case "bad status code":
			case "unknown":
				appletError.type = "hard"
		}

		this.ShowError(appletError);
	}

    /** Spawns a command and await for the output it gives */
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
            Logger.Error("Error calling command " + cmd + ", error: ");
            global.log(e);
            return null;
        }
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
	
	// Config Callbacks

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
            Notifications.Send(_("Error") + " - " + _("Location Store"), _("You can't save a location obtained automatically, sorry"));
        }
        this.locationStore.SaveCurrentLocation(this.config.currentLocation);
    }

    private async deleteCurrentLocation(): Promise<void> {
        this.locationStore.DeleteCurrentLocation(this.config.currentLocation);
	}

	private onLocationStorageChanged(itemCount: number) {
        Logger.Debug("On location storage callback called, number of locations now " + itemCount.toString());
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
	
	// -------------------------------------------------------------------

	// Applet Overrides

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
        Logger.Print("Removing applet instance...")
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
	
	// ---------------------------------------------------------------------

    //----------------------------------------------------------------------
    //
    // Main methods
    //
    //----------------------------------------------------------------------

	/**
	 * Lazy load provider
	 * @param force Force provider re initialization
	 */
    private EnsureProvider(force: boolean = false): void {
        let currentName = this.provider?.name;
        switch (this.config._dataService) {
            case "DarkSky":           // No City Info
                if (currentName != "DarkSky" || force) this.provider = new DarkSky(this);
                break;
            case "OpenWeatherMap":   // No City Info
                if (currentName != "OpenWeatherMap" || force) this.provider = new OpenWeatherMap(this);
                break;
            case "MetNorway":         // No TZ or city info
                if (currentName != "MetNorway" || force) this.provider = new MetNorway(this);
                break;
            case "Weatherbit":
                if (currentName != "Weatherbit" || force) this.provider = new Weatherbit(this);
                break;
            case "Yahoo":
                if (currentName != "Yahoo" || force) this.provider = new Yahoo(this);
                break;
            case "Climacell":
                if (currentName != "Climacell" || force) this.provider = new Climacell(this);
                break;
            case "Met Office UK":
                if (currentName != "Met Office UK" || force) this.provider = new MetUk(this);
                break;
            case "US Weather":
                if (currentName != "US Weather" || force) this.provider = new USWeather(this);
                break;
            default:
                return null;
        }
    }

	/**
	 * Main function pulling and refreshing data
	 * @param rebuild 
	 */
    public async refreshWeather(rebuild: boolean, location?: LocationData): Promise<RefreshState> {
		try {
			if (this.lock) {
				Logger.Print("Refreshing in progress, refresh skipped.");
				return "locked";
			}

			this.lock = true;
			this.encounteredError = false;
			
			if (!location) {
				location = await this.config.EnsureLocation();
				if (!location) {
					this.Unlock();
					return "error";
				}
			}
			else { // Using location changer buttons
				// switching manual location switch to true in this case
				this.config.InjectLocationToConfig(location, true);
			}
				this.EnsureProvider();
				let weatherInfo = await this.provider.GetWeather(location);
				if (weatherInfo == null) {
					this.Unlock();
					return "failure";
				}

				weatherInfo = this.MergeWeatherData(weatherInfo, location);

				if (rebuild) this.ui.rebuild(this.config);
				if (!this.ui.displayWeather(weatherInfo, this.config)
					|| !this.ui.displayForecast(weatherInfo, this.config)
					|| !this.ui.displayHourlyForecast(weatherInfo.hourlyForecasts, this.config, weatherInfo.location.timeZone)
					|| !this.ui.displayBar(weatherInfo, this.provider, this.config)) {
					this.Unlock();
					return "failure";
				}

				Logger.Print("Weather Information refreshed");
				this.loop.ResetErrorCount();
				this.Unlock();
				return "success";
        }
        catch (e) {
            Logger.Error("Generic Error while refreshing Weather info: " + e);
			this.ShowError({ type: "hard", detail: "unknown", message: _("Unexpected Error While Refreshing Weather, please see log in Looking Glass") });
			this.Unlock();
            return "failure";
		}
	};

	// --------------------------------------------------------------------------------------
	
	// Utils

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

	/** Fills in missing weather info from location Data  */
	private MergeWeatherData(weatherInfo: WeatherData, locationData: LocationData) {
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
	
	// ---------------------------------------------------------------------------------------

    // Error handling

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

    public ShowError(error: AppletError): void {
		if (error == null) return;
		// An error already claimed in this loop
		if (this.encounteredError == true) return;
		
        this.encounteredError = true;
		Logger.Debug("User facing Error received, error: " + JSON.stringify(error, null, 2));
		
        if (error.type == "hard") {
            Logger.Debug("Displaying hard error");
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
        Logger.Error("Retrying in the next " + nextRefresh.toString() + " seconds...");
	}
	
	//----------------------------------------------------------------------------------
}