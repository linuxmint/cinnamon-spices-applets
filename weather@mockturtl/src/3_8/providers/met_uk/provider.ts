import { DateTime } from "luxon";
import type { Config } from "../../config";
import { Services } from "../../config";
import { HttpLib } from "../../lib/httpLib";
import type { correctGetTimes, LocationData, WeatherProvider } from "../../types";
import { _, CelsiusToKelvin, CompassToDeg } from "../../utils";
import type { Condition, ForecastData, HourlyForecastData, WeatherData } from "../../weather-data";
import type { MetUkHourlyPayload, MetUkHourlyProperties } from "./payload/hourly";
import { Logger } from "../../lib/services/logger";
import type { MetUkDailyPayload, MetUkDailyProperties } from "./payload/daily";
import type { MetUkObservationData, MetUkObservationStation } from "./payload/observation";
import { getTimes } from "suncalc";

export interface MetUKOptions {
	forecastKey: string;
	observationKey: string;
}

export class MetUk implements WeatherProvider<Services.MetOfficeUK, MetUKOptions> {
	public readonly prettyName = _("Met Office UK");
	public readonly name = Services.MetOfficeUK;
	public readonly website = "https://www.metoffice.gov.uk/";
	public readonly needsApiKey = true;
	public readonly maxHourlyForecastSupport = 48;
	public readonly maxForecastSupport = 6;

	public readonly remainingCalls: number | null = null;
	public readonly supportHourlyPrecipChance = true;
	public readonly supportHourlyPrecipVolume = true;
	public readonly locationType = "coordinates";

	private baseUrl = "https://data.hub.api.metoffice.gov.uk/sitespecific/v0";
	private observationBaseUrl = "https://data.hub.api.metoffice.gov.uk/observation-land/1";
	private observationUrl = `${this.observationBaseUrl}/nearest`;


	private static params: Record<string, string> = {
		includeLocationName: "true",
	}

	private hourlyForecastUrl = `${this.baseUrl}/point/hourly`;
	private forecastUrl = `${this.baseUrl}/point/daily`;

