import type { OWMWeatherConditionDescription, OWMWeatherConditionMain } from "./condition";

export interface OpenWeatherMapError {
	cod: number;
	message: string;
}

export interface OWMWeatherCondition {
	/** [Weather condition id](https://openweathermap.org/weather-conditions#Weather-Condition-Codes-2) */
	id: number;
	/** Group of weather parameters (Rain, Snow, Extreme etc.) */
	main: OWMWeatherConditionMain;
	/**  Weather condition within the group ([full list of weather conditions](https://openweathermap.org/weather-conditions#Weather-Condition-Codes-2)).*/
	description: OWMWeatherConditionDescription;
	/** Weather icon id */
	icon: string;
}

export const OWM_SUPPORTED_LANGS = [
	"af", "al", "ar", "az", "bg", "ca", "cz", "da", "de", "el", "en", "eu", "fa", "fi",
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