export {}; // Declaring as a Module

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

// Unable to use type declarations with imports like this, so
// typing it manually again.
var utils = importModule("utils");
var isCoordinate = utils.isCoordinate as (text: any) => boolean;
var isLangSupported = utils.isLangSupported as (lang: string, languages: Array <string> ) => boolean;
var FahrenheitToKelvin = utils.FahrenheitToKelvin as (fahr: number) => number;
var CelsiusToKelvin = utils.CelsiusToKelvin as (celsius: number) => number;
var MPHtoMPS = utils.MPHtoMPS as (speed: number) => number;
var GetFuncName = utils.GetFuncName as (func: Function) => string;
var IsNight = utils.IsNight as (sunTimes: SunTimes, date?: Date) => boolean;
var weatherIconSafely = utils.weatherIconSafely as (code: string[], icon_type: imports.gi.St.IconType) => string;

//////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////
///////////                                       ////////////
///////////                Climacell              ////////////
///////////                                       ////////////
//////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////

class Climacell implements WeatherProvider {

    //--------------------------------------------------------
    //  Properties
    //--------------------------------------------------------
	public readonly prettyName = "Climacell";
	public readonly name = "Climacell";
    public readonly maxForecastSupport = 16;
    public readonly website = "https://www.climacell.co/";
    public readonly maxHourlyForecastSupport = 96;

    private supportedLanguages: string[] = [];

    private baseUrl = "https://api.climacell.co/v3/weather/";
    private callData: CallDict = {
        current: {
            url: "realtime/",
            required_fields: ["temp","feels_like","humidity","wind_speed","wind_direction","baro_pressure","sunrise","sunset","weather_code"]
        },
        hourly: {
            url: "hourly/",
            required_fields: []
        },
        daily: {
            url: "daily/",
            required_fields: []
        }
    }
    
    private unit: queryUnits = null;
    private app: WeatherApplet

    constructor(_app: WeatherApplet) {
        this.app = _app;
    }

    //--------------------------------------------------------
    //  Functions
    //--------------------------------------------------------
    public async GetWeather(): Promise<WeatherData> {
        let hourly = this.GetData("hourly", this.ParseWeather) as Promise<HourlyForecastData[]>;
        let daily = this.GetData("daily", this.ParseWeather) as Promise<ForecastData[]>;
        let current = await this.GetData("current", this.ParseWeather) as WeatherData;
        current.forecasts = await daily;
        current.hourlyForecasts = await hourly;

        return current;
    };

    // A function as a function parameter 2 levels deep does not know
    // about the top level object information, has to pass it in as a paramater
    /**
     * 
     * @param baseUrl 
     * @param ParseFunction returns WeatherData or ForecastData Object
     */
    private async GetData(baseUrl: CallType, ParseFunction: (json: any, context: any) => WeatherData | ForecastData[] | HourlyForecastData[]) {
        let query = this.ConstructQuery(baseUrl);
        let json;
        if (query != null) {
            this.app.log.Debug("Query: " + query);
            try {
                json = await this.app.LoadJsonAsync(query);
            }
            catch(e) {
              	this.app.HandleHTTPError("weatherbit", e, this.app, null);
            	return null;
            }

            if (json == null) {
				this.app.HandleError({type: "soft", detail: "no api response", service: "climacell"});
				return null;                 
            }

            return ParseFunction(json, this);
        }
        else {
          	return null;
        }       
	};


    private ParseWeather(json: any): WeatherData {
        try {
            let result: WeatherData = {
                coord: {
                    lat: json.lat,
                    lon: json.lon
                },
                date: new Date(json.observation_time),
                sunrise: new Date(json.sunrise),
                sunset: new Date(json.sunset),
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
                condition: this.ResolveCondition(json.weather_code.value),
                forecasts: []
            };
			

            return result;
        }
        catch(e) {
            this.app.log.Error("Climacell payload parsing error: " + e)
            this.app.HandleError({type: "soft", detail: "unusal payload", service: "darksky", message: _("Failed to Process Weather Info")});
            return null;
        }
    };

    private ParseHourly(json: any): HourlyForecastData[] {
        return [];
    }

    private ParseDaily(json: any, ctx: Climacell): ForecastData[] {
        return [];
    }

    private ConstructQuery(subcall: CallType): string {
        let query;
        let key = this.app.config._apiKey.replace(" ", "");
        let location = this.app.config._location.replace(" ", "");
        if (this.app.config.noApiKey()) {
            this.app.log.Error("Climacell: No API Key given");
            this.app.HandleError({
                type: "hard",
                userError: true,
                "detail": "no key",
                message: _("Please enter API key in settings,\nor get one first on " + "https://developer.climacell.co/sign-up")});
            return "";
        }
        if (isCoordinate(location)) {
            query = this.baseUrl + this.callData[subcall].url+ "?apikey=" + key + "&lat=" + location + "&lon=" + "&unit_system=" + this.unit + "&fields=" +  this.callData[subcall].required_fields;
            return query;
        }
        else {
            this.app.log.Error("Climacell: Location is not a coordinate");
            this.app.HandleError({type: "hard", detail: "bad location format", service:"darksky", userError: true, message: ("Please Check the location,\nmake sure it is a coordinate") })
            return "";
        }
    };

