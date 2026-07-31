#!/usr/bin/env gjs
/* exported main */

imports.searchPath.unshift('lib');

const ByteArray = imports.byteArray;
const Gio = imports.gi.Gio;
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

function runAsync(operation) {
    const loop = new GLib.MainLoop(null, false);
    let error = null;
    let value = null;

    operation((operationError, operationValue) => {
        error = operationError;
        value = operationValue;
        loop.quit();
    });

    loop.run();

    if (error)
        throw error;

    return value;
}

function readCoordinates(cache) {
    return runAsync(done => cache.readCoordinatesAsync(done));
}

function writeCoordinates(cache, coordinates) {
    return runAsync(done => cache.writeCoordinatesAsync(coordinates, done));
}

function readPlace(cache) {
    return runAsync(done => cache.readPlaceAsync(done));
}

function writePlace(cache, place) {
    return runAsync(done => cache.writePlaceAsync(place, done));
}

function readResponse(cache) {
    return runAsync(done => cache.readResponseAsync(done));
}

function writeResponse(cache, response) {
    return runAsync(done => cache.writeResponseAsync(response, done));
}

function writeRawJsonFile(path, text) {
    return runAsync(done => {
        const bytes = new GLib.Bytes(ByteArray.fromString(text));

        Gio.File.new_for_path(path).replace_contents_bytes_async(
            bytes,
            null,
            false,
            Gio.FileCreateFlags.REPLACE_DESTINATION,
            null,
            (source, result) => {
                try {
                    source.replace_contents_finish(result);
                    done(null, true);
                } catch (error) {
                    done(error, null);
                }
            }
        );
    });
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
    const readings = {
        treePollen: 1,
        grassPollen: 2,
        weedPollen: 3,
        pm25: 4,
        pm10: 5,
        nitrogenDioxide: 6,
        ozone: 7,
        sulfurDioxide: 9,
        dust: 8,
        aerosolOpticalDepth: 0.12,
        carbonMonoxide: 150,
        wildfirePm10: 1.2,
    };
    const rawPollutants = {
        pm25: 4,
        pm10: 5,
        nitrogenDioxide: 6,
        ozone: 7,
        sulfurDioxide: 9,
        carbonMonoxide: 150,
    };
    const pollutantAqi = {
        pm25: 11,
        pm10: 12,
        nitrogenDioxide: 13,
        ozone: 14,
        sulfurDioxide: 15,
    };
    const usPollutantAqi = {
        pm25: 21,
        pm10: 22,
        nitrogenDioxide: 23,
        ozone: 24,
        sulfurDioxide: 25,
    };
    const pollen = {
        alder: 1,
        birch: 2,
        grass: 2,
        mugwort: 3,
        olive: 1,
        ragweed: 2,
    };
    const context = {
        aerosolOpticalDepth: 0.12,
        dust: 8,
        wildfirePm10: 1.2,
    };

    return {
        provider: 'open-meteo',
        fetchedAt: 1785445000000,
        current: {
            readings,
            rawPollutants,
            pollutantAqi,
            europeanPollutantAqi: pollutantAqi,
            usPollutantAqi,
            pollutantAqiSource: 'european-aqi',
            pollutantAqiLabel: 'EU AQI',
            pollen,
            context,
            moldPotential: {
                score: 45,
                category: {
                    id: 'moderate',
                },
                isAvailable: true,
                dataCompleteness: 1,
                components: {},
                effectiveWeights: {},
                missingComponents: [],
                explanationKey: 'mold-relativeHumidity',
            },
        },
        forecast: [
            {
                date: '2026-07-30',
                readings,
                rawPollutants,
                pollutantAqi,
                europeanPollutantAqi: pollutantAqi,
                usPollutantAqi,
                pollutantAqiSource: 'european-aqi',
                pollutantAqiLabel: 'EU AQI',
                pollen,
                context,
                moldPotential: null,
            },
        ],
        weather: {
            provider: 'open-meteo-weather',
            fetchedAt: 1785446000000,
            hourly: [
                {
                    time: '2026-07-30T12:00',
                    values: {
                        temperature: 20,
                        relativeHumidity: 75,
                        precipitation: 0,
                        windSpeed: 2,
                    },
                },
            ],
        },
        airQualityFetchedAt: 1785445000000,
        weatherFetchedAt: 1785446000000,
    };
}

