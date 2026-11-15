// layoutEngine.js — TileLayoutEngine for MintTenMenu
'use strict';

const { GRID_COLS, SIZE_UNITS } = require('./gridMath');

const ACCENT_COLORS = [
    '#0078D4','#E74856','#0099BC','#7A7574','#767676',
    '#CA5010','#038387','#C239B3','#881798','#498205','#107C10','#515C6B',
];

class TileLayoutEngine {
    constructor(utils) {
        this.utils = utils;
        this.tiles = [];
        this.groups = [];
    }

    load() {
        const saved = this.utils.loadJSON('tiles.json', null);
        if (saved && saved.tiles && saved.tiles.length > 0) {
            this.tiles = saved.tiles;
            this.groups = saved.groups || [{ id: 'group-default', name: 'Start' }];
        } else {
            // Convert old structure or populate defaults
            this.groups = (saved && saved.groups && saved.groups.length > 0)
                ? saved.groups.map(g => ({ id: g.id, name: g.name }))
                : [{ id: 'group-default', name: 'Start' }];

            this.tiles = [];
            let oldTiles = [];
            if (saved && saved.groups) {
                for (const g of saved.groups) {
                    if (g.tiles) {
                        for (const t of g.tiles) {
                            oldTiles.push({ ...t, group: g.id });
                        }
                    }
                }
            }

            if (oldTiles.length === 0) {
                // Default tiles if nothing was saved
                oldTiles = [
                    { id: 'dt1', appId: 'nemo.desktop',                  appName: 'Files',       size: 'medium', accentColor: '#0078D4', col: 0, row: 0, group: 'group-default' },
                    { id: 'dt2', appId: 'cinnamon-settings.desktop',     appName: 'Settings',    size: 'medium', accentColor: '#7A7574', col: 2, row: 0, group: 'group-default' },
                    { id: 'dt3', appId: 'firefox.desktop',               appName: 'Firefox',     size: 'wide',   accentColor: '#E74856', col: 0, row: 2, group: 'group-default' },
                    { id: 'dt4', appId: 'org.gnome.Calculator.desktop',  appName: 'Calculator',  size: 'small',  accentColor: '#498205', col: 4, row: 0, group: 'group-default' },
                    { id: 'dt5', appId: 'org.gnome.gedit.desktop',       appName: 'Text Editor', size: 'small',  accentColor: '#038387', col: 5, row: 0, group: 'group-default' },
                ];
            }

            for (const t of oldTiles) {
                const sizeStr = t.size || 'medium';
                const span = SIZE_UNITS[sizeStr] || SIZE_UNITS.medium;
                this.tiles.push({
                    id: t.id,
                    appId: t.appId,
                    appName: t.appName,
                    accentColor: t.accentColor || ACCENT_COLORS[0],
                    size: sizeStr,
                    group: t.group || 'group-default',
                    x: (t.col !== undefined) ? t.col : 0,
                    y: (t.row !== undefined) ? t.row : 0,
                    w: span.cols,
                    h: span.rows
                });
            }
            this.save();
        }
    }

    save() {
        this.utils.saveJSON('tiles.json', {
            groups: this.groups,
            tiles: this.tiles
        });
    }

    getTilesForGroup(groupId) {
        let list = this.tiles.filter(t => t.group === groupId);
        let expansions = [];
        for (let t of list) {
            if (t.type === 'folder' && t.expanded) {
                expansions.push({
                    id: t.id + '-expansion',
                    type: 'folder-expansion',
                    folderId: t.id,
                    group: groupId,
                    x: 0,
                    y: t.y + t.h,
                    w: 6,
                    h: t.expansionHeight || 2,
                    accentColor: t.accentColor || '#0078D4'
                });
            }
        }
        return [...list, ...expansions];
    }

    rectsOverlap(r1, r2) {
        return r1.x < r2.x + r2.w &&
               r1.x + r1.w > r2.x &&
               r1.y < r2.y + r2.h &&
               r1.y + r1.h > r2.y;
    }

    // ------------------------------------------------------------------
    // Occupancy
    //
    // Occupancy is never cached. It is rebuilt from the authoritative tile
    // list on every query, so a stale map cannot outlive a failed move.
    // ------------------------------------------------------------------

