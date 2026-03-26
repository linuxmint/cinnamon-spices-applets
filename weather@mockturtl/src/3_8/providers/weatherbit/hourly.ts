import type { WeatherBitWeatherCode } from "./common";

export interface WeatherBitHourlyWeatherData {
	temp: number;
	ts: number;
	weather: WeatherBitWeatherCode;
	pop: number;
	precip: number;
	snow: number;
}

export interface WeatherBitHourlyWeatherDataResponse {
	data: WeatherBitHourlyWeatherData[];
	timezone: string;
}