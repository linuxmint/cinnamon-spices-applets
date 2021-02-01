const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const GLib = imports.gi.GLib;
const CMenu = imports.gi.CMenu;
const Clutter = imports.gi.Clutter;
const Cinnamon = imports.gi.Cinnamon;
const XApp = imports.gi.XApp;
const Util = imports.misc.util;
const St = imports.gi.St;
const Meta = imports.gi.Meta;
const Main = imports.ui.main;
const {getDocManager} = imports.misc.docInfo;
const Mainloop = imports.mainloop;
const {heightsUsedMonitor} = imports.ui.panel;
//const {SessionManager} = imports.misc.gnomeSession;
const {ScreenSaverProxy} = imports.misc.screenSaver;
const {PopupMenuManager, PopupMenuSection, PopupIconMenuItem} = imports.ui.popupMenu;
const {getAppFavorites} = imports.ui.appFavorites;
const {TextIconApplet, AllowedLayout, AppletPopupMenu} = imports.ui.applet;
const {PopupResizeHandler} = require('./resizer');
const {AppletSettings} = imports.ui.settings;
const {addTween} = imports.ui.tweener;
const {SignalManager} = imports.misc.signalManager;
const {launch_all} = imports.ui.searchProviderManager;
const {_, APPTYPE, tryFn, searchStr} = require('./utils');
const ApplicationsViewModeLIST = 0, ApplicationsViewModeGRID = 1;
const REMEMBER_RECENT_KEY = 'remember-recent-files';
const {CategoryButton, AppButton, ContextMenu, SidebarButton} = require('./buttons');
const {BookmarksManager} = require('./browserBookmarks');
const {EMOJI} = require('./emoji');
//const HINT_TEXT = _('Type to search...');
const SEARCH_THRESHOLD = 0.45;
const PlacementTOP = 0, PlacementBOTTOM = 1, PlacementLEFT = 2, PlacementRIGHT = 3;
var time;

class CinnamenuApplet extends TextIconApplet {
    constructor(metadata, orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);
        this.setAllowedLayout(AllowedLayout.BOTH);
        if (orientation === St.Side.BOTTOM || orientation === St.Side.TOP) {
            this.set_applet_label(_('Initializing'));
        }
        this.privacy_settings = new Gio.Settings({schema_id: 'org.cinnamon.desktop.privacy'});
        this.appFavorites = getAppFavorites();
        this.recentEnabled = this.privacy_settings.get_boolean(REMEMBER_RECENT_KEY);
        this.currentCategory = 'all';
        this.gpu_offload_supported = Main.gpu_offload_supported;
        this.isBumblebeeInstalled = GLib.file_test('/usr/bin/optirun', GLib.FileTest.EXISTS);
        this.closeMenu = () => this.menu.close();
        this.orientation = orientation;
        this.menuManager = new PopupMenuManager(this);
        this.menu = new AppletPopupMenu(this, this.orientation);
        this.menuManager.addMenu(this.menu);
        this.menu.setCustomStyleClass('menu-background');
        this.menu.setCustomStyleClass('cinnamenu');
        this.menu.setCustomStyleClass('starkmenu-background');
        this.signals = new SignalManager(null);
        this.displaySignals = new SignalManager(null);
        //this.tracker = Cinnamon.WindowTracker.get_default();//?
        this.appSystem = Cinnamon.AppSystem.get_default();
        const searchFilesMenuItem = new PopupIconMenuItem(_('Find files...'), 'system-search',
                                                                            St.IconType.SYMBOLIC, false);
        this._applet_context_menu.addMenuItem(searchFilesMenuItem);
        searchFilesMenuItem.connect('activate', () => {
                            Util.spawnCommandLine(__meta.path + '/search.py ' + GLib.get_home_dir()); });
        this.resizer = new PopupResizeHandler(  this,
                                                this.menu.actor,
                                                400, this.getScreenWorkArea().width,
                                                300, this.getScreenWorkArea().height,
                                                (w,h) => this.onBoxResized(w,h),
                                                () => this.settings.customMenuWidth,
                                                () => this.settings.customMenuHeight);
        this.signals.connect(this.privacy_settings, 'changed::' + REMEMBER_RECENT_KEY,
                                                            (...args) => this.onEnableRecentChange(...args));
        this.signals.connect(Main.themeManager, 'theme-set', (...args) => this.onThemeChanged(...args));
        this.iconTheme = Gtk.IconTheme.get_default();
        this.signals.connect(this.iconTheme, 'changed', (...args) => this.onIconsChanged(...args));
        this.signals.connect(this.appSystem, 'installed-changed',
                                                        (...args) => this.apps.installedChanged(...args));
        this.signals.connect(this.appFavorites, 'changed', (...args) => this.onFavoriteAppsChanged(...args));
        this.signals.connect(this.menu, 'open-state-changed', (...args) => this.onOpenStateToggled(...args));
        //this.signals.connect(global, 'scale-changed', () => this.refresh() );
        this.categories = new Categories(this);
        this.apps = new Apps(this);
        this.allItems = [];
        //this.session = new SessionManager();
        this.screenSaverProxy = new ScreenSaverProxy();
        this.initSettings();
        this.onEnableWebBookmarksChange(null, true);
        this.updateActivateOnHover();
        this.updateKeybinding();
        this.initDisplay();
        this.initialised = true;
        this.updateIconAndLabel();
    }

    initSettings() {
        this.settings = {};
        this.settingsObj = new AppletSettings(this.settings, __meta.uuid, this.instance_id);

        [
            { key: 'categories',                value: 'categories',            cb: null },
            { key: 'custom-menu-height',        value: 'customMenuHeight',      cb: null },
            { key: 'custom-menu-width',         value: 'customMenuWidth',       cb: null },

            { key: 'applications-view-mode',    value: 'applicationsViewMode',  cb: this.refresh },
            { key: 'description-placement',     value: 'descriptionPlacement',  cb: this.refresh },
            { key: 'sidebar-placement',         value: 'sidebarPlacement',      cb: this.refresh },
            { key: 'add-favorites',             value: 'addFavorites',          cb: this.refresh },

            { key: 'show-places-category',      value: 'showPlaces',            cb: this.onEnablePlacesChange },
            { key: 'show-recents-category',     value: 'showRecents',           cb: this.onEnableRecentChange },
            { key: 'show-web-bookmarks-category', value: 'enableWebBookmarks',  cb: this.onEnableWebBookmarksChange },
            { key: 'show-favorite-apps-category', value: 'showFavAppsCategory', cb: this.onEnableFavAppsCategory },
            { key: 'show-home-folder-category', value: 'showHomeFolder',        cb: this.onEnableHomeFolderChange },

            { key: 'overlay-key',               value: 'overlayKey',            cb: this.updateKeybinding },
            { key: 'activate-on-hover',         value: 'activateOnHover',       cb: this.updateActivateOnHover },
            { key: 'hover-delay',               value: 'hoverDelayMs',
                            cb: () => { this.updateActivateOnHover(false);
                                        this.updateActivateOnHover(true); } },
            { key: 'enable-animation',          value: 'enableAnimation',       cb: null },
            { key: 'open-on-favorites',         value: 'openOnFavorites',       cb: null },

            { key: 'category-click',            value: 'categoryClick',         cb: null },
            { key: 'enable-autoscroll',         value: 'enableAutoScroll',      cb: this.refresh },
            { key: 'web-search-option',         value: 'webSearchOption',       cb: null },
            { key: 'enable-emoji-search',       value: 'enableEmojiSearch',     cb: null },
            { key: 'show-hidden-files',         value: 'showHiddenFiles',       cb: null },

            { key: 'menu-icon-custom',          value: 'menuIconCustom',        cb: this.updateIconAndLabel },
            { key: 'menu-icon',                 value: 'menuIcon',              cb: this.updateIconAndLabel },
            { key: 'menu-label',                value: 'menuLabel',             cb: this.updateIconAndLabel },

            { key: 'category-icon-size',        value: 'categoryIconSize',      cb: this.refresh },
            { key: 'apps-list-icon-size',       value: 'appsListIconSize',      cb: this.refresh },
            { key: 'apps-grid-icon-size',       value: 'appsGridIconSize',      cb: this.refresh },
            { key: 'sidebar-icon-size',         value: 'sidebarIconSize',       cb: this.refresh },
            { key: 'use-box-style',             value: 'useBoxStyle',           cb: this.refresh }
        ].forEach( setting => this.settingsObj.bind(
                          setting.key,
                          setting.value,
                          setting.cb ? (...args) => setting.cb.call(this, ...args) : null ) );
    }

    getGridValues() {
        const gridWidth = this.appsView.applicationsGridBox.width;
        const columns = Math.floor(gridWidth / (140 * global.ui_scale));
        const columnWidth = Math.floor(gridWidth / columns);
        //bigger if large icons
        //width = Math.max(width, this.getAppIconSize() * this.settings.appsGridColumnCount * 1.5);
        return {columnWidth: columnWidth, columns: columns};
    }

    getAppIconSize() {
        if (this.settings.applicationsViewMode === ApplicationsViewModeLIST) {
            return this.settings.appsListIconSize;
        } else {
            return this.settings.appsGridIconSize;
        }
    }

    getThemeForegroundColor() {
        const appletMenuThemeNode = this.menu.actor.get_theme_node();
        return appletMenuThemeNode.get_foreground_color().to_string().substring(0, 7);
    }

    getScreenWorkArea() {
        const monitor = Main.layoutManager.currentMonitor;
        const ws = global.screen.get_active_workspace();
        return ws.get_work_area_for_monitor(monitor.index);
    }
