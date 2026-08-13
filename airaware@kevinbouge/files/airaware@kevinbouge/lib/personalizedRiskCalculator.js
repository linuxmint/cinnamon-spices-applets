/* exported calculatePersonalizedRisk */

const Constants = imports.constants;
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
    carbon_monoxide: Object.freeze({
        group: 'atmosphericContext',
        field: 'carbonMonoxide',
    }),
    aerosol_optical_depth: Object.freeze({
        group: 'atmosphericContext',
        field: 'aerosolOpticalDepth',
    }),
    dust: Object.freeze({
        group: 'atmosphericContext',
        field: 'dust',
    }),
    wildfire_pm10: Object.freeze({
        group: 'atmosphericContext',
        field: 'wildfirePm10',
    }),
    uv_index: Object.freeze({
        group: 'uv',
        field: 'uvIndex',
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
            method: 'selected_group_weighting',
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

    if (definition.group === 'uv')
        return RiskCalculator.calculateUvBurden(input ? input.uvIndex : null);

    return null;
}

function _highestGroupResult(name, factors) {
    let dominant = null;

    for (const factor of factors) {
        if (!factor.available)
            continue;

        if (dominant === null || factor.burden > dominant.score) {
            dominant = {
                id: factor.id,
                field: factor.field,
                score: factor.burden,
                category: factor.category,
            };
        }
    }

    if (dominant === null)
        return null;

    return {
        name,
        score: dominant.score,
        category: dominant.category,
        dominant,
    };
}

function _regulatedGroupResult(factors) {
    const aqiFactors = factors.filter(factor =>
        factor.available &&
        factor.source !== 'raw-concentration-fallback'
    );

    if (aqiFactors.length > 0)
        return _highestGroupResult('regulatedPollution', aqiFactors);

    return _highestGroupResult('regulatedPollution', factors);
}

function _atmosphericContextGroupResult(factors) {
    let weightedScore = 0;
    let availableWeight = 0;
    let effectiveWeights = {};

    for (const factor of factors) {
        const weight = Constants.ATMOSPHERIC_CONTEXT_WEIGHTS[factor.field] || 0;

        if (!factor.available || weight <= 0) {
            effectiveWeights[factor.field] = 0;
            continue;
        }

        weightedScore += factor.burden * weight;
        availableWeight += weight;
    }

    if (availableWeight <= 0)
        return null;

    for (const factor of factors) {
        const weight = Constants.ATMOSPHERIC_CONTEXT_WEIGHTS[factor.field] || 0;
        effectiveWeights[factor.field] = factor.available && weight > 0
            ? weight / availableWeight
            : 0;
    }

    const score = _clampScore(weightedScore / availableWeight);

    return {
        name: 'atmosphericContext',
        score,
        category: RiskCalculator.categoryFromScore(score),
        effectiveWeights,
    };
}

function _groupResult(name, factors) {
    if (name === 'pollen')
        return _highestGroupResult(name, factors);

    if (name === 'regulatedPollution')
        return _regulatedGroupResult(factors);

    if (name === 'atmosphericContext')
        return _atmosphericContextGroupResult(factors);

    if (name === 'mold')
        return _highestGroupResult(name, factors);

    if (name === 'uv')
        return _highestGroupResult(name, factors);

    return null;
}

function _groupWeight(name) {
    return Constants.PERSONALIZED_RISK_WEIGHTS[name] || 0;
}

function _calculateGroupedScore(factors) {
    const groupNames = ['pollen', 'regulatedPollution', 'atmosphericContext', 'mold', 'uv'];
    let weightedScore = 0;
    let availableWeight = 0;
    let configuredSelectedWeight = 0;
    let groups = {};
    let effectiveWeights = {};

    for (const name of groupNames) {
        const selectedFactors = factors.filter(factor => factor.group === name);

        if (selectedFactors.length === 0) {
            effectiveWeights[name] = 0;
            continue;
        }

        const weight = _groupWeight(name);
        configuredSelectedWeight += weight;
        const result = _groupResult(name, selectedFactors);

        groups[name] = result;

        if (result === null) {
            effectiveWeights[name] = 0;
            continue;
        }

        weightedScore += result.score * weight;
        availableWeight += weight;
    }

    if (availableWeight <= 0)
        return null;

    for (const name of groupNames)
        effectiveWeights[name] = groups[name] === null || groups[name] === undefined
            ? 0
            : _groupWeight(name) / availableWeight;

    return {
        score: _clampScore(weightedScore / availableWeight),
        groups,
        effectiveWeights,
        selectedGroupCount: groupNames.filter(name =>
            factors.some(factor => factor.group === name)
        ).length,
        availableGroupCount: groupNames.filter(name =>
            groups[name] !== null && groups[name] !== undefined
        ).length,
        renormalized: availableWeight < configuredSelectedWeight ||
            configuredSelectedWeight < 1,
    };
}

/**
 * Calculate personalized environmental risk from selected profile factors.
 *
 * Disabled factors are omitted. Available selected factors are combined with
 * the same group model as the environmental burden score, then renormalized
 * when selected groups or provider values are unavailable. Missing data is
 * never treated as zero.
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

        const definition = FACTOR_DEFINITIONS[factorId];
        const burden = _factorBurden(factorId, input, moldPotential);
        const available = burden !== null &&
            burden.available === true &&
            _isFiniteNumber(burden.burden);
        const factor = {
            id: factorId,
            selected: true,
            available,
            group: definition.group,
            field: definition.field,
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

    const calculation = _calculateGroupedScore(factors);

    if (calculation === null)
        return _unavailableResult('no_available_factors', profile, factors);

    const score = calculation.score;
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
        selectedGroupCount: calculation.selectedGroupCount,
        availableGroupCount: calculation.availableGroupCount,
        groupCompleteness: calculation.selectedGroupCount > 0
            ? calculation.availableGroupCount / calculation.selectedGroupCount
            : 0,
        factors,
        contributors,
        calculation: {
            method: 'selected_group_weighting',
            renormalized: missingFactorCount > 0 || calculation.renormalized,
            effectiveWeights: calculation.effectiveWeights,
            groups: calculation.groups,
        },
    };
};
