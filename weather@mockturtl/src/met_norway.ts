
export {}

function importModule(path: string): any {
    if (typeof require !== 'undefined') {
      return require('./' + path);
    } else {
      if (!AppletDir) var AppletDir = imports.ui.appletManager.applets['weather@mockturtl'];
      return AppletDir[path];
    }
}

var utils = importModule("utils");
var isCoordinate = utils.isCoordinate as (text: any) => boolean;
var icons = utils.icons;
var weatherIconSafely = utils.weatherIconSafely as (code: string[], icon_type: string) => string;
var CelsiusToKelvin = utils.CelsiusToKelvin as (celsius: number) => number;
const { spawn_async } = imports.misc.util;

class MetNorway implements WeatherProvider {
    private ctx: MetNorway
    private app: WeatherApplet
    private baseUrl = "https://api.met.no/weatherapi/locationforecast/1.9/?"
    private xmlParser: any;
    private appletDir: string;

    constructor(app: WeatherApplet) {
        this.ctx = this;
        this.app = app;
        this.appletDir = app.appletDir + "/../";
    }

    public async GetWeather(): Promise<WeatherData> {
        let query = this.GetUrl();
        let json: any;
        if (query != "" && query != null) {
            this.app.log.Debug("MET Norway API query: " + query);
            try {
                json = await this.SpawnProcess(this.GetUrl());
            }
            catch(e) {
                this.app.HandleHTTPError("met-norway", e, this.app);
                return null;
            }        
            
            if (!json) {
                this.app.HandleError({type: "soft", detail: "no api response", service: "met-norway"});
                return null;
            }

            json = JSON.parse(json);

            if (json.error) {
              this.app.HandleError({type: "hard", detail: "bad api response", "service": "met-norway"});
                return null;
            }
            return await this.ParseWeather(json);
        }
        return null;
    }

    private async SpawnProcess(url: string): Promise<any> {
      global.log(this.appletDir)
      let json = await new Promise((resolve: any, reject: any) => {
        spawn_async(['python', this.appletDir + '/xmlParser.py', url], (aStdout: any) => {
          resolve(aStdout);
        });
      });
      return json;
    }

    private async ParseWeather(json: any): Promise<WeatherData> {    
        json = json.weatherdata.product.time;
        
        // Sorting Data points
        let parsedWeathers: WeatherForecast[] = [];
        let parsed6hourly: SixHourForecast[] = [];
        let parsedHourly: HourlyForecast[] = [];
        for (let i = 0; i < json.length; i++) {
          const element = json[i];
          let fromDate = new Date(element["@from"]);
          let toDate = new Date(element["@to"]);
          let item = element.location;

          let temp = item.temperature;
          let minTemp = item.minTemperature;
          let symbol = item.symbol;
          if (!!temp) { // Current observations
            parsedWeathers.push(this.ParseCurrentWeather(item, fromDate, toDate));
          }
          else if (!!minTemp && !!symbol) { // 6-hour forecast
            parsed6hourly.push(this.Parse6HourForecast(item, fromDate, toDate));
          }
          else if (!minTemp && !!symbol) { // Hourly forecats with confition
            parsedHourly.push(this.ParseHourlyForecast(item, fromDate, toDate));
          }
        }

        // Building weather data
        let forecasts: ForecastData[] = this.BuildForecasts(parsed6hourly);
        let result: WeatherData = {
            temperature: CelsiusToKelvin(parsedWeathers[0].temperature),
            coord: {
              lat: parsedWeathers[0].lat,
              lon: parsedWeathers[0].lon
            },
            date: parsedWeathers[0].from,
            condition: this.ResolveCondition(parsedHourly[0].symbol),
            humidity: parsedWeathers[0].humidity,
            pressure: parsedWeathers[0].pressure,
            extra_field: {
              name: _("Cloudiness:"),
              type: "percent",
              value: parsedWeathers[0].cloudiness
            },
            sunrise: null,
            sunset: null,
            wind: {
              degree: parsedWeathers[0].windDirection,
              speed: parsedWeathers[0].windSpeed
            },
            location: {
              url: null,
            },
            forecasts: forecasts
        };
        return result;
    }

    private GetEarliestData(events: SixHourForecast[] | HourlyForecast[] | WeatherForecast[]): SixHourForecast | HourlyForecast | WeatherForecast {
      let earliest: number = 0;
      for (let i = 0; i < events.length; i++) {
        const element = events[i];
        const earliestElement = events[earliest];

        if (earliestElement.from < element.from) continue;

        earliest = i;
      }
      return events[earliest];
    }

