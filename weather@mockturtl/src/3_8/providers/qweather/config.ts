import type { LocationData } from "../../types";

// eslint-disable-next-line unicorn/better-regex -- Keep the documented QWeather host pattern verbatim.
const DEDICATED_API_HOST = /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+qweatherapi\.com$/;

export function QWeatherLocation(location: Pick<LocationData, "lat" | "lon">): string {
	return `${location.lon.toFixed(2)},${location.lat.toFixed(2)}`;
}

export function QWeatherAlertPath(location: Pick<LocationData, "lat" | "lon">): string {
	return `/weatheralert/v1/current/${location.lat}/${location.lon}`;
}

export function NormalizeQWeatherApiHost(value: string): string | null {
	const withoutProtocol = value.replace(/^https?:\/\//i, "");
	const host = withoutProtocol.endsWith("/") ? withoutProtocol.slice(0, -1) : withoutProtocol;
	const normalized = host.toLowerCase();

	return DEDICATED_API_HOST.test(normalized) ? normalized : null;
}

export function QWeatherLanguage(locale: string | null, translateCondition: boolean): string {
	if (!translateCondition)
		return "en";

	const normalized = locale?.toLowerCase();
	if (!normalized)
		return "en";

	if (normalized === "zh-tw" || normalized === "zh-hk" || normalized === "zh-mo" || normalized.startsWith("zh-hant"))
		return "zh-hant";
	if (normalized.startsWith("zh"))
		return "zh";

	return normalized.slice(0, 2);
}