    buildOccupancy(tiles, excludeIds) {
        const skip = excludeIds instanceof Set ? excludeIds : new Set(excludeIds || []);
        const occupied = new Map();
        for (const t of tiles) {
            if (skip.has(t.id)) continue;
            for (let dx = 0; dx < t.w; dx++) {
                for (let dy = 0; dy < t.h; dy++) {
                    occupied.set(`${t.x + dx},${t.y + dy}`, t.id);
                }
            }
        }
        return occupied;
    }

    isAreaFree(occupancy, x, y, w, h) {
        if (x < 0 || y < 0 || x + w > GRID_COLS) return false;
        for (let dx = 0; dx < w; dx++) {
            for (let dy = 0; dy < h; dy++) {
                if (occupancy.has(`${x + dx},${y + dy}`)) return false;
            }
        }
        return true;
    }

    // Validates a set of tiles that share one grid (one group).
    isValidLayout(tiles) {
        const seen = new Set();
        for (const t of tiles) {
            if (!t || t.id === undefined) return false;
            const { x, y, w, h } = t;
            if (!Number.isInteger(x) || !Number.isInteger(y) ||
                !Number.isInteger(w) || !Number.isInteger(h) ||
                w < 1 || h < 1 || x < 0 || y < 0 || x + w > GRID_COLS) {
                return false;
            }
            for (let dx = 0; dx < w; dx++) {
                for (let dy = 0; dy < h; dy++) {
                    const key = `${x + dx},${y + dy}`;
                    if (seen.has(key)) return false;
                    seen.add(key);
                }
            }
        }
        return true;
    }

    isValidGroupLayout(groupId, layout) {
        return this.isValidLayout(layout.filter(t => t.group === groupId));
    }

    // ------------------------------------------------------------------
    // Relocation
    //
    // Atomic: builds a complete candidate layout on clones and returns it only
    // when the result is internally consistent. The caller keeps the original
    // layout (and therefore rollback) until it commits the candidate.
    //
    // Reflow rule, in priority order:
    //   1. the dragged tile keeps the requested cell;
    //   2. tiles that do not overlap that footprint never move;
    //   3. the tiles that do overlap are placed at the nearest free position
    //      (complete footprint), so an empty cell above or beside is used
    //      before anything is pushed downwards;
    //   4. among equal positions, downward moves, moves that grow the group's
    //      bottom edge, and reading-order inversions are penalised;
    //   5. finally, tiles are pulled upwards only into cells this operation
    //      vacated, closing the gap it created without repacking the group.
    // ------------------------------------------------------------------

    readingOrderSort(a, b) {
        return (a.y - b.y) || (a.x - b.x) || String(a.id).localeCompare(String(b.id));
    }

    footprintKeys(x, y, w, h) {
        const keys = [];
        for (let dx = 0; dx < w; dx++) {
            for (let dy = 0; dy < h; dy++) {
                keys.push(`${x + dx},${y + dy}`);
            }
        }
        return keys;
    }

    // Nearest placement for one displaced tile. The scan always reaches the
    // empty rows below the group, so a candidate is guaranteed to exist.
    findNearestFreeSpot(occupancy, tile, bottomLimit, searchLimit, settled) {
        const ox = tile.x;
        const oy = tile.y;
        let best = null;

        for (let y = 0; y <= searchLimit; y++) {
            for (let x = 0; x <= GRID_COLS - tile.w; x++) {
                if (!this.isAreaFree(occupancy, x, y, tile.w, tile.h)) continue;

                const dx = Math.abs(x - ox);
                const dy = Math.abs(y - oy);
                const down = y > oy ? y - oy : 0;
                const grows = y + tile.h > bottomLimit ? 1 : 0;

                let inversions = 0;
                const index = y * GRID_COLS + x;
                for (const s of settled) {
                    if (s.y * GRID_COLS + s.x > index) inversions++;
                }

                const score = 4 * dx + 4 * dy + 4 * down + 8 * grows + inversions;
                if (best === null || score < best.score ||
                    (score === best.score && (dx < best.dx ||
                        (dx === best.dx && (y < best.y || (y === best.y && x < best.x)))))) {
                    best = { x, y, score, dx };
                }
            }
        }
        return best;
    }

