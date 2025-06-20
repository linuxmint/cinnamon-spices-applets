//////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////
///////////                                       ////////////
///////////                Met UK                 ////////////
///////////                                       ////////////
//////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////

import type { Config } from "../config";
import type { DistanceUnits } from "../config";
import { Logger } from "../lib/services/logger";
import { getTimes } from "suncalc";
import type { WeatherData, ForecastData, HourlyForecastData, Condition } from "../weather-data";
import type { LocationData, correctGetTimes } from "../types";
import { _, GetDistance, MPHtoMPS, CompassToDeg, CelsiusToKelvin, MetreToUserUnits, OnSameDay } from "../utils";
import { DateTime } from "luxon";
import { BaseProvider } from "./BaseProvider";
import { HttpLib } from "../lib/httpLib";
import { ErrorHandler } from "../lib/services/error_handler";

export class MetUk extends BaseProvider {

	//--------------------------------------------------------
	//  Properties
	//--------------------------------------------------------
	public readonly prettyName = _("Met Office UK");
	public readonly name = "Met Office UK";
	public readonly maxForecastSupport = 5;
	public readonly website = "https://www.metoffice.gov.uk/";
	public readonly maxHourlyForecastSupport = 36;
	public readonly needsApiKey = false;
	public readonly remainingCalls: number | null = null;
	public readonly supportHourlyPrecipChance = true;
	public readonly supportHourlyPrecipVolume = false;

	private baseUrl = "http://datapoint.metoffice.gov.uk/public/data/val/";

	private forecastPrefix = "wxfcs/all/json/";
	private threeHourlyUrl = "?res=3hourly";
	private dailyUrl = "?res=daily";

	private currentPrefix = "wxobs/all/json/";
	private sitesUrl = "sitelist";
	private key = "key=05de1ee8-de70-46aa-9b41-299d4cc60219";

	private forecastSite: WeatherSite | null = null;
	private observationSites: WeatherSite[] = [];

	private currentLoc!: LocationData;
	private currentLocID!: string;
	/** In metres */
	private readonly MAX_STATION_DIST = 50000;

	//--------------------------------------------------------
	//  Functions
	//--------------------------------------------------------
	public async GetWeather(newLoc: LocationData, cancellable: imports.gi.Gio.Cancellable, config: Config): Promise<WeatherData | null> {

		const loc = newLoc.lat.toString() + "," + newLoc.lon.toString();
		// Get closest sites
		if (this.currentLocID == null || this.currentLocID != loc || this.forecastSite == null || this.observationSites == null || this.observationSites.length == 0) {
			Logger.Info("Downloading new site data");
			this.currentLoc = newLoc;
			this.currentLocID = loc;

			const forecastSite = await this.GetClosestForecastSite(newLoc, cancellable);
			if (forecastSite == null) return null;

			const observationSites = await this.GetObservationSitesInRange(newLoc, this.MAX_STATION_DIST, cancellable);
			if (observationSites == null) return null;

			this.forecastSite = forecastSite;
			this.observationSites = observationSites;
		}
		else {
			Logger.Debug("Site data downloading skipped");
		}

		// Check if in country
		if (this.observationSites.length == 0 || this.forecastSite.dist > 100000) {
			// TODO: Validate that this does not happen with uk locations
			Logger.Error("User is probably not in UK, aborting");
			ErrorHandler.Instance.PostError({
				type: "hard",
				userError: true,
				detail: "location not covered",
				message: _("MET Office UK only covers the UK, please make sure your location is in the country"),
				service: "met-uk"
			})
			return null;
		}

		// Start getting forecast data
		const forecastPromise = this.GetData(this.baseUrl + this.forecastPrefix + this.forecastSite.id + this.dailyUrl + "&" + this.key, this.ParseForecast, newLoc, cancellable);
		const hourlyPayload = this.GetData(this.baseUrl + this.forecastPrefix + this.forecastSite.id + this.threeHourlyUrl + "&" + this.key, this.ParseHourlyForecast, newLoc, cancellable);

		// Get and Parse Observation data
		const observations = await this.GetObservationData(this.observationSites, cancellable);
		const currentResult = this.ParseCurrent(observations, newLoc, config);
		if (!currentResult)
			return null;


		// await for forecasts if not finished
		const forecastResult = await forecastPromise;
		currentResult.forecasts = forecastResult ?? [];
		const threeHourlyResolved = await hourlyPayload;
		if (threeHourlyResolved == null) {
			currentResult.hourlyForecasts = [];
			return null;
		}

		const [threeHourlyForecast, additionalData] = threeHourlyResolved;
		currentResult.hourlyForecasts = threeHourlyForecast;
		currentResult.uvIndex = additionalData?.uvIndex ?? null;
		return currentResult;
	};

