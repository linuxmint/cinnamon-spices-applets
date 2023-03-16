//////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////
///////////                                       ////////////
///////////         OpenWeatherMap Premium        ////////////
///////////                                       ////////////
//////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////

import { DateTime } from "luxon";
import { ErrorResponse, HttpError, HTTPParams } from "../lib/httpLib";
import { Logger } from "../lib/logger";
import { WeatherApplet } from "../main";
import { WeatherProvider, WeatherData, ForecastData, HourlyForecastData, AppletError, BuiltinIcons, CustomIcons, LocationData, ImmediatePrecipitation } from "../types";
import { _, IsLangSupported } from "../utils";
import { BaseProvider } from "./BaseProvider";

/** Stores IDs for "lat,long" string, to be able to construct URLs for OpenWeatherMap Website */
const IDCache: Record<string, number> = {};

export class OpenWeatherMap extends BaseProvider {
	//--------------------------------------------------------
	//  Properties
	//--------------------------------------------------------
	public readonly prettyName = _("OpenWeatherMap");
	public readonly name = "OpenWeatherMap";
	public readonly maxForecastSupport = 8;
	public readonly website = "https://openweathermap.org/";
	public readonly maxHourlyForecastSupport = 48;
	public readonly needsApiKey = false;
	public readonly remainingCalls: number | null = null;
	public readonly supportHourlyPrecipChance = true;
	public readonly supportHourlyPrecipVolume = true;

	private supportedLanguages = ["af", "al", "ar", "az", "bg", "ca", "cz", "da", "de", "el", "en", "eu", "fa", "fi",
		"fr", "gl", "he", "hi", "hr", "hu", "id", "it", "ja", "kr", "la", "lt", "mk", "no", "nl", "pl",
		"pt", "pt_br", "ro", "ru", "se", "sk", "sl", "sp", "es", "sr", "th", "tr", "ua", "uk", "vi", "zh_cn", "zh_tw", "zu"
	];

	private base_url = "https://api.openweathermap.org/data/2.5/onecall" //lat=51.5085&lon=-0.1257&appid={YOUR API KEY}"
	private id_irl  = "https://api.openweathermap.org/data/2.5/weather";

	constructor(_app: WeatherApplet) {
		super(_app);
	}

	//--------------------------------------------------------
	//  Functions
	//--------------------------------------------------------

	public async GetWeather(loc: LocationData): Promise<WeatherData | null> {
		const params = this.ConstructParams(loc);

		const cachedID = IDCache[`${loc.lat},${loc.lon}`];

		// Await both of them, if already have it idPayload will be null
		// If we don't have the ID we push a call to get it
		const [ json, idPayload ] = await Promise.all([
			this.app.LoadJsonAsync<OWMPayload>(this.base_url, params, this.HandleError),
			(cachedID == null) ? this.app.LoadJsonAsync<any>(this.id_irl, params) : Promise.resolve()
		]);

		// We store the newly gotten ID if we got it
		if (cachedID == null && idPayload?.id != null)
			IDCache[`${loc.lat},${loc.lon}`] = idPayload.id;

		if (!json)
			return null;

		if (this.HadErrors(json)) return null;

		// Put id to the parsable object, even if it ends up undefined
		json.id = cachedID ?? idPayload?.id;
		return this.ParseWeather(json, loc);
	};

	public RanOutOfQuota(loc: LocationData): boolean | null {
		return null;
	}

