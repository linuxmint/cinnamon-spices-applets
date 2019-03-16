// Icing Task Manager
// Authors:
//   Jason Hicks <jaszhix@gmail.com>
//   Kurt Rottmann <kurtrottmann@gmail.com>
//   Jason Siefken
//   Josh hess <jake.phy@gmail.com>
// Partly based on code from the Cinnamon window list applet,
// Window List with App Grouping applet, and:
// Copyright (C) 2011 R M Yorston
// Licence: GPLv2+
// http://intgat.tigress.co.uk/rmy/extensions/gnome-Cinnamon-frippery-0.2.3.tgz

const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const GLib = imports.gi.GLib;
const Gdk = imports.gi.Gdk;
const Meta = imports.gi.Meta;
const St = imports.gi.St;
const Gettext = imports.gettext;
const Applet = imports.ui.applet;
const Cinnamon = imports.gi.Cinnamon;
const Main = imports.ui.main;
const DND = imports.ui.dnd;
const Settings = imports.ui.settings;
const Util = imports.misc.util;
const SignalManager = imports.misc.signalManager;
const {listDirAsync} = imports.misc.fileUtils;
const ByteArray = imports.byteArray;

const {each, find, findIndex, filter, isEqual, setTimeout, throttle, unref, tryFn} = require('./utils');
const constants = require('./constants');
const AppList = require('./appList');
const store = require('./store');

class PinnedFavs {
  constructor(params) {
    this.params = params;
    this.favoriteSettingKey = 'favorite-apps';
    this._reload();
  }

  _reload() {
    const {state, signals, settings} = this.params;
    const appSystem = state.trigger('getAppSystem');
    if (signals.isConnected('changed::favorite-apps', global.settings)) {
      signals.disconnect('changed::favorite-apps', global.settings);
    }
    if (signals.isConnected('changed::pinned-apps', settings)) {
      signals.disconnect('changed::pinned-apps', settings);
    }
    let cb = () => this._onFavoritesChange();
    if (state.settings.systemFavorites) {
      signals.connect(global.settings, 'changed::favorite-apps', cb);
    } else {
      signals.connect(settings, 'changed::pinned-apps', cb);
    }
    this._favorites = [];
    let ids = [];
    if (state.settings.systemFavorites) {
      ids = global.settings.get_strv(this.favoriteSettingKey);
    } else {
      ids = settings.getValue('pinned-apps');
    }
    for (let i = 0, len = ids.length; i < len; i++) {
      let refFav = findIndex(this._favorites, (item) => item.id === ids[i]);
      if (refFav === -1) {
        let app = appSystem.lookup_app(ids[i]);
        this._favorites.push({
          id: ids[i],
          app: app
        });
      }
    }
  }

  triggerUpdate(appId, pos, isFavoriteApp) {
    let currentAppList = this.params.state.trigger('getCurrentAppList');
    let refApp = findIndex(currentAppList.appList, appGroup => appGroup.groupState.appId === appId);
    if (refApp > -1) {
      // Destroy pinned app
      if (!isFavoriteApp && currentAppList.appList[refApp] && currentAppList.appList[refApp].groupState.metaWindows.length === 0) {
        currentAppList.appList[refApp].destroy(true);
        currentAppList.appList[refApp] = undefined;
        currentAppList.appList.splice(refApp, 1);
      } else {
        // Move actor to index, trigger favorite state change
        currentAppList.appList[refApp].groupState.set({isFavoriteApp: isFavoriteApp});
        // Some favorite apps may be present from a previous installation, but not rendered and added to the app list because they're uninstalled.
        currentAppList.actor.set_child_at_index(currentAppList.appList[refApp].actor, pos);
      }
    }
  }

  _saveFavorites() {
    let uniqueSet = new Set();
    let ids = [];
    for (let i = 0; i < this._favorites.length; i++) {
      if (uniqueSet.has(this._favorites[i].id) === false) {
        ids.push(this._favorites[i].id);
        uniqueSet.add(this._favorites[i].id);
      }
    }
    if (this.params.state.settings.systemFavorites) {
      global.settings.set_strv(this.favoriteSettingKey, ids);
    } else {
      this.params.settings.setValue('pinned-apps', ids);
    }
  }

  _onFavoritesChange() {
    if (!this.params.state.settings.groupApps) {
      let currentAppList = this.params.state.trigger('getCurrentAppList');
      setTimeout(() => currentAppList._refreshList(), 0);
      return;
    }
    let oldFavoritesIds = [];
    let newFavoritesIds = [];
    for (let i = 0; i < this._favorites.length; i++) {
      oldFavoritesIds.push(this._favorites[i].id);
    }
    this._reload();
    for (let i = 0; i < this._favorites.length; i++) {
      newFavoritesIds.push(this._favorites[i].id);
    }
    for (let i = 0; i < oldFavoritesIds.length; i++) {
      if (newFavoritesIds.indexOf(oldFavoritesIds[i]) < 0) {
        this.triggerUpdate(oldFavoritesIds[i], -1, false);
      }
    }
    for (let i = 0; i < this._favorites.length; i++) {
      this.triggerUpdate(newFavoritesIds[i], i, true);
    }
  }

