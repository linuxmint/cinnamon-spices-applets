import { DateTime } from "luxon";
import { Services } from "../config";
import { ErrorResponse, HttpError } from "../lib/httpLib";
import { WeatherApplet } from "../main";
import { Condition, ForecastData, HourlyForecastData, LocationData, Precipitation, WeatherData } from "../types";
import { CelsiusToKelvin, KPHtoMPS, _ } from "../utils";
import { BaseProvider } from "./BaseProvider";

export class AccuWeather extends BaseProvider {
    public readonly needsApiKey: boolean = true;
    public readonly prettyName: string = _("AccuWeather");
    public readonly name: Services = "AccuWeather";
    public readonly maxForecastSupport: number = 12;
    public readonly maxHourlyForecastSupport: number = 120;
    public readonly website: string = "https://www.accuweather.com/";
    public readonly supportHourlyPrecipChance = true;
	public readonly supportHourlyPrecipVolume = true;

    // Quota
    private remainingQuota: number | null = null;
    private tier: "free" | "standard" | "prime" | "elite" = "free";

    public get remainingCalls(): number | null {
		return this.remainingQuota == null ? null : Math.floor(this.remainingQuota / 3);
	};

    private readonly baseUrl = "http://dataservice.accuweather.com/";
    private readonly locSearchUrl = this.baseUrl + "locations/v1/cities/geoposition/search";
    private readonly currentConditionUrl = this.baseUrl + "currentconditions/v1/";

    /** Based on https://developer.accuweather.com/packages */
    private get dailyForecastUrl() {
        let url = this.baseUrl + "forecasts/v1/daily/";
        if (this.tier == "free" || this.tier == "standard")
            url+= "5day/";
        else if (this.tier == "prime")
            url+= "10day/";
        else
            url+= "10day/";

        return url;
    }

    /** Based on https://developer.accuweather.com/packages */
    private get hourlyForecastUrl() {
        let url = this.baseUrl + "forecasts/v1/hourly/";
        if (this.tier == "free" || this.tier == "standard")
            url+= "12hour/";
        else if (this.tier == "prime")
            url+= "72hour/";
        else
            url+= "120hour"

        return url;
    }

    private readonly locationCache: {[key: string]: LocationPayload} = {};

    public async GetWeather(loc: LocationData): Promise<WeatherData | null> {
        const locationID = `${loc.lat},${loc.lon}`;
        const userLocale = this.app.config.currentLocale?.toLowerCase() ?? "en-us";
        const locale = this.app.config._translateCondition ? userLocale : "en-us";

        let location: LocationPayload | null;
        if (this.locationCache[locationID] != null)
            location = this.locationCache[locationID];
        else
            location = await this.app.LoadJsonAsync<LocationPayload>(this.locSearchUrl, { q: locationID, details: true, language: userLocale, apikey: this.app.config.ApiKey }, this.HandleErrors);

        if (location == null) {
            /** Error, probably handled already */
            return null;
        }

        const [current, forecast, hourly] = await Promise.all([
            this.app.LoadJsonAsyncWithDetails<CurrentPayload[]>(this.currentConditionUrl + location.Key, { apikey: this.app.config.ApiKey, details: true, language: locale, }, this.HandleErrors),
            this.app.LoadJsonAsyncWithDetails<DailyPayload>(this.dailyForecastUrl + location.Key, { apikey: this.app.config.ApiKey, details: true, metric: true, language: locale, }, this.HandleErrors),
            this.app.LoadJsonAsyncWithDetails<HourlyPayload[]>(this.hourlyForecastUrl + location.Key, { apikey: this.app.config.ApiKey, details: true, metric: true, language: locale, }, this.HandleErrors)
        ])

        if (!current.Success || !forecast.Success || !hourly.Success)
            return null;

        this.remainingQuota = Math.min(
            parseInt(current.ResponseHeaders["RateLimit-Remaining"]),
            parseInt(forecast.ResponseHeaders["RateLimit-Remaining"]),
            parseInt(hourly.ResponseHeaders["RateLimit-Remaining"])
        );

        // Base
        this.SetTier(parseInt(current.ResponseHeaders["RateLimit-Limit"]));
        return this.ParseWeather(current.Data[0], forecast.Data, hourly.Data, location);
    }

    public constructor(app: WeatherApplet) {
        super(app);
    }

