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
var weatherIconSafely = utils.weatherIconSafely;
var CelsiusToKelvin = utils.CelsiusToKelvin;
var SunCalc = importModule("sunCalc").SunCalc;
var IsNight = utils.IsNight;
var _ = utils._;
var MetNorway = (function () {
    function MetNorway(app) {
        this.prettyName = "MET Norway";
        this.name = "MetNorway";
        this.maxForecastSupport = 10;
        this.website = "https://www.met.no/en";
        this.maxHourlyForecastSupport = 48;
        this.baseUrl = "https://api.met.no/weatherapi/locationforecast/2.0/complete?";
        this.ctx = this;
        this.app = app;
        this.sunCalc = new SunCalc();
    }
    MetNorway.prototype.GetWeather = function (loc) {
        return __awaiter(this, void 0, void 0, function () {
            var query, json, e_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        query = this.GetUrl(loc);
                        if (!(query != "" && query != null)) return [3, 5];
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4, this.app.LoadJsonAsync(query)];
                    case 2:
                        json = _a.sent();
                        return [3, 4];
                    case 3:
                        e_1 = _a.sent();
                        this.app.HandleHTTPError("met-norway", e_1, this.app);
                        this.app.log.Error("MET Norway: Network error - " + e_1);
                        return [2, null];
                    case 4:
                        if (!json) {
                            this.app.HandleError({ type: "soft", detail: "no api response", service: "met-norway" });
                            this.app.log.Error("MET Norway: Empty response from API");
                            return [2, null];
                        }
                        return [2, this.ParseWeather(json)];
                    case 5: return [2, null];
                }
            });
        });
    };
    MetNorway.prototype.RemoveEarlierElements = function (json) {
        var now = new Date();
        var startIndex = -1;
        for (var i = 0; i < json.properties.timeseries.length; i++) {
            var element = json.properties.timeseries[i];
            var timestamp = new Date(element.time);
            if (timestamp < now && now.getHours() != timestamp.getHours()) {
                startIndex = i;
            }
            else {
                break;
            }
        }
        if (startIndex != -1) {
            this.app.log.Debug("Removing outdated weather information...");
            json.properties.timeseries.splice(0, startIndex + 1);
        }
        return json;
    };
    MetNorway.prototype.ParseWeather = function (json) {
        json = this.RemoveEarlierElements(json);
        var times = this.sunCalc.getTimes(new Date(), json.geometry.coordinates[1], json.geometry.coordinates[0], json.geometry.coordinates[2]);
        var current = json.properties.timeseries[0];
        var result = {
            temperature: CelsiusToKelvin(current.data.instant.details.air_temperature),
            coord: {
                lat: json.geometry.coordinates[1],
                lon: json.geometry.coordinates[0]
            },
            date: new Date(current.time),
            condition: this.ResolveCondition(current.data.next_1_hours.summary.symbol_code, IsNight(times)),
            humidity: current.data.instant.details.relative_humidity,
            pressure: current.data.instant.details.air_pressure_at_sea_level,
            extra_field: {
                name: _("Cloudiness"),
                type: "percent",
                value: current.data.instant.details.cloud_area_fraction
            },
            sunrise: times.sunrise,
            sunset: times.sunset,
            wind: {
                degree: current.data.instant.details.wind_from_direction,
                speed: current.data.instant.details.wind_speed
            },
            location: {
                url: null,
            },
            forecasts: []
        };
        var hourlyForecasts = [];
        for (var i = 0; i < json.properties.timeseries.length; i++) {
            var element = json.properties.timeseries[i];
            if (!!element.data.next_1_hours) {
                hourlyForecasts.push({
                    date: new Date(element.time),
                    temp: CelsiusToKelvin(element.data.instant.details.air_temperature),
                    precipitation: {
                        type: "rain",
                        volume: element.data.next_1_hours.details.precipitation_amount
                    },
                    condition: this.ResolveCondition(element.data.next_1_hours.summary.symbol_code, IsNight(times, new Date(element.time)))
                });
            }
        }
        result.hourlyForecasts = hourlyForecasts;
        result.forecasts = this.BuildForecasts(json.properties.timeseries);
        return result;
    };
    MetNorway.prototype.BuildForecasts = function (forecastsData) {
        var forecasts = [];
        var days = this.SortDataByDay(forecastsData);
        for (var i = 0; i < days.length; i++) {
            var forecast = {
                condition: {
                    customIcon: "cloudy-symbolic",
                    description: "",
                    icon: "weather-severe-alert",
                    main: ""
                },
                date: null,
                temp_max: Number.NEGATIVE_INFINITY,
                temp_min: Number.POSITIVE_INFINITY
            };
            var conditionCounter = {};
            for (var j = 0; j < days[i].length; j++) {
                var element = days[i][j];
                if (!element.data.next_6_hours)
                    continue;
                forecast.date = new Date(element.time);
                if (element.data.next_6_hours.details.air_temperature_max > forecast.temp_max)
                    forecast.temp_max = element.data.next_6_hours.details.air_temperature_max;
                if (element.data.next_6_hours.details.air_temperature_min < forecast.temp_min)
                    forecast.temp_min = element.data.next_6_hours.details.air_temperature_min;
                var symbol = element.data.next_6_hours.summary.symbol_code.split("_")[0];
                var severity = conditionSeverity[symbol];
                if (!conditionCounter[severity])
                    conditionCounter[severity] = { count: 0, name: symbol };
                conditionCounter[severity].count = conditionCounter[severity].count + 1;
            }
            forecast.temp_max = CelsiusToKelvin(forecast.temp_max);
            forecast.temp_min = CelsiusToKelvin(forecast.temp_min);
            forecast.condition = this.ResolveCondition(this.GetMostSevereCondition(conditionCounter));
            forecasts.push(forecast);
        }
        return forecasts;
    };
    MetNorway.prototype.GetEarliestDataForToday = function (events) {
        var earliest = 0;
        for (var i = 0; i < events.length; i++) {
            var earliestElementTime = new Date(events[earliest].time);
            var timestamp = new Date(events[i].time);
            if (timestamp.toDateString() != new Date().toDateString())
                continue;
            if (earliestElementTime < timestamp)
                continue;
            earliest = i;
        }
        return events[earliest];
    };
    MetNorway.prototype.SortDataByDay = function (data) {
        var days = [];
        var currentDay = new Date(this.GetEarliestDataForToday(data).time);
        var dayIndex = 0;
        days.push([]);
        for (var i = 0; i < data.length; i++) {
            var element = data[i];
            var timestamp = new Date(element.time);
            if (timestamp.toDateString() == currentDay.toDateString()) {
                days[dayIndex].push(element);
            }
            else if (timestamp.toDateString() != currentDay.toDateString()) {
                dayIndex++;
                currentDay = timestamp;
                days.push([]);
                days[dayIndex].push(element);
            }
        }
        return days;
    };
    MetNorway.prototype.GetMostCommonCondition = function (count) {
        var result = null;
        for (var key in count) {
            if (result == null)
                result = parseInt(key);
            if (count[result].count < count[key].count)
                result = parseInt(key);
        }
        return count[result].name;
    };
    MetNorway.prototype.GetMostSevereCondition = function (conditions) {
        var result = null;
        for (var key in conditions) {
            var conditionID = parseInt(key);
            var resultStripped = (result > 100) ? result - 100 : result;
            var conditionIDStripped = (conditionID > 100) ? conditionID - 100 : conditionID;
            if (conditionIDStripped > resultStripped)
                result = conditionID;
        }
        if (result <= 4) {
            return this.GetMostCommonCondition(conditions);
        }
        return conditions[result].name;
    };
    MetNorway.prototype.GetUrl = function (loc) {
        var url = this.baseUrl + "lat=";
        url += (loc.lat + "&lon=" + loc.lon);
        return url;
    };
    MetNorway.prototype.DeconstructCondition = function (icon) {
        var condition = icon.split("_");
        return {
            timeOfDay: condition[1],
            condition: condition[0]
        };
    };
    MetNorway.prototype.ResolveCondition = function (icon, isNight) {
        if (isNight === void 0) { isNight = false; }
        var weather = this.DeconstructCondition(icon);
        var iconType = this.app.config.IconType();
        switch (weather.condition) {
            case "clearsky":
                return {
                    customIcon: (isNight) ? "night-clear-symbolic" : "day-sunny-symbolic",
                    main: _("Clear sky"),
                    description: _("Clear sky"),
                    icon: weatherIconSafely((isNight) ? ["weather-clear-night", "weather-severe-alert"] : ["weather-clear", "weather-severe-alert"], iconType)
                };
            case "cloudy":
                return {
                    customIcon: "cloudy-symbolic",
                    main: _("Cloudy"),
                    description: _("Cloudy"),
                    icon: weatherIconSafely((isNight) ? ["weather-overcast", "weather-clouds-night", "weather-few-clouds-night"] : ["weather-overcast", "weather-clouds", "weather-few-clouds"], iconType)
                };
            case "fair":
                return {
                    customIcon: (isNight) ? "night-cloudy-symbolic" : "day-cloudy-symbolic",
                    main: _("Fair"),
                    description: _("Fair"),
                    icon: weatherIconSafely((isNight) ? ["weather-few-clouds-night", "weather-clouds-night", "weather-overcast"] : ["weather-few-clouds", "weather-clouds", "weather-overcast"], iconType)
                };
            case "fog":
                return {
                    customIcon: "fog-symbolic",
                    main: _("Fog"),
                    description: _("Fog"),
                    icon: weatherIconSafely(["weather-fog", "weather-severe-alert"], iconType)
                };
            case "heavyrain":
                return {
                    customIcon: "rain-symbolic",
                    main: _("Heavy rain"),
                    description: _("Heavy rain"),
                    icon: weatherIconSafely(["weather-rain", "weather-freezing-rain", "weather-showers-scattered"], iconType)
                };
            case "heavyrainandthunder":
                return {
                    customIcon: "thunderstorm-symbolic",
                    main: _("Heavy rain"),
                    description: _("Heavy rain and thunder"),
                    icon: weatherIconSafely(["weather-rain", "weather-freezing-rain", "weather-showers-scattered"], iconType)
                };
            case "heavyrainshowers":
                return {
                    customIcon: (isNight) ? "night-alt-rain-symbolic" : "day-rain-symbolic",
                    main: _("Heavy rain"),
                    description: _("Heavy rain showers"),
                    icon: weatherIconSafely(["weather-showers", "weather-showers-scattered", "weather-freezing-rain"], iconType)
                };
            case "heavyrainshowersandthunder":
                return {
                    customIcon: (IsNight) ? "night-alt-thunderstorm-symbolic" : "day-thunderstorm-symbolic",
                    main: _("Heavy rain"),
                    description: _("Heavy rain showers and thunder"),
                    icon: weatherIconSafely(["weather-showers", "weather-showers-scattered", "weather-freezing-rain"], iconType)
                };
            case "heavysleet":
                return {
                    customIcon: "sleet-symbolic",
                    main: _("Heavy sleet"),
                    description: _("Heavy sleet"),
                    icon: weatherIconSafely(["weather-freezing-rain", "weather-rain", "weather-severe-alert"], iconType)
                };
            case "heavysleetandthunder":
                return {
                    customIcon: "sleet-storm-symbolic",
                    main: _("Heavy sleet"),
                    description: _("Heavy sleet and thunder"),
                    icon: weatherIconSafely(["weather-freezing-rain", "weather-rain", "weather-severe-alert"], iconType)
                };
            case "heavysleetshowers":
                return {
                    customIcon: (isNight) ? "night-alt-sleet-symbolic" : "day-sleet-symbolic",
                    main: _("Heavy sleet"),
                    description: _("Heavy sleet showers"),
                    icon: weatherIconSafely(["weather-showers", "weather-showers-scattered", "weather-freezing-rain"], iconType)
                };
            case "heavysleetshowersandthunder":
                return {
                    customIcon: (IsNight) ? "night-alt-sleet-storm-symbolic" : "day-sleet-storm-symbolic",
                    main: _("Heavy sleet"),
                    description: _("Heavy sleet showers and thunder"),
                    icon: weatherIconSafely(["weather-showers", "weather-showers-scattered", "weather-freezing-rain"], iconType)
                };
            case "heavysnow":
                return {
                    customIcon: "snow-symbolic",
                    main: _("Heavy snow"),
                    description: _("Heavy snow"),
                    icon: weatherIconSafely(["weather-snow", "weather-severe-alert"], iconType)
                };
            case "heavysnowandthunder":
                return {
                    customIcon: "snow-symbolic",
                    main: _("Heavy snow"),
                    description: _("Heavy snow and thunder"),
                    icon: weatherIconSafely(["weather-snow", "weather-severe-alert"], iconType)
                };
            case "heavysnowshowers":
                return {
                    customIcon: (isNight) ? "night-alt-snow-symbolic" : "day-snow-symbolic",
                    main: _("Heavy snow"),
                    description: _("Heavy snow showers"),
                    icon: weatherIconSafely(["weather-snow-scattered", "weather-snow"], iconType)
                };
            case "heavysnowshowersandthunder":
                return {
                    customIcon: (isNight) ? "night-alt-snow-thunderstorm-symbolic" : "day-snow-thunderstorm-symbolic",
                    main: _("Heavy snow"),
                    description: _("Heavy snow showers and thunder"),
                    icon: weatherIconSafely(["weather-snow-scattered", "weather-snow"], iconType)
                };
            case "lightrain":
                return {
                    customIcon: "rain-mix-symbolic",
                    main: _("Light rain"),
                    description: _("Light rain"),
                    icon: weatherIconSafely(["weather-showers-scattered", "weather-rain", "weather-severe-alert"], iconType)
                };
            case "lightrainandthunder":
                return {
                    customIcon: "rain-mix-storm-symbolic",
                    main: _("Light rain"),
                    description: _("Light rain and thunder"),
                    icon: weatherIconSafely(["weather-showers-scattered", "weather-rain", "weather-severe-alert"], iconType)
                };
            case "lightrainshowers":
                return {
                    customIcon: (isNight) ? "night-alt-rain-mix-symbolic" : "day-rain-mix-symbolic",
                    main: _("Light rain"),
                    description: _("Light rain showers"),
                    icon: weatherIconSafely(["weather-showers-scattered", "weather-rain", "weather-severe-alert"], iconType)
                };
            case "lightrainshowersandthunder":
                return {
                    customIcon: (isNight) ? "night-alt-rain-mix-storm-symbolic" : "day-rain-mix-storm-symbolic",
                    main: _("Light rain"),
                    description: _("Light rain showers and thunder"),
                    icon: weatherIconSafely(["weather-showers-scattered", "weather-rain", "weather-severe-alert"], iconType)
                };
            case "lightsleet":
                return {
                    customIcon: "sleet-symbolic",
                    main: _("Light sleet"),
                    description: _("Light sleet"),
                    icon: weatherIconSafely(["weather-freezing-rain", "weather-showers", "weather-severe-alert"], iconType)
                };
            case "lightsleetandthunder":
                return {
                    customIcon: "sleet-storm-symbolic",
                    main: _("Light sleet"),
                    description: _("Light sleet and thunder"),
                    icon: weatherIconSafely(["weather-freezing-rain", "weather-showers", "weather-severe-alert"], iconType)
                };
            case "lightsleetshowers":
                return {
                    customIcon: (IsNight) ? "night-alt-sleet-symbolic" : "day-sleet-symbolic",
                    main: _("Light sleet"),
                    description: _("Light sleet showers"),
                    icon: weatherIconSafely(["weather-freezing-rain", "weather-showers", "weather-severe-alert"], iconType)
                };
            case "lightssleetshowersandthunder":
                return {
                    customIcon: (IsNight) ? "night-alt-sleet-storm-symbolic" : "day-sleet-storm-symbolic",
                    main: _("Light sleet"),
                    description: _("Light sleet showers and thunder"),
                    icon: weatherIconSafely(["weather-freezing-rain", "weather-showers", "weather-severe-alert"], iconType)
                };
            case "lightsnow":
                return {
                    customIcon: "snow-symbolic",
                    main: _("Light snow"),
                    description: _("Light snow"),
                    icon: weatherIconSafely(["weather-snow", "weather-severe-alert"], iconType)
                };
            case "lightsnowandthunder":
                return {
                    customIcon: "snow-storm-symbolic",
                    main: _("Light snow"),
                    description: _("Light snow and thunder"),
                    icon: weatherIconSafely(["weather-snow", "weather-severe-alert"], iconType)
                };
            case "lightsnowshowers":
                return {
                    customIcon: (isNight) ? "night-alt-snow-symbolic" : "day-snow-symbolic",
                    main: _("Light snow"),
                    description: _("Light snow showers"),
                    icon: weatherIconSafely(["weather-snow-scattered", "weather-snow"], iconType)
                };
            case "lightssnowshowersandthunder":
                return {
                    customIcon: (isNight) ? "night-alt-snow-thunderstorm-symbolic" : "day-snow-thunderstorm-symbolic",
                    main: _("Light snow"),
                    description: _("Light snow showers and thunder"),
                    icon: weatherIconSafely(["weather-snow-scattered", "weather-snow"], iconType)
                };
            case "partlycloudy":
                return {
                    customIcon: (isNight) ? "night-alt-cloudy-symbolic" : "day-cloudy-symbolic",
                    main: _("Partly cloudy"),
                    description: _("Partly cloudy"),
                    icon: weatherIconSafely((isNight) ? ["weather-clouds-night", "weather-few-clouds-night", "weather-overcast", "weather-severe-alert"] : ["weather-clouds", "weather-few-clouds", "weather-overcast", "weather-severe-alert"], iconType)
                };
            case "rain":
                return {
                    customIcon: "rain-symbolic",
                    main: _("Rain"),
                    description: _("Rain"),
                    icon: weatherIconSafely(["weather-rain", "weather-freezing-rain", "weather-showers-scattered", "weather-severe-alert"], iconType)
                };
            case "rainandthunder":
                return {
                    customIcon: "thunderstorm-symbolic",
                    main: _("Rain"),
                    description: _("Rain and thunder"),
                    icon: weatherIconSafely(["weather-storm", "weather-rain", "weather-freezing-rain", "weather-showers-scattered", "weather-severe-alert"], iconType)
                };
            case "rainshowers":
                return {
                    customIcon: (isNight) ? "night-alt-rain-mix-symbolic" : "day-rain-mix-symbolic",
                    main: _("Rain showers"),
                    description: _("Rain showers"),
                    icon: weatherIconSafely(["weather-showers-scattered", "weather-rain", "weather-freezing-rain"], iconType)
                };
            case "rainshowersandthunder":
                return {
                    customIcon: (isNight) ? "night-alt-rain-mix-storm-symbolic" : "day-rain-mix-storm-symbolic",
                    main: _("Rain showers"),
                    description: _("Rain showers and thunder"),
                    icon: weatherIconSafely(["weather-showers-scattered", "weather-rain", "weather-freezing-rain", "weather-severe-alert"], iconType)
                };
            case "sleet":
                return {
                    customIcon: "sleet-symbolic",
                    main: _("Sleet"),
                    description: _("Sleet"),
                    icon: weatherIconSafely(["weather-freezing-rain", "weather-showers", "weather-severe-alert"], iconType)
                };
            case "sleetandthunder":
                return {
                    customIcon: "sleet-storm-symbolic",
                    main: _("Sleet"),
                    description: _("Sleet and thunder"),
                    icon: weatherIconSafely(["weather-freezing-rain", "weather-showers", "weather-severe-alert"], iconType)
                };
            case "sleetshowers":
                return {
                    customIcon: (isNight) ? "night-alt-sleet-symbolic" : "day-sleet-symbolic",
                    main: _("Sleet"),
                    description: _("Sleet showers"),
                    icon: weatherIconSafely(["weather-freezing-rain", "weather-showers", "weather-severe-alert"], iconType)
                };
            case "sleetshowersandthunder":
                return {
                    customIcon: (isNight) ? "night-alt-sleet-storm-symbolic" : "day-sleet-storm-symbolic",
                    main: _("Sleet"),
                    description: _("Sleet showers and thunder"),
                    icon: weatherIconSafely(["weather-freezing-rain", "weather-showers", "weather-severe-alert"], iconType)
                };
            case "snow":
                return {
                    customIcon: "snow-symbolic",
                    main: _("Snow"),
                    description: _("Snow"),
                    icon: weatherIconSafely(["weather-snow", "weather-severe-alert"], iconType)
                };
            case "snowandthunder":
                return {
                    customIcon: "snow-storm-symbolic",
                    main: _("Snow"),
                    description: _("Snow and thunder"),
                    icon: weatherIconSafely(["weather-snow", "weather-severe-alert"], iconType)
                };
            case "snowshowers":
                return {
                    customIcon: (isNight) ? "night-alt-snow-symbolic" : "day-snow-symbolic",
                    main: _("Snow showers"),
                    description: _("Snow showers"),
                    icon: weatherIconSafely(["weather-snow-scattered", "weather-snow"], iconType)
                };
            case "snowshowersandthunder":
                return {
                    customIcon: (isNight) ? "night-alt-snow-thunderstorm-symbolic" : "day-snow-thunderstorm-symbolic",
                    main: _("Snow showers"),
                    description: _("Snow showers and thunder"),
                    icon: weatherIconSafely(["weather-snow-scattered", "weather-snow"], iconType)
                };
            default:
                this.app.log.Error("condition code not found: " + weather.condition);
                return {
                    customIcon: "cloud-refresh-symbolic",
                    main: _("Unknown"),
                    description: _("Unknown"),
                    icon: weatherIconSafely(["weather-severe-alert"], iconType)
                };
        }
    };
    return MetNorway;
}());
var conditionSeverity = {
    clearsky: 1,
    cloudy: 4,
    fair: 2,
    fog: 15,
    heavyrain: 10,
    heavyrainandthunder: 11,
    heavyrainshowers: 41,
    heavyrainshowersandthunder: 25,
    heavysleet: 48,
    heavysleetandthunder: 32,
    heavysleetshowers: 43,
    heavysleetshowersandthunder: 27,
    heavysnow: 50,
    heavysnowandthunder: 34,
    heavysnowshowers: 45,
    heavysnowshowersandthunder: 29,
    lightrain: 46,
    lightrainandthunder: 30,
    lightrainshowers: 40,
    lightrainshowersandthunder: 24,
    lightsleet: 47,
    lightsleetandthunder: 31,
    lightsleetshowers: 42,
    lightsnow: 49,
    lightsnowandthunder: 33,
    lightsnowshowers: 44,
    lightssleetshowersandthunder: 26,
    lightssnowshowersandthunder: 28,
    partlycloudy: 3,
    rain: 9,
    rainandthunder: 22,
    rainshowers: 5,
    rainshowersandthunder: 6,
    sleet: 12,
    sleetandthunder: 23,
    sleetshowers: 7,
    sleetshowersandthunder: 20,
    snow: 13,
    snowandthunder: 14,
    snowshowers: 8,
    snowshowersandthunder: 21
};
