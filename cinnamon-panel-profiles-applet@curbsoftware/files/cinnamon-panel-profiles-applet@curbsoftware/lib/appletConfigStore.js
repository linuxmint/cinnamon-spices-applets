/* Panel Profiles applet-config capture, restore and watch.
 *
 * Owns everything under Cinnamon's per-applet config root
 * (~/.config/cinnamon/spices): captures the config JSON files referenced by
 * enabled-applets entries verbatim, restores them atomically under sanitized
 * relative paths, and watches the per-uuid directories for changes.
 *
 * Path sanitization is the security boundary. A profile is data, never code:
 * its relativePath values are untrusted input and every one is re-validated
 * before a single byte is written (spec 54). Violations skip and warn, they
 * never abort the batch and never throw.
 *
 * No St/Clutter imports and no require() calls: this module must stay
 * loadable headless via imports.searchPath so the dev-tools test harness can
 * use it directly.
 *
 * Public names are declared with var/function so both the require()
 * auto-export inside Cinnamon and the plain imports.<mod> loader see them.
 *
 * Copyright (C) 2026 curbsoftware
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;

/* ------------------------------------------------------------------ *
 * Sibling modules (constants, atomicFile)
 * ------------------------------------------------------------------ *
 * Resolved lazily through the plain importer instead of require() so this
 * file works in plain gjs. Whoever loads us, tests or the composition root
 * in applet.js, must put the lib directory on imports.searchPath first.
 * Lazy resolution means a load-order mistake degrades to logged failures
 * and failure return values, never a module-load crash. */
let _constants = null;
let _atomicFile = null;
let _siblingsResolved = false;

function _resolveSiblings() {
    if (_siblingsResolved)
        return;
    _siblingsResolved = true;
    try {
        _constants = imports.constants;
    } catch (ignored) {
        _constants = null;
    }
    try {
        _atomicFile = imports.atomicFile;
    } catch (ignored) {
        _atomicFile = null;
    }
}

/* ------------------------------------------------------------------ *
 * Dependency seam
 * ------------------------------------------------------------------ */

let _selfUuid = null;   /* function () -> string, defaults to constants */
let _logger = null;
let _configRoot = null; /* overrides constants.SPICES_CONFIG_ROOT */

/**
 * setDependencies:
 * @deps (object): { selfUuid, logger, configRoot }
 *
 * selfUuid: function returning this applet's uuid (self-exclusion). logger:
 * optional object with warn()/error(). configRoot: directory relativePaths
 * resolve against; tests inject a temp root so the real spices tree is never
 * touched. Unknown keys are ignored.
 */
function setDependencies(deps) {
    try {
        if (!deps)
            return;
        if (typeof deps.selfUuid === "function")
            _selfUuid = deps.selfUuid;
        if (deps.logger !== undefined)
            _logger = deps.logger || null;
        if (typeof deps.configRoot === "string" && deps.configRoot.length > 0)
            _configRoot = deps.configRoot;
    } catch (ignored) {
        /* seam must never throw */
    }
}

/**
 * resetDependencies:
 *
 * Restores defaults. Test teardown helper.
 */
function resetDependencies() {
    _selfUuid = null;
    _logger = null;
    _configRoot = null;
    _siblingsResolved = false;
}

function _warn(msg) {
    try {
        if (_logger && typeof _logger.warn === "function")
            _logger.warn(msg);
    } catch (ignored) {
        /* logging must never take the caller down */
    }
}

function _selfUuidValue() {
    try {
        if (typeof _selfUuid === "function")
            return String(_selfUuid());
    } catch (ignored) {
    }
    _resolveSiblings();
    if (_constants && typeof _constants.selfUuid === "function")
        return String(_constants.selfUuid());
    return "";
}

function _configRootPath() {
    if (typeof _configRoot === "string" && _configRoot.length > 0)
        return _configRoot;
    _resolveSiblings();
    return _constants ? _constants.SPICES_CONFIG_ROOT : "";
}

/* ------------------------------------------------------------------ *
 * Path sanitization
 * ------------------------------------------------------------------ *
 * Exactly two components under the config root: <uuid>/<name>.json. The
 * character class is deliberately tight (no separators, no whitespace, no
 * control characters) so a hostile profile cannot smuggle traversal or
 * encoding tricks past the regex; the explicit checks below catch what the
 * class alone would tolerate (a bare ".." component is dots, which are
 * otherwise legal in names). */