    // Vertical pull-up for one group. A tile may only slide into cells listed
    // in `freed`, which callers seed from the operation's pre-move footprint,
    // so a hole that existed before the move never attracts unrelated tiles.
    compactVertical(tiles, draggedId, wasOccupied, freed, occupancy) {
        const canPlace = (id, x, y, w, h) => {
            if (x < 0 || y < 0 || x + w > GRID_COLS) return false;
            for (const key of this.footprintKeys(x, y, w, h)) {
                const owner = occupancy.get(key);
                if (owner !== undefined && owner !== id) return false;
            }
            return true;
        };
        const moveTo = (t, x, y) => {
            for (const key of this.footprintKeys(t.x, t.y, t.w, t.h)) {
                if (occupancy.get(key) === t.id) occupancy.delete(key);
                if (wasOccupied.has(key)) freed.add(key);
            }
            t.x = x;
            t.y = y;
            for (const key of this.footprintKeys(t.x, t.y, t.w, t.h)) {
                occupancy.set(key, t.id);
                freed.delete(key);
            }
        };

        let steps = 0;
        const stepLimit = tiles.length * 8 + 8;
        let moved = true;
        while (moved && steps < stepLimit) {
            moved = false;
            const ordered = tiles.slice().sort((a, b) => this.readingOrderSort(a, b));
            for (const t of ordered) {
                if (t.id === draggedId) continue;
                while (t.y > 0 &&
                       freed.has(`${t.x},${t.y - 1}`) &&
                       canPlace(t.id, t.x, t.y - 1, t.w, t.h)) {
                    moveTo(t, t.x, t.y - 1);
                    moved = true;
                    steps++;
                }
            }
        }
    }

    resolveRelocation(groupId, draggedTile, targetX, targetY) {
        if (!draggedTile || draggedTile.id === undefined) return null;

        const w = draggedTile.w;
        const h = draggedTile.h;
        if (!Number.isInteger(w) || !Number.isInteger(h) || w < 1 || h < 1 || w > GRID_COLS) {
            return null;
        }
        if (!Number.isInteger(targetX) || !Number.isInteger(targetY)) return null;
        if (targetX < 0 || targetY < 0 || targetX + w > GRID_COLS) return null;

        const target = { ...draggedTile, group: groupId, x: targetX, y: targetY, w, h };
        const draggedInGroup = draggedTile.group === groupId;

        const groupTiles = [];
        for (const t of this.tiles) {
            if (t.id === draggedTile.id) continue;
            if (t.group === groupId) groupTiles.push({ ...t });
        }

        const originals = new Map(groupTiles.map(t => [t.id, { x: t.x, y: t.y, w: t.w, h: t.h }]));
        if (draggedInGroup) {
            originals.set(draggedTile.id, {
                x: draggedTile.x, y: draggedTile.y, w: draggedTile.w, h: draggedTile.h,
            });
        }

        const originalBottom = groupTiles.reduce(
            (m, t) => Math.max(m, t.y + t.h),
            draggedInGroup ? draggedTile.y + draggedTile.h : 0);
        const bottomLimit = Math.max(originalBottom, targetY + h);

        const conflicts = groupTiles.filter(t => this.rectsOverlap(t, target))
            .sort((a, b) => this.readingOrderSort(a, b));
        const conflictIds = new Set(conflicts.map(t => t.id));

        const occupancy = new Map();
        const occupy = (t) => {
            for (const key of this.footprintKeys(t.x, t.y, t.w, t.h)) {
                occupancy.set(key, t.id);
            }
        };
        for (const t of groupTiles) {
            if (!conflictIds.has(t.id)) occupy(t);
        }
        occupy(target);

        const settled = [];
        // Each displaced tile can add at most four rows below the old bottom,
        // so this bound always contains a free position for every one of them.
        const searchLimit = bottomLimit + conflicts.length * 4;
        for (const t of conflicts) {
            const spot = this.findNearestFreeSpot(occupancy, t, bottomLimit, searchLimit, settled);
            if (!spot) return null;
            t.x = spot.x;
            t.y = spot.y;
            occupy(t);
            settled.push(t);
        }

        // Cells that were in use before this relocation. Compaction may only
        // fill these, so an empty area that already existed (or that a displaced
        // tile merely landed in) can never pull more tiles around.
        const wasOccupied = new Set();
        for (const [, o] of originals) {
            for (const key of this.footprintKeys(o.x, o.y, o.w, o.h)) wasOccupied.add(key);
        }
        const freed = new Set();
        for (const key of wasOccupied) {
            if (!occupancy.has(key)) freed.add(key);
        }

        const placed = new Map();
        for (const t of groupTiles) placed.set(t.id, t);

        // Preserve the engine's array order (z-order). The dragged tile keeps
        // its slot; new tiles from the app list or a folder are appended.
        const layout = [];
        let placedTarget = false;
        for (const t of this.tiles) {
            if (t.id === draggedTile.id) {
                layout.push(target);
                placedTarget = true;
            } else if (t.group === groupId) {
                const resolved = placed.get(t.id);
                if (resolved) layout.push(resolved);
            } else {
                layout.push({ ...t });
            }
        }
        if (!placedTarget) layout.push(target);

        const targetTiles = layout.filter(t => t.group === groupId);
        this.compactVertical(targetTiles, draggedTile.id, wasOccupied, freed, occupancy);
        if (!this.isValidGroupLayout(groupId, layout)) return null;

        if (!draggedInGroup) {
            // A cross-group move vacates the dragged tile's old footprint in
            // its source group; close that gap without repacking anything else.
            const sourceGroup = draggedTile.group;
            const sourceTiles = layout.filter(t => t.group === sourceGroup);
            const draggedFootprint = this.footprintKeys(draggedTile.x, draggedTile.y, draggedTile.w, draggedTile.h);
            const sourceWasOccupied = new Set(draggedFootprint);
            for (const t of sourceTiles) {
                for (const key of this.footprintKeys(t.x, t.y, t.w, t.h)) sourceWasOccupied.add(key);
            }
            const sourceFreed = new Set(draggedFootprint);
            const sourceOccupancy = this.buildOccupancy(sourceTiles);
            this.compactVertical(sourceTiles, null, sourceWasOccupied, sourceFreed, sourceOccupancy);
            if (!this.isValidGroupLayout(sourceGroup, layout)) return null;
        }

        return layout;
    }