  addFavorite(opts={appId: null, app: null, pos: -1}) {
    const appSystem = this.params.state.trigger('getAppSystem');
    let oldIndex = -1;
    if (!opts.app) {
      opts.app = appSystem.lookup_app(opts.appId);
    }
    if (!opts.app) {
      opts.app = appSystem.lookup_desktop_wmclass(opts.appId);
    }
    if (!opts.app) {
      return false;
    }
    if (!opts.pos) {
      opts.pos = -1;
    }
    let newFav = {
      id: opts.appId,
      app: opts.app
    };
    let refFavorite = findIndex(this._favorites, function(favorite) {
      return favorite.id === opts.appId;
    });
    if (refFavorite === -1) {
      this._favorites.push(newFav);
    } else {
      oldIndex = refFavorite;
    }
    if (opts.pos > -1) {
      this.moveFavoriteToPos(opts, oldIndex);
      return true;
    }

    this._saveFavorites();
    return true;
  }

  moveFavoriteToPos(opts, oldIndex) {
    if (!oldIndex || !this.params.state.settings.groupApps) {
      oldIndex = findIndex(this._favorites, function(favorite) {
        return favorite.id === opts.appId;
      });
    }
    let newIndex = opts.pos;
    if (oldIndex > -1 && newIndex > oldIndex) {
      newIndex = newIndex - 1;
    }
    this._favorites.splice(newIndex, 0, this._favorites.splice(oldIndex, 1)[0]);
    this._favorites = filter(this._favorites, function(favorite) {
      return favorite.app != null;
    });
    this._saveFavorites();
  }

  removeFavorite(appId) {
    let refFav = findIndex(this._favorites, favorite => favorite.id === appId);
    this.triggerUpdate(appId, -1, false);
    this._favorites.splice(refFav, 1);
    this._saveFavorites();
    return true;
  }
}

class ITMApplet extends Applet.Applet {
  constructor(metadata, orientation, panel_height, instance_id) {
    super(orientation, panel_height, instance_id);

    this.tracker = Cinnamon.WindowTracker.get_default();
    this.recentManager = Gtk.RecentManager.get_default();
    this.appLists = [];
    // Initialize the default state. Any values passed through store.set must be declared here
    // first, or an error will be thrown.
    this.state = store.init({
      uuid: metadata.uuid,
      orientation,
      isHorizontal: orientation === St.Side.TOP || orientation === St.Side.BOTTOM,
      panel_height,
      instance_id,
      monitorWatchList: [],
      autoStartApps: [],
      currentWs: global.screen.get_active_workspace_index(),
      panelEditMode: global.settings.get_boolean('panel-edit-mode'),
      menuOpen: false,
      dragPlaceholder: null,
      dragPlaceholderPos: -1,
      animatingPlaceholdersCount: 0,
      appletReady: false,
      willUnmount: false,
      settings: {},
      homeDir: GLib.get_home_dir(),
      overlayPreview: null,
      lastCycled: null,
      lastTitleDisplay: null,
      scrollActive: false
    });

    // key-function pairs of actions that can be triggered from the store's callback queue. This allows ITM to avoid
    // passing down the parent class down the constructor chain and creating circular references. In addition to
    // manual event emitting, store.js can emit updates on property changes when set through store.set. Any keys
    // emitted through store.trigger that are not declared here first will throw an error.
    this.state.connect({
      setSettingsValue: (k, v) => this.settings.setValue(k, v),
      getPanel: () => this.panel ? this.panel : null,
      getPanelHeight: () => this._panelHeight,
      getScaleMode: () => this._scaleMode,
      getAppSystem: () => Cinnamon.AppSystem.get_default(),
      getAppFromWMClass: (specialApps, metaWindow) => this.getAppFromWMClass(specialApps, metaWindow),
      getTracker: () => this.tracker,
      isWindowInteresting: (metaWindow) => Main.isInteresting(metaWindow),
      addWindowToAllWorkspaces: (win, app, isFavoriteApp) => {
        each(this.appLists, function(appList) {
          appList._windowAdded(appList.metaWorkspace, win, app, isFavoriteApp);
        });
      },
      removeWindowFromAllWorkspaces: (win) => {
        each(this.appLists, function(appList) {
          appList._windowRemoved(appList.metaWorkspace, win);
        });
      },
      removeWindowFromOtherWorkspaces: (win) => {
        each(this.appLists, (appList) => {
          if (appList.listState.workspaceIndex === this.state.currentWs) {
            return;
          }
          appList._windowRemoved(appList.metaWorkspace, win);
        });
      },
      refreshCurrentAppList: () => this.refreshCurrentAppList(),
      getCurrentAppList: () => this.getCurrentAppList(),
      _clearDragPlaceholder: () => this._clearDragPlaceholder(),
      getAutoStartApps: () => this.getAutoStartApps(),
      getRecentItems: () => Gtk.RecentManager.get_default()
        .get_items()
        .sort(function (a, b) {
          return a.get_modified() - b.get_modified();
        })
        .reverse(),
      addFavorite: (obj) => this.pinnedFavorites.addFavorite(obj),
      removeFavorite: (id) => this.pinnedFavorites.removeFavorite(id),
      getFavorites: () => this.pinnedFavorites._favorites,
      setThumbnailActorStyle: (actor) => actor.set_style('border-width:2px;padding:' + this.state.settings.thumbnailPadding + 'px;'),
      setThumbnailCloseButtonStyle: (button) => {
        let size = this.state.settings.thumbnailCloseButtonSize;
        button.width = size;
        button.height = size;
        let left = global.ui_scale > 1 ? -10 : 0;
        button.style = 'padding: 0px; width: ' + size + 'px; height: ' + size + 'px; max-width: ' + size + 'px; max-height: ' + size + 'px; '
          + '-cinnamon-close-overlap: 0px; postion: ' + left + 'px -2px;background-size: ' + size + 'px ' + size + 'px;';
        button.style_class = 'window-close';
      },
      cycleWindows: (e, source) => this.handleScroll(e, source),
      openAbout: () => this.openAbout(),
      configureApplet: () => this.configureApplet()
    });

    this.settings = new Settings.AppletSettings(this.state.settings, metadata.uuid, instance_id);
    this.bindSettings();

    if (typeof this.on_applet_reloaded === 'function') {
      this.isCinnamon4 = true;
      this.notifyDeprecation();
      global.log('Icing Task Manager is deprecated and has been forked as Grouped Window List in Cinnamon 4.0+. Please upgrade for improved stability.');
    }

    // Passing an empty object instead of `this` because its only used by SignalManager to bind the callback, which
    // we already do here. Otherwise, it creates more circular references.
    this.signals = new SignalManager.SignalManager(null);
    this.appSystem = this.state.trigger('getAppSystem');
    this.pinnedFavorites = new PinnedFavs({
      signals: this.signals,
      settings: this.settings,
      state: this.state,
    });
    this.actor.set_track_hover(false);
    // Declare vertical panel compatibility
    this.setAllowedLayout(Applet.AllowedLayout.BOTH);
    Gettext.bindtextdomain(metadata.uuid, GLib.get_home_dir() + '/.local/share/locale');

    this.getAutoStartApps();
    this.onSwitchWorkspace = throttle(this.onSwitchWorkspace, 100, true);
    this.signals.connect(this.actor, 'scroll-event', (c, e) => this.handleScroll(e));
    this.signals.connect(global.window_manager, 'switch-workspace', (...args) => this.onSwitchWorkspace(...args));
    this.signals.connect(global.screen, 'workspace-removed', (...args) => this.onWorkspaceRemoved(...args));
    this.signals.connect(global.screen, 'window-monitor-changed', (...args) => this._onWindowMonitorChanged(...args));
    this.signals.connect(global.screen, 'monitors-changed', (...args) => this.on_applet_instances_changed(...args));
    this.signals.connect(global.display, 'window-marked-urgent', (...args) => this._updateAttentionState(...args));
    this.signals.connect(global.display, 'window-demands-attention', (...args) => this._updateAttentionState(...args));
    this.signals.connect(global.settings, 'changed::panel-edit-mode', (...args) => this.on_panel_edit_mode_changed(...args));
    this.signals.connect(Main.overview, 'showing', (...args) => this._onOverviewShow(...args));
    this.signals.connect(Main.overview, 'hiding', (...args) => this._onOverviewHide(...args));
    this.signals.connect(Main.expo, 'showing', (...args) => this._onOverviewShow(...args));
    this.signals.connect(Main.expo, 'hiding', (...args) => this._onOverviewHide(...args));
    this.signals.connect(Main.themeManager, 'theme-set', (...args) => this.refreshCurrentAppList(...args));
  }

