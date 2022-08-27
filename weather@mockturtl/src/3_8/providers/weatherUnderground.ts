import { DateTime } from "luxon";
import { getTimes } from "suncalc";
import { Services } from "../config";
import { ErrorResponse, HttpError } from "../lib/httpLib";
import { Logger } from "../lib/logger";
import { Condition, ForecastData, LocationData, WeatherData } from "../types";
import { CelsiusToKelvin, FahrenheitToKelvin, GetDistance, _ } from "../utils";
import { BaseProvider } from "./BaseProvider";

type UnitType = "e" | "m" | "h";

/** Default metric */
const unitTypeMap: Record<string, UnitType> = {
    "us": "e",
    "lr": "e",
    "mm": "e",
    "gb": "h",
}

export class WeatherUnderground extends BaseProvider {
    public needsApiKey: boolean = true;
    public prettyName: string = _("Weather Underground");
    public name: Services = "WeatherUnderground";
    public maxForecastSupport: number = 6;
    public maxHourlyForecastSupport: number = 0;
    public website: string = "https://www.wunderground.com/";
    public remainingCalls: number | null = null;

    private readonly baseURl: string = "https://api.weather.com/";

    private readonly locationCache: Record<string, NearbyStation[]> = {};

    private get currentUnit(): UnitType {
        if (this.app.config.countryCode == null)
            return "m";
        else
            return unitTypeMap[this.app.config.countryCode.toLowerCase()] ?? "m";
    }

    public GetWeather = async (loc: LocationData): Promise<WeatherData | null> => {
        const locString = `${loc.lat},${loc.lon}`;
        const location = this.locationCache[locString] ?? (await this.GetNearbyStations(loc));
        if (location == null) {
            // TODO: handle error
            return null;
        }
        this.locationCache[locString] = location;

        const forecast = await this.app.LoadJsonAsync<ForecastPayload>(`${this.baseURl}v3/wx/forecast/daily/5day`, {
            geocode: locString,
            language: this.app.config.currentLocale ?? "en-US",
            format: "json",
            apiKey: this.app.config.ApiKey,
            units: this.currentUnit,
        });

        if (forecast == null)
            return null;

        const observation = await this.GetObservations(location, forecast, loc);

        return {
            date: observation.date!,
            temperature: observation.temperature ?? null,
            coord: {
                lat: loc.lat,
                lon: loc.lon,
            },
            location: {
                city: loc.city ?? observation.location.city,
                country: loc.country ?? observation.location.country,
                url: observation.location.url
            },
            condition: observation.condition ?? {
                description: "unknown",
                customIcon: "alien-symbolic",
                icons: [],
                main: "Unknown"
            },
            dewPoint: observation.dewPoint ?? null,
            humidity: observation.humidity ?? null,
            pressure: observation.pressure ?? null,
            wind: {
                speed: observation.wind.speed ?? null,
                degree: observation.wind.degree ?? null,
            },
            sunrise: observation.sunrise,
            sunset: observation.sunset,
            stationInfo: observation.stationInfo,
            extra_field: observation.extra_field,
            forecasts: this.ParseForecasts(loc, forecast),
        };
    }

    private ParseForecasts(loc: LocationData, forecast: ForecastPayload): ForecastData[] {
        const result: ForecastData[] = [];
        for (let index = 0; index < forecast.dayOfWeek.length; index++) {
            const icons = [ forecast.daypart[0].iconCode[index * 2],  forecast.daypart[0].iconCode[index * 2 + 1]];
            const data: ForecastData = {
                date: DateTime.fromSeconds(forecast.validTimeUtc[index]).setZone(loc.timeZone),
                condition: this.IconToCondition(icons[0] ?? icons[1]!),
                temp_max: forecast.temperatureMax[index] == null ? null : this.ToKelvin(forecast.temperatureMax[index]!),
                temp_min: forecast.temperatureMin[index] == null ? null : this.ToKelvin(forecast.temperatureMin[index]),
            }
            if (!this.app.config._shortConditions)
                data.condition.description = forecast.narrative[index];
            result.push(data);
        }
        return result;
    }

