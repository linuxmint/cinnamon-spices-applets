import { Services } from "../config";
import { HttpError } from "../lib/httpLib";
import { WeatherApplet } from "../main";
import { LocationData, WeatherData } from "../types";
import { _ } from "../utils";
import { BaseProvider } from "./BaseProvider";

export class AccuWeather extends BaseProvider {
    public readonly needsApiKey: boolean = true;
    public readonly prettyName: string = _("AccuWeather");
    public readonly name: Services = "AccuWeather";
    public readonly maxForecastSupport: number = 5;
    public readonly maxHourlyForecastSupport: number = 12;
    public readonly website: string = "https://www.accuweather.com/";

    private readonly baseUrl = "http://dataservice.accuweather.com/";
    private readonly locSearchUrl = this.baseUrl + "locations/v1/cities/geoposition/search";
    private readonly currentConditionUrl = this.baseUrl + "currentconditions/v1/";
    private readonly dailyForecastUrl = this.baseUrl + "forecasts/v1/daily/5day/";
    private readonly hourlyForecastUrl = this.baseUrl + "forecasts/v1/hourly/12hour/";

    private readonly locationCache: {[key: string]: LocationPayload} = {};

    public async GetWeather(loc: LocationData): Promise<WeatherData | null> {
        const locationID = `${loc.lat},${loc.lon}`;
        let location: LocationPayload | null;
        if (this.locationCache[locationID] != null)
            location = this.locationCache[locationID];
        else
            location = await this.app.LoadJsonAsync<LocationPayload>(this.locSearchUrl, { q: locationID, details: false, /*language: "",*/ apikey: this.app.config.ApiKey }, this.HandleErrors);

        if (location == null) {
            /** Error, probably handled already */
            return null;
        }

        const [current, forecast, hourly] = await Promise.all([
            this.app.LoadJsonAsync<CurrentPayload>(this.currentConditionUrl + location.Key, { apikey: this.app.config.ApiKey, details: true, /*language: "",*/ }, this.HandleErrors),
            this.app.LoadJsonAsync<DailyPayload>(this.dailyForecastUrl + location.Key, { apikey: this.app.config.ApiKey, details: true, metric: true, /*language: "",*/ }, this.HandleErrors),
            this.app.LoadJsonAsync<HourlyPayload>(this.hourlyForecastUrl + location.Key, { apikey: this.app.config.ApiKey, details: true, metric: true, /*language: "",*/ }, this.HandleErrors)
        ])
        return null;
    }

    public constructor(app: WeatherApplet) {
        super(app);
    }

    private HandleErrors = (e: HttpError) => {
        return false;
    }
}

interface CurrentPayload {

}

interface DailyPayload {

}

interface HourlyPayload {

}

