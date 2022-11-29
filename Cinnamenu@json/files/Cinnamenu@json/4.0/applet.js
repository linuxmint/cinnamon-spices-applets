const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const GLib = imports.gi.GLib;
const CMenu = imports.gi.CMenu;
const Clutter = imports.gi.Clutter;
const Cinnamon = imports.gi.Cinnamon;
const XApp = imports.gi.XApp;
const St = imports.gi.St;
const Meta = imports.gi.Meta;
const Main = imports.ui.main;
const Util = imports.misc.util;
const AppletManager = imports.ui.appletManager; //
//const {SessionManager} = imports.misc.gnomeSession;
const {ScreenSaverProxy} = imports.misc.screenSaver;
const {PopupMenuManager, PopupMenuSection, PopupIconMenuItem} = imports.ui.popupMenu;
const {getAppFavorites} = imports.ui.appFavorites;
const {TextIconApplet, AllowedLayout, AppletPopupMenu} = imports.ui.applet;
const {SignalManager} = imports.misc.signalManager;
const {launch_all} = imports.ui.searchProviderManager;
const {addTween} = imports.ui.tweener;

const {PopupResizeHandler} = require('./resizer');
const {AppletSettings} = require('./settings');
const {_, graphemeBaseChars, searchStr} = require('./utils');
const {ContextMenu} = require('./contextmenu');
const {AppsView} = require('./appsview');
const {CategoriesView} = require('./categoriesview');
const {Sidebar} = require('./sidebar');
const {BookmarksManager} = require('./browserBookmarks');
const {wikiSearch, clearWikiSearchCache} = require('./wikipediaSearch');
const {searchBrowserHistory} = require('./browserHistory');
const {EMOJI, EMOJI_CATEGORIES} = require('./emoji');
const {searchSuggestions} = require('./suggestions');
const EMOJI_CODE = 0, EMOJI_NAME = 1, EMOJI_KEYWORDS = 2;
const ApplicationsViewModeLIST = 0, ApplicationsViewModeGRID = 1;
//const REMEMBER_RECENT_KEY = 'remember-recent-files';
const SEARCH_THRESHOLD = 0.45;
const SidebarPlacement = Object.freeze({ TOP: 0, BOTTOM: 1, LEFT: 2, RIGHT: 3});

class CinnamenuApplet extends TextIconApplet {
    constructor(metadata, orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);
        this.setAllowedLayout(AllowedLayout.BOTH);
        if (orientation === St.Side.BOTTOM || orientation === St.Side.TOP) {
            this.set_applet_label(_('Initializing'));
        }
        //this.privacy_settings = new Gio.Settings({schema_id: 'org.cinnamon.desktop.privacy'});
        this.appFavorites = getAppFavorites();
        this.currentCategory = 'all';
        this.gpu_offload_supported = Main.gpu_offload_supported;
        this.isBumblebeeInstalled = GLib.file_test('/usr/bin/optirun', GLib.FileTest.EXISTS);
        this.recentManagerDefault = Gtk.RecentManager.get_default();
        this.orientation = orientation;
        this.menuManager = new PopupMenuManager(this);
        this.menu = new AppletPopupMenu(this, this.orientation);
        this.menuManager.addMenu(this.menu);
        this.menu.setCustomStyleClass('menu-background cinnamenu');//starkmenu-background');
        this.signals = new SignalManager(null);
        this.appSystem = Cinnamon.AppSystem.get_default();
        this._canUninstallApps = GLib.file_test("/usr/bin/cinnamon-remove-application", GLib.FileTest.EXISTS);
        const searchFilesMenuItem = new PopupIconMenuItem(_('Find files...'), 'system-search',
                                                                        St.IconType.SYMBOLIC, false);
        this._applet_context_menu.addMenuItem(searchFilesMenuItem);
        searchFilesMenuItem.connect('activate', () => {
                            Util.spawnCommandLine(__meta.path + '/search.py ' + GLib.get_home_dir()); });
        this.resizer = new PopupResizeHandler(  this, this.menu.actor,
                                                400, this._getScreenWorkArea().width,
                                                300, this._getScreenWorkArea().height,
                                                (w,h) => this.onBoxResized(w,h),
                                                () => this.settings.customMenuWidth,
                                                () => this.settings.customMenuHeight);
        //this.signals.connect(this.privacy_settings, 'changed::' + REMEMBER_RECENT_KEY,
        //                                                            () => this._onEnableRecentsChange());
        this.signals.connect(Main.themeManager, 'theme-set', () => {this._updateIconAndLabel();
                                                                    setTimeout(() => this._refresh()); });
        this.iconTheme = Gtk.IconTheme.get_default();
        this.signals.connect(this.iconTheme, 'changed', () => this._updateIconAndLabel());
        this.signals.connect(this.appSystem, 'installed-changed', () => {   this.apps.installedChanged();
                                                                            this._refresh(); });
        this.signals.connect(this.appFavorites, 'changed', () => {
                        if (this.appsView) {// Check if display is initialised
                            this.sidebar.populate();
                            this.updateMenuSize();
                            if (this.currentCategory === 'favorite_apps' && !this.searchActive) {
                                this.setActiveCategory(this.currentCategory);
                            }
                        } });
        this.signals.connect(this.menu, 'open-state-changed', (...args) => this._onOpenStateToggled(...args));
        //this.signals.connect(global, 'scale-changed', () => this._refresh() );
        this.apps = new Apps(this);
        //this.session = new SessionManager();
        this.screenSaverProxy = new ScreenSaverProxy();
        this.initSettings();
        if (!this.settings.searchStartFolder) {
            this.settings.searchStartFolder = GLib.get_home_dir();
        }
        this.bookmarksManager = new BookmarksManager();
        this.recentApps = new RecentApps(this);
        this._onEnableRecentsChange();
        this._updateActivateOnHover();
        this._updateKeybinding();
        this._initDisplay();
        this.initialised = true;
        this._updateIconAndLabel();
    }

    initSettings() {
        this.settings = {};
        this.settingsObj = new AppletSettings(this.settings, __meta.uuid, this.instance_id);

        [
        { key: 'categories',                value: 'categories',            cb: null },
        { key: 'custom-menu-height',        value: 'customMenuHeight',      cb: null },
        { key: 'custom-menu-width',         value: 'customMenuWidth',       cb: null },
        { key: 'recent-apps',               value: 'recentApps',            cb: null },
        { key: 'search-start-folder',       value: 'searchStartFolder',     cb: null },

        { key: 'applications-view-mode',    value: 'applicationsViewMode',  cb: this._refresh },
        { key: 'description-placement',     value: 'descriptionPlacement',  cb: this._refresh },
        { key: 'sidebar-placement',         value: 'sidebarPlacement',      cb: this._refresh },
        { key: 'sidebar-favorites',         value: 'sidebarFavorites',      cb: this._refresh },

        { key: 'show-places-category',      value: 'showPlaces',            cb: this._onEnablePlacesChange },
        { key: 'show-recents-category',     value: 'showRecents',           cb: this._onEnableRecentsChange },
        { key: 'show-favorite-apps-category', value: 'showFavAppsCategory', cb: this._onEnableFavAppsCategory },
        { key: 'show-home-folder-category', value: 'showHomeFolder',        cb: () => this.categoriesView.update()},
        { key: 'show-emoji-category',       value: 'showEmojiCategory',     cb: () => this.categoriesView.update()},

        { key: 'overlay-key',               value: 'overlayKey',            cb: this._updateKeybinding },
        { key: 'activate-on-hover',         value: 'activateOnHover',       cb: this._updateActivateOnHover },
        { key: 'hover-delay',               value: 'hoverDelayMs',          cb: this._updateActivateOnHover },
        { key: 'enable-animation',          value: 'enableAnimation',       cb: null },
        { key: 'open-on-category',          value: 'openOnCategory',        cb: null },

        { key: 'category-click',            value: 'categoryClick',         cb: null },
        { key: 'enable-autoscroll',         value: 'enableAutoScroll',      cb: this._refresh },
        { key: 'show-hidden-files',         value: 'showHiddenFiles',       cb: null },

        { key: 'enable-emoji-search',       value: 'enableEmojiSearch',     cb: null },
        { key: 'web-search-option',         value: 'webSearchOption',       cb: null },
        { key: 'web-suggestions',           value: 'webSuggestionsOption',  cb: null },
        { key: 'enable-home-folder-search', value: 'searchHomeFolder',      cb: null },
        { key: 'enable-web-history-search', value: 'enableWebHistorySearch', cb: null },
        { key: 'enable-web-bookmarks-search', value: 'enableWebBookmarksSearch', cb: null },
        { key: 'enable-wikipedia-search',   value: 'enableWikipediaSearch', cb: null },
        { key: 'wikipedia-language',        value: 'wikipediaLanguage',     cb: clearWikiSearchCache },

        { key: 'menu-icon-custom',          value: 'menuIconCustom',        cb: this._updateIconAndLabel },
        { key: 'menu-icon',                 value: 'menuIcon',              cb: this._updateIconAndLabel },
        { key: 'menu-icon-size-custom',     value: 'menuIconSizeCustom',    cb: this._updateIconAndLabel },
        { key: 'menu-icon-size',            value: 'menuIconSize',          cb: this._updateIconAndLabel },
        { key: 'menu-label',                value: 'menuLabel',             cb: this._updateIconAndLabel },

        { key: 'category-icon-size',        value: 'categoryIconSize',      cb: this._refresh },
        { key: 'apps-list-icon-size',       value: 'appsListIconSize',      cb: this._refresh },
        { key: 'apps-grid-icon-size',       value: 'appsGridIconSize',      cb: this._refresh },
        { key: 'sidebar-icon-size',         value: 'sidebarIconSize',       cb: this._refresh },
        { key: 'use-box-style',             value: 'useBoxStyle',           cb: this._refresh },
        { key: 'use-tile-style',            value: 'useTileStyle',          cb: this._refresh }
        ].forEach(setting => this.settingsObj.bind(
                          setting.key,
                          setting.value,
                          setting.cb ? (...args) => setting.cb.call(this, ...args) : null ) );
    }

    getAppIconSize() {
        if (this.settings.applicationsViewMode === ApplicationsViewModeLIST) {
            return this.settings.appsListIconSize;
        } else {
            return this.settings.appsGridIconSize;
        }
    }

    getThemeForegroundColor() {
        return this.menu.actor.get_theme_node().get_foreground_color().to_string().substring(0, 7);
    }

    getThemeBackgroundColor() {
        return this.menu.actor.get_theme_node().get_background_color();
    }

    scrollToButton(button, enableAnimation) {
        let scrollBox = button.actor.get_parent();
        let i = 0;
        while (!(scrollBox instanceof St.ScrollView)) {
            i++;
            if (i > 10 || !scrollBox) {
                global.logWarning('Cinnamenu: Unable to find scrollbox for' + button.actor.toString());
                return false;
            }
            scrollBox = scrollBox.get_parent();
        }

        const adjustment = scrollBox.vscroll.adjustment;
        let [value, lower, upper, stepIncrement, pageIncrement, pageSize] = adjustment.get_values();

        let offset = 0;
        const vfade = scrollBox.get_effect('fade');//this always seems to return null?
        if (vfade) {
            offset = vfade.vfade_offset;
        }

        const box = button.actor.get_allocation_box();
        const y1 = box.y1, y2 = box.y2;
        const PADDING_ALLOWANCE = 20; //In case button parent(s) have padding meaning y1 won't go to 0
        if (y1 < value + offset) {
            if (y1 < PADDING_ALLOWANCE) {
                value = 0;
            } else {
                value = Math.max(0, y1 - offset);
            }
        } else if (y2 > value + pageSize - offset) {
            if (y2 > upper - offset - PADDING_ALLOWANCE) {
                value = upper - pageSize;
            } else {
                value = Math.min(upper, y2 + offset - pageSize);
            }
        } else {
            return false;
        }

        if (enableAnimation) {
            addTween(adjustment, {value: value, time: 0.1, transition: 'easeOutQuad'});
        } else {
            adjustment.set_value(value);
        }
    }

    _getScreenWorkArea() {
        const monitor = Main.layoutManager.currentMonitor;
        const ws = global.screen.get_active_workspace();
        return ws.get_work_area_for_monitor(monitor.index);
    }

