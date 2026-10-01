/* exported PROVIDER_ID, DEFAULT_RADIUS_METERS, buildOverpassQuery,
 * buildRequestUrl, parseOverpassJson, parseOverpassResponse,
 * vegetationCacheKey, isVegetationCacheFresh, fetchVegetationAsync */

imports.gi.versions.Soup = '3.0';

const ByteArray = imports.byteArray;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Soup = imports.gi.Soup;

var PROVIDER_ID = 'openstreetmap';
var DEFAULT_RADIUS_METERS = 2000;

const API_BASE_URL = 'https://overpass-api.de/api/interpreter';
const USER_AGENT = 'AirAware Cinnamon applet';
const DEFAULT_TIMEOUT_SECONDS = 20;
const OVERPASS_TIMEOUT_SECONDS = 20;
const MIN_RADIUS_METERS = 100;
const MAX_RADIUS_METERS = 5000;
const CACHE_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;
const EARTH_RADIUS_METERS = 6371000;

const CATEGORY_IDS = Object.freeze([
    'woodland',
    'grassland',
    'orchard',
    'scrub',
    'parkland',
    'farmland',
]);
const TAXON_IDS = Object.freeze([
    'birch',
    'alder',
    'olive',
]);
const TAXON_PATTERNS = Object.freeze({
    birch: /^betula(\b|$)/i,
    alder: /^alnus(\b|$)/i,
    olive: /^olea(\b|$)/i,
});

function _isObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function _isFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
}

function _validateCoordinate(latitude, longitude) {
    if (!_isFiniteNumber(latitude) || latitude < -90 || latitude > 90)
        throw new Error('Invalid latitude');

    if (!_isFiniteNumber(longitude) || longitude < -180 || longitude > 180)
        throw new Error('Invalid longitude');
}

