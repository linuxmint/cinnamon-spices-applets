#!/usr/bin/env gjs
/* exported main */

imports.searchPath.unshift('lib');

const DailySummaryBuilder = imports.dailySummaryBuilder;
const RiskCalculator = imports.riskCalculator;

function assertEqual(actual, expected, message) {
    if (actual !== expected)
        throw new Error(`${message}: expected ${expected}, got ${actual}`);
}

function assertTrue(condition, message) {
    if (!condition)
        throw new Error(message);
}

function environmentalRisk(score = 52) {
    return {
        score,
        category: RiskCalculator.categoryFromScore(score),
        dominantComponent: {
            name: 'pollen',
            score: 72,
            category: RiskCalculator.categoryFromScore(72),
        },
        components: {
            pollen: {
                score: 72,
                dominantType: 'grass',
            },
            regulatedPollution: {
                score: 40,
                dominantPollutant: 'pm10',
            },
            atmosphericIrritants: {
                score: 30,
                components: {
                    dust: {
                        score: 30,
                    },
                },
            },
            mold: {
                score: 45,
            },
        },
    };
}

function environmentalRiskWithDominant(name, score = 72) {
    const risk = environmentalRisk(score);

    risk.dominantComponent = {
        name,
        score,
        category: RiskCalculator.categoryFromScore(score),
    };

    return risk;
}

function personalizedRisk(score = 68) {
    return {
        available: true,
        score,
        displayScore: Math.round(score),
        category: RiskCalculator.categoryFromScore(score),
        contributors: [{
            id: 'pollen_grass',
            group: 'pollen',
            burden: 82,
        }],
    };
}

function providerData() {
    return {
        current: {
            timestamp: '2026-08-01T14:00',
            uvIndex: 6,
        },
        weather: {
            hourlyRecords: [
                {
                    time: '2026-08-01T13:00',
                    values: {
                        uvIndex: 8.4,
                    },
                },
                {
                    time: '2026-08-01T16:00',
                    values: {
                        uvIndex: 7.1,
                    },
                },
            ],
        },
    };
}

function forecast() {
    return {
        bestWindow: {
            available: true,
            startTime: '2026-08-01T19:00',
            endTime: '2026-08-01T21:00',
            averageScore: 28,
            category: RiskCalculator.categoryFromScore(28),
        },
    };
}

function build(overrides = {}) {
    const input = {
        providerData: providerData(),
        environmentalRisk: environmentalRisk(),
        personalizedRisk: personalizedRisk(),
        personalizedForecast: forecast(),
        panelScoreMode: 'personalized',
        summaryScore: 'personalized',
        includeMainFactor: true,
        includeBestOutdoorWindow: true,
        includeUvPeak: true,
        locationName: 'Prague',
        locationHidden: false,
        stale: false,
        dateLabel: 'Saturday, 1 August',
    };

    for (const key in overrides)
        input[key] = overrides[key];

    return DailySummaryBuilder.buildDailySummary(input);
}

function testPersonalizedScoreMode() {
    const summary = build();

    assertEqual(summary.available, true,
        'summary should be available with a valid score');
    assertEqual(summary.score.requestedType, 'personalized',
        'personalized summary setting should request personalized');
    assertEqual(summary.score.effectiveType, 'personalized',
        'available personalized score should be used');
    assertEqual(summary.score.displayScore, 68,
        'personalized display score should be copied');
}

function testEnvironmentalScoreMode() {
    const summary = build({
        summaryScore: 'environmental',
    });

    assertEqual(summary.score.effectiveType, 'environmental',
        'environmental setting should use environmental burden');
    assertEqual(summary.score.displayScore, 52,
        'environmental score should be copied');
    assertEqual(summary.mainFactor.factorId, 'pollen_grass',
        'environmental pollen main factor should use the dominant pollen type');
}

function testPersonalizedFallback() {
    const summary = build({
        summaryScore: 'personalized',
        personalizedRisk: {
            available: false,
        },
    });

    assertEqual(summary.score.effectiveType, 'environmental',
        'unavailable personalized summary should fall back to environmental');
    assertEqual(summary.score.fallbackUsed, true,
        'fallback should be exposed');
}

