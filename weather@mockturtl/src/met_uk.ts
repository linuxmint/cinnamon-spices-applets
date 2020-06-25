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
var GetDistance = utils.GetDistance as (lat1: number, lon1: number, lat2: number, lon2: number) => number

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
	private hourlyAccess = true;
	private forecastSite: WeatherSite = null;
	private observationSite: WeatherSite = null;

    constructor(_app: WeatherApplet) {
		this.app = _app;
		this.sunCalc = new SunCalc();
    }

    //--------------------------------------------------------
    //  Functions
    //--------------------------------------------------------
    public async GetWeather(): Promise<WeatherData> {
		if (!isCoordinate(this.app.config._location)) {
			this.app.HandleError({
				detail: "bad location format",
				type: "hard",
				userError: true,
				service: "met-uk",
				message: "Please make sure location is in the correct format"
			})
			this.app.log.Error("MET UK - Location is not coordinate, aborting")
			return null;
		}
		
		// Get closest sites
		let forecastSitelist = await this.app.LoadJsonAsync(this.baseUrl + this.forecastPrefix + this.sitesUrl + "?" + this.key);
		let currentSitelist = await this.app.LoadJsonAsync(this.baseUrl + this.currentPrefix + this.sitesUrl + "?" + this.key)
		this.forecastSite = this.GetClosestSite(forecastSitelist, this.app.config._location);
		this.observationSite = this.GetClosestSite(currentSitelist, this.app.config._location);
		this.app.log.Debug("Forecast site found: " + JSON.stringify(this.forecastSite, null, 2))
		this.app.log.Debug("Observation site found: " + JSON.stringify(this.observationSite, null, 2))
		if (this.forecastSite.dist > 100000 || this.observationSite.dist > 100000) {
			// TODO: Validate that this does not happen with uk locations
			this.app.log.Error("User is probably not in UK, aborting");
			this.app.HandleError({
				type: "hard",
				userError: true,
				detail: "location not found",
				message: "MET Office UK only covers the UK, please make sure your location is in the country",
				service: "met-uk"
			})
			return null;
		}

		let forecastPromise = this.GetData(this.baseUrl + this.forecastPrefix + this.forecastSite.id + this.dailyUrl + "&" + this.key, this.ParseForecast) as Promise<ForecastData[]>;
		let hourlyPromise = null;
		if (!!this.hourlyAccess) hourlyPromise = this.GetData(this.baseUrl + this.forecastPrefix + this.forecastSite.id + this.threeHourlyUrl + "&" + this.key, this.ParseHourlyForecast) as Promise<HourlyForecastData[]>;
		let currentResult = await this.GetData(this.baseUrl + this.currentPrefix + this.observationSite.id + "?res=hourly&" + this.key, this.ParseCurrent) as WeatherData;
		if (!currentResult) return null;
		
		let forecastResult = await forecastPromise;
		currentResult.forecasts = (!forecastResult) ? [] : forecastResult;
		let hourlyResult = await hourlyPromise;
		currentResult.hourlyForecasts = (!hourlyResult) ? [] : hourlyResult;
        return currentResult;
	};

    // A function as a function parameter 2 levels deep does not know
    // about the top level object information, has to pass it in as a paramater
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

    private ParseCurrent(json: METPayload, self: MetUk): WeatherData {
		let timestamp = new Date(json.SiteRep.DV.dataDate);
		let observation = self.GetLatestObservation(json.SiteRep.DV.Location.Period, timestamp);
		if (!observation) {
			// TODO: get from 3-hourly if not available
			return null;
		}
        let times = self.sunCalc.getTimes(new Date(), parseFloat(json.SiteRep.DV.Location.lat), parseFloat(json.SiteRep.DV.Location.lon), parseFloat(json.SiteRep.DV.Location.elevation));
        try {
          let weather: WeatherData = {
            coord: {
              lat: parseFloat(json.SiteRep.DV.Location.lat),
              lon: parseFloat(json.SiteRep.DV.Location.lon)
            },
            location: {
              city: null,
              country: null,
              url: null,
              timeZone: null
            },
            date: timestamp,
            sunrise: times.sunrise,
            sunset: times.sunset,
            wind: {
              speed: MPHtoMPS(parseFloat(observation.S)),
              degree: compassToDeg(observation.D)
            },
            temperature: CelsiusToKelvin(parseFloat(observation.T)),
            pressure: parseFloat(observation.P),
            humidity: parseFloat(observation.H),
            condition: self.ResolveCondition(observation.W),
            extra_field: {
              name: _("Visibility"),
              value: self.VisibilityToText(observation.V),
              type: "string"
            },
            forecasts: []
          };
          
          return weather; 
        }
        catch(e) { 
          self.app.log.Error("Met UK Weather Parsing error: " + e);
          self.app.HandleError({type: "soft", service: "met-uk", detail: "unusal payload", message: _("Failed to Process Current Weather Info")})
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
          self.app.HandleError({type: "soft", service: "met-uk", detail: "unusal payload", message: _("Failed to Process Forecast Info")})
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
					if (timestamp < new Date()) continue;

					let forecast: HourlyForecastData = {          
						date: timestamp,
						temp: CelsiusToKelvin(parseFloat(hour.T)),
						condition: self.ResolveCondition(hour.W),
						precipation: {
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
			self.app.HandleError({type: "soft", service: "met-uk", detail: "unusal payload", message: _("Failed to Process Forecast Info")})
			return null; 
		}
	}

	/** https://www.metoffice.gov.uk/services/data/datapoint/code-definitions */
	private VisibilityToText(dist: string): string {
		let distance = parseInt(dist);
		if (distance < 1000) return _("Very poor - Less than 1 km");
		if (distance < 4000) return _("Poor - Between 1-4 km");
		if (distance < 10000) return _("Moderate - Between 4-10 km");
		if (distance < 20000) return _("Good - Between 10-20 km");
		if (distance < 40000) return _("Very good - Between 20-40 km");
		return _("Excellent - More than 40 km");
		
	}

	private GetLatestObservation(observations: Period[], day: Date): ObservationPayload {
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

	private GetClosestSite(siteList: any, loc: string): WeatherSite {
		let sites = siteList.Locations.Location as WeatherSite[];
		let latlong = loc.split(","); 
		let closest = sites[0];
		closest.dist = GetDistance(parseFloat(closest.latitude), parseFloat(closest.longitude), parseFloat(latlong[0]), parseFloat(latlong[1]));
		for (let index = 0; index < sites.length; index++) {
			const element = sites[index];
			element.dist = GetDistance(parseFloat(element.latitude), parseFloat(element.longitude), parseFloat(latlong[0]), parseFloat(latlong[1]));
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
					description: _("UnThunderknown"),
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
	P: string;
	/** Wind speed, mph? */
	S: string;
	/** Temperature, C? */
	T: string;
	/** Visibility, m? */
	V: string;
	/** Weather type, https://www.metoffice.gov.uk/services/data/datapoint/code-definitions */
	W: string;
	/** Pressure tendency, Pa/s? */
	Pt: string;
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
