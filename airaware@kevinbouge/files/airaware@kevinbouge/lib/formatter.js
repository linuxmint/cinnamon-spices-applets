/* exported setTranslator, resetTranslator, formatCategory, formatPanelLabel,
 * formatScore, formatReading, formatPollen, formatPollutant, formatTimestamp,
 * isStale, formatStaleStatus, formatUpdateAge, formatFieldLabel, formatAerosolOpticalDepth,
 * formatSulfurDioxide, formatCarbonMonoxide, formatAqi,
 * formatWeatherUnavailable, formatMoldPotential, formatPercentage,
 * formatTemperature, formatDewPoint, formatWindSpeed, formatWindDirection,
 * formatWindGusts, formatVisibility, formatPollenTypeLabel,
 * formatDistanceMeters, formatVegetationCategoryLabel, formatMappedTaxonLabel,
 * formatMissingSelectedFactorCount, formatPersonalizedTooltip,
 * formatUvIndex, formatTimeLabel, formatTimeRange */

const GLib = imports.gi.GLib;

const DEFAULT_UNIT = '';
const POLLEN_UNIT = 'grains/m³';
const POLLUTANT_UNIT = 'µg/m³';
const TEMPERATURE_UNIT = '°C';
const WIND_UNIT = 'm/s';
const VISIBILITY_UNIT = 'km';

const CATEGORY_LABELS = Object.freeze({
    low: 'Low',
    moderate: 'Moderate',
    high: 'High',
    'very-high': 'Very High',
});

const FIELD_LABELS = Object.freeze({
    treePollen: 'Tree pollen',
    alder: 'Alder pollen',
    birch: 'Birch pollen',
    grassPollen: 'Grass pollen',
    grass: 'Grass pollen',
    mugwort: 'Mugwort pollen',
    olive: 'Olive pollen',
    ragweed: 'Ragweed pollen',
    weedPollen: 'Weed pollen',
    pm25: 'PM2.5',
    pm10: 'PM10',
    nitrogenDioxide: 'NO₂',
    ozone: 'O₃',
    sulfurDioxide: 'SO₂',
    dust: 'Dust',
    aerosolOpticalDepth: 'Aerosol optical depth',
    carbonMonoxide: 'CO',
    wildfirePm10: 'Wildfire-related PM10',
});

const POLLEN_TYPE_LABELS = Object.freeze({
    alder: 'Alder',
    birch: 'Birch',
    grass: 'Grass',
    mugwort: 'Mugwort',
    olive: 'Olive',
    ragweed: 'Ragweed',
});

const VEGETATION_CATEGORY_LABELS = Object.freeze({
    woodland: 'Woodland',
    grassland: 'Grassland',
    orchard: 'Orchard',
    scrub: 'Scrub',
    parkland: 'Parkland',
    farmland: 'Farmland',
});

const MAPPED_TAXON_LABELS = Object.freeze({
    birch: 'Mapped birch trees',
    alder: 'Mapped alder trees',
    olive: 'Mapped olive trees',
});

function _(text) {
    return text;
}

function _markTranslatableStringsForExtraction() {
    return [
        _('Low'),
        _('Moderate'),
        _('High'),
        _('Very High'),
        _('Unknown'),
        _('Unavailable'),
        _('Weather data unavailable'),
        _('Tree pollen'),
        _('Alder pollen'),
        _('Birch pollen'),
        _('Grass pollen'),
        _('Mugwort pollen'),
        _('Olive pollen'),
        _('Ragweed pollen'),
        _('Weed pollen'),
        _('PM2.5'),
        _('PM10'),
        _('NO₂'),
        _('O₃'),
        _('SO₂'),
        _('Dust'),
        _('Aerosol optical depth'),
        _('CO'),
        _('Wildfire-related PM10'),
        _('UV index'),
        _('Alder'),
        _('Birch'),
        _('Grass'),
        _('Mugwort'),
        _('Olive'),
        _('Ragweed'),
        _('Woodland'),
        _('Grassland'),
        _('Orchard'),
        _('Scrub'),
        _('Parkland'),
        _('Farmland'),
        _('Mapped birch trees'),
        _('Mapped alder trees'),
        _('Mapped olive trees'),
        _('Mapped vegetation'),
        _('Mapped allergenic trees'),
        _('AQI'),
        _('US AQI'),
        _('EU AQI'),
        _('No recent data'),
        _('Stale data'),
        _('Updated just now'),
        _('Updated 1 min ago'),
        _('1 selected factor is unavailable'),
        _('Personalized risk unavailable'),
        _('Environmental burden: {category} ({score})\nPersonalized risk unavailable'),
        _('Environmental burden: {category} ({score}) — cached data\nPersonalized risk unavailable'),
        _('{category} ({score})'),
        _('{category} ({score}) — cached data'),
        _('{count} selected factors are unavailable'),
        _('{degrees}° {direction}'),
        _('{distance} km'),
        _('{distance} m'),
        _('{label} {value}'),
        _('{score}%'),
        _('{value} {unit}'),
        _('{value}%'),
        _('{value} ({change})'),
        _('{start}–{end} · {category} ({score})'),
        _('N'),
        _('NE'),
        _('E'),
        _('SE'),
        _('S'),
        _('SW'),
        _('W'),
        _('NW'),
        _('grains/m³'),
        _('µg/m³'),
        _('°C'),
        _('m/s'),
        _('km'),
    ];
}

