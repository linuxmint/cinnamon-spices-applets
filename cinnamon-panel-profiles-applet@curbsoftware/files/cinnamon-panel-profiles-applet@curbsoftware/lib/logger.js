/* Panel Profiles logging.
 *
 * One prefix, three levels, and a hard rule: never log config contents or
 * absolute home paths. Callers pass short fixed labels; this module never
 * inspects payloads.
 *
 * No St/Clutter imports and no require() calls: stays loadable headless
 * (print/printerr fallback) so dev-tools tests get output too.
 *
 * Copyright (C) 2026 curbsoftware
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

const GLib = imports.gi.GLib;

const LOG_PREFIX = "[PanelProfiles] ";
const WARN_PREFIX = "[PanelProfiles][WARN] ";
const ERROR_PREFIX = "[PanelProfiles][ERROR] ";

/* Absolute home paths never appear in log output: GIO exception text can
 * embed them, so every emitted line gets the home prefix folded to "~". */
function _scrub(text) {
    try {
        const home = GLib.get_home_dir();
        if (home && home.length > 1 && text.indexOf(home) !== -1)
            return text.split(home).join("~");
    } catch (ignored) {
    }
    return text;
}

/* Debug gate. log() is the only level behind it; warn/error always emit. */
let _debug = false;

/**
 * setDependencies:
 * @deps (object): { debug }
 *
 * Test/init seam. Unknown keys are ignored.
 */
function setDependencies(deps) {
    if (deps && typeof deps.debug === "boolean")
        _debug = deps.debug;
}

/**
 * resetDependencies:
 *
 * Restores defaults. Test teardown helper.
 */
function resetDependencies() {
    _debug = false;
}

/**
 * setDebug:
 * @value (boolean): enable or disable debug-level logging.
 */
function setDebug(value) {
    _debug = !!value;
}

/**
 * isDebugEnabled:
 *
 * Returns (boolean): current debug gate state.
 */
function isDebugEnabled() {
    return _debug;
}

/* Emit through Cinnamon's logger when we run inside the session, otherwise
 * fall back to the gjs console printers. Both paths are wrapped so a logging
 * failure can never propagate into a signal handler. */
function _emit(text, isError) {
    text = _scrub(text);
    try {
        if (typeof global !== "undefined" && global &&
            (isError ? typeof global.logError === "function"
                     : typeof global.log === "function")) {
            if (isError)
                global.logError(text);
            else
                global.log(text);
            return;
        }
    } catch (ignored) {
        /* fall through to print */
    }
    try {
        if (isError && typeof printerr === "function")
            printerr(text);
        else if (typeof print === "function")
            print(text);
    } catch (ignored) {
        /* nothing left to try; swallow rather than throw */
    }
}

/**
 * log:
 * @msg (string): debug-level message.
 *
 * Emitted only while debug logging is enabled.
 */
function log(msg) {
    if (!_debug)
        return;
    _emit(LOG_PREFIX + String(msg), false);
}

/**
 * warn:
 * @msg (string): warning-level message.
 */
function warn(msg) {
    _emit(WARN_PREFIX + String(msg), true);
}

/**
 * error:
 * @msg (string): error-level message.
 * @e (Error|string, optional): exception or detail appended after ": ".
 */
function error(msg, e) {
    let text = ERROR_PREFIX + String(msg);
    if (e !== undefined && e !== null)
        text += ": " + (e && e.message ? e.message : String(e));
    _emit(text, true);
}
