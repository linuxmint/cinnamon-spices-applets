/* exported PROFILE_VERSION, FACTOR_IDS, DEFAULT_ENABLED_FACTORS,
 * normalizeProfile, profileFromSettings, profileFingerprint */

var PROFILE_VERSION = 1;
const Constants = imports.constants;

var PERSONALIZED_SCORING_FINGERPRINT_VERSION = 2;

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
    'uv_index',
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
    uv_index: false,
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
            uv_index: source.profileUvIndex === true,
        },
    });
};

/**
 * Build a stable local fingerprint for selected profile factors.
 *
 * The fingerprint identifies the local scoring model and selected factor set.
 * It is not sent to providers and does not include user-identifying data.
 *
 * @param {Object} profileInput - Normalized or profile-like settings data.
 * @returns {string} Stable fingerprint string.
 */
var profileFingerprint = function(profileInput = {}) {
    const profile = normalizeProfile(profileInput);
    const groupWeights = [
        `pollen=${Constants.PERSONALIZED_RISK_WEIGHTS.pollen}`,
        `regulatedPollution=${Constants.PERSONALIZED_RISK_WEIGHTS.regulatedPollution}`,
        `atmosphericContext=${Constants.PERSONALIZED_RISK_WEIGHTS.atmosphericContext}`,
        `mold=${Constants.PERSONALIZED_RISK_WEIGHTS.mold}`,
        `uv=${Constants.PERSONALIZED_RISK_WEIGHTS.uv}`,
    ].join(',');
    const contextWeights = [
        `carbonMonoxide=${Constants.ATMOSPHERIC_CONTEXT_WEIGHTS.carbonMonoxide}`,
        `aerosolOpticalDepth=${Constants.ATMOSPHERIC_CONTEXT_WEIGHTS.aerosolOpticalDepth}`,
        `dust=${Constants.ATMOSPHERIC_CONTEXT_WEIGHTS.dust}`,
        `wildfirePm10=${Constants.ATMOSPHERIC_CONTEXT_WEIGHTS.wildfirePm10}`,
    ].join(',');

    return `v${PROFILE_VERSION}:s${PERSONALIZED_SCORING_FINGERPRINT_VERSION}:` +
        `f=${profile.selectedFactorIds.join(',')}:gw=${groupWeights}:cw=${contextWeights}`;
};
