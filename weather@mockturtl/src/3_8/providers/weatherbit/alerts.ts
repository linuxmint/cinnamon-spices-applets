export interface WeatherbitAlert {
	title: string;
	description: string;
	severity: "Advisory" | "Watch" | "Warning";
	/**
	 * ISO date-time string without timezone
	 */
	effective_utc: string;
	/**
	 * ISO date-time string without timezone
	 */
	effective_local: string;
	/**
	 * ISO date-time string without timezone
	 */
	expires_utc: string;
	/**
	 * ISO date-time string without timezone
	 */
	expires_local: string;
	/**
	 * ISO date-time string without timezone
	 */
	onset_utc: string;
	/**
	 * ISO date-time string without timezone
	 */
	onset_local: string;
	/**
	 * ISO date-time string without timezone
	 */
	ends_utc: string;
	/**
	 * ISO date-time string without timezone
	 */
	ends_local: string;
	uri: string;
	regions: string[];
}

export interface WeatherbitAlertsResponse {
	lat: number;
	lon: number;
	county_code: string;
	timezone: string;
	alerts: WeatherbitAlert[];
}