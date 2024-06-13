import type { WeatherApplet } from "./main";
import type { LocationData} from "./types";
import { clearTimeout, setTimeout, _, IsCoordinate, ConstructJsLocale } from "./utils";
import { Logger } from "./lib/services/logger";
import type { LogLevel} from "./consts";
import { distanceUnitLocales, fahrenheitCountries, UUID, windSpeedUnitLocales } from "./consts";
import { LocationStore } from "./location_services/locationstore";
import { GeoLocation } from "./location_services/nominatim";
import { DateTime } from "luxon";
import { FileExists, LoadContents } from "./lib/io_lib";
import { MetUk } from "./providers/met_uk";
import type { BaseProvider } from "./providers/BaseProvider";
import { OpenWeatherMapOneCall } from "./providers/openweathermap/provider-closed";
import { MetNorway } from "./providers/met_norway/provider";
import { Weatherbit } from "./providers/weatherbit/provider";
import { ClimacellV4 } from "./providers/tomorrow_io/provider";
import { USWeather } from "./providers/us_weather/provider";
import { VisualCrossing } from "./providers/visualcrossing/provider";
import { DanishMI } from "./providers/danishMI";
import { AccuWeather } from "./providers/accuWeather";
import { DeutscherWetterdienst } from "./providers/deutscherWetterdienst/provider";
import { WeatherUnderground } from "./providers/weatherUnderground";
import { Event } from "./lib/events";
import type { GeoIP } from "./location_services/geoip_services/base";
import { PirateWeather } from "./providers/pirate_weather/pirateWeather";
import { GeoClue } from "./location_services/geoip_services/geoclue";
import { GeoIPFedora } from "./location_services/geoip_services/geoip.fedora";
import { OpenMeteo } from "./providers/open-meteo/provider";
import { OpenWeatherMapOpen } from "./providers/openweathermap/provider-open";
import type settingsSchema from "../../files/weather@mockturtl/3.8/settings-schema.json";
import { soupLib } from "./lib/soupLib";

const { get_home_dir, get_user_config_dir } = imports.gi.GLib;
const { File } = imports.gi.Gio;
const { AppletSettings, BindingDirection } = imports.ui.settings;
const { IconType } = imports.gi.St;
const { get_language_names, TimeZone } = imports.gi.GLib;
const { Settings } = imports.gi.Gio;

type SettingsSchema = typeof settingsSchema;

type SettingsSchemaWithValues = {
	[key in keyof SettingsSchema]: SettingsSchema[key] & {
		value: SettingsSchema[key] extends { columns: unknown[] } ? Record<string, unknown>[] : unknown;
	}
}

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
	"OpenWeatherMap_Open" |
	"MetNorway" |
	"Weatherbit" |
	"Tomorrow.io" |
	"Met Office UK" |
	"US Weather" |
	"Visual Crossing" |
	"DanishMI" |
	"AccuWeather" |
	"DeutscherWetterdienst" |
	"WeatherUnderground" |
	"PirateWeather" |
	"OpenMeteo" |
	"OpenWeatherMap_OneCall";

export const ServiceClassMapping: ServiceClassMappingType = {
	"OpenWeatherMap_Open": (app) => new OpenWeatherMapOpen(app),
	"OpenWeatherMap_OneCall": (app) => new OpenWeatherMapOneCall(app),
	"MetNorway": (app) => new MetNorway(app),
	"Weatherbit": (app) => new Weatherbit(app),
	"Tomorrow.io": (app) => new ClimacellV4(app),
	"Met Office UK": (app) => new MetUk(app),
	"US Weather": (app) => new USWeather(app),
	"Visual Crossing": (app) => new VisualCrossing(app),
	"DanishMI": (app) => new DanishMI(app),
	"AccuWeather": (app) => new AccuWeather(app),
	"DeutscherWetterdienst": (app) => new DeutscherWetterdienst(app),
	"WeatherUnderground": (app) => new WeatherUnderground(app),
	"PirateWeather": (app) => new PirateWeather(app),
	"OpenMeteo": (app) => new OpenMeteo(app),
}

export class Config {
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
	public readonly keybinding!: string;

	// simple variables
	public readonly _refreshInterval!: number;
	public readonly _manualLocation!: boolean;
	public readonly _dataService!: Services;
	/**
	 * Should the __API__ translate the condition
	 */
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
	/**
	 * Panel text override
	 */
	public readonly _tempTextOverride!: string;
	public readonly _tooltipTextOverride!: string;
	public readonly _showAlerts!: boolean;
	public readonly _userAgentStringOverride!: string;
	public readonly _runScript!: string;

