// tileArea.js — MintTenMenu Tile Area (v4 — correct grid math + DnD + dynamic groups + cross-group dragging)
'use strict';

const St      = imports.gi.St;
const Clutter = imports.gi.Clutter;
const Gtk     = imports.gi.Gtk;
const Pango   = imports.gi.Pango;
const GLib    = imports.gi.GLib;
const {SignalManager} = imports.misc.signalManager;
const {DragMotionResult} = imports.ui.dnd;

const {TileItem, TileSize, tilePx, ACCENT_COLORS, CtxMenu} = require('./tileItem');
const {GRID_COLS, CELL, snapTileRect} = require('./gridMath');
const { TileLayoutEngine } = require('./layoutEngine');

// tilePx() is physical (matches Clutter set_size); inline St CSS takes logical px.
function tileCssPx(units) {
    return tilePx(units) / (global.ui_scale || 1);
}

const DEBUG_MODE = false; // Removable debug flag for DnD telemetry - set to false to remove debug HUD

// Helper to duplicate app list dragged actor
function createGhostActor(appName, iconTexture) {
    const size = tilePx(2); // 146px for medium
    const ghost = new St.BoxLayout({
        style: 'background-color: rgba(0, 120, 212, 0.6); border: 2px dashed #0078D4; padding: 4px;',
        vertical: true,
        width: size,
        height: size,
    });
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

    const lbl = new St.Label({
        text: appName,
        style: 'font-size: 11px; color: white;',
        x_align: Clutter.ActorAlign.START,
        y_align: Clutter.ActorAlign.END,
    });
    ghost.add_actor(lbl);
    return ghost;
}

function lightenHex(hex, amount) {
    try {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgb(${Math.min(255,r+amount)},${Math.min(255,g+amount)},${Math.min(255,b+amount)})`;
    } catch(e) { return hex; }
}

// ===========================================================================
// FolderExpansionItem
// ===========================================================================

class FolderExpansionItem {
    constructor(applet, utils, layoutEngine, expansionData) {
        this.applet       = applet;
        this.utils        = utils;
        this.layoutEngine = layoutEngine;
        this.data         = expansionData; // { id, folderId, group, x, y, w, h }
        this._signals     = new SignalManager(null);
        this._items       = [];

        this._buildUI();
    }

    get actor() { return this._box; }

    destroy() {
        this._signals.disconnectAllSignals();
        this._items = [];
        try { this._box.destroy(); } catch(e){}
    }

    collapseAnimated(callback) {
        const w = tilePx(6);
        this._box.save_easing_state();
        this._box.set_easing_duration(200);
        this._box.set_easing_mode(Clutter.AnimationMode.EASE_IN_QUAD);
        this._box.set_size(w, 0);
        this._box.set_opacity(0);
        this._box.restore_easing_state();
        setTimeout(callback, 205);
    }

    _buildUI() {
        const w = tilePx(6);
        const h = tilePx(this.data.h);
        const wCss = tileCssPx(6);

        this._box = new St.BoxLayout({
            style_class: 'wintenmenu-folder-expansion',
            style: `min-width:${wCss}px; width:${wCss}px; min-height:0px; height:0px; opacity:0; ` +
                   `background-color: rgba(0,0,0,0.35); border-top: 1px solid rgba(255,255,255,0.06); ` +
                   `border-bottom: 1px solid rgba(255,255,255,0.06); margin: 4px 0;`,
            vertical: true,
            reactive: true,
        });
        this._box._delegate = this;

        const folder = this.layoutEngine.tiles.find(t => t.id === this.data.folderId);
        const folderName = folder ? folder.name : 'Folder';

        const header = new St.Label({
            text: folderName.toUpperCase(),
            style: 'font-size: 10px; font-weight: bold; color: rgba(255,255,255,0.4); padding: 8px 12px 2px 12px;',
        });
        this._box.add_actor(header);

        // ScrollView for horizontal scrolling
        const scroll = new St.ScrollView({
            hscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
            vscrollbar_policy: Gtk.PolicyType.NEVER,
            x_expand: true,
            y_expand: true,
        });
        scroll.set_auto_scrolling(true);

        this._grid = new St.BoxLayout({
            style_class: 'wintenmenu-folder-expansion-grid',
            style: 'padding: 6px 12px; spacing: 8px;',
            vertical: false,
        });
        scroll.add_actor(this._grid);
        this._box.add(scroll, { expand: true });

        // Populate app items inside folder
        if (folder && folder.tiles) {
            for (const appData of folder.tiles) {
                this._addAppItem(folder, appData);
            }
        }

        GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            this._box.save_easing_state();
            this._box.set_easing_duration(250);
            this._box.set_easing_mode(Clutter.AnimationMode.EASE_OUT_QUAD);
            this._box.set_size(w, h);
            this._box.set_opacity(255);
            this._box.restore_easing_state();
            return GLib.SOURCE_REMOVE;
        });
    }

    _addAppItem(folder, appData) {
        const app = this._resolveApp(appData.appId);
        if (!app) return;

        const tileBox = new St.BoxLayout({
            style_class: 'wintenmenu-folder-app-tile',
            style: `width: 64px; height: 64px; background-color: ${folder.accentColor || '#0078D4'}; ` +
                   `border-radius: 3px; padding: 4px;`,
            vertical: true,
            reactive: true,
        });

        let icon;
        try { icon = app.cinnamonApp.create_icon_texture(32); } catch(e){
            icon = new St.Icon({ icon_name: 'application-x-executable', icon_size: 32 });
        }
        const iconBox = new St.BoxLayout({
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
            x_expand: true,
            y_expand: true,
        });
        if (icon) {
            iconBox.add(new Clutter.Clone({ source: icon }), { x_align: St.Align.MIDDLE, y_align: St.Align.MIDDLE });
        }
        tileBox.add(iconBox, { expand: true });

        const lbl = new St.Label({
            text: appData.appName || app.name || '',
            style: 'font-size: 9px; color: white; text-align: center;',
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.END,
        });
        tileBox.add_actor(lbl);

        this._signals.connect(tileBox, 'enter-event', () => {
            tileBox.style = `width: 64px; height: 64px; background-color: ${lightenHex(folder.accentColor || '#0078D4', 20)}; ` +
                           `border-radius: 3px; padding: 4px;`;
        });
        this._signals.connect(tileBox, 'leave-event', () => {
            tileBox.style = `width: 64px; height: 64px; background-color: ${folder.accentColor || '#0078D4'}; ` +
                           `border-radius: 3px; padding: 4px;`;
        });

        this._signals.connect(tileBox, 'button-release-event', (a, ev) => {
            if (ev.get_button() === Clutter.BUTTON_PRIMARY) {
                try { app.cinnamonApp.open_new_window(-1); } catch(e){}
                this.applet.menu.close();
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        });

        // Make draggable out of folder
        const makeDraggable = imports.ui.dnd.makeDraggable;
        const draggable = makeDraggable(tileBox, {
            restoreOnSuccess: true,
        });

        tileBox._delegate = {
            getDragActor: () => {
                let iconTex = null;
                try { iconTex = app.cinnamonApp.create_icon_texture(48); } catch(e){}
                return createGhostActor(appData.appName || app.name || '', iconTex);
            },
            getDragActorSource: () => tileBox,
            data: {
                id: appData.id,
                appId: appData.appId,
                appName: appData.appName,
                size: 'medium',
                w: 2,
                h: 2,
                accentColor: folder.accentColor || '#0078D4',
                isFromFolder: true,
                folderId: folder.id
            }
        };

        this._signals.connect(draggable, 'drag-begin', () => {
            tileBox.set_opacity(80);
            if (this.applet._tileArea) {
                // The drawer's rows are not tile data; collapse it so the drop
                // resolver sees the same layout the user sees.
                this.layoutEngine.collapseAllFolders();
                this.applet._tileArea.disableScrolling();
            }
        });
        this._signals.connect(draggable, 'drag-cancelled', () => {
            tileBox.set_opacity(255);
            if (this.applet._tileArea) {
                this.applet._tileArea.enableScrolling();
                this.applet._tileArea.revertToOriginalLayout();
            }
        });
        this._signals.connect(draggable, 'drag-end', () => {
            tileBox.set_opacity(255);
            if (this.applet._tileArea) {
                this.applet._tileArea.enableScrolling();
            }
        });

        this._grid.add_actor(tileBox);
    }

    _resolveApp(appId) {
        const apps = this.applet._appManager.getApps();
        let a = apps.find(x => x.id === appId);
        if (a) return a;
        const base = appId.replace(/\.desktop$/, '');
        return apps.find(x => x.id.replace(/\.desktop$/, '') === base) || null;
    }

    // ---- Drag & Drop Over Folder Expansion Drawer --------------------------

    handleDragOver(source, actor, x, y, time) {
        if (!source || typeof source.data === 'undefined') return DragMotionResult.NO_DROP;
        this._box.style = `min-width:${tileCssPx(6)}px; width:${tileCssPx(6)}px; min-height:${tileCssPx(this.data.h)}px; height:${tileCssPx(this.data.h)}px; ` +
                          `background-color: rgba(0, 120, 212, 0.15); border-top: 1px solid #0078D4; ` +
                          `border-bottom: 1px solid #0078D4; margin: 4px 0;`;
        return DragMotionResult.MOVE_DROP;
    }

    handleDragOut() {
        this._box.style = `min-width:${tileCssPx(6)}px; width:${tileCssPx(6)}px; min-height:${tileCssPx(this.data.h)}px; height:${tileCssPx(this.data.h)}px; ` +
                          `background-color: rgba(0,0,0,0.35); border-top: 1px solid rgba(255,255,255,0.06); ` +
                          `border-bottom: 1px solid rgba(255,255,255,0.06); margin: 4px 0;`;
    }

    acceptDrop(source, actor, x, y, time) {
        this.handleDragOut();
        if (!source || typeof source.data === 'undefined') return false;

        const dragData = source.data;
        const folder = this.layoutEngine.tiles.find(t => t.id === this.data.folderId);
        if (!folder) return false;

        if (dragData.folderId === folder.id) return false;

        // Moving between folders must not leave a copy behind in the source.
        if (dragData.isFromFolder && dragData.folderId) {
            this.layoutEngine.removeAppFromFolder(dragData.folderId, dragData.id);
        }
        this.layoutEngine.addAppToFolder(folder.id, dragData);

        if (this.applet._tileArea) {
            this.applet._tileArea.refreshAll();
        }
        return true;
    }
}

