import { WeatherApplet } from "./main";
import { IpApi } from "./ipApi";
import { SettingKeys, LocationData, DistanceUnitLocalePrefs, WindSpeedLocalePrefs } from "./types";
import { clearTimeout, setTimeout, _, isCoordinate } from "./utils";
import { Logger } from "./logger";

const { AppletSettings, BindingDirection } = imports.ui.settings;
const Lang: typeof imports.lang = imports.lang;
const keybindingManager = imports.ui.main.keybindingManager;
const UUID = "weather@mockturtl"
const { IconType } = imports.gi.St;
const SIGNAL_CHANGED = 'changed::'

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
    
    public readonly autoLocProvider: IpApi

    constructor(app: WeatherApplet, instanceID: number, locale: string) {
        this.app = app;
        this.autoLocProvider = new IpApi(app); // IP location lookup
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
        Logger.Debug("Symbolic icon setting changed");
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
        Logger.Debug("User changed location, waiting 3 seconds...");
        if (this.doneTypingLocation != null) clearTimeout(this.doneTypingLocation);
        this.doneTypingLocation = setTimeout(Lang.bind(this, this.DoneTypingLocation), 3000);
    }

    /** Called when 3 seconds is up with no change in location */
    private DoneTypingLocation() {
        Logger.Debug("User has finished typing, beginning refresh");
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
        Logger.Debug("Location setting is now: " + loc.entryText);
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
            let location = await this.autoLocProvider.GetLocation();
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

        Logger.Debug("Location is text, geolocating...")
        let locationData = await this.app.geoLocationService.GetLocation(loc);
        // User facing errors are handled by service
        if (locationData == null) return null;
        if (!!locationData.address_string) {
            Logger.Debug("Address found via address search, placing found full address '" + locationData.address_string + "' back to location entry");
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