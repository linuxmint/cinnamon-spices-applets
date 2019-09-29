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
                return false;
            }
            if (!json) {
                this.app.HandleError({ type: "soft", detail: "no api response", service: "darksky" });
                return false;
            }
            if (!json.code) {
                return this.ParseWeather(json);
            }
            else {
                this.HandleResponseErrors(json);
                return false;
            }
        }
        return false;
    }
    ;
    ParseWeather(json) {
        try {
            this.app.weather.dateTime = new Date(json.currently.time * 1000);
            this.app.weather.location.timeZone = json.timezone;
            this.app.weather.coord.lat = json.latitude;
            this.app.weather.coord.lon = json.longitude;
            this.app.weather.sunrise = new Date(json.daily.data[0].sunriseTime * 1000);
            this.app.weather.sunset = new Date(json.daily.data[0].sunsetTime * 1000);
            this.app.weather.wind.speed = this.ToMPS(json.currently.windSpeed);
            this.app.weather.wind.degree = json.currently.windBearing;
            this.app.weather.main.temperature = this.ToKelvin(json.currently.temperature);
            this.app.weather.main.pressure = json.currently.pressure;
            this.app.weather.main.humidity = json.currently.humidity * 100;
            this.app.weather.condition.main = this.GetShortCurrentSummary(json.currently.summary);
            this.app.weather.condition.description = json.currently.summary;
            this.app.weather.condition.icon = weatherIconSafely(this.ResolveIcon(json.currently.icon), this.app._icon_type);
            this.app.weather.cloudiness = json.currently.cloudCover * 100;
            this.app.weather.main.feelsLike = this.ToKelvin(json.currently.apparentTemperature);
            for (let i = 0; i < this.app._forecastDays; i++) {
                let forecast = {
                    dateTime: null,
                    main: {
                        temp: null,
                        temp_min: null,
                        temp_max: null,
                        pressure: null,
                        sea_level: null,
                        grnd_level: null,
                        humidity: null,
                    },
                    condition: {
                        id: null,
                        main: null,
                        description: null,
                        icon: null,
                    },
                    clouds: null,
                    wind: {
                        speed: null,
                        deg: null,
                    }
                };
                let day = json.daily.data[i];
                forecast.dateTime = new Date(day.time * 1000);
                forecast.dateTime.setHours(forecast.dateTime.getHours() + 12);
                forecast.main.temp_min = this.ToKelvin(day.temperatureLow);
                forecast.main.temp_max = this.ToKelvin(day.temperatureHigh);
                forecast.condition.main = this.GetShortSummary(day.summary);
                forecast.condition.description = this.ProcessSummary(day.summary);
                forecast.condition.icon = weatherIconSafely(this.ResolveIcon(day.icon), this.app._icon_type);
                forecast.main.pressure = day.pressure;
                forecast.main.humidity = day.humidity * 100;
                this.app.forecasts.push(forecast);
            }
            return true;
        }
        catch (e) {
            this.app.log.Error("DarkSky payload parsing error: " + e);
            this.app.HandleError({ type: "soft", detail: "unusal payload", service: "darksky", message: _("Failed to Process Weather Info") });
            return false;
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
                noTriggerRefresh: true,
                "detail": "no key",
                message: _("Please enter API key in settings,\nor get one first on https://darksky.net/dev/register")
            });
            return "";
        }
        if (isCoordinate(location)) {
            query = this.query + key + "/" + location +
                "?exclude=minutely,hourly,flags" + "&units=" + this.unit;
            this.app.log.Debug(this.app.systemLanguage);
            if (isLangSupported(this.app.systemLanguage, this.supportedLanguages) && this.app._translateCondition) {
                query = query + "&lang=" + this.app.systemLanguage;
            }
            return query;
        }
        else {
            this.app.log.Error("DarkSky: Location is not a coordinate");
            this.app.HandleError({ type: "hard", detail: "bad location format", service: "darksky", noTriggerRefresh: true, message: ("Please Check the location,\nmake sure it is a coordinate") });
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
            uiError.message = _("Please Make sure you\nentered the API key correctly");
            uiError.type = "hard";
            uiError.noTriggerRefresh = true;
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
    ResolveIcon(icon) {
        switch (icon) {
            case "rain":
                return [icons.rain, icons.showers_scattered, icons.rain_freezing];
            case "snow":
                return [icons.snow];
            case "fog":
                return [icons.fog];
            case "cloudy":
                return [icons.overcast, icons.clouds, icons.few_clouds_day];
            case "partly-cloudy-night":
                return [icons.few_clouds_night, icons.few_clouds_day];
            case "partly-cloudy-day":
                return [icons.few_clouds_day];
            case "clear-night":
                return [icons.clear_night];
            case "clear-day":
                return [icons.clear_day];
            case "storm":
                return [icons.storm];
            case "showers":
                return [icons.showers];
            case "wind":
                return ["weather-wind", "wind", "weather-breeze", icons.clouds, icons.few_clouds_day];
            default:
                return [icons.alert];
        }
    }
    ;
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
