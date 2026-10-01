/* exported buildDailySummary */

const RiskCalculator = imports.riskCalculator;

const SUMMARY_SCORE_PANEL = 'panel';
const SUMMARY_SCORE_ENVIRONMENTAL = 'environmental';
const SUMMARY_SCORE_PERSONALIZED = 'personalized';

function _isObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function _isFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
}

function _categoryId(category) {
    if (typeof category === 'string')
        return category;

    if (category && typeof category.id === 'string')
        return category.id;

    return null;
}

function _copyCategory(category) {
    if (!_isObject(category))
        return category;

    let copy = {};

    for (const key in category)
        copy[key] = category[key];

    return copy;
}

function _normalizedScoreType(value) {
    if (value === SUMMARY_SCORE_ENVIRONMENTAL ||
        value === SUMMARY_SCORE_PERSONALIZED)
        return value;

    return SUMMARY_SCORE_PANEL;
}

function _panelRequestedType(options) {
    if (options.panelScoreMode === SUMMARY_SCORE_PERSONALIZED)
        return SUMMARY_SCORE_PERSONALIZED;

    return SUMMARY_SCORE_ENVIRONMENTAL;
}

function _scoreSelection(options) {
    const requested = _normalizedScoreType(options.summaryScore || SUMMARY_SCORE_PANEL);

    if (requested === SUMMARY_SCORE_PANEL)
        return _panelRequestedType(options);

    return requested;
}

function _scoreResult(options) {
    const requested = _scoreSelection(options);
    const environmental = options.environmentalRisk || null;
    const personalized = options.personalizedRisk || null;

    if (requested === SUMMARY_SCORE_PERSONALIZED &&
        personalized &&
        personalized.available === true) {
        return {
            requestedType: SUMMARY_SCORE_PERSONALIZED,
            effectiveType: SUMMARY_SCORE_PERSONALIZED,
            risk: personalized,
            fallbackUsed: false,
        };
    }

    if (environmental) {
        return {
            requestedType: requested,
            effectiveType: SUMMARY_SCORE_ENVIRONMENTAL,
            risk: environmental,
            fallbackUsed: requested === SUMMARY_SCORE_PERSONALIZED,
        };
    }

    return null;
}

function _mainFactorFromPersonalized(risk) {
    if (!risk || !Array.isArray(risk.contributors) || risk.contributors.length === 0)
        return null;

    const contributor = risk.contributors[0];

    if (!contributor || typeof contributor.id !== 'string')
        return null;

    return {
        available: true,
        factorId: contributor.id,
        factorGroup: _factorGroup(contributor.group),
        burden: _isFiniteNumber(contributor.burden) ? contributor.burden : null,
        percentageChange: null,
    };
}

function _mainFactorFromEnvironmental(risk) {
    if (!risk || !risk.dominantComponent || typeof risk.dominantComponent.name !== 'string')
        return null;

    const detailedFactor = _environmentalDetailedFactor(risk);

    if (detailedFactor !== null)
        return detailedFactor;

    return {
        available: true,
        factorId: risk.dominantComponent.name,
        factorGroup: _factorGroup(risk.dominantComponent.name),
        burden: _isFiniteNumber(risk.dominantComponent.score)
            ? risk.dominantComponent.score
            : null,
        percentageChange: null,
    };
}

function _environmentalDetailedFactor(risk) {
    const components = risk.components || {};
    const dominantName = risk.dominantComponent.name;

    if (dominantName === 'pollen' &&
        components.pollen &&
        typeof components.pollen.dominantType === 'string') {
        return {
            available: true,
            factorId: `pollen_${components.pollen.dominantType}`,
            factorGroup: 'pollen',
            burden: _isFiniteNumber(components.pollen.score)
                ? components.pollen.score
                : null,
            percentageChange: null,
        };
    }

    if (dominantName === 'regulatedPollution' &&
        components.regulatedPollution &&
        typeof components.regulatedPollution.dominantPollutant === 'string') {
        return {
            available: true,
            factorId: _regulatedPollutantFactorId(
                components.regulatedPollution.dominantPollutant
            ),
            factorGroup: 'regulated_pollution',
            burden: _isFiniteNumber(components.regulatedPollution.score)
                ? components.regulatedPollution.score
                : null,
            percentageChange: null,
        };
    }

    if (dominantName === 'atmosphericIrritants' &&
        components.atmosphericIrritants) {
        const atmosphericFactor = _dominantAtmosphericFactor(
            components.atmosphericIrritants
        );

        if (atmosphericFactor !== null)
            return atmosphericFactor;
    }

    if (dominantName === 'mold') {
        return {
            available: true,
            factorId: 'mold',
            factorGroup: 'mold',
            burden: _isFiniteNumber(risk.dominantComponent.score)
                ? risk.dominantComponent.score
                : null,
            percentageChange: null,
        };
    }

    return null;
}

