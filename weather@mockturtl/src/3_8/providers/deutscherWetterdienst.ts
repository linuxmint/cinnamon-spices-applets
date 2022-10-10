import { DateTime } from "luxon";
import { getTimes, GetTimesResult } from "suncalc";
import { Services } from "../config";
import { ErrorResponse, HTTPParams } from "../lib/httpLib";
import { Condition, ForecastData, HourlyForecastData, LocationData, WeatherData, PrecipitationType } from "../types";
import { IsNight, _ } from "../utils";
import { BaseProvider } from "./BaseProvider"


export class DeutscherWetterdienst extends BaseProvider {
    public needsApiKey: boolean = false;
    public prettyName: string = _("Deutscher Wetterdienst");
    public name: Services = "DeutscherWetterdienst";
    public maxForecastSupport: number = 10;
    public maxHourlyForecastSupport: number = 240;
    public website: string = "https://www.dwd.de/DE/Home/home_node.html";
    public remainingCalls: number | null = null;

    private readonly baseUrl: string = "https://api.brightsky.dev/";

    public async GetWeather(loc: LocationData): Promise<WeatherData | null> {
        const [current, hourly] = await Promise.all([
            this.app.LoadJsonAsync<CurrentWeatherPayload>(`${this.baseUrl}current_weather`, this.GetDefaultParams(loc), this.HandleErrors),
            this.app.LoadJsonAsync<HourlyForecastPayload>(`${this.baseUrl}weather`, this.GetHourlyParams(loc), this.HandleErrors)
        ]);

        if (current == null || hourly == null)
            return null;

        const currentTime = DateTime.fromISO(current.weather.timestamp).setZone(loc.timeZone);
        const sunTimes = getTimes(currentTime.toJSDate(), loc.lat, loc.lon);
        const mainSource = current.sources.find(source => source.id == current.weather.source_id) ?? current.sources[0];

        return {
            date: DateTime.fromISO(current.weather.timestamp).setZone(loc.timeZone),
            location: {
                city: loc.city ?? current.sources[0].station_name ?? undefined,
                country: loc.country,
                timeZone: loc.timeZone,
            },
            coord: {
                lon: loc.lon,
                lat: loc.lat,
            },
            sunrise: DateTime.fromJSDate(sunTimes.sunrise).setZone(loc.timeZone),
            sunset: DateTime.fromJSDate(sunTimes.sunset).setZone(loc.timeZone),
            condition: this.IconToInfo(current.weather.icon),
            wind: {
                degree: current.weather.wind_direction_10,
                speed: current.weather.wind_speed_10
            },
            temperature: current.weather.temperature,
            pressure: current.weather.pressure_msl ? (current.weather.pressure_msl / 100) : null,
            humidity: current.weather.relative_humidity,
            dewPoint: current.weather.dew_point,
            stationInfo: {
                distanceFrom: mainSource.distance,
                lat: mainSource.lat,
                lon: mainSource.lon,
                name: mainSource.station_name ?? undefined
            },
            forecasts: this.ParseForecast(current, hourly, loc),
            hourlyForecasts: this.ParseHourlyForecast(hourly, loc)
        };
    }

    private ParseForecast(current: CurrentWeatherPayload, forecast: HourlyForecastPayload, loc: LocationData): ForecastData[] {
        const result: ForecastData[] = [];
        // Now normalized to the current hour 
        const days = this.SplitToDays(forecast, loc);

        for (const day of days) {
            let tempMax: number = -Infinity;
            let tempMin: number = Infinity;
            let conditions: Icon[] = [];
            let time: DateTime | null = null;

            for (const hour of day) {
                // Setting time only once is enough
                if (time == null)
                    time = DateTime.fromISO(hour.timestamp).setZone(loc.timeZone);

                if (hour.icon != null)
                    conditions.push(hour.icon);
                if (hour.temperature != null) {
                    tempMax = Math.max(tempMax, hour.temperature);
                    tempMin = Math.min(tempMin, hour.temperature);
                }
            }
            
            // a day had 0 items or no temperature data, we have to break of otherwise we will have inconsistent data on display
            if (time == null || tempMin == Infinity || tempMax == -Infinity)
                break;

            result.push({
                date: time.set({hour: 12, minute: 0, second: 0, millisecond: 0}),
                temp_max: tempMax,
                temp_min: tempMin,
                // If day begins with night
                condition: this.CalculateDayCondition(conditions)
            })
        }
        return result;
    }

