/* Panel Profiles monitor topology.
 *
 * Reads the live monitor set through an injectable layout provider, matches
 * saved profile monitors against it, and runs the event-driven wait used by
 * startup recovery. The composition root injects a wrapper around
 * Main.layoutManager ({getCount, getMonitors, getPrimaryIndex, connect,
 * disconnect}); this file never imports Main or anything St/Clutter-shaped,
 * so with nothing injected every function degrades to safe failures
 * (0 monitors, empty maps, a wait that simply times out).
 *
 * waitForTopology is signal-driven plus exactly two timers: a stabilization
 * timer that restarts on churn and one hard timeout. It never polls.
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
 * Dependency seam
 * ------------------------------------------------------------------ */

let _deps = null;

/**
 * setDependencies:
 * @deps (object): { layoutProvider, logger, scheduler }
 *
 * layoutProvider: {getCount() -> int, getMonitors() -> [{index, x, y,
 *   width, height, name, scale?}], getPrimaryIndex() -> int, connect(cb)
 *   -> id, disconnect(id)}. scheduler: {timeoutAdd(ms, fn) -> id,
 *   sourceRemove(id)}. Unknown keys are ignored.
 */
function setDependencies(deps) {
    _deps = (deps && typeof deps === "object") ? deps : null;
}

/**
 * resetDependencies:
 *
 * Restores defaults. Test teardown helper.
 */
function resetDependencies() {
    _deps = null;
}

function _log(level, msg) {
    try {
        const logger = _deps && _deps.logger;
        if (logger && typeof logger[level] === "function")
            logger[level](msg);
    } catch (ignored) {
        /* logging must never take the caller down */
    }
}

/* The lazy default scheduler wraps imports.mainloop, which is part of the
 * plain gjs runtime (no session needed). Created on first use only. */
let _defaultScheduler = null;

function _scheduler() {
    if (_deps && _deps.scheduler)
        return _deps.scheduler;
    if (!_defaultScheduler) {
        _defaultScheduler = {
            timeoutAdd: function (ms, fn) {
                return imports.mainloop.timeout_add(
                    GLib.PRIORITY_DEFAULT, ms, fn);
            },
            sourceRemove: function (id) {
                imports.mainloop.source_remove(id);
            }
        };
    }
    return _defaultScheduler;
}

/* The lazy default layout provider. The composition root always injects the
 * Main.layoutManager wrapper, so this is only a fallback: it probes monitor
 * sources that are ALREADY reachable on the global object (Meta exposes
 * them without loading any ui module) and never imports ui.*, so St and
 * Clutter cannot load through this file. Headless runs find nothing, the
 * provider stays null, and every caller sees a safe failure. */
function _defaultLayoutProvider() {
    try {
        if (typeof global === "undefined" || !global)
            return null;
        const source = global.layout_manager || global.screen || global.display;
        if (!source)
            return null;
        if (typeof source.get_n_monitors === "function") {
            /* Meta.Screen shape (legacy muffin). */
            return {
                getCount: function () { return source.get_n_monitors(); },
                getMonitors: function () {
                    const out = [];
                    for (let i = 0; i < source.get_n_monitors(); i++) {
                        const r = source.get_monitor_geometry(i);
                        out.push({
                            index: i, x: r.x, y: r.y,
                            width: r.width, height: r.height, name: ""
                        });
                    }
                    return out;
                },
                getPrimaryIndex: function () {
                    return source.get_primary_monitor();
                },
                connect: function (cb) {
                    return source.connect("monitors-changed", cb);
                },
                disconnect: function (id) {
                    source.disconnect(id);
                }
            };
        }
        if (typeof source.get_monitor_count === "function") {
            /* Meta.MonitorManager shape. */
            return {
                getCount: function () { return source.get_monitor_count(); },
                getMonitors: function () {
                    return Array.isArray(source.monitors) ? source.monitors : [];
                },
                getPrimaryIndex: function () {
                    return typeof source.get_primary_monitor === "function"
                        ? source.get_primary_monitor() : 0;
                },
                connect: function (cb) {
                    return source.connect("monitors-changed", cb);
                },
                disconnect: function (id) {
                    source.disconnect(id);
                }
            };
        }
    } catch (ignored) {
        /* probing global must never throw out */
    }
    return null;
}