    /**
     * Sets tier, based on https://developer.accuweather.com/packages
     */
    private SetTier(limit: number): void {
        if (limit > 1800000)
            this.tier = "elite";
        else if (limit > 225000)
            this.tier = "prime";
        else if (limit > 50)
            this.tier = "standard";
        else
            this.tier = "free";
    }

    private ParseWeather(current: CurrentPayload, daily: DailyPayload, hourly: HourlyPayload[], loc: LocationPayload): WeatherData {
        return {
            date: DateTime.fromISO(current.LocalObservationDateTime),
            coord: {
                lat: loc.GeoPosition.Latitude,
                lon: loc.GeoPosition.Longitude
            },
            dewPoint: CelsiusToKelvin(current.DewPoint?.Metric?.Value),
            humidity: current.RelativeHumidity,
            pressure: current.Pressure?.Metric?.Value,
            location: {
                city: loc.LocalizedName,
                country: loc.Country.LocalizedName,
                timeZone: loc.TimeZone.Name,
                tzOffset: loc.TimeZone.GmtOffset,
            },
            sunrise: DateTime.fromISO(daily.DailyForecasts[0].Sun.Rise),
            sunset: DateTime.fromISO(daily.DailyForecasts[0].Sun.Set),
            temperature: CelsiusToKelvin(current.Temperature?.Metric?.Value),
            wind: {
                degree: current.Wind?.Direction?.Degrees,
                speed: KPHtoMPS(current.Wind?.Speed?.Metric?.Value),
            },
            condition: {
                ...this.ResolveIcons(current.WeatherIcon, current.IsDayTime),
                main: current.WeatherText,
                description: current.WeatherText
            },
            hourlyForecasts: this.ParseHourly(hourly),
            forecasts: this.ParseDaily(daily)
        }
    }

    private ParseHourly(hourly: HourlyPayload[]): HourlyForecastData[] {
        const hours: HourlyForecastData[] = [];
        for (const hour of hourly) {
            let precipitation: Precipitation | undefined = undefined;
            if (hour.PrecipitationProbability ?? 0 > 0) {
                switch(hour.PrecipitationType!) {
                    case "Rain":
                        precipitation = {
                            type: "rain",
                            chance: hour.RainProbability!,
                            volume: hour?.Rain?.Value ?? undefined
                        }
                        break;
                    case "Snow":
                        precipitation = {
                            type: "snow",
                            chance: hour.SnowProbability!,
                            volume: hour?.Snow?.Value ?? undefined
                        }
                        break;
                    case "Ice":
                        precipitation = {
                            type: "ice pellets",
                            chance: hour.IceProbability!,
                            volume: hour?.Ice?.Value ?? undefined
                        }
                        break;
                }
            }

            hours.push({
                date: DateTime.fromISO(hour.DateTime),
                condition: {
                    ...this.ResolveIcons(hour.WeatherIcon, hour.IsDaylight),
                    main: hour.IconPhrase,
                    description: hour.IconPhrase
                },
                temp: CelsiusToKelvin(hour.Temperature.Value),
                precipitation: precipitation
            })
        }
        return hours;
    }

    private ParseDaily(daysPayload: DailyPayload): ForecastData[] {
        const days: ForecastData[] = [];
        for (const day of daysPayload.DailyForecasts) {
            days.push({
                date: DateTime.fromISO(day.Date),
                temp_max: CelsiusToKelvin(day.Temperature.Maximum.Value),
                temp_min: CelsiusToKelvin(day.Temperature.Minimum.Value),
                condition: {
                    ...this.ResolveIcons(day.Day.Icon, true),
                    main: day.Day.IconPhrase,
                    description: day.Day.ShortPhrase
                }
            })
        }

        return days;
    }

    private HandleErrors = (e: ErrorResponse) => {
        switch (e.ErrorData.code) {
            /** Request had bad syntax or the parameters supplied were invalid */
            case 400:
                this.app.ShowError({
                    type: "hard",
                    detail: "bad api response"
                })
                return true;
            /** Unauthorized. API authorization failed */
            case 401:
                this.app.ShowError({
                    type: "hard",
                    detail: "bad key",
                })
                return true;
            /** Unauthorized. You do not have permission to access this endpoint */
            case 403:
                this.app.ShowError({
                    type: "hard",
                    detail: "key blocked",
                })
                return true;
        }
        return false;
    }

