/* exported combineEnvironmentalData, providerDataMatchesCoordinates */

const MoldPotentialCalculator = imports.moldPotentialCalculator;

const PROVIDER_COORDINATE_TOLERANCE = 0.25;

function _isFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
}

function _copyObject(value) {
    if (value === null || typeof value !== 'object')
        return value;

    if (Array.isArray(value))
        return value.map(_copyObject);

    let copy = {};

    for (const key in value)
        copy[key] = _copyObject(value[key]);

    return copy;
}

function _coordinateFromData(data) {
    if (!data)
        return null;

    if (_isFiniteNumber(data.latitude) && _isFiniteNumber(data.longitude))
        return {
            latitude: data.latitude,
            longitude: data.longitude,
        };

    if (data.metadata &&
        _isFiniteNumber(data.metadata.latitude) &&
        _isFiniteNumber(data.metadata.longitude))
        return {
            latitude: data.metadata.latitude,
            longitude: data.metadata.longitude,
        };

    return null;
}

function _hasUsableCoordinates(coordinates) {
    return coordinates &&
        _isFiniteNumber(coordinates.latitude) &&
        _isFiniteNumber(coordinates.longitude);
}

/**
 * Check whether cached provider data is compatible with active coordinates.
 *
 * Open-Meteo may return model-grid coordinates instead of the exact requested
 * coordinates, so this uses a small tolerance rather than exact equality.
 *
 * @param {Object|null} data - Cached or fresh provider response.
 * @param {Object|null} coordinates - Active location coordinates.
 * @returns {boolean} True when the data can be used for the location.
 */
var providerDataMatchesCoordinates = function(data, coordinates) {
    if (!_hasUsableCoordinates(coordinates))
        return true;

    const dataCoordinates = _coordinateFromData(data);

    if (dataCoordinates === null)
        return false;

    return Math.abs(dataCoordinates.latitude - coordinates.latitude) <= PROVIDER_COORDINATE_TOLERANCE &&
        Math.abs(dataCoordinates.longitude - coordinates.longitude) <= PROVIDER_COORDINATE_TOLERANCE;
};

function _cachedWeatherForCoordinates(cachedData, coordinates) {
    if (!cachedData || !cachedData.weather)
        return null;

    const weatherCoordinates = _coordinateFromData(cachedData.weather);

    if (weatherCoordinates === null)
        return cachedData.weather;

    return providerDataMatchesCoordinates(cachedData.weather, coordinates)
        ? cachedData.weather
        : null;
}

function _dateFromOpenMeteoTime(timeValue) {
    if (typeof timeValue !== 'string' || timeValue.length < 10)
        return null;

    return timeValue.substring(0, 10);
}

function _weatherHoursForDate(weatherData, date) {
    const records = _weatherHourlyRecords(weatherData);

    return records.filter(hour => _dateFromOpenMeteoTime(hour.time) === date);
}

function _currentWeatherHours(weatherData) {
    const records = _weatherHourlyRecords(weatherData);

    return records.slice(0, 24);
}

function _weatherHourlyRecords(weatherData) {
    if (!weatherData)
        return [];

    if (Array.isArray(weatherData.hourlyRecords))
        return weatherData.hourlyRecords;

    if (Array.isArray(weatherData.hourly))
        return weatherData.hourly;

    if (!weatherData.hourly || !Array.isArray(weatherData.hourly.timestamps))
        return [];

    return weatherData.hourly.timestamps.map((time, index) => ({
        time,
        values: {
            temperature: Array.isArray(weatherData.hourly.temperature)
                ? weatherData.hourly.temperature[index]
                : null,
            relativeHumidity: Array.isArray(weatherData.hourly.relativeHumidity)
                ? weatherData.hourly.relativeHumidity[index]
                : null,
            dewPoint: Array.isArray(weatherData.hourly.dewPoint)
                ? weatherData.hourly.dewPoint[index]
                : null,
            precipitation: Array.isArray(weatherData.hourly.precipitation)
                ? weatherData.hourly.precipitation[index]
                : null,
            windSpeed: Array.isArray(weatherData.hourly.windSpeed)
                ? weatherData.hourly.windSpeed[index]
                : null,
            uvIndex: Array.isArray(weatherData.hourly.uvIndex)
                ? weatherData.hourly.uvIndex[index]
                : null,
        },
    }));
}

function _dailyWeatherForDate(weatherData, date) {
    if (!weatherData || !weatherData.daily || !Array.isArray(weatherData.daily.dates))
        return null;

    const index = weatherData.daily.dates.indexOf(date);

    if (index === -1)
        return null;

    let daily = {};

    for (const key in weatherData.daily) {
        if (key === 'dates')
            continue;

        daily[key] = Array.isArray(weatherData.daily[key])
            ? weatherData.daily[key][index]
            : null;
    }

    return daily;
}

