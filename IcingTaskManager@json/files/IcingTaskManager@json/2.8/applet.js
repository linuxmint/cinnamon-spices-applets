// vim: expandtab shiftwidth=4 tabstop=8 softtabstop=4 encoding=utf-8 textwidth=99
/* -*- mode: js2; js2-basic-offset: 4; indent-tabs-mode: nil -*- */
// Cinnamon Window List
// Authors:
//   Kurt Rottmann <kurtrottmann@gmail.com>
//   Jason Siefken
//   Josh hess <jake.phy@gmail.com>
// Taking code from
// Copyright (C) 2011 R M Yorston
// Licence: GPLv2+
// http://intgat.tigress.co.uk/rmy/extensions/gnome-Cinnamon-frippery-0.2.3.tgz

const Applet = imports.ui.applet;
const Lang = imports.lang;
const Cinnamon = imports.gi.Cinnamon;
const St = imports.gi.St;
const Main = imports.ui.main;
const Util = imports.misc.util;
const Signals = imports.signals;
const DND = imports.ui.dnd;
const Settings = imports.ui.settings;
const Gettext = imports.gettext;
const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const GLib = imports.gi.GLib;
const Meta = imports.gi.Meta;
const SignalManager = imports.misc.signalManager;

const AppletDir = imports.ui.appletManager.applets['IcingTaskManager@json'];

const _ = AppletDir.lodash._;
const each = AppletDir.each.each;
const AppList = AppletDir.appList.AppList;
const setTimeout = AppletDir.timers.setTimeout;

// Some functional programming tools
const range = function (a, b) {
  let ret = [];
  // if b is unset, we want a to be the upper bound on the range
  if (b === null || b === undefined) { [a, b] = [0, a];
  }

  for (let i = a; i < b; i++) {
    ret.push(i);
  }
  return ret;
};

function PinnedFavs () {
  this._init.apply(this, arguments);
}

PinnedFavs.prototype = {
  _init: function (applet) {
    this._applet = applet;
    this._favorites = [];
    this._reload();
  },

  _reload: function () {
    let ids = this._applet.settings.getValue('pinned-apps');

    for (let i = 0, len = ids.length; i < len; i++) {
      var refFav = _.findIndex(this._favorites, {id: ids[i]});
      if (refFav === -1) {
        let app = this._applet._appSystem.lookup_app(ids[i]);
        this._favorites.push({
          id: ids[i],
          app: app
        });
      }
    }
  },

  _getIds: function () {
    return _.map(this._favorites, 'id');
  },

  getFavoriteMap: function () {
    return this._favorites;
  },

  getFavorites: function () {
    return _.map(this._favorites, 'app');
  },

  isFavorite: function (appId) {
    var refFav = _.findIndex(this._favorites, {id: appId});
    return refFav !== -1;
  },

  triggerUpdate: function (appId, pos, isFavapp) {
    isFavapp = isFavapp ? isFavapp : false;
    setTimeout(()=>{
      this._applet.refreshAppFromCurrentListById(appId, {favChange: true, favPos: pos, isFavapp: isFavapp});
    }, 15);
  },

  _addFavorite: function (opts={appId: null, app: null, pos: -1}) {
    if (this.isFavorite(opts.appId)) {
      return false;
    }

    if (!opts.app) {
      opts.app = this._applet._appSystem.lookup_app(opts.appId);
    }

    if (!opts.app) {
      opts.app = this._applet._appSystem.lookup_settings_app(opts.appId);
    }

    if (!opts.app) {
      return false;
    }

    var newFav = {
      id: opts.appId,
      app: opts.app
    };

    this._favorites.push(newFav);

    if (opts.pos !== -1) {
      this.moveFavoriteToPos(opts.appId, opts.pos);
      return true;
    }
    this._applet.settings.setValue('pinned-apps', _.map(this._favorites, 'id'));
    this.triggerUpdate(opts.appId, -1, true);
    return true;
  },

  moveFavoriteToPos: function (appId, pos) {
    let oldIndex = _.findIndex(this._favorites, {id: appId});
    if (oldIndex !== -1 && pos > oldIndex) {
      pos = pos - 1;
    }
    this._favorites.splice(pos, 0, this._favorites.splice(oldIndex, 1)[0]);
    this._applet.settings.setValue('pinned-apps', _.map(this._favorites, 'id'));
    this.triggerUpdate(appId, pos, true);
  },

  _removeFavorite: function (appId) {
    var refFav = _.findIndex(this._favorites, {id: appId});
    if (refFav === -1) {
      this.triggerUpdate(appId, -1, false);
    }

    _.pullAt(this._favorites, refFav);
    this._applet.settings.setValue('pinned-apps', _.map(this._favorites, 'id'));

    var refApp = _.findIndex(this._applet.metaWorkspaces[this._applet.currentWs].appList.appList, {id: appId});
    var hasOpenWindows = this._applet.metaWorkspaces[this._applet.currentWs].appList.appList[refApp].appGroup.app.get_windows().length > 0;

    if (hasOpenWindows) {
      this.triggerUpdate(appId, -1, false);
    } else {
      setTimeout(()=>{
        this._applet.metaWorkspaces[this._applet.currentWs].appList.appList[refApp].appGroup.destroy();
        _.pullAt(this._applet.metaWorkspaces[this._applet.currentWs].appList.appList, refApp);
      }, 15);
    }
    return true;
  },

  removeFavorite: function (appId) {
    this._removeFavorite(appId);
  }
};
Signals.addSignalMethods(PinnedFavs.prototype);

