#!/usr/bin/env gjs
/* exported main */

imports.searchPath.unshift('lib');

const RiskCalculator = imports.riskCalculator;

function assertEqual(actual, expected, message) {
    if (actual !== expected)
        throw new Error(`${message}: expected ${expected}, got ${actual}`);
}

function assertTrue(condition, message) {
    if (!condition)
        throw new Error(message);
}

function testLowRisk() {
    const result = RiskCalculator.calculateRisk({
        treePollen: 0,
        grassPollen: 1,
        weedPollen: 2,
        pm25: 3,
        pm10: 5,
        nitrogenDioxide: 10,
        ozone: 20,
        dust: 2,
    });

    assertEqual(result.category.id, 'low', 'low readings should classify as low');
    assertEqual(result.isPartial, false, 'complete readings should not be partial');
}

function testHighestPollenDominates() {
    const result = RiskCalculator.calculateRisk({
        treePollen: 0,
        grassPollen: 100,
        weedPollen: 0,
        pm25: 0,
        pm10: 0,
        nitrogenDioxide: 0,
        ozone: 0,
        dust: 0,
    });

    assertEqual(
        result.components.pollen.dominant.field,
        'grassPollen',
        'highest pollen category should dominate pollen burden'
    );
    assertEqual(result.components.pollen.dominant.category.id, 'very-high',
        'grass threshold should classify as very high');
}

function testPollenTypesAreNotAveraged() {
    const result = RiskCalculator.calculateRisk({
        treePollen: 200,
        grassPollen: 0,
        weedPollen: 0,
        pm25: 0,
        pm10: 0,
        nitrogenDioxide: 0,
        ozone: 0,
        dust: 0,
    });

    assertEqual(result.components.pollen.dominant.field, 'treePollen',
        'single very high pollen source should dominate pollen burden');
    assertEqual(result.components.pollen.score, 95,
        'pollen group should use dominant category score, not average pollen types');
    assertEqual(result.score, 63,
        'combined score should apply 60% pollen, 30% particulates, 10% gases/dust');
    assertEqual(result.category.id, 'high',
        'single very high pollen burden should remain visible in combined category');
}

function testExactWeighting() {
    const result = RiskCalculator.calculateRisk({
        treePollen: 30,
        grassPollen: 0,
        weedPollen: 0,
        pm25: 25,
        pm10: 0,
        nitrogenDioxide: 0,
        ozone: 180,
        dust: 0,
    });

    assertEqual(result.components.pollen.score, 45,
        'moderate pollen should contribute representative score 45');
    assertEqual(result.components.particulates.score, 72,
        'high particulates should contribute representative score 72');
    assertEqual(result.components.gasesAndDust.score, 95,
        'very high gas/dust burden should contribute representative score 95');
    assertEqual(result.score, 58,
        'combined score should round 45*0.6 + 72*0.3 + 95*0.1');
    assertEqual(result.category.id, 'high',
        'weighted score should classify from final combined score');
}

function testVeryHighCombinedRisk() {
    const result = RiskCalculator.calculateRisk({
        treePollen: 200,
        grassPollen: 5,
        weedPollen: 5,
        pm25: 30,
        pm10: 10,
        nitrogenDioxide: 20,
        ozone: 70,
        dust: 10,
    });

    assertEqual(result.category.id, 'very-high',
        'weighted burden should classify as very high');
}

function testMissingPollenStillCalculates() {
    const result = RiskCalculator.calculateRisk({
        pm25: 55,
        pm10: 80,
        nitrogenDioxide: 10,
        ozone: 10,
        dust: 10,
    });

    assertTrue(result.isPartial, 'missing pollen should mark response partial');
    assertEqual(result.missingGroups.indexOf('pollen') >= 0, true,
        'pollen group should be marked missing');
    assertEqual(result.category.id, 'high',
        'available pollutant groups should still produce a usable category');
}

function testMalformedValuesAreMissing() {
    const result = RiskCalculator.calculateRisk({
        treePollen: 'bad',
        grassPollen: null,
        weedPollen: undefined,
        pm25: NaN,
        pm10: 15,
        nitrogenDioxide: Infinity,
        ozone: 0,
        dust: -4,
    });

    assertTrue(result.isPartial, 'malformed readings should mark response partial');
    assertEqual(result.components.particulates.dominant.field, 'pm10',
        'valid particulate value should still be used');
}

function testNoUsableReadingsReturnsLowPartialRisk() {
    const result = RiskCalculator.calculateRisk({});

    assertEqual(result.score, 0,
        'missing all groups should return zero score');
    assertEqual(result.category.id, 'low',
        'missing all groups should classify as low environmental burden');
    assertEqual(result.isPartial, true,
        'missing all groups should be marked partial');
    assertEqual(result.missingGroups.length, 3,
        'all groups should be reported missing');
}

function testClassifyValueThresholdBoundaries() {
    assertEqual(RiskCalculator.classifyValue(29.9, {
        moderate: 30,
        high: 100,
        veryHigh: 200,
    }).category.id, 'low', 'value below moderate threshold should be low');

    assertEqual(RiskCalculator.classifyValue(30, {
        moderate: 30,
        high: 100,
        veryHigh: 200,
    }).category.id, 'moderate', 'moderate threshold should be inclusive');

    assertEqual(RiskCalculator.classifyValue(100, {
        moderate: 30,
        high: 100,
        veryHigh: 200,
    }).category.id, 'high', 'high threshold should be inclusive');

    assertEqual(RiskCalculator.classifyValue(200, {
        moderate: 30,
        high: 100,
        veryHigh: 200,
    }).category.id, 'very-high', 'very high threshold should be inclusive');
}

function main() {
    const tests = [
        testLowRisk,
        testHighestPollenDominates,
        testPollenTypesAreNotAveraged,
        testExactWeighting,
        testVeryHighCombinedRisk,
        testMissingPollenStillCalculates,
        testMalformedValuesAreMissing,
        testNoUsableReadingsReturnsLowPartialRisk,
        testClassifyValueThresholdBoundaries,
    ];

    for (const test of tests)
        test();

    print(`riskCalculator: ${tests.length} tests passed`);
}

main();
