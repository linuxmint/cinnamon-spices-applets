"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetNorway = void 0;
const logger_1 = require("./logger");
const sunCalc_1 = require("./sunCalc");
const utils_1 = require("./utils");
class MetNorway {
    constructor(app) {
        this.prettyName = "MET Norway";
        this.name = "MetNorway";
        this.maxForecastSupport = 10;
        this.website = "https://www.met.no/en";
        this.maxHourlyForecastSupport = 48;
        this.needsApiKey = false;
        this.baseUrl = "https://api.met.no/weatherapi/locationforecast/2.0/complete?";
        this.app = app;
        this.sunCalc = new sunCalc_1.SunCalc();
    }
    async GetWeather(loc) {
        let query = this.GetUrl(loc);
        if (query == null)
            return null;
        let json = await this.app.LoadJsonAsync(query);
        if (!json) {
            logger_1.Log.Instance.Error("MET Norway: Empty response from API");
            return null;
        }
        return this.ParseWeather(json);
    }
    RemoveEarlierElements(json) {
        let now = new Date();
        let startIndex = -1;
        for (let i = 0; i < json.properties.timeseries.length; i++) {
            const element = json.properties.timeseries[i];
            let timestamp = new Date(element.time);
            if (timestamp < now && now.getHours() != timestamp.getHours()) {
                startIndex = i;
            }
            else {
                break;
            }
        }
        if (startIndex != -1) {
            logger_1.Log.Instance.Debug("Removing outdated weather information...");
            json.properties.timeseries.splice(0, startIndex + 1);
        }
        return json;
    }
    ParseWeather(json) {
        json = this.RemoveEarlierElements(json);
        let times = this.sunCalc.getTimes(new Date(), json.geometry.coordinates[1], json.geometry.coordinates[0], json.geometry.coordinates[2]);
        let current = json.properties.timeseries[0];
        let result = {
            temperature: utils_1.CelsiusToKelvin(current.data.instant.details.air_temperature),
            coord: {
                lat: json.geometry.coordinates[1],
                lon: json.geometry.coordinates[0]
            },
            date: new Date(current.time),
            condition: this.ResolveCondition(current.data.next_1_hours.summary.symbol_code, utils_1.IsNight(times)),
            humidity: current.data.instant.details.relative_humidity,
            pressure: current.data.instant.details.air_pressure_at_sea_level,
            extra_field: {
                name: utils_1._("Cloudiness"),
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
        let hourlyForecasts = [];
        for (let i = 0; i < json.properties.timeseries.length; i++) {
            const element = json.properties.timeseries[i];
            if (!!element.data.next_1_hours) {
                hourlyForecasts.push({
                    date: new Date(element.time),
                    temp: utils_1.CelsiusToKelvin(element.data.instant.details.air_temperature),
                    precipitation: {
                        type: "rain",
                        volume: element.data.next_1_hours.details.precipitation_amount
                    },
                    condition: this.ResolveCondition(element.data.next_1_hours.summary.symbol_code, utils_1.IsNight(times, new Date(element.time)))
                });
            }
        }
        result.hourlyForecasts = hourlyForecasts;
        result.forecasts = this.BuildForecasts(json.properties.timeseries);
        return result;
    }
    BuildForecasts(forecastsData) {
        let forecasts = [];
        let days = this.SortDataByDay(forecastsData);
        for (let i = 0; i < days.length; i++) {
            let forecast = {
                condition: {
                    customIcon: "cloudy-symbolic",
                    description: "",
                    icons: [],
                    main: ""
                },
                date: null,
                temp_max: Number.NEGATIVE_INFINITY,
                temp_min: Number.POSITIVE_INFINITY
            };
            let conditionCounter = {};
            for (let j = 0; j < days[i].length; j++) {
                const element = days[i][j];
                if (!element.data.next_6_hours)
                    continue;
                forecast.date = new Date(element.time);
                if (element.data.next_6_hours.details.air_temperature_max > forecast.temp_max)
                    forecast.temp_max = element.data.next_6_hours.details.air_temperature_max;
                if (element.data.next_6_hours.details.air_temperature_min < forecast.temp_min)
                    forecast.temp_min = element.data.next_6_hours.details.air_temperature_min;
                let [symbol] = element.data.next_6_hours.summary.symbol_code.split("_");
                let severity = conditionSeverity[symbol];
                if (!conditionCounter[severity])
                    conditionCounter[severity] = { count: 0, name: symbol };
                conditionCounter[severity].count = conditionCounter[severity].count + 1;
            }
            forecast.temp_max = utils_1.CelsiusToKelvin(forecast.temp_max);
            forecast.temp_min = utils_1.CelsiusToKelvin(forecast.temp_min);
            forecast.condition = this.ResolveCondition(this.GetMostSevereCondition(conditionCounter));
            forecasts.push(forecast);
        }
        return forecasts;
    }
    GetEarliestDataForToday(events) {
        let earliest = 0;
        for (let i = 0; i < events.length; i++) {
            const earliestElementTime = new Date(events[earliest].time);
            let timestamp = new Date(events[i].time);
            if (timestamp.toDateString() != new Date().toDateString())
                continue;
            if (earliestElementTime < timestamp)
                continue;
            earliest = i;
        }
        return events[earliest];
    }
    SortDataByDay(data) {
        let days = [];
        let currentDay = new Date(this.GetEarliestDataForToday(data).time);
        let dayIndex = 0;
        days.push([]);
        for (let i = 0; i < data.length; i++) {
            const element = data[i];
            const timestamp = new Date(element.time);
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
    }
    GetMostCommonCondition(count) {
        let result = null;
        for (let key in count) {
            if (result == null)
                result = parseInt(key);
            if (count[result].count < count[key].count)
                result = parseInt(key);
        }
        return count[result].name;
    }
    GetMostSevereCondition(conditions) {
        let result = null;
        for (let key in conditions) {
            let conditionID = parseInt(key);
            let resultStripped = (result > 100) ? result - 100 : result;
            let conditionIDStripped = (conditionID > 100) ? conditionID - 100 : conditionID;
            if (conditionIDStripped > resultStripped)
                result = conditionID;
        }
        if (result <= 4) {
            return this.GetMostCommonCondition(conditions);
        }
        return conditions[result].name;
    }
    GetUrl(loc) {
        let url = this.baseUrl + "lat=";
        url += (loc.lat + "&lon=" + loc.lon);
        return url;
    }
    DeconstructCondition(icon) {
        let condition = icon.split("_");
        return {
            timeOfDay: condition[1],
            condition: condition[0]
        };
    }
    ResolveCondition(icon, isNight = false) {
        let weather = this.DeconstructCondition(icon);
        switch (weather.condition) {
            case "clearsky":
                return {
                    customIcon: (isNight) ? "night-clear-symbolic" : "day-sunny-symbolic",
                    main: utils_1._("Clear sky"),
                    description: utils_1._("Clear sky"),
                    icons: (isNight) ? ["weather-clear-night"] : ["weather-clear"]
                };
            case "cloudy":
                return {
                    customIcon: "cloudy-symbolic",
                    main: utils_1._("Cloudy"),
                    description: utils_1._("Cloudy"),
                    icons: (isNight) ? ["weather-overcast", "weather-clouds-night", "weather-few-clouds-night"] : ["weather-overcast", "weather-clouds", "weather-few-clouds"]
                };
            case "fair":
                return {
                    customIcon: (isNight) ? "night-cloudy-symbolic" : "day-cloudy-symbolic",
                    main: utils_1._("Fair"),
                    description: utils_1._("Fair"),
                    icons: (isNight) ? ["weather-few-clouds-night", "weather-clouds-night", "weather-overcast"] : ["weather-few-clouds", "weather-clouds", "weather-overcast"]
                };
            case "fog":
                return {
                    customIcon: "fog-symbolic",
                    main: utils_1._("Fog"),
                    description: utils_1._("Fog"),
                    icons: ["weather-fog", "weather-severe-alert"]
                };
            case "heavyrain":
                return {
                    customIcon: "rain-symbolic",
                    main: utils_1._("Heavy rain"),
                    description: utils_1._("Heavy rain"),
                    icons: ["weather-rain", "weather-freezing-rain"]
                };
            case "heavyrainandthunder":
                return {
                    customIcon: "thunderstorm-symbolic",
                    main: utils_1._("Heavy rain"),
                    description: utils_1._("Heavy rain and thunder"),
                    icons: ["weather-rain", "weather-freezing-rain"]
                };
            case "heavyrainshowers":
                return {
                    customIcon: (isNight) ? "night-alt-rain-symbolic" : "day-rain-symbolic",
                    main: utils_1._("Heavy rain"),
                    description: utils_1._("Heavy rain showers"),
                    icons: ["weather-showers", "weather-showers-scattered"]
                };
            case "heavyrainshowersandthunder":
                return {
                    customIcon: (utils_1.IsNight) ? "night-alt-thunderstorm-symbolic" : "day-thunderstorm-symbolic",
                    main: utils_1._("Heavy rain"),
                    description: utils_1._("Heavy rain showers and thunder"),
                    icons: ["weather-showers", "weather-showers-scattered"]
                };
            case "heavysleet":
                return {
                    customIcon: "sleet-symbolic",
                    main: utils_1._("Heavy sleet"),
                    description: utils_1._("Heavy sleet"),
                    icons: ["weather-freezing-rain", "weather-rain"]
                };
            case "heavysleetandthunder":
                return {
                    customIcon: "sleet-storm-symbolic",
                    main: utils_1._("Heavy sleet"),
                    description: utils_1._("Heavy sleet and thunder"),
                    icons: ["weather-freezing-rain", "weather-rain"]
                };
            case "heavysleetshowers":
                return {
                    customIcon: (isNight) ? "night-alt-sleet-symbolic" : "day-sleet-symbolic",
                    main: utils_1._("Heavy sleet"),
                    description: utils_1._("Heavy sleet showers"),
                    icons: ["weather-showers", "weather-showers-scattered", "weather-freezing-rain"]
                };
            case "heavysleetshowersandthunder":
                return {
                    customIcon: (utils_1.IsNight) ? "night-alt-sleet-storm-symbolic" : "day-sleet-storm-symbolic",
                    main: utils_1._("Heavy sleet"),
                    description: utils_1._("Heavy sleet showers and thunder"),
                    icons: ["weather-showers", "weather-showers-scattered", "weather-freezing-rain"]
                };
            case "heavysnow":
                return {
                    customIcon: "snow-symbolic",
                    main: utils_1._("Heavy snow"),
                    description: utils_1._("Heavy snow"),
                    icons: ["weather-snow"]
                };
            case "heavysnowandthunder":
                return {
                    customIcon: "snow-symbolic",
                    main: utils_1._("Heavy snow"),
                    description: utils_1._("Heavy snow and thunder"),
                    icons: ["weather-snow"]
                };
            case "heavysnowshowers":
                return {
                    customIcon: (isNight) ? "night-alt-snow-symbolic" : "day-snow-symbolic",
                    main: utils_1._("Heavy snow"),
                    description: utils_1._("Heavy snow showers"),
                    icons: ["weather-snow-scattered", "weather-snow"]
                };
            case "heavysnowshowersandthunder":
                return {
                    customIcon: (isNight) ? "night-alt-snow-thunderstorm-symbolic" : "day-snow-thunderstorm-symbolic",
                    main: utils_1._("Heavy snow"),
                    description: utils_1._("Heavy snow showers and thunder"),
                    icons: ["weather-snow-scattered", "weather-snow"]
                };
            case "lightrain":
                return {
                    customIcon: "rain-mix-symbolic",
                    main: utils_1._("Light rain"),
                    description: utils_1._("Light rain"),
                    icons: ["weather-showers-scattered", "weather-rain"]
                };
            case "lightrainandthunder":
                return {
                    customIcon: "rain-mix-storm-symbolic",
                    main: utils_1._("Light rain"),
                    description: utils_1._("Light rain and thunder"),
                    icons: ["weather-showers-scattered", "weather-rain"]
                };
            case "lightrainshowers":
                return {
                    customIcon: (isNight) ? "night-alt-rain-mix-symbolic" : "day-rain-mix-symbolic",
                    main: utils_1._("Light rain"),
                    description: utils_1._("Light rain showers"),
                    icons: ["weather-showers-scattered", "weather-rain"]
                };
            case "lightrainshowersandthunder":
                return {
                    customIcon: (isNight) ? "night-alt-rain-mix-storm-symbolic" : "day-rain-mix-storm-symbolic",
                    main: utils_1._("Light rain"),
                    description: utils_1._("Light rain showers and thunder"),
                    icons: ["weather-showers-scattered", "weather-rain"]
                };
            case "lightsleet":
                return {
                    customIcon: "sleet-symbolic",
                    main: utils_1._("Light sleet"),
                    description: utils_1._("Light sleet"),
                    icons: ["weather-freezing-rain", "weather-showers"]
                };
            case "lightsleetandthunder":
                return {
                    customIcon: "sleet-storm-symbolic",
                    main: utils_1._("Light sleet"),
                    description: utils_1._("Light sleet and thunder"),
                    icons: ["weather-freezing-rain", "weather-showers"]
                };
            case "lightsleetshowers":
                return {
                    customIcon: (utils_1.IsNight) ? "night-alt-sleet-symbolic" : "day-sleet-symbolic",
                    main: utils_1._("Light sleet"),
                    description: utils_1._("Light sleet showers"),
                    icons: ["weather-freezing-rain", "weather-showers"]
                };
            case "lightssleetshowersandthunder":
                return {
                    customIcon: (utils_1.IsNight) ? "night-alt-sleet-storm-symbolic" : "day-sleet-storm-symbolic",
                    main: utils_1._("Light sleet"),
                    description: utils_1._("Light sleet showers and thunder"),
                    icons: ["weather-freezing-rain", "weather-showers"]
                };
            case "lightsnow":
                return {
                    customIcon: "snow-symbolic",
                    main: utils_1._("Light snow"),
                    description: utils_1._("Light snow"),
                    icons: ["weather-snow"]
                };
            case "lightsnowandthunder":
                return {
                    customIcon: "snow-storm-symbolic",
                    main: utils_1._("Light snow"),
                    description: utils_1._("Light snow and thunder"),
                    icons: ["weather-snow"]
                };
            case "lightsnowshowers":
                return {
                    customIcon: (isNight) ? "night-alt-snow-symbolic" : "day-snow-symbolic",
                    main: utils_1._("Light snow"),
                    description: utils_1._("Light snow showers"),
                    icons: ["weather-snow-scattered", "weather-snow"]
                };
            case "lightssnowshowersandthunder":
                return {
                    customIcon: (isNight) ? "night-alt-snow-thunderstorm-symbolic" : "day-snow-thunderstorm-symbolic",
                    main: utils_1._("Light snow"),
                    description: utils_1._("Light snow showers and thunder"),
                    icons: ["weather-snow-scattered", "weather-snow"]
                };
            case "partlycloudy":
                return {
                    customIcon: (isNight) ? "night-alt-cloudy-symbolic" : "day-cloudy-symbolic",
                    main: utils_1._("Partly cloudy"),
                    description: utils_1._("Partly cloudy"),
                    icons: (isNight) ? ["weather-clouds-night", "weather-few-clouds-night", "weather-overcast"] : ["weather-clouds", "weather-few-clouds", "weather-overcast"]
                };
            case "rain":
                return {
                    customIcon: "rain-symbolic",
                    main: utils_1._("Rain"),
                    description: utils_1._("Rain"),
                    icons: ["weather-rain", "weather-freezing-rain", "weather-showers-scattered"]
                };
            case "rainandthunder":
                return {
                    customIcon: "thunderstorm-symbolic",
                    main: utils_1._("Rain"),
                    description: utils_1._("Rain and thunder"),
                    icons: ["weather-storm", "weather-rain", "weather-freezing-rain", "weather-showers-scattered"]
                };
            case "rainshowers":
                return {
                    customIcon: (isNight) ? "night-alt-rain-mix-symbolic" : "day-rain-mix-symbolic",
                    main: utils_1._("Rain showers"),
                    description: utils_1._("Rain showers"),
                    icons: ["weather-showers-scattered", "weather-rain", "weather-freezing-rain"]
                };
            case "rainshowersandthunder":
                return {
                    customIcon: (isNight) ? "night-alt-rain-mix-storm-symbolic" : "day-rain-mix-storm-symbolic",
                    main: utils_1._("Rain showers"),
                    description: utils_1._("Rain showers and thunder"),
                    icons: ["weather-showers-scattered", "weather-rain", "weather-freezing-rain"]
                };
            case "sleet":
                return {
                    customIcon: "sleet-symbolic",
                    main: utils_1._("Sleet"),
                    description: utils_1._("Sleet"),
                    icons: ["weather-freezing-rain", "weather-showers"]
                };
            case "sleetandthunder":
                return {
                    customIcon: "sleet-storm-symbolic",
                    main: utils_1._("Sleet"),
                    description: utils_1._("Sleet and thunder"),
                    icons: ["weather-freezing-rain", "weather-showers"]
                };
            case "sleetshowers":
                return {
                    customIcon: (isNight) ? "night-alt-sleet-symbolic" : "day-sleet-symbolic",
                    main: utils_1._("Sleet"),
                    description: utils_1._("Sleet showers"),
                    icons: ["weather-freezing-rain", "weather-showers"]
                };
            case "sleetshowersandthunder":
                return {
                    customIcon: (isNight) ? "night-alt-sleet-storm-symbolic" : "day-sleet-storm-symbolic",
                    main: utils_1._("Sleet"),
                    description: utils_1._("Sleet showers and thunder"),
                    icons: ["weather-freezing-rain", "weather-showers"]
                };
            case "snow":
                return {
                    customIcon: "snow-symbolic",
                    main: utils_1._("Snow"),
                    description: utils_1._("Snow"),
                    icons: ["weather-snow"]
                };
            case "snowandthunder":
                return {
                    customIcon: "snow-storm-symbolic",
                    main: utils_1._("Snow"),
                    description: utils_1._("Snow and thunder"),
                    icons: ["weather-snow"]
                };
            case "snowshowers":
                return {
                    customIcon: (isNight) ? "night-alt-snow-symbolic" : "day-snow-symbolic",
                    main: utils_1._("Snow showers"),
                    description: utils_1._("Snow showers"),
                    icons: ["weather-snow-scattered", "weather-snow"]
                };
            case "snowshowersandthunder":
                return {
                    customIcon: (isNight) ? "night-alt-snow-thunderstorm-symbolic" : "day-snow-thunderstorm-symbolic",
                    main: utils_1._("Snow showers"),
                    description: utils_1._("Snow showers and thunder"),
                    icons: ["weather-snow-scattered", "weather-snow"]
                };
            default:
                logger_1.Log.Instance.Error("condition code not found: " + weather.condition);
                return {
                    customIcon: "cloud-refresh-symbolic",
                    main: utils_1._("Unknown"),
                    description: utils_1._("Unknown"),
                    icons: ["weather-severe-alert"]
                };
        }
    }
}
exports.MetNorway = MetNorway;
const conditionSeverity = {
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
