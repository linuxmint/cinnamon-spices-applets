const Clutter = imports.gi.Clutter;
const AppletManager = imports.ui.appletManager;
const Lang = imports.lang;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const Meta = imports.gi.Meta;
const Util = imports.misc.util;
const St = imports.gi.St;
const Gio = imports.gi.Gio;
const Tweener = imports.ui.tweener;
const Applet = imports.ui.applet;
const Tooltips = imports.ui.tooltips;
const SignalManager = imports.misc.signalManager;

let each, isEqual, constants, getFirefoxHistory, setTimeout, t;
if (typeof require !== 'undefined') {
  each = require('./each').each;
  isEqual = require('./isEqual').isEqual;
  getFirefoxHistory = require('./firefox').getFirefoxHistory;
  constants = require('./constants').constants;
  t = require('./gettext').t;
  setTimeout = require('./timers').setTimeout;
} else {
  const AppletDir = imports.ui.appletManager.applets['IcingTaskManager@json'];
  each = AppletDir.each.each;
  isEqual = AppletDir.isEqual.isEqual;
  getFirefoxHistory = AppletDir.firefox.getFirefoxHistory;
  constants = AppletDir.constants.constants;
  t = AppletDir.gettext.t;
  setTimeout = AppletDir.timers.setTimeout;
}

const convertRange = function(value, r1, r2) {
  return (value - r1[0]) * (r2[1] - r2[0]) / (r1[1] - r1[0]) + r2[0];
};

const setOpacity = (peekTime, window_actor, targetOpacity) => {
  Tweener.addTween(window_actor, {
    time: peekTime * 0.001,
    transition: 'easeOutQuad',
    opacity: convertRange(targetOpacity, [0, 100], [0, 255])
  });
};

const singleWindowHasFocus = function(metaWindow) {
  if (!metaWindow
    || metaWindow.minimized) {
    return false;
  }

  if (metaWindow.appears_focused) {
    return true;
  }

  let transientHasFocus = false;
  metaWindow.foreach_transient(function (transient) {
    if (transient.appears_focused) {
      transientHasFocus = true;
      return false;
    }
    return true;
  });
  return transientHasFocus;
};

function AppMenuButtonRightClickMenu () {
  this._init.apply(this, arguments);
}