//----------------callbacks---------
    on_applet_reloaded() {
    }

    on_orientation_changed(orientation) {
        this.orientation = orientation;
        if (this.orientation === St.Side.LEFT || this.orientation === St.Side.RIGHT) {
            this.hide_applet_label(true);
        } else {
            this.hide_applet_label(false);
        }
        this.updateIconAndLabel();
        //this.refresh();
    }

    on_applet_added_to_panel() {
    }

    on_applet_removed_from_panel() {
        this.willUnmount = true;
        Main.keybindingManager.removeHotKey('overlay-key-' + this.instance_id);
        if (!this.settingsObj) {
            return;
        }
        this.settingsObj.finalize();
        this.signals.disconnectAllSignals();
        this.apps.destroy();
        this.allItemsDelete();
        if (!this.appsView) {
            this.destroyDisplayed();
        }
        this.menu.destroy();
    }

    on_applet_clicked() {
        if (!this.initialised) {
            this.set_applet_label(_('Please wait...'));
            return;
        }
        this.menu.toggle_with_options(this.settings.enableAnimation);
    }

    on_panel_height_changed() {
        //this.refresh();
    }

    on_applet_instances_changed(instance) {
      if (instance && instance.instance_id !== this.instance_id) {
          this.getOtherInstance = () => instance;
          instance.getOtherInstance = () => this;
      } else if (!instance && !this.willUnmount) {
          this.getOtherInstance = null;
      }
    }

    launchEditor() {
        Util.spawnCommandLine('cinnamon-menu-editor');
    }

    updateKeybinding() {
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

    updateIconAndLabel() {
        tryFn(() => {
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
        }, () => {
            global.logWarning('Could not load icon file ' + this.settings.menuIcon + ' for menu button');
        });

        if (this.settings.menuIconCustom && this.settings.menuIcon === '') {
            this._applet_icon_box.hide();
        } else {
            this._applet_icon_box.show();
        }

        if (this.orientation === St.Side.LEFT || this.orientation === St.Side.RIGHT) {
            this.set_applet_label('');
        } else {
            if (!this.panelMenuLabelText || this.panelMenuLabelText.length > 0) {
                if (!this.settings.menuLabel) {
                    this.settings.menuLabel = '';
                }
                this.set_applet_label(this.settings.menuLabel);
                this.set_applet_tooltip(this.settings.menuLabel);
            } else {
                this.set_applet_label('');
            }
        }
    }

    onEnableRecentChange() {
        this.recentEnabled = this.privacy_settings.get_boolean(REMEMBER_RECENT_KEY);
        this.categories.update();
        this.categoriesView.populate();
        if (this.currentCategory === 'recents' && !(this.settings.recentEnabled && this.settings.showRecents)) {
            this.currentCategory = 'all';
        }
    }

    onEnablePlacesChange() {
        this.categories.update();
        this.categoriesView.populate();
        if (this.currentCategory === 'places' && !this.settings.showPlaces) {
            this.currentCategory = 'all';
        }
    }

    onEnableFavAppsCategory() {
        this.categories.update();
        this.categoriesView.populate();
        if (this.currentCategory === 'favorite_apps' && !this.settings.showFavAppsCategory) {
            this.currentCategory = 'all';
        }
    }

    onEnableHomeFolderChange() {
        this.categories.update();
        this.categoriesView.populate();
    }

    onEnableWebBookmarksChange(enabled, fromInit = false) { //web bookmarks
        if (this.settings.enableWebBookmarks) {
            this.bookmarksManager = new BookmarksManager(this.appSystem);
        } else if (this.bookmarksManager) {
            this.bookmarksManager = null;
        }
        if (!fromInit) {
            this.categories.update();
            this.categoriesView.populate();
            if (this.currentCategory === 'bookmarks' && !this.settings.enableWebBookmarks) {
                this.currentCategory = 'all';
            }
        }
    }

    updateActivateOnHover(activate = true) {
        const openMenu = () => {
            if (!this._applet_context_menu.isOpen) {
                this.menu.open(this.settings.enableAnimation);
            }
        };

        if (this.settings.activateOnHover && activate) {
            this.signals.connect(this.actor, 'enter-event', () => {
                        setTimeout(() => openMenu(), this.settings.hoverDelayMs); });
        } else if (this.signals.isConnected('enter-event', this.actor)) {
            this.signals.disconnect('enter-event', this.actor);
        }
    }

    onFavoriteAppsChanged() {
        // Check if the menu has been rendered at least once
        if (this.appsView) {
            this.sidebar.populate();
            this.updateMenuWidth();
            this.updateMenuHeight();
            this.setActiveCategory(this.currentCategory);
        }

        /*
        Mainloop.idle_add_full(150, () => {
                if (this.dragging) {
                    const button = Util.find(this.allItems, (item) => item.app.appIndex === this.dragIndex);
                    if (button) {
                        this.scrollToButton(button);
                    }
                    //this.resetAllAppsOpacity();
                    this.dragging = false;
                } });*/
    }

    onIconsChanged() {
    }

    onThemeChanged() {
        this.updateIconAndLabel();
        setTimeout(() => this.refresh(), 0);
    }

    resetCategoryOrder() {//?undo
        if (!this.categoriesView) {
            return;
        }
        this.settings.categories = [];
        this.categories.update();
        this.categoriesView.populate();
    }
//==================================================================
    updateAfterFavFileChange() {
        this.sidebar.populate();
        this.categories.update();//in case fav files category needs adding/removing
        this.categoriesView.populate();
        this.updateMenuWidth();
        this.updateMenuHeight();
        if (this.currentCategory === 'favorite_files') {
            this.setActiveCategory(this.currentCategory);
        }
    }

    addFavoriteAppToPos(add_id, pos_id) {
        const pos = this.appFavorites._getIds().indexOf(pos_id);
        if (pos >= 0) { //move
            Meta.later_add(Meta.LaterType.BEFORE_REDRAW, () => {
                                    this.appFavorites.moveFavoriteToPos(add_id, pos);
                                    return false; });
        } else {
            Meta.later_add(Meta.LaterType.BEFORE_REDRAW, () => {
                                    this.appFavorites.addFavoriteAtPos(add_id, pos);
                                    return false; });
        }
    }

    moveCategoryToPos(id1, id2) { //?undo
        let categories = this.settings.categories.slice();
        const oldIndex = categories.indexOf(id1);
        const newIndex = categories.indexOf(id2);
        categories.splice(oldIndex, 1);
        this.settings.categories = categories.slice(0, newIndex).concat([id1]).concat(categories.slice(newIndex));
        this.resetAllCategoriesOpacity();
        this.categories.update();
        this.categoriesView.populate();
        /*this.categories.buttons.forEach( categoryButton => {
                                            if (categoryButton.id === id2) {
                                                categoryButton.handleEnter();
                                            } else if (categoryButton.entered) {
                                                categoryButton.handleLeave();
                                            } });*/
        this.setActiveCategory(this.currentCategory);
    }

    resetAllAppsOpacity() {
        this.appsView.getActiveContainer().get_children().forEach( child => child.set_opacity(255) );
    }

    resetAllCategoriesOpacity() {
        this.categories.buttons.forEach( (button) => button.actor.set_opacity(255) );
    }

    scrollToButton(button, fullyScrollFirstAndLast = false) {
        const container = button.actor.get_parent();
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

        if (this.settings.enableAnimation) {
            addTween(adjustment, { value: value, time: 0.1, transition: 'easeOutQuad' });
        } else {
            adjustment.set_value(value);
        }
    }

    clearEnteredActors() {
        if (this.contextMenu.isOpen) {
            this.contextMenu.close();
        }
        this.appsView.clearEnteredActors();
        this.sidebar.clearEnteredActors();
    }
//----------
    onOpenStateToggled(menu, open) {
        if (global.settings.get_boolean('panel-edit-mode')) {
            return false;
        }
        if (open) {
            this.categories.update();//in case menu editor updates
            this.categoriesView.populate();
            this.sidebar.populate();//in case fav files changed
            global.stage.set_key_focus(this.searchView.searchEntry);
            const currentCategory = this.settings.openOnFavorites && this.settings.showFavAppsCategory ?
                                                                'favorite_apps' : this.currentCategory;
            this.updateMenuWidth();
            this.updateMenuHeight();
            Mainloop.idle_add_full(Mainloop.PRIORITY_DEFAULT, () => this.setActiveCategory(currentCategory));
        } else {
            if (this.searchActive) {
                this.allItemsCleanup();
                this.searchView.searchEntry.set_text('');
                this.searchActive = false;
            }
            this.clearEnteredActors();
            this.appsView.clear();
            this.categoriesView.categoriesBox.remove_all_children();
        }
        return true;
    }

    onBoxResized(userWidth, userHeight){
        this.updateMenuHeight(userHeight);
        this.updateMenuWidth(userWidth);
        if (this.settings.applicationsViewMode === ApplicationsViewModeGRID) {
            if (this.previousColumns === this.getGridValues().columns) {
                this.appsView.applicationsGridBox.get_children().forEach(actor =>
                                                        actor.width = this.getGridValues().columnWidth );
            } else {
                this.setActiveCategory(this.currentCategory);
            }
        }
    }

    updateMenuHeight(newHeight) {
        if (!newHeight) {
            newHeight = this.settings.customMenuHeight;
        }
        const menuHeight = Math.min(newHeight, this.getScreenWorkArea().height);
        const appsHeight = menuHeight - this.bottomPane.height;
        this.appsView.applicationsScrollBox.height = appsHeight;
        this.categoriesView.groupCategoriesWorkspacesScrollBox.height = appsHeight;
        this.sidebar.sidebarScrollBox.set_height(-1);
        this.sidebar.sidebarScrollBox.set_height(Math.min(appsHeight, this.sidebar.sidebarScrollBox.height));
        if (!this.resizer.resizingInProgress) {
            //due to a intermittent bug causing cinnamon to crash, don't update settings while resizing
            //https://github.com/linuxmint/cinnamon/pull/9771#issuecomment-755081805
            this.settings.customMenuHeight = menuHeight;
        }
    }

    updateMenuWidth(newWidth) {
        if (!newWidth) {
            newWidth = this.settings.customMenuWidth;
        }
        let leftSideWidth = this.categoriesView.groupCategoriesWorkspacesScrollBox.width;
        if (this.settings.sidebarPlacement === PlacementLEFT ||
                                                this.settings.sidebarPlacement === PlacementRIGHT) {
            leftSideWidth += this.sidebar.sidebarScrollBox.width;
        }
        this.searchView.searchEntry.width = 5;//a small number to effectively set it to it's minimum width
                                              //for the purpose of calculating bottomPaneMinWidth
        let bottomPaneMinWidth = 0;
        if (this.settings.sidebarPlacement === PlacementTOP ||
                                                this.settings.sidebarPlacement === PlacementBOTTOM) {
            bottomPaneMinWidth = this.bottomPane.width;
        }
        let minMenuWidth = Math.max(leftSideWidth + 200, bottomPaneMinWidth);
        let menuWidth = Math.max(minMenuWidth, newWidth);
        if (!this.resizer.resizingInProgress) {
            //due to a intermittent bug causing cinnamon to crash, don't update settings while resizing
            //https://github.com/linuxmint/cinnamon/pull/9771#issuecomment-755081805
            this.settings.customMenuWidth = menuWidth;
        }
        this.appsView.applicationsListBox.width = menuWidth - leftSideWidth;
        this.appsView.applicationsGridBox.width = menuWidth - leftSideWidth;
    }

    refresh() {
        // TBD: For some reason the onEnable* settings callbacks get called several times per settings change,
        // This is causing the start up category to reset, so throttling this function to 250ms prevents excess
        // invocation.
        if (!this.lastRenderTime) this.lastRenderTime = 0;
        const now = Date.now();
        if ((now - this.lastRenderTime) <= 250) return;
        this.lastRenderTime = now;
        this.menu.removeAll();
        this.destroyDisplayed();
        if (this.currentCategory === 'places' && !this.settings.showPlaces ||
                        this.currentCategory === 'bookmarks' && !this.settings.enableWebBookmarks ||
                        this.currentCategory === 'recents' && !this.recentEnabled ||
                        this.currentCategory === 'favorite_apps' && !this.settings.showFavAppsCategory) {
            this.currentCategory = 'all';
        }
        this.initDisplay();
        this.clearEnteredActors();
        this.allItemsDelete();
    }

    setActiveCategory(categoryId) {
        if (this.willUnmount) {
            return;
        }
        this.currentCategory = categoryId;
        this.categories.buttons.forEach(categoryButton => {
                        if (categoryButton.id === categoryId) {
                            categoryButton.actor.set_style_class_name('menu-category-button-selected');
                        } else {
                            categoryButton.actor.set_style_class_name('menu-category-button');
                        } } );
        this.allItemsCleanup();
        this.appsView.clear();
        switch (categoryId) {
            case 'places':
                this.populateAppsBox(this.apps.listPlaces());
                break;
            case 'recents':
                const recents = this.apps.listRecent();
                this.populateAppsBox(recents);
                if (recents.length === 0) {
                    this.appsView.setAnswerText(_('No recent files'));
                }
                break;
            case 'favorite_files':
                this.populateAppsBox(this.apps.listFavoriteFiles());
                break;
            case 'bookmarks':
                this.populateAppsBox(this.apps.listWebBookmarks());
                break;
            case 'favorite_apps':
                this.populateAppsBox(this.apps.listFavoriteApps());
                break;
            default:
                if (categoryId.startsWith('/')) {
                    this.appsView.setAnswerText(categoryId);
                    this.populateAppsBox(this.apps.listFolder(categoryId));
                } else {
                    this.populateAppsBox(this.apps.listApplications(categoryId));
                }
        }
    }

    /*isNotInScrollView(button) {
        const adjustment = this.applicationsScrollBox.get_vscroll_bar().get_adjustment();
        const currentScrollValue = adjustment.get_value();
        const boxHeight = this.applicationsScrollBox.get_allocation_box().y2 -
                                                        this.applicationsScrollBox.get_allocation_box().y1;
        const allocationBox = button.actor.get_allocation_box();
        return boxHeight + currentScrollValue < allocationBox.y2 + 100;
    }*/

    onMenuKeyPress(actor, event) {
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

        const ctrlKey = modifierState & Clutter.ModifierType.CONTROL_MASK || symbol === 65507 || symbol === 65508;
        const shiftKey = modifierState === 1;
        const altKey = modifierState === 8;
        const altgrKey = modifierState === 128;
        const noModifiers = modifierState === 0;

        //Because Clutter.EVENT_PROPAGATE is returned on KEY_Left and KEY_Right, ignore duplicate
        //event emitted by ibus.
        if (!this.lastKeyEventTime) this.lastKeyEventTime = 0;
        const now = Date.now();
        if ((symbol === Clutter.KEY_Left || symbol === Clutter.KEY_Right) && noModifiers &&
                                                                (now - this.lastKeyEventTime) <= 80) {
            return Clutter.EVENT_PROPAGATE;
        }
        this.lastKeyEventTime = now;

        const sidebarButtons = this.sidebar.getButtons();
        const categoryButtons = this.categories.buttons;
        const appButtons = this.appsView.getActiveButtons();
        const enteredAppItemIndex = appButtons.findIndex(button =>
                        button.actor.has_style_class_name('menu-application-button-selected') ||
                                                                                    button.entered);
        let enteredCategoryIndex = categoryButtons.findIndex(button => button.entered);
        if (enteredCategoryIndex < 0) {
            enteredCategoryIndex = categoryButtons.findIndex(button => this.currentCategory === button.id);
        }
        const enteredSidebarItemIndex = sidebarButtons.findIndex(button => button.entered);

        const enteredAppItemExists = enteredAppItemIndex > -1;
        const enteredCategoryExists = enteredCategoryIndex > -1;
        let enteredSidebarItemExists = enteredSidebarItemIndex > -1;

        let enteredContextMenuItemExists = false;
        let contextMenuChildren = [];
        let enteredContextMenuItemIndex = -1;
        if (this.contextMenu.isOpen) {
            contextMenuChildren = this.contextMenu.contextMenuButtons;
            enteredContextMenuItemIndex = contextMenuChildren.findIndex(button => button.entered);
            if (enteredContextMenuItemIndex < 0) {
                enteredContextMenuItemIndex = 0;
            }
            enteredContextMenuItemExists = true;
        }

        let startingCategoryIndex = categoryButtons.findIndex(button =>
                                                                    this.currentCategory === button.id);
        if (startingCategoryIndex < 0) {
            startingCategoryIndex = 0;
        }

        const leaveCurrentlyEnteredItem = () => {
            if (enteredContextMenuItemExists) {
                contextMenuChildren[enteredContextMenuItemIndex].handleLeave();
            } else if (enteredAppItemExists) {
                appButtons[enteredAppItemIndex].handleLeave();
            } else if (enteredSidebarItemExists) {
                sidebarButtons[enteredSidebarItemIndex].handleLeave();
            } else if (enteredCategoryExists) {
                categoryButtons[enteredCategoryIndex].handleLeave();
            }
        };

        const nextSidebarItem = () => {
            if (enteredSidebarItemIndex < sidebarButtons.length - 1) {
                    sidebarButtons[enteredSidebarItemIndex + 1].handleEnter();
            } else {
                sidebarButtons[0].handleEnter();
            }
        };

        const previousSidebarItem = () => {
            if (enteredSidebarItemIndex === 0) {
                    sidebarButtons[sidebarButtons.length -1].handleEnter();
            } else {
                sidebarButtons[enteredSidebarItemIndex - 1].handleEnter();
            }
        };

        const leftNavigation = () => {
            if (enteredContextMenuItemExists) {
                contextMenuChildren[enteredContextMenuItemIndex].handleEnter();//effectively ignore
            } else if (enteredSidebarItemExists) {
                if (this.settings.sidebarPlacement === PlacementLEFT ||
                                                this.settings.sidebarPlacement === PlacementRIGHT) {
                    categoryButtons[startingCategoryIndex].handleEnter();
                } else {
                    previousSidebarItem();
                }
            } else if (enteredAppItemExists) {
                if (this.settings.applicationsViewMode === ApplicationsViewModeLIST) {
                    categoryButtons[startingCategoryIndex].handleEnter();
                } else {
                    if (enteredAppItemIndex > 0) {
                        appButtons[enteredAppItemIndex - 1].handleEnter();
                    } else {
                        appButtons[appButtons.length - 1].handleEnter();
                    }
                }
            } else if (enteredCategoryExists) {
                sidebarButtons[0].handleEnter();
            }
        };

        const rightNavigation = () => {
            if (enteredContextMenuItemExists) {
                contextMenuChildren[enteredContextMenuItemIndex].handleEnter();//Ignore
            } else if (enteredSidebarItemExists) {
                if (this.settings.sidebarPlacement === PlacementLEFT ||
                                                    this.settings.sidebarPlacement === PlacementRIGHT) {
                    categoryButtons[startingCategoryIndex].handleEnter();
                } else {
                    nextSidebarItem();
                }
            } else if (enteredAppItemExists) {
                if (this.settings.applicationsViewMode === ApplicationsViewModeLIST) {
                    appButtons[enteredAppItemIndex].handleEnter();//ignore
                } else {
                    if (appButtons[enteredAppItemIndex + 1]) {
                        appButtons[enteredAppItemIndex + 1].handleEnter();
                    } else {
                        appButtons[0].handleEnter();
                    }
                }
            } else if (enteredCategoryExists) {
                appButtons[0].handleEnter();
            }
        };

        const downNavigation = () => {
            if (enteredContextMenuItemExists) {
                if (contextMenuChildren[enteredContextMenuItemIndex + 1]) {
                    contextMenuChildren[enteredContextMenuItemIndex + 1].handleEnter();
                } else {
                    contextMenuChildren[0].handleEnter();
                }
            } else if (enteredSidebarItemExists) {
                if (this.settings.sidebarPlacement === PlacementTOP ||
                                                    this.settings.sidebarPlacement === PlacementBOTTOM) {
                    categoryButtons[startingCategoryIndex].handleEnter();
                } else {
                    nextSidebarItem();
                }
            } else if (enteredAppItemExists) {
                if (this.settings.applicationsViewMode === ApplicationsViewModeLIST) {
                    if (appButtons[enteredAppItemIndex + 1]) {
                        appButtons[enteredAppItemIndex + 1].handleEnter();
                    } else {
                        appButtons[0].handleEnter();
                    }
                } else {//grid view
                    if (appButtons[enteredAppItemIndex + this.getGridValues().columns]) {
                        appButtons[enteredAppItemIndex + this.getGridValues().columns].handleEnter();
                    } else {
                        appButtons[appButtons.length - 1].handleEnter();
                    }
                }
            } else if (enteredCategoryExists) {
                if (categoryButtons[enteredCategoryIndex + 1]) {
                    categoryButtons[enteredCategoryIndex + 1].handleEnter();
                } else {
                    categoryButtons[0].handleEnter();
                }
            }
        };

        const upNavigation = () => {
            if (enteredContextMenuItemExists) {
                if (enteredContextMenuItemIndex > 0) {
                    contextMenuChildren[enteredContextMenuItemIndex - 1].handleEnter();
                } else {
                    contextMenuChildren[contextMenuChildren.length - 1].handleEnter();
                }
            } else if (enteredSidebarItemExists) {
                if (this.settings.sidebarPlacement === PlacementTOP ||
                                                this.settings.sidebarPlacement === PlacementBOTTOM) {
                    categoryButtons[startingCategoryIndex].handleEnter();
                } else {
                    previousSidebarItem();
                }
            } else if (enteredAppItemExists) {
                if (this.settings.applicationsViewMode === ApplicationsViewModeLIST) {
                    if (enteredAppItemIndex > 0) {
                        appButtons[enteredAppItemIndex - 1].handleEnter();
                    } else {
                        appButtons[appButtons.length - 1].handleEnter();
                    }
                } else {
                    if (appButtons[enteredAppItemIndex - this.getGridValues().columns]) {
                        appButtons[enteredAppItemIndex - this.getGridValues().columns].handleEnter();
                    } else {
                        appButtons[0].handleEnter();
                    }
                }
            } else if (enteredCategoryExists) {
                if (enteredCategoryIndex > 0) {
                    categoryButtons[enteredCategoryIndex - 1].handleEnter();
                } else {
                    categoryButtons[categoryButtons.length - 1].handleEnter();
                }
            }
        };

        const tabNavigation = () => {
            if (enteredContextMenuItemExists) {
                contextMenuChildren[enteredContextMenuItemIndex].handleEnter();//effectively ignore keypress
            } else if (enteredAppItemExists) {
                sidebarButtons[0].handleEnter();
            } else if (enteredSidebarItemExists && !this.searchActive) {
                categoryButtons[startingCategoryIndex].handleEnter();
            } else {
                appButtons[0].handleEnter();
            }
        };

        const shiftTabNavigation = () => {
            if (enteredContextMenuItemExists) {
                contextMenuChildren[enteredContextMenuItemIndex].handleEnter();//effectively ignore keypress
            } else if (enteredAppItemExists) {
                categoryButtons[startingCategoryIndex].handleEnter();
            } else if (enteredSidebarItemExists && !this.searchActive) {
                appButtons[0].handleEnter();
            } else {
                sidebarButtons[0].handleEnter();
            }
        };

        const activateItem = () => {
            if (enteredContextMenuItemExists) {
                contextMenuChildren[enteredContextMenuItemIndex].activate();
            } else if (enteredAppItemExists) {
                appButtons[enteredAppItemIndex].activate();
            } else if (enteredSidebarItemExists) {
                sidebarButtons[enteredSidebarItemIndex].activate();
            } else if (enteredCategoryExists) {
                categoryButtons[enteredCategoryIndex].selectCategory();
            }
        };

        const activateContextMenu = () => {
            if (this.contextMenu.isOpen) {
                this.contextMenu.close();
            } else if (enteredAppItemExists) {
                appButtons[enteredAppItemIndex].openContextMenu();
            } else if (enteredSidebarItemExists) {
                sidebarButtons[enteredSidebarItemIndex].openContextMenu();
            } else if (enteredCategoryExists) {
                categoryButtons[enteredCategoryIndex].openContextMenu();
            }
        };

        /*const moveCategory = (direction) => {
            if (!enteredAppItemExists && !enteredSidebarItemExists && !enteredContextMenuItemExists &&
                                                                                    enteredCategoryExists) {
                if (direction === "up" && enteredCategoryIndex > 0) {
                    this.state.trigger('moveCategoryToPos', categoryButtons[enteredCategoryIndex].id,
                                                        categoryButtons[enteredCategoryIndex - 1].id);
                    categoryButtons[enteredCategoryIndex - 1].handleEnter();
                } else if (direction === "down" && enteredCategoryIndex < categoryButtons.length - 1) {
                    this.state.trigger('moveCategoryToPos', categoryButtons[enteredCategoryIndex].id,
                                                        categoryButtons[enteredCategoryIndex + 1].id);
                    categoryButtons[enteredCategoryIndex + 1].handleEnter();
                }
            }
        };*/

        switch (true) {
            case symbol === Clutter.KP_Enter || symbol === Clutter.KEY_Return:
                if (ctrlKey) {
                    activateContextMenu();
                } else if (noModifiers) {
                    activateItem();
                } else {
                    return Clutter.EVENT_PROPAGATE;
                }
                return Clutter.EVENT_STOP;
            case (symbol === Clutter.KEY_Menu && noModifiers):
                activateContextMenu();
                return Clutter.EVENT_STOP;
            case (symbol === Clutter.KEY_Up && noModifiers):
                leaveCurrentlyEnteredItem();
                upNavigation();
                return Clutter.EVENT_STOP;
            /*case (symbol === Clutter.KEY_Up && modifierState === 4)://ctrl up
                moveCategory("up");
                return true;*/
            case (symbol === Clutter.KEY_Down && noModifiers):
                leaveCurrentlyEnteredItem();
                downNavigation();
                return Clutter.EVENT_STOP;
            /*case (symbol === Clutter.KEY_Down && modifierState === 4)://ctrl down
                moveCategory("down");
                return true;*/
            case (symbol === Clutter.KEY_Right && noModifiers):
                leaveCurrentlyEnteredItem();
                rightNavigation();
                return Clutter.EVENT_PROPAGATE; //so that left/right can also be used to navigate search entry
            case (symbol === Clutter.KEY_Left && noModifiers):
                leaveCurrentlyEnteredItem();
                leftNavigation();
                return Clutter.EVENT_PROPAGATE; //so that left/right can also be used to navigate search entry
            case symbol === Clutter.ISO_Left_Tab || symbol === Clutter.Tab:
                if (altKey) {  //Close menu as alt-tab is used for app-switcher in cinnamon
                    this.closeMenu();
                    return Clutter.EVENT_STOP;
                } else if (noModifiers) {
                    leaveCurrentlyEnteredItem();
                    tabNavigation();
                    return Clutter.EVENT_STOP;
                } else if (shiftKey) {
                    leaveCurrentlyEnteredItem();
                    shiftTabNavigation();
                    return Clutter.EVENT_STOP;
                }
                return Clutter.EVENT_PROPAGATE;
            case (symbol === Clutter.Escape || symbol === Clutter.KEY_Escape) && noModifiers:
                if (this.contextMenu.isOpen) {
                    this.contextMenu.close();
                } else {
                    this.closeMenu();
                }
                return Clutter.EVENT_STOP;
            case (symbol === Clutter.KEY_Page_Up && noModifiers):
                leaveCurrentlyEnteredItem();
                if (enteredAppItemExists) {
                    appButtons[0].handleEnter();
                } else if (enteredSidebarItemExists) {
                    sidebarButtons[0].handleEnter();
                } else {
                    categoryButtons[0].handleEnter();
                }
                return Clutter.EVENT_STOP;
            case (symbol === Clutter.KEY_Page_Down && noModifiers):
                leaveCurrentlyEnteredItem();
                if (enteredAppItemExists) {
                    appButtons[appButtons.length - 1].handleEnter();
                } else if (enteredSidebarItemExists) {
                    sidebarButtons[sidebarButtons.length - 1].handleEnter();
                } else {
                    categoryButtons[categoryButtons.length - 1].handleEnter();
                }
                return Clutter.EVENT_STOP;
            default:
                return Clutter.EVENT_PROPAGATE;
        }
    }

    allItemsCleanup() {
        const allItems = this.allItems.filter( (item) => {
                        if (item.app.type === APPTYPE.provider || item.app.type === APPTYPE.file &&
                                                                            !item.app.isRecentFile) {
                            item.destroy(true);
                            item = undefined;
                            return false;
                        } else {
                            //this.allItems[i].app.nameWithSearchMarkup = null;
                            //this.allItems[i].app.descriptionWithSearchMarkup = null;
                            //this.allItems[i].app.keywordsWithSearchMarkup = null;
                            //this.allItems[i].app.idWithSearchMarkup = null;
                            return true;
                        } });
        this.allItems = allItems;
    }

    allItemsDelete() {
        this.allItems.forEach(item => { if (item) item.destroy(); });
        this.allItems = [];
    }

    onSearchTextChanged() {
        const searchText = this.searchView.searchEntryText.get_text();

        if (searchText.length === 0) {
            this.allItemsCleanup();
            this.searchActive = false;
            this.categories.buttons.forEach(button => button.enable());
            this.setActiveCategory(this.currentCategory);
            if (this.signals.isConnected('secondary-icon-clicked', this.searchView.searchEntry)) {
                this.signals.disconnect('secondary-icon-clicked', this.searchView.searchEntry, this);
            }
            this.searchView.showSecondaryIcon(false);
            this.previousSearchPattern = '';
            return;
        }

        this.categories.buttons.forEach(button => button.disable());
        this.searchActive = true;
        this.currentSearchStr = searchText;
        this.appsView.setAnswerText(null);
        this.clearEnteredActors();
        this.searchView.showSecondaryIcon(true);
        if (!this.signals.isConnected('secondary-icon-clicked', this.searchView.searchEntry)) {
            this.signals.connect(this.searchView.searchEntry, 'secondary-icon-clicked', () => {
                                                        this.clearEnteredActors();
                                                        this.searchView.searchEntryText.set_text('');
                                                        this.onSearchTextChanged();
                                                        }, this);
        }
        setTimeout(() => this.doSearch(searchText), 0);
    }

    doSearch(text) {
        //this fuction has been called asynchronously meaning that a keypress may have changed the
        //search query before this function is called. Check that this search is still valid.
        if (text !== this.currentSearchStr) return;
        //if (!text || !text.trim()) return;
        const pattern = Util.latinise(text.toLowerCase());
        //Don't repeat the same search. This can happen if a key and backspace are pressed in quick
        //succession while a previous search is being carried out.
        if (pattern === this.previousSearchPattern) {
            return false;
        }
        this.previousSearchPattern = pattern;
        let results = this.apps.listApplications('all', pattern)
                            .concat(this.settings.showPlaces ? this.apps.listPlaces(pattern) : [])
                            .concat(this.settings.enableWebBookmarks ? this.apps.listWebBookmarks(pattern) : [])
                            .concat(this.recentEnabled ? this.apps.listRecent(pattern) : [])
                            .concat(this.apps.listFavoriteFiles(pattern));

        results.sort( (a, b) =>  a.score < b.score );
        if (results.length > 10) {
            results.length = 10;
        }
        //-----search providers-------
        //---calculator---
        const replacefn = (match) => {
            if (['E','PI','abs','acos','acosh','asin','asinh','atan','atanh','cbrt','ceil','cos',
            'cosh','exp','floor','fround','log','max','min','pow','random','round','sign','sin',
            'sinh','sqrt','tan','tanh','trunc'].includes(match)) {
                return "Math." + match;
            } else {
                validExp = false;
                return match;
            }
        };
        let validExp = true;
        let ans = null;
        const exp = text.replace(/([a-zA-Z]+)/g, replacefn);
        if (validExp) {
            ans = tryFn(()=>{ return eval(exp); }, null);
        }
        if ((typeof ans === 'number' || typeof ans === 'boolean') && ans != text ) {
            const calcIcon = Gio.file_new_for_path(__meta.path + '/calc.png');
            results.push({  type: APPTYPE.provider,
                            name: _('Solution:') + ' ' + ans,
                            description: _('Click to copy'),
                            icon: new St.Icon({ gicon: new Gio.FileIcon({ file: calcIcon }),
                                                                        icon_size: this.getAppIconSize() }),
                            activate: () => {   const clipboard = St.Clipboard.get_default();
                                                clipboard.set_text(St.ClipboardType.CLIPBOARD, ans.toString());}
                         });
        }
        //---web search option---
        if (this.settings.webSearchOption != 4) {//4=none
            const iconName = ['google_icon.png',"bing_icon.png",'yahoo_icon.png',
                                                'duckgo_icon.png'][this.settings.webSearchOption];
            const url = ['google.com/search?q=','www.bing.com/search?q=','search.yahoo.com/search?p=',
                                                    'duckduckgo.com/?q='][this.settings.webSearchOption];
            results.push(   {   type: APPTYPE.provider,
                                name: _('Search web for') + ' "' + text + '"',
                                description: '',
                                icon: new St.Icon({ gicon: new Gio.FileIcon({
                                            file: Gio.file_new_for_path(__meta.path + '/' + iconName)}),
                                            icon_size: this.getAppIconSize() }),
                                activate: () => {Util.spawnCommandLineAsync(
                                        '/usr/bin/xdg-open https://' + url + encodeURIComponent(text));}
                            } );
        }
        //---emoji search------
        if (pattern.length > 2 && this.settings.enableEmojiSearch) {
            let emojiResults = [];
            EMOJI.forEach(emoji => {
                        const match1 = searchStr(pattern, emoji.name, true);
                        const match2 = searchStr(pattern, emoji.keywords, true);
                        match2.score *= 0.95; //slightly lower priority for keyword match
                        const bestMatchScore = Math.max(match1.score, match2.score);
                        if (bestMatchScore > SEARCH_THRESHOLD) {
                            emojiResults.push({
                                    name: emoji.name,
                                    score: bestMatchScore,
                                    description: _('Click to copy'),
                                    nameWithSearchMarkup: match1.result,
                                    keywordsWithSearchMarkup: match2.result,
                                    type: APPTYPE.provider,
                                    emoji: emoji.code,
                                    activate: () => { const clipboard = St.Clipboard.get_default();
                                        clipboard.set_text(St.ClipboardType.CLIPBOARD, emoji.code);}
                                        });
                        } });
            //
            emojiResults.sort( (a, b) =>  a.score < b.score );
            results = results.concat(emojiResults);
        }
        //---search providers---
        const finish = () => {
            this.appsView.clear();
            this.populateAppsBox(results);
            const buttons = this.appsView.getActiveButtons();
            if (buttons.length > 0) {
                buttons[0].handleEnter();
            }
        };
        if (pattern.length > 2) {//} && this.settings.enableSearchProviders) {
            launch_all(pattern, (provider, providerResults) => {
                        providerResults.forEach(providerResult => {
                            if (!providerResult) {
                                return;
                            }
                            providerResult.type = APPTYPE.provider;
                            providerResult.name = providerResult.label.replace(/ : /g, ': ');
                            providerResult.activate = provider.on_result_selected;
                            providerResult.score = 0.1;
                            if (providerResult.icon) {
                                providerResult.icon.icon_size = this.getAppIconSize();
                            } else if (providerResult.icon_app){
                                providerResult.icon = providerResult.icon_app.create_icon_texture(
                                                                                            this.getAppIconSize());
                            } else if (providerResult.icon_filename){
                                providerResult.icon = new St.Icon({
                                      gicon: new Gio.FileIcon({
                                                file: Gio.file_new_for_path(providerResults[i].icon_filename)}),
                                                icon_size: this.getAppIconSize() });
                            }
                        });
                        if (!this.searchActive) {
                            return;
                        }
                        if (providerResults && providerResults.length > 0) {
                            results = results.concat(providerResults);
                        }
                        finish(); } );
            finish();
        } else {
            finish();
        }
        //----------------------------------
        return false;
    }

    /*searchDir(folder, pattern, res) {
        const dir = Gio.file_new_for_path(folder);
        let enumerator;
        tryFn(() => {   enumerator = dir.enumerate_children("standard::*", 0, null); }, (e) => {
                            this.appThis.appsView.setAnswerText(e.message); });
        let next;
        if (enumerator) {
            next = enumerator.next_file(null);
        }
        while (next) {
            const filename = next.get_name();
            if (filename.toLowerCase().startsWith(pattern)) {
                const file = Gio.file_new_for_path(folder + (folder === '/' ? '' : '/') + filename);
                const foundFile = { name: next.get_name(),
                                    icon: null,
                                    gicon: next.get_icon(),
                                    uri: file.get_uri(),
                                    mimeType: next.get_content_type(),
                                    isDirectory: file.query_file_type(0, null) === 2,
                                    description: '',//file.get_path(),
                                    type: APPTYPE.file };
                res.push(foundFile);
            }
            next = enumerator.next_file(null);
        }
        return res;
    }*/

    populateAppsBox(appList) {
        if (!appList) {
            return false;
        }
        let column = 0;
        let rownum = 0;

        const addAppButton = (app) => {
            let appButton = this.allItems.find(item => item && item.app === app);

            if (!appButton) {
                appButton = new AppButton(this, app);
                this.allItems.push(appButton);
            }

            if (this.settings.applicationsViewMode === ApplicationsViewModeLIST) {
                this.appsView.applicationsListBox.add_actor(appButton.actor);
            } else {
                const gridLayout = this.appsView.applicationsGridBox.layout_manager;
                if (!gridLayout) {
                    return false;
                }
                appButton.setWidth();// In case menu is being resized.
                gridLayout.attach(appButton.actor, column, rownum, 1, 1);
                column++;

                if (column > this.getGridValues().columns - 1) {
                    column = 0;
                    rownum++;
                }
            }
        };
        this.appsView.applicationsListBox.hide();//hide while populating for performance.
        this.appsView.applicationsGridBox.hide();//
        let appCount = appList.length;
        if (appCount > 1000) {
            this.appsView.setAnswerText(_('Too many entries - showing first 1000 entries only'));
            appCount = 1000;
        }
        for (let i = 0; i < appCount; i++) {
            addAppButton(appList[i]);
        }
        if (this.settings.applicationsViewMode === ApplicationsViewModeLIST) {
            this.appsView.applicationsListBox.show();
        } else {
            this.appsView.applicationsGridBox.show();
        }

        this.previousColumns = this.getGridValues().columns;
    }
//--------------------
    initDisplay() {
        //==================bottomPane================
        const sidebarPlacement = this.settings.sidebarPlacement;
        this.sidebar = new Sidebar(this, sidebarPlacement);
        this.searchView = new SearchView(this);
        this.displaySignals.connect(this.searchView.searchEntryText, 'text-changed',
                                                        (...args) => this.onSearchTextChanged(...args));
        this.displaySignals.connect(this.searchView.searchEntryText, 'key-press-event',
                                                            (...args) => this.onMenuKeyPress(...args));
        //this.previousSearchPattern = '';
        this.bottomPane = new St.BoxLayout({ /*style: 'padding-top: 12px;'*/ });
        if (sidebarPlacement === PlacementTOP || sidebarPlacement === PlacementBOTTOM) {
            this.bottomPane.add(this.sidebar.sidebarScrollBox, { expand: false, x_fill: false, y_fill: false,
                                                  x_align: St.Align.START, y_align: St.Align.MIDDLE });
        }
        this.bottomPane.add(this.searchView.searchBox, { expand: true, x_fill: true, y_fill: false,
                                        x_align: St.Align.END, y_align: St.Align.MIDDLE, align_end: true });
        //=================middlePane======================
        this.contextMenu = new ContextMenu(this);
        this.appsView = new AppsView(this);
        this.categoriesView = new CategoriesView(this);
        this.categories.update();
        this.categoriesView.populate();//just for init sizing
        this.middlePane = new St.BoxLayout({ style_class: '' });
        if (sidebarPlacement === PlacementLEFT) {
            this.middlePane.add(this.sidebar.sidebarScrollBox, { expand: false, x_fill: false, y_fill: false,
                                                    x_align: St.Align.START, y_align: St.Align.MIDDLE });
        }
        this.middlePane.add(this.categoriesView.groupCategoriesWorkspacesScrollBox, { x_fill: false, y_fill: false,
                                                    x_align: St.Align.START, y_align: St.Align.START });
        this.middlePane.add(this.appsView.applicationsScrollBox, { x_fill: false, y_fill: false,
                                            x_align: St.Align.START, y_align: St.Align.START, expand: false });
        if (sidebarPlacement === PlacementRIGHT) {
            this.middlePane.add(this.sidebar.sidebarScrollBox, { expand: false, x_fill: false, y_fill: false,
                                                    x_align: St.Align.START, y_align: St.Align.MIDDLE });
        }
        //=============mainBox================
        //set style: 'spacing: 0px' so that extra space is not added to mainBox when contextMenuBox is
        //added. Only happens with themes that have set a spacing value on this node.
        this.mainBox = new St.BoxLayout({ style_class: 'menu-applications-outer-box', style: 'spacing: 0px',
                                        vertical: true, reactive: true,
                                        show_on_set_parent: false });
        this.mainBox.add_style_class_name('menu-applications-box'); //this is to support old themes
        // mainbox packs vertically
        if (sidebarPlacement === PlacementTOP) {
            this.mainBox.add(this.bottomPane);
        }
        this.mainBox.add_actor(this.middlePane);
        if (sidebarPlacement !== PlacementTOP) {
            this.mainBox.add(this.bottomPane);
        }

        //Add contextMenuBox to the stage by adding it to mainBox with it's height set to 0. contextMenuBox
        //is then positioned at mouse coords and above siblings.
        this.mainBox.add(this.contextMenu.contextMenuBox, {expand: false, x_fill: false,
                                                    x_align: St.Align.START, y_align: St.Align.MIDDLE,});
        // add all to section
        const section = new PopupMenuSection();
        section.actor.add_actor(this.mainBox);
        this.menu.addMenuItem(section);
        //if a blank part of the menu was clicked on, close context menu
        this.menu.actor.set_reactive(true);
        this.displaySignals.connect(this.menu.actor, 'button-release-event',
                                            (...args) => {
                                                    if (!this.stopMouseEvent) {
                                                        this.clearEnteredActors();
                                                    } else {
                                                        this.stopMouseEvent = false;
                                                    } });
        //monitor mouse motion to prevent category mis-selection
        this.categoriesView.categoriesBox.set_reactive(true);
        this.displaySignals.connect(this.categoriesView.categoriesBox, "motion-event",
                                                        (...args) => this.onMouseMotion(...args));
        //Limit excessive left padding on categoriesBox
        const Lpadding = this.categoriesView.categoriesBox.get_theme_node().get_length('padding-left');
        if (Lpadding > 20) {
            this.categoriesView.categoriesBox.style = 'padding-left: 20px;';
        }
        this.sidebar.populate();

        if (this.settings.applicationsViewMode === ApplicationsViewModeLIST) {
            //this.appsView.applicationsGridBox.width = this.appsView.applicationsListBox.width;
            this.appsView.applicationsGridBox.hide();
            this.appsView.applicationsListBox.show();
        } else {
            //this.appsView.applicationsGridBox.width = this.getGridWidth();
            this.appsView.applicationsListBox.hide();
            this.appsView.applicationsGridBox.show();
        }
        // switch activeContainer
        /*if (isListView) {
            // reset active container
            const vscroll = this.applicationsScrollBox.get_vscroll_bar();
            const newScrollValue = this.applicationsScrollBox.get_allocation_box().y1;
            vscroll.get_adjustment().set_value(newScrollValue);
        }*/
        this.mainBox.show();
        this.updateMenuHeight();
    }

    onMouseMotion(actor, event) {
        //keep track of mouse motion to prevent misselection of another category button when moving mouse
        //pointer from selected category button to app button by calculating angle of pointer movement
        let [x, y] = event.get_coords();
        if (!this.mTrack) {
            this.mTrack = [];
        }
        //compare current position with oldest position in last 0.1 seconds.
        this.mTrack.push({time: Date.now(), x: x, y: y});
        while (this.mTrack[0].time + 100 < Date.now()) {
            this.mTrack.shift();
        }
        const dx = x - this.mTrack[0].x;
        const dy = Math.abs(y - this.mTrack[0].y);

        const tan = dx / dy;
        this.badAngle = tan > 0.3;//if tan = +infinity, badAngle is true.
                                  //if tan = -infinity or NaN, badAngle is false.
    }

    destroyDisplayed() {
        const destroyContainer = (container) => {
                        if (typeof this[container] === 'undefined') return false;
                        container = this[container];
                        if (!container || container.is_finalized()) return false;
                        container.get_children().forEach(child => child.destroy());
                        container.destroy();
                        return true; };
        this.displaySignals.disconnectAllSignals();
        this.categories.buttons.forEach(categoryButton => {categoryButton.destroy();
                                                        categoryButton = null;});
        this.categories.buttons = [];
        if (this.searchView) {
            this.searchView.destroy();
            this.searchView = null;
        }
        if (this.appsView) {
            this.appsView.destroy();
            this.appsView = null;
        }
        if (this.sidebar) {
            this.sidebar.destroy();
            this.sidebar = null;
        }
        if (this.categoriesView) {
            this.categoriesView.destroy();
            this.categoriesView = null;
        }
        if (this.contextMenu) {
            this.contextMenu.destroy();
            this.contextMenu = null;
        }
        destroyContainer('middlePane');
        destroyContainer('bottomPane');
        destroyContainer('mainbox');
    }
}