    private GetNearbyStations = async (loc: LocationData): Promise<NearbyStation[] | null> => {
        const result: NearbyStation[] = [];
        const payload = await this.app.LoadJsonAsync<NearObservationPayload>(`${this.baseURl}v3/location/near`, {
            geocode: `${loc.lat},${loc.lon}`,
            format: "json",
            apiKey: this.app.config.ApiKey,
            product: "pws"
        }, this.HandleErrors);

        if (payload == null)
            return null;

        for (let i = 0; i < payload.location.stationId.length; i++) {
            const stationID = payload.location.stationId[i];
            if (stationID == null)
                continue;

            result.push({
                stationId: stationID,
                stationName: payload.location.stationName[i],
                latitude: payload.location.latitude[i],
                longitude: payload.location.longitude[i],
                distanceKm: payload.location.distanceKm[i] ?? GetDistance(loc.lat, loc.lon, payload.location.latitude[i], payload.location.longitude[i]) / 1000,
            })
        }

        if (result.length == 0)
            return null;

        return result;
    }

    private GetObservations = async (stations: NearbyStation[], forecast: ForecastPayload, loc: LocationData): Promise<ObservationInternalData> => {
        const observationData: ObservationData[] = (await Promise.all(stations.map(v => this.GetObservation(v.stationId)))).filter(v => v != null) as ObservationData[];
        const tz = loc.timeZone;
        
        const result: ObservationInternalData = {
            wind: {
                speed: null,
                degree: null,
            },
            location: {},
            sunrise: null,
            sunset: null,
            date: null as any,
        };

        for (const observations of observationData) {
            const station = stations.find(v => v.stationId == observations.stationID)!;
            if (result.date == null && observations.obsTimeUtc != null)
                result.date = DateTime.fromISO(observations.obsTimeUtc).setZone(tz); 
            if (result.location.city == null && observations.neighborhood != null)
                result.location.city = observations.neighborhood;
            if (result.location.country == null && observations.country != null)
                result.location.country = observations.country;
            if (result.location.url == null)
                result.location.url = `https://www.wunderground.com/weather/${observations.stationID}`;
            if (result.temperature == null && observations.metric_si.temp)
                result.temperature = CelsiusToKelvin(observations.metric_si.temp);
            if (result.pressure == null)
                result.pressure = observations.metric_si.pressure; 
            if (result.humidity == null)
                result.humidity = observations.humidity; 
            if (result.wind.speed == null)
                result.wind.speed = observations.metric_si.windSpeed; 
            if (result.wind.degree == null)
                result.wind.degree = observations.winddir; 
            if (result.dewPoint == null)
                result.dewPoint = CelsiusToKelvin(observations.metric_si.dewpt);
            if (result.extra_field?.value == null && observations.metric_si.windChill != null) {
                result.extra_field = {
                    name: _("Feels Like"),
                    type: "temperature",
                    value: this.ToKelvin(observations.metric_si.windChill)
                }
            }
                result.dewPoint = CelsiusToKelvin(observations.metric_si.dewpt);
            if (result.stationInfo == null) {
                result.stationInfo = {
                    name: station.stationName,
                    lat: station.latitude,
                    lon: station.longitude,
                    distanceFrom: station.distanceKm * 1000,
                };
            }
            if (result.immediatePrecipitation == null) {

            }
        }

        // Need to find the first non-null foreacast to substitute
        const dayPartIndex = forecast.daypart[0].daypartName.findIndex(v => v != null);

        if (result.date == null)
            // TODO use real timestamp from somewhere....
            result.date = DateTime.now().setZone(tz); 
        if (result.temperature == null)
            result.temperature = this.ToKelvin(forecast.daypart[0].temperature[dayPartIndex]);
        if (result.humidity == null)
            result.humidity = forecast.daypart[0].relativeHumidity[dayPartIndex]; 
        if (result.wind.speed == null)
            result.wind.speed = forecast.daypart[0].windSpeed[dayPartIndex]; 
        if (result.wind.degree == null)
            result.wind.degree = forecast.daypart[0].windDirection[dayPartIndex];
        if (result.condition == null) {
            const icon = forecast.daypart[0].iconCode[dayPartIndex];
            if (icon != null)
                result.condition = this.IconToCondition(icon);
        }

        const times = getTimes(result.date.toJSDate(), loc.lat, loc.lon);
        result.sunrise = DateTime.fromJSDate(times.sunrise).setZone(tz);
        result.sunset = DateTime.fromJSDate(times.sunset).setZone(tz);

        return result;
    }

