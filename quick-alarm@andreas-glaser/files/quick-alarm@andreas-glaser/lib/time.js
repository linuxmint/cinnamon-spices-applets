function _pad2(n) {
  return String(n).padStart(2, "0");
}

function formatTimeHHMM(date) {
  return `${_pad2(date.getHours())}:${_pad2(date.getMinutes())}`;
}

function formatTimeHHMMSS(date) {
  return `${_pad2(date.getHours())}:${_pad2(date.getMinutes())}:${_pad2(date.getSeconds())}`;
}

function formatTime(date, showSeconds = false) {
  return showSeconds ? formatTimeHHMMSS(date) : formatTimeHHMM(date);
}

function _splitLabel(raw) {
  // Support separators like: "in 10m - tea", "11am — standup"
  const m = raw.match(/^(.*?)(?:\s[-–—]\s)(.+)$/);
  if (!m) return { spec: raw.trim(), label: "" };
  return { spec: m[1].trim(), label: m[2].trim() };
}

function _normalizeSpec(raw) {
  return raw
    .replace(/^[\s,;:.!?]+/, "")
    .replace(/^(set|add|new)\s+/i, "")
    .replace(/^(an?\s+)?(alarm|reminder|timer)\s+/i, "")
    .replace(/^(at|for)\s+/i, "")
    .trim();
}

function _parseAbsoluteTime(part) {
  const s = part.trim().toLowerCase();
  // Accept:
  // - "11", "11am", "11 am"
  // - "11:30", "11:30pm", "11:30 pm"
  // - "11.30", "11.30pm"
  const m = s.match(/^(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?$/);
  if (!m) return null;

  let hour = Number(m[1]);
  const minute = m[2] ? Number(m[2]) : 0;
  const ampm = m[3] || null;

  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  if (minute < 0 || minute > 59) return null;

  if (ampm) {
    if (hour < 1 || hour > 12) return null;
    if (ampm === "am") hour = hour % 12;
    if (ampm === "pm") hour = (hour % 12) + 12;
  } else {
    if (hour < 0 || hour > 23) return null;
  }

  return { hour, minute };
}

function _parseRelative(spec) {
  const s = spec.trim().toLowerCase();
  let rest = s;
  const m = s.match(/^(in|after)\s+(.+)$/);
  if (m) rest = m[2].trim();

  // Important: order longest -> shortest so "seconds" doesn't match just "s".
  const re = /^(\d+)\s*(hours?|hrs?|hr|h|minutes?|mins?|min|m|seconds?|secs?|sec|s)\s*/;
  let totalMs = 0;
  let matchedAny = false;
  // Relative alarms should always show seconds because the trigger time inherits
  // the current seconds (e.g. now 08:33:32 + 5m => 08:38:32).
  let showSeconds = true;

  while (rest.length > 0) {
    const r = rest.match(re);
    if (!r) break;
    matchedAny = true;
    const value = Number(r[1]);
    const unit = r[2];
    if (!Number.isFinite(value) || value < 0) return null;
    if (unit.startsWith("h")) totalMs += value * 60 * 60 * 1000;
    else if (unit.startsWith("m")) totalMs += value * 60 * 1000;
    else {
      totalMs += value * 1000;
    }
    rest = rest.slice(r[0].length);
  }

  if (!matchedAny) return null;
  if (totalMs <= 0) return null;

  return { delayMs: totalMs, label: rest.trim(), showSeconds };
}

function parseAlarmSpec(input, now = new Date(), t = null) {
  const _t = typeof t === "function" ? t : (s) => s;
  const raw = String(input || "").trim();
  function errorWithExamples(prefix) {
    return [
      _t(prefix),
      "",
      _t("Try one of these:"),
      "• in 10m tea",
      "• after 5m - stretch",
      "• 5 seconds",
      "• 11am standup",
      "• tomorrow 11:30 - reset",
    ].join("\n");
  }
  if (!raw) return { ok: false, error: errorWithExamples("Enter a time.") };

  const split = _splitLabel(raw);
  let spec = _normalizeSpec(split.spec);
  if (!spec) return { ok: false, error: errorWithExamples("Enter a time.") };

  // Day hints (optional): "today 11am", "tomorrow 11am"
  let dayHint = null; // "today" | "tomorrow"
  const dayMatch = spec.match(/^(today|tomorrow|tmr)\s+(.+)$/i);
  if (dayMatch) {
    dayHint = dayMatch[1].toLowerCase();
    if (dayHint === "tmr") dayHint = "tomorrow";
    // Normalize again so inputs like "tomorrow at 11am" work.
    spec = _normalizeSpec(dayMatch[2]);
  }

  const rel = _parseRelative(spec);
  if (rel) {
    return {
      ok: true,
      due: new Date(now.getTime() + rel.delayMs),
      label: split.label || rel.label || "",
      showSeconds: !!rel.showSeconds,
    };
  }

  function looksTimeToken(tok) {
    return /^\d{1,2}([:.]\d{2})?$/.test(tok);
  }

  function looksAmPm(tok) {
    return /^(am|pm)$/i.test(tok);
  }

  // Normalize token stream so these work:
  // - "11 am tea" -> "11am tea"
  // - "claude at 11:59 am" -> "claude 11:59am"
  let parts = [];
  const rawParts = spec.split(/\s+/).filter(Boolean);
  for (let i = 0; i < rawParts.length; i++) {
    const tok = rawParts[i];
    if (tok.toLowerCase() === "at") continue;
    if (looksTimeToken(tok) && i + 1 < rawParts.length && looksAmPm(rawParts[i + 1])) {
      parts.push(tok + rawParts[i + 1]);
      i++;
      continue;
    }
    parts.push(tok);
  }

  // Support "label time" and "label at time" (e.g. "claude 11:59am", "claude at 11:59am").
  let timePart = parts[0];
  let label = split.label || parts.slice(1).join(" ").trim();
  let abs = _parseAbsoluteTime(timePart);
  if (!abs && parts.length >= 2) {
    const tail = parts[parts.length - 1];
    const tailAbs = _parseAbsoluteTime(tail);
    if (tailAbs) {
      abs = tailAbs;
      timePart = tail;
      label = split.label || parts.slice(0, parts.length - 1).join(" ").trim();
    }
  }
  if (!abs) return { ok: false, error: errorWithExamples("Could not parse that.") };

  const due = new Date(now.getTime());
  due.setSeconds(0, 0);
  due.setHours(abs.hour, abs.minute, 0, 0);
  if (dayHint === "tomorrow") {
    due.setDate(due.getDate() + 1);
  } else if (dayHint === "today") {
    if (due.getTime() <= now.getTime())
      return { ok: false, error: errorWithExamples("That time already passed today.") };
  } else {
    if (due.getTime() <= now.getTime()) due.setDate(due.getDate() + 1);
  }

  return { ok: true, due, label, showSeconds: false };
}

var formatTime = formatTime;
var formatTimeHHMM = formatTimeHHMM;
var formatTimeHHMMSS = formatTimeHHMMSS;
var parseAlarmSpec = parseAlarmSpec;
