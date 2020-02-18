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
var icons = utils.icons;
var weatherIconSafely = utils.weatherIconSafely as (code: string[], icon_type: string) => string;

//////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////
///////////                                       ////////////
///////////                Weatherbit             ////////////
///////////                                       ////////////
//////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////

class Weatherbit implements WeatherProvider {

    //--------------------------------------------------------
    //  Properties
    //--------------------------------------------------------
    private descriptionLinelength = 25;
    private supportedLanguages = [
        'ar', 'az', 'be', 'bg', 'bs', 'ca', 'cz', 'da', 'de', 'el', 'en',
        'et', 'fi', 'fr', 'hr', 'hu', 'id', 'is', 'it',
        'kw', 'lv', 'nb', 'nl', 'pl', 'pt', 'ro', 'ru', 'sk', 'sl', 'sr',
        'sv', 'tr', 'uk', 'zh', 'zh-tw'];

    private current_url = "https://api.weatherbit.io/v2.0/current?";
    private daily_url = "https://api.weatherbit.io/v2.0/forecast/daily?";
    
    private unit: queryUnits = null;

    private app: WeatherApplet

    constructor(_app: WeatherApplet) {
        this.app = _app;
    }

    //--------------------------------------------------------
    //  Functions
    //--------------------------------------------------------
    public async GetWeather(): Promise<WeatherData> {
        let currentResult = await this.GetData(this.current_url, this.ParseCurrent) as WeatherData;
        if (!currentResult) return null;
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
              this.app.HandleHTTPError("weatherbit", e, this.app, this.HandleHTTPError);
                return null;
            }

            if (json == null) {
              this.app.HandleError({type: "soft", detail: "no api response", service: "weatherbit"});
              return null;                 
            }

