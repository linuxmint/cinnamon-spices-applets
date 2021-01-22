//////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////
///////////                                       ////////////
///////////                Climacell              ////////////
///////////                                       ////////////
//////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////

import { HttpError } from "./httpLib";
import { Log } from "./logger";
import { WeatherApplet } from "./main";
import { SunTimes } from "./sunCalc";
import { WeatherProvider, WeatherData, HourlyForecastData, ForecastData, Condition, LocationData } from "./types";
import { CelsiusToKelvin, _, IsNight, weatherIconSafely } from "./utils";

const Lang: typeof imports.lang = imports.lang;

export class Climacell implements WeatherProvider {

    //--------------------------------------------------------
    //  Properties
    //--------------------------------------------------------
    public readonly prettyName = "Climacell";
    public readonly name = "Climacell";
    public readonly maxForecastSupport = 16;
    public readonly website = "https://www.climacell.co/";
    public readonly maxHourlyForecastSupport = 96;

    private baseUrl = "https://api.climacell.co/v3/weather/";
    private callData: CallDict = {
        current: {
            url: "realtime/",
            required_fields: ["temp", "feels_like", "humidity", "wind_speed", "wind_direction", "baro_pressure", "sunrise", "sunset", "weather_code"]
        },
        hourly: {
            url: "forecast/hourly/",
            required_fields: ["temp", "weather_code", "sunset", "sunrise", "precipitation_type", "precipitation_probability"]
        },
        daily: {
            url: "forecast/daily/",
            required_fields: ["temp", "weather_code", "sunset", "sunrise"],
        }
    }

    private unit: queryUnits = "si";
    private app: WeatherApplet

    constructor(_app: WeatherApplet) {
        this.app = _app;
    }

    //--------------------------------------------------------
    //  Functions
    //--------------------------------------------------------
    public async GetWeather(loc: LocationData): Promise<WeatherData> {
        let hourly = this.GetData("hourly", loc, Lang.bind(this, this.ParseHourly)) as Promise<HourlyForecastData[]>;
        let daily = this.GetData("daily", loc, Lang.bind(this, this.ParseDaily)) as Promise<ForecastData[]>;
        let current = await this.GetData("current", loc, Lang.bind(this, this.ParseWeather)) as WeatherData;
        current.forecasts = await daily;
        current.hourlyForecasts = await hourly;

        return current;
    };

    /**
     * 
     * @param baseUrl 
     * @param ParseFunction returns WeatherData or ForecastData Object
     */
    private async GetData(baseUrl: CallType, loc: LocationData, ParseFunction: (json: any) => WeatherData | ForecastData[] | HourlyForecastData[]) {
		let query = this.ConstructQuery(baseUrl, loc);
		if (query == null)
			return null;

		let json = await this.app.LoadJsonAsync(query, null, Lang.bind(this, this.HandleError));

		if (json == null)
			return null;

		return ParseFunction(json);
    };


    private ParseWeather(json: any): WeatherData {
        try {
            let sunTimes: SunTimes = {
                sunrise: new Date(json.sunrise.value),
                sunset: new Date(json.sunset.value)
            }
            let result: WeatherData = {
                coord: {
                    lat: json.lat,
                    lon: json.lon
                },
                date: new Date(json.observation_time.value),
                sunrise: new Date(json.sunrise.value),
                sunset: new Date(json.sunset.value),
                temperature: CelsiusToKelvin(json.temp.value),
                humidity: json.humidity.value,
                location: {
                    url: null,
                    city: null,
                    country: null,
                    timeZone: null
                },
                pressure: json.baro_pressure.value,
                wind: {
                    degree: json.wind_direction.value,
                    speed: json.wind_speed.value
                },
                extra_field: {
                    name: _("Feels Like"),
                    type: "temperature",
                    value: CelsiusToKelvin(json.feels_like.value)
                },
                condition: this.ResolveCondition(json.weather_code.value, IsNight(sunTimes)),
                forecasts: []
            };


            return result;
        }
        catch (e) {
            Log.Instance.Error("Climacell payload parsing error: " + e)
            this.app.ShowError({ type: "soft", detail: "unusual payload", service: "climacell", message: _("Failed to Process Weather Info") });
            return null;
        }
    };

    private ParseHourly(json: any): HourlyForecastData[] {
        let results: HourlyForecastData[] = [];
        for (let index = 0; index < json.length; index++) {
            const element = json[index];
            let sunTimes: SunTimes = {
                sunrise: new Date(element.sunrise.value),
                sunset: new Date(element.sunset.value)
            }
            let hour: HourlyForecastData = {
                temp: CelsiusToKelvin(element.temp.value),
                date: new Date(element.observation_time.value),
                precipitation: {
                    type: element.precipitation_type.value,
                    volume: null,
                    chance: element.precipitation_probability.value
                },
                condition: this.ResolveCondition(element.weather_code.value, IsNight(sunTimes, new Date(element.observation_time.value)))
            }
            results.push(hour);
        }
        return results;
    }

