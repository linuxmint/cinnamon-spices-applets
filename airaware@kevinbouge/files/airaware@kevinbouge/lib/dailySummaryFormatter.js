/* exported setTranslator, resetTranslator, formatDailySummary,
 * getRiskCategoryEmoji, getDailySummaryFactorEmoji */

const Formatter = imports.formatter;

function _(text) {
    return text;
}

function _markTranslatableStringsForExtraction() {
    return [
        _('AirAware'),
        _('Environmental burden'),
        _('Personalized risk'),
        _('Main factor'),
        _('Best outdoor window'),
        _('UV peak'),
        _('Cached data'),
        _('Environmental conditions only — not medical advice.'),
        _('Data: {providers}'),
        _('{category} ({score})'),
        _('{category} ({score}) ({change})'),
        _('{category} at {time}'),
        _('{label} ({change})'),
        _('Alder pollen'),
        _('Birch pollen'),
        _('Grass pollen'),
        _('Mugwort pollen'),
        _('Olive pollen'),
        _('Ragweed pollen'),
        _('Mold potential'),
        _('PM2.5'),
        _('PM10'),
        _('NO₂'),
        _('O₃'),
        _('SO₂'),
        _('CO'),
        _('Particle haze'),
        _('Dust'),
        _('Wildfire-related PM10'),
        _('UV index'),
        _('Regulated pollution'),
        _('Atmospheric irritants'),
        _('Unknown'),
        _('Extreme'),
    ];
}

let _translate = function(text) {
    return text;
};

function _isObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function _isFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
}

function _replace(template, replacements) {
    let result = template;

    for (const key in replacements)
        result = result.replace(`{${key}}`, `${replacements[key]}`);

    return result;
}

function _categoryId(category) {
    if (typeof category === 'string')
        return category;

    if (category && typeof category.id === 'string')
        return category.id;

    return null;
}

function _scoreLabel(type) {
    if (type === 'personalized')
        return _translate('Personalized risk');

    return _translate('Environmental burden');
}

function _formatCategory(category) {
    if (_categoryId(category) === 'extreme')
        return _translate('Extreme');

    if (_categoryId(category) === 'very_high')
        return _translate('Very High');

    return Formatter.formatCategory(category);
}

function _formatSignedPercentageChange(change) {
    if (!_isFiniteNumber(change))
        return null;

    const rounded = Math.round(change);

    if (rounded === 0)
        return '0%';

    if (rounded > 0)
        return `+${rounded}%`;

    return `${rounded}%`;
}

function _formatScoreLine(scoreModel) {
    const category = _formatCategory(scoreModel.category);
    const score = Formatter.formatScore(scoreModel.score);
    const change = _formatSignedPercentageChange(scoreModel.percentageChange);

    if (change !== null) {
        return _replace(_translate('{category} ({score}) ({change})'), {
            category,
            score,
            change,
        });
    }

    return _replace(_translate('{category} ({score})'), {
        category,
        score,
    });
}

function _factorLabels() {
    return {
        pollen_alder: _translate('Alder pollen'),
        pollen_birch: _translate('Birch pollen'),
        pollen_grass: _translate('Grass pollen'),
        pollen_mugwort: _translate('Mugwort pollen'),
        pollen_olive: _translate('Olive pollen'),
        pollen_ragweed: _translate('Ragweed pollen'),
        mold: _translate('Mold potential'),
        pm2_5: _translate('PM2.5'),
        pm10: _translate('PM10'),
        nitrogen_dioxide: _translate('NO₂'),
        ozone: _translate('O₃'),
        sulphur_dioxide: _translate('SO₂'),
        carbon_monoxide: _translate('CO'),
        aerosol_optical_depth: _translate('Particle haze'),
        dust: _translate('Dust'),
        wildfire_pm10: _translate('Wildfire-related PM10'),
        uv_index: _translate('UV index'),
        pollen: _translate('Pollen'),
        regulatedPollution: _translate('Regulated pollution'),
        regulated_pollution: _translate('Regulated pollution'),
        atmosphericContext: _translate('Atmospheric irritants'),
        atmosphericIrritants: _translate('Atmospheric irritants'),
        atmospheric_irritant: _translate('Atmospheric irritants'),
    };
}

function _formatFactor(mainFactor) {
    const labels = _factorLabels();
    const label = labels[mainFactor.factorId] || _translate('Unknown');
    const change = _formatSignedPercentageChange(mainFactor.percentageChange);

    if (change !== null) {
        return _replace(_translate('{label} ({change})'), {
            label,
            change,
        });
    }

    return label;
}