  bindSettings() {
    let settingsProps = [
      {key: 'show-pinned', value: 'showPinned', cb: this.refreshCurrentAppList},
      {key: 'show-active', value: 'showActive', cb: this.refreshCurrentAppList},
      {key: 'show-alerts', value: 'showAlerts', cb: this._updateAttentionState},
      {key: 'group-apps', value: 'groupApps', cb: this.refreshCurrentAppList},
      {key: 'enable-app-button-dragging', value: 'enableDragging', cb: null},
      {key: 'pinOnDrag', value: 'pinOnDrag', cb: null},
      {key: 'launcher-animation-effect', value: 'launcherAnimationEffect', cb: null},
      {key: 'pinned-apps', value: 'pinnedApps', cb: null},
      {key: 'middle-click-action', value: 'middleClickAction', cb: null},
      {key: 'left-click-action', value: 'leftClickAction', cb: null},
      {key: 'show-apps-order-hotkey', value: 'showAppsOrderHotkey', cb: this._bindAppKeys},
      {key: 'show-apps-order-timeout', value: 'showAppsOrderTimeout', cb: null},
      {key: 'cycleMenusHotkey', value: 'cycleMenusHotkey', cb: this._bindAppKeys},
      {key: 'hoverPseudoClass', value: 'hoverPseudoClass', cb: this.refreshCurrentAppList},
      {key: 'focusPseudoClass', value: 'focusPseudoClass', cb: this.refreshCurrentAppList},
      {key: 'activePseudoClass', value: 'activePseudoClass', cb: this.refreshCurrentAppList},
      {key: 'app-button-transition-duration', value: 'appButtonTransitionDuration', cb: this.refreshCurrentAppList},
      {key: 'enable-hover-peek', value: 'enablePeek', cb: null},
      {key: 'onclick-thumbnails', value: 'onClickThumbs', cb: null},
      {key: 'hover-peek-opacity', value: 'peekOpacity', cb: null},
      {key: 'hover-peek-time', value: 'peekTime', cb: null},
      {key: 'thumbnail-timeout', value: 'thumbTimeout', cb: null},
      {key: 'thumbnail-size', value: 'thumbSize', cb: null},
      {key: 'thumbnail-close-button-size', value: 'thumbnailCloseButtonSize', cb: this._updateThumbnailCloseButtonSize},
      {key: 'thumbnail-padding', value: 'thumbnailPadding', cb: this._updateThumbnailPadding},
      {key: 'thumbnail-scroll-behavior', value: 'thumbnailScrollBehavior', cb: null},
      {key: 'sort-thumbnails', value: 'sortThumbs', cb: this._updateVerticalThumbnailState},
      {key: 'highlight-last-focused-thumbnail', value: 'highlightLastFocusedThumbnail', cb: this._updateVerticalThumbnailState},
      {key: 'vertical-thumbnails', value: 'verticalThumbs', cb: this._updateVerticalThumbnailState},
      {key: 'show-thumbnails', value: 'showThumbs', cb: this._updateVerticalThumbnailState},
      {key: 'show-icons', value: 'showIcons', cb: this._updateVerticalThumbnailState},
      {key: 'animate-thumbnails', value: 'animateThumbs', cb: null},
      {key: 'include-all-windows', value: 'includeAllWindows', cb: this.refreshCurrentAppList},
      {key: 'number-display', value: 'numDisplay', cb: this._updateWindowNumberState},
      {key: 'title-display', value: 'titleDisplay', cb: this._updateTitleDisplay},
      {key: 'scroll-behavior', value: 'scrollBehavior', cb: null},
      {key: 'icon-spacing', value: 'iconSpacing', cb: this._updateSpacing},
      {key: 'enable-iconSize', value: 'enableIconSize', cb: this._updateActorAttributes},
      {key: 'icon-size', value: 'iconSize', cb: this._updateActorAttributes},
      {key: 'show-recent', value: 'showRecent', cb: null},
      {key: 'menuItemType', value: 'menuItemType', cb: null},
      {key: 'firefox-menu', value: 'firefoxMenu', cb: null},
      {key: 'autostart-menu-item', value: 'autoStart', cb: null},
      {key: 'launch-new-instance-menu-item', value: 'launchNewInstance', cb: null},
      {key: 'monitor-move-all-windows', value: 'monitorMoveAllWindows', cb: null},
      {key: 'enable-app-button-width', value: 'enableAppButtonWidth', cb: this._updateActorAttributes},
      {key: 'app-button-width', value: 'appButtonWidth', cb: this._updateActorAttributes},
      {key: 'system-favorites', value: 'systemFavorites', cb: this._updateFavorites},
      {key: 'show-all-workspaces', value: 'showAllWorkspaces', cb: this.refreshAllAppLists},
      {key: 'list-monitor-windows', value: 'listMonitorWindows', cb: this.handleMonitorWindowsPrefsChange},
      {key: 'deprecationNoticeRun', value: 'deprecationNoticeRun', cb: null},
    ];

    for (let i = 0, len = settingsProps.length; i < len; i++) {
      this.settings.bind(
        settingsProps[i].key,
        settingsProps[i].value,
        settingsProps[i].cb ? (...args) => settingsProps[i].cb.call(this, ...args) : null
      );
    }

    this.state.set({lastTitleDisplay: this.state.settings.titleDisplay});
  }