    private ResolveIcons(icon: number | null, day: boolean): Omit<Condition, "main" | "description"> {
        switch(icon) {
            case 1:
                return {
                    customIcon: "alien-symbolic",
                    icons: []
                }
                case 1:
                    return {
                        customIcon: day ? "day-sunny-symbolic" : "night-clear-symbolic",
                        icons: [ day ? "weather-clear" : "weather-clear-night"]
                    }
                case 2:
                case 3:
                case 4:
                    return {
                        customIcon: day ? "day-cloudy-symbolic" : "night-alt-cloudy-symbolic",
                        icons: [ day ? "weather-few-clouds" : "weather-few-clouds-night" ]
                    }
                case 5:
                    return {
                        customIcon: day ? "day-fog-symbolic" : "night-fog-symbolic",
                        icons: [ day ? "weather-clear" : "weather-clear-night" ]
                    }
                case 6:
                    return {
                        customIcon: day ? "day-cloudy-symbolic" : "night-alt-cloudy-symbolic",
                        icons: day ? ["weather-clouds", "weather-few-clouds"] : [ "weather-clouds-night", "weather-few-clouds-night" ]
                    }
                case 7:
                case 8:
                    return {
                        customIcon: "cloud-symbolic",
                        icons: [ "weather-overcast" ]
                    }
                case 11:
                    return {
                        customIcon: "fog-symbolic",
                        icons: [ "weather-fog" ]
                    }
                case 12:
                    return {
                        customIcon: "rain-wind-symbolic",
                        icons: [ "weather-showers", "weather-rain", "weather-freezing-rain" ]
                    }
                case 13:
                case 14:
                    return {
                        customIcon: day ? "day-showers-symbolic" : "night-alt-showers-symbolic",
                        icons: day ? [ "weather-showers-scattered-day", "weather-showers-day", "weather-showers-scattered", "weather-showers" ] : [ "weather-showers-scattered-night", "weather-showers-night", "weather-showers-scattered", "weather-showers" ]
                    }
                case 15:
                    return {
                        customIcon: "thunderstorm-symbolic",
                        icons: [ "weather-storm" ]
                    }
                case 16:
                case 17:
                    return {
                        customIcon: day ? "day-thunderstorm-symbolic" : "night-alt-thunderstorm-symbolic",
                        icons: ["weather-storm"]
                    }
                case 18:
                    return {
                        customIcon: "rain-symbolic",
                        icons: [ "weather-rain", "weather-showers", "weather-freezing-rain" ]
                    }
                case 19:
                case 22:
                    return {
                        customIcon: "snow-symbolic",
                        icons: [ "weather-snow" ]
                    }
                case 20:
                case 21:
                case 23:
                    return {
                        customIcon: day ? "day-snow-symbolic" : "night-alt-snow-symbolic",
                        icons: day ? [ "weather-snow-day" , "weather-snow-scattered-day", "weather-snow" ] : [ "weather-snow-night" , "weather-snow-scattered-night", "weather-snow" ]
                    }
                case 24:
                    return {
                        customIcon: "snowflake-cold-symbolic",
                        icons: [ "weather-severe-alert" ]
                    }
                case 25:
                    return {
                        customIcon: "sleet-symbolic",
                        icons: [ "weather-freezing-rain", "weather-rain", "weather-showers" ]
                    }
                case 26:
                    return {
                        customIcon: "rain-symbolic",
                        icons: [ "weather-freezing-rain", "weather-rain", "weather-showers" ]
                    }
                case 29:
                    return {
                        customIcon: "rain-mix-symbolic",
                        icons: [ "weather-freezing-rain", "weather-rain", "weather-showers" ]
                    }
                case 30:
                    return {
                        customIcon: "hot-symbolic",
                        icons: [ "weather-severe-alert" ]
                    }
                case 31:
                    return {
                        customIcon: "snowflake-cold-symbolic",
                        icons: [ "weather-severe-alert" ]
                    }
                case 32:
                    return {
                        customIcon: "windy-symbolic",
                        icons: [ "weather-windy", "weather-breeze" ]
                    }
                //-------------------
                // Night icons
                case 33:
                    return {
                        customIcon: "night-clear-symbolic",
                        icons: [ "weather-clear-night" ]
                    }
                case 34:
                case 35:
                case 36:
                case 38:
                    return {
                        customIcon: "night-alt-cloudy-symbolic",
                        icons: [ "weather-few-clouds-night" ]
                    }
                case 37:
                    return {
                        customIcon: "night-fog-symbolic",
                        icons: [ "weather-few-clouds-night" ]
                    }
                case 39:
                case 40:
                    return {
                        customIcon: "night-alt-showers-symbolic",
                        icons: [ "weather-showers-scattered-night", "weather-showers-night", "weather-showers" ]
                    }
                case 41:
                case 42:
                    return {
                        customIcon: "night-alt-storm-showers-symbolic",
                        icons: [ "weather-storm" ]
                    }
                case 43:
                case 44:
                    return {
                        customIcon: "night-alt-snow-symbolic",
                        icons: [ "weather-snow-night", "weather-snow-scattered-night", "weather-snow" ]
                    }
            default:
                return {
                    customIcon: "refresh-symbolic",
                    icons: []
                }
        }
    }
}

