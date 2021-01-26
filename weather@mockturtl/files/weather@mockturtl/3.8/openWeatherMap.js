"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenWeatherMap = void 0;
const logger_1 = require("./logger");
const utils_1 = require("./utils");
const Lang = imports.lang;
class OpenWeatherMap {
    constructor(_app) {
        this.prettyName = "OpenWeatherMap";
        this.name = "OpenWeatherMap";
        this.maxForecastSupport = 7;
        this.website = "https://openweathermap.org/";
        this.maxHourlyForecastSupport = 48;
        this.needsApiKey = false;
        this.supportedLanguages = ["af", "ar", "az", "bg", "ca", "cz", "da", "de", "el", "en", "eu", "fa", "fi",
            "fr", "gl", "he", "hi", "hr", "hu", "id", "it", "ja", "kr", "la", "lt", "mk", "no", "nl", "pl",
            "pt", "pt_br", "ro", "ru", "se", "sk", "sl", "sp", "es", "sr", "th", "tr", "ua", "uk", "vi", "zh_cn", "zh_tw", "zu"
        ];
        this.base_url = "https://api.openweathermap.org/data/2.5/onecall?";
        this.app = _app;
    }
    async GetWeather(loc) {
        let query = this.ConstructQuery(this.base_url, loc);
        if (query == null)
            return null;
        let json = await this.app.LoadJsonAsync(query, null, Lang.bind(this, this.HandleError));
        if (!json)
            return null;
        if (this.HadErrors(json))
            return null;
        return this.ParseWeather(json, this);
    }
    ;
    ParseWeather(json, self) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
        try {
            let weather = {
                coord: {
                    lat: json.lat,
                    lon: json.lon
                },
                location: {
                    url: "https://openweathermap.org/city/",
                    timeZone: json.timezone
                },
                date: new Date((json.current.dt) * 1000),
                sunrise: new Date((json.current.sunrise) * 1000),
                sunset: new Date((json.current.sunset) * 1000),
                wind: {
                    speed: json.current.wind_speed,
                    degree: json.current.wind_deg
                },
                temperature: json.current.temp,
                pressure: json.current.pressure,
                humidity: json.current.humidity,
                condition: {
                    main: (_c = (_b = (_a = json === null || json === void 0 ? void 0 : json.current) === null || _a === void 0 ? void 0 : _a.weather) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.main,
                    description: (_f = (_e = (_d = json === null || json === void 0 ? void 0 : json.current) === null || _d === void 0 ? void 0 : _d.weather) === null || _e === void 0 ? void 0 : _e[0]) === null || _f === void 0 ? void 0 : _f.description,
                    icons: self.ResolveIcon((_j = (_h = (_g = json === null || json === void 0 ? void 0 : json.current) === null || _g === void 0 ? void 0 : _g.weather) === null || _h === void 0 ? void 0 : _h[0]) === null || _j === void 0 ? void 0 : _j.icon),
                    customIcon: self.ResolveCustomIcon((_m = (_l = (_k = json === null || json === void 0 ? void 0 : json.current) === null || _k === void 0 ? void 0 : _k.weather) === null || _l === void 0 ? void 0 : _l[0]) === null || _m === void 0 ? void 0 : _m.icon)
                },
                extra_field: {
                    name: utils_1._("Feels Like"),
                    value: json.current.feels_like,
                    type: "temperature"
                },
                forecasts: []
            };
            let forecasts = [];
            for (let i = 0; i < json.daily.length; i++) {
                let day = json.daily[i];
                let forecast = {
                    date: new Date(day.dt * 1000),
                    temp_min: day.temp.min,
                    temp_max: day.temp.max,
                    condition: {
                        main: day.weather[0].main,
                        description: day.weather[0].description,
                        icons: self.ResolveIcon(day.weather[0].icon),
                        customIcon: self.ResolveCustomIcon(day.weather[0].icon)
                    },
                };
                forecasts.push(forecast);
            }
            weather.forecasts = forecasts;
            let hourly = [];
            for (let index = 0; index < json.hourly.length; index++) {
                const hour = json.hourly[index];
                let forecast = {
                    date: new Date(hour.dt * 1000),
                    temp: hour.temp,
                    condition: {
                        main: hour.weather[0].main,
                        description: hour.weather[0].description,
                        icons: self.ResolveIcon(hour.weather[0].icon),
                        customIcon: self.ResolveCustomIcon(hour.weather[0].icon)
                    },
                };
                if (!!hour.rain) {
                    forecast.precipitation = {
                        volume: hour.rain["1h"],
                        type: "rain"
                    };
                }
                if (!!hour.snow) {
                    forecast.precipitation = {
                        volume: hour.snow["1h"],
                        type: "snow"
                    };
                }
                if (!!hour.pop && forecast.precipitation)
                    forecast.precipitation.chance = hour.pop * 100;
                hourly.push(forecast);
            }
            weather.hourlyForecasts = hourly;
            return weather;
        }
        catch (e) {
            logger_1.Log.Instance.Error("OpenWeatherMap Weather Parsing error: " + e);
            self.app.ShowError({
                type: "soft",
                service: "openweathermap",
                detail: "unusual payload",
                message: utils_1._("Failed to Process Current Weather Info")
            });
            return null;
        }
    }
    ;
    ConstructQuery(baseUrl, loc) {
        let query = baseUrl;
        query = query + "lat=" + loc.lat + "&lon=" + loc.lon + "&appid=";
        query += "1c73f8259a86c6fd43c7163b543c8640";
        let locale = this.ConvertToAPILocale(this.app.config.currentLocale);
        if (this.app.config._translateCondition && utils_1.IsLangSupported(locale, this.supportedLanguages)) {
            query = query + "&lang=" + locale;
        }
        return query;
    }
    ;
    ConvertToAPILocale(systemLocale) {
        if (systemLocale == "zh-cn" || systemLocale == "zh-cn" || systemLocale == "pt-br") {
            return systemLocale;
        }
        let lang = systemLocale.split("-")[0];
        if (lang == "sv") {
            return "se";
        }
        else if (lang == "cs") {
            return "cz";
        }
        else if (lang == "ko") {
            return "kr";
        }
        else if (lang == "lv") {
            return "la";
        }
        else if (lang == "nn" || lang == "nb") {
            return "no";
        }
        return lang;
    }
    HadErrors(json) {
        if (!this.HasReturnedError(json))
            return false;
        let errorMsg = "OpenWeatherMap Response: ";
        let error = {
            service: "openweathermap",
            type: "hard",
        };
        let errorPayload = json;
        switch (errorPayload.cod) {
            case ("400"):
                error.detail = "bad location format";
                error.message = utils_1._("Please make sure Location is in the correct format in the Settings");
                break;
            case ("401"):
                error.detail = "bad key";
                error.message = utils_1._("Make sure you entered the correct key in settings");
                break;
            case ("404"):
                error.detail = "location not found";
                error.message = utils_1._("Location not found, make sure location is available or it is in the correct format");
                break;
            case ("429"):
                error.detail = "key blocked";
                error.message = utils_1._("If this problem persists, please contact the Author of this applet");
                break;
            default:
                error.detail = "unknown";
                error.message = utils_1._("Unknown Error, please see the logs in Looking Glass");
                break;
        }
        ;
        this.app.ShowError(error);
        logger_1.Log.Instance.Debug("OpenWeatherMap Error Code: " + errorPayload.cod);
        logger_1.Log.Instance.Error(errorMsg + errorPayload.message);
        return true;
    }
    ;
    HasReturnedError(json) {
        return (!!(json === null || json === void 0 ? void 0 : json.cod));
    }
    HandleError(error) {
        if (error.code == 404) {
            this.app.ShowError({
                detail: "location not found",
                message: utils_1._("Location not found, make sure location is available or it is in the correct format"),
                userError: true,
                type: "hard"
            });
            return false;
        }
        return true;
    }
    ResolveIcon(icon) {
        switch (icon) {
            case "10d":
                return ["weather-rain", "weather-showers-scattered", "weather-freezing-rain"];
            case "10n":
                return ["weather-rain", "weather-showers-scattered", "weather-freezing-rain"];
            case "09n":
                return ["weather-showers"];
            case "09d":
                return ["weather-showers"];
            case "13d":
                return ["weather-snow"];
            case "13n":
                return ["weather-snow"];
            case "50d":
                return ["weather-fog"];
            case "50n":
                return ["weather-fog"];
            case "04d":
                return ["weather-overcast", "weather-clouds", "weather-few-clouds"];
            case "04n":
                return ["weather-overcast", "weather-clouds-night", "weather-few-clouds-night"];
            case "03n":
                return ['weather-clouds-night', "weather-few-clouds-night"];
            case "03d":
                return ["weather-clouds", "weather-few-clouds", "weather-overcast"];
            case "02n":
                return ["weather-few-clouds-night"];
            case "02d":
                return ["weather-few-clouds"];
            case "01n":
                return ["weather-clear-night"];
            case "01d":
                return ["weather-clear"];
            case "11d":
                return ["weather-storm"];
            case "11n":
                return ["weather-storm"];
            default:
                return ["weather-severe-alert"];
        }
    }
    ;
    ResolveCustomIcon(icon) {
        switch (icon) {
            case "10d":
                return "day-rain-symbolic";
            case "10n":
                return "night-rain-symbolic";
            case "09n":
                return "night-showers-symbolic";
            case "09d":
                return "day-showers-symbolic";
            case "13d":
                return "day-snow-symbolic";
            case "13n":
                return "night-alt-snow-symbolic";
            case "50d":
                return "day-fog-symbolic";
            case "50n":
                return "night-fog-symbolic";
            case "04d":
                return "day-cloudy-symbolic";
            case "04n":
                return "night-alt-cloudy-symbolic";
            case "03n":
                return "night-alt-cloudy-symbolic";
            case "03d":
                return "day-cloudy-symbolic";
            case "02n":
                return "night-alt-cloudy-symbolic";
            case "02d":
                return "day-cloudy-symbolic";
            case "01n":
                return "night-clear-symbolic";
            case "01d":
                return "day-sunny-symbolic";
            case "11d":
                return "day-thunderstorm-symbolic";
            case "11n":
                return "night-alt-thunderstorm-symbolic";
            default:
                return "cloud-refresh-symbolic";
        }
    }
    ;
}
exports.OpenWeatherMap = OpenWeatherMap;
;
const openWeatherMapConditionLibrary = [
    utils_1._("Thunderstorm with light rain"),
    utils_1._("Thunderstorm with rain"),
    utils_1._("Thunderstorm with heavy rain"),
    utils_1._("Light thunderstorm"),
    utils_1._("Thunderstorm"),
    utils_1._("Heavy thunderstorm"),
    utils_1._("Ragged thunderstorm"),
    utils_1._("Thunderstorm with light drizzle"),
    utils_1._("Thunderstorm with drizzle"),
    utils_1._("Thunderstorm with heavy drizzle"),
    utils_1._("Light intensity drizzle"),
    utils_1._("Drizzle"),
    utils_1._("Heavy intensity drizzle"),
    utils_1._("Light intensity drizzle rain"),
    utils_1._("Drizzle rain"),
    utils_1._("Heavy intensity drizzle rain"),
    utils_1._("Shower rain and drizzle"),
    utils_1._("Heavy shower rain and drizzle"),
    utils_1._("Shower drizzle"),
    utils_1._("Light rain"),
    utils_1._("Moderate rain"),
    utils_1._("Heavy intensity rain"),
    utils_1._("Very heavy rain"),
    utils_1._("Extreme rain"),
    utils_1._("Freezing rain"),
    utils_1._("Light intensity shower rain"),
    utils_1._("Shower rain"),
    utils_1._("Heavy intensity shower rain"),
    utils_1._("Ragged shower rain"),
    utils_1._("Light snow"),
    utils_1._("Snow"),
    utils_1._("Heavy snow"),
    utils_1._("Sleet"),
    utils_1._("Shower sleet"),
    utils_1._("Light rain and snow"),
    utils_1._("Rain and snow"),
    utils_1._("Light shower snow"),
    utils_1._("Shower snow"),
    utils_1._("Heavy shower snow"),
    utils_1._("Mist"),
    utils_1._("Smoke"),
    utils_1._("Haze"),
    utils_1._("Sand, dust whirls"),
    utils_1._("Fog"),
    utils_1._("Sand"),
    utils_1._("Dust"),
    utils_1._("Volcanic ash"),
    utils_1._("Squalls"),
    utils_1._("Tornado"),
    utils_1._("Clear"),
    utils_1._("Clear sky"),
    utils_1._("Sky is clear"),
    utils_1._("Clouds"),
    utils_1._("Few clouds"),
    utils_1._("Scattered clouds"),
    utils_1._("Broken clouds"),
    utils_1._("Overcast clouds")
];
