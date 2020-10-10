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
const UUID = "weather@mockturtl";
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
const get = utils.get;
var MetreToUserUnits = utils.MetreToUserUnits;
class MetUk {
    constructor(_app) {
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
        this.forecastSite = null;
        this.observationSites = null;
        this.currentLoc = null;
        this.MAX_STATION_DIST = 50000;
        this.app = _app;
        this.sunCalc = new SunCalc();
    }
    async GetWeather(newLoc) {
        if (newLoc == null)
            return null;
        if (this.currentLoc == null || this.currentLoc.text != newLoc.text || this.forecastSite == null || this.observationSites == null || this.observationSites.length == 0) {
            this.app.log.Print("Downloading new site data");
            this.currentLoc = newLoc;
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
            this.app.log.Debug("Site data downloading skipped");
        }
        if (this.observationSites.length == 0 || this.forecastSite.dist > 100000) {
            this.app.log.Error("User is probably not in UK, aborting");
            this.app.HandleError({
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
        let forecastSitelist = null;
        try {
            forecastSitelist = await this.app.LoadJsonAsync(this.baseUrl + this.forecastPrefix + this.sitesUrl + "?" + this.key);
            return this.GetClosestSite(forecastSitelist, loc);
        }
        catch (e) {
            this.app.log.Error("Failed to get sitelist, error: " + JSON.stringify(e, null, 2));
            this.app.HandleError({
                type: "soft",
                userError: true,
                detail: "no network response",
                service: "met-uk",
                message: _("Unexpected response from API")
            });
            return null;
        }
    }
    async GetObservationSitesInRange(loc, range) {
        let observationSiteList = null;
        try {
            observationSiteList = await this.app.LoadJsonAsync(this.baseUrl + this.currentPrefix + this.sitesUrl + "?" + this.key);
        }
        catch (e) {
            this.app.log.Error("Failed to get sitelist, error: " + JSON.stringify(e, null, 2));
            this.app.HandleError({
                type: "soft",
                userError: true,
                detail: "no network response",
                service: "met-uk",
                message: _("Unexpected response from API")
            });
            return null;
        }
        let observationSites = [];
        for (let index = 0; index < observationSiteList.Locations.Location.length; index++) {
            const element = observationSiteList.Locations.Location[index];
            element.dist = GetDistance(parseFloat(element.latitude), parseFloat(element.longitude), loc.lat, loc.lon);
            if (element.dist > range)
                continue;
            observationSites.push(element);
        }
        observationSites = this.SortObservationSites(observationSites);
        this.app.log.Debug("Observation sites found: " + JSON.stringify(observationSites, null, 2));
        return observationSites;
    }
    async GetObservationData(observationSites) {
        let observations = [];
        for (let index = 0; index < observationSites.length; index++) {
            const element = observationSites[index];
            try {
                this.app.log.Debug("Getting observation data from station: " + element.id);
                observations.push(await this.app.LoadJsonAsync(this.baseUrl + this.currentPrefix + element.id + "?res=hourly&" + this.key));
            }
            catch (_a) {
                this.app.HandleError({
                    type: "soft",
                    userError: true,
                    detail: "no network response",
                    service: "us-weather",
                    message: _("Unexpected response from API")
                });
                this.app.log.Debug("Failed to get observations from " + element.id);
            }
        }
        return observations;
    }
    async GetData(query, ParseFunction) {
        let json;
        if (query != null) {
            this.app.log.Debug("Query: " + query);
            try {
                json = await this.app.LoadJsonAsync(query);
            }
            catch (e) {
                this.app.HandleHTTPError("met-uk", e, this.app, null);
                return null;
            }
            if (json == null) {
                this.app.HandleError({ type: "soft", detail: "no api response", service: "met-uk" });
                return null;
            }
            return ParseFunction(json, this);
        }
        else {
            return null;
        }
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
                condition: this.ResolveCondition(get(["W"], observation)),
                forecasts: []
            };
            if (get(["V"], observation) != null) {
                weather.extra_field = {
                    name: _("Visibility"),
                    value: this.VisibilityToText(observation.V),
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
            return weather;
        }
        catch (e) {
            this.app.log.Error("Met UK Weather Parsing error: " + e);
            this.app.HandleError({ type: "soft", service: "met-uk", detail: "unusual payload", message: _("Failed to Process Current Weather Info") });
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
            self.app.HandleError({ type: "soft", service: "met-uk", detail: "unusual payload", message: _("Failed to Process Forecast Info") });
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
                        temp: CelsiusToKelvin(parseFloat(hour.T)),
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
            self.app.log.Error("MET UK Forecast Parsing error: " + e);
            self.app.HandleError({ type: "soft", service: "met-uk", detail: "unusual payload", message: _("Failed to Process Forecast Info") });
            return null;
        }
    }
    VisibilityToText(dist) {
        let distance = parseInt(dist);
        let unit = this.app.config._distanceUnit;
        if (distance < 1000)
            return _("Very poor - Less than") + " " + MetreToUserUnits(1000, unit) + this.DistanceUnitFor(unit);
        if (distance < 4000)
            return _("Poor - Between") + " " + MetreToUserUnits(1000, unit) + "-" + MetreToUserUnits(4000, unit) + " " + this.DistanceUnitFor(unit);
        if (distance < 10000)
            return _("Moderate - Between") + " " + MetreToUserUnits(4000, unit) + "-" + MetreToUserUnits(10000, unit) + " " + this.DistanceUnitFor(unit);
        if (distance < 20000)
            return _("Good - Between") + " " + MetreToUserUnits(10000, unit) + "-" + MetreToUserUnits(20000, unit) + " " + this.DistanceUnitFor(unit);
        if (distance < 40000)
            return _("Very good - Between") + " " + MetreToUserUnits(20000, unit) + "-" + MetreToUserUnits(40000, unit) + " " + this.DistanceUnitFor(unit);
        return _("Excellent - More than") + " " + MetreToUserUnits(40000, unit) + " " + this.DistanceUnitFor(unit);
    }
    DistanceUnitFor(unit) {
        if (unit == "imperial")
            return _("mi");
        return _("km");
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
        if (!observations)
            return null;
        if (observations.length == 0)
            return null;
        let result = this.GetLatestObservation(get(["SiteRep", "DV", "Location", "Period"], observations[0]), new Date());
        if (observations.length == 1)
            return result;
        for (let index = 0; index < observations.length; index++) {
            if (get(["SiteRep", "DV", "Location", "Period"], observations[index]) == null)
                continue;
            let nextObservation = this.GetLatestObservation(observations[index].SiteRep.DV.Location.Period, new Date());
            if (result == null)
                result = nextObservation;
            let debugText = " Observation data missing, plugged in from ID " +
                observations[index].SiteRep.DV.Location.i + ", index " + index +
                ", distance "
                + Math.round(GetDistance(parseFloat(observations[index].SiteRep.DV.Location.lat), parseFloat(observations[index].SiteRep.DV.Location.lon), this.currentLoc.lat, this.currentLoc.lon))
                + " metres";
            if (get(["V"], result) == null) {
                result.V = get(["V"], nextObservation);
                this.app.log.Debug("Visibility" + debugText);
            }
            if (get(["W"], result) == null) {
                result.W = get(["W"], nextObservation);
                this.app.log.Debug("Weather condition" + debugText);
            }
            if (get(["S"], result) == null) {
                result.S = get(["S"], nextObservation);
                this.app.log.Debug("Wind Speed" + debugText);
            }
            if (get(["D"], result) == null) {
                result.D = get(["D"], nextObservation);
                this.app.log.Debug("Wind degree" + debugText);
            }
            if (get(["T"], result) == null) {
                result.T = get(["T"], nextObservation);
                this.app.log.Debug("Temperature" + debugText);
            }
            if (get(["P"], result) == null) {
                result.P = get(["P"], nextObservation);
                this.app.log.Debug("Pressure" + debugText);
            }
            if (get(["H"], result) == null) {
                result.H = get(["H"], nextObservation);
                this.app.log.Debug("Humidity" + debugText);
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
        closest.dist = GetDistance(parseFloat(closest.latitude), parseFloat(closest.longitude), loc.lat, loc.lon);
        for (let index = 0; index < sites.length; index++) {
            const element = sites[index];
            element.dist = GetDistance(parseFloat(element.latitude), parseFloat(element.longitude), loc.lat, loc.lon);
            if (element.dist < closest.dist) {
                closest = element;
            }
        }
        return closest;
    }
    ResolveCondition(icon) {
        let iconType = this.app.config.IconType();
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
                    description: _("Thunder"),
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
    }
    ;
}
;
