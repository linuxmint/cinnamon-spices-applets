'use strict';

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
/* jshint moz:true */
var Applet = imports.ui.applet;
var Lang = imports.lang;
var Cinnamon = imports.gi.Cinnamon;
var St = imports.gi.St;
var Main = imports.ui.main;
var Util = imports.misc.util;
var Signals = imports.signals;
var DND = imports.ui.dnd;
var Settings = imports.ui.settings;
var Gettext = imports.gettext;
var Gio = imports.gi.Gio;
var Gtk = imports.gi.Gtk;
var GLib = imports.gi.GLib;
var Meta = imports.gi.Meta;

var _ = imports.applet._;
var clog = imports.applet.clog;
var setTimeout = imports.applet.setTimeout;

var AppletDir = imports.ui.appletManager.applets['IcingTaskManager@json'];
var AppList = AppletDir.appList;

var TitleDisplay = {
  None: 1,
  App: 2,
  Title: 3,
  Focused: 4
};
var NumberDisplay = {
  Smart: 1,
  Normal: 2,
  None: 3,
  All: 4
};

// Some functional programming tools

var range = function range(a, b) {
  var ret = [];
  // if b is unset, we want a to be the upper bound on the range
  if (b === null || b === undefined) {
    var _ref = [0, a];
    a = _ref[0];
    b = _ref[1];
  }

  for (var i = a; i < b; i++) {
    ret.push(i);
  }
  return ret;
};

// Connects and keeps track of signal IDs so that signals
// can be easily disconnected

function SignalTracker() {
  this._init.apply(this, arguments);
}

SignalTracker.prototype = {
  _init: function _init() {
    this._data = [];
  },

  // params = {
  //              signalName: Signal Name
  //              callback: Callback Function
  //              bind: Context to bind to
  //              object: object to connect to
  // }
  connect: function connect(params) {
    var signalName = params.signalName;
    var callback = params.callback;
    var bind = params.bind;
    var object = params.object;
    var signalID = null;

    signalID = object.connect(signalName, Lang.bind(bind, callback));
    this._data.push({
      signalName: signalName,
      callback: callback,
      object: object,
      signalID: signalID,
      bind: bind
    });
  },

  disconnect: function disconnect(param) {},

  disconnectAll: function disconnectAll() {
    for (var i = this._data.length - 1; i >= 0; i--) {
      this._data[i];
      this._data[i].object.disconnect(this._data[i].signalID);
      for (var prop in this._data[i]) {
        this._data[i][prop] = null;
      }
    }
    this._data = [];
  }
};

function PinnedFavs() {
  this._init.apply(this, arguments);
}

/*



MyApplet._init -> PinnedFavs



*/

