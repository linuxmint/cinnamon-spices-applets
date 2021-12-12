//////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////
///////////                                       ////////////
///////////         OpenWeatherMap Premium        ////////////
///////////                                       ////////////
//////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////

import { DateTime } from "luxon";
import { HttpError, HTTPParams } from "../lib/httpLib";
import { Logger } from "../lib/logger";
import { WeatherApplet } from "../main";
import { WeatherProvider, WeatherData, ForecastData, HourlyForecastData, AppletError, BuiltinIcons, CustomIcons, LocationData, ImmediatePrecipitation } from "../types";
import { _, IsLangSupported } from "../utils";

/** Stores IDs for "lat,long" string, to be able to construct URLs for OpenWeatherMap Website */
const IDCache: Record<string, number> = {};

export class OpenWeatherMap implements WeatherProvider {
	//--------------------------------------------------------
	//  Properties
	//--------------------------------------------------------
	public readonly prettyName = _("OpenWeatherMap");
	public readonly name = "OpenWeatherMap";
	public readonly maxForecastSupport = 8;
	public readonly website = "https://openweathermap.org/";
	public readonly maxHourlyForecastSupport = 48;
	public readonly needsApiKey = false;

	private supportedLanguages = ["af", "al", "ar", "az", "bg", "ca", "cz", "da", "de", "el", "en", "eu", "fa", "fi",
		"fr", "gl", "he", "hi", "hr", "hu", "id", "it", "ja", "kr", "la", "lt", "mk", "no", "nl", "pl",
		"pt", "pt_br", "ro", "ru", "se", "sk", "sl", "sp", "es", "sr", "th", "tr", "ua", "uk", "vi", "zh_cn", "zh_tw", "zu"
	];

	private base_url = "https://api.openweathermap.org/data/2.5/onecall" //lat=51.5085&lon=-0.1257&appid={YOUR API KEY}"
	private id_irl  = "https://api.openweathermap.org/data/2.5/weather";

	private app: WeatherApplet
	constructor(_app: WeatherApplet) {
		this.app = _app;
	}

	//--------------------------------------------------------
	//  Functions
	//--------------------------------------------------------

	public async GetWeather(loc: LocationData): Promise<WeatherData | null> {
		const params = this.ConstructParams(loc);

		const cachedID = IDCache[`${loc.lat},${loc.lon}`];

		let promises: Promise<any>[] = [];
		promises.push(this.app.LoadJsonAsync<any>(this.base_url, params, this.HandleError));

		// If we don't have the ID we push a call to get it
		if (cachedID == null)
			promises.push(this.app.LoadJsonAsync<any>(this.id_irl, params));

		// Await both of them, if already have it idPayload will be null
		const [ json, idPayload ] = await Promise.all(promises);

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

	private ParseWeather(json: any, loc: LocationData): WeatherData | null {
		try {
			let weather: WeatherData = {
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
				let immediate: ImmediatePrecipitation = {
					start: -1,
					end: -1
				}

				for (let index = 0; index < json.minutely.length; index++) {
					const element = json.minutely[index];
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

			let forecasts: ForecastData[] = [];
			for (let i = 0; i < json.daily.length; i++) {
				let day = json.daily[i];
				let forecast: ForecastData = {
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

			let hourly: HourlyForecastData[] = [];
			for (let index = 0; index < json.hourly.length; index++) {
				const hour = json.hourly[index];
				let forecast: HourlyForecastData = {
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
					forecast.precipitation.volume = hour.rain["1h"];
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
		let locale: string = this.ConvertToAPILocale(this.app.config.currentLocale);
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

	private HadErrors(json: any): boolean {
		if (!this.HasReturnedError(json)) return false;
		let errorMsg = "OpenWeatherMap Response: ";
		let error = {
			service: "openweathermap",
			type: "hard",
		} as AppletError;
		let errorPayload: OpenWeatherMapError = json;
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

	public HandleError = (error: HttpError): boolean => {
		if (error.code == 404) {
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