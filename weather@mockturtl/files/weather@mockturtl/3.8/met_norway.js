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
var CelsiusToKelvin = utils.CelsiusToKelvin;
var SunCalc = importModule("sunCalc").SunCalc;
var IsNight = utils.IsNight;
class MetNorway {
    constructor(app) {
        this.prettyName = "MET Norway";
        this.name = "MetNorway";
        this.maxForecastSupport = 10;
        this.website = "https://www.met.no/en";
        this.maxHourlyForecastSupport = 72;
        this.baseUrl = "https://api.met.no/weatherapi/locationforecast/1.9/.json?";
        this.ctx = this;
        this.app = app;
        this.sunCalc = new SunCalc();
    }
    async GetWeather() {
        let query = this.GetUrl();
        let json;
        if (query != "" && query != null) {
            this.app.log.Debug("MET Norway API query: " + query);
            try {
                json = await this.app.LoadAsync(query);
            }
            catch (e) {
                this.app.HandleHTTPError("met-norway", e, this.app);
                this.app.log.Error("MET Norway: Network error - " + e);
                return null;
            }
            if (!json) {
                this.app.HandleError({ type: "soft", detail: "no api response", service: "met-norway" });
                this.app.log.Error("MET Norway: Empty response from API");
                return null;
            }
            try {
                json = JSON.parse(json);
            }
            catch (e) {
                this.app.HandleError({ type: "soft", detail: "unusal payload", service: "met-norway" });
                this.app.log.Error("MET Norway: Payload is not JSON, aborting.");
                return null;
            }
            return await this.ParseWeather(json);
        }
        return null;
    }
    async ParseWeather(json) {
        json = json.product.time;
        let parsedWeathers = [];
        let parsed6hourly = [];
        let parsedHourly = [];
        for (let i = 0; i < json.length; i++) {
            const element = json[i];
            let fromDate = new Date(element["from"]);
            let toDate = new Date(element["to"]);
            let item = element.location;
            let temp = item.temperature;
            let minTemp = item.minTemperature;
            let symbol = item.symbol;
            if (!!temp) {
                parsedWeathers.push(this.ParseCurrentWeather(item, fromDate, toDate));
            }
            else if (!!minTemp && !!symbol) {
                parsed6hourly.push(this.Parse6HourForecast(item, fromDate, toDate));
            }
            else if (!minTemp && !!symbol) {
                parsedHourly.push(this.ParseHourlyForecast(item, fromDate, toDate));
            }
        }
        let weather = this.BuildWeather(this.GetEarliestDataForToday(parsedWeathers), this.GetEarliestDataForToday(parsedHourly));
        weather.hourlyForecasts = this.BuildHourlyForecasts(parsedHourly, parsedWeathers);
        weather.forecasts = this.BuildForecasts(parsed6hourly);
        return weather;
    }
    BuildWeather(weather, hourly) {
        let times = this.sunCalc.getTimes(new Date(), weather.lat, weather.lon, hourly.altitude);
        this.sunTimes = times;
        let result = {
            temperature: CelsiusToKelvin(weather.temperature),
            coord: {
                lat: weather.lat,
                lon: weather.lon
            },
            date: weather.from,
            condition: this.ResolveCondition(hourly.symbol, IsNight(times)),
            humidity: weather.humidity,
            pressure: weather.pressure,
            extra_field: {
                name: _("Cloudiness"),
                type: "percent",
                value: weather.cloudiness
            },
            sunrise: times.sunrise,
            sunset: times.sunset,
            wind: {
                degree: weather.windDirection,
                speed: weather.windSpeed
            },
            location: {
                url: null,
            },
            forecasts: []
        };
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
                    icon: "weather-severe-alert",
                    main: ""
                },
                date: null,
                temp_max: Number.NEGATIVE_INFINITY,
                temp_min: Number.POSITIVE_INFINITY
            };
            let conditionCounter = {};
            for (let j = 0; j < days[i].length; j++) {
                const element = days[i][j];
                forecast.date = element.from;
                if (element.maxTemperature > forecast.temp_max)
                    forecast.temp_max = element.maxTemperature;
                if (element.minTemperature < forecast.temp_min)
                    forecast.temp_min = element.minTemperature;
                if (!conditionCounter[element.symbolID])
                    conditionCounter[element.symbolID] = { count: 0, name: element.symbol };
                conditionCounter[element.symbolID].count = conditionCounter[element.symbolID].count + 1;
            }
            forecast.temp_max = CelsiusToKelvin(forecast.temp_max);
            forecast.temp_min = CelsiusToKelvin(forecast.temp_min);
            forecast.condition = this.ResolveCondition(this.GetMostSevereCondition(conditionCounter));
            forecasts.push(forecast);
        }
        return forecasts;
    }
    BuildHourlyForecasts(hours, current) {
        let forecasts = [];
        for (let i = 0; i < hours.length; i++) {
            const hour = hours[i];
            let forecast = {
                condition: this.ResolveCondition(hour.symbol, IsNight(this.sunTimes, hour.from)),
                date: hour.from,
                temp: CelsiusToKelvin(current[i].temperature),
            };
            if (!!hour.precipitation) {
                forecast.precipation = {
                    type: "rain",
                    volume: hour.precipitation
                };
            }
            forecasts.push(forecast);
        }
        return forecasts;
    }
    GetEarliestDataForToday(events) {
        let earliest = 0;
        for (let i = 0; i < events.length; i++) {
            const element = events[i];
            const earliestElement = events[earliest];
            if (element.from.toDateString() != new Date().toDateString())
                continue;
            if (earliestElement.from < element.from)
                continue;
            earliest = i;
        }
        return events[earliest];
    }
    SortDataByDay(data) {
        let days = [];
        let currentDay = this.GetEarliestDataForToday(data).from;
        let dayIndex = 0;
        days.push([]);
        for (let i = 0; i < data.length; i++) {
            const element = data[i];
            if (element.from.toDateString() == currentDay.toDateString()) {
                days[dayIndex].push(element);
            }
            else if (element.from.toDateString() != currentDay.toDateString()) {
                dayIndex++;
                currentDay = element.from;
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
        let condition = count[result].name.replace("Dark_", "");
        return condition;
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
    ParseCurrentWeather(element, from, to) {
        return {
            temperature: parseFloat(element.temperature['value']),
            lat: element["latitude"],
            lon: element["longitude"],
            windDirection: parseFloat(element.windDirection["deg"]),
            windSpeed: parseFloat(element.windSpeed["mps"]),
            humidity: parseFloat(element.humidity["value"]),
            pressure: parseFloat(element.pressure["value"]),
            cloudiness: parseFloat(element.cloudiness["percent"]),
            from: from,
            to: to
        };
    }
    Parse6HourForecast(element, from, to) {
        return {
            minTemperature: parseFloat(element.minTemperature["value"]),
            maxTemperature: parseFloat(element.maxTemperature["value"]),
            from: from,
            to: to,
            altitude: parseInt(element.altitude),
            symbol: element.symbol["id"],
            symbolID: element.symbol["number"]
        };
    }
    ParseHourlyForecast(element, from, to) {
        return {
            precipitation: parseFloat(element.precipitation["value"]),
            from: from,
            to: to,
            symbol: element.symbol["id"],
            symbolID: element.symbol["number"],
            altitude: parseInt(element.altitude)
        };
    }
    GetUrl() {
        let location = this.app.config._location.replace(" ", "");
        let url = this.baseUrl + "lat=";
        if (!isCoordinate(location))
            return "";
        let latLon = location.split(",");
        url += (latLon[0] + "&lon=" + latLon[1]);
        return url;
    }
    ResolveCondition(icon, isNight = false) {
        let condition = icon.replace("Dark_", "");
        let iconType = this.app.config.IconType();
        switch (condition) {
            case "Cloud":
                return {
                    customIcon: "cloudy-symbolic",
                    main: _("Cloudy"),
                    description: _("Cloudy"),
                    icon: weatherIconSafely(["weather-overcast", "weather-clouds", "weather-few-clouds"], iconType)
                };
            case "Drizzle":
                return {
                    customIcon: "showers-symbolic",
                    main: _("Drizzle"),
                    description: _("Drizzle"),
                    icon: weatherIconSafely(["weather-rain", "weather-showers-scattered", "weather-freezing-rain", "weather-severe-alert"], iconType)
                };
            case "DrizzleSun":
                return {
                    customIcon: (isNight) ? "night-showers-symbolic" : "day-showers-symbolic",
                    main: _("Drizzle"),
                    description: _("Drizzle"),
                    icon: weatherIconSafely(["weather-showers-scattered", "weather-freezing-rain", "weather-severe-alert"], iconType)
                };
            case "DrizzleThunder":
                return {
                    customIcon: "storm-showers-symbolic",
                    main: _("Drizzle"),
                    description: _("Drizzle with Thunderstorms"),
                    icon: weatherIconSafely(["weather-showers-scattered", "weather-freezing-rain", "weather-severe-alert"], iconType)
                };
            case "DrizzleThunderSun":
                return {
                    customIcon: "day-storm-showers-symbolic",
                    main: _("Mostly Drizzle"),
                    description: _("Mostly Drizzle with Thunderstorms"),
                    icon: weatherIconSafely(["weather-rain", "weather-showers-scattered", "weather-freezing-rain", "weather-severe-alert"], iconType)
                };
            case "Fog":
                return {
                    customIcon: "fog-symbolic",
                    main: _("Fog"),
                    description: _("Fog"),
                    icon: weatherIconSafely(["weather-fog", "weather-severe-alert"], iconType)
                };
            case "HeavySleet":
                return {
                    customIcon: "sleet-symbolic",
                    main: _("Heavy Sleet"),
                    description: _("Heavy Sleet"),
                    icon: weatherIconSafely(["weather-freezing-rain", "weather-rain", "weather-severe-alert"], iconType)
                };
            case "HeavySleetSun":
                return {
                    customIcon: (isNight) ? "night-sleet-symbolic" : "day-sleet-symbolic",
                    main: _("Heavy Sleet"),
                    description: _("Mostly Heavy Sleet"),
                    icon: weatherIconSafely(["weather-freezing-rain", "weather-rain", "weather-severe-alert"], iconType)
                };
            case "HeavySleetThunder":
                return {
                    customIcon: "sleet-storm-symbolic",
                    main: _("Heavy Sleet"),
                    description: _("Heavy Sleet with Thunderstorms"),
                    icon: weatherIconSafely(["weather-freezing-rain", "weather-rain", "weather-severe-alert"], iconType)
                };
            case "HeavySleetThunderSun":
                return {
                    customIcon: (isNight) ? "night-sleet-storm-symbolic" : "day-sleet-storm-symbolic",
                    main: _("Heavy Sleet"),
                    description: _("Mostly Heavy Sleet with Thunderstorms"),
                    icon: weatherIconSafely(["weather-freezing-rain", "weather-rain", "weather-severe-alert"], iconType)
                };
            case "HeavySnow":
                return {
                    customIcon: "snow-symbolic",
                    main: _("Heavy Snow"),
                    description: _("Heavy Snow"),
                    icon: weatherIconSafely(["weather-snow", "weather-severe-alert"], iconType)
                };
            case "HeavySnowThunder":
                return {
                    customIcon: "snow-symbolic",
                    main: _("Heavy Snow"),
                    description: _("Heavy Snow with Thunderstorms"),
                    icon: weatherIconSafely(["weather-snow", "weather-severe-alert"], iconType)
                };
            case "HeavySnowThunderSun":
                return {
                    customIcon: (isNight) ? "night-snow-thunderstorm-symbolic" : "day-snow-thunderstorm-symbolic",
                    main: _("Heavy Snow"),
                    description: _("Heavy Snow with Thunderstorms"),
                    icon: weatherIconSafely(["weather-snow", "weather-severe-alert"], iconType)
                };
            case "HeavySnowSun":
                return {
                    customIcon: (isNight) ? "night-snow-symbolic" : "day-snow-symbolic",
                    main: _("Heavy Snow"),
                    description: _("Heavy Snow"),
                    icon: weatherIconSafely(["weather-snow", "weather-severe-alert"], iconType)
                };
            case "LightCloud":
                return {
                    customIcon: (isNight) ? "night-cloudy-symbolic" : "day-cloudy-symbolic",
                    main: _("Few Clouds"),
                    description: _("Few Clouds"),
                    icon: weatherIconSafely((isNight) ? ["weather-few-clouds-night", "weather-severe-alert"] : ["weather-few-clouds", "weather-severe-alert"], iconType)
                };
            case "LightRain":
                return {
                    customIcon: (isNight) ? "rain-symbolic" : "rain-symbolic",
                    main: _("Light Rain"),
                    description: _("Light Rain"),
                    icon: weatherIconSafely(["weather-showers-scattered", "weather-rain", "weather-severe-alert"], iconType)
                };
            case "LightRainSun":
                return {
                    customIcon: (isNight) ? "night-rain-symbolic" : "day-rain-symbolic",
                    main: _("Light Rain"),
                    description: _("Light Rain"),
                    icon: weatherIconSafely(["weather-showers-scattered", "weather-rain", "weather-severe-alert"], iconType)
                };
            case "LightRainThunder":
                return {
                    customIcon: "rain-symbolic",
                    main: _("Light Rain"),
                    description: _("Light Rain with Thunderstorms"),
                    icon: weatherIconSafely(["weather-showers-scattered", "weather-rain", "weather-severe-alert"], iconType)
                };
            case "LightRainThunderSun":
                return {
                    customIcon: (isNight) ? "night-rain-symbolic" : "day-rain-symbolic",
                    main: _("Light Rain"),
                    description: _("Mostly Light Rain with Thunderstorms"),
                    icon: weatherIconSafely(["weather-showers-scattered", "weather-rain", "weather-severe-alert"], iconType)
                };
            case "LightSleet":
                return {
                    customIcon: "sleet-symbolic",
                    main: _("Light Sleet"),
                    description: _("Light Sleet"),
                    icon: weatherIconSafely(["weather-freezing-rain", "weather-showers", "weather-severe-alert"], iconType)
                };
            case "LightSleetSun":
                return {
                    customIcon: (isNight) ? "night-sleet-symbolic" : "day-sleet-symbolic",
                    main: _("Light Sleet"),
                    description: _("Mostly Light Sleet"),
                    icon: weatherIconSafely(["weather-freezing-rain", "weather-showers", "weather-severe-alert"], iconType)
                };
            case "LightSleetThunder":
                return {
                    customIcon: "sleet-symbolic",
                    main: _("Light Sleet"),
                    description: _("Light Sleet with Thunderstorms"),
                    icon: weatherIconSafely(["weather-freezing-rain", "weather-showers", "weather-severe-alert"], iconType)
                };
            case "LightSleetThunderSun":
                return {
                    customIcon: (isNight) ? "night-sleet-storm-symbolic" : "day-sleet-storm-symbolic",
                    main: _("Light Sleet"),
                    description: _("Mostly Light Sleet with Thunderstorms"),
                    icon: weatherIconSafely(["weather-freezing-rain", "weather-showers", "weather-severe-alert"], iconType)
                };
            case "LightSnow":
                return {
                    customIcon: "snow-symbolic",
                    main: _("Light Snow"),
                    description: _("Light Snow"),
                    icon: weatherIconSafely(["weather-snow", "weather-severe-alert"], iconType)
                };
            case "LightSnowSun":
                return {
                    customIcon: (isNight) ? "night-snow-symbolic" : "day-snow-symbolic",
                    main: _("Light Snow"),
                    description: _("Mostly Light Snow"),
                    icon: weatherIconSafely(["weather-snow", "weather-severe-alert"], iconType)
                };
            case "LightSnowThunder":
                return {
                    customIcon: "snow-symbolic",
                    main: _("Light Snow"),
                    description: _("Light Snow with Thunderstorms"),
                    icon: weatherIconSafely(["weather-snow", "weather-severe-alert"], iconType)
                };
            case "LightSnowThunderSun":
                return {
                    customIcon: (isNight) ? "night-snow-thunderstorm-symbolic" : "day-snow-thunderstorm-symbolic",
                    main: _("Light Snow"),
                    description: _("Mostly Light Snow with Thunderstorms"),
                    icon: weatherIconSafely(["weather-snow", "weather-severe-alert"], iconType)
                };
            case "PartlyCloud":
                return {
                    customIcon: (isNight) ? "night-cloudy-symbolic" : "day-cloudy-symbolic",
                    main: _("Partly Cloudy"),
                    description: _("Partly Cloudy"),
                    icon: weatherIconSafely((isNight) ? ["weather-few-clouds-night", "weather-clouds", "weather-overcast", "weather-severe-alert"] : ["weather-few-clouds", "weather-clouds", "weather-overcast", "weather-severe-alert"], iconType)
                };
            case "Rain":
                return {
                    customIcon: "rain-symbolic",
                    main: _("Rain"),
                    description: _("Rain"),
                    icon: weatherIconSafely(["weather-rain", "weather-freezing-rain", "weather-showers-scattered", "weather-severe-alert"], iconType)
                };
            case "RainSun":
                return {
                    customIcon: (isNight) ? "night-rain-symbolic" : "day-rain-symbolic",
                    main: _("Mostly Rainy"),
                    description: _("Mostly Rainy"),
                    icon: weatherIconSafely(["weather-rain", "weather-freezing-rain", "weather-showers-scattered", "weather-severe-alert"], iconType)
                };
            case "RainThunder":
                return {
                    customIcon: "thunderstorm-symbolic",
                    main: _("Rain"),
                    description: _("Rain with Thunderstorms"),
                    icon: weatherIconSafely(["weather-storm", "weather-rain", "weather-freezing-rain", "weather-showers-scattered", "weather-severe-alert"], iconType)
                };
            case "RainThunderSun":
                return {
                    customIcon: (isNight) ? "night-thunderstorm-symbolic" : "day-thunderstorm-symbolic",
                    main: _("Rain"),
                    description: _("Mostly Rainy with Thunderstorms"),
                    icon: weatherIconSafely(["weather-storm", "weather-rain", "weather-freezing-rain", "weather-showers-scattered", "weather-severe-alert"], iconType)
                };
            case "Sleet":
                return {
                    customIcon: "sleet-symbolic",
                    main: _("Sleet"),
                    description: _("Sleet"),
                    icon: weatherIconSafely(["weather-freezing-rain", "weather-showers", "weather-severe-alert"], iconType)
                };
            case "SleetSun":
                return {
                    customIcon: (isNight) ? "night-sleet-symbolic" : "day-sleet-symbolic",
                    main: _("Sleet"),
                    description: _("Mostly Sleet"),
                    icon: weatherIconSafely(["weather-freezing-rain", "weather-showers", "weather-severe-alert"], iconType)
                };
            case "SleetSunThunder":
                return {
                    customIcon: (isNight) ? "night-sleet-storm-symbolic" : "day-sleet-storm-symbolic",
                    main: _("Sleet"),
                    description: _("Mostly Sleet with Thunderstorms"),
                    icon: weatherIconSafely(["weather-freezing-rain", "weather-showers", "weather-severe-alert"], iconType)
                };
            case "SleetThunder":
                return {
                    customIcon: "sleet-storm-symbolic",
                    main: _("Sleet"),
                    description: _("Sleet with Thunderstorms"),
                    icon: weatherIconSafely(["weather-freezing-rain", "weather-showers", "weather-severe-alert"], iconType)
                };
            case "Snow":
                return {
                    customIcon: "snow-symbolic",
                    main: _("Snow"),
                    description: _("Snowy"),
                    icon: weatherIconSafely(["weather-snow", "weather-severe-alert"], iconType)
                };
            case "SnowSun":
                return {
                    customIcon: (isNight) ? "night-snow-symbolic" : "day-snow-symbolic",
                    main: _("Mostly Snowy"),
                    description: _("Mostly Snowy"),
                    icon: weatherIconSafely(["weather-snow", "weather-severe-alert"], iconType)
                };
            case "SnowSunThunder":
                return {
                    customIcon: (isNight) ? "night-snow-thunderstorm-symbolic" : "day-snow-thunderstorm-symbolic",
                    main: _("Mostly Snowy"),
                    description: _("Mostly Snowy with Thunderstorms"),
                    icon: weatherIconSafely(["weather-snow", "weather-severe-alert"], iconType)
                };
            case "SnowThunder":
                return {
                    customIcon: "snow-symbolic",
                    main: _("Snow"),
                    description: _("Snowy with Thunderstorms"),
                    icon: weatherIconSafely(["weather-snow", "weather-severe-alert"], iconType)
                };
            case "Sun":
                return {
                    customIcon: (isNight) ? "night-clear-symbolic" : "day-sunny-symbolic",
                    main: _("Clear"),
                    description: _("Clear"),
                    icon: weatherIconSafely((isNight) ? ["weather-clear-night", "weather-severe-alert"] : ["weather-clear", "weather-severe-alert"], iconType)
                };
        }
    }
}
