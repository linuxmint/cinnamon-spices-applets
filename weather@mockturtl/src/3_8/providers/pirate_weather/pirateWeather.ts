import { ErrorResponse, HttpError } from "../../lib/httpLib";
import { Logger } from "../../lib/logger";
import { WeatherApplet } from "../../main";
import { WeatherProvider, WeatherData, ForecastData, HourlyForecastData, PrecipitationType, BuiltinIcons, CustomIcons, LocationData, SunTime, ImmediatePrecipitation } from "../../types";
import { _, IsLangSupported, IsNight, FahrenheitToKelvin, CelsiusToKelvin, MPHtoMPS } from "../../utils";
import { DateTime } from "luxon";
import { BaseProvider } from "../BaseProvider";
import { PirateWeatherIcon, PirateWeatherPayload, PirateWeatherQueryUnits } from "./types/common";

export class PirateWeather extends BaseProvider {

	//--------------------------------------------------------
	//  Properties
	//--------------------------------------------------------
	public readonly prettyName = _("Pirate Weather");
	public readonly name = "PirateWeather";
	public readonly maxForecastSupport = 7;
	public readonly website = "http://pirateweather.net/en/latest/";
	public readonly maxHourlyForecastSupport = 168;
	public readonly needsApiKey = true;
	public readonly supportHourlyPrecipChance = true;
	public readonly supportHourlyPrecipVolume = true;

	private remainingQuota: number | null = null;
	public get remainingCalls(): number | null {
		// Disable this for now, this feature is only really useful for AccuWeather
		// TODO: when a better place is found for this value add this back
		return null;
		//return this.remainingQuota;
	};

	private query = "https://api.pirateweather.net/forecast/";
	private unit: PirateWeatherQueryUnits = "si";

	constructor(_app: WeatherApplet) {
		super(_app);
	}

	//--------------------------------------------------------
	//  Functions
	//--------------------------------------------------------
	public async GetWeather(loc: LocationData): Promise<WeatherData | null> {
		const unit = this.GetQueryUnit();

		const response = await this.app.LoadJsonAsyncWithDetails<PirateWeatherPayload>(
			`${this.query}${this.app.config.ApiKey}/${loc.lat},${loc.lon}`,
			{
				units: this.GetQueryUnit()
			},
			this.HandleError
		);

		if (!response.Success)
			return null;

		// this.remainingQuota = Math.max(1000 - parseInt(response.ResponseHeaders["X-Forecast-API-Calls"]), 0);
		return this.ParseWeather(response.Data, unit);
	};


	private ParseWeather(json: PirateWeatherPayload, unit: PirateWeatherQueryUnits): WeatherData | null {
		try {
			const sunrise = DateTime.fromSeconds(json.daily.data[0].sunriseTime, { zone: json.timezone });
			const sunset = DateTime.fromSeconds(json.daily.data[0].sunsetTime, { zone: json.timezone });
			const result: WeatherData = {
				date: DateTime.fromSeconds(json.currently.time, { zone: json.timezone }),
				coord: {
					lat: json.latitude,
					lon: json.longitude
				},
				location: {
					url: "https://merrysky.net/forecast/" + json.latitude + "," + json.longitude,
					timeZone: json.timezone,
				},
				sunrise: sunrise,
				sunset: sunset,
				wind: {
					speed: this.ToMPS(json.currently.windSpeed, unit),
					degree: json.currently.windBearing
				},
				temperature: this.ToKelvin(json.currently.temperature, unit),
				pressure: json.currently.pressure,
				humidity: json.currently.humidity * 100,
				dewPoint: this.ToKelvin(json.currently.dewPoint, unit),
				condition: {
					main: json.currently.summary,
					description: json.currently.summary,
					icons: this.ResolveIcon(json.currently.icon, { sunrise: sunrise, sunset: sunset }),
					customIcon: this.ResolveCustomIcon(json.currently.icon)
				},
				extra_field: {
					name: _("Feels Like"),
					value: this.ToKelvin(json.currently.apparentTemperature, unit),
					type: "temperature"
				},
				forecasts: [],
				hourlyForecasts: [],
			}

			// Forecast
			for (const day of json.daily.data) {
				const forecast: ForecastData = {
					date: DateTime.fromSeconds(day.time, { zone: json.timezone }),
					temp_min: this.ToKelvin(day.temperatureLow, unit),
					temp_max: this.ToKelvin(day.temperatureHigh, unit),
					condition: {
						main: day.summary,
						description: day.summary,
						icons: this.ResolveIcon(day.icon),
						customIcon: this.ResolveCustomIcon(day.icon)
					},
				};

				// JS assumes time is local, so it applies the correct offset creating the Date (including Daylight Saving)
				// but when using the date when daylight saving is active, it DOES NOT apply the DST back,
				// So we offset the date to make it Noon
				forecast.date = forecast.date.set({ hour: 12 });

				result.forecasts.push(forecast);
			}

			for (const hour of json.hourly.data) {
				const forecast: HourlyForecastData = {
					date: DateTime.fromSeconds(hour.time, { zone: json.timezone }),
					temp: this.ToKelvin(hour.temperature, unit),
					condition: {
						main: hour.summary,
						description: hour.summary,
						icons: this.ResolveIcon(hour.icon, { sunrise: sunrise, sunset: sunset }, DateTime.fromSeconds(hour.time, { zone: json.timezone })),
						customIcon: this.ResolveCustomIcon(hour.icon)
					},
					precipitation: {
						type: hour.precipType as PrecipitationType,
						volume: hour.precipProbability,
						chance: hour.precipProbability * 100
					}
				};

				// never null here
				result.hourlyForecasts!.push(forecast);
			}

			if (json.minutely != null) {
				const immediate: ImmediatePrecipitation = {
					start: -1,
					end: -1
				}

				for (const [index, element] of json.minutely.data.entries()) {
					if (element.precipProbability > 0 && immediate.start == -1) {
						immediate.start = index;
						continue
					}
					else if (element.precipProbability == 0 && immediate.start != -1) {
						immediate.end = index;
						break
					}
				}

				result.immediatePrecipitation = immediate;
			}

			return result;
		}
		catch (e) {
			if (e instanceof Error)
				Logger.Error("Pirate Weather payload parsing error: " + e, e)
			this.app.ShowError({ type: "soft", detail: "unusual payload", service: "pirate_weather", message: _("Failed to Process Weather Info") });
			return null;
		}
	};

