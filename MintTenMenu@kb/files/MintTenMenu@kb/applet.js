// applet.js — MintTenMenu Main Entry Point
// A Windows 10 Start Menu-inspired launcher for the Cinnamon desktop.
'use strict';

const Applet     = imports.ui.applet;
const Settings   = imports.ui.settings;
const Main       = imports.ui.main;
const St         = imports.gi.St;
const Clutter    = imports.gi.Clutter;
const Gio        = imports.gi.Gio;
const GLib       = imports.gi.GLib;
const Gtk        = imports.gi.Gtk;
const Util       = imports.misc.util;
const Meta       = imports.gi.Meta;
const {PopupMenuManager, PopupMenuSection} = imports.ui.popupMenu;
const {SignalManager} = imports.misc.signalManager;

// Local modules (flat, same directory)
const utils      = require('./utils');
const {AppManager} = require('./appManager');
const {NavRail}    = require('./navRail');
const {AppList}    = require('./appList');
const {TileArea}   = require('./tileArea');
const {ColorPickerPopover} = require('./colorPicker');

// ---- Layout dimensions ----
// NAV rail widths live in navRail.js (COLLAPSED_W / EXPANDED_W).
// The app list is the flexible column; the tile area is sized from its content.

// Bundled Start-button logos (icons/Logo/). Keep in sync with the
// "menu-icon-preset" options in settings-schema.json.
const ICON_PRESETS = {
    Default: 'Default.svg',
    Black:   'Black.svg',
    White:   'White.svg',
};

// ===========================================================================

class MintTenMenuApplet extends Applet.TextIconApplet {

    constructor(metadata, orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        this.setAllowedLayout(Applet.AllowedLayout.BOTH);

        this.metadata    = metadata;
        this.orientation = orientation;
        this._signals    = new SignalManager(null);
        this._initialised = false;
        this._appsChangedPending = false;

        // ---- Persistent icon cache container ----
        // Parented directly on global.stage so it survives _buildMenu() cycles.
        // Cached source actors live here; Clutter.Clone refs inside TileItems
        // remain valid even after _menuContainer is rebuilt.
        this._iconCacheContainer = new St.Widget({
            name: 'wintenmenu-icon-cache-container',
            visible: true,
            opacity: 0,
            x: -9999,
            y: -9999,
            width: 0,
            height: 0,
        });
        global.stage.add_actor(this._iconCacheContainer);

        // Register custom icons directory with Gtk IconTheme so they are found by name
        try {
            Gtk.IconTheme.get_default().append_search_path(metadata.path + "/icons");
        } catch (e) {
            global.logWarning("MintTenMenu: Failed to append search path: " + e);
        }

        // ---- Settings object ----
        // We bind all schema keys onto this.settings so modules can read them.
        this.settings = {};
        this._appletSettings = new Settings.AppletSettings(
            this.settings, metadata.uuid, instance_id
        );
        this._bindSettings();

        // ---- Menu ----
        this.menuManager = new PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);

        // 'menu-background' = use current Cinnamon theme's popup-menu background
        // exactly like Cinnamenu does for theme adaptation.
        this.menu.setCustomStyleClass('menu-background');

        // ---- Signal handlers ----
        this._signals.connect(this.menu, 'open-state-changed',
            (...args) => this._onOpenStateChanged(...args));
        this._signals.connect(Main.themeManager, 'theme-set',
            () => this._onThemeChanged());
        this._signals.connect(Gtk.IconTheme.get_default(), 'changed',
            () => this._updatePanelIcon());

        // ---- Core modules ----
        this._appManager = new AppManager();
        this._appManager.onChanged(() => this._onAppsChanged());

        // ---- Build the menu UI ----
        this._buildMenu();

        // ---- Keybinding (Super key) ----
        this._setupKeybinding();

        // ---- Panel icon ----
        this._updatePanelIcon();

