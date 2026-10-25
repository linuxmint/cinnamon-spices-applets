const Limits = imports.lib.alarmLimits;

const MAX_DATE_MS = 8640000000000000;

function _isValidDueMs(value) {
  return Number.isSafeInteger(value) && value > 0 && value <= MAX_DATE_MS;
}

function serializeAlarms(alarms) {
  if (!Array.isArray(alarms)) return [];

  const stored = [];
  for (const alarm of alarms) {
    if (stored.length >= Limits.MAX_ALARMS) break;
    if (!alarm || !alarm.due || typeof alarm.due.getTime !== "function") continue;

    const dueMs = alarm.due.getTime();
    if (!_isValidDueMs(dueMs)) continue;

    const label = typeof alarm.label === "string" ? alarm.label.slice(0, Limits.MAX_TEXT_LENGTH) : "";
    stored.push({ dueMs, label, showSeconds: alarm.showSeconds === true });
  }
  return stored;
}

function deserializeAlarms(value) {
  if (!Array.isArray(value)) return [];

  const alarms = [];
  for (const stored of value) {
    if (alarms.length >= Limits.MAX_ALARMS) break;
    if (!stored || typeof stored !== "object" || !_isValidDueMs(stored.dueMs)) continue;

    const label = typeof stored.label === "string" ? stored.label.slice(0, Limits.MAX_TEXT_LENGTH) : "";
    alarms.push({
      due: new Date(stored.dueMs),
      label,
      showSeconds: stored.showSeconds === true,
    });
  }
  return alarms;
}

var serializeAlarms = serializeAlarms;
var deserializeAlarms = deserializeAlarms;
