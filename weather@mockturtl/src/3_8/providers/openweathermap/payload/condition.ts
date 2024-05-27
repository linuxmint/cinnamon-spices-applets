import type { BuiltinIcons, CustomIcons } from "../../../weather-data"

export function OWMIconToBuiltInIcons(icon: string): BuiltinIcons[] {
	// https://openweathermap.org/weather-conditions
	/* fallback icons are: weather-clear-night
	weather-clear weather-few-clouds-night weather-few-clouds
	weather-fog weather-overcast weather-severe-alert weather-showers
	weather-showers-scattered weather-snow weather-storm */
	switch (icon) {
		case "10d":
			/* rain day */
			return ["weather-rain", "weather-showers-scattered", "weather-freezing-rain"]
		case "10n":
			/* rain night */
			return ["weather-rain", "weather-showers-scattered", "weather-freezing-rain"]
		case "09n":
			/* showers nigh*/
			return ["weather-showers"]
		case "09d":
			/* showers day */
			return ["weather-showers"]
		case "13d":
			/* snow day*/
			return ["weather-snow"]
		case "13n":
			/* snow night */
			return ["weather-snow"]
		case "50d":
			/* mist day */
			return ["weather-fog"]
		case "50n":
			/* mist night */
			return ["weather-fog"]
		case "04d":
			/* broken clouds day */
			return ["weather-overcast", "weather-clouds", "weather-few-clouds"]
		case "04n":
			/* broken clouds night */
			return ["weather-overcast", "weather-clouds-night", "weather-few-clouds-night"]
		case "03n":
			/* mostly cloudy (night) */
			return ['weather-clouds-night', "weather-few-clouds-night"]
		case "03d":
			/* mostly cloudy (day) */
			return ["weather-clouds", "weather-few-clouds", "weather-overcast"]
		case "02n":
			/* partly cloudy (night) */
			return ["weather-few-clouds-night"]
		case "02d":
			/* partly cloudy (day) */
			return ["weather-few-clouds"]
		case "01n":
			/* clear (night) */
			return ["weather-clear-night"]
		case "01d":
			/* sunny */
			return ["weather-clear"]
		case "11d":
			/* storm day */
			return ["weather-storm"]
		case "11n":
			/* storm night */
			return ["weather-storm"]
		default:
			return ["weather-severe-alert"]
	}
}

export function OWMIconToCustomIcon(icon: string): CustomIcons {
	switch (icon) {
		case "10d":
			/* rain day */
			return "day-rain-symbolic";
		case "10n":
			/* rain night */
			return "night-rain-symbolic";
		case "09n":
			/* showers nigh*/
			return "night-showers-symbolic";
		case "09d":
			/* showers day */
			return "day-showers-symbolic"
		case "13d":
			/* snow day*/
			return "day-snow-symbolic"
		case "13n":
			/* snow night */
			return "night-alt-snow-symbolic"
		case "50d":
			/* mist day */
			return "day-fog-symbolic"
		case "50n":
			/* mist night */
			return "night-fog-symbolic"
		case "04d":
			/* broken clouds day */
			return "day-cloudy-symbolic"
		case "04n":
			/* broken clouds night */
			return "night-alt-cloudy-symbolic"
		case "03n":
			/* mostly cloudy (night) */
			return "night-alt-cloudy-symbolic"
		case "03d":
			/* mostly cloudy (day) */
			return "day-cloudy-symbolic"
		case "02n":
			/* partly cloudy (night) */
			return "night-alt-cloudy-symbolic"
		case "02d":
			/* partly cloudy (day) */
			return "day-cloudy-symbolic"
		case "01n":
			/* clear (night) */
			return "night-clear-symbolic"
		case "01d":
			/* sunny */
			return "day-sunny-symbolic"
		case "11d":
			/* storm day */
			return "day-thunderstorm-symbolic"
		case "11n":
			/* storm night */
			return "night-alt-thunderstorm-symbolic"
		default:
			return "cloud-refresh-symbolic"
	}
}