    validateAndResize(tileId, newSizeName) {
        const tile = this.tiles.find(t => t.id === tileId);
        if (!tile) return false;

        const span = SIZE_UNITS[newSizeName];
        if (!span) return false;

        const targetX = Math.max(0, Math.min(tile.x, GRID_COLS - span.cols));
        const targetY = tile.y;

        const candidate = this.resolveRelocation(tile.group, {
            ...tile,
            size: newSizeName,
            w: span.cols,
            h: span.rows,
        }, targetX, targetY);

        if (!candidate) return false;

        this.tiles = candidate;
        this.save();
        return true;
    }

    pinApp(app, groupId) {
        // Find a free spot of size 2x2
        let pos = this.findFreeCell(groupId, 2, 2);
        if (!pos) return;

        let td = {
            id: 'tile-' + Date.now(),
            appId: app.id,
            appName: app.name,
            accentColor: ACCENT_COLORS[Math.floor(Math.random() * ACCENT_COLORS.length)],
            size: 'medium',
            group: groupId,
            x: pos.col,
            y: pos.row,
            w: 2,
            h: 2
        };
        this.tiles.push(td);
        this.save();
    }

    pinWidget(widgetKind, groupId) {
        const META = {
            weather:  { size: 'wide',  backgroundColor: 'transparent' },
            weather2: { size: 'wide',  backgroundColor: 'transparent' },
            finance:  { size: 'wide',  backgroundColor: '#121212' },
            forex:    { size: 'wide',  backgroundColor: '#121212' },
            calendar:   { size: 'large', backgroundColor: '#2D2D30' },  // Dark Grey
            todo:       { size: 'large', backgroundColor: '#6B2D8B' },  // Purple
            tasks:      { size: 'large', backgroundColor: '#6B2D8B' },  // Purple
            screentime: { size: 'wide',  backgroundColor: '#2D2D30' },  // Dark Grey
            quote:      { size: 'wide',  backgroundColor: '#512BD4' },  // Purple
        };
        const meta = META[widgetKind];
        if (!meta) return null;

        const span = SIZE_UNITS[meta.size];
        const pos  = this.findFreeCell(groupId, span.cols, span.rows);
        if (!pos) return null;

        const td = {
            id:          'widget-' + Date.now(),
            type:        'widget',
            widgetKind,
            size:        meta.size,
            group:       groupId,
            x: pos.col,  y: pos.row,
            w: span.cols, h: span.rows,
            accentColor: meta.backgroundColor,   // used by TileItem._applyStyle()
            config: {
                backgroundColor: meta.backgroundColor,
            }
        };
        this.tiles.push(td);
        this.save();
        return td.id;
    }

