'use strict';

function responsiveLayout(workAreaWidth, workAreaHeight) {
  const width = Number(workAreaWidth);
  const height = Number(workAreaHeight);
  const safeWidth = Number.isFinite(width) && width > 0 ? Math.floor(width) : 1920;
  const safeHeight = Number.isFinite(height) && height > 0
    ? Math.floor(height) : 1040;
  const contentWidth = Math.min(640, Math.max(280, safeWidth - 52));
  const scrollMaxHeight = Math.min(752, Math.max(280, safeHeight - 48));
  return {
    contentWidth,
    scrollMaxHeight,
    compact: contentWidth < 520,
  };
}

function _format(template, ...values) {
  let index = 0;
  return String(template).replace(/%%|%s/g, token => {
    if (token === '%%')
      return '%';
    const value = index < values.length ? values[index] : token;
    index += 1;
    return String(value);
  });
}

function formatDuration(seconds, translate = text => text) {
  const _ = translate;
  const safeSeconds = Math.max(0, Math.floor(Number(seconds) || 0));
  if (safeSeconds === 0)
    return _('now');
  if (safeSeconds < 60)
    return _('<1m');
  const minutes = Math.floor(safeSeconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) {
    const remainingHours = hours % 24;
    return remainingHours > 0
      ? _format(_('%sd %sh'), days, remainingHours)
      : _format(_('%sd'), days);
  }
  if (hours > 0) {
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0
      ? _format(_('%sh %sm'), hours, remainingMinutes)
      : _format(_('%sh'), hours);
  }
  return _format(_('%sm'), minutes);
}

function staleThresholdSeconds(refreshInterval) {
  const interval = Number(refreshInterval);
  const safeInterval = Number.isFinite(interval) && interval > 0 ? interval : 60;
  return Math.max(300, Math.floor(safeInterval * 2));
}

function nextRemotePollState(previousState, incomingStatus, failed, now) {
  const previous = previousState && typeof previousState === 'object'
    ? previousState : { value: null, failureCount: 0, lastSuccessAt: null };
  const timestamp = Number.isFinite(Number(now)) ? Math.floor(Number(now)) : 0;
  const validIncoming = incomingStatus && typeof incomingStatus === 'object' &&
    typeof incomingStatus.status === 'string';
  if (!failed && validIncoming) {
    return {
      value: {
        ...incomingStatus,
        stale: false,
        lastSuccessAt: timestamp,
      },
      failureCount: 0,
      lastSuccessAt: timestamp,
    };
  }

  const failureCount = Number(previous.failureCount || 0) + 1;
  const lastSuccessAt = Number.isFinite(Number(previous.lastSuccessAt))
    ? Number(previous.lastSuccessAt) : null;
  const age = lastSuccessAt == null ? Infinity : Math.max(0, timestamp - lastSuccessAt);
  if (failureCount < 3 && age <= 15 && isUsableRemoteStatus(previous.value)) {
    return {
      value: {
        ...previous.value,
        stale: true,
        lastSuccessAt,
      },
      failureCount,
      lastSuccessAt,
    };
  }
  return {
    value: { status: 'errored', stale: true, lastSuccessAt },
    failureCount,
    lastSuccessAt,
  };
}

