'use strict';

const Applet = imports.ui.applet;
const Clutter = imports.gi.Clutter;
const GLib = imports.gi.GLib;
const Gettext = imports.gettext;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;
const ModalDialog = imports.ui.modalDialog;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;
const St = imports.gi.St;

const UUID = 'codex-monitor@breixopd';
const { BridgeClient } = require('./bridgeClient');
const { Dashboard } = require('./ui');
const Graph = require('./graph');
const Model = require('./model');

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

class CodexMonitorApplet extends Applet.Applet {
  constructor(metadata, orientation, panelHeight, instanceId) {
    super(orientation, panelHeight, instanceId);
    this._metadata = metadata;
    this._orientation = orientation;
    this._snapshot = null;
    this._remoteStatus = null;
    this._sessions = { active: [], recent: [] };
    this._refreshing = false;
    this._refreshTimer = 0;
    this._remoteTimer = 0;
    this._remoteRefreshing = false;
    this._pairingPolling = false;
    this._pairingRetryAt = 0;
    this._pairingRetryAttempt = 0;
    this._clientsLoading = false;
    this._updateState = null;
    this._updateRefreshing = false;
    this._updateTimer = 0;
    this._updatePollTimer = 0;
    this._restartTimer = 0;
    this._restartAttempt = 0;
    this._bridge = null;
    this._pairing = null;
    this._destroyed = false;
    this._monitorsChangedId = 0;

    Gettext.bindtextdomain(UUID, GLib.build_filenamev([
      GLib.get_home_dir(), '.local', 'share', 'locale',
    ]));
    this._ = text => Gettext.dgettext(UUID, text);
    this.setAllowedLayout(Applet.AllowedLayout.BOTH);
    this.actor.set_accessible_name(this._('Codex usage monitor'));

    this._bindSettings(instanceId);
    this._buildPanel();
    this._buildMenu();
    this._startBridge();
    this._installRefreshTimer();
    this._installUpdateTimer();
  }

  _bindSettings(instanceId) {
    this.settings = new Settings.AppletSettings(this, UUID, instanceId);
    const restart = this._configurationChanged.bind(this);
    const render = this._render.bind(this);
    this.settings.bind('refresh-interval', 'refreshInterval', restart);
    this.settings.bind('history-days', 'historyDays', restart);
    this.settings.bind('codex-binary', 'codexBinary', restart);
    this.settings.bind('codex-home', 'codexHome', restart);
    this.settings.bind('warning-threshold', 'warningThreshold', render);
    this.settings.bind('critical-threshold', 'criticalThreshold', render);
    this.settings.bind('reset-expiry-warning-hours', 'resetExpiryWarningHours', render);
    this.settings.bind('show-reset-badge', 'showResetBadge', render);
    this.settings.bind('show-remote-badge', 'showRemoteBadge', render);
    this.settings.bind('graph-mode', 'graphMode', render);
    this.settings.bind('graph-range-hours', 'graphRangeHours', render);
  }

  _buildPanel() {
    this._panelBox = new St.BoxLayout({
      style_class: 'codex-monitor-panel',
      reactive: false,
      y_expand: true,
      y_align: Clutter.ActorAlign.CENTER,
    });
    this._panelUsage = new St.BoxLayout({
      vertical: true,
      style_class: 'codex-monitor-panel-usage',
      y_expand: false,
      y_align: Clutter.ActorAlign.CENTER,
    });
    [this._fiveHourLabel, this._fiveHourBar] = this._createPanelUsageRow(
      '5h', 'codex-monitor-five-hour-bar'
    );
    [this._weeklyLabel, this._weeklyBar] = this._createPanelUsageRow(
      'W', 'codex-monitor-weekly-bar'
    );
    this._indicatorBox = new St.BoxLayout({
      style_class: 'codex-monitor-panel-indicators',
      y_align: Clutter.ActorAlign.CENTER,
    });
    this._panelBox.add_child(this._panelUsage);
    this._panelBox.add_child(this._indicatorBox);
    this.actor.add_child(this._panelBox);
    this.on_orientation_changed(this._orientation);
  }

