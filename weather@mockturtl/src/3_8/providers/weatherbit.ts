//////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////
///////////                                       ////////////
///////////                Weatherbit             ////////////
///////////                                       ////////////
//////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////

import { DateTime } from "luxon";
import { ErrorResponse, HttpError } from "../lib/httpLib";
import { Logger } from "../lib/logger";
import { WeatherApplet } from "../main";
import { WeatherProvider, WeatherData, ForecastData, HourlyForecastData, BuiltinIcons, CustomIcons, LocationData } from "../types";
import { _, IsLangSupported } from "../utils";
import { BaseProvider } from "./BaseProvider";

export class Weatherbit extends BaseProvider {

	//--------------------------------------------------------
	//  Properties
	//--------------------------------------------------------
	public readonly prettyName = _("WeatherBit");
	public readonly name = "Weatherbit";
	public readonly maxForecastSupport = 16;
	public readonly website = "https://www.weatherbit.io/";
	public readonly maxHourlyForecastSupport = 48;
	public readonly needsApiKey = true;
	public readonly supportHourlyPrecipChance = true;
	public readonly supportHourlyPrecipVolume = true;

	public get remainingCalls(): number | null {
		return null;
	};

	private supportedLanguages = [
		'ar', 'az', 'be', 'bg', 'bs', 'ca', 'cz', 'da', 'de', 'el', 'en',
		'et', 'fi', 'fr', 'hr', 'hu', 'id', 'is', 'it',
		'kw', 'lv', 'nb', 'nl', 'pl', 'pt', 'ro', 'ru', 'sk', 'sl', 'sr',
		'sv', 'tr', 'uk', 'zh', 'zh-tw'];

	private current_url = "https://api.weatherbit.io/v2.0/current?";
	private daily_url = "https://api.weatherbit.io/v2.0/forecast/daily?";
	private hourly_url = "https://api.weatherbit.io/v2.0/forecast/hourly?";

	private hourlyAccess = true;

	constructor(_app: WeatherApplet) {
		super(_app);
	}

	//--------------------------------------------------------
	//  Functions
	//--------------------------------------------------------
	public async GetWeather(loc: LocationData): Promise<WeatherData | null> {
		const forecastPromise = this.GetData(this.daily_url, loc, this.ParseForecast) as Promise<ForecastData[]>;
		let hourlyPromise = null;
		if (!!this.hourlyAccess) hourlyPromise = this.GetHourlyData(this.hourly_url, loc);
		const currentResult = await this.GetData(this.current_url, loc, this.ParseCurrent) as WeatherData;
		if (!currentResult) return null;

		const forecastResult = await forecastPromise;
		currentResult.forecasts = (!forecastResult) ? [] : forecastResult;
		const hourlyResult = await hourlyPromise;
		currentResult.hourlyForecasts = (!hourlyResult) ? [] : hourlyResult;
		return currentResult;
	};

	// A function as a function parameter 2 levels deep does not know
	// about the top level object information, has to pass it in as a parameter
	/**
	 *
	 * @param baseUrl
	 * @param ParseFunction returns WeatherData or ForecastData Object
	 */
	private async GetData(baseUrl: string, loc: LocationData, ParseFunction: (json: any) => WeatherData | ForecastData[] | HourlyForecastData[] | null) {
		const query = this.ConstructQuery(baseUrl, loc);
		if (query == null)
			return null;

		const json = await this.app.LoadJsonAsync(query, undefined, (e) => this.HandleError(e));

		if (json == null)
			return null;

		return ParseFunction(json);
	}

	private async GetHourlyData(baseUrl: string, loc: LocationData) {
		const query = this.ConstructQuery(baseUrl, loc);
		if (query == null)
			return null;

		const json = await this.app.LoadJsonAsync<any>(query, undefined, (e) => this.HandleHourlyError(e));

		if (!!json?.error) {
			return null;
		}

		if (json == null)
			return null;

		return this.ParseHourlyForecast(json);
	};

