import { Services } from "./config";
import { HttpError, HTTPParams } from "./httpLib";
import { WeatherApplet } from "./main";
import { Condition, ForecastData, HourlyForecastData, LocationData, PrecipitationType, WeatherData, WeatherProvider } from "./types";
import { CelsiusToKelvin, _ } from "./utils";


export class ClimacellV4 implements WeatherProvider {
	needsApiKey: boolean = true;
	prettyName: string = "Climacell";
	name: Services = "ClimacellV4";
	maxForecastSupport: number = 15;
	maxHourlyForecastSupport: number = 108;
	website: string = "https://www.climacell.co/";

	private app: WeatherApplet;

	private url = "https://data.climacell.co/v4/timelines";

	private params: HTTPParams = {
		apikey: null,
		location: null,
		timesteps: "current,1h,1d",
		units: "metric",
		fields: "temperature,temperatureMax,temperatureMin,pressureSurfaceLevel,weatherCode,sunsetTime,sunriseTime,precipitationType,precipitationProbability,precipitationIntensity,windDirection,windSpeed,humidity,temperatureApparent"
	}

	constructor(app: WeatherApplet) {
		this.app = app;
	}

	public async GetWeather(loc: LocationData): Promise<WeatherData> {
		if (loc == null)
			return null;

		this.params.apikey = this.app.config.ApiKey;
		this.params.location = loc.lat + "," + loc.lon;

		let response = await this.app.LoadJsonAsync<ClimacellV4Payload>(this.url, this.params, (m) => this.HandleHTTPError(m));

		if (response == null)
			return null;

		return this.ParseWeather(loc, response);
	}

	private HandleHTTPError(message: HttpError): boolean {
		if (message.code == 401) {
			this.app.ShowError({
				type: "hard",
				userError: true,
				detail: "no key",
				service: "climacell",
				message: _("Please Make sure you\nentered the API key what you have from Climacell")
			});
			return false;
		}
		return true;
	}

	private ParseWeather(loc: LocationData, data: ClimacellV4Payload): WeatherData {
		let current = data.data.timelines.find(x => x.timestep == "current")?.intervals?.[0];
		let hourly = data.data.timelines.find(x => x.timestep == "1h").intervals;
		let daily = data.data.timelines.find(x => x.timestep == "1d").intervals;

		let result: WeatherData = {
			coord: {
				lat: loc.lat,
				lon: loc.lon
			},
			date: new Date(current.startTime),
			condition: this.ResolveCondition(current.values.weatherCode),
			humidity: current.values.humidity,
			pressure: current.values.pressureSurfaceLevel,
			temperature: CelsiusToKelvin(current.values.temperature),
			wind: {
				degree: current.values.windDirection,
				speed: current.values.windSpeed
			},
			sunrise: new Date(daily?.[0].values.sunriseTime),
			sunset: new Date(daily?.[0].values.sunsetTime),
			location: {
				url: "https://www.climacell.co/weather"
			},
			extra_field: {
				name: _("Feels Like"),
				type: "temperature",
				value: CelsiusToKelvin(current.values.temperatureApparent)
			},
			forecasts: []
		}

		let hours: HourlyForecastData[] = [];
		let days: ForecastData[] = [];

		for (let index = 0; index < daily.length; index++) {
			const element = daily[index];
			days.push({
				condition: this.ResolveCondition(element.values.weatherCode),
				date: new Date(element.startTime),
				temp_max: CelsiusToKelvin(element.values.temperatureMax),
				temp_min: CelsiusToKelvin(element.values.temperatureMin)
			});
		}

		for (let index = 0; index < hourly.length; index++) {
			const element = hourly[index];
			let hour: HourlyForecastData = {
				condition: this.ResolveCondition(element.values.weatherCode),
				date: new Date(element.startTime),
				temp: CelsiusToKelvin(element.values.temperature)
			};

			// bit sneaky, but setting the hourly forecast startTime to beginning of the hour
			// so it is displayed properly
			hour.date.setMinutes(0, 0, 0);

			if (element.values.precipitationProbability > 0 && element.values.precipitationIntensity > 0) {
				hour.precipitation = {
					chance: element.values.precipitationProbability,
					volume: element.values.precipitationIntensity,
					type: this.PrecipTypeToAppletType(element.values.precipitationType)
				}
			}
			hours.push(hour);
		}

		result.forecasts = days;
		result.hourlyForecasts = hours;

		return result;
	}