function _provider() {
    if (_deps && _deps.layoutProvider)
        return _deps.layoutProvider;
    return _defaultLayoutProvider();
}

/* ------------------------------------------------------------------ *
 * Topology reads
 * ------------------------------------------------------------------ */

/**
 * getCurrentTopology:
 *
 * Snapshots the live monitor set.
 *
 * Returns (object): {expectedCount, monitors: [{savedIndex, primary, x, y,
 * width, height, name, scale}]}. savedIndex is the live monitor index,
 * primary comes from the provider's primary index, and scale defaults to 1
 * (Cinnamon 6.6 monitors carry no scale field). With no reachable provider
 * the result is {expectedCount: 0, monitors: []}.
 */
function getCurrentTopology() {
    const empty = { expectedCount: 0, monitors: [] };
    try {
        const provider = _provider();
        if (!provider || typeof provider.getMonitors !== "function")
            return empty;
        const raw = provider.getMonitors();
        if (!Array.isArray(raw))
            return empty;
        let primaryIndex = -1;
        if (typeof provider.getPrimaryIndex === "function") {
            const p = parseInt(provider.getPrimaryIndex(), 10);
            if (Number.isFinite(p))
                primaryIndex = p;
        }
        const monitors = raw.map(function (m, position) {
            m = (m && typeof m === "object") ? m : {};
            const index = Number.isFinite(m.index) ? m.index : position;
            return {
                savedIndex: index,
                primary: index === primaryIndex,
                x: Number.isFinite(m.x) ? m.x : 0,
                y: Number.isFinite(m.y) ? m.y : 0,
                width: Number.isFinite(m.width) ? m.width : 0,
                height: Number.isFinite(m.height) ? m.height : 0,
                name: typeof m.name === "string" ? m.name : "",
                scale: (m.scale && Number.isFinite(Number(m.scale)))
                    ? Number(m.scale) : 1
            };
        });
        return { expectedCount: monitors.length, monitors: monitors };
    } catch (e) {
        _log("warn", "getCurrentTopology failed: " + e);
        return empty;
    }
}

/**
 * getMonitorCount:
 *
 * Returns (int): the live monitor count, 0 when no provider is reachable.
 */
function getMonitorCount() {
    try {
        const provider = _provider();
        if (!provider)
            return 0;
        if (typeof provider.getCount === "function") {
            const n = parseInt(provider.getCount(), 10);
            if (Number.isFinite(n) && n >= 0)
                return n;
        }
        if (typeof provider.getMonitors === "function") {
            const list = provider.getMonitors();
            if (Array.isArray(list))
                return list.length;
        }
    } catch (e) {
        _log("warn", "getMonitorCount failed: " + e);
    }
    return 0;
}

/**
 * topologySatisfies:
 * @current: live topology object (or a bare count).
 * @required: required topology object (or a bare count).
 *
 * Returns (boolean): true only when the current count is at least the
 * required count. Anything unreadable is unsatisfied (fail closed: a
 * two-head profile never applies onto an unknown topology).
 */
function topologySatisfies(current, required) {
    try {
        const have = (typeof current === "number")
            ? current
            : (current && Number.isFinite(Number(current.expectedCount))
                ? Number(current.expectedCount) : -1);
        const need = (typeof required === "number")
            ? required
            : (required && Number.isFinite(Number(required.expectedCount))
                ? Number(required.expectedCount) : -1);
        return have >= 0 && need >= 0 && have >= need;
    } catch (e) {
        _log("warn", "topologySatisfies failed: " + e);
        return false;
    }
}

/* ------------------------------------------------------------------ *
 * Saved-to-current matching
 * ------------------------------------------------------------------ */

/**
 * mapSavedMonitorsToCurrent:
 * @profileTopologyObj: a profile's monitorTopology ({monitors: [...]}).
 *
 * Best-effort logical pairing of saved monitors onto live ones, strongest
 * evidence first: exact name, then primary flag, then exact geometry
 * (x, y, width, height), then saved index. Each round walks the saved
 * monitors in array order and claims the best still-free live monitor
 * (exact index match preferred, then the lowest index), so the result is
 * deterministic and no live monitor is spent on a weak match while a
 * stronger round still needs it.
 *
 * Returns (object): {indexMap: {savedIndex: currentIndex},
 * unmatched: [savedIndex]}. With no live monitors everything is unmatched.
 */
