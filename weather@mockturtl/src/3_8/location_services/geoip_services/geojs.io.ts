import { HttpLib } from "../../lib/httpLib";
import { Logger } from "../../lib/services/logger";
import type { WeatherApplet } from "../../main";
import type { LocationServiceResult } from "../../types";
import { _ } from "../../utils";
import type { GeoIP } from "./base";

/**
 * https://www.geojs.io/docs/v1/endpoints/geo/
 */
export class GeoJS implements GeoIP {
	private readonly query = "https://get.geojs.io/v1/ip/geo.json";
	private app: WeatherApplet;

	constructor(_app: WeatherApplet) {
		this.app = _app;
	}

	public async GetLocation(cancellable: imports.gi.Gio.Cancellable): Promise<LocationServiceResult | null> {
		const json = await HttpLib.Instance.LoadJsonSimple<GeoJsPayload>({ url: this.query, cancellable });

		if (!json) {
			return null;
		}

		// if (json.status != "success") {
		// 	this.HandleErrorResponse(json);
		// 	return null;
		// }

		return this.ParseInformation(json);

	};

	private ParseInformation(json: GeoJsPayload): LocationServiceResult | null {
		try {
			const lat = Number.parseFloat(json.latitude);
			const lon = Number.parseFloat(json.longitude);
			if (Number.isNaN(lat) || Number.isNaN(lon)) {
				this.HandleErrorResponse(json);
				return null;
			}

			const result: LocationServiceResult = {
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
			if (e instanceof Error)
				Logger.Error("ip-api parsing error: " + e.message, e);
			this.app.ShowError({ type: "hard", detail: "no location", service: "ipapi", message: _("Could not obtain location") });
			return null;
		}
	};

	HandleErrorResponse(json: unknown): void {
		this.app.ShowError({ type: "hard", detail: "bad api response", message: _("Location Service responded with errors, please see the logs in Looking Glass"), service: "ipapi" })
		Logger.Error("geojs.io responded with data: " + JSON.stringify(json));
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