//----------------TextIconApplet callbacks---------
    on_orientation_changed(orientation) {
        this.orientation = orientation;
        if (this.orientation === St.Side.LEFT || this.orientation === St.Side.RIGHT) {
            this.hide_applet_label(true);
        } else {
            this.hide_applet_label(false);
        }
        this._updateIconAndLabel();
    }

    on_applet_removed_from_panel() {
        this.willUnmount = true;
        Main.keybindingManager.removeHotKey('overlay-key-' + this.instance_id);
        if (!this.settingsObj) {
            return;
        }
        this.settingsObj.finalize();
        this.signals.disconnectAllSignals();
        this._destroyDisplayed();
        this.menu.destroy();
    }

    on_applet_clicked() {
        if (!this.initialised) {
            this.set_applet_label(_('Please wait...'));
            return;
        }

        this.menu.toggle_with_options(this.settings.enableAnimation);
    }

    on_applet_instances_changed(instance) {
        if (instance && instance.instance_id !== this.instance_id) {
            this.getOtherInstance = () => instance;
            instance.getOtherInstance = () => this;
        } else if (!instance && !this.willUnmount) {
            this.getOtherInstance = null;
        }
    }

    _setStyle() {
        // Override js/applet.js so _updateIconAndLabel doesn't have to fight with size changes
        // from the panel configuration. This gets called any time set_applet_icon() variants are
        // called.

        let icon_type = this._applet_icon.get_icon_type();
        let size;

        if (this.settings.menuIconSizeCustom) {
            size = Math.max(Math.min(this.settings.menuIconSize, this.panel.height), 1);
        } else {
            size = this.getPanelIconSize(icon_type);
        }

        if (icon_type === St.IconType.FULLCOLOR) {
            this._applet_icon.set_style_class_name('applet-icon');
        } else {
            this._applet_icon.set_style_class_name('system-status-icon');
        }

        this._applet_icon.set_icon_size(size);
    }
//-------settings callbacks--------
    _onEnablePlacesChange() {
        this.categoriesView.update();
        if (this.currentCategory === 'places' && !this.settings.showPlaces) {
            this.currentCategory = 'all';
        }
    }

    _onEnableRecentsChange() {
        //const recentFilesEnabled = this.privacy_settings.get_boolean(REMEMBER_RECENT_KEY);
        this.recentsEnabled = this.settings.showRecents; // && recentFilesEnabled;
        if (this.currentCategory === 'recents' && !this.recentsEnabled) {
            this.currentCategory = 'all';
        }
    }

    _onEnableFavAppsCategory() {
        this.categoriesView.update();
        if (this.currentCategory === 'favorite_apps' && !this.settings.showFavAppsCategory) {
            this.currentCategory = 'all';
        }
    }

    launchEditor() {
        Util.spawnCommandLine('cinnamon-menu-editor');
    }

    _updateKeybinding() {
        Main.keybindingManager.addHotKey(
            'overlay-key-' + this.instance_id,
            this.settings.overlayKey,
            () => {
                if (Main.overview.visible || Main.expo.visible) return;
                if (!this.getOtherInstance || global.screen.get_current_monitor() === this.panel.monitorIndex) {
                    this.menu.toggle_with_options(this.settings.enableAnimation);
                } else if (typeof this.getOtherInstance === 'function') {
                    const instance = this.getOtherInstance();
                    instance.menu.toggle_with_options.call(instance.menu, instance.settings.enableAnimation);
                }
            }
        );
    }

    _updateIconAndLabel() {
        try {
            if (this.settings.menuIconCustom) {
                if (this.settings.menuIcon === '') {
                    this.set_applet_icon_name('');
                } else if (GLib.path_is_absolute(this.settings.menuIcon) &&
                                    GLib.file_test(this.settings.menuIcon, GLib.FileTest.EXISTS)) {
                    if (this.settings.menuIcon.includes('-symbolic')) {
                        this.set_applet_icon_symbolic_path(this.settings.menuIcon);
                    } else {
                        this.set_applet_icon_path(this.settings.menuIcon);
                    }
                } else if (this.iconTheme.has_icon(this.settings.menuIcon)) {
                    if (this.settings.menuIcon.includes('-symbolic')) {
                        this.set_applet_icon_symbolic_name(this.settings.menuIcon);
                    } else {
                        this.set_applet_icon_name(this.settings.menuIcon);
                    }
                }
            } else {
                this.set_applet_icon_path(__meta.path + '/icon.png');
                /*let iconName = global.settings.get_string('app-menu-icon-name');*/
            }
        } catch(e) {
            global.logWarning('Cinnamenu: Could not load icon file ' + this.settings.menuIcon + ' for menu button');
        }
        if (this.settings.menuIconCustom && this.settings.menuIcon === '' ||
                                this.settings.menuIconSizeCustom && this.settings.menuIconSize === 0) {
            this._applet_icon_box.hide();
        } else {
            this._applet_icon_box.show();
        }

        if (this.orientation === St.Side.LEFT || this.orientation === St.Side.RIGHT) {
            this.set_applet_label('');
        } else {
            if (!this.settings.menuLabel) {
                this.settings.menuLabel = '';
            }
            const menuLabel = this.settings.menuLabel.substring(0, 45);
            this.set_applet_label(menuLabel);
            this.set_applet_tooltip(menuLabel);
        }
    }

    _updateActivateOnHover() {
        const openMenu = () => {
            if (!this._applet_context_menu.isOpen) {
                this.menu.open(this.settings.enableAnimation);
            }
        };
        if (this.signals.isConnected('enter-event', this.actor)) {
            this.signals.disconnect('enter-event', this.actor);
            this.signals.disconnect('leave-event', this.actor);
        }
        if (this.settings.activateOnHover) {
            this.signals.connect(this.actor, 'enter-event', () => {
                    if (!this.menu.isOpen && !this.openMenuTimeoutId) {
                        this.openMenuTimeoutId = setTimeout(() => openMenu(), this.settings.hoverDelayMs);
                    }
            });
            this.signals.connect(this.actor, 'leave-event', () => {
                            if (this.openMenuTimeoutId) {
                                clearTimeout(this.openMenuTimeoutId);
                                this.openMenuTimeoutId = null;
                            }
            });
        }
    }

    _refresh() {
        // TBD: For some reason the onEnable* settings callbacks get called several times per settings change,
        // This is causing the start up category to reset, so throttling this function to 250ms prevents excess
        // invocation.
        if (!this.lastRenderTime) this.lastRenderTime = 0;
        const now = Date.now();
        if ((now - this.lastRenderTime) <= 250) return;
        this.lastRenderTime = now;
        this._destroyDisplayed();
        this.menu.removeAll();
        if (this.currentCategory === 'places' && !this.settings.showPlaces ||
                        this.currentCategory === 'recents' && !this.recentsEnabled ||
                        this.currentCategory === 'favorite_apps' && !this.settings.showFavAppsCategory) {
            this.currentCategory = 'all';
        }
        this._initDisplay();
        this.clearFocusedActors();
    }
//==================================================================
    addFavoriteAppToPos(add_id, pos_id) {
        const pos = this.appFavorites._getIds().indexOf(pos_id);
        if (pos >= 0) { //move
            this.appFavorites.moveFavoriteToPos(add_id, pos);
        } else {
            this.appFavorites.addFavoriteAtPos(add_id, pos);
        }
    }

    clearFocusedActors() {
        if (this.contextMenu.isOpen) {
            this.contextMenu.close();
        }
        this.appsView.clearAppsViewFocusedActors();
        this.sidebar.clearSidebarFocusedActors();
    }
