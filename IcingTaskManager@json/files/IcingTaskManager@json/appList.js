const Lang = imports.lang;
const Clutter = imports.gi.Clutter;
const St = imports.gi.St;
const Gio = imports.gi.Gio;
const SignalManager = imports.misc.signalManager;

const AppletDir = imports.ui.appletManager.applets['IcingTaskManager@json'];

const _ = AppletDir.lodash._;
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
    this.orientation = applet.orientation;
    this.signals = new SignalManager.SignalManager(this);
    this.metaWorkspace = metaWorkspace;
    this.actor = new St.BoxLayout();

    if (this.orientation === St.Side.TOP || this.orientation === St.Side.BOTTOM) {
      this.manager = new Clutter.BoxLayout({ orientation: Clutter.Orientation.HORIZONTAL });
    } else {
      this.manager = new Clutter.BoxLayout({ orientation: Clutter.Orientation.VERTICAL });
      this.actor.add_style_class_name('vertical');
      this._applet.actor.add_style_class_name('vertical');
    }

    this.manager_container = new Clutter.Actor({ layout_manager: this.manager });
    this.actor.add_actor(this.manager_container);

    this.registeredApps = [];

    this.appList = [];
    this.lastFocusedApp = null;
    this.lastCycled = null;

    // Connect all the signals
    this._setSignals();
    this._refreshList(true);

    this.signals.connect(this.actor, 'style-changed', Lang.bind(this, this._updateSpacing));

    this.on_orientation_changed(this._applet.orientation, true);
  },

  on_applet_added_to_panel: function() {
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

    let containerChildren = this.manager_container.get_children();

    let orientationKey = null;
    each(St.Side, (side, key)=>{
      if (orientation === St.Side[key]) {
        orientationKey = key.toLowerCase();
        return;
      }
    });
    let style = 'margin-' + orientationKey + ': 0px; padding-' + orientationKey + ': 0px;';
    let isVertical = orientationKey === 'left' || orientationKey === 'right';

    if (isVertical) {
      this.manager.set_vertical(true);
      this.actor.add_style_class_name('vertical');
      this.actor.set_x_align(Clutter.ActorAlign.CENTER);
      this.actor.set_important(true);
      let opposite = orientationKey === 'left' ? 'right' : 'left';
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
      //child.set_style(style); TBD
      if (isVertical) {
        child.set_x_align(Clutter.ActorAlign.CENTER);
      }
    });
    //this.actor.set_style(style);

    if (this._applet.appletEnabled) {
      this._updateSpacing();
    }
  },

  _setSignals: function () {
    this.signals.connect(this.metaWorkspace, 'window-added', Lang.bind(this, this._windowAdded));
    this.signals.connect(this.metaWorkspace, 'window-removed', Lang.bind(this, this._windowRemoved));
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
    this.appList[number - 1].appGroup._onAppKeyPress(number);
  },

  _onNewAppKeyPress: function(number){
    if (number > this.appList.length) {
      return;
    }
    this.appList[number - 1].appGroup._onNewAppKeyPress(number);
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
    let refApp = 0;
    if (!this.lastCycled && this.lastFocusedApp) {
      refApp = _.findIndex(this.appList, {id: this.lastFocusedApp});
    }
    if (this.lastCycled) {
      this.appList[this.lastCycled].appGroup.hoverMenu.close();
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
    if (this.appList[refApp].appGroup.metaWindows.length > 0) {
      this.appList[refApp].appGroup.hoverMenu.open();
    } else {
      setTimeout(()=>this._cycleMenus(), 0);
    }
  },

  _updateSpacing: function() {
    this.manager.set_spacing(this._applet.iconSpacing * global.ui_scale);
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
    this._updateFocusState();
  },

  /*
    Refresh specific apps by finding their index, destroying, and recreating them.
  */

  _refreshAppById: function(appId, opts){
    let refApp = _.findIndex(this.appList, {id: appId});
    if (refApp !== -1) {
      let app = this.appList[refApp].appGroup.app;
      let isFavapp = opts.favChange ? opts.isFavapp : this.appList[refApp].appGroup.isFavapp;
      let index = this.appList[refApp].ungroupedIndex;

      this.appList[refApp].appGroup.destroy();

      let windows = app.get_windows();

      let window = null;
      let hasWindows = windows.length > 0;

      if (!isFavapp && !hasWindows && opts.favChange) {
        _.pullAt(this.appList, refApp);
        return;
      }

      if (!this._applet.groupApps) {
        window = app.get_windows()[0];
      }

      let time = Date.now();

      let appGroup = new AppGroup(this._applet, this, app, isFavapp, window, time, index, appId);

      appGroup._updateMetaWindows(this.metaWorkspace, app, window);

      this.appList[refApp].appGroup = appGroup;
      this.appList[refApp].time = time;

      let refPos = opts.favPos ? opts.favPos : refApp;

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
    let windows = this.metaWorkspace.list_windows();

    for (let i = 0, len = windows.length; i < len; i++) {
      this._windowAdded(this.metaWorkspace, windows[i], null, null);
    }
  },

  _updateFocusState: function () {
    each(this.appList, (appObject)=>{
      if (appObject.appGroup.metaWindows) {
        appObject.appGroup._appButton._onFocusChange();
      }
      if (appObject.appGroup.hoverMenu.isOpen) {
        each(appObject.appGroup.hoverMenu.appSwitcherItem.appThumbnails, (thumbnailObject)=>{
          thumbnailObject.thumbnail._onFocusChange();
          return false;
        });
      }
    });
  },

  _updateAttentionState: function (display, window) {
    each(this.appList, (appObject)=>{
      if (appObject.appGroup.metaWindows) {
        appObject.appGroup._appButton._onWindowDemandsAttention(window);
      }
      if (appObject.appGroup.hoverMenu.isOpen) {
        each(appObject.appGroup.hoverMenu.appSwitcherItem.appThumbnails, (thumbnailObject)=>{
          thumbnailObject.thumbnail._onWindowDemandsAttention(window);
          return false;
        });
      }
    });
  },

  _windowAdded: function (metaWorkspace, metaWindow, favapp, isFavapp, forceUngroupedWindow=false) {
    // Check to see if the window that was added already has an app group.
    // If it does, then we don't need to do anything.  If not, we need to
    // create an app group.
    let app = null;
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

    let appId = app.get_id();

    let refApp = _.findIndex(this.appList, {id: appId});

    // If forceUngroupedWindow is set, then this method is being called from the first appGroup instance for this app, to override app grouping.
    if (forceUngroupedWindow && !favapp) {
      refApp = -1;
    }
    let initApp = (wsWindows, window, index)=>{
      let time = Date.now();
      let appGroup = new AppGroup(this._applet, this, app, isFavapp, window, time, index, appId);
      appGroup._updateMetaWindows(metaWorkspace, app, window, wsWindows);

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
        let windows = app.get_windows();
        let wsWindows = metaWorkspace.list_windows();
        windows = _.intersectionWith(windows, wsWindows, _.isEqual);

        let _windows = windows.length > 0 ? windows : [null];

        for (let i = 0, len = _windows.length; i < len; i++) {
          initApp(wsWindows, _windows[i], i);
        }
      }
    } else if (metaWindow) {
      this.appList[refApp].appGroup._windowAdded(metaWorkspace, metaWindow);
    }

  },

  _appGroupNumber: function (parentApp) {
    let result;
    for (let i = 0, len = this.appList.length; i < len; i++) {
      if (this.appList[i].appGroup.app === parentApp) {
        result = i+1;
        break;
      }
    }
    return result;
  },

  _calcAllWindowNumbers: function () {
    for (let i = 0, len = this.appList.length; i < len; i++) {
      this.appList[i].appGroup._calcWindowNumber(this.metaWorkspace);
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
    let originPos = _.findIndex(this.appList, {id: appId}); // app object
    let pos = _.findIndex(this.manager_container.get_children(), this.appList[originPos].appGroup.actor);
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

  _windowRemoved: function (metaWorkspace, metaWindow, app, timeStamp) {
    let refApp = -1, refWindow = -1;
    each(this.appList, (appObject, i)=>{
      let shouldReturn = false;
      each(appObject.appGroup.metaWindows, (win, z)=>{
        if (_.isEqual(win.win, metaWindow)) {
          refApp = i;
          refWindow = z;
          shouldReturn = true;
          return false;
        }
      });
      if (shouldReturn) {
        return false;
      }
    });
    if (refApp > -1) {
      this.appList[refApp].appGroup._windowRemoved(metaWorkspace, metaWindow, refWindow, (appId, isFavapp)=>{
        if ((this.appList[refApp].appGroup.wasFavapp || this.appList[refApp].appGroup.isFavapp) && !timeStamp) {
          this.appList[refApp].appGroup._isFavorite(true);
          this._refreshApps();
          return;
        }
        this.appList[refApp].appGroup.destroy();
        _.pullAt(this.appList, refApp);

        if (isFavapp) {
          this._applet.refreshAppFromCurrentListById(appId, {favChange: true, isFavapp: isFavapp});
        }
      });
    }
  },

  destroy: function () {
    this.signals.disconnectAllSignals();
    for (let i = 0, len = this.appList.length; i < len; i++) {
      this.appList[i].appGroup.destroy();
    }
    this.appList.destroy();
    this.appList = null;
  }
};