import { WeatherApplet } from "./main";
import { IpApi } from "./ipApi";
import { SettingKeys, LocationData, DistanceUnitLocalePrefs, WindSpeedLocalePrefs } from "./types";
import { clearTimeout, setTimeout, _, isCoordinate, constructJsLocale } from "./utils";
import { Log } from "./logger";
import { UUID, SIGNAL_CHANGED } from "./consts";
import { LocationStore } from "./locationstore";
import { GeoLocation } from "./nominatim";

const { AppletSettings, BindingDirection } = imports.ui.settings;
const Lang: typeof imports.lang = imports.lang;
const keybindingManager = imports.ui.main.keybindingManager;
const { IconType } = imports.gi.St;
const { get_language_names } = imports.gi.GLib;

/** Units Used in Options. Change Options list if You change this! */
export type WeatherUnits = 'automatic' | 'celsius' | 'fahrenheit';
/** Units Used in Options. Change Options list if You change this! */
export type WeatherWindSpeedUnits = 'automatic' | 'kph' | 'mph' | 'm/s' | 'Knots' | 'Beaufort';
/** Units used in Options. Change Options list if You change this! */
export type WeatherPressureUnits = 'hPa' | 'mm Hg' | 'in Hg' | 'Pa' | 'psi' | 'atm' | 'at';
/** Change settings-scheme if you change this! */
export type DistanceUnits = 'automatic' | 'metric' | 'imperial';
export type Services = "OpenWeatherMap" | "DarkSky" | "MetNorway" | "Weatherbit" | "Yahoo" | "Climacell" | "Met Office UK" | "US Weather";
export class Config {
	// Info partially from https://github.com/unicode-org/cldr/blob/release-38-1/common/supplemental/units.xml
	/** Default is celsius */
	private readonly fahrenheitCountries = ["bs", "bz", "ky", "pr", "pw", "us"];
	/** Default kph, gb added to mph keys  */
	private readonly windSpeedUnitLocales: WindSpeedLocalePrefs = {
		"fi kr no pl ru se": "m/s",
		"us gb": "mph"
	}
	/** Default metric */
	private readonly distanceUnitLocales: DistanceUnitLocalePrefs = {
		"us gb": "imperial"
	}

    private readonly WEATHER_LOCATION = "location"
    private readonly WEATHER_USE_SYMBOLIC_ICONS_KEY = 'useSymbolicIcons'

	/**
	 * Keys matching the ones in settings-schema.json
	 */
    private readonly KEYS: SettingKeys = {
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
	// complex variables, using getters instead to access
	private readonly _location: string;
	private readonly _temperatureUnit: WeatherUnits;
	private readonly _windSpeedUnit: WeatherWindSpeedUnits;
	private readonly _distanceUnit: DistanceUnits;
	// No need to access this from the outside
	private readonly keybinding: any;

	// simple variables
    public readonly _refreshInterval: number;
    public readonly _manualLocation: boolean;
    public readonly _dataService: Services;
    public readonly _translateCondition: boolean;
    public readonly _pressureUnit: WeatherPressureUnits;
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

    /** Timeout */
    private doneTypingLocation: any = null;
	private currentLocation: LocationData = null;

    private settings: imports.ui.settings.AppletSettings;
	private app: WeatherApplet;
    private countryCode: string;
    
	private readonly autoLocProvider: IpApi
	private readonly geoLocationService: GeoLocation;

	/** Stores and retrieves manual locations */
	public readonly LocStore: LocationStore;
	public currentLocale: string;

    constructor(app: WeatherApplet, instanceID: number) {
		this.app = app;
		this.LocStore = new LocationStore(this.app);
		this.currentLocale = constructJsLocale(get_language_names()[0]);
		Log.Instance.Debug("System locale is " + this.currentLocale);

		this.autoLocProvider = new IpApi(app); // IP location lookup
		this.geoLocationService = new GeoLocation(app);
		this.countryCode = this.GetCountryCode(this.currentLocale);
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
            "keybinding", Lang.bind(this, this.OnKeySettingsUpdated), null);

        keybindingManager.addHotKey(
            UUID, this.keybinding, Lang.bind(this.app, this.app.on_applet_clicked));

        this.settings.connect(SIGNAL_CHANGED + this.WEATHER_USE_SYMBOLIC_ICONS_KEY, Lang.bind(this, this.IconTypeChanged));
	}

	public get CurrentLocation() {
		return this.currentLocation;
	}
	
	/**
	 * @returns Units, automatic is already resolved here
	 */
	public get TemperatureUnit(): WeatherUnits {
		if (this._temperatureUnit == "automatic") 
			return this.GetLocaleTemperateUnit(this.countryCode);
		return this._temperatureUnit;
	}

	/**
	 * @returns Units, automatic is already resolved here
	 */
	public get WindSpeedUnit(): WeatherWindSpeedUnits {
		if (this._windSpeedUnit == "automatic") 
			return this.GetLocaleWindSpeedUnit(this.countryCode);
		return this._windSpeedUnit;
	}

