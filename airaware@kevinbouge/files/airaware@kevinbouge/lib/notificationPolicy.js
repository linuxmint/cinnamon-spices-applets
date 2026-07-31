/* exported shouldNotifyRiskChange */

const DISABLED = 'disabled';
const HIGH_ONLY = 'high';
const HIGH_AND_VERY_HIGH = 'high-very-high';

function _categoryId(category) {
    if (typeof category === 'string')
        return category;

    if (category && typeof category.id === 'string')
        return category.id;

    return null;
}

/**
 * Decide whether a risk category transition should produce a notification.
 *
 * Notifications are intentionally transition-based so repeated refreshes with
 * the same category do not spam the user.
 *
 * @param {string|Object|null} previousCategory - Previous category id or object.
 * @param {string|Object|null} currentCategory - Current category id or object.
 * @param {string} notificationLevel - Settings value.
 * @returns {boolean} True when this transition should notify.
 */
var shouldNotifyRiskChange = function(previousCategory, currentCategory, notificationLevel) {
    const previousId = _categoryId(previousCategory);
    const currentId = _categoryId(currentCategory);

    if (notificationLevel === DISABLED)
        return false;

    if (previousId === null || currentId === null)
        return false;

    if (previousId === currentId)
        return false;

    if (notificationLevel === HIGH_ONLY)
        return currentId === 'high';

    if (notificationLevel === HIGH_AND_VERY_HIGH)
        return currentId === 'high' || currentId === 'very-high';

    return false;
};
