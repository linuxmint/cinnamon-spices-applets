/* exported getDefaultCacheDirectory, createCache, isValidCoordinates,
 * isValidPlace, isValidProviderResponse */

const ByteArray = imports.byteArray;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;

const RESPONSE_CACHE_VERSION = 4;
const STABLE_CACHE_VERSION = 1;
const DEFAULT_NAMESPACE = 'airaware';
const COORDINATES_FILE = 'coordinates.json';
const PLACE_FILE = 'place.json';
const RESPONSE_FILE = 'response.json';
const REQUIRED_READING_FIELDS = Object.freeze([
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
const RAW_POLLUTANT_FIELDS = Object.freeze([
    'pm25',
    'pm10',
    'nitrogenDioxide',
    'ozone',
    'sulfurDioxide',
    'carbonMonoxide',
]);
const POLLUTANT_AQI_FIELDS = Object.freeze([
    'pm25',
    'pm10',
    'nitrogenDioxide',
    'ozone',
    'sulfurDioxide',
]);
const POLLEN_FIELDS = Object.freeze([
    'alder',
    'birch',
    'grass',
    'mugwort',
    'olive',
    'ragweed',
]);
const CONTEXT_FIELDS = Object.freeze([
    'aerosolOpticalDepth',
    'dust',
    'wildfirePm10',
]);

function _isObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function _isFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
}

function _hasAnyReading(readings) {
    if (!_isObject(readings))
        return false;

    for (const field of REQUIRED_READING_FIELDS) {
        if (_isFiniteNumber(readings[field]))
            return true;
    }

    return false;
}

function _hasCanonicalReadingFields(readings) {
    if (!_isObject(readings))
        return false;

    for (const field of REQUIRED_READING_FIELDS) {
        if (!Object.prototype.hasOwnProperty.call(readings, field))
            return false;
    }

    return true;
}

function _hasNullableNumericFields(values, fields) {
    if (!_isObject(values))
        return false;

    for (const field of fields) {
        if (!Object.prototype.hasOwnProperty.call(values, field))
            return false;

        if (values[field] !== null && !_isFiniteNumber(values[field]))
            return false;
    }

    return true;
}

function _isValidEnvironmentalPoint(point) {
    return _isObject(point) &&
        _hasCanonicalReadingFields(point.readings) &&
        _hasNullableNumericFields(point.rawPollutants, RAW_POLLUTANT_FIELDS) &&
        _hasNullableNumericFields(point.pollutantAqi, POLLUTANT_AQI_FIELDS) &&
        _hasNullableNumericFields(point.pollen, POLLEN_FIELDS) &&
        _hasNullableNumericFields(point.context, CONTEXT_FIELDS);
}

function _isValidForecastDay(day) {
    return _isObject(day) &&
        typeof day.date === 'string' &&
        _isValidEnvironmentalPoint(day) &&
        _isValidMoldPotential(day.moldPotential || null);
}

function _isValidForecast(forecast) {
    if (!Array.isArray(forecast))
        return false;

    for (const day of forecast) {
        if (!_isValidForecastDay(day))
            return false;
    }

    return true;
}

function _isValidWeatherHour(hour) {
    return _isObject(hour) &&
        typeof hour.time === 'string' &&
        _isObject(hour.values);
}

function _isValidWeatherResponse(weather) {
    if (weather === null)
        return true;

    if (!_isObject(weather) ||
        typeof weather.provider !== 'string' ||
        !_isFiniteNumber(weather.fetchedAt))
        return false;

    const records = Array.isArray(weather.hourlyRecords)
        ? weather.hourlyRecords
        : Array.isArray(weather.hourly)
            ? weather.hourly
            : [];

    for (const hour of records) {
        if (!_isValidWeatherHour(hour))
            return false;
    }

    if (!Array.isArray(weather.hourly) && !_isObject(weather.hourly))
        return false;

    if (weather.daily !== undefined && weather.daily !== null && !_isObject(weather.daily))
        return false;

    return true;
}

function _isValidMoldPotential(moldPotential) {
    if (moldPotential === null)
        return true;

    if (!_isObject(moldPotential))
        return false;

    if (moldPotential.isAvailable === false)
        return moldPotential.score === null;

    return moldPotential.isAvailable === true &&
        _isFiniteNumber(moldPotential.score) &&
        moldPotential.score >= 0 &&
        moldPotential.score <= 100;
}

function _nowMs() {
    return GLib.get_real_time() / 1000;
}

function _cachePath(baseDirectory, fileName) {
    return GLib.build_filenamev([baseDirectory, fileName]);
}

function _ensureDirectory(path) {
    try {
        Gio.File.new_for_path(path).make_directory_with_parents(null);
    } catch (error) {
        if (!error.matches ||
            !error.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.EXISTS))
            throw error;
    }
}