	public readonly DataServiceChanged = new Event<Config, Services>();
	public readonly ApiKeyChanged = new Event<Config, string>();
	public readonly TemperatureUnitChanged = new Event<Config, WeatherUnits>();
	public readonly TemperatureHighFirstChanged = new Event<Config, boolean>();
	public readonly WindSpeedUnitChanged = new Event<Config, WeatherWindSpeedUnits>();
	public readonly DistanceUnitChanged = new Event<Config, DistanceUnits>();
	public readonly LocationLabelOverrideChanged = new Event<Config, string>();
	public readonly TranslateConditionChanged = new Event<Config, boolean>();
	/**
	 * true is vertical, false is horizontal
	 */
	public readonly VerticalOrientationChanged = new Event<Config, boolean>();
	public readonly ShowTextInPanelChanged = new Event<Config, boolean>();
	public readonly ShowCommentInPanelChanged = new Event<Config, boolean>();
	public readonly ShowSunriseChanged = new Event<Config, boolean>();
	public readonly Show24HoursChanged = new Event<Config, boolean>();
	public readonly ForecastDaysChanged = new Event<Config, number>();
	public readonly ForecastHoursChanged = new Event<Config, number>();
	public readonly ForecastColumnsChanged = new Event<Config, number>();
	public readonly ForecastRowsChanged = new Event<Config, number>();
	public readonly RefreshIntervalChanged = new Event<Config, number>();
	public readonly PressureUnitChanged = new Event<Config, WeatherPressureUnits>();
	public readonly ShortConditionsChanged = new Event<Config, boolean>();
	public readonly ManualLocationChanged = new Event<Config, boolean>();
	public readonly UseCustomAppletIconsChanged = new Event<Config, boolean>();
	public readonly UseCustomMenuIconsChanged = new Event<Config, boolean>();
	public readonly TempRussianStyleChanged = new Event<Config, boolean>();
	public readonly ShortHourlyTimeChanged = new Event<Config, boolean>();
	public readonly ShowForecastDatesChanged = new Event<Config, boolean>();
	public readonly UseSymbolicIconsChanged = new Event<Config, boolean>();
	public readonly ImmediatePrecipChanged = new Event<Config, boolean>();
	public readonly ShowBothTempUnitsChanged = new Event<Config, boolean>();
	public readonly DisplayWindAsTextChanged = new Event<Config, boolean>();
	public readonly AlwaysShowHourlyWeatherChanged = new Event<Config, boolean>();
	public readonly TooltipTextOverrideChanged = new Event<Config, string>();
	public readonly ShowAlertsChanged = new Event<Config, string>();
	public readonly UserAgentStringOverrideChanged = new Event<Config, string>();
	public readonly RunScriptChanged = new Event<Config, boolean>();
	public readonly TempTextOverrideChanged = new Event<Config, string>();

	public readonly FontChanged = new Event<Config, void>();
	public readonly HotkeyChanged = new Event<Config, void>();
	public readonly SelectedLogPathChanged = new Event<Config, void>();

	/** Timeout */
	private doneTypingLocation: number | null = null;
	private currentLocation: LocationData | null = null;
	public readonly LocationChanged = new Event<Config, void>();

	private settings: imports.ui.settings.AppletSettings;
	private readonly instance_id: number;
	public readonly countryCode: string | null;
	public textColorStyle: string | null = null;
	public ForegroundColor: imports.gi.Clutter.Color | null = null;

	public get UserTimezone(): string {
		const timezone = TimeZone.new_local();
		// does not exist on 3.8, use DateTime
		if (timezone.get_identifier == null)
			return DateTime.now().zoneName;
		else
			return TimeZone.new_local().get_identifier();
	}

	private readonly autoLocProvider: GeoIP;
	private readonly geoClue: GeoClue;
	private readonly geoLocationService: GeoLocation;

	/** Stores and retrieves manual locations */
	public readonly LocStore: LocationStore;
	public currentLocale: string | null;

	private readonly InterfaceSettings: imports.gi.Gio.Settings;
	private currentFontSize: number;

	constructor(instanceID: number) {
		this.instance_id = instanceID;
		this.settings = new AppletSettings(this, UUID, instanceID);
		// Bind as early as possible so that we can update the log level asap
		this.BindSettings();
		this.onLogLevelUpdated();
		this.currentLocale = ConstructJsLocale(get_language_names());
		this.countryCode = this.GetCountryCode(this.currentLocale);
		this.autoLocProvider = new GeoIPFedora(this); // IP location lookup
		this.geoClue = new GeoClue();
		this.geoLocationService = new GeoLocation();
		this.InterfaceSettings = new Settings({ schema: "org.cinnamon.desktop.interface" });
		this.InterfaceSettings.connect('changed::font-name', () => this.OnFontChanged());
		this.currentFontSize = this.GetCurrentFontSize();
		this.LocStore = new LocationStore(this);
	}

