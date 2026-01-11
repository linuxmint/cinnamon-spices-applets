import { DateTime } from "luxon";
import type { Config } from "../../config";
import { Services } from "../../config";
import { HttpLib } from "../../lib/httpLib";
import type { LocationData } from "../../types";
import { _ } from "../../utils";
import type { HourlyForecastData, WeatherData } from "../../weather-data";
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

		const hourlyForecasts = res.Data.features[0];
		if (!hourlyForecasts) {
			Logger.Error(`MetUK: No hourly forecast data found for location ${newLocation.lat}, ${newLocation.lon}`);
			return null;
		}

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
			date: DateTime.fromISO(hourlyForecasts.properties.modelRunDate).setZone(MetUk.timezone),
			wind: {
				speed: 0,
				degree: 0,
			},
			humidity: 0,
			pressure: 0,
			dewPoint: 0,
			forecasts: [],
			hourlyForecasts: this.GetHourlyForecasts(hourlyForecasts.properties),
			sunrise: null,
			sunset: null,
			location: {
				timeZone: MetUk.timezone,
			},
			temperature: 0,
			uvIndex: null,
			alerts: [],
		};
	}

	private GetHourlyForecasts(payload: MetUkHourlyProperties): HourlyForecastData[] {
		return [];
	}
}