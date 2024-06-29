import { HttpLib } from "../../lib/httpLib";
import type { AlertData, AlertLevel, BuiltinIcons, CustomIcons } from "../../weather-data";

interface DeutscherWetterdienstAlert {
	id: number;
	alert_id: string;
	status: "actual" | "test";
	/**
	 * ISO 8601 date and time string.
	 */
	effective: string;
	/**
	 * ISO 8601 date and time string.
	 */
	onset: string;
	/**
	 * ISO 8601 date and time string.
	 */
	expires: string | null;
	category: "met" | "health" | null;
	response_type: "prepare" | "allclear" | "none" | "monitor" | null;
	urgency: "immediate" | "future" | null;
	severity: "minor" | "moderate" | "severe" | "extreme" | null;
	certainty: "observed" | "likely" | null;
	event_code: number | null;
	event_en: string | null;
	event_de: string | null;
	headline_en: string;
	headline_de: string;
	description_en: string;
	description_de: string;
	instruction_en: string | null;
	instruction_de: string | null;
}

interface DeutscherWetterdienstAlertsResponse {
	/**
	 * The alerts.
	 */
	alerts: DeutscherWetterdienstAlert[];
}

export async function GetDeutscherWetterdienstAlerts(cancellable: imports.gi.Gio.Cancellable, lat: number, lon: number): Promise<AlertData[] | null> {
	const response = await HttpLib.Instance.LoadJsonSimple<DeutscherWetterdienstAlertsResponse>({
		url: "https://api.brightsky.dev/alerts",
		cancellable: cancellable,
		params: {
			lat: lat,
			lon: lon,
		}
	})

	if (response === null) {
		return null;
	}

	const result: AlertData[] = [];
	for (const alert of response.alerts) {
		result.push({
			title: alert.headline_de,
			description: `${alert.status == "test" ? "{TEST} " : ""}${alert.description_de}\n\n${alert.instruction_de ?? ""}`,
			level: LevelToAlertLevel(alert.severity),
			sender_name: "Deutscher Wetterdienst",
			icon: EventCodeToIcon(alert.event_code),
		});
	}


	return result;
}

function LevelToAlertLevel(level: DeutscherWetterdienstAlert["severity"]): AlertLevel {
	if (level == null)
		return "unknown";

	return level;
}

/**
 * Based on https://www.dwd.de/DE/leistungen/opendata/help/warnungen/warning_codes_pdf.pdf;jsessionid=C6F9EB849FA355953859C85281FD9476.live21062?__blob=publicationFile&v=6
 * @param code
 * @returns
 */
function EventCodeToIcon(code: number | null): BuiltinIcons | CustomIcons | undefined {
	switch (code) {
		// Frost
		case 22:
			return "snowflake-cold-symbolic";
		// Various thunderstorm
		case 31:
		case 33:
		case 34:
		case 36:
		case 38:
		case 40:
		case 41:
		case 42:
		case 44:
		case 45:
		case 46:
		case 48:
		case 49:
		case 95:
		case 96:
			return "lightning-symbolic";
		// Wind
		case 51:
		case 52:
		case 53:
		case 54:
		case 55:
		case 56:
			return "strong-wind-symbolic";
		// Fog
		case 59:
			return undefined;
		// Rain
		case 61:
		case 62:
		case 63:
		case 64:
		case 65:
		case 66:
			return "raindrops-symbolic";
		// Snow
		case 70:
		case 71:
		case 72:
		case 73:
		case 74:
		case 75:
		case 76:
			return "snowflake-cold-symbolic";
		// Icing and freeze
		case 82:
		case 84:
		case 85:
		case 86:
			return "snowflake-cold-symbolic";
		// Thaw
		case 87:
		case 88:
		case 89:
			return undefined;
		// TEST
		case 98:
		case 99:
			return undefined;
		default:
			return undefined;
	}
}