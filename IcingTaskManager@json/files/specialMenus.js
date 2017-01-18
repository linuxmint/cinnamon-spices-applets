'use strict';

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

/* jshint moz:true */
var Clutter = imports.gi.Clutter;
var AppletManager = imports.ui.appletManager;
var Lang = imports.lang;
var Main = imports.ui.main;
var Mainloop = imports.mainloop;
var Params = imports.misc.params;
var PopupMenu = imports.ui.popupMenu;
var Meta = imports.gi.Meta;
var Util = imports.misc.util;
var St = imports.gi.St;
var Gio = imports.gi.Gio;
var Gettext = imports.gettext;
var Tweener = imports.ui.tweener;
var Applet = imports.ui.applet;
var clog = imports.applet.clog;
var setTimeout = imports.applet.setTimeout;

var AppletDir = AppletManager.applets['IcingTaskManager@json'];
var _ = AppletDir.lodash._;
var FireFox = AppletDir.firefox;

var THUMBNAIL_ICON_SIZE = 16;
var OPACITY_OPAQUE = 255;

var FavType = {
  favorites: 0,
  pinnedApps: 1,
  none: 2
};

var ffOptions = [{ id: 1, label: 'Most Visited' }, { id: 2, label: 'Recent History' }, { id: 3, label: 'Bookmarks' }];

var menuItemTypeOptions = [{ id: 1, label: 'SYMBOLIC' }, { id: 2, label: 'FULLCOLOR' }, { id: 3, label: null }];

function t(str) {
  var resultConf = Gettext.dgettext('IcingTaskManager@json', str);
  if (resultConf != str) {
    return resultConf;
  }
  return Gettext.gettext(str);
}

function AppMenuButtonRightClickMenu() {
  this._init.apply(this, arguments);
}

