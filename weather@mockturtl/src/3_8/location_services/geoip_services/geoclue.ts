import { Logger } from "../../lib/logger";
import { WeatherApplet } from "../../main";
import { LocationData } from "../../types";
import { _ } from "../../utils";
import { GeoIP } from "./base";
const GeoClueLib: typeof imports.gi.Geoclue | undefined = imports.gi.Geoclue;


export class GeoClue implements GeoIP {
	private app: WeatherApplet;
	private readonly notSupported: boolean = false;

	constructor(_app: WeatherApplet) {
		this.app = _app;
		if (GeoClueLib == null) {
			this.notSupported = true;
			return;
		}
	}

	public async GetLocation(): Promise<LocationData | null> {
		if (this.notSupported || GeoClueLib == null) {
			return null;
		}

		const { AccuracyLevel } = GeoClueLib;
		await new Promise<LocationData | null>((resolve, reject) => {
			GeoClueLib.Simple.new_with_thresholds("weather_mockturtl", AccuracyLevel.CITY, 5, 0, null, (client, res) => {
				const simple = GeoClueLib.Simple.new_finish(res);
				const clientObj = simple.get_client();
				if (clientObj == null || !clientObj.active) {
					resolve(null);
					return;
				}

				const loc = simple.get_location();
				if (loc == null) {
					resolve(null);
					return;
				}

				resolve({
					lat: loc.latitude,
					lon: loc.longitude,
					city: undefined,
					country: undefined,
					timeZone: "",
					entryText: loc.latitude + "," + loc.longitude,
				});
				return;
			})
		});

		return null;

	};

	HandleErrorResponse(json: any): void {
		this.app.ShowError({ type: "hard", detail: "bad api response", message: _("Location Service responded with errors, please see the logs in Looking Glass"), service: "ipapi" })
		Logger.Error("ip-api responds with Error: " + json.reason);
	};
}