import { Logger } from "../lib/logger";
import { WeatherApplet } from "../main";
import { getTimes } from "suncalc";
import { WeatherProvider, WeatherData, HourlyForecastData, ForecastData, Condition, LocationData, correctGetTimes, SunTime } from "../types";
import { CelsiusToKelvin, IsNight, OnSameDay, _ } from "../utils";
import { DateTime } from "luxon";
import { BaseProvider } from "./BaseProvider";

export class MetNorway extends BaseProvider {
	public readonly prettyName = _("MET Norway");
	public readonly name = "MetNorway";
	public readonly maxForecastSupport = 10;
	public readonly website = "https://www.met.no/en";
	public readonly maxHourlyForecastSupport = 48;
	public readonly needsApiKey = false;
	public readonly remainingCalls: number | null = null;

	private baseUrl = "https://api.met.no/weatherapi/locationforecast/2.0/complete?"

	constructor(app: WeatherApplet) {
		super(app);
	}

	public async GetWeather(loc: LocationData): Promise<WeatherData | null> {
		const query = this.GetUrl(loc);
		if (query == null)
			return null;

		const json = await this.app.LoadJsonAsync<MetNorwayPayload>(query);

		if (!json) {
			Logger.Error("MET Norway: Empty response from API");
			return null;
		}

		return this.ParseWeather(json, loc);
	}

	private RemoveEarlierElements(json: MetNorwayPayload, loc: LocationData): MetNorwayPayload {
		const now = DateTime.now().setZone(loc.timeZone);
		let startIndex = -1;
		for (const [i, element] of json.properties.timeseries.entries()) {
			const timestamp = DateTime.fromISO(element.time, { zone: loc.timeZone });
			if (timestamp < now && now.hour != timestamp.hour) {
				startIndex = i;
			}
			else {
				break;
			}
		}

		if (startIndex != -1) {
			Logger.Debug("Removing outdated weather information...")
			json.properties.timeseries.splice(0, startIndex + 1);
		}

		return json;
	}

	private ParseWeather(json: MetNorwayPayload, loc: LocationData): WeatherData {
		json = this.RemoveEarlierElements(json, loc);

		const times = (getTimes as correctGetTimes)(new Date(), json.geometry.coordinates[1], json.geometry.coordinates[0], json.geometry.coordinates[2]);
		const suntimes: SunTime = {
			sunrise: DateTime.fromJSDate(times.sunrise, { zone: loc.timeZone }),
			sunset: DateTime.fromJSDate(times.sunset, { zone: loc.timeZone })
		}
		// Current Weather
		const current = json.properties.timeseries[0];
		const result: WeatherData = {
			temperature: CelsiusToKelvin(current.data.instant.details.air_temperature),
			coord: {
				lat: json.geometry.coordinates[1],
				lon: json.geometry.coordinates[0]
			},
			date: DateTime.fromISO(current.time, { zone: loc.timeZone }),
			condition: this.ResolveCondition(current.data.next_1_hours?.summary?.symbol_code, IsNight(suntimes)),
			humidity: current.data.instant.details.relative_humidity,
			pressure: current.data.instant.details.air_pressure_at_sea_level,
			dewPoint: CelsiusToKelvin(current.data.instant.details.dew_point_temperature),
			extra_field: {
				name: _("Cloudiness"),
				type: "percent",
				value: current.data.instant.details.cloud_area_fraction
			},
			sunrise: suntimes.sunrise,
			sunset: suntimes.sunset,
			wind: {
				degree: current.data.instant.details.wind_from_direction,
				speed: current.data.instant.details.wind_speed
			},
			location: {	},
			forecasts: []
		};

		const hourlyForecasts: HourlyForecastData[] = [];
		for (const element of json.properties.timeseries) {

			// Hourly forecast
			if (!!element.data.next_1_hours) {
				hourlyForecasts.push({
					date: DateTime.fromISO(element.time, { zone: loc.timeZone }),
					temp: CelsiusToKelvin(element.data.instant.details.air_temperature),
					precipitation: {
						type: "rain",
						volume: element.data.next_1_hours.details.precipitation_amount
					},
					condition: this.ResolveCondition(element.data.next_1_hours.summary.symbol_code, IsNight(suntimes, DateTime.fromISO(element.time, { zone: loc.timeZone })))
				});
			}
		}
		result.hourlyForecasts = hourlyForecasts;
		result.forecasts = this.BuildForecasts(json.properties.timeseries, loc);
		return result;
	}

