// appList.js — MintTenMenu Middle Panel
//
// Layout:
//   [ Search box ]
//   [ Full app list — optionally filtered by search query ]
'use strict';

const St      = imports.gi.St;
const Clutter = imports.gi.Clutter;
const Gtk     = imports.gi.Gtk;
const Pango   = imports.gi.Pango;
const Gio     = imports.gi.Gio;
const GLib    = imports.gi.GLib;
const Main    = imports.ui.main;
const Mainloop = imports.mainloop;
const Util    = imports.misc.util;
const FileUtils = imports.misc.fileUtils;
const {SignalManager} = imports.misc.signalManager;
const {CtxMenu} = require('./tileItem');
const {tilePx} = require('./gridMath');
const {makeDraggable} = imports.ui.dnd;

const ICON_SIZE    = 22;
const RECENT_MAX   = 8;
const SEARCH_DELAY = 120; // ms debounce

function createGhostActor(appName, iconTexture) {
    const size = tilePx(2); // 146px for medium
    const ghost = new St.BoxLayout({
        style: 'background-color: rgba(0, 120, 212, 0.6); border: 2px dashed #0078D4; padding: 4px;',
        vertical: true,
        width: size,
        height: size,
    });
    // Icon
    const iconBox = new St.BoxLayout({
        x_align: Clutter.ActorAlign.CENTER,
        y_align: Clutter.ActorAlign.CENTER,
        x_expand: true,
        y_expand: true,
    });
    if (iconTexture) {
        const iconClone = new Clutter.Clone({ source: iconTexture });
        iconBox.add(iconClone, { x_align: St.Align.MIDDLE, y_align: St.Align.MIDDLE });
    }
    ghost.add(iconBox, { expand: true });

    // Label
    const lbl = new St.Label({
        text: appName,
        style: 'font-size: 11px; color: white;',
        x_align: Clutter.ActorAlign.START,
        y_align: Clutter.ActorAlign.END,
    });
    ghost.add_actor(lbl);

    return ghost;
}

class AppList {
    constructor(applet, utils, appManager) {
        this.applet      = applet;
        this.utils       = utils;
        this.appManager  = appManager;
        this._signals    = new SignalManager(null);

        // State
        this._searchQuery   = '';
        this._recentApps    = utils.loadJSON('recent-apps.json', []);
        this._suppressChange = false;
        this._searchTimeout  = null;

        // The full list is built once and kept across menu opens. Rebuilding it
        // inside 'open-state-changed' blocked the popup for ~450ms per open,
        // because adding ~170 rows to an already-mapped container forces style
        // and layout work for every child. Search results live in a separate
        // container that is shown instead of the full list.
        this._fullListBox      = null;
        this._recentsBox       = null;
        this._searchResultsBox = null;
        this._recentRows       = [];
        this._allAppRows       = [];
        this._fullRows         = [];
        this._appRows          = [];
        this._recentsKey       = null;

        // Callbacks for parent
        this._pinCb       = null;
        this._unpinCb     = null;
        this._isPinnedCb  = null;
        this._launchCb    = null;
        this._searchCb    = null;

        this._buildUI();
        this._renderList();
    }

    get actor() { return this._panelBox; }

    onLaunch(cb)       { this._launchCb = cb; }
    onSearchChange(cb) { this._searchCb  = cb; }
    onPin(cb)          { this._pinCb     = cb; }
    onUnpin(cb)        { this._unpinCb   = cb; }
    onIsPinned(cb)     { this._isPinnedCb = cb; }

    focusSearch() {
        global.stage.set_key_focus(this._searchEntry.clutter_text);
    }

    onMenuOpen() {
        // State is always clean here — onMenuClose() ran before this open.
        // Only the recents section is refreshed; the full list is reused so
        // opening stays cheap.
        this._recentApps = this.utils.loadJSON('recent-apps.json', this._recentApps);
        if (!this._searchQuery) this._renderRecents();
    }