interface GenericValue {
    /** Rounded value in specified units. May be NULL. */
    Value: number | null;
    /** Type of unit. */
    Unit: string;
    /** Numeric ID associated with the type of unit being displayed. */
    UnitType: number;
}

interface MetricImperialValues {
    Metric: GenericValue;
    Imperial: GenericValue;
}

interface WindDirectionInfo {
    /** Wind direction in azimuth degrees (for example, 180° indicates wind coming from the south). */
    Degrees: number;
    /** Direction abbreviation in the specified language. */
    Localized: string;
    /** Direction abbreviation in English. */
    English: string;
}

interface CurrentPayload {
    /** DateTime of the current observation, displayed in ISO8601 format. */
    LocalObservationDateTime: string;
    /** DateTime of the current observation, displayed as the number of seconds that have elapsed since January 1, 1970 (midnight UTC/GMT). */
    EpochTime: number;
    /** Phrase description of the current weather condition. Displayed in the language set with language code in URL. */
    WeatherText: string;
    /** Numeric value representing an image that displays the current condition described by WeatherText. May be NULL. */
    WeatherIcon: number | null;
    LocalSource: {
        /** Numeric identifier unique to the local data provider. This parameter is not shown if there is not local source information to display. */
        Id: number,
        /** Name of the local data provider, displayed in the language set with language code in URL, if available. Otherwise, Name is displayed in English or the language in which the name was provided. This parameter is not shown if there is no local source information to display. */
        Name: string;
        /** Weather code provided by the local data provider. This weather code allows the current condition to be matched to icons provided by the local data provider instead of AccuWeather icons. This parameter is not shown if there is no local source information to display. */
        WeatherCode: string;
    }
    /** Flag indicating the time of day (true=day, false=night) */
    IsDayTime: boolean;
    Temperature: MetricImperialValues;
    /** Patented AccuWeather RealFeel Temperature. Contains Metric and Imperial Values. */
    RealFeelTemperature: MetricImperialValues;
    /** Patented AccuWeather RealFeel Temperature in the shade. Contains Metric and Imperial Values. */
    RealFeelTemperatureShade: MetricImperialValues;
    /** Relative humidity. May be NULL. */
    RelativeHumidity: number | null;
    /** Dew point temperature. Contains Metric and Imperial Values. */
    DewPoint: MetricImperialValues;
    Wind: {
        Direction: {
            /** Wind direction in Azimuth degrees (e.g. 180 degrees is a wind coming from the south). May be NULL. */
            Degrees: number | null;
            /** Direction abbreviated in English. */
            English: string;
            /** Direction abbreviated in the language specified by language code in URL. */
            Localized: string;
        }
        /** Wind Speed. Contains Metric and Imperial Values. */
        Speed: MetricImperialValues;
    }
    WindGust: {
        /** Wind gust speed. Contains Metric and Imperial Values. */
        Speed: MetricImperialValues;
    }
    /** Measure of the strength of the ultraviolet radiation from the sun. May be NULL. */
    UVIndex: number | null;
    /** Text associated with the UVIndex. */
    UVIndexText: string;
    /** Visibility. Contains Metric and Imperial Values. */
    Visibility: MetricImperialValues;
    /** Cause of limited visibility. */
    ObstructionsToVisibility: string;
    /** Number representing the percentage of the sky that is covered by clouds. May be NULL. */
    CloudCover: number | null;
    /** Cloud ceiling. Contains Metric and Imperial Values. */
    Ceiling: MetricImperialValues;
    /** Atmospheric pressure. Contains Metric and Imperial Values. */
    Pressure: MetricImperialValues;
    PressureTendency: {
        /** Description of the pressure tendency in the language specified by language code in the URL. */
        LocalizedText: string;
        /** Pressure tendency code regardless of language. (F=falling, S=steady, R=rising) */
        Code: string;
    }
    /** Departure from the temperature observed 24 hours ago. Contains Metric and Imperial Values. */
    Past24HourTemperatureDeparture: MetricImperialValues;
    /** Perceived outdoor temperature caused by the combination of air temperature, relative humidity, and wind speed. Contains Metric and Imperial Values. */
    ApparentTemperature: MetricImperialValues;
    /** Perceived air temperature on exposed skin due to wind. Contains Metric and Imperial Values. */
    WindChillTemperature: MetricImperialValues;
    /** The temperature to which air may be cooled by evaporating water into it at constant pressure until it reaches saturation. Contains Metric and Imperial Values. */
    WetBulbTemperature: MetricImperialValues;
    /** Amount of precipitation (liquid water equivalent) that has fallen in the past hour. Contains Metric and Imperial Values. */
    Precip1hr: MetricImperialValues;
    PrecipitationSummary: {
        /** Deprecated. Please use the precipitation summary for a specific time span. */
        Precipitation: MetricImperialValues;
        /** The amount of precipitation (liquid equivalent) that has fallen in the past hour. Contains Metric and Imperial Values. */
        PastHour: MetricImperialValues;
        /** The amount of precipitation (liquid equivalent) that has fallen in the past 3 hours. Contains Metric and Imperial Values. */
        Past3Hours: MetricImperialValues;
        /** The amount of precipitation (liquid equivalent) that has fallen in the past 6 hours. Contains Metric and Imperial Values. */
        Past6Hours: MetricImperialValues;
        /** The amount of precipitation (liquid equivalent) that has fallen in the past 9 hours. Contains Metric and Imperial Values. */
        Past9Hours: MetricImperialValues;
        /** The amount of precipitation (liquid equivalent) that has fallen in the past 12 hours. Contains Metric and Imperial Values. */
        Past12Hours: MetricImperialValues;
        /** The amount of precipitation (liquid equivalent) that has fallen in the past 18 hours. Contains Metric and Imperial Values. */
        Past18Hours: MetricImperialValues;
        /** The amount of precipitation (liquid equivalent) that has fallen in the past 24 hours. Contains Metric and Imperial Values. */
        Past24Hours: MetricImperialValues;
    }
    TemperatureSummary: {
        Past6HourRange: {
            /** The minimum temperature observed over the past 6 hours. Contains Metric and Imperial Values. */
            Minimum: MetricImperialValues;
            /** The maximum temperature observed over the past 6 hours. Contains Metric and Imperial Values. */
            Maximum: MetricImperialValues;
        }
        Past12HourRange: {
            /** The minimum temperature observed over the past 12 hours. Contains Metric and Imperial Values. */
            Minimum: MetricImperialValues;
            /** The maximum temperature observed over the past 12 hours. Contains Metric and Imperial Values. */
            Maximum: MetricImperialValues;
        }
        Past24HourRange: {
            /** The minimum temperature observed over the past 24 hours. Contains Metric and Imperial Values. */
            Minimum: MetricImperialValues;
            /** The maximum temperature observed over the past 24 hours. Contains Metric and Imperial Values. */
            Maximum: MetricImperialValues;
        }
    }
    /** Link to current conditions for the requested location on AccuWeather`s mobile site. */
    MobileLink: string;
    /** Link to current conditions for the requested location on AccuWeather`s web site. */
    Link: string;
    /** Flag indicating the presence or absence of precipitation. True indicates the presence of precipitation, false indicates the absence of precipitation. */
    HasPrecipitation: boolean;
    /** If precipitation is present, the type of precipitation will be returned. Possible values are Rain, Snow, Ice, or Mixed. Null in the absence of precipitation. */
    PrecipitationType: string;
    /** The relative humidity in the user's home or building.  */
    IndoorRelativeHumidity: boolean;
}

