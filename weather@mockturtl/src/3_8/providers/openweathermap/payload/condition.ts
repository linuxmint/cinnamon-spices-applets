import { Logger } from "../../../lib/services/logger";
import { _ } from "../../../utils";
import type { BuiltinIcons, CustomIcons } from "../../../weather-data"

export type OWMWeatherConditionMain =
	"Thunderstorm" |
	"Drizzle" |
	"Rain" |
	"Snow" |
	"Clear" |
	"Clouds" |
	"Mist" |
	"Smoke" |
	"Haze" |
	"Dust" |
	"Fog" |
	"Sand" |
	"Ash" |
	"Squall" |
	"Tornado"
;

/**
 * Better to be explicit about the values so that we can catch any new values that are added to the API,
 * and the translation system can pick up all the strings.
 * @param condition
 * @returns
 */
export function OWMMainToTranslated(condition: OWMWeatherConditionMain): string {
	switch (condition) {
		case "Thunderstorm":
			return _("Thunderstorm")
		case "Drizzle":
			return _("Drizzle")
		case "Rain":
			return _("Rain")
		case "Snow":
			return _("Snow")
		case "Clear":
			return _("Clear")
		case "Clouds":
			return _("Clouds")
		case "Mist":
			return _("Mist")
		case "Smoke":
			return _("Smoke")
		case "Haze":
			return _("Haze")
		case "Dust":
			return _("Dust")
		case "Fog":
			return _("Fog")
		case "Sand":
			return _("Sand")
		case "Ash":
			return _("Ash")
		case "Squall":
			return _("Squall")
		case "Tornado":
			return _("Tornado")
		default:
			Logger.Error("Unknown weather condition main: " + (condition as string));
			return condition;
	}
}

export type OWMWeatherConditionDescription =
	"thunderstorm with light rain" |
	"thunderstorm with rain" |
	"thunderstorm with heavy rain" |
	"light thunderstorm" |
	"thunderstorm" |
	"heavy thunderstorm" |
	"ragged thunderstorm" |
	"thunderstorm with light drizzle" |
	"thunderstorm with drizzle" |
	"thunderstorm with heavy drizzle" |
	"light intensity drizzle" |
	"drizzle" |
	"heavy intensity drizzle" |
	"light intensity drizzle rain" |
	"drizzle rain" |
	"heavy intensity drizzle rain" |
	"shower rain and drizzle" |
	"heavy shower rain and drizzle" |
	"shower drizzle" |
	"light rain" |
	"moderate rain" |
	"heavy intensity rain" |
	"very heavy rain" |
	"extreme rain" |
	"freezing rain" |
	"light intensity shower rain" |
	"shower rain" |
	"heavy intensity shower rain" |
	"ragged shower rain" |
	"light snow" |
	"snow" |
	"heavy snow" |
	"sleet" |
	"light shower sleet" |
	"shower sleet" |
	"light rain and snow" |
	"rain and snow" |
	"light shower snow" |
	"shower snow" |
	"heavy shower snow" |
	"mist" |
	"smoke" |
	"haze" |
	"sand/dust whirls" |
	"fog" |
	"sand" |
	"dust" |
	"volcanic ash" |
	"squalls" |
	"tornado" |
	"clear sky" |
	"sky is clear" |
	"few clouds" |
	"scattered clouds" |
	"broken clouds" |
	"overcast clouds"
;

/**
 * /**
 * Better to be explicit about the values so that we can catch any new values that are added to the API,
 * and the translation system can pick up all the strings.
 * @param condition
 * @returns
 */
export function OWMDescToTranslated(description: OWMWeatherConditionDescription): string {
	switch (description) {
		case "thunderstorm with light rain":
			return _("Thunderstorm with light rain")
		case "thunderstorm with rain":
			return _("Thunderstorm with rain")
		case "thunderstorm with heavy rain":
			return _("Thunderstorm with heavy rain")
		case "light thunderstorm":
			return _("Light thunderstorm")
		case "thunderstorm":
			return _("Thunderstorm")
		case "heavy thunderstorm":
			return _("Heavy thunderstorm")
		case "ragged thunderstorm":
			return _("Ragged thunderstorm")
		case "thunderstorm with light drizzle":
			return _("Thunderstorm with light drizzle")
		case "thunderstorm with drizzle":
			return _("Thunderstorm with drizzle")
		case "thunderstorm with heavy drizzle":
			return _("Thunderstorm with heavy drizzle")
		case "light intensity drizzle":
			return _("Light intensity drizzle")
		case "drizzle":
			return _("Drizzle")
		case "heavy intensity drizzle":
			return _("Heavy intensity drizzle")
		case "light intensity drizzle rain":
			return _("Light intensity drizzle rain")
		case "drizzle rain":
			return _("Drizzle rain")
		case "heavy intensity drizzle rain":
			return _("Heavy intensity drizzle rain")
		case "shower rain and drizzle":
			return _("Shower rain and drizzle")
		case "heavy shower rain and drizzle":
			return _("Heavy shower rain and drizzle")
		case "shower drizzle":
			return _("Shower drizzle")
		case "light rain":
			return _("Light rain")
		case "moderate rain":
			return _("Moderate rain")
		case "heavy intensity rain":
			return _("Heavy intensity rain")
		case "very heavy rain":
			return _("Very heavy rain")
		case "extreme rain":
			return _("Extreme rain")
		case "freezing rain":
			return _("Freezing rain")
		case "light intensity shower rain":
			return _("Light intensity shower rain")
		case "shower rain":
			return _("Shower rain")
		case "heavy intensity shower rain":
			return _("Heavy intensity shower rain")
		case "ragged shower rain":
			return _("Ragged shower rain")
		case "light snow":
			return _("Light snow")
		case "snow":
			return _("Snow")
		case "heavy snow":
			return _("Heavy snow")
		case "sleet":
			return _("Sleet")
		case "light shower sleet":
			return _("Light shower sleet")
		case "shower sleet":
			return _("Shower sleet")
		case "light rain and snow":
			return _("Light rain and snow")
		case "rain and snow":
			return _("Rain and snow")
		case "light shower snow":
			return _("Light shower snow")
		case "shower snow":
			return _("Shower snow")
		case "heavy shower snow":
			return _("Heavy shower snow")
		case "mist":
			return _("Mist")
		case "smoke":
			return _("Smoke")
		case "haze":
			return _("Haze")
		case "sand/dust whirls":
			return _("Sand, dust whirls")
		case "fog":
			return _("Fog")
		case "sand":
			return _("Sand")
		case "dust":
			return _("Dust")
		case "volcanic ash":
			return _("Volcanic ash")
		case "squalls":
			return _("Squalls")
		case "tornado":
			return _("Tornado")
		case "clear sky":
		case "sky is clear":
			return _("Clear sky")
		case "few clouds":
			return _("Few clouds")
		case "scattered clouds":
			return _("Scattered clouds")
		case "broken clouds":
			return _("Broken clouds")
		case "overcast clouds":
			return _("Overcast clouds")
		default:
			Logger.Error("Unknown weather condition description: " + (description as string));
			return description;
	}
}

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