    onMenuClose() {
        // Cancel any pending search debounce
        if (this._searchTimeout) {
            clearTimeout(this._searchTimeout);
            this._searchTimeout = null;
        }

        // Reset search box text and internal query
        this._suppressChange = true;
        this._searchEntry.set_text('');
        this._searchEntry.set_secondary_icon(null);
        this._suppressChange = false;
        this._searchQuery = '';
        this._showFullList();

        // Reset app list scroll position to top
        try {
            const adj = this._appsScroll && this._appsScroll.vscroll
                ? this._appsScroll.vscroll.adjustment : null;
            if (adj) adj.value = adj.lower;
        } catch(e) {}
    }

    // Rebuild the full list from AppManager. Only called while the menu is
    // closed (startup, app install/removal, visual settings changes).
    refreshApps() {
        this._searchQuery = '';
        this._suppressChange = true;
        this._searchEntry.set_text('');
        this._searchEntry.set_secondary_icon(null);
        this._suppressChange = false;
        this._renderList();
    }

    recordRecent(appId) {
        this._recentApps = [appId, ...this._recentApps.filter(id => id !== appId)].slice(0, 20);
        this.utils.saveJSON('recent-apps.json', this._recentApps);
    }

    clearSearch() {
        this._suppressChange = true;
        this._searchEntry.set_text('');
        this._searchEntry.set_secondary_icon(null);
        this._suppressChange = false;
        this._searchQuery    = '';
        this._showFullList();
    }

    destroy() {
        this.applet.closeActiveContextMenu();
        this._signals.disconnectAllSignals();
        if (this._searchTimeout) { clearTimeout(this._searchTimeout); this._searchTimeout = null; }
        try { this._panelBox.destroy(); } catch(e){}
    }

    // =========================================================================
    // Build UI
    // =========================================================================

    _buildUI() {
        this._panelBox = new St.BoxLayout({
            vertical:  true,
            x_expand:  false,
            y_expand:  true,
        });
        this._panelBox.add_style_class_name("wintenmenu-app-list-panel");

        // ---- Search box ----
        this._searchBox   = new St.BoxLayout({
            style_class: 'wintenmenu-search-box',
        });
        this._searchEntry = new St.Entry({
            style_class: 'wintenmenu-search-entry',
            hint_text:   'Type here to search...',
            can_focus:   true,
            x_expand:    true,
        });
        this._searchEntry.set_primary_icon(new St.Icon({
            icon_name: 'edit-find-symbolic', icon_size: 14, icon_type: St.IconType.SYMBOLIC,
        }));
        this._clearIcon = new St.Icon({
            icon_name: 'edit-clear-symbolic', icon_size: 14, icon_type: St.IconType.SYMBOLIC,
        });
        this._searchBox.add(this._searchEntry, { expand: true });
        this._panelBox.add_actor(this._searchBox);

        this._signals.connect(this._searchEntry, 'secondary-icon-clicked', () => {
            this.clearSearch();
        });
        this._signals.connect(this._searchEntry.clutter_text, 'text-changed', () => {
            if (!this._suppressChange) this._onTextChanged();
        });
        this._signals.connect(this._searchEntry.clutter_text, 'key-press-event',
            (a, ev) => this._onSearchKeyPress(ev));

        // ---- App list (scrollable, always visible) ----
        this._appsScroll = new St.ScrollView({
            hscrollbar_policy: Gtk.PolicyType.NEVER,
            vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
            y_expand: true,
            x_expand: true,
        });
        this._appsScroll.set_auto_scrolling(false);
        this._appsBox = new St.BoxLayout({ vertical: true, x_expand: true });
        this._appsScroll.add_actor(this._appsBox);
        this._panelBox.add(this._appsScroll, { expand: true });
    }

    // =========================================================================
    // App list rendering
    // =========================================================================

