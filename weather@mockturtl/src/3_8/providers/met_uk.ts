//////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////
///////////                                       ////////////
///////////                Met UK                 ////////////
///////////                                       ////////////
//////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////

import { DistanceUnits } from "config";
import { Log } from "lib/logger";
import { WeatherApplet } from "main";
import { SunCalc } from "lib/sunCalc";
import { WeatherProvider, WeatherData, ForecastData, HourlyForecastData, Condition, LocationData } from "types";
import { _, GetDistance, MPHtoMPS, CompassToDeg, CelsiusToKelvin, MetreToUserUnits } from "utils";

export class MetUk implements WeatherProvider {

	//--------------------------------------------------------
	//  Properties
	//--------------------------------------------------------
	public readonly prettyName = _("Met Office UK");
	public readonly name = "Met Office UK";
	public readonly maxForecastSupport = 5;
	public readonly website = "https://www.metoffice.gov.uk/";
	public readonly maxHourlyForecastSupport = 36;
	public readonly needsApiKey = false;

	private sunCalc: SunCalc;

	private baseUrl = "http://datapoint.metoffice.gov.uk/public/data/val/";

	private forecastPrefix = "wxfcs/all/json/";
	private threeHourlyUrl = "?res=3hourly";
	private dailyUrl = "?res=daily";

	private currentPrefix = "wxobs/all/json/";
	private sitesUrl = "sitelist";
	private key = "key=05de1ee8-de70-46aa-9b41-299d4cc60219";

	private app: WeatherApplet;
	private forecastSite: WeatherSite = null;
	private observationSites: WeatherSite[] = null;
	private currentLoc: LocationData = null;
	private currentLocID: string = null;
	/** In metres */
	private readonly MAX_STATION_DIST = 50000;

	constructor(_app: WeatherApplet) {
		this.app = _app;
		this.sunCalc = new SunCalc();
	}

	//--------------------------------------------------------
	//  Functions
	//--------------------------------------------------------
	public async GetWeather(newLoc: LocationData): Promise<WeatherData> {
		if (newLoc == null) return null;

		let loc = newLoc.lat.toString() + "," + newLoc.lon.toString();
		// Get closest sites
		if (this.currentLocID == null || this.currentLocID != loc || this.forecastSite == null || this.observationSites == null || this.observationSites.length == 0) {
			Log.Instance.Print("Downloading new site data");
			this.currentLoc = newLoc;
			this.currentLocID = loc;

			let forecastSite = await this.GetClosestForecastSite(newLoc);
			if (forecastSite == null) return null;

			let observationSites = await this.GetObservationSitesInRange(newLoc, this.MAX_STATION_DIST);
			if (observationSites == null) return null;

			this.forecastSite = forecastSite;
			this.observationSites = observationSites;
		}
		else {
			Log.Instance.Debug("Site data downloading skipped");
		}

		// Check if in country
		if (this.observationSites.length == 0 || this.forecastSite.dist > 100000) {
			// TODO: Validate that this does not happen with uk locations
			Log.Instance.Error("User is probably not in UK, aborting");
			this.app.ShowError({
				type: "hard",
				userError: true,
				detail: "location not covered",
				message: "MET Office UK only covers the UK, please make sure your location is in the country",
				service: "met-uk"
			})
			return null;
		}

		// Start getting forecast data
		let forecastPromise = this.GetData(this.baseUrl + this.forecastPrefix + this.forecastSite.id + this.dailyUrl + "&" + this.key, this.ParseForecast) as Promise<ForecastData[]>;
		let hourlyPayload = this.GetData(this.baseUrl + this.forecastPrefix + this.forecastSite.id + this.threeHourlyUrl + "&" + this.key, this.ParseHourlyForecast) as Promise<HourlyForecastData[]>;

		// Get and Parse Observation data
		let observations = await this.GetObservationData(this.observationSites);
		let currentResult = this.ParseCurrent(observations);
		if (!currentResult) return null;

		// await for forecasts if not finished
		let forecastResult = await forecastPromise;
		currentResult.forecasts = (!forecastResult) ? [] : forecastResult;
		let threeHourlyForecast = await hourlyPayload;
		currentResult.hourlyForecasts = (!threeHourlyForecast) ? [] : threeHourlyForecast as HourlyForecastData[];
		return currentResult;
	};