	/**
	 *
	 * @param message Soup Message object
	 * @returns null if custom error checking does not find anything
	 */
	private HandleError = (message: ErrorResponse): boolean => {
		if (message.ErrorData.code == 403) {
			this.app.ShowError({
				type: "hard",
				userError: true,
				detail: "bad key",
				service: "pirate_weather",
				message: _("Please Make sure you\nentered the API key correctly and your account is not locked")
			});
			return false;
		}
		else if (message.ErrorData.code == 401) {
			this.app.ShowError({
				type: "hard",
				userError: true,
				detail: "no key",
				service: "pirate_weather",
				message: _("Please Make sure you\nentered the API key that you have from DarkSky")
			});
			return false;
		}
		return true;
	}

	private ResolveIcon(icon: PirateWeatherIcon, sunTimes?: SunTime, date?: DateTime): BuiltinIcons[] {
		switch (icon) {
			case "rain":
				return ["weather-rain", "weather-showers-scattered", "weather-freezing-rain"]
			case "snow":
				return ["weather-snow"]
			case "sleet":
				return ["weather-freezing-rain", "weather-rain", "weather-showers-scattered"]
			case "fog":
				return ["weather-fog"]
			// There is no guarantee that there is a wind icon
			case "wind":
				return (sunTimes && IsNight(sunTimes, date)) ? ["weather-windy", "weather-breeze", "weather-clouds", "weather-few-clouds-night"] : ["weather-windy", "weather-breeze", "weather-clouds", "weather-few-clouds"]
			case "cloudy":/* mostly cloudy (day) */
				return (sunTimes && IsNight(sunTimes, date)) ? ["weather-overcast", "weather-clouds", "weather-few-clouds-night"] : ["weather-overcast", "weather-clouds", "weather-few-clouds"]
			case "partly-cloudy-night":
				return ["weather-few-clouds-night"]
			case "partly-cloudy-day":
				return ["weather-few-clouds"]
			case "clear-night":
				return ["weather-clear-night"]
			case "clear-day":
				return ["weather-clear"]
			default:
				return ["weather-severe-alert"]
		}
	};

	private ResolveCustomIcon(icon: PirateWeatherIcon): CustomIcons {
		switch (icon) {
			case "rain":
				return "rain-symbolic";
			case "snow":
				return "snow-symbolic";
			case "fog":
				return "fog-symbolic";
			case "cloudy":
				return "cloudy-symbolic";
			case "partly-cloudy-night":
				return "night-alt-cloudy-symbolic";
			case "partly-cloudy-day":
				return "day-cloudy-symbolic";
			case "clear-night":
				return "night-clear-symbolic";
			case "clear-day":
				return "day-sunny-symbolic";
			// There is no guarantee that there is a wind icon
			case "wind":
				return "strong-wind-symbolic";
			default:
				return "cloud-refresh-symbolic";
		}
	}

	private GetQueryUnit(): PirateWeatherQueryUnits {
		if (this.app.config.TemperatureUnit == "celsius") {
			if (this.app.config.WindSpeedUnit == "kph" || this.app.config.WindSpeedUnit == "m/s") {
				return 'si';
			}
			else {
				return 'uk2';
			}
		}
		else {
			return 'us';
		}
	};

	private ToKelvin(temp: number, unit: PirateWeatherQueryUnits): number {
		if (unit == 'us') {
			return FahrenheitToKelvin(temp);
		}
		else {
			return CelsiusToKelvin(temp);
		}

	};

	private ToMPS(speed: number, unit: PirateWeatherQueryUnits): number {
		if (unit == 'si') {
			return speed;
		}
		else {
			return MPHtoMPS(speed);
		}
	};
};