function mapSavedMonitorsToCurrent(profileTopologyObj) {
    const result = { indexMap: {}, unmatched: [], ambiguous: [] };
    try {
        const saved = (profileTopologyObj &&
            Array.isArray(profileTopologyObj.monitors))
            ? profileTopologyObj.monitors : [];
        const current = getCurrentTopology().monitors;

        const used = {};
        const matched = {};
        const blocked = {};
        const savedIndexCounts = {};
        const currentIndexCounts = {};
        saved.forEach(function (sm) {
            savedIndexCounts[sm.savedIndex] =
                (savedIndexCounts[sm.savedIndex] || 0) + 1;
        });
        current.forEach(function (cm) {
            currentIndexCounts[cm.savedIndex] =
                (currentIndexCounts[cm.savedIndex] || 0) + 1;
        });
        function markAmbiguous(savedIndex) {
            blocked[savedIndex] = true;
            if (result.ambiguous.indexOf(savedIndex) === -1)
                result.ambiguous.push(savedIndex);
        }
        saved.forEach(function (sm) {
            if (savedIndexCounts[sm.savedIndex] > 1 ||
                    currentIndexCounts[sm.savedIndex] > 1)
                markAmbiguous(sm.savedIndex);
        });
        /* The primary-flag round only carries information when the live
         * topology actually names a primary: without one, "not primary"
         * would match every monitor and starve the stronger geometry
         * round below. */
        const hasCurrentPrimary = current.some(function (cm) {
            return !!cm.primary;
        });

        function claim(savedIndex, candidates) {
            let best = null;
            candidates.forEach(function (cur) {
                if (used[cur.savedIndex])
                    return;
                if (best === null) {
                    best = cur;
                    return;
                }
                const curExact = cur.savedIndex === savedIndex ? 1 : 0;
                const bestExact = best.savedIndex === savedIndex ? 1 : 0;
                if (curExact > bestExact ||
                    (curExact === bestExact && cur.savedIndex < best.savedIndex))
                    best = cur;
            });
            if (best !== null) {
                used[best.savedIndex] = true;
                matched[savedIndex] = true;
                result.indexMap[savedIndex] = best.savedIndex;
            }
        }

        function claimUnique(savedIndex, candidates) {
            const available = candidates.filter(function (cur) {
                return !used[cur.savedIndex];
            });
            if (available.length <= 1) {
                claim(savedIndex, available);
                return;
            }
            const exact = available.filter(function (cur) {
                return cur.savedIndex === savedIndex;
            });
            if (exact.length === 1) {
                claim(savedIndex, exact);
                return;
            }
            markAmbiguous(savedIndex);
        }

        saved.forEach(function (sm) {
            if (matched[sm.savedIndex] || blocked[sm.savedIndex] ||
                typeof sm.name !== "string" || sm.name.length === 0)
                return;
            claimUnique(sm.savedIndex, current.filter(function (cm) {
                return cm.name === sm.name;
            }));
        });
        saved.forEach(function (sm) {
            if (matched[sm.savedIndex] || blocked[sm.savedIndex] ||
                    !hasCurrentPrimary || !sm.primary)
                return;
            claim(sm.savedIndex, current.filter(function (cm) {
                return !!cm.primary;
            }));
        });
        saved.forEach(function (sm) {
            if (matched[sm.savedIndex] || blocked[sm.savedIndex])
                return;
            const candidates = current.filter(function (cm) {
                return !used[cm.savedIndex] && cm.x === sm.x && cm.y === sm.y &&
                    cm.width === sm.width && cm.height === sm.height;
            });
            claimUnique(sm.savedIndex, candidates);
        });
        saved.forEach(function (sm) {
            if (matched[sm.savedIndex] || blocked[sm.savedIndex])
                return;
            claim(sm.savedIndex, current.filter(function (cm) {
                return cm.savedIndex === sm.savedIndex;
            }));
        });

        saved.forEach(function (sm) {
            if (!matched[sm.savedIndex])
                result.unmatched.push(sm.savedIndex);
        });
    } catch (e) {
        _log("warn", "mapSavedMonitorsToCurrent failed: " + e);
        return { indexMap: {}, unmatched: [], ambiguous: [] };
    }
    return result;
}