  // TODO: Determine if using this as a starting point for initializing applet loadding is a good idea.
  // This method will get called when applets are still existing instances, such as during panel DND.
  // Should be looked into more, and see if this should be a fix in a future Cinnamon PR. the on_applet_removed_from_panel
  // method removes applets and calls this method, all while as far as the user knows, the applet state should remain the same.
  on_applet_added_to_panel() {
    if (this.state.appletReady && this.state.panelEditMode) {
      return;
    }
    // Query apps for the current workspace
    this.onSwitchWorkspace();
    this._bindAppKeys();
    this._updateSpacing();
    this.state.set({appletReady: true});
    setTimeout(() => this.updateMonitorWatchlist(), 0);
  }

  on_applet_instances_changed(loaded) {
    if (this.state.appletReady) {
      this.updateMonitorWatchlist();
    }
  }

  on_panel_edit_mode_changed() {
    this.state.set({panelEditMode: !this.state.panelEditMode});
    each(this.appLists, (workspace) => {
      each(workspace.appList, (appGroup) => {
        appGroup.hoverMenu.actor.reactive = !this.state.panelEditMode;
        appGroup.rightClickMenu.actor.reactive = !this.state.panelEditMode;
        appGroup.actor.reactive = !this.state.panelEditMode;
      });
    });
  }

  on_panel_height_changed() {
    this._updateActorAttributes();
  }

  on_orientation_changed(orientation) {
    this.state.set({
      orientation: orientation,
      isHorizontal: orientation === St.Side.TOP || orientation === St.Side.BOTTOM
    });
    if (this.state.isHorizontal) {
      this.actor.remove_style_class_name('vertical');
    } else {
      this.actor.add_style_class_name('vertical');
      this.actor.set_important(true);
    }
  }

  on_applet_removed_from_panel() {
    this.state.set({willUnmount: true});
    this._unbindAppKeys();
    this.signals.disconnectAllSignals();
    for (let i = 0, len = this.appLists.length; i < len; i++) {
      if (this.appLists[i]) {
        this.appLists[i].destroy();
      }
    }
    this.settings.finalize();
    unref(this);
  }

  getNotificationIcon() {
    return new St.Icon({
      icon_type: St.IconType.FULLCOLOR,
      icon_size: 24 * global.ui_scale,
      gicon: new Gio.FileIcon({
        file: Gio.file_new_for_path(
          GLib.get_home_dir() + '/.local/share/cinnamon/applets/IcingTaskManager@json/icon.png'
        )
      })
    });
  }

  notifyDeprecation() {
    if (this.state.settings.deprecationNoticeRun) return;
    let icon = this.getNotificationIcon();
    let header = _('Icing Task Manager is deprecated');
    let body = _('Please upgrade to Grouped Window List for a more stable, bug-free experience. ')
      + _('Add GWL to your panel, then open ITM\'s settings and click "Migrate Pinned Apps to Grouped Window List".');
    Main.criticalNotify(
      header,
      body,
      icon
    );
    this.settings.setValue('deprecationNoticeRun', true);
  }

