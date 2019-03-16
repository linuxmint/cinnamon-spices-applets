
//////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////
///////////                                       ////////////
///////////                DarkSky                ////////////
///////////                                       ////////////
//////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////
function DarkSky(app) {
    //--------------------------------------------------------
    //  Properties
    //--------------------------------------------------------
    this.descriptionLinelength = 25;
    this.supportedLanguages = [
        'ar', 'az', 'be', 'bg', 'bs', 'ca', 'cs', 'da', 'de', 'el', 'en', 'es',
        'et', 'fi', 'fr', 'he', 'hr', 'hu', 'id', 'is', 'it', 'ja', 'ka', 'ko',
        'kw', 'lv', 'nb', 'nl', 'no', 'pl', 'pt', 'ro', 'ru', 'sk', 'sl', 'sr',
        'sv', 'tet', 'tr', 'uk', 'x-pig-latin', 'zh', 'zh-tw'];

    this.query = "https://api.darksky.net/forecast/";
    

    this.queryUnits = {
        scientific: 'si',       // speed meter/sec, temp C
        imperial: 'us',         // speed miles/hour, temp F
        uk: 'uk2'               // speed miles/hour, temp C
    }
    this.queryUnit = null;

    //--------------------------------------------------------
    //  Functions
    //--------------------------------------------------------
    this.GetWeather = async function() {
        let query = this.ConstructQuery();
        let json;
        let message;
        if (query != "" && query != null) {
            app.log.Debug("DarkSky API query: " + query);
            try {
                json = await app.LoadJsonAsync(query);
                if (json == null) {
                    app.showError(app.errMsg.label.service, app.errMsg.desc.noResponse);
                    return false;
                } 
            }
            catch(e) {
                    app.log.Error("DarkSky: API call failed: " + e);
                    app.showError(app.errMsg.label.service, app.errMsg.desc.noResponse);
                    return false;
            }            
         
            if (!json.code) {                   // No code, Request Success
                return this.ParseWeather(json);
            }
            else {
                this.HandleResponseErrors(json);
                return false;
            }
        }
        app.log.Error("DarkSky: Could not construct query, insufficent information");
        app.showError(app.errMsg.label.service, app.errMsg.desc.locBad);
        return false;
    };


    this.ParseWeather = function(json) {
        try {
            // Current Weather
            app.weather.dateTime = new Date(json.currently.time * 1000);
            app.weather.location.timeZone = json.timezone;
            app.weather.coord.lat = json.latitude;
            app.weather.coord.lon = json.longitude;
            app.weather.sunrise = new Date(json.daily.data[0].sunriseTime * 1000);
            app.weather.sunset = new Date(json.daily.data[0].sunsetTime * 1000);
            app.weather.wind.speed = this.ToMPS(json.currently.windSpeed);
            app.weather.wind.degree = json.currently.windBearing;
            app.weather.main.temperature = this.ToKelvin(json.currently.temperature);
            app.weather.main.pressure = json.currently.pressure;
            app.weather.main.humidity = json.currently.humidity * 100;
                // Using Summary for both, only short description available
            app.weather.condition.main = this.GetShortCurrentSummary(json.currently.summary);        
            app.weather.condition.description = json.currently.summary;
            app.weather.condition.icon = app.weatherIconSafely(json.currently.icon, this.ResolveIcon);
            app.weather.condition.cloudiness = json.currently.cloudCover * 100;
            app.weather.main.feelsLike = this.ToKelvin(json.currently.apparentTemperature); //convert
            // Forecast
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
                  let day = json.daily.data[i];
                  forecast.dateTime = new Date(day.time * 1000);
                  forecast.main.temp_min = this.ToKelvin(day.temperatureLow);
                  forecast.main.temp_max = this.ToKelvin(day.temperatureHigh);
                  forecast.condition.main = this.GetShortSummary(day.summary);
                  forecast.condition.description = this.ProcessSummary(day.summary);
                  forecast.condition.icon = app.weatherIconSafely(day.icon, this.ResolveIcon);
                  forecast.main.pressure = day.pressure;
                  forecast.main.humidity = day.humidity * 100;


                  app.forecasts.push(forecast);
            }
        }
        catch(e) {
            app.log.Error("DarkSky payload parsing error: " + e)
            app.showError(app.errMsg.label.generic, app.errMsg.desc.parse);
            return false;
        }
        return true;
    };


    this.ConstructQuery = function() {
        this.SetQueryUnit();
        let query;
        let key = app._apiKey.replace(" ", "");
        let location = app._location.replace(" ", "");
        if (app.noApiKey()) {
            app.showError(app.errMsg.label.noKey, "");
            return "";
        }
        if (app.isCoordinate(location)) {
            query = this.query + key + "/" + location + 
            "?exclude=minutely,hourly,flags" + "&units=" + this.queryUnit;
            if (app.isLangSupported(app.systemLanguage, this.supportedLanguages) && app._translateCondition) {
                query = query + "&lang=" + app.systemLanguage;
            }
            return query;
        }
        else {
            return "";
        }
    };


    this.HandleResponseErrors = function(json) {
        let code = json.code;
        let error = json.error;
        let errorMsg = "DarkSky API: "
        app.log.Debug("DarksSky API error payload: " + json);
        switch(code) {
            case "400":
                app.log.Error(errorMsg + error);
                break;
            default:
                app.log.Error(errorMsg + error);
                break
        }
    };

    this.ProcessSummary = function(summary) {
        let processed = summary.split(" ");
        let result = "";
        let linelength = 0;
        for (let i = 0; i < processed.length; i++) {
            if (linelength + processed[i].length > this.descriptionLinelength) {
                result = result + "\n";
                linelength = 0;
            }
            result = result + processed[i] + " ";
            linelength = linelength + processed[i].length + 1;
        }
        return result;
    };

    this.GetShortSummary = function(summary) {
        let processed = summary.split(" ");
        let result = "";
        for (let i = 0; i < 2; i++) {
            if (!/[\(\)]/.test(processed[i]) && !(app.DarkSkyFilterWords.includes(processed[i]))) {
                result = result + processed[i] + " ";
            }
        }
        return result;
    };

    this.GetShortCurrentSummary = function(summary) {
        let processed = summary.split(" ");
        let result = "";
        let maxLoop;
        (processed.length < 2) ? maxLoop = processed.length : maxLoop = 2;
        for (let i = 0; i < maxLoop; i++) {
            if (processed[i] != "and") {
                result = result + processed[i] + " ";
            }
        }
        return result;
    }

    this.ResolveIcon = function(icon) {
        switch (icon) {
            case "rain":
              return ['weather-rain', 'weather-showers-scattered', 'weather-freezing-rain']
            case "snow":
              return ['weather-snow']
            case "fog":
              return ['weather-fog']
           // case "04d":/* broken clouds day */
           //   return ['weather_overcast', 'weather-clouds', "weather-few-clouds"]
            //case "04n":/* broken clouds night */
            //  return ['weather_overcast', 'weather-clouds', "weather-few-clouds-night"]
           // case "03n":/* mostly cloudy (night) */
           //   return ['weather-clouds-night', 'weather-few-clouds-night']
            case "cloudy":/* mostly cloudy (day) */
              return ['weather-overcast', 'weather-clouds', , 'weather-few-clouds']
            case "partly-cloudy-night":
              return ['weather-few-clouds-night', "weather-few-clouds"]
            case "partly-cloudy-day":
              return ['weather-few-clouds']
            case "clear-night":
              return ['weather-clear-night']
            case "clear-day":
              return ['weather-clear']
            // Have not seen Storm or Showers icons returned yet
            case "storm":
              return ['weather-storm']
            case "showers":
              return ['weather-showers']
            // There is no guarantee that there is a wind icon
            case "wind":
                return ["weather-wind", "wind", "weather-breeze", 'weather-clouds', 'weather-few-clouds']
            default:
              return ['weather-severe-alert']
          }
    };

    this.SetQueryUnit = function() {
        if (app._temperatureUnit == app.WeatherUnits.CELSIUS){
            if (app._windSpeedUnit == app.WeatherWindSpeedUnits.KPH || app._windSpeedUnit == app.WeatherWindSpeedUnits.MPS) {
                this.queryUnit = this.queryUnits.scientific;
            }
            else {
                this.queryUnit = this.queryUnits.uk;
            }
        }
        else {
            this.queryUnit = this.queryUnits.imperial;
        }
    };

    this.ToKelvin = function(temp) {
        if (this.queryUnit == this.queryUnits.imperial) {
            return app.FahrenheitToKelvin(temp);
        }
        else {
            return app.CelsiusToKelvin(temp);
        }

    };

    this.ToMPS = function(speed) {
        if (this.queryUnit == this.queryUnits.scientific) {
            return speed;
        }
        else {
            return app.MPHtoMPS(speed);
        }
    };
};