function _readJsonFileAsync(path, callback) {
    const file = Gio.File.new_for_path(path);
    const cancellable = Gio.Cancellable.new();

    file.load_contents_async(cancellable, (source, result) => {
        try {
            const [, contents] = source.load_contents_finish(result);
            callback(null, JSON.parse(ByteArray.toString(contents)));
        } catch (error) {
            if (error.matches &&
                error.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.NOT_FOUND)) {
                callback(null, null);
                return;
            }

            callback(error, null);
        }
    });

    return {
        cancel() {
            cancellable.cancel();
        },
    };
}

function _writeJsonFileAsync(path, value, callback) {
    const file = Gio.File.new_for_path(path);
    const contents = `${JSON.stringify(value, null, 2)}\n`;
    const cancellable = Gio.Cancellable.new();
    const bytes = new GLib.Bytes(ByteArray.fromString(contents));

    file.replace_contents_bytes_async(
        bytes,
        null,
        false,
        Gio.FileCreateFlags.REPLACE_DESTINATION,
        cancellable,
        (source, result) => {
            try {
                source.replace_contents_finish(result);
                callback(null);
            } catch (error) {
                callback(error);
            }
        }
    );

    return {
        cancel() {
            cancellable.cancel();
        },
    };
}

function _failure(message) {
    return {
        ok: false,
        error: message,
    };
}

function _success(value) {
    return {
        ok: true,
        value,
    };
}

function _readEnvelopeAsync(path, validator, callback) {
    return _readVersionedEnvelopeAsync(path, validator, STABLE_CACHE_VERSION, callback);
}

function _readVersionedEnvelopeAsync(path, validator, targetVersion, callback) {
    return _readJsonFileAsync(path, (error, envelope) => {
        if (error || !_isObject(envelope) || envelope.version !== targetVersion) {
            callback(null, null);
            return;
        }

        if (!_isFiniteNumber(envelope.savedAt) || !validator(envelope.data)) {
            callback(null, null);
            return;
        }

        callback(null, envelope);
    });
}

function _writeEnvelopeAsync(path, data, validator, callback) {
    return _writeVersionedEnvelopeAsync(path, data, validator, STABLE_CACHE_VERSION, callback);
}

function _writeVersionedEnvelopeAsync(path, data, validator, version, callback) {
    const done = typeof callback === 'function'
        ? callback
        : function() {
        };

    if (!validator(data)) {
        const result = _failure('Invalid cache data');

        GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            done(null, result);
            return GLib.SOURCE_REMOVE;
        });

        return {
            cancel() {
            },
        };
    }

    const envelope = {
        version,
        savedAt: _nowMs(),
        data,
    };

    return _writeJsonFileAsync(path, envelope, error => {
        if (error) {
            done(null, _failure(error.message));
            return;
        }

        done(null, _success(envelope));
    });
}

/**
 * Get AirAware's default cache directory.
 *
 * @param {string} namespace - Optional cache namespace for tests or variants.
 * @returns {string} Absolute cache directory path.
 */
var getDefaultCacheDirectory = function(namespace = DEFAULT_NAMESPACE) {
    return GLib.build_filenamev([GLib.get_user_cache_dir(), namespace]);
};

/**
 * Validate coordinates before they can replace the cached location.
 *
 * @param {Object} coordinates - Coordinates object.
 * @returns {boolean} True when latitude and longitude are usable.
 */
