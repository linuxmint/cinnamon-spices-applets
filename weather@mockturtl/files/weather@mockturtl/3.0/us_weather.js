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
var SunCalc = importModule("sunCalc").SunCalc;
var IsNight = utils.IsNight;
var CelsiusToKelvin = utils.CelsiusToKelvin;
var FahrenheitToKelvin = utils.FahrenheitToKelvin;
var KPHtoMPS = utils.MPHtoMPS;
var get = utils.get;
var compassToDeg = utils.compassToDeg;
var GetDistance = utils.GetDistance;
var _ = utils._;
var USWeather = (function () {
    function USWeather(_app) {
        this.prettyName = "US Weather";
        this.name = "US Weather";
        this.maxForecastSupport = 7;
        this.website = "https://www.weather.gov/";
        this.maxHourlyForecastSupport = 156;
        this.sitesUrl = "https://api.weather.gov/points/";
        this.grid = null;
        this.MAX_STATION_DIST = 50000;
        this.observationStations = null;
        this.currentLoc = null;
        this.app = _app;
        this.sunCalc = new SunCalc();
    }
    USWeather.prototype.GetWeather = function (loc) {
        return __awaiter(this, void 0, void 0, function () {
            var grid, observationStations, observations, hourly, forecast, hourlyForecastPromise, forecastPromise, e_1, weather;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (loc == null)
                            return [2, null];
                        if (!(!this.grid || !this.observationStations || this.currentLoc.text != loc.text)) return [3, 3];
                        this.app.log.Print("Downloading new site data");
                        this.currentLoc = loc;
                        return [4, this.GetGridData(loc)];
                    case 1:
                        grid = _a.sent();
                        if (grid == null)
                            return [2, null];
                        return [4, this.GetStationData(grid.properties.observationStations)];
                    case 2:
                        observationStations = _a.sent();
                        if (observationStations == null)
                            return [2, null];
                        this.grid = grid;
                        this.observationStations = observationStations;
                        return [3, 4];
                    case 3:
                        this.app.log.Debug("Site data downloading skipped");
                        _a.label = 4;
                    case 4: return [4, this.GetObservationsInRange(this.MAX_STATION_DIST, loc, this.observationStations)];
                    case 5:
                        observations = _a.sent();
                        hourly = null;
                        forecast = null;
                        _a.label = 6;
                    case 6:
                        _a.trys.push([6, 9, , 10]);
                        hourlyForecastPromise = this.app.LoadJsonAsync(this.grid.properties.forecastHourly + "?units=si");
                        forecastPromise = this.app.LoadJsonAsync(this.grid.properties.forecast);
                        return [4, hourlyForecastPromise];
                    case 7:
                        hourly = _a.sent();
                        return [4, forecastPromise];
                    case 8:
                        forecast = _a.sent();
                        return [3, 10];
                    case 9:
                        e_1 = _a.sent();
                        this.app.log.Error("Failed to obtain forecast Data, error: " + JSON.stringify(e_1, null, 2));
                        this.app.HandleError({ type: "soft", detail: "bad api response", message: _("Could not get forecast for your area") });
                        return [2, null];
                    case 10:
                        weather = this.ParseCurrent(observations, hourly);
                        weather.forecasts = this.ParseForecast(forecast);
                        weather.hourlyForecasts = this.ParseHourlyForecast(hourly, this);
                        return [2, weather];
                }
            });
        });
    };
    ;
    USWeather.prototype.GetGridData = function (loc) {
        return __awaiter(this, void 0, void 0, function () {
            var siteData, e_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4, this.app.LoadJsonAsync(this.sitesUrl + loc.text, this.OnObtainingGridData)];
                    case 1:
                        siteData = _a.sent();
                        this.app.log.Debug("Grid found: " + JSON.stringify(siteData, null, 2));
                        return [2, siteData];
                    case 2:
                        e_2 = _a.sent();
                        this.app.HandleError({
                            type: "soft",
                            userError: true,
                            detail: "no network response",
                            service: "us-weather",
                            message: _("Unexpected response from API")
                        });
                        this.app.log.Error("Failed to Obtain Grid data, error: " + JSON.stringify(e_2, null, 2));
                        return [2, null];
                    case 3: return [2];
                }
            });
        });
    };
    USWeather.prototype.GetStationData = function (stationListUrl) {
        return __awaiter(this, void 0, void 0, function () {
            var stations, e_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4, this.app.LoadJsonAsync(stationListUrl)];
                    case 1:
                        stations = _a.sent();
                        return [2, stations.features];
                    case 2:
                        e_3 = _a.sent();
                        this.app.log.Error("Failed to obtain station data, error: " + JSON.stringify(e_3, null, 2));
                        this.app.HandleError({
                            type: "soft",
                            userError: true,
                            detail: "no network response",
                            service: "us-weather",
                            message: _("Unexpected response from API")
                        });
                        return [2, null];
                    case 3: return [2];
                }
            });
        });
    };
    USWeather.prototype.GetObservationsInRange = function (range, loc, stations) {
        return __awaiter(this, void 0, void 0, function () {
            var observations, index, element, _a, _b, _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        observations = [];
                        index = 0;
                        _d.label = 1;
                    case 1:
                        if (!(index < stations.length)) return [3, 6];
                        element = stations[index];
                        element.dist = GetDistance(element.geometry.coordinates[1], element.geometry.coordinates[0], loc.lat, loc.lon);
                        if (element.dist > range)
                            return [3, 6];
                        _d.label = 2;
                    case 2:
                        _d.trys.push([2, 4, , 5]);
                        _b = (_a = observations).push;
                        return [4, this.app.LoadJsonAsync(stations[index].id + "/observations/latest")];
                    case 3:
                        _b.apply(_a, [_d.sent()]);
                        return [3, 5];
                    case 4:
                        _c = _d.sent();
                        this.app.log.Debug("Failed to get observations from " + stations[index].id);
                        return [3, 5];
                    case 5:
                        index++;
                        return [3, 1];
                    case 6: return [2, observations];
                }
            });
        });
    };
    USWeather.prototype.OnObtainingGridData = function (message) {
        if (message.status_code == 404) {
            var data = JSON.parse(get(["response_body", "data"], message));
            if (data.title == "Data Unavailable For Requested Point") {
                return {
                    type: "hard",
                    userError: true,
                    detail: "location not covered",
                    service: "us-weather",
                    message: _("Location is outside US, please use a different provider.")
                };
            }
        }
        return null;
    };
    USWeather.prototype.MeshObservationData = function (observations) {
        if (observations.length < 1)
            return null;
        var result = observations[0];
        if (observations.length == 1)
            return result;
        for (var index = 1; index < observations.length; index++) {
            var element = observations[index];
            var debugText = " Observation data missing, plugged in from ID " +
                element.id + ", index " + index +
                ", distance "
                + Math.round(GetDistance(element.geometry.coordinates[1], element.geometry.coordinates[0], this.currentLoc.lat, this.currentLoc.lon))
                + " metres";
            if (result.properties.icon == null) {
                result.properties.icon = element.properties.icon;
                result.properties.textDescription = element.properties.textDescription;
                this.app.log.Debug("Weather condition" + debugText);
            }
            if (result.properties.temperature.value == null) {
                result.properties.temperature.value = element.properties.temperature.value;
                this.app.log.Debug("Temperature" + debugText);
            }
            if (result.properties.windSpeed.value == null) {
                result.properties.windSpeed.value = element.properties.windSpeed.value;
                this.app.log.Debug("Wind Speed" + debugText);
            }
            if (result.properties.windDirection.value == null) {
                result.properties.windDirection.value = element.properties.windDirection.value;
                this.app.log.Debug("Wind degree" + debugText);
            }
            if (result.properties.barometricPressure.value == null) {
                result.properties.barometricPressure.value = element.properties.barometricPressure.value;
                this.app.log.Debug("Pressure" + debugText);
            }
            if (result.properties.relativeHumidity.value == null) {
                result.properties.relativeHumidity.value = element.properties.relativeHumidity.value;
                this.app.log.Debug("Humidity" + debugText);
            }
            if (result.properties.windChill.value == null) {
                result.properties.windChill.value = element.properties.windChill.value;
                this.app.log.Debug("WindChill" + debugText);
            }
            if (result.properties.visibility.value == null) {
                result.properties.visibility.value = element.properties.visibility.value;
                this.app.log.Debug("Visibility" + debugText);
            }
        }
        return result;
    };
    USWeather.prototype.ParseCurrent = function (json, hourly) {
        if (json.length == 0) {
            this.app.log.Error("No observation stations/data are available");
            return null;
        }
        var observation = this.MeshObservationData(json);
        var timestamp = new Date(observation.properties.timestamp);
        var times = this.sunCalc.getTimes(new Date(), observation.geometry.coordinates[1], observation.geometry.coordinates[0], observation.properties.elevation.value);
        try {
            var weather = {
                coord: {
                    lat: observation.geometry.coordinates[1],
                    lon: observation.geometry.coordinates[0]
                },
                location: {
                    city: null,
                    country: null,
                    url: "https://forecast.weather.gov/MapClick.php?lat=" + this.currentLoc.lat.toString() + "&lon=" + this.currentLoc.lon.toString(),
                    timeZone: this.observationStations[0].properties.timeZone,
                    distanceFrom: this.observationStations[0].dist
                },
                date: timestamp,
                sunrise: times.sunrise,
                sunset: times.sunset,
                wind: {
                    speed: KPHtoMPS(observation.properties.windSpeed.value),
                    degree: observation.properties.windDirection.value
                },
                temperature: CelsiusToKelvin(observation.properties.temperature.value),
                pressure: observation.properties.barometricPressure.value / 100,
                humidity: observation.properties.relativeHumidity.value,
                condition: this.ResolveCondition(observation.properties.icon, IsNight(times)),
                forecasts: []
            };
            if (observation.properties.windChill.value != null) {
                weather.extra_field = {
                    name: _("Feels Like"),
                    value: CelsiusToKelvin(observation.properties.windChill.value),
                    type: "temperature"
                };
            }
            if (weather.condition == null && hourly != null) {
                weather.condition = this.ResolveCondition(hourly.properties.periods[0].icon);
            }
            return weather;
        }
        catch (e) {
            this.app.log.Error("US Weather Parsing error: " + e);
            this.app.HandleError({ type: "soft", service: "us-weather", detail: "unusual payload", message: _("Failed to Process Current Weather Info") });
            return null;
        }
    };
    ;
    USWeather.prototype.ParseForecast = function (json) {
        var forecasts = [];
        try {
            var startIndex = 0;
            if (json.properties.periods[0].isDaytime == false) {
                startIndex = 1;
                var today = json.properties.periods[0];
                var forecast = {
                    date: new Date(today.startTime),
                    temp_min: FahrenheitToKelvin(today.temperature),
                    temp_max: FahrenheitToKelvin(today.temperature),
                    condition: this.ResolveCondition(today.icon),
                };
                forecasts.push(forecast);
            }
            for (var i = startIndex; i < json.properties.periods.length; i += 2) {
                var day = json.properties.periods[i];
                var night = json.properties.periods[i + 1];
                if (!night)
                    night = day;
                var forecast = {
                    date: new Date(day.startTime),
                    temp_min: FahrenheitToKelvin(night.temperature),
                    temp_max: FahrenheitToKelvin(day.temperature),
                    condition: this.ResolveCondition(day.icon),
                };
                forecasts.push(forecast);
            }
            return forecasts;
        }
        catch (e) {
            this.app.log.Error("US Weather Forecast Parsing error: " + e);
            this.app.HandleError({ type: "soft", service: "us-weather", detail: "unusual payload", message: _("Failed to Process Forecast Info") });
            return null;
        }
    };
    ;
    USWeather.prototype.ParseHourlyForecast = function (json, self) {
        var forecasts = [];
        try {
            for (var i = 0; i < json.properties.periods.length; i++) {
                var hour = json.properties.periods[i];
                var timestamp = new Date(hour.startTime);
                var forecast = {
                    date: timestamp,
                    temp: CelsiusToKelvin(hour.temperature),
                    condition: self.ResolveCondition(hour.icon, !hour.isDaytime),
                    precipitation: null
                };
                forecasts.push(forecast);
            }
            return forecasts;
        }
        catch (e) {
            self.app.log.Error("US Weather service Forecast Parsing error: " + e);
            self.app.HandleError({ type: "soft", service: "us-weather", detail: "unusual payload", message: _("Failed to Process Hourly Forecast Info") });
            return null;
        }
    };
    USWeather.prototype.ResolveCondition = function (icon, isNight) {
        if (isNight === void 0) { isNight = false; }
        if (icon == null)
            return null;
        var code = icon.match(/(?!\/)[a-z_]+(?=(\?|,))/);
        var iconType = this.app.config.IconType();
        switch (code[0]) {
            case "skc":
                return {
                    main: _("Clear"),
                    description: _("Clear"),
                    customIcon: (isNight) ? "night-clear-symbolic" : "day-sunny-symbolic",
                    icon: weatherIconSafely(["weather-severe-alert"], iconType)
                };
            case "few":
                return {
                    main: _("Few clouds"),
                    description: _("Few clouds"),
                    customIcon: (isNight) ? "night-alt-cloudy-symbolic" : "day-cloudy-symbolic",
                    icon: weatherIconSafely(["weather-clear-night", "weather-severe-alert"], iconType)
                };
            case "sct":
                return {
                    main: _("Partly cloudy"),
                    description: _("Partly cloudy"),
                    customIcon: (isNight) ? "night-alt-cloudy-symbolic" : "day-cloudy-symbolic",
                    icon: weatherIconSafely(["weather-clear", "weather-severe-alert"], iconType)
                };
            case "bkn":
                return {
                    main: _("Mostly cloudy"),
                    description: _("Mostly cloudy"),
                    customIcon: (isNight) ? "night-alt-cloudy-symbolic" : "day-cloudy-symbolic",
                    icon: weatherIconSafely(["weather-clouds-night", "weather-overcast", "weather-severe-alert"], iconType)
                };
            case "ovc":
                return {
                    main: _("Overcast"),
                    description: _("Overcast"),
                    customIcon: "cloudy-symbolic",
                    icon: weatherIconSafely(["weather-clouds", "weather-overcast", "weather-severe-alert"], iconType)
                };
            case "wind_skc":
                return {
                    main: _("Clear"),
                    description: _("Clear and windy"),
                    customIcon: (IsNight) ? "night-alt-wind-symbolic" : "day-windy-symbolic",
                    icon: weatherIconSafely((isNight) ? ["weather-clear-night"] : ["weather-clear"], iconType)
                };
            case "wind_few":
                return {
                    main: _("Few clouds"),
                    description: _("Few clouds and windy"),
                    customIcon: (IsNight) ? "night-alt-cloudy-windy-symbolic" : "day-cloudy-windy-symbolic",
                    icon: weatherIconSafely((isNight) ? ["weather-few-clouds-night"] : ["weather-few-clouds"], iconType)
                };
            case "wind_sct":
                return {
                    main: _("Partly cloudy"),
                    description: _("Partly cloudy and windy"),
                    customIcon: (IsNight) ? "night-alt-cloudy-windy-symbolic" : "day-cloudy-windy-symbolic",
                    icon: weatherIconSafely((isNight) ? ["weather-clouds-night"] : ["weather-clouds"], iconType)
                };
            case "wind_bkn":
                return {
                    main: _("Mostly cloudy"),
                    description: _("Mostly cloudy and windy"),
                    customIcon: (IsNight) ? "night-alt-cloudy-windy-symbolic" : "day-cloudy-windy-symbolic",
                    icon: weatherIconSafely((isNight) ? ["weather-clouds-night"] : ["weather-clouds"], iconType)
                };
            case "wind_ovc":
                return {
                    main: _("Overcast"),
                    description: _("Overcast and windy"),
                    customIcon: "cloudy-symbolic",
                    icon: weatherIconSafely(["weather-overcast", "weather-many-clouds", "weather-severe-alert"], iconType)
                };
            case "snow":
                return {
                    main: _("Snow"),
                    description: _("Snow"),
                    customIcon: "snow-symbolic",
                    icon: weatherIconSafely(["weather-snow", "weather-severe-alert"], iconType)
                };
            case "rain_snow":
                return {
                    main: _("Rain"),
                    description: _("Snowy rain"),
                    customIcon: "rain-mix-symbolic",
                    icon: weatherIconSafely(["weather-snow-rain", "weather-snow", "weather-severe-alert"], iconType)
                };
            case "rain_sleet":
                return {
                    main: _("Sleet"),
                    description: _("Sleet"),
                    customIcon: "rain-mix-symbolic",
                    icon: weatherIconSafely(["weather-freezing-rain", "weather-severe-alert"], iconType)
                };
            case "snow_sleet":
                return {
                    main: _("Sleet"),
                    description: _("Sleet"),
                    customIcon: "sleet-symbolic",
                    icon: weatherIconSafely(["weather-freezing-rain", "weather-hail", "weather-severe-alert"], iconType)
                };
            case "fzra":
                return {
                    main: _("Freezing rain"),
                    description: _("Freezing rain"),
                    customIcon: "rain-wind-symbolic",
                    icon: weatherIconSafely(["weather-freezing-rain", "weather-hail", "weather-severe-alert"], iconType)
                };
            case "rain_fzra":
                return {
                    main: _("Freezing rain"),
                    description: _("Freezing rain"),
                    customIcon: "rain-wind-symbolic",
                    icon: weatherIconSafely(["weather-freezing-rain", "weather-hail", "weather-severe-alert"], iconType)
                };
            case "snow_fzra":
                return {
                    main: _("Freezing rain"),
                    description: _("Freezing rain and snow"),
                    customIcon: "rain-wind-symbolic",
                    icon: weatherIconSafely(["weather-freezing-rain", "weather-hail", "weather-severe-alert"], iconType)
                };
            case "sleet":
                return {
                    main: _("Sleet"),
                    description: _("Sleet"),
                    customIcon: "rain-mix-symbolic",
                    icon: weatherIconSafely(["weather-freezing-rain", "weather-rain", "weather-severe-alert"], iconType)
                };
            case "rain":
                return {
                    main: _("Rain"),
                    description: _("Rain"),
                    customIcon: "rain-symbolic",
                    icon: weatherIconSafely(["weather-rain", "weather-freezing-rain", "weather-showers", "weather-showers-scattered", "weather-severe-alert"], iconType)
                };
            case "rain_showers":
            case "rain_showers_hi":
                return {
                    main: _("Rain"),
                    description: _("Rain showers"),
                    customIcon: "rain-mix-symbolic",
                    icon: weatherIconSafely(["weather-showers", "weather-showers-scattered", "weather-rain", "weather-freezing-rain", "weather-severe-alert"], iconType)
                };
            case "tsra":
            case "tsra_sct":
            case "tsra_hi":
                return {
                    main: _("Thunderstorm"),
                    description: _("Thunderstorm"),
                    customIcon: "thunderstorm-symbolic",
                    icon: weatherIconSafely(["weather-storm", "weather-severe-alert"], iconType)
                };
            case "tornado":
                return {
                    main: _("Tornado"),
                    description: _("Tornado"),
                    customIcon: "tornado-symbolic",
                    icon: weatherIconSafely(["weather-severe-alert"], iconType)
                };
            case "hurricane":
                return {
                    main: _("Hurricane"),
                    description: _("Hurricane"),
                    customIcon: "hurricane-symbolic",
                    icon: weatherIconSafely(["weather-severe-alert"], iconType)
                };
            case "tropical_storm":
                return {
                    main: _("Storm"),
                    description: _("Tropical storm"),
                    customIcon: "thunderstorm-symbolic",
                    icon: weatherIconSafely(["weather-storm", "weather-severe-alert"], iconType)
                };
            case "dust":
                return {
                    main: _("Dust"),
                    description: _("Dust"),
                    customIcon: "dust-symbolic",
                    icon: weatherIconSafely(["weather-fog", "weather-severe-alert"], iconType)
                };
            case "smoke":
                return {
                    main: _("Smoke"),
                    description: _("Smoke"),
                    customIcon: "smoke-symbolic",
                    icon: weatherIconSafely(["weather-fog", "weather-severe-alert"], iconType)
                };
            case "haze":
                return {
                    main: _("Haze"),
                    description: _("Haze"),
                    customIcon: "fog-symbolic",
                    icon: weatherIconSafely(["weather-fog", "weather-severe-alert"], iconType)
                };
            case "hot":
                return {
                    main: _("Hot"),
                    description: _("Hot"),
                    customIcon: "hot-symbolic",
                    icon: weatherIconSafely(["weather-severe-alert"], iconType)
                };
            case "cold":
                return {
                    main: _("Cold"),
                    description: _("Cold"),
                    customIcon: "snowflake-cold-symbolic",
                    icon: weatherIconSafely(["weather-storm", "weather-severe-alert"], iconType)
                };
            case "blizzard":
                return {
                    main: _("Blizzard"),
                    description: _("Blizzard"),
                    customIcon: "thunderstorm-symbolic",
                    icon: weatherIconSafely(["weather-storm", "weather-severe-alert"], iconType)
                };
            case "fog":
                return {
                    main: _("Fog"),
                    description: _("Fog"),
                    customIcon: "fog-symbolic",
                    icon: weatherIconSafely(["weather-fog", "weather-severe-alert"], iconType)
                };
            default:
                return {
                    main: _("Unknown"),
                    description: _("Unknown"),
                    customIcon: "cloud-refresh-symbolic",
                    icon: weatherIconSafely(["weather-severe-alert"], iconType)
                };
        }
    };
    ;
    return USWeather;
}());
;
