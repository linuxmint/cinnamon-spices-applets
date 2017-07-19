const Clutter = imports.gi.Clutter;
const AppletManager = imports.ui.appletManager;
const Lang = imports.lang;
const Main = imports.ui.main;
const Params = imports.misc.params;
const PopupMenu = imports.ui.popupMenu;
const Meta = imports.gi.Meta;
const Util = imports.misc.util;
const St = imports.gi.St;
const Gio = imports.gi.Gio;
const Tweener = imports.ui.tweener;
const Applet = imports.ui.applet;
const Tooltips = imports.ui.tooltips;
const SignalManager = imports.misc.signalManager;

const AppletDir = imports.ui.appletManager.applets['IcingTaskManager@json'];

const _ = AppletDir.lodash._;
const each = AppletDir.each.each;
const getFirefoxHistory = AppletDir.firefox.getFirefoxHistory;
const constants = AppletDir.constants.constants;
const t = AppletDir.gettext.t;
const setTimeout = AppletDir.timers.setTimeout;

function AppMenuButtonRightClickMenu () {
  this._init.apply(this, arguments);
}

AppMenuButtonRightClickMenu.prototype = {
  __proto__: Applet.AppletPopupMenu.prototype,

  _init: function(params) {
    this.orientation = params.parent._applet.orientation;
    Applet.AppletPopupMenu.prototype._init.call(this, params.parent, this.orientation);

    this._parent = params.parent;
    this._applet = this._parent._applet;
    this.connect('open-state-changed', Lang.bind(this, this._onToggled));

    this.app = this._parent.app;
    this.appId = this._parent.appId;
    this.appInfo = this.app.get_app_info();
    this.pinnedFavorites = this._applet.pinnedFavorites;
    this.metaWindow = params.metaWindow;
    this.metaWindows = params.metaWindows;
    this.autostartIndex = this._parent.autostartIndex;
    this.actor.style = 'width: 500px;';
  },

  setMetaWindow: function (metaWindow, metaWindows) {
    // Last focused
    this.metaWindow = metaWindow;

    // Window list from appGroup
    this.metaWindows = metaWindows;
  },

  _populateMenu: function() {
    if (!this.metaWindow) {
      this.metaWindow = this._parent._getLastFocusedWindow();
    }

    let mw = this.metaWindow;
    let item;
    let length;
    let hasWindows = this.metaWindows.length > 0;

    let createMenuItem = (opts={label: '', icon: null})=>{
      if (this._applet.menuItemType < 3 && opts.icon) {
        let refMenuType = _.find(constants.menuItemTypeOptions, {id: this._applet.menuItemType});
        return new PopupMenu.PopupIconMenuItem(t(opts.label), opts.icon, St.IconType[refMenuType.label]);
      } else {
        return new PopupMenu.PopupMenuItem(t(opts.label));
      }
    };

    if (hasWindows) {
      // Monitors
      if (Main.layoutManager.monitors.length > 1) {
        let connectMonitorEvent = (item, mw, i)=>{
          item.connect('activate', ()=>{
            if (this._applet.monitorMoveAllWindows) {
              for (let z = 0, len = this.metaWindows.length; z < len; z++) {
                let focused = 0;
                this.metaWindows[z].move_to_monitor(i);
                if (this.metaWindows[z].has_focus()) {
                  ++focused;
                }
                if (z === len - 1 && focused === 0) {
                  this.app.activate(this.metaWindows[z], global.get_current_time());
                }
              }
            } else {
              mw.move_to_monitor(i);
              this.app.activate(mw, global.get_current_time());
            }
          });
        };
        for (let i = 0, len = Main.layoutManager.monitors.length; i < len; i++) {
          if (i === mw.get_monitor()) {
            continue;
          }
          item = createMenuItem({label: Main.layoutManager.monitors.length === 2 ? 'Move to the other monitor' : 'Move to monitor ' + (i + 1).toString()});
          connectMonitorEvent(item, mw, i);
          this.addMenuItem(item);
        }
      }
      // Workspace
      if ((length = global.screen.n_workspaces) > 1) {
        if (mw.is_on_all_workspaces()) {
          item = createMenuItem({label: 'Only on this workspace'});
          item.connect('activate', function() {
            mw.unstick();
          });
          this.addMenuItem(item);
        } else {
          item = createMenuItem({label: 'Visible on all workspaces'});
          item.connect('activate', function() {
            mw.stick();
          });
          this.addMenuItem(item);

          item = new PopupMenu.PopupSubMenuMenuItem(t('Move to another workspace'));
          this.addMenuItem(item);

          let connectWorkspaceEvent = (ws, j)=>{
            ws.connect('activate', function() {
              mw.change_workspace(global.screen.get_workspace_by_index(j));
            });
          };
          for (let i = 0; i < length; i++) {
            // Make the index a local letiable to pass to function
            let j = i;
            let name = Main.workspace_names[i] ? Main.workspace_names[i] : Main._makeDefaultWorkspaceName(i);
            let ws = createMenuItem({label: name});

            if (i === this._parent._applet.currentWs) {
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

      // Places
      if (this.appId === 'nemo.desktop' || this.appId === 'nemo-home.desktop') {
        let subMenu = new PopupMenu.PopupSubMenuMenuItem(t('Places'));
        this.addMenuItem(subMenu);

        let defualtPlaces = this._listDefaultPlaces();
        let bookmarks = this._listBookmarks();
        let devices = this._listDevices();
        let places = defualtPlaces.concat(bookmarks).concat(devices);
        let handlePlaceLaunch = (item, i)=>item.connect('activate', ()=>places[i].launch());
        for (let i = 0, len = places.length; i < len; i++) {
          item = createMenuItem({label: places[i].name, icon: 'folder'});
          handlePlaceLaunch(item, i);
          this.recentMenuItems.push(item);
          subMenu.menu.addMenuItem(item);
        }
        this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
      }

      // History
      if (this.appId === 'firefox.desktop' || this.appId === 'firefox web browser.desktop') {
        let subMenu = new PopupMenu.PopupSubMenuMenuItem(t(_.find(constants.ffOptions, {id: this._applet.firefoxMenu}).label));
        this.addMenuItem(subMenu);

        let histories = getFirefoxHistory(this._applet);
        if (histories) {
          try {
            let handleHistoryLaunch = (item, i)=>item.connect('activate', ()=>Gio.app_info_launch_default_for_uri(histories[i].uri, global.create_app_launch_context()));
            for (let i = 0, len = histories.length; i < len; i++) {
              item = createMenuItem({label: histories[i].title, icon: 'go-next'});
              handleHistoryLaunch(item, i);
              this.recentMenuItems.push(item);
              subMenu.menu.addMenuItem(item);
            }
          } catch (e) {}
        }
        this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
      }

      // Recent Files
      let recentItems = this._applet.recentItems;
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
        let handleRecentLaunch = (item, i)=>item.connect('activate', ()=>Gio.app_info_launch_default_for_uri(items[i].get_uri(), global.create_app_launch_context()));
        for (let i = 0; i < itemsLength; i++) {
          item = createMenuItem({label: items[i].get_short_name(), icon: 'list-add'});
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

    item = createMenuItem({label: 'About...', icon: 'dialog-question'});
    item.connect('activate', Lang.bind(this._applet, this._applet.openAbout));
    subMenu.menu.addMenuItem(item);

    if (this._applet.configureApplet) { // Cinnamon 3.0.7 check
      item = createMenuItem({label: 'Configure...', icon: 'system-run'});
      item.connect('activate', Lang.bind(this._applet, this._applet.configureApplet));
      subMenu.menu.addMenuItem(item);
    }

    item = createMenuItem({label: 'Remove \'Icing Task Manager\'', icon: 'edit-delete'});
    item.connect('activate', Lang.bind(this, function() {
      AppletManager._removeAppletFromPanel(this._applet._uuid, this._applet.instance_id);
    }));
    subMenu.menu.addMenuItem(item);

    // Actions
    let actions = null;
    try {
      actions = this.appInfo.list_actions();
      if (this.appInfo && actions) {
        this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        let handleAction = (action)=>{
          item = createMenuItem({label: this.appInfo.get_action_name(action), icon: 'document-new'});
          item.connect('activate', ()=>this.appInfo.launch_action(action, global.create_app_launch_context()));
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
      if (this._applet.showPinned !== constants.FavType.none && !this.app.is_window_backed()) {
        if (this._parent.isFavoriteApp) {
          this.pinToggleItem = createMenuItem({label: 'Unpin from Panel', icon: 'list-remove'});
        } else {
          this.pinToggleItem = createMenuItem({label: 'Pin to Panel', icon: 'bookmark-new'});
        }
        this.pinToggleItem.connect('activate', Lang.bind(this, this._toggleFav));
        this.addMenuItem(this.pinToggleItem);
      }
      if (this._applet.autoStart) {
        if (this.autostartIndex !== -1) {
          item = createMenuItem({label: 'Remove from Autostart', icon: 'process-stop'});
          item.connect('activate', Lang.bind(this, this._toggleAutostart));
        } else {
          item = createMenuItem({label: 'Add to Autostart', icon: 'insert-object'});
          item.connect('activate', Lang.bind(this, this._toggleAutostart));
        }
        this.addMenuItem(item);
      }
    } else {
      item = createMenuItem({label: 'Create Shortcut', icon: 'list-add'});
      item.connect('activate', Lang.bind(this, this._createShortcut));
      this.addMenuItem(item);
    }
    this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

    // Window controls
    if (hasWindows) {
      // Miscellaneous
      if (mw.get_compositor_private().opacity !== 255) {
        item = createMenuItem({label: 'Restore to full opacity'});
        item.connect('activate', function() {
          mw.get_compositor_private().set_opacity(255);
        });
        this.addMenuItem(item);
      }

      if (mw.minimized) {
        item = createMenuItem({label: 'Restore', icon: 'view-sort-descending'});
        item.connect('activate', function() {
          Main.activateWindow(mw, global.get_current_time());
        });
      } else {
        item = createMenuItem({label: 'Minimize', icon: 'view-sort-ascending'});
        item.connect('activate', function() {
          mw.minimize();
        });
      }
      this.addMenuItem(item);

      if (mw.get_maximized()) {
        item = createMenuItem({label: 'Unmaximize', icon: 'view-restore'});
        item.connect('activate', function() {
          mw.unmaximize(Meta.MaximizeFlags.HORIZONTAL | Meta.MaximizeFlags.VERTICAL);
        });
      } else {
        item = createMenuItem({label: 'Maximize', icon: 'view-fullscreen'});
        item.connect('activate', function() {
          mw.maximize(Meta.MaximizeFlags.HORIZONTAL | Meta.MaximizeFlags.VERTICAL);
        });
      }
      this.addMenuItem(item);

      if (this.metaWindows.length > 1) {
        // Close others
        item = createMenuItem({label: 'Close others', icon: 'window-close'});
        item.connect('activate', Lang.bind(this, function() {
          each(this.metaWindows, (metaWindow)=>{
            if (!_.isEqual(metaWindow, mw) && !metaWindow._needsAttention) {
              metaWindow.delete(global.get_current_time());
            }
          });
        }));
        this.addMenuItem(item);
        // Close all
        item = createMenuItem({label: 'Close all', icon: 'application-exit'});
        item.connect('activate', Lang.bind(this, function() {
          if (!this._parent.isFavoriteApp) {
            this._parent.willUnmount = true;
          }
          each(this.metaWindows, (metaWindow)=>{
            if (!metaWindow._needsAttention) {
              metaWindow.delete(global.get_current_time());
            }
          });
        }));
        this.addMenuItem(item);
        this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
      } else {
        item = createMenuItem({label: 'Close', icon: 'edit-delete'});
        item.connect('activate', function() {
          mw.delete(global.get_current_time());
        });
        this.addMenuItem(item);
        this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
      }
    }
  },

  _onToggled: function(actor, isOpening) {
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

  _toggleAutostart: function(){
    if (this.autostartIndex !== -1) {
      this._applet.autostartApps[this.autostartIndex].file.delete(null);
      this._applet.removeAutostartApp(this.autostartIndex);
      this.autostartIndex = -1;
    } else {
      let filePath = this.appInfo.get_filename();
      Util.trySpawnCommandLine('bash -c "cp ' + filePath + ' ' + this._applet.autostartStrDir + '"');
      setTimeout(()=>{
        this._applet.getAutostartApps();
        this.autostartIndex = this._applet.autostartApps.length - 1;
      }, 500);
    }
  },

  _toggleFav: function (actor, event) {
    if (this._parent.isFavoriteApp) {
      this.pinnedFavorites.removeFavorite(this.appId);
      //this.pinToggleItem.label.set_text('Pin to Panel');
      //this.pinToggleItem._icon.set_icon_name('bookmark-new');
    } else {
      if (!this.app.is_window_backed()) {
        this.pinnedFavorites._addFavorite({
          appId: this.appId,
          app: this.app,
          pos: -1
        });
        //this.pinToggleItem.label.set_text('Unpin from Panel');
        //this.pinToggleItem._icon.set_icon_name('list-remove');
      }
    }
  },

  _createShortcut: function (actor, event) {
    let proc = this.app.get_windows()[0].get_pid();
    let cmd = 'bash -c "python ~/.local/share/cinnamon/applets/IcingTaskManager@json/utils.py get_process ' + proc.toString() + '"';
    Util.trySpawnCommandLine(cmd);
  },

  _listDefaultPlaces: function (pattern) {
    let defaultPlaces = Main.placesManager.getDefaultPlaces();
    let res = [];
    for (let i = 0, len = defaultPlaces.length; i < len; i++) {
      if (!pattern || defaultPlaces[i].name.toLowerCase().indexOf(pattern) != -1) {
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

  _init: function (parent) {
    this.appGroup = parent;
    this._applet = parent._applet;
    this.signals = new SignalManager.SignalManager(this);
    if (parent._applet.c32) {
      PopupMenu.PopupMenu.prototype._init.call(this, parent.actor, parent.orientation, 0.5);
    } else {
      PopupMenu.PopupMenu.prototype._init.call(this, parent.actor, 0.5, parent.orientation);
    }

    this.parentActor = parent.actor;
    this.metaWindow = parent.metaWindow;
    this.metaWindows = [];

    this.app = parent.app;
    this.isFavoriteApp = parent.isFavoriteApp;
    this.appList = parent.appList;
    this._tooltip = new Tooltips.PanelItemTooltip(parent, '', this._applet.orientation);

    this.actor.hide();
    Main.layoutManager.addChrome(this.actor, {});

    this.appSwitcherItem = new PopupMenuAppSwitcherItem(this);
    this.addMenuItem(this.appSwitcherItem);

    this.signals.connect(this.parentActor, 'enter-event', Lang.bind(this, this._onMenuEnter));
    this.signals.connect(this.parentActor, 'leave-event', Lang.bind(this, this._onMenuLeave));
    this.signals.connect(this.parentActor, 'button-release-event', Lang.bind(this, this._onButtonPress));
    this.signals.connect(this.actor, 'enter-event', Lang.bind(this, this._onMenuEnter));
    this.signals.connect(this.actor, 'leave-event', Lang.bind(this, this._onMenuLeave));
    this.signals.connect(this.actor, 'key-release-event', Lang.bind(this, this._onKeyRelease));
  },

  _onButtonPress: function () {
    if (this._applet.onClickThumbs && this.appSwitcherItem.box.get_children().length > 1) {
      return;
    }
    this.shouldClose = true;
    setTimeout(()=>this.hoverClose(), this._applet.thumbTimeout);
  },

  _onMenuEnter: function () {
    if (this._applet.panelEditMode) {
      return false;
    }
    if (this.appGroup.rightClickMenu.isOpen) {
      return false;
    }
    this.shouldClose = false;
    setTimeout(()=>this.hoverOpen(), this._applet.thumbTimeout);
  },

  _onMenuLeave: function () {
    if (this.appGroup.rightClickMenu.isOpen || this._applet.panelEditMode) {
      return false;
    }
    this.shouldClose = true;
    setTimeout(()=>this.hoverClose(), this._applet.thumbTimeout);
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

  hoverOpen: function () {
    if (!this.isOpen && !this._applet.onClickThumbs && !this.shouldClose) {
      this.open();
    }
  },

  hoverClose: function () {
    if (this.shouldClose) {
      this.close();
    }
  },

  open: function () {
    if (this.metaWindows.length === 0) {
      this._tooltip.set_text(this.appGroup.appName);
      this._tooltip.show();
    } else {
      setTimeout(()=>this.appSwitcherItem._refresh(), 0);
      PopupMenu.PopupMenu.prototype.open.call(this, this._applet.animateThumbs);
    }
  },

  close: function () {
    if (this.metaWindows.length === 0) {
      this._tooltip.set_text('');
      this._tooltip.hide();
    } else {
      PopupMenu.PopupMenu.prototype.close.call(this, this._applet.animateThumbs);
    }
  },

  destroy: function () {
    this.signals.disconnectAllSignals();
    this.removeAll();
    this.appSwitcherItem.destroy();
    PopupMenu.PopupMenu.prototype.destroy.call(this);
  },

  setMetaWindow: function (metaWindow, metaWindows) {
    // Last focused
    this.metaWindow = metaWindow;
    this.metaWindows = metaWindows;
    this.appSwitcherItem.setMetaWindow(metaWindow, metaWindows);
  }
};

// display a list of app thumbnails and allow
// bringing any app to focus by clicking on its thumbnail

function PopupMenuAppSwitcherItem () {
  this._init.apply(this, arguments);
}

PopupMenuAppSwitcherItem.prototype = {
  __proto__: PopupMenu.PopupBaseMenuItem.prototype,

  _init: function (parent) {
    PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {
      hover: false,
      activate: false
    });

    this._applet = parent._applet;
    this.settings = parent._applet.settings;
    this.metaWindow = parent.metaWindow;
    this.metaWindows = [];
    this.app = parent.app;
    this.isFavoriteApp = parent.isFavoriteApp;
    this.hoverMenu = parent;
    this.box = parent.box;
    this.actor.set_style_class_name('');
    this.box.set_style_class_name('switcher-list');

    this.appThumbnails = [];
    this._setVerticalSetting();

    this.box.connect('key-press-event', Lang.bind(this, this._onKeyPress));
  },

  _onKeyPress: function(actor, e){
    let symbol = e.get_key_symbol();
    let i = _.findIndex(this.appThumbnails, (thumbnail)=>{
      return thumbnail.entered;
    });

    let entered = i > -1;
    if (entered) {
      this.appThumbnails[i].handleLeaveEvent();
    } else {
      i = _.findIndex(this.appThumbnails, (thumbnail)=>{
        return thumbnail._hasFocus();
      });
      if (i === -1) {
        i = 0;
      }
    }
    let args;
    let closeArg;
    if (this._applet.orientation === St.Side.TOP) {
      closeArg = Clutter.KEY_Up;
      args = [Clutter.KEY_Left, Clutter.KEY_Right];
    } else if (this._applet.orientation === St.Side.BOTTOM) {
      closeArg = Clutter.KEY_Down;
      args = [Clutter.KEY_Right, Clutter.KEY_Left];
    } else if (this._applet.orientation === St.Side.LEFT) {
      closeArg = Clutter.KEY_Left;
      args = [Clutter.KEY_Up, Clutter.KEY_Down];
    } else if (this._applet.orientation === St.Side.RIGHT) {
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
      this.hoverMenu.close();
    } else if (symbol === closeArg) {
      this.hoverMenu.close();
    } else {
      return;
    }
    if (this.appThumbnails[index] !== undefined) {
      this.appThumbnails[index].handleEnterEvent();
    }
  },

  _setVerticalSetting: function () {
    if (this._applet.orientation === St.Side.TOP || this._applet.orientation === St.Side.BOTTOM) {
      this.box.vertical = this._applet.verticalThumbs;
    } else {
      this.box.vertical = true;
    }
  },

  setMetaWindow: function (metaWindow, metaWindows) {
    this.metaWindow = metaWindow;
    this.metaWindows = metaWindows;
    if (this.metaWindowThumbnail !== undefined && this.metaWindowThumbnail) {
      this.metaWindowThumbnail.setMetaWindow(metaWindow, metaWindows);
    }
    for (let w = 0, len = this.appThumbnails.length; w < len; w++) {
      this.appThumbnails[w].setMetaWindow(null, metaWindows);
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
        metaWindow: metaWindow,
        metaWindows: metaWindows
      });
      this.box.insert_actor(this.metaWindowThumbnail.actor, 0);
      setTimeout(()=>this.setStyleOptions(null), 0);
      // Update appThumbnails to remove old programs
      this.removeStaleWindowThumbnails(metaWindows);
    }
    return isPinned;

  },

  _refresh: function (refreshThumbnails) {
    // Check to see if this.metaWindow has changed.  If so, we need to recreate
    // our thumbnail, etc.
    // Get a list of all windows of our app that are running in the current workspace
    let windows = this.metaWindows;


    if (this.metaWindowThumbnail && this.metaWindowThumbnail != null) {
      this.metaWindowThumbnail = null;
    }
    if (this.metaWindowThumbnail && _.isEqual(this.metaWindowThumbnail.metaWindow, this.metaWindow)) {
      this.metaWindowThumbnail._isFavorite(this.isFavoriteApp);
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
    setTimeout(()=>this.setStyleOptions(windows), 0);
    if (refreshThumbnails) {
      for (let i = 0, len = this.appThumbnails.length; i < len; i++) {
        this.appThumbnails[i]._refresh(windows[0], windows);
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
      metaWindows = this.metaWindows;
    }
    if (metaWindows.length > 0) {
      let children = this.box.get_children();
      for (let w = 0, len = children.length; w < len; w++) {
        this.box.remove_actor(children[w]);
      }
      this.reAdd = true;
    }

    for (let i = 0, len = metaWindows.length; i < len; i++) {
      let metaWindow = metaWindows[i];
      let refThumb = _.findIndex(this.appThumbnails, {metaWindow: metaWindow});
      if (!this.appThumbnails[i] && refThumb === -1) {
        if (this.metaWindowThumbnail) {
          this.metaWindowThumbnail.destroy(true);
        }
        let thumbnail = new WindowThumbnail({
          parent: this,
          metaWindow: metaWindow,
          metaWindows: metaWindows
        });
        thumbnail.setMetaWindow(metaWindow, metaWindows);
        this.appThumbnails.push(thumbnail);
      }
    }
    if (this._applet.sortThumbs) {
      this.appThumbnails = _.orderBy(this.appThumbnails, (thumbnail)=>{
        return thumbnail.metaWindow.user_time;
      }, ['desc']);
    }
    each(this.appThumbnails, (thumbnail, i)=>{
      this.box.insert_actor(thumbnail.actor, i);
    });
    this.box.show();
  },
  setStyleOptions: function (windows) {
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
    if (windows === null) {
      return;
    }
    for (let i = 0, len = this.appThumbnails.length; i < len; i++) {
      if (this.appThumbnails[i]) {
        this.appThumbnails[i].thumbnailIconSize();
      }
    }
  },

  removeStaleWindowThumbnails: function (windows) {
    for (let i = 0, len = this.appThumbnails.length; i < len; i++) {
      if (this.appThumbnails[i] !== undefined && windows.indexOf(this.appThumbnails[i].metaWindow) === -1) {
        if (this.appThumbnails[i]) {
          this.box.remove_actor(this.appThumbnails[i].actor);
          this.appThumbnails[i].destroy();
        }
        _.pullAt(this.appThumbnails, i);
      }
    }
  },

  destroy: function(){
    if (this.metaWindowThumbnail && this.metaWindowThumbnail != null) {
      this.metaWindowThumbnail.destroy();
    }
    for (let w = 0, len = this.appThumbnails.length; w < len; w++) {
      if (this.appThumbnails[w] !== undefined) {
        this.appThumbnails[w].destroy(true);
      }
    }
  }
};

function WindowThumbnail () {
  this._init.apply(this, arguments);
}

WindowThumbnail.prototype = {
  _init: function (params) {
    this.appSwitcherItem = params.parent;
    this._applet = this.appSwitcherItem._applet;
    this.settings = this._applet.settings;
    this.metaWindow = params.metaWindow || null;
    this.metaWindows = params.metaWindows;
    this.app = this.appSwitcherItem.app;
    this.isFavoriteApp = this.appSwitcherItem.isFavoriteApp || false;
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
    this.actor._delegate = this;
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

    if (this._applet.thumbCloseBtnStyle) {
      this.button.style_class = 'window-close';
      this.button.width = 16;
      this.button.height = 16;
      this.button.style = 'padding: 0px; width: 8px; height: 8px; max-width: 8px; max-height: 8px; -cinnamon-close-overlap: 0px; background-position: 0px -2px; background-size: 16px 16px;';
    } else {
      this.button.style_class = 'thumbnail-close';
    }

    this.button.hide();
    this.bin.add_actor(this._container);
    this.bin.add_actor(this.button);
    this.actor.add_actor(this.bin);
    this.actor.add_actor(this.thumbnailActor);

    this._isFavorite(this.isFavoriteApp, this.metaWindow, this.metaWindows);

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
      this._hoverPeek(this._applet.peekOpacity, this.metaWindow, true);
      this.actor.add_style_pseudo_class('outlined');
      this.actor.add_style_pseudo_class('selected');
      this.button.show();
      if (this.metaWindow.minimized && this._applet.enablePeek  && this.appSwitcherItem.hoverMenu.appGroup.appName !== 'Steam') {
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

  handleLeaveEvent: function(){
    this.entered = false;
    if (!this.isFavoriteApp) {
      this._hoverPeek(constants.OPACITY_OPAQUE, this.metaWindow, false);
      this.actor.remove_style_pseudo_class('outlined');
      this._focusWindowChange();
      this.button.hide();
      if (this.wasMinimized) {
        this.metaWindow.minimize();
      }
    }
  },

  setMetaWindow: function (metaWindow, metaWindows) {
    if (metaWindow) {
      this.metaWindow = metaWindow;
    }
    this.metaWindows = metaWindows;
  },

  _onWindowDemandsAttention: function (window) {
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

  _focusWindowChange: function () {
    if (this._hasFocus()) {
      this.actor.set_style_pseudo_class('selected');
    } else {
      this.actor.remove_style_pseudo_class('selected');
    }
  },

  _hasFocus: function () {
    if (!this.metaWindow
      || this.metaWindow.minimized) {
      return false;
    }

    if (this.metaWindow.appears_focused) {
      return true;
    }

    let transientHasFocus = false;
    this.metaWindow.foreach_transient(function (transient) {
      if (transient.appears_focused) {
        transientHasFocus = true;
        return false;
      }
      return true;
    });
    return transientHasFocus;
  },

  _isFavorite: function (isFav) {
    this.isFavoriteApp = isFav;

    if (this.metaWindows.length > 0) {
      this.actor.style = null;
      setTimeout(()=>this.thumbnailPaddingSize(), 0);
      this._refresh(this.metaWindow, this.metaWindows);
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
    if (this.metaWindows.length === 1) {
      this.appSwitcherItem.hoverMenu.close();
    }
  },

  _onCloseButtonRelease: function (actor, event) {
    let button = event.get_button();
    if (button === 1 && _.isEqual(actor, this.button)) {
      this.handleAfterClick();
    }
  },

  _connectToWindow: function (actor, event) {
    if (this.metaWindows.length === 0) {
      return false;
    }
    this.wasMinimized = false;
    let button = event.get_button();
    if (button === 1 && !this.stopClick && !this.isFavoriteApp) {
      Main.activateWindow(this.metaWindow, global.get_current_time());
      this.appSwitcherItem.hoverMenu.close();
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
    metaWindows = metaWindows ? metaWindows : this.metaWindows;
    if (!this.metaWindow) {
      return false;
    }

    // Turn favorite tooltip into a normal thumbnail
    let monitor = Main.layoutManager.primaryMonitor;

    let setThumbSize = (divider=70, offset=16)=>{
      this.thumbnailWidth = Math.floor((monitor.width / divider) * this._applet.thumbSize) + offset;
      this.thumbnailHeight = Math.floor((monitor.height / divider) * this._applet.thumbSize) + offset;

      let monitorSize, thumbnailSize;
      if (this._applet.verticalThumbs) {
        monitorSize = monitor.height;
        thumbnailSize = this.thumbnailHeight;
      } else {
        monitorSize = monitor.width;
        thumbnailSize = this.thumbnailWidth;
      }

      if (this.metaWindows.length === 0) {
        metaWindows = this.app.get_windows();
      }

      if ((thumbnailSize * metaWindows.length) + thumbnailSize > monitorSize) {
        let divideMultiplier = this._applet.verticalThumbs ? 3 : 1.1;
        setThumbSize(divider * divideMultiplier, 16);
        return;
      } else {
        this.thumbnailActor.width = this.thumbnailWidth;
        this._container.style = 'width: ' + Math.floor(this.thumbnailWidth - 16) + 'px;';
        if (this._applet.verticalThumbs && this._applet.showThumbs) {
          this.thumbnailActor.height = this.thumbnailHeight;
        } else if (this._applet.verticalThumbs) {
          this.thumbnailActor.height = 0;
        }

        this.isFavoriteApp = false;

        // Replace the old thumbnail
        this._label.text = this.metaWindow.get_title();
        if (this._applet.showThumbs) {
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
    if (!this._applet.enablePeek) {
      return;
    }

    const setOpacity = (window_actor, target_opacity) => {
      Tweener.addTween(window_actor, {
        time: this._applet.peekTime * 0.001,
        transition: 'easeOutQuad',
        opacity: target_opacity
      });
    };
    let monitorOrigin = metaWin.get_monitor();
    let wa = global.get_window_actors();
    for (let i = 0, len = wa.length; i < len; i++) {
      let waWin = wa[i].get_meta_window();
      if (metaWin === waWin || waWin.get_monitor() !== monitorOrigin) {
        continue;
      }

      if (waWin.get_window_type() !== Meta.WindowType.DESKTOP) {
        setOpacity(wa[i], opacity);
      }
    }
  },

  destroy: function(){
    this.willUnmount = true;
    this.signals.disconnectAllSignals();
    let refThumb = _.findIndex(this.appSwitcherItem.appThumbnails, (thumb)=>{
      return _.isEqual(thumb.metaWindow, this.metaWindow);
    });
    if (refThumb !== -1) {
      _.pullAt(this.appSwitcherItem.appThumbnails, refThumb);
    }
    try {
      this._container.destroy_children();
    } catch (e) {}
    this._container.destroy();
    try {
      this.bin.destroy_children();
    } catch (e) {}
    this.bin.destroy();
    try {
      this.actor.destroy_children();
    } catch (e) {}
    this.actor.destroy();
  }
};