//----------
    _onOpenStateToggled(menu, open) {
        if (global.settings.get_boolean('panel-edit-mode')) {
            return false;
        }
        if (open) {
            if (this.openMenuTimeoutId) {
                clearTimeout(this.openMenuTimeoutId);
                this.openMenuTimeoutId = null;
            }

            this.searchView.tweakTheme();
            this.categoriesView.update();//in case menu editor updates
            this.sidebar.populate();//in case fav files changed
            this.sidebar.scrollToQuitButton();//ensure quit button is visible
            global.stage.set_key_focus(this.searchView.searchEntry);
            let openOnCategory = this.currentCategory;
            if (this.settings.openOnCategory === 1 && this.settings.showFavAppsCategory) {
                openOnCategory = 'favorite_apps';
            } else if (this.settings.openOnCategory === 2 && this.recentsEnabled) {
                openOnCategory = 'recents';
            } else if (this.settings.openOnCategory === 3 && this.settings.showPlaces) {
                openOnCategory = 'places';
            } else if (this.settings.openOnCategory === 4) {
                openOnCategory = 'all';
            } else if (this.settings.openOnCategory === 5 && this.settings.showHomeFolder) {
                openOnCategory = GLib.get_home_dir();
            }

            this.updateMenuSize();
            this.setActiveCategory(openOnCategory);

            //Show panel when auto hide is on.
            //this.panel.peekPanel(); //no longer works on cinnamon 5.4.x

            //center menu if applet in center zone of top or bottom panel
            const appletDefinition = AppletManager.getAppletDefinition({applet_id: this.instance_id});
            if ((this.orientation === St.Side.BOTTOM || this.orientation === St.Side.TOP) &&
                                                        appletDefinition.location_label === 'center') {
                const monitor = Main.layoutManager.findMonitorForActor(this.menu.actor);
                this.menu.shiftToPosition(Math.floor(monitor.width / 2) + monitor.x);
            }
        } else {
            if (this.searchActive) {
                this._endSearchMode();
            }
            this.clearFocusedActors();
            this.appsView.clearApps();//for quicker opening of menu
        }
        return true;
    }

    onBoxResized(userWidth, userHeight){
        this.updateMenuSize(userWidth, userHeight);
        //when resizing, no adjustments to app buttons are needed for list view
        if (this.settings.applicationsViewMode === ApplicationsViewModeGRID) {
            this.appsView.resizeGrid();
        }
    }

    updateMenuSize(newWidth = null, newHeight = null) {
        if (!newHeight) {//newHeight is only supplied when risizing
            newHeight = this.settings.customMenuHeight;
        }

        //----------height--------
        //Note: the stored menu height value is middlePane + bottomPane which is smaller than the
        //menu's actual height. CategoriesView and sidebar height are not automatically
        //set because ScrollBox.set_policy Gtk.PolicyType.NEVER pushes other items off the menu
        const appsHeight = newHeight - this.bottomPane.height;

        //---set middlePane actors to appsHeight
        this.appsView.applicationsScrollBox.height = appsHeight;
        this.categoriesView.groupCategoriesWorkspacesScrollBox.height = appsHeight;

        //find sidebarOuterBox vertical padding
        const themeNode = this.sidebar.sidebarOuterBox.get_theme_node();
        const topAndBottomPadding = themeNode.lookup_length('padding-top', true)[1] +
                                            themeNode.lookup_length('padding-bottom', true)[1];
        let padding = Math.max(themeNode.lookup_length('padding', true)[1] * 2, topAndBottomPadding);

        //set sidebarScrollBox height
        this.sidebar.sidebarScrollBox.set_height(-1);
        this.sidebar.sidebarScrollBox.set_height(Math.min(appsHeight - padding, this.sidebar.sidebarScrollBox.height));

        //------------width-------------
        //Note: the stored menu width value is less than the menu's actual width because it doesn't
        //include the outer menuBox padding, margin, etc. appsView width is not set automatically
        //because I don't know how to determine it's available width in order to calculate number
        //of columns to use in Clutter.GridLayout

        if (!newWidth) {//newWidth is only supplied when risizing
            newWidth = this.settings.customMenuWidth;
        }

        //find minimum width for categoriesView + sidebar (if present)
        let leftSideWidth = this.categoriesView.groupCategoriesWorkspacesScrollBox.width;
        if (this.settings.sidebarPlacement === SidebarPlacement.LEFT ||
                                                this.settings.sidebarPlacement === SidebarPlacement.RIGHT) {
            leftSideWidth += this.sidebar.sidebarOuterBox.width;
        }

        //find minimum width of bottomPane
        this.searchView.searchEntry.width = 5;  //Set to something small so that it gets set to its
                                                //minimum value.
        let bottomPaneMinWidth = 0;
        if (this.settings.sidebarPlacement === SidebarPlacement.TOP ||
                                                this.settings.sidebarPlacement === SidebarPlacement.BOTTOM) {
            bottomPaneMinWidth = this.bottomPane.width;
        }

        //find minimum menu width
        const minWidthForAppsView = 200;
        let minMenuWidth = Math.max(leftSideWidth + minWidthForAppsView, bottomPaneMinWidth);

        //---set applicationsListBox and applicationsGridBox width.
        let menuWidth = Math.max(minMenuWidth, newWidth);
        this.appsView.applicationsListBox.width = menuWidth - leftSideWidth;
        this.appsView.applicationsGridBox.width = menuWidth - leftSideWidth;
        this.appsView.currentGridBoxWidth = menuWidth - leftSideWidth; //because reading
                                                                //applicationsGridBox.width is unreliable.

        //Don't change settings while resizing to avoid excessive disk writes.
        if (!this.resizer.resizingInProgress) {
            this.settings.customMenuHeight = newHeight;
            this.settings.customMenuWidth = menuWidth;
        }
    }

    _onMenuKeyPress(actor, event) {
        if (this.resizer.resizingInProgress) {
            return Clutter.EVENT_STOP;
        }

        const symbol = event.get_key_symbol();
        const keyCode = event.get_key_code();
        const modifierState = Cinnamon.get_event_state(event);

        /* check for a keybinding and quit early, otherwise we get a double hit
           of the keybinding callback */
        const action = global.display.get_keybinding_action(keyCode, modifierState);
        if (action === Meta.KeyBindingAction.CUSTOM) {
            return Clutter.EVENT_PROPAGATE;
        }

        const ctrlKey = modifierState === 4;
        const shiftKey = modifierState === 1;
        const altKey = modifierState === 8;
        const altgrKey = modifierState === 128;
        const noModifiers = modifierState === 0;

        //Because Clutter.EVENT_PROPAGATE is returned on KEY_Left and KEY_Right, ignore duplicate
        //event emitted by ibus. https://github.com/linuxmint/cinnamon-spices-applets/issues/3294
        if (!this.lastKeyEventTime) this.lastKeyEventTime = 0;
        const now = Date.now();
        if ((symbol === Clutter.KEY_Left || symbol === Clutter.KEY_Right) && noModifiers &&
                                                                (now - this.lastKeyEventTime) <= 80) {
            return Clutter.EVENT_PROPAGATE;
        }
        this.lastKeyEventTime = now;

        const appButtons = this.appsView.getActiveButtons();
        const sidebarButtons = this.sidebar.getButtons();
        const categoryButtons = this.categoriesView.buttons;

        const focusedAppItemIndex = appButtons.findIndex(button => button.has_focus);
        const focusedSidebarItemIndex = sidebarButtons.findIndex(button => button.has_focus);

        let currentlyActiveCategoryIndex = categoryButtons.findIndex(button =>
                                                                    this.currentCategory === button.id);
        if (currentlyActiveCategoryIndex < 0) {
            currentlyActiveCategoryIndex = 0;
        }
        //When "activate categories on click" option is set, currentlyActiveCategoryIndex and
        //focusedCategoryIndex may not be the same.
        let focusedCategoryIndex = categoryButtons.findIndex(button => button.has_focus);
        if (focusedCategoryIndex < 0) {
            focusedCategoryIndex = currentlyActiveCategoryIndex;
        }

        const focusedAppItemExists = focusedAppItemIndex > -1;
        const focusedCategoryExists = focusedCategoryIndex > -1;
        const focusedSidebarItemExists = focusedSidebarItemIndex > -1;

        let focusedContextMenuItemExists = false;
        let contextMenuChildren = [];
        let focusedContextMenuItemIndex = -1;
        if (this.contextMenu.isOpen) {
            contextMenuChildren = this.contextMenu.contextMenuButtons;
            focusedContextMenuItemIndex = contextMenuChildren.findIndex(button => button.has_focus);
            if (focusedContextMenuItemIndex < 0) {
                focusedContextMenuItemIndex = 0;
            }
            focusedContextMenuItemExists = true;
        }

        const leaveCurrentlyFocusedItem = () => {
            if (focusedContextMenuItemExists) {
                contextMenuChildren[focusedContextMenuItemIndex].handleLeave();
            } else if (focusedAppItemExists) {
                appButtons[focusedAppItemIndex].handleLeave();
            } else if (focusedSidebarItemExists) {
                sidebarButtons[focusedSidebarItemIndex].handleLeave();
            } else if (focusedCategoryExists) {
                categoryButtons[focusedCategoryIndex].handleLeave();
            }
        };

        const nextSidebarItem = () => {
            if (focusedSidebarItemIndex < sidebarButtons.length - 1) {
                sidebarButtons[focusedSidebarItemIndex + 1].handleEnter();
            } else {
                sidebarButtons[0].handleEnter();
            }
        };

        const previousSidebarItem = () => {
            if (focusedSidebarItemIndex === 0) {
                sidebarButtons[sidebarButtons.length -1].handleEnter();
            } else {
                sidebarButtons[focusedSidebarItemIndex - 1].handleEnter();
            }
        };

        const leftNavigation = () => {
            if (focusedContextMenuItemExists) {
                contextMenuChildren[focusedContextMenuItemIndex].handleEnter();//effectively ignore
            } else if (focusedAppItemExists) {
                if (this.settings.applicationsViewMode === ApplicationsViewModeLIST) {
                    categoryButtons[currentlyActiveCategoryIndex].handleEnter();
                } else {
                    if (focusedAppItemIndex > 0) {
                        appButtons[focusedAppItemIndex - 1].handleEnter();
                    } else {
                        appButtons[appButtons.length - 1].handleEnter();
                    }
                }
            } else if (focusedSidebarItemExists) {
                if (this.settings.sidebarPlacement === SidebarPlacement.LEFT ||
                                                this.settings.sidebarPlacement === SidebarPlacement.RIGHT) {
                    categoryButtons[currentlyActiveCategoryIndex].handleEnter();
                } else {
                    previousSidebarItem();
                }
            } else if (focusedCategoryExists) {
                sidebarButtons[0].handleEnter();
            }
        };

        const rightNavigation = () => {
            if (focusedContextMenuItemExists) {
                contextMenuChildren[focusedContextMenuItemIndex].handleEnter();//Ignore
            } else if (focusedAppItemExists) {
                if (this.settings.applicationsViewMode === ApplicationsViewModeLIST) {
                    appButtons[focusedAppItemIndex].handleEnter();//ignore
                } else {
                    if (appButtons[focusedAppItemIndex + 1]) {
                        appButtons[focusedAppItemIndex + 1].handleEnter();
                    } else {
                        appButtons[0].handleEnter();
                    }
                }
            } else if (focusedSidebarItemExists) {
                if (this.settings.sidebarPlacement === SidebarPlacement.LEFT ||
                                                    this.settings.sidebarPlacement === SidebarPlacement.RIGHT) {
                    categoryButtons[currentlyActiveCategoryIndex].handleEnter();
                } else {
                    nextSidebarItem();
                }
            } else if (focusedCategoryExists) {
                appButtons[0].handleEnter();
            }
        };

        const downNavigation = () => {
            if (focusedContextMenuItemExists) {
                let nextContextMenuItem = focusedContextMenuItemIndex + 1;
                while (!contextMenuChildren[nextContextMenuItem] ||
                                    contextMenuChildren[nextContextMenuItem].action === null) {
                    nextContextMenuItem++;
                    if (nextContextMenuItem >= contextMenuChildren.length) {
                        nextContextMenuItem = 0;
                    }
                }
                contextMenuChildren[nextContextMenuItem].handleEnter();
            } else if (focusedAppItemExists) {
                if (this.settings.applicationsViewMode === ApplicationsViewModeLIST) {
                    if (appButtons[focusedAppItemIndex + 1]) {
                        appButtons[focusedAppItemIndex + 1].handleEnter();
                    } else {
                        appButtons[0].handleEnter();
                    }
                } else {//grid view
                    if (appButtons[focusedAppItemIndex + 1]) {
                        const column = appButtons[focusedAppItemIndex].actor.layout_column;
                        let next = focusedAppItemIndex + 1;
                        while (appButtons[next].actor.layout_column != column && appButtons[next + 1]) {
                            next++;
                        }
                        appButtons[next].handleEnter();
                    } else {
                        appButtons[focusedAppItemIndex].handleEnter();//effectively no change
                    }
                }
            } else if (focusedSidebarItemExists) {
                if (this.settings.sidebarPlacement === SidebarPlacement.TOP ||
                                                    this.settings.sidebarPlacement === SidebarPlacement.BOTTOM) {
                    categoryButtons[currentlyActiveCategoryIndex].handleEnter();
                } else {
                    nextSidebarItem();
                }
            } else if (focusedCategoryExists) {
                if (categoryButtons[focusedCategoryIndex + 1]) {
                    categoryButtons[focusedCategoryIndex + 1].handleEnter();
                } else {
                    categoryButtons[0].handleEnter();
                }
            }
        };

        const upNavigation = () => {
            if (focusedContextMenuItemExists) {
                let previousContextMenuItem = focusedContextMenuItemIndex - 1;
                while (!contextMenuChildren[previousContextMenuItem] ||
                                    contextMenuChildren[previousContextMenuItem].action === null) {
                    previousContextMenuItem--;
                    if (previousContextMenuItem < 0) {
                        previousContextMenuItem = contextMenuChildren.length -1;
                    }
                }
                contextMenuChildren[previousContextMenuItem].handleEnter();
            } else if (focusedAppItemExists) {
                if (this.settings.applicationsViewMode === ApplicationsViewModeLIST) {
                    if (focusedAppItemIndex > 0) {
                        appButtons[focusedAppItemIndex - 1].handleEnter();
                    } else {
                        appButtons[appButtons.length - 1].handleEnter();
                    }
                } else {
                    if (focusedAppItemIndex > 0) {
                        const column = appButtons[focusedAppItemIndex].actor.layout_column;
                        let previous = focusedAppItemIndex - 1;
                        while (appButtons[previous].actor.layout_column != column && previous > 0) {
                            previous--;
                        }
                        appButtons[previous].handleEnter();
                    } else {
                        appButtons[0].handleEnter();//effectively no change
                    }
                }
            } else if (focusedSidebarItemExists) {
                if (this.settings.sidebarPlacement === SidebarPlacement.TOP ||
                                                this.settings.sidebarPlacement === SidebarPlacement.BOTTOM) {
                    categoryButtons[currentlyActiveCategoryIndex].handleEnter();
                } else {
                    previousSidebarItem();
                }
            } else if (focusedCategoryExists) {
                if (focusedCategoryIndex > 0) {
                    categoryButtons[focusedCategoryIndex - 1].handleEnter();
                } else {
                    categoryButtons[categoryButtons.length - 1].handleEnter();
                }
            }
        };

        switch (true) {
        case (symbol === Clutter.KEY_KP_Enter || symbol === Clutter.KP_Enter ||
                                            symbol === Clutter.KEY_Return) && ctrlKey:
        case (symbol === Clutter.KEY_Menu) && noModifiers:
            if (this.contextMenu.isOpen) {
                this.contextMenu.close();
            } else if (focusedAppItemExists) {
                appButtons[focusedAppItemIndex].openContextMenu();
            } else if (focusedSidebarItemExists) {
                sidebarButtons[focusedSidebarItemIndex].openContextMenu();
            } else if (focusedCategoryExists) {
                categoryButtons[focusedCategoryIndex].openContextMenu();
            }
            return Clutter.EVENT_STOP;
        case (symbol === Clutter.KP_Enter || symbol === Clutter.KEY_KP_Enter ||
                                        symbol === Clutter.KEY_Return) && noModifiers:
            if (focusedContextMenuItemExists) {
                contextMenuChildren[focusedContextMenuItemIndex].activate();
            } else if (focusedAppItemExists) {
                appButtons[focusedAppItemIndex].activate();
            } else if (focusedSidebarItemExists) {
                sidebarButtons[focusedSidebarItemIndex].activate();
            } else if (focusedCategoryExists) {
                categoryButtons[focusedCategoryIndex].selectCategory();
            }
            return Clutter.EVENT_STOP;
        case (symbol === Clutter.KEY_Up && noModifiers):
            leaveCurrentlyFocusedItem();
            upNavigation();
            return Clutter.EVENT_STOP;
        case (symbol === Clutter.KEY_Down && noModifiers):
            leaveCurrentlyFocusedItem();
            downNavigation();
            return Clutter.EVENT_STOP;
        case (symbol === Clutter.KEY_Right && noModifiers):
            leaveCurrentlyFocusedItem();
            rightNavigation();
            return Clutter.EVENT_PROPAGATE; //so that left/right can also be used to navigate search entry
        case (symbol === Clutter.KEY_Left && noModifiers):
            leaveCurrentlyFocusedItem();
            leftNavigation();
            return Clutter.EVENT_PROPAGATE; //so that left/right can also be used to navigate search entry
        case (symbol === Clutter.KEY_ISO_Left_Tab || symbol === Clutter.ISO_Left_Tab ||
                                symbol === Clutter.Tab || symbol === Clutter.KEY_Tab) && noModifiers:
            leaveCurrentlyFocusedItem();
            if (focusedContextMenuItemExists) {
                contextMenuChildren[focusedContextMenuItemIndex].handleEnter();//effectively ignore keypress
            } else if (focusedAppItemExists) {
                sidebarButtons[0].handleEnter();
            } else if (focusedSidebarItemExists && !this.searchActive) {
                categoryButtons[currentlyActiveCategoryIndex].handleEnter();
            } else {
                appButtons[0].handleEnter();
            }
            return Clutter.EVENT_STOP;
        case (symbol === Clutter.KEY_ISO_Left_Tab || symbol === Clutter.ISO_Left_Tab ||
                                symbol === Clutter.Tab || symbol === Clutter.KEY_Tab) && shiftKey:
            leaveCurrentlyFocusedItem();
            if (focusedContextMenuItemExists) {
                contextMenuChildren[focusedContextMenuItemIndex].handleEnter();//effectively ignore keypress
            } else if (focusedAppItemExists) {
                categoryButtons[currentlyActiveCategoryIndex].handleEnter();
            } else if (focusedSidebarItemExists && !this.searchActive) {
                appButtons[0].handleEnter();
            } else {
                sidebarButtons[0].handleEnter();
            }
            return Clutter.EVENT_STOP;
        case (symbol === Clutter.ISO_Left_Tab || symbol === Clutter.Tab) && altKey:
            this.menu.close();//Close menu as alt-tab is used for app-switcher in cinnamon
            return Clutter.EVENT_STOP;
        case (symbol === Clutter.Escape || symbol === Clutter.KEY_Escape) && noModifiers:
            if (this.contextMenu.isOpen) {
                this.contextMenu.close();
            } else {
                this.menu.close();
            }
            return Clutter.EVENT_STOP;
        case (symbol === Clutter.KEY_Page_Up && noModifiers):
            leaveCurrentlyFocusedItem();
            if (focusedAppItemExists) {
                appButtons[0].handleEnter();
            } else if (focusedSidebarItemExists) {
                sidebarButtons[0].handleEnter();
            } else {
                categoryButtons[0].handleEnter();
            }
            return Clutter.EVENT_STOP;
        case (symbol === Clutter.KEY_Page_Down && noModifiers):
            leaveCurrentlyFocusedItem();
            if (focusedAppItemExists) {
                appButtons[appButtons.length - 1].handleEnter();
            } else if (focusedSidebarItemExists) {
                sidebarButtons[sidebarButtons.length - 1].handleEnter();
            } else {
                categoryButtons[categoryButtons.length - 1].handleEnter();
            }
            return Clutter.EVENT_STOP;
        default:
            return Clutter.EVENT_PROPAGATE;
        }
    }

    setActiveCategory(categoryId) {
        //categoryId is one of 4 things: a special category (one of 'places', 'recents', 'favorite_files' or
        //'favorite_apps'), an application category id, an emoji category (must begin with 'emoji:') or
        //an absolute path used in folderview (must begin with a /)
        this.currentCategory = categoryId;
        this.categoriesView.setSelectedCategoryStyle(categoryId);
        this.appsView.buttonStoreCleanup();

        switch (categoryId) {
        case 'places':
            this.appsView.populate(this.listPlaces());
            break;
        case 'recents':
            let maxItems = 8;//show 8 items of each type in list view or
            //adjust number of items according to number of columns in grid view to make
            //best use of available space.
            let maxRecentItems = 4;
            if (this.settings.applicationsViewMode === ApplicationsViewModeGRID) {
                const columns = this.appsView.getGridValues().columns;
                maxItems = Math.ceil(6 / columns) * columns;
                maxRecentItems = Math.max(maxRecentItems, columns);
            }

            this.appsView.populate_init();
            const recentApps = this.listRecent_apps(maxRecentItems);
            if (recentApps.length > 0) {
                this.appsView.populate_add(recentApps,_('Applications'));
            }
            const recentDocs = this.listRecentByType('documents', maxItems);
            if (recentDocs.length > 0) {
                this.appsView.populate_add(recentDocs,_('Documents'));
            }
            const recentVids = this.listRecentByType('video', maxItems);
            if (recentVids.length > 0) {
                this.appsView.populate_add(recentVids,_('Videos'));
            }
            const recentPics = this.listRecentByType('image', maxItems);
            if (recentPics.length > 0) {
                this.appsView.populate_add(recentPics,_('Images'));
            }
            const recentAudio = this.listRecentByType('audio', maxItems);
            if (recentAudio.length > 0) {
                this.appsView.populate_add(recentAudio,_('Music'));
            }
            const totalItems = recentApps.length + recentDocs.length + recentVids.length +
                                                                recentPics.length + recentAudio.length;
            if (totalItems > 0) {
                this.appsView.populate_add(this.getClearRecentsButton());
            }
            this.appsView.populate_finish();
            if (totalItems == 0) {
                this.appsView.populate([], _('No recent Items'));
            }
            break;
        case 'favorite_files':
            this.appsView.populate(this.listFavoriteFiles());
            break;
        case 'favorite_apps':
            this.appsView.populate(this.listFavoriteApps());
            break;
        default:
            if (categoryId.startsWith('emoji:')) {
                const emojiCategory = categoryId.slice(categoryId.indexOf(':') + 1);
                this.appsView.populate_init();

                EMOJI_CATEGORIES.forEach(category => {
                    if (category.name == emojiCategory) {
                        this.appsView.populate_add( this.listEmojiByRange(category.start, category.end),
                                                    category.name + ' ▽',//🞃⏷▽⯆
                                                    () => this.setActiveCategory('emoji:'));
                    } else {
                        this.appsView.populate_add([], category.name + ' ▷',//🞂⏵▷⯈
                            () => {
                                //Without first calling setActiveCategory('emoji:') and then using Meta.later_add(),
                                //both of which should be unnecessary, the menu will sometimes just close without
                                //any errors in .xsession-errors or journal. A bug in St, Gtk or Clutter I suspect.
                                this.setActiveCategory('emoji:');
                                Meta.later_add(Meta.LaterType.IDLE,
                                                () => {
                                        setTimeout(() => this.setActiveCategory('emoji:' + category.name),100);
                                                });
                            });
                    }
                });

                this.appsView.populate_finish();
            } else if (categoryId.startsWith('/')) {//folder view
                const folderContents = this.listFolder(categoryId);
                const headerText = folderContents.errorMsg? folderContents.errorMsg : categoryId;
                this.appsView.populate(folderContents.results, headerText);
            } else {//applications category
                this.appsView.populate(this.apps.listApplications(categoryId));
            }
        }
    }
