/* global imports, global */
/**
 * workspaceActions.js
 *
 * All workspace mutation logic for the Workspace Grid desklet and the
 * Workspace Name applet. Deliberately contains no St/Clutter widgets so the
 * pure parts can be exercised by a headless test harness (libst.so cannot
 * be loaded outside the Cinnamon process).
 *
 * Cinnamon already implements the hard parts; this module is a defensive
 * wrapper around them:
 *   Main.getWorkspaceName(i)        -> falls back to "Workspace N"
 *   Main.setWorkspaceName(i, name)  -> pads/trims and writes workspace-names
 *   Main.hasDefaultWorkspaceName(i) -> used to decide the remove confirmation
 *   Main._addWorkspace()            -> append_new_workspace()
 *   Main._removeWorkspace(ws)       -> refuses at n_workspaces == 1, splices
 *                                      the name out, then removes
 * See /usr/share/cinnamon/js/ui/main.js.
 *
 * Every exported action swallows exceptions and returns false rather than
 * letting an error escape into a GObject signal handler, where it would take
 * down the calling xlet.
 *
 * This file is duplicated verbatim in both xlet directories: Cinnamon gives
 * xlets no way to import across xlet boundaries. Keep the copies in sync.
 */

const Gio = imports.gi.Gio;

const LOG_PREFIX = "[workspaceActions] ";

/* Gettext support. The parent xlet injects its own UUID-bound _() translator
 * via setTranslate(); the default is the identity function so this module is
 * safe to load on its own and in the headless test harness. */
let _translate = function (str) { return str; };

function setTranslate(fn) {
    if (typeof fn === "function")
        _translate = fn;
}

/* Call sites use _() so cinnamon-xlet-makepot's default keyword extracts
 * them; _() always routes through the injected translator. */
function _(str) {
    return _translate(str);
}

/* org.cinnamon.desktop.wm.preferences num-workspaces has range 1..36. */
var MIN_WORKSPACES = 1;
var MAX_WORKSPACES = 36;

var WM_PREFS_SCHEMA = "org.cinnamon.desktop.wm.preferences";
var WORKSPACE_NAMES_KEY = "workspace-names";

/* Lazily resolved so the headless test harness can inject stubs before any
 * imports.ui.* / global lookup happens. */
let _deps = null;

function _d() {
    if (!_deps) {
        _deps = {
            Main: imports.ui.main,
            ModalDialog: imports.ui.modalDialog,
            getWorkspaceManager: function () {
                return global.workspace_manager;
            },
            getCurrentTime: function () {
                return global.get_current_time();
            }
        };
    }
    return _deps;
}

/**
 * setDependencies:
 * @deps (object): { Main, ModalDialog, getWorkspaceManager, getCurrentTime }
 *
 * Test seam. Production code never calls this.
 */
function setDependencies(deps) {
    _deps = deps;
}

/**
 * resetDependencies:
 *
 * Test seam; restores lazy production lookup.
 */
function resetDependencies() {
    _deps = null;
}

function logError(message, e) {
    let text = LOG_PREFIX + message + (e ? ": " + e : "");
    try {
        if (typeof global !== "undefined" && global.logError) {
            global.logError(text);
            return;
        }
    } catch (ignored) {
        /* fall through to print */
    }
    if (typeof print === "function")
        print(text);
}

/* ------------------------------------------------------------------ *
 * Queries
 * ------------------------------------------------------------------ */

/**
 * getWorkspaceCount:
 *
 * Returns (int): number of workspaces, or 0 if the manager is unavailable.
 */
function getWorkspaceCount() {
    try {
        let wm = _d().getWorkspaceManager();
        if (!wm)
            return 0;
        let n = wm.n_workspaces;
        return (typeof n === "number" && n >= 0) ? n : 0;
    } catch (e) {
        logError("getWorkspaceCount failed", e);
        return 0;
    }
}

/**
 * getActiveWorkspaceIndex:
 *
 * Returns (int): 0-based active workspace index, or 0 on failure.
 */
function getActiveWorkspaceIndex() {
    try {
        let wm = _d().getWorkspaceManager();
        if (!wm)
            return 0;
        let index = wm.get_active_workspace_index();
        return (typeof index === "number" && index >= 0) ? index : 0;
    } catch (e) {
        logError("getActiveWorkspaceIndex failed", e);
        return 0;
    }
}

/**
 * getWorkspaceName:
 * @index (int): 0-based workspace index
 *
 * Returns (string): the workspace name, or "" if it cannot be resolved.
 */