	private async GetClosestForecastSite(loc: LocationData, cancellable: imports.gi.Gio.Cancellable): Promise<WeatherSite | null> {
		const forecastSitelist = await HttpLib.Instance.LoadJsonSimple<MetUKSiteListResponse>({
			url: this.baseUrl + this.forecastPrefix + this.sitesUrl + "?" + this.key,
			cancellable
		});

		if (forecastSitelist == null)
			return null;

		return this.GetClosestSite(forecastSitelist, loc);
	}

	private async GetObservationSitesInRange(loc: LocationData, range: number, cancellable: imports.gi.Gio.Cancellable): Promise<WeatherSite[] | null> {
		// TODO: Add type definition
		// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
		const observationSiteList = await HttpLib.Instance.LoadJsonSimple<MetUKSiteListResponse>({
			url: this.baseUrl + this.currentPrefix + this.sitesUrl + "?" + this.key,
			cancellable
		});

		if (observationSiteList == null)
			return null;

		// Sort out close observation sites
		let observationSites: WeatherSite[] = [];
		for (const element of observationSiteList.Locations.Location) {
			element.dist = GetDistance(Number.parseFloat(element.latitude), Number.parseFloat(element.longitude), loc.lat, loc.lon);
			if (element.dist > range) continue; // do not include stations outside area
			observationSites.push(element);
		}

		// ascending by distance
		observationSites = this.SortObservationSites(observationSites);
		Logger.Debug("Observation sites found: " + JSON.stringify(observationSites, null, 2));
		return observationSites;
	}

	private async GetObservationData(observationSites: WeatherSite[], cancellable: imports.gi.Gio.Cancellable) {
		const observations: METPayload<true>[] = [];
		for (const element of observationSites) {
			Logger.Debug("Getting observation data from station: " + element.id);
			const payload = await HttpLib.Instance.LoadJsonSimple<METPayload<true>>({
				url: this.baseUrl + this.currentPrefix + element.id + "?res=hourly&" + this.key,
				cancellable
			});

			if (payload)
				observations.push(payload);
			else {
				Logger.Debug("Failed to get observations from " + element.id);
			}
		}
		return observations;
	}

	// A function as a function parameter 2 levels deep does not know
	// about the top level object information, has to pass it in as a parameter
	/**
	 *
	 * @param baseUrl
	 * @param ParseFunction returns WeatherData or ForecastData Object
	 */
	private async GetData<T, R>(query: string, ParseFunction: (json: T, loc: LocationData) => R | null, loc: LocationData, cancellable: imports.gi.Gio.Cancellable) {
		if (query == null)
			return null;

		Logger.Debug("Query: " + query);
		const json = await HttpLib.Instance.LoadJsonSimple({ url: query, cancellable });

		if (json == null)
			return null;

		return ParseFunction(json as T, loc);
	};

