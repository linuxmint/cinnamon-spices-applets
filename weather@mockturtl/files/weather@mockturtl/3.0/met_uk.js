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
var isCoordinate = utils.isCoordinate;
var weatherIconSafely = utils.weatherIconSafely;
var SunCalc = importModule("sunCalc").SunCalc;
var IsNight = utils.IsNight;
var CelsiusToKelvin = utils.CelsiusToKelvin;
var MPHtoMPS = utils.MPHtoMPS;
var compassToDeg = utils.compassToDeg;
var GetDistance = utils.GetDistance;
var get = utils.get;
var MetUk = (function () {
    function MetUk(_app) {
        this.prettyName = "Met Office UK";
        this.name = "Met Office UK";
        this.maxForecastSupport = 5;
        this.website = "https://www.metoffice.gov.uk/";
        this.maxHourlyForecastSupport = 36;
        this.baseUrl = "http://datapoint.metoffice.gov.uk/public/data/val/";
        this.forecastPrefix = "wxfcs/all/json/";
        this.threeHourlyUrl = "?res=3hourly";
        this.dailyUrl = "?res=daily";
        this.currentPrefix = "wxobs/all/json/";
        this.sitesUrl = "sitelist";
        this.key = "key=05de1ee8-de70-46aa-9b41-299d4cc60219";
        this.hourlyAccess = true;
        this.forecastSite = null;
        this.observationSite = null;
        this.app = _app;
        this.sunCalc = new SunCalc();
    }
    MetUk.prototype.GetWeather = function () {
        return __awaiter(this, void 0, void 0, function () {
            var forecastSitelist, currentSitelist, forecastPromise, hourlyPayload, e_1, currentResult, json, e_2, forecastResult;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!isCoordinate(this.app.config._location)) {
                            this.app.HandleError({
                                detail: "bad location format",
                                type: "hard",
                                userError: true,
                                service: "met-uk",
                                message: "Please make sure location is in the correct format"
                            });
                            this.app.log.Error("MET UK - Location is not coordinate, aborting");
                            return [2, null];
                        }
                        return [4, this.app.LoadJsonAsync(this.baseUrl + this.forecastPrefix + this.sitesUrl + "?" + this.key)];
                    case 1:
                        forecastSitelist = _a.sent();
                        return [4, this.app.LoadJsonAsync(this.baseUrl + this.currentPrefix + this.sitesUrl + "?" + this.key)];
                    case 2:
                        currentSitelist = _a.sent();
                        this.forecastSite = this.GetClosestSite(forecastSitelist, this.app.config._location);
                        this.observationSite = this.GetClosestSite(currentSitelist, this.app.config._location);
                        this.app.log.Debug("Forecast site found: " + JSON.stringify(this.forecastSite, null, 2));
                        this.app.log.Debug("Observation site found: " + JSON.stringify(this.observationSite, null, 2));
                        if (this.forecastSite.dist > 100000 || this.observationSite.dist > 100000) {
                            this.app.log.Error("User is probably not in UK, aborting");
                            this.app.HandleError({
                                type: "hard",
                                userError: true,
                                detail: "location not found",
                                message: "MET Office UK only covers the UK, please make sure your location is in the country",
                                service: "met-uk"
                            });
                            return [2, null];
                        }
                        forecastPromise = this.GetData(this.baseUrl + this.forecastPrefix + this.forecastSite.id + this.dailyUrl + "&" + this.key, this.ParseForecast);
                        hourlyPayload = null;
                        _a.label = 3;
                    case 3:
                        _a.trys.push([3, 5, , 6]);
                        return [4, this.app.LoadJsonAsync(this.baseUrl + this.forecastPrefix + this.forecastSite.id + this.threeHourlyUrl + "&" + this.key)];
                    case 4:
                        hourlyPayload = _a.sent();
                        return [3, 6];
                    case 5:
                        e_1 = _a.sent();
                        this.app.log.Error("Failed to obtaion three-hourly weather, error: " + JSON.stringify(e_1, null, 2));
                        return [2, null];
                    case 6:
                        currentResult = null;
                        _a.label = 7;
                    case 7:
                        _a.trys.push([7, 9, , 10]);
                        return [4, this.app.LoadJsonAsync(this.baseUrl + this.currentPrefix + this.observationSite.id + "?res=hourly&" + this.key)];
                    case 8:
                        json = _a.sent();
                        currentResult = this.ParseCurrent(json, hourlyPayload, this);
                        return [3, 10];
                    case 9:
                        e_2 = _a.sent();
                        this.app.log.Error("Failed to obtaion current weather, error: " + JSON.stringify(e_2, null, 2));
                        return [2, null];
                    case 10:
                        if (!currentResult)
                            return [2, null];
                        return [4, forecastPromise];
                    case 11:
                        forecastResult = _a.sent();
                        currentResult.forecasts = (!forecastResult) ? [] : forecastResult;
                        currentResult.hourlyForecasts = (!hourlyPayload) ? [] : this.ParseHourlyForecast(hourlyPayload, this);
                        return [2, currentResult];
                }
            });
        });
    };
    ;
    MetUk.prototype.GetData = function (query, ParseFunction) {
        return __awaiter(this, void 0, void 0, function () {
            var json, e_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
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
                        e_3 = _a.sent();
                        this.app.HandleHTTPError("met-uk", e_3, this.app, null);
                        return [2, null];
                    case 4:
                        if (json == null) {
                            this.app.HandleError({ type: "soft", detail: "no api response", service: "met-uk" });
                            return [2, null];
                        }
                        return [2, ParseFunction(json, this)];
                    case 5: return [2, null];
                }
            });
        });
    };
    ;
    MetUk.prototype.ParseCurrent = function (json, threeHourly, self) {
        var timestamp = new Date(json.SiteRep.DV.dataDate);
        var observation = self.GetLatestObservation(json.SiteRep.DV.Location.Period, timestamp);
        if (!observation) {
            return null;
        }
        var times = self.sunCalc.getTimes(new Date(), parseFloat(json.SiteRep.DV.Location.lat), parseFloat(json.SiteRep.DV.Location.lon), parseFloat(json.SiteRep.DV.Location.elevation));
        try {
            var weather = {
                coord: {
                    lat: parseFloat(json.SiteRep.DV.Location.lat),
                    lon: parseFloat(json.SiteRep.DV.Location.lon)
                },
                location: {
                    city: null,
                    country: null,
                    url: null,
                    timeZone: null
                },
                date: timestamp,
                sunrise: times.sunrise,
                sunset: times.sunset,
                wind: {
                    speed: null,
                    degree: null
                },
                temperature: null,
                pressure: null,
                humidity: null,
                condition: null,
                forecasts: []
            };
            if (get(["V"], observation) != null) {
                weather.extra_field = {
                    name: _("Visibility"),
                    value: self.VisibilityToText(observation.V),
                    type: "string"
                };
            }
            if (get(["S"], observation) != null) {
                weather.wind.speed = MPHtoMPS(parseFloat(observation.S));
            }
            if (get(["D"], observation) != null) {
                weather.wind.degree = compassToDeg(observation.D);
            }
            if (get(["T"], observation) != null) {
                weather.temperature = CelsiusToKelvin(parseFloat(observation.T));
            }
            if (get(["P"], observation) != null) {
                weather.pressure = parseFloat(observation.P);
            }
            if (get(["H"], observation) != null) {
                weather.humidity = parseFloat(observation.H);
            }
            if (get(["W"], observation) != null) {
                weather.condition = self.ResolveCondition(observation.W);
            }
            if (threeHourly == null)
                return weather;
            var relevantForecast = this.GetFirstForecast(threeHourly);
            if (weather.condition == null) {
                weather.condition = self.ResolveCondition(relevantForecast.W);
            }
            if (weather.wind.speed == null && get(["S"], relevantForecast) != null) {
                weather.wind.speed = MPHtoMPS(parseFloat(relevantForecast.S));
            }
            if (weather.wind.degree == null && get(["D"], relevantForecast) != null) {
                weather.wind.degree = compassToDeg(relevantForecast.D);
            }
            if (!weather.extra_field && get(["V"], relevantForecast) != null) {
                weather.extra_field = {
                    name: _("Visibility"),
                    value: self.VisibilityToText(relevantForecast.V),
                    type: "string"
                };
            }
            if (weather.humidity == null && get(["H"], relevantForecast) != null) {
                weather.humidity = parseFloat(relevantForecast.H);
            }
            if (weather.temperature == null && get(["T"], relevantForecast) != null) {
                weather.temperature = CelsiusToKelvin(parseFloat(relevantForecast.T));
            }
            return weather;
        }
        catch (e) {
            self.app.log.Error("Met UK Weather Parsing error: " + e);
            self.app.HandleError({ type: "soft", service: "met-uk", detail: "unusal payload", message: _("Failed to Process Current Weather Info") });
            return null;
        }
    };
    ;
    MetUk.prototype.GetFirstForecast = function (threeHourlyPayload) {
        for (var i = 0; i < threeHourlyPayload.SiteRep.DV.Location.Period.length; i++) {
            var day = threeHourlyPayload.SiteRep.DV.Location.Period[i];
            var date = new Date(this.PartialToISOString(day.value));
            for (var index = 0; index < day.Rep.length; index++) {
                var hour = day.Rep[index];
                var timestamp = new Date(date.getTime());
                timestamp.setHours(timestamp.getHours() + (parseInt(hour.$) / 60));
                var threshold = new Date();
                threshold.setHours(threshold.getHours() - 3);
                if (timestamp < threshold)
                    continue;
                return hour;
            }
        }
    };
    MetUk.prototype.ParseForecast = function (json, self) {
        var forecasts = [];
        try {
            for (var i = 0; i < json.SiteRep.DV.Location.Period.length; i++) {
                var element = json.SiteRep.DV.Location.Period[i];
                var day = element.Rep[0];
                var night = element.Rep[1];
                var forecast = {
                    date: new Date(self.PartialToISOString(element.value)),
                    temp_min: CelsiusToKelvin(parseFloat(night.Nm)),
                    temp_max: CelsiusToKelvin(parseFloat(day.Dm)),
                    condition: self.ResolveCondition(day.W),
                };
                forecasts.push(forecast);
            }
            return forecasts;
        }
        catch (e) {
            self.app.log.Error("MET UK Forecast Parsing error: " + e);
            self.app.HandleError({ type: "soft", service: "met-uk", detail: "unusal payload", message: _("Failed to Process Forecast Info") });
            return null;
        }
    };
    ;
    MetUk.prototype.ParseHourlyForecast = function (json, self) {
        var forecasts = [];
        try {
            for (var i = 0; i < json.SiteRep.DV.Location.Period.length; i++) {
                var day = json.SiteRep.DV.Location.Period[i];
                var date = new Date(self.PartialToISOString(day.value));
                for (var index = 0; index < day.Rep.length; index++) {
                    var hour = day.Rep[index];
                    var timestamp = new Date(date.getTime());
                    timestamp.setHours(timestamp.getHours() + (parseInt(hour.$) / 60));
                    var threshold = new Date();
                    threshold.setHours(threshold.getHours() - 3);
                    if (timestamp < threshold)
                        continue;
                    var forecast = {
                        date: timestamp,
                        temp: CelsiusToKelvin(parseFloat(hour.T)),
                        condition: self.ResolveCondition(hour.W),
                        precipation: {
                            type: "rain",
                            volume: null,
                            chance: parseFloat(hour.Pp)
                        }
                    };
                    forecasts.push(forecast);
                }
            }
            return forecasts;
        }
        catch (e) {
            self.app.log.Error("MET UK Forecast Parsing error: " + e);
            self.app.HandleError({ type: "soft", service: "met-uk", detail: "unusal payload", message: _("Failed to Process Forecast Info") });
            return null;
        }
    };
    MetUk.prototype.VisibilityToText = function (dist) {
        var distance = parseInt(dist);
        if (distance < 1000)
            return _("Very poor - Less than 1 km");
        if (distance < 4000)
            return _("Poor - Between 1-4 km");
        if (distance < 10000)
            return _("Moderate - Between 4-10 km");
        if (distance < 20000)
            return _("Good - Between 10-20 km");
        if (distance < 40000)
            return _("Very good - Between 20-40 km");
        return _("Excellent - More than 40 km");
    };
    MetUk.prototype.GetLatestObservation = function (observations, day) {
        for (var index = 0; index < observations.length; index++) {
            var element = observations[index];
            var date = new Date(this.PartialToISOString(element.value));
            if (date.toLocaleDateString() != day.toLocaleDateString())
                continue;
            return element.Rep[element.Rep.length - 1];
        }
        return null;
    };
    MetUk.prototype.PartialToISOString = function (date) {
        return (date.replace("Z", "")) + "T00:00:00Z";
    };
    MetUk.prototype.GetClosestSite = function (siteList, loc) {
        var sites = siteList.Locations.Location;
        var latlong = loc.split(",");
        var closest = sites[0];
        closest.dist = GetDistance(parseFloat(closest.latitude), parseFloat(closest.longitude), parseFloat(latlong[0]), parseFloat(latlong[1]));
        for (var index = 0; index < sites.length; index++) {
            var element = sites[index];
            element.dist = GetDistance(parseFloat(element.latitude), parseFloat(element.longitude), parseFloat(latlong[0]), parseFloat(latlong[1]));
            if (element.dist < closest.dist) {
                closest = element;
            }
        }
        return closest;
    };
    MetUk.prototype.ResolveCondition = function (icon) {
        var iconType = this.app.config.IconType();
        switch (icon) {
            case "NA":
                return {
                    main: _("Unknown"),
                    description: _("Unknown"),
                    customIcon: "cloud-refresh-symbolic",
                    icon: weatherIconSafely(["weather-severe-alert"], iconType)
                };
            case "0":
                return {
                    main: _("Clear"),
                    description: _("Clear"),
                    customIcon: "night-clear-symbolic",
                    icon: weatherIconSafely(["weather-clear-night", "weather-severe-alert"], iconType)
                };
            case "1":
                return {
                    main: _("Sunny"),
                    description: _("Sunny"),
                    customIcon: "day-sunny-symbolic",
                    icon: weatherIconSafely(["weather-clear", "weather-severe-alert"], iconType)
                };
            case "2":
                return {
                    main: _("Partly Cloudy"),
                    description: _("Partly Cloudy"),
                    customIcon: "night-alt-cloudy-symbolic",
                    icon: weatherIconSafely(["weather-clouds-night", "weather-overcast", "weather-severe-alert"], iconType)
                };
            case "3":
                return {
                    main: _("Partly Cloudy"),
                    description: _("Partly Cloudy"),
                    customIcon: "day-cloudy-symbolic",
                    icon: weatherIconSafely(["weather-clouds", "weather-overcast", "weather-severe-alert"], iconType)
                };
            case "4":
                return {
                    main: _("Unknown"),
                    description: _("Unknown"),
                    customIcon: "cloud-refresh-symbolic",
                    icon: weatherIconSafely(["weather-severe-alert"], iconType)
                };
            case "5":
                return {
                    main: _("Mist"),
                    description: _("Mist"),
                    customIcon: "fog-symbolic",
                    icon: weatherIconSafely(["weather-fog", "weather-severe-alert"], iconType)
                };
            case "6":
                return {
                    main: _("Fog"),
                    description: _("Fog"),
                    customIcon: "fog-symbolic",
                    icon: weatherIconSafely(["weather-fog", "weather-severe-alert"], iconType)
                };
            case "7":
                return {
                    main: _("Cloudy"),
                    description: _("Cloudy"),
                    customIcon: "cloud-symbolic",
                    icon: weatherIconSafely(["weather-overcast", "weather-many-clouds", "weather-severe-alert"], iconType)
                };
            case "8":
                return {
                    main: _("Overcast"),
                    description: _("Overcast"),
                    customIcon: "cloudy-symbolic",
                    icon: weatherIconSafely(["weather-overcast", "weather-many-clouds", "weather-severe-alert"], iconType)
                };
            case "9":
                return {
                    main: _("Light Rain"),
                    description: _("Light rain shower"),
                    customIcon: "night-alt-showers-symbolic",
                    icon: weatherIconSafely(["weather-showers-scattered-night", "weather-showers-night", "weather-showers-scattered", "weather-showers", "weather-freezing-rain", "weather-severe-alert"], iconType)
                };
            case "10":
                return {
                    main: _("Light Rain"),
                    description: _("Light rain shower"),
                    customIcon: "day-showers-symbolic",
                    icon: weatherIconSafely(["weather-showers-scattered-day", "weather-showers-day", "weather-showers-scattered", "weather-showers", "weather-freezing-rain", "weather-severe-alert"], iconType)
                };
            case "11":
                return {
                    main: _("Drizzle"),
                    description: _("Drizzle"),
                    customIcon: "showers-symbolic",
                    icon: weatherIconSafely(["weather-showers-scattered", "weather-showers", "weather-rain", "weather-freezing-rain", "weather-severe-alert"], iconType)
                };
            case "12":
                return {
                    main: _("Light Rain"),
                    description: _("Light rain"),
                    customIcon: "showers-symbolic",
                    icon: weatherIconSafely(["weather-showers-scattered", "weather-showers", "weather-rain", "weather-freezing-rain", "weather-severe-alert"], iconType)
                };
            case "13":
                return {
                    main: _("Heavy Rain"),
                    description: _("Heavy rain shower"),
                    customIcon: "night-alt-rain-symbolic",
                    icon: weatherIconSafely(["weather-showers-night", "weather-showers", "weather-showers-scattered", "weather-severe-alert"], iconType)
                };
            case "14":
                return {
                    main: _("Heavy Rain"),
                    description: _("Heavy rain shower"),
                    customIcon: "day-rain-symbolic",
                    icon: weatherIconSafely(["weather-showers-day", "weather-showers", "weather-showers-scattered", "weather-severe-alert"], iconType)
                };
            case "15":
                return {
                    main: _("Heavy Rain"),
                    description: _("Heavy Rain"),
                    customIcon: "rain-symbolic",
                    icon: weatherIconSafely(["weather-showers", "weather-showers-scattered", "weather-severe-alert"], iconType)
                };
            case "16":
                return {
                    main: _("Sleet"),
                    description: _("Sleet shower"),
                    customIcon: "night-alt-rain-mix-symbolic",
                    icon: weatherIconSafely(["weather-showers-night", "weather-showers", "weather-showers-scattered", "weather-severe-alert"], iconType)
                };
            case "17":
                return {
                    main: _("Sleet"),
                    description: _("Sleet shower"),
                    customIcon: "day-rain-mix-symbolic",
                    icon: weatherIconSafely(["weather-showers-day", "weather-showers", "weather-showers-scattered", "weather-severe-alert"], iconType)
                };
            case "18":
                return {
                    main: _("Sleet"),
                    description: _("Sleet"),
                    customIcon: "rain-mix-symbolic",
                    icon: weatherIconSafely(["weather-showers", "weather-showers-scattered", "weather-severe-alert"], iconType)
                };
            case "19":
                return {
                    main: _("Hail"),
                    description: _("Hail shower"),
                    customIcon: "night-alt-hail-symbolic",
                    icon: weatherIconSafely(["weather-showers-night", "weather-showers", "weather-showers-scattered", "weather-severe-alert"], iconType)
                };
            case "20":
                return {
                    main: _("Hail"),
                    description: _("Hail shower"),
                    customIcon: "day-hail-symbolic",
                    icon: weatherIconSafely(["weather-showers-day", "weather-showers", "weather-showers-scattered", "weather-severe-alert"], iconType)
                };
            case "21":
                return {
                    main: _("Hail"),
                    description: _("Hail"),
                    customIcon: "hail-symbolic",
                    icon: weatherIconSafely(["weather-showers", "weather-showers-scattered", "weather-severe-alert"], iconType)
                };
            case "22":
                return {
                    main: _("Light Snow"),
                    description: _("Light snow shower"),
                    customIcon: "night-alt-snow-symbolic",
                    icon: weatherIconSafely(["weather-snow-scattered", "weather-snow", "weather-severe-alert"], iconType)
                };
            case "23":
                return {
                    main: _("Light Snow"),
                    description: _("Light snow shower"),
                    customIcon: "day-snow-symbolic",
                    icon: weatherIconSafely(["weather-snow-scattered", "weather-snow", "weather-severe-alert"], iconType)
                };
            case "24":
                return {
                    main: _("Light Snow"),
                    description: _("Light snow"),
                    customIcon: "snow-symbolic",
                    icon: weatherIconSafely(["weather-snow-scattered", "weather-snow", "weather-severe-alert"], iconType)
                };
            case "25":
                return {
                    main: _("Heavy Snow"),
                    description: _("Heavy snow shower"),
                    customIcon: "night-alt-snow-symbolic",
                    icon: weatherIconSafely(["weather-snow", "weather-snow-scattered", "weather-severe-alert"], iconType)
                };
            case "26":
                return {
                    main: _("Heavy Snow"),
                    description: _("Heavy snow shower"),
                    customIcon: "day-snow-symbolic",
                    icon: weatherIconSafely(["weather-snow", "weather-snow-scattered", "weather-severe-alert"], iconType)
                };
            case "27":
                return {
                    main: _("Heavy Snow"),
                    description: _("Heavy snow"),
                    customIcon: "snow-symbolic",
                    icon: weatherIconSafely(["weather-snow", "weather-snow-scattered", "weather-severe-alert"], iconType)
                };
            case "28":
                return {
                    main: _("Thunder"),
                    description: _("Thunder shower"),
                    customIcon: "day-storm-showers-symbolic",
                    icon: weatherIconSafely(["weather-storm", "weather-severe-alert"], iconType)
                };
            case "29":
                return {
                    main: _("Thunder"),
                    description: _("Thunder shower"),
                    customIcon: "night-alt-storm-showers-symbolic",
                    icon: weatherIconSafely(["weather-storm", "weather-severe-alert"], iconType)
                };
            case "30":
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
    return MetUk;
}());
;
