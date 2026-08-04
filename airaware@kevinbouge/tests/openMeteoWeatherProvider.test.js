#!/usr/bin/env gjs
/* exported main */

imports.searchPath.unshift('lib');

const ByteArray = imports.byteArray;
const GLib = imports.gi.GLib;
const WeatherProvider = imports.openMeteoWeatherProvider;

function assertEqual(actual, expected, message) {
    if (actual !== expected)
        throw new Error(`${message}: expected ${expected}, got ${actual}`);
}

function assertTrue(condition, message) {
    if (!condition)
        throw new Error(message);
}

function assertThrows(fn, expectedMessagePart, message) {
    try {
        fn();
    } catch (error) {
        if (error.message.indexOf(expectedMessagePart) === -1)
            throw new Error(`${message}: expected "${expectedMessagePart}" in "${error.message}"`);

        return;
    }

    throw new Error(`${message}: expected exception`);
}

function bytesFromJson(value) {
    return GLib.Bytes.new(ByteArray.fromString(JSON.stringify(value)));
}

function runLoopWithTimeout(loop, timeoutMessage) {
    let timedOut = false;
    const timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000, () => {
        timedOut = true;
        loop.quit();
        return GLib.SOURCE_REMOVE;
    });

    loop.run();

    if (!timedOut)
        GLib.source_remove(timeoutId);

    if (timedOut)
        throw new Error(timeoutMessage);
}

function createMockSession(results) {
    return {
        timeout: 0,
        attempts: 0,

        send_and_read_async(message, priority, cancellable, callback) {
            const index = this.attempts;
            const result = results[index] || results[results.length - 1];

            this.attempts++;
            message.get_status = () => result.status || 200;
            GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
                callback(this, {
                    cancellable,
                    result,
                });

                return GLib.SOURCE_REMOVE;
            });
        },

        send_and_read_finish(asyncResult) {
            if (asyncResult.cancellable.is_cancelled())
                throw new Error('Operation was cancelled');

            if (asyncResult.result.error)
                throw asyncResult.result.error;

            return asyncResult.result.bytes;
        },
    };
}

function normalPayload() {
    return {
        latitude: 50.08,
        longitude: 14.44,
        utc_offset_seconds: 7200,
        timezone: 'Europe/Prague',
        timezone_abbreviation: 'CEST',
        generationtime_ms: 2.34,
        current_units: {
            temperature_2m: '°C',
            relative_humidity_2m: '%',
            dew_point_2m: '°C',
            precipitation: 'mm',
            wind_speed_10m: 'm/s',
            wind_direction_10m: '°',
            wind_gusts_10m: 'm/s',
            visibility: 'm',
            uv_index: '',
        },
        hourly_units: {
            temperature_2m: '°C',
            relative_humidity_2m: '%',
            dew_point_2m: '°C',
            precipitation: 'mm',
            wind_speed_10m: 'm/s',
            wind_direction_10m: '°',
            wind_gusts_10m: 'm/s',
            visibility: 'm',
            uv_index: '',
        },
        daily_units: {
            leaf_wetness_probability_mean: '%',
            precipitation_sum: 'mm',
        },
        current: {
            time: '2026-07-30T12:00',
            temperature_2m: 20.1,
            relative_humidity_2m: 76,
            dew_point_2m: 15.7,
            precipitation: 0,
            wind_speed_10m: 3.4,
            wind_direction_10m: 220,
            wind_gusts_10m: 8.5,
            visibility: 18000,
            uv_index: 6.7,
        },
        hourly: {
            time: [
                '2026-07-30T00:00',
                '2026-07-30T01:00',
                '2026-07-30T02:00',
            ],
            temperature_2m: [18.5, 19.2, 20.1],
            relative_humidity_2m: [72, 80, 76],
            dew_point_2m: [13.4, 15.6, 15.7],
            precipitation: [0, 0.3, 1.2],
            wind_speed_10m: [2.5, 2.1, 3.4],
            wind_direction_10m: [200, 210, 220],
            wind_gusts_10m: [6.5, 7.1, 8.5],
            visibility: [20000, 18000, 17000],
            uv_index: [0.2, 3.1, 6.7],
        },
        daily: {
            time: ['2026-07-30', '2026-07-31'],
            leaf_wetness_probability_mean: [65, 72],
            temperature_2m_mean: [19, 21],
            temperature_2m_max: [24, 26],
            temperature_2m_min: [14, 16],
            relative_humidity_2m_mean: [74, 78],
            relative_humidity_2m_max: [88, 90],
            precipitation_sum: [1.5, 0.4],
            wind_speed_10m_mean: [3, 4],
            wind_speed_10m_max: [6, 7],
            wind_gusts_10m_max: [11, 12],
        },
    };
}

