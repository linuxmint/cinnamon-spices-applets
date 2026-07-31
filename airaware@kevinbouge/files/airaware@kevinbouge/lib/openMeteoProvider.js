/* exported PROVIDER_ID, buildRequestUrl, parseOpenMeteoJson,
 * parseOpenMeteoResponse, fetchForecastAsync */

imports.gi.versions.Soup = '3.0';

const ByteArray = imports.byteArray;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Soup = imports.gi.Soup;

var PROVIDER_ID = 'open-meteo';

const API_BASE_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality';
const DEFAULT_TIMEOUT_SECONDS = 15;
const DEFAULT_FORECAST_DAYS = 4;
const MAX_FORECAST_DAYS = 7;

const SOURCE_VARIABLES = Object.freeze([
    'pm10',
    'pm2_5',
    'nitrogen_dioxide',
    'ozone',
    'sulphur_dioxide',
    'dust',
    'aerosol_optical_depth',
    'carbon_monoxide',
    'alder_pollen',
    'birch_pollen',
    'olive_pollen',
    'grass_pollen',
    'mugwort_pollen',
    'ragweed_pollen',
]);

const CANONICAL_SOURCES = Object.freeze({
    treePollen: Object.freeze(['alder_pollen', 'birch_pollen', 'olive_pollen']),
    grassPollen: Object.freeze(['grass_pollen']),
    weedPollen: Object.freeze(['mugwort_pollen', 'ragweed_pollen']),
    pm25: Object.freeze(['pm2_5']),
    pm10: Object.freeze(['pm10']),
    nitrogenDioxide: Object.freeze(['nitrogen_dioxide']),
    ozone: Object.freeze(['ozone']),
    sulfurDioxide: Object.freeze(['sulphur_dioxide']),
    dust: Object.freeze(['dust']),
    aerosolOpticalDepth: Object.freeze(['aerosol_optical_depth']),
    carbonMonoxide: Object.freeze(['carbon_monoxide']),
});

const CANONICAL_FIELDS = Object.freeze([
    'treePollen',
    'grassPollen',
    'weedPollen',
    'pm25',
    'pm10',
    'nitrogenDioxide',
    'ozone',
    'sulfurDioxide',
    'dust',
    'aerosolOpticalDepth',
    'carbonMonoxide',
]);

function _isObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function _isFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
}