class Categories {
    constructor(appThis) {
        this.appThis = appThis;
        this.buttons = [];
    }

    update() {
        //Put all enabled categories into newButtons[] in default order by reusing the
        //buttons in this.buttons or creating new button.
        const newButtons = [];

        let button = this.buttons.find( button => button.id === 'all');
        if (!button) {
            button = new CategoryButton(this.appThis, 'all', _('All applications'), 'computer');
        }
        newButtons.push(button);

        const dirs = [];
        const iter = this.appThis.appSystem.get_tree().get_root_directory().iter();
        let nextType;
        while ((nextType = iter.next()) !== CMenu.TreeItemType.INVALID) {
            if (nextType === CMenu.TreeItemType.DIRECTORY) {
                dirs.push(iter.get_directory());
            }
        }
        dirs.sort((a, b) => {
                        const prefCats = ['administration', 'preferences'];
                        const prefIdA = prefCats.indexOf(a.get_menu_id().toLowerCase());
                        const prefIdB = prefCats.indexOf(b.get_menu_id().toLowerCase());
                        if (prefIdA < 0 && prefIdB >= 0) return -1;
                        if (prefIdA >= 0 && prefIdB < 0) return 1;
                        const nameA = a.get_name().toLowerCase();
                        const nameB = b.get_name().toLowerCase();
                        return (nameA > nameB) ? 1 : ( (nameA < nameB) ? -1 : 0 );  });
        dirs.forEach(dir => {
                    if (!dir.get_is_nodisplay()) {
                        const dirId = dir.get_menu_id();
                        const categoryApps = this.appThis.apps.getAppsByCategory(dirId);
                        if (categoryApps.length > 0) {
                            let button = this.buttons.find(button => button.id === dirId);
                            if (!button) {
                                button = new CategoryButton(this.appThis, dir, dirId);
                            }
                            const newAppIndex = categoryApps.findIndex(app => app.newAppShouldHighlight);
                            button.setHighlight(newAppIndex >= 0);//highlight category if it contains a new app
                            newButtons.push(button);
                        }
                    } });

        const enableFavFiles = XApp.Favorites && XApp.Favorites.get_default().get_favorites(null).length > 0;
        const home = GLib.get_home_dir();
        [   [enableFavFiles, 'favorite_files', _('Favorites'), 'xapp-user-favorites'],
            [this.appThis.settings.showPlaces, 'places', _('Places'), 'folder'],
            [this.appThis.recentEnabled && this.appThis.settings.showRecents, 'recents', _('Recent files'),
                                            'document-open-recent'], //'folder-recent folder-documents-recent'
            [this.appThis.settings.enableWebBookmarks, 'bookmarks', _('Bookmarks'), 'user-bookmarks'],
            [this.appThis.settings.showFavAppsCategory, 'favorite_apps', _('Favorite apps'), 'emblem-favorite'],
            [this.appThis.settings.showHomeFolder, home,_('Home folder'), 'user-home']
        ].forEach(param => {
                if (param[0]) {
                    let button = this.buttons.find(button => button.id === param[1]);
                    if (!button) {
                        button = new CategoryButton(this.appThis, param[1], param[2], param[3]);
                    }
                    newButtons.push(button);
                } });
        //set user category order to default if none already
        if (this.appThis.settings.categories.length === 0) {
            this.appThis.settings.categories = newButtons.map( button => button.id);
        }
        //add new found categories to user category order
        newButtons.forEach(newButton => {
            if (this.appThis.settings.categories.indexOf(newButton.id) === -1) {
                this.appThis.settings.categories.push(newButton.id);
            }
        });
        //add all newButtons[] to this.buttons in user prefered order
        this.buttons = [];
        this.appThis.settings.categories.forEach(buttonId => {
            const foundButton = newButtons.find(newButton => newButton.id === buttonId);
            if (foundButton) {
                this.buttons.push(foundButton);
            }
        });
    }
}

