const St        = imports.gi.St;
const Clutter   = imports.gi.Clutter;
const {SignalManager}    = imports.misc.signalManager;
const {PopupMenuSection} = imports.ui.popupMenu;
const {ContextMenu}    = require('./contextmenu');
const {AppsView}       = require('./appsview');
const {CategoriesView} = require('./categoriesview');
const {Sidebar}        = require('./sidebar');
const {FavoriteBox}    = require('./favoritebox');
const ApplicationsViewMode = Object.freeze({LIST: 0, GRID: 1});
const SidebarPlacement     = Object.freeze({TOP: 0, BOTTOM: 1, LEFT: 2, RIGHT: 3});

class Display {
    constructor(appThis) {
        this.appThis = appThis;
        this.displaySignals = new SignalManager(null);

        this.favoriteBox    = new FavoriteBox(this.appThis);
        this.sidebar        = new Sidebar(this.appThis);
        this.appsView       = new AppsView(this.appThis);
        this.categoriesView = new CategoriesView(this.appThis);

        const placement = this.appThis.settings.searchPlacement || 'sidebar-top';

        this.searchView = new SearchView(this.appThis);
        this.displaySignals.connect(this.searchView.searchEntryText, 'text-changed',
            (...args) => this.appThis._onSearchTextChanged(...args));
        this.displaySignals.connect(this.searchView.searchEntryText, 'key-press-event',
            (...args) => this.appThis._onMenuKeyPress(...args));

        this.rightPane = new St.BoxLayout({
            style_class: 'menu-right-pane',
            vertical: true,
        });

        const searchInRightPane = (placement === 'top' || placement === 'bottom');
        if (searchInRightPane) {
            this.searchRow = new St.BoxLayout({ style_class: 'menu-search-row' });
            this.searchRow.add(this.searchView.searchBox, {
                expand: true, x_fill: true, y_fill: false,
                x_align: St.Align.MIDDLE, y_align: St.Align.MIDDLE,
            });
        }

        if (placement === 'top') {
            this.rightPane.add(this.searchRow, { expand: false, x_fill: true, y_fill: false });
            this.rightPane.add(this.appsView.applicationsScrollBox, { expand: true, x_fill: true, y_fill: true });
        } else if (placement === 'bottom') {
            this.rightPane.add(this.appsView.applicationsScrollBox, { expand: true, x_fill: true, y_fill: true });
            this.rightPane.add(this.searchRow, { expand: false, x_fill: true, y_fill: false });
        } else {
            this.rightPane.add(this.appsView.applicationsScrollBox, { expand: true, x_fill: true, y_fill: true });
        }

        this.sidebarPanel = new St.BoxLayout({
            style_class: 'menu-sidebar-panel',
            vertical: true,
        });

        if (placement === 'sidebar-top') {
            this.sidebarTopSearchRow = new St.BoxLayout({
                style_class: 'menu-sidebar-title-row menu-sidebar-search-top',
            });
            this.sidebarTopSearchRow.add(this.searchView.searchBox, {
                expand: true, x_fill: true, y_fill: false,
                x_align: St.Align.MIDDLE, y_align: St.Align.MIDDLE,
            });
            this.sidebarPanel.add(this.sidebarTopSearchRow, {
                expand: false, x_fill: true, y_fill: false,
            });
        } else {
            this.sidebarTopSearchRow = null;
        }

        this.sidebarPanel.add(this.categoriesView.groupCategoriesWorkspacesScrollBox, {
            expand: true, x_fill: true, y_fill: true,
        });

        if (placement === 'sidebar') {
            this.sidebarBottomSearchRow = new St.BoxLayout({
                style_class: 'menu-sidebar-search-row',
            });
            this.sidebarBottomSearchRow.add(this.searchView.searchBox, {
                expand: true, x_fill: true, y_fill: false,
                x_align: St.Align.MIDDLE, y_align: St.Align.MIDDLE,
            });
            this.sidebarPanel.add(this.sidebarBottomSearchRow, {
                expand: false, x_fill: true, y_fill: false,
            });
        } else {
            this.sidebarBottomSearchRow = null;
        }

        this.mainBox = new St.BoxLayout({
            style_class: 'menu-applications-outer-box',
            style: 'spacing:0px;',
            vertical: false,
            reactive: true,
            show_on_set_parent: false,
        });
        this.mainBox.add_style_class_name('menu-applications-box');

        if (this.appThis.settings.showFavBox !== false) {
            this.mainBox.add(this.favoriteBox.actor, { expand: false, x_fill: false, y_fill: true });
        }

        this.mainBox.add(this.sidebarPanel, { expand: false, x_fill: false, y_fill: true });
        this.mainBox.add(this.rightPane,    { expand: true,  x_fill: true,  y_fill: true });

        this.contextMenu = new ContextMenu(this.appThis);
        this.contextMenu.contextMenuBox.set_x_expand(false);
        this.contextMenu.contextMenuBox.set_y_expand(false);
        this.contextMenu.contextMenuBox.set_size(0, 0);
        this.mainBox.add(this.contextMenu.contextMenuBox, {
            expand: false, x_fill: false, y_fill: false,
        });

        const section = new PopupMenuSection();
        section.actor.add_actor(this.mainBox);
        this.appThis.menu.addMenuItem(section);

        this.displaySignals.connect(this.mainBox, 'button-release-event', () => {
            if (this.contextMenu.isOpen) this.contextMenu.close();
        });

        this.categoriesView.categoriesBox.set_reactive(true);
        this.displaySignals.connect(
            this.categoriesView.categoriesBox, 'motion-event',
            () => this.updateMouseTracking());

        this.appsView.applicationsListBox.hide();
        this.appsView.applicationsGridBox.show();

        this.mainBox.show();
        this.applyPaletteClass();
    }