//----search----
    _onSearchTextChanged() {
        const searchText = this.searchView.searchEntryText.get_text();

        if (searchText.length === 0) {//search text deleted, cancel search mode
            if (!this.searchActive) {//search mode already ended
                return;
            }
            this._endSearchMode();
            this.setActiveCategory(this.currentCategory);
            return;
        }
        //---start search---
        this.currentSearchStr = searchText;

        //Set a new search ID so that async search functions
        //from a previous search can be aborted.
        this.currentSearchId = Math.floor(Math.random() * 100000000);

        this.clearFocusedActors();
        if (!this.searchActive) {//set search mode
            this.searchActive = true;
            this.searchView.showAndConnectSecondaryIcon();//show edit-delete icon
            this.categoriesView.buttons.forEach(button => button.disable());
        }

        //When doSearch() below is called by setTimeout, this.currentSearchId may have changed so store its
        //current value in a const as the current lexical scope is preserved.
        const currentSearchId = this.currentSearchId;
        setTimeout(() => this._doSearch(searchText, currentSearchId));
    }

    _endSearchMode() {
        this.searchActive = false;
        this.searchView.hideAndDisconnectSecondaryIcon();//hide edit-delete icon
        this.categoriesView.buttons.forEach(button => button.enable());
        this.searchView.searchEntry.set_text('');
        this.previousSearchPattern = '';
    }

    _doSearch(pattern_raw, thisSearchId) {
        //this fuction has been called asynchronously meaning that a keypress may have changed the
        //search query before this function is called. Check that this search is still valid.
        if (!this.searchActive || thisSearchId !== this.currentSearchId) {
            return;
        }
        //if (!text || !text.trim()) return;

        const pattern = graphemeBaseChars(pattern_raw).toLocaleUpperCase();
        //Don't repeat the same search. This can happen if a key and backspace are pressed in quick
        //succession while a previous search is being carried out.
        if (pattern_raw === this.previousSearchPattern) {
            return;
        }
        this.previousSearchPattern = pattern_raw;

        //======Begin search===========

        let primaryResults = this.apps.searchApplications(pattern)
                        .concat(this.searchFavoriteFiles(pattern))
                        .concat(this.recentsEnabled ? this.searchRecent(pattern) : [])
                        .concat(this.settings.showPlaces ? this.searchPlaces(pattern) : []);
        let otherResults = [];
        const emojiResults = [];
        const webBookmarksResults = [];
        let webHistoryResults = [];

        //-----
        let BOOKMARKS_PREFIX = false;
        let HISTORY_PREFIX = false;
        let EMOJI_PREFIX = false;
        let FILE_PREFIX = false;
        if (pattern.length > 2) {
            if (pattern.startsWith('B ')) {
                BOOKMARKS_PREFIX = true;
            }
            if (pattern.startsWith('H ')) {
                HISTORY_PREFIX = true;
            }
            if (pattern.startsWith('E ')) {
                EMOJI_PREFIX = true;
            }
            if (pattern.startsWith('F ')) {
                FILE_PREFIX = true;
            }
        }
        //=======search providers==========
        //---calculator---
        let calculatorResult = null;
        const replacefn = (match) => {//Replace eg. "sqrt" with "Math.sqrt"
            if (['E','PI','abs','acos','acosh','asin','asinh','atan','atanh','cbrt','ceil','cos',
            'cosh','exp','floor','fround','log','max','min','pow','random','round','sign','sin',
            'sinh','sqrt','tan','tanh','trunc'].includes(match)) {
                return 'Math.' + match;
            } else {
                validExp = false;
                return match;
            }
        };
        let validExp = true;
        let ans = null;
        const exp = pattern_raw.replace(/([a-zA-Z]+)/g, replacefn);
        if (validExp) {
            try {
                ans = eval(exp);
            } catch(e) {}
        }
        if ((typeof ans === 'number' || typeof ans === 'boolean') && ans != pattern_raw ) {
            if (!this.calcGIcon) {
                this.calcGIcon = new Gio.FileIcon({ file: Gio.file_new_for_path(__meta.path + '/../icons/calc.png') });
            }
            otherResults.push({
                            isSearchResult: true,
                            name: ans.toString(),//('Solution:') + ' ' + ans,
                            description: _('Click to copy'),
                            deleteAfterUse: true,
                            icon: new St.Icon({ gicon: this.calcGIcon, icon_size: this.getAppIconSize() }),
                            activate: () => {   const clipboard = St.Clipboard.get_default();
                                                clipboard.set_text(St.ClipboardType.CLIPBOARD, ans.toString());}
                         });
            calculatorResult = pattern_raw + " = " + ans;
        }

        //---web search option---
        if (this.settings.webSearchOption != 0) {//0==none
            const iconName = ['google_icon.png', 'bing_icon.png', 'search.png', 'yahoo_icon.png',
                            'search.png', 'duckgo_icon.png', 'ask.png', 'ecosia.png', 'search.png',
                            'startpage.png', 'brave.png'][this.settings.webSearchOption - 1];
            const url = [   'https://google.com/search?q=',
                            'https://www.bing.com/search?q=',
                            'https://www.baidu.com/s?wd=',
                            'https://search.yahoo.com/search?p=',
                            'https://yandex.com/search/?text=',
                            'https://duckduckgo.com/?q=',
                            'https://www.ask.com/web?q=',
                            'https://www.ecosia.org/search?q=',
                            'https://search.aol.co.uk/aol/search?q=',
                            'https://www.startpage.com/search/?q=',
                            'https://search.brave.com/search?q='][this.settings.webSearchOption - 1];
            const engine = ['Google', 'Bing', 'Baidu', 'Yahoo', 'Yandex', 'DuckDuckGo', 'Ask',
                            'Ecosia', 'AOL', 'Startpage', 'Brave'][this.settings.webSearchOption - 1];

            const gicon = new Gio.FileIcon({file: Gio.file_new_for_path(__meta.path + '/../icons/' + iconName)});

            otherResults.push({
                        isSearchResult: true,
                        name: pattern_raw,// + ' – '+ engine,
                        description: '',
                        deleteAfterUse: true,
                        icon: new St.Icon({ gicon: gicon, icon_size: this.getAppIconSize()}),
                        activate: () => Util.spawn(['xdg-open', url + encodeURIComponent(pattern_raw)]) });
            if (this.settings.webSuggestionsOption) {
                searchSuggestions(pattern_raw, (results) => {
                    if (results.length > 0 && this.searchActive && thisSearchId === this.currentSearchId) {
                        results.forEach( suggestion => {
                            otherResults.push({
                                isSearchResult: true,
                                name: suggestion,// + ' – '+ engine,
                                description: '',
                                deleteAfterUse: true,
                                icon: new St.Icon({ gicon: gicon, icon_size: this.getAppIconSize()}),
                                activate: () => Util.spawn(['xdg-open', url + encodeURIComponent(suggestion)])
                            });
                        });
                        finish();
                    }
                });
            }
        }

        //---web bookmarks search-----
        if (this.settings.enableWebBookmarksSearch && pattern.length > 1 ||
                                                BOOKMARKS_PREFIX && pattern.length > 3) {
            let bpattern = pattern;
            if (BOOKMARKS_PREFIX) {
                bpattern = pattern.substring(2);
            }
            const bookmarks = this.bookmarksManager.bookmarks;

            bookmarks.forEach(bookmark => {
                        if (bookmark.name) {
                            const match = searchStr(bpattern, bookmark.name);
                            if (match.score > SEARCH_THRESHOLD) {
                                bookmark.score = match.score;
                                bookmark.nameWithSearchMarkup = match.result;
                                webBookmarksResults.push(bookmark);
                            }
                        } });

            webBookmarksResults.sort((a, b) =>  a.score < b.score);
            if (webBookmarksResults.length > 12) {
                webBookmarksResults.length = 12;
            }
        }

        //---------------------------
        const finish = () => {//sort and display all search results
            if (!this.searchActive || thisSearchId != this.currentSearchId){
                return; //Search mode has ended or search string has changed
            }

            //sort primaryResults[]
            primaryResults.sort((a, b) =>  b.score - a.score);//items with equal score are left in existing order
            //Limit primaryResults to 10
            if (primaryResults.length > 10) {
                primaryResults.length = 10;
            }

            //Remove duplicate primaryResults[]. eg. a fav file, a recent file and a folderfile might all
            //be the same file. Prefer from highest to lowest: isFavoriteFile, isRecentFile, isPlace,
            //isFolderviewFile which is easy because primaryResults[] should already be in this order.
            for (let i = 0; i < primaryResults.length -1; i++) {
                const app = primaryResults[i];
                if (app.isFavoriteFile || app.isRecentFile || app.isPlace) {
                    for (let r = i + 1; r < primaryResults.length; r++) {
                        const compareApp = primaryResults[r];
                        if ((compareApp.isRecentFile || compareApp.isFolderviewFile || compareApp.isPlace) &&
                                                                    compareApp.uri === app.uri) {
                            primaryResults.splice(r, 1);
                            r--;
                        }
                    }
                }
            }

            //Display results
            this.appsView.populate_init(calculatorResult);
            if (primaryResults.length > 0) {
                this.appsView.populate_add(primaryResults, _('Applications and files'));
            }
            if (otherResults.length > 0) {
                this.appsView.populate_add(otherResults, _('Other search results'));
            }
            if (webHistoryResults.length > 0) {
                this.appsView.populate_add(webHistoryResults, _('Browser history'));
            }
            if (webBookmarksResults.length > 0) {
                this.appsView.populate_add(webBookmarksResults, _('Browser bookmarks'));
            }
            if (emojiResults.length > 0) {
                this.appsView.populate_add(emojiResults, _('Emoji'));
            }
            this.appsView.populate_finish();
            this.appsView.highlightFirstItem();

            //In case mouse is hovering a different item (thus selecting it) ensure first result
            //is highlighted again after drawing.
            Meta.later_add(Meta.LaterType.IDLE, () => this.appsView.highlightFirstItem());
        };

        //---web history search---
        if (this.settings.enableWebHistorySearch && pattern.length > 1 || HISTORY_PREFIX && pattern.length > 3) {
            let hpattern = pattern;
            if (HISTORY_PREFIX) {
                hpattern = pattern.substring(2);
            }

            searchBrowserHistory(hpattern, history => {
                if (history.length > 0 && this.searchActive && thisSearchId === this.currentSearchId) {
                    webHistoryResults = history;
                    finish();
                }
            });
        }

        //---Wikipedia search----
        if (this.settings.enableWikipediaSearch && pattern_raw.length > 1 ) {
            wikiSearch(pattern_raw, this.settings.wikipediaLanguage, (wikiResults) => {
                    if (this.searchActive && thisSearchId === this.currentSearchId && wikiResults.length > 0) {
                        otherResults = otherResults.concat(wikiResults);
                        finish();
                    } });
        }

        //---emoji search------
        if (pattern.length > 2 && this.settings.enableEmojiSearch || EMOJI_PREFIX && pattern.length > 4) {
            let epattern = pattern;
            if (EMOJI_PREFIX) {
                epattern = pattern.substring(2);
            }

            EMOJI.forEach(emoji => {
                const match1 = searchStr(epattern, emoji[EMOJI_NAME], true);
                const match2 = searchStr(epattern, emoji[EMOJI_KEYWORDS], true);
                match2.score *= 0.95; //slightly lower priority for keyword match
                const bestMatchScore = Math.max(match1.score, match2.score);
                if (bestMatchScore > SEARCH_THRESHOLD) {
                    emojiResults.push({
                        name: emoji[EMOJI_NAME],
                        score: bestMatchScore,
                        description: _('Click to copy'),
                        nameWithSearchMarkup: match1.result,
                        isSearchResult: true,
                        deleteAfterUse: true,
                        emoji: emoji[EMOJI_CODE],
                        activate: () => {
                                const clipboard = St.Clipboard.get_default();
                                clipboard.set_text(St.ClipboardType.CLIPBOARD, emoji[EMOJI_CODE]); }
                    });
                }
            });

            emojiResults.sort((a, b) =>  a.score < b.score);
            if (emojiResults.length > 36) {
                emojiResults.length = 36;
            }
        }

        //----home folder search--------
        if (pattern.length > 1 && this.settings.searchHomeFolder || FILE_PREFIX && pattern.length > 3) {
            let fpattern = pattern;
            if (FILE_PREFIX) {
                fpattern = pattern.substring(2);
            }
            //Call function searchNextDir() consecutively and asynchronously on each folder to be searched so
            //that search can be interupted at any time. Starting with home folder, all folders to be
            //searched are added to foldersToDo[] with currentFolderIndex being the folder currently
            //being searched. Searching is cancelled when the search string has changed (thisSearchId !==
            //this.currentSearchId). Searching is completed when all folders have been searched
            //(currentFolderIndex === foldersToDo.length - 1)

            let updateInterval = 100;//update the results after the first 100ms even if search hasn't finished
            const MAX_FOLDERS_TODO = 200;
            const results = [];
            const foldersToDo = [];
            foldersToDo.push(this.settings.searchStartFolder);//start search in (default value) home directory
            let currentFolderIndex = 0;
            let lastUpdateTime = Date.now();

            const searchNextDir = (thisSearchId) => {
                const folder = foldersToDo[currentFolderIndex];
                const dir = Gio.file_new_for_path(folder);
                let enumerator;
                dir.enumerate_children_async(
                            'standard::name,standard::type,standard::icon,standard::content-type,' +
                            'standard::is-hidden,standard::is-symlink',
                            Gio.FileQueryInfoFlags.NONE, GLib.PRIORITY_DEFAULT, null, (source, result) => {
                    try {
                        enumerator = source.enumerate_children_finish(result);
                    } catch(e) {
                        global.logWarning('Cinnamenu file search:' + e.message);
                    }
                    if (!this.searchActive || thisSearchId !== this.currentSearchId) {
                        if (enumerator) {
                            enumerator.close(null);
                        }
                        return;
                    }

                    //find matching files and folders in directory
                    let next;
                    if (enumerator) {
                        next = enumerator.next_file(null);
                    }

                    let searchTimeLimit = Date.now() + 200; // allow max 200ms to search each folder to
                    //prevent freezing if a folder has a large number of files.
                    while (next && Date.now() < searchTimeLimit) {
                        if (!next.get_is_hidden()) {
                            const filename = next.get_name();
                            const isDirectory = next.get_file_type() === Gio.FileType.DIRECTORY;
                            const filePath = folder + (folder === '/' ? '' : '/') + filename;
                            const match = searchStr(fpattern, filename, true, true);
                            if (match.score > 1) { //any word boundary match
                                const file = Gio.file_new_for_path(filePath);
                                match.score -= 0.01;
                                //if file then treat as isFolderviewFile and if directory then treat as isPlace
                                const foundFile = {
                                            name: filename,
                                            score: match.score * (fpattern.length > 2 ? 1 : 0.9),
                                            nameWithSearchMarkup: match.result,
                                            gicon: next.get_icon(),
                                            uri: file.get_uri(),
                                            mimeType: next.get_content_type(),
                                            description: filePath,
                                            isPlace: isDirectory,
                                            isFolderviewFile: !isDirectory,
                                            deleteAfterUse: true };
                                if (isDirectory) {
                                    const defaultInfo = Gio.AppInfo.get_default_for_type('inode/directory', false);
                                    if (defaultInfo) {
                                        foundFile.activate = () => { defaultInfo.launch([file], null); };
                                    }
                                }
                                results.push(foundFile);
                            }

                            //Add subdirectories to foldersToDo[]
                            if (isDirectory && !next.get_is_symlink() && foldersToDo.length < MAX_FOLDERS_TODO) {
                                foldersToDo.push(filePath);
                            }
                        }
                        next = enumerator.next_file(null);
                    }

                    if (enumerator) {
                        enumerator.close(null);
                    }

                    //update display of results at intervals or when search completed
                    if (currentFolderIndex === foldersToDo.length - 1 ||
                                                    Date.now() - lastUpdateTime > updateInterval) {
                        if (results.length > 0 && this.searchActive &&
                                                                thisSearchId === this.currentSearchId) {
                            primaryResults = primaryResults.concat(results);
                            finish();
                            results.length = 0;
                        }
                        lastUpdateTime = Date.now();
                        updateInterval *= 2;//progressively longer update intervals
                    }

                    //continue search if not completed
                    if (currentFolderIndex < foldersToDo.length - 1) {
                        currentFolderIndex++;
                        searchNextDir(thisSearchId);
                    }

                });
            };
            searchNextDir(this.currentSearchId);
        }

        ///----search providers--------
        setTimeout(() => {
            launch_all(pattern, (provider, providerResults) => {
                    providerResults.forEach(providerResult => {
                        if (!providerResult) {
                            return;
                        }
                        providerResult.isSearchResult = true;
                        providerResult.name = providerResult.label.replace(/ : /g, ': ');
                        providerResult.activate = provider.on_result_selected;
                        providerResult.deleteAfterUse = true;
                        //providerResult.score = 0.2;
                        if (providerResult.icon) {
                            providerResult.icon.icon_size = this.getAppIconSize();
                        } else if (providerResult.icon_app){
                            providerResult.icon = providerResult.icon_app.create_icon_texture(
                                                                                this.getAppIconSize());
                        } else if (providerResult.icon_filename){
                            providerResult.icon = new St.Icon({
                                  gicon: new Gio.FileIcon({
                                        file: Gio.file_new_for_path(providerResult.icon_filename)}),
                                        icon_size: this.getAppIconSize() });
                        }
                    });
                    if (!this.searchActive || thisSearchId !== this.currentSearchId ||
                                                !providerResults || providerResults.length === 0) {
                        return;
                    }
                    otherResults = otherResults.concat(providerResults);
                    finish();
                });
            });

        finish();
        return;
    }

