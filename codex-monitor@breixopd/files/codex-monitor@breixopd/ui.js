'use strict';

const ByteArray = imports.byteArray;
const Clutter = imports.gi.Clutter;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Pango = imports.gi.Pango;
const St = imports.gi.St;

function _clear(actor) {
  for (const child of actor.get_children())
    child.destroy();
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

function _button(label, callback, styleClass = 'codex-monitor-button') {
  const button = new St.Button({
    label,
    style_class: styleClass,
    reactive: true,
    can_focus: true,
    track_hover: true,
    x_align: Clutter.ActorAlign.CENTER,
  });
  button.connect('clicked', callback);
  return button;
}

function _validatedQrSvg(value) {
  if (typeof value !== 'string' || value.length === 0 || value.length > 256 * 1024)
    return null;
  const safeSvg = /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 [0-9]+ [0-9]+" shape-rendering="crispEdges"><rect width="[0-9]+" height="[0-9]+" fill="#fff"\/><path d="[M0-9 hvz-]*" fill="#000"\/><\/svg>$/;
  return safeSvg.test(value) ? value : null;
}

function _updateQrSvg(container, value) {
  const child = container.get_child();
  if (child)
    child.destroy();
  const svg = _validatedQrSvg(value);
  if (!svg) {
    container.visible = false;
    return false;
  }
  try {
    const bytes = GLib.Bytes.new(ByteArray.fromString(svg));
    const icon = new St.Icon({
      gicon: Gio.BytesIcon.new(bytes),
      icon_size: 196,
      style_class: 'codex-monitor-qr-icon',
    });
    container.set_child(icon);
    container.visible = true;
    return true;
  } catch (error) {
    container.visible = false;
    return false;
  }
}

class QuotaCard {
  constructor(title, translate) {
    this._ = translate;
    this.actor = new St.BoxLayout({
      vertical: true,
      style_class: 'codex-monitor-quota-card',
      x_expand: true,
    });
    this._title = new St.Label({ text: title, style_class: 'codex-monitor-card-kicker' });
    this._percent = new St.Label({ text: '—', style_class: 'codex-monitor-percent' });
    this._reset = new St.Label({
      text: this._('Waiting for Codex…'),
      style_class: 'codex-monitor-secondary',
    });
    this.actor.add_child(this._title);
    this.actor.add_child(this._percent);
    this.actor.add_child(this._reset);
  }

  update(window, model, now) {
    if (!window) {
      this._percent.set_text(this._('Not available'));
      this._reset.set_text(this._('No limit reported for the current model'));
      return;
    }
    const percentage = Math.max(0, Math.min(100, Number(window.usedPercent)));
    this._percent.set_text(_format(_('%s%% used'), Math.round(percentage)));
    if (window.resetsAt == null) {
      this._reset.set_text(this._('Reset time unavailable'));
      return;
    }
    const countdown = model.formatDuration(Number(window.resetsAt) - now, this._);
    this._reset.set_text(_format(_('Resets in %s'), countdown));
  }
}

var Dashboard = class Dashboard {
  constructor(options) {
    this._ = options.translate;
    this._model = options.model;
    this._graph = options.graph;
    this._callbacks = options.callbacks;
    this._snapshot = null;
    this._remoteStatus = null;
    this._pairing = null;
    this._pairingStatusSupported = true;
    this._pairingStatusAvailable = true;
    this._remoteClients = [];
    this._remoteClientsSupported = true;
    this._remoteClientsAvailable = true;
    this._remoteClientsLoaded = false;
    this._remoteClientsLoading = false;
    this._remoteError = '';
    this._remoteRepairAvailable = false;
    this._sessions = { active: [], recent: [] };
    this._sessionsError = false;
    this._sessionFilter = 'all';
    this._sessionFilterButtons = {};
    this._updateState = null;
    this._settings = {};
    this._compact = false;
    this._indicators = [];

    this.actor = new St.BoxLayout({
      vertical: true,
      style_class: 'codex-monitor-dashboard',
    });
    this._buildHeader();
    this._buildQuotaCards();
    this._buildGraph();
    this._buildSessions();
    this._buildResetBank();
    this._buildRemote();
    this._buildFooter();
  }

  _buildHeader() {
    this._header = new St.BoxLayout({ style_class: 'codex-monitor-header' });
    const title = new St.Label({
      text: this._('Codex Monitor'),
      style_class: 'codex-monitor-title',
      x_expand: true,
    });
    this._status = new St.Label({
      text: this._('Connecting…'),
      style_class: 'codex-monitor-status',
    });
    this._header.add_child(title);
    this._header.add_child(this._status);
    this.actor.add_child(this._header);
    this._indicatorSection = new St.BoxLayout({
      vertical: true,
      style_class: 'codex-monitor-indicator-section',
    });
    this._indicatorSection.add_child(new St.Label({
      text: this._('Current indicators'),
      style_class: 'codex-monitor-card-kicker',
    }));
    this._indicatorList = new St.BoxLayout({
      vertical: true,
      style_class: 'codex-monitor-indicator-list',
    });
    this._indicatorSection.add_child(this._indicatorList);
    this.actor.add_child(this._indicatorSection);
    this.setIndicators([]);
  }

  setIndicators(indicators) {
    if (!this._indicatorList)
      return;
    _clear(this._indicatorList);
    const visibleIndicators = Array.isArray(indicators) ? indicators : [];
    this._indicators = visibleIndicators;
    const statusItems = visibleIndicators.length > 0 ? visibleIndicators : [{
      kind: 'current',
      severity: 'info',
      symbol: '✓',
      text: 'Usage data current',
    }];
    const indicatorsPerRow = this._compact ? 1 : 2;
    for (let index = 0; index < statusItems.length; index += indicatorsPerRow) {
      const row = new St.BoxLayout({
        style_class: 'codex-monitor-indicator-row',
      });
      for (const indicator of statusItems.slice(index, index + indicatorsPerRow)) {
        const indicatorGap = indicator.kind === 'remote' ? '  ' : ' ';
        const chip = new St.Label({
          text: `${indicator.symbol}${indicatorGap}${this._(indicator.text)}`,
          x_expand: true,
          x_align: Clutter.ActorAlign.FILL,
          y_align: Clutter.ActorAlign.CENTER,
          style_class: 'codex-monitor-indicator-chip ' +
            `codex-indicator-${indicator.kind} ` +
            `codex-indicator-${indicator.severity}`,
          accessible_name: indicator.text,
        });
        chip.clutter_text.set_line_wrap(true);
        chip.clutter_text.set_line_wrap_mode(Pango.WrapMode.WORD_CHAR);
        chip.clutter_text.set_ellipsize(Pango.EllipsizeMode.NONE);
        row.add_child(chip);
      }
      this._indicatorList.add_child(row);
    }
  }

  _buildQuotaCards() {
    this._quotaRow = new St.BoxLayout({ style_class: 'codex-monitor-card-row' });
    this._fiveHourCard = new QuotaCard(this._('5-HOUR'), this._);
    this._weeklyCard = new QuotaCard(this._('WEEKLY'), this._);
    this._quotaRow.add_child(this._fiveHourCard.actor);
    this._quotaRow.add_child(this._weeklyCard.actor);
    this.actor.add_child(this._quotaRow);
  }

  _buildGraph() {
    const section = new St.BoxLayout({
      vertical: true,
      style_class: 'codex-monitor-section',
    });
    this._graphHeading = new St.BoxLayout({
      style_class: 'codex-monitor-section-heading',
    });
    this._graphHeading.add_child(new St.Label({
      text: this._('Usage trend'),
      style_class: 'codex-monitor-section-title',
      x_expand: true,
    }));
    this._graphModeControls = new St.BoxLayout({
      style_class: 'codex-monitor-action-row',
    });
    this._modeButtons = {};
    for (const [mode, label] of [
      ['quota', this._('Quota')],
      ['activity', this._('Activity')],
      ['both', this._('Both')],
    ]) {
      const button = _button(label, () => this._callbacks.onGraphMode(mode), 'codex-monitor-tab');
      this._modeButtons[mode] = button;
      this._graphModeControls.add_child(button);
    }
    this._graphHeading.add_child(this._graphModeControls);
    section.add_child(this._graphHeading);
    this._graphActor = this._graph.createQuotaGraph({
      legendStyleClass: 'codex-monitor-graph-legend',
    });
    section.add_child(this._graphActor);

    this._rangeRow = new St.BoxLayout({ style_class: 'codex-monitor-range-row' });
    this._rangeButtons = {};
    for (const [hours, label] of [[24, '24h'], [168, '7d'], [720, '30d']]) {
      const button = _button(label, () => this._callbacks.onGraphRange(hours), 'codex-monitor-range');
      this._rangeButtons[hours] = button;
      this._rangeRow.add_child(button);
    }
    section.add_child(this._rangeRow);
    this.actor.add_child(section);
  }

  _buildResetBank() {
    this._resetSection = new St.BoxLayout({
      vertical: true,
      style_class: 'codex-monitor-section',
    });
    this._resetHeading = new St.Label({
      text: this._('Banked resets'),
      style_class: 'codex-monitor-section-title',
    });
    this._resetList = new St.BoxLayout({ vertical: true });
    this._resetSection.add_child(this._resetHeading);
    this._resetSection.add_child(this._resetList);
    this.actor.add_child(this._resetSection);
  }

  _buildSessions() {
    const section = new St.BoxLayout({
      vertical: true,
      style_class: 'codex-monitor-section codex-monitor-sessions',
    });
    this._sessionHeadingRow = new St.BoxLayout({
      style_class: 'codex-monitor-section-heading',
    });
    this._sessionHeading = new St.Label({
      text: this._('Codex sessions'),
      style_class: 'codex-monitor-section-title',
      x_expand: true,
    });
    this._sessionHeadingRow.add_child(this._sessionHeading);
    this._sessionHeadingRow.add_child(_button(
      this._('Open Codex'), this._callbacks.onOpenCodex
    ));
    section.add_child(this._sessionHeadingRow);

    this._sessionFilters = new St.BoxLayout({
      vertical: true,
      style_class: 'codex-monitor-session-filters',
    });
    for (const [key, label] of [
      ['all', this._('All')],
      ['active', this._('Active')],
      ['attention', this._('Attention')],
      ['recent', this._('Recent')],
    ]) {
      const button = _button(label, () => {
        this._sessionFilter = key;
        this._renderSessions();
      }, 'codex-monitor-session-filter');
      button._baseLabel = label;
      this._sessionFilterButtons[key] = button;
    }
    this._layoutSessionFilters();
    section.add_child(this._sessionFilters);
    this._sessionList = new St.BoxLayout({
      vertical: true,
      style_class: 'codex-monitor-session-list',
    });
    section.add_child(this._sessionList);
    this.actor.add_child(section);
    this._renderSessions();
  }

  _buildRemote() {
    this._remoteSection = new St.BoxLayout({
      vertical: true,
      style_class: 'codex-monitor-section codex-monitor-remote-section',
    });
    this._remoteHeading = new St.BoxLayout({
      style_class: 'codex-monitor-section-heading',
    });
    this._remoteHeading.add_child(new St.Label({
      text: this._('Remote Control'),
      style_class: 'codex-monitor-section-title',
      x_expand: true,
    }));
    this._remoteLabel = new St.Label({
      text: this._('Disabled'),
      style_class: 'codex-monitor-status',
    });
    this._remoteHeading.add_child(this._remoteLabel);
    this._remoteButtons = new St.BoxLayout({ style_class: 'codex-monitor-action-row' });
    this._remoteIdentity = new St.Label({
      text: '',
      style_class: 'codex-monitor-secondary',
    });
    this._remoteSection.add_child(this._remoteHeading);
    this._remoteSection.add_child(this._remoteIdentity);
    this._remoteSection.add_child(this._remoteButtons);
    this._pairingQr = new St.Bin({
      style_class: 'codex-monitor-qr',
      x_align: Clutter.ActorAlign.CENTER,
      x_expand: false,
    });
    this._pairingQr.visible = false;
    this._pairingManualLabel = new St.Label({
      text: '',
      style_class: 'codex-monitor-pairing-code',
    });
    this._pairingQrFallback = new St.Label({
      text: '',
      style_class: 'codex-monitor-secondary',
    });
    this._pairingState = new St.Label({
      text: '',
      style_class: 'codex-monitor-secondary',
    });
    this._remoteSection.add_child(this._pairingQr);
    this._remoteSection.add_child(this._pairingManualLabel);
    this._remoteSection.add_child(this._pairingQrFallback);
    this._remoteSection.add_child(this._pairingState);
    this._remoteClientsHeadingRow = new St.BoxLayout({
      style_class: 'codex-monitor-section-heading',
    });
    this._remoteClientsHeading = new St.Label({
      text: this._('Paired devices'),
      style_class: 'codex-monitor-session-group-title',
      x_expand: true,
    });
    this._remoteClientsState = new St.Label({
      text: '',
      style_class: 'codex-monitor-device-state',
    });
    this._remoteClientList = new St.BoxLayout({ vertical: true });
    this._remoteClientsHeadingRow.add_child(this._remoteClientsHeading);
    this._remoteClientsHeadingRow.add_child(this._remoteClientsState);
    this._remoteSection.add_child(this._remoteClientsHeadingRow);
    this._remoteSection.add_child(this._remoteClientList);
    this.actor.add_child(this._remoteSection);
  }

  _buildFooter() {
    this._versionRow = new St.BoxLayout({
      style_class: 'codex-monitor-version-row',
    });
    this._versionLabel = new St.Label({
      text: '',
      style_class: 'codex-monitor-secondary',
      x_expand: true,
    });
    this._updateButton = _button(this._('Update Codex…'), this._callbacks.onUpdate);
    this._updateButton.visible = false;
    this._versionRow.add_child(this._versionLabel);
    this._versionRow.add_child(this._updateButton);
    this._versionRow.visible = false;
    this.actor.add_child(this._versionRow);

    this._footer = new St.BoxLayout({ style_class: 'codex-monitor-footer' });
    this._updated = new St.Label({
      text: this._('No data yet'),
      style_class: 'codex-monitor-secondary',
      x_expand: true,
    });
    this._footer.add_child(this._updated);
    this._footer.add_child(_button(this._('Refresh'), this._callbacks.onRefresh));
    this.actor.add_child(this._footer);
  }

  _layoutSessionFilters() {
    if (!this._sessionFilters)
      return;
    for (const row of this._sessionFilters.get_children()) {
      for (const button of row.get_children())
        row.remove_child(button);
      row.destroy();
    }
    const filtersPerRow = this._compact ? 2 : 4;
    const buttons = Object.values(this._sessionFilterButtons);
    for (let index = 0; index < buttons.length; index += filtersPerRow) {
      const row = new St.BoxLayout({ style_class: 'codex-monitor-session-filter-row' });
      for (const button of buttons.slice(index, index + filtersPerRow))
        row.add_child(button);
      this._sessionFilters.add_child(row);
    }
  }

  setCompactLayout(compact) {
    const next = Boolean(compact);
    if (this._compact === next)
      return;
    this._compact = next;
    if (this._compact)
      this.actor.add_style_class_name('codex-monitor-compact');
    else
      this.actor.remove_style_class_name('codex-monitor-compact');
    this._header.set_vertical(this._compact);
    this._quotaRow.set_vertical(this._compact);
    this._graphHeading.set_vertical(this._compact);
    this._sessionHeadingRow.set_vertical(this._compact);
    this._remoteHeading.set_vertical(this._compact);
    this._remoteClientsHeadingRow.set_vertical(this._compact);
    this._remoteButtons.set_vertical(this._compact);
    this._versionRow.set_vertical(this._compact);
    this._footer.set_vertical(this._compact);
    this._layoutSessionFilters();
    this.setIndicators(this._indicators);
    if (this._snapshot)
      this._renderResetBank();
    this._renderRemote();
  }

  setUpdateState(value) {
    const state = this._model.normalizeUpdateState(value);
    this._updateState = state;
    this._versionRow.visible = Boolean(state.installedVersion || state.message);
    this._updateButton.visible = state.updateAvailable;
    this._updateButton.set_label(this._('Update Codex…'));
    if (state.status === 'checking') {
      this._versionLabel.set_text(state.installedVersion
        ? _format(this._('Codex %s · Checking for updates…'), state.installedVersion)
        : this._('Checking for Codex updates…'));
      this._updateButton.visible = false;
    } else if (state.status === 'updating') {
      this._versionLabel.set_text(this._('Updating Codex…'));
      this._updateButton.visible = false;
    } else if (state.status === 'updated') {
      this._versionLabel.set_text(
        _format(this._('Updated to Codex %s. New Codex launches use this version.'),
          state.installedVersion)
      );
      this._updateButton.visible = false;
    } else if (state.status === 'failed') {
      this._versionLabel.set_text(state.installedVersion
        ? _format(this._('Automatic update failed; Codex %s is still installed. Use the official Codex installation instructions to update manually.'),
          state.installedVersion)
        : this._('Automatic Codex update failed. Use the official Codex installation instructions to update manually.'));
      this._updateButton.set_label(this._('Retry'));
    } else if (state.updateAvailable) {
      this._versionLabel.set_text(
        _format(this._('Codex %s → %s'), state.installedVersion, state.latestVersion)
      );
    } else {
      this._versionLabel.set_text(state.installedVersion
        ? _format(this._('Codex %s'), state.installedVersion) : '');
    }
  }

  showUpdateError() {
    const installed = this._updateState && this._updateState.installedVersion;
    this.setUpdateState({
      installedVersion: installed,
      latestVersion: this._updateState && this._updateState.latestVersion,
      updateAvailable: Boolean(this._updateState && this._updateState.updateAvailable),
      status: 'failed',
      message: installed
        ? _format(this._('Automatic update failed; Codex %s is still installed. Use the official Codex installation instructions to update manually.'),
          installed)
        : this._('Automatic Codex update failed. Use the official Codex installation instructions to update manually.'),
    });
  }

  setSettings(settings) {
    this._settings = settings;
    for (const [mode, button] of Object.entries(this._modeButtons))
      this._setChecked(button, mode === settings.graphMode);
    for (const [hours, button] of Object.entries(this._rangeButtons))
      this._setChecked(button, Number(hours) === Number(settings.graphRangeHours));
    this._renderGraph();
  }

  _setChecked(button, checked) {
    if (checked)
      button.add_style_pseudo_class('checked');
    else
      button.remove_style_pseudo_class('checked');
  }

  update(snapshot, remoteStatus, panelState) {
    this._snapshot = snapshot;
    this._remoteStatus = remoteStatus || this._remoteStatus;
    const now = Math.floor(Date.now() / 1000);
    const plan = snapshot.planType || snapshot.account && snapshot.account.planType || this._('Unknown plan');
    this._status.set_text(_format(this._('%s · Live ●'), plan));
    this._fiveHourCard.update(snapshot.windows.fiveHour, this._model, now);
    this._weeklyCard.update(snapshot.windows.weekly, this._model, now);
    this.setIndicators(panelState && panelState.indicators);
    this._updated.set_text(_format(this._('Updated %s ago'),
      this._model.formatDuration(now - snapshot.capturedAt, this._)));
    this._renderGraph();
    this._renderResetBank();
    this._renderRemote();
  }

  showError(message) {
    this._status.set_text(this._('Stale · retrying'));
    this._updated.set_text(message || this._('Unable to refresh Codex'));
  }

  setRemoteStatus(status) {
    this._remoteStatus = status;
    this._remoteError = '';
    this._remoteRepairAvailable = false;
    this._renderRemote();
  }

  setPairing(pairing) {
    this._pairing = pairing;
    this._pairingStatusSupported = true;
    this._pairingStatusAvailable = true;
    this._renderRemote();
  }

  setPairingStatus(status) {
    this._pairingStatusSupported = !status || status.supported !== false;
    this._pairingStatusAvailable = !status || status.available !== false;
    if (this._pairing && this._pairingStatusSupported &&
        this._pairingStatusAvailable) {
      if (status && status.claimed)
        this._pairing = { claimed: true };
      else
        this._pairing.claimed = false;
    }
    this._renderRemote();
  }

  setRemoteClients(value) {
    this._remoteClientsLoading = false;
    this._remoteClientsSupported = !value || value.supported !== false;
    this._remoteClientsAvailable = !value || value.available !== false;
    if (this._remoteClientsSupported && this._remoteClientsAvailable) {
      this._remoteClients = value && Array.isArray(value.clients)
        ? value.clients : [];
      this._remoteClientsLoaded = true;
    }
    this._remoteError = '';
    this._remoteRepairAvailable = false;
    this._renderRemote();
  }

  setRemoteClientsLoading(loading) {
    this._remoteClientsLoading = Boolean(loading);
    this._renderRemote();
  }

  showRemoteError(message, repairable = false) {
    this._remoteError = message || this._('Remote Control is unavailable');
    this._remoteRepairAvailable = Boolean(repairable);
    this._renderRemote();
  }

  setSessions(sessions) {
    this._sessions = sessions || { active: [], recent: [] };
    this._sessionsError = false;
    this._renderSessions();
  }

  showSessionsError() {
    this._sessionsError = true;
    this._renderSessions();
  }

  showActionMessage(message) {
    this._updated.set_text(message);
  }

  _renderGraph() {
    if (!this._snapshot)
      return;
    const now = Math.floor(Date.now() / 1000);
    const cutoff = now - Number(this._settings.graphRangeHours || 168) * 3600;
    const rangeHours = Number(this._settings.graphRangeHours || 168);
    const mode = this._settings.graphMode || 'quota';
    const series = [];
    const markers = new Set();
    if (mode === 'quota' || mode === 'both') {
      for (const [windowName, label, colorIndex] of [
        ['fiveHour', '5h', 0],
        ['weekly', this._('Weekly'), 1],
      ]) {
        const quotaPoints = this._model.quotaSeries(
          this._snapshot.history, windowName, cutoff, now
        );
        const points = quotaPoints.map(point => {
          if (point.resetTransition)
            markers.add(point.timestamp);
          return {
            timestamp: point.timestamp,
            value: point.usedPercent,
            usedPercent: point.usedPercent,
            resetTransition: point.resetTransition,
          };
        });
        series.push({
          label,
          kind: 'quota',
          points,
          segments: this._model.quotaSegments(points, rangeHours),
          colorIndex,
        });
      }
    }
    if (mode === 'activity' || mode === 'both') {
      const points = this._model.activitySeries(this._snapshot.tokenUsage)
        .filter(point => point.timestamp >= cutoff && point.timestamp <= now);
      series.push({
        label: this._('Activity'),
        kind: 'activity',
        points,
        colorIndex: 2,
      });
    }
    const summaries = series.map(item => this._model.graphSummary(item));
    const axes = this._model.graphAxes(series, cutoff, now, rangeHours, mode);
    const valueText = point => {
      if (!point)
        return '—';
      return point.tokens != null
        ? _format(this._('%s tokens'), this._model.formatTokenCount(point.tokens))
        : `${Math.round(Number(point.value))}%`;
    };
    const legend = summaries.map((summary, index) => {
      if (!summary.current)
        return null;
      const points = series[index].points || [];
      const first = points[0];
      const delta = summary.kind === 'quota' && first && points.length > 1
        ? Number(summary.current.value) - Number(first.value)
        : null;
      const change = delta == null || Math.abs(delta) < 0.5
        ? '' : ` · ${delta > 0 ? '+' : ''}${Math.round(delta)} pp`;
      return {
        colorIndex: series[index].colorIndex,
        text: `${summary.label} ${valueText(summary.current)}${change}`,
      };
    }).filter(Boolean);
    const hoverFormatter = timestamp => {
      const rangeSeconds = Number(this._settings.graphRangeHours || 168) * 3600;
      const values = this._model.nearestGraphValues(
        series, timestamp, Math.max(6 * 3600, rangeSeconds / 40)
      );
      const cursorTime = new Date(Number(timestamp) * 1000).toLocaleString();
      if (values.length === 0)
        return _format(this._('%s · No sample near this time'), cursorTime);
      const details = values.map(value => `${value.label} ${valueText(value)}`).join(' · ');
      return `${cursorTime} · ${details}`;
    };
    const selectedRange = rangeHours === 24 ? '24h' : rangeHours === 168 ? '7d' : '30d';
    const partialCoverage = axes.domain && axes.domain.collectionStart != null &&
      axes.domain.collectedSeconds < axes.domain.selectedSeconds;
    const historyDate = partialCoverage
      ? new Date(Number(axes.domain.collectionStart) * 1000).toLocaleDateString(
        undefined, { year: 'numeric', month: 'short', day: 'numeric' }
      ) : null;
    const coverage = partialCoverage
      ? _format(this._('History starts %s · %s collected of %s'), historyDate,
        this._model.formatDuration(axes.domain.collectedSeconds, this._),
        selectedRange)
      : null;
    this._graph.updateQuotaGraph(this._graphActor, {
      mode,
      rangeHours,
      series,
      resetMarkers: Array.from(markers),
      axes,
      legend,
      resetKey: this._('R = reset'),
      emptyText: this._('No history in this range'),
      collectingText: this._('Collecting more history…'),
      hoverFormatter,
      defaultDetail: legend.length > 0
        ? `${coverage ? `${coverage} · ` : ''}` +
          this._('Hover for timestamp and exact values')
        : this._('No samples yet'),
    });
  }

  _renderResetBank() {
    _clear(this._resetList);
    const bank = this._snapshot.resetCredits || { availableCount: 0, credits: [] };
    this._resetHeading.set_text(_format(
      this._('Banked resets (%s)'), bank.availableCount || 0
    ));
    const available = (bank.credits || []).filter(credit => credit.status === 'available');
    if (available.length === 0) {
      this._resetList.add_child(new St.Label({
        text: this._('No available reset credits'),
        style_class: 'codex-monitor-secondary',
      }));
      return;
    }
    const now = Math.floor(Date.now() / 1000);
    for (const credit of available) {
      const row = new St.BoxLayout({
        vertical: this._compact,
        style_class: 'codex-monitor-reset-row',
      });
      const expiry = credit.expiresAt
        ? _format(this._('expires in %s'),
          this._model.formatDuration(credit.expiresAt - now, this._))
        : this._('no expiry');
      const details = new St.BoxLayout({ vertical: true, x_expand: true });
      details.add_child(new St.Label({
        text: credit.title || this._('Codex limit reset'),
        style_class: 'codex-monitor-row-title',
      }));
      details.add_child(new St.Label({ text: expiry, style_class: 'codex-monitor-secondary' }));
      row.add_child(details);
      row.add_child(_button(this._('Apply…'), () => this._callbacks.onConsumeReset(credit)));
      this._resetList.add_child(row);
    }
  }

  _renderSessions() {
    if (!this._sessionList)
      return;
    _clear(this._sessionList);
    const view = this._model.sessionView(this._sessions, this._sessionFilter, 12);
    this._sessionFilter = view.filter;
    this._sessionHeading.set_text(_format(
      this._('Codex sessions (%s)'), view.counts.all
    ));
    for (const [key, button] of Object.entries(this._sessionFilterButtons)) {
      button.set_label(`${button._baseLabel} ${view.counts[key]}`);
      if (key === view.filter)
        button.add_style_pseudo_class('checked');
      else
        button.remove_style_pseudo_class('checked');
    }
    if (this._sessionsError) {
      this._sessionList.add_child(new St.Label({
        text: this._('Session list unavailable; quota monitoring is still live'),
        style_class: 'codex-monitor-secondary',
      }));
      return;
    }
    if (view.groups.length === 0) {
      const emptyLabels = {
        all: this._('No sessions reported'),
        active: this._('No active sessions'),
        attention: this._('No sessions need attention'),
        recent: this._('No recent sessions'),
      };
      this._sessionList.add_child(new St.Label({
        text: emptyLabels[view.filter],
        style_class: 'codex-monitor-secondary',
      }));
      return;
    }
    for (const group of view.groups) {
      const actor = new St.BoxLayout({
        vertical: true,
        style_class: 'codex-monitor-session-project-group',
      });
      actor.add_child(new St.Label({
        text: group.project === 'Unknown project'
          ? this._('Unknown project') : group.project,
        style_class: 'codex-monitor-session-project',
      }));
      for (const session of group.sessions)
        actor.add_child(this._sessionRow(session));
      this._sessionList.add_child(actor);
    }
  }

  _sessionRow(session) {
    const content = new St.BoxLayout({
      vertical: true,
      style_class: 'codex-monitor-session-content',
      x_expand: true,
    });
    const sessionTitle = !session.title || session.title === 'Untitled session'
      ? this._('Untitled session') : session.title;
    const sessionProject = !session.project || session.project === 'Unknown project'
      ? this._('Unknown project') : session.project;
    const title = new St.Label({
      text: sessionTitle,
      style_class: 'codex-monitor-row-title',
      x_expand: true,
    });
    title.clutter_text.set_ellipsize(Pango.EllipsizeMode.END);
    title.clutter_text.set_single_line_mode(true);
    const attention = session.attention || [];
    const now = Math.floor(Date.now() / 1000);
    const status = this._model.sessionStatusText(session, now, this._);
    const updated = session.updatedAt
      ? _format(this._('updated %s ago'), this._model.formatDuration(
        now - Number(session.updatedAt), this._))
      : this._('update time unavailable');
    const sourceLabels = {
      'CLI': this._('CLI'),
      'VS Code': this._('VS Code'),
      'Codex exec': this._('Codex exec'),
      'Codex app': this._('Codex app'),
      'Custom': this._('Custom'),
      'Sub-agent': this._('Sub-agent'),
      'Unknown': this._('Unknown source'),
    };
    const source = sourceLabels[session.sourceLabel] || this._('Unknown source');
    const meta = new St.Label({
      text: `${source} · ${status} · ${updated}`,
      style_class: 'codex-monitor-secondary',
      x_expand: true,
    });
    meta.clutter_text.set_ellipsize(Pango.EllipsizeMode.END);
    meta.clutter_text.set_single_line_mode(true);
    content.add_child(title);
    content.add_child(meta);
    const row = new St.Button({
      child: content,
      style_class: attention.length > 0
        ? 'codex-monitor-session-row codex-monitor-session-attention'
        : 'codex-monitor-session-row',
      reactive: true,
      can_focus: true,
      track_hover: true,
      x_expand: true,
      accessible_name: `${sessionProject} · ` +
        `${sessionTitle} · ${status}`,
    });
    row.connect('clicked', () => this._callbacks.onOpenSession(session));
    return row;
  }

  _renderRemote() {
    const status = this._remoteStatus && this._remoteStatus.status || 'disabled';
    const labels = {
      disabled: this._('Disabled'),
      connecting: this._('Connecting…'),
      running: this._('Running'),
      connected: this._('Connected'),
      errored: this._('Error'),
    };
    this._remoteLabel.set_text(labels[status] || this._('Unknown'));
    const identity = this._remoteStatus || {};
    const identityParts = [];
    if (identity.serverName)
      identityParts.push(identity.serverName);
    if (identity.environmentLabel)
      identityParts.push(_format(
        this._('environment %s'), identity.environmentLabel
      ));
    if (status === 'running' && identityParts.length === 0)
      identityParts.push(this._('Connection state unavailable; Remote is still running'));
    this._remoteIdentity.set_text(this._remoteError || identityParts.join(' · '));
    this._remoteIdentity.visible = Boolean(this._remoteIdentity.get_text());
    _clear(this._remoteButtons);
    if (status === 'connected') {
      this._remoteButtons.add_child(_button(this._('Stop'), this._callbacks.onRemoteStop));
      this._remoteButtons.add_child(_button(this._('Pair device'), this._callbacks.onRemotePair));
      this._remoteButtons.add_child(_button(
        this._('Refresh devices'), this._callbacks.onRemoteRefresh
      ));
    } else if (status === 'connecting' || status === 'running') {
      this._remoteButtons.add_child(_button(this._('Stop'), this._callbacks.onRemoteStop));
      this._remoteButtons.add_child(_button(
        this._('Refresh'), this._callbacks.onRemoteRefresh
      ));
    } else if (this._remoteRepairAvailable) {
      this._remoteButtons.add_child(_button(
        this._('Repair Remote…'), this._callbacks.onRemoteRepair
      ));
      this._remoteButtons.add_child(_button(
        this._('Refresh'), this._callbacks.onRemoteRefresh
      ));
    } else {
      this._remoteButtons.add_child(_button(this._('Start'), this._callbacks.onRemoteStart));
      this._remoteButtons.add_child(_button(
        this._('Refresh'), this._callbacks.onRemoteRefresh
      ));
    }
    const now = Math.floor(Date.now() / 1000);
    if (this._pairing && this._pairing.claimed) {
      _updateQrSvg(this._pairingQr, null);
      this._pairingManualLabel.set_text('');
      this._pairingQrFallback.set_text('');
      this._pairingState.set_text(this._('Pairing complete'));
    } else if (this._pairing && this._pairing.expiresAt > now) {
      const qrReady = _updateQrSvg(this._pairingQr, this._pairing.qrSvg);
      this._pairingManualLabel.set_text(this._pairing.manualPairingCode
        ? _format(this._('Manual code: %s'), this._pairing.manualPairingCode)
        : '');
      this._pairingQrFallback.set_text(qrReady
        ? ''
        : this._('QR unavailable; use the manual code'));
      this._pairingState.set_text(
        _format(this._('Waiting for device · expires in %s'),
          this._model.formatDuration(this._pairing.expiresAt - now, this._)) +
        (!this._pairingStatusSupported
          ? ` · ${this._('claim detection is not exposed by this Codex build')}`
          : !this._pairingStatusAvailable
            ? ` · ${this._('claim status temporarily unavailable; retrying')}`
            : '')
      );
    } else {
      this._pairing = null;
      _updateQrSvg(this._pairingQr, null);
      this._pairingManualLabel.set_text('');
      this._pairingQrFallback.set_text('');
      this._pairingState.set_text('');
    }
    this._pairingManualLabel.visible = Boolean(this._pairingManualLabel.get_text());
    this._pairingQrFallback.visible = Boolean(this._pairingQrFallback.get_text());
    this._pairingState.visible = Boolean(this._pairingState.get_text());

    _clear(this._remoteClientList);
    this._remoteClientsHeading.set_text(_format(
      this._('Paired devices (%s)'), this._remoteClients.length
    ));
    let clientsState = '';
    if (status === 'connected') {
      if (this._remoteClientsLoading)
        clientsState = this._('Checking');
      else if (!this._remoteClientsSupported)
        clientsState = this._('Unsupported');
      else if (!this._remoteClientsAvailable)
        clientsState = this._('Unavailable');
      else if (this._remoteClientsLoaded)
        clientsState = this._('Live');
      else
        clientsState = this._('Not checked');
    }
    this._remoteClientsState.set_text(clientsState);
    this._remoteClientsState.visible = Boolean(clientsState);
    if (status === 'running') {
      this._remoteClientList.add_child(new St.Label({
        text: this._('Refresh to confirm the connection before managing devices'),
        style_class: 'codex-monitor-secondary',
      }));
    } else if (status !== 'connected') {
      this._remoteClientList.add_child(new St.Label({
        text: this._('Start Remote Control to manage paired devices'),
        style_class: 'codex-monitor-secondary',
      }));
    } else if (this._remoteClientsLoading && !this._remoteClientsLoaded) {
      this._remoteClientList.add_child(new St.Label({
        text: this._('Checking paired devices…'),
        style_class: 'codex-monitor-secondary',
      }));
    } else if (!this._remoteClientsSupported) {
      this._remoteClientList.add_child(new St.Label({
        text: this._('This Codex build does not expose device management'),
        style_class: 'codex-monitor-secondary',
      }));
    } else {
      if (!this._remoteClientsAvailable) {
        this._remoteClientList.add_child(new St.Label({
          text: this._('Device channel is not responding; retrying automatically'),
          style_class: 'codex-monitor-secondary codex-monitor-device-warning',
        }));
      }
      if (!this._remoteClientsLoaded && this._remoteClientsAvailable) {
        this._remoteClientList.add_child(new St.Label({
          text: this._('Refresh devices to load paired devices'),
          style_class: 'codex-monitor-secondary',
        }));
      } else if (this._remoteClients.length === 0 && this._remoteClientsAvailable) {
        this._remoteClientList.add_child(new St.Label({
          text: this._('No paired devices'),
          style_class: 'codex-monitor-secondary',
        }));
      } else {
        const manageable = this._remoteClientsAvailable &&
          !this._remoteClientsLoading;
        for (const client of this._remoteClients.slice(0, 50))
          this._remoteClientList.add_child(this._remoteClientRow(client, manageable));
      }
    }
  }

  _remoteClientRow(client, manageable = true) {
    const row = new St.BoxLayout({
      vertical: this._compact,
      style_class: 'codex-monitor-remote-client-row',
    });
    const details = new St.BoxLayout({ vertical: true, x_expand: true });
    const name = client.displayName || client.deviceModel || this._('Paired device');
    details.add_child(new St.Label({ text: name, style_class: 'codex-monitor-row-title' }));
    const parts = [client.deviceType, client.platform, client.osVersion]
      .filter(Boolean);
    if (client.appVersion)
      parts.push(_format(this._('app %s'), client.appVersion));
    if (client.lastSeenAt) {
      parts.push(_format(this._('seen %s ago'), this._model.formatDuration(
        Math.floor(Date.now() / 1000) - Number(client.lastSeenAt), this._)));
    }
    details.add_child(new St.Label({
      text: parts.join(' · ') || this._('Device details unavailable'),
      style_class: 'codex-monitor-secondary',
    }));
    row.add_child(details);
    if (manageable) {
      row.add_child(_button(
        this._('Revoke…'),
        () => this._callbacks.onRemoteRevoke(client)
      ));
    }
    return row;
  }
};
