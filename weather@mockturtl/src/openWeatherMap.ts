export {}; // Declaring as a Module
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
var isLangSupported = utils.isLangSupported as (lang: string, languages: Array <string> ) => boolean;
var isID = utils.isID as (text: any) => boolean;
var icons = utils.icons;
var weatherIconSafely = utils.weatherIconSafely as (code: string[], icon_type: imports.gi.St.IconType) => string;
var get = utils.get as (p: string[], o: any) => any;

//////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////
///////////                                       ////////////
///////////         OpenWeatherMap Premium        ////////////
///////////                                       ////////////
//////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////

class OpenWeatherMap implements WeatherProvider {
    //--------------------------------------------------------
    //  Properties
    //--------------------------------------------------------
    private supportedLanguages = ["af", "ar", "az", "bg", "ca", "cz", "da", "de", "el", "en", "eu", "fa", "fi",
     "fr", "gl", "he", "hi", "hr", "hu", "id", "it", "ja", "kr", "la", "lt", "mk", "no", "nl", "pl",
      "pt", "pt_br", "ro", "ru", "se", "sk", "sl", "sp", "es", "sr", "th", "tr", "ua", "uk", "vi", "zh_cn", "zh_tw", "zu"];

    private current_url = "https://api.openweathermap.org/data/2.5/weather?";
    private daily_url = "https://api.openweathermap.org/data/2.5/forecast/daily?";

    private app: WeatherApplet
    constructor (_app: WeatherApplet) {
      this.app = _app;
    }

    //--------------------------------------------------------
    //  Functions
    //--------------------------------------------------------

    public async GetWeather(): Promise<WeatherData> {
        let currentResult = await this.GetData(this.current_url, this.ParseCurrent) as WeatherData;
        let forecastResult = await this.GetData(this.daily_url, this.ParseForecast) as ForecastData[];
        currentResult.forecasts = forecastResult;
        return currentResult;
    };

    // A function as a function parameter 2 levels deep does not know
    // about the top level object information, has to pass it in as a paramater
    /**
     * 
     * @param baseUrl 
     * @param ParseFunction returns WeatherData or ForecastData Object
     */
    private async GetData(baseUrl: string, ParseFunction: (json: any, context: any) => WeatherData | ForecastData[]): Promise<WeatherData | ForecastData[]> {
        let query = this.ConstructQuery(baseUrl);
        let json;
        if (query != null) {
            this.app.log.Debug("Query: " + query);
            try {
                json = await this.app.LoadJsonAsync(query);
            }
            catch(e) {
              this.app.HandleHTTPError("openweathermap", e, this.app, this.HandleHTTPError);
                return null;
            }

            if (json == null) {
              this.app.HandleError({type: "soft", detail: "no api response", service: "openweathermap"});
              return null;                 
          }

            if (json.cod == "200") {   // Request Success
                return ParseFunction(json, this);
            }
            else {
                this.HandleResponseErrors(json);
                return null;
            }
        }
        else {
          return null;
        }       
    };


    private ParseCurrent(json: any, self: OpenWeatherMap): WeatherData {
        try {
          let weather: WeatherData = {
            coord: {
              lat: get(["coord", "lat"], json),
              lon: get(["coord", "lon"], json)
            },
            location: {
              city: json.name,
              country: json.sys.country,
              url: "https://openweathermap.org/city/" + json.id,
            },
            date: new Date((json.dt) * 1000),
            sunrise: new Date((json.sys.sunrise) * 1000),
            sunset: new Date((json.sys.sunset) * 1000),
            wind: {
              speed: get(["wind", "speed"], json),
              degree: get(["wind", "deg"], json)
            },
            temperature: get(["main", "temp"], json),
            pressure: get(["main", "pressure"], json),
            humidity: get(["main", "humidity"], json),
            condition: {
              main: get(["weather", "0", "main"], json),
              description: get(["weather", "0", "description"], json),
              icon: weatherIconSafely(self.ResolveIcon(get(["weather", "0", "icon"], json)), self.app.config.IconType()),
              customIcon: self.ResolveCustomIcon(get(["weather", "0", "icon"], json))
            },
            extra_field: {
              name: _("Cloudiness"),
              value: json.clouds.all,
              type: "percent"
            },
            forecasts: []
          };
          
          return weather; 
        }
        catch(e) { 
          self.app.log.Error("OpenWeathermap Weather Parsing error: " + e);
          self.app.HandleError({type: "soft", service: "openweathermap", detail: "unusal payload", message: _("Failed to Process Current Weather Info")})
          return null; 
        }
    };

