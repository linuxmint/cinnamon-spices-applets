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
var UUID = "weather@mockturtl";
imports.gettext.bindtextdomain(UUID, imports.gi.GLib.get_home_dir() + "/.local/share/locale");
function _(str) {
    return imports.gettext.dgettext(UUID, str);
}
var utils = importModule("utils");
var weatherIconSafely = utils.weatherIconSafely;
var SunCalc = importModule("sunCalc").SunCalc;
var IsNight = utils.IsNight;
var CelsiusToKelvin = utils.CelsiusToKelvin;
var FahrenheitToKelvin = utils.FahrenheitToKelvin;
var KPHtoMPS = utils.MPHtoMPS;
var compassToDeg = utils.compassToDeg;
var GetDistance = utils.GetDistance;
var USWeather = (function () {
    function USWeather(_app) {
        this.prettyName = "US Weather";
        this.name = "US Weather";
        this.maxForecastSupport = 7;
        this.website = "https://www.metoffice.gov.uk/";
        this.maxHourlyForecastSupport = 156;
        this.sitesUrl = "https://api.weather.gov/points/";
        this.grid = null;
        this.MAX_STATION_DIST = 50000;
        this.stations = null;
        this.currentLoc = null;
        this.app = _app;
        this.sunCalc = new SunCalc();
    }
    USWeather.prototype.GetWeather = function () {
        return __awaiter(this, void 0, void 0, function () {
            var loc, siteData, e_1, error, data, stations, e_2, observations, index, element, _a, _b, _c, hourly, forecast, hourlyForecastPromise, forecastPromise, e_3, error, weather;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        loc = this.app.config.GetLocation(true);
                        if (loc == null)
                            return [2, null];
                        if (!(!this.grid || !this.stations || this.currentLoc.text != loc.text)) return [3, 7];
                        this.currentLoc = loc;
                        _d.label = 1;
                    case 1:
                        _d.trys.push([1, 3, , 4]);
                        return [4, this.app.LoadJsonAsync(this.sitesUrl + loc.text)];
                    case 2:
                        siteData = _d.sent();
                        this.grid = siteData;
                        this.app.log.Debug("Grid found: " + JSON.stringify(siteData, null, 2));
                        return [3, 4];
                    case 3:
                        e_1 = _d.sent();
                        error = e_1;
                        if (error.code == 404) {
                            data = JSON.parse(error.data);
                            if (data.title == "Data Unavailable For Requested Point") {
                                this.app.HandleError({
                                    type: "hard",
                                    userError: true,
                                    detail: "bad location format",
                                    service: "us-weather",
                                    message: _("Location is outside US, please use a different provider.")
                                });
                            }
                        }
                        this.app.log.Error("Failed to Obtain Grid data, error: " + JSON.stringify(e_1, null, 2));
                        return [2, null];
                    case 4:
                        _d.trys.push([4, 6, , 7]);
                        return [4, this.app.LoadJsonAsync(this.grid.properties.observationStations)];
                    case 5:
                        stations = _d.sent();
                        this.stations = stations.features;
                        return [3, 7];
                    case 6:
                        e_2 = _d.sent();
                        this.app.log.Error("Failed to obtain station data, error: " + JSON.stringify(e_2, null, 2));
                        return [2, null];
                    case 7:
                        observations = [];
                        index = 0;
                        _d.label = 8;
                    case 8:
                        if (!(index < this.stations.length)) return [3, 13];
                        element = this.stations[index];
                        element.dist = GetDistance(element.geometry.coordinates[1], element.geometry.coordinates[0], loc.lat, loc.lon);
                        if (element.dist > this.MAX_STATION_DIST)
                            return [3, 13];
                        _d.label = 9;
                    case 9:
                        _d.trys.push([9, 11, , 12]);
                        this.app.log.Debug("Observation query is: " + this.stations[index].id + "/observations/latest");
                        _b = (_a = observations).push;
                        return [4, this.app.LoadJsonAsync(this.stations[index].id + "/observations/latest")];
                    case 10:
                        _b.apply(_a, [_d.sent()]);
                        return [3, 12];
                    case 11:
                        _c = _d.sent();
                        this.app.log.Debug("Failed to get observations from " + this.stations[index].id);
                        return [3, 12];
                    case 12:
                        index++;
                        return [3, 8];
                    case 13:
                        hourly = null;
                        forecast = null;
                        _d.label = 14;
                    case 14:
                        _d.trys.push([14, 17, , 18]);
                        hourlyForecastPromise = this.app.LoadJsonAsync(this.grid.properties.forecastHourly);
                        forecastPromise = this.app.LoadJsonAsync(this.grid.properties.forecast);
                        return [4, hourlyForecastPromise];
                    case 15:
                        hourly = _d.sent();
                        return [4, forecastPromise];
                    case 16:
                        forecast = _d.sent();
                        return [3, 18];
                    case 17:
                        e_3 = _d.sent();
                        error = e_3;
                        this.app.log.Error("Failed to obtain forecast Data, error: " + JSON.stringify(e_3, null, 2));
                        return [2, null];
                    case 18:
                        weather = this.ParseCurrent(observations, hourly);
                        weather.forecasts = this.ParseForecast(forecast);
                        return [2, weather];
                }
            });
        });
    };
    ;
    USWeather.prototype.MeshObservationData = function (observations) {
        if (observations.length < 1)
            return null;
        var result = observations[0];
        if (observations.length == 1)
            return result;
        for (var index = 1; index < observations.length; index++) {
            var element = observations[index];
            if (result.properties.icon == null) {
                result.properties.icon = element.properties.icon;
                result.properties.textDescription = element.properties.textDescription;
            }
            if (result.properties.temperature.value == null)
                result.properties.temperature.value = element.properties.temperature.value;
            if (result.properties.windSpeed.value == null)
                result.properties.windSpeed.value = element.properties.windSpeed.value;
            if (result.properties.windDirection.value == null)
                result.properties.windDirection.value = element.properties.windDirection.value;
            if (result.properties.barometricPressure.value == null)
                result.properties.barometricPressure.value = element.properties.barometricPressure.value;
            if (result.properties.relativeHumidity.value == null)
                result.properties.relativeHumidity.value = element.properties.relativeHumidity.value;
            if (result.properties.windChill.value == null)
                result.properties.windChill.value = element.properties.windChill.value;
            if (result.properties.visibility.value == null)
                result.properties.visibility.value = element.properties.visibility.value;
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
                    timeZone: this.stations[0].properties.timeZone
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
            this.app.HandleError({ type: "soft", service: "us-weather", detail: "unusal payload", message: _("Failed to Process Current Weather Info") });
            return null;
        }
    };
    ;
    USWeather.prototype.ParseForecast = function (json) {
        var forecasts = [];
        try {
            for (var i = 0; i < json.properties.periods.length; i += 2) {
                var day = json.properties.periods[i];
                var night = json.properties.periods[i + 1];
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
            this.app.log.Error("MET UK Forecast Parsing error: " + e);
            this.app.HandleError({ type: "soft", service: "met-uk", detail: "unusal payload", message: _("Failed to Process Forecast Info") });
            return null;
        }
    };
    ;
    USWeather.prototype.ParseHourlyForecast = function (json, self) {
        var forecasts = [];
        try {
            for (var i = 0; i < json.SiteRep.DV.Location.Period.length; i++) {
            }
            return forecasts;
        }
        catch (e) {
            self.app.log.Error("MET UK Forecast Parsing error: " + e);
            self.app.HandleError({ type: "soft", service: "met-uk", detail: "unusal payload", message: _("Failed to Process Forecast Info") });
            return null;
        }
    };
    USWeather.prototype.ResolveCondition = function (icon, isNight) {
        if (isNight === void 0) { isNight = false; }
        if (icon == null)
            return null;
        var code = icon.match(/(?!\/)[a-z_]+(?=\?)/);
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
                    main: _("Few Clouds"),
                    description: _("Few clouds"),
                    customIcon: (isNight) ? "night-alt-cloudy-symbolic" : "day-cloudy-symbolic",
                    icon: weatherIconSafely(["weather-clear-night", "weather-severe-alert"], iconType)
                };
            case "sct":
                return {
                    main: _("Partly Cloudy"),
                    description: _("Partly cloudy"),
                    customIcon: (isNight) ? "night-alt-cloudy-symbolic" : "day-cloudy-symbolic",
                    icon: weatherIconSafely(["weather-clear", "weather-severe-alert"], iconType)
                };
            case "bkn":
                return {
                    main: _("Mostly Cloudy"),
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
                    main: _("Unknown"),
                    description: _("Unknown"),
                    customIcon: "cloud-refresh-symbolic",
                    icon: weatherIconSafely(["weather-severe-alert"], iconType)
                };
            case "wind_few":
                return {
                    main: _("Mist"),
                    description: _("Mist"),
                    customIcon: "fog-symbolic",
                    icon: weatherIconSafely(["weather-fog", "weather-severe-alert"], iconType)
                };
            case "wind_sct":
                return {
                    main: _("Fog"),
                    description: _("Fog"),
                    customIcon: "fog-symbolic",
                    icon: weatherIconSafely(["weather-fog", "weather-severe-alert"], iconType)
                };
            case "wind_bkn":
                return {
                    main: _("Cloudy"),
                    description: _("Cloudy"),
                    customIcon: "cloud-symbolic",
                    icon: weatherIconSafely(["weather-overcast", "weather-many-clouds", "weather-severe-alert"], iconType)
                };
            case "wind_ovc":
                return {
                    main: _("Overcast"),
                    description: _("Overcast"),
                    customIcon: "cloudy-symbolic",
                    icon: weatherIconSafely(["weather-overcast", "weather-many-clouds", "weather-severe-alert"], iconType)
                };
            case "snow":
                return {
                    main: _("Light Rain"),
                    description: _("Light rain shower"),
                    customIcon: "night-alt-showers-symbolic",
                    icon: weatherIconSafely(["weather-showers-scattered-night", "weather-showers-night", "weather-showers-scattered", "weather-showers", "weather-freezing-rain", "weather-severe-alert"], iconType)
                };
            case "rain_snow":
                return {
                    main: _("Light Rain"),
                    description: _("Light rain shower"),
                    customIcon: "day-showers-symbolic",
                    icon: weatherIconSafely(["weather-showers-scattered-day", "weather-showers-day", "weather-showers-scattered", "weather-showers", "weather-freezing-rain", "weather-severe-alert"], iconType)
                };
            case "rain_sleet":
                return {
                    main: _("Drizzle"),
                    description: _("Drizzle"),
                    customIcon: "showers-symbolic",
                    icon: weatherIconSafely(["weather-showers-scattered", "weather-showers", "weather-rain", "weather-freezing-rain", "weather-severe-alert"], iconType)
                };
            case "snow_sleet":
                return {
                    main: _("Light Rain"),
                    description: _("Light rain"),
                    customIcon: "showers-symbolic",
                    icon: weatherIconSafely(["weather-showers-scattered", "weather-showers", "weather-rain", "weather-freezing-rain", "weather-severe-alert"], iconType)
                };
            case "fzra":
                return {
                    main: _("Heavy Rain"),
                    description: _("Heavy rain shower"),
                    customIcon: "night-alt-rain-symbolic",
                    icon: weatherIconSafely(["weather-showers-night", "weather-showers", "weather-showers-scattered", "weather-severe-alert"], iconType)
                };
            case "rain_fzra":
                return {
                    main: _("Heavy Rain"),
                    description: _("Heavy rain shower"),
                    customIcon: "day-rain-symbolic",
                    icon: weatherIconSafely(["weather-showers-day", "weather-showers", "weather-showers-scattered", "weather-severe-alert"], iconType)
                };
            case "snow_fzra":
                return {
                    main: _("Heavy Rain"),
                    description: _("Heavy Rain"),
                    customIcon: "rain-symbolic",
                    icon: weatherIconSafely(["weather-showers", "weather-showers-scattered", "weather-severe-alert"], iconType)
                };
            case "sleet":
                return {
                    main: _("Sleet"),
                    description: _("Sleet shower"),
                    customIcon: "night-alt-rain-mix-symbolic",
                    icon: weatherIconSafely(["weather-showers-night", "weather-showers", "weather-showers-scattered", "weather-severe-alert"], iconType)
                };
            case "rain":
                return {
                    main: _("Sleet"),
                    description: _("Sleet shower"),
                    customIcon: "day-rain-mix-symbolic",
                    icon: weatherIconSafely(["weather-showers-day", "weather-showers", "weather-showers-scattered", "weather-severe-alert"], iconType)
                };
            case "rain_showers":
                return {
                    main: _("Sleet"),
                    description: _("Sleet"),
                    customIcon: "rain-mix-symbolic",
                    icon: weatherIconSafely(["weather-showers", "weather-showers-scattered", "weather-severe-alert"], iconType)
                };
            case "rain_showers_hi":
                return {
                    main: _("Hail"),
                    description: _("Hail shower"),
                    customIcon: "night-alt-hail-symbolic",
                    icon: weatherIconSafely(["weather-showers-night", "weather-showers", "weather-showers-scattered", "weather-severe-alert"], iconType)
                };
            case "tsra":
                return {
                    main: _("Hail"),
                    description: _("Hail shower"),
                    customIcon: "day-hail-symbolic",
                    icon: weatherIconSafely(["weather-showers-day", "weather-showers", "weather-showers-scattered", "weather-severe-alert"], iconType)
                };
            case "tsra_sct":
                return {
                    main: _("Hail"),
                    description: _("Hail"),
                    customIcon: "hail-symbolic",
                    icon: weatherIconSafely(["weather-showers", "weather-showers-scattered", "weather-severe-alert"], iconType)
                };
            case "tsra_hi":
                return {
                    main: _("Light Snow"),
                    description: _("Light snow shower"),
                    customIcon: "night-alt-snow-symbolic",
                    icon: weatherIconSafely(["weather-snow-scattered", "weather-snow", "weather-severe-alert"], iconType)
                };
            case "tornado":
                return {
                    main: _("Light Snow"),
                    description: _("Light snow shower"),
                    customIcon: "day-snow-symbolic",
                    icon: weatherIconSafely(["weather-snow-scattered", "weather-snow", "weather-severe-alert"], iconType)
                };
            case "hurricane":
                return {
                    main: _("Light Snow"),
                    description: _("Light snow"),
                    customIcon: "snow-symbolic",
                    icon: weatherIconSafely(["weather-snow-scattered", "weather-snow", "weather-severe-alert"], iconType)
                };
            case "tropical_storm":
                return {
                    main: _("Heavy Snow"),
                    description: _("Heavy snow shower"),
                    customIcon: "night-alt-snow-symbolic",
                    icon: weatherIconSafely(["weather-snow", "weather-snow-scattered", "weather-severe-alert"], iconType)
                };
            case "dust":
                return {
                    main: _("Heavy Snow"),
                    description: _("Heavy snow shower"),
                    customIcon: "day-snow-symbolic",
                    icon: weatherIconSafely(["weather-snow", "weather-snow-scattered", "weather-severe-alert"], iconType)
                };
            case "smoke":
                return {
                    main: _("Heavy Snow"),
                    description: _("Heavy snow"),
                    customIcon: "snow-symbolic",
                    icon: weatherIconSafely(["weather-snow", "weather-snow-scattered", "weather-severe-alert"], iconType)
                };
            case "haze":
                return {
                    main: _("Thunder"),
                    description: _("Thunder shower"),
                    customIcon: "day-storm-showers-symbolic",
                    icon: weatherIconSafely(["weather-storm", "weather-severe-alert"], iconType)
                };
            case "hot":
                return {
                    main: _("Thunder"),
                    description: _("Thunder shower"),
                    customIcon: "night-alt-storm-showers-symbolic",
                    icon: weatherIconSafely(["weather-storm", "weather-severe-alert"], iconType)
                };
            case "cold":
                return {
                    main: _("Thunder"),
                    description: _("UnThunderknown"),
                    customIcon: "thunderstorm-symbolic",
                    icon: weatherIconSafely(["weather-storm", "weather-severe-alert"], iconType)
                };
            case "blizzard":
                return {
                    main: _("Thunder"),
                    description: _("UnThunderknown"),
                    customIcon: "thunderstorm-symbolic",
                    icon: weatherIconSafely(["weather-storm", "weather-severe-alert"], iconType)
                };
            case "fog":
                return {
                    main: _("Thunder"),
                    description: _("UnThunderknown"),
                    customIcon: "thunderstorm-symbolic",
                    icon: weatherIconSafely(["weather-storm", "weather-severe-alert"], iconType)
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
