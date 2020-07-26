export {}; // Declaring as a Module

function importModule(path: string): any {
    if (typeof require !== 'undefined') {
      return require('./' + path);
    } else {
      if (!AppletDir) var AppletDir = imports.ui.appletManager.applets['weather@mockturtl'];
      return AppletDir[path];
    }
}

const UUID = "weather@mockturtl"
imports.gettext.bindtextdomain(UUID, imports.gi.GLib.get_home_dir() + "/.local/share/locale");
function _(str: string): string {
  return imports.gettext.dgettext(UUID, str)
}

var utils = importModule("utils");
var isCoordinate = utils.isCoordinate as (text: any) => boolean;
var weatherIconSafely = utils.weatherIconSafely as (code: BuiltinIcons[], icon_type: imports.gi.St.IconType) => BuiltinIcons;
var SunCalc = importModule("sunCalc").SunCalc;
var IsNight = utils.IsNight as (sunTimes: SunTimes, date?: Date) => boolean;
var CelsiusToKelvin = utils.CelsiusToKelvin as (celsius: number) => number;
var MPHtoMPS = utils.MPHtoMPS as (speed: number) => number;
var compassToDeg = utils.compassToDeg as (compass: string) => number;
var GetDistance = utils.GetDistance as (lat1: number, lon1: number, lat2: number, lon2: number) => number;
const get = utils.get as (p: string[], o: any) => any;
var MetreToUserUnits = utils.MetreToUserUnits as (m: number, distanceUnit: DistanceUnits) => number;

//////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////
///////////                                       ////////////
///////////                Weatherbit             ////////////
///////////                                       ////////////
//////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////

class MetUk implements WeatherProvider {

    //--------------------------------------------------------
    //  Properties
    //--------------------------------------------------------
	public readonly prettyName = "Met Office UK";
	public readonly name = "Met Office UK";
    public readonly maxForecastSupport = 5;
    public readonly website = "https://www.metoffice.gov.uk/";
	public readonly maxHourlyForecastSupport = 36;
	
	private sunCalc: any;

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
	private currentLoc: Location = null;
	/** In metres */
	private readonly MAX_STATION_DIST = 50000;

    constructor(_app: WeatherApplet) {
		this.app = _app;
		this.sunCalc = new SunCalc();
    }