    private ParseForecast(json: any, self: OpenWeatherMap): ForecastData[] {
      let forecasts: ForecastData[] = [];
      try {
        for (let i = 0; i < self.app.config._forecastDays; i++) {
          let day = json.list[i];
          let forecast: ForecastData = {          
              date: new Date(day.dt * 1000),
              temp_min: day.temp.min,
              temp_max: day.temp.max,
              condition: {
                  main: day.weather[0].main,
                  description: day.weather[0].description,
                  icon: weatherIconSafely(self.ResolveIcon(day.weather[0].icon), self.app.config.IconType()),
                  customIcon: self.ResolveCustomIcon(day.weather[0].icon)
              },
          };
          forecasts.push(forecast);         
        }
        return forecasts;
      }
      catch(e) {
          self.app.log.Error("OpenWeathermap Forecast Parsing error: " + e);
          self.app.HandleError({type: "soft", service: "openweathermap", detail: "unusal payload", message: _("Failed to Process Forecast Info")})
          return null; 
      }
    };

    private ConstructQuery(baseUrl: string): string {
        let query = baseUrl;
        let locString = this.ParseLocation();
        if (locString != null) {
            query = query + locString + "&APPID=";
             // Append Language if supported and enabled
            query += "1c73f8259a86c6fd43c7163b543c8640";
            let locale: string = this.ConvertToAPILocale(this.app.currentLocale);
            if (this.app.config._translateCondition && isLangSupported(locale, this.supportedLanguages)) {
                query = query + "&lang=" + locale;
            }
            return query;
        }
        
        this.app.HandleError({type: "hard", userError: true, "detail": "no location", message: _("Please enter a Location in settings")});
        this.app.log.Error("OpenWeatherMap: No Location was provided");
        return null;
    };

    private ParseLocation(): string {
        let loc = this.app.config._location.replace(/ /g, "");
        if (isCoordinate(loc)) {
            let locArr = loc.split(',');
            return "lat=" + locArr[0] + "&lon=" + locArr[1];
        }
        else if (isID(loc)) {
            return "id=" + loc;
        }
        else  // try as a normal query
            return "q=" + loc;
    };

    private ConvertToAPILocale(systemLocale: string) {
      // Dialect? support by OWM
      if (systemLocale == "zh-cn" || systemLocale == "zh-cn" || systemLocale == "pt-br") {
        return systemLocale;
      }
      let lang = systemLocale.split("-")[0];
      // OWM uses different language code for Swedish, Czech, Korean, Latvian, Norwegian
      if (lang == "sv") { 
        return "se";
      }
      else if (lang =="cs") {
        return "cz";
      }
      else if (lang =="ko") {
        return "kr";
      }
      else if (lang =="lv") {
        return "la";
      }
      else if (lang =="nn" || lang == "nb") {
        return "no";
      }
      return lang;
    }

    private HandleResponseErrors(json: any): void {
        let errorMsg = "OpenWeathermap Response: ";
        let error = {
          service: "openweathermap",
          type: "hard",
        } as AppletError;
        switch (json.cod) {
            case("400"):
              error.detail = "bad location format";
              error.message = _("Please make sure Location is in the correct format in the Settings");
              break;
            case("401"):
              error.detail = "bad key";
              error.message = _("Make sure you entered the correct key in settings");
              break;
            case("404"):
              error.detail = "location not found";
              error.message = _("Location not found, make sure location is available or it is in the correct format");
              break;
            case("429"):
              error.detail = "key blocked";
              error.message = _("If this problem persists, please contact the Author of this applet");    
              break;
            default:
              error.detail = "unknown";
              error.message = _("Unknown Error, please see the logs in Looking Glass");    
              break;
        };
        this.app.HandleError(error);
        this.app.log.Debug("OpenWeatherMap Error Code: " + json.cod)
        this.app.log.Error(errorMsg + json.message);
    };

    public HandleHTTPError(error: HttpError, uiError: AppletError): AppletError {
      // "this" is not accessible here
      if (error.code == 404) {
        uiError.detail = "location not found";
        uiError.message = _("Location not found, make sure location is available or it is in the correct format");
        uiError.userError = true;
        uiError.type = "hard";
      }
      return uiError;
    }


