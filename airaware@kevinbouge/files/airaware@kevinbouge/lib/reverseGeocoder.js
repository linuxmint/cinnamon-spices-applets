/* exported PROVIDER_ID, buildRequestUrl, parseNominatimJson,
 * parseNominatimResponse, fetchPlaceNameAsync */

imports.gi.versions.Soup = '3.0';

const ByteArray = imports.byteArray;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Soup = imports.gi.Soup;

var PROVIDER_ID = 'nominatim';

const API_BASE_URL = 'https://nominatim.openstreetmap.org/reverse';
const DEFAULT_TIMEOUT_SECONDS = 10;
const USER_AGENT = 'AirAware/0.1.0 (Cinnamon applet; https://github.com/kevinbouge/cinnamon-spices-applets)';

const PRIMARY_ADDRESS_FIELDS = Object.freeze([
    'city',
    'town',
    'village',
    'municipality',
    'hamlet',
    'suburb',
    'neighbourhood',
    'city_district',
]);

const SECONDARY_ADDRESS_FIELDS = Object.freeze([
    'county',
    'state',
    'region',
    'country',
]);

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

function _encodeQuery(params) {
    let pairs = [];

    for (const key in params) {
        if (params[key] === null || params[key] === undefined)
            continue;

        pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`);
    }

    return pairs.join('&');
}

function _cleanText(value) {
    if (typeof value !== 'string')
        return null;

    const trimmed = value.trim();

    if (trimmed === '')
        return null;

    return trimmed.length > 200 ? `${trimmed.substring(0, 197)}...` : trimmed;
}

function _firstAddressValue(address, fields) {
    if (!_isObject(address))
        return null;

    for (const field of fields) {
        const value = _cleanText(address[field]);

        if (value !== null)
            return value;
    }

    return null;
}

function _displayNameFallback(payload) {
    const explicitName = _cleanText(payload.name);

    if (explicitName !== null)
        return explicitName;

    const displayName = _cleanText(payload.display_name);

    if (displayName === null)
        return null;

    return displayName.split(',')[0].trim();
}

function _composeName(primaryName, secondaryName) {
    if (primaryName === null)
        return secondaryName;

    if (secondaryName === null || secondaryName === primaryName)
        return primaryName;

    return `${primaryName}, ${secondaryName}`;
}

function _bytesToString(bytes) {
    return ByteArray.toString(ByteArray.fromGBytes(bytes));
}

/**
 * Build the Nominatim reverse-geocoding URL for a coordinate.
 *
 * @param {Object} coordinates - Object with latitude and longitude numbers.
 * @param {Object} options - Optional language and baseUrl.
 * @returns {string} Fully encoded API URL.
 */
var buildRequestUrl = function(coordinates, options = {}) {
    const latitude = coordinates ? coordinates.latitude : null;
    const longitude = coordinates ? coordinates.longitude : null;

    _validateCoordinate(latitude, longitude);

    const query = _encodeQuery({
        format: 'jsonv2',
        lat: latitude,
        lon: longitude,
        zoom: 10,
        addressdetails: 1,
        'accept-language': typeof options.language === 'string'
            ? options.language
            : null,
    });

    return `${options.baseUrl || API_BASE_URL}?${query}`;
};

/**
 * Parse a Nominatim JSON string into AirAware's place-name shape.
 *
 * @param {string} jsonText - Raw API response text.
 * @returns {Object} Canonical place-name object.
 */
var parseNominatimJson = function(jsonText) {
    let payload = null;

    try {
        payload = JSON.parse(jsonText);
    } catch (error) {
        throw new Error(`Invalid Nominatim JSON: ${error.message}`);
    }

    return parseNominatimResponse(payload);
};

/**
 * Parse a Nominatim response object into AirAware's place-name shape.
 *
 * @param {Object} payload - Parsed Nominatim JSON object.
 * @returns {Object} Canonical place-name object.
 */
var parseNominatimResponse = function(payload) {
    if (!_isObject(payload))
        throw new Error('Invalid Nominatim response: expected object');

    if (_cleanText(payload.error) !== null)
        throw new Error(`Nominatim error: ${payload.error}`);

    const address = _isObject(payload.address) ? payload.address : {};
    let primaryName = _firstAddressValue(address, PRIMARY_ADDRESS_FIELDS);
    let secondaryName = _firstAddressValue(address, SECONDARY_ADDRESS_FIELDS);

    if (primaryName === null)
        primaryName = _displayNameFallback(payload);

    const name = _composeName(primaryName, secondaryName);

    if (name === null)
        throw new Error('Invalid Nominatim response: no usable place name');

    return {
        provider: PROVIDER_ID,
        name,
        primaryName,
        secondaryName,
        country: _cleanText(address.country),
        fetchedAt: GLib.get_real_time() / 1000,
    };
};

/**
 * Fetch a place name asynchronously using Soup.
 *
 * The request retries once for network errors and HTTP 408, 429, or 5xx
 * responses. The callback receives (error, place). The returned handle can be
 * cancelled during applet teardown.
 *
 * @param {Object} coordinates - Object with latitude and longitude numbers.
 * @param {Object|Function} options - Fetch options or callback.
 * @param {Function} callback - Completion callback.
 * @returns {Object} Request handle with cancel() method.
 */
var fetchPlaceNameAsync = function(coordinates, options = {}, callback = null) {
    if (typeof options === 'function') {
        callback = options;
        options = {};
    }

    if (typeof callback !== 'function')
        throw new Error('fetchPlaceNameAsync requires a callback');

    const cancellable = new Gio.Cancellable();
    const session = options.session || new Soup.Session();
    session.timeout = _isFiniteNumber(options.timeoutSeconds)
        ? Math.max(1, Math.floor(options.timeoutSeconds))
        : DEFAULT_TIMEOUT_SECONDS;

    let url = null;
    let attempt = 0;
    let completed = false;

    function finish(error, place) {
        if (completed)
            return;

        completed = true;
        callback(error, place);
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

    function shouldRetry(statusCode) {
        return statusCode === 408 || statusCode === 429 || statusCode >= 500;
    }

    function send() {
        const message = Soup.Message.new('GET', url);

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
                    if (attempt === 0 && shouldRetry(statusCode)) {
                        attempt++;
                        send();
                        return;
                    }

                    finish(new Error(`Nominatim HTTP ${statusCode}`), null);
                    return;
                }

                try {
                    finish(null, parseNominatimJson(text));
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
