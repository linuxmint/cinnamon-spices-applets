import { DateTime } from "luxon";
import { Services } from "../config";
import { HTTPParams } from "../lib/httpLib";
import { WeatherApplet } from "../main";
import { Condition, ForecastData, HourlyForecastData, LocationData, PrecipitationType, WeatherData, WeatherProvider } from "../types";
import { CelsiusToKelvin, GetDistance, mode, _ } from "../utils";
import { BaseProvider } from "./BaseProvider";

export class DanishMI extends BaseProvider {
	public readonly needsApiKey: boolean = false;
	public readonly prettyName: string = _("DMI Denmark");
	public readonly name: Services = "DanishMI";
	public readonly maxForecastSupport: number = 10;
	public readonly maxHourlyForecastSupport: number = 48;
	public readonly website: string = "https://www.dmi.dk/";
	public readonly remainingCalls: number | null = null;
	public readonly supportHourlyPrecipChance = false;
	public readonly supportHourlyPrecipVolume = true;

	private url = "https://www.dmi.dk/NinJo2DmiDk/ninjo2dmidk";
	private forecastParams: HTTPParams = {
		cmd: "llj", // lat long json
		lon: null,
		lat: null,
		tz: "UTC"   // have to as in UTC unless we don't get proper times
	}

	/** Params has to be in this exact order */
	private observationParams: HTTPParams = {
		cmd: "obj",
		east: null,
		west: null,
		south: null,
		north: null
	}

	constructor(app: WeatherApplet) {
		super(app);
	}

	async GetWeather(loc: LocationData): Promise<WeatherData | null> {
		if (loc == null)
			return null;

		this.GetLocationBoundingBox(loc);
		const observations = this.OrderObservations(await this.app.LoadJsonAsync<DanishObservationPayloads>(this.url, this.observationParams), loc);

		this.forecastParams.lat = loc.lat;
		this.forecastParams.lon = loc.lon;

		const forecasts = await this.app.LoadJsonAsync<DanishMIPayload>(this.url, this.forecastParams);
		if (forecasts == null)
			return null;

		return this.ParseWeather(observations, forecasts, loc);
	}

	private ParseWeather(observations: DanishObservationPayload[], forecasts: DanishMIPayload, loc: LocationData): WeatherData {
		const observation = this.MergeObservations(observations);
		const result = {
			temperature: CelsiusToKelvin(observation.Temperature2m ?? null),
			condition: this.ResolveCondition(observation.symbol),
			humidity: observation.RelativeHumidity,
			pressure: (!observation.PressureMSL) ? null : observation.PressureMSL / 100,
			wind: {
				degree: observation.WindDirection,
				speed: observation.WindSpeed10m
			},
			dewPoint: null,
		} as WeatherData;

		result.location = {
			city: forecasts.city,
			country: forecasts.country,
			timeZone: undefined, // because we ask in UTC, we get UTC as the timezone, so we just drop it
			url: `https://www.dmi.dk/lokation/show/${forecasts.country}/${forecasts.id}`
		};
		result.coord = {
			lon: forecasts.longitude,
			lat: forecasts.latitude
		};
		result.date = DateTime.fromJSDate(this.DateStringToDate(forecasts.lastupdate), { zone: loc.timeZone });
		result.humidity = result.humidity ?? forecasts.timeserie[0].humidity;
		result.pressure = result.pressure ?? forecasts.timeserie[0].pressure;
		result.temperature = result.temperature ?? CelsiusToKelvin(forecasts.timeserie[0].temp);
		result.wind.degree = result.wind.degree ?? forecasts.timeserie[0].windDegree;
		result.wind.speed = result.wind.speed ?? forecasts.timeserie[0].windSpeed;
		result.sunrise = DateTime.fromJSDate(this.DateStringToDate(forecasts.sunrise), { zone: loc.timeZone });
		result.sunset = DateTime.fromJSDate(this.DateStringToDate(forecasts.sunset), { zone: loc.timeZone });

		if (result.condition.customIcon == "alien-symbolic") {
			result.condition = this.ResolveCondition(forecasts.timeserie[0].symbol);
		}

		const forecastData: ForecastData[] = [];
		// for the last one we don't have symbols, so skip
		for (let index = 0; index < forecasts.aggData.length - 1; index++) {
			const element = forecasts.aggData[index];
			forecastData.push({
				date: DateTime.fromJSDate(this.DateStringToDate(element.time)).setZone(loc.timeZone, { keepLocalTime: true }),
				temp_max: CelsiusToKelvin(element.maxTemp),
				temp_min: CelsiusToKelvin(element.minTemp),
				condition: this.ResolveDailyCondition(forecasts.timeserie, DateTime.fromJSDate(this.DateStringToDate(element.time)).setZone(loc.timeZone, { keepLocalTime: true }))
			})
		}
		result.forecasts = forecastData;

		const hourlyData: HourlyForecastData[] = [];
		for (const element of forecasts.timeserie) {
			if (element.time == null)
				continue

			const hour: HourlyForecastData = {
				date: DateTime.fromJSDate(this.DateStringToDate(element.time), { zone: loc.timeZone }),
				temp: CelsiusToKelvin(element.temp),
				condition: this.ResolveCondition(element.symbol)
			};

			if (element.precip1 > 0.05 && element.precipType != null) {
				hour.precipitation = {
					type: this.DanishPrecipToType(element.precipType),
					volume: element.precip1
				}
			}

			hourlyData.push(hour);
		}
		result.hourlyForecasts = hourlyData;

		return result;
	}