function panelState(snapshot, settings, now, remoteStatus, translate = text => text) {
  const _ = translate;
  const windows = snapshot.windows || {};
  const fiveHour = windows.fiveHour;
  const weekly = windows.weekly;
  const quotaWindows = [
    { name: _('5-hour'), window: fiveHour },
    { name: _('Weekly'), window: weekly },
  ].filter(item => item.window && Number.isFinite(Number(item.window.usedPercent)));
  const highestWindow = quotaWindows.reduce((highestValue, item) =>
    highestValue == null || Number(item.window.usedPercent) >
      Number(highestValue.window.usedPercent) ? item : highestValue, null);
  const highest = highestWindow ? Number(highestWindow.window.usedPercent) : 0;
  let level = 'normal';
  if (highest >= Number(settings.criticalThreshold || 90))
    level = 'critical';
  else if (highest >= Number(settings.warningThreshold || 70))
    level = 'warning';

  const resetCredits = snapshot.resetCredits || { availableCount: 0, credits: [] };
  const availableCredits = (resetCredits.credits || [])
    .filter(credit => credit.status === 'available' && credit.expiresAt != null);
  const expiryWarningSeconds = Number(settings.resetExpiryWarningHours || 72) * 3600;
  const expiryTimes = availableCredits
    .map(credit => Number(credit.expiresAt))
    .filter(expiresAt => Number.isFinite(expiresAt) && expiresAt >= now)
    .sort((left, right) => left - right);
  const nearestExpiry = expiryTimes.length > 0 ? expiryTimes[0] : null;
  const resetExpiring = nearestExpiry != null &&
    nearestExpiry - now <= expiryWarningSeconds;
  const stale = now - Number(snapshot.capturedAt || 0) >
    Number(settings.staleSeconds || 300);
  const resetCount = Number(resetCredits.availableCount) || 0;
  const indicators = [];
  if (level !== 'normal' && highestWindow) {
    const quotaText = level === 'critical'
      ? _('%s quota critical: %s%% used')
      : _('%s quota warning: %s%% used');
    indicators.push({
      kind: 'quota',
      severity: level,
      symbol: '!',
      text: _format(quotaText, highestWindow.name, Math.round(highest)),
    });
  }
  if (settings.showResetBadge !== false && resetCount > 0) {
    const secondsUntilExpiry = nearestExpiry == null ? null : nearestExpiry - now;
    indicators.push({
      kind: 'reset',
      severity: resetExpiring
        ? secondsUntilExpiry <= 6 * 3600 ? 'critical' : 'warning'
        : 'info',
      symbol: resetExpiring ? '⚠' : '↻',
      panelSymbol: `${resetExpiring ? '⚠' : '↻'}${resetCount}`,
      text: resetExpiring
        ? _format(_('Banked reset expires in %s'),
          formatDuration(secondsUntilExpiry, translate))
        : _format(resetCount === 1
          ? _('%s banked reset available')
          : _('%s banked resets available'), resetCount),
    });
  }
  if (settings.showRemoteBadge !== false && remoteStatus &&
      remoteStatus.status !== 'disabled') {
    const remoteIndicators = {
      connecting: {
        severity: 'warning', symbol: '◐', text: _('Remote Control connecting'),
      },
      running: {
        severity: 'warning', symbol: '◐',
        text: _('Remote Control running; connection state unavailable'),
      },
      connected: {
        severity: 'success', symbol: '●', text: _('Remote Control connected'),
      },
      errored: {
        severity: 'critical', symbol: '!', text: _('Remote Control error'),
      },
    };
    const remoteIndicator = remoteStatus.stale && remoteStatus.status !== 'errored'
      ? {
        severity: 'warning', symbol: '◐',
        text: _('Remote Control status delayed'),
      }
      : remoteIndicators[remoteStatus.status] ||
      { severity: 'critical', symbol: '!', text: _('Remote Control status unknown') };
    indicators.push({ kind: 'remote', ...remoteIndicator });
  }
  if (stale) {
    indicators.push({
      kind: 'stale',
      severity: 'critical',
      symbol: '!',
      text: _('Usage data stale'),
    });
  }
  const resetIndicator = indicators.find(indicator => indicator.kind === 'reset');
  const remoteIndicator = indicators.find(indicator => indicator.kind === 'remote');

  return {
    label: `5h ${formatPercent(fiveHour)}  W ${formatPercent(weekly)}`,
    level,
    stale,
    staleBadge: stale ? '!' : '',
    indicators,
    indicatorText: indicators.map(indicator => indicator.text).join(' · '),
    resetBadge: resetIndicator
      ? resetIndicator.panelSymbol || resetIndicator.symbol : '',
    resetSeverity: resetIndicator ? resetIndicator.severity : null,
    resetExpiring,
    resetExpiryText: resetExpiring
      ? _format(_('Reset expires in %s'),
        formatDuration(nearestExpiry - now, translate))
      : '',
    remoteBadge: remoteIndicator ? remoteIndicator.symbol : '',
    remoteSeverity: remoteIndicator ? remoteIndicator.severity : null,
  };
}

