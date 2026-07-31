/* exported APPROXIMATE_ACCURACY_LEVEL, LOCATION_REFRESH_INTERVAL_MS,
 * shouldRefreshCachedCoordinates, createLocationService,
 * lookupCoordinatesWithGeoClueAsync, coordinatesFromManualSettings */

const Cache = imports.cache;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;

const GEOCLUE_BUS_NAME = 'org.freedesktop.GeoClue2';
const GEOCLUE_MANAGER_PATH = '/org/freedesktop/GeoClue2/Manager';
const GEOCLUE_MANAGER_IFACE = 'org.freedesktop.GeoClue2.Manager';
const GEOCLUE_CLIENT_IFACE = 'org.freedesktop.GeoClue2.Client';
const GEOCLUE_LOCATION_IFACE = 'org.freedesktop.GeoClue2.Location';
const DBUS_PROPERTIES_IFACE = 'org.freedesktop.DBus.Properties';

var APPROXIMATE_ACCURACY_LEVEL = 4;
var LOCATION_REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000;
const DEFAULT_MANUAL_ACCURACY_METERS = 10000;

function _isFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
}

function _nowMs() {
    return GLib.get_real_time() / 1000;
}

function _parseCoordinate(value, min, max) {
    if (typeof value === 'string') {
        value = value.trim().replace(',', '.');

        if (value === '')
            return null;
    }

    const parsed = Number(value);

    if (!_isFiniteNumber(parsed) || parsed < min || parsed > max)
        return null;

    return parsed;
}

function _variantValue(properties, name) {
    if (!properties || !Object.prototype.hasOwnProperty.call(properties, name))
        return null;

    const variant = properties[name];
    return variant && typeof variant.deep_unpack === 'function'
        ? variant.deep_unpack()
        : variant;
}

function _coordinatesFromLocationProperties(properties) {
    const latitude = _variantValue(properties, 'Latitude');
    const longitude = _variantValue(properties, 'Longitude');
    const accuracy = _variantValue(properties, 'Accuracy');

    if (!Cache.isValidCoordinates({
        latitude,
        longitude,
    }))
        throw new Error('GeoClue returned invalid coordinates');

    return {
        latitude,
        longitude,
        accuracy: _isFiniteNumber(accuracy) ? accuracy : null,
    };
}

function _newProxyForBusAsync(busType, name, path, iface, cancellable, callback) {
    Gio.DBusProxy.new_for_bus(
        busType,
        Gio.DBusProxyFlags.NONE,
        null,
        name,
        path,
        iface,
        cancellable,
        (source, result) => {
            try {
                callback(null, Gio.DBusProxy.new_for_bus_finish(result));
            } catch (error) {
                callback(error, null);
            }
        }
    );
}

function _callProxyAsync(proxy, methodName, parameters, cancellable, timeoutMs, callback) {
    proxy.call(
        methodName,
        parameters,
        Gio.DBusCallFlags.NONE,
        timeoutMs,
        cancellable,
        (source, result) => {
            try {
                callback(null, source.call_finish(result));
            } catch (error) {
                callback(error, null);
            }
        }
    );
}

function _setDbusPropertyAsync(path, iface, propertyName, valueVariant, cancellable, timeoutMs, callback) {
    _newProxyForBusAsync(
        Gio.BusType.SYSTEM,
        GEOCLUE_BUS_NAME,
        path,
        DBUS_PROPERTIES_IFACE,
        cancellable,
        (proxyError, propertiesProxy) => {
            if (proxyError) {
                callback(proxyError);
                return;
            }

            _callProxyAsync(
                propertiesProxy,
                'Set',
                new GLib.Variant('(ssv)', [iface, propertyName, valueVariant]),
                cancellable,
                timeoutMs,
                callback
            );
        }
    );
}

function _getAllDbusPropertiesAsync(path, iface, cancellable, timeoutMs, callback) {
    _newProxyForBusAsync(
        Gio.BusType.SYSTEM,
        GEOCLUE_BUS_NAME,
        path,
        DBUS_PROPERTIES_IFACE,
        cancellable,
        (proxyError, propertiesProxy) => {
            if (proxyError) {
                callback(proxyError, null);
                return;
            }

            _callProxyAsync(
                propertiesProxy,
                'GetAll',
                new GLib.Variant('(s)', [iface]),
                cancellable,
                timeoutMs,
                (callError, result) => {
                    if (callError) {
                        callback(callError, null);
                        return;
                    }

                    callback(null, result.deep_unpack()[0]);
                }
            );
        }
    );
}