/**
 * Set the translation function used by daily-summary formatting.
 *
 * @param {Function} translator - Gettext-compatible translator.
 */
var setTranslator = function(translator) {
    _translate = typeof translator === 'function'
        ? translator
        : function(text) {
            return text;
        };
};

/**
 * Reset translations to identity. Primarily useful for tests.
 */
var resetTranslator = function() {
    _translate = function(text) {
        return text;
    };
};

/**
 * Return the compact emoji marker for an AirAware risk category.
 *
 * @param {string|Object} category - Category id or category object.
 * @returns {string} Category emoji.
 */
var getRiskCategoryEmoji = function(category) {
    const id = _categoryId(category);

    if (id === 'low')
        return '🟢';

    if (id === 'moderate')
        return '🟡';

    if (id === 'high')
        return '🟠';

    if (id === 'very-high' || id === 'very_high')
        return '🔴';

    return '⚪';
};

/**
 * Return the compact emoji marker for a summary main-factor group.
 *
 * @param {string} factorGroup - Canonical factor group.
 * @returns {string} Factor emoji.
 */
var getDailySummaryFactorEmoji = function(factorGroup) {
    if (factorGroup === 'pollen')
        return '🌾';

    if (factorGroup === 'regulated_pollution' ||
        factorGroup === 'pollution' ||
        factorGroup === 'atmospheric_irritant' ||
        factorGroup === 'dust' ||
        factorGroup === 'smoke')
        return '🌬️';

    if (factorGroup === 'mold')
        return '🍄';

    if (factorGroup === 'uv')
        return '☀️';

    return '🔎';
};

/**
 * Format a canonical daily summary model as compact plain UTF-8 text.
 *
 * @param {Object} summary - Model from dailySummaryBuilder.buildDailySummary().
 * @returns {string} Shareable plain text.
 */
var formatDailySummary = function(summary) {
    if (!_isObject(summary) || summary.available !== true || !summary.score)
        return '';

    let sections = [];
    let title = `😷 ${_translate('AirAware')}`;

    if (summary.location &&
        summary.location.hidden !== true &&
        summary.location.available === true &&
        typeof summary.location.displayName === 'string' &&
        summary.location.displayName !== '')
        title = `${title} — ${summary.location.displayName}`;

    let header = title;

    if (typeof summary.dateLabel === 'string' && summary.dateLabel !== '')
        header = `${header}\n📅 ${summary.dateLabel}`;

    sections.push(header);

    const scoreLabel = _scoreLabel(summary.score.effectiveType);
    sections.push([
        `🎯 ${scoreLabel}`,
        `${getRiskCategoryEmoji(summary.score.category)} ${_formatScoreLine(summary.score)}`,
    ].join('\n'));

    if (summary.mainFactor && summary.mainFactor.available === true) {
        sections.push([
            `${getDailySummaryFactorEmoji(summary.mainFactor.factorGroup)} ${_translate('Main factor')}`,
            _formatFactor(summary.mainFactor),
        ].join('\n'));
    }

    if (summary.bestOutdoorWindow && summary.bestOutdoorWindow.available === true) {
        const label = summary.bestOutdoorWindow.label ||
            Formatter.formatTimeRange(
                summary.bestOutdoorWindow.startTime,
                summary.bestOutdoorWindow.endTime
            );

        if (label !== '' && label !== Formatter.formatTimeRange(null, null)) {
            sections.push([
                `🌤️ ${_translate('Best outdoor window')}`,
                label,
            ].join('\n'));
        }
    }

    if (summary.uvPeak && summary.uvPeak.available === true) {
        const category = _formatCategory(summary.uvPeak.category);
        const time = summary.uvPeak.timeLabel || Formatter.formatTimeLabel(summary.uvPeak.time);

        sections.push([
            `☀️ ${_translate('UV peak')}`,
            _replace(_translate('{category} at {time}'), {
                category,
                time,
            }),
        ].join('\n'));
    }

    if (summary.freshness && summary.freshness.stale === true)
        sections.push(`💾 ${_translate('Cached data')}`);

    const providerLabels = summary.attribution &&
        Array.isArray(summary.attribution.providerLabels)
        ? summary.attribution.providerLabels.filter(label =>
            typeof label === 'string' && label !== ''
        )
        : [];
    const providers = providerLabels.length > 0
        ? providerLabels.join(', ')
        : 'Open-Meteo';

    sections.push(`ℹ️ ${_translate('Environmental conditions only — not medical advice.')}\n` +
        `📡 ${_replace(_translate('Data: {providers}'), {
        providers,
    })}`);

    return sections
        .filter(section => typeof section === 'string' && section.trim() !== '')
        .join('\n\n')
        .trim();
};
