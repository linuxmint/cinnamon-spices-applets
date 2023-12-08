import { Logger } from "../../lib/logger";
import { WeatherApplet } from "../../main";
import { LocationData } from "../../types";
import { _ } from "../../utils";
import { GeoIP } from "./base";

/**
 * https://geoiplookup.io/api
 */
export class GeoIPLookupIO implements GeoIP {
	private readonly query = "https://json.geoiplookup.io/";

	private app: WeatherApplet;

	constructor(app: WeatherApplet) {
		this.app = app;
	}

	public async GetLocation(): Promise<LocationData | null> {
		const json = await this.app.LoadJsonAsync<GeoIPLookupPayload>(this.query);

		if (!json) {
			return null;
		}

		if (!json.success) {
			this.HandleErrorResponse(json);
			return null;
		}

		return this.ParseInformation(json);
	}

	private ParseInformation(json: GeoIPLookupPayload): LocationData | null {
		try {
			const result: LocationData = {
				lat: json.latitude,
				lon: json.longitude,
				city: json.city,
				country: json.country_name,
				timeZone: json.timezone_name,
				entryText: json.latitude + "," + json.longitude,
			}
			Logger.Debug("Location obtained:" + json.latitude + "," + json.longitude);
			return result;
		}
		catch (e) {
			Logger.Error("ip-api parsing error: " + e);
			this.app.ShowError({ type: "hard", detail: "no location", service: "ipapi", message: _("Could not obtain location") });
			return null;
		}
	};

	HandleErrorResponse(json: any): void {
		this.app.ShowError({ type: "hard", detail: "bad api response", message: _("Location Service responded with errors, please see the logs in Looking Glass"), service: "ipapi" })
		Logger.Error("ip-api responds with Error: " + json.reason);
	};
}

interface GeoIPLookupPayload {
	ip: string;
	isp: string;
	org: string;
	hostname: string;
	latitude: number;
	longitude: number;
	postal_code: string;
    city: string;
    country_code: string;
    country_name: string;
    continent_code: string;
    continent_name: string;
    region: string;
    district: string;
    timezone_name: string;
    connection_type: string;
    asn_number: number;
    asn_org: string;
    asn: string;
    currency_code: string;
    currency_name: string;
    success: boolean;
    premium: boolean;
}