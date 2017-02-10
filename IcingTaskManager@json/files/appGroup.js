'use strict';

var importObj = typeof cimports !== 'undefined' ? cimports : imports;
var Clutter = imports.gi.Clutter;
var Lang = imports.lang;
var St = imports.gi.St;
var Main = importObj.ui.main;
var Tweener = importObj.ui.tweener;
var PopupMenu = importObj.ui.popupMenu;
var Signals = imports.signals;
var DND = importObj.ui.dnd;
//const setTimeout = importObj.applet.setTimeout

// Load our applet so we can access other files in our extensions dir as libraries
var AppletDir = typeof cimports !== 'undefined' ? cimports.applets['IcingTaskManager@json'] : importObj.ui.appletManager.applets['IcingTaskManager@json'];
var _ = AppletDir.lodash._;
var App = AppletDir.applet;
var SpecialMenus = AppletDir.specialMenus;
var SpecialButtons = AppletDir.specialButtons;
var clog = AppletDir.__init__.clog;
var setTimeout = AppletDir.__init__.setTimeout;

var DEFERRED_APPS = ['spotify', 'libreoffice'];

function AppGroup() {
  this._init.apply(this, arguments);
}

/*



MyApplet._init, signal (switch-workspace) -> _onSwitchWorkspace -> AppList._init, on_orientation_changed  -> _refreshList -> _loadFavorites, _refreshApps -> _windowAdded -> AppGroup



*/