	private ParseCurrent(json: METPayload<true>[], loc: LocationData, config: Config): WeatherData | null {
		const observation = this.MeshObservations(json, loc);
		if (!observation) {
			return null;
		}
		let dataIndex: number = -1;
		for (const [index, element] of json.entries()) {
			if (element.SiteRep.DV.Location == null)
				continue;
			dataIndex = index;
			break;
		}
		const filteredJson = json as unknown as METPayload<false>[];

		if (dataIndex == -1) {
			ErrorHandler.Instance.PostError({
				detail: "no api response",
				type: "hard",
				message: _("Data was not found for location"),
				service: "met-uk",
			})
			return null;
		}

		const times = (getTimes as correctGetTimes)(
			new Date(), Number.parseFloat(filteredJson[dataIndex].SiteRep.DV.Location.lat),
			Number.parseFloat(filteredJson[dataIndex].SiteRep.DV.Location.lon),
			Number.parseFloat(filteredJson[dataIndex].SiteRep.DV.Location.elevation)
		);
		try {
			const weather: WeatherData = {
				coord: {
					lat: Number.parseFloat(filteredJson[dataIndex].SiteRep.DV.Location.lat),
					lon: Number.parseFloat(filteredJson[dataIndex].SiteRep.DV.Location.lon)
				},
				location: {
					city: undefined,
					country: undefined,
					timeZone: loc.timeZone,
				},
				stationInfo: {
					distanceFrom: this.observationSites[dataIndex].dist,
					name: this.observationSites[dataIndex].name,
					area: this.observationSites[dataIndex].unitaryAuthArea,
					lat: Number.parseFloat(this.observationSites[dataIndex].latitude),
					lon: Number.parseFloat(this.observationSites[dataIndex].longitude),
				},
				date: DateTime.fromISO(json[dataIndex].SiteRep.DV.dataDate, { zone: loc.timeZone }),
				sunrise: DateTime.fromJSDate(times.sunrise, { zone: loc.timeZone }),
				sunset: DateTime.fromJSDate(times.sunset, { zone: loc.timeZone }),
				wind: {
					speed: null,
					degree: null
				},
				temperature: null,
				pressure: null,
				humidity: null,
				dewPoint: null,
				uvIndex: null,
				condition: this.ResolveCondition(observation?.W),
				forecasts: []
			};

			if (observation?.V != null) {
				weather.extra_field = {
					name: _("Visibility"),
					value: this.VisibilityToText(observation.V, config),
					type: "string"
				}
			}

			if (observation?.S != null) {
				weather.wind.speed = MPHtoMPS(Number.parseFloat(observation.S));
			}
			if (observation?.D != null) {
				weather.wind.degree = CompassToDeg(observation.D);
			}
			if (observation?.T != null) {
				weather.temperature = CelsiusToKelvin(Number.parseFloat(observation.T));
			}
			if (observation?.P != null) {
				weather.pressure = Number.parseFloat(observation.P);
			}
			if (observation?.H != null) {
				weather.humidity = Number.parseFloat(observation.H);
			}
			if (observation?.Dp != null) {
				weather.dewPoint = CelsiusToKelvin(Number.parseFloat(observation.Dp));
			}

			return weather;
		}
		catch (e) {
			if (e instanceof Error)
				Logger.Error("Met UK Weather Parsing error: " + e.message, e);
			ErrorHandler.Instance.PostError({ type: "soft", service: "met-uk", detail: "unusual payload", message: _("Failed to Process Current Weather Info") })
			return null;
		}
	};

	private ParseForecast = (json: METPayload, loc: LocationData): ForecastData[] | null => {
		const forecasts: ForecastData[] = [];
		try {
			const period = json.SiteRep.DV?.Location?.Period ?? [];
			for (const element of Array.isArray(period) ? period : [period]) {
				if (!Array.isArray(element.Rep))
					continue;

				const day = element.Rep[0] as ForecastPayload;
				const night = element.Rep[1] as ForecastPayload;

				const forecast: ForecastData = {
					date: DateTime.fromISO(this.PartialToISOString(element.value), { zone: loc.timeZone }),
					temp_min: CelsiusToKelvin(Number.parseFloat(night.Nm ?? "0")),
					temp_max: CelsiusToKelvin(Number.parseFloat(day.Dm ?? "0")),
					condition: this.ResolveCondition(day.W),
				};
				forecasts.push(forecast);
			}
			return forecasts;
		}
		catch (e) {
			if (e instanceof Error)
				Logger.Error("MET UK Forecast Parsing error: " + e.message, e);
			ErrorHandler.Instance.PostError({ type: "soft", service: "met-uk", detail: "unusual payload", message: _("Failed to Process Forecast Info") })
			return null;
		}
	};

