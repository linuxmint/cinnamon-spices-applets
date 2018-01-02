const Clutter = imports.gi.Clutter;
const Gio = imports.gi.Gio;
const Lang = imports.lang;
const SignalManager = imports.misc.signalManager;

let each, findIndex, find, filter, isEqual, AppGroup, setTimeout, unref, store;
if (typeof require !== 'undefined') {
  const utils = require('./utils');
  each = utils.each;
  findIndex = utils.findIndex;
  find = utils.find;
  filter = utils.filter;
  isEqual = utils.isEqual;
  setTimeout = utils.setTimeout;
  unref = utils.unref;
  AppGroup = require('./appGroup').AppGroup;
  store = require('./store');
} else {
  const AppletDir = imports.ui.appletManager.applets['IcingTaskManager@json'];
  each = AppletDir.utils.each;
  findIndex = AppletDir.utils.findIndex;
  find = AppletDir.utils.find;
  filter = AppletDir.utils.filter;
  isEqual = AppletDir.utils.isEqual;
  setTimeout = AppletDir.utils.setTimeout;
  unref = AppletDir.utils.unref;
  AppGroup = AppletDir.appGroup.AppGroup;
  store = AppletDir.store_mozjs24;
}

// List of running apps
function AppList () {
  this._init.apply(this, arguments);
}