	private BuildForecasts(forecastsData: MetNorwayData[], loc: LocationData): ForecastData[] {
		const forecasts: ForecastData[] = [];
		const days = this.SortDataByDay(forecastsData, loc);

		for (const day of days) {
			const forecast: ForecastData = {
				condition: {
					customIcon: "cloudy-symbolic",
					description: "",
					icons: [],
					main: ""
				},
				date: <any>null, // we will build it below
				temp_max: Number.NEGATIVE_INFINITY,
				temp_min: Number.POSITIVE_INFINITY
			}

			// Get min/max temp from 6-hourly data
			// get condition from hourly data
			const conditionCounter: ConditionCount = {};
			for (const element of day) {
				if (!element.data.next_6_hours) continue;
				forecast.date = DateTime.fromISO(element.time, { zone: loc.timeZone });
				if (element.data.next_6_hours.details.air_temperature_max > <number>forecast.temp_max) forecast.temp_max = element.data.next_6_hours.details.air_temperature_max;
				if (element.data.next_6_hours.details.air_temperature_min < <number>forecast.temp_min) forecast.temp_min = element.data.next_6_hours.details.air_temperature_min;

				const [symbol] = element.data.next_6_hours.summary.symbol_code.split("_");
				const severity = conditionSeverity[symbol as Conditions];

				if (!conditionCounter[severity]) conditionCounter[severity] = { count: 0, name: symbol as Conditions };
				conditionCounter[severity].count = conditionCounter[severity].count + 1;
			}

			forecast.temp_max = CelsiusToKelvin(forecast.temp_max);
			forecast.temp_min = CelsiusToKelvin(forecast.temp_min);
			forecast.condition = this.ResolveCondition(this.GetMostSevereCondition(conditionCounter));

			forecasts.push(forecast);
		}
		return forecasts;
	}

	// -------------------------------------------
	//
	//  Utility functions
	//
	// -----------------------------------------------

	private GetEarliestDataForToday(events: MetNorwayData[], loc: LocationData): MetNorwayData {
		let earliest: number = 0;
		for (const [i, element] of events.entries()) {
			const earliestElementTime = DateTime.fromISO(element.time, { zone: loc.timeZone });
			const timestamp = DateTime.fromISO(element.time, { zone: loc.timeZone });

			// not same date
			if (!DateTime.utc().setZone(loc.timeZone).hasSame(timestamp, "day")) continue;
			if (earliestElementTime < timestamp) continue;

			earliest = i;
		}
		return events[earliest];
	}

	private SortDataByDay(data: MetNorwayData[], loc: LocationData): MetNorwayData[][] {
		const days: MetNorwayData[][] = []
		// Sort and containerize forecasts by date
		let currentDay = DateTime.fromISO(this.GetEarliestDataForToday(data, loc).time, { zone: loc.timeZone });
		let dayIndex = 0;
		days.push([]);
		for (const element of data) {
			const timestamp = DateTime.fromISO(element.time, { zone: loc.timeZone });
			if (OnSameDay(timestamp, currentDay)) {
				days[dayIndex].push(element);
			}
			else if (!OnSameDay(timestamp, currentDay)) {
				dayIndex++;
				currentDay = timestamp;
				days.push([]);
				days[dayIndex].push(element);
			}
		}

		return days;
	}

	private GetMostCommonCondition(count: ConditionCount): string {
		let result: number = -1;
		for (const key in count) {
			if (result == -1) result = parseInt(key);
			if (count[result].count < count[key].count) result = parseInt(key);
		}
		return count[result].name;
	}

	private GetMostSevereCondition(conditions: ConditionCount): string {
		// for Weather conditions
		//this.app.log.Debug(JSON.stringify(conditions));

		// We want to know the worst condition
		let result: number = -1;
		for (const key in conditions) {
			const conditionID = parseInt(key);
			// Polar night id's are above 100, make sure to remove them for checking
			const resultStripped = (result > 100) ? result - 100 : result;
			const conditionIDStripped = (conditionID > 100) ? conditionID - 100 : conditionID;
			// Make the comparison, keep the polar night condition id
			if (conditionIDStripped > resultStripped) result = conditionID;
		}
		// If there is no rain or worse, just get the most common condition for the day
		if (result <= 4) {
			return this.GetMostCommonCondition(conditions);
		}
		return conditions[result].name;
	}

