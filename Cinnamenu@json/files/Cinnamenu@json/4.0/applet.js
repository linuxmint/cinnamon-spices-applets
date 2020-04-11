const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const GLib = imports.gi.GLib;
const CMenu = imports.gi.CMenu;
const Clutter = imports.gi.Clutter;
const Cinnamon = imports.gi.Cinnamon;
const St = imports.gi.St;
const Meta = imports.gi.Meta;
const Main = imports.ui.main;
const {getDocManager} = imports.misc.docInfo;
const Mainloop = imports.mainloop;
const {SessionManager} = imports.misc.gnomeSession;
const {ScreenSaverProxy} = imports.misc.screenSaver;
const {PopupMenuManager, PopupMenuSection} = imports.ui.popupMenu;
const {getAppFavorites} = imports.ui.appFavorites;
const {TextIconApplet, AllowedLayout, AppletPopupMenu} = imports.ui.applet;
const {AppletSettings} = imports.ui.settings;
const {addTween} = imports.ui.tweener;
const {Tooltip} = imports.ui.tooltips;
const {SignalManager} = imports.misc.signalManager;
const {launch_all} = imports.ui.searchProviderManager;
const {makeDraggable} = imports.ui.dnd;
const {spawnCommandLine, latinise, each, find, findIndex, map} = imports.misc.util;
const {createStore} = imports.misc.state;
const {tryFn, sortBy, sortDirs, setSchema} = require('./utils');
const fuzzy = require('./fuzzy');
const {
  _,
  REMEMBER_RECENT_KEY,
  ApplicationType,
  AppTypes,
  ApplicationsViewMode,
  fuzzyOptions,
  gridWidths,
  searchThresholds,
  markdownProps
} = require('./constants');
const {
  CategoryListButton,
  AppListGridButton,
  GroupButton
} = require('./buttons');

const {readChromiumBookmarks, readFirefoxProfiles, Gda} = require('./browserBookmarks');
const PlaceDisplay = require('./placeDisplay');

const hintText = _('Type to search...');

class bookmarksManager {
  constructor(appSystem) {
    let bookmarks = [];
    this.arrKeys = [];
    this.state = {};
    Promise.all([
      readChromiumBookmarks(bookmarks, ['chromium', 'Default', 'Bookmarks'], 'chromium-browser', appSystem),
      readChromiumBookmarks(bookmarks, ['google-chrome', 'Default', 'Bookmarks'], 'google-chrome', appSystem),
      readChromiumBookmarks(bookmarks, ['.config', 'opera', 'Bookmarks'], 'opera', appSystem)
    ]).then(() => {
      bookmarks = bookmarks.concat(readFirefoxProfiles(appSystem));

        for (let i = 0, len = bookmarks.length; i < len; i++) {
          bookmarks[i].icon = bookmarks[i].app.get_icon();
          bookmarks[i].mime = null;
          bookmarks[i].description = bookmarks[i].uri;
          bookmarks[i].type = ApplicationType._places;
        }

        // Create a unique list of bookmarks across all browsers.
        for (let i = 0, len = bookmarks.length; i < len; i++ ) {
          this.state[bookmarks[i].uri] = bookmarks[i];
        }
        this.arrKeys = Object.keys(this.state);
    }).catch((e) => global.log(e.message, e.stack));
  }
};

