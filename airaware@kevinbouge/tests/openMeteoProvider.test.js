#!/usr/bin/env gjs
/* exported main */

imports.searchPath.unshift('lib');

const OpenMeteoProvider = imports.openMeteoProvider;
const ByteArray = imports.byteArray;
const GLib = imports.gi.GLib;

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
        if (error.message.indexOf(expectedMessagePart) === -1) {
            throw new Error(`${message}: expected "${expectedMessagePart}" in "${error.message}"`);
        }

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
        current: {
            time: '2026-07-30T12:00',
            pm10: 18,
            pm2_5: 7.5,
            nitrogen_dioxide: 22,
            ozone: 64,
            dust: 3,
            alder_pollen: 4,
            birch_pollen: 28,
            olive_pollen: 8,
            grass_pollen: 34,
            mugwort_pollen: 2,
            ragweed_pollen: 19,
        },
        hourly: {
            time: [
                '2026-07-30T00:00',
                '2026-07-30T12:00',
                '2026-07-31T00:00',
                '2026-07-31T12:00',
                '2026-08-01T00:00',
            ],
            pm10: [10, 18, 30, 36, 22],
            pm2_5: [4, 7.5, 10, 12, 8],
            nitrogen_dioxide: [10, 22, 18, 24, 14],
            ozone: [40, 64, 70, 85, 66],
            dust: [1, 3, 2, 8, 3],
            alder_pollen: [1, 4, 3, 2, 1],
            birch_pollen: [20, 28, 18, 14, 10],
            olive_pollen: [5, 8, 6, 5, 3],
            grass_pollen: [24, 34, 40, 45, 28],
            mugwort_pollen: [1, 2, 4, 5, 2],
            ragweed_pollen: [8, 19, 20, 25, 10],
        },
    };
}

function testBuildRequestUrl() {
    const url = OpenMeteoProvider.buildRequestUrl({
        latitude: 50.08,
        longitude: 14.44,
    }, {
        forecastDays: 4,
    });

    assertTrue(url.indexOf('https://air-quality-api.open-meteo.com/v1/air-quality?') === 0,
        'request URL should use Open-Meteo Air Quality endpoint');
    assertTrue(url.indexOf('latitude=50.08') !== -1,
        'request URL should include latitude');
    assertTrue(url.indexOf('current=') !== -1,
        'request URL should request current values');
    assertTrue(url.indexOf('hourly=') !== -1,
        'request URL should request hourly forecast values');
    assertTrue(url.indexOf('forecast_days=4') !== -1,
        'request URL should include forecast days');
}

function testBuildRequestUrlNormalizesForecastDays() {
    const url = OpenMeteoProvider.buildRequestUrl({
        latitude: 50.08,
        longitude: 14.44,
    }, {
        forecastDays: '5',
    });

    assertTrue(url.indexOf('forecast_days=5') !== -1,
        'request URL should accept numeric string forecast days');
}

function testNormalApiResponse() {
    const result = OpenMeteoProvider.parseOpenMeteoResponse(normalPayload(), {
        forecastDays: 3,
    });

    assertEqual(result.provider, 'open-meteo', 'provider id should be set');
    assertEqual(result.timezone, 'Europe/Prague', 'timezone should be preserved');
    assertEqual(result.current.readings.treePollen, 28,
        'tree pollen should use highest tree source');
    assertEqual(result.current.readings.grassPollen, 34,
        'grass pollen should map directly');
    assertEqual(result.current.readings.weedPollen, 19,
        'weed pollen should use highest weed source');
    assertEqual(result.current.readings.pm25, 7.5,
        'PM2.5 should map from Open-Meteo pm2_5');
    assertEqual(result.forecast.length, 3,
        'forecast should contain requested number of days');
    assertEqual(result.forecast[1].readings.grassPollen, 45,
        'daily forecast should use max hourly value for the day');
    assertEqual(result.isPartial, false,
        'complete response should not be partial');
}

function testMissingPollen() {
    const payload = normalPayload();
    delete payload.current.alder_pollen;
    delete payload.current.birch_pollen;
    delete payload.current.olive_pollen;
    payload.current.grass_pollen = null;
    delete payload.current.mugwort_pollen;
    delete payload.current.ragweed_pollen;
    delete payload.hourly.alder_pollen;
    delete payload.hourly.birch_pollen;
    delete payload.hourly.olive_pollen;
    delete payload.hourly.grass_pollen;
    delete payload.hourly.mugwort_pollen;
    delete payload.hourly.ragweed_pollen;

    const result = OpenMeteoProvider.parseOpenMeteoResponse(payload, {
        forecastDays: 2,
    });

    assertEqual(result.current.readings.treePollen, null,
        'missing tree pollen should be null');
    assertTrue(result.current.missingFields.indexOf('treePollen') !== -1,
        'tree pollen should be listed as missing');
    assertTrue(result.current.missingFields.indexOf('grassPollen') !== -1,
        'grass pollen should be listed as missing');
    assertTrue(result.current.missingFields.indexOf('weedPollen') !== -1,
        'weed pollen should be listed as missing');
    assertEqual(result.current.readings.pm10, 18,
        'pollution values should remain usable when pollen is missing');
    assertEqual(result.isPartial, true,
        'missing pollen should mark result partial');
}

function testMalformedResponse() {
    assertThrows(() => OpenMeteoProvider.parseOpenMeteoJson('{'),
        'Invalid Open-Meteo JSON', 'malformed JSON should throw');
    assertThrows(() => OpenMeteoProvider.parseOpenMeteoResponse([]),
        'expected object', 'array response should throw');
    assertThrows(() => OpenMeteoProvider.parseOpenMeteoResponse({ error: true, reason: 'bad request' }),
        'bad request', 'Open-Meteo error response should throw');
    assertThrows(() => OpenMeteoProvider.parseOpenMeteoResponse({ hourly_units: {} }),
        'missing current and hourly data', 'response with no usable data should throw');
}