function testCoordinateRoundTrip() {
    const directory = tempCacheDirectory('coordinates');

    try {
        const cache = Cache.createCache({
            baseDirectory: directory,
        });
        const result = writeCoordinates(cache, {
            latitude: 50.08,
            longitude: 14.44,
        });
        const envelope = readCoordinates(cache);

        assertEqual(result.ok, true, 'valid coordinate write should succeed');
        assertNotNull(envelope, 'coordinates should read back');
        assertEqual(envelope.version, 1,
            'coordinate cache schema should remain stable');
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

        writeCoordinates(cache, {
            latitude: 50.08,
            longitude: 14.44,
        });

        const result = writeCoordinates(cache, {
            latitude: 200,
            longitude: 14.44,
        });
        const envelope = readCoordinates(cache);

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
        const result = writeResponse(cache, providerResponse());
        const envelope = readResponse(cache);

        assertEqual(result.ok, true, 'valid response write should succeed');
        assertNotNull(envelope, 'response should read back');
        assertEqual(envelope.data.provider, 'open-meteo',
            'provider id should round trip');
        assertEqual(envelope.data.current.readings.pm10, 5,
            'response readings should round trip');
        assertEqual(envelope.data.current.readings.sulfurDioxide, 9,
            'sulfur dioxide should round trip');
        assertEqual(envelope.data.weatherFetchedAt, 1785446000000,
            'weather timestamp should round trip independently');
        assertEqual(envelope.data.current.usPollutantAqi.ozone, 24,
            'US pollutant AQI should round trip');
        assertEqual(envelope.data.current.pollutantAqiSource, 'european-aqi',
            'selected AQI source should round trip');
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
        const result = writePlace(cache, {
            provider: 'nominatim',
            name: 'Prague, Czechia',
            coordinates: {
                latitude: 50.08,
                longitude: 14.44,
            },
            fetchedAt: 1785445000000,
        });
        const envelope = readPlace(cache);

        assertEqual(result.ok, true, 'valid place write should succeed');
        assertNotNull(envelope, 'place should read back');
        assertEqual(envelope.data.name, 'Prague, Czechia',
            'place name should round trip');
        assertEqual(envelope.version, 1,
            'place cache schema should remain stable');
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
        writePlace(cache, {
            provider: 'nominatim',
            name: 'Prague, Czechia',
            coordinates: {
                latitude: 50.08,
                longitude: 14.44,
            },
            fetchedAt: 1785445000000,
        });

        const result = writePlace(cache, {
            provider: 'nominatim',
            name: '',
            coordinates: {
                latitude: 50.08,
                longitude: 14.44,
            },
            fetchedAt: 1785445000000,
        });
        const envelope = readPlace(cache);

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
        writeResponse(cache, providerResponse());

        const result = writeResponse(cache, {
            provider: 'open-meteo',
            current: null,
        });
        const envelope = readResponse(cache);

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
        writeResponse(cache, providerResponse());

        const result = writeResponse(cache, {
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
                    sulfurDioxide: null,
                    dust: null,
                    aerosolOpticalDepth: null,
                    carbonMonoxide: null,
                    wildfirePm10: null,
                },
            },
            forecast: [],
        });
        const envelope = readResponse(cache);

        assertEqual(result.ok, false,
            'response without any numeric readings should fail');
        assertEqual(envelope.data.current.readings.pm10, 5,
            'previous valid response should remain cached');
    } finally {
        removeDirectory(directory);
    }
}

function testPreviousResponseCacheVersionMigrates() {
    const directory = tempCacheDirectory('previous-response-version');

    try {
        const cache = Cache.createCache({
            baseDirectory: directory,
        });
        const filePath = GLib.build_filenamev([
            directory,
            'response.json',
        ]);

        writeRawJsonFile(
            filePath,
            JSON.stringify({
                version: 1,
                savedAt: 1785445000000,
                data: providerResponse(),
            })
        );
        const envelope = readResponse(cache);

        assertNotNull(envelope,
            'previous response cache versions should migrate when data is usable');
        assertEqual(envelope.version, 5,
            'migrated response cache should expose the current schema version');
        assertEqual(envelope.migratedFromVersion, 1,
            'migrated response cache should expose the source schema version');
        assertEqual(envelope.data.current.readings.pm10, 5,
            'migrated response cache should preserve readings');
        assertEqual(envelope.data.current.europeanPollutantAqi.pm10, 12,
            'migrated response cache should preserve European AQI values');
        assertEqual(envelope.data.current.usPollutantAqi.pm10, 22,
            'migrated response cache should preserve US AQI values when present');
    } finally {
        removeDirectory(directory);
    }
}

