const Clutter = imports.gi.Clutter;
const Lang = imports.lang;
const St = imports.gi.St;
const Main = imports.ui.main;
const Tweener = imports.ui.tweener;
const PopupMenu = imports.ui.popupMenu;
const Signals = imports.signals;
const DND = imports.ui.dnd;

const AppletDir = imports.ui.appletManager.applets['IcingTaskManager@json'];

const _ = AppletDir.lodash._;
const App = AppletDir.applet;
const SpecialMenus = AppletDir.specialMenus;
const SpecialButtons = AppletDir.specialButtons;
const constants = AppletDir.constants.constants;
const setTimeout = AppletDir.timers.setTimeout;

function AppGroup () {
  this._init.apply(this, arguments);
}

AppGroup.prototype = {
  __proto__: Object.prototype,
  _init: function (applet, appList, app, isFavapp, window, timeStamp, ungroupedIndex, appId) {
    appId = appId ? appId : '';
    if (DND.LauncherDraggable) {
      DND.LauncherDraggable.prototype._init.call(this);
    }

    this._applet = applet;
    this.appList = appList;

    this._deligate = this;
    // This convert the applet class in a launcherBox (is requiered to be a launcher dragable object)
    // but you have duplicate object this._applet then... // TBD
    this.launchersBox = applet;
    this.app = app;
    this.appId = appId;
    this.appName = this.app.get_name();
    this.autostartIndex = _.findIndex(this._applet.autostartApps, {id: appId});
    this.isFavapp = isFavapp;
    this.wasFavapp = false;
    this.orientation = applet.orientation;

    this.metaWindows = this._applet.groupApps ? [] : [window];
    this.timeStamp = timeStamp;
    this.ungroupedIndex = ungroupedIndex;
    this.lastFocused = null;
    this.willUnmount = false;

    this.actor = new St.Bin({
      reactive: true,
      can_focus: true,
      x_fill: true,
      y_fill: false,
      track_hover: true
    });
    this.signals = {
      _appButton: [],
      _draggable: []
    };
    this.metaWorkspacesSignals = [];

    this.appList.manager_container.add_actor(this.actor);

    this.actor._delegate = this;

    this._appButton = new SpecialButtons.AppButton(this);

    this.actor.add_actor(this._appButton.actor);

    this.signals._appButton.push(this._appButton.actor.connect('button-release-event', Lang.bind(this, this._onAppButtonRelease)));
    this.signals._appButton.push(this._appButton.actor.connect('button-press-event', Lang.bind(this, this._onAppButtonPress)));

    // Initialized in _windowAdded first for open apps, then deferred here for init speed up.
    setTimeout(()=>{
      if (this.isFavapp) {
        this.rightClickMenu = new SpecialMenus.AppMenuButtonRightClickMenu(this, this.lastFocused, [this.lastFocused], this._applet.orientation);
        this._menuManager = new PopupMenu.PopupMenuManager(this);
        this._menuManager.addMenu(this.rightClickMenu);
        this.rightClickMenu.setMetaWindow(this.lastFocused, this.metaWindows);
      }
    }, 500);

    // Set up the hover menu for this._appButton
    this.hoverMenu = new SpecialMenus.AppThumbnailHoverMenu(this);
    this._hoverMenuManager = new SpecialMenus.HoverMenuController(this);
    this._hoverMenuManager.addMenu(this.hoverMenu);

    this._draggable = SpecialButtons.makeDraggable(this.actor);

    this.signals._draggable.push(this._draggable.connect('drag-begin', Lang.bind(this, this._onDragBegin)));
    this.signals._draggable.push(this._draggable.connect('drag-cancelled', Lang.bind(this, this._onDragCancelled)));
    this.signals._draggable.push(this._draggable.connect('drag-end', Lang.bind(this, this._onDragEnd)));
    this.isDraggableApp = true;

    this.on_panel_edit_mode_changed();
    this.on_arrange_pinned();
    this.panelEditId = global.settings.connect('changed::panel-edit-mode', Lang.bind(this, this.on_panel_edit_mode_changed));
    this.arrangePinnedId = this._applet.settings.connect('changed::arrange-pinnedApps', Lang.bind(this, this.on_arrange_pinned));
  },

  getId: function () {
    return this.appId;
  },

  on_arrange_pinned: function () {
    this._draggable.inhibit = !this._applet.settings.getValue('arrange-pinnedApps');
  },

  on_panel_edit_mode_changed: function () {
    this._draggable.inhibit = global.settings.get_boolean('panel-edit-mode');
    this.actor.reactive = !global.settings.get_boolean('panel-edit-mode');
  },

  on_title_display_changed: function (metaWindow) {
    this._windowTitleChanged(metaWindow);
    let titleType = this._applet.settings.getValue('title-display');
    if (titleType === constants.TitleDisplay.Title) {
      this.showAppButtonLabel(true);
    } else if (titleType === constants.TitleDisplay.App) {
      this.showAppButtonLabel(true);
    } else if (titleType === constants.TitleDisplay.None) {
      this.hideAppButtonLabel(true);
    }
  },

  _onDragBegin: function() {
    if (this._applet.orientation === St.Side.TOP || this._applet.orientation === St.Side.BOTTOM) {
      this._draggable._overrideY = this.actor.get_transformed_position()[1];
      this._draggable._overrideX = null;
    } else {
      this._draggable._overrideX = this.actor.get_transformed_position()[0];
      this._draggable._overrideY = null;
    }
  },

  _onDragEnd: function () {
    this.rightClickMenu.close(false);
    this.hoverMenu.close(false);
    this.appList._fixAppGroupIndexAfterDrag(this.appId);
    this._applet._clearDragPlaceholder();
  },

  _onDragCancelled: function () {
    this.rightClickMenu.close(false);
    this.hoverMenu.close(false);
    this._applet._clearDragPlaceholder();
  },

  handleDragOver: function (source, actor, x, y, time) {
    let IsLauncherDraggable = null;
    if (DND.LauncherDraggable) {
      IsLauncherDraggable = source instanceof DND.LauncherDraggable;
    }
    if (source instanceof AppGroup || source.isDraggableApp || IsLauncherDraggable) {
      return DND.DragMotionResult.CONTINUE;
    }

    if (typeof this.appList.dragEnterTime === 'undefined') {
      this.appList.dragEnterTime = time;
    } else {
      if (time > (this.appList.dragEnterTime + 3000)) {
        this.appList.dragEnterTime = time;
      }
    }

    if (time > (this.appList.dragEnterTime + 300) && !(this.isFavapp || source.isDraggableApp)) {
      this._windowHandle(true);
    }
    return true;
  },

  getDragActor: function () {
    return this.app.create_icon_texture(this._applet._panelHeight);
  },

  // Returns the original actor that should align with the actor
  // we show as the item is being dragged.
  getDragActorSource: function () {
    return this.actor;
  },

  // Add a workspace to the list of workspaces that are watched for
  // windows being added and removed
  watchWorkspace: function (metaWorkspace) {
    var refWs = _.findIndex(this.metaWorkspacesSignals, (ws)=>{
      return _.isEqual(ws.workspace, metaWorkspace);
    });
    if (refWs === -1) {
      // We use connect_after so that the window-tracker time to identify the app, otherwise get_window_app might return null!
      let windowAddedSignal = metaWorkspace.connect_after('window-added', (metaWorkspace, metaWindow)=>this._windowAdded(metaWorkspace, metaWindow));
      let windowRemovedSignal = metaWorkspace.connect_after('window-removed', Lang.bind(this, this._windowRemoved));
      // Workspace is cached so the signals are disconnected reliably in unwatchWorkspace.
      this.metaWorkspacesSignals.push({
        workspace: metaWorkspace,
        signals: [windowAddedSignal, windowRemovedSignal]
      });
    }
    this._calcWindowNumber(metaWorkspace);
    this.numDisplaySignal = this._applet.settings.connect('changed::number-display', ()=>{
      this._calcWindowNumber(metaWorkspace);
    });
  },

  // Stop monitoring a workspace for added and removed windows.
  // @metaWorkspace: if null, will remove all signals
  unwatchWorkspace: function (metaWorkspace, unmount) {
    unmount = unmount ? unmount : false;
    if (!metaWorkspace) {
      let removeSignals = (obj)=> {
        let signals = obj.signals;
        for (let i = 0, len = signals.length; i < len; i++) {
          obj.workspace.disconnect(signals[i]);
        }
      };
      for (let i = 0, len = this.metaWorkspacesSignals.length; i < len; i++) {
        removeSignals(this.metaWorkspacesSignals[i]);
        _.pullAt(this.metaWorkspacesSignals, i);
      }
    }
  },

  hideAppButton: function () {
    this._appButton.actor.hide();
  },

  showAppButton: function () {
    this._appButton.actor.show();
  },

  hideAppButtonLabel: function (animate) {
    this._appButton.hideLabel(animate);
  },

  showAppButtonLabel: function (animate, targetWidth) {
    this._appButton.showLabel(animate, targetWidth);
  },

  // TBD: share the _appButton._numLabel with "window number display"
  showOrderLabel: function (number){
    var label = this._appButton._numLabel;
    label.text = number + 1;
    label.show();
  },

  hideOrderLabel: function (){
    this._calcWindowNumber(this.appList.metaWorkspace);
  },

  _onAppButtonRelease: function(actor, event) {
    this._applet._clearDragPlaceholder();
    var button = event.get_button();

    if (button === 1 && this.isFavapp || button === 2) {
      if (button === 2 && !this._applet.middleClickAction && this.lastFocused) {
        this.lastFocused.delete(global.get_current_time());
        return;
      }
      this.app.open_new_window(-1);
      this._animate();
      return;
    }

    let appWindows = this._applet.groupApps ? this.app.get_windows() : [this.metaWindows[0].win];
    let appWindowsLen = appWindows.length;

    var handleMinimizeToggle = (win)=>{
      if (this._applet.onClickThumbs && appWindowsLen > 1) {
        if (this.hoverMenu.isOpen) {
          this.hoverMenu.close();
        } else {
          this.hoverMenu.open();
        }
        return;
      }
      if (win.appears_focused) {
        win.minimize();
      } else {
        Main.activateWindow(win, global.get_current_time());
      }
    };

    if (button === 1) {
      this.hoverMenu.shouldOpen = false;
      if (this.rightClickMenu.isOpen) {
        this.rightClickMenu.toggle();
      }
      if (appWindows.length === 1) {
        handleMinimizeToggle(appWindows[0]);
      } else {
        var actionTaken = false;
        for (let i = 0, len = appWindows.length; i < len; i++) {
          if (this.lastFocused && appWindows[i]._lgId === this.lastFocused._lgId) {
            handleMinimizeToggle(appWindows[i]);
            actionTaken = true;
            break;
          }
        }
        if (!actionTaken) {
          handleMinimizeToggle(appWindows[0]);
        }
      }

    } else if (button === 3) {
      this.appList._closeAllRightClickMenus(()=>{
        this.appList._closeAllHoverMenus(()=>{
          this.rightClickMenu.open();
        });
      });
    }
  },

  _onAppButtonPress: function(actor, event){
    var button = event.get_button();
    if (button === 3) {
      return true;
    }
    return false;
  },

  _onAppKeyPress: function () {
    if (this.isFavapp) {
      this.app.open_new_window(-1);
      this._animate();
    } else {
      if (this.metaWindows.length > 1) {
        this.hoverMenu.open(true);
      } else {
        this.appList._closeAllHoverMenus();
      }
      this._windowHandle(false);
    }
  },

  _onNewAppKeyPress: function (number) {
    this.app.open_new_window(-1);
    this._animate();
  },

  _windowHandle: function (fromDrag) {
    let has_focus = this.lastFocused.has_focus();
    if (!this.lastFocused.minimized && !has_focus) {
      this.lastFocused.foreach_transient(function (child) {
        if (!child.minimized && child.has_focus()) {
          has_focus = true;
        }
      });
    }

    if (has_focus) {
      if (fromDrag) {
        return;
      }
      if (this.metaWindows.length > 1) {
        var nextWindow = null;
        for (let i = 0, max = this.metaWindows.length - 1; i < max; i++) {
          if (this.metaWindows[i].win._lgId === this.lastFocused._lgId) {
            nextWindow = this.metaWindows[i + 1].win;
            break;
          }
        }
        if (nextWindow === null){
          nextWindow = this.metaWindows[0].win;
        }
        Main.activateWindow(nextWindow, global.get_current_time());
      } else {
        this.lastFocused.minimize();
        this.actor.remove_style_pseudo_class('focus');
      }
    } else {
      if (this.lastFocused.minimized) {
        this.lastFocused.unminimize();
      }
      let ws = this.lastFocused.get_workspace().index();
      if (ws != global.screen.get_active_workspace_index()) {
        global.screen.get_workspace_by_index(ws).activate(global.get_current_time());
      }
      Main.activateWindow(this.lastFocused, global.get_current_time());
      this.actor.add_style_pseudo_class('focus');
    }
  },
  _getLastFocusedWindow: function () {
    return this.lastFocused;
  },

  // updates the internal list of metaWindows
  // to include all windows corresponding to this.app on the workspace
  // metaWorkspace
  _updateMetaWindows: function (metaWorkspace, app, window, _wsWindows) {
    // Get a list of all interesting windows that are part of this app on the current workspace
    var wsWindows = _wsWindows ? _wsWindows : metaWorkspace.list_windows();
    var windowsSource = window ? [window] : wsWindows;

    var filterArgs = _.isEqual(app, this.app);
    var windowList = _.filter(windowsSource, (win)=>{
      if (!app) {
        app = this._applet.getAppFromWMClass(this.appList.specialApps, win);
        if (!app) {
          app = this._applet.tracker.get_window_app(win);
        }
      }
      if (!this._applet.includeAllWindows) {
        filterArgs = filterArgs && this._applet.tracker.is_window_interesting(win);
      }
      return _.isEqual(app, this.app);
    });

    this.metaWindows = [];

    for (let i = 0, len = windowList.length; i < len; i++) {
      this._windowAdded(metaWorkspace, windowList[i], windowList);
    }

    if (this.lastFocused && _.isObject(this.lastFocused)) {
      if (this.rightClickMenu !== undefined) {
        this.rightClickMenu.setMetaWindow(this.lastFocused, this.metaWindows);
      }
    }
  },

  _windowAdded: function (metaWorkspace, metaWindow, metaWindows, recursion) {
    recursion = recursion ? recursion : 0;

    let app = this._applet.getAppFromWMClass(this.appList.specialApps, metaWindow);
    if (!app) {
      app = this._applet.tracker.get_window_app(metaWindow);
    }

    if (!app) {
      return;
    }

    var refWindow = _.findIndex(this.metaWindows, (win)=>{
      return _.isEqual(win.win, metaWindow);
    });
    var windowAddArgs = _.isEqual(app, this.app) && refWindow === -1;
    if (!this._applet.includeAllWindows) {
      windowAddArgs = windowAddArgs && this._applet.tracker.is_window_interesting(metaWindow);
    }
    if (windowAddArgs) {
      if (metaWindow) {
        if (!this._applet.groupApps && this.metaWindows.length >= 1) {
          if (this.ungroupedIndex === 0) {
            this.appList._windowAdded(metaWorkspace, metaWindow, null, this.isFavapp, true);
          }
          return;
        }
        this.lastFocused = metaWindow;

        let signals = [];
        signals.push(metaWindow.connect('notify::title', Lang.bind(this, this._windowTitleChanged)));
        signals.push(metaWindow.connect('notify::appears-focused', Lang.bind(this, this._focusWindowChange)));

        // Set the initial button label as not all windows will get updated via signals initially.
        this._windowTitleChanged(metaWindow);

        let data = {
          signals: signals
        };

        this.metaWindows.push({
          win: metaWindow,
          data: data
        });

        if (this._applet.showActive) {
          this._appButton.setActiveStatus(this.metaWindows);
        }

        // Instead of initializing rightClickMenu in _init right away, we'll prevent the exception caused by its absence and then initialize it. This speeds up init time, and fixes the monitor move options not appearing on first init.
        if (this.rightClickMenu !== undefined) {
          this.rightClickMenu.setMetaWindow(this.lastFocused, this.metaWindows);
        } else {
          this.rightClickMenu = new SpecialMenus.AppMenuButtonRightClickMenu(this, metaWindow, metaWindows, this._applet.orientation);
          this._menuManager = new PopupMenu.PopupMenuManager(this);
          this._menuManager.addMenu(this.rightClickMenu);
          this.rightClickMenu.setMetaWindow(this.lastFocused, this.metaWindows);
        }

        this.hoverMenu.setMetaWindow(this.lastFocused, this.metaWindows);
        this.hoverMenu.appSwitcherItem._refreshThumbnails();
        this._appButton.setMetaWindow(this.lastFocused, this.metaWindows);
      }

      if (this.isFavapp) {
        this._isFavorite(!this.isFavapp);
      }

      this._calcWindowNumber(metaWorkspace);
    }
  },

  _windowRemoved: function (metaWorkspace, metaWindow) {
    var refWindow = _.findIndex(this.metaWindows, (win)=>{
      return _.isEqual(win.win, metaWindow);
    });

    if (refWindow !== -1) {
      if (!this._applet.groupApps) {
        if (!this.wasFavapp) {
          this.appList._removeApp(this.app, this.timeStamp);
        } else {
          this._applet.refreshAppFromCurrentListById(this.appId, {favChange: true, isFavapp: this.wasFavapp});
        }
        return;
      } else {
        // Clean up all the signals we've connected
        for (let i = 0, len = this.metaWindows[refWindow].data.signals.length; i < len; i++) {
          this.metaWindows[refWindow].win.disconnect(this.metaWindows[refWindow].data.signals[i]);
        }
      }

      _.pullAt(this.metaWindows, refWindow);

      if (this.metaWindows.length > 0) {
        this.lastFocused = _.last(this.metaWindows).win;
        this._windowTitleChanged(this.lastFocused);
        this.hoverMenu.setMetaWindow(this.lastFocused, this.metaWindows);
        /*
          Workaround for #86 - https://github.com/jaszhix/icingtaskmanager/issues/86
          this.hoverMenu.setMetaWindow is being called after this.hoverMenu.open calls
          this.hoverMenu.appSwitcherItem._refresh with an outdated metaWindows cache. Better fix TBD.
        */
        this.hoverMenu.appSwitcherItem.removeStaleWindowThumbnails(_.map(this.metaWindows, 'win'));

        if (this.rightClickMenu !== undefined) {
          this.rightClickMenu.setMetaWindow(this.lastFocused, this.metaWindows);
        }
        this.hoverMenu.appSwitcherItem._refreshThumbnails();
        this._appButton.setMetaWindow(this.lastFocused, this.metaWindows);
      } else {
        this.appList._onAppWindowsChanged(this.app, ()=>{
          if (this.isFavapp) {
            this._applet.refreshAppFromCurrentListById(this.appId, {favChange: true, isFavapp: this.isFavapp});
          }
        });
      }

      this._calcWindowNumber(metaWorkspace);
    }
  },

  _windowTitleChanged: function (metaWindow) {
    if (this.willUnmount) {
      return false;
    }
    // We only really want to track title changes of the last focused app
    if (!this._appButton) {
      throw 'Error: got a _windowTitleChanged callback but this._appButton is undefined';
    }
    if (!_.isEqual(metaWindow, this.lastFocused) || this.isFavapp) {
      return;
    }
    let titleType = this._applet.settings.getValue('title-display');

    var title = metaWindow.get_title();
    this.appName = this.app.get_name();

    if (titleType === constants.TitleDisplay.None || (this._applet.c32 && (this.orientation === St.Side.LEFT || this.orientation === St.Side.RIGHT))) {
      this._appButton.setText('');
    } else if (titleType === constants.TitleDisplay.Title) {
      if (title) {
        this._appButton.setText(title);
        this.showAppButtonLabel(true);
      }
    } else if (titleType === constants.TitleDisplay.Focused) {
      if (title) {
        this._appButton.setText(title);
        this._updateFocusedStatus(true);
      }
    } else if (titleType === constants.TitleDisplay.App) {
      if (this.appName) {
        this._appButton.setText(this.appName);
        this.showAppButtonLabel(true);
      }
    }
  },

  _focusWindowChange: function (metaWindow) {
    if (metaWindow.appears_focused) {
      this.appList._setLastFocusedApp(this.appId);
      this.lastFocused = metaWindow;
      this._windowTitleChanged(this.lastFocused);
      if (this._applet.sortThumbs) {
        this.hoverMenu.setMetaWindow(this.lastFocused, this.metaWindows);
      }
      if (this.rightClickMenu !== undefined) {
        this.rightClickMenu.setMetaWindow(this.lastFocused, this.metaWindows);
      }
    }
    if (this._applet.settings.getValue('title-display') === constants.TitleDisplay.Focused) {
      this._updateFocusedStatus();
    }
  },

  _updateFocusedStatus: function (force) {
    let focusState;
    for (let i = 0, len = this.metaWindows.length; i < len; i++) {
      if (this.metaWindows[i].win.appears_focused) {
        focusState = this.metaWindows[i].win;
        break;
      }
    }
    if (this.focusState != focusState || force) {
      this._focusedLabel(focusState);
    }
    this.focusState = focusState;
  },

  _focusedLabel: function (focusState) {
    if (focusState) {
      this.showAppButtonLabel(true);
    } else {
      this.hideAppButtonLabel(true);
    }
  },

  _isFavorite: function (isFav) {
    this.isFavapp = isFav;
    this.wasFavapp = !isFav;
    this._appButton._isFavorite(isFav);
    this.hoverMenu.appSwitcherItem._isFavorite(isFav);
    this._windowTitleChanged(this.lastFocused);
  },

  _calcWindowNumber: function (metaWorkspace) {
    if (this.willUnmount) {
      return false;
    }

    if (!this._appButton) {
      console.log('Error: got a _calcWindowNumber callback but this._appButton is undefined');
    }

    let windowNum = this.metaWindows.length;

    let numDisplay = this._applet.settings.getValue('number-display');
    this._appButton._numLabel.text = windowNum.toString();
    if (numDisplay === constants.NumberDisplay.Smart) {
      if (windowNum <= 1) {
        this._appButton._numLabel.hide();
      } else {
        this._appButton._numLabel.show();
      }
    } else if (numDisplay === constants.NumberDisplay.Normal) {
      if (windowNum <= 0) {
        this._appButton._numLabel.hide();
      }
      else {
        this._appButton._numLabel.show();
      }
    } else if (numDisplay === constants.NumberDisplay.All) {
      this._appButton._numLabel.show();
    } else {
      this._appButton._numLabel.hide();
    }
  },

  _animate: function () {
    this.actor.set_z_rotation_from_gravity(0.0, Clutter.Gravity.CENTER);
    Tweener.addTween(this.actor, {
      opacity: 70,
      time: 1.0,
      transition: 'linear',
      onCompleteScope: this,
      onComplete: function () {
        Tweener.addTween(this.actor, {
          opacity: 255,
          time: 0.5,
          transition: 'linear'
        });
      }
    });
  },

  destroy: function (skip=false) {
    this.willUnmount = true;
    // Unwatch all workspaces before we destroy all our actors
    // that callbacks depend on

    var destroyWindowSignal = (metaWindow)=>{
      for (let i = 0, len = metaWindow.data.signals.length; i < len; i++) {
        metaWindow.win.disconnect(metaWindow.data.signals[i]);
      }
    };

    for (let i = 0, len = this.metaWindows.length; i < len; i++) {
      destroyWindowSignal(this.metaWindows[i]);
    }
    for (let i = 0, len = this.signals._appButton.length; i < len; i++) {
      this._appButton.actor.disconnect(this.signals._appButton[i]);
    }
    for (let i = 0, len = this.signals._draggable.length; i < len; i++) {
      this._draggable.disconnect(this.signals._draggable[i]);
    }
    this._applet.settings.disconnect(this.numDisplaySignal);
    global.settings.disconnect(this.panelEditId);
    this._applet.settings.disconnect(this.arrangePinnedId);

    this.unwatchWorkspace(null, true);

    if (this.rightClickMenu) {
      this.rightClickMenu.destroy();
    }

    this.hoverMenu.destroy();
    this._appButton.destroy();
    this.appList.manager_container.remove_actor(this.actor);
    this.actor.destroy();
  }
};
Signals.addSignalMethods(AppGroup.prototype);