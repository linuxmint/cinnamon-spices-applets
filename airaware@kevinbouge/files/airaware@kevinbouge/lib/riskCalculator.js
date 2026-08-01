/* exported calculateRisk, classifyValue, categoryFromScore,
 * calculatePollenScore, calculateRegulatedPollutionScore,
 * calculateAtmosphericIrritantsScore, calculatePollenBurden,
 * calculateRegulatedPollutantBurden, calculateAtmosphericContextBurden,
 * calculateMoldBurden */

const Constants = imports.constants;

const POLLEN_FIELDS = ['alder', 'birch', 'grass', 'mugwort', 'olive', 'ragweed'];
const RAW_REGULATED_FIELDS = ['pm25', 'pm10', 'nitrogenDioxide', 'ozone', 'sulfurDioxide'];
const ATMOSPHERIC_CONTEXT_FIELDS = [
    'carbonMonoxide',
    'aerosolOpticalDepth',
    'dust',
    'wildfirePm10',
];

function _isFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
}

function _sanitizeValue(value) {
    if (!_isFiniteNumber(value))
        return null;

    return Math.max(0, value);
}

function _clampScore(score) {
    if (!_isFiniteNumber(score))
        return null;

    return Math.max(0, Math.min(100, Math.round(score)));
}

function _copyLevel(level) {
    return {
        id: level.id,
        label: level.label,
        minScore: level.minScore,
        representativeScore: level.representativeScore,
    };
}

function _scoreForCategory(category) {
    return category.representativeScore;
}

function _emptyEffectiveWeights() {
    return {
        pollen: 0,
        regulatedPollution: 0,
        atmosphericIrritants: 0,
        mold: 0,
    };
}

function _copyValues(source, fields) {
    let result = {};

    for (const field of fields)
        result[field] = source && Object.prototype.hasOwnProperty.call(source, field)
            ? _sanitizeValue(source[field])
            : null;

    return result;
}

function _availableFields(values, fields) {
    return fields.filter(field => _sanitizeValue(values[field]) !== null);
}

function _highestClassified(values, fields, thresholdMap) {
    let dominant = null;
    let normalizedValues = {};

    for (const field of fields) {
        const value = _sanitizeValue(values[field]);

        if (value === null) {
            normalizedValues[field] = null;
            continue;
        }

        const classified = classifyValue(value, thresholdMap[field]);

        normalizedValues[field] = classified.score;

        if (dominant === null || classified.score > dominant.score) {
            dominant = {
                field,
                value,
                category: classified.category,
                score: classified.score,
            };
        }
    }

    return {
        dominant,
        normalizedValues,
    };
}

function _weightedClassified(values, fields, thresholdMap, weights) {
    let weightedScore = 0;
    let availableWeight = 0;
    let components = {};
    let effectiveWeights = {};

    for (const field of fields) {
        const value = _sanitizeValue(values[field]);

        if (value === null) {
            components[field] = null;
            effectiveWeights[field] = 0;
            continue;
        }

        const classified = classifyValue(value, thresholdMap[field]);
        const weight = weights[field] || 0;

        components[field] = {
            value,
            score: classified.score,
            category: classified.category,
            configuredWeight: weight,
        };
        weightedScore += classified.score * weight;
        availableWeight += weight;
    }

    if (availableWeight === 0) {
        return {
            score: null,
            category: null,
            components,
            effectiveWeights,
            completeness: 0,
        };
    }

    for (const field of fields)
        effectiveWeights[field] = components[field] === null
            ? 0
            : (weights[field] || 0) / availableWeight;

    const score = _clampScore(weightedScore / availableWeight);

    return {
        score,
        category: categoryFromScore(score),
        components,
        effectiveWeights,
        completeness: availableWeight,
    };
}

function _pollenSource(input) {
    if (input && input.pollen)
        return input.pollen;

    return {};
}

function _rawPollutantSource(input) {
    if (input && input.rawPollutants)
        return input.rawPollutants;

    return {};
}

function _pollutantAqiSource(input) {
    if (input && input.pollutantAqi)
        return input.pollutantAqi;

    return {};
}

function _contextSource(input) {
    if (input && input.context)
        return input.context;

    return {};
}

function _moldScore(moldPotential) {
    if (!moldPotential ||
        moldPotential.isAvailable === false ||
        !_isFiniteNumber(moldPotential.score)) {
        return {
            score: null,
            category: null,
            result: moldPotential || null,
            completeness: 0,
        };
    }

    const score = _clampScore(moldPotential.score);

    return {
        score,
        category: categoryFromScore(score),
        result: moldPotential,
        completeness: _isFiniteNumber(moldPotential.completeness)
            ? Math.max(0, Math.min(1, moldPotential.completeness))
            : Math.max(0, Math.min(1, moldPotential.dataCompleteness || 1)),
    };
}

