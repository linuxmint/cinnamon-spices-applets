import { Logger } from "../../../lib/services/logger";
import { _ } from "../../../utils";
import type { PirateWeatherAlert } from "./alerts";
import type { PirateWeatherDailyPayload } from "./daily";
import type { PirateWeatherHourlyPayload } from "./hourly";
import type { PirateWeatherMinutelyPayload } from "./minutely";

/**
 * - 'si' returns meter/sec and Celsius
 * - 'us' returns miles/hour and Fahrenheit
 * - 'uk2' return miles/hour and Celsius
 */
export type PirateWeatherQueryUnits = 'si' | 'us' | 'uk';


export interface PirateWeatherPayload {
	latitude: number;
	longitude: number;
	elevation: number;
	timezone: string;
	offset: number;
	currently: {
		/** Unix timestamp in seconds */
		time: number;
		summary: PirateWeatherSummary;
		icon: PirateWeatherIcon;
		nearestStormDistance: number;
		nearestStormBearing: number;
		precipIntensity: number;
		precipProbability: number;
		temperature: number;
		apparentTemperature: number;
		dewPoint: number;
		humidity: number;
		pressure: number;
		windSpeed: number;
		windGust: number;
		windBearing: number;
		cloudCover: number;
		uvIndex: number;
		visibility: number;
		ozone: number;
	},
	minutely: {
		summary: PirateWeatherSummary;
		icon: PirateWeatherIcon;
		data: PirateWeatherMinutelyPayload[];
	}
	hourly: {
		summary: PirateWeatherSummary;
		icon: PirateWeatherIcon;
		data: PirateWeatherHourlyPayload[];
	}
	daily: {
		summary: PirateWeatherSummary;
		icon: PirateWeatherIcon;
		data: PirateWeatherDailyPayload[]
	}
	alerts?: PirateWeatherAlert[];
}

/**
 * As of 2024-06-01 PirateWeather API only supports the following weather summaries.
 */
export type PirateWeatherSummary =
	"Clear" |
	"Partly Cloudy" |
	"Rain" |
	"Cloudy" |
	"Snow" |
	"Wind" |
	"Fog" |
	"Sleet"
;

export function PirateWeatherSummaryToTranslated(summary: PirateWeatherSummary): string {
	switch (summary) {
		case "Clear":
			return _("Clear");
		case "Partly Cloudy":
			return _("Partly Cloudy");
		case "Rain":
			return _("Rain");
		case "Cloudy":
			return _("Cloudy");
		case "Snow":
			return _("Snow");
		case "Wind":
			return _("Wind");
		case "Fog":
			return _("Fog");
		case "Sleet":
			return _("Sleet");
		default:
			Logger.Error(`Unknown PirateWeatherSummary: ${summary as string}`);
			return summary;
	}
}

/**
 * https://github.com/Pirate-Weather/pirateweather/blob/0b3823f8bf45de303e77affbabb358a243cda0f6/docs/API.md#icon
 */
export type PirateWeatherIcon =
	"clear-day" |
	"clear-night" |
	"rain" |
	"snow" |
	"sleet" |
	"wind" |
	"fog" |
	"cloudy" |
	"partly-cloudy-day" |
	"partly-cloudy-night"
;