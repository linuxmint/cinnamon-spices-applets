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

    return {
        provider: 'open-meteo',
        latitude: 50.08,
        longitude: 14.44,
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
    return {
        provider: 'open-meteo-weather',
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
    assertEqual(combined.fetchedAt, 1785449000000,
        'combined timestamp should reflect newest valid component');
    assertTrue(combined.isPartial,
        'cached air quality with fresh weather is a partial refresh');
}

function testPartialSuccessRecalculatesRiskWithMold() {
    const combined = EnvironmentAssembler.combineEnvironmentalData({
        airQualityData: airQualityResponse(),
        weatherData: weatherResponse(),
        cachedData: null,
    });
    const risk = RiskCalculator.calculateRisk(
        combined.current.readings,
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

function main() {
    const tests = [
        testWeatherFailureKeepsFreshAirQualityData,
        testAirQualityFailureUsesCachedDataWithFreshWeather,
        testPartialSuccessRecalculatesRiskWithMold,
        testForecastMoldUsesMatchingDayHours,
        testNoDataReturnsNull,
    ];

    for (const test of tests)
        test();

    print(`environmentAssembler: ${tests.length} tests passed`);
}

main();
