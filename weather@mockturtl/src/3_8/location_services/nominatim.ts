import { DateTime } from "luxon";
import { Logger } from "../lib/services/logger";
import type { LocationData } from "../types";
import { _ } from "../utils";
import { HttpLib } from "../lib/httpLib";
import { ErrorHandler } from "../lib/services/error_handler";

interface NominatimLocationItem {
	place_id: number;
	licence: string;
	osm_type: string;
	osm_id: number;
	lat: string;
	lon: string;
	class: string;
	type: string;
	place_rank: number;
	importance: number;
	addresstype: string;
	name: string;
	display_name: string;
	address: {
		city?: string;
		town?: string;
		village?: string;
		state_district?: string;
		state: string;
		country: string;
		county?: string;
		country_code: string;
	}
	boundingbox: string[];
}

type NominatimResponse = NominatimLocationItem[];

/**
 * Nominatim communication interface
 */
export class GeoLocation {
	private url = "https://nominatim.openstreetmap.org/search";
	private params = "format=json&addressdetails=1&limit=1";
	private cache: LocationCache = {};

	/**
	 * Finds location and rebuilds entryText so it can be looked up again
	 * @param searchText
	 */
	public async GetLocation(searchText: string, cancellable: imports.gi.Gio.Cancellable): Promise<LocationData | null> {
		try {
			searchText = searchText.trim();
			const cached = this.cache?.searchText;
			if (cached != null) {
				Logger.Debug("Returning cached geolocation info for '" + searchText + "'.");
				return cached;
			}

			const locationData = await HttpLib.Instance.LoadJsonSimple<NominatimResponse>({
				url: `${this.url}?q=${searchText}&${this.params}`,
				cancellable
			});

			if (locationData == null)
				return null;

			if (locationData.length == 0) {
				ErrorHandler.Instance.PostError({
					type: "hard",
					detail: "bad location format",
					message: _("Could not find location based on address, please check if it's right")
				})
				return null;
			}
			Logger.Debug("Location is found, payload: " + JSON.stringify(locationData, null, 2));
			const result: LocationData = {
				lat: Number.parseFloat(locationData[0].lat),
				lon: Number.parseFloat(locationData[0].lon),
				city: locationData[0].address.city || locationData[0].address.town || locationData[0].address.village,
				country: locationData[0].address.country,
				timeZone: DateTime.now().zoneName,
				entryText: this.BuildEntryText(locationData[0]),
			}
			this.cache[searchText] = result;
			return result;
		}
		catch (e) {
			Logger.Error("Could not geo locate, error: " + JSON.stringify(e, null, 2));
			ErrorHandler.Instance.PostError({
				type: "soft",
				detail: "bad api response",
				message: _("Failed to call Geolocation API, see Looking Glass for errors.")
			})
			return null;
		}
	}

	/**
	 * Nominatim doesn't return any result if the State district is included in the search
	 * in specific case, we have to build it from the address details omitting specific
	 * keys
	 * @param locationData
	 */
	private BuildEntryText(locationData: NominatimLocationItem): string {
		if (locationData.address == null) return locationData.display_name;
		const entryText: string[] = [];
		let key: keyof typeof locationData.address;
		for (key in locationData.address) {
			if (key == "state_district")
				continue;
			if (key == "county")
				continue;
			if (key == "country_code")
				continue;
			const value = locationData.address[key];
			if (value == null)
				continue;

			entryText.push(value);
		}
		return entryText.join(", ");
	}
}

type LocationCache = {
	[key: string]: LocationData
}