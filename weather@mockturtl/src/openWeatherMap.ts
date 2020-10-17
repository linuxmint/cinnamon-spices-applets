export { }; // Declaring as a Module
function importModule(path: string): any {
    if (typeof require !== 'undefined') {
        return require('./' + path);
    } else {
        if (!AppletDir) var AppletDir = imports.ui.appletManager.applets['weather@mockturtl'];
        return AppletDir[path];
    }
}

const UUID = "weather@mockturtl"
imports.gettext.bindtextdomain(UUID, imports.gi.GLib.get_home_dir() + "/.local/share/locale");

function _(str: string): string {
    return imports.gettext.dgettext(UUID, str)
}

var utils = importModule("utils");
var isCoordinate = utils.isCoordinate as (text: any) => boolean;
var isLangSupported = utils.isLangSupported as (lang: string, languages: Array<string>) => boolean;
var isID = utils.isID as (text: any) => boolean;
var weatherIconSafely = utils.weatherIconSafely as (code: BuiltinIcons[], icon_type: imports.gi.St.IconType) => BuiltinIcons;
var get = utils.get as (p: string[], o: any) => any;
var nonempty = utils.nonempty as (str: string) => boolean;

//////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////
///////////                                       ////////////
///////////         OpenWeatherMap Premium        ////////////
///////////                                       ////////////
//////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////

class OpenWeatherMap implements WeatherProvider {
    //--------------------------------------------------------
    //  Properties
    //--------------------------------------------------------
    public readonly prettyName = "OpenWeatherMap";
    public readonly name = "OpenWeatherMap";
    public readonly maxForecastSupport = 7;
    public readonly website = "https://openweathermap.org/";
    public readonly maxHourlyForecastSupport = 48;

    private supportedLanguages = ["af", "ar", "az", "bg", "ca", "cz", "da", "de", "el", "en", "eu", "fa", "fi",
        "fr", "gl", "he", "hi", "hr", "hu", "id", "it", "ja", "kr", "la", "lt", "mk", "no", "nl", "pl",
        "pt", "pt_br", "ro", "ru", "se", "sk", "sl", "sp", "es", "sr", "th", "tr", "ua", "uk", "vi", "zh_cn", "zh_tw", "zu"
    ];

    private base_url = "https://api.openweathermap.org/data/2.5/onecall?" //lat=51.5085&lon=-0.1257&appid={YOUR API KEY}"

    private app: WeatherApplet
    constructor(_app: WeatherApplet) {
        this.app = _app;
    }

    //--------------------------------------------------------
    //  Functions
    //--------------------------------------------------------

    public async GetWeather(loc: Location): Promise<WeatherData> {
        let query = this.ConstructQuery(this.base_url, loc);
        let json;
        if (query != null) {
            try {
                json = await this.app.LoadJsonAsync(query);
            } catch (e) {
                this.app.HandleHTTPError("openweathermap", e, this.app, this.HandleHTTPError);
                return null;
            }

            if (json == null) {
                this.app.HandleError({
                    type: "soft",
                    detail: "no api response",
                    service: "openweathermap"
                });
                return null;
            }

            return this.ParseWeather(json, this);
            /*else {
                this.HandleResponseErrors(json);
                return null;
            }*/
        } else {
            return null;
        }
    };

    private ParseWeather(json: any, self: OpenWeatherMap): WeatherData {
        try {
            let weather: WeatherData = {
                coord: {
                    lat: json.lat,
                    lon: json.lon
                },
                location: {
                    //city: json.name,
                    //country: json.sys.country,
                    url: "https://openweathermap.org/city/",
                    timeZone: json.timezone
                },
                date: new Date((json.current.dt) * 1000),
                sunrise: new Date((json.current.sunrise) * 1000),
                sunset: new Date((json.current.sunset) * 1000),
                wind: {
                    speed: json.current.wind_speed,
                    degree: json.current.wind_deg
                },
                temperature: json.current.temp,
                pressure: json.current.pressure,
                humidity: json.current.humidity,
                condition: {
                    main: get(["current", "weather", "0", "main"], json),
                    description: get(["current", "weather", "0", "description"], json),
                    icon: weatherIconSafely(self.ResolveIcon(get(["current", "weather", "0", "icon"], json)), self.app.config.IconType()),
                    customIcon: self.ResolveCustomIcon(get(["current", "weather", "0", "icon"], json))
                },
                extra_field: {
                    name: _("Cloudiness"),
                    value: json.current.clouds,
                    type: "percent"
                },
                forecasts: []
            };

            let forecasts: ForecastData[] = [];
            for (let i = 0; i < json.daily.length; i++) {
                let day = json.daily[i];
                let forecast: ForecastData = {
                    date: new Date(day.dt * 1000),
                    temp_min: day.temp.min,
                    temp_max: day.temp.max,
                    condition: {
                        main: day.weather[0].main,
                        description: day.weather[0].description,
                        icon: weatherIconSafely(self.ResolveIcon(day.weather[0].icon), self.app.config.IconType()),
                        customIcon: self.ResolveCustomIcon(day.weather[0].icon)
                    },
                };
                forecasts.push(forecast);
            }
            weather.forecasts = forecasts;

            let hourly: HourlyForecastData[] = [];
            for (let index = 0; index < json.hourly.length; index++) {
                const hour = json.hourly[index];
                let forecast: HourlyForecastData = {
                    date: new Date(hour.dt * 1000),
                    temp: hour.temp,
                    condition: {
                        main: hour.weather[0].main,
                        description: hour.weather[0].description,
                        icon: weatherIconSafely(self.ResolveIcon(hour.weather[0].icon), self.app.config.IconType()),
                        customIcon: self.ResolveCustomIcon(hour.weather[0].icon)
                    },
                }
                if (!!hour.rain) {
                    forecast.precipitation = {
                        volume: hour.rain["1h"],
                        type: "rain"
                    }
                }
                // Snow takes precedence
                if (!!hour.snow) {
                    forecast.precipitation = {
                        volume: hour.snow["1h"],
                        type: "snow"
                    }
                }

                if (!!hour.pop && forecast.precipitation)
                    forecast.precipitation.chance = hour.pop * 100;

                hourly.push(forecast);
            }

            weather.hourlyForecasts = hourly;
            return weather;
        } catch (e) {
            self.app.log.Error("OpenWeatherMap Weather Parsing error: " + e);
            self.app.HandleError({
                type: "soft",
                service: "openweathermap",
                detail: "unusual payload",
                message: _("Failed to Process Current Weather Info")
            })
            return null;
        }
    };


