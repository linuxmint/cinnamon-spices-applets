/* exported calculatePersonalizedRisk */

const Profile = imports.personalAllergyProfile;
const RiskCalculator = imports.riskCalculator;

const FACTOR_DEFINITIONS = Object.freeze({
    pollen_alder: Object.freeze({
        group: 'pollen',
        field: 'alder',
    }),
    pollen_birch: Object.freeze({
        group: 'pollen',
        field: 'birch',
    }),
    pollen_grass: Object.freeze({
        group: 'pollen',
        field: 'grass',
    }),
    pollen_mugwort: Object.freeze({
        group: 'pollen',
        field: 'mugwort',
    }),
    pollen_olive: Object.freeze({
        group: 'pollen',
        field: 'olive',
    }),
    pollen_ragweed: Object.freeze({
        group: 'pollen',
        field: 'ragweed',
    }),
    mold: Object.freeze({
        group: 'mold',
        field: 'mold',
    }),
    pm2_5: Object.freeze({
        group: 'regulatedPollution',
        field: 'pm25',
    }),
    pm10: Object.freeze({
        group: 'regulatedPollution',
        field: 'pm10',
    }),
    nitrogen_dioxide: Object.freeze({
        group: 'regulatedPollution',
        field: 'nitrogenDioxide',
    }),
    ozone: Object.freeze({
        group: 'regulatedPollution',
        field: 'ozone',
    }),
    sulphur_dioxide: Object.freeze({
        group: 'regulatedPollution',
        field: 'sulfurDioxide',
    }),
    dust: Object.freeze({
        group: 'atmosphericContext',
        field: 'dust',
    }),
    wildfire_pm10: Object.freeze({
        group: 'atmosphericContext',
        field: 'wildfirePm10',
    }),
});

function _isFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
}

function _clampScore(score) {
    if (!_isFiniteNumber(score))
        return null;

    return Math.max(0, Math.min(100, score));
}

function _unavailableResult(reason, profile, factors = []) {
    const selectedFactorCount = profile && Array.isArray(profile.selectedFactorIds)
        ? profile.selectedFactorIds.length
        : 0;

    return {
        available: false,
        reason,
        score: null,
        displayScore: null,
        category: null,
        selectedFactorCount,
        availableFactorCount: 0,
        missingFactorCount: selectedFactorCount,
        factors,
        contributors: [],
        calculation: {
            method: 'equal_available_factor_weighting',
            renormalized: false,
        },
    };
}

function _factorBurden(factorId, input, moldPotential) {
    const definition = FACTOR_DEFINITIONS[factorId];

    if (!definition)
        return null;

    if (definition.group === 'pollen')
        return RiskCalculator.calculatePollenBurden(input, definition.field);

    if (definition.group === 'regulatedPollution')
        return RiskCalculator.calculateRegulatedPollutantBurden(input, definition.field);

    if (definition.group === 'atmosphericContext')
        return RiskCalculator.calculateAtmosphericContextBurden(input, definition.field);

    if (definition.group === 'mold')
        return RiskCalculator.calculateMoldBurden(moldPotential);

    return null;
}

/**
 * Calculate personalized environmental risk from selected profile factors.
 *
 * Disabled and unavailable factors are omitted from the equal-weighted score.
 * Missing data is never treated as zero.
 *
 * @param {Object} input - Current or forecast environmental data.
 * @param {Object|null} moldPotential - Mold-potential result.
 * @param {Object} profileInput - Normalized or profile-like settings data.
 * @returns {Object} Personalized risk result.
 */
var calculatePersonalizedRisk = function(input, moldPotential, profileInput) {
    const profile = Profile.normalizeProfile(profileInput);

    if (!profile.enabled)
        return _unavailableResult('personalization_disabled', profile);

    if (profile.selectedFactorIds.length === 0)
        return _unavailableResult('no_factors_selected', profile);

    let factors = [];
    let availableFactors = [];

    for (const factorId of Profile.FACTOR_IDS) {
        const selected = profile.enabledFactors[factorId] === true;

        if (!selected)
            continue;

        const burden = _factorBurden(factorId, input, moldPotential);
        const available = burden !== null &&
            burden.available === true &&
            _isFiniteNumber(burden.burden);
        const factor = {
            id: factorId,
            selected: true,
            available,
            burden: available ? _clampScore(burden.burden) : null,
            value: available ? burden.value : null,
            unit: available ? burden.unit : null,
            source: burden && typeof burden.source === 'string'
                ? burden.source
                : null,
            category: available ? burden.category : null,
        };

        factors.push(factor);

        if (available)
            availableFactors.push(factor);
    }

    if (availableFactors.length === 0)
        return _unavailableResult('no_available_factors', profile, factors);

    const total = availableFactors.reduce((sum, factor) => sum + factor.burden, 0);
    const score = _clampScore(total / availableFactors.length);
    const displayScore = Math.round(score);
    const missingFactorCount = factors.length - availableFactors.length;
    const contributors = availableFactors.slice().sort((left, right) => {
        if (right.burden !== left.burden)
            return right.burden - left.burden;

        return Profile.FACTOR_IDS.indexOf(left.id) - Profile.FACTOR_IDS.indexOf(right.id);
    });

    return {
        available: true,
        reason: null,
        score,
        displayScore,
        category: RiskCalculator.categoryFromScore(score),
        selectedFactorCount: factors.length,
        availableFactorCount: availableFactors.length,
        missingFactorCount,
        factors,
        contributors,
        calculation: {
            method: 'equal_available_factor_weighting',
            renormalized: missingFactorCount > 0,
        },
    };
};
