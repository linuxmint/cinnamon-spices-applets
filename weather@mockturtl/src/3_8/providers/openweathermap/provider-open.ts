import { Services, Config } from "../../config";
import { HTTPParams, HttpLib } from "../../lib/httpLib";
import { LocationData, WeatherData } from "../../types";
import { IsLangSupported, _ } from "../../utils";
import { BaseProvider } from "../BaseProvider";
import { ConvertLocaleToOWMLang, OWM_SUPPORTED_LANGS } from "./payload/common";
import { OWMDailyForecastResponse, OWMDailyForecastsToData } from "./payload/forecast_daily";
import { OWMWeatherResponse, OWMWeatherToWeatherData } from "./payload/weather";

export class OpenWeatherMapOpen extends BaseProvider {
	public override needsApiKey = false;
	public override prettyName = _("OpenWeatherMap");
	public override name: Services = "OpenWeatherMap";
	public override maxForecastSupport = 7;
	public override maxHourlyForecastSupport = 0;
	public override website = "https://openweathermap.org/";
	public override remainingCalls = null;
	public override supportHourlyPrecipChance = false;
	public override supportHourlyPrecipVolume = false;


	public override async GetWeather(loc: LocationData, cancellable: imports.gi.Gio.Cancellable, config: Config): Promise<WeatherData | null> {
		const current = await HttpLib.Instance.LoadJsonSimple<OWMWeatherResponse>({
			url: "https://api.openweathermap.org/data/2.5/weather",
			cancellable,
			params: this.ConstructParams(loc)
		});
		const daily = await HttpLib.Instance.LoadJsonSimple<OWMDailyForecastResponse>({
			url: "https://api.openweathermap.org/data/2.5/forecast/daily",
			cancellable,
			params: this.ConstructParams(loc)
		});

		if (!current || !daily) {
			return null;
		}

		return {
			...OWMWeatherToWeatherData(current, config.Timezone),
			forecasts: OWMDailyForecastsToData(daily.list, config.Timezone)
		};
	}

	private ConstructParams(loc: LocationData): HTTPParams {
		const params: HTTPParams = {
			lat: loc.lat,
			lon: loc.lon,
			appid: "1c73f8259a86c6fd43c7163b543c8640"
		};

		// Append Language if supported and enabled
		const locale: string = ConvertLocaleToOWMLang(this.app.config.currentLocale);
		if (this.app.config._translateCondition && IsLangSupported(locale, OWM_SUPPORTED_LANGS)) {
			params.lang = locale;
		}
		return params;
	};
}