    private SplitToDays(forecast: HourlyForecastPayload, loc: LocationData): HourlyForecastInfo[][] {
        const now = DateTime.now().setZone(loc.timeZone).set({minute: 0, second: 0, millisecond: 0});
        const days: HourlyForecastInfo[][] = [];

        let prevTimeStamp: DateTime = now;
        let currentDay: HourlyForecastInfo[] = [];
        for (const hour of forecast.weather) {
            const time = DateTime.fromISO(hour.timestamp).setZone(loc.timeZone);
            // Don't include stuff in the past
            if (time < now)
                continue;

            // Accumulate if still on the same day
            if (prevTimeStamp.hasSame(time, "day")) {
                currentDay.push(hour);
            }
            // reached a boundary, push to days and cleanup
            else {
                days.push(currentDay);
                currentDay = [];
                currentDay.push(hour);
            }

            prevTimeStamp = time;
        }
        // Push the last day if it has items
        if (currentDay.length > 0)
            days.push(currentDay);

        return days;
    }

    private CalculateDayCondition(conditions: Icon[]): Condition {
        if (conditions.length == 0)
            return {
                main: _("Unknown"),
                description: _("Unknown"),
                icons: [],
                customIcon: "cloud-refresh-symbolic"
            }

        // Normalize conditions
        for (let i = 0; i < conditions.length; i++) {
            const condition = conditions[i];
            // Clearly there is an easier way to do this, but this is fine if it's just 2
            if (condition == "clear-night")
                conditions[i] = "clear-day";
            if (condition == "partly-cloudy-night")
                conditions[i] = "partly-cloudy-day";
        }

        const severeWeathers: Partial<Record<Icon, number>> = {};
        const regularWeather: Partial<Record<Icon, number>> = {};
        const regularConditions: Icon[] = [ "clear-day", "clear-night", "cloudy", "fog", "partly-cloudy-day", "partly-cloudy-night" ]

        for (const condition of conditions) {
            if (regularConditions.includes(condition))
                regularWeather[condition] == null ? regularWeather[condition] = 0 : regularWeather[condition]!++;
            else
                severeWeathers[condition] == null ? severeWeathers[condition] = 0 : severeWeathers[condition]!++;
        }

        const conditionsToCount = Object.keys(severeWeathers).length > 0 ? severeWeathers : regularWeather; 

        const mostFrequentCondition = Object.entries(conditionsToCount).reduce((p, c) => p[1] > c[1] ? p : c)[0] as Icon;
        return this.IconToInfo(mostFrequentCondition);
    }

    private ParseHourlyForecast(forecast: HourlyForecastPayload, loc: LocationData): HourlyForecastData[] {
        const now = DateTime.now().setZone(loc.timeZone).set({minute: 0, second: 0, millisecond: 0});
        const result: HourlyForecastData[] = [];
        for (const hour of forecast.weather) {
            const time = DateTime.fromISO(hour.timestamp).setZone(loc.timeZone);
            // Don't include stuff in the past
            if (time < now)
                continue;

            const data: HourlyForecastData = {
                condition: this.IconToInfo(hour.icon),
                date: time,
                temp: hour.temperature,
            }
            if (hour.precipitation != null && hour.precipitation > 0 && hour.condition != null && ["snow", "rain"].includes(hour.condition)) {
                data.precipitation = {
                    volume: hour.precipitation,
                    type: this.DWDConditionToPrecipType(hour.condition)
                }
            }

            result.push(data);
        }

        return result;
    }

    private DWDConditionToPrecipType(condition: DWDCondition): PrecipitationType {
        switch(condition) {
            case "dry":
            case "fog":
            case "thunderstorm":
                return "none";
            case "rain":
                return "rain";
            case "snow":
                return "snow";
            case "hail":
                return "ice pellets";
            case "sleet":
                return "freezing rain";
        }
    }

