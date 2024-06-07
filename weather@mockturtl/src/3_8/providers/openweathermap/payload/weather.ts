import { DateTime } from "luxon";
import type { OWMWeatherCondition } from "./common";
import { OWMDescToTranslated, OWMIconToBuiltInIcons, OWMIconToCustomIcon, OWMMainToTranslated } from "./condition";
import { _ } from "../../../utils";
import type { WeatherData } from "../../../weather-data";

export interface OWMWeatherResponse {
	/**
	 * City ID
	 */
	id: number;
	/**
	 * City name
	 */
	name: string;
	/**
	 * UTC unix timestamp in seconds
	 */
	dt: number;
	sys: {
		country: string;
		/**
		 * UTC unix timestamp in seconds
		 */
		sunrise: number;
		/**
		 * UTC unix timestamp in seconds
		 */
		sunset: number;
	}
	coord: {
		lat: number;
		lon: number;
	};
	weather: OWMWeatherCondition[]
	main: {
		/**
		 * Temperature in Kelvin
		 */
		temp: number;
		/**
		 * Temperature in Kelvin
		 */
		feels_like: number;
		/**
		 * Temperature in Kelvin
		 */
		temp_min: number;
		/**
		 * Temperature in Kelvin
		 */
		temp_max: number;
		/**
		 * Atmospheric pressure on the sea level in hPa
		 */
		pressure: number;
		/**
		 * Humidity in %
		 */
		humidity: number;
	}
	/**
	 * Visibility in meters, max 10km
	 */
	visibility: number;
	wind: {
		/**
		 * Wind speed in m/s
		 */
		speed: number;
		deg: number;
		/**
		 * Wind gust in m/s
		 */
		gust: number;
	}
	clouds: {
		/**
		 * Cloudiness in %
		 */
		all: number;
	}
	rain?: {
		"1h": number;
		"3h": number;
	}
	snow?: {
		"1h": number;
		"3h": number;
	}
}

export function OWMWeatherToWeatherData(weather: OWMWeatherResponse, conditionsTranslated: boolean, timezone: string): Omit<WeatherData, "forecasts" | "immediatePrecipitation" | "hourlyForecasts" | "alerts"> {
	return {
		date: DateTime.fromSeconds(weather.dt, { zone: timezone }),
		sunrise: DateTime.fromSeconds(weather.sys.sunrise, {zone: timezone}),
		sunset: DateTime.fromSeconds(weather.sys.sunset, {zone: timezone}),
		coord: weather.coord,
		location: {
			city: weather.name,
			country: weather.sys.country,
			url: `https://openweathermap.org/city/${weather.id}`,
			timeZone: timezone
		},
		condition: {
			main: conditionsTranslated ? weather.weather?.[0].main : OWMMainToTranslated(weather.weather?.[0].main),
			description: conditionsTranslated ? weather.weather?.[0].description : OWMDescToTranslated(weather.weather?.[0].description),
			icons: OWMIconToBuiltInIcons(weather.weather?.[0].icon),
			customIcon: OWMIconToCustomIcon(weather.weather?.[0].icon)
		},
		wind: {
			speed: weather.wind.speed,
			degree: weather.wind.deg,
		},
		temperature: weather.main.temp,
		pressure: weather.main.pressure,
		humidity: weather.main.humidity,
		dewPoint: null,
		extra_field: {
			type: "temperature",
			name: _("Feels like"),
			value: weather.main.feels_like
		}
	}
}