function quotaSeries(history, windowName, cutoff, now) {
  const prefix = windowName === 'weekly' ? 'weekly' : 'fiveHour';
  const usedKey = `${prefix}UsedPercent`;
  const resetKey = `${prefix}ResetsAt`;
  const windowSeconds = windowName === 'weekly' ? 7 * 24 * 3600 : 5 * 3600;
  const rawPoints = (history || [])
    .filter(row => Number(row.capturedAt) >= cutoff && Number(row.capturedAt) <= now)
    .filter(row => row[usedKey] != null)
    .slice()
    .sort((left, right) => Number(left.capturedAt) - Number(right.capturedAt))
    .map(row => ({
      timestamp: Number(row.capturedAt),
      usedPercent: Number(row[usedKey]),
      resetsAt: row[resetKey] != null ? Number(row[resetKey]) : null,
    }));
  const previousPositive = [];
  let previous = null;
  for (const point of rawPoints) {
    previousPositive.push(previous);
    if (point.usedPercent > 0)
      previous = point;
  }
  const nextPositive = Array(rawPoints.length).fill(null);
  let next = null;
  for (let index = rawPoints.length - 1; index >= 0; index -= 1) {
    nextPositive[index] = next;
    if (rawPoints[index].usedPercent > 0)
      next = rawPoints[index];
  }
  const sameCycle = (left, right) => left && right && left.resetsAt != null &&
    right.resetsAt != null && Math.abs(left.resetsAt - right.resetsAt) <= 300;
  const points = rawPoints
    .filter((point, index) => point.usedPercent !== 0 ||
      !sameCycle(previousPositive[index], nextPositive[index]) ||
      sameCycle(point, previousPositive[index]))
    .map((point, index, visiblePoints) => ({
      ...point,
      resetTransition: index > 0 && visiblePoints[index - 1].resetsAt != null &&
        point.resetsAt != null &&
        point.resetsAt - visiblePoints[index - 1].resetsAt >= windowSeconds / 2 &&
        point.usedPercent <= visiblePoints[index - 1].usedPercent,
    }));
  return downsampleQuota(points, 1200);
}

function _evenlySample(items, maximum) {
  if (items.length <= maximum)
    return items;
  if (maximum <= 1)
    return items.slice(0, maximum);
  return Array.from({ length: maximum }, (_unused, index) =>
    items[Math.round(index * (items.length - 1) / (maximum - 1))]);
}

function downsampleQuota(points, maximumPoints = 1200) {
  const values = Array.isArray(points) ? points : [];
  const limit = Math.max(2, Math.floor(Number(maximumPoints) || 1200));
  if (values.length <= limit)
    return values;

  const mandatory = new Set([0, values.length - 1]);
  values.forEach((point, index) => {
    if (point.resetTransition)
      mandatory.add(index);
  });
  if (mandatory.size >= limit) {
    const indices = _evenlySample(Array.from(mandatory).sort((a, b) => a - b), limit);
    indices[0] = 0;
    indices[indices.length - 1] = values.length - 1;
    return Array.from(new Set(indices)).sort((a, b) => a - b).map(index => values[index]);
  }

  const selected = new Set(mandatory);
  const capacity = limit - selected.size;
  const bucketCount = Math.max(1, Math.floor(capacity / 2));
  for (let bucket = 0; bucket < bucketCount && selected.size < limit; bucket += 1) {
    const start = Math.floor(bucket * values.length / bucketCount);
    const end = Math.max(start + 1, Math.floor((bucket + 1) * values.length / bucketCount));
    let minimumIndex = start;
    let maximumIndex = start;
    for (let index = start + 1; index < end; index += 1) {
      if (Number(values[index].usedPercent) < Number(values[minimumIndex].usedPercent))
        minimumIndex = index;
      if (Number(values[index].usedPercent) > Number(values[maximumIndex].usedPercent))
        maximumIndex = index;
    }
    selected.add(minimumIndex);
    if (selected.size < limit)
      selected.add(maximumIndex);
  }
  return Array.from(selected)
    .sort((left, right) => left - right)
    .slice(0, limit)
    .map(index => values[index]);
}