function getWorkspaceName(index) {
    try {
        return _d().Main.getWorkspaceName(index);
    } catch (e) {
        logError("getWorkspaceName(" + index + ") failed", e);
        return "";
    }
}

/**
 * isValidIndex:
 * @index (int): candidate index
 *
 * Returns (boolean): whether @index addresses an existing workspace.
 */
function isValidIndex(index) {
    return Number.isInteger(index) && index >= 0 && index < getWorkspaceCount();
}

/**
 * canAdd:
 *
 * Returns (boolean): whether another workspace may be created.
 */
function canAdd() {
    let n = getWorkspaceCount();
    return n > 0 && n < MAX_WORKSPACES;
}

/**
 * canRemove:
 *
 * Returns (boolean): whether any workspace may be removed. Cinnamon refuses
 * to remove the last remaining workspace.
 */
function canRemove() {
    return getWorkspaceCount() > MIN_WORKSPACES;
}

/* ------------------------------------------------------------------ *
 * Mutations
 * ------------------------------------------------------------------ */

/**
 * addWorkspace:
 *
 * Appends a workspace. Returns (boolean): whether one was created.
 */
function addWorkspace() {
    try {
        if (!canAdd())
            return false;
        _d().Main._addWorkspace();
        return true;
    } catch (e) {
        logError("addWorkspace failed", e);
        return false;
    }
}

/**
 * renameWorkspace:
 * @index (int): 0-based workspace index
 * @name (string): new name; an empty string resets to the default
 *                 "Workspace N" label
 *
 * Returns (boolean): whether the rename was applied.
 */
function renameWorkspace(index, name) {
    try {
        if (!isValidIndex(index))
            return false;
        if (typeof name !== "string")
            return false;

        let trimmed = name.trim();
        if (trimmed === getWorkspaceName(index))
            return false;

        _d().Main.setWorkspaceName(index, trimmed);
        return true;
    } catch (e) {
        logError("renameWorkspace(" + index + ") failed", e);
        return false;
    }
}

/**
 * removeWorkspaceByIndex:
 * @index (int): 0-based workspace index
 * @params (object): optional { confirm: bool, onRemoved: function }
 *
 * Resolves the Meta.Workspace from @index at call time - never hold one across
 * an idle or timeout, it may already be gone. When @confirm is set and the
 * workspace has a user-assigned name, a ConfirmDialog is shown first and this
 * returns true to mean "prompt shown", mirroring expoThumbnail.js remove().
 *
 * Returns (boolean): whether the removal ran or a prompt was raised.
 */
function removeWorkspaceByIndex(index, params) {
    params = params || {};
    try {
        if (!isValidIndex(index))
            return false;
        if (!canRemove())
            return false;

        let d = _d();
        let wm = d.getWorkspaceManager();
        let workspace = wm ? wm.get_workspace_by_index(index) : null;
        if (!workspace)
            return false;

        let doRemove = function () {
            try {
                /* Re-check: the world may have changed while the dialog was up. */
                if (!canRemove())
                    return;
                let current = d.getWorkspaceManager();
                let target = current ? current.get_workspace_by_index(index) : null;
                if (!target)
                    return;
                d.Main._removeWorkspace(target);
                if (params.onRemoved)
                    params.onRemoved();
            } catch (e) {
                logError("removeWorkspaceByIndex deferred remove failed", e);
            }
        };

        if (params.confirm && !d.Main.hasDefaultWorkspaceName(index)) {
            let prompt = _('Are you sure you want to remove workspace "%s"?')
                .format(getWorkspaceName(index));
            let dialog = new d.ModalDialog.ConfirmDialog(prompt, doRemove);
            dialog.open();
            return true;
        }

        doRemove();
        return true;
    } catch (e) {
        logError("removeWorkspaceByIndex(" + index + ") failed", e);
        return false;
    }
}

/**
 * activateWorkspaceByIndex:
 * @index (int): 0-based workspace index
 *
 * Returns (boolean): whether the switch was requested.
 */
function activateWorkspaceByIndex(index) {
    try {
        if (!isValidIndex(index))
            return false;
        let d = _d();
        let wm = d.getWorkspaceManager();
        let workspace = wm ? wm.get_workspace_by_index(index) : null;
        if (!workspace)
            return false;
        workspace.activate(d.getCurrentTime());
        return true;
    } catch (e) {
        logError("activateWorkspaceByIndex(" + index + ") failed", e);
        return false;
    }
}

