window.log2 = function () {
  let args = arguments;
  let output = [];
  for (let i = 0, len = args.length; i < len; i++) {
    if (typeof args[i] === 'undefined') {
      args[i] = typeof args[i];
    }
    if (typeof args[i] === 'object'
      && args[i].toString().indexOf('[0x') === -1) {
      args[i] = JSON.stringify(args[i]);
    } else if (typeof args[i] !== 'string') {
      args[i] = args[i].toString();
    }
    output.push(args[i])
  }
  log(output.join(' '))
};
const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const GLib = imports.gi.GLib;
const CMenu = imports.gi.CMenu;
const Clutter = imports.gi.Clutter;
const Cinnamon = imports.gi.Cinnamon;
const St = imports.gi.St;
const Meta = imports.gi.Meta;
const IconTheme = imports.gi.Gtk.IconTheme;
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
/*const DT = imports.misc.timers.DebugTimer;
const dt = new DT('1')*/

const AppletDir = imports.ui.appletManager.applets['Cinnamenu@json'];
const fuzzy = AppletDir.fuzzy.fuzzy
const _ = AppletDir.lodash._;

const Chromium = AppletDir.webChromium;
const Firefox = AppletDir.webFirefox;
const GoogleChrome = AppletDir.webGoogleChrome;
const Midori = AppletDir.webMidori;
const Opera = AppletDir.webOpera;
const PlaceDisplay = AppletDir.placeDisplay;
const SearchWebBookmarks = AppletDir.buttons.SearchWebBookmarks;
const CategoryListButton = AppletDir.buttons.CategoryListButton;
const AppListGridButton = AppletDir.buttons.AppListGridButton;
const GroupButton = AppletDir.buttons.GroupButton;

// l10n
const Gettext = imports.gettext;
const UUID = 'Cinnamenu@json';

function t(str) {
  let cinnamonTranslation = Gettext.gettext(str);
  if (cinnamonTranslation !== str) {
    return cinnamonTranslation;
  }
  return Gettext.dgettext(UUID, str);
}

const PRIVACY_SCHEMA = 'org.cinnamon.desktop.privacy';
const REMEMBER_RECENT_KEY = 'remember-recent-files';

const ApplicationType = {
  _applications: 0,
  _places: 1,
  _recent: 2
};
const AppTypes = Object.keys(ApplicationType);

const ApplicationsViewMode = {
  LIST: 0,
  GRID: 1
};