function quotaSegments(points, rangeHours) {
  const thresholds = Number(rangeHours) <= 24
    ? 2 * 3600
    : Number(rangeHours) <= 168 ? 12 * 3600 : 36 * 3600;
  const ordered = (points || [])
    .slice()
    .sort((left, right) => Number(left.timestamp) - Number(right.timestamp));
  const segments = [];
  for (const point of ordered) {
    const current = segments[segments.length - 1];
    const previous = current && current[current.length - 1];
    if (!current || Number(point.timestamp) - Number(previous.timestamp) > thresholds)
      segments.push([point]);
    else
      current.push(point);
  }
  return segments;
}

function formatPercent(window) {
  return window && window.usedPercent != null
    ? `${Math.round(Number(window.usedPercent))}%`
    : '—';
}

function tooltipText(snapshot, now, remoteStatus, translate = text => text) {
  const _ = translate;
  const windows = snapshot.windows || {};
  const lineForWindow = (name, window) => {
    if (!window)
      return _format(_('%s: unavailable'), name);
    if (window.resetsAt != null) {
      return _format(_('%s: %s%% used · resets in %s'), name,
        Math.round(Number(window.usedPercent)),
        formatDuration(Number(window.resetsAt) - now, translate));
    }
    return _format(_('%s: %s%% used · reset time unavailable'), name,
      Math.round(Number(window.usedPercent)));
  };
  const capturedAge = formatDuration(
    now - Number(snapshot.capturedAt || now), translate
  );
  const resetCount = Number((snapshot.resetCredits || {}).availableCount || 0);
  const expiringCredits = ((snapshot.resetCredits || {}).credits || [])
    .filter(credit => credit.status === 'available' && credit.expiresAt != null)
    .map(credit => Number(credit.expiresAt))
    .filter(expiresAt => Number.isFinite(expiresAt) && expiresAt >= now)
    .sort((left, right) => left - right);
  const resetLine = expiringCredits.length > 0
    ? _format(_('Banked resets: %s · nearest expiry in %s'), resetCount,
      formatDuration(expiringCredits[0] - now, translate))
    : _format(_('Banked resets: %s'), resetCount);
  const lines = [
    lineForWindow(_('5-hour'), windows.fiveHour),
    lineForWindow(_('Weekly'), windows.weekly),
    resetLine,
  ];
  if (remoteStatus) {
    const statusLabels = {
      disabled: _('disabled'),
      connecting: _('connecting'),
      running: _('running'),
      connected: _('connected'),
      errored: _('errored'),
    };
    lines.push(_format(_('Remote: %s'), remoteStatus.stale &&
      remoteStatus.status !== 'errored'
      ? _('status delayed')
      : statusLabels[remoteStatus.status] || _('unknown')));
  }
  lines.push(_format(_('Updated: %s ago'), capturedAge));
  return lines.join('\n');
}

function activitySeries(tokenUsage) {
  const buckets = tokenUsage && tokenUsage.dailyUsageBuckets
    ? tokenUsage.dailyUsageBuckets
    : [];
  const peak = buckets.reduce((maximum, bucket) =>
    Math.max(maximum, Number(bucket.tokens) || 0), 0);
  return buckets.map(bucket => {
    const tokens = Number(bucket.tokens) || 0;
    return {
      timestamp: Math.floor(Date.parse(`${bucket.startDate}T00:00:00Z`) / 1000),
      value: peak > 0 ? Math.round((tokens / peak) * 100) : 0,
      tokens,
    };
  });
}

