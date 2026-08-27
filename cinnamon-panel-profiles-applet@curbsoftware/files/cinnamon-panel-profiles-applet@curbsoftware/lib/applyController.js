/* Panel Profiles apply engine: the transaction state machine.
 *
 * Owns the ordered profile restore (validate, wait for monitors, snapshot
 * rollback, restore panel settings, restore applet configs, write
 * pendingApply, restore enabled-applets LAST, verify after a settle) plus
 * the single-operation lock shared with every save/rollback entry point.
 * All module dependencies are injected; this file never imports Main and
 * never touches St/Clutter, so nothing here can walk a dead actor.
 *
 * The lifecycle rule that shapes the second half of an apply: Cinnamon
 * live-applies enabled-applets DURING the set_value call and may destroy
 * the calling applet instance mid-write. Everything before that write is
 * allowed to use any dependency; everything after it may only touch
 * state.json (profileStore), the settings/config stores, the scheduler and
 * the logger. Handoff to a fresh instance happens purely through
 * pendingApply in state.json, picked up by resumePendingApply().
 *
 * State strings for an apply are exactly IDLE, VALIDATING,
 * WAITING_FOR_MONITORS, SNAPSHOTTING_ROLLBACK, RESTORING_PANEL_SETTINGS,
 * RESTORING_APPLET_CONFIGS, RESTORING_ENABLED_DESKELETS,
 * RESTORING_ENABLED_APPLETS, VERIFYING, COMPLETE, FAILED (COMPLETE and
 * FAILED are momentary; both settle to IDLE). Save operations additionally
 * use SAVING. getState()/isBusy()/isDirtySuppressed() expose the machine,
 * and an optional onStateChange callback mirrors every transition for the
 * menu.
 *
 * Every public function catches exceptions and returns a failure value.
 *
 * No St/Clutter imports and no require() calls: loadable headless via
 * imports.searchPath so the dev-tools test harness can use it directly.
 *
 * Public names are declared with var/function so both the require()
 * auto-export inside Cinnamon and the plain imports.<mod> loader see them.
 *
 * Copyright (C) 2026 curbsoftware
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

const GLib = imports.gi.GLib;

/* ------------------------------------------------------------------ *
 * States
 * ------------------------------------------------------------------ */

var STATE_IDLE = "IDLE";
var STATE_VALIDATING = "VALIDATING";
var STATE_WAITING_FOR_MONITORS = "WAITING_FOR_MONITORS";
var STATE_SNAPSHOTTING_ROLLBACK = "SNAPSHOTTING_ROLLBACK";
var STATE_RESTORING_PANEL_SETTINGS = "RESTORING_PANEL_SETTINGS";
var STATE_RESTORING_APPLET_CONFIGS = "RESTORING_APPLET_CONFIGS";
var STATE_RESTORING_ENABLED_DESKELETS = "RESTORING_ENABLED_DESKELETS";
var STATE_RESTORING_ENABLED_APPLETS = "RESTORING_ENABLED_APPLETS";
var STATE_VERIFYING = "VERIFYING";
var STATE_COMPLETE = "COMPLETE";
var STATE_FAILED = "FAILED";
/* Extension beyond the apply enum, for the save paths. */
var STATE_SAVING = "SAVING";

/* ------------------------------------------------------------------ *
 * Dependency seam
 * ------------------------------------------------------------------ */

let _deps = null;
let _busy = false;
let _state = STATE_IDLE;
let _suppressDirty = false;
let _waitHandle = null;   /* monitorTopology waitForTopology cancel handle */
let _verifyTimerId = null;
let _lastMonitorCount = 0;

/**
 * setDependencies:
 * @deps (object): module handles and function seams, all optional unless
 *   noted: { constants, logger, cinnamonState, appletConfigStore,
 *   profileStore, profileSchema, fingerprint, monitorTopology, scheduler,
 *   notify, isAppletInstalled, isDeskletInstalled,
 *   notifySuccessEnabled, onWaitStateChange, onProfileSaved, onStateChange,
 *   environment, waitStabilizeMs, waitTimeoutMs, commitRetryDelayMs,
 *   commitRetryLimit }.
 *
 * Module handles are the frozen lib modules (or fakes). scheduler:
 * {timeoutAdd(ms, fn) -> id, sourceRemove(id)}. notify: {info, warn,
 * success}(title, details) wrapping Main.notify; the controller itself
 * never imports Main, the wrapper decides what is safe to call on a dead
 * actor. notifySuccessEnabled() -> boolean gate.
 * onWaitStateChange(show, current, required) lets the menu
 * display the wait; onProfileSaved(profile) lets the applet reset dirty
 * tracking; onStateChange(state) mirrors every transition. environment()
 * -> {cinnamonVersion, sessionType} stamps saved profiles and rollbacks.
 * waitStabilizeMs/waitTimeoutMs override the monitor-wait timings, which
 * now gate only explicit applies that expect more displays than are live.
 * commitRetryDelayMs/commitRetryLimit optionally tune bounded retries for
 * durable verification commits and startup recovery reads.
 *
 * When both profileStore and profileSchema are present the store's
 * validator seam is wired here (validate/migrate adapters): the store owns
 * persistence, the schema owns correctness, the composition root only has
 * to hand both handles to this controller.
 *
 * Wiring also resets the in-memory machine (lock, state, timers): lib
 * modules stay cached across applet reloads, so a fresh instance's init
 * wiring is the one reliable "previous instance is gone" signal. The old
 * instance's outstanding timers are its own scheduler's problem; the
 * composition root cancels them in its removal hook.
 */
function setDependencies(deps) {
    /* Retire the OUTGOING wiring's outstanding continuations before the
     * seam swaps: the verify timer's sourceRemove must resolve against
     * the old scheduler, and an armed monitor wait must never fire into
     * the successor's world (a removal-time wait whose onReady would run
     * a self-stripped apply after the applet was re-added is the worst
     * case). The wait handle cancels through its own captured seam. */
    _cancelWaitHandle();
    _cancelVerifyTimer();
    _deps = (deps && typeof deps === "object") ? deps : null;
    _busy = false;
    _state = STATE_IDLE;
    _suppressDirty = false;
    _waitHandle = null;
    _verifyTimerId = null;
    _lastMonitorCount = 0;
    try {
        if (_deps && _deps.profileStore && _deps.profileSchema) {
            _deps.profileStore.setDependencies({
                validateProfile: function (profile) {
                    const verdict = _deps.profileSchema.validate(profile);
                    if (verdict && verdict.ok)
                        return null;
                    return verdict && verdict.errors
                        ? verdict.errors.join("; ")
                        : "profile validation failed";
                },
                migrateProfile: function (profile) {
                    return _deps.profileSchema.migrate(profile).profile;
                }
            });
        }
    } catch (ignored) {
        /* the store's seam must never break controller wiring */
    }
}

/**
 * resetDependencies:
 *
 * Restores defaults and clears in-memory machine state (timers and waits
 * are dropped, not cancelled: tests own the clocks). Test teardown helper.
 */
function resetDependencies() {
    _deps = null;
    _busy = false;
    _state = STATE_IDLE;
    _suppressDirty = false;
    _waitHandle = null;
    _verifyTimerId = null;
    _lastMonitorCount = 0;
}

function _constants() {
    if (_deps && _deps.constants)
        return _deps.constants;
    try {
        return imports.constants;
    } catch (ignored) {
        return null;
    }
}

function _const(name, fallback) {
    const c = _constants();
    return (c && typeof c[name] === "number") ? c[name] : fallback;
}

function _selfUuid() {
    const c = _constants();
    try {
        if (c && typeof c.selfUuid === "function")
            return String(c.selfUuid());
    } catch (ignored) {
    }
    return "";
}

function _cinnamonState() { return _deps ? _deps.cinnamonState : null; }
function _configStore() { return _deps ? _deps.appletConfigStore : null; }
function _profileStore() { return _deps ? _deps.profileStore : null; }
function _schema() { return _deps ? _deps.profileSchema : null; }
function _fingerprintMod() { return _deps ? _deps.fingerprint : null; }
function _topology() { return _deps ? _deps.monitorTopology : null; }
function _scheduler() { return _deps ? _deps.scheduler : null; }

function _log(level, msg, e) {
    try {
        const logger = _deps && _deps.logger;
        if (logger && typeof logger[level] === "function")
            logger[level](msg, e);
    } catch (ignored) {
        /* logging must never take the caller down */
    }
}

function _notify(level, title, details) {
    try {
        const notify = _deps && _deps.notify;
        if (notify && typeof notify[level] === "function")
            notify[level](title, details);
    } catch (ignored) {
        /* a dead notification wrapper must never break the transaction */
    }
}

/* Internal scope strings keep fingerprint code compact. Named profiles are
 * always panel profiles and use includeDesklets for the optional half. */
function _normalizeKind(value) {
    return value === true || value === "both" || value === "desklet"
        ? "both" : "panel";
}

function _kindOf(profile) {
    return profile && profile.includeDesklets === true ? "both" : "panel";
}