    private ResolveCondition(condition: string): Condition {
        switch(condition) {
            case ("rain_heavy"):
                return {
                    customIcon: "refresh-symbolic",
                    description: _("Substantial rain"),
                    main: _("Substantial rain"),
                    icon: weatherIconSafely(["weather-cloudy"], this.app.config.IconType())
                }
            case ("rain"):
                return {
                    customIcon: "refresh-symbolic",
                    description: _(""),
                    main: _(""),
                    icon: weatherIconSafely(["weather-cloudy"], this.app.config.IconType())
                }
            case ("rain_light"):
                return {
                    customIcon: "refresh-symbolic",
                    description: _(""),
                    main: _(""),
                    icon: weatherIconSafely(["weather-cloudy"], this.app.config.IconType())
                }
            case ("freezing_rain_heavy"):
                return {
                    customIcon: "refresh-symbolic",
                    description: _(""),
                    main: _(""),
                    icon: weatherIconSafely(["weather-cloudy"], this.app.config.IconType())
                }
            case ("freezing_rain"):
                return {
                    customIcon: "refresh-symbolic",
                    description: _(""),
                    main: _(""),
                    icon: weatherIconSafely(["weather-cloudy"], this.app.config.IconType())
                }
            case ("freezing_rain_light"):
                return {
                    customIcon: "refresh-symbolic",
                    description: _(""),
                    main: _(""),
                    icon: weatherIconSafely(["weather-cloudy"], this.app.config.IconType())
                }
            case ("freezing_drizzle"):
                return {
                    customIcon: "refresh-symbolic",
                    description: _(""),
                    main: _(""),
                    icon: weatherIconSafely(["weather-cloudy"], this.app.config.IconType())
                }
            case ("drizzle"):
                return {
                    customIcon: "refresh-symbolic",
                    description: _(""),
                    main: _(""),
                    icon: weatherIconSafely(["weather-cloudy"], this.app.config.IconType())
                }
            case ("ice_pellets_heavy"):
                return {
                    customIcon: "refresh-symbolic",
                    description: _(""),
                    main: _(""),
                    icon: weatherIconSafely(["weather-cloudy"], this.app.config.IconType())
                }
            case ("ice_pellets"):
                return {
                    customIcon: "refresh-symbolic",
                    description: _(""),
                    main: _(""),
                    icon: weatherIconSafely(["weather-cloudy"], this.app.config.IconType())
                }
            case ("ice_pellets_light"):
                return {
                    customIcon: "refresh-symbolic",
                    description: _(""),
                    main: _(""),
                    icon: weatherIconSafely(["weather-cloudy"], this.app.config.IconType())
                }
            case ("snow_heavy"):
                return {
                    customIcon: "refresh-symbolic",
                    description: _(""),
                    main: _(""),
                    icon: weatherIconSafely(["weather-cloudy"], this.app.config.IconType())
                }
            case ("snow"):
                return {
                    customIcon: "refresh-symbolic",
                    description: _(""),
                    main: _(""),
                    icon: weatherIconSafely(["weather-cloudy"], this.app.config.IconType())
                }
            case ("snow_light"):
                return {
                    customIcon: "refresh-symbolic",
                    description: _(""),
                    main: _(""),
                    icon: weatherIconSafely(["weather-cloudy"], this.app.config.IconType())
                }
            case ("flurries"):
                return {
                    customIcon: "refresh-symbolic",
                    description: _(""),
                    main: _(""),
                    icon: weatherIconSafely(["weather-cloudy"], this.app.config.IconType())
                }
            case ("tstorm"):
                return {
                    customIcon: "refresh-symbolic",
                    description: _(""),
                    main: _(""),
                    icon: weatherIconSafely(["weather-cloudy"], this.app.config.IconType())
                }
            case ("fog_light"):
                return {
                    customIcon: "refresh-symbolic",
                    description: _(""),
                    main: _(""),
                    icon: weatherIconSafely(["weather-cloudy"], this.app.config.IconType())
                }
            case ("fog"):
                return {
                    customIcon: "refresh-symbolic",
                    description: _(""),
                    main: _(""),
                    icon: weatherIconSafely(["weather-cloudy"], this.app.config.IconType())
                }
            case ("cloudy"):
                return {
                    customIcon: "refresh-symbolic",
                    description: _(""),
                    main: _(""),
                    icon: weatherIconSafely(["weather-cloudy"], this.app.config.IconType())
                }
            case ("mostly_cloudy"):
                return {
                    customIcon: "refresh-symbolic",
                    description: _(""),
                    main: _(""),
                    icon: weatherIconSafely(["weather-cloudy"], this.app.config.IconType())
                }
            case ("partly_cloudy"):
                return {
                    customIcon: "refresh-symbolic",
                    description: _(""),
                    main: _(""),
                    icon: weatherIconSafely(["weather-cloudy"], this.app.config.IconType())
                }
            case ("mostly_clear"):
                return {
                    customIcon: "refresh-symbolic",
                    description: _(""),
                    main: _(""),
                    icon: weatherIconSafely(["weather-cloudy"], this.app.config.IconType())
                }
            case ("clear"):
                return {
                    customIcon: "refresh-symbolic",
                    description: _(""),
                    main: _(""),
                    icon: weatherIconSafely(["weather-cloudy"], this.app.config.IconType())
                }
            default:
                return {
                    customIcon: "refresh-symbolic",
                    description: _(""),
                    main: _(""),
                    icon: weatherIconSafely(["weather-cloudy"], this.app.config.IconType())
                }
        }
    }
};

/**
 * - 'si' returns meter/sec and Celsius
 * - 'us' returns miles/hour and Farhenheit
 */
type queryUnits = 'si' | 'us';

type CallType = "current" | "hourly" | "daily";
type CallDict = {
    [key in CallType]: CallData
}

interface CallData {
    url: string;
    required_fields: string[];
}


