export interface QWeatherBaseResponse {
	code: string;
	updateTime?: string;
	fxLink?: string;
	refer?: {
		sources?: string[];
		license?: string[];
	};
}
