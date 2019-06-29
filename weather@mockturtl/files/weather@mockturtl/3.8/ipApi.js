class IpApi {
    constructor(_app) {
        this.query = "https://ipapi.co/json";
        this.app = _app;
    }
    async GetLocation() {
        let json;
        try {
            json = await this.app.LoadJsonAsync(this.query);
            if (json == null) {
                this.app.showError(this.app.errMsg.label.service, this.app.errMsg.desc.noResponse);
                return false;
            }
        }
        catch (e) {
            this.app.log.Error("IpApi service error: " + e);
            this.app.showError(this.app.errMsg.label.generic, this.app.errMsg.desc.cantGetLoc);
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
            this.app.showError(this.app.errMsg.label.generic, this.app.errMsg.desc.cantGetLoc);
            return false;
        }
    }
    ;
    HandleErrorResponse(json) {
        this.app.log.Error("IpApi error response: " + json.reason);
    }
    ;
}
;