function _unavailableBurden(id, source = 'airaware') {
    return {
        id,
        available: false,
        burden: null,
        score: null,
        category: null,
        value: null,
        unit: null,
        source,
    };
}

function _availableBurden(id, value, score, category, unit, source) {
    return {
        id,
        available: true,
        burden: score,
        score,
        category,
        value,
        unit,
        source,
    };
}

/**
 * Classify a single environmental reading using configurable threshold bands.
 *
 * @param {number} value - Environmental reading. Negative values are treated as zero.
 * @param {Object} thresholds - Object with moderate, high, and veryHigh numeric cutoffs.
 * @returns {Object} Category metadata and representative normalized score.
 */
var classifyValue = function(value, thresholds) {
    const sanitized = _sanitizeValue(value);

    if (sanitized === null || thresholds === null || thresholds === undefined) {
        return {
            category: _copyLevel(Constants.RISK_LEVELS.LOW),
            score: 0,
            isValid: false,
        };
    }

    if (sanitized >= thresholds.veryHigh) {
        return {
            category: _copyLevel(Constants.RISK_LEVELS.VERY_HIGH),
            score: _scoreForCategory(Constants.RISK_LEVELS.VERY_HIGH),
            isValid: true,
        };
    }

    if (sanitized >= thresholds.high) {
        return {
            category: _copyLevel(Constants.RISK_LEVELS.HIGH),
            score: _scoreForCategory(Constants.RISK_LEVELS.HIGH),
            isValid: true,
        };
    }

    if (sanitized >= thresholds.moderate) {
        return {
            category: _copyLevel(Constants.RISK_LEVELS.MODERATE),
            score: _scoreForCategory(Constants.RISK_LEVELS.MODERATE),
            isValid: true,
        };
    }

    return {
        category: _copyLevel(Constants.RISK_LEVELS.LOW),
        score: _scoreForCategory(Constants.RISK_LEVELS.LOW),
        isValid: true,
    };
};

/**
 * Convert a normalized 0-100 burden score to the public risk category.
 *
 * @param {number} score - Normalized environmental burden score.
 * @returns {Object} Category metadata for the score.
 */
var categoryFromScore = function(score) {
    const sanitized = _sanitizeValue(score);

    if (sanitized === null)
        return _copyLevel(Constants.RISK_LEVELS.LOW);

    if (sanitized >= Constants.RISK_LEVELS.VERY_HIGH.minScore)
        return _copyLevel(Constants.RISK_LEVELS.VERY_HIGH);

    if (sanitized >= Constants.RISK_LEVELS.HIGH.minScore)
        return _copyLevel(Constants.RISK_LEVELS.HIGH);

    if (sanitized >= Constants.RISK_LEVELS.MODERATE.minScore)
        return _copyLevel(Constants.RISK_LEVELS.MODERATE);

    return _copyLevel(Constants.RISK_LEVELS.LOW);
};

/**
 * Calculate pollen burden from six Open-Meteo pollen types.
 *
 * @param {Object} input - Object with normalized pollen values.
 * @returns {Object} Pollen score details.
 */
var calculatePollenScore = function(input) {
    const values = _copyValues(_pollenSource(input), POLLEN_FIELDS);
    const availableTypes = _availableFields(values, POLLEN_FIELDS);
    const highest = _highestClassified(values, POLLEN_FIELDS, Constants.POLLEN_THRESHOLDS);

    if (highest.dominant === null) {
        return {
            score: null,
            category: null,
            dominantType: null,
            dominant: null,
            availableTypes,
            rawValues: values,
            normalizedValues: highest.normalizedValues,
            completeness: 0,
        };
    }

    return {
        score: highest.dominant.score,
        category: highest.dominant.category,
        dominantType: highest.dominant.field,
        dominant: highest.dominant,
        availableTypes,
        rawValues: values,
        normalizedValues: highest.normalizedValues,
        completeness: availableTypes.length / POLLEN_FIELDS.length,
    };
};

/**
 * Calculate the normalized burden for one pollen type.
 *
 * @param {Object} input - Current or forecast environmental data.
 * @param {string} pollenType - Canonical pollen type.
 * @returns {Object} Individual factor burden.
 */
var calculatePollenBurden = function(input, pollenType) {
    if (POLLEN_FIELDS.indexOf(pollenType) === -1)
        return _unavailableBurden(pollenType, 'open-meteo');

    const values = _pollenSource(input);
    const value = _sanitizeValue(values[pollenType]);

    if (value === null)
        return _unavailableBurden(pollenType, 'open-meteo');

    const classified = classifyValue(value, Constants.POLLEN_THRESHOLDS[pollenType]);

    return _availableBurden(
        pollenType,
        value,
        classified.score,
        classified.category,
        'grains/m³',
        'open-meteo'
    );
};

