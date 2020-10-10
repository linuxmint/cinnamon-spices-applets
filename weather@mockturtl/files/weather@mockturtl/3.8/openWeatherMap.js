function importModule(path) {
    if (typeof require !== 'undefined') {
        return require('./' + path);
    }
    else {
        if (!AppletDir)
            var AppletDir = imports.ui.appletManager.applets['weather@mockturtl'];
        return AppletDir[path];
    }
}
const UUID = "weather@mockturtl";
imports.gettext.bindtextdomain(UUID, imports.gi.GLib.get_home_dir() + "/.local/share/locale");
function _(str) {
    return imports.gettext.dgettext(UUID, str);
}
var utils = importModule("utils");
var isCoordinate = utils.isCoordinate;
var isLangSupported = utils.isLangSupported;
var isID = utils.isID;
var weatherIconSafely = utils.weatherIconSafely;
var get = utils.get;
var nonempty = utils.nonempty;
class OpenWeatherMap {
    constructor(_app) {
        this.prettyName = "OpenWeatherMap";
        this.name = "OpenWeatherMap";
        this.maxForecastSupport = 7;
        this.website = "https://openweathermap.org/";
        this.maxHourlyForecastSupport = 48;
        this.supportedLanguages = ["af", "ar", "az", "bg", "ca", "cz", "da", "de", "el", "en", "eu", "fa", "fi",
            "fr", "gl", "he", "hi", "hr", "hu", "id", "it", "ja", "kr", "la", "lt", "mk", "no", "nl", "pl",
            "pt", "pt_br", "ro", "ru", "se", "sk", "sl", "sp", "es", "sr", "th", "tr", "ua", "uk", "vi", "zh_cn", "zh_tw", "zu"];
        this.base_url = "https://api.openweathermap.org/data/2.5/onecall?";
        this.app = _app;
    }
    async GetWeather(loc) {
        let query = this.ConstructQuery(this.base_url, loc);
        let json;
        if (query != null) {
            try {
                json = await this.app.LoadJsonAsync(query);
            }
            catch (e) {
                this.app.HandleHTTPError("openweathermap", e, this.app, this.HandleHTTPError);
                return null;
            }
            if (json == null) {
                this.app.HandleError({ type: "soft", detail: "no api response", service: "openweathermap" });
                return null;
            }
            return this.ParseWeather(json, this);
        }
        else {
            return null;
        }
    }
    ;
    ParseWeather(json, self) {
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
                    main: get(["current", "weather", "0", "main"], json),
                    description: get(["current", "weather", "0", "description"], json),
                    icon: weatherIconSafely(self.ResolveIcon(get(["current", "weather", "0", "icon"], json)), self.app.config.IconType()),
                    customIcon: self.ResolveCustomIcon(get(["current", "weather", "0", "icon"], json))
                },
                extra_field: {
                    name: _("Cloudiness"),
                    value: json.current.clouds,
                    type: "percent"
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
                        icon: weatherIconSafely(self.ResolveIcon(day.weather[0].icon), self.app.config.IconType()),
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
                        icon: weatherIconSafely(self.ResolveIcon(hour.weather[0].icon), self.app.config.IconType()),
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
            self.app.log.Error("OpenWeatherMap Weather Parsing error: " + e);
            self.app.HandleError({ type: "soft", service: "openweathermap", detail: "unusual payload", message: _("Failed to Process Current Weather Info") });
            return null;
        }
    }
    ;
    ConstructQuery(baseUrl, loc) {
        let query = baseUrl;
        query = query + "lat=" + loc.lat + "&lon=" + loc.lon + "&appid=";
        query += "1c73f8259a86c6fd43c7163b543c8640";
        let locale = this.ConvertToAPILocale(this.app.currentLocale);
        if (this.app.config._translateCondition && isLangSupported(locale, this.supportedLanguages)) {
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
    HandleResponseErrors(json) {
        let errorMsg = "OpenWeatherMap Response: ";
        let error = {
            service: "openweathermap",
            type: "hard",
        };
        switch (json.cod) {
            case ("400"):
                error.detail = "bad location format";
                error.message = _("Please make sure Location is in the correct format in the Settings");
                break;
            case ("401"):
                error.detail = "bad key";
                error.message = _("Make sure you entered the correct key in settings");
                break;
            case ("404"):
                error.detail = "location not found";
                error.message = _("Location not found, make sure location is available or it is in the correct format");
                break;
            case ("429"):
                error.detail = "key blocked";
                error.message = _("If this problem persists, please contact the Author of this applet");
                break;
            default:
                error.detail = "unknown";
                error.message = _("Unknown Error, please see the logs in Looking Glass");
                break;
        }
        ;
        this.app.HandleError(error);
        this.app.log.Debug("OpenWeatherMap Error Code: " + json.cod);
        this.app.log.Error(errorMsg + json.message);
    }
    ;
    HandleHTTPError(error, uiError) {
        if (error.code == 404) {
            uiError.detail = "location not found";
            uiError.message = _("Location not found, make sure location is available or it is in the correct format");
            uiError.userError = true;
            uiError.type = "hard";
        }
        return uiError;
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
;
const openWeatherMapConditionLibrary = [
    _("Thunderstorm with light rain"),
    _("Thunderstorm with rain"),
    _("Thunderstorm with heavy rain"),
    _("Light thunderstorm"),
    _("Thunderstorm"),
    _("Heavy thunderstorm"),
    _("Ragged thunderstorm"),
    _("Thunderstorm with light drizzle"),
    _("Thunderstorm with drizzle"),
    _("Thunderstorm with heavy drizzle"),
    _("Light intensity drizzle"),
    _("Drizzle"),
    _("Heavy intensity drizzle"),
    _("Light intensity drizzle rain"),
    _("Drizzle rain"),
    _("Heavy intensity drizzle rain"),
    _("Shower rain and drizzle"),
    _("Heavy shower rain and drizzle"),
    _("Shower drizzle"),
    _("Light rain"),
    _("Moderate rain"),
    _("Heavy intensity rain"),
    _("Very heavy rain"),
    _("Extreme rain"),
    _("Freezing rain"),
    _("Light intensity shower rain"),
    _("Shower rain"),
    _("Heavy intensity shower rain"),
    _("Ragged shower rain"),
    _("Light snow"),
    _("Snow"),
    _("Heavy snow"),
    _("Sleet"),
    _("Shower sleet"),
    _("Light rain and snow"),
    _("Rain and snow"),
    _("Light shower snow"),
    _("Shower snow"),
    _("Heavy shower snow"),
    _("Mist"),
    _("Smoke"),
    _("Haze"),
    _("Sand, dust whirls"),
    _("Fog"),
    _("Sand"),
    _("Dust"),
    _("Volcanic ash"),
    _("Squalls"),
    _("Tornado"),
    _("Clear"),
    _("Clear sky"),
    _("Sky is clear"),
    _("Clouds"),
    _("Few clouds"),
    _("Scattered clouds"),
    _("Broken clouds"),
    _("Overcast clouds")
];
