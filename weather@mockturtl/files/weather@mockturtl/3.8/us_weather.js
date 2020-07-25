function importModule(path) {
    if (typeof require !== 'undefined') {
        return require('./' + path);
    }
    else {
        if (!AppletDir)
            var AppletDir = imports.ui.appletManager.applets['weather@mockturtl'];
        return AppletDir[path];
    }
}
const UUID = "weather@mockturtl";
imports.gettext.bindtextdomain(UUID, imports.gi.GLib.get_home_dir() + "/.local/share/locale");
function _(str) {
    return imports.gettext.dgettext(UUID, str);
}
var utils = importModule("utils");
var weatherIconSafely = utils.weatherIconSafely;
var SunCalc = importModule("sunCalc").SunCalc;
var IsNight = utils.IsNight;
var CelsiusToKelvin = utils.CelsiusToKelvin;
var FahrenheitToKelvin = utils.FahrenheitToKelvin;
var KPHtoMPS = utils.MPHtoMPS;
var get = utils.get;
var compassToDeg = utils.compassToDeg;
var GetDistance = utils.GetDistance;
class USWeather {
    constructor(_app) {
        this.prettyName = "US Weather";
        this.name = "US Weather";
        this.maxForecastSupport = 7;
        this.website = "https://www.metoffice.gov.uk/";
        this.maxHourlyForecastSupport = 156;
        this.sitesUrl = "https://api.weather.gov/points/";
        this.grid = null;
        this.MAX_STATION_DIST = 50000;
        this.observationStations = null;
        this.currentLoc = null;
        this.app = _app;
        this.sunCalc = new SunCalc();
    }
    async GetWeather(loc) {
        if (loc == null)
            return null;
        if (!this.grid || !this.observationStations || this.currentLoc.text != loc.text) {
            this.app.log.Print("Downloading new site data");
            this.currentLoc = loc;
            let grid = await this.GetGridData(loc);
            if (grid == null)
                return null;
            let observationStations = await this.GetStationData(grid.properties.observationStations);
            if (observationStations == null)
                return null;
            this.grid = grid;
            this.observationStations = observationStations;
        }
        else {
            this.app.log.Debug("Site data downloading skipped");
        }
        let observations = await this.GetObservationsInRange(this.MAX_STATION_DIST, loc, this.observationStations);
        let hourly = null;
        let forecast = null;
        try {
            let hourlyForecastPromise = this.app.LoadJsonAsync(this.grid.properties.forecastHourly + "?units=si");
            let forecastPromise = this.app.LoadJsonAsync(this.grid.properties.forecast);
            hourly = await hourlyForecastPromise;
            forecast = await forecastPromise;
        }
        catch (e) {
            this.app.log.Error("Failed to obtain forecast Data, error: " + JSON.stringify(e, null, 2));
            this.app.HandleError({ type: "soft", detail: "bad api response", message: _("Could not get forecast for your area") });
            return null;
        }
        let weather = this.ParseCurrent(observations, hourly);
        weather.forecasts = this.ParseForecast(forecast);
        weather.hourlyForecasts = this.ParseHourlyForecast(hourly, this);
        return weather;
    }
    ;
    async GetGridData(loc) {
        try {
            let siteData = await this.app.LoadJsonAsync(this.sitesUrl + loc.text, this.OnObtainingGridData);
            this.app.log.Debug("Grid found: " + JSON.stringify(siteData, null, 2));
            return siteData;
        }
        catch (e) {
            this.app.HandleError({
                type: "soft",
                userError: true,
                detail: "no network response",
                service: "us-weather",
                message: _("Unexpected response from API")
            });
            this.app.log.Error("Failed to Obtain Grid data, error: " + JSON.stringify(e, null, 2));
            return null;
        }
    }
    async GetStationData(stationListUrl) {
        try {
            let stations = await this.app.LoadJsonAsync(stationListUrl);
            return stations.features;
        }
        catch (e) {
            this.app.log.Error("Failed to obtain station data, error: " + JSON.stringify(e, null, 2));
            this.app.HandleError({
                type: "soft",
                userError: true,
                detail: "no network response",
                service: "us-weather",
                message: _("Unexpected response from API")
            });
            return null;
        }
    }
    async GetObservationsInRange(range, loc, stations) {
        let observations = [];
        for (let index = 0; index < stations.length; index++) {
            const element = stations[index];
            element.dist = GetDistance(element.geometry.coordinates[1], element.geometry.coordinates[0], loc.lat, loc.lon);
            if (element.dist > range)
                break;
            try {
                observations.push(await this.app.LoadJsonAsync(stations[index].id + "/observations/latest"));
            }
            catch (_a) {
                this.app.log.Debug("Failed to get observations from " + stations[index].id);
            }
        }
        return observations;
    }
    OnObtainingGridData(message) {
        if (message.status_code == 404) {
            let data = JSON.parse(get(["response_body", "data"], message));
            if (data.title == "Data Unavailable For Requested Point") {
                return {
                    type: "hard",
                    userError: true,
                    detail: "location not covered",
                    service: "us-weather",
                    message: _("Location is outside US, please use a different provider.")
                };
            }
        }
        return null;
    }
    MeshObservationData(observations) {
        if (observations.length < 1)
            return null;
        let result = observations[0];
        if (observations.length == 1)
            return result;
        for (let index = 1; index < observations.length; index++) {
            const element = observations[index];
            let debugText = " Observation data missing, plugged in from ID " +
                element.id + ", index " + index +
                ", distance "
                + Math.round(GetDistance(element.geometry.coordinates[1], element.geometry.coordinates[0], this.currentLoc.lat, this.currentLoc.lon))
                + " metres";
            if (result.properties.icon == null) {
                result.properties.icon = element.properties.icon;
                result.properties.textDescription = element.properties.textDescription;
                this.app.log.Debug("Weather condition" + debugText);
            }
            if (result.properties.temperature.value == null) {
                result.properties.temperature.value = element.properties.temperature.value;
                this.app.log.Debug("Temperature" + debugText);
            }
            if (result.properties.windSpeed.value == null) {
                result.properties.windSpeed.value = element.properties.windSpeed.value;
                this.app.log.Debug("Wind Speed" + debugText);
            }
            if (result.properties.windDirection.value == null) {
                result.properties.windDirection.value = element.properties.windDirection.value;
                this.app.log.Debug("Wind degree" + debugText);
            }
            if (result.properties.barometricPressure.value == null) {
                result.properties.barometricPressure.value = element.properties.barometricPressure.value;
                this.app.log.Debug("Pressure" + debugText);
            }
            if (result.properties.relativeHumidity.value == null) {
                result.properties.relativeHumidity.value = element.properties.relativeHumidity.value;
                this.app.log.Debug("Humidity" + debugText);
            }
            if (result.properties.windChill.value == null) {
                result.properties.windChill.value = element.properties.windChill.value;
                this.app.log.Debug("WindChill" + debugText);
            }
            if (result.properties.visibility.value == null) {
                result.properties.visibility.value = element.properties.visibility.value;
                this.app.log.Debug("Visibility" + debugText);
            }
        }
        return result;
    }
    ParseCurrent(json, hourly) {
        if (json.length == 0) {
            this.app.log.Error("No observation stations/data are available");
            return null;
        }
        let observation = this.MeshObservationData(json);
        let timestamp = new Date(observation.properties.timestamp);
        let times = this.sunCalc.getTimes(new Date(), observation.geometry.coordinates[1], observation.geometry.coordinates[0], observation.properties.elevation.value);
        try {
            let weather = {
                coord: {
                    lat: observation.geometry.coordinates[1],
                    lon: observation.geometry.coordinates[0]
                },
                location: {
                    city: null,
                    country: null,
                    url: "https://forecast.weather.gov/MapClick.php?lat=" + this.currentLoc.lat.toString() + "&lon=" + this.currentLoc.lon.toString(),
                    timeZone: this.observationStations[0].properties.timeZone,
                    distanceFrom: this.observationStations[0].dist
                },
                date: timestamp,
                sunrise: times.sunrise,
                sunset: times.sunset,
                wind: {
                    speed: KPHtoMPS(observation.properties.windSpeed.value),
                    degree: observation.properties.windDirection.value
                },
                temperature: CelsiusToKelvin(observation.properties.temperature.value),
                pressure: observation.properties.barometricPressure.value / 100,
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
            if (weather.condition == null && hourly != null) {
                weather.condition = this.ResolveCondition(hourly.properties.periods[0].icon);
            }
            return weather;
        }
        catch (e) {
            this.app.log.Error("US Weather Parsing error: " + e);
            this.app.HandleError({ type: "soft", service: "us-weather", detail: "unusual payload", message: _("Failed to Process Current Weather Info") });
            return null;
        }
    }
    ;
    ParseForecast(json) {
        let forecasts = [];
        try {
            let startIndex = 0;
            if (json.properties.periods[0].isDaytime == false) {
                startIndex = 1;
                let today = json.properties.periods[0];
                let forecast = {
                    date: new Date(today.startTime),
                    temp_min: FahrenheitToKelvin(today.temperature),
                    temp_max: FahrenheitToKelvin(today.temperature),
                    condition: this.ResolveCondition(today.icon),
                };
                forecasts.push(forecast);
            }
            for (let i = startIndex; i < json.properties.periods.length; i += 2) {
                let day = json.properties.periods[i];
                let night = json.properties.periods[i + 1];
                if (!night)
                    night = day;
                let forecast = {
                    date: new Date(day.startTime),
                    temp_min: FahrenheitToKelvin(night.temperature),
                    temp_max: FahrenheitToKelvin(day.temperature),
                    condition: this.ResolveCondition(day.icon),
                };
                forecasts.push(forecast);
            }
            return forecasts;
        }
        catch (e) {
            this.app.log.Error("US Weather Forecast Parsing error: " + e);
            this.app.HandleError({ type: "soft", service: "us-weather", detail: "unusual payload", message: _("Failed to Process Forecast Info") });
            return null;
        }
    }
    ;
    ParseHourlyForecast(json, self) {
        let forecasts = [];
        try {
            for (let i = 0; i < json.properties.periods.length; i++) {
                let hour = json.properties.periods[i];
                let timestamp = new Date(hour.startTime);
                let forecast = {
                    date: timestamp,
                    temp: CelsiusToKelvin(hour.temperature),
                    condition: self.ResolveCondition(hour.icon, !hour.isDaytime),
                    precipitation: null
                };
                forecasts.push(forecast);
            }
            return forecasts;
        }
        catch (e) {
            self.app.log.Error("US Weather service Forecast Parsing error: " + e);
            self.app.HandleError({ type: "soft", service: "us-weather", detail: "unusual payload", message: _("Failed to Process Hourly Forecast Info") });
            return null;
        }
    }
    ResolveCondition(icon, isNight = false) {
        if (icon == null)
            return null;
        let code = icon.match(/(?!\/)[a-z_]+(?=(\?|,))/);
        let iconType = this.app.config.IconType();
        switch (code[0]) {
            case "skc":
                return {
                    main: _("Clear"),
                    description: _("Clear"),
                    customIcon: (isNight) ? "night-clear-symbolic" : "day-sunny-symbolic",
                    icon: weatherIconSafely(["weather-severe-alert"], iconType)
                };
            case "few":
                return {
                    main: _("Few Clouds"),
                    description: _("Few clouds"),
                    customIcon: (isNight) ? "night-alt-cloudy-symbolic" : "day-cloudy-symbolic",
                    icon: weatherIconSafely(["weather-clear-night", "weather-severe-alert"], iconType)
                };
            case "sct":
                return {
                    main: _("Partly Cloudy"),
                    description: _("Partly cloudy"),
                    customIcon: (isNight) ? "night-alt-cloudy-symbolic" : "day-cloudy-symbolic",
                    icon: weatherIconSafely(["weather-clear", "weather-severe-alert"], iconType)
                };
            case "bkn":
                return {
                    main: _("Mostly Cloudy"),
                    description: _("Mostly cloudy"),
                    customIcon: (isNight) ? "night-alt-cloudy-symbolic" : "day-cloudy-symbolic",
                    icon: weatherIconSafely(["weather-clouds-night", "weather-overcast", "weather-severe-alert"], iconType)
                };
            case "ovc":
                return {
                    main: _("Overcast"),
                    description: _("Overcast"),
                    customIcon: "cloudy-symbolic",
                    icon: weatherIconSafely(["weather-clouds", "weather-overcast", "weather-severe-alert"], iconType)
                };
            case "wind_skc":
                return {
                    main: _("Clear"),
                    description: _("Clear and windy"),
                    customIcon: (IsNight) ? "night-alt-wind-symbolic" : "day-windy-symbolic",
                    icon: weatherIconSafely((isNight) ? ["weather-clear-night"] : ["weather-clear"], iconType)
                };
            case "wind_few":
                return {
                    main: _("Few Clouds"),
                    description: _("Few clouds and windy"),
                    customIcon: (IsNight) ? "night-alt-cloudy-windy-symbolic" : "day-cloudy-windy-symbolic",
                    icon: weatherIconSafely((isNight) ? ["weather-few-clouds-night"] : ["weather-few-clouds"], iconType)
                };
            case "wind_sct":
                return {
                    main: _("Partly Cloudy"),
                    description: _("Partly cloudy and windy"),
                    customIcon: (IsNight) ? "night-alt-cloudy-windy-symbolic" : "day-cloudy-windy-symbolic",
                    icon: weatherIconSafely((isNight) ? ["weather-clouds-night"] : ["weather-clouds"], iconType)
                };
            case "wind_bkn":
                return {
                    main: _("Mostly Cloudy"),
                    description: _("Mostly cloudy and windy"),
                    customIcon: (IsNight) ? "night-alt-cloudy-windy-symbolic" : "day-cloudy-windy-symbolic",
                    icon: weatherIconSafely((isNight) ? ["weather-clouds-night"] : ["weather-clouds"], iconType)
                };
            case "wind_ovc":
                return {
                    main: _("Overcast"),
                    description: _("Overcast and windy"),
                    customIcon: "cloudy-symbolic",
                    icon: weatherIconSafely(["weather-overcast", "weather-many-clouds", "weather-severe-alert"], iconType)
                };
            case "snow":
                return {
                    main: _("Snow"),
                    description: _("Snow"),
                    customIcon: "snow-symbolic",
                    icon: weatherIconSafely(["weather-snow", "weather-severe-alert"], iconType)
                };
            case "rain_snow":
                return {
                    main: _("Rain"),
                    description: _("Snowy rain"),
                    customIcon: "rain-mix-symbolic",
                    icon: weatherIconSafely(["weather-snow-rain", "weather-snow", "weather-severe-alert"], iconType)
                };
            case "rain_sleet":
                return {
                    main: _("Sleet"),
                    description: _("Sleet"),
                    customIcon: "rain-mix-symbolic",
                    icon: weatherIconSafely(["weather-freezing-rain", "weather-severe-alert"], iconType)
                };
            case "snow_sleet":
                return {
                    main: _("Sleet"),
                    description: _("Sleet"),
                    customIcon: "sleet-symbolic",
                    icon: weatherIconSafely(["weather-freezing-rain", "weather-hail", "weather-severe-alert"], iconType)
                };
            case "fzra":
                return {
                    main: _("Freezing Rain"),
                    description: _("Freezing Rain"),
                    customIcon: "rain-wind-symbolic",
                    icon: weatherIconSafely(["weather-freezing-rain", "weather-hail", "weather-severe-alert"], iconType)
                };
            case "rain_fzra":
                return {
                    main: _("Freezing Rain"),
                    description: _("Freezing Rain"),
                    customIcon: "rain-wind-symbolic",
                    icon: weatherIconSafely(["weather-freezing-rain", "weather-hail", "weather-severe-alert"], iconType)
                };
            case "snow_fzra":
                return {
                    main: _("Freezing Rain"),
                    description: _("Freezing Rain and snow"),
                    customIcon: "rain-wind-symbolic",
                    icon: weatherIconSafely(["weather-freezing-rain", "weather-hail", "weather-severe-alert"], iconType)
                };
            case "sleet":
                return {
                    main: _("Sleet"),
                    description: _("Sleet"),
                    customIcon: "rain-mix-symbolic",
                    icon: weatherIconSafely(["weather-freezing-rain", "weather-rain", "weather-severe-alert"], iconType)
                };
            case "rain":
                return {
                    main: _("Rain"),
                    description: _("Rain"),
                    customIcon: "rain-symbolic",
                    icon: weatherIconSafely(["weather-rain", "weather-freezing-rain", "weather-showers", "weather-showers-scattered", "weather-severe-alert"], iconType)
                };
            case "rain_showers":
            case "rain_showers_hi":
                return {
                    main: _("Rain"),
                    description: _("Rain showers"),
                    customIcon: "rain-mix-symbolic",
                    icon: weatherIconSafely(["weather-showers", "weather-showers-scattered", "weather-rain", "weather-freezing-rain", "weather-severe-alert"], iconType)
                };
            case "tsra":
            case "tsra_sct":
            case "tsra_hi":
                return {
                    main: _("Thunderstorm"),
                    description: _("Thunderstorm"),
                    customIcon: "thunderstorm-symbolic",
                    icon: weatherIconSafely(["weather-storm", "weather-severe-alert"], iconType)
                };
            case "tornado":
                return {
                    main: _("Tornado"),
                    description: _("Tornado"),
                    customIcon: "tornado-symbolic",
                    icon: weatherIconSafely(["weather-severe-alert"], iconType)
                };
            case "hurricane":
                return {
                    main: _("Hurricane"),
                    description: _("Hurricane"),
                    customIcon: "hurricane-symbolic",
                    icon: weatherIconSafely(["weather-severe-alert"], iconType)
                };
            case "tropical_storm":
                return {
                    main: _("Storm"),
                    description: _("Tropical Storm"),
                    customIcon: "thunderstorm-symbolic",
                    icon: weatherIconSafely(["weather-storm", "weather-severe-alert"], iconType)
                };
            case "dust":
                return {
                    main: _("Dust"),
                    description: _("Dust"),
                    customIcon: "dust-symbolic",
                    icon: weatherIconSafely(["weather-fog", "weather-severe-alert"], iconType)
                };
            case "smoke":
                return {
                    main: _("Smoke"),
                    description: _("Smoke"),
                    customIcon: "smoke-symbolic",
                    icon: weatherIconSafely(["weather-fog", "weather-severe-alert"], iconType)
                };
            case "haze":
                return {
                    main: _("Haze"),
                    description: _("Haze"),
                    customIcon: "fog-symbolic",
                    icon: weatherIconSafely(["weather-fog", "weather-severe-alert"], iconType)
                };
            case "hot":
                return {
                    main: _("Hot"),
                    description: _("Hot"),
                    customIcon: "hot-symbolic",
                    icon: weatherIconSafely(["weather-severe-alert"], iconType)
                };
            case "cold":
                return {
                    main: _("Cold"),
                    description: _("Cold"),
                    customIcon: "snowflake-cold-symbolic",
                    icon: weatherIconSafely(["weather-storm", "weather-severe-alert"], iconType)
                };
            case "blizzard":
                return {
                    main: _("Blizzard"),
                    description: _("Blizzard"),
                    customIcon: "thunderstorm-symbolic",
                    icon: weatherIconSafely(["weather-storm", "weather-severe-alert"], iconType)
                };
            case "fog":
                return {
                    main: _("Fog"),
                    description: _("Fog"),
                    customIcon: "fog-symbolic",
                    icon: weatherIconSafely(["weather-fog", "weather-severe-alert"], iconType)
                };
            default:
                return {
                    main: _("Unknown"),
                    description: _("Unknown"),
                    customIcon: "cloud-refresh-symbolic",
                    icon: weatherIconSafely(["weather-severe-alert"], iconType)
                };
        }
    }
    ;
}
;