	private GetUrl(loc: LocationData): string {
		let url = this.baseUrl + "lat=";
		url += (loc.lat + "&lon=" + loc.lon);
		return url;
	}

	private DeconstructCondition(icon: string) {
		const condition = icon.split("_");

		return {
			timeOfDay: condition[1] as TimeOfDay,
			condition: condition[0] as Conditions
		}
	}

	private ResolveCondition(icon: string | undefined, isNight: boolean = false): Condition {
		if (icon == null) {
			Logger.Error("Icon was not found");
			return {
				customIcon: "cloud-refresh-symbolic",
				main: _("Unknown"),
				description: _("Unknown"),
				icons: ["weather-severe-alert"]
			}
		}

		const weather = this.DeconstructCondition(icon);
		switch (weather.condition) {
			case "clearsky":
				return {
					customIcon: (isNight) ? "night-clear-symbolic" : "day-sunny-symbolic",
					main: _("Clear sky"),
					description: _("Clear sky"),
					icons: (isNight) ? ["weather-clear-night"] : ["weather-clear"]
				}
			case "cloudy":
				return {
					customIcon: "cloudy-symbolic",
					main: _("Cloudy"),
					description: _("Cloudy"),
					icons: (isNight) ? ["weather-overcast", "weather-clouds-night", "weather-few-clouds-night"] : ["weather-overcast", "weather-clouds", "weather-few-clouds"]
				}
			case "fair":
				return {
					customIcon: (isNight) ? "night-cloudy-symbolic" : "day-cloudy-symbolic",
					main: _("Fair"),
					description: _("Fair"),
					icons: (isNight) ? ["weather-few-clouds-night", "weather-clouds-night", "weather-overcast"] : ["weather-few-clouds", "weather-clouds", "weather-overcast"]
				}
			case "fog":
				return {
					customIcon: "fog-symbolic",
					main: _("Fog"),
					description: _("Fog"),
					icons: ["weather-fog", "weather-severe-alert"]
				}
			case "heavyrain":
				return {
					customIcon: "rain-symbolic",
					main: _("Heavy rain"),
					description: _("Heavy rain"),
					icons: ["weather-rain", "weather-freezing-rain", "weather-showers"]
				}
			case "heavyrainandthunder":
				return {
					customIcon: "thunderstorm-symbolic",
					main: _("Heavy rain"),
					description: _("Heavy rain and thunder"),
					icons: ["weather-rain", "weather-freezing-rain", "weather-showers"]
				}
			case "heavyrainshowers":
				return {
					customIcon: (isNight) ? "night-alt-rain-symbolic" : "day-rain-symbolic",
					main: _("Heavy rain"),
					description: _("Heavy rain showers"),
					icons: ["weather-showers", "weather-showers-scattered"]
				}
			case "heavyrainshowersandthunder":
				return {
					customIcon: (IsNight) ? "night-alt-thunderstorm-symbolic" : "day-thunderstorm-symbolic",
					main: _("Heavy rain"),
					description: _("Heavy rain showers and thunder"),
					icons: ["weather-showers", "weather-showers-scattered"]
				}
			case "heavysleet":
				return {
					customIcon: "sleet-symbolic",
					main: _("Heavy sleet"),
					description: _("Heavy sleet"),
					icons: ["weather-showers", "weather-freezing-rain", "weather-rain"]
				}
			case "heavysleetandthunder":
				return {
					customIcon: "sleet-storm-symbolic",
					main: _("Heavy sleet"),
					description: _("Heavy sleet and thunder"),
					icons: ["weather-showers", "weather-freezing-rain", "weather-rain"]
				}
			case "heavysleetshowers":
				return {
					customIcon: (isNight) ? "night-alt-sleet-symbolic" : "day-sleet-symbolic",
					main: _("Heavy sleet"),
					description: _("Heavy sleet showers"),
					icons: ["weather-showers", "weather-showers-scattered", "weather-freezing-rain"]

				}
			case "heavysleetshowersandthunder":
				return {
					customIcon: (IsNight) ? "night-alt-sleet-storm-symbolic" : "day-sleet-storm-symbolic",
					main: _("Heavy sleet"),
					description: _("Heavy sleet showers and thunder"),
					icons: ["weather-showers", "weather-showers-scattered", "weather-freezing-rain"]

				}
			case "heavysnow":
				return {
					customIcon: "snow-symbolic",
					main: _("Heavy snow"),
					description: _("Heavy snow"),
					icons: ["weather-snow"]
				}
			case "heavysnowandthunder":
				return {
					customIcon: "snow-symbolic",
					main: _("Heavy snow"),
					description: _("Heavy snow and thunder"),
					icons: ["weather-snow"]
				}
			case "heavysnowshowers":
				return {
					customIcon: (isNight) ? "night-alt-snow-symbolic" : "day-snow-symbolic",
					main: _("Heavy snow"),
					description: _("Heavy snow showers"),
					icons: ["weather-snow-scattered", "weather-snow"]

				}
			case "heavysnowshowersandthunder":
				return {
					customIcon: (isNight) ? "night-alt-snow-thunderstorm-symbolic" : "day-snow-thunderstorm-symbolic",
					main: _("Heavy snow"),
					description: _("Heavy snow showers and thunder"),
					icons: ["weather-snow-scattered", "weather-snow"]

				}
			case "lightrain":
				return {
					customIcon: "rain-mix-symbolic",
					main: _("Light rain"),
					description: _("Light rain"),
					icons: ["weather-showers-scattered", "weather-rain"]
				}
			case "lightrainandthunder":
				return {
					customIcon: "rain-mix-storm-symbolic",
					main: _("Light rain"),
					description: _("Light rain and thunder"),
					icons: ["weather-showers-scattered", "weather-rain"]
				}
			case "lightrainshowers":
				return {
					customIcon: (isNight) ? "night-alt-rain-mix-symbolic" : "day-rain-mix-symbolic",
					main: _("Light rain"),
					description: _("Light rain showers"),
					icons: ["weather-showers-scattered", "weather-rain"]

				}
			case "lightrainshowersandthunder":
				return {
					customIcon: (isNight) ? "night-alt-rain-mix-storm-symbolic" : "day-rain-mix-storm-symbolic",
					main: _("Light rain"),
					description: _("Light rain showers and thunder"),
					icons: ["weather-showers-scattered", "weather-rain"]

				}
			case "lightsleet":
				return {
					customIcon: "sleet-symbolic",
					main: _("Light sleet"),
					description: _("Light sleet"),
					icons: ["weather-freezing-rain", "weather-showers"]
				}
			case "lightsleetandthunder":
				return {
					customIcon: "sleet-storm-symbolic",
					main: _("Light sleet"),
					description: _("Light sleet and thunder"),
					icons: ["weather-freezing-rain", "weather-showers"]
				}
			case "lightsleetshowers":
				return {
					customIcon: (IsNight) ? "night-alt-sleet-symbolic" : "day-sleet-symbolic",
					main: _("Light sleet"),
					description: _("Light sleet showers"),
					icons: ["weather-freezing-rain", "weather-showers"]

				}
			case "lightssleetshowersandthunder":
				return {
					customIcon: (IsNight) ? "night-alt-sleet-storm-symbolic" : "day-sleet-storm-symbolic",
					main: _("Light sleet"),
					description: _("Light sleet showers and thunder"),
					icons: ["weather-freezing-rain", "weather-showers"]

				}
			case "lightsnow":
				return {
					customIcon: "snow-symbolic",
					main: _("Light snow"),
					description: _("Light snow"),
					icons: ["weather-snow"]
				}
			case "lightsnowandthunder":
				return {
					customIcon: "snow-storm-symbolic",
					main: _("Light snow"),
					description: _("Light snow and thunder"),
					icons: ["weather-snow"]
				}
			case "lightsnowshowers":
				return {
					customIcon: (isNight) ? "night-alt-snow-symbolic" : "day-snow-symbolic",
					main: _("Light snow"),
					description: _("Light snow showers"),
					icons: ["weather-snow-scattered", "weather-snow"]

				}
			case "lightssnowshowersandthunder":
				return {
					customIcon: (isNight) ? "night-alt-snow-thunderstorm-symbolic" : "day-snow-thunderstorm-symbolic",
					main: _("Light snow"),
					description: _("Light snow showers and thunder"),
					icons: ["weather-snow-scattered", "weather-snow"]

				}
			case "partlycloudy":
				return {
					customIcon: (isNight) ? "night-alt-cloudy-symbolic" : "day-cloudy-symbolic",
					main: _("Partly cloudy"),
					description: _("Partly cloudy"),
					icons: (isNight) ? ["weather-clouds-night", "weather-few-clouds-night", "weather-overcast"] : ["weather-clouds", "weather-few-clouds", "weather-overcast"]
				}
			case "rain":
				return {
					customIcon: "rain-symbolic",
					main: _("Rain"),
					description: _("Rain"),
					icons: ["weather-rain", "weather-freezing-rain", "weather-showers-scattered"]
				}
			case "rainandthunder":
				return {
					customIcon: "thunderstorm-symbolic",
					main: _("Rain"),
					description: _("Rain and thunder"),
					icons: ["weather-storm", "weather-rain", "weather-freezing-rain", "weather-showers-scattered"]
				}
			case "rainshowers":
				return {
					customIcon: (isNight) ? "night-alt-rain-mix-symbolic" : "day-rain-mix-symbolic",
					main: _("Rain showers"),
					description: _("Rain showers"),
					icons: ["weather-showers-scattered", "weather-rain", "weather-freezing-rain"]
				}
			case "rainshowersandthunder":
				return {
					customIcon: (isNight) ? "night-alt-rain-mix-storm-symbolic" : "day-rain-mix-storm-symbolic",
					main: _("Rain showers"),
					description: _("Rain showers and thunder"),
					icons: ["weather-showers-scattered", "weather-rain", "weather-freezing-rain"]
				}
			case "sleet":
				return {
					customIcon: "sleet-symbolic",
					main: _("Sleet"),
					description: _("Sleet"),
					icons: ["weather-freezing-rain", "weather-showers"]
				}
			case "sleetandthunder":
				return {
					customIcon: "sleet-storm-symbolic",
					main: _("Sleet"),
					description: _("Sleet and thunder"),
					icons: ["weather-freezing-rain", "weather-showers"]
				}
			case "sleetshowers":
				return {
					customIcon: (isNight) ? "night-alt-sleet-symbolic" : "day-sleet-symbolic",
					main: _("Sleet"),
					description: _("Sleet showers"),
					icons: ["weather-freezing-rain", "weather-showers"]

				}
			case "sleetshowersandthunder":
				return {
					customIcon: (isNight) ? "night-alt-sleet-storm-symbolic" : "day-sleet-storm-symbolic",
					main: _("Sleet"),
					description: _("Sleet showers and thunder"),
					icons: ["weather-freezing-rain", "weather-showers"]
				}
			case "snow":
				return {
					customIcon: "snow-symbolic",
					main: _("Snow"),
					description: _("Snow"),
					icons: ["weather-snow"]
				}
			case "snowandthunder":
				return {
					customIcon: "snow-storm-symbolic",
					main: _("Snow"),
					description: _("Snow and thunder"),
					icons: ["weather-snow"]
				}
			case "snowshowers":
				return {
					customIcon: (isNight) ? "night-alt-snow-symbolic" : "day-snow-symbolic",
					main: _("Snow showers"),
					description: _("Snow showers"),
					icons: ["weather-snow-scattered", "weather-snow"]
				}
			case "snowshowersandthunder":
				return {
					customIcon: (isNight) ? "night-alt-snow-thunderstorm-symbolic" : "day-snow-thunderstorm-symbolic",
					main: _("Snow showers"),
					description: _("Snow showers and thunder"),
					icons: ["weather-snow-scattered", "weather-snow"]
				}
			default:
				Logger.Error("condition code not found: " + weather.condition);
				return {
					customIcon: "cloud-refresh-symbolic",
					main: _("Unknown"),
					description: _("Unknown"),
					icons: ["weather-severe-alert"]
				}
		}
	}
}

