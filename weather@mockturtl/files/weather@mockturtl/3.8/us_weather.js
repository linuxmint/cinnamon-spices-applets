"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.USWeather = void 0;
const logger_1 = require("./logger");
const sunCalc_1 = require("./sunCalc");
const utils_1 = require("./utils");
class USWeather {
    constructor(_app) {
        this.prettyName = "US Weather";
        this.name = "US Weather";
        this.maxForecastSupport = 7;
        this.website = "https://www.weather.gov/";
        this.maxHourlyForecastSupport = 156;
        this.needsApiKey = false;
        this.sitesUrl = "https://api.weather.gov/points/";
        this.grid = null;
        this.MAX_STATION_DIST = 50000;
        this.observationStations = null;
        this.currentLoc = null;
        this.currentLocID = null;
        this.app = _app;
        this.sunCalc = new sunCalc_1.SunCalc();
    }
    async GetWeather(loc) {
        if (loc == null)
            return null;
        let locID = loc.lat.toString() + "," + loc.lon.toString();
        if (!this.grid || !this.observationStations || this.currentLocID != locID) {
            logger_1.Log.Instance.Print("Downloading new site data");
            this.currentLoc = loc;
            this.currentLocID = locID;
            let grid = await this.GetGridData(loc);
            if (grid == null)
                return null;
            logger_1.Log.Instance.Debug("Grid found: " + JSON.stringify(grid, null, 2));
            let observationStations = await this.GetStationData(grid.properties.observationStations);
            if (observationStations == null)
                return null;
            this.grid = grid;
            this.observationStations = observationStations;
        }
        else {
            logger_1.Log.Instance.Debug("Site data downloading skipped");
        }
        let observations = await this.GetObservationsInRange(this.MAX_STATION_DIST, loc, this.observationStations);
        let hourlyForecastPromise = this.app.LoadJsonAsync(this.grid.properties.forecastHourly + "?units=si");
        let forecastPromise = this.app.LoadJsonAsync(this.grid.properties.forecast);
        let hourly = await hourlyForecastPromise;
        let forecast = await forecastPromise;
        if (!hourly || !forecast) {
            logger_1.Log.Instance.Error("Failed to obtain forecast Data");
            return null;
        }
        let weather = this.ParseCurrent(observations, hourly);
        weather.forecasts = this.ParseForecast(forecast);
        weather.hourlyForecasts = this.ParseHourlyForecast(hourly, this);
        return weather;
    }
    ;
    async GetGridData(loc) {
        let siteData = await this.app.LoadJsonAsync(this.sitesUrl + loc.lat.toString() + "," + loc.lon.toString(), null, (msg) => this.OnObtainingGridData(msg));
        return siteData;
    }
    async GetStationData(stationListUrl) {
        let stations = await this.app.LoadJsonAsync(stationListUrl);
        return stations === null || stations === void 0 ? void 0 : stations.features;
    }
    async GetObservationsInRange(range, loc, stations) {
        let observations = [];
        for (let index = 0; index < stations.length; index++) {
            const element = stations[index];
            element.dist = utils_1.GetDistance(element.geometry.coordinates[1], element.geometry.coordinates[0], loc.lat, loc.lon);
            if (element.dist > range)
                break;
            let observation = await this.app.LoadJsonAsync(stations[index].id + "/observations/latest", null, (msg) => false);
            if (observation == null) {
                logger_1.Log.Instance.Debug("Failed to get observations from " + stations[index].id);
            }
            else {
                observations.push(observation);
            }
        }
        return observations;
    }
    OnObtainingGridData(message) {
        var _a, _b;
        if (message.code == 404) {
            let data = JSON.parse((_b = (_a = message === null || message === void 0 ? void 0 : message.response) === null || _a === void 0 ? void 0 : _a.response_body) === null || _b === void 0 ? void 0 : _b.data);
            if (data.title == "Data Unavailable For Requested Point") {
                this.app.ShowError({
                    type: "hard",
                    userError: true,
                    detail: "location not covered",
                    service: "us-weather",
                    message: utils_1._("Location is outside US, please use a different provider.")
                });
            }
            return false;
        }
        return true;
    }
    MeshObservationData(observations) {
        if (observations.length < 1)
            return null;
        let result = observations[0];
        if (observations.length == 1)
            return result;
        for (let index = 1; index < observations.length; index++) {
            const element = observations[index];
            let debugText = " Observation data missing, plugged in from ID " +
                element.id + ", index " + index +
                ", distance "
                + Math.round(utils_1.GetDistance(element.geometry.coordinates[1], element.geometry.coordinates[0], this.currentLoc.lat, this.currentLoc.lon))
                + " metres";
            if (result.properties.icon == null) {
                result.properties.icon = element.properties.icon;
                result.properties.textDescription = element.properties.textDescription;
                logger_1.Log.Instance.Debug("Weather condition" + debugText);
            }
            if (result.properties.temperature.value == null) {
                result.properties.temperature.value = element.properties.temperature.value;
                logger_1.Log.Instance.Debug("Temperature" + debugText);
            }
            if (result.properties.windSpeed.value == null) {
                result.properties.windSpeed.value = element.properties.windSpeed.value;
                logger_1.Log.Instance.Debug("Wind Speed" + debugText);
            }
            if (result.properties.windDirection.value == null) {
                result.properties.windDirection.value = element.properties.windDirection.value;
                logger_1.Log.Instance.Debug("Wind degree" + debugText);
            }
            if (result.properties.barometricPressure.value == null) {
                result.properties.barometricPressure.value = element.properties.barometricPressure.value;
                logger_1.Log.Instance.Debug("Pressure" + debugText);
            }
            if (result.properties.relativeHumidity.value == null) {
                result.properties.relativeHumidity.value = element.properties.relativeHumidity.value;
                logger_1.Log.Instance.Debug("Humidity" + debugText);
            }
            if (result.properties.windChill.value == null) {
                result.properties.windChill.value = element.properties.windChill.value;
                logger_1.Log.Instance.Debug("WindChill" + debugText);
            }
            if (result.properties.visibility.value == null) {
                result.properties.visibility.value = element.properties.visibility.value;
                logger_1.Log.Instance.Debug("Visibility" + debugText);
            }
        }
        return result;
    }
    ParseCurrent(json, hourly) {
        if (json.length == 0) {
            logger_1.Log.Instance.Error("No observation stations/data are available");
            return null;
        }
        let observation = this.MeshObservationData(json);
        let timestamp = new Date(observation.properties.timestamp);
        let times = this.sunCalc.getTimes(new Date(), observation.geometry.coordinates[1], observation.geometry.coordinates[0], observation.properties.elevation.value);
        try {
            let weather = {
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
                    speed: utils_1.KPHtoMPS(observation.properties.windSpeed.value),
                    degree: observation.properties.windDirection.value
                },
                temperature: utils_1.CelsiusToKelvin(observation.properties.temperature.value),
                pressure: observation.properties.barometricPressure.value / 100,
                humidity: observation.properties.relativeHumidity.value,
                condition: this.ResolveCondition(observation.properties.icon, utils_1.IsNight(times)),
                forecasts: []
            };
            if (observation.properties.windChill.value != null) {
                weather.extra_field = {
                    name: utils_1._("Feels Like"),
                    value: utils_1.CelsiusToKelvin(observation.properties.windChill.value),
                    type: "temperature"
                };
            }
            if (weather.condition == null && hourly != null) {
                weather.condition = this.ResolveCondition(hourly.properties.periods[0].icon);
            }
            return weather;
        }
        catch (e) {
            logger_1.Log.Instance.Error("US Weather Parsing error: " + e);
            this.app.ShowError({ type: "soft", service: "us-weather", detail: "unusual payload", message: utils_1._("Failed to Process Current Weather Info") });
            return null;
        }
    }
    ;
    ParseForecast(json) {
        let forecasts = [];
        try {
            let startIndex = 0;
            if (json.properties.periods[0].isDaytime == false) {
                startIndex = 1;
                let today = json.properties.periods[0];
                let forecast = {
                    date: new Date(today.startTime),
                    temp_min: utils_1.FahrenheitToKelvin(today.temperature),
                    temp_max: utils_1.FahrenheitToKelvin(today.temperature),
                    condition: this.ResolveCondition(today.icon),
                };
                forecasts.push(forecast);
            }
            for (let i = startIndex; i < json.properties.periods.length; i += 2) {
                let day = json.properties.periods[i];
                let night = json.properties.periods[i + 1];
                if (!night)
                    night = day;
                let forecast = {
                    date: new Date(day.startTime),
                    temp_min: utils_1.FahrenheitToKelvin(night.temperature),
                    temp_max: utils_1.FahrenheitToKelvin(day.temperature),
                    condition: this.ResolveCondition(day.icon),
                };
                forecasts.push(forecast);
            }
            return forecasts;
        }
        catch (e) {
            logger_1.Log.Instance.Error("US Weather Forecast Parsing error: " + e);
            this.app.ShowError({ type: "soft", service: "us-weather", detail: "unusual payload", message: utils_1._("Failed to Process Forecast Info") });
            return null;
        }
    }
    ;
    ParseHourlyForecast(json, self) {
        let forecasts = [];
        try {
            for (let i = 0; i < json.properties.periods.length; i++) {
                let hour = json.properties.periods[i];
                let timestamp = new Date(hour.startTime);
                let forecast = {
                    date: timestamp,
                    temp: utils_1.CelsiusToKelvin(hour.temperature),
                    condition: self.ResolveCondition(hour.icon, !hour.isDaytime),
                    precipitation: null
                };
                forecasts.push(forecast);
            }
            return forecasts;
        }
        catch (e) {
            logger_1.Log.Instance.Error("US Weather service Forecast Parsing error: " + e);
            self.app.ShowError({ type: "soft", service: "us-weather", detail: "unusual payload", message: utils_1._("Failed to Process Hourly Forecast Info") });
            return null;
        }
    }
    ResolveCondition(icon, isNight = false) {
        if (icon == null)
            return null;
        let code = icon.match(/(?!\/)[a-z_]+(?=(\?|,))/);
        let iconType = this.app.config.IconType;
        switch (code[0]) {
            case "skc":
                return {
                    main: utils_1._("Clear"),
                    description: utils_1._("Clear"),
                    customIcon: (isNight) ? "night-clear-symbolic" : "day-sunny-symbolic",
                    icons: (isNight) ? ["weather-clear-night", "weather-severe-alert"] : ["weather-clear", "weather-severe-alert"]
                };
            case "few":
                return {
                    main: utils_1._("Few clouds"),
                    description: utils_1._("Few clouds"),
                    customIcon: (isNight) ? "night-alt-cloudy-symbolic" : "day-cloudy-symbolic",
                    icons: ["weather-clear-night", "weather-severe-alert"]
                };
            case "sct":
                return {
                    main: utils_1._("Partly cloudy"),
                    description: utils_1._("Partly cloudy"),
                    customIcon: (isNight) ? "night-alt-cloudy-symbolic" : "day-cloudy-symbolic",
                    icons: ["weather-clear", "weather-severe-alert"]
                };
            case "bkn":
                return {
                    main: utils_1._("Mostly cloudy"),
                    description: utils_1._("Mostly cloudy"),
                    customIcon: (isNight) ? "night-alt-cloudy-symbolic" : "day-cloudy-symbolic",
                    icons: ["weather-clouds-night", "weather-overcast", "weather-severe-alert"]
                };
            case "ovc":
                return {
                    main: utils_1._("Overcast"),
                    description: utils_1._("Overcast"),
                    customIcon: "cloudy-symbolic",
                    icons: ["weather-clouds", "weather-overcast", "weather-severe-alert"]
                };
            case "wind_skc":
                return {
                    main: utils_1._("Clear"),
                    description: utils_1._("Clear and windy"),
                    customIcon: (utils_1.IsNight) ? "night-alt-wind-symbolic" : "day-windy-symbolic",
                    icons: (isNight) ? ["weather-clear-night"] : ["weather-clear"]
                };
            case "wind_few":
                return {
                    main: utils_1._("Few clouds"),
                    description: utils_1._("Few clouds and windy"),
                    customIcon: (utils_1.IsNight) ? "night-alt-cloudy-windy-symbolic" : "day-cloudy-windy-symbolic",
                    icons: (isNight) ? ["weather-few-clouds-night"] : ["weather-few-clouds"]
                };
            case "wind_sct":
                return {
                    main: utils_1._("Partly cloudy"),
                    description: utils_1._("Partly cloudy and windy"),
                    customIcon: (utils_1.IsNight) ? "night-alt-cloudy-windy-symbolic" : "day-cloudy-windy-symbolic",
                    icons: (isNight) ? ["weather-clouds-night", "weather-few-clouds-night"] : ["weather-clouds", "weather-few-clouds"]
                };
            case "wind_bkn":
                return {
                    main: utils_1._("Mostly cloudy"),
                    description: utils_1._("Mostly cloudy and windy"),
                    customIcon: (utils_1.IsNight) ? "night-alt-cloudy-windy-symbolic" : "day-cloudy-windy-symbolic",
                    icons: (isNight) ? ["weather-clouds-night", "weather-few-clouds-night"] : ["weather-clouds", "weather-few-clouds"]
                };
            case "wind_ovc":
                return {
                    main: utils_1._("Overcast"),
                    description: utils_1._("Overcast and windy"),
                    customIcon: "cloudy-symbolic",
                    icons: ["weather-overcast", "weather-many-clouds", "weather-severe-alert"]
                };
            case "snow":
                return {
                    main: utils_1._("Snow"),
                    description: utils_1._("Snow"),
                    customIcon: "snow-symbolic",
                    icons: ["weather-snow", "weather-severe-alert"]
                };
            case "rain_snow":
                return {
                    main: utils_1._("Rain"),
                    description: utils_1._("Snowy rain"),
                    customIcon: "rain-mix-symbolic",
                    icons: ["weather-snow-rain", "weather-snow", "weather-severe-alert"]
                };
            case "rain_sleet":
                return {
                    main: utils_1._("Sleet"),
                    description: utils_1._("Sleet"),
                    customIcon: "rain-mix-symbolic",
                    icons: ["weather-freezing-rain", "weather-severe-alert"]
                };
            case "snow_sleet":
                return {
                    main: utils_1._("Sleet"),
                    description: utils_1._("Sleet"),
                    customIcon: "sleet-symbolic",
                    icons: ["weather-freezing-rain", "weather-hail", "weather-severe-alert"]
                };
            case "fzra":
                return {
                    main: utils_1._("Freezing rain"),
                    description: utils_1._("Freezing rain"),
                    customIcon: "rain-wind-symbolic",
                    icons: ["weather-freezing-rain", "weather-hail", "weather-severe-alert"]
                };
            case "rain_fzra":
                return {
                    main: utils_1._("Freezing rain"),
                    description: utils_1._("Freezing rain"),
                    customIcon: "rain-wind-symbolic",
                    icons: ["weather-freezing-rain", "weather-hail", "weather-severe-alert"]
                };
            case "snow_fzra":
                return {
                    main: utils_1._("Freezing rain"),
                    description: utils_1._("Freezing rain and snow"),
                    customIcon: "rain-wind-symbolic",
                    icons: ["weather-freezing-rain", "weather-hail", "weather-severe-alert"]
                };
            case "sleet":
                return {
                    main: utils_1._("Sleet"),
                    description: utils_1._("Sleet"),
                    customIcon: "rain-mix-symbolic",
                    icons: ["weather-freezing-rain", "weather-rain", "weather-severe-alert"]
                };
            case "rain":
                return {
                    main: utils_1._("Rain"),
                    description: utils_1._("Rain"),
                    customIcon: "rain-symbolic",
                    icons: ["weather-rain", "weather-freezing-rain", "weather-showers", "weather-showers-scattered", "weather-severe-alert"]
                };
            case "rain_showers":
            case "rain_showers_hi":
                return {
                    main: utils_1._("Rain"),
                    description: utils_1._("Rain showers"),
                    customIcon: "rain-mix-symbolic",
                    icons: ["weather-showers", "weather-showers-scattered", "weather-rain", "weather-freezing-rain", "weather-severe-alert"]
                };
            case "tsra":
            case "tsra_sct":
            case "tsra_hi":
                return {
                    main: utils_1._("Thunderstorm"),
                    description: utils_1._("Thunderstorm"),
                    customIcon: "thunderstorm-symbolic",
                    icons: ["weather-storm", "weather-severe-alert"]
                };
            case "tornado":
                return {
                    main: utils_1._("Tornado"),
                    description: utils_1._("Tornado"),
                    customIcon: "tornado-symbolic",
                    icons: ["weather-severe-alert"]
                };
            case "hurricane":
                return {
                    main: utils_1._("Hurricane"),
                    description: utils_1._("Hurricane"),
                    customIcon: "hurricane-symbolic",
                    icons: ["weather-severe-alert"]
                };
            case "tropical_storm":
                return {
                    main: utils_1._("Storm"),
                    description: utils_1._("Tropical storm"),
                    customIcon: "thunderstorm-symbolic",
                    icons: ["weather-storm", "weather-severe-alert"]
                };
            case "dust":
                return {
                    main: utils_1._("Dust"),
                    description: utils_1._("Dust"),
                    customIcon: "dust-symbolic",
                    icons: ["weather-fog", "weather-severe-alert"]
                };
            case "smoke":
                return {
                    main: utils_1._("Smoke"),
                    description: utils_1._("Smoke"),
                    customIcon: "smoke-symbolic",
                    icons: ["weather-fog", "weather-severe-alert"]
                };
            case "haze":
                return {
                    main: utils_1._("Haze"),
                    description: utils_1._("Haze"),
                    customIcon: "fog-symbolic",
                    icons: ["weather-fog", "weather-severe-alert"]
                };
            case "hot":
                return {
                    main: utils_1._("Hot"),
                    description: utils_1._("Hot"),
                    customIcon: "hot-symbolic",
                    icons: ["weather-severe-alert"]
                };
            case "cold":
                return {
                    main: utils_1._("Cold"),
                    description: utils_1._("Cold"),
                    customIcon: "snowflake-cold-symbolic",
                    icons: ["weather-storm", "weather-severe-alert"]
                };
            case "blizzard":
                return {
                    main: utils_1._("Blizzard"),
                    description: utils_1._("Blizzard"),
                    customIcon: "thunderstorm-symbolic",
                    icons: ["weather-storm", "weather-severe-alert"]
                };
            case "fog":
                return {
                    main: utils_1._("Fog"),
                    description: utils_1._("Fog"),
                    customIcon: "fog-symbolic",
                    icons: ["weather-fog", "weather-severe-alert"]
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
exports.USWeather = USWeather;
;
