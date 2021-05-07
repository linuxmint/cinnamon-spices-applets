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
var FahrenheitToKelvin = utils.FahrenheitToKelvin;
var CelsiusToKelvin = utils.CelsiusToKelvin;
var MPHtoMPS = utils.MPHtoMPS;
var IsNight = utils.IsNight;
var weatherIconSafely = utils.weatherIconSafely;
var _ = utils._;
var DarkSky = (function () {
    function DarkSky(_app) {
        this.prettyName = "DarkSky";
        this.name = "DarkSky";
        this.maxForecastSupport = 8;
        this.website = "https://darksky.net/poweredby/";
        this.maxHourlyForecastSupport = 168;
        this.descriptionLinelength = 25;
        this.supportedLanguages = [
            'ar', 'az', 'be', 'bg', 'bs', 'ca', 'cs', 'da', 'de', 'el', 'en', 'es',
            'et', 'fi', 'fr', 'he', 'hr', 'hu', 'id', 'is', 'it', 'ja', 'ka', 'ko',
            'kw', 'lv', 'nb', 'nl', 'no', 'pl', 'pt', 'ro', 'ru', 'sk', 'sl', 'sr',
            'sv', 'tet', 'tr', 'uk', 'x-pig-latin', 'zh', 'zh-tw'
        ];
        this.query = "https://api.darksky.net/forecast/";
        this.DarkSkyFilterWords = [_("and"), _("until"), _("in"), _("Possible")];
        this.unit = null;
        this.app = _app;
    }
    DarkSky.prototype.GetWeather = function (loc) {
        return __awaiter(this, void 0, void 0, function () {
            var query, json, e_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        query = this.ConstructQuery(loc);
                        if (!(query != "" && query != null)) return [3, 5];
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4, this.app.LoadJsonAsync(query, this.OnObtainingData)];
                    case 2:
                        json = _a.sent();
                        return [3, 4];
                    case 3:
                        e_1 = _a.sent();
                        this.app.HandleHTTPError("darksky", e_1, this.app);
                        return [2, null];
                    case 4:
                        if (!json) {
                            this.app.HandleError({ type: "soft", detail: "no api response", service: "darksky" });
                            return [2, null];
                        }
                        if (!json.code) {
                            return [2, this.ParseWeather(json)];
                        }
                        else {
                            this.HandleResponseErrors(json);
                            return [2, null];
                        }
                        _a.label = 5;
                    case 5: return [2, null];
                }
            });
        });
    };
    ;
    DarkSky.prototype.ParseWeather = function (json) {
        try {
            var sunrise = new Date(json.daily.data[0].sunriseTime * 1000);
            var sunset = new Date(json.daily.data[0].sunsetTime * 1000);
            var result = {
                date: new Date(json.currently.time * 1000),
                coord: {
                    lat: json.latitude,
                    lon: json.longitude
                },
                location: {
                    url: "https://darksky.net/forecast/" + json.latitude + "," + json.longitude,
                    timeZone: json.timezone,
                },
                sunrise: sunrise,
                sunset: sunset,
                wind: {
                    speed: this.ToMPS(json.currently.windSpeed),
                    degree: json.currently.windBearing
                },
                temperature: this.ToKelvin(json.currently.temperature),
                pressure: json.currently.pressure,
                humidity: json.currently.humidity * 100,
                condition: {
                    main: this.GetShortCurrentSummary(json.currently.summary),
                    description: json.currently.summary,
                    icon: weatherIconSafely(this.ResolveIcon(json.currently.icon, { sunrise: sunrise, sunset: sunset }), this.app.config.IconType()),
                    customIcon: this.ResolveCustomIcon(json.currently.icon)
                },
                extra_field: {
                    name: _("Feels Like"),
                    value: this.ToKelvin(json.currently.apparentTemperature),
                    type: "temperature"
                },
                forecasts: [],
                hourlyForecasts: []
            };
            for (var i = 0; i < json.daily.data.length; i++) {
                var day = json.daily.data[i];
                var forecast = {
                    date: new Date(day.time * 1000),
                    temp_min: this.ToKelvin(day.temperatureLow),
                    temp_max: this.ToKelvin(day.temperatureHigh),
                    condition: {
                        main: this.GetShortSummary(day.summary),
                        description: this.ProcessSummary(day.summary),
                        icon: weatherIconSafely(this.ResolveIcon(day.icon), this.app.config.IconType()),
                        customIcon: this.ResolveCustomIcon(day.icon)
                    },
                };
                forecast.date.setHours(forecast.date.getHours() + 12);
                result.forecasts.push(forecast);
            }
            for (var i = 0; i < json.hourly.data.length; i++) {
                var hour = json.hourly.data[i];
                var forecast = {
                    date: new Date(hour.time * 1000),
                    temp: this.ToKelvin(hour.temperature),
                    condition: {
                        main: this.GetShortSummary(hour.summary),
                        description: this.ProcessSummary(hour.summary),
                        icon: weatherIconSafely(this.ResolveIcon(hour.icon, { sunrise: sunrise, sunset: sunset }, new Date(hour.time * 1000)), this.app.config.IconType()),
                        customIcon: this.ResolveCustomIcon(hour.icon)
                    },
                    precipitation: {
                        type: hour.precipType,
                        volume: hour.precipProbability,
                        chance: hour.precipProbability * 100
                    }
                };
                result.hourlyForecasts.push(forecast);
            }
            return result;
        }
        catch (e) {
            this.app.log.Error("DarkSky payload parsing error: " + e);
            this.app.HandleError({ type: "soft", detail: "unusual payload", service: "darksky", message: _("Failed to Process Weather Info") });
            return null;
        }
    };
    ;
    DarkSky.prototype.ConvertToAPILocale = function (systemLocale) {
        if (systemLocale == "zh-tw") {
            return systemLocale;
        }
        var lang = systemLocale.split("-")[0];
        return lang;
    };
    DarkSky.prototype.ConstructQuery = function (loc) {
        this.SetQueryUnit();
        var query;
        var key = this.app.config._apiKey.replace(" ", "");
        if (this.app.config.noApiKey()) {
            this.app.log.Error("DarkSky: No API Key given");
            this.app.HandleError({
                type: "hard",
                userError: true,
                "detail": "no key",
                message: _("Please enter API key in settings,\nor get one first on https://darksky.net/dev/register")
            });
            return "";
        }
        query = this.query + key + "/" + loc.text + "?exclude=minutely,flags" + "&units=" + this.unit;
        var locale = this.ConvertToAPILocale(this.app.currentLocale);
        if (isLangSupported(locale, this.supportedLanguages) && this.app.config._translateCondition) {
            query = query + "&lang=" + locale;
        }
        return query;
    };
    DarkSky.prototype.OnObtainingData = function (message) {
        if (message.status_code == 403) {
            return {
                type: "hard",
                userError: true,
                detail: "bad key",
                service: "darksky",
                message: _("Please Make sure you\nentered the API key correctly and your account is not locked")
            };
        }
        if (message.status_code == 401) {
            return {
                type: "hard",
                userError: true,
                detail: "no key",
                service: "darksky",
                message: _("Please Make sure you\nentered the API key that you have from DarkSky")
            };
        }
        return null;
    };
    DarkSky.prototype.HandleResponseErrors = function (json) {
        var code = json.code;
        var error = json.error;
        var errorMsg = "DarkSky API: ";
        this.app.log.Debug("DarksSky API error payload: " + json);
        switch (code) {
            case "400":
                this.app.log.Error(errorMsg + error);
                break;
            default:
                this.app.log.Error(errorMsg + error);
                break;
        }
    };
    ;
    DarkSky.prototype.ProcessSummary = function (summary) {
        var processed = summary.split(" ");
        var result = "";
        var linelength = 0;
        for (var i = 0; i < processed.length; i++) {
            if (linelength + processed[i].length > this.descriptionLinelength) {
                result = result + "\n";
                linelength = 0;
            }
            result = result + processed[i] + " ";
            linelength = linelength + processed[i].length + 1;
        }
        return result;
    };
    ;
    DarkSky.prototype.GetShortSummary = function (summary) {
        var processed = summary.split(" ");
        if (processed.length == 1)
            return processed[0];
        var result = [];
        for (var i = 0; i < processed.length; i++) {
            if (!/[\(\)]/.test(processed[i]) && !this.WordBanned(processed[i])) {
                result.push(processed[i]) + " ";
            }
            if (result.length == 2)
                break;
        }
        return result.join(" ");
    };
    ;
    DarkSky.prototype.GetShortCurrentSummary = function (summary) {
        var processed = summary.split(" ");
        var result = "";
        var maxLoop;
        (processed.length < 2) ? maxLoop = processed.length : maxLoop = 2;
        for (var i = 0; i < maxLoop; i++) {
            if (processed[i] != "and") {
                result = result + processed[i] + " ";
            }
        }
        return result;
    };
    DarkSky.prototype.WordBanned = function (word) {
        return this.DarkSkyFilterWords.indexOf(word) != -1;
    };
    DarkSky.prototype.ResolveIcon = function (icon, sunTimes, date) {
        switch (icon) {
            case "rain":
                return ["weather-rain", "weather-showers-scattered", "weather-freezing-rain"];
            case "snow":
                return ["weather-snow"];
            case "sleet":
                return ["weather-freezing-rain", "weather-rain", "weather-showers-scattered"];
            case "fog":
                return ["weather-fog"];
            case "wind":
                return (sunTimes && IsNight(sunTimes, date)) ? ["weather-windy", "weather-breeze", "weather-clouds", "weather-few-clouds-night"] : ["weather-windy", "weather-breeze", "weather-clouds", "weather-few-clouds"];
            case "cloudy":
                return (sunTimes && IsNight(sunTimes, date)) ? ["weather-overcast", "weather-clouds", "weather-few-clouds-night"] : ["weather-overcast", "weather-clouds", "weather-few-clouds"];
            case "partly-cloudy-night":
                return ["weather-few-clouds-night"];
            case "partly-cloudy-day":
                return ["weather-few-clouds"];
            case "clear-night":
                return ["weather-clear-night"];
            case "clear-day":
                return ["weather-clear"];
            case "storm":
                return ["weather-storm"];
            case "showers":
                return ["weather-showers", "weather-showers-scattered"];
            default:
                return ["weather-severe-alert"];
        }
    };
    ;
    DarkSky.prototype.ResolveCustomIcon = function (icon) {
        switch (icon) {
            case "rain":
                return "rain-symbolic";
            case "snow":
                return "snow-symbolic";
            case "fog":
                return "fog-symbolic";
            case "cloudy":
                return "cloudy-symbolic";
            case "partly-cloudy-night":
                return "night-alt-cloudy-symbolic";
            case "partly-cloudy-day":
                return "day-cloudy-symbolic";
            case "clear-night":
                return "night-clear-symbolic";
            case "clear-day":
                return "day-sunny-symbolic";
            case "storm":
                return "thunderstorm-symbolic";
            case "showers":
                return "showers-symbolic";
            case "wind":
                return "strong-wind-symbolic";
            default:
                return "cloud-refresh-symbolic";
        }
    };
    DarkSky.prototype.SetQueryUnit = function () {
        if (this.app.config.TemperatureUnit() == "celsius") {
            if (this.app.config.WindSpeedUnit() == "kph" || this.app.config.WindSpeedUnit() == "m/s") {
                this.unit = 'si';
            }
            else {
                this.unit = 'uk2';
            }
        }
        else {
            this.unit = 'us';
        }
    };
    ;
    DarkSky.prototype.ToKelvin = function (temp) {
        if (this.unit == 'us') {
            return FahrenheitToKelvin(temp);
        }
        else {
            return CelsiusToKelvin(temp);
        }
    };
    ;
    DarkSky.prototype.ToMPS = function (speed) {
        if (this.unit == 'si') {
            return speed;
        }
        else {
            return MPHtoMPS(speed);
        }
    };
    ;
    return DarkSky;
}());
;