/**
 * Calculate regulated pollution from selected pollutant-specific AQI values.
 *
 * Falls back to raw-concentration scoring only when no selected pollutant AQI
 * values are available.
 *
 * @param {Object} input - Object with pollutantAqi and rawPollutants.
 * @returns {Object} Regulated pollution score details.
 */
var calculateRegulatedPollutionScore = function(input) {
    const aqiValues = _copyValues(_pollutantAqiSource(input), RAW_REGULATED_FIELDS);
    const availableAqi = _availableFields(aqiValues, RAW_REGULATED_FIELDS);
    const aqiSource = input && typeof input.pollutantAqiSource === 'string'
        ? input.pollutantAqiSource
        : 'aqi';

    if (availableAqi.length > 0) {
        let dominantPollutant = null;

        for (const field of availableAqi) {
            const score = _clampScore(aqiValues[field]);

            if (dominantPollutant === null || score > dominantPollutant.score) {
                dominantPollutant = {
                    field,
                    value: aqiValues[field],
                    score,
                    category: categoryFromScore(score),
                };
            }
        }

        return {
            score: dominantPollutant.score,
            category: dominantPollutant.category,
            dominantPollutant: dominantPollutant.field,
            dominant: dominantPollutant,
            availablePollutants: availableAqi,
            pollutantAqiValues: aqiValues,
            source: aqiSource,
            completeness: availableAqi.length / RAW_REGULATED_FIELDS.length,
        };
    }

    const rawValues = _copyValues(_rawPollutantSource(input), RAW_REGULATED_FIELDS);
    const availableRaw = _availableFields(rawValues, RAW_REGULATED_FIELDS);
    const highest = _highestClassified(
        rawValues,
        RAW_REGULATED_FIELDS,
        Constants.POLLUTANT_THRESHOLDS
    );

    if (highest.dominant === null) {
        return {
            score: null,
            category: null,
            dominantPollutant: null,
            dominant: null,
            availablePollutants: [],
            pollutantAqiValues: aqiValues,
            rawValues,
            normalizedValues: highest.normalizedValues,
            source: 'unavailable',
            completeness: 0,
        };
    }

    return {
        score: highest.dominant.score,
        category: highest.dominant.category,
        dominantPollutant: highest.dominant.field,
        dominant: highest.dominant,
        availablePollutants: availableRaw,
        pollutantAqiValues: aqiValues,
        rawValues,
        normalizedValues: highest.normalizedValues,
        source: 'raw-concentration-fallback',
        completeness: (availableRaw.length / RAW_REGULATED_FIELDS.length) * 0.65,
    };
};

/**
 * Calculate one regulated pollutant burden using pollutant-specific AQI when
 * available, otherwise the existing raw-concentration fallback threshold.
 *
 * @param {Object} input - Current or forecast environmental data.
 * @param {string} pollutantType - Canonical pollutant field.
 * @returns {Object} Individual factor burden.
 */
var calculateRegulatedPollutantBurden = function(input, pollutantType) {
    if (RAW_REGULATED_FIELDS.indexOf(pollutantType) === -1)
        return _unavailableBurden(pollutantType, 'open-meteo');

    const aqi = _sanitizeValue(_pollutantAqiSource(input)[pollutantType]);

    if (aqi !== null) {
        const score = _clampScore(aqi);

        return _availableBurden(
            pollutantType,
            aqi,
            score,
            categoryFromScore(score),
            input && typeof input.pollutantAqiLabel === 'string'
                ? input.pollutantAqiLabel
                : 'AQI',
            input && typeof input.pollutantAqiSource === 'string'
                ? input.pollutantAqiSource
                : 'aqi'
        );
    }

    const raw = _sanitizeValue(_rawPollutantSource(input)[pollutantType]);

    if (raw === null)
        return _unavailableBurden(pollutantType, 'open-meteo');

    const classified = classifyValue(raw, Constants.POLLUTANT_THRESHOLDS[pollutantType]);

    return _availableBurden(
        pollutantType,
        raw,
        classified.score,
        classified.category,
        'µg/m³',
        'raw-concentration-fallback'
    );
};

/**
 * Calculate low-weight atmospheric context burden.
 *
 * @param {Object} input - Object with context and raw pollutant values.
 * @returns {Object} Atmospheric context score details.
 */
var calculateAtmosphericIrritantsScore = function(input) {
    const context = _contextSource(input);
    const raw = _rawPollutantSource(input);
    const values = {
        carbonMonoxide: _sanitizeValue(raw.carbonMonoxide),
        aerosolOpticalDepth: _sanitizeValue(context.aerosolOpticalDepth),
        dust: _sanitizeValue(context.dust),
        wildfirePm10: _sanitizeValue(context.wildfirePm10),
    };
    const result = _weightedClassified(
        values,
        ATMOSPHERIC_CONTEXT_FIELDS,
        Constants.ATMOSPHERIC_CONTEXT_THRESHOLDS,
        Constants.ATMOSPHERIC_CONTEXT_WEIGHTS
    );

    result.wildfirePm10Available = values.wildfirePm10 !== null;

    return result;
};