    private ResolveIcon(icon: string): string[] {
        // https://openweathermap.org/weather-conditions
       /* fallback icons are: weather-clear-night 
       weather-clear weather-few-clouds-night weather-few-clouds 
       weather-fog weather-overcast weather-severe-alert weather-showers 
       weather-showers-scattered weather-snow weather-storm */
       switch (icon) {
           case "10d":/* rain day */
             return [icons.rain, icons.showers_scattered, icons.rain_freezing]
           case "10n":/* rain night */
             return [icons.rain, icons.showers_scattered, icons.rain_freezing]
           case "09n":/* showers nigh*/
             return [icons.showers]
           case "09d":/* showers day */
             return [icons.showers]
           case "13d":/* snow day*/
             return [icons.snow]
           case "13n":/* snow night */
             return [icons.snow]
           case "50d":/* mist day */
             return [icons.fog]
           case "50n":/* mist night */
             return [icons.fog]
           case "04d":/* broken clouds day */
             return [icons.overcast, icons.clouds, icons.few_clouds_day]
           case "04n":/* broken clouds night */
             return [icons.overcast, icons.clouds, icons.few_clouds_day]
           case "03n":/* mostly cloudy (night) */
             return ['weather-clouds-night', icons.few_clouds_night]
           case "03d":/* mostly cloudy (day) */
             return [icons.clouds, icons.overcast, icons.few_clouds_day]
           case "02n":/* partly cloudy (night) */
             return [icons.few_clouds_night]
           case "02d":/* partly cloudy (day) */
             return [icons.few_clouds_day]
           case "01n":/* clear (night) */
             return [icons.clear_night]
           case "01d":/* sunny */
             return [icons.clear_day]
           case "11d":/* storm day */
             return [icons.storm]
           case "11n":/* storm night */
             return [icons.storm]
           default:
             return [icons.alert]
         }
   };

   private ResolveCustomIcon(icon: string): CustomIcons {
    switch (icon) {
        case "10d":/* rain day */
          return "day-rain-symbolic";
        case "10n":/* rain night */
          return "night-rain-symbolic";
        case "09n":/* showers nigh*/
          return "night-showers-symbolic";
        case "09d":/* showers day */
          return "day-showers-symbolic"
        case "13d":/* snow day*/
          return "day-snow-symbolic"
        case "13n":/* snow night */
          return "night-alt-snow-symbolic"
        case "50d":/* mist day */
          return "day-fog-symbolic"
        case "50n":/* mist night */
          return "night-fog-symbolic"
        case "04d":/* broken clouds day */
          return "day-cloudy-symbolic"
        case "04n":/* broken clouds night */
          return "night-alt-cloudy-symbolic"
        case "03n":/* mostly cloudy (night) */
          return "night-alt-cloudy-symbolic"
        case "03d":/* mostly cloudy (day) */
          return "day-cloudy-symbolic"
        case "02n":/* partly cloudy (night) */
          return "night-alt-cloudy-symbolic"
        case "02d":/* partly cloudy (day) */
          return "day-cloudy-symbolic"
        case "01n":/* clear (night) */
          return "night-clear-symbolic"
        case "01d":/* sunny */
          return "day-sunny-symbolic"
        case "11d":/* storm day */
          return "day-thunderstorm-symbolic"
        case "11n":/* storm night */
          return "night-alt-thunderstorm-symbolic"
        default:
          return "cloud-refresh-symbolic"
      }
  };
};

const openWeatherMapConditionLibrary = [
  // Group 2xx: Thunderstorm
  _("Thunderstorm with light rain"),
  _("Thunderstorm with rain"),
  _("Thunderstorm with heavy rain"),
  _("Light thunderstorm"),
  _("Thunderstorm"),
  _("Heavy thunderstorm"),
  _("Ragged thunderstorm"),
  _("Thunderstorm with light drizzle"),
  _("Thunderstorm with drizzle"),
  _("Thunderstorm with heavy drizzle"),
  // Group 3xx: Drizzle
  _("Light intensity drizzle"),
  _("Drizzle"),
  _("Heavy intensity drizzle"),
  _("Light intensity drizzle rain"),
  _("Drizzle rain"),
  _("Heavy intensity drizzle rain"),
  _("Shower rain and drizzle"),
  _("Heavy shower rain and drizzle"),
  _("Shower drizzle"),
  // Group 5xx: Rain
  _("Light rain"),
  _("Moderate rain"),
  _("Heavy intensity rain"),
  _("Very heavy rain"),
  _("Extreme rain"),
  _("Freezing rain"),
  _("Light intensity shower rain"),
  _("Shower rain"),
  _("Heavy intensity shower rain"),
  _("Ragged shower rain"),
  // Group 6xx: Snow 
  _("Light snow"),
  _("Snow"),
  _("Heavy snow"),
  _("Sleet"),
  _("Shower sleet"),
  _("Light rain and snow"),
  _("Rain and snow"),
  _("Light shower snow"),
  _("Shower snow"),
  _("Heavy shower snow"),
  // Group 7xx: Atmosphere 
  _("Mist"),
  _("Smoke"),
  _("Haze"),
  _("Sand, dust whirls"),
  _("Fog"),
  _("Sand"),
  _("Dust"),
  _("Volcanic ash"),
  _("Squalls"),
  _("Tornado"),
  // Group 800: Clear 
  _("Clear"),
  _("Clear sky"),
  _("Sky is clear"),
  // Group 80x: Clouds
  _("Clouds"),
  _("Few clouds"),
  _("Scattered clouds"),
  _("Broken clouds"),
  _("Overcast clouds")
];