class CategoriesView {
    constructor(appThis) {
        this.appThis = appThis;

        this.categoriesBox = new St.BoxLayout({ style_class: 'menu-categories-box', vertical: true });
        this.groupCategoriesWorkspacesWrapper = new St.BoxLayout({/*style: 'max-width: 185px;',*/
                                                                                    vertical: true });
        this.groupCategoriesWorkspacesWrapper.add(this.categoriesBox, {
                                              x_fill: false, y_fill: true,
                                              x_align: St.Align.START, y_align: St.Align.END,
                                              y_expand: true, expand: false });
        // groupCategoriesWorkspacesScrollBox allows categories or workspaces to scroll vertically
        this.groupCategoriesWorkspacesScrollBox = new St.ScrollView({ x_fill: true, y_fill: false,
                                    y_align: St.Align.START, style_class: 'vfade menu-categories-scrollbox' });

        const vscrollCategories = this.groupCategoriesWorkspacesScrollBox.get_vscroll_bar();
        this.appThis.displaySignals.connect(vscrollCategories, 'scroll-start',
                                                                () => { this.appThis.menu.passEvents = true; });
        this.appThis.displaySignals.connect(vscrollCategories, 'scroll-stop',
                                                                () => { this.appThis.menu.passEvents = false; });
        this.groupCategoriesWorkspacesScrollBox.add_actor(this.groupCategoriesWorkspacesWrapper);
        this.groupCategoriesWorkspacesScrollBox.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.NEVER);
        this.groupCategoriesWorkspacesScrollBox.set_auto_scrolling(this.appThis.settings.enableAutoScroll);
        this.groupCategoriesWorkspacesScrollBox.set_mouse_scrolling(true);
    }

    populate() {
        this.categoriesBox.remove_all_children();
        this.appThis.categories.buttons.forEach((button) => this.categoriesBox.add_actor(button.actor));
    }

    destroy() {
        if (!this.categoriesBox.is_finalized()) {
            this.categoriesBox.get_children().forEach(child => child.destroy());
        }
        this.categoriesBox.destroy();
        this.groupCategoriesWorkspacesWrapper.destroy();
        this.groupCategoriesWorkspacesScrollBox.destroy();
    }
}