const REL_PATH_RE = /^[A-Za-z0-9-._+@]+\/[A-Za-z0-9-._+@]+\.json$/;
const COMPONENT_RE = /^[A-Za-z0-9-._+@]+$/;
const SHA256_RE = /^[0-9a-f]{64}$/;

/**
 * sanitizeRelativePath:
 * @rel (string): candidate relative path from (untrusted) profile data.
 *
 * Accepts exactly "<component>/<component>.json" with no absolute prefix,
 * no backslash, no newline, no empty component and no ".." component.
 *
 * Returns (string|null): the normalized path (unchanged when accepted) or
 * null on any violation.
 */
function sanitizeRelativePath(rel) {
    try {
        if (typeof rel !== "string" || rel.length === 0)
            return null;
        if (rel.charAt(0) === "/")
            return null;
        if (rel.indexOf("\\") !== -1 || rel.indexOf("\n") !== -1)
            return null;
        const parts = rel.split("/");
        if (parts.length !== 2)
            return null;
        if (parts[0].length === 0 || parts[1].length === 0)
            return null;
        if (parts[0] === ".." || parts[1] === "..")
            return null;
        if (!REL_PATH_RE.test(rel))
            return null;
        return rel;
    } catch (ignored) {
        return null;
    }
}

function _isSymlink(path) {
    try {
        return GLib.file_test(path, GLib.FileTest.IS_SYMLINK);
    } catch (ignored) {
        return true;
    }
}

function _ownedConfigPath(config) {
    try {
        if (!config || typeof config !== "object" ||
                typeof config.uuid !== "string" ||
                !COMPONENT_RE.test(config.uuid) || config.uuid === "..")
            return null;
        const rel = sanitizeRelativePath(config.relativePath);
        if (rel === null)
            return null;
        const parts = rel.split("/");
        if (parts[0] !== config.uuid)
            return null;
        const instanceId = config.instanceId === undefined ||
            config.instanceId === null ? "" : String(config.instanceId);
        if (instanceId.length > 0 &&
                (!COMPONENT_RE.test(instanceId) || instanceId === ".."))
            return null;
        const singleton = config.uuid + ".json";
        const instance = instanceId.length > 0 ? instanceId + ".json" : "";
        if (parts[1] !== singleton && parts[1] !== instance)
            return null;
        return rel;
    } catch (ignored) {
        return null;
    }
}

function _pathContained(root, rel) {
    try {
        if (!root || _isSymlink(root))
            return false;
        const parts = rel.split("/");
        const dir = GLib.build_filenamev([root, parts[0]]);
        const target = GLib.build_filenamev([dir, parts[1]]);
        return !_isSymlink(dir) && !_isSymlink(target);
    } catch (ignored) {
        return false;
    }
}

/* ------------------------------------------------------------------ *
 * Capture
 * ------------------------------------------------------------------ */

/**
 * captureConfigs:
 * @entries (array): parsed enabled-applets entries ({uuid, instanceId, ...}).
 *
 * For each unique (uuid, instanceId) this applet does not own, probes
 * <configRoot>/<uuid>/<instanceId>.json (multi-instance) then
 * <configRoot>/<uuid>/<uuid>.json (single-instance). Whichever file exists
 * is captured verbatim; relativePath records the ACTUAL filename found so
 * restore writes back to the same place. Applets with no file on disk are
 * simply absent from the result. Never throws.
 *
 * Returns (array): [{uuid, instanceId, relativePath, sha256, content}].
 */
