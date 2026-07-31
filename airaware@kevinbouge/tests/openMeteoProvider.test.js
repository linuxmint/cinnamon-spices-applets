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
        urls: [],

        send_and_read_async(message, priority, cancellable, callback) {
            const index = this.attempts;
            const result = results[index] || results[results.length - 1];

            this.attempts++;
            this.urls.push(message.get_uri().to_string());
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
        generationtime_ms: 1.23,
        current_units: {
            pm10: 'µg/m³',
            pm2_5: 'µg/m³',
            european_aqi: 'European AQI',
        },
        hourly_units: {
            pm10: 'µg/m³',
            pm2_5: 'µg/m³',
            european_aqi: 'European AQI',
        },
        current: {
            time: '2026-07-30T12:00',
            pm10: 18,
            pm2_5: 7.5,
            nitrogen_dioxide: 22,
            ozone: 64,
            sulphur_dioxide: 12,
            dust: 3,
            aerosol_optical_depth: 0.18,
            carbon_monoxide: 130,
            european_aqi: 42,
            european_aqi_pm2_5: 18,
            european_aqi_pm10: 19,
            european_aqi_nitrogen_dioxide: 12,
            european_aqi_ozone: 42,
            european_aqi_sulphur_dioxide: 8,
            us_aqi: 55,
            us_aqi_pm2_5: 32,
            us_aqi_pm10: 18,
            us_aqi_nitrogen_dioxide: 9,
            us_aqi_ozone: 55,
            us_aqi_sulphur_dioxide: 6,
            alder_pollen: 4,
            birch_pollen: 28,
            olive_pollen: 8,
            grass_pollen: 34,
            mugwort_pollen: 2,
            ragweed_pollen: 19,
            pm10_wildfires: 1.2,
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
            sulphur_dioxide: [5, 12, 18, 24, 8],
            dust: [1, 3, 2, 8, 3],
            aerosol_optical_depth: [0.1, 0.18, 0.2, 0.25, 0.12],
            carbon_monoxide: [110, 130, 140, 160, 120],
            european_aqi: [20, 42, 28, 38, 22],
            european_aqi_pm2_5: [10, 18, 20, 24, 16],
            european_aqi_pm10: [11, 19, 24, 28, 18],
            european_aqi_nitrogen_dioxide: [8, 12, 10, 15, 9],
            european_aqi_ozone: [20, 42, 28, 38, 22],
            european_aqi_sulphur_dioxide: [4, 8, 10, 13, 6],
            us_aqi: [24, 55, 38, 50, 30],
            us_aqi_pm2_5: [18, 32, 36, 40, 22],
            us_aqi_pm10: [10, 18, 25, 30, 20],
            us_aqi_nitrogen_dioxide: [6, 9, 8, 11, 7],
            us_aqi_ozone: [24, 55, 38, 50, 30],
            us_aqi_sulphur_dioxide: [3, 6, 8, 10, 4],
            alder_pollen: [1, 4, 3, 2, 1],
            birch_pollen: [20, 28, 18, 14, 10],
            olive_pollen: [5, 8, 6, 5, 3],
            grass_pollen: [24, 34, 40, 45, 28],
            mugwort_pollen: [1, 2, 4, 5, 2],
            ragweed_pollen: [8, 19, 20, 25, 10],
            pm10_wildfires: [0.5, 1.2, 0.8, 1.7, 0.4],
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
    assertTrue(url.indexOf('aerosol_optical_depth') !== -1,
        'request URL should include aerosol optical depth');
    assertTrue(url.indexOf('carbon_monoxide') !== -1,
        'request URL should include carbon monoxide');
    assertTrue(url.indexOf('sulphur_dioxide') !== -1,
        'request URL should include sulfur dioxide');
    assertTrue(url.indexOf('hourly=') !== -1,
        'request URL should request hourly forecast values');
    assertTrue(url.indexOf('forecast_days=4') !== -1,
        'request URL should include forecast days');
    assertTrue(url.indexOf('timezone=auto') !== -1,
        'request URL should use provider-local timezone');
    assertTrue(url.indexOf('european_aqi_pm2_5') !== -1,
        'request URL should include pollutant-specific European AQI');
    assertTrue(url.indexOf('us_aqi_pm2_5') !== -1,
        'request URL should include pollutant-specific US AQI');
    assertTrue(url.indexOf('pm10_wildfires') !== -1,
        'request URL should include optional wildfire PM10');
}

function testBuildRequestUrlCanExcludeOptionalVariables() {
    const url = OpenMeteoProvider.buildRequestUrl({
        latitude: 50.08,
        longitude: 14.44,
    }, {
        includeOptionalVariables: false,
    });

    assertTrue(url.indexOf('pm10_wildfires') === -1,
        'request URL should omit optional wildfire PM10 when disabled');
    assertTrue(url.indexOf('pm2_5') !== -1,
        'request URL should keep required pollutant fields when optional variables are disabled');
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
    assertEqual(result.metadata.timezoneAbbreviation, 'CEST',
        'timezone abbreviation should be preserved');
    assertEqual(result.metadata.generationTimeMs, 1.23,
        'generation time should be preserved');
    assertEqual(result.metadata.units.current.pm10, 'µg/m³',
        'current unit metadata should be preserved');
    assertEqual(result.current.timestamp, '2026-07-30T12:00',
        'current timestamp should use Open-Meteo current object');
    assertEqual(result.current.readings.treePollen, 28,
        'tree pollen should use highest tree source');
    assertEqual(result.current.pollen.alder, 4,
        'individual alder pollen should be preserved');
    assertEqual(result.current.pollen.birch, 28,
        'individual birch pollen should be preserved');
    assertEqual(result.current.pollen.olive, 8,
        'individual olive pollen should be preserved');
    assertEqual(result.current.pollen.mugwort, 2,
        'individual mugwort pollen should be preserved');
    assertEqual(result.current.pollen.ragweed, 19,
        'individual ragweed pollen should be preserved');
    assertEqual(result.current.readings.grassPollen, 34,
        'grass pollen should map directly');
    assertEqual(result.current.readings.weedPollen, 19,
        'weed pollen should use highest weed source');
    assertEqual(result.current.readings.pm25, 7.5,
        'PM2.5 should map from Open-Meteo pm2_5');
    assertEqual(result.current.readings.aerosolOpticalDepth, 0.18,
        'aerosol optical depth should map directly');
    assertEqual(result.current.readings.carbonMonoxide, 130,
        'carbon monoxide should map directly');
    assertEqual(result.current.readings.sulfurDioxide, 12,
        'sulfur dioxide should map from Open-Meteo sulphur_dioxide');
    assertEqual(result.current.rawPollutants.sulfurDioxide, 12,
        'raw pollutant structure should include sulfur dioxide');
    assertEqual(result.current.pollutantAqi.ozone, 42,
        'European coordinates should select European pollutant-specific AQI');
    assertEqual(result.current.europeanPollutantAqi.ozone, 42,
        'European pollutant-specific AQI should be preserved');
    assertEqual(result.current.usPollutantAqi.ozone, 55,
        'US pollutant-specific AQI should be preserved');
    assertEqual(result.current.pollutantAqiSource, 'european-aqi',
        'European coordinates should expose European AQI source');
    assertEqual(result.current.pollutantAqiLabel, 'EU AQI',
        'European coordinates should expose compact EU AQI label');
    assertEqual(result.current.overallEuropeanAqi, 42,
        'overall European AQI should be parsed for display/diagnostics');
    assertEqual(result.current.overallUsAqi, 55,
        'overall US AQI should be parsed for display/diagnostics');
    assertEqual(result.current.overallAqi, 42,
        'selected overall AQI should follow the selected source');
    assertEqual(result.current.context.wildfirePm10, 1.2,
        'optional wildfire PM10 should be parsed when present');
    assertEqual(result.hourly.timestamps.length, 5,
        'hourly timestamps should be preserved');
    assertEqual(result.hourly.pollutantAqi.pm10[3], 28,
        'hourly selected pollutant AQI arrays should be preserved');
    assertEqual(result.hourly.usPollutantAqi.pm10[3], 30,
        'hourly US pollutant AQI arrays should be preserved');
    assertEqual(result.forecast.length, 3,
        'forecast should contain requested number of days');
    assertEqual(result.forecast[1].readings.grassPollen, 45,
        'daily forecast should use max hourly value for the day');
    assertEqual(result.forecast[1].readings.carbonMonoxide, 160,
        'daily forecast should use max hourly carbon monoxide value for the day');
    assertEqual(result.forecast[1].readings.sulfurDioxide, 24,
        'daily forecast should use max hourly sulfur dioxide value for the day');
    assertEqual(result.forecast[1].pollutantAqi.ozone, 38,
        'daily forecast should use max hourly pollutant AQI value for the day');
    assertEqual(result.isPartial, false,
        'complete response should not be partial');
}

function testUsCoordinatesSelectUsAqi() {
    const payload = normalPayload();

    payload.latitude = 39.76;
    payload.longitude = -104.99;

    const result = OpenMeteoProvider.parseOpenMeteoResponse(payload, {
        forecastDays: 2,
    });

    assertEqual(result.pollutantAqiSource, 'us-aqi',
        'US coordinates should select US AQI');
    assertEqual(result.current.pollutantAqiSource, 'us-aqi',
        'current result should expose US AQI source');
    assertEqual(result.current.pollutantAqiLabel, 'US AQI',
        'current result should expose US AQI label');
    assertEqual(result.current.pollutantAqi.ozone, 55,
        'current selected pollutant AQI should use US AQI values');
    assertEqual(result.current.europeanPollutantAqi.ozone, 42,
        'European AQI values should remain available for diagnostics');
    assertEqual(result.current.overallAqi, 55,
        'selected overall AQI should use US AQI for US coordinates');
    assertEqual(result.forecast[1].pollutantAqi.pm25, 40,
        'forecast selected pollutant AQI should use max hourly US AQI values');
    assertEqual(result.forecast[1].pollutantAqiSource, 'us-aqi',
        'forecast result should expose US AQI source');
}

function testMexicoCoordinatesDoNotSelectUsAqi() {
    const payload = normalPayload();

    payload.latitude = 19.43;
    payload.longitude = -99.13;

    const result = OpenMeteoProvider.parseOpenMeteoResponse(payload, {
        forecastDays: 1,
    });

    assertEqual(result.pollutantAqiSource, 'european-aqi',
        'Mexico coordinates should not automatically select US AQI');
    assertEqual(result.current.pollutantAqi.ozone, 42,
        'Mexico fallback should use European AQI when no local AQI is selected');
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
    assertTrue(result.current.missingFields.indexOf('alder') !== -1,
        'alder pollen should be listed as missing');
    assertTrue(result.current.missingFields.indexOf('birch') !== -1,
        'birch pollen should be listed as missing');
    assertTrue(result.current.missingFields.indexOf('grass') !== -1,
        'grass pollen should be listed as missing');
    assertTrue(result.current.missingFields.indexOf('mugwort') !== -1,
        'mugwort pollen should be listed as missing');
    assertTrue(result.current.missingFields.indexOf('ragweed') !== -1,
        'ragweed pollen should be listed as missing');
    assertEqual(result.current.readings.pm10, 18,
        'pollution values should remain usable when pollen is missing');
    assertEqual(result.isPartial, true,
        'missing pollen should mark result partial');
}

function testMissingAtmosphericIrritantsRemainPartial() {
    const payload = normalPayload();
    delete payload.current.aerosol_optical_depth;
    delete payload.current.carbon_monoxide;
    delete payload.current.sulphur_dioxide;
    delete payload.current.pm10_wildfires;
    delete payload.hourly.aerosol_optical_depth;
    delete payload.hourly.carbon_monoxide;
    delete payload.hourly.sulphur_dioxide;
    delete payload.hourly.pm10_wildfires;

    const result = OpenMeteoProvider.parseOpenMeteoResponse(payload, {
        forecastDays: 2,
    });

    assertEqual(result.current.readings.aerosolOpticalDepth, null,
        'missing aerosol optical depth should be null');
    assertEqual(result.current.readings.carbonMonoxide, null,
        'missing carbon monoxide should be null');
    assertEqual(result.current.readings.sulfurDioxide, null,
        'missing sulfur dioxide should be null');
    assertEqual(result.current.context.wildfirePm10, null,
        'missing optional wildfire PM10 should be null');
    assertTrue(result.current.missingFields.indexOf('aerosolOpticalDepth') !== -1,
        'missing aerosol optical depth should be tracked');
    assertTrue(result.current.missingFields.indexOf('carbonMonoxide') !== -1,
        'missing carbon monoxide should be tracked');
    assertTrue(result.current.missingFields.indexOf('sulfurDioxide') !== -1,
        'missing sulfur dioxide should be tracked');
    assertEqual(result.current.readings.pm10, 18,
        'existing pollutant readings should remain usable');
    assertEqual(result.isPartial, true,
        'missing new atmospheric variables should mark result partial');
}

function testMalformedAtmosphericValuesNormalizeToNull() {
    const payload = normalPayload();
    payload.current.aerosol_optical_depth = 'bad';
    payload.current.carbon_monoxide = Number.NaN;
    payload.current.sulphur_dioxide = 'bad';
    payload.current.pm10_wildfires = 'bad';
    payload.hourly.aerosol_optical_depth = ['bad', null, undefined];
    payload.hourly.carbon_monoxide = [Number.NaN, 'bad', null];
    payload.hourly.sulphur_dioxide = [undefined, 'bad', null];
    payload.hourly.pm10_wildfires = ['bad', null, undefined];

    const result = OpenMeteoProvider.parseOpenMeteoResponse(payload, {
        forecastDays: 1,
    });

    assertEqual(result.current.readings.aerosolOpticalDepth, null,
        'malformed aerosol optical depth should be null');
    assertEqual(result.current.readings.carbonMonoxide, null,
        'malformed carbon monoxide should be null');
    assertEqual(result.current.readings.sulfurDioxide, null,
        'malformed sulfur dioxide should be null');
    assertEqual(result.current.context.wildfirePm10, null,
        'malformed wildfire PM10 should be null');
    assertEqual(result.forecast[0].readings.aerosolOpticalDepth, null,
        'malformed forecast aerosol optical depth should be null');
    assertEqual(result.forecast[0].readings.carbonMonoxide, null,
        'malformed forecast carbon monoxide should be null');
    assertEqual(result.forecast[0].readings.sulfurDioxide, null,
        'malformed forecast sulfur dioxide should be null');
    assertEqual(result.current.readings.pm25, 7.5,
        'valid existing readings should remain usable');
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

function testFetchRetriesWithoutOptionalVariables() {
    const loop = new GLib.MainLoop(null, false);
    const session = createMockSession([
        {
            status: 400,
            bytes: bytesFromJson({
                error: true,
                reason: 'Variable pm10_wildfires is not valid',
            }),
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
                'optional-variable rejection should retry without optional variables');
            assertEqual(data.provider, 'open-meteo',
                'optional-variable fallback should parse successful response');
            assertEqual(session.attempts, 2,
                'optional-variable rejection should issue one fallback request');
            assertTrue(session.urls[0].indexOf('pm10_wildfires') !== -1,
                'initial request should include optional wildfire PM10');
            assertTrue(session.urls[1].indexOf('pm10_wildfires') === -1,
                'fallback request should omit optional wildfire PM10');
        } catch (error) {
            callbackError = error;
        }

        loop.quit();
    });

    if (!callbackCalled)
        runLoopWithTimeout(loop, 'optional-variable fallback test timed out');

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
            assertEqual(session.attempts, 2,
                'HTTP 400 should be retried once without optional variables before failing');
            assertTrue(session.urls[1].indexOf('pm10_wildfires') === -1,
                'HTTP 400 fallback should omit optional wildfire PM10');
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
        testBuildRequestUrlCanExcludeOptionalVariables,
        testBuildRequestUrlNormalizesForecastDays,
        testNormalApiResponse,
        testUsCoordinatesSelectUsAqi,
        testMexicoCoordinatesDoNotSelectUsAqi,
        testMissingPollen,
        testMissingAtmosphericIrritantsRemainPartial,
        testMalformedAtmosphericValuesNormalizeToNull,
        testMalformedResponse,
        testInvalidResponseCoordinatesAreDropped,
        testNoUsableCurrentReadingsThrows,
        testFetchInvalidCoordinatesReportsCallbackError,
        testFetchRetriesTransportFailureOnce,
        testFetchCancelCompletesCallback,
        testFetchRetriesTransientHttpStatusOnce,
        testFetchRetriesWithoutOptionalVariables,
        testFetchDoesNotRetryClientHttpStatus,
    ];

    for (const test of tests)
        test();

    print(`openMeteoProvider: ${tests.length} tests passed`);
}

main();
