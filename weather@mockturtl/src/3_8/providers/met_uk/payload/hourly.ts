import type { FeatureCollection, Point } from "geojson";

export interface MetUkHourlyItem {
	/** ISO date string */
	time: string;
	/** Screen Air Temperature, In celsius */
	screenTemperature: number;
	/**
	 * Maximum Screen Air Temperature Over Previous Hour, In celsius
	 */
	maxScreenAirTemp: number;
	/**
	 * Minimum Screen Air Temperature Over Previous Hour, In celsius
	 */
	minScreenAirTemp: number;
	/**
	 * Screen Dew Point Temperature, In celsius
	 */
	screenDewPointTemperature: number;
	/**
	 * Feels Like Temperature, In celsius
	 */
	feelsLikeTemperature: number;
	/**
	 * 10m Wind Speed, in metres per second
	 */
	windSpeed10m: number;
	/**
	 * 10m Wind From Direction, in degrees
	 */
	windDirectionFrom10m: number;
	/**
	 * Maximum 10m Wind Gust Speed Over Previous Hour, in metres per second
	 */
	windGustSpeed10m: number;
	/**
	 * Visibility, in metres
	 */
	visibility: number;
	/**
	 * Screen Relative Humidity, in percentage
	 */
	screenRelativeHumidity: number;
	/**
	 * Mean Sea Level Pressure, in pascals
	 */
	mslp: number;
	/**
	 * UV Index, in unitless index
	 */
	uvIndex: number;
	/**
	 * Significant Weather Code
	 */
	significantWeatherCode: number;
	/**
	 * precipitationRate, in millimetres per hour
	 */
	precipitationRate: number;
	/**
	 * Total Precipitation Amount Over Previous Hour, in millimetres
	 */
	totalPrecipAmount: number;
	/**
	 * Total Snow Amount Over Previous Hour, in millimetres
	 */
	totalSnowAmount: number;
	/**
	 * Probability of Precipitation, in percentage
	 */
	probOfPrecipitation: number;
}

export interface MetUkHourlyProperties {
	location: {
		name: string;
	};
	/**
	 * in metres
	 */
	requestPointDistance: number;
	/** ISO date string */
	modelRunDate: string;
	timeSeries: MetUkHourlyItem[];
}

export type MetUkHourlyPayload = FeatureCollection<Point, MetUkHourlyProperties>;
