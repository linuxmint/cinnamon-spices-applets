// Multi-Row Panel Launchers — Cinnamon applet
// Copyright (C) 2026 Steve Midgley
// Part of a fork of panel-launchers@cinnamon.org, Copyright (C) the Linux Mint team
//
// This program is free software; you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation; either version 2 of the License, or
// (at your option) any later version. See the LICENSE file for details.

/**
 * Pure computation helpers for multi-row panel launchers.
 * No Cinnamon/GJS dependencies — testable in Node.js.
 */

/**
 * Calculate icon size for launcher buttons given panel height and row count.
 * @param {number} panelHeight - Total panel height in pixels
 * @param {number} numberOfRows - Number of rows (1-4)
 * @param {number} overrideSize - User override (0 = auto-scale)
 * @returns {number} Icon size in pixels
 */
function calcLauncherIconSize(panelHeight, numberOfRows, overrideSize) {
    if (overrideSize > 0) return overrideSize;
    return Math.max(12, Math.floor(panelHeight / numberOfRows) - 4);
}

/**
 * Calculate how many rows are needed for the given launcher count.
 * @param {number} containerWidth - Available width in pixels
 * @param {number} launcherCount - Number of launcher icons
 * @param {number} cellSize - Width per cell in pixels (icon + padding)
 * @param {number} maxRows - Maximum allowed rows (1-4)
 * @returns {number} Number of rows (1 to maxRows)
 */
function calcNeededRows(containerWidth, launcherCount, cellSize, maxRows) {
    if (launcherCount <= 0 || containerWidth <= 0 || cellSize <= 0 || maxRows <= 0) {
        return 1;
    }
    let launchersPerRow = Math.max(1, Math.floor(containerWidth / cellSize));
    let needed = Math.ceil(launcherCount / launchersPerRow);
    return Math.max(1, Math.min(needed, maxRows));
}

/**
 * Calculate the number of columns for a container given item count and max rows.
 * Items fill left-to-right first; only wraps to a new row when needed.
 * When count <= maxRows, all items stay in one row (no unnecessary stacking).
 * @param {number} count - Number of items
 * @param {number} maxRows - Maximum allowed rows (1-4)
 * @returns {number} Number of columns (0 if no items or invalid)
 */
function calcContainerColumns(count, maxRows) {
    if (count <= 0 || maxRows <= 0) return 0;
    if (count <= maxRows) return count;
    return Math.ceil(count / maxRows);
}

/**
 * Calculate the number of rows the grid will actually use for a given
 * item count. With few items (count <= maxRows) everything stays in one
 * row, so sizing icons for maxRows would leave them needlessly small AND
 * desync the container-width math from FlowLayout's row-height-driven
 * allocation (rows taller than the icon inflate each cell's allocated
 * width past its preferred width, wrapping expectedCols-1 per row).
 * @param {number} count - Number of items (0 = unknown/not loaded yet)
 * @param {number} maxRows - Maximum allowed rows (1-4)
 * @returns {number} Rows the layout will actually produce (>= 1)
 */
function calcEffectiveRows(count, maxRows) {
    if (maxRows <= 0) return 1;
    if (count <= 0) return maxRows; // launchers not loaded yet — keep prior sizing
    let cols = calcContainerColumns(count, maxRows);
    return Math.max(1, Math.ceil(count / cols));
}

/**
 * Calculate the container width for a multi-row grid of items.
 * Uses exact cell-width math: cols * cellWidth + (cols - 1) * spacing.
 * @param {number} count - Number of items
 * @param {number} maxRows - Maximum allowed rows (1-4)
 * @param {number} cellWidth - Width per cell in pixels (icon + padding)
 * @param {number} spacing - Column spacing in pixels
 * @param {number} maxWidth - Maximum width cap (0 = no limit)
 * @returns {number} Container width in pixels (0 if no items or invalid)
 */
function calcContainerWidth(count, maxRows, cellWidth, spacing, maxWidth) {
    if (count <= 0 || maxRows <= 0 || cellWidth <= 0) return 0;
    let cols = calcContainerColumns(count, maxRows);
    let width = cols * cellWidth + Math.max(0, cols - 1) * spacing;
    if (maxWidth > 0 && width > maxWidth) width = maxWidth;
    return width;
}

/**
 * Calculate how many launchers fit in the panel before overflow.
 * Reserves one column for the chevron indicator when overflow is needed.
 * Returns totalCount when all fit or maxWidth <= 0 (no limit).
 * @param {number} totalCount - Total number of launchers
 * @param {number} maxRows - Maximum allowed rows (1-4)
 * @param {number} cellWidth - Width per cell in pixels (icon + padding)
 * @param {number} spacing - Column spacing in pixels
 * @param {number} maxWidth - Maximum container width (0 = no limit)
 * @returns {number} Number of visible launchers (0 to totalCount)
 */
