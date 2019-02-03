
//////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////
///////////                                       ////////////
///////////                  IpApi                ////////////
///////////                                       ////////////
//////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////

function IpApi(app) {
    this.query = "https://ipapi.co/json";

    this.GetLocation = async function() {
        let json;
        try {
            json = await app.LoadJsonAsync(this.query);
            if (json == null) {                         // Bad response
                app.showError(app.errMsg.label.service, app.errMsg.desc.noResponse);
                return false;
            }
        }
        catch(e) {
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

    this.ParseInformation = function(json) {
        try {
            let loc = json.latitude + "," + json.longitude;
            //app._location == (json.latitude + "," + json.longitude);
            app.settings.setValue('location', loc);
            app.weather.location.timeZone = json.timezone;
            app.weather.location.city = json.city;
            app.weather.location.country = json.country;
            app.log.Print("Location obtained");
            app.log.Debug("Location:" + json.latitude + "," + json.longitude);
            app.log.Debug("Location setting is now: " + app._location);
            return true;
        }
        catch(e) {
            app.log.Error("IPapi parsing error: " + e);
            app.showError(app.errMsg.label.generic, app.errMsg.desc.cantGetLoc);
            return false;
        }
    };

    this.HandleErrorResponse = function(json) {
        app.log.Error("IpApi error response: " + json.reason);       
    };
};


/*

Half sanitized example payload, courtesy of gr3q
{   
    "ip": "8.8.8.8",
    "city": "Cambridge",
    "region": "England",
    "region_code": "ENG",
    "country": "GB",
    "country_name": "United Kingdom",
    "continent_code": "EU",
    "in_eu": true,
    "postal": "XX0",
    "latitude": 52.2333,
    "longitude": 0.15,
    "timezone": "Europe/London",
    "utc_offset": "+0000",
    "country_calling_code": "+44",
    "currency": "GBP",
    "languages": "en-GB,cy-GB,gd",
    "asn": "AS5089",
    "org": "Virgin Media Limited"
}

*/