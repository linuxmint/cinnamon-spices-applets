import { Services, type Config } from "../../config";
import { ErrorHandler } from "../../lib/services/error_handler";
import type { ErrorResponse, HTTPParams } from "../../lib/httpLib";
import { HttpLib } from "../../lib/httpLib";
import { ProviderErrorCode, type LocationData, type WeatherProvider } from "../../types";
import { _ } from "../../utils";
import type { WeatherData } from "../../weather-data";
import { NormalizeQWeatherApiHost, QWeatherAlertPath, QWeatherLanguage, QWeatherLocation } from "./config";
import { QWeatherResponseToData } from "./parser";
import type { QWeatherAlertResponse } from "./payload/alert";
import type { QWeatherCurrentResponse } from "./payload/current";
import type { QWeatherDailyResponse } from "./payload/daily";
import type { QWeatherHourlyResponse } from "./payload/hourly";
import type { QWeatherMinutelyResponse } from "./payload/minutely";

export interface QWeatherOptions {
	apiHost: string;
	apiKey: string;
}

export class QWeather implements WeatherProvider<Services.QWeather, QWeatherOptions> {
	public readonly prettyName = _("QWeather");
	public readonly name = Services.QWeather;
	public readonly maxForecastSupport = 7;
	public readonly maxHourlyForecastSupport = 24;
	public readonly website = "https://www.qweather.com/";
	public readonly needsApiKey = true;
	public readonly supportHourlyPrecipChance = true;
	public readonly supportHourlyPrecipVolume = true;
	public readonly locationType = "coordinates";
	public readonly remainingCalls: number | null = null;

	private badKeyReported = false;

	public async GetWeather(loc: LocationData, cancellable: imports.gi.Gio.Cancellable, config: Config, options: QWeatherOptions): Promise<WeatherData | null> {
		const host = NormalizeQWeatherApiHost(options.apiHost);
		if (host == null)
			return null;

		this.badKeyReported = false;
		const baseUrl = `https://${host}`;
		const params = this.Params(loc, config);
		const currentPromise = this.Load<QWeatherCurrentResponse>(`${baseUrl}/v7/weather/now`, params, cancellable, options, false);
		const hourlyPromise = this.Load<QWeatherHourlyResponse>(`${baseUrl}/v7/weather/24h`, params, cancellable, options, true);
		const dailyPromise = this.Load<QWeatherDailyResponse>(`${baseUrl}/v7/weather/7d`, params, cancellable, options, true);
		const minutelyPromise = config._immediatePrecip
			? this.Load<QWeatherMinutelyResponse>(`${baseUrl}/v7/minutely/5m`, params, cancellable, options, true)
			: Promise.resolve(null);
		const alertsPromise = config._showAlerts
			? this.Load<QWeatherAlertResponse>(`${baseUrl}${QWeatherAlertPath(loc)}`, {
				localTime: true,
				lang: QWeatherLanguage(config.currentLocale, config._translateCondition),
			}, cancellable, options, true)
			: Promise.resolve(null);

		const [current, hourly, daily, minutely, alerts] = await Promise.all([
			currentPromise,
			hourlyPromise,
			dailyPromise,
			minutelyPromise,
			alertsPromise,
		]);

		if (!this.IsUsable(current, false))
			return null;

		return QWeatherResponseToData({
			current,
			daily: this.IsUsable(daily, true) ? daily : null,
			hourly: this.IsUsable(hourly, true) ? hourly : null,
			minutely: this.IsUsable(minutely, true) ? minutely : null,
			alerts: this.IsUsable(alerts, true) ? alerts : null,
		}, loc, _);
	}

	public ValidConfiguration(config: Config, options: QWeatherOptions): ProviderErrorCode {
		if (options.apiKey.trim() === "" || NormalizeQWeatherApiHost(options.apiHost) == null)
			return ProviderErrorCode.NO_KEY;

		return ProviderErrorCode.OK;
	}

	private Params(loc: LocationData, config: Config): HTTPParams {
		return {
			location: QWeatherLocation(loc),
			lang: QWeatherLanguage(config.currentLocale, config._translateCondition),
			unit: "m",
		};
	}

	private async Load<T extends object>(url: string, params: HTTPParams, cancellable: imports.gi.Gio.Cancellable, options: QWeatherOptions, optional: boolean): Promise<T | null> {
		const response = await HttpLib.Instance.LoadJsonSimple<T>({
			url,
			params,
			cancellable,
			headers: { "X-QW-Api-Key": options.apiKey },
			HandleError: error => this.HandleHttpError(error, optional),
		});

		return response != null ? response : null;
	}

	private IsUsable<T extends object>(response: T | null, optional: boolean): response is T {
		const code = response != null && "code" in response ? response.code : undefined;
		if (code === "401" || code === "403") {
			this.PostBadKey();
			return false;
		}
		if (code === "429" && !optional) {
			ErrorHandler.Instance.PostError({
				type: "hard",
				detail: "bad status code",
				code: 429,
				service: "qweather",
				message: _("Service Error"),
			});
			return false;
		}
		if (code != null && code !== "200")
			return false;

		return response != null;
	}

	private HandleHttpError(error: ErrorResponse, optional: boolean): boolean {
		if (error.ErrorData.code === 401 || error.ErrorData.code === 403) {
			this.PostBadKey();
			return false;
		}

		return !optional;
	}

	private PostBadKey(): void {
		if (this.badKeyReported)
			return;

		this.badKeyReported = true;
		ErrorHandler.Instance.PostError({
			type: "hard",
			userError: true,
			detail: "bad key",
			service: "qweather",
			message: _("Please make sure you entered the QWeather API key correctly"),
		});
	}
}
