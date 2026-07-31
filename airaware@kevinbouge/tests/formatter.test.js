#!/usr/bin/env gjs
/* exported main */

imports.searchPath.unshift('lib');

const GLib = imports.gi.GLib;

const Formatter = imports.formatter;

function assertEqual(actual, expected, message) {
    if (actual !== expected)
        throw new Error(`${message}: expected ${expected}, got ${actual}`);
}

function testCategoryFormatting() {
    assertEqual(Formatter.formatCategory('low'), 'Low',
        'known category should format');
    assertEqual(Formatter.formatCategory({ id: 'very-high' }), 'Very High',
        'category object should format');
    assertEqual(Formatter.formatCategory('missing'), 'Unknown',
        'unknown category should be explicit');
}

function testTranslatorFormatting() {
    Formatter.setTranslator(text => {
        const translations = {
            Moderate: 'Mittel',
            '{score}%': '{score}%',
            '{value} {unit}': '{value} {unit}',
            'µg/m³': 'ug/m3',
            Unknown: 'Unbekannt',
        };

        return Object.prototype.hasOwnProperty.call(translations, text)
            ? translations[text]
            : text;
    });

    assertEqual(Formatter.formatCategory('moderate'), 'Mittel',
        'category label should use configured translator');
    assertEqual(Formatter.formatScore(44.6), '45%',
        'score template should be translated before replacement');
    assertEqual(Formatter.formatReading(8.25, 'µg/m³', 1), '8.3 ug/m3',
        'reading formatter should translate unit strings');
    assertEqual(Formatter.formatFieldLabel('missing'), 'Unbekannt',
        'fallback labels should be translated');

    Formatter.resetTranslator();
}

function testPanelLabelFormatting() {
    const risk = {
        category: {
            id: 'moderate',
        },
    };

    assertEqual(Formatter.formatPanelLabel(risk, true), 'Moderate',
        'visible panel label should use category');
    assertEqual(Formatter.formatPanelLabel(risk, false), '',
        'hidden panel label should be empty');
}

function testReadingFormatting() {
    assertEqual(Formatter.formatPollen(12.7), '13 grains/m³',
        'pollen should round to whole grains');
    assertEqual(Formatter.formatPollutant(8.26), '8.3 µg/m³',
        'pollutant should use one decimal place');
    assertEqual(Formatter.formatSulfurDioxide(12.34), '12.3 µg/m³',
        'sulfur dioxide should use pollutant formatting');
    assertEqual(Formatter.formatAerosolOpticalDepth(0.123), '0.12',
        'aerosol optical depth should use two decimal places');
    assertEqual(Formatter.formatCarbonMonoxide(156.7), '157 µg/m³',
        'carbon monoxide should use whole-number pollutant formatting');
    assertEqual(Formatter.formatAqi(140), 'AQI 100',
        'AQI display should clamp to the AirAware score range');
    assertEqual(Formatter.formatAqi(42, 'US AQI'), 'US AQI 42',
        'AQI display should include the selected source label');
    assertEqual(Formatter.formatAqi(42, 'EU AQI'), 'EU AQI 42',
        'AQI display should support compact EU AQI label');
    assertEqual(Formatter.formatReading(null, 'µg/m³'), 'Unavailable',
        'missing value should be unavailable');
    assertEqual(Formatter.formatReading(-2, 'µg/m³'), '0 µg/m³',
        'negative environmental readings should clamp to zero');
    assertEqual(Formatter.formatReading(1.23456, '', 8), '1.235',
        'precision should clamp to a maximum of three decimals');
    assertEqual(Formatter.formatReading(1.9, '', -2), '2',
        'negative precision should clamp to whole-number formatting');
}

function testScoreFormatting() {
    assertEqual(Formatter.formatScore(55.4), '55%',
        'score should round to whole number');
    assertEqual(Formatter.formatScore(140), '100%',
        'score should clamp to upper bound');
    assertEqual(Formatter.formatScore(NaN), 'Unavailable',
        'invalid score should be unavailable');
}

function testMoldPotentialFormatting() {
    assertEqual(Formatter.formatMoldPotential({
        score: 58,
        category: {
            id: 'moderate',
        },
        isAvailable: true,
    }), '58%', 'available mold potential should format score as percentage');
    assertEqual(Formatter.formatMoldPotential({
        score: null,
        category: null,
        isAvailable: false,
    }), 'Weather data unavailable',
        'unavailable mold potential should identify missing weather data');
    assertEqual(Formatter.formatMoldPotential(null), 'Weather data unavailable',
        'missing mold potential should identify missing weather data');
    assertEqual(Formatter.formatWeatherUnavailable(), 'Weather data unavailable',
        'weather unavailable state should be formatted centrally');
}

