/* Panel Profiles constants and paths.
 *
 * Pure data plus a small self-uuid seam. No St/Clutter imports and no
 * require() calls: this module must stay loadable headless via
 * imports.searchPath so the dev-tools test harness can use it directly.
 *
 * Public names are declared with var/function so both the require()
 * auto-export inside Cinnamon and the plain imports.<mod> loader see them.
 *
 * Copyright (C) 2026 curbsoftware
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

const GLib = imports.gi.GLib;

/* Root for all applet-owned state. Everything we persist lives under here so
 * a user can wipe one directory to reset the applet completely. */
var STATE_DIR = GLib.get_user_config_dir() + "/cinnamon-panel-profiles";

/* Subdirectories of STATE_DIR and well-known file names. */
var PROFILES_SUBDIR = "profiles";
var BACKUPS_SUBDIR = "backups";
var STATE_FILE = "state.json";
var LAST_GOOD_FILE = "last-good.json";

/* Where Cinnamon keeps per-applet config JSON (~/.config/cinnamon/spices).
 * Restored relativePaths are resolved under this root after sanitization. */
var SPICES_CONFIG_ROOT = GLib.get_user_config_dir() + "/cinnamon/spices";

/* org.cinnamon keys captured into every profile, in fixed order.
 * panels-enabled is written last during restore (within the non-applet
 * phase) so new panels materialize with height and autohide already set.
 * enabled-applets is restored in its own final phase, never from here; so is
 * enabled-desklets (its own phase just before the applet write).
 *
 * The four desklet keys sit at the END of the list. Restore, verification
 * and fingerprinting filter them (and enabled-applets) through the
 * profile's kind, and with kind "panel" the fingerprint parts string
 * stays byte-identical to the pre-desklet digest: old profiles keep
 * verifying after the upgrade. Never reorder or interleave this list.
 *
 * panel-scale-text-icons is a BOOLEAN on Cinnamon 6.6, not `as`; the three
 * panel-zone-*-sizes keys are type `s` (one string variant holding the whole
 * JSON array) rather than `as`; enabled-desklets is `as`
 * ("uuid:instanceId:x:y"), the other desklet keys are i/b/i. Capture code
 * must read the type from the live variant, never from this list. */
var PANEL_SETTING_KEYS = [
    "panels-enabled",
    "enabled-applets",
    "panels-autohide",
    "panels-show-delay",
    "panels-hide-delay",
    "panels-height",
    "panel-scale-text-icons",
    "panel-zone-icon-sizes",
    "panel-zone-symbolic-icon-sizes",
    "panel-zone-text-sizes",
    "enabled-desklets",
    "desklet-decorations",
    "desklet-snap",
    "desklet-snap-interval"
];

/* The desklet half of the capture list. Only used for scope filtering;
 * capture itself walks PANEL_SETTING_KEYS. */
var DESKLET_SETTING_KEYS = [
    "enabled-desklets",
    "desklet-decorations",
    "desklet-snap",
    "desklet-snap-interval"
];

/**
 * scopeAllowsKey:
 * @includeDesklets: whether this profile also owns desklet state. The
 *   internal rollback path always passes true.
 * @key: org.cinnamon key name.
 *
 * Single source of truth for which captured keys a kind restores, verifies
 * and fingerprints. enabled-applets belongs to the panel family; the
 * desklet family is DESKLET_SETTING_KEYS; every other key is panel LAYOUT
 * (panels-enabled, heights, delays, zone sizes) and belongs to the panel
 * family too, so a desklet profile never touches it.
 *
 * Returns (boolean): whether the profile owns the key.
 */
function scopeAllowsKey(includeDesklets, key) {
    if (DESKLET_SETTING_KEYS.indexOf(key) !== -1)
        return includeDesklets === true;
    return true;
}

/* Compatibility exports for pre-v4 callers. New profile readers use the
 * boolean API above; these never write legacy fields. */
var KIND_VALUES = ["panel", "desklet"];
function normalizeKind(value) {
    return value === "desklet" || value === "both" ? value : "panel";
}
function scopeToKind(scope) {
    return scope === "desklets" ? "desklet" : "panel";
}
function kindIncludesPanels(kind) {
    return kind !== "desklet";
}
function kindIncludesDesklets(kind) {
    return kind === "desklet" || kind === "both";
}
function kindAllowsKey(kind, key) {
    if (DESKLET_SETTING_KEYS.indexOf(key) !== -1)
        return kindIncludesDesklets(kind);
    return kindIncludesPanels(kind);
}

/* Subset checked by post-restore verification. The zone-size keys hold
 * JSON-in-string with arbitrary key order, so they are canonicalized before
 * compare rather than string-compared; they are verified as part of the full
 * fingerprint instead of this quick list. */
var VERIFY_KEYS = [
    "panels-enabled",
    "enabled-applets",
    "panels-height",
    "panels-autohide"
];

/* v4 replaces profile kinds with one panel profile plus includeDesklets.
 * State v3 restores one activeProfileId and phase-aware pendingApply. */
var SCHEMA_VERSION = 4;
var STATE_SCHEMA_VERSION = 3;

/* Profile names: trimmed, non-empty, capped. */
var PROFILE_NAME_MAX = 80;

/* How many last-good-<n>.json rollback snapshots to keep. */

/* Private directory and file modes (0o700 = 448 decimal, 0o600 = 384). */
var DIR_MODE = 0o700;
var FILE_MODE = 0o600;

/* Timings. Stabilization default and settle window are in milliseconds;
 * settings UI exposes seconds for the user-facing ones. */
var STABILIZE_MS_DEFAULT = 2000;
var VERIFY_SETTLE_MS = 1500;
var DIRTY_DEBOUNCE_MS = 500;

/* ------------------------------------------------------------------ *
 * Self-uuid seam
 * ------------------------------------------------------------------ *
 * The applet injects its real uuid (metadata.uuid) at init so lib code can
 * exclude itself from config capture. Tests inject a stub. Never hardcode
 * the uuid at call sites. */

let _selfUuid = "cinnamon-panel-profiles-applet@curbsoftware";

/**
 * setDependencies:
 * @deps (object): { selfUuid }
 *
 * Production init and tests both call this. Unknown keys are ignored.
 */
function setDependencies(deps) {
    if (deps && typeof deps.selfUuid === "string" && deps.selfUuid.length > 0)
        _selfUuid = deps.selfUuid;
}

/**
 * resetDependencies:
 *
 * Restores the default self-uuid. Test teardown helper.
 */
function resetDependencies() {
    _selfUuid = "cinnamon-panel-profiles-applet@curbsoftware";
}

/**
 * selfUuid:
 *
 * Returns (string): the uuid treated as "this applet" for exclusion rules.
 */
function selfUuid() {
    return _selfUuid;
}
