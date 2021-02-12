
//----------------------------------------------------------------------
//
// Weather Applet
//
//----------------------------------------------------------------------

import { Climacell } from "./climacell";
import { Config } from "./config";
import { WeatherLoop } from "./loop";
import { MetUk } from "./met_uk";
import { WeatherData, WeatherProvider, LocationData, AppletError, CustomIcons, NiceErrorDetail, RefreshState, BuiltinIcons } from "./types";
import { UI } from "./ui";
import { AwareDateString, CapitalizeEveryWord, CapitalizeFirstLetter, GenerateLocationText, NotEmpty, ProcessCondition, TempToUserConfig, UnitToUnicode, WeatherIconSafely, _ } from "./utils";
import { DarkSky } from "./darkSky";
import { OpenWeatherMap } from "./openWeatherMap";
import { USWeather } from "./us_weather";
import { Weatherbit } from "./weatherbit";
import { Yahoo } from "./yahoo";
import { MetNorway } from "./met_norway";
import { HttpLib, HttpError, Method, HTTPParams } from "./httpLib";
import { Log } from "./logger";
import { APPLET_ICON, REFRESH_ICON } from "./consts";
import { VisualCrossing } from "./visualcrossing";
import { ClimacellV4 } from "./climacellV4";
import { DanishMI } from "./danishMI";

const { TextIconApplet, AllowedLayout, MenuItem } = imports.ui.applet;
const { spawnCommandLine } = imports.misc.util;
const { IconType, Side } = imports.gi.St;

export class WeatherApplet extends TextIconApplet {	
    private readonly loop: WeatherLoop;
    private lock = false;
    private refreshTriggeredWhileLocked = false;

	/** Chosen API */
	private provider: WeatherProvider;
	
	private orientation: imports.gi.St.Side;
	public get Orientation() {
		return this.orientation;
	}

	/** Running applet's path */
	public readonly AppletDir: string;
	public readonly config: Config;
	public readonly ui: UI;

	/** Used for error handling, first error calls flips it
	 * to prevents displaying other errors in the current loop.
	 */
    public encounteredError: boolean = false;

    public constructor(metadata: any, orientation: imports.gi.St.Side, panelHeight: number, instanceId: number) {
		super(orientation, panelHeight, instanceId);
		this.AppletDir = metadata.path;
		Log.Instance.Debug("Applet created with instanceID " + instanceId);
		Log.Instance.Debug("AppletDir is: " + this.AppletDir);

        this.SetAppletOnPanel();
        this.config = new Config(this, instanceId);
        this.AddRefreshButton();
        this.EnsureProvider();
        this.ui = new UI(this, orientation);
		this.ui.Rebuild(this.config);
        this.loop = new WeatherLoop(this, instanceId);

        this.orientation = orientation;
        try {
            this.setAllowedLayout(AllowedLayout.BOTH);
        } catch (e) {
            // vertical panel not supported
        }
        this.loop.Start();
	}
	
	public Locked(): boolean {
        return this.lock;
	}
	
	/**
	 * @returns Queues a refresh if if refresh was triggered while locked.
	 */
    public RefreshAndRebuild(this: WeatherApplet, loc?: LocationData): void {
        this.loop.Resume();
        if (this.Locked()) {
            this.refreshTriggeredWhileLocked = true;
            return;
        }
        this.RefreshWeather(true, loc);
	};

	/**
	 * Main function pulling and refreshing data
	 * @param rebuild 
	 */
    public async RefreshWeather(this: WeatherApplet, rebuild: boolean, location?: LocationData): Promise<RefreshState> {
		try {
			if (this.lock) {
				Log.Instance.Print("Refreshing in progress, refresh skipped.");
				return RefreshState.Locked;
			}

			this.lock = true;
			this.encounteredError = false;
			
			if (!location) {
				location = await this.config.EnsureLocation();
				if (!location) {
					this.Unlock();
					return RefreshState.Error;
				}
			}

			this.EnsureProvider();
			// No key
			if (this.provider.needsApiKey && this.config.NoApiKey()) {
				Log.Instance.Error("No API Key given");
				this.ShowError({
					type: "hard",
					userError: true,
					detail: "no key",
					message: _("This provider requires an API key to operate")
				});
				return null;
			}
			let weatherInfo = await this.provider.GetWeather(location);
			if (weatherInfo == null) {
				this.Unlock();
				return RefreshState.Failure;
			}

			weatherInfo = this.MergeWeatherData(weatherInfo, location);

			if (rebuild) this.ui.Rebuild(this.config);
			if (!this.ui.Display(weatherInfo, this.config, this.provider)||
				!this.DisplayWeather(weatherInfo)) {
				this.Unlock();
				return RefreshState.Failure;
			}

			Log.Instance.Print("Weather Information refreshed");
			this.loop.ResetErrorCount();
			this.Unlock();
			return RefreshState.Success;
        }
        catch (e) {
            Log.Instance.Error("Generic Error while refreshing Weather info: " + e + ", ");
			this.ShowError({ type: "hard", detail: "unknown", message: _("Unexpected Error While Refreshing Weather, please see log in Looking Glass") });
			this.Unlock();
            return RefreshState.Failure;
		}
	};

