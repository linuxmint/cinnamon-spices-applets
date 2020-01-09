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
var icons = utils.icons;
var weatherIconSafely = utils.weatherIconSafely;
var DarkSky = (function () {
    function DarkSky(_app) {
        this.descriptionLinelength = 25;
        this.supportedLanguages = [
            'ar', 'az', 'be', 'bg', 'bs', 'ca', 'cs', 'da', 'de', 'el', 'en', 'es',
            'et', 'fi', 'fr', 'he', 'hr', 'hu', 'id', 'is', 'it', 'ja', 'ka', 'ko',
            'kw', 'lv', 'nb', 'nl', 'no', 'pl', 'pt', 'ro', 'ru', 'sk', 'sl', 'sr',
            'sv', 'tet', 'tr', 'uk', 'x-pig-latin', 'zh', 'zh-tw'
        ];
        this.query = "https://api.darksky.net/forecast/";
        this.DarkSkyFilterWords = [_("and"), _("until"), _("in")];
        this.unit = null;
        this.app = _app;
    }
    DarkSky.prototype.GetWeather = function () {
        return __awaiter(this, void 0, void 0, function () {
            var query, json, e_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        query = this.ConstructQuery();
                        if (!(query != "" && query != null)) return [3, 5];
                        this.app.log.Debug("DarkSky API query: " + query);
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4, this.app.LoadJsonAsync(query)];
                    case 2:
                        json = _a.sent();
                        return [3, 4];
                    case 3:
                        e_1 = _a.sent();
                        this.app.HandleHTTPError("darksky", e_1, this.app, this.HandleHTTPError);
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
                sunrise: new Date(json.daily.data[0].sunriseTime * 1000),
                sunset: new Date(json.daily.data[0].sunsetTime * 1000),
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
                    icon: weatherIconSafely(this.ResolveIcon(json.currently.icon), this.app._icon_type),
                    customIcon: this.ResolveCustomIcon(json.currently.icon)
                },
                extra_field: {
                    name: _("Feels Like"),
                    value: this.ToKelvin(json.currently.apparentTemperature),
                    type: "temperature"
                },
                forecasts: []
            };
            for (var i = 0; i < this.app._forecastDays; i++) {
                var day = json.daily.data[i];
                var forecast = {
                    date: new Date(day.time * 1000),
                    temp_min: this.ToKelvin(day.temperatureLow),
                    temp_max: this.ToKelvin(day.temperatureHigh),
                    condition: {
                        main: this.GetShortSummary(day.summary),
                        description: this.ProcessSummary(day.summary),
                        icon: weatherIconSafely(this.ResolveIcon(day.icon), this.app._icon_type),
                        customIcon: this.ResolveCustomIcon(day.icon)
                    },
                };
                forecast.date.setHours(forecast.date.getHours() + 12);
                result.forecasts.push(forecast);
            }
            return result;
        }
        catch (e) {
            this.app.log.Error("DarkSky payload parsing error: " + e);
            this.app.HandleError({ type: "soft", detail: "unusal payload", service: "darksky", message: _("Failed to Process Weather Info") });
            return null;
        }
    };
    ;
    DarkSky.prototype.ConstructQuery = function () {
        this.SetQueryUnit();
        var query;
        var key = this.app._apiKey.replace(" ", "");
        var location = this.app._location.replace(" ", "");
        if (this.app.noApiKey()) {
            this.app.log.Error("DarkSky: No API Key given");
            this.app.HandleError({
                type: "hard",
                userError: true,
                "detail": "no key",
                message: _("Please enter API key in settings,\nor get one first on https://darksky.net/dev/register")
            });
            return "";
        }
        if (isCoordinate(location)) {
            query = this.query + key + "/" + location +
                "?exclude=minutely,hourly,flags" + "&units=" + this.unit;
            this.app.log.Debug("System language is " + this.app.systemLanguage.toString());
            if (isLangSupported(this.app.systemLanguage, this.supportedLanguages) && this.app._translateCondition) {
                query = query + "&lang=" + this.app.systemLanguage;
            }
            return query;
        }
        else {
            this.app.log.Error("DarkSky: Location is not a coordinate");
            this.app.HandleError({ type: "hard", detail: "bad location format", service: "darksky", userError: true, message: ("Please Check the location,\nmake sure it is a coordinate") });
            return "";
        }
    };
    ;
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
    DarkSky.prototype.HandleHTTPError = function (error, uiError) {
        if (error.code == 403) {
            uiError.detail = "bad key";
            uiError.message = _("Please Make sure you\nentered the API key correctly and your account is not locked");
            uiError.type = "hard";
            uiError.userError = true;
        }
        return uiError;
    };
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
        var result = "";
        for (var i = 0; i < 2; i++) {
            if (!/[\(\)]/.test(processed[i]) && !this.WordBanned(processed[i])) {
                result = result + processed[i] + " ";
            }
        }
        return result;
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
    DarkSky.prototype.ResolveIcon = function (icon) {
        switch (icon) {
            case "rain":
                return [icons.rain, icons.showers_scattered, icons.rain_freezing];
            case "snow":
                return [icons.snow];
            case "fog":
                return [icons.fog];
            case "cloudy":
                return [icons.overcast, icons.clouds, icons.few_clouds_day];
            case "partly-cloudy-night":
                return [icons.few_clouds_night, icons.few_clouds_day];
            case "partly-cloudy-day":
                return [icons.few_clouds_day];
            case "clear-night":
                return [icons.clear_night];
            case "clear-day":
                return [icons.clear_day];
            case "storm":
                return [icons.storm];
            case "showers":
                return [icons.showers];
            case "wind":
                return ["weather-wind", "wind", "weather-breeze", icons.clouds, icons.few_clouds_day];
            default:
                return [icons.alert];
        }
    };
    ;
    DarkSky.prototype.ResolveCustomIcon = function (icon) {
        switch (icon) {
            case "rain":
                return "Cloud-Rain";
            case "snow":
                return "Cloud-Snow";
            case "fog":
                return "Cloud-Fog";
            case "cloudy":
                return "Cloud";
            case "partly-cloudy-night":
                return "Cloud-Moon";
            case "partly-cloudy-day":
                return "Cloud-Sun";
            case "clear-night":
                return "Moon";
            case "clear-day":
                return "Sun";
            case "storm":
                return "Cloud-Lightning";
            case "showers":
                return "Cloud-Drizzle";
            case "wind":
                return "Wind";
            default:
                return "Cloud-Refresh";
        }
    };
    DarkSky.prototype.SetQueryUnit = function () {
        if (this.app._temperatureUnit == "celsius") {
            if (this.app._windSpeedUnit == "kph" || this.app._windSpeedUnit == "m/s") {
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