function _kindIncludesPanels(kind) {
    return true;
}

function _kindIncludesDesklets(kind) {
    const s = _normalizeKind(kind);
    return s === "both";
}

function _notifySuccessEnabled() {
    try {
        return (_deps && typeof _deps.notifySuccessEnabled === "function")
            ? !!_deps.notifySuccessEnabled() : true;
    } catch (ignored) {
        return true;
    }
}

/* Installability check for referenced third-party applets. A captured
 * config file is NOT proof of installation (it survives uninstalls), so
 * the default probes the applet code directories on disk. */
function _isAppletInstalled(uuid) {
    try {
        if (_deps && typeof _deps.isAppletInstalled === "function")
            return !!_deps.isAppletInstalled(uuid);
        if (typeof uuid !== "string" || uuid.length === 0)
            return false;
        const user = GLib.build_filenamev(
            [GLib.get_home_dir(), ".local", "share", "cinnamon", "applets", uuid]);
        const system = GLib.build_filenamev(
            ["/usr", "share", "cinnamon", "applets", uuid]);
        return GLib.file_test(user, GLib.FileTest.EXISTS) ||
            GLib.file_test(system, GLib.FileTest.EXISTS);
    } catch (ignored) {
        return false;
    }
}

/* Same probe for referenced desklets. */
function _isDeskletInstalled(uuid) {
    try {
        if (_deps && typeof _deps.isDeskletInstalled === "function")
            return !!_deps.isDeskletInstalled(uuid);
        if (typeof uuid !== "string" || uuid.length === 0)
            return false;
        const user = GLib.build_filenamev(
            [GLib.get_home_dir(), ".local", "share", "cinnamon", "desklets", uuid]);
        const system = GLib.build_filenamev(
            ["/usr", "share", "cinnamon", "desklets", uuid]);
        return GLib.file_test(user, GLib.FileTest.EXISTS) ||
            GLib.file_test(system, GLib.FileTest.EXISTS);
    } catch (ignored) {
        return false;
    }
}

function _environment() {
    try {
        if (_deps && typeof _deps.environment === "function") {
            const env = _deps.environment();
            if (env && typeof env === "object")
                return env;
        }
    } catch (ignored) {
    }
    return { cinnamonVersion: "", sessionType: "" };
}

function _isoNow() {
    try {
        return GLib.DateTime.new_now_local().format("%Y-%m-%dT%H:%M:%S%:z");
    } catch (ignored) {
        return "";
    }
}

/* ------------------------------------------------------------------ *
 * Machine plumbing
 * ------------------------------------------------------------------ */

function _setState(next) {
    _state = next;
    _log("log", "state -> " + next);
    try {
        if (_deps && typeof _deps.onStateChange === "function")
            _deps.onStateChange(next);
    } catch (ignored) {
        /* an observer must never steer the machine */
    }
}

function _lock() {
    if (_busy)
        return false;
    _busy = true;
    return true;
}

function _release() {
    _busy = false;
}

/**
 * getState:
 *
 * Returns (string): the current state (see the list at the top).
 */
function getState() {
    return _state;
}

/**
 * isBusy:
 *
 * Returns (boolean): true while any state-changing operation (apply,
 * wait, save, manage, resume verification) holds the lock.
 */
function isBusy() {
    return _busy;
}

/**
 * isDirtySuppressed:
 *
 * Returns (boolean): true from the first panel-settings write of an apply
 * until its verification resolves (or the operation fails or is
 * cancelled). Dirty tracking must not fire on our own writes.
 */
function isDirtySuppressed() {
    return _suppressDirty;
}

function _notifyWaitState(show, current, required) {
    try {
        if (_deps && typeof _deps.onWaitStateChange === "function")
            _deps.onWaitStateChange(show, current, required);
    } catch (ignored) {
        /* the menu must never steer the machine */
    }
}

function _cancelWaitHandle() {
    if (_waitHandle) {
        try {
            _waitHandle.cancel();
        } catch (ignored) {
        }
        _waitHandle = null;
    }
}

function _cancelVerifyTimer() {
    if (_verifyTimerId !== null) {
        try {
            const scheduler = _scheduler();
            if (scheduler && typeof scheduler.sourceRemove === "function")
                scheduler.sourceRemove(_verifyTimerId);
        } catch (ignored) {
        }
        _verifyTimerId = null;
    }
}

function _recordLastFailure(message, extra) {
    try {
        const store = _profileStore();
        if (!store || typeof store.mutateState !== "function")
            return;
        store.mutateState(function (state) {
            state.lastFailure = {
                at: _isoNow(),
                message: String(message)
            };
            if (extra)
                state.lastFailure.detail = extra;
        });
    } catch (ignored) {
        /* state bookkeeping must never mask the real failure */
    }
}

function _newPendingMarker(profile, reason) {
    let transactionId = "";
    try {
        transactionId = GLib.uuid_string_random();
    } catch (ignored) {
        transactionId = String(GLib.get_real_time());
    }
    return {
        transactionId: transactionId,
        profileId: reason === "user" ? profile.id : null,
        reason: reason,
        phase: "prepared",
        startedAt: _isoNow(),
        fingerprint: typeof profile.fingerprint === "string"
            ? profile.fingerprint : "",
        includeDesklets: profile.includeDesklets === true,
        targetSettings: profile.cinnamonSettings
    };
}

/* State is the handoff protocol. Every phase update is read back before
 * Cinnamon settings move, so a destroyed host actor always leaves enough
 * durable context for a successor instance. */
function _persistPending(marker, phase) {
    try {
        const store = _profileStore();
        if (!store || typeof store.mutateState !== "function")
            return false;
        marker.phase = phase;
        const written = store.mutateState(function (state) {
            state.pendingApply = marker;
        });
        if (!written)
            return false;
        const current = store.getState().pendingApply;
        return !!current && current.transactionId === marker.transactionId &&
            current.phase === phase;
    } catch (e) {
        _log("warn", "pending transaction marker failed", e);
        return false;
    }
}

/* Terminal failure: pass through FAILED, settle IDLE, release the lock. */
function _failTerminal() {
    _suppressDirty = false;
    _setState(STATE_FAILED);
    _setState(STATE_IDLE);
    _release();
}

/* ------------------------------------------------------------------ *
 * Capture helpers
 * ------------------------------------------------------------------ */

/* Parse a stored enabled-applets record into its entry list. */
function _entriesOfSnapshot(snapshot) {
    try {
        const rec = snapshot && snapshot.cinnamonSettings &&
            snapshot.cinnamonSettings["enabled-applets"];
        if (!rec || typeof rec.value !== "string")
            return [];
        const state = _cinnamonState();
        if (!state || typeof state.parseVariant !== "function")
            return [];
        const variant = state.parseVariant(null, rec.value);
        if (!variant || variant.get_type_string() !== "as")
            return [];
        const parsed = state.parseEnabledApplets(variant.get_strv());
        return Array.isArray(parsed.entries) ? parsed.entries : [];
    } catch (ignored) {
        return [];
    }
}

/* Same for the enabled-desklets record. */
function _deskletEntriesOfSnapshot(snapshot) {
    try {
        const rec = snapshot && snapshot.cinnamonSettings &&
            snapshot.cinnamonSettings["enabled-desklets"];
        if (!rec || typeof rec.value !== "string")
            return [];
        const state = _cinnamonState();
        if (!state || typeof state.parseVariant !== "function")
            return [];
        const variant = state.parseVariant(null, rec.value);
        if (!variant || variant.get_type_string() !== "as")
            return [];
        const parsed = state.parseEnabledDesklets(variant.get_strv());
        return Array.isArray(parsed.entries) ? parsed.entries : [];
    } catch (ignored) {
        return [];
    }
}

/* Stored record -> raw string array, or null when unparseable. */
function _strvOfRecord(rec) {
    try {
        if (!rec || typeof rec.value !== "string")
            return null;
        const state = _cinnamonState();
        const variant = state.parseVariant(null, rec.value);
        if (!variant || variant.get_type_string() !== "as")
            return null;
        return variant.get_strv();
    } catch (ignored) {
        return null;
    }
}

/* Raw string array -> stored record (verbatim GVariant print form). */
function _recordOfStrv(arr) {
    try {
        const state = _cinnamonState();
        const variant = GLib.Variant.new_strv(arr);
        return { type: "as", value: state.variantToString(variant) };
    } catch (ignored) {
        return null;
    }
}

/**
 * _captureCurrent: (internal)
 * @kind (string): what to capture config files for. Saves pass their own
 *   kind; rollback snapshots always pass "both" (they run before any
 *   modification, so restoring both families is always correct).
 *
 * Full capture bundle for saves and rollback snapshots. Uses the live
 * settings (all keys, verbatim), the config store for each in-kind family
 * and the monitor topology.
 *
 * Returns (object): {snapshot, entries, deskletEntries, configs,
 * deskletConfigs, configHashes, topology, kind} where snapshot is the
 * captureSettings() result (cinnamonSettings map plus missingKeys).
 */
