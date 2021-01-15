"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Climacell = void 0;
const utils_1 = require("./utils");
class Climacell {
    constructor(_app) {
        this.prettyName = "Climacell";
        this.name = "Climacell";
        this.maxForecastSupport = 16;
        this.website = "https://www.climacell.co/";
        this.maxHourlyForecastSupport = 96;
        this.baseUrl = "https://api.climacell.co/v3/weather/";
        this.callData = {
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
        };
        this.unit = "si";
        this.app = _app;
    }
    async GetWeather(loc) {
        let hourly = this.GetData("hourly", loc, this.ParseHourly);
        let daily = this.GetData("daily", loc, this.ParseDaily);
        let current = await this.GetData("current", loc, this.ParseWeather);
        current.forecasts = await daily;
        current.hourlyForecasts = await hourly;
        return current;
    }
    ;
    async GetData(baseUrl, loc, ParseFunction) {
        let query = this.ConstructQuery(baseUrl, loc);
        let json;
        if (query != null) {
            try {
                json = await this.app.LoadJsonAsync(query, this.OnObtainingData);
            }
            catch (e) {
                this.app.HandleHTTPError("climacell", e, this.app, null);
                return null;
            }
            if (json == null) {
                this.app.HandleError({ type: "soft", detail: "no api response", service: "climacell" });
                return null;
            }
            return ParseFunction(json, this);
        }
        else {
            return null;
        }
    }
    ;
    ParseWeather(json, ctx) {
        try {
            let suntimes = {
                sunrise: new Date(json.sunrise.value),
                sunset: new Date(json.sunset.value)
            };
            let result = {
                coord: {
                    lat: json.lat,
                    lon: json.lon
                },
                date: new Date(json.observation_time.value),
                sunrise: new Date(json.sunrise.value),
                sunset: new Date(json.sunset.value),
                temperature: utils_1.CelsiusToKelvin(json.temp.value),
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
                    name: utils_1._("Feels Like"),
                    type: "temperature",
                    value: utils_1.CelsiusToKelvin(json.feels_like.value)
                },
                condition: ctx.ResolveCondition(json.weather_code.value, utils_1.IsNight(suntimes)),
                forecasts: []
            };
            return result;
        }
        catch (e) {
            ctx.app.log.Error("Climacell payload parsing error: " + e);
            ctx.app.HandleError({ type: "soft", detail: "unusual payload", service: "climacell", message: utils_1._("Failed to Process Weather Info") });
            return null;
        }
    }
    ;
    ParseHourly(json, ctx) {
        let results = [];
        for (let index = 0; index < json.length; index++) {
            const element = json[index];
            let suntimes = {
                sunrise: new Date(element.sunrise.value),
                sunset: new Date(element.sunset.value)
            };
            let hour = {
                temp: utils_1.CelsiusToKelvin(element.temp.value),
                date: new Date(element.observation_time.value),
                precipitation: {
                    type: element.precipitation_type.value,
                    volume: null,
                    chance: element.precipitation_probability.value
                },
                condition: ctx.ResolveCondition(element.weather_code.value, utils_1.IsNight(suntimes, new Date(element.observation_time.value)))
            };
            results.push(hour);
        }
        return results;
    }
    ParseDaily(json, ctx) {
        let results = [];
        for (let index = 0; index < json.length; index++) {
            const element = json[index];
            let day = {
                date: new Date(element.observation_time.value),
                temp_max: utils_1.CelsiusToKelvin(element.temp[1].max.value),
                temp_min: utils_1.CelsiusToKelvin(element.temp[0].min.value),
                condition: ctx.ResolveCondition(element.weather_code.value)
            };
            results.push(day);
        }
        return results;
    }
    ConstructQuery(subcall, loc) {
        let query;
        let key = this.app.config._apiKey.replace(" ", "");
        if (this.app.config.noApiKey()) {
            this.app.log.Error("Climacell: No API Key given");
            this.app.HandleError({
                type: "hard",
                userError: true,
                "detail": "no key",
                message: utils_1._("Please enter API key in settings,\nor get one first on " + "https://developer.climacell.co/sign-up")
            });
            return null;
        }
        query = this.baseUrl + this.callData[subcall].url + "?apikey=" + key + "&lat=" + loc.lat + "&lon=" + loc.lon + "&unit_system=" + this.unit + "&fields=" + this.callData[subcall].required_fields.join();
        return query;
    }
    ;
    OnObtainingData(message) {
        if (message.status_code == 403) {
            return {
                type: "hard",
                userError: true,
                detail: "bad key",
                service: "climacell",
                message: utils_1._("Please Make sure you\nentered the API key correctly and your account is not locked")
            };
        }
        if (message.status_code == 401) {
            return {
                type: "hard",
                userError: true,
                detail: "no key",
                service: "climacell",
                message: utils_1._("Please Make sure you\nentered the API key what you have from Climacell")
            };
        }
        return null;
    }
    ResolveCondition(condition, isNight = false) {
        switch (condition) {
            case ("rain_heavy"):
                return {
                    customIcon: "rain-symbolic",
                    description: utils_1._("Substantial Rain"),
                    main: utils_1._("Substantial Rain"),
                    icon: utils_1.weatherIconSafely(["weather-rain", "weather-freezing-rain", "weather-showers-scattered"], this.app.config.IconType())
                };
            case ("rain"):
                return {
                    customIcon: "rain-symbolic",
                    description: utils_1._("Rain"),
                    main: utils_1._("Rain"),
                    icon: utils_1.weatherIconSafely(["weather-rain", "weather-freezing-rain", "weather-showers-scattered"], this.app.config.IconType())
                };
            case ("rain_light"):
                return {
                    customIcon: "rain-mix-symbolic",
                    description: utils_1._("Light Rain"),
                    main: utils_1._("Light Rain"),
                    icon: utils_1.weatherIconSafely(["weather-showers-scattered", "weather-rain", "weather-freezing-rain"], this.app.config.IconType())
                };
            case ("freezing_rain_heavy"):
                return {
                    customIcon: "hail-symbolic",
                    description: utils_1._("Substantial Freezing Rain"),
                    main: utils_1._("Freezing Rain"),
                    icon: utils_1.weatherIconSafely(["weather-freezing-rain", "weather-rain", "weather-showers-scattered"], this.app.config.IconType())
                };
            case ("freezing_rain"):
                return {
                    customIcon: "hail-symbolic",
                    description: utils_1._("Freezing Rain"),
                    main: utils_1._("Freezing Rain"),
                    icon: utils_1.weatherIconSafely(["weather-freezing-rain", "weather-rain", "weather-showers-scattered"], this.app.config.IconType())
                };
            case ("freezing_rain_light"):
                return {
                    customIcon: "hail-symbolic",
                    description: utils_1._("Light Freezing Rain"),
                    main: utils_1._("Freezing Rain"),
                    icon: utils_1.weatherIconSafely(["weather-showers-scattered", "weather-freezing-rain", "weather-rain"], this.app.config.IconType())
                };
            case ("freezing_drizzle"):
                return {
                    customIcon: "sleet-symbolic",
                    description: utils_1._("Light freezing drizzle"),
                    main: utils_1._("Freezing Drizzle"),
                    icon: utils_1.weatherIconSafely(["weather-showers-scattered", "weather-rain", "weather-freezing-rain"], this.app.config.IconType())
                };
            case ("drizzle"):
                return {
                    customIcon: "sleet-symbolic",
                    description: utils_1._("Light Drizzle"),
                    main: utils_1._("Light Drizzle"),
                    icon: utils_1.weatherIconSafely(["weather-showers-scattered", "weather-rain", "weather-freezing-rain"], this.app.config.IconType())
                };
            case ("ice_pellets_heavy"):
                return {
                    customIcon: "snow-wind-symbolic",
                    description: utils_1._("Substantial Ice Pellets"),
                    main: utils_1._("Ice Pellets"),
                    icon: utils_1.weatherIconSafely(["weather-freezing-rain", "weather-rain", "weather-showers-scattered"], this.app.config.IconType())
                };
            case ("ice_pellets"):
                return {
                    customIcon: "snow-wind-symbolic",
                    description: utils_1._("Ice Pellets"),
                    main: utils_1._("Ice Pellets"),
                    icon: utils_1.weatherIconSafely(["weather-freezing-rain", "weather-rain", "weather-showers-scattered"], this.app.config.IconType())
                };
            case ("ice_pellets_light"):
                return {
                    customIcon: "snow-wind-symbolic",
                    description: utils_1._("Light Ice Pellets"),
                    main: utils_1._("Ice Pellets"),
                    icon: utils_1.weatherIconSafely(["weather-freezing-rain", "weather-rain", "weather-showers-scattered"], this.app.config.IconType())
                };
            case ("snow_heavy"):
                return {
                    customIcon: "snow-symbolic",
                    description: utils_1._("Substantial Snow"),
                    main: utils_1._("Substantial Snow"),
                    icon: utils_1.weatherIconSafely(["weather-snow"], this.app.config.IconType())
                };
            case ("snow"):
                return {
                    customIcon: "snow-symbolic",
                    description: utils_1._("Snow"),
                    main: utils_1._("Snow"),
                    icon: utils_1.weatherIconSafely(["weather-snow"], this.app.config.IconType())
                };
            case ("snow_light"):
                return {
                    customIcon: "snow-symbolic",
                    description: utils_1._("Light Snow"),
                    main: utils_1._("Light Snow"),
                    icon: utils_1.weatherIconSafely(["weather-snow"], this.app.config.IconType())
                };
            case ("flurries"):
                return {
                    customIcon: "cloudy-gusts-symbolic",
                    description: utils_1._("Flurries"),
                    main: utils_1._("Flurries"),
                    icon: utils_1.weatherIconSafely(["weather-snow"], this.app.config.IconType())
                };
            case ("tstorm"):
                return {
                    customIcon: "thunderstorm-symbolic",
                    description: utils_1._("Thunderstorm"),
                    main: utils_1._("Thunderstorm"),
                    icon: utils_1.weatherIconSafely(["weather-storm"], this.app.config.IconType())
                };
            case ("fog_light"):
                return {
                    customIcon: (isNight) ? "night-fog-symbolic" : "day-fog-symbolic",
                    description: utils_1._("Light Fog"),
                    main: utils_1._("Light Fog"),
                    icon: utils_1.weatherIconSafely(["weather-fog"], this.app.config.IconType())
                };
            case ("fog"):
                return {
                    customIcon: "fog-symbolic",
                    description: utils_1._("Fog"),
                    main: utils_1._("Fog"),
                    icon: utils_1.weatherIconSafely(["weather-fog"], this.app.config.IconType())
                };
            case ("cloudy"):
                return {
                    customIcon: "cloudy-symbolic",
                    description: utils_1._("Cloudy"),
                    main: utils_1._("Cloudy"),
                    icon: (isNight) ? utils_1.weatherIconSafely(["weather-overcast", "weather-clouds-night", "weather-few-clouds-night"], this.app.config.IconType()) : utils_1.weatherIconSafely(["weather-overcast", "weather-clouds", "weather-few-clouds"], this.app.config.IconType())
                };
            case ("mostly_cloudy"):
                return {
                    customIcon: (isNight) ? "night-alt-cloudy-symbolic" : "day-cloudy-symbolic",
                    description: utils_1._("Mostly Cloudy"),
                    main: utils_1._("Mostly Cloudy"),
                    icon: utils_1.weatherIconSafely((isNight) ? ["weather-clouds-night", "weather-few-clouds-night", "weather-overcast"] : ["weather-clouds", "weather-few-clouds", "weather-overcast"], this.app.config.IconType())
                };
            case ("partly_cloudy"):
                return {
                    customIcon: (isNight) ? "night-alt-cloudy-symbolic" : "day-cloudy-symbolic",
                    description: utils_1._("Partly Cloudy"),
                    main: utils_1._("Partly Cloudy"),
                    icon: utils_1.weatherIconSafely((isNight) ? ["weather-clouds-night", "weather-few-clouds-night", "weather-overcast"] : ["weather-clouds", "weather-few-clouds", "weather-overcast"], this.app.config.IconType())
                };
            case ("mostly_clear"):
                return {
                    customIcon: (isNight) ? "night-alt-partly-cloudy-symbolic" : "day-cloudy-symbolic",
                    description: utils_1._("Mostly Clear"),
                    main: utils_1._("Mostly Clear"),
                    icon: utils_1.weatherIconSafely((isNight) ? ["weather-few-clouds-night", "weather-clouds-night", "weather-overcast"] : ["weather-few-clouds", "weather-clouds", "weather-overcast"], this.app.config.IconType())
                };
            case ("clear"):
                return {
                    customIcon: (isNight) ? "night-clear-symbolic" : "day-sunny-symbolic",
                    description: (isNight) ? utils_1._("Clear") : utils_1._("Sunny"),
                    main: (isNight) ? utils_1._("Clear") : utils_1._("Sunny"),
                    icon: utils_1.weatherIconSafely((isNight) ? ["weather-clear-night"] : ["weather-clear"], this.app.config.IconType())
                };
            default:
                this.app.log.Error("condition code not found: " + condition);
                return {
                    customIcon: "refresh-symbolic",
                    description: utils_1._("Unknown"),
                    main: utils_1._("Unknown"),
                    icon: utils_1.weatherIconSafely(["weather-severe-alert"], this.app.config.IconType())
                };
        }
    }
}
exports.Climacell = Climacell;
;
