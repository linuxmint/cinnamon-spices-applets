import { Conditions } from "./common";

export function IsCovered(payload: MetNorwayNowcastNoCoveragePayload | MetNorwayNowcastCoveragePayload): payload is MetNorwayNowcastCoveragePayload {
	return payload.properties.meta.radar_coverage == "ok";
}

//#region Payload

interface MetNorwayNowcastBasePayload {
	type: string,
	geometry: {
		type: string,
		/** lon, lat, alt */
		coordinates: number[]
	},
	properties: {
		meta: {
			/** ISO DateTime */
			updated_at: string;
			units: {
				air_temperature: string;
				precipitation_amount: string;
				precipitation_rate: string;
				relative_humidity: string;
				wind_from_direction: string;
				wind_speed: string;
				wind_speed_of_gust: string;
			}
			radar_coverage: "no coverage" | "temporarily unavailable" | "ok";
		}
		timeseries: [MetNorwayNowcastFirstData & MetNorwayNowcastPrecipData, ...MetNorwayNowcastPrecipData[]] | [MetNorwayNowcastFirstData]
	}
}

export interface MetNorwayNowcastNoCoveragePayload extends MetNorwayNowcastBasePayload {
	properties: {
		meta: MetNorwayNowcastBasePayload["properties"]["meta"] & 
		{
			radar_coverage: "no coverage" | "temporarily unavailable";
			
		};
		timeseries: [MetNorwayNowcastFirstData];
	}
}

export interface MetNorwayNowcastCoveragePayload extends MetNorwayNowcastBasePayload {
	properties: {
		meta: MetNorwayNowcastBasePayload["properties"]["meta"] & 
		{
			radar_coverage: "ok";
			
		};
		timeseries: [MetNorwayNowcastFirstData & MetNorwayNowcastPrecipData, ...MetNorwayNowcastPrecipData[]];
	}
}

export type MetNorwayNowcastPayload = MetNorwayNowcastCoveragePayload | MetNorwayNowcastNoCoveragePayload;

//#endregion

//#region Timeseries

interface MetNorwayNowcastBaseData {
	/** ISO Datetime */
	time: string;
	data: {
		instant: {
			details: {}
		}
	}
}

export interface MetNorwayNowcastPrecipData extends  MetNorwayNowcastBaseData{
	data: {
		instant: {
			details: {
				precipitation_rate: number;
			}
		}
	}
}

export interface MetNorwayNowcastFirstData extends MetNorwayNowcastBaseData {
	/** ISO Datetime */
	time: string;
	data: {
		instant: {
			details: {
				air_temperature: number;
				relative_humidity: number;
				wind_from_direction: number;
				wind_speed: number;
				wind_speed_of_gust: number;
			}
		}
		next_1_hours: {
			summary: {
				symbol_code: Conditions;
			},
			details: {
				precipitation_amount: number;
			}
		}
	}
}

export type MetNorwayNowcastData = MetNorwayNowcastPrecipData | MetNorwayNowcastFirstData | (MetNorwayNowcastFirstData & MetNorwayNowcastPrecipData);

//#endregion