function _captureCurrent(kind, targetConfigs) {
    const s = _normalizeKind(kind);
    const state = _cinnamonState();
    const store = _configStore();
    const snapshot = state.captureSettings();
    const entries = _entriesOfSnapshot(snapshot);
    const deskletEntries = _deskletEntriesOfSnapshot(snapshot);
    const configs = (store && _kindIncludesPanels(s))
        ? store.captureConfigs(entries) : [];
    const deskletConfigs = (store && _kindIncludesDesklets(s))
        ? store.captureConfigs(deskletEntries) : [];
    const configHashes = store
        ? store.configHashList(configs.concat(deskletConfigs)) : [];
    let rollbackConfigFiles = [];
    let configTombstones = [];
    if (store && Array.isArray(targetConfigs) &&
            typeof store.captureRollbackState === "function") {
        const rollbackState = store.captureRollbackState(
            configs.concat(deskletConfigs), targetConfigs);
        if (!rollbackState || rollbackState.ok !== true)
            throw new Error("rollback config capture failed: " +
                (rollbackState && rollbackState.warnings
                    ? rollbackState.warnings.join("; ") : "no result"));
        rollbackConfigFiles = rollbackState.configs;
        configTombstones = rollbackState.tombstones;
    }
    const topology = _topology()
        ? _topology().getCurrentTopology()
        : { expectedCount: 0, monitors: [] };
    return {
        snapshot: snapshot,
        entries: entries,
        deskletEntries: deskletEntries,
        configs: configs,
        deskletConfigs: deskletConfigs,
        configHashes: configHashes,
        topology: topology,
        rollbackConfigFiles: rollbackConfigFiles,
        configTombstones: configTombstones,
        kind: s
    };
}

/* Live fingerprint at the given kind, without touching the layout
 * provider (safe after the enabled-applets write, where the calling
 * instance may already be dead and Main-shaped dependencies are off
 * limits). */
function _liveFingerprint(kind) {
    try {
        const s = _normalizeKind(kind);
        const state = _cinnamonState();
        const store = _configStore();
        const fp = _fingerprintMod();
        if (!state || !store || !fp)
            return null;
        const snapshot = state.captureSettings();
        const configs = _kindIncludesPanels(s)
            ? store.captureConfigs(_entriesOfSnapshot(snapshot)) : [];
        const deskletConfigs = _kindIncludesDesklets(s)
            ? store.captureConfigs(_deskletEntriesOfSnapshot(snapshot)) : [];
        const value = fp.computeFingerprint(snapshot,
            store.configHashList(configs.concat(deskletConfigs)), s);
        return value === "" ? null : value;
    } catch (ignored) {
        return null;
    }
}

function _fingerprintOf(bundle) {
    try {
        const fp = _fingerprintMod();
        return fp ? fp.computeFingerprint(bundle.snapshot,
            bundle.configHashes, bundle.kind) : "";
    } catch (ignored) {
        return "";
    }
}

/* Rollback bundle: profile-shaped so beginRollback can push it straight
 * back through the same apply pipeline. Kind is always the internal
 * "both": the snapshot predates every write of the transaction being
 * rolled back, so restoring both families reproduces the exact pre-apply
 * world. */
function _rollbackBundleOf(bundle) {
    const now = _isoNow();
    return {
        schemaVersion: _const("SCHEMA_VERSION", 4),
        id: "rollback",
        name: "(rollback)",
        description: "",
        createdAt: now,
        updatedAt: now,
        environment: _environment(),
        monitorTopology: bundle.topology,
        cinnamonSettings: bundle.snapshot.cinnamonSettings,
        appletConfigs: bundle.configs,
        deskletConfigs: bundle.deskletConfigs,
        rollbackConfigFiles: bundle.rollbackConfigFiles || [],
        configTombstones: bundle.configTombstones || [],
        includeDesklets: true,
        fingerprint: _fingerprintOf(bundle),
        managerAnchor: { uuid: _selfUuid(), required: true }
    };
}

function _targetConfigFiles(profile) {
    if (profile && Array.isArray(profile.rollbackConfigFiles) &&
            profile.rollbackConfigFiles.length > 0)
        return profile.rollbackConfigFiles;
    return [].concat(profile && profile.appletConfigs || [],
        profile && profile.includeDesklets === true
            ? (profile.deskletConfigs || []) : []);
}

function _targetConfigTombstones(profile) {
    return profile && Array.isArray(profile.configTombstones)
        ? profile.configTombstones : [];
}

function _validateTargetConfigs(profile) {
    const store = _configStore();
    if (!store || typeof store.validateConfigState !== "function")
        return { ok: true, warnings: [] };
    return store.validateConfigState(_targetConfigFiles(profile),
        _targetConfigTombstones(profile));
}

function _restoreTargetConfigs(profile) {
    const store = _configStore();
    if (!store)
        return { ok: false, warnings: ["config store unavailable"] };
    if (typeof store.restoreConfigState === "function")
        return store.restoreConfigState(_targetConfigFiles(profile),
            _targetConfigTombstones(profile));
    return store.restoreConfigs(_targetConfigFiles(profile));
}

/* ------------------------------------------------------------------ *
 * Anchor repair and pre-flight warnings
 * ------------------------------------------------------------------ */

/* Repair the manager anchor on our copy of the profile (never the stored
 * file): parse the stored panels-enabled and enabled-applets values, run
 * ensureManagerAnchor against the live primary monitor and allocator, and
 * write repaired values back. Returns an array of user-facing warnings;
 * a parse failure returns {fatal: reason} instead. */
function _repairAnchor(profile) {
    const state = _cinnamonState();
    const settings = profile.cinnamonSettings;
    const eaStrv = _strvOfRecord(settings["enabled-applets"]);
    const peStrv = _strvOfRecord(settings["panels-enabled"]);
    if (!eaStrv || !peStrv)
        return { fatal: "stored enabled-applets or panels-enabled is unparseable" };

    let primaryIndex = 0;
    if (_topology()) {
        const topology = _topology().getCurrentTopology();
        (topology.monitors || []).forEach(function (m) {
            if (m.primary)
                primaryIndex = m.savedIndex;
        });
    }
    const liveNextId = state.readNextAppletId();
    let liveEnabledApplets = [];
    try {
        const liveVariant = state.parseVariant(null,
            state.getRaw("enabled-applets"));
        if (liveVariant && liveVariant.get_type_string() === "as")
            liveEnabledApplets = liveVariant.get_strv();
    } catch (ignored) {
    }

    const anchor = state.ensureManagerAnchor({
        enabledApplets: eaStrv,
        liveEnabledApplets: liveEnabledApplets,
        panelsEnabled: peStrv,
        nextAppletId: liveNextId,
        primaryMonitorIndex: primaryIndex
    });
    if (anchor.repaired) {
        const repairedRecord = _recordOfStrv(anchor.enabledApplets);
        if (repairedRecord)
            settings["enabled-applets"] = repairedRecord;
        if (anchor.panelsEnabled.join("\x00") !== peStrv.join("\x00")) {
            const panelsRecord = _recordOfStrv(anchor.panelsEnabled);
            if (panelsRecord)
                settings["panels-enabled"] = panelsRecord;
        }
        /* What gets applied now differs from the stored fingerprint, so
         * recompute it: verification and the pendingApply marker must
         * describe the repaired state, not the imported one. */
        if (typeof profile.fingerprint === "string" &&
                profile.fingerprint.length > 0) {
            try {
                const recomputed = profileFingerprintOf(profile);
                if (recomputed !== "")
                    profile.fingerprint = recomputed;
            } catch (ignored) {
                /* verification falls back to the stored fingerprint */
            }
        }
        _log("log", "manager anchor repaired for apply");
    }
    return { fatal: null };
}

/* Rewrite only the monitor field of panels-enabled on the in-memory apply
 * copy. Saved panel ids, edges and every applet placement remain verbatim.
 * An incomplete mapping fails closed instead of placing panels on a guessed
 * display. */
function _remapProfileMonitors(profile) {
    try {
        const topology = _topology();
        const state = _cinnamonState();
        if (!topology || typeof topology.mapSavedMonitorsToCurrent !== "function")
            return { fatal: null };
        const mapped = topology.mapSavedMonitorsToCurrent(profile.monitorTopology);
        if (!mapped || (mapped.unmatched && mapped.unmatched.length > 0) ||
                (mapped.ambiguous && mapped.ambiguous.length > 0))
            return { fatal: "saved displays could not be mapped safely" };
        const rec = profile.cinnamonSettings["panels-enabled"];
        const strv = _strvOfRecord(rec);
        if (!strv)
            return { fatal: "stored panels-enabled is unparseable" };
        const parsed = state.parsePanelsEnabled(strv);
        if (parsed.malformed && parsed.malformed.length > 0)
            return { fatal: "stored panels-enabled contains malformed entries" };
        const rewritten = parsed.panels.map(function (panel) {
            if (mapped.indexMap[panel.monitor] === undefined)
                throw new Error("no display mapping for saved monitor " + panel.monitor);
            return panel.id + ":" + mapped.indexMap[panel.monitor] +
                ":" + panel.position;
        });
        const updated = _recordOfStrv(rewritten);
        if (!updated)
            return { fatal: "mapped panels-enabled could not be encoded" };
        profile.cinnamonSettings["panels-enabled"] = updated;
        return { fatal: null };
    } catch (e) {
        return { fatal: "saved displays could not be mapped safely: " +
            (e && e.message ? e.message : String(e)) };
    }
}