AppMenuButtonRightClickMenu.prototype = {
  __proto__: Applet.AppletPopupMenu.prototype,

  _init: function _init(launcher, metaWindow, metaWindows, orientation) {
    Applet.AppletPopupMenu.prototype._init.call(this, launcher, orientation);

    this._applet = launcher._applet;
    this._launcher = launcher;
    this.connect('open-state-changed', Lang.bind(this, this._onToggled));

    this.app = launcher.app;
    this.appId = launcher.appId;
    this.appInfo = this.app.get_app_info();
    this.isFavapp = launcher.isFavapp;
    this.orientation = orientation;
    this.isFavapp = launcher.isFavapp;
    this.favs = this._applet.pinned_app_contr();
    this.metaWindow = metaWindow;
    this.metaWindows = metaWindows;
    this.autostartIndex = launcher.autostartIndex;
    this.actor.style = 'width: 500px;';
  },

  setMetaWindow: function setMetaWindow(metaWindow, metaWindows) {
    // Last focused
    this.metaWindow = metaWindow;

    // Window list from appGroup
    this.metaWindows = metaWindows;
  },

  _populateMenu: function _populateMenu() {
    var _this = this;

    if (!this.metaWindow) {
      this.metaWindow = this._launcher._getLastFocusedWindow();
    }

    var mw = this.metaWindow;
    var item;
    var length;
    var hasWindows = this.metaWindows.length > 0;

    var createMenuItem = function createMenuItem() {
      var opts = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : { label: '', icon: null };

      if (_this._applet.menuItemType < 3 && opts.icon) {
        var refMenuType = _.find(menuItemTypeOptions, { id: _this._applet.menuItemType });
        return new PopupMenu.PopupIconMenuItem(t(opts.label), opts.icon, St.IconType[refMenuType.label]);
      } else {
        return new PopupMenu.PopupMenuItem(t(opts.label));
      }
    };

    if (hasWindows) {

      /*
        Monitors
      */

      if (Main.layoutManager.monitors.length > 1) {
        var connectMonitorEvent = function connectMonitorEvent(item, mw, i) {
          item.connect('activate', function () {
            if (_this._applet.monitorMoveAllWindows) {
              for (var z = 0, len = _this.metaWindows.length; z < len; z++) {
                var focused = 0;
                _this.metaWindows[z].win.move_to_monitor(i);
                if (_this.metaWindows[z].win.has_focus()) {
                  ++focused;
                }
                if (z === len - 1 && focused === 0) {
                  _this.app.activate(_this.metaWindows[z].win, global.get_current_time());
                }
              }
            } else {
              mw.move_to_monitor(i);
              _this.app.activate(mw, global.get_current_time());
            }
          });
        };
        for (var i = 0, len = Main.layoutManager.monitors.length; i < len; i++) {
          if (i === mw.get_monitor()) {
            continue;
          }
          item = createMenuItem({ label: Main.layoutManager.monitors.length === 2 ? 'Move to the other monitor' : 'Move to monitor ' + (i + 1) });
          connectMonitorEvent(item, mw, i);
          this.addMenuItem(item);
        }
      }

      /*
        Workspace
      */

      if ((length = global.screen.n_workspaces) > 1) {
        if (mw.is_on_all_workspaces()) {
          item = createMenuItem({ label: 'Only on this workspace' });
          item.connect('activate', function () {
            mw.unstick();
          });
          this.addMenuItem(item);
        } else {
          item = createMenuItem({ label: 'Visible on all workspaces' });
          item.connect('activate', function () {
            mw.stick();
          });
          this.addMenuItem(item);

          item = new PopupMenu.PopupSubMenuMenuItem(t('Move to another workspace'));
          this.addMenuItem(item);

          var connectWorkspaceEvent = function connectWorkspaceEvent(ws, j) {
            ws.connect('activate', function () {
              mw.change_workspace(global.screen.get_workspace_by_index(j));
            });
          };
          for (var _i = 0; _i < length; _i++) {
            // Make the index a local variable to pass to function
            var j = _i;
            var name = Main.workspace_names[_i] ? Main.workspace_names[_i] : Main._makeDefaultWorkspaceName(_i);
            var ws = createMenuItem({ label: name });

            if (_i === this._launcher._applet.currentWs) {
              ws.setSensitive(false);
            }

            connectWorkspaceEvent(ws, j);
            item.menu.addMenuItem(ws);
          }
        }
      }

      this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
    }

    this.recentMenuItems = [];
    if (this._applet.showRecent) {

      /*
        Places
      */

      if (this.appId === 'nemo.desktop' || this.appId === 'nemo-home.desktop') {
        var _subMenu = new PopupMenu.PopupSubMenuMenuItem(t('Places'));
        this.addMenuItem(_subMenu);

        var defualtPlaces = this._listDefaultPlaces();
        var bookmarks = this._listBookmarks();
        var devices = this._listDevices();
        var places = defualtPlaces.concat(bookmarks).concat(devices);
        var handlePlaceLaunch = function handlePlaceLaunch(item, i) {
          return item.connect('activate', function () {
            return places[i].launch();
          });
        };
        for (var _i2 = 0, _len = places.length; _i2 < _len; _i2++) {
          item = createMenuItem({ label: places[_i2].name, icon: 'folder' });
          handlePlaceLaunch(item, _i2);
          this.recentMenuItems.push(item);
          _subMenu.menu.addMenuItem(item);
        }
        this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
      }

      /*
        History
      */

      if (this.appId === 'firefox.desktop' || this.appId === 'firefox web browser.desktop') {
        var _subMenu2 = new PopupMenu.PopupSubMenuMenuItem(t(_.find(ffOptions, { id: this._applet.firefoxMenu }).label));
        this.addMenuItem(_subMenu2);

        var histories = FireFox.getFirefoxHistory(this._applet);
        if (histories) {
          try {
            var handleHistoryLaunch = function handleHistoryLaunch(item, i) {
              return item.connect('activate', function () {
                return Gio.app_info_launch_default_for_uri(histories[i].uri, global.create_app_launch_context());
              });
            };
            for (var _i3 = 0, _len2 = histories.length; _i3 < _len2; _i3++) {
              item = createMenuItem({ label: histories[_i3].title, icon: 'go-next' });
              handleHistoryLaunch(item, _i3);
              this.recentMenuItems.push(item);
              _subMenu2.menu.addMenuItem(item);
            }
          } catch (e) {}
        }
        this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
      }

      /*
        Recent Files
      */

      var recentItems = this._applet.recentItems;
      var items = [];

      for (var _i4 = 0, _len3 = recentItems.length; _i4 < _len3; _i4++) {
        var mimeType = recentItems[_i4].get_mime_type();
        var appInfo = Gio.app_info_get_default_for_type(mimeType, false);
        if (appInfo && this.appInfo && appInfo.get_id() === this.appId) {
          items.push(recentItems[_i4]);
        }
      }
      var itemsLength = items.length;

      if (itemsLength > 0) {
        var _subMenu3 = new PopupMenu.PopupSubMenuMenuItem(t('Recent'));
        this.addMenuItem(_subMenu3);
        var num = this._applet.appMenuNum > 10 ? 10 : this._applet.appMenuNum;
        if (itemsLength > num) {
          itemsLength = num;
        }
        var handleRecentLaunch = function handleRecentLaunch(item, i) {
          return item.connect('activate', function () {
            return Gio.app_info_launch_default_for_uri(items[i].get_uri(), global.create_app_launch_context());
          });
        };
        for (var _i5 = 0; _i5 < itemsLength; _i5++) {
          item = createMenuItem({ label: items[_i5].get_short_name(), icon: 'list-add' });
          handleRecentLaunch(item, _i5);
          this.recentMenuItems.push(item);
          _subMenu3.menu.addMenuItem(item);
        }
        this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
      }
    }

    /*
      Preferences
    */

    var subMenu = new PopupMenu.PopupSubMenuMenuItem(t('Preferences'));
    this.addMenuItem(subMenu);

    item = createMenuItem({ label: 'About...', icon: 'dialog-question' });
    item.connect('activate', Lang.bind(this._applet, this._applet.openAbout));
    subMenu.menu.addMenuItem(item);

    item = createMenuItem({ label: 'Configure...', icon: 'system-run' });
    item.connect('activate', Lang.bind(this._applet, this._applet.configureApplet));
    subMenu.menu.addMenuItem(item);

    item = createMenuItem({ label: 'Remove \'Icing Task Manager\'', icon: 'edit-delete' });
    item.connect('activate', Lang.bind(this, function () {
      AppletManager._removeAppletFromPanel(this._applet._uuid, this._applet.instance_id);
    }));
    subMenu.menu.addMenuItem(item);

    /*
      Actions
    */

    var actions = null;
    try {
      actions = this.appInfo.list_actions();
      if (this.appInfo && actions) {
        this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        var handleAction = function handleAction(action) {
          item = createMenuItem({ label: _this.appInfo.get_action_name(action), icon: 'document-new' });
          item.connect('activate', function () {
            return _this.appInfo.launch_action(action, global.create_app_launch_context());
          });
          _this.recentMenuItems.push(item);
        };

        for (var _i6 = 0, _len4 = actions.length; _i6 < _len4; _i6++) {
          handleAction(actions[_i6]);
          this.addMenuItem(item);
        }
        this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
      }
    } catch (e) {
      if (this.app.is_window_backed()) {
        this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
      }
    }

    /*
      Pin/unpin, shortcut handling
    */

    if (!this.app.is_window_backed()) {
      if (this._applet.showPinned !== FavType.none && !this.app.is_window_backed()) {
        if (this.isFavapp) {
          item = createMenuItem({ label: 'Unpin from Panel', icon: 'list-remove' });
          item.connect('activate', Lang.bind(this, this._toggleFav));
        } else {
          item = createMenuItem({ label: 'Pin to Panel', icon: 'bookmark-new' });
          item.connect('activate', Lang.bind(this, this._toggleFav));
        }
        this.addMenuItem(item);
      }
      if (this._applet.autoStart) {
        if (this.autostartIndex !== -1) {
          item = createMenuItem({ label: 'Remove from Autostart', icon: 'process-stop' });
          item.connect('activate', Lang.bind(this, this._toggleAutostart));
        } else {
          item = createMenuItem({ label: 'Add to Autostart', icon: 'insert-object' });
          item.connect('activate', Lang.bind(this, this._toggleAutostart));
        }
        this.addMenuItem(item);
      }
    } else {
      item = createMenuItem({ label: 'Create Shortcut', icon: 'list-add' });
      item.connect('activate', Lang.bind(this, this._createShortcut));
      this.addMenuItem(item);
    }
    this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

    /*
      Window controls
    */

    if (hasWindows) {
      /*
        Miscellaneous
      */

      if (mw.get_compositor_private().opacity != 255) {
        item = createMenuItem({ label: 'Restore to full opacity' });
        item.connect('activate', function () {
          mw.get_compositor_private().set_opacity(255);
        });
        this.addMenuItem(item);
      }

      if (mw.minimized) {
        item = createMenuItem({ label: 'Restore', icon: 'view-sort-descending' });
        item.connect('activate', function () {
          Main.activateWindow(mw, global.get_current_time());
        });
      } else {
        item = createMenuItem({ label: 'Minimize', icon: 'view-sort-ascending' });
        item.connect('activate', function () {
          mw.minimize(global.get_current_time());
        });
      }
      this.addMenuItem(item);

      if (mw.get_maximized()) {
        item = createMenuItem({ label: 'Unmaximize', icon: 'view-restore' });
        item.connect('activate', function () {
          mw.unmaximize(Meta.MaximizeFlags.HORIZONTAL | Meta.MaximizeFlags.VERTICAL);
        });
      } else {
        item = createMenuItem({ label: 'Maximize', icon: 'view-fullscreen' });
        item.connect('activate', function () {
          mw.maximize(Meta.MaximizeFlags.HORIZONTAL | Meta.MaximizeFlags.VERTICAL);
        });
      }
      this.addMenuItem(item);

      if (this.metaWindows.length > 1) {
        /*
          Close others
        */
        item = createMenuItem({ label: 'Close others', icon: 'window-close' });
        item.connect('activate', Lang.bind(this, function () {
          _.each(this.metaWindows, function (metaWindow) {
            if (!_.isEqual(metaWindow.win, mw) && !metaWindow.win._needsAttention) {
              metaWindow.win.delete(global.get_current_time);
            }
          });
        }));
        this.addMenuItem(item);
        /*
          Close all
        */
        item = createMenuItem({ label: 'Close all', icon: 'application-exit' });
        item.connect('activate', Lang.bind(this, function () {
          _.each(this.metaWindows, function (metaWindow) {
            if (!metaWindow.win._needsAttention) {
              metaWindow.win.delete(global.get_current_time);
            }
          });
        }));
        this.addMenuItem(item);
        this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
      } else {
        item = createMenuItem({ label: 'Close', icon: 'edit-delete' });
        item.connect('activate', function () {
          mw.delete(global.get_current_time());
        });
        this.addMenuItem(item);
        this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
      }
    }
  },

  _onToggled: function _onToggled(actor, isOpening) {
    if (this.isOpen) {
      this._applet._menuOpen = true;
    } else {
      this._applet._menuOpen = false;
    }

    if (!isOpening) {
      return;
    }
    this.removeAll();
    this._populateMenu();
  },

  _toggleAutostart: function _toggleAutostart() {
    var _this2 = this;

    if (this.autostartIndex !== -1) {
      this._applet.autostartApps[this.autostartIndex].file.delete(null);
      this._applet.removeAutostartApp(this.autostartIndex);
      this.autostartIndex = -1;
    } else {
      var filePath = this.appInfo.get_filename();
      Util.trySpawnCommandLine('bash -c \'cp ' + filePath + ' ' + this._applet.autostartStrDir + '\'');
      setTimeout(function () {
        _this2._applet.getAutostartApps();
        _this2.autostartIndex = _this2._applet.autostartApps.length - 1;
      }, 500);
    }
  },


  _toggleFav: function _toggleFav(actor, event) {
    if (this.isFavapp) {
      this.favs.removeFavorite(this.appId);
    } else {
      if (!this.app.is_window_backed()) {
        this.favs._addFavorite({ appId: this.appId, app: this.app, pos: -1 });
      }
    }
  },

  _createShortcut: function _createShortcut(actor, event) {
    var proc = this.app.get_windows()[0].get_pid();
    var cmd = 'bash -c \'python ~/.local/share/cinnamon/applets/IcingTaskManager@json/utils.py get_process ' + proc.toString() + '\'';
    Util.trySpawnCommandLine(cmd);
  },

  _listDefaultPlaces: function _listDefaultPlaces(pattern) {
    var defaultPlaces = Main.placesManager.getDefaultPlaces();
    var res = [];
    for (var i = 0, len = defaultPlaces.length; i < len; i++) {
      if (!pattern || defaultPlaces[i].name.toLowerCase().indexOf(pattern) != -1) {
        res.push(defaultPlaces[i]);
      }
    }
    return res;
  },

  _listBookmarks: function _listBookmarks(pattern) {
    var bookmarks = Main.placesManager.getBookmarks();
    var res = [];
    for (var i = 0, len = bookmarks.length; i < len; i++) {
      if (!pattern || bookmarks[i].name.toLowerCase().indexOf(pattern) != -1) {
        res.push(bookmarks[i]);
      }
    }
    return res;
  },

  _listDevices: function _listDevices(pattern) {
    var devices = Main.placesManager.getMounts();
    var res = [];
    for (var i = 0, len = devices.length; i < len; i++) {
      if (!pattern || devices[i].name.toLowerCase().indexOf(pattern) != -1) {
        res.push(devices[i]);
      }
    }
    return res;
  }
};