    private GetObservation = async (stationID: string): Promise<ObservationData | null> => {
        const observationString = await this.app.LoadAsync(`${this.baseURl}v2/pws/observations/current`, {
            format: "json",
            stationId: stationID,
            apiKey: this.app.config.ApiKey,
            units: "s",
            numericPrecision: "decimal",
        }, this.HandleErrors);

        let observation: ObservationPayload | null = null;
        if (observationString != null) {
            try {
                observation = JSON.parse(observationString);
            }
            catch(e) {
                Logger.Debug("could not JSON parse observation payload from station ID " + stationID);
            }
        }

        return observation?.observations[0] ?? null;
    }

    private HandleErrors = (message: ErrorResponse): boolean => {
        switch(message.ErrorData.code) {
            case 7:
                return false;
            case 401:
                this.app.ShowError({
                    type: "hard",
                    detail: "bad key" ,
                    message: _("The API key you provided is invalid.")
                });
                return false;
            case 404:
                this.app.ShowError({
                    type: "hard",
                    detail: "location not found",
                    message: _("The location you provided was not found.")
                });
                return false;
            case 204:
                // this.app.ShowError({
                //     type: "hard",
                //     detail: "no response data",
                //     message: _("No data was found for the location you provided.")
                // });
                return false;
            default:
                return true;
        }
    }