// ===========================================================================
// TileGroup
// ===========================================================================

class TileGroup {
    constructor(applet, utils, appManager, groupData, layoutEngine) {
        this.applet       = applet;
        this.utils        = utils;
        this.appManager   = appManager;
        this.data         = groupData;
        this.layoutEngine = layoutEngine;
        this._signals     = new SignalManager(null);
        this._tiles       = [];
        this._expansions  = [];
        this._draggedTileId = null;
        this._editing     = false;

        this._buildUI();
        this.refresh();
    }

    get actor() { return this._groupBox; }

    destroy() {
        this._signals.disconnectAllSignals();
        for (const t of this._tiles) t.destroy();
        for (const exp of this._expansions) exp.destroy();
        this._tiles = [];
        this._expansions = [];
        try { this._groupBox.destroy(); } catch(e){}
    }

    // ---- Public API --------------------------------------------------------

    refresh() {
        const t0 = GLib.get_monotonic_time();
        this._draggedTileId = null;
        if (this._previewRect) {
            this._previewRect.visible = false;
        }
        this._groupBox.remove_style_class_name('active-drop');

        // Sync tile coordinates from layout engine
        const groupTilesData = this.layoutEngine.getTilesForGroup(this.data.id);

        const normalTiles = groupTilesData.filter(t => t.type !== 'folder-expansion');
        const expansionTiles = groupTilesData.filter(t => t.type === 'folder-expansion');

        // Toggle empty grid state styling
        if (normalTiles.length === 0) {
            this._canvas.add_style_class_name('empty');
        } else {
            this._canvas.remove_style_class_name('empty');
        }

        const newTilesMap = new Map();
        for (const d of normalTiles) {
            newTilesMap.set(d.id, d);
        }

        const tDestroy0 = GLib.get_monotonic_time();
        // 1. Remove tiles that are no longer in this group
        for (let i = this._tiles.length - 1; i >= 0; i--) {
            const t = this._tiles[i];
            if (!newTilesMap.has(t.data.id)) {
                try { this._canvas.remove_child(t.actor); } catch(e){}
                t.destroy();
                this._tiles.splice(i, 1);
            }
        }
        const tDestroy1 = GLib.get_monotonic_time();

        const tRecreate0 = GLib.get_monotonic_time();
        // 2. Add or update tiles in-place
        for (const d of normalTiles) {
            const existing = this._tiles.find(t => t.data.id === d.id);
            if (!existing) {
                this._addTile(d);
            } else {
                const sizeChanged = (existing.data.size !== d.size || existing.data.w !== d.w || existing.data.h !== d.h);
                existing.data = d;
                if (sizeChanged) {
                    existing.updateGeometryAndStyle(true); // animate size change!
                }
            }
        }
        const tRecreate1 = GLib.get_monotonic_time();

        // 3. Rebuild folder expansions incrementally
        const newExpansionsMap = new Map();
        for (const d of expansionTiles) {
            newExpansionsMap.set(d.id, d);
        }

        for (let i = this._expansions.length - 1; i >= 0; i--) {
            const exp = this._expansions[i];
            if (!newExpansionsMap.has(exp.data.id)) {
                exp.destroy();
                this._expansions.splice(i, 1);
            }
        }

        for (const d of expansionTiles) {
            const existing = this._expansions.find(exp => exp.data.id === d.id);
            if (!existing) {
                const exp = new FolderExpansionItem(this.applet, this.utils, this.layoutEngine, d);
                this._expansions.push(exp);
                exp.actor.set_position(d.x * CELL, d.y * CELL);
                this._canvas.add_child(exp.actor);
            } else {
                existing.data = d;
                const targetX = d.x * CELL;
                const targetY = d.y * CELL;
                existing.actor.save_easing_state();
                existing.actor.set_easing_duration(150);
                existing.actor.set_easing_mode(Clutter.AnimationMode.EASE_OUT_QUAD);
                existing.actor.set_position(targetX, targetY);
                existing.actor.restore_easing_state();
            }
        }

        // 4. Animate all normal tiles to their correct positions (except the dragged one)
        for (const t of this._tiles) {
            if (t.data.id === this._draggedTileId) continue;
            this._placeTileAnimated(t);
        }

        this._syncCanvasSize();
        const tEnd = GLib.get_monotonic_time();
        global.log(`[PROFILE] TileGroup.refresh: destroy_widgets=${(tDestroy1 - tDestroy0) / 1000}ms, recreate_widgets=${(tRecreate1 - tRecreate0) / 1000}ms, total=${(tEnd - t0) / 1000}ms`);
    }

