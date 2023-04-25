import { DateTime } from "luxon";
import { GetTimesResult } from "suncalc";
import { Services } from "./config";

export type correctGetTimes = (date: Date, latitude: number, longitude: number, height?: number) => GetTimesResult;
export interface SunTime {
	sunrise: DateTime;
	sunset: DateTime;
}

/**
 * A WeatherProvider must implement this interface.
 */
export interface WeatherProvider {
	readonly needsApiKey: boolean;
	readonly prettyName: string;
	readonly name: Services;
	readonly maxForecastSupport: number;
	readonly maxHourlyForecastSupport: number;
	readonly website: string;
	readonly remainingCalls: number | null;
	readonly supportHourlyPrecipChance: boolean;
    readonly supportHourlyPrecipVolume: boolean;

	GetWeather(loc: LocationData): Promise<WeatherData | null>;
}

export const enum RefreshState {
	Success = "success",
	Failure = "fail",
	Error = "error",
	Locked = "locked"
}

export interface WeatherData {
	date: DateTime;
	coord: {
		lat: number,
		lon: number,
	};
	location: {
		city?: string | undefined,
		country?: string | undefined,
		timeZone?: string | undefined,
		url?: string | undefined,
		tzOffset?: number | undefined
	},
	stationInfo?: {
		/** in metres */
		distanceFrom: number | undefined,
		name?: string | undefined,
		lat?: number,
		lon?: number,
		area?: string
	} | undefined,
	/** preferably in UTC */
	sunrise: DateTime | null,
	/** preferably in UTC */
	sunset: DateTime | null,
	wind: {
		/** Meter/sec */
		speed: number | null,
		/** Meteorological Degrees */
		degree: number | null,
	};
	/** In Kelvin */
	temperature: number | null;
	/** In hPa */
	pressure: number | null;
	/** In percent */
	humidity: number | null;
	/** In kelvin */
	dewPoint: number | null;
	condition: Condition
	forecasts: ForecastData[];
	hourlyForecasts?: HourlyForecastData[] | undefined
	extra_field?: APIUniqueField | undefined;
	immediatePrecipitation?: ImmediatePrecipitation;
}


export type APIUniqueField = NumberAPIUniqueField | StringAPIUniqueField;

interface BaseAPIUniqueField {
	name: string;
	type: ExtraField;
}

interface NumberAPIUniqueField extends BaseAPIUniqueField {
	value: number;
	type: Extract<ExtraField, "temperature" | "percent">
}

interface StringAPIUniqueField extends BaseAPIUniqueField {
	value: string;
	type: Extract<ExtraField, "string">
}


/**
 * percent: value is a number from 0-100 (or more)
 *
 * temperature: value is number in Kelvin
 *
 * string:  is a string
*/
type ExtraField = "percent" | "temperature" | "string";

export interface ForecastData {
	/** Set to 12:00 if possible */
	date: DateTime,
	/** Kelvin */
	temp_min: number | null,
	/** Kelvin */
	temp_max: number | null,
	condition: Condition
}

export type PrecipitationType = "rain" | "snow" | "none" | "ice pellets" | "freezing rain";
export interface HourlyForecastData {
	/** Set to 12:00 if possible */
	date: DateTime;
	/** Kelvin */
	temp: number | null;
	condition: Condition;
	precipitation?: Precipitation | undefined;
}

export interface Precipitation {
	type: PrecipitationType,
	/** in mm */
	volume?: number | undefined,
	/** % */
	chance?: number | undefined
}

type LocationSource = "ip-api" | "address-search" | "manual";
export interface LocationData {
	lat: number;
	lon: number;
	city?: string | undefined;
	country?: string | undefined;
	/** Always set, if not available system tz is provided */
	timeZone: string;
	entryText: string;
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

/** hard will not force a refresh and cleans the applet ui.
 *
 *  soft will show a subtle hint that the refresh failed (NOT IMPLEMENTED)
 */
export type ErrorSeverity = "hard" | "soft" | "silent";
export type ApiService = "ipapi" | "openweathermap" | "met-norway" | "weatherbit" | "yahoo" | "climacell" | "met-uk" | "us-weather" | "pirate_weather";
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
	/** GTK icon name, descending from most fit to least fit.
	 * needs multiple in case one/some of them are not available
	 */
	icons: BuiltinIcons[],
	customIcon: CustomIcons
}

/** Immediate precipitation for the next hour, currently only OpenWeatherMap uses it.
 */
export interface ImmediatePrecipitation {
	/** Precipitation in * minutes */
	start: number;
	/** ends in * minutes */
	end: number;
}

/**
 * Names of icons what might be available
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

export type ArrowIcons =
	"east-arrow-weather-symbolic" |
	"north-arrow-weather-symbolic" |
	"north-east-arrow-weather-symbolic" |
	"north-west-arrow-weather-symbolic" |
	"south-arrow-weather-symbolic" |
	"south-east-arrow-weather-symbolic" |
	"south-west-arrow-weather-symbolic" |
	"west-arrow-weather-symbolic";

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
