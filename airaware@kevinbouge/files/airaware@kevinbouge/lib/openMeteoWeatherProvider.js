/* exported PROVIDER_ID, buildRequestUrl, parseOpenMeteoJson,
 * parseOpenMeteoResponse, fetchForecastAsync */

imports.gi.versions.Soup = '3.0';

const ByteArray = imports.byteArray;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Soup = imports.gi.Soup;

var PROVIDER_ID = 'open-meteo-weather';

const API_BASE_URL = 'https://api.open-meteo.com/v1/forecast';
const DEFAULT_TIMEOUT_SECONDS = 15;
const DEFAULT_FORECAST_DAYS = 4;
const MAX_FORECAST_DAYS = 7;

const CANONICAL_SOURCES = Object.freeze({
    temperature: 'temperature_2m',
    relativeHumidity: 'relative_humidity_2m',
    dewPoint: 'dew_point_2m',
    precipitation: 'precipitation',
    windSpeed: 'wind_speed_10m',
    windDirection: 'wind_direction_10m',
    windGusts: 'wind_gusts_10m',
    visibility: 'visibility',
});

const CANONICAL_FIELDS = Object.freeze([
    'temperature',
    'relativeHumidity',
    'dewPoint',
    'precipitation',
    'windSpeed',
    'windDirection',
    'windGusts',
    'visibility',
]);

const SOURCE_VARIABLES = Object.freeze([
    'temperature_2m',
    'relative_humidity_2m',
    'dew_point_2m',
    'precipitation',
    'wind_speed_10m',
    'wind_direction_10m',
    'wind_gusts_10m',
    'visibility',
]);

const DAILY_SOURCES = Object.freeze({
    leafWetnessProbabilityMean: 'leaf_wetness_probability_mean',
    temperatureMean: 'temperature_2m_mean',
    temperatureMax: 'temperature_2m_max',
    temperatureMin: 'temperature_2m_min',
    relativeHumidityMean: 'relative_humidity_2m_mean',
    relativeHumidityMax: 'relative_humidity_2m_max',
    precipitationSum: 'precipitation_sum',
    windSpeedMean: 'wind_speed_10m_mean',
    windSpeedMax: 'wind_speed_10m_max',
    windGustsMax: 'wind_gusts_10m_max',
});

const DAILY_VARIABLES = Object.freeze([
    'leaf_wetness_probability_mean',
    'temperature_2m_mean',
    'temperature_2m_max',
    'temperature_2m_min',
    'relative_humidity_2m_mean',
    'relative_humidity_2m_max',
    'precipitation_sum',
    'wind_speed_10m_mean',
    'wind_speed_10m_max',
    'wind_gusts_10m_max',
]);

function _isObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function _isFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
}

function _shouldClampNonNegative(field) {
    return field !== 'temperature' &&
        field !== 'temperatureMean' &&
        field !== 'temperatureMax' &&
        field !== 'temperatureMin' &&
        field !== 'dewPoint';
}

function _sanitizeWeatherValue(value, field) {
    if (!_isFiniteNumber(value))
        return null;

    return _shouldClampNonNegative(field) ? Math.max(0, value) : value;
}

function _normalizeForecastDays(value) {
    const numericValue = Number(value);

    if (!_isFiniteNumber(numericValue))
        return DEFAULT_FORECAST_DAYS;

    return Math.max(1, Math.min(MAX_FORECAST_DAYS, Math.floor(numericValue)));
}

function _validateCoordinate(latitude, longitude) {
    if (!_isFiniteNumber(latitude) || latitude < -90 || latitude > 90)
        throw new Error('Invalid latitude');

    if (!_isFiniteNumber(longitude) || longitude < -180 || longitude > 180)
        throw new Error('Invalid longitude');
}

