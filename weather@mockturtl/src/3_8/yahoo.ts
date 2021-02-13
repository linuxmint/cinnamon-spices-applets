//////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////
///////////                                       ////////////
///////////                 Yahoo                 ////////////
///////////                                       ////////////
//////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////

import { SpawnProcessJson } from "./commandRunner";
import { Log } from "./logger";
import { WeatherApplet } from "./main";
import { NotificationService } from "./notification_service";
import { SunTimes } from "./sunCalc";
import { WeatherProvider, WeatherData, ForecastData, BuiltinIcons, CustomIcons, LocationData } from "./types";
import { _, WeatherIconSafely, CelsiusToKelvin, KPHtoMPS } from "./utils";

export class Yahoo implements WeatherProvider {

    //--------------------------------------------------------
    //  Properties
    //--------------------------------------------------------
    public readonly prettyName = "Yahoo";
    public readonly name = "Yahoo";
    public readonly maxForecastSupport = 10;
    public readonly website = "https://www.yahoo.com/news/weather/";
    public readonly maxHourlyForecastSupport = 0;
    public readonly needsApiKey = false;

    private app: WeatherApplet

    constructor(_app: WeatherApplet) {
        this.app = _app;
    }

    //--------------------------------------------------------
    //  Functions
    //--------------------------------------------------------
    public async GetWeather(loc: LocationData): Promise<WeatherData> {
        if (loc == null)
            return null;
        let response = await SpawnProcessJson<YahooPayload>(["python3", this.app.AppletDir + "/../yahoo-bridge.py", "--params", JSON.stringify({ lat: loc.lat.toString(), lon: loc.lon.toString() })]);
        
        if (!response.Success) {
            if (response.ErrorData.Type == "jsonParse")
                this.app.ShowError({ type: "hard", service: "yahoo", detail: "bad api response - non json", message: _("Yahoo bridge responded in bad format,\n see Looking Glass log for errors") })
            else
                this.app.ShowError({ type: "hard", service: "yahoo", detail: "unknown", message: _("Unknown Error happened while calling Yahoo bridge,\n see Looking Glass log for errors") })
            
            Log.Instance.Error("Yahoo API bridge call failed, error: " + response.ErrorData.Message);
            return null;
        }

        Log.Instance.Debug2("Yahoo API response: " + response);


        if (!(response.Data as any as BridgeError)?.error) {                   // No error object, Request Success
            return this.ParseWeather(response.Data);
        }
        else {
            this.HandleResponseErrors(response.Data as any);
            return null;
        }
    };


    private ParseWeather(json: YahooPayload): WeatherData {
        try {
            let sunrise = this.TimeToDateObj(json.current_observation.astronomy.sunrise);
            let sunset = this.TimeToDateObj(json.current_observation.astronomy.sunset);
            let result: WeatherData = {
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
                    name: _("Feels Like"),
                    value: this.ToKelvin(json.current_observation.wind.chill),
                    type: "temperature"
                },
                forecasts: []
            }
            // Forecast
            for (let i = 0; i < json.forecasts.length; i++) {
                let day = json.forecasts[i];
                let forecast: ForecastData = {
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

                // JS assumes time is local, so it applies the correct offset creating the Date (including Daylight Saving)
                // but when using the date when daylight saving is active, it DOES NOT apply the DST back,
                // So we offset the date to make it Noon
                //forecast.date.setHours(forecast.date.getHours() + 12);

                result.forecasts.push(forecast);
            }
            return result;
        }
        catch (e) {
            Log.Instance.Error("Yahoo payload parsing error: " + e)
            this.app.ShowError({ type: "soft", detail: "unusual payload", service: "yahoo", message: _("Failed to Process Weather Info") });
            return null;
        }
    };

    private HandleResponseErrors(json: BridgeError): void {
        let type = json.error.type;
        let errorMsg = "Yahoo bridge: "
        Log.Instance.Debug("yahoo API error payload: " + json);
        switch (type) {
            case "import":
                NotificationService.Instance.Send(
					_("Missing package"),
					_("Please install '{missingPackage}', then refresh manually.", {"missingPackage": this.GetMissingPackage(json)})
				);
                Log.Instance.Error(errorMsg + json.error.message);
                this.app.ShowError({ 
					detail: "import error",
					type: "hard",
					userError: true,
					service: "yahoo",
					message: _("Please install '{missingPackage}', then refresh manually.", {"missingPackage": this.GetMissingPackage(json)})
				})
                break;
            case "network":
                this.app.ShowError({
					detail: "no api response",
					type: "soft",
					service: "yahoo",
					message: _("Could not connect to Yahoo API.")
				})
                Log.Instance.Error(errorMsg + "Could not connect to API, error - " + json.error.data);
                break;
            case "unknown":
                this.app.ShowError({ 
					detail: "no api response",
					type: "hard",
					service: "yahoo",
					message: _("Unknown error happened while obtaining weather, see Looking Glass logs for more information")
				})
                Log.Instance.Error(errorMsg + "Unknown Error happened in yahoo bridge, error - " + json.error.data);
                break
            default:
                Log.Instance.Error(errorMsg + json.error.message);
                break
        }
    };

