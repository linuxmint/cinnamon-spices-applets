import type { QWeatherBaseResponse } from "./common";

export interface QWeatherMinutelyResponse extends QWeatherBaseResponse {
	summary?: string;
	minutely?: string[];
}
