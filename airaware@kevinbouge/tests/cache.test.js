#!/usr/bin/env gjs
/* exported main */

imports.searchPath.unshift('lib');

const GLib = imports.gi.GLib;

const Cache = imports.cache;

function assertEqual(actual, expected, message) {
    if (actual !== expected)
        throw new Error(`${message}: expected ${expected}, got ${actual}`);
}

function assertTrue(condition, message) {
    if (!condition)
        throw new Error(message);
}

function assertNotNull(value, message) {
    if (value === null || value === undefined)
        throw new Error(message);
}

function tempCacheDirectory(name) {
    return GLib.build_filenamev([
        GLib.get_tmp_dir(),
        `airaware-cache-test-${name}-${GLib.uuid_string_random()}`,
    ]);
}

function removeDirectory(path) {
    let directory = null;

    try {
        directory = GLib.Dir.open(path, 0);
    } catch (error) {
        try {
            GLib.unlink(path);
        } catch (unlinkError) {
        }

        return;
    }

    let name = null;

    while ((name = directory.read_name()) !== null)
        removeDirectory(GLib.build_filenamev([path, name]));

    GLib.rmdir(path);
}

function providerResponse() {
    return {
        provider: 'open-meteo',
        fetchedAt: 1785445000000,
        current: {
            readings: {
                treePollen: 1,
                grassPollen: 2,
                weedPollen: 3,
                pm25: 4,
                pm10: 5,
                nitrogenDioxide: 6,
                ozone: 7,
                dust: 8,
            },
        },
        forecast: [
            {
                date: '2026-07-30',
                readings: {
                    treePollen: 1,
                    grassPollen: 2,
                    weedPollen: 3,
                    pm25: 4,
                    pm10: 5,
                    nitrogenDioxide: 6,
                    ozone: 7,
                    dust: 8,
                },
            },
        ],
    };
}

function testCoordinateRoundTrip() {
    const directory = tempCacheDirectory('coordinates');

    try {
        const cache = Cache.createCache({
            baseDirectory: directory,
        });
        const result = cache.writeCoordinates({
            latitude: 50.08,
            longitude: 14.44,
        });
        const envelope = cache.readCoordinates();

        assertEqual(result.ok, true, 'valid coordinate write should succeed');
        assertNotNull(envelope, 'coordinates should read back');
        assertEqual(envelope.data.latitude, 50.08,
            'latitude should round trip');
        assertEqual(envelope.data.longitude, 14.44,
            'longitude should round trip');
    } finally {
        removeDirectory(directory);
    }
}

function testInvalidCoordinatesDoNotReplaceCache() {
    const directory = tempCacheDirectory('invalid-coordinates');

    try {
        const cache = Cache.createCache({
            baseDirectory: directory,
        });

        cache.writeCoordinates({
            latitude: 50.08,
            longitude: 14.44,
        });

        const result = cache.writeCoordinates({
            latitude: 200,
            longitude: 14.44,
        });
        const envelope = cache.readCoordinates();

        assertEqual(result.ok, false, 'invalid coordinate write should fail');
        assertEqual(envelope.data.latitude, 50.08,
            'valid coordinate cache should remain unchanged');
    } finally {
        removeDirectory(directory);
    }
}

function testResponseRoundTrip() {
    const directory = tempCacheDirectory('response');

    try {
        const cache = Cache.createCache({
            baseDirectory: directory,
        });
        const result = cache.writeResponse(providerResponse());
        const envelope = cache.readResponse();

        assertEqual(result.ok, true, 'valid response write should succeed');
        assertNotNull(envelope, 'response should read back');
        assertEqual(envelope.data.provider, 'open-meteo',
            'provider id should round trip');
        assertEqual(envelope.data.current.readings.pm10, 5,
            'response readings should round trip');
    } finally {
        removeDirectory(directory);
    }
}

function testPlaceRoundTrip() {
    const directory = tempCacheDirectory('place');

    try {
        const cache = Cache.createCache({
            baseDirectory: directory,
        });
        const result = cache.writePlace({
            provider: 'nominatim',
            name: 'Prague, Czechia',
            coordinates: {
                latitude: 50.08,
                longitude: 14.44,
            },
            fetchedAt: 1785445000000,
        });
        const envelope = cache.readPlace();

        assertEqual(result.ok, true, 'valid place write should succeed');
        assertNotNull(envelope, 'place should read back');
        assertEqual(envelope.data.name, 'Prague, Czechia',
            'place name should round trip');
    } finally {
        removeDirectory(directory);
    }
}

function testInvalidPlaceDoesNotReplaceCache() {
    const directory = tempCacheDirectory('invalid-place');

    try {
        const cache = Cache.createCache({
            baseDirectory: directory,
        });
        cache.writePlace({
            provider: 'nominatim',
            name: 'Prague, Czechia',
            coordinates: {
                latitude: 50.08,
                longitude: 14.44,
            },
            fetchedAt: 1785445000000,
        });

        const result = cache.writePlace({
            provider: 'nominatim',
            name: '',
            coordinates: {
                latitude: 50.08,
                longitude: 14.44,
            },
            fetchedAt: 1785445000000,
        });
        const envelope = cache.readPlace();

        assertEqual(result.ok, false, 'invalid place write should fail');
        assertEqual(envelope.data.name, 'Prague, Czechia',
            'valid place cache should remain unchanged');
    } finally {
        removeDirectory(directory);
    }
}