    private BuildForecasts(forecastsData: SixHourForecast[]): ForecastData[] {
      let forecasts: ForecastData[] = [];
      let days: Array<SixHourForecast[]> = []

      // Sorting and conatinerizing forecasts by date
      // Ingoring forecast for multiple days (eg. 22/12/2019 22:00 - 23/12/2019 04:00)
      let currentDay = this.GetEarliestData(forecastsData).from.toDateString();
      let dayIndex = 0;
      days.push([]);
      for (let i = 0; i < forecastsData.length; i++) {
        const element = forecastsData[i];
        if (element.from.toDateString() == currentDay && element.to.toDateString() == currentDay) {
          days[dayIndex].push(element);
        }
        else if (element.from.toDateString() != currentDay && element.to.toDateString() != currentDay) {
          dayIndex ++;
          currentDay = element.from.toDateString();
          days.push([]);
          days[dayIndex].push(element);
        }
      }

      for (let i = 0; i < days.length; i++) {
        let forecast: ForecastData = {
          condition: {
            customIcon: "Cloud",
            description: "",
            icon: "weather-severe-alert",
            main: ""
          },
          date: null,
          temp_max: Number.NEGATIVE_INFINITY,
          temp_min: Number.POSITIVE_INFINITY
        }

        // Build daily data
        let conditionCounter: ConditionCount = {}
        for (let j = 0; j < days[i].length; j++) {
          const element = days[i][j];
          forecast.date = element.from;
          if (element.maxTemperature > forecast.temp_max) forecast.temp_max = element.maxTemperature;
          if (element.minTemperature < forecast.temp_min) forecast.temp_min = element.minTemperature;
          conditionCounter[element.symbol] = (!!conditionCounter[element.symbol]) ? conditionCounter[element.symbol]++ : 1;
        }

        forecast.temp_max = CelsiusToKelvin(forecast.temp_max);
        forecast.temp_min = CelsiusToKelvin(forecast.temp_min);

        forecast.condition = this.ResolveCondition(this.GetMostCommonCondition(conditionCounter));
        forecasts.push(forecast);

      }
      return forecasts;
    }

    private GetMostCommonCondition(count: ConditionCount): string {
      let result: string  = null;
      for (let key in count) {
        if (result == null) result = key;
        if (count[result] < count[key]) result = key;
      }
      return result;
    }

    private ParseCurrentWeather(element: any, from: Date, to: Date): WeatherForecast {
      return {
        temperature: parseFloat(element.temperature['@value']),
        lat: element["@latitude"],
        lon: element["@longitude"],
        windDirection: parseFloat(element.windDirection["@deg"]),
        windSpeed: parseFloat(element.windSpeed["@mps"]),
        humidity: parseFloat(element.humidity["@value"]),
        pressure: parseFloat(element.pressure["@value"]),
        cloudiness: parseFloat(element.cloudiness["@percent"]),
        //fog: parseFloat(element.fog["@percent"]),
        lowClouds: parseFloat(element.lowClouds["@percent"]),
        mediumClouds: parseFloat(element.mediumClouds["@percent"]),
        highClouds: parseFloat(element.highClouds["@percent"]),
        dewpointTemperature: parseFloat(element.dewpointTemperature["@value"]),
        from: from,
        to: to
      };
    }

    private Parse6HourForecast(element: any, from: Date, to: Date): SixHourForecast {
      return {
        precipitation: parseFloat(element.precipitation["@value"]),
        minTemperature: parseFloat(element.minTemperature["@value"]),
        maxTemperature: parseFloat(element.maxTemperature["@value"]),
        from: from,
        to: to,
        symbol: element.symbol["@id"]
      }
    }

    private ParseHourlyForecast(element: any, from: Date, to: Date): HourlyForecast {
      return {
        precipitation: parseFloat(element.precipitation["@value"]),
        from: from,
        to: to,
        symbol: element.symbol["@id"]
      }
    }

    private GetUrl(): string {
        let location = this.app._location.replace(" ", "");
        let url = this.baseUrl + "lat=";
        if (!isCoordinate(location)) return "";

        let latLon = location.split(",");
        url += (latLon[0] + "&lon=" + latLon[1]);
        return url;
    }

