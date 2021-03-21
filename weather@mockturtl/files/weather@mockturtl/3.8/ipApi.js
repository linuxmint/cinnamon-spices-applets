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
            this.app.log.Debug("Location obtained:" + json.lat + "," + json.lon);
            return result;
        }
        catch (e) {
            this.app.log.Error("ip-api parsing error: " + e);
            this.app.HandleError({ type: "hard", detail: "no location", service: "ipapi", message: _("Could not obtain location") });
            return null;
        }
    }
    ;
    HandleErrorResponse(json) {
        this.app.HandleError({ type: "hard", detail: "bad api response", message: _("Location Service responded with errors, please see the logs in Looking Glass"), service: "ipapi" });
        this.app.log.Error("ip-api responds with Error: " + json.reason);
    }
    ;
}
;
