#!/usr/bin/env gjs
/* exported main */

imports.searchPath.unshift('lib');

const GLib = imports.gi.GLib;

const LocationService = imports.locationService;

function assertEqual(actual, expected, message) {
    if (actual !== expected)
        throw new Error(`${message}: expected ${expected}, got ${actual}`);
}

function assertTrue(condition, message) {
    if (!condition)
        throw new Error(message);
}

function makeMemoryCache(envelope = null) {
    return {
        writes: [],
        readCoordinatesAsync(callback) {
            GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
                callback(null, envelope);
                return GLib.SOURCE_REMOVE;
            });
        },
        writeCoordinatesAsync(coordinates, callback = null) {
            envelope = {
                version: 1,
                savedAt: 1000,
                data: coordinates,
            };
            this.writes.push(coordinates);
            const result = {
                ok: true,
                value: envelope,
            };

            if (typeof callback === 'function') {
                GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
                    callback(null, result);
                    return GLib.SOURCE_REMOVE;
                });
            }

            return {
                cancel() {
                },
            };
        },
    };
}

function asyncLookup(resultCoordinates, resultError = null, calls = null) {
    return function(options, callback) {
        if (calls)
            calls.count++;

        let cancelled = false;
        const sourceId = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            if (!cancelled)
                callback(resultError, resultCoordinates);

            return GLib.SOURCE_REMOVE;
        });

        return {
            cancel() {
                cancelled = true;
                GLib.source_remove(sourceId);
            },
        };
    };
}

function runAsync(testBody) {
    const loop = new GLib.MainLoop(null, false);

    testBody(() => {
        loop.quit();
    });

    loop.run();
}

function testFreshCacheAvoidsGeoClue() {
    runAsync(done => {
        const calls = {
            count: 0,
        };
        const cache = makeMemoryCache({
            version: 1,
            savedAt: 1000,
            data: {
                latitude: 50,
                longitude: 14,
            },
        });
        const service = LocationService.createLocationService({
            cache,
            maxCacheAgeMs: 60000,
            lookupCoordinatesAsync: asyncLookup({
                latitude: 1,
                longitude: 2,
            }, null, calls),
        });

        service.getLocationAsync({
            nowMs: 2000,
        }, (error, result) => {
            assertEqual(error, null, 'fresh cache should not error');
            assertEqual(result.source, 'cache', 'fresh cache should be used');
            assertEqual(result.isStale, false, 'fresh cache should not be stale');
            assertEqual(result.coordinates.latitude, 50,
                'fresh cache coordinates should be returned');
            assertEqual(calls.count, 0, 'GeoClue lookup should not be called');
            done();
        });
    });
}

function testStaleCacheRefreshesAndWrites() {
    runAsync(done => {
        const cache = makeMemoryCache({
            version: 1,
            savedAt: 0,
            data: {
                latitude: 50,
                longitude: 14,
            },
        });
        const service = LocationService.createLocationService({
            cache,
            maxCacheAgeMs: 1000,
            lookupCoordinatesAsync: asyncLookup({
                latitude: 51,
                longitude: 15,
                accuracy: 5000,
            }),
        });

        service.getLocationAsync({
            nowMs: 5000,
        }, (error, result) => {
            assertEqual(error, null, 'successful refresh should not error');
            assertEqual(result.source, 'geoclue', 'fresh GeoClue result should be used');
            assertEqual(result.coordinates.latitude, 51,
                'GeoClue coordinates should be returned');
            assertEqual(cache.writes.length, 1,
                'fresh coordinates should be cached');
            done();
        });
    });
}

function testGeoClueFailureFallsBackToStaleCache() {
    runAsync(done => {
        const cache = makeMemoryCache({
            version: 1,
            savedAt: 0,
            data: {
                latitude: 50,
                longitude: 14,
            },
        });
        const service = LocationService.createLocationService({
            cache,
            maxCacheAgeMs: 1000,
            lookupCoordinatesAsync: asyncLookup(null, new Error('GeoClue unavailable')),
        });

        service.getLocationAsync({
            nowMs: 5000,
        }, (error, result) => {
            assertEqual(error, null, 'cache fallback should not surface fatal error');
            assertEqual(result.source, 'cache', 'stale cache should be used');
            assertEqual(result.isStale, true, 'fallback cache should be marked stale');
            assertTrue(result.error.message.indexOf('GeoClue unavailable') !== -1,
                'original lookup error should be retained');
            done();
        });
    });
}