    _renderList() {
        this._appsBox.remove_all_children();
        this._searchResultsBox = null;
        this._recentsBox       = null;
        this._recentsKey       = null;
        this._recentRows       = [];
        this._allAppRows       = [];
        this._fullRows         = [];
        this._appRows          = this._fullRows;

        // ---- Full app list (kept for subsequent opens) ----
        this._fullListBox = new St.BoxLayout({ vertical: true, x_expand: true });
        this._appsBox.add_actor(this._fullListBox);

        this._recentsBox = new St.BoxLayout({ vertical: true, x_expand: true });
        this._fullListBox.add_actor(this._recentsBox);
        this._renderRecents();

        const allApps = this.appManager.getApps();   // always sorted A-Z

        if (allApps.length === 0) {
            this._fullListBox.add_actor(new St.Label({
                text: 'No applications found',
                style: 'padding: 12px; opacity: 0.5; font-size: 0.85em;',
            }));
            return;
        }

        for (const a of allApps) {
            this._allAppRows.push(this._addRow(a, null, this._fullListBox));
        }
        this._rebuildFullRows();

        // Keep an active search on top of the freshly built full list.
        const query = this._searchQuery.trim();
        if (query.length > 0) this._renderSearch(query);
    }

    // Refresh only the "Recently Used" section, in place. Used on every open
    // so recents stay current without rebuilding the whole list.
    _renderRecents() {
        if (!this._recentsBox) return;

        const allApps = this.appManager.getApps();
        const recents = this.applet.settings.showRecentlyUsed
            ? this._recentApps
                .map(id => allApps.find(a => a.id === id))
                .filter(Boolean)
                .slice(0, RECENT_MAX)
            : [];

        const key = recents.map(a => a.id).join('|');
        if (key === this._recentsKey) return;
        this._recentsKey = key;

        this._recentsBox.remove_all_children();
        this._recentRows = [];

        if (recents.length > 0) {
            this._addHeader('Recently Used', this._recentsBox);
            for (const a of recents) {
                this._recentRows.push(this._addRow(a, null, this._recentsBox));
            }
        }
        this._rebuildFullRows();
    }

    _rebuildFullRows() {
        this._fullRows = this._recentRows.concat(this._allAppRows);
        if (!this._searchQuery) this._appRows = this._fullRows;
    }

    _showFullList() {
        if (this._searchResultsBox) {
            try { this._searchResultsBox.destroy(); } catch (e) {}
            this._searchResultsBox = null;
        }
        if (this._fullListBox) this._fullListBox.show();
        this._appRows = this._fullRows || [];
    }

    _renderSearch(query) {
        // Search across all installed apps
        const results = this.appManager.searchApps(query, this.utils);

        // Also search recent files (basic)
        const fileResults = this._searchRecentFiles(query);

        if (this._fullListBox) this._fullListBox.hide();
        if (!this._searchResultsBox) {
            this._searchResultsBox = new St.BoxLayout({
                vertical:  true,
                x_expand:  true,
                y_expand:  true,
            });
            this._appsBox.add_actor(this._searchResultsBox);
        }
        this._searchResultsBox.remove_all_children();
        this._appRows = [];

        if (results.length === 0 && fileResults.length === 0) {
            this._searchResultsBox.add_actor(new St.Label({
                text: 'No results for "' + query + '"',
                style: 'padding: 12px; opacity: 0.5; font-size: 0.9em;',
            }));
            return;
        }

        // Recent Files FIRST (top of search results), then Applications
        if (fileResults.length > 0) {
            this._addHeader('Recent Files', this._searchResultsBox);
            for (const f of fileResults) {
                this._appRows.push(this._addFileRow(f, this._searchResultsBox));
            }
        }

        if (results.length > 0) {
            this._addHeader('Applications', this._searchResultsBox);
            for (const r of results) {
                this._appRows.push(this._addRow(r.app, r.nameMarkup, this._searchResultsBox));
            }
        }
    }

    _searchRecentFiles(query) {
        // Read GTK recent files from ~/.local/share/recently-used.xbel
        const results = [];
        try {
            const manager = Gtk.RecentManager.get_default();
            const items   = manager.get_items();
            const q       = query.toLowerCase();
            for (const item of items) {
                if (!item.exists()) continue;
                const name = item.get_display_name() || '';
                if (name.toLowerCase().includes(q)) {
                    results.push({
                        name:    name,
                        uri:     item.get_uri(),
                        mime:    item.get_mime_type(),
                        icon:    item.get_gicon ? item.get_gicon() : null,
                    });
                    if (results.length >= 6) break;
                }
            }
        } catch(e) {}
        return results;
    }

