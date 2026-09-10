// Pure decision logic for the "Flow Soft Landing" feature.
//
// This module has no GJS/St/Clutter dependencies, so the decision that drives
// the whole feature — when a finished focus pomodoro should turn into a break
// versus keep the user in flow — is unit-testable under plain node or gjs
// (see tests/js/flow.test.js).
//
// flowLandingDecision(state) -> "break-now" | "wait" | "extend"
//   state = {
//     enabled,           // is soft landing switched on?
//     behavior,          // "wait" (hold for a natural pause) | "extend" (quietly add time)
//     idleMs,            // how long the user has been idle right now
//     pauseThresholdMs,  // idle >= this counts as a natural pause
//     graceElapsedMs,    // total time spent in soft landing since the pomodoro ended
//     graceCapMs         // hard ceiling on the soft landing
//   }
//
// Rules, in priority order:
//   1. feature off                  -> break-now (classic behaviour)
//   2. grace cap reached            -> break-now (hard ceiling, both modes)
//   3. user paused (idle >= thresh) -> break-now (a natural stopping point)
//   4. otherwise                    -> "extend" in extend mode, else "wait"
//
// Loaded by applet.js through the same dual pattern as constants.js/recommend.js:
//   - Cinnamon runtime: imports.ui.appletManager.applets[UUID].flow
//   - node / require():  module.exports below

// Coerce any input to a finite, non-negative number. Non-numbers, NaN and
// Infinity become 0; negatives clamp to 0. This keeps a misconfigured or
// missing value from producing a surprising decision: a 0 cap, for example,
// simply means "no grace", which falls back to today's break-now behaviour.
function _flowNum(x) {
    var n = Number(x);
    if (!isFinite(n) || n < 0) {
        return 0;
    }
    return n;
}

function flowLandingDecision(state) {
    state = state || {};

    if (!state.enabled) {
        return "break-now";
    }

    var graceElapsedMs = _flowNum(state.graceElapsedMs);
    var graceCapMs = _flowNum(state.graceCapMs);
    if (graceElapsedMs >= graceCapMs) {
        return "break-now";
    }

    var idleMs = _flowNum(state.idleMs);
    var pauseThresholdMs = _flowNum(state.pauseThresholdMs);
    if (idleMs >= pauseThresholdMs) {
        return "break-now";
    }

    return (state.behavior === "extend") ? "extend" : "wait";
}

// Convert the "natural pause" setting (seconds) to milliseconds, with a safe
// default + minimum: a non-positive or non-numeric value falls back to 20s.
// Kept here (pure) so the conversion is unit-tested alongside the decision.
function flowPauseThresholdMs(seconds) {
    var s = Number(seconds);
    if (!isFinite(s) || s <= 0) {
        s = 20;
    }
    return Math.round(s * 1000);
}

// Convert the soft-landing limit (minutes) to milliseconds, with a safe
// default + minimum: a non-positive or non-numeric value falls back to 10m.
function flowGraceCapMs(minutes) {
    var m = Number(minutes);
    if (!isFinite(m) || m <= 0) {
        m = 10;
    }
    return Math.round(m * 60 * 1000);
}

// Node / CommonJS export for the test runner. In the Cinnamon (GJS) runtime
// `module` is undefined, so the top-level `var` is exposed via imports instead.
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        flowLandingDecision: flowLandingDecision,
        flowPauseThresholdMs: flowPauseThresholdMs,
        flowGraceCapMs: flowGraceCapMs
    };
}
