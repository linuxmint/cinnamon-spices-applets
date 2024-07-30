import { Logger } from "../../../lib/services/logger";
import { _ } from "../../../utils";
import type { AlertData, AlertLevel, CustomIcons } from "../../../weather-data";

export interface SwissMeteoWarningLink {
	text: string;
	url: string;
}

export interface SwissMeteoWarning {
	warnType: number;
	/**
	 * - 1: little to no danger
	 * - 2: moderate danger
	 * - 3: significant danger
	 * - 4: high danger
	 * - 5: very high danger
	 */
	warnLevel: number;
	text: string;
	/**
	 * Unix timestamp in milliseconds
	 */
	validFrom: number;
	/**
	 * Unix timestamp in milliseconds
	 */
	validTo?: number;
	ordering: string;
	htmlText: string;
	outlook: boolean;
	links: SwissMeteoWarningLink[];
}

export function SwissMeteoWarningToAlertData(warning: SwissMeteoWarning): AlertData {
	return {
		level: SwissMeteoWarningLevelToAlertLevel(warning.warnLevel),
		title: SwissMeteoWarningTypeToTitle(warning.warnType),
		description: warning.text,
		icon: SwissMeteoWarningTypeToIcon(warning.warnType),
		sender_name: "Swiss Meteo",
	};
}

export function SwissMeteoWarningLevelToAlertLevel(level: number): AlertLevel {
	switch (level) {
		case 1:
			return "unknown";
		case 2:
			return "minor";
		case 3:
			return "moderate";
		case 4:
			return "severe";
		case 5:
			return "extreme";
		default:
			return "unknown";
	}
}

export function SwissMeteoWarningTypeToIcon(type: number): CustomIcons | undefined {
	switch (type) {
		// Wind
		case 0:
			return "strong-wind-symbolic";
		// Thunderstorms
		case 1:
			return "lightning-symbolic";
		// Rain
		case 2:
			return "raindrops-symbolic";
		// Snow
		case 3:
			return "snowflake-cold-symbolic";
		// Slippery roads
		case 4:
			return undefined;
		// Frost
		case 5:
			return "snowflake-cold-symbolic";
		// Mass movements
		case 6:
			return undefined;
		// Heat
		case 7:
			return "hot-symbolic";
		// Avalanches
		case 8:
			return undefined;
		// Earthquakes
		case 9:
			return "earthquake-symbolic";
		// ForestFire
		case 10:
			return "fire-symbolic";
		// Floods
		case 11:
			return "flood-symbolic";
		default:
			return undefined;
	}
}

export function SwissMeteoWarningTypeToTitle(type: number): string {
	switch (type) {
		// Wind
		case 0:
			return _("Wind Warning");
		// Thunderstorms
		case 1:
			return _("Thunderstorm Warning");
		// Rain
		case 2:
			return _("Rain Warning");
		// Snow
		case 3:
			return _("Snow Warning");
		// Slippery roads
		case 4:
			return _("Slippery Roads Warning");
		// Frost
		case 5:
			return _("Frost Warning");
		// Mass movements
		case 6:
			return _("Mass Movements Warning");
		// Heat
		case 7:
			return _("Heat Warning");
		// Avalanches
		case 8:
			return _("Avalanche Warning");
		// Earthquakes
		case 9:
			return _("Earthquake Warning");
		// ForestFire
		case 10:
			return _("Forest Fire Warning");
		// Floods
		case 11:
			return _("Flood Warning");
		default:
			Logger.Error("Unknown warning type", type);
			return "";
	}
}