    private IconToCondition = (icon: number): Condition => {
        switch(icon) {
            case 0:
                return {
                    customIcon: "tornado-symbolic",
                    icons: ["weather-tornado"],
                    main: _("Tornado"),
                    description: _("Tornado"),
                };
            case 1:
                return {
                    customIcon: "tornado-symbolic",
                    icons: ["weather-tornado"],
                    main: _("Tropical Storm"),
                    description: _("Tropical Storm"),
                };
            case 2:
                return {
                    customIcon: "tornado-symbolic",
                    icons: ["weather-tornado"],
                    main: _("Hurricane"),
                    description: _("Hurricane"),
                };
            case 3:
                return {
                    customIcon: "storm-warning-symbolic",
                    icons: ["weather-storm", "weather-freezing-rain"],
                    main: _("Strong Storm"),
                    description: _("Strong Storm"),
                };
            case 4:
                return {
                    customIcon: "storm-showers-symbolic",
                    icons: ["weather-storm", "weather-freezing-rain"],
                    main: _("Thunderstorms"),
                    description: _("Thunderstorms"),
                };
            case 5:
            case 7:
                return {
                    customIcon: "rain-mix-symbolic",
                    icons: ["weather-freezing-rain", "weather-showers-scattered",],
                    main: _("Rain and Snow"),
                    description: _("Rain and Snow"),
                };
            case 6:
                return {
                    customIcon: "rain-mix-symbolic",
                    icons: ["weather-freezing-rain", "weather-showers-scattered",],
                    main: _("Rain and Sleet"),
                    description: _("Rain and Sleet"),
                };
            case 8:
                return {
                    customIcon: "rain-mix-symbolic",
                    icons: ["weather-showers-scattered", "weather-freezing-rain", "weather-rain"],
                    main: _("Freezing Drizzle"),
                    description: _("Freezing Drizzle"),
                };
            case 9:
                return {
                    customIcon: "rain-mix-symbolic",
                    icons: ["weather-showers-scattered", "weather-rain", "weather-freezing-rain"],
                    main: _("Drizzle"),
                    description: _("Drizzle"),
                };
            case 10:
                return {
                    customIcon: "rain-symbolic",
                    icons: ["weather-freezing-rain", "weather-rain", "weather-showers"],
                    main: _("Freezing Rain"),
                    description: _("Freezing Rain"),
                };
            case 11:
                return {
                    customIcon: "showers-symbolic",
                    icons: ["weather-showers", "weather-rain", "weather-freezing-rain", ],
                    main: _("Showers"),
                    description: _("Showers"),
                };
            case 12:
                return {
                    customIcon: "rain-symbolic",
                    icons: ["weather-rain", "weather-freezing-rain", "weather-showers"],
                    main: _("Rain"),
                    description: _("Rain"),
                };
            case 13:
                return {
                    customIcon: "snow-symbolic",
                    icons: ["weather-snow"],
                    main: _("Flurries"),
                    description: _("Flurries"),
                };
            case 14:
                return {
                    customIcon: "snow-symbolic",
                    icons: ["weather-snow"],
                    main: _("Snow Showers"),
                    description: _("Snow Showers"),
                };
            case 15:
                return {
                    customIcon: "snow-wind-symbolic",
                    icons: ["weather-snow"],
                    main: _("Blowing Snow"),
                    description: _("Blowing Snow"),
                };
            case 16:
                return {
                    customIcon: "snow-symbolic",
                    icons: ["weather-snow"],
                    main: _("Snow"),
                    description: _("Snow"),
                };
            case 17:
                return {
                    customIcon: "hail-symbolic",
                    icons: ["weather-hail", "weather-snow"],
                    main: _("Hail"),
                    description: _("Hail"),
                };
            case 18:
                return {
                    customIcon: "sleet-symbolic",
                    icons: ["weather-hail", "weather-snow"],
                    main: _("Sleet"),
                    description: _("Sleet"),
                };
            case 19:
                return {
                    customIcon: "dust-symbolic",
                    icons: ["weather-fog"],
                    main: _("Dust"),
                    description: _("Dust"),
                };
            case 20:
                return {
                    customIcon: "fog-symbolic",
                    icons: ["weather-fog"],
                    main: _("Fog"),
                    description: _("Fog"),
                };
            case 21:
                return {
                    customIcon: "fog-symbolic",
                    icons: ["weather-fog"],
                    main: _("Haze"),
                    description: _("Haze"),
                };
            case 22:
                return {
                    customIcon: "fog-symbolic",
                    icons: ["weather-fog"],
                    main: _("Smoke"),
                    description: _("Smoke"),
                };
            case 23:
                return {
                    customIcon: "windy-symbolic",
                    icons: ["weather-windy"],
                    main: _("Breezy"),
                    description: _("Breezy"),
                };
            case 24:
                return {
                    customIcon: "windy-symbolic",
                    icons: ["weather-windy"],
                    main: _("Windy"),
                    description: _("Windy"),
                };
            case 25:
                return {
                    customIcon: "windy-symbolic",
                    icons: ["weather-windy"],
                    main: _("Frigid"),
                    description: _("Frigid"),
                };
            case 26:
                return {
                    customIcon: "cloudy-symbolic",
                    icons: ["weather-overcast"],
                    main: _("Cloudy"),
                    description: _("Cloudy"),
                };
            case 27:
                return {
                    customIcon: "night-alt-cloudy-symbolic",
                    icons: ["weather-clouds-night", "weather-few-clouds-night"],
                    main: _("Mostly Cloudy"),
                    description: _("Mostly Cloudy"),
                };
            case 28:
                return {
                    customIcon: "day-cloudy-symbolic",
                    icons: ["weather-clouds", "weather-few-clouds"],
                    main: _("Mostly Cloudy"),
                    description: _("Mostly Cloudy"),
                };
            case 29:
                return {
                    customIcon: "night-alt-cloudy-symbolic",
                    icons: ["weather-few-clouds-night"],
                    main: _("Partly Cloudy"),
                    description: _("Partly Cloudy"),
                };
            case 30:
                return {
                    customIcon: "day-cloudy-symbolic",
                    icons: ["weather-few-clouds"],
                    main: _("Partly Cloudy"),
                    description: _("Partly Cloudy"),
                };
            case 31:
                return {
                    customIcon: "night-clear-symbolic",
                    icons: ["weather-clear-night"],
                    main: _("Clear"),
                    description: _("Clear"),
                };
            case 32:
                return {
                    customIcon: "day-sunny-symbolic",
                    icons: ["weather-clear"],
                    main: _("Sunny"),
                    description: _("Sunny"),
                };
            case 33:
                return {
                    customIcon: "night-alt-cloudy-symbolic",
                    icons: ["weather-few-clouds-night"],
                    main: _("Mostly Clear"),
                    description: _("Mostly Clear"),
                };
            case 34:
                return {
                    customIcon: "day-cloudy-symbolic",
                    icons: ["weather-few-clouds"],
                    main: _("Mostly Sunny"),
                    description: _("Mostly Sunny"),
                };
            case 35:
                return {
                    customIcon: "day-rain-mix-symbolic",
                    icons: ["weather-freezing-rain"],
                    main: _("Mixed Rain and Hail"),
                    description: _("Mixed Rain and Hail"),
                };
            case 36:
                return {
                    customIcon: "day-sunny-symbolic",
                    icons: ["weather-clear"],
                    main: _("Hot"),
                    description: _("Hot"),
                };
            case 37:
                return {
                    customIcon: "day-thunderstorm-symbolic",
                    icons: ["weather-storm"],
                    main: _("Isolated Thunderstorms"),
                    description: _("Isolated Thunderstorms"),
                };
            case 38:
                return {
                    customIcon: "day-thunderstorm-symbolic",
                    icons: ["weather-storm"],
                    main: _("Scattered Thunderstorms"),
                    description: _("Scattered Thunderstorms"),
                };
            case 39:
                return {
                    customIcon: "day-showers-symbolic",
                    icons: ["weather-showers-scattered", "weather-showers-scattered-day", "weather-rain", "weather-freezing-rain"],
                    main: _("Scattered Showers"),
                    description: _("Scattered Showers"),
                };
            case 40:
                return {
                    customIcon: "rain-symbolic",
                    icons: ["weather-rain", "weather-freezing-rain"],
                    main: _("Heavy Rain"),
                    description: _("Heavy Rain"),
                };
            case 41:
                return {
                    customIcon: "day-snow-symbolic",
                    icons: ["weather-snow-scattered-day", "weather-snow-scattered", "weather-snow-day", "weather-snow"],
                    main: _("Scattered Snow Showers"),
                    description: _("Scattered Snow Showers"),
                };
            case 42:
                return {
                    customIcon: "snow-symbolic",
                    icons: ["weather-snow"],
                    main: _("Heavy Snow"),
                    description: _("Heavy Snow"),
                };
            case 43:
                return {
                    customIcon: "snow-symbolic",
                    icons: ["weather-snow"],
                    main: _("Blizzard"),
                    description: _("Blizzard"),
                };
            case 45:
                return {
                    customIcon: "night-alt-showers-symbolic",
                    icons: ["weather-showers-scattered-night", "weather-rain", "weather-freezing-rain"],
                    main: _("Scattered Showers"),
                    description: _("Scattered Showers"),
                };
            case 46:
                return {
                    customIcon: "night-alt-snow-symbolic",
                    icons: ["weather-snow-scattered-night", "weather-snow-scattered", "weather-snow"],
                    main: _("Scattered Snow Showers"),
                    description: _("Scattered Snow Showers"),
                };
            case 47:
                return {
                    customIcon: "night-alt-thunderstorm-symbolic",
                    icons: ["weather-storm"],
                    main: _("Scattered Thunderstorms"),
                    description: _("Scattered Thunderstorms"),
                };
            default:
                return {
                    customIcon: "cloud-refresh-symbolic",
                    description: _("Unknown"),
                    icons: [],
                    main: _("Unknown"),
                }
        }
    }

