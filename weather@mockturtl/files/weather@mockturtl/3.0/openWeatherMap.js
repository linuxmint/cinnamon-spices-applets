"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
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
Object.defineProperty(exports, "__esModule", { value: true });
function importModule(path) {
    if (typeof require !== 'undefined') {
        return require('./' + path);
    }
    else {
        var AppletDir = imports.ui.appletManager.applets['weather@mockturtl'];
        return AppletDir[path];
    }
}
var utils = importModule("utils");
var isCoordinate = utils.isCoordinate;
var isLangSupported = utils.isLangSupported;
var isID = utils.isID;
var OpenWeatherMap = (function () {
    function OpenWeatherMap(_app) {
        this.supportedLanguages = ["ar", "bg", "ca", "cz", "de", "el", "en", "fa", "fi",
            "fr", "gl", "hr", "hu", "it", "ja", "kr", "la", "lt", "mk", "nl", "pl",
            "pt", "ro", "ru", "se", "sk", "sl", "es", "tr", "ua", "vi", "zh_cn", "zh_tw"];
        this.current_url = "https://api.openweathermap.org/data/2.5/weather?";
        this.daily_url = "https://api.openweathermap.org/data/2.5/forecast/daily?";
        this.app = _app;
    }
    OpenWeatherMap.prototype.GetWeather = function () {
        return __awaiter(this, void 0, void 0, function () {
            var currentResult, forecastResult;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4, this.GetData(this.current_url, this.ParseCurrent)];
                    case 1:
                        currentResult = _a.sent();
                        return [4, this.GetData(this.daily_url, this.ParseForecast)];
                    case 2:
                        forecastResult = _a.sent();
                        if (currentResult && forecastResult) {
                            return [2, true];
                        }
                        else {
                            this.app.log.Error("OpenWeatherMap: Could not get Weather information");
                            return [2, false];
                        }
                        return [2];
                }
            });
        });
    };
    ;
    OpenWeatherMap.prototype.GetData = function (baseUrl, ParseFunction) {
        return __awaiter(this, void 0, void 0, function () {
            var query, json, e_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        query = this.ConstructQuery(baseUrl);
                        if (!(query != null)) return [3, 5];
                        this.app.log.Debug("Query: " + query);
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4, this.app.LoadJsonAsync(query)];
                    case 2:
                        json = _a.sent();
                        if (json == null) {
                            this.app.showError(this.app.errMsg.label.service, this.app.errMsg.desc.noResponse);
                            return [2, false];
                        }
                        return [3, 4];
                    case 3:
                        e_1 = _a.sent();
                        this.app.log.Error("Unable to call API:" + e_1);
                        return [2, false];
                    case 4:
                        if (json.cod == 200) {
                            return [2, ParseFunction(json, this)];
                        }
                        else {
                            this.HandleResponseErrors(json);
                            return [2, false];
                        }
                        return [3, 6];
                    case 5: return [2, false];
                    case 6: return [2];
                }
            });
        });
    };
    ;
    OpenWeatherMap.prototype.ParseCurrent = function (json, self) {
        try {
            if (json.coord) {
                self.app.weather.coord.lat = json.coord.lat;
                self.app.weather.coord.lon = json.coord.lon;
            }
            self.app.weather.location.city = json.name;
            self.app.weather.location.country = json.sys.country;
            self.app.weather.location.id = json.id;
            self.app.weather.dateTime = new Date((json.dt) * 1000);
            self.app.weather.sunrise = new Date((json.sys.sunrise) * 1000);
            self.app.weather.sunset = new Date((json.sys.sunset) * 1000);
            if (json.wind) {
                self.app.weather.wind.speed = json.wind.speed;
                self.app.weather.wind.degree = json.wind.deg;
            }
            if (json.main) {
                self.app.weather.main.temperature = json.main.temp;
                self.app.weather.main.pressure = json.main.pressure;
                self.app.weather.main.humidity = json.main.humidity;
                self.app.weather.main.temp_min = json.main.temp_min;
                self.app.weather.main.temp_max = json.main.temp_max;
            }
            if (json.weather[0]) {
                self.app.weather.condition.main = json.weather[0].main;
                self.app.weather.condition.description = json.weather[0].description;
                self.app.weather.condition.icon = self.app.weatherIconSafely(json.weather[0].icon, self.ResolveIcon);
            }
            if (json.clouds) {
                self.app.weather.cloudiness = json.clouds.all;
            }
            return true;
        }
        catch (e) {
            self.app.log.Error("OpenWeathermap Weather Parsing error: " + e);
            self.app.showError(self.app.errMsg.label.generic, self.app.errMsg.desc.parse);
            return false;
        }
    };
    ;
    OpenWeatherMap.prototype.ParseForecast = function (json, self) {
        try {
            for (var i = 0; i < self.app._forecastDays; i++) {
                var forecast = {
                    dateTime: null,
                    main: {
                        temp: null,
                        temp_min: null,
                        temp_max: null,
                        pressure: null,
                        sea_level: null,
                        grnd_level: null,
                        humidity: null,
                    },
                    condition: {
                        id: null,
                        main: null,
                        description: null,
                        icon: null,
                    },
                    clouds: null,
                    wind: {
                        speed: null,
                        deg: null,
                    }
                };
                var day = json.list[i];
                forecast.dateTime = new Date(day.dt * 1000);
                forecast.main.temp_min = day.temp.min;
                forecast.main.temp_max = day.temp.max;
                forecast.main.pressure = day.pressure;
                forecast.main.humidity = day.humidity;
                forecast.clouds = day.clouds;
                if (day.weather[0].id) {
                    forecast.condition.main = day.weather[0].main;
                    forecast.condition.description = day.weather[0].description;
                    forecast.condition.icon = self.app.weatherIconSafely(day.weather[0].icon, self.ResolveIcon);
                }
                self.app.forecasts.push(forecast);
            }
            return true;
        }
        catch (e) {
            self.app.log.Error("OpenWeathermap Forecast Parsing error: " + e);
            self.app.showError(self.app.errMsg.label.generic, self.app.errMsg.desc.parse);
            return false;
        }
    };
    ;
    OpenWeatherMap.prototype.ConstructQuery = function (baseUrl) {
        var query = baseUrl;
        var locString = this.ParseLocation();
        if (locString != null) {
            query = query + locString + "&APPID=";
            query += "1c73f8259a86c6fd43c7163b543c8640";
            if (this.app._translateCondition && isLangSupported(this.app.systemLanguage, this.supportedLanguages)) {
                query = query + "&lang=" + this.app.systemLanguage;
            }
            return query;
        }
        this.app.showError(this.app.errMsg.label.noLoc, "");
        this.app.log.Error("OpenWeatherMap: No Location was provided");
        return null;
    };
    ;
    OpenWeatherMap.prototype.ParseLocation = function () {
        var loc = this.app._location.replace(/ /g, "");
        if (isCoordinate(loc)) {
            var locArr = loc.split(',');
            return "lat=" + locArr[0] + "&lon=" + locArr[1];
        }
        else if (isID(loc)) {
            return "id=" + loc;
        }
        else
            return "q=" + loc;
    };
    ;
    OpenWeatherMap.prototype.HandleResponseErrors = function (json) {
        var errorMsg = "OpenWeather API: ";
        switch (json.cod) {
            case ("400"):
                this.app.showError(this.app.errMsg.label.service, this.app.errMsg.desc.locBad);
                break;
            case ("401"):
                this.app.showError(this.app.errMsg.label.service, this.app.errMsg.desc.keyBad);
                break;
            case ("404"):
                this.app.showError(this.app.errMsg.label.service, this.app.errMsg.desc.locNotFound);
                break;
            case ("429"):
                this.app.showError(this.app.errMsg.label.service, this.app.errMsg.desc.keyBlock);
                break;
            default:
                this.app.showError(this.app.errMsg.label.service, this.app.errMsg.desc.unknown);
                break;
        }
        ;
        this.app.log.Debug("OpenWeatherMap Error Code: " + json.cod);
        this.app.log.Error(errorMsg + json.message);
    };
    ;
    OpenWeatherMap.prototype.ResolveIcon = function (icon) {
        switch (icon) {
            case "10d":
                return ['weather-rain', 'weather-showers-scattered', 'weather-freezing-rain'];
            case "10n":
                return ['weather-rain', 'weather-showers-scattered', 'weather-freezing-rain'];
            case "09n":
                return ['weather-showers'];
            case "09d":
                return ['weather-showers'];
            case "13d":
                return ['weather-snow'];
            case "13n":
                return ['weather-snow'];
            case "50d":
                return ['weather-fog'];
            case "50n":
                return ['weather-fog'];
            case "04d":
                return ['weather_overcast', 'weather-clouds', "weather-few-clouds"];
            case "04n":
                return ['weather_overcast', 'weather-clouds', "weather-few-clouds-night"];
            case "03n":
                return ['weather-clouds-night', 'weather-few-clouds-night'];
            case "03d":
                return ['weather-clouds', 'weather-overcast', 'weather-few-clouds'];
            case "02n":
                return ['weather-few-clouds-night'];
            case "02d":
                return ['weather-few-clouds'];
            case "01n":
                return ['weather-clear-night'];
            case "01d":
                return ['weather-clear'];
            case "11d":
                return ['weather-storm'];
            case "11n":
                return ['weather-storm'];
            default:
                return ['weather-severe-alert'];
        }
    };
    ;
    return OpenWeatherMap;
}());
;
