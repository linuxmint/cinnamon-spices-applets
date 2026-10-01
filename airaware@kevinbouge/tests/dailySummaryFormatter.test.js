#!/usr/bin/env gjs
/* exported main */

imports.searchPath.unshift('lib');

const DailySummaryFormatter = imports.dailySummaryFormatter;
const RiskCalculator = imports.riskCalculator;

function assertEqual(actual, expected, message) {
    if (actual !== expected)
        throw new Error(`${message}: expected ${expected}, got ${actual}`);
}

function assertTrue(condition, message) {
    if (!condition)
        throw new Error(message);
}

function fullSummary(overrides = {}) {
    const summary = {
        available: true,
        dateLabel: 'Saturday, 1 August',
        location: {
            available: true,
            displayName: 'Prague',
            hidden: false,
        },
        score: {
            effectiveType: 'personalized',
            score: 68,
            category: RiskCalculator.categoryFromScore(68),
            percentageChange: null,
        },
        mainFactor: {
            available: true,
            factorId: 'pollen_grass',
            factorGroup: 'pollen',
            percentageChange: null,
        },
        bestOutdoorWindow: {
            available: true,
            startTime: '2026-08-01T19:00',
            endTime: '2026-08-01T21:00',
        },
        uvPeak: {
            available: true,
            category: {
                id: 'very-high',
            },
            time: '2026-08-01T13:00',
        },
        freshness: {
            stale: false,
        },
        attribution: {
            providerLabels: ['Open-Meteo'],
        },
    };

    for (const key in overrides)
        summary[key] = overrides[key];

    return summary;
}

function testEmojiMappings() {
    assertEqual(DailySummaryFormatter.getRiskCategoryEmoji('low'), '🟢',
        'low category emoji should match specification');
    assertEqual(DailySummaryFormatter.getRiskCategoryEmoji('moderate'), '🟡',
        'moderate category emoji should match specification');
    assertEqual(DailySummaryFormatter.getRiskCategoryEmoji('high'), '🟠',
        'high category emoji should match specification');
    assertEqual(DailySummaryFormatter.getRiskCategoryEmoji('very-high'), '🔴',
        'very high category emoji should match specification');
    assertEqual(DailySummaryFormatter.getRiskCategoryEmoji('very_high'), '🔴',
        'underscore very high category emoji should match specification');
    assertEqual(DailySummaryFormatter.getRiskCategoryEmoji('unknown'), '⚪',
        'unknown category emoji should be unavailable marker');
    assertEqual(DailySummaryFormatter.getDailySummaryFactorEmoji('pollen'), '🌾',
        'pollen factor emoji should match specification');
    assertEqual(DailySummaryFormatter.getDailySummaryFactorEmoji('regulated_pollution'), '🌬️',
        'pollution factor emoji should match specification');
    assertEqual(DailySummaryFormatter.getDailySummaryFactorEmoji('mold'), '🍄',
        'mold factor emoji should match specification');
    assertEqual(DailySummaryFormatter.getDailySummaryFactorEmoji('uv'), '☀️',
        'UV factor emoji should match specification');
    assertEqual(DailySummaryFormatter.getDailySummaryFactorEmoji('unknown'), '🔎',
        'unknown factor emoji should use fallback marker');
}

function testFullOutput() {
    const output = DailySummaryFormatter.formatDailySummary(fullSummary());
    const expected = [
        '😷 AirAware — Prague',
        '📅 Saturday, 1 August',
        '',
        '🎯 Personalized risk',
        '🟠 High (68%)',
        '',
        '🌾 Main factor',
        'Grass pollen',
        '',
        '🌤️ Best outdoor window',
        '19:00–21:00',
        '',
        '☀️ UV peak',
        'Very High at 13:00',
        '',
        'ℹ️ Environmental conditions only — not medical advice.',
        '📡 Data: Open-Meteo',
    ].join('\n');

    assertEqual(output, expected,
        'full summary should match compact plain-text format');
}

function testHiddenLocationAndCachedData() {
    const output = DailySummaryFormatter.formatDailySummary(fullSummary({
        location: {
            available: true,
            displayName: 'Prague',
            hidden: true,
        },
        freshness: {
            stale: true,
        },
    }));

    assertTrue(output.indexOf('😷 AirAware — Prague') === -1,
        'hidden location should not be included in the title');
    assertTrue(output.indexOf('😷 AirAware') === 0,
        'title should always use mask AirAware branding');
    assertTrue(output.indexOf('💾 Cached data') !== -1,
        'stale summaries should include cached data marker');
}

function testEnvironmentalAndPercentageOutput() {
    const output = DailySummaryFormatter.formatDailySummary(fullSummary({
        score: {
            effectiveType: 'environmental',
            score: 52,
            category: RiskCalculator.categoryFromScore(52),
            percentageChange: 8.2,
        },
        mainFactor: {
            available: true,
            factorId: 'pm2_5',
            factorGroup: 'regulated_pollution',
            percentageChange: -5.6,
        },
    }));

    assertTrue(output.indexOf('🎯 Environmental burden') !== -1,
        'environmental score label should be explicit');
    assertTrue(output.indexOf('🟡 Moderate (52%) (+8%)') !== -1,
        'positive score percentage change should be appended');
    assertTrue(output.indexOf('PM2.5 (-6%)') !== -1,
        'negative factor percentage change should be appended');
}

function testMinimalSummary() {
    const output = DailySummaryFormatter.formatDailySummary(fullSummary({
        location: {
            available: false,
            displayName: null,
            hidden: false,
        },
        mainFactor: {
            available: false,
        },
        bestOutdoorWindow: {
            available: false,
        },
        uvPeak: {
            available: false,
        },
    }));

    assertTrue(output.indexOf('undefined') === -1,
        'output should not include undefined');
    assertTrue(output.indexOf('null') === -1,
        'output should not include null');
    assertTrue(output.indexOf('NaN') === -1,
        'output should not include NaN');
    assertTrue(output.indexOf('\n\n\n') === -1,
        'output should not contain duplicate blank sections');
    assertTrue(output.indexOf('50.') === -1,
        'output should not contain coordinates');
}

function testUnavailableSummaryReturnsEmptyString() {
    assertEqual(DailySummaryFormatter.formatDailySummary({
        available: false,
    }), '', 'unavailable summary should not format text');
}

function main() {
    const tests = [
        testEmojiMappings,
        testFullOutput,
        testHiddenLocationAndCachedData,
        testEnvironmentalAndPercentageOutput,
        testMinimalSummary,
        testUnavailableSummaryReturnsEmptyString,
    ];

    for (const test of tests)
        test();

    print(`dailySummaryFormatter: ${tests.length} tests passed`);
}

main();