    applyPaletteClass() {
        this.mainBox.remove_style_class_name('menu-palette-light');
        this.mainBox.remove_style_class_name('menu-palette-dark');
        if (!this.appThis.settings.useMenuTileStyle) return;
        const mode = this.appThis.settings.menuTileStyle || 'dark-palette';
        if (mode === 'light-palette') {
            this.mainBox.add_style_class_name('menu-palette-light');
        } else if (mode === 'dark-palette') {
            this.mainBox.add_style_class_name('menu-palette-dark');
        }
    }

    updateMouseTracking() {
        this.TRACKING_TIME = 70;
        let [x, y] = global.get_pointer();
        if (!this.mTrack) this.mTrack = [];
        this.mTrack.push({ time: Date.now(), x, y });
        while (this.mTrack[0].time + this.TRACKING_TIME < Date.now()) this.mTrack.shift();
        const dx = x - this.mTrack[0].x;
        const dy = Math.abs(y - this.mTrack[0].y);
        this.badAngle = (dx / dy) > 0.3;
    }

    clearFocusedActors() {
        if (this.contextMenu.isOpen) this.contextMenu.close();
        this.appsView.clearAppsViewFocusedActors();
        this.sidebar.clearSidebarFocusedActors();
        this.favoriteBox.clearSidebarFocusedActors();
        this.categoriesView.allButtonsRemoveFocusAndHover();
    }

    onMenuResized(userWidth, userHeight) {
        this.updateMenuSize(userWidth, userHeight);
        this.appsView.resizeGrid();
    }

