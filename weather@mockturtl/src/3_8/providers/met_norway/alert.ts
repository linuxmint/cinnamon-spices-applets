import { HttpLib } from "../../lib/httpLib";

export interface METNorwayAlert {
	area: string;
	awarenessResponse: string;
	/**
	 * @example "2; yellow; Moderate"
	 */
	awareness_level: `${number}: ${string}: ${string}`;
	/**
	 * @example "8; forest-fire"
	 */
	awareness_type: `${number}: ${string}`;
	description: string;
	instruction: string;
	/**
	 * Event type
	 *
	 * @example "forestFire"
	 */
	event: string;
	/**
	 * Localised event name
	 * @example "Skogbrannfare"
	 */
	eventAwarenessName: string;
	title: string;
	severity: "Extreme" | "Severe" | "Moderate" | "Minor" | "Unknown";
}

export interface METNorwayAlertFeature {
	geometry: {
		coordinates: [number, number][];
		type: "Polygon";
	};
	properties: METNorwayAlert;
	type: "Feature";
}

export interface METNorwayAlertResponse {
	features: METNorwayAlertFeature[];
}

export async function GetMETNorwayAlerts(cancellable: imports.gi.Gio.Cancellable, lat: number, lon: number) {
	const response = await HttpLib.Instance.LoadJsonSimple<METNorwayAlertResponse>({
		url: "https://api.met.no/weatherapi/metalerts/1.1/.json",
		cancellable: cancellable,
	})

	if (response === null) {
		return null;
	}

	const result: METNorwayAlert[] = [];
	for (const feature of response.features) {
		if (!InsideGeoJsonPolygon(feature.geometry.coordinates, lat, lon)) {
			continue;
		}

		result.push(feature.properties);
	}

	return result;
}

function InsideGeoJsonPolygon(polygon: [number, number][], lat: number, lon: number): boolean {
	let i: number;
	let j: number;
	let c: boolean = false;
	for (i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
		if (((polygon[i][1] > lat) != (polygon[j][1] > lat)) &&
			(lon < (polygon[j][0] - polygon[i][0]) * (lat - polygon[i][1]) / (polygon[j][1] - polygon[i][1]) + polygon[i][0])) {
			c = !c;
		}
	}
	return c;
}