  migratePinnedToGWL() {
    if (!this.isCinnamon4) {
      Main.criticalNotify(
        _('Migration can only be performed on Cinnamon 4.0+.'),
        '',
        this.getNotificationIcon()
      );
      return;
    }

    let gwlSettingsDir = Gio.file_new_for_path(GLib.get_home_dir() + '/.cinnamon/configs/grouped-window-list@cinnamon.org');
    let itmSettingsDir = Gio.file_new_for_path(GLib.get_home_dir() + '/.cinnamon/configs/IcingTaskManager@json');
    if (!gwlSettingsDir.query_exists(null)) {
      Main.criticalNotify(
        _('Please add Grouped Window List to a panel before proceeding with the migration.'),
        '',
        this.getNotificationIcon()
      );
      return;
    }
    if (!itmSettingsDir.query_exists(null)) {
      Main.criticalNotify(
        _('ITM settings directory could not be found!'),
        '',
        this.getNotificationIcon()
      );
      return;
    }

    // Find the ITM JSON file with the most pinned apps,
    // then uniquely concatenate it to every GWL JSON file.
    listDirAsync(itmSettingsDir, (itmJSONFiles) => {
      listDirAsync(gwlSettingsDir, (gwlJSONFiles) => {
        let itm = [], itmJson = [], errors = [];
        each(itmJSONFiles, (file) => {
          file = file.get_name();
          file = Gio.file_new_for_path(GLib.get_home_dir() + '/.cinnamon/configs/IcingTaskManager@json/' + file);
          let [success, json] = file.load_contents(null);
          if (!success) {
            errors.push(file.get_path());
            return;
          }
          // Mozjs60 future proofing
          if (json instanceof Uint8Array) {
            json = ByteArray.toString(json);
          } else {
            json = json.toString();
          }
          tryFn(() => {
            json = JSON.parse(json);
            if (json['system-favorites'].value) {
              Main.criticalNotify(
                _('System favorites enabled - no migration is needed.'),
                '',
                this.getNotificationIcon()
              );
              return;
            }
            itm.push(json['pinned-apps'].value.length);
            itmJson.push(json);
          }, () => errors.push(file.get_path()));
        });
        let max = Math.max(...itm);
        let ref = find(itmJson, (json) => json['pinned-apps'].value.length === max);
        if (ref) {
          let pinnedApps = ref['pinned-apps'].value;
          each(gwlJSONFiles, (file) => {
            file = file.get_name();
            file = Gio.file_new_for_path(GLib.get_home_dir() + '/.cinnamon/configs/grouped-window-list@cinnamon.org/' + file);
            let [success, json] = file.load_contents(null);
            if (!success) {
              errors.push(file.get_path());
              return;
            }
            if (json instanceof Uint8Array) {
              json = ByteArray.toString(json);
            } else {
              json = json.toString();
            }
            tryFn(() => {
              json = JSON.parse(json);
              each(pinnedApps, (item) => {
                if (json['pinned-apps'].value.indexOf(item) === -1) {
                  json['pinned-apps'].value.push(item);
                }
              });
              json = JSON.stringify(json);
              let raw = file.replace(null, false, Gio.FileCreateFlags.NONE, null);
              let out = Gio.BufferedOutputStream.new_sized(raw, 4096);
              Cinnamon.write_string_to_stream(out, json);
              out.close(null);
            }, () => errors.push(file.get_path()));
          });
        } else {
          Main.criticalNotify(
            _('Unable to find a suitable ITM settings file to migrate.'),
            errors.join('\n'),
            this.getNotificationIcon()
          );
          return;
        }

        if (errors.length > 0) {
          Main.criticalNotify(
            _('Migration complete. ') + errors.length + _(' settings file(s) could not be migrated.'),
            errors.join('\n'),
            this.getNotificationIcon()
          );
        } else {
          Main.criticalNotify(
            _('Migration was successful.'),
            '',
            this.getNotificationIcon()
          );
        }
      });
    });
  }

  // Override Applet._onButtonPressEvent due to the applet menu being replicated in AppMenuButtonRightClickMenu.
  _onButtonPressEvent(actor, event) {
    if (this.state.panelEditMode) {
      Applet.Applet.prototype._onButtonPressEvent.call(this, actor, event);
    }
    return false;
  }

  _onWindowMonitorChanged(screen, metaWindow, metaWorkspace) {
    if (this.state.settings.listMonitorWindows) {
      this.getCurrentAppList()._windowRemoved(metaWorkspace, metaWindow);
      this.getCurrentAppList()._windowAdded(metaWorkspace, metaWindow);
    }
  }

  _bindAppKeys() {
    this._unbindAppKeys();

    for (let i = 1; i < 10; i++) {
      this._bindAppKey(i);
    }
    Main.keybindingManager.addHotKey('launch-show-apps-order', this.state.settings.showAppsOrderHotkey, () => this._showAppsOrder());
    Main.keybindingManager.addHotKey('launch-cycle-menus', this.state.settings.cycleMenusHotkey, () => this._cycleMenus());
  }

  _unbindAppKeys() {
    for (let i = 1; i < 10; i++) {
      Main.keybindingManager.removeHotKey('launch-app-key-' + i);
      Main.keybindingManager.removeHotKey('launch-new-app-key-' + i);
    }
    Main.keybindingManager.removeHotKey('launch-show-apps-order');
    Main.keybindingManager.removeHotKey('launch-cycle-menus');
  }