AppList.prototype = {
  _init: function (params) {
    this.state = params.state;
    this.state.connect({
      orientation: () => this.on_orientation_changed(false),
    });
    this.listState = store.init({
      workspaceIndex: params.index,
      lastFocusedApp: null,
    });
    this.listState.connect({
      getWorkspace: () => this.metaWorkspace,
      updateAppGroupIndexes: () => this.updateAppGroupIndexes(),
      _closeAllRightClickMenus: (cb) => this._closeAllRightClickMenus(cb),
      _closeAllHoverMenus: (cb) => this._closeAllHoverMenus(cb),
      _windowAdded: (win) => this._windowAdded(this.metaWorkspace, win),
      _windowRemoved: (win) => this._windowRemoved(this.metaWorkspace, win),
      removeChild: (actor) => {
        if (this.state.willUnmount) {
          return;
        }
        this.actor.remove_child(actor);
      },
      updateFocusState: (focusedAppId) => {
        each(this.appList, (appGroup) => {
          if (focusedAppId === appGroup.groupState.appId) {
            return;
          }
          appGroup._onFocusChange(false);
        });
      }
    });

    this.signals = new SignalManager.SignalManager({});
    this.metaWorkspace = params.metaWorkspace;

    const managerOrientation = this.state.isHorizontal ? 'HORIZONTAL' : 'VERTICAL';
    this.manager = new Clutter.BoxLayout({orientation: Clutter.Orientation[managerOrientation]});
    this.actor = new Clutter.Actor({layout_manager: this.manager});

    this.appList = [];
    this.lastFocusedApp = null;

    // Connect all the signals

    this.signals.connect(this.metaWorkspace, 'window-added', Lang.bind(this, this._windowAdded));
    this.signals.connect(this.metaWorkspace, 'window-removed', Lang.bind(this, this._windowRemoved));

    this.on_orientation_changed(null, true);

  },

  on_orientation_changed: function() {
    if (this.manager === undefined) {
      return;
    }
    if (!this.state.isHorizontal) {
      this.manager.set_orientation(Clutter.Orientation.VERTICAL);
      this.actor.set_x_align(Clutter.ActorAlign.CENTER);
    } else {
      this.manager.set_orientation(Clutter.Orientation.HORIZONTAL);
    }
    this._refreshList();
  },

  _closeAllHoverMenus: function(cb) {
    for (let i = 0, len = this.appList.length; i < len; i++) {
      if (this.appList[i].hoverMenu.isOpen) {
        this.appList[i].hoverMenu.close();
      }
    }
    if (typeof cb === 'function') {
      cb();
    }
  },

  _closeAllRightClickMenus: function(cb) {
    for (let i = 0, len = this.appList.length; i < len; i++) {
      if (typeof this.appList[i].rightClickMenu !== 'undefined'
        && this.appList[i].rightClickMenu.isOpen) {
        this.appList[i].rightClickMenu.close();
      }
    }
    if (typeof cb === 'function') {
      cb();
    }
  },

  _onAppKeyPress: function(number){
    if (!this.appList[number - 1]) {
      return;
    }
    this.appList[number - 1]._onAppKeyPress(number);
  },

  _onNewAppKeyPress: function(number){
    if (number > this.appList.length) {
      return;
    }
    this.appList[number - 1].launchNewInstance();
  },

  _showAppsOrder: function(){
    for (let i = 0, len = this.appList.length; i < len; i++) {
      this.appList[i].showOrderLabel(i);
    }
    setTimeout(() => this._calcAllWindowNumbers(), this.state.settings.showAppsOrderTimeout);
  },

  _cycleMenus: function(){
    let refApp = 0;
    if (!this.state.lastCycled && this.listState.lastFocusedApp) {
      refApp = findIndex(this.appList, (app) => app.groupState.appId === this.listState.lastFocusedApp);
    }
    if (this.state.lastCycled
      && this.appList[this.state.lastCycled]) {
      this.appList[this.state.lastCycled].hoverMenu.close();
      refApp = this.state.lastCycled + 1;
    }
    if (refApp === this.state.lastCycled) {
      refApp = this.state.lastCycled + 1;
    }
    this.state.lastCycled = refApp;
    if (refApp > this.appList.length - 1) {
      refApp = 0;
      this.state.lastCycled = 0;
    }
    this.state.set({lastCycled: this.state.lastCycled});
    if (refApp > -1 && this.appList[refApp].groupState.metaWindows.length > 0) {
      this.appList[refApp].hoverMenu.open();
    } else {
      this._cycleMenus();
    }
  },

  _updateSpacing: function() {
    each(this.appList, function(appGroup) {
      appGroup.setMargin();
    });
  },

  // Gets a list of every app on the current workspace
  _getSpecialApps: function () {
    this.specialApps = [];
    let apps = Gio.app_info_get_all();

    for (let i = 0, len = apps.length; i < len; i++) {
      let wmClass = apps[i].get_startup_wm_class();
      if (wmClass) {
        let id = apps[i].get_id();
        this.specialApps.push({ id: id, wmClass: wmClass });
      }
    }
  },

  _refreshList: function () {
    for (let i = 0, len = this.appList.length; i < len; i++) {
      this.appList[i].destroy();
      this.appList[i] = null;
    }
    this.appList = [];
    this._getSpecialApps();
    this._loadFavorites();
    this._refreshApps();
  },

  _loadFavorites: function () {
    if (!this.state.settings.showPinned) {
      return;
    }
    const favorites = this.state.trigger('getFavorites');
    const appSystem = this.state.trigger('getAppSystem');
    for (let i = 0; i < favorites.length; i++) {
      let app = appSystem.lookup_app(favorites[i].id);
      if (!app) {
        app = appSystem.lookup_settings_app(favorites[i].id);
      }
      if (!app) {
        continue;
      }
      this._windowAdded(this.metaWorkspace, null, app, true);
    }
  },

  _refreshApps: function () {
    let windows;
    if (this.state.settings.showAllWorkspaces) {
      windows = global.display.list_windows(0)
    } else {
      windows = this.metaWorkspace.list_windows();
    }

    for (let i = 0, len = windows.length; i < len; i++) {
      this._windowAdded(this.metaWorkspace, windows[i]);
    }
  },

  _updateAttentionState: function (display, window) {
    each(this.appList, (appGroup)=>{
      if (appGroup.groupState.metaWindows) {
        appGroup._onWindowDemandsAttention(window);
      }
      if (appGroup.hoverMenu.isOpen) {
        each(appGroup.hoverMenu.appThumbnails, (thumbnail)=>{
          thumbnail._onWindowDemandsAttention(window);
          return false;
        });
      }
    });
  },

  _windowAdded: function (metaWorkspace, metaWindow, app, isFavoriteApp) {
    if (!this.state) {
      return;
    }
    if (this.state.appletReady
      && this.state.settings.showAllWorkspaces
      && metaWindow
      && !metaWindow.__itmInit__) {
      metaWindow.__itmInit__ = true;
      this.state.trigger('addWindowToAllWorkspaces', metaWindow, app, isFavoriteApp);
    }
    // Check to see if the window that was added already has an app group.
    // If it does, then we don't need to do anything.  If not, we need to
    // create an app group.
    if (!app) {
      app = this.state.trigger('getAppFromWMClass', this.specialApps, metaWindow);
    }
    if (!app) {
      let tracker = this.state.trigger('getTracker');
      if (tracker) {
        app = tracker.get_window_app(metaWindow);
      }
    }
    if (!app
      || (!isFavoriteApp
        && metaWindow
        && (this.state.settings.listMonitorWindows
          && this.state.monitorWatchList.indexOf(metaWindow.get_monitor()) === -1))) {
      return;
    }
    let appId = app.get_id();

    let refApp = -1, refWindow = -1, transientFavorite = false;
    each(this.appList, (appGroup, i)=>{
      let shouldReturn = false;
      if (isEqual(app, appGroup.groupState.app)) {
        refApp = i;
      }
      each(appGroup.groupState.metaWindows, (win, z)=>{
        if (isEqual(win, metaWindow)) {
          if (refApp === -1 || !this.state.settings.groupApps) {
            refApp = i;
          }
          refWindow = z;
          shouldReturn = true;
          return false;
        }
      });
      if (shouldReturn) {
        return false;
      }
    });

    if (!this.state.settings.groupApps && !isFavoriteApp) {
      let refFav = findIndex(this.state.trigger('getFavorites'), (favorite) => {
        return isEqual(favorite.app, app);
      });
      if (refFav > -1) {
        transientFavorite = true;
      }
    }

    let initApp = (metaWindows, window)=>{
      let appGroup = new AppGroup({
        state: this.state,
        listState: this.listState,
        app: app,
        isFavoriteApp: isFavoriteApp,
        metaWorkspace: metaWorkspace,
        metaWindows: metaWindows,
        metaWindow: metaWindow,
        appId: appId,
      });
      this.actor.add_child(appGroup.actor);
      this.appList.push(appGroup);

      if (this.state.settings.groupApps && metaWindows.length > 0) {
        each(metaWindows, (win)=>{
          appGroup._windowAdded(win, metaWindows);
        });
      } else {
        appGroup._windowAdded(window);
      }
    };

    if (refApp === -1) {
      let _appWindows = app.get_windows();
      let appWindows = [];

      for (var i = 0; i < _appWindows.length; i++) {
        if ((this.state.settings.showAllWorkspaces || _appWindows[i].is_on_all_workspaces() || isEqual(_appWindows[i].get_workspace(), this.metaWorkspace))
          && (this.state.settings.includeAllWindows || this.state.trigger('isWindowInteresting', _appWindows[i]))
          && (!this.state.settings.listMonitorWindows || this.state.monitorWatchList.indexOf(_appWindows[i].get_monitor()) > -1 )) {
          appWindows.push(_appWindows[i]);
        }
      }

      if (this.state.settings.groupApps) {
        initApp(appWindows);
      } else {
        if (appWindows.length > 0) {
          each(appWindows, (win)=>{
            initApp([win], win);
          });
        } else {
          initApp([], null);
        }
      }
    } else if (metaWindow) {
      if (this.state.settings.groupApps) {
        this.appList[refApp]._windowAdded(metaWindow, null);
      } else if (transientFavorite && this.appList[refApp].groupState.metaWindows.length === 0) {
        this.appList[refApp]._windowAdded(metaWindow, [metaWindow]);
      } else if (refWindow === -1) {
        initApp([metaWindow], metaWindow);
      }
    }
  },

  _appGroupNumber: function (parentApp) {
    let result;
    for (let i = 0, len = this.appList.length; i < len; i++) {
      if (this.appList[i].app === parentApp) {
        result = i + 1;
        break;
      }
    }
    return result;
  },

  _calcAllWindowNumbers: function () {
    for (let i = 0, len = this.appList.length; i < len; i++) {
      this.appList[i]._calcWindowNumber(this.appList[i].groupState.metaWindows);
    }
  },

  _getNumberOfAppWindowsInWorkspace: function (app, workspace) {
    let windows = app.get_windows();
    let result = 0;

    for (let i = 0, len = windows.length; i < len; i++) {
      let windowWorkspace = windows[i].get_workspace();
      if (windowWorkspace && windowWorkspace.index() === workspace.index()) {
        ++result;
      }
    }
    return result;
  },

  updateAppGroupIndexes: function () {
    const newAppList = [];
    let children = this.actor.get_children();
    for (let i = 0; i < children.length; i++) {
      let appGroup = find(this.appList, (appGroup) => isEqual(appGroup.actor, children[i]));
      if (appGroup) {
        newAppList.push(appGroup);
      }
    }
    this.appList = newAppList;
  },

  _windowRemoved: function (metaWorkspace, metaWindow) {
    if (!this.state) {
      return;
    }
    if ((metaWindow.is_on_all_workspaces() || this.state.settings.showAllWorkspaces) && !metaWindow.__itmFinalize__) {
      metaWindow.__itmFinalize__ = true;
      this.state.trigger('removeWindowFromAllWorkspaces', metaWindow);
      return;
    }
    let refApp = -1, refWindow = -1, windowCount = 0;
    let wmClass = metaWindow.get_wm_class();
    each(this.appList, (appGroup, i)=>{
      let shouldReturn = false;
      each(appGroup.groupState.metaWindows, (win, z)=>{
        if (win.get_wm_class() === wmClass) {
          ++windowCount;
        }
        if (isEqual(win, metaWindow)) {
          ++windowCount;
          refApp = i;
          refWindow = z;
          shouldReturn = this.state.settings.groupApps;
          return false;
        }
      });
      if (shouldReturn) {
        return false;
      }
    });
    if (refApp > -1) {
      this.appList[refApp]._windowRemoved(metaWorkspace, metaWindow, refWindow, (appId, isFavoriteApp)=>{
        if (isFavoriteApp || (isFavoriteApp && !this.state.settings.groupApps && windowCount === 0)) {
          this.appList[refApp].groupState.trigger('isFavoriteApp');
          if (this.state.settings.titleDisplay > 1) {
            this.appList[refApp].hideLabel(true);
            this.appList[refApp].groupState.set({groupReady: false});
          }
          return;
        }
        this.appList[refApp].destroy(true);
        this.appList[refApp] = undefined;
        this.appList.splice(refApp, 1);
      });
    }
  },

  destroy: function () {
    this.signals.disconnectAllSignals();
    for (let i = 0, len = this.appList.length; i < len; i++) {
      this.appList[i].destroy();
    }
    this.listState.destroy();
    this.manager = null;
    this.actor.destroy();
    unref(this);
  }
};