  _createPanelUsageRow(label, barStyleClass) {
    const row = new St.BoxLayout({
      style_class: 'codex-monitor-panel-usage-row',
      y_align: Clutter.ActorAlign.CENTER,
    });
    const rowLabel = new St.Label({
      text: label,
      style_class: 'codex-monitor-panel-window-label',
      y_align: Clutter.ActorAlign.CENTER,
    });
    const bar = Graph.createPanelBar(barStyleClass);
    row.add_child(rowLabel);
    row.add_child(bar);
    this._panelUsage.add_child(row);
    return [rowLabel, bar];
  }

  _buildMenu() {
    this.menu = new Applet.AppletPopupMenu(this, this._orientation);
    this._menuManager.addMenu(this.menu);
    this._dashboard = new Dashboard({
      translate: this._,
      model: Model,
      graph: Graph,
      callbacks: {
        onRefresh: this._refresh.bind(this),
        onGraphMode: mode => {
          this.graphMode = mode;
          this._render();
        },
        onGraphRange: hours => {
          this.graphRangeHours = hours;
          this._render();
        },
        onConsumeReset: this._confirmConsumeReset.bind(this),
        onOpenCodex: this._openCodex.bind(this),
        onOpenSession: this._openSession.bind(this),
        onRemoteStart: this._confirmRemoteStart.bind(this),
        onRemoteRepair: this._confirmRemoteRepair.bind(this),
        onRemoteStop: this._confirmRemoteStop.bind(this),
        onRemotePair: () => this._remoteAction('remote_pair_start'),
        onRemoteRefresh: this._refreshRemoteState.bind(this),
        onRemoteRevoke: this._confirmRemoteRevoke.bind(this),
        onUpdate: this._confirmUpdate.bind(this),
      },
    });
    this._menuItem = new PopupMenu.PopupBaseMenuItem({
      reactive: false,
      style_class: 'codex-monitor-menu-item',
    });
    this._dashboardScroll = new St.ScrollView({
      style_class: 'codex-monitor-scroll',
      overlay_scrollbars: false,
      x_expand: true,
    });
    this._dashboardScroll.set_policy(St.PolicyType.NEVER, St.PolicyType.AUTOMATIC);
    this._dashboardScroll.set_clip_to_allocation(true);
    this._dashboardScroll.add_actor(this._dashboard.actor);
    this._menuItem.addActor(this._dashboardScroll);
    this.menu.addMenuItem(this._menuItem);
    this.menu.connect('open-state-changed', (_menu, isOpen) => {
      if (isOpen)
        this._updateDashboardLayout();
    });
    this._monitorsChangedId = Main.layoutManager.connect(
      'monitors-changed', () => this._updateDashboardLayout()
    );
    this._updateDashboardLayout();
    this._render();
  }

  _updateDashboardLayout(workArea = null) {
    if (this._destroyed || !this._dashboard || !this._dashboardScroll)
      return;
    if (!workArea) {
      const monitor = Main.layoutManager.findMonitorForActor(this.actor);
      const workspace = global.workspace_manager.get_active_workspace();
      if (monitor && workspace)
        workArea = workspace.get_work_area_for_monitor(monitor.index);
    }
    workArea = workArea || {};
    const layout = Model.responsiveLayout(workArea.width, workArea.height);
    this._dashboard.actor.set_width(layout.contentWidth);
    this._dashboardScroll.set_style(`max-height: ${layout.scrollMaxHeight}px;`);
    this._dashboard.setCompactLayout(layout.compact);
  }

  _settingsView() {
    return {
      warningThreshold: this.warningThreshold,
      criticalThreshold: this.criticalThreshold,
      staleSeconds: 300,
      resetExpiryWarningHours: this.resetExpiryWarningHours,
      showResetBadge: this.showResetBadge,
      showRemoteBadge: this.showRemoteBadge,
      graphMode: this.graphMode,
      graphRangeHours: this.graphRangeHours,
    };
  }

  _startBridge() {
    if (this._destroyed)
      return;
    if (this._restartTimer) {
      Mainloop.source_remove(this._restartTimer);
      this._restartTimer = 0;
    }
    const previousBridge = this._bridge;
    this._bridge = null;
    this._refreshing = false;
    this._remoteRefreshing = false;
    this._pairingPolling = false;
    this._pairingRetryAt = 0;
    this._pairingRetryAttempt = 0;
    this._clientsLoading = false;
    this._updateRefreshing = false;
    if (previousBridge)
      previousBridge.stop();
    const bridge = new BridgeClient({
      appletPath: this._metadata.path,
      codexBinary: this.codexBinary || 'codex',
      codexHome: this.codexHome || '',
      historyDays: this.historyDays || 30,
    });
    this._bridge = bridge;
    try {
      bridge.start();
      this._refresh();
    } catch (error) {
      this._handleRefreshError();
    }
  }