function testInvalidResponseDoesNotReplaceCache() {
    const directory = tempCacheDirectory('invalid-response');

    try {
        const cache = Cache.createCache({
            baseDirectory: directory,
        });
        cache.writeResponse(providerResponse());

        const result = cache.writeResponse({
            provider: 'open-meteo',
            current: null,
        });
        const envelope = cache.readResponse();

        assertEqual(result.ok, false, 'invalid response write should fail');
        assertEqual(envelope.data.current.readings.pm25, 4,
            'valid response cache should remain unchanged');
    } finally {
        removeDirectory(directory);
    }
}

function testResponseWithoutReadingsIsInvalid() {
    const directory = tempCacheDirectory('empty-response');

    try {
        const cache = Cache.createCache({
            baseDirectory: directory,
        });
        cache.writeResponse(providerResponse());

        const result = cache.writeResponse({
            provider: 'open-meteo',
            fetchedAt: 1785445000000,
            current: {
                readings: {
                    treePollen: null,
                    grassPollen: null,
                    weedPollen: null,
                    pm25: null,
                    pm10: null,
                    nitrogenDioxide: null,
                    ozone: null,
                    dust: null,
                },
            },
            forecast: [],
        });
        const envelope = cache.readResponse();

        assertEqual(result.ok, false,
            'response without any numeric readings should fail');
        assertEqual(envelope.data.current.readings.pm10, 5,
            'previous valid response should remain cached');
    } finally {
        removeDirectory(directory);
    }
}

function testResponseWithoutCanonicalFieldsIsInvalid() {
    const directory = tempCacheDirectory('noncanonical-response');

    try {
        const cache = Cache.createCache({
            baseDirectory: directory,
        });
        cache.writeResponse(providerResponse());

        const result = cache.writeResponse({
            provider: 'open-meteo',
            fetchedAt: 1785445000000,
            current: {
                readings: {
                    pm10: 5,
                },
            },
            forecast: [],
        });
        const envelope = cache.readResponse();

        assertEqual(result.ok, false,
            'response missing canonical fields should fail');
        assertEqual(envelope.data.current.readings.pm10, 5,
            'previous canonical response should remain cached');
    } finally {
        removeDirectory(directory);
    }
}

function testInvalidCoordinateCacheFileReturnsNull() {
    const directory = tempCacheDirectory('bad-coordinate-file');

    try {
        const cache = Cache.createCache({
            baseDirectory: directory,
        });
        const filePath = GLib.build_filenamev([
            directory,
            'coordinates.json',
        ]);

        GLib.file_set_contents(
            filePath,
            '{"version":1,"savedAt":1,"data":{"latitude":"bad"}}',
        );

        assertEqual(cache.readCoordinates(), null,
            'invalid cache contents should read as null');
    } finally {
        removeDirectory(directory);
    }
}

function testMalformedResponseCacheFileReturnsNull() {
    const directory = tempCacheDirectory('malformed-response-file');

    try {
        const cache = Cache.createCache({
            baseDirectory: directory,
        });
        const filePath = GLib.build_filenamev([
            directory,
            'response.json',
        ]);

        GLib.file_set_contents(
            filePath,
            '{"version":1,"savedAt":1,"data":',
        );

        assertEqual(cache.readResponse(), null,
            'malformed response cache should read as null');
    } finally {
        removeDirectory(directory);
    }
}

function testWrongEnvelopeVersionReturnsNull() {
    const directory = tempCacheDirectory('wrong-version');

    try {
        const cache = Cache.createCache({
            baseDirectory: directory,
        });
        const filePath = GLib.build_filenamev([
            directory,
            'response.json',
        ]);

        GLib.file_set_contents(
            filePath,
            JSON.stringify({
                version: 999,
                savedAt: 1,
                data: providerResponse(),
            })
        );

        assertEqual(cache.readResponse(), null,
            'wrong cache envelope version should read as null');
    } finally {
        removeDirectory(directory);
    }
}

function main() {
    const tests = [
        testCoordinateRoundTrip,
        testInvalidCoordinatesDoNotReplaceCache,
        testResponseRoundTrip,
        testPlaceRoundTrip,
        testInvalidPlaceDoesNotReplaceCache,
        testInvalidResponseDoesNotReplaceCache,
        testResponseWithoutReadingsIsInvalid,
        testResponseWithoutCanonicalFieldsIsInvalid,
        testInvalidCoordinateCacheFileReturnsNull,
        testMalformedResponseCacheFileReturnsNull,
        testWrongEnvelopeVersionReturnsNull,
    ];

    for (const test of tests)
        test();

    print(`cache: ${tests.length} tests passed`);
}

main();
