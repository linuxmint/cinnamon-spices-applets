import { HttpLib } from "../../lib/httpLib";
import type { LocationData } from "../../types";
import { _ } from "../../utils";
import type { WeatherData } from "../../weather-data";
import { BaseProvider } from "../BaseProvider";
import type { OpenMeteoWeatherResponse } from "./payload/response";
import { OpenMeteoResponseToData } from "./payload/response";

export class OpenMeteo extends BaseProvider {

	public readonly prettyName = _("Open Meteo");
	public readonly name = "OpenMeteo";
	public readonly maxForecastSupport = 16;
	public readonly website = "https://open-meteo.com/";
	public readonly maxHourlyForecastSupport = 24;
	public readonly needsApiKey = false;
	public readonly supportHourlyPrecipChance = true;
	public readonly supportHourlyPrecipVolume = true;

	public get remainingCalls(): number | null {
		return null;
	};

	private query = "https://api.open-meteo.com/v1/forecast";

	public async GetWeather(loc: LocationData, cancellable: imports.gi.Gio.Cancellable): Promise<WeatherData | null> {
		const result = await HttpLib.Instance.LoadJsonSimple<OpenMeteoWeatherResponse>({
			url: this.query,
			cancellable: cancellable,
			noEncode: true,
			params: {
				latitude: loc.lat,
				longitude: loc.lon,
				current: "temperature_2m,dewpoint_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,rain,showers,snowfall,weather_code,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m",
				hourly: "temperature_2m,precipitation_probability,precipitation,rain,showers,snowfall,snow_depth,weather_code,wind_speed_10m,wind_direction_10m,is_day",
				daily: "weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,sunrise,sunset",
				timezone: "auto",
				forecast_days: "16",
				forecast_hours: "24"
			}
		});

		if (!result)
			return null;

		return OpenMeteoResponseToData(result);
	}
}