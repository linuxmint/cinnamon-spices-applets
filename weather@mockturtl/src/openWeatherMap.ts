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
var weatherIconSafely = utils.weatherIconSafely as (code: string[], icon_type: string) => string;

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
    supportedLanguages = ["ar", "bg", "ca", "cz", "de", "el", "en", "fa", "fi",
     "fr", "gl", "hr", "hu", "it", "ja", "kr", "la", "lt", "mk", "nl", "pl",
      "pt", "ro", "ru", "se", "sk", "sl", "es", "tr", "ua", "vi", "zh_cn", "zh_tw"];

    current_url = "https://api.openweathermap.org/data/2.5/weather?";
    daily_url = "https://api.openweathermap.org/data/2.5/forecast/daily?";

    app: WeatherApplet
    constructor (_app: WeatherApplet) {
      this.app = _app;
    }


    //--------------------------------------------------------
    //  Functions
    //--------------------------------------------------------

    async GetWeather(): Promise<boolean> {
        let currentResult = await this.GetData(this.current_url, this.ParseCurrent);
        let forecastResult = await this.GetData(this.daily_url, this.ParseForecast);
        if (currentResult && forecastResult) {
            return true;
        }
        else {
            this.app.log.Error("OpenWeatherMap: Could not get Weather information");
            return false;
        }
    };

    // A function as a function parameter 2 levels deep does not know
    // about the top level object information, has to pass it in as a paramater
    async GetData(baseUrl: string, ParseFunction: (json: any, context: any) => boolean): Promise<boolean> {
        let query = this.ConstructQuery(baseUrl);
        let json;
        if (query != null) {
            this.app.log.Debug("Query: " + query);
            try {
                json = await this.app.LoadJsonAsync(query);
                if (json == null) {
                    this.app.showError(this.app.errMsg.label.service, this.app.errMsg.desc.noResponse)
                    return false;                 
                }
            }
            catch(e) {
                this.app.log.Error("Unable to call API:" + e);
                return false;
            }

            if (json.cod == 200) {   // Request Success
                return ParseFunction(json, this);
            }
            else {
                this.HandleResponseErrors(json);
                return false;
            }
        }
        else {
          return false;
        }       
    };


    ParseCurrent(json: any, self: OpenWeatherMap): boolean {
        try {
            if (json.coord) {
              self.app.weather.coord.lat = json.coord.lat;
              self.app.weather.coord.lon = json.coord.lon;
            }
            self.app.weather.location.city = json.name;
            self.app.weather.location.country = json.sys.country;
            self.app.weather.location.id = json.id;
            self.app.weather.dateTime = new Date((json.dt) * 1000);
            self.app.weather.sunrise = new Date((json.sys.sunrise) * 1000);
            self.app.weather.sunset = new Date((json.sys.sunset) * 1000);
            if (json.wind) {
              self.app.weather.wind.speed = json.wind.speed;
              self.app.weather.wind.degree = json.wind.deg;
            }
            if (json.main) {
              self.app.weather.main.temperature = json.main.temp;
              self.app.weather.main.pressure = json.main.pressure;
              self.app.weather.main.humidity = json.main.humidity;
              self.app.weather.main.temp_min = json.main.temp_min;
              self.app.weather.main.temp_max = json.main.temp_max;
            }
            if (json.weather[0]) {
              self.app.weather.condition.main = json.weather[0].main;
              self.app.weather.condition.description = json.weather[0].description;
              self.app.weather.condition.icon = weatherIconSafely(self.ResolveIcon(json.weather[0].icon), self.app._icon_type); 
            }
            if (json.clouds) {
              self.app.weather.cloudiness = json.clouds.all;
            }   
            return true; 
          }
          catch(e) { 
            self.app.log.Error("OpenWeathermap Weather Parsing error: " + e);
            self.app.showError(self.app.errMsg.label.generic, self.app.errMsg.desc.parse);
            return false; 
          }
    };

    ParseForecast(json: any, self: OpenWeatherMap): boolean {
        try {
            for (let i = 0; i < self.app._forecastDays; i++) {
                // Object
                let forecast: Forecast = {          
                    dateTime: null,             //Required
                    main: {
                        temp: null,
                        temp_min: null,           //Required
                        temp_max: null,           //Required
                        pressure: null,
                        sea_level: null,
                        grnd_level: null,
                        humidity: null,
                    },
                    condition: {
                        id: null,
                        main: null,               //Required
                        description: null,        //Required
                        icon: null,               //Required
                    },
                    clouds: null,
                    wind: {
                        speed: null,
                        deg: null,
                    }
                };

                let day = json.list[i];
                forecast.dateTime = new Date(day.dt * 1000);
                forecast.main.temp_min = day.temp.min;
                forecast.main.temp_max = day.temp.max;
                forecast.main.pressure = day.pressure;
                forecast.main.humidity = day.humidity;
                forecast.clouds = day.clouds;
                if (day.weather[0].id) {
                    forecast.condition.main = day.weather[0].main;
                    forecast.condition.description = day.weather[0].description;
                    forecast.condition.icon = weatherIconSafely(self.ResolveIcon(day.weather[0].icon), self.app._icon_type);
                }     
                self.app.forecasts.push(forecast);         
            }
            return true;
        }
        catch(e) {
            self.app.log.Error("OpenWeathermap Forecast Parsing error: " + e);
            self.app.showError(self.app.errMsg.label.generic, self.app.errMsg.desc.parse);
            return false; 
        }
    };

    ConstructQuery(baseUrl: string): string {
        let query = baseUrl;
        let locString = this.ParseLocation();
        if (locString != null) {
            query = query + locString + "&APPID=";
             // Append Language if supported and enabled
            query += "1c73f8259a86c6fd43c7163b543c8640";
            if (this.app._translateCondition && isLangSupported(this.app.systemLanguage, this.supportedLanguages)) {
                query = query + "&lang=" + this.app.systemLanguage;
            }
            return query;
        }
        
        this.app.showError(this.app.errMsg.label.noLoc, "");
        this.app.log.Error("OpenWeatherMap: No Location was provided");
        return null;
    };

    ParseLocation(): string {
        let loc = this.app._location.replace(/ /g, "");
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


    HandleResponseErrors(json: any): void {
        let errorMsg = "OpenWeather API: ";
        switch (json.cod) {
            case("400"):
                this.app.showError(this.app.errMsg.label.service, this.app.errMsg.desc.locBad);
                break;
            case("401"):
                this.app.showError(this.app.errMsg.label.service, this.app.errMsg.desc.keyBad);
                break;
            case("404"):
                this.app.showError(this.app.errMsg.label.service, this.app.errMsg.desc.locNotFound);
                break;
            case("429"):
                this.app.showError(this.app.errMsg.label.service, this.app.errMsg.desc.keyBlock);
                break;
            default:
                this.app.showError(this.app.errMsg.label.service, this.app.errMsg.desc.unknown);
                break;
        };
        this.app.log.Debug("OpenWeatherMap Error Code: " + json.cod)
        this.app.log.Error(errorMsg + json.message);
    };


    ResolveIcon(icon: string): string[] {
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
  _("Few clouds"),
  _("Scattered clouds"),
  _("Broken clouds"),
  _("Overcast clouds")
];