    /**
     * Data returned from python containing Exception info
     * @param error 
     */
    private GetMissingPackage(error: BridgeError): string {
        let pythonModule = error.error.data.split("'")[1];
        if (pythonModule == "requests_oauthlib") {
            return "python3-requests-oauthlib"
        }
        return pythonModule;
    }

    private IsNight(sunTimes: SunTimes): boolean {
        if (!sunTimes) return false;
        let now = new Date();
        if (now < sunTimes.sunrise || now > sunTimes.sunset) return true;
        return false;
    }

    private ResolveIcon(icon: number, sunTimes?: SunTimes): BuiltinIcons[] {
        switch (icon) {
            case 0: // tornado
                return ["weather-severe-alert"];
            case 1: // tropical storm
                return ["weather-severe-alert"];
            case 2: // hurricane
                return ["weather-severe-alert"];
            case 3: // severe thunderstorms
                return ["weather-storm"];
            case 4: // thunderstorms
                return ["weather-storm"];
            case 5: // mixed rain and snow
                return ["weather-rain", "weather-showers-scattered", "weather-freezing-rain"];
            case 6: // mixed rain and sleet
                return ["weather-freezing-rain", "weather-rain", "weather-showers-scattered"];
            case 7: // mixed snow and sleet
                return ["weather-snow"];
            case 8: // freezing drizzle
                return ["weather-freezing-rain", "weather-rain", "weather-showers-scattered"];
            case 9: // drizzle
                return ["weather-freezing-rain", "weather-rain", "weather-showers-scattered"];
            case 10: // freezing rain
                return ["weather-freezing-rain", "weather-rain", "weather-showers-scattered"];
            case 11: // showers
                return ["weather-showers", "weather-showers-scattered"];
            case 12: // rain
                return ["weather-rain", "weather-showers-scattered", "weather-freezing-rain"];
            case 13: // snow flurries
                return ["weather-snow"];
            case 14: // light snow showers
                return ["weather-snow"];
            case 15: // blowing snow
                return ["weather-snow"];
            case 16: // snow
                return ["weather-snow"];
            case 17: // hail
                return ["weather-rain", "weather-showers-scattered", "weather-freezing-rain"];
            case 18: // sleet
                return ["weather-rain", "weather-showers-scattered", "weather-freezing-rain"];
            case 19: // dust
                return ["weather-fog"];
            case 20: // foggy
                return ["weather-fog"];
            case 21: // haze
                return ["weather-fog"];
            case 22: // smoky
                return ["weather-fog"];
            case 23: // blustery
                return (sunTimes && this.IsNight(sunTimes)) ? ["weather-windy", "weather-breeze", "weather-clouds-night", "weather-few-clouds-night"] : ["weather-windy", "weather-breeze", "weather-clouds", "weather-few-clouds"];
            case 24: // windy
                return (sunTimes && this.IsNight(sunTimes)) ? ["weather-windy", "weather-breeze", "weather-clouds-night", "weather-few-clouds-night"] : ["weather-windy", "weather-breeze", "weather-clouds", "weather-few-clouds"];
            case 25: // cold
                return ["weather-severe-alert"];
            case 26: // cloudy
                return (sunTimes && this.IsNight(sunTimes)) ? ["weather-overcast", "weather-clouds-night", "weather-few-clouds-night"] : ["weather-overcast", "weather-clouds", "weather-few-clouds"];
            case 27: // mostly cloudy (night)
                return ["weather-few-clouds-night"];
            case 28: //	mostly cloudy (day)
                return ["weather-few-clouds"];
            case 29: // partly cloudy (night)
                return ["weather-few-clouds-night"];
            case 30: // partly cloudy (day)
                return ["weather-few-clouds"];
            case 31: // clear (night)
                return ["weather-clear-night"];
            case 32: // sunny
                return ["weather-clear"];
            case 33: // fair (night)
                return ["weather-clear-night"];
            case 34: // fair (day)
                return ["weather-clear"];
            case 35: // mixed rain and hail
                return ["weather-rain", "weather-showers-scattered", "weather-freezing-rain"];
            case 36: // hot
                return ["weather-severe-alert"];
            case 37: // isolated thunderstorms
                return ["weather-storm"];
            case 38: // scattered thunderstorms
                return ["weather-storm"];
            case 39: // scattered showers (day)
                return ["weather-showers", "weather-showers-scattered"];
            case 40: // heavy rain
                return ["weather-rain", "weather-showers-scattered", "weather-freezing-rain"];
            case 41: // scattered snow showers (day)
                return ["weather-snow"];
            case 42: // heavy snow
                return ["weather-snow"];
            case 43: // blizzard
                return ["weather-snow"];
            case 44: // not available
                return ["weather-severe-alert"];
            case 45: // scattered showers (night)
                return ["weather-showers", "weather-showers-scattered"];
            case 46: // scattered snow showers (night)
                return ["weather-showers", "weather-showers-scattered"];
            case 47: // scattered thundershowers
                return ["weather-storm"];
            default:
                return ["weather-severe-alert"];
        }
    };

