import { DateTime } from "luxon";
import { Logger } from "../lib/logger";
import { WeatherApplet } from "../main";
import { LocationData } from "../types";
import { _ } from "../utils";

/**
 * Nominatim communication interface
 */
export class GeoLocation {
	private url = "https://nominatim.openstreetmap.org/search/";
	private params = "?format=json&addressdetails=1&limit=1";
	private App: WeatherApplet;
	private cache: LocationCache = {};

	constructor(app: WeatherApplet) {
		this.App = app;
	}

	/**
	 * Finds location and rebuilds entryText so it can be looked up again
	 * @param searchText
	 */
	public async GetLocation(searchText: string): Promise<LocationData | null> {
		try {
			searchText = searchText.trim();
			const cached = this.cache?.searchText;
			if (cached != null) {
				Logger.Debug("Returning cached geolocation info for '" + searchText + "'.");
				return cached;
			}

			const locationData = await this.App.LoadJsonAsync<any>(this.url + encodeURIComponent(searchText) + this.params);
			if (locationData == null)
				return null;

			if (locationData.length == 0) {
				this.App.ShowError({
					type: "hard",
					detail: "bad location format",
					message: _("Could not find location based on address, please check if it's right")
				})
				return null;
			}
			Logger.Debug("Location is found, payload: " + JSON.stringify(locationData, null, 2));
			const result: LocationData = {
				lat: parseFloat(locationData[0].lat),
				lon: parseFloat(locationData[0].lon),
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
			this.App.ShowError({
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
	private BuildEntryText(locationData: any): string {
		if (locationData.address == null) return locationData.display_name;
		const entryText: string[] = [];
		for (const key in locationData.address) {
			if (key == "state_district") continue;
			if (key == "county") continue;
			if (key == "country_code") continue;
			entryText.push(locationData.address[key]);
		}
		return entryText.join(", ");
	}
}

type LocationCache = {
	[key: string]: LocationData
}