var isValidCoordinates = function(coordinates) {
    return _isObject(coordinates) &&
        _isFiniteNumber(coordinates.latitude) &&
        coordinates.latitude >= -90 &&
        coordinates.latitude <= 90 &&
        _isFiniteNumber(coordinates.longitude) &&
        coordinates.longitude >= -180 &&
        coordinates.longitude <= 180;
};

/**
 * Validate a reverse-geocoded place name before caching.
 *
 * @param {Object} place - Place-name object.
 * @returns {boolean} True when the place is usable.
 */
var isValidPlace = function(place) {
    return _isObject(place) &&
        typeof place.provider === 'string' &&
        typeof place.name === 'string' &&
        place.name.trim() !== '' &&
        place.name.length <= 240 &&
        isValidCoordinates(place.coordinates) &&
        _isFiniteNumber(place.fetchedAt);
};

/**
 * Validate canonical provider data before it can replace the response cache.
 *
 * @param {Object} response - Canonical provider response.
 * @returns {boolean} True when response has current readings and forecast array.
 */
var isValidProviderResponse = function(response) {
    return _isObject(response) &&
        typeof response.provider === 'string' &&
        _isObject(response.current) &&
        _isValidEnvironmentalPoint(response.current) &&
        _hasAnyReading(response.current.readings) &&
        _isValidMoldPotential(response.current.moldPotential || null) &&
        _isValidForecast(response.forecast) &&
        _isValidWeatherResponse(response.weather || null) &&
        _isFiniteNumber(response.fetchedAt) &&
        _isFiniteNumber(response.airQualityFetchedAt || response.fetchedAt) &&
        (response.weatherFetchedAt === null ||
            response.weatherFetchedAt === undefined ||
            _isFiniteNumber(response.weatherFetchedAt));
};

/**
 * Create a cache facade rooted in a specific directory.
 *
 * @param {Object} options - Optional baseDirectory override.
 * @returns {Object} Cache API for coordinates and provider responses.
 */
var createCache = function(options = {}) {
    const baseDirectory = options.baseDirectory || getDefaultCacheDirectory();
    const coordinatesPath = _cachePath(baseDirectory, COORDINATES_FILE);
    const placePath = _cachePath(baseDirectory, PLACE_FILE);
    const responsePath = _cachePath(baseDirectory, RESPONSE_FILE);

    _ensureDirectory(baseDirectory);

    return {
        baseDirectory,

        /**
         * Read cached coordinates, returning null on absence or invalid data.
         *
         * @returns {Object|null} Cache envelope or null.
         */
        readCoordinatesAsync(callback) {
            return _readEnvelopeAsync(coordinatesPath, isValidCoordinates, callback);
        },

        /**
         * Save valid coordinates without replacing good cache with bad data.
         *
         * @param {Object} coordinates - Coordinates object.
         * @returns {Object} Result object with ok boolean.
         */
        writeCoordinatesAsync(coordinates, callback = null) {
            return _writeEnvelopeAsync(coordinatesPath, coordinates, isValidCoordinates, callback);
        },

        /**
         * Read cached place name, returning null on absence or invalid data.
         *
         * @returns {Object|null} Cache envelope or null.
         */
        readPlaceAsync(callback) {
            return _readEnvelopeAsync(placePath, isValidPlace, callback);
        },

        /**
         * Save a valid place name without replacing good cache with bad data.
         *
         * @param {Object} place - Place-name object.
         * @returns {Object} Result object with ok boolean.
         */
        writePlaceAsync(place, callback = null) {
            return _writeEnvelopeAsync(placePath, place, isValidPlace, callback);
        },

        /**
         * Read last successful provider response, returning null if unusable.
         *
         * @returns {Object|null} Cache envelope or null.
         */
        readResponseAsync(callback) {
            return _readVersionedEnvelopeAsync(
                responsePath,
                isValidProviderResponse,
                RESPONSE_CACHE_VERSION,
                callback
            );
        },

        /**
         * Save a valid provider response without replacing valid cache with bad data.
         *
         * @param {Object} response - Canonical provider response.
         * @returns {Object} Result object with ok boolean.
         */
        writeResponseAsync(response, callback = null) {
            return _writeVersionedEnvelopeAsync(
                responsePath,
                response,
                isValidProviderResponse,
                RESPONSE_CACHE_VERSION,
                callback
            );
        },
    };
};
