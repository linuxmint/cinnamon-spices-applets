"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Weatherbit = void 0;
const logger_1 = require("./logger");
const utils_1 = require("./utils");
const Lang = imports.lang;
class Weatherbit {
    constructor(_app) {
        this.prettyName = "WeatherBit";
        this.name = "Weatherbit";
        this.maxForecastSupport = 16;
        this.website = "https://www.weatherbit.io/";
        this.maxHourlyForecastSupport = 48;
        this.needsApiKey = true;
        this.supportedLanguages = [
            'ar', 'az', 'be', 'bg', 'bs', 'ca', 'cz', 'da', 'de', 'el', 'en',
            'et', 'fi', 'fr', 'hr', 'hu', 'id', 'is', 'it',
            'kw', 'lv', 'nb', 'nl', 'pl', 'pt', 'ro', 'ru', 'sk', 'sl', 'sr',
            'sv', 'tr', 'uk', 'zh', 'zh-tw'
        ];
        this.current_url = "https://api.weatherbit.io/v2.0/current?";
        this.daily_url = "https://api.weatherbit.io/v2.0/forecast/daily?";
        this.hourly_url = "https://api.weatherbit.io/v2.0/forecast/hourly?";
        this.hourlyAccess = true;
        this.app = _app;
    }
    async GetWeather(loc) {
        let forecastPromise = this.GetData(this.daily_url, loc, this.ParseForecast);
        let hourlyPromise = null;
        if (!!this.hourlyAccess)
            hourlyPromise = this.GetHourlyData(this.hourly_url, loc);
        let currentResult = await this.GetData(this.current_url, loc, this.ParseCurrent);
        if (!currentResult)
            return null;
        let forecastResult = await forecastPromise;
        currentResult.forecasts = (!forecastResult) ? [] : forecastResult;
        let hourlyResult = await hourlyPromise;
        currentResult.hourlyForecasts = (!hourlyResult) ? [] : hourlyResult;
        return currentResult;
    }
    ;
    async GetData(baseUrl, loc, ParseFunction) {
        let query = this.ConstructQuery(baseUrl, loc);
        if (query == null)
            return null;
        let json = await this.app.LoadJsonAsync(query, null, Lang.bind(this, this.HandleError));
        if (json == null)
            return null;
        return ParseFunction(json, this);
    }
    async GetHourlyData(baseUrl, loc) {
        let query = this.ConstructQuery(baseUrl, loc);
        if (query == null)
            return null;
        let json = await this.app.LoadJsonAsync(query, null, Lang.bind(this, this.HandleHourlyError));
        if (!!(json === null || json === void 0 ? void 0 : json.error)) {
            return null;
        }
        if (json == null)
            return null;
        return this.ParseHourlyForecast(json, this);
    }
    ;
    ParseCurrent(json, self) {
        json = json.data[0];
        let hourDiff = self.HourDifference(new Date(json.ts * 1000), self.ParseStringTime(json.ob_time));
        if (hourDiff != 0)
            logger_1.Log.Instance.Debug("Weatherbit reporting incorrect time, correcting with " + (0 - hourDiff).toString() + " hours");
        try {
            let weather = {
                coord: {
                    lat: json.lat,
                    lon: json.lon
                },
                location: {
                    city: json.city_name,
                    country: json.country_code,
                    url: null,
                    timeZone: json.timezone
                },
                date: new Date(json.ts * 1000),
                sunrise: self.TimeToDate(json.sunrise, hourDiff),
                sunset: self.TimeToDate(json.sunset, hourDiff),
                wind: {
                    speed: json.wind_spd,
                    degree: json.wind_dir
                },
                temperature: json.temp,
                pressure: json.pres,
                humidity: json.rh,
                condition: {
                    main: json.weather.description,
                    description: json.weather.description,
                    icons: self.ResolveIcon(json.weather.icon),
                    customIcon: self.ResolveCustomIcon(json.weather.icon)
                },
                extra_field: {
                    name: utils_1._("Feels Like"),
                    value: json.app_temp,
                    type: "temperature"
                },
                forecasts: []
            };
            return weather;
        }
        catch (e) {
            logger_1.Log.Instance.Error("Weatherbit Weather Parsing error: " + e);
            self.app.ShowError({ type: "soft", service: "weatherbit", detail: "unusual payload", message: utils_1._("Failed to Process Current Weather Info") });
            return null;
        }
    }
    ;
    ParseForecast(json, self) {
        let forecasts = [];
        try {
            for (let i = 0; i < json.data.length; i++) {
                let day = json.data[i];
                let forecast = {
                    date: new Date(day.ts * 1000),
                    temp_min: day.min_temp,
                    temp_max: day.max_temp,
                    condition: {
                        main: day.weather.description,
                        description: day.weather.description,
                        icons: self.ResolveIcon(day.weather.icon),
                        customIcon: self.ResolveCustomIcon(day.weather.icon)
                    },
                };
                forecasts.push(forecast);
            }
            return forecasts;
        }
        catch (e) {
            logger_1.Log.Instance.Error("Weatherbit Forecast Parsing error: " + e);
            self.app.ShowError({ type: "soft", service: "weatherbit", detail: "unusual payload", message: utils_1._("Failed to Process Forecast Info") });
            return null;
        }
    }
    ;
    ParseHourlyForecast(json, self) {
        let forecasts = [];
        try {
            for (let i = 0; i < json.data.length; i++) {
                let hour = json.data[i];
                let forecast = {
                    date: new Date(hour.ts * 1000),
                    temp: hour.temp,
                    condition: {
                        main: hour.weather.description,
                        description: hour.weather.description,
                        icons: self.ResolveIcon(hour.weather.icon),
                        customIcon: self.ResolveCustomIcon(hour.weather.icon)
                    },
                    precipitation: {
                        type: "rain",
                        volume: hour.precip,
                        chance: hour.pop
                    }
                };
                if (hour.snow != 0) {
                    forecast.precipitation.type = "snow";
                    forecast.precipitation.volume = hour.snow;
                }
                forecasts.push(forecast);
            }
            return forecasts;
        }
        catch (e) {
            logger_1.Log.Instance.Error("Weatherbit Forecast Parsing error: " + e);
            self.app.ShowError({ type: "soft", service: "weatherbit", detail: "unusual payload", message: utils_1._("Failed to Process Forecast Info") });
            return null;
        }
    }
    TimeToDate(time, hourDiff) {
        let hoursMinutes = time.split(":");
        let date = new Date();
        date.setHours(parseInt(hoursMinutes[0]) - hourDiff);
        date.setMinutes(parseInt(hoursMinutes[1]));
        return date;
    }
    HourDifference(correctTime, incorrectTime) {
        return Math.round((incorrectTime.getTime() - correctTime.getTime()) / (1000 * 60 * 60));
    }
    ParseStringTime(last_ob_time) {
        let split = last_ob_time.split(/[T\-\s:]/);
        if (split.length != 5)
            return null;
        return new Date(parseInt(split[0]), parseInt(split[1]) - 1, parseInt(split[2]), parseInt(split[3]), parseInt(split[4]));
    }
    ConvertToAPILocale(systemLocale) {
        if (systemLocale == "zh-tw") {
            return systemLocale;
        }
        let lang = systemLocale.split("-")[0];
        if (lang == "cs") {
            return "cz";
        }
        return lang;
    }
    ConstructQuery(query, loc) {
        query = query + "key=" + this.app.config.ApiKey + "&lat=" + loc.lat + "&lon=" + loc.lon + "&units=S";
        let lang = this.ConvertToAPILocale(this.app.config.currentLocale);
        if (utils_1.IsLangSupported(lang, this.supportedLanguages) && this.app.config._translateCondition) {
            query = query + "&lang=" + lang;
        }
        return query;
    }
    ;
    HandleError(message) {
        if (message.code == 403) {
            this.app.ShowError({
                type: "hard",
                userError: true,
                detail: "bad key",
                service: "weatherbit",
                message: utils_1._("Please Make sure you\nentered the API key correctly and your account is not locked")
            });
        }
        return true;
    }
    HandleHourlyError(message) {
        if (message.code == 403) {
            this.hourlyAccess = false;
            logger_1.Log.Instance.Print("Hourly forecast is inaccessible, skipping");
            this.app.ShowError({
                type: "silent",
                userError: false,
                detail: "bad key",
                service: "weatherbit",
                message: utils_1._("API key is doesn't provide access to Hourly Weather, skipping")
            });
        }
        return true;
    }
    ResolveIcon(icon) {
        switch (icon) {
            case "t01n":
            case "t01d":
            case "t02n":
            case "t02d":
            case "t03n":
            case "t03d":
            case "t04n":
            case "t04d":
            case "t05n":
            case "t05d":
                return ["weather-storm"];
            case "d01d":
            case "d01n":
            case "d02d":
            case "d02n":
            case "d03d":
            case "d03n":
                return ["weather-showers-scattered", "weather-rain", "weather-freezing-rain"];
            case "r01d":
            case "r01n":
            case "r02d":
            case "r02n":
            case "r03d":
            case "r03n":
            case "r04d":
            case "r04n":
            case "r05d":
            case "r05n":
            case "r06d":
            case "r06n":
                return ["weather-rain", "weather-freezing-rain", "weather-showers-scattered"];
            case "s01d":
            case "s01n":
            case "s02d":
            case "s02n":
            case "s03d":
            case "s03n":
            case "s04d":
            case "s04n":
            case "s06d":
            case "s06n":
                return ["weather-snow"];
            case "s05d":
            case "s05n":
                return ["weather-freezing-rain", "weather-rain", "weather-showers-scattered"];
            case "a01d":
            case "a01n":
            case "a02d":
            case "a02n":
            case "a03d":
            case "a03n":
            case "a04d":
            case "a04n":
            case "a05d":
            case "a05n":
            case "a06d":
            case "a06n":
                return ["weather-fog"];
            case "c02d":
                return ["weather-few-clouds"];
            case "c02n":
                return ["weather-few-clouds-night"];
            case "c01n":
                return ["weather-clear-night"];
            case "c01d":
                return ["weather-clear"];
            case "c03d":
                return ["weather-clouds", "weather-few-clouds", "weather-overcast"];
            case "c03n":
                return ["weather-clouds-night", "weather-few-clouds-night", "weather-overcast"];
            case "c04n":
                return ["weather-overcast", "weather-clouds-night", "weather-few-clouds-night"];
            case "c04d":
                return ["weather-overcast", "weather-clouds", "weather-few-clouds"];
            case "u00d":
            case "u00n":
                return ["weather-severe-alert"];
            default:
                return ["weather-severe-alert"];
        }
    }
    ;
    ResolveCustomIcon(icon) {
        switch (icon) {
            case "t01d":
            case "t02d":
            case "t03d":
                return "day-thunderstorm-symbolic";
            case "t04d":
            case "t05d":
                return "thunderstorm-symbolic";
            case "t01n":
            case "t02n":
            case "t03n":
                return "night-alt-thunderstorm-symbolic";
            case "t04n":
            case "t05n":
                return "thunderstorm-symbolic";
            case "d01d":
            case "d02d":
            case "d03d":
            case "d01n":
            case "d02n":
            case "d03n":
                return "showers-symbolic";
            case "r01d":
            case "r02d":
            case "r03d":
            case "r01n":
            case "r02n":
            case "r03n":
                return "rain-symbolic";
            case "r04d":
            case "r05d":
                return "day-rain-symbolic";
            case "r06d":
                return "rain-symbolic";
            case "r04n":
            case "r05n":
                return "night-alt-rain-symbolic";
            case "r06n":
                return "rain-symbolic";
            case "s01d":
            case "s04d":
                return "day-snow-symbolic";
            case "s02d":
            case "s03d":
            case "s06d":
                return "snow-symbolic";
            case "s01n":
            case "s04n":
                return "night-alt-snow-symbolic";
            case "s02n":
            case "s03n":
            case "s06n":
                return "snow-symbolic";
            case "s05d":
            case "s05n":
                return "sleet-symbolic";
            case "a01d":
            case "a02d":
            case "a03d":
            case "a04d":
            case "a05d":
            case "a06d":
                return "day-fog-symbolic";
            case "a01n":
            case "a02n":
            case "a03n":
            case "a04n":
            case "a05n":
            case "a06n":
                return "night-fog-symbolic";
            case "c02d":
                return "day-cloudy-symbolic";
            case "c02n":
                return "night-alt-cloudy-symbolic";
            case "c01n":
                return "night-clear-symbolic";
            case "c01d":
                return "day-sunny-symbolic";
            case "c03d":
                return "day-cloudy-symbolic";
            case "c03n":
                return "night-alt-cloudy-symbolic";
            case "c04n":
                return "cloudy-symbolic";
            case "c04d":
                return "cloudy-symbolic";
            case "u00d":
            case "u00n":
                return "cloud-refresh-symbolic";
            default:
                return "cloud-refresh-symbolic";
        }
    }
}
exports.Weatherbit = Weatherbit;
;