/* Referenced applets that are not installed ride along as warnings; they
 * must never abort the restore (spec 15). Desklet-kind profiles get the same
 * treatment. */
function _collectApplyWarnings(profile) {
    const warnings = [];
    try {
        const state = _cinnamonState();
        const kind = _kindOf(profile);
        if (_kindIncludesPanels(kind)) {
            const strv = _strvOfRecord(
                profile.cinnamonSettings["enabled-applets"]);
            if (strv) {
                const parsed = state.parseEnabledApplets(strv);
                (parsed.malformed || []).forEach(function (raw) {
                    warnings.push(
                        "malformed enabled-applets entry preserved: " + raw);
                });
                const self = _selfUuid();
                const seen = {};
                (parsed.entries || []).forEach(function (entry) {
                    if (entry.uuid === self || seen[entry.uuid])
                        return;
                    seen[entry.uuid] = true;
                    if (!_isAppletInstalled(entry.uuid))
                        warnings.push("applet not installed: " + entry.uuid);
                });
            }
        }
        if (_kindIncludesDesklets(kind)) {
            const deskletStrv = _strvOfRecord(
                profile.cinnamonSettings["enabled-desklets"]);
            if (deskletStrv) {
                const parsedDesklets = state.parseEnabledDesklets(deskletStrv);
                (parsedDesklets.malformed || []).forEach(function (raw) {
                    warnings.push(
                        "malformed enabled-desklets entry preserved: " + raw);
                });
                const seenDesklets = {};
                (parsedDesklets.entries || []).forEach(function (entry) {
                    if (seenDesklets[entry.uuid])
                        return;
                    seenDesklets[entry.uuid] = true;
                    if (!_isDeskletInstalled(entry.uuid))
                        warnings.push("desklet not installed: " + entry.uuid);
                });
            }
        }
    } catch (ignored) {
        /* warnings are best-effort */
    }
    return warnings;
}

function _prepareProfileForRestore(profile) {
    const remap = _remapProfileMonitors(profile);
    if (remap.fatal)
        return remap;
    const anchor = _repairAnchor(profile);
    if (anchor.fatal)
        return anchor;
    if (typeof profile.fingerprint === "string" &&
            profile.fingerprint.length > 0) {
        const targetFingerprint = profileFingerprintOf(profile);
        if (targetFingerprint)
            profile.fingerprint = targetFingerprint;
    }
    return { fatal: null };
}

function _prepareAndApply(profile, reason, warnings, deferred) {
    const prepared = _prepareProfileForRestore(profile);
    if (prepared.fatal) {
        _recordLastFailure(prepared.fatal);
        _failTerminal();
        _notify("warn", "Panel Profiles", prepared.fatal);
        return _applyResult(!!deferred, prepared.fatal, warnings);
    }
    return _applyNow(profile, reason, warnings);
}

/* ------------------------------------------------------------------ *
 * The apply pipeline
 * ------------------------------------------------------------------ */

/* Phases 6 through 12 of the transaction; the lock is held on entry and
 * always released on exit (verify keeps it until the settle timer
 * resolves). Never call directly: beginApply and beginRollback own the
 * lock. */
function _applyNow(profile, reason, applyWarnings) {
    let rollback = null;
    let enabledAppletsWritten = false;
    let marker = null;
    try {
        const store = _profileStore();
        if (!store)
            throw new Error("profile store unavailable");

        const prepare = function () {
            if (reason === "user") {
                /* Recheck existence while holding the cross-process store
                 * lock. The settings widget uses the same lock for delete. */
                const stillThere = store.loadProfile(profile.id);
                if (!stillThere || stillThere.error || !stillThere.profile)
                    throw new Error("profile was deleted before apply");
                _setState(STATE_SNAPSHOTTING_ROLLBACK);
                const bundle = _captureCurrent("both",
                    _targetConfigFiles(profile));
                rollback = _rollbackBundleOf(bundle);
                if (typeof store.writeRollback !== "function" ||
                        !store.writeRollback(rollback))
                    throw new Error("rollback snapshot could not be written");
            }
            marker = _newPendingMarker(profile, reason);
            if (!_persistPending(marker, "prepared"))
                throw new Error("transaction marker could not be confirmed");
            return true;
        };

        if (reason === "user" && typeof store.withStoreLock === "function") {
            const locked = store.withStoreLock(prepare);
            if (!locked || locked.ok !== true)
                throw new Error(locked && locked.error
                    ? locked.error : "profile store is busy");
        } else {
            prepare();
        }

        const kind = _kindOf(profile);

        /* 7. Panel settings except both enabled lists. */
        _suppressDirty = true;
        _setState(STATE_RESTORING_PANEL_SETTINGS);
        const state = _cinnamonState();
        const settingsResult =
            state.restoreSettingsExceptEnabledApplets(profile, kind);
        if (!settingsResult || settingsResult.ok !== true)
            throw new Error("panel settings restore failed: " +
                (settingsResult
                    ? settingsResult.warnings.join("; ")
                    : "no result"));
        if (!_persistPending(marker, "settings-written"))
            throw new Error("settings phase could not be recorded");

        /* 8. Config files, each family when its kind covers it. */
        _setState(STATE_RESTORING_APPLET_CONFIGS);
        const configResult = _restoreTargetConfigs(profile);
        if (!configResult || configResult.ok !== true)
            throw new Error("config restore failed: " +
                (configResult && configResult.warnings
                    ? configResult.warnings.join("; ") : "no result"));
        if (!_persistPending(marker, "configs-written"))
            throw new Error("config phase could not be recorded");

        /* Mark the list handoff before either live manager processes a list.
         * A successor that appears inside set_value can safely verify from
         * the durable target settings. */
        if (!_persistPending(marker, "writing-lists"))
            throw new Error("list phase could not be recorded");

        /* 10a. enabled-desklets first: deskletManager live-applies it
         * during the call but can never destroy the calling applet, so the
         * post-write restrictions still start at 10b. A failure here lands
         * before the destructive write, with enabledAppletsWritten still
         * false, so error handling rolls everything back cleanly. An
         * absent record is legal (captured on a schema without the key,
         * e.g. an internal rollback bundle): skip, never fail. */
        if (_kindIncludesDesklets(kind) &&
                profile.cinnamonSettings["enabled-desklets"]) {
            _setState(STATE_RESTORING_ENABLED_DESKELETS);
            if (state.restoreEnabledDesklets(profile) !== true)
                throw new Error("enabled-desklets write failed");
        }

        /* 10b. enabled-applets LAST: one write, Cinnamon live-applies it
         * and may destroy this instance mid-call. After this point only
         * state.json work (plus the allocator bumps and the settle timer)
         * continues; no Main-shaped dependency is touched again. */
        if (_kindIncludesPanels(kind)) {
            _setState(STATE_RESTORING_ENABLED_APPLETS);
            if (state.restoreEnabledApplets(profile) !== true)
                throw new Error("enabled-applets write failed");
            enabledAppletsWritten = true;
        }

        if (!_persistPending(marker, "lists-written"))
            throw new Error("list completion could not be recorded");

        /* 11. Bump the allocators past the max restored ids, forward-only.
         * The anchor's allocated id is already inside the entries. */
        if (_kindIncludesDesklets(kind))
            _bumpPastMaxDeskletId(profile);
        if (_kindIncludesPanels(kind))
            _bumpPastMaxId(profile);

        /* 12. Verification after the settle window. */
        if (!_persistPending(marker, "verifying"))
            throw new Error("verification phase could not be recorded");
        _scheduleVerification(profile, reason);
        return _applyResult(true, undefined, applyWarnings);
    } catch (e) {
        _log("error", "apply failed", e);
        _handleApplyError(e, rollback, reason);
        return _applyResult(true, "apply failed", applyWarnings);
    }
}

/* Result shape for beginApply: warnings ride along only when there are
 * any, so exact-shape comparisons by callers stay stable. */
function _applyResult(started, failure, applyWarnings) {
    const result = { started: started };
    if (failure)
        result.failure = failure;
    if (applyWarnings && applyWarnings.length > 0)
        result.warnings = applyWarnings;
    return result;
}