    private ConstructQuery(baseUrl: string, loc: Location): string {
        let query = baseUrl;
        query = query + "lat=" + loc.lat + "&lon=" + loc.lon + "&appid=";
        query += "1c73f8259a86c6fd43c7163b543c8640";
        // Append Language if supported and enabled
        let locale: string = this.ConvertToAPILocale(this.app.currentLocale);
        if (this.app.config._translateCondition && isLangSupported(locale, this.supportedLanguages)) {
            query = query + "&lang=" + locale;
        }
        return query;
    };

    private ConvertToAPILocale(systemLocale: string) {
        // Dialect? support by OWM
        if (systemLocale == "zh-cn" || systemLocale == "zh-cn" || systemLocale == "pt-br") {
            return systemLocale;
        }
        let lang = systemLocale.split("-")[0];
        // OWM uses different language code for Swedish, Czech, Korean, Latvian, Norwegian
        if (lang == "sv") {
            return "se";
        } else if (lang == "cs") {
            return "cz";
        } else if (lang == "ko") {
            return "kr";
        } else if (lang == "lv") {
            return "la";
        } else if (lang == "nn" || lang == "nb") {
            return "no";
        }
        return lang;
    }

    private HandleResponseErrors(json: any): void {
        let errorMsg = "OpenWeatherMap Response: ";
        let error = {
            service: "openweathermap",
            type: "hard",
        } as AppletError;
        switch (json.cod) {
            case ("400"):
                error.detail = "bad location format";
                error.message = _("Please make sure Location is in the correct format in the Settings");
                break;
            case ("401"):
                error.detail = "bad key";
                error.message = _("Make sure you entered the correct key in settings");
                break;
            case ("404"):
                error.detail = "location not found";
                error.message = _("Location not found, make sure location is available or it is in the correct format");
                break;
            case ("429"):
                error.detail = "key blocked";
                error.message = _("If this problem persists, please contact the Author of this applet");
                break;
            default:
                error.detail = "unknown";
                error.message = _("Unknown Error, please see the logs in Looking Glass");
                break;
        };
        this.app.HandleError(error);
        this.app.log.Debug("OpenWeatherMap Error Code: " + json.cod)
        this.app.log.Error(errorMsg + json.message);
    };

    public HandleHTTPError(error: HttpError, uiError: AppletError): AppletError {
        // "this" is not accessible here
        if (error.code == 404) {
            uiError.detail = "location not found";
            uiError.message = _("Location not found, make sure location is available or it is in the correct format");
            uiError.userError = true;
            uiError.type = "hard";
        }
        return uiError;
    }