	private ResolveCondition(weatherCode: number, isNight: boolean = false): Condition {
		let result: Condition = {
			customIcon: "refresh-symbolic",
			icons: ["weather-severe-alert"],
			main: _("Unknown"),
			description: _("Unknown")
		};

		switch (weatherCode) {
			case 0:     // Unknown
				return result;
			case 1000:  // Clear
				return {
					main: isNight ? _("Clear") : _("Sunny"),
					description: isNight ? _("Clear") : _("Sunny"),
					customIcon: isNight ? "night-clear-symbolic" : "day-sunny-symbolic",
					icons: isNight ? ["weather-clear-night"] : ["weather-clear"]
				}
			case 1001:  // Cloudy
				return {
					main: _("Cloudy"),
					description: _("Cloudy"),
					customIcon: "cloudy-symbolic",
					icons: ["weather-overcast", "weather-many-clouds", isNight ? "weather-clouds-night" : "weather-clouds"]
				}
			case 1100: // Mostly Clear
				return {
					main: _("Mostly clear"),
					description: _("Mostly clear"),
					customIcon: isNight ? "night-alt-cloudy-symbolic" : "day-cloudy-symbolic",
					icons: isNight ? ["weather-few-clouds-night", "weather-clouds-night"] : ["weather-few-clouds", "weather-clouds"]
				}
			case 1101: // Partly Cloudy
				return {
					main: _("Partly cloudy"),
					description: _("Partly cloudy"),
					customIcon: isNight ? "night-alt-cloudy-symbolic" : "day-cloudy-symbolic",
					icons: isNight ? ["weather-clouds-night", "weather-few-clouds-night"] : ["weather-clouds", "weather-few-clouds"]
				}
			case 1102:  // Mostly Cloudy
				return {
					main: _("Mostly cloudy"),
					description: _("Mostly cloudy"),
					customIcon: "cloud-symbolic",
					icons: ["weather-overcast", "weather-many-clouds", isNight ? "weather-clouds-night" : "weather-clouds"]
				}
			case 2000:  // Fog
				return {
					main: _("Fog"),
					description: _("Fog"),
					customIcon: "fog-symbolic",
					icons: ["weather-fog"]
				}
			case 2100:  // Light Fog
				return {
					main: _("Fog"),
					description: _("Light fog"),
					customIcon: isNight ? "night-fog-symbolic" : "day-fog-symbolic",
					icons: ["weather-fog"]
				}
			case 3000:  // Light Wind
				return {
					main: _("Wind"),
					description: _("Light wind"),
					customIcon: isNight ? "night-alt-wind-symbolic" : "day-windy-symbolic",
					icons: ["weather-windy"]
				}
			case 3001:  // Wind
				return {
					main: _("Wind"),
					description: _("Wind"),
					customIcon: "windy-symbolic",
					icons: ["weather-windy"]
				}
			case 3002:  //Strong Wind
				return {
					main: _("Wind"),
					description: _("Strong wind"),
					customIcon: "windy-symbolic",
					icons: ["weather-windy"]
				}
			case 4000:  // Drizzle
				return {
					main: _("Drizzle"),
					description: _("Drizzle"),
					customIcon: "rain-mix-symbolic",
					icons: ["weather-showers-scattered", "weather-showers", "weather-rain", "weather-freezing-rain"]
				}
			case 4001:  // Rain
				return {
					main: _("Rain"),
					description: _("Rain"),
					customIcon: "rain-symbolic",
					icons: ["weather-rain", "weather-showers", "weather-freezing-rain", "weather-showers-scattered"]
				}
			case 4200:  // Light Rain
				return {
					main: _("Rain"),
					description: _("Light rain"),
					customIcon: isNight ? "night-alt-rain-symbolic" : "day-rain-symbolic",
					icons: ["weather-showers-scattered", "weather-rain", "weather-freezing-rain", "weather-showers-scattered"]
				}
			case 4201:  // Heavy Rain
				return {
					main: _("Rain"),
					description: _("Heavy rain"),
					customIcon: "rain-symbolic",
					icons: ["weather-rain", "weather-showers", "weather-freezing-rain", "weather-showers-scattered"]
				}
			case 5000:  // Snow
				return {
					main: _("Snow"),
					description: _("Snow"),
					customIcon: "snow-symbolic",
					icons: ["weather-snow", "weather-snow-scattered", isNight ? "weather-snow-night" : "weather-snow-day"]
				}
			case 5001:  // Flurries
				return {
					main: _("Flurries"),
					description: _("Flurries"),
					customIcon: "snow-wind-symbolic",
					icons: ["weather-snow", "weather-snow-scattered", isNight ? "weather-snow-night" : "weather-snow-day"]
				}
			case 5100:  // Light Snow
				return {
					main: _("Snow"),
					description: _("Light snow"),
					customIcon: isNight ? "night-alt-snow-symbolic" : "day-snow-symbolic",
					icons: isNight ? ["weather-snow-scattered-night", "weather-snow-night", "weather-snow"] : ["weather-snow-scattered-day", "weather-snow-day", "weather-snow"]
				}
			case 5101: // Heavy Snow
				return {
					main: _("Snow"),
					description: _("Heavy snow"),
					customIcon: "snow-symbolic",
					icons: ["weather-snow", "weather-snow-scattered"]
				}
			case 6000: // Freezing Drizzle
				return {
					main: _("Drizzle"),
					description: _("Freezing drizzle"),
					customIcon: "rain-mix-symbolic",
					icons: ["weather-freezing-rain", "weather-showers", "weather-showers-scattered"]
				}
			case 6001: // Freezing Rain
				return {
					main: _("Rain"),
					description: _("Freezing rain"),
					customIcon: "rain-symbolic",
					icons: ["weather-freezing-rain", "weather-rain", "weather-showers", "weather-showers-scattered"]
				}
			case 6200:  // Light Freezing Rain
				return {
					main: _("Rain"),
					description: _("Light freezing rain"),
					customIcon: isNight ? "night-alt-rain-symbolic" : "day-rain-symbolic",
					icons: ["weather-freezing-rain", "weather-rain", "weather-showers", "weather-showers-scattered"]
				}
			case 6201:  // Heavy Freezing Rain
				return {
					main: _("Rain"),
					description: _("Heavy freezing rain"),
					customIcon: "rain-symbolic",
					icons: ["weather-freezing-rain", "weather-rain", "weather-showers", "weather-showers-scattered"]
				}
			case 7000:  // Ice Pellets
				return {
					main: _("Ice pellets"),
					description: _("Ice pellets"),
					customIcon: "sleet-symbolic",
					icons: ["weather-freezing-rain", "weather-rain", "weather-showers", "weather-showers-scattered"]
				}
			case 7101:  // Heavy Ice Pellets
				return {
					main: _("Ice pellets"),
					description: _("Heavy ice pellets"),
					customIcon: "sleet-symbolic",
					icons: ["weather-freezing-rain", "weather-rain", "weather-showers", "weather-showers-scattered"]
				}
			case 7102:  // Light Ice Pellets
				return {
					main: _("Ice pellets"),
					description: _("Light ice pellets"),
					customIcon: isNight ? "night-alt-sleet-symbolic" : "day-sleet-symbolic",
					icons: ["weather-freezing-rain", "weather-rain", "weather-showers", "weather-showers-scattered"]
				}
			case 8000:  // Thunderstorm
				return {
					main: _("Thunderstorm"),
					description: _("Thunderstorm"),
					customIcon: "thunderstorm-symbolic",
					icons: ["weather-storm"]
				}
			default:
				return result;
		}
	}

