"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetUk = void 0;
const logger_1 = require("./logger");
const sunCalc_1 = require("./sunCalc");
const utils_1 = require("./utils");
class MetUk {
    constructor(_app) {
        this.prettyName = "Met Office UK";
        this.name = "Met Office UK";
        this.maxForecastSupport = 5;
        this.website = "https://www.metoffice.gov.uk/";
        this.maxHourlyForecastSupport = 36;
        this.needsApiKey = false;
        this.baseUrl = "http://datapoint.metoffice.gov.uk/public/data/val/";
        this.forecastPrefix = "wxfcs/all/json/";
        this.threeHourlyUrl = "?res=3hourly";
        this.dailyUrl = "?res=daily";
        this.currentPrefix = "wxobs/all/json/";
        this.sitesUrl = "sitelist";
        this.key = "key=05de1ee8-de70-46aa-9b41-299d4cc60219";
        this.forecastSite = null;
        this.observationSites = null;
        this.currentLoc = null;
        this.currentLocID = null;
        this.MAX_STATION_DIST = 50000;
        this.app = _app;
        this.sunCalc = new sunCalc_1.SunCalc();
    }
    async GetWeather(newLoc) {
        if (newLoc == null)
            return null;
        let loc = newLoc.lat.toString() + "," + newLoc.lon.toString();
        if (this.currentLocID == null || this.currentLocID != loc || this.forecastSite == null || this.observationSites == null || this.observationSites.length == 0) {
            logger_1.Log.Instance.Print("Downloading new site data");
            this.currentLoc = newLoc;
            this.currentLocID = loc;
            let forecastSite = await this.GetClosestForecastSite(newLoc);
            if (forecastSite == null)
                return null;
            let observationSites = await this.GetObservationSitesInRange(newLoc, this.MAX_STATION_DIST);
            if (observationSites == null)
                return null;
            this.forecastSite = forecastSite;
            this.observationSites = observationSites;
        }
        else {
            logger_1.Log.Instance.Debug("Site data downloading skipped");
        }
        if (this.observationSites.length == 0 || this.forecastSite.dist > 100000) {
            logger_1.Log.Instance.Error("User is probably not in UK, aborting");
            this.app.ShowError({
                type: "hard",
                userError: true,
                detail: "location not covered",
                message: "MET Office UK only covers the UK, please make sure your location is in the country",
                service: "met-uk"
            });
            return null;
        }
        let forecastPromise = this.GetData(this.baseUrl + this.forecastPrefix + this.forecastSite.id + this.dailyUrl + "&" + this.key, this.ParseForecast);
        let hourlyPayload = this.GetData(this.baseUrl + this.forecastPrefix + this.forecastSite.id + this.threeHourlyUrl + "&" + this.key, this.ParseHourlyForecast);
        let observations = await this.GetObservationData(this.observationSites);
        let currentResult = this.ParseCurrent(observations);
        if (!currentResult)
            return null;
        let forecastResult = await forecastPromise;
        currentResult.forecasts = (!forecastResult) ? [] : forecastResult;
        let threeHourlyForecast = await hourlyPayload;
        currentResult.hourlyForecasts = (!threeHourlyForecast) ? [] : threeHourlyForecast;
        return currentResult;
    }
    ;
    async GetClosestForecastSite(loc) {
        let forecastSitelist = await this.app.LoadJsonAsync(this.baseUrl + this.forecastPrefix + this.sitesUrl + "?" + this.key);
        if (forecastSitelist == null)
            return null;
        return this.GetClosestSite(forecastSitelist, loc);
    }
    async GetObservationSitesInRange(loc, range) {
        let observationSiteList = await this.app.LoadJsonAsync(this.baseUrl + this.currentPrefix + this.sitesUrl + "?" + this.key);
        if (observationSiteList == null)
            return null;
        let observationSites = [];
        for (let index = 0; index < observationSiteList.Locations.Location.length; index++) {
            const element = observationSiteList.Locations.Location[index];
            element.dist = utils_1.GetDistance(parseFloat(element.latitude), parseFloat(element.longitude), loc.lat, loc.lon);
            if (element.dist > range)
                continue;
            observationSites.push(element);
        }
        observationSites = this.SortObservationSites(observationSites);
        logger_1.Log.Instance.Debug("Observation sites found: " + JSON.stringify(observationSites, null, 2));
        return observationSites;
    }
    async GetObservationData(observationSites) {
        let observations = [];
        for (let index = 0; index < observationSites.length; index++) {
            const element = observationSites[index];
            logger_1.Log.Instance.Debug("Getting observation data from station: " + element.id);
            let payload = await this.app.LoadJsonAsync(this.baseUrl + this.currentPrefix + element.id + "?res=hourly&" + this.key);
            if (!!payload)
                observations.push(payload);
            else {
                logger_1.Log.Instance.Debug("Failed to get observations from " + element.id);
            }
        }
        return observations;
    }
    async GetData(query, ParseFunction) {
        if (query == null)
            return null;
        logger_1.Log.Instance.Debug("Query: " + query);
        let json = await this.app.LoadJsonAsync(query);
        if (json == null)
            return null;
        return ParseFunction(json, this);
    }
    ;
    ParseCurrent(json) {
        let observation = this.MeshObservations(json);
        if (!observation) {
            return null;
        }
        let times = this.sunCalc.getTimes(new Date(), parseFloat(json[0].SiteRep.DV.Location.lat), parseFloat(json[0].SiteRep.DV.Location.lon), parseFloat(json[0].SiteRep.DV.Location.elevation));
        try {
            let weather = {
                coord: {
                    lat: parseFloat(json[0].SiteRep.DV.Location.lat),
                    lon: parseFloat(json[0].SiteRep.DV.Location.lon)
                },
                location: {
                    city: null,
                    country: null,
                    url: null,
                    timeZone: null,
                    distanceFrom: this.observationSites[0].dist
                },
                date: new Date(json[0].SiteRep.DV.dataDate),
                sunrise: times.sunrise,
                sunset: times.sunset,
                wind: {
                    speed: null,
                    degree: null
                },
                temperature: null,
                pressure: null,
                humidity: null,
                condition: this.ResolveCondition(observation === null || observation === void 0 ? void 0 : observation.W),
                forecasts: []
            };
            if ((observation === null || observation === void 0 ? void 0 : observation.V) != null) {
                weather.extra_field = {
                    name: utils_1._("Visibility"),
                    value: this.VisibilityToText(observation.V),
                    type: "string"
                };
            }
            if ((observation === null || observation === void 0 ? void 0 : observation.S) != null) {
                weather.wind.speed = utils_1.MPHtoMPS(parseFloat(observation.S));
            }
            if ((observation === null || observation === void 0 ? void 0 : observation.D) != null) {
                weather.wind.degree = utils_1.CompassToDeg(observation.D);
            }
            if ((observation === null || observation === void 0 ? void 0 : observation.T) != null) {
                weather.temperature = utils_1.CelsiusToKelvin(parseFloat(observation.T));
            }
            if ((observation === null || observation === void 0 ? void 0 : observation.P) != null) {
                weather.pressure = parseFloat(observation.P);
            }
            if ((observation === null || observation === void 0 ? void 0 : observation.H) != null) {
                weather.humidity = parseFloat(observation.H);
            }
            return weather;
        }
        catch (e) {
            logger_1.Log.Instance.Error("Met UK Weather Parsing error: " + e);
            this.app.ShowError({ type: "soft", service: "met-uk", detail: "unusual payload", message: utils_1._("Failed to Process Current Weather Info") });
            return null;
        }
    }
    ;
    ParseForecast(json, self) {
        let forecasts = [];
        try {
            for (let i = 0; i < json.SiteRep.DV.Location.Period.length; i++) {
                let element = json.SiteRep.DV.Location.Period[i];
                let day = element.Rep[0];
                let night = element.Rep[1];
                let forecast = {
                    date: new Date(self.PartialToISOString(element.value)),
                    temp_min: utils_1.CelsiusToKelvin(parseFloat(night.Nm)),
                    temp_max: utils_1.CelsiusToKelvin(parseFloat(day.Dm)),
                    condition: self.ResolveCondition(day.W),
                };
                forecasts.push(forecast);
            }
            return forecasts;
        }
        catch (e) {
            logger_1.Log.Instance.Error("MET UK Forecast Parsing error: " + e);
            self.app.ShowError({ type: "soft", service: "met-uk", detail: "unusual payload", message: utils_1._("Failed to Process Forecast Info") });
            return null;
        }
    }
    ;
    ParseHourlyForecast(json, self) {
        let forecasts = [];
        try {
            for (let i = 0; i < json.SiteRep.DV.Location.Period.length; i++) {
                let day = json.SiteRep.DV.Location.Period[i];
                let date = new Date(self.PartialToISOString(day.value));
                for (let index = 0; index < day.Rep.length; index++) {
                    const hour = day.Rep[index];
                    let timestamp = new Date(date.getTime());
                    timestamp.setHours(timestamp.getHours() + (parseInt(hour.$) / 60));
                    let threshold = new Date();
                    threshold.setHours(threshold.getHours() - 3);
                    if (timestamp < threshold)
                        continue;
                    let forecast = {
                        date: timestamp,
                        temp: utils_1.CelsiusToKelvin(parseFloat(hour.T)),
                        condition: self.ResolveCondition(hour.W),
                        precipitation: {
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
            logger_1.Log.Instance.Error("MET UK Forecast Parsing error: " + e);
            self.app.ShowError({ type: "soft", service: "met-uk", detail: "unusual payload", message: utils_1._("Failed to Process Forecast Info") });
            return null;
        }
    }
    VisibilityToText(dist) {
        let distance = parseInt(dist);
        let unit = this.app.config.DistanceUnit;
        let stringFormat = {
            distanceUnit: this.DistanceUnitFor(unit)
        };
        if (distance < 1000) {
            stringFormat.distance = utils_1.MetreToUserUnits(1000, unit).toString();
            return `${utils_1._("Very poor")} - ${utils_1._("Less than {distance} {distanceUnit}", stringFormat)}`;
        }
        else if (distance >= 40000) {
            stringFormat.distance = utils_1.MetreToUserUnits(40000, unit).toString();
            return `${utils_1._("Excellent")} - ${utils_1._("More than {distance} {distanceUnit}", stringFormat)}`;
        }
        else if (distance < 4000) {
            stringFormat.smallerDistance = utils_1.MetreToUserUnits(1000, unit).toString();
            stringFormat.biggerDistance = utils_1.MetreToUserUnits(4000, unit).toString();
            return `${utils_1._("Poor")} - ${utils_1._("Between {smallerDistance}-{biggerDistance} {distanceUnit}", stringFormat)}`;
        }
        else if (distance < 10000) {
            stringFormat.smallerDistance = utils_1.MetreToUserUnits(4000, unit).toString();
            stringFormat.biggerDistance = utils_1.MetreToUserUnits(10000, unit).toString();
            return `${utils_1._("Moderate")} - ${utils_1._("Between {smallerDistance}-{biggerDistance} {distanceUnit}", stringFormat)}`;
        }
        else if (distance < 20000) {
            stringFormat.smallerDistance = utils_1.MetreToUserUnits(10000, unit).toString();
            stringFormat.biggerDistance = utils_1.MetreToUserUnits(20000, unit).toString();
            return `${utils_1._("Good")} - ${utils_1._("Between {smallerDistance}-{biggerDistance} {distanceUnit}", stringFormat)}`;
        }
        else if (distance < 40000) {
            stringFormat.smallerDistance = utils_1.MetreToUserUnits(20000, unit).toString();
            stringFormat.biggerDistance = utils_1.MetreToUserUnits(40000, unit).toString();
            return `${utils_1._("Very good")} ${utils_1._("Between {smallerDistance}-{biggerDistance} {distanceUnit}", stringFormat)}`;
        }
    }
    DistanceUnitFor(unit) {
        if (unit == "imperial")
            return utils_1._("mi");
        return utils_1._("km");
    }
    SortObservationSites(observations) {
        if (observations == null)
            return null;
        observations = observations.sort((a, b) => {
            if (a.dist < b.dist)
                return -1;
            if (a.dist == b.dist)
                return 0;
            return 1;
        });
        return observations;
    }
    MeshObservations(observations) {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        if (!observations)
            return null;
        if (observations.length == 0)
            return null;
        let result = this.GetLatestObservation((_d = (_c = (_b = (_a = observations[0]) === null || _a === void 0 ? void 0 : _a.SiteRep) === null || _b === void 0 ? void 0 : _b.DV) === null || _c === void 0 ? void 0 : _c.Location) === null || _d === void 0 ? void 0 : _d.Period, new Date());
        if (observations.length == 1)
            return result;
        for (let index = 0; index < observations.length; index++) {
            if (((_h = (_g = (_f = (_e = observations[index]) === null || _e === void 0 ? void 0 : _e.SiteRep) === null || _f === void 0 ? void 0 : _f.DV) === null || _g === void 0 ? void 0 : _g.Location) === null || _h === void 0 ? void 0 : _h.Period) == null)
                continue;
            let nextObservation = this.GetLatestObservation(observations[index].SiteRep.DV.Location.Period, new Date());
            if (result == null)
                result = nextObservation;
            let debugText = " Observation data missing, plugged in from ID " +
                observations[index].SiteRep.DV.Location.i + ", index " + index +
                ", distance "
                + Math.round(utils_1.GetDistance(parseFloat(observations[index].SiteRep.DV.Location.lat), parseFloat(observations[index].SiteRep.DV.Location.lon), this.currentLoc.lat, this.currentLoc.lon))
                + " metres";
            if ((result === null || result === void 0 ? void 0 : result.V) == null) {
                result.V = nextObservation === null || nextObservation === void 0 ? void 0 : nextObservation.V;
                logger_1.Log.Instance.Debug("Visibility" + debugText);
            }
            if ((result === null || result === void 0 ? void 0 : result.W) == null) {
                result.W = nextObservation === null || nextObservation === void 0 ? void 0 : nextObservation.W;
                logger_1.Log.Instance.Debug("Weather condition" + debugText);
            }
            if ((result === null || result === void 0 ? void 0 : result.S) == null) {
                result.S = nextObservation === null || nextObservation === void 0 ? void 0 : nextObservation.S;
                logger_1.Log.Instance.Debug("Wind Speed" + debugText);
            }
            if ((result === null || result === void 0 ? void 0 : result.D) == null) {
                result.D = nextObservation === null || nextObservation === void 0 ? void 0 : nextObservation.D;
                logger_1.Log.Instance.Debug("Wind degree" + debugText);
            }
            if ((result === null || result === void 0 ? void 0 : result.T) == null) {
                result.T = nextObservation === null || nextObservation === void 0 ? void 0 : nextObservation.T;
                logger_1.Log.Instance.Debug("Temperature" + debugText);
            }
            if ((result === null || result === void 0 ? void 0 : result.P) == null) {
                result.P = nextObservation === null || nextObservation === void 0 ? void 0 : nextObservation.P;
                logger_1.Log.Instance.Debug("Pressure" + debugText);
            }
            if ((result === null || result === void 0 ? void 0 : result.H) == null) {
                result.H = nextObservation === null || nextObservation === void 0 ? void 0 : nextObservation.H;
                logger_1.Log.Instance.Debug("Humidity" + debugText);
            }
        }
        return result;
    }
    GetLatestObservation(observations, day) {
        if (observations == null)
            return null;
        for (let index = 0; index < observations.length; index++) {
            const element = observations[index];
            let date = new Date(this.PartialToISOString(element.value));
            if (date.toLocaleDateString() != day.toLocaleDateString())
                continue;
            return element.Rep[element.Rep.length - 1];
        }
        return null;
    }
    PartialToISOString(date) {
        return (date.replace("Z", "")) + "T00:00:00Z";
    }
    GetClosestSite(siteList, loc) {
        let sites = siteList.Locations.Location;
        let closest = sites[0];
        closest.dist = utils_1.GetDistance(parseFloat(closest.latitude), parseFloat(closest.longitude), loc.lat, loc.lon);
        for (let index = 0; index < sites.length; index++) {
            const element = sites[index];
            element.dist = utils_1.GetDistance(parseFloat(element.latitude), parseFloat(element.longitude), loc.lat, loc.lon);
            if (element.dist < closest.dist) {
                closest = element;
            }
        }
        return closest;
    }
    ResolveCondition(icon) {
        switch (icon) {
            case "NA":
                return {
                    main: utils_1._("Unknown"),
                    description: utils_1._("Unknown"),
                    customIcon: "cloud-refresh-symbolic",
                    icons: ["weather-severe-alert"]
                };
            case "0":
                return {
                    main: utils_1._("Clear"),
                    description: utils_1._("Clear"),
                    customIcon: "night-clear-symbolic",
                    icons: ["weather-clear-night", "weather-severe-alert"]
                };
            case "1":
                return {
                    main: utils_1._("Sunny"),
                    description: utils_1._("Sunny"),
                    customIcon: "day-sunny-symbolic",
                    icons: ["weather-clear", "weather-severe-alert"]
                };
            case "2":
                return {
                    main: utils_1._("Partly cloudy"),
                    description: utils_1._("Partly cloudy"),
                    customIcon: "night-alt-cloudy-symbolic",
                    icons: ["weather-clouds-night", "weather-overcast", "weather-severe-alert"]
                };
            case "3":
                return {
                    main: utils_1._("Partly cloudy"),
                    description: utils_1._("Partly cloudy"),
                    customIcon: "day-cloudy-symbolic",
                    icons: ["weather-clouds", "weather-overcast", "weather-severe-alert"]
                };
            case "4":
                return {
                    main: utils_1._("Unknown"),
                    description: utils_1._("Unknown"),
                    customIcon: "cloud-refresh-symbolic",
                    icons: ["weather-severe-alert"]
                };
            case "5":
                return {
                    main: utils_1._("Mist"),
                    description: utils_1._("Mist"),
                    customIcon: "fog-symbolic",
                    icons: ["weather-fog", "weather-severe-alert"]
                };
            case "6":
                return {
                    main: utils_1._("Fog"),
                    description: utils_1._("Fog"),
                    customIcon: "fog-symbolic",
                    icons: ["weather-fog", "weather-severe-alert"]
                };
            case "7":
                return {
                    main: utils_1._("Cloudy"),
                    description: utils_1._("Cloudy"),
                    customIcon: "cloud-symbolic",
                    icons: ["weather-overcast", "weather-many-clouds", "weather-severe-alert"]
                };
            case "8":
                return {
                    main: utils_1._("Overcast"),
                    description: utils_1._("Overcast"),
                    customIcon: "cloudy-symbolic",
                    icons: ["weather-overcast", "weather-many-clouds", "weather-severe-alert"]
                };
            case "9":
                return {
                    main: utils_1._("Light rain"),
                    description: utils_1._("Light rain shower"),
                    customIcon: "night-alt-showers-symbolic",
                    icons: ["weather-showers-scattered-night", "weather-showers-night", "weather-showers-scattered", "weather-showers", "weather-freezing-rain", "weather-severe-alert"]
                };
            case "10":
                return {
                    main: utils_1._("Light rain"),
                    description: utils_1._("Light rain shower"),
                    customIcon: "day-showers-symbolic",
                    icons: ["weather-showers-scattered-day", "weather-showers-day", "weather-showers-scattered", "weather-showers", "weather-freezing-rain", "weather-severe-alert"]
                };
            case "11":
                return {
                    main: utils_1._("Drizzle"),
                    description: utils_1._("Drizzle"),
                    customIcon: "showers-symbolic",
                    icons: ["weather-showers-scattered", "weather-showers", "weather-rain", "weather-freezing-rain", "weather-severe-alert"]
                };
            case "12":
                return {
                    main: utils_1._("Light rain"),
                    description: utils_1._("Light rain"),
                    customIcon: "showers-symbolic",
                    icons: ["weather-showers-scattered", "weather-showers", "weather-rain", "weather-freezing-rain", "weather-severe-alert"]
                };
            case "13":
                return {
                    main: utils_1._("Heavy rain"),
                    description: utils_1._("Heavy rain shower"),
                    customIcon: "night-alt-rain-symbolic",
                    icons: ["weather-showers-night", "weather-showers", "weather-showers-scattered", "weather-severe-alert"]
                };
            case "14":
                return {
                    main: utils_1._("Heavy rain"),
                    description: utils_1._("Heavy rain shower"),
                    customIcon: "day-rain-symbolic",
                    icons: ["weather-showers-day", "weather-showers", "weather-showers-scattered", "weather-severe-alert"]
                };
            case "15":
                return {
                    main: utils_1._("Heavy rain"),
                    description: utils_1._("Heavy rain"),
                    customIcon: "rain-symbolic",
                    icons: ["weather-showers", "weather-showers-scattered", "weather-severe-alert"]
                };
            case "16":
                return {
                    main: utils_1._("Sleet"),
                    description: utils_1._("Sleet shower"),
                    customIcon: "night-alt-rain-mix-symbolic",
                    icons: ["weather-showers-night", "weather-showers", "weather-showers-scattered", "weather-severe-alert"]
                };
            case "17":
                return {
                    main: utils_1._("Sleet"),
                    description: utils_1._("Sleet shower"),
                    customIcon: "day-rain-mix-symbolic",
                    icons: ["weather-showers-day", "weather-showers", "weather-showers-scattered", "weather-severe-alert"]
                };
            case "18":
                return {
                    main: utils_1._("Sleet"),
                    description: utils_1._("Sleet"),
                    customIcon: "rain-mix-symbolic",
                    icons: ["weather-showers", "weather-showers-scattered", "weather-severe-alert"]
                };
            case "19":
                return {
                    main: utils_1._("Hail"),
                    description: utils_1._("Hail shower"),
                    customIcon: "night-alt-hail-symbolic",
                    icons: ["weather-showers-night", "weather-showers", "weather-showers-scattered", "weather-severe-alert"]
                };
            case "20":
                return {
                    main: utils_1._("Hail"),
                    description: utils_1._("Hail shower"),
                    customIcon: "day-hail-symbolic",
                    icons: ["weather-showers-day", "weather-showers", "weather-showers-scattered", "weather-severe-alert"]
                };
            case "21":
                return {
                    main: utils_1._("Hail"),
                    description: utils_1._("Hail"),
                    customIcon: "hail-symbolic",
                    icons: ["weather-showers", "weather-showers-scattered", "weather-severe-alert"]
                };
            case "22":
                return {
                    main: utils_1._("Light snow"),
                    description: utils_1._("Light snow shower"),
                    customIcon: "night-alt-snow-symbolic",
                    icons: ["weather-snow-scattered", "weather-snow", "weather-severe-alert"]
                };
            case "23":
                return {
                    main: utils_1._("Light snow"),
                    description: utils_1._("Light snow shower"),
                    customIcon: "day-snow-symbolic",
                    icons: ["weather-snow-scattered", "weather-snow", "weather-severe-alert"]
                };
            case "24":
                return {
                    main: utils_1._("Light snow"),
                    description: utils_1._("Light snow"),
                    customIcon: "snow-symbolic",
                    icons: ["weather-snow-scattered", "weather-snow", "weather-severe-alert"]
                };
            case "25":
                return {
                    main: utils_1._("Heavy snow"),
                    description: utils_1._("Heavy snow shower"),
                    customIcon: "night-alt-snow-symbolic",
                    icons: ["weather-snow", "weather-snow-scattered", "weather-severe-alert"]
                };
            case "26":
                return {
                    main: utils_1._("Heavy snow"),
                    description: utils_1._("Heavy snow shower"),
                    customIcon: "day-snow-symbolic",
                    icons: ["weather-snow", "weather-snow-scattered", "weather-severe-alert"]
                };
            case "27":
                return {
                    main: utils_1._("Heavy snow"),
                    description: utils_1._("Heavy snow"),
                    customIcon: "snow-symbolic",
                    icons: ["weather-snow", "weather-snow-scattered", "weather-severe-alert"]
                };
            case "28":
                return {
                    main: utils_1._("Thunder"),
                    description: utils_1._("Thunder shower"),
                    customIcon: "day-storm-showers-symbolic",
                    icons: ["weather-storm", "weather-severe-alert"]
                };
            case "29":
                return {
                    main: utils_1._("Thunder"),
                    description: utils_1._("Thunder shower"),
                    customIcon: "night-alt-storm-showers-symbolic",
                    icons: ["weather-storm", "weather-severe-alert"]
                };
            case "30":
                return {
                    main: utils_1._("Thunder"),
                    description: utils_1._("Thunder"),
                    customIcon: "thunderstorm-symbolic",
                    icons: ["weather-storm", "weather-severe-alert"]
                };
            default:
                return {
                    main: utils_1._("Unknown"),
                    description: utils_1._("Unknown"),
                    customIcon: "cloud-refresh-symbolic",
                    icons: ["weather-severe-alert"]
                };
        }
    }
    ;
}
exports.MetUk = MetUk;
;
