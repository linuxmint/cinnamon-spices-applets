import { Logger } from "../../lib/logger";
import { WeatherApplet } from "../../main";
import { LocationData } from "../../types";
import { _ } from "../../utils";
import { GeoIP } from "./base";

/**
 * https://www.geojs.io/docs/v1/endpoints/geo/
 */
export class GeoJS implements GeoIP {
	private readonly query = "https://get.geojs.io/v1/ip/geo.json";
	private app: WeatherApplet;

	constructor(_app: WeatherApplet) {
		this.app = _app;
	}

	public async GetLocation(): Promise<LocationData | null> {
		const json = await this.app.LoadJsonAsync<GeoJsPayload>(this.query);

		if (!json) {
			return null;
		}

		// if (json.status != "success") {
		// 	this.HandleErrorResponse(json);
		// 	return null;
		// }

		return this.ParseInformation(json);

	};

	private ParseInformation(json: GeoJsPayload): LocationData | null {
		try {
			const lat = parseFloat(json.latitude);
			const lon = parseFloat(json.longitude);
			if (Number.isNaN(lat) || Number.isNaN(lon)) {
				this.HandleErrorResponse(json);
				return null;
			}

			const result: LocationData = {
				lat: lat,
				lon: lon,
				city: json.city,
				country: json.country,
				timeZone: json.timezone,
				entryText: lat + "," + lon,
			}
			Logger.Debug("Location obtained:" + lat + "," + lon);
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

interface GeoJsPayload {
	country: string;
	area_code: string;
	organization_name: string;
	country_code: string;
	country_code3: string;
	continent_code: string;
	region: string;
	latitude: string;
	longitude: string;
	ip: string;
	asn: number;
	timezone: string
	accuracy: number;
	organization: string;
	city: string;
}