	private PrecipTypeToAppletType(type: PrecipType): PrecipitationType {
		switch (type) {
			case PrecipType.N_A:
				return "none";
			case PrecipType.Rain:
				return "rain";
			case PrecipType.Snow:
				return "snow";
			case PrecipType.Freezing_Rain:
				return "freezing rain";
			case PrecipType.Ice_Pellets:
				return "ice pellets";
			default:
				return "none";
		}
	}
}

const enum PrecipType {
	N_A,
	Rain,
	Snow,
	Freezing_Rain,
	Ice_Pellets
}


interface ClimacellV4Payload {
	data: {
		timelines: TimelinePayload[];
	};
	warnings: WarningPayload[]
}

interface TimelinePayload {
	timestep: Timestep;
	/** ISO Date String */
	startTime: string;
	/** ISO Date String */
	endTime: string;
	intervals: IntervalPayload[]
}

interface IntervalPayload {
	/** ISO Date String */
	startTime: string;
	values: {
		/** C */
		temperature: number;
		weatherCode: number;
		/** hPa */
		pressureSurfaceLevel: number;
		precipitationType: PrecipType;
		/** % */
		precipitationProbability: number;
		/** mm/hr */
		precipitationIntensity: number;
		/** degrees or null */
		windDirection: number;
		/** m/s */
		windSpeed: number;
		/** % */
		humidity: number;
		/** C */
		temperatureApparent: number;
		/** C */
		temperatureMax: number;
		/** C */
		temperatureMin: number;
		/** UTC Date string, only in 1d type */
		sunriseTime?: string;
		/** UTC Date string, only in 1d type */
		sunsetTime?: string;
	}
}

type Timestep = "current" | "1d" | "1h";

interface WarningPayload {
	code: number;
	type: string;
	message: string;
	meta: {
		timestep: Timestep;
		from: string;
		to: string
	}
}