function formatTokenCount(value) {
  const tokens = Math.max(0, Number(value) || 0);
  const compact = (amount, suffix) =>
    `${amount.toFixed(1).replace(/\.0$/, '')}${suffix}`;
  if (tokens >= 1e9)
    return compact(tokens / 1e9, 'B');
  if (tokens >= 1e6)
    return compact(tokens / 1e6, 'M');
  if (tokens >= 1e3)
    return compact(tokens / 1e3, 'K');
  return `${Math.round(tokens)}`;
}

function graphSummary(series) {
  const points = (series && series.points || [])
    .slice()
    .sort((left, right) => Number(left.timestamp) - Number(right.timestamp));
  if (points.length === 0) {
    return {
      label: series && series.label || '',
      kind: series && series.kind || 'quota',
      state: 'empty',
      current: null,
      minimum: null,
      maximum: null,
    };
  }
  const metric = point => point.tokens != null
    ? Number(point.tokens)
    : Number(point.value);
  return {
    label: series.label || '',
    kind: series.kind || 'quota',
    state: points.length === 1 ? 'insufficient' : 'ready',
    current: points[points.length - 1],
    minimum: points.reduce((best, point) => metric(point) < metric(best) ? point : best),
    maximum: points.reduce((best, point) => metric(point) > metric(best) ? point : best),
  };
}

function _pad(value) {
  return `${value}`.padStart(2, '0');
}

function _axisLabel(timestamp, rangeHours) {
  const date = new Date(Number(timestamp) * 1000);
  const time = `${_pad(date.getHours())}:${_pad(date.getMinutes())}`;
  if (Number(rangeHours) <= 24)
    return time;
  const day = `${date.getFullYear()}-${_pad(date.getMonth() + 1)}-${_pad(date.getDate())}`;
  return Number(rangeHours) <= 168 ? `${day} ${time}` : day;
}

function graphAxis(cutoff, now, rangeHours) {
  const start = Number(cutoff);
  const end = Math.max(start, Number(now));
  const middle = start + (end - start) / 2;
  return [start, middle, end].map(timestamp => ({
    timestamp,
    label: _axisLabel(timestamp, rangeHours),
  }));
}

function graphDomain(series, cutoff, now) {
  const selectedStart = Number(cutoff);
  const selectedEnd = Math.max(selectedStart, Number(now));
  const selectedSeconds = selectedEnd - selectedStart;
  const timestamps = (series || [])
    .flatMap(item => item.points || [])
    .map(point => Number(point.timestamp))
    .filter(timestamp => Number.isFinite(timestamp) &&
      timestamp >= selectedStart && timestamp <= selectedEnd);
  if (timestamps.length === 0) {
    return {
      start: selectedStart,
      end: selectedEnd,
      selectedSeconds,
      collectedSeconds: 0,
      collectionStart: null,
    };
  }
  const first = Math.min(...timestamps);
  const collectedSeconds = Math.max(0, selectedEnd - first);
  return {
    start: selectedStart,
    end: selectedEnd,
    selectedSeconds,
    collectedSeconds,
    collectionStart: first,
  };
}

function _tokenMaximum(series) {
  const peak = (series || [])
    .filter(item => item.kind === 'activity')
    .flatMap(item => item.points || [])
    .reduce((maximum, point) => Math.max(maximum, Number(point.tokens) || 0), 0);
  if (peak <= 0)
    return 1;
  const roughStep = peak / 4;
  const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
  const normalized = roughStep / magnitude;
  const stepFactor = [1, 2, 2.5, 5, 10].find(value => value >= normalized) || 10;
  const step = stepFactor * magnitude;
  return Math.ceil(peak / step) * step;
}

function _axisTicks(maximum, formatter) {
  return Array.from({ length: 5 }, (_unused, index) => {
    const value = maximum * (4 - index) / 4;
    return { value, label: formatter(value) };
  });
}

function graphAxes(series, cutoff, now, rangeHours, mode) {
  const domain = graphDomain(series, cutoff, now);
  const visibleHours = Math.max(1, (domain.end - domain.start) / 3600);
  const percentAxis = {
    kind: 'percent',
    maximum: 100,
    ticks: _axisTicks(100, value => `${Math.round(value)}%`),
  };
  const tokenMaximum = _tokenMaximum(series);
  const tokenAxis = {
    kind: 'tokens',
    maximum: tokenMaximum,
    ticks: _axisTicks(tokenMaximum, formatTokenCount),
  };
  return {
    x: graphAxis(domain.start, domain.end, visibleHours),
    left: mode === 'activity' ? tokenAxis : percentAxis,
    right: mode === 'both' ? tokenAxis : null,
    domain,
  };
}

