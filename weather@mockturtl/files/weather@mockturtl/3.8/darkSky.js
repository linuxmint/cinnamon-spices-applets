"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DarkSky = void 0;
const logger_1 = require("./logger");
const utils_1 = require("./utils");
const Lang = imports.lang;
class DarkSky {
    constructor(_app) {
        this.prettyName = "DarkSky";
        this.name = "DarkSky";
        this.maxForecastSupport = 8;
        this.website = "https://darksky.net/poweredby/";
        this.maxHourlyForecastSupport = 168;
        this.needsApiKey = true;
        this.descriptionLineLength = 25;
        this.supportedLanguages = [
            'ar', 'az', 'be', 'bg', 'bs', 'ca', 'cs', 'da', 'de', 'el', 'en', 'es',
            'et', 'fi', 'fr', 'he', 'hr', 'hu', 'id', 'is', 'it', 'ja', 'ka', 'ko',
            'kw', 'lv', 'nb', 'nl', 'no', 'pl', 'pt', 'ro', 'ru', 'sk', 'sl', 'sr',
            'sv', 'tet', 'tr', 'uk', 'x-pig-latin', 'zh', 'zh-tw'
        ];
        this.query = "https://api.darksky.net/forecast/";
        this.DarkSkyFilterWords = [utils_1._("and"), utils_1._("until"), utils_1._("in"), utils_1._("Possible")];
        this.unit = null;
        this.app = _app;
    }
    async GetWeather(loc) {
        let query = this.ConstructQuery(loc);
        if (query == "" && query == null)
            return null;
        let json = await this.app.LoadJsonAsync(query, null, Lang.bind(this, this.HandleError));
        if (!json)
            return null;
        if (!json.code) {
            return this.ParseWeather(json);
        }
        else {
            this.HandleResponseErrors(json);
            return null;
        }
    }
    ;
    ParseWeather(json) {
        try {
            let sunrise = new Date(json.daily.data[0].sunriseTime * 1000);
            let sunset = new Date(json.daily.data[0].sunsetTime * 1000);
            let result = {
                date: new Date(json.currently.time * 1000),
                coord: {
                    lat: json.latitude,
                    lon: json.longitude
                },
                location: {
                    url: "https://darksky.net/forecast/" + json.latitude + "," + json.longitude,
                    timeZone: json.timezone,
                },
                sunrise: sunrise,
                sunset: sunset,
                wind: {
                    speed: this.ToMPS(json.currently.windSpeed),
                    degree: json.currently.windBearing
                },
                temperature: this.ToKelvin(json.currently.temperature),
                pressure: json.currently.pressure,
                humidity: json.currently.humidity * 100,
                condition: {
                    main: this.GetShortCurrentSummary(json.currently.summary),
                    description: json.currently.summary,
                    icons: this.ResolveIcon(json.currently.icon, { sunrise: sunrise, sunset: sunset }),
                    customIcon: this.ResolveCustomIcon(json.currently.icon)
                },
                extra_field: {
                    name: utils_1._("Feels Like"),
                    value: this.ToKelvin(json.currently.apparentTemperature),
                    type: "temperature"
                },
                forecasts: [],
                hourlyForecasts: []
            };
            for (let i = 0; i < json.daily.data.length; i++) {
                let day = json.daily.data[i];
                let forecast = {
                    date: new Date(day.time * 1000),
                    temp_min: this.ToKelvin(day.temperatureLow),
                    temp_max: this.ToKelvin(day.temperatureHigh),
                    condition: {
                        main: this.GetShortSummary(day.summary),
                        description: this.ProcessSummary(day.summary),
                        icons: this.ResolveIcon(day.icon),
                        customIcon: this.ResolveCustomIcon(day.icon)
                    },
                };
                forecast.date.setHours(forecast.date.getHours() + 12);
                result.forecasts.push(forecast);
            }
            for (let i = 0; i < json.hourly.data.length; i++) {
                let hour = json.hourly.data[i];
                let forecast = {
                    date: new Date(hour.time * 1000),
                    temp: this.ToKelvin(hour.temperature),
                    condition: {
                        main: this.GetShortSummary(hour.summary),
                        description: this.ProcessSummary(hour.summary),
                        icons: this.ResolveIcon(hour.icon, { sunrise: sunrise, sunset: sunset }, new Date(hour.time * 1000)),
                        customIcon: this.ResolveCustomIcon(hour.icon)
                    },
                    precipitation: {
                        type: hour.precipType,
                        volume: hour.precipProbability,
                        chance: hour.precipProbability * 100
                    }
                };
                result.hourlyForecasts.push(forecast);
            }
            return result;
        }
        catch (e) {
            logger_1.Log.Instance.Error("DarkSky payload parsing error: " + e);
            this.app.ShowError({ type: "soft", detail: "unusual payload", service: "darksky", message: utils_1._("Failed to Process Weather Info") });
            return null;
        }
    }
    ;
    ConvertToAPILocale(systemLocale) {
        if (systemLocale == "zh-tw") {
            return systemLocale;
        }
        let lang = systemLocale.split("-")[0];
        return lang;
    }
    ConstructQuery(loc) {
        this.SetQueryUnit();
        let query = this.query + this.app.config.ApiKey + "/" + loc.lat.toString() + "," + loc.lon.toString() + "?exclude=minutely,flags" + "&units=" + this.unit;
        let locale = this.ConvertToAPILocale(this.app.config.currentLocale);
        if (utils_1.IsLangSupported(locale, this.supportedLanguages) && this.app.config._translateCondition) {
            query = query + "&lang=" + locale;
        }
        return query;
    }
    HandleError(message) {
        if (message.code == 403) {
            this.app.ShowError({
                type: "hard",
                userError: true,
                detail: "bad key",
                service: "darksky",
                message: utils_1._("Please Make sure you\nentered the API key correctly and your account is not locked")
            });
            return false;
        }
        else if (message.code == 401) {
            this.app.ShowError({
                type: "hard",
                userError: true,
                detail: "no key",
                service: "darksky",
                message: utils_1._("Please Make sure you\nentered the API key what you have from DarkSky")
            });
            return false;
        }
        return true;
    }
    HandleResponseErrors(json) {
        let code = json.code;
        let error = json.error;
        let errorMsg = "DarkSky API: ";
        logger_1.Log.Instance.Debug("DarksSky API error payload: " + json);
        switch (code) {
            case "400":
                logger_1.Log.Instance.Error(errorMsg + error);
                break;
            default:
                logger_1.Log.Instance.Error(errorMsg + error);
                break;
        }
    }
    ;
    ProcessSummary(summary) {
        let processed = summary.split(" ");
        let result = "";
        let lineLength = 0;
        for (let i = 0; i < processed.length; i++) {
            if (lineLength + processed[i].length > this.descriptionLineLength) {
                result = result + "\n";
                lineLength = 0;
            }
            result = result + processed[i] + " ";
            lineLength = lineLength + processed[i].length + 1;
        }
        return result;
    }
    ;
    GetShortSummary(summary) {
        let processed = summary.split(" ");
        if (processed.length == 1)
            return processed[0];
        let result = [];
        for (let i = 0; i < processed.length; i++) {
            if (!/[\(\)]/.test(processed[i]) && !this.WordBanned(processed[i])) {
                result.push(processed[i]) + " ";
            }
            if (result.length == 2)
                break;
        }
        return result.join(" ");
    }
    ;
    GetShortCurrentSummary(summary) {
        let processed = summary.split(" ");
        let result = "";
        let maxLoop;
        (processed.length < 2) ? maxLoop = processed.length : maxLoop = 2;
        for (let i = 0; i < maxLoop; i++) {
            if (processed[i] != "and") {
                result = result + processed[i] + " ";
            }
        }
        return result;
    }
    WordBanned(word) {
        return this.DarkSkyFilterWords.includes(word);
    }
    ResolveIcon(icon, sunTimes, date) {
        switch (icon) {
            case "rain":
                return ["weather-rain", "weather-showers-scattered", "weather-freezing-rain"];
            case "snow":
                return ["weather-snow"];
            case "sleet":
                return ["weather-freezing-rain", "weather-rain", "weather-showers-scattered"];
            case "fog":
                return ["weather-fog"];
            case "wind":
                return (sunTimes && utils_1.IsNight(sunTimes, date)) ? ["weather-windy", "weather-breeze", "weather-clouds", "weather-few-clouds-night"] : ["weather-windy", "weather-breeze", "weather-clouds", "weather-few-clouds"];
            case "cloudy":
                return (sunTimes && utils_1.IsNight(sunTimes, date)) ? ["weather-overcast", "weather-clouds", "weather-few-clouds-night"] : ["weather-overcast", "weather-clouds", "weather-few-clouds"];
            case "partly-cloudy-night":
                return ["weather-few-clouds-night"];
            case "partly-cloudy-day":
                return ["weather-few-clouds"];
            case "clear-night":
                return ["weather-clear-night"];
            case "clear-day":
                return ["weather-clear"];
            case "storm":
                return ["weather-storm"];
            case "showers":
                return ["weather-showers", "weather-showers-scattered"];
            default:
                return ["weather-severe-alert"];
        }
    }
    ;
    ResolveCustomIcon(icon) {
        switch (icon) {
            case "rain":
                return "rain-symbolic";
            case "snow":
                return "snow-symbolic";
            case "fog":
                return "fog-symbolic";
            case "cloudy":
                return "cloudy-symbolic";
            case "partly-cloudy-night":
                return "night-alt-cloudy-symbolic";
            case "partly-cloudy-day":
                return "day-cloudy-symbolic";
            case "clear-night":
                return "night-clear-symbolic";
            case "clear-day":
                return "day-sunny-symbolic";
            case "storm":
                return "thunderstorm-symbolic";
            case "showers":
                return "showers-symbolic";
            case "wind":
                return "strong-wind-symbolic";
            default:
                return "cloud-refresh-symbolic";
        }
    }
    SetQueryUnit() {
        if (this.app.config.TemperatureUnit == "celsius") {
            if (this.app.config.WindSpeedUnit == "kph" || this.app.config.WindSpeedUnit == "m/s") {
                this.unit = 'si';
            }
            else {
                this.unit = 'uk2';
            }
        }
        else {
            this.unit = 'us';
        }
    }
    ;
    ToKelvin(temp) {
        if (this.unit == 'us') {
            return utils_1.FahrenheitToKelvin(temp);
        }
        else {
            return utils_1.CelsiusToKelvin(temp);
        }
    }
    ;
    ToMPS(speed) {
        if (this.unit == 'si') {
            return speed;
        }
        else {
            return utils_1.MPHtoMPS(speed);
        }
    }
    ;
}
exports.DarkSky = DarkSky;
;
