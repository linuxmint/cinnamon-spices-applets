/* exported setTranslator, resetTranslator, formatCategory, formatPanelLabel,
 * formatScore, formatReading, formatPollen, formatPollutant, formatTimestamp,
 * isStale, formatStaleStatus, formatFieldLabel, formatAerosolOpticalDepth,
 * formatSulfurDioxide, formatCarbonMonoxide, formatAqi,
 * formatWeatherUnavailable, formatMoldPotential, formatPercentage,
 * formatTemperature, formatDewPoint, formatWindSpeed, formatWindDirection,
 * formatWindGusts, formatVisibility, formatPollenTypeLabel */

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
