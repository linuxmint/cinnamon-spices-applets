import { _ } from "../../../utils";

export interface OpenWeatherMapError {
	cod: string;
	message: string;
}

export interface OWMWeatherCondition {
	/** [Weather condition id](https://openweathermap.org/weather-conditions#Weather-Condition-Codes-2) */
	id: number;
	/** Group of weather parameters (Rain, Snow, Extreme etc.) */
	main: string;
	/**  Weather condition within the group ([full list of weather conditions](https://openweathermap.org/weather-conditions#Weather-Condition-Codes-2)).*/
	description: string;
	/** Weather icon id */
	icon: string;
}

export const OWM_SUPPORTED_LANGS = ["af", "al", "ar", "az", "bg", "ca", "cz", "da", "de", "el", "en", "eu", "fa", "fi",
	"fr", "gl", "he", "hi", "hr", "hu", "id", "it", "ja", "kr", "la", "lt", "mk", "no", "nl", "pl",
	"pt", "pt_br", "ro", "ru", "se", "sk", "sl", "sp", "es", "sr", "th", "tr", "ua", "uk", "vi", "zh_cn", "zh_tw", "zu"
];

export function ConvertLocaleToOWMLang(systemLocale: string | null): string {
	if (systemLocale == null)
		return "en";

	// Dialect? support by OWM
	if (systemLocale == "zh-cn" || systemLocale == "zh-cn" || systemLocale == "pt-br") {
		return systemLocale;
	}
	const lang = systemLocale.split("-")[0];
	// OWM uses different language code for Swedish, Czech, Korean, Latvian, Norwegian
	if (lang == "sv") {
		return "se";
	} else if (lang == "cs") {
		return "cz";
	} else if (lang == "ko") {
		return "kr";
	} else if (lang == "lv") {
		return "la";
	} else if (lang == "nn" || lang == "nb") {
		return "no";
	}
	return lang;
}




// This is here so they are translated.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const openWeatherMapConditionLibrary = [
	// Group 2xx: Thunderstorm
	_("Thunderstorm with light rain"),
	_("Thunderstorm with rain"),
	_("Thunderstorm with heavy rain"),
	_("Light thunderstorm"),
	_("Thunderstorm"),
	_("Heavy thunderstorm"),
	_("Ragged thunderstorm"),
	_("Thunderstorm with light drizzle"),
	_("Thunderstorm with drizzle"),
	_("Thunderstorm with heavy drizzle"),
	// Group 3xx: Drizzle
	_("Light intensity drizzle"),
	_("Drizzle"),
	_("Heavy intensity drizzle"),
	_("Light intensity drizzle rain"),
	_("Drizzle rain"),
	_("Heavy intensity drizzle rain"),
	_("Shower rain and drizzle"),
	_("Heavy shower rain and drizzle"),
	_("Shower drizzle"),
	// Group 5xx: Rain
	_("Light rain"),
	_("Moderate rain"),
	_("Heavy intensity rain"),
	_("Very heavy rain"),
	_("Extreme rain"),
	_("Freezing rain"),
	_("Light intensity shower rain"),
	_("Shower rain"),
	_("Heavy intensity shower rain"),
	_("Ragged shower rain"),
	// Group 6xx: Snow
	_("Light snow"),
	_("Snow"),
	_("Heavy snow"),
	_("Sleet"),
	_("Shower sleet"),
	_("Light rain and snow"),
	_("Rain and snow"),
	_("Light shower snow"),
	_("Shower snow"),
	_("Heavy shower snow"),
	// Group 7xx: Atmosphere
	_("Mist"),
	_("Smoke"),
	_("Haze"),
	_("Sand, dust whirls"),
	_("Fog"),
	_("Sand"),
	_("Dust"),
	_("Volcanic ash"),
	_("Squalls"),
	_("Tornado"),
	// Group 800: Clear
	_("Clear"),
	_("Clear sky"),
	_("Sky is clear"),
	// Group 80x: Clouds
	_("Clouds"),
	_("Few clouds"),
	_("Scattered clouds"),
	_("Broken clouds"),
	_("Overcast clouds")
];