/** https://api.met.no/weatherapi/weathericon/2.0/documentation#!/data/get_legends */
const conditionSeverity: ConditionProperties = {
	clearsky: 1,
	cloudy: 4,
	fair: 2,
	fog: 15,
	heavyrain: 10,
	heavyrainandthunder: 11,
	heavyrainshowers: 41,
	heavyrainshowersandthunder: 25,
	heavysleet: 48,
	heavysleetandthunder: 32,
	heavysleetshowers: 43,
	heavysleetshowersandthunder: 27,
	heavysnow: 50,
	heavysnowandthunder: 34,
	heavysnowshowers: 45,
	heavysnowshowersandthunder: 29,
	lightrain: 46,
	lightrainandthunder: 30,
	lightrainshowers: 40,
	lightrainshowersandthunder: 24,
	lightsleet: 47,
	lightsleetandthunder: 31,
	lightsleetshowers: 42,
	lightsnow: 49,
	lightsnowandthunder: 33,
	lightsnowshowers: 44,
	lightssleetshowersandthunder: 26,
	lightssnowshowersandthunder: 28,
	partlycloudy: 3,
	rain: 9,
	rainandthunder: 22,
	rainshowers: 5,
	rainshowersandthunder: 6,
	sleet: 12,
	sleetandthunder: 23,
	sleetshowers: 7,
	sleetshowersandthunder: 20,
	snow: 13,
	snowandthunder: 14,
	snowshowers: 8,
	snowshowersandthunder: 21
}

