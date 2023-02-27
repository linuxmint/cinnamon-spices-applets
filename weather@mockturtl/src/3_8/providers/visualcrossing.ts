import { DateTime } from "luxon";
import { Services } from "../config";
import { ErrorResponse, HttpError, HTTPParams } from "../lib/httpLib";
import { WeatherApplet } from "../main";
import { Condition, ForecastData, HourlyForecastData, LocationData, PrecipitationType, WeatherData, WeatherProvider } from "../types";
import { CelsiusToKelvin, IsLangSupported, _ } from "../utils";
import { BaseProvider } from "./BaseProvider";


export class VisualCrossing extends BaseProvider {
	readonly prettyName: string = _("Visual Crossing");
	readonly name: Services = "Visual Crossing";
	readonly maxForecastSupport: number = 15;
	readonly maxHourlyForecastSupport: number = 336;
	readonly website: string = "https://weather.visualcrossing.com/";
	readonly needsApiKey: boolean = true;
	public readonly remainingCalls: number | null = null;
	public readonly supportHourlyPrecipChance = true;
	public readonly supportHourlyPrecipVolume = true;

	private url: string = "https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/";
	private params: HTTPParams = {
		unitGroup: "metric",
		key: null,
		include: "fcst,hours,current",
		/** Raw descriptor ID */
		lang: "id"
	}

	private supportedLangs: string[] = ["en", "de", "fr", "es"]

	constructor(app: WeatherApplet) {
		super(app);
	}

	public async GetWeather(loc: LocationData): Promise<WeatherData | null> {
		if (loc == null) return null;
		this.params['key'] = this.app.config.ApiKey;
		let translate = true;
		if (IsLangSupported(this.app.config.Language, this.supportedLangs)) {
			this.params['lang'] = this.app.config.Language;
			translate = false;
		}

		const url = this.url + loc.lat + "," + loc.lon;
		const json = await this.app.LoadJsonAsync<VisualCrossingPayload>(url, this.params, (e) => this.HandleHttpError(e));

		if (!json) return null;
		return this.ParseWeather(json, translate);
	}

	private ParseWeather(weather: VisualCrossingPayload, translate: boolean): WeatherData {
		const currentHour = this.GetCurrentHour(weather.days, weather.timezone);
		const result: WeatherData = {
			date: DateTime.fromSeconds(weather.currentConditions.datetimeEpoch, { zone: weather.timezone }),
			location: {
				url: encodeURI("https://www.visualcrossing.com/weather-history/" + weather.latitude + "," + weather.longitude + "/"),
				timeZone: weather.timezone,
				tzOffset: weather.tzoffset,
			},
			coord: {
				lat: weather.latitude,
				lon: weather.longitude,
			},
			humidity: weather.currentConditions.humidity ?? currentHour?.humidity,
			pressure: weather.currentConditions.pressure ?? currentHour?.pressure,
			dewPoint: CelsiusToKelvin(weather.currentConditions.dew ?? currentHour?.dew),
			wind: {
				degree: weather.currentConditions.winddir ?? currentHour?.winddir,
				speed: weather.currentConditions.windspeed ?? currentHour?.windspeed,
			},
			temperature: CelsiusToKelvin(weather.currentConditions.temp ?? currentHour?.temp),
			sunrise: DateTime.fromSeconds(weather.currentConditions.sunriseEpoch, { zone: weather.timezone }),
			sunset: DateTime.fromSeconds(weather.currentConditions.sunsetEpoch, { zone: weather.timezone }),
			condition: this.GenerateCondition(weather.currentConditions.icon, weather.currentConditions.conditions, translate),
			extra_field: {
				name: _("Feels Like"),
				type: "temperature",
				// use current hour instead, observations feels like doesn't seem to differ at all
				value: CelsiusToKelvin(currentHour?.feelslike ?? weather.currentConditions.feelslike)
			},
			forecasts: this.ParseForecasts(weather.days, translate, weather.timezone),
			hourlyForecasts: this.ParseHourlyForecasts(weather.days, translate, weather.timezone)
		}

		return result;
	}

	private ParseForecasts(forecasts: DayForecast[] | undefined, translate: boolean, tz: string): ForecastData[] {
		const result: ForecastData[] = [];
		if (!!forecasts) {
			for (const element of forecasts) {
				result.push({
					date: DateTime.fromSeconds(element.datetimeEpoch, { zone: tz }),
					condition: this.GenerateCondition(element.icon, element.conditions, translate),
					temp_max: CelsiusToKelvin(element.tempmax),
					temp_min: CelsiusToKelvin(element.tempmin)
				});
			}
		}

		return result;
	}