  _request(action, params, callback) {
    const bridge = this._bridge;
    if (!bridge || this._destroyed)
      return;
    bridge.request(action, params, (error, value) => {
      if (this._destroyed || bridge !== this._bridge)
        return;
      callback(error, value);
    });
  }

  _refresh() {
    if (this._refreshing || !this._bridge)
      return;
    this._refreshing = true;
    this._dashboard.showActionMessage(this._('Refreshing…'));
    this._request('snapshot', {}, (error, snapshot) => {
      this._refreshing = false;
      if (error) {
        this._handleRefreshError();
        return;
      }
      this._restartAttempt = 0;
      this._snapshot = snapshot;
      this._render();
      this._refreshSessions();
      this._readRemoteStatus();
      this._readUpdateStatus();
    });
  }

  _readUpdateStatus() {
    if (this._updateRefreshing || !this._bridge)
      return;
    this._updateRefreshing = true;
    this._request('update_status', {}, (error, value) => {
      this._updateRefreshing = false;
      if (error)
        return;
      const previousStatus = this._updateState && this._updateState.status;
      this._updateState = Model.normalizeUpdateState(value);
      this._dashboard.setUpdateState(this._updateState);
      const status = this._updateState.status;
      if (previousStatus === 'updating' && status === 'updated')
        this._readRemoteStatus();
      const active = status === 'checking' || status === 'updating';
      this._setUpdatePolling(active);
      const now = Math.floor(Date.now() / 1000);
      if (!active && (this._updateState.checkedAt == null ||
          now - this._updateState.checkedAt >= 12 * 3600))
        this._checkUpdates(false);
    });
  }

  _checkUpdates(force) {
    if (this._updateRefreshing || !this._bridge)
      return;
    this._updateRefreshing = true;
    this._request('update_check', { force: Boolean(force) }, (error, value) => {
      this._updateRefreshing = false;
      if (error)
        return;
      this._updateState = Model.normalizeUpdateState(value);
      this._dashboard.setUpdateState(this._updateState);
      this._setUpdatePolling(
        this._updateState.status === 'checking' ||
        this._updateState.status === 'updating'
      );
    });
  }

  _setUpdatePolling(active) {
    if (!active && this._updatePollTimer) {
      Mainloop.source_remove(this._updatePollTimer);
      this._updatePollTimer = 0;
      return;
    }
    if (!active || this._updatePollTimer)
      return;
    this._updatePollTimer = Mainloop.timeout_add_seconds(2, () => {
      this._readUpdateStatus();
      return GLib.SOURCE_CONTINUE;
    });
  }

  _refreshSessions() {
    this._request('sessions', { limit: 12 }, (error, sessions) => {
      if (error) {
        this._dashboard.showSessionsError();
        return;
      }
      this._sessions = sessions;
      this._dashboard.setSessions(sessions);
    });
  }

  _readRemoteStatus(loadClients = true) {
    if (this._remoteRefreshing)
      return;
    this._remoteRefreshing = true;
    this._request('remote_status', {}, (error, status) => {
      this._remoteRefreshing = false;
      if (error) {
        if (Model.isUsableRemoteStatus(this._remoteStatus)) {
          this._dashboard.setRemoteStatus(this._remoteStatus);
          this._setRemotePolling(true);
          this._render();
          return;
        }
        this._remoteStatus = { status: 'errored' };
        this._dashboard.showRemoteError(this._('Remote Control status unavailable'));
        this._setRemotePolling(false);
        this._render();
        return;
      }
      this._remoteStatus = status;
      this._dashboard.setRemoteStatus(status);
      if (loadClients && status.status === 'connected' && status.environmentId)
        this._loadRemoteClients(status.environmentId);
      this._setRemotePolling(this._shouldPollRemote());
      this._render();
    });
  }

  _shouldPollRemote() {
    const status = this._remoteStatus && this._remoteStatus.status;
    const pairingActive = this._pairing && !this._pairing.claimed &&
      Number(this._pairing.expiresAt) > Math.floor(Date.now() / 1000);
    return status === 'connecting' || status === 'running' ||
      status === 'connected' || Boolean(pairingActive);
  }