function _sanitizeNumber(value) {
    if (!_isFiniteNumber(value))
        return null;

    return Math.max(0, value);
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

function _sourceValue(source, sourceName) {
    if (!_isObject(source) || !Object.prototype.hasOwnProperty.call(source, sourceName))
        return null;

    return _sanitizeNumber(source[sourceName]);
}

function _canonicalFromSource(source) {
    let readings = {};
    let sourceValues = {};
    let missingFields = [];
    let missingSourceVariables = [];

    for (const field of CANONICAL_FIELDS) {
        let best = null;
        let valuesForField = {};

        for (const sourceName of CANONICAL_SOURCES[field]) {
            const value = _sourceValue(source, sourceName);

            if (value === null) {
                missingSourceVariables.push(sourceName);
                continue;
            }

            valuesForField[sourceName] = value;

            if (best === null || value > best)
                best = value;
        }

        if (best === null) {
            readings[field] = null;
            missingFields.push(field);
        } else {
            readings[field] = best;
        }

        sourceValues[field] = valuesForField;
    }

    return {
        readings,
        sourceValues,
        missingFields,
        missingSourceVariables,
        isPartial: missingFields.length > 0,
    };
}

function _dateFromOpenMeteoTime(timeValue) {
    if (typeof timeValue !== 'string' || timeValue.length < 10)
        return null;

    return timeValue.substring(0, 10);
}

function _sourceValueAt(hourly, sourceName, index) {
    if (!_isObject(hourly) || !Array.isArray(hourly[sourceName]))
        return null;

    return _sanitizeNumber(hourly[sourceName][index]);
}

function _canonicalFromHourlyIndexes(hourly, indexes) {
    let readings = {};
    let sourceValues = {};
    let missingFields = [];
    let missingSourceVariables = [];

    for (const field of CANONICAL_FIELDS) {
        let best = null;
        let valuesForField = {};

        for (const sourceName of CANONICAL_SOURCES[field]) {
            let sourceBest = null;

            for (const index of indexes) {
                const value = _sourceValueAt(hourly, sourceName, index);

                if (value === null)
                    continue;

                if (sourceBest === null || value > sourceBest)
                    sourceBest = value;
            }

            if (sourceBest === null) {
                missingSourceVariables.push(sourceName);
                continue;
            }

            valuesForField[sourceName] = sourceBest;

            if (best === null || sourceBest > best)
                best = sourceBest;
        }

        if (best === null) {
            readings[field] = null;
            missingFields.push(field);
        } else {
            readings[field] = best;
        }

        sourceValues[field] = valuesForField;
    }

    return {
        readings,
        sourceValues,
        missingFields,
        missingSourceVariables,
        isPartial: missingFields.length > 0,
    };
}

function _parseCurrent(payload) {
    if (!_isObject(payload.current)) {
        return {
            time: null,
            readings: {},
            sourceValues: {},
            missingFields: CANONICAL_FIELDS.slice(),
            missingSourceVariables: SOURCE_VARIABLES.slice(),
            isPartial: true,
        };
    }

    const parsed = _canonicalFromSource(payload.current);

    return {
        time: typeof payload.current.time === 'string' ? payload.current.time : null,
        readings: parsed.readings,
        sourceValues: parsed.sourceValues,
        missingFields: parsed.missingFields,
        missingSourceVariables: parsed.missingSourceVariables,
        isPartial: parsed.isPartial,
    };
}

function _groupHourlyIndexesByDate(hourly) {
    if (!_isObject(hourly) || !Array.isArray(hourly.time))
        return [];

    let orderedDates = [];
    let grouped = {};

    for (let index = 0; index < hourly.time.length; index++) {
        const date = _dateFromOpenMeteoTime(hourly.time[index]);

        if (date === null)
            continue;

        if (!Object.prototype.hasOwnProperty.call(grouped, date)) {
            grouped[date] = [];
            orderedDates.push(date);
        }

        grouped[date].push(index);
    }

    return orderedDates.map(date => ({
        date,
        indexes: grouped[date],
    }));
}

function _coordinateOrNull(value, min, max) {
    if (!_isFiniteNumber(value))
        return null;

    if (value < min || value > max)
        return null;

    return value;
}

function _hasAnyReading(readings) {
    if (!_isObject(readings))
        return false;

    for (const field of CANONICAL_FIELDS) {
        if (_isFiniteNumber(readings[field]))
            return true;
    }

    return false;
}

function _parseForecast(payload, forecastDays) {
    const dayGroups = _groupHourlyIndexesByDate(payload.hourly);

    return dayGroups.slice(0, forecastDays).map(day => {
        const parsed = _canonicalFromHourlyIndexes(payload.hourly, day.indexes);

        return {
            date: day.date,
            readings: parsed.readings,
            sourceValues: parsed.sourceValues,
            missingFields: parsed.missingFields,
            missingSourceVariables: parsed.missingSourceVariables,
            isPartial: parsed.isPartial,
        };
    });
}

function _isTransientHttpStatus(statusCode) {
    return statusCode === 408 || statusCode === 429 || statusCode >= 500;
}

function _bytesToString(bytes) {
    return ByteArray.toString(ByteArray.fromGBytes(bytes));
}

/**
 * Build the Open-Meteo Air Quality API URL for a coordinate.
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
        forecast_days: forecastDays,
        timezone,
    });

    return `${options.baseUrl || API_BASE_URL}?${query}`;
};

/**
 * Parse and validate an Open-Meteo JSON string.
 *
 * @param {string} jsonText - Raw API response text.
 * @param {Object} options - Optional parser options.
 * @returns {Object} Canonical provider response.
 */
var parseOpenMeteoJson = function(jsonText, options = {}) {
    let payload = null;

    try {
        payload = JSON.parse(jsonText);
    } catch (error) {
        throw new Error(`Invalid Open-Meteo JSON: ${error.message}`);
    }

    return parseOpenMeteoResponse(payload, options);
};

/**
 * Parse an Open-Meteo response object into AirAware's canonical provider shape.
 *
 * @param {Object} payload - Parsed Open-Meteo JSON object.
 * @param {Object} options - Optional forecastDays parser option.
 * @returns {Object} Canonical provider response.
 */
var parseOpenMeteoResponse = function(payload, options = {}) {
    if (!_isObject(payload))
        throw new Error('Invalid Open-Meteo response: expected object');

    if (payload.error === true)
        throw new Error(`Open-Meteo error: ${payload.reason || 'unknown error'}`);

    if (!_isObject(payload.current) && !_isObject(payload.hourly))
        throw new Error('Invalid Open-Meteo response: missing current and hourly data');

    const forecastDays = _normalizeForecastDays(options.forecastDays);
    const current = _parseCurrent(payload);

    if (!_hasAnyReading(current.readings))
        throw new Error('Invalid Open-Meteo response: no usable current readings');

    const forecast = _parseForecast(payload, forecastDays);
    const isForecastPartial = forecast.some(day => day.isPartial);

    return {
        provider: PROVIDER_ID,
        latitude: _coordinateOrNull(payload.latitude, -90, 90),
        longitude: _coordinateOrNull(payload.longitude, -180, 180),
        timezone: typeof payload.timezone === 'string' ? payload.timezone : null,
        utcOffsetSeconds: _isFiniteNumber(payload.utc_offset_seconds)
            ? payload.utc_offset_seconds
            : 0,
        current,
        forecast,
        isPartial: current.isPartial || isForecastPartial || forecast.length === 0,
        fetchedAt: GLib.get_real_time() / 1000,
    };
};

/**
 * Fetch Open-Meteo data asynchronously using Soup.
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

                    finish(new Error(`Open-Meteo HTTP ${statusCode}`), null);
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
