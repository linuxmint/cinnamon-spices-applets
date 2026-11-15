#!/usr/bin/env gjs
/* exported main */

imports.searchPath.unshift('lib');

const Profile = imports.personalAllergyProfile;

function assertEqual(actual, expected, message) {
    if (actual !== expected)
        throw new Error(`${message}: expected ${expected}, got ${actual}`);
}

function assertTrue(condition, message) {
    if (!condition)
        throw new Error(message);
}

function testDefaultProfile() {
    const profile = Profile.normalizeProfile();

    assertEqual(profile.version, 1, 'profile schema version should be current');
    assertEqual(profile.enabled, false, 'personalization should default disabled');
    assertEqual(profile.enabledFactors.uv_index, false,
        'UV should default disabled because it is not an allergy trigger');
    assertEqual(profile.selectedFactorIds.length, Profile.FACTOR_IDS.length - 1,
        'all non-UV factors should default selected behind the disabled master switch');
}

function testEnabledSettingsProfile() {
    const profile = Profile.profileFromSettings({
        enablePersonalizedRisk: true,
    });

    assertEqual(profile.enabled, true,
        'settings master switch should enable personalization');
    assertEqual(profile.enabledFactors.pollen_grass, true,
        'profile pollen factors should default enabled');
    assertEqual(profile.enabledFactors.wildfire_pm10, true,
        'profile optional context should default enabled');
    assertEqual(profile.enabledFactors.uv_index, false,
        'UV should remain opt-in when personalization is enabled');
}

function testUvEnabledAndFingerprint() {
    const disabled = Profile.profileFromSettings({
        enablePersonalizedRisk: true,
    });
    const enabled = Profile.profileFromSettings({
        enablePersonalizedRisk: true,
        profileUvIndex: true,
    });

    assertEqual(enabled.enabledFactors.uv_index, true,
        'UV setting should enable the UV factor');
    assertTrue(
        Profile.profileFingerprint(disabled) !== Profile.profileFingerprint(enabled),
        'profile fingerprint should change when UV selection changes'
    );
    assertTrue(
        Profile.profileFingerprint(enabled).indexOf(':gw=') !== -1,
        'profile fingerprint should include scoring weight configuration'
    );
}

function testOneFactorEnabled() {
    let enabledFactors = {};

    for (const id of Profile.FACTOR_IDS)
        enabledFactors[id] = false;

    enabledFactors.pollen_grass = true;

    const profile = Profile.normalizeProfile({
        enabled: true,
        enabledFactors,
    });

    assertEqual(profile.selectedFactorIds.length, 1,
        'one enabled factor should produce one selected id');
    assertEqual(profile.selectedFactorIds[0], 'pollen_grass',
        'selected id should be preserved');
}

function testNoFactorsEnabled() {
    let enabledFactors = {};

    for (const id of Profile.FACTOR_IDS)
        enabledFactors[id] = false;

    const profile = Profile.normalizeProfile({
        enabled: true,
        enabledFactors,
    });

    assertEqual(profile.selectedFactorIds.length, 0,
        'empty profile should be representable');
}

function testInvalidValuesAndUnknownIds() {
    const profile = Profile.normalizeProfile({
        enabled: 'yes',
        version: 99,
        enabledFactors: {
            pollen_grass: false,
            pollen_birch: 'bad',
            unknown_factor: true,
        },
    });

    assertEqual(profile.enabled, false,
        'invalid enabled value should restore disabled default');
    assertEqual(profile.version, 1,
        'invalid or future version should normalize to current schema');
    assertEqual(profile.enabledFactors.pollen_grass, false,
        'valid false factor should be preserved');
    assertEqual(profile.enabledFactors.pollen_birch, true,
        'invalid factor value should restore default');
    assertEqual(Object.prototype.hasOwnProperty.call(profile.enabledFactors, 'unknown_factor'), false,
        'unknown factor ids should be ignored');
}

function testSettingsBooleansAreIndependent() {
    const first = Profile.profileFromSettings({
        enablePersonalizedRisk: true,
        profilePollenGrass: true,
    });
    const second = Profile.profileFromSettings({
        enablePersonalizedRisk: true,
        profilePollenGrass: false,
    });

    assertEqual(first.enabledFactors.pollen_grass, true,
        'first settings object should keep its own value');
    assertEqual(second.enabledFactors.pollen_grass, false,
        'second settings object should keep its own value');
    first.enabledFactors.pollen_grass = false;
    assertEqual(second.enabledFactors.pollen_grass, false,
        'profile objects should not share mutable factor maps');
    assertTrue(first !== second, 'profile objects should be distinct per instance');
}

function main() {
    const tests = [
        testDefaultProfile,
        testEnabledSettingsProfile,
        testUvEnabledAndFingerprint,
        testOneFactorEnabled,
        testNoFactorsEnabled,
        testInvalidValuesAndUnknownIds,
        testSettingsBooleansAreIndependent,
    ];

    for (const test of tests)
        test();

    print(`personalAllergyProfile: ${tests.length} tests passed`);
}

main();
