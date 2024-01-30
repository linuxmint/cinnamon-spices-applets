import { Logger } from "../../lib/logger";
import { WeatherApplet } from "../../main";
import { LocationData } from "../../types";
import { _ } from "../../utils";
import { GeoIP } from "./base";


/**
 * https://docs.fedoraproject.org/en-US/infra/sysadmin_guide/geoip-city-wsgi/
 */
export class GeoIPFedora implements GeoIP {
	private readonly query = "https://geoip.fedoraproject.org/city";

	private app: WeatherApplet;

	constructor(app: WeatherApplet) {
		this.app = app;
	}

	public async GetLocation(): Promise<LocationData | null> {
		const json = await this.app.LoadJsonAsync<GeoIPFedoraPayload>(this.query);

		if (!json) {
			Logger.Info("geoip.fedoraproject didn't return any data");
			return null;
		}

		return this.ParseInformation(json);
	}

	private ParseInformation(json: GeoIPFedoraPayload): LocationData | null {
		if (json.latitude === null || json.longitude === null) {
			this.HandleErrorResponse(json);
			return null;
		}

		try {
			const result: LocationData = {
				lat: json.latitude,
				lon: json.longitude,
				city: json.city ?? undefined,
				country: json.country_name ?? undefined,
				timeZone: json.time_zone ?? this.app.config.UserTimezone,
				entryText: json.latitude + "," + json.longitude,
			}
			Logger.Debug("Location obtained: " + json.latitude + "," + json.longitude);
			return result;
		}
		catch (e) {
			Logger.Error("geoip.fedoraproject parsing error: " + e);
			this.app.ShowError({ type: "hard", detail: "no location", service: "ipapi", message: _("Could not obtain location") });
			return null;
		}
	};

	private HandleErrorResponse(json: any): void {
		this.app.ShowError({
			type: "hard",
			detail: "bad api response",
			message: _("Location Service couldn't find your location, please see the logs in Looking Glass"),
			service: "geoip.fedoreproject"
		})
	};
}

/**
 * Literally everything can be null here
 */
interface GeoIPFedoraPayload {
	ip: string;
	city: string | null;
	region: string | null;
	region_name: string | null;
	time_zone: string | null;
	latitude: number | null;
	longitude: number | null;
	metro_code: number | null;
	country_code: string | null;
	country_name: string | null;
	country_code3: string | null;
	postal_code: string | null;
	dma_code: number | null;
}