interface MetNorwayPayload {
	type: string,
	geometry: {
		type: string,
		/** lon, lat, alt */
		coordinates: number[]
	},
	properties: {
		meta: {
			updated_at: string,
			units: {
				air_pressure_at_sea_level: string,
				air_temperature: string,
				air_temperature_max: string,
				air_temperature_min: string,
				cloud_area_fraction: string,
				cloud_area_fraction_high: string,
				cloud_area_fraction_low: string,
				cloud_area_fraction_medium: string,
				dew_point_temperature: string,
				fog_area_fraction: string,
				precipitation_amount: string,
				relative_humidity: string,
				ultraviolet_index_clear_sky: string,
				wind_from_direction: string,
				wind_speed: string
			}
		},
		timeseries: MetNorwayData[]
	}
}

interface MetNorwayData {
	time: string,
	data: {
		instant: {
			details: {
				/**hPa */
				air_pressure_at_sea_level: number,
				/** C */
				air_temperature: number,
				/** % */
				cloud_area_fraction: number,
				/** % */
				cloud_area_fraction_high: number,
				/** % */
				cloud_area_fraction_low: number,
				/** % */
				cloud_area_fraction_medium: number,
				/** C */
				dew_point_temperature: number,
				/** % */
				fog_area_fraction: number,
				/** % */
				relative_humidity: number,
				/** 1 */
				ultraviolet_index_clear_sky: number,
				/** degrees */
				wind_from_direction: number,
				/** m/s */
				wind_speed: number
			}
		},
		next_12_hour?: {
			summary: {
				symbol_code: string
			}
		},
		next_1_hours?: {
			summary: {
				symbol_code: string
			},
			details: {
				/** mm */
				precipitation_amount: number
			}
		},
		next_6_hours?: {
			summary: {
				symbol_code: string
			},
			details: {
				/** C */
				air_temperature_max: number,
				/** C */
				air_temperature_min: number,
				/** mm */
				precipitation_amount: number
			}
		}
	}
}