    private ResolveCustomIcon(icon: number): CustomIcons {
        switch (icon) {
            case 0: // tornado
                return "tornado-symbolic";
            case 1: // tropical storm
                return "hurricane-symbolic";
            case 2: // hurricane
                return "hurricane-warning-symbolic";
            case 3: // severe thunderstorms
                return "thunderstorm-symbolic";
            case 4: // thunderstorms
                return "thunderstorm-symbolic";
            case 5: // mixed rain and snow
                return "rain-mix-symbolic";
            case 6: // mixed rain and sleet
                return "rain-mix-symbolic";
            case 7: // mixed snow and sleet
                return "snow-symbolic";
            case 8: // freezing drizzle
                return "rain-symbolic";
            case 9: // drizzle
                return "rain-symbolic";
            case 10: // freezing rain
                return "rain-symbolic";
            case 11: // showers
                return "showers-symbolic";
            case 12: // rain
                return "rain-symbolic";
            case 13: // snow flurries
                return "snow-wind-symbolic";
            case 14: // light snow showers
                return "snow-symbolic";
            case 15: // blowing snow
                return "snow-wind-symbolic";
            case 16: // snow
                return "snow-symbolic";
            case 17: // hail
                return "hail-symbolic";
            case 18: // sleet
                return "sleet-symbolic";
            case 19: // dust
                return "dust-symbolic";
            case 20: // foggy
                return "fog-symbolic";
            case 21: // haze
                return "fog-symbolic";
            case 22: // smoky
                return "fog-symbolic";
            case 23: // blustery
                return "windy-symbolic";
            case 24: // windy
                return "windy-symbolic";
            case 25: // cold -TODO: no icon
                return "cloud-refresh-symbolic";
            case 26: // cloudy
                return "cloudy-symbolic";
            case 27: // mostly cloudy (night)
                return "night-cloudy-symbolic";
            case 28: //	mostly cloudy (day)
                return "day-cloudy-symbolic";
            case 29: // partly cloudy (night)
                return "night-cloudy-symbolic";
            case 30: // partly cloudy (day)
                return "day-cloudy-symbolic";
            case 31: // clear (night)
                return "night-clear-symbolic";
            case 32: // sunny
                return "day-sunny-symbolic";
            case 33: // fair (night)
                return "night-clear-symbolic";
            case 34: // fair (day)
                return "day-sunny-symbolic";
            case 35: // mixed rain and hail
                return "hail-symbolic";
            case 36: // hot
                return "hot-symbolic";
            case 37: // isolated thunderstorms
                return "storm-showers-symbolic";
            case 38: // scattered thunderstorms
                return "storm-showers-symbolic";
            case 39: // scattered showers (day)
                return "day-showers-symbolic";
            case 40: // heavy rain
                return "rain-symbolic";
            case 41: // scattered snow showers (day)
                return "day-snow-symbolic";
            case 42: // heavy snow
                return "snow-symbolic";
            case 43: // blizzard
                return "snow-wind-symbolic";
            case 44: // not available
                return "cloud-refresh-symbolic";
            case 45: // scattered showers (night)
                return "night-showers-symbolic";
            case 46: // scattered snow showers (night)
                return "night-snow-thunderstorm-symbolic";
            case 47: // scattered thundershowers
                return "thunderstorm-symbolic";
            default:
                return "cloud-refresh-symbolic";
        }
    }

    private ToKelvin(temp: number): number {
        return CelsiusToKelvin(temp);
    };

    private ToMPS(speed: number): number {
        return KPHtoMPS(speed);
    };

    private TimeToDateObj(time: string): Date {
        let times = time.split(" ");
        let hoursMinutes = times[0].split(":");
        let amPm = times[1];
        let today = new Date();
        today.setHours(parseInt(hoursMinutes[0]) + ((amPm == "pm") ? 12 : 0));
        today.setMinutes(parseInt(hoursMinutes[1]));
        return today;
    }
};

interface BridgeError {
    error: {
        type: BridgeErrorType;
        message: string;
        data: string
    }
}

type BridgeErrorType = "import" | "network" | "unknown";

interface YahooPayload {
    location: {
        city: string;
        region: string;
        woeid: number;
        country: string;
        lat: number;
        long: number;
        timezone_id: string;
    };
    current_observation: {
        wind: {
            chill: number;
            direction: number;
            speed: number;
        };
        atmosphere: {
            humidity: number;
            visibility: number;
            pressure: number;
            rising: number;
        };
        astronomy: {
            /** hours minutes in pm format */
            sunrise: string;
            /** hours minutes in pm format */
            sunset: string;
        };
        condition: {
            text: string;
            code: number;
            temperature: 2
        };
        /** Epoch seconds */
        pubDate: number;
    };
    forecasts: YahooForecast[];
}

interface YahooForecast {
    /** Short day name */
    day: string;
    /** epoch seconds */
    date: number;
    low: number;
    high: number;
    text: string;
    code: number;
}

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
	_("Mostly Sunny"),
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