function captureConfigs(entries) {
    const out = [];
    _resolveSiblings();
    if (!_atomicFile)
        return out;
    try {
        if (!Array.isArray(entries))
            return out;
        const root = _configRootPath();
        if (root.length === 0)
            return out;
        const self = _selfUuidValue();
        const seenKeys = {};
        const seenPaths = {};
        for (let i = 0; i < entries.length; i++) {
            const entry = entries[i];
            if (!entry || typeof entry !== "object")
                continue;
            const uuid = entry.uuid;
            if (typeof uuid !== "string" || uuid.length === 0)
                continue;
            if (self.length > 0 && uuid === self)
                continue;
            const instanceId = (entry.instanceId === undefined || entry.instanceId === null)
                ? ""
                : String(entry.instanceId);
            const key = uuid + "|" + instanceId;
            if (seenKeys[key])
                continue;
            seenKeys[key] = true;

            let rel = null;
            if (instanceId.length > 0) {
                const r = uuid + "/" + instanceId + ".json";
                /* Live uuid/id strings are not profile data, but the probe
                 * path is built from them all the same, so run it through
                 * the same jail the restore side enforces. */
                if (sanitizeRelativePath(r) !== null && _pathContained(root, r) &&
                        _atomicFile.fileExists(GLib.build_filenamev([root, r])))
                    rel = r;
            }
            if (rel === null) {
                const r = uuid + "/" + uuid + ".json";
                if (sanitizeRelativePath(r) !== null && _pathContained(root, r) &&
                        _atomicFile.fileExists(GLib.build_filenamev([root, r])))
                    rel = r;
            }
            if (rel === null || seenPaths[rel])
                continue;
            seenPaths[rel] = true;

            const content = _atomicFile.readTextFile(GLib.build_filenamev([root, rel]));
            if (content === null)
                continue;
            out.push({
                uuid: uuid,
                instanceId: instanceId,
                relativePath: rel,
                sha256: _atomicFile.sha256Hex(content),
                content: content
            });
        }
    } catch (e) {
        _warn("captureConfigs failed: " + e);
    }
    return out;
}

/* ------------------------------------------------------------------ *
 * Restore
 * ------------------------------------------------------------------ */

function _preflightConfigState(configs, tombstones) {
    const result = { ok: true, written: 0, removed: 0, skipped: 0,
        warnings: [], writes: [], removals: [] };
    _resolveSiblings();
    if (!_atomicFile) {
        result.ok = false;
        result.warnings.push("config store unavailable");
        return result;
    }
    try {
        if (!Array.isArray(configs) || !Array.isArray(tombstones)) {
            result.ok = false;
            result.warnings.push("config state is not an array");
            return result;
        }
        const root = _configRootPath();
        const self = _selfUuidValue();
        const seen = {};
        function inspect(config, index, removal) {
            if (!config || typeof config !== "object") {
                result.skipped++;
                result.warnings.push("config " + index + ": not an object");
                result.ok = false;
                return;
            }
            const sanitized = sanitizeRelativePath(config.relativePath);
            const pathOwner = sanitized ? sanitized.split("/")[0] : "";
            if (self.length > 0 && (config.uuid === self || pathOwner === self)) {
                if (config.uuid !== self || pathOwner !== self) {
                    result.warnings.push("config " + index +
                        ": rejected self-owned path");
                    result.ok = false;
                }
                result.skipped++;
                return;
            }
            const rel = _ownedConfigPath(config);
            if (rel === null) {
                result.skipped++;
                result.warnings.push("config " + index +
                    ": path is not owned by its uuid and instance");
                result.ok = false;
                return;
            }
            if (!_pathContained(root, rel)) {
                result.skipped++;
                result.warnings.push("config " + index +
                    ": symlinked path rejected");
                result.ok = false;
                return;
            }
            if (seen[rel]) {
                result.skipped++;
                result.warnings.push("config " + index +
                    ": duplicate target " + rel);
                result.ok = false;
                return;
            }
            seen[rel] = true;
            if (!removal && typeof config.content !== "string") {
                result.skipped++;
                result.warnings.push("config " + index +
                    ": content is not a string");
                result.ok = false;
                return;
            }
            if (!removal && (typeof config.sha256 !== "string" ||
                    !SHA256_RE.test(config.sha256))) {
                result.skipped++;
                result.warnings.push("config " + index +
                    ": missing or malformed sha256 for " + config.uuid);
                result.ok = false;
                return;
            }
            if (!removal &&
                    _atomicFile.sha256Hex(config.content) !== config.sha256) {
                result.skipped++;
                result.warnings.push("config " + index +
                    ": saved content hash mismatch for " + config.uuid);
                result.ok = false;
                return;
            }
            const item = { index: index, rel: rel,
                target: GLib.build_filenamev([root, rel]),
                content: config.content, sha256: config.sha256,
                uuid: config.uuid, instanceId: config.instanceId };
            (removal ? result.removals : result.writes).push(item);
        }
        for (let i = 0; i < configs.length; i++)
            inspect(configs[i], i, false);
        for (let i = 0; i < tombstones.length; i++)
            inspect(tombstones[i], configs.length + i, true);
    } catch (e) {
        result.ok = false;
        result.warnings.push("config preflight failed: " + e);
    }
    return result;
}

