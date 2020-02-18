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
var isLangSupported = utils.isLangSupported;
var FahrenheitToKelvin = utils.FahrenheitToKelvin;
var CelsiusToKelvin = utils.CelsiusToKelvin;
var MPHtoMPS = utils.MPHtoMPS;
var icons = utils.icons;
var weatherIconSafely = utils.weatherIconSafely;
class DarkSky {
    constructor(_app) {
        this.descriptionLinelength = 25;
        this.supportedLanguages = [
            'ar', 'az', 'be', 'bg', 'bs', 'ca', 'cs', 'da', 'de', 'el', 'en', 'es',
            'et', 'fi', 'fr', 'he', 'hr', 'hu', 'id', 'is', 'it', 'ja', 'ka', 'ko',
            'kw', 'lv', 'nb', 'nl', 'no', 'pl', 'pt', 'ro', 'ru', 'sk', 'sl', 'sr',
            'sv', 'tet', 'tr', 'uk', 'x-pig-latin', 'zh', 'zh-tw'
        ];
        this.query = "https://api.darksky.net/forecast/";
        this.DarkSkyFilterWords = [_("and"), _("until"), _("in")];
        this.unit = null;
        this.app = _app;
    }
    async GetWeather() {
        let query = this.ConstructQuery();
        let json;
        if (query != "" && query != null) {
            this.app.log.Debug("DarkSky API query: " + query);
            try {
                json = await this.app.LoadJsonAsync(query);
            }
            catch (e) {
                this.app.HandleHTTPError("darksky", e, this.app, this.HandleHTTPError);
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
                    icon: weatherIconSafely(this.ResolveIcon(json.currently.icon, { sunrise: sunrise, sunset: sunset }), this.app._icon_type),
                    customIcon: this.ResolveCustomIcon(json.currently.icon)
                },
                extra_field: {
                    name: _("Feels Like"),
                    value: this.ToKelvin(json.currently.apparentTemperature),
                    type: "temperature"
                },
                forecasts: []
            };
            for (let i = 0; i < this.app._forecastDays; i++) {
                let day = json.daily.data[i];
                let forecast = {
                    date: new Date(day.time * 1000),
                    temp_min: this.ToKelvin(day.temperatureLow),
                    temp_max: this.ToKelvin(day.temperatureHigh),
                    condition: {
                        main: this.GetShortSummary(day.summary),
                        description: this.ProcessSummary(day.summary),
                        icon: weatherIconSafely(this.ResolveIcon(day.icon), this.app._icon_type),
                        customIcon: this.ResolveCustomIcon(day.icon)
                    },
                };
                forecast.date.setHours(forecast.date.getHours() + 12);
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
    ConstructQuery() {
        this.SetQueryUnit();
        let query;
        let key = this.app._apiKey.replace(" ", "");
        let location = this.app._location.replace(" ", "");
        if (this.app.noApiKey()) {
            this.app.log.Error("DarkSky: No API Key given");
            this.app.HandleError({
                type: "hard",
                userError: true,
                "detail": "no key",
                message: _("Please enter API key in settings,\nor get one first on https://darksky.net/dev/register")
            });
            return "";
        }
        if (isCoordinate(location)) {
            query = this.query + key + "/" + location +
                "?exclude=minutely,hourly,flags" + "&units=" + this.unit;
            this.app.log.Debug("System language is " + this.app.systemLanguage.toString());
            if (isLangSupported(this.app.systemLanguage, this.supportedLanguages) && this.app._translateCondition) {
                query = query + "&lang=" + this.app.systemLanguage;
            }
            return query;
        }
        else {
            this.app.log.Error("DarkSky: Location is not a coordinate");
            this.app.HandleError({ type: "hard", detail: "bad location format", service: "darksky", userError: true, message: ("Please Check the location,\nmake sure it is a coordinate") });
            return "";
        }
    }
    ;
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
    HandleHTTPError(error, uiError) {
        if (error.code == 403) {
            uiError.detail = "bad key";
            uiError.message = _("Please Make sure you\nentered the API key correctly and your account is not locked");
            uiError.type = "hard";
            uiError.userError = true;
        }
        return uiError;
    }
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
        let result = "";
        for (let i = 0; i < 2; i++) {
            if (!/[\(\)]/.test(processed[i]) && !this.WordBanned(processed[i])) {
                result = result + processed[i] + " ";
            }
        }
        return result;
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
            case "rain":
                return [icons.rain, icons.showers_scattered, icons.rain_freezing];
            case "snow":
                return [icons.snow];
            case "sleet":
                return [icons.rain_freezing, icons.rain, icons.showers_scattered];
            case "fog":
                return [icons.fog];
            case "wind":
                return (sunTimes && this.IsNight(sunTimes)) ? ["weather-wind", "wind", "weather-breeze", icons.clouds, icons.few_clouds_night] : ["weather-wind", "wind", "weather-breeze", icons.clouds, icons.few_clouds_day];
            case "cloudy":
                return (sunTimes && this.IsNight(sunTimes)) ? [icons.overcast, icons.clouds, icons.few_clouds_night] : [icons.overcast, icons.clouds, icons.few_clouds_day];
            case "partly-cloudy-night":
                return [icons.few_clouds_night];
            case "partly-cloudy-day":
                return [icons.few_clouds_day];
            case "clear-night":
                return [icons.clear_night];
            case "clear-day":
                return [icons.clear_day];
            case "storm":
                return [icons.storm];
            case "showers":
                return [icons.showers, icons.showers_scattered];
            default:
                return [icons.alert];
        }
    }
    ;
    ResolveCustomIcon(icon) {
        switch (icon) {
            case "rain":
                return "Cloud-Rain";
            case "snow":
                return "Cloud-Snow";
            case "fog":
                return "Cloud-Fog";
            case "cloudy":
                return "Cloud";
            case "partly-cloudy-night":
                return "Cloud-Moon";
            case "partly-cloudy-day":
                return "Cloud-Sun";
            case "clear-night":
                return "Moon";
            case "clear-day":
                return "Sun";
            case "storm":
                return "Cloud-Lightning";
            case "showers":
                return "Cloud-Drizzle";
            case "wind":
                return "Wind";
            default:
                return "Cloud-Refresh";
        }
    }
    SetQueryUnit() {
        if (this.app._temperatureUnit == "celsius") {
            if (this.app._windSpeedUnit == "kph" || this.app._windSpeedUnit == "m/s") {
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
