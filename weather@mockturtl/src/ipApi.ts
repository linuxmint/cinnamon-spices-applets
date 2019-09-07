//////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////
///////////                                       ////////////
///////////                  IpApi                ////////////
///////////                                       ////////////
//////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////

class IpApi {
    query = "https://ipapi.co/json";
    app: WeatherApplet;


    constructor(_app: WeatherApplet) {
        this.app = _app;
    }

    async GetLocation(): Promise<boolean> {
        let json: IpApiPayload;
        try {
            json = await this.app.LoadJsonAsync(this.query);
        }
        catch(e) {
            this.app.HandleHTTPError("ipapi", e, this.app);
            return false;
        }

        if (!json) {                         // Bad response
            this.app.HandleError({type: "soft", detail: "no api response"});
            return false;
        }

        if (json.error) {
            this.HandleErrorResponse(json);
            return false;
        }

        return this.ParseInformation(json);
        
    };

    ParseInformation(json: any): boolean {
        try {
            let loc = json.latitude + "," + json.longitude;
            //this.app._location == (json.latitude + "," + json.longitude);
            this.app.settings.setValue('location', loc);
            this.app.weather.location.timeZone = json.timezone;
            this.app.weather.location.city = json.city;
            this.app.weather.location.country = json.country;
            this.app.log.Print("Location obtained");
            this.app.log.Debug("Location:" + json.latitude + "," + json.longitude);
            this.app.log.Debug("Location setting is now: " + this.app._location);
            return true;
        }
        catch(e) {
            this.app.log.Error("IPapi parsing error: " + e);
            this.app.HandleError({type: "hard", detail: "no location", service: "ipapi", message: _("Could not obtain location")});
            return false;
        }
    };

    HandleErrorResponse(json: any): void {
        this.app.HandleError({type: "hard", detail: "bad api response", message: _("Location Service responded with errors, please see the logs in Looking Glass"), service: "ipapi"})
        this.app.log.Error("IpApi Responsd with Error: " + json.reason);       
    };
};

interface IpApiPayload {
    ip: string,
    city: string,
    region: string,
    region_code: string,
    country: string,
    country_name: string,
    continent_code: string,
    in_eu: boolean,
    postal: string,
    latitude: number,
    longitude: number,
    timezone: string,
    utc_offset: string,
    country_calling_code: string,
    currency: string,
    languages: string,
    asn: string,
    org: string,
    error?: string
}
/* Half sanitized example payload

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