function nearestGraphValues(series, timestamp, maximumDistance = null) {
  const target = Number(timestamp);
  return (series || [])
    .filter(item => item.points && item.points.length > 0)
    .map(item => {
      const point = item.points.reduce((best, candidate) =>
        Math.abs(Number(candidate.timestamp) - target) <
          Math.abs(Number(best.timestamp) - target) ? candidate : best);
      return { label: item.label, kind: item.kind || 'quota', ...point };
    })
    .filter(point => maximumDistance == null ||
      Math.abs(Number(point.timestamp) - target) <= Number(maximumDistance));
}

function sessionView(sessions, selectedFilter = 'all', limit = 12) {
  const source = sessions && typeof sessions === 'object' ? sessions : {};
  const active = Array.isArray(source.active) ? source.active : [];
  const recent = Array.isArray(source.recent) ? source.recent : [];
  const all = active.concat(recent).slice().sort((left, right) =>
    (Number(right.updatedAt) || 0) - (Number(left.updatedAt) || 0));
  const attention = all.filter(session =>
    Array.isArray(session.attention) && session.attention.length > 0);
  const filters = { all, active, attention, recent };
  const filter = Object.prototype.hasOwnProperty.call(filters, selectedFilter)
    ? selectedFilter : 'all';
  const maximum = Math.max(1, Math.min(50, Math.floor(Number(limit) || 12)));
  const visible = filters[filter].slice(0, maximum);
  const groups = [];
  const byProject = new Map();
  for (const session of visible) {
    const project = typeof session.project === 'string' && session.project.trim()
      ? session.project.trim() : 'Unknown project';
    let group = byProject.get(project);
    if (!group) {
      group = { project, sessions: [] };
      byProject.set(project, group);
      groups.push(group);
    }
    group.sessions.push(session);
  }
  return {
    filter,
    counts: {
      all: all.length,
      active: active.length,
      attention: attention.length,
      recent: recent.length,
    },
    groups,
    visibleCount: visible.length,
  };
}

function sessionStatusText(session, now, translate = text => text) {
  const _ = translate;
  const value = session && typeof session === 'object' ? session : {};
  const statusLabels = {
    active: _('Active'),
    idle: _('Idle'),
    notLoaded: _('Ready to resume'),
    systemError: _('System error'),
    unavailable: _('Unavailable'),
  };
  const attention = Array.isArray(value.attention) ? value.attention : [];
  let status = statusLabels[value.status] || _('Unavailable');
  if (attention.includes('waitingOnApproval'))
    status = _('Waiting for approval');
  else if (attention.includes('waitingOnUserInput'))
    status = _('Waiting for you');

  const current = Number(now);
  const activeSince = Number(value.activeSince);
  if (value.status !== 'active' || value.activeSince == null ||
      !Number.isFinite(current) || !Number.isFinite(activeSince) ||
      activeSince < 0 || activeSince > current)
    return status;
  return _format(_('%s for %s'), status,
    formatDuration(current - activeSince, translate));
}

function isUsableRemoteStatus(remoteStatus) {
  const status = remoteStatus && remoteStatus.status;
  return status === 'connecting' || status === 'connected' || status === 'running';
}

function _semanticVersion(value) {
  if (typeof value !== 'string' || value.length > 64)
    return null;
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(value);
  if (!match)
    return null;
  return {
    display: value,
    core: match.slice(1, 4).map(Number),
    prerelease: match[4] || null,
  };
}

function _isNewerSemanticVersion(candidate, current) {
  if (!candidate || !current)
    return false;
  for (let index = 0; index < 3; index += 1) {
    if (candidate.core[index] !== current.core[index])
      return candidate.core[index] > current.core[index];
  }
  return candidate.prerelease == null && current.prerelease != null;
}