    private ResolveCondition(icon: string): Condition {
      let condition: Conditions = icon.replace("Dark_", "") as Conditions;
      switch (condition) {
        case "Cloud":
          return {
            customIcon : "Cloud",
            main: _("Cloudy"),
            description: _("Cloudy"),
            icon: weatherIconSafely([icons.overcast, icons.clouds, icons.few_clouds_day], this.app._icon_type)
          }
        case "Drizzle":
          return {
            customIcon : "Cloud-Drizzle",
            main: _("Drizzle"),
            description: _("Drizzle"),
            icon: weatherIconSafely([icons.rain, icons.showers_scattered, icons.rain_freezing, icons.alert], this.app._icon_type)
          }
        case "DrizzleSun":
          return {
            customIcon : "Cloud-Drizzle-Sun",
            main: _("Drizzle"),
            description: _("Drizzle"),
            icon: weatherIconSafely([icons.showers_scattered, icons.rain_freezing, icons.alert], this.app._icon_type)
          }
        case "DrizzleThunder":
          return {
            customIcon : "Cloud-Drizzle",
            main: _("Drizzle"),
            description: _("Drizzle with Thunderstorms"),
            icon: weatherIconSafely([icons.showers_scattered, icons.rain_freezing, icons.alert], this.app._icon_type)
          }
        case "DrizzleThunderSun":
          return {
            customIcon : "Cloud-Drizzle",
            main: _("Mostly Drizzle"),
            description: _("Mostly Drizzle with Thunderstorms"),
            icon: weatherIconSafely([icons.rain, icons.showers_scattered, icons.rain_freezing, icons.alert], this.app._icon_type)
          }
        case "Fog":
          return {
            customIcon : "Cloud-Fog",
            main: _("Fog"),
            description: _("Fog"),
            icon: weatherIconSafely([icons.fog, icons.alert], this.app._icon_type)
          }
        case "HeavySleet":
          return {
            customIcon : "Cloud-Hail",
            main: _("Heavy Sleet"),
            description: _("Heavy Sleet"),
            icon: weatherIconSafely([icons.rain_freezing, icons.rain, icons.alert], this.app._icon_type)
          }
        case "HeavySleetSun":
          return {
            customIcon : "Cloud-Hail-Sun",
            main: _("Heavy Sleet"),
            description: _("Mostly Heavy Sleet"),
            icon: weatherIconSafely([icons.rain_freezing, icons.rain, icons.alert], this.app._icon_type)
          }
        case "HeavySleetThunder":
          return {
            customIcon : "Cloud-Hail",
            main: _("Heavy Sleet"),
            description: _("Heavy Sleet with Thundertorms"),
            icon: weatherIconSafely([icons.rain_freezing, icons.rain, icons.alert], this.app._icon_type)
          }
        case "HeavySleetThunderSun":
          return {
            customIcon : "Cloud-Hail-Sun",
            main: _("Heavy Sleet"),
            description: _("Mostly Heavy Sleet with Thunderstorms"),
            icon: weatherIconSafely([icons.rain_freezing, icons.rain, icons.alert], this.app._icon_type)
          }
        case "HeavySnow":
          return {
            customIcon : "Cloud-Snow",
            main: _("heavy Snow"),
            description: _("Heavy Snow"),
            icon: weatherIconSafely([icons.snow, icons.alert], this.app._icon_type)
          }
        case "HeavySnowThunder":
          return {
            customIcon : "Cloud-Snow",
            main: _("Heavy Snow"),
            description: _("Heavy Snow with Thunderstorm"),
            icon: weatherIconSafely([icons.snow, icons.alert], this.app._icon_type)
          }
        case "HeavySnowThunderSun":
          return {
            customIcon : "Cloud-Snow-Sun",
            main: _("Heavy Snow"),
            description: _("Heavy Snow with Thunderstorm"),
            icon: weatherIconSafely([icons.snow, icons.alert], this.app._icon_type)
          }
        case "HeavysnowSun":
          return {
            customIcon : "Cloud-Snow-Sun",
            main: _("Heavy Snow"),
            description: _("Heavy Snow"),
            icon: weatherIconSafely([icons.snow, icons.alert], this.app._icon_type)
          }
        case "LightCloud":
          return {
            customIcon : "Cloud-Sun",
            main: _("Mostly Sunny"),
            description: _("Mostly Sunny"),
            icon: weatherIconSafely([icons.few_clouds_day, icons.alert], this.app._icon_type)
          }
        case "LightRain":
          return {
            customIcon : "Cloud-Rain-Sun",
            main: _("Light Rain"),
            description: _("Light Rain"),
            icon: weatherIconSafely([icons.showers_scattered, icons.rain, icons.alert], this.app._icon_type)
          }
        case "LightRainSun":
          return {
            customIcon : "Cloud-Rain-Sun",
            main: _("Light Rain"),
            description: _(""),
            icon: weatherIconSafely([icons.showers_scattered, icons.rain, icons.alert], this.app._icon_type)
          }
        case "LightRainThunder":
          return {
            customIcon : "Cloud-Rain",
            main: _("Light Rain"),
            description: _("Light Rain with Thunderstorms"),
            icon: weatherIconSafely([icons.showers_scattered, icons.rain, icons.alert], this.app._icon_type)
          }
        case "LightRainThunderSun":
          return {
            customIcon : "Cloud-Rain-Sun",
            main: _("Light Rain"),
            description: _("Mostly Ligh Rain with Thunderstorms"),
            icon: weatherIconSafely([icons.showers_scattered, icons.rain, icons.alert], this.app._icon_type)
          }
        case "LightSleet":
          return {
            customIcon : "Cloud-Hail",
            main: _("Light Sleet"),
            description: _("Light Sleet"),
            icon: weatherIconSafely([icons.rain_freezing, icons.showers, icons.alert], this.app._icon_type)
          }
        case "LightSleetSun":
          return {
            customIcon : "Cloud-Hail-Sun",
            main: _("Light Sleet"),
            description: _("Mostly Light Sleet"),
            icon: weatherIconSafely([icons.rain_freezing, icons.showers, icons.alert], this.app._icon_type)
          }
        case "LightSleetThunder":
          return {
            customIcon : "Cloud-Hail",
            main: _("Light Sleet"),
            description: _("Light Sleet with Thunderstorms"),
            icon: weatherIconSafely([icons.rain_freezing, icons.showers, icons.alert], this.app._icon_type)
          }
        case "LightSleetThunderSun":
          return {
            customIcon : "Cloud-Hail-Sun",
            main: _("Light Sleet"),
            description: _("Mostly Light Sleet with Thunderstorms"),
            icon: weatherIconSafely([icons.rain_freezing, icons.showers, icons.alert], this.app._icon_type)
          }
        case "LightSnow":
          return {
            customIcon : "Cloud-Snow",
            main: _("Light Snow"),
            description: _("Light Snow"),
            icon: weatherIconSafely([icons.snow, icons.alert], this.app._icon_type)
          }
        case "LightSnowSun":
          return {
            customIcon : "Cloud-Snow-Sun",
            main: _("Light Snow"),
            description: _("Mostly Light Snow"),
            icon: weatherIconSafely([icons.snow, icons.alert], this.app._icon_type)
          }
        case "LightSnowThunder":
          return {
            customIcon : "Cloud-Snow",
            main: _("Light Snow"),
            description: _("Light Snow with Thunderstorms"),
            icon: weatherIconSafely([icons.snow, icons.alert], this.app._icon_type)
          }
        case "LightSnowThunderSun":
          return {
            customIcon : "Cloud-Snow-Sun",
            main: _("Light Snow"),
            description: _("Mostly Light Snow with Thunderstorms"),
            icon: weatherIconSafely([icons.snow, icons.alert], this.app._icon_type)
          }
        case "PartlyCloud":
          return {
            customIcon : "Cloud-Sun",
            main: _("Partly Cloudy"),
            description: _("Partly Cloudy"),
            icon: weatherIconSafely([icons.few_clouds_day, icons.clouds, icons.overcast, icons.alert], this.app._icon_type)
          }
        case "Rain":
          return {
            customIcon : "Cloud-Rain",
            main: _("Rain"),
            description: _("Rain"),
            icon: weatherIconSafely([icons.rain, icons.rain_freezing, icons.alert], this.app._icon_type)
          }
        case "RainSun":
          return {
            customIcon : "Cloud-Rain-Sun",
            main: _("Mostly Rainy"),
            description: _("Mostly Rainy"),
            icon: weatherIconSafely([icons.rain, icons.rain_freezing, icons.alert], this.app._icon_type)
          }
        case "RainThunder":
          return {
            customIcon : "Cloud-Lightning",
            main: _("Rain"),
            description: _("Rain with Thunderstorm"),
            icon: weatherIconSafely([icons.storm, icons.rain, icons.rain_freezing, icons.alert], this.app._icon_type)
          }
        case "RainThunderSun":
          return {
            customIcon : "Cloud-Lightning-Sun",
            main: _("Rain"),
            description: _("Mostly Rainy with Thunderstorms"),
            icon: weatherIconSafely([icons.storm, icons.rain, icons.rain_freezing, icons.alert], this.app._icon_type)
          }
        case "Sleet":
          return {
            customIcon : "Cloud-Hail",
            main: _("Sleet"),
            description: _("Sleet"),
            icon: weatherIconSafely([icons.rain_freezing, icons.showers, icons.alert], this.app._icon_type)
          }
        case "SleetSun":
          return {
            customIcon : "Cloud-Hail-Sun",
            main: _("Sleet"),
            description: _("Mostly Sleet"),
            icon: weatherIconSafely([icons.rain_freezing, icons.showers, icons.alert], this.app._icon_type)
          }
        case "SleetSunThunder":
          return {
            customIcon : "Cloud-Hail-Sun",
            main: _("Sleet"),
            description: _("Mostly Sleet with Thunderstorms"),
            icon: weatherIconSafely([icons.rain_freezing, icons.showers, icons.alert], this.app._icon_type)
          }
        case "SleetThunder":
          return {
            customIcon : "Cloud-Hail",
            main: _("Sleet"),
            description: _("Sleet with Thunderstorms"),
            icon: weatherIconSafely([icons.rain_freezing, icons.showers, icons.alert], this.app._icon_type)
          }
        case "Snow":
          return {
            customIcon : "Cloud-Snow",
            main: _("Snow"),
            description: _("Snowy"),
            icon: weatherIconSafely([icons.snow, icons.alert], this.app._icon_type)
          }
        case "SnowSun":
          return {
            customIcon : "Cloud-Snow-Sun",
            main: _("Mostly Snowy"),
            description: _("Mostly Snowy"),
            icon: weatherIconSafely([icons.snow, icons.alert], this.app._icon_type)
          }
        case "SnowSunThunder":
          return {
            customIcon : "Cloud-Snow-Sun",
            main: _("Mostly Snowy"),
            description: _("Mostly Snowy with Thunder"),
            icon: weatherIconSafely([icons.snow, icons.alert], this.app._icon_type)
          }
        case "SnowThunder":
          return {
            customIcon : "Cloud-Snow",
            main: _("Snow"),
            description: _("Snowy with Thunder"),
            icon: weatherIconSafely([icons.snow, icons.alert], this.app._icon_type)
          }
        case "Sun":
          return {
            customIcon : "Sun",
            main: _("Sunny"),
            description: _("Sunny"),
            icon: weatherIconSafely([icons.clear_day, icons.alert], this.app._icon_type)
          }
      }
    }

  }