  _bindAppKey(i) {
    Main.keybindingManager.addHotKey('launch-app-key-' + i, '<Super>' + i, () => this._onAppKeyPress(i));
    Main.keybindingManager.addHotKey('launch-new-app-key-' + i, '<Super><Shift>' + i, () => this._onNewAppKeyPress(i));
  }

  _onAppKeyPress(number) {
    this.getCurrentAppList()._onAppKeyPress(number);
  }

  _onNewAppKeyPress(number) {
    this.getCurrentAppList()._onNewAppKeyPress(number);
  }

  _showAppsOrder() {
    this.getCurrentAppList()._showAppsOrder();
  }

  _cycleMenus() {
    this.getCurrentAppList()._cycleMenus();
  }

  handleMonitorWindowsPrefsChange(value) {
    let instances = Main.AppletManager.getRunningInstancesForUuid(this.state.uuid);
    for (let i = 0; i < instances.length; i++) {
      if (!instances[i]) {
        continue;
      }
      instances[i].updateMonitorWatchlist();
      if (instances[i].panel.monitorIndex !== this.panel.monitorIndex) {
        instances[i].state.settings.listMonitorWindows = this.state.settings.listMonitorWindows;
      }
      instances[i].refreshCurrentAppList();
    }
  }

  updateMonitorWatchlist() {
    let numberOfMonitors = Gdk.Screen.get_default().get_n_monitors();
    let onPrimary = this.panel.monitorIndex === Main.layoutManager.primaryIndex;
    let instances = Main.AppletManager.getRunningInstancesForUuid(this.state.uuid);
    /* Simple cases */
    if (numberOfMonitors === 1) {
      this.state.monitorWatchList = [Main.layoutManager.primaryIndex];
    } else if (instances.length > 1 && !onPrimary) {
      this.state.monitorWatchList = [this.panel.monitorIndex];
    } else {
      /* This is an instance on the primary monitor - it will be
       * responsible for any monitors not covered individually.  First
       * convert the instances list into a list of the monitor indices,
       * and then add the monitors not present to the monitor watch list
       * */
      this.state.monitorWatchList = [this.panel.monitorIndex];
      for (let i = 0; i < instances.length; i++) {
        if (!instances[i]) {
          continue;
        }
        instances[i] = instances[i].panel.monitorIndex;
      }

      for (let i = 0; i < numberOfMonitors; i++) {
        if (instances.indexOf(i) === -1) {
          this.state.monitorWatchList.push(i);
        }
      }
    }

    this.state.set({monitorWatchList: this.state.monitorWatchList});
  }

  refreshCurrentAppList() {
    this.appLists[this.state.currentWs]._refreshList();
  }

  refreshAllAppLists() {
    each(this.appLists, function(appList) {
      appList._refreshList();
    });
  }

  handleMintYThemePreset() {
    this.settings.setValue('hoverPseudoClass', 1);
    this.settings.setValue('focusPseudoClass', 1);
    this.settings.setValue('activePseudoClass', 3);
    this.settings.setValue('number-display', 1);
    this.settings.setValue('show-active', true);
    this.refreshCurrentAppList();
  }

  handleMintXThemePreset() {
    this.settings.setValue('hoverPseudoClass', 3);
    this.settings.setValue('focusPseudoClass', 2);
    this.settings.setValue('activePseudoClass', 4);
    this.settings.setValue('number-display', 1);
    this.settings.setValue('show-active', false);
    this.refreshCurrentAppList();
  }

  _updateFavorites() {
    this.pinnedFavorites._reload();
    this.refreshCurrentAppList();
  }

  _updateThumbnailPadding() {
    each(this.appLists, (workspace) => {
      each(workspace.appList, (appGroup) => {
        appGroup.hoverMenu.updateThumbnailPadding();
      });
    });
  }

  _updateThumbnailCloseButtonSize() {
    each(this.appLists, (workspace) => {
      each(workspace.appList, (appGroup) => {
        appGroup.hoverMenu.updateThumbnailCloseButtonSize();
      });
    });
  }

  _updateActorAttributes() {
    each(this.appLists, (workspace) => {
      if (!workspace) {
        return;
      }
      each(workspace.appList, (appGroup) => {
        appGroup.setActorAttributes();
      });
    });
  }

  _updateSpacing() {
    each(this.appLists, (workspace) => {
      workspace._updateSpacing();
    });
  }

  _updateWindowNumberState() {
    each(this.appLists, (workspace) => {
      workspace._calcAllWindowNumbers();
    });
  }

  _updateAttentionState(display, window) {
    if (!this.state.settings.showAlerts) {
      return false;
    }
    each(this.appLists, (workspace) => {
      workspace._updateAttentionState(display, window);
    });
  }

  _updateVerticalThumbnailState() {
    each(this.appLists, (workspace) => {
      each(workspace.appList, (appGroup) => {
        if (appGroup && appGroup.hoverMenu) {
          appGroup.hoverMenu._setVerticalSetting();
        }
      });
    });
  }

  _updateTitleDisplay(titleDisplay) {
    if (titleDisplay === constants.TitleDisplay.None
      || this.state.lastTitleDisplay === constants.TitleDisplay.None) {
      this.refreshCurrentAppList();
    }
    let appList = this.getCurrentAppList().appList;
    each(appList, (appGroup) => {
      if (titleDisplay === constants.TitleDisplay.Focused)  {
        appGroup.hideLabel(false);
      }
      appGroup.handleTitleDisplayChange();
    });
    this.state.set({lastTitleDisplay: titleDisplay});
  }