function _locationPathFromClientProperties(properties) {
    const locationPath = _variantValue(properties, 'Location');

    if (typeof locationPath !== 'string' || locationPath === '' || locationPath === '/')
        return null;

    return locationPath;
}

function _stopClient(clientProxy, timeoutMs) {
    if (!clientProxy)
        return;

    try {
        clientProxy.call(
            'Stop',
            null,
            Gio.DBusCallFlags.NONE,
            timeoutMs,
            null,
            null
        );
    } catch (error) {
        // Best-effort cleanup: applet removal must not fail because Stop failed.
    }
}

function _deleteClient(managerProxy, clientPath, timeoutMs) {
    if (!managerProxy || typeof clientPath !== 'string' || clientPath === '')
        return;

    try {
        managerProxy.call(
            'DeleteClient',
            new GLib.Variant('(o)', [clientPath]),
            Gio.DBusCallFlags.NONE,
            timeoutMs,
            null,
            null
        );
    } catch (error) {
        // Best-effort cleanup: stale GeoClue clients must not break teardown.
    }
}

function _readCachedCoordinates(cache) {
    return cache && typeof cache.readCoordinates === 'function'
        ? cache.readCoordinates()
        : null;
}

function _resultFromCache(envelope, isStale, error = null) {
    return {
        coordinates: envelope.data,
        updatedAt: envelope.savedAt,
        source: 'cache',
        isStale,
        error,
    };
}

function _resultFromGeoClue(coordinates) {
    return {
        coordinates,
        updatedAt: _nowMs(),
        source: 'geoclue',
        isStale: false,
        error: null,
    };
}

/**
 * Determine whether cached coordinates should be refreshed.
 *
 * @param {Object|null} envelope - Coordinate cache envelope.
 * @param {number} nowMs - Current time in milliseconds.
 * @param {number} maxAgeMs - Maximum coordinate cache age in milliseconds.
 * @returns {boolean} True when cache is missing, invalid, or too old.
 */
var shouldRefreshCachedCoordinates = function(
    envelope,
    nowMs = _nowMs(),
    maxAgeMs = LOCATION_REFRESH_INTERVAL_MS
) {
    if (!envelope || !Cache.isValidCoordinates(envelope.data))
        return true;

    if (!_isFiniteNumber(envelope.savedAt) || !_isFiniteNumber(nowMs))
        return true;

    return nowMs - envelope.savedAt >= maxAgeMs;
};

/**
 * Parse manual latitude/longitude settings into validated coordinates.
 *
 * @param {string|number} latitudeValue - Latitude setting.
 * @param {string|number} longitudeValue - Longitude setting.
 * @param {number} accuracy - Optional approximate accuracy in meters.
 * @returns {Object|null} Coordinates object or null when invalid.
 */
var coordinatesFromManualSettings = function(
    latitudeValue,
    longitudeValue,
    accuracy = DEFAULT_MANUAL_ACCURACY_METERS
) {
    const latitude = _parseCoordinate(latitudeValue, -90, 90);
    const longitude = _parseCoordinate(longitudeValue, -180, 180);

    if (latitude === null || longitude === null)
        return null;

    const parsedAccuracy = _isFiniteNumber(Number(accuracy))
        ? Math.max(0, Number(accuracy))
        : DEFAULT_MANUAL_ACCURACY_METERS;

    return {
        latitude,
        longitude,
        accuracy: parsedAccuracy,
    };
};

/**
 * Look up approximate coordinates through GeoClue2.
 *
 * This is a one-shot lookup. It requests city-level accuracy, waits for a
 * LocationUpdated signal, then stops the GeoClue client.
 *
 * @param {Object|Function} options - Lookup options or callback.
 * @param {Function} callback - Completion callback receiving (error, coordinates).
 * @returns {Object} Cancellable lookup handle.
 */