            return ParseFunction(json, this);
        }
        else {
          return null;
        }       
    };


    private ParseCurrent(json: any, self: Weatherbit): WeatherData {
        json  = json.data[0];
        try {
          let weather: WeatherData = {
            coord: {
              lat: json.lat,
              lon: json.lon
            },
            location: {
              city: json.city_name,
              country: json.country_code,
              url: null,
              timeZone: json.timezone
            },
            date: new Date(json.ts * 1000),
            sunrise: self.TimeToDate(json.sunrise),
            sunset: self.TimeToDate(json.sunset),
            wind: {
              speed: json.wind_spd,
              degree: json.wind_dir
            },
            temperature: json.temp,
            pressure: json.pres,
            humidity: json.rh,
            condition: {
              main: json.weather.description,
              description: json.weather.description,
              icon: weatherIconSafely(self.ResolveIcon(json.weather.icon), self.app._icon_type),
              customIcon: self.ResolveCustomIcon(json.weather.icon)
            },
            extra_field: {
              name: _("Feels Like"),
              value: json.app_temp,
              type: "temperature"
            },
            forecasts: []
          };
          
          return weather; 
        }
        catch(e) { 
          self.app.log.Error("Weatherbit Weather Parsing error: " + e);
          self.app.HandleError({type: "soft", service: "weatherbit", detail: "unusal payload", message: _("Failed to Process Current Weather Info")})
          return null; 
        }
    };

    private ParseForecast(json: any, self: Weatherbit): ForecastData[] {
      let forecasts: ForecastData[] = [];
      try {
        for (let i = 0; i < self.app._forecastDays; i++) {
          let day = json.data[i];
          let forecast: ForecastData = {          
              date: new Date(day.ts * 1000),
              temp_min: day.min_temp,
              temp_max: day.max_temp,
              condition: {
                  main: day.weather.description,
                  description: day.weather.description,
                  icon: weatherIconSafely(self.ResolveIcon(day.weather.icon), self.app._icon_type),
                  customIcon: self.ResolveCustomIcon(day.weather.icon)
              },
          };
          forecasts.push(forecast);         
        }
        return forecasts;
      }
      catch(e) {
          self.app.log.Error("Weatherbit Forecast Parsing error: " + e);
          self.app.HandleError({type: "soft", service: "weatherbit", detail: "unusal payload", message: _("Failed to Process Forecast Info")})
          return null; 
      }
    };

    private TimeToDate(time: string): Date {
        let hoursMinutes = time.split(":");
        let date = new Date();
        date.setHours(parseInt(hoursMinutes[0]))
        date.setMinutes(parseInt(hoursMinutes[1]))
        return date;
    }


    private ConstructQuery(query: string): string {
        let key = this.app._apiKey.replace(" ", "");
        let location = this.app._location.replace(" ", "");
        if (this.app.noApiKey()) {
            this.app.log.Error("DarkSky: No API Key given");
            this.app.HandleError({
                type: "hard",
                 userError: true,
                  "detail": "no key",
                   message: _("Please enter API key in settings,\nor get one first on https://www.weatherbit.io/account/create")});
            return "";
        }
        if (isCoordinate(location)) {
            let latLong = location.split(",");
            query = query + "key="+ key + "&lat=" + latLong[0] + "&lon=" + latLong[1] + "&units=S"
            this.app.log.Debug("System language is " + this.app.systemLanguage.toString());
            if (isLangSupported(this.app.systemLanguage, this.supportedLanguages) && this.app._translateCondition) {
                query = query + "&lang=" + this.app.systemLanguage;
            }
            return query;
        }
        else {
            this.app.log.Error("Weatherbit: Location is not a coordinate");
            this.app.HandleError({type: "hard", detail: "bad location format", service:"weatherbit", userError: true, message: ("Please Check the location,\nmake sure it is a coordinate") })
            return "";
        }
    };

    /** Handles API Scpecific HTTP errors  */
    public HandleHTTPError(error: HttpError, uiError: AppletError): AppletError {
        if (error.code == 403) { // DarkSky returns auth error on the http level when key is wrong
            uiError.detail = "bad key"
            uiError.message = _("Please Make sure you\nentered the API key correctly and your account is not locked");
            uiError.type = "hard";
            uiError.userError = true;
        }
        return uiError;
    }

    private ResolveIcon(icon: string): string[] {
        switch (icon) {
            // Tunderstorms
            case "t01n":
            case "t01d": 
            case "t02n":
            case "t02d":
            case "t03n":
            case "t03d":
            case "t04n":
            case "t04d":
            case "t05n":
            case "t05d":
                return [icons.storm]
            // Drizzle
            case "d01d":
            case "d01n":
            case "d02d":
            case "d02n":
            case "d03d":
            case "d03n":
                return [icons.showers_scattered, icons.rain, icons.rain_freezing ]
            // Rain
            case "r01d":
            case "r01n":
            case "r02d":
            case "r02n":
            case "r03d":
            case "r03n":
            case "r04d":
            case "r04n":
            case "r05d":
            case "r05n":
            case "r06d":
            case "r06n":
                return [icons.rain, icons.rain_freezing, icons.showers_scattered]
            // Snow
            case "s01d":
            case "s01n":
            case "s02d":
            case "s02n":
            case "s03d":
            case "s03n":
            case "s04d":
            case "s04n":
            case "s06d":
            case "s06n":
                return [icons.snow]
            // Sleet
            case "s05d":
            case "s05n":
                return [icons.rain_freezing, icons.rain, icons.showers_scattered]
            // Fog, Sand, haze, smoke, mist
            case "a01d":
            case "a01n":
            case "a02d":
            case "a02n":
            case "a03d":
            case "a03n":
            case "a04d":
            case "a04n":
            case "a05d":
            case "a05n":
            case "a06d":
            case "a06n":
                return [icons.fog]
            case "c02d":
                return [icons.few_clouds_day]
            case "c02n":
                return [icons.few_clouds_night]
            case "c01n":
                return [icons.clear_night]
            case "c01d":
                return [icons.clear_day]
            case "c03d":
                return [icons.clouds, icons.few_clouds_day, icons.overcast]
            case "c03n":
                return [icons.clouds, icons.few_clouds_night, icons.overcast]
            case "c04n":
                return [icons.overcast, icons.clouds, icons.few_clouds_night]
            case "c04d":
                return [icons.overcast, icons.clouds, icons.few_clouds_day]
            case "u00d":
            case "u00n":
                return [icons.alert]
            default:
              return [icons.alert]
          }
    };

    private ResolveCustomIcon(icon: string): CustomIcons {
        switch (icon) {
            // Tunderstorms
            case "t01d": 
            case "t02d":
            case "t03d":
                return "Cloud-Lightning-Sun"
            case "t04d":
            case "t05d":
                return "Cloud-Lightning"
            case "t01n":
            case "t02n":
            case "t03n":
                return "Cloud-Lightning-Moon"
            case "t04n":
            case "t05n":
                return "Cloud-Lightning"
            // Drizzle
            case "d01d":
            case "d02d":
            case "d03d":
            case "d01n":
            case "d02n":
            case "d03n":
                return "Cloud-Drizzle"
            // Rain
            case "r01d":
            case "r02d":
            case "r03d":
            case "r01n":
            case "r02n":
            case "r03n":
                return "Cloud-Rain"
            case "r04d":
            case "r05d":
                return "Cloud-Rain-Sun"
            case "r06d":
                return "Cloud-Rain"
            case "r04n":
            case "r05n":
                return "Cloud-Rain-Moon"
            case "r06n":
                return "Cloud-Rain"
            // Snow
            case "s01d":
            case "s04d":
                return "Cloud-Snow-Sun"
            case "s02d":
            case "s03d":
            case "s06d":
                return "Cloud-Snow"
            case "s01n":
            case "s04n":
                return "Cloud-Snow-Moon"
            case "s02n":
            case "s03n":
            case "s06n":
                return "Cloud-Snow"
            // Sleet
            case "s05d":
            case "s05n":
                return "Cloud-Hail"
            // Fog, Sand, haze, smoke, mist
            case "a01d":
            case "a02d":
            case "a03d":
            case "a04d":
            case "a05d":
            case "a06d":
                return "Cloud-Fog-Sun"
            case "a01n":
            case "a02n":
            case "a03n":
            case "a04n":
            case "a05n":
            case "a06n":
                return "Cloud-Fog-Moon"
            case "c02d":
                return "Cloud-Sun"
            case "c02n":
                return "Cloud-Moon"
            case "c01n":
                return "Moon"
            case "c01d":
                return "Sun"
            case "c03d":
                return "Cloud-Sun"
            case "c03n":
                return "Cloud-Moon"
            case "c04n":
                return "Cloud"
            case "c04d":
                return "Cloud"
            case "u00d":
            case "u00n":
                return "Cloud-Refresh"
            default:
              return "Cloud-Refresh"
          }
    }
};

/**
 *  M - [DEFAULT] Metric (Celcius, m/s, mm)
    S - Scientific (Kelvin, m/s, mm)
    I - Fahrenheit (F, mph, in)
 */
type queryUnits = 'M' | 'S' | 'I';

