//////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////
///////////                                       ////////////
///////////                DarkSky                ////////////
///////////                                       ////////////
//////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////

import { ErrorResponse, HttpError } from "../lib/httpLib";
import { Logger } from "../lib/logger";
import { WeatherApplet } from "../main";
import { WeatherProvider, WeatherData, ForecastData, HourlyForecastData, PrecipitationType, BuiltinIcons, CustomIcons, LocationData, SunTime } from "../types";
import { _, IsLangSupported, IsNight, FahrenheitToKelvin, CelsiusToKelvin, MPHtoMPS } from "../utils";
import { DateTime } from "luxon";
import { BaseProvider } from "./BaseProvider";

const Lang: typeof imports.lang = imports.lang;

export class DarkSky extends BaseProvider {

	//--------------------------------------------------------
	//  Properties
	//--------------------------------------------------------
	public readonly prettyName = _("DarkSky");
	public readonly name = "DarkSky";
	public readonly maxForecastSupport = 8;
	public readonly website = "https://darksky.net/poweredby/";
	public readonly maxHourlyForecastSupport = 168;
	public readonly needsApiKey = true;
	public readonly supportHourlyPrecipChance = true;
	public readonly supportHourlyPrecipVolume = true;

	private remainingQuota: number | null = null;
	public get remainingCalls(): number | null {
		// Disable this for now, this feature is only really useful for AccuWeather
		// TODO: when a better place is found for this value add this back
		return null;
		//return this.remainingQuota;
	};

	private descriptionLineLength = 25;
	private supportedLanguages = [
		'ar', 'az', 'be', 'bg', 'bs', 'ca', 'cs', 'da', 'de', 'el', 'en', 'es',
		'et', 'fi', 'fr', 'he', 'hr', 'hu', 'id', 'is', 'it', 'ja', 'ka', 'ko',
		'kw', 'lv', 'nb', 'nl', 'no', 'pl', 'pt', 'ro', 'ru', 'sk', 'sl', 'sr',
		'sv', 'tet', 'tr', 'uk', 'x-pig-latin', 'zh', 'zh-tw'];

	private query = "https://api.darksky.net/forecast/";

	// DarkSky Filter words for short conditions, won't work on every language
	private DarkSkyFilterWords = [_("and"), _("until"), _("in"), _("Possible")];

	private unit: queryUnits = "si";

	constructor(_app: WeatherApplet) {
		super(_app);
	}

	//--------------------------------------------------------
	//  Functions
	//--------------------------------------------------------
	public async GetWeather(loc: LocationData): Promise<WeatherData | null> {
		if (DateTime.fromObject({year: 2023, month: 3, day: 31}).diffNow().milliseconds < 0) {
			this.app.ShowError(
				{
					type: "hard",
					detail: "no api response",
					message: _("This API has ceased to function, please use another one.")
				}
			)
			return null;
		}
		const query = this.ConstructQuery(loc);
		if (query == "" && query == null) return null;

		const response = await this.app.LoadJsonAsyncWithDetails<DarkSkyPayload>(query, {}, this.HandleError);
		if (!response.Success)
			return null;

		this.remainingQuota = Math.max(1000 - parseInt(response.ResponseHeaders["X-Forecast-API-Calls"]), 0);
		return this.ParseWeather(response.Data);
	};


	private ParseWeather(json: DarkSkyPayload): WeatherData | null {
		try {
			const sunrise = DateTime.fromSeconds(json.daily.data[0].sunriseTime, { zone: json.timezone });
			const sunset = DateTime.fromSeconds(json.daily.data[0].sunsetTime, { zone: json.timezone });
			const result: WeatherData = {
				date: DateTime.fromSeconds(json.currently.time, { zone: json.timezone }),
				coord: {
					lat: json.latitude,
					lon: json.longitude
				},
				location: {
					url: "https://darksky.net/forecast/" + json.latitude + "," + json.longitude,
					timeZone: json.timezone,
				},
				sunrise: sunrise,
				sunset: sunset,
				wind: {
					speed: this.ToMPS(json.currently.windSpeed),
					degree: json.currently.windBearing
				},
				temperature: this.ToKelvin(json.currently.temperature),
				pressure: json.currently.pressure,
				humidity: json.currently.humidity * 100,
				dewPoint: this.ToKelvin(json.currently.dewPoint),
				condition: {
					main: this.GetShortCurrentSummary(json.currently.summary),
					description: json.currently.summary,
					icons: this.ResolveIcon(json.currently.icon, { sunrise: sunrise, sunset: sunset }),
					customIcon: this.ResolveCustomIcon(json.currently.icon)
				},
				extra_field: {
					name: _("Feels Like"),
					value: this.ToKelvin(json.currently.apparentTemperature),
					type: "temperature"
				},
				forecasts: [],
				hourlyForecasts: []
			}

			// Forecast
			for (const day of json.daily.data) {
				const forecast: ForecastData = {
					date: DateTime.fromSeconds(day.time, { zone: json.timezone }),
					temp_min: this.ToKelvin(day.temperatureLow),
					temp_max: this.ToKelvin(day.temperatureHigh),
					condition: {
						main: this.GetShortSummary(day.summary),
						description: this.ProcessSummary(day.summary),
						icons: this.ResolveIcon(day.icon),
						customIcon: this.ResolveCustomIcon(day.icon)
					},
				};

				// JS assumes time is local, so it applies the correct offset creating the Date (including Daylight Saving)
				// but when using the date when daylight saving is active, it DOES NOT apply the DST back,
				// So we offset the date to make it Noon
				forecast.date = forecast.date.set({ hour: 12 });

				result.forecasts.push(forecast);
			}

			for (const hour of json.hourly.data) {
				const forecast: HourlyForecastData = {
					date: DateTime.fromSeconds(hour.time, { zone: json.timezone }),
					temp: this.ToKelvin(hour.temperature),
					condition: {
						main: this.GetShortSummary(hour.summary),
						description: this.ProcessSummary(hour.summary),
						icons: this.ResolveIcon(hour.icon, { sunrise: sunrise, sunset: sunset }, DateTime.fromSeconds(hour.time, { zone: json.timezone })),
						customIcon: this.ResolveCustomIcon(hour.icon)
					},
					precipitation: {
						type: hour.precipType as PrecipitationType,
						volume: hour.precipProbability,
						chance: hour.precipProbability * 100
					}
				};

				// never null here
				result.hourlyForecasts!.push(forecast);
			}
			return result;
		}
		catch (e) {
			if (e instanceof Error)
				Logger.Error("DarkSky payload parsing error: " + e, e)
			this.app.ShowError({ type: "soft", detail: "unusual payload", service: "darksky", message: _("Failed to Process Weather Info") });
			return null;
		}
	};