    private IconToInfo(icon: Icon | null): Condition {
        switch(icon) {
            case "clear-day":
                return {
                    main: _("Clear"),
                    description: _("Clear"),
                    icons: ["weather-clear"],
                    customIcon: "day-sunny-symbolic"
                }
            case "clear-night":
                return {
                    main: _("Clear"),
                    description: _("Clear"),
                    icons: ["weather-clear-night"],
                    customIcon: "night-clear-symbolic"
                }
            case "cloudy":
                return {
                    main: _("Cloudy"),
                    description: _("Cloudy"),
                    icons: ["weather-overcast"],
                    customIcon: "cloudy-symbolic"
                }
            case "fog":
                return {
                    main: _("Fog"),
                    description: _("Fog"),
                    icons: ["weather-fog"],
                    customIcon: "fog-symbolic"
                }
            case "hail":
                return {
                    main: _("Hail"),
                    description: _("Hail"),
                    icons: ["weather-freezing-rain"],
                    customIcon: "hail-symbolic"
                }
            case "partly-cloudy-day":
                return {
                    main: _("Partly Cloudy"),
                    description: _("Partly Cloudy"),
                    icons: ["weather-few-clouds"],
                    customIcon: "day-cloudy-symbolic"
                }
            case "partly-cloudy-night":
                return {
                    main: _("Partly Cloudy"),
                    description: _("Partly Cloudy"),
                    icons: ["weather-few-clouds-night"],
                    customIcon: "night-cloudy-symbolic"
                }
            case "rain":
                return {
                    main: _("Rain"),
                    description: _("Rain"),
                    icons: ["weather-rain", "weather-showers", "weather-showers-scattered"],
                    customIcon: "rain-symbolic"
                }
            case "sleet":
                return {
                    main: _("Sleet"),
                    description: _("Sleet"),
                    icons: ["weather-rain", "weather-showers", "weather-showers-scattered"],
                    customIcon: "sleet-symbolic"
                }
            case "snow":
                return {
                    main: _("Snow"),
                    description: _("Snow"),
                    icons: ["weather-snow"],
                    customIcon: "snow-symbolic"
                }
            case "thunderstorm":
                return {
                    main: _("Thunderstorm"),
                    description: _("Thunderstorm"),
                    icons: ["weather-storm"],
                    customIcon: "thunderstorm-symbolic"
                }
            case "wind":
                return {
                    main: _("Wind"),
                    description: _("Wind"),
                    icons: ["weather-windy", "weather-breeze"],
                    customIcon: "windy-symbolic"
                }
            default: 
                return {
                    main: _("Unknown"),
                    description: _("Unknown"),
                    icons: [],
                    customIcon: "cloud-refresh-symbolic"
                }
        }
    }

    private HandleErrors = (message: ErrorResponse): boolean => {
        if (message.ErrorData.code == 404) {
            this.app.ShowError({
                detail: "location not covered",
                message: _("Please select a different provider or location"),
                userError: true,
                type: "hard"
            })
            return true;
        }
        return false;
    }

    private GetDefaultParams(loc: LocationData): HTTPParams {
        return {
            lat: loc.lat,
            lon: loc.lon,
            units: "si"
        }
    }

    private GetHourlyParams(loc: LocationData): HTTPParams {
        const params = this.GetDefaultParams(loc);
        const date = loc.timeZone ? DateTime.now().setZone(loc.timeZone) : DateTime.now();
        params.date = date.toISO();
        params.last_date = date.plus({days: 10}).toISO();
        return params;
    }

}

interface CurrentWeatherPayload {
    weather: CurrentWeatherInfo;
    sources: StationData[];
}

interface HourlyForecastPayload {
    weather: HourlyForecastInfo[];
    sources: StationData[];
}

