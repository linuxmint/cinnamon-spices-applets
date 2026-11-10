#!/usr/bin/env gjs
/* exported main */

imports.searchPath.unshift('lib');

const OpenStreetMapVegetationProvider = imports.openStreetMapVegetationProvider;

function assertEqual(actual, expected, message) {
    if (actual !== expected)
        throw new Error(`${message}: expected ${expected}, got ${actual}`);
}

function assertTrue(condition, message) {
    if (!condition)
        throw new Error(message);
}

function assertThrows(fn, expectedMessagePart, message) {
    try {
        fn();
    } catch (error) {
        if (error.message.indexOf(expectedMessagePart) === -1)
            throw new Error(`${message}: expected "${expectedMessagePart}" in "${error.message}"`);

        return;
    }

    throw new Error(`${message}: expected exception`);
}

function coordinates() {
    return {
        latitude: 50,
        longitude: 14,
    };
}

function parse(elements, options = {}) {
    return OpenStreetMapVegetationProvider.parseOverpassResponse({
        elements,
    }, {
        coordinates: coordinates(),
        radiusMeters: options.radiusMeters || 2000,
        fetchedAt: '2026-07-31T21:00:00Z',
    });
}

function testBuildOverpassQuery() {
    const query = OpenStreetMapVegetationProvider.buildOverpassQuery(
        coordinates(),
        2000
    );
    const url = OpenStreetMapVegetationProvider.buildRequestUrl(coordinates(), {
        radiusMeters: 1000,
        baseUrl: 'https://example.test/interpreter',
    });

    assertTrue(query.indexOf('[out:json][timeout:20]') !== -1,
        'query should request JSON with timeout');
    assertTrue(query.indexOf('nwr(around:2000,50.000000,14.000000)') !== -1,
        'query should include validated radius and coordinates');
    assertTrue(query.indexOf('"natural"~"^(wood|tree|scrub|grassland)$"') !== -1,
        'query should include natural vegetation tags');
    assertTrue(query.indexOf('"landuse"~"^(forest|meadow|grass|orchard|farmland)$"') !== -1,
        'query should include landuse vegetation tags');
    assertTrue(query.indexOf('"leisure"="park"') !== -1,
        'query should include parkland');
    assertTrue(url.indexOf('https://example.test/interpreter?data=') === 0,
        'URL should use configurable endpoint');
    assertTrue(decodeURIComponent(url).indexOf('around:1000') !== -1,
        'URL should contain encoded Overpass query');
}

function testValidation() {
    assertThrows(() => {
        OpenStreetMapVegetationProvider.buildOverpassQuery({
            latitude: 91,
            longitude: 14,
        }, 2000);
    }, 'Invalid latitude', 'invalid latitude should be rejected');

    assertThrows(() => {
        OpenStreetMapVegetationProvider.buildOverpassQuery({
            latitude: 50,
            longitude: -181,
        }, 2000);
    }, 'Invalid longitude', 'invalid longitude should be rejected');

    assertThrows(() => {
        OpenStreetMapVegetationProvider.buildOverpassQuery(coordinates(), 10);
    }, 'Invalid vegetation search radius', 'invalid radius should be rejected');
}

function testCategoryAndTaxonMapping() {
    const result = parse([
        {
            type: 'node',
            id: 1,
            lat: 50.001,
            lon: 14,
            tags: {
                natural: 'grassland',
            },
        },
        {
            type: 'way',
            id: 2,
            center: {
                lat: 50.002,
                lon: 14,
            },
            tags: {
                leisure: 'park',
            },
        },
        {
            type: 'relation',
            id: 3,
            center: {
                lat: 50.003,
                lon: 14,
            },
            tags: {
                natural: 'wood',
                genus: 'Betula',
            },
        },
        {
            type: 'node',
            id: 4,
            lat: 50.004,
            lon: 14,
            tags: {
                landuse: 'orchard',
                species: 'Olea europaea',
            },
        },
        {
            type: 'node',
            id: 5,
            lat: 50.005,
            lon: 14,
            tags: {
                landuse: 'farmland',
                taxon: 'alnus glutinosa',
            },
        },
    ]);

    assertEqual(result.provider, 'openstreetmap', 'provider id should be normalized');
    assertEqual(result.categories.grassland.present, true,
        'natural grassland should map to grassland');
    assertEqual(result.categories.parkland.featureCount, 1,
        'leisure park should map to parkland');
    assertEqual(result.categories.woodland.featureCount, 1,
        'natural wood should map to woodland');
    assertEqual(result.categories.orchard.featureCount, 1,
        'landuse orchard should map to orchard');
    assertEqual(result.categories.farmland.featureCount, 1,
        'landuse farmland should map to farmland');
    assertEqual(result.mappedTaxa.birch.featureCount, 1,
        'Betula should map to birch');
    assertEqual(result.mappedTaxa.olive.featureCount, 1,
        'Olea species should map to olive');
    assertEqual(result.mappedTaxa.alder.featureCount, 1,
        'Alnus taxon should map to alder case-insensitively');
}