interface DailyPayload {
    Headline: {
        /** DateTime, displayed in ISO8601 format, when the Headline is in effect. */
        EffectiveDate: string;
        /** Effective Date of the headline, displayed as the number of seconds that have elapsed since January 1, 1970 (midnight UTC/GMT). */
        EffectiveEpochDate: number;
        /** Severity of the headline, displayed as an integer. The lower the number, the greater the severity. 0 = Unknown 1 = Significant 2 = Major 3 = Moderate 4 = Minor 5 = Minimal 6 = Insignificant 7 = Informational */
        Severity: number;
        /** Text of the headline, which represents the most significant weather event over the next 5 days. Displayed in the language specified by language code in URL. */
        Text: string;
        /** Category of the headline. */
        Category: string;
        /** DateTime, displayed in ISO8601 format, when the Headline expires. May be NULL. */
        EndDate: string | null;
        /** End Date of the headline, displayed as the number of seconds that have elapsed since January 1, 1970 (midnight UTC/GMT). */
        EndEpochDate: number;
        /** Link to the extended forecast for the requested location on AccuWeather`s mobile site. */
        MobileLink: string;
        /** Link to the extended forecast for the requested location on AccuWeather`s web site. */
        Link: string;
    }
    DailyForecasts: DailyForecast[]
}