/* ------------------------------------------------------------------ *
 * Workspace-name change notifications
 *
 * The old code watched org.cinnamon "workspace-name-overrides" (value is
 * literally ['DEPRECATED'] and never changes) and a key that does not exist at
 * all. Names actually live in org.cinnamon.desktop.wm.preferences.
 * ------------------------------------------------------------------ */

let _nameSettings = null;

function _getNameSettings() {
    if (!_nameSettings)
        _nameSettings = new Gio.Settings({ schema_id: WM_PREFS_SCHEMA });
    return _nameSettings;
}

/**
 * connectNameChanges:
 * @callback (function): invoked when any workspace name changes
 *
 * Returns (int): a handler id for disconnectNameChanges(), or 0 on failure.
 */
function connectNameChanges(callback) {
    try {
        return _getNameSettings().connect("changed::" + WORKSPACE_NAMES_KEY, callback);
    } catch (e) {
        logError("connectNameChanges failed", e);
        return 0;
    }
}

/**
 * disconnectNameChanges:
 * @id (int): handler id returned by connectNameChanges()
 */
function disconnectNameChanges(id) {
    try {
        if (id && _nameSettings)
            _nameSettings.disconnect(id);
    } catch (e) {
        logError("disconnectNameChanges failed", e);
    }
}

/* ------------------------------------------------------------------ *
 * Pure layout helpers (no Cinnamon dependencies - fully unit tested)
 * ------------------------------------------------------------------ */

function _toPositiveInt(value, fallback) {
    let n = parseInt(value, 10);
    if (!Number.isFinite(n) || n < 1)
        return fallback;
    return n;
}

/**
 * computeGridDims:
 * @cellCount (int): total cells to lay out, including the "+" tile
 * @mode (string): "fixed" or anything else for auto
 * @fixedRows (int): rows to use in fixed mode
 * @fixedCols (int): columns to use in fixed mode
 *
 * Returns (object): { rows, cols }. Auto mode produces a near-square grid.
 * Fixed mode keeps the requested column count and grows the row count when
 * needed. No workspace may disappear because a fixed grid is too small.
 */
function computeGridDims(cellCount, mode, fixedRows, fixedCols) {
    let n = _toPositiveInt(cellCount, 1);

    if (mode === "fixed") {
        let cols = _toPositiveInt(fixedCols, 1);
        return {
            rows: Math.max(_toPositiveInt(fixedRows, 1), Math.ceil(n / cols)),
            cols: cols
        };
    }

    let cols = Math.ceil(Math.sqrt(n));
    let rows = Math.ceil(n / cols);
    return { rows: rows, cols: cols };
}

/**
 * planCells:
 * @workspaceCount (int): number of workspaces to show
 * @showAddTile (boolean): whether to reserve a cell for the "+" tile
 * @rows (int): grid rows
 * @cols (int): grid columns
 *
 * Decides what goes in each grid cell, in row-major order. Dimension inputs
 * are accepted for API compatibility, but never limit returned cells.
 *
 * Returns (array): [{ kind: "workspace"|"add", index: int }, ...]
 */
function planCells(workspaceCount, showAddTile, rows, cols) {
    let wsCount = parseInt(workspaceCount, 10);
    if (!Number.isFinite(wsCount) || wsCount < 0)
        wsCount = 0;

    let cells = [];
    for (let i = 0; i < wsCount; i++)
        cells.push({ kind: "workspace", index: i });
    if (showAddTile)
        cells.push({ kind: "add", index: -1 });
    return cells;
}

/**
 * computeScrollTarget:
 * @active (int): active workspace index
 * @count (int): workspace count
 * @cols (int): effective grid column count
 * @mode (string): "col" moves one cell, "row" moves one visual row
 * @direction (int): -1 for up, 1 for down
 *
 * Returns (int): valid target index, or @active at a grid edge. Partial final
 * rows stay addressable by clamping to the final workspace in that column.
 */
function computeScrollTarget(active, count, cols, mode, direction) {
    let total = parseInt(count, 10);
    let current = parseInt(active, 10);
    let columnCount = _toPositiveInt(cols, 1);
    let delta = direction < 0 ? -1 : 1;

    if (!Number.isFinite(total) || total < 1 ||
        !Number.isFinite(current) || current < 0 || current >= total)
        return current;

    if (mode === "row") {
        let target = current + delta * columnCount;
        if (target < 0)
            return current;
        if (target >= total && delta > 0) {
            let lastRowStart = Math.floor((total - 1) / columnCount) * columnCount;
            if (current < lastRowStart)
                return total - 1;
            return current;
        }
        return target;
    }

    let target = current + delta;
    return target >= 0 && target < total ? target : current;
}