    animateToLayout(layout) {
        const groupTiles = layout.filter(t => t.group === this.data.id);
        for (const t of this._tiles) {
            if (t.data.id === this._draggedTileId) continue;
            const cand = groupTiles.find(c => c.id === t.data.id);
            if (cand) {
                this._placeTileAnimatedAt(t, cand.x, cand.y);
            }
        }
    }

    revertToOriginal() {
        const originalTiles = this.layoutEngine.getTilesForGroup(this.data.id);
        for (const t of this._tiles) {
            if (t.data.id === this._draggedTileId) continue;
            const orig = originalTiles.find(o => o.id === t.data.id);
            if (orig) {
                this._placeTileAnimatedAt(t, orig.x, orig.y);
            }
        }
    }

    // ---- Build UI ----------------------------------------------------------

    _buildUI() {
        this._groupBox = new St.BoxLayout({
            vertical: true,
            style_class: 'wintenmenu-tile-group',
            x_expand: true,
        });

        const headerBox = new St.BoxLayout({
            vertical: false,
            style_class: 'wintenmenu-group-header-box',
            x_expand: true,
        });

        // Editable group name label (expanded to full width)
        this._nameLabel = new St.Label({
            text: this.data.name || 'Start',
            style_class: 'wintenmenu-group-name-label',
            reactive: true,
            track_hover: true,
            x_expand: true,
        });
        this._nameLabel.clutter_text.ellipsize = Pango.EllipsizeMode.END;
        this._signals.connect(this._nameLabel, 'enter-event',
            () => this._nameLabel.add_style_pseudo_class('hover'));
        this._signals.connect(this._nameLabel, 'leave-event',
            () => this._nameLabel.remove_style_pseudo_class('hover'));
        this._signals.connect(this._nameLabel, 'button-release-event', (a, ev) => {
            if (ev.get_button() === Clutter.BUTTON_PRIMARY) {
                this._startEdit();
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        });
        headerBox.add(this._nameLabel, { expand: true });

        // The inline rename entry shares the header with the label and is
        // toggled instead of replacing the header box. Removing a St child
        // destroys it, which previously took the whole header (name and
        // overflow menu) with it when editing started.
        this._nameEntry = new St.Entry({
            text: '',
            style_class: 'wintenmenu-group-name-entry',
            can_focus: true,
            x_expand: true,
            visible: false,
        });
        this._nameEntry.clutter_text.set_single_line_mode(true);
        this._signals.connect(this._nameEntry.clutter_text, 'key-press-event', (a, ev) => {
            const sym = ev.get_key_symbol();
            if (sym === Clutter.KEY_Return || sym === Clutter.KEY_KP_Enter) {
                this._commitEdit();
                return Clutter.EVENT_STOP;
            }
            if (sym === Clutter.KEY_Escape) {
                this._cancelEdit();
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        });
        this._signals.connect(this._nameEntry.clutter_text, 'key-focus-out', () => {
            if (this._editing) this._commitEdit(false);
        });
        headerBox.add(this._nameEntry, { expand: true });

        // ⋮ Overflow button
        this._overflowBtn = new St.BoxLayout({
            style_class: 'wintenmenu-delete-group-btn',
            reactive: true,
        });
        this._overflowBtn.add_actor(new St.Label({
            text: "⋮",
            style: "font-size: 14px; font-weight: bold; padding: 2px 8px; color: white;",
        }));
        this._signals.connect(this._overflowBtn, 'button-release-event', (a, ev) => {
            if (ev.get_button() === Clutter.BUTTON_PRIMARY) {
                this._showGroupContextMenu(ev);
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        });
        headerBox.add_actor(this._overflowBtn);

        this._groupBox.add_actor(headerBox);

        // Underline header divider
        const groupDivider = new St.BoxLayout({
            style_class: 'wintenmenu-group-header-divider',
            style: 'height: 1px; background-color: rgba(255,255,255,0.08); margin-top: 4px; margin-bottom: 12px;',
            x_expand: true,
        });
        this._groupBox.add_actor(groupDivider);

        // Canvas: St.Widget
        this._canvas = new St.Widget({
            style_class: 'wintenmenu-tile-grid-canvas',
            reactive: true,
            x_expand: true,
            clip_to_allocation: false,
        });
        this._canvas._delegate = this;

        // Context menu on empty area
        this._signals.connect(this._canvas, 'button-release-event', (a, ev) => {
            if (ev.get_button() === Clutter.BUTTON_SECONDARY && ev.get_source() === this._canvas) {
                this._showEmptyAreaMenu(ev);
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        });

        // Preview rectangle for Drag & Drop
        this._previewRect = new St.Widget({
            style_class: 'wintenmenu-preview-rect',
            visible: false,
        });
        this._canvas.add_child(this._previewRect);

        this._syncCanvasSize();
        this._groupBox.add_actor(this._canvas);
    }

    _showGroupContextMenu(ev) {
        this.applet.closeActiveContextMenu();
        const menu = new CtxMenu(this.applet, this._overflowBtn, () => {});
        this.applet.registerActiveContextMenu(menu);

        menu.addItem('Rename Group', () => {
            this._startEdit();
        });

        menu.addItem('Delete Group', () => {
            this._confirmDeleteGroup();
        });

        // CtxMenu auto-shows in constructor.
    }

    _confirmDeleteGroup() {
        const msg = "This will remove the group. Tiles contained in this group will be moved to the previous group.";
        if (this.applet._tileArea) {
            this.applet._tileArea.showConfirmDialog("Delete Group?", msg, () => {
                this.layoutEngine.deleteGroupAndMoveTiles(this.data.id);
                this.applet._tileArea._loadAndPopulate();
            });
        }
    }

    _showEmptyAreaMenu(ev) {
        this.applet.closeActiveContextMenu();
        const menu = new CtxMenu(this.applet, this._canvas, () => {});
        this.applet.registerActiveContextMenu(menu);

        menu.addItem('Add New Group', () => {
            this.layoutEngine.groups.push({ id: 'group-' + Date.now(), name: 'New group' });
            this.layoutEngine.save();
            if (this.applet._tileArea) {
                this.applet._tileArea._loadAndPopulate();
            }
        });

        menu.addItem('Add New Folder', () => {
            const folderId = this.layoutEngine.createFolder(this.data.id);
            if (folderId) {
                this.refresh();
                // Find and rename folder inline
                const folderWidget = this._tiles.find(t => t.data.id === folderId);
                if (folderWidget) {
                    folderWidget._startRename();
                }
            }
        });

        menu.addSubItem('Add Widget', (flyout) => {
            [
                ['Weather',          'weather2'],
                ['Finance / Stocks', 'finance'],
                ['Calendar',         'calendar'],
                ['ToDo',             'todo'],
                ['Screen Time',      'screentime'],
                ['Quote of the Day', 'quote'],
            ].forEach(([label, kind]) => {
                flyout.addItem(label, '', () => {
                    this.layoutEngine.pinWidget(kind, this.data.id);
                    if (this.applet._tileArea) {
                        this.applet._tileArea._loadAndPopulate();
                    }
                });
            });
        });
        // CtxMenu already shows itself in the constructor — no .show() call needed.
    }

    _syncCanvasSize() {
        const maxRow = this._getMaxRow();
        const rows   = Math.max(maxRow + 3, 4);   // at least 4 rows visible
        if (this._lastRows !== rows) {
            this._lastRows = rows;
            const canvasW = tilePx(GRID_COLS);
            const canvasH = tilePx(rows);
            this._canvas.set_size(canvasW, canvasH);
        }
    }

    // ---- Name editing ------------------------------------------------------

    _startEdit() {
        if (this._editing) return;
        this._editing = true;
        this._nameEntry.set_text(this.data.name || '');
        this._nameLabel.hide();
        this._nameEntry.show();
        global.stage.set_key_focus(this._nameEntry.clutter_text);
    }

    // Hand focus back to the menu before hiding the entry; otherwise
    // PopupMenuManager sees key focus leave the menu and closes it.
    _restoreMenuFocus() {
        try { this.applet.menu.actor.grab_key_focus(); } catch(e){}
    }

    _commitEdit(restoreFocus = true) {
        if (!this._editing) return;
        this._editing = false;
        const newName = (this._nameEntry.get_text() || '').trim() || this.data.name;
        this.data.name = newName;
        this._nameLabel.set_text(newName);
        // Move focus off the entry before hiding it, or the popup manager sees
        // focus leave the menu and closes it.
        if (restoreFocus) this._restoreMenuFocus();
        this._nameEntry.hide();
        this._nameLabel.show();
        this.layoutEngine.save();
    }

    _cancelEdit() {
        if (!this._editing) return;
        this._editing = false;
        this._restoreMenuFocus();
        this._nameEntry.hide();
        this._nameLabel.show();
    }

    // ---- Tile management ---------------------------------------------------

    _addTile(td) {
        // app parameter is null for folders and widgets
        const app = (td.type === 'folder' || td.type === 'widget') ? null : this._resolveApp(td.appId);
        if (td.type !== 'folder' && td.type !== 'widget' && !app) return;

        const tile = new TileItem(this.applet, this.utils, td, app, this.layoutEngine);

        tile.on('unpin', (t) => {
            try {
                global.log("[Widget] Unpin event triggered for tile ID = " + t.data.id + " (type = " + t.data.type + ")");
                this.layoutEngine.unpinTile(t.data.id);
                if (this.applet._tileArea) {
                    this.applet._tileArea.refreshAll();
                }
            } catch (e) {
                global.logError("MintTenMenu: Error on tile unpin: " + e);
            }
        });

        tile.on('resize', (t, newSize) => {
            try {
                const t0 = GLib.get_monotonic_time();
                // Expanded folder drawers occupy rows that are not part of the
                // tile grid; collapse them before validating the new footprint.
                const hadExpanded = this.layoutEngine.tiles.some(
                    x => x.type === 'folder' && x.expanded);
                if (hadExpanded) {
                    this.layoutEngine.collapseAllFolders();
                    if (this.applet._tileArea) this.applet._tileArea.refreshAll();
                }
                const success = this.layoutEngine.validateAndResize(t.data.id, newSize);
                const t1 = GLib.get_monotonic_time();
                if (success) {
                    if (this.applet._tileArea) {
                        this.applet._tileArea.refreshAll();
                    }
                } else {
                    const Main = imports.ui.main;
                    Main.notify("MintTenMenu", "Cannot resize tile: placement blocked.");
                }
                const t2 = GLib.get_monotonic_time();
                global.log(`[PROFILE] Resize pipeline: validation_and_save=${(t1 - t0) / 1000}ms, ui_refresh=${(t2 - t1) / 1000}ms, total=${(t2 - t0) / 1000}ms`);
            } catch (e) {
                global.logError("MintTenMenu: Error on tile resize: " + e);
            }
        });

        tile.on('changed', () => {
            try {
                this.layoutEngine.save();
                if (this.applet._tileArea) {
                    this.applet._tileArea.refreshAll();
                }
            } catch (e) {
                global.logError("MintTenMenu: Error on tile changed: " + e);
            }
        });

        this._placeTile(tile);
        this._canvas.add_child(tile.actor);
        this._tiles.push(tile);
    }

    _placeTile(tile) {
        tile.actor.set_position(tile.data.x * CELL, tile.data.y * CELL);
    }

    _placeTileAnimated(tile) {
        this._placeTileAnimatedAt(tile, tile.data.x, tile.data.y);
    }

    _placeTileAnimatedAt(tile, gridX, gridY) {
        const targetX = Math.round(gridX * CELL);
        const targetY = Math.round(gridY * CELL);
        if (tile._targetX === targetX && tile._targetY === targetY) {
            return;
        }
        tile._targetX = targetX;
        tile._targetY = targetY;
        tile.actor.save_easing_state();
        tile.actor.set_easing_duration(150);
        tile.actor.set_easing_mode(Clutter.AnimationMode.EASE_OUT_QUAD);
        tile.actor.set_position(targetX, targetY);
        tile.actor.restore_easing_state();
    }

    _resolveApp(appId) {
        const apps = this.appManager.getApps();
        let a = apps.find(x => x.id === appId);
        if (a) return a;
        const base = appId.replace(/\.desktop$/, '');
        return apps.find(x => x.id.replace(/\.desktop$/, '') === base) || null;
    }

    // ---- Drag & Drop Canvas-Level Handlers ---------------------------------

    // Snap the visual drag actor, not the pointer: the grab point can be
    // anywhere on the tile, so pointer-anchored math lands up to a cell away.
    _snapDragTarget(source, actor, x, y) {
        const data = (source && source.data) || {};
        const spanCols = data.w || 2;
        const spanRows = data.h || 2;

        let originX;
        let originY;
        if (actor) {
            const [actorX, actorY] = actor.get_transformed_position();
            const [canvasX, canvasY] = this._canvas.get_transformed_position();
            originX = actorX - canvasX;
            originY = actorY - canvasY;
        } else {
            originX = x - tilePx(spanCols) / 2;
            originY = y - tilePx(spanRows) / 2;
        }
        return snapTileRect(originX, originY, spanCols, spanRows);
    }

    _folderAtPixel(x, y, excludeId) {
        return this._tiles.find(t =>
            t.data.type === 'folder' &&
            t.data.id !== excludeId &&
            x >= t.data.x * CELL && x < t.data.x * CELL + tilePx(t.data.w) &&
            y >= t.data.y * CELL && y < t.data.y * CELL + tilePx(t.data.h)
        ) || null;
    }

    // Shared by hover preview and commit, so the drop can never disagree with
    // the preview or depend on a stale cached candidate.
    _computeDrop(source, actor, x, y) {
        if (!source || typeof source.data === 'undefined') return null;

        const target = this._snapDragTarget(source, actor, x, y);
        const folder = this._folderAtPixel(x, y, source.data.id);
        const candidate = folder
            ? null
            : this.layoutEngine.resolveRelocation(this.data.id, source.data, target.col, target.row);

        return {
            col: target.col,
            row: target.row,
            w: target.w,
            h: target.h,
            folder,
            candidate,
        };
    }

    _showPreview(x, y, w, h, styleClass) {
        this._previewRect.style_class = styleClass;
        this._previewRect.set_position(Math.round(x), Math.round(y));
        this._previewRect.set_size(w, h);
        this._previewRect.visible = true;
    }

    handleDragOver(source, actor, x, y, time) {
        try {
            const drop = this._computeDrop(source, actor, x, y);
            if (!drop) return DragMotionResult.NO_DROP;

            this._draggedTileId = source.data.id;
            this._groupBox.add_style_class_name('active-drop');

            if (this.applet._tileArea) {
                this.applet._tileArea._activeDragGroup = this;
                this.applet._tileArea._activeDragSource = source;
                this.applet._tileArea._activeDragActor = actor;
            }

            for (const t of this._tiles) {
                if (t.data.type === 'folder') t.highlightForDrop(false);
            }

            if (drop.folder) {
                drop.folder.highlightForDrop(true);
                this._hoveredFolderId = drop.folder.data.id;
                this._showPreview(
                    drop.folder.data.x * CELL, drop.folder.data.y * CELL,
                    tilePx(drop.folder.data.w), tilePx(drop.folder.data.h),
                    'wintenmenu-preview-rect folder-drop');
                if (this.applet._tileArea) {
                    this.applet._tileArea.revertToOriginalLayout();
                }
                return DragMotionResult.MOVE_DROP;
            }

            this._hoveredFolderId = null;

            if (drop.candidate) {
                this._showPreview(
                    drop.col * CELL, drop.row * CELL,
                    tilePx(drop.w), tilePx(drop.h),
                    'wintenmenu-preview-rect valid');
                if (this.applet._tileArea) {
                    this.applet._tileArea.animateCandidateLayout(drop.candidate);
                }
                return DragMotionResult.MOVE_DROP;
            }

            this._showPreview(
                drop.col * CELL, drop.row * CELL,
                tilePx(drop.w), tilePx(drop.h),
                'wintenmenu-preview-rect invalid');
            if (this.applet._tileArea) {
                this.applet._tileArea.revertToOriginalLayout();
            }
            return DragMotionResult.NO_DROP;
        } catch (e) {
            global.logWarning("MintTenMenu: Error in handleDragOver: " + e);
            return DragMotionResult.NO_DROP;
        }
    }

    handleDragOut() {
        try {
            this._previewRect.visible = false;
            this._groupBox.remove_style_class_name('active-drop');

            for (const t of this._tiles) {
                if (t.data.type === 'folder') t.highlightForDrop(false);
            }

            if (this.applet._tileArea) {
                if (this.applet._tileArea._activeDragGroup === this) {
                    this.applet._tileArea.clearDragScrollContext();
                }
                this.applet._tileArea.revertToOriginalLayout();
            }
        } catch (e) {
            global.logWarning("MintTenMenu: Error in handleDragOut: " + e);
        }
    }

    acceptDrop(source, actor, x, y, time) {
        const tileArea = this.applet._tileArea;
        try {
            if (tileArea) tileArea.clearDragScrollContext();
            if (!source || typeof source.data === 'undefined') return false;

            // Recompute at drop time from the live actor position. A fast drag
            // may drop before the last hover ran, so cached preview state can
            // never be trusted to decide the committed layout.
            const drop = this._computeDrop(source, actor, x, y);
            if (!drop) return false;

            const dragData = source.data;

            for (const t of this._tiles) {
                if (t.data.type === 'folder') t.highlightForDrop(false);
            }

            this._previewRect.visible = false;
            this._draggedTileId = null;
            this._hoveredFolderId = null;
            this._groupBox.remove_style_class_name('active-drop');
            if (tileArea) tileArea.clearScrollTimer();

            if (drop.folder) {
                const folderId = drop.folder.data.id;
                if (dragData.isFromFolder && dragData.folderId &&
                        dragData.folderId !== folderId) {
                    this.layoutEngine.removeAppFromFolder(dragData.folderId, dragData.id);
                }
                this.layoutEngine.addAppToFolder(folderId, dragData);
                if (tileArea) tileArea.refreshAll();
                return true;
            }

            // Atomic commit: never write a partial or inconsistent layout.
            const candidate = drop.candidate;
            const valid = candidate &&
                this.layoutEngine.isValidGroupLayout(this.data.id, candidate) &&
                candidate.some(t => t.id === dragData.id);

            if (!valid) {
                if (tileArea) tileArea.revertToOriginalLayout();
                return false;
            }

            if (dragData.isFromFolder && dragData.folderId) {
                this.layoutEngine.removeAppFromFolder(dragData.folderId, dragData.id);
            }

            this.layoutEngine.tiles = candidate;
            this.layoutEngine.save();

            if (tileArea) tileArea.refreshAll();
            return true;
        } catch (e) {
            global.logWarning("MintTenMenu: Error in acceptDrop: " + e);
            if (tileArea) {
                tileArea.enableScrolling();
                tileArea.revertToOriginalLayout();
            }
            return false;
        }
    }

    // ---- Helper metrics ----------------------------------------------------

    _getMaxRow() {
        // Measure rendered actors, not layout data: a tile whose app no longer
        // resolves never gets an actor and must not stretch the group, leaving
        // a large empty band before the next group.
        let maxRow = -1;
        for (const t of this._tiles) {
            maxRow = Math.max(maxRow, t.data.y + t.data.h - 1);
        }
        for (const exp of this._expansions) {
            maxRow = Math.max(maxRow, exp.data.y + exp.data.h - 1);
        }
        return maxRow;
    }
}

// ===========================================================================
// TileArea
// ===========================================================================

class TileArea {
    constructor(applet, utils, appManager) {
        this.applet     = applet;
        this.utils      = utils;
        this.appManager = appManager;
        this._signals   = new SignalManager(null);
        this._groups    = [];
        this._scrollTimerId = null;
        this._scrollDirection = null;
        this._scrollDistance = null;
        this._isDragging = false;
        this._confirmBox = null;
        this._appliedWidth = -1;
        this._widthSyncId = null;

        this.layoutEngine = new TileLayoutEngine(this.utils);
        this.layoutEngine.load();
        // Apps may have been removed while Cinnamon was not running.
        this.layoutEngine.pruneApps(id => this.isAppAvailable(id));

        this._buildUI();
        this._loadAndPopulate();

        if (DEBUG_MODE) {
            this._buildDebugOverlay();
        }
    }

    get actor() { return this._outerBox; }

    // ---- Width -----------------------------------------------------------------
    // The tile area must be exactly as wide as its content:
    //   canvas (physical) + groups-box horizontal padding (theme, already scaled)
    //   + the live vertical-scrollbar allocation (0 when no scrollbar is needed).
    // Nothing here is hardcoded: padding and scrollbar width are read at runtime.

    getRequiredWidth() {
        const scale = global.ui_scale || 1;
        const canvasW = tilePx(GRID_COLS);

        let padH = 14 * scale;
        try {
            const node = this._groupsContainer.get_theme_node();
            padH = node.get_padding(St.Side.LEFT) + node.get_padding(St.Side.RIGHT);
        } catch (e) {}

        let scrollW = 0;
        try {
            const adj = this._scrollBox.vscroll.adjustment;
            const v = this._scrollBox.vscroll;
            // Before the first allocation page_size is 0; assume the scrollbar is
            // needed so tiles are never clipped, then correct on 'changed'.
            const needsScrollbar = !adj || adj.page_size <= 0 ||
                adj.upper > adj.page_size + 0.5;
            if (needsScrollbar) {
                const pw = v.get_preferred_width(-1);
                scrollW = Math.max(pw[0], pw[1], v.width);
                // Pre-theme fallback only: the real width is read above.
                if (scrollW <= 0) scrollW = Math.round(21 * scale);
            }
        } catch (e) {
            scrollW = Math.round(21 * scale);
        }

        return Math.ceil(canvasW + padH + scrollW);
    }

    _scheduleWidthSync() {
        if (this._widthSyncId) return;
        this._widthSyncId = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            this._widthSyncId = null;
            this._syncWidth();
            return GLib.SOURCE_REMOVE;
        });
    }

    _syncWidth() {
        const w = this.getRequiredWidth();
        if (w === this._appliedWidth) return;
        this._appliedWidth = w;
        const logical = w / (global.ui_scale || 1);
        this._outerBox.style = `min-width:${logical}px; max-width:${logical}px;`;
        this._outerBox.set_width(w);
        if (this.applet && typeof this.applet._layoutColumns === 'function') {
            this.applet._layoutColumns(false);
        }
    }

    destroy() {
        this.clearScrollTimer();
        this.applet.closeActiveContextMenu();
        this._signals.disconnectAllSignals();
        for (const g of this._groups) g.destroy();
        this._groups = [];

        if (this._debugBox) {
            try { this._debugBox.destroy(); } catch(e){}
            this._debugBox = null;
        }

        if (this._confirmBox) {
            try { this._confirmBox.destroy(); } catch(e){}
            this._confirmBox = null;
        }

        try { this._outerBox.destroy(); } catch(e){}
    }

    pinApp(app) {
        if (this.layoutEngine.hasAppTile(app.id)) return;
        if (!this.layoutEngine.groups.length) {
            this.layoutEngine.groups.push({ id: 'group-' + Date.now(), name: 'Start' });
            this.layoutEngine.save();
        }
        const groupId = this.layoutEngine.groups[0].id;
        this.layoutEngine.pinApp(app, groupId);
        this._loadAndPopulate();
    }

    hasAppTile(appId) {
        return this.layoutEngine.hasAppTile(appId);
    }

    removeAppFromStart(appId) {
        if (!this.layoutEngine.removeAppTiles(appId)) return false;
        this._loadAndPopulate();
        return true;
    }

    pruneMissingApps(refresh = true) {
        const changed = this.layoutEngine.pruneApps(id => this.isAppAvailable(id));
        if (changed && refresh) this._loadAndPopulate();
        return changed;
    }

    isAppAvailable(appId) {
        if (!appId) return false;
        const app = this.appManager.getCinnamonApp(appId);
        if (!app) return false;
        let filename = null;
        try {
            const info = app.get_app_info ? app.get_app_info() : null;
            filename = info && info.get_filename ? info.get_filename() : null;
        } catch (e) {}
        if (filename && !GLib.file_test(filename, GLib.FileTest.EXISTS)) return false;
        return true;
    }

    getExpansionWidget(folderId) {
        for (const g of this._groups) {
            for (const exp of g._expansions) {
                if (exp.data.folderId === folderId) {
                    return exp;
                }
            }
        }
        return null;
    }

    showConfirmDialog(title, message, onConfirm) {
        if (this._confirmBox) {
            try { this._confirmBox.destroy(); } catch(e){}
        }

        this._confirmBox = new St.BoxLayout({
            style_class: 'wintenmenu-confirm-dialog',
            style: 'background-color: rgba(25, 25, 25, 0.95); border: 2px solid rgba(255, 255, 255, 0.1); ' +
                   'border-radius: 6px; padding: 20px; spacing: 14px; min-width: 320px; ' +
                   'position: absolute; box-shadow: 0px 4px 16px rgba(0,0,0,0.5);',
            vertical: true,
            reactive: true,
        });

        const titleLabel = new St.Label({
            text: title,
            style: 'font-size: 14px; font-weight: bold; color: white; margin-bottom: 6px;',
        });
        this._confirmBox.add_actor(titleLabel);

        const msgLabel = new St.Label({
            text: message,
            style: 'font-size: 11px; color: rgba(255, 255, 255, 0.7); margin-bottom: 12px;',
        });
        msgLabel.clutter_text.set_line_wrap(true);
        this._confirmBox.add_actor(msgLabel);

        const btnBox = new St.BoxLayout({
            vertical: false,
            style: 'spacing: 12px;',
            x_align: Clutter.ActorAlign.END,
        });

        const cancelBtn = new St.Button({
            label: 'Cancel',
            style_class: 'wintenmenu-confirm-btn cancel',
            style: 'background-color: rgba(255,255,255,0.08); padding: 6px 16px; border-radius: 3px; color: white;',
            reactive: true,
        });
        cancelBtn.connect('clicked', () => {
            this._confirmBox.destroy();
            this._confirmBox = null;
        });
        btnBox.add_actor(cancelBtn);

        const okBtn = new St.Button({
            label: 'Delete',
            style_class: 'wintenmenu-confirm-btn confirm',
            style: 'background-color: #E74856; padding: 6px 16px; border-radius: 3px; color: white;',
            reactive: true,
        });
        okBtn.connect('clicked', () => {
            this._confirmBox.destroy();
            this._confirmBox = null;
            onConfirm();
        });
        btnBox.add_actor(okBtn);

        this._confirmBox.add_actor(btnBox);

        if (this.applet._menuContainer) {
            this.applet._menuContainer.add_actor(this._confirmBox);
            const W = this.applet.settings.customMenuWidth || 940;
            const H = this.applet.settings.customMenuHeight || 640;
            this._confirmBox.set_position(
                (W * global.ui_scale - 340) / 2,
                (H * global.ui_scale - 200) / 2
            );
        }
    }

    refreshAll() {
        const adj = this._scrollBox && this._scrollBox.vscroll ? this._scrollBox.vscroll.adjustment : null;
        const scrollVal = adj ? adj.value : 0;

        for (const g of this._groups) {
            g.refresh();
        }

        if (adj) {
            GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
                const currentAdj = this._scrollBox && this._scrollBox.vscroll ? this._scrollBox.vscroll.adjustment : null;
                if (currentAdj) {
                    currentAdj.value = scrollVal;
                }
                return GLib.SOURCE_REMOVE;
            });
        }

        if (DEBUG_MODE) {
            this.updateDebug({
                state: 'Inactive',
                tileId: 'None',
                x: 0,
                y: 0,
                col: 'None',
                row: 'None',
                valid: 'N/A',
                collisions: 0
            });
        }
    }

