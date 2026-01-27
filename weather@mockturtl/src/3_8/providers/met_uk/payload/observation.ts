export interface MetUkObservationStation {
	geohash: string;
	area: string;
	region: string | null;
	country: string | null;
	olson_time_zone: string;
}

export interface MetUkObservationData {
	/**
	 * ISO date string
	 */
	datetime: string;
	/**
	 *
	 * Probability as a percentage of 100.
	 */
	humidity: number | null;
	/**
	 * Mean surface level pressure in hPA.
	 */
	mslp: number | null;
	pressure_tendency: string | null;
	/**
	 * Air temperature in °C.
	 */
	temperature: number | null;
	/**
	 * Visibility in metres.
	 */
	visibility: number | null;
	/**
	 * Numerical code for the weather symbol.
	 */
	weather_code: number | null;
	/**
	 * Direction the wind is travelling from in 16 point compass notation.
	 */
	wind_direction: string | null;
	/**
	 * Wind gust speed in m/s.
	 */
	wind_gust: number | null;
	/**
	 * Wind speed in m/s.
	 */
	wind_speed: number | null;
}