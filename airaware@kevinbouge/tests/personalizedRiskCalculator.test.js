#!/usr/bin/env gjs
/* exported main */

imports.searchPath.unshift('lib');

const Profile = imports.personalAllergyProfile;
const PersonalizedRiskCalculator = imports.personalizedRiskCalculator;
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

function profileWithFactors(ids, enabled = true) {
    let enabledFactors = {};

    for (const id of Profile.FACTOR_IDS)
        enabledFactors[id] = false;

    for (const id of ids)
        enabledFactors[id] = true;

    return Profile.normalizeProfile({
        enabled,
        enabledFactors,
    });
}

function environmentalData(overrides = {}) {
    const data = {
        pollen: {
            alder: 35,
            birch: 120,
            grass: 60,
            mugwort: 55,
            olive: 35,
            ragweed: 55,
        },
        rawPollutants: {
            pm25: 8,
            pm10: 18,
            nitrogenDioxide: 12,
            ozone: 70,
            sulfurDioxide: 8,
            carbonMonoxide: 120,
        },
        pollutantAqi: {
            pm25: 30,
            pm10: 40,
            nitrogenDioxide: 20,
            ozone: 65,
            sulfurDioxide: 10,
        },
        pollutantAqiSource: 'us-aqi',
        pollutantAqiLabel: 'US AQI',
        context: {
            aerosolOpticalDepth: 0.1,
            dust: 55,
            wildfirePm10: 30,
        },
        uvIndex: 8,
    };

    for (const key in overrides)
        data[key] = overrides[key];

    return data;
}

function mold(score = 50, available = true) {
    return {
        score: available ? score : null,
        isAvailable: available,
        completeness: available ? 1 : 0,
    };
}

function calculate(ids, data = environmentalData(), moldPotential = mold()) {
    return PersonalizedRiskCalculator.calculatePersonalizedRisk(
        data,
        moldPotential,
        profileWithFactors(ids)
    );
}

function testPersonalizationDisabled() {
    const result = PersonalizedRiskCalculator.calculatePersonalizedRisk(
        environmentalData(),
        mold(),
        profileWithFactors(['pollen_grass'], false)
    );

    assertEqual(result.available, false,
        'disabled personalization should not calculate a personalized score');
    assertEqual(result.reason, 'personalization_disabled',
        'disabled reason should be explicit');
}

function testOneAvailableSelectedFactor() {
    const result = calculate(['pollen_grass']);

    assertEqual(result.available, true,
        'one available selected factor should calculate');
    assertEqual(result.score, 72,
        'selected grass burden should be reused from pollen thresholds');
    assertEqual(result.category.id, 'high',
        'personalized category should use AirAware risk categories');
}

function testMultipleFactorsUseSelectedGroupWeighting() {
    const result = calculate(['pollen_grass', 'mold', 'pm2_5']);

    assertNear(result.score, ((72 * 0.5) + (50 * 0.15) + (30 * 0.25)) / 0.9, 0.001,
        'available selected factors should use selected AirAware group weights');
    assertEqual(result.displayScore, 57,
        'display score should round like the existing formatter convention');
    assertEqual(result.calculation.method, 'selected_group_weighting',
        'calculation method should be exposed');
}

function testUnavailableSelectedFactorIsOmitted() {
    const data = environmentalData({
        pollen: {
            alder: null,
            birch: null,
            grass: 60,
            mugwort: null,
            olive: null,
            ragweed: null,
        },
    });
    const result = calculate(['pollen_birch', 'pollen_grass', 'mold'], data, mold(45));

    assertEqual(result.availableFactorCount, 2,
        'unavailable selected factor should be omitted');
    assertEqual(result.missingFactorCount, 1,
        'missing selected factor count should be exposed');
    assertNear(result.score, ((72 * 0.5) + (45 * 0.15)) / 0.65, 0.001,
        'remaining available factors should be renormalized');
    assertEqual(result.calculation.renormalized, true,
        'renormalization should be exposed');
}

function testAllFactorsMatchEnvironmentalBurden() {
    const data = environmentalData();
    const moldPotential = mold(50);
    const profile = Profile.normalizeProfile({
        enabled: true,
        enabledFactors: Profile.DEFAULT_ENABLED_FACTORS,
    });
    const personalized = PersonalizedRiskCalculator.calculatePersonalizedRisk(
        data,
        moldPotential,
        profile
    );
    const environmental = RiskCalculator.calculateRisk(data, moldPotential);

    assertEqual(personalized.displayScore, environmental.score,
        'fully enabled profile should match the environmental burden score');
}

function testUvDisabledDoesNotAffectExistingProfile() {
    const data = environmentalData({
        uvIndex: 12,
    });
    const result = calculate(['pollen_grass', 'mold'], data, mold(50));

    assertNear(result.score, ((72 * 0.5) + (50 * 0.15)) / 0.65, 0.001,
        'UV data should not affect personalized score when UV is not selected');
}

function testUvEnabledAffectsPersonalizedScore() {
    const data = environmentalData({
        uvIndex: 12,
    });
    const result = calculate(['pollen_grass', 'uv_index'], data, mold(50));

    assertTrue(result.score > 72,
        'selected high UV should increase a grass-only personalized score');
    assertEqual(result.availableGroupCount, 2,
        'UV should be counted as an available selected group');
}

function testUvUnavailableIsOmitted() {
    const result = calculate(['pollen_grass', 'uv_index'], environmentalData({
        uvIndex: null,
    }));

    assertEqual(result.score, 72,
        'missing selected UV should be omitted and remaining groups renormalized');
    assertEqual(result.missingFactorCount, 1,
        'missing selected UV should be counted as unavailable');
}

