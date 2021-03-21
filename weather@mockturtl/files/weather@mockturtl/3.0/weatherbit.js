var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
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
var utils = importModule("utils");
var isCoordinate = utils.isCoordinate;
var isLangSupported = utils.isLangSupported;
var weatherIconSafely = utils.weatherIconSafely;
var GetFuncName = utils.GetFuncName;
var _ = utils._;
var Weatherbit = (function () {
    function Weatherbit(_app) {
        this.prettyName = "WeatherBit";
        this.name = "Weatherbit";
        this.maxForecastSupport = 16;
        this.website = "https://www.weatherbit.io/";
        this.maxHourlyForecastSupport = 48;
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
    Weatherbit.prototype.GetWeather = function (loc) {
        return __awaiter(this, void 0, void 0, function () {
            var forecastPromise, hourlyPromise, currentResult, forecastResult, hourlyResult;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        forecastPromise = this.GetData(this.daily_url, loc, this.ParseForecast);
                        hourlyPromise = null;
                        if (!!this.hourlyAccess)
                            hourlyPromise = this.GetHourlyData(this.hourly_url, loc);
                        return [4, this.GetData(this.current_url, loc, this.ParseCurrent)];
                    case 1:
                        currentResult = _a.sent();
                        if (!currentResult)
                            return [2, null];
                        return [4, forecastPromise];
                    case 2:
                        forecastResult = _a.sent();
                        currentResult.forecasts = (!forecastResult) ? [] : forecastResult;
                        return [4, hourlyPromise];
                    case 3:
                        hourlyResult = _a.sent();
                        currentResult.hourlyForecasts = (!hourlyResult) ? [] : hourlyResult;
                        return [2, currentResult];
                }
            });
        });
    };
    ;
    Weatherbit.prototype.GetData = function (baseUrl, loc, ParseFunction) {
        return __awaiter(this, void 0, void 0, function () {
            var query, json, e_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        query = this.ConstructQuery(baseUrl, loc);
                        if (!(query != null)) return [3, 5];
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4, this.app.LoadJsonAsync(query, this.OnObtainingData)];
                    case 2:
                        json = _a.sent();
                        return [3, 4];
                    case 3:
                        e_1 = _a.sent();
                        this.app.HandleHTTPError("weatherbit", e_1, this.app);
                        return [2, null];
                    case 4:
                        if (json == null) {
                            this.app.HandleError({ type: "soft", detail: "no api response", service: "weatherbit" });
                            return [2, null];
                        }
                        return [2, ParseFunction(json, this)];
                    case 5: return [2, null];
                }
            });
        });
    };
    ;
    Weatherbit.prototype.GetHourlyData = function (baseUrl, loc) {
        return __awaiter(this, void 0, void 0, function () {
            var query, json, e_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        query = this.ConstructQuery(baseUrl, loc);
                        if (!(query != null)) return [3, 5];
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4, this.app.LoadJsonAsync(query, null, false)];
                    case 2:
                        json = _a.sent();
                        return [3, 4];
                    case 3:
                        e_2 = _a.sent();
                        if (e_2.code == 403) {
                            this.app.log.Print("Hourly forecast is inaccessible, skipping");
                            this.hourlyAccess = false;
                            return [2, null];
                        }
                        this.app.HandleHTTPError("weatherbit", e_2, this.app);
                        return [2, null];
                    case 4:
                        if (json == null) {
                            this.app.HandleError({ type: "soft", detail: "no api response", service: "weatherbit" });
                            return [2, null];
                        }
                        return [2, this.ParseHourlyForecast(json, this)];
                    case 5: return [2, null];
                }
            });
        });
    };
    ;
    Weatherbit.prototype.ParseCurrent = function (json, self) {
        json = json.data[0];
        var hourDiff = self.HourDifference(new Date(json.ts * 1000), self.ParseStringTime(json.ob_time));
        if (hourDiff != 0)
            self.app.log.Debug("Weatherbit reporting incorrect time, correcting with " + (0 - hourDiff).toString() + " hours");
        try {
            var weather = {
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
                    icon: weatherIconSafely(self.ResolveIcon(json.weather.icon), self.app.config.IconType()),
                    customIcon: self.ResolveCustomIcon(json.weather.icon)
                },
                extra_field: {
                    name: _("Feels Like"),
                    value: json.app_temp,
                    type: "temperature"
                },
                forecasts: []
            };
            return weather;
        }
        catch (e) {
            self.app.log.Error("Weatherbit Weather Parsing error: " + e);
            self.app.HandleError({ type: "soft", service: "weatherbit", detail: "unusual payload", message: _("Failed to Process Current Weather Info") });
            return null;
        }
    };
    ;
    Weatherbit.prototype.ParseForecast = function (json, self) {
        var forecasts = [];
        try {
            for (var i = 0; i < json.data.length; i++) {
                var day = json.data[i];
                var forecast = {
                    date: new Date(day.ts * 1000),
                    temp_min: day.min_temp,
                    temp_max: day.max_temp,
                    condition: {
                        main: day.weather.description,
                        description: day.weather.description,
                        icon: weatherIconSafely(self.ResolveIcon(day.weather.icon), self.app.config.IconType()),
                        customIcon: self.ResolveCustomIcon(day.weather.icon)
                    },
                };
                forecasts.push(forecast);
            }
            return forecasts;
        }
        catch (e) {
            self.app.log.Error("Weatherbit Forecast Parsing error: " + e);
            self.app.HandleError({ type: "soft", service: "weatherbit", detail: "unusual payload", message: _("Failed to Process Forecast Info") });
            return null;
        }
    };
    ;
    Weatherbit.prototype.ParseHourlyForecast = function (json, self) {
        var forecasts = [];
        try {
            for (var i = 0; i < json.data.length; i++) {
                var hour = json.data[i];
                var forecast = {
                    date: new Date(hour.ts * 1000),
                    temp: hour.temp,
                    condition: {
                        main: hour.weather.description,
                        description: hour.weather.description,
                        icon: weatherIconSafely(self.ResolveIcon(hour.weather.icon), self.app.config.IconType()),
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
            self.app.log.Error("Weatherbit Forecast Parsing error: " + e);
            self.app.HandleError({ type: "soft", service: "weatherbit", detail: "unusual payload", message: _("Failed to Process Forecast Info") });
            return null;
        }
    };
    Weatherbit.prototype.TimeToDate = function (time, hourDiff) {
        var hoursMinutes = time.split(":");
        var date = new Date();
        date.setHours(parseInt(hoursMinutes[0]) - hourDiff);
        date.setMinutes(parseInt(hoursMinutes[1]));
        return date;
    };
    Weatherbit.prototype.HourDifference = function (correctTime, incorrectTime) {
        return Math.round((incorrectTime.getTime() - correctTime.getTime()) / (1000 * 60 * 60));
    };
    Weatherbit.prototype.ParseStringTime = function (last_ob_time) {
        var split = last_ob_time.split(/[T\-\s:]/);
        if (split.length != 5)
            return null;
        return new Date(parseInt(split[0]), parseInt(split[1]) - 1, parseInt(split[2]), parseInt(split[3]), parseInt(split[4]));
    };
    Weatherbit.prototype.ConvertToAPILocale = function (systemLocale) {
        if (systemLocale == "zh-tw") {
            return systemLocale;
        }
        var lang = systemLocale.split("-")[0];
        if (lang == "cs") {
            return "cz";
        }
        return lang;
    };
    Weatherbit.prototype.ConstructQuery = function (query, loc) {
        var key = this.app.config._apiKey.replace(" ", "");
        if (this.app.config.noApiKey()) {
            this.app.log.Error("DarkSky: No API Key given");
            this.app.HandleError({
                type: "hard",
                userError: true,
                "detail": "no key",
                message: _("Please enter API key in settings,\nor get one first on https://www.weatherbit.io/account/create")
            });
            return "";
        }
        query = query + "key=" + key + "&lat=" + loc.lat + "&lon=" + loc.lon + "&units=S";
        var lang = this.ConvertToAPILocale(this.app.currentLocale);
        if (isLangSupported(lang, this.supportedLanguages) && this.app.config._translateCondition) {
            query = query + "&lang=" + lang;
        }
        return query;
    };
    ;
    Weatherbit.prototype.OnObtainingData = function (message) {
        if (message.status_code == 403) {
            return {
                type: "hard",
                userError: true,
                detail: "bad key",
                service: "weatherbit",
                message: _("Please Make sure you\nentered the API key correctly and your account is not locked")
            };
        }
        return null;
    };
    Weatherbit.prototype.ResolveIcon = function (icon) {
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
    };
    ;
    Weatherbit.prototype.ResolveCustomIcon = function (icon) {
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
    };
    return Weatherbit;
}());
;