	private ParseHourlyForecast = (json: METPayload, loc: LocationData): [HourlyForecastData[], { uvIndex: number | null }] | null => {
		const forecasts: HourlyForecastData[] = [];
		let uvIndex: number | null = null;
		try {
			for (const day of Array.isArray(json.SiteRep.DV.Location.Period) ? json.SiteRep.DV.Location.Period : [json.SiteRep.DV.Location.Period]) {
				const date = DateTime.fromISO(this.PartialToISOString(day.value), { zone: loc.timeZone });
				if (!Array.isArray(day.Rep))
					continue;

				uvIndex = ("U" in day.Rep[0]) ? Number.parseInt(day.Rep[0].U) : null;
				if (Number.isNaN(uvIndex))
					uvIndex = null;

				for (const element of day.Rep) {
					const hour = element as ThreeHourPayload;
					const timestamp = date.plus({ hours: Number.parseInt(hour.$) / 60 })

					// Show the previous 3-hour forecast until it reaches the next one
					const threshold = DateTime.utc().setZone(loc.timeZone).minus({ hours: 3 });

					if (timestamp < threshold) continue;

					const forecast: HourlyForecastData = {
						date: timestamp,
						temp: CelsiusToKelvin(Number.parseFloat(hour.T)),
						condition: this.ResolveCondition(hour.W),
						precipitation: {
							type: "rain",
							//volume: undefined,
							chance: Number.parseFloat(hour.Pp)
						}
					};
					forecasts.push(forecast);
				}
			}
			return [forecasts, { uvIndex }];
		}
		catch (e) {
			if (e instanceof Error)
				Logger.Error("MET UK Forecast Parsing error: " + e.message, e);
			ErrorHandler.Instance.PostError({ type: "soft", service: "met-uk", detail: "unusual payload", message: _("Failed to Process Forecast Info") })
			return null;
		}
	}

	/** https://www.metoffice.gov.uk/services/data/datapoint/code-definitions */
	private VisibilityToText(dist: string, config: Config): string {
		const distance = Number.parseInt(dist);
		const unit = config.DistanceUnit;
		const stringFormat: Record<string, string> = {
			distanceUnit: this.DistanceUnitFor(unit)
		};

		if (distance < 1000) {
			stringFormat.distance = MetreToUserUnits(1000, unit).toString();
			return `${_("Very poor")} - ${_("Less than {distance} {distanceUnit}", stringFormat)}`;
		}
		else if (distance >= 40000) {
			stringFormat.distance = MetreToUserUnits(40000, unit).toString();
			return `${_("Excellent")} - ${_("More than {distance} {distanceUnit}", stringFormat)}`;
		}
		else if (distance < 4000) {
			stringFormat.smallerDistance = MetreToUserUnits(1000, unit).toString();
			stringFormat.biggerDistance = MetreToUserUnits(4000, unit).toString();
			return `${_("Poor")} - ${_("Between {smallerDistance}-{biggerDistance} {distanceUnit}", stringFormat)}`;
		}

		else if (distance < 10000) {
			stringFormat.smallerDistance = MetreToUserUnits(4000, unit).toString();
			stringFormat.biggerDistance = MetreToUserUnits(10000, unit).toString();
			return `${_("Moderate")} - ${_("Between {smallerDistance}-{biggerDistance} {distanceUnit}", stringFormat)}`;
		}

		else if (distance < 20000) {
			stringFormat.smallerDistance = MetreToUserUnits(10000, unit).toString();
			stringFormat.biggerDistance = MetreToUserUnits(20000, unit).toString();
			return `${_("Good")} - ${_("Between {smallerDistance}-{biggerDistance} {distanceUnit}", stringFormat)}`;
		}

		else if (distance < 40000) {
			stringFormat.smallerDistance = MetreToUserUnits(20000, unit).toString();
			stringFormat.biggerDistance = MetreToUserUnits(40000, unit).toString();
			return `${_("Very good")} - ${_("Between {smallerDistance}-{biggerDistance} {distanceUnit}", stringFormat)}`;
		}
		else {
			stringFormat.smallerDistance = MetreToUserUnits(20000, unit).toString();
			stringFormat.biggerDistance = MetreToUserUnits(40000, unit).toString();
			return `${_("Very good")} - ${_("Between {smallerDistance}-{biggerDistance} {distanceUnit}", stringFormat)}`;
		}
	}

