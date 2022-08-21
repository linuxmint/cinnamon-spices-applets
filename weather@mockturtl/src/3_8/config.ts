import { WeatherApplet } from "./main";
import { IpApi } from "./location_services/ipApi";
import { LocationData, WeatherProvider } from "./types";
import { clearTimeout, setTimeout, _, IsCoordinate, ConstructJsLocale } from "./utils";
import { Logger } from "./lib/logger";
import { LogLevel, UUID } from "./consts";
import { LocationStore } from "./location_services/locationstore";
import { GeoLocation } from "./location_services/nominatim";
import { DateTime } from "luxon";
import { FileExists, LoadContents } from "./lib/io_lib";
import { MetUk } from "./providers/met_uk";
import { BaseProvider } from "./providers/BaseProvider";
import { DarkSky } from "./providers/darkSky";
import { OpenWeatherMap } from "./providers/openWeatherMap";
import { MetNorway } from "./providers/met_norway";
import { Weatherbit } from "./providers/weatherbit";
import { ClimacellV4 } from "./providers/climacellV4";
import { USWeather } from "./providers/us_weather";
import { VisualCrossing } from "./providers/visualcrossing";
import { DanishMI } from "./providers/danishMI";
import { AccuWeather } from "./providers/accuWeather";
import { DeutscherWetterdienst } from "./providers/deutscherWetterdienst";
import { WeatherUnderground } from "./providers/weatherUnderground";

const { get_home_dir } = imports.gi.GLib;
const { File } = imports.gi.Gio;
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
	"Tomorrow.io" |
	"Met Office UK" |
	"US Weather" |
	"Visual Crossing" |
	"DanishMI" |
	"AccuWeather" |
	"DeutscherWetterdienst" |
	"WeatherUnderground";

