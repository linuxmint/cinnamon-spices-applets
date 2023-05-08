import { Logger } from "../../lib/logger";
import { getTimes } from "suncalc";
import { WeatherProvider, WeatherData, HourlyForecastData, ForecastData, Condition, LocationData, correctGetTimes, SunTime, ImmediatePrecipitation } from "../../types";
import { CelsiusToKelvin, IsNight, OnSameDay, _ } from "../../utils";
import { DateTime } from "luxon";
import { BaseProvider } from "../BaseProvider";
import { Conditions, conditionSeverity, TimeOfDay } from "./types/common";
import { IsCovered, MetNorwayNowcastPayload } from "./types/nowcast";
import { MetNorwayForecastData, MetNorwayForecastPayload } from "./types/forecast";

export class MetNorway extends BaseProvider {
	public readonly prettyName = _("MET Norway");
	public readonly name = "MetNorway";
	public readonly maxForecastSupport = 10;
	public readonly website = "https://www.met.no/en";
	public readonly maxHourlyForecastSupport = 48;
	public readonly needsApiKey = false;
	public readonly remainingCalls: number | null = null;
	public readonly supportHourlyPrecipChance = false;
	public readonly supportHourlyPrecipVolume = true;

	private baseUrl = "https://api.met.no/weatherapi";

	public async GetWeather(loc: LocationData): Promise<WeatherData | null> {
		const [forecast, nowcast] = await Promise.all([
			this.app.LoadJsonAsync<MetNorwayForecastPayload>(`${this.baseUrl}/locationforecast/2.0/complete`, {lat: loc.lat, lon: loc.lon}),
			this.app.LoadJsonAsync<MetNorwayNowcastPayload>(`${this.baseUrl}/nowcast/2.0/complete`, {lat: loc.lat, lon: loc.lon}, (e) => e.ErrorData.code != 422),
		]);

		if (!forecast) {
			Logger.Error("MET Norway: Empty response from API");
			return null;
		}

		const result = this.ParseWeather(forecast, loc);

		if (nowcast != null) {
			result.date = DateTime.fromISO(nowcast.properties.meta.updated_at, { zone: loc.timeZone });
			result.temperature = CelsiusToKelvin(nowcast.properties.timeseries[0].data.instant.details.air_temperature);
			result.condition = this.ResolveCondition(nowcast.properties.timeseries[0].data.next_1_hours.summary.symbol_code);
			result.wind.degree = nowcast.properties.timeseries[0].data.instant.details.wind_from_direction;
			result.wind.speed = nowcast.properties.timeseries[0].data.instant.details.wind_speed;
			result.humidity = nowcast.properties.timeseries[0].data.instant.details.relative_humidity;

			if (IsCovered(nowcast)) {
				if (nowcast.properties.timeseries[0].data.next_1_hours.details.precipitation_amount > 0) {
					const immediate: ImmediatePrecipitation = {
						start: -1,
						end: -1
					}

					for (let i = 0; i < nowcast.properties.timeseries.length; i++) {
						const element = nowcast.properties.timeseries[i];
						const next = nowcast.properties.timeseries[i+1];
						// Next element is already in the past, skip this one
						if (next != null && DateTime.fromISO(next.time).diffNow().milliseconds < 0)
							continue;

						if (element.data.instant.details.precipitation_rate > 0 && immediate.start == -1) {
							immediate.start = DateTime.fromISO(element.time).diffNow().minutes;
							continue;
						}
						else if (element.data.instant.details.precipitation_rate == 0 && immediate.start != -1) {
							immediate.end = DateTime.fromISO(element.time).diffNow().minutes;
							break
						}
					}

					result.immediatePrecipitation = immediate;
				}
			}
		}

		return result;
	}

