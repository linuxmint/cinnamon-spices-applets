var exports = module.exports = {}
const Soup = imports.gi.Soup;


//////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////
///////////                                       ////////////
///////////                DarkSky                ////////////
///////////                                       ////////////
//////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////
exports.DarkSky = function(app) {
    //--------------------------------------------------------
    //  Properties
    //--------------------------------------------------------
    this.supportedLanguages = [
        'ar', 'az', 'be', 'bg', 'bs', 'ca', 'cs', 'da', 'de', 'el', 'en', 'es',
        'et', 'fi', 'fr', 'he', 'hr', 'hu', 'id', 'is', 'it', 'ja', 'ka', 'ko',
        'kw', 'lv', 'nb', 'nl', 'no', 'pl', 'pt', 'ro', 'ru', 'sk', 'sl', 'sr',
        'sv', 'tet', 'tr', 'uk', 'x-pig-latin', 'zh', 'zh-tw'];

    this.query = "https://api.darksky.net/forecast/";


    //--------------------------------------------------------
    //  Functions
    //--------------------------------------------------------
    this.GetWeather = async function() {
        let query = this.ConstructQuery();
        let json;
        if (query != "" | query != null) {
            app.log.Debug("DarkSky API query: " + query);
            try {
                let message = Soup.Message.new('GET', query);
                app._httpSession.send_message(message);
                json =  JSON.parse(message.response_body.data);
            }
            catch(e) {
                app.log.Error("Unable to Call API: " + e);
                return false;
            }
            if (!json) {
                app.log.Error("No Response from API");
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
        app.log.Error("Location provided in an incorrect format");
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
            app.weather.wind.speed = json.currently.windSpeed;
            app.weather.wind.degree = json.currently.windBearing;
            app.weather.main.temperature = app.CelsiusToKelvin(json.currently.temperature);
            app.weather.main.pressure = json.currently.pressure;
            app.weather.main.humidity = json.currently.humidity * 100;
                // Using Summary for both, only short description available
            app.weather.condition.main = json.currently.summary;        
            app.weather.condition.description = json.currently.summary;
            app.weather.condition.icon = app.weatherIconSafely(json.currently.icon, this.ResolveIcon);
            app.weather.condition.cloudiness = json.currently.cloudCover * 100;
            app.weather.main.feelsLike = app.CelsiusToKelvin(json.currently.apparentTemperature); //convert
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
                  forecast.main.temp_min = app.CelsiusToKelvin(day.temperatureLow);
                  forecast.main.temp_max = app.CelsiusToKelvin(day.temperatureHigh);
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
            return false;
        }
        return true;
    };


    this.ConstructQuery = function() {
        let query;
        if (app.isCoordinate(app._location)) {
            query = this.query + app._apiKey + "/" + app._location + 
            "?exclude=minutely,hourly,flags" + "&units=si";
            if (app.isLangSupported(app.systemLanguage, this.supportedLanguages)) {
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
            case 400:
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
            if (linelength + processed[i].length < 18) {
                result = result + processed[i] + " ";
                linelength = linelength + processed[i].length + 1;
            }
            else {
                result = result + "\n";
                linelength = 0;
                result = result + processed[i] + " ";
            }
        }
        return result;
    };

    this.GetShortSummary = function(summary) {
        let processed = summary.split(" ");
        let result = "";
        for (let i = 0; i < 2; i++) {
            if (!/[\(\)]/.test(processed[i])) {
                result = result + processed[i] + " ";
            }
        }
        return result;
    };

    this.ResolveIcon = function(icon) {
        switch (icon) {
            case "rain":/* rain day */
              return ['weather-rain', 'weather-showers-scattered', 'weather-freezing-rain']
            //case "09n":/* showers nigh*/
              //return ['weather-showers']
            //case "09d":/* showers day */
              //return ['weather-showers']
            case "snow":/* snow day*/
              return ['weather-snow']
            case "fog":/* mist day */
              return ['weather-fog']
           // case "04d":/* broken clouds day */
           //   return ['weather_overcast', 'weather-clouds', "weather-few-clouds"]
            //case "04n":/* broken clouds night */
            //  return ['weather_overcast', 'weather-clouds', "weather-few-clouds-night"]
           // case "03n":/* mostly cloudy (night) */
           //   return ['weather-clouds-night', 'weather-few-clouds-night']
            case "cloudy":/* mostly cloudy (day) */
              return ['weather-clouds', 'weather-overcast', 'weather-few-clouds']
            case "partly-cloudy-night":/* partly cloudy (night) */
              return ['weather-few-clouds-night']
            case "partly-cloudy-day":/* partly cloudy (day) */
              return ['weather-few-clouds']
            case "clear-night":/* clear (night) */
              return ['weather-clear-night']
            case "clear-day":/* sunny */
              return ['weather-clear']
            //case "11d":/* storm day */
            //  return ['weather-storm']
            //case "11n":/* storm night */
            //  return ['weather-storm']
            case "wind":
                return ["weather-wind"]
            default:
              return ['weather-severe-alert']
          }
    };
};