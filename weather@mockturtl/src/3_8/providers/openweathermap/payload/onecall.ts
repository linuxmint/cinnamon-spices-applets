import { DateTime } from "luxon";
import type { OWMWeatherCondition } from "./common";
import { OWMDescToTranslated, OWMIconToBuiltInIcons, OWMIconToCustomIcon, OWMMainToTranslated } from "./condition";
import { _ } from "../../../utils";
import type { AlertData, ForecastData, HourlyForecastData, ImmediatePrecipitation, WeatherData } from "../../../weather-data";

export function OWMOneCallToWeatherData(json: OWMOneCallPayload, conditionsTranslated: boolean): WeatherData {
	const weather: WeatherData = {
		coord: {
			lat: json.lat,
			lon: json.lon
		},
		location: {
			url: (json.id == null) ? "https://openweathermap.org/city/" : `https://openweathermap.org/city/${json.id}`,
			timeZone: json.timezone
		},
		date: DateTime.fromSeconds(json.current.dt, { zone: json.timezone }),
		sunrise: DateTime.fromSeconds(json.current.sunrise, { zone: json.timezone }),
		sunset: DateTime.fromSeconds(json.current.sunset, { zone: json.timezone }),
		wind: {
			speed: json.current.wind_speed,
			degree: json.current.wind_deg
		},
		temperature: json.current.temp,
		pressure: json.current.pressure,
		humidity: json.current.humidity,
		dewPoint: json.current.dew_point,
		condition: {
			main: conditionsTranslated ? json?.current?.weather?.[0]?.main : OWMMainToTranslated(json?.current?.weather?.[0]?.main),
			description: conditionsTranslated ? json?.current?.weather?.[0]?.description : OWMDescToTranslated(json?.current?.weather?.[0]?.description),
			icons: OWMIconToBuiltInIcons(json?.current?.weather?.[0]?.icon),
			customIcon: OWMIconToCustomIcon(json?.current?.weather?.[0]?.icon)
		},
		extra_field: {
			name: _("Feels Like"),
			value: json.current.feels_like,
			type: "temperature"
		},
		forecasts: [],
		alerts: [],
	};

	if (json.minutely != null) {
		const immediate: ImmediatePrecipitation = {
			start: -1,
			end: -1
		}

		for (const [index, element] of json.minutely.entries()) {
			if (element.precipitation > 0 && immediate.start == -1) {
				immediate.start = index;
				continue
			}
			else if (element.precipitation == 0 && immediate.start != -1) {
				immediate.end = index;
				break
			}
		}
		weather.immediatePrecipitation = immediate;
	}

	const forecasts: ForecastData[] = [];
	for (const day of json.daily) {
		const forecast: ForecastData = {
			date: DateTime.fromSeconds(day.dt, { zone: json.timezone }),
			temp_min: day.temp.min,
			temp_max: day.temp.max,
			condition: {
				main: conditionsTranslated ? day.weather[0].main : OWMMainToTranslated(day.weather[0].main),
				description: conditionsTranslated ? day.weather[0].description : OWMDescToTranslated(day.weather[0].description),
				icons: OWMIconToBuiltInIcons(day.weather[0].icon),
				customIcon: OWMIconToCustomIcon(day.weather[0].icon)
			},
		};
		forecasts.push(forecast);
	}
	weather.forecasts = forecasts;

	const hourly: HourlyForecastData[] = [];
	for (const hour of json.hourly) {
		const forecast: HourlyForecastData = {
			date: DateTime.fromSeconds(hour.dt, { zone: json.timezone }),
			temp: hour.temp,
			condition: {
				main: conditionsTranslated ? hour.weather[0].main : OWMMainToTranslated(hour.weather[0].main),
				description: conditionsTranslated ? hour.weather[0].description : OWMDescToTranslated(hour.weather[0].description),
				icons: OWMIconToBuiltInIcons(hour.weather[0].icon),
				customIcon: OWMIconToCustomIcon(hour.weather[0].icon)
			},
		}

		if (hour.pop >= 0.1) {
			forecast.precipitation = {
				chance: hour.pop * 100,
				type: "none",
				//volume: undefined
			}
		}

		if (!!hour.rain && forecast.precipitation != null) {
			forecast.precipitation.volume = hour?.rain["1h"];
			forecast.precipitation.type = "rain";
		}

		// Snow takes precedence
		if (!!hour.snow && forecast.precipitation != null) {
			forecast.precipitation.volume = hour.snow["1h"];
			forecast.precipitation.type = "snow"
		}

		hourly.push(forecast);
	}

	weather.hourlyForecasts = hourly;

	const alerts: AlertData[] = [];
	for (const alert of json.alerts ?? []) {
		alerts.push({
			sender_name: alert.sender_name,
			level: "unknown",
			title: alert.event,
			description: SanitizeAlertDescription(alert.description)
		})
	}
	weather.alerts = alerts;

	return weather;
}

