import type { SwissMeteoDay } from "./days";
import type { SwissMeteoCurrentWeather } from "./current";
import { _ } from "../../../utils";
import type { Condition } from "../../../weather-data";
import { Logger } from "../../../lib/services/logger";
import type { SwissMeteoWarning } from "./alerts";

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
	warnings: SwissMeteoWarning[];
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

/**
 * See https://www.meteoswiss.admin.ch/weather/weather-and-climate-from-a-to-z/weather-symbols.html
 * @param icon
 * @returns
 */
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
				customIcon: "night-alt-cloudy-symbolic",
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
				customIcon: "night-alt-cloudy-symbolic",
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
				customIcon: "night-alt-cloudy-symbolic",
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
				customIcon: "night-alt-sleet-symbolic",
				main: _("Scattered Sleet"),
				description: _("Scattered Sleet"),
				icons: ["weather-freezing-rain"]
			}
		//  Mostly cloudy with snow showers
		case 8:
			return {
				customIcon: "day-snow-symbolic",
				main: _("Snow Showers"),
				description: _("Snow Showers"),
				icons: ["weather-snow"]
			}
		case 108:
			return {
				customIcon: "night-alt-snow-symbolic",
				main: _("Snow Showers"),
				description: _("Snow Showers"),
				icons: ["weather-snow"]
			}
		// Overcast with some rain showers
		case 9:
			return {
				customIcon: "day-showers-symbolic",
				main: _("Showers"),
				description: _("Showers"),
				icons: ["weather-showers-day", "weather-showers"]
			}
		case 109:
			return {
				customIcon: "night-alt-showers-symbolic",
				main: _("Showers"),
				description: _("Showers"),
				icons: ["weather-showers-night", "weather-showers"]
			}
		// Overcast with some sleet
		case 10:
			return {
				customIcon: "day-sleet-symbolic",
				main: _("Sleet"),
				description: _("Sleet"),
				icons: ["weather-freezing-rain"]
			}
		case 110:
			return {
				customIcon: "night-alt-sleet-symbolic",
				main: _("Sleet"),
				description: _("Sleet"),
				icons: ["weather-freezing-rain"]
			}
		// Overcast with some snow showers
		case 11:
			return {
				customIcon: "day-snow-symbolic",
				main: _("Snow Showers"),
				description: _("Snow Showers"),
				icons: ["weather-snow"]
			}
		case 111:
			return {
				customIcon: "night-alt-snow-symbolic",
				main: _("Snow Showers"),
				description: _("Snow Showers"),
				icons: ["weather-snow"]
			}
		// Mostly cloudy chance of thunderstorms
		case 12:
			return {
				customIcon: "day-thunderstorm-symbolic",
				main: _("Chance of Thunderstorms"),
				description: _("Chance of Thunderstorms"),
				icons: ["weather-storm"]
			}
		case 112:
			return {
				customIcon: "night-alt-thunderstorm-symbolic",
				main: _("Chance of Thunderstorms"),
				description: _("Chance of Thunderstorms"),
				icons: ["weather-storm"]
			}
		// Mostly cloudy possible thunderstorms
		case 13:
			return {
				customIcon: "day-thunderstorm-symbolic",
				main: _("Thunderstorms"),
				description: _("Thunderstorms"),
				icons: ["weather-storm"]
			}
		case 113:
			return {
				customIcon: "night-alt-thunderstorm-symbolic",
				main: _("Thunderstorms"),
				description: _("Thunderstorms"),
				icons: ["weather-storm"]
			}
		//  Light rain
		case 14:
		case 114:
			return {
				customIcon: "rain-symbolic",
				main: _("Light Rain"),
				description: _("Light Rain"),
				icons: ["weather-showers", "weather-showers"]
			}
		// Light Sleet
		case 15:
		case 115:
			return {
				customIcon: "sleet-symbolic",
				main: _("Light Sleet"),
				description: _("Light Sleet"),
				icons: ["weather-freezing-rain"]
			}
		// Light snow showers
		case 16:
		case 116:
			return {
				customIcon: "snow-symbolic",
				main: _("Light Snow Showers"),
				description: _("Light Snow Showers"),
				icons: ["weather-snow"]
			}
		// Intermittent rain
		case 17:
		case 117:
			return {
				customIcon: "rain-symbolic",
				main: _("Intermittent Rain"),
				description: _("Intermittent Rain"),
				icons: ["weather-showers", "weather-showers", "weather-rain"]
			}
		// Intermittent sleet
		case 18:
		case 118:
			return {
				customIcon: "sleet-symbolic",
				main: _("Intermittent Sleet"),
				description: _("Intermittent Sleet"),
				icons: ["weather-freezing-rain"]
			}
		// Intermittent snow
		case 19:
		case 119:
			return {
				customIcon: "snow-symbolic",
				main: _("Intermittent Snow"),
				description: _("Intermittent Snow"),
				icons: ["weather-snow"]
			}
		// Rain
		case 20:
		case 120:
			return {
				customIcon: "rain-symbolic",
				main: _("Rain"),
				description: _("Rain"),
				icons: ["weather-showers", "weather-rain"]
			}
		// Sleet
		case 21:
		case 121:
			return {
				customIcon: "sleet-symbolic",
				main: _("Sleet"),
				description: _("Sleet"),
				icons: ["weather-freezing-rain"]
			}
		// Snow
		case 22:
		case 122:
			return {
				customIcon: "snow-symbolic",
				main: _("Snow"),
				description: _("Snow"),
				icons: ["weather-snow"]
			}
		// Slight chance of thunderstorms
		case 23:
		case 123:
			return {
				customIcon: "thunderstorm-symbolic",
				main: _("Chance of Thunderstorms"),
				description: _("Chance of Thunderstorms"),
				icons: ["weather-storm"]
			}
		// Thunderstorms
		case 24:
		case 124:
			return {
				customIcon: "thunderstorm-symbolic",
				main: _("Thunderstorms"),
				description: _("Thunderstorms"),
				icons: ["weather-storm"]
			}
		// Frequent thunderstorms
		case 25:
		case 125:
			return {
				customIcon: "thunderstorm-symbolic",
				main: _("Frequent Thunderstorms"),
				description: _("Frequent Thunderstorms"),
				icons: ["weather-storm"]
			}
		// High clouds
		case 26:
			return {
				customIcon: "day-cloudy-symbolic",
				main: _("High Clouds"),
				description: _("High Clouds"),
				icons: ["weather-clouds"]
			}
		case 126:
			return {
				customIcon: "night-alt-cloudy-symbolic",
				main: _("High Clouds"),
				description: _("High Clouds"),
				icons: ["weather-clouds"]
			}
		// Low clouds
		case 27:
		case 127:
			return {
				customIcon: "cloudy-symbolic",
				main: _("Low Clouds"),
				description: _("Low Clouds"),
				icons: ["weather-clouds"]
			}
		// fog
		case 28:
			return {
				customIcon: "fog-symbolic",
				main: _("Fog"),
				description: _("Fog"),
				icons: ["weather-fog"]
			}
		// Mostly cloudy with scattered showers
		case 29:
			return {
				customIcon: "day-showers-symbolic",
				main: _("Scattered Showers"),
				description: _("Scattered Showers"),
				icons: ["weather-showers-scattered-day", "weather-showers-day", "weather-showers-scattered", "weather-showers"]
			}
		case 129:
			return {
				customIcon: "night-alt-showers-symbolic",
				main: _("Scattered Showers"),
				description: _("Scattered Showers"),
				icons: ["weather-showers-scattered-night", "weather-showers-night", "weather-showers-scattered", "weather-showers"]
			}
		// Mostly cloudy with scattered snow showers
		case 30:
			return {
				customIcon: "day-snow-symbolic",
				main: _("Scattered Snow Showers"),
				description: _("Scattered Snow Showers"),
				icons: ["weather-snow"]
			}
		case 130:
			return {
				customIcon: "night-alt-snow-symbolic",
				main: _("Scattered Snow Showers"),
				description: _("Scattered Snow Showers"),
				icons: ["weather-snow"]
			}
		// Mostly cloudy with scattered sleet
		case 31:
			return {
				customIcon: "day-sleet-symbolic",
				main: _("Scattered Sleet"),
				description: _("Scattered Sleet"),
				icons: ["weather-freezing-rain"]
			}
		case 131:
			return {
				customIcon: "night-alt-sleet-symbolic",
				main: _("Scattered Sleet"),
				description: _("Scattered Sleet"),
				icons: ["weather-freezing-rain"]
			}
		// Showers
		case 32:
			return {
				customIcon: "day-showers-symbolic",
				main: _("Showers"),
				description: _("Showers"),
				icons: ["weather-showers-day", "weather-showers", "weather-showers-scattered-day", "weather-showers-scattered"]
			}
		case 132:
			return {
				customIcon: "night-alt-showers-symbolic",
				main: _("Showers"),
				description: _("Showers"),
				icons: ["weather-showers-night", "weather-showers"]
			}
		// Mostly cloudy heavy rain
		case 33:
			return {
				customIcon: "day-rain-symbolic",
				main: _("Heavy Rain"),
				description: _("Heavy Rain"),
				icons: ["weather-showers-day", "weather-showers"]
			}
		case 133:
			return {
				customIcon: "night-alt-rain-symbolic",
				main: _("Heavy Rain"),
				description: _("Heavy Rain"),
				icons: ["weather-showers-night", "weather-showers"]
			}
		// Mostly cloudy heavy snow
		case 34:
			return {
				customIcon: "day-snow-symbolic",
				main: _("Heavy Snow"),
				description: _("Heavy Snow"),
				icons: ["weather-snow"]
			}
		case 134:
			return {
				customIcon: "night-alt-snow-symbolic",
				main: _("Heavy Snow"),
				description: _("Heavy Snow"),
				icons: ["weather-snow"]
			}
		// Overcast and dry
		case 35:
		case 135:
			return {
				customIcon: "cloudy-symbolic",
				main: _("Overcast and Dry"),
				description: _("Overcast and Dry"),
				icons: ["weather-clear"]
			}
		// Partly sunny slightly stormy
		case 36:
			return {
				customIcon: "day-thunderstorm-symbolic",
				main: _("Slightly Stormy"),
				description: _("Slightly Stormy"),
				icons: ["weather-storm"]
			}
		case 136:
			return {
				customIcon: "night-alt-thunderstorm-symbolic",
				main: _("Slightly Stormy"),
				description: _("Slightly Stormy"),
				icons: ["weather-storm"]
			}
		// Partly sunny stormy snow showers
		case 37:
			return {
				customIcon: "day-snow-thunderstorm-symbolic",
				main: _("Stormy Snow Showers"),
				description: _("Stormy Snow Showers"),
				icons: ["weather-snow"]
			}
		case 137:
			return {
				customIcon: "night-alt-snow-thunderstorm-symbolic",
				main: _("Stormy Snow Showers"),
				description: _("Stormy Snow Showers"),
				icons: ["weather-snow"]
			}
		// Overcast thundery showers
		case 38:
			return {
				customIcon: "day-storm-showers-symbolic",
				main: _("Thundery Showers"),
				description: _("Thundery Showers"),
				icons: ["weather-storm"]
			}
		case 138:
			return {
				customIcon: "night-alt-storm-showers-symbolic",
				main: _("Thundery Showers"),
				description: _("Thundery Showers"),
				icons: ["weather-storm"]
			}
		// Overcast with thundery snow showers
		case 39:
			return {
				customIcon: "day-snow-thunderstorm-symbolic",
				main: _("Thundery Snow Showers"),
				description: _("Thundery Snow Showers"),
				icons: ["weather-snow"]
			}
		case 139:
			return {
				customIcon: "night-alt-snow-thunderstorm-symbolic",
				main: _("Thundery Snow Showers"),
				description: _("Thundery Snow Showers"),
				icons: ["weather-snow"]
			}
		// Slightly stormy
		case 40:
		case 140:
			return {
				customIcon: "thunderstorm-symbolic",
				main: _("Slightly Stormy"),
				description: _("Slightly Stormy"),
				icons: ["weather-storm"]
			}
		// Overcast, slightly stormy
		case 41:
		case 141:
			return {
				customIcon: "thunderstorm-symbolic",
				main: _("Slightly Stormy"),
				description: _("Slightly Stormy"),
				icons: ["weather-storm"]
			}
		// Thundery snow showers
		case 42:
		case 142:
			return {
				customIcon: "snow-storm-symbolic",
				main: _("Thundery Snow Showers"),
				description: _("Thundery Snow Showers"),
				icons: ["weather-snow"]
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