    animateCandidateLayout(layout) {
        for (const g of this._groups) {
            g.animateToLayout(layout);
        }
    }

    revertToOriginalLayout() {
        for (const g of this._groups) {
            g.revertToOriginal();
        }
    }

    onTileVisualSettingsChanged() {
        for (const g of this._groups) {
            for (const t of g._tiles) {
                t.refreshStyle();
            }
        }
    }

    setupScrollTimer() {
        if (this._scrollTimerId) {
            return;
        }

        this._scrollTimerId = setInterval(() => {
            if (!this._scrollBox) {
                return;
            }

            const adj = this._scrollBox.vscroll ? this._scrollBox.vscroll.adjustment : null;
            if (!adj) {
                return;
            }

            const [pointerStageX, pointerStageY] = global.get_pointer();
            const [scrollBoxStageX, scrollBoxStageY] = this._scrollBox.get_transformed_position();
            const [scrollBoxWidth, scrollBoxHeight] = this._scrollBox.get_transformed_size();

            // Threshold of 45 logical pixels, scaled by global.ui_scale to match stage units
            const threshold = 45 * global.ui_scale;

            const relY = pointerStageY - scrollBoxStageY;
            const relX = pointerStageX - scrollBoxStageX;

            // Confirm horizontal bounds to avoid scrolling when mouse leaves menu horizontally
            if (relX < 0 || relX > scrollBoxWidth) {
                return;
            }

            let shouldScroll = false;
            let direction = 'none';
            let dist = 0;

            if (relY >= 0 && relY < threshold) {
                shouldScroll = true;
                direction = 'up';
                dist = relY;
            } else if (relY > scrollBoxHeight - threshold && relY <= scrollBoxHeight) {
                shouldScroll = true;
                direction = 'down';
                dist = scrollBoxHeight - relY;
            }

            if (!shouldScroll) {
                return;
            }

            const clampedDist = Math.max(0, Math.min(threshold, dist));
            const delta = Math.round(4 + (threshold - clampedDist) * 0.4);

            const oldVal = adj.value;
            let targetVal = oldVal;

            if (direction === 'up') {
                targetVal = Math.max(0, oldVal - delta);
            } else if (direction === 'down') {
                const maxScroll = adj.upper - adj.page_size;
                targetVal = Math.min(maxScroll, oldVal + delta);
            }

            if (targetVal !== oldVal) {
                adj.value = targetVal;
                this._updateDragOnScroll();
            }
        }, 25);
    }