	private MergeObservations(observations: DanishObservationPayload[]): DanishObservationData {
		const result: DanishObservationData = {
			symbol: undefined,
			PressureMSL: undefined,
			Temperature2m: undefined,
			WindDirection: undefined,
			RelativeHumidity: undefined,
			WindSpeed10m: undefined,
			PrecAmount10Min: undefined,
			WindGustLast10Min: undefined
		}
		for (const element of observations) {
			result.symbol = result.symbol ?? element.values.symbol;
			result.PressureMSL = result.PressureMSL ?? element.values.PressureMSL;
			result.Temperature2m = result.Temperature2m ?? element.values.Temperature2m;
			result.WindDirection = result.WindDirection ?? element.values.WindDirection;
			result.RelativeHumidity = result.RelativeHumidity ?? element.values.RelativeHumidity;
			result.WindSpeed10m = result.WindSpeed10m ?? element.values.WindSpeed10m;
		}

		return result;
	}

	private ResolveDailyCondition(hourlyData: DanishMIHourlyPayload[], date: DateTime) {
		// change it to 6 in the morning so a day makes more sense
		const target = date.set({ hour: 6 });

		// next day boundary
		const upto = target.plus({ days: 1 });

		const relevantHours = hourlyData.filter((x) => {
			const hour = DateTime.fromJSDate(this.DateStringToDate(x.time), { zone: target.zoneName });
			if (hour >= target && hour < upto)
				return true;
			return false;
		});

		// convert night symbols to day symbols for daily
		const normalizedSymbols = relevantHours.map(x => (x.symbol > 100) ? (x.symbol - 100) : x.symbol);

		let resultSymbol: number;
		// symbols include rain or other stuff, get most severe
		// exclude foggy from priority symbols
		if (!!normalizedSymbols.find(x => x > 10 && x != 45))
			resultSymbol = Math.max(...normalizedSymbols);
		else // get most common if there is no precipitation
			resultSymbol = <number>mode(normalizedSymbols);

		return this.ResolveCondition(resultSymbol);
	}

