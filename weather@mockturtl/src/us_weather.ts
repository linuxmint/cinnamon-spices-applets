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
var FahrenheitToKelvin = utils.FahrenheitToKelvin as (fahr: number) => number;
var KPHtoMPS = utils.MPHtoMPS as (speed: number) => number;
var compassToDeg = utils.compassToDeg as (compass: string) => number;
var GetDistance = utils.GetDistance as (lat1: number, lon1: number, lat2: number, lon2: number) => number

//////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////
///////////                                       ////////////
///////////                US Weather             ////////////
///////////                                       ////////////
//////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////

class USWeather implements WeatherProvider {

    //--------------------------------------------------------
    //  Properties
    //--------------------------------------------------------
	public readonly prettyName = "US Weather";
	public readonly name = "US Weather";
    public readonly maxForecastSupport = 7;
    public readonly website = "https://www.metoffice.gov.uk/";
	public readonly maxHourlyForecastSupport = 156;
	
	private sunCalc: any;

	private sitesUrl = "https://api.weather.gov/points/";

	private app: WeatherApplet;
	private grid: GridPayload = null;
	/** In metres */
	private readonly MAX_STATION_DIST = 50000;
	private stations: StationPayload[] = null;
	private previousLoc: string = null;

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

		if (!this.grid || !this.stations || this.previousLoc != this.app.config._location) {
			this.previousLoc = this.app.config._location;
			let siteData = await this.app.LoadJsonAsync(this.sitesUrl + this.app.config._location) as GridPayload;
			//TODO: Validate site
			//global.log(siteData);
			this.grid = siteData;
			let stations = await this.app.LoadJsonAsync(this.grid.properties.observationStations) as StationsPayload;
			//  TODO: Validate stations?
			this.stations = stations.features;
		}

		let observations = [];
		for (let index = 0; index < this.stations.length; index++) {
			const element = this.stations[index];
			let latlong = this.app.config._location.split(",");
			element.dist = GetDistance(element.geometry.coordinates[1], element.geometry.coordinates[0], parseFloat(latlong[0]), parseFloat(latlong[1]));
			if (element.dist > this.MAX_STATION_DIST) break;
			try {
				this.app.log.Debug("Observation query is: " + this.stations[index].id + "/observations/latest")
				observations.push(await this.app.LoadJsonAsync(this.stations[index].id + "/observations/latest"))
			}
			catch {
				this.app.log.Debug("Failed to get observations from " + this.stations[index].id);
			}
		}
		
		let hourlyForecastPromise = this.app.LoadJsonAsync(this.grid.properties.forecastHourly) as Promise<ForecastsPayload>;
		let forecastPromise = this.app.LoadJsonAsync(this.grid.properties.forecast) as Promise<ForecastsPayload>;

		let hourly = await hourlyForecastPromise;
		let weather = this.ParseCurrent(observations as any[], hourly);
		weather.forecasts = this.ParseForecast(await forecastPromise);
		
		