function _unavailableMoldPotential() {
    return {
        score: null,
        category: null,
        isAvailable: false,
        dataCompleteness: 0,
        components: {
            relativeHumidity: null,
            leafWetness: null,
            precipitation: null,
            temperature: null,
            wind: null,
        },
        effectiveWeights: {
            relativeHumidity: 0,
            leafWetness: 0,
            precipitation: 0,
            temperature: 0,
            wind: 0,
        },
        missingComponents: ['relativeHumidity'],
        explanationKey: 'mold-unavailable-weather',
    };
}

function _calculateMoldPotential(hours) {
    if (Array.isArray(hours) && hours.length === 0)
        return _unavailableMoldPotential();

    return MoldPotentialCalculator.calculateMoldPotential(hours);
}

function _weatherForCurrentMold(weatherData, todayDate) {
    if (!weatherData)
        return null;

    return {
        current: weatherData.current || null,
        hourlyRecords: _currentWeatherHours(weatherData),
        daily: todayDate ? _dailyWeatherForDate(weatherData, todayDate) : null,
    };
}

function _weatherForForecastMold(weatherData, date) {
    if (!weatherData)
        return null;

    return {
        hourlyRecords: _weatherHoursForDate(weatherData, date),
        daily: _dailyWeatherForDate(weatherData, date),
    };
}

/**
 * Combine independently fetched environmental provider responses.
 *
 * Fresh air-quality data is preferred. If air quality fails but a cached
 * air-quality response exists, cached air quality can be combined with fresh
 * weather. Weather failures do not discard valid air-quality data.
 *
 * @param {Object} options - Fresh and cached provider data.
 * @returns {Object|null} Combined environmental response or null.
 */
var combineEnvironmentalData = function(options = {}) {
    const airQualityData = options.airQualityData || null;
    const weatherData = options.weatherData || null;
    const requestedCoordinates = options.coordinates || null;
    const rawCachedData = options.cachedData || null;
    const cachedData = providerDataMatchesCoordinates(rawCachedData, requestedCoordinates)
        ? rawCachedData
        : null;
    const vegetationData = options.vegetationData || null;
    const cachedVegetationData = options.cachedVegetationData || null;
    const vegetationIsStale = options.vegetationIsStale === true;
    const sourceAirQuality = airQualityData || cachedData;

    if (!sourceAirQuality)
        return null;

    const combined = _copyObject(sourceAirQuality);

    if (!combined || !combined.current)
        return null;

    if (!Array.isArray(combined.forecast))
        combined.forecast = [];

    const usedCachedAirQuality = airQualityData === null && cachedData !== null;
    const cachedWeather = _cachedWeatherForCoordinates(cachedData, requestedCoordinates);
    const sourceWeather = weatherData || cachedWeather;
    const usedCachedWeather = weatherData === null && sourceWeather !== null;

    combined.provider = sourceAirQuality.provider || 'open-meteo';
    combined.usedCachedAirQuality = usedCachedAirQuality;
    combined.usedCachedWeather = usedCachedWeather;
    combined.weather = sourceWeather;
    combined.vegetation = vegetationData || cachedVegetationData || null;
    combined.vegetationStatus = vegetationData
        ? 'fresh'
        : cachedVegetationData
            ? vegetationIsStale ? 'stale' : 'cached'
            : 'unavailable';
    combined.airQualityFetchedAt = _isFiniteNumber(sourceAirQuality.airQualityFetchedAt)
        ? sourceAirQuality.airQualityFetchedAt
        : sourceAirQuality.fetchedAt;
    combined.weatherFetchedAt = sourceWeather && _isFiniteNumber(sourceWeather.fetchedAt)
        ? sourceWeather.fetchedAt
        : _isFiniteNumber(sourceAirQuality.weatherFetchedAt)
            ? sourceAirQuality.weatherFetchedAt
            : null;
    combined.fetchedAt = _isFiniteNumber(combined.airQualityFetchedAt)
        ? combined.airQualityFetchedAt
        : sourceAirQuality.fetchedAt;

    const currentDate = combined.current && combined.current.timestamp
        ? _dateFromOpenMeteoTime(combined.current.timestamp)
        : combined.forecast && combined.forecast.length > 0
            ? combined.forecast[0].date
            : null;

    combined.current.moldPotential = sourceWeather
        ? _calculateMoldPotential(_weatherForCurrentMold(sourceWeather, currentDate))
        : _unavailableMoldPotential();
    combined.current.uvIndex = sourceWeather && sourceWeather.current
        ? sourceWeather.current.uvIndex
        : null;

    combined.forecast = combined.forecast.map(day => {
        const copy = _copyObject(day);

        copy.moldPotential = sourceWeather
            ? _calculateMoldPotential(_weatherForForecastMold(sourceWeather, day.date))
            : _unavailableMoldPotential();

        return copy;
    });

    combined.isPartial = Boolean(
        combined.isPartial ||
        usedCachedAirQuality ||
        usedCachedWeather ||
        !sourceWeather ||
        combined.current.moldPotential.isAvailable !== true ||
        combined.forecast.some(day => day.moldPotential.isAvailable !== true)
    );

    return combined;
};
