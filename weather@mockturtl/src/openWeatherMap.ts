//////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////
///////////                                       ////////////
///////////         OpenWeatherMap Premium        ////////////
///////////                                       ////////////
//////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////

class OpenWeatherMap {
    //--------------------------------------------------------
    //  Properties
    //--------------------------------------------------------
    supportedLanguages = ["ar", "bg", "ca", "cz", "de", "el", "en", "fa", "fi",
     "fr", "gl", "hr", "hu", "it", "ja", "kr", "la", "lt", "mk", "nl", "pl",
      "pt", "ro", "ru", "se", "sk", "sl", "es", "tr", "ua", "vi", "zh_cn", "zh_tw"];

    current_url = "https://api.openweathermap.org/data/2.5/weather?";
    daily_url = "https://api.openweathermap.org/data/2.5/forecast/daily?";

    app: MyApplet
    constructor (_app: MyApplet) {
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


    ParseCurrent(json: any, self: any): boolean {
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
              self.app.weather.condition.icon = self.app.weatherIconSafely(json.weather[0].icon, self.ResolveIcon); 
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

    ParseForecast(json: any, self: any): boolean {
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
                    forecast.condition.icon = self.app.weatherIconSafely(day.weather[0].icon, self.ResolveIcon);
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
            if (this.app._translateCondition && this.app.isLangSupported(this.app.systemLanguage, this.supportedLanguages)) {
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
        if (this.app.isCoordinate(loc)) {
            let locArr = loc.split(',');
            return "lat=" + locArr[0] + "&lon=" + locArr[1];
        }
        else if (this.app.isID(loc)) {
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


    ResolveIcon(icon: string): Array<string> {
        // https://openweathermap.org/weather-conditions
       /* fallback icons are: weather-clear-night 
       weather-clear weather-few-clouds-night weather-few-clouds 
       weather-fog weather-overcast weather-severe-alert weather-showers 
       weather-showers-scattered weather-snow weather-storm */
       switch (icon) {
           case "10d":/* rain day */
             return ['weather-rain', 'weather-showers-scattered', 'weather-freezing-rain']
           case "10n":/* rain night */
             return ['weather-rain', 'weather-showers-scattered', 'weather-freezing-rain']
           case "09n":/* showers nigh*/
             return ['weather-showers']
           case "09d":/* showers day */
             return ['weather-showers']
           case "13d":/* snow day*/
             return ['weather-snow']
           case "13n":/* snow night */
             return ['weather-snow']
           case "50d":/* mist day */
             return ['weather-fog']
           case "50n":/* mist night */
             return ['weather-fog']
           case "04d":/* broken clouds day */
             return ['weather_overcast', 'weather-clouds', "weather-few-clouds"]
           case "04n":/* broken clouds night */
             return ['weather_overcast', 'weather-clouds', "weather-few-clouds-night"]
           case "03n":/* mostly cloudy (night) */
             return ['weather-clouds-night', 'weather-few-clouds-night']
           case "03d":/* mostly cloudy (day) */
             return ['weather-clouds', 'weather-overcast', 'weather-few-clouds']
           case "02n":/* partly cloudy (night) */
             return ['weather-few-clouds-night']
           case "02d":/* partly cloudy (day) */
             return ['weather-few-clouds']
           case "01n":/* clear (night) */
             return ['weather-clear-night']
           case "01d":/* sunny */
             return ['weather-clear']
           case "11d":/* storm day */
             return ['weather-storm']
           case "11n":/* storm night */
             return ['weather-storm']
           default:
             return ['weather-severe-alert']
         }
   };
};