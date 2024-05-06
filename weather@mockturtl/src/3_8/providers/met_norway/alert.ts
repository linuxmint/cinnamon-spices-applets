import { HttpLib } from "../../lib/httpLib";
import { Logger } from "../../lib/logger";
import { AlertData, AlertLevel, BuiltinIcons, CustomIcons } from "../../types";

export type METNorwayAlertEvent = "blowingSnow" | "forestFire" | "gale" | "ice" | "icing" | "lightning" | "polarLow" | "rain" | "rainFlood" | "snow" | "stormSurge" | "wind";

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
	consequences: string;
	/**
	 * Event type
	 *
	 * @example "forestFire"
	 */
	event: METNorwayAlertEvent;
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
		coordinates: [number, number][][];
		type: "Polygon";
	};
	properties: METNorwayAlert;
	type: "Feature";
}

export interface METNorwayAlertResponse {
	features: METNorwayAlertFeature[];
}

export async function GetMETNorwayAlerts(cancellable: imports.gi.Gio.Cancellable, lat: number, lon: number): Promise<AlertData[] | null>{
	const response = await HttpLib.Instance.LoadJsonSimple<METNorwayAlertResponse>({
		url: "https://api.met.no/weatherapi/metalerts/1.1/.json",
		cancellable: cancellable,
	})

	if (response === null) {
		return null;
	}

	const result: METNorwayAlert[] = [];
	for (const feature of response.features) {
		let isInside = false;
		for (const geometry of feature.geometry.coordinates) {
			if (inside([lon, lat], geometry)) {
				isInside = true;
				break;
			}
		}
		if (!isInside) {
			Logger.Debug(`Skipping alert '${feature.properties.event}' in area '${feature.properties.area}', current location is not inside area.`);
			continue;
		}

		Logger.Debug(`Adding alert '${feature.properties.event}' in area '${feature.properties.area}'!`);
		result.push(feature.properties);
	}

	return result.map(alert => ({
		title: alert.title,
		level: SeverityToLevel(alert.severity),
		description: alert.description,
		sender_name: "MET Norway",
		icon: EventToIcon(alert.event),
	}));
}

function SeverityToLevel(severity: string): AlertLevel {
	switch (severity) {
		case "Extreme":
			return "extreme";
		case "Severe":
			return "severe";
		case "Moderate":
			return "moderate";
		case "Minor":
			return "minor";
		default:
			return "unknown";
	}
}

function EventToIcon(event: METNorwayAlertEvent): BuiltinIcons | CustomIcons | undefined {
	switch (event) {
		case "blowingSnow":
			return "snow-wind-symbolic";
		case "forestFire":
			return "fire-symbolic";
		case "gale":
			return "gale-warning-symbolic";
		case "ice":
			return "snowflake-cold-symbolic";
		case "icing":
			return "snowflake-cold-symbolic";
		case "lightning":
			return "lightning-symbolic";
		case "polarLow":
			return "hurricane-symbolic";
		case "rain":
			return "raindrop-symbolic";
		case "rainFlood":
			return "flood-symbolic";
		case "snow":
			return "snowflake-cold-symbolic";
		case "stormSurge":
			return "lightning-symbolic";
		case "wind":
			return "strong-wind-symbolic";
		default:
			Logger.Info(`Unknown MET Norway event type: ${event}`);
			return undefined;
	}
}

function inside(point: [lon: number, lat: number], vs: [lon: number, lat: number][]) {
    const maxX = Math.max(...vs.map(v => v[0]));
	const minX = Math.min(...vs.map(v => v[0]));
	const maxY = Math.max(...vs.map(v => v[1]));
	const minY = Math.min(...vs.map(v => v[1]));

	if (point[0] < minX || point[0] > maxX || point[1] < minY || point[1] > maxY) {
		global.log("Completely outside")
		return false;
	}

	let intersections = 0;
	let padding = 0.1;
	const pv1 = [(minX - padding/point[0]), (minY - padding/point[1])];
	const pv2 = point;
	for (let i = 0; i < vs.length - 1; i++) {
		const v1 = vs[i];
		const v2 = vs[i + 1];
		// Test if current side intersects with ray.
		if (areIntersecting(v1[0], v1[1], v2[0], v2[1], pv1[0], pv1[1], pv2[0], pv2[1]))
			intersections++;

		// If yes, intersections++;
	}
	if ((intersections & 1) == 1) {
		return true;
	} else {
		// Outside of polygon
		return false;
	}
}

function areIntersecting(
		v1x1: number, v1y1: number, v1x2: number, v1y2: number,
		v2x1: number, v2y1: number, v2x2: number, v2y2: number
	) {
		let d1: number, d2: number;
		let a1: number, a2: number, b1: number, b2: number, c1: number, c2: number;

		// Convert vector 1 to a line (line 1) of infinite length.
		// We want the line in linear equation standard form: A*x + B*y + C = 0
		// See: http://en.wikipedia.org/wiki/Linear_equation
		a1 = v1y2 - v1y1;
		b1 = v1x1 - v1x2;
		c1 = (v1x2 * v1y1) - (v1x1 * v1y2);

		// Every point (x,y), that solves the equation above, is on the line,
		// every point that does not solve it, is not. The equation will have a
		// positive result if it is on one side of the line and a negative one
		// if is on the other side of it. We insert (x1,y1) and (x2,y2) of vector
		// 2 into the equation above.
		d1 = (a1 * v2x1) + (b1 * v2y1) + c1;
		d2 = (a1 * v2x2) + (b1 * v2y2) + c1;

		// If d1 and d2 both have the same sign, they are both on the same side
		// of our line 1 and in that case no intersection is possible. Careful,
		// 0 is a special case, that's why we don't test ">=" and "<=",
		// but "<" and ">".
		if (d1 > 0 && d2 > 0) return false;
		if (d1 < 0 && d2 < 0) return false;

		// The fact that vector 2 intersected the infinite line 1 above doesn't
		// mean it also intersects the vector 1. Vector 1 is only a subset of that
		// infinite line 1, so it may have intersected that line before the vector
		// started or after it ended. To know for sure, we have to repeat the
		// the same test the other way round. We start by calculating the
		// infinite line 2 in linear equation standard form.
		a2 = v2y2 - v2y1;
		b2 = v2x1 - v2x2;
		c2 = (v2x2 * v2y1) - (v2x1 * v2y2);

		// Calculate d1 and d2 again, this time using points of vector 1.
		d1 = (a2 * v1x1) + (b2 * v1y1) + c2;
		d2 = (a2 * v1x2) + (b2 * v1y2) + c2;

		// Again, if both have the same sign (and neither one is 0),
		// no intersection is possible.
		if (d1 > 0 && d2 > 0) return false;
		if (d1 < 0 && d2 < 0) return false;

		// If we get here, only two possibilities are left. Either the two
		// vectors intersect in exactly one point or they are collinear, which
		// means they intersect in any number of points from zero to infinite.
		if ((a1 * b2) - (a2 * b1) == 0.0) return false;

		// If they are not collinear, they must intersect in exactly one point.
		return true;

}