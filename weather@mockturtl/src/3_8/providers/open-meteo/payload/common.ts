import { _ } from "../../../utils";
import type { Condition } from "../../../weather-data";

export function OpenMeteoWeatherCodeToCondition(code: number, isDay: boolean): Condition {
	switch(code) {
		case 0:
			return {
				icons: !isDay ? ["weather-clear-night"] : ["weather-clear"],
				customIcon: !isDay ? "night-clear-symbolic" : "day-sunny-symbolic",
				main: _("Clear"),
				description: _("Clear sky")
			}
		case 1:
			return {
				icons: !isDay ? ["weather-few-clouds-night"] : ["weather-few-clouds"],
				customIcon: !isDay ? "night-alt-cloudy-symbolic" : "day-cloudy-symbolic",
				main: _("Few clouds"),
				description: _("Few clouds")
			}
		case 2:
			return {
				icons: !isDay ? ["weather-few-clouds-night"] : ["weather-few-clouds"],
				customIcon: !isDay ? "night-alt-cloudy-symbolic" : "day-cloudy-symbolic",
				main: _("Partly cloudy"),
				description: _("Partly cloudy")
			}
		case 3:
			return {
				icons: !isDay ? ["weather-overcast", "weather-clouds-night", "weather-few-clouds-night"] : ["weather-overcast", "weather-clouds", "weather-few-clouds"],
				customIcon: "cloudy-symbolic",
				main: _("Overcast"),
				description: _("Overcast")
			}
		// Fog
		// Depositing rime fog
		case 45:
		case 48:
			return {
				icons: ["weather-fog"],
				customIcon: "fog-symbolic",
				main: _("Fog"),
				description: _("Fog")
			}
		// Light drizzle
		case 51:
			return {
				icons: isDay ? ["weather-showers-scattered-day", "weather-showers-scattered", "weather-showers-day", "weather-showers"] : ["weather-showers-scattered-night", "weather-showers-scattered", "weather-showers-night", "weather-showers"],
				customIcon: isDay ? "day-rain-symbolic" : "night-alt-rain-symbolic" ,
				main: _("Drizzle"),
				description: _("Light drizzle")
			}
		// Drizzle
		case 53:
			return {
				icons: isDay ? ["weather-showers-scattered-day", "weather-showers-scattered", "weather-showers-day", "weather-showers"] : ["weather-showers-scattered-night", "weather-showers-scattered", "weather-showers-night", "weather-showers"],
				customIcon: isDay ? "day-rain-symbolic" : "night-alt-rain-symbolic" ,
				main: _("Drizzle"),
				description: _("Drizzle")
			}
		// Heavy drizzle
		case 55:
			return {
				icons: isDay ? ["weather-showers-scattered-day", "weather-showers-scattered", "weather-showers-day", "weather-showers"] : ["weather-showers-scattered-night", "weather-showers-scattered", "weather-showers-night", "weather-showers"],
				customIcon: isDay ? "day-rain-symbolic" : "night-alt-rain-symbolic" ,
				main: _("Drizzle"),
				description: _("Heavy drizzle")
			}
		// Light Freezing Drizzle
		case 56:
			return {
				icons: isDay ? ["weather-freezing-rain", "weather-showers-scattered-day", "weather-showers-scattered", "weather-showers-day", "weather-showers"] : ["weather-freezing-rain", "weather-showers-scattered-night", "weather-showers-scattered", "weather-showers-night", "weather-showers"],
				customIcon: isDay ? "day-sleet-symbolic" : "night-alt-sleet-symbolic",
				main: _("Drizzle"),
				description: _("Light freezing drizzle")
			}
		// Freezing Drizzle
		case 57:
			return {
				icons: isDay ? ["weather-freezing-rain", "weather-showers-scattered-day", "weather-showers-scattered", "weather-showers-day", "weather-showers"] : ["weather-freezing-rain", "weather-showers-scattered-night", "weather-showers-scattered", "weather-showers-night", "weather-showers"],
				customIcon: isDay ? "day-sleet-symbolic" : "night-alt-sleet-symbolic",
				main: _("Drizzle"),
				description: _("Freezing drizzle")
			}
		// Light rain
		case 61:
			return {
				icons: isDay ? ["weather-rain", "weather-showers-day", "weather-showers", "weather-showers-scattered-day", "weather-showers-scattered", ] : ["weather-rain", "weather-showers-night", "weather-showers", "weather-showers-scattered-night", "weather-showers-scattered"],
				customIcon: "rain-symbolic",
				main: _("Rain"),
				description: _("Light rain")
			}
		// Rain
		case 63:
			return {
				icons: isDay ? ["weather-rain", "weather-showers-day", "weather-showers", "weather-showers-scattered-day", "weather-showers-scattered", ] : ["weather-rain", "weather-showers-night", "weather-showers", "weather-showers-scattered-night", "weather-showers-scattered"],
				customIcon: "rain-symbolic",
				main: _("Rain"),
				description: _("Rain")
			}
		// Heavy rain
		case 65:
			return {
				icons: isDay ? ["weather-rain", "weather-showers-day", "weather-showers", "weather-showers-scattered-day", "weather-showers-scattered", ] : ["weather-rain", "weather-showers-night", "weather-showers", "weather-showers-scattered-night", "weather-showers-scattered"],
				customIcon: "rain-symbolic",
				main: _("Rain"),
				description: _("Heavy rain")
			}
		// Light freezing rain
		case 66:
			return {
				icons: isDay ? ["weather-freezing-rain", "weather-rain", "weather-showers-day", "weather-showers", "weather-showers-scattered-day", "weather-showers-scattered", ] : ["weather-freezing-rain", "weather-rain", "weather-showers-night", "weather-showers", "weather-showers-scattered-night", "weather-showers-scattered"],
				customIcon: "hail-symbolic",
				main: _("Rain"),
				description: _("Light freezing rain")
			}
		// Freezing rain
		case 67:
			return {
				icons: isDay ? ["weather-freezing-rain", "weather-rain", "weather-showers-day", "weather-showers", "weather-showers-scattered-day", "weather-showers-scattered", ] : ["weather-freezing-rain", "weather-rain", "weather-showers-night", "weather-showers", "weather-showers-scattered-night", "weather-showers-scattered"],
				customIcon: "hail-symbolic",
				main: _("Rain"),
				description: _("Freezing rain")
			}
		// Light snow
		case 71:
			return {
				icons: ["weather-snow"],
				customIcon: "snow-symbolic",
				main: _("Snow"),
				description: _("Light snow")
			}
		// Snow
		case 73:
			return {
				icons: ["weather-snow"],
				customIcon: "snow-symbolic",
				main: _("Snow"),
				description: _("Snow")
			}
		// Heavy snow
		case 75:
			return {
				icons: ["weather-snow"],
				customIcon: "snow-symbolic",
				main: _("Snow"),
				description: _("Heavy snow")
			}
		// Snow grains
		case 77:
			return {
				icons: ["weather-snow"],
				customIcon: "snow-symbolic",
				main: _("Snow"),
				description: _("Snow grains")
			}
		// Light rain showers
		case 80:
			return {
				icons: isDay ? ["weather-showers", "weather-showers-day", "weather-rain"] : ["weather-showers", "weather-showers-night", "weather-rain"],
				customIcon: isDay ? "day-showers-symbolic" : "night-alt-showers-symbolic",
				main: _("Showers"),
				description: _("Light showers")
			}
		// Rain showers
		case 81:
			return {
				icons: isDay ? ["weather-showers", "weather-showers-day", "weather-rain"] : ["weather-showers", "weather-showers-night", "weather-rain"],
				customIcon: "showers-symbolic",
				main: _("Showers"),
				description: _("Showers")
			}
		// Heavy rain showers
		case 82:
			return {
				icons: isDay ? ["weather-showers", "weather-showers-day", "weather-rain"] : ["weather-showers", "weather-showers-night",  "weather-rain"],
				customIcon: "showers-symbolic",
				main: _("Showers"),
				description: _("Heavy showers")
			}
		// Light snow showers
		case 85:
			return {
				icons: ["weather-snow"],
				customIcon: "snow-symbolic",
				main: _("Snow showers"),
				description: _("Light snow showers")
			}
		// Snow showers
		case 86:
			return {
				icons: ["weather-snow"],
				customIcon: "snow-symbolic",
				main: _("Snow showers"),
				description: _("Snow showers")
			}
		// Thunderstorm
		case 95:
			return {
				icons: ["weather-storm"],
				customIcon: "thunderstorm-symbolic",
				main: _("Thunderstorm"),
				description: _("Thunderstorm")
			}
		// Thunderstorm with slight hail
		case 96:
			return {
				icons: ["weather-storm", "weather-hail"],
				customIcon: "sleet-storm-symbolic",
				main: _("Thunderstorm"),
				description: _("Thunderstorm with slight hail")
			}
		// Thunderstorm with hail
		case 99:
			return {
				icons: ["weather-storm", "weather-hail"],
				customIcon: "sleet-storm-symbolic",
				main: _("Thunderstorm"),
				description: _("Thunderstorm with hail")
			}
		default:
			return {
				icons: ["weather-severe-alert"],
				customIcon: "refresh-symbolic",
				main: _("Unknown"),
				description: _("Unknown")
			}
	}
}