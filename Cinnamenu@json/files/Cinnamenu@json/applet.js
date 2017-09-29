// ES2015 polyfills for mozjs24
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/findIndex
// https://tc39.github.io/ecma262/#sec-array.prototype.findIndex
if (!Array.prototype.findIndex) {
  Object.defineProperty(Array.prototype, 'findIndex', {
    value: function(predicate) {
      // 1. Let O be ? ToObject(this value).
      if (this == null) {
        throw new TypeError('"this" is null or not defined');
      }

      let o = Object(this);

      // 2. Let len be ? ToLength(? Get(O, 'length')).
      let len = o.length >>> 0;

      // 3. If IsCallable(predicate) is false, throw a TypeError exception.
      if (typeof predicate !== 'function') {
        throw new TypeError('predicate must be a function');
      }

      // 4. If thisArg was supplied, let T be thisArg; else let T be undefined.
      let thisArg = arguments[1];

      // 5. Let k be 0.
      let k = 0;

      // 6. Repeat, while k < len
      while (k < len) {
        // a. Let Pk be ! ToString(k).
        // b. Let kValue be ? Get(O, Pk).
        // c. Let testResult be ToBoolean(? Call(predicate, T, kValue, k, O)).
        // d. If testResult is true, return k.
        let kValue = o[k];
        if (predicate.call(thisArg, kValue, k, o)) {
          return k;
        }
        // e. Increase k by 1.
        k++;
      }

      // 7. Return -1.
      return -1;
    }
  });
}

// https://tc39.github.io/ecma262/#sec-array.prototype.find
if (!Array.prototype.find) {
  Object.defineProperty(Array.prototype, 'find', {
    value: function(predicate) {
     // 1. Let O be ? ToObject(this value).
      if (this == null) {
        throw new TypeError('"this" is null or not defined');
      }

      var o = Object(this);

      // 2. Let len be ? ToLength(? Get(O, 'length')).
      var len = o.length >>> 0;

      // 3. If IsCallable(predicate) is false, throw a TypeError exception.
      if (typeof predicate !== 'function') {
        throw new TypeError('predicate must be a function');
      }

      // 4. If thisArg was supplied, let T be thisArg; else let T be undefined.
      var thisArg = arguments[1];

      // 5. Let k be 0.
      var k = 0;

      // 6. Repeat, while k < len
      while (k < len) {
        // a. Let Pk be ! ToString(k).
        // b. Let kValue be ? Get(O, Pk).
        // c. Let testResult be ToBoolean(? Call(predicate, T, « kValue, k, O »)).
        // d. If testResult is true, return kValue.
        var kValue = o[k];
        if (predicate.call(thisArg, kValue, k, o)) {
          return kValue;
        }
        // e. Increase k by 1.
        k++;
      }

      // 7. Return undefined.
      return undefined;
    }
  });
}

const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const GLib = imports.gi.GLib;
const CMenu = imports.gi.CMenu;
const Clutter = imports.gi.Clutter;
const Cinnamon = imports.gi.Cinnamon;
const St = imports.gi.St;
const Meta = imports.gi.Meta;
const Util = imports.misc.util;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;
const Lang = imports.lang;
const GnomeSession = imports.misc.gnomeSession;
const ScreenSaver = imports.misc.screenSaver;
const PopupMenu = imports.ui.popupMenu;
const AppFavorites = imports.ui.appFavorites;
const Applet = imports.ui.applet;
const Settings = imports.ui.settings;
const Tweener = imports.ui.tweener;
const SignalManager = imports.misc.signalManager;
const SearchProviderManager = imports.ui.searchProviderManager;
const FileUtils = imports.misc.fileUtils;

// Testing module imports for the extension refactor PR
// https://github.com/linuxmint/Cinnamon/pull/6878
let store, fuzzy, isEqual, sortBy, Chromium, Firefox, GoogleChrome, Opera,
  PlaceDisplay, CategoryListButton, AppListGridButton, GroupButton, _,
  REMEMBER_RECENT_KEY, ApplicationType, AppTypes, ApplicationsViewMode,
  fuzzyOptions, gridWidths;
if (typeof require !== 'undefined') {
  let utils = require('./utils');
  let buttons = require('./buttons');
  let constants = require('./constants');
  store = require('./store');
  fuzzy = require('./fuzzy').fuzzy;
  isEqual = utils.isEqual;
  sortBy = utils.sortBy;
  Chromium = require('./webChromium');
  Firefox = require('./webFirefox');
  GoogleChrome = require('./webGoogleChrome');
  Opera = require('./webOpera');
  PlaceDisplay = require('./placeDisplay');
  CategoryListButton = buttons.CategoryListButton;
  AppListGridButton = buttons.AppListGridButton;
  GroupButton = buttons.GroupButton;
  _ = constants._;
  REMEMBER_RECENT_KEY = constants.REMEMBER_RECENT_KEY;
  ApplicationType = constants.ApplicationType;
  AppTypes = constants.AppTypes;
  ApplicationsViewMode = constants.ApplicationsViewMode;
  fuzzyOptions = constants.fuzzyOptions;
  gridWidths = constants.gridWidths;
} else {
  const AppletDir = imports.ui.appletManager.applets['Cinnamenu@json'];
  store = AppletDir.store;
  fuzzy = AppletDir.fuzzy.fuzzy;
  isEqual = AppletDir.utils.isEqual;
  sortBy = AppletDir.utils.sortBy;
  Chromium = AppletDir.webChromium;
  Firefox = AppletDir.webFirefox;
  GoogleChrome = AppletDir.webGoogleChrome;
  Opera = AppletDir.webOpera;
  PlaceDisplay = AppletDir.placeDisplay;
  CategoryListButton = AppletDir.buttons.CategoryListButton;
  AppListGridButton = AppletDir.buttons.AppListGridButton;
  GroupButton = AppletDir.buttons.GroupButton;
  _ = AppletDir.constants._;
  REMEMBER_RECENT_KEY = AppletDir.constants.REMEMBER_RECENT_KEY;
  ApplicationType = AppletDir.constants.ApplicationType;
  AppTypes = AppletDir.constants.AppTypes;
  ApplicationsViewMode = AppletDir.constants.ApplicationsViewMode;
  fuzzyOptions = AppletDir.constants.fuzzyOptions;
  gridWidths = AppletDir.constants.gridWidths;
}

const addTo = function(instance, container, array) {
  array.push(instance);
  container.add_actor(instance.actor);
};

/**
 * @name bookmarksManager
 * @description Class to consolodate search of web browser(s) bookmarks
 * @description Code borrowed from SearchBookmarks extension by bmh1980
 * @description at https://extensions.gnome.org/extension/557/search-bookmarks/
 */
function bookmarksManager() {
  this._init.apply(this, arguments);
}

bookmarksManager.prototype = {

  _init: function () {
    let bookmarks = Chromium._readBookmarks()
      .concat(Firefox._readProfiles())
      .concat(GoogleChrome._readBookmarks())
      .concat(Opera._readBookmarks())

    for (let i = 0, len = bookmarks.length; i < len; i++) {
      bookmarks[i] = {
        app: bookmarks[i].appInfo,
        name: bookmarks[i].name,
        icon: bookmarks[i].appInfo.get_icon(),
        mime: null,
        uri: bookmarks[i].uri,
        description: bookmarks[i].uri,
        type: ApplicationType._places
      };
    }

    // Create a unique list of bookmarks across all browsers.
    this.state = {};
    for (let i = 0, len = bookmarks.length; i < len; i++ ) {
      this.state[bookmarks[i].uri] = bookmarks[i];
    }
    this.arrKeys = Object.keys(this.state);
  },

  destroy: function () {
    Chromium._reset();
    Firefox._reset();
    GoogleChrome._reset();
    Opera._reset();
    this.state = null;
  }
};

/**
 * @name CinnamenuApplet
 * @description The primary container class holding all of the menu's actors and related logic.
 */

function CinnamenuApplet() {
  this._init.apply(this, arguments)
}

