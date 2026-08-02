#!/usr/bin/env gjs
/* exported main */

imports.searchPath.unshift('lib');

const EnvironmentAssembler = imports.environmentAssembler;
const RiskCalculator = imports.riskCalculator;

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

function readings(overrides = {}) {
    let result = {
        treePollen: 20,
        grassPollen: 30,
        weedPollen: 10,
        pm25: 8,
        pm10: 18,
        nitrogenDioxide: 16,
        ozone: 50,
        sulfurDioxide: 10,
        dust: 3,
        aerosolOpticalDepth: 0.12,
        carbonMonoxide: 130,
    };

    for (const key in overrides)
        result[key] = overrides[key];

    return result;
}

function airQualityResponse(overrides = {}) {
    const fetchedAt = overrides.fetchedAt || 1785445000000;
    const currentReadings = overrides.currentReadings || readings();
    const latitude = Object.prototype.hasOwnProperty.call(overrides, 'latitude')
        ? overrides.latitude
        : 50.08;
    const longitude = Object.prototype.hasOwnProperty.call(overrides, 'longitude')
        ? overrides.longitude
        : 14.44;

    return {
        provider: 'open-meteo',
        latitude,
        longitude,
        fetchedAt,
        current: {
            readings: currentReadings,
        },
        forecast: [
            {
                date: '2026-07-30',
                readings: readings({
                    grassPollen: 35,
                }),
            },
            {
                date: '2026-07-31',
                readings: readings({
                    grassPollen: 55,
                }),
            },
        ],
        weather: overrides.weather || null,
        isPartial: false,
    };
}

function weatherHour(time, overrides = {}) {
    let values = {
        temperature: 22,
        relativeHumidity: 82,
        precipitation: 0.2,
        windSpeed: 1.5,
    };

    for (const key in overrides)
        values[key] = overrides[key];

    return {
        time,
        values,
    };
}

function weatherResponse(overrides = {}) {
    const latitude = Object.prototype.hasOwnProperty.call(overrides, 'latitude')
        ? overrides.latitude
        : 50.08;
    const longitude = Object.prototype.hasOwnProperty.call(overrides, 'longitude')
        ? overrides.longitude
        : 14.44;

    return {
        provider: 'open-meteo-weather',
        latitude,
        longitude,
        fetchedAt: overrides.fetchedAt || 1785447000000,
        hourly: [
            weatherHour('2026-07-30T00:00'),
            weatherHour('2026-07-30T01:00'),
            weatherHour('2026-07-31T00:00', {
                relativeHumidity: 70,
                precipitation: 0,
                windSpeed: 6,
            }),
        ],
    };
}

function vegetationResponse() {
    return {
        provider: 'openstreetmap',
        fetchedAt: '2026-07-31T21:00:00Z',
        coordinates: {
            latitude: 50.08,
            longitude: 14.44,
        },
        radiusMeters: 2000,
        cacheKey: '50.08,14.44,2000',
        categories: {
            woodland: {
                present: true,
                featureCount: 1,
                nearestMeters: 800,
            },
        },
        mappedTaxa: {
            birch: {
                featureCount: 2,
                nearestMeters: 250,
            },
        },
        completeness: 'unknown',
    };
}

function testWeatherFailureKeepsFreshAirQualityData() {
    const freshAirQuality = airQualityResponse({
        currentReadings: readings({
            pm25: 12,
        }),
    });
    const cached = airQualityResponse({
        currentReadings: readings({
            pm25: 80,
        }),
    });
    const combined = EnvironmentAssembler.combineEnvironmentalData({
        airQualityData: freshAirQuality,
        weatherData: null,
        cachedData: cached,
    });

    assertNotNull(combined, 'fresh air-quality data should still produce a response');
    assertEqual(combined.current.readings.pm25, 12,
        'weather failure should not fall back over fresh air-quality data');
    assertEqual(combined.weather, null,
        'missing weather should be represented as null');
    assertEqual(combined.weatherFetchedAt, null,
        'missing weather should not invent a weather timestamp');
    assertEqual(combined.current.moldPotential.isAvailable, false,
        'mold should be unavailable without weather data');
    assertTrue(combined.isPartial,
        'weather failure should mark combined response partial');
}

