
//////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////
///////////                                       ////////////
///////////         OpenWeatherMap Premium        ////////////
///////////                                       ////////////
//////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////

function OpenWeatherMap(app) {
    //--------------------------------------------------------
    //  Properties
    //--------------------------------------------------------
    this.supportedLanguages = ["ar", "bg", "ca", "cz", "de", "el", "en", "fa", "fi",
     "fr", "gl", "hr", "hu", "it", "ja", "kr", "la", "lt", "mk", "nl", "pl",
      "pt", "ro", "ru", "se", "sk", "sl", "es", "tr", "ua", "vi", "zh_cn", "zh_tw"];

    this.current_url = "https://api.openweathermap.org/data/2.5/weather?";
    this.daily_url = "https://api.openweathermap.org/data/2.5/forecast/daily?";

    //--------------------------------------------------------
    //  Functions
    //--------------------------------------------------------

    this.GetWeather = async function() {
        let currentResult = await this.GetData(this.current_url, this.ParseCurrent);
        let forecastResult = await this.GetData(this.daily_url, this.ParseForecast);
        if (currentResult && forecastResult) {
            return true;
        }
        else {
            app.log.Error("OpenWeatherMap: Could not get Weather information");
            return false;
        }
    };

    // A function as a function parameter 2 levels deep does not know
    // about the top level object information, has to pass it in as a paramater
    this.GetData = async function(baseUrl, ParseFunction) {
        let query = this.ConstructQuery(baseUrl);
        let json;
        if (query != null) {
            app.log.Debug("Query: " + query);
            try {
                json = await app.LoadJsonAsync(query);
                if (json == null) {
                    app.showError(app.errMsg.label.service, app.errMsg.desc.noResponse)
                    return false;                 
                }
            }
            catch(e) {
                app.log.Error("Unable to call API:", e);
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

        }       
    };


    this.ParseCurrent = function(json, self) {
        try {
            if (json.coord) {
              app.weather.coord.lat = json.coord.lat;
              app.weather.coord.lon = json.coord.lon;
            }
            app.weather.location.city = json.name;
            app.weather.location.country = json.sys.country;
            app.weather.location.id = json.id;
            app.weather.dateTime = new Date((json.dt) * 1000);
            app.weather.sunrise = new Date((json.sys.sunrise) * 1000);
            app.weather.sunset = new Date((json.sys.sunset) * 1000);
            if (json.wind) {
              app.weather.wind.speed = json.wind.speed;
              app.weather.wind.degree = json.wind.deg;
            }
            if (json.main) {
              app.weather.main.temperature = json.main.temp;
              app.weather.main.pressure = json.main.pressure;
              app.weather.main.humidity = json.main.humidity;
              app.weather.main.temp_min = json.main.temp_min;
              app.weather.main.temp_max = json.main.temp_max;
            }
            if (json.weather[0]) {
              app.weather.condition.main = json.weather[0].main;
              app.weather.condition.description = json.weather[0].description;
              app.weather.condition.icon = app.weatherIconSafely(json.weather[0].icon, self.ResolveIcon); 
            }
            if (json.clouds) {
              app.weather.cloudiness = json.clouds.all;
            }   
            return true; 
          }
          catch(e) { 
            app.log.Error("OpenWeathermap Weather Parsing error: " + e);
            app.showError(app.errMsg.label.generic, app.errMsg.desc.parse);
            return false; 
          }
    };

    this.ParseForecast = function(json, self) {
        try {
            for (let i = 0; i < app._forecastDays; i++) {
                // Object
                let forecast = {          
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
                    forecast.condition.icon = app.weatherIconSafely(day.weather[0].icon, self.ResolveIcon);
                }     
                app.forecasts.push(forecast);         
            }
            return true;
        }
        catch(e) {
            app.log.Error("OpenWeathermap Forecast Parsing error: " + e);
            app.showError(app.errMsg.label.generic, app.errMsg.desc.parse);
            return false; 
        }
    };

    this.ConstructQuery = function(baseUrl) {
        let query = baseUrl;
        let locString = this.ParseLocation();
        if (locString != null) {
            query = query + locString + "&APPID=";
             // Append Language if supported and enabled
            query += "1c73f8259a86c6fd43c7163b543c8640";
            if (app._translateCondition && app.isLangSupported(app.systemLanguage, this.supportedLanguages)) {
                query = query + "&lang=" + app.systemLanguage;
            }
            return query;
        }
        
        app.showError(app.errMsg.label.noLoc, "");
        app.log.Error("OpenWeatherMap: No Location was provided");
        return null;
    };

    this.ParseLocation = function() {
        let loc = app._location.replace(/ /g, "");
        if (app.isCoordinate(loc)) {
            loc = loc.split(',');
            return "lat=" + loc[0] + "&lon=" + loc[1];
        }
        else if (app.isID(loc)) {
            return "id=" + loc;
        }
        else  // try as a normal query
            return "q=" + loc;
    };


    this.HandleResponseErrors = function(json) {
        let errorMsg = "OpenWeather API: ";
        switch (json.cod) {
            case("400"):
                app.showError(app.errMsg.label.service, app.errMsg.desc.locBad);
                break;
            case("401"):
                app.showError(app.errMsg.label.service, app.errMsg.desc.keyBad);
                break;
            case("404"):
                app.showError(app.errMsg.label.service, app.errMsg.desc.locNotFound);
                break;
            case("429"):
                app.showError(app.errMsg.label.service, app.errMsg.desc.blocked);
                break;
            default:
                app.showError(app.errMsg.label.service, app.errMsg.desc.unknown);
                break;
        };
        app.log.Debug("OpenWeatherMap Error Code: " + json.cod)
        app.log.Error(errorMsg + json.message);
    };


    this.ResolveIcon = function(icon) {
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