import { PirateWeatherIcon } from "./common";

export interface PirateWeatherMinutelyPayload {
	time: number;
	icon: PirateWeatherIcon;
	summary: string;
	precipIntensity: number;
	precipProbability: number;
	precipIntensityError: number;
	precipAccumulation: number;
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