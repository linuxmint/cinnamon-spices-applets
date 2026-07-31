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

function mold(score = 15) {
    return {
        score,
        isAvailable: true,
        completeness: 1,
    };
}

function current(overrides = {}) {
    const result = {
        pollen: {
            alder: 0,
            birch: 0,
            grass: 0,
            mugwort: 0,
            olive: 0,
            ragweed: 0,
        },
        rawPollutants: {
            pm25: 4,
            pm10: 8,
            nitrogenDioxide: 5,
            ozone: 20,
            sulfurDioxide: 2,
            carbonMonoxide: 120,
        },
        pollutantAqi: {
            pm25: 10,
            pm10: 12,
            nitrogenDioxide: 8,
            ozone: 16,
            sulfurDioxide: 3,
        },
        context: {
            aerosolOpticalDepth: 0,
            dust: 0,
            wildfirePm10: null,
        },
    };

    for (const key in overrides)
        result[key] = overrides[key];

    return result;
}

function testSixPollenTypesUseHighestBurden() {
    const result = RiskCalculator.calculatePollenScore({
        pollen: {
            alder: 0,
            birch: 250,
            grass: 0,
            mugwort: 0,
            olive: 0,
            ragweed: 0,
        },
    });

    assertEqual(result.score, 95,
        'highest pollen type should determine pollen score');
    assertEqual(result.dominantType, 'birch',
        'dominant pollen type should be returned');
    assertEqual(result.availableTypes.length, 6,
        'available pollen types should be reported');
}

function testUnavailablePollenTypesAreIgnored() {
    const result = RiskCalculator.calculatePollenScore({
        pollen: {
            alder: null,
            birch: null,
            grass: 60,
            mugwort: null,
            olive: null,
            ragweed: null,
        },
    });

    assertEqual(result.dominantType, 'grass',
        'available pollen should be used when other pollen types are missing');
    assertEqual(result.score, 72,
        'available high pollen should not be diluted by missing values');
}

function testAllUnavailablePollenIsUnavailable() {
    const result = RiskCalculator.calculatePollenScore({
        pollen: {
            alder: null,
            birch: null,
            grass: null,
            mugwort: null,
            olive: null,
            ragweed: null,
        },
    });

    assertEqual(result.score, null,
        'pollen result should be unavailable with no pollen data');
}

function testRegulatedPollutionUsesMaximumEuropeanAqi() {
    const result = RiskCalculator.calculateRegulatedPollutionScore({
        pollutantAqi: {
            pm25: 18,
            pm10: 21,
            nitrogenDioxide: 12,
            ozone: 68,
            sulfurDioxide: 8,
        },
        rawPollutants: {
            pm25: 999,
            pm10: 999,
            nitrogenDioxide: 999,
            ozone: 999,
            sulfurDioxide: 999,
        },
    });

    assertEqual(result.score, 68,
        'maximum pollutant-specific European AQI should determine pollution score');
    assertEqual(result.dominantPollutant, 'ozone',
        'dominant pollutant should be returned');
    assertEqual(result.source, 'european-aqi',
        'AQI scoring source should be exposed');
}

function testRegulatedPollutionIgnoresMissingAqi() {
    const result = RiskCalculator.calculateRegulatedPollutionScore({
        pollutantAqi: {
            pm25: null,
            pm10: null,
            nitrogenDioxide: 41,
            ozone: null,
            sulfurDioxide: null,
        },
    });

    assertEqual(result.score, 41,
        'single available pollutant AQI should be used');
    assertEqual(result.dominantPollutant, 'nitrogenDioxide',
        'single available AQI should be dominant');
}

function testRegulatedPollutionFallsBackToRawConcentration() {
    const result = RiskCalculator.calculateRegulatedPollutionScore({
        pollutantAqi: {
            pm25: null,
            pm10: null,
            nitrogenDioxide: null,
            ozone: null,
            sulfurDioxide: null,
        },
        rawPollutants: {
            pm25: 30,
            pm10: 10,
            nitrogenDioxide: 10,
            ozone: 10,
            sulfurDioxide: 0,
        },
    });

    assertEqual(result.source, 'raw-concentration-fallback',
        'missing pollutant AQIs should use raw-concentration fallback');
    assertEqual(result.dominantPollutant, 'pm25',
        'fallback should expose dominant raw pollutant');
    assertTrue(result.completeness < 1,
        'fallback should reduce completeness');
}