function testWeatherFailureCanUseCachedWeather() {
    const cached = airQualityResponse({
        weather: weatherResponse({
            fetchedAt: 1785441000000,
        }),
    });
    const freshAirQuality = airQualityResponse({
        fetchedAt: 1785449000000,
        currentReadings: readings({
            pm25: 12,
        }),
    });
    const combined = EnvironmentAssembler.combineEnvironmentalData({
        airQualityData: freshAirQuality,
        weatherData: null,
        cachedData: cached,
    });

    assertNotNull(combined,
        'fresh air quality and cached weather should combine');
    assertEqual(combined.current.readings.pm25, 12,
        'fresh air-quality data should be retained');
    assertEqual(combined.weatherFetchedAt, 1785441000000,
        'cached weather timestamp should be preserved independently');
    assertEqual(combined.current.moldPotential.isAvailable, true,
        'cached weather should still calculate mold potential');
    assertEqual(combined.usedCachedWeather, true,
        'cached weather use should be exposed for stale UI state');
    assertEqual(combined.usedCachedAirQuality, false,
        'fresh air quality should not be reported as cached');
    assertTrue(combined.isPartial,
        'cached weather fallback should mark the refresh partial');
}

function testAirQualityFailureUsesCachedDataWithFreshWeather() {
    const cached = airQualityResponse({
        fetchedAt: 1785440000000,
        currentReadings: readings({
            pm25: 44,
        }),
    });
    const weather = weatherResponse({
        fetchedAt: 1785449000000,
    });
    const combined = EnvironmentAssembler.combineEnvironmentalData({
        airQualityData: null,
        weatherData: weather,
        cachedData: cached,
        coordinates: {
            latitude: 50.08,
            longitude: 14.44,
        },
    });

    assertNotNull(combined, 'cached air quality and fresh weather should combine');
    assertEqual(combined.current.readings.pm25, 44,
        'cached air-quality readings should be retained');
    assertEqual(combined.current.moldPotential.isAvailable, true,
        'fresh weather should calculate mold potential');
    assertEqual(combined.airQualityFetchedAt, 1785440000000,
        'cached air-quality timestamp should be preserved');
    assertEqual(combined.weatherFetchedAt, 1785449000000,
        'fresh weather timestamp should be tracked separately');
    assertEqual(combined.fetchedAt, 1785440000000,
        'combined timestamp should reflect air-quality freshness');
    assertEqual(combined.usedCachedAirQuality, true,
        'cached air-quality use should be exposed for stale UI state');
    assertEqual(combined.usedCachedWeather, false,
        'fresh weather should not be reported as cached');
    assertTrue(combined.isPartial,
        'cached air quality with fresh weather is a partial refresh');
}

function testCachedAirQualityFromDifferentLocationIsRejected() {
    const cached = airQualityResponse({
        latitude: 40.71,
        longitude: -74.01,
        currentReadings: readings({
            pm25: 99,
        }),
    });
    const weather = weatherResponse({
        fetchedAt: 1785449000000,
    });
    const combined = EnvironmentAssembler.combineEnvironmentalData({
        airQualityData: null,
        weatherData: weather,
        cachedData: cached,
        coordinates: {
            latitude: 50.08,
            longitude: 14.44,
        },
    });

    assertEqual(combined, null,
        'cached air-quality data from another location should not be used');
}

function testCachedWeatherFromDifferentLocationIsRejected() {
    const cached = airQualityResponse({
        weather: weatherResponse({
            latitude: 40.71,
            longitude: -74.01,
            fetchedAt: 1785441000000,
        }),
    });
    const freshAirQuality = airQualityResponse({
        fetchedAt: 1785449000000,
        currentReadings: readings({
            pm25: 12,
        }),
    });
    const combined = EnvironmentAssembler.combineEnvironmentalData({
        airQualityData: freshAirQuality,
        weatherData: null,
        cachedData: cached,
        coordinates: {
            latitude: 50.08,
            longitude: 14.44,
        },
    });

    assertNotNull(combined,
        'fresh air quality should still produce a response');
    assertEqual(combined.weather, null,
        'cached weather from another location should not be attached');
    assertEqual(combined.usedCachedWeather, false,
        'rejected cached weather should not be reported as cached');
    assertEqual(combined.current.moldPotential.isAvailable, false,
        'mold should be unavailable when cached weather is rejected');
}

function testPartialSuccessRecalculatesRiskWithMold() {
    const combined = EnvironmentAssembler.combineEnvironmentalData({
        airQualityData: airQualityResponse(),
        weatherData: weatherResponse(),
        cachedData: null,
    });
    const risk = RiskCalculator.calculateRisk(
        combined.current,
        combined.current.moldPotential
    );

    assertEqual(risk.moldScore !== null, true,
        'mold score should be included when weather is sufficient');
    assertTrue(risk.effectiveWeights.mold > 0,
        'general risk should assign effective weight to mold');
    assertTrue(risk.score >= 0 && risk.score <= 100,
        'combined risk score should remain clamped');
}