function testBuildRequestUrl() {
    const url = WeatherProvider.buildRequestUrl({
        latitude: 50.08,
        longitude: 14.44,
    }, {
        forecastDays: 4,
    });

    assertTrue(url.indexOf('https://api.open-meteo.com/v1/forecast?') === 0,
        'request URL should use Open-Meteo Weather endpoint');
    assertTrue(url.indexOf('temperature_2m') !== -1,
        'request URL should include temperature');
    assertTrue(url.indexOf('current=') !== -1,
        'request URL should request current values');
    assertTrue(url.indexOf('daily=') !== -1,
        'request URL should request daily values');
    assertTrue(url.indexOf('relative_humidity_2m') !== -1,
        'request URL should include relative humidity');
    assertTrue(url.indexOf('dew_point_2m') !== -1,
        'request URL should include dew point');
    assertTrue(url.indexOf('precipitation') !== -1,
        'request URL should include precipitation');
    assertTrue(url.indexOf('wind_speed_10m') !== -1,
        'request URL should include wind speed');
    assertTrue(url.indexOf('wind_direction_10m') !== -1,
        'request URL should include wind direction');
    assertTrue(url.indexOf('wind_gusts_10m') !== -1,
        'request URL should include wind gusts');
    assertTrue(url.indexOf('visibility') !== -1,
        'request URL should include visibility');
    assertTrue(url.indexOf('uv_index') !== -1,
        'request URL should include UV index');
    assertTrue(url.indexOf('leaf_wetness_probability_mean') !== -1,
        'request URL should include daily leaf wetness');
    assertTrue(url.indexOf('timezone=auto') !== -1,
        'request URL should use automatic timezone by default');
    assertTrue(url.indexOf('wind_speed_unit=ms') !== -1,
        'request URL should request wind speed in m/s');
}

function testNormalApiResponse() {
    const result = WeatherProvider.parseOpenMeteoResponse(normalPayload());

    assertEqual(result.provider, 'open-meteo-weather',
        'provider id should be set');
    assertEqual(result.timezone, 'Europe/Prague',
        'timezone should be preserved');
    assertEqual(result.metadata.timezoneAbbreviation, 'CEST',
        'timezone abbreviation should be preserved');
    assertEqual(result.metadata.generationTimeMs, 2.34,
        'generation time should be preserved');
    assertEqual(result.units.precipitation, 'mm',
        'precipitation unit should be preserved');
    assertEqual(result.current.temperature, 20.1,
        'current temperature should map from Open-Meteo current field');
    assertEqual(result.current.dewPoint, 15.7,
        'current dew point should map from Open-Meteo current field');
    assertEqual(result.current.windGusts, 8.5,
        'current wind gusts should map from Open-Meteo current field');
    assertEqual(result.current.visibility, 18000,
        'current visibility should map from Open-Meteo current field');
    assertEqual(result.current.uvIndex, 6.7,
        'current UV index should map from Open-Meteo current field');
    assertEqual(result.hourlyRecords.length, 3,
        'hourly records should be normalized');
    assertEqual(result.hourly.temperature[1], 19.2,
        'temperature should map from Open-Meteo field');
    assertEqual(result.hourly.relativeHumidity[1], 80,
        'humidity should map from Open-Meteo field');
    assertEqual(result.hourly.dewPoint[1], 15.6,
        'dew point should map from Open-Meteo field');
    assertEqual(result.hourly.precipitation[1], 0.3,
        'precipitation should map from Open-Meteo field');
    assertEqual(result.hourly.windSpeed[1], 2.1,
        'wind speed should map from Open-Meteo field');
    assertEqual(result.hourly.windDirection[1], 210,
        'wind direction should map from Open-Meteo field');
    assertEqual(result.hourly.windGusts[1], 7.1,
        'wind gusts should map from Open-Meteo field');
    assertEqual(result.hourly.visibility[1], 18000,
        'visibility should map from Open-Meteo field');
    assertEqual(result.hourly.uvIndex[1], 3.1,
        'UV index should map from Open-Meteo field');
    assertEqual(result.daily.leafWetnessProbabilityMean[0], 65,
        'daily leaf wetness should be preserved');
    assertEqual(result.daily.precipitationSum[0], 1.5,
        'daily precipitation sum should be preserved');
    assertEqual(result.isPartial, false,
        'complete response should not be partial');
}

