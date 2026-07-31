/* exported calculateRisk, classifyValue, categoryFromScore */

const Constants = imports.constants;

const POLLEN_FIELDS = ['treePollen', 'grassPollen', 'weedPollen'];
const PARTICULATE_FIELDS = ['pm25', 'pm10'];
const GAS_AND_DUST_FIELDS = ['nitrogenDioxide', 'ozone', 'dust'];

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
 * The model weights highest pollen category at 60%, highest particulate
 * category at 30%, and highest gases/dust category at 10%. Missing groups are
 * excluded from the denominator so partial provider responses remain usable.
 *
 * @param {Object} readings - Canonical readings from the active data provider.
 * @returns {Object} Score, category, components, missing fields, and partial-data flag.
 */
var calculateRisk = function(readings) {
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
    const gasesAndDust = _groupScore(
        safeReadings,
        GAS_AND_DUST_FIELDS,
        Constants.POLLUTANT_THRESHOLDS
    );

    const weightedGroups = [
        {
            name: 'pollen',
            result: pollen,
            weight: Constants.RISK_WEIGHTS.pollen,
        },
        {
            name: 'particulates',
            result: particulates,
            weight: Constants.RISK_WEIGHTS.particulates,
        },
        {
            name: 'gasesAndDust',
            result: gasesAndDust,
            weight: Constants.RISK_WEIGHTS.gasesAndDust,
        },
    ];

    let weightedScore = 0;
    let availableWeight = 0;
    let missingFields = [];
    let missingGroups = [];

    for (const group of weightedGroups) {
        missingFields = missingFields.concat(group.result.missingFields);

        if (group.result.score === null) {
            missingGroups.push(group.name);
            continue;
        }

        weightedScore += group.result.score * group.weight;
        availableWeight += group.weight;
    }

    const score = availableWeight > 0
        ? Math.round(weightedScore / availableWeight)
        : 0;

    return {
        score,
        category: categoryFromScore(score),
        components: {
            pollen,
            particulates,
            gasesAndDust,
        },
        missingFields,
        missingGroups,
        isPartial: missingFields.length > 0 || missingGroups.length > 0,
    };
};