	// ---------------------------------------------------------------------------
	// Panel Set helpers helpers

	/** Displays weather info in applet's panel */
	private DisplayWeather(weather: WeatherData): boolean {
		let location = GenerateLocationText(weather, this.config);

		let lastUpdatedTime = AwareDateString(weather.date, this.config.currentLocale, this.config._show24Hours);
		this.SetAppletTooltip(`${location} - ${_("As of {lastUpdatedTime}", {"lastUpdatedTime": lastUpdatedTime})}`);
		this.DisplayWeatherOnLabel(weather.temperature, weather.condition.description);
		this.SetAppletIcon(weather.condition.icons, weather.condition.customIcon);
		return true;
	}

	private DisplayWeatherOnLabel(temperature: number, mainCondition: string) {
		mainCondition = CapitalizeFirstLetter(mainCondition)
		let temp = TempToUserConfig(temperature, this.config.TemperatureUnit, this.config._tempRussianStyle);
		// Applet panel label
		let label = "";
		// Horizontal panels
		if (this.Orientation != Side.LEFT && this.Orientation != Side.RIGHT) {
			if (this.config._showCommentInPanel) {
				label += mainCondition;
			}
			if (this.config._showTextInPanel) {
				if (label != "") {
					label += " ";
				}
				label += (temp + ' ' + UnitToUnicode(this.config.TemperatureUnit));
			}
		}
		// Vertical panels
		else {
			if (this.config._showTextInPanel) {
				label = temp;
				// Vertical panel width is more than this value then we has space
				// to show units
				if (this.GetPanelHeight() >= 35) {
					label += UnitToUnicode(this.config.TemperatureUnit);
				}
			}
		}

		// Overriding temperature panel label
		if (NotEmpty(this.config._tempTextOverride)) {
			label = this.config._tempTextOverride
				.replace("{t}", temp)
				.replace("{u}", UnitToUnicode(this.config.TemperatureUnit))
				.replace("{c}", mainCondition);
		}

		this.SetAppletLabel(label);
	}

	private SetAppletTooltip(msg: string) {
        this.set_applet_tooltip(msg);
    }

    private SetAppletIcon(iconNames: BuiltinIcons[], customIcon: CustomIcons) {
		if (this.config._useCustomAppletIcons) {
			this.SetCustomIcon(customIcon);
		}
		else {
			let icon = WeatherIconSafely(iconNames, this.config.AppletIconType);
			this.config.AppletIconType == IconType.SYMBOLIC ? 
			this.set_applet_icon_symbolic_name(icon) :
            this.set_applet_icon_name(icon);
		}
	}
	
	private SetAppletLabel(label: string) {
        this.set_applet_label(label);
    }

    private GetPanelHeight(): number {
        return this.panel._getScaledPanelHeight();
	}

	// ---------------------------------------------------------------------------
	// UI helpers

	public GetMaxForecastDays(): number {
        if (!this.provider) return this.config._forecastDays;
		return Math.min(this.config._forecastDays, this.provider.maxForecastSupport);
    }

    public GetMaxHourlyForecasts(): number {
        if (!this.provider) return this.config._forecastHours;
        return Math.min(this.config._forecastHours, this.provider.maxHourlyForecastSupport);
	}

	// ------------------------------------------------------------------------
	// IO Helpers

