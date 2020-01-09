class IpApi {
    constructor(_app) {
        this.query = "https://ipapi.co/json";
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
        if (json.error) {
            this.HandleErrorResponse(json);
            return null;
        }
        return this.ParseInformation(json);
    }
    ;
    ParseInformation(json) {
        try {
            let result = {
                lat: json.latitude,
                lon: json.longitude,
                city: json.city,
                country: json.country,
                timeZone: json.timezone
            };
            this.app.log.Debug("Location obtained:" + json.latitude + "," + json.longitude);
            this.app.log.Debug("Location setting is now: " + this.app._location);
            return result;
        }
        catch (e) {
            this.app.log.Error("IPapi parsing error: " + e);
            this.app.HandleError({ type: "hard", detail: "no location", service: "ipapi", message: _("Could not obtain location") });
            return null;
        }
    }
    ;
    HandleErrorResponse(json) {
        this.app.HandleError({ type: "hard", detail: "bad api response", message: _("Location Service responded with errors, please see the logs in Looking Glass"), service: "ipapi" });
        this.app.log.Error("IpApi Responds with Error: " + json.reason);
    }
    ;
}
;