    private ToKelvin = (c: number): number => {
        switch(this.currentUnit) {
            case "e":
                return FahrenheitToKelvin(c);
            case "m":
            case "h":
                return CelsiusToKelvin(c);
        }
    }
}


interface LocationPayload {
    location: {
        latitude: number;
        longitude: number;
        city: string;
        locale: {
            locale1: string | null;
            locale2: string | null;
            locale3: string | null;
            locale4: string | null;
        },
        neighborhood: string | null,
        adminDistrict: string | null,
        adminDistrictCode: string | null,
        postalCode: string | null,
        postalKey: string | null,
        country: string,
        countryCode: string,
        ianaTimeZone: string,
        displayName: string,
        /** ISO DateTime */
        dstEnd: string | null,
        /** ISO DateTime */
        dstStart: string | null,
        dmaCd: string | null,
        placeId: string | null,
        disputedArea: boolean,
        disputedCountries: string[] | null,
        disputedCountryCodes: string[] | null,
        disputedCustomers: string[] | null,
        disputedShowCountry: boolean[],
        canonicalCityId: string,
        countyId: string | null,
        locId: string,
        locationCategory: string | null,
        pollenId: string | null,
        pwsId: string | null,
        regionalSatellite: string,
        tideId: string | null,
        type: string,
        zoneId: string,
    }
}