function testSignedTemperatureFieldsArePreserved() {
    const payload = normalPayload();

    payload.current.temperature_2m = -4.5;
    payload.current.dew_point_2m = -6.2;
    payload.hourly.temperature_2m = [-5.1, -3.4, 0.2];
    payload.hourly.dew_point_2m = [-7.8, -5.6, -1.1];
    payload.daily.temperature_2m_mean = [-4, -2];
    payload.daily.temperature_2m_max = [-1, 1];
    payload.daily.temperature_2m_min = [-9, -6];
    payload.current.precipitation = -1;

    const result = WeatherProvider.parseOpenMeteoResponse(payload);

    assertEqual(result.current.temperature, -4.5,
        'current temperature should preserve negative Celsius values');
    assertEqual(result.current.dewPoint, -6.2,
        'current dew point should preserve negative Celsius values');
    assertEqual(result.hourly.temperature[0], -5.1,
        'hourly temperature should preserve negative Celsius values');
    assertEqual(result.hourly.dewPoint[0], -7.8,
        'hourly dew point should preserve negative Celsius values');
    assertEqual(result.daily.temperatureMean[0], -4,
        'daily mean temperature should preserve negative Celsius values');
    assertEqual(result.daily.temperatureMax[0], -1,
        'daily max temperature should preserve negative Celsius values');
    assertEqual(result.daily.temperatureMin[0], -9,
        'daily min temperature should preserve negative Celsius values');
    assertEqual(result.current.precipitation, 0,
        'non-negative weather quantities should still clamp invalid negatives');
}

function testMissingFieldsBecomeNull() {
    const payload = normalPayload();
    delete payload.hourly.precipitation;
    payload.hourly.wind_speed_10m = [null, 'bad', undefined];
    payload.hourly.uv_index = [1.2, -1, 'bad'];
    payload.current.dew_point_2m = 'bad';
    payload.current.uv_index = -2;
    delete payload.daily.leaf_wetness_probability_mean;

    const result = WeatherProvider.parseOpenMeteoResponse(payload);

    assertEqual(result.hourly.precipitation.length, 0,
        'missing precipitation should be null');
    assertEqual(result.hourlyRecords[1].values.windSpeed, null,
        'malformed wind speed should be null');
    assertEqual(result.current.dewPoint, null,
        'malformed current dew point should be null');
    assertEqual(result.current.uvIndex, null,
        'negative current UV index should be null');
    assertEqual(result.hourlyRecords[1].values.uvIndex, null,
        'negative hourly UV index should be null');
    assertEqual(result.hourlyRecords[2].values.uvIndex, null,
        'malformed hourly UV index should be null');
    assertEqual(result.daily.leafWetnessProbabilityMean.length, 0,
        'missing daily leaf wetness should be empty');
    assertTrue(result.missingFields.indexOf('precipitation') !== -1,
        'missing precipitation should be tracked');
    assertEqual(result.isPartial, true,
        'missing weather fields should mark response partial');
}

function testMalformedResponse() {
    assertThrows(() => WeatherProvider.parseOpenMeteoJson('{'),
        'Invalid Open-Meteo Weather JSON', 'malformed JSON should throw');
    assertThrows(() => WeatherProvider.parseOpenMeteoResponse([]),
        'expected object', 'array response should throw');
    assertThrows(() => WeatherProvider.parseOpenMeteoResponse({ error: true, reason: 'bad request' }),
        'bad request', 'Open-Meteo error response should throw');
    assertThrows(() => WeatherProvider.parseOpenMeteoResponse({ hourly: {} }),
        'missing hourly time', 'missing hourly time should throw');
}

function testInvalidCoordinatesReportCallbackError() {
    const loop = new GLib.MainLoop(null, false);
    let callbackCalled = false;

    WeatherProvider.fetchForecastAsync({
        latitude: 200,
        longitude: 14,
    }, (error, data) => {
        callbackCalled = true;
        assertTrue(error.message.indexOf('Invalid latitude') !== -1,
            'invalid latitude should be reported through callback');
        assertEqual(data, null,
            'invalid request should not return data');
        loop.quit();
    });

    if (!callbackCalled)
        loop.run();
}

function testFetchRetriesTransportFailureOnce() {
    const loop = new GLib.MainLoop(null, false);
    const session = createMockSession([
        {
            error: new Error('temporary network failure'),
        },
        {
            bytes: bytesFromJson(normalPayload()),
        },
    ]);
    let callbackCalled = false;
    let callbackError = null;

    WeatherProvider.fetchForecastAsync({
        latitude: 50.08,
        longitude: 14.44,
    }, {
        session,
    }, (error, data) => {
        callbackCalled = true;

        try {
            assertEqual(error, null,
                'successful retry should not return an error');
            assertEqual(data.provider, 'open-meteo-weather',
                'successful retry should parse provider data');
            assertEqual(session.attempts, 2,
                'transport failure should be retried once');
        } catch (error) {
            callbackError = error;
        }

        loop.quit();
    });

    if (!callbackCalled)
        runLoopWithTimeout(loop, 'weather retry test timed out');

    if (callbackError)
        throw callbackError;
}

function main() {
    const tests = [
        testBuildRequestUrl,
        testNormalApiResponse,
        testSignedTemperatureFieldsArePreserved,
        testMissingFieldsBecomeNull,
        testMalformedResponse,
        testInvalidCoordinatesReportCallbackError,
        testFetchRetriesTransportFailureOnce,
    ];

    for (const test of tests)
        test();

    print(`openMeteoWeatherProvider: ${tests.length} tests passed`);
}

main();