	private ConvertToAPILocale(systemLocale: string | null) {
		if (systemLocale == null)
			return "en";

		if (systemLocale == "zh-tw") {
			return systemLocale;
		}
		const lang = systemLocale.split("-")[0];
		return lang;
	}

	private ConstructQuery(loc: LocationData): string {
		this.SetQueryUnit();
		let query = this.query + this.app.config.ApiKey + "/" + loc.lat.toString() + "," + loc.lon.toString() + "?exclude=minutely,flags" + "&units=" + this.unit;
		const locale = this.ConvertToAPILocale(this.app.config.currentLocale);
		if (IsLangSupported(locale, this.supportedLanguages) && this.app.config._translateCondition) {
			query = query + "&lang=" + locale;
		}
		return query;
	}

	/**
	 *
	 * @param message Soup Message object
	 * @returns null if custom error checking does not find anything
	 */
	private HandleError = (message: ErrorResponse): boolean => {
		if (message.ErrorData.code == 403) { // DarkSky returns auth error on the http level when key is wrong
			this.app.ShowError({
				type: "hard",
				userError: true,
				detail: "bad key",
				service: "darksky",
				message: _("Please Make sure you\nentered the API key correctly and your account is not locked")
			});
			return false;
		}
		else if (message.ErrorData.code == 401) { // DarkSky returns auth error on the http level when key is wrong
			this.app.ShowError({
				type: "hard",
				userError: true,
				detail: "no key",
				service: "darksky",
				message: _("Please Make sure you\nentered the API key that you have from DarkSky")
			});
			return false;
		}
		return true;
	}

	private ProcessSummary(summary: string): string {
		const processed = summary.split(" ");
		let result = "";
		let lineLength = 0;
		for (const elem of processed) {
			if (lineLength + elem.length > this.descriptionLineLength) {
				result = result + "\n";
				lineLength = 0;
			}
			result = result + elem + " ";
			lineLength = lineLength + elem.length + 1;
		}
		return result;
	};

	private GetShortSummary(summary: string): string {
		const processed = summary.split(" ");
		if (processed.length == 1) return processed[0];
		const result: string[] = [];
		for (const elem of processed) {
			if (!/[\(\)]/.test(elem) && !this.WordBanned(elem)) {
				result.push(elem);
			}
			if (result.length == 2) break;
		}
		return result.join(" ");
	};

