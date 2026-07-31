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
        hourly_units: {
            temperature_2m: '°C',
            relative_humidity_2m: '%',
            precipitation: 'mm',
            wind_speed_10m: 'm/s',
        },
        hourly: {
            time: [
                '2026-07-30T00:00',
                '2026-07-30T01:00',
                '2026-07-30T02:00',
            ],
            temperature_2m: [18.5, 19.2, 20.1],
            relative_humidity_2m: [72, 80, 76],
            precipitation: [0, 0.3, 1.2],
            wind_speed_10m: [2.5, 2.1, 3.4],
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
    assertTrue(url.indexOf('relative_humidity_2m') !== -1,
        'request URL should include relative humidity');
    assertTrue(url.indexOf('precipitation') !== -1,
        'request URL should include precipitation');
    assertTrue(url.indexOf('wind_speed_10m') !== -1,
        'request URL should include wind speed');
    assertTrue(url.indexOf('timezone=auto') !== -1,
        'request URL should use automatic timezone by default');
}

function testNormalApiResponse() {
    const result = WeatherProvider.parseOpenMeteoResponse(normalPayload());

    assertEqual(result.provider, 'open-meteo-weather',
        'provider id should be set');
    assertEqual(result.timezone, 'Europe/Prague',
        'timezone should be preserved');
    assertEqual(result.units.precipitation, 'mm',
        'precipitation unit should be preserved');
    assertEqual(result.hourly.length, 3,
        'hourly records should be normalized');
    assertEqual(result.hourly[1].values.temperature, 19.2,
        'temperature should map from Open-Meteo field');
    assertEqual(result.hourly[1].values.relativeHumidity, 80,
        'humidity should map from Open-Meteo field');
    assertEqual(result.hourly[1].values.precipitation, 0.3,
        'precipitation should map from Open-Meteo field');
    assertEqual(result.hourly[1].values.windSpeed, 2.1,
        'wind speed should map from Open-Meteo field');
    assertEqual(result.isPartial, false,
        'complete response should not be partial');
}

function testMissingFieldsBecomeNull() {
    const payload = normalPayload();
    delete payload.hourly.precipitation;
    payload.hourly.wind_speed_10m = [null, 'bad', undefined];

    const result = WeatherProvider.parseOpenMeteoResponse(payload);

    assertEqual(result.hourly[0].values.precipitation, null,
        'missing precipitation should be null');
    assertEqual(result.hourly[1].values.windSpeed, null,
        'malformed wind speed should be null');
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
