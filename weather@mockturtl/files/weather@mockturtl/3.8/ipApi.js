"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IpApi = void 0;
const services_1 = require("./services");
const utils_1 = require("./utils");
class IpApi {
    constructor(_app) {
        this.query = "http://ip-api.com/json/?fields=status,message,country,countryCode,city,lat,lon,timezone,mobile,query";
        this.app = _app;
    }
    async GetLocation() {
        let json;
        try {
            json = await this.app.LoadJsonAsync(this.query);
        }
        catch (e) {
            this.app.HandleHTTPError("ipapi", e, this.app);
            return null;
        }
        if (!json) {
            this.app.HandleError({ type: "soft", detail: "no api response" });
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
                mobile: json.mobile,
                entryText: json.lat + "," + json.lon,
                locationSource: "ip-api"
            };
            services_1.Logger.Debug("Location obtained:" + json.lat + "," + json.lon);
            return result;
        }
        catch (e) {
            services_1.Logger.Error("ip-api parsing error: " + e);
            this.app.HandleError({ type: "hard", detail: "no location", service: "ipapi", message: utils_1._("Could not obtain location") });
            return null;
        }
    }
    ;
    HandleErrorResponse(json) {
        this.app.HandleError({ type: "hard", detail: "bad api response", message: utils_1._("Location Service responded with errors, please see the logs in Looking Glass"), service: "ipapi" });
        services_1.Logger.Error("ip-api responds with Error: " + json.reason);
    }
    ;
}
exports.IpApi = IpApi;
;