class CinnamenuApplet extends TextIconApplet {
  constructor(metadata, orientation, panel_height, instance_id) {
    super(orientation, panel_height, instance_id);

    this.setAllowedLayout(AllowedLayout.BOTH);
    if (orientation === St.Side.BOTTOM || orientation === St.Side.TOP) {
      this.init = false;
      this.set_applet_label(_('Initializing'));
    }

    this.privacy_settings = new Gio.Settings({schema_id: 'org.cinnamon.desktop.privacy'});
    this.appFavorites = getAppFavorites();
    this.state = createStore({
      cinnamon36: typeof this._newPanelId !== 'undefined',
      orientation,
      recentEnabled: this.privacy_settings.get_boolean(REMEMBER_RECENT_KEY),
      settings: {},
      favorites: this.appFavorites.getFavorites(),
      knownProviders: [],
      enabledProviders: global.settings.get_strv('enabled-search-providers'),
      theme: null,
      isListView: false,
      iconSize: 64,
      currentCategory: 'favorites',
      startupCategoryOptionsEmpty: true,
      categoryDragged: false,
      fallbackDescription: '',
      appletReady: false,
      searchActive: false,
      itemEntered: false,
      contextMenuIsOpen: null,
      menuHeight: 0,
      expressionActive: false,
      searchWebErrorsShown: false,
      displayed: false,
      isNewInstance: true,
      dragIndex: -1,
      isBumblebeeInstalled: GLib.file_test('/usr/bin/optirun', GLib.FileTest.EXISTS)
    });
    this.state.connect({
      currentCategory: ({currentCategory}) => {
        this.setActiveCategoryStyle();
        Mainloop.idle_add_full(Mainloop.PRIORITY_DEFAULT, () => this.selectCategory(currentCategory));
      },
      categoryDragged: ({categoryDragged}) => {
        if (categoryDragged && this.vectorBox) {
          this.vectorBox.set_reactive(false);
          this.vectorBox.hide();
        }
      },
      clearEnteredActors: () => this.clearEnteredActors(),
      makeVectorBox: (actor) => this.makeVectorBox(actor),
      setTooltip: (coords, width, height, text) => {
        if (!text) {
          this.tooltip.hide();
          return;
        }
        let [x, y] = coords;
        let clutterText = this.tooltip._tooltip.get_clutter_text();
        if (clutterText) {
          clutterText.set_markup(text);
        } else {
          this.tooltip.set_text(text.replace(/(<([^>]+)>)/ig, ''));
        }
        if (width && height) {
          if (this.state.isListView) {
            x += width + 80;
            y -= 14;
            // Don't let the tooltip cover menu items when the menu
            // is oriented next to the right side of the monitor.
            let {style_class} = this._panelLocation;
            if (style_class === 'panelRight' || style_class === 'panelLeft vertical') {
              y += height;
            }
          } else {
            y += height;
          }
        }

        this.tooltip.mousePosition = [x, y];
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
      toggleSearchVisibility: (bool) => {
        if (bool) {
          this.selectedAppBox.hide();
          this.searchBox.show();
          global.stage.set_key_focus(this.searchEntry)
        } else {
          global.stage.set_key_focus(this.actor)
          this.searchBox.hide();
          this.selectedAppBox.show();
        }
        this.setActiveCategoryStyle();
      },
      selectorMethod: (method, id) => this[method](id),
      openMenu: () => this.menu.open(),
      closeMenu: () => this.menu.close(),
      getAppsGridBoxWidth: () => this.applicationsGridBox.width,
      scrollToButton: (...args) => this.scrollToButton(...args),
      isNotInScrollView: (button) => this.isNotInScrollView(button),
      purgeRecentItems: () => this.gtkRecentManager.purge_items(),
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
        this.settings.setValue('categories', categories);
        this.state.set({dragIndex: -1});
        this.buildCategories();
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

    this.signals = new SignalManager(null);
    this.displaySignals = new SignalManager(null);

    this.tracker = Cinnamon.WindowTracker.get_default();
    this.appSystem = Cinnamon.AppSystem.get_default();

    this.signals.connect(this.privacy_settings, 'changed::' + REMEMBER_RECENT_KEY, () => this.onEnableRecentChange());

    // FS search
    this.pathCompleter = new Gio.FilenameCompleter();
    this.pathCompleter.set_dirs_only(false);

    this.signals.connect(Main.themeManager, 'theme-set', () => this.onThemeChanged());

    this.iconTheme = Gtk.IconTheme.get_default();
    this.signals.connect(this.iconTheme, 'changed', (...args) => this.onIconsChanged(...args));
    this.signals.connect(this.appSystem, 'installed-changed', (...args) => this.refresh(...args));
    this.signals.connect(this.appFavorites, 'changed', (...args) => this.onFavoritesChanged(...args));
    this.signals.connect(this.menu, 'open-state-changed', (...args) => this.onOpenStateToggled(...args));
    this.signals.connect(global, 'scale-changed', () => this.state.set({menuHeight: 0}));

    this.categoryButtons = [];
    this.powerGroupButtons = [];
    this.knownApps = [];
    this.applicationsByCategory = {};
    this.allItems = [];
    this.activeContainer = null;
    this.placesManager = null;
    this.lastRenderTime = 0;

    this.session = new SessionManager();
    this.screenSaverProxy = new ScreenSaverProxy();
    this.recentManager = getDocManager();
    this.gtkRecentManager = Gtk.RecentManager.get_default();

    this.init = true;

    // Init settings
    this.loadSettings(true);
    this.state.set({
      isListView: this.state.settings.startupViewMode === ApplicationsViewMode.LIST,
      fallbackDescription: this.state.settings.descriptionPlacement === 2 || this.state.settings.descriptionPlacement < 4 ? _('No description available') : ''
    });
    global.settings.connect('changed::enabled-search-providers', (...args) => this.onEnabledSearchProvidersChange(...args));

    this.onEnableBookmarksChange(this.state.settings.enableBookmarks, true);
    this.updateIconAndLabel();
    this.updateActivateOnHover();
    this.updateKeybinding();
  }

  get gridWidth() {
    if (!this.state) return 0;
    return gridWidths[this.state.settings.appsGridColumnCount] * global.ui_scale;
  }

  loadSettings(init = false) {
    if (this.settings) {
      this.settings.finalize();
      this.state.settings = {};
    }

    // XletSettings loads an old version of the schema on applet reload after its updated
    // in Cinnamenu, and the md5 mismatch overwrites it because it wasn't designed with the
    // assumption applets would dynamcally modify their own schema at runtime. This carries
    // over the previous settings instance to the next applet instance on reload to prevent it.
    // Should be investigated and fixed in a future Cinnamon PR.
    if (global.cinnamenuBuffer) {
      this.settings = global.cinnamenuBuffer.settings;
      this.state.settings = global.cinnamenuBuffer.state;
      global.cinnamenuBuffer = null;
      each(this.settings.bindings, (val, key) => this.settings.unbindAll(key))
    } else {
      this.settings = new AppletSettings(this.state.settings, __meta.uuid, this.instance_id);
    }

    this.bindSettingsChanges();

    if (init) {
      this.initCategories();
    };
  }

  setStartupCategoryOptions(categoryButtons) {
    let {startupCategory} = this.state.settings;
    setSchema(__meta.path, categoryButtons, startupCategory, (knownProviders, startupCategoryValid) => {
      this.state.set({
        knownProviders,
        startupCategoryOptionsEmpty: false
      });
      if (this.state.isNewInstance) this.onEnabledSearchProvidersChange();
      if (!startupCategoryValid) this.settings.setValue('startupCategory', 'favorites');
      else this.loadSettings();
    });
  }

  update_label_visible() {
    if (this.orientation === St.Side.LEFT || this.orientation === St.Side.RIGHT) {
      this.hide_applet_label(true);
    } else {
      this.hide_applet_label(false);
    }
  }

  on_applet_reloaded() {
    if (!this.state) return;
    let {knownProviders, enabledProviders} = this.state;
    global.cinnamenuBuffer = {
      settings: this.settings,
      state: this.state.settings,
      knownProviders,
      enabledProviders
    };
  }

  on_orientation_changed(orientation) {
    this.orientation = orientation;
    this.update_label_visible();
    this.updateIconAndLabel();
    this.refresh();
    this.vectorBox = null;
  }

  on_applet_added_to_panel() {
    if (!this.state) {
      return;
    }
    this.state.set({appletReady: true});
  }

  on_applet_removed_from_panel() {
    this.willUnmount = true;
    Main.keybindingManager.removeHotKey('overlay-key-' + this.instance_id);
    if (!this.settings) {
      return;
    }
    if (!global.cinnamenuBuffer) this.settings.finalize();
    this.destroy();
  }

  on_applet_clicked() {
    if (!this.init) {
      this.set_applet_label(_('Please wait...'));
      return;
    }
    this.menu.toggle_with_options(this.state.settings.enableAnimation);
  }

  on_panel_height_changed() {
    this.refresh();
  }

  on_applet_instances_changed(instance) {
    if (instance && instance.instance_id !== this.instance_id) {
      this.getOtherInstance = () => instance;
      instance.getOtherInstance = () => this;
    } else if (!instance && !this.willUnmount) {
      this.getOtherInstance = null;
    }
  }

  launchPrivacySettings() {
    spawnCommandLine('cinnamon-settings privacy');
  }

  launchEditor() {
    spawnCommandLine('cinnamon-menu-editor');
  }

  updateKeybinding() {
    Main.keybindingManager.addHotKey(
      'overlay-key-' + this.instance_id,
      this.state.settings.overlayKey,
      () => {
        if (Main.overview.visible || Main.expo.visible) return;
        if (!this.getOtherInstance || global.screen.get_current_monitor() === this.panel.monitorIndex) {
          this.menu.toggle_with_options(this.state.settings.enableAnimation);
        } else if (typeof this.getOtherInstance === 'function') {
          let instance = this.getOtherInstance();
          instance.menu.toggle_with_options.call(instance.menu, instance.state.settings.enableAnimation);
        }
      }
    );
  }

  updateIconAndLabel() {
    tryFn(() => {
      if (this.state.settings.menuIconCustom) {
        if (this.state.settings.menuIcon === '') {
          this.set_applet_icon_name('');
        } else if (GLib.path_is_absolute(this.state.settings.menuIcon) && GLib.file_test(this.state.settings.menuIcon, GLib.FileTest.EXISTS)) {
          if (this.state.settings.menuIcon.includes('-symbolic')) {
            this.set_applet_icon_symbolic_path(this.state.settings.menuIcon);
          } else {
            this.set_applet_icon_path(this.state.settings.menuIcon);
          }
        } else if (this.iconTheme.has_icon(this.state.settings.menuIcon)) {
          if (this.state.settings.menuIcon.includes('-symbolic')) {
            this.set_applet_icon_symbolic_name(this.state.settings.menuIcon);
          } else {
            this.set_applet_icon_name(this.state.settings.menuIcon);
          }
        }
      } else {
        let iconName = global.settings.get_string('app-menu-icon-name');
        if (iconName.includes('-symbolic')) {
          this.set_applet_icon_symbolic_name(iconName);
        } else {
          this.set_applet_icon_name(iconName);
        }
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
  }

  createMenu(orientation) {
    this.orientation = orientation;
    this.menuManager = new PopupMenuManager(this);
    this.menu = new AppletPopupMenu(this, this.orientation);
    this.menuManager.addMenu(this.menu);
    this.menu.setCustomStyleClass('menu-background');
  }

  openMenu() {
    if (!this._applet_context_menu.isOpen) {
      this.menu.open(this.state.settings.enableAnimation);
    }
  }

  updateActivateOnHover(activate = true) {
    if (this.state.settings.activateOnHover && activate) {
      this.signals.connect(this.actor, 'enter-event', () => {
        setTimeout(() => this.openMenu(), this.state.settings.hoverDelayMs);
      });
    } else if (this.signals.isConnected('enter-event', this.actor)) {
      this.signals.disconnect('enter-event', this.actor)
    }
  }

  // handler for when favorites change
  onFavoritesChanged() {
    this.state.set({favorites: this.appFavorites.getFavorites()});
    // Check if the menu has been rendered at least once
    if (this.applicationsGridBox && this.applicationsListBox) {
      this.switchApplicationsView(true);
    }

    Mainloop.idle_add_full(150, () => {
      if (this.state.dragIndex > -1) {
        let button = find(this.allItems, (item) => item.buttonState.appIndex === this.state.dragIndex);
        if (button) {
          this.scrollToButton(button);
        }
        this.state.set({dragIndex: -1});
      }
    });
  }

  // handler for when icons change
  onIconsChanged() {
    if (!this.state || !this.state.appletReady) {
      return;
    }
    this.refresh();
  }

  onThemeChanged() {
    this.updateIconAndLabel();
    setTimeout(() => this.refresh(), 0);
  }

  searchProviderChange(provider) {
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
  }

  onEnabledSearchProvidersChange() {
    let enabledProviders = global.settings.get_strv('enabled-search-providers');
    if (enabledProviders.length === 0) return;
    this.state.set({enabledProviders});
    // Synchronize search provider settings
    for (let i = 0; i < this.state.knownProviders.length; i++) {
      this.settings.setValue(this.state.knownProviders[i], enabledProviders.indexOf(this.state.knownProviders[i]) > -1);
    }
  }

  updateCustomHeight() {
    this.customMenuHeightChange(true);
  }

  customMenuHeightChange(force = false) {
    if (this.state.menuHeight && !force) return;

    let height;
    let monitorHeight = Main.layoutManager.monitors[this.panel.monitorIndex].height;
    let customHeightLimit = monitorHeight - 120;
    let {enableCustomMenuHeight} = this.state.settings;

    if (enableCustomMenuHeight) {
      height = this.state.settings.customMenuHeight;
    } else {
      height = this.categoriesBox.height + this.bottomPane.height;
    }

    if (height >= customHeightLimit) {
      if (enableCustomMenuHeight) {
        height = customHeightLimit;
      } else {
        height = Math.round(Math.abs(monitorHeight * 0.55));
      }
    }

    this.groupCategoriesWorkspacesScrollBox.height = height;
    this.applicationsScrollBox.height = height;
    this.actor.style += `max-height: ${height}px`;
    this.state.set({menuHeight: height});
    this.applyConstraints();
  }

  applyConstraints() {
    if (this.state.settings.descriptionPlacement === 3 && (this.state.isListView || this.state.settings.appsGridColumnCount === 2)) {
      let node = this.searchBox.peek_theme_node();
      if (node) {
        let padding = node.get_length('padding');
        this.bottomPane.style = `min-height: ${this.bottomPane.height - padding}px;`;
        this.searchEntry.width = this.selectedAppBox.width;
      }
    } else {
      let searchWidth = this.searchBox.width - this.categoriesBox.width;
      this.searchEntry.width = searchWidth > 0 ? searchWidth : this.searchEntry.width;
    }

    this.actor.style += `max-width: ${this.mainBox.width}px;max-height: ${this.mainBox.height}px;`;
    this.groupCategoriesWorkspacesScrollBox.style += `max-width: ${this.categoriesBox.width}px;`;
    this.categoriesOverlayBox.style += `max-width: ${this.categoriesBox.width}px;`;
    this.categoriesBox.style += `max-width: ${this.categoriesBox.width}px;`;
    this.bottomPane.width = this.middlePane.width;
  }

  getExampleSearchProviders() {
    spawnCommandLine('xdg-open https://github.com/linuxmint/Cinnamon/tree/master/docs/search-providers-examples');
  }

  // function to bind preference setting changes
  bindSettingsChanges() {
    let settingsProps = [
      {
        key: 'categories',
        value: 'categories',
        cb: null
      },
      {
        key: 'startupCategory',
        value: 'startupCategory',
        cb: null
      },
      {
        key: 'menu-icon-custom',
        value: 'menuIconCustom',
        cb: this.updateIconAndLabel
      },
      {
        key: 'menu-icon',
        value: 'menuIcon',
        cb: this.updateIconAndLabel
      },
      {
        key: 'activate-on-hover',
        value: 'activateOnHover',
        cb: this.updateActivateOnHover
      },
      {
        key: 'hover-delay',
        value: 'hoverDelayMs',
        cb: () => {
          this.updateActivateOnHover(false);
          this.updateActivateOnHover(true);
        }
      },
      {
        key: 'overlay-key',
        value: 'overlayKey',
        cb: this.updateKeybinding
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
        cb: this.updateIconAndLabel
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
        cb: this.onEnablePlacesChange
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
        key: 'description-placement',
        value: 'descriptionPlacement',
        cb: this.refresh
      },
      {
        key: 'tooltip-delay',
        value: 'tooltipDelay',
        cb: null
      },
      {
        key: 'enable-custom-menu-height',
        value: 'enableCustomMenuHeight',
        cb: this.updateCustomHeight
      },
      {
        key: 'custom-menu-height',
        value: 'customMenuHeight',
        cb: this.updateCustomHeight
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
        settingsProps[i].cb ? (...args) => settingsProps[i].cb.call(this, ...args) : null
      );
    }
  }

  introspectTheme(cb) {
    let appletMenuThemeNode = this.menu.actor.get_theme_node();
    this.state.set({
      theme: { // TODO: Find a proper class for button app state dots
        foregroundColor: appletMenuThemeNode.get_foreground_color().to_string().substring(0, 7),
      }
    });
    if (typeof cb === 'function') {
      cb();
    }
  }

  onOpenStateToggled(menu, open) {
    if (global.settings.get_boolean('panel-edit-mode')) {
      return false;
    }
    if (open) {
      if (!this.state.displayed) {
        this.display();
      }

      this.introspectTheme(()=>{
        // Set Category
        this.categoriesBox.show();
        // Load Startup Applications category
        this.switchApplicationsView(false);
        // Display startup apps
        this.resetDisplayState();
        this.state.trigger('menuOpened');
        this.mainBox.show();
        // Do height/constraint adjustments after actors are rendered and on the stage.
        this.customMenuHeightChange(true);
      });
    } else {
      if (this.state.searchActive) {
        this.resetSearch();
      }
      this.clearEnteredActors();
      this.clearApplicationsBox();
    }
    return true;
  }

  onEnableRecentChange() {
    this.state.set({recentEnabled: this.privacy_settings.get_boolean(REMEMBER_RECENT_KEY)});
    this.refresh(true);
  }

  onEnablePlacesChange() {
    this.refresh(true);
  }

  onEnableBookmarksChange(enableBookmarks, fromInit = false) {
    if (enableBookmarks) {
      this.bookmarksManager = new bookmarksManager(this.appSystem);
    } else if (this.bookmarksManager) {
      this.bookmarksManager = null;
    }
    if (!fromInit) {
      this.refresh(this.state.settings.startupCategory === 'bookmarks');
    }
  }

  refresh(startupCategoryOptionsEmpty = false) {
    // TBD: For some reason the onEnable* settings callbacks get called several times per settings change,
    // This is causing the start up category to reset, so throttling this function to 250ms prevents excess invocation.
    let now = Date.now();
    if ((now - this.lastRenderTime) <= 250) return;
    this.lastRenderTime = now;

    this.clearAll();
    this.destroyDisplayed();
    this.state.set({
      displayed: false,
      menuHeight: 0,
      startupCategoryOptionsEmpty
    });
    this.mxOffset = null;
    this.categoryButtons = [];
    this.initCategories(false);
    this.display();
    this.clearEnteredActors();
    this.destroyAppButtons();
  }

  clearAll() {
    this.menu.removeAll();
  }

  getActiveButtons() {
    let buttons = [];
    let children = this.activeContainer.get_children();
    for (let i = 0; i < children.length; i++) {
      buttons.push(find(this.allItems, function(button) {
        return button && button.actor === children[i];
      }));
    }
    return buttons;
  }

 /*
  * The vectorBox overlays the the categoriesBox to aid in navigation from categories to apps
  * by preventing misselections. It is set to the same size as the categoriesOverlayBox and
  * categoriesBox.
  *
  * The actor is a quadrilateral that we turn into a triangle by setting the A and B vertices to
  * the same position. The size and origin of the vectorBox are calculated in getVectorInfo().
  * Using those properties, the bounding box is sized as (w, h) and the triangle is defined as
  * follows:
  *   _____
  *  |    /|D
  *  |   / |     AB: (mx, my)
  *  | A/  |      C: (w, h)
  *  | B\  |      D: (w, 0)
  *  |   \ |
  *  |____\|C
  */
  getVectorInfo(buttonHeight) {
    let [mx, my, , ] = global.get_pointer();
    // Slightly distance the polygon from the cursor so categories update quickly.
    if (!this.mxOffset) {
      let mxOffset = Math.floor(buttonHeight / 38);
      mxOffset = mxOffset < 0 ? 0 : mxOffset;
      this.mxOffset = mxOffset;
    }
    mx += this.mxOffset;
    let bw, bh, bx, by;
    if (!this.categoriesScrollBoxTransformedSize) {
      this.categoriesScrollBoxTransformedSize = this.groupCategoriesWorkspacesScrollBox.get_transformed_size();
    }
    if (!this.categoriesScrollBoxTransformedPosition) {
      this.categoriesScrollBoxTransformedPosition = this.groupCategoriesWorkspacesScrollBox.get_transformed_position();
    }
    [bw, bh] = this.categoriesScrollBoxTransformedSize;
    [bx, by] = this.categoriesScrollBoxTransformedPosition;
    let xformed_mx = mx - bx;
    let xformed_my = my - by;
    if (xformed_mx < 0 || xformed_mx > bw || xformed_my < 0 || xformed_my > bh) {
      return null;
    }
    return {
      mx: xformed_mx,
      my: xformed_my,
      w: bw,
      h: bh
    };
  }

  makeVectorBox(actor) {
    let vi = this.getVectorInfo(actor.height);
    if (!vi) return;
    let config = {
      debug: false,
      width: vi.w - 1,
      height: vi.h,
      ulc_x: vi.mx,
      ulc_y: vi.my,
      llc_x: vi.mx,
      llc_y: vi.my,
      urc_x: vi.w,
      urc_y: 0,
      lrc_x: vi.w,
      lrc_y: vi.h
    };
    if (!this.vectorBox || this.vectorBox.is_finalized()) {
      this.vectorBox = new St.Polygon(config);
      this.vectorBox._delegate = actor._delegate;
      this.draggableVectorBox = makeDraggable(this.vectorBox);
      this.categoriesOverlayBox.add_actor(this.vectorBox);
      this.vectorBox.set_reactive(true);
      this.vectorBox.show();
      this.applicationsBoxWrapper.connect('enter-event', () => {
        if (!this.vectorBox) return;
        this.vectorBox.set_reactive(false);
      });
      this.draggableVectorBoxId = this.draggableVectorBox.connect('drag-begin', () => {
        if (!this.vectorBox) return;
        this.vectorBox.set_reactive(false);
        this.vectorBox.hide();
      });
    } else {
      this.vectorBox._delegate = actor._delegate;
      if (!this.vectorBox.reactive) this.vectorBox.set_reactive(true);
      if (!this.vectorBox.visible) this.vectorBox.show();
      let keys = Object.keys(config);
      for (let i = 0; i < keys.length; i++) {
        this.vectorBox[keys[i]] = config[keys[i]]
      }
    }
  }

  loadAppCategories(dir, rootDir, dirId) {
    let iter = dir.iter();
    let nextType;
    let shouldResetMenuHeight = false;
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
          let appIsKnown = this.knownApps.indexOf(id) > -1;
          if (!appIsKnown) {
            if (!this.state.isNewInstance) {
              app.shouldHighlight = true;
              shouldResetMenuHeight = true;
            } else {
              this.knownApps.push(id);
            }
          }
        }
      } else if (nextType === CMenu.TreeItemType.DIRECTORY) {
        if (rootDir) {
          this.loadAppCategories(iter.get_directory(), rootDir, null);
        } else {
          this.loadAppCategories(iter.get_directory(), dir, dirId);
        }
      }
    }
    if (shouldResetMenuHeight) this.state.set({menuHeight: 0});
  }

  resetCategoryOrder() {
    if (!this.categoriesBox) {
      return;
    }
    this.categoriesBox.remove_all_children();
    this.settings.setValue('categories', []);
    this.buildCategories();
  }

  initCategories(isReRender) {
    let buttons = [];
    let categoriesChanged = false;
    if (isReRender) {
      buttons.push(find(this.categoryButtons, button => button.id === 'all'));
    } else {
      buttons = [new CategoryListButton(this.state, 'all', _('All Applications'), 'computer')];
    }

    let tree = this.appSystem.get_tree();
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
      this.loadAppCategories(dir, null, dirId);
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
    let params = [
      [this.state.settings.showPlaces, 'places', _('Places'), 'folder', 'selectAllPlaces'],
      [this.state.recentEnabled, 'recent', _('Recent Files'), 'folder-recent', 'selectRecent'],
      [this.state.settings.enableBookmarks, 'bookmarks', _('Bookmarks'), 'emblem-favorite', 'selectWebBookmarks'],
      [true, 'favorites', _('Favorite Apps'), 'address-book-new', 'selectCategory']
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
    if (buttons.length !== this.state.settings.categories.length - 1) {
      categoriesChanged = true;
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
    }

    if ((categoriesChanged || this.state.startupCategoryOptionsEmpty) && !isReRender) {
      this.setStartupCategoryOptions(buttons);
      this.state.startupCategoryOptionsEmpty = false;
    }

    buttons = undefined;
  }

  buildCategories() {
    let isReRender = this.categoryButtons.length > 0;
    if (isReRender) {
      this.categoriesBox.remove_all_children();
      this.initCategories(true);
    }
    each(this.categoryButtons, (button) => this.categoriesBox.add_actor(button.actor))
  }

  setActiveCategoryStyle() {
    let {currentCategory} = this.state;
    for (let i = 0; i < this.categoryButtons.length; i++) {
      if (this.categoryButtons[i].id === currentCategory) {
        this.categoryButtons[i].actor.set_style_class_name('menu-category-button-selected');
      } else {
        this.categoryButtons[i].actor.set_style_class_name('menu-category-button');
      }
    }
  }

  selectCategory(categoryId) {
    if (this.willUnmount) return;
    this.clearApplicationsBox();
    switch (categoryId) {
      case 'places':
        this.selectAllPlaces();
        break;
      case 'recent':
        this.displayApplications(this.listRecent());
        break;
      case 'bookmarks':
        this.displayApplications(this.listWebBookmarks());
        break;
      default:
        this.displayApplications(this.listApplications(categoryId));
    }
  }

  selectAllPlaces() {
    this.clearApplicationsBox();
    let places = this.listPlaces()
      .concat(this.listBookmarks())
      .concat(this.listDevices());
    this.displayApplications(places);
  }

  switchApplicationsView(fromToggle) {
    // In the case of the descriptionPlacement in the bottom pane, we need to toggle insertion
    // of selectedAppBox in between powerGroupBox and searchBox - much simpler to do a full refresh.
    if (fromToggle && this.state.settings.descriptionPlacement === 3) {
      this.menu.close();
      this.refresh();
      this.menu.open();
      return;
    }
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
      this.lastGridWidth = this.applicationsGridBox.width
      this.applicationsGridBox.width = this.applicationsListBox.width;
      this.applicationsGridBox.hide();
      this.applicationsListBox.show();
    } else {
      this.applicationsGridBox.width = this.gridWidth;
      this.applicationsListBox.hide();
      this.applicationsGridBox.show();
    }
    // switch activeContainer
    if (this.activeContainer === this.applicationsListBox || this.activeContainer === this.applicationsListBox) {
      // reset active container
      this.activeContainer = isListView ? this.applicationsListBox : this.applicationsGridBox;
      // reset scroll to top
      let vscroll = this.applicationsScrollBox.get_vscroll_bar();
      let newScrollValue = this.applicationsScrollBox.get_allocation_box().y1;
      vscroll.get_adjustment().set_value(newScrollValue);
    }
    this.clearEnteredActors();
    this.clearApplicationsBox();
    if (fromToggle) {
      this.destroyAppButtons();
      this.resetDisplayState();
      this.applyConstraints();
    }
  }

  isNotInScrollView(button) {
    let adjustment = this.applicationsScrollBox.get_vscroll_bar().get_adjustment();
    let currentScrollValue = adjustment.get_value();
    let boxHeight = this.applicationsScrollBox.get_allocation_box().y2 - this.applicationsScrollBox.get_allocation_box().y1;
    let allocationBox = button.actor.get_allocation_box();
    return boxHeight + currentScrollValue < allocationBox.y2 + 100;
  }

  scrollToButton(button, fullyScrollFirstAndLast = false) {
    let container = button.actor.get_parent();
    let scrollBox = container;
    let children;
    let i = 0;
    while (!(scrollBox instanceof St.ScrollView)) {
      i++;
      if (i > 10) {
        global.logWarning('Cinnamenu: Unable to find scrollbox for', button.actor.toString())
        return false
      };
      scrollBox = scrollBox.get_parent();
    }

    let adjustment = scrollBox.vscroll.adjustment;
    let [value, lower, upper, stepIncrement, pageIncrement, pageSize] = adjustment.get_values();

    if (fullyScrollFirstAndLast) children = container.get_children();
    if (fullyScrollFirstAndLast && button.actor === children[0]) {
      value = 0;
    } else if (fullyScrollFirstAndLast && button.actor === children[children.length - 1]) {
      value = scrollBox.height;
    } else {
      let offset = 0;
      let vfade = scrollBox.get_effect('fade');
      if (vfade) {
        offset = vfade.vfade_offset;
      }
      let box = button.actor.get_allocation_box();
      let y1 = box.y1, y2 = box.y2;
      let parent = button.actor.get_parent();
      while (parent !== scrollBox) {
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
    }

    if (this.state.settings.enableAnimation) {
      addTween(adjustment, {
        value: value,
        time: 0.1,
        transition: 'easeOutQuad'
      });
    } else {
      adjustment.set_value(value);
    }
  }

  clearEnteredActors() {
    this.activeContainer = this.state.isListView ? this.applicationsListBox : this.applicationsGridBox;
    let buttons = this.getActiveButtons();
    let refItemIndex = findIndex(buttons, (button) => {
      return (button.actor.has_style_class_name('menu-application-button-selected')
          || button.entered != null
          || button.menu.isOpen);
    });
    if (refItemIndex > -1 && buttons[refItemIndex]) {
      if (buttons[refItemIndex].menu.isOpen) {
        buttons[refItemIndex].closeMenu();
      }
      buttons[refItemIndex].handleLeave();
    }
    let refPowerGroupItemIndex = findIndex(this.powerGroupButtons, function(button) {
      return button.entered != null;
    });
    if (refPowerGroupItemIndex > -1 && this.powerGroupButtons[refPowerGroupItemIndex]) {
      this.powerGroupButtons[refPowerGroupItemIndex].handleLeave();
    }
  }

  clearApplicationsBox() {
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

    if (this.applicationsGridBox && !this.applicationsGridBox.is_finalized()) {
      let gridActors = this.applicationsGridBox.get_children();
      if (gridActors) {
        for (let i = 0, len = gridActors.length; i < len; i++) {
          this.applicationsGridBox.remove_child(gridActors[i]);
        }
      }
    }
  }

  listWindows(pattern) {
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
  }

  listSearchProviders(pattern, cb) {
    launch_all(pattern, (provider, results) => {
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
  }

  listPlaces(pattern) {
    if (!this.placesManager || !this.state.settings.showPlaces) {
      return [];
    }
    let places = this.placesManager.places.special;
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
  }

  listBookmarks(pattern) {
    if (!this.placesManager || !this.state.settings.showPlaces) {
      return [];
    }
    let bookmarks = this.placesManager.places.bookmarks;
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
  }

  listDevices(pattern) {
    if (!this.placesManager) {
      return [];
    }
    let devices = this.placesManager.places.devices;
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
  }

  listWebBookmarks(pattern) {
    if (!this.state.settings.enableBookmarks) {
      return [];
    }
    if (!this.state.searchWebErrorsShown && !Gda) {
      this.answerText.set_text(_('gir1.2-gda-5.0 package required for Firefox and Midori bookmarks.'));
      this.answerText.show();
    } else if (this.answerText.is_visible() && !this.state.expressionActive) {
      this.answerText.hide()
    }

    this.state.set({searchWebErrorsShown: true});

    let res = []
    let arr = this.bookmarksManager.state;
    let arrKeys = this.bookmarksManager.arrKeys;
    let searchableProps = ['name'];

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
  }

  listRecent(pattern) {
    if (!this.state.recentEnabled) {
      return [];
    }
    let {_infosByTimestamp} = this.recentManager;
    let res = []

    for (let i = 0, len = _infosByTimestamp.length; i < len; i++) {
      let recentInfo = _infosByTimestamp[i];
      res.push({
        name: recentInfo.name,
        icon: recentInfo.gicon,
        uri: recentInfo.uri,
        description: recentInfo.uriDecoded,
        type: ApplicationType._recent
      });
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
  }

  listApplications(categoryMenuId, pattern) {
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
  }

  resetDisplayState() {
    let {startupCategory} = this.state.settings;
    this.resetSearch();
    if (startupCategory === 'bookmarks') this.answerText.set_text(_('Please wait...'));
    this.answerText.show();
    this.state.set({currentCategory: startupCategory}, true);
  }

  onMenuKeyPress(actor, event) {
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
    let refItemIndex = findIndex(buttons, (button) => {
      return (button.actor.has_style_class_name('menu-application-button-selected')
          || button.entered != null
          || button.menu.isOpen);
    });

    let refCategoryIndex = findIndex(this.categoryButtons, (button) => {
      return button.entered != null;
    });

    let refPowerGroupItemIndex = findIndex(this.powerGroupButtons, (button) => {
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
        refContextMenuItemIndex = findIndex(contextMenuChildren, (button) => {
          return button.actor.has_style_pseudo_class('active');
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
    let startingCategoryIndex = findIndex(this.categoryButtons, (button) => {
      return this.state.currentCategory === button.id;
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
  }

  getCompletion(text) {
    if (text.indexOf('/') !== -1) {
      if (text.substr(text.length - 1) === '/') {
        return '';
      } else {
        return this.pathCompleter.get_completion_suffix(text);
      }
    } else {
      return false;
    }
  }

  getCompletions(text) {
    if (text.includes('/')) {
      return map(this.pathCompleter.get_completions(text), function(path) {
        if (path.charAt(0) === '~') {
          path = path.slice(1);
          path = GLib.get_home_dir() + path;
        }

        return {
          name: path,
          description: path,
          uri: path,
          icon: Gio.content_type_get_icon(Gio.content_type_guess(path, null)[0]),
          type: ApplicationType._completions
        };
      });
    } else {
      return [];
    }
  }

  resetSearch() {
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
    if (this.activeContainer) {
      this.activeContainer.show();
    }
    if (!this.activeContainer) {
      this.activeContainer = this.state.settings.startupViewMode === ApplicationsViewMode.LIST ? this.applicationsListBox : this.applicationsGridBox;
    }

    // Since we don't want to monitor which windows need added or removed like a window list applet,
    // they are queried as needed during searches, so we're cleaning them up, along with any
    // search provider results, if enabled.
    let allItems = [];
    for (let i = 0; i < this.allItems.length; i++) {
      if (!this.allItems[i]) {
        continue;
      }
      if (this.state.settings.enableWindows && this.allItems[i].buttonState.appType === ApplicationType._windows
        || this.state.settings.enableSearchProviders && this.allItems[i].buttonState.appType === ApplicationType._providers) {
        this.allItems[i].destroy(true);
        this.allItems[i] = undefined;
      } else {
        this.allItems[i].clearSearchFormatting();
        allItems.push(this.allItems[i]);
      }
    }
    this.allItems = allItems;
    this.selectedAppTitle.set_text('');
    this.selectedAppDescription.set_text('');
    global.stage.set_key_focus(this.searchEntry);
  }

  onSearchTextChanged() {
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
      this.resetDisplayState();
      return;
    }

    this.state.set({searchActive: searchText.length > 0});

    if (this.state.searchActive) {
      this.clearEnteredActors();
      this.searchEntry.set_secondary_icon(this.searchActiveIcon);

      if (!this.signals.isConnected('secondary-icon-clicked', this.searchEntry)) {
        this.signals.connect(this.searchEntry, 'secondary-icon-clicked', this.resetDisplayState, this);
      }
    } else {
      if (this.signals.isConnected('secondary-icon-clicked', this.searchEntry)) {
        this.signals.disconnect('secondary-icon-clicked', this.searchEntry, this)
      }

      this.searchEntry.set_secondary_icon(null);
      this.state.trigger('menuOpened');
    }
    setTimeout(() => this.doSearch(searchText), 0);
  }

  doSearch(text) {
    if (!text || !text.trim()) return;
    let pattern = latinise(text.trim().toLowerCase());
    if (pattern === this.previousSearchPattern) {
      return false;
    }
    this.previousSearchPattern = pattern;

    // Convenience calculator
    if (pattern.search(/([-+]?[0-9]*\.?[0-9]+[/+\-*])+([-+]?[0-9]*\.?[0-9]+)/gm) > -1) {
      tryFn(() => {
        let answer = eval(pattern);
        let answerText = pattern + ' = ' + answer;
        this.answerText.set_text(answerText);
        this.answerText.show();
        this.activeContainer.hide();
        this.state.set({expressionActive: true});
      }, () => this.state.set({expressionActive: false}));
    }

    let acResults = []; // search box autocompletion results
    if (this.state.settings.searchFilesystem) {
      // Don't use the pattern here, as filesystem is case sensitive
      acResults = this.getCompletions(text);
    }

    let results = this.listApplications(null, pattern)
      .concat(this.listPlaces(pattern))
      .concat(this.listWebBookmarks(pattern))
      .concat(this.listRecent(pattern))
      .concat(acResults)
      .concat(this.listWindows(pattern));

    const finish = () => {
      sortBy(results, 'score', 'desc');
      this.clearApplicationsBox();
      this.displayApplications(results);

      let buttons = this.getActiveButtons();
      if (buttons.length === 0) return;
      buttons[0].handleEnter();
    };
    if (this.state.settings.enableSearchProviders
      && this.state.enabledProviders.length > 0
      && pattern.length > 2) {
      this.listSearchProviders(pattern, (providerResults) => {
        // Since the provider results are asynchronous, the search state may have ended by the time they return.
        if (!this.state.searchActive
          || !providerResults
          || providerResults.length === 0) {
          return;
        }
        results = results.concat(providerResults);
        finish();
      });
    } else {
      finish();
    }

    return false;
  }

  displayApplications(appList) {
    if (!appList) {
      return false;
    }
    if (this.mainBox && !this.state.theme) {
      this.introspectTheme(() => this.displayApplications(appList));
      return false;
    }

    let column = 0;
    let columnsCount = 0;
    let rownum = 0;
    let lastApp = appList[appList.length - 1];

    this.activeContainer = this.state.isListView ? this.applicationsListBox : this.applicationsGridBox;
    this.state.contextMenuIsOpen = null;

    const createAppButton = (app, appType, len, appIndex) => {
      let appButton;
      let refAppButton = -1;
      for (let i = 0, _len = this.allItems.length; i < _len; i++) {
        if (this.allItems[i]
          && (this.allItems[i].buttonState.appType === ApplicationType._places && this.allItems[i].buttonState.app.name === app
            || this.allItems[i].buttonState.app === app)) {
          refAppButton = i;
          break;
        }
      }
      if (refAppButton > -1 && this.allItems[refAppButton]) {
        appButton = this.allItems[refAppButton];
        appButton.buttonState.set({
          app: app,
          appType: appType,
          appListLength: len,
          appIndex: appIndex
        });
      } else {
        appButton = new AppListGridButton(this.state, app, appType, appIndex, len);
        this.allItems.push(appButton);
      }

      if (this.state.isListView) {
        this.applicationsListBox.add_actor(appButton.actor);
      } else {
        let gridLayout = this.applicationsGridBox.layout_manager;
        if (!gridLayout) {
          return false;
        }
        appButton.buttonState.set({column});
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
      let isString = false;
      if (appList[z].type === undefined) {

        // Check auto-completion
        if (typeof appList[z] !== 'string') {
          appList[z].type = ApplicationType._applications;
        } else {
          isString = true;
        }
      }

      for (let y = 0, len = AppTypes.length; y < len; y++) {
        if (!isString && ApplicationType[AppTypes[y]] !== appList[z].type) {
          continue;
        }
        index += 1;
        createAppButton(appList[z], appList[z].type, len, index);
      }
    }
    this.columnsCount = columnsCount;

    if (this.state.currentCategory === 'bookmarks') this.answerText.hide();
  }

  display() {
    this.state.set({
      isListView: this.state.settings.startupViewMode === ApplicationsViewMode.LIST,
      displayed: true
    });

    let section = new PopupMenuSection();

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
    this.groupCategoriesWorkspacesScrollBox.set_auto_scrolling(this.state.settings.enableAutoScroll);
    this.groupCategoriesWorkspacesScrollBox.set_mouse_scrolling(true);

    // selectedAppBox
    this.selectedAppBox = new St.BoxLayout({
      style_class: 'menu-selected-app-box',
      style: 'text-align: left;width:100px;',
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

    this.searchInactiveIcon = new St.Icon({
      style_class: 'menu-search-entry-icon',
      icon_name: 'edit-find'
    });
    this.searchActiveIcon = new St.Icon({
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

    this.searchEntry.set_primary_icon(this.searchInactiveIcon);
    this.searchBox.add(this.searchEntry, {
      expand: true,
      x_align: St.Align.START,
      y_align: St.Align.START
    });

    this.searchEntryText = this.searchEntry.clutter_text;
    this.displaySignals.connect(this.searchEntryText, 'text-changed', (...args) => this.onSearchTextChanged(...args));
    this.displaySignals.connect(this.searchEntryText, 'key-press-event', (...args) => this.onMenuKeyPress(...args));
    this.previousSearchPattern = '';

    // Load Places
    if (PlaceDisplay && this.state.settings.showPlaces) {
      this.placesManager = new PlaceDisplay.PlacesManager(false);
    } else if (this.placesManager) {
      this.placesManager.destroy();
      this.placesManager = null;
    }

    // ApplicationsBox (ListView / GridView)
    this.applicationsScrollBox = new St.ScrollView({
      x_fill: true,
      y_fill: false,
      y_align: St.Align.START,
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
      style_class: 'cinnamenu-applications-list-box',
      style: 'min-width: 300px;',
      vertical: true
    });

    this.applicationsGridBox = new Clutter.Actor({
      layout_manager: new Clutter.GridLayout(),
      reactive: true,
      width: this.gridWidth
    });
    this.applicationsBoxWrapper = new St.BoxLayout({
      style_class: 'menu-applications-inner-box',
      style: 'min-width: 275px',
      vertical: true,
      reactive: true
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

    this.categoriesOverlayBox = new St.Widget();

    // CategoriesBox
    this.categoriesBox = new St.BoxLayout({
      style_class: 'menu-categories-box',
      vertical: true
    });
    this.categoriesOverlayBox.add_actor(this.categoriesBox);

    // Build categories
    this.buildCategories();

    // PowerGroupBox
    this.powerGroupBox = new St.BoxLayout({
      style_class: '',
      style: 'padding-left: 13px;'
    });

    this.powerGroupButtons.push(new GroupButton(
      this.state,
      'user',
      16,
      '',
      _('Account details'),
      () => spawnCommandLine('cinnamon-settings user')
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
      _('Lock Screen'),
      _('Lock the screen'),
      () => {
        let screensaver_settings = new Gio.Settings({
          schema_id: 'org.cinnamon.desktop.screensaver'
        });
        let screensaver_dialog = Gio.file_new_for_path('/usr/bin/cinnamon-screensaver-command');
        if (screensaver_dialog.query_exists(null)) {
          if (screensaver_settings.get_boolean('ask-for-away-message')) {
            spawnCommandLine('cinnamon-screensaver-lock-dialog');
          } else {
            spawnCommandLine('cinnamon-screensaver-command --lock');
          }
        } else {
          this.screenSaverProxy.LockRemote('');
        }
      }
    ));
    this.powerGroupButtons.push(new GroupButton(
      this.state,
      'application-exit',
      16,
      _('Logout'),
      _('Leave the session'),
      () => this.session.LogoutRemote(0)
    ));
    this.powerGroupButtons.push(new GroupButton(
      this.state,
      'system-shutdown',
      16,
      _('Quit'),
      _('Shutdown the computer'),
      () => this.session.ShutdownRemote()
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
    this.groupCategoriesWorkspacesWrapper.add(this.categoriesOverlayBox, {
      x_fill: false,
      y_fill: true,
      x_align: St.Align.START,
      y_align: St.Align.END,
      y_expand: true,
      expand: false
    });
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
      y_align: St.Align.START,
      expand: true
    });

    this.bottomPane.add(this.powerGroupBox, {
      expand: false,
      x_fill: false,
      y_fill: false,
      x_align: St.Align.START,
      y_align: St.Align.MIDDLE
    });

    if (this.state.settings.descriptionPlacement === 3) {
      this.bottomPane.add(this.selectedAppBox, {
        x_fill: true,
        y_fill: false,
        x_align: St.Align.START,
        y_align: St.Align.MIDDLE,
        expand: true,
        align_end: false,
        show_on_set_parent: false
      });
      if (this.state.isListView || this.state.settings.appsGridColumnCount < 3) {
        this.selectedAppBox.hide();
        this.selectedAppBox.style += 'text-align: right;';
      }
    }

    this.bottomPane.add(this.searchBox, {
      expand: true,
      x_fill: true,
      y_fill: false,
      x_align: St.Align.END,
      y_align: St.Align.MIDDLE,
      align_end: true
    });

    // mainbox packs vertically
    this.mainBox.add_actor(this.middlePane);
    this.mainBox.add(this.bottomPane);

    // add all to section
    section.actor.add_actor(this.mainBox);

    // add section as menu item
    this.menu.addMenuItem(section);

    // Set height constraints on scrollboxes
    this.applicationsScrollBox.add_constraint(new Clutter.BindConstraint({
      name: 'appScrollBoxConstraint',
      source: this.groupCategoriesWorkspacesScrollBox,
      coordinate: Clutter.BindCoordinate.HEIGHT,
      offset: 0
    }));

    this.tooltip = new Tooltip(this.mainBox, '')
    this.tooltip._tooltip.set_style('text-align: left;');

    if (this.state.isNewInstance) {
      this.state.set({isNewInstance: false});
    }
  }

  destroyContainer(container) {
    if (!container || container.is_finalized()) {
      return false;
    }
    let children = container.get_children();
    for (let i = 0, len = children.length; i < len; i++) {
      children[i].destroy();
    }
    container.destroy();
    return true;
  }

  destroyDisplayed() {
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
  }

  destroyAppButtons() {
    for (let i = 0, len = this.allItems.length; i < len; i++) {
      if (this.allItems[i]) {
        this.allItems[i].destroy();
      }
      this.allItems.splice(i, 1);
    }
    this.allItems = [];
  }

  destroy() {
    this.signals.disconnectAllSignals();
    if (this.placesManager) this.placesManager.destroy();
    this.destroyAppButtons();
    if (!this.activeContainer) {
      return;
    }
    this.activeContainer.destroy();
    this.destroyDisplayed();
    this.menu.destroy();
  }
};

function main(metadata, orientation, panel_height, instance_id) {
  return new CinnamenuApplet(metadata, orientation, panel_height, instance_id);
}