#!/usr/bin/env gjs
/* exported main */

imports.searchPath.unshift('lib');

const ReverseGeocoder = imports.reverseGeocoder;
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
        userAgents: [],

        send_and_read_async(message, priority, cancellable, callback) {
            const index = this.attempts;
            const result = results[index] || results[results.length - 1];
            const headers = message.request_headers;

            this.attempts++;
            this.userAgents.push(headers.get_one('User-Agent'));
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
        place_id: 123,
        lat: '50.0755',
        lon: '14.4378',
        display_name: 'Prague, Prague, Czechia',
        address: {
            city: 'Prague',
            country: 'Czechia',
        },
    };
}

function testBuildRequestUrl() {
    const url = ReverseGeocoder.buildRequestUrl({
        latitude: 50.0755,
        longitude: 14.4378,
    }, {
        language: 'en_US.UTF-8',
    });

    assertTrue(url.indexOf('https://nominatim.openstreetmap.org/reverse?') === 0,
        'request URL should use Nominatim reverse endpoint');
    assertTrue(url.indexOf('lat=50.0755') !== -1,
        'request URL should include latitude');
    assertTrue(url.indexOf('lon=14.4378') !== -1,
        'request URL should include longitude');
    assertTrue(url.indexOf('format=jsonv2') !== -1,
        'request URL should request JSON v2');
}

function testNormalResponse() {
    const result = ReverseGeocoder.parseNominatimResponse(normalPayload());

    assertEqual(result.provider, 'nominatim', 'provider id should be set');
    assertEqual(result.name, 'Prague, Czechia',
        'place name should combine city and country');
    assertEqual(result.primaryName, 'Prague',
        'primary name should come from city');
    assertEqual(result.country, 'Czechia', 'country should be preserved');
}

function testFallbackToDisplayName() {
    const payload = {
        display_name: 'Hradcany, Prague, Czechia',
        address: {},
    };
    const result = ReverseGeocoder.parseNominatimResponse(payload);

    assertEqual(result.name, 'Hradcany',
        'display name fallback should use first component');
}

function testMalformedJson() {
    assertThrows(() => ReverseGeocoder.parseNominatimJson('{'),
        'Invalid Nominatim JSON',
        'malformed JSON should throw');
}

function testMissingPlaceName() {
    assertThrows(() => ReverseGeocoder.parseNominatimResponse({
        address: {},
    }),
    'no usable place name',
    'response without usable name should throw');
}

function testProviderError() {
    assertThrows(() => ReverseGeocoder.parseNominatimResponse({
        error: 'Unable to geocode',
    }),
    'Nominatim error',
    'provider error should throw');
}

function testFetchPlaceNameAsyncSuccess() {
    const loop = GLib.MainLoop.new(null, false);
    const session = createMockSession([
        {
            bytes: bytesFromJson(normalPayload()),
            status: 200,
        },
    ]);
    let callbackError = null;
    let callbackPlace = null;

    ReverseGeocoder.fetchPlaceNameAsync({
        latitude: 50.0755,
        longitude: 14.4378,
    }, {
        session,
        timeoutSeconds: 7,
    }, (error, place) => {
        callbackError = error;
        callbackPlace = place;
        loop.quit();
    });

    runLoopWithTimeout(loop, 'reverse geocoder success callback timed out');

    assertEqual(callbackError, null, 'success callback should not receive error');
    assertEqual(callbackPlace.name, 'Prague, Czechia',
        'success callback should receive parsed place');
    assertEqual(session.timeout, 7, 'session timeout should be applied');
    assertTrue(session.userAgents[0].indexOf('AirAware') !== -1,
        'Nominatim request should include app user agent');
}

function testFetchPlaceNameAsyncRetriesTransientFailure() {
    const loop = GLib.MainLoop.new(null, false);
    const session = createMockSession([
        {
            bytes: bytesFromJson({
                error: 'rate limited',
            }),
            status: 503,
        },
        {
            bytes: bytesFromJson(normalPayload()),
            status: 200,
        },
    ]);
    let callbackError = null;
    let callbackPlace = null;

    ReverseGeocoder.fetchPlaceNameAsync({
        latitude: 50.0755,
        longitude: 14.4378,
    }, {
        session,
    }, (error, place) => {
        callbackError = error;
        callbackPlace = place;
        loop.quit();
    });

    runLoopWithTimeout(loop, 'reverse geocoder retry callback timed out');

    assertEqual(session.attempts, 2, 'transient HTTP failure should retry once');
    assertEqual(callbackError, null, 'retry success should not return error');
    assertEqual(callbackPlace.name, 'Prague, Czechia',
        'retry success should return parsed place');
}

function testFetchPlaceNameAsyncCancel() {
    const loop = GLib.MainLoop.new(null, false);
    const session = createMockSession([
        {
            bytes: bytesFromJson(normalPayload()),
            status: 200,
        },
    ]);
    let callbackError = null;
    let callbackPlace = null;
    const handle = ReverseGeocoder.fetchPlaceNameAsync({
        latitude: 50.0755,
        longitude: 14.4378,
    }, {
        session,
    }, (error, place) => {
        callbackError = error;
        callbackPlace = place;
        loop.quit();
    });

    handle.cancel();
    runLoopWithTimeout(loop, 'reverse geocoder cancel callback timed out');

    assertTrue(callbackError !== null,
        'cancel callback should receive an error');
    assertEqual(callbackPlace, null, 'cancel callback should not receive place');
}

function main() {
    const tests = [
        testBuildRequestUrl,
        testNormalResponse,
        testFallbackToDisplayName,
        testMalformedJson,
        testMissingPlaceName,
        testProviderError,
        testFetchPlaceNameAsyncSuccess,
        testFetchPlaceNameAsyncRetriesTransientFailure,
        testFetchPlaceNameAsyncCancel,
    ];

    for (const test of tests)
        test();

    print(`reverseGeocoder: ${tests.length} tests passed`);
}

main();
