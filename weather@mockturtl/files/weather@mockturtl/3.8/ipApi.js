function IpApi(app) {
    this.query = "https://ipapi.co/json";
    this.GetLocation = async function () {
        let json;
        try {
            json = await app.LoadJsonAsync(this.query);
            if (json == null) {
                app.showError(app.errMsg.label.service, app.errMsg.desc.noResponse);
                return false;
            }
        }
        catch (e) {
            app.log.Error("IpApi service error: " + e);
            app.showError(app.errMsg.label.generic, app.errMsg.desc.cantGetLoc);
            return false;
        }
        if (json.error) {
            this.HandleErrorResponse(json);
            return false;
        }
        return this.ParseInformation(json);
    };
    this.ParseInformation = function (json) {
        try {
            let loc = json.latitude + "," + json.longitude;
            app.settings.setValue('location', loc);
            app.weather.location.timeZone = json.timezone;
            app.weather.location.city = json.city;
            app.weather.location.country = json.country;
            app.log.Print("Location obtained");
            app.log.Debug("Location:" + json.latitude + "," + json.longitude);
            app.log.Debug("Location setting is now: " + app._location);
            return true;
        }
        catch (e) {
            app.log.Error("IPapi parsing error: " + e);
            app.showError(app.errMsg.label.generic, app.errMsg.desc.cantGetLoc);
            return false;
        }
    };
    this.HandleErrorResponse = function (json) {
        app.log.Error("IpApi error response: " + json.reason);
    };
}
;