	private ParseWeather(json: OWMPayload, loc: LocationData): WeatherData | null {
		try {
			const weather: WeatherData = {
				coord: {
					lat: json.lat,
					lon: json.lon
				},
				location: {
					//city: json.name,
					//country: json.sys.country,
					url: (json.id == null) ? "https://openweathermap.org/city/" : `https://openweathermap.org/city/${json.id}`,
					timeZone: json.timezone
				},
				date: DateTime.fromSeconds(json.current.dt, { zone: json.timezone }),
				sunrise: DateTime.fromSeconds(json.current.sunrise, { zone: json.timezone }),
				sunset: DateTime.fromSeconds(json.current.sunset, { zone: json.timezone }),
				wind: {
					speed: json.current.wind_speed,
					degree: json.current.wind_deg
				},
				temperature: json.current.temp,
				pressure: json.current.pressure,
				humidity: json.current.humidity,
				dewPoint: json.current.dew_point,
				condition: {
					main: json?.current?.weather?.[0]?.main,
					description: json?.current?.weather?.[0]?.description,
					icons: this.ResolveIcon(json?.current?.weather?.[0]?.icon),
					customIcon: this.ResolveCustomIcon(json?.current?.weather?.[0]?.icon)
				},
				extra_field: {
					name: _("Feels Like"),
					value: json.current.feels_like,
					type: "temperature"
				},
				forecasts: []
			};

			if (json.minutely != null) {
				const immediate: ImmediatePrecipitation = {
					start: -1,
					end: -1
				}

				for (const [index, element] of json.minutely.entries()) {
					if (element.precipitation > 0 && immediate.start == -1) {
						immediate.start = index;
						continue
					}
					else if (element.precipitation == 0 && immediate.start != -1) {
						immediate.end = index;
						break
					}
				}
				weather.immediatePrecipitation = immediate;
			}

			const forecasts: ForecastData[] = [];
			for (const day of json.daily) {
				const forecast: ForecastData = {
					date: DateTime.fromSeconds(day.dt, { zone: json.timezone }),
					temp_min: day.temp.min,
					temp_max: day.temp.max,
					condition: {
						main: day.weather[0].main,
						description: day.weather[0].description,
						icons: this.ResolveIcon(day.weather[0].icon),
						customIcon: this.ResolveCustomIcon(day.weather[0].icon)
					},
				};
				forecasts.push(forecast);
			}
			weather.forecasts = forecasts;

			const hourly: HourlyForecastData[] = [];
			for (const hour of json.hourly) {
				const forecast: HourlyForecastData = {
					date: DateTime.fromSeconds(hour.dt, { zone: json.timezone }),
					temp: hour.temp,
					condition: {
						main: hour.weather[0].main,
						description: hour.weather[0].description,
						icons: this.ResolveIcon(hour.weather[0].icon),
						customIcon: this.ResolveCustomIcon(hour.weather[0].icon)
					},
				}

				if (hour.pop >= 0.1) {
					forecast.precipitation = {
						chance: hour.pop * 100,
						type: "none",
						//volume: undefined
					}
				}

				if (!!hour.rain && forecast.precipitation != null) {
					forecast.precipitation.volume = hour?.rain["1h"];
					forecast.precipitation.type = "rain";
				}

				// Snow takes precedence
				if (!!hour.snow && forecast.precipitation != null) {
					forecast.precipitation.volume = hour.snow["1h"];
					forecast.precipitation.type = "snow"
				}

				hourly.push(forecast);
			}

			weather.hourlyForecasts = hourly;
			return weather;
		} catch (e) {
			if (e instanceof Error)
				Logger.Error("OpenWeatherMap Weather Parsing error: " + e, e);
			this.app.ShowError({
				type: "soft",
				service: "openweathermap",
				detail: "unusual payload",
				message: _("Failed to Process Current Weather Info")
			})
			return null;
		}
	};


	private ConstructParams(loc: LocationData): HTTPParams {
		const params: HTTPParams = {
			lat: loc.lat,
			lon: loc.lon,
			appid: "1c73f8259a86c6fd43c7163b543c8640"
		};

		// Append Language if supported and enabled
		const locale: string = this.ConvertToAPILocale(this.app.config.currentLocale);
		if (this.app.config._translateCondition && IsLangSupported(locale, this.supportedLanguages)) {
			params.lang = locale;
		}
		return params;
	};