interface NearObservationPayload {
    location: {
        stationName: string[];
        stationId: (string | null)[];
        latitude: (number)[];
        longitude: (number)[];
        distanceKm: (number | null)[];
        distanceMi: (number | null)[];
    }
}

interface ObservationPayload {
    observations: ObservationData[]
}

interface ObservationData {
    /** Country Code */
    country: string | null;
    /** Time in UNIX seconds */
    epoch: number | null;
    /** The relative humidity of the air. */
    humidity: number | null;
    /** Latitude of PWS */
    lat: number | null;
    /** Longitude of PWS */
    lon: number | null;
    /** Neighborhood associated with the PWS location */
    neighborhood: string | null;
    /** Time observation is valid in local apparent time by timezone - tz, non ISO */
    obsTimeLocal: string | null;
    /** GMT(UTC) time, ISO */
    obsTimeUtc: string | null;
    /** Quality control indicator:
     * - -1: No quality control check performed
     * - 0: This observation was marked as possibly incorrect by our quality control algorithm
     * - 1: This observation passed quality control checks
     */
    qcStatus: -1 | 0 | 1;
    /** Frequency of data report updates in minutes */
    realtimeFrequency: number | null;
    /** Software type of the PWS */
    softwareType: string | null;
    /** Solar Radiation */
    solarRadiation: number | null;
    /** D as registered by wunderground.com */
    stationID: string;
    /** UV reading of the intensity of solar radiation */
    uv: number | null;
    /** Wind Direction */
    winddir: number | null;
    metric_si: {
        /** The temperature which air must be cooled at constant pressure to reach saturation. The Dew Point is also an indirect measure of the humidity of the air. The Dew Point will never exceed the Temperature. When the Dew Point and Temperature are equal, clouds or fog will typically form. The closer the values of Temperature and Dew Point, the higher the relative humidity. */
        dewpt: number | null;
        /** Elevation */
        elev: number | null;
        /** Heat Index - An apparent temperature. It represents what the air temperature “feels like” on exposed human skin due to the combined effect of warm temperatures and high humidity.
         * When the temperature is 70°F or higher, the Feels Like value represents the computed Heat Index.
         */
        heatIndex: number | null;
        /** Rate of precipitation - instantaneous precipitation rate.  How much rain would fall if the precipitation intensity did not change for one hour */
        precipRate: number | null;
        /** Accumulated precipitation for today from midnight to present. */
        precipTotal: number | null;
        /** Mean Sea Level Pressure, the equivalent pressure reading at sea level recorded at this station */
        pressure: number | null;
        /** Temperature in defined unit of measure. */
        temp: number | null;
        /** Wind Chill - An apparent temperature. It represents what the air temperature “feels like” on exposed human skin due to the combined effect of the cold temperatures and wind speed.
         * When the temperature is 61°F or lower the Feels Like value represents the computed Wind Chill so display the Wind Chill value.
         */
        windChill: number | null;
        /** Wind Gust - sudden and temporary variations of the average Wind Speed. The report always shows the maximum wind gust speed recorded during the observation period. It is a required display field if Wind Speed is shown. */
        windGust: number | null;
        /** Wind Speed - The wind is treated as a vector; hence, winds must have direction and magnitude (speed). The wind information reported in the hourly current conditions corresponds to a 10-minute average called the sustained wind speed. Sudden or brief variations in the wind speed are known as “wind gusts” and are reported in a separate data field.
         * Wind directions are always expressed as ""from whence the wind blows"" meaning that a North wind blows from North to South. If you face North in a North wind the wind is at your face. Face southward and the North wind is at your back. */
        windSpeed: number | null;
    }
}

