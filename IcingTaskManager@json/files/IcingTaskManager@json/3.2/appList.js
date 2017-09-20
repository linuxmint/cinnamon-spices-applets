const Lang = imports.lang;
const Clutter = imports.gi.Clutter;
const St = imports.gi.St;
const Gio = imports.gi.Gio;
const SignalManager = imports.misc.signalManager;

let each, isEqual, AppGroup, setTimeout;
if (typeof require !== 'undefined') {
  each = require('./each').each;
  isEqual = require('./isEqual').isEqual;
  AppGroup = require('./appGroup').AppGroup;
  setTimeout = require('./timers').setTimeout;
} else {
  const AppletDir = imports.ui.appletManager.applets['IcingTaskManager@json'];
  each = AppletDir.each.each;
  isEqual = AppletDir.isEqual.isEqual;
  AppGroup = AppletDir.appGroup.AppGroup;
  setTimeout = AppletDir.timers.setTimeout;
}

// List of running apps
function AppList () {
  this._init.apply(this, arguments);
}

AppList.prototype = {
  _init: function (params) {
    this.initialized = false;

    this.state = params.state;

    this.signals = new SignalManager.SignalManager(this);
    this.metaWorkspace = params.metaWorkspace;
    this.actor = new St.BoxLayout();

    if (this.state.orientation === St.Side.TOP || this.state.orientation === St.Side.BOTTOM) {
      this.manager = new Clutter.BoxLayout({ orientation: Clutter.Orientation.HORIZONTAL });
    } else {
      this.manager = new Clutter.BoxLayout({ orientation: Clutter.Orientation.VERTICAL });
      this.actor.add_style_class_name('vertical');
      this.state.trigger('setVertical', true);
    }

    this.managerContainer = new Clutter.Actor({ layout_manager: this.manager });
    this.actor.add_actor(this.managerContainer);

    this.appList = [];
    this.lastFocusedApp = null;
    this.lastCycled = null;

    // Connect all the signals
    this.signals.connect(this.metaWorkspace, 'window-added', Lang.bind(this, this._windowAdded));
    this.signals.connect(this.metaWorkspace, 'window-removed', Lang.bind(this, this._windowRemoved));
    this._refreshList();

    this.signals.connect(this.actor, 'style-changed', Lang.bind(this, this._updateSpacing));

    this.on_orientation_changed(this.state.orientation, true);
    this.initialized = true;
  },

  on_orientation_changed: function(orientation, init) {
    if (this.manager === undefined) {
      return;
    }
    // Any padding/margin is removed on one side so that the AppMenuButton
    // boxes butt up against the edge of the screen

    let orientationKey = null;

    each(St.Side, (side, key)=>{
      if (orientation === St.Side[key]) {
        orientationKey = key.toLowerCase();
        return;
      }
    });

    let isVertical = orientationKey === 'left' || orientationKey === 'right';
    if (isVertical) {
      this.manager.set_vertical(true);
      this.actor.add_style_class_name('vertical');
      this.state.trigger('setVertical', true);
      this.actor.set_x_align(Clutter.ActorAlign.CENTER);
      this.actor.set_important(true);
    } else {
      this.manager.set_vertical(false);
      this.actor.remove_style_class_name('vertical');
      this.state.trigger('setVertical', false);
    }

    if (!init) {
      this.state.trigger('setSettingsValue', 'vertical-thumbnails', isVertical);
    }

    for (let i = 0; i < this.appList.length; i++) {
      this.appList[i].actor.set_x_align(Clutter.ActorAlign.CENTER);
    }

    /*if (this._applet.appletEnabled) {
      this._updateSpacing();
    }*/
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

  _refreshAllThumbnails: function() {
    for (let i = 0, len = this.appList.length; i < len; i++) {
      this.appList[i].hoverMenu._refresh(true);
    }
  },

  _onAppKeyPress: function(number){
    if (number > this.appList.length) {
      return;
    }
    this.appList[number - 1]._onAppKeyPress(number);
  },

  _onNewAppKeyPress: function(number){
    if (number > this.appList.length) {
      return;
    }
    this.appList[number - 1]._onNewAppKeyPress(number);
  },

  _showAppsOrder: function(){
    for (let i = 0, len = this.appList.length; i < len; i++) {
      this.appList[i].showOrderLabel(i);
    }
    setTimeout(() => this._calcAllWindowNumbers(), this.state.settings.showAppsOrderTimeout);
  },

  _cycleMenus: function(){
    let refApp = 0;
    if (!this.lastCycled && this.lastFocusedApp) {
      refApp = this.appList.findIndex(app => app.appId === this.lastFocusedApp);
    }
    if (this.lastCycled) {
      this.appList[this.lastCycled].hoverMenu.close();
      refApp = this.lastCycled + 1;
    }
    if (refApp === this.lastCycled) {
      refApp = this.lastCycled + 1;
    }
    this.lastCycled = refApp;
    if (refApp > this.appList.length - 1) {
      refApp = 0;
      this.lastCycled = 0;
    }
    if (this.appList[refApp].groupState.metaWindows.length > 0) {
      this.appList[refApp].hoverMenu.open();
    } else {
      this._cycleMenus();
    }
  },

  _updateSpacing: function() {
    this.manager.set_spacing(this.state.settings.iconSpacing * global.ui_scale);
  },

  _setLastFocusedApp: function(id){
    this.lastFocusedApp = id;
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
    let windows = this.metaWorkspace.list_windows();

    for (let i = 0, len = windows.length; i < len; i++) {
      this._windowAdded(this.metaWorkspace, windows[i]);
    }
  },

  _updateAttentionState: function (display, window) {
    each(this.appList, (appGroup)=>{
      if (appGroup.groupState.metaWindows) {
        appGroup._appButton._onWindowDemandsAttention(window);
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
    // Check to see if the window that was added already has an app group.
    // If it does, then we don't need to do anything.  If not, we need to
    // create an app group.
    if (!app) {
      app = this.state.trigger('getAppFromWMClass', this.specialApps, metaWindow);
    }
    if (!app) {
      app = this.state.trigger('getTracker').get_window_app(metaWindow);
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
      if (isEqual(app, appGroup.app)) {
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
      let refFav = this.state.trigger('getFavorites').findIndex(favorite => {
        return isEqual(favorite.app, app);
      });
      if (refFav > -1) {
        transientFavorite = true;
      }
    }

    let initApp = (metaWindows, window, index)=>{
      let time = Date.now();
      let appGroup = new AppGroup({
        /*appList: {
          managerContainer: this.managerContainer,
          _fixAppGroupIndexAfterDrag: this._fixAppGroupIndexAfterDrag,
          _closeAllRightClickMenus: this._closeAllRightClickMenus,
          _closeAllHoverMenus: this._closeAllHoverMenus,
          _windowRemoved: this._windowRemoved,
          _windowAdded: this._windowAdded,
          _setLastFocusedApp: this._setLastFocusedApp
        },*/
        state: this.state,
        appList: this,
        app: app,
        isFavoriteApp: isFavoriteApp,
        metaWorkspace: metaWorkspace,
        metaWindows: metaWindows,
        metaWindow: metaWindow,
        timeStamp: time,
        ungroupedIndex: index,
        appId: appId,
      });
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
      let appWindows = app.get_windows();
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

  _fixAppGroupIndexAfterDrag: function (appId) {
    let originPos = this.appList.findIndex(app => app.appId === appId);
    let pos = this.managerContainer.get_children().findIndex(actor => {
      return isEqual(actor, this.appList[originPos].actor);
    });
    if (originPos === pos
      || originPos < 0
      || pos < 0) {
      return;
    }
    if (pos > originPos) {
      // TBD: if drag to a right position, exclude postion hold by origin
      pos -= 1;
    }
    // originPos -> pos
    let data = this.appList[originPos];
    this.appList.splice(originPos, 1);
    this.appList.splice(pos, 0, data);
    data = undefined;
  },

  _windowRemoved: function (metaWorkspace, metaWindow, positionChange) {
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
        if (isFavoriteApp || (isFavoriteApp && !this.state.settings.groupApps && windowCount === 2)) {
          this.appList[refApp]._isFavorite(true);
          this._refreshApps();
          return;
        }
        this.appList[refApp].destroy(true);
        this.appList[refApp] = undefined;
        this.appList.splice(refApp, 1);
      }, positionChange);
    }
  },

  destroy: function () {
    this.signals.disconnectAllSignals();
    for (let i = 0, len = this.appList.length; i < len; i++) {
      this.appList[i].destroy();
    }
    if (this._appButton) {
      this._appButton.destroy();
    }
    if (this.rightClickMenu) {
      this.rightClickMenu.destroy();
    }
    this.actor.destroy();
    let props = Object.keys(this);
    each(props, (propKey)=>{
      this[propKey] = undefined;
    });
  }
};