interface ConditionCount {
	[key: number]: METCondition
}

interface METCondition {
	count: number;
	name: Conditions;
}

type TimeOfDay = "day" | "night" | "polartwilight";

type ConditionProperties = {
	[key in Conditions]: number
}

type Conditions =
	"clearsky" |
	"cloudy" |
	"fair" |
	"fog" |
	"heavyrain" |
	"heavyrainandthunder" |
	"heavyrainshowers" |
	"heavyrainshowersandthunder" |
	"heavysleet" |
	"heavysleetandthunder" |
	"heavysleetshowers" |
	"heavysleetshowersandthunder" |
	"heavysnow" |
	"heavysnowandthunder" |
	"heavysnowshowers" |
	"heavysnowshowersandthunder" |
	"lightrain" |
	"lightrainandthunder" |
	"lightrainshowers" |
	"lightrainshowersandthunder" |
	"lightsleet" |
	"lightsleetandthunder" |
	"lightsleetshowers" |
	"lightsnow" |
	"lightsnowandthunder" |
	"lightsnowshowers" |
	"lightssleetshowersandthunder" |
	"lightssnowshowersandthunder" |
	"partlycloudy" |
	"rain" |
	"rainandthunder" |
	"rainshowers" |
	"rainshowersandthunder" |
	"sleet" |
	"sleetandthunder" |
	"sleetshowers" |
	"sleetshowersandthunder" |
	"snow" |
	"snowandthunder" |
	"snowshowers" |
	"snowshowersandthunder";