var lookupCoordinatesWithGeoClueAsync = function(options = {}, callback = null) {
    if (typeof options === 'function') {
        callback = options;
        options = {};
    }

    if (typeof callback !== 'function')
        throw new Error('lookupCoordinatesWithGeoClueAsync requires a callback');

    const cancellable = new Gio.Cancellable();
    const timeoutMs = _isFiniteNumber(options.timeoutMs)
        ? Math.max(1000, Math.floor(options.timeoutMs))
        : 15000;
    const desktopId = typeof options.desktopId === 'string' && options.desktopId !== ''
        ? options.desktopId
        : 'airaware';

    let completed = false;
    let managerProxy = null;
    let clientPath = null;
    let clientProxy = null;
    let signalId = 0;
    let timeoutId = 0;

    function cleanup() {
        if (timeoutId !== 0) {
            GLib.source_remove(timeoutId);
            timeoutId = 0;
        }

        if (clientProxy && signalId !== 0) {
            clientProxy.disconnect(signalId);
            signalId = 0;
        }

        _stopClient(clientProxy, timeoutMs);
        _deleteClient(managerProxy, clientPath, timeoutMs);
    }

    function finish(error, coordinates) {
        if (completed)
            return;

        completed = true;
        cleanup();
        callback(error, coordinates);
    }

    function readLocation(locationPath) {
        if (typeof locationPath !== 'string' || locationPath === '' || locationPath === '/')
            return;

        _getAllDbusPropertiesAsync(
            locationPath,
            GEOCLUE_LOCATION_IFACE,
            cancellable,
            timeoutMs,
            (error, properties) => {
                if (error) {
                    finish(error, null);
                    return;
                }

                try {
                    finish(null, _coordinatesFromLocationProperties(properties));
                } catch (parseError) {
                    finish(parseError, null);
                }
            }
        );
    }

    function readCurrentClientLocation() {
        _getAllDbusPropertiesAsync(
            clientPath,
            GEOCLUE_CLIENT_IFACE,
            cancellable,
            timeoutMs,
            (error, properties) => {
                if (error) {
                    finish(error, null);
                    return;
                }

                readLocation(_locationPathFromClientProperties(properties));
            }
        );
    }

    function startClient(clientPath) {
        _newProxyForBusAsync(
            Gio.BusType.SYSTEM,
            GEOCLUE_BUS_NAME,
            clientPath,
            GEOCLUE_CLIENT_IFACE,
            cancellable,
            (proxyError, proxy) => {
                if (proxyError) {
                    finish(proxyError, null);
                    return;
                }

                clientProxy = proxy;
                signalId = clientProxy.connect('g-signal',
                    (unusedProxy, unusedSender, signalName, parameters) => {
                        if (signalName !== 'LocationUpdated')
                            return;

                        const unpacked = parameters.deep_unpack();
                        readLocation(unpacked[1]);
                    });

                _setDbusPropertyAsync(
                    clientPath,
                    GEOCLUE_CLIENT_IFACE,
                    'DesktopId',
                    new GLib.Variant('s', desktopId),
                    cancellable,
                    timeoutMs,
                    setDesktopError => {
                        if (setDesktopError) {
                            finish(setDesktopError, null);
                            return;
                        }

                        _setDbusPropertyAsync(
                            clientPath,
                            GEOCLUE_CLIENT_IFACE,
                            'RequestedAccuracyLevel',
                            new GLib.Variant('u', APPROXIMATE_ACCURACY_LEVEL),
                            cancellable,
                            timeoutMs,
                            setAccuracyError => {
                                if (setAccuracyError) {
                                    finish(setAccuracyError, null);
                                    return;
                                }

                                _callProxyAsync(
                                    clientProxy,
                                    'Start',
                                    null,
                                    cancellable,
                                    timeoutMs,
                                    startError => {
                                        if (startError) {
                                            finish(startError, null);
                                            return;
                                        }

                                        readCurrentClientLocation();
                                    }
                                );
                            }
                        );
                    }
                );
            }
        );
    }

    timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, timeoutMs, () => {
        finish(new Error('GeoClue location request timed out'), null);
        return GLib.SOURCE_REMOVE;
    });

    _newProxyForBusAsync(
        Gio.BusType.SYSTEM,
        GEOCLUE_BUS_NAME,
        GEOCLUE_MANAGER_PATH,
        GEOCLUE_MANAGER_IFACE,
        cancellable,
        (managerError, managerProxyResult) => {
            if (managerError) {
                finish(managerError, null);
                return;
            }

            managerProxy = managerProxyResult;
            _callProxyAsync(
                managerProxyResult,
                'CreateClient',
                null,
                cancellable,
                timeoutMs,
                (clientError, result) => {
                    if (clientError) {
                        finish(clientError, null);
                        return;
                    }

                    clientPath = result.deep_unpack()[0];
                    startClient(clientPath);
                }
            );
        }
    );

    return {
        cancel() {
            cancellable.cancel();
            finish(new Error('GeoClue location request cancelled'), null);
        },
    };
};

