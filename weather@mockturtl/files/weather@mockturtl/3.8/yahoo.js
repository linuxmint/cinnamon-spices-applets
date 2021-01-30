"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Yahoo = void 0;
const commandRunner_1 = require("./commandRunner");
const logger_1 = require("./logger");
const notification_service_1 = require("./notification_service");
const utils_1 = require("./utils");
class Yahoo {
    constructor(_app) {
        this.prettyName = "Yahoo";
        this.name = "Yahoo";
        this.maxForecastSupport = 10;
        this.website = "https://www.yahoo.com/news/weather/";
        this.maxHourlyForecastSupport = 0;
        this.needsApiKey = false;
        this.app = _app;
    }
    async GetWeather(loc) {
        var _a;
        if (loc == null)
            return null;
        let response = await commandRunner_1.SpawnProcessJson(["python3", this.app.AppletDir + "/../yahoo-bridge.py", "--params", JSON.stringify({ lat: loc.lat.toString(), lon: loc.lon.toString() })]);
        if (!response.Success) {
            if (response.ErrorData.Type == "jsonParse")
                this.app.ShowError({ type: "hard", service: "yahoo", detail: "bad api response - non json", message: utils_1._("Yahoo bridge responded in bad format,\n see Looking Glass log for errors") });
            else
                this.app.ShowError({ type: "hard", service: "yahoo", detail: "unknown", message: utils_1._("Unknown Error happened while calling Yahoo bridge,\n see Looking Glass log for errors") });
            logger_1.Log.Instance.Error("Yahoo API bridge call failed, error: " + response.ErrorData.Message);
            return null;
        }
        logger_1.Log.Instance.Debug2("Yahoo API response: " + response);
        if (!((_a = response.Data) === null || _a === void 0 ? void 0 : _a.error)) {
            return this.ParseWeather(response.Data);
        }
        else {
            this.HandleResponseErrors(response.Data);
            return null;
        }
    }
    ;
    ParseWeather(json) {
        try {
            let sunrise = this.TimeToDateObj(json.current_observation.astronomy.sunrise);
            let sunset = this.TimeToDateObj(json.current_observation.astronomy.sunset);
            let result = {
                date: new Date(json.current_observation.pubDate * 1000),
                coord: {
                    lat: json.location.lat,
                    lon: json.location.long
                },
                location: {
                    url: "https://www.yahoo.com/news/weather/country/state/city-" + json.location.woeid,
                    timeZone: json.location.timezone_id,
                    city: json.location.city,
                    country: json.location.country,
                },
                sunrise: sunrise,
                sunset: sunset,
                wind: {
                    speed: this.ToMPS(json.current_observation.wind.speed),
                    degree: json.current_observation.wind.direction
                },
                temperature: this.ToKelvin(json.current_observation.condition.temperature),
                pressure: json.current_observation.atmosphere.pressure,
                humidity: json.current_observation.atmosphere.humidity,
                condition: {
                    main: (json.current_observation.condition.text),
                    description: json.current_observation.condition.text,
                    icons: this.ResolveIcon(json.current_observation.condition.code, { sunrise: sunrise, sunset: sunset }),
                    customIcon: this.ResolveCustomIcon(json.current_observation.condition.code)
                },
                extra_field: {
                    name: utils_1._("Feels Like"),
                    value: this.ToKelvin(json.current_observation.wind.chill),
                    type: "temperature"
                },
                forecasts: []
            };
            for (let i = 0; i < json.forecasts.length; i++) {
                let day = json.forecasts[i];
                let forecast = {
                    date: new Date(day.date * 1000),
                    temp_min: this.ToKelvin(day.low),
                    temp_max: this.ToKelvin(day.high),
                    condition: {
                        main: (day.text),
                        description: (day.text),
                        icons: this.ResolveIcon(day.code),
                        customIcon: this.ResolveCustomIcon(day.code)
                    },
                };
                result.forecasts.push(forecast);
            }
            return result;
        }
        catch (e) {
            logger_1.Log.Instance.Error("Yahoo payload parsing error: " + e);
            this.app.ShowError({ type: "soft", detail: "unusual payload", service: "yahoo", message: utils_1._("Failed to Process Weather Info") });
            return null;
        }
    }
    ;
    HandleResponseErrors(json) {
        let type = json.error.type;
        let errorMsg = "Yahoo bridge: ";
        logger_1.Log.Instance.Debug("yahoo API error payload: " + json);
        switch (type) {
            case "import":
                notification_service_1.NotificationService.Instance.Send(utils_1._("Missing package"), utils_1._("Please install '{missingPackage}', then refresh manually.", { "missingPackage": this.GetMissingPackage(json) }));
                logger_1.Log.Instance.Error(errorMsg + json.error.message);
                this.app.ShowError({
                    detail: "import error",
                    type: "hard",
                    userError: true,
                    service: "yahoo",
                    message: utils_1._("Please install '{missingPackage}', then refresh manually.", { "missingPackage": this.GetMissingPackage(json) })
                });
                break;
            case "network":
                this.app.ShowError({
                    detail: "no api response",
                    type: "soft",
                    service: "yahoo",
                    message: utils_1._("Could not connect to Yahoo API.")
                });
                logger_1.Log.Instance.Error(errorMsg + "Could not connect to API, error - " + json.error.data);
                break;
            case "unknown":
                this.app.ShowError({
                    detail: "no api response",
                    type: "hard",
                    service: "yahoo",
                    message: utils_1._("Unknown error happened while obtaining weather, see Looking Glass logs for more information")
                });
                logger_1.Log.Instance.Error(errorMsg + "Unknown Error happened in yahoo bridge, error - " + json.error.data);
                break;
            default:
                logger_1.Log.Instance.Error(errorMsg + json.error.message);
                break;
        }
    }
    ;
    GetMissingPackage(error) {
        let pythonModule = error.error.data.split("'")[1];
        if (pythonModule == "requests_oauthlib") {
            return "python3-requests-oauthlib";
        }
        return pythonModule;
    }
    IsNight(sunTimes) {
        if (!sunTimes)
            return false;
        let now = new Date();
        if (now < sunTimes.sunrise || now > sunTimes.sunset)
            return true;
        return false;
    }
    ResolveIcon(icon, sunTimes) {
        switch (icon) {
            case 0:
                return ["weather-severe-alert"];
            case 1:
                return ["weather-severe-alert"];
            case 2:
                return ["weather-severe-alert"];
            case 3:
                return ["weather-storm"];
            case 4:
                return ["weather-storm"];
            case 5:
                return ["weather-rain", "weather-showers-scattered", "weather-freezing-rain"];
            case 6:
                return ["weather-freezing-rain", "weather-rain", "weather-showers-scattered"];
            case 7:
                return ["weather-snow"];
            case 8:
                return ["weather-freezing-rain", "weather-rain", "weather-showers-scattered"];
            case 9:
                return ["weather-freezing-rain", "weather-rain", "weather-showers-scattered"];
            case 10:
                return ["weather-freezing-rain", "weather-rain", "weather-showers-scattered"];
            case 11:
                return ["weather-showers", "weather-showers-scattered"];
            case 12:
                return ["weather-rain", "weather-showers-scattered", "weather-freezing-rain"];
            case 13:
                return ["weather-snow"];
            case 14:
                return ["weather-snow"];
            case 15:
                return ["weather-snow"];
            case 16:
                return ["weather-snow"];
            case 17:
                return ["weather-rain", "weather-showers-scattered", "weather-freezing-rain"];
            case 18:
                return ["weather-rain", "weather-showers-scattered", "weather-freezing-rain"];
            case 19:
                return ["weather-fog"];
            case 20:
                return ["weather-fog"];
            case 21:
                return ["weather-fog"];
            case 22:
                return ["weather-fog"];
            case 23:
                return (sunTimes && this.IsNight(sunTimes)) ? ["weather-windy", "weather-breeze", "weather-clouds-night", "weather-few-clouds-night"] : ["weather-windy", "weather-breeze", "weather-clouds", "weather-few-clouds"];
            case 24:
                return (sunTimes && this.IsNight(sunTimes)) ? ["weather-windy", "weather-breeze", "weather-clouds-night", "weather-few-clouds-night"] : ["weather-windy", "weather-breeze", "weather-clouds", "weather-few-clouds"];
            case 25:
                return ["weather-severe-alert"];
            case 26:
                return (sunTimes && this.IsNight(sunTimes)) ? ["weather-overcast", "weather-clouds-night", "weather-few-clouds-night"] : ["weather-overcast", "weather-clouds", "weather-few-clouds"];
            case 27:
                return ["weather-few-clouds-night"];
            case 28:
                return ["weather-few-clouds"];
            case 29:
                return ["weather-few-clouds-night"];
            case 30:
                return ["weather-few-clouds"];
            case 31:
                return ["weather-clear-night"];
            case 32:
                return ["weather-clear"];
            case 33:
                return ["weather-clear-night"];
            case 34:
                return ["weather-clear"];
            case 35:
                return ["weather-rain", "weather-showers-scattered", "weather-freezing-rain"];
            case 36:
                return ["weather-severe-alert"];
            case 37:
                return ["weather-storm"];
            case 38:
                return ["weather-storm"];
            case 39:
                return ["weather-showers", "weather-showers-scattered"];
            case 40:
                return ["weather-rain", "weather-showers-scattered", "weather-freezing-rain"];
            case 41:
                return ["weather-snow"];
            case 42:
                return ["weather-snow"];
            case 43:
                return ["weather-snow"];
            case 44:
                return ["weather-severe-alert"];
            case 45:
                return ["weather-showers", "weather-showers-scattered"];
            case 46:
                return ["weather-showers", "weather-showers-scattered"];
            case 47:
                return ["weather-storm"];
            default:
                return ["weather-severe-alert"];
        }
    }
    ;
    ResolveCustomIcon(icon) {
        switch (icon) {
            case 0:
                return "tornado-symbolic";
            case 1:
                return "hurricane-symbolic";
            case 2:
                return "hurricane-warning-symbolic";
            case 3:
                return "thunderstorm-symbolic";
            case 4:
                return "thunderstorm-symbolic";
            case 5:
                return "rain-mix-symbolic";
            case 6:
                return "rain-mix-symbolic";
            case 7:
                return "snow-symbolic";
            case 8:
                return "rain-symbolic";
            case 9:
                return "rain-symbolic";
            case 10:
                return "rain-symbolic";
            case 11:
                return "showers-symbolic";
            case 12:
                return "rain-symbolic";
            case 13:
                return "snow-wind-symbolic";
            case 14:
                return "snow-symbolic";
            case 15:
                return "snow-wind-symbolic";
            case 16:
                return "snow-symbolic";
            case 17:
                return "hail-symbolic";
            case 18:
                return "sleet-symbolic";
            case 19:
                return "dust-symbolic";
            case 20:
                return "fog-symbolic";
            case 21:
                return "fog-symbolic";
            case 22:
                return "fog-symbolic";
            case 23:
                return "windy-symbolic";
            case 24:
                return "windy-symbolic";
            case 25:
                return "cloud-refresh-symbolic";
            case 26:
                return "cloudy-symbolic";
            case 27:
                return "night-cloudy-symbolic";
            case 28:
                return "day-cloudy-symbolic";
            case 29:
                return "night-cloudy-symbolic";
            case 30:
                return "day-cloudy-symbolic";
            case 31:
                return "night-clear-symbolic";
            case 32:
                return "day-sunny-symbolic";
            case 33:
                return "night-clear-symbolic";
            case 34:
                return "day-sunny-symbolic";
            case 35:
                return "hail-symbolic";
            case 36:
                return "hot-symbolic";
            case 37:
                return "storm-showers-symbolic";
            case 38:
                return "storm-showers-symbolic";
            case 39:
                return "day-showers-symbolic";
            case 40:
                return "rain-symbolic";
            case 41:
                return "day-snow-symbolic";
            case 42:
                return "snow-symbolic";
            case 43:
                return "snow-wind-symbolic";
            case 44:
                return "cloud-refresh-symbolic";
            case 45:
                return "night-showers-symbolic";
            case 46:
                return "night-snow-thunderstorm-symbolic";
            case 47:
                return "thunderstorm-symbolic";
            default:
                return "cloud-refresh-symbolic";
        }
    }
    ToKelvin(temp) {
        return utils_1.CelsiusToKelvin(temp);
    }
    ;
    ToMPS(speed) {
        return utils_1.KPHtoMPS(speed);
    }
    ;
    TimeToDateObj(time) {
        let times = time.split(" ");
        let hoursMinutes = times[0].split(":");
        let amPm = times[1];
        let today = new Date();
        today.setHours(parseInt(hoursMinutes[0]) + ((amPm == "pm") ? 12 : 0));
        today.setMinutes(parseInt(hoursMinutes[1]));
        return today;
    }
}
exports.Yahoo = Yahoo;
;
const YahooConditionLibrary = [
    utils_1._("Tornado"),
    utils_1._("Tropical Storm"),
    utils_1._("Hurricane"),
    utils_1._("Severe Thunderstorms"),
    utils_1._("Thunderstorms"),
    utils_1._("Mixed Rain and Snow"),
    utils_1._("Mixed Rain and Sleet"),
    utils_1._("Mixed Snow and Sleet"),
    utils_1._("Freezing Drizzle"),
    utils_1._("Drizzle"),
    utils_1._("Freezing Rain"),
    utils_1._("Showers"),
    utils_1._("Rain"),
    utils_1._("Snow Flurries"),
    utils_1._("Light Snow Showers"),
    utils_1._("Blowing Snow"),
    utils_1._("Snow"),
    utils_1._("Hail"),
    utils_1._("Sleet"),
    utils_1._("Dust"),
    utils_1._("Foggy"),
    utils_1._("Haze"),
    utils_1._("Smoky"),
    utils_1._("Blustery"),
    utils_1._("Windy"),
    utils_1._("Cold"),
    utils_1._("Cloudy"),
    utils_1._("Mostly Cloudy"),
    utils_1._("Partly Cloudy"),
    utils_1._("Clear"),
    utils_1._("Sunny"),
    utils_1._("Mostly Sunny"),
    utils_1._("Fair"),
    utils_1._("Mixed Rain and Hail"),
    utils_1._("Hot"),
    utils_1._("Isolated Thunderstorms"),
    utils_1._("Scattered Thunderstorms"),
    utils_1._("Scattered Showers"),
    utils_1._("Heavy Rain"),
    utils_1._("Scattered Snow Showers"),
    utils_1._("Heavy Snow"),
    utils_1._("Blizzard"),
    utils_1._("Not Available"),
    utils_1._("Scattered Thundershowers")
];
