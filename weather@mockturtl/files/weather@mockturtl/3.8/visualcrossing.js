"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VisualCrossing = void 0;
const utils_1 = require("./utils");
class VisualCrossing {
    constructor(app) {
        this.prettyName = "Visual Crossing";
        this.name = "Visual Crossing";
        this.maxForecastSupport = 15;
        this.maxHourlyForecastSupport = 336;
        this.website = "https://weather.visualcrossing.com/";
        this.needsApiKey = true;
        this.url = "https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/";
        this.params = {
            unitGroup: "metric",
            key: null,
            include: "fcst,hours,current",
            lang: "id"
        };
        this.supportedLangs = ["en", "de", "fr", "es"];
        this.app = app;
    }
    async GetWeather(loc) {
        if (loc == null)
            return null;
        this.params['key'] = this.app.config.ApiKey;
        let translate = true;
        if (utils_1.IsLangSupported(this.app.config.Language, this.supportedLangs)) {
            this.params['lang'] = this.app.config.Language;
            translate = false;
        }
        let url = this.url + loc.lat + "," + loc.lon;
        let json = await this.app.LoadJsonAsync(url, this.params, (e) => this.HandleHttpError(e));
        if (!json)
            return null;
        return this.ParseWeather(json, translate);
    }
    ParseWeather(weather, translate) {
        var _a, _b, _c, _d, _e, _f;
        let currentHour = this.GetCurrentHour(weather.days);
        let result = {
            date: new Date(weather.currentConditions.datetimeEpoch * 1000),
            location: {
                url: encodeURI("https://www.visualcrossing.com/weather-history/" + weather.latitude + "," + weather.longitude + "/"),
                timeZone: weather.timezone,
                tzOffset: weather.tzoffset,
            },
            coord: {
                lat: weather.latitude,
                lon: weather.longitude,
            },
            humidity: (_a = weather.currentConditions.humidity) !== null && _a !== void 0 ? _a : currentHour.humidity,
            pressure: (_b = weather.currentConditions.pressure) !== null && _b !== void 0 ? _b : currentHour.pressure,
            wind: {
                degree: (_c = weather.currentConditions.winddir) !== null && _c !== void 0 ? _c : currentHour.winddir,
                speed: (_d = weather.currentConditions.windspeed) !== null && _d !== void 0 ? _d : currentHour.windspeed,
            },
            temperature: utils_1.CelsiusToKelvin((_e = weather.currentConditions.temp) !== null && _e !== void 0 ? _e : currentHour.temp),
            sunrise: new Date(weather.currentConditions.sunriseEpoch * 1000),
            sunset: new Date(weather.currentConditions.sunsetEpoch * 1000),
            condition: this.GenerateCondition(weather.currentConditions.icon, weather.currentConditions.conditions, translate),
            extra_field: {
                name: utils_1._("Feels Like"),
                type: "temperature",
                value: utils_1.CelsiusToKelvin((_f = currentHour.feelslike) !== null && _f !== void 0 ? _f : weather.currentConditions.feelslike)
            },
            forecasts: this.ParseForecasts(weather.days, translate),
            hourlyForecasts: this.ParseHourlyForecasts(weather.days, translate)
        };
        return result;
    }
    ParseForecasts(forecasts, translate) {
        let result = [];
        for (let index = 0; index < forecasts.length; index++) {
            const element = forecasts[index];
            result.push({
                date: new Date(element.datetimeEpoch * 1000),
                condition: this.GenerateCondition(element.icon, element.conditions, translate),
                temp_max: utils_1.CelsiusToKelvin(element.tempmax),
                temp_min: utils_1.CelsiusToKelvin(element.tempmin)
            });
        }
        return result;
    }
    ParseHourlyForecasts(forecasts, translate) {
        let currentHour = new Date();
        currentHour.setMinutes(0, 0, 0);
        let result = [];
        for (let index = 0; index < forecasts.length; index++) {
            const element = forecasts[index];
            for (let index = 0; index < element.hours.length; index++) {
                const hour = element.hours[index];
                let time = new Date(hour.datetimeEpoch * 1000);
                if (time < currentHour)
                    continue;
                let item = {
                    date: time,
                    temp: utils_1.CelsiusToKelvin(hour.temp),
                    condition: this.GenerateCondition(hour.icon, hour.conditions, translate)
                };
                if (hour.preciptype != null) {
                    item.precipitation = {
                        type: hour.preciptype[0],
                        chance: hour.precipprob,
                        volume: hour.precip
                    };
                }
                result.push(item);
            }
        }
        return result;
    }
    GetCurrentHour(forecasts) {
        if ((forecasts === null || forecasts === void 0 ? void 0 : forecasts.length) < 1)
            return null;
        let currentHour = new Date();
        currentHour.setMinutes(0, 0, 0);
        const element = forecasts[0];
        for (let index = 0; index < element.hours.length; index++) {
            const hour = element.hours[index];
            let time = new Date(hour.datetimeEpoch * 1000);
            if (time < currentHour)
                continue;
            return hour;
        }
        return null;
    }
    GenerateCondition(icon, condition, translate) {
        let result = {
            main: (translate) ? this.ResolveTypeID(this.GetFirstCondition(condition)) : this.GetFirstCondition(condition),
            description: (translate) ? this.ResolveTypeIDs(condition) : condition,
            icon: "weather-clear",
            customIcon: "refresh-symbolic"
        };
        let icons = [];
        switch (icon) {
            case "clear-day":
                icons = ["weather-clear"];
                result.customIcon = "day-sunny-symbolic";
                break;
            case "clear-night":
                icons = ["weather-clear-night"];
                result.customIcon = "night-clear-symbolic";
                break;
            case "partly-cloudy-day":
                icons = ["weather-few-clouds"];
                result.customIcon = "day-cloudy-symbolic";
                break;
            case "partly-cloudy-night":
                icons = ["weather-few-clouds-night"];
                result.customIcon = "night-alt-cloudy-symbolic";
                break;
            case "cloudy":
                icons = ["weather-overcast", "weather-clouds", "weather-many-clouds"];
                result.customIcon = "cloudy-symbolic";
                break;
            case "wind":
                icons = ["weather-windy", "weather-breeze"];
                result.customIcon = "windy-symbolic";
                break;
            case "fog":
                icons = ["weather-fog"];
                result.customIcon = "fog-symbolic";
                break;
            case "rain":
                icons = ["weather-rain", "weather-freezing-rain", "weather-snow-rain", "weather-showers"];
                result.customIcon = "rain-symbolic";
                break;
            case "snow":
                icons = ["weather-snow"];
                result.customIcon = "snow-symbolic";
                break;
        }
        result.icon = utils_1.WeatherIconSafely(icons, this.app.config.IconType);
        return result;
    }
    GetFirstCondition(condition) {
        let split = condition.split(", ");
        return split[0];
    }
    ResolveTypeID(condition) {
        switch (condition.toLowerCase()) {
            case "type_1":
                return utils_1._("Blowing Or Drifting Snow");
            case "type_2":
                return utils_1._("Drizzle");
            case "type_3":
                return utils_1._("Heavy Drizzle");
            case "type_4":
                return utils_1._("Light Drizzle");
            case "type_5":
                return utils_1._("Heavy Drizzle/Rain");
            case "type_6":
                return utils_1._("Light Drizzle/Rain");
            case "type_7":
                return utils_1._("Duststorm");
            case "type_8":
                return utils_1._("Fog");
            case "type_9":
                return utils_1._("Freezing Drizzle/Freezing Rain");
            case "type_10":
                return utils_1._("Heavy Freezing Drizzle/Freezing Rain");
            case "type_11":
                return utils_1._("Light Freezing Drizzle/Freezing Rain");
            case "type_12":
                return utils_1._("Freezing Fog");
            case "type_13":
                return utils_1._("Heavy Freezing Rain");
            case "type_14":
                return utils_1._("Light Freezing Rain");
            case "type_15":
                return utils_1._("Funnel Cloud/Tornado");
            case "type_16":
                return utils_1._("Hail Showers");
            case "type_17":
                return utils_1._("Ice");
            case "type_18":
                return utils_1._("Lightning Without Thunder");
            case "type_19":
                return utils_1._("Mist");
            case "type_20":
                return utils_1._("Precipitation In Vicinity");
            case "type_21":
                return utils_1._("Rain");
            case "type_22":
                return utils_1._("Heavy Rain And Snow");
            case "type_23":
                return utils_1._("Light Rain And Snow");
            case "type_24":
                return utils_1._("Rain Showers");
            case "type_25":
                return utils_1._("Heavy Rain");
            case "type_26":
                return utils_1._("Light Rain");
            case "type_27":
                return utils_1._("Sky Coverage Decreasing");
            case "type_28":
                return utils_1._("Sky Coverage Increasing");
            case "type_29":
                return utils_1._("Sky Unchanged");
            case "type_30":
                return utils_1._("Smoke Or Haze");
            case "type_31":
                return utils_1._("Snow");
            case "type_32":
                return utils_1._("Snow And Rain Showers");
            case "type_33":
                return utils_1._("Snow Showers");
            case "type_34":
                return utils_1._("Heavy Snow");
            case "type_35":
                return utils_1._("Light Snow");
            case "type_36":
                return utils_1._("Squalls");
            case "type_37":
                return utils_1._("Thunderstorm");
            case "type_38":
                return utils_1._("Thunderstorm Without Precipitation");
            case "type_39":
                return utils_1._("Diamond Dust");
            case "type_40":
                return utils_1._("Hail");
            case "type_41":
                return utils_1._("Overcast");
            case "type_42":
                return utils_1._("Partially cloudy");
            case "type_43":
                return utils_1._("Clear");
        }
        return condition;
    }
    ResolveTypeIDs(condition) {
        let result = "";
        let split = condition.split(", ");
        for (let index = 0; index < split.length; index++) {
            const element = split[index];
            result += this.ResolveTypeID(element);
            if (index < split.length - 1)
                result += ", ";
        }
        return result;
    }
    HandleHttpError(error) {
        if ((error === null || error === void 0 ? void 0 : error.code) == 401) {
            this.app.ShowError({
                type: "hard",
                userError: true,
                detail: "bad key",
                message: utils_1._("Please make sure you entered the API key correctly")
            });
            return false;
        }
        return true;
    }
}
exports.VisualCrossing = VisualCrossing;