interface DailyForecast {
    /** DateTime of the forecast, displayed in ISO8601 format. */
    Date: string;
    /** Date of the forecast, displayed as the number of seconds that have elapsed since January 1, 1970 (midnight UTC/GMT). */
    EpochDate: number;
    Sun: {
        /** Sun rise displayed in ISO8601 format. */
        Rise: string;
        /** Sun rise displayed as the number of seconds that have elapsed since January 1, 1970 (midnight UTC/GMT). */
        EpochRise: number;
        /** Sun set displayed in ISO8601 format. */
        Set: string;
        /** Sun set displayed as the number of seconds that have elapsed since January 1, 1970 (midnight UTC/GMT). */
        EpochSet: number;
    }
    Moon: {
        /** Moon rise displayed in ISO8601 format. */
        Rise: string;
        /** Moon rise displayed as the number of seconds that have elapsed since January 1, 1970 (midnight UTC/GMT). */
        EpochRise: number;
        /** Moon set displayed in ISO8601 format. */
        Set: string;
        /** Moon set displayed as the number of seconds that have elapsed since January 1, 1970 (midnight UTC/GMT). */
        EpochSet: number;
        /** Moon phase. */
        Phase: string;
        /** The number of days since the new moon. */
        Age: number;
    }
    Temperature: {
        Minimum: GenericValue;
        Maximum: GenericValue;
    }
    RealFeelTemperature: {
        Minimum: GenericValue;
        Maximum: GenericValue;
    }
    RealFeelTemperatureShade: {
        Minimum: GenericValue;
        Maximum: GenericValue;
    }
    /** Number of hours of sun. */
    HoursOfSun: number;
    DegreeDaySummary: {
        Heating: {
            /** Number of degrees that the mean temperature is below 65 degrees F. Displayed in specified units. May be NULL. */
            Value: number | null;
            /** Type of unit. */
            Unit: string;
            /** Numeric ID associated with the type of unit being displayed. */
            UnitType: number;
        }
        Cooling: {
            /** Number of degrees that the mean temperature is above 65 degrees F. Displayed in specified units. May be NULL. */
            Value: number | null;
            /** Type of unit. */
            Unit: string;
            /** Numeric ID associated with the type of unit being displayed. */
            UnitType: number;
        }
    }
    AirAndPollen: {
        /** Name of the pollen or air pollutant. */
        Name: string;
        /** Value of the pollutant. Values associated with mold, grass, weed, and tree are displayed in parts per cubic meter. Air quality and UV index are indices and are unitless. May be NULL. */
        Value: number | null;
        /** Category of the pollution. (low, high, good, moderate, unhealthy, hazardous) */
        Category: string;
        /** Value associated with the category. These values range from 1 to 6, with 1 implying good conditions and 6 implying hazardous conditions. */
        CategoryValue: number;
        /** Only exists for air quality. Examples include ozone and particle pollution. */
        Type: string;
    }
    Day: {
        /** Numeric value representing an icon that matches the forecast. */
        Icon: number;
        /** Phrase description of the icon. */
        IconPhrase: string;
        LocalSource: {
            /** Numeric identifier, unique to the local data provider. */
            Id: number;
            /** Name of the local data provider. Name is displayed in the language specified by language code in URL, if available. Otherwise, Name is displayed in English or the language in which the name was provided. */
            Name: string;
            /** Weather code provided by the local data provider. This weather code allows the forecast to be matched to icons provided by the local data provider instead of AccuWeather icons. */
            WeatherCode: string;
        }
        /** boolean value that indicates the presence of any type of precipitation for a given day. Displays true if precipitation is present. */
        HasPrecipitation: boolean;
        /** Indicates if the precipitation is rain, snow, ice, or mixed. Only returned if HasPrecipitation is true. */
        PrecipitationType?: string;
        /** Indicates if the precipitation strength is light, moderate, or heavy. Only returned if HasPrecipitation is true. */
        PrecipitationIntensity?: string;
        /** Phrase description of the forecast. AccuWeather attempts to keep this phrase under 30 characters in length, but some languages/weather events may result in a phrase exceeding 30 characters. */
        ShortPhrase: string;
        /** Phrase description of the forecast. AccuWeather attempts to keep this phrase under 100 characters in length, but some languages/weather events may result in a phrase exceeding 100 characters. */
        LongPhrase: string;
        /** Percent representing the probability of precipitation. May be NULL. */
        PrecipitationProbability: number | null;
        /** Percent representing the probability of a thunderstorm. May be NULL. */
        ThunderstormProbability: number | null;
        /** Percent representing the probability of rain. May be NULL. */
        RainProbability: number | null;
        /** Percent representing the probability of snow. May be NULL. */
        SnowProbability: number | null;
        /** Percent representing the probability of ice. May be NULL. */
        IceProbability: number | null;
        Wind: {
            Speed: GenericValue;
            Direction: WindDirectionInfo;
        }
        WindGust: {
            Speed: GenericValue;
        }
        TotalLiquid: GenericValue;
        Rain: GenericValue;
        Snow: GenericValue;
        Ice: GenericValue;
        /** Number of hours of precipitation of any type. */
        HoursOfPrecipitation: number;
        /** Number of hours of rain. */
        HoursOfRain: number;
        /** Percent representing cloud cover. */
        CloudCover: number;
        Evapotranspiration: GenericValue;
        SolarIrradiance: GenericValue;
    }
    Night: {
        /** Numeric value representing an icon that matches the forecast. */
        Icon: number;
        /** Phrase description of the icon. */
        IconPhrase: string;
        LocalSource: {
            /** Numeric identifier, unique to the local data provider. */
            Id: number;
            /** Name of the local data provider. Name is displayed in the language specified by language code in URL, if available. Otherwise, Name is displayed in English or the language in which the name was provided. */
            Name: string;
            /** Weather code provided by the local data provider. This weather code allows the forecast to be matched to icons provided by the local data provider instead of AccuWeather icons. */
            WeatherCode: string;
        }
        /** boolean value that indicates the presence of any type of precipitation for a given night. Displays true if precipitation is present. */
        HasPrecipitation: boolean;
        /** Indicates if the precipitation is rain, snow, ice, or mixed. Only returned if HasPrecipitation is true. */
        PrecipitationType: string;
        /** Indicates if the precipitation strength is light, moderate, or heavy. Only returned if HasPrecipitation is true. */
        PrecipitationIntensity: string;
        /** Phrase description of the forecast. AccuWeather attempts to keep this phrase under 30 characters in length, but some languages/weather events may result in a phrase exceeding 30 characters. */
        ShortPhrase: string;
        /** Phrase description of the forecast. AccuWeather attempts to keep this phrase under 100 characters in length, but some languages/weather events may result in a phrase exceeding 100 characters. */
        LongPhrase: string;
        /** Percent representing the probability of precipitation. May be NULL. */
        PrecipitationProbability: number | null;
        /** Percent representing the probability of a thunderstorm. May be NULL. */
        ThunderstormProbability: number | null;
        /** Percent representing the probability of rain. May be NULL. */
        RainProbability: number | null;
        /** Percent representing the probability of snow. May be NULL. */
        SnowProbability: number | null;
        /** Percent representing the probability of ice. May be NULL. */
        IceProbability: number | null;
        Wind: {
            /** Contains Value, Unit, and UnitType. For details, see DailyForecasts.Day.Wind.Speed. */
            Speed: GenericValue;
            /** Contains Degrees, Localized, and English. For details, see DailyForecasts.Day.Wind.Direction. */
            Direction: WindDirectionInfo;
        }
        WindGust: {
            /** Contains Value, Unit, and UnitType. For details, see DailyForecasts.Day.WindGust.Speed. */
            Speed: GenericValue;
        }
        /** Contains Value, Unit, and UnitType. For details, see DailyForecasts.Day.TotalLiquid. */
        TotalLiquid: GenericValue;
        /** Contains Value, Unit, and UnitType. For details, see DailyForecasts.Day.Rain. */
        Rain: GenericValue;
        /** Contains Value, Unit, and UnitType. For details, see DailyForecasts.Day.Snow. */
        Snow: GenericValue;
        /** Contains Value, Unit, and UnitType. For details, see DailyForecasts.Day.Ice. */
        Ice: GenericValue;
        /** Number of hours of precipitation of any type. */
        HoursOfPrecipitation: number;
        /** Number of hours of rain. */
        HoursOfRain: number;
        /** Percent representing cloud cover. */
        CloudCover: number;
        Evapotranspiration: {
            /** Rounded value in specified units. May be NULL. */
            Value: number | null;
            /** Type of unit. */
            Unit: string;
            /** Numeric ID associated with the type of unit being displayed. */
            UnitType: number;
        }
        SolarIrradiance: {
            /** Rounded value in specified units. May be NULL. */
            Value: number | null;
            /** Type of unit. */
            Unit: string;
            /** Numeric ID associated with the type of unit being displayed. */
            UnitType: number;
        }
    }
    /** Forecast sources. */
    Sources: string;
    /** Link to the daily forecast for the requested location on AccuWeather`s mobile site. */
    MobileLink: string;
    /** Link to the daily forecast for the requested location on AccuWeather`s web site.  */
    Link: string;
}

