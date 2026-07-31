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

const RAW_POLLUTANT_SOURCES = Object.freeze({
    pm25: 'pm2_5',
    pm10: 'pm10',
    nitrogenDioxide: 'nitrogen_dioxide',
    ozone: 'ozone',
    sulfurDioxide: 'sulphur_dioxide',
    carbonMonoxide: 'carbon_monoxide',
});

const POLLUTANT_AQI_SOURCES = Object.freeze({
    pm25: 'european_aqi_pm2_5',
    pm10: 'european_aqi_pm10',
    nitrogenDioxide: 'european_aqi_nitrogen_dioxide',
    ozone: 'european_aqi_ozone',
    sulfurDioxide: 'european_aqi_sulphur_dioxide',
});

const POLLEN_SOURCES = Object.freeze({
    alder: 'alder_pollen',
    birch: 'birch_pollen',
    grass: 'grass_pollen',
    mugwort: 'mugwort_pollen',
    olive: 'olive_pollen',
    ragweed: 'ragweed_pollen',
});

const CONTEXT_SOURCES = Object.freeze({
    aerosolOpticalDepth: 'aerosol_optical_depth',
    dust: 'dust',
    wildfirePm10: 'pm10_wildfires',
});

const SOURCE_VARIABLES = Object.freeze([
    'pm10',
    'pm2_5',
    'nitrogen_dioxide',
    'ozone',
    'sulphur_dioxide',
    'carbon_monoxide',
    'aerosol_optical_depth',
    'dust',
    'european_aqi',
    'european_aqi_pm2_5',
    'european_aqi_pm10',
    'european_aqi_nitrogen_dioxide',
    'european_aqi_ozone',
    'european_aqi_sulphur_dioxide',
    'alder_pollen',
    'birch_pollen',
    'grass_pollen',
    'mugwort_pollen',
    'olive_pollen',
    'ragweed_pollen',
    'pm10_wildfires',
]);

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
    'wildfirePm10',
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

function _valuesFromSource(source, sourceMap) {
    let values = {};
    let missingFields = [];
    let missingSourceVariables = [];

    for (const field in sourceMap) {
        const sourceName = sourceMap[field];
        const value = _sourceValue(source, sourceName);

        values[field] = value;

        if (value === null) {
            missingFields.push(field);
            missingSourceVariables.push(sourceName);
        }
    }

    return {
        values,
        missingFields,
        missingSourceVariables,
    };
}

function _maxValues(values, fields) {
    let best = null;

    for (const field of fields) {
        const value = values[field];

        if (value === null)
            continue;

        if (best === null || value > best)
            best = value;
    }

    return best;
}

function _displayReadingsFromSections(rawPollutants, pollen, context) {
    return {
        treePollen: _maxValues(pollen, ['alder', 'birch', 'olive']),
        grassPollen: pollen.grass,
        weedPollen: _maxValues(pollen, ['mugwort', 'ragweed']),
        pm25: rawPollutants.pm25,
        pm10: rawPollutants.pm10,
        nitrogenDioxide: rawPollutants.nitrogenDioxide,
        ozone: rawPollutants.ozone,
        sulfurDioxide: rawPollutants.sulfurDioxide,
        dust: context.dust,
        aerosolOpticalDepth: context.aerosolOpticalDepth,
        carbonMonoxide: rawPollutants.carbonMonoxide,
        wildfirePm10: context.wildfirePm10,
    };
}

function _currentUnits(payload) {
    return _isObject(payload.current_units) ? payload.current_units : {};
}

function _hourlyUnits(payload) {
    return _isObject(payload.hourly_units) ? payload.hourly_units : {};
}

