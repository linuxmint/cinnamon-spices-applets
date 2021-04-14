//////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////
///////////                                       ////////////
///////////                  IpApi                ////////////
///////////                                       ////////////
//////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////

import { Log } from "lib/logger";
import { WeatherApplet } from "main";
import { LocationData } from "types";
import { _ } from "utils";

export class IpApi {
	query = "http://ip-api.com/json/?fields=status,message,country,countryCode,city,lat,lon,timezone,mobile,query";
	app: WeatherApplet;

	constructor(_app: WeatherApplet) {
		this.app = _app;
	}

	public async GetLocation(): Promise<LocationData> {
		let json = await this.app.LoadJsonAsync<IpApiPayload>(this.query);

		if (!json) {
			return null;
		}

		if (json.status != "success") {
			this.HandleErrorResponse(json);
			return null;
		}

		return this.ParseInformation(json);

	};

	private ParseInformation(json: IpApiPayload): LocationData {
		try {
			let result: LocationData = {
				lat: json.lat,
				lon: json.lon,
				city: json.city,
				country: json.country,
				timeZone: json.timezone,
				entryText: json.lat + "," + json.lon,
			}
			Log.Instance.Debug("Location obtained:" + json.lat + "," + json.lon);
			return result;
		}
		catch (e) {
			Log.Instance.Error("ip-api parsing error: " + e);
			this.app.ShowError({ type: "hard", detail: "no location", service: "ipapi", message: _("Could not obtain location") });
			return null;
		}
	};

	HandleErrorResponse(json: any): void {
		this.app.ShowError({ type: "hard", detail: "bad api response", message: _("Location Service responded with errors, please see the logs in Looking Glass"), service: "ipapi" })
		Log.Instance.Error("ip-api responds with Error: " + json.reason);
	};
};

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