	/**
	 * Loads JSON response from specified URLs
	 * @param url URL without params
	 * @param params param object
	 * @param HandleError should return true if you want this function to handle errors, else false
	 * @param method default is GET
	 */
	public async LoadJsonAsync<T>(this: WeatherApplet, url: string, params?: HTTPParams, HandleError?: (message: HttpError) => boolean, method: Method = "GET"): Promise<T> {
		let response = await HttpLib.Instance.LoadJsonAsync<T>(url, params, method);
		
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
	
	// ----------------------------------------------------------------------------
	// Config Callbacks, do not delete

    private async locationLookup(): Promise<void> {
        let command = "xdg-open ";
        spawnCommandLine(command + "https://cinnamon-spices.linuxmint.com/applets/view/17");
    }

    private async submitIssue(): Promise<void> {
        let command = "xdg-open ";
        spawnCommandLine(command + "https://github.com/linuxmint/cinnamon-spices-applets/issues/new");
    }

    private async saveCurrentLocation(): Promise<void> {
        this.config.LocStore.SaveCurrentLocation(this.config.CurrentLocation);
    }

	// -------------------------------------------------------------------
	// Applet Overrides, do not delete

    /** override function */
    private on_orientation_changed(orientation: imports.gi.St.Side) {
        this.orientation = orientation;
        this.RefreshWeather(true);
    };

    /** Override function */
    private on_applet_removed_from_panel(deleteConfig: any) {
        // TODO: Proper unload
        //this.unloadStylesheet();
        //Main.keybindingManager.removeHotKey(this.menu_keybinding_name);
        //this.sigMan.disconnectAllSignals();
        //this.settings && this.settings.finalize();
        //$.Debugger.destroy();
        Log.Instance.Print("Removing applet instance...")
        this.loop.Stop();
    }

    /** Override function */
    public on_applet_clicked(event: any): void {
        this.ui.Toggle();
    }

    /** Override function */
    private on_applet_middle_clicked(event: any) {

    }

    /** Override function */
    private on_panel_height_changed() {
        // Implemented byApplets
	}
	
	// ---------------------------------------------------------------------
	// Utilities

	/** Set applet on the panel with default settings */
	private SetAppletOnPanel(): void {
		this.set_applet_icon_name(APPLET_ICON);
		this.set_applet_label(_("..."));
		this.set_applet_tooltip(_("Click to open"));
	}

	private Unlock(): void {
		this.lock = false;
		if (this.refreshTriggeredWhileLocked) {
			Log.Instance.Print("Refreshing triggered by config change while refreshing, starting now...");
			this.refreshTriggeredWhileLocked = false;
			this.RefreshAndRebuild();
		}

	}

	/** Into right-click context menu */
	private AddRefreshButton(): void {
        let itemLabel = _("Refresh")
        // () => functions do not need to bind context
		let refreshMenuItem = new MenuItem(itemLabel, REFRESH_ICON, () => this.RefreshAndRebuild());
		this._applet_context_menu.addMenuItem(refreshMenuItem);
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

	private SetCustomIcon(iconName: CustomIcons): void {
		this.set_applet_icon_symbolic_name(iconName);
	}

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
			case "ClimacellV4":
				if (currentName != "ClimacellV4" || force) this.provider = new ClimacellV4(this);
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
			case "Visual Crossing":
				if (currentName != "Visual Crossing" || force) this.provider = new VisualCrossing(this);
				break;
			case "DanishMI":
				if (currentName != "DanishMI" || force) this.provider = new DanishMI(this);
				break;
            default:
                return null;
        }
    }

	/** Fills in missing weather info from location Data
	 * and applies translations if needed.
	 */
	private MergeWeatherData(weatherInfo: WeatherData, locationData: LocationData) {
		if (weatherInfo.location.city == null) weatherInfo.location.city = locationData.city;
		if (weatherInfo.location.country == null) weatherInfo.location.country = locationData.country;
		if (weatherInfo.location.timeZone == null) weatherInfo.location.timeZone = locationData.timeZone;
		if (weatherInfo.coord.lat == null) weatherInfo.coord.lat = locationData.lat;
		if (weatherInfo.coord.lon == null) weatherInfo.coord.lon = locationData.lon;
		if (weatherInfo.hourlyForecasts == null) weatherInfo.hourlyForecasts = [];

		// Translate conditions if set
		weatherInfo.condition.main = ProcessCondition(weatherInfo.condition.main, this.config._translateCondition);
		weatherInfo.condition.description = ProcessCondition(weatherInfo.condition.description, this.config._translateCondition);
			
		for (let index = 0; index < weatherInfo.forecasts.length; index++) {
			const condition = weatherInfo.forecasts[index].condition;
			condition.main = ProcessCondition(condition.main, this.config._translateCondition);
			condition.description = ProcessCondition(condition.description, this.config._translateCondition);
		}
		
		for (let index = 0; index < weatherInfo.hourlyForecasts.length; index++) {
			const condition = weatherInfo.hourlyForecasts[index].condition;
			condition.main = ProcessCondition(condition.main, this.config._translateCondition);
			condition.description = ProcessCondition(condition.description, this.config._translateCondition);		
		}

		return weatherInfo;
	}
	
	// ---------------------------------------------------------------------------------------

    // Error handling

	/** For displaying hard errors */
    private DisplayHardError(title: string, msg: string): void {
        this.set_applet_label(title);
        this.set_applet_tooltip("Click to open");
        this.set_applet_icon_name("weather-severe-alert");
        this.ui.DisplayErrorMessage(msg, "hard");
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
		Log.Instance.Debug("User facing Error received, error: " + JSON.stringify(error, null, 2));
		
        if (error.type == "hard") {
            Log.Instance.Debug("Displaying hard error");
            this.ui.Rebuild(this.config);
            this.DisplayHardError(this.errMsg[error.detail], (!error.message) ? "" : error.message);
        }

        if (error.type == "soft") {
            // Maybe something less invasive on network related errors?
            // Nothing yet
            if (this.loop.IsDataTooOld()) {
                this.set_applet_tooltip("Click to open");
                this.set_applet_icon_name("weather-severe-alert");
                this.ui.DisplayErrorMessage(_("Could not update weather for a while...\nare you connected to the internet?"), "soft");
            }
        }

        if (error.userError) {
            this.loop.Pause();
            return;
        }

        let nextRefresh = this.loop.GetSecondsUntilNextRefresh();
        Log.Instance.Error("Retrying in the next " + nextRefresh.toString() + " seconds...");
	}
	
	//----------------------------------------------------------------------------------
}