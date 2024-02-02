import { Logger } from "../../lib/logger";
import { WeatherApplet } from "../../main";
import { LocationData } from "../../types";
import { _ } from "../../utils";
import { GeoIP } from "./base";

let GeoClueLib: typeof imports.gi.Geoclue | undefined = undefined;
let GeocodeGlib: typeof imports.gi.GeocodeGlib | undefined = undefined;

interface ExtendedLocationData extends LocationData {
	accuracy: imports.gi.Geoclue.AccuracyLevel;
	altitude: number;
}

export class GeoClue implements GeoIP {
	private app: WeatherApplet;

	constructor(_app: WeatherApplet) {
		this.app = _app;
		try {
			GeoClueLib = imports.gi.Geoclue;
			GeocodeGlib = imports.gi.GeocodeGlib;
		}
		catch (e) {
			Logger.Info("GeoClue2 not available, disabling it's use.");
		}
	}

	public async GetLocation(): Promise<LocationData | null> {
		if (GeoClueLib == null || GeocodeGlib == null) {
			return null;
		}

		const { AccuracyLevel, Simple: GeoClue } = GeoClueLib;
		const res = await new Promise<ExtendedLocationData | null>((resolve, reject) => {
			GeoClue.new_with_thresholds("weather_mockturtl", AccuracyLevel.EXACT, 0, 0, null, (client, res) => {
				const simple = GeoClue.new_finish(res);
				const clientObj = simple.get_client();
				if (clientObj == null || !clientObj.active) {
					Logger.Debug("GeoGlue2 Geolocation disabled, skipping");
					resolve(null);
					return;
				}

				const loc = simple.get_location();
				if (loc == null) {
					resolve(null);
					return;
				}

				const result: ExtendedLocationData = {
					lat: loc.latitude,
					lon: loc.longitude,
					city: undefined,
					country: undefined,
					timeZone: "",
					entryText: loc.latitude + "," + loc.longitude,
					altitude: loc.altitude,
					accuracy: loc.accuracy,
				}

				resolve(result);
			})
		});

		if (res == null) {
			return null;
		}

		const geoCodeRes = await this.GetGeoCodeData(res.lat, res.lon, res.accuracy);
		if (geoCodeRes == null) {
			return res;
		}

		return {
			...res,
			...geoCodeRes,
		};
	};

	private async GetGeoCodeData(lat: number, lon: number, accuracy: imports.gi.Geoclue.AccuracyLevel): Promise<Partial<LocationData> | null> {
		if (GeocodeGlib == null) {
			return null;
		}

		const geoCodeLoc = GeocodeGlib.Location.new(
			lat,
			lon,
			accuracy
		)

		const geoCodeRes = GeocodeGlib.Reverse.new_for_location(geoCodeLoc);
		return new Promise<Partial<LocationData> | null>((resolve, reject) => {
			geoCodeRes.resolve_async(null, (obj, res) => {
				const result = geoCodeRes.resolve_finish(res);
				if (result == null) {
					resolve(null);
					return;
				}

				resolve({
					city: result.town,
					country: result.country,
				})
			});
		})
	}
}