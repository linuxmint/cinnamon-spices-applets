"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IpApi = void 0;
const logger_1 = require("./logger");
const utils_1 = require("./utils");
class IpApi {
    constructor(_app) {
        this.query = "http://ip-api.com/json/?fields=status,message,country,countryCode,city,lat,lon,timezone,mobile,query";
        this.app = _app;
    }
    async GetLocation() {
        let json = await this.app.LoadJsonAsync(this.query);
        if (!json) {
            return null;
        }
        if (json.status != "success") {
            this.HandleErrorResponse(json);
            return null;
        }
        return this.ParseInformation(json);
    }
    ;
    ParseInformation(json) {
        try {
            let result = {
                lat: json.lat,
                lon: json.lon,
                city: json.city,
                country: json.country,
                timeZone: json.timezone,
                entryText: json.lat + "," + json.lon,
            };
            logger_1.Log.Instance.Debug("Location obtained:" + json.lat + "," + json.lon);
            return result;
        }
        catch (e) {
            logger_1.Log.Instance.Error("ip-api parsing error: " + e);
            this.app.ShowError({ type: "hard", detail: "no location", service: "ipapi", message: utils_1._("Could not obtain location") });
            return null;
        }
    }
    ;
    HandleErrorResponse(json) {
        this.app.ShowError({ type: "hard", detail: "bad api response", message: utils_1._("Location Service responded with errors, please see the logs in Looking Glass"), service: "ipapi" });
        logger_1.Log.Instance.Error("ip-api responds with Error: " + json.reason);
    }
    ;
}
exports.IpApi = IpApi;
;
