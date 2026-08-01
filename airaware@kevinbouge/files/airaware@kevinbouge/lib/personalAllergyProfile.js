/* exported PROFILE_VERSION, FACTOR_IDS, DEFAULT_ENABLED_FACTORS,
 * normalizeProfile, profileFromSettings */

var PROFILE_VERSION = 1;

var FACTOR_IDS = Object.freeze([
    'pollen_alder',
    'pollen_birch',
    'pollen_grass',
    'pollen_mugwort',
    'pollen_olive',
    'pollen_ragweed',
    'mold',
    'pm2_5',
    'pm10',
    'nitrogen_dioxide',
    'ozone',
    'sulphur_dioxide',
    'carbon_monoxide',
    'aerosol_optical_depth',
    'dust',
    'wildfire_pm10',
]);

var DEFAULT_ENABLED_FACTORS = Object.freeze({
    pollen_alder: true,
    pollen_birch: true,
    pollen_grass: true,
    pollen_mugwort: true,
    pollen_olive: true,
    pollen_ragweed: true,
    mold: true,
    pm2_5: true,
    pm10: true,
    nitrogen_dioxide: true,
    ozone: true,
    sulphur_dioxide: true,
    carbon_monoxide: true,
    aerosol_optical_depth: true,
    dust: true,
    wildfire_pm10: true,
});

function _isObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function _copyEnabledFactors(values) {
    let result = {};

    for (const id of FACTOR_IDS)
        result[id] = _isObject(values) && typeof values[id] === 'boolean'
            ? values[id]
            : DEFAULT_ENABLED_FACTORS[id];

    return result;
}

/**
 * Normalize profile-like input into the current Personal Allergy Profile shape.
 *
 * Unknown factor ids are ignored. Invalid values are restored to defaults.
 *
 * @param {Object} input - Profile-like settings data.
 * @returns {Object} Normalized profile.
 */
var normalizeProfile = function(input = {}) {
    const source = _isObject(input) ? input : {};
    const enabledFactors = _copyEnabledFactors(source.enabledFactors);

    return {
        version: PROFILE_VERSION,
        enabled: source.enabled === true,
        enabledFactors,
        selectedFactorIds: FACTOR_IDS.filter(id => enabledFactors[id] === true),
    };
};

/**
 * Build a normalized profile from individual Cinnamon settings values.
 *
 * @param {Object} settings - Settings-derived values.
 * @returns {Object} Normalized profile.
 */
var profileFromSettings = function(settings = {}) {
    const source = _isObject(settings) ? settings : {};

    return normalizeProfile({
        version: PROFILE_VERSION,
        enabled: source.enablePersonalizedRisk === true,
        enabledFactors: {
            pollen_alder: source.profilePollenAlder !== false,
            pollen_birch: source.profilePollenBirch !== false,
            pollen_grass: source.profilePollenGrass !== false,
            pollen_mugwort: source.profilePollenMugwort !== false,
            pollen_olive: source.profilePollenOlive !== false,
            pollen_ragweed: source.profilePollenRagweed !== false,
            mold: source.profileMold !== false,
            pm2_5: source.profilePm25 !== false,
            pm10: source.profilePm10 !== false,
            nitrogen_dioxide: source.profileNitrogenDioxide !== false,
            ozone: source.profileOzone !== false,
            sulphur_dioxide: source.profileSulphurDioxide !== false,
            carbon_monoxide: source.profileCarbonMonoxide !== false,
            aerosol_optical_depth: source.profileAerosolOpticalDepth !== false,
            dust: source.profileDust !== false,
            wildfire_pm10: source.profileWildfirePm10 !== false,
        },
    });
};
