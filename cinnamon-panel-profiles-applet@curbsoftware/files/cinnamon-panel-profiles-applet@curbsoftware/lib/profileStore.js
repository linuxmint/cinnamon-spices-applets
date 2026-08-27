/* Panel Profiles profile store: profiles CRUD, state.json, rollback files.
 *
 * Everything the applet persists lives under STATE_DIR: named profiles in
 * profiles/<id>.json, one rollback snapshot in backups/last-good.json, and
 * the small machine-owned state.json (active/pendingApply).
 * All writes go through atomicFile (temp sibling + rename, 0600, dirs 0700).
 * Profile ids are validated against a tight pattern before they ever touch
 * a path, because ids come from filenames and, via imports, from outside.
 *
 * DEPENDENCY NOTE: profileSchema.js (validate/migrate) is owned by a
 * parallel work package and MUST NOT be imported here. Instead the
 * composition root injects validators via setDependencies({ validateProfile,
 * migrateProfile }). Until then this store falls back to a minimal
 * structural check (current schemaVersion, id and name strings) and skips
 * migration entirely. Its version check follows constants.SCHEMA_VERSION.
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

let _logger = null;
let _validateProfile = null; /* injected by the composition root (WP1) */
let _migrateProfile = null;

/**
 * setDependencies:
 * @deps (object): { logger, validateProfile, migrateProfile }
 *
 * logger: optional object with warn()/error(). validateProfile(profile)
 * must return null when valid, a string error otherwise; migrateProfile
 * (profile) must return an upgraded profile in place or a new object. Both
 * default to null: the store then only runs its minimal structural check.
 * Unknown keys are ignored.
 */