    unpinTile(tileId) {
        this.tiles = this.tiles.filter(t => t.id !== tileId);
        this.save();
    }

    // ---- Installed-app reconciliation --------------------------------------

    findAppTile(appId) {
        if (!appId) return null;
        for (const t of this.tiles) {
            if (t.type === 'folder') {
                if (Array.isArray(t.tiles) && t.tiles.some(a => a.appId === appId)) return t;
            } else if (!t.type && t.appId === appId) {
                return t;
            }
        }
        return null;
    }

    hasAppTile(appId) {
        return this.findAppTile(appId) !== null;
    }

    removeAppTiles(appId) {
        if (!appId) return false;
        let changed = false;

        this.tiles = this.tiles.filter(t => {
            if (t.type || t.appId !== appId) return true;
            changed = true;
            return false;
        });

        for (const folder of this.tiles) {
            if (folder.type !== 'folder' || !Array.isArray(folder.tiles)) continue;
            const kept = folder.tiles.filter(a => a.appId !== appId);
            if (kept.length !== folder.tiles.length) {
                folder.tiles = kept;
                changed = true;
                this._resizeExpansion(folder);
            }
        }

        if (changed) this.save();
        return changed;
    }

    // Drop app tiles (and folder entries) whose desktop entry no longer resolves.
    // Widgets and folders themselves are never removed.
    pruneApps(isValidAppId) {
        let changed = false;

        this.tiles = this.tiles.filter(t => {
            if (t.type) return true;
            if (typeof t.appId === 'string' && t.appId && !isValidAppId(t.appId)) {
                changed = true;
                return false;
            }
            return true;
        });

        for (const folder of this.tiles) {
            if (folder.type !== 'folder' || !Array.isArray(folder.tiles)) continue;
            const kept = folder.tiles.filter(a =>
                typeof a.appId === 'string' && a.appId ? isValidAppId(a.appId) : true);
            if (kept.length !== folder.tiles.length) {
                folder.tiles = kept;
                changed = true;
                this._resizeExpansion(folder);
            }
        }

        if (changed) this.save();
        return changed;
    }

    _resizeExpansion(folder) {
        if (!folder.expanded) return;
        const count = folder.tiles ? folder.tiles.length : 0;
        if (count === 0) {
            this.collapseFolder(folder.id);
            return;
        }
        const oldK = folder.expansionHeight || 2;
        const newK = Math.max(2, Math.ceil(count / GRID_COLS));
        if (newK === oldK) return;
        for (const t of this.tiles) {
            if (t.group === folder.group && t.id !== folder.id && t.y >= folder.y + folder.h) {
                t.y += newK - oldK;
            }
        }
        folder.expansionHeight = newK;
    }

    deleteGroupAndMoveTiles(groupId) {
        let targetGroup = this.groups.find(g => g.id === groupId);
        if (!targetGroup) return;

        let otherGroups = this.groups.filter(g => g.id !== groupId);
        let destinationGroupId;

        if (otherGroups.length > 0) {
            let idx = this.groups.findIndex(g => g.id === groupId);
            let prevGroup = this.groups[idx - 1] || otherGroups[0];
            destinationGroupId = prevGroup.id;
        } else {
            destinationGroupId = 'group-default';
            otherGroups.push({ id: destinationGroupId, name: 'Start' });
        }

        // Move all tiles of deleted group to destination group
        for (let t of this.tiles) {
            if (t.group === groupId) {
                t.group = destinationGroupId;
                let pos = this.findFreeCell(destinationGroupId, t.w, t.h);
                if (pos) {
                    t.x = pos.col;
                    t.y = pos.row;
                }
            }
        }

        this.groups = otherGroups;
        this.save();
    }