function MyApplet (metadata, orientation, panel_height, instance_id) {
  this._init(metadata, orientation, panel_height, instance_id);
}

MyApplet.prototype = {
  __proto__: Applet.Applet.prototype,

  _init: function (metadata, orientation, panel_height, instance_id) {
    Applet.Applet.prototype._init.call(this, orientation, panel_height, instance_id);
    this._uuid = metadata.uuid;
    this.settings = new Settings.AppletSettings(this, this._uuid, instance_id);
    this.homeDir = GLib.get_home_dir();

    this.actor.set_track_hover(false);
    this.orientation = orientation;
    this.appletEnabled = false;

    this.c32 = true;

    // Declare vertical panel compatibility
    try {
      this.setAllowedLayout(Applet.AllowedLayout.BOTH);
    } catch (e) {
      this.c32 = null;
      // We are on Cinnamon < 3.2
    }

    this.execInstallLanguage();
    Gettext.bindtextdomain(this._uuid, GLib.get_home_dir() + '/.local/share/locale');

    var settingsProps = [
      {key: 'show-pinned', value: 'showPinned', cb: null},
      {key: 'show-active', value: 'showActive', cb: this.refreshCurrentAppList},
      {key: 'show-alerts', value: 'showAlerts', cb: null},
      {key: 'group-apps', value: 'groupApps', cb: this.refreshCurrentAppList},
      {key: 'arrange-pinnedApps', value: 'arrangePinned', cb: null},
      {key: 'pinOnDrag', value: 'pinOnDrag', cb: null},
      {key: 'pinned-apps', value: 'pinnedApps', cb: null},
      {key: 'middle-click-action', value: 'middleClickAction', cb: null},
      {key: 'show-apps-order-hotkey', value: 'showAppsOrderHotkey', cb: this._bindAppKey},
      {key: 'show-apps-order-timeout', value: 'showAppsOrderTimeout', cb: null},
      {key: 'cycleMenusHotkey', value: 'cycleMenusHotkey', cb: this._bindAppKey},
      {key: 'hoverPseudoClass', value: 'hoverPseudoClass', cb: this.refreshCurrentAppList},
      {key: 'focusPseudoClass', value: 'focusPseudoClass', cb: this.refreshCurrentAppList},
      {key: 'activePseudoClass', value: 'activePseudoClass', cb: this.refreshCurrentAppList},
      {key: 'panelLauncherClass', value: 'panelLauncherClass', cb: this.refreshCurrentAppList},
      {key: 'enable-hover-peek', value: 'enablePeek', cb: null},
      {key: 'onclick-thumbnails', value: 'onClickThumbs', cb: null},
      {key: 'hover-peek-opacity', value: 'peekOpacity', cb: null},
      {key: 'hover-peek-time', value: 'peekTime', cb: null},
      {key: 'thumbnail-timeout', value: 'thumbTimeout', cb: null},
      {key: 'thumbnail-size', value: 'thumbSize', cb: null},
      {key: 'sort-thumbnails', value: 'sortThumbs', cb: null},
      {key: 'vertical-thumbnails', value: 'verticalThumbs', cb: null},
      {key: 'show-thumbnails', value: 'showThumbs', cb: this.refreshThumbnailsFromCurrentAppList},
      {key: 'animate-thumbnails', value: 'animateThumbs', cb: null},
      {key: 'close-button-style', value: 'thumbCloseBtnStyle', cb: this.refreshCurrentAppList},
      {key: 'include-all-windows', value: 'includeAllWindows', cb: this.refreshCurrentAppList},
      {key: 'number-display', value: 'numDisplay', cb: null},
      {key: 'title-display', value: 'titleDisplay', cb: this.refreshCurrentAppList},
      {key: 'icon-spacing', value: 'iconSpacing', cb: null},
      {key: 'themePadding', value: 'themePadding', cb: this.refreshCurrentAppList},
      {key: 'icon-padding', value: 'iconPadding', cb: null},
      {key: 'enable-iconSize', value: 'enableIconSize', cb: this.refreshCurrentAppList},
      {key: 'icon-size', value: 'iconSize', cb: null},
      {key: 'show-recent', value: 'showRecent', cb: this.refreshCurrentAppList},
      {key: 'menuItemType', value: 'menuItemType', cb: this.refreshCurrentAppList},
      {key: 'firefox-menu', value: 'firefoxMenu', cb: this.refreshCurrentAppList},
      {key: 'autostart-menu-item', value: 'autoStart', cb: this.refreshCurrentAppList},
      {key: 'monitor-move-all-windows', value: 'monitorMoveAllWindows', cb: this.refreshCurrentAppList},
      {key: 'useSystemTooltips', value: 'useSystemTooltips', cb: null},
    ];

    if (this.c32) {
      for (let i = 0, len = settingsProps.length; i < len; i++) {
        this.settings.bind(settingsProps[i].key, settingsProps[i].value, settingsProps[i].cb);
      }
    } else {
      for (let i = 0, len = settingsProps.length; i < len; i++) {
        var direction = settingsProps[i].value === 'pinnedApps' ? 'BIDIRECTIONAL' : 'IN';
        this.settings.bindProperty(Settings.BindingDirection[direction], settingsProps[i].key, settingsProps[i].value, settingsProps[i].cb, null);
      }
    }

    this._box = new St.Bin();

    this.actor.add(this._box);

    this.tracker = Cinnamon.WindowTracker.get_default();
    this._appSystem = Cinnamon.AppSystem.get_default();

    this.pinnedAppsContr = new PinnedFavs(this);

    this.recentManager = Gtk.RecentManager.get_default();
    this.sortRecentItems(this.recentManager.get_items());

    this.metaWorkspaces = [];

    this.autostartApps = [];

    // Boolean states
    this._menuOpen = false;
    this.forceRefreshList = false;

    this.signals = new SignalManager.SignalManager(this);
    this.signals.connect(global.window_manager, 'switch-workspace', this._onSwitchWorkspace);
    this.signals.connect(global.screen, 'notify::n-workspaces', this._onWorkspaceCreatedOrDestroyed);
    this.signals.connect(Main.overview, 'showing', this._onOverviewShow);
    this.signals.connect(Main.overview, 'hiding', this._onOverviewHide);
    this.signals.connect(Main.expo, 'showing', this._onOverviewShow);
    this.signals.connect(Main.expo, 'hiding', this._onOverviewHide);
    this.signals.connect(Main.themeManager, 'theme-set', this.onThemeChange);

    this._dragPlaceholder = null;
    this._dragPlaceholderPos = -1;
    this._animatingPlaceholdersCount = 0;

    this.getAutostartApps();

    // Query apps for the current workspace
    this.currentWs = global.screen.get_active_workspace_index();
    this._onSwitchWorkspace();
    this._bindAppKey();

    this.panelEditId = global.settings.connect('changed::panel-edit-mode', Lang.bind(this, this.on_panel_edit_mode_changed));
  },

  on_panel_height_changed: function() {
    this.refreshCurrentAppList();
  },

  on_orientation_changed: function(orientation) {
    this.metaWorkspaces[this.currentWs].appList.on_orientation_changed(orientation);
  },

  on_applet_removed_from_panel: function() {
    this.signals.disconnectAllSignals();
  },

  // Override Applet._onButtonPressEvent due to the applet menu being replicated in AppMenuButtonRightClickMenu.
  _onButtonPressEvent: function() {
    return false;
  },

  _bindAppKey: function(){
    this._unbindAppKey();
    var addLaunchHotkeys = (i)=>{
      Main.keybindingManager.addHotKey('launch-app-key-' + i, '<Super>' + i, () => this._onAppKeyPress(i));
      Main.keybindingManager.addHotKey('launch-new-app-key-' + i, '<Super><Shift>' + i, () => this._onNewAppKeyPress(i));
    };

    for (let i = 1; i < 10; i++) {
      addLaunchHotkeys(i.toString());
    }
    Main.keybindingManager.addHotKey('launch-show-apps-order', this.showAppsOrderHotkey, ()=>this._showAppsOrder());
    Main.keybindingManager.addHotKey('launch-cycle-menus', this.cycleMenusHotkey, ()=>this._cycleMenus());
  },

  _unbindAppKey: function(){
    for (var i = 1; i < 10; i++) {
      let _i = i.toString();
      Main.keybindingManager.removeHotKey('launch-app-key-' + _i);
      Main.keybindingManager.removeHotKey('launch-new-app-key-' + _i);
    }
    Main.keybindingManager.removeHotKey('launch-show-apps-order');
    Main.keybindingManager.removeHotKey('launch-cycle-menus');
  },

  _onAppKeyPress: function(number){
    this.getCurrentAppList()._onAppKeyPress(number);
  },

  _onNewAppKeyPress: function(number){
    this.getCurrentAppList()._onNewAppKeyPress(number);
  },

  _showAppsOrder: function(){
    this.getCurrentAppList()._showAppsOrder();
  },

  _cycleMenus: function(){
    this.getCurrentAppList()._cycleMenus();
  },

  refreshCurrentAppList: function(){
    setTimeout(()=>{
      this.metaWorkspaces[this.currentWs].appList._refreshList();
    }, 15);
  },

  refreshAppFromCurrentListById: function(appId, opts){
    if (!opts) {
      opts = {favChange: false, favPos: null, isFavapp: false};
    }
    this.metaWorkspaces[this.currentWs].appList._refreshAppById(appId, opts);
  },

  refreshThumbnailsFromCurrentAppList: function(){
    this.metaWorkspaces[this.currentWs].appList._refreshAllThumbnails();
  },

  getAppFromWMClass: function(specialApps, metaWindow) {
    let startupClass = (wmclass)=> {
      let app_final = null;
      for (let i = 0, len = specialApps.length; i < len; i++) {
        if (specialApps[i].wmClass == wmclass) {
          app_final = this._appSystem.lookup_app(specialApps[i].id);
          if (!app_final) {
            app_final = this._appSystem.lookup_settings_app(specialApps[i].id);
          }
          app_final.wmClass = wmclass;
        }
      }
      return app_final;
    };
    let wmClassInstance = metaWindow.get_wm_class_instance();
    let app = startupClass(wmClassInstance);
    return app;
  },

  getCurrentAppList: function(){
    return this.metaWorkspaces[this.currentWs].appList;
  },

  onThemeChange: function(e){
    this.refreshCurrentAppList();
  },

  getAutostartApps: function(){
    var info;

    var getChildren = ()=>{
      var children = autostartDir.enumerate_children('standard::name,standard::type,time::modified', Gio.FileQueryInfoFlags.NONE, null);
      while ((info = children.next_file(null)) !== null) {
        if (info.get_file_type() === Gio.FileType.REGULAR) {
          var name = info.get_name();
          var file = Gio.file_new_for_path(this.autostartStrDir + '/' + name);
          this.autostartApps.push({id: name, file: file});
        }
      }
    };

    this.autostartStrDir = this.homeDir + '/.config/autostart';
    var autostartDir = Gio.file_new_for_path(this.autostartStrDir);

    if (autostartDir.query_exists(null)) {
      getChildren();
    } else {
      Util.trySpawnCommandLine('bash -c "mkdir ' + this.autostartStrDir + '"');
      setTimeout(()=>{
        getChildren();
      }, 50);
    }
  },

  removeAutostartApp: function(autostartIndex){
    _.pullAt(this.autostartApps, autostartIndex);
  },

  execInstallLanguage: function() {
    let moPath = this.homeDir + '/.local/share/cinnamon/applets/' + this._uuid + '/generate_mo.sh';
    let moFile = Gio.file_new_for_path(this.homeDir + '/.local/share/locale/de/LC_MESSAGES/IcingTaskManager@json.mo');
    if (!moFile.query_exists(null)) {
      Util.trySpawnCommandLine('bash -c "' + moPath + '"');
    }
  },

  handleDragOver: function (source, actor, x, y, time) {
    if (!(source.isDraggableApp || (source instanceof DND.LauncherDraggable))) {
      return DND.DragMotionResult.NO_DROP;
    }

    var children = this.metaWorkspaces[this.currentWs].appList.manager_container.get_children();
    var windowPos = children.indexOf(source.actor);

    var pos = 0;

    var isVertical = this.metaWorkspaces[this.currentWs].appList.manager_container.height > this.metaWorkspaces[this.currentWs].appList.manager_container.width;
    var axis = isVertical ? [y, 'y1'] : [x, 'x1'];
    each(children, (child, i)=>{
      if (axis[0] > children[i].get_allocation_box()[axis[1]] + children[i].width / 2) {
        pos = i;
      }
    });

    if (pos !== this._dragPlaceholderPos) {
      this._dragPlaceholderPos = pos;

      // Don't allow positioning before or after self
      if (windowPos !== -1 && pos === windowPos) {
        if (this._dragPlaceholder) {
          this._dragPlaceholder.animateOutAndDestroy();
          this._animatingPlaceholdersCount++;
          this._dragPlaceholder.actor.connect('destroy', Lang.bind(this, function () {
            this._animatingPlaceholdersCount--;
          }));
        }
        this._dragPlaceholder = null;

        return DND.DragMotionResult.CONTINUE;
      }

      // If the placeholder already exists, we just move
      // it, but if we are adding it, expand its size in
      // an animation
      var fadeIn;
      if (this._dragPlaceholder) {
        this._dragPlaceholder.actor.destroy();
        fadeIn = false;
      } else {
        fadeIn = true;
      }

      var childWidth;
      var childHeight;
      if (source.isDraggableApp) {
        childWidth = 30;
        childHeight = 24;
      } else {
        childWidth = source.actor.width;
        childHeight = source.actor.height;
      }
      this._dragPlaceholder = new DND.GenericDragPlaceholderItem();
      this._dragPlaceholder.child.width = childWidth;
      this._dragPlaceholder.child.height = childHeight;
      this.metaWorkspaces[this.currentWs].appList.manager_container.insert_child_at_index(this._dragPlaceholder.actor, this._dragPlaceholderPos);

      if (fadeIn) {
        this._dragPlaceholder.animateIn();
      }
    }

    return DND.DragMotionResult.MOVE_DROP;
  },

  acceptDrop: function (source, actor, x, y, time) {
    if (!(source.isDraggableApp || (source instanceof DND.LauncherDraggable))) {
      return false;
    }

    if (!(source.isFavapp || source.wasFavapp || source.isDraggableApp || (source instanceof DND.LauncherDraggable)) || source.isNotFavapp) {
      if (this._dragPlaceholderPos !== -1) {
        this.metaWorkspaces[this.currentWs].appList.manager_container.set_child_at_index(source.actor, this._dragPlaceholderPos);
      }
      this._clearDragPlaceholder();
    }
    this.metaWorkspaces[this.currentWs].appList.manager_container.set_child_at_index(source.actor, this._dragPlaceholderPos);

    var app = source.app;

    // Don't allow favoriting of transient apps
    if (!app || app.is_window_backed()) {
      return false;
    }

    var id = app.get_id();
    if (app.is_window_backed()) {
      id = app.get_name().toLowerCase() + '.desktop';
    }

    var favorites = this.pinnedAppsContr.getFavoriteMap();
    var refFav = _.findIndex(favorites, {id: id});
    var favPos = this._dragPlaceholderPos;

    if (favPos === -1) {
      var children = this.metaWorkspaces[this.currentWs].appList.manager_container.get_children();

      var pos = 0;

      for (let i = 0, len = children.length; i < len; i++) {
        if (x > children[i].get_allocation_box().x1 + children[i].width / 2) {
          pos = i;
        }
      }
      if (pos !== this._dragPlaceholderPos) {
        favPos = pos;
      }
    }
    this.metaWorkspaces[this.currentWs].appList.manager_container.set_child_at_index(source.actor, favPos);

    Meta.later_add(Meta.LaterType.BEFORE_REDRAW, Lang.bind(this, function () {
      if (refFav !== -1) {
        this.pinnedAppsContr.moveFavoriteToPos(id, favPos);
      } else if (this.pinOnDrag) {
        this.pinnedAppsContr._addFavorite({appId: id, app: app, pos: favPos});
      }
      return false;
    }));
    this._clearDragPlaceholder();
    return true;
  },

  _reloadApp: function () {
    Util.trySpawnCommandLine('bash -c "python ~/.local/share/cinnamon/applets/IcingTaskManager@json/utils.py reload"');
  },

  _clearDragPlaceholder: function () {
    if (this._dragPlaceholder) {
      this._dragPlaceholder.animateOutAndDestroy();
      this._dragPlaceholder = null;
      this._dragPlaceholderPos = -1;
    }
  },

  _makeDirectoy: function (fDir) {
    if (!this._isDirectory(fDir)) {
      this._makeDirectoy(fDir.get_parent());
    }
    if (!this._isDirectory(fDir)) {
      fDir.make_directory(null);
    }
  },

  _isDirectory: function (fDir) {
    try {
      let info = fDir.query_filesystem_info('standard::type', null);
      if ((info) && (info.get_file_type() != Gio.FileType.DIRECTORY)) {
        return true;
      }
    } catch(e) {}
    return false;
  },

  on_panel_edit_mode_changed: function () {
    this.actor.reactive = global.settings.get_boolean('panel-edit-mode');
  },

  pinned_app_contr: function () {
    let pinnedAppsContr = this.pinnedAppsContr;
    return pinnedAppsContr;
  },

  acceptNewLauncher: function (path) {
    this.pinnedAppsContr._addFavorite({appId: path, pos: -1});
  },

  removeLauncher: function (appGroup) {
    // Add code here to remove the launcher if you want.
  },

  recent_items_contr: function () {
    return this.recentItems;
  },

  recent_items_manager: function () {
    return this.recentManager;
  },

  sortRecentItems: function (items) {
    this.recentItems = items.sort(function (a, b) { return a.get_modified() - b.get_modified(); }).reverse();
    return this.recentItems;
  },

  _onWorkspaceCreatedOrDestroyed: function (i) {
    var workspaces = _.filter(global.screen.get_workspace_by_index(i), (ws, key)=>{
      return key in range(global.screen.n_workspaces);
    });

    // We'd like to know what workspaces in this.metaWorkspaces have been destroyed and
    // so are no longer in the workspaces list.  For each of those, we should destroy them

    for (let i = 0, len = this.metaWorkspaces.length; i < len; i++) {
      if (workspaces.indexOf(this.metaWorkspaces[i].ws) == -1) {
        this.metaWorkspaces[i].appList.destroy();
        _.pullAt(this.metaWorkspaces, i);
      }
    }
  },

  _onSwitchWorkspace: function () {
    this.currentWs = global.screen.get_active_workspace_index();
    let metaWorkspace = global.screen.get_workspace_by_index(this.currentWs);

    // If the workspace we switched to isn't in our list,
    // we need to create an AppList for it
    var refWorkspace = _.findIndex(this.metaWorkspaces, {index: this.currentWs});
    if (refWorkspace === -1) {
      var appList = new AppList(this, metaWorkspace);
      this.metaWorkspaces.push({
        ws: metaWorkspace,
        appList: appList,
        index: this.currentWs,
      });
    }

    // this.actor can only have one child, so setting the child
    // will automatically unparent anything that was previously there, which
    // is exactly what we want.
    var list = refWorkspace !== -1 ? this.metaWorkspaces[refWorkspace].appList : appList;
    this._box.set_child(list.actor);
    list._refreshList();
  },

  _onOverviewShow: function () {
    this.actor.hide();
  },

  _onOverviewHide: function () {
    this.actor.show();
  },

  destroy: function () {
    this._unbindAppKey();
    this.signals.disconnectAllSignals();
    global.settings.disconnect(this.panelEditId);
    for (let i = 0, len = this.metaWorkspaces.length; i < len; i++) {
      let children = this.metaWorkspaces[i].appList.manager_container.get_children();
      for (let z = 0, len = children.length; z < len; z++) {
        this.metaWorkspaces[i].appList.manager_container.remove_actor(children[z]);
        children[z].destroy();
      }
      this.metaWorkspaces[i].appList.destroy();
    }

    this.actor.remove_actor(this._box);
    this._box.destroy_children();
    this._box.destroy();

    this.actor.destroy();
    this.actor = null;
  }
};

function main(metadata, orientation, panel_height, instance_id) {
  return new MyApplet(metadata, orientation, panel_height, instance_id);
}