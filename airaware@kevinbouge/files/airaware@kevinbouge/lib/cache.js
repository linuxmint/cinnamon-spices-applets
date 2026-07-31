/* exported getDefaultCacheDirectory, createCache, isValidCoordinates,
 * isValidPlace, isValidProviderResponse */

const ByteArray = imports.byteArray;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;

const RESPONSE_CACHE_VERSION = 3;
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

function _hasLegacyReadingFields(readings) {
    if (!_isObject(readings))
        return false;

    for (const field of REQUIRED_READING_FIELDS) {
        if (field === 'aerosolOpticalDepth' ||
            field === 'carbonMonoxide' ||
            field === 'sulfurDioxide')
            continue;

        if (!Object.prototype.hasOwnProperty.call(readings, field))
            return false;
    }

    return true;
}

function _normalizeReadings(readings) {
    let normalized = {};

    for (const field of REQUIRED_READING_FIELDS) {
        normalized[field] = Object.prototype.hasOwnProperty.call(readings, field)
            ? readings[field]
            : null;
    }

    return normalized;
}

function _isValidForecastDay(day) {
    return _isObject(day) &&
        typeof day.date === 'string' &&
        _hasCanonicalReadingFields(day.readings) &&
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
        !Array.isArray(weather.hourly) ||
        !_isFiniteNumber(weather.fetchedAt))
        return false;

    for (const hour of weather.hourly) {
        if (!_isValidWeatherHour(hour))
            return false;
    }

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

function _migrateForecastDay(day) {
    let migrated = {};

    for (const key in day)
        migrated[key] = day[key];

    migrated.readings = _normalizeReadings(day.readings);

    if (!Object.prototype.hasOwnProperty.call(migrated, 'moldPotential'))
        migrated.moldPotential = null;

    return migrated;
}

function _migrateProviderResponse(response) {
    if (!_isObject(response) ||
        !_isObject(response.current) ||
        !_hasLegacyReadingFields(response.current.readings) ||
        !Array.isArray(response.forecast))
        return response;

    let migrated = {};

    for (const key in response)
        migrated[key] = response[key];

    migrated.current = {};

    for (const key in response.current)
        migrated.current[key] = response.current[key];

    migrated.current.readings = _normalizeReadings(response.current.readings);

    if (!Object.prototype.hasOwnProperty.call(migrated.current, 'moldPotential'))
        migrated.current.moldPotential = null;

    migrated.forecast = response.forecast.map(_migrateForecastDay);
    migrated.airQualityFetchedAt = _isFiniteNumber(response.airQualityFetchedAt)
        ? response.airQualityFetchedAt
        : response.fetchedAt;
    migrated.weatherFetchedAt = _isFiniteNumber(response.weatherFetchedAt)
        ? response.weatherFetchedAt
        : null;

    if (!Object.prototype.hasOwnProperty.call(migrated, 'weather'))
        migrated.weather = null;

    return migrated;
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

function _readJsonFile(path) {
    const file = Gio.File.new_for_path(path);
    let stream = null;

    try {
        stream = file.read(null);
    } catch (error) {
        if (error.matches &&
            error.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.NOT_FOUND))
            return null;

        throw error;
    }

    const chunks = [];

    try {
        while (true) {
            const bytes = stream.read_bytes(4096, null);

            if (bytes.get_size() === 0)
                break;

            chunks.push(ByteArray.toString(bytes.toArray()));
        }
    } finally {
        stream.close(null);
    }

    return JSON.parse(chunks.join(''));
}

function _writeJsonFile(path, value) {
    const file = Gio.File.new_for_path(path);
    const contents = `${JSON.stringify(value, null, 2)}\n`;
    const stream = file.replace(
        null,
        false,
        Gio.FileCreateFlags.REPLACE_DESTINATION,
        null
    );

    try {
        stream.write_all(contents, null);
    } finally {
        stream.close(null);
    }
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

function _readEnvelope(path, validator) {
    return _readEnvelopeWithMigration(path, validator, null, STABLE_CACHE_VERSION);
}

function _readEnvelopeWithMigration(path, validator, migrator, targetVersion = RESPONSE_CACHE_VERSION) {
    let envelope = null;

    try {
        envelope = _readJsonFile(path);
    } catch (error) {
        return null;
    }

    if (!_isObject(envelope) || envelope.version !== targetVersion) {
        if (!_isObject(envelope) ||
            (envelope.version !== 1 && envelope.version !== 2) ||
            typeof migrator !== 'function')
            return null;
    }

    if (!_isFiniteNumber(envelope.savedAt))
        return null;

    if (envelope.version !== targetVersion && typeof migrator === 'function') {
        const migratedData = migrator(envelope.data);

        if (!validator(migratedData))
            return null;

        return {
            version: targetVersion,
            savedAt: envelope.savedAt,
            data: migratedData,
        };
    }

    if (!validator(envelope.data))
        return null;

    return envelope;
}

function _writeEnvelope(path, data, validator) {
    return _writeVersionedEnvelope(path, data, validator, STABLE_CACHE_VERSION);
}

function _writeVersionedEnvelope(path, data, validator, version) {
    if (!validator(data))
        return _failure('Invalid cache data');

    const envelope = {
        version,
        savedAt: _nowMs(),
        data,
    };

    try {
        _writeJsonFile(path, envelope);
    } catch (error) {
        return _failure(error.message);
    }

    return _success(envelope);
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
        _hasCanonicalReadingFields(response.current.readings) &&
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
        readCoordinates() {
            return _readEnvelope(coordinatesPath, isValidCoordinates);
        },

        /**
         * Save valid coordinates without replacing good cache with bad data.
         *
         * @param {Object} coordinates - Coordinates object.
         * @returns {Object} Result object with ok boolean.
         */
        writeCoordinates(coordinates) {
            return _writeEnvelope(coordinatesPath, coordinates, isValidCoordinates);
        },

        /**
         * Read cached place name, returning null on absence or invalid data.
         *
         * @returns {Object|null} Cache envelope or null.
         */
        readPlace() {
            return _readEnvelope(placePath, isValidPlace);
        },

        /**
         * Save a valid place name without replacing good cache with bad data.
         *
         * @param {Object} place - Place-name object.
         * @returns {Object} Result object with ok boolean.
         */
        writePlace(place) {
            return _writeEnvelope(placePath, place, isValidPlace);
        },

        /**
         * Read last successful provider response, returning null if unusable.
         *
         * @returns {Object|null} Cache envelope or null.
         */
        readResponse() {
            return _readEnvelopeWithMigration(
                responsePath,
                isValidProviderResponse,
                _migrateProviderResponse,
                RESPONSE_CACHE_VERSION
            );
        },

        /**
         * Save a valid provider response without replacing valid cache with bad data.
         *
         * @param {Object} response - Canonical provider response.
         * @returns {Object} Result object with ok boolean.
         */
        writeResponse(response) {
            return _writeVersionedEnvelope(
                responsePath,
                response,
                isValidProviderResponse,
                RESPONSE_CACHE_VERSION
            );
        },
    };
};