function _bumpPastMaxId(profile) {
    try {
        const state = _cinnamonState();
        const strv = _strvOfRecord(
            profile.cinnamonSettings["enabled-applets"]);
        if (!strv)
            return;
        const parsed = state.parseEnabledApplets(strv);
        let maxId = -1;
        (parsed.entries || []).forEach(function (entry) {
            if (entry.instanceId === null)
                return;
            const n = parseInt(entry.instanceId, 10);
            if (Number.isFinite(n) && n > maxId)
                maxId = n;
        });
        if (maxId >= 0)
            state.bumpNextAppletId(maxId + 1);
    } catch (ignored) {
        /* forward-only bump is best-effort; collisions are caught later
         * by verification */
    }
}

/* Desklet-list twin of _bumpPastMaxId over next-desklet-id. */
function _bumpPastMaxDeskletId(profile) {
    try {
        const state = _cinnamonState();
        const strv = _strvOfRecord(
            profile.cinnamonSettings["enabled-desklets"]);
        if (!strv)
            return;
        const parsed = state.parseEnabledDesklets(strv);
        let maxId = -1;
        (parsed.entries || []).forEach(function (entry) {
            const n = parseInt(entry.instanceId, 10);
            if (Number.isFinite(n) && n > maxId)
                maxId = n;
        });
        if (maxId >= 0)
            state.bumpNextDeskletId(maxId + 1);
    } catch (ignored) {
        /* same best-effort contract as the applet bump */
    }
}

/* Exactly one verification timer may be armed. When our own enabled-applets
 * entry changes mid-apply, the dying instance has already scheduled one and
 * the successor's resumePendingApply() schedules another; overwriting the id
 * without cancelling leaks the first timer, and both then fire (double
 * "profile loaded" notifications). Cancel-then-schedule keeps the newest
 * timer the only one. */
function _cancelVerifyTimer() {
    if (_verifyTimerId !== null) {
        try {
            _scheduler().sourceRemove(_verifyTimerId);
        } catch (e) {
            /* source already gone */
        }
    }
    _verifyTimerId = null;
}

function _scheduleVerification(profile, reason) {
    const scheduler = _scheduler();
    if (!scheduler || typeof scheduler.timeoutAdd !== "function")
        throw new Error("no scheduler available for verification");
    _cancelVerifyTimer();
    _setState(STATE_VERIFYING);
    _verifyTimerId = scheduler.timeoutAdd(_const("VERIFY_SETTLE_MS", 1500),
        function () {
            _verifyTimerId = null;
            _runVerification(profile, reason);
            return false;
        });
}

/* Step 12: canonical verify against the profile plus a live fingerprint
 * compare. Success is reported only after state.json commits. Store-lock
 * contention retries for a bounded interval. A layout mismatch keeps the
 * rollback and warns exactly once. Runs on a timer, possibly after this
 * instance was destroyed; only state.json, the settings/config stores,
 * the logger and the notify wrapper are touched. */
function _retryDelayMs() {
    return (_deps && Number.isFinite(Number(_deps.commitRetryDelayMs)))
        ? Math.max(0, Number(_deps.commitRetryDelayMs)) : 50;
}

function _retryLimit() {
    return (_deps && Number.isFinite(Number(_deps.commitRetryLimit)))
        ? Math.max(0, Math.floor(Number(_deps.commitRetryLimit))) : 20;
}

function _scheduleBoundedRetry(callback, attempt, label) {
    if (attempt >= _retryLimit())
        return false;
    const scheduler = _scheduler();
    if (!scheduler || typeof scheduler.timeoutAdd !== "function")
        return false;
    _log("warn", label + " blocked by profile store; retry " +
        (attempt + 1) + " of " + _retryLimit());
    _cancelVerifyTimer();
    _verifyTimerId = scheduler.timeoutAdd(_retryDelayMs(), function () {
        _verifyTimerId = null;
        callback(attempt + 1);
        return false;
    });
    return true;
}

function _finishCommitFailure(message) {
    _recordLastFailure(message);
    _suppressDirty = false;
    _setState(STATE_FAILED);
    _setState(STATE_IDLE);
    _release();
    _notify("warn", "Panel Profiles",
        "The layout matched, but completion could not be saved. " +
        "Panel Profiles will check the pending restore again after reload.");
}

function _runVerification(profile, reason, commitAttempt) {
    try {
        commitAttempt = Number.isFinite(Number(commitAttempt))
            ? Number(commitAttempt) : 0;
        const kind = _kindOf(profile);
        const state = _cinnamonState();
        const verdict = state.verifyAgainst(profile, kind);
        let fingerprintOk = true;
        const target = typeof profile.fingerprint === "string"
            ? profile.fingerprint : "";
        if (target.length > 0) {
            const live = _liveFingerprint(kind);
            if (live === null || live !== target)
                fingerprintOk = false;
        }
        if ((verdict && verdict.ok) && fingerprintOk) {
            const store = _profileStore();
            const committed = store.mutateState(function (s) {
                /* A rollback is not a named profile: the desktop matches
                 * nothing in the list, so nothing is active. */
                s.activeProfileId = reason === "user" ? profile.id : null;
                s.pendingApply = null;
                s.lastSuccessfulApply = _isoNow();
            });
            if (committed === null) {
                if (_scheduleBoundedRetry(function (nextAttempt) {
                    _runVerification(profile, reason, nextAttempt);
                }, commitAttempt, "verification commit"))
                    return;
                _finishCommitFailure("verification matched but state commit " +
                    "remained busy");
                return;
            }
            _suppressDirty = false;
            _setState(STATE_COMPLETE);
            _setState(STATE_IDLE);
            _release();
            _log("log", "verification succeeded for " + profile.name);
            if (_notifySuccessEnabled())
                _notify("success", "Panel Profiles",
                    reason === "user" ? "Panel profile loaded: " + profile.name
                        : "Previous layout restored.");
        } else {
            const mismatched = verdict ? verdict.mismatchedKeys : [];
            /* Log the live value of each mismatched panel key. These are
             * org.cinnamon panel-layout keys only, never applet config
             * contents, so nothing private can leak. Seeing the actual
             * value is the difference between debugging a Cinnamon
             * rewrite and guessing. */
            let detail = "";
            try {
                const cs = _cinnamonState();
                detail = mismatched.map(function (k) {
                    const live = cs ? cs.getRaw(k) : null;
                    const saved = profile.cinnamonSettings[k]
                        ? profile.cinnamonSettings[k].value : "?";
                    return k + " live=" + live + " saved=" + saved;
                }).join("; ");
            } catch (ignored) {
                /* diagnostics must not mask the failure */
            }
            _log("warn", "verification mismatched keys: " +
                (mismatched.join(", ") || "fingerprint differs") +
                (detail ? " [" + detail + "]" : ""));
            _recordLastFailure("verification failed after apply", {
                mismatchedKeys: mismatched,
                fingerprintOk: fingerprintOk
            });
            if (reason === "user" && _beginAutomaticRollback(null,
                    "verification failed"))
                return;
            /* Known outcome: a later resume would only re-fail, so the
             * pending marker is cleared (the UNKNOWN-outcome path, an
             * exception at/after the write, keeps it instead). */
            const store = _profileStore();
            store.mutateState(function (s) {
                s.pendingApply = null;
            });
            _suppressDirty = false;
            _setState(STATE_FAILED);
            _setState(STATE_IDLE);
            _release();
            _notify("warn", "Panel Profiles",
                "Profile \"" + profile.name + "\" did not verify after " +
                "restoring. The previous layout can be restored from the " +
                "menu.");
        }
    } catch (e) {
        /* An exception in verification is an at/after-write failure. */
        _log("error", "verification threw", e);
        _handleApplyError(e, null, reason);
    }
}

/* Restore the pre-transaction snapshot without taking another snapshot or
 * recursing if rollback itself fails. This is used for every known apply
 * failure. The same durable phase protocol covers host-panel destruction. */
