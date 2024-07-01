import { HttpLib } from "../../lib/httpLib";
import { ErrorHandler } from "../../lib/services/error_handler";
import { Logger } from "../../lib/services/logger";
import type { LocationServiceResult } from "../../types";
import { _ } from "../../utils";
import type { GeoIP } from "./base";


/**
 * https://docs.fedoraproject.org/en-US/infra/sysadmin_guide/geoip-city-wsgi/
 */
export class GeoIPFedora implements GeoIP {
	private readonly query = "https://geoip.fedoraproject.org/city";

	public async GetLocation(cancellable: imports.gi.Gio.Cancellable): Promise<LocationServiceResult | null> {
		const json = await HttpLib.Instance.LoadJsonSimple<GeoIPFedoraPayload>({ url: this.query, cancellable });

		if (!json) {
			Logger.Info("geoip.fedoraproject didn't return any data");
			return null;
		}

		return this.ParseInformation(json);
	}

	private ParseInformation(json: GeoIPFedoraPayload): LocationServiceResult | null {
		if (json.latitude === null || json.longitude === null) {
			ErrorHandler.Instance.PostError({
				type: "hard",
				detail: "bad api response",
				message: _("Location Service couldn't find your location, please see the logs in Looking Glass"),
				service: "geoip.fedoreproject"
			})
			return null;
		}

		try {
			const result: LocationServiceResult = {
				lat: json.latitude,
				lon: json.longitude,
				city: json.city ?? undefined,
				country: json.country_name ?? undefined,
				timeZone: json.time_zone ?? undefined,
				entryText: json.latitude + "," + json.longitude,
			}
			Logger.Debug("Location obtained: " + json.latitude + "," + json.longitude);
			return result;
		}
		catch (e) {
			if (e instanceof Error)
				Logger.Error("geoip.fedoraproject parsing error: " + e.message, e);
			ErrorHandler.Instance.PostError({ type: "hard", detail: "no location", service: "ipapi", message: _("Could not obtain location") });
			return null;
		}
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