//-----Create display----
    _initDisplay() {
        this.displaySignals = new SignalManager(null);
        const sidebarPlacement = this.settings.sidebarPlacement;
        this.sidebar = new Sidebar(this, sidebarPlacement);

        //==================bottomPane================
        this.searchView = new SearchView(this);
        this.displaySignals.connect(this.searchView.searchEntryText, 'text-changed',
                                                        (...args) => this._onSearchTextChanged(...args));
        this.displaySignals.connect(this.searchView.searchEntryText, 'key-press-event',
                                                            (...args) => this._onMenuKeyPress(...args));
        this.bottomPane = new St.BoxLayout({});
        if (sidebarPlacement === SidebarPlacement.TOP || sidebarPlacement === SidebarPlacement.BOTTOM) {
            this.bottomPane.add(this.sidebar.sidebarOuterBox, { expand: false, x_fill: false, y_fill: false,
                                                  x_align: St.Align.START, y_align: St.Align.MIDDLE });
        }
        this.bottomPane.add(this.searchView.searchBox, { expand: true, x_fill: true, y_fill: false,
                                                    x_align: St.Align.END, y_align: St.Align.MIDDLE });

        //=================middlePane======================
        this.appsView = new AppsView(this);
        this.categoriesView = new CategoriesView(this);
        this.middlePane = new St.BoxLayout();
        if (sidebarPlacement === SidebarPlacement.LEFT) {
            this.middlePane.add(this.sidebar.sidebarOuterBox, { expand: false, x_fill: false, y_fill: false,
                                                    x_align: St.Align.START, y_align: St.Align.MIDDLE });
        }
        this.middlePane.add(this.categoriesView.groupCategoriesWorkspacesScrollBox, { x_fill: false, y_fill: false,
                                                    x_align: St.Align.START, y_align: St.Align.START });
        this.middlePane.add(this.appsView.applicationsScrollBox, { x_fill: false, y_fill: false,
                                            x_align: St.Align.START, y_align: St.Align.START, expand: false });
        if (sidebarPlacement === SidebarPlacement.RIGHT) {
            this.middlePane.add(this.sidebar.sidebarOuterBox, { expand: false, x_fill: false, y_fill: false,
                                                    x_align: St.Align.START, y_align: St.Align.MIDDLE });
        }

        //=============mainBox================
        //set style: 'spacing: 0px' so that extra space is not added to mainBox when contextMenuBox is
        //added. Only happens with themes that have set a spacing value on this class.
        this.mainBox = new St.BoxLayout({ style_class: 'menu-applications-outer-box', style: 'spacing: 0px;',
                                        vertical: true, reactive: true,
                                        show_on_set_parent: false });
        this.mainBox.add_style_class_name('menu-applications-box'); //this is to support old themes
        if (sidebarPlacement === SidebarPlacement.TOP) {
            this.mainBox.add(this.bottomPane);
        }
        this.mainBox.add_actor(this.middlePane);
        if (sidebarPlacement !== SidebarPlacement.TOP) {
            this.mainBox.add(this.bottomPane);
        }

        this.contextMenu = new ContextMenu(this);//Context menu is added to the stage by adding it to mainBox
        //=============menu================
        const section = new PopupMenuSection();
        section.actor.add_actor(this.mainBox);
        this.menu.addMenuItem(section);

        //if a blank part of the menu was clicked on, close context menu
        this.displaySignals.connect(this.mainBox, 'button-release-event',() => this.clearFocusedActors());

        //monitor mouse motion to prevent category mis-selection
        const onMouseMotion = (actor, event) => {
            //keep track of mouse motion to prevent misselection of another category button when moving mouse
            //pointer from selected category button to app button by calculating angle of pointer movement
            let [x, y] = event.get_coords();
            if (!this.mTrack) {
                this.mTrack = [];
            }
            //compare current position with oldest position in last 0.1 seconds.
            this.mTrack.push({time: Date.now(), x: x, y: y});//push current position onto array
            while (this.mTrack[0].time + 100 < Date.now()) {//remove positions older than 0.1 seconds ago
                this.mTrack.shift();
            }
            const dx = x - this.mTrack[0].x;
            const dy = Math.abs(y - this.mTrack[0].y);

            const tan = dx / dy;
            this.badAngle = tan > 0.3;//if tan = +infinity, badAngle is true.
                                      //if tan = -infinity or NaN, badAngle is false.
        };
        this.categoriesView.categoriesBox.set_reactive(true);
        this.displaySignals.connect(this.categoriesView.categoriesBox, 'motion-event',
                                                        (...args) => onMouseMotion(...args));

        //When sidebar is not on the left, limit excessive mainBox left padding + categoriesBox left
        //padding to 20px by subtracting the difference from categoriesBox left padding.
        if (sidebarPlacement !== SidebarPlacement.LEFT) {
            const catLpadding = this.categoriesView.categoriesBox.get_theme_node().get_padding(3);
            const mainBoxLpadding = this.mainBox.get_theme_node().get_padding(3);
            const excessPadding = Math.max(catLpadding + mainBoxLpadding - 20, 0);//=total padding > 20px
            if (excessPadding > 0) {
                this.categoriesView.categoriesBox.style = `padding-left: ${
                                            Math.max(catLpadding - excessPadding, 0)}px; `;
            }
        }

        this.sidebar.populate();

        if (this.settings.applicationsViewMode === ApplicationsViewModeLIST) {
            this.appsView.applicationsGridBox.hide();
            this.appsView.applicationsListBox.show();
        } else {
            this.appsView.applicationsListBox.hide();
            this.appsView.applicationsGridBox.show();
        }

        this.mainBox.show();
    }

    _destroyDisplayed() {
        this.displaySignals.disconnectAllSignals();
        this.searchView.destroy();
        this.searchView = null;
        this.appsView.destroy();
        this.appsView = null;
        this.sidebar.destroy();
        this.sidebar = null;
        this.categoriesView.destroy();
        this.categoriesView = null;
        this.contextMenu.destroy();
        this.contextMenu = null;
        this.bottomPane.destroy();
        this.middlePane.destroy();
        this.mainBox.destroy();
    }