function _beginAutomaticRollback(rollback, cause, resumeIncomplete) {
    try {
        const store = _profileStore();
        const pending = store && store.getState
            ? store.getState().pendingApply : null;
        if (!resumeIncomplete && pending && (pending.reason === "rollback" ||
                pending.reason === "auto-rollback"))
            throw new Error("recursive rollback refused");
        let target = rollback || (store && store.readRollback
            ? store.readRollback() : null);
        if (!target)
            throw new Error("rollback snapshot unavailable");
        target = JSON.parse(JSON.stringify(target));

        /* Recovery files outlive applet upgrades. Upgrade and validate the
         * saved source before touching Cinnamon, just like beginRollback.
         * This also backfills hashes in legacy config snapshots. */
        const schema = _schema();
        if (schema && typeof schema.migrate === "function") {
            const migrated = schema.migrate(target);
            if (migrated && migrated.profile)
                target = migrated.profile;
        }
        const verdict = schema && typeof schema.validate === "function"
            ? schema.validate(target) : { ok: true, errors: [] };
        if (!verdict || !verdict.ok)
            throw new Error("rollback bundle invalid: " +
                (verdict && verdict.errors
                    ? verdict.errors.join("; ") : "unknown"));
        target.includeDesklets = true;

        const remap = _remapProfileMonitors(target);
        if (remap.fatal)
            throw new Error(remap.fatal);
        const anchor = _repairAnchor(target);
        if (anchor.fatal)
            throw new Error(anchor.fatal);
        const recomputed = profileFingerprintOf(target);
        if (recomputed)
            target.fingerprint = recomputed;

        const marker = _newPendingMarker(target, "auto-rollback");
        marker.cause = String(cause || "apply failed");
        if (!_persistPending(marker, "prepared"))
            throw new Error("rollback marker could not be confirmed");

        _suppressDirty = true;
        _setState(STATE_RESTORING_PANEL_SETTINGS);
        const state = _cinnamonState();
        const settingsResult = state.restoreSettingsExceptEnabledApplets(
            target, "both");
        if (!settingsResult || settingsResult.ok !== true)
            throw new Error("rollback settings failed: " +
                (settingsResult && settingsResult.warnings
                    ? settingsResult.warnings.join("; ") : "no result"));
        if (!_persistPending(marker, "settings-written"))
            throw new Error("rollback settings phase could not be recorded");

        _setState(STATE_RESTORING_APPLET_CONFIGS);
        const configResult = _restoreTargetConfigs(target);
        if (!configResult || configResult.ok !== true)
            throw new Error("rollback config restore failed: " +
                (configResult && configResult.warnings
                    ? configResult.warnings.join("; ") : "no result"));
        if (!_persistPending(marker, "configs-written") ||
                !_persistPending(marker, "writing-lists"))
            throw new Error("rollback list phase could not be recorded");

        if (target.cinnamonSettings["enabled-desklets"]) {
            _setState(STATE_RESTORING_ENABLED_DESKELETS);
            if (!state.restoreEnabledDesklets(target))
                throw new Error("rollback enabled-desklets write failed");
        }
        _setState(STATE_RESTORING_ENABLED_APPLETS);
        if (!state.restoreEnabledApplets(target))
            throw new Error("rollback enabled-applets write failed");
        _bumpPastMaxDeskletId(target);
        _bumpPastMaxId(target);
        if (!_persistPending(marker, "lists-written") ||
                !_persistPending(marker, "verifying"))
            throw new Error("rollback completion could not be recorded");
        _scheduleVerification(target, "auto-rollback");
        _notify("warn", "Panel Profiles",
            "The profile failed to restore. Your previous layout is being restored.");
        return true;
    } catch (e) {
        _log("error", "automatic rollback failed", e);
        try {
            const store = _profileStore();
            if (store && store.mutateState)
                store.mutateState(function (state) { state.pendingApply = null; });
        } catch (ignored) {
        }
        _recordLastFailure("automatic rollback failed: " +
            (e && e.message ? e.message : String(e)));
        _failTerminal();
        _notify("warn", "Panel Profiles",
            "Automatic recovery failed. Use Restore previous layout from the menu.");
        return false;
    }
}

/* Step 13. Before the enabled-applets write: configs overwritten during
 * this attempt are restored from the rollback bundle and pendingApply is
 * cleared (the attempt is over). At/after the write the outcome is
 * unknown to us, so the rollback is preserved, pendingApply is LEFT for
 * a resumed verification, and exactly one warning goes out. */
function _finishRollbackFailure(e) {
    const message = e && e.message ? e.message : String(e);
    try {
        const store = _profileStore();
        if (store && store.mutateState)
            store.mutateState(function (state) { state.pendingApply = null; });
    } catch (ignored) {
    }
    _recordLastFailure("rollback failed: " + message);
    _failTerminal();
    _notify("warn", "Panel Profiles",
        "The previous layout could not be restored. No further rollback was attempted.");
}

function _handleApplyError(e, rollback, reason) {
    try {
        const message = e && e.message ? e.message : String(e);
        if (reason === "rollback" || reason === "auto-rollback") {
            _finishRollbackFailure(e);
            return;
        }
        _recordLastFailure("apply failed: " + message);
        _beginAutomaticRollback(rollback, message);
    } catch (outer) {
        /* never leave the lock held */
        _failTerminal();
    }
}

/* Shared continuation once a profile object is validated: digest refresh,
 * anchor repair (panel kinds only; a desklet apply never writes
 * enabled-applets), pre-flight warnings, the monitor gate, then the write
 * pipeline. */
function _continueApply(profile, reason) {
    const configCheck = _validateTargetConfigs(profile);
    if (!configCheck || configCheck.ok !== true) {
        const failure = "profile config validation failed: " +
            (configCheck && configCheck.warnings
                ? configCheck.warnings.join("; ") : "no result");
        _recordLastFailure(failure);
        _failTerminal();
        _notify("warn", "Panel Profiles", failure);
        return { started: false, failure: failure };
    }

    /* Refresh a STAMPED digest under current kind semantics: migration may
     * have changed what the profile restores, and verification plus the
     * pendingApply marker must describe the world this apply writes. An
     * empty fingerprint (hand-crafted or imported files) stays empty: the
     * fingerprint check skips empty targets, and a recomputed digest over
     * a partial capture could never match a full live capture anyway. */
    try {
        if (typeof profile.fingerprint === "string" &&
                profile.fingerprint.length > 0) {
            const recomputed = profileFingerprintOf(profile);
            if (recomputed !== "")
                profile.fingerprint = recomputed;
        }
    } catch (ignored) {
        /* verification falls back to the stored fingerprint */
    }

    const warnings = _collectApplyWarnings(profile);
    if (warnings.length > 0) {
        /* Spec 15/45: a missing third-party applet must not abort the
         * restore, but the user has to hear about it. Surface the collected
         * warnings once (log plus a warning notification; the notify wrapper
         * already honors the notify-warnings setting). */
        const text = warnings.join("; ");
        _log("warn", "apply warnings: " + text);
        _notify("warn", "Panel Profiles", "Profile loaded with warnings: " + text);
    }

    /* 5. Monitor gate: only when the profile expects more heads than are
     * live. The apply waits internally and continues on ready; a
     * user-initiated one also reports the wait back to the caller as a
     * non-start. */
    let expectedCount = 1;
    try {
        const topology = profile.monitorTopology;
        if (topology && Number.isFinite(Number(topology.expectedCount)))
            expectedCount = Math.max(1, Math.floor(
                Number(topology.expectedCount)));
    } catch (ignored) {
    }
    const currentCount = _topology()
        ? _topology().getMonitorCount() : 0;
    if (expectedCount > currentCount) {
        _setState(STATE_WAITING_FOR_MONITORS);
        _lastMonitorCount = currentCount;
        _notifyWaitState(true, currentCount, expectedCount);
        const stabilizeMs = (_deps && Number.isFinite(
            Number(_deps.waitStabilizeMs)))
            ? Number(_deps.waitStabilizeMs)
            : _const("STABILIZE_MS_DEFAULT", 2000);
        const timeoutMs = (_deps && Number.isFinite(
            Number(_deps.waitTimeoutMs)))
            ? Number(_deps.waitTimeoutMs) : 60000;
        _waitHandle = _topology().waitForTopology(expectedCount, {
            stabilizeMs: stabilizeMs,
            timeoutMs: timeoutMs,
            onProgress: function (count, required) {
                _lastMonitorCount = count;
                _notifyWaitState(true, count, required);
            },
            onReady: function () {
                _waitHandle = null;
                _notifyWaitState(false, _lastMonitorCount, expectedCount);
                _log("log", "monitors ready, continuing apply");
                _prepareAndApply(profile, reason, warnings, true);
            },
            onTimeout: function () {
                _waitHandle = null;
                _notifyWaitState(false, _lastMonitorCount, expectedCount);
                _log("warn", "monitor wait timed out: " +
                    _lastMonitorCount + "/" + expectedCount);
                _recordLastFailure("monitor wait timed out: " +
                    _lastMonitorCount + " of " + expectedCount +
                    " required displays became available");
                _failTerminal();
                _notify("warn", "Panel Profiles",
                    "\"" + profile.name + "\" was not restored because " +
                    "only " + _lastMonitorCount + " of " + expectedCount +
                    " required displays became available.");
            }
        });
        if (reason === "user")
            return _applyResult(false, "waiting", warnings);
        return _applyResult(true, null, warnings);
    }
    return _prepareAndApply(profile, reason, warnings, false);
}

/**
 * beginApply:
 * @profileId (string): stored profile id.
 * @options (object): {reason: "user" | "rollback"}.
 *
 * Runs the full transaction. The immediate return does not mean the apply
 * finished: verification lands on a settle timer, and a monitor wait can
 * defer the writes entirely.
 *
 * Returns (object): {started, failure?, warnings?}. started is false with
 * failure "busy" when another operation holds the lock, with a validation
 * error string, or (reason "user", insufficient monitors) with "waiting"
 * while the wait continues internally.
 */