class AppsView {
    constructor(appThis) {
        this.appThis = appThis;

        this.applicationsListBox = new St.BoxLayout({ /*style: 'min-width: 300px;',*/ vertical: true });
        this.applicationsGridBox = new Clutter.Actor({ layout_manager: new Clutter.GridLayout(),
                                                       reactive: true });
        this.answerText = new St.Label({ style_class: 'menu-selected-app-title',
                                         style: 'padding-top: 14px; min-width: 240px; text-align; center;',
                                         text: '', show_on_set_parent: false });
        this.applicationsBoxWrapper = new St.BoxLayout({  style_class: 'menu-applications-inner-box',
                                                    /*style: 'min-width: 275px',*/ vertical: true, reactive: true });

        this.applicationsBoxWrapper.add(this.answerText, {  x_fill: false, y_fill: false,
                                                            x_align: St.Align.MIDDLE, y_align: St.Align.START });
        this.applicationsBoxWrapper.add(this.applicationsGridBox, { x_fill: false, y_fill: false,
                                                            x_align: St.Align.START, y_align: St.Align.START });
        this.applicationsBoxWrapper.add(this.applicationsListBox, { x_fill: true, y_fill: false,
                                                            x_align: St.Align.START, y_align: St.Align.START });
        this.applicationsScrollBox = new St.ScrollView({  x_fill: true, y_fill: false,
                            y_align: St.Align.START, style_class: 'vfade menu-applications-scrollbox' });
        const vscrollApplications = this.applicationsScrollBox.get_vscroll_bar();
        this.appThis.displaySignals.connect(vscrollApplications, 'scroll-start',
                                                                () => { this.appThis.menu.passEvents = true; });
        this.appThis.displaySignals.connect(vscrollApplications, 'scroll-stop',
                                                                () => { this.appThis.menu.passEvents = false; });
        this.applicationsScrollBox.add_actor(this.applicationsBoxWrapper);
        this.applicationsScrollBox.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC);
        this.applicationsScrollBox.set_auto_scrolling(this.appThis.settings.enableAutoScroll);
        this.applicationsScrollBox.set_mouse_scrolling(true);

