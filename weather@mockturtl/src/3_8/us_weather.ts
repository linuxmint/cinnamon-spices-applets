//////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////
///////////                                       ////////////
///////////                US Weather             ////////////
///////////                                       ////////////
//////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////

import { HttpError } from "./httpLib";
import { Log } from "./logger";
import { WeatherApplet } from "./main";
import { SunCalc } from "./sunCalc";
import { WeatherProvider, WeatherData, ForecastData, HourlyForecastData, Condition, LocationData } from "./types";
import { _, GetDistance, KPHtoMPS, CelsiusToKelvin, IsNight, FahrenheitToKelvin, WeatherIconSafely } from "./utils";

export class USWeather implements WeatherProvider {

    //--------------------------------------------------------
    //  Properties
    //--------------------------------------------------------
    public readonly prettyName = "US Weather";
    public readonly name = "US Weather";
    public readonly maxForecastSupport = 7;
    public readonly website = "https://www.weather.gov/";
    public readonly maxHourlyForecastSupport = 156;
    public readonly needsApiKey = false;

    private sunCalc: SunCalc;

    private sitesUrl = "https://api.weather.gov/points/";

    private app: WeatherApplet;
    private grid: GridPayload = null;
    /** In metres */
    private readonly MAX_STATION_DIST = 50000;
    private observationStations: StationPayload[] = null;
    private currentLoc: LocationData = null;
    private currentLocID: string = null;

    constructor(_app: WeatherApplet) {
        this.app = _app;
        this.sunCalc = new SunCalc();
    }

    //--------------------------------------------------------
    //  Functions
    //--------------------------------------------------------
    public async GetWeather(loc: LocationData): Promise<WeatherData> {
        if (loc == null) return null;

        // getting grid and station data first time or location changed
        let locID = loc.lat.toString() + "," + loc.lon.toString();
        if (!this.grid || !this.observationStations || this.currentLocID != locID) {
            Log.Instance.Print("Downloading new site data")
            this.currentLoc = loc;
            this.currentLocID = locID;

            let grid = await this.GetGridData(loc);
			if (grid == null) return null;
			Log.Instance.Debug("Grid found: " + JSON.stringify(grid, null, 2));

            let observationStations = await this.GetStationData(grid.properties.observationStations);
            if (observationStations == null) return null;

            // Caching
            this.grid = grid;
            this.observationStations = observationStations;
        }
        else {
            Log.Instance.Debug("Site data downloading skipped")
        }

        // Long wait time, can't do Promise.all because US weather will ban IP for some time on spamming
        let observations = await this.GetObservationsInRange(this.MAX_STATION_DIST, loc, this.observationStations);

		let hourlyForecastPromise = this.app.LoadJsonAsync<ForecastsPayload>(this.grid.properties.forecastHourly + "?units=si");
		let forecastPromise = this.app.LoadJsonAsync<ForecastsPayload>(this.grid.properties.forecast);
		let hourly = await hourlyForecastPromise;
		let forecast = await forecastPromise;
        
        if (!hourly || !forecast) {
			Log.Instance.Error("Failed to obtain forecast Data");
			return null;
		}

        // Parsing data
        let weather = this.ParseCurrent(observations, hourly);
        weather.forecasts = this.ParseForecast(forecast);
        weather.hourlyForecasts = this.ParseHourlyForecast(hourly, this);

        return weather;
    };

	/**
	 * Handles App errors internally
	 * @param loc 
	 */
    private async GetGridData(loc: LocationData): Promise<GridPayload> {
		// Handling out of country errors in callback
		let siteData = await this.app.LoadJsonAsync<GridPayload>(this.sitesUrl + loc.lat.toString() + "," + loc.lon.toString(), null, (msg) => this.OnObtainingGridData(msg));
		return siteData;
    }

	/**
	 * Handles app errors internally
	 * @param stationListUrl 
	 */
    private async GetStationData(stationListUrl: string): Promise<StationPayload[]> {
		let stations = await this.app.LoadJsonAsync<StationsPayload>(stationListUrl);
		return stations?.features;
    }