/*-----below are all functions creating app objects excluding _doSearch() and
 *-----listApplications() which is in Apps class.
 *app obj properties used:
 *  .name
 *  .description
 *  .id
 *  .uri
 *  .mimeType
 *  .icon
 *  .gicon
 *  .iconFactory()
 *  .score
 *  .nameWithSearchMarkup
 *  .descriptionWithSearchMarkup
 *  .isApplication
 *  .isPlace
 *  .isRecentFile
 *  .isClearRecentsButton
 *  .isFavoriteFile             //Nemo favorites
 *  .isFolderviewFile
 *  .isFolderviewDirectory
 *  .isBackButton
 *  .isSearchResult
 *  .deleteAfterUse
 *  .emoji
 *  .activate()
 */

    listFavoriteApps() {
        let res = this.appFavorites.getFavorites();
        res.forEach(favApp => {
            favApp.name = favApp.get_name();
            favApp.description = favApp.get_description();
            favApp.isApplication = true;
        });
        return res;
    }

    searchRecent(pattern) {
        const res = [];

        this.listRecentByType('all', 100).forEach(recentItem => {
            const match = searchStr(pattern, recentItem.name);
            if (recentItem.name && match.score > SEARCH_THRESHOLD) {
                recentItem.score = match.score;
                recentItem.nameWithSearchMarkup = match.result;
                res.push(recentItem);
            }
        });

        return res;
    }

    listRecent_apps(maxRecentItems) {
        const res = [];

        this.recentApps.getApps(maxRecentItems).forEach(recentId => {
            const app = this.apps.listApplications('all').find(app => app.id === recentId);
            if (app) {//Check because app may have been uninstalled
                res.push(app);
            }
        });

        return res;
    }

    listRecentByType(type, maxItems) {
        //param "type" is one of all|documents|video|image|audio.
        const res = [];
        this.recentManagerDefault.get_items().forEach(recentInfo => {
            if (type === 'documents' && (   recentInfo.get_mime_type().startsWith('video') ||
                                            recentInfo.get_mime_type().startsWith('image') ||
                                            recentInfo.get_mime_type().startsWith('audio') )) {
                return;
            }
            if ((type === 'video' || type === 'image' || type === 'audio') &&
                                                        !recentInfo.get_mime_type().startsWith(type)) {
                return;
            }
            if (!recentInfo.exists()) {
                return;
            }

            const new_recent = {
                name: recentInfo.get_display_name(),
                gicon: recentInfo.get_gicon(),
                uri: recentInfo.get_uri(),
                mimeType: recentInfo.get_mime_type(),
                description: recentInfo.get_uri_display(),
                modifiedTime: recentInfo.get_modified(),//only used for sorting below
                isRecentFile: true,
                deleteAfterUse: true
            };
            res.push(new_recent);
        });
        res.sort((a, b) =>  a.modifiedTime < b.modifiedTime);
        if (res.length > maxItems) {
            res.length = maxItems;
        }
        return res;
    }

    getClearRecentsButton() {
        let res = [];

        const clearRecentsButton = this.appsView.buttonStore.find(button => button.app.isClearRecentsButton);
        if (clearRecentsButton) {
            res.push(clearRecentsButton.app);
        } else {
            res.push( { name: _('Clear List'),
                        description: '',
                        icon: new St.Icon({ icon_name: 'edit-clear',
                                            icon_type: St.IconType.SYMBOLIC,
                                            icon_size: this.getAppIconSize()}),
                                            isClearRecentsButton: true });
        }

        return res;
    }

    listPlaces() {
        const res = [];
        Main.placesManager.getAllPlaces().forEach(place => {
            let selectedAppId = place.idDecoded.substr(place.idDecoded.indexOf(':') + 1);
            const fileIndex = selectedAppId.indexOf('file:///');
            if (fileIndex !== -1) {
                selectedAppId = selectedAppId.substr(fileIndex + 7);
            }
            if (selectedAppId === 'home' || selectedAppId === 'desktop' || selectedAppId === 'connect') {
                selectedAppId = place.name;
            }
            place.isPlace = true;
            place.description = selectedAppId;
            place.activate = () => place.launch();//don't pass any params to launch()
            if (place.id.startsWith('bookmark:')) {
                place.uri = place.id.substr(9);
            }
            res.push(place);
        });
        res.splice(2, 0, {
                id: 'special:trash',
                name: _('Trash'),
                description: _('Trash'),
                isPlace: true,
                activate: () => Util.spawnCommandLine('xdg-open trash:'),
                iconFactory: (size) => new St.Icon({icon_name: 'user-trash',
                                                    icon_type: St.IconType.FULLCOLOR,
                                                    icon_size: size })
                        });
        res.splice(2, 0, {
                id: 'special:computer',
                name: _('Computer'),
                description: _('Computer'),
                isPlace: true,
                activate: () => Util.spawnCommandLine('xdg-open computer:'),
                iconFactory: (size) => new St.Icon({icon_name: 'computer',
                                                    icon_type: St.IconType.FULLCOLOR,
                                                    icon_size: size })
                        });

        return res;
    }

    searchPlaces(pattern){
        const places = this.listPlaces();
        const res = [];
        places.forEach(place => {
            const match = searchStr(pattern, place.name);
            if (match.score > SEARCH_THRESHOLD) {
                place.nameWithSearchMarkup = match.result;
                place.score = match.score;
                res.push(place);
            }
        });

        return res;
    }

    listFavoriteFiles() {
        if (!XApp.Favorites) {
            return [];
        }
        const res = [];
        const favorite_infos = XApp.Favorites.get_default().get_favorites(null);
        favorite_infos.forEach(info => {
            const found = this.appsView.buttonStore.find(button =>
                                        button.app.isFavoriteFile && button.app.uri === info.uri);
            if (found) {
                res.push(found.app);
            } else {
                res.push({  name: info.display_name,
                            description: Gio.File.new_for_uri(info.uri).get_path(),
                            gicon: Gio.content_type_get_icon(info.cached_mimetype),
                            isFavoriteFile: true,
                            mimeType: info.cached_mimetype,
                            uri: info.uri });
            }
        });

        res.sort( (a, b) =>
                    a.name.localeCompare(b.name, undefined, {sensitivity: "base", ignorePunctuation: true}));
        return res;
    }

    searchFavoriteFiles(pattern) {
        const favs = this.listFavoriteFiles();
        const res = [];

        favs.forEach(item => {
            const match = searchStr(pattern, item.name);
            if (item.name && match.score > SEARCH_THRESHOLD) {
                item.score = match.score;
                item.nameWithSearchMarkup = match.result;
                res.push(item);
            }
        });

        return res;
    }

    listFolder(folder) {
        const res = [];
        const dir = Gio.file_new_for_path(folder);
        let enumerator;
        let errorMsg = null;
        try {
            enumerator = dir.enumerate_children(
                    'standard::name,standard::type,standard::icon,standard::content-type,standard::is-hidden',
                                                                                                    0, null);
        } catch(e) {//folder access permission denied probably
            errorMsg = e.message;
        }
        let next;
        if (enumerator) {
            next = enumerator.next_file(null);
        }
        while (next) {
            const filename = next.get_name();
            if (this.settings.showHiddenFiles || !next.get_is_hidden()) {
                let file = Gio.file_new_for_path(folder + (folder === '/' ? '' : '/') + filename);
                const isDirectory = next.get_file_type() === Gio.FileType.DIRECTORY;
                res.push({  name: next.get_name(),
                            gicon: next.get_icon(),
                            uri: file.get_uri(),
                            mimeType: next.get_content_type(),
                            isFolderviewDirectory: isDirectory,
                            description: '',
                            isFolderviewFile: !isDirectory,
                            deleteAfterUse: true });
                file = null;
            }
            next = enumerator.next_file(null);
        }
        if (enumerator) {
            enumerator.close(null);
        }

        res.sort((a, b) => {    if (!a.isFolderviewDirectory && b.isFolderviewDirectory) return 1;
                                else if (a.isFolderviewDirectory && !b.isFolderviewDirectory) return -1;
                                else if (a.isFolderviewDirectory && b.isFolderviewDirectory &&
                                            a.name.startsWith('.') && !b.name.startsWith('.')) return 1;
                                else if (a.isFolderviewDirectory && b.isFolderviewDirectory &&
                                            !a.name.startsWith('.') && b.name.startsWith('.')) return -1;
                                else {
                                    const nameA = a.name.toUpperCase();
                                    const nameB = b.name.toUpperCase();
                                    return (nameA > nameB) ? 1 : ( (nameA < nameB) ? -1 : 0 );
                                } });
        const parent = dir.get_parent();
        if (parent) {// Add back button
            res.unshift({   name: 'Back',
                            uri: parent.get_uri(),
                            icon: new St.Icon({ icon_name: 'edit-undo-symbolic',
                                                icon_type: St.IconType.SYMBOLIC,
                                                icon_size: this.getAppIconSize() }),
                            mimeType: 'inode/directory',
                            isBackButton: true,
                            description: '',
                            deleteAfterUse: true
                        });
        }

        return {results: res, errorMsg: errorMsg};
    }

    listEmojiByRange(rangeStart, rangeEnd) {
        const results = [];
        for (let i = rangeStart; i < rangeEnd; i++) {
            results.push({
                name: EMOJI[i][EMOJI_NAME],
                description: _('Click to copy'),
                isSearchResult: true,
                deleteAfterUse: true,
                emoji: EMOJI[i][EMOJI_CODE],
                activate: () => {
                    const clipboard = St.Clipboard.get_default();
                    clipboard.set_text(St.ClipboardType.CLIPBOARD, EMOJI[i][EMOJI_CODE]);
                }
            });
        }

        return results;
    }
}