AppMenuButtonRightClickMenu.prototype = {
  __proto__: Applet.AppletPopupMenu.prototype,

  _init: function(params) {
    Applet.AppletPopupMenu.prototype._init.call(this, params.parent, params.state.orientation);

    this.state = params.state;
    this.groupState = params.groupState;

    this._parent = params.parent;
    this.signals = new SignalManager.SignalManager(this);
    this.signals.connect(this, 'open-state-changed', Lang.bind(this, this._onToggled));

    this.app = this._parent.app;
    this.appId = this._parent.appId;
    this.appInfo = this.app.get_app_info();
    this.autoStartIndex = this._parent.autoStartIndex;
    this.actor.style = 'width: 500px;';
  },

  monitorMoveWindows: function(arg1, arg2, arg3, i) {
    if (this.state.settings.monitorMoveAllWindows) {
      for (let z = 0, len = this.groupState.metaWindows.length; z < len; z++) {
        if (!this.groupState.metaWindows[z]) {
          continue;
        }
        let focused = 0;
        if (this.groupState.metaWindows[z].has_focus()) {
          ++focused;
        }
        if (z === len - 1 && focused === 0) {
          Main.activateWindow(this.groupState.metaWindows[z], global.get_current_time());
        }
        this.groupState.metaWindows[z].move_to_monitor(i);
      }
    } else {
      this.groupState.lastFocused.move_to_monitor(i);
      Main.activateWindow(this.groupState.lastFocused, global.get_current_time());
    }
  },

  _populateMenu: function() {
    this.signals.disconnectAllSignals();
    this.signals.connect(this, 'open-state-changed', Lang.bind(this, this._onToggled));
    /*if (!this.groupState.lastFocused) {
      this.groupState.lastFocused = this._parent.lastFocused;
    }*/

    let item;
    let length;
    let hasWindows = this.groupState.metaWindows.length > 0;

    let createMenuItem = (opts={label: '', icon: null}) => {
      if (this.state.settings.menuItemType < 3 && opts.icon) {
        let refMenuType = constants.menuItemTypeOptions.find(menuItemType => menuItemType.id === this.state.settings.menuItemType);
        return new PopupMenu.PopupIconMenuItem(opts.label, opts.icon, St.IconType[refMenuType.label]);
      } else {
        return new PopupMenu.PopupMenuItem(opts.label);
      }
    };

    if (hasWindows) {
      // Monitors
      if (Main.layoutManager.monitors.length > 1) {
        let connectMonitorEvent = (item, i) => {
          this.signals.connect(item, 'activate', Lang.bind(this, this.monitorMoveWindows, i));
        };
        for (let i = 0, len = Main.layoutManager.monitors.length; i < len; i++) {
          if (i === this.groupState.lastFocused.get_monitor()) {
            continue;
          }
          item = createMenuItem({label: Main.layoutManager.monitors.length === 2 ? t('Move to the other monitor') : t('Move to monitor ') + (i + 1).toString()});
          connectMonitorEvent(item, i);
          this.addMenuItem(item);
        }
      }
      // Workspace
      if ((length = global.screen.n_workspaces) > 1) {
        if (this.groupState.lastFocused.is_on_all_workspaces()) {
          item = createMenuItem({label: t('Only on this workspace')});
          this.signals.connect(item, 'activate', () => this.groupState.lastFocused.unstick());
          this.addMenuItem(item);
        } else {
          item = createMenuItem({label: t('Visible on all workspaces')});
          this.signals.connect(item, 'activate', () => this.groupState.lastFocused.stick());
          this.addMenuItem(item);

          item = new PopupMenu.PopupSubMenuMenuItem(t('Move to another workspace'));
          this.addMenuItem(item);

          let connectWorkspaceEvent = (ws, j)=>{
            this.signals.connect(ws, 'activate', () => this.groupState.lastFocused.change_workspace(global.screen.get_workspace_by_index(j)));
          };
          for (let i = 0; i < length; i++) {
            // Make the index a local letiable to pass to function
            let j = i;
            let name = Main.workspace_names[i] ? Main.workspace_names[i] : Main._makeDefaultWorkspaceName(i);
            let ws = createMenuItem({label: t(name)});

            if (i === this.state.currentWs) {
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
    if (this.state.settings.showRecent) {

      // Places
      if (this.appId === 'nemo.desktop' || this.appId === 'nemo-home.desktop') {
        let subMenu = new PopupMenu.PopupSubMenuMenuItem(t('Places'));
        this.addMenuItem(subMenu);

        let defualtPlaces = this._listDefaultPlaces();
        let bookmarks = this._listBookmarks();
        let devices = this._listDevices();
        let places = defualtPlaces.concat(bookmarks).concat(devices);
        let handlePlaceLaunch = (item, i) => {
          this.signals.connect(item, 'activate', () => places[i].launch());
        };
        for (let i = 0, len = places.length; i < len; i++) {
          item = createMenuItem({label: t(places[i].name), icon: 'folder'});
          handlePlaceLaunch(item, i);
          this.recentMenuItems.push(item);
          subMenu.menu.addMenuItem(item);
        }
        this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
      }

      // History
      if (this.appId === 'firefox.desktop' || this.appId === 'firefox web browser.desktop') {
        let subMenu = new PopupMenu.PopupSubMenuMenuItem(t(constants.ffOptions.find(ffOption => ffOption.id === this.state.settings.firefoxMenu).label));
        this.addMenuItem(subMenu);

        let histories = getFirefoxHistory(this.state.settings);
        if (histories) {
          try {
            let handleHistoryLaunch = (item, i) => {
              this.signals.connect(item, 'activate', () => Gio.app_info_launch_default_for_uri(histories[i].uri, global.create_app_launch_context()));
            };
            for (let i = 0, len = histories.length; i < len; i++) {
              item = createMenuItem({label: t(histories[i].title), icon: 'go-next'});
              handleHistoryLaunch(item, i);
              this.recentMenuItems.push(item);
              subMenu.menu.addMenuItem(item);
            }
          } catch (e) {}
        }
        this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
      }

      // Recent Files
      let recentItems = this.state.recentItems;
      let items = [];

      for (let i = 0, len = recentItems.length; i < len; i++) {
        let mimeType = recentItems[i].get_mime_type();
        let appInfo = Gio.app_info_get_default_for_type(mimeType, false);
        if (appInfo && this.appInfo && appInfo.get_id() === this.appId) {
          items.push(recentItems[i]);
        }
      }
      let itemsLength = items.length;

      if (itemsLength > 0) {
        let subMenu = new PopupMenu.PopupSubMenuMenuItem(t('Recent'));
        this.addMenuItem(subMenu);
        let num = 10;
        if (itemsLength > num) {
          itemsLength = num;
        }
        let handleRecentLaunch = (item, i) => {
          this.signals.connect(item, 'activate', () => Gio.app_info_launch_default_for_uri(items[i].get_uri(), global.create_app_launch_context()));
        };
        for (let i = 0; i < itemsLength; i++) {
          item = createMenuItem({label: t(items[i].get_short_name()), icon: 'list-add'});
          handleRecentLaunch(item, i);
          this.recentMenuItems.push(item);
          subMenu.menu.addMenuItem(item);
        }
        this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
      }
    }

    // Preferences
    let subMenu = new PopupMenu.PopupSubMenuMenuItem(t('Preferences'));
    this.addMenuItem(subMenu);

    item = createMenuItem({label: t('About...'), icon: 'dialog-question'});
    this.signals.connect(item, 'activate', () => this.state.trigger('openAbout'));
    subMenu.menu.addMenuItem(item);

    item = createMenuItem({label: t('Configure...'), icon: 'system-run'});
    this.signals.connect(item, 'activate', () => this.state.trigger('configureApplet'));
    subMenu.menu.addMenuItem(item);

    item = createMenuItem({label: t('Remove') + ' \'Icing Task Manager\'', icon: 'edit-delete'});
    this.signals.connect(item, 'activate', () => {
      AppletManager._removeAppletFromPanel(this.state.uuid, this.state.instance_id);
    });
    subMenu.menu.addMenuItem(item);

    // Actions
    let actions = null;
    try {
      actions = this.appInfo.list_actions();
      if (this.appInfo && actions) {
        this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        let handleAction = (action)=>{
          item = createMenuItem({label: t(this.appInfo.get_action_name(action)), icon: 'document-new'});
          this.signals.connect(item, 'activate', () => {
            this.appInfo.launch_action(action, global.create_app_launch_context());
          });
          this.recentMenuItems.push(item);
        };

        for (let i = 0, len = actions.length; i < len; i++) {
          handleAction(actions[i]);
          this.addMenuItem(item);
        }
        this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
      }
    } catch (e) {
      if (this.app.is_window_backed()) {
        this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
      }
    }

    // Pin/unpin, shortcut handling
    if (!this.app.is_window_backed()) {
      if (this.state.settings.showPinned !== constants.FavType.none && !this.app.is_window_backed()) {
        let label = this._parent.isFavoriteApp ? t('Unpin from Panel') : t('Pin to Panel');
        this.pinToggleItem = createMenuItem({label: label, icon: 'bookmark-new'});
        this.signals.connect(this.pinToggleItem, 'activate', Lang.bind(this, this._toggleFav));
        this.addMenuItem(this.pinToggleItem);
      }
      if (this.state.settings.autoStart) {
        let label = this.autoStartIndex !== -1 ? t('Remove from Autostart') : t('Add to Autostart');
        item = createMenuItem({label: label, icon: 'insert-object'});
        this.signals.connect(item, 'activate', Lang.bind(this, this._toggleAutostart));
        this.addMenuItem(item);
      }
    } else {
      item = createMenuItem({label: t('Create Shortcut'), icon: 'list-add'});
      this.signals.connect(item, 'activate', Lang.bind(this, this._createShortcut));
      this.addMenuItem(item);
    }
    this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

    // Window controls
    if (hasWindows) {
      // Miscellaneous
      if (this.groupState.lastFocused.get_compositor_private().opacity !== 255) {
        item = createMenuItem({label: t('Restore to full opacity')});
        this.signals.connect(item, 'activate', () => {
          this.groupState.lastFocused.get_compositor_private().set_opacity(255);
        });
        this.addMenuItem(item);
      }

      if (this.groupState.lastFocused.minimized) {
        item = createMenuItem({label: t('Restore'), icon: 'view-sort-descending'});
        this.signals.connect(item, 'activate', () => {
          Main.activateWindow(this.groupState.lastFocused, global.get_current_time());
        });
      } else {
        item = createMenuItem({label: t('Minimize'), icon: 'view-sort-ascending'});
        this.signals.connect(item, 'activate', () => {
          this.groupState.lastFocused.minimize();
        });
      }
      this.addMenuItem(item);

      if (this.groupState.lastFocused.get_maximized()) {
        item = createMenuItem({label: t('Unmaximize'), icon: 'view-restore'});
        this.signals.connect(item, 'activate', () => {
          this.groupState.lastFocused.unmaximize(Meta.MaximizeFlags.HORIZONTAL | Meta.MaximizeFlags.VERTICAL);
        });
      } else {
        item = createMenuItem({label: t('Maximize'), icon: 'view-fullscreen'});
        this.signals.connect(item, 'activate', () => {
          this.groupState.lastFocused.maximize(Meta.MaximizeFlags.HORIZONTAL | Meta.MaximizeFlags.VERTICAL);
        });
      }
      this.addMenuItem(item);

      if (this.groupState.metaWindows.length > 1) {
        // Close others
        item = createMenuItem({label: t('Close others'), icon: 'window-close'});
        this.signals.connect(item, 'activate', () => {
          each(this.groupState.metaWindows, (metaWindow) => {
            if (!isEqual(metaWindow, this.groupState.lastFocused) && !metaWindow._needsAttention) {
              metaWindow.delete(global.get_current_time());
            }
          });
        });
        this.addMenuItem(item);
        // Close all
        item = createMenuItem({label: t('Close all'), icon: 'application-exit'});
        this.signals.connect(item, 'activate', () => {
          if (!this._parent.isFavoriteApp) {
            this._parent.willUnmount = true;
          }
          this._parent.app.request_quit();
        });
        this.addMenuItem(item);
        this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
      } else {
        item = createMenuItem({label: t('Close'), icon: 'edit-delete'});
        this.signals.connect(item, 'activate', () => {
          this.groupState.lastFocused.delete(global.get_current_time());
        });
        this.addMenuItem(item);
        this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
      }
    }
  },

  _onToggled: function(actor, isOpening) {
    this.state.menuOpen = this.isOpen;

    if (!isOpening) {
      return;
    }
    this.removeAll();
    this._populateMenu();
  },

  _toggleAutostart: function(){
    if (this.autoStartIndex !== -1) {
      this.state.autoStartApps[this.autoStartIndex].file.delete(null);
      this.state.autoStartApps[this.autoStartIndex] = undefined;
      this.state.autoStartApps.splice(this.autoStartIndex, 1);
      this.autoStartIndex = -1;
    } else {
      let filePath = this.appInfo.get_filename();
      Util.trySpawnCommandLine('bash -c "cp ' + filePath + ' ' + constants.autoStartStrDir + '"');
      setTimeout(()=>{
        this.state.trigger('getAutoStartApps');
        this.autoStartIndex = this.state.autoStartApps.length - 1;
      }, 500);
    }
  },

  _toggleFav: function () {
    if (this._parent.isFavoriteApp) {
      this.state.trigger('removeFavorite', this.appId);
    } else if (!this.app.is_window_backed()) {
      this.state.trigger('addFavorite', {
        appId: this.appId,
        app: this.app,
        pos: -1
      });
    }
  },

  _createShortcut: function () {
    let proc = this.groupState.lastFocused.get_pid();
    let cmd = [
      'bash',
      '-c',
      'python ~/.local/share/cinnamon/applets/IcingTaskManager@json/3.2/utils.py get_process ' + proc.toString()
    ];
    Util.spawn_async(cmd, (stdout) => {
      if (stdout) {
        setTimeout(() => {
          this.state.trigger('addFavorite', {appId: stdout.trim(), app: null, pos: -1});
          this.state.trigger('refreshCurrentAppList');
        }, 2000);
      }
    });
  },

  _listDefaultPlaces: function (pattern) {
    let defaultPlaces = Main.placesManager.getDefaultPlaces();
    let res = [];
    for (let i = 0, len = defaultPlaces.length; i < len; i++) {
      if (!pattern || defaultPlaces[i].name.toLowerCase().indexOf(pattern) !== -1) {
        res.push(defaultPlaces[i]);
      }
    }
    return res;
  },

  _listBookmarks: function (pattern) {
    let bookmarks = Main.placesManager.getBookmarks();
    let res = [];
    for (let i = 0, len = bookmarks.length; i < len; i++) {
      if (!pattern || bookmarks[i].name.toLowerCase().indexOf(pattern) !== -1) {
        res.push(bookmarks[i]);
      }
    }
    return res;
  },

  _listDevices: function (pattern) {
    let devices = Main.placesManager.getMounts();
    let res = [];
    for (let i = 0, len = devices.length; i < len; i++) {
      if (!pattern || devices[i].name.toLowerCase().indexOf(pattern) !== -1) {
        res.push(devices[i]);
      }
    }
    return res;
  },

  destroy: function() {
    this.signals.disconnectAllSignals();
    Applet.AppletPopupMenu.prototype.destroy.call(this);
    let props = Object.keys(this);
    each(props, (propKey)=>{
      this[propKey] = undefined;
    });
  },
};

function HoverMenuController (owner) {
  this._init(owner);
}

HoverMenuController.prototype = {
  __proto__: PopupMenu.PopupMenuManager.prototype,

  _onEventCapture: function () {
    return false;
  }
};

function AppThumbnailHoverMenu () {
  this._init.apply(this, arguments);
}

AppThumbnailHoverMenu.prototype = {
  __proto__: PopupMenu.PopupMenu.prototype,

  _init: function (parent, state, groupState) {
    this.state = state;
    this.groupState = groupState;

    this.appGroup = parent;
    this.signals = new SignalManager.SignalManager(this);
    PopupMenu.PopupMenu.prototype._init.call(this, parent.actor, this.state.orientation, 0.5);
    this.parentActor = parent.actor;
    this.groupState.lastFocused = parent.metaWindow;
    this.groupState.metaWindows = [];
    this.appThumbnails = [];

    this.app = parent.app;
    this.isFavoriteApp = parent.isFavoriteApp;
    this.appList = parent.appList;
    this._tooltip = new Tooltips.PanelItemTooltip({actor: parent.actor}, '', this.state.orientation);

    this.actor.hide();
    Main.layoutManager.addChrome(this.actor, {});
    this._setVerticalSetting();
    this.actor.set_style_class_name('');
    this.box.set_style_class_name('switcher-list');

    this.signals.connect(this.parentActor, 'enter-event', Lang.bind(this, this._onMenuEnter));
    this.signals.connect(this.parentActor, 'leave-event', Lang.bind(this, this._onMenuLeave));
    this.signals.connect(this.parentActor, 'button-release-event', Lang.bind(this, this._onButtonPress));
    this.signals.connect(this.actor, 'enter-event', Lang.bind(this, this._onMenuEnter));
    this.signals.connect(this.actor, 'leave-event', Lang.bind(this, this._onMenuLeave));
    this.signals.connect(this.actor, 'key-release-event', Lang.bind(this, this._onKeyRelease));
    this.signals.connect(this.box, 'key-press-event', Lang.bind(this, this._onKeyPress));
  },

  _onButtonPress: function () {
    if (this.state.settings.onClickThumbs && this.box.get_children().length > 1) {
      return;
    }
    this.shouldClose = true;
    setTimeout(()=>this.close(), this.state.settings.thumbTimeout);
  },

  _onMenuEnter: function () {
    if (this.state.panelEditMode
      || (!this.isOpen && this.state.settings.onClickThumbs)
      || this.appGroup.rightClickMenu.isOpen) {
      return false;
    }
    this.shouldClose = false;
    setTimeout(()=>this.open(), this.state.settings.thumbTimeout);
  },

  _onMenuLeave: function () {
    if (this.appGroup.rightClickMenu.isOpen || this.state.panelEditMode) {
      return false;
    }
    this.shouldClose = true;
    setTimeout(()=>this.close(), this.state.settings.thumbTimeout);
  },

  _onKeyRelease: function(actor, event) {
    let symbol = event.get_key_symbol();
    if (this.isOpen && (symbol === Clutter.KEY_Super_L || symbol === Clutter.KEY_Super_R)) {
      // close this menu, if opened by super+#
      this.close();
      this.appList.lastCycled = null;
    }
    return true;
  },

  open: function () {
    if (this.isOpen || (this.shouldClose && !this.state.settings.onClickThumbs)) {
      return;
    }
    if (this.groupState.metaWindows.length === 0) {
      this._tooltip.set_text(this.appGroup.appName);
      this._tooltip.show();
    } else if (!this.isOpen) {
      this._refresh();
      PopupMenu.PopupMenu.prototype.open.call(this, this.state.settings.animateThumbs);
    }
  },

  close: function () {
    if (!this.shouldClose && this.state.settings.onClickThumbs) {
      return;
    }
    if (this.groupState.metaWindows.length === 0) {
      this._tooltip.set_text('');
      this._tooltip.hide();
    }
    if (this.isOpen) {
      PopupMenu.PopupMenu.prototype.close.call(this, this.state.settings.animateThumbs);
    }
  },

  _onKeyPress: function(actor, e){
    let symbol = e.get_key_symbol();
    let i = this.appThumbnails.findIndex(thumbnail => {
      return thumbnail.entered;
    });

    let entered = i > -1;
    if (entered) {
      this.appThumbnails[i].handleLeaveEvent();
    } else {
      i = this.appThumbnails.findIndex(thumbnail => {
        return thumbnail.metaWindow.appears_focused;
      });
      if (i === -1) {
        i = 0;
      }
    }
    let args;
    let closeArg;
    if (this.state.orientation === St.Side.TOP) {
      closeArg = Clutter.KEY_Up;
      args = [Clutter.KEY_Left, Clutter.KEY_Right];
    } else if (this.state.orientation === St.Side.BOTTOM) {
      closeArg = Clutter.KEY_Down;
      args = [Clutter.KEY_Right, Clutter.KEY_Left];
    } else if (this.state.orientation === St.Side.LEFT) {
      closeArg = Clutter.KEY_Left;
      args = [Clutter.KEY_Up, Clutter.KEY_Down];
    } else if (this.state.orientation === St.Side.RIGHT) {
      closeArg = Clutter.KEY_Right;
      args = [Clutter.KEY_Down, Clutter.KEY_Up];
    }
    let index;
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
      this.close();
    } else if (symbol === closeArg) {
      this.close();
    } else {
      return;
    }
    if (this.appThumbnails[index] !== undefined) {
      this.appThumbnails[index].handleEnterEvent();
    }
  },

  _isFavorite: function (isFav) {
    this.isFavoriteApp = isFav;
  },

  handleUnopenedPinnedApp: function(metaWindow, metaWindows){
    if (this.metaWindowThumbnail) {
      this.metaWindowThumbnail.destroy();
    }
    let isPinned = metaWindows.length === 0 && !metaWindow && this.isFavoriteApp;
    if (isPinned || (metaWindows.length === 0 && !this.metaWindowThumbnail)) {
      this.metaWindowThumbnail = new WindowThumbnail({
        parent: this,
        state: this.state,
        groupState: this.groupState,
        metaWindow: metaWindow
      });
      this.box.insert_actor(this.metaWindowThumbnail.actor, 0);
      this.setStyleOptions(true);
    }
    return isPinned;

  },

  _refresh: function (refreshThumbnails) {
    // Check to see if this.groupState.lastFocused has changed.  If so, we need to recreate
    // our thumbnail, etc.
    // Get a list of all windows of our app that are running in the current workspace

    if (this.metaWindowThumbnail && this.metaWindowThumbnail != null) {
      this.metaWindowThumbnail = null;
    }
    if (this.metaWindowThumbnail && isEqual(this.metaWindowThumbnail.metaWindow, this.groupState.lastFocused)) {
      this.metaWindowThumbnail._isFavorite(this.isFavoriteApp);
    } else if (this.handleUnopenedPinnedApp(this.groupState.lastFocused, this.groupState.metaWindows)) {
      return;
    }
    // Update appThumbnails to include new programs
    this.addWindowThumbnails(this.groupState.metaWindows);
    // Set to true to readd the thumbnails; used for the sorting by last focused
    this.reAdd = false;
    // used to make sure everything is on the stage
    this.setStyleOptions(false);
    if (refreshThumbnails) {
      for (let i = 0, len = this.appThumbnails.length; i < len; i++) {
        this.appThumbnails[i]._refresh(this.groupState.lastFocused, this.groupState.metaWindows);
      }
    }
  },

  _refreshThumbnails: function(){
    for (let i = 0, len = this.appThumbnails.length; i < len; i++) {
      if (this.appThumbnails[i] !== undefined && this.appThumbnails[i]) {
        this.appThumbnails[i]._refresh();
      }
    }
  },

  addWindowThumbnails: function (metaWindows) {
    if (!metaWindows) {
      metaWindows = this.groupState.metaWindows;
    }
    if (metaWindows.length > 0) {
      let children = this.box.get_children();
      for (let w = 0, len = children.length; w < len; w++) {
        this.box.remove_actor(children[w]);
      }
      this.reAdd = true;
    }

    for (let i = 0, len = metaWindows.length; i < len; i++) {
      let refThumb = this.appThumbnails.findIndex(thumbnail => isEqual(thumbnail.metaWindow, metaWindows[i]));
      if (!this.appThumbnails[i] && refThumb === -1) {
        if (this.metaWindowThumbnail) {
          this.metaWindowThumbnail.destroy(true);
        }
        let thumbnail = new WindowThumbnail({
          parent: this,
          state: this.state,
          groupState: this.groupState,
          metaWindow: metaWindows[i]
        });
        this.appThumbnails.push(thumbnail);
      }
    }
    if (this.state.settings.sortThumbs) {
      this.appThumbnails.sort(function (a, b) {
        return b.metaWindow.user_time - a.metaWindow.user_time;
      });
    }
    each(this.appThumbnails, (thumbnail, i) => {
      this.box.insert_actor(thumbnail.actor, i);
    });
    this.box.show();
  },
  setStyleOptions: function (skipThumbnailIconResize) {
    this.box.style = null;
    let thumbnailTheme = this.box.peek_theme_node();
    let padding = thumbnailTheme ? thumbnailTheme.get_horizontal_padding() : null;
    let thumbnailPadding = (padding && (padding > 1 && padding < 21) ? padding : 10);
    this.box.style = 'padding:' + (thumbnailPadding / 2) + 'px';
    let boxTheme = this.box.peek_theme_node();
    padding = boxTheme ? boxTheme.get_vertical_padding() : null;
    let boxPadding = (padding && (padding > 0) ? padding : 3);
    this.box.style = 'padding:' + boxPadding + 'px;';
    if (this.isFavoriteApp && this.metaWindowThumbnail) {
      this.metaWindowThumbnail.thumbnailIconSize();
      return;
    }
    if (skipThumbnailIconResize) {
      return;
    }
    for (let i = 0, len = this.appThumbnails.length; i < len; i++) {
      if (this.appThumbnails[i]) {
        this.appThumbnails[i].thumbnailIconSize();
      }
    }
  },

  _setVerticalSetting: function () {
    if (this.state.orientation === St.Side.TOP || this.state.orientation === St.Side.BOTTOM) {
      this.box.vertical = this.state.settings.verticalThumbs;
    } else {
      this.box.vertical = true;
    }
  },

  destroy: function () {
    if (this.metaWindowThumbnail && this.metaWindowThumbnail != null) {
      this.metaWindowThumbnail.destroy();
    }
    for (let w = 0, len = this.appThumbnails.length; w < len; w++) {
      if (this.appThumbnails[w] !== undefined) {
        this.appThumbnails[w].destroy(true);
      }
    }
    this.signals.disconnectAllSignals();
    this.removeAll();
    PopupMenu.PopupMenu.prototype.destroy.call(this);
    let props = Object.keys(this);
    each(props, (propKey)=>{
      this[propKey] = undefined;
    });
  },
};

function WindowThumbnail () {
  this._init.apply(this, arguments);
}

WindowThumbnail.prototype = {
  _init: function (params) {
    this.state = params.state;
    this.groupState = params.groupState;
    // TBD/Workaround: Thumbnails are not loading when opening the first window on a pinned app.
    this.groupState.connect('lastFocused', () => {
      if (this.groupState.metaWindows.length > 1) {
        return;
      }
      this.metaWindow = this.groupState.lastFocused;
      this._refresh();
    });
    this.metaWindow = params.metaWindow;
    this.hoverMenu = params.parent;
    this.app = this.hoverMenu.app;
    this.isFavoriteApp = this.hoverMenu.isFavoriteApp || false;
    this.wasMinimized = false;
    this.thumbnailPadding = 16;
    this.willUnmount = false;
    this.signals = new SignalManager.SignalManager(this);

    // Inherit the theme from the alt-tab menu
    this.actor = new St.BoxLayout({
      style_class: 'item-box',
      reactive: true,
      track_hover: true,
      vertical: true,
      can_focus: true
    });
    this.actor._delegate = null;
    // Override with own theme.
    this.actor.add_style_class_name('thumbnail-box');
    this.thumbnailActor = new St.Bin({
      style_class: 'thumbnail'
    });

    this._container = new St.BoxLayout();

    this.bin = new St.BoxLayout({
      y_expand: false
    });

    this.icon = this.app.create_icon_texture(16);
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
      reactive: true
    });

    if (this.state.settings.thumbCloseBtnStyle) {
      this.button.style_class = 'window-close';
      this.button.width = 16;
      this.button.height = 16;
      let left = global.ui_scale > 1 ? -10 : 0;
      this.button.style = 'padding: 0px; width: 8px; height: 8px; max-width: 8px; max-height: 8px; -cinnamon-close-overlap: 0px; postion: ' + left + 'px -2px;background-size: 16px 16px;';
    } else {
      this.button.style_class = 'thumbnail-close';
    }

    this.button.set_opacity(0);
    this.bin.add_actor(this._container);
    this.bin.add_actor(this.button);
    this.actor.add_actor(this.bin);
    this.actor.add_actor(this.thumbnailActor);

    this._isFavorite(this.isFavoriteApp, this.metaWindow, this.groupState.metaWindows);

    this.signals.connect(this.actor, 'enter-event', Lang.bind(this, this.handleEnterEvent));
    this.signals.connect(this.actor, 'leave-event', Lang.bind(this, this.handleLeaveEvent));
    this.signals.connect(this.button, 'button-release-event', Lang.bind(this, this._onCloseButtonRelease));
    this.signals.connect(this.actor, 'button-release-event', Lang.bind(this, this._connectToWindow));
    //update focused style
    this._focusWindowChange();
    this.entered = false;
  },

  handleEnterEvent: function(){
    this.entered = true;
    if (!this.isFavoriteApp) {
      this._hoverPeek(this.state.settings.peekOpacity, this.metaWindow);
      this.actor.add_style_pseudo_class('outlined');
      this.actor.add_style_pseudo_class('selected');
      this.button.set_opacity(255);
    }
  },

  handleLeaveEvent: function(){
    this.entered = false;
    if (!this.isFavoriteApp) {
      this._hoverPeek(constants.OPACITY_OPAQUE, this.metaWindow);
      this.actor.remove_style_pseudo_class('outlined');
      this._focusWindowChange();
      this.button.set_opacity(0);
    }
    this.destroyOverlayPreview();
  },

  _onWindowDemandsAttention: function (window) {
    if (this._needsAttention) {
      return false;
    }
    this._needsAttention = true;
    if (isEqual(this.metaWindow, window)) {
      this.actor.add_style_class_name('thumbnail-alerts');
      return true;
    }
    return false;
  },

  _focusWindowChange: function () {
    if (singleWindowHasFocus(this.metaWindow)) {
      this.actor.add_style_pseudo_class('selected');
    } else {
      this.actor.remove_style_pseudo_class('outlined');
      this.actor.remove_style_pseudo_class('selected');
    }
  },

  _isFavorite: function (isFav) {
    this.isFavoriteApp = isFav;

    if (this.groupState.metaWindows.length > 0) {
      this.actor.style = null;
      setTimeout(()=>this.thumbnailPaddingSize(), 0);
      this._refresh(this.metaWindow, this.groupState.metaWindows);
    }
  },

  thumbnailIconSize: function () {
    let thumbnailTheme = this.themeIcon.peek_theme_node();
    if (thumbnailTheme) {
      let width = thumbnailTheme.get_width();
      let height = thumbnailTheme.get_height();
      this.icon.set_size(width, height);
    }
  },

  thumbnailPaddingSize: function () {
    let thumbnailTheme = this.actor.peek_theme_node();
    let padding = thumbnailTheme ? thumbnailTheme.get_horizontal_padding() : null;
    this.thumbnailPadding = (padding && (padding > 3 && padding < 21) ? padding : 12);
    this.actor.style = 'border-width:2px;padding:' + ((this.thumbnailPadding / 2)) + 'px;';
  },

  _getThumbnail: function () {
    // Create our own thumbnail if it doesn't exist
    let thumbnail = null;
    if (this.muffinWindow) {
      this.signals.disconnect('size-changed', this.muffinWindow);
    }
    this.muffinWindow = this.metaWindow.get_compositor_private();
    if (this.muffinWindow) {
      let windowTexture = this.muffinWindow.get_texture();
      let [width, height] = windowTexture.get_size();
      this.signals.connect(this.muffinWindow, 'size-changed', Lang.bind(this, this._refresh));
      let scale = Math.min(1.0, this.thumbnailWidth / width, this.thumbnailHeight / height);
      thumbnail = new Clutter.Clone({
        source: windowTexture,
        reactive: true,
        width: width * scale,
        height: height * scale
      });
    }

    return thumbnail;
  },

  handleAfterClick: function(){
    this.stopClick = true;
    this.destroy();
    this._hoverPeek(constants.OPACITY_OPAQUE, this.metaWindow, false);

    this.metaWindow.delete(global.get_current_time());
    if (this.groupState.metaWindows.length <= 1) {
      this.hoverMenu.close();
    }
  },

  _onCloseButtonRelease: function (actor, event) {
    let button = event.get_button();
    if (button === 1 && isEqual(actor, this.button)) {
      this.handleAfterClick();
    }
  },

  _connectToWindow: function (actor, event) {
    if (!this.metaWindow || this.groupState.metaWindows.length === 0) {
      this.hoverMenu.close();
      return false;
    }
    if (this.state.overlayPreview) {
      this.handleLeaveEvent();
    }
    this.wasMinimized = false;
    let button = event.get_button();
    if (button === 1 && !this.stopClick && !this.isFavoriteApp) {
      Main.activateWindow(this.metaWindow, global.get_current_time(), this.metaWindow.get_workspace().index());
      this.hoverMenu.close();
    } else if (button === 2 && !this.stopClick) {
      this.handleAfterClick();
    }
    this.stopClick = false;
  },

  _refresh: function (metaWindow, metaWindows) {
    if (this.willUnmount) {
      return false;
    }
    metaWindow = metaWindow ? metaWindow : this.metaWindow;
    metaWindows = metaWindows ? metaWindows : this.groupState.metaWindows;
    if (!this.metaWindow) {
      return false;
    }

    // Turn favorite tooltip into a normal thumbnail
    let monitor = Main.layoutManager.primaryMonitor;

    let setThumbSize = (divider=70, offset=16)=>{
      this.thumbnailWidth = Math.floor((monitor.width / divider) * this.state.settings.thumbSize) + offset;
      this.thumbnailHeight = Math.floor((monitor.height / divider) * this.state.settings.thumbSize) + offset;

      let monitorSize, thumbnailSize;
      if (this.state.settings.verticalThumbs) {
        monitorSize = monitor.height;
        thumbnailSize = this.thumbnailHeight;
      } else {
        monitorSize = monitor.width;
        thumbnailSize = this.thumbnailWidth;
      }

      if (this.groupState.metaWindows.length === 0) {
        metaWindows = this.app.get_windows();
      }

      if ((thumbnailSize * metaWindows.length) + thumbnailSize > monitorSize) {
        let divideMultiplier = this.state.settings.verticalThumbs ? 3 : 1.1;
        setThumbSize(divider * divideMultiplier, 16);
        return;
      } else {
        this.thumbnailActor.width = this.thumbnailWidth;
        this._container.style = 'width: ' + Math.floor(this.thumbnailWidth - 16) + 'px;';
        if (this.state.settings.verticalThumbs && this.state.settings.showThumbs) {
          this.thumbnailActor.height = this.thumbnailHeight;
        } else if (this.state.settings.verticalThumbs) {
          this.thumbnailActor.height = 0;
        }

        this.isFavoriteApp = false;

        // Replace the old thumbnail
        this._label.text = this.metaWindow.title;
        if (this.state.settings.showThumbs) {
          this.thumbnail = this._getThumbnail();
          this.thumbnailActor.child = this.thumbnail;
        } else {
          this.thumbnailActor.child = null;
        }
      }
    };

    setThumbSize();
    return false;
  },

  _hoverPeek: function (opacity, metaWin) {
    if (!this.state.settings.enablePeek || this.state.overlayPreview) {
      return;
    }
    let metaWindowActor = metaWin.get_compositor_private();
    if (!metaWindowActor) {
      return;
    }
    this.state.set({
      overlayPreview: new Clutter.Clone({
        source: metaWindowActor.get_texture(),
        opacity: 0
      })
    });
    let [x, y] = metaWindowActor.get_position();
    this.state.overlayPreview.set_position(x, y);
    global.overlay_group.add_child(this.state.overlayPreview);
    global.overlay_group.set_child_above_sibling(this.state.overlayPreview, null);
    setOpacity(this.state.settings.peekTime, this.state.overlayPreview, opacity);
  },

  destroyOverlayPreview: function() {
    if (!this.state.overlayPreview) {
      return;
    }
    global.overlay_group.remove_child(this.state.overlayPreview);
    this.state.overlayPreview.destroy();
    this.state.set({overlayPreview: null});
  },

  destroy: function(){
    this.willUnmount = true;
    this.signals.disconnectAllSignals();
    let refThumb = this.hoverMenu.appThumbnails.findIndex(thumb => {
      return isEqual(thumb.metaWindow, this.metaWindow);
    });
    if (refThumb !== -1) {
      this.hoverMenu.appThumbnails.splice(refThumb, 1);
    }
    this._container.destroy();
    this.bin.destroy();
    this.actor.destroy();
  }
};
