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
if (!Array.prototype.includes) {
    importModule("array-includes-polyfill");
}
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
                        if (json == null) {
                            this.app.showError(this.app.errMsg.label.service, this.app.errMsg.desc.noResponse);
                            return [2, false];
                        }
                        return [3, 4];
                    case 3:
                        e_1 = _a.sent();
                        this.app.log.Error("DarkSky: API call failed: " + e_1);
                        this.app.showError(this.app.errMsg.label.service, this.app.errMsg.desc.noResponse);
                        return [2, false];
                    case 4:
                        if (!json.code) {
                            return [2, this.ParseWeather(json)];
                        }
                        else {
                            this.HandleResponseErrors(json);
                            return [2, false];
                        }
                        _a.label = 5;
                    case 5:
                        this.app.log.Error("DarkSky: Could not construct query, insufficent information");
                        this.app.showError(this.app.errMsg.label.service, this.app.errMsg.desc.locBad);
                        return [2, false];
                }
            });
        });
    };
    ;
    DarkSky.prototype.ParseWeather = function (json) {
        try {
            this.app.weather.dateTime = new Date(json.currently.time * 1000);
            this.app.weather.location.timeZone = json.timezone;
            this.app.weather.coord.lat = json.latitude;
            this.app.weather.coord.lon = json.longitude;
            this.app.weather.sunrise = new Date(json.daily.data[0].sunriseTime * 1000);
            this.app.weather.sunset = new Date(json.daily.data[0].sunsetTime * 1000);
            this.app.weather.wind.speed = this.ToMPS(json.currently.windSpeed);
            this.app.weather.wind.degree = json.currently.windBearing;
            this.app.weather.main.temperature = this.ToKelvin(json.currently.temperature);
            this.app.weather.main.pressure = json.currently.pressure;
            this.app.weather.main.humidity = json.currently.humidity * 100;
            this.app.weather.condition.main = this.GetShortCurrentSummary(json.currently.summary);
            this.app.weather.condition.description = json.currently.summary;
            this.app.weather.condition.icon = this.app.weatherIconSafely(json.currently.icon, this.ResolveIcon);
            this.app.weather.cloudiness = json.currently.cloudCover * 100;
            this.app.weather.main.feelsLike = this.ToKelvin(json.currently.apparentTemperature);
            for (var i = 0; i < this.app._forecastDays; i++) {
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
                var day = json.daily.data[i];
                forecast.dateTime = new Date(day.time * 1000);
                forecast.dateTime.setHours(forecast.dateTime.getHours() + 12);
                forecast.main.temp_min = this.ToKelvin(day.temperatureLow);
                forecast.main.temp_max = this.ToKelvin(day.temperatureHigh);
                forecast.condition.main = this.GetShortSummary(day.summary);
                forecast.condition.description = this.ProcessSummary(day.summary);
                forecast.condition.icon = this.app.weatherIconSafely(day.icon, this.ResolveIcon);
                forecast.main.pressure = day.pressure;
                forecast.main.humidity = day.humidity * 100;
                this.app.forecasts.push(forecast);
            }
        }
        catch (e) {
            this.app.log.Error("DarkSky payload parsing error: " + e);
            this.app.showError(this.app.errMsg.label.generic, this.app.errMsg.desc.parse);
            return false;
        }
        return true;
    };
    ;
    DarkSky.prototype.ConstructQuery = function () {
        this.SetQueryUnit();
        var query;
        var key = this.app._apiKey.replace(" ", "");
        var location = this.app._location.replace(" ", "");
        if (this.app.noApiKey()) {
            this.app.showError(this.app.errMsg.label.noKey, "");
            return "";
        }
        if (this.app.isCoordinate(location)) {
            query = this.query + key + "/" + location +
                "?exclude=minutely,hourly,flags" + "&units=" + this.unit;
            if (this.app.isLangSupported(this.app.systemLanguage, this.supportedLanguages) && this.app._translateCondition) {
                query = query + "&lang=" + this.app.systemLanguage;
            }
            return query;
        }
        else {
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
            if (!/[\(\)]/.test(processed[i]) && !(this.app.DarkSkyFilterWords.includes(processed[i]))) {
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
    DarkSky.prototype.ResolveIcon = function (icon) {
        switch (icon) {
            case "rain":
                return ['weather-rain', 'weather-showers-scattered', 'weather-freezing-rain'];
            case "snow":
                return ['weather-snow'];
            case "fog":
                return ['weather-fog'];
            case "cloudy":
                return ['weather-overcast', 'weather-clouds', , 'weather-few-clouds'];
            case "partly-cloudy-night":
                return ['weather-few-clouds-night', "weather-few-clouds"];
            case "partly-cloudy-day":
                return ['weather-few-clouds'];
            case "clear-night":
                return ['weather-clear-night'];
            case "clear-day":
                return ['weather-clear'];
            case "storm":
                return ['weather-storm'];
            case "showers":
                return ['weather-showers'];
            case "wind":
                return ["weather-wind", "wind", "weather-breeze", 'weather-clouds', 'weather-few-clouds'];
            default:
                return ['weather-severe-alert'];
        }
    };
    ;
    DarkSky.prototype.SetQueryUnit = function () {
        if (this.app._temperatureUnit == this.app.WeatherUnits.CELSIUS) {
            if (this.app._windSpeedUnit == this.app.WeatherWindSpeedUnits.KPH || this.app._windSpeedUnit == this.app.WeatherWindSpeedUnits.MPS) {
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
            return this.app.FahrenheitToKelvin(temp);
        }
        else {
            return this.app.CelsiusToKelvin(temp);
        }
    };
    ;
    DarkSky.prototype.ToMPS = function (speed) {
        if (this.unit == 'si') {
            return speed;
        }
        else {
            return this.app.MPHtoMPS(speed);
        }
    };
    ;
    return DarkSky;
}());
;
