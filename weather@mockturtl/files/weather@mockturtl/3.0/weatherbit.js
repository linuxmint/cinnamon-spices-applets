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
var icons = utils.icons;
var weatherIconSafely = utils.weatherIconSafely;
var Weatherbit = (function () {
    function Weatherbit(_app) {
        this.descriptionLinelength = 25;
        this.supportedLanguages = [
            'ar', 'az', 'be', 'bg', 'bs', 'ca', 'cz', 'da', 'de', 'el', 'en',
            'et', 'fi', 'fr', 'hr', 'hu', 'id', 'is', 'it',
            'kw', 'lv', 'nb', 'nl', 'pl', 'pt', 'ro', 'ru', 'sk', 'sl', 'sr',
            'sv', 'tr', 'uk', 'zh', 'zh-tw'
        ];
        this.current_url = "https://api.weatherbit.io/v2.0/current?";
        this.daily_url = "https://api.weatherbit.io/v2.0/forecast/daily?";
        this.unit = null;
        this.app = _app;
    }
    Weatherbit.prototype.GetWeather = function () {
        return __awaiter(this, void 0, void 0, function () {
            var currentResult, forecastResult;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4, this.GetData(this.current_url, this.ParseCurrent)];
                    case 1:
                        currentResult = _a.sent();
                        if (!currentResult)
                            return [2, null];
                        return [4, this.GetData(this.daily_url, this.ParseForecast)];
                    case 2:
                        forecastResult = _a.sent();
                        currentResult.forecasts = forecastResult;
                        return [2, currentResult];
                }
            });
        });
    };
    ;
    Weatherbit.prototype.GetData = function (baseUrl, ParseFunction) {
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
                        return [3, 4];
                    case 3:
                        e_1 = _a.sent();
                        this.app.HandleHTTPError("weatherbit", e_1, this.app, this.HandleHTTPError);
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
    Weatherbit.prototype.ParseCurrent = function (json, self) {
        json = json.data[0];
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
                sunrise: self.TimeToDate(json.sunrise),
                sunset: self.TimeToDate(json.sunset),
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
                    icon: weatherIconSafely(self.ResolveIcon(json.weather.icon), self.app._icon_type),
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
            self.app.HandleError({ type: "soft", service: "weatherbit", detail: "unusal payload", message: _("Failed to Process Current Weather Info") });
            return null;
        }
    };
    ;
    Weatherbit.prototype.ParseForecast = function (json, self) {
        var forecasts = [];
        try {
            for (var i = 0; i < self.app._forecastDays; i++) {
                var day = json.data[i];
                var forecast = {
                    date: new Date(day.ts * 1000),
                    temp_min: day.min_temp,
                    temp_max: day.max_temp,
                    condition: {
                        main: day.weather.description,
                        description: day.weather.description,
                        icon: weatherIconSafely(self.ResolveIcon(day.weather.icon), self.app._icon_type),
                        customIcon: self.ResolveCustomIcon(day.weather.icon)
                    },
                };
                forecasts.push(forecast);
            }
            return forecasts;
        }
        catch (e) {
            self.app.log.Error("Weatherbit Forecast Parsing error: " + e);
            self.app.HandleError({ type: "soft", service: "weatherbit", detail: "unusal payload", message: _("Failed to Process Forecast Info") });
            return null;
        }
    };
    ;
    Weatherbit.prototype.TimeToDate = function (time) {
        var hoursMinutes = time.split(":");
        var date = new Date();
        date.setHours(parseInt(hoursMinutes[0]));
        date.setMinutes(parseInt(hoursMinutes[1]));
        return date;
    };
    Weatherbit.prototype.ConstructQuery = function (query) {
        var key = this.app._apiKey.replace(" ", "");
        var location = this.app._location.replace(" ", "");
        if (this.app.noApiKey()) {
            this.app.log.Error("DarkSky: No API Key given");
            this.app.HandleError({
                type: "hard",
                userError: true,
                "detail": "no key",
                message: _("Please enter API key in settings,\nor get one first on https://www.weatherbit.io/account/create")
            });
            return "";
        }
        if (isCoordinate(location)) {
            var latLong = location.split(",");
            query = query + "key=" + key + "&lat=" + latLong[0] + "&lon=" + latLong[1] + "&units=S";
            this.app.log.Debug("System language is " + this.app.systemLanguage.toString());
            if (isLangSupported(this.app.systemLanguage, this.supportedLanguages) && this.app._translateCondition) {
                query = query + "&lang=" + this.app.systemLanguage;
            }
            return query;
        }
        else {
            this.app.log.Error("Weatherbit: Location is not a coordinate");
            this.app.HandleError({ type: "hard", detail: "bad location format", service: "weatherbit", userError: true, message: ("Please Check the location,\nmake sure it is a coordinate") });
            return "";
        }
    };
    ;
    Weatherbit.prototype.HandleHTTPError = function (error, uiError) {
        if (error.code == 403) {
            uiError.detail = "bad key";
            uiError.message = _("Please Make sure you\nentered the API key correctly and your account is not locked");
            uiError.type = "hard";
            uiError.userError = true;
        }
        return uiError;
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
                return [icons.storm];
            case "d01d":
            case "d01n":
            case "d02d":
            case "d02n":
            case "d03d":
            case "d03n":
                return [icons.showers_scattered, icons.rain, icons.rain_freezing];
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
                return [icons.rain, icons.rain_freezing, icons.showers_scattered];
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
                return [icons.snow];
            case "s05d":
            case "s05n":
                return [icons.rain_freezing, icons.rain, icons.showers_scattered];
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
                return [icons.fog];
            case "c02d":
                return [icons.few_clouds_day];
            case "c02n":
                return [icons.few_clouds_night];
            case "c01n":
                return [icons.clear_night];
            case "c01d":
                return [icons.clear_day];
            case "c03d":
                return [icons.clouds, icons.few_clouds_day, icons.overcast];
            case "c03n":
                return [icons.clouds, icons.few_clouds_night, icons.overcast];
            case "c04n":
                return [icons.overcast, icons.clouds, icons.few_clouds_night];
            case "c04d":
                return [icons.overcast, icons.clouds, icons.few_clouds_day];
            case "u00d":
            case "u00n":
                return [icons.alert];
            default:
                return [icons.alert];
        }
    };
    ;
    Weatherbit.prototype.ResolveCustomIcon = function (icon) {
        switch (icon) {
            case "t01d":
            case "t02d":
            case "t03d":
                return "Cloud-Lightning-Sun";
            case "t04d":
            case "t05d":
                return "Cloud-Lightning";
            case "t01n":
            case "t02n":
            case "t03n":
                return "Cloud-Lightning-Moon";
            case "t04n":
            case "t05n":
                return "Cloud-Lightning";
            case "d01d":
            case "d02d":
            case "d03d":
            case "d01n":
            case "d02n":
            case "d03n":
                return "Cloud-Drizzle";
            case "r01d":
            case "r02d":
            case "r03d":
            case "r01n":
            case "r02n":
            case "r03n":
                return "Cloud-Rain";
            case "r04d":
            case "r05d":
                return "Cloud-Rain-Sun";
            case "r06d":
                return "Cloud-Rain";
            case "r04n":
            case "r05n":
                return "Cloud-Rain-Moon";
            case "r06n":
                return "Cloud-Rain";
            case "s01d":
            case "s04d":
                return "Cloud-Snow-Sun";
            case "s02d":
            case "s03d":
            case "s06d":
                return "Cloud-Snow";
            case "s01n":
            case "s04n":
                return "Cloud-Snow-Moon";
            case "s02n":
            case "s03n":
            case "s06n":
                return "Cloud-Snow";
            case "s05d":
            case "s05n":
                return "Cloud-Hail";
            case "a01d":
            case "a02d":
            case "a03d":
            case "a04d":
            case "a05d":
            case "a06d":
                return "Cloud-Fog-Sun";
            case "a01n":
            case "a02n":
            case "a03n":
            case "a04n":
            case "a05n":
            case "a06n":
                return "Cloud-Fog-Moon";
            case "c02d":
                return "Cloud-Sun";
            case "c02n":
                return "Cloud-Moon";
            case "c01n":
                return "Moon";
            case "c01d":
                return "Sun";
            case "c03d":
                return "Cloud-Sun";
            case "c03n":
                return "Cloud-Moon";
            case "c04n":
                return "Cloud";
            case "c04d":
                return "Cloud";
            case "u00d":
            case "u00n":
                return "Cloud-Refresh";
            default:
                return "Cloud-Refresh";
        }
    };
    return Weatherbit;
}());
;
