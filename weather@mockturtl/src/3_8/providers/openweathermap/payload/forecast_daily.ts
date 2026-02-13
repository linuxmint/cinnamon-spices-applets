import { DateTime } from "luxon";
import type { OWMWeatherCondition } from "./common";
import { OWMDescToTranslated, OWMIconToBuiltInIcons, OWMIconToCustomIcon, OWMMainToTranslated } from "./condition";
import type { ForecastData } from "../../../weather-data";

export interface OWMDailyForecastResponse {
	city: {
		id: number;
		name: string;
		coord: {
			lat: number;
			lon: number;
		};
		country: string;
		timezone: number;
		population: number;
	}
	list: OWMDailyForecast[];
}

export interface OWMDailyForecast {
	/**
	 * UTC unix timestamp in seconds
	 */
	dt: number;
	/**
	 * Sunrise time, UTC unix timestamp in seconds
	 */
	sunrise: number;
	/**
	 * Sunset time, UTC unix timestamp in seconds
	 */
	sunset: number;
	temp: {
		/**
		 * Day temperature
		 */
		day: number;
		/**
		 * Min daily temperature
		 */
		min: number;
		/**
		 * Max daily temperature
		 */
		max: number;
		/**
		 * Night temperature
		 */
		night: number;
		/**
		 * Evening temperature
		 */
		eve: number;
		/**
		 * Morning temperature
		 */
		morn: number;
	};
	feels_like: {
		/**
		 * Day temperature
		 */
		day: number;
		/**
		 * Night temperature
		 */
		night: number;
		/**
		 * Evening temperature
		 */
		eve: number;
		/**
		 * Morning temperature
		 */
		morn: number;
	};
	pressure: number;
	humidity: number;
	weather: OWMWeatherCondition[];
	speed: number;
	deg: number;
	gust: number;
	clouds: number;
	pop: number;
	rain?: number;
	snow?: number;
}

export function OWMDailyForecastsToData(forecast: OWMDailyForecast[], conditionsTranslated: boolean, timezone: string | undefined = "local"): ForecastData[] {
	const result: ForecastData[] = [];
	for (const day of forecast) {
		const data: ForecastData = {
			date: DateTime.fromSeconds(day.dt, { zone: timezone }),
			temp_max: day.temp.max,
			temp_min: day.temp.min,
			condition: {
				main: conditionsTranslated ? day.weather?.[0]?.main : OWMMainToTranslated(day.weather?.[0]?.main),
				description: conditionsTranslated ? day.weather?.[0]?.description : OWMDescToTranslated(day.weather?.[0]?.description),
				icons: OWMIconToBuiltInIcons(day.weather?.[0]?.icon),
				customIcon: OWMIconToCustomIcon(day.weather?.[0]?.icon)
			}
		};
		result.push(data);
	}

	return result;
}