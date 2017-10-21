//vim: expandtab shiftwidth=4 tabstop=8 softtabstop=4 encoding=utf-8 textwidth=99
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
const Clutter = imports.gi.Clutter;
const Lang = imports.lang;
const Cinnamon = imports.gi.Cinnamon;
const St = imports.gi.St;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;
const Tweener = imports.ui.tweener;
const Meta = imports.gi.Meta;
const PopupMenu = imports.ui.popupMenu;
const Signals = imports.signals;
const DND = imports.ui.dnd;
const AppFavorites = imports.ui.appFavorites;
const Settings = imports.ui.settings;
const Gettext = imports.gettext;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;

const SPINNER_ANIMATION_TIME = 1;


function _(str) {
   let resultConf = Gettext.dgettext('WindowListGroup@jake.phy@gmail.com', str);
   if(resultConf != str) {
      return resultConf;
   }
   return Gettext.gettext(str);
}


// Load our applet so we can access other files in our extensions dir as libraries
const AppletDir = imports.ui.appletManager.applets['WindowListGroup@jake.phy@gmail.com'];
const SpecialMenus = AppletDir.specialMenus;
const SpecialButtons = AppletDir.specialButtons;

const TitleDisplay = {
    none: 1,
    app: 2,
    title: 3,
    focused: 4
}
const NumberDisplay = {
    smart: 1,
    normal: 2,
    none: 3,
    all: 4
}
const SortThumbs = {
    focused: 1,
    opened: 2
}

// Some functional programming tools
const dir = function (obj) {
    let props = [afor(a in obj)];
    props.concat(Object.getOwnPropertyNames(obj));
    return props;
}

const range = function (a, b) {
    let ret = []
        // if b is unset, we want a to be the upper bound on the range
    if (b == null) {
        [a, b] = [0, a]
    }

    for (let i = a; i < b; i++) {
        ret.push(i);
    }
    return ret;
}

const zip = function (a, b) {
    let ret = [];
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
        ret.push([a[i], b[i]]);
    }
    return ret;
}

const unzip = function (a) {
    let ret1 = [],
        ret2 = [];
    a.forEach(function (tuple) {
        ret1.push(tuple[0]);
        ret2.push(tuple[1]);
    });

    return [ret1, ret2];
}

// A hash-like object that preserves order
// and is sortable

function OrderedHash() {
    this._init.apply(this, arguments);
}

OrderedHash.prototype = {
    _init: function (keys, items) {
        this._items = items || [];
        this._keys = keys || [];
    },

    toString: function () {
        let ret = [this._keys[i] + ': ' + this._items[i]
            for each(i in range(this._keys.length))];
        return '{' + ret.join(', ') + '}';
    },

    set: function (key, val) {
        let i = this._keys.indexOf(key);
        if (i == -1) {
            this._keys.push(key);
            this._items.push(val);
        } else {
            this._items[i] = val;
        }
        return val;
    },

    // Given an array of keys, the entries [key: initializer(key)]
    // are added
    setKeys: function (keys, initializer) {
        keys.forEach(Lang.bind(this, function (key) {
            this.set(key, initializer(key));
        }));
    },

    get: function (key) {
        let i = this._keys.indexOf(key);
        if (i == -1) {
            return undefined;
        }
        return this._items[i];
    },

    // returns [key, items] corresponding
    // to the index
    getPair: function (index) {
        index = index || 0;
        return [this._keys[index], this._items[index]];
    },

    contains: function (key) {
        return this._keys.indexOf(key) != -1;
    },

    remove: function (key) {
        let i = this._keys.indexOf(key);
        let ret = null;
        if (i != -1) {
            this._keys.splice(i, 1);
            ret = this._items.splice(i, 1)[0];
        }
        return ret;
    },

    keys: function () {
        return this._keys.slice();
    },

    items: function () {
        return this._items.slice();
    },

    sort: function (sortFunc) {
        this.sortByKeys(sortFunc);
    },

    sortByKeys: function (sortFunc) {
        let pairs = zip(this._keys, this._items);
        pairs.sort(Lang.bind(this, function (a, b) {
            return sortFunc(a[0], b[0]);
        }));
        [this._keys, this._items] = unzip(pairs);
    },

    sortByItems: function (sortFunc) {
        let pairs = zip(this._keys, this._items);
        pairs.sort(Lang.bind(this, function (a, b) {
            return sortFunc(a[1], b[1]);
        }));
        [this._keys, this._items] = unzip(pairs);
    },

    // Call forFunc(key, item) on each (key, item) pair.
    forEach: function (forFunc) {
        let pairs = zip(this._keys, this._items);
        pairs.forEach(function (a) {
            forFunc(a[0], a[1]);
        });
    }
};

// Connects and keeps track of signal IDs so that signals
// can be easily disconnected

function SignalTracker() {
    this._init.apply(this, arguments);
}

