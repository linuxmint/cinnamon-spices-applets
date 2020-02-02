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
var isCoordinate = utils.isCoordinate;
var icons = utils.icons;
var weatherIconSafely = utils.weatherIconSafely;
var CelsiusToKelvin = utils.CelsiusToKelvin;
var SunCalc = importModule("sunCalc").SunCalc;
class MetNorway {
    constructor(app) {
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
        let forecasts = this.BuildForecasts(parsed6hourly);
        let weather = this.BuildWeather(this.GetEarliestDataForToday(parsedWeathers), this.GetEarliestDataForToday(parsedHourly));
        weather.forecasts = forecasts;
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
            condition: this.ResolveCondition(hourly.symbol, true),
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
                    customIcon: "Cloud",
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
            from: from,
            to: to,
            symbol: element.symbol["id"],
            symbolID: element.symbol["number"],
            altitude: parseInt(element.altitude)
        };
    }
    GetUrl() {
        let location = this.app._location.replace(" ", "");
        let url = this.baseUrl + "lat=";
        if (!isCoordinate(location))
            return "";
        let latLon = location.split(",");
        url += (latLon[0] + "&lon=" + latLon[1]);
        return url;
    }
    IsNight() {
        if (!this.sunTimes)
            return false;
        let now = new Date();
        if (now < this.sunTimes.sunrise || now > this.sunTimes.sunset)
            return true;
        return false;
    }
    ResolveCondition(icon, checkIfNight) {
        let condition = icon.replace("Dark_", "");
        switch (condition) {
            case "Cloud":
                return {
                    customIcon: "Cloud",
                    main: _("Cloudy"),
                    description: _("Cloudy"),
                    icon: weatherIconSafely([icons.overcast, icons.clouds, icons.few_clouds_day], this.app._icon_type)
                };
            case "Drizzle":
                return {
                    customIcon: "Cloud-Drizzle",
                    main: _("Drizzle"),
                    description: _("Drizzle"),
                    icon: weatherIconSafely([icons.rain, icons.showers_scattered, icons.rain_freezing, icons.alert], this.app._icon_type)
                };
            case "DrizzleSun":
                return {
                    customIcon: (checkIfNight && this.IsNight()) ? "Cloud-Drizzle-Moon" : "Cloud-Drizzle-Sun",
                    main: _("Drizzle"),
                    description: _("Drizzle"),
                    icon: weatherIconSafely([icons.showers_scattered, icons.rain_freezing, icons.alert], this.app._icon_type)
                };
            case "DrizzleThunder":
                return {
                    customIcon: "Cloud-Drizzle",
                    main: _("Drizzle"),
                    description: _("Drizzle with Thunderstorms"),
                    icon: weatherIconSafely([icons.showers_scattered, icons.rain_freezing, icons.alert], this.app._icon_type)
                };
            case "DrizzleThunderSun":
                return {
                    customIcon: "Cloud-Drizzle",
                    main: _("Mostly Drizzle"),
                    description: _("Mostly Drizzle with Thunderstorms"),
                    icon: weatherIconSafely([icons.rain, icons.showers_scattered, icons.rain_freezing, icons.alert], this.app._icon_type)
                };
            case "Fog":
                return {
                    customIcon: "Cloud-Fog",
                    main: _("Fog"),
                    description: _("Fog"),
                    icon: weatherIconSafely([icons.fog, icons.alert], this.app._icon_type)
                };
            case "HeavySleet":
                return {
                    customIcon: "Cloud-Hail",
                    main: _("Heavy Sleet"),
                    description: _("Heavy Sleet"),
                    icon: weatherIconSafely([icons.rain_freezing, icons.rain, icons.alert], this.app._icon_type)
                };
            case "HeavySleetSun":
                return {
                    customIcon: (checkIfNight && this.IsNight()) ? "Cloud-Hail-Moon" : "Cloud-Hail-Sun",
                    main: _("Heavy Sleet"),
                    description: _("Mostly Heavy Sleet"),
                    icon: weatherIconSafely([icons.rain_freezing, icons.rain, icons.alert], this.app._icon_type)
                };
            case "HeavySleetThunder":
                return {
                    customIcon: "Cloud-Hail",
                    main: _("Heavy Sleet"),
                    description: _("Heavy Sleet with Thunderstorms"),
                    icon: weatherIconSafely([icons.rain_freezing, icons.rain, icons.alert], this.app._icon_type)
                };
            case "HeavySleetThunderSun":
                return {
                    customIcon: (checkIfNight && this.IsNight()) ? "Cloud-Hail-Moon" : "Cloud-Hail-Sun",
                    main: _("Heavy Sleet"),
                    description: _("Mostly Heavy Sleet with Thunderstorms"),
                    icon: weatherIconSafely([icons.rain_freezing, icons.rain, icons.alert], this.app._icon_type)
                };
            case "HeavySnow":
                return {
                    customIcon: "Cloud-Snow",
                    main: _("Heavy Snow"),
                    description: _("Heavy Snow"),
                    icon: weatherIconSafely([icons.snow, icons.alert], this.app._icon_type)
                };
            case "HeavySnowThunder":
                return {
                    customIcon: "Cloud-Snow",
                    main: _("Heavy Snow"),
                    description: _("Heavy Snow with Thunderstorms"),
                    icon: weatherIconSafely([icons.snow, icons.alert], this.app._icon_type)
                };
            case "HeavySnowThunderSun":
                return {
                    customIcon: (checkIfNight && this.IsNight()) ? "Cloud-Snow-Moon" : "Cloud-Snow-Sun",
                    main: _("Heavy Snow"),
                    description: _("Heavy Snow with Thunderstorm"),
                    icon: weatherIconSafely([icons.snow, icons.alert], this.app._icon_type)
                };
            case "HeavysnowSun":
                return {
                    customIcon: (checkIfNight && this.IsNight()) ? "Cloud-Snow-Moon" : "Cloud-Snow-Sun",
                    main: _("Heavy Snow"),
                    description: _("Heavy Snow"),
                    icon: weatherIconSafely([icons.snow, icons.alert], this.app._icon_type)
                };
            case "LightCloud":
                return {
                    customIcon: (checkIfNight && this.IsNight()) ? "Cloud-Moon" : "Cloud-Sun",
                    main: _("Few Clouds"),
                    description: _("Few Clouds"),
                    icon: weatherIconSafely((checkIfNight && this.IsNight()) ? [icons.few_clouds_night, icons.alert] : [icons.few_clouds_day, icons.alert], this.app._icon_type)
                };
            case "LightRain":
                return {
                    customIcon: (checkIfNight && this.IsNight()) ? "Cloud-Rain-Moon" : "Cloud-Rain-Sun",
                    main: _("Light Rain"),
                    description: _("Light Rain"),
                    icon: weatherIconSafely([icons.showers_scattered, icons.rain, icons.alert], this.app._icon_type)
                };
            case "LightRainSun":
                return {
                    customIcon: (checkIfNight && this.IsNight()) ? "Cloud-Rain-Moon" : "Cloud-Rain-Sun",
                    main: _("Light Rain"),
                    description: _("Light Rain"),
                    icon: weatherIconSafely([icons.showers_scattered, icons.rain, icons.alert], this.app._icon_type)
                };
            case "LightRainThunder":
                return {
                    customIcon: "Cloud-Rain",
                    main: _("Light Rain"),
                    description: _("Light Rain with Thunderstorms"),
                    icon: weatherIconSafely([icons.showers_scattered, icons.rain, icons.alert], this.app._icon_type)
                };
            case "LightRainThunderSun":
                return {
                    customIcon: (checkIfNight && this.IsNight()) ? "Cloud-Rain-Moon" : "Cloud-Rain-Sun",
                    main: _("Light Rain"),
                    description: _("Mostly Ligh Rain with Thunderstorms"),
                    icon: weatherIconSafely([icons.showers_scattered, icons.rain, icons.alert], this.app._icon_type)
                };
            case "LightSleet":
                return {
                    customIcon: "Cloud-Hail",
                    main: _("Light Sleet"),
                    description: _("Light Sleet"),
                    icon: weatherIconSafely([icons.rain_freezing, icons.showers, icons.alert], this.app._icon_type)
                };
            case "LightSleetSun":
                return {
                    customIcon: (checkIfNight && this.IsNight()) ? "Cloud-Hail-Moon" : "Cloud-Hail-Sun",
                    main: _("Light Sleet"),
                    description: _("Mostly Light Sleet"),
                    icon: weatherIconSafely([icons.rain_freezing, icons.showers, icons.alert], this.app._icon_type)
                };
            case "LightSleetThunder":
                return {
                    customIcon: "Cloud-Hail",
                    main: _("Light Sleet"),
                    description: _("Light Sleet with Thunderstorms"),
                    icon: weatherIconSafely([icons.rain_freezing, icons.showers, icons.alert], this.app._icon_type)
                };
            case "LightSleetThunderSun":
                return {
                    customIcon: (checkIfNight && this.IsNight()) ? "Cloud-Hail-Moon" : "Cloud-Hail-Sun",
                    main: _("Light Sleet"),
                    description: _("Mostly Light Sleet with Thunderstorms"),
                    icon: weatherIconSafely([icons.rain_freezing, icons.showers, icons.alert], this.app._icon_type)
                };
            case "LightSnow":
                return {
                    customIcon: "Cloud-Snow",
                    main: _("Light Snow"),
                    description: _("Light Snow"),
                    icon: weatherIconSafely([icons.snow, icons.alert], this.app._icon_type)
                };
            case "LightSnowSun":
                return {
                    customIcon: (checkIfNight && this.IsNight()) ? "Cloud-Snow-Moon" : "Cloud-Snow-Sun",
                    main: _("Light Snow"),
                    description: _("Mostly Light Snow"),
                    icon: weatherIconSafely([icons.snow, icons.alert], this.app._icon_type)
                };
            case "LightSnowThunder":
                return {
                    customIcon: "Cloud-Snow",
                    main: _("Light Snow"),
                    description: _("Light Snow with Thunderstorms"),
                    icon: weatherIconSafely([icons.snow, icons.alert], this.app._icon_type)
                };
            case "LightSnowThunderSun":
                return {
                    customIcon: (checkIfNight && this.IsNight()) ? "Cloud-Snow-Moon" : "Cloud-Snow-Sun",
                    main: _("Light Snow"),
                    description: _("Mostly Light Snow with Thunderstorms"),
                    icon: weatherIconSafely([icons.snow, icons.alert], this.app._icon_type)
                };
            case "PartlyCloud":
                return {
                    customIcon: (checkIfNight && this.IsNight()) ? "Cloud-Moon" : "Cloud-Sun",
                    main: _("Partly Cloudy"),
                    description: _("Partly Cloudy"),
                    icon: weatherIconSafely((checkIfNight && this.IsNight()) ? [icons.few_clouds_night, icons.clouds, icons.overcast, icons.alert] : [icons.few_clouds_day, icons.clouds, icons.overcast, icons.alert], this.app._icon_type)
                };
            case "Rain":
                return {
                    customIcon: "Cloud-Rain",
                    main: _("Rain"),
                    description: _("Rain"),
                    icon: weatherIconSafely([icons.rain, icons.rain_freezing, icons.alert], this.app._icon_type)
                };
            case "RainSun":
                return {
                    customIcon: (checkIfNight && this.IsNight()) ? "Cloud-Rain-Moon" : "Cloud-Rain-Sun",
                    main: _("Mostly Rainy"),
                    description: _("Mostly Rainy"),
                    icon: weatherIconSafely([icons.rain, icons.rain_freezing, icons.alert], this.app._icon_type)
                };
            case "RainThunder":
                return {
                    customIcon: "Cloud-Lightning",
                    main: _("Rain"),
                    description: _("Rain with Thunderstorms"),
                    icon: weatherIconSafely([icons.storm, icons.rain, icons.rain_freezing, icons.alert], this.app._icon_type)
                };
            case "RainThunderSun":
                return {
                    customIcon: (checkIfNight && this.IsNight()) ? "Cloud-Lightning-Moon" : "Cloud-Lightning-Sun",
                    main: _("Rain"),
                    description: _("Mostly Rainy with Thunderstorms"),
                    icon: weatherIconSafely([icons.storm, icons.rain, icons.rain_freezing, icons.alert], this.app._icon_type)
                };
            case "Sleet":
                return {
                    customIcon: "Cloud-Hail",
                    main: _("Sleet"),
                    description: _("Sleet"),
                    icon: weatherIconSafely([icons.rain_freezing, icons.showers, icons.alert], this.app._icon_type)
                };
            case "SleetSun":
                return {
                    customIcon: (checkIfNight && this.IsNight()) ? "Cloud-Hail-Moon" : "Cloud-Hail-Sun",
                    main: _("Sleet"),
                    description: _("Mostly Sleet"),
                    icon: weatherIconSafely([icons.rain_freezing, icons.showers, icons.alert], this.app._icon_type)
                };
            case "SleetSunThunder":
                return {
                    customIcon: (checkIfNight && this.IsNight()) ? "Cloud-Hail-Moon" : "Cloud-Hail-Sun",
                    main: _("Sleet"),
                    description: _("Mostly Sleet with Thunderstorms"),
                    icon: weatherIconSafely([icons.rain_freezing, icons.showers, icons.alert], this.app._icon_type)
                };
            case "SleetThunder":
                return {
                    customIcon: "Cloud-Hail",
                    main: _("Sleet"),
                    description: _("Sleet with Thunderstorms"),
                    icon: weatherIconSafely([icons.rain_freezing, icons.showers, icons.alert], this.app._icon_type)
                };
            case "Snow":
                return {
                    customIcon: "Cloud-Snow",
                    main: _("Snow"),
                    description: _("Snowy"),
                    icon: weatherIconSafely([icons.snow, icons.alert], this.app._icon_type)
                };
            case "SnowSun":
                return {
                    customIcon: (checkIfNight && this.IsNight()) ? "Cloud-Snow-Moon" : "Cloud-Snow-Sun",
                    main: _("Mostly Snowy"),
                    description: _("Mostly Snowy"),
                    icon: weatherIconSafely([icons.snow, icons.alert], this.app._icon_type)
                };
            case "SnowSunThunder":
                return {
                    customIcon: (checkIfNight && this.IsNight()) ? "Cloud-Snow-Moon" : "Cloud-Snow-Sun",
                    main: _("Mostly Snowy"),
                    description: _("Mostly Snowy with Thunder"),
                    icon: weatherIconSafely([icons.snow, icons.alert], this.app._icon_type)
                };
            case "SnowThunder":
                return {
                    customIcon: "Cloud-Snow",
                    main: _("Snow"),
                    description: _("Snowy with Thunder"),
                    icon: weatherIconSafely([icons.snow, icons.alert], this.app._icon_type)
                };
            case "Sun":
                return {
                    customIcon: (checkIfNight && this.IsNight()) ? "Moon" : "Sun",
                    main: _("Clear"),
                    description: _("Clear"),
                    icon: weatherIconSafely((checkIfNight && this.IsNight()) ? [icons.clear_night, icons.alert] : [icons.clear_day, icons.alert], this.app._icon_type)
                };
        }
    }
}