	private ResolveCondition(symbol: number | undefined): Condition {
		if (symbol == null)
			return {
				main: _("NOT FOUND"),
				description: _("NOT FOUND"),
				customIcon: "alien-symbolic",
				icons: ["weather-severe-alert"]
			}

		const isNight = (symbol > 100);
		if (isNight)
			symbol = symbol - 100;
		switch (symbol) {
			case 1:     // Clear
				return {
					main: _("Clear"),
					description: _("Clear"),
					customIcon: isNight ? "night-clear-symbolic" : "day-sunny-symbolic",
					icons: isNight ? ["weather-clear-night"] : ["weather-clear"]
				}
			case 2:     // Partly cloudy day
				return {
					main: _("Partly cloudy"),
					description: _("Partly cloudy"),
					customIcon: isNight ? "night-alt-cloudy-symbolic" : "day-cloudy-symbolic",
					icons: isNight ? ["weather-few-clouds-night", "weather-clouds-night"] : ["weather-few-clouds", "weather-clouds"]
				}
			case 3:     // cloudy
				return {
					main: _("Cloudy"),
					description: _("Cloudy"),
					customIcon: "cloudy-symbolic",
					icons: ["weather-overcast", "weather-many-clouds", "weather-clouds", "weather-few-clouds"]
				}
			case 38:   // Blowing snow
				return {
					main: _("Snow"),
					description: _("Blowing snow"),
					customIcon: "snow-symbolic",
					icons: ["weather-snow"]
				}
			case 45:   //Foggy
				return {
					main: _("Foggy"),
					description: _("Foggy"),
					customIcon: "fog-symbolic",
					icons: ["weather-fog"]
				}
			case 60:   // Rain
				return {
					main: _("Rain"),
					description: _("Rain"),
					customIcon: "rain-symbolic",
					icons: ["weather-rain", "weather-freezing-rain", "weather-showers"]
				}
			case 63:    // Moderate rain
				return {
					main: _("Moderate rain"),
					description: _("Moderate rain"),
					customIcon: "rain-symbolic",
					icons: ["weather-rain", "weather-showers", "weather-freezing-rain"]
				}
			case 68:   // Rain and snow
				return {
					main: _("Rain and snow"),
					description: _("Rain and snow"),
					customIcon: "rain-mix-symbolic",
					icons: ["weather-snow-rain", "weather-freezing-rain", "weather-rain"]
				}
			case 69:   // Heavy rain and snow
				return {
					main: _("Rain and snow"),
					description: _("Heavy rain and snow"),
					customIcon: "rain-mix-symbolic",
					icons: ["weather-snow-rain", "weather-freezing-rain", "weather-rain"]
				}
			case 70:    // Slight snow
				return {
					main: _("Slight snow"),
					description: _("Slight snow"),
					customIcon: "snow-symbolic",
					icons: ["weather-snow", "weather-snow-scattered"]
				}
			case 73:   // Moderate snow
				return {
					main: _("Moderate snow"),
					description: _("Moderate snow"),
					customIcon: "snow-symbolic",
					icons: ["weather-snow", "weather-snow-scattered"]
				}
			case 80:    // Rain showers
				return {
					main: _("Rain"),
					description: _("Rain showers"),
					customIcon: "showers-symbolic",
					icons: ["weather-showers", "weather-freezing-rain", "weather-rain"]
				}
			case 81:    // Moderate rain showers day
				return {
					main: _("Rain showers"),
					description: _("Moderate rain showers"),
					customIcon: isNight ? "night-alt-showers-symbolic" : "day-showers-symbolic",
					icons: isNight ? ["weather-showers-night", "weather-showers-scattered-night", "weather-showers-scattered", "weather-showers"] : ["weather-showers-day", "weather-showers-scattered-day", "weather-showers"]
				}
			case 83:    // Slight mixed rain and snow day
				return {
					main: _("Rain and snow"),
					description: _("Mixed rain and snow"),
					customIcon: isNight ? "night-alt-rain-mix-symbolic" : "day-rain-mix-symbolic",
					icons: ["weather-snow-rain", "weather-freezing-rain", "weather-snow-day", "weather-snow"]
				}
			case 84:    // Heavy mixed rain and snow day
				return {
					main: _("Rain and snow"),
					description: _("Heavy mixed rain and snow"),
					customIcon: "rain-mix-symbolic",
					icons: ["weather-snow-rain", "weather-freezing-rain", "weather-snow-day", "weather-snow"]
				}
			case 85:    // Snow showers day
				return {
					main: _("Snow"),
					description: _("Snow showers"),
					customIcon: isNight ? "night-alt-snow-symbolic" : "day-snow-symbolic",
					icons: isNight ? ["weather-snow-night", "weather-snow"] : ["weather-snow-day", "weather-snow"]
				}
			case 86:    // Heavy snow showers day
				return {
					main: _("Heavy snow"),
					description: _("Heavy snow showers"),
					customIcon: "day-snow-symbolic",
					icons: ["weather-snow-day", "weather-snow"]
				}
			case 95:   // Thunderstorm with precipitations
				return {
					main: _("Thunderstorm"),
					description: _("Thunderstorm"),
					customIcon: "thunderstorm-symbolic",
					icons: ["weather-storm"]
				}
			default: {
				return {
					main: _("NOT FOUND"),
					description: _("NOT FOUND"),
					customIcon: "alien-symbolic",
					icons: ["weather-severe-alert"]
				}
			}
		}
	}

	private DanishPrecipToType(type: DanishPrecipType): PrecipitationType {
		switch (type) {
			case "sne":
				return "snow";
			case "regn":
				return "rain";
			case "slud":
				return "ice pellets";
			default:
				return "none";
		}
	}

	/**
	 * Expands the locations to about 10km box
	 * @param loc
	 */
	private GetLocationBoundingBox(loc: LocationData) {
		this.observationParams.west = loc.lon + 0.075;
		this.observationParams.east = loc.lon - 0.075;
		this.observationParams.north = loc.lat + 0.045;
		this.observationParams.south = loc.lat - 0.04;
	}