        //this.applicationsScrollBox.set_reactive(true);
        //this.appThis.displaySignals.connect(this.applicationsScrollBox, 'button-release-event',
        //                                                (...args) => {this.onButtonRelease(...args);});
    }

    /*onButtonRelease(actor, event) {
        const button = event.get_button();
        if (button === 3) {//right click
            if (this.appThis.contextMenu.isOpen) {
                this.appThis.clearEnteredActors();
                return Clutter.EVENT_STOP;
            } else if (this.appThis.currentCategory.startsWith('/')) {//if directory view
                this.appThis.contextMenu.open(this.appThis.currentCategory, event);
                //for some reason return Clutter.EVENT_STOP; is not stopping the event?
                this.appThis.stopMouseEvent = true;
                return Clutter.EVENT_STOP;
            }
        }
        return Clutter.EVENT_PROPAGATE;
    }*/

    getActiveButtons() {
        const buttons = [];
        this.getActiveContainer().get_children().forEach(child =>
            buttons.push( this.appThis.allItems.find(button => button && button.actor === child) ));
        return buttons;
    }

    clear() {
        this.setAnswerText(null);
        this.clearEnteredActors();
        if (this.applicationsListBox) {
            this.applicationsListBox.remove_all_children();
        }

        if (this.applicationsGridBox && !this.applicationsGridBox.is_finalized()) {
            this.applicationsGridBox.remove_all_children();
        }
    }

    clearEnteredActors() {
        const buttons = this.getActiveButtons();
        buttons.forEach(button => {
            if (button.actor.has_style_class_name('menu-application-button-selected') ||
                                                                            button.entered != null ) {
                button.handleLeave();
                button.entered = null;
            }
        });
    }

    setAnswerText(text) {
        if (text) {
            this.answerText.set_text(text);
            this.answerText.show();
        } else {
            this.answerText.hide();
        }
    }

    getActiveContainer() {
        return this.appThis.settings.applicationsViewMode === ApplicationsViewModeLIST ?
                                                this.applicationsListBox : this.applicationsGridBox;
    }

    destroy() {
        this.answerText.destroy();
        this.applicationsListBox.destroy();
        this.applicationsGridBox.destroy();
        this.applicationsBoxWrapper.destroy();
        this.applicationsScrollBox.destroy();
    }
}

