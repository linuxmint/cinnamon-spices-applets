export type TomorrowIoAlertType = 'air' | 'fires' | 'wind' | "winter" | "thunderstorms" | "floods" | "temperature" | "tropical" | "marine" | "fog" | "tornado";

export interface TomorrowIoAlert {
	insight: TomorrowIoAlertType;
	/**
	 * ISO 8601 date and time string
	 */
	startTime: string;
	/**
	 * ISO 8601 date and time string
	 */
	endTime: string;
	/**
	 * ISO 8601 date and time string
	 */
	updateTime: string;
	severity: "unknown" | "minor" | "moderate" | "severe" | "extreme";
	certainty: "likely" | "possible" | "unlikely" | "unknown" | "observed";
	urgency: "future" | "expected" | "immediate" | "past" | "unknown";
	eventValues: {
		origin: string;
		title: string;
		headline?: string;
		description: string;
		response?: [
			{
				instruction?: string;
			}
		],
		geocode: string;
        geocodeType: string;
		link: string;
		distance: number;
		direction: number;
	}
}

export interface TomorrowIoAlertsResponse {
	data: {
		events: TomorrowIoAlert[];
	}
}