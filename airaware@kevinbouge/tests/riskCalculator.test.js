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

function assertNear(actual, expected, tolerance, message) {
    if (Math.abs(actual - expected) > tolerance)
        throw new Error(`${message}: expected ${expected}, got ${actual}`);
}

function completeMold(score = 15) {
    return {
        score,
        isAvailable: true,
        dataCompleteness: 1,
        missingComponents: [],
    };
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
        sulfurDioxide: 0,
        dust: 2,
        aerosolOpticalDepth: 0,
        carbonMonoxide: 100,
    }, completeMold(15));

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
        sulfurDioxide: 0,
        dust: 0,
        aerosolOpticalDepth: 0,
        carbonMonoxide: 0,
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
        sulfurDioxide: 0,
        dust: 0,
        aerosolOpticalDepth: 0,
        carbonMonoxide: 0,
    });

    assertEqual(result.components.pollen.dominant.field, 'treePollen',
        'single very high pollen source should dominate pollen burden');
    assertEqual(result.components.pollen.score, 95,
        'pollen group should use dominant category score, not average pollen types');
    assertEqual(result.score, 62,
        'combined score should renormalize when mold is unavailable');
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
        sulfurDioxide: 0,
        dust: 0,
        aerosolOpticalDepth: 0,
        carbonMonoxide: 0,
    }, completeMold(95));

    assertEqual(result.components.pollen.score, 45,
        'moderate pollen should contribute representative score 45');
    assertEqual(result.components.particulates.score, 72,
        'high particulates should contribute representative score 72');
    assertEqual(result.components.irritants.score, 33,
        'irritants should combine independently normalized variables');
    assertEqual(result.score, 58,
        'combined score should apply 50/25/10/15 weights');
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
        sulfurDioxide: 400,
        dust: 10,
        aerosolOpticalDepth: 0.8,
        carbonMonoxide: 5000,
    }, completeMold(95));

    assertEqual(result.category.id, 'very-high',
        'weighted burden should classify as very high');
}