class Apps {//This obj provides the .app objects for all the applications categories
    constructor(appThis) {
        this.appThis = appThis;
        this.appsByCategory = {};
        this.knownApps = [];
        this.newInstance = true;
        this.appsNeedRefresh = true;
    }

    installedChanged() {
        this.appsNeedRefresh = true;
    }

    _initAppCategories() {
        const apps_sort = arr => arr.sort((a, b) => a.name.localeCompare(b.name, undefined,
                                                    {sensitivity: "base", ignorePunctuation: true}));
        const dirs = [];
        const iter = this.appThis.appSystem.get_tree().get_root_directory().iter();
        let nextType;
        while ((nextType = iter.next()) !== CMenu.TreeItemType.INVALID) {
            if (nextType === CMenu.TreeItemType.DIRECTORY) {
                dirs.push(iter.get_directory());
            }
        }

        dirs.forEach(dir => {
            if (!dir.get_is_nodisplay()) {
                const dirId = dir.get_menu_id();
                this.appsByCategory[dirId] = [];
                this._loadAppCategories(dir, null, dirId);
                apps_sort(this.appsByCategory[dirId]);
            }
        });
        //create "All applications" category
        let all = [];
        Object.keys(this.appsByCategory).forEach(key => {
                                            if (key !== 'all') {
                                                all = all.concat(this.appsByCategory[key]);
                                            } });
        this.appsByCategory.all = Array.from(new Set(all));//remove duplicates
        apps_sort(this.appsByCategory.all);

        this.appsNeedRefresh = false;
        this.newInstance = false;
    }

