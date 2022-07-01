import { DateTime } from "luxon";
import { Services } from "../config";
import { ErrorResponse, HTTPParams } from "../lib/httpLib";
import { LocationData, WeatherData } from "../types";
import { _ } from "../utils";
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
            this.app.LoadJsonAsync<CurrentWeatherPayload>(`${this.baseUrl}current`, this.GetDefaultParams(loc), this.HandleErrors),
            this.app.LoadJsonAsync<HourlyForecastPayload>(`${this.baseUrl}current_weather`, this.GetHourlyParams(loc), this.HandleErrors)
        ]);


        return null;
    }

    private HandleErrors = (message: ErrorResponse): boolean => {
        if (message.Response?.status_code == 404) {
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
    weather: [CurrentWeatherInfo];
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
    condition: Condition | null;
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
    condition: Condition | null;
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

type Condition = "dry" | "fog" | "rain" | "sleet" | "snow" | "hail" | "thunderstorm";

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