    private ParseDaily(json: any): ForecastData[] {
        let results: ForecastData[] = [];
        for (let index = 0; index < json.length; index++) {
            const element = json[index];
            let day: ForecastData = {
                date: new Date(element.observation_time.value),
                temp_max: CelsiusToKelvin(element.temp[1].max.value),
                temp_min: CelsiusToKelvin(element.temp[0].min.value),
                condition: this.ResolveCondition(element.weather_code.value)
            }
            results.push(day);
        }
        return results;
    }

    private ConstructQuery(callType: CallType, loc: LocationData): string {
        let query;
        let key = this.app.config._apiKey.replace(" ", "");
        if (this.app.config.NoApiKey()) {
            Log.Instance.Error("Climacell: No API Key given");
            this.app.ShowError({
                type: "hard",
                userError: true,
                "detail": "no key",
                message: _("Please enter API key in settings,\nor get one first on " + "https://developer.climacell.co/sign-up")
            });
            return null;
        }
        query = this.baseUrl + this.callData[callType].url + "?apikey=" + key + "&lat=" + loc.lat + "&lon=" + loc.lon + "&unit_system=" + this.unit + "&fields=" + this.callData[callType].required_fields.join();
        return query;
    };

    /**
    * 
    * @param message Soup Message object
    * @returns null if custom error checking does not find anything
    */
    private HandleError(message: HttpError): boolean {
        if (message.code == 403) {
            this.app.ShowError({
                type: "hard",
                userError: true,
                detail: "bad key",
                service: "climacell",
                message: _("Please Make sure you\nentered the API key correctly and your account is not locked")
            });
            return false;
        }
        else if (message.code == 401) {
            this.app.ShowError({
                type: "hard",
                userError: true,
                detail: "no key",
                service: "climacell",
                message: _("Please Make sure you\nentered the API key what you have from Climacell")
            });
            return false;
        }
        return true;
    }