function _normalizeRadius(radiusMeters) {
    const value = Number(radiusMeters);

    if (!_isFiniteNumber(value) ||
        value < MIN_RADIUS_METERS ||
        value > MAX_RADIUS_METERS)
        throw new Error('Invalid vegetation search radius');

    return Math.round(value);
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

function _toRadians(value) {
    return value * Math.PI / 180;
}

function _distanceMeters(fromCoordinates, toCoordinates) {
    const lat1 = _toRadians(fromCoordinates.latitude);
    const lat2 = _toRadians(toCoordinates.latitude);
    const deltaLat = _toRadians(toCoordinates.latitude - fromCoordinates.latitude);
    const deltaLon = _toRadians(toCoordinates.longitude - fromCoordinates.longitude);
    const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
        Math.cos(lat1) * Math.cos(lat2) *
        Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return Math.round(EARTH_RADIUS_METERS * c);
}

function _elementCoordinates(element) {
    if (_isFiniteNumber(element.lat) && _isFiniteNumber(element.lon)) {
        return {
            latitude: element.lat,
            longitude: element.lon,
        };
    }

    if (_isObject(element.center) &&
        _isFiniteNumber(element.center.lat) &&
        _isFiniteNumber(element.center.lon)) {
        return {
            latitude: element.center.lat,
            longitude: element.center.lon,
        };
    }

    return null;
}

function _emptyCategory() {
    return {
        present: false,
        featureCount: 0,
        nearestMeters: null,
    };
}

function _emptyTaxon() {
    return {
        featureCount: 0,
        nearestMeters: null,
    };
}

function _emptyCategories() {
    let categories = {};

    for (const category of CATEGORY_IDS)
        categories[category] = _emptyCategory();

    return categories;
}

function _emptyTaxa() {
    let taxa = {};

    for (const taxon of TAXON_IDS)
        taxa[taxon] = _emptyTaxon();

    return taxa;
}

function _recordFeature(group, key, distance) {
    group[key].featureCount++;
    group[key].nearestMeters = group[key].nearestMeters === null
        ? distance
        : Math.min(group[key].nearestMeters, distance);

    if (Object.prototype.hasOwnProperty.call(group[key], 'present'))
        group[key].present = true;
}

function _categoriesFromTags(tags) {
    let categories = [];

    if (!_isObject(tags))
        return categories;

    if (tags.natural === 'wood' || tags.landuse === 'forest')
        categories.push('woodland');

    if (tags.natural === 'grassland' ||
        tags.landuse === 'meadow' ||
        tags.landuse === 'grass')
        categories.push('grassland');

    if (tags.landuse === 'orchard')
        categories.push('orchard');

    if (tags.natural === 'scrub')
        categories.push('scrub');

    if (tags.leisure === 'park')
        categories.push('parkland');

    if (tags.landuse === 'farmland')
        categories.push('farmland');

    return categories;
}

function _mappedTaxaFromTags(tags) {
    let taxa = [];

    if (!_isObject(tags))
        return taxa;

    const values = ['genus', 'species', 'taxon']
        .map(key => typeof tags[key] === 'string' ? tags[key].trim() : '')
        .filter(value => value !== '');

    for (const taxon in TAXON_PATTERNS) {
        if (values.some(value => TAXON_PATTERNS[taxon].test(value)))
            taxa.push(taxon);
    }

    return taxa;
}

function _isTransientHttpStatus(statusCode) {
    return statusCode === 408 || statusCode === 429 || statusCode >= 500;
}

function _bytesToString(bytes) {
    return ByteArray.toString(ByteArray.fromGBytes(bytes));
}

function _nowIsoString() {
    return GLib.DateTime.new_now_utc().format_iso8601();
}

/**
 * Build an Overpass QL query for mapped vegetation near a coordinate.
 *
 * @param {Object} coordinates - Latitude/longitude pair.
 * @param {number} radiusMeters - Search radius in meters.
 * @returns {string} Overpass QL query.
 */
var buildOverpassQuery = function(coordinates, radiusMeters = DEFAULT_RADIUS_METERS) {
    const latitude = coordinates ? coordinates.latitude : null;
    const longitude = coordinates ? coordinates.longitude : null;
    const radius = _normalizeRadius(radiusMeters);

    _validateCoordinate(latitude, longitude);

    const lat = latitude.toFixed(6);
    const lon = longitude.toFixed(6);

    return [
        `[out:json][timeout:${OVERPASS_TIMEOUT_SECONDS}];`,
        '(',
        `  nwr(around:${radius},${lat},${lon})["natural"~"^(wood|tree|scrub|grassland)$"];`,
        `  nwr(around:${radius},${lat},${lon})["landuse"~"^(forest|meadow|grass|orchard|farmland)$"];`,
        `  nwr(around:${radius},${lat},${lon})["leisure"="park"];`,
        ');',
        'out center tags;',
    ].join('\n');
};

/**
 * Build the Overpass API request URL.
 *
 * @param {Object} coordinates - Latitude/longitude pair.
 * @param {Object} options - Optional radiusMeters and baseUrl.
 * @returns {string} Request URL.
 */
var buildRequestUrl = function(coordinates, options = {}) {
    const query = buildOverpassQuery(
        coordinates,
        options.radiusMeters || DEFAULT_RADIUS_METERS
    );

    return `${options.baseUrl || API_BASE_URL}?${_encodeQuery({ data: query })}`;
};

/**
 * Build a coarse cache key for vegetation data.
 *
 * @param {Object} coordinates - Latitude/longitude pair.
 * @param {number} radiusMeters - Search radius in meters.
 * @returns {string} Stable cache key.
 */
var vegetationCacheKey = function(coordinates, radiusMeters = DEFAULT_RADIUS_METERS) {
    const latitude = coordinates ? Number(coordinates.latitude) : null;
    const longitude = coordinates ? Number(coordinates.longitude) : null;
    const radius = _normalizeRadius(radiusMeters);

    _validateCoordinate(latitude, longitude);

    return `${latitude.toFixed(2)},${longitude.toFixed(2)},${radius}`;
};

/**
 * Determine whether a vegetation cache envelope is still fresh.
 *
 * @param {Object} envelope - Vegetation cache envelope.
 * @param {number} nowMs - Current time in milliseconds.
 * @param {number} maxAgeMs - Cache lifetime in milliseconds.
 * @returns {boolean} True when usable and fresh.
 */
var isVegetationCacheFresh = function(envelope, nowMs = GLib.get_real_time() / 1000, maxAgeMs = CACHE_MAX_AGE_MS) {
    return _isObject(envelope) &&
        _isFiniteNumber(envelope.savedAt) &&
        nowMs - envelope.savedAt <= maxAgeMs;
};

/**
 * Parse and validate an Overpass JSON string.
 *
 * @param {string} jsonText - Raw Overpass JSON.
 * @param {Object} options - Coordinates and radiusMeters.
 * @returns {Object} Normalized vegetation context.
 */
var parseOverpassJson = function(jsonText, options = {}) {
    let payload = null;

    try {
        payload = JSON.parse(jsonText);
    } catch (error) {
        throw new Error(`Invalid Overpass JSON: ${error.message}`);
    }

    return parseOverpassResponse(payload, options);
};

/**
 * Parse an Overpass response object into AirAware's vegetation context shape.
 *
 * @param {Object} payload - Parsed Overpass response.
 * @param {Object} options - Coordinates, radiusMeters, and fetchedAt.
 * @returns {Object} Normalized vegetation context.
 */
var parseOverpassResponse = function(payload, options = {}) {
    if (!_isObject(payload))
        throw new Error('Invalid Overpass response: expected object');

    if (!Array.isArray(payload.elements))
        throw new Error('Invalid Overpass response: missing elements');

    const coordinates = options.coordinates || {};
    const latitude = Number(coordinates.latitude);
    const longitude = Number(coordinates.longitude);
    const radiusMeters = _normalizeRadius(options.radiusMeters || DEFAULT_RADIUS_METERS);

    _validateCoordinate(latitude, longitude);

    const origin = {
        latitude,
        longitude,
    };
    let categories = _emptyCategories();
    let mappedTaxa = _emptyTaxa();
    let seen = {};

    for (const element of payload.elements) {
        if (!_isObject(element) ||
            typeof element.type !== 'string' ||
            !_isFiniteNumber(element.id))
            continue;

        const key = `${element.type}/${element.id}`;

        if (seen[key])
            continue;

        seen[key] = true;

        const featureCoordinates = _elementCoordinates(element);

        if (featureCoordinates === null)
            continue;

        const distance = _distanceMeters(origin, featureCoordinates);
        const tags = _isObject(element.tags) ? element.tags : {};

        for (const category of _categoriesFromTags(tags))
            _recordFeature(categories, category, distance);

        for (const taxon of _mappedTaxaFromTags(tags))
            _recordFeature(mappedTaxa, taxon, distance);
    }

    return {
        provider: PROVIDER_ID,
        fetchedAt: typeof options.fetchedAt === 'string' ? options.fetchedAt : _nowIsoString(),
        coordinates: origin,
        radiusMeters,
        cacheKey: vegetationCacheKey(origin, radiusMeters),
        categories,
        mappedTaxa,
        completeness: 'unknown',
    };
};

/**
 * Fetch nearby vegetation context asynchronously using Overpass.
 *
 * @param {Object} coordinates - Latitude/longitude pair.
 * @param {Object|Function} options - Fetch options or callback.
 * @param {Function} callback - Completion callback.
 * @returns {Object} Cancellable request handle.
 */
var fetchVegetationAsync = function(coordinates, options = {}, callback = null) {
    if (typeof options === 'function') {
        callback = options;
        options = {};
    }

    if (typeof callback !== 'function')
        throw new Error('fetchVegetationAsync requires a callback');

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

        message.request_headers.append('Accept', 'application/json');
        message.request_headers.append('User-Agent', USER_AGENT);
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

                    finish(new Error(`Overpass HTTP ${statusCode}`), null);
                    return;
                }

                try {
                    finish(null, parseOverpassJson(text, {
                        coordinates,
                        radiusMeters: options.radiusMeters || DEFAULT_RADIUS_METERS,
                    }));
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
