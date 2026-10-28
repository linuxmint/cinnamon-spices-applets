/**
 * Pure logic for the Darker applet: no Cinnamon/GI imports, so it can be unit-tested in Node.
 *
 * A "level" is the darkness in [0, MAX_LEVEL], where 0 means no darkening and 1 would be
 * a fully black screen. It is used directly as the overlay's alpha.
 *
 * Users never see the level itself: the UI shows brightness (100% = off, lower = darker), and
 * the slider runs from darkest (left) to off (right), like Cinnamon's brightness slider.
 */

/** Hard cap so the screen can never be blacked out completely. */
const MAX_LEVEL = 0.9;

/** Clutter opacity of a fully opaque actor. */
const MAX_OPACITY = 255;

/** Darkness change per mouse-wheel step, in percent. Scrolling snaps to multiples of it. */
const SCROLL_STEP_PERCENT = 5;

/**
 * Clamps a level to [0, MAX_LEVEL]. Anything that is not a finite number becomes 0.
 * @param {number} level
 * @returns {number}
 */
function clampLevel(level) {
    if (typeof level !== 'number' || !Number.isFinite(level)) return 0;
    return Math.min(Math.max(level, 0), MAX_LEVEL);
}

/**
 * Maps a slider position in [0, 1] to a level. The whole slider spans MAX_LEVEL..0, so the
 * right end (1) means no darkening.
 * @param {number} value
 * @returns {number}
 */
function sliderToLevel(value) {
    return clampLevel((1 - value) * MAX_LEVEL);
}

/**
 * Inverse of sliderToLevel.
 * @param {number} level
 * @returns {number}
 */
function levelToSlider(level) {
    return 1 - clampLevel(level) / MAX_LEVEL;
}

/**
 * Converts a level to a Clutter opacity (integer 0..255).
 * @param {number} level
 * @returns {number}
 */
function levelToOpacity(level) {
    return Math.round(clampLevel(level) * MAX_OPACITY);
}

/**
 * Level (darkness) as a rounded integer percentage.
 * @param {number} level
 * @returns {number}
 */
function toPercent(level) {
    return Math.round(clampLevel(level) * 100);
}

/**
 * Brightness shown to the user as a rounded integer percentage: 100 = off, 10 = darkest.
 * @param {number} level
 * @returns {number}
 */
function brightnessPercent(level) {
    return 100 - toPercent(level);
}

/** Default translation function: returns the English text unchanged (used by the tests). */
function untranslated(text) {
    return text;
}

/**
 * Fills a translated template's %d with a number and turns %% into %. Translators can move
 * the number or add a space ("%d %%"), as in printf.
 * @param {string} template
 * @param {number} value
 * @returns {string}
 */
function formatPercent(template, value) {
    return template.replace(/%([d%])/g, (_match, conversion) =>
        conversion === 'd' ? String(value) : '%',
    );
}

/**
 * Text shown next to the panel icon: empty while off, so only the icon is visible.
 * @param {number} level
 * @param {function(string): string} [_] - gettext function of the applet's text domain
 * @returns {string}
 */
function panelLabel(level, _ = untranslated) {
    const percent = brightnessPercent(level);
    // Translators: panel label, %d is the screen brightness in percent ("60%")
    return percent === 100 ? '' : formatPercent(_('%d%%'), percent);
}

/**
 * Tooltip of the panel icon.
 * @param {number} level
 * @param {function(string): string} [_] - gettext function of the applet's text domain
 * @returns {string}
 */
function tooltipText(level, _ = untranslated) {
    const percent = brightnessPercent(level);
    if (percent === 100) return _('Darker: off');
    // Translators: tooltip, %d is the screen brightness in percent
    return formatPercent(_('Darker: %d%% brightness'), percent);
}

/**
 * Menu item that turns darkening off.
 * @param {function(string): string} [_] - gettext function of the applet's text domain
 * @returns {string}
 */
function resetLabel(_ = untranslated) {
    // Translators: menu item that turns darkening off, %d is 100 (full brightness)
    return formatPercent(_('Reset to %d%%'), brightnessPercent(0));
}

/**
 * Moves a level by whole scroll steps, snapping to the SCROLL_STEP_PERCENT grid:
 * from 37% darkness, one step darker gives 40% and one step brighter gives 35%.
 * @param {number} level
 * @param {number} steps - positive = darker, negative = brighter
 * @returns {number}
 */
function stepLevel(level, steps) {
    const gridIndex = toPercent(level) / SCROLL_STEP_PERCENT;
    if (steps > 0) return clampLevel(((Math.floor(gridIndex) + steps) * SCROLL_STEP_PERCENT) / 100);
    if (steps < 0) return clampLevel(((Math.ceil(gridIndex) + steps) * SCROLL_STEP_PERCENT) / 100);
    return clampLevel(level);
}

/**
 * Maps a Clutter scroll direction to darkness steps: up = brighter (like Cinnamon's
 * brightness applet), down = darker. Other directions (left, right, smooth) are ignored.
 * @param {number} direction - value of Clutter.ScrollDirection
 * @param {object} ScrollDirection - the Clutter.ScrollDirection enum (injected to stay pure)
 * @returns {number} -1, 0 or 1
 */
function scrollSteps(direction, ScrollDirection) {
    if (direction === ScrollDirection.UP) return -1;
    if (direction === ScrollDirection.DOWN) return 1;
    return 0;
}

module.exports = {
    MAX_LEVEL,
    MAX_OPACITY,
    SCROLL_STEP_PERCENT,
    clampLevel,
    stepLevel,
    scrollSteps,
    sliderToLevel,
    levelToSlider,
    levelToOpacity,
    toPercent,
    brightnessPercent,
    formatPercent,
    panelLabel,
    tooltipText,
    resetLabel,
};
