/* exported calculateMoldPotential, categoryFromScore */

const Constants = imports.constants;

const OPTIONAL_COMPONENTS = Object.freeze([
    'leafWetness',
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

function _shouldClampNonNegative(field) {
    return field !== 'temperature' && field !== 'dewPoint';
}

function _sanitizeWeatherValue(value, field) {
    if (!_isFiniteNumber(value))
        return null;

    return _shouldClampNonNegative(field) ? Math.max(0, value) : value;
}

function _validValues(hours, field) {
    let values = [];

    for (const hour of hours || []) {
        const value = _hourValues(hour)[field];

        if (_isFiniteNumber(value))
            values.push(_sanitizeWeatherValue(value, field));
    }

    return values;
}

function _structuredHours(input) {
    if (!input || !input.hourly)
        return [];

    const hourly = input.hourly;

    if (Array.isArray(hourly))
        return hourly;

    if (!Array.isArray(hourly.timestamps))
        return [];

    return hourly.timestamps.map((time, index) => ({
        time,
        values: {
            temperature: Array.isArray(hourly.temperature) ? hourly.temperature[index] : null,
            relativeHumidity: Array.isArray(hourly.relativeHumidity) ? hourly.relativeHumidity[index] : null,
            dewPoint: Array.isArray(hourly.dewPoint) ? hourly.dewPoint[index] : null,
            precipitation: Array.isArray(hourly.precipitation) ? hourly.precipitation[index] : null,
            windSpeed: Array.isArray(hourly.windSpeed) ? hourly.windSpeed[index] : null,
        },
    }));
}

function _inputHours(input) {
    if (Array.isArray(input))
        return input;

    if (input && Array.isArray(input.hours))
        return input.hours;

    if (input && Array.isArray(input.hourlyRecords))
        return input.hourlyRecords;

    return _structuredHours(input);
}

function _dailyValue(input, field) {
    if (!input || !input.daily)
        return null;

    const value = input.daily[field];

    if (Array.isArray(value))
        return _sanitizeWeatherValue(value[0], field);

    return _sanitizeWeatherValue(value, field);
}

function _currentValue(input, field) {
    if (!input || !input.current)
        return null;

    const value = input.current[field];

    return _sanitizeWeatherValue(value, field);
}

function _firstFinite(values) {
    for (const value of values) {
        if (_isFiniteNumber(value))
            return value;
    }

    return null;
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

function _normalizeLeafWetness(value) {
    if (!_isFiniteNumber(value))
        return null;

    return _clamp(value, 0, 100);
}

function _dewPointModifier(temperature, dewPoint) {
    if (!_isFiniteNumber(temperature) || !_isFiniteNumber(dewPoint)) {
        return {
            points: 0,
            confidence: 'unknown',
        };
    }

    const depression = temperature - dewPoint;

    if (depression <= 2) {
        return {
            points: 5,
            confidence: 'high',
        };
    }

    if (depression <= 5) {
        return {
            points: 2,
            confidence: 'moderate',
        };
    }

    return {
        points: -3,
        confidence: 'low',
    };
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
 * This is an environmental heuristic based on humidity, leaf wetness,
 * precipitation, temperature, and low-wind persistence. It is not a measured
 * mold-spore concentration.
 *
 * @param {Array|Object} weatherInput - Normalized weather records or structured weather.
 * @returns {Object} Mold score result with components and completeness.
 */
var calculateMoldPotential = function(weatherInput) {
    const hours = _inputHours(weatherInput);
    const humidityValues = _validValues(hours, 'relativeHumidity');
    const precipitationValues = _validValues(hours, 'precipitation');
    const temperatureValues = _validValues(hours, 'temperature');
    const windValues = _validValues(hours, 'windSpeed');
    const dewPointValues = _validValues(hours, 'dewPoint');
    const weights = Constants.MOLD_WEIGHTS;
    let availableWeight = 0;
    let weightedScore = 0;
    let effectiveWeights = {
        relativeHumidity: 0,
        leafWetness: 0,
        precipitation: 0,
        temperature: 0,
        wind: 0,
    };
    const components = {
        relativeHumidity: null,
        leafWetness: null,
        precipitation: null,
        temperature: null,
        wind: null,
    };
    const relativeHumidity = _firstFinite([
        _currentValue(weatherInput, 'relativeHumidity'),
        _dailyValue(weatherInput, 'relativeHumidityMean'),
        _average(humidityValues),
    ]);
    const temperature = _firstFinite([
        _dailyValue(weatherInput, 'temperatureMean'),
        _currentValue(weatherInput, 'temperature'),
        _average(temperatureValues),
    ]);
    const dewPoint = _firstFinite([
        _currentValue(weatherInput, 'dewPoint'),
        _average(dewPointValues),
    ]);

    if (!_isFiniteNumber(relativeHumidity)) {
        let optionalWeight = 0;

        for (const component of OPTIONAL_COMPONENTS) {
            if (component === 'leafWetness' && _dailyValue(weatherInput, 'leafWetnessProbabilityMean') !== null)
                optionalWeight += weights[component];
            else if (_validValues(hours, component === 'wind' ? 'windSpeed' : component).length > 0)
                optionalWeight += weights[component];
        }

        return {
            score: null,
            category: null,
            isAvailable: false,
            completeness: optionalWeight,
            dataCompleteness: optionalWeight,
            confidence: 'unavailable',
            components,
            effectiveWeights,
            missingComponents: ['relativeHumidity'],
            explanationKey: 'mold-unavailable-humidity',
        };
    }

    components.relativeHumidity = _normalizeHumidity(relativeHumidity);
    components.leafWetness = _normalizeLeafWetness(_dailyValue(weatherInput, 'leafWetnessProbabilityMean'));
    components.precipitation = _normalizePrecipitation(_firstFinite([
        _dailyValue(weatherInput, 'precipitationSum'),
        _sumRecent(precipitationValues, 24),
    ]));
    components.temperature = _normalizeTemperature(temperature);
    components.wind = _normalizeWind(_firstFinite([
        _dailyValue(weatherInput, 'windSpeedMean'),
        _currentValue(weatherInput, 'windSpeed'),
        _average(windValues),
    ]));

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

    const dewPointModifier = _dewPointModifier(temperature, dewPoint);
    const score = _clamp(Math.round(weightedScore + dewPointModifier.points), 0, 100);

    return {
        score,
        category: categoryFromScore(score),
        isAvailable: true,
        completeness: availableWeight,
        dataCompleteness: availableWeight,
        confidence: dewPointModifier.confidence,
        components,
        effectiveWeights,
        missingComponents,
        explanationKey: _explanationKey(components),
    };
};