interface LocationPayload {
    /**  Version of the api.  */
    Version: number;
    /** Location key. */
    Key: string;
    /** Location type such as City, PostalCode, POI, or LatLong. */
    Type: string;
    /** Number applied to locations, set by factors such as population, political importance, and geographic size.  */
    Rank: number;
    /** Display name in local dialect set with language code in URL. Default is US English (en-us). */
    LocalizedName: string;
    /** Location name displayed in English. */
    EnglishName: string;
    /** Official postal code provided by our main location data provider for the requested location.  */
    PrimaryPostalCode: string;
    Region: {
        /** Unique region code for the location.  */
        ID: string;
        /** Display name in local dialect set with language code in URL. Default is US English (en-us). */
        LocalizedName: string;
        /** Location name displayed in English. */
        EnglishName: string;
    }
    Country: {
        /** Unique ISO or Microsoft Localization Code for the country.  */
        ID: string;
        /** Country name as displayed in the local dialect set with language code in the URL. Default is US English (en-us).  */
        LocalizedName: string;
        /** Country name displayed in English.  */
        EnglishName: string;
    }
    AdministrativeArea: {
        /** Unique Administrative Area ID for the Location. */
        ID: string;
        /** Administrative Area name displayed in the local dialect set with the language code in the URL. Default is US English (en-us). */
        LocalizedName: string;
        /** Administrative Area name displayed in English.  */
        EnglishName: string;
        /** An assigned number, describing the scale of the administrative subdivisions for countries. As the Level number increases, the scale of the subdivision will decrease. Numbers of 10 or greater are reserved for non-political boundaries and should be used independently. May be NULL.  */
        Level: number | null;
        /** Administrative Area type displayed in the local dialect set with the language code in the URL. Default is US English (en-us).  */
        LocalizedType: string;
        /** Administrative Area type displayed in English.  */
        EnglishType: string;
        /** Unique ISO or Microsoft Localization Code for the country that contains the AdministrativeArea.  */
        CountryID: string;
    }
    TimeZone: {
        /** Official abbreviation code for designated Time Zone.  */
        Code: string;
        /** Official name of designated Time Zone.  */
        Name: string;
        /** Number of hours offset from local GMT time.  */
        GmtOffset: number;
        /** Is the location currently observing Daylight Saving time.  */
        IsDaylightSaving: boolean;
        /** Next time that daylight saving time changes. May be NULL. */
        NextOffsetChange: string | null;
    }
    GeoPosition: {
        Latitude: number;
        Longitude: number;
        Elevation: {
            Metric: {
                /** Rounded value in specified units. May be NULL.  */
                Value: number | null;
                /** Type of unit. */
                Unit: string;
                /** Numeric ID associated with the type of unit being displayed. */
                UnitType: number;
            }
            Imperial: {
                /** Rounded value in specified units. May be NULL.  */
                Value: number | null;
                /** Type of unit. */
                Unit: string;
                /** Numeric ID associated with the type of unit being displayed. */
                UnitType: number;
            }
        }
    }
    /** "True" or "False" verification of whether a location is an "alias" or an alternative name or spelling for a requested location. */
    IsAlias: boolean;
    /** This object will be displayed only if the location is part of a larger metropolitan area or parent city. */
    ParentCity?: {
        /** Parent city location key. */
        Key: string;
        /** Parent city name as displayed in local dialect set with language code in the URL. If no language code is selected, the default is English. */
        LocalizedName: string;
        /** Parent city name displayed in English. */
        EnglishName: string;
    }
    SupplementalAdminAreas: {
        /** An assigned number, describing the scale of the administrative subdivisions for countries. As the Level number increases, the scale of the subdivision will decrease. Numbers of 10 or greater are reserved for non-political boundaries and should be used independently. May be NULL.  */
        Level: number | null;
        /** Administrative Area name as displayed in local dialect set with language code in the URL. Default is US English (en-us). */
        LocalizedName: string;
        /** Administrative Area name displayed in English. */
        EnglishName: string;
    }
    /** Array of location-specific products that are available for this location. Products include Alerts, PremiumAirQuality, AirQuality, MinuteCast, and ForecastConfidence. If no location-specific products are available, the array will be empty. */
    DataSets: any[];
    Details?: {
        /**  Location key. */
        Key: string;
        /** Weather station code of the location. */
        StationCode: string;
        /** GMT offset of the weather station. May be NULL. */
        StationGmtOffset: number | null;
        /** Temperature and precipitation band map code. */
        BandMap: string;
        /** Source of the climatology data for the location. */
        Climo: string;
        /** Local radar code associated with the location. */
        LocalRadar: string;
        /** Media region associated with the location. */
        MediaRegion: string;
        /** Metar station associated with the location. */
        Metar: string;
        /** City level radar code. */
        NXMetro: string;
        /** State Level radar code. */
        NXState: string;
        /** Reported population of the location. May be NULL. */
        Population: number | null;
        /** Primary warning county code. */
        PrimaryWarningCountyCode: string;
        /** Primary warning zone code. */
        PrimaryWarningZoneCode: string;
        /** Satellite associated with the location. */
        Satellite: string;
        /** Synoptic station associated with the location. */
        Synoptic: string;
        /** Marine station code. */
        MarineStation: string;
        /** GMT offset of the marine station. May be NULL. */
        MarineStationGMTOffset: number | null;
        /** Code that identifies city or region for video. */
        VideoCode: string;
        /** Unique number that indentifies a display partner for the Designated Marketing Area (DMA). Language dependent. May be NULL. */
        PartnerID: number | null;
        DMA: {
            /** Numeric Designated Marketing Area (DMA) identifier. */
            ID:	string;
            /** Name of the DMA in English. */
            EnglishName: string;
        }
        Sources: {
            /** Type of data the source provides. */
            DataType: string;
            /** Name of the data provider. */
            Source: string;
            /** ID associated with the source. Can be used as a key. */
            SourceId: number;
        }
        /** Optimized postal code, which may be the postal code of the location or a nearby metropolitan area. May be empty. */
        CanonicalPostalCode: string;
        /** Optimized locationKey, which may be the locationKey of the location or a nearby metropolitan area. May be empty. */
        CanonicalLocationKey: string;
        /** Country ID/location name/postal code or Country ID/location name/Location Key when the location does not have a postal code. For AccuWeather internal use only.  */
        LocationStem: string;
    }
}