/**
 * Formats the time difference between now and a past date as a human-readable string.
 * @param {Date} dueDate - The date to compare against
 * @param {number} nowMs - Current time in milliseconds (Date.now())
 * @param {function} _ - Translation function (returns input if not provided)
 * @returns {string} Human-readable time ago string
 */
function formatTimeAgo(dueDate, nowMs, _) {
  _ = _ || ((s) => s);

  const diffMs = nowMs - dueDate.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);

  if (diffSec < 5) return _("just now");
  if (diffSec < 60) return _("%d seconds ago").replace("%d", diffSec);
  if (diffMin === 1) return _("1 minute ago");
  if (diffMin < 60) return _("%d minutes ago").replace("%d", diffMin);
  if (diffHr === 1) return _("1 hour ago");
  return _("%d hours ago").replace("%d", diffHr);
}

var formatTimeAgo = formatTimeAgo;
