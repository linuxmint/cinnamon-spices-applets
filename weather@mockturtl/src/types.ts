export type Services = "OpenWeatherMap" | "DarkSky" | "MetNorway" | "Weatherbit" | "Yahoo" | "Climacell" | "Met Office UK" | "US Weather";
export type ServiceMap = {
    [key: string]: Services
}
export type ServiceDescriptions = {
    [key in Services]: string
}

export type LocationCache = {
    [key: string]: LocationData
}

/** Units Used in Options. Change Options list if You change this! */
export type WeatherUnits = 'automatic' | 'celsius' | 'fahrenheit';

/** Units Used in Options. Change Options list if You change this! */
export type WeatherWindSpeedUnits = 'automatic' | 'kph' | 'mph' | 'm/s' | 'Knots' | 'Beaufort';

/** Units used in Options. Change Options list if You change this! */
export type WeatherPressureUnits = 'hPa' | 'mm Hg' | 'in Hg' | 'Pa' | 'psi' | 'atm' | 'at';

/** Change settings-scheme if you change this! */
export type DistanceUnits = 'automatic' | 'metric' | 'imperial';

export interface WeatherData {
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

export interface ForecastData {
    /** Set to 12:00 if possible */
    date: Date,
    /** Kelvin */
    temp_min: number,
    /** Kelvin */
    temp_max: number,
    condition: Condition
}


export interface HourlyForecastData {
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

export type PrecipitationType = "rain" | "snow" | "none" | "ice pellets" | "freezing rain";

export interface LocationData {
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

export type LocationSource = "ip-api" | "address-search" | "manual";

export interface Location {
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
export type ExtraField = "percent" | "temperature" | "string";

export interface ForecastUI {
    Icon: imports.gi.St.Icon,
    Day: imports.gi.St.Label,
    Summary: imports.gi.St.Label,
    Temperature: imports.gi.St.Label,
}

export interface HourlyForecastUI {
    Icon: imports.gi.St.Icon,
    Hour: imports.gi.St.Label,
    Summary: imports.gi.St.Label,
    Temperature: imports.gi.St.Label,
    Precipitation: imports.gi.St.Label
}

export type SettingKeys = {
    [key: string]: string;
}

/**
 * A WeatherProvider must implement this interface.
 */
export interface WeatherProvider {
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

export interface AppletError {
    type: ErrorSeverity;
    /** Stops Refresh completely until settings have changed */
    userError?: boolean;
    detail: ErrorDetail;
    code?: number;
    message?: string;
    service?: ApiService
}

export interface HttpError {
    code: number;
    message: ErrorDetail;
    reason_phrase: string;
    data: any;
}

export type RefreshState = "success" | "failure" | "error" | "locked";

/** hard will not force a refresh and cleans the applet ui.
 * 
 *  soft will show a subtle hint that the refresh failed (NOT IMPLEMENTED)
 */
export type ErrorSeverity = "hard" | "soft";
export type ApiService = "ipapi" | "darksky" | "openweathermap" | "met-norway" | "weatherbit" | "yahoo" | "climacell" | "met-uk" | "us-weather";
export type ErrorDetail = "no key" | "bad key" | "no location" | "bad location format" |
    "location not found" | "no network response" | "no api response" | "location not covered" |
    "bad api response - non json" | "bad api response" | "no response body" |
    "no response data" | "unusual payload" | "key blocked" | "unknown" | "bad status code" | "import error";
export type NiceErrorDetail = {
    [key in ErrorDetail]: string;
}

export interface Condition {
    /** Short description */
    main: string,
    /** Long Description */
    description: string,
    /** GTK icon name */
    icon: BuiltinIcons,
    customIcon: CustomIcons
}

export type GUIDStore = {
    [key: number]: string
}

export interface SunTimes {
    sunrise: Date;
    sunset: Date
}

/**
 * names of icons what might be available
 */
export type BuiltinIcons =
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
export type CustomIcons =
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