	/**
	 * Get ALL Observation stations data in range.
	 * Data is pretty spotty so we can fill them up from stations further away later
	 * @param range in metres
	 */
    private async GetObservationsInRange(range: number, loc: LocationData, stations: StationPayload[]): Promise<ObservationPayload[]> {
        let observations = [];
        for (let index = 0; index < stations.length; index++) {
            const element = stations[index];
            element.dist = GetDistance(element.geometry.coordinates[1], element.geometry.coordinates[0], loc.lat, loc.lon);
            if (element.dist > range) break;
			// do not show errors here, we call multiple observation sites
			let observation = await this.app.LoadJsonAsync<ObservationPayload>(stations[index].id + "/observations/latest", null, (msg) => false);
			if (observation == null) {
				Log.Instance.Debug("Failed to get observations from " + stations[index].id);
			}
			else {
				observations.push(observation);
			}
        }
        return observations;
    }

	/**
	 * 
	 * @param message Soup Message object
	 */
    private OnObtainingGridData(this: USWeather, message: HttpError): boolean {
        if (message.code == 404) {
            let data = JSON.parse(message?.response?.response_body?.data);
            if (data.title == "Data Unavailable For Requested Point") {
                this.app.ShowError({
                    type: "hard",
                    userError: true,
                    detail: "location not covered",
                    service: "us-weather",
                    message: _("Location is outside US, please use a different provider.")
                });
			}
			return false;
        }
        return true;
    }

	/**
	 * Observation data is a bit spotty, so we mesh 
	 * station data
	 * @param observations 
	 */
    private MeshObservationData(observations: ObservationPayload[]): ObservationPayload {
        if (observations.length < 1) return null;
        let result = observations[0];
        if (observations.length == 1) return result;
        for (let index = 1; index < observations.length; index++) {
            const element = observations[index];
            // We want to know when this happens, at least for debugging
            let debugText =
                " Observation data missing, plugged in from ID " +
                element.id + ", index " + index +
                ", distance "
                + Math.round(GetDistance(
                    element.geometry.coordinates[1],
                    element.geometry.coordinates[0],
                    this.currentLoc.lat,
                    this.currentLoc.lon
                ))
                + " metres";
            if (result.properties.icon == null) {
                result.properties.icon = element.properties.icon;
                result.properties.textDescription = element.properties.textDescription;
                Log.Instance.Debug("Weather condition" + debugText);
            }
            if (result.properties.temperature.value == null) {
                result.properties.temperature.value = element.properties.temperature.value;
                Log.Instance.Debug("Temperature" + debugText);
            }
            if (result.properties.windSpeed.value == null) {
                result.properties.windSpeed.value = element.properties.windSpeed.value;
                Log.Instance.Debug("Wind Speed" + debugText);
            }
            if (result.properties.windDirection.value == null) {
                result.properties.windDirection.value = element.properties.windDirection.value;
                Log.Instance.Debug("Wind degree" + debugText);
            }
            if (result.properties.barometricPressure.value == null) {
                result.properties.barometricPressure.value = element.properties.barometricPressure.value;
                Log.Instance.Debug("Pressure" + debugText);
            }
            if (result.properties.relativeHumidity.value == null) {
                result.properties.relativeHumidity.value = element.properties.relativeHumidity.value;
                Log.Instance.Debug("Humidity" + debugText);
            }
            if (result.properties.windChill.value == null) {
                result.properties.windChill.value = element.properties.windChill.value;
                Log.Instance.Debug("WindChill" + debugText);
            }
            if (result.properties.visibility.value == null) {
                result.properties.visibility.value = element.properties.visibility.value;
                Log.Instance.Debug("Visibility" + debugText);
            }
        }
        return result;
    }