interface WeatherForecast {
  from: Date;
  to: Date;
  lat: number;
  lon: number;
  /** Celsius */
  temperature: number;
  /** degrees */
  windDirection: number;
  /** mps */
  windSpeed: number;
  /**percent */
  humidity: number;
  /** hPa */
  pressure: number;
  /**percent */
  cloudiness: number;
  /**percent */
  fog?: number;
  /**percent */
  lowClouds: number;
  /**percent */
  mediumClouds: number;
  /**percent */
  highClouds: number;
  /**percent */
  dewpointTemperature: number;
}

interface SixHourForecast {
  from: Date;
  to: Date;
  /**mm */
  precipitation: number;
  /**celsius */
  minTemperature: number;
  /**celsius */
  maxTemperature: number;
  symbol: string;
}

interface HourlyForecast {
  from: Date;
  to: Date;
  /**mm */
  precipitation: number;
  symbol: string;
}

interface ConditionCount {
  [key: string]: number
}

type Conditions = "Sun" | "LightCloud" | "PartlyCloud" | "Cloud" | "LightRainSun" | "LightRainThunderSun" |
                  "SleetSun" | "SnowSun"| "LightRain"| "Rain"| "RainThunder"| "Sleet"| "Snow"| "SnowThunder"
                  | "Fog" | "SleetSunThunder" | "SnowSunThunder"| "LightRainThunder"| "SleetThunder"| "DrizzleThunderSun"
                  | "RainThunderSun"| "LightSleetThunderSun"| "HeavySleetThunderSun"| "LightSnowThunderSun"| "HeavySnowThunderSun"
                  | "DrizzleThunder"| "LightSleetThunder"| "HeavySleetThunder"| "LightSnowThunder"| "HeavySnowThunder"
                  | "DrizzleSun"| "RainSun"| "LightSleetSun"| "HeavySleetSun"| "LightSnowSun"| "HeavysnowSun"
                  | "Drizzle"| "LightSleet"| "HeavySleet"| "LightSnow"| "HeavySnow";


