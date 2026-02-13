export interface PirateWeatherAlert {
	title: string;
	regions: string[];
	severity: 'Extreme' | 'Severe' | 'Moderate' | 'Minor' | "Unknown";
	/**
	 * Unix timestamp in seconds
	 */
	time: number;
	/**
	 * Unix timestamp in seconds
	 */
	expires: number;
	description: string;
	uri: string;
}