	/**
	 * 
	 * @param json 
	 * @param hourly can be null
	 */
    private ParseCurrent(json: ObservationPayload[], hourly: ForecastsPayload): WeatherData {
        if (json.length == 0) {
            Log.Instance.Error("No observation stations/data are available");
            return null;
        }
        let observation = this.MeshObservationData(json);
        let timestamp = new Date(observation.properties.timestamp);
        let times = this.sunCalc.getTimes(new Date(), observation.geometry.coordinates[1], observation.geometry.coordinates[0], observation.properties.elevation.value);
        try {
            let weather: WeatherData = {
                coord: {
                    lat: observation.geometry.coordinates[1],
                    lon: observation.geometry.coordinates[0]
                },
                location: {
                    city: /*this.stations[0].properties.name*/ null,
                    country: /*"USA"*/null,
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
                pressure: observation.properties.barometricPressure.value / 100, // from Pa to hPa
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
            Log.Instance.Error("US Weather Parsing error: " + e);
            this.app.ShowError({ type: "soft", service: "us-weather", detail: "unusual payload", message: _("Failed to Process Current Weather Info") })
            return null;
        }
    };

    private ParseForecast(json: ForecastsPayload): ForecastData[] {
        let forecasts: ForecastData[] = [];
        try {

            let startIndex = 0;
            // array starts with night, handling today separately
            if (json.properties.periods[0].isDaytime == false) {
                startIndex = 1;
                let today = json.properties.periods[0]
                let forecast: ForecastData = {
                    date: new Date(today.startTime),
                    temp_min: FahrenheitToKelvin(today.temperature),
                    temp_max: FahrenheitToKelvin(today.temperature),
                    condition: this.ResolveCondition(today.icon),
                };
                forecasts.push(forecast);
            }

            for (let i = startIndex; i < json.properties.periods.length; i += 2) {
                // Day and night data is separate in array, so we alternate
                let day = json.properties.periods[i];
                let night = json.properties.periods[i + 1]; // this can be undefined
                if (!night) night = day;

                let forecast: ForecastData = {
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
            Log.Instance.Error("US Weather Forecast Parsing error: " + e);
            this.app.ShowError({ type: "soft", service: "us-weather", detail: "unusual payload", message: _("Failed to Process Forecast Info") })
            return null;
        }
    };

    private ParseHourlyForecast(json: ForecastsPayload, self: USWeather): HourlyForecastData[] {
        let forecasts: HourlyForecastData[] = [];
        try {
            for (let i = 0; i < json.properties.periods.length; i++) {
                let hour = json.properties.periods[i];
                let timestamp = new Date(hour.startTime);

                let forecast: HourlyForecastData = {
                    date: timestamp,
                    temp: CelsiusToKelvin(hour.temperature),
                    condition: self.ResolveCondition(hour.icon, !hour.isDaytime),
                    precipitation: null
                }
                forecasts.push(forecast);
            }
            return forecasts;
        }
        catch (e) {
            Log.Instance.Error("US Weather service Forecast Parsing error: " + e);
            self.app.ShowError({ type: "soft", service: "us-weather", detail: "unusual payload", message: _("Failed to Process Hourly Forecast Info") })
            return null;
        }
    }

	/**
	 * https://api.weather.gov/icons
	 * @param icon 
	 * @param isNight 
	 */
    private ResolveCondition(icon: string, isNight: boolean = false): Condition {
        if (icon == null) return null;
        let code = icon.match(/(?!\/)[a-z_]+(?=(\?|,))/); // Clear cruft from icon url, leave only code
        let iconType = this.app.config.IconType;
        switch (code[0]) {
            case "skc": // Fair/clear
                return {
                    main: _("Clear"),
                    description: _("Clear"),
                    customIcon: (isNight) ? "night-clear-symbolic" : "day-sunny-symbolic",
                    icons: (isNight) ? ["weather-clear-night", "weather-severe-alert"] : ["weather-clear", "weather-severe-alert"]
                }
            case "few": // A few clouds
                return {
                    main: _("Few clouds"),
                    description: _("Few clouds"),
                    customIcon: (isNight) ? "night-alt-cloudy-symbolic" : "day-cloudy-symbolic",
                    icons: ["weather-clear-night", "weather-severe-alert"]
                }
            case "sct": // Partly cloudy
                return {
                    main: _("Partly cloudy"),
                    description: _("Partly cloudy"),
                    customIcon: (isNight) ? "night-alt-cloudy-symbolic" : "day-cloudy-symbolic",
                    icons: ["weather-clear", "weather-severe-alert"]
                }
            case "bkn": // Mostly cloudy
                return {
                    main: _("Mostly cloudy"),
                    description: _("Mostly cloudy"),
                    customIcon: (isNight) ? "night-alt-cloudy-symbolic" : "day-cloudy-symbolic",
                    icons: ["weather-clouds-night", "weather-overcast", "weather-severe-alert"]
                }
            case "ovc": // Overcast
                return {
                    main: _("Overcast"),
                    description: _("Overcast"),
                    customIcon: "cloudy-symbolic",
                    icons: ["weather-clouds", "weather-overcast", "weather-severe-alert"]
                }
            case "wind_skc": // Fair/clear and windy
                return {
                    main: _("Clear"),
                    description: _("Clear and windy"),
                    customIcon: (IsNight) ? "night-alt-wind-symbolic" : "day-windy-symbolic",
                    icons: (isNight) ? ["weather-clear-night"] : ["weather-clear"]
                }
            case "wind_few": // A few clouds and windy
                return {
                    main: _("Few clouds"),
                    description: _("Few clouds and windy"),
                    customIcon: (IsNight) ? "night-alt-cloudy-windy-symbolic" : "day-cloudy-windy-symbolic",
                    icons: (isNight) ? ["weather-few-clouds-night"] : ["weather-few-clouds"]
                }
            case "wind_sct": // Partly cloudy and windy
                return {
                    main: _("Partly cloudy"),
                    description: _("Partly cloudy and windy"),
                    customIcon: (IsNight) ? "night-alt-cloudy-windy-symbolic" : "day-cloudy-windy-symbolic",
                    icons: (isNight) ? ["weather-clouds-night", "weather-few-clouds-night"] : ["weather-clouds", "weather-few-clouds"]
                }
            case "wind_bkn": // Mostly cloudy and windy
                return {
                    main: _("Mostly cloudy"),
                    description: _("Mostly cloudy and windy"),
                    customIcon: (IsNight) ? "night-alt-cloudy-windy-symbolic" : "day-cloudy-windy-symbolic",
                    icons: (isNight) ? ["weather-clouds-night", "weather-few-clouds-night"] : ["weather-clouds", "weather-few-clouds"]
                }
            case "wind_ovc":
                return { // Overcast and windy
                    main: _("Overcast"),
                    description: _("Overcast and windy"),
                    customIcon: "cloudy-symbolic",
                    icons: ["weather-overcast", "weather-many-clouds", "weather-severe-alert"]
                }
            case "snow": //  "Snow"
                return {
                    main: _("Snow"),
                    description: _("Snow"),
                    customIcon: "snow-symbolic",
                    icons: ["weather-snow", "weather-severe-alert"]
                }
            case "rain_snow": // Rain/snow
                return {
                    main: _("Rain"),
                    description: _("Snowy rain"),
                    customIcon: "rain-mix-symbolic",
                    icons: ["weather-snow-rain", "weather-snow", "weather-severe-alert"]
                }
            case "rain_sleet": // Rain/sleet
                return {
                    main: _("Sleet"),
                    description: _("Sleet"),
                    customIcon: "rain-mix-symbolic",
                    icons: ["weather-freezing-rain", "weather-severe-alert"]
                }
            case "snow_sleet": // Snow/sleet
                return {
                    main: _("Sleet"),
                    description: _("Sleet"),
                    customIcon: "sleet-symbolic",
                    icons: ["weather-freezing-rain", "weather-hail", "weather-severe-alert"]
                }
            case "fzra": // Freezing rain
                return {
                    main: _("Freezing rain"),
                    description: _("Freezing rain"),
                    customIcon: "rain-wind-symbolic",
                    icons: ["weather-freezing-rain", "weather-hail", "weather-severe-alert"]
                }
            case "rain_fzra": // Rain/freezing rain
                return {
                    main: _("Freezing rain"),
                    description: _("Freezing rain"),
                    customIcon: "rain-wind-symbolic",
                    icons: ["weather-freezing-rain", "weather-hail", "weather-severe-alert"]
                }
            case "snow_fzra": // Freezing rain/snow
                return {
                    main: _("Freezing rain"),
                    description: _("Freezing rain and snow"),
                    customIcon: "rain-wind-symbolic",
                    icons: ["weather-freezing-rain", "weather-hail", "weather-severe-alert"]
                }
            case "sleet": // Sleet
                return {
                    main: _("Sleet"),
                    description: _("Sleet"),
                    customIcon: "rain-mix-symbolic",
                    icons: ["weather-freezing-rain", "weather-rain", "weather-severe-alert"]
                }
            case "rain": // Rain
                return {
                    main: _("Rain"),
                    description: _("Rain"),
                    customIcon: "rain-symbolic",
                    icons: ["weather-rain", "weather-freezing-rain", "weather-showers", "weather-showers-scattered", "weather-severe-alert"]
                }
            case "rain_showers": // Rain showers (high cloud cover)
            case "rain_showers_hi": // Rain showers (low cloud cover)
                return {
                    main: _("Rain"),
                    description: _("Rain showers"),
                    customIcon: "rain-mix-symbolic",
                    icons: ["weather-showers", "weather-showers-scattered", "weather-rain", "weather-freezing-rain", "weather-severe-alert"]
                }
            case "tsra": // Thunderstorm (high cloud cover)
            case "tsra_sct": // Thunderstorm (medium cloud cover)
            case "tsra_hi": // Thunderstorm (low cloud cover)
                return {
                    main: _("Thunderstorm"),
                    description: _("Thunderstorm"),
                    customIcon: "thunderstorm-symbolic",
                    icons: ["weather-storm", "weather-severe-alert"]
                }
            case "tornado": // Tornado
                return {
                    main: _("Tornado"),
                    description: _("Tornado"),
                    customIcon: "tornado-symbolic",
                    icons: ["weather-severe-alert"]
                }
            case "hurricane": // Hurricane conditions
                return {
                    main: _("Hurricane"),
                    description: _("Hurricane"),
                    customIcon: "hurricane-symbolic",
                    icons: ["weather-severe-alert"]
                }
            case "tropical_storm": // Tropical storm conditions
                return {
                    main: _("Storm"),
                    description: _("Tropical storm"),
                    customIcon: "thunderstorm-symbolic",
                    icons: ["weather-storm", "weather-severe-alert"]
                }
            case "dust": // Dust
                return {
                    main: _("Dust"),
                    description: _("Dust"),
                    customIcon: "dust-symbolic",
                    icons: ["weather-fog", "weather-severe-alert"]
                }
            case "smoke": // Smoke
                return {
                    main: _("Smoke"),
                    description: _("Smoke"),
                    customIcon: "smoke-symbolic",
                    icons: ["weather-fog", "weather-severe-alert"]
                }
            case "haze": // Haze
                return {
                    main: _("Haze"),
                    description: _("Haze"),
                    customIcon: "fog-symbolic",
                    icons: ["weather-fog", "weather-severe-alert"]
                }
            case "hot": // Hot
                return {
                    main: _("Hot"),
                    description: _("Hot"),
                    customIcon: "hot-symbolic",
                    icons: ["weather-severe-alert"]
                }
            case "cold": // Cold
                return {
                    main: _("Cold"),
                    description: _("Cold"),
                    customIcon: "snowflake-cold-symbolic",
                    icons: ["weather-storm", "weather-severe-alert"]
                }
            case "blizzard": // Blizzard
                return {
                    main: _("Blizzard"),
                    description: _("Blizzard"),
                    customIcon: "thunderstorm-symbolic",
                    icons: ["weather-storm", "weather-severe-alert"]
                }
            case "fog": // Fog/mist
                return {
                    main: _("Fog"),
                    description: _("Fog"),
                    customIcon: "fog-symbolic",
                    icons: ["weather-fog", "weather-severe-alert"]
                }
            default:
                return {
                    main: _("Unknown"),
                    description: _("Unknown"),
                    customIcon: "cloud-refresh-symbolic",
                    icons: ["weather-severe-alert"]
                }
        }
    };
};

interface GridPayload {
    "@context": any,
    id: string;
    type: string;
    geometry: {
        type: string,
        /** [lon, lat] */
        coordinates: number[]
    },
    properties: {
        "@id": string,
        "@type": "wx:Point",
        cwa: string;
        forecastOffice: string;
        gridId: string;
        gridX: number;
        gridY: number;
        /** url */
        forecast: string;
        /** url */
        forecastHourly: string;
        /** url */
        forecastGridData: string;
        /** url */
        observationStations: string;
        relativeLocation: {
            type: string;
            geometry: {
                type: string,
                coordinates: number[]
            },
            properties: {
                city: string;
                state: string;
                distance: {
                    value: number;
                    unitCode: string;
                },
                bearing: {
                    value: number;
                    unitCode: string;
                }
            }
        },
        forecastZone: string;
        county: string;
        fireWeatherZone: string;
        timeZone: string
        radarStation: string;
    }
}

interface StationPayload {
    /** url */
    id: string;
    type: string;
    geometry: {
        type: string;
        /** [lon, lat] */
        coordinates: number[];
    };
    dist?: number;
    properties: {
        "@id": string;
        "@type": string;
        elevation: {
            value: number;
            unit: string;
        };
        stationIdentifier: string;
        name: string;
        timeZone: string;
        /** url */
        forecast: string;
        /** url */
        county: string;
        /** url */
        fireWeatherZone: string;
    }
}

interface StationsPayload {
    "@context": any;
    features: StationPayload[]
}

interface ObservationPayload {
    "@context": any;
    /** https://api.weather.gov/stations/WTHC1/observations/2020-06-25T12:57:00+00:00 */
    id: string;
    type: string;
    geometry: {
        type: string;
        /** [lon, lat] */
        coordinates: number[];
    }
    properties: {
        "@id": string;
        "@type": string;
        elevation: {
            value: number;
            unit: string;
        };
        /** url */
        station: string;
        /** ISO string */
        timestamp: string;
        rawMessage: string;
        textDescription: string;
        icon: string;
        presentWeather: any[],
        temperature: {
            value: number;
            unitCode: string,
            qualityControl: string
        },
        dewpoint: {
            value: number;
            unitCode: string;
            qualityControl: string;
        },
        windDirection: {
            value: number;
            unitCode: string;
            qualityControl: string;
        },
        windSpeed: {
            value: number;
            unitCode: string;
            qualityControl: string;
        },
        windGust: {
            value: number;
            unitCode: string;
            qualityControl: string;
        },
        barometricPressure: {
            value: number;
            unitCode: string;
            qualityControl: string;
        },
        seaLevelPressure: {
            value: number;
            unitCode: string;
            qualityControl: string;
        },
        visibility: {
            value: number;
            unitCode: string;
            qualityControl: string;
        },
        maxTemperatureLast24Hours: {
            value: number;
            unitCode: string;
            qualityControl: null
        },
        minTemperatureLast24Hours: {
            value: number;
            unitCode: string;
            qualityControl: null
        },
        precipitationLast3Hours: {
            value: number;
            unitCode: string;
            qualityControl: string;
        },
        relativeHumidity: {
            value: number;
            unitCode: string;
            qualityControl: string;
        },
        windChill: {
            value: number;
            unitCode: string;
            qualityControl: string;
        },
        heatIndex: {
            value: number;
            unitCode: string;
            qualityControl: string;
        },
        cloudLayers: []
    }
}

interface ForecastsPayload {
    properties: {
        elevation: {
            value: number;
            unitCode: string;
        },
        periods: ForecastPayload[]
    }
}

interface ForecastPayload {
    number: number;
    name: string;
    /** ISO string */
    startTime: string;
    /** ISO string */
    endTime: string;
    isDaytime: boolean;
    /** Usually in F */
    temperature: number;
    temperatureUnit: string;
    temperatureTrend: any;
    /** Like "5 mph" ?? */
    windSpeed: string;
    /** Like "SSW" */
    windDirection: string;
    icon: string;
    shortForecast: string;
    /** Can be empty string */
    detailedForecast: string;
}