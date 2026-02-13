import { DateTime } from "luxon";
import type { Tuple } from "../../../types";
import { OpenMeteoWeatherCodeToCondition } from "./common";
import { CelsiusToKelvin } from "../../../utils";
import type { HourlyForecastData } from "../../../weather-data";

export interface OpenMeteoHourWeather {
	/**
	 * ISO 8601 date and time, no timezone, e.g. 2021-06-01T12:00.
	 *
	 * Local timezone is assumed.
	 */
	time: Tuple<string, 24>;
	/**
	 * °C
	 */
	temperature_2m: Tuple<number, 24>;
	/**
	 * %
	 */
	precipitation_probability: Tuple<number, 24>;
	/**
	 * mm
	 */
	precipitation: Tuple<number, 24>;
	/**
	 * mm
	 */
	rain: Tuple<number, 24>;
	/**
	 * mm
	 */
	showers: Tuple<number, 24>;
	/**
	 * cm
	 */
	snowfall: Tuple<number, 24>;
	/**
	 * weather code
	 */
	weather_code: Tuple<number, 24>;
	/**
	 * km/h
	 */
	wind_speed_10m: Tuple<number, 24>;
	/**
	 * °
	 */
	wind_direction_10m: Tuple<number, 24>;
	is_day: Tuple<0 | 1, 24>;
}

export function OpenMeteoHourWeatherToData(data: OpenMeteoHourWeather, timezone: string): HourlyForecastData[] {
	const result: HourlyForecastData[] = [];
	for (let i = 0; i < data.time.length; i++) {
		result.push({
			date: DateTime.fromISO(data.time[i], { zone: timezone }),
			condition: OpenMeteoWeatherCodeToCondition(data.weather_code[i], data.is_day[i] === 1),
			temp: CelsiusToKelvin(data.temperature_2m[i]),
			precipitation: data.precipitation[i] > 0 ? {
				chance: data.precipitation_probability[i],
				volume: data.precipitation[i],
				type: (data.rain[i] > 0 || data.showers[i] > 0) ? "rain" : (data.snowfall[i] > 0 ? "snow" : "none"),
			} : undefined
		});
	}

	return result;
}