let _translate = function(text) {
    return text;
};

function _isFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
}

function _toCategoryId(category) {
    if (typeof category === 'string')
        return category;

    if (category && typeof category.id === 'string')
        return category.id;

    return null;
}

function _roundToPrecision(value, precision) {
    const factor = Math.pow(10, precision);
    return Math.round(value * factor) / factor;
}

function _replace(template, replacements) {
    let result = template;

    for (const key in replacements)
        result = result.replace(`{${key}}`, `${replacements[key]}`);

    return result;
}

function _nowMs() {
    return GLib.get_real_time() / 1000;
}

function _formatNumber(value, unit, precision, clampToZero) {
    if (!_isFiniteNumber(value))
        return _translate('Unavailable');

    const safePrecision = Math.max(0, Math.min(3, Math.floor(precision)));
    const numericValue = clampToZero ? Math.max(0, value) : value;
    const rounded = _roundToPrecision(numericValue, safePrecision);
    const formattedNumber = safePrecision === 0
        ? `${Math.round(rounded)}`
        : rounded.toFixed(safePrecision);

    if (!unit)
        return formattedNumber;

    return _replace(_translate('{value} {unit}'), {
        value: formattedNumber,
        unit: _translate(unit),
    });
}

/**
 * Set the translation function used by all formatter output.
 *
 * @param {Function} translator - Function compatible with gettext-style _(text).
 */
var setTranslator = function(translator) {
    _translate = typeof translator === 'function'
        ? translator
        : function(text) {
            return text;
        };
};

/**
 * Reset formatter translations to identity. Primarily useful for tests.
 */
var resetTranslator = function() {
    _translate = function(text) {
        return text;
    };
};

/**
 * Format a risk category id or category object for display.
 *
 * @param {string|Object} category - Category id or object with an id property.
 * @returns {string} Translated category label.
 */
var formatCategory = function(category) {
    const id = _toCategoryId(category);

    if (id !== null && Object.prototype.hasOwnProperty.call(CATEGORY_LABELS, id))
        return _translate(CATEGORY_LABELS[id]);

    return _translate('Unknown');
};

/**
 * Format the panel text label for a risk result.
 *
 * @param {Object} riskResult - Result from riskCalculator.calculateRisk().
 * @param {boolean} showText - Whether panel text is enabled.
 * @returns {string} Empty string when panel text is hidden, otherwise category text.
 */
var formatPanelLabel = function(riskResult, showText) {
    if (!showText)
        return '';

    return formatCategory(riskResult ? riskResult.category : null);
};

/**
 * Format a normalized risk score.
 *
 * @param {number} score - Normalized 0-100 score.
 * @returns {string} Score formatted as a percentage or unavailable text.
 */
var formatScore = function(score) {
    if (!_isFiniteNumber(score))
        return _translate('Unavailable');

    const normalized = Math.max(0, Math.min(100, Math.round(score)));
    return _replace(_translate('{score}%'), {
        score: normalized,
    });
};

/**
 * Format a numeric environmental reading with a unit.
 *
 * @param {number} value - Environmental reading.
 * @param {string} unit - Display unit.
 * @param {number} precision - Number of decimal places.
 * @returns {string} Formatted reading or unavailable text.
 */
var formatReading = function(value, unit = DEFAULT_UNIT, precision = 0) {
    return _formatNumber(value, unit, precision, true);
};

/**
 * Format a pollen reading in grains/m³.
 *
 * @param {number} value - Pollen reading.
 * @returns {string} Formatted pollen reading.
 */
