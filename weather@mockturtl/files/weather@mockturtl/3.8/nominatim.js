"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeoLocation = void 0;
const logger_1 = require("./logger");
const utils_1 = require("./utils");
class GeoLocation {
    constructor(app) {
        this.url = "https://nominatim.openstreetmap.org/search/";
        this.params = "?format=json&addressdetails=1&limit=1";
        this.App = null;
        this.cache = {};
        this.App = app;
    }
    async GetLocation(searchText) {
        var _a;
        try {
            searchText = searchText.trim();
            let cached = (_a = this.cache) === null || _a === void 0 ? void 0 : _a.searchText;
            if (cached != null) {
                logger_1.Log.Instance.Debug("Returning cached geolocation info for '" + searchText + "'.");
                return cached;
            }
            let locationData = await this.App.LoadJsonAsync(this.url + encodeURIComponent(searchText) + this.params);
            if (locationData == null)
                return null;
            if (locationData.length == 0) {
                this.App.ShowError({
                    type: "hard",
                    detail: "bad location format",
                    message: utils_1._("Could not find location based on address, please check if it's right")
                });
                return null;
            }
            logger_1.Log.Instance.Debug("Location is found, payload: " + JSON.stringify(locationData, null, 2));
            let result = {
                lat: parseFloat(locationData[0].lat),
                lon: parseFloat(locationData[0].lon),
                city: locationData[0].address.city || locationData[0].address.town,
                country: locationData[0].address.country,
                timeZone: null,
                entryText: this.BuildEntryText(locationData[0]),
            };
            this.cache[searchText] = result;
            return result;
        }
        catch (e) {
            logger_1.Log.Instance.Error("Could not geo locate, error: " + JSON.stringify(e, null, 2));
            this.App.ShowError({
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