    private ResolveCondition(condition: string, isNight: boolean = false): Condition {
        switch (condition) {
            case ("rain_heavy"):
                return {
                    customIcon: "rain-symbolic",
                    description: _("Substantial Rain"),
                    main: _("Substantial Rain"),
                    icon: weatherIconSafely(["weather-rain", "weather-freezing-rain", "weather-showers-scattered"], this.app.config.IconType)
                }
            case ("rain"):
                return {
                    customIcon: "rain-symbolic",
                    description: _("Rain"),
                    main: _("Rain"),
                    icon: weatherIconSafely(["weather-rain", "weather-freezing-rain", "weather-showers-scattered"], this.app.config.IconType)
                }
            case ("rain_light"):
                return {
                    customIcon: "rain-mix-symbolic",
                    description: _("Light Rain"),
                    main: _("Light Rain"),
                    icon: weatherIconSafely(["weather-showers-scattered", "weather-rain", "weather-freezing-rain"], this.app.config.IconType)
                }
            case ("freezing_rain_heavy"):
                return {
                    customIcon: "hail-symbolic",
                    description: _("Substantial Freezing Rain"),
                    main: _("Freezing Rain"),
                    icon: weatherIconSafely(["weather-freezing-rain", "weather-rain", "weather-showers-scattered"], this.app.config.IconType)
                }
            case ("freezing_rain"):
                return {
                    customIcon: "hail-symbolic",
                    description: _("Freezing Rain"),
                    main: _("Freezing Rain"),
                    icon: weatherIconSafely(["weather-freezing-rain", "weather-rain", "weather-showers-scattered"], this.app.config.IconType)
                }
            case ("freezing_rain_light"):
                return {
                    customIcon: "hail-symbolic",
                    description: _("Light Freezing Rain"),
                    main: _("Freezing Rain"),
                    icon: weatherIconSafely(["weather-showers-scattered", "weather-freezing-rain", "weather-rain"], this.app.config.IconType)
                }
            case ("freezing_drizzle"):
                return {
                    customIcon: "sleet-symbolic",
                    description: _("Light freezing drizzle"),
                    main: _("Freezing Drizzle"),
                    icon: weatherIconSafely(["weather-showers-scattered", "weather-rain", "weather-freezing-rain"], this.app.config.IconType)
                }
            case ("drizzle"):
                return {
                    customIcon: "sleet-symbolic",
                    description: _("Light Drizzle"),
                    main: _("Light Drizzle"),
                    icon: weatherIconSafely(["weather-showers-scattered", "weather-rain", "weather-freezing-rain"], this.app.config.IconType)
                }
            case ("ice_pellets_heavy"):
                return {
                    customIcon: "snow-wind-symbolic",
                    description: _("Substantial Ice Pellets"),
                    main: _("Ice Pellets"),
                    icon: weatherIconSafely(["weather-freezing-rain", "weather-rain", "weather-showers-scattered"], this.app.config.IconType)
                }
            case ("ice_pellets"):
                return {
                    customIcon: "snow-wind-symbolic",
                    description: _("Ice Pellets"),
                    main: _("Ice Pellets"),
                    icon: weatherIconSafely(["weather-freezing-rain", "weather-rain", "weather-showers-scattered"], this.app.config.IconType)
                }
            case ("ice_pellets_light"):
                return {
                    customIcon: "snow-wind-symbolic",
                    description: _("Light Ice Pellets"),
                    main: _("Ice Pellets"),
                    icon: weatherIconSafely(["weather-freezing-rain", "weather-rain", "weather-showers-scattered"], this.app.config.IconType)
                }
            case ("snow_heavy"):
                return {
                    customIcon: "snow-symbolic",
                    description: _("Substantial Snow"),
                    main: _("Substantial Snow"),
                    icon: weatherIconSafely(["weather-snow"], this.app.config.IconType)
                }
            case ("snow"):
                return {
                    customIcon: "snow-symbolic",
                    description: _("Snow"),
                    main: _("Snow"),
                    icon: weatherIconSafely(["weather-snow"], this.app.config.IconType)
                }
            case ("snow_light"):
                return {
                    customIcon: "snow-symbolic",
                    description: _("Light Snow"),
                    main: _("Light Snow"),
                    icon: weatherIconSafely(["weather-snow"], this.app.config.IconType)
                }
            case ("flurries"):
                return {
                    customIcon: "cloudy-gusts-symbolic",
                    description: _("Flurries"),
                    main: _("Flurries"),
                    icon: weatherIconSafely(["weather-snow"], this.app.config.IconType)
                }
            case ("tstorm"):
                return {
                    customIcon: "thunderstorm-symbolic",
                    description: _("Thunderstorm"),
                    main: _("Thunderstorm"),
                    icon: weatherIconSafely(["weather-storm"], this.app.config.IconType)
                }
            case ("fog_light"):
                return {
                    customIcon: (isNight) ? "night-fog-symbolic" : "day-fog-symbolic",
                    description: _("Light Fog"),
                    main: _("Light Fog"),
                    icon: weatherIconSafely(["weather-fog"], this.app.config.IconType)
                }
            case ("fog"):
                return {
                    customIcon: "fog-symbolic",
                    description: _("Fog"),
                    main: _("Fog"),
                    icon: weatherIconSafely(["weather-fog"], this.app.config.IconType)
                }
            case ("cloudy"):
                return {
                    customIcon: "cloudy-symbolic",
                    description: _("Cloudy"),
                    main: _("Cloudy"),
                    icon: (isNight) ? weatherIconSafely(["weather-overcast", "weather-clouds-night", "weather-few-clouds-night"], this.app.config.IconType) : weatherIconSafely(["weather-overcast", "weather-clouds", "weather-few-clouds"], this.app.config.IconType)
                }
            case ("mostly_cloudy"):
                return {
                    customIcon: (isNight) ? "night-alt-cloudy-symbolic" : "day-cloudy-symbolic",
                    description: _("Mostly Cloudy"),
                    main: _("Mostly Cloudy"),
                    icon: weatherIconSafely((isNight) ? ["weather-clouds-night", "weather-few-clouds-night", "weather-overcast"] : ["weather-clouds", "weather-few-clouds", "weather-overcast"], this.app.config.IconType)
                }
            case ("partly_cloudy"):
                return {
                    customIcon: (isNight) ? "night-alt-cloudy-symbolic" : "day-cloudy-symbolic",
                    description: _("Partly Cloudy"),
                    main: _("Partly Cloudy"),
                    icon: weatherIconSafely((isNight) ? ["weather-clouds-night", "weather-few-clouds-night", "weather-overcast"] : ["weather-clouds", "weather-few-clouds", "weather-overcast"], this.app.config.IconType)
                }
            case ("mostly_clear"):
                return {
                    customIcon: (isNight) ? "night-alt-partly-cloudy-symbolic" : "day-cloudy-symbolic",
                    description: _("Mostly Clear"),
                    main: _("Mostly Clear"),
                    icon: weatherIconSafely((isNight) ? ["weather-few-clouds-night", "weather-clouds-night", "weather-overcast"] : ["weather-few-clouds", "weather-clouds", "weather-overcast"], this.app.config.IconType)
                }
            case ("clear"):
                return {
                    customIcon: (isNight) ? "night-clear-symbolic" : "day-sunny-symbolic",
                    description: (isNight) ? _("Clear") : _("Sunny"),
                    main: (isNight) ? _("Clear") : _("Sunny"),
                    icon: weatherIconSafely((isNight) ? ["weather-clear-night"] : ["weather-clear"], this.app.config.IconType)
                }
            default:
                Log.Instance.Error("condition code not found: " + condition);
                return {
                    customIcon: "refresh-symbolic",
                    description: _("Unknown"),
                    main: _("Unknown"),
                    icon: weatherIconSafely(["weather-severe-alert"], this.app.config.IconType)
                }
        }
    }
};

/**
 * - 'si' returns meter/sec and Celsius
 * - 'us' returns miles/hour and Fahrenheit
 */
type queryUnits = 'si' | 'us';

type CallType = "current" | "hourly" | "daily";
type CallDict = {
    [key in CallType]: CallData
}

interface CallData {
    url: string;
    required_fields: string[];
}