    clearScrollTimer() {
        if (this._scrollTimerId) {
            clearInterval(this._scrollTimerId);
            this._scrollTimerId = null;
        }
        this.clearDragScrollContext();
    }

    _updateDragOnScroll() {
        if (!this._activeDragGroup || !this._activeDragSource || !this._activeDragActor) return;
        try {
            let [stageX, stageY] = global.get_pointer();
            let [success, canvasX, canvasY] = this._activeDragGroup._canvas.transform_stage_point(stageX, stageY);
            if (success) {
                this._activeDragGroup.handleDragOver(
                    this._activeDragSource,
                    this._activeDragActor,
                    canvasX,
                    canvasY,
                    0
                );
            }
        } catch (e) {
            global.logWarning("MintTenMenu: Failed to update drag on scroll: " + e);
        }
    }

    clearDragScrollContext() {
        this._activeDragGroup = null;
        this._activeDragSource = null;
        this._activeDragActor = null;
    }

    // ---- Build UI ----------------------------------------------------------

    _buildUI() {
        // Width is derived at runtime in _syncWidth(); the initial style is only
        // a placeholder until the first idle sync runs.
        this._outerBox = new St.BoxLayout({
            vertical: true,
            style_class: 'wintenmenu-tile-area',
            x_expand: false,
            y_expand: true,
        });



        this._scrollBox = new St.ScrollView({
            style_class: 'wintenmenu-tile-scroll',
            hscrollbar_policy: Gtk.PolicyType.NEVER,
            vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
            x_expand: true,
            y_expand: true,
        });
        this._scrollBox.set_auto_scrolling(true);

        // Width depends on whether the vertical scrollbar is currently needed.
        this._signals.connect(this._scrollBox.vscroll.adjustment, 'changed',
            () => this._scheduleWidthSync());

        this._coreGroupsBox = new St.BoxLayout({
            vertical: true,
            x_expand: true,
        });

        this._groupsContainer = new St.BoxLayout({
            vertical: true,
            style_class: 'wintenmenu-tile-groups-box',
            x_expand: true,
        });
        this._coreGroupsBox.add_actor(this._groupsContainer);

        // Drop Zone to Create New Group (visible only during active dragging)
        this._newGroupDropZone = new St.BoxLayout({
            style_class: 'wintenmenu-new-group-dropzone',
            reactive: true,
            x_expand: true,
            visible: false,
        });
        const dropLabel = new St.Label({
            text: '+ Create New Group',
            style: 'font-size: 0.9em; font-weight: bold; color: rgba(255,255,255,0.6); padding: 16px; text-align: center;',
            x_expand: true,
        });
        this._newGroupDropZone.add_actor(dropLabel);
        this._newGroupDropZone._delegate = {
            handleDragOver: () => {
                this._newGroupDropZone.style = 'background-color: rgba(0, 120, 212, 0.15); border: 2px dashed #0078D4; margin: 8px 12px;';
                return DragMotionResult.MOVE_DROP;
            },
            handleDragOut: () => {
                this._newGroupDropZone.style = '';
            },
            acceptDrop: (source) => {
                this._newGroupDropZone.style = '';
                if (!source || typeof source.data === 'undefined') return false;

                const newGroupId = 'group-' + Date.now();
                this.layoutEngine.groups.push({ id: newGroupId, name: 'New group' });

                const dragData = source.data;
                if (dragData.isFromFolder && dragData.folderId) {
                    this.layoutEngine.removeAppFromFolder(dragData.folderId, dragData.id);
                }

                const tileData = {
                    ...dragData,
                    group: newGroupId,
                    x: 0,
                    y: 0,
                    w: dragData.w || 2,
                    h: dragData.h || 2
                };

                this.layoutEngine.tiles = this.layoutEngine.tiles.filter(t => t.id !== tileData.id);
                this.layoutEngine.tiles.push(tileData);
                this.layoutEngine.save();

                this._loadAndPopulate();

                const newGroupWidget = this._groups.find(g => g.data.id === newGroupId);
                if (newGroupWidget) {
                    newGroupWidget._startEdit();
                }

                return true;
            }
        };
        this._coreGroupsBox.add_actor(this._newGroupDropZone);

        this._scrollBox.add_actor(this._coreGroupsBox);
        this._outerBox.add(this._scrollBox);
    }

