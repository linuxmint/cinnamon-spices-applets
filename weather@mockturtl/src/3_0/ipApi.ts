//////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////
///////////                                       ////////////
///////////                  IpApi                ////////////
///////////                                       ////////////
//////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////

class IpApi {
    query = "http://ip-api.com/json/?fields=status,message,country,countryCode,city,lat,lon,timezone,mobile,query";
    app: WeatherApplet;


    constructor(_app: WeatherApplet) {
        this.app = _app;
    }

    public async GetLocation(): Promise<LocationData> {
        let json: IpApiPayload;
        try {
            json = await this.app.LoadJsonAsync(this.query);
        }
        catch (e) {
            this.app.HandleHTTPError("ipapi", e, this.app);
            return null;
        }

        if (!json) {                         // Bad response
            this.app.HandleError({ type: "soft", detail: "no api response" });
            return null;
        }

        if (json.status != "success") {
            this.HandleErrorResponse(json);
            return null;
        }

        return this.ParseInformation(json);

    };

    private ParseInformation(json: IpApiPayload): LocationData {
        try {
            let result: LocationData = {
                lat: json.lat,
                lon: json.lon,
                city: json.city,
                country: json.country,
                timeZone: json.timezone,
                mobile: json.mobile,
                entryText: json.lat + "," + json.lon,
                locationSource: "ip-api"
            }
            this.app.log.Debug("Location obtained:" + json.lat + "," + json.lon);
            return result;
        }
        catch (e) {
            this.app.log.Error("ip-api parsing error: " + e);
            this.app.HandleError({ type: "hard", detail: "no location", service: "ipapi", message: _("Could not obtain location") });
            return null;
        }
    };

    HandleErrorResponse(json: any): void {
        this.app.HandleError({ type: "hard", detail: "bad api response", message: _("Location Service responded with errors, please see the logs in Looking Glass"), service: "ipapi" })
        this.app.log.Error("ip-api responds with Error: " + json.reason);
    };
};

interface IpApiPayload {
    status: ipapiStatus;
    country: string;
    countryCode: string;
    region?: string;
    regionName?: string;
    city: string;
    zip?: string;
    lat: number;
    lon: number;
    timezone: string;
    isp?: string;
    org?: string;
    as?: string;
    query?: string;
    mobile: boolean;
    /** exists on error */
    message?: ipapiMessage;
}

type ipapiStatus = "success" | "fail";
type ipapiMessage = "private ranger" | "reserved range" | "invalid query";