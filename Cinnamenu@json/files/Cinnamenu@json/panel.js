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
const Signals = imports.signals;
const PopupMenu = imports.ui.popupMenu;
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
 * @name CinnamenuPanel
 * @description The primary container class holding all of the menu's actors and related logic.
 *
 * @param {class} applet (CinnamenuButton)
 */

function CinnamenuPanel() {
  this._init.apply(this, arguments)
}

CinnamenuPanel.prototype = {

  _init: function(applet) {
    this.launcher = {};

    this.actor = new Cinnamon.GenericContainer({
      style_class: 'panel-button'
    });
    this._applet = applet;
    this.orientation = applet.orientation;
    this.menu = applet.menu

    this.actor.add_style_class_name('panel-status-button');

    let manager;
    if (this.orientation === St.Side.TOP || this.orientation === St.Side.BOTTOM) {
      manager = new Clutter.BoxLayout({
        orientation: Clutter.Orientation.HORIZONTAL
      });
    } else {
      manager = new Clutter.BoxLayout({
        orientation: Clutter.Orientation.VERTICAL
      });
      this.actor.add_style_class_name('vertical');
      this._applet.actor.add_style_class_name('vertical');
    }

    this.manager = manager;

    this._bin = new Clutter.Actor({
      layout_manager: manager
    })
    this._box = new St.BoxLayout({
      style_class: 'cinnamenu-panel-menu-button'
    });

    this._bin.add_child(this._box);
    this.actor.add_actor(this._bin);

    this.launcher.actor = this.actor;

    this.panelEditId = global.settings.connect('changed::panel-edit-mode', Lang.bind(this, this.on_panel_edit_mode_changed))

    this.menu.connect('open-state-changed', Lang.bind(this, this._onOpenStateToggled));

    this._newInstance = true;
    this._knownApps = [];
    this.applicationsByCategory = {};
    this.favorites = [];
    this._allItems = [];
    this._applicationsViewMode = this._applet.startupViewMode;
    this._searchTimeoutId = 0;
    this._searchIconClickedId = 0;
    this._selectedItemIndex = null;
    this._previousSelectedItemIndex = null;
    this._activeContainer = null;
    this.menuIsOpen = null;
    this._isBumblebeeInstalled = GLib.file_test('/usr/bin/optirun', GLib.FileTest.EXISTS);
    this._recentEnabled = this._applet.privacy_settings.get_boolean(REMEMBER_RECENT_KEY);

    if (this._applet.enableBookmarks) {
      this.initWebBookmarks();
    }
    this._searchWebErrorsShown = false;
    this._session = new GnomeSession.SessionManager();
    this._screenSaverProxy = new ScreenSaver.ScreenSaverProxy();
    this.recentManager = Gtk.RecentManager.get_default();
    this.placesManager = null;
    this._displayed = false;
    this.menuHeight = 530;
    this.fallbackDescription = '';
    if (this._applet.showAppDescriptionsOnButtons) {
      this.fallbackDescription = 'No description available';
    }
  },

  on_panel_edit_mode_changed: function() {
    this.actor.reactive = !global.settings.get_boolean('panel-edit-mode')
  },

  initWebBookmarks: function () {
    this._searchWebBookmarks = new SearchWebBookmarks();
  },

  introspectTheme: function(cb) {
    let appletMenuThemeNode = this._applet.menu.actor.get_theme_node();
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
    if (global.settings.get_boolean('panel-edit-mode') || this.menuIsOpen) {
      return false;
    }
    if (this._applet._appletEnterEventId > 0) {
      this._applet.actor.handler_block(this._applet._appletEnterEventId);
    }
    if (open) {
      if (!this._displayed) {
        this._display();
      }
      this.introspectTheme(()=>{

        // Load Startup Applications category
        this._selectedItemIndex = null;

        this._switchApplicationsView();

        this._applet.appsGridColumnCount = this._applet.appsGridColumnCount;

        // Set Category
        this.categoriesBox.show();
        this._widthCategoriesBox = 0;

        // Adjust width of categories box
        // Determine width based on user-power group button widths
        let groupWidth = this.groupCategoriesWorkspacesScrollBox.width;
        this.powerGroupBox.width = groupWidth;
        this.categoriesBox.width = this.groupCategoriesWorkspacesScrollBox.width;
        this._widthCategoriesBox = this.groupCategoriesWorkspacesScrollBox.width;

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
      this._clearCategorySelections(this.categoriesBox);
      this._clearTabFocusSelections();
      this._clearApplicationsBox();
      global.stage.set_key_focus(null);
      this._clearAll();
      this.destroyDisplayed();
      this._displayed = false;
    }
    return true;
  },

  refresh: function() {
    this._clearAll();
    this.destroyDisplayed();
    this._displayed = false;
    this._display();
    this.destroyAppButtons();
  },

  _clearAll: function() {
    this.menu.removeAll();
  },

  _loadAppCategories: function(dir, root) {
    let rootDir = root;
    let iter = dir.iter();
    let nextType;
    while ((nextType = iter.next()) !== CMenu.TreeItemType.INVALID) {
      if (nextType === CMenu.TreeItemType.ENTRY) {
        let entry = iter.get_entry();
        if (!entry.get_app_info().get_nodisplay()) {
          let id = entry.get_desktop_file_id();
          let app = this._applet.appSystem.lookup_app(id);
          if (rootDir) {
            let rootDirId = rootDir.get_menu_id();
            if (rootDirId) {
              this.applicationsByCategory[rootDirId].push(app);
            }
          } else {
            let dirMenuId = dir.get_menu_id();
            if (dirMenuId) {
              this.applicationsByCategory[dirMenuId].push(app);
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
          this._loadAppCategories(iter.get_directory(), rootDir);
        } else {
          this._loadAppCategories(iter.get_directory(), dir);
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
    if (this._applet.enableBookmarks) {
      this.webBookmarksCategory = new CategoryListButton(this, 'bookmarks', t("Bookmarks"), 'emblem-favorite', '_selectWebBookmarks');
      this.categoriesBox.add_actor(this.webBookmarksCategory.actor);
    }

    // Load 'all applications' category
    let allAppCategory = new CategoryListButton(this, 'all', t("All Applications"), 'computer');
    this.allAppCategory = allAppCategory;
    this.categoriesBox.add_actor(allAppCategory.actor);

    let trees = [this._applet.appSystem.get_tree()];
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

      for (let i = 0, len = dirs.length; i < len; i++) {
        let dir = dirs[i];
        if (dir.get_is_nodisplay()) {
          continue;
        }
        this.applicationsByCategory[dir.get_menu_id()] = [];
        this._loadAppCategories(dir);
        if (this.applicationsByCategory[dir.get_menu_id()].length > 0) {
          let appCategory = new CategoryListButton(this, dir);
          this.categoriesBox.add_actor(appCategory.actor);
        }
      }
    }

    // Load 'places' category
    if (this._applet.showPlaces) {
      this.placesCategory = new CategoryListButton(this, 'places', t("Places"), 'folder', '_selectAllPlaces');
      this.categoriesBox.add_actor(this.placesCategory.actor);
    }

    // Load 'recent' category
    if (this._recentEnabled) {
      this.recentCategory = new CategoryListButton(this, 'recent', t("Recent"), 'folder-recent', '_selectRecent');
      this.categoriesBox.add_actor(this.recentCategory.actor);
    }

    // Load 'favorite applications' category
    let favAppCategory = new CategoryListButton(this, 'favorites', t("Favorite Apps"), 'address-book-new');
    this.favAppCategory = favAppCategory;
    this.categoriesBox.add_actor(favAppCategory.actor);
  },

  _selectCategory: function(button, refresh) {
    this._clearApplicationsBox();

    let category = button._dir;
    if (typeof category === 'string') {
      this._displayApplications(this._listApplications(category));
    } else {
      this._displayApplications(this._listApplications(category.get_menu_id()));
    }

    // Cache the current category button so we can invoke this function to get around the list/grid toggle
    // not showing the app list.

    this._currentSelectKey = '_selectCategory';
    if (this._currentCategoryButton) {
      this._previousCategoryButton = this._currentCategoryButton;
    }
    this._currentCategoryButton = button;
  },

  _selectFavorites: function(button) {
    // This is only called when the favorites change
    this._clearApplicationsBox();
    this.favorites = this._applet.appFavorites.getFavorites();
    for (let i = 0, len = this.favorites.length; i < len; i++) {
      this.favorites[i].type = ApplicationType._applications;
    }
    this._displayApplications(this.favorites);

    if (button) {
      this._currentSelectKey = '_selectFavorites';
      if (this._currentCategoryButton) {
        this._previousCategoryButton = this._currentCategoryButton;
      }
      this._currentCategoryButton = button;
    } else {
      this[this._currentSelectKey](this._currentCategoryButton);
    }
  },

  _selectAllPlaces: function(button) {
    this._clearApplicationsBox();
    let places = this._listPlaces();
    let bookmarks = this._listBookmarks();
    let devices = this._listDevices();

    let allPlaces = places.concat(bookmarks.concat(devices));
    this._displayApplications(allPlaces);
    this._currentSelectKey = '_selectAllPlaces';
    if (this._currentCategoryButton) {
      this._previousCategoryButton = this._currentCategoryButton;
    }
    this._currentCategoryButton = button;
  },

  _selectBookmarks: function(button) {
    this._clearApplicationsBox();

    let bookmarks = this._listBookmarks();
    this._displayApplications(bookmarks);
    this._currentSelectKey = '_selectBookmarks';
    if (this._currentCategoryButton) {
      this._previousCategoryButton = this._currentCategoryButton;
    }
    this._currentCategoryButton = button;
  },

  _selectDevices: function(button) {
    this._clearApplicationsBox();

    let devices = this._listDevices();
    this._displayApplications(devices);
    this._currentSelectKey = '_selectDevices';
    if (this._currentCategoryButton) {
      this._previousCategoryButton = this._currentCategoryButton;
    }
    this._currentCategoryButton = button;
  },

  _selectRecent: function(button) {
    this._clearApplicationsBox();

    let recent = this._listRecent();
    this._displayApplications(recent);
    this._currentSelectKey = '_selectRecent';
    if (this._currentCategoryButton) {
      this._previousCategoryButton = this._currentCategoryButton;
    }
    this._currentCategoryButton = button;
  },

  _selectWebBookmarks: function(button) {
    this._clearApplicationsBox();

    let webBookmarks = this._listWebBookmarks();
    this._displayApplications(webBookmarks);
    this._currentSelectKey = '_selectWebBookmarks';
    if (this._currentCategoryButton) {
      this._previousCategoryButton = this._currentCategoryButton;
    }
    this._currentCategoryButton = button;
  },

  _switchApplicationsView: function() {
    this._applicationsViewMode = this._applet.startupViewMode;
    let isListView = this._applicationsViewMode === ApplicationsViewMode.LIST;

    if (isListView) {
      this.applicationsListBox.show();
      this.applicationsGridBox.hide();
    } else {
      this.applicationsListBox.hide();
      this.applicationsGridBox.show();
    }

    // switch activeContainer and reset _selectedItemIndex for keyboard navigation
    if (_.isEqual(this._activeContainer, this.applicationsListBox) || _.isEqual(this._activeContainer, this.applicationsListBox)) {

      // reset active container
      this._activeContainer = isListView ? this.applicationsListBox : this.applicationsGridBox;
      this._selectedItemIndex = -1;

      // reset scroll to top
      let vscroll = this.applicationsScrollBox.get_vscroll_bar();
      let new_scroll_value = this.applicationsScrollBox.get_allocation_box().y1;
      vscroll.get_adjustment().set_value(new_scroll_value);
    }

    this._clearApplicationsBox();
  },

  _clearCategorySelections: function(container, selectedCategory) {
    let categoryActors = container.get_children();
    if (categoryActors) {
      for (let i = 0, len = categoryActors.length; i < len; i++) {
        let actor = categoryActors[i];
        if (selectedCategory && (actor === selectedCategory.actor)) {
          actor.add_style_class_name('popup-sub-menu');
          if (this._style1) {
            actor.set_style(this._style1);
          }
        } else {
          actor.remove_style_class_name('popup-sub-menu');
          actor.set_style('border-color: none');
        }
      }
    }
  },

  _clearTabFocusSelections: function() {
    this._selectedItemIndex = -1;
  },

  _clearApplicationsBox: function() {
    if (this.applicationsListBox) {
      let listActors = this.applicationsListBox.get_children();
      if (listActors) {
        for (let i = 0, len = listActors.length; i < len; i++) {
          listActors[i]._delegate.closeMenu();
          this.applicationsListBox.remove_actor(listActors[i]);
        }
      }
    }

    if (this.applicationsGridBox) {
      let gridActors = this.applicationsGridBox.get_children();
      if (gridActors) {
        for (let i = 0, len = gridActors.length; i < len; i++) {
          gridActors[i]._delegate.closeMenu();
          this.applicationsGridBox.remove_actor(gridActors[i]);
        }
      }
    }
  },

  _listPlaces: function(pattern) {
    if (!this.placesManager || !this._applet.showPlaces) {
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
    if (!this.placesManager || !this._applet.showPlaces) {
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
    if (!this._applet.enableBookmarks) {
      return [];
    }
    if (!this._searchWebErrorsShown) {
      if (!Firefox.Gda) {
        let notifyTitle = t("Cinnamenu: Search Firefox bookmarks disabled");
        let notifyMessage = t(
          "If you want to search Firefox bookmarks, you must install the required pacakages: libgir1.2-gda-5.0 [Ubuntu] or libgda-sqlite [Fedora]"
        );
        this.selectedAppTitle.set_text(notifyTitle);
        this.selectedAppDescription.set_text(notifyMessage);
      }
      if (!Midori.Gda) {
        let notifyTitle = t("Cinnamenu: Search Midori bookmarks disabled");
        let notifyMessage = t(
          "If you want to search Midori bookmarks, you must install the required pacakages: libgir1.2-gda-5.0 [Ubuntu] or libgda-sqlite [Fedora]"
        );
        this.selectedAppTitle.set_text(notifyTitle);
        this.selectedAppDescription.set_text(notifyMessage);
      }
    }
    this._searchWebErrorsShown = true;

    let res = [];
    let bookmarks = Chromium.bookmarks
      .concat(GoogleChrome.bookmarks)
      .concat(Firefox.bookmarks)
      .concat(Midori.bookmarks)
      .concat(Opera.bookmarks);

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
          match = fuzzy.match(pattern, bookmark[searchableProps[z]], fuzzyOptions)
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

    for (let i = 0, len = recentFiles.length; i < len; i++) {
      let recentInfo = recentFiles[i];
      if (recentInfo.exists()) {
        res.push({
          name: recentInfo.get_display_name(),
          icon: recentInfo.get_gicon(),
          mime: recentInfo.get_mime_type(),
          uri: recentInfo.get_uri(),
          description: recentInfo.get_uri(),
          type: ApplicationType._recent
        });
      }
    }

    if (pattern) {
      let _res = [];

      for (let i = 0, len = res.length; i < len; i++) {
        let recentItem = res[i];
        let searchableProps = ['name', 'description'];
        let match = null;
        if (pattern) {
          for (let z = 0, len = searchableProps.length; z < len; z++) {
            match = fuzzy.match(pattern, recentItem[searchableProps[z]], fuzzyOptions)
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
        app.name = app.get_name();
        app.keywords = app.get_keywords();
        app.description = app.get_description();
        app.id = app.get_id();
        app.type = ApplicationType._applications;

        let searchableProps = ['name', 'keywords', 'description'];
        let match = null;
        for (let z = 0, len = searchableProps.length; z < len; z++ ) {
          match = fuzzy.match(pattern, app[searchableProps[z]], fuzzyOptions)
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
    this.resetSearchWithFocus();
    this._selectCategory(this.favAppCategory);
  },

  _displayApplications: function(appList) {
    //dt.start();
    if (!appList) {
      return false;
    }
    let isListView = this._applicationsViewMode === ApplicationsViewMode.LIST;

    let column = 0;
    let columnsCount = 0;
    let rownum = 0;

    this._activeContainer = isListView ? this.applicationsListBox : this.applicationsGridBox;
    //global.dump_gjs_stack();
    this.menuIsOpen = null;

    let appIndex = 0;

    let createAppButton = (app, appType, len)=>{
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

      if (isListView) { // ListView
        this.applicationsListBox.add_child(appButton.actor);
      } else { // GridView
        let gridLayout = this.applicationsGridBox.layout_manager;
        if (!gridLayout) {
          return false;
        }
        gridLayout.attach(appButton.actor, column, rownum, 1, 1);
        column++;
        if (column > columnsCount) {
          columnsCount = column;
        }
        if (column > this._applet.appsGridColumnCount - 1) {
          column = 0;
          rownum++;
        }
        appButton.setColumn(column);
      }
    };

    if (!this.searchActive) {
      appList = _.orderBy(appList, 'name');
    }
    for (let z = 0, len = appList.length; z < len; z++) {
      let app = appList[z];
      if (!app) {
        continue;
      }

      let appType = app.type;
      if (appType === undefined) {
        appType = ApplicationType._applications;
      }

      for (let y = 0, len = AppTypes.length; y < len; y++) {
        if (ApplicationType[AppTypes[y]] !== appType) {
          continue;
        }

        ++appIndex;

        createAppButton(app, appType, len);
      }
    }
    this.columnsCount = columnsCount;
    //dt.stop();
  },

  _onMenuKeyPress: function(actor, event) {
    // TODO - Need to adapt key handling for Cinnamenu.
    let symbol = event.get_key_symbol();
    //let item_actor;
    let index = 0;

    let keyCode = event.get_key_code();
    let modifierState = Cinnamon.get_event_state(event);

    /* check for a keybinding and quit early, otherwise we get a double hit
       of the keybinding callback */
    let action = global.display.get_keybinding_action(keyCode, modifierState);

    if (action == Meta.KeyBindingAction.CUSTOM) {
        return true;
    }

    index = this._selectedItemIndex;

    //let ctrlKey = modifierState & Clutter.ModifierType.CONTROL_MASK;

    if (this._applet.searchFilesystem && symbol === Clutter.slash) {
      if (symbol === Clutter.Return || symbol === Clutter.KP_Enter) {
        if (this._run(this.searchEntry.get_text())) {
          this.menu.close();
        }
        return true;
      }
      if (symbol === Clutter.Escape) {
        this.searchEntry.set_text('');
      }
      if (symbol === Clutter.slash) {
        // Need preload data before get completion. GFilenameCompleter load content of parent directory.
        // Parent directory for /usr/include/ is /usr/. So need to add fake name('a').
        let text = this.searchEntry.get_text().concat('/a');
        let prefix;
        if (text.lastIndexOf(' ') === -1) {
          prefix = text;
        } else {
          prefix = text.substr(text.lastIndexOf(' ') + 1);
        }
        this._getCompletion(prefix);

        return false;
      }
      if (symbol === Clutter.Tab) {
        let text = actor.get_text();
        let prefix;
        if (text.lastIndexOf(' ') === -1) {
          prefix = text;
        } else {
          prefix = text.substr(text.lastIndexOf(' ') + 1);
        }
        let postfix = this._getCompletion(prefix);
        if (postfix != null && postfix.length > 0) {
          actor.insert_text(postfix, -1);
          actor.set_cursor_position(text.length + postfix.length);
          if (postfix[postfix.length - 1] === '/') {
            this._getCompletion(text + postfix + 'a');
          }
        }
        return true;
      }
      if (symbol === Clutter.ISO_Left_Tab) {
        return true;
      }
      return false;
    } else if (symbol === Clutter.Tab || symbol === Clutter.ISO_Left_Tab) {
      return true;
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
        return this._applet._pathCompleter.get_completion_suffix(text);
      }
    } else {
      return false;
    }
  },

  _getCompletions: function(text) {
    if (text.indexOf('/') !== -1) {
      return this._applet._pathCompleter.get_completions(text);
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
      this._activeContainer = this._applicationsViewMode === ApplicationsViewMode.LIST ? this.applicationsListBox : this.applicationsGridBox;
    }
    let apps = this._activeContainer.get_children();
    for (let i = 0, len = apps.length; i < len; i++) {
      apps[i]._delegate.clearSearchFormatting();
    }
  },

  resetSearchWithFocus: function() {
    global.stage.set_key_focus(this.searchEntry);
    this.resetSearch();
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

    if (this.searchActive) {
      if (searchText.length === 0) {
        this._resetDisplayApplicationsToStartup();
      } else {
        this._clearCategorySelections(this.categoriesBox);
      }
    }

    this.selectedAppTitle.set_text('');
    this.selectedAppDescription.set_text('');
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

    this._selectedItemIndex = -1;
    this._previousSelectedItemIndex = null;
    this._clearTabFocusSelections();

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
    if (this._applet.searchFilesystem) {
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
    this._displayed = true;

    let section = new PopupMenu.PopupMenuSection();
    this._dummySeparator = new PopupMenu.PopupSeparatorMenuItem();
    this._dummySeparator.opacity = 0;
    this._dummyButton = new St.Button({
      style_class: 'button'
    });
    this._dummyButton.opacity = 0;
    this._dummyButton.set_size(0, 0);
    this._dummyButton2 = new St.Button({
      style_class: 'system-menu-action'
    });
    this._dummyButton2.opacity = 0;
    this._dummyButton2.set_size(0, 0);

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
      style_class: 'vfade cinnamenu-categories-workspaces-scrollbox'
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
      style_class: 'menu-search-entry',
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
    this.favorites = this._applet.appFavorites.getFavorites();

    // Load Places
    if (PlaceDisplay && this._applet.showPlaces) {
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

    let widths = [0, 0, 0, 625, 700, 725, 900, 1025];
    this.applicationsGridBox = new St.Widget({
      layout_manager: new Clutter.GridLayout(),
      reactive: true,
      style_class: '',
      width: widths[this._applet.appsGridColumnCount]
    });
    this.applicationsBoxWrapper = new St.BoxLayout({
      style_class: 'menu-applications-inner-box',
      vertical: true
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
      y_align: St.Align.START
    });
    this.answerText = new St.Label({
      style_class: 'menu-selected-app-title',
      style: 'padding-top: 14px; min-width: 240px;',
      text: '',
      show_on_set_parent: false
    });
    this.applicationsBoxWrapper.add(this.answerText, {
      x_fill: false,
      y_fill: false,
      x_align: St.Align.START,
      y_align: St.Align.START
    });
    this.applicationsScrollBox.add_actor(this.applicationsBoxWrapper);
    this.applicationsScrollBox.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC);
    this.applicationsScrollBox.set_auto_scrolling(this._applet.enableAutoScroll);
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

    if (!this._applet.showAppDescriptionsOnButtons) {
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

    // bottomPane packs horizontally
    let bottomPaneSpacer1 = new St.Label({
      text: ''
    });
    this.bottomPane.add(this._dummyButton);
    this.bottomPane.add(this._dummyButton2);
    this.bottomPane.add(this.powerGroupBox, {
      x_fill: false,
      y_fill: false,
      x_align: St.Align.START,
      y_align: St.Align.START
    });
    this.bottomPane.add(bottomPaneSpacer1, {
      expand: false,
      x_align: St.Align.MIDDLE,
      y_align: St.Align.MIDDLE
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
    this.menu.addMenuItem(this._dummySeparator);

    // Set height constraints on scrollboxes (we also set height when menu toggle)
    this.applicationsScrollBox.add_constraint(new Clutter.BindConstraint({
      name: 'appScrollBoxConstraint',
      source: this.groupCategoriesWorkspacesScrollBox,
      coordinate: Clutter.BindCoordinate.HEIGHT,
      offset: 0
    }));

    this._widthCategoriesBox = this.categoriesBox.width;

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

  destroy: function() {
    this._applet = null;
    global.settings.disconnect(this.panelEditId);
    this.destroyAppButtons();
    this._activeContainer.destroy();
    this.destroyDisplayed();
    if (this._searchWebBookmarks) {
      this._searchWebBookmarks.destroy();
    }
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
      this._allItems[i].closeMenu();
      this._allItems[i].destroy();
      this._allItems[i] = null;
    }
    this._allItems = [];
  },
};

Signals.addSignalMethods(CinnamenuPanel.prototype)
