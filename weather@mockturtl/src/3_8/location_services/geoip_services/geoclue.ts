import { DateTime } from "luxon";
import { Logger } from "../../lib/services/logger";
import type { LocationData } from "../../types";
import type { GeoIP } from "./base";

let GeoClueLib: typeof imports.gi.Geoclue | undefined = undefined;
let GeocodeGlib: typeof imports.gi.GeocodeGlib | undefined = undefined;

interface ExtendedLocationData extends LocationData {
	accuracy: imports.gi.Geoclue.AccuracyLevel;
	altitude: number;
}

export class GeoClue implements GeoIP {

	constructor() {
		try {
			GeoClueLib = imports.gi.Geoclue;
			GeocodeGlib = imports.gi.GeocodeGlib;
		}
		catch {
			Logger.Info("GeoClue2 not available, disabling it's use.");
		}
	}

	public async GetLocation(cancellable: imports.gi.Gio.Cancellable): Promise<LocationData | null> {
		if (GeoClueLib == null || GeocodeGlib == null) {
			return null;
		}

		const { AccuracyLevel, Simple: GeoClue } = GeoClueLib;
		const res = await new Promise<ExtendedLocationData | null>((resolve) => {
			Logger.Debug("Requesting coordinates from GeoClue");
			const start = DateTime.now();
			GeoClue.new_with_thresholds("weather_mockturtl", AccuracyLevel.EXACT, 0, 0, cancellable, (client, res) => {
				Logger.Debug(`Getting GeoClue coordinates finished, took ${start.diffNow().negate().as("seconds")} seconds.`);
				let simple: imports.gi.Geoclue.Simple | null = null;
				try {
					simple = GeoClue.new_finish(res);
					const clientObj = simple.get_client();
					if (clientObj == null || !clientObj.active) {
						Logger.Debug("GeoGlue Geolocation disabled, skipping");
						resolve(null);
						return;
					}
				}
				catch (e) {
					Logger.Error("Error while fetching GeoClue coordinates: ", e);
					resolve(null);
					return;
				}

				const loc = simple.get_location();
				if (loc == null) {
					Logger.Debug("GeoGlue coordinates is not known.");
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

				Logger.Debug(`GeoClue coordinates received ${JSON.stringify(result)}`);
				resolve(result);
				return;
			})
		});

		if (res == null) {
			return null;
		}

		const geoCodeRes = await this.GetGeoCodeData(cancellable, res.lat, res.lon, res.accuracy);
		if (geoCodeRes == null) {
			return res;
		}

		return {
			...res,
			...geoCodeRes,
		};
	};

	private async GetGeoCodeData(cancellable: imports.gi.Gio.Cancellable, lat: number, lon: number, accuracy: imports.gi.Geoclue.AccuracyLevel): Promise<Partial<LocationData> | null> {
		if (GeocodeGlib == null) {
			return null;
		}

		const geoCodeLoc = GeocodeGlib.Location.new(
			lat,
			lon,
			accuracy
		)

		const geoCodeRes = GeocodeGlib.Reverse.new_for_location(geoCodeLoc);
		// Gnome's default Nominatim instance is fucked, or Cinnamon misconfigures it but it's permanently not working.
		// I set to OpenStreetMaps instance because that works.
		geoCodeRes.set_backend(GeocodeGlib.Nominatim.new("https://nominatim.openstreetmap.org", "weatherapplet@gmail.com"))
		return new Promise<Partial<LocationData> | null>((resolve) => {
			Logger.Debug("Requesting location data from GeoCode");
			const start = DateTime.now();
				geoCodeRes.resolve_async(cancellable, (obj, res) => {
					Logger.Debug(`Getting GeoCode location data finished, took ${start.diffNow().negate().as("seconds")} seconds.`);
					let result: imports.gi.GeocodeGlib.Place | null = null;
					try {
						result = geoCodeRes.resolve_finish(res);
					}
					catch (e) {
						Logger.Error("Error while fetching GeoCode data: ", e);
						resolve(null);
						return;
					}

					if (result == null) {
						Logger.Debug("GeoCode location data not available.");
						resolve(null);
						return;
					}

					Logger.Debug(`GeoCode location data received ${result.town}, ${result.country}`);
					resolve({
						city: result.town,
						country: result.country,
					})
					return;
				});
			}
		)
	}
}