	private DistanceUnitFor(unit: DistanceUnits) {
		if (unit == "imperial") return _("mi");
		return _("km");
	}

	private SortObservationSites(observations: WeatherSite[]): WeatherSite[] {
		observations = observations.sort((a, b) => {
			if (a.dist < b.dist) return -1;
			if (a.dist == b.dist) return 0;
			return 1;
		})
		return observations;
	}

	/**
	 * Mesh observation data if some values are missing
	 * @param observations sorted by distance of location, ascending
	 */
	private MeshObservations(observations: METPayload<true>[], loc: LocationData): ObservationPayload | null {
		if (!observations)
			return null;
		if (observations.length == 0)
			return null;
		// Sometimes Location property is missing
		const firstPeriod = observations[0]?.SiteRep?.DV?.Location?.Period ?? [];
		let result = this.GetLatestObservation(Array.isArray(firstPeriod) ? firstPeriod : [firstPeriod], DateTime.utc().setZone(loc.timeZone), loc);
		if (observations.length == 1)
			return result;

		for (const [index, observation] of observations.entries()) {
			if (observation?.SiteRep?.DV?.Location?.Period == null)
				continue;

			// Not an array, fix it
			if (!Array.isArray(observation.SiteRep.DV.Location.Period))
				observation.SiteRep.DV.Location.Period = [observation.SiteRep.DV.Location.Period]

			const nextObservation = this.GetLatestObservation(observation.SiteRep.DV.Location.Period, DateTime.utc().setZone(loc.timeZone), loc);
			if (result == null)
				result = nextObservation;
			const debugText =
				" Observation data missing, plugged in from ID " +
				observation.SiteRep.DV.Location.i + ", index " + index +
				", distance "
				+ Math.round(GetDistance(
					Number.parseFloat(observation.SiteRep.DV.Location.lat),
					Number.parseFloat(observation.SiteRep.DV.Location.lon),
					this.currentLoc.lat,
					this.currentLoc.lon
				))
				+ " metres";
			if (result != null) {
				if (result?.V == null) {
					result.V = nextObservation?.V;
					Logger.Debug("Visibility" + debugText);
				}
				if (result?.W == null) {
					result.W = nextObservation?.W;
					Logger.Debug("Weather condition" + debugText);
				}
				if (result?.S == null) {
					result.S = nextObservation?.S;
					Logger.Debug("Wind Speed" + debugText);
				}
				if (result?.D == null) {
					result.D = nextObservation?.D;
					Logger.Debug("Wind degree" + debugText);
				}
				if (result?.T == null) {
					result.T = nextObservation?.T;
					Logger.Debug("Temperature" + debugText);
				}
				if (result?.P == null) {
					result.P = nextObservation?.P;
					Logger.Debug("Pressure" + debugText);
				}
				if (result?.H == null) {
					result.H = nextObservation?.H;
					Logger.Debug("Humidity" + debugText);
				}
				if (result?.Dp == null) {
					result.Dp = nextObservation?.Dp;
					Logger.Debug("Dew Point" + debugText);
				}
			}
		}
		return result;
	}

	/**
	 * Obtains the latest observation from the data of past 24-hour observation periods
	 * @param observations
	 * @param day
	 */
	private GetLatestObservation(observations: Period[], day: DateTime, loc: LocationData): ObservationPayload | null {
		if (observations == null)
			return null;

		for (const element of observations) {
			const date = DateTime.fromISO(this.PartialToISOString(element.value), { zone: loc.timeZone });
			if (!OnSameDay(date, day)) continue;
			if (Array.isArray(element.Rep))
				return element.Rep[element.Rep.length - 1] as ObservationPayload;
			else
				return element.Rep;
		}
		return null;
	}

	/**
	 *
	 * @param date Example "2020-06-22Z"
	 */
	private PartialToISOString(date: string): string {
		return (date.replace("Z", "")) + "T00:00:00Z";
	}

