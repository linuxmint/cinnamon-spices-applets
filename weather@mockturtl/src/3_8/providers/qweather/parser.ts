import { DateTime } from "luxon";
import { FindPrecipitationWindow } from "../../lib/precipitation";
import { CelsiusToKelvin, KPHtoMPS } from "../../lib/unitConversions";
import type { LocationData } from "../../types";
import type { AlertData, AlertLevel, HourlyForecastData, PrecipitationType, WeatherData } from "../../weather-data";
import { QWeatherCondition } from "./condition";
import type { QWeatherAlert, QWeatherAlertResponse } from "./payload/alert";
import type { QWeatherCurrentResponse } from "./payload/current";
import type { QWeatherDailyResponse } from "./payload/daily";
import type { QWeatherHourlyForecast, QWeatherHourlyResponse } from "./payload/hourly";
import type { QWeatherMinutelyResponse } from "./payload/minutely";

export type Translator = (text: string) => string;

export interface QWeatherPayloadSet {
	current: QWeatherCurrentResponse;
	daily?: QWeatherDailyResponse | null;
	hourly?: QWeatherHourlyResponse | null;
	minutely?: QWeatherMinutelyResponse | null;
	alerts?: QWeatherAlertResponse | null;
}

function FiniteNumber(value: string | undefined): number | null {
	if (value == null || value.trim() === "")
		return null;

	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : null;
}

function QWeatherTime(value: string, location: LocationData): DateTime {
	return DateTime.fromISO(value, { setZone: true }).setZone(location.timeZone);
}

function LocalTime(date: string, time: string | undefined, location: LocationData): DateTime | null {
	if (!time || time === "--")
		return null;

	const result = DateTime.fromISO(`${date}T${time}`, { zone: location.timeZone });
	return result.isValid ? result : null;
}

function QWeatherPrecipitationType(icon: string): PrecipitationType {
	const code = Number(icon);
	if (code >= 400 && code <= 499)
		return "snow";
	if (code === 313)
		return "freezing rain";
	return "rain";
}

function QWeatherHourlyToData(hour: QWeatherHourlyForecast, location: LocationData, translate: Translator): HourlyForecastData {
	const chance = FiniteNumber(hour.pop);
	const volume = FiniteNumber(hour.precip);
	const hasPrecipitation = (chance ?? 0) > 0 || (volume ?? 0) > 0;

	return {
		date: QWeatherTime(hour.fxTime, location),
		temp: CelsiusToKelvin(FiniteNumber(hour.temp)),
		condition: QWeatherCondition(hour.icon, hour.text, translate),
		precipitation: hasPrecipitation ? {
			type: QWeatherPrecipitationType(hour.icon),
			chance: chance ?? undefined,
			volume: volume ?? undefined,
		} : undefined,
	};
}

function QWeatherAlertLevel(severity: string): AlertLevel {
	if (severity === "minor" || severity === "moderate" || severity === "severe" || severity === "extreme")
		return severity;
	return "unknown";
}

function QWeatherAlertToData(alert: QWeatherAlert, attributions: string[]): AlertData {
	return {
		sender_name: alert.senderName ?? "QWeather",
		level: QWeatherAlertLevel(alert.severity),
		icon: "weather-severe-alert",
		title: alert.headline,
		description: [alert.description, ...attributions].join("\n"),
	};
}

export function QWeatherResponseToData(
	payloads: QWeatherPayloadSet,
	location: LocationData,
	translate: Translator,
): WeatherData | null {
	const { current } = payloads;
	if (current.code !== "200" || !current.now)
		return null;

	const daily = payloads.daily?.code === "200" ? payloads.daily.daily ?? [] : [];
	const hourly = payloads.hourly?.code === "200" ? payloads.hourly.hourly ?? [] : [];
	const firstDaily = daily[0];
	const minutely = payloads.minutely?.code === "200" ? payloads.minutely.minutely : undefined;
	const attributions = payloads.alerts?.metadata?.attributions ?? [];
	const alerts = payloads.alerts?.alerts?.map(alert => QWeatherAlertToData(alert, attributions));
	const windSpeed = FiniteNumber(current.now.windSpeed);

	return {
		date: QWeatherTime(current.now.obsTime, location),
		coord: { lat: location.lat, lon: location.lon },
		location: {
			city: location.city,
			country: location.country,
			timeZone: location.timeZone,
			url: current.fxLink,
		},
		sunrise: firstDaily ? LocalTime(firstDaily.fxDate, firstDaily.sunrise, location) : null,
		sunset: firstDaily ? LocalTime(firstDaily.fxDate, firstDaily.sunset, location) : null,
		wind: {
			speed: windSpeed == null ? null : KPHtoMPS(windSpeed),
			degree: FiniteNumber(current.now.wind360),
		},
		uvIndex: FiniteNumber(firstDaily?.uvIndex),
		temperature: CelsiusToKelvin(FiniteNumber(current.now.temp)),
		pressure: FiniteNumber(current.now.pressure),
		humidity: FiniteNumber(current.now.humidity),
		dewPoint: CelsiusToKelvin(FiniteNumber(current.now.dew)),
		condition: QWeatherCondition(current.now.icon, current.now.text, translate),
		forecasts: daily.map(day => ({
			date: DateTime.fromISO(day.fxDate, { zone: location.timeZone }).set({ hour: 12 }),
			temp_min: CelsiusToKelvin(FiniteNumber(day.tempMin)),
			temp_max: CelsiusToKelvin(FiniteNumber(day.tempMax)),
			condition: QWeatherCondition(day.iconDay, day.textDay, translate),
		})),
		hourlyForecasts: hourly.map(hour => QWeatherHourlyToData(hour, location, translate)),
		extra_field: (() => {
			const feelsLike = CelsiusToKelvin(FiniteNumber(current.now?.feelsLike));
			return feelsLike == null ? undefined : {
				name: translate("Feels like"),
				value: feelsLike,
				type: "temperature" as const,
			};
		})(),
		...(minutely ? {
			immediatePrecipitation: FindPrecipitationWindow(minutely.map(value => FiniteNumber(value) ?? 0), 5),
		} : {}),
		alerts,
	};
}