/**
 * Create a one-shot location service with cache fallback.
 *
 * @param {Object} options - cache, lookupCoordinatesAsync, desktopId, maxCacheAgeMs.
 * @returns {Object} Location service API.
 */
var createLocationService = function(options = {}) {
    const cache = options.cache || Cache.createCache();
    const lookupCoordinatesAsync = options.lookupCoordinatesAsync ||
        lookupCoordinatesWithGeoClueAsync;
    const maxCacheAgeMs = _isFiniteNumber(options.maxCacheAgeMs)
        ? Math.max(0, options.maxCacheAgeMs)
        : LOCATION_REFRESH_INTERVAL_MS;
    let activeHandles = [];
    let destroyed = false;

    function removeHandle(handle) {
        activeHandles = activeHandles.filter(activeHandle => activeHandle !== handle);
    }

    function getLocationAsync(requestOptions = {}, callback = null) {
        if (typeof requestOptions === 'function') {
            callback = requestOptions;
            requestOptions = {};
        }

        if (typeof callback !== 'function')
            throw new Error('getLocationAsync requires a callback');

        if (destroyed) {
            callback(new Error('Location service has been destroyed'), null);
            return {
                cancel() {
                },
            };
        }

        const cached = _readCachedCoordinates(cache);
        const forceRefresh = requestOptions.forceRefresh === true;
        const nowMs = _isFiniteNumber(requestOptions.nowMs)
            ? requestOptions.nowMs
            : _nowMs();

        if (!forceRefresh && !shouldRefreshCachedCoordinates(cached, nowMs, maxCacheAgeMs)) {
            callback(null, _resultFromCache(cached, false));
            return {
                cancel() {
                },
            };
        }

        let cancelled = false;
        let lookupHandle = null;
        const handle = {
            cancel() {
                cancelled = true;

                if (lookupHandle && typeof lookupHandle.cancel === 'function')
                    lookupHandle.cancel();
            },
        };

        activeHandles.push(handle);

        function complete(error, coordinates) {
            removeHandle(handle);

            if (cancelled || destroyed)
                return;

            if (!error && Cache.isValidCoordinates(coordinates)) {
                cache.writeCoordinates(coordinates);
                callback(null, _resultFromGeoClue(coordinates));
                return;
            }

            if (cached) {
                callback(null, _resultFromCache(cached, true, error));
                return;
            }

            callback(error || new Error('No location available'), null);
        }

        try {
            lookupHandle = lookupCoordinatesAsync({
                desktopId: options.desktopId || 'airaware',
                timeoutMs: requestOptions.timeoutMs,
            }, complete);
        } catch (error) {
            complete(error, null);
        }

        return handle;
    }

    return {
        /**
         * Get cached coordinates or refresh them when absent/stale.
         *
         * @param {Object|Function} requestOptions - Lookup options or callback.
         * @param {Function} callback - Completion callback.
         * @returns {Object} Cancellable request handle.
         */
        getLocationAsync,

        /**
         * Force a GeoClue lookup while still falling back to cache on failure.
         *
         * @param {Object|Function} requestOptions - Lookup options or callback.
         * @param {Function} callback - Completion callback.
         * @returns {Object} Cancellable request handle.
         */
        refreshLocationAsync(requestOptions = {}, callback = null) {
            if (typeof requestOptions === 'function') {
                callback = requestOptions;
                requestOptions = {};
            }

            requestOptions.forceRefresh = true;
            return getLocationAsync(requestOptions, callback);
        },

        /**
         * Cancel outstanding location lookups during applet removal.
         */
        destroy() {
            destroyed = true;

            for (const handle of activeHandles.slice())
                handle.cancel();

            activeHandles = [];
        },
    };
};