function testNoSelectedFactors() {
    const result = PersonalizedRiskCalculator.calculatePersonalizedRisk(
        environmentalData(),
        mold(),
        profileWithFactors([])
    );

    assertEqual(result.available, false,
        'empty selected profile should be unavailable');
    assertEqual(result.reason, 'no_factors_selected',
        'empty selected profile reason should be explicit');
    assertEqual(result.score, null,
        'empty selected profile must not show zero');
}

function testAllSelectedFactorsUnavailable() {
    const result = calculate(['pollen_birch', 'wildfire_pm10'], environmentalData({
        pollen: {
            alder: null,
            birch: null,
            grass: null,
            mugwort: null,
            olive: null,
            ragweed: null,
        },
        context: {
            wildfirePm10: null,
            dust: null,
            aerosolOpticalDepth: null,
        },
    }), mold(null, false));

    assertEqual(result.available, false,
        'all unavailable selected factors should not calculate');
    assertEqual(result.reason, 'no_available_factors',
        'all unavailable reason should be explicit');
}

function testDisabledHighFactorDoesNotAffectScore() {
    const data = environmentalData({
        pollutantAqi: {
            pm25: 100,
            pm10: 10,
            nitrogenDioxide: 10,
            ozone: 10,
            sulfurDioxide: 10,
        },
    });
    const result = calculate(['pm10'], data);

    assertEqual(result.score, 10,
        'disabled high PM2.5 should not affect PM10-only score');
}

function testEnabledHighFactorAffectsScore() {
    const data = environmentalData({
        pollutantAqi: {
            pm25: 100,
            pm10: 10,
            nitrogenDioxide: 10,
            ozone: 10,
            sulfurDioxide: 10,
        },
    });
    const result = calculate(['pm2_5'], data);

    assertEqual(result.score, 100,
        'enabled high PM2.5 should affect the personalized score');
}

function testEachPollenTypeIsIndependent() {
    const factors = [
        'pollen_alder',
        'pollen_birch',
        'pollen_grass',
        'pollen_mugwort',
        'pollen_olive',
        'pollen_ragweed',
    ];

    for (const factor of factors) {
        const result = calculate([factor]);

        assertEqual(result.available, true,
            `${factor} should calculate independently`);
        assertEqual(result.factors[0].id, factor,
            `${factor} should not be substituted by another pollen type`);
    }
}

function testPollutionFactorsAreIndependent() {
    const expected = {
        pm2_5: 30,
        pm10: 40,
        nitrogen_dioxide: 20,
        ozone: 65,
        sulphur_dioxide: 10,
    };

    for (const factor in expected) {
        const result = calculate([factor]);

        assertEqual(result.score, expected[factor],
            `${factor} should use its own pollutant-specific AQI value`);
    }
}

function testAtmosphericContextFactors() {
    const dust = calculate(['dust']);
    const wildfire = calculate(['wildfire_pm10']);
    const missingWildfire = calculate(['wildfire_pm10'], environmentalData({
        context: {
            dust: 55,
            wildfirePm10: null,
            aerosolOpticalDepth: 0.1,
        },
    }));

    assertEqual(dust.score, 72,
        'dust should use atmospheric context thresholds');
    assertEqual(wildfire.score, 72,
        'wildfire-related PM10 should use atmospheric context thresholds');
    assertEqual(missingWildfire.available, false,
        'missing optional wildfire context should not be treated as zero');
}

function testMoldReuse() {
    const selected = calculate(['mold'], environmentalData(), mold(64));
    const unavailable = calculate(['mold'], environmentalData(), mold(null, false));

    assertEqual(selected.score, 64,
        'mold selected should reuse the calculated mold potential score');
    assertEqual(unavailable.available, false,
        'unavailable mold should not calculate a personalized score');
}

function testClampingContributorsAndMutation() {
    const data = environmentalData({
        pollutantAqi: {
            pm25: 140,
            pm10: 20,
            nitrogenDioxide: 90,
            ozone: 60,
            sulfurDioxide: 10,
        },
    });
    const before = JSON.stringify(data);
    const result = calculate(['pm2_5', 'pm10', 'nitrogen_dioxide'], data);

    assertTrue(result.score >= 0 && result.score <= 100,
        'score should remain in 0-100 range');
    assertEqual(result.contributors[0].id, 'pm2_5',
        'contributors should be sorted by burden descending');
    assertEqual(JSON.stringify(data), before,
        'calculator should not mutate input objects');
}

function main() {
    const tests = [
        testPersonalizationDisabled,
        testOneAvailableSelectedFactor,
        testMultipleFactorsUseSelectedGroupWeighting,
        testUnavailableSelectedFactorIsOmitted,
        testAllFactorsMatchEnvironmentalBurden,
        testUvDisabledDoesNotAffectExistingProfile,
        testUvEnabledAffectsPersonalizedScore,
        testUvUnavailableIsOmitted,
        testNoSelectedFactors,
        testAllSelectedFactorsUnavailable,
        testDisabledHighFactorDoesNotAffectScore,
        testEnabledHighFactorAffectsScore,
        testEachPollenTypeIsIndependent,
        testPollutionFactorsAreIndependent,
        testAtmosphericContextFactors,
        testMoldReuse,
        testClampingContributorsAndMutation,
    ];

    for (const test of tests)
        test();

    print(`personalizedRiskCalculator: ${tests.length} tests passed`);
}

main();