	private GetClosestSite(siteList: MetUKSiteListResponse, loc: LocationData): WeatherSite {
		const sites = siteList.Locations.Location;
		let closest = sites[0];
		closest.dist = GetDistance(Number.parseFloat(closest.latitude), Number.parseFloat(closest.longitude), loc.lat, loc.lon);
		for (const element of sites) {
			element.dist = GetDistance(Number.parseFloat(element.latitude), Number.parseFloat(element.longitude), loc.lat, loc.lon);
			if (element.dist < closest.dist) {
				closest = element;
			}
		}
		return closest;
	}

	private ResolveCondition(icon: string | undefined): Condition {
		switch (icon) {
			case "NA":
				return {
					main: _("Unknown"),
					description: _("Unknown"),
					customIcon: "cloud-refresh-symbolic",
					icons: ["weather-severe-alert"]
				}
			case "0": // Clear night
				return {
					main: _("Clear"),
					description: _("Clear"),
					customIcon: "night-clear-symbolic",
					icons: ["weather-clear-night", "weather-severe-alert"]
				}
			case "1": // Sunny day
				return {
					main: _("Sunny"),
					description: _("Sunny"),
					customIcon: "day-sunny-symbolic",
					icons: ["weather-clear", "weather-severe-alert"]
				}
			case "2": // Partly cloudy (night)
				return {
					main: _("Partly cloudy"),
					description: _("Partly cloudy"),
					customIcon: "night-alt-cloudy-symbolic",
					icons: ["weather-clouds-night", "weather-overcast", "weather-severe-alert"]
				}
			case "3": // Partly cloudy (day)
				return {
					main: _("Partly cloudy"),
					description: _("Partly cloudy"),
					customIcon: "day-cloudy-symbolic",
					icons: ["weather-clouds", "weather-overcast", "weather-severe-alert"]
				}
			case "4": // Not used - really?
				return {
					main: _("Unknown"),
					description: _("Unknown"),
					customIcon: "cloud-refresh-symbolic",
					icons: ["weather-severe-alert"]
				}
			case "5": // Mist
				return {
					main: _("Mist"),
					description: _("Mist"),
					customIcon: "fog-symbolic",
					icons: ["weather-fog", "weather-severe-alert"]
				}
			case "6": // Fog
				return {
					main: _("Fog"),
					description: _("Fog"),
					customIcon: "fog-symbolic",
					icons: ["weather-fog", "weather-severe-alert"]
				}
			case "7": // Cloudy
				return {
					main: _("Cloudy"),
					description: _("Cloudy"),
					customIcon: "cloud-symbolic",
					icons: ["weather-overcast", "weather-many-clouds", "weather-severe-alert"]
				}
			case "8":
				return { // Overcast
					main: _("Overcast"),
					description: _("Overcast"),
					customIcon: "cloudy-symbolic",
					icons: ["weather-overcast", "weather-many-clouds", "weather-severe-alert"]
				}
			case "9": // Light rain shower (night)
				return {
					main: _("Light rain"),
					description: _("Light rain shower"),
					customIcon: "night-alt-showers-symbolic",
					icons: ["weather-showers-scattered-night", "weather-showers-night", "weather-showers-scattered", "weather-showers", "weather-freezing-rain", "weather-severe-alert"]
				}
			case "10": // Light rain shower (day)
				return {
					main: _("Light rain"),
					description: _("Light rain shower"),
					customIcon: "day-showers-symbolic",
					icons: ["weather-showers-scattered-day", "weather-showers-day", "weather-showers-scattered", "weather-showers", "weather-freezing-rain", "weather-severe-alert"]
				}
			case "11": // Drizzle
				return {
					main: _("Drizzle"),
					description: _("Drizzle"),
					customIcon: "showers-symbolic",
					icons: ["weather-showers-scattered", "weather-showers", "weather-rain", "weather-freezing-rain", "weather-severe-alert"]
				}
			case "12": // Light rain
				return {
					main: _("Light rain"),
					description: _("Light rain"),
					customIcon: "showers-symbolic",
					icons: ["weather-showers-scattered", "weather-showers", "weather-rain", "weather-freezing-rain", "weather-severe-alert"]
				}
			case "13": // Heavy rain shower (night)
				return {
					main: _("Heavy rain"),
					description: _("Heavy rain shower"),
					customIcon: "night-alt-rain-symbolic",
					icons: ["weather-showers-night", "weather-showers", "weather-showers-scattered", "weather-severe-alert"]
				}
			case "14": // Heavy rain shower (day)
				return {
					main: _("Heavy rain"),
					description: _("Heavy rain shower"),
					customIcon: "day-rain-symbolic",
					icons: ["weather-showers-day", "weather-showers", "weather-showers-scattered", "weather-severe-alert"]
				}
			case "15": // Heavy rain
				return {
					main: _("Heavy rain"),
					description: _("Heavy rain"),
					customIcon: "rain-symbolic",
					icons: ["weather-showers", "weather-showers-scattered", "weather-severe-alert"]
				}
			case "16": // Sleet shower (night)
				return {
					main: _("Sleet"),
					description: _("Sleet shower"),
					customIcon: "night-alt-rain-mix-symbolic",
					icons: ["weather-showers-night", "weather-showers", "weather-showers-scattered", "weather-severe-alert"]
				}
			case "17": // Sleet shower (day)
				return {
					main: _("Sleet"),
					description: _("Sleet shower"),
					customIcon: "day-rain-mix-symbolic",
					icons: ["weather-showers-day", "weather-showers", "weather-showers-scattered", "weather-severe-alert"]
				}
			case "18": // Sleet
				return {
					main: _("Sleet"),
					description: _("Sleet"),
					customIcon: "rain-mix-symbolic",
					icons: ["weather-showers", "weather-showers-scattered", "weather-severe-alert"]
				}
			case "19": // Hail shower (night)
				return {
					main: _("Hail"),
					description: _("Hail shower"),
					customIcon: "night-alt-hail-symbolic",
					icons: ["weather-showers-night", "weather-showers", "weather-showers-scattered", "weather-severe-alert"]
				}
			case "20": // Hail shower (day)
				return {
					main: _("Hail"),
					description: _("Hail shower"),
					customIcon: "day-hail-symbolic",
					icons: ["weather-showers-day", "weather-showers", "weather-showers-scattered", "weather-severe-alert"]
				}
			case "21": // Hail
				return {
					main: _("Hail"),
					description: _("Hail"),
					customIcon: "hail-symbolic",
					icons: ["weather-showers", "weather-showers-scattered", "weather-severe-alert"]
				}
			case "22": // Light snow shower (night)
				return {
					main: _("Light snow"),
					description: _("Light snow shower"),
					customIcon: "night-alt-snow-symbolic",
					icons: ["weather-snow-scattered", "weather-snow", "weather-severe-alert"]
				}
			case "23": // Light snow shower (day)
				return {
					main: _("Light snow"),
					description: _("Light snow shower"),
					customIcon: "day-snow-symbolic",
					icons: ["weather-snow-scattered", "weather-snow", "weather-severe-alert"]
				}
			case "24": // Light snow
				return {
					main: _("Light snow"),
					description: _("Light snow"),
					customIcon: "snow-symbolic",
					icons: ["weather-snow-scattered", "weather-snow", "weather-severe-alert"]
				}
			case "25": // Heavy snow shower (night)
				return {
					main: _("Heavy snow"),
					description: _("Heavy snow shower"),
					customIcon: "night-alt-snow-symbolic",
					icons: ["weather-snow", "weather-snow-scattered", "weather-severe-alert"]
				}
			case "26": // 	Heavy snow shower (day)
				return {
					main: _("Heavy snow"),
					description: _("Heavy snow shower"),
					customIcon: "day-snow-symbolic",
					icons: ["weather-snow", "weather-snow-scattered", "weather-severe-alert"]
				}
			case "27": // Heavy snow
				return {
					main: _("Heavy snow"),
					description: _("Heavy snow"),
					customIcon: "snow-symbolic",
					icons: ["weather-snow", "weather-snow-scattered", "weather-severe-alert"]
				}
			case "28": // Thunder shower (night)
				return {
					main: _("Thunder"),
					description: _("Thunder shower"),
					customIcon: "day-storm-showers-symbolic",
					icons: ["weather-storm", "weather-severe-alert"]
				}
			case "29": // Thunder shower (day)
				return {
					main: _("Thunder"),
					description: _("Thunder shower"),
					customIcon: "night-alt-storm-showers-symbolic",
					icons: ["weather-storm", "weather-severe-alert"]
				}
			case "30": // Thunder
				return {
					main: _("Thunder"),
					description: _("Thunder"),
					customIcon: "thunderstorm-symbolic",
					icons: ["weather-storm", "weather-severe-alert"]
				}
			default:
				return {
					main: _("Unknown"),
					description: _("Unknown"),
					customIcon: "cloud-refresh-symbolic",
					icons: ["weather-severe-alert"]
				}
		}
	};
};