SignalTracker.prototype = {
    _init: function () {
        this._data = [];
    },

    // params = {
    //              signalName: Signal Name
    //              callback: Callback Function
    //              bind: Context to bind to
    //              object: object to connect to
    //}
    connect: function (params) {
        let signalName = params['signalName'];
        let callback = params['callback'];
        let bind = params['bind'];
        let object = params['object'];
        let signalID = null;

        signalID = object.connect(signalName, Lang.bind(bind, callback));
        this._data.push({
            signalName: signalName,
            callback: callback,
            object: object,
            signalID: signalID,
            bind: bind
        });
    },

    disconnect: function (param) {

    },

    disconnectAll: function () {
        this._data.forEach(function (data) {
            data['object'].disconnect(data['signalID']);
            for (let prop in data) {
                data[prop] = null;
            }
        });
        this._data = [];
    }
};

let appFavoritesInstance = null;

function GetAppFavorites() {
    return appFavoritesInstance;
}


function PinnedFavs() {
    this._init.apply(this, arguments);
}

PinnedFavs.prototype = {

    _init: function (applet) {
        this._applet = applet;
        this._favorites = {};
        this._applet.settings.connect('changed::pinned-apps', Lang.bind(this, this._reload));
        this._reload();
    },

    _onFavsChanged: function () {
        this._reload();
        this.emit('changed');
    },

    _reload: function () {
        let ids = this._applet.settings.getValue("pinned-apps");
        let appSys = Cinnamon.AppSystem.get_default();
        let apps = ids.map(function (id) {
            let app = appSys.lookup_app(id);
            return app;
        }).filter(function (app) {
            return app != null;
        });
        this._favorites = {};
        for (let i = 0; i < apps.length; i++) {
            let app = apps[i];
            this._favorites[app.get_id()] = app;
        }
    },

    _getIds: function () {
        let ret = [];
        for (let id in this._favorites)
            ret.push(id);
        return ret;
    },

    getFavoriteMap: function () {
        return this._favorites;
    },

    getFavorites: function () {
        let ret = [];
        for (let id in this._favorites)
            ret.push(this._favorites[id]);
        return ret;
    },

    isFavorite: function (appId) {
        return appId in this._favorites;
    },

    _addFavorite: function (appId, pos) {
        if (appId in this._favorites)
            return false;

        let app = Cinnamon.AppSystem.get_default().lookup_app(appId);
        if (!app) app = Cinnamon.AppSystem.get_default().lookup_settings_app(appId);

        if (!app)
            return false;

        let ids = this._getIds();
        if (pos == -1)
            ids.push(appId);
        else
            ids.splice(pos, 0, appId);
        this._applet.pinnedApps = ids;
        this._favorites[appId] = app;
        return true;
    },

    addFavoriteAtPos: function (appId, pos) {
        this._addFavorite(appId, pos);
    },

    addFavorite: function (appId) {
        this.addFavoriteAtPos(appId, -1);
    },

    moveFavoriteToPos: function (appId, pos) {
        let ids = this._getIds();
        let old_index = ids.indexOf(appId);
        if (pos > old_index)
            pos = pos - 1;
        ids.splice(pos, 0, ids.splice(old_index, 1)[0]);
        this._applet.pinnedApps = ids;

    },

    _removeFavorite: function (appId) {
        if (!appId in this._favorites)
            return false;

        let ids = this._getIds().filter(function (id) {
            return id != appId;
        });
        this._applet.settings.setValue("pinned-apps", ids);
        return true;
    },

    removeFavorite: function (appId) {
        let app = this._favorites[appId];
        this._removeFavorite(appId);
    }
};
Signals.addSignalMethods(PinnedFavs.prototype);

// Tracks what applications are associated with the
// given metawindows.  Will return tracker.get_window_app
// if it is non-null.  Otherwise, it will look it up in
// its internal database.  If that fails, it will throw an exception
// This is a work around for https://bugzilla.gnome.org/show_bug.cgi?id=666472

function AppTracker() {
    this._init.apply(this, arguments);
}

AppTracker.prototype = {
    _init: function (tracker) {
        this.tracker = tracker || Cinnamon.WindowTracker.get_default();
        this.hash = new OrderedHash();
    },

    get_window_app: function (metaWindow) {
        let app = this.tracker.get_window_app(metaWindow);
        // If we found a valid app, we should add it to our hash,
        // otherwise, try to look it up in our hash
        if (app == null) {
            app = this.hash.get(metaWindow);
        } else {
            this.hash.set(metaWindow, app);
        }

        if (!app) throw {
            name: 'AppTrackerError',
            message: 'get_window_app returned null and there was no record of metaWindow in internal database'
        };

        return app;
    },

    is_window_interesting: function (metaWindow) {
        return this.tracker.is_window_interesting(metaWindow);
    }
};

// AppGroup is a container that keeps track
// of all windows of @app (all windows on workspaces
// that are watched, that is).

function AppGroup() {
    this._init.apply(this, arguments);
}

