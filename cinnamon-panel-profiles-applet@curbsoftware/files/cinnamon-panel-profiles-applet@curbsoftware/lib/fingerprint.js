/* Panel Profiles fingerprint.
 *
 * One hash identifying "the panel state": the canonical settings part
 * (injected, produced by cinnamonState.fingerprintSettingsPart) plus the
 * sorted content hashes of the captured applet config files. Timestamps,
 * names, and descriptions never enter it, so an identical layout saved twice
 * fingerprints identically.
 *
 * No St/Clutter imports and no require() calls: loadable headless.
 *
 * Copyright (C) 2026 curbsoftware
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

/* Injected by applet.js: the canonicalizer (settings snapshot, scope ->
 * string) and the digest (text -> hex sha256). Defaults are null so this
 * module is safe standalone; without an injected digest the result is ""
 * and callers treat the fingerprint as unevaluable. */
let _canonicalize = null;
let _sha256 = null;

/**
 * setDependencies:
 * @deps (object): { canonicalize, sha256 }
 *
 * Production init and tests both call this. Unknown keys are ignored.
 */
function setDependencies(deps) {
    if (deps && typeof deps === "object") {
        if (typeof deps.canonicalize === "function")
            _canonicalize = deps.canonicalize;
        if (typeof deps.sha256 === "function")
            _sha256 = deps.sha256;
    }
}

/**
 * resetDependencies:
 *
 * Restores defaults. Test teardown helper.
 */
function resetDependencies() {
    _canonicalize = null;
    _sha256 = null;
}

/**
 * computeFingerprint:
 * @settingsSnapshot (object): capture/profile shape consumed by the
 *   injected canonicalizer.
 * @configHashes (array): sha256 hex strings of captured configs (applets
 *   and/or desklets per the kind).
 * @kind (string): profile kind forwarded to the canonicalizer so the
 *   settings part covers exactly what the profile restores. Omitted
 *   defaults to "panel" (the historical digest).
 *
 * Sorting the config hashes means the capture order of config files never
 * matters; only their content set does. With no configs the digest covers
 * the settings part alone (no dangling separator).
 *
 * Returns (string): lowercase hex sha256, or "" when dependencies are
 * missing or anything throws.
 */
function computeFingerprint(settingsSnapshot, configHashes, kind) {
    try {
        const part = _canonicalize
            ? String(_canonicalize(settingsSnapshot,
                kind === undefined ? "panel" : kind) || "") : "";
        const hashes = (Array.isArray(configHashes) ? configHashes : [])
            .map(function (h) { return String(h); })
            .sort();
        const text = hashes.length > 0
            ? part + "\x1f" + hashes.join("\x1f")
            : part;
        return _sha256 ? String(_sha256(text) || "") : "";
    } catch (e) {
        return "";
    }
}