function testNoInvalidAqiRawMixing() {
    const result = RiskCalculator.calculateRegulatedPollutionScore({
        pollutantAqi: {
            pm25: 22,
            pm10: null,
            nitrogenDioxide: null,
            ozone: null,
            sulfurDioxide: null,
        },
        rawPollutants: {
            ozone: 999,
        },
    });

    assertEqual(result.score, 22,
        'available AQI should not be mixed with unrelated raw concentration values');
    assertEqual(result.source, 'european-aqi',
        'partial AQI data should still use AQI source only');
}

function testAtmosphericContextContributions() {
    const low = RiskCalculator.calculateAtmosphericIrritantsScore({
        rawPollutants: {
            carbonMonoxide: 0,
        },
        context: {
            aerosolOpticalDepth: 0,
            dust: 0,
            wildfirePm10: 0,
        },
    });
    const high = RiskCalculator.calculateAtmosphericIrritantsScore({
        rawPollutants: {
            carbonMonoxide: 4000,
        },
        context: {
            aerosolOpticalDepth: 0.6,
            dust: 100,
            wildfirePm10: 50,
        },
    });

    assertTrue(high.score > low.score,
        'context values should contribute to atmospheric irritants');
    assertNear(high.effectiveWeights.carbonMonoxide, 0.35, 0.001,
        'carbon monoxide should use configured context weight');
    assertEqual(high.wildfirePm10Available, true,
        'wildfire-related PM10 availability should be exposed');
}

function testAtmosphericContextRenormalizesMissingFields() {
    const result = RiskCalculator.calculateAtmosphericIrritantsScore({
        rawPollutants: {
            carbonMonoxide: 4000,
        },
        context: {
            aerosolOpticalDepth: null,
            dust: null,
            wildfirePm10: null,
        },
    });

    assertEqual(result.score, 95,
        'single available context field should not be diluted by missing values');
    assertNear(result.effectiveWeights.carbonMonoxide, 1, 0.001,
        'available context field should be renormalized');
    assertEqual(result.wildfirePm10Available, false,
        'missing wildfire PM10 should not be treated as available');
}

function testTopLevelWeights() {
    const result = RiskCalculator.calculateRisk(current(), mold(15));
    const total = result.effectiveWeights.pollen +
        result.effectiveWeights.regulatedPollution +
        result.effectiveWeights.atmosphericIrritants +
        result.effectiveWeights.mold;

    assertNear(total, 1, 0.001,
        'effective top-level weights should sum to 100%');
    assertNear(result.effectiveWeights.pollen, 0.5, 0.001,
        'pollen should receive 50%');
    assertNear(result.effectiveWeights.regulatedPollution, 0.25, 0.001,
        'regulated pollution should receive 25%');
    assertNear(result.effectiveWeights.atmosphericIrritants, 0.1, 0.001,
        'atmospheric irritants should receive 10%');
    assertNear(result.effectiveWeights.mold, 0.15, 0.001,
        'mold should receive 15%');
}

function testUnavailableComponentsRenormalize() {
    const result = RiskCalculator.calculateRisk({
        pollen: {
            alder: 200,
        },
        pollutantAqi: {},
        rawPollutants: {},
        context: {},
    }, null);

    assertEqual(result.score, 95,
        'single available top-level component should not be diluted');
    assertNear(result.effectiveWeights.pollen, 1, 0.001,
        'available top-level component should be renormalized');
    assertTrue(result.missingGroups.indexOf('mold') !== -1,
        'missing mold should be reported');
}

function testDominantComponentAndClamping() {
    const result = RiskCalculator.calculateRisk(current({
        pollen: {
            alder: 0,
            birch: 0,
            grass: 0,
            mugwort: 0,
            olive: 0,
            ragweed: 0,
        },
        pollutantAqi: {
            pm25: 120,
            pm10: 20,
            nitrogenDioxide: 20,
            ozone: 20,
            sulfurDioxide: 20,
        },
    }), mold(10));

    assertTrue(result.score >= 0 && result.score <= 100,
        'overall score should remain within 0 to 100');
    assertEqual(result.dominantComponent.name, 'regulatedPollution',
        'dominant top-level component should be exposed');
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
        testSixPollenTypesUseHighestBurden,
        testUnavailablePollenTypesAreIgnored,
        testAllUnavailablePollenIsUnavailable,
        testRegulatedPollutionUsesMaximumEuropeanAqi,
        testRegulatedPollutionIgnoresMissingAqi,
        testRegulatedPollutionFallsBackToRawConcentration,
        testNoInvalidAqiRawMixing,
        testAtmosphericContextContributions,
        testAtmosphericContextRenormalizesMissingFields,
        testTopLevelWeights,
        testUnavailableComponentsRenormalize,
        testDominantComponentAndClamping,
        testClassifyValueThresholdBoundaries,
    ];

    for (const test of tests)
        test();

    print(`riskCalculator: ${tests.length} tests passed`);
}

main();