    disableScrolling() {
        this._isDragging = true;
        this._newGroupDropZone.visible = true;
        this.setupScrollTimer();
    }

    enableScrolling() {
        this._isDragging = false;
        this._newGroupDropZone.visible = false;
        this.clearScrollTimer();
    }

    onMenuOpen() {
        this._scheduleWidthSync();
    }

    onMenuClose() {
        // Stop any in-progress DnD scroll
        this.clearScrollTimer();
        this.clearDragScrollContext();
        this._isDragging = false;
        if (this._newGroupDropZone) this._newGroupDropZone.visible = false;

        // Close the confirmation dialog if it was left open
        if (this._confirmBox) {
            try { this._confirmBox.destroy(); } catch(e) {}
            this._confirmBox = null;
        }

        // Reset transient drag/drop state inside every group
        for (const g of this._groups) {
            if (g._previewRect) g._previewRect.visible = false;
            g._draggedTileId   = null;
            g._hoveredFolderId = null;
            try { g._groupBox.remove_style_class_name('active-drop'); } catch(e) {}
            for (const t of g._tiles) {
                if (t.data.type === 'folder') {
                    try { t.highlightForDrop(false); } catch(e) {}
                }
            }
        }

        // Collapse any expanded folder drawers and repopulate if needed
        const anyExpanded = this.layoutEngine.tiles.some(
            t => t.type === 'folder' && t.expanded
        );
        if (anyExpanded) {
            this.layoutEngine.collapseAllFolders();
            this._loadAndPopulate();
        }

        // Reset tile area scroll to top
        try {
            const adj = this._scrollBox && this._scrollBox.vscroll
                ? this._scrollBox.vscroll.adjustment : null;
            if (adj) adj.value = adj.lower;
        } catch(e) {}

        this._forEachWidget(w => w.pause());
    }