    _loadAppCategories(dir, rootDir, dirId) {
        const iter = dir.iter();
        let nextType;
        while ((nextType = iter.next()) !== CMenu.TreeItemType.INVALID) {
            if (nextType === CMenu.TreeItemType.ENTRY) {
                const entry = iter.get_entry();
                const appInfo = entry.get_app_info();
                if (appInfo && !appInfo.get_nodisplay()) {
                    const id = entry.get_desktop_file_id();
                    const app = this.appThis.appSystem.lookup_app(id);
                    let found = false;
                    if (rootDir && typeof rootDir.get_menu_id === 'function') {
                        const rootDirId = rootDir.get_menu_id();
                        if (rootDirId) {
                            this.appsByCategory[rootDirId].push(app);
                            found = true;
                        }
                    } else {
                        if (dirId) {
                            this.appsByCategory[dirId].push(app);
                            found = true;
                        }
                    }
                    if (found) {
                        app.name = app.get_name();
                        app.description = app.get_description();
                        app.isApplication = true;
                        app.id = app.get_id();
                    }
                    if (this.knownApps.indexOf(id) < 0) {//unknown app
                        if (!this.newInstance) {
                            app.newAppShouldHighlight = true;
                        }
                        this.knownApps.push(id);
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
    }

    listApplications(categoryMenuId) {
        if (this.appsNeedRefresh) {
            this._initAppCategories();
        }

        return this.appsByCategory[categoryMenuId];
    }

    searchApplications(pattern) {
        if (!pattern) {
            return [];
        }

        const res = this.listApplications('all');
        const _res = [];
        res.forEach(app => {
            const keywords = app.get_keywords() || '';
            let id = app.id.replace('.desktop', '');
            const idLastDot = id.lastIndexOf('.');
            if (idLastDot >= 0) {
                id = id.substring(idLastDot + 1);
            }
            id = id.replace('cinnamon-settings-', '');

            const match1 = searchStr(pattern, app.name);
            const match2 = searchStr(pattern, app.description);
            match2.score *= 0.95; //slightly lower priority for description match
            const match3 = searchStr(pattern, keywords);
            match3.score *= 0.8; //lower priority for keyword match
            const match4 = searchStr(pattern, id);
            const bestMatchScore = Math.max(match1.score, match2.score, match3.score, match4.score);
            if (bestMatchScore > SEARCH_THRESHOLD) {
                app.score = bestMatchScore;
                app.nameWithSearchMarkup = match1.result;
                app.descriptionWithSearchMarkup = match2.result;
                _res.push(app);
            }
        });

        return _res;
    }
}

class RecentApps {// simple class to remember the last 4 used apps which are shown in the "recent" category
    constructor(appThis) {
        this.appThis = appThis;
    }

    add(appId) {
        const recentApps = this.appThis.settings.recentApps.slice();
        const duplicate = recentApps.indexOf(appId);
        if (duplicate > -1) {
            recentApps.splice(duplicate, 1);
        }
        recentApps.unshift(appId);
        if (recentApps.length > 20) {
            recentApps.length = 20;
        }
        this.appThis.settings.recentApps = recentApps;
    }

    clear() {
        this.appThis.settings.recentApps = [];
    }

    getApps(max_count) {
        return this.appThis.settings.recentApps.slice(0, max_count);
    }
}

class SearchView {
    constructor(appThis) {
        this.appThis = appThis;
        this.searchInactiveIcon = new St.Icon({ style_class: 'menu-search-entry-icon',
                                                icon_name: 'edit-find' });
        this.searchActiveIcon = new St.Icon({   style_class: 'menu-search-entry-icon',
                                                icon_name: 'edit-clear' });
        this.searchEntry = new St.Entry({ name: 'menu-search-entry', track_hover: true, can_focus: true});
        this.searchEntryText = this.searchEntry.clutter_text;
        this.searchEntry.set_primary_icon(this.searchInactiveIcon);
        this.searchBox = new St.BoxLayout({ style_class: 'menu-search-box' });
        this.searchBox.add(this.searchEntry, { expand: true });
    }

    showAndConnectSecondaryIcon() {
        this.searchEntry.set_secondary_icon(this.searchActiveIcon);
        this.appThis.signals.connect(this.searchEntry, 'secondary-icon-clicked', () => { //todo
                                                                    this.searchEntryText.set_text('');});
    }

    hideAndDisconnectSecondaryIcon() {
        this.searchEntry.set_secondary_icon(null);
        this.appThis.signals.disconnect('secondary-icon-clicked', this.searchEntry);
    }

    tweakTheme() {
        this.searchBox.style = 'min-width: 160px; ';

        //make searchBox l/r padding & margin symmetrical when it uses the full width of the menu.
        if (this.appThis.settings.sidebarPlacement === SidebarPlacement.RIGHT ||
                                        this.appThis.settings.sidebarPlacement === SidebarPlacement.LEFT) {
            //set left padding of searchBox to match right padding
            const searchBoxNode = this.searchBox.get_theme_node();
            const searchBoxPaddingRight = searchBoxNode.get_padding(1);
            this.searchBox.style += `padding-left: ${searchBoxPaddingRight}px; `;

            //deal with uneven searchBox margins and uneven mainBox paddings by setting searchBox margins.
            const searchBoxRightMargin = searchBoxNode.get_margin(3);
            const mainBoxNode = this.appThis.mainBox.get_theme_node();
            const mainBoxPaddingRight = mainBoxNode.get_padding(1);
            const mainBoxPaddingLeft = mainBoxNode.get_padding(3);
            const newMargin = Math.max(searchBoxRightMargin, mainBoxPaddingRight, mainBoxPaddingLeft);
            this.searchBox.style += `margin-left: ${newMargin - mainBoxPaddingLeft}px; ` +
                                                `margin-right: ${newMargin - mainBoxPaddingRight}px; `;
        }
    }

    destroy() {
        this.searchInactiveIcon.destroy();
        this.searchActiveIcon.destroy();
        this.searchEntry.destroy();
        this.searchBox.destroy();
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new CinnamenuApplet(metadata, orientation, panel_height, instance_id);
}