interface CurrentWeatherInfo {
    /** ISO 8601-formatted timestamp of this weather record/forecast */
    timestamp: string;
    /** Bright Sky source ID for this record */
    source_id: number; 
    /** Total cloud cover at timestamp */
    cloud_cover: number | null;
    /** Current weather conditions. Unlike the numerical parameters, this field is not taken as-is from the raw data (because it does not exist), but is calculated from different fields in the raw data as a best effort. Not all values are available for all source types. */
    condition: DWDCondition | null;
    /** Dew point at timestamp, 2 m above ground */
    dew_point: number | null;
    /** Icon alias suitable for the current weather conditions. Unlike the numerical parameters, this field is not taken as-is from the raw data (because it does not exist), but is calculated from different fields in the raw data as a best effort. Not all values are available for all source types. */
    icon: Icon | null;
    /** Total precipitation during previous 10 minutes */
    precipitation_10: number | null;
    /** Total precipitation during previous 30 minutes */
    precipitation_30: number | null;
    /** Total precipitation during previous 60 minutes */
    precipitation_60: number | null;
    /** Atmospheric pressure at timestamp, reduced to mean sea level */
    pressure_msl: number | null;
    /** Relative humidity at timestamp */
    relative_humidity: number | null;
    /** Sunshine duration during previous 30 minutes */
    sunshine_30: number | null;
    /** Sunshine duration during previous 60 minutes */
    sunshine_60: number | null;
    /** Air temperature at timestamp, 2 m above the ground */
    temperature: number | null;
    /** Visibility at timestamp */
    visibility: number | null;
    /** Mean wind direction during previous 10 minutes, 10 m above the ground */
    wind_direction_10: number | null;
    /** Mean wind direction during previous 30 minutes, 10 m above the ground */
    wind_direction_30: number | null;
    /** Mean wind direction during previous 60 minutes, 10 m above the ground */
    wind_direction_60: number | null;
    /** Mean wind speed during previous previous 10 minutes, 10 m above the ground */
    wind_speed_10: number | null;
    /** Mean wind speed during previous previous 30 minutes, 10 m above the ground */
    wind_speed_30: number | null;
    /** Mean wind speed during previous previous 60 minutes, 10 m above the ground */
    wind_speed_60: number | null;
    /** Direction of maximum wind gust during previous 10 minutes, 10 m above the ground */
    wind_gust_direction_10: number | null;
    /** Direction of maximum wind gust during previous 30 minutes, 10 m above the ground */
    wind_gust_direction_30: number | null;
    /** Direction of maximum wind gust during previous 60 minutes, 10 m above the ground */
    wind_gust_direction_60: number | null;
    /** Speed of maximum wind gust during previous 10 minutes, 10 m above the ground */
    wind_gust_speed_10: number | null;
    /** Speed of maximum wind gust during previous 30 minutes, 10 m above the ground */
    wind_gust_speed_30: number | null;
    /** Speed of maximum wind gust during previous 60 minutes, 10 m above the ground */
    wind_gust_speed_60: number | null;
}

interface HourlyForecastInfo {
    /** ISO 8601-formatted timestamp of this weather record/forecast */
    timestamp: string;
    /** Main Bright Sky source ID for this record */
    source_id: number;
    /**  Total cloud cover at timestamp, % */
    cloud_cover: number | null;
    /**  Current weather conditions. Unlike the numerical parameters, this field is not taken as-is from the raw data (because it does not exist), but is calculated from different fields in the raw data as a best effort. Not all values are available for all source types.   */
    condition: DWDCondition | null;
    /** Dew point at timestamp, 2 m above ground. Kelvin */
    dew_point: number | null;
    /** Icon alias suitable for the current weather conditions. Unlike the numerical parameters, this field is not taken as-is from the raw data (because it does not exist), but is calculated from different fields in the raw data as a best effort. Not all values are available for all source types. */
    icon: Icon | null;
    /** Total precipitation during previous 60 minutes */
    precipitation: number | null;
    /** Atmospheric pressure at timestamp, reduced to mean sea level */
    pressure_msl: number | null;
    /** Relative humidity at timestamp */
    relative_humidity: number | null;
    /** Sunshine duration during previous 60 minutes */
    sunshine: number | null;
    /** Air temperature at timestamp, 2 m above the ground */
    temperature: number | null;
    /** Visibility at timestamp */
    visibility: number | null;
    /** Mean wind direction during previous hour, 10 m above the ground */
    wind_direction: number | null;
    /** Mean wind speed during previous hour, 10 m above the ground */
    wind_speed: number | null;
    /** Direction of maximum wind gust during previous hour, 10 m above the ground */
    wind_gust_direction: number | null;
    /** Speed of maximum wind gust during previous hour, 10 m above the ground */
    wind_gust_speed: number | null;
    /** Object mapping meteorological parameters to the source IDs of alternative sources that were used to fill up missing values in the main source */
    fallback_source_ids: any;
}

type DWDCondition = "dry" | "fog" | "rain" | "sleet" | "snow" | "hail" | "thunderstorm";

type Icon = "clear-day" | "clear-night" | "partly-cloudy-day" | "partly-cloudy-night" | "cloudy" | "fog" | "wind" | "rain" | "sleet" | "snow" | "hail" | "thunderstorm";

interface StationData {
    id: number;
    dwd_station_id: string | null;
    wmo_station_id: string | null;
    station_name: string | null;
    observation_type: "historical" | "synop" | "forecast" | "current";
    lat: number;
    lon: number;
    height: number;
    distance: number;
    /**  Timestamp of first available record for this source */
    first_record?: string;
    /** Timestamp of latest available record for this source */
    last_record?: string;
}