    createFolder(groupId) {
        let pos = this.findFreeCell(groupId, 2, 2);
        if (!pos) return false;

        let folder = {
            id: 'folder-' + Date.now(),
            type: 'folder',
            name: 'New Folder',
            size: 'medium',
            group: groupId,
            x: pos.col,
            y: pos.row,
            w: 2,
            h: 2,
            accentColor: '#0078D4',
            tiles: []
        };
        this.tiles.push(folder);
        this.save();
        return folder.id;
    }

    deleteFolder(folderId) {
        let folder = this.tiles.find(t => t.id === folderId);
        if (!folder) return;

        const groupId = folder.group;
        if (folder.tiles) {
            for (let app of folder.tiles) {
                let pos = this.findFreeCell(groupId, 2, 2);
                if (pos) {
                    this.tiles.push({
                        id: app.id,
                        appId: app.appId,
                        appName: app.appName,
                        accentColor: folder.accentColor || '#0078D4',
                        size: 'medium',
                        group: groupId,
                        x: pos.col,
                        y: pos.row,
                        w: 2,
                        h: 2
                    });
                }
            }
        }
        this.tiles = this.tiles.filter(t => t.id !== folderId);
        this.save();
    }

    expandFolder(folderId) {
        let folder = this.tiles.find(t => t.id === folderId);
        if (!folder || folder.expanded) return;

        folder.expanded = true;
        let N = folder.tiles ? folder.tiles.length : 0;
        let K = Math.max(2, Math.ceil(N / 6));
        folder.expansionHeight = K;

        for (let t of this.tiles) {
            if (t.group === folder.group && t.id !== folderId && t.y >= folder.y + folder.h) {
                t.y += K;
            }
        }
        this.save();
    }

    collapseFolder(folderId) {
        let folder = this.tiles.find(t => t.id === folderId);
        if (!folder || !folder.expanded) return;

        folder.expanded = false;
        let K = folder.expansionHeight || 2;

        for (let t of this.tiles) {
            if (t.group === folder.group && t.id !== folderId && t.y >= folder.y + folder.h) {
                t.y = Math.max(folder.y + folder.h, t.y - K);
            }
        }
        this.save();
    }

    collapseAllFolders() {
        for (let t of this.tiles) {
            if (t.type === 'folder' && t.expanded) {
                this.collapseFolder(t.id);
            }
        }
    }

    addAppToFolder(folderId, appTileData) {
        let folder = this.tiles.find(t => t.id === folderId);
        if (folder) {
            folder.tiles = folder.tiles || [];
            if (!folder.tiles.some(t => t.appId === appTileData.appId)) {
                folder.tiles.push({
                    id: appTileData.id,
                    appId: appTileData.appId,
                    appName: appTileData.appName
                });
            }
            this.tiles = this.tiles.filter(t => t.id !== appTileData.id);
            this.save();
        }
    }

    removeAppFromFolder(folderId, appTileId) {
        let folder = this.tiles.find(t => t.id === folderId);
        if (folder && folder.tiles) {
            folder.tiles = folder.tiles.filter(t => t.id !== appTileId);
            this.save();
        }
    }

    findFreeCell(groupId, w, h) {
        if (!Number.isInteger(w) || !Number.isInteger(h) ||
            w < 1 || h < 1 || w > GRID_COLS) {
            return null;
        }

        const groupTiles = this.getTilesForGroup(groupId);
        const occupancy = this.buildOccupancy(groupTiles);
        const lastRow = groupTiles.reduce((m, t) => Math.max(m, t.y + t.h), 0);

        // lastRow is free by definition, so this always terminates.
        for (let r = 0; r <= lastRow; r++) {
            for (let c = 0; c <= GRID_COLS - w; c++) {
                if (this.isAreaFree(occupancy, c, r, w, h)) {
                    return { col: c, row: r };
                }
            }
        }
        return null;
    }
}

module.exports = { TileLayoutEngine, SIZE_UNITS, GRID_COLS };