	public async GetWeather(newLocation: LocationData, cancellable: imports.gi.Gio.Cancellable, config: Config, options: MetUKOptions): Promise<WeatherData | null> {
		const { forecastKey, observationKey } = options;
		const params: Record<string, string> = {
			...MetUk.params,
			latitude: newLocation.lat.toString(),
			longitude: newLocation.lon.toString(),
		}

		const [hourlyRes, dailyRes, observationStationRes] = await Promise.all([
			HttpLib.Instance.LoadJsonAsync<MetUkHourlyPayload>({
				url: this.hourlyForecastUrl,
				headers: {
					apiKey: forecastKey,
				},
				params: params,
				cancellable: cancellable,
			}),
			HttpLib.Instance.LoadJsonAsync<MetUkDailyPayload>({
				url: this.forecastUrl,
				headers: {
					apiKey: forecastKey,
				},
				params: params,
				cancellable: cancellable,
			}),
			HttpLib.Instance.LoadJsonAsync<MetUkObservationStation[]>({
				url: this.observationUrl,
				headers: {
					apiKey: observationKey,
				},
				params: {
					lat: newLocation.lat.toFixed(2).toString(),
					lon: newLocation.lon.toFixed(2).toString(),
				},
				cancellable: cancellable,
			}),
		]);

		if (!observationStationRes.Success) {
			Logger.Error(`MetUK: Failed to get observation station data: ${JSON.stringify(observationStationRes.ErrorData)}`);
			return null;
		}

		if (!hourlyRes.Success) {
			Logger.Error(`MetUK: Failed to get hourly data: ${JSON.stringify(hourlyRes.ErrorData)}`);
			return null;
		}

		if (!dailyRes.Success) {
			Logger.Error(`MetUK: Failed to get daily data: ${JSON.stringify(dailyRes.ErrorData)}`);
			return null;
		}

		const hourlyForecasts = hourlyRes.Data.features[0]?.properties;
		if (!hourlyForecasts) {
			Logger.Error(`MetUK: No hourly forecast data found for location ${newLocation.lat}, ${newLocation.lon}`);
			return null;
		}

		const dailyForecasts = dailyRes.Data.features[0]?.properties;
		if (!dailyForecasts) {
			Logger.Error(`MetUK: No daily forecast data found for location ${newLocation.lat}, ${newLocation.lon}`);
			return null;
		}

		const observationStation = observationStationRes.Data[0];
		if (!observationStation) {
			Logger.Error(`MetUK: No observation station data found for location ${newLocation.lat}, ${newLocation.lon}`);
			return null;
		}

		const times = (getTimes as correctGetTimes)(new Date(), newLocation.lat, newLocation.lon, hourlyRes.Data.features[0].geometry.coordinates[2]);


		const observationRes = await HttpLib.Instance.LoadJsonAsync<MetUkObservationData[]>({
			url: `${this.observationBaseUrl}/${observationStation.geohash}`,
			headers: {
				apiKey: observationKey,
			},
			cancellable: cancellable,
		});

		if (!observationRes.Success) {
			Logger.Error(`MetUK: Failed to get observation data: ${JSON.stringify(observationRes.ErrorData)}`);
			return null;
		}

		const now = DateTime.now();
		// The hourly item's end time must be in the future
		const firstHourRelevantIndex = hourlyForecasts.timeSeries.findIndex(item => DateTime.fromISO(item.time).plus({ hours: 1 }) >= now);
		hourlyForecasts.timeSeries = firstHourRelevantIndex === -1 ? [] : hourlyForecasts.timeSeries.slice(firstHourRelevantIndex);
		const firstDayRelevantIndex = dailyForecasts.timeSeries.findIndex(item => DateTime.fromISO(item.time).set({ hour: 12, minute: 0, second: 0, millisecond: 0 }) >= now.set({ hour: 12, minute: 0, second: 0, millisecond: 0 }));
		dailyForecasts.timeSeries = firstDayRelevantIndex === -1 ? [] : dailyForecasts.timeSeries.slice(firstDayRelevantIndex);

		if (hourlyForecasts.timeSeries.length === 0) {
			Logger.Error(`MetUK: No relevant hourly forecast data found for location ${newLocation.lat}, ${newLocation.lon}`);
			return null;
		}

		const observationLast = observationRes.Data.length > 0 ? observationRes.Data[observationRes.Data.length - 1] : null;
		const hourlyForecastFirst = hourlyForecasts.timeSeries[0];

		return {
			condition: this.ResolveCondition(observationLast?.weather_code ?? hourlyForecastFirst.significantWeatherCode),
			coord: {
				lat: newLocation.lat,
				lon: newLocation.lon,
			},
			date: DateTime.fromISO(hourlyForecasts.modelRunDate).setZone(observationStation.olson_time_zone),
			wind: {
				speed: observationLast?.wind_speed ?? hourlyForecastFirst.windSpeed10m,
				degree: observationLast?.wind_direction ? CompassToDeg(observationLast.wind_direction) : hourlyForecastFirst.windDirectionFrom10m,
			},
			humidity: observationLast?.humidity ?? hourlyForecastFirst.screenRelativeHumidity,
			pressure: observationLast?.mslp ?? hourlyForecastFirst.mslp,
			dewPoint: null,
			forecasts: this.GetDailyForecasts(dailyForecasts, observationStation.olson_time_zone),
			hourlyForecasts: this.GetHourlyForecasts(hourlyForecasts, observationStation.olson_time_zone),
			sunrise: DateTime.fromJSDate(times.sunrise, { zone: observationStation.olson_time_zone }),
			sunset: DateTime.fromJSDate(times.sunset, { zone: observationStation.olson_time_zone }),
			location: {
				timeZone: observationStation.olson_time_zone,
				country: observationStation.country ?? undefined,
			},
			temperature: CelsiusToKelvin(observationLast?.temperature ?? hourlyForecastFirst.screenTemperature),
			uvIndex: hourlyForecastFirst.uvIndex,
			alerts: [],
			stationInfo: {
				distanceFrom: hourlyForecasts.requestPointDistance,
				name: hourlyForecasts.location.name,
				lat: hourlyRes.Data.features[0].geometry.coordinates[1],
				lon: hourlyRes.Data.features[0].geometry.coordinates[0],
			},
			extra_field: {
				name: _("Feels Like"),
				value: CelsiusToKelvin(hourlyForecastFirst.feelsLikeTemperature),
				type: "temperature"
			}
		};
	}

	private GetHourlyForecasts(payload: MetUkHourlyProperties, timezone: string): HourlyForecastData[] {
		const result: HourlyForecastData[] = [];
		for (const item of payload.timeSeries) {
			result.push({
				date: DateTime.fromISO(item.time).setZone(timezone),
				temp: CelsiusToKelvin(item.screenTemperature),
				condition: this.ResolveCondition(item.significantWeatherCode),
				precipitation: item.probOfPrecipitation < 20 ? undefined : {
					type: item.totalPrecipAmount > item.totalSnowAmount ? "rain" : "snow",
					chance: item.probOfPrecipitation,
					volume: item.precipitationRate,
				},
			})
		}

		return result;
	}

