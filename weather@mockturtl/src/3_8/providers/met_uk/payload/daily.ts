import type { FeatureCollection, Point } from "geojson";

export interface MetUkDailyItem {
	/** ISO date string */
	time: string;
	/**
	 * 10m Wind Speed at Local Midday, in metres per second
	 */
	midday10MWindSpeed: number;
	/**
	 * 10m Wind Speed at Local Midnight, in metres per second
	 */
	midnight10MWindSpeed: number;
	/**
	 * 10m Wind Direction at Local Midday, in degrees
	 */
	midday10MWindDirection: number;
	/**
	 * 10m Wind Direction at Local Midnight, in degrees
	 */
	midnight10MWindDirection: number;
	/**
	 * 10m Wind Gust Speed at Local Midday, in metres per second
	 */
	midday10MWindGust: number;
	/**
	 * 10m Wind Gust Speed at Local Midnight, in metres per second
	 */
	midnight10MWindGust: number;
	/**
	 * Visibility at Local Midday, in metres
	 */
	middayVisibility: number;
	/**
	 * Visibility at Local Midnight, in metres
	 */
	midnightVisibility: number;
	/**
	 * Relative Humidity at Local Midday, in percentage
	 */
	middayRelativeHumidity: number;
	/**
	 * Relative Humidity at Local Midnight, in percentage
	 */
	midnightRelativeHumidity: number;
	/**
	 * Mean Sea Level Pressure at Local Midday, in pascals
	 */
	middayMslp: number;
	/**
	 * Mean Sea Level Pressure at Local Midnight, in pascals
	 */
	midnightMslp: number;
	/**
	 * Day Maximum UV Index, in unitless index
	 */
	maxUvIndex?: number;
	/**
	 * Day Significant Weather Code
	 */
	daySignificantWeatherCode?: number;
	/**
	 * Night Significant Weather Code
	 */
	nightSignificantWeatherCode: number;
	/**
	 * Day Maximum Screen Air Temperature, In celsius
	 */
	dayMaxScreenTemperature: number;
	/**
	 * Night Minimum Screen Air Temperature, In celsius
	 */
	nightMinScreenTemperature: number;
	/**
	 * Upper Bound on Day Maximum Screen Air Temperature, In celsius
	 */
	dayUpperBoundMaxTemp: number;
	/**
	 * Upper Bound on Night Minimum Screen Air Temperature, In celsius
	 */
	nightUpperBoundMinTemp: number;
	/**
	 * Lower Bound on Day Maximum Screen Air Temperature, In celsius
	 */
	dayLowerBoundMaxTemp: number;
	/**
	 * Lower Bound on Night Minimum Screen Air Temperature, In celsius
	 */
	nightLowerBoundMinTemp: number;
	/**
	 * Day Maximum Feels Like Air Temperature, In celsius
	 */
	dayMaxFeelsLikeTemp?: number;
	/**
	 * Night Minimum Feels Like Air Temperature, In celsius
	 */
	nightMinFeelsLikeTemp: number;
	/**
	 * Upper Bound on Day Maximum Feels Like Air Temperature, In celsius
	 */
	dayUpperBoundMaxFeelsLikeTemp: number;
	/**
	 * Upper Bound on Night Minimum Feels Like Air Temperature, In celsius
	 */
	nightUpperBoundMinFeelsLikeTemp: number;
	/**
	 * Lower Bound on Day Maximum Feels Like Air Temperature, In celsius
	 */
	dayLowerBoundMaxFeelsLikeTemp: number;
	/**
	 * Lower Bound on Night Minimum Feels Like Air Temperature, In celsius
	 */
	nightLowerBoundMinFeelsLikeTemp: number;
	/**
	 * Probability of Precipitation During The Day, in percentage
	 */
	dayProbabilityOfPrecipitation?: number;
	/**
	 * Probability of Precipitation During The Night, in percentage
	 */
	nightProbabilityOfPrecipitation: number;
	/**
	 * Probability of Snow During The Day, in percentage
	 */
	dayProbabilityOfSnow?: number;
	/**
	 * Probability of Snow During The Night, in percentage
	 */
	nightProbabilityOfSnow: number;
	/**
	 * Probability of Heavy Snow During The Day, in percentage
	 */
	dayProbabilityOfHeavySnow?: number;
	/**
	 * Probability of Heavy Snow During The Night, in percentage
	 */
	nightProbabilityOfHeavySnow: number;
	/**
	 * Probability of Rain During The Day, in percentage
	 */
	dayProbabilityOfRain?: number;
	/**
	 * Probability of Rain During The Night, in percentage
	 */
	nightProbabilityOfRain: number;
	/**
	 * Probability of Heavy Rain During The Day, in percentage
	 */
	dayProbabilityOfHeavyRain?: number;
	/**
	 * Probability of Heavy Rain During The Night, in percentage
	 */
	nightProbabilityOfHeavyRain: number;
	/**
	 * Probability of Hail During The Day, in percentage
	 */
	dayProbabilityOfHail?: number;
	/**
	 * Probability of Hail During The Night, in percentage
	 */
	nightProbabilityOfHail: number;
	/**
	 * Probability of Sferics During The Day, in percentage
	 */
	dayProbabilityOfSferics?: number;
	/**
	 * Probability of Sferics During The Night, in percentage
	 */
	nightProbabilityOfSferics: number;
}

export interface MetUkDailyProperties {
	/** ISO date string */
	modelRunTime: string;
	/** in metres */
	requestPointDistance: number;
	location: {
		name: string;
	}
	timeSeries: MetUkDailyItem[];
}

export type MetUkDailyPayload = FeatureCollection<Point, MetUkDailyProperties>;