function testForecastMoldUsesMatchingDayHours() {
    const combined = EnvironmentAssembler.combineEnvironmentalData({
        airQualityData: airQualityResponse(),
        weatherData: weatherResponse(),
        cachedData: null,
    });

    assertEqual(combined.forecast[0].moldPotential.isAvailable, true,
        'forecast day with matching weather hours should get mold potential');
    assertEqual(combined.forecast[1].moldPotential.isAvailable, true,
        'second forecast day should use its matching weather hours');
}

function testNoDataReturnsNull() {
    assertEqual(EnvironmentAssembler.combineEnvironmentalData({
        airQualityData: null,
        weatherData: weatherResponse(),
        cachedData: null,
    }), null, 'weather alone cannot replace missing air-quality readings');
}

function testMissingCurrentReturnsNull() {
    const malformed = airQualityResponse();

    delete malformed.current;

    assertEqual(EnvironmentAssembler.combineEnvironmentalData({
        airQualityData: malformed,
        weatherData: null,
        cachedData: null,
    }), null, 'air-quality data without current readings should not be combined');
}

function testMissingForecastFallsBackToEmptyForecast() {
    const partial = airQualityResponse();
    const combined = EnvironmentAssembler.combineEnvironmentalData({
        airQualityData: partial,
        weatherData: null,
        cachedData: null,
    });

    delete partial.forecast;

    const withoutForecast = EnvironmentAssembler.combineEnvironmentalData({
        airQualityData: partial,
        weatherData: null,
        cachedData: null,
    });

    assertNotNull(combined,
        'control air-quality response should combine');
    assertNotNull(withoutForecast,
        'missing forecast should not crash the assembler');
    assertEqual(withoutForecast.forecast.length, 0,
        'missing forecast should normalize to an empty forecast');
    assertEqual(withoutForecast.current.moldPotential.isAvailable, false,
        'current data should still get unavailable mold metadata');
}

function testVegetationAttachesWithoutChangingRisk() {
    const base = EnvironmentAssembler.combineEnvironmentalData({
        airQualityData: airQualityResponse(),
        weatherData: weatherResponse(),
        cachedData: null,
    });
    const withVegetation = EnvironmentAssembler.combineEnvironmentalData({
        airQualityData: airQualityResponse(),
        weatherData: weatherResponse(),
        cachedData: null,
        vegetationData: vegetationResponse(),
    });
    const baseRisk = RiskCalculator.calculateRisk(
        base.current,
        base.current.moldPotential
    );
    const vegetationRisk = RiskCalculator.calculateRisk(
        withVegetation.current,
        withVegetation.current.moldPotential
    );

    assertNotNull(withVegetation.vegetation,
        'vegetation data should be attached to the combined response');
    assertEqual(withVegetation.vegetationStatus, 'fresh',
        'fresh vegetation status should be exposed');
    assertEqual(vegetationRisk.score, baseRisk.score,
        'vegetation context should not affect the environmental risk score');
}

function testStaleVegetationFallbackIsIndependent() {
    const combined = EnvironmentAssembler.combineEnvironmentalData({
        airQualityData: airQualityResponse(),
        weatherData: weatherResponse(),
        cachedData: null,
        cachedVegetationData: vegetationResponse(),
        vegetationIsStale: true,
    });

    assertNotNull(combined.vegetation,
        'cached vegetation should remain available after provider failure');
    assertEqual(combined.vegetationStatus, 'stale',
        'stale vegetation status should be independent of main data freshness');
    assertEqual(combined.usedCachedAirQuality, false,
        'vegetation fallback should not mark air quality cached');
    assertEqual(combined.usedCachedWeather, false,
        'vegetation fallback should not mark weather cached');
}

function main() {
    const tests = [
        testWeatherFailureKeepsFreshAirQualityData,
        testWeatherFailureCanUseCachedWeather,
        testAirQualityFailureUsesCachedDataWithFreshWeather,
        testCachedAirQualityFromDifferentLocationIsRejected,
        testCachedWeatherFromDifferentLocationIsRejected,
        testPartialSuccessRecalculatesRiskWithMold,
        testForecastMoldUsesMatchingDayHours,
        testNoDataReturnsNull,
        testMissingCurrentReturnsNull,
        testMissingForecastFallsBackToEmptyForecast,
        testVegetationAttachesWithoutChangingRisk,
        testStaleVegetationFallbackIsIndependent,
    ];

    for (const test of tests)
        test();

    print(`environmentAssembler: ${tests.length} tests passed`);
}

main();