    //--------------------------------------------------------
    //  Functions
    //--------------------------------------------------------
    public async GetWeather(newLoc: Location): Promise<WeatherData> {
		if (newLoc == null) return null;
		
		// Get closest sites
		if (this.currentLoc == null || this.currentLoc.text != newLoc.text || this.forecastSite == null || this.observationSites == null || this.observationSites.length == 0) {
			this.app.log.Print("Downloading new site data");
			this.currentLoc = newLoc;

			let forecastSite = await this.GetClosestForecastSite(newLoc);
			if (forecastSite == null) return null;

			let observationSites = await this.GetObservationSitesInRange(newLoc, this.MAX_STATION_DIST);
			if (observationSites == null) return null;

			this.forecastSite = forecastSite;
			this.observationSites = observationSites;
		}
		else {
			this.app.log.Debug("Site data downloading skipped");
		}

		// Check if in country
		if (this.observationSites.length == 0 || this.forecastSite.dist > 100000) {
			// TODO: Validate that this does not happen with uk locations
			this.app.log.Error("User is probably not in UK, aborting");
			this.app.HandleError({
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

	private async GetClosestForecastSite(loc: Location): Promise<WeatherSite> {
		let forecastSitelist = null;
		try {
			forecastSitelist = await this.app.LoadJsonAsync(this.baseUrl + this.forecastPrefix + this.sitesUrl + "?" + this.key);
			return this.GetClosestSite(forecastSitelist, loc);
		}
		catch(e) {
			this.app.log.Error("Failed to get sitelist, error: " + JSON.stringify(e, null, 2));
			this.app.HandleError({
				type: "soft",
				userError: true,
				detail: "no network response",
				service: "met-uk",
				message: _("Unexpected response from API")
			})
			return null;
		}
	}

	private async GetObservationSitesInRange(loc: Location, range: number): Promise<WeatherSite[]> {
		let observationSiteList = null;
		try {
			observationSiteList = await this.app.LoadJsonAsync(this.baseUrl + this.currentPrefix + this.sitesUrl + "?" + this.key);
		}
		catch(e) {
			this.app.log.Error("Failed to get sitelist, error: " + JSON.stringify(e, null, 2));
			this.app.HandleError({
				type: "soft",
				userError: true,
				detail: "no network response",
				service: "met-uk",
				message: _("Unexpected response from API")
			})
			return null;
		}

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
		this.app.log.Debug("Observation sites found: " + JSON.stringify(observationSites, null, 2));
		return observationSites;
	}

	private async GetObservationData(observationSites: WeatherSite[]) {
		let observations: METPayload[] = [];
		for (let index = 0; index < observationSites.length; index++) {
			const element = observationSites[index];
			try {
				this.app.log.Debug("Getting observation data from station: " + element.id);
				observations.push(await this.app.LoadJsonAsync(this.baseUrl + this.currentPrefix + element.id + "?res=hourly&" + this.key));
			}
			catch {
				this.app.HandleError({
					type: "soft",
					userError: true,
					detail: "no network response",
					service: "us-weather",
					message: _("Unexpected response from API")
				})
				this.app.log.Debug("Failed to get observations from " + element.id);
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
        let json;
        if (query != null) {
            this.app.log.Debug("Query: " + query);
            try {
                json = await this.app.LoadJsonAsync(query);
            }
            catch(e) {
              	this.app.HandleHTTPError("met-uk", e, this.app, null);
            	return null;
            }

            if (json == null) {
				this.app.HandleError({type: "soft", detail: "no api response", service: "met-uk"});
				return null;                 
            }

            return ParseFunction(json, this);
        }
        else {
          	return null;
        }       
	};

    private ParseCurrent(json: METPayload[]): WeatherData {
		let observation = this.MeshObservations(json);
		if (!observation) {
			return null;
		}
        let times = this.sunCalc.getTimes(new Date(), parseFloat(json[0].SiteRep.DV.Location.lat), parseFloat(json[0].SiteRep.DV.Location.lon), parseFloat(json[0].SiteRep.DV.Location.elevation));
        try {
			let weather: WeatherData = {
				coord: {
					lat: parseFloat(json[0].SiteRep.DV.Location.lat),
					lon: parseFloat(json[0].SiteRep.DV.Location.lon)
				},
				location: {
					city: null,
					country: null,
					url: null,
					timeZone: null,
					distanceFrom: this.observationSites[0].dist
				},
					date: new Date(json[0].SiteRep.DV.dataDate),
					sunrise: times.sunrise,
					sunset: times.sunset,
				wind: {
					speed: null,
					degree: null
				},
				temperature: null,
				pressure: null,
				humidity: null,
				condition: this.ResolveCondition(get(["W"], observation)),
				forecasts: []
			};

		  	if (get(["V"], observation) != null) {
				weather.extra_field = {
					name: _("Visibility"),
					value: this.VisibilityToText(observation.V),
					type: "string"
				}
			}

			if (get(["S"], observation) != null) {
				weather.wind.speed = MPHtoMPS(parseFloat(observation.S));
			}
			if (get(["D"], observation) != null) {
				weather.wind.degree = compassToDeg(observation.D);
			}
			if (get(["T"], observation) != null) {
				weather.temperature = CelsiusToKelvin(parseFloat(observation.T));
			}
			if (get(["P"], observation) != null) {
				weather.pressure = parseFloat(observation.P);
			}
			if (get(["H"], observation) != null) {
				weather.humidity = parseFloat(observation.H);
			}
          
        	return weather; 
        }
        catch(e) { 
			this.app.log.Error("Met UK Weather Parsing error: " + e);
			this.app.HandleError({type: "soft", service: "met-uk", detail: "unusual payload", message: _("Failed to Process Current Weather Info")})
          	return null; 
        }
	};

    private ParseForecast(json: METPayload, self: MetUk): ForecastData[] {
      let forecasts: ForecastData[] = [];
      try {
        for (let i = 0; i < json.SiteRep.DV.Location.Period.length; i++) {
		  let element = json.SiteRep.DV.Location.Period[i];
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
      catch(e) {
          self.app.log.Error("MET UK Forecast Parsing error: " + e);
          self.app.HandleError({type: "soft", service: "met-uk", detail: "unusual payload", message: _("Failed to Process Forecast Info")})
          return null; 
      }
	};

	private ParseHourlyForecast(json: METPayload, self: MetUk): HourlyForecastData[] { 
		let forecasts: HourlyForecastData[] = [];
		try {
			for (let i = 0; i < json.SiteRep.DV.Location.Period.length; i++) {
				let day = json.SiteRep.DV.Location.Period[i];
				let date = new Date(self.PartialToISOString(day.value));
				for (let index = 0; index < day.Rep.length; index++) {
					const hour = day.Rep[index] as ThreeHourPayload;
					let timestamp = new Date(date.getTime());
					timestamp.setHours(timestamp.getHours() + (parseInt(hour.$)/60));
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
		catch(e) {
			self.app.log.Error("MET UK Forecast Parsing error: " + e);
			self.app.HandleError({type: "soft", service: "met-uk", detail: "unusual payload", message: _("Failed to Process Forecast Info")})
			return null; 
		}
	}

	/** https://www.metoffice.gov.uk/services/data/datapoint/code-definitions */
	private VisibilityToText(dist: string): string {
		let distance = parseInt(dist);
		let unit = this.app.config._distanceUnit;
		if (distance < 1000) return _("Very poor - Less than") + " " + MetreToUserUnits(1000, unit) + this.DistanceUnitFor(unit);
		if (distance < 4000) return _("Poor - Between") + " " + MetreToUserUnits(1000, unit) + "-" +  MetreToUserUnits(4000, unit) + " " + this.DistanceUnitFor(unit);
		if (distance < 10000) return _("Moderate - Between") + " " + MetreToUserUnits(4000, unit) + "-" +  MetreToUserUnits(10000, unit) + " " + this.DistanceUnitFor(unit);
		if (distance < 20000) return _("Good - Between") + " " + MetreToUserUnits(10000, unit) + "-" +  MetreToUserUnits(20000, unit) + " " + this.DistanceUnitFor(unit);
		if (distance < 40000) return _("Very good - Between") + " " + MetreToUserUnits(20000, unit) + "-" +  MetreToUserUnits(40000, unit) + " " + this.DistanceUnitFor(unit);
		return _("Excellent - More than") + " " + MetreToUserUnits(40000, unit) + " " + this.DistanceUnitFor(unit);
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
		let result: ObservationPayload = this.GetLatestObservation(get(["SiteRep", "DV", "Location", "Period"], observations[0]), new Date());
		if (observations.length == 1) return result;
		for (let index = 0; index < observations.length; index++) {
			if (get(["SiteRep", "DV", "Location", "Period"], observations[index]) == null) continue;
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
			if (get(["V"], result) == null) {
				result.V = get(["V"], nextObservation);
				this.app.log.Debug("Visibility" + debugText);
			}
			if (get(["W"], result) == null) {
				result.W = get(["W"], nextObservation);
				this.app.log.Debug("Weather condition" + debugText);
			}
			if (get(["S"], result) == null) {
				result.S = get(["S"], nextObservation);
				this.app.log.Debug("Wind Speed" + debugText);
			}
			if (get(["D"], result) == null) {
				result.D = get(["D"], nextObservation);
				this.app.log.Debug("Wind degree" + debugText);
			}
			if (get(["T"], result) == null) {
				result.T = get(["T"], nextObservation);
				this.app.log.Debug("Temperature" + debugText);
			}
			if (get(["P"], result) == null) {
				result.P = get(["P"], nextObservation);
				this.app.log.Debug("Pressure" + debugText);
			}
			if (get(["H"], result) == null) {
				result.H = get(["H"], nextObservation);
				this.app.log.Debug("Humidity" + debugText);
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
			return element.Rep[element.Rep.length - 1] as ObservationPayload;
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

	private GetClosestSite(siteList: any, loc: Location): WeatherSite {
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
		let iconType = this.app.config.IconType();
        switch (icon) {
			case "NA":
				return {
					main: _("Unknown"),
					description: _("Unknown"),
					customIcon: "cloud-refresh-symbolic",
					icon: weatherIconSafely(["weather-severe-alert"], iconType)
				}
			case "0": // Clear night
				return {
					main: _("Clear"),
					description: _("Clear"),
					customIcon: "night-clear-symbolic",
					icon: weatherIconSafely(["weather-clear-night", "weather-severe-alert"], iconType)
				}
			case "1": // Sunny day
				return {
					main: _("Sunny"),
					description: _("Sunny"),
					customIcon: "day-sunny-symbolic",
					icon: weatherIconSafely(["weather-clear", "weather-severe-alert"], iconType)
				}
			case "2": // Partly cloudy (night)
				return {
					main: _("Partly Cloudy"),
					description: _("Partly Cloudy"),
					customIcon: "night-alt-cloudy-symbolic",
					icon: weatherIconSafely(["weather-clouds-night", "weather-overcast", "weather-severe-alert"], iconType)
				}
			case "3": // Partly cloudy (day)
				return {
					main: _("Partly Cloudy"),
					description: _("Partly Cloudy"),
					customIcon: "day-cloudy-symbolic",
					icon: weatherIconSafely(["weather-clouds", "weather-overcast", "weather-severe-alert"], iconType)
				}
			case "4": // Not used - really?
				return {
					main: _("Unknown"),
					description: _("Unknown"),
					customIcon: "cloud-refresh-symbolic",
					icon: weatherIconSafely(["weather-severe-alert"], iconType)
				}
			case "5": // Mist
				return {
					main: _("Mist"),
					description: _("Mist"),
					customIcon: "fog-symbolic",
					icon: weatherIconSafely(["weather-fog", "weather-severe-alert"], iconType)
				}
			case "6": // Fog
				return {
					main: _("Fog"),
					description: _("Fog"),
					customIcon: "fog-symbolic",
					icon: weatherIconSafely(["weather-fog", "weather-severe-alert"], iconType)
				}
			case "7": // Cloudy
				return {
					main: _("Cloudy"),
					description: _("Cloudy"),
					customIcon: "cloud-symbolic",
					icon: weatherIconSafely(["weather-overcast", "weather-many-clouds", "weather-severe-alert"], iconType)
				}
			case "8":
				return { // Overcast
					main: _("Overcast"),
					description: _("Overcast"),
					customIcon: "cloudy-symbolic",
					icon: weatherIconSafely(["weather-overcast", "weather-many-clouds", "weather-severe-alert"], iconType)
				}
			case "9": // Light rain shower (night)
				return {
					main: _("Light Rain"),
					description: _("Light rain shower"),
					customIcon: "night-alt-showers-symbolic",
					icon: weatherIconSafely(["weather-showers-scattered-night", "weather-showers-night", "weather-showers-scattered", "weather-showers", "weather-freezing-rain", "weather-severe-alert"], iconType)
				}
			case "10": // Light rain shower (day)
				return {
					main: _("Light Rain"),
					description: _("Light rain shower"),
					customIcon: "day-showers-symbolic",
					icon: weatherIconSafely(["weather-showers-scattered-day", "weather-showers-day", "weather-showers-scattered", "weather-showers", "weather-freezing-rain", "weather-severe-alert"], iconType)
				}
			case "11": // Drizzle
				return {
					main: _("Drizzle"),
					description: _("Drizzle"),
					customIcon: "showers-symbolic",
					icon: weatherIconSafely(["weather-showers-scattered", "weather-showers", "weather-rain", "weather-freezing-rain", "weather-severe-alert"], iconType)
				}
			case "12": // Light rain
				return {
					main: _("Light Rain"),
					description: _("Light rain"),
					customIcon: "showers-symbolic",
					icon: weatherIconSafely(["weather-showers-scattered", "weather-showers", "weather-rain", "weather-freezing-rain", "weather-severe-alert"], iconType)
				}
			case "13": // Heavy rain shower (night)
				return {
					main: _("Heavy Rain"),
					description: _("Heavy rain shower"),
					customIcon: "night-alt-rain-symbolic",
					icon: weatherIconSafely(["weather-showers-night", "weather-showers", "weather-showers-scattered", "weather-severe-alert"], iconType)
				}
			case "14": // Heavy rain shower (day)
				return {
					main: _("Heavy Rain"),
					description: _("Heavy rain shower"),
					customIcon: "day-rain-symbolic",
					icon: weatherIconSafely(["weather-showers-day", "weather-showers", "weather-showers-scattered", "weather-severe-alert"], iconType)
				}
			case "15": // Heavy rain
				return {
					main: _("Heavy Rain"),
					description: _("Heavy Rain"),
					customIcon: "rain-symbolic",
					icon: weatherIconSafely(["weather-showers", "weather-showers-scattered", "weather-severe-alert"], iconType)
				}
			case "16": // Sleet shower (night)
				return {
					main: _("Sleet"),
					description: _("Sleet shower"),
					customIcon: "night-alt-rain-mix-symbolic",
					icon: weatherIconSafely(["weather-showers-night", "weather-showers", "weather-showers-scattered", "weather-severe-alert"], iconType)
				}
			case "17": // Sleet shower (day)
				return {
					main: _("Sleet"),
					description: _("Sleet shower"),
					customIcon: "day-rain-mix-symbolic",
					icon: weatherIconSafely(["weather-showers-day", "weather-showers", "weather-showers-scattered", "weather-severe-alert"], iconType)
				}
			case "18": // Sleet
				return {
					main: _("Sleet"),
					description: _("Sleet"),
					customIcon: "rain-mix-symbolic",
					icon: weatherIconSafely(["weather-showers", "weather-showers-scattered", "weather-severe-alert"], iconType)
				}
			case "19": // Hail shower (night)
				return {
					main: _("Hail"),
					description: _("Hail shower"),
					customIcon: "night-alt-hail-symbolic",
					icon: weatherIconSafely(["weather-showers-night", "weather-showers", "weather-showers-scattered", "weather-severe-alert"], iconType)
				}
			case "20": // Hail shower (day)
				return {
					main: _("Hail"),
					description: _("Hail shower"),
					customIcon: "day-hail-symbolic",
					icon: weatherIconSafely(["weather-showers-day", "weather-showers", "weather-showers-scattered", "weather-severe-alert"], iconType)
				}
			case "21": // Hail
				return {
					main: _("Hail"),
					description: _("Hail"),
					customIcon: "hail-symbolic",
					icon: weatherIconSafely(["weather-showers", "weather-showers-scattered", "weather-severe-alert"], iconType)
				}
			case "22": // Light snow shower (night)
				return {
					main: _("Light Snow"),
					description: _("Light snow shower"),
					customIcon: "night-alt-snow-symbolic",
					icon: weatherIconSafely(["weather-snow-scattered", "weather-snow", "weather-severe-alert"], iconType)
				}
			case "23": // Light snow shower (day)
				return {
					main: _("Light Snow"),
					description: _("Light snow shower"),
					customIcon: "day-snow-symbolic",
					icon: weatherIconSafely(["weather-snow-scattered", "weather-snow", "weather-severe-alert"], iconType)
				}
			case "24": // Light snow
				return {
					main: _("Light Snow"),
					description: _("Light snow"),
					customIcon: "snow-symbolic",
					icon: weatherIconSafely(["weather-snow-scattered", "weather-snow", "weather-severe-alert"], iconType)
				}
			case "25": // Heavy snow shower (night)
				return {
					main: _("Heavy Snow"),
					description: _("Heavy snow shower"),
					customIcon: "night-alt-snow-symbolic",
					icon: weatherIconSafely(["weather-snow", "weather-snow-scattered", "weather-severe-alert"], iconType)
				}
			case "26": // 	Heavy snow shower (day)
				return {
					main: _("Heavy Snow"),
					description: _("Heavy snow shower"),
					customIcon: "day-snow-symbolic",
					icon: weatherIconSafely(["weather-snow", "weather-snow-scattered", "weather-severe-alert"], iconType)
				}
			case "27": // Heavy snow
				return {
					main: _("Heavy Snow"),
					description: _("Heavy snow"),
					customIcon: "snow-symbolic",
					icon: weatherIconSafely(["weather-snow", "weather-snow-scattered", "weather-severe-alert"], iconType)
				}
			case "28": // Thunder shower (night)
				return {
					main: _("Thunder"),
					description: _("Thunder shower"),
					customIcon: "day-storm-showers-symbolic",
					icon: weatherIconSafely(["weather-storm", "weather-severe-alert"], iconType)
				}
			case "29": // Thunder shower (day)
				return {
					main: _("Thunder"),
					description: _("Thunder shower"),
					customIcon: "night-alt-storm-showers-symbolic",
					icon: weatherIconSafely(["weather-storm", "weather-severe-alert"], iconType)
				}
			case "30": // Thunder
				return {
					main: _("Thunder"),
					description: _("Thunder"),
					customIcon: "thunderstorm-symbolic",
					icon: weatherIconSafely(["weather-storm", "weather-severe-alert"], iconType)
				}
            default:
              return {
				  main: _("Unknown"),
				  description: _("Unknown"),
				  customIcon: "cloud-refresh-symbolic",
				  icon: weatherIconSafely(["weather-severe-alert"], iconType)
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
	Rep: ObservationPayload[] | ForecastPayload[] | ThreeHourPayload[]
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
