const Lang = imports.lang;
const Clutter = imports.gi.Clutter;
const St = imports.gi.St;
const Gio = imports.gi.Gio;

const AppletDir = imports.ui.appletManager.applets['IcingTaskManager@json'];

const _ = AppletDir.lodash._;
const App = AppletDir.applet;
const AppGroup = AppletDir.appGroup.AppGroup;
const each = AppletDir.each.each;
const constants = AppletDir.constants.constants;
const setTimeout = AppletDir.timers.setTimeout;

// List of running apps
function AppList () {
  this._init.apply(this, arguments);
}

AppList.prototype = {
  _init: function (applet, metaWorkspace) {
    this._applet = applet;
    this.settings = applet.settings;
    this.signals = {
      actor: [],
      settings: [],
      metaWorkspace: []
    };
    this.orientation = applet.orientation;
    this.metaWorkspace = metaWorkspace;
    this.actor = new St.BoxLayout();

    var manager;
    if (this.orientation == St.Side.TOP || this.orientation == St.Side.BOTTOM) {
      manager = new Clutter.BoxLayout({ orientation: Clutter.Orientation.HORIZONTAL });
    } else {
      manager = new Clutter.BoxLayout({ orientation: Clutter.Orientation.VERTICAL });
      this.actor.add_style_class_name('vertical');
      this._applet.actor.add_style_class_name('vertical');
    }

    this.manager = manager;
    this.manager_container = new Clutter.Actor({ layout_manager: manager });
    this.actor.add_actor(this.manager_container);

    this.registeredApps = [];

    this.appList = [];
    this.lastFocusedApp = null;
    this.lastCycled = null;

    // Connect all the signals
    this._setSignals();
    this._refreshList(true);

    this.signals.actor.push(this.actor.connect('style-changed', Lang.bind(this, this._updateSpacing)));

    this.on_orientation_changed(this._applet.orientation, true);
  },

  on_panel_edit_mode_changed: function () {
    this.actor.reactive = global.settings.get_boolean('panel-edit-mode');
  },

  on_applet_added_to_panel: function(userEnabled) {
    this._updateSpacing();
    this._applet.appletEnabled = true;
  },

  on_orientation_changed: function(orientation, init) {
    if (this.manager === undefined) {
      return;
    }
    this._applet.orientation = orientation;

    // Any padding/margin is removed on one side so that the AppMenuButton
    // boxes butt up against the edge of the screen

    var containerChildren = this.manager_container.get_children();

    var orientationKey = null;
    each(St.Side, (side, key)=>{
      if (orientation === St.Side[key]) {
        orientationKey = key.toLowerCase();
        return;
      }
    });
    var style = 'margin-' + orientationKey + ': 0px; padding-' + orientationKey + ': 0px;';
    var isVertical = orientationKey === 'left' || orientationKey === 'right';

    if (isVertical) {
      this.manager.set_vertical(true);
      this.actor.add_style_class_name('vertical');
      this.actor.set_x_align(Clutter.ActorAlign.CENTER);
      this.actor.set_important(true);
      var opposite = orientationKey === 'left' ? 'right' : 'left';
      style += 'padding-' + opposite + ': 0px; margin-' + opposite + ': 0px;';
    } else {
      this.manager.set_vertical(false);
      this.actor.remove_style_class_name('vertical');
      this._applet.actor.remove_style_class_name('vertical');
    }

    if (!init) {
      this.settings.setValue('vertical-thumbnails', isVertical);
    }

    each(containerChildren, (child, key)=>{
      child.set_style(style);
      if (isVertical) {
        child.set_x_align(Clutter.ActorAlign.CENTER);
      }
    });
    this.actor.set_style(style);

    if (this._applet.appletEnabled) {
      this._updateSpacing();
    }
  },
  _closeAllHoverMenus: function(cb) {
    for (let i = 0, len = this.appList.length; i < len; i++) {
      if (this.appList[i].appGroup.hoverMenu.isOpen) {
        this.appList[i].appGroup.hoverMenu.close();
      }
    }
    if (typeof cb === 'function') {
      cb();
    }
  },

  _closeAllRightClickMenus: function(cb) {
    for (let i = 0, len = this.appList.length; i < len; i++) {
      if (typeof this.appList[i].appGroup.rightClickMenu !== 'undefined'
        && this.appList[i].appGroup.rightClickMenu.isOpen) {
        this.appList[i].appGroup.rightClickMenu.close();
      }
    }
    if (typeof cb === 'function') {
      cb();
    }
  },

  _refreshAllThumbnails: function() {
    for (let i = 0, len = this.appList.length; i < len; i++) {
      this.appList[i].appGroup.hoverMenu.appSwitcherItem._refresh(true);
    }
  },

  _onAppKeyPress: function(number){
    if (number > this.appList.length) {
      return;
    }
    this.appList[number-1].appGroup._onAppKeyPress(number);
  },

  _onNewAppKeyPress: function(number){
    if (number > this.appList.length) {
      return;
    }
    this.appList[number-1].appGroup._onNewAppKeyPress(number);
  },

  _showAppsOrder: function(){
    for (let i = 0, len = this.appList.length; i < len; i++) {
      this.appList[i].appGroup.showOrderLabel(i.toString());
    }
    setTimeout(() => {
      for (let i = 0, len = this.appList.length; i < len; i++) {
        this.appList[i].appGroup.hideOrderLabel();
      }
    }, this._applet.showAppsOrderTimeout);
  },

  _cycleMenus: function(){
    var refApp = 0;
    if (!this.lastCycled && this.lastFocusedApp) {
      refApp = _.findIndex(this.appList, {id: this.lastFocusedApp});
    }
    if (this.lastCycled) {
      this.appList[this.lastCycled].appGroup.hoverMenu.close();
      refApp = this.lastCycled+1;
    }
    if (refApp === this.lastCycled) {
      refApp = this.lastCycled+1;
    }
    this.lastCycled = refApp;
    if (refApp > this.appList.length - 1) {
      refApp = 0;
      this.lastCycled = 0;
    }
    if (this.appList[refApp].appGroup.metaWindows.length > 0) {
      this.appList[refApp].appGroup.hoverMenu.open();
    } else {
      setTimeout(()=>this._cycleMenus(), 0);
    }
  },

  _updateSpacing: function() {
    this.manager.set_spacing(this._applet.iconSpacing * global.ui_scale);
  },

  _setSignals: function () {
    // We use connect_after so that the window-tracker time to identify the app
    this.signals.metaWorkspace.push(this.metaWorkspace.connect_after('window-added', Lang.bind(this, this._windowAdded)));
    this.signals.metaWorkspace.push(this.metaWorkspace.connect_after('window-removed', Lang.bind(this, this._windowRemoved)));

    this.signals.settings.push(this.settings.connect('changed::show-pinned', Lang.bind(this, this._refreshList)));
    this.signals.settings.push(this.settings.connect('changed::icon-spacing', Lang.bind(this, this._updateSpacing)));
    this.panelEditId = global.settings.connect('changed::panel-edit-mode', Lang.bind(this, this.on_panel_edit_mode_changed));
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

  _refreshList: function (init=null) {
    for (let i = 0, len = this.appList.length; i < len; i++) {
      this.appList[i].appGroup.destroy();
    }

    this.appList = [];
    this.registeredApps = this._getSpecialApps();
    this._loadFavorites(init);
    this._refreshApps(init);
  },

  /*
    Refresh specific apps by finding their index, destroying, and recreating them.
  */

  _refreshAppById: function(appId, opts){
    var refApp = _.findIndex(this.appList, {id: appId});
    if (refApp !== -1) {
      var app = this.appList[refApp].appGroup.app;
      var isFavapp = opts.favChange ? opts.isFavapp : this.appList[refApp].appGroup.isFavapp;
      var index = this.appList[refApp].ungroupedIndex;

      this.appList[refApp].appGroup.destroy();

      var windows = app.get_windows();

      var window = null;
      var hasWindows = windows.length > 0;

      if (!isFavapp && !hasWindows && opts.favChange) {
        _.pullAt(this.appList, refApp);
        return;
      }

      if (!this._applet.groupApps) {
        window = app.get_windows()[0];
      }

      var time = Date.now();

      let appGroup = new AppGroup(this._applet, this, app, isFavapp, window, time, index, appId);

      appGroup._updateMetaWindows(this.metaWorkspace, app, window);
      appGroup.watchWorkspace(this.metaWorkspace);

      this.appList[refApp].appGroup = appGroup;
      this.appList[refApp].time = time;

      var refPos = opts.favPos ? opts.favPos : refApp;

      this.appList.splice(refPos, 0, this.appList.splice(refApp, 1)[0]);

      for (let i = 0, len = this.appList.length; i < len; i++) {
        this.manager_container.set_child_at_index(this.appList[i].appGroup.actor, i);
      }
    } else if (opts.favChange) {
      this._applet.refreshCurrentAppList();
    }
  },

  _loadFavorites: function (init) {
    if (!this.settings.getValue('show-pinned')) {
      return;
    }
    let launchers =  this._applet.pinned_app_contr()._getIds();

    for (let i = 0, len = launchers.length; i < len; i++) {
      let app = this._applet._appSystem.lookup_app(launchers[i]);
      if (!app) {
        app = this._applet._appSystem.lookup_settings_app(launchers[i]);
      }
      if (!app) {
        continue;
      }
      this._windowAdded(this.metaWorkspace, null, app, true);
    }
  },

  _refreshApps: function (init) {
    var windows = this.metaWorkspace.list_windows();

    for (let i = 0, len = windows.length; i < len; i++) {
      this._windowAdded(this.metaWorkspace, windows[i], null, null);
    }
  },

  _windowAdded: function (metaWorkspace, metaWindow, favapp, isFavapp, forceUngroupedWindow=false) {
    // Check to see if the window that was added already has an app group.
    // If it does, then we don't need to do anything.  If not, we need to
    // create an app group.
    var app = null;
    if (favapp) {
      app = favapp;
    } else {
      app = this._applet.getAppFromWMClass(this.specialApps, metaWindow);
    }
    if (!app) {
      app = this._applet.tracker.get_window_app(metaWindow);
    }
    if (!app) {
      return;
    }

    var appId = app.get_id();

    var refApp = _.findIndex(this.appList, {id: appId});

    // If forceUngroupedWindow is set, then this method is being called from the first appGroup instance for this app, to override app grouping.
    if (forceUngroupedWindow && !favapp) {
      refApp = -1;
    }

    var initApp = (wsWindows, window, index)=>{
      var time = Date.now();
      let appGroup = new AppGroup(this._applet, this, app, isFavapp, window, time, index, appId);
      appGroup._updateMetaWindows(metaWorkspace, app, window, wsWindows);
      appGroup.watchWorkspace(metaWorkspace);

      this.appList.push({
        id: appId,
        appGroup: appGroup,
        timeStamp: time,
        ungroupedIndex: index
      });

      if (this.settings.getValue('title-display') === constants.TitleDisplay.Focused) {
        appGroup.hideAppButtonLabel(false);
      }
    };

    if (refApp === -1) {
      if (this._applet.groupApps || forceUngroupedWindow && !favapp) {
        initApp();
      } else {
        var windows = app.get_windows();
        var wsWindows = metaWorkspace.list_windows();
        windows = _.intersectionWith(windows, wsWindows, _.isEqual);

        var _windows = windows.length > 0 ? windows : [null];

        for (let i = 0, len = _windows.length; i < len; i++) {
          initApp(wsWindows, _windows[i], i);
        }
      }
    }
  },

  _appGroupNumber: function (parentApp) {
    var result;
    for (let i = 0, len = this.appList.length; i < len; i++) {
      if (this.appList[i].appGroup.app === parentApp) {
        result = i+1;
        break;
      }
    }
    return result;
  },

  _onAppWindowsChanged: function (app, cb) {
    let numberOfwindows = this._getNumberOfAppWindowsInWorkspace(app, this.metaWorkspace);
    if (!numberOfwindows || numberOfwindows === 0) {
      this._removeApp(app);
      this._calcAllWindowNumbers();
    }
    if (typeof cb === 'function') {
      cb();
    }
  },

  _calcAllWindowNumbers: function () {
    for (let i = 0, len = this.appList.length; i < len; i++) {
      this.appList[i].appGroup._calcWindowNumber(this.metaWorkspace);
    }
  },

  _getNumberOfAppWindowsInWorkspace: function (app, workspace) {
    var windows = app.get_windows();

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
    let originPos = _.findIndex(this.appList, {id: appId}); // app object
    var pos = _.findIndex(this.manager_container.get_children(), this.appList[originPos].appGroup.actor);
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
    _.pullAt(this.appList, originPos);
    this.appList.splice(pos, 0, data);
  },

  _windowRemoved: function (metaWorkspace, metaWindow, app) {

    // When a window is closed, we need to check if the app it belongs
    // to has no windows left.  If so, we need to remove the corresponding AppGroup
    if (!app) {
      app = this._applet.getAppFromWMClass(this.specialApps, metaWindow);

      if (!app){
        app = this._applet.tracker.get_window_app(metaWindow);
      }
      if (!app) {
        return;
      }
    }
    let hasWindowsOnWorkspace;
    if (app.wmClass) {
      hasWindowsOnWorkspace = metaWorkspace.list_windows().some(function (win) {
        return _.isEqual(app.wmClass, win.get_wm_class_instance());
      });
    } else {
      hasWindowsOnWorkspace = app.get_windows().some(function (win) {
        return _.isEqual(win.get_workspace(), metaWorkspace);
      });
    }

    if (app && !hasWindowsOnWorkspace) {
      this._removeApp(app);
    }
  },

  _removeApp: function (app, timeStamp) {
    // This function may get called multiple times on the same app and so the app may have already been removed
    var refApp = -1;
    if (this._applet.groupApps || !timeStamp) {
      refApp = _.findIndex(this.appList, {id: app.get_id()});
    } else if (timeStamp) {
      refApp = _.findIndex(this.appList, (_app)=>{
        return _app.timeStamp === timeStamp;
      });
    }
    if (refApp !== -1) {
      if ((this.appList[refApp].appGroup.wasFavapp || this.appList[refApp].appGroup.isFavapp) && !timeStamp) {
        this.appList[refApp].appGroup._isFavorite(true);

        this._refreshApps();
        return;
      }

      this.appList[refApp].appGroup.destroy();
      _.pullAt(this.appList, refApp);
    }
  },

  destroy: function () {
    each(this.signals, (signal, key)=>{
      each(signal, (id)=>{
        this[key].disconnect(id);
      });
    });
    global.settings.disconnect(this.panelEditId);
    for (let i = 0, len = this.appList.length; i < len; i++) {
      this.appList[i].appGroup.destroy();
    }
    this.appList.destroy();
    this.appList = null;
  }
};