	private OrderObservations(observations: DanishObservationPayloads | null, loc: LocationData): ExtendedDanishObservationPayload[] {
		const result: ExtendedDanishObservationPayload[] = [];
		for (const key in observations) {
			const element = observations[key];
			result.push({
				...element,
				dist: GetDistance(loc.lat, loc.lon, element.latitude, element.longitude)
			});
		}
		return this.SortObservationSites(result);
	}

	private SortObservationSites(observations: ExtendedDanishObservationPayload[]): ExtendedDanishObservationPayload[] {
		observations = observations.sort((a, b) => {
			if (a.dist < b.dist) return -1;
			if (a.dist == b.dist) return 0;
			return 1;
		})
		return observations;
	}

	/**
	 *
	 * @param str example 20210207130000 or 20210214 or '803' or '1704',
	 */
	private DateStringToDate(str: string): Date {
		if (str.length == 14) {
			return new Date(Date.UTC(
				parseInt(str.substring(0, 4)),
				parseInt(str.substring(4, 6)) - 1,
				parseInt(str.substring(6, 8)),
				parseInt(str.substring(8, 10)),
				parseInt(str.substring(10, 12)),
				parseInt(str.substring(12, 14))
			));
		}
		else if (str.length == 8) {
			return new Date(Date.UTC(
				parseInt(str.substring(0, 4)),
				parseInt(str.substring(4, 6)) - 1,
				parseInt(str.substring(6, 8)),
				0, 0, 0, 0
			));
		}
		//else if (str.length == 4 || str.length == 3)
		else {
			// Pad with 0s
			if (str.length == 3) {
				str = ("0000" + str).substr(-4, 4);
			}
			const today = new Date();
			today.setUTCHours(parseInt(str.substring(0, 2)), parseInt(str.substring(2, 4)), 0, 0);
			return today;
		}
	}
}

interface DanishObservationPayloads {
	[key: string]: DanishObservationPayload;
}

interface DanishObservationData {
	/** last observations ascending (last is freshest), C */
	Temperature2m: number | undefined;
	/** last observations ascending (last is freshest), % */
	RelativeHumidity: number | undefined;
	/** mm? */
	PrecAmount10Min: number | undefined;
	PressureMSL: number | undefined;
	WindDirection: number | undefined;
	/** m/s? */
	WindSpeed10m: number | undefined;
	/** m/s? */
	WindGustLast10Min: number | undefined;
	symbol: number | undefined;
}

interface DanishObservationPayload {
	name: string;
	latitude: number;
	longitude: number;
	time: string;
	values: DanishObservationData
}

interface ExtendedDanishObservationPayload extends DanishObservationPayload {
	/** distance from user's location in metres, calculated after obtaining */
	dist: number;
}

interface DanishMIPayload {
	id: string;
	city: string;
	country: string;
	longitude: number;
	latitude: number;
	timezone: string;
	/** date format in YYYYMMDDHHMMSS */
	lastupdate: string;
	/** HMM */
	sunrise: string;
	/** HMM */
	sunset: string;
	timeserie: DanishMIHourlyPayload[];
	aggData: DanishMIDailyPayload[];
}

/** snow | sleet | rain */
type DanishPrecipType = "sne" | "slud" | "regn";

interface DanishMIHourlyPayload {
	/** date format in YYYYMMDDHHMMSS */
	time: string;
	/** C */
	temp: number;
	symbol: number;
	precip1: number;
	precipType?: DanishPrecipType;
	windDir: string;
	windDegree: number;
	/** m/s?? */
	windSpeed: number;
	/** m/s?? */
	windGust: number;
	/** % */
	humidity: number;
	/** hPa */
	pressure: number;
	/** m?, only in the first 48 items */
	visibility?: number;
	precip3: number;
	precip6: number;
	/** Only in the first 48 items */
	temp10?: number;
	/** Only in the first 48 items */
	temp50?: number;
	/** Only in the first 48 items */
	temp90?: number;
	/** Only in the first 48 items */
	prec10?: number;
	/** Only in the first 48 items */
	prec50?: number;
	/** Only in the first 48 items */
	prec75?: number;
	/** Only in the first 48 items */
	prec90?: number;
	/** Only in the first 48 items */
	windspeed10?: number;
	/** Only in the first 48 items */
	windspeed50?: number;
	/** Only in the first 48 items */
	windspeed90?: number;
}

interface DanishMIDailyPayload {
	/** YYYYMMDD format */
	time: string;
	/** C */
	minTemp: number;
	/** C */
	meanTemp: number
	/** C */
	maxTemp: number;
	precipSum: number;
	uvRadiation: number;
}