	public get CurrentFontSize(): number {
		return this.currentFontSize;
	}

	public get CurrentLocation(): LocationData | null {
		return this.currentLocation;
	}

	public get ApiKey(): string {
		return this._apiKey.replace(" ", "");
	}

	public get Language(): string | null {
		return this.GetLanguage(this.currentLocale);
	}

	/**
	 * @returns Units, automatic is already resolved here
	 */
	public get TemperatureUnit(): Exclude<WeatherUnits, "automatic"> {
		if (this._temperatureUnit == "automatic")
			return this.GetLocaleTemperateUnit(this.UserTimezone);
		return this._temperatureUnit;
	}

	/**
	 * @returns Units, automatic is already resolved here
	 */
	public get WindSpeedUnit(): WeatherWindSpeedUnits {
		if (this._windSpeedUnit == "automatic")
			return this.GetLocaleWindSpeedUnit(this.UserTimezone);
		return this._windSpeedUnit;
	}

	/**
	 * @returns Units, automatic is already resolved here
	 */
	public get DistanceUnit(): DistanceUnits {
		if (this._distanceUnit == "automatic")
			return this.GetLocaleDistanceUnit(this.UserTimezone);
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
	public async EnsureLocation(cancellable: imports.gi.Gio.Cancellable): Promise<LocationData | null> {
		this.currentLocation = null;

		// Automatic location
		if (!this._manualLocation) {
			const geoClue = await this.geoClue.GetLocation(cancellable, this);
			if (geoClue != null) {
				Logger.Debug("Auto location obtained via GeoClue2.");
				this.InjectLocationToConfig(geoClue);
				return geoClue;
			}

			const location = await this.autoLocProvider.GetLocation(cancellable, this);
			// User facing errors handled by provider
			if (!location)
				return null;

			Logger.Debug("Auto location obtained via IP lookup.");
			this.InjectLocationToConfig(location);
			return location;
		}

		// Manual Location

		let loc = this._location;
		if (loc == undefined || loc.trim() == "") {  // No location
			return null;
		}

		// Find location in storage
		let location = this.LocStore.FindLocation(this._location);
		if (location != null) {
			Logger.Debug("Manual Location exist in Saved Locations, retrieve.");
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
				lat: Number.parseFloat(latLong[0]),
				lon: Number.parseFloat(latLong[1]),
				timeZone: this.UserTimezone,
				entryText: loc,
			}
			Logger.Debug("Manual Location is a coordinate, using it directly.");
			this.InjectLocationToConfig(location);
			return location;
		}

		Logger.Debug("Location is text, geo locating...")
		const locationData = await this.geoLocationService.GetLocation(loc, cancellable, this);
		// User facing errors are handled by service
		if (locationData == null) return null;
		if (locationData?.entryText) {
			Logger.Debug("Coordinates are found via Reverse address search");
		}

		// Maybe location is in locationStore, first search
		location = this.LocStore.FindLocation(locationData.entryText);
		if (location != null) {
			Logger.Debug("Entered location was found in Saved Location, switch to it instead.");
			this.InjectLocationToConfig(location);
			this.LocStore.SwitchToLocation(location);
			return location;
		}
		else {
			this.InjectLocationToConfig(locationData);
			return locationData;
		}
	}

	/** Attaches settings to functions */
	private BindSettings() {
		let key: keyof typeof Keys;
		for (key in Keys) {
			if (Object.prototype.hasOwnProperty.call(Keys, key)) {
				const element = Keys[key];
				this.settings.bindProperty(BindingDirection.BIDIRECTIONAL,
					element.key,
					("_" + element.key),
					() => this[`${element.prop}Changed`].Invoke(this, this[`_${element.key}` as never]),
					null
				);
			}
		}

		// Settings what need special care
		this.settings.bindProperty(BindingDirection.BIDIRECTIONAL,
			this.WEATHER_LOCATION, ("_" + this.WEATHER_LOCATION), this.OnLocationChanged, null);

		this.settings.bindProperty(BindingDirection.BIDIRECTIONAL,
			this.WEATHER_LOCATION_LIST, ("_" + this.WEATHER_LOCATION_LIST), this.OnLocationStoreChanged, null);

		this.settings.bindProperty(BindingDirection.IN, "keybinding",
			"keybinding", () => this.HotkeyChanged.Invoke(this), null);

		this.settings.bindProperty(BindingDirection.IN, "logLevel",
			"_logLevel", this.onLogLevelUpdated, null);

		this.settings.bind("selectedLogPath",
			"_selectedLogPath", () => this.SelectedLogPathChanged.Invoke(this));

		soupLib.SetUserAgent(this._userAgentStringOverride);
		this.UserAgentStringOverrideChanged.Subscribe(() => soupLib.SetUserAgent(this._userAgentStringOverride));
	}

