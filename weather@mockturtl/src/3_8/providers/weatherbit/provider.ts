//////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////
///////////                                       ////////////
///////////                Weatherbit             ////////////
///////////                                       ////////////
//////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////

import { DateTime } from "luxon";
import type { ErrorResponse, HTTPParams} from "../../lib/httpLib";
import { HttpLib } from "../../lib/httpLib";
import { Logger } from "../../lib/services/logger";
import type { WeatherData, ForecastData, HourlyForecastData, BuiltinIcons, CustomIcons, AlertData, AlertLevel } from "../../weather-data";
import { _, IsLangSupported } from "../../utils";
import { BaseProvider } from "../BaseProvider";
import type { Config } from "../../config";
import type { WeatherbitAlertsResponse } from "./alerts";
import type { WeatherBitCurrentWeatherData } from "./current";
import type { WeatherBitDailyWeatherDataResponse } from "./daily";
import type { WeatherBitHourlyWeatherDataResponse } from "./hourly";
import type { LocationData } from "../../types";

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

	private current_url = "https://api.weatherbit.io/v2.0/current";
	private daily_url = "https://api.weatherbit.io/v2.0/forecast/daily";
	private hourly_url = "https://api.weatherbit.io/v2.0/forecast/hourly";
	private alerts_url = "https://api.weatherbit.io/v2.0/alerts";

	private hourlyAccess = true;

	//--------------------------------------------------------
	//  Functions
	//--------------------------------------------------------
	public async GetWeather(loc: LocationData, cancellable: imports.gi.Gio.Cancellable, config: Config): Promise<WeatherData | null> {
		const forecastPromise = this.GetData(this.daily_url, loc, this.ParseForecast, cancellable);
		let hourlyPromise = null;
		if (this.hourlyAccess) hourlyPromise = this.GetHourlyData(this.hourly_url, loc, cancellable);
		const currentResult = await this.GetData(this.current_url, loc, this.ParseCurrent, cancellable);
		if (!currentResult) return null;

		const forecastResult = await forecastPromise;
		currentResult.forecasts = forecastResult ?? [];
		const hourlyResult = await hourlyPromise;
		currentResult.hourlyForecasts = hourlyResult ?? [];

		if (config._showAlerts) {
			const alertResult = await this.GetData(this.alerts_url, loc, this.ParseAlerts, cancellable);
			if (alertResult == null)
				return null;

			currentResult.alerts = alertResult;
		}
		return currentResult;
	};

	// A function as a function parameter 2 levels deep does not know
	// about the top level object information, has to pass it in as a parameter
	/**
	 *
	 * @param baseUrl
	 * @param ParseFunction returns WeatherData or ForecastData Object
	 */
	private async GetData<T, K>(baseUrl: string, loc: LocationData, ParseFunction: (json: K, translated: boolean) => T, cancellable: imports.gi.Gio.Cancellable) {
		const query = this.ConstructQuery(loc);
		if (query == null)
			return null;

		const json = await HttpLib.Instance.LoadJsonSimple({
			url: baseUrl,
			params: query,
			cancellable,
			HandleError: (e) => this.HandleError(e)
		});

		if (json == null)
			return null;

		return ParseFunction(json as K, !!query.lang);
	}

	private async GetHourlyData(baseUrl: string, loc: LocationData, cancellable: imports.gi.Gio.Cancellable) {
		const query = this.ConstructQuery(loc);
		if (query == null)
			return null;

		const json = await HttpLib.Instance.LoadJsonSimple<WeatherBitHourlyWeatherDataResponse | { error: string }>({
			url: baseUrl,
			params: query,
			cancellable,
			HandleError: (e) => this.HandleHourlyError(e)
		});

		if (json == null)
			return null;

		if ("error" in json) {
			return null;
		}

		return this.ParseHourlyForecast(json, !!query.lang);
	};

	private ParseAlerts = (json: WeatherbitAlertsResponse): AlertData[] | null => {
		const alerts: AlertData[] = [];
		for (const alert of json.alerts) {
			let level: AlertLevel;
			switch (alert.severity) {
				case "Advisory":
					level = "minor";
					break;
				case "Watch":
					level = "moderate";
					break;
				case "Warning":
					level = "severe";
					break;
				default:
					level = "unknown";
					break;
			}
			const alertData: AlertData = {
				title: alert.title,
				description: alert.description,
				level,
				sender_name: alert.uri,
			};
			alerts.push(alertData);
		}
		return alerts;
	}

	private ParseCurrent = (payload: WeatherBitCurrentWeatherData, translated: boolean): WeatherData | null => {
		const json = payload.data[0];
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
					main: translated ? json.weather.description : this.CodeToMain(json.weather.code),
					description: translated ? json.weather.description : this.CodeToDescription(json.weather.code),
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
				Logger.Error("Weatherbit Weather Parsing error: " + e.message, e);
			this.app.ShowError({ type: "soft", service: "weatherbit", detail: "unusual payload", message: _("Failed to Process Current Weather Info") })
			return null;
		}
	};

	private ParseForecast = (json: WeatherBitDailyWeatherDataResponse, translated: boolean): ForecastData[] | null => {
		const forecasts: ForecastData[] = [];
		try {
			for (const day of json.data) {
				const forecast: ForecastData = {
					date: DateTime.fromSeconds(day.ts, { zone: json.timezone }),
					temp_min: day.min_temp,
					temp_max: day.max_temp,
					condition: {
						main: translated ? day.weather.description : this.CodeToMain(day.weather.code),
						description: translated ? day.weather.description : this.CodeToDescription(day.weather.code),
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
				Logger.Error("Weatherbit Forecast Parsing error: " + e.message, e);
			this.app.ShowError({ type: "soft", service: "weatherbit", detail: "unusual payload", message: _("Failed to Process Forecast Info") })
			return null;
		}
	};

	private ParseHourlyForecast = (json: WeatherBitHourlyWeatherDataResponse, translated: boolean): HourlyForecastData[] | null => {
		const forecasts: HourlyForecastData[] = [];
		try {
			for (const hour of json.data) {
				const forecast: HourlyForecastData = {
					date: DateTime.fromSeconds(hour.ts, { zone: json.timezone }),
					temp: hour.temp,
					condition: {
						main: translated ? hour.weather.description : this.CodeToMain(hour.weather.code),
						description: translated ? hour.weather.description : this.CodeToDescription(hour.weather.code),
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
				Logger.Error("Weatherbit Forecast Parsing error: " + e.message, e);
			this.app.ShowError({ type: "soft", service: "weatherbit", detail: "unusual payload", message: _("Failed to Process Forecast Info") })
			return null;
		}
	}


	private TimeToDate(time: string, hourDiff: number, tz: string): DateTime {
		const hoursMinutes = time.split(":");
		const date = DateTime.utc().set(
			{
				hour: Number.parseInt(hoursMinutes[0]) - hourDiff,
				minute: Number.parseInt(hoursMinutes[1]),
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
		const split = last_ob_time.split(/[\s:T-]/);
		if (split.length != 5) return null;
		return DateTime.fromObject({
			year: Number.parseInt(split[0]),
			month: Number.parseInt(split[1]),
			day: Number.parseInt(split[2]),
			hour: Number.parseInt(split[3]),
			minute: Number.parseInt(split[4])
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

	private ConstructQuery(loc: LocationData): HTTPParams {
		const result: HTTPParams = {
			key: this.app.config.ApiKey,
			lat: loc.lat,
			lon: loc.lon,
			units: "S"
		};

		const lang = this.ConvertToAPILocale(this.app.config.currentLocale);
		if (IsLangSupported(lang, this.supportedLanguages) && this.app.config._translateCondition) {
			result.lang = lang;
		}
		return result;
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
			return false;
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

	private CodeToMain(code: number): string {
		switch (code) {
			// Thunderstorms
			case 200:
			case 201:
			case 202:
			case 230:
			case 231:
			case 232:
			case 233:
				return _("Thunderstorm");
			// Drizzle
			case 300:
			case 301:
			case 302:
				return _("Drizzle");
			// Rain
			case 500:
			case 501:
			case 502:
			case 511:
			case 520:
			case 521:
			case 522:
				return _("Rain");
			// Snow
			case 600:
			case 601:
			case 602:
			case 610:
			case 621:
			case 622:
			case 623:
				return _("Snow");
			// Sleet
			case 611:
			case 612:
				return _("Sleet");
			// Fog, Sand, haze, smoke, mist
			case 700:
				return _("Mist");
			case 711:
				return _("Smoke");
			case 721:
				return _("Haze");
			case 731:
				return _("Dust");
			case 741:
			case 751:
				return _("Fog");
			case 800:
				return _("Clear");
			case 801:
				return _("Few clouds");
			case 802:
				return _("Scattered clouds");
			case 803:
				return _("Broken clouds");
			case 804:
				return _("Overcast");
			case 900:
			default:
				return _("Unknown")
		}
	}

	private CodeToDescription(code: number): string {
		switch (code) {
			// Thunderstorms
			case 200:
				return _("Thunderstorm with light rain");
			case 201:
				return _("Thunderstorm with rain");
			case 202:
				return _("Thunderstorm with heavy rain");
			case 230:
				return _("Thunderstorm with light drizzle");
			case 231:
				return _("Thunderstorm with drizzle");
			case 232:
				return _("Thunderstorm with heavy drizzle");
			case 233:
				return _("Thunderstorm");
			// Drizzle
			case 300:
				return _("Light drizzle");
			case 301:
				return _("Drizzle");
			case 302:
				return _("Heavy drizzle");
			// Rain
			case 500:
				return _("Light rain");
			case 501:
				return _("Moderate rain");
			case 502:
				return _("Heavy rain");
			case 511:
				return _("Freezing rain");
			case 520:
				return _("Light shower rain");
			case 521:
				return _("Shower rain");
			case 522:
				return _("Heavy shower rain");
			// Snow
			case 600:
				return _("Light snow");
			case 601:
				return _("Snow");
			case 602:
				return _("Heavy snow");
			case 610:
				return _("Mix snow/rain");
			case 621:
				return _("Snow shower");
			case 622:
				return _("Heavy snow shower");
			case 623:
				return _("Flurries");
			// Sleet
			case 611:
				return _("Sleet");
			case 612:
				return _("Heavy sleet");
			// Fog, Sand, haze, smoke, mist
			case 700:
				return _("Mist");
			case 711:
				return _("Smoke");
			case 721:
				return _("Haze");
			case 731:
				return _("Dust");
			case 741:
				return _("Fog");
			case 751:
				return _("Freezing fog");
			case 800:
				return _("Clear");
			case 801:
				return _("Few clouds");
			case 802:
				return _("Scattered clouds");
			case 803:
				return _("Broken clouds");
			case 804:
				return _("Overcast");
			case 900:
			default:
				return _("Unknown")
		}
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