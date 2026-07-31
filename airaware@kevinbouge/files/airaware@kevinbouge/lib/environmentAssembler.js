/* exported combineEnvironmentalData */

const MoldPotentialCalculator = imports.moldPotentialCalculator;

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

function _dateFromOpenMeteoTime(timeValue) {
    if (typeof timeValue !== 'string' || timeValue.length < 10)
        return null;

    return timeValue.substring(0, 10);
}

function _weatherHoursForDate(weatherData, date) {
    if (!weatherData || !Array.isArray(weatherData.hourly))
        return [];

    return weatherData.hourly.filter(hour => _dateFromOpenMeteoTime(hour.time) === date);
}

function _currentWeatherHours(weatherData) {
    if (!weatherData || !Array.isArray(weatherData.hourly))
        return [];

    return weatherData.hourly.slice(0, 24);
}

function _unavailableMoldPotential() {
    return {
        score: null,
        category: null,
        isAvailable: false,
        dataCompleteness: 0,
        components: {
            relativeHumidity: null,
            precipitation: null,
            temperature: null,
            wind: null,
        },
        effectiveWeights: {
            relativeHumidity: 0,
            precipitation: 0,
            temperature: 0,
            wind: 0,
        },
        missingComponents: ['relativeHumidity'],
        explanationKey: 'mold-unavailable-weather',
    };
}

function _calculateMoldPotential(hours) {
    if (!Array.isArray(hours) || hours.length === 0)
        return _unavailableMoldPotential();

    return MoldPotentialCalculator.calculateMoldPotential(hours);
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
    const cachedData = options.cachedData || null;
    const sourceAirQuality = airQualityData || cachedData;

    if (!sourceAirQuality)
        return null;

    const combined = _copyObject(sourceAirQuality);
    const usedCachedAirQuality = airQualityData === null && cachedData !== null;

    combined.provider = sourceAirQuality.provider || 'open-meteo';
    combined.weather = weatherData || null;
    combined.airQualityFetchedAt = _isFiniteNumber(sourceAirQuality.airQualityFetchedAt)
        ? sourceAirQuality.airQualityFetchedAt
        : sourceAirQuality.fetchedAt;
    combined.weatherFetchedAt = weatherData && _isFiniteNumber(weatherData.fetchedAt)
        ? weatherData.fetchedAt
        : null;
    combined.fetchedAt = _isFiniteNumber(combined.airQualityFetchedAt)
        ? combined.airQualityFetchedAt
        : sourceAirQuality.fetchedAt;

    if (combined.weatherFetchedAt !== null &&
        (!_isFiniteNumber(combined.fetchedAt) || combined.weatherFetchedAt > combined.fetchedAt))
        combined.fetchedAt = combined.weatherFetchedAt;

    combined.current.moldPotential = _calculateMoldPotential(
        weatherData ? _currentWeatherHours(weatherData) : []
    );

    combined.forecast = combined.forecast.map(day => {
        const copy = _copyObject(day);

        copy.moldPotential = _calculateMoldPotential(
            weatherData ? _weatherHoursForDate(weatherData, day.date) : []
        );

        return copy;
    });

    combined.isPartial = Boolean(
        combined.isPartial ||
        usedCachedAirQuality ||
        !weatherData ||
        combined.current.moldPotential.isAvailable !== true ||
        combined.forecast.some(day => day.moldPotential.isAvailable !== true)
    );

    return combined;
};
