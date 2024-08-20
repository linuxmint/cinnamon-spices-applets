import type { DateTime } from "luxon";
import type { GetTimesResult } from "suncalc";
import type { Config, Services } from "./config";
import type { WeatherData } from "./weather-data";

export type Tuple<T, N extends number> = N extends N ? number extends N ? T[] : _TupleOf<T, N, []> : never;
type _TupleOf<T, N extends number, R extends unknown[]> = R['length'] extends N ? R : _TupleOf<T, N, [T, ...R]>;

export type correctGetTimes = (date: Date, latitude: number, longitude: number, height?: number) => GetTimesResult;
export interface SunTime {
	sunrise: DateTime;
	sunset: DateTime;
}

export interface Metadata {
	path: string;
	version: string;
}

export type LocationType = "coordinates" | "postcode";

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
	readonly locationType: LocationType;

	GetWeather(loc: LocationData, cancellable: imports.gi.Gio.Cancellable, config: Config): Promise<WeatherData | null>;
}

export const enum RefreshState {
	Success = "success",
	/**
	 * Pure technical error
	 */
	Error = "error",
	/**
	 * Location not obtained
	 */
	NoLocation = "no location",
	NoWeather = "no weather",
	NoKey = "no key",
	DisplayFailure = "display failure",
}

export interface LocationServiceResult {
	lat: number;
	lon: number;
	city?: string | undefined;
	country?: string | undefined;
	timeZone?: string | undefined;
	entryText: string;
}

export interface LocationData extends LocationServiceResult {
	lat: number;
	lon: number;
	city?: string | undefined;
	country?: string | undefined;
	/** Always set and always correct for the location. */
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
export type ApiService = "ipapi" | "openweathermap" | "met-norway" | "weatherbit" | "yahoo" | "climacell" | "met-uk" | "us-weather" | "pirate_weather" | "geoip.fedoreproject";
export type ErrorDetail = "no key" | "bad key" | "no location" | "bad location format" |
	"location not found" | "no network response" | "no api response" | "location not covered" |
	"bad api response - non json" | "bad api response" | "no response body" |
	"no response data" | "unusual payload" | "key blocked" | "unknown" | "bad status code" | "import error" | "location service blocked";
export type NiceErrorDetail = {
	[key in ErrorDetail]: string;
}


export type ArrowIcons =
	"east-arrow-weather-symbolic" |
	"north-arrow-weather-symbolic" |
	"north-east-arrow-weather-symbolic" |
	"north-west-arrow-weather-symbolic" |
	"south-arrow-weather-symbolic" |
	"south-east-arrow-weather-symbolic" |
	"south-west-arrow-weather-symbolic" |
	"west-arrow-weather-symbolic";