function validateConfigState(configs, tombstones) {
    const checked = _preflightConfigState(configs, tombstones || []);
    return { ok: checked.ok, skipped: checked.skipped,
        warnings: checked.warnings.slice() };
}

function restoreConfigState(configs, tombstones) {
    const result = _preflightConfigState(configs, tombstones || []);
    if (!result.ok) {
        delete result.writes;
        delete result.removals;
        return result;
    }
    try {
        for (let i = 0; i < result.writes.length; i++) {
            const item = result.writes[i];
            const dir = GLib.path_get_dirname(item.target);
            if (!_atomicFile.ensurePrivateDir(dir) ||
                    !_pathContained(_configRootPath(), item.rel)) {
                result.skipped++;
                result.warnings.push("config " + item.index +
                    ": unsafe directory for " + item.uuid);
                result.ok = false;
                continue;
            }
            if (!_atomicFile.writePrivateFileAtomic(item.target, item.content)) {
                result.skipped++;
                result.warnings.push("config " + item.index +
                    ": write failed for " + item.uuid);
                result.ok = false;
                continue;
            }
            result.written++;
            if (typeof item.sha256 === "string" && item.sha256.length > 0) {
                const written = _atomicFile.readTextFile(item.target);
                if (written === null ||
                        _atomicFile.sha256Hex(written) !== item.sha256) {
                    result.warnings.push("config " + item.index +
                        ": written content hash mismatch for " + item.uuid);
                    result.ok = false;
                }
            }
        }
        for (let i = 0; i < result.removals.length; i++) {
            const item = result.removals[i];
            if (!_pathContained(_configRootPath(), item.rel)) {
                result.skipped++;
                result.warnings.push("config " + item.index +
                    ": unsafe removal path for " + item.uuid);
                result.ok = false;
                continue;
            }
            try {
                const file = Gio.File.new_for_path(item.target);
                if (file.query_exists(null)) {
                    file.delete(null);
                    result.removed++;
                }
            } catch (e) {
                result.skipped++;
                result.warnings.push("config " + item.index +
                    ": removal failed for " + item.uuid);
                result.ok = false;
            }
        }
    } catch (e) {
        result.ok = false;
        result.warnings.push("restoreConfigState failed: " + e);
    }
    delete result.writes;
    delete result.removals;
    return result;
}

function restoreConfigs(configs) {
    return restoreConfigState(configs, []);
}

function captureRollbackState(currentConfigs, targetConfigs) {
    const result = { ok: true, configs: [], tombstones: [], warnings: [] };
    try {
        currentConfigs = Array.isArray(currentConfigs) ? currentConfigs : [];
        targetConfigs = Array.isArray(targetConfigs) ? targetConfigs : [];
        const checked = _preflightConfigState(targetConfigs, []);
        if (!checked.ok) {
            result.ok = false;
            result.warnings = checked.warnings.slice();
            return result;
        }
        result.configs = currentConfigs.map(function (item) {
            return JSON.parse(JSON.stringify(item));
        });
        const seen = {};
        result.configs.forEach(function (item) {
            const rel = _ownedConfigPath(item);
            if (rel)
                seen[rel] = true;
        });
        checked.writes.forEach(function (item) {
            if (seen[item.rel])
                return;
            seen[item.rel] = true;
            if (_atomicFile.fileExists(item.target)) {
                const content = _atomicFile.readTextFile(item.target);
                if (content === null) {
                    result.ok = false;
                    result.warnings.push("could not capture " + item.rel);
                    return;
                }
                result.configs.push({ uuid: item.uuid,
                    instanceId: item.instanceId === undefined ? "" :
                        String(item.instanceId), relativePath: item.rel,
                    sha256: _atomicFile.sha256Hex(content), content: content });
            } else {
                result.tombstones.push({ uuid: item.uuid,
                    instanceId: item.instanceId === undefined ? "" :
                        String(item.instanceId), relativePath: item.rel });
            }
        });
    } catch (e) {
        result.ok = false;
        result.warnings.push("rollback config capture failed: " + e);
    }
    return result;
}

/* ------------------------------------------------------------------ *
 * Hash list
 * ------------------------------------------------------------------ */