function HoverMenuController(owner) {
  this._init(owner);
}

HoverMenuController.prototype = {
  __proto__: PopupMenu.PopupMenuManager.prototype,

  _onEventCapture: function _onEventCapture(actor, event) {
    return false;
  }
};

function AppThumbnailHoverMenu() {
  this._init.apply(this, arguments);
}

AppThumbnailHoverMenu.prototype = {
  __proto__: PopupMenu.PopupMenu.prototype,

  _init: function _init(parent) {
    var _this3 = this;

    this._applet = parent._applet;
    if (parent._applet.c32) {
      PopupMenu.PopupMenu.prototype._init.call(this, parent.actor, parent.orientation, 0.5);
    } else {
      PopupMenu.PopupMenu.prototype._init.call(this, parent.actor, 0.5, parent.orientation);
    }
    this.signals = {
      parentActor: [],
      actor: []
    };

    this.metaWindow = parent.metaWindow;
    this.metaWindows = [];

    this.app = parent.app;
    this.isFavapp = parent.isFavapp;
    this.appList = parent.appList;

    // need to implement this class or cinnamon outputs a bunch of errors // TBD
    this.actor.style_class = 'hide-arrow';

    this.box.style_class = 'thumbnail-popup-content';

    this.actor.hide();
    this.parentActor = parent.actor;

    Main.layoutManager.addChrome(this.actor, this.orientation);

    this.appSwitcherItem = new PopupMenuAppSwitcherItem(this);
    this.addMenuItem(this.appSwitcherItem);

    this.signals.parentActor.push(this.parentActor.connect('enter-event', Lang.bind(this, this._onMenuEnter)));
    this.signals.parentActor.push(this.parentActor.connect('leave-event', Lang.bind(this, this._onMenuLeave)));
    this.signals.parentActor.push(this.parentActor.connect('button-release-event', Lang.bind(this, this._onButtonPress)));

    this.signals.actor.push(this.actor.connect('enter-event', Lang.bind(this, this._onMenuEnter)));
    this.signals.actor.push(this.actor.connect('leave-event', Lang.bind(this, this._onMenuLeave)));
    this.signals.actor.push(this.actor.connect('key-release-event', function (actor, e) {
      return _this3._onKeyRelease(actor, e);
    }));
  },

  _onButtonPress: function _onButtonPress(actor, event) {
    var _this4 = this;

    if (this._applet.onClickThumbs && this.appSwitcherItem.appContainer.get_children().length > 1) {
      return;
    }
    this.shouldClose = true;
    setTimeout(function () {
      return _this4.hoverClose();
    }, this._applet.thumbTimeout);
  },

  _onMenuEnter: function _onMenuEnter() {
    var _this5 = this;

    this.shouldClose = false;
    setTimeout(function () {
      return _this5.hoverOpen();
    }, this._applet.thumbTimeout);
  },

  _onMenuLeave: function _onMenuLeave() {
    var _this6 = this;

    this.shouldClose = true;
    setTimeout(function () {
      return _this6.hoverClose();
    }, this._applet.thumbTimeout);
  },

  _onKeyRelease: function _onKeyRelease(actor, event) {
    var symbol = event.get_key_symbol();
    if (this.isOpen && (symbol === Clutter.KEY_Super_L || symbol === Clutter.KEY_Super_R)) {
      // close this menu, if opened by super+#
      this.close();
      this.appList.lastCycled = null;
      return true;
    }
  },

  hoverOpen: function hoverOpen() {
    if (!this.isOpen && !this._applet.onClickThumbs) {
      this.open();
    }
  },

  hoverClose: function hoverClose() {
    if (this.shouldClose) {
      this.close();
    }
  },

  open: function open() {
    var _this7 = this;

    // Refresh all the thumbnails, etc when the menu opens.  These cannot
    // be created when the menu is initalized because a lot of the clutter window surfaces
    // have not been created yet...
    setTimeout(function () {
      return _this7.appSwitcherItem._refresh();
    }, 0);
    PopupMenu.PopupMenu.prototype.open.call(this, this._applet.animateThumbs);
  },

  close: function close() {
    PopupMenu.PopupMenu.prototype.close.call(this, this._applet.animateThumbs);
  },

  destroy: function destroy() {
    var _this8 = this;

    var children = this._getMenuItems();
    for (var i = 0; i < children.length; i++) {
      var item = children[i];
      this.box.remove_actor(item.actor);
      item.actor.destroy();
    }
    _.each(this.signals, function (signal, key) {
      _.each(signal, function (id) {
        if (_this8[key] && id) {
          _this8[key].disconnect(id);
        }
      });
    });
    this.appSwitcherItem.destroy();
    this.box.destroy();
    this.actor.destroy();
    PopupMenu.PopupMenu.prototype.destroy.call(this);
  },

  setMetaWindow: function setMetaWindow(metaWindow, metaWindows) {
    // Last focused
    this.metaWindow = metaWindow;
    this.metaWindows = metaWindows;
    this.appSwitcherItem.setMetaWindow(metaWindow, metaWindows);
  }
};