	// UTILS

	private InjectLocationToConfig(loc: LocationData, switchToManual: boolean = false) {
		Logger.Debug("Location setting is now: " + loc.entryText);
		const text = (loc.entryText + ""); // Only values can be injected into settings and not references, so we add empty string to it.
		this.SetLocation(text);
		this.currentLocation = loc;
		if (switchToManual == true) this.settings.setValue(Keys.MANUAL_LOCATION.key, true);
	}

	private onLogLevelUpdated = () => {
		Logger.ChangeLevel(this._logLevel);
	}

	/** It was spamming refresh before, changed to wait until user stopped typing fro 3 seconds */
	private OnLocationChanged = () => {
		Logger.Debug("User changed location, waiting 3 seconds...");
		if (this.doneTypingLocation != null) clearTimeout(this.doneTypingLocation);
		this.doneTypingLocation = setTimeout(this.DoneTypingLocation, 3000);
	}

	private OnLocationStoreChanged = () => {
		this.LocStore.OnLocationChanged(this._locationList)
	}

	private OnFontChanged = () => {
		this.currentFontSize = this.GetCurrentFontSize();
		this.FontChanged.Invoke(this);
	}

	/** Called when 3 seconds is up with no change in location */
	private DoneTypingLocation = () => {
		Logger.Debug("User has finished typing, beginning refresh");
		this.doneTypingLocation = null;
		this.LocationChanged.Invoke(this);
	}

	private SetLocation(value: string) {
		this.settings.setValue(this.WEATHER_LOCATION, value);
	}

	public SetLocationList(list: LocationData[]): void {
		this.settings.setValue(this.WEATHER_LOCATION_LIST, list);
	}

	private GetLocaleTemperateUnit(code: string | null): Exclude<WeatherUnits, "automatic"> {
		if (code == null || !fahrenheitCountries.includes(code))
			return "celsius";
		return "fahrenheit";
	}

	private GetLocaleWindSpeedUnit(code: string | null): WeatherWindSpeedUnits {
		if (code == null)
			return "kph";

		let key: WeatherWindSpeedUnits;
		for (key in windSpeedUnitLocales) {
			if (windSpeedUnitLocales[key]?.includes(code))
				return key;
		}
		return "kph";
	}