	private ConvertToAPILocale(systemLocale: string | null) {
		if (systemLocale == null)
			return "en";

		// Dialect? support by OWM
		if (systemLocale == "zh-cn" || systemLocale == "zh-cn" || systemLocale == "pt-br") {
			return systemLocale;
		}
		const lang = systemLocale.split("-")[0];
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

	private HadErrors(json: any): boolean {
		if (!this.HasReturnedError(json)) return false;
		const errorMsg = "OpenWeatherMap Response: ";
		const error = {
			service: "openweathermap",
			type: "hard",
		} as AppletError;
		const errorPayload: OpenWeatherMapError = json;
		switch (errorPayload.cod) {
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
		this.app.ShowError(error);
		Logger.Debug("OpenWeatherMap Error Code: " + errorPayload.cod)
		Logger.Error(errorMsg + errorPayload.message);
		return true;
	};

	private HasReturnedError(json: any) {
		return (!!json?.cod);
	}

	public HandleError = (error: ErrorResponse): boolean => {
		if (error.ErrorData.code == 404) {
			this.app.ShowError({
				detail: "location not found",
				message: _("Location not found, make sure location is available or it is in the correct format"),
				userError: true,
				type: "hard"
			})
			return false;
		}
		return true;
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

interface OpenWeatherMapError {
	cod: string;
	message: string;
}

interface OWMPayload {
	/** Not existing in original payload, it's for injecting from other payload manually */
	id?: number;
	lat: number;
	lon: number;
	timezone: string;
	timezone_offset: number;
	current: CurrentPayload;
	minutely?: MinutelyPayload[];
	hourly: HourlyPayload[];
	daily: DailyPayload[];
	alerts?: AlertPayload[]
}

interface CurrentPayload {
	/** Unix timestamp seconds */
	dt: number;
	/** Unix timestamp seconds */
	sunrise: number;
	/** Unix timestamp seconds */
    sunset: number;
	/** Kelvin */
    temp: number;
	/** Kelvin */
    feels_like: number;
	/** hPa */
    pressure: number;
	/** % */
    humidity: number;
	/** Kelvin */
    dew_point: number;
	/** UV index */
    uvi: number;
	/** % */
    clouds: number;
	/** Average in metres */
    visibility: number;
	/** m/s */
    wind_speed: number;
	/** m/s, where available */
	wind_gust?: number;
	/** Meteorological degrees */
    wind_deg: number;
    weather: ConditionPayload[];
    rain?: PrecipitationPayload;
	snow?: PrecipitationPayload;
}

interface MinutelyPayload {
	/** Unix timestamp seconds */
	dt: number;
	/** mm */
	precipitation: number;
}

interface HourlyPayload {
	/** Unix timestamp seconds */
	dt: number;
	/** Kelvin */
    temp: number;
	/** Kelvin */
    feels_like: number;
	/** hPa */
    pressure: number;
	/** % */
    humidity: number;
	/** Kelvin */
    dew_point: number;
	/** UV index */
    uvi: number;
	/** % */
    clouds: number;
	/** Average in metres */
    visibility: number;
	/** m/s */
    wind_speed: number;
	/** m/s, where available */
	wind_gust?: number;
	/** Meteorological degrees */
    wind_deg: number;
	/** Probability of precipitation, percent between 0 and 1  */
	pop: number;
	weather: ConditionPayload[];
	rain?: PrecipitationPayload;
	snow?: PrecipitationPayload;
}

interface DailyPayload {
	/** Unix timestamp seconds */
	dt: number;
	/** Unix timestamp seconds */
	sunrise: number;
	/** Unix timestamp seconds */
    sunset: number;
	/** Unix timestamp seconds */
	moonrise: number;
	/** Unix timestamp seconds */
    moonset: number;
	/**  Moon phase. 0 and 1 are 'new moon', 0.25 is 'first quarter moon', 0.5 is 'full moon' and 0.75 is 'last quarter moon'. The periods in between are called 'waxing crescent', 'waxing gibous', 'waning gibous', and 'waning crescent', respectively. */
	moon_phase: number;
	temp: {
		/** Morning temperature. Kelvin. */
		morn: number;
		/** Day temperature. Kelvin */
		day: number;
		/** Evening temperature. Kelvin */
		eve: number;
		/** Night temperature. */
		night: number;
		/** Min daily temperature. */
		min: number;
		/** Max daily temperature. */
		max: number;
	}
	feels_like: {
		/** Morning temperature. Kelvin. */
		morn: number;
		/** Day temperature. Kelvin */
		day: number;
		/** Evening temperature. Kelvin */
		eve: number;
		/** Night temperature. */
		night: number;
	}
	/** hPa */
    pressure: number;
	/** % */
    humidity: number;
	/** Kelvin */
    dew_point: number;
	/** UV index */
    uvi: number;
	/** % */
    clouds: number;
	/** Probability of precipitation, percent between 0 and 1  */
	pop: number;
	/** Volume, mm */
	rain?: number;
	/** Volume, mm */
	snow?: number;
	weather: ConditionPayload[];
}

interface AlertPayload {
	sender_name: string;
	event: string;
	/** Date and time of the start of the alert, Unix, UTC */
	start: number;
	/** Date and time of the end of the alert, Unix, UTC */
	end: number;
	description: string;
	tags: string[];
}

interface ConditionPayload {
	/** [Weather condition id](https://openweathermap.org/weather-conditions#Weather-Condition-Codes-2) */
	id: number;
	/** Group of weather parameters (Rain, Snow, Extreme etc.) */
	main: string;
	/**  Weather condition within the group ([full list of weather conditions](https://openweathermap.org/weather-conditions#Weather-Condition-Codes-2)).*/
	description: string;
	/** Weather icon id */
	icon: string;
}

interface PrecipitationPayload {
	/** Volume, mm */
	"1h"?: number;
}

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