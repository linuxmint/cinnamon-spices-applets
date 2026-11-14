function getRingRetryDelay(startedAtMs, nowMs, minIntervalMs = 500) {
  const started = Number(startedAtMs);
  const now = Number(nowMs);
  const minimum = Math.max(1, Number(minIntervalMs) || 500);
  if (!Number.isFinite(started) || !Number.isFinite(now)) return minimum;
  return Math.max(1, minimum - Math.max(0, now - started));
}

var getRingRetryDelay = getRingRetryDelay;