/**
 * Calculate one atmospheric context burden.
 *
 * @param {Object} input - Current or forecast environmental data.
 * @param {string} contextType - Canonical context field.
 * @returns {Object} Individual factor burden.
 */
var calculateAtmosphericContextBurden = function(input, contextType) {
    if (ATMOSPHERIC_CONTEXT_FIELDS.indexOf(contextType) === -1)
        return _unavailableBurden(contextType, 'open-meteo');

    const context = _contextSource(input);
    const raw = _rawPollutantSource(input);
    const value = contextType === 'carbonMonoxide'
        ? _sanitizeValue(raw.carbonMonoxide)
        : _sanitizeValue(context[contextType]);

    if (value === null)
        return _unavailableBurden(contextType, 'open-meteo');

    const classified = classifyValue(
        value,
        Constants.ATMOSPHERIC_CONTEXT_THRESHOLDS[contextType]
    );
    const unit = contextType === 'aerosolOpticalDepth'
        ? ''
        : 'µg/m³';

    return _availableBurden(
        contextType,
        value,
        classified.score,
        classified.category,
        unit,
        'open-meteo'
    );
};

/**
 * Reuse the calculated mold potential as an individual factor burden.
 *
 * @param {Object|null} moldPotential - Mold-potential result.
 * @returns {Object} Individual factor burden.
 */
var calculateMoldBurden = function(moldPotential) {
    const mold = _moldScore(moldPotential);

    if (mold.score === null)
        return _unavailableBurden('mold', 'airaware');

    return _availableBurden(
        'mold',
        mold.score,
        mold.score,
        mold.category,
        '%',
        'airaware'
    );
};

function _dominantComponent(groups) {
    let dominant = null;

    for (const group of groups) {
        if (group.result.score === null)
            continue;

        if (dominant === null || group.result.score > dominant.score)
            dominant = {
                name: group.name,
                score: group.result.score,
                category: group.result.category,
            };
    }

    return dominant;
}

/**
 * Calculate the combined environmental allergy burden.
 *
 * @param {Object} input - Current or forecast environmental data.
 * @param {Object|null} moldPotential - Optional mold-potential result.
 * @returns {Object} Score, category, components, effective weights, and partial flag.
 */
var calculateRisk = function(input, moldPotential = null) {
    const pollen = calculatePollenScore(input);
    const regulatedPollution = calculateRegulatedPollutionScore(input);
    const atmosphericIrritants = calculateAtmosphericIrritantsScore(input);
    const mold = _moldScore(moldPotential);
    const groups = [
        {
            name: 'pollen',
            result: pollen,
            weight: Constants.RISK_WEIGHTS.pollen,
        },
        {
            name: 'regulatedPollution',
            result: regulatedPollution,
            weight: Constants.RISK_WEIGHTS.particulates,
        },
        {
            name: 'atmosphericIrritants',
            result: atmosphericIrritants,
            weight: Constants.RISK_WEIGHTS.irritants,
        },
        {
            name: 'mold',
            result: mold,
            weight: Constants.RISK_WEIGHTS.mold,
        },
    ];
    let weightedScore = 0;
    let availableWeight = 0;
    let completeness = 0;
    let missingGroups = [];
    let effectiveWeights = _emptyEffectiveWeights();

    for (const group of groups) {
        if (group.result.score === null) {
            missingGroups.push(group.name);
            continue;
        }

        weightedScore += group.result.score * group.weight;
        availableWeight += group.weight;
        completeness += group.weight * group.result.completeness;
    }

    const score = availableWeight > 0
        ? _clampScore(weightedScore / availableWeight)
        : 0;

    if (availableWeight > 0) {
        for (const group of groups)
            effectiveWeights[group.name] = group.result.score === null
                ? 0
                : group.weight / availableWeight;
    }

    return {
        score,
        category: categoryFromScore(score),
        completeness: Math.max(0, Math.min(1, completeness)),
        dataCompleteness: Math.max(0, Math.min(1, completeness)),
        components: {
            pollen,
            regulatedPollution,
            atmosphericIrritants,
            particulates: regulatedPollution,
            irritants: atmosphericIrritants,
            gasesAndDust: atmosphericIrritants,
            mold,
        },
        effectiveWeights,
        dominantComponent: _dominantComponent(groups),
        pollenScore: pollen.score,
        particulateScore: regulatedPollution.score,
        irritantScore: atmosphericIrritants.score,
        moldScore: mold.score,
        missingGroups,
        missingFields: [],
        isPartial: missingGroups.length > 0 ||
            groups.some(group => group.result.completeness < 1),
    };
};