	/**
	 * @returns Units, automatic is already resolved here
	 */
	public get DistanceUnit(): DistanceUnits {
		if (this._distanceUnit == "automatic") return this.GetLocaleDistanceUnit(this.countryCode);
		return this._distanceUnit;
	}

	/**
	 * Gets Icon type based on user config
	 */
    public get IconType(): imports.gi.St.IconType {
        return this.settings.getValue(this.WEATHER_USE_SYMBOLIC_ICONS_KEY) ?
            IconType.SYMBOLIC :
            IconType.FULLCOLOR
	};
	
	/** Called when user changed manual locations, automatically switches to maunal location mode. */
	public SwitchToNextLocation(): LocationData {
		let nextLoc = this.LocStore.GetNextLocation(this.CurrentLocation);
		if (nextLoc == null) return null;
		this.InjectLocationToConfig(nextLoc, true);
		return nextLoc;
	}

	/** Called when user changed manual locations, automatically switches to maunal location mode. */
	public SwitchToPreviousLocation(): LocationData {
        let previousLoc = this.LocStore.GetPreviousLocation(this.CurrentLocation);
		if (previousLoc == null) return null;
		this.InjectLocationToConfig(previousLoc, true);
		return previousLoc;
	}

    public NoApiKey(): boolean {
        if (this._apiKey == undefined || this._apiKey == "") {
            return true;
        }
        return false;
    };

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
            let location = await this.autoLocProvider.GetLocation();
            // User facing errors handled by provider
            if (!location) return null;

            this.InjectLocationToConfig(location);
            return location;
        }

        // Manual Location

        let loc = this._location;
        if (loc == undefined || loc.trim() == "") {  // No location
            this.app.ShowError({
                type: "hard",
                detail: "no location",
                userError: true,
                message: _("Make sure you entered a location or use Automatic location instead")
            });
            return null;
		}

        // Find location in storage
        let location = this.LocStore.FindLocation(this._location);
        if (location != null) {
            Log.Instance.Debug("location exist in locationstore, retrieve");
			this.LocStore.SwitchToLocation(location);
			this.InjectLocationToConfig(location, true);
            return location;
        }
        // location not in storage
        else if (isCoordinate(loc)) {
            // Get Location
            loc = loc.replace(" ", "");
            let latLong = loc.split(",");
            let location: LocationData = {
                lat: parseFloat(latLong[0]),
                lon: parseFloat(latLong[1]),
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

        Log.Instance.Debug("Location is text, geolocating...")
        let locationData = await this.geoLocationService.GetLocation(loc);
        // User facing errors are handled by service
        if (locationData == null) return null;
        if (!!locationData?.entryText) {
            Log.Instance.Debug("Address found via address search");
        }

        // Maybe location is in locationStore, first search
        location = this.LocStore.FindLocation(locationData.entryText);
        if (location != null) {
            Log.Instance.Debug("Found location was found in locationStore, return that instead");
			this.InjectLocationToConfig(location);
			this.LocStore.SwitchToLocation(location);
            return location;
        }
        else {
            this.InjectLocationToConfig(locationData);
            return locationData;
        }
	}
	
	// UTILS

	private InjectLocationToConfig(loc: LocationData, switchToManual: boolean = false) {
        Log.Instance.Debug("Location setting is now: " + loc.entryText);
        let text = loc.entryText + ""; // Only values can be injected into settings and not references, so we add empty string to it.
        this.SetLocation(text);
        this.currentLocation = loc;
        if (switchToManual == true) this.settings.setValue(this.KEYS.MANUAL_LOCATION, true);
    }

	private IconTypeChanged() {
        this.app.ui.UpdateIconType(this.IconType);
        Log.Instance.Debug("Symbolic icon setting changed");
	}

	private OnKeySettingsUpdated(): void {
		if (this.keybinding != null) {
			keybindingManager.addHotKey(
				UUID,
				this.keybinding,
				Lang.bind(this.app, this.app.on_applet_clicked)
			);
		}
	}

	/** It was spamming refresh before, changed to wait until user stopped typing fro 3 seconds */
	private OnLocationChanged() {
		Log.Instance.Debug("User changed location, waiting 3 seconds...");
		if (this.doneTypingLocation != null) clearTimeout(this.doneTypingLocation);
		this.doneTypingLocation = setTimeout(Lang.bind(this, this.DoneTypingLocation), 3000);
	}

	/** Called when 3 seconds is up with no change in location */
	private DoneTypingLocation() {
		Log.Instance.Debug("User has finished typing, beginning refresh");
		this.doneTypingLocation = null;
		this.app.RefreshAndRebuild();
	}

	private OnSettingChanged() {
		this.app.RefreshAndRebuild();
	}

	private SetLocation(value: string) {
		this.settings.setValue(this.WEATHER_LOCATION, value);
	}

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
		let split = locale.split("-");
		// There is no country code
		if (split.length < 2) return null;
	
		return split[1];
	}
}