interface MetUKSiteListResponse {
	Locations: {
		Location: WeatherSite[]
	}
}

interface WeatherSite {
	elevation: string;
	id: string;
	latitude: string;
	longitude: string;
	obsSource?: string;
	name: string;
	region: string;
	unitaryAuthArea: string;
	/** metres */
	dist: number;
}


/**
 * If true it's Observation Payload.
 */
interface METPayload<T extends boolean = false> {
	SiteRep: {
		Wx: {
			Param: unknown[];
		},
		DV: {
			dataDate: string;
			type: string;
			Location: T extends false ? LocationPayload : LocationPayload | undefined
		}
	}
}

interface LocationPayload {
	i: string;
	lat: string;
	lon: string;
	name: string;
	country: string;
	continent: string;
	elevation: string;
	Period: Period[] | Period
}

interface Period {
	type: string;
	/** Date as ISO string */
	value: string;
	Rep: ObservationPayload[] | ObservationPayload | ForecastPayload[] | ThreeHourPayload[]
}

interface ObservationPayload {
	/** Wind Gust, mph? */
	G?: string | undefined;
	/** Wind direction, Compass? e.g. NW */
	D?: string | undefined;
	/** Humidity, %? */
	H?: string | undefined;
	/** Pressure, hpa? */
	P?: string | undefined;
	/** Wind speed, mph? */
	S?: string | undefined;
	/** Temperature, C? */
	T?: string | undefined;
	/** Visibility, m? */
	V?: string | undefined;
	/** Weather type, https://www.metoffice.gov.uk/services/data/datapoint/code-definitions */
	W?: string | undefined;
	/** Pressure tendency, Pa/s? */
	Pt?: string | undefined;
	/** Dew Point, C? */
	Dp?: string | undefined;
	/** Minutes after midnight on the day */
	$: string;
}

