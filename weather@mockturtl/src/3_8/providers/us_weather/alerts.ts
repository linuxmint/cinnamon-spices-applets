import { HttpLib } from "../../lib/httpLib";
import type { AlertData, AlertLevel, BuiltinIcons, CustomIcons } from "../../weather-data";

interface USWeatherAlert {
	geometry: {
		type: "Polygon";
		coordinates: [number, number][][];
	} | null;
	properties: {
		sent: string;
		/**
		 * ISO 8601 date and time string.
		 */
		effective: string;
		/**
		 * ISO 8601 date and time string.
		 */
		onset: string | null;
		/**
		 * ISO 8601 date and time string.
		 */
		expires: string | null;
		/**
		 * ISO 8601 date and time string.
		 */
		ends: string | null;
		status: "Actual" | "Test";
		messageType: "Alert" | "Update" | "Cancel" | "Ack";
		severity: "Extreme" | "Severe" | "Moderate" | "Minor" | "Unknown";
		certainty: "Observed" | "Likely" | "Possible" | "Unlikely" | "Unknown";
		urgency: "Unknown" | "Expected" | "Future" | "Immediate";
		/**
		 * https://api.weather.gov/alerts/types
		 */
		event: string;
		sender: string;
		senderName: string;
		description: string;
		instruction: string | null;
		headline: string;
		areaDesc: string;
	}
}

interface USWeatherAlertsResponse {
	features: USWeatherAlert[];
	pagination?: {
		next?: string;
	}
}

export async function GetUSWeatherAlerts(cancellable: imports.gi.Gio.Cancellable, lat: number, lon: number): Promise<AlertData[] | null> {
	const alerts: AlertData[] = [];

	let next: string | undefined = "https://api.weather.gov/alerts/active";
	while (next) {
		const response: USWeatherAlertsResponse | null = await HttpLib.Instance.LoadJsonSimple({
			url: next,
			cancellable: cancellable,
			params: {
				point: `${lat},${lon}`
			}
		})

		if (response === null) {
			return null;
		}

		for (const alert of response.features) {
			alerts.push({
				title: alert.properties.headline,
				description: `${alert.properties.description}\n\n${alert.properties.instruction ?? ""}`,
				level: SeverityToAlertLevel(alert.properties.severity),
				sender_name: alert.properties.senderName,
				icon: EventNameToIcon(alert.properties.event)
			})
		}

		next = response.pagination?.next;
	}

	return alerts;
}