class Apps {
    constructor(appThis) {
        this.appThis = appThis;
        this.recentManager = getDocManager();
        this.appsByCategory = {};
        this.knownApps = [];
        this.newInstance = true;
        this.appsNeedRefresh = true;
    }

    installedChanged() {
        this.appsNeedRefresh = true;
    }

    initAppCategories() {
        if (!this.appsNeedRefresh) return;

        const apps_sort = arr => arr.sort( (a, b) => {
                        if (!a.name || !b.name) return -1;
                        return (a.name.toLowerCase() > b.name.toLowerCase()) ?
                                1 : (a.name.toLowerCase() < b.name.toLowerCase()) ? -1 : 0;  });
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
                this.loadAppCategories(dir, null, dirId);
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

    loadAppCategories(dir, rootDir, dirId) {
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
                        const obj = /*app.hasOwnProperty('item') ? app.item :*/ app;
                        if (!obj.hasOwnProperty('name')) {
                            obj.name = obj.get_name();
                        }
                        if (!obj.hasOwnProperty('description')) {
                            obj.description = obj.get_description();
                        }
                        if (!app.description || app.description == '') {
                            app.description = _('No description available');
                        }
                        app.type = APPTYPE.application;
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
                    this.loadAppCategories(iter.get_directory(), rootDir, null);
                } else {
                    this.loadAppCategories(iter.get_directory(), dir, dirId);
                }
            }
        }
    }

    getAppsByCategory(dirId) {
        if (this.appsNeedRefresh) {
            this.initAppCategories();
        }
        return this.appsByCategory[dirId];
    }

    listApplications(categoryMenuId, pattern) {
        let res = this.getAppsByCategory(categoryMenuId);

        if (pattern) {
            const _res = [];
            res.forEach(app => {
                const keywords = app.get_keywords() || '';
                const id = app.get_id().replace(/\.desktop$/, '');
                const match1 = searchStr(pattern, app.name);
                const match2 = searchStr(pattern, app.description);
                match2.score *= 0.95; //slightly lower priority for description match
                const match3 = searchStr(pattern, keywords);
                match3.score *= 0.6; //low priority for keyword match
                const match4 = searchStr(pattern, id);
                match4.score *= 0.6; //low priority for id match
                const bestMatchScore = Math.max(match1.score, match2.score, match3.score, match4.score);
                if (bestMatchScore > SEARCH_THRESHOLD) {
                    app.score = bestMatchScore;
                    app.nameWithSearchMarkup = match1.result;
                    app.descriptionWithSearchMarkup = match2.result;
                    app.keywordsWithSearchMarkup = match3.result;
                    app.idWithSearchMarkup = match4.result;
                    _res.push(app);
                }
            });
            res = _res;
        }
        return res;
    }

    listFavoriteApps() {
        let res = this.appThis.appFavorites.getFavorites();

        res.forEach(favApp => {
            const obj = /*favApp.hasOwnProperty('item') ? favApp.item :*/ favApp;
            if (!obj.hasOwnProperty('name')) {
                obj.name = obj.get_name();
            }
            if (!obj.hasOwnProperty('description')) {
                obj.description = obj.get_description();
            }
            favApp.type = APPTYPE.application;
        });
        return res;
    }

    listRecent(pattern) {
        let {_infosByTimestamp} = this.recentManager;
        if (this.appThis.recentsJustCleared) {//_infosByTimestamp doesn't update synchronously
            _infosByTimestamp = [];
            this.appThis.recentsJustCleared = false;
        }
        let res = [];
        _infosByTimestamp.forEach(recentInfo => {
            /*if (!GLib.file_test(Gio.File.new_for_uri(recentInfo.uri).get_path(), GLib.FileTest.EXISTS)) {
                continue;
            }*/
            const found = this.appThis.allItems.find(item => item.app.isRecentFile &&
                                                                        item.app.uri === recentInfo.uri);
            if (found) {
                res.push(found.app);
            } else {
                res.push({  name: recentInfo.name,
                            gicon: recentInfo.gicon,
                            uri: recentInfo.uri,
                            mimeType: recentInfo.mimeType,
                            description: Gio.File.new_for_uri(recentInfo.uri).get_path(),
                            type: APPTYPE.file,
                            isRecentFile: true });
            }
        });
        // create "Clear list" icon
        if (res.length > 0  && !pattern) {
            if (!this.clearlistItem) {
                this.clearlistItem = {  name: _('Clear List'),
                                        clearList: true,
                                        description: '',
                                        type: APPTYPE.clearlist_button };
            }
            res.push(this.clearlistItem);
        }

        if (pattern) {
            const _res = [];
            res.forEach(recentItem => {
                const match = searchStr(pattern, recentItem.name);
                if (recentItem.name && match.score > SEARCH_THRESHOLD) {
                    recentItem.score = match.score;
                    recentItem.nameWithSearchMarkup = match.result;
                    _res.push(recentItem);
                }
            });
            res = _res;
        }
        return res;
    }

    listPlaces(pattern) {
        let res = [];
        Main.placesManager.getAllPlaces().forEach(place => {
            let selectedAppId = place.idDecoded.substr(place.idDecoded.indexOf(':') + 1);
            const fileIndex = selectedAppId.indexOf('file:///');
            if (fileIndex !== -1) {
                selectedAppId = selectedAppId.substr(fileIndex + 7);
            }
            if (selectedAppId === "home" || selectedAppId === "desktop" || selectedAppId === "connect") {
                selectedAppId = place.name;
            }
            let icon = place.iconFactory(this.appThis.getAppIconSize());
            if (!icon) {
                icon = new St.Icon({ icon_name: 'folder', icon_size: this.appThis.getAppIconSize()});
            }
            place.icon = icon;
            place.type = APPTYPE.place;
            place.description = selectedAppId;
            res.push(place);
        });

        if (pattern) {
            const _res = [];
            res.forEach(place => {
                const match = searchStr(pattern, place.name);
                if (match.score > SEARCH_THRESHOLD) {
                    place.nameWithSearchMarkup = match.result;
                    place.score = match.score;
                    _res.push(place);
                }
            });
            res = _res;
        }
        return res;
    }

    listFavoriteFiles(pattern) {
        if (!XApp.Favorites) {
            return [];
        }
        let res = [];
        const favorite_infos = XApp.Favorites.get_default().get_favorites(null);
        favorite_infos.forEach(info => {
            res.push({  name: info.display_name,
                        description: Gio.File.new_for_uri(info.uri).get_path(),
                        gicon: Gio.content_type_get_icon(info.cached_mimetype),
                        type: APPTYPE.file,
                        isFavoriteFile: true,
                        mimeType: info.cached_mimetype,
                        uri: info.uri });
        });

        if (pattern) {
            const _res = [];
            res.forEach(item => {
                const match = searchStr(pattern, item.name);
                if (item.name && match.score > SEARCH_THRESHOLD) {
                    item.score = match.score;
                    item.nameWithSearchMarkup = match.result;
                    _res.push(item);
                }
            });
            res = _res;
        }
        return res;
    }

    listWebBookmarks(pattern) {
        let res = this.appThis.bookmarksManager.state;

        if (pattern) {
            const _res = [];
            res.forEach(bookmark => {
                        if (bookmark.name) {
                            const match = searchStr(pattern, bookmark.name);
                            if (match.score > SEARCH_THRESHOLD) {
                                bookmark.score = match.score;
                                bookmark.nameWithSearchMarkup = match.result;
                                _res.push(bookmark);
                            }
                        } });
            res = _res;
        }
        return res;
    }

    listFolder(folder) {
        const res = [];
        const dir = Gio.file_new_for_path(folder);
        let enumerator;
        tryFn(() => {   enumerator = dir.enumerate_children("standard::*", 0, null); }, (e) => {
                            this.appThis.appsView.setAnswerText(e.message); });
        let next;
        if (enumerator) {
            next = enumerator.next_file(null);
        }
        while (next) {
            const filename = next.get_name();
            if (this.appThis.settings.showHiddenFiles || !filename.startsWith('.')) {
                const file = Gio.file_new_for_path(folder + (folder === '/' ? '' : '/') + filename);
                res.push({  name: next.get_name(),
                            icon: null,
                            gicon: next.get_icon(),
                            uri: file.get_uri(),
                            mimeType: next.get_content_type(),
                            isDirectory: file.query_file_type(0, null) === 2,
                            description: '',//file.get_path(),
                            type: APPTYPE.file });
            }
            next = enumerator.next_file(null);
        }
        res.sort((a, b) => {    if (!a.isDirectory && b.isDirectory) return 1;
                                else if (a.isDirectory && !b.isDirectory) return -1;
                                else if (a.isDirectory && b.isDirectory &&
                                            a.name.startsWith('.') && !b.name.startsWith('.')) return 1;
                                else if (a.isDirectory && b.isDirectory &&
                                            !a.name.startsWith('.') && b.name.startsWith('.')) return -1;
                                else {
                                    const nameA = a.name.toLowerCase();
                                    const nameB = b.name.toLowerCase();
                                    return (nameA > nameB) ? 1 : ( (nameA < nameB) ? -1 : 0 );
                                } });
        const parent = dir.get_parent();
        if (parent) {// Add back button
            res.unshift({   name: 'Back',
                            icon: null,
                            uri: parent.get_uri(),
                            mimeType: 'inode/directory',
                            isDirectory: true,
                            isBackButton: true,
                            description: '',//parent.get_path(),
                            type: APPTYPE.file });
        }
        return res;
    }

    destroy() {
    }
}