        this._initialised = true;
        global.log('MintTenMenu: Ready.');
    }

    // ========================================================================
    // Settings
    // ========================================================================

    _bindSettings() {
        const S = this._appletSettings;

        // key in schema → property on this.settings → callback
        const bindings = [
            ['overlay-key',          'overlayKey',          () => this._setupKeybinding()],
            ['activate-on-hover',    'activateOnHover',     () => this._setupHover()],
            ['hover-delay',          'hoverDelayMs',        () => this._setupHover()],
            ['enable-animation',     'enableAnimation',     null],
            ['menu-label',           'menuLabel',           () => this._updatePanelIcon()],
            ['menu-icon-preset',     'menuIconPreset',      () => this._updatePanelIcon()],
            ['menu-icon-custom',     'menuIconCustom',      () => this._updatePanelIcon()],
            ['menu-icon',            'menuIcon',            () => this._updatePanelIcon()],
            ['custom-menu-width',    'customMenuWidth',     () => this._updateMenuSize()],
            ['custom-menu-height',   'customMenuHeight',    () => this._updateMenuSize()],
            ['font-size-base',       'fontSizeBase',        () => this._updateMenuSize()],
            ['tile-corner-radius',   'tileCornerRadius',    () => {
                if (this._tileArea) this._tileArea.onTileVisualSettingsChanged();
            }],
            ['show-recently-used',   'showRecentlyUsed',    () => {
                if (this._appList) this._appList._renderList();
            }],
            ['show-app-description', 'showAppDescription',  () => {
                if (this._appList) this._appList._renderList();
            }],
            ['app-description-color','appDescriptionColor', () => {
                if (this._appList) this._appList._renderList();
            }],
            ['nav-rail-expanded',    'navRailExpanded',     () => {
                if (this._navRail) this._navRail._setExpanded(this.settings.navRailExpanded, true);
            }],
            ['tile-accent-colors',   'tileAccentColors',    () => {
                if (this._tileArea) this._tileArea.onTileVisualSettingsChanged();
            }],
        ];

        for (const [key, prop, cb] of bindings) {
            S.bind(key, prop, cb ? cb.bind(this) : null);
        }

        const navVisibilityBindings = [
            ['nav-show-profile',   'navShowProfile'],
            ['nav-show-recent',    'navShowRecent'],
            ['nav-show-documents', 'navShowDocuments'],
            ['nav-show-downloads', 'navShowDownloads'],
            ['nav-show-music',     'navShowMusic'],
            ['nav-show-pictures',  'navShowPictures'],
            ['nav-show-videos',    'navShowVideos'],
            ['nav-show-files',     'navShowFiles'],
            ['nav-show-settings',  'navShowSettings'],
            ['nav-show-lock',      'navShowLock'],
            ['nav-show-logout',    'navShowLogout'],
            ['nav-show-power',     'navShowPower'],
        ];
        for (const [key, prop] of navVisibilityBindings) {
            S.bind(key, prop, () => {
                if (this._navRail) this._navRail.applyVisibility();
            });
        }
    }

    // ========================================================================
    // Menu building
    // ========================================================================

    _buildMenu() {
        // Tear down the picker before the container it lives in is replaced,
        // restoring any live preview colour.
        this.closeColorPicker();

        this.menu.removeAll();
        if (this._navRail)  { this._navRail.destroy();  this._navRail  = null; }
        if (this._appList)  { this._appList.destroy();  this._appList  = null; }
        if (this._tileArea) { this._tileArea.destroy(); this._tileArea = null; }

        const section = new PopupMenuSection();

        // Root horizontal container — fills the whole menu popup
        this._rootBox = new St.BoxLayout({
            style_class: 'wintenmenu-root',
            x_expand: true,
            y_expand: true,
        });

        // Apply explicit dimensions + configurable base font size from settings.
        // Inline CSS lengths are logical (St multiplies them by ui_scale), while
        // ClutterActor.set_size() takes physical px. Keep the two strictly separate.
        const W    = this.settings.customMenuWidth  || 940;
        const H    = this.settings.customMenuHeight || 640;
        const FONT = this.settings.fontSizeBase || 14;
        const SCALE = global.ui_scale || 1;

        this._menuContainer = new St.Widget({
            x_expand: true,
            y_expand: true,
        });
        this._menuContainer.style = `min-width:${W}px; min-height:${H}px; max-height:${H}px; font-size:${FONT}px;`;

        this._rootBox.set_size(Math.round(W * SCALE), Math.round(H * SCALE));
        this._rootBox.set_position(0, 0);
        this._rootBox.style = `min-width:${W}px; min-height:${H}px; max-height:${H}px;`;

        // ---- Left: Nav Rail ----
        this._navRail = new NavRail(this, utils);
        this._navRail.actor.y_expand = true;
        this._navRail.actor.y_align = Clutter.ActorAlign.FILL;
        this._rootBox.add_actor(this._navRail.actor);

        // Thin vertical separator
        this._divider1 = this._makeDivider();
        this._rootBox.add_actor(this._divider1);

        // ---- Middle: App List ----
        // Flexible column: its width is whatever remains after the nav rail,
        // both dividers and the exactly-sized tile area. See _layoutColumns().
        this._appList = new AppList(this, utils, this._appManager);
        this._appList.actor.y_expand = true;
        this._appList.actor.y_align = Clutter.ActorAlign.FILL;
        this._appList.onLaunch(() => {});
        this._appList.onPin((app) => {
            if (this._tileArea) this._tileArea.pinApp(app);
        });
        this._appList.onUnpin((app) => {
            if (this._tileArea) this._tileArea.removeAppFromStart(app.id);
        });
        this._appList.onIsPinned((app) =>
            this._tileArea ? this._tileArea.hasAppTile(app.id) : false);
        this._rootBox.add_actor(this._appList.actor);

        // Thin vertical separator
        this._divider2 = this._makeDivider();
        this._rootBox.add_actor(this._divider2);

        // ---- Right: Tile Area ----
        this._tileArea = new TileArea(this, utils, this._appManager);
        this._tileArea.actor.y_expand = true;
        this._tileArea.actor.y_align = Clutter.ActorAlign.FILL;
        this._rootBox.add(this._tileArea.actor, { expand: false });
        this._appListWidth = -1;
        this._columnLayoutId = null;

        // Close active context menu when clicking outside or pressing Escape
        this.menu.actor.connect('captured-event', (actor, event) => {
            const type = event.type();
            if (type === Clutter.EventType.BUTTON_PRESS) {
                // If a settings popover is open, let it handle its own clicks
                if (this._settingsPopoverActor && this._settingsPopoverActor.contains(event.get_source())) {
                    return Clutter.EVENT_PROPAGATE;
                }
                // Clicks inside the colour picker are handled by it
                if (this._colorPicker) {
                    const pickerActor = this._colorPicker.actor;
                    if (pickerActor && pickerActor.contains(event.get_source())) {
                        return Clutter.EVENT_PROPAGATE;
                    }
                    this.closeColorPicker();
                    return Clutter.EVENT_PROPAGATE;
                }
                if (this._activeContextMenu) {
                    let source = event.get_source();
                    // Check both the main menu actor and any open flyout
                    const inMain   = this._activeContextMenu._actor &&
                                     this._activeContextMenu._actor.contains(source);
                    const inFlyout = this._activeContextMenu._flyout &&
                                     this._activeContextMenu._flyout._actor &&
                                     this._activeContextMenu._flyout._actor.contains(source);
                    if (!inMain && !inFlyout) {
                        this.closeActiveContextMenu();
                    }
                }
            } else if (type === Clutter.EventType.KEY_PRESS) {
                const symbol = event.get_key_symbol();
                if (symbol === Clutter.KEY_Escape) {
                    if (this._colorPicker) {
                        this.closeColorPicker();
                        return Clutter.EVENT_STOP;
                    }
                    if (this._settingsPopoverActor) {
                        // Escape closes the settings popover if open
                        if (this._settingsPopover) try { this._settingsPopover.close(); } catch(e) {}
                        return Clutter.EVENT_STOP;
                    }
                    if (this._activeContextMenu) {
                        this.closeActiveContextMenu();
                        return Clutter.EVENT_STOP;
                    }
                }
            }
            return Clutter.EVENT_PROPAGATE;
        });

        this._menuContainer.add_actor(this._rootBox);
        section.addActor(this._menuContainer);
        this.menu.addMenuItem(section);

        this._scheduleColumnLayout();
    }

    _makeDivider() {
        return new St.BoxLayout({
            style_class: 'wintenmenu-divider',
            y_expand: true,
        });
    }

    // ========================================================================
    // Horizontal column allocation
    //
    // Fixed:   nav rail, two 1px dividers, tile area (content-derived width).
    // Flexible: app list — takes the exact remainder, so the columns always
    // sum to the configured menu width with no empty strip and no overflow.
    // Explicit widths are physical px; inline CSS stays logical px.
    // ========================================================================

    _getDividerWidth() {
        const scale = global.ui_scale || 1;
        const d = this._divider1;
        if (!d) return Math.round(scale);
        try {
            const pw = d.get_preferred_width(-1);
            return Math.max(Math.round(scale), Math.round(Math.max(pw[0], pw[1])));
        } catch (e) {
            return Math.round(scale);
        }
    }

    _layoutColumns(animate = false) {
        if (!this._rootBox || !this._appList || !this._tileArea) return;

        const scale   = global.ui_scale || 1;
        const menuW   = Math.round((this.settings.customMenuWidth || 940) * scale);
        const navW    = this._navRail ? this._navRail.getPhysicalWidth()
                                      : Math.round(40 * scale);
        const divW    = this._getDividerWidth();
        const tileW   = this._tileArea.getRequiredWidth();
        const listW   = Math.max(0, menuW - navW - divW * 2 - tileW);

        if (listW === this._appListWidth) return;
        this._appListWidth = listW;

        if (animate) {
            utils.animateWidth(this._appList.actor, listW, 180);
        } else {
            this._appList.actor.set_width(listW);
        }
    }

    _scheduleColumnLayout() {
        if (this._columnLayoutId) return;
        this._columnLayoutId = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            this._columnLayoutId = null;
            this._layoutColumns(false);
            return GLib.SOURCE_REMOVE;
        });
    }

    _onNavWidthChanged(animate) {
        this._layoutColumns(animate);
    }

    // ========================================================================
    // Panel icon & label
    // ========================================================================

    _updatePanelIcon() {
        try {
            if (this.settings.menuIconCustom && this.settings.menuIcon) {
                const p = this.settings.menuIcon;
                if (GLib.path_is_absolute(p) && GLib.file_test(p, GLib.FileTest.EXISTS)) {
                    if (p.includes('-symbolic')) this.set_applet_icon_symbolic_path(p);
                    else this.set_applet_icon_path(p);
                } else if (Gtk.IconTheme.get_default().has_icon(p)) {
                    if (p.includes('-symbolic')) this.set_applet_icon_symbolic_name(p);
                    else this.set_applet_icon_name(p);
                }
            } else {
                const presetFile = ICON_PRESETS[this.settings.menuIconPreset] || ICON_PRESETS.Default;
                const presetPath = this.metadata.path + '/icons/Logo/' + presetFile;
                if (GLib.file_test(presetPath, GLib.FileTest.EXISTS)) {
                    this.set_applet_icon_path(presetPath);
                } else {
                    const iconPath = this.metadata.path + '/icon.png';
                    if (GLib.file_test(iconPath, GLib.FileTest.EXISTS)) {
                        this.set_applet_icon_path(iconPath);
                    } else {
                        this.set_applet_icon_name('start-here');
                    }
                }
            }
        } catch (e) {
            global.logWarning('MintTenMenu: icon error: ' + e);
            try { this.set_applet_icon_name('start-here'); } catch(e2) {}
        }

        // Label
        const label = (this.settings.menuLabel || '').substring(0, 45);
        if (this.orientation === St.Side.LEFT || this.orientation === St.Side.RIGHT) {
            this.set_applet_label('');
        } else {
            this.set_applet_label(label);
            if (label) this.set_applet_tooltip(label);
        }
    }

    // ========================================================================
    // Keybinding — Super key (same pattern as Cinnamenu)
    // ========================================================================

    _setupKeybinding() {
        const keyId = 'wintenmenu-overlay-' + this.instance_id;
        Main.keybindingManager.addHotKey(
            keyId,
            this.settings.overlayKey || '<Super>',
            () => {
                if (Main.overview.visible || Main.expo.visible) return;
                // Multi-monitor: if another instance owns the other monitor, delegate
                if (!this.getOtherInstance ||
                        global.screen.get_current_monitor() === this.panel.monitorIndex) {
                    this.menu.toggle_with_options(this.settings.enableAnimation);
                } else if (typeof this.getOtherInstance === 'function') {
                    const other = this.getOtherInstance();
                    if (other) other.menu.toggle_with_options(other.settings.enableAnimation);
                }
            }
        );
    }

    // ========================================================================
    // Hover-to-open
    // ========================================================================

    _setupHover() {
        if (this._hoverTimeoutId) {
            clearTimeout(this._hoverTimeoutId);
            this._hoverTimeoutId = null;
        }
        this._signals.disconnect('enter-event', this.actor);
        this._signals.disconnect('leave-event', this.actor);

        if (this.settings.activateOnHover) {
            this._signals.connect(this.actor, 'enter-event', () => {
                if (!this.menu.isOpen && !this._hoverTimeoutId) {
                    this._hoverTimeoutId = setTimeout(() => {
                        this._hoverTimeoutId = null;
                        if (!this._applet_context_menu.isOpen) {
                            this.menu.open(this.settings.enableAnimation);
                        }
                    }, this.settings.hoverDelayMs || 300);
                }
            });
            this._signals.connect(this.actor, 'leave-event', () => {
                if (this._hoverTimeoutId) {
                    clearTimeout(this._hoverTimeoutId);
                    this._hoverTimeoutId = null;
                }
            });
        }
    }

    registerActiveContextMenu(menuInstance) {
        this.closeColorPicker();
        this.closeActiveContextMenu();
        this._activeContextMenu = menuInstance;
    }

    closeActiveContextMenu() {
        if (this._activeContextMenu) {
            const menu = this._activeContextMenu;
            this._activeContextMenu = null;
            try { menu.close(); } catch(e){}
        }
    }

    // ---- In-menu colour picker ---------------------------------------------

    showColorPicker(tile, anchor) {
        this.closeColorPicker();
        if (!this._menuContainer || !tile) return;
        this._colorPicker = new ColorPickerPopover(this, tile, anchor);
    }

    closeColorPicker() {
        const picker = this._colorPicker;
        if (!picker) return;
        this._colorPicker = null;
        try { picker.close(); } catch(e) {
            global.logWarning('MintTenMenu: colour picker close error: ' + e);
        }
    }

    // ========================================================================
    // Menu open/close handling
    // ========================================================================

    _onOpenStateChanged(menu, open) {
        this.closeColorPicker();
        if (global.settings.get_boolean('panel-edit-mode')) return false;

        this.closeActiveContextMenu();

        if (open) {
            // Clear any hover timeout
            if (this._hoverTimeoutId) {
                clearTimeout(this._hoverTimeoutId);
                this._hoverTimeoutId = null;
            }

            // Refresh app list with latest recents
            if (this._appList) this._appList.onMenuOpen();

            if (this._tileArea) {
                try { this._tileArea.onMenuOpen(); } catch (e) {}
            }
            this._scheduleColumnLayout();

            // Focus search bar
            setTimeout(() => {
                if (this._appList && this.menu.isOpen) this._appList.focusSearch();
            }, 50);

            // Resume widgets
            if (this._tileArea) {
                try {
                    this._tileArea._forEachWidget(w => w.resume());
                } catch(e) {
                    global.logWarning('MintTenMenu: Failed to resume widgets: ' + e);
                }
            }

            // Center if in center zone of panel
            try {
                const {AppletManager} = imports.ui.appletManager;
                const def = AppletManager.getAppletDefinition({ applet_id: this.instance_id });
                if ((this.orientation === St.Side.BOTTOM || this.orientation === St.Side.TOP) &&
                        def && def.location_label === 'center') {
                    const monitor = Main.layoutManager.findMonitorForActor(this.menu.actor);
                    this.menu.shiftToPosition(Math.floor(monitor.width / 2) + monitor.x);
                }
            } catch (e) {}

        } else {
            // ---- Menu close lifecycle ----
            // Reset every component to its default state before the next open.
            if (this._appList) {
                try { this._appList.onMenuClose(); }
                catch (e) { global.logWarning('MintTenMenu: appList.onMenuClose error: ' + e); }
            }
            if (this._tileArea) {
                try { this._tileArea.onMenuClose(); }
                catch (e) { global.logWarning('MintTenMenu: tileArea.onMenuClose error: ' + e); }
            }
            if (this._navRail) this._navRail.hidePowerMenu();

            // An install happened while the menu was open; apply it once the
            // popup is hidden. If it is reopened first, the next close retries.
            if (this._appsChangedPending) {
                setTimeout(() => {
                    if (this._appsChangedPending && this._initialised && !this.menu.isOpen) {
                        this._applyAppsChanged();
                    }
                }, 300);
            }
        }
        return true;
    }

    // ========================================================================
    // Theme changes — rebuild menu so CSS variables are refreshed
    // ========================================================================

    _onThemeChanged() {
        this._updatePanelIcon();
        // Debounce rebuild
        if (this._themeRebuildTimeout) {
            clearTimeout(this._themeRebuildTimeout);
        }
        this._themeRebuildTimeout = setTimeout(() => {
            this._themeRebuildTimeout = null;
            if (this._initialised) this._buildMenu();
        }, 300);
    }

    // ========================================================================
    // App system changes
    // ========================================================================

    _onAppsChanged() {
        if (!this._initialised) return;
        if (this.menu.isOpen) {
            // Never tear down the open popup; remember the change instead.
            this._appsChangedPending = true;
            return;
        }
        this._applyAppsChanged();
    }

    _applyAppsChanged() {
        this._appsChangedPending = false;
        // Uninstalled apps leave no tile behind; widgets and folders are kept.
        if (this._tileArea) this._tileArea.pruneMissingApps(false);
        this._buildMenu();
    }

    // ========================================================================
    // Applet lifecycle callbacks (Cinnamon calls these)
    // ========================================================================

    on_applet_clicked() {
        if (!this._initialised) {
            this.set_applet_label('Please wait…');
            return;
        }
        this.menu.toggle_with_options(this.settings.enableAnimation);
    }

    on_orientation_changed(orientation) {
        this.orientation = orientation;
        if (orientation === St.Side.LEFT || orientation === St.Side.RIGHT) {
            this.hide_applet_label(true);
        } else {
            this.hide_applet_label(false);
        }
        this._updatePanelIcon();
    }

    on_applet_added_to_panel() {
        this._setupHover();
    }

    on_applet_removed_from_panel() {
        Main.keybindingManager.removeHotKey('wintenmenu-overlay-' + this.instance_id);
        this.closeColorPicker();
        if (this._hoverTimeoutId) { clearTimeout(this._hoverTimeoutId); this._hoverTimeoutId = null; }
        if (this._themeRebuildTimeout) { clearTimeout(this._themeRebuildTimeout); this._themeRebuildTimeout = null; }
        try { utils.flushAllSaves(); } catch (e) {}
        // Destroy the persistent cache container before clearing the cache so that
        // actors are removed from global.stage cleanly rather than leaked.
        if (this._iconCacheContainer) {
            try { this._iconCacheContainer.destroy(); } catch (e) {}
            this._iconCacheContainer = null;
        }
        try { utils.clearIconCache(); } catch (e) {}
        this._signals.disconnectAllSignals();
        if (this._appManager) this._appManager.destroy();
        if (this._navRail)  this._navRail.destroy();
        if (this._appList)  this._appList.destroy();
        if (this._tileArea) this._tileArea.destroy();
        this._appletSettings.finalize();
    }

    // Multi-monitor support (same as Cinnamenu)
    on_applet_instances_changed(instance) {
        if (instance && instance.instance_id !== this.instance_id) {
            this.getOtherInstance = () => instance;
            instance.getOtherInstance = () => this;
        } else if (!instance) {
            this.getOtherInstance = null;
        }
    }

    _updateMenuSize() {
        if (!this._menuContainer || !this._rootBox) return;
        const W    = this.settings.customMenuWidth  || 940;
        const H    = this.settings.customMenuHeight || 640;
        const FONT = this.settings.fontSizeBase || 14;
        const SCALE = global.ui_scale || 1;

        this._menuContainer.style = `min-width:${W}px; min-height:${H}px; max-height:${H}px; font-size:${FONT}px;`;
        this._rootBox.set_size(Math.round(W * SCALE), Math.round(H * SCALE));
        this._rootBox.style = `min-width:${W}px; min-height:${H}px; max-height:${H}px;`;

        // Height change may add/remove the vertical scrollbar, which changes
        // the tile area's required width and therefore the app list width.
        if (this._tileArea) this._tileArea._scheduleWidthSync();
        this._scheduleColumnLayout();
    }
}

// ---------------------------------------------------------------------------
// Cinnamon entry point
// ---------------------------------------------------------------------------

function main(metadata, orientation, panel_height, instance_id) {
    return new MintTenMenuApplet(metadata, orientation, panel_height, instance_id);
}