CinnamenuApplet.prototype = {
  __proto__: Applet.TextIconApplet.prototype,

  _init: function(metadata, orientation, panel_height, instance_id) {
    Applet.TextIconApplet.prototype._init.call(this, orientation, panel_height, instance_id);
    this.setSchema(metadata.path, (knownProviders, enabledProviders) => {
      this.state = store.init({
        settings: {},
        knownProviders: knownProviders,
        enabledProviders: enabledProviders,
        theme: null,
        isListView: false,
        iconSize: 64,
        currentCategory: null,
        fallbackDescription: '',
        searchActive: false,
        menuIsOpen: false,
        isBumblebeeInstalled: GLib.file_test('/usr/bin/optirun', GLib.FileTest.EXISTS)
      });

      this.state.connect({
        clearEnteredActors: () => this._clearEnteredActors(),
        setKeyFocus: () => global.stage.set_key_focus(this.searchEntry),
        setSelectedTitleText: (text) => this.selectedAppTitle.set_text(text),
        setSelectedDescriptionText: (text) => this.selectedAppDescription.set_text(text),
        getSelectedTitleClutterText: () => this.selectedAppTitle.get_clutter_text(),
        getSelectedDescriptionClutterText: () => this.selectedAppDescription.get_clutter_text(),
        toggleSelectedTitleText: (bool) => bool ? this.selectedAppTitle.show() : this.selectedAppTitle.hide(),
        selectorMethod: (method, id) => this[method](id),
        openMenu: () => this.menu.open(),
        closeMenu: () => this.menu.close(),
        getAppsGridBoxWidth: () => this.applicationsGridBox.width,
        scrollToButton: (button) => this._scrollToButton(button),
        isNotInScrollView: (button) => this._isNotInScrollView(button),
        purgeRecentItems: () => this.recentManager.purge_items(),
        getActiveButtons: () => this.getActiveButtons(),
        isFavorite: (id) => this.appFavorites.isFavorite(id),
        addFavorite: (id) => this.appFavorites.addFavorite(id),
        removeFavorite: (id) => this.appFavorites.removeFavorite(id),
        setIsListView: () => {
          if (this.state.isListView) {
            this.state.set({iconSize: this.state.settings.appsListIconSize > 0 ? this.state.settings.appsListIconSize : 28});
          } else {
            this.state.set({iconSize: this.state.settings.appsGridIconSize > 0 ? this.state.settings.appsGridIconSize : 64});
          }
        }
      });

      this.setAllowedLayout(Applet.AllowedLayout.BOTH);
      this.createMenu(orientation);
      this.actor.connect('key-press-event', Lang.bind(this, this._onSourceKeyPress));

      this.settings = new Settings.AppletSettings(this.state.settings, metadata.uuid, instance_id);
      this._bindSettingsChanges();
      this.state.set({
        isListView: this.state.settings.startupViewMode === ApplicationsViewMode.LIST,
        fallbackDescription: this.state.settings.showAppDescriptionsOnButtons ? 'No description available' : ''
      });
      global.settings.connect('changed::enabled-search-providers', Lang.bind(this, this.onEnabledSearchProvidersChange));
      this.onEnabledSearchProvidersChange();

      this.signals = new SignalManager.SignalManager(null);
      this.displaySignals = new SignalManager.SignalManager(null);
      this._appletEnterEventId = 0;
      this._appletLeaveEventId = 0;
      this._appletHoverDelayId = 0;

      this.tracker = Cinnamon.WindowTracker.get_default();
      this.appSystem = Cinnamon.AppSystem.get_default();
      this.appFavorites = AppFavorites.getAppFavorites();
      this.privacy_settings = new Gio.Settings({
        schema_id: 'org.cinnamon.desktop.privacy'
      });
      this.signals.connect(this.privacy_settings, 'changed::' + REMEMBER_RECENT_KEY, Lang.bind(this, this.refresh));

      // FS search
      this._fileFolderAccessActive = false;
      this._pathCompleter = new Gio.FilenameCompleter();
      this._pathCompleter.set_dirs_only(false);

      this._updateActivateOnHover();
      this._updateKeybinding();
      this.signals.connect(Main.themeManager, 'theme-set', Lang.bind(this, this._updateIconAndLabel));
      this._updateIconAndLabel();

      // Connect gtk icontheme for when icons change
      this._iconTheme = Gtk.IconTheme.get_default();
      this.signals.connect(this._iconTheme, 'changed', Lang.bind(this, this._onIconsChanged));
      // Connect to AppSys for when new application installed
      this.signals.connect(this.appSystem, 'installed-changed', Lang.bind(this, this._onAppInstalledChanged));
      // Connect to AppFavorites for when favorites change
      this.signals.connect(this.appFavorites, 'changed', Lang.bind(this, this._onFavoritesChanged));
      this.signals.connect(this.menu, 'open-state-changed', Lang.bind(this, this._onOpenStateToggled));

      this.categoryButtons = [];
      this.powerGroupButtons = [];
      this._knownApps = [];
      this.applicationsByCategory = {};
      this.favorites = [];
      this._allItems = [];
      this._searchTimeoutId = 0;
      this._activeContainer = null;
      this._newInstance = true;
      this.expressionActive = false;
      this._searchWebErrorsShown = false;
      this.placesManager = null;
      this._displayed = false;
      this.menuHeight = 530;
      this._recentEnabled = this.privacy_settings.get_boolean(REMEMBER_RECENT_KEY);

      this.onEnableBookmarksChange(this.state.settings.enableBookmarks, true);
      this._session = new GnomeSession.SessionManager();
      this._screenSaverProxy = new ScreenSaver.ScreenSaverProxy();
      this.recentManager = Gtk.RecentManager.get_default();
    });
  },

  setSchema: function(path, cb) {
    let schema;
    let knownProviders = [];
    let enabledProviders = global.settings.get_strv('enabled-search-providers');
    let schemaFile = Gio.File.new_for_path(path + '/' + 'settings-schema.json');
    let backupSchemaFile = Gio.File.new_for_path(path + '/' + 'settings-schema-backup.json');
    let next = () => cb(knownProviders, enabledProviders);
    let [success, json] = schemaFile.load_contents(null);
    if (!success) return next();
    try {
      schema = JSON.parse(json);
    } catch (e) {
      return next();
    }
    // Back up the schema file if it doesn't have any modifications generated from this function.
    if (schema.layout.extensionProvidersSection.title !== 'Extensions') {
      success = schemaFile.copy(backupSchemaFile, Gio.FileCopyFlags.OVERWRITE, null, null)
      if (!success) return next();
    }
    let getMetaData = (dir, file, name) => {
      if (name.indexOf('@') === -1) {
        return null;
      }
      let fd = Gio.File.new_for_path(dir.get_path() + '/' + name + '/metadata.json');
      if (!fd.query_exists(null)) {
        return null;
      }
      let [success, json] = fd.load_contents(null);
      if (!success) {
        return null;
      }
      try {
        file = JSON.parse(json);
      } catch (e) {
        return null;
      }

      return file;
    };
    let buildSettings = (fds) => {
      // Build the schema file with the available search provider UUIDs.
      schema.layout.extensionProvidersSection.keys = [];
      let changed = false;
      for (let z = 0; z < fds.length; z++) {
        let [dir, files] = fds[z];
        for (let i = 0; i < files.length; i++) {
          let name = files[i].get_name();
          if (name.indexOf('@') === -1) {
            continue;
          }
          files[i] = getMetaData(dir, files[i], name);
          if (!files[i]) {
            continue;
          }
          changed = true;
          knownProviders.push(name);
          schema.layout.extensionProvidersSection.keys.push(files[i].uuid);
          schema[files[i].uuid] = {
            type: 'checkbox',
            default: false,
            description: files[i].name,
            tooltip: files[i].description,
            dependency: 'enable-search-providers'
          }
        }
      }

      // Write to file if there is a change in providers
      if (!changed || knownProviders.length === 0) {
        return next();
      }
      // The default title for the extensions section tells the user no extensions are found.
      schema.layout.extensionProvidersSection.title = 'Extensions';
      try {
        json = JSON.stringify(schema);
        let raw = schemaFile.replace(null, false, Gio.FileCreateFlags.NONE, null);
        let out = Gio.BufferedOutputStream.new_sized(raw, 4096);
        Cinnamon.write_string_to_stream(out, json);
        out.close(null);
      } catch (e) {
        // Restore from the backup schema if it exists
        if (backupSchemaFile.query_exists(null)) {
          backupSchemaFile.copy(schemaFile, Gio.FileCopyFlags.OVERWRITE, null, null)
        }
        return next();
      }
      next();
    };
    let providerFiles = [];
    let dataDir = Gio.File.new_for_path(global.datadir + '/search_providers');
    let userDataDir = Gio.File.new_for_path(global.userdatadir + '/search_providers');
    if (dataDir.query_exists(null)) {
      FileUtils.listDirAsync(dataDir, (files) => {
        providerFiles = providerFiles.concat([[dataDir, files]]);
        if (userDataDir.query_exists(null)) {
          FileUtils.listDirAsync(userDataDir, (files) => {
            providerFiles = providerFiles.concat([[userDataDir, files]]);
            buildSettings(providerFiles);
          });
        } else {
          buildSettings(providerFiles);
        }
      });
    } else if (userDataDir.query_exists(null)) {
      FileUtils.listDirAsync(userDataDir, (files) => {
        buildSettings([[userDataDir, files]]);
      });
    } else {
      if (backupSchemaFile.query_exists(null)) {
        backupSchemaFile.copy(schemaFile, Gio.FileCopyFlags.OVERWRITE, null, null)
      }
      next();
    }
  },

  update_label_visible: function() {
    if (this.orientation === St.Side.LEFT || this.orientation === St.Side.RIGHT) {
      this.hide_applet_label(true);
    } else {
      this.hide_applet_label(false);
    }
  },

  on_orientation_changed: function(orientation) {
    this.createMenu(orientation);
    this.update_label_visible();
    this.refresh();
    this._updateIconAndLabel();
  },

  on_applet_removed_from_panel: function() {
    Main.keybindingManager.removeHotKey('overlay-key-' + this.instance_id);
    this.settings.finalize();
    this.destroy();
  },

  on_applet_clicked: function() {
    this.menu.toggle_with_options(this.state.settings.enableAnimation);
  },

  _onSourceKeyPress: function(actor, event) {
    let symbol = event.get_key_symbol();
    if (symbol === Clutter.KEY_space || symbol === Clutter.KEY_Return) {
      this.menu.toggle();
      return true;
    } else if (symbol === Clutter.KEY_Escape && this.menu.isOpen && this.state.menuIsOpen == null) {
      this.menu.close();
      return true;
    } else if (symbol === Clutter.KEY_Down) {
      if (!this.menu.isOpen) {
        this.menu.toggle();
      }
      this.menu.actor.navigate_focus(this.actor, Gtk.DirectionType.DOWN, false);
      return true;
    } else {
      return false;
    }
  },

  _launch_editor: function () {
    Util.spawnCommandLine('cinnamon-menu-editor');
  },

  _updateKeybinding: function() {
    Main.keybindingManager.addHotKey('overlay-key-' + this.instance_id, this.state.settings.overlayKey, Lang.bind(this, function() {
      if (!Main.overview.visible && !Main.expo.visible) {
        this.menu.toggle_with_options(this.state.enableAnimation);
      }
    }));
  },

  _updateIconAndLabel: function() {
    try {
      if (this.state.settings.menuIconCustom) {
        if (this.state.settings.menuIcon === '') {
          this.set_applet_icon_name('');
        } else if (GLib.path_is_absolute(this.state.settings.menuIcon) && GLib.file_test(this.state.settings.menuIcon, GLib.FileTest.EXISTS)) {
          if (this.state.settings.menuIcon.search('-symbolic') !== -1) {
            this.set_applet_icon_symbolic_path(this.state.settings.menuIcon);
          } else {
            this.set_applet_icon_path(this.state.settings.menuIcon);
          }
        } else if (this._iconTheme.has_icon(this.state.settings.menuIcon)) {
          if (this.state.settings.menuIcon.search('-symbolic') !== -1) {
            this.set_applet_icon_symbolic_name(this.state.settings.menuIcon);
          } else {
            this.set_applet_icon_name(this.state.settings.menuIcon);
          }
        }
      } else {
        this._set_default_menu_icon();
      }
    } catch (e) {
      global.logWarning('Could not load icon file ' + this.state.settings.menuIcon + ' for menu button');
    }

    if (this.state.settings.menuIconCustom && this.state.settings.menuIcon === '') {
      this._applet_icon_box.hide();
    } else {
      this._applet_icon_box.show();
    }

    if (this.orientation === St.Side.LEFT || this.orientation === St.Side.RIGHT) {
      this.set_applet_label('');
    } else {
      if (!this.panelMenuLabelText || this.panelMenuLabelText.length > 0) {
        if (!this.state.settings.menuLabel) {
          this.state.settings.menuLabel = 'Menu';
        }
        this.set_applet_label(this.state.settings.menuLabel);
        this.set_applet_tooltip(this.state.settings.menuLabel);
      } else {
        this.set_applet_label('');
      }
    }
  },

  _set_default_menu_icon: function() {
    let path = global.datadir + '/theme/menu.svg';
    if (GLib.file_test(path, GLib.FileTest.EXISTS)) {
      this.set_applet_icon_path(path);
      return;
    }

    path = global.datadir + '/theme/menu-symbolic.svg';
    if (GLib.file_test(path, GLib.FileTest.EXISTS)) {
      this.set_applet_icon_symbolic_path(path);
      return;
    }
    // If all else fails, this will yield no icon
    this.set_applet_icon_path('');
  },

  createMenu: function (orientation) {
    this.orientation = orientation;
    this.menuManager = new PopupMenu.PopupMenuManager(this);
    this.menu = new Applet.AppletPopupMenu(this, this.orientation);
    this.menuManager.addMenu(this.menu);
    this.menu.setCustomStyleClass('menu-background');
  },

  openMenu: function() {
    if (!this._applet_context_menu.isOpen) {
      this.menu.open(this.state.settings.enableAnimation);
    }
  },

  _clearDelayCallbacks: function() {
    if (this._appletHoverDelayId > 0) {
      Mainloop.source_remove(this._appletHoverDelayId);
      this._appletHoverDelayId = 0;
    }
    if (this._appletLeaveEventId > 0) {
      this.actor.disconnect(this._appletLeaveEventId);
      this._appletLeaveEventId = 0;
    }
    return false;
  },

  _updateActivateOnHover: function() {
    if (this._appletEnterEventId > 0) {
      this.actor.disconnect(this._appletEnterEventId);
      this._appletEnterEventId = 0;
    }
    this._clearDelayCallbacks();
    if (this.state.settings.activateOnHover) {
      this._appletEnterEventId = this.actor.connect('enter-event', Lang.bind(this, function() {
        if (this.state.settings.hover_delay_ms > 0) {
          this._appletLeaveEventId = this.actor.connect('leave-event', Lang.bind(this, this._clearDelayCallbacks));
          this._appletHoverDelayId = Mainloop.timeout_add(this.state.settings.hover_delay_ms,
            Lang.bind(this, function() {
              this.openMenu();
              this._clearDelayCallbacks();
            }));
        } else {
          this.openMenu();
        }
      }));
    }
  },

  // handler for when new application installed
  _onAppInstalledChanged: function() {
    this.refresh();
  },

  // handler for when favorites change
  _onFavoritesChanged: function() {
    this.favorites = this.appFavorites.getFavorites();
    // Check if the menu has been rendered at least once
    if (this.applicationsGridBox && this.applicationsListBox) {
      this._switchApplicationsView(true);
    }
  },

  // handler for when icons change
  _onIconsChanged: function() {
    // AppFavorites' changed signal gets called before the applet finishes initializing, so
    // we need to defer it here for now.
    Mainloop.idle_add_full(Mainloop.PRIORITY_DEFAULT, Lang.bind(this, this.refresh));
  },

  searchProviderChange: function(provider) {
    return function onProviderChange() {
      let enabledProviders = global.settings.get_strv('enabled-search-providers');
      if (this.state.settings[provider] && enabledProviders.indexOf(provider) === -1) {
        enabledProviders.push(provider);
      } else {
        let providerIndex = enabledProviders.indexOf(provider);
        enabledProviders.splice(providerIndex, 1);
      }
      global.settings.set_strv('enabled-search-providers', enabledProviders);
    }
  },

  onEnabledSearchProvidersChange: function() {
    let enabledProviders = global.settings.get_strv('enabled-search-providers');
    this.state.set({enabledProviders: enabledProviders});
    // Synchronize search provider settings
    for (let i = 0; i < this.state.knownProviders.length; i++) {
      this.settings.setValue(this.state.knownProviders[i], enabledProviders.indexOf(this.state.knownProviders[i]) > -1);
    }
  },

  // function to bind preference setting changes
  _bindSettingsChanges: function() {
    let settingsProps = [{
        key: 'menu-icon-custom',
        value: 'menuIconCustom',
        cb: this._updateIconAndLabel
      },
      {
        key: 'menu-icon',
        value: 'menuIcon',
        cb: this._updateIconAndLabel
      },
      {
        key: 'activate-on-hover',
        value: 'activateOnHover',
        cb: this._updateActivateOnHover
      },
      {
        key: 'hover-delay',
        value: 'hover_delay_ms',
        cb: this._updateActivateOnHover
      },
      {
        key: 'overlay-key',
        value: 'overlayKey',
        cb: this._updateKeybinding
      },
      {
        key: 'enable-animation',
        value: 'enableAnimation',
        cb: null
      },
      {
        key: 'enable-autoscroll',
        value: 'enableAutoScroll',
        cb: this.refresh
      },
      {
        key: 'enable-bookmarks',
        value: 'enableBookmarks',
        cb: this.onEnableBookmarksChange
      },
      {
        key: 'enable-windows',
        value: 'enableWindows',
        cb: null
      },
      {
        key: 'enable-search-providers',
        value: 'enableSearchProviders',
        cb: null
      },
      {
        key: 'menu-label',
        value: 'menuLabel',
        cb: this._updateIconAndLabel
      },
      {
        key: 'startup-view-mode',
        value: 'startupViewMode',
        cb: this.refresh
      },
      {
        key: 'apps-grid-column-count',
        value: 'appsGridColumnCount',
        cb: this.refresh
      },
      {
        key: 'category-icon-size',
        value: 'categoryIconSize',
        cb: this.refresh
      },
      {
        key: 'apps-list-icon-size',
        value: 'appsListIconSize',
        cb: this.refresh
      },
      {
        key: 'apps-grid-icon-size',
        value: 'appsGridIconSize',
        cb: this.refresh
      },
      {
        key: 'show-places',
        value: 'showPlaces',
        cb: this.refresh
      },
      {
        key: 'show-application-icons',
        value: 'showApplicationIcons',
        cb: this.refresh
      },
      {
        key: 'show-category-icons',
        value: 'showCategoryIcons',
        cb: this.refresh
      },
      {
        key: 'search-filesystem',
        value: 'searchFilesystem',
        cb: this.refresh
      },
      {
        key: 'show-apps-description-on-buttons',
        value: 'showAppDescriptionsOnButtons',
        cb: this.refresh
      },
    ]

    for (let i = 0; i < this.state.knownProviders.length; i++) {
      let provider = this.state.knownProviders[i];
      settingsProps.push({
        key: provider,
        value: provider,
        cb: this.searchProviderChange(provider)
      });
    }

    for (let i = 0, len = settingsProps.length; i < len; i++) {
      this.settings.bind(
        settingsProps[i].key,
        settingsProps[i].value,
        settingsProps[i].cb ? Lang.bind(this, settingsProps[i].cb) : null
      );
    }
  },

  introspectTheme: function(cb) {
    let appletMenuThemeNode = this.menu.actor.get_theme_node();
    let mainBoxThemeNode = this.mainBox.get_theme_node();
    this.state.set({theme: {
      backgroundColor: appletMenuThemeNode.get_background_color().to_string().substring(0, 7),
      foregroundColor: appletMenuThemeNode.get_foreground_color().to_string().substring(0, 7),
      borderColor: appletMenuThemeNode.get_border_color(St.Side.TOP).to_string().substring(0, 7),
      mainBoxBorderColor: mainBoxThemeNode.get_foreground_color().to_string().substring(0, 7),
      borderRadius: appletMenuThemeNode.get_border_radius(St.Corner.TOPRIGHT),
      padding: mainBoxThemeNode.get_padding(St.Side.TOP),
    }});
    if (typeof cb === 'function') {
      Mainloop.idle_add_full(Mainloop.PRIORITY_DEFAULT, cb);
    }
  },

  _onOpenStateToggled: function(menu, open) {
    if (global.settings.get_boolean('panel-edit-mode')) {
      return false;
    }
    if (this._appletEnterEventId > 0) {
      this.actor.handler_block(this._appletEnterEventId);
    }
    if (open) {
      if (!this._displayed) {
        this._display();
      }

      this.introspectTheme(()=>{
        // Load Startup Applications category
        this._switchApplicationsView(false);
        // Set Category
        this.categoriesBox.show();
        // Display startup apps
        this._resetDisplayApplicationsToStartup();
        // Set height (we also set constraints on scrollboxes
        // Why does height need to be set when already set constraints? because of issue noted below
        // ISSUE: If height isn't set, then popup menu height will expand when application buttons are added
        let height = this.groupCategoriesWorkspacesScrollBox.height;
        this.applicationsScrollBox.height = height;
        this.mainBox.show();
      });
    } else {
      // Clear 'entered' actor
      if (this._appletEnterEventId > 0) {
        this.actor.handler_unblock(this._appletEnterEventId);
      }
      if (this.state.searchActive) {
        this.resetSearch();
      }
      this._clearEnteredActors();
      this._clearApplicationsBox();
    }
    return true;
  },

  onEnableBookmarksChange: function(enableBookmarks, fromInit = false) {
    if (enableBookmarks) {
      this.bookmarksManager = new bookmarksManager();
    } else if (this.bookmarksManager) {
      this.bookmarksManager.destroy();
      this.bookmarksManager = null;
    }
    if (!fromInit) {
      this.refresh();
    }
  },

  refresh: function() {
    this._clearAll();
    this.destroyDisplayed();
    this._displayed = false;
    this._display();
    this._clearEnteredActors();
    this.destroyAppButtons();
  },

  _clearAll: function() {
    this.menu.removeAll();
  },

  getActiveButtons: function() {
    let buttons = [];
    let children = this._activeContainer.get_children();
    for (let i = 0; i < children.length; i++) {
      buttons.push(store.queryCollection(this._allItems, function(button) {
        return button && isEqual(button.actor, children[i])
      }));
    }
    return buttons;
  },

  _loadAppCategories: function(dir, rootDir, dirId) {
    let iter = dir.iter();
    let nextType;
    while ((nextType = iter.next()) !== CMenu.TreeItemType.INVALID) {
      if (nextType === CMenu.TreeItemType.ENTRY) {
        let entry = iter.get_entry();
        if (!entry.get_app_info().get_nodisplay()) {
          let id = entry.get_desktop_file_id();
          let app = this.appSystem.lookup_app(id);
          if (rootDir && typeof rootDir.get_menu_id === 'function') {
            let rootDirId = rootDir.get_menu_id();
            if (rootDirId) {
              this.applicationsByCategory[rootDirId].push(app);
            }
          } else {
            if (dirId) {
              this.applicationsByCategory[dirId].push(app);
            }
          }
          let appIsKnown = this._knownApps.indexOf(id) > -1;
          if (!appIsKnown) {
            if (!this._newInstance) {
              app.shouldHighlight = true;
            } else {
              this._knownApps.push(id);
            }
          }
        }
      } else if (nextType === CMenu.TreeItemType.DIRECTORY) {
        if (rootDir) {
          this._loadAppCategories(iter.get_directory(), rootDir, null);
        } else {
          this._loadAppCategories(iter.get_directory(), dir, dirId);
        }
      }
    }
  },

  _buildCategories: function () {
    let sortDirs = (dirs) => {
      dirs.sort(function(a, b) {
        let prefCats = ['administration', 'preferences'];
        let menuIdA = a.get_menu_id().toLowerCase();
        let menuIdB = b.get_menu_id().toLowerCase();
        let prefIdA = prefCats.indexOf(menuIdA);
        let prefIdB = prefCats.indexOf(menuIdB);
        if (prefIdA < 0 && prefIdB >= 0) {
          return -1;
        }
        if (prefIdA >= 0 && prefIdB < 0) {
          return 1;
        }
        let nameA = a.get_name().toLowerCase();
        let nameB = b.get_name().toLowerCase();
        if (nameA > nameB) {
          return 1;
        }
        if (nameA < nameB) {
          return -1;
        }
        return 0;
      });
      return dirs;
    };
    // Load 'bookmarks' category
    if (this.state.settings.enableBookmarks) {
      addTo(new CategoryListButton(this.state, 'bookmarks', _('Bookmarks'), 'emblem-favorite', '_selectWebBookmarks'), this.categoriesBox, this.categoryButtons)
    }
    // Load 'all applications' category
    addTo(new CategoryListButton(this.state, 'all', _('All Applications'), 'computer'), this.categoriesBox, this.categoryButtons)

    let trees = [this.appSystem.get_tree()];
    for (let i = 0, len = trees.length; i < len; i++) {
      let tree = trees[i];
      let root = tree.get_root_directory();
      let dirs = [];
      let iter = root.iter();
      let nextType;
      while ((nextType = iter.next()) !== CMenu.TreeItemType.INVALID) {
        if (nextType === CMenu.TreeItemType.DIRECTORY) {
          dirs.push(iter.get_directory());
        }
      }
      dirs = sortDirs(dirs)
      for (let z = 0, len = dirs.length; z < len; z++) {
        let dir = dirs[z];
        if (dir.get_is_nodisplay()) {
          continue;
        }
        let dirId = dir.get_menu_id();
        this.applicationsByCategory[dirId] = [];
        this._loadAppCategories(dir, null, dirId);
        if (this.applicationsByCategory[dirId].length > 0) {
          this.categoryButtons.push(new CategoryListButton(this.state, dir, dirId));
          this.categoriesBox.add_actor(this.categoryButtons[this.categoryButtons.length - 1].actor);
        }
      }
    }
    // Load 'places' category
    if (this.state.settings.showPlaces) {
      addTo(new CategoryListButton(this.state, 'places', _('Places'), 'folder', '_selectAllPlaces'), this.categoriesBox, this.categoryButtons)
    }
    // Load 'recent' category
    if (this._recentEnabled) {
      addTo(new CategoryListButton(this.state, 'recent', _('Recent Files'), 'folder-recent', '_selectRecent'), this.categoriesBox, this.categoryButtons)
    }
    // Load 'favorite applications' category
    addTo(new CategoryListButton(this.state, 'favorites', _('Favorite Apps'), 'address-book-new'), this.categoriesBox, this.categoryButtons)
  },

  _selectCategory: function(categoryId) {
    this._clearApplicationsBox();
    this._displayApplications(this.listApplications(categoryId));
  },

  _selectAllPlaces: function() {
    this._clearApplicationsBox();
    let places = this.listPlaces()
      .concat(this.listBookmarks())
      .concat(this.listDevices());
    this._displayApplications(places);
  },

  _selectRecent: function() {
    this._clearApplicationsBox();
    this._displayApplications(this.listRecent());
  },

  _selectWebBookmarks: function() {
    this._clearApplicationsBox();
    this._displayApplications(this.listWebBookmarks());
  },

  _switchApplicationsView: function(fromToggle) {
    let isListView = this.state.settings.startupViewMode === ApplicationsViewMode.LIST, iconSize;
    if (isListView) {
      iconSize = this.state.settings.appsListIconSize > 0 ? this.state.settings.appsListIconSize : 28;
    } else {
      iconSize = this.state.settings.appsGridIconSize > 0 ? this.state.settings.appsGridIconSize : 64;
    }
    this.state.set({
      isListView: isListView,
      iconSize: iconSize
    });
    if (isListView) {
      this._lastGridWidth = this.applicationsGridBox.width
      this.applicationsGridBox.width = this.applicationsListBox.width;
      this.applicationsGridBox.hide();
      this.applicationsListBox.show();
    } else {
      this.applicationsGridBox.width = gridWidths[this.state.settings.appsGridColumnCount];
      this.applicationsListBox.hide();
      this.applicationsGridBox.show();
    }
    // switch activeContainer
    if (isEqual(this._activeContainer, this.applicationsListBox) || isEqual(this._activeContainer, this.applicationsListBox)) {
      // reset active container
      this._activeContainer = isListView ? this.applicationsListBox : this.applicationsGridBox;
      // reset scroll to top
      let vscroll = this.applicationsScrollBox.get_vscroll_bar();
      let newScrollValue = this.applicationsScrollBox.get_allocation_box().y1;
      vscroll.get_adjustment().set_value(newScrollValue);
    }
    this._clearEnteredActors();
    this._clearApplicationsBox();
    if (fromToggle) {
      this.destroyAppButtons();
      this._resetDisplayApplicationsToStartup();
    }
  },

  _isNotInScrollView: function (button) {
    let adjustment = this.applicationsScrollBox.get_vscroll_bar().get_adjustment();
    let currentScrollValue = adjustment.get_value();
    let boxHeight = this.applicationsScrollBox.get_allocation_box().y2 - this.applicationsScrollBox.get_allocation_box().y1;
    let allocationBox = button.actor.get_allocation_box();
    return boxHeight + currentScrollValue < allocationBox.y2 + 100;
  },

  _scrollToButton: function(button) {
    // Based on https://github.com/GNOME/gnome-shell/blob/817ff52414d18eb11cb97141c594e79d3e0c0512/js/misc/util.js#L403
    let adjustment = this.applicationsScrollBox.vscroll.adjustment;
    let [value, lower, upper, stepIncrement, pageIncrement, pageSize] = adjustment.get_values();
    let offset = 0;
    let vfade = this.applicationsScrollBox.get_effect('fade');
    if (vfade) {
      offset = vfade.vfade_offset;
    }
    let box = button.actor.get_allocation_box();
    let y1 = box.y1, y2 = box.y2;
    let parent = button.actor.get_parent();
    while (parent !== this.applicationsScrollBox) {
      if (!parent) {
        return false;
      }
      let box = parent.get_allocation_box();
      y1 += box.y1;
      y2 += box.y1;
      parent = parent.get_parent();
    }
    if (y1 < value + offset) {
      value = Math.max(0, y1 - offset);
    } else if (y2 > value + pageSize - offset) {
      value = Math.min(upper, y2 + offset - pageSize);
    } else {
      return false;
    }
    if (this.state.settings.enableAnimation) {
      Tweener.addTween(adjustment, {
        value: value,
        time: 0.1,
        transition: 'easeOutQuad'
      });
    } else {
      adjustment.set_value(value);
    }
  },

  _clearEnteredActors: function () {
    //this.state.isListView = this.state.settings.startupViewMode === ApplicationsViewMode.LIST;
    this._activeContainer = this.state.isListView ? this.applicationsListBox : this.applicationsGridBox;
    let buttons = this.getActiveButtons();
    let refItemIndex = store.queryCollection(buttons, (button) => {
      return (button.actor.has_style_class_name('menu-application-button-selected')
          || button.entered != null
          || button.menu.isOpen);
    }, {indexOnly: true});
    if (refItemIndex > -1 && buttons[refItemIndex]) {
      if (buttons[refItemIndex].menu.isOpen) {
        buttons[refItemIndex].closeMenu();
      }
      buttons[refItemIndex].handleLeave();
    }
    let refCategoryIndex = this.categoryButtons.findIndex(function(button) {
      return button.entered != null;
    });
    if (refCategoryIndex > -1 && this.categoriesBox[refCategoryIndex]) {
      this.categoriesBox[refCategoryIndex].handleLeave();
    }
    let refPowerGroupItemIndex = this.powerGroupButtons.findIndex(function(button) {
      return button.entered != null;
    });
    if (refPowerGroupItemIndex > -1 && this.powerGroupButtons[refPowerGroupItemIndex]) {
      this.powerGroupButtons[refPowerGroupItemIndex].handleLeave();
    }
  },

  _clearApplicationsBox: function() {
    if (!this.state.searchActive) {
      this.answerText.set_text('');
      this.answerText.hide();
    }
    if (this.applicationsListBox) {
      let listActors = this.applicationsListBox.get_children();
      if (listActors) {
        for (let i = 0, len = listActors.length; i < len; i++) {
          this.applicationsListBox.remove_child(listActors[i]);
        }
      }
    }

    if (this.applicationsGridBox) {
      let gridActors = this.applicationsGridBox.get_children();
      if (gridActors) {
        for (let i = 0, len = gridActors.length; i < len; i++) {
          this.applicationsGridBox.remove_child(gridActors[i]);
        }
      }
    }
  },

  listWindows: function(pattern) {
    if (!this.state.settings.enableWindows) {
      return [];
    }
    let windows = [];
    let indexes = Array(global.screen.get_n_workspaces());
    for (let i = 0; i < indexes.length; i++) {
      windows = windows.concat(global.screen.get_workspace_by_index(i).list_windows())
    }
    let res = [];
    let searchableProps = ['title', 'description'];
    for (let i = 0, len = windows.length; i < len; i++) {
      if (!windows[i] || !windows[i].title) {
        continue;
      }
      let match = null;
      let app = this.tracker.get_window_app(windows[i]);
      if (!app || !app.name) {
        continue;
      }
      windows[i].description = app.name;
      for (let z = 0; z < searchableProps.length; z++) {
        match = fuzzy(pattern, windows[i][searchableProps[z]], fuzzyOptions)
        if (match.score > 0.2) {
          windows[i]._icon = app.create_icon_texture(this.state.iconSize);
          windows[i].type = ApplicationType._windows;
          windows[i].name = windows[i].title;
          windows[i].score = match.score;
          res.push(windows[i]);
          break;
        }
      }
    }
    return res;
  },

  listSearchProviders: function(pattern, cb) {
    SearchProviderManager.launch_all(pattern, (provider, results) => {
      for (let i = 0; i < results.length; i++) {
        if (!results[i]) {
          continue;
        }
        results[i].type = ApplicationType._providers;
        results[i].name = results[i].label.replace(/ : /g, ': ');
        results[i].activate = provider.on_result_selected;
        if (results[i].icon) {
          results[i].icon.icon_size = this.state.iconSize;
        } else if (results[i].icon_app){
          results[i].icon = results[i].icon_app.create_icon_texture(this.state.iconSize);
        } else if (results[i].icon_filename){
          results[i].icon = new St.Icon({
            gicon: new Gio.FileIcon({file: Gio.file_new_for_path(results[i].icon_filename)}),
            icon_size: this.state.iconSize
          });
        }
      }
      cb(results);
    });
  },

  listPlaces: function(pattern) {
    if (!this.placesManager || !this.state.settings.showPlaces) {
      return [];
    }
    let places = this.placesManager.getDefaultPlaces();
    let res = [];
    for (let i = 0, len = places.length; i < len; i++) {
      if (!pattern || places[i].name.toLowerCase().indexOf(pattern) !== -1) {
        places[i].type = ApplicationType._places;
        places[i].description = places[i].file.get_path();
        res.push(places[i]);
      }
    }
    return res;
  },

  listBookmarks: function(pattern) {
    if (!this.placesManager || !this.state.settings.showPlaces) {
      return [];
    }
    let bookmarks = this.placesManager.getBookmarks();
    let res = [];
    for (let i = 0, len = bookmarks.length; i < len; i++) {
      if (!pattern || bookmarks[i].name.toLowerCase().indexOf(pattern) !== -1) {
        bookmarks[i].type = ApplicationType._places;
        bookmarks[i].description = bookmarks[i].file.get_path();
        res.push(bookmarks[i]);
      }
    }
    return res;
  },

  listWebBookmarks: function(pattern) {
    if (!this.state.settings.enableBookmarks) {
      return [];
    }
    if (!this._searchWebErrorsShown && !Firefox.Gda) {
      let notifyMessage = _('gir1.2-gda-5.0 package required for Firefox and Midori bookmarks.');
      this.answerText.set_text(notifyMessage);
      this.answerText.show();
    } else if (this.answerText.is_visible() && !this.expressionActive) {
      this.answerText.hide();
    }
    this._searchWebErrorsShown = true;

    let res = []
    let arr = this.bookmarksManager.state;
    let arrKeys = this.bookmarksManager.arrKeys;
    let searchableProps = ['name', 'description'];

    for (let i = 0, len = arrKeys.length; i < len; i++ ) {
      let bookmark = arr[arrKeys[i]];
      if (!bookmark) {
        continue;
      }
      let match = null;
      if (pattern) {
        for (let z = 0, len = searchableProps.length; z < len; z++ ) {
          match = fuzzy(pattern, bookmark[searchableProps[z]], fuzzyOptions)
          if (bookmark[searchableProps[z]] && match.score > 0.2) {
            bookmark.score = match.score;
            bookmark[searchableProps[z]] = match.result;
            res.push(bookmark);
            break;
          }
        }
      }
      if (!pattern) {
        res.push(bookmark);
      }
    }

    return res;
  },

  listDevices: function(pattern) {
    if (!this.placesManager) {
      return null;
    }
    let devices = this.placesManager.getMounts();
    let res = [];
    for (let i = 0, len = devices.length; i < len; i++) {
      if (!pattern || devices[i].name.toLowerCase().indexOf(pattern) !== -1) {
        devices[i].type = ApplicationType._places;
        devices[i].description = devices[i].file.get_path();
        res.push(devices[i]);
      }
    }
    return res;
  },

  listRecent: function(pattern) {
    if (!this._recentEnabled) {
      return [];
    }

    let recentFiles = this.recentManager.get_items();
    let res = []

    for (let i = 0; i < 23; i++) {
      if (!recentFiles[i]) {
        continue;
      }
      let recentInfo = recentFiles[i];
      if (recentInfo.exists()) {
        res.push({
          name: recentInfo.get_display_name(),
          icon: recentInfo.get_gicon(),
          uri: recentInfo.get_uri(),
          description: recentInfo.get_uri(),
          type: ApplicationType._recent
        });
      }
    }

    if (res.length > 0) {
      res.push({
        name: _('Clear List'),
        clearList: true,
        icon: new St.Icon({
          icon_name: 'edit-clear',
          icon_type: St.IconType.SYMBOLIC
        }),
        uri: '',
        description: '',
        type: ApplicationType._recent
      });
    } else if (!pattern) {
      this.answerText.set_text(_('No recent documents'));
      this.answerText.show();
    }

    if (pattern) {
      let _res = [];
      let searchableProps = ['name', 'description'];

      for (let i = 0, len = res.length; i < len; i++) {
        let recentItem = res[i];
        let match = null;
        if (pattern) {
          for (let z = 0, len = searchableProps.length; z < len; z++) {
            match = fuzzy(pattern, recentItem[searchableProps[z]], fuzzyOptions)
            if (recentItem[searchableProps[z]] && match.score > 0.6) {
              recentItem.score = match.score;
              recentItem[searchableProps[z]] = match.result;
              _res.push(recentItem);
              break;
            }
          }
        }
      }

      res = _res;
    }
    return res;
  },

  listApplications: function(categoryMenuId, pattern) {
    let res = [];

    if (categoryMenuId === 'favorites') {
      res = this.favorites;
    } else {
      if (categoryMenuId && categoryMenuId !== 'all') {
        res = this.applicationsByCategory[categoryMenuId];
      } else {
        for (let directory in this.applicationsByCategory) {
          res = res.concat(this.applicationsByCategory[directory])
        }
      }
    }

    if (pattern) {
      let _res = [];
      let searchableProps = ['name', 'keywords', 'description'];

      for (let i = 0, len = res.length; i < len; i++) {
        Object.assign(res[i], {
          name: res[i].get_name(),
          keywords: res[i].get_name(),
          description:res[i].get_description(),
          id: res[i].get_id(),
          type: ApplicationType._applications
        });

        let match = null;
        for (let z = 0, len = searchableProps.length; z < len; z++ ) {
          if (this.state.settings.enableWindows && res[i].state > 0) {
            continue;
          }
          match = fuzzy(pattern, res[i][searchableProps[z]], fuzzyOptions)
          if (res[i][searchableProps[z]] && match.score > 0.2) {
            res[i].score = match.score;
            res[i][searchableProps[z]] = match.result;
            _res.push(res[i]);
            break;
          }
        }
      }
      res = _res;
      _res = null;
    }

    // Ignore favorites when sorting
    if (categoryMenuId !== 'favorites' && res === undefined) {
      res = [];
    }

    for (let i = 0, len = res.length; i < len; i++) {
      let obj = res[i].hasOwnProperty('item') ? res[i].item : res[i];
      if (!obj.hasOwnProperty('name')) {
        obj.name = obj.get_name();
      }
      if (!obj.hasOwnProperty('description')) {
        obj.description = obj.get_description();
      }
    }

    // Ensure unique elements
    let uniqueSet = new Set();
    let items = [];
    for (let i = 0; i < res.length; i++) {
      if (uniqueSet.has(res[i]) === false) {
        items.push(res[i]);
        uniqueSet.add(res[i]);
      }
    }
    res = undefined;
    return items;
  },

  _resetDisplayApplicationsToStartup: function() {
    this.resetSearch();
    this._selectCategory('favorites');
  },

  _displayApplications: function(appList) {
    //dt.start();
    if (!appList) {
      return false;
    }
    if (this.mainBox && !this.state.theme) {
      this.introspectTheme(() => this._displayApplications(appList));
      return false;
    }

    let column = 0;
    let columnsCount = 0;
    let rownum = 0;
    let lastApp = appList[appList.length - 1];

    //this.state.isListView = this.state.settings.startupViewMode === ApplicationsViewMode.LIST;
    this._activeContainer = this.state.isListView ? this.applicationsListBox : this.applicationsGridBox;
    this.state.menuIsOpen = null;

    let createAppButton = (app, appType, len, appIndex)=>{
      let appButton;
      let refAppButton = -1;
      for (let i = 0, _len = this._allItems.length; i < _len; i++) {
        if (this._allItems[i] && isEqual(this._allItems[i].buttonState.app, app)) {
          refAppButton = i;
          break;
        }
      }
      if (refAppButton > -1 && this._allItems[refAppButton]) {
        appButton = this._allItems[refAppButton];
        appButton.buttonState.set({
          app: app,
          appType: appType,
          appListLength: len,
          appIndex: appIndex
        });
      } else {
        appButton = new AppListGridButton(this.state, app, appType, appIndex, len);
        this._allItems.push(appButton);
      }

      if (this.state.isListView) {
        this.applicationsListBox.add_child(appButton.actor);
      } else {
        let gridLayout = this.applicationsGridBox.layout_manager;
        if (!gridLayout) {
          return false;
        }
        gridLayout.attach(appButton.actor, column, rownum, 1, 1);
        column++;
        if (column > columnsCount) {
          columnsCount = column;
        }
        if (column > this.state.settings.appsGridColumnCount - 1) {
          column = 0;
          rownum++;
        }
        appButton.setColumn(column);
      }
    };

    if (!this.state.searchActive && lastApp && !lastApp.clearList) {
      sortBy(appList, 'name', 'asc');
    }
    let index = -1;
    for (let z = 0, len = appList.length; z < len; z++) {
      if (appList[z].type === undefined) {
        appList[z].type = ApplicationType._applications;
      }

      for (let y = 0, len = AppTypes.length; y < len; y++) {
        if (ApplicationType[AppTypes[y]] !== appList[z].type) {
          continue;
        }
        index += 1;
        createAppButton(appList[z], appList[z].type, len, index);
      }
    }
    this.columnsCount = columnsCount;
    //dt.stop();
  },

  _onMenuKeyPress: function(actor, event) {
    //this.state.isListView = this.state.settings.startupViewMode === ApplicationsViewMode.LIST;
    let symbol = event.get_key_symbol();

    let keyCode = event.get_key_code();
    let modifierState = Cinnamon.get_event_state(event);

    /* check for a keybinding and quit early, otherwise we get a double hit
       of the keybinding callback */
    let action = global.display.get_keybinding_action(keyCode, modifierState);

    if (action === Meta.KeyBindingAction.CUSTOM) {
      return true;
    }

    let ctrlKey = modifierState & Clutter.ModifierType.CONTROL_MASK || symbol === 65507 || symbol === 65508;

    let buttons = this.getActiveButtons();
    let refItemIndex = store.queryCollection(buttons, (button) => {
      return (button.actor.has_style_class_name('menu-application-button-selected')
          || button.entered != null
          || button.menu.isOpen);
    }, {indexOnly: true});

    let refCategoryIndex = this.categoryButtons.findIndex((button) => {
      return button.entered != null;
    });

    let refPowerGroupItemIndex = this.powerGroupButtons.findIndex((button) => {
      return button.entered != null;
    });

    let contextMenuChildren = [];
    let refContextMenuItemIndex = -1;

    let enteredItemExists = refItemIndex > -1 && buttons[refItemIndex] != null;
    let enteredCategoryExists = refCategoryIndex > -1 && this.categoryButtons[refCategoryIndex] != null;
    let enteredPowerGroupItemExists = refPowerGroupItemIndex > -1 && this.powerGroupButtons[refPowerGroupItemIndex] != null;
    let enteredContextMenuItemExists = false;

    if (enteredItemExists) {
      if ((ctrlKey || buttons[refItemIndex].menu.isOpen)
        && buttons[refItemIndex].menu.box) {
        contextMenuChildren = buttons[refItemIndex].contextMenuButtons;
        refContextMenuItemIndex = contextMenuChildren.findIndex((button) => {
          return button.entered != null;
        });
        enteredContextMenuItemExists = refContextMenuItemIndex > -1 && contextMenuChildren[refContextMenuItemIndex] != null;
        if (enteredContextMenuItemExists) {
          contextMenuChildren[refContextMenuItemIndex].handleLeave();
        } else {
          buttons[refItemIndex].handleLeave();
        }
      } else {
        buttons[refItemIndex].handleLeave();
      }

    }
    if (enteredCategoryExists) {
      this.categoryButtons[refCategoryIndex].handleLeave();
    }
    if (enteredPowerGroupItemExists) {
      this.powerGroupButtons[refPowerGroupItemIndex].handleLeave();
    }
    /*log2('symbol', symbol)
    log2('refItemIndex', refItemIndex, 'refCategoryIndex', refCategoryIndex, 'refPowerGroupItemIndex', refPowerGroupItemIndex, 'refContextMenuItemIndex', refContextMenuItemIndex)
    log2('this.state.isListView', this.state.isListView)*/
    let startingCategoryIndex = this.categoryButtons.findIndex((button) => {
      return this.state.currentCategory === button.categoryNameText;
    });
    startingCategoryIndex = this.state.settings.enableBookmarks && startingCategoryIndex <= 0 ? 1 : startingCategoryIndex;

    const previousItemNavigation = (index) => {
      let up = (typeof buttons[index] === 'undefined' && enteredItemExists
        || typeof this.categoryButtons[refCategoryIndex - 1] === 'undefined' && enteredCategoryExists
        || typeof this.powerGroupButtons[refPowerGroupItemIndex - 1] === 'undefined' && enteredPowerGroupItemExists);
      if (index < 0) {
        index = 0;
      }
      if (contextMenuChildren[index] && refContextMenuItemIndex !== index) {
        contextMenuChildren[index]._delegate.handleEnter();
      } else if (enteredItemExists && buttons[refItemIndex].menu.isOpen) {
        contextMenuChildren[contextMenuChildren.length - 1].handleEnter();
      } else if (up) {
        this.categoryButtons[startingCategoryIndex].handleEnter();
      } else if (enteredPowerGroupItemExists) {
        this.powerGroupButtons[refPowerGroupItemIndex - 1].handleEnter();
      } else if (enteredItemExists) {
        buttons[index].handleEnter();
      } else if (enteredCategoryExists) {
        this.categoryButtons[refCategoryIndex - 1].handleEnter();
      }
    };

    const nextItemNavigation = (index) => {
      let down = (typeof buttons[index] === 'undefined' && enteredItemExists
        || typeof this.categoryButtons[refCategoryIndex + 1] === 'undefined' && enteredCategoryExists
        || typeof this.powerGroupButtons[refPowerGroupItemIndex + 1] === 'undefined' && enteredPowerGroupItemExists);
      if (index < 0) {
        index = 0;
      }
      if (contextMenuChildren[index] && refContextMenuItemIndex !== index) {
        contextMenuChildren[index].handleEnter();
      } else if (enteredItemExists && buttons[refItemIndex].menu.isOpen) {
        contextMenuChildren[0].handleEnter();
      } else if (down) {
        this.powerGroupButtons[0].handleEnter();
      } else if (enteredPowerGroupItemExists) {
        this.powerGroupButtons[refPowerGroupItemIndex + 1].handleEnter();
      } else if (enteredCategoryExists) {
        this.categoryButtons[refCategoryIndex + 1].handleEnter();
      } else if (buttons[index]) {
        buttons[index].handleEnter();
      }
    };

    const leftNavigation = () => {
      if ((enteredItemExists
        && refItemIndex === 0)
        || (enteredItemExists
        && this.state.isListView)
        || (!enteredItemExists
          && !enteredCategoryExists
          && !enteredPowerGroupItemExists)) {
        if (!enteredCategoryExists && !this.state.searchActive) {
          if (typeof this.categoryButtons[startingCategoryIndex] !== 'undefined') {
            this.categoryButtons[startingCategoryIndex].handleEnter();
          } else {
            this.categoryButtons[this.categoryButtons.length - 1].handleEnter();
          }
        }
      } else if (!enteredCategoryExists) {
        previousItemNavigation(refItemIndex - 1);
      }
    };

    const rightNavigation = () => {
      if (enteredItemExists && refItemIndex === buttons.length - 1) {
        buttons[0].handleEnter();
      } else if (this.state.isListView && enteredItemExists) {
        buttons[refItemIndex].handleEnter();
      } else {
        enteredCategoryExists = null;
        nextItemNavigation(refItemIndex + 1);
      }
    };

    const downNavigation = () => {
      if (enteredContextMenuItemExists) {
        nextItemNavigation(refContextMenuItemIndex + 1);
      } else if (enteredPowerGroupItemExists) {
        this.powerGroupButtons[refPowerGroupItemIndex].handleEnter();
      } else if (this.state.isListView || enteredContextMenuItemExists) {
        nextItemNavigation(refItemIndex + 1);
      } else {
        nextItemNavigation((refItemIndex + 1) + (this.state.settings.appsGridColumnCount - 1));
      }
    };

    const tabNavigation = () => {
      if (enteredItemExists) {
        this.powerGroupButtons[0].handleEnter();
      } else if (enteredPowerGroupItemExists) {
        this.categoryButtons[startingCategoryIndex].handleEnter();
      } else {
        buttons[0].handleEnter();
      }
    };

    const upNavigation = () => {
      if (enteredContextMenuItemExists) {
        previousItemNavigation(refContextMenuItemIndex - 1);
      } else if (enteredPowerGroupItemExists) {
        tabNavigation();
      } else if (this.state.isListView || enteredContextMenuItemExists) {
        previousItemNavigation(refItemIndex - 1);
      } else {
        previousItemNavigation((refItemIndex - 1) - (this.state.settings.appsGridColumnCount - 1));
      }
    };

    const activateItem = () => {
      if (enteredContextMenuItemExists) {
        contextMenuChildren[refContextMenuItemIndex].activate();
      } else if (enteredItemExists) {
        if (ctrlKey) {
          buttons[refItemIndex].toggleMenu();
        } else {
          buttons[refItemIndex].activate();
        }
      } else if (enteredPowerGroupItemExists) {
        this.powerGroupButtons[refPowerGroupItemIndex]._onButtonReleaseEvent();
      } else if (this.state.searchActive && buttons.length > 0) {
        buttons[0].activate();
      }
    };

    switch (true) {
      case symbol === Clutter.KP_Enter:
      case symbol === Clutter.KEY_Return:
        activateItem();
        return true;
      case symbol === Clutter.KEY_Up:
        upNavigation();
        return true;
      case symbol === Clutter.KEY_Down:
        downNavigation();
        return true;
      case symbol === Clutter.KEY_Page_Up:
        if (enteredItemExists) {
          buttons[0].handleEnter();
        } else if (enteredCategoryExists) {
          this.categoryButtons[0].handleEnter();
        } else if (enteredPowerGroupItemExists) {
          this.powerGroupButtons[0].handleEnter();
        }
        return true
      case symbol === Clutter.KEY_Page_Down:
        if (enteredItemExists) {
          buttons[buttons.length - 1].handleEnter();
        } else if (enteredCategoryExists) {
          this.categoryButtons[this.categoryButtons.length - 1].handleEnter();
        } else if (enteredPowerGroupItemExists) {
          this.powerGroupButtons[this.powerGroupButtons.length - 1].handleEnter();
        }
        return true
      case symbol === Clutter.KEY_Right:
        rightNavigation();
        return true;
      case symbol === Clutter.KEY_Left:
        leftNavigation();
        return true;
      case symbol === Clutter.ISO_Left_Tab:
      case symbol === Clutter.Tab:
        tabNavigation();
        return true;
      case symbol === Clutter.KEY_Escape:
      case symbol === Clutter.Escape:
        if (enteredItemExists && buttons[refItemIndex].menu.isOpen) {
          buttons[refItemIndex].toggleMenu();
          return true;
        }
      case ctrlKey:
        if (enteredItemExists) {
          buttons[refItemIndex].handleEnter();
        }
        return true;
      default:
    }
  },

  _run: function(input) {
    this._commandError = false;
    if (input) {
      let path = null;
      if (input.charAt(0) === '/') {
        path = input;
      } else {
        if (input.charAt(0) === '~') {
          input = input.slice(1);
        }
        path = GLib.get_home_dir() + '/' + input;
      }

      if (GLib.file_test(path, GLib.FileTest.EXISTS)) {
        let file = Gio.file_new_for_path(path);
        try {
          Gio.app_info_launch_default_for_uri(file.get_uri(),
            global.create_app_launch_context());
        } catch (e) {
          // The exception from gjs contains an error string like:
          //     Error invoking Gio.app_info_launch_default_for_uri: No application
          //     is registered as handling this file
          // We are only interested in the part after the first colon.
          //let message = e.message.replace(/[^:]*: *(.+)/, '$1');
          return false;
        }
      } else {
        return false;
      }
    }
    return true;
  },

  _getCompletion: function(text) {
    if (text.indexOf('/') !== -1) {
      if (text.substr(text.length - 1) === '/') {
        return '';
      } else {
        return this._pathCompleter.get_completion_suffix(text);
      }
    } else {
      return false;
    }
  },

  _getCompletions: function(text) {
    if (text.indexOf('/') !== -1) {
      return this._pathCompleter.get_completions(text);
    } else {
      return [];
    }
  },

  resetSearch: function() {
    if (this.answerText) {
      this.answerText.set_text('');
    }
    if (this.searchEntry) {
      this.searchEntry.set_text('');
    }
    this.state.set({searchActive: false});
    this.expressionActive = false;
    if (this._activeContainer) {
      this._activeContainer.show();
    }
    if (!this._activeContainer) {
      this._activeContainer = this.state.settings.startupViewMode === ApplicationsViewMode.LIST ? this.applicationsListBox : this.applicationsGridBox;
    }

    // Since we don't want to monitor which windows need added or removed like a window list applet,
    // they are queried as needed during searches, so we're cleaning them up, along with any
    // search provider results, if enabled.
    let allItems = [];
    for (let i = 0; i < this._allItems.length; i++) {
      if (!this._allItems[i]) {
        continue;
      }
      if (this.state.settings.enableWindows && this._allItems[i].buttonState.appType === ApplicationType._windows
        || this.state.settings.enableSearchProviders && this._allItems[i].buttonState.appType === ApplicationType._providers) {
        this._allItems[i].destroy();
        this._allItems[i] = undefined;
      } else {
        this._allItems[i].clearSearchFormatting();
        allItems.push(this._allItems[i]);
      }
    }
    this._allItems = allItems;
    this.selectedAppTitle.set_text('');
    this.selectedAppDescription.set_text('');
    global.stage.set_key_focus(this.searchEntry);
  },

  _onSearchTextChanged: function() {
    let searchText = this.searchEntry.get_text();

    for (let i = 0, len = this.categoryButtons.length; i < len; i++) {
      if (searchText.length > 0) {
        this.categoryButtons[i].disable();
      } else {
        this.categoryButtons[i].enable();

      }
    }

    if (this.state.searchActive && searchText.length === 0) {
      this._resetDisplayApplicationsToStartup();
    }

    this.state.set({searchActive: searchText.length > 0});

    if (this.state.searchActive) {
      this.searchEntry.set_secondary_icon(this._searchActiveIcon);

      if (!this.signals.isConnected('secondary-icon-clicked', this.searchEntry)) {
        this.signals.connect(this.searchEntry, 'secondary-icon-clicked', this._resetDisplayApplicationsToStartup, this);
      }
    } else {
      if (this.signals.isConnected('secondary-icon-clicked', this.searchEntry)) {
        this.signals.disconnect('secondary-icon-clicked', this.searchEntry, this)
      }

      this.searchEntry.set_secondary_icon(null);
    }
    if (!this.state.searchActive) {
      if (this._searchTimeoutId > 0) {
        Mainloop.source_remove(this._searchTimeoutId);
        this._searchTimeoutId = 0;
      }
      return;
    }
    if (this._searchTimeoutId > 0) {
      return;
    }

    this._searchTimeoutId = Mainloop.timeout_add(150, Lang.bind(this, this._doSearch));
  },

  _doSearch: function() {
    this._searchTimeoutId = 0;
    let text = this.searchEntryText.get_text();
    let pattern = text.replace(/^\s+/g, '').replace(/\s+$/g, '').toLowerCase();
    pattern = Util.latinise(pattern);
    if (pattern === this._previousSearchPattern) {
      return false;
    }
    this._previousSearchPattern = pattern;

    let isMathExpression = pattern.search(/([-+]?[0-9]*\.?[0-9]+[\/\+\-\*])+([-+]?[0-9]*\.?[0-9]+)/gm) > -1;
    if (isMathExpression) {
      try {
        let answer = eval(pattern);
        let answerText = pattern + ' = ' + answer;
        this.answerText.set_text(answerText);
        this.answerText.show();
        this._activeContainer.hide();
        this.expressionActive = true;
      } catch (e) {
        this.expressionActive = false;
      }
    }

    // listApplications returns all the applications when the search
    // string is zero length. This will happend if you type a space
    // in the search entry.
    if (pattern.length === 0) {
      return false;
    }

    let appResults = this.listApplications(null, pattern);

    let placesResults = [];

    let places = this.listPlaces(pattern);

    for (let i = 0, len = places.length; i < len; i++) {
      placesResults.push(places[i]);
    }

    let webBookmarks = this.listWebBookmarks(pattern);

    for (let i = 0, len = webBookmarks.length; i < len; i++) {
      placesResults.push(webBookmarks[i]);
    }

    let recentResults = this.listRecent(pattern);

    let acResults = []; // search box autocompletion results
    if (this.state.settings.searchFilesystem) {
      // Don't use the pattern here, as filesystem is case sensitive
      acResults = this._getCompletions(text);
    }

    let results = appResults
      .concat(placesResults)
      .concat(recentResults)
      .concat(acResults)
      .concat(this.listWindows(pattern));

    const finish = () => {
      sortBy(results, 'score', 'desc');
      this._clearApplicationsBox();
      this._displayApplications(results);
    };

    if (this.state.settings.enableSearchProviders
      && this.state.enabledProviders.length > 0
      && pattern.length > 2) {
      this.listSearchProviders(pattern, (providerResults) => {
        results = results.concat(providerResults);
        finish();
      });
    } else {
      finish();
    }

    return false;
  },

  _display: function() {
    this.state.set({isListView: this.state.settings.startupViewMode === ApplicationsViewMode.LIST});
    this._displayed = true;

    let section = new PopupMenu.PopupMenuSection();

    this.mainBox = new St.BoxLayout({
      style_class: 'menu-applications-outer-box',
      vertical: true,
      show_on_set_parent: false
    }); // menu

    // Middle pane holds categories/places/power, applications, workspaces (packed horizontally)
    this.middlePane = new St.BoxLayout({
      style_class: ''
    });

    // Bottom pane holds power group and selected app description (packed horizontally)
    this.bottomPane = new St.BoxLayout({
      style: 'padding-top: 12px;'
    });

    // groupCategoriesWorkspacesWrapper bin wraps categories and workspaces
    this.groupCategoriesWorkspacesWrapper = new St.BoxLayout({
      style_class: 'cinnamenu-categories-workspaces-wrapper',
      style: 'max-width: 185px;',
      vertical: true
    });

    // Allow the menu to be taller for high resolution displays.
    this.menuHeight = Math.round(Math.abs(Main.layoutManager.primaryMonitor.height / 2.055))
    this.menuHeight = this.menuHeight < 530 ? 530 : this.menuHeight;

    // groupCategoriesWorkspacesScrollBox allows categories or workspaces to scroll vertically
    this.groupCategoriesWorkspacesScrollBox = new St.ScrollView({
      x_fill: true,
      y_fill: false,
      height: this.menuHeight,
      y_align: St.Align.START,
      style_class: 'vfade menu-applications-scrollbox'
    });

    let vscrollCategories = this.groupCategoriesWorkspacesScrollBox.get_vscroll_bar();
    this.displaySignals.connect(vscrollCategories, 'scroll-start', () => {
      this.menu.passEvents = true;
    });
    this.displaySignals.connect(vscrollCategories, 'scroll-stop', () => {
      this.menu.passEvents = false;
    });
    this.groupCategoriesWorkspacesScrollBox.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.NEVER);
    this.groupCategoriesWorkspacesScrollBox.set_mouse_scrolling(true);

    // selectedAppBox
    this.selectedAppBox = new St.BoxLayout({
      style_class: 'menu-selected-app-box',
      style: 'text-align: left;',
      vertical: true
    });
    this.selectedAppTitle = new St.Label({
      style_class: 'menu-selected-app-title',
      text: ''
    });
    this.selectedAppBox.add_actor(this.selectedAppTitle);
    this.selectedAppDescription = new St.Label({
      style_class: 'menu-selected-app-description',
      text: ''
    });
    this.selectedAppBox.add_actor(this.selectedAppDescription);

    this._searchInactiveIcon = new St.Icon({
      style_class: 'menu-search-entry-icon',
      icon_name: 'edit-find'
    });
    this._searchActiveIcon = new St.Icon({
      style_class: 'menu-search-entry-icon',
      icon_name: 'edit-clear'
    });
    this.searchBox = new St.BoxLayout({
      style_class: 'menu-search-box',
      height: 30
    });
    this.searchEntry = new St.Entry({
      name: 'menu-search-entry',
      hint_text: _('Type to search...'),
      track_hover: true,
      can_focus: true
    });

    this.searchEntry.set_primary_icon(this._searchInactiveIcon);
    this.searchBox.add(this.searchEntry, {
      expand: true,
      x_align: St.Align.START,
      y_align: St.Align.START
    });

    this.searchEntryText = this.searchEntry.clutter_text;
    this.displaySignals.connect(this.searchEntryText, 'text-changed', Lang.bind(this, this._onSearchTextChanged));
    this.displaySignals.connect(this.searchEntryText, 'key-press-event', Lang.bind(this, this._onMenuKeyPress));
    this._previousSearchPattern = '';

    // Load Favorites
    this.favorites = this.appFavorites.getFavorites();

    // Load Places
    if (PlaceDisplay && this.state.settings.showPlaces) {
      this.placesManager = new PlaceDisplay.PlacesManager(false);
    } else {
      this.placesManager = null;
    }

    // ApplicationsBox (ListView / GridView)
    this.applicationsScrollBox = new St.ScrollView({
      x_fill: true,
      y_fill: false,
      y_align: St.Align.START,
      height: this.menuHeight,
      style_class: 'vfade menu-applications-scrollbox'
    });
    let vscrollApplications = this.applicationsScrollBox.get_vscroll_bar();
    this.displaySignals.connect(vscrollApplications, 'scroll-start', () => {
      this.menu.passEvents = true;
    });
    this.displaySignals.connect(vscrollApplications, 'scroll-stop', () => {
      this.menu.passEvents = false;
    });

    this.applicationsListBox = new St.BoxLayout({
      style_class: '',
      vertical: true,
      x_expand: true
    });

    this.applicationsGridBox = new St.Widget({
      layout_manager: new Clutter.GridLayout(),
      reactive: true,
      style_class: '',
      width: gridWidths[this.state.settings.appsGridColumnCount]
    });
    this.applicationsBoxWrapper = new St.BoxLayout({
      style_class: 'menu-applications-inner-box',
      vertical: true
    });
    this.answerText = new St.Label({
      style_class: 'menu-selected-app-title',
      style: 'padding-top: 14px; min-width: 240px; text-align; center;',
      text: '',
      show_on_set_parent: false
    });
    this.applicationsBoxWrapper.add(this.answerText, {
      x_fill: false,
      y_fill: false,
      x_align: St.Align.MIDDLE,
      y_align: St.Align.START
    });
    this.applicationsBoxWrapper.add(this.applicationsGridBox, {
      x_fill: false,
      y_fill: false,
      x_align: St.Align.START,
      y_align: St.Align.START
    });
    this.applicationsBoxWrapper.add(this.applicationsListBox, {
      x_fill: false,
      y_fill: false,
      x_align: St.Align.START,
      y_align: St.Align.START,
      expand: false
    });
    this.applicationsScrollBox.add_actor(this.applicationsBoxWrapper);
    this.applicationsScrollBox.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC);
    this.applicationsScrollBox.set_auto_scrolling(this.state.settings.enableAutoScroll);
    this.applicationsScrollBox.set_mouse_scrolling(true);

    // CategoriesBox
    this.categoriesBox = new St.BoxLayout({
      style_class: 'menu-categories-box',
      vertical: true
    });

    // Build categories
    this._buildCategories();

    // PowerGroupBox
    this.powerGroupBox = new St.BoxLayout({
      style_class: ''
    });

    this.powerGroupButtons.push(new GroupButton(
      this.state,
      'user',
      16,
      '',
      '',
      () => Util.spawnCommandLine('cinnamon-settings user')
    ));
    let _t = this;
    this.powerGroupButtons.push(new GroupButton(
      this.state,
      this.state.isListView ? 'view-grid-symbolic' : 'view-list-symbolic',
      16,
      this.state.isListView ? _('Grid View') : _('List View'),
      this.state.isListView ? _('Switch to grid view') : _('Switch to list view'),
      function () {
        if (_t.isListView) {
          _t.isListView = false;
          this.setIcon('view-list-symbolic');
          this.name = _('List View');
          this.description = _('Switch to list view');
          _t.settings.setValue('startup-view-mode', 1);
        } else {
          _t.isListView = true;
          this.setIcon('view-grid-symbolic');
          this.name = _('Grid View');
          this.description = _('Switch to grid view');
          _t.settings.setValue('startup-view-mode', 0);
        }
        _t._switchApplicationsView(true);
      }
    ));
    this.powerGroupButtons.push(new GroupButton(
      this.state,
      'system-lock-screen',
      16,
      _('Lock Screen'),
      _('Lock the screen'),
      () => {
        let screensaver_settings = new Gio.Settings({
          schema_id: 'org.cinnamon.desktop.screensaver'
        });
        let screensaver_dialog = Gio.file_new_for_path('/usr/bin/cinnamon-screensaver-command');
        if (screensaver_dialog.query_exists(null)) {
          if (screensaver_settings.get_boolean('ask-for-away-message')) {
            Util.spawnCommandLine('cinnamon-screensaver-lock-dialog');
          } else {
            Util.spawnCommandLine('cinnamon-screensaver-command --lock');
          }
        } else {
          this._screenSaverProxy.LockRemote('');
        }
      }
    ));
    this.powerGroupButtons.push(new GroupButton(
      this.state,
      'application-exit',
      16,
      _('Logout'),
      _('Leave the session'),
      () => this._session.LogoutRemote(0)
    ));
    this.powerGroupButtons.push(new GroupButton(
      this.state,
      'system-shutdown',
      16,
      _('Quit'),
      _('Shutdown the computer'),
      () => this._session.ShutdownRemote()
    ));
    let powerGroupBoxChildProperties = {
      x_fill: false,
      y_fill: false,
      x_align: St.Align.MIDDLE,
      y_align: St.Align.MIDDLE
    };
    for (let i = 0; i < this.powerGroupButtons.length; i++) {
      this.powerGroupBox.add(this.powerGroupButtons[i].actor, powerGroupBoxChildProperties);
    }

    // Place boxes in proper containers. The order added determines position
    this.groupCategoriesWorkspacesWrapper.add(this.categoriesBox, {
      x_fill: false,
      y_fill: true,
      x_align: St.Align.START,
      y_align: St.Align.END,
      y_expand: true,
      expand: false
    });
    if (!this.state.settings.showAppDescriptionsOnButtons) {
      this.groupCategoriesWorkspacesWrapper.add(this.selectedAppBox, {
        x_fill: false,
        y_fill: false,
        x_align: St.Align.START,
        y_align: St.Align.END,
        expand: true,
        align_end: true
      });
    }
    this.groupCategoriesWorkspacesScrollBox.add_actor(this.groupCategoriesWorkspacesWrapper);

    this.middlePane.add(this.groupCategoriesWorkspacesScrollBox, {
      x_fill: false,
      y_fill: false,
      x_align: St.Align.START,
      y_align: St.Align.START
    });
    this.middlePane.add(this.applicationsScrollBox, {
      x_fill: false,
      y_fill: false,
      x_align: St.Align.START,
      y_align: St.Align.START
    });

    this.bottomPane.add(this.powerGroupBox, {
      x_fill: false,
      y_fill: false,
      x_align: St.Align.START,
      y_align: St.Align.START
    });

    this.bottomPane.add(this.searchBox, {
      expand: true,
      x_align: St.Align.END,
      y_align: St.Align.MIDDLE
    });

    // mainbox packs vertically
    this.mainBox.add_actor(this.middlePane);
    this.mainBox.add(this.bottomPane);

    // add all to section
    section.actor.add_actor(this.mainBox);

    // add section as menu item
    this.menu.addMenuItem(section);

    // Set height constraints on scrollboxes (we also set height when menu toggle)
    this.applicationsScrollBox.add_constraint(new Clutter.BindConstraint({
      name: 'appScrollBoxConstraint',
      source: this.groupCategoriesWorkspacesScrollBox,
      coordinate: Clutter.BindCoordinate.HEIGHT,
      offset: 0
    }));

    if (this._newInstance) {
      this._newInstance = false;
    }
  },

  destroyContainer: function(container) {
    if (!container) {
      return false;
    }
    let children = container.get_children();
    for (let i = 0, len = children.length; i < len; i++) {
      children[i].destroy();
    }
    container.destroy();
    return true;
  },

  destroyDisplayed: function() {
    this.displaySignals.disconnectAllSignals();
    let containers = [
      'searchBox',
      'categoriesBox',
      'powerGroupBox',
      'applicationsGridBox',
      'applicationsListBox',
      'applicationsBoxWrapper',
      'applicationsScrollBox',
      'groupCategoriesWorkspacesScrollBox',
      'middlePane',
      'bottomPane',
      'mainbox'
    ];

    for (let i = 0; i < this.categoryButtons.length; i++) {
      this.categoryButtons[i].destroy();
      this.categoryButtons[i] = null;
    }
    this.categoryButtons = [];

    for (let i = 0; i < this.powerGroupButtons.length; i++) {
      this.powerGroupButtons[i].destroy();
      this.powerGroupButtons[i] = null;
    }
    this.powerGroupButtons = [];

    for (let i = 0, len = containers.length; i < len; i++) {
      if (typeof this[containers[i]] !== 'undefined') {
        this.destroyContainer(this[containers[i]]);
      }
    }
  },

  destroyAppButtons: function() {
    for (let i = 0, len = this._allItems.length; i < len; i++) {
      if (this._allItems[i]) {
        this._allItems[i].destroy();
      }
      this._allItems.splice(i, 1);
    }
    this._allItems = [];
  },

  destroy: function() {
    this.signals.disconnectAllSignals();
    this.destroyAppButtons();
    if (!this._activeContainer) {
      return;
    }
    this._activeContainer.destroy();
    this.destroyDisplayed();
    if (this.bookmarksManager) {
      this.bookmarksManager.destroy();
    }

    this.menu.destroy();
    this.actor.destroy();
  },
};

function main(metadata, orientation, panel_height, instance_id) {
  return new CinnamenuApplet(metadata, orientation, panel_height, instance_id);
}