function testMissingPollenStillCalculates() {
    const result = RiskCalculator.calculateRisk({
        pm25: 55,
        pm10: 80,
        nitrogenDioxide: 10,
        ozone: 10,
        sulfurDioxide: 0,
        dust: 10,
        aerosolOpticalDepth: 0,
        carbonMonoxide: 100,
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
        sulfurDioxide: 'bad',
        dust: -4,
        aerosolOpticalDepth: 'bad',
        carbonMonoxide: null,
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
    assertEqual(result.missingGroups.length, 4,
        'all top-level groups should be reported missing');
}

function testMoldReceivesConfiguredWeight() {
    const result = RiskCalculator.calculateRisk({
        treePollen: 0,
        grassPollen: 0,
        weedPollen: 0,
        pm25: 0,
        pm10: 0,
        nitrogenDioxide: 0,
        ozone: 0,
        sulfurDioxide: 0,
        dust: 0,
        aerosolOpticalDepth: 0,
        carbonMonoxide: 0,
    }, completeMold(95));

    assertNear(result.effectiveWeights.mold, 0.15, 0.001,
        'mold should receive 15% weight when available');
    assertEqual(result.moldScore, 95,
        'mold score should be exposed');
}

function testTopLevelWeightsTotalOne() {
    const result = RiskCalculator.calculateRisk({
        treePollen: 0,
        grassPollen: 0,
        weedPollen: 0,
        pm25: 0,
        pm10: 0,
        nitrogenDioxide: 0,
        ozone: 0,
        sulfurDioxide: 0,
        dust: 0,
        aerosolOpticalDepth: 0,
        carbonMonoxide: 0,
    }, completeMold(15));
    const total = result.effectiveWeights.pollen +
        result.effectiveWeights.particulates +
        result.effectiveWeights.irritants +
        result.effectiveWeights.mold;

    assertNear(total, 1, 0.001,
        'effective top-level weights should total 100%');
}

function testWeightsRenormalizeWhenMoldUnavailable() {
    const result = RiskCalculator.calculateRisk({
        treePollen: 0,
        grassPollen: 0,
        weedPollen: 0,
        pm25: 0,
        pm10: 0,
        nitrogenDioxide: 0,
        ozone: 0,
        sulfurDioxide: 0,
        dust: 0,
        aerosolOpticalDepth: 0,
        carbonMonoxide: 0,
    });

    assertEqual(result.moldScore, null,
        'missing mold should expose null mold score');
    assertNear(result.effectiveWeights.pollen, 0.5 / 0.85, 0.001,
        'pollen should be renormalized when mold is unavailable');
    assertNear(result.effectiveWeights.mold, 0, 0.001,
        'mold should have zero effective weight when unavailable');
}

function testAtmosphericVariablesAffectIrritantScore() {
    const low = RiskCalculator.calculateRisk({
        nitrogenDioxide: 0,
        ozone: 0,
        sulfurDioxide: 0,
        dust: 0,
        aerosolOpticalDepth: 0,
        carbonMonoxide: 0,
    });
    const high = RiskCalculator.calculateRisk({
        nitrogenDioxide: 0,
        ozone: 0,
        sulfurDioxide: 350,
        dust: 0,
        aerosolOpticalDepth: 0.6,
        carbonMonoxide: 4000,
    });

    assertTrue(high.irritantScore > low.irritantScore,
        'sulfur dioxide, aerosol optical depth, and carbon monoxide should affect irritant score');
}

function testDustContributesToIrritantScore() {
    const low = RiskCalculator.calculateRisk({
        nitrogenDioxide: 0,
        ozone: 0,
        sulfurDioxide: 0,
        dust: 0,
        aerosolOpticalDepth: 0,
        carbonMonoxide: 0,
    });
    const high = RiskCalculator.calculateRisk({
        nitrogenDioxide: 0,
        ozone: 0,
        sulfurDioxide: 0,
        dust: 100,
        aerosolOpticalDepth: 0,
        carbonMonoxide: 0,
    });

    assertTrue(high.irritantScore > low.irritantScore,
        'dust should contribute to irritant score');
    assertNear(high.components.irritants.effectiveWeights.dust, 0.13, 0.001,
        'dust should use the configured irritant weight when complete');
}

function testSulfurDioxideContributesToIrritantScore() {
    const low = RiskCalculator.calculateRisk({
        nitrogenDioxide: 0,
        ozone: 0,
        sulfurDioxide: 0,
        dust: 0,
        aerosolOpticalDepth: 0,
        carbonMonoxide: 0,
    });
    const high = RiskCalculator.calculateRisk({
        nitrogenDioxide: 0,
        ozone: 0,
        sulfurDioxide: 350,
        dust: 0,
        aerosolOpticalDepth: 0,
        carbonMonoxide: 0,
    });

    assertTrue(high.irritantScore > low.irritantScore,
        'sulfur dioxide should contribute to irritant score');
    assertNear(high.components.irritants.effectiveWeights.sulfurDioxide, 0.18, 0.001,
        'sulfur dioxide should use the configured irritant weight when complete');
}

function testMissingIrritantsRenormalize() {
    const result = RiskCalculator.calculateRisk({
        nitrogenDioxide: 200,
        ozone: null,
        sulfurDioxide: null,
        dust: null,
        aerosolOpticalDepth: null,
        carbonMonoxide: null,
    });

    assertEqual(result.irritantScore, 95,
        'single valid irritant should not be diluted by missing values');
    assertNear(result.components.irritants.effectiveWeights.nitrogenDioxide, 1, 0.001,
        'available irritant weight should be renormalized internally');
}

function testMissingIrritantsAreNotZero() {
    const missing = RiskCalculator.calculateRisk({
        nitrogenDioxide: 200,
    });
    const zero = RiskCalculator.calculateRisk({
        nitrogenDioxide: 200,
        ozone: 0,
        sulfurDioxide: 0,
        dust: 0,
        aerosolOpticalDepth: 0,
        carbonMonoxide: 0,
    });

    assertTrue(missing.irritantScore > zero.irritantScore,
        'missing irritants should be omitted, not treated as zero');
}

function testFinalScoreIsClamped() {
    const result = RiskCalculator.calculateRisk({
        treePollen: 9999,
        grassPollen: 9999,
        weedPollen: 9999,
        pm25: 9999,
        pm10: 9999,
        nitrogenDioxide: 9999,
        ozone: 9999,
        sulfurDioxide: 9999,
        dust: 9999,
        aerosolOpticalDepth: 9999,
        carbonMonoxide: 9999,
    }, completeMold(9999));

    assertTrue(result.score >= 0 && result.score <= 100,
        'final score should remain within 0 to 100');
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
        testMoldReceivesConfiguredWeight,
        testTopLevelWeightsTotalOne,
        testWeightsRenormalizeWhenMoldUnavailable,
        testAtmosphericVariablesAffectIrritantScore,
        testDustContributesToIrritantScore,
        testSulfurDioxideContributesToIrritantScore,
        testMissingIrritantsRenormalize,
        testMissingIrritantsAreNotZero,
        testFinalScoreIsClamped,
        testClassifyValueThresholdBoundaries,
    ];

    for (const test of tests)
        test();

    print(`riskCalculator: ${tests.length} tests passed`);
}

main();