PinnedFavs.prototype = {
  _init: function _init(applet) {
    this._applet = applet;
    this.appSys = Cinnamon.AppSystem.get_default();
    this._favorites = [];
    this._reload();
  },

  _reload: function _reload() {
    var ids = this._applet.settings.getValue('pinned-apps');

    for (var i = 0, len = ids.length; i < len; i++) {
      var refFav = _.findIndex(this._favorites, { id: ids[i] });
      if (refFav === -1) {
        var app = this.appSys.lookup_app(ids[i]);
        this._favorites.push({
          id: ids[i],
          app: app
        });
      }
    }
  },

  _getIds: function _getIds() {
    return _.map(this._favorites, 'id');
  },

  getFavoriteMap: function getFavoriteMap() {
    return this._favorites;
  },

  getFavorites: function getFavorites() {
    return _.map(this._favorites, 'app');
  },

  isFavorite: function isFavorite(appId) {
    var refFav = _.findIndex(this._favorites, { id: appId });
    return refFav !== -1;
  },

  triggerUpdate: function triggerUpdate(appId) {
    var _this = this;

    var pos = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;
    var isFavapp = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;

    setTimeout(function () {
      _this._applet.refreshAppFromCurrentListById(appId, { favChange: true, favPos: pos, isFavapp: isFavapp });
    }, 15);
  },

  _addFavorite: function _addFavorite(appId, pos) {
    if (this.isFavorite(appId)) {
      return false;
    }

    var app = this.appSys.lookup_app(appId);
    if (!app) {
      app = this.appSys.lookup_settings_app(appId);
    }

    if (!app) {
      return false;
    }

    var newFav = {
      id: appId,
      app: app
    };

    this._favorites.push(newFav);

    if (pos !== -1) {
      this.moveFavoriteToPos(appId, pos);
      return;
    }

    this._applet.settings.setValue('pinned-apps', _.map(this._favorites, 'id'));
    this.triggerUpdate(appId, -1, true);
    return true;
  },

  moveFavoriteToPos: function moveFavoriteToPos(appId, pos) {
    var oldIndex = _.findIndex(this._favorites, { id: appId });
    if (oldIndex !== -1 && pos > oldIndex) {
      pos = pos - 1;
    }
    this._favorites.splice(pos, 0, this._favorites.splice(oldIndex, 1)[0]);
    this._applet.settings.setValue('pinned-apps', _.map(this._favorites, 'id'));
    this.triggerUpdate(appId, pos, true);
  },

  _removeFavorite: function _removeFavorite(appId) {
    var _this2 = this;

    var refFav = _.findIndex(this._favorites, { id: appId });
    if (refFav === -1) {
      return false;
    }

    _.pullAt(this._favorites, refFav);
    this._applet.settings.setValue('pinned-apps', _.map(this._favorites, 'id'));

    var refApp = _.findIndex(this._applet.metaWorkspaces[this._applet.currentWs].appList.appList, { id: appId });
    var hasOpenWindows = this._applet.metaWorkspaces[this._applet.currentWs].appList.appList[refApp].appGroup.app.get_windows().length > 0;

    if (hasOpenWindows) {
      this.triggerUpdate(appId, -1, false);
    } else {
      setTimeout(function () {
        _this2._applet.metaWorkspaces[_this2._applet.currentWs].appList.appList[refApp].appGroup.destroy();
        _.pullAt(_this2._applet.metaWorkspaces[_this2._applet.currentWs].appList.appList, refApp);
      }, 15);
    }
    return true;
  },

  removeFavorite: function removeFavorite(appId) {
    this._removeFavorite(appId);
  }
};
Signals.addSignalMethods(PinnedFavs.prototype);

function appFromWMClass(appsys, specialApps, metaWindow) {
  function startup_class(wmclass) {
    var app_final = null;
    for (var i = 0, len = specialApps.length; i < len; i++) {
      if (specialApps[i].wmClass == wmclass) {
        app_final = appsys.lookup_app(specialApps[i].id);
        if (!app_final) {
          app_final = appsys.lookup_settings_app(specialApps[i].id);
        }
        app_final.wmClass = wmclass;
      }
    }
    return app_final;
  }
  var wmClassInstance = metaWindow.get_wm_class_instance();
  var app = startup_class(wmClassInstance);
  return app;
}

function MyApplet(metadata, orientation, panel_height, instance_id) {
  this._init(metadata, orientation, panel_height, instance_id);
}