function testWeatherFormatting() {
    assertEqual(Formatter.formatPercentage(55.2), '55%',
        'percentage should round to whole percent');
    assertEqual(Formatter.formatTemperature(-2.4), '-2.4 °C',
        'temperature should preserve negative values');
    assertEqual(Formatter.formatDewPoint(-5), '-5.0 °C',
        'dew point should preserve negative values');
    assertEqual(Formatter.formatWindSpeed(3.25), '3.3 m/s',
        'wind speed should use one decimal place');
    assertEqual(Formatter.formatWindDirection(92), '92° E',
        'wind direction should include compass sector');
    assertEqual(Formatter.formatWindGusts(8.8), '8.8 m/s',
        'wind gusts should use wind speed formatting');
    assertEqual(Formatter.formatVisibility(12450), '12.5 km',
        'visibility should convert meters to kilometers');
}

function testVegetationFormatting() {
    assertEqual(Formatter.formatDistanceMeters(120), '120 m',
        'short vegetation distances should use meters');
    assertEqual(Formatter.formatDistanceMeters(1100), '1.1 km',
        'long vegetation distances should use kilometers');
    assertEqual(Formatter.formatVegetationCategoryLabel('grassland'), 'Grassland',
        'vegetation category labels should format');
    assertEqual(Formatter.formatMappedTaxonLabel('birch'), 'Mapped birch trees',
        'mapped taxon labels should describe mapped OSM data');
    assertEqual(Formatter.formatMappedTaxonLabel('unknown'), 'Mapped allergenic trees',
        'unknown mapped taxon labels should use generic mapped wording');
}

function testTimestampFormatting() {
    const expected = GLib.DateTime.new_from_unix_local(0).format('%Y-%m-%d %H:%M');

    assertEqual(Formatter.formatTimestamp(0), expected,
        'timestamp should format in local timezone');
    assertEqual(Formatter.formatTimestamp('bad'), 'Unavailable',
        'invalid timestamp should be unavailable');
}

function testStaleFormatting() {
    const now = 1000 * 60 * 60;

    assertEqual(Formatter.isStale(now - 10 * 60 * 1000, now, 30), false,
        'recent data should not be stale');
    assertEqual(Formatter.isStale(now - 10 * 60 * 1000, now, '30'), false,
        'stale check should accept numeric string age');
    assertEqual(Formatter.isStale(now - 31 * 60 * 1000, now, 30), true,
        'old data should be stale');
    assertEqual(Formatter.isStale(now - 30 * 60 * 1000, now, 30), false,
        'data exactly at max age should not be stale');
    assertEqual(Formatter.formatStaleStatus('bad', now, 30),
        'No recent data', 'invalid update time should say no recent data');
    assertEqual(Formatter.formatStaleStatus(now - 30 * 1000, now, 30),
        'Updated just now', 'sub-minute age should say updated just now');
    assertEqual(Formatter.formatStaleStatus(now - 60 * 1000, now, 30),
        'Updated 1 min ago', 'single-minute age should use singular string');
    assertEqual(Formatter.formatStaleStatus(now - 2 * 60 * 1000, now, 30),
        'Updated 2 min ago', 'fresh status should include age');
    assertEqual(Formatter.formatStaleStatus(now - 31 * 60 * 1000, now, 30),
        'Stale data', 'old status should say stale');
}

function testFieldLabels() {
    assertEqual(Formatter.formatFieldLabel('nitrogenDioxide'), 'NO₂',
        'canonical nitrogen dioxide label should format');
    assertEqual(Formatter.formatFieldLabel('dust'), 'Dust',
        'canonical dust label should format');
    assertEqual(Formatter.formatFieldLabel('sulfurDioxide'), 'SO₂',
        'canonical sulfur dioxide label should format');
    assertEqual(Formatter.formatFieldLabel('aerosolOpticalDepth'), 'Aerosol optical depth',
        'canonical aerosol optical depth label should format');
    assertEqual(Formatter.formatFieldLabel('carbonMonoxide'), 'CO',
        'canonical carbon monoxide label should format');
    assertEqual(Formatter.formatFieldLabel('alder'), 'Alder pollen',
        'canonical alder pollen label should format');
    assertEqual(Formatter.formatPollenTypeLabel('birch'), 'Birch',
        'pollen label helper should omit the repeated pollen suffix');
    assertEqual(Formatter.formatFieldLabel('missing'), 'Unknown',
        'unknown field label should be explicit');
}

function main() {
    Formatter.resetTranslator();

    const tests = [
        testCategoryFormatting,
        testTranslatorFormatting,
        testPanelLabelFormatting,
        testReadingFormatting,
        testScoreFormatting,
        testMoldPotentialFormatting,
        testWeatherFormatting,
        testVegetationFormatting,
        testTimestampFormatting,
        testStaleFormatting,
        testFieldLabels,
    ];

    for (const test of tests)
        test();

    print(`formatter: ${tests.length} tests passed`);
}

main();
