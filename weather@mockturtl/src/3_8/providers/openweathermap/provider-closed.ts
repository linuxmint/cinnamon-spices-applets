//////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////
///////////                                       ////////////
///////////         OpenWeatherMap Premium        ////////////
///////////                                       ////////////
//////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////

import { DateTime } from "luxon";
import { ErrorResponse, HttpError, HttpLib, HTTPParams } from "../../lib/httpLib";
import { Logger } from "../../lib/logger";
import { WeatherApplet } from "../../main";
import { WeatherProvider, WeatherData, ForecastData, HourlyForecastData, AppletError, BuiltinIcons, CustomIcons, LocationData, ImmediatePrecipitation, AlertData } from "../../types";
import { _, IsLangSupported } from "../../utils";
import { BaseProvider } from "../BaseProvider";
import { ConvertLocaleToOWMLang, OpenWeatherMapError, OWM_SUPPORTED_LANGS, OWMWeatherCondition } from "./payload/common";
import { OWMIconToBuiltInIcons, OWMIconToCustomIcon } from "./payload/condition";
import { Config, Services } from "../../config";
import { OWMOneCallPayload, OWMOneCallToWeatherData } from "./payload/onecall";
import { OWMWeatherResponse } from "./payload/weather";

/** Stores IDs for "lat,long" string, to be able to construct URLs for OpenWeatherMap Website */
const IDCache: Record<string, number> = {};

export class OpenWeatherMapOneCall extends BaseProvider {
	//--------------------------------------------------------
	//  Properties
	//--------------------------------------------------------
	public readonly prettyName = _("OpenWeatherMap");
	public readonly name: Services = "OpenWeatherMap_OneCall";
	public readonly maxForecastSupport = 8;
	public readonly website = "https://openweathermap.org/";
	public readonly maxHourlyForecastSupport = 48;
	public readonly needsApiKey = true;
	public readonly remainingCalls: number | null = null;
	public readonly supportHourlyPrecipChance = true;
	public readonly supportHourlyPrecipVolume = true;

	private base_url = "https://api.openweathermap.org/data/3.0/onecall" //lat=51.5085&lon=-0.1257&appid={YOUR API KEY}"
	private id_irl  = "https://api.openweathermap.org/data/2.5/weather";

	constructor(_app: WeatherApplet) {
		super(_app);
	}

	//--------------------------------------------------------
	//  Functions
	//--------------------------------------------------------

	public async GetWeather(loc: LocationData, cancellable: imports.gi.Gio.Cancellable, config: Config): Promise<WeatherData | null> {
		const params = this.ConstructParams(loc, config.ApiKey);

		const cachedID = IDCache[`${loc.lat},${loc.lon}`];

		// Await both of them, if already have it idPayload will be null
		// If we don't have the ID we push a call to get it
		const [ json, idPayload ] = await Promise.all([
			HttpLib.Instance.LoadJsonSimple<OWMOneCallPayload>({
				url: this.base_url,
				cancellable,
				params: params,
				HandleError: this.HandleError
			}),
			(cachedID == null) ? HttpLib.Instance.LoadJsonSimple<OWMWeatherResponse>({url: this.id_irl, cancellable, params}) : Promise.resolve()
		]);

		// We store the newly gotten ID if we got it
		if (cachedID == null && idPayload?.id != null)
			IDCache[`${loc.lat},${loc.lon}`] = idPayload.id;

		if (!json)
			return null;

		if (this.HadErrors(json))
			return null;

		// Put id to the parsable object, even if it ends up undefined
		json.id = cachedID ?? idPayload?.id;
		return OWMOneCallToWeatherData(json);
	};

	private ConstructParams(loc: LocationData, key: string): HTTPParams {
		const params: HTTPParams = {
			lat: loc.lat,
			lon: loc.lon,
			appid: key
		};

		// Append Language if supported and enabled
		const locale: string = ConvertLocaleToOWMLang(this.app.config.currentLocale);
		if (this.app.config._translateCondition && IsLangSupported(locale, OWM_SUPPORTED_LANGS)) {
			params.lang = locale;
		}
		return params;
	};

	private HadErrors(json: any): boolean {
		if (!this.HasReturnedError(json)) return false;
		const errorMsg = "OpenWeatherMap Response: ";
		const error = {
			service: "openweathermap",
			type: "hard",
		} as AppletError;
		const errorPayload: OpenWeatherMapError = json;
		switch (errorPayload.cod) {
			case ("400"):
				error.detail = "bad location format";
				error.message = _("Please make sure Location is in the correct format in the Settings");
				break;
			case ("401"):
				error.detail = "bad key";
				error.message = _("Make sure you entered the correct key in settings");
				break;
			case ("404"):
				error.detail = "location not found";
				error.message = _("Location not found, make sure location is available or it is in the correct format");
				break;
			case ("429"):
				error.detail = "key blocked";
				error.message = _("If this problem persists, please contact the Author of this applet");
				break;
			default:
				error.detail = "unknown";
				error.message = _("Unknown Error, please see the logs in Looking Glass");
				break;
		};
		this.app.ShowError(error);
		Logger.Debug("OpenWeatherMap Error Code: " + errorPayload.cod)
		Logger.Error(errorMsg + errorPayload.message);
		return true;
	};

	private HasReturnedError(json: any) {
		return (!!json?.cod);
	}

	public HandleError = (error: ErrorResponse): boolean => {
		if (error.ErrorData.code == 404) {
			this.app.ShowError({
				detail: "location not found",
				message: _("Location not found, make sure location is available or it is in the correct format"),
				userError: true,
				type: "hard"
			})
			return false;
		}
		return true;
	}
};