function beginApply(profileId, options) {
    try {
        options = options || {};
        const reason = options.reason === "rollback"
            ? options.reason : "user";
        if (!_lock())
            return { started: false, failure: "busy" };

        /* 2. VALIDATING: load, migrate, validate (the store runs the
         * schema seam wired in setDependencies). */
        _setState(STATE_VALIDATING);
        const store = _profileStore();
        if (!store || typeof store.loadProfile !== "function") {
            _recordLastFailure("profile store unavailable");
            _failTerminal();
            return { started: false, failure: "profile store unavailable" };
        }
        const loaded = store.loadProfile(profileId);
        if (!loaded || loaded.error || !loaded.profile) {
            const failure = "profile load failed: " +
                (loaded ? loaded.error : "no result");
            _recordLastFailure(failure);
            _failTerminal();
            return { started: false, failure: failure };
        }
        return _continueApply(loaded.profile, reason);
    } catch (e) {
        _log("error", "beginApply failed", e);
        _handleApplyError(e, null, "user");
        return { started: false, failure: "apply failed" };
    }
}

/**
 * beginRollback:
 *
 * Loads backups/last-good.json and pushes it through the exact same
 * pipeline with reason "rollback". The saved recovery source stays
 * unchanged until a later user profile apply captures a new one.
 *
 * Returns (object): {started, failure?}.
 */
function beginRollback() {
    try {
        if (!_lock())
            return { started: false, failure: "busy" };
        _setState(STATE_VALIDATING);
        const store = _profileStore();
        if (!store || typeof store.readRollback !== "function") {
            _failTerminal();
            return { started: false, failure: "profile store unavailable" };
        }
        const bundle = store.readRollback();
        if (!bundle) {
            _setState(STATE_IDLE);
            _release();
            return { started: false, failure: "no rollback snapshot" };
        }
        /* Migrate before validating: a rollback written by an older
         * version is schema v1 and would otherwise fail the v2 checks
         * (kind/deskletConfigs). */
        const schema = _schema();
        let candidate = bundle;
        if (schema && typeof schema.migrate === "function") {
            try {
                const migrated = schema.migrate(bundle);
                if (migrated && migrated.profile)
                    candidate = migrated.profile;
            } catch (ignored) {
                /* validate below decides; the bundle passes as-is */
            }
        }
        const verdict = schema && typeof schema.validate === "function"
            ? schema.validate(candidate) : { ok: true, errors: [] };
        if (!verdict || !verdict.ok) {
            const failure = "rollback bundle invalid: " +
                (verdict && verdict.errors
                    ? verdict.errors.join("; ") : "unknown");
            _recordLastFailure(failure);
            _failTerminal();
            return { started: false, failure: failure };
        }
        return _continueApply(candidate, "rollback");
    } catch (e) {
        _log("error", "beginRollback failed", e);
        _handleApplyError(e, null, "rollback");
        return { started: false, failure: "rollback failed" };
    }
}

/**
 * resumePendingApply:
 *
 * Applet _init entry: if state.json carries a pendingApply (a previous
 * instance died during a transaction), inspect its durable phase. Every
 * incomplete phase restores the existing last-good snapshot from scratch.
 * List-writing phases first get a bounded grace period because Cinnamon can
 * construct the successor applet synchronously inside the old instance's
 * enabled-applets write. This lets the old call advance its durable marker;
 * a marker that remains incomplete still rolls back. A marker already in
 * verifying resumes verification only. The recovery source is never
 * replaced by either path. A verifying user marker whose target is gone is
 * cleared, failed once, and reported false.
 *
 * Returns (boolean): true when a verification was scheduled.
 */
function resumePendingApply(retryAttempt) {
    try {
        retryAttempt = Number.isFinite(Number(retryAttempt))
            ? Number(retryAttempt) : 0;
        if (_busy)
            return false;
        const store = _profileStore();
        if (!store || typeof store.getState !== "function")
            return false;
        const readTarget = function () {
            const durableState = store.getState();
            if (durableState === null)
                throw new Error("profile store is busy");
            const pending = durableState.pendingApply;
            let loaded = null;
            if (pending && pending.phase === "verifying" &&
                    pending.reason !== "rollback" &&
                    pending.reason !== "auto-rollback")
                loaded = store.loadProfile(pending.profileId);
            return { pending: pending, loaded: loaded };
        };
        let resumeRead = null;
        if (typeof store.withStoreLock === "function") {
            const locked = store.withStoreLock(readTarget);
            if (locked && locked.ok === true)
                resumeRead = locked.value;
        } else {
            try {
                resumeRead = readTarget();
            } catch (ignored) {
                resumeRead = null;
            }
        }
        if (resumeRead === null) {
            if (!_lock())
                return false;
            _setState(STATE_VALIDATING);
            const scheduled = _scheduleBoundedRetry(function (nextAttempt) {
                _release();
                resumePendingApply(nextAttempt);
            }, retryAttempt, "startup recovery read");
            if (!scheduled) {
                _log("error", "startup recovery state remained busy");
                _setState(STATE_FAILED);
                _setState(STATE_IDLE);
                _release();
            }
            return scheduled;
        }
        const pending = resumeRead.pending;
        if (!pending || typeof pending !== "object" ||
            typeof pending.reason !== "string")
            return false;

        if (_isListHandoffPhase(pending.phase) &&
                retryAttempt < _retryLimit()) {
            if (!_lock())
                return false;
            _suppressDirty = true;
            _setState(STATE_VALIDATING);
            const scheduled = _scheduleBoundedRetry(function (nextAttempt) {
                _release();
                resumePendingApply(nextAttempt);
            }, retryAttempt, "list handoff recovery");
            if (scheduled)
                return true;
            _suppressDirty = false;
            _release();
        }

        if (!_lock())
            return false;
        _suppressDirty = true;

        if (pendingPhaseNeedsRollback(pending.phase)) {
            return _beginAutomaticRollback(null,
                "incomplete transaction phase " + String(pending.phase), true);
        }

        if (pending.reason === "rollback" || pending.reason === "auto-rollback") {
            _cancelVerifyTimer();
            _setState(STATE_VERIFYING);
            _verifyTimerId = _scheduler().timeoutAdd(
                _const("VERIFY_SETTLE_MS", 1500),
                function () {
                    _verifyTimerId = null;
                    _runRollbackResume(pending);
                    return false;
                });
            return true;
        }

        const loaded = resumeRead.loaded;
        if (!loaded || loaded.error || !loaded.profile) {
            store.mutateState(function (s) {
                s.pendingApply = null;
            });
            _recordLastFailure("pending apply target profile is gone");
            _failTerminal();
            _log("warn", "pending apply target profile is gone");
            return false;
        }
        if (pending.targetSettings &&
                typeof pending.targetSettings === "object")
            loaded.profile.cinnamonSettings = pending.targetSettings;
        loaded.profile.includeDesklets = pending.includeDesklets === true;
        if (typeof pending.fingerprint === "string")
            loaded.profile.fingerprint = pending.fingerprint;
        _cancelVerifyTimer();
        _setState(STATE_VERIFYING);
        _verifyTimerId = _scheduler().timeoutAdd(
            _const("VERIFY_SETTLE_MS", 1500),
            function () {
                _verifyTimerId = null;
                _runVerification(loaded.profile, pending.reason);
                return false;
            });
        return true;
    } catch (e) {
        _log("error", "resumePendingApply failed", e);
        _failTerminal();
        return false;
    }
}

function _isListHandoffPhase(phase) {
    return phase === "writing-lists" || phase === "lists-written";
}

function pendingPhaseNeedsRollback(phase) {
    return phase !== "verifying";
}

/* Verification completion for a resumed rollback: the live fingerprint
 * must match the one recorded in the marker. */
function _runRollbackResume(pending, commitAttempt) {
    try {
        commitAttempt = Number.isFinite(Number(commitAttempt))
            ? Number(commitAttempt) : 0;
        const target = typeof pending.fingerprint === "string"
            ? pending.fingerprint : "";
        /* Rollback bundles written by this version carry kind "both"; a
         * marker left by an older version records a pre-desklet digest,
         * which "both" only reproduces on a desklet-free machine. That
         * crash-across-upgrade edge is accepted: one false warning, the
         * marker clears, the menu can restore again. */
        const live = _liveFingerprint("both");
        const store = _profileStore();
        if (target.length > 0 && live !== null && live === target) {
            const committed = store.mutateState(function (s) {
                s.pendingApply = null;
                s.activeProfileId = null;
                s.lastSuccessfulApply = _isoNow();
            });
            if (committed === null) {
                if (_scheduleBoundedRetry(function (nextAttempt) {
                    _runRollbackResume(pending, nextAttempt);
                }, commitAttempt, "rollback verification commit"))
                    return;
                _finishCommitFailure("rollback verified but state commit " +
                    "remained busy");
                return;
            }
            _suppressDirty = false;
            _setState(STATE_COMPLETE);
            _setState(STATE_IDLE);
            _release();
            _log("log", "resumed rollback verified");
            if (_notifySuccessEnabled())
                _notify("success", "Panel Profiles",
                    "Previous layout restored.");
        } else {
            _recordLastFailure("resumed rollback did not verify");
            store.mutateState(function (s) {
                s.pendingApply = null;
            });
            _suppressDirty = false;
            _setState(STATE_FAILED);
            _setState(STATE_IDLE);
            _release();
            _notify("warn", "Panel Profiles",
                "The previous layout could not be verified after " +
                "restoring. Try restoring it again from the menu.");
        }
    } catch (e) {
        _log("error", "rollback resume threw", e);
        _finishRollbackFailure(e);
    }
}