  _setRemotePolling(active) {
    if (!active && this._remoteTimer) {
      Mainloop.source_remove(this._remoteTimer);
      this._remoteTimer = 0;
      return;
    }
    if (!active || this._remoteTimer)
      return;
    this._remoteTimer = Mainloop.timeout_add_seconds(5, () => {
      this._refreshRemoteState(false);
      return GLib.SOURCE_CONTINUE;
    });
  }

  _refreshRemoteState(loadClients = true) {
    this._readRemoteStatus(loadClients);
    this._pollPairing();
  }

  _pollPairing() {
    if (this._pairingPolling || !this._pairing || this._pairing.claimed ||
        this._pairing.pollingSupported === false)
      return;
    const now = Math.floor(Date.now() / 1000);
    if (now < this._pairingRetryAt)
      return;
    if (Number(this._pairing.expiresAt) <= now) {
      this._pairing = null;
      this._pairingRetryAt = 0;
      this._pairingRetryAttempt = 0;
      this._dashboard.setPairing(null);
      return;
    }
    this._pairingPolling = true;
    this._request('remote_pair_status', {
      pairingCode: this._pairing.pairingCode || null,
      manualPairingCode: this._pairing.manualPairingCode || null,
    }, (error, status) => {
      this._pairingPolling = false;
      if (error || status && status.available === false) {
        this._pairingRetryAttempt += 1;
        const delay = Math.min(60, Math.pow(2,
          Math.min(5, this._pairingRetryAttempt)));
        this._pairingRetryAt = Math.floor(Date.now() / 1000) + delay;
        if (status)
          this._dashboard.setPairingStatus(status);
        return;
      }
      this._pairingRetryAt = 0;
      this._pairingRetryAttempt = 0;
      if (status && status.supported === false)
        this._pairing.pollingSupported = false;
      if (status.claimed) {
        const environmentId = this._pairing.environmentId;
        this._pairing = null;
        this._dashboard.setPairing({ claimed: true });
        if (environmentId)
          this._loadRemoteClients(environmentId);
      } else {
        this._dashboard.setPairingStatus(status);
      }
      this._setRemotePolling(this._shouldPollRemote());
    });
  }

  _loadRemoteClients(environmentId) {
    if (this._clientsLoading)
      return;
    this._clientsLoading = true;
    this._dashboard.setRemoteClientsLoading(true);
    this._request('remote_clients', { environmentId }, (error, clients) => {
      this._clientsLoading = false;
      if (error) {
        this._dashboard.setRemoteClients({ available: false });
        return;
      }
      this._dashboard.setRemoteClients(clients);
    });
  }

  _handleRefreshError() {
    if (this._destroyed)
      return;
    this._dashboard.showError(this._('Unable to refresh Codex; showing last data'));
    this._render();
    this._restartAttempt += 1;
    if (this._restartTimer)
      return;
    const delay = Math.min(60, Math.pow(2, Math.min(5, this._restartAttempt)));
    this._restartTimer = Mainloop.timeout_add_seconds(delay, () => {
      this._restartTimer = 0;
      this._startBridge();
      return GLib.SOURCE_REMOVE;
    });
  }

