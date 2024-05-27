import { DateTime } from "luxon";
import type { Tuple } from "../../../types";
import { CelsiusToKelvin } from "../../../utils";
import { OpenMeteoWeatherCodeToCondition } from "./common";
import type { ForecastData } from "../../../weather-data";

export interface OpenMeteoDailyWeather {
	/**
	 * ISO 8601 date, no timezone, e.g. 2021-06-01.
	 */
	time: Tuple<string, 16>;
	/**
	 * °C
	 */
	temperature_2m_max: Tuple<number, 16>;
	/**
	 * °C
	 */
	temperature_2m_min: Tuple<number, 16>;
	/**
	 * °C
	 */
	apparent_temperature_max: Tuple<number, 16>;
	/**
	 * °C
	 */
	apparent_temperature_min: Tuple<number, 16>;
	/**
	 * ISO 8601 time, no timezone, e.g. 12:00.
	 */
	sunrise: Tuple<string, 16>;
	/**
	 * ISO 8601 time, no timezone, e.g. 12:00.
	 */
	sunset: Tuple<string, 16>;
	weather_code: Tuple<number, 16>;
}

export function OpenMeteoDailyWeatherToData(data: OpenMeteoDailyWeather, timezone: string): ForecastData[]  {
	const result: ForecastData[] = [];

	for (let i = 0; i < data.time.length; i++) {
		result.push({
			date: DateTime.fromISO(data.time[i], { zone: timezone }),
			temp_min: CelsiusToKelvin(data.temperature_2m_min[i]),
			temp_max: CelsiusToKelvin(data.temperature_2m_max[i]),
			condition: OpenMeteoWeatherCodeToCondition(data.weather_code[i], true),
		});
	}

	return result;
}