import type { WeatherBitWeatherCode } from "./common";

export interface WeatherBitCurrentWeatherData {
	count: 1;
	data: [
		{
			/**
			 * Temperature in kelvin
			 */
			app_temp: number;
			aqi: number;
			city_name: string;
			clouds: number;
			country_code: string;
			/**
			 * incomplete date, format is "YYYY-MM-DD:HH"
			 */
			datetime: string;
			/**
			 * Temperature in kelvin
			 */
			dewpt: number;
			dhi: number;
			dni: number;
			elev_angle: number;
			ghi: number;
			gust: number;
			h_angle: number;
			lat: number;
			lon: number;
			/**
			 * Timestamp, format is "YYYY-MM-DD HH:MM"
			 */
			ob_time: string;
			pod: string;
			precip: number;
			pres: number;
			rh: number;
			slp: number;
			snow: number;
			solar_rad: number;
			sources: string[];
			state_code: string;
			station: string;
			/** HH:MM */
			sunrise: string;
			/** HH:MM */
			sunset: string;
			/**
			 * Temperature in kelvin
			 */
			temp: number;
			timezone: string;
			/**
			 * Unix timestamp in seconds
			 */
			ts: number;
			uv: number;
			vis: number;
			weather: WeatherBitWeatherCode;
			wind_cdir: string;
			wind_cdir_full: string;
			wind_dir: number;
			wind_spd: number;
		}
	]
}