class SearchView {
    constructor(appThis) {
        this.searchInactiveIcon = new St.Icon({ style_class: 'menu-search-entry-icon', icon_name: 'edit-find' });
        this.searchActiveIcon = new St.Icon({ style_class: 'menu-search-entry-icon', icon_name: 'edit-clear' });
        this.searchEntry = new St.Entry({ name: 'menu-search-entry', //hint_text: HINT_TEXT,
                                          track_hover: true, can_focus: true,
                                            style: 'min-width: 100px;'});
        this.searchEntryText = this.searchEntry.clutter_text;

        this.searchEntry.set_primary_icon(this.searchInactiveIcon);
        this.searchBox = new St.BoxLayout({ style_class: 'menu-search-box',
                                            style: /*'padding-right: 7px;*/ 'min-width: 160px;' });
        this.searchBox.add(this.searchEntry, {  expand: true, x_align: St.Align.START, y_align: St.Align.MIDDLE });
    }

    showSecondaryIcon(show) {
        if (show) {
            this.searchEntry.set_secondary_icon(this.searchActiveIcon);
        } else {
            this.searchEntry.set_secondary_icon(null);
        }
    }

    destroy() {
        this.searchInactiveIcon.destroy();
        this.searchActiveIcon.destroy();
        this.searchEntry.destroy();
        this.searchBox.destroy();
    }

}

class Sidebar {
    constructor (appThis, sidebarPlacement) {
        this.appThis = appThis;
        const style_class = this.appThis.settings.useBoxStyle ? 'menu-favorites-box' : '';
        this.innerBox = new St.BoxLayout({style_class: style_class,
                        vertical: (sidebarPlacement === PlacementLEFT || sidebarPlacement === PlacementRIGHT) });
        this.sidebarScrollBox = new St.ScrollView({x_fill: true, y_fill: false, x_align: St.Align.MIDDLE,
                            y_align: St.Align.MIDDLE, style_class: 'vfade menu-favorites-scrollbox' });
        const vscroll_bar = this.sidebarScrollBox.get_vscroll_bar();
        this.appThis.displaySignals.connect(vscroll_bar, 'scroll-start',
                                                                () => { this.appThis.menu.passEvents = true; });
        this.appThis.displaySignals.connect(vscroll_bar, 'scroll-stop',
                                                                () => { this.appThis.menu.passEvents = false; });
        this.sidebarScrollBox.add_actor(this.innerBox);
        this.sidebarScrollBox.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.NEVER);
        this.sidebarScrollBox.set_auto_scrolling(this.appThis.settings.enableAutoScroll);
        this.sidebarScrollBox.set_mouse_scrolling(true);
    }

    populate (favs) {
        this.destroyChildren();
        this.items = [];
        //add session buttons
        const iconObj = { icon_size: this.appThis.settings.sidebarIconSize,
                          icon_type: this.appThis.settings.sidebarIconSize <= 24 ? St.IconType.SYMBOLIC :
                                                                                    St.IconType.FULLCOLOR };
        iconObj.icon_name = 'system-shutdown';
        this.items.push(new SidebarButton( this.appThis, new St.Icon(iconObj), null, _('Quit'),
                    _('Shutdown the computer'), () => { Util.spawnCommandLine('cinnamon-session-quit --power-off');
                                                                this.appThis.closeMenu(); } ));
        //
        iconObj.icon_name = 'system-log-out';
        this.items.push(new SidebarButton( this.appThis, new St.Icon(iconObj), null, _('Logout'),
                                    _('Leave the session'), () => { Util.spawnCommandLine('cinnamon-session-quit');
                                                                        this.appThis.closeMenu(); } ));
        iconObj.icon_name = 'system-lock-screen';
        this.items.push(new SidebarButton( this.appThis, new St.Icon(iconObj), null, _('Lock screen'),
                    _('Lock the screen'), () => {
                        const screensaver_settings = new Gio.Settings({
                                                    schema_id: 'org.cinnamon.desktop.screensaver' });
                        const screensaver_dialog = Gio.file_new_for_path('/usr/bin/cinnamon-screensaver-command');
                        if (screensaver_dialog.query_exists(null)) {
                            if (screensaver_settings.get_boolean('ask-for-away-message')) {
                                Util.spawnCommandLine('cinnamon-screensaver-lock-dialog');
                            } else {
                                Util.spawnCommandLine('cinnamon-screensaver-command --lock');//
                            }
                        } else {
                            this.screenSaverProxy.LockRemote('');
                        }
                        this.appThis.closeMenu(); }));
        //add favorites
        if (this.appThis.settings.addFavorites) {
            this.appThis.apps.listFavoriteApps().forEach(fav => {
                this.items.push(new SidebarButton( this.appThis,
                                fav.create_icon_texture(this.appThis.settings.sidebarIconSize),
                                        fav, fav.name, fav.description, null));
            });
            this.appThis.apps.listFavoriteFiles().forEach(fav => {
                this.items.push(new SidebarButton( this.appThis,
                                new St.Icon({ gicon: fav.gicon, icon_size: this.appThis.settings.sidebarIconSize}),
                                fav, fav.name, fav.description, null));
            });
        }
        //change order of all items depending on buttons placement
        const reverseOrder = this.appThis.settings.sidebarPlacement === PlacementLEFT ||
                                                this.appThis.settings.sidebarPlacement === PlacementRIGHT;
        if (reverseOrder) {
            this.items.reverse();
        }
        //populate box with items[]
        for (let i = 0; i < this.items.length; i++) {
            if ((reverseOrder && i == this.items.length - 3 && this.items.length > 3) ||
                        (!reverseOrder && i == 3 && this.items.length > 3)){// add seperator line to box
                this.addSeparator();
            }
            this.innerBox.add(this.items[i].actor, { x_fill: false, y_fill: false,
                                                        x_align: St.Align.MIDDLE, y_align: St.Align.MIDDLE });
        }
        return;
    }

    addSeparator() {
        const line = new St.BoxLayout({ style_class: 'popup-separator-menu-item', x_expand: false, y_expand: false});
        this.innerBox.add(line, { x_fill: false, y_fill: false, x_align: St.Align.MIDDLE, y_align: St.Align.MIDDLE });
        let width = this.appThis.settings.sidebarIconSize + 8;
        let height = 2;
        if (this.appThis.settings.sidebarPlacement === PlacementTOP ||
                                        this.appThis.settings.sidebarPlacement === PlacementBOTTOM) {
            [width, height] = [height, width];
        }
        line.style = `width: ${width}px; height: ${height}px; background-color: ${
                    this.appThis.getThemeForegroundColor()}; margin: 1px; border: 0px; border-radius: 10px; `;
        line.set_opacity(25);
    }

    getButtons() {
        return this.items;
    }

    clearEnteredActors() {
        const foundItem = this.items.findIndex( (button) => button.entered != null );
        if (foundItem > -1 && this.items[foundItem]) {
            this.items[foundItem].handleLeave();
        }
    }

    destroyChildren() {
        if (!this.innerBox.is_finalized()) {
            const children = this.innerBox.get_children();
            this.innerBox.get_children().forEach(child => child.destroy());

            this.items = null;
        }
    }

    destroy() {
        this.destroyChildren();
        this.innerBox.destroy();
        this.sidebarScrollBox.destroy();
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new CinnamenuApplet(metadata, orientation, panel_height, instance_id);
}