function testDistancesAndDeduplication() {
    const result = parse([
        {
            type: 'node',
            id: 1,
            lat: 50.001,
            lon: 14,
            tags: {
                natural: 'scrub',
            },
        },
        {
            type: 'node',
            id: 1,
            lat: 50.010,
            lon: 14,
            tags: {
                natural: 'scrub',
            },
        },
        {
            type: 'way',
            id: 2,
            tags: {
                landuse: 'meadow',
            },
        },
        {
            type: 'way',
            id: 3,
            center: {
                lat: 50.002,
                lon: 14,
            },
            tags: {
                landuse: 'meadow',
            },
        },
    ]);

    assertEqual(result.categories.scrub.featureCount, 1,
        'duplicate OSM elements should be counted once');
    assertTrue(result.categories.scrub.nearestMeters >= 100 &&
        result.categories.scrub.nearestMeters <= 120,
        'nearest direct-coordinate distance should use Haversine calculation');
    assertEqual(result.categories.grassland.featureCount, 1,
        'elements without coordinates should be ignored');
    assertTrue(result.categories.grassland.nearestMeters >= 220 &&
        result.categories.grassland.nearestMeters <= 225,
        'center coordinates should be used when direct coordinates are absent');
}

function testEmptyAndInvalidResponses() {
    const result = parse([]);

    assertEqual(result.categories.woodland.present, false,
        'empty valid response should distinguish no mapped feature found');
    assertEqual(result.categories.woodland.featureCount, 0,
        'empty category should have zero mapped feature count');
    assertEqual(result.categories.woodland.nearestMeters, null,
        'empty category should have no nearest distance');

    assertThrows(() => {
        OpenStreetMapVegetationProvider.parseOverpassResponse({}, {
            coordinates: coordinates(),
        });
    }, 'missing elements', 'missing elements should be invalid');

    assertThrows(() => {
        OpenStreetMapVegetationProvider.parseOverpassJson('{', {
            coordinates: coordinates(),
        });
    }, 'Invalid Overpass JSON', 'malformed JSON should be invalid');
}

function testCacheKeyAndFreshness() {
    const key = OpenStreetMapVegetationProvider.vegetationCacheKey({
        latitude: 50.0755,
        longitude: 14.4378,
    }, 2000);

    assertEqual(key, '50.08,14.44,2000',
        'cache key should use coarse rounded coordinates and radius');
    assertEqual(OpenStreetMapVegetationProvider.isVegetationCacheFresh({
        savedAt: 1000,
    }, 1000 + 13 * 24 * 60 * 60 * 1000), true,
    'cache should be fresh inside the 14-day window');
    assertEqual(OpenStreetMapVegetationProvider.isVegetationCacheFresh({
        savedAt: 1000,
    }, 1000 + 15 * 24 * 60 * 60 * 1000), false,
    'cache should expire after the 14-day window');
}

function main() {
    const tests = [
        testBuildOverpassQuery,
        testValidation,
        testCategoryAndTaxonMapping,
        testDistancesAndDeduplication,
        testEmptyAndInvalidResponses,
        testCacheKeyAndFreshness,
    ];

    for (const test of tests)
        test();

    print(`openStreetMapVegetationProvider: ${tests.length} tests passed`);
}

main();