	private GetShortCurrentSummary(summary: string): string {
		const processed = summary.split(" ");
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

	private WordBanned(word: string): boolean {
		return this.DarkSkyFilterWords.includes(word);
	}

	private ResolveIcon(icon: string, sunTimes?: SunTime, date?: DateTime): BuiltinIcons[] {
		switch (icon) {
			case "rain":
				return ["weather-rain", "weather-showers-scattered", "weather-freezing-rain"]
			case "snow":
				return ["weather-snow"]
			case "sleet":
				return ["weather-freezing-rain", "weather-rain", "weather-showers-scattered"]
			case "fog":
				return ["weather-fog"]
			// There is no guarantee that there is a wind icon
			case "wind":
				return (sunTimes && IsNight(sunTimes, date)) ? ["weather-windy", "weather-breeze", "weather-clouds", "weather-few-clouds-night"] : ["weather-windy", "weather-breeze", "weather-clouds", "weather-few-clouds"]
			case "cloudy":/* mostly cloudy (day) */
				return (sunTimes && IsNight(sunTimes, date)) ? ["weather-overcast", "weather-clouds", "weather-few-clouds-night"] : ["weather-overcast", "weather-clouds", "weather-few-clouds"]
			case "partly-cloudy-night":
				return ["weather-few-clouds-night"]
			case "partly-cloudy-day":
				return ["weather-few-clouds"]
			case "clear-night":
				return ["weather-clear-night"]
			case "clear-day":
				return ["weather-clear"]
			// Have not seen Storm or Showers icons returned yet
			case "storm":
				return ["weather-storm"]
			case "showers":
				return ["weather-showers", "weather-showers-scattered"]
			default:
				return ["weather-severe-alert"]
		}
	};

	private ResolveCustomIcon(icon: string): CustomIcons {
		switch (icon) {
			case "rain":
				return "rain-symbolic";
			case "snow":
				return "snow-symbolic";
			case "fog":
				return "fog-symbolic";
			case "cloudy":
				return "cloudy-symbolic";
			case "partly-cloudy-night":
				return "night-alt-cloudy-symbolic";
			case "partly-cloudy-day":
				return "day-cloudy-symbolic";
			case "clear-night":
				return "night-clear-symbolic";
			case "clear-day":
				return "day-sunny-symbolic";
			// Have not seen Storm or Showers icons returned yet
			case "storm":
				return "thunderstorm-symbolic";
			case "showers":
				return "showers-symbolic";
			// There is no guarantee that there is a wind icon
			case "wind":
				return "strong-wind-symbolic";
			default:
				return "cloud-refresh-symbolic";
		}
	}

	private SetQueryUnit(): void {
		if (this.app.config.TemperatureUnit == "celsius") {
			if (this.app.config.WindSpeedUnit == "kph" || this.app.config.WindSpeedUnit == "m/s") {
				this.unit = 'si';
			}
			else {
				this.unit = 'uk2';
			}
		}
		else {
			this.unit = 'us';
		}
	};

	private ToKelvin(temp: number): number {
		if (this.unit == 'us') {
			return FahrenheitToKelvin(temp);
		}
		else {
			return CelsiusToKelvin(temp);
		}

	};

	private ToMPS(speed: number): number {
		if (this.unit == 'si') {
			return speed;
		}
		else {
			return MPHtoMPS(speed);
		}
	};
};

/**
 * - 'si' returns meter/sec and Celsius
 * - 'us' returns miles/hour and Fahrenheit
 * - 'uk2' return miles/hour and Celsius
 */
type queryUnits = 'si' | 'us' | 'uk2';

interface DarkSkyHourlyPayload {
	time: number;
	summary: string;
	icon: string;
	precipIntensity: number;
	precipProbability: number;
	precipType: string;
	temperature: number;
	apparentTemperature: number;
	dewPoint: number;
	humidity: number;
	pressure: number;
	windSpeed: number;
	windGust: number;
	windBearing: number;
	cloudCover: number;
	uvIndex: number;
	visibility: number;
	ozone: number;
}

interface DarkSkyDailyPayload {
	time: number;
	summary: string;
	icon: string;
	sunriseTime: number;
	sunsetTime: number;
	moonPhase: number;
	precipIntensity: number;
	precipIntensityMax: number;
	precipIntensityMaxTime: number;
	precipProbability: number;
	precipType: string;
	temperatureHigh: number;
	temperatureHighTime: number;
	temperatureLow: number;
	temperatureLowTime: number;
	apparentTemperatureHigh: number;
	apparentTemperatureHighTime: number;
	apparentTemperatureLow: number;
	apparentTemperatureLowTime: number;
	dewPoint: number;
	humidity: number;
	pressure: number;
	windSpeed: number;
	windGust: number;
	windGustTime: number;
	windBearing: number;
	cloudCover: number;
	uvIndex: number;
	uvIndexTime: number;
	visibility: number;
	ozone: number;
	temperatureMin: number;
	temperatureMinTime: number;
	temperatureMax: number;
	temperatureMaxTime: number;
	apparentTemperatureMin: number;
	apparentTemperatureMinTime: number;
	apparentTemperatureMax: number;
	apparentTemperatureMaxTime: number;
}
interface DarkSkyPayload {
	latitude: number;
	longitude: number;
	timezone: string;
	currently: {
		/** Unix timestamp in seconds */
		time: number;
		summary: string;
		icon: string;
		nearestStormDistance: number;
		nearestStormBearing: number;
		precipIntensity: number;
		precipProbability: number;
		temperature: number;
		apparentTemperature: number;
		dewPoint: number;
		humidity: number;
		pressure: number;
		windSpeed: number;
		windGust: number;
		windBearing: number;
		cloudCover: number;
		uvIndex: number;
		visibility: number;
		ozone: number;
	},
	hourly: {
		summary: string;
		icon: string;
		data: DarkSkyHourlyPayload[];
	}
	daily: {
		summary: string;
		icon: string;
		data: DarkSkyDailyPayload[]
	}
}

