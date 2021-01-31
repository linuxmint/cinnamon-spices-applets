"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClimacellV4 = void 0;
const utils_1 = require("./utils");
class ClimacellV4 {
    constructor(app) {
        this.needsApiKey = true;
        this.prettyName = "Climacell";
        this.name = "ClimacellV4";
        this.maxForecastSupport = 15;
        this.maxHourlyForecastSupport = 108;
        this.website = "https://www.climacell.co/";
        this.url = "https://data.climacell.co/v4/timelines";
        this.params = {
            apikey: null,
            location: null,
            timesteps: "current,1h,1d",
            units: "metric",
            fields: "temperature,temperatureMax,temperatureMin,pressureSurfaceLevel,weatherCode,sunsetTime,sunriseTime,precipitationType,precipitationProbability,precipitationIntensity,windDirection,windSpeed,humidity,temperatureApparent"
        };
        this.app = app;
    }
    async GetWeather(loc) {
        if (loc == null)
            return null;
        this.params.apikey = this.app.config.ApiKey;
        this.params.location = loc.lat + "," + loc.lon;
        let response = await this.app.LoadJsonAsync(this.url, this.params, (m) => this.HandleHTTPError(m));
        if (response == null)
            return null;
        return this.ParseWeather(loc, response);
    }
    HandleHTTPError(message) {
        if (message.code == 401) {
            this.app.ShowError({
                type: "hard",
                userError: true,
                detail: "no key",
                service: "climacell",
                message: utils_1._("Please Make sure you\nentered the API key what you have from Climacell")
            });
            return false;
        }
        return true;
    }
    ParseWeather(loc, data) {
        var _a, _b;
        let current = (_b = (_a = data.data.timelines.find(x => x.timestep == "current")) === null || _a === void 0 ? void 0 : _a.intervals) === null || _b === void 0 ? void 0 : _b[0];
        let hourly = data.data.timelines.find(x => x.timestep == "1h").intervals;
        let daily = data.data.timelines.find(x => x.timestep == "1d").intervals;
        let result = {
            coord: {
                lat: loc.lat,
                lon: loc.lon
            },
            date: new Date(current.startTime),
            condition: this.ResolveCondition(current.values.weatherCode),
            humidity: current.values.humidity,
            pressure: current.values.pressureSurfaceLevel,
            temperature: utils_1.CelsiusToKelvin(current.values.temperature),
            wind: {
                degree: current.values.windDirection,
                speed: current.values.windSpeed
            },
            sunrise: new Date(daily === null || daily === void 0 ? void 0 : daily[0].values.sunriseTime),
            sunset: new Date(daily === null || daily === void 0 ? void 0 : daily[0].values.sunsetTime),
            location: {
                url: "https://www.climacell.co/weather"
            },
            extra_field: {
                name: utils_1._("Feels Like"),
                type: "temperature",
                value: utils_1.CelsiusToKelvin(current.values.temperatureApparent)
            },
            forecasts: []
        };
        let hours = [];
        let days = [];
        for (let index = 0; index < daily.length; index++) {
            const element = daily[index];
            days.push({
                condition: this.ResolveCondition(element.values.weatherCode),
                date: new Date(element.startTime),
                temp_max: utils_1.CelsiusToKelvin(element.values.temperatureMax),
                temp_min: utils_1.CelsiusToKelvin(element.values.temperatureMin)
            });
        }
        for (let index = 0; index < hourly.length; index++) {
            const element = hourly[index];
            let hour = {
                condition: this.ResolveCondition(element.values.weatherCode),
                date: new Date(element.startTime),
                temp: utils_1.CelsiusToKelvin(element.values.temperature)
            };
            hour.date.setMinutes(0, 0, 0);
            if (element.values.precipitationProbability > 0 && element.values.precipitationIntensity > 0) {
                hour.precipitation = {
                    chance: element.values.precipitationProbability,
                    volume: element.values.precipitationIntensity,
                    type: this.PrecipTypeToAppletType(element.values.precipitationType)
                };
            }
            hours.push(hour);
        }
        result.forecasts = days;
        result.hourlyForecasts = hours;
        return result;
    }
    ResolveCondition(weatherCode, isNight = false) {
        let result = {
            customIcon: "refresh-symbolic",
            icons: ["weather-severe-alert"],
            main: utils_1._("Unknown"),
            description: utils_1._("Unknown")
        };
        switch (weatherCode) {
            case 0:
                return result;
            case 1000:
                return {
                    main: isNight ? utils_1._("Clear") : utils_1._("Sunny"),
                    description: isNight ? utils_1._("Clear") : utils_1._("Sunny"),
                    customIcon: isNight ? "night-clear-symbolic" : "day-sunny-symbolic",
                    icons: isNight ? ["weather-clear-night"] : ["weather-clear"]
                };
            case 1001:
                return {
                    main: utils_1._("Cloudy"),
                    description: utils_1._("Cloudy"),
                    customIcon: "cloudy-symbolic",
                    icons: ["weather-overcast", "weather-many-clouds", isNight ? "weather-clouds-night" : "weather-clouds"]
                };
            case 1100:
                return {
                    main: utils_1._("Mostly clear"),
                    description: utils_1._("Mostly clear"),
                    customIcon: isNight ? "night-alt-cloudy-symbolic" : "day-cloudy-symbolic",
                    icons: isNight ? ["weather-few-clouds-night", "weather-clouds-night"] : ["weather-few-clouds", "weather-clouds"]
                };
            case 1101:
                return {
                    main: utils_1._("Partly cloudy"),
                    description: utils_1._("Partly cloudy"),
                    customIcon: isNight ? "night-alt-cloudy-symbolic" : "day-cloudy-symbolic",
                    icons: isNight ? ["weather-clouds-night", "weather-few-clouds-night"] : ["weather-clouds", "weather-few-clouds"]
                };
            case 1102:
                return {
                    main: utils_1._("Mostly cloudy"),
                    description: utils_1._("Mostly cloudy"),
                    customIcon: "cloud-symbolic",
                    icons: ["weather-overcast", "weather-many-clouds", isNight ? "weather-clouds-night" : "weather-clouds"]
                };
            case 2000:
                return {
                    main: utils_1._("Fog"),
                    description: utils_1._("Fog"),
                    customIcon: "fog-symbolic",
                    icons: ["weather-fog"]
                };
            case 2100:
                return {
                    main: utils_1._("Fog"),
                    description: utils_1._("Light fog"),
                    customIcon: isNight ? "night-fog-symbolic" : "day-fog-symbolic",
                    icons: ["weather-fog"]
                };
            case 3000:
                return {
                    main: utils_1._("Wind"),
                    description: utils_1._("Light wind"),
                    customIcon: isNight ? "night-alt-wind-symbolic" : "day-windy-symbolic",
                    icons: ["weather-windy"]
                };
            case 3001:
                return {
                    main: utils_1._("Wind"),
                    description: utils_1._("Wind"),
                    customIcon: "windy-symbolic",
                    icons: ["weather-windy"]
                };
            case 3002:
                return {
                    main: utils_1._("Wind"),
                    description: utils_1._("Strong wind"),
                    customIcon: "windy-symbolic",
                    icons: ["weather-windy"]
                };
            case 4000:
                return {
                    main: utils_1._("Drizzle"),
                    description: utils_1._("Drizzle"),
                    customIcon: "rain-mix-symbolic",
                    icons: ["weather-showers-scattered", "weather-showers", "weather-rain", "weather-freezing-rain"]
                };
            case 4001:
                return {
                    main: utils_1._("Rain"),
                    description: utils_1._("Rain"),
                    customIcon: "rain-symbolic",
                    icons: ["weather-rain", "weather-showers", "weather-freezing-rain", "weather-showers-scattered"]
                };
            case 4200:
                return {
                    main: utils_1._("Rain"),
                    description: utils_1._("Light rain"),
                    customIcon: isNight ? "night-alt-rain-symbolic" : "day-rain-symbolic",
                    icons: ["weather-showers-scattered", "weather-rain", "weather-freezing-rain", "weather-showers-scattered"]
                };
            case 4201:
                return {
                    main: utils_1._("Rain"),
                    description: utils_1._("Heavy rain"),
                    customIcon: "rain-symbolic",
                    icons: ["weather-rain", "weather-showers", "weather-freezing-rain", "weather-showers-scattered"]
                };
            case 5000:
                return {
                    main: utils_1._("Snow"),
                    description: utils_1._("Snow"),
                    customIcon: "snow-symbolic",
                    icons: ["weather-snow", "weather-snow-scattered", isNight ? "weather-snow-night" : "weather-snow-day"]
                };
            case 5001:
                return {
                    main: utils_1._("Flurries"),
                    description: utils_1._("Flurries"),
                    customIcon: "snow-wind-symbolic",
                    icons: ["weather-snow", "weather-snow-scattered", isNight ? "weather-snow-night" : "weather-snow-day"]
                };
            case 5100:
                return {
                    main: utils_1._("Snow"),
                    description: utils_1._("Light snow"),
                    customIcon: isNight ? "night-alt-snow-symbolic" : "day-snow-symbolic",
                    icons: isNight ? ["weather-snow-scattered-night", "weather-snow-night", "weather-snow"] : ["weather-snow-scattered-day", "weather-snow-day", "weather-snow"]
                };
            case 5101:
                return {
                    main: utils_1._("Snow"),
                    description: utils_1._("Heavy snow"),
                    customIcon: "snow-symbolic",
                    icons: ["weather-snow", "weather-snow-scattered"]
                };
            case 6000:
                return {
                    main: utils_1._("Drizzle"),
                    description: utils_1._("Freezing drizzle"),
                    customIcon: "rain-mix-symbolic",
                    icons: ["weather-freezing-rain", "weather-showers", "weather-showers-scattered"]
                };
            case 6001:
                return {
                    main: utils_1._("Rain"),
                    description: utils_1._("Freezing rain"),
                    customIcon: "rain-symbolic",
                    icons: ["weather-freezing-rain", "weather-rain", "weather-showers", "weather-showers-scattered"]
                };
            case 6200:
                return {
                    main: utils_1._("Rain"),
                    description: utils_1._("Light freezing rain"),
                    customIcon: isNight ? "night-alt-rain-symbolic" : "day-rain-symbolic",
                    icons: ["weather-freezing-rain", "weather-rain", "weather-showers", "weather-showers-scattered"]
                };
            case 6201:
                return {
                    main: utils_1._("Rain"),
                    description: utils_1._("Heavy freezing rain"),
                    customIcon: "rain-symbolic",
                    icons: ["weather-freezing-rain", "weather-rain", "weather-showers", "weather-showers-scattered"]
                };
            case 7000:
                return {
                    main: utils_1._("Ice pellets"),
                    description: utils_1._("Ice pellets"),
                    customIcon: "sleet-symbolic",
                    icons: ["weather-freezing-rain", "weather-rain", "weather-showers", "weather-showers-scattered"]
                };
            case 7101:
                return {
                    main: utils_1._("Ice pellets"),
                    description: utils_1._("Heavy ice pellets"),
                    customIcon: "sleet-symbolic",
                    icons: ["weather-freezing-rain", "weather-rain", "weather-showers", "weather-showers-scattered"]
                };
            case 7102:
                return {
                    main: utils_1._("Ice pellets"),
                    description: utils_1._("Light ice pellets"),
                    customIcon: isNight ? "night-alt-sleet-symbolic" : "day-sleet-symbolic",
                    icons: ["weather-freezing-rain", "weather-rain", "weather-showers", "weather-showers-scattered"]
                };
            case 8000:
                return {
                    main: utils_1._("Thunderstorm"),
                    description: utils_1._("Thunderstorm"),
                    customIcon: "thunderstorm-symbolic",
                    icons: ["weather-storm"]
                };
            default:
                return result;
        }
    }
    PrecipTypeToAppletType(type) {
        switch (type) {
            case 0:
                return "none";
            case 1:
                return "rain";
            case 2:
                return "snow";
            case 3:
                return "freezing rain";
            case 4:
                return "ice pellets";
            default:
                return "none";
        }
    }
}
exports.ClimacellV4 = ClimacellV4;