// https://docs.google.com/document/d/1_Zte7-SdOjnzBttb1-Y9e0Wgl0_3tah9dSwXUyEA3-c/edit

type DayOfWeek = "Sunday" | "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday";
type MoonPhaseCode = "WNG" | "WXC" | "FQ" | "WNC" | "LQ" | "F" | "WXG" | "N";

interface ForecastPayload {
    calendarDayTemperatureMax: number[];
    calendarDayTemperatureMin: number[];
    dayOfWeek: DayOfWeek[];
    /** Unix timestamp */
    expirationTimeUtc: number[];
    /** Description phrase for the current lunar phase */
    moonPhase: string[];
    /** 3 character short code for lunar phases */
    moonPhaseCode: MoonPhaseCode[];
    /** Day number within monthly lunar cycle */
    moonPhaseDay: number[];
    /** ISO timestamp. First moonrise in local time. It reflects daylight savings time conventions. */
    moonriseTimeLocal: (string | null)[];
    /** Moonrise time in UNIX epoch value */
    moonriseTimeUtc: (number | null)[];
    /** ISO timestamp. First Moonset in local time. It reflects daylight savings time conventions. */
    moonsetTimeLocal: (string | null)[];
    /** Moonset time in UNIX epoch value */
    moonsetTimeUtc: (number | null)[];
    /** The narrative forecast for the 24-hour period. */
    narrative: string[];
    /** The forecasted measurable precipitation (liquid or liquid equivalent) during 12 or 24 hour period. */
    qpf: number[];
    /** The forecasted measurable precipitation as snow during the 12 or 24 hour forecast period. */
    qpfSnow: number[];
    /** ISO timestamp. The local time of the sunrise. It reflects any local daylight savings conventions. For a few Arctic and Antarctic regions, the Sunrise and Sunset data values may be the same (each with a value of 12:01am) to reflect conditions where a sunrise or sunset does not occur. */
    sunriseTimeLocal: (string | null)[];
    /** Sunrise time in UNIX epoch value */
    sunriseTimeUtc: (number | null)[];
    /** ISO timestamp. The local time of the sunset. It reflects any local daylight savings conventions. For a few Arctic and Antarctic regions, the Sunrise and Sunset data values may be the same (each with a value of 12:01am) to reflect conditions where a sunrise or sunset does not occur. */
    sunsetTimeLocal: (string | null)[];
    /** Sunset time in UNIX epoch value */
    sunsetTimeUtc: (number | null)[];
    /** Daily maximum temperature */
    temperatureMax: (number | null)[];
    /** Daily minimum temperature */
    temperatureMin: number[];
    /** ISO timestamp. Time forecast is valid in local apparent time. */
    validTimeLocal: string[];
    /** Time forecast is valid in UNIX seconds */
    validTimeUtc: number[];

    daypart: [DayPartData];
}