// display a list of app thumbnails and allow
// bringing any app to focus by clicking on its thumbnail

function PopupMenuAppSwitcherItem() {
  this._init.apply(this, arguments);
}

PopupMenuAppSwitcherItem.prototype = {
  __proto__: PopupMenu.PopupBaseMenuItem.prototype,

  _init: function _init(parent, params) {
    var _this9 = this;

    params = Params.parse(params, {
      hover: false,
      activate: false
    });
    PopupMenu.PopupBaseMenuItem.prototype._init.call(this, params);

    this._applet = parent._applet;
    this.settings = parent._applet.settings;
    this.signals = {
      settings: []
    };
    this.metaWindow = parent.metaWindow;
    this.metaWindows = [];
    this.app = parent.app;
    this.isFavapp = parent.isFavapp;
    this.actor.style_class = '';
    this._parent = parent;

    this.box = new St.BoxLayout();

    this.appContainer = new St.BoxLayout({
      style_class: 'switcher-list'
    });

    this.appContainer.add_style_class_name('thumbnail-row');

    this.appThumbnails = [];

    this.signals.settings.push(this.settings.connect('changed::vertical-thumbnails', Lang.bind(this, this._setVerticalSetting)));
    this._setVerticalSetting();
    this.addActor(this.box);

    this.actor.connect('key-press-event', function (actor, e) {
      return _this9._onKeyPress(actor, e);
    });
  },

  _onKeyPress: function _onKeyPress(actor, e) {
    var symbol = e.get_key_symbol();
    var i = _.findIndex(this.appThumbnails, function (thumb) {
      return thumb.thumbnail.entered;
    });

    var entered = i > -1;
    if (entered) {
      this.appThumbnails[i].thumbnail.handleLeaveEvent();
    } else {
      i = _.findIndex(this.appThumbnails, function (thumb) {
        return thumb.thumbnail._hasFocus();
      });
      if (i === -1) {
        i = 0;
      }
    }
    var args = this._applet.verticalThumbs ? [Clutter.KEY_Up, Clutter.KEY_Down] : [Clutter.KEY_Left, Clutter.KEY_Right];
    var closeArg = void 0;
    if (this._applet.orientation == St.Side.TOP) {
      closeArg = Clutter.KEY_Up;
    } else if (this._applet.orientation == St.Side.BOTTOM) {
      closeArg = Clutter.KEY_Down;
    } else if (this._applet.orientation == St.Side.LEFT) {
      closeArg = Clutter.KEY_Left;
    } else if (this._applet.orientation == St.Side.RIGHT) {
      closeArg = Clutter.KEY_Right;
    }
    var index;
    if (symbol === args[0]) {
      if (!entered) {
        index = i;
      } else if (this.appThumbnails[i + 1] !== undefined) {
        index = i + 1;
      } else {
        index = 0;
      }
    } else if (symbol === args[1]) {
      if (!entered) {
        index = i;
      } else if (this.appThumbnails[i - 1] !== undefined) {
        index = i - 1;
      } else {
        index = this.appThumbnails.length - 1;
      }
    } else if (symbol === Clutter.KEY_Return && entered) {
      Main.activateWindow(this.appThumbnails[i].metaWindow, global.get_current_time());
      this._parent.close();
    } else if (symbol === closeArg) {
      this._parent.close();
    } else {
      return;
    }
    this.appThumbnails[index].thumbnail.handleEnterEvent();
  },


  _setVerticalSetting: function _setVerticalSetting() {
    var children = this.box.get_children();

    if (children.length > 0) {
      this.box.remove_actor(this.appContainer);
      this.box.add_actor(this.appContainer);
    } else {
      this.box.add_actor(this.appContainer);
    }

    this.appContainer.vertical = this._applet.verticalThumbs;
    this.box.vertical = !this._applet.verticalThumbs;
  },

  setMetaWindow: function setMetaWindow(metaWindow, metaWindows) {
    this.metaWindow = metaWindow;
    this.metaWindows = metaWindows;
    if (this.metaWindowThumbnail !== undefined && this.metaWindowThumbnail) {
      this.metaWindowThumbnail.setMetaWindow(metaWindow, metaWindows);
    }
    for (var w = 0, len = this.appThumbnails.length; w < len; w++) {
      this.appThumbnails[w].thumbnail.setMetaWindow(null, metaWindows);
    }
  },

  _isFavorite: function _isFavorite(isFav) {
    this.isFavapp = isFav;
  },

  handleUnopenedPinnedApp: function handleUnopenedPinnedApp(metaWindow, windows) {
    var _this10 = this;

    var appClosed = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;

    if (this.metaWindowThumbnail) {
      this.metaWindowThumbnail.destroy();
    }
    var isPinned = windows.length === 0 && !metaWindow && this.isFavapp;
    if (isPinned || windows.length === 0 && !this.metaWindowThumbnail) {
      this.metaWindowThumbnail = new WindowThumbnail(this, metaWindow, windows);
      this.appContainer.insert_actor(this.metaWindowThumbnail.actor, 0);
      setTimeout(function () {
        return _this10.setStyleOptions(null);
      }, 0);
      // Update appThumbnails to remove old programs
      this.removeStaleWindowThumbnails(windows);
    }
    return isPinned;
  },


  _refresh: function _refresh() {
    var _this11 = this;

    // Check to see if this.metaWindow has changed.  If so, we need to recreate
    // our thumbnail, etc.
    // Get a list of all windows of our app that are running in the current workspace
    var windows = _.map(this.metaWindows, 'win');

    if (this.metaWindowThumbnail && this.metaWindowThumbnail.needs_refresh()) {
      this.metaWindowThumbnail = null;
    }
    if (this.metaWindowThumbnail && _.isEqual(this.metaWindowThumbnail.metaWindow, this.metaWindow)) {
      this.metaWindowThumbnail._isFavorite(this.isFavapp);
    } else if (this.handleUnopenedPinnedApp(this.metaWindow, windows)) {
      return;
    }
    // Update appThumbnails to include new programs
    this.addWindowThumbnails(windows);
    // Update appThumbnails to remove old programs
    this.removeStaleWindowThumbnails(windows);
    // Set to true to readd the thumbnails; used for the sorting by last focused 
    this.reAdd = false;
    // used to make sure everything is on the stage
    setTimeout(function () {
      return _this11.setStyleOptions(windows);
    }, 0);
  },

  addWindowThumbnails: function addWindowThumbnails(windows) {
    if (this._applet.sortThumbs && windows.length > 0) {
      var children = this.appContainer.get_children();
      for (var w = 0, len = children.length; w < len; w++) {
        this.appContainer.remove_actor(children[w]);
      }
      this.appThumbnails = _.orderBy(this.appThumbnails, ['metaWindow.user_time'], ['asc']);
      this.reAdd = true;
    }

    for (var i = 0, _len5 = windows.length; i < _len5; i++) {
      var metaWindow = windows[i];
      var refThumb = _.findIndex(this.appThumbnails, { metaWindow: metaWindow });
      if (this.appThumbnails[i] !== undefined && this.appThumbnails[i] && refThumb !== -1) {
        if (this.reAdd) {
          if (this._applet.sortThumbs) {
            this.appContainer.insert_actor(this.appThumbnails[i].thumbnail.actor, 0);
          } else {
            this.appContainer.add_actor(this.appThumbnails[i].thumbnail.actor);
          }
        }
      } else {
        if (this.metaWindowThumbnail) {
          this.metaWindowThumbnail.destroy(true);
        }
        var thumbnail = new WindowThumbnail(this, metaWindow, windows);
        thumbnail.setMetaWindow(metaWindow, windows);
        this.appThumbnails.push({
          metaWindow: metaWindow,
          thumbnail: thumbnail
        });
        if (this._applet.sortThumbs) {
          this.appContainer.insert_actor(this.appThumbnails[i].thumbnail.actor, 0);
        } else {
          this.appContainer.add_actor(this.appThumbnails[i].thumbnail.actor);
        }
      }
    }
    this.appContainer.show();
  },
  setStyleOptions: function setStyleOptions(windows) {
    this.appContainer.style = null;
    this.box.style = null;
    var thumbnailTheme = this.appContainer.peek_theme_node();
    var padding = thumbnailTheme ? thumbnailTheme.get_horizontal_padding() : null;
    var thumbnailPadding = padding && padding > 1 && padding < 21 ? padding : 10;
    this.appContainer.style = 'padding:' + thumbnailPadding / 2 + 'px';
    var boxTheme = this.box.peek_theme_node();
    padding = boxTheme ? boxTheme.get_vertical_padding() : null;
    var boxPadding = padding && padding > 0 ? padding : 3;
    this.box.style = 'padding:' + boxPadding + 'px;';
    if (this.isFavapp) {
      this.metaWindowThumbnail.thumbnailIconSize();
      return;
    }
    if (windows === null) {
      return;
    }
    for (var i = 0, len = this.appThumbnails.length; i < len; i++) {
      if (this.appThumbnails[i].thumbnail) {
        this.appThumbnails[i].thumbnail.thumbnailIconSize();
      }
    }
  },

  removeStaleWindowThumbnails: function removeStaleWindowThumbnails(windows) {
    for (var i = 0, len = this.appThumbnails.length; i < len; i++) {
      if (this.appThumbnails[i] !== undefined && windows.indexOf(this.appThumbnails[i].metaWindow) === -1) {
        if (this.appThumbnails[i].thumbnail) {
          this.appContainer.remove_actor(this.appThumbnails[i].thumbnail.actor);
          this.appThumbnails[i].thumbnail.destroy();
        }
        _.pullAt(this.appThumbnails, i);
      }
    }
  },

  destroy: function destroy() {
    var _this12 = this;

    _.each(this.signals, function (signal, key) {
      _.each(signal, function (id) {
        _this12[key].disconnect(id);
      });
    });
    for (var w = 0, len = this.appThumbnails.length; w < len; w++) {
      if (this.appThumbnails[w] !== undefined) {
        this.appThumbnails[w].thumbnail.destroy(true);
      }
    }
    var children = this.appContainer.get_children();
    for (var _w = 0, _len6 = children.length; _w < _len6; _w++) {
      this.appContainer.remove_actor(children[_w]);
    }
    this.appContainer.destroy_children();
    this.appContainer.destroy();
    children = this.box.get_children();
    for (var _w2 = 0, _len7 = children.length; _w2 < _len7; _w2++) {
      this.box.remove_actor(children[_w2]);
    }
    this.box.destroy_children();
    this.box.destroy();
    PopupMenu.PopupBaseMenuItem.prototype.destroy.call(this);
  }
};