    _forEachWidget(fn) {
        for (const g of this._groups) {
            for (const t of g._tiles) {
                if (t._widget) {
                    try { fn(t._widget); } catch(e) {}
                }
            }
        }
    }

    _loadAndPopulate() {
        const adj = this._scrollBox && this._scrollBox.vscroll ? this._scrollBox.vscroll.adjustment : null;
        const scrollVal = adj ? adj.value : 0;

        for (const g of this._groups) g.destroy();
        this._groups = [];
        this._groupsContainer.remove_all_children();

        for (const gd of this.layoutEngine.groups) {
            this._createGroup(gd);
        }

        if (adj) {
            GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
                const currentAdj = this._scrollBox && this._scrollBox.vscroll ? this._scrollBox.vscroll.adjustment : null;
                if (currentAdj) {
                    currentAdj.value = scrollVal;
                }
                return GLib.SOURCE_REMOVE;
            });
        }

        this._scheduleWidthSync();
    }

    _createGroup(gd) {
        if (this._groups.length > 0) {
            const sep = new St.BoxLayout({
                style: 'height:1px; background-color:rgba(255,255,255,0.07); margin:8px 0;',
                x_expand: true,
            });
            this._groupsContainer.add_actor(sep);
        }
        const group = new TileGroup(
            this.applet, this.utils, this.appManager, gd, this.layoutEngine
        );
        this._groups.push(group);
        this._groupsContainer.add_actor(group.actor);
    }

    // ---- Debug overlay helper methods --------------------------------------

    _buildDebugOverlay() {
        this._debugBox = new St.BoxLayout({
            vertical: true,
            style: 'background-color: rgba(0,0,0,0.85); border: 1px solid #ff0055; ' +
                   'padding: 8px; border-radius: 4px; min-width: 190px; ' +
                   'position: absolute; right: 20px; top: 40px;',
        });
        this._debugLabel = new St.Label({
            text: 'Drag State: Inactive\nTile ID: None\nCursor Pos: 0, 0\nHovered Cell: None, None\nDrop Valid: N/A\nCollision Count: 0',
            style: 'font-family: monospace; font-size: 11px; color: #ff0055;',
        });
        this._debugBox.add_actor(this._debugLabel);

        setTimeout(() => {
            try {
                if (this.applet._menuContainer) {
                    this.applet._menuContainer.add_actor(this._debugBox);
                    const customW = this.applet.settings.customMenuWidth || 940;
                    this._debugBox.set_position((customW - 210) * global.ui_scale, 45 * global.ui_scale);
                }
            } catch(e){}
        }, 150);
    }

    updateDebug(data) {
        if (!this._debugLabel) return;
        this._debugLabel.text =
            `Drag State: ${data.state || 'Inactive'}\n` +
            `Tile ID: ${data.tileId || 'None'}\n` +
            `Cursor Pos: ${data.x || 0}, ${data.y || 0}\n` +
            `Hovered Cell: ${data.col !== undefined ? data.col : 'None'}, ${data.row !== undefined ? data.row : 'None'}\n` +
            `Drop Valid: ${data.valid !== undefined ? (data.valid ? 'Yes' : 'No') : 'N/A'}\n` +
            `Collision Count: ${data.collisions !== undefined ? data.collisions : 0}`;
    }
}

module.exports = { TileArea };