var formatPollen = function(value) {
    return formatReading(value, POLLEN_UNIT, 0);
};

/**
 * Format an air pollutant reading in µg/m³.
 *
 * @param {number} value - Pollutant reading.
 * @returns {string} Formatted pollutant reading.
 */
var formatPollutant = function(value) {
    return formatReading(value, POLLUTANT_UNIT, 1);
};

/**
 * Format a pollutant-specific AQI value with its selected source label.
 *
 * @param {number} value - AQI value.
 * @param {string} sourceLabel - Display label for the selected AQI source.
 * @returns {string} Formatted AQI value or unavailable text.
 */
var formatAqi = function(value, sourceLabel = 'AQI') {
    if (!_isFiniteNumber(value))
        return _translate('Unavailable');

    const label = typeof sourceLabel === 'string' && sourceLabel !== ''
        ? sourceLabel
        : 'AQI';

    return _replace(_translate('{label} {value}'), {
        label: _translate(label),
        value: Math.round(Math.max(0, Math.min(100, value))),
    });
};

/**
 * Format aerosol optical depth. This value is unitless.
 *
 * @param {number} value - Aerosol optical depth.
 * @returns {string} Formatted value or unavailable text.
 */
var formatAerosolOpticalDepth = function(value) {
    return formatReading(value, DEFAULT_UNIT, 2);
};

/**
 * Format sulfur dioxide in µg/m³.
 *
 * @param {number} value - Sulfur dioxide reading.
 * @returns {string} Formatted sulfur dioxide reading.
 */
var formatSulfurDioxide = function(value) {
    return formatPollutant(value);
};

/**
 * Format carbon monoxide in µg/m³.
 *
 * @param {number} value - Carbon monoxide reading.
 * @returns {string} Formatted carbon monoxide reading.
 */
var formatCarbonMonoxide = function(value) {
    return formatReading(value, POLLUTANT_UNIT, 0);
};

/**
 * Format the specific unavailable state for weather-derived values.
 *
 * @returns {string} Translated unavailable-weather label.
 */
var formatWeatherUnavailable = function() {
    return _translate('Weather data unavailable');
};

/**
 * Format weather-based mold potential for display.
 *
 * @param {Object|null} moldPotential - Result from moldPotentialCalculator.
 * @returns {string} Score, or unavailable text.
 */
var formatMoldPotential = function(moldPotential) {
    if (!moldPotential ||
        moldPotential.isAvailable !== true ||
        !_isFiniteNumber(moldPotential.score))
        return formatWeatherUnavailable();

    const normalized = Math.max(0, Math.min(100, Math.round(moldPotential.score)));

    return _replace(_translate('{score}%'), {
        score: normalized,
    });
};

/**
 * Format a percentage value.
 *
 * @param {number} value - Percentage value.
 * @returns {string} Formatted percentage or unavailable text.
 */
var formatPercentage = function(value) {
    if (!_isFiniteNumber(value))
        return _translate('Unavailable');

    return _replace(_translate('{value}%'), {
        value: Math.round(Math.max(0, Math.min(100, value))),
    });
};

/**
 * Format temperature in degrees Celsius.
 *
 * @param {number} value - Temperature value.
 * @returns {string} Formatted temperature or unavailable text.
 */
var formatTemperature = function(value) {
    return _formatNumber(value, TEMPERATURE_UNIT, 1, false);
};

/**
 * Format dew point in degrees Celsius.
 *
 * @param {number} value - Dew point value.
 * @returns {string} Formatted dew point or unavailable text.
 */
var formatDewPoint = function(value) {
    return formatTemperature(value);
};

/**
 * Format wind speed in meters per second.
 *
 * @param {number} value - Wind speed value.
 * @returns {string} Formatted wind speed or unavailable text.
 */
var formatWindSpeed = function(value) {
    return formatReading(value, WIND_UNIT, 1);
};

/**
 * Format wind gusts in meters per second.
 *
 * @param {number} value - Wind gust value.
 * @returns {string} Formatted wind gust or unavailable text.
 */
var formatWindGusts = function(value) {
    return formatWindSpeed(value);
};

/**
 * Format wind direction as degrees plus compass sector.
 *
 * @param {number} value - Direction in degrees.
 * @returns {string} Formatted direction or unavailable text.
 */