interface HourlyPayloadShort extends Pick<HourlyPayload,
    "DateTime" |
    "EpochTime" |
    "WeatherIcon" |
    "HasPrecipitation" |
    "PrecipitationType" |
    "PrecipitationIntensity" |
    "IsDaylight" |
    "Temperature" |
    "PrecipitationProbability" |
    "MobileLink" |
    "Link"
    > {
}

interface HourlyPayload {
    /** DateTime of the forecast, displayed in ISO8601 format. */
    DateTime: string;
    /** DateTime of the forecast, displayed as the number of seconds that have elapsed since January 1, 1970 (midnight UTC/GMT). */
    EpochTime: number;
    /** Numeric value representing an image that displays the current condition described by WeatherText. May be NULL. */
    WeatherIcon: number;
    /** Phrase description of the forecast associated with the WeatherIcon. Displayed in language specified by language code in URL. */
    IconPhrase: string;
    /** boolean value that indicates the presence of any type of precipitation for a given night. Displays true if precipitation is present. */
    HasPrecipitation: boolean;
    /** Indicates if the precipitation strength is light, moderate, or heavy. Only returned if HasPrecipitation is true. */
    PrecipitationType?: "Snow" | "Ice" | "Rain";
    /** Indicates if the precipitation strength is light, moderate, or heavy. Only returned if HasPrecipitation is true. */
    PrecipitationIntensity?: string;
    /** Specifies whether or not it is daylight (true=daylight, false=not daylight). */
    IsDaylight: boolean;
    Temperature: GenericValue;
    RealFeelTemperature: GenericValue;
    RealFeelTemperatureShade: GenericValue;
    /** The temperature to which air may be cooled by evaporating water into it at constant pressure until it reaches saturation */
    WetBulbTemperature: GenericValue;
    /** Dew Point temperature */
    DewPoint: GenericValue;
    Wind: {
        Speed: GenericValue;
        Direction: GenericValue;
    }
    WindGust: {
        Speed: GenericValue;
    }
    /** Relative humidity. May be NULL. */
    RelativeHumidity: number | null;
    Visibility: GenericValue;
    Ceiling: GenericValue;
    /** Measure of the strength of the ultraviolet radiation from the sun. May be NULL. */
    UVIndex: number | null;
    /** Text associated with the UVIndex. */
    UVIndexText: string;
    /** Percent representing the probability of precipitation. May be NULL. */
    PrecipitationProbability: number | null;
    /** Percent representing the probability of rain. May be NULL. */
    RainProbability: number | null;
    /** Percent representing the probability of snow. May be NULL. */
    SnowProbability: number | null;
    /** Percent representing the probability of ice. May be NULL. */
    IceProbability: number | null;
    TotalLiquid: GenericValue;
    Rain: GenericValue;
    Snow: GenericValue;
    Ice: GenericValue;
    /** Number representing the percentage of the sky that is covered by clouds. May be NULL. */
    CloudCover: number | null;
    Evapotranspiration: GenericValue;
    SolarIrradiance: GenericValue;
    /** Link to the hourly forecast for the requested location on AccuWeather`s mobile site. */
    MobileLink: string;
    /** Link to the hourly forecast for the requested location on AccuWeather`s web site.  */
    Link: string;
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