AppGroup.prototype = {
  __proto__: Object.prototype,
  _init: function _init(applet, appList, app, isFavapp) {
    var window = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : null;
    var timeStamp = arguments.length > 5 && arguments[5] !== undefined ? arguments[5] : null;

    var _this = this;

    var ungroupedIndex = arguments.length > 6 && arguments[6] !== undefined ? arguments[6] : null;
    var appId = arguments.length > 7 && arguments[7] !== undefined ? arguments[7] : '';

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
    this.autostartIndex = _.findIndex(this._applet.autostartApps, { id: appId });
    this.isFavapp = isFavapp;
    this.orientation = applet.orientation;

    this.metaWindows = this._applet.groupApps ? [] : [window];
    this.timeStamp = timeStamp;
    this.ungroupedIndex = ungroupedIndex;

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
    setTimeout(function () {
      if (_this.isFavapp) {
        _this.rightClickMenu = new SpecialMenus.AppMenuButtonRightClickMenu(_this, _this.lastFocused, [_this.lastFocused], _this._applet.orientation);
        _this._menuManager = new PopupMenu.PopupMenuManager(_this);
        _this._menuManager.addMenu(_this.rightClickMenu);
        _this.rightClickMenu.setMetaWindow(_this.lastFocused, _this.metaWindows);
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
    this.panelEditId = global.__settings.connect('changed::panel-edit-mode', Lang.bind(this, this.on_panel_edit_mode_changed));
    this.arrangePinnedId = this._applet.settings.connect('changed::arrange-pinnedApps', Lang.bind(this, this.on_arrange_pinned));
  },

  getId: function getId() {
    return this.appId;
  },

  on_arrange_pinned: function on_arrange_pinned() {
    this._draggable.inhibit = !this._applet.settings.getValue('arrange-pinnedApps');
  },

  on_panel_edit_mode_changed: function on_panel_edit_mode_changed() {
    this._draggable.inhibit = global.__settings.get_boolean('panel-edit-mode');
    this.actor.reactive = !global.__settings.get_boolean('panel-edit-mode');
  },

  on_title_display_changed: function on_title_display_changed(metaWindow) {
    this._windowTitleChanged(metaWindow);
    var titleType = this._applet.settings.getValue('title-display');
    if (titleType === App.TitleDisplay.Title) {
      this.showAppButtonLabel(true);
    } else if (titleType === App.TitleDisplay.App) {
      this.showAppButtonLabel(true);
    } else if (titleType === App.TitleDisplay.None) {
      this.hideAppButtonLabel(true);
    }
  },

  _onDragBegin: function _onDragBegin() {
    if (this._applet.orientation == St.Side.TOP || this._applet.orientation == St.Side.BOTTOM) {
      this._draggable._overrideY = this.actor.get_transformed_position()[1];
      this._draggable._overrideX = null;
    } else {
      this._draggable._overrideX = this.actor.get_transformed_position()[0];
      this._draggable._overrideY = null;
    }
  },

  _onDragEnd: function _onDragEnd() {
    this.rightClickMenu.close(false);
    this.hoverMenu.close(false);
    this.appList._fixAppGroupIndexAfterDrag(this.appId);
    this._applet._clearDragPlaceholder();
  },

  _onDragCancelled: function _onDragCancelled() {
    this.rightClickMenu.close(false);
    this.hoverMenu.close(false);
    this._applet._clearDragPlaceholder();
  },

  handleDragOver: function handleDragOver(source, actor, x, y, time) {
    var IsLauncherDraggable = null;
    if (DND.LauncherDraggable) {
      IsLauncherDraggable = source instanceof DND.LauncherDraggable;
    }
    if (source instanceof AppGroup || source.isDraggableApp || IsLauncherDraggable) {
      return DND.DragMotionResult.CONTINUE;
    }

    if (typeof this.appList.dragEnterTime == 'undefined') {
      this.appList.dragEnterTime = time;
    } else {
      if (time > this.appList.dragEnterTime + 3000) {
        this.appList.dragEnterTime = time;
      }
    }

    if (time > this.appList.dragEnterTime + 300 && !(this.isFavapp || source.isDraggableApp)) {
      this._windowHandle(true);
    }
    return true;
  },

  getDragActor: function getDragActor() {
    return this.app.create_icon_texture(this._applet._panelHeight);
  },

  // Returns the original actor that should align with the actor
  // we show as the item is being dragged.
  getDragActorSource: function getDragActorSource() {
    return this.actor;
  },

  // Add a workspace to the list of workspaces that are watched for
  // windows being added and removed
  watchWorkspace: function watchWorkspace(metaWorkspace) {
    var _this2 = this;

    var refWs = _.findIndex(this.metaWorkspacesSignals, function (ws) {
      return _.isEqual(ws.workspace, metaWorkspace);
    });
    if (refWs === -1) {
      // We use connect_after so that the window-tracker time to identify the app, otherwise get_window_app might return null!
      var windowAddedSignal = metaWorkspace.connect_after('window-added', function (metaWorkspace, metaWindow) {
        return _this2._windowAdded(metaWorkspace, metaWindow);
      });
      var windowRemovedSignal = metaWorkspace.connect_after('window-removed', Lang.bind(this, this._windowRemoved));
      // Workspace is cached so the signals are disconnected reliably in unwatchWorkspace.
      this.metaWorkspacesSignals.push({
        workspace: metaWorkspace,
        signals: [windowAddedSignal, windowRemovedSignal]
      });
    }
    this._calcWindowNumber(metaWorkspace);
    this.numDisplaySignal = this._applet.settings.connect('changed::number-display', function () {
      _this2._calcWindowNumber(metaWorkspace);
    });
  },

  // Stop monitoring a workspace for added and removed windows.
  // @metaWorkspace: if null, will remove all signals
  unwatchWorkspace: function unwatchWorkspace(metaWorkspace) {
    var unmount = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;

    if (!metaWorkspace) {
      var removeSignals = function removeSignals(obj) {
        var signals = obj.signals;
        for (var i = 0, len = signals.length; i < len; i++) {
          obj.workspace.disconnect(signals[i]);
        }
      };
      for (var i = 0, len = this.metaWorkspacesSignals.length; i < len; i++) {
        removeSignals(this.metaWorkspacesSignals[i]);
        _.pullAt(this.metaWorkspacesSignals, i);
      }
    }
  },

  hideAppButton: function hideAppButton() {
    this._appButton.actor.hide();
  },

  showAppButton: function showAppButton() {
    this._appButton.actor.show();
  },

  hideAppButtonLabel: function hideAppButtonLabel(animate) {
    this._appButton.hideLabel(animate);
  },

  showAppButtonLabel: function showAppButtonLabel(animate, targetWidth) {
    this._appButton.showLabel(animate, targetWidth);
  },

  // TBD: share the _appButton._numLabel with "window number display"
  showOrderLabel: function showOrderLabel(number) {
    var label = this._appButton._numLabel;
    label.text = '' + (number + 1);
    label.show();
  },

  hideOrderLabel: function hideOrderLabel() {
    this._calcWindowNumber(this.appList.metaWorkspace);
  },

  _onAppButtonRelease: function _onAppButtonRelease(actor, event) {
    var _this3 = this;

    this._applet._clearDragPlaceholder();
    var button = event.get_button();
    if (button === 1 && this.isFavapp || button === 2) {
      this.app.open_new_window(-1);
      this._animate();
      return;
    }

    var appWindows = this._applet.groupApps ? this.app.get_windows() : [this.metaWindows[0].win];
    var appWindowsLen = appWindows.length;

    var handleMinimizeToggle = function handleMinimizeToggle(win) {
      if (_this3._applet.onClickThumbs && appWindowsLen > 1) {
        if (_this3.hoverMenu.isOpen) {
          _this3.hoverMenu.close();
        } else {
          _this3.hoverMenu.open();
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

      if (this.rightClickMenu.isOpen) {
        this.rightClickMenu.toggle();
      }
      this.hoverMenu.shouldOpen = false;
      if (appWindows.length === 1) {
        handleMinimizeToggle(appWindows[0]);
      } else {
        var actionTaken = false;
        for (var i = 0, len = appWindows.length; i < len; i++) {
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
      if (this.rightClickMenu.isOpen) {
        this.rightClickMenu.mouseEvent = event;
        this.rightClickMenu.toggle();
      } else {
        this.hoverMenu.close();
        this.rightClickMenu.open();
      }
    }
  },
  _onAppButtonPress: function _onAppButtonPress(actor, event) {
    var button = event.get_button();
    if (button === 3) {
      return true;
    }
    return false;
  },


  _onAppKeyPress: function _onAppKeyPress() {
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

  _onNewAppKeyPress: function _onNewAppKeyPress(number) {
    this.app.open_new_window(-1);
    this._animate();
  },

  _windowHandle: function _windowHandle(fromDrag) {
    var has_focus = this.lastFocused.has_focus();
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
        for (var i = 0, max = this.metaWindows.length - 1; i < max; i++) {
          if (this.metaWindows[i].win._lgId === this.lastFocused._lgId) {
            nextWindow = this.metaWindows[i + 1].win;
            break;
          }
        }
        if (nextWindow === null) {
          nextWindow = this.metaWindows[0].win;
        }
        Main.activateWindow(nextWindow, global.get_current_time());
      } else {
        this.lastFocused.minimize(global.get_current_time());
        this.actor.remove_style_pseudo_class('focus');
      }
    } else {
      if (this.lastFocused.minimized) {
        this.lastFocused.unminimize(global.get_current_time());
      }
      var ws = this.lastFocused.get_workspace().index();
      if (ws != global.screen.get_active_workspace_index()) {
        global.screen.get_workspace_by_index(ws).activate(global.get_current_time());
      }
      Main.activateWindow(this.lastFocused, global.get_current_time());
      this.actor.add_style_pseudo_class('focus');
    }
  },
  _getLastFocusedWindow: function _getLastFocusedWindow() {
    return this.lastFocused;
  },

  // updates the internal list of metaWindows
  // to include all windows corresponding to this.app on the workspace
  // metaWorkspace
  _updateMetaWindows: function _updateMetaWindows(metaWorkspace) {
    var app = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;

    var _this4 = this;

    var window = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : null;

    var _wsWindows = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : null;

    // Get a list of all interesting windows that are part of this app on the current workspace
    var wsWindows = _wsWindows ? _wsWindows : metaWorkspace.list_windows();
    var windowsSource = window ? [window] : wsWindows;

    var filterArgs = _.isEqual(app, this.app);
    var windowList = _.filter(windowsSource, function (win) {
      if (!app) {
        app = _this4._applet.getAppFromWMClass(_this4.appList.specialApps, win);
        if (!app) {
          app = _this4._applet.tracker.get_window_app(win);
        }
      }
      if (!_this4._applet.includeAllWindows) {
        filterArgs = filterArgs && _this4._applet.tracker.is_window_interesting(win);
      }
      return _.isEqual(app, _this4.app);
    });

    this.metaWindows = [];

    for (var i = 0, len = windowList.length; i < len; i++) {
      this._windowAdded(metaWorkspace, windowList[i], windowList);
    }

    if (this.lastFocused && _.isObject(this.lastFocused)) {
      if (this.rightClickMenu !== undefined) {
        this.rightClickMenu.setMetaWindow(this.lastFocused, this.metaWindows);
      }
    }
  },

  _windowAdded: function _windowAdded(metaWorkspace, metaWindow, metaWindows) {
    var _this5 = this;

    var recursion = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : 0;


    var app = this._applet.getAppFromWMClass(this.appList.specialApps, metaWindow);
    if (!app) {
      app = this._applet.tracker.get_window_app(metaWindow);
    }

    if (!app) {
      return;
    }

    var refWindow = _.findIndex(this.metaWindows, function (win) {
      return _.isEqual(win.win, metaWindow);
    });
    var windowAddArgs = _.isEqual(app, this.app) && refWindow === -1;
    if (!this._applet.includeAllWindows) {
      windowAddArgs = windowAddArgs && this._applet.tracker.is_window_interesting(metaWindow);
    }
    if (windowAddArgs) {
      // Defer apps that behave improperly when being launched.
      var handleDeferredApp = false;
      for (var i = 0, len = DEFERRED_APPS.length; i < len; i++) {
        if (app.get_id().indexOf(DEFERRED_APPS[i]) !== -1 && recursion === 0) {
          handleDeferredApp = true;
          break;
        }
      }
      if (handleDeferredApp) {
        if (this.isFavapp) {
          ++recursion;
          setTimeout(function () {
            return _this5._windowAdded(metaWorkspace, metaWindow, metaWindows, recursion);
          }, 3000);
          return;
        } else {
          setTimeout(function () {
            return _this5._applet.refreshCurrentAppList(_this5.appId);
          }, 3000);
        }
      }
      if (metaWindow) {
        if (!this._applet.groupApps && this.metaWindows.length >= 1) {
          if (this.ungroupedIndex === 0) {
            this.appList._windowAdded(metaWorkspace, metaWindow, null, this.isFavapp, true);
          }
          return;
        }
        this.lastFocused = metaWindow;

        var signals = [];
        signals.push(metaWindow.connect('notify::title', Lang.bind(this, this._windowTitleChanged)));
        signals.push(metaWindow.connect('notify::appears-focused', Lang.bind(this, this._focusWindowChange)));

        // Set the initial button label as not all windows will get updated via signals initially.
        this._windowTitleChanged(metaWindow);

        var data = {
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
        this._appButton.setMetaWindow(this.lastFocused, this.metaWindows);
      }

      if (this.isFavapp) {
        this._isFavorite(false);
      }

      this._calcWindowNumber(metaWorkspace);
    }
  },

  _windowRemoved: function _windowRemoved(metaWorkspace, metaWindow) {
    var refWindow = _.findIndex(this.metaWindows, function (win) {
      return _.isEqual(win.win, metaWindow);
    });

    if (refWindow !== -1) {
      // Clean up all the signals we've connected
      for (var i = 0, len = this.metaWindows[refWindow].data.signals.length; i < len; i++) {
        this.metaWindows[refWindow].win.disconnect(this.metaWindows[refWindow].data.signals[i]);
      }

      if (!this._applet.groupApps) {
        this.appList._removeApp(this.app, this.timeStamp);
        return;
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
        this._appButton.setMetaWindow(this.lastFocused, this.metaWindows);
      } else if (this.isFavapp) {
        this._applet.refreshAppFromCurrentListById(this.appId, { favChange: true, isFavapp: this.isFavapp });
      }

      this._calcWindowNumber(metaWorkspace);
    }
  },

  _windowTitleChanged: function _windowTitleChanged(metaWindow) {
    // We only really want to track title changes of the last focused app
    if (!this._appButton) {
      throw 'Error: got a _windowTitleChanged callback but this._appButton is undefined';
    }
    if (!_.isEqual(metaWindow, this.lastFocused) || this.isFavapp) {
      return;
    }
    var titleType = this._applet.settings.getValue('title-display');

    var title = metaWindow.get_title();
    this.appName = this.app.get_name();

    if (titleType === App.TitleDisplay.None || this._applet.c32 && (this.orientation === St.Side.LEFT || this.orientation === St.Side.RIGHT)) {
      this._appButton.setText('');
    } else if (titleType === App.TitleDisplay.Title) {
      if (title) {
        this._appButton.setText(title);
        this.showAppButtonLabel(true);
      }
    } else if (titleType === App.TitleDisplay.Focused) {
      if (title) {
        this._appButton.setText(title);
        this._updateFocusedStatus(true);
      }
    } else if (titleType === App.TitleDisplay.App) {
      if (this.appName) {
        this._appButton.setText(this.appName);
        this.showAppButtonLabel(true);
      }
    }
  },

  _focusWindowChange: function _focusWindowChange(metaWindow) {
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
    if (this._applet.settings.getValue('title-display') === App.TitleDisplay.Focused) {
      this._updateFocusedStatus();
    }
  },

  _updateFocusedStatus: function _updateFocusedStatus(force) {
    var focusState = void 0;
    for (var i = 0, len = this.metaWindows.length; i < len; i++) {
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

  _focusedLabel: function _focusedLabel(focusState) {
    if (focusState) {
      this.showAppButtonLabel(true);
    } else {
      this.hideAppButtonLabel(true);
    }
  },

  _isFavorite: function _isFavorite(isFav) {
    this.isFavapp = isFav;
    this.wasFavapp = !isFav;
    this._appButton._isFavorite(isFav);
    this.hoverMenu.appSwitcherItem._isFavorite(isFav);
    this._windowTitleChanged(this.lastFocused);
  },

  _calcWindowNumber: function _calcWindowNumber(metaWorkspace) {
    if (!this._appButton) {
      clog('Error: got a _calcWindowNumber callback but this._appButton is undefined');
    }

    var windowNum = this.metaWindows.length;

    var numDisplay = this._applet.settings.getValue('number-display');
    this._appButton._numLabel.text = windowNum.toString();
    if (numDisplay === App.NumberDisplay.Smart) {
      if (windowNum <= 1) {
        this._appButton._numLabel.hide();
      } else {
        this._appButton._numLabel.show();
      }
    } else if (numDisplay == App.NumberDisplay.Normal) {
      if (windowNum <= 0) {
        this._appButton._numLabel.hide();
      } else {
        this._appButton._numLabel.show();
      }
    } else if (numDisplay == App.NumberDisplay.All) {
      this._appButton._numLabel.show();
    } else {
      this._appButton._numLabel.hide();
    }
  },

  _animate: function _animate() {
    this.actor.set_z_rotation_from_gravity(0.0, Clutter.Gravity.CENTER);
    Tweener.addTween(this.actor, {
      opacity: 70,
      time: 1.0,
      transition: 'linear',
      onCompleteScope: this,
      onComplete: function onComplete() {
        Tweener.addTween(this.actor, {
          opacity: 255,
          time: 0.5,
          transition: 'linear'
        });
      }
    });
  },

  destroy: function destroy() {
    var skip = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : false;

    // Unwatch all workspaces before we destroy all our actors
    // that callbacks depend on

    var destroyWindowSignal = function destroyWindowSignal(metaWindow) {
      for (var i = 0, len = metaWindow.data.signals.length; i < len; i++) {
        metaWindow.win.disconnect(metaWindow.data.signals[i]);
      }
    };

    for (var i = 0, len = this.metaWindows.length; i < len; i++) {
      destroyWindowSignal(this.metaWindows[i]);
    }
    for (var _i = 0, _len = this.signals._appButton.length; _i < _len; _i++) {
      this._appButton.actor.disconnect(this.signals._appButton[_i]);
    }
    for (var _i2 = 0, _len2 = this.signals._draggable.length; _i2 < _len2; _i2++) {
      this._draggable.disconnect(this.signals._draggable[_i2]);
    }
    this._applet.settings.disconnect(this.numDisplaySignal);
    global.__settings.disconnect(this.panelEditId);
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