interface ThreeHourPayload {
	/** Wind Gust, mph? */
	G: string;
	/** Wind direction, Compass? e.g. NW */
	D: string;
	/** Wind speed, mph? */
	S: string;
	/** Feels like temperature, C? */
	F: string;
	/** Screen Relative Humidity, % */
	H?: string;
	/** Temperature, C? */
	T: string;
	/** Visibility type, https://www.metoffice.gov.uk/services/data/datapoint/code-definitions */
	V: string;
	/** Weather type, https://www.metoffice.gov.uk/services/data/datapoint/code-definitions */
	W: string;
	/** Precipitation Probability, % */
	Pp: string;
	/** UV radiation, Solar UV Index */
	U: string;
	/** Minutes after midnight on the day */
	$: string;
}

interface ForecastPayload {
	/** UV radiation, Solar UV Index */
	U: string;
	/** Wind speed, mph? */
	S: string;
	/** Wind direction, Compass? e.g. NW */
	D: string;
	/** Visibility, m? */
	V: string;
	/** Weather type, https://www.metoffice.gov.uk/services/data/datapoint/code-definitions */
	W: string;
	/** Feels Like Day Maximum Temperature, C */
	FDm?: string;
	/** Feels Like Night Minimum Temperature, C */
	FNm?: string;
	/** Day Maximum Temperature, C */
	Dm?: string;
	/** Night Minimum Temperature, C */
	Nm?: string;
	/** Wind Gust Noon, mph */
	Gn?: string;
	/** Wind Gust Midnight, mph */
	Gm?: string;
	/** Precipitation Probability Day, % */
	PPn?: string;
	/** Precipitation Probability Night, % */
	PPd?: string;
	/** Screen Relative Humidity Noon, % */
	Hn?: string;
	/** Screen Relative Humidity Midnight, % */
	Hm?: string;
	/** Day/Night */
	$: string;
}
