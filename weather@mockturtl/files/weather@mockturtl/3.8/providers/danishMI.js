"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DanishMI = void 0;
const utils_1 = require("utils");
class DanishMI {
    constructor(app) {
        this.needsApiKey = false;
        this.prettyName = utils_1._("DMI Denmark");
        this.name = "DanishMI";
        this.maxForecastSupport = 10;
        this.maxHourlyForecastSupport = 48;
        this.website = "https://www.dmi.dk/";
        this.url = "https://www.dmi.dk/NinJo2DmiDk/ninjo2dmidk";
        this.forecastParams = {
            cmd: "llj",
            lon: null,
            lat: null,
            tz: "UTC"
        };
        this.observationParams = {
            cmd: "obj",
            east: null,
            west: null,
            south: null,
            north: null
        };
        this.app = app;
    }
    async GetWeather(loc) {
        if (loc == null)
            return null;
        this.GetLocationBoundingBox(loc);
        let observations = this.OrderObservations(await this.app.LoadJsonAsync(this.url, this.observationParams), loc);
        this.forecastParams.lat = loc.lat;
        this.forecastParams.lon = loc.lon;
        let forecasts = await this.app.LoadJsonAsync(this.url, this.forecastParams);
        return this.ParseWeather(observations, forecasts);
    }
    ParseWeather(observations, forecasts) {
        var _a, _b, _c, _d, _e;
        let observation = this.MergeObservations(observations);
        let result = {
            temperature: utils_1.CelsiusToKelvin(observation.Temperature2m),
            condition: this.ResolveCondition(observation.symbol),
            humidity: observation.RelativeHumidity,
            pressure: (!observation.PressureMSL) ? null : observation.PressureMSL / 100,
            wind: {
                degree: observation.WindDirection,
                speed: observation.WindSpeed10m
            }
        };
        result.location = {
            city: forecasts.city,
            country: forecasts.country,
            timeZone: null,
            url: `https://www.dmi.dk/lokation/show/${forecasts.country}/${forecasts.id}`
        };
        result.coord = {
            lon: forecasts.longitude,
            lat: forecasts.latitude
        };
        result.date = this.DateStringToDate(forecasts.lastupdate);
        result.humidity = (_a = result.humidity) !== null && _a !== void 0 ? _a : forecasts.timeserie[0].humidity;
        result.pressure = (_b = result.pressure) !== null && _b !== void 0 ? _b : forecasts.timeserie[0].pressure;
        result.temperature = (_c = result.temperature) !== null && _c !== void 0 ? _c : utils_1.CelsiusToKelvin(forecasts.timeserie[0].temp);
        result.wind.degree = (_d = result.wind.degree) !== null && _d !== void 0 ? _d : forecasts.timeserie[0].windDegree;
        result.wind.speed = (_e = result.wind.speed) !== null && _e !== void 0 ? _e : forecasts.timeserie[0].windSpeed;
        result.sunrise = this.DateStringToDate(forecasts.sunrise);
        result.sunset = this.DateStringToDate(forecasts.sunset);
        if (result.condition.customIcon == "alien-symbolic") {
            result.condition = this.ResolveCondition(forecasts.timeserie[0].symbol);
        }
        let forecastData = [];
        for (let index = 0; index < forecasts.aggData.length - 1; index++) {
            const element = forecasts.aggData[index];
            forecastData.push({
                date: this.DateStringToDate(element.time),
                temp_max: utils_1.CelsiusToKelvin(element.maxTemp),
                temp_min: utils_1.CelsiusToKelvin(element.minTemp),
                condition: this.ResolveDailyCondition(forecasts.timeserie, this.DateStringToDate(element.time))
            });
        }
        result.forecasts = forecastData;
        let hourlyData = [];
        for (let index = 0; index < forecasts.timeserie.length; index++) {
            const element = forecasts.timeserie[index];
            if (element.time == null)
                continue;
            let hour = {
                date: this.DateStringToDate(element.time),
                temp: utils_1.CelsiusToKelvin(element.temp),
                condition: this.ResolveCondition(element.symbol)
            };
            if (element.precip1 > 0.01 && element.precipType != null) {
                hour.precipitation = {
                    type: this.DanishPrecipToType(element.precipType),
                    volume: element.precip1
                };
            }
            hourlyData.push(hour);
        }
        result.hourlyForecasts = hourlyData;
        return result;
    }
    MergeObservations(observations) {
        var _a, _b, _c, _d, _e, _f;
        let result = {
            symbol: null,
            PressureMSL: null,
            Temperature2m: null,
            WindDirection: null,
            RelativeHumidity: null,
            WindSpeed10m: null,
        };
        for (let index = 0; index < observations.length; index++) {
            const element = observations[index];
            result.symbol = (_a = result.symbol) !== null && _a !== void 0 ? _a : element.values.symbol;
            result.PressureMSL = (_b = result.PressureMSL) !== null && _b !== void 0 ? _b : element.values.PressureMSL;
            result.Temperature2m = (_c = result.Temperature2m) !== null && _c !== void 0 ? _c : element.values.Temperature2m;
            result.WindDirection = (_d = result.WindDirection) !== null && _d !== void 0 ? _d : element.values.WindDirection;
            result.RelativeHumidity = (_e = result.RelativeHumidity) !== null && _e !== void 0 ? _e : element.values.RelativeHumidity;
            result.WindSpeed10m = (_f = result.WindSpeed10m) !== null && _f !== void 0 ? _f : element.values.WindSpeed10m;
        }
        return result;
    }
    ResolveDailyCondition(hourlyData, date) {
        let target = new Date(date);
        target.setHours(target.getHours() + 6);
        let upto = new Date(target);
        upto.setDate(upto.getDate() + 1);
        let relevantHours = hourlyData.filter(x => {
            let hour = this.DateStringToDate(x.time);
            if (hour >= target && hour < upto)
                return hour;
        });
        let normalizedSymbols = relevantHours.map(x => (x.symbol > 100) ? (x.symbol - 100) : x.symbol);
        let resultSymbol = null;
        if (!!normalizedSymbols.find(x => x > 10 && x != 45))
            resultSymbol = Math.max(...normalizedSymbols);
        else
            resultSymbol = utils_1.mode(normalizedSymbols);
        return this.ResolveCondition(resultSymbol);
    }
    ResolveCondition(symbol) {
        let isNight = (symbol > 100);
        if (isNight)
            symbol = symbol - 100;
        switch (symbol) {
            case 1:
                return {
                    main: utils_1._("Clear"),
                    description: utils_1._("Clear"),
                    customIcon: isNight ? "night-clear-symbolic" : "day-sunny-symbolic",
                    icons: isNight ? ["weather-clear-night"] : ["weather-clear"]
                };
            case 2:
                return {
                    main: utils_1._("Partly cloudy"),
                    description: utils_1._("Partly cloudy"),
                    customIcon: isNight ? "night-alt-cloudy-symbolic" : "day-cloudy-symbolic",
                    icons: isNight ? ["weather-few-clouds-night", "weather-clouds-night"] : ["weather-few-clouds", "weather-clouds"]
                };
            case 3:
                return {
                    main: utils_1._("Cloudy"),
                    description: utils_1._("Cloudy"),
                    customIcon: "cloudy-symbolic",
                    icons: ["weather-overcast", "weather-many-clouds", "weather-clouds", "weather-few-clouds"]
                };
            case 38:
                return {
                    main: utils_1._("Snow"),
                    description: utils_1._("Blowing snow"),
                    customIcon: "snow-symbolic",
                    icons: ["weather-snow"]
                };
            case 45:
                return {
                    main: utils_1._("Foggy"),
                    description: utils_1._("Foggy"),
                    customIcon: "fog-symbolic",
                    icons: ["weather-fog"]
                };
            case 60:
                return {
                    main: utils_1._("Rain"),
                    description: utils_1._("Rain"),
                    customIcon: "rain-symbolic",
                    icons: ["weather-rain", "weather-freezing-rain", "weather-showers"]
                };
            case 63:
                return {
                    main: utils_1._("Moderate rain"),
                    description: utils_1._("Moderate rain"),
                    customIcon: "rain-symbolic",
                    icons: ["weather-rain", "weather-showers", "weather-freezing-rain"]
                };
            case 68:
                return {
                    main: utils_1._("Rain and snow"),
                    description: utils_1._("Rain and snow"),
                    customIcon: "rain-mix-symbolic",
                    icons: ["weather-snow-rain", "weather-freezing-rain", "weather-rain"]
                };
            case 69:
                return {
                    main: utils_1._("Rain and snow"),
                    description: utils_1._("Heavy rain and snow"),
                    customIcon: "rain-mix-symbolic",
                    icons: ["weather-snow-rain", "weather-freezing-rain", "weather-rain"]
                };
            case 70:
                return {
                    main: utils_1._("Slight snow"),
                    description: utils_1._("Slight snow"),
                    customIcon: "snow-symbolic",
                    icons: ["weather-snow", "weather-snow-scattered"]
                };
            case 73:
                return {
                    main: utils_1._("Moderate snow"),
                    description: utils_1._("Moderate snow"),
                    customIcon: "snow-symbolic",
                    icons: ["weather-snow", "weather-snow-scattered"]
                };
            case 80:
                return {
                    main: utils_1._("Rain"),
                    description: utils_1._("Rain showers"),
                    customIcon: "showers-symbolic",
                    icons: ["weather-showers", "weather-freezing-rain", "weather-rain"]
                };
            case 81:
                return {
                    main: utils_1._("Rain showers"),
                    description: utils_1._("Moderate rain showers"),
                    customIcon: isNight ? "night-alt-showers-symbolic" : "day-showers-symbolic",
                    icons: isNight ? ["weather-showers-night", "weather-showers-scattered-night", "weather-showers-scattered", "weather-showers"] : ["weather-showers-day", "weather-showers-scattered-day", "weather-showers"]
                };
            case 83:
                return {
                    main: utils_1._("Rain and snow"),
                    description: utils_1._("Mixed rain and snow"),
                    customIcon: isNight ? "night-alt-rain-mix-symbolic" : "day-rain-mix-symbolic",
                    icons: ["weather-snow-rain", "weather-freezing-rain", "weather-snow-day", "weather-snow"]
                };
            case 84:
                return {
                    main: utils_1._("Rain and snow"),
                    description: utils_1._("Heavy mixed rain and snow"),
                    customIcon: "rain-mix-symbolic",
                    icons: ["weather-snow-rain", "weather-freezing-rain", "weather-snow-day", "weather-snow"]
                };
            case 85:
                return {
                    main: utils_1._("Snow"),
                    description: utils_1._("Snow showers"),
                    customIcon: isNight ? "night-alt-snow-symbolic" : "day-snow-symbolic",
                    icons: isNight ? ["weather-snow-night", "weather-snow"] : ["weather-snow-day", "weather-snow"]
                };
            case 86:
                return {
                    main: utils_1._("Heavy snow"),
                    description: utils_1._("Heavy snow showers"),
                    customIcon: "day-snow-symbolic",
                    icons: ["weather-snow-day", "weather-snow"]
                };
            case 95:
                return {
                    main: utils_1._("Thunderstorm"),
                    description: utils_1._("Thunderstorm"),
                    customIcon: "thunderstorm-symbolic",
                    icons: ["weather-storm"]
                };
            default: {
                return {
                    main: utils_1._("NOT FOUND"),
                    description: utils_1._("NOT FOUND"),
                    customIcon: "alien-symbolic",
                    icons: ["weather-severe-alert"]
                };
            }
        }
    }
    DanishPrecipToType(type) {
        switch (type) {
            case "sne":
                return "snow";
            case "regn":
                return "rain";
            case "slud":
                return "ice pellets";
            default:
                return "none";
        }
    }
    GetLocationBoundingBox(loc) {
        this.observationParams.west = loc.lon + 0.075;
        this.observationParams.east = loc.lon - 0.075;
        this.observationParams.north = loc.lat + 0.045;
        this.observationParams.south = loc.lat - 0.04;
    }
    OrderObservations(observations, loc) {
        let result = [];
        for (const key in observations) {
            const element = observations[key];
            element.dist = utils_1.GetDistance(loc.lat, loc.lon, element.latitude, element.longitude);
            result.push(element);
        }
        return this.SortObservationSites(result);
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
    DateStringToDate(str) {
        if (!str)
            return null;
        if (str.length == 14) {
            return new Date(Date.UTC(parseInt(str.substring(0, 4)), parseInt(str.substring(4, 6)) - 1, parseInt(str.substring(6, 8)), parseInt(str.substring(8, 10)), parseInt(str.substring(10, 12)), parseInt(str.substring(12, 14))));
        }
        else if (str.length == 8) {
            return new Date(Date.UTC(parseInt(str.substring(0, 4)), parseInt(str.substring(4, 6)) - 1, parseInt(str.substring(6, 8)), 0, 0, 0, 0));
        }
        else if (str.length == 4 || str.length == 3) {
            if (str.length == 3) {
                str = ("0000" + str).substr(-4, 4);
            }
            let today = new Date();
            today.setUTCHours(parseInt(str.substring(0, 2)), parseInt(str.substring(2, 4)), 0, 0);
            return today;
        }
        return null;
    }
}
exports.DanishMI = DanishMI;
