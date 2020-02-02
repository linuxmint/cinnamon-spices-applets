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
var icons = utils.icons;
var weatherIconSafely = utils.weatherIconSafely;
class Weatherbit {
    constructor(_app) {
        this.descriptionLinelength = 25;
        this.supportedLanguages = [
            'ar', 'az', 'be', 'bg', 'bs', 'ca', 'cz', 'da', 'de', 'el', 'en',
            'et', 'fi', 'fr', 'hr', 'hu', 'id', 'is', 'it',
            'kw', 'lv', 'nb', 'nl', 'pl', 'pt', 'ro', 'ru', 'sk', 'sl', 'sr',
            'sv', 'tr', 'uk', 'zh', 'zh-tw'
        ];
        this.current_url = "https://api.weatherbit.io/v2.0/current?";
        this.daily_url = "https://api.weatherbit.io/v2.0/forecast/daily?";
        this.unit = null;
        this.app = _app;
    }
    async GetWeather() {
        let currentResult = await this.GetData(this.current_url, this.ParseCurrent);
        if (!currentResult)
            return null;
        let forecastResult = await this.GetData(this.daily_url, this.ParseForecast);
        currentResult.forecasts = forecastResult;
        return currentResult;
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
                this.app.HandleHTTPError("weatherbit", e, this.app, this.HandleHTTPError);
                return null;
            }
            if (json == null) {
                this.app.HandleError({ type: "soft", detail: "no api response", service: "weatherbit" });
                return null;
            }
            return ParseFunction(json, this);
        }
        else {
            return null;
        }
    }
    ;
    ParseCurrent(json, self) {
        json = json.data[0];
        try {
            let weather = {
                coord: {
                    lat: json.lat,
                    lon: json.lon
                },
                location: {
                    city: json.city_name,
                    country: json.country_code,
                    url: null,
                    timeZone: json.timezone
                },
                date: new Date(json.ts * 1000),
                sunrise: self.TimeToDate(json.sunrise),
                sunset: self.TimeToDate(json.sunset),
                wind: {
                    speed: json.wind_spd,
                    degree: json.wind_dir
                },
                temperature: json.temp,
                pressure: json.pres,
                humidity: json.rh,
                condition: {
                    main: json.weather.description,
                    description: json.weather.description,
                    icon: weatherIconSafely(self.ResolveIcon(json.weather.icon), self.app._icon_type),
                    customIcon: self.ResolveCustomIcon(json.weather.icon)
                },
                extra_field: {
                    name: _("Feels Like"),
                    value: json.app_temp,
                    type: "temperature"
                },
                forecasts: []
            };
            return weather;
        }
        catch (e) {
            self.app.log.Error("Weatherbit Weather Parsing error: " + e);
            self.app.HandleError({ type: "soft", service: "weatherbit", detail: "unusal payload", message: _("Failed to Process Current Weather Info") });
            return null;
        }
    }
    ;
    ParseForecast(json, self) {
        let forecasts = [];
        try {
            for (let i = 0; i < self.app._forecastDays; i++) {
                let day = json.data[i];
                let forecast = {
                    date: new Date(day.ts * 1000),
                    temp_min: day.min_temp,
                    temp_max: day.max_temp,
                    condition: {
                        main: day.weather.description,
                        description: day.weather.description,
                        icon: weatherIconSafely(self.ResolveIcon(day.weather.icon), self.app._icon_type),
                        customIcon: self.ResolveCustomIcon(day.weather.icon)
                    },
                };
                forecasts.push(forecast);
            }
            return forecasts;
        }
        catch (e) {
            self.app.log.Error("Weatherbit Forecast Parsing error: " + e);
            self.app.HandleError({ type: "soft", service: "weatherbit", detail: "unusal payload", message: _("Failed to Process Forecast Info") });
            return null;
        }
    }
    ;
    TimeToDate(time) {
        let hoursMinutes = time.split(":");
        let date = new Date();
        date.setHours(parseInt(hoursMinutes[0]));
        date.setMinutes(parseInt(hoursMinutes[1]));
        return date;
    }
    ConstructQuery(query) {
        let key = this.app._apiKey.replace(" ", "");
        let location = this.app._location.replace(" ", "");
        if (this.app.noApiKey()) {
            this.app.log.Error("DarkSky: No API Key given");
            this.app.HandleError({
                type: "hard",
                userError: true,
                "detail": "no key",
                message: _("Please enter API key in settings,\nor get one first on https://www.weatherbit.io/account/create")
            });
            return "";
        }
        if (isCoordinate(location)) {
            let latLong = location.split(",");
            query = query + "key=" + key + "&lat=" + latLong[0] + "&lon=" + latLong[1] + "&units=S";
            this.app.log.Debug("System language is " + this.app.systemLanguage.toString());
            if (isLangSupported(this.app.systemLanguage, this.supportedLanguages) && this.app._translateCondition) {
                query = query + "&lang=" + this.app.systemLanguage;
            }
            return query;
        }
        else {
            this.app.log.Error("Weatherbit: Location is not a coordinate");
            this.app.HandleError({ type: "hard", detail: "bad location format", service: "weatherbit", userError: true, message: ("Please Check the location,\nmake sure it is a coordinate") });
            return "";
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
    ResolveIcon(icon) {
        switch (icon) {
            case "t01n":
            case "t01d":
            case "t02n":
            case "t02d":
            case "t03n":
            case "t03d":
            case "t04n":
            case "t04d":
            case "t05n":
            case "t05d":
                return [icons.storm];
            case "d01d":
            case "d01n":
            case "d02d":
            case "d02n":
            case "d03d":
            case "d03n":
                return [icons.showers_scattered, icons.rain, icons.rain_freezing];
            case "r01d":
            case "r01n":
            case "r02d":
            case "r02n":
            case "r03d":
            case "r03n":
            case "r04d":
            case "r04n":
            case "r05d":
            case "r05n":
            case "r06d":
            case "r06n":
                return [icons.rain, icons.rain_freezing, icons.showers_scattered];
            case "s01d":
            case "s01n":
            case "s02d":
            case "s02n":
            case "s03d":
            case "s03n":
            case "s04d":
            case "s04n":
            case "s06d":
            case "s06n":
                return [icons.snow];
            case "s05d":
            case "s05n":
                return [icons.rain_freezing, icons.rain, icons.showers_scattered];
            case "a01d":
            case "a01n":
            case "a02d":
            case "a02n":
            case "a03d":
            case "a03n":
            case "a04d":
            case "a04n":
            case "a05d":
            case "a05n":
            case "a06d":
            case "a06n":
                return [icons.fog];
            case "c02d":
                return [icons.few_clouds_day];
            case "c02n":
                return [icons.few_clouds_night];
            case "c01n":
                return [icons.clear_night];
            case "c01d":
                return [icons.clear_day];
            case "c03d":
                return [icons.clouds, icons.few_clouds_day, icons.overcast];
            case "c03n":
                return [icons.clouds, icons.few_clouds_night, icons.overcast];
            case "c04n":
                return [icons.overcast, icons.clouds, icons.few_clouds_night];
            case "c04d":
                return [icons.overcast, icons.clouds, icons.few_clouds_day];
            case "u00d":
            case "u00n":
                return [icons.alert];
            default:
                return [icons.alert];
        }
    }
    ;
    ResolveCustomIcon(icon) {
        switch (icon) {
            case "t01d":
            case "t02d":
            case "t03d":
                return "Cloud-Lightning-Sun";
            case "t04d":
            case "t05d":
                return "Cloud-Lightning";
            case "t01n":
            case "t02n":
            case "t03n":
                return "Cloud-Lightning-Moon";
            case "t04n":
            case "t05n":
                return "Cloud-Lightning";
            case "d01d":
            case "d02d":
            case "d03d":
            case "d01n":
            case "d02n":
            case "d03n":
                return "Cloud-Drizzle";
            case "r01d":
            case "r02d":
            case "r03d":
            case "r01n":
            case "r02n":
            case "r03n":
                return "Cloud-Rain";
            case "r04d":
            case "r05d":
                return "Cloud-Rain-Sun";
            case "r06d":
                return "Cloud-Rain";
            case "r04n":
            case "r05n":
                return "Cloud-Rain-Moon";
            case "r06n":
                return "Cloud-Rain";
            case "s01d":
            case "s04d":
                return "Cloud-Snow-Sun";
            case "s02d":
            case "s03d":
            case "s06d":
                return "Cloud-Snow";
            case "s01n":
            case "s04n":
                return "Cloud-Snow-Moon";
            case "s02n":
            case "s03n":
            case "s06n":
                return "Cloud-Snow";
            case "s05d":
            case "s05n":
                return "Cloud-Hail";
            case "a01d":
            case "a02d":
            case "a03d":
            case "a04d":
            case "a05d":
            case "a06d":
                return "Cloud-Fog-Sun";
            case "a01n":
            case "a02n":
            case "a03n":
            case "a04n":
            case "a05n":
            case "a06n":
                return "Cloud-Fog-Moon";
            case "c02d":
                return "Cloud-Sun";
            case "c02n":
                return "Cloud-Moon";
            case "c01n":
                return "Moon";
            case "c01d":
                return "Sun";
            case "c03d":
                return "Cloud-Sun";
            case "c03n":
                return "Cloud-Moon";
            case "c04n":
                return "Cloud";
            case "c04d":
                return "Cloud";
            case "u00d":
            case "u00n":
                return "Cloud-Refresh";
            default:
                return "Cloud-Refresh";
        }
    }
}
;