	private async GetClosestForecastSite(loc: LocationData): Promise<WeatherSite> {
		let forecastSitelist = await this.app.LoadJsonAsync(this.baseUrl + this.forecastPrefix + this.sitesUrl + "?" + this.key);
		if (forecastSitelist == null)
			return null;

		return this.GetClosestSite(forecastSitelist, loc);
	}

	private async GetObservationSitesInRange(loc: LocationData, range: number): Promise<WeatherSite[]> {
		let observationSiteList = await this.app.LoadJsonAsync<any>(this.baseUrl + this.currentPrefix + this.sitesUrl + "?" + this.key);
		if (observationSiteList == null)
			return null;

		// Sort out close observation sites
		let observationSites = [];
		for (let index = 0; index < observationSiteList.Locations.Location.length; index++) {
			const element = observationSiteList.Locations.Location[index];
			element.dist = GetDistance(parseFloat(element.latitude), parseFloat(element.longitude), loc.lat, loc.lon);
			if (element.dist > range) continue; // do not include stations outside area
			observationSites.push(element);
		}

		// ascending by distance
		observationSites = this.SortObservationSites(observationSites);
		Log.Instance.Debug("Observation sites found: " + JSON.stringify(observationSites, null, 2));
		return observationSites;
	}

	private async GetObservationData(observationSites: WeatherSite[]) {
		let observations: METPayload[] = [];
		for (let index = 0; index < observationSites.length; index++) {
			const element = observationSites[index];
			Log.Instance.Debug("Getting observation data from station: " + element.id);
			let payload = await this.app.LoadJsonAsync<METPayload>(this.baseUrl + this.currentPrefix + element.id + "?res=hourly&" + this.key);
			if (!!payload)
				observations.push(payload);
			else {
				Log.Instance.Debug("Failed to get observations from " + element.id);
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
	private async GetData(query: string, ParseFunction: (json: any, context: any) => WeatherData | ForecastData[] | HourlyForecastData[]) {
		if (query == null)
			return null;

		Log.Instance.Debug("Query: " + query);
		let json = await this.app.LoadJsonAsync(query);

		if (json == null)
			return null;

		return ParseFunction(json, this);
	};

	private ParseCurrent(json: METPayload[]): WeatherData {
		let observation = this.MeshObservations(json);
		if (!observation) {
			return null;
		}
		let dataIndex: number;
		for (let index = 0; index < json.length; index++) {
			const element = json[index];
			if (element.SiteRep.DV.Location == null) continue;
			dataIndex = index;
			break;
		}
		if (dataIndex == null) {
			this.app.ShowError({
				detail: "no api response",
				type: "hard",
				message: _("Data was not found for location"),
				service: "met-uk",
			})
			return null;
		}

		let times = this.sunCalc.getTimes(new Date(), parseFloat(json[dataIndex].SiteRep.DV.Location.lat), parseFloat(json[dataIndex].SiteRep.DV.Location.lon), parseFloat(json[dataIndex].SiteRep.DV.Location.elevation));
		try {
			let weather: WeatherData = {
				coord: {
					lat: parseFloat(json[dataIndex].SiteRep.DV.Location.lat),
					lon: parseFloat(json[dataIndex].SiteRep.DV.Location.lon)
				},
				location: {
					city: null,
					country: null,
					url: null,
					timeZone: null,
					distanceFrom: this.observationSites[dataIndex].dist
				},
				date: new Date(json[dataIndex].SiteRep.DV.dataDate),
				sunrise: times.sunrise,
				sunset: times.sunset,
				wind: {
					speed: null,
					degree: null
				},
				temperature: null,
				pressure: null,
				humidity: null,
				condition: this.ResolveCondition(observation?.W),
				forecasts: []
			};

			if (observation?.V != null) {
				weather.extra_field = {
					name: _("Visibility"),
					value: this.VisibilityToText(observation.V),
					type: "string"
				}
			}

			if (observation?.S != null) {
				weather.wind.speed = MPHtoMPS(parseFloat(observation.S));
			}
			if (observation?.D != null) {
				weather.wind.degree = CompassToDeg(observation.D);
			}
			if (observation?.T != null) {
				weather.temperature = CelsiusToKelvin(parseFloat(observation.T));
			}
			if (observation?.P != null) {
				weather.pressure = parseFloat(observation.P);
			}
			if (observation?.H != null) {
				weather.humidity = parseFloat(observation.H);
			}

			return weather;
		}
		catch (e) {
			Log.Instance.Error("Met UK Weather Parsing error: " + e);
			this.app.ShowError({ type: "soft", service: "met-uk", detail: "unusual payload", message: _("Failed to Process Current Weather Info") })
			return null;
		}
	};

	private ParseForecast(json: METPayload, self: MetUk): ForecastData[] {
		let forecasts: ForecastData[] = [];
		try {
			for (let i = 0; i < json.SiteRep.DV.Location.Period.length; i++) {
				let element = json.SiteRep.DV.Location.Period[i];
				if (!Array.isArray(element.Rep))
					continue;

				let day = element.Rep[0] as ForecastPayload;
				let night = element.Rep[1] as ForecastPayload;

				let forecast: ForecastData = {
					date: new Date(self.PartialToISOString(element.value)),
					temp_min: CelsiusToKelvin(parseFloat(night.Nm)),
					temp_max: CelsiusToKelvin(parseFloat(day.Dm)),
					condition: self.ResolveCondition(day.W),
				};
				forecasts.push(forecast);
			}
			return forecasts;
		}
		catch (e) {
			Log.Instance.Error("MET UK Forecast Parsing error: " + e);
			self.app.ShowError({ type: "soft", service: "met-uk", detail: "unusual payload", message: _("Failed to Process Forecast Info") })
			return null;
		}
	};

	private ParseHourlyForecast(json: METPayload, self: MetUk): HourlyForecastData[] {
		let forecasts: HourlyForecastData[] = [];
		try {
			for (let i = 0; i < json.SiteRep.DV.Location.Period.length; i++) {
				let day = json.SiteRep.DV.Location.Period[i];
				let date = new Date(self.PartialToISOString(day.value));
				if (!Array.isArray(day.Rep))
					continue;
					
				for (let index = 0; index < day.Rep.length; index++) {
					const hour = day.Rep[index] as ThreeHourPayload;
					let timestamp = new Date(date.getTime());
					timestamp.setHours(timestamp.getHours() + (parseInt(hour.$) / 60));
					let threshold = new Date();
					// Show the previous 3-hour forecast until it reaches the next one
					threshold.setHours(threshold.getHours() - 3);
					if (timestamp < threshold) continue;

					let forecast: HourlyForecastData = {
						date: timestamp,
						temp: CelsiusToKelvin(parseFloat(hour.T)),
						condition: self.ResolveCondition(hour.W),
						precipitation: {
							type: "rain",
							volume: null,
							chance: parseFloat(hour.Pp)
						}
					};
					forecasts.push(forecast);
				}
			}
			return forecasts;
		}
		catch (e) {
			Log.Instance.Error("MET UK Forecast Parsing error: " + e);
			self.app.ShowError({ type: "soft", service: "met-uk", detail: "unusual payload", message: _("Failed to Process Forecast Info") })
			return null;
		}
	}

	/** https://www.metoffice.gov.uk/services/data/datapoint/code-definitions */
	private VisibilityToText(dist: string): string {
		let distance = parseInt(dist);
		let unit = this.app.config.DistanceUnit;
		let stringFormat: any = {
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
			return `${_("Very good")} ${_("Between {smallerDistance}-{biggerDistance} {distanceUnit}", stringFormat)}`;
		}
	}

	private DistanceUnitFor(unit: DistanceUnits) {
		if (unit == "imperial") return _("mi");
		return _("km");
	}

	private SortObservationSites(observations: WeatherSite[]): WeatherSite[] {
		if (observations == null) return null;
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
	private MeshObservations(observations: METPayload[]): ObservationPayload {
		if (!observations) return null;
		if (observations.length == 0) return null;
		// Sometimes Location property is missing
		let result: ObservationPayload = this.GetLatestObservation(observations[0]?.SiteRep?.DV?.Location?.Period, new Date());
		if (observations.length == 1) return result;
		for (let index = 0; index < observations.length; index++) {
			if (observations[index]?.SiteRep?.DV?.Location?.Period == null) continue;
			let nextObservation = this.GetLatestObservation(observations[index].SiteRep.DV.Location.Period, new Date());
			if (result == null) result = nextObservation;
			let debugText =
				" Observation data missing, plugged in from ID " +
				observations[index].SiteRep.DV.Location.i + ", index " + index +
				", distance "
				+ Math.round(GetDistance(
					parseFloat(observations[index].SiteRep.DV.Location.lat),
					parseFloat(observations[index].SiteRep.DV.Location.lon),
					this.currentLoc.lat,
					this.currentLoc.lon
				))
				+ " metres";
			if (result?.V == null) {
				result.V = nextObservation?.V;
				Log.Instance.Debug("Visibility" + debugText);
			}
			if (result?.W == null) {
				result.W = nextObservation?.W;
				Log.Instance.Debug("Weather condition" + debugText);
			}
			if (result?.S == null) {
				result.S = nextObservation?.S;
				Log.Instance.Debug("Wind Speed" + debugText);
			}
			if (result?.D == null) {
				result.D = nextObservation?.D;
				Log.Instance.Debug("Wind degree" + debugText);
			}
			if (result?.T == null) {
				result.T = nextObservation?.T;
				Log.Instance.Debug("Temperature" + debugText);
			}
			if (result?.P == null) {
				result.P = nextObservation?.P;
				Log.Instance.Debug("Pressure" + debugText);
			}
			if (result?.H == null) {
				result.H = nextObservation?.H;
				Log.Instance.Debug("Humidity" + debugText);
			}
		}
		return result;
	}

	/**
	 * Obtains the latest observation from the data of past 24-hour observation periods
	 * @param observations 
	 * @param day 
	 */
	private GetLatestObservation(observations: Period[], day: Date): ObservationPayload {
		if (observations == null) return null;
		for (let index = 0; index < observations.length; index++) {
			const element = observations[index];
			let date = new Date(this.PartialToISOString(element.value));
			if (date.toLocaleDateString() != day.toLocaleDateString()) continue;
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

	private GetClosestSite(siteList: any, loc: LocationData): WeatherSite {
		let sites = siteList.Locations.Location as WeatherSite[];
		let closest = sites[0];
		closest.dist = GetDistance(parseFloat(closest.latitude), parseFloat(closest.longitude), loc.lat, loc.lon);
		for (let index = 0; index < sites.length; index++) {
			const element = sites[index];
			element.dist = GetDistance(parseFloat(element.latitude), parseFloat(element.longitude), loc.lat, loc.lon);
			if (element.dist < closest.dist) {
				closest = element;
			}
		}
		return closest;
	}

	private ResolveCondition(icon: string): Condition {
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

interface METPayload {
	SiteRep: {
		Wx: {
			Param: any[];
		},
		DV: {
			dataDate: string;
			type: string;
			Location: {
				i: string;
				lat: string;
				lon: string;
				name: string;
				country: string;
				continent: string;
				elevation: string;
				Period: Period[]
			}
		}
	}
}

interface Period {
	type: string;
	/** Date as ISO string */
	value: string;
	Rep: ObservationPayload[] | ObservationPayload | ForecastPayload[] | ThreeHourPayload[]
}

interface ObservationPayload {
	/** Wind Gust, mph? */
	G?: string;
	/** Wind direction, Compass? e.g. NW */
	D: string;
	/** Humidity, %? */
	H: string;
	/** Pressure, hpa? */
	P?: string;
	/** Wind speed, mph? */
	S: string;
	/** Temperature, C? */
	T: string;
	/** Visibility, m? */
	V?: string;
	/** Weather type, https://www.metoffice.gov.uk/services/data/datapoint/code-definitions */
	W?: string;
	/** Pressure tendency, Pa/s? */
	Pt?: string;
	/** Dew Point, C? */
	Dp: string;
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