	private ParseHourlyForecasts(forecasts: DayForecast[] | undefined, translate: boolean, tz: string): HourlyForecastData[] {
		const currentHour = DateTime.utc().setZone(tz).set({ minute: 0, second: 0, millisecond: 0 });

		const result: HourlyForecastData[] = [];
		if (!!forecasts) {
			for (const element of forecasts) {
				if (!element.hours)
					continue;

				for (const hour of element.hours) {
					const time = DateTime.fromSeconds(hour.datetimeEpoch, { zone: tz });
					if (time < currentHour) continue;
					const item: HourlyForecastData = {
						date: time,
						temp: CelsiusToKelvin(hour.temp),
						condition: this.GenerateCondition(hour.icon, hour.conditions, translate)
					}

					if (hour.preciptype != null) {
						item.precipitation = {
							type: hour.preciptype[0],
							chance: hour.precipprob,
							volume: hour.precip
						}

						/*if (item.precipitation.type == "snow")
						item.precipitation.volume = hour.snow;*/
					}

					result.push(item);
				}
			}
		}
		return result;
	}

	private GetCurrentHour(forecasts: DayForecast[] | undefined, tz: string): HourForecast | null {
		if (!forecasts || forecasts?.length < 1 || !forecasts[0].hours)
			return null;

		const currentHour = DateTime.utc().setZone(tz).set({ minute: 0, second: 0, millisecond: 0 });

		for (const hour of forecasts[0].hours) {
			const time = DateTime.fromSeconds(hour.datetimeEpoch, { zone: tz });
			if (time < currentHour) continue;
			return hour;
		}
		return null;
	}

	private GenerateCondition(icon: string, condition: string, translate: boolean): Condition {
		const result: Condition = {
			main: (translate) ? this.ResolveTypeID(this.GetFirstCondition(condition)) : this.GetFirstCondition(condition),
			description: (translate) ? this.ResolveTypeIDs(condition) : condition,
			icons: [],
			customIcon: "refresh-symbolic"
		};

		switch (icon) {
			case "clear-day":
				result.icons = ["weather-clear"];
				result.customIcon = "day-sunny-symbolic";
				break;
			case "clear-night":
				result.icons = ["weather-clear-night"];
				result.customIcon = "night-clear-symbolic";
				break;
			case "partly-cloudy-day":
				result.icons = ["weather-few-clouds"];
				result.customIcon = "day-cloudy-symbolic";
				break;
			case "partly-cloudy-night":
				result.icons = ["weather-few-clouds-night"];
				result.customIcon = "night-alt-cloudy-symbolic";
				break;
			case "cloudy":
				result.icons = ["weather-overcast", "weather-clouds", "weather-many-clouds"];
				result.customIcon = "cloudy-symbolic";
				break;
			case "wind":
				result.icons = ["weather-windy", "weather-breeze"];
				result.customIcon = "windy-symbolic";
				break;
			case "fog":
				result.icons = ["weather-fog"];
				result.customIcon = "fog-symbolic";
				break;
			case "rain":
				result.icons = ["weather-rain", "weather-freezing-rain", "weather-snow-rain", "weather-showers"];
				result.customIcon = "rain-symbolic";
				break;
			case "snow":
				result.icons = ["weather-snow"];
				result.customIcon = "snow-symbolic";
				break;
		}

		return result;
	}

	private GetFirstCondition(condition: string): string {
		const split = condition.split(", ");
		return split[0];
	}

	private ResolveTypeID(condition: string): string {
		switch (condition.toLowerCase()) {
			case "type_1":
				return _("Blowing or drifting snow");
			case "type_2":
				return _("Drizzle");
			case "type_3":
				return _("Heavy drizzle");
			case "type_4":
				return _("Light drizzle");
			case "type_5":
				return _("Heavy drizzle/rain");
			case "type_6":
				return _("Light drizzle/rain");
			case "type_7":
				return _("Dust Storm");
			case "type_8":
				return _("Fog");
			case "type_9":
				return _("Freezing drizzle/freezing rain");
			case "type_10":
				return _("Heavy freezing drizzle/freezing rain");
			case "type_11":
				return _("Light freezing drizzle/freezing rain");
			case "type_12":
				return _("Freezing fog");
			case "type_13":
				return _("Heavy freezing rain");
			case "type_14":
				return _("Light freezing rain");
			case "type_15":
				return _("Funnel cloud/tornado");
			case "type_16":
				return _("Hail showers");
			case "type_17":
				return _("Ice");
			case "type_18":
				return _("Lightning without thunder");
			case "type_19":
				return _("Mist");
			case "type_20":
				return _("Precipitation in vicinity");
			case "type_21":
				return _("Rain");
			case "type_22":
				return _("Heavy rain and snow");
			case "type_23":
				return _("Light rain And snow");
			case "type_24":
				return _("Rain showers");
			case "type_25":
				return _("Heavy rain");
			case "type_26":
				return _("Light rain");
			case "type_27":
				return _("Sky coverage decreasing");
			case "type_28":
				return _("Sky coverage increasing");
			case "type_29":
				return _("Sky unchanged");
			case "type_30":
				return _("Smoke or haze");
			case "type_31":
				return _("Snow");
			case "type_32":
				return _("Snow and rain showers");
			case "type_33":
				return _("Snow showers");
			case "type_34":
				return _("Heavy snow");
			case "type_35":
				return _("Light snow");
			case "type_36":
				return _("Squalls");
			case "type_37":
				return _("Thunderstorm");
			case "type_38":
				return _("Thunderstorm without precipitation");
			case "type_39":
				return _("Diamond dust");
			case "type_40":
				return _("Hail");
			case "type_41":
				return _("Overcast");
			case "type_42":
				return _("Partially cloudy");
			case "type_43":
				return _("Clear");
		}
		return condition;
	}