function setDependencies(deps) {
    try {
        if (!deps)
            return;
        if (deps.logger !== undefined)
            _logger = deps.logger || null;
        if (typeof deps.validateProfile === "function")
            _validateProfile = deps.validateProfile;
        if (typeof deps.migrateProfile === "function")
            _migrateProfile = deps.migrateProfile;
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
    _logger = null;
    _validateProfile = null;
    _migrateProfile = null;
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

/* ------------------------------------------------------------------ *
 * Paths and small helpers
 * ------------------------------------------------------------------ */

/* Profile ids are uuids (letters, digits, hyphens) and nothing else; this
 * is also the traversal guard for filenames that come off disk or out of
 * imported data. */
const PROFILE_ID_RE = /^[A-Za-z0-9-]+$/;
const STORE_LOCK_STALE_SECONDS = 300;
let _storeLockDepth = 0;

function _stateDirPath() {
    _resolveSiblings();
    return _constants ? _constants.STATE_DIR : "";
}

function _storeLockPath() {
    return GLib.build_filenamev([_stateDirPath(), "store.lock"]);
}

function _tryCreateStoreLock() {
    const lock = Gio.File.new_for_path(_storeLockPath());
    try {
        const stream = lock.create(Gio.FileCreateFlags.NONE, null);
        const info = new Gio.FileInfo();
        info.set_attribute_uint32("unix::mode", 0o600);
        lock.set_attributes_from_info(info, Gio.FileQueryInfoFlags.NONE, null);
        return { file: lock, stream: stream };
    } catch (e) {
        try {
            const info = lock.query_info("time::modified",
                Gio.FileQueryInfoFlags.NONE, null);
            const modified = info.get_attribute_uint64("time::modified");
            const now = Math.floor(GLib.get_real_time() / 1000000);
            if (modified > 0 && now - modified > STORE_LOCK_STALE_SECONDS) {
                lock.delete(null);
                const stream = lock.create(Gio.FileCreateFlags.NONE, null);
                const privateInfo = new Gio.FileInfo();
                privateInfo.set_attribute_uint32("unix::mode", 0o600);
                lock.set_attributes_from_info(privateInfo,
                    Gio.FileQueryInfoFlags.NONE, null);
                return { file: lock, stream: stream };
            }
        } catch (ignored) {
        }
        return null;
    }
}

/* Short cross-process critical section shared with the settings widget.
 * The apply controller uses it for profile existence, rollback capture and
 * the durable prepared marker. */
function withStoreLock(fn) {
    if (typeof fn !== "function")
        return { ok: false, error: "invalid lock callback" };
    if (_storeLockDepth > 0) {
        _storeLockDepth++;
        try {
            return { ok: true, value: fn() };
        } catch (e) {
            return { ok: false,
                error: e && e.message ? e.message : String(e) };
        } finally {
            _storeLockDepth--;
        }
    }
    _resolveSiblings();
    if (!_atomicFile || !_atomicFile.ensurePrivateDir(_stateDirPath()))
        return { ok: false, error: "state directory unavailable" };
    const held = _tryCreateStoreLock();
    if (!held)
        return { ok: false, error: "profile store is busy" };
    _storeLockDepth = 1;
    try {
        return { ok: true, value: fn() };
    } catch (e) {
        return { ok: false, error: e && e.message ? e.message : String(e) };
    } finally {
        _storeLockDepth = 0;
        try {
            held.stream.close(null);
        } catch (ignored) {
        }
        try {
            held.file.delete(null);
        } catch (ignored) {
        }
    }
}

function _lockedValue(fallback, fn) {
    const locked = withStoreLock(fn);
    return locked && locked.ok === true ? locked.value : fallback;
}

function _profilesDirPath() {
    return GLib.build_filenamev([_stateDirPath(), _constants.PROFILES_SUBDIR]);
}

function _backupsDirPath() {
    return GLib.build_filenamev([_stateDirPath(), _constants.BACKUPS_SUBDIR]);
}

function _stateFilePath() {
    return GLib.build_filenamev([_stateDirPath(), _constants.STATE_FILE]);
}

function _profileFilePath(id) {
    return GLib.build_filenamev([_profilesDirPath(), id + ".json"]);
}

function _lastGoodPath() {
    return GLib.build_filenamev([_backupsDirPath(), _constants.LAST_GOOD_FILE]);
}

/* ISO 8601 with a numeric timezone offset (-07:00 style). GLib's own
 * format_iso8601() omits the minutes half of the offset on whole-hour
 * zones and nothing downstream can parse that; %:z always emits hh:mm. */
function _isoNow() {
    return GLib.DateTime.new_now_local().format("%Y-%m-%dT%H:%M:%S%:z");
}

function _defaultState() {
    _resolveSiblings();
    return {
        schemaVersion: _constants ? _constants.STATE_SCHEMA_VERSION : 3,
        activeProfileId: null,
        pendingApply: null,
        lastSuccessfulApply: null,
        lastFailure: null
    };
}

/* Merge a parsed state over the defaults so a future schema that gained a
 * key still loads on an older state file without a spurious recovery. */
function _mergeState(parsed) {
    const state = _defaultState();
    if (parsed && typeof parsed === "object") {
        for (const key in state) {
            if (parsed[key] !== undefined)
                state[key] = parsed[key];
        }
    }
    return state;
}

/* Old state shapes collapse to one active profile. A v2 state can carry two
 * active ids from the short-lived split-profile design; panel wins because
 * every v4 profile restores panels. */
function _migrateState(parsed) {
    const next = _defaultState();
    if (!parsed || typeof parsed !== "object")
        return next;
    next.lastSuccessfulApply = parsed.lastSuccessfulApply !== undefined
        ? parsed.lastSuccessfulApply : null;
    next.lastFailure = parsed.lastFailure !== undefined
        ? parsed.lastFailure : null;
    next.pendingApply = (parsed.pendingApply &&
        parsed.pendingApply.reason === "removal")
        ? null : (parsed.pendingApply !== undefined
            ? parsed.pendingApply : null);
    next.activeProfileId = parsed.activePanelProfileId ||
        parsed.activeProfileId || parsed.activeDeskletProfileId || null;
    return next;
}

/* Accept v1/v2 state shapes, migrated to v3 in memory. */
function _acceptableState(parsed) {
    if (!parsed || typeof parsed !== "object")
        return null;
    if (parsed.schemaVersion === _defaultState().schemaVersion)
        return _mergeState(parsed);
    if (parsed.schemaVersion === 1 || parsed.schemaVersion === 2)
        return _migrateState(parsed);
    return null;
}

function _selfUuidValue() {
    _resolveSiblings();
    if (_constants && typeof _constants.selfUuid === "function")
        return String(_constants.selfUuid());
    return "";
}

/* ------------------------------------------------------------------ *
 * init
 * ------------------------------------------------------------------ */

/**
 * init:
 *
 * Ensures STATE_DIR, profiles/ and backups/ exist (0700), then reads
 * state.json. Corrupt JSON or a wrong-shaped state is renamed to
 * state.json.corrupt-<unixts> and replaced with safe defaults; profile
 * files are NEVER touched during recovery. If the quarantine rename fails
 * the corrupt file is left in place and defaults are returned unwritten,
 * because destroying the user's state to "fix" it is worse than running
 * on defaults.
 *
 * Returns (object): { state, recoveredWarnings[], busy? }. Lock contention
 * returns state:null and busy:true so startup never mistakes an unread state
 * for an empty one.
 */
function init() {
    if (_storeLockDepth === 0)
        return _lockedValue({ state: null, recoveredWarnings: [], busy: true },
            init);
    const warnings = [];
    let state = _defaultState();
    _resolveSiblings();
    if (!_atomicFile) {
        warnings.push("sibling modules unavailable");
        return { state: state, recoveredWarnings: warnings };
    }
    try {
        if (!_atomicFile.ensurePrivateDir(_stateDirPath()) ||
            !_atomicFile.ensurePrivateDir(_profilesDirPath()) ||
            !_atomicFile.ensurePrivateDir(_backupsDirPath())) {
            warnings.push("could not create state directories");
            return { state: state, recoveredWarnings: warnings };
        }

        const statePath = _stateFilePath();
        if (!_atomicFile.fileExists(statePath)) {
            if (!_atomicFile.writePrivateFileAtomic(statePath,
                    JSON.stringify(state, null, 2)))
                warnings.push("could not write initial state.json");
            return { state: state, recoveredWarnings: warnings };
        }

        const text = _atomicFile.readTextFile(statePath);
        let parsed = null;
        try {
            parsed = text === null ? null : JSON.parse(text);
        } catch (ignored) {
            parsed = null;
        }
        const shapeOk = _acceptableState(parsed);
        if (shapeOk) {
            state = shapeOk;
            /* Persist the migrated/merged state only when it actually
             * changed something (a v1 file upgrades to v2 on disk here). */
            const mergedText = JSON.stringify(state, null, 2);
            if (mergedText !== text &&
                !_atomicFile.writePrivateFileAtomic(statePath, mergedText))
                warnings.push("could not persist normalized state.json");
            return { state: state, recoveredWarnings: warnings };
        }

        const quarantined = _quarantineStateFile(statePath);
        if (quarantined === null) {
            warnings.push("state.json unreadable and could not be quarantined");
            return { state: state, recoveredWarnings: warnings };
        }
        warnings.push("state.json was corrupt; recovered to defaults, " +
            "old file kept as " + quarantined);
        _warn("state.json corrupt, quarantined as " + quarantined);
        if (!_atomicFile.writePrivateFileAtomic(statePath,
                JSON.stringify(state, null, 2)))
            warnings.push("could not write fresh state.json");
    } catch (e) {
        _warn("init failed: " + e);
        warnings.push("init failed: " + e);
    }
    return { state: state, recoveredWarnings: warnings };
}

/* Rename the corrupt state file aside. Returns the new basename or null. */
function _quarantineStateFile(statePath) {
    try {
        const ts = Math.floor(GLib.get_real_time() / 1000000);
        let target = statePath + ".corrupt-" + ts;
        let n = 2;
        while (_atomicFile.fileExists(target)) {
            target = statePath + ".corrupt-" + ts + "-" + n;
            n++;
        }
        Gio.File.new_for_path(statePath).move(
            Gio.File.new_for_path(target), Gio.FileCopyFlags.NONE, null, null);
        return target.substr(target.lastIndexOf("/") + 1);
    } catch (e) {
        _warn("could not quarantine state.json: " + e);
        return null;
    }
}

/* ------------------------------------------------------------------ *
 * Listing and loading
 * ------------------------------------------------------------------ */

/**
 * listProfiles:
 *
 * Scans profiles/*.json. A file that is unreadable or not valid JSON is
 * listed with valid:false and its name taken from the filename so the UI
 * can still show (and the user delete) the broken thing. Sorted by name
 * with localeCompare; Array.sort is stable in SpiderMonkey.
 *
 * Returns (array): [{id, name, updatedAt, expectedCount, valid}].
 */
function listProfiles() {
    if (_storeLockDepth === 0)
        return _lockedValue([], listProfiles);
    const out = [];
    _resolveSiblings();
    if (!_atomicFile)
        return out;
    try {
        if (!_atomicFile.ensurePrivateDir(_profilesDirPath()))
            return out;
        const dir = Gio.File.new_for_path(_profilesDirPath());
        const children = dir.enumerate_children("standard::name,standard::type",
            Gio.FileQueryInfoFlags.NONE, null);
        let info;
        while ((info = children.next_file(null)) !== null) {
            const name = info.get_name();
            if (info.get_file_type() !== Gio.FileType.REGULAR)
                continue;
            if (name.length <= 5 || name.substr(name.length - 5) !== ".json")
                continue;
            const id = name.substr(0, name.length - 5);
            let entry = {
                id: id,
                name: id,
                includeDesklets: false,
                updatedAt: null,
                expectedCount: null,
                valid: false
            };
            const loaded = loadProfile(id);
            const parsed = loaded && !loaded.error ? loaded.profile : null;
            if (parsed) {
                entry.name = parsed.name;
                entry.updatedAt = parsed.updatedAt;
                entry.expectedCount = parsed.monitorTopology.expectedCount;
                entry.includeDesklets = parsed.includeDesklets === true;
                entry.valid = true;
            }
            out.push(entry);
        }
        children.close(null);
        out.sort(function (a, b) {
            return a.name.localeCompare(b.name);
        });
    } catch (e) {
        _warn("listProfiles failed: " + e);
    }
    return out;
}

/**
 * loadProfile:
 * @id (string): profile id (filename stem).
 *
 * Reads and parses the profile, then migrates and validates it. With no
 * injected validators this is a minimal structural check only
 * (current schemaVersion, id and name strings); the composition root injects
 * profileSchema.validate/migrate at applet init (see the dependency note
 * at the top of this file).
 *
 * Returns (object): { profile, error } with profile null on any failure.
 */
function loadProfile(id) {
    if (_storeLockDepth === 0)
        return _lockedValue({ profile: null, error: "profile store is busy" },
            function () { return loadProfile(id); });
    _resolveSiblings();
    if (!_atomicFile)
        return { profile: null, error: "sibling modules unavailable" };
    try {
        if (typeof id !== "string" || !PROFILE_ID_RE.test(id))
            return { profile: null, error: "invalid profile id" };
        const text = _atomicFile.readTextFile(_profileFilePath(id));
        if (text === null)
            return { profile: null, error: "profile file unreadable" };
        let profile;
        try {
            profile = JSON.parse(text);
        } catch (e) {
            return { profile: null, error: "invalid JSON: " + e.message };
        }
        if (profile === null || typeof profile !== "object")
            return { profile: null, error: "profile is not an object" };

        if (_migrateProfile) {
            try {
                const migrated = _migrateProfile(profile);
                profile = migrated !== undefined && migrated !== null
                    ? migrated : profile;
            } catch (e) {
                return { profile: null, error: "migration failed: " + e.message };
            }
        }

        if (profile.id !== id)
            return { profile: null, error: "profile id does not match filename" };

        if (_validateProfile) {
            let error = null;
            try {
                error = _validateProfile(profile);
            } catch (e) {
                error = "validator threw: " + e.message;
            }
            if (error)
                return { profile: null, error: error };
        } else {
            const versionOk = _constants
                ? profile.schemaVersion === _constants.SCHEMA_VERSION
                : profile.schemaVersion === 1;
            if (!versionOk)
                return { profile: null, error: "unsupported schemaVersion" };
            if (typeof profile.id !== "string" || profile.id.length === 0)
                return { profile: null, error: "missing id" };
            if (typeof profile.name !== "string" || profile.name.length === 0)
                return { profile: null, error: "missing name" };
        }
        return { profile: profile, error: null };
    } catch (e) {
        return { profile: null, error: "loadProfile failed: " + e.message };
    }
}

/* ------------------------------------------------------------------ *
 * Saving and creating
 * ------------------------------------------------------------------ */

/**
 * saveProfile:
 * @profile (object): full profile; profile.id becomes the filename stem.
 *
 * Writes the two-space-indented JSON atomically with mode 0600.
 *
 * Returns (boolean): true on success.
 */
function saveProfile(profile) {
    if (_storeLockDepth === 0)
        return _lockedValue(false, function () { return saveProfile(profile); });
    _resolveSiblings();
    if (!_atomicFile)
        return false;
    try {
        if (profile === null || typeof profile !== "object")
            return false;
        if (typeof profile.id !== "string" || !PROFILE_ID_RE.test(profile.id))
            return false;
        if (!_atomicFile.ensurePrivateDir(_profilesDirPath()))
            return false;
        return _atomicFile.writePrivateFileAtomic(_profileFilePath(profile.id),
            JSON.stringify(profile, null, 2));
    } catch (e) {
        _warn("saveProfile failed: " + e);
        return false;
    }
}

/**
 * createFromSnapshot:
 * @input (object): { name, description, snapshot, configs, deskletConfigs,
 * includeDesklets, configHashes, topology, fingerprint, cinnamonVersion,
 * sessionType }
 *
 * Builds a current profile around a captured snapshot and saves it.
 * snapshot maps to cinnamonSettings; includeDesklets remembers whether
 * desklet settings and configs restore with the panels. configHashes is
 * accepted for signature compatibility but deliberately NOT persisted:
 * every hash already lives in the config entries' sha256 and the sorted
 * list is derivable via appletConfigStore.configHashList, so storing it
 * would be a second copy that can drift.
 *
 * Returns (object|null): the saved profile, or null.
 */
function createFromSnapshot(input) {
    if (_storeLockDepth === 0)
        return _lockedValue(null, function () {
            return createFromSnapshot(input);
        });
    _resolveSiblings();
    try {
        input = input || {};
        const now = _isoNow();
        const profile = {
            schemaVersion: _constants ? _constants.SCHEMA_VERSION : 4,
            id: GLib.uuid_string_random(),
            name: input.name,
            description: typeof input.description === "string"
                ? input.description : "",
            createdAt: now,
            updatedAt: now,
            environment: {
                cinnamonVersion: typeof input.cinnamonVersion === "string"
                    ? input.cinnamonVersion : "",
                sessionType: typeof input.sessionType === "string"
                    ? input.sessionType : ""
            },
            monitorTopology: input.topology || { expectedCount: 1, monitors: [] },
            cinnamonSettings: input.snapshot || {},
            appletConfigs: Array.isArray(input.configs) ? input.configs : [],
            deskletConfigs: Array.isArray(input.deskletConfigs)
                ? input.deskletConfigs : [],
            includeDesklets: input.includeDesklets === true,
            fingerprint: typeof input.fingerprint === "string"
                ? input.fingerprint : "",
            managerAnchor: { uuid: _selfUuidValue(), required: true }
        };
        if (typeof profile.name !== "string" || profile.name.length === 0)
            return null;
        return saveProfile(profile) ? profile : null;
    } catch (e) {
        _warn("createFromSnapshot failed: " + e);
        return null;
    }
}

/**
 * updateFromSnapshot:
 * @existing (object): previously loaded profile.
 * @input (object): { snapshot, configs, deskletConfigs, configHashes,
 * topology, fingerprint }
 *
 * Replaces the captured state (settings, configs, topology, fingerprint)
 * while preserving identity and metadata: id, createdAt, name, description,
 * environment and managerAnchor. includeDesklets is preserved unless the
 * caller explicitly provides it.
 * updatedAt is refreshed. A field is only replaced when the input actually
 * carries it, so an empty configs array (a capture with no third-party
 * configs) clears the stored list instead of being mistaken for "not
 * provided".
 *
 * Returns (object|null): the updated profile, or null.
 */
function updateFromSnapshot(existing, input) {
    if (_storeLockDepth === 0)
        return _lockedValue(null, function () {
            return updateFromSnapshot(existing, input);
        });
    _resolveSiblings();
    try {
        if (existing === null || typeof existing !== "object")
            return null;
        if (typeof existing.id !== "string" || !PROFILE_ID_RE.test(existing.id))
            return null;
        /* The caller may have captured live Cinnamon state after loading
         * this profile. Re-read under the store lock so a concurrent delete
         * cannot be undone and a concurrent rename is not overwritten. */
        const current = loadProfile(existing.id);
        if (!current || current.error || !current.profile)
            return null;
        existing = current.profile;
        input = input || {};
        if ("snapshot" in input)
            existing.cinnamonSettings = input.snapshot || {};
        if ("configs" in input)
            existing.appletConfigs = Array.isArray(input.configs)
                ? input.configs : [];
        if ("deskletConfigs" in input)
            existing.deskletConfigs = Array.isArray(input.deskletConfigs)
                ? input.deskletConfigs : [];
        if ("includeDesklets" in input)
            existing.includeDesklets = input.includeDesklets === true;
        if ("topology" in input)
            existing.monitorTopology = input.topology ||
                { expectedCount: 1, monitors: [] };
        if ("fingerprint" in input)
            existing.fingerprint = typeof input.fingerprint === "string"
                ? input.fingerprint : "";
        existing.updatedAt = _isoNow();
        return saveProfile(existing) ? existing : null;
    } catch (e) {
        _warn("updateFromSnapshot failed: " + e);
        return null;
    }
}

/* ------------------------------------------------------------------ *
 * Rollback snapshots
 * ------------------------------------------------------------------ */

/**
 * writeRollback:
 * @bundle (object): full profile-shaped snapshot ({name: "(rollback)", ...}).
 *
 * Writes the one user-accessible backups/last-good.json atomically.
 *
 * Returns (boolean): true on success.
 */
function writeRollback(bundle) {
    if (_storeLockDepth === 0)
        return _lockedValue(false, function () { return writeRollback(bundle); });
    _resolveSiblings();
    if (!_atomicFile)
        return false;
    try {
        if (bundle === null || typeof bundle !== "object")
            return false;
        if (!_atomicFile.ensurePrivateDir(_backupsDirPath()))
            return false;

        const lastGood = _lastGoodPath();
        return _atomicFile.writePrivateFileAtomic(lastGood,
            JSON.stringify(bundle, null, 2));
    } catch (e) {
        _warn("writeRollback failed: " + e);
        return false;
    }
}

/**
 * readRollback:
 *
 * Returns (object|null): the parsed backups/last-good.json, or null when
 * missing or unparseable.
 */
function readRollback() {
    if (_storeLockDepth === 0)
        return _lockedValue(null, readRollback);
    _resolveSiblings();
    if (!_atomicFile)
        return null;
    try {
        const text = _atomicFile.readTextFile(_lastGoodPath());
        if (text === null)
            return null;
        const bundle = JSON.parse(text);
        return (bundle !== null && typeof bundle === "object") ? bundle : null;
    } catch (e) {
        _warn("readRollback failed: " + e);
        return null;
    }
}

/* ------------------------------------------------------------------ *
 * state.json access
 * ------------------------------------------------------------------ */

/**
 * getState:
 *
 * Reads state.json fresh from disk each call (cheap, and immune to stale
 * in-memory copies after a crash or another instance's write). Missing or
 * corrupt files yield the safe defaults without writing anything.
 *
 * Returns (object|null): the state, or null while another process owns the
 * store lock. Callers that drive recovery must retry null results.
 */
function getState() {
    if (_storeLockDepth === 0)
        return _lockedValue(null, getState);
    _resolveSiblings();
    if (!_atomicFile)
        return _defaultState();
    try {
        const text = _atomicFile.readTextFile(_stateFilePath());
        if (text === null)
            return _defaultState();
        let parsed;
        try {
            parsed = JSON.parse(text);
        } catch (ignored) {
            return _defaultState();
        }
        const acceptable = _acceptableState(parsed);
        return acceptable ? acceptable : _defaultState();
    } catch (e) {
        _warn("getState failed: " + e);
        return _defaultState();
    }
}

/* A state mutation must not silently replace unreadable state with defaults.
 * Quarantine it while the shared store lock is held, then let the requested
 * mutation populate the fresh state. If quarantine fails, abort the write so
 * the original file remains available for manual recovery. */
function _stateForMutation() {
    const statePath = _stateFilePath();
    const text = _atomicFile.readTextFile(statePath);
    if (text === null)
        return _defaultState();
    let parsed = null;
    try {
        parsed = JSON.parse(text);
    } catch (ignored) {
        parsed = null;
    }
    const acceptable = _acceptableState(parsed);
    if (acceptable)
        return acceptable;
    const quarantined = _quarantineStateFile(statePath);
    if (quarantined === null)
        return null;
    _warn("state.json corrupt, quarantined as " + quarantined);
    return _defaultState();
}

/**
 * mutateState:
 * @fn (function): called as fn(state) with the current state; returns a new
 * state object, mutates and returns undefined/null-ish, or returns null to
 * abort with no write.
 *
 * Atomic read-modify-write. A throwing fn aborts without writing.
 *
 * Returns (object|null): the persisted state, or null when aborted or the
 * write failed.
 */
function mutateState(fn) {
    if (_storeLockDepth === 0)
        return _lockedValue(null, function () { return mutateState(fn); });
    _resolveSiblings();
    if (!_atomicFile)
        return null;
    try {
        if (typeof fn !== "function")
            return null;
        const state = _stateForMutation();
        if (state === null)
            return null;
        let result;
        try {
            result = fn(state);
        } catch (e) {
            _warn("mutateState callback threw, no write: " + e);
            return null;
        }
        if (result === null)
            return null;
        const next = (result === undefined || typeof result !== "object")
            ? state : result;
        if (!_atomicFile.ensurePrivateDir(_stateDirPath()))
            return null;
        if (!_atomicFile.writePrivateFileAtomic(_stateFilePath(),
                JSON.stringify(next, null, 2)))
            return null;
        return next;
    } catch (e) {
        _warn("mutateState failed: " + e);
        return null;
    }
}