function _canonicalFromSource(source) {
    const raw = _valuesFromSource(source, RAW_POLLUTANT_SOURCES);
    const aqi = _valuesFromSource(source, POLLUTANT_AQI_SOURCES);
    const pollen = _valuesFromSource(source, POLLEN_SOURCES);
    const context = _valuesFromSource(source, CONTEXT_SOURCES);
    const overallEuropeanAqi = _sourceValue(source, 'european_aqi');
    const readings = _displayReadingsFromSections(raw.values, pollen.values, context.values);
    const missingFields = raw.missingFields
        .concat(aqi.missingFields)
        .concat(pollen.missingFields)
        .concat(context.missingFields)
        .concat(overallEuropeanAqi === null ? ['overallEuropeanAqi'] : []);
    const missingSourceVariables = raw.missingSourceVariables
        .concat(aqi.missingSourceVariables)
        .concat(pollen.missingSourceVariables)
        .concat(context.missingSourceVariables)
        .concat(overallEuropeanAqi === null ? ['european_aqi'] : []);

    return {
        readings,
        rawPollutants: raw.values,
        pollutantAqi: aqi.values,
        overallEuropeanAqi,
        pollen: pollen.values,
        context: context.values,
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

function _valuesFromHourlyIndexes(hourly, indexes, sourceMap) {
    let values = {};
    let missingFields = [];
    let missingSourceVariables = [];

    for (const field in sourceMap) {
        let best = null;
        const sourceName = sourceMap[field];

        for (const index of indexes) {
            const value = _sourceValueAt(hourly, sourceName, index);

            if (value === null)
                continue;

            if (best === null || value > best)
                best = value;
        }

        values[field] = best;

        if (best === null) {
            missingFields.push(field);
            missingSourceVariables.push(sourceName);
        }
    }

    return {
        values,
        missingFields,
        missingSourceVariables,
    };
}

function _seriesFromHourly(hourly, sourceMap) {
    let series = {};

    for (const field in sourceMap) {
        const sourceName = sourceMap[field];
        const sourceValues = _isObject(hourly) && Array.isArray(hourly[sourceName])
            ? hourly[sourceName]
            : [];

        series[field] = sourceValues.map(_sanitizeNumber);
    }

    return series;
}

function _canonicalFromHourlyIndexes(hourly, indexes) {
    const raw = _valuesFromHourlyIndexes(hourly, indexes, RAW_POLLUTANT_SOURCES);
    const aqi = _valuesFromHourlyIndexes(hourly, indexes, POLLUTANT_AQI_SOURCES);
    const pollen = _valuesFromHourlyIndexes(hourly, indexes, POLLEN_SOURCES);
    const context = _valuesFromHourlyIndexes(hourly, indexes, CONTEXT_SOURCES);
    const readings = _displayReadingsFromSections(raw.values, pollen.values, context.values);
    const missingFields = raw.missingFields
        .concat(aqi.missingFields)
        .concat(pollen.missingFields)
        .concat(context.missingFields);

    return {
        readings,
        rawPollutants: raw.values,
        pollutantAqi: aqi.values,
        pollen: pollen.values,
        context: context.values,
        sourceValues: {},
        missingFields,
        missingSourceVariables: raw.missingSourceVariables
            .concat(aqi.missingSourceVariables)
            .concat(pollen.missingSourceVariables)
            .concat(context.missingSourceVariables),
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
        timestamp: typeof payload.current.time === 'string' ? payload.current.time : null,
        time: typeof payload.current.time === 'string' ? payload.current.time : null,
        readings: parsed.readings,
        sourceValues: parsed.sourceValues,
        rawPollutants: parsed.rawPollutants,
        pollutantAqi: parsed.pollutantAqi,
        overallEuropeanAqi: parsed.overallEuropeanAqi,
        pollen: parsed.pollen,
        context: parsed.context,
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
            rawPollutants: parsed.rawPollutants,
            pollutantAqi: parsed.pollutantAqi,
            pollen: parsed.pollen,
            context: parsed.context,
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
    const hourly = _isObject(payload.hourly)
        ? {
            timestamps: Array.isArray(payload.hourly.time)
                ? payload.hourly.time.filter(time => typeof time === 'string' && time !== '')
                : [],
            rawPollutants: _seriesFromHourly(payload.hourly, RAW_POLLUTANT_SOURCES),
            pollutantAqi: _seriesFromHourly(payload.hourly, POLLUTANT_AQI_SOURCES),
            pollen: _seriesFromHourly(payload.hourly, POLLEN_SOURCES),
            context: _seriesFromHourly(payload.hourly, CONTEXT_SOURCES),
        }
        : {
            timestamps: [],
            rawPollutants: {},
            pollutantAqi: {},
            pollen: {},
            context: {},
        };
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
        units: {
            current: _currentUnits(payload),
            hourly: _hourlyUnits(payload),
        },
    };

    return {
        provider: PROVIDER_ID,
        latitude: metadata.latitude,
        longitude: metadata.longitude,
        timezone: metadata.timezone,
        utcOffsetSeconds: metadata.utcOffsetSeconds,
        current,
        hourly,
        forecast,
        metadata,
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
