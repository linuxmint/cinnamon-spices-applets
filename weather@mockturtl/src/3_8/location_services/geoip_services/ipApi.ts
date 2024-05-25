//////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////
///////////                                       ////////////
///////////                  IpApi                ////////////
///////////                                       ////////////
//////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////

import { HttpLib } from "../../lib/httpLib";
import { Logger } from "../../lib/logger";
import type { WeatherApplet } from "../../main";
import type { LocationData } from "../../types";
import { _ } from "../../utils";
import type { GeoIP } from "./base";

/**
 * @deprecated Blocks Hungary and probably some other countries.
 */
export class IpApi implements GeoIP {
	query = "http://ip-api.com/json/?fields=status,message,country,countryCode,city,lat,lon,timezone,mobile,query";
	app: WeatherApplet;

	constructor(_app: WeatherApplet) {
		this.app = _app;
	}

	public async GetLocation(cancellable: imports.gi.Gio.Cancellable): Promise<LocationData | null> {
		const json = await HttpLib.Instance.LoadJsonSimple<IpApiPayload>({ url: this.query, cancellable });

		if (!json) {
			return null;
		}

		if (json.status != "success") {
			this.HandleErrorResponse(json);
			return null;
		}

		return this.ParseInformation(json);

	};

	private ParseInformation(json: IpApiPayload): LocationData | null {
		try {
			const result: LocationData = {
				lat: json.lat,
				lon: json.lon,
				city: json.city,
				country: json.country,
				timeZone: json.timezone,
				entryText: json.lat + "," + json.lon,
			}
			Logger.Debug("Location obtained:" + json.lat + "," + json.lon);
			return result;
		}
		catch (e) {
			Logger.Error("ip-api parsing error: " + e);
			this.app.ShowError({ type: "hard", detail: "no location", service: "ipapi", message: _("Could not obtain location") });
			return null;
		}
	};

	// TODO: add type for json
	// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
	HandleErrorResponse(json: any): void {
		this.app.ShowError({ type: "hard", detail: "bad api response", message: _("Location Service responded with errors, please see the logs in Looking Glass"), service: "ipapi" })
		Logger.Error("ip-api responds with Error: " + json.reason);
	};
}

interface IpApiPayload {
	status: ipapiStatus;
	country: string;
	countryCode: string;
	region?: string;
	regionName?: string;
	city: string;
	zip?: string;
	lat: number;
	lon: number;
	timezone: string;
	isp?: string;
	org?: string;
	as?: string;
	query?: string;
	mobile: boolean;
	/** exists on error */
	message?: ipapiMessage;
}

type ipapiStatus = "success" | "fail";
type ipapiMessage = "private ranger" | "reserved range" | "invalid query";