		/*let forecastPromise = this.GetData(this.baseUrl + this.forecastPrefix + this.forecastSite.id + this.dailyUrl + "&" + this.key, this.ParseForecast) as Promise<ForecastData[]>;
		let hourlyPromise = null;
		if (!!this.hourlyAccess) hourlyPromise = this.GetData(this.baseUrl + this.forecastPrefix + this.forecastSite.id + this.threeHourlyUrl + "&" + this.key, this.ParseHourlyForecast) as Promise<HourlyForecastData[]>;
		let currentResult = await this.GetData(this.baseUrl + this.currentPrefix + this.observationSite.id + "?res=hourly&" + this.key, this.ParseCurrent) as WeatherData;
		if (!currentResult) return null;
		
		let forecastResult = await forecastPromise;
		currentResult.forecasts = (!forecastResult) ? [] : forecastResult;
		let hourlyResult = await hourlyPromise;
		currentResult.hourlyForecasts = (!hourlyResult) ? [] : hourlyResult;
		return currentResult;*/
		return weather;
	};

	/** Observation data is a bit spotty, so we mesh the nearest
	 * stations data in 50km radius
	 */
	private MeshObservationData(observations: ObservationPayload[]): ObservationPayload {
		if (observations.length < 1) return null;
		let result = observations[0];
		for (let index = 1; index < observations.length; index++) {
			const element = observations[index];
			if (result.properties.icon == null) {
				result.properties.icon = element.properties.icon;
				result.properties.textDescription = element.properties.textDescription;
			}
			if (result.properties.temperature.value == null) result.properties.temperature.value =element.properties.temperature.value;
			if (result.properties.windSpeed.value == null) result.properties.windSpeed.value = element.properties.windSpeed.value;
			if (result.properties.windDirection.value == null) result.properties.windDirection.value = element.properties.windDirection.value;
			if (result.properties.barometricPressure.value == null) result.properties.barometricPressure.value = element.properties.barometricPressure.value;
			if (result.properties.relativeHumidity.value == null) result.properties.relativeHumidity.value = element.properties.relativeHumidity.value;
			if (result.properties.windChill.value == null) result.properties.windChill.value = element.properties.windChill.value;
			if (result.properties.visibility.value == null) result.properties.visibility.value = element.properties.visibility.value;
		}
		return result;
	}

    private ParseCurrent(json: ObservationPayload[], hourly: ForecastsPayload): WeatherData {
		if (json.length == 0) {
			this.app.log.Error("No observation stations/data are available");
			return null;
		}
		let observation = this.MeshObservationData(json);
		let timestamp = new Date(observation.properties.timestamp);
        let times = this.sunCalc.getTimes(new Date(), observation.geometry.coordinates[1], observation.geometry.coordinates[0], observation.properties.elevation.value);
        try {
			let weather: WeatherData = {
				coord: {
					lat: observation.geometry.coordinates[1],
					lon: observation.geometry.coordinates[0]
				},
				location: {
					city: /*this.stations[0].properties.name*/ null,
					country: /*"USA"*/null,
					url: null,
					timeZone: this.stations[0].properties.timeZone
				},
				date: timestamp,
				sunrise: times.sunrise,
				sunset: times.sunset,
				wind: {
					speed: KPHtoMPS(observation.properties.windSpeed.value),
					degree: observation.properties.windDirection.value
				},
				temperature: CelsiusToKelvin(observation.properties.temperature.value),
				pressure: observation.properties.barometricPressure.value / 100, // from Pa to hPa
				humidity: observation.properties.relativeHumidity.value,
				condition: this.ResolveCondition(observation.properties.icon, IsNight(times)),
				forecasts: []
			};
			
			if (observation.properties.windChill.value != null) {
					weather.extra_field = {
						name: _("Feels Like"),
						value: CelsiusToKelvin(observation.properties.windChill.value),
						type: "temperature"
					};
			}
			if (weather.condition == null) {
				weather.condition = this.ResolveCondition(hourly.properties.periods[0].icon);
			}
			return weather; 
		}
		catch(e) { 
			this.app.log.Error("US Weather Parsing error: " + e);
			this.app.HandleError({type: "soft", service: "us-weather", detail: "unusal payload", message: _("Failed to Process Current Weather Info")})
			return null; 
		}
	};
	
    private ParseForecast(json: ForecastsPayload): ForecastData[] {
      let forecasts: ForecastData[] = [];
      try {
        for (let i = 0; i < json.properties.periods.length; i+=2) {
		  let day = json.properties.periods[i];
		  let night = json.properties.periods[i + 1];
          let forecast: ForecastData = {          
              date: new Date(day.startTime),
              temp_min: FahrenheitToKelvin(night.temperature),
              temp_max: FahrenheitToKelvin(day.temperature),
              condition: this.ResolveCondition(day.icon),
		  };
          forecasts.push(forecast);         
        }
        return forecasts;
      }
      catch(e) {
          this.app.log.Error("MET UK Forecast Parsing error: " + e);
          this.app.HandleError({type: "soft", service: "met-uk", detail: "unusal payload", message: _("Failed to Process Forecast Info")})
          return null; 
	  }
	};

	private ParseHourlyForecast(json: any, self: USWeather): HourlyForecastData[] { 
		let forecasts: HourlyForecastData[] = [];
		try {
			for (let i = 0; i < json.SiteRep.DV.Location.Period.length; i++) {
				/*let day = json.SiteRep.DV.Location.Period[i];
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
				}  */
			}
			return forecasts;
		}
		catch(e) {
			self.app.log.Error("MET UK Forecast Parsing error: " + e);
			self.app.HandleError({type: "soft", service: "met-uk", detail: "unusal payload", message: _("Failed to Process Forecast Info")})
			return null; 
		}
	}

	/**
	 * https://api.weather.gov/icons
	 * @param icon 
	 * @param isNight 
	 */
    private ResolveCondition(icon: string, isNight: boolean = false): Condition {
		if (icon == null) return null;
		let code = icon.match(/(?!\/)[a-z_]+(?=\?)/);
		let iconType = this.app.config.IconType();
        switch (code[0]) {
			case "skc": // Fair/clear
				return {
					main: _("Clear"),
					description: _("Clear"),
					customIcon: (isNight) ? "night-clear-symbolic" : "day-sunny-symbolic",
					icon: weatherIconSafely(["weather-severe-alert"], iconType)
				}
			case "few": // A few clouds
				return {
					main: _("Few Clouds"),
					description: _("Few clouds"),
					customIcon: (isNight) ? "night-alt-cloudy-symbolic" : "day-cloudy-symbolic",
					icon: weatherIconSafely(["weather-clear-night", "weather-severe-alert"], iconType)
				}
			case "sct": // Partly cloudy
				return {
					main: _("Partly Cloudy"),
					description: _("Partly cloudy"),
					customIcon: (isNight) ? "night-alt-cloudy-symbolic" : "day-cloudy-symbolic",
					icon: weatherIconSafely(["weather-clear", "weather-severe-alert"], iconType)
				}
			case "bkn": // Mostly cloudy
				return {
					main: _("Mostly Cloudy"),
					description: _("Mostly cloudy"),
					customIcon: (isNight) ? "night-alt-cloudy-symbolic" : "day-cloudy-symbolic",
					icon: weatherIconSafely(["weather-clouds-night", "weather-overcast", "weather-severe-alert"], iconType)
				}
			case "ovc": // Overcast
				return {
					main: _("Overcast"),
					description: _("Overcast"),
					customIcon: "cloudy-symbolic",
					icon: weatherIconSafely(["weather-clouds", "weather-overcast", "weather-severe-alert"], iconType)
				}
				// TODO: WEATHER
			case "wind_skc": // Fair/clear and windy
				return {
					main: _("Unknown"),
					description: _("Unknown"),
					customIcon: "cloud-refresh-symbolic",
					icon: weatherIconSafely(["weather-severe-alert"], iconType)
				}
			case "wind_few": // A few clouds and windy
				return {
					main: _("Mist"),
					description: _("Mist"),
					customIcon: "fog-symbolic",
					icon: weatherIconSafely(["weather-fog", "weather-severe-alert"], iconType)
				}
			case "wind_sct": // Partly cloudy and windy
				return {
					main: _("Fog"),
					description: _("Fog"),
					customIcon: "fog-symbolic",
					icon: weatherIconSafely(["weather-fog", "weather-severe-alert"], iconType)
				}
			case "wind_bkn": // Mostly cloudy and windy
				return {
					main: _("Cloudy"),
					description: _("Cloudy"),
					customIcon: "cloud-symbolic",
					icon: weatherIconSafely(["weather-overcast", "weather-many-clouds", "weather-severe-alert"], iconType)
				}
			case "wind_ovc":
				return { // Overcast and windy
					main: _("Overcast"),
					description: _("Overcast"),
					customIcon: "cloudy-symbolic",
					icon: weatherIconSafely(["weather-overcast", "weather-many-clouds", "weather-severe-alert"], iconType)
				}
			case "snow": //  "Snow"
				return {
					main: _("Light Rain"),
					description: _("Light rain shower"),
					customIcon: "night-alt-showers-symbolic",
					icon: weatherIconSafely(["weather-showers-scattered-night", "weather-showers-night", "weather-showers-scattered", "weather-showers", "weather-freezing-rain", "weather-severe-alert"], iconType)
				}
			case "rain_snow": // Rain/snow
				return {
					main: _("Light Rain"),
					description: _("Light rain shower"),
					customIcon: "day-showers-symbolic",
					icon: weatherIconSafely(["weather-showers-scattered-day", "weather-showers-day", "weather-showers-scattered", "weather-showers", "weather-freezing-rain", "weather-severe-alert"], iconType)
				}
			case "rain_sleet": // Rain/sleet
				return {
					main: _("Drizzle"),
					description: _("Drizzle"),
					customIcon: "showers-symbolic",
					icon: weatherIconSafely(["weather-showers-scattered", "weather-showers", "weather-rain", "weather-freezing-rain", "weather-severe-alert"], iconType)
				}
			case "snow_sleet": // Snow/sleet
				return {
					main: _("Light Rain"),
					description: _("Light rain"),
					customIcon: "showers-symbolic",
					icon: weatherIconSafely(["weather-showers-scattered", "weather-showers", "weather-rain", "weather-freezing-rain", "weather-severe-alert"], iconType)
				}
			case "fzra": // Freezing rain
				return {
					main: _("Heavy Rain"),
					description: _("Heavy rain shower"),
					customIcon: "night-alt-rain-symbolic",
					icon: weatherIconSafely(["weather-showers-night", "weather-showers", "weather-showers-scattered", "weather-severe-alert"], iconType)
				}
			case "rain_fzra": // Rain/freezing rain
				return {
					main: _("Heavy Rain"),
					description: _("Heavy rain shower"),
					customIcon: "day-rain-symbolic",
					icon: weatherIconSafely(["weather-showers-day", "weather-showers", "weather-showers-scattered", "weather-severe-alert"], iconType)
				}
			case "snow_fzra": // Freezing rain/snow
				return {
					main: _("Heavy Rain"),
					description: _("Heavy Rain"),
					customIcon: "rain-symbolic",
					icon: weatherIconSafely(["weather-showers", "weather-showers-scattered", "weather-severe-alert"], iconType)
				}
			case "sleet": // Sleet
				return {
					main: _("Sleet"),
					description: _("Sleet shower"),
					customIcon: "night-alt-rain-mix-symbolic",
					icon: weatherIconSafely(["weather-showers-night", "weather-showers", "weather-showers-scattered", "weather-severe-alert"], iconType)
				}
			case "rain": // Rain
				return {
					main: _("Sleet"),
					description: _("Sleet shower"),
					customIcon: "day-rain-mix-symbolic",
					icon: weatherIconSafely(["weather-showers-day", "weather-showers", "weather-showers-scattered", "weather-severe-alert"], iconType)
				}
			case "rain_showers": // Rain showers (high cloud cover)
				return {
					main: _("Sleet"),
					description: _("Sleet"),
					customIcon: "rain-mix-symbolic",
					icon: weatherIconSafely(["weather-showers", "weather-showers-scattered", "weather-severe-alert"], iconType)
				}
			case "rain_showers_hi": // Rain showers (low cloud cover)
				return {
					main: _("Hail"),
					description: _("Hail shower"),
					customIcon: "night-alt-hail-symbolic",
					icon: weatherIconSafely(["weather-showers-night", "weather-showers", "weather-showers-scattered", "weather-severe-alert"], iconType)
				}
			case "tsra": // Thunderstorm (high cloud cover)
				return {
					main: _("Hail"),
					description: _("Hail shower"),
					customIcon: "day-hail-symbolic",
					icon: weatherIconSafely(["weather-showers-day", "weather-showers", "weather-showers-scattered", "weather-severe-alert"], iconType)
				}
			case "tsra_sct": // Thunderstorm (medium cloud cover)
				return {
					main: _("Hail"),
					description: _("Hail"),
					customIcon: "hail-symbolic",
					icon: weatherIconSafely(["weather-showers", "weather-showers-scattered", "weather-severe-alert"], iconType)
				}
			case "tsra_hi": // Thunderstorm (low cloud cover)
				return {
					main: _("Light Snow"),
					description: _("Light snow shower"),
					customIcon: "night-alt-snow-symbolic",
					icon: weatherIconSafely(["weather-snow-scattered", "weather-snow", "weather-severe-alert"], iconType)
				}
			case "tornado": // Tornado
				return {
					main: _("Light Snow"),
					description: _("Light snow shower"),
					customIcon: "day-snow-symbolic",
					icon: weatherIconSafely(["weather-snow-scattered", "weather-snow", "weather-severe-alert"], iconType)
				}
			case "hurricane": // Hurricane conditions
				return {
					main: _("Light Snow"),
					description: _("Light snow"),
					customIcon: "snow-symbolic",
					icon: weatherIconSafely(["weather-snow-scattered", "weather-snow", "weather-severe-alert"], iconType)
				}
			case "tropical_storm": // Tropical storm conditions
				return {
					main: _("Heavy Snow"),
					description: _("Heavy snow shower"),
					customIcon: "night-alt-snow-symbolic",
					icon: weatherIconSafely(["weather-snow", "weather-snow-scattered", "weather-severe-alert"], iconType)
				}
			case "dust": // Dust
				return {
					main: _("Heavy Snow"),
					description: _("Heavy snow shower"),
					customIcon: "day-snow-symbolic",
					icon: weatherIconSafely(["weather-snow", "weather-snow-scattered", "weather-severe-alert"], iconType)
				}
			case "smoke": // Smoke
				return {
					main: _("Heavy Snow"),
					description: _("Heavy snow"),
					customIcon: "snow-symbolic",
					icon: weatherIconSafely(["weather-snow", "weather-snow-scattered", "weather-severe-alert"], iconType)
				}
			case "haze": // Haze
				return {
					main: _("Thunder"),
					description: _("Thunder shower"),
					customIcon: "day-storm-showers-symbolic",
					icon: weatherIconSafely(["weather-storm", "weather-severe-alert"], iconType)
				}
			case "hot": // Hot
				return {
					main: _("Thunder"),
					description: _("Thunder shower"),
					customIcon: "night-alt-storm-showers-symbolic",
					icon: weatherIconSafely(["weather-storm", "weather-severe-alert"], iconType)
				}
			case "cold": // Cold
				return {
					main: _("Thunder"),
					description: _("UnThunderknown"),
					customIcon: "thunderstorm-symbolic",
					icon: weatherIconSafely(["weather-storm", "weather-severe-alert"], iconType)
				}
			case "blizzard": // Blizzard
				return {
					main: _("Thunder"),
					description: _("UnThunderknown"),
					customIcon: "thunderstorm-symbolic",
					icon: weatherIconSafely(["weather-storm", "weather-severe-alert"], iconType)
				}
			case "fog": // Fog/mist
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

interface GridPayload {
	"@context": any,
    id: string;
    type: string;
    geometry: {
		type: string,
		/** [lon, lat] */
        coordinates: number[]
    },
    properties: {
        "@id": string,
        "@type": "wx:Point",
        cwa: string;
        forecastOffice: string;
        gridId: string;
        gridX: number;
		gridY: number;
		/** url */
		forecast: string;
		/** url */
		forecastHourly: string;
		/** url */
		forecastGridData: string;
		/** url */
        observationStations: string;
        relativeLocation: {
            type: string;
            geometry: {
                type: string,
                coordinates: number[]
            },
            properties: {
                city: string;
                state: string;
                distance: {
                    value: number;
                    unitCode: string;
                },
                bearing: {
                    value: number;
                    unitCode: string;
                }
            }
        },
        forecastZone: string;
        county: string;
        fireWeatherZone: string;
        timeZone: string
        radarStation: string;
    }
}

interface StationPayload {
	/** url */
	id: string;
	type: string;
	geometry: {
		type: string;
		/** [lon, lat] */
		coordinates: number[];
	};
	dist?: number;
	properties: {
		"@id": string;
		"@type": string;
		elevation: {
			value: number;
			unit: string;
		};
		stationIdentifier: string;
		name: string;
		timeZone: string;
		/** url */
		forecast: string;
		/** url */
		county: string;
		/** url */
		fireWeatherZone: string;
	}
}

interface StationsPayload {
	"@context": any;
	features: StationPayload[]
}

interface ObservationPayload {
	"@context": any;
	/** https://api.weather.gov/stations/WTHC1/observations/2020-06-25T12:57:00+00:00 */
	id: string;
	type: string;
	geometry: {
		type: string;
		/** [lon, lat] */
		coordinates: number[];
	}
	properties: {
		"@id": string;
		"@type": string;
		elevation: {
			value: number;
			unit: string;
		};
		/** url */
		station: string;
		/** ISO string */
		timestamp: string;
		rawMessage: string;
		textDescription: string;
        icon: string;
        presentWeather: any[],
        temperature: {
            value: number;
            unitCode: string,
            qualityControl: string
        },
        dewpoint: {
            value: number;
            unitCode: string;
            qualityControl: string;
        },
        windDirection: {
            value: number;
            unitCode: string;
            qualityControl: string;
        },
        windSpeed: {
            value: number;
            unitCode: string;
            qualityControl: string;
        },
        windGust: {
            value: number;
            unitCode: string;
            qualityControl: string;
        },
        barometricPressure: {
            value: number;
            unitCode: string;
            qualityControl: string;
        },
        seaLevelPressure: {
            value: number;
            unitCode: string;
            qualityControl: string;
        },
        visibility: {
            value: number;
            unitCode: string;
            qualityControl: string;
        },
        maxTemperatureLast24Hours: {
            value: number;
            unitCode: string;
            qualityControl: null
        },
        minTemperatureLast24Hours: {
            value: number;
            unitCode: string;
            qualityControl: null
        },
        precipitationLast3Hours: {
            value: number;
            unitCode: string;
            qualityControl: string;
        },
        relativeHumidity: {
            value: number;
            unitCode: string;
            qualityControl: string;
        },
        windChill: {
            value: number;
            unitCode: string;
            qualityControl: string;
        },
        heatIndex: {
            value: number;
            unitCode: string;
            qualityControl: string;
        },
        cloudLayers: []
    }
}

interface ForecastsPayload {
	properties: {
		elevation: {
			value: number;
			unitCode: string;
		},
		periods: ForecastPayload[]
	}
}

interface ForecastPayload {
	number: number;
	name: string;
	/** ISO string */
	startTime: string;
	/** ISO string */
	endTime: string;
	isDaytime: boolean;
	/** Usually in F */
	temperature: number;
	temperatureUnit: string;
	temperatureTrend: any;
	/** Like "5 mph" ?? */
	windSpeed: string;
	/** Like "SSW" */
	windDirection: string;
	icon: string;
	shortForecast: string;
	/** Can be empty string */
	detailedForecast: string;
}

