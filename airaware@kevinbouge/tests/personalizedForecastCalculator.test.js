#!/usr/bin/env gjs
/* exported main */

imports.searchPath.unshift('lib');

const ForecastCalculator = imports.personalizedForecastCalculator;
const Profile = imports.personalAllergyProfile;

function assertEqual(actual, expected, message) {
    if (actual !== expected)
        throw new Error(`${message}: expected ${expected}, got ${actual}`);
}

function assertTrue(condition, message) {
    if (!condition)
        throw new Error(message);
}

function profile(factors) {
    let enabledFactors = {};

    for (const id of Profile.FACTOR_IDS)
        enabledFactors[id] = false;

    for (const id of factors)
        enabledFactors[id] = true;

    return Profile.normalizeProfile({
        enabled: true,
        enabledFactors,
    });
}

function hourlyData() {
    let airHours = [];
    let weatherHours = [];

    for (let hour = 0; hour < 26; hour++) {
        const day = hour < 24 ? '01' : '02';
        const localHour = hour % 24;
        const time = `2026-08-${day}T${`${localHour}`.padStart(2, '0')}:00`;

        airHours.push({
            time,
            timestamp: time,
            pollen: {
                grass: hour < 18 ? 60 : 10,
            },
            pollutantAqi: {
                pm25: 20,
            },
            rawPollutants: {
                pm25: 8,
            },
            context: {},
        });
        weatherHours.push({
            time,
            values: {
                relativeHumidity: 65,
                temperature: 20,
                precipitation: 0,
                windSpeed: 3,
                uvIndex: hour >= 10 && hour <= 15 ? 9 : 0,
            },
        });
    }

    return {
        current: {
            timestamp: '2026-08-01T02:00',
        },
        hourlyRecords: airHours,
        weather: {
            hourlyRecords: weatherHours,
            daily: {
                dates: ['2026-08-01', '2026-08-02'],
                leafWetnessProbabilityMean: [90, 10],
                relativeHumidityMean: [65, 65],
                precipitationSum: [0, 0],
                temperatureMean: [20, 20],
                windSpeedMean: [3, 3],
            },
        },
    };
}

function testHourlyScores() {
    const result = ForecastCalculator.calculatePersonalizedForecast(
        hourlyData(),
        profile(['pollen_grass', 'uv_index']),
        {
            horizonHours: 24,
            windowDurationHours: 2,
        }
    );

    assertEqual(result.hours.length, 24,
        'forecast should include the next 24 usable hours');
    assertEqual(result.hours[0].time, '2026-08-01T02:00',
        'forecast should start at the current timestamp, not array index zero');
}

function testBestWindow() {
    const result = ForecastCalculator.calculatePersonalizedForecast(
        hourlyData(),
        profile(['pollen_grass', 'uv_index']),
        {
            horizonHours: 24,
            windowDurationHours: 2,
        }
    );

    assertEqual(result.bestWindow.available, true,
        'best outdoor window should be available when contiguous hours exist');
    assertEqual(result.bestWindow.durationHours, 2,
        'window duration setting should be preserved');
    assertTrue(result.bestWindow.averageScore >= 0 && result.bestWindow.averageScore <= 100,
        'best window average score should remain bounded');
}

function testUvOnlyWindowRequiresUv() {
    const data = hourlyData();

    data.weather.hourlyRecords[5].values.uvIndex = null;

    const result = ForecastCalculator.calculatePersonalizedForecast(
        data,
        profile(['uv_index']),
        {
            horizonHours: 6,
            windowDurationHours: 1,
        }
    );

    assertTrue(result.hours.some(hour => hour.available === false),
        'UV-only forecast should mark missing UV hours unavailable');
}

function testBestWindowRequiresEveryHourCompleteness() {
    const data = hourlyData();

    data.hourlyRecords[2].pollutantAqi.pm25 = null;
    data.hourlyRecords[2].rawPollutants.pm25 = null;
    data.weather.hourlyRecords[2].values.uvIndex = null;
    data.hourlyRecords[2].context.dust = null;
    data.hourlyRecords[3].pollutantAqi.pm25 = 20;
    data.hourlyRecords[3].context.dust = 50;
    data.weather.hourlyRecords[3].values.uvIndex = 0;

    const result = ForecastCalculator.calculatePersonalizedForecast(
        data,
        profile(['pollen_grass', 'uv_index', 'pm2_5', 'dust']),
        {
            horizonHours: 2,
            windowDurationHours: 2,
        }
    );

    assertEqual(result.bestWindow.available, false,
        'candidate window should fail when any hour is below completeness threshold');
}

function testHourlyMoldUsesDailyContext() {
    const result = ForecastCalculator.calculatePersonalizedForecast(
        hourlyData(),
        profile(['mold']),
        {
            horizonHours: 1,
            windowDurationHours: 1,
        }
    );

    assertEqual(result.hours[0].moldPotential.components.leafWetness, 90,
        'hourly mold forecast should use same-day daily leaf-wetness context');
}

function main() {
    const tests = [
        testHourlyScores,
        testBestWindow,
        testUvOnlyWindowRequiresUv,
        testBestWindowRequiresEveryHourCompleteness,
        testHourlyMoldUsesDailyContext,
    ];

    for (const test of tests)
        test();

    print(`personalizedForecastCalculator: ${tests.length} tests passed`);
}

main();
