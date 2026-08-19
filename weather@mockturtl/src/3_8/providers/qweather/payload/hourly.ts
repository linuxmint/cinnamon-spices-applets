import type { QWeatherBaseResponse } from "./common";

export interface QWeatherHourlyForecast {
	fxTime: string;
	temp: string;
	icon: string;
	text: string;
	wind360?: string;
	windDir?: string;
	windScale?: string;
	windSpeed?: string;
	humidity?: string;
	pop?: string;
	precip?: string;
	pressure?: string;
	cloud?: string;
	dew?: string;
}

export interface QWeatherHourlyResponse extends QWeatherBaseResponse {
	hourly?: QWeatherHourlyForecast[];
}