AppGroup.prototype = {
    _init: function (applet, appList, app, isFavapp, orientation) {
        this._applet = applet;
        this.appList = appList;
        this.app = app;
        this.isFavapp = isFavapp;
        this.isNotFavapp = !isFavapp;
        this.orientation = orientation;
        this.metaWindows = new OrderedHash();
        this.metaWorkspaces = new OrderedHash();
        this.actor = new St.Bin({
            reactive: true,
            can_focus: true,
            x_fill: true,
            y_fill: false,
            track_hover: true
        });
        this.actor._delegate = this;

        this.myactor = new St.BoxLayout({
            reactive: true
        });
        this.actor.set_child(this.myactor);

        this._windowButtonBox = new SpecialButtons.ButtonBox();
        this._appButton = new SpecialButtons.AppButton(this);

        this.myactor.add(this._appButton.actor);
        this.myactor.add(this._windowButtonBox.actor);

        this.appButtonVisible = true;
        this.windowButtonsVisible = true;

        this._appButton.actor.connect('button-release-event', Lang.bind(this, this._onAppButtonRelease));
        //global.screen.connect('event', Lang.bind(this, this._onAppKeyPress));
        //        global.screen.connect('key-release-event', Lang.bind(this, this._onAppKeyReleased));
        // Set up the right click menu for this._appButton
        this.rightClickMenu = new SpecialMenus.AppMenuButtonRightClickMenu(this, this._appButton.actor);
        this._menuManager = new PopupMenu.PopupMenuManager(this);
        this._menuManager.addMenu(this.rightClickMenu);

        // Set up the hover menu for this._appButton
        this.hoverMenu = new SpecialMenus.AppThumbnailHoverMenu(this)
        this._hoverMenuManager = new SpecialMenus.HoverMenuController(this);
        this._hoverMenuManager.addMenu(this.hoverMenu);

        this._draggable = SpecialButtons.makeDraggable(this.actor);
        this._draggable.connect('drag-cancelled', Lang.bind(this, this._onDragCancelled));
        this._draggable.connect('drag-end', Lang.bind(this, this._onDragEnd));
        this.isDraggableApp = true;

        this.on_panel_edit_mode_changed();
        this.on_arrange_pinned();
        global.settings.connect('changed::panel-edit-mode', Lang.bind(this, this.on_panel_edit_mode_changed));
        this._applet.settings.connect("arrange-pinnedApps", Lang.bind(this, this.on_arrange_pinned));
    },

    on_arrange_pinned: function () {
        this._draggable.inhibit = !this._applet.settings.getValue("arrange-pinnedApps");
    },

    on_panel_edit_mode_changed: function () {
        this._draggable.inhibit = global.settings.get_boolean("panel-edit-mode");
        this.actor.reactive = !global.settings.get_boolean("panel-edit-mode");
    },

    _onDragEnd: function () {
        this.rightClickMenu.close(false);
        this.hoverMenu.close(false);
        this.appList.myactorbox._clearDragPlaceholder();
    },

    _onDragCancelled: function () {
        this.rightClickMenu.close(false);
        this.hoverMenu.close(false);
        this.appList.myactorbox._clearDragPlaceholder();
    },

    handleDragOver: function (source, actor, x, y, time) {
        if (source instanceof AppGroup || source.isDraggableApp) return DND.DragMotionResult.CONTINUE;

        if (typeof (this.appList.dragEnterTime) == 'undefined') {
            this.appList.dragEnterTime = time;
        } else {
            if (time > (this.appList.dragEnterTime + 3000)) {
                this.appList.dragEnterTime = time;
            }
        }

        if (time > (this.appList.dragEnterTime + 300) && !(this.isFavapp || source.isDraggableApp) && this._applet.settings.getValue("group-apps")) {
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
        if (!this.metaWorkspaces.contains(metaWorkspace)) {
            // We use connect_after so that the window-tracker time to identify the app, otherwise get_window_app might return null!
            let windowAddedSignal = metaWorkspace.connect_after('window-added', Lang.bind(this, this._windowAdded));
            let windowRemovedSignal = metaWorkspace.connect_after('window-removed', Lang.bind(this, this._windowRemoved));
            this.metaWorkspaces.set(metaWorkspace, {
                workspace: metaWorkspace,
                signals: [windowAddedSignal, windowRemovedSignal]
            });
        }
        this._calcWindowNumber(metaWorkspace);
        this._applet.settings.connect("changed::number-display", Lang.bind(this, function () {
            this._calcWindowNumber(metaWorkspace);
        }));
    },

    // Stop monitoring a workspace for added and removed windows.
    // @metaWorkspace: if null, will remove all signals
    unwatchWorkspace: function (metaWorkspace) {
        function removeSignals(obj) {
            obj.signals.forEach(function (s) {
                obj.workspace.disconnect(s);
            });
        }

        if (metaWorkspace == null) {
            for each(let k in this.metaWorkspaces.keys()) {
                removeSignals(this.metaWorkspaces.get(k));
                this.metaWorkspaces.remove(k);
            }
        } else if (this.metaWorkspaces.contains(metaWorkspace)) {
            removeSignals(this.metaWorkspaces.get(metaWorkspace));
            this.metaWorkspaces.remove(metaWorkspace);
        } else {
            global.log('Warning: tried to remove watch on an unwatched workspace');
        }
    },

    hideWindowButtons: function (animate) {
        this._windowButtonBox.hide(animate);
        this.windowButtonsVisible = false;
    },

    showWindowButtons: function (animate) {
        let targetWidth = null;
        if (animate) targetWidth = this.actor.width;
        this._windowButtonBox.show(animate, targetWidth);
        this.windowButtonsVisible = true;
    },

    hideAppButton: function (animate) {
        this._appButton.hide(animate);
        this.appButtonVisible = false;
    },

    showAppButton: function (animate) {
        let targetWidth = null;
        if (animate) targetWidth = this.actor.width;
        this._appButton.show(animate, targetWidth);
        this.appButtonVisible = true;
    },

    hideAppButtonLabel: function (animate) {
        this._appButton.hideLabel(animate);
    },

    showAppButtonLabel: function (animate, targetWidth) {
        this._appButton.showLabel(animate, targetWidth);
    },

    _onAppButtonRelease: function (actor, event) {
        if (event.get_state() & Clutter.ModifierType.BUTTON1_MASK && this.isFavapp || event.get_state() & Clutter.ModifierType.SHIFT_MASK && event.get_state() & Clutter.ModifierType.BUTTON1_MASK) {
            this.app.open_new_window(-1);
            this._animate();
            return;
        }

        let windowNum = this.app.get_windows().filter(function (win) {
            let workspaces = [global.screen.get_workspace_by_index(i) for each(i in range(global.screen.n_workspaces))];
            for (let i = 0; i < workspaces.length; i++) {
                if (win.get_workspace() == workspaces[i])
                    return workspaces[i];
            }
            return false;
        }).length;

        if (!this.lastFocused) return;

        if (event.get_state() & Clutter.ModifierType.BUTTON2_MASK && !this.isFavapp) {
            this.app.open_new_window(-1);

        } else if (event.get_state() & Clutter.ModifierType.BUTTON1_MASK) {
            if (this._applet.onclickThumbs && windowNum > 1) {
                this.hoverMenu.shouldOpen = true;
                this.hoverMenu.shouldClose = false;
                this.hoverMenu.hoverOpen();
            } else
                this._windowHandle(false);

        }

    },

    _newAppKeyNumber: function (number) {
        if (number < 10)
            Main.keybindingManager.addHotKey('launch-app-key-' + number.toString(), "<Super>" + number.toString(), Lang.bind(this, this._onAppKeyPress));
    },

    _onAppKeyPress: function (number) {
        if (this.isFavapp) {
            this.app.open_new_window(-1);
            this._animate();
        } else {
            this._windowHandle(false);
        }
    },

    _windowHandle: function (fromDrag) {
        if (this.lastFocused.has_focus()) {
            if (fromDrag) {
                return;
            }
            if (this.lastFocused.minimized) {
                this.lastFocused.unminimize(global.get_current_time());
            } else
                this.lastFocused.minimize(global.get_current_time());
        } else {
            if (this.lastFocused.minimized) {
                this.lastFocused.unminimize(global.get_current_time());
            }
            this.lastFocused.activate(global.get_current_time());
        }
    },

    _getLastFocusedWindow: function () {
        // Get a list of windows and sort it in order of last access
        let list = [[win.user_time, win]
            for each(win in this.metaWindows.keys())]
        list.sort(function (a, b) {
            return a[0] - b[0];
        });
        if (list[0]) return list[0][1];
        else return null
    },

    // updates the internal list of metaWindows
    // to include all windows corresponding to this.app on the workspace
    // metaWorkspace
    _updateMetaWindows: function (metaWorkspace) {
        let tracker = Cinnamon.WindowTracker.get_default();
        // Get a list of all interesting windows that are part of this app on the current workspace
        let windowList = metaWorkspace.list_windows().filter(Lang.bind(this, function (metaWindow) {
            try {
                return tracker.get_window_app(metaWindow) == this.app && tracker.is_window_interesting(metaWindow);
            } catch (e) {
                log(e.name + ': ' + e.message);
                return false;
            }
        }));
        this.metaWindows = new OrderedHash();
        this._windowButtonBox.clear();
        this._loadWinBoxFavs();
        windowList.forEach(Lang.bind(this, function (win) {
            this._windowAdded(metaWorkspace, win);
        }));

        // When we first populate we need to decide which window
        // will be triggered when the app button is pressed
        if (!this.lastFocused) {
            this.lastFocused = this._getLastFocusedWindow();
        }
        if (this.lastFocused) {
            this._windowTitleChanged(this.lastFocused);
            this.rightClickMenu.setMetaWindow(this.lastFocused);
        }
    },

    _windowAdded: function (metaWorkspace, metaWindow) {
        let tracker = Cinnamon.WindowTracker.get_default();
        if (tracker.get_window_app(metaWindow) == this.app && !this.metaWindows.contains(metaWindow) && tracker.is_window_interesting(metaWindow)) {
            let button = new SpecialButtons.WindowButton({
                parent: this,
                isFavapp: false,
                metaWindow: metaWindow,
            });
            this._windowButtonBox.add(button);
            if (metaWindow) {
                this.lastFocused = metaWindow;
                this.rightClickMenu.setMetaWindow(this.lastFocused);
                this.hoverMenu.setMetaWindow(this.lastFocused);
            }
            let signals = [];
            this._applet.settings.connect("changed::title-display", Lang.bind(this, function(){
                this._windowTitleChanged(this.lastFocused);
            }));
            signals.push(metaWindow.connect('notify::title', Lang.bind(this, this._windowTitleChanged)));
            signals.push(metaWindow.connect('notify::appears-focused', Lang.bind(this, this._focusWindowChange)));
            let data = {
                signals: signals,
                windowButton: button
            };
            this.metaWindows.set(metaWindow, data);
            this.metaWindows.sort(function (w1, w2) {
                return w1.get_stable_sequence() - w2.get_stable_sequence();
            });
            if (this.isFavapp) {
                this._isFavorite(false);
            }
            this._calcWindowNumber(metaWorkspace);
        }
    },

    _windowRemoved: function (metaWorkspace, metaWindow) {
        let deleted = this.metaWindows.remove(metaWindow);
        if (deleted != null) {
            // Clean up all the signals we've connected
            deleted['signals'].forEach(function (s) {
                metaWindow.disconnect(s);
            });
            this._windowButtonBox.remove(deleted['windowButton']);
            deleted['windowButton'].destroy();


            // Make sure we don't leave our appButton hanging!
            // That is, we should no longer display the old app in our title
            let nextWindow = this.metaWindows.keys()[0];
            if (nextWindow) {
                this.lastFocused = nextWindow;
                this._windowTitleChanged(this.lastFocused);
                this.hoverMenu.setMetaWindow(this.lastFocused);
                this.rightClickMenu.setMetaWindow(this.lastFocused);
            }
            this._calcWindowNumber(metaWorkspace);
        }
    },

    _windowTitleChanged: function (metaWindow) {
        // We only really want to track title changes of the last focused app
        if (!this._appButton) {
            throw 'Error: got a _windowTitleChanged callback but this._appButton is undefined';
            return;
        }
        if (metaWindow != this.lastFocused || this.isFavapp) return;

        let titleType = this._applet.settings.getValue("title-display");
        let [title, appName] = [metaWindow.get_title(), this.app.get_name()];
        if (titleType == TitleDisplay.title) {
            if (title) {
                this._appButton.setText(title);
            }
        } else if (titleType == TitleDisplay.focused) {
            if (title) {
                this._appButton.setText(title);
                this._updateFocusedStatus(true);
            }
        } else if (titleType == TitleDisplay.app) {
            if (appName) {
                this._appButton.setText(appName);
            }
        } else if (titleType == TitleDisplay.none) {
            this._appButton.setText("");
        }
    },

    _focusWindowChange: function (metaWindow) {
        if (metaWindow.appears_focused) {
            this.lastFocused = metaWindow;
            this._windowTitleChanged(this.lastFocused);
            //if (this._applet.sortThumbs == SortThumbs.focused) this.hoverMenu.setMetaWindow(this.lastFocused);
            this.rightClickMenu.setMetaWindow(this.lastFocused);
        }
        if (this._applet.settings.getValue("title-display") == TitleDisplay.focused)
            this._updateFocusedStatus();
    },

    _updateFocusedStatus: function (force) {
        let changed = false;
        let focusState = this.metaWindows.keys().some(function (win) {
            return win.appears_focused;
        });
        if (this.focusState != focusState || force)
            this._focusedLabel(focusState);
        this.focusState = focusState;
    },

    _focusedLabel: function (focusState) {
        if (focusState) {
            this.showAppButtonLabel(true, 150);
        } else {
            this.hideAppButtonLabel(true);
        }
    },

    _loadWinBoxFavs: function () {
        if (this.isFavapp || this.wasFavapp) {
            let button = new SpecialButtons.WindowButton({
                parent: this,
                isFavapp: true,
                metaWindow: null,
            });
            this._windowButtonBox.add(button);
        }
    },

    _isFavorite: function (isFav) {
        this.isFavapp = isFav;
        this.wasFavapp = !(isFav);
        this._appButton._isFavorite(isFav);
        this.rightClickMenu.removeItems();
        this.rightClickMenu._isFavorite(isFav);
        this.hoverMenu.appSwitcherItem._isFavorite(isFav);
        this._windowTitleChanged(this.lastFocused);
    },

    _calcWindowNumber: function (metaWorkspace) {
        if (!this._appButton) {
            throw 'Error: got a _calcWindowNumber callback but this._appButton is undefined';
            return;
        }

        let windowNum = this.app.get_windows().filter(function (win) {
            return win.get_workspace() == metaWorkspace;
        }).length;
        let numDisplay = this._applet.settings.getValue("number-display");
        this._appButton._numLabel.text = windowNum.toString();
        if (numDisplay == NumberDisplay.smart) {
            if (windowNum <= 1)
                this._appButton._numLabel.hide();
            else
                this._appButton._numLabel.show();
        } else if (numDisplay == NumberDisplay.normal) {
            if (windowNum <= 0)
                this._appButton._numLabel.hide();
            else
                this._appButton._numLabel.show();
        } else if (numDisplay == NumberDisplay.all) {
            this._appButton._numLabel.show();
        } else {
            this._appButton._numLabel.hide();
        }
    },

    _animate: function () {
        this.actor.set_z_rotation_from_gravity(0.0, Clutter.Gravity.CENTER)
        Tweener.addTween(this.actor, {
            opacity: 70,
            time: 1.0,
            transition: "linear",
            onCompleteScope: this,
            onComplete: function () {
                Tweener.addTween(this.actor, {
                    opacity: 255,
                    time: 0.5,
                    transition: "linear"
                });
            }
        });
    },

    destroy: function () {
        // Unwatch all workspaces before we destroy all our actors
        // that callbacks depend on
        this.metaWindows.forEach(function (win, data) {
            data['signals'].forEach(function (s) {
                win.disconnect(s);
            });
        });
        this.unwatchWorkspace(null);
        this.rightClickMenu.destroy();
        this.hoverMenu.destroy();
        this._appButton.destroy();
        this._windowButtonBox.destroy();
        this.myactor.destroy();
        this.actor.destroy();
        /*this._appButton = null;
        this._windowButtonBox = null;
        this.actor = null;
        this.rightClickMenu = null;
        this.hoverMenu = null;*/
    }
};
Signals.addSignalMethods(AppGroup.prototype)

// List of running apps

function AppList() {
    this._init.apply(this, arguments);
}

AppList.prototype = {
    _init: function (applet, metaWorkspace, orientation) {
        this.orientation = orientation;
        this._applet = applet;

        this.myactorbox = new SpecialButtons.MyAppletBox(this._applet);
        this.actor = this.myactorbox.actor;

        if (orientation == St.Side.TOP) {
            this.actor.add_style_class_name('window-list-box-top');
            this.actor.style = 'margin-top: 0px; padding-top: 0px;';
            //this.actor.set_style('padding-left: 3px');
        } else {
            this.actor.add_style_class_name('window-list-box-bottom');
            this.actor.style = 'margin-bottom: 0px; padding-bottom: 0px;';
            //this.actor.set_style('padding-left: 3px');
        }

        this.metaWorkspace = metaWorkspace;
        this._appList = new OrderedHash();
        // We need a backup database of the associated app for each metaWindow since something get_window_app will return null
        this._tracker = new AppTracker(Cinnamon.WindowTracker.get_default());
        // Connect all the signals
        this._setSignals();
        this._refreshList();
    },

    on_panel_edit_mode_changed: function () {
        this.actor.reactive = global.settings.get_boolean("panel-edit-mode");
    },

    _setSignals: function () {
        this.signals = [];
        // We use connect_after so that the window-tracker time to identify the app
        this.signals.push(this.metaWorkspace.connect_after('window-added', Lang.bind(this, this._windowAdded)));
        this.signals.push(this.metaWorkspace.connect_after('window-removed', Lang.bind(this, this._windowRemoved)));
        this._applet.settings.connect('changed::pinned-apps', Lang.bind(this, this._refreshList));
        this._applet.settings.connect("changed::group-apps", Lang.bind(this, this._groupApps));
        this._applet.settings.connect("changed::show-pinned", Lang.bind(this, this._refreshList));
        global.settings.connect('changed::panel-edit-mode', Lang.bind(this, this.on_panel_edit_mode_changed));
    },

    _groupApps: function () {
        let groupApps = this._applet.settings.getValue("group-apps");
        this._appList.forEach(function (app, data) {
            if (groupApps == true){
                data['appGroup']._appButton.show(true);
                data['appGroup']._windowButtonBox.hide(true);
            } else {
                data['appGroup']._appButton.hide(true);
                data['appGroup']._windowButtonBox.show(true);
            }
        });
    },

    // Gets a list of every app on the current workspace
    _refreshApps: function () {
        // For each window, let's make sure we add it!
        this.metaWorkspace.list_windows().forEach(Lang.bind(this, function (win) {
            this._windowAdded(this.metaWorkspace, win);
        }));
    },

    _refreshList: function () {
        this._appList.forEach(function (app, data) {
            data['appGroup'].destroy();
        });
        this._appList = new OrderedHash();
        this._loadFavorites();
        this._refreshApps();
    },

    _appGroupNumber: function (parentApp) {
        let i = 0;
        let number;
        this._appList.forEach(function (app, data) {
            ++i;
            if (app == parentApp)
                number = i;
        });
        return number;
    },

    _refreshAppGroupNumber: function () {
        let i = 1;
        this._appList.forEach(function (app, data) {
            data['appGroup']._newAppKeyNumber(i);
            ++i;
        });
    },

    _windowAdded: function (metaWorkspace, metaWindow, favapp, isFavapp) {
        // Check to see if the window that was added already has an app group.
        // If it does, then we don't need to do anything.  If not, we need to
        // create an app group.
        //let tracker = Cinnamon.WindowTracker.get_default();
        let tracker = this._tracker;
        let app;
        try {
            if (favapp) app = favapp;
            else app = tracker.get_window_app(metaWindow);
        } catch (e) {
            //log(e.name + ': ' + e.message);
            return;
        }
        if (!this._appList.contains(app)) {
            let appGroup = new AppGroup(this._applet, this, app, isFavapp, this.orientation);
            appGroup._updateMetaWindows(metaWorkspace);
            appGroup.watchWorkspace(metaWorkspace);
            if (this._applet.settings.getValue("group-apps")) {
                appGroup.hideWindowButtons();
            } else {
                appGroup.hideAppButton();
            }

            this.actor.add_actor(appGroup.actor);

            // We also need to monitor the state 'cause some pesky apps (namely: plugin_container left over after fullscreening a flash video)
            // don't report having zero windows after they close
            app.connect('notify::state', Lang.bind(this, function (app) {
                if (app.state == Cinnamon.AppState.STOPPED && this._appList.contains(app)) {
                    this._removeApp(app);
                    appGroup._calcWindowNumber(metaWorkspace);
                }
            }));

            this._appList.set(app, {
                appGroup: appGroup,
            });
            let appGroupNum = this._appGroupNumber(app);
            appGroup._newAppKeyNumber(appGroupNum);

            if (this._applet.settings.getValue("title-display") == TitleDisplay.focused)
                appGroup.hideAppButtonLabel(false);
        }
    },

    _removeApp: function (app) {
        // This function may get called multiple times on the same app and so the app may have already been removed
        let appGroup = this._appList.get(app);
        if (appGroup) {
            if (appGroup['appGroup'].wasFavapp || appGroup['appGroup'].isFavapp) {
                appGroup['appGroup']._isFavorite(true);
                // have to delay to fix openoffice start-center bug 
                Mainloop.timeout_add(0, Lang.bind(this, this._refreshApps));
                return;
            }
            this._appList.remove(app);
            appGroup['appGroup'].destroy();
            Mainloop.timeout_add(15, Lang.bind(this, function () {
                this._refreshApps();
                this._refreshAppGroupNumber();
            }));
        }

    },

    _loadFavorites: function () {
        if (this._applet.settings.getValue("show-pinned") == false) return;
        let launchers = this._applet.settings.getValue("pinned-apps"),
            appSys = Cinnamon.AppSystem.get_default();
        for (let i = 0; i < launchers.length; ++i) {
            let app = appSys.lookup_app(launchers[i]);
            if (!app) app = appSys.lookup_settings_app(launchers[i]);
            if (!app) continue;
            this._windowAdded(this.metaWorkspace, null, app, true);
        }
    },

    _windowRemoved: function (metaWorkspace, metaWindow) {
        // When a window is closed, we need to check if the app it belongs
        // to has no windows left.  If so, we need to remove the corresponding AppGroup
        //let tracker = Cinnamon.WindowTracker.get_default();
        let tracker = this._tracker;
        let app;
        try {
            app = tracker.get_window_app(metaWindow);
        } catch (e) {
            //log(e.name + ': ' + e.message);
            return;
        }
        let hasWindowsOnWorkspace = app.get_windows().some(function (win) {
            return win.get_workspace() == metaWorkspace
        });
        if (app && !hasWindowsOnWorkspace) {
            this._removeApp(app);
        }
    },

    destroy: function () {
        this.signals.forEach(Lang.bind(this, function (s) {
            this.metaWorkspace.disconnect(s);
        }));
        this._appList.forEach(function (app, data) {
            data['appGroup'].destroy();
        });
        this._appList = null;
    }
};

// Manages window/app lists and takes care of
// hiding/showing them and manages switching workspaces, etc.

function MyApplet(metadata, orientation, panel_height, instance_id) {
    this._init(metadata, orientation, panel_height, instance_id);
}

MyApplet.prototype = {
    __proto__: Applet.Applet.prototype,

    _init: function (metadata, orientation, panel_height, instance_id) {
        Applet.Applet.prototype._init.call(this, orientation, panel_height, instance_id);
        try {
            this._uuid = metadata["uuid"];
            this.execInstallLanguage();
            Gettext.bindtextdomain(this._uuid, GLib.get_home_dir() + "/.local/share/locale");
            this.settings = new Settings.AppletSettings(this, "WindowListGroup@jake.phy@gmail.com", instance_id);
            this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "group-apps", "groupApps", null, null);
            this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "show-pinned", "showPinned", null, null);
            this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "arrange-pinnedApps", "arrangePinned", null, null);
            this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "enable-hover-peek", "enablePeek", null, null);
            this.settings.bindProperty(Settings.BindingDirection.IN, "onclick-thumbnails", "onclickThumbs", null, null);
            this.settings.bindProperty(Settings.BindingDirection.IN, "hover-peek-opacity", "peekOpacity", null, null);
            this.settings.bindProperty(Settings.BindingDirection.IN, "thumbnail-timeout", "thumbTimeout", null, null);
            this.settings.bindProperty(Settings.BindingDirection.IN, "thumbnail-size", "thumbSize", null, null);
            //this.settings.bindProperty(Settings.BindingDirection.IN, "sort-thumbnails", "sortThumbs", null, null);
            this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "vertical-thumbnails", "verticalThumbs", null, null);
            this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "stack-thumbnails", "stackThumbs", null, null);
            this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "show-thumbnails", "showThumbs", null, null);
            this.settings.bindProperty(Settings.BindingDirection.IN, "number-display", "numDisplay", null, null);
            this.settings.bindProperty(Settings.BindingDirection.IN, "title-display", "titleDisplay", null, null);
            this.settings.bindProperty(Settings.BindingDirection.IN, "icon-padding", "iconPadding", null, null);
            this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "pinned-apps", "pinnedApps", null, null);
            this.orientation = orientation;
            this.dragInProgress = false;

            this._box = new St.Bin();

            this.actor.add(this._box);
            this.actor.reactive = global.settings.get_boolean("panel-edit-mode");


            if (orientation == St.Side.TOP) {
                this.actor.style = 'margin-top: 0px; padding-top: 0px;';
            } else {
                this.actor.style = 'margin-bottom: 0px; padding-bottom: 0px;';
            }

            this.pinnedAppsContr = new PinnedFavs(this);
            appFavoritesInstance = this.pinnedAppsContr;

            this.metaWorkspaces = new OrderedHash();

            // Use a signal tracker so we don't have to keep track of all these id's manually!
            //  global.window_manager.connect('switch-workspace', Lang.bind(this, this._onSwitchWorkspace));
            //  global.screen.connect('notify::n-workspaces', Lang.bind(this, this._onWorkspaceCreatedOrDestroyed));
            //  Main.overview.connect('showing', Lang.bind(this, this._onOverviewShow));
            //  Main.overview.connect('hiding', Lang.bind(this, this._onOverviewHide));
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
            this._onSwitchWorkspace(null, null, global.screen.get_active_workspace_index());

            global.settings.connect('changed::panel-edit-mode', Lang.bind(this, this.on_panel_edit_mode_changed));
        } catch (e) {
            Main.notify("Error", e.message);
            global.logError(e);
        }
    },

    execInstallLanguage: function() {
        try {
            let _shareFolder = GLib.get_home_dir() + "/.local/share/";
            let _localeFolder = Gio.file_new_for_path(_shareFolder + "locale/");
            let _moFolder = Gio.file_new_for_path(_shareFolder + "cinnamon/applets/" + this._uuid + "/locale/mo/");

            let children = _moFolder.enumerate_children('standard::name,standard::type',
                                                       Gio.FileQueryInfoFlags.NONE, null);
            let info, child, _moFile, _moLocale, _moPath;
                   
            while ((info = children.next_file(null)) != null) {
                let type = info.get_file_type();
                if (type == Gio.FileType.REGULAR) {
                    _moFile = info.get_name();
                    if (_moFile.substring(_moFile.lastIndexOf(".")) == ".mo") {
                        _moLocale = _moFile.substring(0, _moFile.lastIndexOf("."));
                        _moPath = _localeFolder.get_path() + "/" + _moLocale + "/LC_MESSAGES/";
                        let src = Gio.file_new_for_path(String(_moFolder.get_path() + "/" + _moFile));
                        let dest = Gio.file_new_for_path(String(_moPath + this._uuid + ".mo"));
                        try {
                            //if(!this.equalsFile(dest.get_path(), src.get_path())) {
                            this._makeDirectoy(dest.get_parent());
                            src.copy(dest, Gio.FileCopyFlags.OVERWRITE, null, null);
                            //}
                        } catch(e) {
                            global.logError(e);
                        }
                    }
                }
            }
        } catch(e) {
            global.logError(e);
        }
    },

    _makeDirectoy: function(fDir) {
        if(!this._isDirectory(fDir))
            this._makeDirectoy(fDir.get_parent());
        if(!this._isDirectory(fDir))
            fDir.make_directory(null);
    },

    _isDirectory: function(fDir) {
        try {
            let info = fDir.query_filesystem_info("standard::type", null);
            if((info)&&(info.get_file_type() != Gio.FileType.DIRECTORY))
                return true;
        } catch(e) {
        }
        return false;
    },

    on_applet_clicked: function (event) {

    },

    on_panel_edit_mode_changed: function () {
        this.actor.reactive = global.settings.get_boolean("panel-edit-mode");
    },

    on_panel_height_changed: function () {
        this.metaWorkspaces.forEach(Lang.bind(this, function (ws, data) {
            data['appList']._refreshList();
        }));
    },

    pinned_app_contr: function () {
        let pinnedAppsContr = this.pinnedAppsContr;
        return pinnedAppsContr;
    },

    _onWorkspaceCreatedOrDestroyed: function () {
        let workspaces = [global.screen.get_workspace_by_index(i) for each(i in range(global.screen.n_workspaces))];
        // We'd like to know what workspaces in this.metaWorkspaces have been destroyed and
        // so are no longer in the workspaces list.  For each of those, we should destroy them
        let toDelete = [];
        this.metaWorkspaces.forEach(Lang.bind(this, function (ws, data) {
            if (workspaces.indexOf(ws) == -1) {
                data['appList'].destroy();
                toDelete.push(ws);
            }
        }));
        toDelete.forEach(Lang.bind(this, function (item) {
            this.metaWorkspaces.remove(item);
        }));
    },

    _onSwitchWorkspace: function (winManager, previousWorkspaceIndex, currentWorkspaceIndex) {
        let metaWorkspace = global.screen.get_workspace_by_index(currentWorkspaceIndex);
        // If the workspace we switched to isn't in our list,
        // we need to create an AppList for it
        if (!this.metaWorkspaces.contains(metaWorkspace)) {
            let appList = new AppList(this, metaWorkspace, this.orientation);
            this.metaWorkspaces.set(metaWorkspace, {
                'appList': appList
            });
        }

        // this.actor can only have one child, so setting the child
        // will automatically unparent anything that was previously there, which
        // is exactly what we want.
        this._box.set_child(this.metaWorkspaces.get(metaWorkspace)['appList'].actor);
        this.applistActor = this.metaWorkspaces.get(metaWorkspace)['appList'].actor;
        this.metaWorkspaces.get(metaWorkspace)['appList']._refreshApps();
    },

    _onOverviewShow: function () {
        this.actor.hide();
    },

    _onOverviewHide: function () {
        this.actor.show();
    },

    destroy: function () {
        this.signals.disconnectAll();
        this.actor.destroy();
        this.actor = null;
    }
};

function main(metadata, orientation, panel_height, instance_id) {
    let myApplet = new MyApplet(metadata, orientation, panel_height, instance_id);
    return myApplet;
}
