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
                if (json == null) {
                    this.app.showError(this.app.errMsg.label.service, this.app.errMsg.desc.noResponse);
                    return false;
                }
            }
            catch (e) {
                this.app.log.Error("DarkSky: API call failed: " + e);
                this.app.showError(this.app.errMsg.label.service, this.app.errMsg.desc.noResponse);
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
        this.app.log.Error("DarkSky: Could not construct query, insufficent information");
        this.app.showError(this.app.errMsg.label.service, this.app.errMsg.desc.locBad);
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
            this.app.weather.condition.icon = this.app.weatherIconSafely(json.currently.icon, this.ResolveIcon);
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
                forecast.condition.icon = this.app.weatherIconSafely(day.icon, this.ResolveIcon);
                forecast.main.pressure = day.pressure;
                forecast.main.humidity = day.humidity * 100;
                this.app.forecasts.push(forecast);
            }
        }
        catch (e) {
            this.app.log.Error("DarkSky payload parsing error: " + e);
            this.app.showError(this.app.errMsg.label.generic, this.app.errMsg.desc.parse);
            return false;
        }
        return true;
    }
    ;
    ConstructQuery() {
        this.SetQueryUnit();
        let query;
        let key = this.app._apiKey.replace(" ", "");
        let location = this.app._location.replace(" ", "");
        if (this.app.noApiKey()) {
            this.app.showError(this.app.errMsg.label.noKey, "");
            return "";
        }
        if (this.app.isCoordinate(location)) {
            query = this.query + key + "/" + location +
                "?exclude=minutely,hourly,flags" + "&units=" + this.unit;
            if (this.app.isLangSupported(this.app.systemLanguage, this.supportedLanguages) && this.app._translateCondition) {
                query = query + "&lang=" + this.app.systemLanguage;
            }
            return query;
        }
        else {
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
            if (!/[\(\)]/.test(processed[i]) && !(this.app.DarkSkyFilterWords.includes(processed[i]))) {
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
    ResolveIcon(icon) {
        switch (icon) {
            case "rain":
                return ['weather-rain', 'weather-showers-scattered', 'weather-freezing-rain'];
            case "snow":
                return ['weather-snow'];
            case "fog":
                return ['weather-fog'];
            case "cloudy":
                return ['weather-overcast', 'weather-clouds', , 'weather-few-clouds'];
            case "partly-cloudy-night":
                return ['weather-few-clouds-night', "weather-few-clouds"];
            case "partly-cloudy-day":
                return ['weather-few-clouds'];
            case "clear-night":
                return ['weather-clear-night'];
            case "clear-day":
                return ['weather-clear'];
            case "storm":
                return ['weather-storm'];
            case "showers":
                return ['weather-showers'];
            case "wind":
                return ["weather-wind", "wind", "weather-breeze", 'weather-clouds', 'weather-few-clouds'];
            default:
                return ['weather-severe-alert'];
        }
    }
    ;
    SetQueryUnit() {
        if (this.app._temperatureUnit == this.app.WeatherUnits.CELSIUS) {
            if (this.app._windSpeedUnit == this.app.WeatherWindSpeedUnits.KPH || this.app._windSpeedUnit == this.app.WeatherWindSpeedUnits.MPS) {
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
            return this.app.FahrenheitToKelvin(temp);
        }
        else {
            return this.app.CelsiusToKelvin(temp);
        }
    }
    ;
    ToMPS(speed) {
        if (this.unit == 'si') {
            return speed;
        }
        else {
            return this.app.MPHtoMPS(speed);
        }
    }
    ;
}
;
