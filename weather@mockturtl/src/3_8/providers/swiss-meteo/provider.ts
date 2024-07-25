import type { Services } from "../../config";
import { HttpLib } from "../../lib/httpLib";
import type { LocationData, LocationType } from "../../types";
import { _ } from "../../utils";
import type { WeatherData } from "../../weather-data";
import { BaseProvider } from "../BaseProvider";
import type { SwissMeteoPayload } from "./payload/common";

export class SwissMeteo extends BaseProvider {
	public override needsApiKey: boolean = false;
	public override prettyName: string = _("Swiss Météo");
	public override name: Services = "Swiss Meteo";
	public override maxForecastSupport: number = 0;
	public override maxHourlyForecastSupport: number = 0;
	public override website: string = "https://www.meteoswiss.admin.ch/#tab=forecast-map";
	public override remainingCalls: number | null = null;
	public override supportHourlyPrecipChance: boolean = true;
	public override supportHourlyPrecipVolume: boolean = true;
	public override locationType: LocationType = "postcode";

	private readonly baseUrl = "https://app-prod-ws.meteoswiss-app.ch/v2/plzDetail";


	public override async GetWeather(loc: LocationData, cancellable: imports.gi.Gio.Cancellable): Promise<WeatherData | null> {
		const result = await HttpLib.Instance.LoadJsonSimple<SwissMeteoPayload>({ url: this.baseUrl, cancellable, params: { plz: `${loc.entryText}00` } });

		if (!result) {
			return null;
		}

		throw new Error("Method not implemented.");
	}

}