    private ResolveIcon(icon: string): BuiltinIcons[] {
        // https://openweathermap.org/weather-conditions
        /* fallback icons are: weather-clear-night 
        weather-clear weather-few-clouds-night weather-few-clouds 
        weather-fog weather-overcast weather-severe-alert weather-showers 
        weather-showers-scattered weather-snow weather-storm */
        switch (icon) {
            case "10d":
                /* rain day */
                return ["weather-rain", "weather-showers-scattered", "weather-freezing-rain"]
            case "10n":
                /* rain night */
                return ["weather-rain", "weather-showers-scattered", "weather-freezing-rain"]
            case "09n":
                /* showers nigh*/
                return ["weather-showers"]
            case "09d":
                /* showers day */
                return ["weather-showers"]
            case "13d":
                /* snow day*/
                return ["weather-snow"]
            case "13n":
                /* snow night */
                return ["weather-snow"]
            case "50d":
                /* mist day */
                return ["weather-fog"]
            case "50n":
                /* mist night */
                return ["weather-fog"]
            case "04d":
                /* broken clouds day */
                return ["weather-overcast", "weather-clouds", "weather-few-clouds"]
            case "04n":
                /* broken clouds night */
                return ["weather-overcast", "weather-clouds-night", "weather-few-clouds-night"]
            case "03n":
                /* mostly cloudy (night) */
                return ['weather-clouds-night', "weather-few-clouds-night"]
            case "03d":
                /* mostly cloudy (day) */
                return ["weather-clouds", "weather-few-clouds", "weather-overcast"]
            case "02n":
                /* partly cloudy (night) */
                return ["weather-few-clouds-night"]
            case "02d":
                /* partly cloudy (day) */
                return ["weather-few-clouds"]
            case "01n":
                /* clear (night) */
                return ["weather-clear-night"]
            case "01d":
                /* sunny */
                return ["weather-clear"]
            case "11d":
                /* storm day */
                return ["weather-storm"]
            case "11n":
                /* storm night */
                return ["weather-storm"]
            default:
                return ["weather-severe-alert"]
        }
    };

    private ResolveCustomIcon(icon: string): CustomIcons {
        switch (icon) {
            case "10d":
                /* rain day */
                return "day-rain-symbolic";
            case "10n":
                /* rain night */
                return "night-rain-symbolic";
            case "09n":
                /* showers nigh*/
                return "night-showers-symbolic";
            case "09d":
                /* showers day */
                return "day-showers-symbolic"
            case "13d":
                /* snow day*/
                return "day-snow-symbolic"
            case "13n":
                /* snow night */
                return "night-alt-snow-symbolic"
            case "50d":
                /* mist day */
                return "day-fog-symbolic"
            case "50n":
                /* mist night */
                return "night-fog-symbolic"
            case "04d":
                /* broken clouds day */
                return "day-cloudy-symbolic"
            case "04n":
                /* broken clouds night */
                return "night-alt-cloudy-symbolic"
            case "03n":
                /* mostly cloudy (night) */
                return "night-alt-cloudy-symbolic"
            case "03d":
                /* mostly cloudy (day) */
                return "day-cloudy-symbolic"
            case "02n":
                /* partly cloudy (night) */
                return "night-alt-cloudy-symbolic"
            case "02d":
                /* partly cloudy (day) */
                return "day-cloudy-symbolic"
            case "01n":
                /* clear (night) */
                return "night-clear-symbolic"
            case "01d":
                /* sunny */
                return "day-sunny-symbolic"
            case "11d":
                /* storm day */
                return "day-thunderstorm-symbolic"
            case "11n":
                /* storm night */
                return "night-alt-thunderstorm-symbolic"
            default:
                return "cloud-refresh-symbolic"
        }
    };
};

const openWeatherMapConditionLibrary = [
    // Group 2xx: Thunderstorm
    _("Thunderstorm with light rain"),
    _("Thunderstorm with rain"),
    _("Thunderstorm with heavy rain"),
    _("Light thunderstorm"),
    _("Thunderstorm"),
    _("Heavy thunderstorm"),
    _("Ragged thunderstorm"),
    _("Thunderstorm with light drizzle"),
    _("Thunderstorm with drizzle"),
    _("Thunderstorm with heavy drizzle"),
    // Group 3xx: Drizzle
    _("Light intensity drizzle"),
    _("Drizzle"),
    _("Heavy intensity drizzle"),
    _("Light intensity drizzle rain"),
    _("Drizzle rain"),
    _("Heavy intensity drizzle rain"),
    _("Shower rain and drizzle"),
    _("Heavy shower rain and drizzle"),
    _("Shower drizzle"),
    // Group 5xx: Rain
    _("Light rain"),
    _("Moderate rain"),
    _("Heavy intensity rain"),
    _("Very heavy rain"),
    _("Extreme rain"),
    _("Freezing rain"),
    _("Light intensity shower rain"),
    _("Shower rain"),
    _("Heavy intensity shower rain"),
    _("Ragged shower rain"),
    // Group 6xx: Snow 
    _("Light snow"),
    _("Snow"),
    _("Heavy snow"),
    _("Sleet"),
    _("Shower sleet"),
    _("Light rain and snow"),
    _("Rain and snow"),
    _("Light shower snow"),
    _("Shower snow"),
    _("Heavy shower snow"),
    // Group 7xx: Atmosphere 
    _("Mist"),
    _("Smoke"),
    _("Haze"),
    _("Sand, dust whirls"),
    _("Fog"),
    _("Sand"),
    _("Dust"),
    _("Volcanic ash"),
    _("Squalls"),
    _("Tornado"),
    // Group 800: Clear 
    _("Clear"),
    _("Clear sky"),
    _("Sky is clear"),
    // Group 80x: Clouds
    _("Clouds"),
    _("Few clouds"),
    _("Scattered clouds"),
    _("Broken clouds"),
    _("Overcast clouds")
];