    updateMenuSize(newWidth, newHeight) {
        if (!newWidth) {
            newWidth  = this.appThis.settings.customMenuWidth  * global.ui_scale;
            newHeight = this.appThis.settings.customMenuHeight * global.ui_scale;
        }

        // Update favorite box available height for scrolling
        if (this.favoriteBox && typeof this.favoriteBox.setAvailableHeight === 'function') {
            this.favoriteBox.setAvailableHeight(newHeight);
        }

        const placement = this.appThis.settings.searchPlacement || 'sidebar-top';

        const headerRow = this.sidebarTopSearchRow;
        const headerH   = headerRow ? Math.max(headerRow.height, 44) : 0;

        if (placement === 'sidebar-top') {
            const catH = Math.max(newHeight - headerH, 100);
            this.categoriesView.groupCategoriesWorkspacesScrollBox.height = catH;
            this.appsView.applicationsScrollBox.height = Math.max(newHeight, 200);
            this.searchView.searchEntry.width = 150;

        } else if (placement === 'sidebar') {
            const bottomSearchH = this.sidebarBottomSearchRow
                                    ? Math.max(this.sidebarBottomSearchRow.height, 40) : 40;
            const catH = Math.max(newHeight - bottomSearchH, 100);
            this.categoriesView.groupCategoriesWorkspacesScrollBox.height = catH;
            this.appsView.applicationsScrollBox.height = Math.max(newHeight, 200);
            this.searchView.searchEntry.width = 150;

        } else {
            const catH = Math.max(newHeight, 100);
            this.categoriesView.groupCategoriesWorkspacesScrollBox.height = catH;

            const searchH = 44;
            const appsH   = Math.max(newHeight - searchH, 200);
            this.appsView.applicationsScrollBox.height = appsH;

            const sidebarW  = this.sidebarPanel.width || 0;
            const menuWidth = Math.max(sidebarW + 200, newWidth);
            const appsBoxW  = Math.floor(menuWidth - sidebarW);
            this.searchView.searchEntry.width = appsBoxW;
        }

        const FAV_BOX_W = (this.appThis.settings.showFavBox !== false) ? 64 : 0;
        const sidebarW  = this.sidebarPanel.width || 0;
        const menuWidth = Math.max(FAV_BOX_W + sidebarW + 200, newWidth);
        const appsBoxW  = Math.floor(menuWidth - sidebarW - FAV_BOX_W);

        this.appsView.applicationsListBox.width = appsBoxW;
        this.appsView.applicationsGridBox.width = appsBoxW;
        this.appsView.currentGridBoxWidth = appsBoxW;

        if (!this.appThis.resizer.resizingInProgress) {
            this.appThis.settings.customMenuHeight = newHeight / global.ui_scale;
            this.appThis.settings.customMenuWidth  = menuWidth / global.ui_scale;
        }
    }

    destroy() {
        this.displaySignals.disconnectAllSignals();
        this.searchView.destroy();      this.searchView      = null;
        this.appsView.destroy();        this.appsView        = null;
        this.sidebar.destroy();         this.sidebar         = null;
        this.favoriteBox.destroy();     this.favoriteBox     = null;
        this.categoriesView.destroy();  this.categoriesView  = null;
        this.contextMenu.destroy();     this.contextMenu     = null;
        if (this.sidebarTopSearchRow)    { this.sidebarTopSearchRow.destroy();    this.sidebarTopSearchRow    = null; }
        if (this.sidebarBottomSearchRow) { this.sidebarBottomSearchRow.destroy(); this.sidebarBottomSearchRow = null; }
        if (this.searchRow)              { this.searchRow.destroy(); }
        this.rightPane.destroy();
        this.sidebarPanel.destroy();
        this.mainBox.destroy();
    }
}

class SearchView {
    constructor(appThis) {
        this.appThis = appThis;
        this.searchInactiveIcon = new St.Icon({
            style_class: 'menu-search-entry-icon', icon_name: 'edit-find',
        });
        this.searchActiveIcon = new St.Icon({
            style_class: 'menu-search-entry-icon', icon_name: 'edit-clear',
        });
        this.searchEntry = new St.Entry({
            name: 'menu-search-entry',
            hint_text: 'Search…',
            track_hover: true,
            can_focus: true,
        });
        this.searchEntryText = this.searchEntry.clutter_text;
        this.searchEntry.set_primary_icon(this.searchInactiveIcon);
        this.searchBox = new St.BoxLayout({ style_class: 'menu-search-box' });
        this.searchBox.add(this.searchEntry, { expand: true, x_fill: true });
    }

    showAndConnectSecondaryIcon() {
        this.searchEntry.set_secondary_icon(this.searchActiveIcon);
        this.appThis.signals.connect(this.searchEntry, 'secondary-icon-clicked',
            () => this.searchEntryText.set_text(''));
    }

    hideAndDisconnectSecondaryIcon() {
        this.searchEntry.set_secondary_icon(null);
        this.appThis.signals.disconnect('secondary-icon-clicked', this.searchEntry);
    }

    tweakTheme() {}

    destroy() {
        this.searchInactiveIcon.destroy();
        this.searchActiveIcon.destroy();
        this.searchEntry.destroy();
        this.searchBox.destroy();
    }
}

module.exports = {Display};
