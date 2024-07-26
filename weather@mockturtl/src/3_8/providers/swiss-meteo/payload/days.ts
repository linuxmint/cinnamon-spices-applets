import { DateTime } from "luxon";
import type { ForecastData } from "../../../weather-data";
import { CelsiusToKelvin } from "../../../utils";
import { SwissMeteoIconToCondition } from "./common";

export interface SwissMeteoDay {
	/**
	 * ISO short timestamp (YYYY-MM-DD)
	 */
	dayDate: string;
	iconDay: number;
	iconDayV2: number;
	/**
	 * in celsius
	 */
	temperatureMax: number;
	/**
	 * in celsius
	 */
	temperatureMin: number;
	/**
	 * in mm
	 */
	precipitation: number;
}

export function SwissMeteoDayToForecastData(day: SwissMeteoDay): ForecastData {
	return {
		date: DateTime.fromISO(day.dayDate),
		condition: SwissMeteoIconToCondition(day.iconDayV2),
		temp_max: CelsiusToKelvin(day.temperatureMax),
		temp_min: CelsiusToKelvin(day.temperatureMin),
	};
}