function testOptionalSections() {
    const summary = build({
        includeMainFactor: false,
        includeBestOutdoorWindow: false,
        includeUvPeak: false,
    });

    assertEqual(summary.mainFactor.available, false,
        'main factor should be disabled');
    assertEqual(summary.bestOutdoorWindow.available, false,
        'best window should be disabled');
    assertEqual(summary.uvPeak.available, false,
        'UV peak should be disabled');
}

function testHiddenLocationAndStale() {
    const summary = build({
        locationHidden: true,
        stale: true,
    });

    assertEqual(summary.location.hidden, true,
        'hidden location setting should be copied');
    assertEqual(summary.freshness.stale, true,
        'stale state should be copied');
}

function testUvPeakSelection() {
    const summary = build();

    assertEqual(summary.uvPeak.available, true,
        'UV peak should be available');
    assertEqual(summary.uvPeak.value, 8.4,
        'highest next-24-hour UV value should be selected');
    assertEqual(summary.uvPeak.category.id, 'very-high',
        'UV peak category should use shared UV thresholds');
}

function testEnvironmentalRegulatedMainFactor() {
    const summary = build({
        summaryScore: 'environmental',
        environmentalRisk: environmentalRiskWithDominant('regulatedPollution', 65),
    });

    assertEqual(summary.mainFactor.factorId, 'pm10',
        'environmental regulated-pollution main factor should use dominant pollutant');
    assertEqual(summary.mainFactor.factorGroup, 'regulated_pollution',
        'regulated-pollution factor group should be exposed');
}

function testEnvironmentalAtmosphericMainFactor() {
    const risk = environmentalRiskWithDominant('atmosphericIrritants', 80);

    risk.components.atmosphericIrritants.components = {
        carbonMonoxide: {
            score: 30,
        },
        aerosolOpticalDepth: {
            score: 80,
        },
        dust: {
            score: 55,
        },
    };

    const summary = build({
        summaryScore: 'environmental',
        environmentalRisk: risk,
    });

    assertEqual(summary.mainFactor.factorId, 'aerosol_optical_depth',
        'environmental atmospheric main factor should use strongest existing component');
    assertEqual(summary.mainFactor.factorGroup, 'atmospheric_irritant',
        'atmospheric factor group should be exposed');
}

function testEnvironmentalMoldMainFactor() {
    const summary = build({
        summaryScore: 'environmental',
        environmentalRisk: environmentalRiskWithDominant('mold', 64),
    });

    assertEqual(summary.mainFactor.factorId, 'mold',
        'environmental mold main factor should use mold factor id');
    assertEqual(summary.mainFactor.factorGroup, 'mold',
        'mold factor group should be exposed');
}

function testNoData() {
    const summary = DailySummaryBuilder.buildDailySummary({});

    assertEqual(summary.available, false,
        'missing score data should not produce a summary');
    assertEqual(summary.reason, 'no_environmental_data',
        'missing data reason should be explicit');
}

function testInputNotMutated() {
    const data = providerData();
    const before = JSON.stringify(data);

    DailySummaryBuilder.buildDailySummary({
        providerData: data,
        environmentalRisk: environmentalRisk(),
        summaryScore: 'environmental',
    });

    assertEqual(JSON.stringify(data), before,
        'builder should not mutate provider data');
}

function main() {
    const tests = [
        testPersonalizedScoreMode,
        testEnvironmentalScoreMode,
        testPersonalizedFallback,
        testOptionalSections,
        testHiddenLocationAndStale,
        testUvPeakSelection,
        testEnvironmentalRegulatedMainFactor,
        testEnvironmentalAtmosphericMainFactor,
        testEnvironmentalMoldMainFactor,
        testNoData,
        testInputNotMutated,
    ];

    for (const test of tests)
        test();

    print(`dailySummaryBuilder: ${tests.length} tests passed`);
}

main();