	private RemoveEarlierElements(json: MetNorwayForecastPayload, loc: LocationData): MetNorwayForecastPayload {
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

	private ParseWeather(json: MetNorwayForecastPayload, loc: LocationData): WeatherData {
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

	private BuildForecasts(forecastsData: MetNorwayForecastData[], loc: LocationData): ForecastData[] {
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

	private GetEarliestDataForToday(events: MetNorwayForecastData[], loc: LocationData): MetNorwayForecastData {
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

	private SortDataByDay(data: MetNorwayForecastData[], loc: LocationData): MetNorwayForecastData[][] {
		const days: MetNorwayForecastData[][] = []
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

	private GetMostCommonCondition(count: ConditionCount): string | null {
		let result: number | null = null;
		for (const key in count) {
			if (result == null || count[result].count < count[key].count)
				result = parseInt(key);
		}

		if (result == null)
			return null;

		return count[result].name;
	}

	private GetMostSevereCondition(conditions: ConditionCount): string | null {
		// We want to know the worst condition
		let result: number | null = null;
		for (const key in conditions) {
			const conditionID = parseInt(key);
			// Polar night id's are above 100, make sure to remove them for checking
			const resultStripped = result == null ? -1 : (result > 100) ? result - 100 : result;
			const conditionIDStripped = (conditionID > 100) ? conditionID - 100 : conditionID;
			// Make the comparison, keep the polar night condition id
			if (conditionIDStripped > resultStripped) result = conditionID;
		}

		if (result == null)
			return null;

		// If there is no rain or worse, just get the most common condition for the day
		if (result <= 4) {
			return this.GetMostCommonCondition(conditions);
		}
		return conditions[result].name;
	}

	private DeconstructCondition(icon: string) {
		const condition = icon.split("_");

		return {
			timeOfDay: condition[1] as TimeOfDay,
			condition: condition[0] as Conditions
		}
	}

	private ResolveCondition(icon: string | undefined | null, isNight: boolean = false): Condition {
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
					icons: ["weather-rain", "weather-showers", "weather-freezing-rain"]
				}
			case "heavyrainandthunder":
				return {
					customIcon: "thunderstorm-symbolic",
					main: _("Heavy rain"),
					description: _("Heavy rain and thunder"),
					icons: ["weather-rain", "weather-showers", "weather-freezing-rain"]
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
					customIcon: (isNight) ? "night-alt-thunderstorm-symbolic" : "day-thunderstorm-symbolic",
					main: _("Heavy rain"),
					description: _("Heavy rain showers and thunder"),
					icons: ["weather-showers", "weather-showers-scattered"]
				}
			case "heavysleet":
				return {
					customIcon: "sleet-symbolic",
					main: _("Heavy sleet"),
					description: _("Heavy sleet"),
					icons: ["weather-freezing-rain", "weather-showers", "weather-rain"]
				}
			case "heavysleetandthunder":
				return {
					customIcon: "sleet-storm-symbolic",
					main: _("Heavy sleet"),
					description: _("Heavy sleet and thunder"),
					icons: ["weather-freezing-rain", "weather-showers", "weather-rain"]
				}
			case "heavysleetshowers":
				return {
					customIcon: (isNight) ? "night-alt-sleet-symbolic" : "day-sleet-symbolic",
					main: _("Heavy sleet"),
					description: _("Heavy sleet showers"),
					icons: ["weather-freezing-rain", "weather-showers", "weather-showers-scattered"]

				}
			case "heavysleetshowersandthunder":
				return {
					customIcon: (isNight) ? "night-alt-sleet-storm-symbolic" : "day-sleet-storm-symbolic",
					main: _("Heavy sleet"),
					description: _("Heavy sleet showers and thunder"),
					icons: ["weather-freezing-rain", "weather-showers", "weather-showers-scattered"]

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
					customIcon: (isNight) ? "night-alt-sleet-symbolic" : "day-sleet-symbolic",
					main: _("Light sleet"),
					description: _("Light sleet showers"),
					icons: ["weather-freezing-rain", "weather-showers"]

				}
			case "lightssleetshowersandthunder":
				return {
					customIcon: (isNight) ? "night-alt-sleet-storm-symbolic" : "day-sleet-storm-symbolic",
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
					icons: ["weather-rain", "weather-showers-scattered", "weather-showers"]
				}
			case "rainandthunder":
				return {
					customIcon: "thunderstorm-symbolic",
					main: _("Rain"),
					description: _("Rain and thunder"),
					icons: ["weather-storm", "weather-rain", "weather-freezing-rain", "weather-showers-scattered", "weather-showers"]
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

interface ConditionCount {
	[key: number]: METCondition
}

interface METCondition {
	count: number;
	name: Conditions;
}