function _regulatedPollutantFactorId(field) {
    const map = {
        pm25: 'pm2_5',
        pm10: 'pm10',
        nitrogenDioxide: 'nitrogen_dioxide',
        ozone: 'ozone',
        sulfurDioxide: 'sulphur_dioxide',
    };

    return map[field] || field;
}

function _atmosphericFactorId(field) {
    const map = {
        carbonMonoxide: 'carbon_monoxide',
        aerosolOpticalDepth: 'aerosol_optical_depth',
        dust: 'dust',
        wildfirePm10: 'wildfire_pm10',
    };

    return map[field] || field;
}

function _dominantAtmosphericFactor(atmosphericResult) {
    const components = atmosphericResult.components || {};
    let dominant = null;

    for (const field in components) {
        const component = components[field];

        if (!component || !_isFiniteNumber(component.score))
            continue;

        if (dominant === null || component.score > dominant.score) {
            dominant = {
                field,
                score: component.score,
            };
        }
    }

    if (dominant === null)
        return null;

    return {
        available: true,
        factorId: _atmosphericFactorId(dominant.field),
        factorGroup: 'atmospheric_irritant',
        burden: dominant.score,
        percentageChange: null,
    };
}

function _factorGroup(groupName) {
    if (groupName === 'pollen')
        return 'pollen';

    if (groupName === 'regulatedPollution' ||
        groupName === 'regulated_pollution')
        return 'regulated_pollution';

    if (groupName === 'atmosphericContext' ||
        groupName === 'atmosphericIrritants' ||
        groupName === 'atmospheric_irritant')
        return 'atmospheric_irritant';

    if (groupName === 'mold')
        return 'mold';

    if (groupName === 'uv')
        return 'uv';

    return 'unknown';
}

function _bestOutdoorWindow(options) {
    if (options.includeBestOutdoorWindow !== true)
        return {
            available: false,
            reason: 'disabled',
        };

    const forecast = options.personalizedForecast || null;
    const window = forecast && forecast.bestWindow ? forecast.bestWindow : null;

    if (!window || window.available !== true)
        return {
            available: false,
            reason: 'unavailable',
        };

    return {
        available: true,
        startTime: window.startTime || null,
        endTime: window.endTime || null,
        score: _isFiniteNumber(window.averageScore) ? window.averageScore : null,
        category: _copyCategory(window.category),
    };
}

function _timeValue(timeText) {
    if (typeof timeText !== 'string' || timeText === '')
        return null;

    const normalized = timeText.length === 16 ? `${timeText}:00` : timeText;
    const parsed = Date.parse(normalized);

    return Number.isFinite(parsed) ? parsed : null;
}

function _uvHourlyRecords(providerData) {
    if (!providerData || !providerData.weather)
        return [];

    if (Array.isArray(providerData.weather.hourlyRecords))
        return providerData.weather.hourlyRecords.map(record => ({
            time: record.time || record.timestamp || null,
            value: record.values && _isFiniteNumber(record.values.uvIndex)
                ? record.values.uvIndex
                : null,
        }));

    const hourly = providerData.weather.hourly;

    if (!hourly || !Array.isArray(hourly.timestamps) || !Array.isArray(hourly.uvIndex))
        return [];

    return hourly.timestamps.map((time, index) => ({
        time,
        value: _isFiniteNumber(hourly.uvIndex[index]) ? hourly.uvIndex[index] : null,
    }));
}