    // =========================================================================
    // Row builders
    // =========================================================================

    _addHeader(text, target) {
        const lbl = new St.Label({
            text: text.toUpperCase(),
            style_class: 'wintenmenu-section-header',
        });
        target.add_actor(lbl);
    }

    _addRow(app, nameMarkup, target) {
        const row = new St.BoxLayout({
            style_class: 'wintenmenu-app-row',
            reactive: true,
            x_expand: true,
        });
        row._app = app;

        // Icon
        let icon;
        try   { icon = app.cinnamonApp.create_icon_texture(ICON_SIZE); }
        catch (e) {
            icon = new St.Icon({
                icon_name: 'application-x-executable',
                icon_size: ICON_SIZE,
                icon_type: St.IconType.FULLCOLOR,
            });
        }
        if (icon) row.add_actor(icon);

        // Labels
        const lb = new St.BoxLayout({ vertical: true, y_expand: false });
        const nl = new St.Label({
            style_class: 'wintenmenu-app-name',
            y_align: Clutter.ActorAlign.CENTER,
        });
        nl.clutter_text.ellipsize = Pango.EllipsizeMode.END;
        if (nameMarkup) nl.clutter_text.set_markup(nameMarkup);
        else nl.set_text(app.name || '');
        lb.add_actor(nl);

        const showDesc = this.applet.settings.showAppDescription !== false;
        if (app.description && showDesc) {
            const dlParams = {
                text: app.description,
                style_class: 'wintenmenu-app-description',
            };
            if (this.applet.settings.appDescriptionColor) {
                dlParams.style = `color: ${this.applet.settings.appDescriptionColor}; opacity: 1;`;
            }
            const dl = new St.Label(dlParams);
            dl.clutter_text.ellipsize = Pango.EllipsizeMode.END;
            lb.add_actor(dl);
        }
        row.add(lb, { expand: true });

        // Hover
        this._signals.connect(row, 'enter-event', () => row.add_style_pseudo_class('hover'));
        this._signals.connect(row, 'leave-event', () => row.remove_style_pseudo_class('hover'));

        // Drag and Drop
        const draggable = makeDraggable(row, {
            restoreOnSuccess: true,
        });

        row._delegate = {
            getDragActor: () => {
                let iconTex = null;
                try {
                    iconTex = app.cinnamonApp.create_icon_texture(48);
                } catch(e) {}
                return createGhostActor(app.name || '', iconTex);
            },
            getDragActorSource: () => row,
            data: {
                id: 'tile-' + Date.now(),
                appId: app.id,
                appName: app.name,
                size: 'medium',
                w: 2,
                h: 2,
                accentColor: '#0078D4',
                isNew: true
            }
        };

        this._signals.connect(draggable, 'drag-begin', () => {
            try {
                row.set_opacity(80);
                if (this.applet._tileArea) {
                    this.applet._tileArea.disableScrolling();
                }
                global.log("MintTenMenu: Drag Begin (from App List)");
            } catch (e) {
                global.logWarning("MintTenMenu: Error in drag-begin (App List): " + e);
            }
        });
        this._signals.connect(draggable, 'drag-cancelled', () => {
            try {
                row.set_opacity(255);
                if (this.applet._tileArea) {
                    this.applet._tileArea.enableScrolling();
                    this.applet._tileArea.revertToOriginalLayout();
                }
                global.log("MintTenMenu: Drag Finished (cancelled)");
            } catch (e) {
                global.logWarning("MintTenMenu: Error in drag-cancelled (App List): " + e);
                if (this.applet._tileArea) {
                    this.applet._tileArea.enableScrolling();
                }
            }
        });
        this._signals.connect(draggable, 'drag-end', () => {
            try {
                row.set_opacity(255);
                if (this.applet._tileArea) {
                    this.applet._tileArea.enableScrolling();
                    this.applet._tileArea.refreshAll();
                }
                global.log("MintTenMenu: Drag Finished");
            } catch (e) {
                global.logWarning("MintTenMenu: Error in drag-end (App List): " + e);
                if (this.applet._tileArea) {
                    this.applet._tileArea.enableScrolling();
                }
            }
        });

        // Click Events
        this._signals.connect(row, 'button-press-event', (a, ev) => {
            if (ev.get_button() === Clutter.BUTTON_PRIMARY) {
                return Clutter.EVENT_PROPAGATE;
            }
            return Clutter.EVENT_STOP;
        });

        this._signals.connect(row, 'button-release-event', (a, ev) => {
            if (ev.get_button() === Clutter.BUTTON_PRIMARY) {
                this._launch(app);
                return Clutter.EVENT_STOP;
            }
            if (ev.get_button() === Clutter.BUTTON_SECONDARY) {
                this._contextMenu(app, row);
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        });

        target.add_actor(row);
        return row;
    }

    _addFileRow(file, target) {
        const row = new St.BoxLayout({
            style_class: 'wintenmenu-app-row',
            reactive: true,
            x_expand: true,
        });

        // Icon
        let iconWidget;
        try {
            if (file.icon) {
                iconWidget = new St.Icon({ gicon: file.icon, icon_size: ICON_SIZE, icon_type: St.IconType.FULLCOLOR });
            }
        } catch(e){}
        if (!iconWidget) {
            iconWidget = new St.Icon({ icon_name: 'text-x-generic', icon_size: ICON_SIZE, icon_type: St.IconType.FULLCOLOR });
        }
        row.add_actor(iconWidget);

        // Name
        const lb = new St.BoxLayout({ vertical: true, y_expand: false });
        const nl = new St.Label({
            text: file.name,
            style_class: 'wintenmenu-app-name',
            y_align: Clutter.ActorAlign.CENTER,
        });
        nl.clutter_text.ellipsize = Pango.EllipsizeMode.END;
        lb.add_actor(nl);
        row.add(lb, { expand: true });

        this._signals.connect(row, 'enter-event', () => row.add_style_pseudo_class('hover'));
        this._signals.connect(row, 'leave-event', () => row.remove_style_pseudo_class('hover'));
        this._signals.connect(row, 'button-release-event', (a, ev) => {
            if (ev.get_button() === Clutter.BUTTON_PRIMARY) {
                try { Gio.app_info_launch_default_for_uri(file.uri, null); }
                catch(e) { global.logWarning('MintTenMenu: open file failed: ' + e); }
                this.applet.menu.close();
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        });

        target.add_actor(row);
        return row;
    }

    // =========================================================================
    // Launch & context menu
    // =========================================================================

    _launch(app) {
        this.recordRecent(app.id);
        try { app.cinnamonApp.open_new_window(-1); }
        catch (e) { global.logWarning('MintTenMenu: launch failed ' + app.id + ': ' + e); }
        if (this._launchCb) this._launchCb(app);
        this.applet.menu.close();
    }

    _contextMenu(app, actor) {
        this.applet.closeActiveContextMenu();

        this._ctxMenu = new CtxMenu(this.applet, actor, () => {
            this._ctxMenu = null;
        });

        this.applet.registerActiveContextMenu(this._ctxMenu);

        this._ctxMenu.addItem('Open', () => {
            this._launch(app);
        });

        this._ctxMenu.addSeparator();

        this._ctxMenu.addItem('Add to panel', () => {
            this._addToPanel(app);
            this.applet.menu.close();
        });

        if (app.desktopFile) {
            this._ctxMenu.addItem('Add to desktop', () => {
                this._addToDesktop(app);
                this.applet.menu.close();
            });
        }

        this._ctxMenu.addSeparator();

        if (app.desktopFile) {
            this._ctxMenu.addItem('Uninstall', () => {
                this._uninstall(app);
                this.applet.menu.close();
            });

            this._ctxMenu.addItem('Properties', () => {
                this._showProperties(app);
                this.applet.menu.close();
            });
        }

        this._ctxMenu.addSeparator();

        const pinned = this._isPinnedCb ? !!this._isPinnedCb(app) : false;
        this._ctxMenu.addItem(pinned ? 'Remove from Start' : 'Pin to Start', () => {
            if (pinned) {
                if (this._unpinCb) this._unpinCb(app);
            } else if (this._pinCb) {
                this._pinCb(app);
            }
        });
    }

    // ---- Context-menu actions ---------------------------------------------

    _addToPanel(app) {
        try {
            if (!Main.AppletManager.get_role_provider_exists(Main.AppletManager.Roles.PANEL_LAUNCHER)) {
                const newAppletId = global.settings.get_int('next-applet-id');
                global.settings.set_int('next-applet-id', newAppletId + 1);
                const enabledApplets = global.settings.get_strv('enabled-applets');
                enabledApplets.push('panel1:right:0:panel-launchers@cinnamon.org:' + newAppletId);
                global.settings.set_strv('enabled-applets', enabledApplets);
            }

            // The launcher applet is loaded asynchronously after enabling it.
            let retries = 10;
            Mainloop.timeout_add(100, () => {
                const launcher = Main.AppletManager.get_role_provider(Main.AppletManager.Roles.PANEL_LAUNCHER);
                if (launcher) {
                    launcher.acceptNewLauncher(app.id);
                    return false;
                }
                retries--;
                return retries > 0;
            });
        } catch (e) {
            global.logWarning('MintTenMenu: add to panel failed for ' + app.id + ': ' + e);
        }
    }

    _addToDesktop(app) {
        const desktopDir = FileUtils.getUserDesktopDir();
        if (!desktopDir) return;
        try {
            const file = Gio.File.new_for_path(app.desktopFile);
            const dest = Gio.File.new_for_path(
                GLib.build_filenamev([desktopDir, file.get_basename()]));
            file.copy(dest, Gio.FileCopyFlags.OVERWRITE, null, null);
            FileUtils.changeModeGFile(dest, 755);
        } catch (e) {
            global.logWarning('MintTenMenu: add to desktop failed for ' + app.id + ': ' + e);
        }
    }

    _uninstall(app) {
        try {
            Util.spawn(['cinnamon-remove-application', app.desktopFile]);
        } catch (e) {
            global.logWarning('MintTenMenu: uninstall failed for ' + app.id + ': ' + e);
        }
    }

    _showProperties(app) {
        try {
            Util.spawn(['cinnamon-desktop-editor', '-mlauncher', '-o', app.desktopFile]);
        } catch (e) {
            global.logWarning('MintTenMenu: properties failed for ' + app.id + ': ' + e);
        }
    }

    // =========================================================================
    // Search / keyboard
    // =========================================================================

    _onTextChanged() {
        const query = this._searchEntry.get_text().trim();
        this._searchEntry.set_secondary_icon(query.length ? this._clearIcon : null);

        if (this._searchTimeout) { clearTimeout(this._searchTimeout); this._searchTimeout = null; }

        if (!query.length) {
            this._searchQuery = '';
            this._showFullList();
            if (this._searchCb) this._searchCb('');
            return;
        }

        this._searchTimeout = setTimeout(() => {
            this._searchTimeout = null;
            this._searchQuery   = query;
            this._renderSearch(query);
            if (this._searchCb) this._searchCb(query);
        }, SEARCH_DELAY);
    }

    _onSearchKeyPress(ev) {
        const sym = ev.get_key_symbol();
        if (sym === Clutter.KEY_Escape) {
            if (this._searchEntry.get_text()) {
                this.clearSearch();
            } else {
                this.applet.menu.close();
            }
            return Clutter.EVENT_STOP;
        }
        if ((sym === Clutter.KEY_Down || sym === Clutter.KEY_Return) &&
                this._appRows && this._appRows.length > 0) {
            global.stage.set_key_focus(this._appRows[0]);
            return Clutter.EVENT_STOP;
        }
        return Clutter.EVENT_PROPAGATE;
    }
}

module.exports = { AppList };