var formatWindDirection = function(value) {
    if (!_isFiniteNumber(value))
        return _translate('Unavailable');

    const normalized = ((value % 360) + 360) % 360;
    const sectors = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const sector = sectors[Math.floor((normalized + 22.5) / 45) % sectors.length];

    return _replace(_translate('{degrees}° {direction}'), {
        degrees: Math.round(normalized),
        direction: _translate(sector),
    });
};

/**
 * Format visibility in kilometers. Open-Meteo returns meters.
 *
 * @param {number} value - Visibility in meters.
 * @returns {string} Formatted visibility or unavailable text.
 */
var formatVisibility = function(value) {
    if (!_isFiniteNumber(value))
        return _translate('Unavailable');

    return formatReading(value / 1000, VISIBILITY_UNIT, 1);
};

/**
 * Format a UV index value.
 *
 * @param {number} value - UV index.
 * @returns {string} Formatted UV index or unavailable text.
 */
var formatUvIndex = function(value) {
    return formatReading(value, DEFAULT_UNIT, 1);
};

/**
 * Format a pollen type label.
 *
 * @param {string} fieldName - Canonical pollen field.
 * @returns {string} Pollen label.
 */
var formatPollenTypeLabel = function(fieldName) {
    if (Object.prototype.hasOwnProperty.call(POLLEN_TYPE_LABELS, fieldName))
        return _translate(POLLEN_TYPE_LABELS[fieldName]);

    return formatFieldLabel(fieldName);
};

/**
 * Format a compact distance label for nearby mapped features.
 *
 * @param {number} meters - Distance in meters.
 * @returns {string} Translated distance or unavailable text.
 */
var formatDistanceMeters = function(meters) {
    if (!_isFiniteNumber(meters))
        return _translate('Unavailable');

    const distance = Math.max(0, Math.round(meters));

    if (distance < 1000) {
        return _replace(_translate('{distance} m'), {
            distance,
        });
    }

    const kilometers = _roundToPrecision(distance / 1000, 1).toFixed(1);

    return _replace(_translate('{distance} km'), {
        distance: kilometers,
    });
};

/**
 * Format a nearby vegetation category label.
 *
 * @param {string} categoryId - Canonical vegetation category.
 * @returns {string} Translated category label.
 */
var formatVegetationCategoryLabel = function(categoryId) {
    if (Object.prototype.hasOwnProperty.call(VEGETATION_CATEGORY_LABELS, categoryId))
        return _translate(VEGETATION_CATEGORY_LABELS[categoryId]);

    return _translate('Mapped vegetation');
};

/**
 * Format a mapped allergenic taxon label.
 *
 * @param {string} taxonId - Canonical taxon id.
 * @returns {string} Translated taxon label.
 */
var formatMappedTaxonLabel = function(taxonId) {
    if (Object.prototype.hasOwnProperty.call(MAPPED_TAXON_LABELS, taxonId))
        return _translate(MAPPED_TAXON_LABELS[taxonId]);

    return _translate('Mapped allergenic trees');
};

/**
 * Format an Open-Meteo local timestamp as HH:MM.
 *
 * @param {string} timeText - Local timestamp text.
 * @returns {string} Compact local time.
 */
var formatTimeLabel = function(timeText) {
    if (typeof timeText !== 'string' || timeText.length < 16)
        return _translate('Unknown');

    return timeText.substring(11, 16);
};

/**
 * Format a compact local time range.
 *
 * @param {string} startTime - Start timestamp.
 * @param {string} endTime - End timestamp.
 * @returns {string} HH:MM-HH:MM style range.
 */
var formatTimeRange = function(startTime, endTime) {
    return `${formatTimeLabel(startTime)}–${formatTimeLabel(endTime)}`;
};

/**
 * Format count of selected factors unavailable in provider data.
 *
 * @param {number} missingCount - Missing selected factor count.
 * @returns {string} Translated missing-data label.
 */
var formatMissingSelectedFactorCount = function(missingCount) {
    const missing = _isFiniteNumber(missingCount) ? Math.max(0, Math.round(missingCount)) : 0;

    if (missing === 1)
        return _translate('1 selected factor is unavailable');

    return _replace(_translate('{count} selected factors are unavailable'), {
        count: missing,
    });
};

/**
 * Format panel tooltip text for the selected score mode.
 *
 * @param {Object} risk - Risk result.
 * @param {string} mode - environmental, personalized, or fallback.
 * @param {boolean} stale - Whether data is stale.
 * @returns {string} Tooltip text.
 */
