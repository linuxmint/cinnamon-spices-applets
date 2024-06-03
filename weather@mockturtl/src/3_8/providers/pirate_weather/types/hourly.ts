import type { PirateWeatherIcon, PirateWeatherSummary } from "./common";

export interface PirateWeatherHourlyPayload {
	time: number;
	summary: PirateWeatherSummary;
	icon: PirateWeatherIcon;
	precipIntensity: number;
	precipProbability: number;
	precipType: string;
	temperature: number;
	apparentTemperature: number;
	dewPoint: number;
	humidity: number;
	pressure: number;
	windSpeed: number;
	windGust: number;
	windBearing: number;
	cloudCover: number;
	uvIndex: number;
	visibility: number;
	ozone: number;
}