	private ResolveTypeIDs(condition: string): string {
		let result = "";
		let split = condition.split(", ");
		for (const [index, element] of split.entries()) {
			result += this.ResolveTypeID(element);
			// not the last
			if (index < split.length - 1)
				result += ", ";
		}
		return result;
	}

	private HandleHttpError(error: ErrorResponse): boolean {
		if (error?.ErrorData.code == 401) {
			this.app.ShowError({
				type: "hard",
				userError: true,
				detail: "bad key",
				message: _("Please make sure you entered the API key correctly")
			})
			return false;
		}

		return true;
	}
}

interface VisualCrossingPayload {
	queryCost: number;
	remainingCost: number;
	remainingCredits: number;
	latitude: number;
	longitude: number;
	resolvedAddress: string;
	address: string;
	timezone: string;
	tzoffset: number;
	days?: DayForecast[];
	alerts?: any;
	currentConditions: CurrentObservation;
	stations: {
		[key: string]: Station
	};
}

interface Station {
	distance: number;
	latitude: number;
	longitude: number;
	useCount: number;
	id: string;
	name: string;
	contribution: number;
}

interface CurrentObservation {
	datetime: string;
	datetimeEpoch: number;
	/** C */
	temp: number;
	/** C */
	feelslike: number;
	/** C */
	dew: number;
	/** Percent */
	humidity: number;
	precip: number;
	preciptype?: PrecipitationType[];
	snow?: number;
	snowdepth?: number;
	windgust: number;
	windspeed: number;
	/** degree */
	winddir: number;
	/** hPa */
	pressure: number;
	/** % */
	cloudcover: number;
	visibility: number;
	solarradiation: number;
	solarenergy: number;
	sunrise: string;
	sunriseEpoch: number;
	sunset: string;
	sunsetEpoch: number;
	/** ranging from 0 (the new moon) to 0.5 (the full moon) and back to 1 (the next new moon) */
	moonphase: number;
	conditions: string;
	icon: string;
	stations: null;
	source: Source;
}

interface DayForecast {
	datetime: string;
	datetimeEpoch: number;
	/** C */
	tempmax: number;
	/** C */
	tempmin: number;
	/** C */
	temp: number;
	/** C */
	feelslikemax: number;
	/** C */
	feelslikemin: number;
	/** C */
	feelslike: number;
	dew: number;
	/** Percent */
	humidity: number;
	precip: number;
	precipprob: number;
	precipcover?: number;
	preciptype?: PrecipitationType[];
	snow?: number;
	snowdepth?: number;
	rain?: number;
	windgust: number;
	windspeed: number;
	/** degree */
	winddir: number;
	/** hPa */
	pressure: number;
	/** % */
	cloudcover: number;
	visibility: number;
	solarradiation: number;
	solarenergy: number;
	sunrise: string;
	sunriseEpoch: number;
	sunset: string;
	sunsetEpoch: number;
	moonphase: number;
	conditions: string;
	icon: string;
	stations: null;
	source: Source;
	hours?: HourForecast[];
}

interface HourForecast {
	datetime: string;
	datetimeEpoch: number;
	/** C */
	temp: number;
	/** C */
	feelslike: number;
	dew: number;
	/** Percent */
	humidity: number;
	precip: number;
	precipprob: number;
	preciptype?: PrecipitationType[];
	snow: number;
	snowdepth: number;
	windgust: number;
	windspeed: number;
	/** degree */
	winddir: number;
	/** hPa */
	pressure: number;
	/** % */
	cloudcover: number;
	visibility: number;
	solarradiation: number;
	solarenergy: number;
	conditions: string;
	icon: string;
	stations: null;
	source: Source;
	moonphase: number;
}

type Source = "fcst" | "";