	private GetLocaleDistanceUnit(code: string | null): DistanceUnits {
		if (code == null)
			return "metric";

		let key: DistanceUnits;
		for (key in distanceUnitLocales) {
			if (distanceUnitLocales[key]?.includes(code))
				return key;
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
		const size = Number.parseFloat(elements[elements.length - 1]);
		Logger.Debug("Font size changed to " + size.toString());
		return size;
	}

	public async GetAppletConfigJson(): Promise<Record<string, unknown>> {
		const home = get_home_dir() ?? "~";
		let configFilePath = `${get_user_config_dir()}/cinnamon/spices/weather@mockturtl/${this.instance_id}.json`;
		const oldConfigFilePath = `${home}/.cinnamon/configs/weather@mockturtl/${this.instance_id}.json`;
		let configFile = File.new_for_path(configFilePath);
		const oldConfigFile = File.new_for_path(oldConfigFilePath);

		// Check if file exists
		if (!FileExists(configFile)) {
			if (!FileExists(oldConfigFile)) {
				throw new Error(
					_("Could not retrieve config, file was not found under paths\n {configFilePath}", { configFilePath: `${configFilePath}\n${oldConfigFilePath}` })
				);
			}

			configFile = oldConfigFile;
			configFilePath = oldConfigFilePath;
		}

		// Load file contents
		const confString = await LoadContents(configFile);
		if (confString == null) {
			throw new Error(
				_("Could not get contents of config file under path\n {configFilePath}", { configFilePath: configFilePath })
			);
		}

		const conf = JSON.parse(confString) as SettingsSchemaWithValues;
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

	public Destroy(): void {
		this.settings.finalize?.();
	}
}

/**
 * Keys matching the ones in settings-schema.json
 */
 const Keys = {
	DATA_SERVICE: {
		key: "dataService",
		prop: "DataService"
	},
	API_KEY: {
		key: "apiKey",
		prop: "ApiKey"
	},
	TEMPERATURE_UNIT_KEY: {
		key: "temperatureUnit",
		prop: "TemperatureUnit"
	},
	TEMPERATURE_HIGH_FIRST: {
		key: "temperatureHighFirst",
		prop: "TemperatureHighFirst"
	},
	WIND_SPEED_UNIT: {
		key: "windSpeedUnit",
		prop: "WindSpeedUnit"
	},
	DISTANCE_UNIT: {
		key: "distanceUnit",
		prop: "DistanceUnit"
	},
	LOCATION_LABEL_OVERRIDE: {
		key: "locationLabelOverride",
		prop: "LocationLabelOverride"
	},
	TRANSLATE_CONDITION: {
		key: "translateCondition",
		prop: "TranslateCondition"
	},
	VERTICAL_ORIENTATION: {
		key: "verticalOrientation",
		prop: "VerticalOrientation"
	},
	SHOW_TEXT_IN_PANEL: {
		key: "showTextInPanel",
		prop: "ShowTextInPanel"
	},
	SHOW_COMMENT_IN_PANEL: {
		key: "showCommentInPanel",
		prop: "ShowCommentInPanel"
	},
	SHOW_SUNRISE: {
		key: "showSunrise",
		prop: "ShowSunrise"
	},
	SHOW_24HOURS: {
		key: "show24Hours",
		prop: "Show24Hours"
	},
	FORECAST_DAYS: {
		key: "forecastDays",
		prop: "ForecastDays"
	},
	FORECAST_HOURS: {
		key: "forecastHours",
		prop: "ForecastHours"
	},
	FORECAST_COLS: {
		key: "forecastColumns",
		prop: "ForecastColumns"
	},
	FORECAST_ROWS: {
		key: "forecastRows",
		prop: "ForecastRows"
	},
	REFRESH_INTERVAL: {
		key: "refreshInterval",
		prop: "RefreshInterval"
	},
	PRESSURE_UNIT: {
		key: "pressureUnit",
		prop: "PressureUnit"
	},
	SHORT_CONDITIONS: {
		key: "shortConditions",
		prop: "ShortConditions"
	},
	MANUAL_LOCATION: {
		key: "manualLocation",
		prop: "ManualLocation"
	},
	USE_CUSTOM_APPLET_ICONS: {
		key: 'useCustomAppletIcons',
		prop: 'UseCustomAppletIcons'
	},
	USE_CUSTOM_MENU_ICONS: {
		key: "useCustomMenuIcons",
		prop: "UseCustomMenuIcons"
	},
	RUSSIAN_STYLE: {
		key: "tempRussianStyle",
		prop: "TempRussianStyle"
	},
	SHORT_HOURLY_TIME: {
		key: "shortHourlyTime",
		prop: "ShortHourlyTime"
	},
	SHOW_FORECAST_DATES: {
		key: "showForecastDates",
		prop: "ShowForecastDates"
	},
	WEATHER_USE_SYMBOLIC_ICONS_KEY: {
		key: 'useSymbolicIcons',
		prop: 'UseSymbolicIcons'
	},
	IMMEDIATE_PRECIP: {
		key: "immediatePrecip",
		prop: "ImmediatePrecip"
	},
	SHOW_BOTH_TEMP: {
		key: "showBothTempUnits",
		prop: "ShowBothTempUnits"
	},
	DISPLAY_WIND_DIR_AS_TEXT: {
		key: "displayWindAsText",
		prop: "DisplayWindAsText"
	},
	ALWAYS_SHOW_HOURLY: {
		key: "alwaysShowHourlyWeather",
		prop: "AlwaysShowHourlyWeather"
	},
	TOOLTIP_TEXT_OVERRIDE: {
		key: "tooltipTextOverride",
		prop: "TooltipTextOverride"
	},
	SHOW_ALERTS: {
		key: "showAlerts",
		prop: "ShowAlerts"
	},
	USER_AGENT_STRING_OVERRIDE: {
		key: "userAgentStringOverride",
		prop: "UserAgentStringOverride"
	},
	RUN_SCRIPT: {
		key: "runScript",
		prop: "RunScript"
	},
	TEMP_TEXT_OVERRIDE: {
		key: "tempTextOverride",
		prop: "TempTextOverride"
	},
} as const;

type ServiceClassMappingType = {
	[key in Services]: (app: WeatherApplet) => BaseProvider;
}