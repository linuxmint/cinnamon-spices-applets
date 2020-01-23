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
const Marknote = importModule("markNote");
class MetNorway {
    constructor(app) {
        this.baseUrl = "https://api.met.no/weatherapi/locationforecast/1.9/?";
        this.ctx = this;
        this.app = app;
        this.xmlParser = new Marknote.marknote.Parser();
    }
    async GetWeather() {
        let query = this.GetUrl();
        let xml;
        if (query != "" && query != null) {
            this.app.log.Debug("MET Norway API query: " + query);
            try {
                xml = await this.app.LoadAsync(query);
            }
            catch (e) {
                this.app.HandleHTTPError("met-norway", e, this.app);
                return null;
            }
            if (!xml) {
                this.app.HandleError({ type: "soft", detail: "no api response", service: "darksky" });
                return null;
            }
            return await this.ParseWeather(xml);
        }
        return null;
    }
    async ParseWeather(xml) {
        let doc = this.xmlParser.parse(xml);
        let rootElem = doc.getRootElement().getChildElement("product");
        let dataPoints = rootElem.getChildElements("time");
        let parsedWeathers = [];
        let parsed6hourly = [];
        let parsedHourly = [];
        for (let i = 0; i < dataPoints.length; i++) {
            const element = dataPoints[i];
            let fromDate = new Date(element.getAttribute("from").getValue());
            let toDate = new Date(element.getAttribute("to").getValue());
            let item = element.getChildElement("location");
            let temp = item.getChildElement("temperature");
            let minTemp = item.getChildElement("minTemperature");
            let symbol = item.getChildElement("symbol");
            if (!!temp) {
                parsedWeathers.push(this.ParseXMLWeather(item, fromDate, toDate));
            }
            else if (!!minTemp && !!symbol) {
                parsed6hourly.push(this.Parse6HourXMLForecast(item, fromDate, toDate));
            }
            else if (!minTemp && !!symbol) {
                parsedHourly.push(this.ParseHourlyXMLForecast(item, fromDate, toDate));
            }
        }
        let forecasts = this.BuildForecasts(parsed6hourly);
        let result = {
            temperature: CelsiusToKelvin(parsedWeathers[0].temperature),
            coord: {
                lat: parsedWeathers[0].lat,
                lon: parsedWeathers[0].lon
            },
            date: parsedWeathers[0].from,
            condition: this.ResolveCondition(parsedHourly[0].symbol),
            humidity: parsedWeathers[0].humidity,
            pressure: parsedWeathers[0].pressure,
            extra_field: {
                name: _("Cloudiness:"),
                type: "percent",
                value: parsedWeathers[0].cloudiness
            },
            sunrise: null,
            sunset: null,
            wind: {
                degree: parsedWeathers[0].windDirection,
                speed: parsedWeathers[0].windSpeed
            },
            location: {
                url: null,
            },
            forecasts: forecasts
        };
        return result;
    }
    GetEarliestData(events) {
        let earliest = 0;
        for (let i = 0; i < events.length; i++) {
            const element = events[i];
            const earliestElement = events[earliest];
            if (earliestElement.from < element.from)
                continue;
            earliest = i;
        }
        return events[earliest];
    }
    BuildForecasts(forecastsData) {
        let forecasts = [];
        let days = [];
        let currentDay = this.GetEarliestData(forecastsData).from.toDateString();
        let dayIndex = 0;
        days.push([]);
        for (let i = 0; i < forecastsData.length; i++) {
            const element = forecastsData[i];
            if (element.from.toDateString() == currentDay && element.to.toDateString() == currentDay) {
                days[dayIndex].push(element);
            }
            else if (element.from.toDateString() != currentDay && element.to.toDateString() != currentDay) {
                dayIndex++;
                currentDay = element.from.toDateString();
                days.push([]);
                days[dayIndex].push(element);
            }
        }
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
                conditionCounter[element.symbol] = (!!conditionCounter[element.symbol]) ? conditionCounter[element.symbol]++ : 1;
            }
            forecast.temp_max = CelsiusToKelvin(forecast.temp_max);
            forecast.temp_min = CelsiusToKelvin(forecast.temp_min);
            forecast.condition = this.ResolveCondition(this.GetMostCommonCondition(conditionCounter));
            forecasts.push(forecast);
        }
        return forecasts;
    }
    GetMostCommonCondition(count) {
        let result = null;
        for (let key in count) {
            if (result == null)
                result = key;
            if (count[result] < count[key])
                result = key;
        }
        return result;
    }
    ParseXMLWeather(element, from, to) {
        return {
            temperature: parseFloat(this.GetXMLValueSafely(element, "temperature", "value")),
            lat: element.getAttribute("latitude").getValue(),
            lon: element.getAttribute("longitude").getValue(),
            windDirection: parseFloat(this.GetXMLValueSafely(element, "windDirection", "deg")),
            windSpeed: parseFloat(this.GetXMLValueSafely(element, "windSpeed", "mps")),
            humidity: parseFloat(this.GetXMLValueSafely(element, "humidity", "value")),
            pressure: parseFloat(this.GetXMLValueSafely(element, "pressure", "value")),
            cloudiness: parseFloat(this.GetXMLValueSafely(element, "cloudiness", "percent")),
            fog: parseFloat(this.GetXMLValueSafely(element, "fog", "percent")),
            lowClouds: parseFloat(this.GetXMLValueSafely(element, "lowClouds", "percent")),
            mediumClouds: parseFloat(this.GetXMLValueSafely(element, "mediumClouds", "percent")),
            highClouds: parseFloat(this.GetXMLValueSafely(element, "highClouds", "percent")),
            dewpointTemperature: parseFloat(this.GetXMLValueSafely(element, "dewpointTemperature", "value")),
            from: from,
            to: to
        };
    }
    Parse6HourXMLForecast(element, from, to) {
        return {
            precipitation: parseFloat(this.GetXMLValueSafely(element, "precipitation", "value")),
            minTemperature: parseFloat(this.GetXMLValueSafely(element, "minTemperature", "value")),
            maxTemperature: parseFloat(this.GetXMLValueSafely(element, "maxTemperature", "value")),
            from: from,
            to: to,
            symbol: this.GetXMLValueSafely(element, "symbol", "id")
        };
    }
    ParseHourlyXMLForecast(element, from, to) {
        return {
            precipitation: parseFloat(this.GetXMLValueSafely(element, "precipitation", "value")),
            from: from,
            to: to,
            symbol: this.GetXMLValueSafely(element, "symbol", "id")
        };
    }
    GetXMLValueSafely(element, childName, attributeName) {
        let child = element.getChildElement(childName);
        if (!child)
            return null;
        let attribute = child.getAttribute(attributeName);
        if (!attribute)
            return null;
        return attribute.getValue();
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
    ResolveCondition(icon) {
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
                    customIcon: "Cloud-Drizzle-Sun",
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
                    customIcon: "Cloud-Hail-Sun",
                    main: _("Heavy Sleet"),
                    description: _("Mostly Heavy Sleet"),
                    icon: weatherIconSafely([icons.rain_freezing, icons.rain, icons.alert], this.app._icon_type)
                };
            case "HeavySleetThunder":
                return {
                    customIcon: "Cloud-Hail",
                    main: _("Heavy Sleet"),
                    description: _("Heavy Sleet with Thundertorms"),
                    icon: weatherIconSafely([icons.rain_freezing, icons.rain, icons.alert], this.app._icon_type)
                };
            case "HeavySleetThunderSun":
                return {
                    customIcon: "Cloud-Hail-Sun",
                    main: _("Heavy Sleet"),
                    description: _("Mostly Heavy Sleet with Thunderstorms"),
                    icon: weatherIconSafely([icons.rain_freezing, icons.rain, icons.alert], this.app._icon_type)
                };
            case "HeavySnow":
                return {
                    customIcon: "Cloud-Snow",
                    main: _("heavy Snow"),
                    description: _("Heavy Snow"),
                    icon: weatherIconSafely([icons.snow, icons.alert], this.app._icon_type)
                };
            case "HeavySnowThunder":
                return {
                    customIcon: "Cloud-Snow",
                    main: _("Heavy Snow"),
                    description: _("Heavy Snow with Thunderstorm"),
                    icon: weatherIconSafely([icons.snow, icons.alert], this.app._icon_type)
                };
            case "HeavySnowThunderSun":
                return {
                    customIcon: "Cloud-Snow-Sun",
                    main: _("Heavy Snow"),
                    description: _("Heavy Snow with Thunderstorm"),
                    icon: weatherIconSafely([icons.snow, icons.alert], this.app._icon_type)
                };
            case "HeavysnowSun":
                return {
                    customIcon: "Cloud-Snow-Sun",
                    main: _("Heavy Snow"),
                    description: _("Heavy Snow"),
                    icon: weatherIconSafely([icons.snow, icons.alert], this.app._icon_type)
                };
            case "LightCloud":
                return {
                    customIcon: "Cloud-Sun",
                    main: _("Mostly Sunny"),
                    description: _("Mostly Sunny"),
                    icon: weatherIconSafely([icons.few_clouds_day, icons.alert], this.app._icon_type)
                };
            case "LightRain":
                return {
                    customIcon: "Cloud-Rain-Sun",
                    main: _("Light Rain"),
                    description: _("Light Rain"),
                    icon: weatherIconSafely([icons.showers_scattered, icons.rain, icons.alert], this.app._icon_type)
                };
            case "LightRainSun":
                return {
                    customIcon: "Cloud-Rain-Sun",
                    main: _("Light Rain"),
                    description: _(""),
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
                    customIcon: "Cloud-Rain-Sun",
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
                    customIcon: "Cloud-Hail-Sun",
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
                    customIcon: "Cloud-Hail-Sun",
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
                    customIcon: "Cloud-Snow-Sun",
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
                    customIcon: "Cloud-Snow-Sun",
                    main: _("Light Snow"),
                    description: _("Mostly Light Snow with Thunderstorms"),
                    icon: weatherIconSafely([icons.snow, icons.alert], this.app._icon_type)
                };
            case "PartlyCloud":
                return {
                    customIcon: "Cloud-Sun",
                    main: _("Partly Cloudy"),
                    description: _("Partly Cloudy"),
                    icon: weatherIconSafely([icons.few_clouds_day, icons.clouds, icons.overcast, icons.alert], this.app._icon_type)
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
                    customIcon: "Cloud-Rain-Sun",
                    main: _("Mostly Rainy"),
                    description: _("Mostly Rainy"),
                    icon: weatherIconSafely([icons.rain, icons.rain_freezing, icons.alert], this.app._icon_type)
                };
            case "RainThunder":
                return {
                    customIcon: "Cloud-Lightning",
                    main: _("Rain"),
                    description: _("Rain with Thunderstorm"),
                    icon: weatherIconSafely([icons.storm, icons.rain, icons.rain_freezing, icons.alert], this.app._icon_type)
                };
            case "RainThunderSun":
                return {
                    customIcon: "Cloud-Lightning-Sun",
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
                    customIcon: "Cloud-Hail-Sun",
                    main: _("Sleet"),
                    description: _("Mostly Sleet"),
                    icon: weatherIconSafely([icons.rain_freezing, icons.showers, icons.alert], this.app._icon_type)
                };
            case "SleetSunThunder":
                return {
                    customIcon: "Cloud-Hail-Sun",
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
                    customIcon: "Cloud-Snow-Sun",
                    main: _("Mostly Snowy"),
                    description: _("Mostly Snowy"),
                    icon: weatherIconSafely([icons.snow, icons.alert], this.app._icon_type)
                };
            case "SnowSunThunder":
                return {
                    customIcon: "Cloud-Snow-Sun",
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
                    customIcon: "Sun",
                    main: _("Sunny"),
                    description: _("Sunny"),
                    icon: weatherIconSafely([icons.clear_day, icons.alert], this.app._icon_type)
                };
        }
    }
}
