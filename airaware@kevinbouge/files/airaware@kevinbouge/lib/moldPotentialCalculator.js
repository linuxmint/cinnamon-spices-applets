/* exported calculateMoldPotential, categoryFromScore */

const Constants = imports.constants;

const OPTIONAL_COMPONENTS = Object.freeze([
    'precipitation',
    'temperature',
    'wind',
]);

function _isFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
}

function _clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function _copyLevel(level) {
    return {
        id: level.id,
        label: level.label,
        minScore: level.minScore,
        representativeScore: level.representativeScore,
    };
}

function _scale(value, inMin, inMax, outMin, outMax) {
    if (inMax === inMin)
        return outMin;

    const ratio = _clamp((value - inMin) / (inMax - inMin), 0, 1);

    return outMin + ((outMax - outMin) * ratio);
}

function _hourValues(hour) {
    if (hour && hour.values && typeof hour.values === 'object')
        return hour.values;

    return {};
}

function _validValues(hours, field) {
    let values = [];

    for (const hour of hours || []) {
        const value = _hourValues(hour)[field];

        if (_isFiniteNumber(value))
            values.push(Math.max(0, value));
    }

    return values;
}

function _average(values) {
    if (values.length === 0)
        return null;

    let total = 0;

    for (const value of values)
        total += value;

    return total / values.length;
}

function _sumRecent(values, maxValues) {
    if (values.length === 0)
        return null;

    const start = Math.max(0, values.length - maxValues);
    let total = 0;

    for (let index = start; index < values.length; index++)
        total += values[index];

    return total;
}

function _normalizeHumidity(value) {
    if (!_isFiniteNumber(value))
        return null;

    const ranges = Constants.MOLD_NORMALIZATION.relativeHumidity;

    if (value < ranges.low)
        return 0;

    if (value < ranges.moderate)
        return _scale(value, ranges.low, ranges.moderate, 0, 40);

    if (value < ranges.high)
        return _scale(value, ranges.moderate, ranges.high, 40, 80);

    return _scale(value, ranges.high, 100, 80, 100);
}

function _normalizePrecipitation(value) {
    if (!_isFiniteNumber(value))
        return null;

    const ranges = Constants.MOLD_NORMALIZATION.precipitation;

    if (value === 0)
        return 0;

    if (value < ranges.moderate)
        return _scale(value, ranges.trace, ranges.moderate, 10, 40);

    if (value < ranges.high)
        return _scale(value, ranges.moderate, ranges.high, 40, 80);

    return _scale(value, ranges.high, ranges.high * 2, 80, 100);
}

function _normalizeTemperature(value) {
    if (!_isFiniteNumber(value))
        return null;

    const ranges = Constants.MOLD_NORMALIZATION.temperature;

    if (value < ranges.minimum)
        return 0;

    if (value < ranges.suitableLow)
        return _scale(value, ranges.minimum, ranges.suitableLow, 0, 70);

    if (value <= ranges.suitableHigh)
        return 100;

    if (value <= ranges.maximum)
        return _scale(value, ranges.suitableHigh, ranges.maximum, 100, 30);

    return 0;
}

function _normalizeWind(value) {
    if (!_isFiniteNumber(value))
        return null;

    const ranges = Constants.MOLD_NORMALIZATION.wind;

    if (value < ranges.calm)
        return 100;

    if (value < ranges.moderate)
        return _scale(value, ranges.calm, ranges.moderate, 100, 50);

    if (value < ranges.strong)
        return _scale(value, ranges.moderate, ranges.strong, 50, 0);

    return 0;
}

/**
 * Convert a normalized mold-potential score to an AirAware category.
 *
 * @param {number} score - Normalized 0-100 score.
 * @returns {Object} Category metadata.
 */
var categoryFromScore = function(score) {
    if (!_isFiniteNumber(score))
        return null;

    const clamped = _clamp(score, 0, 100);

    if (clamped >= Constants.RISK_LEVELS.VERY_HIGH.minScore)
        return _copyLevel(Constants.RISK_LEVELS.VERY_HIGH);

    if (clamped >= Constants.RISK_LEVELS.HIGH.minScore)
        return _copyLevel(Constants.RISK_LEVELS.HIGH);

    if (clamped >= Constants.RISK_LEVELS.MODERATE.minScore)
        return _copyLevel(Constants.RISK_LEVELS.MODERATE);

    return _copyLevel(Constants.RISK_LEVELS.LOW);
};

function _explanationKey(components) {
    let bestKey = 'mold-limited-data';
    let bestScore = -1;

    for (const key in components) {
        if (!_isFiniteNumber(components[key]))
            continue;

        if (components[key] > bestScore) {
            bestScore = components[key];
            bestKey = `mold-${key}`;
        }
    }

    return bestKey;
}

/**
 * Calculate a weather-based environmental mold-potential score.
 *
 * This is an environmental heuristic based on humidity, precipitation,
 * temperature, and low-wind persistence. It is not a measured mold-spore
 * concentration.
 *
 * @param {Array} hourlyWeather - Normalized hourly weather records.
 * @returns {Object} Mold score result with components and completeness.
 */
var calculateMoldPotential = function(hourlyWeather) {
    const hours = Array.isArray(hourlyWeather) ? hourlyWeather : [];
    const humidityValues = _validValues(hours, 'relativeHumidity');
    const precipitationValues = _validValues(hours, 'precipitation');
    const temperatureValues = _validValues(hours, 'temperature');
    const windValues = _validValues(hours, 'windSpeed');
    const weights = Constants.MOLD_WEIGHTS;
    let availableWeight = 0;
    let weightedScore = 0;
    let effectiveWeights = {
        relativeHumidity: 0,
        precipitation: 0,
        temperature: 0,
        wind: 0,
    };
    const components = {
        relativeHumidity: null,
        precipitation: null,
        temperature: null,
        wind: null,
    };

    if (humidityValues.length === 0) {
        let optionalWeight = 0;

        for (const component of OPTIONAL_COMPONENTS) {
            if (_validValues(hours, component === 'wind' ? 'windSpeed' : component).length > 0)
                optionalWeight += weights[component];
        }

        return {
            score: null,
            category: null,
            isAvailable: false,
            dataCompleteness: optionalWeight,
            components,
            effectiveWeights,
            missingComponents: ['relativeHumidity'],
            explanationKey: 'mold-unavailable-humidity',
        };
    }

    components.relativeHumidity = _normalizeHumidity(_average(humidityValues));
    components.precipitation = _normalizePrecipitation(_sumRecent(precipitationValues, 24));
    components.temperature = _normalizeTemperature(_average(temperatureValues));
    components.wind = _normalizeWind(_average(windValues));

    for (const component in weights) {
        if (!_isFiniteNumber(components[component]))
            continue;

        availableWeight += weights[component];
    }

    for (const component in weights) {
        if (!_isFiniteNumber(components[component]))
            continue;

        const effectiveWeight = weights[component] / availableWeight;

        effectiveWeights[component] = effectiveWeight;
        weightedScore += components[component] * effectiveWeight;
    }

    let missingComponents = [];

    for (const component in components) {
        if (!_isFiniteNumber(components[component]))
            missingComponents.push(component);
    }

    const score = _clamp(Math.round(weightedScore), 0, 100);

    return {
        score,
        category: categoryFromScore(score),
        isAvailable: true,
        dataCompleteness: availableWeight,
        components,
        effectiveWeights,
        missingComponents,
        explanationKey: _explanationKey(components),
    };
};
