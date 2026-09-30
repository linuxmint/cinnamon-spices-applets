import type { QWeatherBaseResponse } from "./common";

export interface QWeatherCurrentConditions {
	obsTime: string;
	temp: string;
	feelsLike?: string;
	icon: string;
	text: string;
	wind360?: string;
	windDir?: string;
	windScale?: string;
	windSpeed?: string;
	humidity?: string;
	precip?: string;
	pressure?: string;
	vis?: string;
	cloud?: string;
	dew?: string;
}

export interface QWeatherCurrentResponse extends QWeatherBaseResponse {
	now?: QWeatherCurrentConditions;
}
