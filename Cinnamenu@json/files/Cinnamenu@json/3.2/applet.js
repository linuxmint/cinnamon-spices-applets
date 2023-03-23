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
const Tooltips = imports.ui.tooltips;
const SignalManager = imports.misc.signalManager;
const SearchProviderManager = imports.ui.searchProviderManager;
const FileUtils = imports.misc.fileUtils;

// Testing module imports for the extension refactor PR
// https://github.com/linuxmint/Cinnamon/pull/6878
let store, fuzzy, sortBy, setTimeout, tryFn, find, map, isFinalized, sortDirs, Chromium, Firefox, GoogleChrome, Opera,
  PlaceDisplay, CategoryListButton, AppListGridButton, GroupButton, _,
  REMEMBER_RECENT_KEY, ApplicationType, AppTypes, ApplicationsViewMode,
  fuzzyOptions, gridWidths, searchThresholds, markdownProps;
if (typeof require !== 'undefined') {
  let utils = require('./utils');
  let buttons = require('./buttons');
  let constants = require('./constants');
  store = require('./store');
  fuzzy = require('./fuzzy').fuzzy;
  sortBy = utils.sortBy;
  setTimeout = utils.setTimeout;
  tryFn = utils.tryFn;
  find = utils.find;
  map = utils.map;
  isFinalized = utils.isFinalized;
  sortDirs = utils.sortDirs;
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
  searchThresholds = constants.searchThresholds;
  markdownProps = constants.markdownProps;
} else {
  const AppletDir = imports.ui.appletManager.applets['Cinnamenu@json'];
  let storeVersion = typeof Symbol === 'undefined' ? 'store_mozjs24' : 'store';
  store = AppletDir[storeVersion];
  fuzzy = AppletDir.fuzzy.fuzzy;
  sortBy = AppletDir.utils.sortBy;
  setTimeout = AppletDir.utils.setTimeout;
  tryFn = AppletDir.utils.tryFn;
  find = AppletDir.utils.find;
  map = AppletDir.utils.map;
  isFinalized = AppletDir.utils.isFinalized;
  sortDirs = AppletDir.utils.sortDirs;
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
  searchThresholds = AppletDir.constants.searchThresholds;
  markdownProps = AppletDir.constants.markdownProps;
}

