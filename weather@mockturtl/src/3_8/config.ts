import { WeatherApplet } from "./main";
import { IpApi } from "./ipApi";
import { LocationData } from "./types";
import { clearTimeout, setTimeout, _, IsCoordinate, ConstructJsLocale } from "./utils";
import { Log } from "./logger";
import { UUID, SIGNAL_CHANGED } from "./consts";
import { LocationStore } from "./locationstore";
import { GeoLocation } from "./nominatim";

const { AppletSettings, BindingDirection } = imports.ui.settings;
const Lang: typeof imports.lang = imports.lang;
const keybindingManager = imports.ui.main.keybindingManager;
const { IconType } = imports.gi.St;
const { get_language_names } = imports.gi.GLib;
const { Settings } = imports.gi.Gio;

/** Units Used in Options. Change Options list if You change this! */
export type WeatherUnits = 'automatic' | 'celsius' | 'fahrenheit';
/** Units Used in Options. Change Options list if You change this! */
export type WeatherWindSpeedUnits = 'automatic' | 'kph' | 'mph' | 'm/s' | 'Knots' | 'Beaufort';
/** Units used in Options. Change Options list if You change this! */
export type WeatherPressureUnits = 'hPa' | 'mm Hg' | 'in Hg' | 'Pa' | 'psi' | 'atm' | 'at';
/** Change settings-schema if you change this! */
export type DistanceUnits = 'automatic' | 'metric' | 'imperial';

/** Change settings-schema if you change this */
export type Services =
	"OpenWeatherMap" |
	"DarkSky" |
	"MetNorway" |
	"Weatherbit" |
	"Yahoo" |
	"ClimacellV4" |
	"Climacell" |
	"Met Office UK" |
	"US Weather" |
	"Visual Crossing" |
	"DanishMI";

/**
 * Keys matching the ones in settings-schema.json
 */
