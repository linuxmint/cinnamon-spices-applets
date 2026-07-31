/* exported setTranslator, resetTranslator, formatCategory, formatPanelLabel,
 * formatScore, formatReading, formatPollen, formatPollutant, formatTimestamp,
 * isStale, formatStaleStatus, formatFieldLabel */

const GLib = imports.gi.GLib;

const DEFAULT_UNIT = '';
const POLLEN_UNIT = 'grains/m³';
const POLLUTANT_UNIT = 'µg/m³';

const CATEGORY_LABELS = Object.freeze({
    low: 'Low',
    moderate: 'Moderate',
    high: 'High',
    'very-high': 'Very High',
});

const FIELD_LABELS = Object.freeze({
    treePollen: 'Tree pollen',
    grassPollen: 'Grass pollen',
    weedPollen: 'Weed pollen',
    pm25: 'PM2.5',
    pm10: 'PM10',
    nitrogenDioxide: 'NO₂',
    ozone: 'O₃',
    dust: 'Dust',
});

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
 * @returns {string} Score formatted as n/100 or unavailable text.
 */
var formatScore = function(score) {
    if (!_isFiniteNumber(score))
        return _translate('Unavailable');

    const normalized = Math.max(0, Math.min(100, Math.round(score)));
    return _replace(_translate('{score}/100'), {
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
    if (!_isFiniteNumber(value))
        return _translate('Unavailable');

    const safePrecision = Math.max(0, Math.min(3, Math.floor(precision)));
    const rounded = _roundToPrecision(Math.max(0, value), safePrecision);
    const formattedNumber = safePrecision === 0
        ? `${Math.round(rounded)}`
        : rounded.toFixed(safePrecision);

    if (!unit)
        return formattedNumber;

    return _replace(_translate('{value} {unit}'), {
        value: formattedNumber,
        unit: _translate(unit),
    });
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