const hintText = _('Type to search...');

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

  _init: function() {
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

  destroy: function() {
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
    this.setAllowedLayout(Applet.AllowedLayout.BOTH);
    if (orientation === St.Side.BOTTOM || orientation === St.Side.TOP) {
      this.set_applet_label(_('Initializing'));
    }
    this.setSchema(metadata.path, (knownProviders, enabledProviders) => {
      this.privacy_settings = new Gio.Settings({schema_id: 'org.cinnamon.desktop.privacy'});
      this.appFavorites = AppFavorites.getAppFavorites();
      this.state = store.init({
        cinnamon36: typeof this._newPanelId !== 'undefined',
        orientation: orientation,
        recentEnabled: this.privacy_settings.get_boolean(REMEMBER_RECENT_KEY),
        settings: {},
        favorites: this.appFavorites.getFavorites(),
        knownProviders: knownProviders,
        enabledProviders: enabledProviders,
        theme: null,
        isListView: false,
        iconSize: 64,
        currentCategory: 'favorites',
        fallbackDescription: '',
        appletReady: false,
        searchActive: false,
        itemEntered: false,
        contextMenuIsOpen: null,
        menuHeight: 530,
        expressionActive: false,
        searchWebErrorsShown: false,
        displayed: false,
        isNewInstance: true,
        dragIndex: -1,
        gpu_offload_supported: Main.gpu_offload_supported,
        isBumblebeeInstalled: GLib.file_test('/usr/bin/optirun', GLib.FileTest.EXISTS)
      });
      this.state.connect({
        currentCategory: () => {
          for (let i = 0; i < this.categoryButtons.length; i++) {
            if (this.categoryButtons[i].id === this.state.currentCategory) {
              this.categoryButtons[i].actor.set_style_class_name('menu-category-button-selected');
            } else {
              this.categoryButtons[i].actor.set_style_class_name('menu-category-button');
            }
          }
        },
        clearEnteredActors: () => this._clearEnteredActors(),
        setTooltip: (coords, height, text) => {
          if (!text) {
            this.tooltip.hide();
            return;
          }
          let clutterText = this.tooltip._tooltip.get_clutter_text();
          if (clutterText) {
            clutterText.set_markup(text);
          } else {
            this.tooltip.set_text(text.replace(/(<([^>]+)>)/ig, ''));
          }
          coords[1] = coords[1] + height;
          this.tooltip.mousePosition = coords;
          if (!this.state.settings.tooltipDelay) {
            this.tooltip.show();
            return;
          }
          setTimeout(() => {
            if (!this.state.itemEntered) {
              return;
            }
            this.tooltip.show();
          }, this.state.settings.tooltipDelay);
        },
        setKeyFocus: () => global.stage.set_key_focus(this.searchEntry),
        setSelectedTitleText: (text) => this.selectedAppTitle.set_text(text),
        setSelectedDescriptionText: (text) => this.selectedAppDescription.set_text(text),
        getSelectedTitleClutterText: () => this.selectedAppTitle.get_clutter_text(),
        getSelectedDescriptionClutterText: () => this.selectedAppDescription.get_clutter_text(),
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
        moveFavoriteToPos: (id, index) => {
          Meta.later_add(Meta.LaterType.BEFORE_REDRAW, () => {
            this.appFavorites.moveFavoriteToPos(id, index);
            return false;
          });
        },
        moveCategoryToPos: (id1, id2) => {
          let categories = this.state.settings.categories.slice();
          let oldIndex = categories.indexOf(id1);
          let newIndex = categories.indexOf(id2);
          categories.splice(oldIndex, 1);
          let categories1 = categories.slice(0, newIndex);
          let categories2 = categories.slice(newIndex, categories.length);
          categories = categories1.concat([id1]).concat(categories2);
          this.settings.setValue(
            'categories',
            categories
          );
          this.state.set({dragIndex: -1});
          this._buildCategories();
          for (let i = 0, len = this.categoryButtons.length; i < len; i++) {
            if (this.categoryButtons[i].id === id2) {
              this.categoryButtons[i].handleEnter();
            } else if (this.categoryButtons[i].entered) {
              this.categoryButtons[i].handleLeave();
            }
          }
        },
        removeFavorite: (id) => this.appFavorites.removeFavorite(id),
        switchApplicationsView: (fromToggle) => this.switchApplicationsView(fromToggle),
        setSettingsValue: (k, v) => this.settings.setValue(k, v),
        setIsListView: () => {
          if (this.state.isListView) {
            this.state.set({iconSize: this.state.settings.appsListIconSize > 0 ? this.state.settings.appsListIconSize : 28});
          } else {
            this.state.set({iconSize: this.state.settings.appsGridIconSize > 0 ? this.state.settings.appsGridIconSize : 64});
          }
        }
      });

      this.createMenu(orientation);

      this.settings = new Settings.AppletSettings(this.state.settings, metadata.uuid, instance_id);
      this._bindSettingsChanges();
      this.state.set({
        isListView: this.state.settings.startupViewMode === ApplicationsViewMode.LIST,
        fallbackDescription: this.state.settings.showAppDescriptionsOnButtons || this.state.settings.showTooltips ? _('No description available') : ''
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

      this.signals.connect(this.privacy_settings, 'changed::' + REMEMBER_RECENT_KEY, () => {
        this.state.set({recentEnabled: this.privacy_settings.get_boolean(REMEMBER_RECENT_KEY)});
        this.refresh();
      });

      // FS search
      this._fileFolderAccessActive = false;
      this._pathCompleter = new Gio.FilenameCompleter();
      this._pathCompleter.set_dirs_only(false);

      this._updateKeybinding();
      this.signals.connect(Main.themeManager, 'theme-set', Lang.bind(this, this._updateIconAndLabel));

      this._iconTheme = Gtk.IconTheme.get_default();
      this.signals.connect(this._iconTheme, 'changed', Lang.bind(this, this._onIconsChanged));
      this.signals.connect(this.appSystem, 'installed-changed', Lang.bind(this, this.refresh));
      this.signals.connect(this.appFavorites, 'changed', Lang.bind(this, this._onFavoritesChanged));
      this.signals.connect(this.menu, 'open-state-changed', Lang.bind(this, this._onOpenStateToggled));

      this.categoryButtons = [];
      this.powerGroupButtons = [];
      this._knownApps = [];
      this.applicationsByCategory = {};
      this._allItems = [];
      this._searchTimeoutId = 0;
      this._activeContainer = null;
      this.placesManager = null;

      this.onEnableBookmarksChange(this.state.settings.enableBookmarks, true);
      this._session = new GnomeSession.SessionManager();
      this._screenSaverProxy = new ScreenSaver.ScreenSaverProxy();
      this.recentManager = Gtk.RecentManager.get_default();
      this._updateIconAndLabel();
      this._updateActivateOnHover();
    });
  },

  setSchema: function(path, cb) {
    let schema, shouldReturn;
    let knownProviders = [];
    let enabledProviders = global.settings.get_strv('enabled-search-providers');
    let schemaFile = Gio.File.new_for_path(path + '/' + 'settings-schema.json');
    let backupSchemaFile = Gio.File.new_for_path(path + '/' + 'settings-schema-backup.json');
    let next = () => cb(knownProviders, enabledProviders);
    let [success, json] = schemaFile.load_contents(null);
    if (!success) return next();

    tryFn(function() {
      schema = JSON.parse(json);
    }, () => {
      shouldReturn = true;
    });
    if (shouldReturn) {
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

      tryFn(function() {
        file = JSON.parse(json);
      }, function() {
        shouldReturn = true;
      });
      if (shouldReturn) {
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
      tryFn(function() {
        json = JSON.stringify(schema);
        let raw = schemaFile.replace(null, false, Gio.FileCreateFlags.NONE, null);
        let out = Gio.BufferedOutputStream.new_sized(raw, 4096);
        Cinnamon.write_string_to_stream(out, json);
        out.close(null);
      }, () => {
        shouldReturn = true;
      });
      if (shouldReturn) {
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
    this.orientation = orientation;
    this.update_label_visible();
    this._updateIconAndLabel();
    this.refresh();
  },

  on_applet_added_to_panel: function() {
    if (!this.state) {
      return;
    }
    this.state.set({appletReady: true});
  },

  on_applet_removed_from_panel: function() {
    Main.keybindingManager.removeHotKey('overlay-key-' + this.instance_id);
    if (!this.settings) {
      return;
    }
    this.settings.finalize();
    this.destroy();
  },

  on_applet_clicked: function() {
    this.menu.toggle_with_options(this.state.settings.enableAnimation);
  },

  on_panel_height_changed: function() {
    this.refresh();
  },

  launchPrivacySettings: function() {
    Util.spawnCommandLine('cinnamon-settings privacy');
  },

  launchEditor: function() {
    Util.spawnCommandLine('cinnamon-menu-editor');
  },

  _updateKeybinding: function() {
    Main.keybindingManager.addHotKey(
      'overlay-key-' + this.instance_id,
      this.state.settings.overlayKey,
      () => {
        if (!Main.overview.visible && !Main.expo.visible) {
          this.menu.toggle_with_options(this.state.settings.enableAnimation);
        }
      }
    );
  },

  _updateIconAndLabel: function() {
    tryFn(() => {
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
    }, () => {
      global.logWarning('Could not load icon file ' + this.state.settings.menuIcon + ' for menu button');
    });

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
          this.state.settings.menuLabel = '';
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

  _updateActivateOnHover: function(activate = true) {
    if (this.state.settings.activateOnHover && activate) {
      this.signals.connect(this.actor, 'enter-event', () => {
        setTimeout(() => this.openMenu(), this.state.settings.hoverDelayMs);
      });
    } else if (this.signals.isConnected('enter-event', this.actor)) {
      this.signals.disconnect('enter-event', this.actor)
    }
  },

  // handler for when favorites change
  _onFavoritesChanged: function() {
    this.state.set({favorites: this.appFavorites.getFavorites()});
    // Check if the menu has been rendered at least once
    if (this.applicationsGridBox && this.applicationsListBox) {
      this.switchApplicationsView(true);
    }

    Mainloop.idle_add_full(150, () => {
      if (this.state.dragIndex > -1) {
        let button = store.queryCollection(this._allItems, (item) => item.buttonState.appIndex === this.state.dragIndex);
        if (button) {
          this._scrollToButton(button);
        }
        this.state.set({dragIndex: -1});
      }
    });
  },

  // handler for when icons change
  _onIconsChanged: function() {
    if (!this.state || !this.state.appletReady) {
      return;
    }
    this.refresh();
  },

  searchProviderChange: function(provider) {
    return function onProviderChange() {
      let enabledProviders = global.settings.get_strv('enabled-search-providers');
      let providerIndex = enabledProviders.indexOf(provider);
      if (this.state.settings[provider] && providerIndex === -1) {
        enabledProviders.push(provider);
      } else {
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

  customMenuHeightChange: function() {
    let height;
    let monitorHeight = Main.layoutManager.monitors[this.panel.monitorIndex].height;
    let customHeightLimit = monitorHeight - 120;

    if (this.state.settings.enableCustomMenuHeight) {
      height = this.state.settings.customMenuHeight;
    } else {
      height = this.state.menuHeight;
    }

    if (height >= customHeightLimit) {
      if (this.state.settings.enableCustomMenuHeight) {
        height = customHeightLimit;
      } else {
        height = Math.round(Math.abs(monitorHeight * 0.55));
      }
    }

    this.groupCategoriesWorkspacesScrollBox.height = height;
    this.applicationsScrollBox.height = height;
  },

  getExampleSearchProviders: function() {
    Util.spawnCommandLine('xdg-open https://github.com/linuxmint/Cinnamon/tree/master/docs/search-providers-examples');
  },

  // function to bind preference setting changes
  _bindSettingsChanges: function() {
    let settingsProps = [
      {
        key: 'categories',
        value: 'categories',
        cb: null
      },
      {
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
        value: 'hoverDelayMs',
        cb: () => {
          this._updateActivateOnHover(false);
          this._updateActivateOnHover(true);
        }
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
        key: 'category-click',
        value: 'categoryClick',
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
        key: 'show-apps-description-on-buttons',
        value: 'showAppDescriptionsOnButtons',
        cb: this.refresh
      },
      {
        key: 'show-tooltips',
        value: 'showTooltips',
        cb: null
      },
      {
        key: 'tooltip-delay',
        value: 'tooltipDelay',
        cb: null
      },
      {
        key: 'enable-custom-menu-height',
        value: 'enableCustomMenuHeight',
        cb: this.customMenuHeightChange
      },
      {
        key: 'custom-menu-height',
        value: 'customMenuHeight',
        cb: this.customMenuHeightChange
      }
    ];

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
    this.state.set({
      theme: { // TODO: Find a proper class for button app state dots
        foregroundColor: appletMenuThemeNode.get_foreground_color().to_string().substring(0, 7),
      }
    });
    if (typeof cb === 'function') {
      cb();
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
      if (!this.state.displayed) {
        this._display();
      }

      this.introspectTheme(()=>{
        // Set Category
        this.categoriesBox.show();
        // Load Startup Applications category
        this.switchApplicationsView(false);
        // Display startup apps
        this._resetDisplayApplicationsToStartup();
        this.customMenuHeightChange();
        this.state.trigger('menuOpened');
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
    this.state.set({displayed: false});
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
        return button && button.actor === children[i];
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
        let appInfo = entry.get_app_info();
        if (appInfo && !appInfo.get_nodisplay()) {
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
            if (!this.state.isNewInstance) {
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

  resetCategoryOrder: function() {
    if (!this.categoriesBox) {
      return;
    }
    this.categoriesBox.remove_all_children();
    this.settings.setValue('categories', []);
    this._buildCategories();
  },

  _buildCategories: function() {
    let isReRender = this.categoryButtons.length > 0;
    let buttons = [];
    if (isReRender) {
      this.categoriesBox.remove_all_children();
      buttons.push(find(this.categoryButtons, button => button.id === 'all'));
    } else {
      buttons = [new CategoryListButton(this.state, 'all', _('All applications'), 'computer')];
    }

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
          if (isReRender) {
            let button = find(this.categoryButtons, button => button.id === dirId);
            if (!button) {
              continue;
            }
            buttons.push(button);
          } else {
            buttons.push(new CategoryListButton(this.state, dir, dirId));
          }
        }
      }
    }
    let params = [
      [this.state.settings.showPlaces, 'places', _('Places'), 'folder', '_selectAllPlaces'],
      [this.state.recentEnabled, 'recent', _('Recent files'), 'folder-recent', '_selectRecent'],
      [this.state.settings.enableBookmarks, 'bookmarks', _('Bookmarks'), 'emblem-favorite', '_selectWebBookmarks'],
      [true, 'favorites', _('Favorite apps'), 'address-book-new', '_selectCategory']
    ];
    for (let i = 0; i < params.length; i++) {
      if (!params[i][0]) {
        continue;
      }
      if (isReRender) {
        let button = find(this.categoryButtons, button => button.id === params[i][1]);
        if (!button) {
          continue;
        }
        buttons.push(button);
      } else { // TODO: Use spread operator after versioning for 3.8
        buttons.push(new CategoryListButton(this.state, params[i][1], params[i][2], params[i][3], params[i][4]));
      }
    }
    if (this.state.settings.categories.length === 0) {
      this.settings.setValue('categories', map(buttons, (button) => button.id));
    }
    this.categoryButtons = [];
    // If a category option is enabled after the settings are set, or an application is installed
    // using a new category, we need to update the category order settings so it will render.
    if (buttons.length !== this.state.settings.categories.length) {
      for (let i = 0; i < buttons.length; i++) {
        if (this.state.settings.categories.indexOf(buttons[i].id) === -1) {
          this.state.settings.categories.push(buttons[i].id);
        }
      }
    }
    for (let i = 0; i < this.state.settings.categories.length; i++) {
      let button = find(buttons, (button) => button.id === this.state.settings.categories[i]);
      if (!button) {
        continue;
      }
      button.index = i;
      this.categoryButtons.push(button);
      this.categoriesBox.add_actor(button.actor);
    }
    buttons = undefined;
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

  switchApplicationsView: function(fromToggle) {
    let isListView = this.state.settings.startupViewMode === ApplicationsViewMode.LIST, iconSize;
    if (isListView) {
      iconSize = this.state.settings.appsListIconSize > 0 ? this.state.settings.appsListIconSize : 28;
    } else {
      iconSize = this.state.settings.appsGridIconSize > 0 ? this.state.settings.appsGridIconSize : 64;
    }
    this.state.set({
      isListView: isListView,
      iconSize: iconSize,
      currentCategory: 'favorites'
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
    if (this._activeContainer === this.applicationsListBox || this._activeContainer === this.applicationsListBox) {
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

  _clearEnteredActors: function() {
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
    let refPowerGroupItemIndex = store.queryCollection(this.powerGroupButtons, function(button) {
      return button.entered != null;
    }, {indexOnly: true});
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

    if (this.applicationsGridBox && !isFinalized(this.applicationsGridBox)) {
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
    let searchableProps = ['title', 'description', 'id'];
    for (let i = 0, len = windows.length; i < len; i++) {
      if (!windows[i] || !windows[i].title) {
        continue;
      }
      let match = null;
      let app = this.tracker.get_window_app(windows[i]);
      if (!app || !app.name) {
        continue;
      }
      let appObject = {
        description: app.name,
      };
      windows[i].description = app.name;
      windows[i].id = windows[i].get_wm_class().toLowerCase();
      for (let z = 0; z < searchableProps.length; z++) {
        match = fuzzy(pattern, windows[i][searchableProps[z]], fuzzyOptions)
        if (match.score > searchThresholds[searchableProps[z]]) {
          appObject._icon = app.create_icon_texture(this.state.iconSize);
          appObject.type = ApplicationType._windows;
          appObject.name = !z ? match.result : windows[i].title;
          appObject.score = match.score;
          appObject.window = windows[i];
          res.push(appObject);
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
        results[i].score = 0.1;
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
    let match = null;
    for (let i = 0, len = places.length; i < len; i++) {
      if (pattern) match = fuzzy(pattern, places[i].name, fuzzyOptions);
      if (!pattern || match.score > searchThresholds.name) {
        places[i].type = ApplicationType._places;
        places[i].description = places[i].file.get_path();
        if (match) {
          places[i].name = match.result;
          places[i].score = match.score;
        }
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
    let match = null;
    for (let i = 0, len = bookmarks.length; i < len; i++) {
      if (pattern) match = fuzzy(pattern, bookmarks[i].name, fuzzyOptions);
      if (!pattern || match.score > searchThresholds.name) {
        bookmarks[i].type = ApplicationType._places;
        bookmarks[i].description = bookmarks[i].file.get_path();
        if (match) {
          bookmarks[i].name = match.result;
          bookmarks[i].score = match.score;
        }
        res.push(bookmarks[i]);
      }
    }
    return res;
  },

  listDevices: function(pattern) {
    if (!this.placesManager) {
      return [];
    }
    let devices = this.placesManager.getMounts();
    let res = [];
    let match = null;
    for (let i = 0, len = devices.length; i < len; i++) {
      if (pattern) match = fuzzy(pattern, devices[i].name, fuzzyOptions);
      if (!pattern || match.score > searchThresholds.name) {
        devices[i].type = ApplicationType._places;
        devices[i].description = devices[i].file.get_path();
        if (match) {
          devices[i].name = match.result;
          devices[i].score = match.score;
        }
        res.push(devices[i]);
      }
    }
    return res;
  },

  listWebBookmarks: function(pattern) {
    if (!this.state.settings.enableBookmarks) {
      return [];
    }
    if (!this.state.searchWebErrorsShown && !Firefox.Gda) {
      let notifyMessage = _('gir1.2-gda-5.0 package required for Firefox and Midori bookmarks.');
      this.answerText.set_text(notifyMessage);
      this.answerText.show();
    } else if (this.answerText.is_visible() && !this.state.expressionActive) {
      this.answerText.hide();
    }
    this.state.set({searchWebErrorsShown: true});

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

  listRecent: function(pattern) {
    if (!this.state.recentEnabled) {
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
      this.answerText.set_text(_('No recent files'));
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
      res = this.state.favorites;
    } else {
      if (categoryMenuId && categoryMenuId !== 'all') {
        res = this.applicationsByCategory[categoryMenuId];
      } else {
        let keys = Object.keys(this.applicationsByCategory);
        for (let i = 0; i < keys.length; i++) {
          res = res.concat(this.applicationsByCategory[keys[i]])
        }
      }
    }

    if (pattern) {
      let _res = [];
      let searchableProps = ['name', 'description', 'keywords', 'id'];

      for (let i = 0, len = res.length; i < len; i++) {
        let name = res[i].get_name();
        let keywords = res[i].get_keywords();
        Object.assign(res[i], {
          name: name,
          keywords: keywords || name,
          description: res[i].get_description(),
          id: res[i].get_id().replace(/\.desktop$/, ''),
          type: ApplicationType._applications
        });

        let match = null;
        for (let z = 0, len = searchableProps.length; z < len; z++ ) {
          if (this.state.settings.enableWindows && res[i].state > 0) {
            continue;
          }
          match = fuzzy(pattern, res[i][searchableProps[z]], fuzzyOptions)
          if (res[i][searchableProps[z]] && match.score > searchThresholds[searchableProps[z]]) {
            res[i].score = match.score;
            if (markdownProps.indexOf(searchableProps[z]) > -1) {
              res[i][searchableProps[z]] = match.result;
            }
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
    this.state.set({currentCategory: 'favorites'});
    this._selectCategory('favorites');
  },

  _onMenuKeyPress: function(actor, event) {
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

    let refCategoryIndex = store.queryCollection(this.categoryButtons, (button) => {
      return button.entered != null;
    }, {indexOnly: true});

    let refPowerGroupItemIndex = store.queryCollection(this.powerGroupButtons, (button) => {
      return button.entered != null;
    }, {indexOnly: true});

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
        refContextMenuItemIndex = store.queryCollection(contextMenuChildren, (button) => {
          return button.actor.has_style_pseudo_class('active');
        }, {indexOnly: true});
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
    let startingCategoryIndex = store.queryCollection(this.categoryButtons, (button) => {
      return this.state.currentCategory === button.id;
    }, {indexOnly: true});
    startingCategoryIndex = this.state.settings.enableBookmarks && startingCategoryIndex <= 0 ? 1 : startingCategoryIndex;

    const previousItemNavigation = (index) => {
      let up = (typeof buttons[index] === 'undefined' && enteredItemExists
        || typeof this.categoryButtons[refCategoryIndex - 1] === 'undefined' && enteredCategoryExists
        || typeof this.powerGroupButtons[refPowerGroupItemIndex - 1] === 'undefined' && enteredPowerGroupItemExists);
      if (index < 0) {
        index = 0;
      }
      if (contextMenuChildren[index] && refContextMenuItemIndex !== index) {
        contextMenuChildren[index].handleEnter();
      } else if (enteredItemExists && buttons[refItemIndex].menu.isOpen) {
        contextMenuChildren[contextMenuChildren.length - 1].handleEnter();
      } else if (up && !enteredItemExists) {
        this.categoryButtons[startingCategoryIndex].handleEnter();
      } else if (enteredPowerGroupItemExists) {
        this.powerGroupButtons[refPowerGroupItemIndex - 1].handleEnter();
      } else if (enteredItemExists) {
        if (up && !this.state.isListView && refItemIndex <= this.state.settings.appsGridColumnCount - 1) {
          buttons[refItemIndex].handleEnter();
        } else {
          buttons[index].handleEnter();
        }
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
        if (this.state.searchActive) {
          buttons[refItemIndex].handleEnter();
          return;
        }
        if (!enteredCategoryExists) {
          if (typeof this.categoryButtons[startingCategoryIndex] !== 'undefined') {
            this.categoryButtons[startingCategoryIndex].handleEnter();
          } else {
            this.categoryButtons[this.categoryButtons.length - 1].handleEnter();
          }
        }
      } else if (this.state.searchActive && enteredPowerGroupItemExists && refPowerGroupItemIndex === 0) {
        this.powerGroupButtons[this.powerGroupButtons.length - 1].handleEnter();
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
      } else if (enteredPowerGroupItemExists && !this.state.searchActive) {
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
      } else if (this.state.isListView) {
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
          if (buttons[refItemIndex].menu.isOpen) {
            buttons[refItemIndex].toggleMenu();
          } else {
            buttons[refItemIndex].handleButtonRelease();
          }
        } else {
          buttons[refItemIndex].activate();
        }
      } else if (enteredCategoryExists) {
        this.categoryButtons[refCategoryIndex].handleButtonRelease();
      } else if (enteredPowerGroupItemExists) {
        this.powerGroupButtons[refPowerGroupItemIndex].handleButtonRelease();
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
        this.menu.close();
        return true;
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
        return tryFn(function() {
          Gio.app_info_launch_default_for_uri(file.get_uri(), global.create_app_launch_context());
        }, function() {
          // The exception from gjs contains an error string like:
          //     Error invoking Gio.app_info_launch_default_for_uri: No application
          //     is registered as handling this file
          return false;
        });
      } else {
        return false;
      }
    }
    return true;
  },

  resetSearch: function() {
    if (this.answerText) {
      this.answerText.set_text('');
    }
    if (this.searchEntry) {
      this.searchEntry.set_text('');
    }
    this.state.set({
      searchActive: false,
      expressionActive: false
    });
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
        this._allItems[i].destroy(true);
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
    let searchText = this.searchEntryText.get_text();

    if (searchText === hintText) {
      return;
    }

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
      this._clearEnteredActors();
      this.searchEntry.set_secondary_icon(this._searchActiveIcon);

      if (!this.signals.isConnected('secondary-icon-clicked', this.searchEntry)) {
        this.signals.connect(this.searchEntry, 'secondary-icon-clicked', this._resetDisplayApplicationsToStartup, this);
      }
    } else {
      if (this.signals.isConnected('secondary-icon-clicked', this.searchEntry)) {
        this.signals.disconnect('secondary-icon-clicked', this.searchEntry, this)
      }

      this.searchEntry.set_secondary_icon(null);
      this.state.trigger('menuOpened');
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
    this._searchTimeoutId = Mainloop.timeout_add(0, () => this._doSearch(searchText));
  },

  _doSearch: function(text) {
    this._searchTimeoutId = 0;
    if (text.length === 0) {
      return;
    }
    let pattern = Util.latinise(text.trim().toLowerCase());
    if (pattern === this._previousSearchPattern) {
      return false;
    }
    this._previousSearchPattern = pattern;

    let isMathExpression = pattern.search(/([-+]?[0-9]*\.?[0-9]+[/+\-*])+([-+]?[0-9]*\.?[0-9]+)/gm) > -1;
    if (isMathExpression) {
      tryFn(() => {
        let answer = eval(pattern);
        let answerText = pattern + ' = ' + answer;
        this.answerText.set_text(answerText);
        this.answerText.show();
        this._activeContainer.hide();
        this.state.set({expressionActive: true});
      }, () => this.state.set({expressionActive: false}));
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

    let results = appResults
      .concat(placesResults)
      .concat(recentResults)
      .concat(this.listWindows(pattern));

    const finish = () => {
      sortBy(results, 'score', 'desc');
      this._clearApplicationsBox();
      this._displayApplications(results);

      let buttons = this.getActiveButtons();
      if (buttons.length === 0) {
        return;
      }
      buttons[0].handleEnter();
    };
    if (this.state.settings.enableSearchProviders
      && this.state.enabledProviders.length > 0
      && pattern.length > 2) {
      this.listSearchProviders(pattern, (providerResults) => {
        // Since the provider results are asynchronous, the search state may have ended by the time they return.
        if (!this.state.searchActive) {
          return;
        }
        if ( providerResults && providerResults.length > 0) {
            results = results.concat(providerResults);
        }
        finish();
      });
    } else {
      finish();
    }

    return false;
  },

  _displayApplications: function(appList) {
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

    this._activeContainer = this.state.isListView ? this.applicationsListBox : this.applicationsGridBox;
    this.state.contextMenuIsOpen = null;

    let createAppButton = (app, appType, len, appIndex)=>{
      let appButton;
      let refAppButton = -1;
      for (let i = 0, _len = this._allItems.length; i < _len; i++) {
        if (this._allItems[i] && this._allItems[i].buttonState.app === app) {
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
        this.applicationsListBox.add_actor(appButton.actor);
      } else {
        let gridLayout = this.applicationsGridBox.layout_manager;
        if (!gridLayout) {
          return false;
        }
        appButton.buttonState.set({column: column});
        gridLayout.attach(appButton.actor, column, rownum, 1, 1);
        column++;
        if (column > columnsCount) {
          columnsCount = column;
        }
        if (column > this.state.settings.appsGridColumnCount - 1) {
          column = 0;
          rownum++;
        }
      }
    };

    if (!this.state.searchActive
      && lastApp
      && !lastApp.clearList
      && this.state.currentCategory
      && this.state.currentCategory !== 'favorites') {
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
  },

  _display: function() {
    // Allow the menu to be taller for high resolution displays.
    let menuHeight = Math.round(Math.abs(Main.layoutManager.primaryMonitor.height * 0.55));
    this.state.set({
      isListView: this.state.settings.startupViewMode === ApplicationsViewMode.LIST,
      displayed: true,
      menuHeight: menuHeight < 360 ? 360 : menuHeight
    });

    let section = new PopupMenu.PopupMenuSection();

    this.mainBox = new St.BoxLayout({
      //style_class: 'menu-applications-outer-box',
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
      //style: 'max-width: 185px;',
      vertical: true
    });

    // groupCategoriesWorkspacesScrollBox allows categories or workspaces to scroll vertically
    this.groupCategoriesWorkspacesScrollBox = new St.ScrollView({
      x_fill: true,
      y_fill: false,
      height: this.state.menuHeight,
      y_align: St.Align.START,
      style_class: 'vfade menu-applications-scrollbox'
    });

    if (!this.state.settings.showAppDescriptionsOnButtons && !this.state.settings.showTooltips) {
      this.groupCategoriesWorkspacesScrollBox.width = 250;
    }

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
      style: 'padding-right: 7px;'
    });
    this.searchEntry = new St.Entry({
      name: 'menu-search-entry',
      hint_text: hintText,
      track_hover: true,
      can_focus: true,
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
      height: this.state.menuHeight,
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
      vertical: true
    });

    this.applicationsGridBox = new Clutter.Actor({
      layout_manager: new Clutter.GridLayout(),
      reactive: true,
      width: gridWidths[this.state.settings.appsGridColumnCount]
    });
    this.applicationsBoxWrapper = new St.BoxLayout({
      style_class: 'menu-applications-inner-box',
      style: 'min-width: 275px',
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
      x_fill: true,
      y_fill: false,
      x_align: St.Align.START,
      y_align: St.Align.START
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
      style_class: '',
      style: 'padding-left: 13px'
    });

    this.powerGroupButtons.push(new GroupButton(
      this.state,
      'user',
      16,
      '',
      _('Account details'),
      () => Util.spawnCommandLine('cinnamon-settings user')
    ));
    this.powerGroupButtons.push(new GroupButton(
      this.state,
      this.state.isListView ? 'view-grid-symbolic' : 'view-list-symbolic',
      16,
      this.state.isListView ? _('Grid View') : _('List View'),
      this.state.isListView ? _('Switch to grid view') : _('Switch to list view')
    ));
    this.powerGroupButtons.push(new GroupButton(
      this.state,
      'system-lock-screen',
      16,
      _('Lock screen'),
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
      expand: true,
      x_fill: false,
      y_fill: false,
      x_align: St.Align.START,
      y_align: St.Align.MIDDLE
    });

    this.bottomPane.add(this.searchBox, {
      expand: false,
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

    this.tooltip = new Tooltips.Tooltip(this.mainBox, '')
    this.tooltip._tooltip.set_style('text-align: left;');

    if (this.state.isNewInstance) {
      this.state.set({isNewInstance: false});
    }
  },

  destroyContainer: function(container) {
    if (!container || isFinalized(container)) {
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

    if (this.tooltip) {
      this.tooltip.destroy();
      this.tooltip = null;
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
  },
};

function main(metadata, orientation, panel_height, instance_id) {
  return new CinnamenuApplet(metadata, orientation, panel_height, instance_id);
}