function WindowThumbnail() {
  this._init.apply(this, arguments);
}

WindowThumbnail.prototype = {
  _init: function _init(parent, metaWindow, metaWindows) {
    var _this13 = this;

    this._applet = parent._applet;
    this.settings = parent._applet.settings;
    this.metaWindow = metaWindow || null;
    this.metaWindows = metaWindows;
    this.app = parent.app;
    this.isFavapp = parent.isFavapp || false;
    this.wasMinimized = false;
    this._parent = parent;
    this.thumbnailPadding = 16;
    this.signals = {
      actor: [],
      button: [],
      settings: []
    };

    // Inherit the theme from the alt-tab menu
    this.actor = new St.BoxLayout({
      style_class: 'item-box',
      reactive: true,
      track_hover: true,
      vertical: true
    });
    this.actor._delegate = this;
    // Override with own theme.
    this.actor.add_style_class_name('thumbnail-box');
    this.thumbnailActor = new St.Bin();

    this._container = new St.BoxLayout({
      style_class: this._applet.thumbCloseBtnStyle ? 'thumbnail-iconlabel' : 'thumbnail-iconlabel-cont'
    });

    this.bin = new St.BoxLayout({
      style_class: 'thumbnail-label-bin'
    });

    this.icon = this.app.create_icon_texture(32);
    this.themeIcon = new St.BoxLayout({
      style_class: 'thumbnail-icon'
    });
    this.themeIcon.add_actor(this.icon);
    this._container.add_actor(this.themeIcon);
    this._label = new St.Label({
      style_class: 'thumbnail-label'
    });
    this._container.add_actor(this._label);
    this.button = new St.BoxLayout({
      style_class: this._applet.thumbCloseBtnStyle ? 'window-close' : 'thumbnail-close',
      style: this._applet.thumbCloseBtnStyle ? 'padding: 0px; width: 16px; height: 16px; max-width: 16px; max-height: 16px;' : null,
      reactive: true
    });

    this.button.hide();
    this.bin.add_actor(this._container);
    this.bin.add_actor(this.button);
    this.actor.add_actor(this.bin);
    this.actor.add_actor(this.thumbnailActor);

    this._isFavorite(this.isFavapp, this.metaWindow, this.metaWindows);

    if (this.metaWindow) {
      this.windowTitleId = this.metaWindow.connect('notify::title', function () {
        _this13._label.text = _this13.metaWindow.get_title();
      });
      this.windowFocusId = this.metaWindow.connect('notify::appears-focused', Lang.bind(this, this._focusWindowChange));
      this._updateAttentionGrabber(null, null, this._applet.showAlerts);
      this.signals.settings.push(this.settings.connect('changed::show-alerts', Lang.bind(this, this._updateAttentionGrabber)));
      this.tracker = this._applet.tracker;
      this._trackerSignal = this.tracker.connect('notify::focus-app', Lang.bind(this, this._onFocusChange));
    }
    this.signals.actor.push(this.actor.connect('enter-event', function () {
      return _this13.handleEnterEvent();
    }));
    this.signals.actor.push(this.actor.connect('leave-event', function () {
      return _this13.handleLeaveEvent();
    }));
    this.signals.button.push(this.button.connect('button-release-event', Lang.bind(this, this._onButtonRelease)));
    this.signals.actor.push(this.actor.connect('button-release-event', Lang.bind(this, this._connectToWindow)));
    //update focused style
    this._focusWindowChange();
    this.entered = false;
  },

  handleEnterEvent: function handleEnterEvent() {
    this.entered = true;
    if (!this.isFavapp) {
      this._hoverPeek(this._applet.peekOpacity, this.metaWindow, true);
      this.actor.add_style_pseudo_class('outlined');
      this.actor.add_style_pseudo_class('selected');
      this.button.show();
      if (this.metaWindow.minimized && this._applet.enablePeek && this.app.get_name() !== 'Steam') {
        this.metaWindow.unminimize();
        if (this.metaWindow.is_fullscreen()) {
          this.metaWindow.unmaximize(global.get_current_time());
        }
        this.wasMinimized = true;
      } else {
        this.wasMinimized = false;
      }
    }
  },
  handleLeaveEvent: function handleLeaveEvent() {
    this.entered = false;
    if (!this.isFavapp) {
      this._hoverPeek(OPACITY_OPAQUE, this.metaWindow, false);
      this.actor.remove_style_pseudo_class('outlined');
      this._focusWindowChange();
      this.button.hide();
      if (this.wasMinimized) {
        this.metaWindow.minimize(global.get_current_time());
      }
    }
  },


  setMetaWindow: function setMetaWindow(metaWindow, metaWindows) {
    if (metaWindow) {
      this.metaWindow = metaWindow;
    }
    this.metaWindows = metaWindows;
  },

  _updateAttentionGrabber: function _updateAttentionGrabber(obj, oldVal, newVal) {
    if (newVal) {
      this._urgent_signal = global.display.connect('window-marked-urgent', Lang.bind(this, this._onWindowDemandsAttention));
      this._attention_signal = global.display.connect('window-demands-attention', Lang.bind(this, this._onWindowDemandsAttention));
    } else {
      if (this._urgent_signal) {
        global.display.disconnect(this._urgent_signal);
      }
      if (this._attention_signal) {
        global.display.disconnect(this._attention_signal);
      }
    }
  },

  _onWindowDemandsAttention: function _onWindowDemandsAttention(display, window) {
    if (this._needsAttention) {
      return false;
    }
    this._needsAttention = true;
    if (_.isEqual(this.metaWindow, window)) {
      this.actor.add_style_class_name('thumbnail-alerts');
      return true;
    }
    return false;
  },

  _onFocusChange: function _onFocusChange() {
    if (this._hasFocus()) {
      this.actor.remove_style_class_name('thumbnail-alerts');
    }
  },

  _focusWindowChange: function _focusWindowChange() {
    if (this._hasFocus()) {
      this.actor.add_style_pseudo_class('selected');
    } else {
      this.actor.remove_style_pseudo_class('selected');
    }
  },

  _hasFocus: function _hasFocus() {
    if (!this.metaWindow) {
      return false;
    }

    if (this.metaWindow.minimized) {
      return false;
    }

    if (this.metaWindow.has_focus()) {
      return true;
    }

    var transientHasFocus = false;
    this.metaWindow.foreach_transient(function (transient) {
      if (transient.has_focus()) {
        transientHasFocus = true;
        return false;
      }
      return true;
    });
    return transientHasFocus;
  },

  _isFavorite: function _isFavorite(isFav) {
    var _this14 = this;

    var metaWindow = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : this.metaWindow;
    var windows = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : this.metaWindows;

    // Whether we create a favorite tooltip or a window thumbnail
    if (isFav) {
      // this.thumbnailActor.height = 0
      // this.thumbnailActor.width = 0
      this.thumbnailActor.child = null;
      var apptext = this.app.get_name();
      // not sure why it's 7
      this.thumbnailWidth = THUMBNAIL_ICON_SIZE + Math.floor(apptext.length * 7.0);
      this._label.text = apptext;
      this.isFavapp = true;
      this.actor.style = 'border-width:2px;padding: 2px';
    } else {
      this.actor.style = null;
      // HACK used to make sure everything is on the stage
      setTimeout(function () {
        return _this14.thumbnailPaddingSize();
      }, 0);
      this._refresh(metaWindow, windows);
    }
  },

  needs_refresh: function needs_refresh() {
    return Boolean(this.thumbnail);
  },

  thumbnailIconSize: function thumbnailIconSize() {
    var thumbnailTheme = this.themeIcon.peek_theme_node();
    if (thumbnailTheme) {
      var width = thumbnailTheme.get_width();
      var height = thumbnailTheme.get_height();
      this.icon.set_size(width, height);
    }
  },

  thumbnailPaddingSize: function thumbnailPaddingSize() {
    var thumbnailTheme = this.actor.peek_theme_node();
    var padding = thumbnailTheme ? thumbnailTheme.get_horizontal_padding() : null;
    this.thumbnailPadding = padding && padding > 3 && padding < 21 ? padding : 12;
    this.actor.style = 'border-width:2px;padding:' + this.thumbnailPadding / 2 + 'px;';
  },

  _getThumbnail: function _getThumbnail() {
    // Create our own thumbnail if it doesn't exist
    var thumbnail = null;
    var muffinWindow = this.metaWindow.get_compositor_private();
    if (muffinWindow) {
      var windowTexture = muffinWindow.get_texture();

      var _windowTexture$get_si = windowTexture.get_size(),
          _windowTexture$get_si2 = _slicedToArray(_windowTexture$get_si, 2),
          width = _windowTexture$get_si2[0],
          height = _windowTexture$get_si2[1];

      var scale = Math.min(1.0, this.thumbnailWidth / width, this.thumbnailHeight / height);
      thumbnail = new Clutter.Clone({
        source: windowTexture,
        reactive: true,
        width: width * scale,
        height: height * scale
      });
    }

    return thumbnail;
  },

  handleAfterClick: function handleAfterClick() {
    this.stopClick = true;
    this.destroy();
    this._hoverPeek(OPACITY_OPAQUE, this.metaWindow, false);

    this.metaWindow.delete(global.get_current_time());
    if (this.metaWindows.length === 1) {
      this._parent._parent.close();
    }
  },


  _onButtonRelease: function _onButtonRelease(actor, event) {
    if (event.get_state() & Clutter.ModifierType.BUTTON1_MASK && actor == this.button) {
      this.handleAfterClick();
    }
  },

  _connectToWindow: function _connectToWindow(actor, event) {
    this.wasMinimized = false;
    if (event.get_state() & Clutter.ModifierType.BUTTON1_MASK && !this.stopClick && !this.isFavapp) {
      Main.activateWindow(this.metaWindow, global.get_current_time());

      this._parent._parent.close();
    } else if (event.get_state() & Clutter.ModifierType.BUTTON2_MASK && !this.stopClick) {
      this.handleAfterClick();
    }
    this.stopClick = false;
  },

  _refresh: function _refresh() {
    var _this15 = this;

    var metaWindow = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : this.metaWindow;
    var metaWindows = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : this.metaWindows;

    // Turn favorite tooltip into a normal thumbnail
    var monitor = Main.layoutManager.primaryMonitor;

    var setThumbSize = function setThumbSize() {
      var divider = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 70;
      var offset = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 16;

      _this15.thumbnailWidth = Math.floor(monitor.width / divider * _this15._applet.thumbSize) + offset;
      _this15.thumbnailHeight = Math.floor(monitor.height / divider * _this15._applet.thumbSize) + offset;

      var monitorSize, thumbnailSize;
      if (_this15._applet.verticalThumbs) {
        monitorSize = monitor.height;
        thumbnailSize = _this15.thumbnailHeight;
      } else {
        monitorSize = monitor.width;
        thumbnailSize = _this15.thumbnailWidth;
      }

      if (_this15.metaWindows.length === 0) {
        metaWindows = _this15.app.get_windows();
      }

      if (thumbnailSize * metaWindows.length + thumbnailSize > monitorSize) {
        var divideMultiplier = _this15._applet.verticalThumbs ? 3 : 1.1;
        setThumbSize(divider * divideMultiplier, 16);
        return;
      } else {
        if (_this15._applet.verticalThumbs) {
          _this15.thumbnailActor.height = _this15.thumbnailHeight;
        }
        _this15.thumbnailActor.width = _this15.thumbnailWidth;
        _this15._container.style = 'width: ' + Math.floor(_this15.thumbnailWidth - 16) + 'px';

        _this15.isFavapp = false;

        // Replace the old thumbnail
        _this15._label.text = _this15.metaWindow.get_title();
        if (_this15._applet.showThumbs) {
          _this15.thumbnail = _this15._getThumbnail();
          _this15.thumbnailActor.child = _this15.thumbnail;
        } else {
          _this15.thumbnailActor.child = null;
        }
      }
    };

    setThumbSize();
  },

  _hoverPeek: function _hoverPeek(opacity, metaWin, enterEvent) {
    var applet = this._applet;
    if (!applet.enablePeek) {
      return;
    }

    function setOpacity(window_actor, target_opacity) {
      Tweener.addTween(window_actor, {
        time: applet.peekTime * 0.001,
        transition: 'easeOutQuad',
        opacity: target_opacity
      });
    }
    var monitorOrigin = metaWin.get_monitor();
    var wa = global.get_window_actors();
    for (var i = 0, len = wa.length; i < len; i++) {
      var waWin = wa[i].get_meta_window();
      if (metaWin === waWin || waWin.get_monitor() !== monitorOrigin) {
        continue;
      }

      if (waWin.get_window_type() !== Meta.WindowType.DESKTOP) {
        setOpacity(wa[i], opacity);
      }
    }
  },

  destroy: function destroy() {
    var _this16 = this;

    var skipSignalDisconnect = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;

    try {
      if (this._trackerSignal) {
        this.tracker.disconnect(this._trackerSignal);
      }
      if (this._urgent_signal) {
        global.display.disconnect(this._urgent_signal);
      }
      if (this._attention_signal) {
        global.display.disconnect(this._attention_signal);
      }
      if (this.windowTitleId) {
        this.metaWindow.disconnect(this.windowTitleId);
      }
      if (this.windowFocusId) {
        this.metaWindow.disconnect(this.windowFocusId);
      }
    } catch (e) {
      /* Signal is invalid */
    }
    if (!skipSignalDisconnect) {
      _.each(this.signals, function (signal, key) {
        _.each(signal, function (id) {
          if (_this16[key] && id) {
            _this16[key].disconnect(id);
          }
        });
      });
    }
    var refThumb = _.findIndex(this._parent.appThumbnails, function (thumb) {
      return _.isEqual(thumb.metaWindow, _this16.metaWindow);
    });
    if (refThumb !== -1) {
      _.pullAt(this._parent.appThumbnails, refThumb);
    }

    this._container.destroy_children();
    this._container.destroy();
    this.bin.destroy_children();
    this.bin.destroy();
    this.actor.destroy_children();
    this.actor.destroy();
  }
};