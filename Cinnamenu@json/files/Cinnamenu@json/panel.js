const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const GLib = imports.gi.GLib;
const CMenu = imports.gi.CMenu;
const Clutter = imports.gi.Clutter;
const Cinnamon = imports.gi.Cinnamon;
const St = imports.gi.St;
const Util = imports.misc.util;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;
const Lang = imports.lang;
const GnomeSession = imports.misc.gnomeSession;
const ScreenSaver = imports.misc.screenSaver;
const Signals = imports.signals;
const PopupMenu = imports.ui.popupMenu;

const AppletDir = imports.ui.appletManager.applets['Cinnamenu@json'];

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
const Fuse = AppletDir.fuse.Fuse;

// l10n
const Gettext = imports.gettext;
const UUID = 'Cinnamenu@json';

function _(str) {
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

const ApplicationsViewMode = {
  LIST: 0,
  GRID: 1
};

/* =========================================================================
/* name:    CinnamenuPanel
 * @desc    A top panel button toggles a popup menu
 * @impl    Used for menu button on top panel
 * ========================================================================= */

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

    this.init = true;
    this.appButtons = [];
    this.applicationsByCategory = {};
    this.favorites = [];
    this._applications = [];
    this._places = [];
    this._recent = [];

    this._applicationsViewMode = this._applet.startupViewMode;
    this._appGridColumns = this._applet.appsGridColumnCount;
    this._appGridButtonWidth = this._applet.appsGridLabelWidth;
    this._searchTimeoutId = 0;
    this._searchIconClickedId = 0;
    this._selectedItemIndex = null;
    this._previousSelectedItemIndex = null;
    this._activeContainer = null;
    this.menuIsOpen = null;
    this._isBumblebeeInstalled = GLib.file_test('/usr/bin/optirun', GLib.FileTest.EXISTS);

    this._searchWebBookmarks = new SearchWebBookmarks();
    this._searchWebErrorsShown = false;
    this._session = new GnomeSession.SessionManager();
    this._screenSaverProxy = new ScreenSaver.ScreenSaverProxy();
    this.recentManager = Gtk.RecentManager.get_default();
    this.placesManager = null;
    this._displayed = false;
    this.menuHeight = 530;
  },

  on_panel_edit_mode_changed: function() {
    this.actor.reactive = !global.settings.get_boolean('panel-edit-mode')
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
        // Set focus to search entry
        this.resetSearchWithFocus();

        // Load Startup Applications category
        this._selectedItemIndex = null;
        this._activeContainer = null;
        this._applications = [];
        this._places = [];
        this._recent = [];
        this._applicationsViewMode = this._applet.startupViewMode;
        this._appGridColumns = this._applet.appsGridColumnCount;

        // Set height of viewModeBox to searchBox
        this.viewModeBox.height = this.searchBox.height;

        // Set Category
        this.categoriesBox.show();
        this._widthCategoriesBox = 0;

        // Adjust width of categories box
        // Determine width based on user-power group button widths
        let groupWidth = this.groupCategoriesWorkspacesScrollBox.width;
        this.powerGroupBox.width = groupWidth;
        this.categoriesBox.width = this.groupCategoriesWorkspacesScrollBox.width;
        this._widthCategoriesBox = this.groupCategoriesWorkspacesScrollBox.width;

        // calculate applications list/grid box width // TBD
        //this._calculateApplicationsBoxWidth(this._applicationsViewMode === ApplicationsViewMode.LIST);

        // Hide applications list/grid box depending on view mode
        if (this._applicationsViewMode === ApplicationsViewMode.LIST) {
          this.toggleListGridView.setIcon('view-grid-symbolic');
          this._switchApplicationsView(ApplicationsViewMode.LIST);
        } else {
          this.toggleListGridView.setIcon('view-list-symbolic');
          this._switchApplicationsView(ApplicationsViewMode.GRID);
        }

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
      this.resetSearch();
      this._clearCategorySelections(this.categoriesBox);
      this._clearTabFocusSelections();
      this._clearActiveContainerSelections();
      this._clearApplicationsBox();
      global.stage.set_key_focus(null);
      this.destroyAppButtons();
      this._clearAll();
      this.destroyDisplayed();
      this._displayed = false;
    }
    return true;
  },

  refresh: function() {
    this.destroyAppButtons();
    this._clearAll();
    this.destroyDisplayed();
    this._displayed = false;
    this._display();
  },

  _clearAll: function() {
    this.menu.removeAll();
  },

  _loadCategories: function(dir, root) {
    var rootDir = root;
    var iter = dir.iter();
    var nextType;
    while ((nextType = iter.next()) !== CMenu.TreeItemType.INVALID) {
      if (nextType === CMenu.TreeItemType.ENTRY) {
        var entry = iter.get_entry();
        if (!entry.get_app_info().get_nodisplay()) {
          var app = this._applet.appSystem.lookup_app(entry.get_desktop_file_id());
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
        }
      } else if (nextType === CMenu.TreeItemType.DIRECTORY) {
        if (rootDir) {
          this._loadCategories(iter.get_directory(), rootDir);
        } else {
          this._loadCategories(iter.get_directory(), dir);
        }
      }
    }
  },

  _selectCategory: function(button, refresh) {
    this.resetSearch();

    this._clearApplicationsBox(button, refresh);

    let category = button._dir;
    if (typeof category == 'string') {
      this._displayApplications(this._listApplications(category), refresh);
    } else {
      this._displayApplications(this._listApplications(category.get_menu_id()), refresh);
    }

    // Cache the current category button so we can invoke this function to get around the list/grid toggle
    // not showing the app list.

    this._currentSelectKey = '_selectCategory';
    if (this._currentCategoryButton) {
      this._previousCategoryButton = this._currentCategoryButton;
    }
    this._currentCategoryButton = button;
  },

  _selectFavorites: function(button, refresh) {
    if (!button) {
      button = this._previousCategoryButton;
    }
    if (button._dir === 'favorites') {
      this._selectCategory(this.favAppCategory);
    }

    this.resetSearch();
    if (!refresh) {
      this._clearApplicationsBox(button);
    }
    this.favorites = this._applet.appFavorites.getFavorites();
    for (var i = 0; i < this.favorites.length; i++) {
      this.favorites[i].type = ApplicationType._applications;
    }
    this._displayApplications(this.favorites, button._dir === 'favorites');

    if (!refresh) {
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
    this.resetSearch();
    this._clearApplicationsBox(button);

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
    this.resetSearch();
    this._clearApplicationsBox(button);

    let bookmarks = this._listBookmarks();
    this._displayApplications(bookmarks);
    this._currentSelectKey = '_selectBookmarks';
    if (this._currentCategoryButton) {
      this._previousCategoryButton = this._currentCategoryButton;
    }
    this._currentCategoryButton = button;
  },

  _selectDevices: function(button) {
    this.resetSearch();
    this._clearApplicationsBox(button);

    let devices = this._listDevices();
    this._displayApplications(devices);
    this._currentSelectKey = '_selectDevices';
    if (this._currentCategoryButton) {
      this._previousCategoryButton = this._currentCategoryButton;
    }
    this._currentCategoryButton = button;
  },

  _selectRecent: function(button) {
    this.resetSearch();
    this._clearApplicationsBox(button);

    let recent = this._listRecent();
    this._displayApplications(recent);
    this._currentSelectKey = '_selectRecent';
    if (this._currentCategoryButton) {
      this._previousCategoryButton = this._currentCategoryButton;
    }
    this._currentCategoryButton = button;
  },

  _selectWebBookmarks: function(button) {
    this.resetSearch();
    this._clearApplicationsBox(button);

    let webBookmarks = this._listWebBookmarks();
    this._displayApplications(webBookmarks);
    this._currentSelectKey = '_selectWebBookmarks';
    if (this._currentCategoryButton) {
      this._previousCategoryButton = this._currentCategoryButton;
    }
    this._currentCategoryButton = button;
  },

  _switchApplicationsView: function(mode) {
    this._applicationsViewMode = mode;
    let refresh = true;

    if (mode === ApplicationsViewMode.LIST) {
      this.applicationsListBox.show();
      this.applicationsGridBox.hide();
    } else {
      this.applicationsListBox.hide();
      this.applicationsGridBox.show();
    }

    // switch activeContainer and reset _selectedItemIndex for keyboard navigation
    if (this._activeContainer == this.applicationsListBox || this._activeContainer == this.applicationsGridBox) {

      // reset active container
      this._activeContainer = (mode === 0) ? this.applicationsListBox : this.applicationsGridBox;
      this._selectedItemIndex = -1;

      // reset scroll to top
      let vscroll = this.applicationsScrollBox.get_vscroll_bar();
      var new_scroll_value = this.applicationsScrollBox.get_allocation_box().y1;
      vscroll.get_adjustment().set_value(new_scroll_value);
    }

    this._clearApplicationsBox(null, refresh);
    this._displayApplications(null, refresh);
  },

  _clearCategorySelections: function(container, selectedCategory) {
    let categoryActors = container.get_children();
    if (categoryActors) {
      for (let i = 0, len = categoryActors.length; i < len; i++) {
        let actor = categoryActors[i];
        if (selectedCategory && (actor == selectedCategory.actor)) {
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

  _clearTabFocusSelections: function(selectedBox, resetSearch) {
    this._selectedItemIndex = -1;
    this._clearActiveContainerSelections();

    if (!selectedBox) {
      return;
    }

    if (selectedBox != this.searchBox && resetSearch) {
      this.resetSearch();
    }
  },

  _clearActiveContainerSelections: function(selectedContainerActor) {
    if (!this._activeContainer) {
      return;
    }

    // Return if activeContainer has no children
    if (!this._activeContainer.get_children) {
      return;
    }

    this._activeContainer.get_children().forEach(function(actor) {
      if (selectedContainerActor) {
        if (selectedContainerActor && (actor == selectedContainerActor)) {
          actor.add_style_class_name('selected');
          if (actor._delegate && actor._delegate.select) {
            actor._delegate.select();
          }
        } else {
          actor.remove_style_class_name('selected');
        }
      } else {
        actor.remove_style_class_name('selected');
        if (actor._delegate && actor._delegate.unSelect) {
          actor._delegate.unSelect();
        }
      }
    });
  },

  _clearApplicationSelections: function(selectedApplication) {
    let children = this.applicationsListBox.get_children();
    for (let i = 0, len = children.length; i < len; i++) {
      if (selectedApplication && children[i] === selectedApplication) { // TBD object equality
        children[i].add_style_class_name('selected');
      } else {
        children[i].remove_style_class_name('selected');
      }
    }
    children = this.applicationsGridBox.get_children();

    for (let i = 0, len = children.length; i < len; i++) {
      if (selectedApplication && children[i] === selectedApplication) { // TBD object equality
        children[i].add_style_class_name('selected');
      } else {
        children[i].remove_style_class_name('selected');
      }
    }
  },

  _clearApplicationsBox: function() {
    if (this.applicationsListBox !== undefined) {
      let listActors = this.applicationsListBox.get_children();
      if (listActors) {
        for (let i = 0, len = listActors.length; i < len; i++) {
          this.applicationsListBox.remove_actor(listActors[i]);
        }
      }
    }

    if (this.applicationsGridBox !== undefined) {
      let gridActors = this.applicationsGridBox.get_children();
      if (gridActors) {
        for (let i = 0, len = gridActors.length; i < len; i++) {
          this.applicationsGridBox.remove_actor(gridActors[i]);
        }
      }
    }
  },

  _listPlaces: function(pattern) {
    if (!this.placesManager) {
      return null;
    }
    let places = this.placesManager.getDefaultPlaces();
    let res = [];
    for (let i = 0, len = places.length; i < len; i++) {
      if (!pattern || places[i].name.toLowerCase().indexOf(pattern) !== -1) {
        places[i].type = ApplicationType._places;
        res.push(places[i]);
      }
    }
    return res;
  },

  _listBookmarks: function(pattern) {
    if (!this.placesManager) {
      return null;
    }
    let bookmarks = this.placesManager.getBookmarks();
    let res = [];
    for (let i = 0, len = bookmarks.length; i < len; i++) {
      if (!pattern || bookmarks[i].name.toLowerCase().indexOf(pattern) !== -1) {
        bookmarks[i].type = ApplicationType._places;
        res.push(bookmarks[i]);
      }
    }
    return res;
  },

  _listWebBookmarks: function(pattern) {
    if (!this._searchWebErrorsShown) {
      if (!Firefox.Gda) {
        let notifyTitle = _("Gno-Menu: Search Firefox bookmarks disabled");
        let notifyMessage = _(
          "If you want to search Firefox bookmarks, you must install the required pacakages: libgir1.2-gda-5.0 [Ubuntu] or libgda-sqlite [Fedora]"
        );
        this.selectedAppTitle.set_text(notifyTitle);
        this.selectedAppDescription.set_text(notifyMessage);
      }
      if (!Midori.Gda) {
        let notifyTitle = _("Gno-Menu: Search Midori bookmarks disabled");
        let notifyMessage = _(
          "If you want to search Midori bookmarks, you must install the required pacakages: libgir1.2-gda-5.0 [Ubuntu] or libgda-sqlite [Fedora]"
        );
        this.selectedAppTitle.set_text(notifyTitle);
        this.selectedAppDescription.set_text(notifyMessage);
      }
    }
    this._searchWebErrorsShown = true;

    let res = [];
    let bookmarks = [];

    bookmarks = bookmarks.concat(Chromium.bookmarks);
    bookmarks = bookmarks.concat(GoogleChrome.bookmarks);
    bookmarks = bookmarks.concat(Firefox.bookmarks);
    bookmarks = bookmarks.concat(Midori.bookmarks);
    bookmarks = bookmarks.concat(Opera.bookmarks);

    for (let i = 0, len = bookmarks.length; i < len; i++) {
      res.push({
        app: bookmarks[i].appInfo,
        name: bookmarks[i].name,
        icon: bookmarks[i].appInfo.get_icon(),
        mime: null,
        uri: bookmarks[i].uri,
        type: ApplicationType._places
      });
    }

    // Create a unique list of bookmarks across all browsers.
    let arr = {};

    for (let i=0, len = res.length; i < len; i++ ) {
      arr[res[i].uri] = res[i];
    }

    res = []
    for (let key in arr) {
      res.push(arr[key]);
    }

    if (pattern) {
      let query = new Fuse(res, {
        keys: [{
          name: 'app',
          weight: 0.6
        }, {
          name: 'uri',
          weight: 0.4
        }],
        thresholod: 0.4,
        include: ['score']
      });

      res = query.search(pattern);
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
        res.push(devices[i]);
      }
    }
    return res;
  },

  _listRecent: function(pattern) {
    if (!this._applet.privacy_settings.get_boolean(REMEMBER_RECENT_KEY)) {
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
          type: ApplicationType._recent
        });
      }
    }

    if (pattern) {
      let query = new Fuse(res, {
        keys: [{
          name: 'name',
          weight: 0.6
        }, {
          name: 'uri',
          weight: 0.4
        }],
        thresholod: 0.4,
        include: ['score']
      });

      res = query.search(pattern);
    }
    return res;
  },

  _listApplications: function(category_menu_id, pattern) {
    let appList = [];

    if (category_menu_id === 'all') {
      for (let directory in this.applicationsByCategory) {
        appList = appList.concat(this.applicationsByCategory[directory]);
      }
    } else if (category_menu_id === 'favorites') {
      appList = this.favorites;
    } else {
      if (category_menu_id) {
        appList = this.applicationsByCategory[category_menu_id];
      } else {
        for (let directory in this.applicationsByCategory) {
          appList = appList.concat(this.applicationsByCategory[directory]);
        }
      }
    }

    let res = [];
    let searchApps = [];
    if (pattern) {
      for (let i = 0, len = appList.length; i < len; i++) {
        let app = appList[i];
        app.name = app.get_name();
        app.keywords = app.get_keywords();
        app.description = app.get_description();
        app.id = app.get_id();
        app.type = ApplicationType._applications;

        searchApps.push(app);
      }
      let query = new Fuse(searchApps, {
        keys: [{
          name: 'name',
          weight: 0.4
        }, {
          name: 'keywords',
          weight: 0.3
        }, {
          name: 'description',
          weight: 0.2
        }, {
          name: 'id',
          weight: 0.1
        }],
        thresholod: 0.2,
        include: ['score']
      });
      res = query.search(pattern);
    } else {
      res = appList;
    }

    // Ignore favorites when sorting
    if (category_menu_id !== 'favorites') {
      if (res === undefined) {
        res = [];
      }
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

  _calculateApplicationsBoxWidth: function(isListView) { // TBD
    // Calculate visible menu boxes and adjust width accordingly
    let searchBoxWidth = this.searchBox.width;
    let searchBoxMargin = {
      left: 0,
      top: 0,
      bottom: 0,
      right: 0
    };
    let searchBoxBorder = {
      left: 0,
      top: 0,
      bottom: 0,
      right: 0
    };
    if (this.searchBox.get_stage()) {
      let themeNode = this.searchBox.get_theme_node();
      searchBoxMargin = { // Not supported in Cinnamon
          left: this.searchBox.get_margin_left(St.Side.LEFT),
          top: this.searchBox.get_margin_top(St.Side.TOP),
          bottom: this.searchBox.get_margin_bottom(St.Side.BOTTOM),
          right: this.searchBox.get_margin_right(St.Side.RIGHT),
      };
      searchBoxBorder = {
        left: themeNode.get_border_width(St.Side.LEFT),
        top: themeNode.get_border_width(St.Side.TOP),
        bottom: themeNode.get_border_width(St.Side.BOTTOM),
        right: themeNode.get_border_width(St.Side.RIGHT),
      };
      searchBoxPadding = {
        left: themeNode.get_padding(St.Side.LEFT),
        top: themeNode.get_padding(St.Side.TOP),
        bottom: themeNode.get_padding(St.Side.BOTTOM),
        right: themeNode.get_padding(St.Side.RIGHT),
      };
      searchBoxWidth = this.searchBox.width + searchBoxMargin.left + searchBoxMargin.right + searchBoxBorder.left +
        searchBoxBorder.right;
    }

    let viewModeBoxWrapperWidth = this.viewModeBoxWrapper.width;
    let viewModeBoxWrapperMargin = {
      left: 0,
      top: 0,
      bottom: 0,
      right: 0
    };
    let viewModeBoxWrapperBorder = {
      left: 0,
      top: 0,
      bottom: 0,
      right: 0
    };
    if (this.viewModeBoxWrapper.get_stage()) {
      let themeNode = this.viewModeBoxWrapper.get_theme_node();
      viewModeBoxWrapperMargin = {
          left: this.viewModeBoxWrapper.get_margin_left(St.Side.LEFT),
          top: this.viewModeBoxWrapper.get_margin_top(St.Side.TOP),
          bottom: this.viewModeBoxWrapper.get_margin_bottom(St.Side.BOTTOM),
          right: this.viewModeBoxWrapper.get_margin_right(St.Side.RIGHT),
      };
      viewModeBoxWrapperBorder = {
        left: themeNode.get_border_width(St.Side.LEFT),
        top: themeNode.get_border_width(St.Side.TOP),
        bottom: themeNode.get_border_width(St.Side.BOTTOM),
        right: themeNode.get_border_width(St.Side.RIGHT),
      };
      viewModeBoxWrapperWidth = this.viewModeBoxWrapper.width + viewModeBoxWrapperMargin.left +
        viewModeBoxWrapperMargin.right + viewModeBoxWrapperBorder.left + viewModeBoxWrapperBorder.right;
    }

    let topPaneWidth = viewModeBoxWrapperWidth + searchBoxWidth;
    let minWidth = topPaneWidth - this._widthCategoriesBox;

    let gridBoxBorder = {
      left: 0,
      top: 0,
      bottom: 0,
      right: 0
    };
    let gridBoxPadding = {
      left: 0,
      top: 0,
      bottom: 0,
      right: 0
    };
    let buttonMargin = {
      left: 0,
      top: 0,
      bottom: 0,
      right: 0
    };
    let buttonBorder = {
      left: 0,
      top: 0,
      bottom: 0,
      right: 0
    };
    let buttonPadding = {
      left: 0,
      top: 0,
      bottom: 0,
      right: 0
    };
    if (this.applicationsGridBox.get_stage()) {
      let themeNode = this.applicationsGridBox.get_theme_node();
      gridBoxBorder = {
        left: themeNode.get_border_width(St.Side.LEFT),
        top: themeNode.get_border_width(St.Side.TOP),
        bottom: themeNode.get_border_width(St.Side.BOTTOM),
        right: themeNode.get_border_width(St.Side.RIGHT),
      };
      gridBoxPadding = {
        left: themeNode.get_padding(St.Side.LEFT),
        top: themeNode.get_padding(St.Side.TOP),
        bottom: themeNode.get_padding(St.Side.BOTTOM),
        right: themeNode.get_padding(St.Side.RIGHT),
      };

      let appType = ApplicationType._applications;
      let allAppCategoryButton = this.categoriesBox.get_child_at_index(1)._delegate;
      let allAppcategory = allAppCategoryButton._dir;
      let apps = this._listApplications(allAppcategory);
      if (apps && apps.length > 0) {
        let app = apps[0];
        let appGridButton = new AppListGridButton(this, app, appType, true, 0);
        let gridLayout = this.applicationsGridBox.layout_manager;
        gridLayout.pack(appGridButton.actor, 0, 0);
        if (appGridButton.actor.get_stage()) {
          let themeNode = appGridButton.actor.get_theme_node();
          buttonMargin = {
              left: appGridButton.actor.get_margin_left(),
              top: appGridButton.actor.get_margin_top(),
              bottom: appGridButton.actor.get_margin_bottom(),
              right: appGridButton.actor.get_margin_right(),
          };
          buttonBorder = {
            left: themeNode.get_border_width(St.Side.LEFT),
            top: themeNode.get_border_width(St.Side.TOP),
            bottom: themeNode.get_border_width(St.Side.BOTTOM),
            right: themeNode.get_border_width(St.Side.RIGHT),
          };
          buttonPadding = {
            left: themeNode.get_padding(St.Side.LEFT),
            top: themeNode.get_padding(St.Side.TOP),
            bottom: themeNode.get_padding(St.Side.BOTTOM),
            right: themeNode.get_padding(St.Side.RIGHT),
          };

          // calculate optimal App Grid button width
          this._appGridButtonWidth = this._applet.appsGridLabelWidth;
          let tempSize = this._applet.appsGridIconSize;
          if (this._appGridButtonWidth < tempSize) {
            this._appGridButtonWidth = tempSize;
          }
          tempSize = themeNode.get_min_width();
          if (this._appGridButtonWidth < tempSize) {
            this._appGridButtonWidth = tempSize;
          }
        }
      }
    }

    let scrollBoxBorder = {
      left: 0,
      top: 0,
      bottom: 0,
      right: 0
    };
    let scrollBoxPadding = {
      left: 0,
      top: 0,
      bottom: 0,
      right: 0
    };
    if (this.applicationsScrollBox.get_stage()) {
      let themeNode = this.applicationsScrollBox.get_theme_node();
      scrollBoxBorder = {
        left: themeNode.get_border_width(St.Side.LEFT),
        top: themeNode.get_border_width(St.Side.TOP),
        bottom: themeNode.get_border_width(St.Side.BOTTOM),
        right: themeNode.get_border_width(St.Side.RIGHT),
      };
      scrollBoxPadding = {
        left: themeNode.get_padding(St.Side.LEFT),
        top: themeNode.get_padding(St.Side.TOP),
        bottom: themeNode.get_padding(St.Side.BOTTOM),
        right: themeNode.get_padding(St.Side.RIGHT),
      };
    }

    let iconSize = this._appGridButtonWidth + buttonMargin.left + buttonMargin.right + buttonBorder.left +
      buttonBorder.right + buttonPadding.left + buttonPadding.right;
    let gridWidth = (iconSize * this._appGridColumns) + gridBoxBorder.left + gridBoxBorder.right + gridBoxPadding.left +
      gridBoxPadding.right;

    let scrollWidth;
    if (isListView) {
      scrollWidth = (gridWidth / 1.8) + scrollBoxBorder.left + scrollBoxBorder.right + scrollBoxPadding.left +
      scrollBoxPadding.right;
    } else {
      scrollWidth = gridWidth + scrollBoxBorder.left + scrollBoxBorder.right + scrollBoxPadding.left +
      scrollBoxPadding.right + 40;
    }

    if (scrollWidth >= minWidth) {
      this.applicationsScrollBox.width = scrollWidth;
    } else {
      this.applicationsScrollBox.width = minWidth;
      let extraWidth = minWidth - scrollWidth;
      let gridLayout = this.applicationsGridBox.layout_manager;
      gridLayout.set_column_spacing(extraWidth / (this._appGridColumns - 1));
    }
    this.topPane.style = 'padding-bottom: ' + this.theme.padding + 'px;';
    this.bottomPane.style = 'padding-top: ' + this.theme.padding + 'px;';
  },

  _resetDisplayApplicationsToStartup: function() { // TBD
    this._selectCategory(this.favAppCategory);
  },

  sortAppsByName: function(a, b) {
    let aName = a.name.toLowerCase();
    let bName = b.name.toLowerCase();
    if (aName < bName) {
      return -1;
    }
    if (aName > bName) {
      return 1;
    }
    return 0;
  },

  sortAppsByScore: function(a, b) {
    if (a.score < b.score) {
      return -1;
    }
    if (a.score > b.score) {
      return 1;
    }
    return 0;
  },

  _displayApplications: function(appList, refresh, isSearch) {
    let viewMode = this._applicationsViewMode;

    // variables for icon grid layout
    //let page = 0;
    let column = 0;
    let rownum = 0;

    for (let i = 0, len = this.appButtons.length; i < len; i++) {
      this.appButtons[i].closeMenu();
      this.appButtons[i].destroy();
      this.appButtons[i] = null;
    }

    this.appButtons = [];
    this.menuIsOpen = null;

    if (!appList) {
      return
    }

    let appIndex = 0;

    let createAppButton = (app, appType, len)=>{
      let isListView = viewMode === ApplicationsViewMode.LIST;
      let appButton = new AppListGridButton(this, app, appType, !isListView, appIndex, len);
      this.appButtons.push(appButton);
      if (isListView) { // ListView
        this.applicationsListBox.add_actor(appButton.actor);
        appButton.icon.realize();
      } else { // GridView
        let gridLayout = this.applicationsGridBox.layout_manager;
        if (!gridLayout) {
          return false;
        }
        gridLayout.pack(appButton.actor, column, rownum);
        appButton.icon.realize();
        column++;
        if (column > this._appGridColumns - 1) {
          column = 0;
          rownum++;
        }
        appButton.setColumn(column);
      }
    };

    if (!isSearch) {
      appList = appList.sort(this.sortAppsByName);
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

      for (let appTypeKey in ApplicationType) {
        if (ApplicationType[appTypeKey] !== appType) {
          continue;
        }
        if (refresh) {
          appList = this[appTypeKey];
        } else {
          this[appTypeKey] = [];
        }

        ++appIndex;

        if (refresh || !this._applications[app]) {
          createAppButton(app, appType, len);
        }
        if (!refresh) {
          this[appTypeKey][app] = app;
        }
      }
    }
  },

  _scrollToActiveContainerButton: function(buttonActor) {
    let sBox;
    if (this._activeContainer == this.applicationsListBox || this._activeContainer == this.applicationsGridBox) {
      sBox = this.applicationsScrollBox;
    } else {
      return;
    }

    let vscroll = sBox.get_vscroll_bar();
    let buttonBox = buttonActor.get_allocation_box();

    var current_scroll_value = vscroll.get_adjustment().get_value();
    var box_height = sBox.get_allocation_box().y2 - sBox.get_allocation_box().y1;
    var new_scroll_value = current_scroll_value;

    if (current_scroll_value > buttonBox.y1 - 20) {
      new_scroll_value = buttonBox.y1 - 20;
    }
    if (box_height + current_scroll_value < buttonBox.y2 + 20) {
      new_scroll_value = buttonBox.y2 - box_height + 20;
    }
    if (new_scroll_value != current_scroll_value) {
      vscroll.get_adjustment().set_value(new_scroll_value);
    }
  },

  _onMenuKeyPress: function(actor, event) {
    let symbol = event.get_key_symbol();
    let code = event.get_key_code();
    let modifiers = event.get_state();
    let shift = modifiers & Clutter.ModifierType.SHIFT_MASK;
    let viewMode = this._applicationsViewMode;

    let reverse;
    if (code == 23 && shift) {
      reverse = true;
    }

    // Tab navigation
    if (code == 23) {
      if (this._activeContainer) {
        this._clearActiveContainerSelections();
      }
      switch (this._activeContainer) {
        case this.viewModeBox:
          if (reverse) {
            this._activeContainer = this.viewModeBox;
          } else {
            this._activeContainer = this.categoriesBox;
          }
          break;
        case this.categoriesBox:
          if (reverse) {
            this._activeContainer = this.viewModeBox;
          } else {
            this._activeContainer = (viewMode == ApplicationsViewMode.LIST) ? this.applicationsListBox : this.applicationsGridBox;
          }
          break;
        case this.applicationsListBox:
          if (reverse) {
            this._activeContainer = this.categoriesBox;
          } else {
            this._activeContainer = this.powerGroupBox;
          }
          break;
        case this.applicationsGridBox:
          if (reverse) {
            this._activeContainer = this.categoriesBox;
          } else {
            this._activeContainer = this.powerGroupBox;
          }
          break;
        case this.powerGroupBox:
          if (reverse) {
            this._activeContainer = (viewMode == ApplicationsViewMode.LIST) ? this.applicationsListBox : this.applicationsGridBox;
          } else {
            this._activeContainer = this.categoriesBox;
          }
          break;
        default:
          if (reverse) {
            this._activeContainer = this.powerGroupBox;
          } else {
            this._activeContainer = this.categoriesBox;
          }
      }
      this._clearTabFocusSelections(this._activeContainer, true);
      this.selectActiveContainerItem(symbol, code);
      return true;
    }

    // Set initial active container (default is this.applicationsListBox or this.applicationsGridBox)
    if (this._activeContainer === null && (symbol == Clutter.KEY_Up || symbol == Clutter.KEY_Down)) {
      this._activeContainer = (viewMode == ApplicationsViewMode.LIST) ? this.applicationsListBox : this.applicationsGridBox;
    } else if (this._activeContainer === null && (symbol == Clutter.KEY_Left || symbol == Clutter.KEY_Right)) {
      this._activeContainer = (viewMode == ApplicationsViewMode.LIST) ? this.applicationsListBox : this.applicationsGridBox;
    } else if (this._activeContainer === null) {
      return false;
    }

    if (this.selectActiveContainerItem(symbol, code)) {
      return true;
    } else {
      this._clearActiveContainerSelections();
      return false;
    }
  },

  selectActiveContainerItem: function(symbol, code, isFromSearch) {
    // Todo: this is old code grom Gnomenu, and needs to be cleaned up.
    // Any items in container?
    let children = [];
    let columns, row;
    if (this._activeContainer.get_children) {
      children = this._activeContainer.get_children();
    }
    if (children.length === 0) {
      this._selectedItemIndex = -1;
    }

    // Get selected item index
    let index = this._selectedItemIndex;
    this._previousSelectedItemIndex = this._selectedItemIndex;

    // Navigate the active container
    if (symbol && symbol == Clutter.KEY_Up) {
      if (!this._selectedItemIndex || this._selectedItemIndex < 0) {
        index = 0;
      } else if (this._selectedItemInde && this._selectedItemIndex > -1) {
        if (this._activeContainer == this.applicationsGridBox) {
          columns = this._appGridColumns;
          index = (this._selectedItemIndex - columns < 0) ? this._selectedItemIndex : this._selectedItemIndex -
            columns;
        } else {
          index = (this._selectedItemIndex - 1 < 0) ? this._selectedItemIndex : this._selectedItemIndex - 1;
        }
      }
    } else if (symbol && symbol == Clutter.KEY_Down) {
      if (!this._selectedItemIndex || this._selectedItemIndex < 0) {
        index = 0;
      } else {
        if (this._activeContainer == this.applicationsGridBox) {
          columns = this._appGridColumns;
          index = (this._selectedItemIndex + columns >= children.length) ? this._selectedItemIndex : this._selectedItemIndex +
            columns;
        } else {
          index = (this._selectedItemIndex + 1 == children.length) ? children.length : this._selectedItemIndex + 1;
        }
      }
    } else if (symbol && symbol == Clutter.KEY_Left) {
      if (!this._selectedItemIndex || this._selectedItemIndex < 0) {
        index = 0;
      } else if (this._selectedItemIndex && this._selectedItemIndex > 0) {
        if (this._activeContainer == this.applicationsGridBox) {
          columns = this._appGridColumns;
          row = Math.floor(this._selectedItemIndex / columns);
          var firstCol = (row * columns);
          index = (this._selectedItemIndex - 1 < firstCol) ? firstCol : this._selectedItemIndex - 1;
        } else {
          index = (this._selectedItemIndex - 1 < 0) ? this._selectedItemIndex : this._selectedItemIndex - 1;
        }
      }
    } else if (symbol && symbol == Clutter.KEY_Right) {
      if (!this._selectedItemIndex || this._selectedItemIndex < 0) {
        index = 0;
      } else {
        if (this._activeContainer == this.applicationsGridBox) {
          columns = this._appGridColumns;
          row = Math.floor(this._selectedItemIndex / columns);
          var lastCol = (row * columns) + columns;
          lastCol = (lastCol > children.length) ? children.length : lastCol;
          index = (this._selectedItemIndex + 1 >= lastCol) ? index : this._selectedItemIndex + 1;
        } else {
          index = (this._selectedItemIndex + 1 == children.length) ? children.length : this._selectedItemIndex + 1;
        }
      }
    } else if (symbol && symbol == Clutter.KEY_Return || symbol == Clutter.KP_Enter) {
      if (this._activeContainer == this.applicationsListBox || this._activeContainer == this.applicationsGridBox) {
        // Launch application or Nautilus place or Recent document
        let item_actor = children[this._selectedItemIndex];
        if (item_actor._delegate._type == ApplicationType._applications) {
          this.menu.close();
          item_actor._delegate._app.open_new_window(-1);
        } else if (item_actor._delegate._type == ApplicationType._places) {
          this.menu.close();
          if (item_actor._delegate._app.uri) {
            item_actor._delegate._app.app.launch_uris([item_actor._delegate._app.uri], null);
          } else {
            item_actor._delegate._app.launch();
          }
        } else if (item_actor._delegate._type == ApplicationType._recent) {
          this.menu.close();
          Gio.app_info_launch_default_for_uri(item_actor._delegate._app.uri, global.create_app_launch_context(0, -1));
        }
        return true;
      } else if (this._activeContainer == this.viewModeBox || this._activeContainer ==
        this.powerGroupBox || this._activeContainer == this.categoriesBox) {
        // Simulate button click
        if (index >= children.length) {
          return false;
        } else {
          let item_actor = children[this._selectedItemIndex];
          item_actor._delegate.click();
        }
        return true;
      } else {
        return false;
      }
    } else {
      if ((code && code == 23) || isFromSearch) {
        // Continue
        index = 0;
      } else {
        return false;
      }
    }


    // Check if position reached its end
    if (index >= children.length) {
      if (this._activeContainer == this.powerGroupBox) {
        // allow index to be 1 greater to accommodate pref button
        index = children.length;
      } else {
        index = children.length - 1;
      }
    }

    // All good .. now get item actor in container
    this._selectedItemIndex = index;
    let itemActor = children[this._selectedItemIndex];

    // Check if item actor is valid
    if (!itemActor || itemActor === this.searchEntry) {
      if (this._activeContainer !== this.powerGroupBox) {
        return false;
      }
    }

    // Clear out container and select item actor
    this._clearActiveContainerSelections(itemActor);

    // Set selected app name/description
    if (this._activeContainer == this.applicationsListBox || this._activeContainer ==
      this.applicationsGridBox) {
      if (itemActor._delegate._type == ApplicationType._applications) {
        this.selectedAppTitle.set_text(itemActor._delegate._app.get_name());
        if (itemActor._delegate._app.get_description()) {
          this.selectedAppDescription.set_text(itemActor._delegate._app.get_description());
        } else {
          this.selectedAppDescription.set_text('');
        }
      } else if (itemActor._delegate._type == ApplicationType._places) {
        this.selectedAppTitle.set_text(itemActor._delegate._app.name);
        if (itemActor._delegate._app.description) {
          this.selectedAppDescription.set_text(itemActor._delegate._app.description);
        } else {
          this.selectedAppDescription.set_text('');
        }
      } else if (itemActor._delegate._type == ApplicationType._recent) {
        this.selectedAppTitle.set_text(itemActor._delegate._app.name);
        if (itemActor._delegate._app.description) {
          this.selectedAppDescription.set_text(itemActor._delegate._app.description);
        } else {
          this.selectedAppDescription.set_text('');
        }
      }

      // Scroll to item actor if hidden from view
      this._scrollToActiveContainerButton(itemActor);
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
    this.searchActive = false;
    if (this._activeContainer) {
      this._activeContainer.show();
    }
  },

  resetSearchWithFocus: function() {
    global.stage.set_key_focus(this.searchEntry);
    this.searchEntry.set_text('');
    this.searchActive = false;
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
    this._clearActiveContainerSelections();
    this.selectedAppTitle.set_text('');
    this.selectedAppDescription.set_text('');
    this.searchActive = searchText.length > 0;

    if (this.searchActive) {
      this.searchEntry.set_secondary_icon(this._searchActiveIcon);

      if (this._searchIconClickedId === 0) {
        this._searchIconClickedId = this.searchEntry.connect('secondary-icon-clicked', Lang.bind(this, function() {
          this.resetSearchWithFocus();
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
    let pattern = this.searchEntryText.get_text().replace(/^\s+/g, '').replace(/\s+$/g, '').toLowerCase();
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

    this._activeContainer = null;
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

    //let bookmarks = this._listBookmarks(pattern);
    //for (var i in bookmarks) placesResults.push(bookmarks[i]);

    let webBookmarks = this._listWebBookmarks(pattern);

    for (let i = 0, len = webBookmarks.length; i < len; i++) {
      placesResults.push(webBookmarks[i]);
    }

    //let devices = this._listDevices(pattern);
    //for (var i in devices) placesResults.push(devices[i]);

    let recentResults = this._listRecent(pattern);

    let results = appResults.concat(placesResults).concat(recentResults);

    results = results.sort(this.sortAppsByScore);

    results = results.map((result)=>{
      if (result.hasOwnProperty('item')) {
        return result.item
      } else {
        return result
      }
    });

    this._clearApplicationsBox();
    this._displayApplications(results, null, true);

    this._activeContainer = this._applicationsViewMode === ApplicationsViewMode.LIST ? this.applicationsListBox : this.applicationsGridBox;
    this.selectActiveContainerItem(null, null, true);

    return false;
  },

  _display: function() {
    this._displayed = true;
    let recentEnabled = this._applet.privacy_settings.get_boolean(REMEMBER_RECENT_KEY);

    // popupMenuSection holds the mainbox
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


    // mainbox holds the topPane and bottomPane
    this.mainBox = new St.BoxLayout({
      style_class: 'menu-applications-inner-box',
      vertical: true,
      show_on_set_parent: false
    }); // menu

    // Top pane holds user group, view mode, and search (packed horizonally)
    this.topPane = new St.BoxLayout({
      style_class: ''
    });

    // Middle pane holds categories/places/power, applications, workspaces (packed horizontally)
    this.middlePane = new St.BoxLayout({
      style_class: ''
    });

    // Bottom pane holds power group and selected app description (packed horizontally)
    this.bottomPane = new St.BoxLayout({
      style_class: ''
    });

    // groupCategoriesWorkspacesWrapper bin wraps categories and workspaces
    this.groupCategoriesWorkspacesWrapper = new St.BoxLayout({
      style_class: 'cinnamenu-categories-workspaces-wrapper',
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

    // ViewModeBox
    let viewModeButtonIcon = 'view-grid-symbolic';
    if (this._applicationsViewMode == ApplicationsViewMode.LIST) {
      viewModeButtonIcon = 'view-list-symbolic';
    }

    let viewModeButtonIconSize = 16;

    let viewModeAdditionalStyle = '';

    this.viewModeBoxWrapper = new St.BoxLayout({
      style_class: 'cinnamenu-view-mode-box-wrapper' + viewModeAdditionalStyle
    });
    this.viewModeBox = new St.BoxLayout({
      style_class: 'cinnamenu-view-mode-box' + viewModeAdditionalStyle
    });

    this.toggleListGridView = new GroupButton(this, viewModeButtonIcon, viewModeButtonIconSize, null, null);
    this.toggleListGridView.setButtonEnterCallback(()=>{
      this.toggleListGridView.actor.add_style_pseudo_class('hover');
      if (this._applicationsViewMode === ApplicationsViewMode.LIST) {
        this.selectedAppTitle.set_text(_("Grid View"));
        this.selectedAppDescription.set_text('Switch to grid view');
      } else {
        this.selectedAppTitle.set_text(_("List View"));
        this.selectedAppDescription.set_text('Switch to list view');
      }
    });
    this.toggleListGridView.setButtonLeaveCallback(()=>{
      this.toggleListGridView.actor.remove_style_pseudo_class('hover');
      this.selectedAppTitle.set_text('');
      this.selectedAppDescription.set_text('');
    });
    this.toggleListGridView.setButtonPressCallback(()=>{
      this.toggleListGridView.actor.add_style_pseudo_class('pressed');
    });
    this.toggleListGridView.setButtonReleaseCallback(()=>{
      this.toggleListGridView.actor.remove_style_pseudo_class('pressed');
      this.selectedAppTitle.set_text('');
      this.selectedAppDescription.set_text('');
      if (this._applicationsViewMode == ApplicationsViewMode.LIST) {
        this.toggleListGridView.setIcon('view-list-symbolic');
        this._switchApplicationsView(ApplicationsViewMode.GRID);
        this._applet.settings.setValue('startup-view-mode', 1);
      } else {
        this.toggleListGridView.setIcon('view-grid-symbolic');
        this._switchApplicationsView(ApplicationsViewMode.LIST);
        this._applet.settings.setValue('startup-view-mode', 0);
      }
      // Retrigger an app list render until we figure out why its not rendering anything on toggle. // TBD - causes extra width on lists
      //this._calculateApplicationsBoxWidth(this._applicationsViewMode === ApplicationsViewMode.LIST);
      this[this._currentSelectKey](this._currentCategoryButton);
    });

    this.viewModeBox.add(this.toggleListGridView.actor, {
      x_fill: false,
      y_fill: false,
      x_align: St.Align.MIDDLE,
      y_align: St.Align.MIDDLE
    });
    this.viewModeBoxWrapper.add(this.viewModeBox, {
      x_fill: false,
      y_fill: false,
      x_align: St.Align.MIDDLE,
      y_align: St.Align.MIDDLE
    });

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
      hint_text: _("Type to search..."),
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
    if (PlaceDisplay) {
      this.placesManager = new PlaceDisplay.PlacesManager(false);
    } else {
      this.placesManager = null;
    }

    // CategoriesBox
    this.categoriesBox = new St.BoxLayout({
      style_class: 'menu-categories-box',
      vertical: true
    });

    // Initialize application categories
    this.applicationsByCategory = {};

    // Load 'all applications' category
    let allAppCategory = new CategoryListButton(this, 'all', _("All Applications"), 'computer');
    this.allAppCategory = allAppCategory;
    this.categoriesBox.add_actor(allAppCategory.actor);

    // Load rest of categories

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

    let trees = [this._applet.appSystem.get_tree()];
    for (let i = 0, len = trees.length; i < len; i++) {
      let tree = trees[i];
      let root = tree.get_root_directory();
      let dirs = [];
      let iter = root.iter();
      let nextType;

      while ((nextType = iter.next()) !== CMenu.TreeItemType.INVALID) {
        if (nextType == CMenu.TreeItemType.DIRECTORY) {
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
        this._loadCategories(dir);
        if (this.applicationsByCategory[dir.get_menu_id()].length > 0) {
          let appCategory = new CategoryListButton(this, dir);
          this.categoriesBox.add_actor(appCategory.actor);
        }
      }
    }

    // Load 'places' category
    this.placesCategory = new CategoryListButton(this, 'places', _("Places"), 'folder', '_selectAllPlaces');
    this.categoriesBox.add_actor(this.placesCategory.actor);

    // Load 'recent' category
    if (recentEnabled) {
      this.recentCategory = new CategoryListButton(this, 'recent', _("Recent"), 'folder-recent', '_selectRecent');
      this.categoriesBox.add_actor(this.recentCategory.actor);
    }

    // Load 'bookmarks' category
    if (this._applet.enableBookmarks) {
      this.webBookmarksCategory = new CategoryListButton(this, 'bookmarks', _("Bookmarks"), 'emblem-favorite', '_selectWebBookmarks');
      this.categoriesBox.add_actor(this.webBookmarksCategory.actor);
    }

    // Load 'favorite applications' category
    let favAppCategory = new CategoryListButton(this, 'favorites', _("Favorite Apps"), 'address-book-new');
    this.favAppCategory = favAppCategory;
    this.categoriesBox.add_actor(favAppCategory.actor);

    // PowerGroupBox
    this.powerGroupBox = new St.BoxLayout({
      style_class: ''
    });

    let lockScreen = new GroupButton(this, 'system-lock-screen', 16, null, null);
    lockScreen.setButtonEnterCallback(Lang.bind(this, function() {
      lockScreen.actor.add_style_class_name('selected');
      this.selectedAppTitle.set_text(_("Lock Screen"));
      this.selectedAppDescription.set_text(_("Lock the screen"));
    }));
    lockScreen.setButtonLeaveCallback(Lang.bind(this, function() {
      lockScreen.actor.remove_style_class_name('selected');
      this.selectedAppTitle.set_text('');
      this.selectedAppDescription.set_text('');
    }));
    lockScreen.setButtonPressCallback(Lang.bind(this, function() {
      lockScreen.actor.add_style_pseudo_class('pressed');
    }));
    lockScreen.setButtonReleaseCallback(Lang.bind(this, function() {
      this.menu.close();

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
    }));
    let logoutUser = new GroupButton(this, 'application-exit', 16, null, null);
    logoutUser.setButtonEnterCallback(Lang.bind(this, function() {
      logoutUser.actor.add_style_class_name('selected');
      this.selectedAppTitle.set_text(_("Logout"));
      this.selectedAppDescription.set_text('Leave the session');
    }));
    logoutUser.setButtonLeaveCallback(Lang.bind(this, function() {
      logoutUser.actor.remove_style_class_name('selected');
      this.selectedAppTitle.set_text('');
      this.selectedAppDescription.set_text('');
    }));
    logoutUser.setButtonPressCallback(Lang.bind(this, function() {
      logoutUser.actor.add_style_pseudo_class('pressed');
    }));
    logoutUser.setButtonReleaseCallback(Lang.bind(this, function() {
      // code to logout user
      logoutUser.actor.remove_style_pseudo_class('pressed');
      logoutUser.actor.remove_style_class_name('selected');
      this.selectedAppTitle.set_text('');
      this.selectedAppDescription.set_text('');
      this.menu.close();
      this._session.LogoutRemote(0);
    }));
    let systemShutdown = new GroupButton(this, 'system-shutdown', 16, null, null);
    systemShutdown.setButtonEnterCallback(Lang.bind(this, function() {
      systemShutdown.actor.add_style_class_name('selected');
      this.selectedAppTitle.set_text(_("Quit"));
      this.selectedAppDescription.set_text('Shutdown the computer');
    }));
    systemShutdown.setButtonLeaveCallback(Lang.bind(this, function() {
      systemShutdown.actor.remove_style_class_name('selected');
      this.selectedAppTitle.set_text('');
      this.selectedAppDescription.set_text('');
    }));
    systemShutdown.setButtonPressCallback(Lang.bind(this, function() {
      systemShutdown.actor.add_style_pseudo_class('pressed');
    }));
    systemShutdown.setButtonReleaseCallback(Lang.bind(this, function() {
      // code to shutdown (power off)
      // ToDo: GS38 itterates through SystemLoginSession to check for open sessions
      // and displays an openSessionWarnDialog
      systemShutdown.actor.remove_style_pseudo_class('pressed');
      systemShutdown.actor.remove_style_class_name('selected');
      this.selectedAppTitle.set_text('');
      this.selectedAppDescription.set_text('');
      this.menu.close();
      this._session.ShutdownRemote();
    }));

    this.powerGroupBox.add(lockScreen.actor, {
      x_fill: false,
      y_fill: false,
      x_align: St.Align.MIDDLE,
      y_align: St.Align.MIDDLE
    });
    this.powerGroupBox.add(logoutUser.actor, {
      x_fill: false,
      y_fill: false,
      x_align: St.Align.MIDDLE,
      y_align: St.Align.MIDDLE
    });
    this.powerGroupBox.add(systemShutdown.actor, {
      x_fill: false,
      y_fill: false,
      x_align: St.Align.MIDDLE,
      y_align: St.Align.MIDDLE
    });
    // ApplicationsBox (ListView / GridView)
    this.applicationsScrollBox = new St.ScrollView({
      x_fill: true,
      y_fill: false,
      y_align: St.Align.START,
      height: this.menuHeight,
      style_class: 'vfade menu-applications-scrollbox'
    });
    let vscrollApplications = this.applicationsScrollBox.get_vscroll_bar();
    vscrollApplications.connect('scroll-start', Lang.bind(this, function() {
      this.menu.passEvents = true;
    }));
    vscrollApplications.connect('scroll-stop', Lang.bind(this, function() {
      this.menu.passEvents = false;
    }));

    this.applicationsListBox = new St.BoxLayout({
      style_class: '',
      vertical: true,
      x_expand: true
    });

    let widths = [0, 0, 0, 625, 700, 725, 900, 1025];
    this.applicationsGridBox = new St.Widget({
      layout_manager: new Clutter.TableLayout(),
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

    // Place boxes in proper containers. The order added determines position
    // ----------------------------------------------------------------------

    // topPane packs horizontally
    this.topPane.add(this.searchBox, {
      expand: false,
      x_align: St.Align.END,
      y_align: St.Align.MIDDLE
    });
    let topPaneSpacer1 = new St.Label({
      text: '    '
    });
    this.topPane.add(topPaneSpacer1, {
      width: 50,
      x_align: St.Align.START,
      y_align: St.Align.MIDDLE
    });
    this.topPane.add(this.viewModeBoxWrapper, {
      x_align: St.Align.START,
      y_align: St.Align.MIDDLE
    });

    this.groupCategoriesWorkspacesWrapper.add(this.categoriesBox, {
      x_fill: false,
      y_fill: false,
      x_align: St.Align.START,
      y_align: St.Align.START,
      y_expand: false,
      expand: false
    });
    this.groupCategoriesWorkspacesScrollBox.add_actor(this.groupCategoriesWorkspacesWrapper);

    // middlePane packs horizontally
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
    this.bottomPane.add(this.selectedAppBox, {
      expand: true,
      x_align: St.Align.END,
      y_align: St.Align.MIDDLE
    });

    // mainbox packs vertically
    this.mainBox.add_actor(this.topPane);
    this.mainBox.add_actor(this.middlePane);
    this.mainBox.add_actor(this.bottomPane);

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
    this.destroyDisplayed();
    this._searchWebBookmarks.destroy();
  },

  destroyDisplayed: function() {
    let containers = [
      'searchBox',
      'viewModeBox',
      'categoriesBox',
      'powerGroupBox',
      'applicationsGridBox',
      'applicationsListBox',
      'applicationsBoxWrapper',
      'applicationsScrollBox',
      'topPane',
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
    for (let i = 0, len = this.appButtons.length; i < len; i++) {
      this.appButtons[i].closeMenu();
      this.appButtons[i].destroy();
      this.appButtons[i] = null;
    }

    this.appButtons = [];
  },
};

Signals.addSignalMethods(CinnamenuPanel.prototype)