function calcVisibleLauncherCount(totalCount, maxRows, cellWidth, spacing, maxWidth) {
    if (maxWidth <= 0 || totalCount <= 0) return totalCount;
    let naturalWidth = calcContainerWidth(totalCount, maxRows, cellWidth, spacing, 0);
    if (naturalWidth <= maxWidth) return totalCount; // all fit, no overflow
    let maxCols = Math.floor((maxWidth + spacing) / (cellWidth + spacing));
    let availCols = maxCols - 1; // reserve 1 column for chevron
    if (availCols <= 0) return 0; // only chevron fits (or nothing)
    return Math.min(availCols * maxRows, totalCount - 1); // at least 1 in overflow
}

/**
 * Calculate the drop index for a 2D grid given pointer coordinates.
 * @param {number} x - Pointer x relative to container
 * @param {number} y - Pointer y relative to container
 * @param {number} cellWidth - Width of each grid cell
 * @param {number} cellHeight - Height of each grid cell
 * @param {number} cols - Number of columns in the grid
 * @param {number} totalItems - Total number of items in the grid
 * @returns {number} Drop index clamped to [0, totalItems]
 */
function calcGridDropIndex(x, y, cellWidth, cellHeight, cols, totalItems) {
    if (cellWidth <= 0 || cellHeight <= 0 || cols <= 0) return 0;
    let col = Math.floor(x / cellWidth);
    let row = Math.floor(y / cellHeight);
    let index = row * cols + col;
    return Math.max(0, Math.min(index, totalItems));
}

// Per-row vertical padding the theme adds around each launcher icon (top+bottom).
// Used to reserve space when capping icon size to fit panel_height/numberOfRows.
const ROW_PADDING_ESTIMATE = 3;

/**
 * Pick an icon size using a fallback chain, capped to fit the panel vertically.
 * Order: user override → panel-height-derived (row-aware) → panel-zone icon size → constant.
 * The result is then clamped so `numberOfRows` rows at (icon + padding) actually fit
 * within `panelHeight`; otherwise the bottom row is clipped by the panel edge.
 *
 * Zone size is a safe default on cold start when panel.height is still 0 (pre-allocation).
 * @param {number} panelHeight - Panel height in pixels (0/undefined means unknown)
 * @param {number} zoneIconSize - Cinnamon panel zone icon size (Applet.getPanelIconSize)
 * @param {number} numberOfRows - Row count for the auto-scale branch
 * @param {number} overrideSize - User override (0 = no override)
 * @returns {number} Icon size in pixels (never 0)
 */
function calcIconSizeWithFallback(panelHeight, zoneIconSize, numberOfRows, overrideSize) {
    let desired;
    if (overrideSize > 0) desired = overrideSize;
    else if (panelHeight > 0) desired = calcLauncherIconSize(panelHeight, numberOfRows, 0);
    else if (zoneIconSize > 0) desired = zoneIconSize;
    else desired = 24;

    // Cap: never exceed what fits in the panel for the requested row count.
    // If the cap kicks in, the user's override is honored as "preferred ceiling"
    // but shrunk so rows actually render within the panel.
    if (panelHeight > 0 && numberOfRows > 0) {
        let maxForPanel = Math.max(8, Math.floor(panelHeight / numberOfRows) - ROW_PADDING_ESTIMATE);
        if (desired > maxForPanel) desired = maxForPanel;
    }
    return desired;
}

// Minimum cell-width padding estimate used when the launcher's themed
// width hasn't resolved yet. Keep this generous enough that the container
// is never sized smaller than the icon — otherwise FlowLayout allocates
// children at h=0 and _updateIconSize ratchets the icon down to 1px.
const CELL_WIDTH_PADDING_FALLBACK = 4;

/**
 * Pick a cell-width for container sizing, choosing the themed preferred width
 * when it's plausible and a conservative fallback otherwise. The fallback must
 * always be >= iconSize, otherwise the container collapses and triggers a
 * cascade that shrinks icons to 1px.
 *
 * @param {number} iconSize - Current applet icon size in pixels
 * @param {number} preferredWidth - Launcher actor's natural width (get_preferred_width(-1)[1])
 * @returns {number} Cell width in pixels (always > 0 when iconSize > 0)
 */
function pickCellWidth(iconSize, preferredWidth) {
    if (iconSize <= 0) return 0;
    if (preferredWidth >= iconSize) return preferredWidth;
    return iconSize + CELL_WIDTH_PADDING_FALLBACK;
}

// Export for Node.js testing; ignored in GJS runtime
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        calcLauncherIconSize, calcNeededRows, calcEffectiveRows, calcContainerColumns, calcContainerWidth, calcVisibleLauncherCount, calcGridDropIndex, calcIconSizeWithFallback, pickCellWidth
    };
}
