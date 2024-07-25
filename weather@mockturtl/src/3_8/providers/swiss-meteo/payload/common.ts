import type { SwissMeteoDay } from "./days";
import type { SwissMeteoCurrentWeather } from "./current";

export interface SwissMeteoError {
	statusCode: number | null;
	msg: number | null;
}

export interface SwissMeteoPayload {
	currentWeather: SwissMeteoCurrentWeather;
	/**
	 * 8 items
	 */
	forecast: SwissMeteoDay[];
	warnings: unknown[];
	warningsOverview: unknown[];
	graph: {
		/**
		 * Unix timestamp in milliseconds
		 */
		start: number;
		/**
		 * Unix timestamp in milliseconds
		 */
		startLowResolution: number;
		/**
		 * 91 items, in mm
		 */
		precipitation10m: number[];
		/**
		 * 91 items, in mm
		 */
		precipitationMin10m: number[];
		/**
		 * 91 items, in mm
		 */
		precipitationMax10m: number[];
		/**
		 * 64 items
		 */
		weatherIcon3h: number[];
		/**
		 * 64 items
		 */
		weatherIcon3hV2: number[];
		/**
		 * 64 items, degrees
		 */
		windDirection3h: number[];
		/**
		 * 64 items, km/h
		 */
		windSpeed3h: number[];
		/**
		 * 8 items, unix timestamp in milliseconds
		 */
		sunrise: number[];
		/**
		 * 8 items, unix timestamp in milliseconds
		 */
		sunset: number[];
		/**
		 * 192 items, in celsius
		 */
		temperatureMin1h: number[];
		/**
		 * 192 items, in celsius
		 */
		temperatureMax1h: number[];
		/**
		 * 192 items, in celsius
		 */
		temperatureMean1h: number[];
		/**
		 * 192 items, in mm
		 */
		precipitation1h: number[];
		/**
		 * 192 items, in mm
		 */
		precipitationMin1h: number[];
		/**
		 * 192 items, in mm
		 */
		precipitationMax1h: number[];
	}
}