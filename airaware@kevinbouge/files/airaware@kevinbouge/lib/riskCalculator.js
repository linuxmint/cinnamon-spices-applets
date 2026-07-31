/* exported calculateRisk, classifyValue, categoryFromScore */

const Constants = imports.constants;

const POLLEN_FIELDS = ['treePollen', 'grassPollen', 'weedPollen'];
const PARTICULATE_FIELDS = ['pm25', 'pm10'];
const IRRITANT_FIELDS = [
    'nitrogenDioxide',
    'ozone',
    'sulfurDioxide',
    'dust',
    'aerosolOpticalDepth',
    'carbonMonoxide',
];

function _isFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
}

function _sanitizeValue(value) {
    if (!_isFiniteNumber(value))
        return null;

    return Math.max(0, value);
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
        particulates: 0,
        irritants: 0,
        mold: 0,
    };
}

function _fieldCompleteness(readings, fields) {
    let available = 0;

    for (const field of fields) {
        if (_sanitizeValue(readings[field]) !== null)
            available++;
    }

    return fields.length === 0 ? 0 : available / fields.length;
}

function _highestClassifiedReading(readings, fields, thresholdMap) {
    let best = null;
    let missingFields = [];

    for (const field of fields) {
        const value = _sanitizeValue(readings[field]);

        if (value === null) {
            missingFields.push(field);
            continue;
        }

        const classified = classifyValue(value, thresholdMap[field]);
        const candidate = {
            field,
            value,
            category: classified.category,
            score: classified.score,
        };

        if (best === null || candidate.score > best.score)
            best = candidate;
    }

    return {
        best,
        missingFields,
    };
}

function _groupScore(readings, fields, thresholdMap) {
    const result = _highestClassifiedReading(readings, fields, thresholdMap);

    if (result.best === null) {
        return {
            score: null,
            dominant: null,
            missingFields: result.missingFields,
        };
    }

    return {
        score: result.best.score,
        dominant: result.best,
        missingFields: result.missingFields,
    };
}

function _weightedClassifiedScore(readings, fields, thresholdMap, weights) {
    let weightedScore = 0;
    let availableWeight = 0;
    let missingFields = [];
    let items = {};

    for (const field of fields) {
        const value = _sanitizeValue(readings[field]);

        if (value === null) {
            missingFields.push(field);
            items[field] = null;
            continue;
        }

        const classified = classifyValue(value, thresholdMap[field]);
        const weight = weights[field] || 0;

        items[field] = {
            field,
            value,
            category: classified.category,
            score: classified.score,
            weight,
        };
        weightedScore += classified.score * weight;
        availableWeight += weight;
    }

    if (availableWeight === 0) {
        return {
            score: null,
            items,
            missingFields,
            effectiveWeights: {},
            dataCompleteness: 0,
        };
    }

    let effectiveWeights = {};

    for (const field of fields) {
        const item = items[field];

        effectiveWeights[field] = item === null
            ? 0
            : item.weight / availableWeight;
    }

    return {
        score: Math.round(weightedScore / availableWeight),
        items,
        missingFields,
        effectiveWeights,
        dataCompleteness: availableWeight,
    };
}

function _moldScore(moldPotential) {
    if (!moldPotential ||
        moldPotential.isAvailable !== true ||
        !_isFiniteNumber(moldPotential.score)) {
        return {
            score: null,
            result: moldPotential || null,
            missingFields: ['moldPotential'],
            dataCompleteness: 0,
        };
    }

    return {
        score: Math.max(0, Math.min(100, Math.round(moldPotential.score))),
        result: moldPotential,
        missingFields: moldPotential.missingComponents || [],
        dataCompleteness: _isFiniteNumber(moldPotential.dataCompleteness)
            ? Math.max(0, Math.min(1, moldPotential.dataCompleteness))
            : 1,
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
 * Calculate the combined environmental allergy burden.
 *
 * The model weights highest pollen category, highest particulate category,
 * weighted gases/atmospheric irritants, and optional mold potential. Missing
 * groups are excluded from the denominator so partial provider responses remain
 * usable.
 *
 * @param {Object} readings - Canonical readings from the active data provider.
 * @param {Object|null} moldPotential - Optional result from mold calculator.
 * @returns {Object} Score, category, components, effective weights, and partial flag.
 */
var calculateRisk = function(readings, moldPotential = null) {
    const safeReadings = readings || {};
    const pollen = _groupScore(
        safeReadings,
        POLLEN_FIELDS,
        Constants.POLLEN_THRESHOLDS
    );
    const particulates = _groupScore(
        safeReadings,
        PARTICULATE_FIELDS,
        Constants.POLLUTANT_THRESHOLDS
    );
    const irritants = _weightedClassifiedScore(
        safeReadings,
        IRRITANT_FIELDS,
        Constants.POLLUTANT_THRESHOLDS,
        Constants.IRRITANT_WEIGHTS
    );
    const mold = _moldScore(moldPotential);

    const weightedGroups = [
        {
            name: 'pollen',
            result: pollen,
            weight: Constants.RISK_WEIGHTS.pollen,
            completeness: _fieldCompleteness(safeReadings, POLLEN_FIELDS),
        },
        {
            name: 'particulates',
            result: particulates,
            weight: Constants.RISK_WEIGHTS.particulates,
            completeness: _fieldCompleteness(safeReadings, PARTICULATE_FIELDS),
        },
        {
            name: 'irritants',
            result: irritants,
            weight: Constants.RISK_WEIGHTS.irritants,
            completeness: irritants.dataCompleteness,
        },
        {
            name: 'mold',
            result: mold,
            weight: Constants.RISK_WEIGHTS.mold,
            completeness: mold.dataCompleteness,
        },
    ];

    let weightedScore = 0;
    let availableWeight = 0;
    let missingFields = [];
    let missingGroups = [];
    let completeness = 0;
    let effectiveWeights = _emptyEffectiveWeights();

    for (const group of weightedGroups) {
        missingFields = missingFields.concat(group.result.missingFields);

        if (group.result.score === null) {
            missingGroups.push(group.name);
            continue;
        }

        weightedScore += group.result.score * group.weight;
        availableWeight += group.weight;
        completeness += group.weight * group.completeness;
    }

    const score = availableWeight > 0
        ? Math.round(weightedScore / availableWeight)
        : 0;

    if (availableWeight > 0) {
        for (const group of weightedGroups) {
            effectiveWeights[group.name] = group.result.score === null
                ? 0
                : group.weight / availableWeight;
        }
    }

    return {
        score,
        category: categoryFromScore(score),
        pollenScore: pollen.score,
        particulateScore: particulates.score,
        irritantScore: irritants.score,
        moldScore: mold.score,
        effectiveWeights,
        dataCompleteness: Math.max(0, Math.min(1, completeness)),
        components: {
            pollen,
            particulates,
            irritants,
            gasesAndDust: irritants,
            mold,
        },
        missingFields,
        missingGroups,
        isPartial: missingFields.length > 0 || missingGroups.length > 0,
    };
};