  _render() {
    if (this._destroyed || !this._dashboard)
      return;
    const settings = this._settingsView();
    this._dashboard.setSettings(settings);
    if (!this._snapshot) {
      this.set_applet_tooltip(this._('Codex Monitor · connecting'));
      return;
    }
    const now = Math.floor(Date.now() / 1000);
    const state = Model.panelState(
      this._snapshot, settings, now, this._remoteStatus, this._
    );
    this.actor.set_accessible_name(
      `${this._('Codex usage monitor')} · ${state.label}` +
      (state.indicatorText ? ` · ${state.indicatorText}` : '')
    );
    const vertical = this._orientation === St.Side.LEFT ||
      this._orientation === St.Side.RIGHT;
    for (const child of this._indicatorBox.get_children())
      child.destroy();
    for (const indicator of state.indicators) {
      this._indicatorBox.add_child(new St.Label({
        text: indicator.panelSymbol || indicator.symbol,
        style_class: 'codex-indicator ' +
          `codex-indicator-${indicator.kind} ` +
          `codex-indicator-${indicator.severity}`,
        accessible_name: indicator.text,
        y_align: Clutter.ActorAlign.CENTER,
      }));
    }
    this._indicatorBox.visible = !vertical && state.indicators.length > 0;
    Graph.updatePanelBar(this._fiveHourBar, this._snapshot.windows.fiveHour);
    Graph.updatePanelBar(this._weeklyBar, this._snapshot.windows.weekly);
    for (const style of ['normal', 'warning', 'critical', 'stale'])
      this._panelBox.remove_style_class_name(`codex-monitor-${style}`);
    this._panelBox.add_style_class_name(`codex-monitor-${state.level}`);
    if (state.stale)
      this._panelBox.add_style_class_name('codex-monitor-stale');
    const tooltip = Model.tooltipText(
      this._snapshot, now, this._remoteStatus, this._
    );
    this.set_applet_tooltip(tooltip);
    this._dashboard.update(this._snapshot, this._remoteStatus, state);
  }

  _confirmConsumeReset(credit) {
    const expiry = credit.expiresAt
      ? new Date(credit.expiresAt * 1000).toLocaleString()
      : this._('no expiry');
    const message = `${this._('Apply this banked reset?')}\n\n` +
      `${credit.title || this._('Codex limit reset')} · ${expiry}`;
    new ModalDialog.ConfirmDialog(message, () => {
      this._request('consume_reset', {
        creditId: credit.id,
        idempotencyKey: GLib.uuid_string_random(),
        confirmed: true,
      }, (error, result) => {
        this._dashboard.showActionMessage(error
          ? this._('Reset could not be applied')
          : _format(this._('Reset result: %s'), result.outcome));
        this._refresh();
      });
    }).open();
  }

  _openCodex() {
    this._request('open_codex', {}, error => {
      if (error) {
        this._dashboard.showActionMessage(this._('Could not open the default terminal'));
        return;
      }
      this.menu.close();
    });
  }

  _openSession(session) {
    this._request('open_session', {
      threadId: session.id,
      cwd: session.cwd || null,
    }, error => {
      if (error) {
        this._dashboard.showActionMessage(this._('Could not open the default terminal'));
        return;
      }
      this.menu.close();
    });
  }

  _confirmRemoteStart() {
    const message = this._(
      'Start Codex Remote Control? This allows paired mobile clients to control this Linux device.'
    );
    new ModalDialog.ConfirmDialog(message, () => {
      this._remoteAction('remote_start', { confirmed: true });
    }).open();
  }

  _confirmRemoteStop() {
    const message = this._(
      'Stop Codex Remote Control? This disconnects paired devices and may end active Remote sessions.'
    );
    new ModalDialog.ConfirmDialog(message, () => {
      this._remoteAction('remote_stop', { confirmed: true });
    }).open();
  }

  _confirmRemoteRepair() {
    const message = this._(
      'Repair Codex Remote? This stops only a verified stale Codex background updater, then starts a fresh managed Remote service. Active terminal Codex sessions are not stopped.'
    );
    new ModalDialog.ConfirmDialog(message, () => {
      this._remoteAction('remote_repair', { confirmed: true });
    }).open();
  }

  _confirmRemoteRevoke(client) {
    const name = client.displayName || client.deviceModel || this._('this device');
    const message = _format(
      this._('Revoke Remote Control access for %s?'), name
    );
    new ModalDialog.ConfirmDialog(message, () => {
      const environmentId = this._remoteStatus && this._remoteStatus.environmentId ||
        this._pairing && this._pairing.environmentId;
      this._remoteAction('remote_revoke', {
        environmentId,
        clientId: client.clientId,
        confirmed: true,
      });
    }).open();
  }

  _confirmUpdate() {
    const state = this._updateState;
    if (!state || !state.updateAvailable || !state.installedVersion ||
        !state.latestVersion)
      return;
    const message = `${this._('Update Codex?')}\n\n` +
      `${state.installedVersion} → ${state.latestVersion}\n` +
      this._('Active terminal sessions keep running. Remote Control may reconnect after the update.');
    new ModalDialog.ConfirmDialog(message, () => {
      this._startUpdate();
    }).open();
  }

