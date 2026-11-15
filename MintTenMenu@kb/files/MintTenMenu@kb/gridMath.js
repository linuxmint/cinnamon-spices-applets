// gridMath.js — single source of truth for the tile grid
'use strict';

// Pixels are physical (Clutter set_size/transformed positions). Cell counts are
// logical. Everything that maps between the two goes through this module.
const GRID_COLS = 6;
const GRID_UNIT = 70;
const GRID_GAP  = 6;
const CELL      = GRID_UNIT + GRID_GAP;   // stride between cell origins

const SIZE_UNITS = {
    small:  { cols: 1, rows: 1 },
    medium: { cols: 2, rows: 2 },
    wide:   { cols: 4, rows: 2 },
    large:  { cols: 4, rows: 4 },
};

const tilePxCache = {};
function tilePx(units) {
    if (tilePxCache[units] === undefined) {
        tilePxCache[units] = units * GRID_UNIT + (units - 1) * GRID_GAP;
    }
    return tilePxCache[units];
}

function gridToPixel(cell) {
    return cell * CELL;
}

// Nearest grid line for a physical pixel offset. Used for snapping a tile's
// visual top-left corner, never a pointer coordinate.
function pixelToCell(px) {
    return Math.round(px / CELL) || 0;   // normalise -0
}

function clampCell(col, span) {
    return Math.max(0, Math.min(col, GRID_COLS - span));
}

// Target cell for a tile whose visual top-left is (x, y) in grid-canvas pixels.
function snapTileRect(x, y, spanCols, spanRows) {
    return {
        col: clampCell(pixelToCell(x), spanCols),
        row: Math.max(0, pixelToCell(y)),
        w: spanCols,
        h: spanRows,
    };
}

module.exports = {
    GRID_COLS, GRID_UNIT, GRID_GAP, CELL,
    SIZE_UNITS, tilePx, gridToPixel, pixelToCell, clampCell, snapTileRect,
};