function testLookupSetupFailureFallsBackToStaleCache() {
    runAsync(done => {
        const cache = makeMemoryCache({
            version: 1,
            savedAt: 0,
            data: {
                latitude: 50,
                longitude: 14,
            },
        });
        const service = LocationService.createLocationService({
            cache,
            maxCacheAgeMs: 1000,
            lookupCoordinatesAsync() {
                throw new Error('GeoClue setup failed');
            },
        });

        service.getLocationAsync({
            nowMs: 5000,
        }, (error, result) => {
            assertEqual(error, null,
                'setup failure should fall back to stale cache');
            assertEqual(result.source, 'cache',
                'stale cache should be returned after setup failure');
            assertEqual(result.isStale, true,
                'fallback cache should be marked stale');
            assertTrue(result.error.message.indexOf('GeoClue setup failed') !== -1,
                'setup failure should be retained for logging');
            done();
        });
    });
}

function testLookupSetupFailureWithoutCacheErrors() {
    runAsync(done => {
        const service = LocationService.createLocationService({
            cache: makeMemoryCache(null),
            lookupCoordinatesAsync() {
                throw new Error('GeoClue setup failed');
            },
        });

        service.getLocationAsync((error, result) => {
            assertTrue(error.message.indexOf('GeoClue setup failed') !== -1,
                'setup failure should be surfaced without cache');
            assertEqual(result, null,
                'setup failure without cache should not return result');
            done();
        });
    });
}

function testGeoClueFailureWithoutCacheErrors() {
    runAsync(done => {
        const service = LocationService.createLocationService({
            cache: makeMemoryCache(null),
            lookupCoordinatesAsync: asyncLookup(null, new Error('GeoClue unavailable')),
        });

        service.getLocationAsync((error, result) => {
            assertTrue(error.message.indexOf('GeoClue unavailable') !== -1,
                'missing cache should surface lookup failure');
            assertEqual(result, null, 'missing cache should not return result');
            done();
        });
    });
}

function testRefreshForcesGeoClue() {
    runAsync(done => {
        const calls = {
            count: 0,
        };
        const cache = makeMemoryCache({
            version: 1,
            savedAt: 1000,
            data: {
                latitude: 50,
                longitude: 14,
            },
        });
        const service = LocationService.createLocationService({
            cache,
            maxCacheAgeMs: 60000,
            lookupCoordinatesAsync: asyncLookup({
                latitude: 52,
                longitude: 16,
            }, null, calls),
        });

        service.refreshLocationAsync({
            nowMs: 2000,
        }, (error, result) => {
            assertEqual(error, null, 'manual refresh should not error');
            assertEqual(calls.count, 1, 'manual refresh should force lookup');
            assertEqual(result.coordinates.latitude, 52,
                'manual refresh should return lookup coordinates');
            done();
        });
    });
}

function testShouldRefreshCachedCoordinates() {
    assertEqual(LocationService.shouldRefreshCachedCoordinates(null, 10, 5), true,
        'missing cache should refresh');
    assertEqual(LocationService.shouldRefreshCachedCoordinates({
        savedAt: 0,
        data: {
            latitude: 50,
            longitude: 14,
        },
    }, 4, 5), false, 'fresh cache should not refresh');
    assertEqual(LocationService.shouldRefreshCachedCoordinates({
        savedAt: 0,
        data: {
            latitude: 50,
            longitude: 14,
        },
    }, 5, 5), true, 'expired cache should refresh');
}

function testManualCoordinatesParseValidSettings() {
    const coordinates = LocationService.coordinatesFromManualSettings(
        '50.0755',
        '14,4378'
    );

    assertEqual(coordinates.latitude, 50.0755,
        'manual latitude should parse decimal strings');
    assertEqual(coordinates.longitude, 14.4378,
        'manual longitude should accept decimal comma input');
    assertEqual(coordinates.accuracy, 10000,
        'manual coordinates should use approximate default accuracy');
}

function testManualCoordinatesRejectInvalidSettings() {
    assertEqual(LocationService.coordinatesFromManualSettings('', '14'), null,
        'empty manual latitude should be invalid');
    assertEqual(LocationService.coordinatesFromManualSettings('91', '14'), null,
        'manual latitude outside range should be invalid');
    assertEqual(LocationService.coordinatesFromManualSettings('50', '181'), null,
        'manual longitude outside range should be invalid');
    assertEqual(LocationService.coordinatesFromManualSettings('bad', '14'), null,
        'non-numeric manual latitude should be invalid');
}

function main() {
    const tests = [
        testFreshCacheAvoidsGeoClue,
        testStaleCacheRefreshesAndWrites,
        testGeoClueFailureFallsBackToStaleCache,
        testLookupSetupFailureFallsBackToStaleCache,
        testLookupSetupFailureWithoutCacheErrors,
        testGeoClueFailureWithoutCacheErrors,
        testRefreshForcesGeoClue,
        testShouldRefreshCachedCoordinates,
        testManualCoordinatesParseValidSettings,
        testManualCoordinatesRejectInvalidSettings,
    ];

    for (const test of tests)
        test();

    print(`locationService: ${tests.length} tests passed`);
}

main();
