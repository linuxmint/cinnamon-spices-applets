import type { SwissMeteoDay } from "./days";
import type { SwissMeteoCurrentWeather } from "./current";
import { _ } from "../../../utils";
import type { Condition } from "../../../weather-data";
import { Logger } from "../../../lib/services/logger";

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

export function SwissMeteoIconToCondition(icon: number): Condition {
	switch (icon) {
		case 1:
			return {
				customIcon: "day-sunny-symbolic",
				main: _("Clear"),
				description: _("Clear sky"),
				icons: ["weather-clear"]
			}
		case 101:
			return {
				customIcon: "night-clear-symbolic",
				main: _("Clear"),
				description: _("Clear sky"),
				icons: ["weather-clear-night", "weather-clear"]
			}
		case 2:
			return {
				customIcon: "day-cloudy-symbolic",
				main: _("Partly Cloudy"),
				description: _("Partly Cloudy"),
				icons: ["weather-few-clouds"]
			}
		case 102:
			return {
				customIcon: "night-cloudy-symbolic",
				main: _("Partly Cloudy"),
				description: _("Partly Cloudy"),
				icons: ["weather-few-clouds-night", "weather-few-clouds"]
			}
		case 3:
			return {
				customIcon: "day-cloudy-symbolic",
				main: _("Mostly Cloudy"),
				description: _("Mostly Cloudy"),
				icons: ["weather-clouds", "weather-few-clouds"]
			}
		case 103:
			return {
				customIcon: "night-cloudy-symbolic",
				main: _("Mostly Cloudy"),
				description: _("Mostly Cloudy"),
				icons: ["weather-clouds-night", "weather-few-clouds-night"]
			}
		// overcast
		case 4:
			return {
				customIcon: "day-cloudy-symbolic",
				main: _("Overcast"),
				description: _("Overcast"),
				icons: ["weather-overcast", "weather-clouds"]
			}
		case 104:
			return {
				customIcon: "night-cloudy-symbolic",
				main: _("Overcast"),
				description: _("Overcast"),
				icons: ["weather-overcast", "weather-clouds-night", "weather-clouds"]
			}
		// cloudy
		case 5:
		case 105:
			return {
				customIcon: "day-cloudy-symbolic",
				main: _("Cloudy"),
				description: _("Cloudy"),
				icons: ["weather-clouds"]
			}
		// Overcast scattered showers
		case 6:
			return {
				customIcon: "day-showers-symbolic",
				main: _("Scattered Showers"),
				description: _("Scattered Showers"),
				icons: ["weather-showers-scattered-day", "weather-showers-day", "weather-showers-scattered", "weather-showers"]
			}
		case 106:
			return {
				customIcon: "night-alt-showers-symbolic",
				main: _("Scattered Showers"),
				description: _("Scattered Showers"),
				icons: ["weather-showers-scattered-night", "weather-showers-night", "weather-showers-scattered", "weather-showers"]
			}
		// Mostly cloudy with scattered sleet
		case 7:
			return {
				customIcon: "day-sleet-symbolic",
				main: _("Scattered Sleet"),
				description: _("Scattered Sleet"),
				icons: ["weather-freezing-rain"]
			}
		case 107:
			return {
				customIcon: "night-sleet-symbolic",
				main: _("Scattered Sleet"),
				description: _("Scattered Sleet"),
				icons: ["weather-freezing-rain"]
			}
		default:
			Logger.Error(`SwissMeteo Unknown icon: ${icon}`);
			return {
				customIcon: "refresh-symbolic",
				main: _("Unknown"),
				description: _("Unknown"),
				icons: ["weather-severe-alert"]
			}
	}
}