/* ------------------------------------------------------------------ *
 * The wait
 * ------------------------------------------------------------------ */

/**
 * waitForTopology:
 * @requiredCount (int): monitor count that must be reached.
 * @options (object): {stabilizeMs, timeoutMs, onReady, onTimeout,
 *   onProgress}. onProgress(count, requiredCount) fires on every
 *   monitors-changed event; onReady exactly once when the count has been
 *   sufficient and unchanged for stabilizeMs; onTimeout exactly once when
 *   the hard timeout elapses first. All callbacks are guarded.
 *
 * Event-driven: one provider signal plus two timers (stabilization,
 * restarts on churn; hard timeout). Never polls.
 *
 * Returns (object): {cancel()}. Idempotent; after cancel (or after
 * ready/timeout) no further callbacks fire.
 */
function waitForTopology(requiredCount, options) {
    const handle = { cancel: function () {} };
    try {
        options = options || {};
        const need = parseInt(requiredCount, 10);
        if (!Number.isFinite(need) || need < 1) {
            /* Nothing to wait for counts as unsatisfiable input: fire the
             * timeout path once rather than arming a pointless wait. */
            try {
                if (typeof options.onTimeout === "function")
                    options.onTimeout();
            } catch (ignored) {
                /* a throwing callback must not escape */
            }
            return handle;
        }
        const stabilizeMs = Number.isFinite(Number(options.stabilizeMs)) &&
            Number(options.stabilizeMs) >= 0 ? Number(options.stabilizeMs) : 2000;
        const timeoutMs = Number.isFinite(Number(options.timeoutMs)) &&
            Number(options.timeoutMs) > 0 ? Number(options.timeoutMs) : 60000;
        const scheduler = _scheduler();

        let finished = false;
        let cancelled = false;
        let stabilizeId = null;
        let timeoutId = null;
        let signalId = null;
        let provider = null;

        function _guarded(fn, a, b) {
            try {
                if (typeof fn === "function")
                    fn(a, b);
            } catch (e) {
                _log("warn", "waitForTopology callback threw: " + e);
            }
        }

        function _removeStabilize() {
            if (stabilizeId !== null) {
                try {
                    scheduler.sourceRemove(stabilizeId);
                } catch (ignored) {
                }
                stabilizeId = null;
            }
        }

        function _cleanup() {
            _removeStabilize();
            if (timeoutId !== null) {
                try {
                    scheduler.sourceRemove(timeoutId);
                } catch (ignored) {
                }
                timeoutId = null;
            }
            if (provider && signalId !== null) {
                try {
                    provider.disconnect(signalId);
                } catch (ignored) {
                }
                signalId = null;
            }
        }

        function _finish(cb) {
            if (finished || cancelled)
                return;
            finished = true;
            _cleanup();
            _guarded(cb);
        }

        function _startStabilize() {
            /* Also the churn path: any change restarts the window. */
            _removeStabilize();
            stabilizeId = scheduler.timeoutAdd(stabilizeMs, function () {
                stabilizeId = null;
                if (finished || cancelled)
                    return false;
                if (getMonitorCount() >= need)
                    _finish(options.onReady);
                return false;
            });
        }

        function _onChange() {
            if (finished || cancelled)
                return;
            const count = getMonitorCount();
            _guarded(options.onProgress, count, need);
            if (count >= need)
                _startStabilize();
            else
                _removeStabilize();
        }

        provider = _provider();
        if (provider && typeof provider.connect === "function")
            signalId = provider.connect(_onChange);

        timeoutId = scheduler.timeoutAdd(timeoutMs, function () {
            timeoutId = null;
            if (finished || cancelled)
                return false;
            _finish(options.onTimeout);
            return false;
        });

        /* Initial evaluation is not a change: no onProgress, but a
         * sufficient starting count opens the stabilization window. */
        if (getMonitorCount() >= need)
            _startStabilize();

        handle.cancel = function () {
            if (finished || cancelled)
                return;
            cancelled = true;
            _cleanup();
        };
    } catch (e) {
        _log("warn", "waitForTopology failed: " + e);
    }
    return handle;
}