	private GetDailyForecasts(payload: MetUkDailyProperties, timezone: string): ForecastData[] {
		const result: ForecastData[] = [];
		for (const item of payload.timeSeries) {
			result.push({
				date: DateTime.fromISO(item.time).setZone(timezone),
				temp_min: CelsiusToKelvin(item.nightMinScreenTemperature),
				temp_max: CelsiusToKelvin(item.dayMaxScreenTemperature),
				condition: this.ResolveCondition(item.daySignificantWeatherCode ?? item.nightSignificantWeatherCode),
			})
		}

		return result;
	}

	// No idea if this is till correct, can't find any documentation on it
	private ResolveCondition(icon: number | null | undefined): Condition {
		switch (icon) {
			case null:
			case undefined:
				return {
					main: _("Unknown"),
					description: _("Unknown"),
					customIcon: "cloud-refresh-symbolic",
					icons: ["weather-severe-alert"]
				}
			case 0: // Clear night
				return {
					main: _("Clear"),
					description: _("Clear"),
					customIcon: "night-clear-symbolic",
					icons: ["weather-clear-night", "weather-severe-alert"]
				}
			case 1: // Sunny day
				return {
					main: _("Sunny"),
					description: _("Sunny"),
					customIcon: "day-sunny-symbolic",
					icons: ["weather-clear", "weather-severe-alert"]
				}
			case 2: // Partly cloudy (night)
				return {
					main: _("Partly cloudy"),
					description: _("Partly cloudy"),
					customIcon: "night-alt-cloudy-symbolic",
					icons: ["weather-clouds-night", "weather-overcast", "weather-severe-alert"]
				}
			case 3: // Partly cloudy (day)
				return {
					main: _("Partly cloudy"),
					description: _("Partly cloudy"),
					customIcon: "day-cloudy-symbolic",
					icons: ["weather-clouds", "weather-overcast", "weather-severe-alert"]
				}
			case 4: // Not used - really?
				return {
					main: _("Unknown"),
					description: _("Unknown"),
					customIcon: "cloud-refresh-symbolic",
					icons: ["weather-severe-alert"]
				}
			case 5: // Mist
				return {
					main: _("Mist"),
					description: _("Mist"),
					customIcon: "fog-symbolic",
					icons: ["weather-fog", "weather-severe-alert"]
				}
			case 6: // Fog
				return {
					main: _("Fog"),
					description: _("Fog"),
					customIcon: "fog-symbolic",
					icons: ["weather-fog", "weather-severe-alert"]
				}
			case 7: // Cloudy
				return {
					main: _("Cloudy"),
					description: _("Cloudy"),
					customIcon: "cloud-symbolic",
					icons: ["weather-overcast", "weather-many-clouds", "weather-severe-alert"]
				}
			case 8: // Overcast
				return {
					main: _("Overcast"),
					description: _("Overcast"),
					customIcon: "cloudy-symbolic",
					icons: ["weather-overcast", "weather-many-clouds", "weather-severe-alert"]
				}
			case 9: // Light rain shower (night)
				return {
					main: _("Light rain"),
					description: _("Light rain shower"),
					customIcon: "night-alt-showers-symbolic",
					icons: ["weather-showers-scattered-night", "weather-showers-night", "weather-showers-scattered", "weather-showers", "weather-freezing-rain", "weather-severe-alert"]
				}
			case 10: // Light rain shower (day)
				return {
					main: _("Light rain"),
					description: _("Light rain shower"),
					customIcon: "day-showers-symbolic",
					icons: ["weather-showers-scattered-day", "weather-showers-day", "weather-showers-scattered", "weather-showers", "weather-freezing-rain", "weather-severe-alert"]
				}
			case 11: // Drizzle
				return {
					main: _("Drizzle"),
					description: _("Drizzle"),
					customIcon: "showers-symbolic",
					icons: ["weather-showers-scattered", "weather-showers", "weather-rain", "weather-freezing-rain", "weather-severe-alert"]
				}
			case 12: // Light rain
				return {
					main: _("Light rain"),
					description: _("Light rain"),
					customIcon: "showers-symbolic",
					icons: ["weather-showers-scattered", "weather-showers", "weather-rain", "weather-freezing-rain", "weather-severe-alert"]
				}
			case 13: // Heavy rain shower (night)
				return {
					main: _("Heavy rain"),
					description: _("Heavy rain shower"),
					customIcon: "night-alt-rain-symbolic",
					icons: ["weather-showers-night", "weather-showers", "weather-showers-scattered", "weather-severe-alert"]
				}
			case 14: // Heavy rain shower (day)
				return {
					main: _("Heavy rain"),
					description: _("Heavy rain shower"),
					customIcon: "day-rain-symbolic",
					icons: ["weather-showers-day", "weather-showers", "weather-showers-scattered", "weather-severe-alert"]
				}
			case 15: // Heavy rain
				return {
					main: _("Heavy rain"),
					description: _("Heavy rain"),
					customIcon: "rain-symbolic",
					icons: ["weather-showers", "weather-showers-scattered", "weather-severe-alert"]
				}
			case 16: // Sleet shower (night)
				return {
					main: _("Sleet"),
					description: _("Sleet shower"),
					customIcon: "night-alt-rain-mix-symbolic",
					icons: ["weather-showers-night", "weather-showers", "weather-showers-scattered", "weather-severe-alert"]
				}
			case 17: // Sleet shower (day)
				return {
					main: _("Sleet"),
					description: _("Sleet shower"),
					customIcon: "day-rain-mix-symbolic",
					icons: ["weather-showers-day", "weather-showers", "weather-showers-scattered", "weather-severe-alert"]
				}
			case 18: // Sleet
				return {
					main: _("Sleet"),
					description: _("Sleet"),
					customIcon: "rain-mix-symbolic",
					icons: ["weather-showers", "weather-showers-scattered", "weather-severe-alert"]
				}
			case 19: // Hail shower (night)
				return {
					main: _("Hail"),
					description: _("Hail shower"),
					customIcon: "night-alt-hail-symbolic",
					icons: ["weather-showers-night", "weather-showers", "weather-showers-scattered", "weather-severe-alert"]
				}
			case 20: // Hail shower (day)
				return {
					main: _("Hail"),
					description: _("Hail shower"),
					customIcon: "day-hail-symbolic",
					icons: ["weather-showers-day", "weather-showers", "weather-showers-scattered", "weather-severe-alert"]
				}
			case 21: // Hail
				return {
					main: _("Hail"),
					description: _("Hail"),
					customIcon: "hail-symbolic",
					icons: ["weather-showers", "weather-showers-scattered", "weather-severe-alert"]
				}
			case 22: // Light snow shower (night)
				return {
					main: _("Light snow"),
					description: _("Light snow shower"),
					customIcon: "night-alt-snow-symbolic",
					icons: ["weather-snow-scattered", "weather-snow", "weather-severe-alert"]
				}
			case 23: // Light snow shower (day)
				return {
					main: _("Light snow"),
					description: _("Light snow shower"),
					customIcon: "day-snow-symbolic",
					icons: ["weather-snow-scattered", "weather-snow", "weather-severe-alert"]
				}
			case 24: // Light snow
				return {
					main: _("Light snow"),
					description: _("Light snow"),
					customIcon: "snow-symbolic",
					icons: ["weather-snow-scattered", "weather-snow", "weather-severe-alert"]
				}
			case 25: // Heavy snow shower (night)
				return {
					main: _("Heavy snow"),
					description: _("Heavy snow shower"),
					customIcon: "night-alt-snow-symbolic",
					icons: ["weather-snow", "weather-snow-scattered", "weather-severe-alert"]
				}
			case 26: // 	Heavy snow shower (day)
				return {
					main: _("Heavy snow"),
					description: _("Heavy snow shower"),
					customIcon: "day-snow-symbolic",
					icons: ["weather-snow", "weather-snow-scattered", "weather-severe-alert"]
				}
			case 27: // Heavy snow
				return {
					main: _("Heavy snow"),
					description: _("Heavy snow"),
					customIcon: "snow-symbolic",
					icons: ["weather-snow", "weather-snow-scattered", "weather-severe-alert"]
				}
			case 28: // Thunder shower (night)
				return {
					main: _("Thunder"),
					description: _("Thunder shower"),
					customIcon: "day-storm-showers-symbolic",
					icons: ["weather-storm", "weather-severe-alert"]
				}
			case 29: // Thunder shower (day)
				return {
					main: _("Thunder"),
					description: _("Thunder shower"),
					customIcon: "night-alt-storm-showers-symbolic",
					icons: ["weather-storm", "weather-severe-alert"]
				}
			case 30: // Thunder
				return {
					main: _("Thunder"),
					description: _("Thunder"),
					customIcon: "thunderstorm-symbolic",
					icons: ["weather-storm", "weather-severe-alert"]
				}
			default:
				return {
					main: _("Unknown"),
					description: _("Unknown"),
					customIcon: "cloud-refresh-symbolic",
					icons: ["weather-severe-alert"]
				}
		}
	}
}