function _encodeQuery(params) {
    let pairs = [];

    for (const key in params) {
        if (params[key] === null || params[key] === undefined)
            continue;

        pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`);
    }

    return pairs.join('&');
}

function _coordinateOrNull(value, min, max) {
    if (!_isFiniteNumber(value))
        return null;

    if (value < min || value > max)
        return null;

    return value;
}

function _sourceValueAt(hourly, sourceName, index, field) {
    if (!_isObject(hourly) || !Array.isArray(hourly[sourceName]))
        return null;

    return _sanitizeWeatherValue(hourly[sourceName][index], field);
}

function _sourceValue(source, sourceName, field) {
    if (!_isObject(source) || !Object.prototype.hasOwnProperty.call(source, sourceName))
        return null;

    return _sanitizeWeatherValue(source[sourceName], field);
}

function _unitsFromPayload(payload) {
    const hourlyUnits = _isObject(payload.hourly_units)
        ? payload.hourly_units
        : {};
    const currentUnits = _isObject(payload.current_units)
        ? payload.current_units
        : {};
    const dailyUnits = _isObject(payload.daily_units)
        ? payload.daily_units
        : {};

    return {
        current: currentUnits,
        hourly: hourlyUnits,
        daily: dailyUnits,
        temperature: typeof hourlyUnits.temperature_2m === 'string' ? hourlyUnits.temperature_2m : '°C',
        relativeHumidity: typeof hourlyUnits.relative_humidity_2m === 'string' ? hourlyUnits.relative_humidity_2m : '%',
        dewPoint: typeof hourlyUnits.dew_point_2m === 'string' ? hourlyUnits.dew_point_2m : '°C',
        precipitation: typeof hourlyUnits.precipitation === 'string' ? hourlyUnits.precipitation : 'mm',
        windSpeed: typeof hourlyUnits.wind_speed_10m === 'string' ? hourlyUnits.wind_speed_10m : 'm/s',
        windDirection: typeof hourlyUnits.wind_direction_10m === 'string' ? hourlyUnits.wind_direction_10m : '°',
        windGusts: typeof hourlyUnits.wind_gusts_10m === 'string' ? hourlyUnits.wind_gusts_10m : 'm/s',
        visibility: typeof hourlyUnits.visibility === 'string' ? hourlyUnits.visibility : 'm',
        leafWetnessProbabilityMean: typeof dailyUnits.leaf_wetness_probability_mean === 'string'
            ? dailyUnits.leaf_wetness_probability_mean
            : '%',
    };
}

function _valuesFromSource(source, sourceMap) {
    let values = {};
    let missingFields = [];

    for (const field in sourceMap) {
        const value = _sourceValue(source, sourceMap[field], field);

        values[field] = value;

        if (value === null)
            missingFields.push(field);
    }

    return {
        values,
        missingFields,
    };
}

function _seriesFromHourly(hourly) {
    let series = {};

    for (const field of CANONICAL_FIELDS) {
        const sourceName = CANONICAL_SOURCES[field];
        const sourceValues = _isObject(hourly) && Array.isArray(hourly[sourceName])
            ? hourly[sourceName]
            : [];

        series[field] = sourceValues.map(value => _sanitizeWeatherValue(value, field));
    }

    return series;
}

function _seriesFromDaily(daily) {
    let series = {};

    for (const field in DAILY_SOURCES) {
        const sourceName = DAILY_SOURCES[field];
        const sourceValues = _isObject(daily) && Array.isArray(daily[sourceName])
            ? daily[sourceName]
            : [];

        series[field] = sourceValues.map(value => _sanitizeWeatherValue(value, field));
    }

    return series;
}

function _parseCurrent(payload) {
    const current = _isObject(payload.current) ? payload.current : {};
    const parsed = _valuesFromSource(current, CANONICAL_SOURCES);

    return {
        timestamp: typeof current.time === 'string' ? current.time : null,
        temperature: parsed.values.temperature,
        relativeHumidity: parsed.values.relativeHumidity,
        dewPoint: parsed.values.dewPoint,
        precipitation: parsed.values.precipitation,
        windSpeed: parsed.values.windSpeed,
        windDirection: parsed.values.windDirection,
        windGusts: parsed.values.windGusts,
        visibility: parsed.values.visibility,
        missingFields: parsed.missingFields,
        isPartial: parsed.missingFields.length > 0,
    };
}

function _parseHourly(payload) {
    const hourly = payload.hourly;

    if (!_isObject(hourly) || !Array.isArray(hourly.time))
        throw new Error('Invalid Open-Meteo Weather response: missing hourly time');

    let records = [];
    let missingFields = [];
    let timestamps = [];

    for (let index = 0; index < hourly.time.length; index++) {
        const time = hourly.time[index];

        if (typeof time !== 'string' || time === '')
            continue;

        timestamps.push(time);
        let values = {};

        for (const field of CANONICAL_FIELDS) {
            const value = _sourceValueAt(hourly, CANONICAL_SOURCES[field], index, field);

            if (value === null)
                missingFields.push(field);

            values[field] = value;
        }

        records.push({
            time,
            values,
        });
    }

    if (records.length === 0)
        throw new Error('Invalid Open-Meteo Weather response: no usable hourly values');

    return {
        timestamps,
        records,
        series: _seriesFromHourly(hourly),
        missingFields,
        isPartial: missingFields.length > 0,
    };
}

function _parseDaily(payload) {
    const daily = _isObject(payload.daily) ? payload.daily : {};
    const dates = Array.isArray(daily.time)
        ? daily.time.filter(date => typeof date === 'string' && date !== '')
        : [];
    const series = _seriesFromDaily(daily);
    let missingFields = [];

    for (const field in DAILY_SOURCES) {
        if (!Array.isArray(daily[DAILY_SOURCES[field]]))
            missingFields.push(field);
    }

    return {
        dates,
        leafWetnessProbabilityMean: series.leafWetnessProbabilityMean || [],
        temperatureMean: series.temperatureMean || [],
        temperatureMax: series.temperatureMax || [],
        temperatureMin: series.temperatureMin || [],
        relativeHumidityMean: series.relativeHumidityMean || [],
        relativeHumidityMax: series.relativeHumidityMax || [],
        precipitationSum: series.precipitationSum || [],
        windSpeedMean: series.windSpeedMean || [],
        windSpeedMax: series.windSpeedMax || [],
        windGustsMax: series.windGustsMax || [],
        missingFields,
        isPartial: missingFields.length > 0,
    };
}

function _isTransientHttpStatus(statusCode) {
    return statusCode === 408 || statusCode === 429 || statusCode >= 500;
}

function _bytesToString(bytes) {
    return ByteArray.toString(ByteArray.fromGBytes(bytes));
}

/**
 * Build the Open-Meteo Weather Forecast API URL for a coordinate.
 *
 * @param {Object} coordinates - Object with latitude and longitude numbers.
 * @param {Object} options - Optional forecastDays, timezone, and baseUrl.
 * @returns {string} Fully encoded API URL.
 */
var buildRequestUrl = function(coordinates, options = {}) {
    const latitude = coordinates ? coordinates.latitude : null;
    const longitude = coordinates ? coordinates.longitude : null;

    _validateCoordinate(latitude, longitude);

    const forecastDays = _normalizeForecastDays(options.forecastDays);
    const timezone = typeof options.timezone === 'string' && options.timezone !== ''
        ? options.timezone
        : 'auto';

    const query = _encodeQuery({
        latitude,
        longitude,
        current: SOURCE_VARIABLES.join(','),
        hourly: SOURCE_VARIABLES.join(','),
        daily: DAILY_VARIABLES.join(','),
        forecast_days: forecastDays,
        timezone,
    });

    return `${options.baseUrl || API_BASE_URL}?${query}`;
};

/**
 * Parse and validate an Open-Meteo Weather JSON string.
 *
 * @param {string} jsonText - Raw API response text.
 * @param {Object} options - Optional parser options.
 * @returns {Object} Canonical weather provider response.
 */
var parseOpenMeteoJson = function(jsonText, options = {}) {
    let payload = null;

    try {
        payload = JSON.parse(jsonText);
    } catch (error) {
        throw new Error(`Invalid Open-Meteo Weather JSON: ${error.message}`);
    }

    return parseOpenMeteoResponse(payload, options);
};

/**
 * Parse an Open-Meteo Weather response object into AirAware's weather shape.
 *
 * @param {Object} payload - Parsed Open-Meteo JSON object.
 * @param {Object} options - Optional parser options.
 * @returns {Object} Canonical weather provider response.
 */
var parseOpenMeteoResponse = function(payload, options = {}) {
    if (!_isObject(payload))
        throw new Error('Invalid Open-Meteo Weather response: expected object');

    if (payload.error === true)
        throw new Error(`Open-Meteo Weather error: ${payload.reason || 'unknown error'}`);

    const current = _parseCurrent(payload);
    const parsed = _parseHourly(payload);
    const daily = _parseDaily(payload);
    const metadata = {
        latitude: _coordinateOrNull(payload.latitude, -90, 90),
        longitude: _coordinateOrNull(payload.longitude, -180, 180),
        timezone: typeof payload.timezone === 'string' ? payload.timezone : null,
        timezoneAbbreviation: typeof payload.timezone_abbreviation === 'string'
            ? payload.timezone_abbreviation
            : null,
        utcOffsetSeconds: _isFiniteNumber(payload.utc_offset_seconds)
            ? payload.utc_offset_seconds
            : 0,
        generationTimeMs: _isFiniteNumber(payload.generationtime_ms)
            ? payload.generationtime_ms
            : null,
    };

    return {
        provider: PROVIDER_ID,
        latitude: metadata.latitude,
        longitude: metadata.longitude,
        timezone: metadata.timezone,
        utcOffsetSeconds: metadata.utcOffsetSeconds,
        units: _unitsFromPayload(payload),
        current,
        hourly: {
            timestamps: parsed.timestamps,
            temperature: parsed.series.temperature,
            relativeHumidity: parsed.series.relativeHumidity,
            dewPoint: parsed.series.dewPoint,
            precipitation: parsed.series.precipitation,
            windSpeed: parsed.series.windSpeed,
            windDirection: parsed.series.windDirection,
            windGusts: parsed.series.windGusts,
            visibility: parsed.series.visibility,
            missingFields: parsed.missingFields,
            isPartial: parsed.isPartial,
        },
        hourlyRecords: parsed.records,
        daily,
        metadata,
        missingFields: parsed.missingFields,
        isPartial: current.isPartial || parsed.isPartial || daily.isPartial,
        fetchedAt: GLib.get_real_time() / 1000,
    };
};

/**
 * Fetch Open-Meteo Weather data asynchronously using Soup.
 *
 * The request retries once for transient network failures and HTTP 408, 429, or
 * 5xx responses. The callback receives (error, data). The returned handle can be
 * cancelled during applet teardown.
 *
 * @param {Object} coordinates - Object with latitude and longitude numbers.
 * @param {Object|Function} options - Fetch options or callback.
 * @param {Function} callback - Completion callback.
 * @returns {Object} Request handle with cancel() method.
 */
var fetchForecastAsync = function(coordinates, options = {}, callback = null) {
    if (typeof options === 'function') {
        callback = options;
        options = {};
    }

    if (typeof callback !== 'function')
        throw new Error('fetchForecastAsync requires a callback');

    const cancellable = new Gio.Cancellable();
    const session = options.session || new Soup.Session();
    session.timeout = _isFiniteNumber(options.timeoutSeconds)
        ? Math.max(1, Math.floor(options.timeoutSeconds))
        : DEFAULT_TIMEOUT_SECONDS;

    let url = null;
    let attempt = 0;
    let completed = false;

    function finish(error, data) {
        if (completed)
            return;

        completed = true;
        callback(error, data);
    }

    try {
        url = buildRequestUrl(coordinates, options);
    } catch (error) {
        finish(error, null);

        return {
            cancel() {
                cancellable.cancel();
            },
        };
    }

    function send() {
        const message = Soup.Message.new('GET', url);

        session.send_and_read_async(
            message,
            GLib.PRIORITY_DEFAULT,
            cancellable,
            (source, result) => {
                let bytes = null;
                let statusCode = null;
                let text = null;

                try {
                    bytes = source.send_and_read_finish(result);
                    statusCode = message.get_status();
                    text = _bytesToString(bytes);
                } catch (error) {
                    if (!cancellable.is_cancelled() && attempt === 0) {
                        attempt++;
                        send();
                        return;
                    }

                    finish(error, null);
                    return;
                }

                if (statusCode < 200 || statusCode >= 300) {
                    if (attempt === 0 && _isTransientHttpStatus(statusCode)) {
                        attempt++;
                        send();
                        return;
                    }

                    finish(new Error(`Open-Meteo Weather HTTP ${statusCode}`), null);
                    return;
                }

                try {
                    finish(null, parseOpenMeteoJson(text, options));
                } catch (error) {
                    finish(error, null);
                }
            }
        );
    }

    try {
        send();
    } catch (error) {
        finish(error, null);
    }

    return {
        cancel() {
            cancellable.cancel();
        },
    };
};