function testPreviousFlatResponseCacheVersionMigrates() {
    const directory = tempCacheDirectory('previous-flat-response-version');

    try {
        const cache = Cache.createCache({
            baseDirectory: directory,
        });
        const filePath = GLib.build_filenamev([
            directory,
            'response.json',
        ]);

        writeRawJsonFile(
            filePath,
            JSON.stringify({
                version: 1,
                savedAt: 1785445000000,
                data: {
                    provider: 'open-meteo',
                    fetchedAt: 1785445000000,
                    current: {
                        readings: {
                            treePollen: 4,
                            grassPollen: 3,
                            weedPollen: 2,
                            pm25: 6,
                            pm10: 8,
                            nitrogenDioxide: 10,
                            ozone: 12,
                            dust: 1,
                        },
                    },
                    forecast: [
                        {
                            date: '2026-07-30',
                            readings: {
                                grassPollen: 3,
                                pm10: 8,
                            },
                        },
                    ],
                },
            })
        );
        const envelope = readResponse(cache);

        assertNotNull(envelope,
            'previous flat response cache should migrate when it has usable readings');
        assertEqual(envelope.data.current.rawPollutants.pm10, 8,
            'migrated flat response should populate raw pollutant fields');
        assertEqual(envelope.data.current.pollutantAqi.pm10, null,
            'missing AQI values should migrate as null');
        assertEqual(envelope.data.current.europeanPollutantAqi.pm10, null,
            'missing European AQI values should migrate as null');
        assertEqual(envelope.data.current.usPollutantAqi.pm10, null,
            'missing US AQI values should migrate as null');
        assertEqual(envelope.data.current.pollutantAqiSource, 'european-aqi',
            'flat migrated response should default to European AQI source');
        assertEqual(envelope.data.current.pollen.grass, 3,
            'migrated flat response should preserve grass pollen when available');
        assertEqual(envelope.data.current.context.dust, 1,
            'migrated flat response should populate context fields');
        assertEqual(envelope.data.weather, null,
            'missing weather data should migrate as null');
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
        writeResponse(cache, providerResponse());

        const result = writeResponse(cache, {
            provider: 'open-meteo',
            fetchedAt: 1785445000000,
            current: {
                readings: {
                    pm10: 5,
                },
            },
            forecast: [],
        });
        const envelope = readResponse(cache);

        assertEqual(result.ok, false,
            'response missing canonical fields should fail');
        assertEqual(envelope.data.current.readings.pm10, 5,
            'previous canonical response should remain cached');
    } finally {
        removeDirectory(directory);
    }
}

function testResponseWithoutStructuredCurrentFieldsIsInvalid() {
    const directory = tempCacheDirectory('missing-current-structured-fields');

    try {
        const cache = Cache.createCache({
            baseDirectory: directory,
        });
        const valid = providerResponse();
        const invalid = providerResponse();

        delete invalid.current.pollutantAqi;
        writeResponse(cache, valid);

        const result = writeResponse(cache, invalid);
        const envelope = readResponse(cache);

        assertEqual(result.ok, false,
            'response missing structured current fields should fail');
        assertEqual(envelope.data.current.pollutantAqi.pm25, 11,
            'previous structured current data should remain cached');
    } finally {
        removeDirectory(directory);
    }
}

function testResponseWithMalformedStructuredCurrentValueIsInvalid() {
    const directory = tempCacheDirectory('bad-current-structured-value');

    try {
        const cache = Cache.createCache({
            baseDirectory: directory,
        });
        const valid = providerResponse();
        const invalid = providerResponse();

        invalid.current.pollen.grass = 'bad';
        writeResponse(cache, valid);

        const result = writeResponse(cache, invalid);
        const envelope = readResponse(cache);

        assertEqual(result.ok, false,
            'response with malformed structured current values should fail');
        assertEqual(envelope.data.current.pollen.grass, 2,
            'previous structured current values should remain cached');
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

        writeRawJsonFile(
            filePath,
            '{"version":1,"savedAt":1,"data":{"latitude":"bad"}}',
        );

        assertEqual(readCoordinates(cache), null,
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

        writeRawJsonFile(
            filePath,
            '{"version":1,"savedAt":1,"data":',
        );

        assertEqual(readResponse(cache), null,
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

        writeRawJsonFile(
            filePath,
            JSON.stringify({
                version: 999,
                savedAt: 1,
                data: providerResponse(),
            })
        );

        assertEqual(readResponse(cache), null,
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
        testResponseWithoutStructuredCurrentFieldsIsInvalid,
        testResponseWithMalformedStructuredCurrentValueIsInvalid,
        testPreviousResponseCacheVersionMigrates,
        testPreviousFlatResponseCacheVersionMigrates,
        testInvalidCoordinateCacheFileReturnsNull,
        testMalformedResponseCacheFileReturnsNull,
        testWrongEnvelopeVersionReturnsNull,
    ];

    for (const test of tests)
        test();

    print(`cache: ${tests.length} tests passed`);
}

main();