	private ParseCurrent = (json: any): WeatherData | null => {
		json = json.data[0];
		const hourDiff = this.HourDifference(DateTime.fromSeconds(json.ts, { zone: json.timezone }), this.ParseStringTime(json.ob_time, json.timezone));
		if (hourDiff != 0) Logger.Debug("Weatherbit reporting incorrect time, correcting with " + (0 - hourDiff).toString() + " hours");
		try {
			const weather: WeatherData = {
				coord: {
					lat: json.lat,
					lon: json.lon
				},
				location: {
					city: json.city_name,
					country: json.country_code,
					//url: undefined,
					timeZone: json.timezone
				},
				date: DateTime.fromSeconds(json.ts, { zone: json.timezone }),
				sunrise: this.TimeToDate(json.sunrise, hourDiff, json.timezone),
				sunset: this.TimeToDate(json.sunset, hourDiff, json.timezone),
				wind: {
					speed: json.wind_spd,
					degree: json.wind_dir
				},
				temperature: json.temp,
				pressure: json.pres,
				humidity: json.rh,
				dewPoint: json.dewpt,
				condition: {
					main: json.weather.description,
					description: json.weather.description,
					icons: this.ResolveIcon(json.weather.icon),
					customIcon: this.ResolveCustomIcon(json.weather.icon)
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
			if (e instanceof Error)
				Logger.Error("Weatherbit Weather Parsing error: " + e, e);
			this.app.ShowError({ type: "soft", service: "weatherbit", detail: "unusual payload", message: _("Failed to Process Current Weather Info") })
			return null;
		}
	};

	private ParseForecast = (json: any): ForecastData[] | null => {
		const forecasts: ForecastData[] = [];
		try {
			for (const day of json.data) {
				const forecast: ForecastData = {
					date: DateTime.fromSeconds(day.ts, { zone: json.timezone }),
					temp_min: day.min_temp,
					temp_max: day.max_temp,
					condition: {
						main: day.weather.description,
						description: day.weather.description,
						icons: this.ResolveIcon(day.weather.icon),
						customIcon: this.ResolveCustomIcon(day.weather.icon)
					},
				};
				forecasts.push(forecast);
			}
			return forecasts;
		}
		catch (e) {
			if (e instanceof Error)
				Logger.Error("Weatherbit Forecast Parsing error: " + e, e);
			this.app.ShowError({ type: "soft", service: "weatherbit", detail: "unusual payload", message: _("Failed to Process Forecast Info") })
			return null;
		}
	};

	private ParseHourlyForecast = (json: any): HourlyForecastData[] | null => {
		const forecasts: HourlyForecastData[] = [];
		try {
			for (const hour of json.data.length) {
				const forecast: HourlyForecastData = {
					date: DateTime.fromSeconds(hour.ts, { zone: json.timezone }),
					temp: hour.temp,
					condition: {
						main: hour.weather.description,
						description: hour.weather.description,
						icons: this.ResolveIcon(hour.weather.icon),
						customIcon: this.ResolveCustomIcon(hour.weather.icon)
					},
					precipitation: {
						type: "rain",
						volume: hour.precip,
						chance: hour.pop
					}
				};
				if (!!forecast.precipitation && hour.snow != 0) {
					forecast.precipitation.type = "snow";
					forecast.precipitation.volume = hour.snow;
				}
				forecasts.push(forecast);
			}
			return forecasts;
		}
		catch (e) {
			if (e instanceof Error)
				Logger.Error("Weatherbit Forecast Parsing error: " + e, e);
			this.app.ShowError({ type: "soft", service: "weatherbit", detail: "unusual payload", message: _("Failed to Process Forecast Info") })
			return null;
		}
	}


	private TimeToDate(time: string, hourDiff: number, tz: string): DateTime {
		const hoursMinutes = time.split(":");
		const date = DateTime.utc().set(
			{
				hour: parseInt(hoursMinutes[0]) - hourDiff,
				minute: parseInt(hoursMinutes[1]),
			}).setZone(tz);
		return date;
	}


	/**
	 * Weatherbit does not consider Daylight saving time when returning Dates
	 * in string format, but we can check if unix timestamp and date string has mismatch
	 * to figure out if it's an incorrect Date.
	 *
	 * @param ts unix timestamp initialized as Date from payload
	 * @param last_ob_time last refresh time in string format
	 * @returns the hour difference of incorrect time from correct time
	 */
	private HourDifference(correctTime: DateTime, incorrectTime: DateTime | null): number {
		if (incorrectTime == null)
			return 0;

		return Math.round((incorrectTime.hour - correctTime.hour) / (1000 * 60 * 60));
	}

	private ParseStringTime(last_ob_time: string, tz: string): DateTime | null {
		const split = last_ob_time.split(/[T\-\s:]/);
		if (split.length != 5) return null;
		return DateTime.fromObject({
			year: parseInt(split[0]),
			month: parseInt(split[1]),
			day: parseInt(split[2]),
			hour: parseInt(split[3]),
			minute: parseInt(split[4])
		}).setZone(tz)
	}

	private ConvertToAPILocale(systemLocale: string | null) {
		if (!systemLocale)
			return null;

		if (systemLocale == "zh-tw") {
			return systemLocale;
		}
		// Czech code is different
		const lang = systemLocale.split("-")[0];
		if (lang == "cs") {
			return "cz";
		}
		return lang;
	}

	private ConstructQuery(query: string, loc: LocationData): string {
		query = query + "key=" + this.app.config.ApiKey + "&lat=" + loc.lat + "&lon=" + loc.lon + "&units=S"
		const lang = this.ConvertToAPILocale(this.app.config.currentLocale);
		if (IsLangSupported(lang, this.supportedLanguages) && this.app.config._translateCondition) {
			query = query + "&lang=" + lang;
		}
		return query;
	};

	/**
	*
	* @param message Soup Message object
	* @returns null if custom error checking does not find anything
	*/
	private HandleError(message: ErrorResponse): boolean {
		if (message.ErrorData.code == 403) { // bad key
			this.app.ShowError({
				type: "hard",
				userError: true,
				detail: "bad key",
				service: "weatherbit",
				message: _("Please Make sure you\nentered the API key correctly and your account is not locked")
			});
		}
		return true;
	}

	private HandleHourlyError(message: ErrorResponse): boolean {
		/// Skip Hourly forecast if it is forbidden (403)
		if (message.ErrorData.code == 403) { // bad key
			this.hourlyAccess = false;
			Logger.Info("Hourly forecast is inaccessible, skipping")
			/*this.app.ShowError({
				type: "silent",
				userError: false,
				detail: "bad key",
				service: "weatherbit",
				message: _("API key doesn't provide access to Hourly Weather, skipping")
			});*/
			return false;
		}
		return true;
	}

	private ResolveIcon(icon: string): BuiltinIcons[] {
		switch (icon) {
			// Thunderstorms
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
				return ["weather-storm"]
			// Drizzle
			case "d01d":
			case "d01n":
			case "d02d":
			case "d02n":
			case "d03d":
			case "d03n":
				return ["weather-showers-scattered", "weather-rain", "weather-freezing-rain"]
			// Rain
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
				return ["weather-rain", "weather-freezing-rain", "weather-showers-scattered"]
			// Snow
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
				return ["weather-snow"]
			// Sleet
			case "s05d":
			case "s05n":
				return ["weather-freezing-rain", "weather-rain", "weather-showers-scattered"]
			// Fog, Sand, haze, smoke, mist
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
				return ["weather-fog"]
			case "c02d":
				return ["weather-few-clouds"]
			case "c02n":
				return ["weather-few-clouds-night"]
			case "c01n":
				return ["weather-clear-night"]
			case "c01d":
				return ["weather-clear"]
			case "c03d":
				return ["weather-clouds", "weather-few-clouds", "weather-overcast"]
			case "c03n":
				return ["weather-clouds-night", "weather-few-clouds-night", "weather-overcast"]
			case "c04n":
				return ["weather-overcast", "weather-clouds-night", "weather-few-clouds-night"]
			case "c04d":
				return ["weather-overcast", "weather-clouds", "weather-few-clouds"]
			case "u00d":
			case "u00n":
				return ["weather-severe-alert"]
			default:
				return ["weather-severe-alert"]
		}
	};

	private ResolveCustomIcon(icon: string): CustomIcons {
		switch (icon) {
			// Thunderstorms
			case "t01d":
			case "t02d":
			case "t03d":
				return "day-thunderstorm-symbolic"
			case "t04d":
			case "t05d":
				return "thunderstorm-symbolic"
			case "t01n":
			case "t02n":
			case "t03n":
				return "night-alt-thunderstorm-symbolic"
			case "t04n":
			case "t05n":
				return "thunderstorm-symbolic"
			// Drizzle
			case "d01d":
			case "d02d":
			case "d03d":
			case "d01n":
			case "d02n":
			case "d03n":
				return "showers-symbolic"
			// Rain
			case "r01d":
			case "r02d":
			case "r03d":
			case "r01n":
			case "r02n":
			case "r03n":
				return "rain-symbolic"
			case "r04d":
			case "r05d":
				return "day-rain-symbolic"
			case "r06d":
				return "rain-symbolic"
			case "r04n":
			case "r05n":
				return "night-alt-rain-symbolic"
			case "r06n":
				return "rain-symbolic"
			// Snow
			case "s01d":
			case "s04d":
				return "day-snow-symbolic"
			case "s02d":
			case "s03d":
			case "s06d":
				return "snow-symbolic"
			case "s01n":
			case "s04n":
				return "night-alt-snow-symbolic"
			case "s02n":
			case "s03n":
			case "s06n":
				return "snow-symbolic"
			// Sleet
			case "s05d":
			case "s05n":
				return "sleet-symbolic"
			// Fog, Sand, haze, smoke, mist
			case "a01d":
			case "a02d":
			case "a03d":
			case "a04d":
			case "a05d":
			case "a06d":
				return "day-fog-symbolic"
			case "a01n":
			case "a02n":
			case "a03n":
			case "a04n":
			case "a05n":
			case "a06n":
				return "night-fog-symbolic"
			case "c02d":
				return "day-cloudy-symbolic"
			case "c02n":
				return "night-alt-cloudy-symbolic"
			case "c01n":
				return "night-clear-symbolic"
			case "c01d":
				return "day-sunny-symbolic"
			case "c03d":
				return "day-cloudy-symbolic"
			case "c03n":
				return "night-alt-cloudy-symbolic"
			case "c04n":
				return "cloudy-symbolic"
			case "c04d":
				return "cloudy-symbolic"
			case "u00d":
			case "u00n":
				return "cloud-refresh-symbolic"
			default:
				return "cloud-refresh-symbolic"
		}
	}
};

/**
 *  M - [DEFAULT] Metric (Celsius, m/s, mm)
	S - Scientific (Kelvin, m/s, mm)
	I - Fahrenheit (F, mph, in)
 */
type queryUnits = 'M' | 'S' | 'I';