export const ServiceClassMapping: ServiceClassMappingType = {
	"DarkSky": (app) => new DarkSky(app),
	"OpenWeatherMap": (app) => new OpenWeatherMap(app),
	"MetNorway": (app) => new MetNorway(app),
	"Weatherbit": (app) => new Weatherbit(app),
	"Tomorrow.io": (app) => new ClimacellV4(app),
	"Met Office UK": (app) => new MetUk(app),
	"US Weather": (app) => new USWeather(app),
	"Visual Crossing": (app) => new VisualCrossing(app),
	"DanishMI": (app) => new DanishMI(app),
	"AccuWeather": (app) => new AccuWeather(app),
	"DeutscherWetterdienst": (app) => new DeutscherWetterdienst(app),
	"WeatherUnderground": (app) => new WeatherUnderground(app)
}

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
	//TEMP_TEXT_OVERRIDE: "tempTextOverride",
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
	USE_CUSTOM_APPLET_ICONS: 'useCustomAppletIcons',
	USE_CUSTOM_MENU_ICONS: "useCustomMenuIcons",
	RUSSIAN_STYLE: "tempRussianStyle",
	SHORT_HOURLY_TIME: "shortHourlyTime",
	SHOW_FORECAST_DATES: "showForecastDates",
	WEATHER_USE_SYMBOLIC_ICONS_KEY: 'useSymbolicIcons',
	IMMEDIATE_PRECIP: "immediatePrecip",
	SHOW_BOTH_TEMP: "showBothTempUnits",
	DISPLAY_WIND_DIR_AS_TEXT: "displayWindAsText",
	ALWAYS_SHOW_HOURLY: "alwaysShowHourlyWeather"
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
	private readonly _location!: string;
	private readonly _temperatureUnit!: WeatherUnits;
	private readonly _windSpeedUnit!: WeatherWindSpeedUnits;
	private readonly _distanceUnit!: DistanceUnits;
	private readonly _apiKey!: string;
	private readonly _useSymbolicIcons!: boolean;
	// No need to access this from the outside
	private readonly keybinding!: string;

	// simple variables
	public readonly _refreshInterval!: number;
	public readonly _manualLocation!: boolean;
	public readonly _dataService!: Services;
	public readonly _translateCondition!: boolean;
	public readonly _pressureUnit!: WeatherPressureUnits;
	public readonly _show24Hours!: boolean;
	public readonly _forecastDays!: number;
	public readonly _forecastHours!: number;
	public readonly _forecastColumns!: number;
	public readonly _forecastRows!: number;
	public readonly _verticalOrientation!: boolean;
	public readonly _temperatureHighFirst!: boolean;
	public readonly _shortConditions!: boolean;
	public readonly _showSunrise!: boolean;
	public readonly _showCommentInPanel!: boolean;
	public readonly _showTextInPanel!: boolean;
	public readonly _locationLabelOverride!: string;
	public readonly _useCustomAppletIcons!: boolean;
	public readonly _useCustomMenuIcons!: boolean;
	public readonly _tempTextOverride!: string;
	public readonly _tempRussianStyle!: boolean;
	public readonly _shortHourlyTime!: boolean;
	public readonly _showForecastDates!: boolean;
	public readonly _locationList!: LocationData[];
	public readonly _immediatePrecip!: boolean;
	public readonly _showBothTempUnits!: boolean;
	public readonly _displayWindAsText!: boolean;
	public readonly _alwaysShowHourlyWeather!: boolean;
	public readonly _logLevel!: LogLevel;
	public readonly _selectedLogPath!: string;

	/** Timeout */
	private doneTypingLocation: number | null = null;
	private currentLocation: LocationData | null = null;

	private settings: imports.ui.settings.AppletSettings;
	private app: WeatherApplet;
	public readonly countryCode: string | null;
	public textColorStyle: string | null = null;

	private timezone: string | undefined = undefined;

	public get Timezone() {
		return this.timezone;
	}

	public set Timezone(value: string | undefined) {
		if (!value || value == "")
			value = undefined;
		this.timezone = value;
	}

	private readonly autoLocProvider: IpApi
	private readonly geoLocationService: GeoLocation;

	/** Stores and retrieves manual locations */
	public readonly LocStore: LocationStore;
	public currentLocale: string | null;

	private readonly InterfaceSettings: imports.gi.Gio.Settings;
	private currentFontSize: number;

	constructor(app: WeatherApplet, instanceID: number) {
		this.app = app;
		this.settings = new AppletSettings(this, UUID, instanceID);
		// Bind as early as possible so that we can update the log level asap
		this.BindSettings();
		this.onLogLevelUpdated();
		this.currentLocale = ConstructJsLocale(get_language_names()[0]);
		Logger.Debug(`System locale is ${this.currentLocale}, original is ${get_language_names()[0]}`);
		this.countryCode = this.GetCountryCode(this.currentLocale);
		this.autoLocProvider = new IpApi(app); // IP location lookup
		this.geoLocationService = new GeoLocation(app);
		this.InterfaceSettings = new Settings({ schema: "org.cinnamon.desktop.interface" });
		this.InterfaceSettings.connect('changed::font-name', () => this.OnFontChanged());
		this.currentFontSize = this.GetCurrentFontSize();
		this.LocStore = new LocationStore(this.app, this);
	}

	/** Attaches settings to functions */
	private BindSettings() {
		let k: keyof typeof Keys;
		for (k in Keys) {
			const key = Keys[k];
			const keyProp = "_" + key;
			this.settings.bindProperty(BindingDirection.IN,
				key, keyProp, this.OnSettingChanged, null);
		}

		// Settings what need special care
		this.settings.bindProperty(BindingDirection.BIDIRECTIONAL,
			this.WEATHER_LOCATION, ("_" + this.WEATHER_LOCATION), this.OnLocationChanged, null);

		this.settings.bind("tempTextOverride", "_" + "tempTextOverride",
			this.app.RefreshLabel)

		this.settings.bindProperty(BindingDirection.BIDIRECTIONAL,
			this.WEATHER_LOCATION_LIST, ("_" + this.WEATHER_LOCATION_LIST), this.OnLocationStoreChanged, null);

		this.settings.bindProperty(BindingDirection.IN, "keybinding",
			"keybinding", this.OnKeySettingsUpdated, null);

		this.settings.bindProperty(BindingDirection.IN, "logLevel",
			"_logLevel", this.onLogLevelUpdated, null);

		this.settings.bind("selectedLogPath",
			"_selectedLogPath", this.app.saveLog);

		keybindingManager.addHotKey(
			UUID, this.keybinding, () => this.app.on_applet_clicked(null));
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
	public get TemperatureUnit(): Exclude<WeatherUnits, "automatic"> {
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
	public SwitchToNextLocation(): LocationData | null {
		const nextLoc = this.LocStore.GetNextLocation(this.CurrentLocation);
		if (nextLoc == null) return null;
		this.InjectLocationToConfig(nextLoc, true);
		return nextLoc;
	}

	/** Called when user changed manual locations, automatically switches to manual location mode. */
	public SwitchToPreviousLocation(): LocationData | null {
		const previousLoc = this.LocStore.GetPreviousLocation(this.CurrentLocation);
		if (previousLoc == null) return null;
		this.InjectLocationToConfig(previousLoc, true);
		return previousLoc;
	}

	public NoApiKey(): boolean {
		const key = this._apiKey?.replace(" ", "");
		return (!key || key == "");
	};

	/** 
	 * @returns LocationData null if failed to obtain
	 * coordinates. Automatic mode looks up data through ip-api, 
	 * else it returns coordinates if it was entered. If text was entered,
	 * it looks up coordinates via geolocation api
	 */
	public async EnsureLocation(): Promise<LocationData | null> {
		this.currentLocation = null;

		// Automatic location
		if (!this._manualLocation) {
			const location = await this.autoLocProvider.GetLocation();
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
			Logger.Debug("location exist in locationstore, retrieve");
			this.LocStore.SwitchToLocation(location);
			this.InjectLocationToConfig(location, true);
			return location;
		}
		// location not in storage
		else if (IsCoordinate(loc)) {
			// Get Location
			loc = loc.replace(" ", "");
			const latLong = loc.split(",");
			const location: LocationData = {
				lat: parseFloat(latLong[0]),
				lon: parseFloat(latLong[1]),
				timeZone: DateTime.now().zoneName,
				entryText: loc,
			}
			this.InjectLocationToConfig(location);
			return location;
		}

		Logger.Debug("Location is text, geo locating...")
		const locationData = await this.geoLocationService.GetLocation(loc);
		// User facing errors are handled by service
		if (locationData == null) return null;
		if (!!locationData?.entryText) {
			Logger.Debug("Address found via address search");
		}

		// Maybe location is in locationStore, first search
		location = this.LocStore.FindLocation(locationData.entryText);
		if (location != null) {
			Logger.Debug("Found location was found in locationStore, return that instead");
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
		Logger.Debug("Location setting is now: " + loc.entryText);
		const text = (loc.entryText + ""); // Only values can be injected into settings and not references, so we add empty string to it.
		this.SetLocation(text);
		this.currentLocation = loc;
		if (switchToManual == true) this.settings.setValue(Keys.MANUAL_LOCATION, true);
	}

	private OnKeySettingsUpdated = (): void => {
		if (this.keybinding != null) {
			keybindingManager.addHotKey(
				UUID,
				this.keybinding,
				Lang.bind(this.app, this.app.on_applet_clicked)
			);
		}
	}

	private onLogLevelUpdated = () => {
		Logger.ChangeLevel(this._logLevel);
	}

	/** It was spamming refresh before, changed to wait until user stopped typing fro 3 seconds */
	private OnLocationChanged = () => {
		Logger.Debug("User changed location, waiting 3 seconds...");
		if (this.doneTypingLocation != null) clearTimeout(this.doneTypingLocation);
		this.doneTypingLocation = setTimeout(Lang.bind(this, this.DoneTypingLocation), 3000);
	}

	private OnLocationStoreChanged = () => {
		this.LocStore.OnLocationChanged(this._locationList)
	}

	private OnFontChanged = () => {
		this.currentFontSize = this.GetCurrentFontSize();
		this.app.RefreshAndRebuild();
	}

	/** Called when 3 seconds is up with no change in location */
	private DoneTypingLocation() {
		Logger.Debug("User has finished typing, beginning refresh");
		this.doneTypingLocation = null;
		this.app.RefreshAndRebuild();
	}

	private OnSettingChanged = () => {
		this.app.RefreshAndRebuild();
	}

	private SetLocation(value: string) {
		this.settings.setValue(this.WEATHER_LOCATION, value);
	}

	public SetLocationList(list: LocationData[]) {
		this.settings.setValue(this.WEATHER_LOCATION_LIST, list);
	}

	private GetLocaleTemperateUnit(code: string | null): Exclude<WeatherUnits, "automatic"> {
		if (code == null || !this.fahrenheitCountries.includes(code)) return "celsius";
		return "fahrenheit";
	}

	private GetLocaleWindSpeedUnit(code: string | null): WeatherWindSpeedUnits {
		if (code == null) return "kph";

		for (const key in this.windSpeedUnitLocales) {
			if (key.includes(code)) return this.windSpeedUnitLocales[key];
		}
		return "kph";
	}

	private GetLocaleDistanceUnit(code: string | null): DistanceUnits {
		if (code == null) return "metric";

		for (const key in this.distanceUnitLocales) {
			if (key.includes(code)) return this.distanceUnitLocales[key];
		}
		return "metric";
	}

	private GetCountryCode(locale: string | null) {
		if (locale == null)
			return null;

		const split = locale.split("-");
		// There is no country code
		if (split.length < 2) return null;

		return split[1];
	}

	private GetLanguage(locale: string | null) {
		if (locale == null)
			return null;
		const split = locale.split("-");
		if (split.length < 1) return null;

		return split[0];
	}

	private GetCurrentFontSize() {
		const nameString = this.InterfaceSettings.get_string("font-name");
		const elements = nameString.split(" ");
		const size = parseFloat(elements[elements.length - 1]);
		Logger.Debug("Font size changed to " + size.toString());
		return size;
	}

	public async GetAppletConfigJson(): Promise<Record<string, any>> {
		const home = get_home_dir() ?? "~";
		const configFilePath = `${home}/.cinnamon/configs/weather@mockturtl/${this.app.instance_id}.json`;
		const configFile = File.new_for_path(configFilePath);

		// Check if file exists
		if (!await FileExists(configFile)) {
			throw new Error(
				_("Could not retrieve config, file was not found under path\n {configFilePath}", { configFilePath: configFilePath })
			);
		}

		// Load file contents
		const confString = await LoadContents(configFile);
		if (confString == null) {
			throw new Error(
				_("Could not get contents of config file under path\n {configFilePath}", { configFilePath: configFilePath })
			);
		}

		const conf = JSON.parse(confString);
		if (conf?.apiKey?.value != null)
			conf.apiKey.value = "REDACTED";

		for (const item of conf?.locationList?.value ?? []) {
			item.lat = "REDACTED";
			item.lon = "REDACTED";
			item.city = "REDACTED";
			item.entryText = "REDACTED";
		}

		if (conf?.location?.value != null)
			conf.location.value = "REDACTED";

		return conf;
	}
}

interface WindSpeedLocalePrefs {
	[key: string]: WeatherWindSpeedUnits;
}
interface DistanceUnitLocalePrefs {
	[key: string]: DistanceUnits;
}

type ServiceClassMappingType = {
	[key in Services]: (app: WeatherApplet) => BaseProvider;
}