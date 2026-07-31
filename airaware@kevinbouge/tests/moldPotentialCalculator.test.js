#!/usr/bin/env gjs
/* exported main */

imports.searchPath.unshift('lib');

const MoldPotentialCalculator = imports.moldPotentialCalculator;

function assertEqual(actual, expected, message) {
    if (actual !== expected)
        throw new Error(`${message}: expected ${expected}, got ${actual}`);
}

function assertTrue(condition, message) {
    if (!condition)
        throw new Error(message);
}

function assertNear(actual, expected, tolerance, message) {
    if (Math.abs(actual - expected) > tolerance)
        throw new Error(`${message}: expected ${expected}, got ${actual}`);
}

function hour(relativeHumidity, precipitation, temperature, windSpeed) {
    return {
        time: '2026-07-30T12:00',
        values: {
            relativeHumidity,
            precipitation,
            temperature,
            windSpeed,
        },
    };
}

function repeatedHours(count, values) {
    let hours = [];

    for (let index = 0; index < count; index++) {
        hours.push({
            time: `2026-07-30T${String(index % 24).padStart(2, '0')}:00`,
            values,
        });
    }

    return hours;
}

function testDryLowHumidityProducesLow() {
    const result = MoldPotentialCalculator.calculateMoldPotential([
        hour(42, 0, 18, 8),
    ]);

    assertEqual(result.category.id, 'low',
        'dry low-humidity conditions should produce low mold potential');
}

function testHighHumidityRaisesScore() {
    const dry = MoldPotentialCalculator.calculateMoldPotential([
        hour(45, 0, 18, 8),
    ]);
    const humid = MoldPotentialCalculator.calculateMoldPotential([
        hour(88, 0, 18, 8),
    ]);

    assertTrue(humid.score > dry.score,
        'sustained high humidity should raise the score');
}

function testRecentPrecipitationRaisesScore() {
    const dry = MoldPotentialCalculator.calculateMoldPotential([
        hour(75, 0, 18, 8),
    ]);
    const wet = MoldPotentialCalculator.calculateMoldPotential(
        repeatedHours(24, {
            relativeHumidity: 75,
            precipitation: 0.5,
            temperature: 18,
            windSpeed: 8,
        })
    );

    assertTrue(wet.score > dry.score,
        'recent precipitation should raise the score');
}

function testSuitableTemperatureRaisesScore() {
    const cold = MoldPotentialCalculator.calculateMoldPotential([
        hour(75, 0, 4, 8),
    ]);
    const suitable = MoldPotentialCalculator.calculateMoldPotential([
        hour(75, 0, 20, 8),
    ]);

    assertTrue(suitable.components.temperature > cold.components.temperature,
        'suitable temperature should raise the temperature component');
}

function testExtremeTemperaturesReduceScore() {
    const suitable = MoldPotentialCalculator.calculateMoldPotential([
        hour(75, 0, 20, 8),
    ]);
    const cold = MoldPotentialCalculator.calculateMoldPotential([
        hour(75, 0, 2, 8),
    ]);
    const hot = MoldPotentialCalculator.calculateMoldPotential([
        hour(75, 0, 42, 8),
    ]);

    assertTrue(cold.score < suitable.score,
        'very low temperature should reduce score');
    assertTrue(hot.score < suitable.score,
        'very high temperature should reduce score');
}

function testLowWindRaisesPersistence() {
    const lowWind = MoldPotentialCalculator.calculateMoldPotential([
        hour(75, 0, 20, 1),
    ]);
    const moderateWind = MoldPotentialCalculator.calculateMoldPotential([
        hour(75, 0, 20, 7),
    ]);

    assertTrue(lowWind.components.wind > moderateWind.components.wind,
        'low wind should raise persistence component');
}

function testStrongWindLowersPersistence() {
    const moderateWind = MoldPotentialCalculator.calculateMoldPotential([
        hour(75, 0, 20, 7),
    ]);
    const strongWind = MoldPotentialCalculator.calculateMoldPotential([
        hour(75, 0, 20, 12),
    ]);

    assertTrue(strongWind.components.wind < moderateWind.components.wind,
        'strong wind should lower persistence component');
}

function testMissingHumidityReturnsUnavailable() {
    const result = MoldPotentialCalculator.calculateMoldPotential([
        hour(null, 3, 20, 1),
    ]);

    assertEqual(result.isAvailable, false,
        'missing humidity should make mold potential unavailable');
    assertEqual(result.score, null,
        'unavailable mold potential should not have a score');
    assertTrue(result.missingComponents.indexOf('relativeHumidity') !== -1,
        'missing humidity should be tracked');
}

function testMissingOptionalComponentsRenormalizeWeights() {
    const result = MoldPotentialCalculator.calculateMoldPotential([
        hour(80, null, 20, null),
    ]);

    assertEqual(result.isAvailable, true,
        'humidity plus one optional component should remain available');
    assertNear(result.effectiveWeights.relativeHumidity, 2 / 3, 0.001,
        'humidity weight should be renormalized');
    assertNear(result.effectiveWeights.temperature, 1 / 3, 0.001,
        'temperature weight should be renormalized');
    assertEqual(result.effectiveWeights.precipitation, 0,
        'missing precipitation should have zero effective weight');
    assertEqual(result.effectiveWeights.wind, 0,
        'missing wind should have zero effective weight');
}

function testMissingDataIsNotZero() {
    const missingPrecipitation = MoldPotentialCalculator.calculateMoldPotential([
        hour(80, null, 20, 1),
    ]);
    const zeroPrecipitation = MoldPotentialCalculator.calculateMoldPotential([
        hour(80, 0, 20, 1),
    ]);

    assertTrue(missingPrecipitation.score > zeroPrecipitation.score,
        'missing precipitation should be omitted, not treated as zero');
}

function testScoreIsClamped() {
    const result = MoldPotentialCalculator.calculateMoldPotential([
        hour(500, 999, 20, 0),
    ]);

    assertTrue(result.score >= 0 && result.score <= 100,
        'score should remain within 0 to 100');
}

function testDataCompleteness() {
    const result = MoldPotentialCalculator.calculateMoldPotential([
        hour(80, null, 20, null),
    ]);

    assertNear(result.dataCompleteness, 0.6, 0.001,
        'data completeness should equal available source weight');
}

function main() {
    const tests = [
        testDryLowHumidityProducesLow,
        testHighHumidityRaisesScore,
        testRecentPrecipitationRaisesScore,
        testSuitableTemperatureRaisesScore,
        testExtremeTemperaturesReduceScore,
        testLowWindRaisesPersistence,
        testStrongWindLowersPersistence,
        testMissingHumidityReturnsUnavailable,
        testMissingOptionalComponentsRenormalizeWeights,
        testMissingDataIsNotZero,
        testScoreIsClamped,
        testDataCompleteness,
    ];

    for (const test of tests)
        test();

    print(`moldPotentialCalculator: ${tests.length} tests passed`);
}

main();