/**
 * computeCurrentFingerprint:
 * @kind (string): which family's slice of the world to digest ("panel" or
 *   "desklet"). Omitted, it falls back to whichever kind state.json
 *   considers active; with no readable active profile, "panel".
 *
 * Fingerprint of the live panel state for the applet's per-kind dirty
 * checks (the layout provider is never touched, so this is safe at any
 * time).
 *
 * Returns (string|null): hex sha256, or null when unevaluable.
 */
function computeCurrentFingerprint(includeDesklets) {
    if (typeof includeDesklets === "boolean")
        return _liveFingerprint(includeDesklets ? "both" : "panel");
    return _liveFingerprint(_activeKind());
}

/* Kind of whichever profile state.json considers active, for callers that
 * cannot say; "panel" when nothing loads. */
function _activeKind() {
    try {
        const store = _profileStore();
        if (store && typeof store.getState === "function") {
            const state = store.getState();
            const id = state.activeProfileId;
            if (id) {
                const loaded = store.loadProfile(id);
                if (loaded && loaded.profile)
                    return _kindOf(loaded.profile);
            }
        }
    } catch (ignored) {
    }
    return "panel";
}

/**
 * profileFingerprintOf:
 * @profile (object): loaded profile.
 *
 * The profile's digest recomputed from its OWN captured data under its
 * kind: settings part via the canonicalizer plus the sha256 list of the
 * configs its kind manages. Both digest comparisons (apply verification
 * and dirty tracking) use this instead of the stored fingerprint string,
 * which can go stale across kind migrations.
 *
 * Returns (string): hex sha256, or "" when unevaluable.
 */
function profileFingerprintOf(profile) {
    try {
        const fpMod = _fingerprintMod();
        const configStore = _configStore();
        if (!fpMod || !configStore)
            return "";
        const kind = _kindOf(profile);
        const configs = _kindIncludesPanels(kind)
            ? (profile.appletConfigs || []) : [];
        const deskletConfigs = _kindIncludesDesklets(kind)
            ? (profile.deskletConfigs || []) : [];
        return fpMod.computeFingerprint(profile,
            configStore.configHashList(configs.concat(deskletConfigs)),
            kind);
    } catch (ignored) {
        return "";
    }
}

/**
 * cancelAll:
 *
 * Cancels any monitor wait and verification timer, releases the lock and
 * settles to IDLE. state.json is left exactly as it is: a pendingApply
 * survives on purpose, because a reload may still resume it.
 */
function cancelAll(clearPending) {
    try {
        _cancelWaitHandle();
        _notifyWaitState(false, _lastMonitorCount, 0);
        _cancelVerifyTimer();
        _suppressDirty = false;
        _setState(STATE_IDLE);
        _release();
        if (clearPending === true) {
            const store = _profileStore();
            if (store && store.mutateState)
                store.mutateState(function (state) {
                    state.pendingApply = null;
                });
        }
    } catch (e) {
        _log("warn", "cancelAll failed: " + e);
        _release();
    }
}

/* Host-panel removal is expected while panels-enabled is being restored.
 * The actor may die, but module controller and durable marker must survive
 * until enabled-applets creates the successor manager instance. */
function shouldPreserveTransactionOnRemoval() {
    if (!_busy)
        return false;
    return _state === STATE_RESTORING_PANEL_SETTINGS ||
        _state === STATE_RESTORING_ENABLED_APPLETS;
}

/* ------------------------------------------------------------------ *
 * Save operations (same single-operation lock)
 * ------------------------------------------------------------------ */

function _commitSavedProfile(profile, attempt) {
    const store = _profileStore();
    const committed = store && store.mutateState
        ? store.mutateState(function (state) {
            state.activeProfileId = profile.id;
        }) : null;
    if (committed === null) {
        if (_scheduleBoundedRetry(function (nextAttempt) {
            _commitSavedProfile(profile, nextAttempt);
        }, attempt, "saved profile active commit"))
            return "retrying";
        _recordLastFailure("profile saved but active state commit remained busy");
        _setState(STATE_FAILED);
        _setState(STATE_IDLE);
        _release();
        _notify("warn", "Panel Profiles",
            "The profile was saved, but it could not be marked active. " +
            "Open the menu and load it when profile storage is available.");
        return "failed";
    }
    _onProfileSaved(profile);
    _setState(STATE_IDLE);
    _release();
    return "committed";
}

/**
 * beginSaveNew:
 * @name (string): candidate profile name (trimmed, capped here).
 * @includeDesklets (boolean): capture desklets with panel state.
 *
 * Capture-only: snapshot the live state into a brand-new profile. No
 * rollback is written and nothing is restored.
 *
 * Returns (object): {ok, profile?, reason?} with reason "busy" or
 * "invalid-name" on the guard failures.
 */
function beginSaveNew(name, includeDesklets) {
    try {
        if (!_lock())
            return { ok: false, reason: "busy" };
        const schema = _schema();
        const clean = schema && typeof schema.sanitizeName === "function"
            ? schema.sanitizeName(name) : null;
        if (clean === null) {
            _setState(STATE_IDLE);
            _release();
            return { ok: false, reason: "invalid-name" };
        }
        const k = includeDesklets === true ? "both" : "panel";
        _setState(STATE_SAVING);
        const bundle = _captureCurrent(k);
        const store = _profileStore();
        const profile = store.createFromSnapshot({
            name: clean,
            description: "",
            snapshot: bundle.snapshot.cinnamonSettings,
            configs: bundle.configs,
            deskletConfigs: bundle.deskletConfigs,
            includeDesklets: includeDesklets === true,
            configHashes: bundle.configHashes,
            topology: bundle.topology,
            fingerprint: _fingerprintOf(bundle),
            cinnamonVersion: _environment().cinnamonVersion,
            sessionType: _environment().sessionType
        });
        if (!profile)
            throw new Error("createFromSnapshot failed");
        const commitStatus = _commitSavedProfile(profile, 0);
        if (commitStatus === "failed")
            return { ok: false, profile: profile,
                reason: "active commit failed" };
        const result = { ok: true, profile: profile };
        if (commitStatus === "retrying")
            result.pendingCommit = true;
        return result;
    } catch (e) {
        _log("error", "beginSaveNew failed", e);
        _recordLastFailure("save failed: " +
            (e && e.message ? e.message : String(e)));
        _failTerminal();
        return { ok: false, reason: "save failed" };
    }
}

/**
 * beginSaveUpdate:
 * @profileId (string): existing profile to overwrite with the live state.
 *
 * Same capture as beginSaveNew routed through updateFromSnapshot, which
 * preserves id, createdAt, name, description and kind.
 *
 * Returns (object): {ok, profile?, reason?}.
 */
function beginSaveUpdate(profileId, includeDesklets) {
    try {
        if (!_lock())
            return { ok: false, reason: "busy" };
        _setState(STATE_SAVING);
        const store = _profileStore();
        const loaded = store.loadProfile(profileId);
        if (!loaded || loaded.error || !loaded.profile) {
            _failTerminal();
            return { ok: false, reason: "not-found" };
        }
        /* Re-capture under the profile's OWN kind: an update must not
         * silently widen (or narrow) what the profile manages. */
        const desiredInclude = typeof includeDesklets === "boolean"
            ? includeDesklets : loaded.profile.includeDesklets === true;
        const bundle = _captureCurrent(desiredInclude ? "both" : "panel");
        const updated = store.updateFromSnapshot(loaded.profile, {
            snapshot: bundle.snapshot.cinnamonSettings,
            configs: bundle.configs,
            deskletConfigs: bundle.deskletConfigs,
            includeDesklets: desiredInclude,
            topology: bundle.topology,
            fingerprint: _fingerprintOf(bundle)
        });
        if (!updated)
            throw new Error("updateFromSnapshot failed");
        const commitStatus = _commitSavedProfile(updated, 0);
        if (commitStatus === "failed")
            return { ok: false, profile: updated,
                reason: "active commit failed" };
        const result = { ok: true, profile: updated };
        if (commitStatus === "retrying")
            result.pendingCommit = true;
        return result;
    } catch (e) {
        _log("error", "beginSaveUpdate failed", e);
        _recordLastFailure("update failed: " +
            (e && e.message ? e.message : String(e)));
        _failTerminal();
        return { ok: false, reason: "update failed" };
    }
}

function _onProfileSaved(profile) {
    try {
        if (_deps && typeof _deps.onProfileSaved === "function")
            _deps.onProfileSaved(profile);
    } catch (ignored) {
        /* dirty-baseline reset is the applet's problem, not ours */
    }
}
