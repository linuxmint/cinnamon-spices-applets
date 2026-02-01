import { DateTime } from "luxon";
import { Services } from "../../config";
import { HttpLib, type ErrorResponse } from "../../lib/httpLib";
import { ErrorHandler } from "../../lib/services/error_handler";
import { ProviderErrorCode, type LocationData, type LocationType, type WeatherProvider } from "../../types";
import { _, CelsiusToKelvin, KPHtoMPS } from "../../utils";
import type { HourlyForecastData, WeatherData } from "../../weather-data";
import { SwissMeteoIconToCondition, type SwissMeteoPayload } from "./payload/common";
import { SwissMeteoDayToForecastData } from "./payload/days";
import { SwissMeteoWarningToAlertData } from "./payload/alerts";

export class SwissMeteo implements WeatherProvider<Services.SwissMeteo> {
	public readonly needsApiKey: boolean = false;
	public readonly prettyName: string = _("Swiss Météo");
	public readonly name = Services.SwissMeteo;
	public readonly maxForecastSupport: number = 8;
	public readonly maxHourlyForecastSupport: number = 192;
	public readonly website: string = "https://www.meteoswiss.admin.ch/#tab=forecast-map";
	public readonly remainingCalls: number | null = null;
	public readonly supportHourlyPrecipChance: boolean = false;
	public readonly supportHourlyPrecipVolume: boolean = true;
	public readonly locationType: LocationType = "postcode";

	private readonly baseUrl = "https://app-prod-ws.meteoswiss-app.ch/v2/plzDetail";
	private readonly timezone = "Europe/Zurich";

	private readonly VALID_MIN_PLZ = 1000;
	private readonly VALID_MAX_PLZ = 9999;


	public async GetWeather(loc: LocationData, cancellable: imports.gi.Gio.Cancellable): Promise<WeatherData | null> {
		if (!this.ValidPostcode(loc.entryText)) {
			ErrorHandler.Instance.PostError({
				type: "hard",
				detail: "bad location format",
				message: _("For this provider, you need to use a Swiss postcode, from 1000-9999.")
			});

			return null;
		}

		const result = await HttpLib.Instance.LoadJsonSimple<SwissMeteoPayload>({
			url: this.baseUrl,
			cancellable,
			params: { plz: `${loc.entryText}00` },
			HandleError: this.HandleError
		});

		if (!result) {
			return null;
		}

		const weather: WeatherData = {
			date: DateTime.fromMillis(result.currentWeather.time),
			coord: {
				lat: -1,
				lon: -1,
			},
			location: {
				timeZone: this.timezone,
				city: loc.entryText,
				country: _("Switzerland"),
			},
			condition: SwissMeteoIconToCondition(result.currentWeather.iconV2),
			temperature: CelsiusToKelvin(result.currentWeather.temperature),
			dewPoint: null,
			humidity: null,
			pressure: null,
			sunrise: DateTime.fromMillis(result.graph.sunrise[0]),
			sunset: DateTime.fromMillis(result.graph.sunset[0]),
			wind: {
				speed: KPHtoMPS(result.graph.windSpeed3h[0]),
				degree: result.graph.windDirection3h[0],
			},
			forecasts: result.forecast.map(day => SwissMeteoDayToForecastData(day)),
			uvIndex: null
		};

		const alerts = result.warnings.filter(x => {
			if (x.validTo && DateTime.fromMillis(x.validTo) < DateTime.now()) {
				return false;
			}

			if (x.validFrom && DateTime.fromMillis(x.validFrom) > DateTime.now()) {
				return false;
			}

			return true;
		});

		weather.alerts = alerts.map(warning => SwissMeteoWarningToAlertData(warning));



		const hourlyForecasts: HourlyForecastData[] = [];
		const startTime = DateTime.fromMillis(result.graph.start);
		const now = DateTime.now();
		for (let i = 0; i < result.graph.temperatureMean1h.length; i++) {
			const currentItemTime = startTime.plus({ hours: i });
			const nextItemTime = startTime.plus({ hours: i + 1 });
			// We are in the past, skip
			if (currentItemTime < now && nextItemTime < now) {
				continue;
			}

			const hourTemp = result.graph.temperatureMean1h[i];
			const hourPrecip = result.graph.precipitationMax1h[i];
			const hourCondition = SwissMeteoIconToCondition(result.graph.weatherIcon3hV2[Math.floor(i / 3)]);
			hourlyForecasts.push({
				date: currentItemTime,
				condition: hourCondition,
				temp: CelsiusToKelvin(hourTemp),
				precipitation: hourPrecip == 0 ? undefined : {
					type: "none",
					volume: hourPrecip,
				},
			});
		}

		weather.hourlyForecasts = hourlyForecasts;
		return weather;
	}

	public ValidConfiguration(): ProviderErrorCode {
		return ProviderErrorCode.OK;
	}

	private HandleError = (error: ErrorResponse<unknown>): boolean => {
		if (error.ErrorData.code == 500) {
			if (error.Data != null && typeof error.Data === "object" && "statusCode" in error.Data && "msg" in error.Data) {
				ErrorHandler.Instance.PostError({
					type: "hard",
					detail: "bad location format",
					message: _("For this provider, you need to use a postcode.")
				})
			}
		}

		return true;
	}

	private ValidPostcode(postcode: string): boolean {
		const postcodeNum = Number.parseInt(postcode);
		if (Number.isNaN(postcodeNum)) {
			return false;
		}

		return postcodeNum >= this.VALID_MIN_PLZ && postcodeNum <= this.VALID_MAX_PLZ;
	}
}