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
var isLangSupported = utils.isLangSupported;
var CelsiusToKelvin = utils.CelsiusToKelvin;
var IsNight = utils.IsNight;
var weatherIconSafely = utils.weatherIconSafely;
class Climacell {
    constructor(_app) {
        this.prettyName = "Climacell";
        this.name = "Climacell";
        this.maxForecastSupport = 16;
        this.website = "https://www.climacell.co/";
        this.maxHourlyForecastSupport = 96;
        this.supportedLanguages = [];
        this.baseUrl = "https://api.climacell.co/v3/weather/";
        this.callData = {
            current: {
                url: "realtime/",
                required_fields: ["temp", "feels_like", "humidity", "wind_speed", "wind_direction", "baro_pressure", "sunrise", "sunset", "weather_code"]
            },
            hourly: {
                url: "hourly/",
                required_fields: []
            },
            daily: {
                url: "forecast/daily/",
                required_fields: ["temp", "weather_code", "sunset", "sunrise"],
            }
        };
        this.unit = "si";
        this.app = _app;
    }
    async GetWeather() {
        let daily = this.GetData("daily", this.ParseDaily);
        let current = await this.GetData("current", this.ParseWeather);
        current.forecasts = await daily;
        return current;
    }
    ;
    async GetData(baseUrl, ParseFunction) {
        let query = this.ConstructQuery(baseUrl);
        let json;
        if (query != null) {
            this.app.log.Debug("Query: " + query);
            try {
                json = await this.app.LoadJsonAsync(query);
            }
            catch (e) {
                this.app.HandleHTTPError("climacell", e, this.app, null);
                return null;
            }
            if (json == null) {
                this.app.HandleError({ type: "soft", detail: "no api response", service: "climacell" });
                return null;
            }
            return ParseFunction(json, this);
        }
        else {
            return null;
        }
    }
    ;
    ParseWeather(json, ctx) {
        try {
            let suntimes = {
                sunrise: new Date(json.sunrise.value),
                sunset: new Date(json.sunset.value)
            };
            let result = {
                coord: {
                    lat: json.lat,
                    lon: json.lon
                },
                date: new Date(json.observation_time.value),
                sunrise: new Date(json.sunrise.value),
                sunset: new Date(json.sunset.value),
                temperature: CelsiusToKelvin(json.temp.value),
                humidity: json.humidity.value,
                location: {
                    url: null,
                    city: null,
                    country: null,
                    timeZone: null
                },
                pressure: json.baro_pressure.value,
                wind: {
                    degree: json.wind_direction.value,
                    speed: json.wind_speed.value
                },
                extra_field: {
                    name: _("Feels Like"),
                    type: "temperature",
                    value: CelsiusToKelvin(json.feels_like.value)
                },
                condition: ctx.ResolveCondition(json.weather_code.value, IsNight(suntimes)),
                forecasts: []
            };
            return result;
        }
        catch (e) {
            ctx.app.log.Error("Climacell payload parsing error: " + e);
            ctx.app.HandleError({ type: "soft", detail: "unusal payload", service: "climacell", message: _("Failed to Process Weather Info") });
            return null;
        }
    }
    ;
    ParseHourly(json, ctx) {
        for (let index = 0; index < json.length; index++) {
            const element = json[index];
            let suntimes = {
                sunrise: new Date(element.sunrise.value),
                sunset: new Date(element.sunset.value)
            };
        }
        return [];
    }
    ParseDaily(json, ctx) {
        let results = [];
        for (let index = 0; index < json.length; index++) {
            const element = json[index];
            let day = {
                date: new Date(element.observation_time.value),
                temp_max: CelsiusToKelvin(element.temp[1].max.value),
                temp_min: CelsiusToKelvin(element.temp[0].min.value),
                condition: ctx.ResolveCondition(element.weather_code.value)
            };
            results.push(day);
        }
        return results;
    }
    ConstructQuery(subcall) {
        let query;
        let key = this.app.config._apiKey.replace(" ", "");
        let location = this.app.config._location.replace(" ", "");
        if (this.app.config.noApiKey()) {
            this.app.log.Error("Climacell: No API Key given");
            this.app.HandleError({
                type: "hard",
                userError: true,
                "detail": "no key",
                message: _("Please enter API key in settings,\nor get one first on " + "https://developer.climacell.co/sign-up")
            });
            return null;
        }
        if (isCoordinate(location)) {
            let loc = location.split(",");
            query = this.baseUrl + this.callData[subcall].url + "?apikey=" + key + "&lat=" + loc[0] + "&lon=" + loc[1] + "&unit_system=" + this.unit + "&fields=" + this.callData[subcall].required_fields.join();
            global.log(query);
            return query;
        }
        else {
            this.app.log.Error("Climacell: Location is not a coordinate");
            this.app.HandleError({ type: "hard", detail: "bad location format", service: "darksky", userError: true, message: ("Please Check the location,\nmake sure it is a coordinate") });
            return null;
        }
    }
    ;
    ResolveCondition(condition, isNight = false) {
        global.log("IsNight", isNight);
        switch (condition) {
            case ("rain_heavy"):
                return {
                    customIcon: "rain-symbolic",
                    description: _("Substantial rain"),
                    main: _("Substantial rain"),
                    icon: weatherIconSafely(["weather-rain", "weather-freezing-rain", "weather-showers-scattered"], this.app.config.IconType())
                };
            case ("rain"):
                return {
                    customIcon: "rain-symbolic",
                    description: _("Rain"),
                    main: _("Rain"),
                    icon: weatherIconSafely(["weather-rain", "weather-freezing-rain", "weather-showers-scattered"], this.app.config.IconType())
                };
            case ("rain_light"):
                return {
                    customIcon: "rain-mix-symbolic",
                    description: _("Light rain"),
                    main: _("Light rain"),
                    icon: weatherIconSafely(["weather-showers-scattered", "weather-rain", "weather-freezing-rain"], this.app.config.IconType())
                };
            case ("freezing_rain_heavy"):
                return {
                    customIcon: "hail-symbolic",
                    description: _("Substantial freezing rain"),
                    main: _("Freezing rain"),
                    icon: weatherIconSafely(["weather-freezing-rain", "weather-rain", "weather-showers-scattered"], this.app.config.IconType())
                };
            case ("freezing_rain"):
                return {
                    customIcon: "hail-symbolic",
                    description: _("Freezing rain"),
                    main: _("Freezing rain"),
                    icon: weatherIconSafely(["weather-freezing-rain", "weather-rain", "weather-showers-scattered"], this.app.config.IconType())
                };
            case ("freezing_rain_light"):
                return {
                    customIcon: "hail-symbolic",
                    description: _("Light freezing rain"),
                    main: _("Freezing rain"),
                    icon: weatherIconSafely(["weather-showers-scattered", "weather-rain", "weather-freezing-rain"], this.app.config.IconType())
                };
            case ("freezing_drizzle"):
                return {
                    customIcon: "sleet-symbolic",
                    description: _("Light freezing rain falling in fine pieces"),
                    main: _("Freezing rain"),
                    icon: weatherIconSafely(["weather-showers-scattered", "weather-rain", "weather-freezing-rain"], this.app.config.IconType())
                };
            case ("drizzle"):
                return {
                    customIcon: "sleet-symbolic",
                    description: _("Light rain falling in very fine drops"),
                    main: _("Light rain"),
                    icon: weatherIconSafely(["weather-showers-scattered", "weather-rain", "weather-freezing-rain"], this.app.config.IconType())
                };
            case ("ice_pellets_heavy"):
                return {
                    customIcon: "snow-wind-symbolic",
                    description: _("Substantial ice pellets"),
                    main: _("Ice pellets"),
                    icon: weatherIconSafely(["weather-freezing-rain", "weather-rain", "weather-showers-scattered"], this.app.config.IconType())
                };
            case ("ice_pellets"):
                return {
                    customIcon: "snow-wind-symbolic",
                    description: _("Ice pellets"),
                    main: _("Ice pellets"),
                    icon: weatherIconSafely(["weather-freezing-rain", "weather-rain", "weather-showers-scattered"], this.app.config.IconType())
                };
            case ("ice_pellets_light"):
                return {
                    customIcon: "snow-wind-symbolic",
                    description: _("Light ice pellets"),
                    main: _("Ice pellets"),
                    icon: weatherIconSafely(["weather-freezing-rain", "weather-rain", "weather-showers-scattered"], this.app.config.IconType())
                };
            case ("snow_heavy"):
                return {
                    customIcon: "snow-symbolic",
                    description: _("Substantial snow"),
                    main: _("Substantial snow"),
                    icon: weatherIconSafely(["weather-snow"], this.app.config.IconType())
                };
            case ("snow"):
                return {
                    customIcon: "snow-symbolic",
                    description: _("Snow"),
                    main: _("Snow"),
                    icon: weatherIconSafely(["weather-snow"], this.app.config.IconType())
                };
            case ("snow_light"):
                return {
                    customIcon: "snow-symbolic",
                    description: _("Light snow"),
                    main: _("Light snow"),
                    icon: weatherIconSafely(["weather-snow"], this.app.config.IconType())
                };
            case ("flurries"):
                return {
                    customIcon: "cloudy-gusts-symbolic",
                    description: _("Flurries"),
                    main: _("Flurries"),
                    icon: weatherIconSafely(["weather-snow"], this.app.config.IconType())
                };
            case ("tstorm"):
                return {
                    customIcon: "thunderstorm-symbolic",
                    description: _("Thunderstorm conditions"),
                    main: _("Thunderstorm"),
                    icon: weatherIconSafely(["weather-storm"], this.app.config.IconType())
                };
            case ("fog_light"):
                return {
                    customIcon: (isNight) ? "night-fog-symbolic" : "day-fog-symbolic",
                    description: _("Light fog"),
                    main: _("Light fog"),
                    icon: weatherIconSafely(["weather-fog"], this.app.config.IconType())
                };
            case ("fog"):
                return {
                    customIcon: "fog-symbolic",
                    description: _("Fog"),
                    main: _("Fog"),
                    icon: weatherIconSafely(["weather-fog"], this.app.config.IconType())
                };
            case ("cloudy"):
                return {
                    customIcon: "cloudy-symbolic",
                    description: _("Cloudy"),
                    main: _("Cloudy"),
                    icon: (isNight) ? weatherIconSafely(["weather-overcast", "weather-clouds-night", "weather-few-clouds-night"], this.app.config.IconType()) : weatherIconSafely(["weather-overcast", "weather-clouds", "weather-few-clouds"], this.app.config.IconType())
                };
            case ("mostly_cloudy"):
                return {
                    customIcon: (isNight) ? "night-alt-cloudy-symbolic" : "day-cloudy-symbolic",
                    description: _("Mostly cloudy"),
                    main: _("Mostly cloudy"),
                    icon: (isNight) ? weatherIconSafely(["weather-clouds-night", "weather-few-clouds-night", "weather-overcast"], this.app.config.IconType()) : weatherIconSafely(["weather-clouds", "weather-few-clouds", "weather-overcast"], this.app.config.IconType())
                };
            case ("partly_cloudy"):
                return {
                    customIcon: (isNight) ? "night-alt-cloudy-symbolic" : "day-cloudy-symbolic",
                    description: _("Partly cloudy"),
                    main: _("Partly cloudy"),
                    icon: (isNight) ? weatherIconSafely(["weather-clouds-night", "weather-few-clouds-night", "weather-overcast"], this.app.config.IconType()) : weatherIconSafely(["weather-clouds", "weather-few-clouds", "weather-overcast"], this.app.config.IconType())
                };
            case ("mostly_clear"):
                return {
                    customIcon: (isNight) ? "night-alt-partly-cloudy-symbolic" : "day-cloudy-symbolic",
                    description: _("Mostly clear"),
                    main: _("Mostly clear"),
                    icon: (isNight) ? weatherIconSafely(["weather-few-clouds-night", "weather-clouds-night", "weather-overcast"], this.app.config.IconType()) : weatherIconSafely(["weather-few-clouds", "weather-clouds", "weather-overcast"], this.app.config.IconType())
                };
            case ("clear"):
                return {
                    customIcon: (isNight) ? "night-clear-symbolic" : "day-sunny-symbolic",
                    description: (isNight) ? _("Clear") : _("Sunny"),
                    main: (isNight) ? _("Clear") : _("Sunny"),
                    icon: (isNight) ? weatherIconSafely(["weather-clear-night"], this.app.config.IconType()) : weatherIconSafely(["weather-clear"], this.app.config.IconType())
                };
            default:
                return {
                    customIcon: "refresh-symbolic",
                    description: _(""),
                    main: _(""),
                    icon: weatherIconSafely(["weather-severe-alert"], this.app.config.IconType())
                };
        }
    }
}
;