function SanitizeAlertDescription(text: string): string {
	const splitText = text.split("\n")
	//Replace empty lines with double newline
	for (let i = 0; i < splitText.length; i++) {
		const line = splitText[i];
		if (line == "") {
			splitText[i] = "\n\n"
		}
	}

	return splitText.join();
}

export interface OWMOneCallPayload {
	/** Not existing in original payload, it's for injecting from other payload manually */
	id?: number;
	lat: number;
	lon: number;
	timezone: string;
	timezone_offset: number;
	current: CurrentPayload;
	minutely?: MinutelyPayload[];
	hourly: HourlyPayload[];
	daily: DailyPayload[];
	alerts?: AlertPayload[]
}

export interface CurrentPayload {
	/** Unix timestamp seconds */
	dt: number;
	/** Unix timestamp seconds */
	sunrise: number;
	/** Unix timestamp seconds */
    sunset: number;
	/** Kelvin */
    temp: number;
	/** Kelvin */
    feels_like: number;
	/** hPa */
    pressure: number;
	/** % */
    humidity: number;
	/** Kelvin */
    dew_point: number;
	/** UV index */
    uvi: number;
	/** % */
    clouds: number;
	/** Average in metres */
    visibility: number;
	/** m/s */
    wind_speed: number;
	/** m/s, where available */
	wind_gust?: number;
	/** Meteorological degrees */
    wind_deg: number;
    weather: OWMWeatherCondition[];
    rain?: PrecipitationPayload;
	snow?: PrecipitationPayload;
}

export interface MinutelyPayload {
	/** Unix timestamp seconds */
	dt: number;
	/** mm */
	precipitation: number;
}

export interface HourlyPayload {
	/** Unix timestamp seconds */
	dt: number;
	/** Kelvin */
    temp: number;
	/** Kelvin */
    feels_like: number;
	/** hPa */
    pressure: number;
	/** % */
    humidity: number;
	/** Kelvin */
    dew_point: number;
	/** UV index */
    uvi: number;
	/** % */
    clouds: number;
	/** Average in metres */
    visibility: number;
	/** m/s */
    wind_speed: number;
	/** m/s, where available */
	wind_gust?: number;
	/** Meteorological degrees */
    wind_deg: number;
	/** Probability of precipitation, percent between 0 and 1  */
	pop: number;
	weather: OWMWeatherCondition[];
	rain?: PrecipitationPayload;
	snow?: PrecipitationPayload;
}

export interface DailyPayload {
	/** Unix timestamp seconds */
	dt: number;
	/** Unix timestamp seconds */
	sunrise: number;
	/** Unix timestamp seconds */
    sunset: number;
	/** Unix timestamp seconds */
	moonrise: number;
	/** Unix timestamp seconds */
    moonset: number;
	/**  Moon phase. 0 and 1 are 'new moon', 0.25 is 'first quarter moon', 0.5 is 'full moon' and 0.75 is 'last quarter moon'. The periods in between are called 'waxing crescent', 'waxing gibous', 'waning gibous', and 'waning crescent', respectively. */
	moon_phase: number;
	temp: {
		/** Morning temperature. Kelvin. */
		morn: number;
		/** Day temperature. Kelvin */
		day: number;
		/** Evening temperature. Kelvin */
		eve: number;
		/** Night temperature. */
		night: number;
		/** Min daily temperature. */
		min: number;
		/** Max daily temperature. */
		max: number;
	}
	feels_like: {
		/** Morning temperature. Kelvin. */
		morn: number;
		/** Day temperature. Kelvin */
		day: number;
		/** Evening temperature. Kelvin */
		eve: number;
		/** Night temperature. */
		night: number;
	}
	/** hPa */
    pressure: number;
	/** % */
    humidity: number;
	/** Kelvin */
    dew_point: number;
	/** UV index */
    uvi: number;
	/** % */
    clouds: number;
	/** Probability of precipitation, percent between 0 and 1  */
	pop: number;
	/** Volume, mm */
	rain?: number;
	/** Volume, mm */
	snow?: number;
	weather: OWMWeatherCondition[];
}

export interface AlertPayload {
	sender_name: string;
	event: string;
	/** Date and time of the start of the alert, Unix, UTC */
	start: number;
	/** Date and time of the end of the alert, Unix, UTC */
	end: number;
	description: string;
	tags: string[];
}

export interface PrecipitationPayload {
	/** Volume, mm */
	"1h"?: number;
}