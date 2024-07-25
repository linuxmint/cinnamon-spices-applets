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