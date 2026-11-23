import type { BuiltinIcons, Condition, CustomIcons } from "../../weather-data";
import type { Translator } from "./parser";

function ConditionWithIcons(main: string, icons: BuiltinIcons[], customIcon: CustomIcons): Condition {
	return {
		main,
		description: main,
		icons,
		customIcon,
	};
}

export function QWeatherCondition(icon: string, text: string, translate: Translator): Condition {
	const conditionText = text || translate("Unknown");
	const code = Number(icon);

	if (code === 100)
		return ConditionWithIcons(conditionText, ["weather-clear"], "day-sunny-symbolic");
	if (code === 150)
		return ConditionWithIcons(conditionText, ["weather-clear-night"], "night-clear-symbolic");
	if (code === 101)
		return ConditionWithIcons(conditionText, ["weather-few-clouds"], "day-cloudy-symbolic");
	if (code >= 102 && code <= 103)
		return ConditionWithIcons(conditionText, ["weather-clouds", "weather-few-clouds", "weather-overcast"], "cloudy-symbolic");
	if (code === 104)
		return ConditionWithIcons(conditionText, ["weather-overcast", "weather-clouds"], "cloudy-symbolic");
	if (code === 151)
		return ConditionWithIcons(conditionText, ["weather-few-clouds-night"], "night-alt-partly-cloudy-symbolic");
	if (code >= 152 && code <= 153)
		return ConditionWithIcons(conditionText, ["weather-clouds-night", "weather-few-clouds-night", "weather-overcast"], "night-cloudy-symbolic");
	if (code === 154)
		return ConditionWithIcons(conditionText, ["weather-overcast", "weather-clouds-night"], "night-cloudy-symbolic");
	if (code >= 300 && code <= 301)
		return ConditionWithIcons(conditionText, ["weather-showers", "weather-showers-scattered"], "showers-symbolic");
	if (code >= 302 && code <= 303)
		return ConditionWithIcons(conditionText, ["weather-storm"], "thunderstorm-symbolic");
	if (code === 304)
		return ConditionWithIcons(conditionText, ["weather-hail", "weather-storm"], "hail-symbolic");
	if ((code >= 305 && code <= 318) || (code >= 350 && code <= 399)) {
		const icons: BuiltinIcons[] = code === 313
			? ["weather-freezing-rain", "weather-rain"]
			: ["weather-rain", "weather-showers"];
		return ConditionWithIcons(conditionText, icons, "rain-symbolic");
	}
	if (code >= 400 && code <= 499) {
		const icons: BuiltinIcons[] = code >= 404 && code <= 407
			? ["weather-snow-rain", "weather-snow"]
			: ["weather-snow"];
		return ConditionWithIcons(conditionText, icons, "snow-symbolic");
	}
	if (code >= 500 && code <= 515)
		return ConditionWithIcons(conditionText, ["weather-fog"], "smog-symbolic");
	if (code === 900)
		return ConditionWithIcons(conditionText, ["weather-severe-alert"], "hot-symbolic");
	if (code === 901)
		return ConditionWithIcons(conditionText, ["weather-severe-alert"], "snowflake-cold-symbolic");

	return ConditionWithIcons(conditionText, ["weather-severe-alert"], "na-symbolic");
}