const fuzzyOptions = {
  before: '<b><u>',
  after: '</u></b>'
}

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
    this.createMenu(orientation);
    this.actor.connect('key-press-event', Lang.bind(this, this._onSourceKeyPress));
    this.settings = new Settings.AppletSettings(this, metadata.uuid, instance_id);

    this._appletEnterEventId = 0;
    this._appletLeaveEventId = 0;
    this._appletHoverDelayId = 0;

    this.appSystem = Cinnamon.AppSystem.get_default();
    this.appFavorites = AppFavorites.getAppFavorites();
    this.privacy_settings = new Gio.Settings({
      schema_id: PRIVACY_SCHEMA
    });
    this.privacy_settings.connect('changed::' + REMEMBER_RECENT_KEY, Lang.bind(this, this.refresh));

    // FS search
    this._fileFolderAccessActive = false;
    this._pathCompleter = new Gio.FilenameCompleter();
    this._pathCompleter.set_dirs_only(false);

    // Bind Preference Settings
    this._bindSettingsChanges();
    this._updateActivateOnHover();
    this._updateKeybinding();
    Main.themeManager.connect('theme-set', Lang.bind(this, this._updateIconAndLabel));
    this._updateIconAndLabel();

    // Connect gtk icontheme for when icons change
    this._iconsChangedId = IconTheme.get_default().connect('changed', Lang.bind(this, this._onIconsChanged));
    // Connect to AppSys for when new application installed
    this._installedChangedId = this.appSystem.connect('installed-changed', Lang.bind(this, this._onAppInstalledChanged));
    // Connect to AppFavorites for when favorites change
    this._favoritesChangedId = this.appFavorites.connect('changed', Lang.bind(this, this._onFavoritesChanged));
    this.menu.connect('open-state-changed', Lang.bind(this, this._onOpenStateToggled));

    this._newInstance = true;
    this._knownApps = [];
    this.applicationsByCategory = {};
    this._currentCategory = null;
    this.favorites = [];
    this._allItems = [];
    this._searchTimeoutId = 0;
    this._searchIconClickedId = 0;
    this._activeContainer = null;
    this.menuIsOpen = null;
    this._isBumblebeeInstalled = GLib.file_test('/usr/bin/optirun', GLib.FileTest.EXISTS);
    this._recentEnabled = this.privacy_settings.get_boolean(REMEMBER_RECENT_KEY);

    if (this.enableBookmarks) {
      this.initWebBookmarks();
    }
    this._searchWebErrorsShown = false;
    this._session = new GnomeSession.SessionManager();
    this._screenSaverProxy = new ScreenSaver.ScreenSaverProxy();
    this.recentManager = Gtk.RecentManager.get_default();
    this.placesManager = null;
    this._displayed = false;
    this.menuHeight = 530;
    this.gridWidths = [0, 0, 0, 625, 700, 725, 900, 1025];
    this.fallbackDescription = '';
    if (this.showAppDescriptionsOnButtons) {
      this.fallbackDescription = 'No description available';
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
    Main.keybindingManager.removeHotKey('overlay-key-' + this.instance_id)
  },

  on_applet_clicked: function() {
    this.menu.toggle_with_options(this.enableAnimation);
  },

  _onSourceKeyPress: function(actor, event) {
    let symbol = event.get_key_symbol();
    if (symbol === Clutter.KEY_space || symbol === Clutter.KEY_Return) {
      this.menu.toggle();
      return true;
    } else if (symbol === Clutter.KEY_Escape && this.menu.isOpen && this.menuIsOpen == null) {
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
    Main.keybindingManager.addHotKey('overlay-key-' + this.instance_id, this.overlayKey, Lang.bind(this, function() {
      if (!Main.overview.visible && !Main.expo.visible) {
        this.menu.toggle_with_options(this.enableAnimation);
      }
    }));
  },

  _updateIconAndLabel: function() {
    try {
      if (this.menuIconCustom) {
        if (this.menuIcon === '') {
          this.set_applet_icon_name('');
        } else if (GLib.path_is_absolute(this.menuIcon) && GLib.file_test(this.menuIcon, GLib.FileTest.EXISTS)) {
          if (this.menuIcon.search('-symbolic') !== -1) {
            this.set_applet_icon_symbolic_path(this.menuIcon);
          } else {
            this.set_applet_icon_path(this.menuIcon);
          }
        } else if (Gtk.IconTheme.get_default().has_icon(this.menuIcon)) {
          if (this.menuIcon.search('-symbolic') !== -1) {
            this.set_applet_icon_symbolic_name(this.menuIcon);
          } else {
            this.set_applet_icon_name(this.menuIcon);
          }
        }
      } else {
        this._set_default_menu_icon();
      }
    } catch (e) {
      global.logWarning('Could not load icon file ' + this.menuIcon + ' for menu button');
    }

    if (this.menuIconCustom && this.menuIcon === '') {
      this._applet_icon_box.hide();
    } else {
      this._applet_icon_box.show();
    }

    if (this.orientation === St.Side.LEFT || this.orientation === St.Side.RIGHT) {
      this.set_applet_label('');
    } else {
      if (!this.panelMenuLabelText || this.panelMenuLabelText.length > 0) {
        this.set_applet_label(this.menuLabel); // TBD
        this.set_applet_tooltip(this.menuLabel);
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
      this.menu.open(this.enableAnimation);
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
    if (this.activateOnHover) {
      this._appletEnterEventId = this.actor.connect('enter-event', Lang.bind(this, function() {
        if (this.hover_delay_ms > 0) {
          this._appletLeaveEventId = this.actor.connect('leave-event', Lang.bind(this, this._clearDelayCallbacks));
          this._appletHoverDelayId = Mainloop.timeout_add(this.hover_delay_ms,
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
    this._switchApplicationsView(true);
  },

  // handler for when icons change
  _onIconsChanged: function() {
    // AppFavorites' changed signal gets called before the applet finishes initializing, so
    // we need to defer it here for now.
    Mainloop.idle_add_full(Mainloop.PRIORITY_DEFAULT, Lang.bind(this, this.refresh));
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
        cb: null
      },
      {
        key: 'enable-bookmarks',
        value: 'enableBookmarks',
        cb: Lang.bind(this, this.refresh)
      },
      {
        key: 'menu-label',
        value: 'menuLabel',
        cb: this._updateIconAndLabel
      },
      {
        key: 'startup-view-mode',
        value: 'startupViewMode',
        cb: Lang.bind(this, this.refresh)
      },
      {
        key: 'apps-grid-column-count',
        value: 'appsGridColumnCount',
        cb: Lang.bind(this, this.refresh)
      },
      {
        key: 'category-icon-size',
        value: 'categoryIconSize',
        cb: Lang.bind(this, this.refresh)
      },
      {
        key: 'apps-list-icon-size',
        value: 'appsListIconSize',
        cb: Lang.bind(this, this.refresh)
      },
      {
        key: 'apps-grid-icon-size',
        value: 'appsGridIconSize',
        cb: Lang.bind(this, this.refresh)
      },
      {
        key: 'show-places',
        value: 'showPlaces',
        cb: Lang.bind(this, this.refresh)
      },
      {
        key: 'show-application-icons',
        value: 'showApplicationIcons',
        cb: Lang.bind(this, this.refresh)
      },
      {
        key: 'show-category-icons',
        value: 'showCategoryIcons',
        cb: Lang.bind(this, this.refresh)
      },
      {
        key: 'search-filesystem',
        value: 'searchFilesystem',
        cb: Lang.bind(this, this.refresh)
      },
      {
        key: 'show-apps-description-on-buttons',
        value: 'showAppDescriptionsOnButtons',
        cb: Lang.bind(this, this.refresh)
      },
    ]

    for (let i = 0, len = settingsProps.length; i < len; i++) {
      this.settings.bind(settingsProps[i].key, settingsProps[i].value, settingsProps[i].cb);
    }
  },

  initWebBookmarks: function () {
    this._searchWebBookmarks = new SearchWebBookmarks();
  },

  introspectTheme: function(cb) {
    let appletMenuThemeNode = this.menu.actor.get_theme_node();
    let mainBoxThemeNode = this.mainBox.get_theme_node();
    this.theme = {
      backgroundColor: appletMenuThemeNode.get_background_color().to_string().substring(0, 7),
      foregroundColor: appletMenuThemeNode.get_foreground_color().to_string().substring(0, 7),
      borderColor: appletMenuThemeNode.get_border_color(St.Side.TOP).to_string().substring(0, 7),
      mainBoxBorderColor: mainBoxThemeNode.get_foreground_color().to_string().substring(0, 7),
      borderRadius: appletMenuThemeNode.get_border_radius(St.Corner.TOPRIGHT),
      padding: mainBoxThemeNode.get_padding(St.Side.TOP),
    };
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
        this.appsGridColumnCount = this.appsGridColumnCount;
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
      if (this.searchActive) {
        this.resetSearch();
      }
      this._clearEnteredActors();
      this._clearApplicationsBox();
      // TBD - containers probably don't need to be destroyed. The more things Cinnamenu destroys over and over,
      // the less effective the GC seems to be. Refresh can handle this instead.
      //this._clearAll();
      //this.destroyDisplayed();
      //this._displayed = false;
    }
    return true;
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
    if (this.enableBookmarks) {
      this.webBookmarksCategory = new CategoryListButton(this, 'bookmarks', t("Bookmarks"), 'emblem-favorite', '_selectWebBookmarks');
      this.categoriesBox.add_actor(this.webBookmarksCategory.actor);
    }
    // Load 'all applications' category
    let allAppCategory = new CategoryListButton(this, 'all', t("All Applications"), 'computer');
    this.categoriesBox.add_actor(allAppCategory.actor);
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
          let appCategory = new CategoryListButton(this, dir, dirId);
          this.categoriesBox.add_actor(appCategory.actor);
        }
      }
    }
    // Load 'places' category
    if (this.showPlaces) {
      this.placesCategory = new CategoryListButton(this, 'places', t("Places"), 'folder', '_selectAllPlaces');
      this.categoriesBox.add_actor(this.placesCategory.actor);
    }
    // Load 'recent' category
    if (this._recentEnabled) {
      this.recentCategory = new CategoryListButton(this, 'recent', t("Recent Files"), 'folder-recent', '_selectRecent');
      this.categoriesBox.add_actor(this.recentCategory.actor);
    }
    // Load 'favorite applications' category
    this.favAppCategory = new CategoryListButton(this, 'favorites', t("Favorite Apps"), 'address-book-new');
    this.categoriesBox.add_actor(this.favAppCategory.actor);
  },

  _selectCategory: function(button) {
    this._clearApplicationsBox();
    let category = _.isString(button) ? button : button._dir;
    if (typeof category === 'string') {
      this._displayApplications(this._listApplications(category));
    } else {
      this._displayApplications(this._listApplications(category.get_menu_id()));
    }
  },

  _selectAllPlaces: function() {
    this._clearApplicationsBox();
    let places = _.chain(this._listPlaces())
      .concat(this._listBookmarks())
      .concat(this._listDevices())
      .value();
    this._displayApplications(places);
  },

  _selectBookmarks: function() {
    this._clearApplicationsBox();
    this._displayApplications(this._listBookmarks());
  },

  _selectDevices: function() {
    this._clearApplicationsBox();
    this._displayApplications(this._listDevices());
  },

  _selectRecent: function() {
    this._clearApplicationsBox();
    this._displayApplications(this._listRecent());
  },

  _selectWebBookmarks: function() {
    this._clearApplicationsBox();
    this._displayApplications(this._listWebBookmarks());
  },

  _switchApplicationsView: function(fromToggle) {
    this.isListView = this.startupViewMode === ApplicationsViewMode.LIST;
    if (this.isListView) {
      this._lastGridWidth = this.applicationsGridBox.width
      this.applicationsGridBox.width = this.applicationsListBox.width;
      this.applicationsGridBox.hide();
      this.applicationsListBox.show();
    } else {
      this.applicationsGridBox.width = this.gridWidths[this.appsGridColumnCount];
      this.applicationsListBox.hide();
      this.applicationsGridBox.show();
    }
    // switch activeContainer
    if (_.isEqual(this._activeContainer, this.applicationsListBox) || _.isEqual(this._activeContainer, this.applicationsListBox)) {
      // reset active container
      this._activeContainer = this.isListView ? this.applicationsListBox : this.applicationsGridBox;
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
      //this.mainBox.show();
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
    if (this.enableAnimation) {
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
    this.isListView = this.startupViewMode === ApplicationsViewMode.LIST;
    this._activeContainer = this.isListView ? this.applicationsListBox : this.applicationsGridBox;
    let itemChildren = this._activeContainer.get_children();
    let refItemIndex = _.findIndex(itemChildren, (actor) => {
      return (actor.has_style_class_name('menu-application-button-selected')
        || actor._delegate.entered != null
        || actor._delegate.menu.isOpen);
    });
    if (refItemIndex > -1 && itemChildren[refItemIndex]) {
      if (itemChildren[refItemIndex]._delegate.menu.isOpen) {
        itemChildren[refItemIndex]._delegate.closeMenu();
      }
      itemChildren[refItemIndex]._delegate.handleLeave();
    }
    let categoryChildren = this.categoriesBox.get_children();
    let refCategoryIndex = _.findIndex(categoryChildren, (actor) => {
      return actor._delegate.entered != null;
    });
    if (refCategoryIndex > -1 && categoryChildren[refCategoryIndex]) {
      categoryChildren[refCategoryIndex]._delegate.handleLeave();
    }
    let powerGroupChildren = this.powerGroupBox.get_children();
    let refPowerGroupItemIndex = _.findIndex(powerGroupChildren, (actor) => {
      return actor._delegate.entered != null;
    });
    if (refPowerGroupItemIndex > -1 && powerGroupChildren[refPowerGroupItemIndex]) {
      powerGroupChildren[refPowerGroupItemIndex]._delegate.handleLeave();
    }
  },

  _clearApplicationsBox: function() {
    if (!this.searchActive) {
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

  _listPlaces: function(pattern) {
    if (!this.placesManager || !this.showPlaces) {
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

  _listBookmarks: function(pattern) {
    if (!this.placesManager || !this.showPlaces) {
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

  _listWebBookmarks: function(pattern) {
    if (!this.enableBookmarks) {
      return [];
    }
    if (!this._searchWebErrorsShown && !Firefox.Gda) {
      let notifyMessage = t('gir1.2-gda-5.0 package required for Firefox and Midori bookmarks.');
      this.answerText.set_text(notifyMessage);
      this.answerText.show();
    } else if (this.answerText.is_visible()) {
      this.answerText.hide();
    }
    this._searchWebErrorsShown = true;

    let res = [];
    let bookmarks = _.chain(Chromium.bookmarks)
      .concat(GoogleChrome.bookmarks)
      .concat(Firefox.bookmarks)
      .concat(Midori.bookmarks)
      .concat(Opera.bookmarks)
      .value();

    for (let i = 0, len = bookmarks.length; i < len; i++) {
      res.push({
        app: bookmarks[i].appInfo,
        name: bookmarks[i].name,
        icon: bookmarks[i].appInfo.get_icon(),
        mime: null,
        uri: bookmarks[i].uri,
        description: bookmarks[i].uri,
        type: ApplicationType._places
      });
    }

    // Create a unique list of bookmarks across all browsers.
    let arr = {};

    for (let i = 0, len = res.length; i < len; i++ ) {
      arr[res[i].uri] = res[i];
    }

    res = []
    let arrKeys = Object.keys(arr);

    for (let i = 0, len = arrKeys.length; i < len; i++ ) {
      let bookmark = arr[arrKeys[i]];
      let searchableProps = ['name', 'description'];
      let match = null;
      if (pattern) {
        for (let z = 0, len = searchableProps.length; z < len; z++ ) {
          match = fuzzy(pattern, bookmark[searchableProps[z]], fuzzyOptions)
          if (bookmark[searchableProps[z]] && match.score > 0.6) {
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

  _listDevices: function(pattern) {
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

  _listRecent: function(pattern) {
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
        name: t('Clear List'),
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
      this.answerText.set_text(t('No recent documents'));
      this.answerText.show();
    }

    if (pattern) {
      let _res = [];

      for (let i = 0, len = res.length; i < len; i++) {
        let recentItem = res[i];
        let searchableProps = ['name', 'description'];
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

  _listApplications: function(categoryMenuId, pattern) {
    let res = [];

    if (categoryMenuId === 'favorites') {
      res = this.favorites;
    } else {
      if (categoryMenuId && categoryMenuId !== 'all') {
        res = this.applicationsByCategory[categoryMenuId];
      } else {
        for (let directory in this.applicationsByCategory) {
          res = _.chain(res)
          .concat(this.applicationsByCategory[directory])
          .uniq()
          .value();
        }
      }
    }

    if (pattern) {
      let _res = [];
      for (let i = 0, len = res.length; i < len; i++) {
        let app = res[i];
        _.assignIn(app, {
          name: app.get_name(),
          keywords: app.get_name(),
          description:app.get_description(),
          id: app.get_id(),
          type: ApplicationType._applications
        });

        let searchableProps = ['name', 'keywords', 'description'];
        let match = null;
        for (let z = 0, len = searchableProps.length; z < len; z++ ) {
          match = fuzzy(pattern, app[searchableProps[z]], fuzzyOptions)
          if (app[searchableProps[z]] && match.score > 0.4) {
            app.score = match.score;
            app[searchableProps[z]] = match.result;
            _res.push(app);
            break;
          }
        }
      }
      res = _res;
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

    return res;
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
    if (this.mainBox && !this.theme) {
      this.introspectTheme(() => this._displayApplications(appList));
      return false;
    }

    let column = 0;
    let columnsCount = 0;
    let rownum = 0;

    this.isListView = this.startupViewMode === ApplicationsViewMode.LIST;
    this._activeContainer = this.isListView ? this.applicationsListBox : this.applicationsGridBox;
    this.menuIsOpen = null;

    let createAppButton = (app, appType, len, appIndex)=>{
      let appButton;
      let refAppButton = -1;
      for (let i = 0, _len = this._allItems.length; i < _len; i++) {
        if (_.isEqual(this._allItems[i].app, app)) {
          refAppButton = i;
          break;
        }
      }
      if (refAppButton > -1 && this._allItems[refAppButton]) {
        appButton = this._allItems[refAppButton];
        appButton.app = app;
        appButton.appType = appType;
        appButton.len = len;
      } else {
        appButton = new AppListGridButton(this, app, appType, appIndex, len);
        this._allItems.push(appButton);
      }

      if (this.isListView) {
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
        if (column > this.appsGridColumnCount - 1) {
          column = 0;
          rownum++;
        }
        appButton.setColumn(column);
      }
    };

    if (!this.searchActive && _.last(appList) && !_.last(appList).clearList) {
      appList = _.orderBy(appList, 'name');
    }
    for (let z = 0, len = appList.length; z < len; z++) {
      if (appList[z].type === undefined) {
        appList[z].type = ApplicationType._applications;
      }

      for (let y = 0, len = AppTypes.length; y < len; y++) {
        if (ApplicationType[AppTypes[y]] !== appList[z].type) {
          continue;
        }

        createAppButton(appList[z], appList[z].type, len, z);
      }
    }
    this.columnsCount = columnsCount;
    //dt.stop();
  },


  _onMenuKeyPress: function(actor, event) {
    this.isListView = this.startupViewMode === ApplicationsViewMode.LIST;
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

    let itemChildren = this._activeContainer.get_children();

    let refItemIndex = _.findIndex(itemChildren, (actor) => {
      return (actor.has_style_class_name('menu-application-button-selected')
        || actor._delegate.entered != null
        || actor._delegate.menu.isOpen);
    });

    let categoryChildren = this.categoriesBox.get_children();
    let refCategoryIndex = _.findIndex(categoryChildren, (actor) => {
      return actor._delegate.entered != null;
    });

    let powerGroupChildren = this.powerGroupBox.get_children();
    let refPowerGroupItemIndex = _.findIndex(powerGroupChildren, (actor) => {
      return actor._delegate.entered != null;
    });

    let contextMenuChildren = [];
    let refContextMenuItemIndex = -1;

    let enteredItemExists = refItemIndex > -1 && itemChildren[refItemIndex] != null;
    let enteredCategoryExists = refCategoryIndex > -1 && categoryChildren[refCategoryIndex] != null;
    let enteredPowerGroupItemExists = refPowerGroupItemIndex > -1 && powerGroupChildren[refPowerGroupItemIndex] != null;
    let enteredContextMenuItemExists = false;

    if (enteredItemExists) {
      if ((ctrlKey || itemChildren[refItemIndex]._delegate.menu.isOpen)
        && itemChildren[refItemIndex]._delegate.menu.box) {
        contextMenuChildren = itemChildren[refItemIndex]._delegate.menu.box.get_children();
        refContextMenuItemIndex = _.findIndex(contextMenuChildren, (actor) => {
          return actor._delegate.entered != null;
        });
        enteredContextMenuItemExists = refContextMenuItemIndex > -1 && contextMenuChildren[refContextMenuItemIndex] != null;
        if (enteredContextMenuItemExists) {
          contextMenuChildren[refContextMenuItemIndex]._delegate.handleLeave();
        } else {
          itemChildren[refItemIndex]._delegate.handleLeave();
        }
      } else {
        itemChildren[refItemIndex]._delegate.handleLeave();
      }

    }
    if (enteredCategoryExists) {
      categoryChildren[refCategoryIndex]._delegate.handleLeave();
    }
    if (enteredPowerGroupItemExists) {
      powerGroupChildren[refPowerGroupItemIndex]._delegate.handleLeave();
    }
    /*log2('symbol', symbol)
    log2('refItemIndex', refItemIndex, 'refCategoryIndex', refCategoryIndex, 'refPowerGroupItemIndex', refPowerGroupItemIndex, 'refContextMenuItemIndex', refContextMenuItemIndex)
    log2('this.isListView', this.isListView)*/
    let startingCategoryIndex = _.findIndex(categoryChildren, (actor) => {
      return this._currentCategory === actor._delegate.categoryNameText;
    });
    startingCategoryIndex = this.enableBookmarks && startingCategoryIndex <= 0 ? 1 : startingCategoryIndex;

    const previousItemNavigation = (index) => {
      let up = (typeof itemChildren[index] === 'undefined' && enteredItemExists
        || typeof categoryChildren[refCategoryIndex - 1] === 'undefined' && enteredCategoryExists
        || typeof powerGroupChildren[refPowerGroupItemIndex - 1] === 'undefined' && enteredPowerGroupItemExists);
      if (index < 0) {
        index = 0;
      }
      if (contextMenuChildren[index] && refContextMenuItemIndex !== index) {
        contextMenuChildren[index]._delegate.handleEnter();
      } else if (enteredItemExists && itemChildren[refItemIndex]._delegate.menu.isOpen) {
        _.last(contextMenuChildren)._delegate.handleEnter();
      } else if (up) {
        categoryChildren[startingCategoryIndex]._delegate.handleEnter();
      } else if (enteredPowerGroupItemExists) {
        powerGroupChildren[refPowerGroupItemIndex - 1]._delegate.handleEnter();
      } else if (enteredItemExists) {
        itemChildren[index]._delegate.handleEnter();
      } else if (enteredCategoryExists) {
        categoryChildren[refCategoryIndex - 1]._delegate.handleEnter();
      }
    };

    const nextItemNavigation = (index) => {
      let down = (typeof itemChildren[index] === 'undefined' && enteredItemExists
        || typeof categoryChildren[refCategoryIndex + 1] === 'undefined' && enteredCategoryExists
        || typeof powerGroupChildren[refPowerGroupItemIndex + 1] === 'undefined' && enteredPowerGroupItemExists);
      if (index < 0) {
        index = 0;
      }
      if (contextMenuChildren[index] && refContextMenuItemIndex !== index) {
        contextMenuChildren[index]._delegate.handleEnter();
      } else if (enteredItemExists && itemChildren[refItemIndex]._delegate.menu.isOpen) {
        _.first(contextMenuChildren)._delegate.handleEnter();
      } else if (down) {
        _.first(powerGroupChildren)._delegate.handleEnter();
      } else if (enteredPowerGroupItemExists) {
        powerGroupChildren[refPowerGroupItemIndex + 1]._delegate.handleEnter();
      } else if (enteredCategoryExists) {
        categoryChildren[refCategoryIndex + 1]._delegate.handleEnter();
      } else if (itemChildren[index]) {
        itemChildren[index]._delegate.handleEnter();
      }
    };

    const leftNavigation = () => {
      if ((enteredItemExists
        && refItemIndex === 0)
        || (enteredItemExists
        && this.isListView)
        || (!enteredItemExists
          && !enteredCategoryExists
          && !enteredPowerGroupItemExists)) {
        if (!enteredCategoryExists && !this.searchActive) {
          categoryChildren[startingCategoryIndex]._delegate.handleEnter();
        }
      } else if (!enteredCategoryExists) {
        previousItemNavigation(refItemIndex - 1);
      }
    };

    const rightNavigation = () => {
      if (enteredItemExists && refItemIndex === itemChildren.length - 1) {
        _.first(itemChildren)._delegate.handleEnter();
      } else if (this.isListView && enteredItemExists) {
        itemChildren[refItemIndex]._delegate.handleEnter();
      } else {
        enteredCategoryExists = null;
        nextItemNavigation(refItemIndex + 1);
      }
    };

    const downNavigation = () => {
      if (enteredContextMenuItemExists) {
        nextItemNavigation(refContextMenuItemIndex + 1);
      } else if (enteredPowerGroupItemExists) {
        powerGroupChildren[refPowerGroupItemIndex]._delegate.handleEnter();
      } else if (this.isListView || enteredContextMenuItemExists) {
        nextItemNavigation(refItemIndex + 1);
      } else {
        nextItemNavigation((refItemIndex + 1) + (this.appsGridColumnCount - 1));
      }
    };

    const tabNavigation = () => {
      if (enteredItemExists) {
        _.first(powerGroupChildren)._delegate.handleEnter();
      } else if (enteredPowerGroupItemExists) {
        categoryChildren[startingCategoryIndex]._delegate.handleEnter();
      } else {
        _.first(itemChildren)._delegate.handleEnter();
      }
    };

    const upNavigation = () => {
      if (enteredContextMenuItemExists) {
        previousItemNavigation(refContextMenuItemIndex - 1);
      } else if (enteredPowerGroupItemExists) {
        tabNavigation();
      } else if (this.isListView || enteredContextMenuItemExists) {
        previousItemNavigation(refItemIndex - 1);
      } else {
        previousItemNavigation((refItemIndex - 1) - (this.appsGridColumnCount - 1));
      }
    };

    const activateItem = () => {
      if (enteredContextMenuItemExists) {
        contextMenuChildren[refContextMenuItemIndex]._delegate.activate();
      } else if (enteredItemExists) {
        if (ctrlKey) {
          itemChildren[refItemIndex]._delegate.closeMenu();
        } else {
          itemChildren[refItemIndex]._delegate.activate();
        }
      } else if (enteredPowerGroupItemExists) {
        powerGroupChildren[refPowerGroupItemIndex]._delegate._onButtonReleaseEvent();
      } else if (this.searchActive && itemChildren.length > 0) {
        _.first(itemChildren)._delegate.activate();
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
          _.first(itemChildren)._delegate.handleEnter();
        } else if (enteredCategoryExists) {
          _.first(categoryChildren)._delegate.handleEnter();
        } else if (enteredPowerGroupItemExists) {
          _.first(powerGroupChildren)._delegate.handleEnter();
        }
        return true
      case symbol === Clutter.KEY_Page_Down:
        if (enteredItemExists) {
          _.last(itemChildren)._delegate.handleEnter();
        } else if (enteredCategoryExists) {
          _.last(categoryChildren)._delegate.handleEnter();
        } else if (enteredPowerGroupItemExists) {
          _.last(powerGroupChildren)._delegate.handleEnter();
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
        if (enteredItemExists && itemChildren[refItemIndex]._delegate.menu.isOpen) {
          itemChildren[refItemIndex]._delegate.toggleMenu();
          return true;
        }
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
    this.searchActive = false;
    if (this._activeContainer) {
      this._activeContainer.show();
    }
    if (!this._activeContainer) {
      this._activeContainer = this.startupViewMode === ApplicationsViewMode.LIST ? this.applicationsListBox : this.applicationsGridBox;
    }
    let apps = this._activeContainer.get_children();
    for (let i = 0, len = apps.length; i < len; i++) {
      apps[i]._delegate.clearSearchFormatting();
    }
    this.selectedAppTitle.set_text('');
    this.selectedAppDescription.set_text('');
    global.stage.set_key_focus(this.searchEntry);
  },

  _onSearchTextChanged: function() {
    let searchText = this.searchEntry.get_text();

    let categoryChildren = this.categoriesBox.get_children();

    for (let i = 0, len = categoryChildren.length; i < len; i++) {
      if (searchText.length > 0) {
        categoryChildren[i]._delegate.disable();
      } else {
        categoryChildren[i]._delegate.enable();

      }
    }

    if (this.searchActive && searchText.length === 0) {
      this._resetDisplayApplicationsToStartup();
    }

    /*this.selectedAppTitle.set_text('');
    this.selectedAppDescription.set_text('');*/
    this.searchActive = searchText.length > 0;

    if (this.searchActive) {
      this.searchEntry.set_secondary_icon(this._searchActiveIcon);

      if (this._searchIconClickedId === 0) {
        this._searchIconClickedId = this.searchEntry.connect('secondary-icon-clicked', Lang.bind(this, function() {
          this._resetDisplayApplicationsToStartup();
        }));
      }
    } else {
      if (this._searchIconClickedId > 0) {
        this.searchEntry.disconnect(this._searchIconClickedId);
      }

      this._searchIconClickedId = 0;
      this.searchEntry.set_secondary_icon(null);
    }
    if (!this.searchActive) {
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
      } catch (e) {}
    }

    // _listApplications returns all the applications when the search
    // string is zero length. This will happend if you type a space
    // in the search entry.
    if (pattern.length === 0) {
      return false;
    }

    let appResults = this._listApplications(null, pattern);

    let placesResults = [];

    let places = this._listPlaces(pattern);

    for (let i = 0, len = places.length; i < len; i++) {
      placesResults.push(places[i]);
    }

    let webBookmarks = this._listWebBookmarks(pattern);

    for (let i = 0, len = webBookmarks.length; i < len; i++) {
      placesResults.push(webBookmarks[i]);
    }

    let recentResults = this._listRecent(pattern);

    let acResults = []; // search box autocompletion results
    if (this.searchFilesystem) {
      // Don't use the pattern here, as filesystem is case sensitive
      acResults = this._getCompletions(text);
    }

    let results = _.chain(appResults)
      .concat(placesResults)
      .concat(recentResults)
      .concat(acResults)
      .orderBy('score', 'desc')
      .value();

    this._clearApplicationsBox();
    this._displayApplications(results);

    return false;
  },

  _display: function() {
    this.isListView = this.startupViewMode === ApplicationsViewMode.LIST;
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
    vscrollCategories.connect('scroll-start', Lang.bind(this, function() {
      this.menu.passEvents = true;
    }));
    vscrollCategories.connect('scroll-stop', Lang.bind(this, function() {
      this.menu.passEvents = false;
    }));
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
      hint_text: t("Type to search..."),
      track_hover: true,
      can_focus: true
    });

    this.searchEntry.set_primary_icon(this._searchInactiveIcon);
    this.searchBox.add(this.searchEntry, {
      expand: true,
      x_align: St.Align.START,
      y_align: St.Align.START
    });
    this.searchActive = false;
    this.searchEntryText = this.searchEntry.clutter_text;
    this.searchEntryText.connect('text-changed', Lang.bind(this, this._onSearchTextChanged));
    this.searchEntryText.connect('key-press-event', Lang.bind(this, this._onMenuKeyPress));
    this._previousSearchPattern = '';

    //Load Favorites
    this.favorites = this.appFavorites.getFavorites();

    // Load Places
    if (PlaceDisplay && this.showPlaces) {
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
    vscrollApplications.connect('scroll-start', () => {
      this.menu.passEvents = true;
    });
    vscrollApplications.connect('scroll-stop', () => {
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
      width: this.gridWidths[this.appsGridColumnCount]
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
    this.applicationsScrollBox.set_auto_scrolling(this.enableAutoScroll);
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

    let user = new GroupButton(
      this,
      'user',
      16,
      '',
      '',
      () => Util.spawnCommandLine('cinnamon-settings user')
    );
    let _t = this;
    let viewModeToggle = new GroupButton(
      this,
      this.isListView ? 'view-list-symbolic' : 'view-grid-symbolic',
      16,
      this.isListView ? t("Grid View") : t("List View"),
      this.isListView ? t("Switch to grid view") : t("Switch to list view"),
      function (actor) {
        //let parent = actor.get_parent();
        if (_t.isListView) {
          _t.isListView = false;
          this.setIcon('view-list-symbolic');
          this.name = t("List View");
          this.description = t("Switch to list view");
          _t.settings.setValue('startup-view-mode', 1);
        } else {
          _t.isListView = true;
          this.setIcon('view-grid-symbolic');
          this.name = t("Grid View");
          this.description = t("Switch to grid view");
          _t.settings.setValue('startup-view-mode', 0);
        }
        _t._switchApplicationsView(true);
      }
    );
    let lockScreen = new GroupButton(
      this,
      'system-lock-screen',
      16,
      t("Lock Screen"),
      t("Lock the screen"),
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
    );
    let logoutUser = new GroupButton(
      this,
      'application-exit',
      16,
      t("Logout"),
      t("Leave the session"),
      () => this._session.LogoutRemote(0)
    );
    let systemShutdown = new GroupButton(
      this,
      'system-shutdown',
      16,
      t("Quit"),
      t("Shutdown the computer"),
      () => this._session.ShutdownRemote()
    );
    let powerGroupBoxChildProperties = {
      x_fill: false,
      y_fill: false,
      x_align: St.Align.MIDDLE,
      y_align: St.Align.MIDDLE
    };
    this.powerGroupBox.add(user.actor, powerGroupBoxChildProperties);
    this.powerGroupBox.add(viewModeToggle.actor, powerGroupBoxChildProperties);
    this.powerGroupBox.add(lockScreen.actor, powerGroupBoxChildProperties);
    this.powerGroupBox.add(logoutUser.actor, powerGroupBoxChildProperties);
    this.powerGroupBox.add(systemShutdown.actor, powerGroupBoxChildProperties);

    // Place boxes in proper containers. The order added determines position
    this.groupCategoriesWorkspacesWrapper.add(this.categoriesBox, {
      x_fill: false,
      y_fill: true,
      x_align: St.Align.START,
      y_align: St.Align.END,
      y_expand: true,
      expand: false
    });
    if (!this.showAppDescriptionsOnButtons) {
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
      _.pullAt(this._allItems, i);
    }
    this._allItems = [];
  },

  destroy: function() {
    this.destroyAppButtons();
    this._activeContainer.destroy();
    this.destroyDisplayed();
    if (this._searchWebBookmarks) {
      this._searchWebBookmarks.destroy();
    }
    // Disconnect global signals
    if (this._installedChangedId) {
      this.appSystem.disconnect(this._installedChangedId);
    }

    if (this._favoritesChangedId) {
      AppFavorites.getAppFavorites().disconnect(this._favoritesChangedId);
    }

    if (this._iconsChangedId) {
      IconTheme.get_default().disconnect(this._iconsChangedId);
    }

    if (this._themeChangedId) {
      St.ThemeContext.get_for_stage(global.stage).disconnect(this._themeChangedId);
    }

    if (this._overviewShownId) {
      Main.overview.disconnect(this._overviewShownId);
    }

    if (this._overviewHiddenId) {
      Main.overview.disconnect(this._overviewHiddenId);
    }

    if (this._overviewPageChangedId) {
      Main.overview.disconnect(this._overviewPageChangedId);
    }

    this.menu.destroy();
    this.actor.destroy();
    this.emit('destroy');
  },
};

function main(metadata, orientation, panel_height, instance_id) {
  return new CinnamenuApplet(metadata, orientation, panel_height, instance_id);
}