function testInvalidResponseCoordinatesAreDropped() {
    const payload = normalPayload();
    payload.latitude = 200;
    payload.longitude = -400;

    const result = OpenMeteoProvider.parseOpenMeteoResponse(payload, {
        forecastDays: 1,
    });

    assertEqual(result.latitude, null,
        'invalid provider latitude should not be preserved');
    assertEqual(result.longitude, null,
        'invalid provider longitude should not be preserved');
}

function testNoUsableCurrentReadingsThrows() {
    const payload = normalPayload();

    for (const key in payload.current) {
        if (key !== 'time')
            payload.current[key] = null;
    }

    assertThrows(() => OpenMeteoProvider.parseOpenMeteoResponse(payload),
        'no usable current readings',
        'response without usable current readings should throw');
}

function testFetchInvalidCoordinatesReportsCallbackError() {
    const loop = new GLib.MainLoop(null, false);
    let callbackCalled = false;

    OpenMeteoProvider.fetchForecastAsync({
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

    OpenMeteoProvider.fetchForecastAsync({
        latitude: 50.08,
        longitude: 14.44,
    }, {
        session,
    }, (error, data) => {
        callbackCalled = true;

        try {
            assertEqual(error, null,
                'successful retry should not return an error');
            assertEqual(data.provider, 'open-meteo',
                'successful retry should parse provider data');
            assertEqual(session.attempts, 2,
                'transport failure should be retried once');
        } catch (error) {
            callbackError = error;
        }

        loop.quit();
    });

    if (!callbackCalled)
        runLoopWithTimeout(loop, 'retry test timed out');

    if (callbackError)
        throw callbackError;
}

function testFetchCancelCompletesCallback() {
    const loop = new GLib.MainLoop(null, false);
    const session = createMockSession([
        {
            bytes: bytesFromJson(normalPayload()),
        },
    ]);
    let callbackCalled = false;
    let callbackError = null;

    const request = OpenMeteoProvider.fetchForecastAsync({
        latitude: 50.08,
        longitude: 14.44,
    }, {
        session,
    }, (error, data) => {
        callbackCalled = true;

        try {
            assertTrue(error.message.indexOf('cancelled') !== -1,
                'cancelled request should return cancellation error');
            assertEqual(data, null,
                'cancelled request should not return data');
            assertEqual(session.attempts, 1,
                'cancelled request should not retry');
        } catch (error) {
            callbackError = error;
        }

        loop.quit();
    });

    request.cancel();

    if (!callbackCalled)
        runLoopWithTimeout(loop, 'cancel test timed out');

    if (callbackError)
        throw callbackError;
}

function testFetchRetriesTransientHttpStatusOnce() {
    const loop = new GLib.MainLoop(null, false);
    const session = createMockSession([
        {
            status: 503,
            bytes: GLib.Bytes.new(ByteArray.fromString('')),
        },
        {
            status: 200,
            bytes: bytesFromJson(normalPayload()),
        },
    ]);
    let callbackCalled = false;
    let callbackError = null;

    OpenMeteoProvider.fetchForecastAsync({
        latitude: 50.08,
        longitude: 14.44,
    }, {
        session,
    }, (error, data) => {
        callbackCalled = true;

        try {
            assertEqual(error, null,
                'transient HTTP retry should not return an error after success');
            assertEqual(data.provider, 'open-meteo',
                'transient HTTP retry should parse provider data');
            assertEqual(session.attempts, 2,
                'HTTP 503 should be retried once');
        } catch (error) {
            callbackError = error;
        }

        loop.quit();
    });

    if (!callbackCalled)
        runLoopWithTimeout(loop, 'transient HTTP retry test timed out');

    if (callbackError)
        throw callbackError;
}

function testFetchDoesNotRetryClientHttpStatus() {
    const loop = new GLib.MainLoop(null, false);
    const session = createMockSession([
        {
            status: 400,
            bytes: GLib.Bytes.new(ByteArray.fromString('bad request')),
        },
    ]);
    let callbackCalled = false;
    let callbackError = null;

    OpenMeteoProvider.fetchForecastAsync({
        latitude: 50.08,
        longitude: 14.44,
    }, {
        session,
    }, (error, data) => {
        callbackCalled = true;

        try {
            assertTrue(error.message.indexOf('Open-Meteo HTTP 400') !== -1,
                'HTTP 400 should be returned as provider error');
            assertEqual(data, null,
                'HTTP 400 should not return data');
            assertEqual(session.attempts, 1,
                'HTTP 400 should not be retried');
        } catch (error) {
            callbackError = error;
        }

        loop.quit();
    });

    if (!callbackCalled)
        runLoopWithTimeout(loop, 'client HTTP error test timed out');

    if (callbackError)
        throw callbackError;
}

function main() {
    const tests = [
        testBuildRequestUrl,
        testBuildRequestUrlNormalizesForecastDays,
        testNormalApiResponse,
        testMissingPollen,
        testMalformedResponse,
        testInvalidResponseCoordinatesAreDropped,
        testNoUsableCurrentReadingsThrows,
        testFetchInvalidCoordinatesReportsCallbackError,
        testFetchRetriesTransportFailureOnce,
        testFetchCancelCompletesCallback,
        testFetchRetriesTransientHttpStatusOnce,
        testFetchDoesNotRetryClientHttpStatus,
    ];

    for (const test of tests)
        test();

    print(`openMeteoProvider: ${tests.length} tests passed`);
}

main();
