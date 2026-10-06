export interface QWeatherAlertMetadata {
	tag?: string;
	zeroResult?: boolean;
	attributions?: string[];
}

export interface QWeatherAlertMessageType {
	code: string;
	supersedes?: string[] | null;
}

export interface QWeatherAlertEventType {
	name: string;
	code: string;
}

export interface QWeatherAlertColor {
	code: string;
	red: number;
	green: number;
	blue: number;
	alpha: number;
}

export interface QWeatherAlert {
	id: string;
	senderName: string | null;
	issuedTime: string;
	messageType: QWeatherAlertMessageType;
	latestChange?: string | null;
	eventType: QWeatherAlertEventType;
	urgency?: string | null;
	severity: string;
	certainty?: string | null;
	icon?: string;
	color?: QWeatherAlertColor;
	effectiveTime?: string | null;
	onsetTime?: string | null;
	expireTime?: string | null;
	headline: string;
	description: string;
	criteria?: string | null;
	responseTypes?: string[] | null;
	instruction?: string | null;
}

export interface QWeatherAlertResponse {
	metadata?: QWeatherAlertMetadata;
	alerts?: QWeatherAlert[];
}