  getAppFromWMClass(specialApps, metaWindow) {
    let startupClass = (wmClass)=> {
      let app = null;
      for (let i = 0, len = specialApps.length; i < len; i++) {
        if (specialApps[i].wmClass === wmClass) {
          app = this.appSystem.lookup_app(specialApps[i].id);
          if (app) {
            app.wmClass = wmClass;
          }
        }
      }
      return app;
    };
    return startupClass(metaWindow.get_wm_class_instance());
  }

  getCurrentAppList() {
    if (typeof this.appLists[this.state.currentWs] !== 'undefined') {
      return this.appLists[this.state.currentWs];
    } else if (typeof this.appLists[0] !== 'undefined') {
      return this.appLists[0];
    } else {
      return null;
    }
  }

  getAutoStartApps() {
    let info, autoStartDir;

    let getChildren = () => {
      let children = autoStartDir.enumerate_children('standard::name,standard::type,time::modified', Gio.FileQueryInfoFlags.NONE, null);
      while ((info = children.next_file(null)) !== null) {
        if (info.get_file_type() === Gio.FileType.REGULAR) {
          let name = info.get_name();
          let file = Gio.file_new_for_path(constants.autoStartStrDir + '/' + name);
          this.state.autoStartApps.push({id: name, file: file});
        }
      }
      this.state.set({autoStartApps: this.state.autoStartApps});
    };

    autoStartDir = Gio.file_new_for_path(constants.autoStartStrDir);

    if (autoStartDir.query_exists(null)) {
      getChildren();
    } else {
      Util.trySpawnCommandLine(`bash -c "mkdir ${constants.autoStartStrDir}"`);
      setTimeout(() => getChildren(), 2000);
    }
  }

  handleScroll(e, sourceFromAppGroup) {
    if (this.state.settings.scrollBehavior === 1
      || e && sourceFromAppGroup && !this.state.settings.thumbnailScrollBehavior) {
      return;
    }
    this.state.set({scrollActive: true});
    let isAppScroll = this.state.settings.scrollBehavior === 2;
    let direction, source;
    if (sourceFromAppGroup) {
      isAppScroll = false;
      direction = e ? e.get_scroll_direction() : 1;
      source = sourceFromAppGroup;
    } else {
      direction = e.get_scroll_direction();
      source = e.get_source()._delegate;
    }
    let lastFocusedApp, z, count

    if (isAppScroll) {
      lastFocusedApp = this.appLists[this.state.currentWs].listState.lastFocusedApp;
      if (!lastFocusedApp) {
        lastFocusedApp = this.appLists[this.state.currentWs].appList[0].groupState.appId
      }
      let focusedIndex = findIndex(this.appLists[this.state.currentWs].appList, function(appGroup) {
        return appGroup.groupState.metaWindows.length > 0 && appGroup.groupState.appId === lastFocusedApp;
      });
      z = direction === 0 ? focusedIndex - 1 : focusedIndex + 1;
      count = this.appLists[this.state.currentWs].appList.length - 1;
    } else {
      if (!source.groupState || source.groupState.metaWindows.length < 1) {
        return;
      }
      let focusedIndex = findIndex(source.groupState.metaWindows, function(metaWindow) {
        return metaWindow === source.groupState.lastFocused;
      });
      z = direction === 0 ? focusedIndex - 1 : focusedIndex + 1;
      count = source.groupState.metaWindows.length - 1;
    }

    let limit = count * 2;

    while ((isAppScroll && (!this.appLists[this.state.currentWs].appList[z] || !this.appLists[this.state.currentWs].appList[z].groupState.lastFocused))
      || (!isAppScroll && (!source.groupState.metaWindows[z] || source.groupState.metaWindows[z] === source.groupState.lastFocused))) {
      limit--;
      if (direction === 0) {
        z -= 1;
      } else {
        z += 1;
      }
      if (limit < 0) {
        if (count === 0) {
          z = 0;
        }
        break;
      } else if (z < 0) {
        z = count;
      } else if (z > count) {
        z = 0;
      }
    }
    let _window = isAppScroll ? this.appLists[this.state.currentWs].appList[z].groupState.lastFocused : source.groupState.metaWindows[z];
    Main.activateWindow(_window, global.get_current_time());
    setTimeout(() => this.state.set({scrollActive: false}, 4000));
  }

  handleDragOver(source, actor, x, y) {
    if (!this.state.settings.enableDragging
      || this.state.panelEditMode) {
      return DND.DragMotionResult.NO_DROP;
    }

    if (!source.actor) {
      return DND.DragMotionResult.CONTINUE;
    };

    let children = this.appLists[this.state.currentWs].actor.get_children();
    let windowPos = children.indexOf(source.actor);

    let pos = 0;

    let isHorizontal = this.appLists[this.state.currentWs].actor.height > this.appLists[this.state.currentWs].actor.width;
    let axis = isHorizontal ? [y, 'y1'] : [x, 'x1'];
    each(children, (child, i) => {
      if (axis[0] > children[i].get_allocation_box()[axis[1]] + children[i].width / 2) {
        pos = i;
      }
    });

    if (pos !== this.state.dragPlaceholderPos) {
      this.state.dragPlaceholderPos = pos;

      // Don't allow positioning before or after self
      if (windowPos !== -1 && pos === windowPos) {
        if (this.state.dragPlaceholder) {
          this.state.dragPlaceholder.animateOutAndDestroy();
          this.state.animatingPlaceholdersCount++;
          this.state.dragPlaceholder.actor.connect('destroy', () => {
            this.state.animatingPlaceholdersCount--;
          });
        }
        this.state.dragPlaceholder = null;

        return DND.DragMotionResult.CONTINUE;
      }

      // If the placeholder already exists, we just move
      // it, but if we are adding it, expand its size in
      // an animation
      let fadeIn;
      if (this.state.dragPlaceholder) {
        this.state.dragPlaceholder.actor.destroy();
        fadeIn = false;
      } else {
        fadeIn = true;
      }

      let childWidth = source.actor.width;
      let childHeight = source.actor.height;
      this.state.dragPlaceholder = new DND.GenericDragPlaceholderItem();
      this.state.dragPlaceholder.child.width = childWidth;
      this.state.dragPlaceholder.child.height = childHeight;
      this.appLists[this.state.currentWs].actor.insert_child_at_index(this.state.dragPlaceholder.actor, this.state.dragPlaceholderPos);

      if (fadeIn) {
        this.state.dragPlaceholder.animateIn();
      }
    }

    return DND.DragMotionResult.MOVE_DROP;
  }

