import { DateTime } from "luxon";
import type { Config } from "../../config";
import { Services } from "../../config";
import { HttpLib } from "../../lib/httpLib";
import type { LocationData } from "../../types";
import { _, CelsiusToKelvin } from "../../utils";
import type { Condition, HourlyForecastData, WeatherData } from "../../weather-data";
import { BaseProvider } from "../BaseProvider";
import type { MetUkHourlyPayload, MetUkHourlyProperties } from "./payload/hourly";
import { Logger } from "../../lib/services/logger";

export class MetUk extends BaseProvider {
	public readonly prettyName = _("Met Office UK");
	public readonly name = Services.MetOfficeUK;
	public readonly website = "https://www.metoffice.gov.uk/";
	public readonly needsApiKey = true;
	public readonly maxHourlyForecastSupport = 48;
	public readonly maxForecastSupport = 6;

	public readonly remainingCalls: number | null = null;
	public readonly supportHourlyPrecipChance = true;
	public readonly supportHourlyPrecipVolume = true;

	private baseUrl = "https://data.hub.api.metoffice.gov.uk/sitespecific/v0";

	private static params: Record<string, string> = {
		includeLocationName: "true",
	}

	private static timezone = "Europe/London";

	private hourlyForecastUrl = `${this.baseUrl}/point/hourly`;
	private forecastUrl = `${this.baseUrl}/point/daily`;

	public async GetWeather(newLocation: LocationData, cancellable: imports.gi.Gio.Cancellable, config: Config): Promise<WeatherData | null> {
		const params: Record<string, string> = {
			...MetUk.params,
			latitude: newLocation.lat.toString(),
			longitude: newLocation.lon.toString(),
		}

		const res = await HttpLib.Instance.LoadJsonAsync<MetUkHourlyPayload>({
			url: this.hourlyForecastUrl,
			headers: {
				apiKey: config.ApiKey,
			},
			params: params,
			cancellable: cancellable,
		});

		if (!res.Success) {
			Logger.Error(`MetUK: Failed to get data: ${JSON.stringify(res.ErrorData)}`);
			return null;
		}

		const hourlyForecasts = res.Data.features[0]?.properties;
		if (!hourlyForecasts) {
			Logger.Error(`MetUK: No hourly forecast data found for location ${newLocation.lat}, ${newLocation.lon}`);
			return null;
		}

		const now = DateTime.now();
		// The hourly item's end time must be in the future
		const firstRelevantIndex = hourlyForecasts.timeSeries.findIndex(item => DateTime.fromISO(item.time).plus({ hours: 1 }) >= now);
		hourlyForecasts.timeSeries = firstRelevantIndex === -1 ? [] : hourlyForecasts.timeSeries.slice(firstRelevantIndex);

		return {
			condition: {
				customIcon: "alien-symbolic",
				description: "Sunny",
				main: "Clear",
				icons: []
			},
			coord: {
				lat: newLocation.lat,
				lon: newLocation.lon,
			},
			date: DateTime.fromISO(hourlyForecasts.modelRunDate).setZone(MetUk.timezone),
			wind: {
				speed: 0,
				degree: 0,
			},
			humidity: 0,
			pressure: 0,
			dewPoint: 0,
			forecasts: [],
			hourlyForecasts: this.GetHourlyForecasts(hourlyForecasts),
			sunrise: null,
			sunset: null,
			location: {
				timeZone: MetUk.timezone,
			},
			temperature: 0,
			uvIndex: null,
			alerts: [],
			stationInfo: {
				distanceFrom: hourlyForecasts.requestPointDistance
			}
		};
	}

	private GetHourlyForecasts(payload: MetUkHourlyProperties): HourlyForecastData[] {
		const result: HourlyForecastData[] = [];
		for (const item of payload.timeSeries) {
			result.push({
				date: DateTime.fromISO(item.time).setZone(MetUk.timezone),
				temp: CelsiusToKelvin(item.screenTemperature),
				condition: this.ResolveCondition(item.significantWeatherCode),
				precipitation: item.probOfPrecipitation < 10 ? undefined : {
					type: item.totalPrecipAmount > item.totalSnowAmount ? "rain" : "snow",
					chance: item.probOfPrecipitation,
					volume: item.precipitationRate,
				},
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