function _uvPeak(options) {
    if (options.includeUvPeak !== true)
        return {
            available: false,
            reason: 'disabled',
        };

    const currentDate = typeof options.currentTime === 'string' &&
        options.currentTime.length >= 10
        ? options.currentTime.substring(0, 10)
        : null;
    let peak = null;

    for (const record of _uvHourlyRecords(options.providerData)) {
        if (_timeValue(record.time) === null ||
            (currentDate !== null &&
                (typeof record.time !== 'string' ||
                    record.time.substring(0, 10) !== currentDate)) ||
            !_isFiniteNumber(record.value) ||
            record.value < 0)
            continue;

        if (peak === null || record.value > peak.value) {
            peak = {
                value: record.value,
                time: record.time,
            };
        }
    }

    if (peak === null && options.providerData && options.providerData.current &&
        _isFiniteNumber(options.providerData.current.uvIndex)) {
        peak = {
            value: options.providerData.current.uvIndex,
            time: options.providerData.current.timestamp ||
                options.providerData.current.time ||
                options.currentTime ||
                null,
        };
    }

    if (peak === null)
        return {
            available: false,
            reason: 'unavailable',
        };

    return {
        available: true,
        value: peak.value,
        time: peak.time,
        category: RiskCalculator.getUvCategory(peak.value),
        percentageChange: null,
    };
}

function _providerLabels(providerData) {
    let labels = [];

    if (providerData && providerData.current)
        labels.push('Open-Meteo');

    if (providerData && providerData.vegetation)
        labels.push('OpenStreetMap');

    if (labels.length === 0)
        labels.push('Open-Meteo');

    return labels;
}

/**
 * Build the canonical shareable daily summary model.
 *
 * The builder only selects from already calculated AirAware models. It does
 * not fetch provider data, copy to the clipboard, or recalculate environmental
 * burden scores.
 *
 * @param {Object} options - Current applet data and summary settings.
 * @returns {Object} Provider-independent daily summary model.
 */
var buildDailySummary = function(options = {}) {
    const source = _isObject(options) ? options : {};
    const selected = _scoreResult(source);

    if (selected === null || !selected.risk)
        return {
            available: false,
            reason: 'no_environmental_data',
        };

    const risk = selected.risk;
    const score = _isFiniteNumber(risk.score) ? risk.score : null;

    if (score === null)
        return {
            available: false,
            reason: 'no_environmental_data',
        };

    const mainFactor = source.includeMainFactor === true
        ? (selected.effectiveType === SUMMARY_SCORE_PERSONALIZED
            ? _mainFactorFromPersonalized(source.personalizedRisk)
            : _mainFactorFromEnvironmental(source.environmentalRisk))
        : null;
    const currentTime = source.currentTime ||
        (source.providerData && source.providerData.current
            ? source.providerData.current.timestamp || source.providerData.current.time
            : null);

    return {
        available: true,
        generatedAt: source.generatedAt || currentTime || null,
        dateLabel: typeof source.dateLabel === 'string' ? source.dateLabel : null,
        location: {
            available: typeof source.locationName === 'string' &&
                source.locationName.trim() !== '',
            displayName: typeof source.locationName === 'string'
                ? source.locationName.trim()
                : null,
            hidden: source.locationHidden === true,
        },
        score: {
            requestedType: selected.requestedType,
            effectiveType: selected.effectiveType,
            available: true,
            score,
            displayScore: Math.round(score),
            category: _copyCategory(risk.category),
            categoryId: _categoryId(risk.category),
            percentageChange: source.includePercentageChanges === true &&
                _isFiniteNumber(source.scorePercentageChange)
                ? source.scorePercentageChange
                : null,
            stale: source.stale === true,
            fallbackUsed: selected.fallbackUsed,
        },
        mainFactor: mainFactor || {
            available: false,
            reason: source.includeMainFactor === true ? 'unavailable' : 'disabled',
        },
        bestOutdoorWindow: _bestOutdoorWindow(source),
        uvPeak: _uvPeak({
            includeUvPeak: source.includeUvPeak === true,
            providerData: source.providerData,
            currentTime,
        }),
        freshness: {
            stale: source.stale === true,
        },
        attribution: {
            providerLabels: _providerLabels(source.providerData),
        },
    };
};