  // TODO: Figure out exactly which properties on this applet constructor the Cinnamon APIs needs for all modes of
  // DND, so we can kill the _delegate reference. Long term, a PR to Cinnamon should be opened fixing circular
  // object reference structures for the applet and desklet classes.
  acceptDrop(source, actor, x) {
    if (!this.state.settings.enableDragging
      || this.state.panelEditMode) {
      return false;
    }
    if (typeof source.groupState === 'undefined') {
      let appId = source.isDraggableApp ? source.get_app_id() : source.getId();
      if (appId) {
        this.acceptNewLauncher(appId);
        return true;
      }
      return false;
    }
    if (!source.groupState.isFavoriteApp) {
      if (this.state.dragPlaceholderPos !== -1) {
        this.appLists[this.state.currentWs].actor.set_child_at_index(source.actor, this.state.dragPlaceholderPos);
      }
      this._clearDragPlaceholder();
    }
    this.appLists[this.state.currentWs].actor.set_child_at_index(source.actor, this.state.dragPlaceholderPos);

    // Don't allow favoriting of transient apps
    if (!source.groupState.app || source.groupState.app.is_window_backed()) {
      return false;
    }

    let refFav = findIndex(this.pinnedFavorites._favorites, favorite => favorite.id === source.groupState.appId);
    let favPos = this.state.dragPlaceholderPos;

    if (favPos === -1) {
      let children = this.appLists[this.state.currentWs].actor.get_children();
      let pos = 0;
      for (let i = 0, len = children.length; i < len; i++) {
        if (x > children[i].get_allocation_box().x1 + children[i].width / 2) {
          pos = i;
        }
      }
      if (pos !== this.state.dragPlaceholderPos) {
        favPos = pos;
      }
    }

    Meta.later_add(Meta.LaterType.BEFORE_REDRAW, () => {
      let opts = {
        appId: source.groupState.appId,
        app: source.groupState.app,
        pos: favPos
      };
      if (refFav !== -1) {
        this.pinnedFavorites.moveFavoriteToPos(opts);
      } else if (this.state.settings.pinOnDrag) {
        this.pinnedFavorites.addFavorite(opts);
      }
      return false;
    });
    this._clearDragPlaceholder();
    return true;
  }

  _clearDragPlaceholder() {
    if (this.state.dragPlaceholder) {
      this.state.dragPlaceholder.animateOutAndDestroy();
      this.state.dragPlaceholder = null;
      this.state.dragPlaceholderPos = -1;
    }
  }

  acceptNewLauncher(path) {
    this.pinnedFavorites.addFavorite({appId: path, pos: -1});
    // Need to determine why the favorites setting signal doesn't emit outside the applet actions
    this._updateFavorites();
  }

  onWorkspaceRemoved(metaScreen, index) {
    if (this.appLists.length <= index) {
      return;
    }
    let removedLists = [];
    for (let i = 0; i < this.appLists.length; i++) {
      let workspaceIndex = this.appLists[i].metaWorkspace.index();
      if (workspaceIndex === -1) {
        this.appLists[i].destroy();
        this.appLists[i] = null;
        removedLists.push(i);
      } else {
        this.appLists[i].index = workspaceIndex;
      }
    }
    for (let i = 0; i < removedLists.length; i++) {
      this.appLists.splice(removedLists[i], 1);
    }
    this.state.set({currentWs: global.screen.get_active_workspace_index()});
  }

  onSwitchWorkspace() {
    if (typeof require !== 'undefined') {
      setTimeout(() => this._onSwitchWorkspace(), 0);
    } else {
      this._onSwitchWorkspace();
    }
  }

  _onSwitchWorkspace() {
    this.state.set({currentWs: global.screen.get_active_workspace_index()});
    let metaWorkspace = global.screen.get_workspace_by_index(this.state.currentWs);

    // If the workspace we switched to isn't in our list,
    // we need to create an AppList for it
    let refWorkspace = findIndex(this.appLists, (item) => item.metaWorkspace && isEqual(item.metaWorkspace, metaWorkspace));

    if (refWorkspace === -1) {
      this.appLists.push(new AppList({
        metaWorkspace: metaWorkspace,
        state: this.state,
        index: this.state.currentWs
      }));
      refWorkspace = this.appLists.length - 1;
    }

    this.actor.remove_all_children();
    this.actor.add_child(this.appLists[refWorkspace].actor);
  }

  _onOverviewShow() {
    this.actor.hide();
  }

  _onOverviewHide() {
    this.actor.show();
  }
}

function main(metadata, orientation, panel_height, instance_id) {
  return new ITMApplet(metadata, orientation, panel_height, instance_id);
}
