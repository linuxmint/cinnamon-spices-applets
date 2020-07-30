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
var FahrenheitToKelvin = utils.FahrenheitToKelvin;
var CelsiusToKelvin = utils.CelsiusToKelvin;
var MPHtoMPS = utils.MPHtoMPS;
var IsNight = utils.IsNight;
var weatherIconSafely = utils.weatherIconSafely;
class DarkSky {
    constructor(_app) {
        this.prettyName = "DarkSky";
        this.name = "DarkSky";
        this.maxForecastSupport = 8;
        this.website = "https://darksky.net/poweredby/";
        this.maxHourlyForecastSupport = 168;
        this.descriptionLinelength = 25;
        this.supportedLanguages = [
            'ar', 'az', 'be', 'bg', 'bs', 'ca', 'cs', 'da', 'de', 'el', 'en', 'es',
            'et', 'fi', 'fr', 'he', 'hr', 'hu', 'id', 'is', 'it', 'ja', 'ka', 'ko',
            'kw', 'lv', 'nb', 'nl', 'no', 'pl', 'pt', 'ro', 'ru', 'sk', 'sl', 'sr',
            'sv', 'tet', 'tr', 'uk', 'x-pig-latin', 'zh', 'zh-tw'
        ];
        this.query = "https://api.darksky.net/forecast/";
        this.DarkSkyFilterWords = [_("and"), _("until"), _("in"), _("Possible")];
        this.unit = null;
        this.app = _app;
    }
    async GetWeather(loc) {
        let query = this.ConstructQuery(loc);
        let json;
        if (query != "" && query != null) {
            try {
                json = await this.app.LoadJsonAsync(query, this.OnObtainingData);
            }
            catch (e) {
                this.app.HandleHTTPError("darksky", e, this.app);
                return null;
            }
            if (!json) {
                this.app.HandleError({ type: "soft", detail: "no api response", service: "darksky" });
                return null;
            }
            if (!json.code) {
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
                    icon: weatherIconSafely(this.ResolveIcon(json.currently.icon, { sunrise: sunrise, sunset: sunset }), this.app.config.IconType()),
                    customIcon: this.ResolveCustomIcon(json.currently.icon)
                },
                extra_field: {
                    name: _("Feels Like"),
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
                        icon: weatherIconSafely(this.ResolveIcon(day.icon), this.app.config.IconType()),
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
                        icon: weatherIconSafely(this.ResolveIcon(hour.icon, { sunrise: sunrise, sunset: sunset }, new Date(hour.time * 1000)), this.app.config.IconType()),
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
            this.app.log.Error("DarkSky payload parsing error: " + e);
            this.app.HandleError({ type: "soft", detail: "unusual payload", service: "darksky", message: _("Failed to Process Weather Info") });
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
        let query;
        let key = this.app.config._apiKey.replace(" ", "");
        if (this.app.config.noApiKey()) {
            this.app.log.Error("DarkSky: No API Key given");
            this.app.HandleError({
                type: "hard",
                userError: true,
                "detail": "no key",
                message: _("Please enter API key in settings,\nor get one first on https://darksky.net/dev/register")
            });
            return "";
        }
        query = this.query + key + "/" + loc.text + "?exclude=minutely,flags" + "&units=" + this.unit;
        let locale = this.ConvertToAPILocale(this.app.currentLocale);
        if (isLangSupported(locale, this.supportedLanguages) && this.app.config._translateCondition) {
            query = query + "&lang=" + locale;
        }
        return query;
    }
    OnObtainingData(message) {
        if (message.status_code == 403) {
            return {
                type: "hard",
                userError: true,
                detail: "bad key",
                service: "darksky",
                message: _("Please Make sure you\nentered the API key correctly and your account is not locked")
            };
        }
        if (message.status_code == 401) {
            return {
                type: "hard",
                userError: true,
                detail: "no key",
                service: "darksky",
                message: _("Please Make sure you\nentered the API key what you have from DarkSky")
            };
        }
        return null;
    }
    HandleResponseErrors(json) {
        let code = json.code;
        let error = json.error;
        let errorMsg = "DarkSky API: ";
        this.app.log.Debug("DarksSky API error payload: " + json);
        switch (code) {
            case "400":
                this.app.log.Error(errorMsg + error);
                break;
            default:
                this.app.log.Error(errorMsg + error);
                break;
        }
    }
    ;
    ProcessSummary(summary) {
        let processed = summary.split(" ");
        let result = "";
        let linelength = 0;
        for (let i = 0; i < processed.length; i++) {
            if (linelength + processed[i].length > this.descriptionLinelength) {
                result = result + "\n";
                linelength = 0;
            }
            result = result + processed[i] + " ";
            linelength = linelength + processed[i].length + 1;
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
        return this.DarkSkyFilterWords.indexOf(word) != -1;
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
                return (sunTimes && IsNight(sunTimes, date)) ? ["weather-windy", "weather-breeze", "weather-clouds", "weather-few-clouds-night"] : ["weather-windy", "weather-breeze", "weather-clouds", "weather-few-clouds"];
            case "cloudy":
                return (sunTimes && IsNight(sunTimes, date)) ? ["weather-overcast", "weather-clouds", "weather-few-clouds-night"] : ["weather-overcast", "weather-clouds", "weather-few-clouds"];
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
        if (this.app.config._temperatureUnit == "celsius") {
            if (this.app.config._windSpeedUnit == "kph" || this.app.config._windSpeedUnit == "m/s") {
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
            return FahrenheitToKelvin(temp);
        }
        else {
            return CelsiusToKelvin(temp);
        }
    }
    ;
    ToMPS(speed) {
        if (this.unit == 'si') {
            return speed;
        }
        else {
            return MPHtoMPS(speed);
        }
    }
    ;
}
;
