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
            return false;
        }
        if (!json) {
            this.app.HandleError({ type: "soft", detail: "no api response" });
            return false;
        }
        if (json.error) {
            this.HandleErrorResponse(json);
            return false;
        }
        return this.ParseInformation(json);
    }
    ;
    ParseInformation(json) {
        try {
            let loc = json.latitude + "," + json.longitude;
            this.app.settings.setValue('location', loc);
            this.app.weather.location.timeZone = json.timezone;
            this.app.weather.location.city = json.city;
            this.app.weather.location.country = json.country;
            this.app.log.Print("Location obtained");
            this.app.log.Debug("Location:" + json.latitude + "," + json.longitude);
            this.app.log.Debug("Location setting is now: " + this.app._location);
            return true;
        }
        catch (e) {
            this.app.log.Error("IPapi parsing error: " + e);
            this.app.HandleError({ type: "hard", detail: "no location", service: "ipapi", message: _("Could not obtain location") });
            return false;
        }
    }
    ;
    HandleErrorResponse(json) {
        this.app.HandleError({ type: "hard", detail: "bad api response", message: _("Location Service responded with errors, please see the logs in Looking Glass"), service: "ipapi" });
        this.app.log.Error("IpApi Responsd with Error: " + json.reason);
    }
    ;
}
;