MyApplet.prototype = {
  __proto__: Applet.Applet.prototype,

  _init: function _init(metadata, orientation, panel_height, instance_id) {
    Applet.Applet.prototype._init.call(this, orientation, panel_height, instance_id);
    this.settings = new Settings.AppletSettings(this, 'IcingTaskManager@json', instance_id);
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

    try {
      this._uuid = metadata.uuid;
      this.execInstallLanguage();
      Gettext.bindtextdomain(this._uuid, GLib.get_home_dir() + '/.local/share/locale');

      var settingsProps = [{ key: 'show-pinned', value: 'showPinned', cb: null }, { key: 'show-alerts', value: 'showAlerts', cb: null }, { key: 'group-apps', value: 'groupApps', cb: this.refreshCurrentAppList }, { key: 'arrange-pinnedApps', value: 'arrangePinned', cb: null }, { key: 'pinned-apps', value: 'pinnedApps', cb: null }, { key: 'enable-hover-peek', value: 'enablePeek', cb: null }, { key: 'onclick-thumbnails', value: 'onclickThumbs', cb: null }, { key: 'hover-peek-opacity', value: 'peekOpacity', cb: null }, { key: 'thumbnail-timeout', value: 'thumbTimeout', cb: null }, { key: 'thumbnail-size', value: 'thumbSize', cb: null }, { key: 'sort-thumbnails', value: 'sortThumbs', cb: null }, { key: 'vertical-thumbnails', value: 'verticalThumbs', cb: null }, { key: 'stack-thumbnails', value: 'stackThumbs', cb: null }, { key: 'show-thumbnails', value: 'showThumbs', cb: null }, { key: 'close-button-style', value: 'thumbCloseBtnStyle', cb: this.refreshCurrentAppList }, { key: 'include-all-windows', value: 'includeAllWindows', cb: this.refreshCurrentAppList }, { key: 'number-display', value: 'numDisplay', cb: null }, { key: 'title-display', value: 'titleDisplay', cb: null }, { key: 'icon-spacing', value: 'iconSpacing', cb: null }, { key: 'icon-padding', value: 'iconPadding', cb: null }, { key: 'enable-iconSize', value: 'enableIconSize', cb: this.refreshCurrentAppList }, { key: 'icon-size', value: 'iconSize', cb: null }, { key: 'show-recent', value: 'showRecent', cb: this.refreshCurrentAppList }, { key: 'autostart-menu-item', value: 'autoStart', cb: this.refreshCurrentAppList }, { key: 'appmenu-width', value: 'appMenuWidth', cb: null }, { key: 'firefox-menu', value: 'firefoxMenu', cb: this.refreshCurrentAppList }, { key: 'appmenu-number', value: 'appMenuNum' }];

      if (this.c32) {
        for (var i = 0, len = settingsProps.length; i < len; i++) {
          this.settings.bind(settingsProps[i].key, settingsProps[i].value, settingsProps[i].cb);
        }
      } else {
        for (var _i = 0, _len = settingsProps.length; _i < _len; _i++) {
          var direction = settingsProps[_i].value === 'pinnedApps' ? 'BIDIRECTIONAL' : 'IN';
          this.settings.bindProperty(Settings.BindingDirection[direction], settingsProps[_i].key, settingsProps[_i].value, settingsProps[_i].cb, null);
        }
      }

      this._box = new St.Bin();

      this.actor.add(this._box);

      this.tracker = Cinnamon.WindowTracker.get_default();

      this.pinnedAppsContr = new PinnedFavs(this);

      this.recentManager = Gtk.RecentManager.get_default();
      this.sortRecentItems(this.recentManager.get_items());

      this.metaWorkspaces = [];

      this.autostartApps = [];

      // Boolean states
      this.forceRefreshList = false;

      Main.keybindingManager.addHotKey('move-app-to-next-monitor', '<Shift><Super>Right', Lang.bind(this, this._onMoveToNextMonitor));
      Main.keybindingManager.addHotKey('move-app-to-prev-monitor', '<Shift><Super>Left', Lang.bind(this, this._onMoveToPrevMonitor));

      // Use a signal tracker so we don't have to keep track of all these id's manually!

      this.signals = new SignalTracker();
      this.signals.connect({
        object: global.window_manager,
        signalName: 'switch-workspace',
        callback: this._onSwitchWorkspace,
        bind: this
      });
      this.signals.connect({
        object: global.screen,
        signalName: 'notify::n-workspaces',
        callback: this._onWorkspaceCreatedOrDestroyed,
        bind: this
      });
      this.signals.connect({
        object: Main.overview,
        signalName: 'showing',
        callback: this._onOverviewShow,
        bind: this
      });
      this.signals.connect({
        object: Main.overview,
        signalName: 'hiding',
        callback: this._onOverviewHide,
        bind: this
      });
      this.signals.connect({
        object: Main.expo,
        signalName: 'showing',
        callback: this._onOverviewShow,
        bind: this
      });
      this.signals.connect({
        object: Main.expo,
        signalName: 'hiding',
        callback: this._onOverviewHide,
        bind: this
      });

      this._dragPlaceholder = null;
      this._dragPlaceholderPos = -1;
      this._animatingPlaceholdersCount = 0;

      this.getAutostartApps();

      // Query apps for the current workspace
      this.currentWs = global.screen.get_active_workspace_index();
      this._onSwitchWorkspace();

      global.settings.connect('changed::panel-edit-mode', Lang.bind(this, this.on_panel_edit_mode_changed));
    } catch (e) {
      clog('Error', e.message);
    }
  },

  on_panel_height_changed: function on_panel_height_changed() {
    this.refreshCurrentAppList();
  },

  on_orientation_changed: function on_orientation_changed(orientation) {
    this.metaWorkspaces[this.currentWs].appList.on_orientation_changed(orientation);
  },

  refreshCurrentAppList: function refreshCurrentAppList() {
    var _this3 = this;

    setTimeout(function () {
      _this3.metaWorkspaces[_this3.currentWs].appList._refreshList();
    }, 15);
  },
  refreshAppFromCurrentListById: function refreshAppFromCurrentListById(appId) {
    var opts = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : { favChange: false, favPos: null, isFavapp: false };

    this.metaWorkspaces[this.currentWs].appList._refreshAppById(appId, opts);
  },
  getCurrentAppList: function getCurrentAppList() {
    return this.metaWorkspaces[this.currentWs].appList;
  },
  getAutostartApps: function getAutostartApps() {
    var _this4 = this;

    var info;

    var getChildren = function getChildren() {
      var children = autostartDir.enumerate_children('standard::name,standard::type,time::modified', Gio.FileQueryInfoFlags.NONE, null);
      while ((info = children.next_file(null)) !== null) {
        if (info.get_file_type() === Gio.FileType.REGULAR) {
          var name = info.get_name();
          var file = Gio.file_new_for_path(_this4.autostartStrDir + '/' + name);
          _this4.autostartApps.push({ id: name, file: file });
        }
      }
    };

    this.autostartStrDir = this.homeDir + '/.config/autostart';
    var autostartDir = Gio.file_new_for_path(this.autostartStrDir);

    if (autostartDir.query_exists(null)) {
      getChildren();
    } else {
      Util.trySpawnCommandLine('bash -c "mkdir ' + this.autostartStrDir + '"');
      setTimeout(function () {
        getChildren();
      }, 50);
    }
  },
  removeAutostartApp: function removeAutostartApp(autostartIndex) {
    _.pullAt(this.autostartApps, autostartIndex);
  },


  execInstallLanguage: function execInstallLanguage() {
    // TBD
    try {
      var _shareFolder = this.homeDir + '/.local/share/';
      var _localeFolder = Gio.file_new_for_path(_shareFolder + 'locale/');
      var _moFolder = Gio.file_new_for_path(_shareFolder + 'cinnamon/applets/' + this._uuid + '/locale/mo/');
      var children = _moFolder.enumerate_children('standard::name,standard::type,time::modified', Gio.FileQueryInfoFlags.NONE, null);
      var info = void 0,
          _moFile = void 0,
          _moLocale = void 0,
          _moPath = void 0,
          _src = void 0,
          _dest = void 0,
          _modified = void 0,
          _destModified = void 0;
      while ((info = children.next_file(null)) !== null) {
        _modified = info.get_modification_time().tv_sec;
        if (info.get_file_type() == Gio.FileType.REGULAR) {
          _moFile = info.get_name();
          if (_moFile.substring(_moFile.lastIndexOf('.')) == '.mo') {
            _moLocale = _moFile.substring(0, _moFile.lastIndexOf('.'));
            _moPath = _localeFolder.get_path() + '/' + _moLocale + '/LC_MESSAGES/';
            _src = Gio.file_new_for_path(String(_moFolder.get_path() + '/' + _moFile));
            _dest = Gio.file_new_for_path(String(_moPath + this._uuid + '.mo'));
            try {
              if (_dest.query_exists(null)) {
                _destModified = _dest.query_info('time::modified', Gio.FileQueryInfoFlags.NONE, null).get_modification_time().tv_sec;
                if (_modified > _destModified) {
                  _src.copy(_dest, Gio.FileCopyFlags.OVERWRITE, null, null);
                }
              } else {
                this._makeDirectoy(_dest.get_parent());
                _src.copy(_dest, Gio.FileCopyFlags.OVERWRITE, null, null);
              }
            } catch (e) {
              Main.notify('Error', e.message);
              global.logError(e);
            }
          }
        }
      }
    } catch (e) {}
  },

  handleDragOver: function handleDragOver(source, actor, x, y, time) {
    if (!(source.isDraggableApp || source instanceof DND.LauncherDraggable)) {
      return DND.DragMotionResult.NO_DROP;
    }

    var children = this.metaWorkspaces[this.currentWs].appList.manager_container.get_children();
    var windowPos = children.indexOf(source.actor);

    var pos = 0;

    var isVertical = this.metaWorkspaces[this.currentWs].appList.manager_container.height > this.metaWorkspaces[this.currentWs].appList.manager_container.width;
    var axis = isVertical ? [y, 'y1'] : [x, 'x1'];
    for (var i in children) {
      if (axis[0] > children[i].get_allocation_box()[axis[1]] + children[i].width / 2) {
        pos = i;
      }
    }

    if (pos != this._dragPlaceholderPos) {
      this._dragPlaceholderPos = pos;

      // Don't allow positioning before or after self
      if (windowPos != -1 && pos == windowPos) {
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

  acceptDrop: function acceptDrop(source, actor, x, y, time) {
    if (!(source.isDraggableApp || source instanceof DND.LauncherDraggable)) {
      return false;
    }

    if (!(source.isFavapp || source.wasFavapp || source.isDraggableApp || source instanceof DND.LauncherDraggable) || source.isNotFavapp) {
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
    var refFav = _.findIndex(favorites, { id: id });
    var favPos = this._dragPlaceholderPos;

    if (favPos === -1) {
      var children = this.metaWorkspaces[this.currentWs].appList.manager_container.get_children();

      var pos = 0;

      for (var i = 0, len = children.length; i < len; i++) {
        if (x > children[i].get_allocation_box().x1 + children[i].width / 2) {
          pos = i;
        }
      }
      if (pos != this._dragPlaceholderPos) {
        favPos = pos;
      }
    }
    this.metaWorkspaces[this.currentWs].appList.manager_container.set_child_at_index(source.actor, favPos);

    Meta.later_add(Meta.LaterType.BEFORE_REDRAW, Lang.bind(this, function () {
      if (refFav !== -1) {
        this.pinnedAppsContr.moveFavoriteToPos(id, favPos);
      } else {
        this.pinnedAppsContr._addFavorite(id, favPos);
      }
      return false;
    }));
    this._clearDragPlaceholder();
    return true;
  },

  _reloadApp: function _reloadApp() {
    Util.trySpawnCommandLine('bash -c "python ~/.local/share/cinnamon/applets/IcingTaskManager@json/utils.py reload"');
  },

  _clearDragPlaceholder: function _clearDragPlaceholder() {
    if (this._dragPlaceholder) {
      this._dragPlaceholder.animateOutAndDestroy();
      this._dragPlaceholder = null;
      this._dragPlaceholderPos = -1;
    }
  },

  _makeDirectoy: function _makeDirectoy(fDir) {
    if (!this._isDirectory(fDir)) {
      this._makeDirectoy(fDir.get_parent());
    }
    if (!this._isDirectory(fDir)) {
      fDir.make_directory(null);
    }
  },

  _isDirectory: function _isDirectory(fDir) {
    try {
      var info = fDir.query_filesystem_info('standard::type', null);
      if (info && info.get_file_type() != Gio.FileType.DIRECTORY) {
        return true;
      }
    } catch (e) {}
    return false;
  },

  on_panel_edit_mode_changed: function on_panel_edit_mode_changed() {
    this.actor.reactive = global.settings.get_boolean('panel-edit-mode');
  },

  pinned_app_contr: function pinned_app_contr() {
    var pinnedAppsContr = this.pinnedAppsContr;
    return pinnedAppsContr;
  },

  acceptNewLauncher: function acceptNewLauncher(path) {
    this.pinnedAppsContr._addFavorite(path, -1);
  },

  removeLauncher: function removeLauncher(appGroup) {
    // Add code here to remove the launcher if you want.
  },

  recent_items_contr: function recent_items_contr() {
    return this.recentItems;
  },

  recent_items_manager: function recent_items_manager() {
    return this.recentManager;
  },

  sortRecentItems: function sortRecentItems(items) {
    this.recentItems = items.sort(function (a, b) {
      return a.get_modified() - b.get_modified();
    }).reverse();
    return this.recentItems;
  },

  _onWorkspaceCreatedOrDestroyed: function _onWorkspaceCreatedOrDestroyed(i) {
    var workspaces = _.filter(global.screen.get_workspace_by_index(i), function (ws, key) {
      return key in range(global.screen.n_workspaces);
    });

    // We'd like to know what workspaces in this.metaWorkspaces have been destroyed and
    // so are no longer in the workspaces list.  For each of those, we should destroy them

    for (var _i2 = 0, len = this.metaWorkspaces.length; _i2 < len; _i2++) {
      if (workspaces.indexOf(this.metaWorkspaces[_i2].ws) == -1) {
        this.metaWorkspaces[_i2].appList.destroy();
        _.pullAt(this.metaWorkspaces, _i2);
      }
    }
  },

  _onSwitchWorkspace: function _onSwitchWorkspace() {
    this.currentWs = global.screen.get_active_workspace_index();
    var metaWorkspace = global.screen.get_workspace_by_index(this.currentWs);

    // If the workspace we switched to isn't in our list,
    // we need to create an AppList for it
    var refWorkspace = _.findIndex(this.metaWorkspaces, { index: this.currentWs });
    if (refWorkspace === -1) {
      var appList = new AppList.AppList(this, metaWorkspace);
      this.metaWorkspaces.push({
        ws: metaWorkspace,
        appList: appList,
        index: this.currentWs
      });
    }

    // this.actor can only have one child, so setting the child
    // will automatically unparent anything that was previously there, which
    // is exactly what we want.
    var list = refWorkspace !== -1 ? this.metaWorkspaces[refWorkspace].appList : appList;
    this._box.set_child(list.actor);
    list._refreshList();
  },

  _onOverviewShow: function _onOverviewShow() {
    this.actor.hide();
  },

  _onOverviewHide: function _onOverviewHide() {
    this.actor.show();
  },

  _onMoveToNextMonitor: function _onMoveToNextMonitor() {
    this._onMoveToMonitor(1);
  },

  _onMoveToPrevMonitor: function _onMoveToPrevMonitor() {
    this._onMoveToMonitor(-1);
  },

  _onMoveToMonitor: function _onMoveToMonitor(modifier) {
    // Skip when we don't have multiple monitor.
    var monitors = Main.layoutManager.monitors;
    if (monitors.length <= 1) {
      return;
    }
    // Find the window to move.
    var metaWorkspace = global.screen.get_active_workspace();
    var metaWindow = null;
    var windows = metaWorkspace.list_windows();
    for (var i = 0, len = windows.length; i < len; i++) {
      if (windows[i].has_focus()) {
        metaWindow = windows[i];
        break;
      }
    }
    // Find the new monitor index.
    var monitorIndex = metaWindow.get_monitor();
    monitorIndex += modifier;
    if (monitorIndex < 0) {
      monitorIndex = monitors.length - 1;
    } else if (monitorIndex > monitors.length - 1) {
      monitorIndex = 0;
    }
    try {
      metaWindow.move_to_monitor(monitorIndex);
    } catch (e) {}
  },

  destroy: function destroy() {
    this.signals.disconnectAll();
    this.actor.destroy();
    this.actor = null;
  }
};

function main(metadata, orientation, panel_height, instance_id) {
  var myApplet = new MyApplet(metadata, orientation, panel_height, instance_id);
  return myApplet;
}