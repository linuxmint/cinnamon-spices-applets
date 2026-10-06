import type { QWeatherBaseResponse } from "./common";

export interface QWeatherMinutelyEntry {
	fxTime: string;
	precip: string;
	type: string;
}

export interface QWeatherMinutelyResponse extends QWeatherBaseResponse {
	summary?: string;
	minutely?: QWeatherMinutelyEntry[];
}
