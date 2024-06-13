import { CelsiusToKelvin, KPHtoMPS, _ } from "../../../utils";
import type { WeatherData } from "../../../weather-data";
import { OpenMeteoWeatherCodeToCondition } from "./common";

export interface OpenMeteoCurrentWeather {
	/**
	 * ISO 8601 date and time, no timezone, e.g. 2021-06-01T12:00.
	 *
	 * Local timezone is assumed.
	 */
	time: string;
	/**
	 * seconds
	 */
	interval: number;
	/**
	 * °C
	 */
	temperature_2m: number;
	/**
	 * °C
	 */
	dewpoint_2m: number;
	/**
	 * %
	 */
	relative_humidity_2m: number;
	/**
	 * °C
	 */
	apparent_temperature: number;
	/**
	 * boolean
	 */
	is_day: 0 | 1;
	/**
	 * mm
	 */
	precipitation: number;
	/**
	 * mm
	 */
	rain: number;
	/**
	 * mm
	 */
	showers: number;
	/**
	 * cm
	 */
	snowfall: number;
	/**
	 * weather code
	 */
	weather_code: number;
	/**
	 * hPa
	 */
	surface_pressure: number;
	/**
	 * km/h
	 */
	wind_speed_10m: number;
	/**
	 * °
	 */
	wind_direction_10m: number;
	/**
	 * km/h
	 */
	wind_gusts_10m: number;
}

type CurrentWeather = Omit<WeatherData,
	"forecasts" |
	"hourlyForecasts" |
	"immediatePrecipitation" |
	"alerts" |
	"sunset" |
	"sunrise" |
	"location" |
	"coord" |
	"date"
>;

export function OpenMeteoCurrentWeatherToData(data: OpenMeteoCurrentWeather): CurrentWeather {
	return {
		condition: OpenMeteoWeatherCodeToCondition(data.weather_code, data.is_day === 1),
		temperature: CelsiusToKelvin(data.temperature_2m),
		pressure: data.surface_pressure,
		humidity: data.relative_humidity_2m,
		wind: {
			speed: KPHtoMPS(data.wind_speed_10m),
			degree: data.wind_direction_10m,
		},
		dewPoint: CelsiusToKelvin(data.dewpoint_2m),
		extra_field: {
			name: _("Feels like"),
			value: CelsiusToKelvin(data.apparent_temperature),
			type: "temperature"
		}
	}
}