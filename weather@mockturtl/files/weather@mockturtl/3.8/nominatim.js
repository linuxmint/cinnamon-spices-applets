"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeoLocation = void 0;
const services_1 = require("./services");
const utils_1 = require("./utils");
class GeoLocation {
    constructor(app) {
        this.url = "https://nominatim.openstreetmap.org/search/";
        this.params = "?format=json&addressdetails=1&limit=1";
        this.app = null;
        this.cache = {};
        this.app = app;
    }
    async GetLocation(searchText) {
        try {
            searchText = searchText.trim();
            let cached = utils_1.get([searchText], this.cache);
            if (cached != null) {
                services_1.Logger.Debug("Returning cached geolocation info for '" + searchText + "'.");
                return cached;
            }
            let locationData = await this.app.LoadJsonAsync(this.url + encodeURIComponent(searchText) + this.params);
            if (locationData.length == 0) {
                this.app.HandleError({
                    type: "hard",
                    detail: "bad location format",
                    message: utils_1._("Could not find location based on address, please check if it's right")
                });
                return null;
            }
            services_1.Logger.Debug("Location is found, payload: " + JSON.stringify(locationData, null, 2));
            let result = {
                lat: parseFloat(locationData[0].lat),
                lon: parseFloat(locationData[0].lon),
                city: locationData[0].address.city || locationData[0].address.town,
                country: locationData[0].address.country,
                timeZone: null,
                mobile: null,
                address_string: locationData[0].display_name,
                entryText: this.BuildEntryText(locationData[0]),
                locationSource: "address-search"
            };
            this.cache[searchText] = result;
            return result;
        }
        catch (e) {
            services_1.Logger.Error("Could not geolocate, error: " + JSON.stringify(e, null, 2));
            this.app.HandleError({
                type: "soft",
                detail: "bad api response",
                message: utils_1._("Failed to call Geolocation API, see Looking Glass for errors.")
            });
            return null;
        }
    }
    BuildEntryText(locationData) {
        if (locationData.address == null)
            return locationData.display_name;
        let entryText = [];
        for (let key in locationData.address) {
            if (key == "state_district")
                continue;
            if (key == "county")
                continue;
            if (key == "country_code")
                continue;
            entryText.push(locationData.address[key]);
        }
        return entryText.join(", ");
    }
}
exports.GeoLocation = GeoLocation;
