export interface SwissMeteoCurrentWeather {
	/** Unix timestamp in milliseconds */
	time: number;
	icon: number;
	iconV2: number;
	/**
	 * Temperature in °C
	 */
	temperature: number;
}