function classifyAlarmDueState({ dueMs, nowMs, graceMs }) {
  const due = Number(dueMs);
  const now = Number(nowMs);
  const grace = Math.max(0, Number(graceMs) || 0);
  if (!Number.isFinite(due) || !Number.isFinite(now) || !Number.isFinite(grace)) return "future";
  if (due > now) return "future";
  if (now - due <= grace) return "due";
  return "missed";
}

function shouldRescheduleAfterTick({ lastTickMs, nowMs, intervalMs }) {
  const last = Number(lastTickMs);
  const now = Number(nowMs);
  const interval = Math.max(0, Number(intervalMs) || 0);

  if (!Number.isFinite(last) || !Number.isFinite(now) || !Number.isFinite(interval)) return false;
  if (last <= 0) return false;
  const delta = now - last;
  if (delta < 0) return true; // wall-clock moved backwards

  const jitterToleranceMs = Math.max(2500, Math.min(15000, Math.round(interval * 0.5)));
  return delta > interval + jitterToleranceMs;
}

var classifyAlarmDueState = classifyAlarmDueState;
var shouldRescheduleAfterTick = shouldRescheduleAfterTick;