/**
 * configHashList:
 * @configs (array): captured configs (any order, duplicates tolerated).
 *
 * Returns (array): sorted "uuid|instanceId|sha256" strings. Sorted so two
 * captures of the same state hash to the same list regardless of the order
 * enabled-applets happened to be in.
 */
function configHashList(configs) {
    try {
        if (!Array.isArray(configs))
            return [];
        const list = [];
        for (let i = 0; i < configs.length; i++) {
            const config = configs[i];
            if (!config || typeof config !== "object")
                continue;
            list.push(String(config.uuid) + "|" + String(config.instanceId) +
                "|" + String(config.sha256));
        }
        list.sort();
        return list;
    } catch (e) {
        _warn("configHashList failed: " + e);
        return [];
    }
}

/* ------------------------------------------------------------------ *
 * Watch
 * ------------------------------------------------------------------ *
 * One Gio.FileMonitor per unique uuid directory, filtered to the watched
 * file names. Debouncing is the caller's job; this layer only reports that
 * something touched a watched file. An atomic replace arrives as a renamed
 * event carrying the OLD name as file and the NEW name as other_file, so
 * both are checked. */

/**
 * watchConfigs:
 * @configs (array): captured configs (only relativePath matters).
 * @onChangeCb (function): called as onChangeCb(relativePath) on a matching
 * event; exceptions from the callback are swallowed.
 *
 * Returns (object): handle {monitors, ids, alive}. Dead on arrival when the
 * arguments are unusable. Never throws.
 */
function watchConfigs(configs, onChangeCb) {
    const handle = { monitors: [], ids: [], alive: false };
    try {
        if (!Array.isArray(configs) || typeof onChangeCb !== "function")
            return handle;
        const root = _configRootPath();
        if (root.length === 0)
            return handle;

        /* dirName -> { fileName -> relativePath } */
        const watched = {};
        for (let i = 0; i < configs.length; i++) {
            const config = configs[i];
            if (!config || typeof config !== "object")
                continue;
            const rel = sanitizeRelativePath(config.relativePath);
            if (rel === null)
                continue;
            const parts = rel.split("/");
            if (!watched[parts[0]])
                watched[parts[0]] = {};
            watched[parts[0]][parts[1]] = rel;
        }

        for (const dirName in watched) {
            const names = watched[dirName];
            const dirPath = GLib.build_filenamev([root, dirName]);
            let monitor = null;
            try {
                monitor = Gio.File.new_for_path(dirPath).monitor_directory(
                    Gio.FileMonitorFlags.WATCH_MOVES | Gio.FileMonitorFlags.SEND_MOVED,
                    null);
            } catch (ignored) {
                monitor = null;
            }
            if (!monitor)
                continue;
            const id = monitor.connect("changed", function (m, file, otherFile, eventType) {
                try {
                    let hit = null;
                    if (file) {
                        const base = file.get_basename();
                        if (names[base])
                            hit = names[base];
                    }
                    if (hit === null && otherFile) {
                        const base = otherFile.get_basename();
                        if (names[base])
                            hit = names[base];
                    }
                    if (hit !== null)
                        onChangeCb(hit);
                } catch (ignored) {
                    /* a throwing callback must not kill the monitor */
                }
            });
            handle.monitors.push(monitor);
            handle.ids.push(id);
        }
        handle.alive = true;
    } catch (e) {
        _warn("watchConfigs failed: " + e);
    }
    return handle;
}

/**
 * unwatchConfigs:
 * @handle (object): value returned by watchConfigs.
 *
 * Cancels each monitor and disconnects each signal id. Idempotent: a dead
 * or malformed handle is a no-op. Never throws.
 */
function unwatchConfigs(handle) {
    try {
        if (!handle || typeof handle !== "object" || !handle.alive)
            return;
        handle.alive = false;
        const ids = Array.isArray(handle.ids) ? handle.ids : [];
        const monitors = Array.isArray(handle.monitors) ? handle.monitors : [];
        for (let i = 0; i < monitors.length; i++) {
            try {
                if (ids[i] !== undefined)
                    monitors[i].disconnect(ids[i]);
                monitors[i].cancel();
            } catch (ignored) {
                /* already gone */
            }
        }
        handle.monitors = [];
        handle.ids = [];
    } catch (e) {
        _warn("unwatchConfigs failed: " + e);
    }
}