function SeverityToAlertLevel(level: USWeatherAlert["properties"]["severity"]): AlertLevel {
	switch (level) {
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

/**
 * From https://api.weather.gov/alerts/types
 * @param event
 * @returns
 */
function EventNameToIcon(event: string): CustomIcons | BuiltinIcons | undefined {
	switch (event) {
		case "Extreme Fire Danger":
		case "Fire Warning":
		case "Fire Weather Watch":
			return "fire-symbolic";

		case "Flash Flood Statement":
		case "Flash Flood Warning":
		case "Flash Flood Watch":
		case "Flood Advisory":
		case "Flood Statement":
		case "Flood Warning":
		case "Flood Watch":
		case "Coastal Flood Advisory":
		case "Coastal Flood Statement":
		case "Coastal Flood Warning":
		case "Coastal Flood Watch":
		case "Lakeshore Flood Advisory":
		case "Lakeshore Flood Statement":
		case "Lakeshore Flood Warning":
		case "Lakeshore Flood Watch":
		case "Arroyo And Small Stream Flood Advisory":
		case "Small Stream Flood Advisory":
		case "Urban And Small Stream Flood Advisory":
			return "flood-symbolic";

		case "Ashfall Advisory":
		case "Ashfall Warning":
		case "Blowing Dust Advisory":
		case "Blowing Dust Warning":
		case "Dust Storm Warning":
		case "Dust Advisory":
			return "dust-symbolic";

		case "Blizzard Warning":
		case "Blizzard Watch":
		case "Extreme Cold Warning":
		case "Extreme Cold Watch":
		case "Freeze Warning":
		case "Freeze Watch":
		case "Freezing Fog Advisory":
		case "Freezing Rain Advisory":
		case "Freezing Spray Advisory":
		case "Frost Advisory":
		case "Hard Freeze Warning":
		case "Hard Freeze Watch":
		case "Winter Storm Warning":
		case "Winter Storm Watch":
		case "Winter Weather Advisory":
		case "Heavy Freezing Spray Warning":
		case "Heavy Freezing Spray Watch":
		case "Lake Effect Snow Advisory":
		case "Lake Effect Snow Warning":
		case "Lake Effect Snow Watch":
		case "Snow Squall Warning":
			return "snowflake-cold-symbolic";

		case "Dense Fog Advisory":
			return "fog-symbolic"

		case "Dense Smoke Advisory":
			return "smoke-symbolic";

		case "Brisk Wind Advisory":
		case "Extreme Wind Warning":
		case "High Wind Warning":
		case "High Wind Watch":
		case "Ice Storm Warning":
		case "Lake Wind Advisory":
		case "Wind Advisory":
		case "Wind Chill Advisory":
		case "Wind Chill Warning":
		case "Wind Chill Watch":
			return "strong-wind-symbolic";

		case "Excessive Heat Warning":
		case "Excessive Heat Watch":
		case "Heat Advisory":
			return "hot-symbolic";

		case "Gale Warning":
		case "Gale Watch":
			return "gale-warning-symbolic";

		case "Hurricane Force Wind Warning":
		case "Hurricane Force Wind Watch":
		case "Hurricane Local Statement":
		case "Hurricane Warning":
		case "Hurricane Watch":
		case "Typhoon Local Statement":
		case "Typhoon Warning":
		case "Typhoon Watch":
		case "Tropical Depression Local Statement":
		case "Tropical Storm Local Statement":
		case "Tropical Storm Warning":
		case "Tropical Storm Watch":
			return "hurricane-symbolic";

		case "Severe Thunderstorm Warning":
		case "Severe Thunderstorm Watch":
		case "Severe Weather Statement":
		case "Storm Surge Warning":
		case "Storm Surge Watch":
		case "Storm Warning":
		case "Storm Watch":
			return "lightning-symbolic";

		case "Tornado Warning":
		case "Tornado Watch":
			return "tornado-symbolic";

		case "Tsunami Advisory":
		case "Tsunami Warning":
		case "Tsunami Watch":
			return "tsunami-symbolic";

		case "Volcano Warning":
			return "volcano-symbolic";

		case "Earthquake Warning":
		case "Special Marine Warning":
		case "Special Weather Statement":
		case "Law Enforcement Warning":
		case "Local Area Emergency":
		case "Low Water Advisory":
		case "Marine Weather Statement":
		case "Nuclear Power Plant Warning":
		case "Radiological Hazard Warning":
		case "Hazardous Weather Outlook":
		case "Hazardous Seas Warning":
		case "Hazardous Seas Watch":
		case "Shelter In Place Warning":
		case "Short Term Forecast":
		case "Red Flag Warning":
		case "Rip Current Statement":
		case "Small Craft Advisory":
		case "Small Craft Advisory For Hazardous Seas":
		case "Small Craft Advisory For Rough Bar":
		case "Small Craft Advisory For Winds":
		case "High Surf Advisory":
		case "High Surf Warning":
		case "Hydrologic Advisory":
		case "Hydrologic Outlook":
		case "Hazardous Materials Warning":
		case "Evacuation - Immediate":
		case "Avalanche Advisory":
		case "Avalanche Warning":
		case "Avalanche Watch":
		case "Child Abduction Emergency":
		case "Civil Danger Warning":
		case "Civil Emergency Message":
		case "Beach Hazards Statement":
		case "911 Telephone Outage Emergency":
		case "Administrative Message":
		case "Air Quality Alert":
		case "Air Stagnation Advisory":
		case "Test":
		default:
			return undefined;
	}
}