  _startUpdate() {
    if (this._updateRefreshing || !this._bridge)
      return;
    this._updateRefreshing = true;
    this._request('update_start', { confirmed: true }, (error, value) => {
      this._updateRefreshing = false;
      if (error) {
        this._dashboard.showUpdateError();
        return;
      }
      this._updateState = Model.normalizeUpdateState(value);
      this._dashboard.setUpdateState(this._updateState);
      this._setUpdatePolling(this._updateState.status === 'updating');
    });
  }

  _remoteAction(action, params = {}) {
    this._dashboard.showActionMessage(this._('Updating Remote Control…'));
    this._request(action, params, (error, result) => {
      if (error) {
        const stuck = action === 'remote_start' &&
          error.code === 'REMOTE_DAEMON_STUCK';
        const message = stuck
          ? this._('Codex Remote background service is stuck')
          : this._('Remote Control action failed');
        this._dashboard.showActionMessage(message);
        this._remoteStatus = { status: 'errored' };
        this._dashboard.showRemoteError(message, stuck);
      } else if (action === 'remote_pair_start') {
        this._pairing = { ...result, claimed: false };
        this._pairingRetryAt = 0;
        this._pairingRetryAttempt = 0;
        this._dashboard.setPairing(this._pairing);
      } else if (action === 'remote_stop') {
        this._pairing = null;
        this._dashboard.setPairing(null);
        this._dashboard.setRemoteClients({ clients: [] });
        this._remoteStatus = result;
      } else if (action === 'remote_revoke') {
        const environmentId = params.environmentId;
        if (environmentId)
          this._loadRemoteClients(environmentId);
      } else {
        this._remoteStatus = result;
      }
      if (!error)
        this._readRemoteStatus();
      this._render();
    });
  }

  _configurationChanged() {
    if (this._destroyed || !this._dashboard)
      return;
    this._installRefreshTimer();
    this._startBridge();
    this._render();
  }

  _installRefreshTimer() {
    if (this._refreshTimer)
      Mainloop.source_remove(this._refreshTimer);
    this._refreshTimer = Mainloop.timeout_add_seconds(
      Math.max(30, Number(this.refreshInterval || 60)),
      () => {
        this._refresh();
        return GLib.SOURCE_CONTINUE;
      }
    );
  }

  _installUpdateTimer() {
    if (this._updateTimer)
      Mainloop.source_remove(this._updateTimer);
    this._updateTimer = Mainloop.timeout_add_seconds(12 * 3600, () => {
      this._checkUpdates(true);
      return GLib.SOURCE_CONTINUE;
    });
  }

  on_applet_clicked() {
    this.menu.toggle();
  }

  on_applet_middle_clicked() {
    this._refresh();
  }

  on_orientation_changed(orientation) {
    this._orientation = orientation;
    if (!this._panelUsage)
      return;
    const vertical = orientation === St.Side.LEFT || orientation === St.Side.RIGHT;
    this._fiveHourLabel.visible = !vertical;
    this._weeklyLabel.visible = !vertical;
    this._indicatorBox.visible = !vertical &&
      this._indicatorBox.get_children().length > 0;
    if (this._dashboard)
      this._updateDashboardLayout();
  }

  on_applet_removed_from_panel() {
    this._destroyed = true;
    if (this._refreshTimer)
      Mainloop.source_remove(this._refreshTimer);
    if (this._restartTimer)
      Mainloop.source_remove(this._restartTimer);
    if (this._remoteTimer)
      Mainloop.source_remove(this._remoteTimer);
    if (this._updateTimer)
      Mainloop.source_remove(this._updateTimer);
    if (this._updatePollTimer)
      Mainloop.source_remove(this._updatePollTimer);
    this._refreshTimer = 0;
    this._restartTimer = 0;
    this._remoteTimer = 0;
    this._updateTimer = 0;
    this._updatePollTimer = 0;
    if (this._monitorsChangedId) {
      Main.layoutManager.disconnect(this._monitorsChangedId);
      this._monitorsChangedId = 0;
    }
    const bridge = this._bridge;
    this._bridge = null;
    if (bridge)
      bridge.stop();
    if (this.menu)
      this.menu.destroy();
    if (this.settings)
      this.settings.finalize();
  }
}

function main(metadata, orientation, panelHeight, instanceId) {
  return new CodexMonitorApplet(metadata, orientation, panelHeight, instanceId);
}
