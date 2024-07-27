import { DateTime } from "luxon";
import type { Services } from "../../config";
import { HttpLib, type ErrorResponse } from "../../lib/httpLib";
import { ErrorHandler } from "../../lib/services/error_handler";
import type { LocationData, LocationType } from "../../types";
import { _, CelsiusToKelvin, KPHtoMPS } from "../../utils";
import type { WeatherData } from "../../weather-data";
import { BaseProvider } from "../BaseProvider";
import { SwissMeteoIconToCondition, type SwissMeteoPayload } from "./payload/common";
import { SwissMeteoDayToForecastData } from "./payload/days";

export class SwissMeteo extends BaseProvider {
	public override needsApiKey: boolean = false;
	public override prettyName: string = _("Swiss Météo");
	public override name: Services = "Swiss Meteo";
	public override maxForecastSupport: number = 8;
	public override maxHourlyForecastSupport: number = 192;
	public override website: string = "https://www.meteoswiss.admin.ch/#tab=forecast-map";
	public override remainingCalls: number | null = null;
	public override supportHourlyPrecipChance: boolean = true;
	public override supportHourlyPrecipVolume: boolean = true;
	public override locationType: LocationType = "postcode";

	private readonly baseUrl = "https://app-prod-ws.meteoswiss-app.ch/v2/plzDetail";
	private readonly timezone = "Europe/Zurich";

	private readonly VALID_MIN_PLZ = 1000;
	private readonly VALID_MAX_PLZ = 9999;


	public override async GetWeather(loc: LocationData, cancellable: imports.gi.Gio.Cancellable): Promise<WeatherData | null> {
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

		return {
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
			forecasts: result.forecast.map(day => SwissMeteoDayToForecastData(day))
		};
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