const Keys = {
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
	SHOW_FORECAST_DATES: "showForecastDates",
	WEATHER_USE_SYMBOLIC_ICONS_KEY: 'useSymbolicIcons',
	IMMEDIATE_PRECIP: "immediatePrecip"
}

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

	private readonly WEATHER_LOCATION = "location";
	private readonly WEATHER_LOCATION_LIST = "locationList";
	// Settings variables to bind to
	// complex variables, using getters instead to access
	private readonly _location: string;
	private readonly _temperatureUnit: WeatherUnits;
	private readonly _windSpeedUnit: WeatherWindSpeedUnits;
	private readonly _distanceUnit: DistanceUnits;
	private readonly _apiKey: string;
	private readonly _useSymbolicIcons: boolean;
	// No need to access this from the outside
	private readonly keybinding: string;

	// simple variables
	public readonly _refreshInterval: number;
	public readonly _manualLocation: boolean;
	public readonly _dataService: Services;
	public readonly _translateCondition: boolean;
	public readonly _pressureUnit: WeatherPressureUnits;
	public readonly _show24Hours: boolean;
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
	public readonly _locationList: LocationData[];
	public readonly _immediatePrecip: boolean;

	/** Timeout */
	private doneTypingLocation: number = null;
	private currentLocation: LocationData = null;

	private settings: imports.ui.settings.AppletSettings;
	private app: WeatherApplet;
	private countryCode: string;

	private timezone: string = null;

	public get Timezone() {
		return this.timezone;
	}

	public set Timezone(value: string) {
		if (!value || value == "")
			value = null;
		this.timezone = value;
	}

	private readonly autoLocProvider: IpApi
	private readonly geoLocationService: GeoLocation;

	/** Stores and retrieves manual locations */
	public readonly LocStore: LocationStore;
	public currentLocale: string;

	private readonly InterfaceSettings: imports.gi.Gio.Settings;
	private currentFontSize: number;

	constructor(app: WeatherApplet, instanceID: number) {
		this.app = app;
		this.currentLocale = ConstructJsLocale(get_language_names()[0]);
		Log.Instance.Debug("System locale is " + this.currentLocale);

		this.autoLocProvider = new IpApi(app); // IP location lookup
		this.geoLocationService = new GeoLocation(app);
		this.countryCode = this.GetCountryCode(this.currentLocale);
		this.settings = new AppletSettings(this, UUID, instanceID);
		this.InterfaceSettings = new Settings({ schema: "org.cinnamon.desktop.interface" });
		this.InterfaceSettings.connect('changed::font-name', () => this.OnFontChanged());
		this.currentFontSize = this.GetCurrentFontSize();
		this.BindSettings();
		this.LocStore = new LocationStore(this.app, this);
	}

	/** Attaches settings to functions */
	private BindSettings() {
		let k: keyof typeof Keys;
		for (k in Keys) {
			let key = Keys[k];
			let keyProp = "_" + key;
			this.settings.bindProperty(BindingDirection.IN,
				key, keyProp, Lang.bind(this, this.OnSettingChanged), null);
		}

		// Settings what need special care
		this.settings.bindProperty(BindingDirection.BIDIRECTIONAL,
			this.WEATHER_LOCATION, ("_" + this.WEATHER_LOCATION), Lang.bind(this, this.OnLocationChanged), null);

		this.settings.bindProperty(BindingDirection.BIDIRECTIONAL,
			this.WEATHER_LOCATION_LIST, ("_" + this.WEATHER_LOCATION_LIST), Lang.bind(this, this.OnLocationStoreChanged), null);

		this.settings.bindProperty(BindingDirection.IN, "keybinding",
			"keybinding", Lang.bind(this, this.OnKeySettingsUpdated), null);

		keybindingManager.addHotKey(
			UUID, this.keybinding, Lang.bind(this.app, this.app.on_applet_clicked));
	}

	public get CurrentFontSize(): number {
		return this.currentFontSize;
	}

	public get CurrentLocation() {
		return this.currentLocation;
	}

	public get ApiKey() {
		return this._apiKey.replace(" ", "");
	}

	public get Language() {
		return this.GetLanguage(this.currentLocale);
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
		if (this._useCustomMenuIcons)
			return IconType.SYMBOLIC;

		return this._useSymbolicIcons ?
			IconType.SYMBOLIC :
			IconType.FULLCOLOR;
	};

	public get AppletIconType(): imports.gi.St.IconType {
		if (this._useCustomAppletIcons)
			return IconType.SYMBOLIC;

		return this._useSymbolicIcons ?
			IconType.SYMBOLIC :
			IconType.FULLCOLOR;
	}

	/** Called when user changed manual locations, automatically switches to manual location mode. */
	public SwitchToNextLocation(): LocationData {
		let nextLoc = this.LocStore.GetNextLocation(this.CurrentLocation);
		if (nextLoc == null) return null;
		this.InjectLocationToConfig(nextLoc, true);
		return nextLoc;
	}

	/** Called when user changed manual locations, automatically switches to manual location mode. */
	public SwitchToPreviousLocation(): LocationData {
		let previousLoc = this.LocStore.GetPreviousLocation(this.CurrentLocation);
		if (previousLoc == null) return null;
		this.InjectLocationToConfig(previousLoc, true);
		return previousLoc;
	}

	public NoApiKey(): boolean {
		let key = this._apiKey?.replace(" ", "");
		return (!key || key == "");
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
		else if (IsCoordinate(loc)) {
			// Get Location
			loc = loc.replace(" ", "");
			let latLong = loc.split(",");
			let location: LocationData = {
				lat: parseFloat(latLong[0]),
				lon: parseFloat(latLong[1]),
				city: null,
				country: null,
				timeZone: null,
				entryText: loc,
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
		let text = (loc.entryText + ""); // Only values can be injected into settings and not references, so we add empty string to it.
		this.SetLocation(text);
		this.currentLocation = loc;
		if (switchToManual == true) this.settings.setValue(Keys.MANUAL_LOCATION, true);
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

	private OnLocationStoreChanged() {
		this.LocStore.OnLocationChanged(this._locationList)
	}

	private OnFontChanged() {
		this.currentFontSize = this.GetCurrentFontSize();
		this.app.RefreshAndRebuild();
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

	public SetLocationList(list: LocationData[]) {
		this.settings.setValue(this.WEATHER_LOCATION_LIST, list);
	}

	private GetLocaleTemperateUnit(code: string): WeatherUnits {
		if (code == null || !this.fahrenheitCountries.includes(code)) return "celsius";
		return "fahrenheit";
	}

	private GetLocaleWindSpeedUnit(code: string): WeatherWindSpeedUnits {
		if (code == null) return "kph";

		for (const key in this.windSpeedUnitLocales) {
			if (key.includes(code)) return this.windSpeedUnitLocales[key];
		}
		return "kph";
	}

	private GetLocaleDistanceUnit(code: string): DistanceUnits {
		if (code == null) return "metric";

		for (const key in this.distanceUnitLocales) {
			if (key.includes(code)) return this.distanceUnitLocales[key];
		}
		return "metric";
	}

	private GetCountryCode(locale: string) {
		let split = locale.split("-");
		// There is no country code
		if (split.length < 2) return null;

		return split[1];
	}

	private GetLanguage(locale: string) {
		let split = locale.split("-");
		if (split.length < 1) return null;

		return split[0];
	}

	private GetCurrentFontSize() {
		let nameString = this.InterfaceSettings.get_string("font-name");
		let elements = nameString.split(" ");
		let size = parseFloat(elements[elements.length - 1]);
		Log.Instance.Debug("Font size changed to " + size.toString());
		return size;
	}
}

interface WindSpeedLocalePrefs {
	[key: string]: WeatherWindSpeedUnits;
}
interface DistanceUnitLocalePrefs {
	[key: string]: DistanceUnits;
}