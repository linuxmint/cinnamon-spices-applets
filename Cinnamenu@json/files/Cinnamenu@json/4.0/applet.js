const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const GLib = imports.gi.GLib;
const CMenu = imports.gi.CMenu;
const Clutter = imports.gi.Clutter;
//const {BinLayout} = imports.gi.Clutter;
const Cinnamon = imports.gi.Cinnamon;
const St = imports.gi.St;
const {   TextureCache,
          Icon,
          IconType,
          Label,
          Align,
          BoxLayout,
          Widget } = imports.gi.St;
const Meta = imports.gi.Meta;
const Main = imports.ui.main;
const {getDocManager} = imports.misc.docInfo;
const Mainloop = imports.mainloop;
const {heightsUsedMonitor} = imports.ui.panel;
//const {SessionManager} = imports.misc.gnomeSession;
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
const {tryFn} = require('./utils');
const searchStr = require('./fuzzy');
const { _, ApplicationType, AppTypes } = require('./constants');
const ApplicationsViewModeLIST = 0, ApplicationsViewModeGRID = 1;
const PlacementTOOLTIP = 1, PlacementUNDER = 2, PlacementNONE =3;
const REMEMBER_RECENT_KEY = 'remember-recent-files';
const {CategoryListButton, AppListGridButton, GroupButton} = require('./buttons');
const {Gda} = require('./browserBookmarks');
const PlaceDisplay = require('./placeDisplay');
const {BookmarksManager} = require('./bookmarksManager');
const hintText = _('Type to search...');
const SEARCH_THRESHOLD = 0.2;

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
                    settings: {},
                    enabledProviders: global.settings.get_strv('enabled-search-providers'),
                    theme: null,
                    isListView: false,
                    panelLocation: null,
                    iconSize: 64,
                    currentCategory: 'favorites',
                    categoryDragged: false,
                    fallbackDescription: '',
                    searchActive: false,
                    contextMenuIsOpen: null,
                    dragIndex: -1,
                    isBumblebeeInstalled: GLib.file_test('/usr/bin/optirun', GLib.FileTest.EXISTS) });
        this.recentEnabled = this.privacy_settings.get_boolean(REMEMBER_RECENT_KEY);
        this.favorites = this.appFavorites.getFavorites();
        this.knownProviders = [];
        this.appletReady = false;
        this.searchWebErrorsShown = false;
        this.displayed = false;
        this.isNewInstance = true;

        this.state.connect({
            currentCategory: ({currentCategory}) => {
                    this.setActiveCategoryStyle();
                    Mainloop.idle_add_full(Mainloop.PRIORITY_DEFAULT, () => this.selectCategory(currentCategory)); },
            categoryDragged: ({categoryDragged}) => { if (categoryDragged && this.vectorBox) {
                                                          this.vectorBox.set_reactive(false);
                                                          this.vectorBox.hide();
                                                      } },
            clearEnteredActors: () => this.clearEnteredActors(),
            makeVectorBox: (actor) => this.makeVectorBox(actor), //?undo
            setKeyFocus: () => global.stage.set_key_focus(this.searchEntry),
            /*toggleSearchVisibility: (bool) => {
                    if (bool) {
                        global.stage.set_key_focus(this.searchEntry);
                    } else {
                        global.stage.set_key_focus(this.actor);
                    }
                    this.setActiveCategoryStyle(); },*/
            openMenu: () => this.menu.open(),
            closeMenu: () => this.menu.close(),
            getAppsGridBoxWidth: () => this.applicationsGridBox.width,
            scrollToButton: (...args) => this.scrollToButton(...args),
            isNotInScrollView: (button) => this.isNotInScrollView(button),
            getActiveButtons: () => this.getActiveButtons(),
            isFavorite: (id) => this.appFavorites.isFavorite(id),
            addFavorite: (id) => this.appFavorites.addFavorite(id),
            moveFavoriteToPos: (id, index) => {
                              Meta.later_add(Meta.LaterType.BEFORE_REDRAW, () => {
                                                this.appFavorites.moveFavoriteToPos(id, index);
                                                return false; });
                                              },
            moveCategoryToPos: (id1, id2) => { //?undo
                              let categories = this.state.settings.categories.slice();
                              let oldIndex = categories.indexOf(id1);
                              let newIndex = categories.indexOf(id2);
                              categories.splice(oldIndex, 1);
                              let categories1 = categories.slice(0, newIndex);
                              let categories2 = categories.slice(newIndex, categories.length);
                              categories = categories1.concat([id1]).concat(categories2);
                              this.state.settings.categories = categories;
                              this.state.set({dragIndex: -1});
                              this.buildCategories();
                              for (let i = 0, len = this.categoryButtons.length; i < len; i++) {
                                  if (this.categoryButtons[i].id === id2) {
                                      this.categoryButtons[i].handleEnter();
                                  } else if (this.categoryButtons[i].entered) {
                                      this.categoryButtons[i].handleLeave();
                                  }
                              } },
            removeFavorite: (id) => this.appFavorites.removeFavorite(id)  });
        //createMenu
        this.orientation = orientation;
        this.menuManager = new PopupMenuManager(this);
        this.menu = new AppletPopupMenu(this, this.orientation);
        this.menuManager.addMenu(this.menu);
        this.menu.setCustomStyleClass('menu-background');

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
        //this.signals.connect(global, 'scale-changed', () => this.state.set({menuHeight: 0}));

        this.categoryButtons = [];
        this.knownApps = [];
        this.applicationsByCategory = {};
        this.allItems = [];
        this.activeContainer = null;
        this.placesManager = null;
        this.lastRenderTime = 0;

        //this.session = new SessionManager();
        this.screenSaverProxy = new ScreenSaverProxy();
        this.recentManager = getDocManager();

        this.init = true;

        // Init settings
        this.loadSettings();
        this.initCategories();
        this.state.set({ isListView: this.state.settings.applicationsViewMode === ApplicationsViewModeLIST,
                         fallbackDescription: (this.state.settings.descriptionPlacement != PlacementNONE) ?
                                                                        _('No description available') : '' });
        global.settings.connect('changed::enabled-search-providers',
                                                    (...args) => this.onEnabledSearchProvidersChange(...args));

        this.onEnableBookmarksChange(this.state.settings.enableBookmarks, true);
        this.updateIconAndLabel();
        this.updateActivateOnHover();
        this.updateKeybinding();
    }

    getGridWidth() {
        if (!this.state) return 0;
        //size grid so that column widths are slightly wider when there are fewer columns
        let width = (this.state.settings.appsGridColumnCount * 130 + 80) * global.ui_scale;
        //ensure column width is a integer.
        width = Math.round(width / this.state.settings.appsGridColumnCount) * this.state.settings.appsGridColumnCount;
        return width;
    }

    loadSettings() {
        if (this.settings) {
            this.settings.finalize();
            this.state.settings = {};
        }
        this.settings = new AppletSettings(this.state.settings, __meta.uuid, this.instance_id);
        this.bindSettingsChanges();
    }

    on_applet_reloaded() {
        if (!this.state) {
            return;
        }
    }

    on_orientation_changed(orientation) {
        this.orientation = orientation;
        if (this.orientation === St.Side.LEFT || this.orientation === St.Side.RIGHT) {
            this.hide_applet_label(true);
        } else {
            this.hide_applet_label(false);
        }
        this.state.panelLocation = this._panelLocation;
        this.updateIconAndLabel();
        this.refresh();
        this.vectorBox = null;
    }

    on_applet_added_to_panel() {
        if (!this.state) {
            return;
        }
        this.appletReady = true;
    }

    on_applet_removed_from_panel() {
        this.willUnmount = true;
        Main.keybindingManager.removeHotKey('overlay-key-' + this.instance_id);
        if (!this.settings) {
            return;
        }
        this.settings.finalize();
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
                    const instance = this.getOtherInstance();
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
                } else if (GLib.path_is_absolute(this.state.settings.menuIcon) &&
                                    GLib.file_test(this.state.settings.menuIcon, GLib.FileTest.EXISTS)) {
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
                this.set_applet_icon_path(__meta.path + '/icon.png');
                /*let iconName = global.settings.get_string('app-menu-icon-name');*/
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

    openMenu() {
        if (!this._applet_context_menu.isOpen) {
            this.menu.open(this.state.settings.enableAnimation);
        }
    }

    updateActivateOnHover(activate = true) {
        if (this.state.settings.activateOnHover && activate) {
            this.signals.connect(this.actor, 'enter-event', () => {
                        setTimeout(() => this.openMenu(), this.state.settings.hoverDelayMs); });
        } else if (this.signals.isConnected('enter-event', this.actor)) {
            this.signals.disconnect('enter-event', this.actor);
        }
    }

    onFavoritesChanged() {
        this.favorites = this.appFavorites.getFavorites();
        // Check if the menu has been rendered at least once
        if (this.applicationsGridBox && this.applicationsListBox) {
            this.switchApplicationsView(true);
        }
        this.powerGroupBox.populate(this.listApplications('favorites',''));

        Mainloop.idle_add_full(150, () => {
                if (this.state.dragIndex > -1) {
                    const button = find(this.allItems, (item) => item.buttonState.appIndex === this.state.dragIndex);
                    if (button) {
                        this.scrollToButton(button);
                    }
                    this.state.set({dragIndex: -1});
                } });
    }

    onIconsChanged() {
        if (!this.state || !this.appletReady) {
            return;
        }
        this.refresh();
    }

    onThemeChanged() {
        this.updateIconAndLabel();
        this.introspectTheme();
        setTimeout(() => this.refresh(), 0);
    }

    searchProviderChange(provider) {
        return function onProviderChange() {
            const enabledProviders = global.settings.get_strv('enabled-search-providers');
            const providerIndex = enabledProviders.indexOf(provider);
            if (this.state.settings[provider] && providerIndex === -1) {
                enabledProviders.push(provider);
            } else {
                enabledProviders.splice(providerIndex, 1);
            }
            global.settings.set_strv('enabled-search-providers', enabledProviders);
        };
    }

    onEnabledSearchProvidersChange() {
        const enabledProviders = global.settings.get_strv('enabled-search-providers');
        if (enabledProviders.length === 0) return;
        this.state.set({enabledProviders});
        // Synchronize search provider settings
        for (let i = 0; i < this.knownProviders.length; i++) {
            this.state.settings[this.knownProviders[i]] = enabledProviders.indexOf(this.knownProviders[i]) > -1;
        }
    }

    updateMenuHeight() {
        let height;
        const monitorHeight = Main.layoutManager.monitors[this.panel.monitorIndex].height;
        const [toppanelHeight,bottompanelHeight] = heightsUsedMonitor(this.panel.monitorIndex, Main.panelManager.panels);
        const customHeightLimit = monitorHeight - toppanelHeight - bottompanelHeight;
        //let customHeightLimit = monitorHeight - 120;
        const {enableCustomMenuHeight} = this.state.settings;

        if (enableCustomMenuHeight) {
            height = Math.min(this.state.settings.customMenuHeight * global.ui_scale, customHeightLimit);
        } else {
            height = this.categoriesBox.height + this.bottomPane.height;
            if (height >= customHeightLimit) {
                height = Math.round(Math.abs(monitorHeight * 0.55));
            }
        }
        //this.mainBox.height = height;
        this.groupCategoriesWorkspacesScrollBox.height = height;
        this.applicationsScrollBox.height = height;
        this.actor.style += `max-height: ${height}px`;
        this.applyConstraints();
    }

    applyConstraints() {
        const searchWidth = this.searchBox.width - this.categoriesBox.width;
        this.searchEntry.width = searchWidth > 0 ? searchWidth : this.searchEntry.width;

        this.actor.style += `max-width: ${this.mainBox.width}px; max-height: ${this.mainBox.height}px;`;
        this.groupCategoriesWorkspacesScrollBox.style += `max-width: ${this.categoriesBox.width}px;`;
        this.categoriesOverlayBox.style += `max-width: ${this.categoriesBox.width}px;`;
        this.categoriesBox.style += `max-width: ${this.categoriesBox.width}px;`;
        //this.bottomPane.width = this.middlePane.width;
    }

    getExampleSearchProviders() {
        spawnCommandLine('xdg-open https://github.com/linuxmint/Cinnamon/tree/master/docs/search-providers-examples');
    }

    // =======================================================================
    bindSettingsChanges() {
        const settingsProps = [
            { key: 'categories',                value: 'categories',            cb: null },//?undo
            { key: 'applications-view-mode',    value: 'applicationsViewMode',  cb: this.refresh },
            { key: 'description-placement',     value: 'descriptionPlacement',  cb: this.refresh },
            { key: 'powergroup-placement',      value: 'powergroupPlacement',   cb: this.refresh },
            { key: 'add-favorites',             value: 'addFavorites',          cb: this.refresh },
            { key: 'enable-custom-menu-height', value: 'enableCustomMenuHeight',cb: this.updateMenuHeight },
            { key: 'custom-menu-height',        value: 'customMenuHeight',      cb: this.updateMenuHeight },
            { key: 'apps-grid-column-count',    value: 'appsGridColumnCount',   cb: this.refresh },

            { key: 'show-places',               value: 'showPlaces',            cb: this.onEnablePlacesChange },
            { key: 'enable-bookmarks',          value: 'enableBookmarks',       cb: this.onEnableBookmarksChange },

            { key: 'overlay-key',               value: 'overlayKey',            cb: this.updateKeybinding },
            { key: 'activate-on-hover',         value: 'activateOnHover',       cb: this.updateActivateOnHover },
            { key: 'hover-delay',               value: 'hoverDelayMs',
                            cb: () => { this.updateActivateOnHover(false);
                                        this.updateActivateOnHover(true); } },
            { key: 'enable-animation',          value: 'enableAnimation',       cb: null },

            { key: 'category-click',            value: 'categoryClick',         cb: null },
            { key: 'enable-autoscroll',         value: 'enableAutoScroll',      cb: this.refresh },
            { key: 'search-filesystem',         value: 'searchFilesystem',      cb: this.refresh },
            { key: 'enable-search-providers',   value: 'enableSearchProviders', cb: null },

            { key: 'menu-icon-custom',          value: 'menuIconCustom',        cb: this.updateIconAndLabel },
            { key: 'menu-icon',                 value: 'menuIcon',              cb: this.updateIconAndLabel },
            { key: 'menu-label',                value: 'menuLabel',             cb: this.updateIconAndLabel },

            { key: 'show-category-icons',       value: 'showCategoryIcons',     cb: this.refresh },
            { key: 'category-icon-size',        value: 'categoryIconSize',      cb: this.refresh },
            { key: 'show-application-icons',    value: 'showApplicationIcons',  cb: this.refresh },
            { key: 'apps-list-icon-size',       value: 'appsListIconSize',      cb: this.refresh },
            { key: 'apps-grid-icon-size',       value: 'appsGridIconSize',      cb: this.refresh },

        ];

        for (let i = 0; i < this.knownProviders.length; i++) {
            const provider = this.knownProviders[i];
            settingsProps.push({ key: provider,
                                 value: provider,
                                 cb: this.searchProviderChange(provider) });
        }

        for (let i = 0, len = settingsProps.length; i < len; i++) {
            this.settings.bind(
                      settingsProps[i].key,
                      settingsProps[i].value,
                      settingsProps[i].cb ? (...args) => settingsProps[i].cb.call(this, ...args) : null );
        }
    }

    introspectTheme() {
        const appletMenuThemeNode = this.menu.actor.get_theme_node();
        this.state.set({
                theme: { // TODO: Find a proper class for button app state dots
                      foregroundColor: appletMenuThemeNode.get_foreground_color().to_string().substring(0, 7)
                       } });
    }

    onOpenStateToggled(menu, open) {
        if (global.settings.get_boolean('panel-edit-mode')) {
            return false;
        }
        if (open) {
            if (!this.displayed) {
                this.display();
            }
            // Set Category
            this.categoriesBox.show();
            // Load Startup Applications category
            this.switchApplicationsView(false);
            // Display startup apps
            this.resetDisplayState();
            //this.state.trigger('menuOpened');
            this.mainBox.show();
            // Do height/constraint adjustments after actors are rendered and on the stage.
            this.updateMenuHeight();
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
        this.recentEnabled = this.privacy_settings.get_boolean(REMEMBER_RECENT_KEY);
        this.refresh();
    }

    onEnablePlacesChange() {
        this.refresh();
    }

    onEnableBookmarksChange(enableBookmarks, fromInit = false) { //web bookmarks
        if (enableBookmarks) {
            this.bookmarksManager = new BookmarksManager(this.appSystem);
        } else if (this.bookmarksManager) {
            this.bookmarksManager = null;
        }
        if (!fromInit) {
            this.refresh();
        }
    }

    refresh() {
        // TBD: For some reason the onEnable* settings callbacks get called several times per settings change,
        // This is causing the start up category to reset, so throttling this function to 250ms prevents excess invocation.
        const now = Date.now();
        if ((now - this.lastRenderTime) <= 250) return;
        this.lastRenderTime = now;

        this.clearAll();
        this.destroyDisplayed();
        this.displayed = false;
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
        const buttons = [];
        const children = this.activeContainer.get_children();
        for (let i = 0; i < children.length; i++) {
            buttons.push( find( this.allItems,
                                function(button) { return button && button.actor === children[i]; } ) );
        }
        return buttons;
    }

    /*//?undo
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
    getVectorInfo(buttonHeight) {//?undo
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

    makeVectorBox(actor) {//?undo
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
                                      this.vectorBox.set_reactive(false); });
            this.draggableVectorBoxId = this.draggableVectorBox.connect('drag-begin', () => {
                                      if (!this.vectorBox) return;
                                      this.vectorBox.set_reactive(false);
                                      this.vectorBox.hide(); });
        } else {
            this.vectorBox._delegate = actor._delegate;
            if (!this.vectorBox.reactive) this.vectorBox.set_reactive(true);
            if (!this.vectorBox.visible) this.vectorBox.show();
            let keys = Object.keys(config);
            for (let i = 0; i < keys.length; i++) {
                this.vectorBox[keys[i]] = config[keys[i]];
            }
        }
    }

    loadAppCategories(dir, rootDir, dirId) {
        const iter = dir.iter();
        let nextType;
        while ((nextType = iter.next()) !== CMenu.TreeItemType.INVALID) {
            if (nextType === CMenu.TreeItemType.ENTRY) {
                const entry = iter.get_entry();
                if (!entry.get_app_info().get_nodisplay()) {
                    const id = entry.get_desktop_file_id();
                    const app = this.appSystem.lookup_app(id);
                    if (rootDir && typeof rootDir.get_menu_id === 'function') {
                        const rootDirId = rootDir.get_menu_id();
                        if (rootDirId) {
                            this.applicationsByCategory[rootDirId].push(app);
                        }
                    } else {
                        if (dirId) {
                            this.applicationsByCategory[dirId].push(app);
                        }
                    }
                    const appIsKnown = this.knownApps.indexOf(id) > -1;
                    if (!appIsKnown) {
                        if (!this.isNewInstance) {
                            app.shouldHighlight = true;
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
    }

    resetCategoryOrder() {//?undo
        if (!this.categoriesBox) {
            return;
        }
        this.categoriesBox.remove_all_children();
        this.state.settings.categories = [];
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

        const dirs = [];
        const iter = this.appSystem.get_tree().get_root_directory().iter();
        let nextType;
        while ((nextType = iter.next()) !== CMenu.TreeItemType.INVALID) {
            if (nextType === CMenu.TreeItemType.DIRECTORY) {
                dirs.push(iter.get_directory());
            }
        }
        dirs.sort(function(a, b) {
                        const prefCats = ['administration', 'preferences'];
                        const prefIdA = prefCats.indexOf(a.get_menu_id().toLowerCase());
                        const prefIdB = prefCats.indexOf(b.get_menu_id().toLowerCase());
                        if (prefIdA < 0 && prefIdB >= 0) return -1;
                        if (prefIdA >= 0 && prefIdB < 0) return 1;
                        const nameA = a.get_name().toLowerCase();
                        const nameB = b.get_name().toLowerCase();
                        return (nameA > nameB) ? 1 : ( (nameA < nameB) ? -1 : 0 );  });
        for (let z = 0, len = dirs.length; z < len; z++) {
            const dir = dirs[z];
            if (dir.get_is_nodisplay()) {
                continue;
            }
            const dirId = dir.get_menu_id();
            this.applicationsByCategory[dirId] = [];
            this.loadAppCategories(dir, null, dirId);
            if (this.applicationsByCategory[dirId].length > 0) {
                if (isReRender) {
                    const button = find(this.categoryButtons, button => button.id === dirId);
                    if (!button) {
                        continue;
                    }
                    buttons.push(button);
                } else {
                    buttons.push(new CategoryListButton(this.state, dir, dirId));
                }
            }
        }
        const params = [
            [this.state.settings.showPlaces, 'places', _('Places'), 'folder'],
            [this.recentEnabled, 'recent', _('Recent Files'), 'folder-recent'],
            [this.state.settings.enableBookmarks, 'bookmarks', _('Bookmarks'), 'user-bookmarks'],
            [true, 'favorites', _('Favorite Apps'), 'emblem-favorite'] ];
        for (let i = 0; i < params.length; i++) {
            if (!params[i][0]) {
                continue;
            }
            if (isReRender) {
                const button = find(this.categoryButtons, button => button.id === params[i][1]);
                if (!button) {
                    continue;
                }
                buttons.push(button);
            } else { // TODO: Use spread operator after versioning for 3.8
                buttons.push(new CategoryListButton( this.state, params[i][1], params[i][2], params[i][3] ));
            }
        }
        //?undo
        if (this.state.settings.categories.length === 0) {
            this.state.settings.categories = map(buttons, (button) => button.id);
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
        }//?undo
        /*
        this.categoryButtons = [];
        for (let i = 0; i < buttons.length; i++) {
            buttons[i].index = i;
            this.categoryButtons.push(buttons[i]);
        }
        */
        buttons = undefined;
    }

    buildCategories() {
        if (this.categoryButtons.length > 0) {
            this.categoriesBox.remove_all_children();
            this.initCategories(true);
        }
        each(this.categoryButtons, (button) => this.categoriesBox.add_actor(button.actor));
    }

    setActiveCategoryStyle() {
        const {currentCategory} = this.state;
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
        const places = this.listPlaces()
                                .concat(this.listBookmarks())
                                .concat(this.listDevices());
        this.displayApplications(places);
    }

    switchApplicationsView(fromToggle) {
        const isListView = this.state.settings.applicationsViewMode === ApplicationsViewModeLIST;
        let iconSize;
        if (isListView) {
            iconSize = this.state.settings.appsListIconSize > 0 ? this.state.settings.appsListIconSize : 28;
        } else {
            iconSize = this.state.settings.appsGridIconSize > 0 ? this.state.settings.appsGridIconSize : 64;
        }
        this.state.set({  isListView: isListView,
                          iconSize: iconSize });
        if (isListView) {
            this.applicationsGridBox.width = this.applicationsListBox.width;
            this.applicationsGridBox.hide();
            this.applicationsListBox.show();
        } else {
            this.applicationsGridBox.width = this.getGridWidth();
            this.applicationsListBox.hide();
            this.applicationsGridBox.show();
        }
        // switch activeContainer
        if (this.activeContainer === this.applicationsListBox || this.activeContainer === this.applicationsListBox) {
            // reset active container
            this.activeContainer = isListView ? this.applicationsListBox : this.applicationsGridBox;
            // reset scroll to top
            const vscroll = this.applicationsScrollBox.get_vscroll_bar();
            const newScrollValue = this.applicationsScrollBox.get_allocation_box().y1;
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
        const adjustment = this.applicationsScrollBox.get_vscroll_bar().get_adjustment();
        const currentScrollValue = adjustment.get_value();
        const boxHeight = this.applicationsScrollBox.get_allocation_box().y2 -
                                                        this.applicationsScrollBox.get_allocation_box().y1;
        const allocationBox = button.actor.get_allocation_box();
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
                global.logWarning('Cinnamenu: Unable to find scrollbox for', button.actor.toString());
                return false;
            }
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
            const vfade = scrollBox.get_effect('fade');
            if (vfade) {
                offset = vfade.vfade_offset;
            }
            const box = button.actor.get_allocation_box();
            let y1 = box.y1, y2 = box.y2;
            let parent = button.actor.get_parent();
            while (parent !== scrollBox) {
                if (!parent) {
                    return false;
                }
                const box = parent.get_allocation_box();
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
            addTween(adjustment, { value: value, time: 0.1, transition: 'easeOutQuad' });
        } else {
            adjustment.set_value(value);
        }
    }

    clearEnteredActors() {
        this.activeContainer = this.state.isListView ? this.applicationsListBox : this.applicationsGridBox;
        let buttons = this.getActiveButtons();
        const refItemIndex = findIndex(buttons, (button) => {
                    return (button.actor.has_style_class_name('menu-application-button-selected') ||
                                                            button.entered != null || button.menu.isOpen); });
        if (refItemIndex > -1 && buttons[refItemIndex]) {
            if (buttons[refItemIndex].menu.isOpen) {
                buttons[refItemIndex].closeMenu();
            }
            buttons[refItemIndex].handleLeave();
        }
        this.powerGroupBox.clearEnteredActors();
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

    listPlaces(pattern) {
        if (!this.placesManager || !this.state.settings.showPlaces) {
            return [];
        }
        let places = this.placesManager.places.special;
        let res = [];
        for (let i = 0, len = places.length; i < len; i++) {
            let match;
            if (pattern) {
                match = searchStr(pattern, places[i].name, " ", true);
            }
            if (!pattern || match.score > SEARCH_THRESHOLD) {
                places[i].type = ApplicationType._places;
                places[i].description = places[i].file.get_path();
                if (pattern) {
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
        for (let i = 0, len = bookmarks.length; i < len; i++) {
            let match;
            if (pattern) {
                match = searchStr(pattern, bookmarks[i].name, " ", true);
            }
            if (!pattern || match.score > SEARCH_THRESHOLD) {
                bookmarks[i].type = ApplicationType._places;
                bookmarks[i].description = bookmarks[i].file.get_path();
                if (pattern) {
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
        for (let i = 0, len = devices.length; i < len; i++) {
            let match;
            if (pattern) {
                match = searchStr(pattern, devices[i].name, " ", true);
            }
            if (!pattern || match.score > SEARCH_THRESHOLD) {
                devices[i].type = ApplicationType._places;
                devices[i].description = devices[i].file.get_path();
                if (pattern) {
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
        if (!this.searchWebErrorsShown && !Gda) {
            this.answerText.set_text(_('gir1.2-gda-5.0 package required for Firefox and Midori bookmarks.'));
            this.answerText.show();
        } else if (this.answerText.is_visible()) {
            this.answerText.hide();
        }

        this.searchWebErrorsShown = true;

        let res = [];
        let arr = this.bookmarksManager.state;
        let arrKeys = this.bookmarksManager.arrKeys;

        for (let i = 0, len = arrKeys.length; i < len; i++ ) {
            let bookmark = arr[arrKeys[i]];
            if (!bookmark) {
                continue;
            }
            if (pattern && bookmark.name) {
                let match = searchStr(pattern, bookmark.name, " ", true);
                if (match.score > SEARCH_THRESHOLD) {
                    bookmark.score = match.score;
                    bookmark.name = match.result;
                    res.push(bookmark);
                }
            }
            if (!pattern) {
                res.push(bookmark);
            }
        }
        return res;
    }

    listRecent(pattern) {
        if (!this.recentEnabled) {
            return [];
        }
        let {_infosByTimestamp} = this.recentManager;
        let res = [];

        for (let i = 0, len = _infosByTimestamp.length; i < len; i++) {
            let recentInfo = _infosByTimestamp[i];
            res.push({  name: recentInfo.name,
                        icon: recentInfo.gicon,
                        uri: recentInfo.uri,
                        description: recentInfo.uriDecoded,
                        type: ApplicationType._recent });
        }

        if (res.length > 0  && !pattern) {
            res.push({  name: _('Clear List'),
                        clearList: true,
                        icon: new St.Icon({ icon_name: 'edit-clear', icon_type: St.IconType.SYMBOLIC }),
                        uri: '',
                        description: '',
                        type: ApplicationType._recent });
        } else if (!pattern) {
            this.answerText.set_text(_('No recent documents'));
            this.answerText.show();
        }

        if (pattern) {
            let _res = [];
            for (let i = 0, len = res.length; i < len; i++) {
                let recentItem = res[i];
                let match = searchStr(pattern, recentItem.name, " ", true);
                if (recentItem.name && match.score > SEARCH_THRESHOLD) {
                    recentItem.score = match.score;
                    recentItem.name = match.result;
                    _res.push(recentItem);
                }
            }
            res = _res;
        }
        return res;
    }

    listApplications(categoryMenuId, pattern) {
        let res = [];

        if (categoryMenuId === 'favorites') {
            res = this.favorites;
        } else {
            if (categoryMenuId && categoryMenuId !== 'all') {
                res = this.applicationsByCategory[categoryMenuId];
            } else {
                let keys = Object.keys(this.applicationsByCategory);
                for (let i = 0; i < keys.length; i++) {
                    res = res.concat(this.applicationsByCategory[keys[i]]);
                }
            }
        }

        if (pattern) {
            let _res = [];
            for (let i = 0, len = res.length; i < len; i++) {
                let name = res[i].get_name();
                let keywords = res[i].get_keywords();
                Object.assign(res[i], {   name: name,
                                          keywords: keywords || name,
                                          description: res[i].get_description(),
                                          id: res[i].get_id().replace(/\.desktop$/, ''),
                                          type: ApplicationType._applications });
                const match1 = searchStr(pattern, res[i].name, " ", true);
                const match2 = searchStr(pattern, res[i].description, " ", true);
                const match3 = searchStr(pattern, res[i].keywords, ";", false);
                if (match3.score < 0.7) {match3.score = 0;} //ignore keyword match if it's not an almost exact match
                const match4 = searchStr(pattern, res[i].id, ".", false);
                if (match4.score < 0.7) {match4.score = 0;} //ignore id match if it's not an almost exact match
                const bestMatchScore = Math.max(match1.score,match2.score,match3.score,match4.score);
                if (bestMatchScore > SEARCH_THRESHOLD) {
                    res[i].score = bestMatchScore;
                    res[i].name = match1.result;
                    res[i].description = match2.result;
                    _res.push(res[i]);
                }
            }
            res = _res;
            _res = null;
        }

        // Ignore favorites when sorting
        if (categoryMenuId !== 'favorites' && res === undefined) {
            res = [];
        }
        //global.log(JSON.stringify(res, null, 1));

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
        //global.log(JSON.stringify(res,null,1));

        res = undefined;
        return items;
    }

    resetDisplayState() {
        let {currentCategory} = this.state;
        this.resetSearch();
        if (currentCategory === 'bookmarks') {
            this.answerText.set_text(_('Please wait...'));
        }
        this.answerText.show();
        this.state.set({currentCategory: currentCategory}, true);
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

        const powerGroupButtons = this.powerGroupBox.getButtons();

        let ctrlKey = modifierState & Clutter.ModifierType.CONTROL_MASK || symbol === 65507 || symbol === 65508;

        let buttons = this.getActiveButtons();
        let refItemIndex = findIndex(buttons, (button) => {
            return (button.actor.has_style_class_name('menu-application-button-selected') ||
                                                        button.entered != null || button.menu.isOpen);  });

        let refCategoryIndex = findIndex(this.categoryButtons, (button) => {
                                                            return button.entered != null; });
        if (refCategoryIndex < 0) {
            refCategoryIndex = findIndex(this.categoryButtons, (button) => {
                                              return this.state.currentCategory === button.id; });
        }

        let refPowerGroupItemIndex = findIndex(powerGroupButtons, (button) => {
                                                                  return button.entered != null; });

        let enteredItemExists = refItemIndex > -1 && buttons[refItemIndex] != null;
        let enteredCategoryExists = refCategoryIndex > -1 && this.categoryButtons[refCategoryIndex] != null;
        let enteredPowerGroupItemExists = refPowerGroupItemIndex > -1 && powerGroupButtons[refPowerGroupItemIndex] != null;

        let enteredContextMenuItemExists = false;
        let contextMenuChildren = [];
        let refContextMenuItemIndex = -1;

        if (enteredItemExists) {
            if (buttons[refItemIndex].menu.isOpen && buttons[refItemIndex].menu.box) {
                contextMenuChildren = buttons[refItemIndex].contextMenuButtons;
                refContextMenuItemIndex = findIndex(contextMenuChildren, (button) => {
                                              return button.actor.has_style_pseudo_class('active'); });
                enteredContextMenuItemExists = refContextMenuItemIndex > -1 &&
                                                        contextMenuChildren[refContextMenuItemIndex] != null;
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
            powerGroupButtons[refPowerGroupItemIndex].handleLeave();
        }
        let startingCategoryIndex = findIndex(this.categoryButtons, (button) => {
                                                  return this.state.currentCategory === button.id; });
        //startingCategoryIndex = ( this.state.settings.enableBookmarks && startingCategoryIndex <= 0 ) ?
        //                                                                            1 : startingCategoryIndex;
        if (startingCategoryIndex < 0) {
            startingCategoryIndex = 0;
        }
        //global.log("refContextMenuItemIndex: "+refContextMenuItemIndex+" refItemIndex:"+refItemIndex+
        //        " refCategoryIndex:"+refCategoryIndex+" refPowerGroupItemIndex:"+refPowerGroupItemIndex);
        const nextPowerGroupItem = () => {
            if (refPowerGroupItemIndex < powerGroupButtons.length - 1) {
                    powerGroupButtons[refPowerGroupItemIndex + 1].handleEnter();
            } else {
                powerGroupButtons[0].handleEnter();
            }
        };

        const previousPowerGroupItem = () => {
            if (refPowerGroupItemIndex === 0) {
                    powerGroupButtons[powerGroupButtons.length -1].handleEnter();
            } else {
                powerGroupButtons[refPowerGroupItemIndex - 1].handleEnter();
            }
        };

        const leftNavigation = () => {
            if (enteredContextMenuItemExists) {
                contextMenuChildren[refContextMenuItemIndex].handleEnter();//Ignore
            } else if (enteredPowerGroupItemExists) {
                if (this.state.settings.powergroupPlacement === 2 ||  //left or right
                                                        this.state.settings.powergroupPlacement === 3) {
                    this.categoryButtons[startingCategoryIndex].handleEnter();
                } else {
                    previousPowerGroupItem();
                }
            } else if (enteredItemExists) {
                if (buttons[refItemIndex].menu.isOpen) {
                    buttons[refItemIndex].handleEnter();//ignore
                } else if (this.state.isListView) {
                    this.categoryButtons[startingCategoryIndex].handleEnter();
                } else {
                    if (refItemIndex > 0) {
                        buttons[refItemIndex - 1].handleEnter();
                    } else {
                        buttons[buttons.length - 1].handleEnter();
                    }
                }
            } else if (enteredCategoryExists) {
                powerGroupButtons[0].handleEnter();
            }
        };

        const rightNavigation = () => {
            if (enteredContextMenuItemExists) {
                contextMenuChildren[refContextMenuItemIndex].handleEnter();//Ignore
            } else if (enteredPowerGroupItemExists) {
                if (this.state.settings.powergroupPlacement === 2 ||
                                                            this.state.settings.powergroupPlacement === 3) {
                    this.categoryButtons[startingCategoryIndex].handleEnter();
                } else {
                    nextPowerGroupItem();
                }
            } else if (enteredItemExists) {
                if (buttons[refItemIndex].menu.isOpen) {
                    buttons[refItemIndex].handleEnter();//ignore
                } else if (this.state.isListView) {
                    buttons[refItemIndex].handleEnter();//ignore
                } else {
                    if (buttons[refItemIndex + 1]) {
                        buttons[refItemIndex + 1].handleEnter();
                    } else {
                        buttons[0].handleEnter();
                    }
                }
            } else if (enteredCategoryExists) {
                buttons[0].handleEnter();
            }
        };

        const downNavigation = () => {
            if (enteredContextMenuItemExists) {
                if (contextMenuChildren[refContextMenuItemIndex + 1]) {
                    contextMenuChildren[refContextMenuItemIndex + 1].handleEnter();
                } else {
                    contextMenuChildren[0].handleEnter();
                }
            } else if (enteredPowerGroupItemExists) {
                if (this.state.settings.powergroupPlacement === 0 ||
                                                        this.state.settings.powergroupPlacement === 1) {
                    this.categoryButtons[startingCategoryIndex].handleEnter();
                } else {
                    nextPowerGroupItem();
                }
            } else if (enteredItemExists) {
                if (buttons[refItemIndex].menu.isOpen) {
                        contextMenuChildren[0].handleEnter();
                } else if (this.state.isListView) {
                    if (buttons[refItemIndex + 1]) {
                        buttons[refItemIndex + 1].handleEnter();
                    } else {
                        buttons[0].handleEnter();
                    }
                } else {//grid view
                    if (buttons[refItemIndex + this.state.settings.appsGridColumnCount]) {
                        buttons[refItemIndex + this.state.settings.appsGridColumnCount].handleEnter();
                    } else {
                        buttons[buttons.length - 1].handleEnter();
                    }
                }
            } else if (enteredCategoryExists) {
                if (this.categoryButtons[refCategoryIndex + 1]) {
                    this.categoryButtons[refCategoryIndex + 1].handleEnter();
                } else {
                    this.categoryButtons[0].handleEnter();
                }
            }
        };

        const upNavigation = () => {
            if (enteredContextMenuItemExists) {
                if (refContextMenuItemIndex > 0) {
                    contextMenuChildren[refContextMenuItemIndex - 1].handleEnter();
                } else {
                    contextMenuChildren[contextMenuChildren.length - 1].handleEnter();
                }
            } else if (enteredPowerGroupItemExists) {
                if (this.state.settings.powergroupPlacement === 0 ||
                                                        this.state.settings.powergroupPlacement === 1) {
                    this.categoryButtons[startingCategoryIndex].handleEnter();
                } else {
                    previousPowerGroupItem();
                }
            } else if (enteredItemExists) {
                if (buttons[refItemIndex].menu.isOpen) {
                        contextMenuChildren[contextMenuChildren.length - 1].handleEnter();
                } else if (this.state.isListView) {
                    if (refItemIndex > 0) {
                        buttons[refItemIndex - 1].handleEnter();
                    } else {
                        buttons[buttons.length - 1].handleEnter();
                    }
                } else {
                    if (buttons[refItemIndex - this.state.settings.appsGridColumnCount]) {
                        buttons[refItemIndex - this.state.settings.appsGridColumnCount].handleEnter();
                    } else {
                        buttons[0].handleEnter();
                    }
                }
            } else if (enteredCategoryExists) {
                if (refCategoryIndex > 0) {
                    this.categoryButtons[refCategoryIndex - 1].handleEnter();
                } else {
                    this.categoryButtons[this.categoryButtons.length - 1].handleEnter();
                }
            }
        };

        const tabNavigation = () => {
            if (enteredItemExists) {
                powerGroupButtons[0].handleEnter();
            } else if (enteredPowerGroupItemExists && !this.state.searchActive) {
                this.categoryButtons[startingCategoryIndex].handleEnter();
            } else {
                buttons[0].handleEnter();
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
                powerGroupButtons[refPowerGroupItemIndex].handleButtonRelease();
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
                    powerGroupButtons[0].handleEnter();
                }
                return true;
            case symbol === Clutter.KEY_Page_Down:
                if (enteredItemExists) {
                    buttons[buttons.length - 1].handleEnter();
                } else if (enteredCategoryExists) {
                    this.categoryButtons[this.categoryButtons.length - 1].handleEnter();
                } else if (enteredPowerGroupItemExists) {
                    powerGroupButtons[powerGroupButtons.length - 1].handleEnter();
                }
                return true;
            case symbol === Clutter.KEY_Right:
                rightNavigation();
                return true;
            case symbol === Clutter.KEY_Left:
                leftNavigation();
                return true;
            case symbol === Clutter.ISO_Left_Tab:
            case symbol === Clutter.Tab:
                if (modifierState === 8) { //Alt-Tab was pressed. Close menu as alt-tab is used for app-switcher in cinnamon
                    this.state.trigger('closeMenu');
                    return false;
                }
                tabNavigation();
                return true;
            case symbol === Clutter.KEY_Escape:
            case symbol === Clutter.Escape:
                if (enteredItemExists && buttons[refItemIndex].menu.isOpen) {
                    buttons[refItemIndex].toggleMenu();
                    buttons[refItemIndex].handleEnter()
                    return true;
                }
                this.menu.close();
                return true;
            case ctrlKey: //??
                if (enteredItemExists) {
                    buttons[refItemIndex].handleEnter();
                }
                return true;
            default:
            return false;
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
                                        };  });
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
        this.state.set({ searchActive: false });
        if (this.activeContainer) {
            this.activeContainer.show();
        }
        if (!this.activeContainer) {
            this.activeContainer = this.state.settings.applicationsViewMode === ApplicationsViewModeLIST ?
                                                               this.applicationsListBox : this.applicationsGridBox;
        }

        // Since we don't want to monitor which windows need added or removed like a window list applet,
        // they are queried as needed during searches, so we're cleaning them up, along with any
        // search provider results, if enabled.
        let allItems = [];
        for (let i = 0; i < this.allItems.length; i++) {
            if (!this.allItems[i]) {
              continue;
            }
            if (this.state.settings.enableSearchProviders &&
                                        this.allItems[i].buttonState.appType === ApplicationType._providers) {
                this.allItems[i].destroy(true);
                this.allItems[i] = undefined;
            } else {
                this.allItems[i].clearSearchFormatting();
                allItems.push(this.allItems[i]);
            }
        }
        this.allItems = allItems;
        global.stage.set_key_focus(this.searchEntry);
    }

    onSearchTextChanged() {
        const searchText = this.searchEntryText.get_text();

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
                this.signals.connect(this.searchEntry, 'secondary-icon-clicked', () => {
                                                            this.clearEnteredActors();
                                                            this.searchEntryText.set_text('');
                                                            this.onSearchTextChanged();
                                                            //this.resetDisplayState
                                                            }, this);
            }
        } else {
            if (this.signals.isConnected('secondary-icon-clicked', this.searchEntry)) {
                this.signals.disconnect('secondary-icon-clicked', this.searchEntry, this);
            }

            this.searchEntry.set_secondary_icon(null);
        }
        //setTimeout(() => this.doSearch(searchText), 0);
        this.doSearch(searchText);
    }

    doSearch(text) {
        if (!text || !text.trim()) return;
        let pattern = latinise(text.trim().toLowerCase());

        /*if (pattern === this.previousSearchPattern) {
            return false;
        }
        this.previousSearchPattern = pattern;*/

        let acResults = []; // search box autocompletion results
        if (this.state.settings.searchFilesystem) {
            // Don't use the pattern here, as filesystem is case sensitive
            acResults = this.getCompletions(text);
        }
        let results = this.listApplications(null, pattern)
                            .concat(this.listPlaces(pattern))
                            .concat(this.listWebBookmarks(pattern))
                            .concat(this.listRecent(pattern))
                            .concat(acResults);

        if (this.state.settings.enableSearchProviders && this.state.enabledProviders.length > 0 &&
                                                                                  pattern.length > 2) {
            const listSearchProviders = (pattern, cb) => {
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
                                  icon_size: this.state.iconSize });
                        }
                    }
                    cb(results);
                });
            };
            listSearchProviders(pattern, (providerResults) => {
                    // Since the provider results are asynchronous, the search state may have ended by the time they return.
                    if (!this.state.searchActive || !providerResults || providerResults.length === 0)
                        return;
                    results = results.concat(providerResults);
                    });
        }

        results.sort( (a, b) =>  a.score < b.score );

        this.clearApplicationsBox();
        this.displayApplications(results);

        let buttons = this.getActiveButtons();
        if (buttons.length === 0) return;
        buttons[0].handleEnter();

        return false;
    }

    displayApplications(appList) {
        if (!appList) {
            return false;
        }
        /*if (this.mainBox && !this.state.theme) {
			this.introspectTheme();
            this.displayApplications(appList);
            return false;
        }*/

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
                if (this.allItems[i] && (this.allItems[i].buttonState.appType === ApplicationType._places &&
                        this.allItems[i].buttonState.app.name === app || this.allItems[i].buttonState.app === app)) {
                    refAppButton = i;
                    break;
                }
            }
            if (refAppButton > -1 && this.allItems[refAppButton]) {
                appButton = this.allItems[refAppButton];
                appButton.buttonState.set({ app: app,
                                            appType: appType,
                                            appListLength: len,
                                            appIndex: appIndex });
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

        if (!this.state.searchActive && lastApp && !lastApp.clearList && this.state.currentCategory &&
                                                               this.state.currentCategory !== 'favorites') {
            appList.sort( (a, b) => {
                            if (!a.name || !b.name) {
                                return -1;
                            }
                            return (a.name.toLowerCase() > b.name.toLowerCase()) ?
                                            1 : (a.name.toLowerCase() < b.name.toLowerCase()) ? -1 : 0;  });
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
        //this.columnsCount = columnsCount;

        if (this.state.currentCategory === 'bookmarks') this.answerText.hide();
    }

    display() {
		this.introspectTheme();
        this.state.set({ isListView: this.state.settings.applicationsViewMode === ApplicationsViewModeLIST });
        this.displayed = true;
        //==================bottomPane================
        // PowerGroupBox

        const powergroupPlacement = this.state.settings.powergroupPlacement;
        this.powerGroupBox = new PowerGroupBox(this.state);
        this.powerGroupBox.populate(this.listApplications('favorites',''));
        //searchBox
        this.searchInactiveIcon = new St.Icon({ style_class: 'menu-search-entry-icon', icon_name: 'edit-find' });
        this.searchActiveIcon = new St.Icon({ style_class: 'menu-search-entry-icon', icon_name: 'edit-clear' });
        this.searchEntry = new St.Entry({ name: 'menu-search-entry', hint_text: hintText,
                                          track_hover: true, can_focus: true, });
        this.searchEntryText = this.searchEntry.clutter_text;
        this.displaySignals.connect(this.searchEntryText, 'text-changed', (...args) => this.onSearchTextChanged(...args));
        this.displaySignals.connect(this.searchEntryText, 'key-press-event', (...args) => this.onMenuKeyPress(...args));
        this.previousSearchPattern = '';
        this.searchEntry.set_primary_icon(this.searchInactiveIcon);
        this.searchBox = new St.BoxLayout({ style_class: 'menu-search-box',
                                            style: 'padding-right: 7px; min-width: 160px;' });
        this.searchBox.add(this.searchEntry, {  expand: true, x_align: St.Align.START, y_align: St.Align.START });
        // Bottom pane holds power group and search box (packed horizontally)
        this.bottomPane = new St.BoxLayout({ /*style: 'padding-top: 12px;'*/ });
        if (powergroupPlacement === 0 || powergroupPlacement === 1) {//top or bottom
            this.bottomPane.add(this.powerGroupBox.box, { expand: false, x_fill: false, y_fill: false,
                                                  x_align: St.Align.START, y_align: St.Align.MIDDLE });
        }
        this.bottomPane.add(this.searchBox, { expand: true, x_fill: true, y_fill: false,
                                        x_align: St.Align.END, y_align: St.Align.MIDDLE, align_end: true });

        //=================middlePane===============
        // Load Places
        if (PlaceDisplay && this.state.settings.showPlaces) {
            this.placesManager = new PlaceDisplay.PlacesManager(false);
        } else if (this.placesManager) {
            this.placesManager.destroy();
            this.placesManager = null;
        }
        //-------------applicationsScrollBox---------------
        // ApplicationsBox (ListView / GridView)
        this.applicationsListBox = new St.BoxLayout({ style_class: 'cinnamenu-applications-list-box',
                                                      style: 'min-width: 300px;', vertical: true });
        this.applicationsGridBox = new Clutter.Actor({ layout_manager: new Clutter.GridLayout(),
                                                       reactive: true, width: this.getGridWidth() });
        this.answerText = new St.Label({ style_class: 'menu-selected-app-title',
                                         style: 'padding-top: 14px; min-width: 240px; text-align; center;',
                                         text: '', show_on_set_parent: false });
        this.applicationsBoxWrapper = new St.BoxLayout({  style_class: 'menu-applications-inner-box',
                                                    style: 'min-width: 275px', vertical: true, reactive: true });

        this.applicationsBoxWrapper.add(this.answerText, {  x_fill: false, y_fill: false,
                                                            x_align: St.Align.MIDDLE, y_align: St.Align.START });
        this.applicationsBoxWrapper.add(this.applicationsGridBox, { x_fill: false, y_fill: false,
                                                                    x_align: St.Align.START, y_align: St.Align.START });
        this.applicationsBoxWrapper.add(this.applicationsListBox, { x_fill: true, y_fill: false,
                                                                    x_align: St.Align.START, y_align: St.Align.START });
        this.applicationsScrollBox = new St.ScrollView({  x_fill: true, y_fill: false,
                            y_align: St.Align.START, style_class: 'vfade menu-applications-scrollbox' });
        let vscrollApplications = this.applicationsScrollBox.get_vscroll_bar();
        this.displaySignals.connect(vscrollApplications, 'scroll-start', () => { this.menu.passEvents = true; });
        this.displaySignals.connect(vscrollApplications, 'scroll-stop', () => { this.menu.passEvents = false; });
        this.applicationsScrollBox.add_actor(this.applicationsBoxWrapper);
        this.applicationsScrollBox.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC);
        this.applicationsScrollBox.set_auto_scrolling(this.state.settings.enableAutoScroll);
        this.applicationsScrollBox.set_mouse_scrolling(true);
        //------------groupCategoriesWorkspacesScrollBox------------
        // CategoriesBox
        this.categoriesBox = new St.BoxLayout({ style_class: 'menu-categories-box', vertical: true });
        this.categoriesOverlayBox = new St.Widget();
        this.categoriesOverlayBox.add_actor(this.categoriesBox);
        // Build categories
        this.buildCategories();

        // Place boxes in proper containers. The order added determines position
        // groupCategoriesWorkspacesWrapper bin wraps categories and workspaces
        this.groupCategoriesWorkspacesWrapper = new St.BoxLayout({  style_class: 'cinnamenu-categories-workspaces-wrapper',
                                                                    //style: 'max-width: 185px;',
                                                                    vertical: true });
        this.groupCategoriesWorkspacesWrapper.add(this.categoriesOverlayBox, {
                                              x_fill: false, y_fill: true,
                                              x_align: St.Align.START, y_align: St.Align.END,
                                              y_expand: true, expand: false });
        // groupCategoriesWorkspacesScrollBox allows categories or workspaces to scroll vertically
        this.groupCategoriesWorkspacesScrollBox = new St.ScrollView({ x_fill: true, y_fill: false,
                                    y_align: St.Align.START, style_class: 'vfade menu-applications-scrollbox' });

        let vscrollCategories = this.groupCategoriesWorkspacesScrollBox.get_vscroll_bar();
        this.displaySignals.connect(vscrollCategories, 'scroll-start', () => { this.menu.passEvents = true; });
        this.displaySignals.connect(vscrollCategories, 'scroll-stop', () => { this.menu.passEvents = false; });
        this.groupCategoriesWorkspacesScrollBox.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.NEVER);
        this.groupCategoriesWorkspacesScrollBox.set_auto_scrolling(this.state.settings.enableAutoScroll);
        this.groupCategoriesWorkspacesScrollBox.set_mouse_scrolling(true);
        this.groupCategoriesWorkspacesScrollBox.add_actor(this.groupCategoriesWorkspacesWrapper);

        // Middle pane holds categories/places/power, applications, workspaces (packed horizontally)
        this.middlePane = new St.BoxLayout({ style_class: '' });
        if (powergroupPlacement === 2) {//left side
            this.middlePane.add(this.powerGroupBox.box, { expand: false, x_fill: false, y_fill: false,
                                                    x_align: St.Align.START, y_align: St.Align.MIDDLE });
        }
        this.middlePane.add(this.groupCategoriesWorkspacesScrollBox, { x_fill: false, y_fill: false,
                                                    x_align: St.Align.START, y_align: St.Align.START });
        this.middlePane.add(this.applicationsScrollBox, { x_fill: false, y_fill: false,
                                                x_align: St.Align.START, y_align: St.Align.START, expand: true });
        if (powergroupPlacement === 3) {//right side
            this.middlePane.add(this.powerGroupBox.box, { expand: false, x_fill: false, y_fill: false,
                                                    x_align: St.Align.START, y_align: St.Align.MIDDLE });
        }

        //=============mainBox================
        this.mainBox = new St.BoxLayout({ style_class: 'menu-applications-outer-box',
                                        vertical: true,
                                        show_on_set_parent: false }); // menu
        this.mainBox.add_style_class_name('menu-applications-box'); //this is to support old themes
        // mainbox packs vertically
        if (powergroupPlacement === 0) { //top
            this.mainBox.add(this.bottomPane);
        }
        this.mainBox.add_actor(this.middlePane);
        if (powergroupPlacement !== 0) {//bottom, left or right
            this.mainBox.add(this.bottomPane);
        }

        // add all to section
        let section = new PopupMenuSection();
        section.actor.add_actor(this.mainBox);
        // add section as menu item
        this.menu.addMenuItem(section);

        // Set height constraints on scrollboxes
        this.applicationsScrollBox.add_constraint(new Clutter.BindConstraint({
                                            name: 'appScrollBoxConstraint',
                                            source: this.groupCategoriesWorkspacesScrollBox,
                                            coordinate: Clutter.BindCoordinate.HEIGHT,
                                            offset: 0 }));

        this.isNewInstance = false;
        this.state.panelLocation = this._panelLocation;
    }

    destroyContainer(container){
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
        let containers = [  'searchBox',
                            'categoriesBox',
                            'applicationsGridBox',
                            'applicationsListBox',
                            'applicationsBoxWrapper',
                            'applicationsScrollBox',
                            'groupCategoriesWorkspacesScrollBox',
                            'middlePane',
                            'bottomPane',
                            'mainbox' ];

        for (let i = 0; i < this.categoryButtons.length; i++) {
            this.categoryButtons[i].destroy();
            this.categoryButtons[i] = null;
        }
        this.categoryButtons = [];

        if (this.powerGroupBox) {
            this.powerGroupBox.destroy();
            this.powerGroupBox=null;
        }
        for (let i = 0, len = containers.length; i < len; i++) {
            if (typeof this[containers[i]] !== 'undefined') {
                this.destroyContainer(this[containers[i]]);
            }
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
}

class PowerGroupBox {
    constructor (state) {
        this.state = state;
        const powergroupPlacement = this.state.settings.powergroupPlacement;
        if (powergroupPlacement === 0 || powergroupPlacement === 1) {//top or bottom
            this.box = new St.BoxLayout({ style_class: '' /*, style: 'padding-left: 13px;'*/  });
        } else {
            this.box = new St.BoxLayout({ style_class: '', //'menu-favorites-box',
                                                        /*style: 'padding-left: 13px;',*/ vertical: true });
        }
    }

    populate (favs) {
        this.destroyChildren();

        this.items = [];
        if (this.state.settings.addFavorites) {
            for (let i=0; i<favs.length; i++) {
                this.items.push(new GroupButton( this.state, favs[i].create_icon_texture(28),
                                favs[i].name, favs[i].description, () => {  favs[i].open_new_window(-1);
                                                                            this.state.trigger('closeMenu'); } ));
            }
        }
        const iconObj = { icon_size: 28,
                          icon_type: IconType.FULLCOLOR };
        iconObj.icon_name = 'system-lock-screen';
        this.items.push(new GroupButton( this.state, new Icon(iconObj), _('Lock Screen'),
                    _('Lock the screen'), () => {
                        let screensaver_settings = new Gio.Settings({
                                                    schema_id: 'org.cinnamon.desktop.screensaver' });
                        let screensaver_dialog = Gio.file_new_for_path('/usr/bin/cinnamon-screensaver-command');
                        if (screensaver_dialog.query_exists(null)) {
                            if (screensaver_settings.get_boolean('ask-for-away-message')) {
                                spawnCommandLine('cinnamon-screensaver-lock-dialog');
                            } else {
                                spawnCommandLine('cinnamon-screensaver-command --lock');//
                            }
                        } else {
                            this.screenSaverProxy.LockRemote('');
                        }
                        this.state.trigger('closeMenu'); }));
        iconObj.icon_name = 'system-log-out';
        this.items.push(new GroupButton( this.state, new Icon(iconObj), _('Logout'),
                                        _('Leave the session'), () => { spawnCommandLine('cinnamon-session-quit');
                                                                        this.state.trigger('closeMenu'); } ));
        iconObj.icon_name = 'system-shutdown';
        this.items.push(new GroupButton( this.state, new Icon(iconObj), _('Quit'),
                            _('Shutdown the computer'), () => { spawnCommandLine('cinnamon-session-quit --power-off');
                                                                this.state.trigger('closeMenu'); } ));
        for (let i = 0; i < this.items.length; i++) {
            if (i == this.items.length - 3 && this.items.length > 3){
                const dot = new Widget({ style: 'width: 4px; height: 4px; background-color: ' +
                            this.state.theme.foregroundColor + '; margin: 7px; border: 3px; border-radius: 10px;',
                                                layout_manager: new Clutter.BinLayout(), x_expand: false, y_expand: false, });
                this.box.add(dot, { x_fill: false, y_fill: false,
                                x_align: Align.MIDDLE, y_align: Align.MIDDLE });
            }
            this.box.add(this.items[i].actor, { x_fill: false, y_fill: false,
                                                        x_align: St.Align.MIDDLE, y_align: St.Align.MIDDLE });
        }
        return;
    }

    getButtons() {
        return this.items;
    }

    clearEnteredActors() {
        const foundItem = findIndex(this.items, function(button) {
                                                                    return button.entered != null; });
        if (foundItem > -1 && this.items[foundItem]) {
            this.items[foundItem].handleLeave();
        }
    }

    destroyChildren() {
        if (!this.box || this.box.is_finalized()) {
            return;
        }
        let children = this.box.get_children();
        for (let i = 0, len = children.length; i < len; i++) {
            children[i].destroy();
        }
        this.items = null;
    }

    destroy() {
        this.destroyChildren();
        this.box.destroy();
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new CinnamenuApplet(metadata, orientation, panel_height, instance_id);
}