function normalizeUpdateState(value) {
  const raw = value && typeof value === 'object' ? value : {};
  const installed = _semanticVersion(raw.installedVersion);
  const latest = _semanticVersion(raw.latestVersion);
  const statuses = new Set(['idle', 'checking', 'updating', 'updated', 'failed']);
  const checkedAt = raw.checkedAt == null ? Number.NaN : Number(raw.checkedAt);
  return {
    installedVersion: installed ? installed.display : null,
    latestVersion: latest ? latest.display : null,
    updateAvailable: raw.updateAvailable === true &&
      _isNewerSemanticVersion(latest, installed),
    checkedAt: Number.isFinite(checkedAt) && checkedAt >= 0
      ? Math.floor(checkedAt) : null,
    status: statuses.has(raw.status) ? raw.status : 'idle',
    message: null,
  };
}

function dashboardFooterText(updateState, capturedAt, usageMessage, now,
  translate = text => text) {
  const _ = translate;
  const state = normalizeUpdateState(updateState);
  const current = Number.isFinite(Number(now)) ? Math.floor(Number(now)) : 0;
  let updateText = '';
  if (state.status === 'checking') {
    updateText = state.installedVersion
      ? _format(_('Codex %s · Checking for updates…'), state.installedVersion)
      : _('Checking for Codex updates…');
  } else if (state.status === 'updating') {
    updateText = _('Updating Codex…');
  } else if (state.status === 'updated') {
    updateText = _format(
      _('Updated to Codex %s. New Codex launches use this version.'),
      state.installedVersion
    );
  } else if (state.status === 'failed') {
    updateText = state.installedVersion
      ? _format(_('Automatic update failed; Codex %s is still installed. Use the official Codex installation instructions to update manually.'),
        state.installedVersion)
      : _('Automatic Codex update failed. Use the official Codex installation instructions to update manually.');
  } else if (state.updateAvailable) {
    updateText = _format(_('Codex %s → %s'),
      state.installedVersion, state.latestVersion);
  } else if (state.installedVersion && state.checkedAt != null) {
    const elapsed = Math.max(0, current - state.checkedAt);
    updateText = elapsed === 0
      ? _format(_('Codex %s · Updates checked now'), state.installedVersion)
      : _format(_('Codex %s · Updates checked %s ago'),
        state.installedVersion, formatDuration(elapsed, translate));
  } else if (state.installedVersion) {
    updateText = _format(_('Codex %s'), state.installedVersion);
  } else if (state.checkedAt != null) {
    const elapsed = Math.max(0, current - state.checkedAt);
    updateText = elapsed === 0
      ? _('Updates checked now')
      : _format(_('Updates checked %s ago'), formatDuration(elapsed, translate));
  }

  let usageText = '';
  if (typeof usageMessage === 'string' && usageMessage.length > 0) {
    usageText = usageMessage;
  } else if (capturedAt != null && Number.isFinite(Number(capturedAt)) &&
      Number(capturedAt) >= 0) {
    const elapsed = Math.max(0, current - Number(capturedAt));
    usageText = elapsed === 0
      ? _('Usage refreshed now')
      : _format(_('Usage refreshed %s ago'), formatDuration(elapsed, translate));
  } else {
    usageText = _('No data yet');
  }
  return [updateText, usageText].filter(Boolean).join(' · ');
}

const CodexModel = {
  responsiveLayout,
  formatDuration,
  staleThresholdSeconds,
  nextRemotePollState,
  formatPercent,
  panelState,
  quotaSeries,
  quotaSegments,
  downsampleQuota,
  tooltipText,
  activitySeries,
  formatTokenCount,
  graphSummary,
  graphAxis,
  graphDomain,
  graphAxes,
  nearestGraphValues,
  sessionView,
  sessionStatusText,
  isUsableRemoteStatus,
  normalizeUpdateState,
  dashboardFooterText,
};

if (typeof module !== 'undefined' && module.exports)
  module.exports = CodexModel;