var formatPersonalizedTooltip = function(risk, mode, stale) {
    const category = formatCategory(risk ? risk.category : null);
    const score = formatScore(risk ? risk.score : null);

    if (mode === 'personalized') {
        return stale
            ? _replace(_translate('{category} ({score}) — cached data'), {
                category,
                score,
            })
            : _replace(_translate('{category} ({score})'), {
                category,
                score,
            });
    }

    if (mode === 'fallback') {
        return stale
            ? _replace(_translate('Environmental burden: {category} ({score}) — cached data\nPersonalized risk unavailable'), {
                category,
                score,
            })
            : _replace(_translate('Environmental burden: {category} ({score})\nPersonalized risk unavailable'), {
                category,
                score,
            });
    }

    return stale
        ? _replace(_translate('{category} ({score}) — cached data'), {
            category,
            score,
        })
        : _replace(_translate('{category} ({score})'), {
            category,
            score,
        });
};


/**
 * Format a timestamp for display in the popup.
 *
 * @param {number} timestampMs - Unix timestamp in milliseconds.
 * @returns {string} Local timestamp or unavailable text.
 */
var formatTimestamp = function(timestampMs) {
    if (!_isFiniteNumber(timestampMs))
        return _translate('Unavailable');

    const dateTime = GLib.DateTime.new_from_unix_local(Math.floor(timestampMs / 1000));

    if (dateTime === null)
        return _translate('Unavailable');

    return dateTime.format('%Y-%m-%d %H:%M');
};

/**
 * Determine whether cached data is stale.
 *
 * @param {number} updatedAtMs - Last update timestamp in milliseconds.
 * @param {number} nowMs - Current timestamp in milliseconds.
 * @param {number} maxAgeMinutes - Freshness window in minutes.
 * @returns {boolean} True when data is stale or timestamp arguments are invalid.
 */
var isStale = function(updatedAtMs, nowMs = _nowMs(), maxAgeMinutes = 120) {
    const maxAge = Number(maxAgeMinutes);

    if (!_isFiniteNumber(updatedAtMs) || !_isFiniteNumber(nowMs))
        return true;

    const maxAgeMs = (_isFiniteNumber(maxAge) ? Math.max(0, maxAge) : 0) *
        60 * 1000;
    return nowMs - updatedAtMs > maxAgeMs;
};

/**
 * Format freshness status for cached data.
 *
 * @param {number} updatedAtMs - Last update timestamp in milliseconds.
 * @param {number} nowMs - Current timestamp in milliseconds.
 * @param {number} maxAgeMinutes - Freshness window in minutes.
 * @returns {string} Translated freshness label.
 */
var formatStaleStatus = function(updatedAtMs, nowMs = _nowMs(), maxAgeMinutes = 120) {
    if (!_isFiniteNumber(updatedAtMs))
        return _translate('No recent data');

    if (isStale(updatedAtMs, nowMs, maxAgeMinutes))
        return _translate('Stale data');

    const ageMinutes = Math.max(0, Math.floor((nowMs - updatedAtMs) / 60000));

    if (ageMinutes < 1)
        return _translate('Updated just now');

    if (ageMinutes === 1)
        return _translate('Updated 1 min ago');

    return _replace(_translate('Updated {minutes} min ago'), {
        minutes: ageMinutes,
    });
};

/**
 * Format elapsed time since the last successful update.
 *
 * @param {number} updatedAtMs - Last update timestamp in milliseconds.
 * @param {number} nowMs - Current timestamp in milliseconds.
 * @returns {string} Translated age label.
 */
var formatUpdateAge = function(updatedAtMs, nowMs = _nowMs()) {
    if (!_isFiniteNumber(updatedAtMs))
        return _translate('no recent data');

    const ageMinutes = Math.max(0, Math.floor((nowMs - updatedAtMs) / 60000));

    if (ageMinutes < 1)
        return _translate('updated just now');

    if (ageMinutes === 1)
        return _translate('updated 1 minute ago');

    return _replace(_translate('updated {minutes} minutes ago'), {
        minutes: ageMinutes,
    });
};

/**
 * Format a canonical provider field name for display.
 *
 * @param {string} fieldName - Canonical field name.
 * @returns {string} Translated display label.
 */
var formatFieldLabel = function(fieldName) {
    if (Object.prototype.hasOwnProperty.call(FIELD_LABELS, fieldName))
        return _translate(FIELD_LABELS[fieldName]);

    return _translate('Unknown');
};
