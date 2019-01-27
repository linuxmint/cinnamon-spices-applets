var exports = module.exports = {}
const Soup = imports.gi.Soup;

//////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////
///////////                                       ////////////
///////////                DarkSky                ////////////
///////////                                       ////////////
//////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////

exports.OpenWeatherMap = function(app) {
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
        this.GetCurrent();
        this.GetForecast();
    };

    this.GetCurrent = async function() {
        this.ParseCurrent();
    };


    this.GetForecast = async function() {

        this.ParseForecast();
    };


    this.ParseCurrent = function() {

    };

    this.ParseForecast = function() {

    };

    this.ConstructQuery = function() {

    };


    this.HandleResponseErrors = function() {

    };

    this.ResolveIcon = function(icon) {

    };
};