interface DayPartData {
    /** Daytime average cloud cover expressed as a percentage. */
    cloudCover: (number | null)[];
    /** Day or night indicator */
    dayOrNight: ("D" | "N" | null)[];
    /** The name of a 12 hour daypart not including day names in the first 48 hours. */
    daypartName: (string | null)[];
    /** This number is the key to the weather icon lookup. The data field shows the icon number that is matched to represent the observed weather conditions */
    iconCode: (number | null)[];
    /** Code representing full set sensible weather */
    iconCodeExtend: (number | null)[];
    /** The narrative forecast for the daytime period. */
    narrative: string[];
    /** Maximum probability of precipitation. */
    precipChance: (number | null)[];
    /** Type of precipitation to display with the probability of precipitation (pop) data element. */
    precipType: ("rain" | "snow" | "precip" | null)[];
    /** The forecasted measurable precipitation (liquid or liquid equivalent) during the 12 hour forecast period. */
    qpf: (number | null)[];
    /** The forecasted measurable precipitation as snow during the 12 hour forecast period. */
    qpfSnow: (number | null)[];
    /**  */
    qualifierCode: (string | null)[];
    /** A phrase associated to the qualifier code describing special weather criteria. */
    qualifierPhrase: (string | null)[];
    /** The relative humidity of the air, which is defined as the ratio of the amount of water vapor in the air to the amount of vapor required to bring the air to saturation at a constant temperature. Relative humidity is always expressed as a percentage. */
    relativeHumidity: (number | null)[];
    /** Snow accumulation amount for the 12 hour forecast period. */
    snowRange: (string | null)[];
    /** Feels Like can move from the Heat Index and Wind Chill areas somewhat commonly.  It would occur when the temperature spans across 65 F, where Heat Index is used above that value and Wind Chill is used below that value. */
    temperature: number[];
    /** An apparent temperature.  It represents what the air temperature “feels like” on exposed human skin due to the combined effect of warm temperatures and high humidity. 
     * Above 65°F, it is set = to the temperature. 
     * Units - Expressed in fahrenheit when units=e, expressed in celsius when units=m, s, or h.
     */
    temperatureHeatIndex: number[];
    /** An apparent temperature. It represents what the air temperature “feels like” on exposed human skin due to the combined effect of the cold temperatures and wind speed.
     * Below  65°F, it is set = to the temperature. 
     * Units - Expressed in fahrenheit when units=e, expressed in celsius when units=m, s, or h.
     */
    temperatureWindChill: number[];
    /** The description of probability thunderstorm activity in an area for 12 hour daypart.
     * - 0 = "No thunder";
     * - 1 = "Thunder possible";
     * - 2 = "Thunder expected";
     * - 3 = "Severe thunderstorms possible";
     * - 4 = "Severe thunderstorms likely";
     * - 5 = "High risk of severe thunderstorms"
     */
    thunderCategory: (string | null)[];
    /** The enumeration of thunderstorm probability within an area for a 12 hour daypart. */
    thunderIndex: (number | null)[];
    /** The UV Index Description which complements the UV Index value by providing an associated level of risk of skin damage due to exposure.

     * - -2 = Not Available,
     * - -1 = "No Report",
     * - 0 to 2 = Low,
     * - 3 to 5 = Moderate,
     * - 6 to 7 = High,
     * - 8 to 10 = Very High,
     * - 11 to 16 = Extreme
 */
    uvDescription: ("High" | "Low" | "Moderate" | "Not Available" | "Not Available" | "Very High" | "Extreme" | null)[];
    /** Maximum UV index for the 12 hour forecast period. */
    uvIndex: (number | null)[];
    /** Average wind direction in magnetic notation. */
    windDirection: (number | null)[];
    /** Average wind direction in cardinal notation. */
    windDirectionCardinal: (string | null)[];
    /** The phrase that describes the wind direction and speed for a 12 hour daypart. */
    windPhrase: (string | null)[];
    /** The maximum forecasted wind speed.
The wind is treated as a vector; hence, winds must have direction and magnitude (speed). The wind information reported in the hourly current conditions corresponds to a 10-minute average called the sustained wind speed. Sudden or brief variations in the wind speed are known as “wind gusts” and are reported in a separate data field. Wind directions are always expressed as "from whence the wind blows" meaning that a North wind blows from North to South. If you face North in a North wind the wind is at your face. Face southward and the North wind is at your back.
 */
    windSpeed: (number | null)[];
    /** Sensible weather phrase */
    wxPhraseLong: (string | null)[];
    /** Sensible weather phrase */
    wxPhraseShort: (string | null)[];
}

// Internal

interface NearbyStation {
    stationName: string;
    stationId: string;
    latitude: number;
    longitude: number;
    distanceKm: number;
}


type ObservationInternalData = Partial<Omit<WeatherData, "forecasts" | "hourlyForecast" | "location" | "coord" | "wind" | "sunrise" | "date" | "sunset">> & 
                       Pick<WeatherData, "wind" | "date" | "sunrise" | "sunset" | "location">; 