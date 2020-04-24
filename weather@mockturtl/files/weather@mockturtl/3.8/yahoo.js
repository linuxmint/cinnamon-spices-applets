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
var CelsiusToKelvin = utils.CelsiusToKelvin;
var KPHtoMPS = utils.MPHtoMPS;
var icons = utils.icons;
var weatherIconSafely = utils.weatherIconSafely;
class Yahoo {
    constructor(_app) {
        this.app = _app;
    }
    async GetWeather() {
        let loc = this.ConstructLoc();
        let json;
        if (loc != null) {
            try {
                json = await this.app.SpawnProcess(["python3", this.app.appletDir + "/../yahoo-bridge.py", "--params", JSON.stringify({ lat: loc[0].toString(), lon: loc[1].toString() })]);
            }
            catch (e) {
                this.app.HandleError({ type: "hard", service: "yahoo", detail: "unknown", message: _("Unknown Error happened while calling Yahoo bridge,\n see Looking Glass log for errors") });
                this.app.log.Error("Yahoo API bridge call failed, error: " + e);
                return null;
            }
            if (!json) {
                this.app.HandleError({ type: "soft", detail: "no api response", service: "yahoo" });
                return null;
            }
            this.app.log.Debug("Yahoo API response: " + json);
            try {
                json = JSON.parse(json);
            }
            catch (e) {
                this.app.HandleError({ type: "hard", service: "yahoo", detail: "bad api response - non json", message: _("Yahoo bridge responded in bad format,\n see Looking Glass log for errors") });
                this.app.log.Error("Yahoo service failed to parse payload to JSON, error: " + e);
                return null;
            }
            if (!json.error) {
                return this.ParseWeather(json);
            }
            else {
                this.HandleResponseErrors(json);
                return null;
            }
        }
        return null;
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
                    icon: weatherIconSafely(this.ResolveIcon(json.current_observation.condition.code, { sunrise: sunrise, sunset: sunset }), this.app.config.IconType()),
                    customIcon: this.ResolveCustomIcon(json.current_observation.condition.code)
                },
                extra_field: {
                    name: _("Feels Like"),
                    value: this.ToKelvin(json.current_observation.wind.chill),
                    type: "temperature"
                },
                forecasts: []
            };
            for (let i = 0; i < this.app.config._forecastDays; i++) {
                let day = json.forecasts[i];
                let forecast = {
                    date: new Date(day.date * 1000),
                    temp_min: this.ToKelvin(day.low),
                    temp_max: this.ToKelvin(day.high),
                    condition: {
                        main: (day.text),
                        description: (day.text),
                        icon: weatherIconSafely(this.ResolveIcon(day.code), this.app.config.IconType()),
                        customIcon: this.ResolveCustomIcon(day.code)
                    },
                };
                result.forecasts.push(forecast);
            }
            return result;
        }
        catch (e) {
            this.app.log.Error("DarkSky payload parsing error: " + e);
            this.app.HandleError({ type: "soft", detail: "unusal payload", service: "darksky", message: _("Failed to Process Weather Info") });
            return null;
        }
    }
    ;
    ConstructLoc() {
        let location = this.app.config._location.replace(" ", "");
        if (isCoordinate(location)) {
            return location.split(",");
        }
        else {
            this.app.log.Error("Yahoo: Location is not a coordinate");
            this.app.HandleError({ type: "hard", detail: "bad location format", service: "darksky", userError: true, message: ("Please Check the location,\nmake sure it is a coordinate") });
            return null;
        }
    }
    ;
    HandleResponseErrors(json) {
        let type = json.error.type;
        let errorMsg = "Yahoo bridge: ";
        this.app.log.Debug("yahoo API error payload: " + json);
        switch (type) {
            case "import":
                this.app.sendNotification("Missing package", "Please install '" + this.GetMissingPackage(json) + "', then refresh manually.");
                this.app.log.Error(errorMsg + json.error.message);
                this.app.HandleError({ detail: "import error", type: "hard", userError: true, service: "yahoo", message: "Failed to import " + this.GetMissingPackage(json) + ", please install it first." });
                break;
            case "network":
                this.app.HandleError({ detail: "no api response", type: "soft", service: "yahoo", message: "Could not connect to Yahoo API." });
                this.app.log.Error(errorMsg + "Could not connect to API, error - " + json.error.data);
                break;
            case "unknown":
                this.app.HandleError({ detail: "no api response", type: "hard", service: "yahoo", message: "Unknown error happened while obtaining weather, see Looking Glass logs for more information" });
                this.app.log.Error(errorMsg + "Unknown Error happened in yahoo bridge, error - " + json.error.data);
                break;
            default:
                this.app.log.Error(errorMsg + json.error.message);
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
                return [icons.alert];
            case 1:
                return [icons.alert];
            case 2:
                return [icons.alert];
            case 3:
                return [icons.storm];
            case 4:
                return [icons.storm];
            case 5:
                return [icons.rain, icons.showers_scattered, icons.rain_freezing];
            case 6:
                return [icons.rain_freezing, icons.rain, icons.showers_scattered];
            case 7:
                return [icons.snow];
            case 8:
                return [icons.rain_freezing, icons.rain, icons.showers_scattered];
            case 9:
                return [icons.rain_freezing, icons.rain, icons.showers_scattered];
            case 10:
                return [icons.rain_freezing, icons.rain, icons.showers_scattered];
            case 11:
                return [icons.showers, icons.showers_scattered];
            case 12:
                return [icons.rain, icons.showers_scattered, icons.rain_freezing];
            case 13:
                return [icons.snow];
            case 14:
                return [icons.snow];
            case 15:
                return [icons.snow];
            case 16:
                return [icons.snow];
            case 17:
                return [icons.rain, icons.showers_scattered, icons.rain_freezing];
            case 18:
                return [icons.rain, icons.showers_scattered, icons.rain_freezing];
            case 19:
                return [icons.fog];
            case 20:
                return [icons.fog];
            case 21:
                return [icons.fog];
            case 22:
                return [icons.fog];
            case 23:
                return (sunTimes && this.IsNight(sunTimes)) ? ["weather-wind", "wind", "weather-breeze", icons.clouds, icons.few_clouds_night] : ["weather-wind", "wind", "weather-breeze", icons.clouds, icons.few_clouds_day];
            case 24:
                return (sunTimes && this.IsNight(sunTimes)) ? ["weather-wind", "wind", "weather-breeze", icons.clouds, icons.few_clouds_night] : ["weather-wind", "wind", "weather-breeze", icons.clouds, icons.few_clouds_day];
            case 25:
                return [icons.alert];
            case 26:
                return (sunTimes && this.IsNight(sunTimes)) ? [icons.overcast, icons.clouds, icons.few_clouds_night] : [icons.overcast, icons.clouds, icons.few_clouds_day];
            case 27:
                return [icons.few_clouds_night];
            case 28:
                return [icons.few_clouds_day];
            case 29:
                return [icons.few_clouds_night];
            case 30:
                return [icons.few_clouds_day];
            case 31:
                return [icons.clear_night];
            case 32:
                return [icons.clear_day];
            case 33:
                return [icons.clear_night];
            case 34:
                return [icons.clear_day];
            case 35:
                return [icons.rain, icons.showers_scattered, icons.rain_freezing];
            case 36:
                return [icons.alert];
            case 37:
                return [icons.storm];
            case 38:
                return [icons.storm];
            case 39:
                return [icons.showers, icons.showers_scattered];
            case 40:
                return [icons.rain, icons.showers_scattered, icons.rain_freezing];
            case 41:
                return [icons.snow];
            case 42:
                return [icons.snow];
            case 43:
                return [icons.snow];
            case 44:
                return [icons.alert];
            case 45:
                return [icons.showers, icons.showers_scattered];
            case 46:
                return [icons.showers, icons.showers_scattered];
            case 47:
                return [icons.storm];
            default:
                return [icons.alert];
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
        return CelsiusToKelvin(temp);
    }
    ;
    ToMPS(speed) {
        return KPHtoMPS(speed);
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
;
const YahooConditionLibrary = [
    _("Tornado"),
    _("Tropical Storm"),
    _("Hurricane"),
    _("Severe Thunderstorms"),
    _("Thunderstorms"),
    _("Mixed Rain and Snow"),
    _("Mixed Rain and Sleet"),
    _("Mixed Snow and Sleet"),
    _("Freezing Drizzle"),
    _("Drizzle"),
    _("Freezing Rain"),
    _("Showers"),
    _("Rain"),
    _("Snow Flurries"),
    _("Light Snow Showers"),
    _("Blowing Snow"),
    _("Snow"),
    _("Hail"),
    _("Sleet"),
    _("Dust"),
    _("Foggy"),
    _("Haze"),
    _("Smoky"),
    _("Blustery"),
    _("Windy"),
    _("Cold"),
    _("Cloudy"),
    _("Mostly Cloudy"),
    _("Partly Cloudy"),
    _("Clear"),
    _("Sunny"),
    _("Fair"),
    _("Mixed Rain and Hail"),
    _("Hot"),
    _("Isolated Thunderstorms"),
    _("Scattered Thunderstorms"),
    _("Scattered Showers"),
    _("Heavy Rain"),
    _("Scattered Snow Showers"),
    _("Heavy Snow"),
    _("Blizzard"),
    _("Not Available"),
    _("Scattered Thundershowers")
];
