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
		summary: string;
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
		summary: string;
		icon: PirateWeatherIcon;
		data: PirateWeatherMinutelyPayload[];
	}
	hourly: {
		summary: string;
		icon: PirateWeatherIcon;
		data: PirateWeatherHourlyPayload[];
	}
	daily: {
		summary: string;
		icon: PirateWeatherIcon;
		data: PirateWeatherDailyPayload[]
	}
	alerts?: PirateWeatherAlert[];
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