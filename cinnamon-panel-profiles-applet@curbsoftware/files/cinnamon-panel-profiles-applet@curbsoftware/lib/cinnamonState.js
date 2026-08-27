/* Panel Profiles capture core: org.cinnamon panel state.
 *
 * Everything GSettings-shaped lives here: the variant codec (print/parse),
 * capture of the panel keys, restore, verification, the parsers for
 * panels-enabled and enabled-applets, canonicalization for fingerprinting,
 * and the manager-anchor repair described in the plan.
 *
 * Values are preserved verbatim: capture stores the variant's print string
 * and its live type tag, restore parses the stored type back into a variant
 * and writes it untouched. Renumbering, regenerating, or normalizing stored
 * entries is deliberately avoided; the only synthetic value this module ever
 * produces is the anchor entry from ensureManagerAnchor.
 *
 * Every public function catches exceptions and returns a failure value so
 * nothing throws into a GObject signal handler.
 *
 * No St/Clutter imports and no require() calls: loadable headless via
 * imports.searchPath so dev-tools tests can drive everything with a fake
 * settings provider.
 *
 * Copyright (C) 2026 curbsoftware
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

const GLib = imports.gi.GLib;

/* ------------------------------------------------------------------ *
 * Dependency seam
 * ------------------------------------------------------------------ *
 *
 * Production injects { selfUuid, settingsProvider, logger } (and optionally
 * the constants module) from applet.js. Defaults resolve lazily so a
 * headless import with nothing injected still works: the settings provider
 * becomes the real Gio.Settings on org.cinnamon, selfUuid and the panel key
 * list come from the constants module when lib/ is on imports.searchPath,
 * and the logger defaults to silent. */

let _deps = null;
let _defaultSettings = null;

function setDependencies(deps) {
    _deps = (deps && typeof deps === "object") ? deps : null;
}

function resetDependencies() {
    _deps = null;
    _defaultSettings = null;
}

function _settings() {
    if (_deps && _deps.settingsProvider)
        return _deps.settingsProvider;
    if (!_defaultSettings) {
        const Gio = imports.gi.Gio;
        _defaultSettings = new Gio.Settings({ schema_id: "org.cinnamon" });
    }
    return _defaultSettings;
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

/* The constants module, when it can be reached. Headless tests put lib/ on
 * imports.searchPath so imports.constants resolves; inside Cinnamon the
 * composition root passes the module in via setDependencies({constants}). */
function _constants() {
    if (_deps && _deps.constants)
        return _deps.constants;
    try {
        return imports.constants;
    } catch (ignored) {
        return null;
    }
}

function _panelKeys() {
    const c = _constants();
    return (c && c.PANEL_SETTING_KEYS) ? c.PANEL_SETTING_KEYS : null;
}

/* Kind gate for restore/verify/fingerprint. With the constants module
 * unreachable, mirror its rules inline (panel layout keys and the applet
 * list belong to the panel family; the desklet keys to the desklet
 * family; the internal "both" kind owns everything). */
function _kindAllowsKey(includeDesklets, key) {
    const c = _constants();
    if (includeDesklets === "desklet") {
        return c && c.DESKLET_SETTING_KEYS
            ? c.DESKLET_SETTING_KEYS.indexOf(key) !== -1
            : key.indexOf("desklet") !== -1;
    }
    if (c && typeof c.scopeAllowsKey === "function")
        return c.scopeAllowsKey(includeDesklets === true ||
            includeDesklets === "both", key);
    const isDeskletKey = key === "enabled-desklets" ||
        key === "desklet-decorations" || key === "desklet-snap" ||
        key === "desklet-snap-interval";
    if (isDeskletKey)
        return includeDesklets === true || includeDesklets === "both";
    return true;
}

function _selfUuid() {
    if (_deps && typeof _deps.selfUuid === "string" && _deps.selfUuid.length > 0)
        return _deps.selfUuid;
    const c = _constants();
    if (c && typeof c.selfUuid === "function") {
        const uuid = c.selfUuid();
        if (uuid)
            return uuid;
    }
    return "cinnamon-panel-profiles-applet@curbsoftware";
}

/* ------------------------------------------------------------------ *
 * Variant codec
 * ------------------------------------------------------------------ */

/**
 * variantToString:
 * @v (GLib.Variant): variant to serialize.
 *
 * Returns (string|null): the type-annotated print form, or null if printing
 * throws (null input included). This is the exact string stored in profiles.
 */
function variantToString(v) {
    try {
        if (!v || typeof v.print !== "function")
            return null;
        return v.print(true);
    } catch (e) {
        _log("warn", "variantToString failed: " + e);
        return null;
    }
}

/**
 * parseVariant:
 * @typeStr (string|null): GVariant type tag ("as", "b", ...) or null to
 *   accept any type.
 * @str (string): variant print form, as produced by variantToString.
 *
 * Returns (GLib.Variant|null): the parsed variant, or null on any failure
 * (bad input, type mismatch, parser error). A stored type tag makes the
 * parse strict: a corrupted profile cannot smuggle in a differently-typed
 * value.
 */
function parseVariant(typeStr, str) {
    try {
        if (typeof str !== "string" || str.length === 0)
            return null;
        let type = null;
        if (typeof typeStr === "string" && typeStr.length > 0)
            type = new GLib.VariantType(typeStr);
        return GLib.Variant.parse(type, str, null, null);
    } catch (e) {
        _log("warn", "parseVariant failed: " + e);
        return null;
    }
}

/**
 * getRaw:
 * @key (string): org.cinnamon key name.
 *
 * Returns (string|null): the key's live value as a variant print string, or
 * null when the key is missing from the schema or unreadable.
 */
function getRaw(key) {
    try {
        return variantToString(_settings().get_value(key));
    } catch (e) {
        return null;
    }
}

/* ------------------------------------------------------------------ *
 * Capture / restore / verify
 * ------------------------------------------------------------------ */

/**
 * captureSettings:
 *
 * Captures every PANEL_SETTING_KEYS key from the live settings.
 *
 * Returns (object): { cinnamonSettings: {key: {type, value}}, missingKeys }
 * with type taken from the live variant (never hardcoded; Cinnamon has
 * flipped key types between releases) and value the verbatim print string.
 * Missing keys land in missingKeys and are simply absent from the map, so a
 * profile captured on one Cinnamon restores cleanly on another that lacks a
 * key. Returns an empty capture (all keys missing) if the key list itself
 * cannot be resolved.
 */
function captureSettings() {
    const result = { cinnamonSettings: {}, missingKeys: [] };
    try {
        const keys = _panelKeys();
        if (!keys) {
            _log("error", "captureSettings: constants module unreachable");
            return result;
        }
        const settings = _settings();
        keys.forEach(function (key) {
            try {
                const variant = settings.get_value(key);
                const text = variantToString(variant);
                if (text === null) {
                    result.missingKeys.push(key);
                    return;
                }
                result.cinnamonSettings[key] = {
                    type: variant.get_type_string(),
                    value: text
                };
            } catch (ignored) {
                result.missingKeys.push(key);
            }
        });
    } catch (e) {
        _log("error", "captureSettings failed: " + e);
    }
    return result;
}

/* Snapshot keys to restore in the no-list phase: every captured key except
 * enabled-applets and enabled-desklets (their own phases; the desklet list
 * writes just before the applet list), panels-enabled forced last so new
 * panels materialize with height and autohide already set. Keys outside the
 * snapshot's scope are dropped here, silently: they were captured verbatim
 * for portability, never meant to restore. Keys the live schema lacks are
 * skipped by the caller-visible loop below. */
function _orderedRestoreKeys(store, kind) {
    const keys = _panelKeys();
    const allowed = function (k) {
        return _kindAllowsKey(kind, k);
    };
    const present = keys
        ? keys.filter(function (k) {
            return k !== "enabled-applets" && k !== "enabled-desklets" &&
                k !== "panels-enabled" && store[k] && allowed(k);
        })
        : Object.keys(store).filter(function (k) {
            return k !== "enabled-applets" && k !== "enabled-desklets" &&
                k !== "panels-enabled" && allowed(k);
        });
    /* Anything captured outside the constants list (future schema) still
     * restores, after the known property keys. */
    if (keys) {
        Object.keys(store).forEach(function (k) {
            if (keys.indexOf(k) === -1 && k !== "enabled-applets" &&
                k !== "enabled-desklets" && k !== "panels-enabled" &&
                store[k] && allowed(k))
                present.push(k);
        });
    }
    if (store["panels-enabled"] && allowed("panels-enabled"))
        present.push("panels-enabled");
    return present;
}

function _targetPanelIds(store) {
    try {
        const rec = store && store["panels-enabled"];
        const variant = rec && parseVariant(rec.type, rec.value);
        if (!variant || variant.get_type_string() !== "as")
            return null;
        const ids = {};
        parsePanelsEnabled(variant.get_strv()).panels.forEach(function (panel) {
            ids[panel.id] = true;
        });
        return ids;
    } catch (ignored) {
        return null;
    }
}

function _isPanelScopedSetting(key) {
    return ["panels-autohide", "panels-show-delay", "panels-hide-delay",
        "panels-height"].indexOf(key) !== -1 ||
        key.indexOf("panel-zone-") === 0;
}

function _filterPanelScopedValue(key, value, panelIds) {
    try {
        const variant = parseVariant(null, value);
        if (!variant)
            return null;
        if (key.indexOf("panel-zone-") === 0) {
            if (variant.get_type_string() !== "s")
                return null;
            const got = variant.get_string();
            const raw = Array.isArray(got) ? got[0] : got;
            const rows = JSON.parse(raw);
            if (!Array.isArray(rows))
                return null;
            const kept = rows.filter(function (row) {
                return row && panelIds[parseInt(row.panelId, 10)];
            });
            return variantToString(GLib.Variant.new_string(JSON.stringify(kept)));
        }
        if (variant.get_type_string() !== "as")
            return null;
        const kept = variant.get_strv().filter(function (entry) {
            return panelIds[parseInt(String(entry).split(":")[0], 10)];
        });
        return variantToString(GLib.Variant.new_strv(kept));
    } catch (ignored) {
        return null;
    }
}

/* Before panels-enabled is written last, Cinnamon can retain or synthesize
 * rows for panels that are about to be removed. Accept those extra retiring
 * rows only when every target-panel row matches. Final apply verification
 * still compares the complete canonical values after panel deletion. */
function _readbackMatchesDuringPanelTransition(key, stored, live, panelIds) {
    if (!panelIds || !_isPanelScopedSetting(key))
        return false;
    const storedFiltered = _filterPanelScopedValue(key, stored, panelIds);
    const liveFiltered = _filterPanelScopedValue(key, live, panelIds);
    if (storedFiltered === null || liveFiltered === null)
        return false;
    const expected = canonicalizeKeyValue(key, stored);
    return canonicalizeKeyValue(key, storedFiltered) === expected &&
        canonicalizeKeyValue(key, liveFiltered) === expected;
}

/**
 * restoreSettingsExceptEnabledApplets:
 * @snapshot (object): capture/profile shape with .cinnamonSettings.
 * @kind (string): profile kind; keys outside the kind's family (either
 *   enabled list, layout scalars) are skipped silently.
 *
 * Writes every captured panel key except the two enabled lists,
 * panels-enabled last (see _orderedRestoreKeys). Keys missing from the live
 * schema are skipped with a warning, not an error: profiles must survive
 * moving between Cinnamon versions.
 *
 * Returns (object): {ok, warnings}. ok is false when a stored value could
 * not be parsed, written, or verified by readback; skipped-missing keys only
 * warn.
 */
function restoreSettingsExceptEnabledApplets(snapshot, kind) {
    const result = { ok: true, warnings: [] };
    try {
        const store = snapshot && snapshot.cinnamonSettings;
        if (!store) {
            result.ok = false;
            result.warnings.push("snapshot has no cinnamonSettings");
            return result;
        }
        const settings = _settings();
        const panelIds = _targetPanelIds(store);
        let liveKeys = null;
        if (typeof settings.list_keys === "function")
            liveKeys = settings.list_keys();

        _orderedRestoreKeys(store, kind).forEach(function (key) {
            const rec = store[key];
            if (!rec || typeof rec.value !== "string") {
                result.ok = false;
                result.warnings.push("no stored value for " + key);
                return;
            }
            if (liveKeys && liveKeys.indexOf(key) === -1) {
                result.warnings.push("skipped " + key + ": not in live schema");
                return;
            }
            const variant = parseVariant(rec.type, rec.value);
            if (!variant) {
                result.ok = false;
                result.warnings.push("unparseable stored value for " + key);
                return;
            }
            try {
                settings.set_value(key, variant);
            } catch (e) {
                /* Without list_keys, a schema-missing key is only discovered
                 * here. An unreadable key is absent from the schema, so the
                 * write error means "skipped", not "failed". */
                if (getRaw(key) === null) {
                    result.warnings.push("skipped " + key + ": not in live schema");
                    return;
                }
                result.ok = false;
                result.warnings.push("write failed for " + key + ": " + e);
                return;
            }
            const liveValue = getRaw(key);
            if (liveValue !== rec.value &&
                    !_readbackMatchesDuringPanelTransition(
                        key, rec.value, liveValue, panelIds)) {
                result.ok = false;
                /* Panel-layout key values only (never applet config), so
                 * printing them cannot leak anything private. Seeing both
                 * sides is the only way to tell a formatting difference
                 * from a real lost write. */
                result.warnings.push("readback mismatch for " + key +
                    ": stored " + rec.value + " live " + liveValue);
            }
        });
    } catch (e) {
        result.ok = false;
        result.warnings.push("restoreSettingsExceptEnabledApplets failed: " + e);
    }
    return result;
}

/**
 * restoreEnabledApplets:
 * @snapshot (object): capture/profile shape with .cinnamonSettings.
 *
 * The one-shot final phase: a single set_value of the stored value. Cinnamon
 * live-applies this key during the call, which can destroy the calling
 * applet instance mid-write; callers must not touch UI afterwards.
 *
 * Returns (boolean): true if the stored variant was written.
 */
function restoreEnabledApplets(snapshot) {
    try {
        const rec = snapshot && snapshot.cinnamonSettings &&
            snapshot.cinnamonSettings["enabled-applets"];
        if (!rec)
            return false;
        const variant = parseVariant(rec.type, rec.value);
        if (!variant)
            return false;
        _settings().set_value("enabled-applets", variant);
        return true;
    } catch (e) {
        _log("warn", "restoreEnabledApplets failed: " + e);
        return false;
    }
}

/**
 * restoreEnabledDesklets:
 * @snapshot (object): capture/profile shape with .cinnamonSettings.
 *
 * The desklet list's own phase, run just before the enabled-applets write.
 * deskletManager live-applies this key during the call, but it can never
 * destroy the calling APPLET, so the post-write restrictions that apply to
 * restoreEnabledApplets do not start here.
 *
 * Returns (boolean): true if the stored variant was written.
 */
function restoreEnabledDesklets(snapshot) {
    try {
        const rec = snapshot && snapshot.cinnamonSettings &&
            snapshot.cinnamonSettings["enabled-desklets"];
        if (!rec)
            return false;
        const variant = parseVariant(rec.type, rec.value);
        if (!variant)
            return false;
        _settings().set_value("enabled-desklets", variant);
        return true;
    } catch (e) {
        _log("warn", "restoreEnabledDesklets failed: " + e);
        return false;
    }
}

/**
 * verifyAgainst:
 * @snapshot (object): capture/profile shape with .cinnamonSettings.
 * @kind (string): profile kind; keys outside the kind's family are skipped
 *   without a warning (they were never restored, so drift on them is not
 *   a mismatch).
 *
 * Canonical comparison of every captured key that exists live. Keys missing
 * live warn instead of mismatching (the restore pass already warned about
 * them; double-counting would break verification on cross-version restores).
 *
 * Returns (object): {ok, mismatchedKeys, warnings}.
 */
function verifyAgainst(snapshot, kind) {
    const result = { ok: true, mismatchedKeys: [], warnings: [] };
    try {
        const store = snapshot && snapshot.cinnamonSettings;
        if (!store) {
            result.ok = false;
            result.warnings.push("snapshot has no cinnamonSettings");
            return result;
        }
        Object.keys(store).forEach(function (key) {
            if (!_kindAllowsKey(kind, key))
                return;
            const rec = store[key];
            if (!rec || typeof rec.value !== "string") {
                result.warnings.push("no stored value for " + key);
                return;
            }
            const live = getRaw(key);
            if (live === null) {
                result.warnings.push("key absent live: " + key);
                return;
            }
            if (canonicalizeKeyValue(key, live) !== canonicalizeKeyValue(key, rec.value))
                result.mismatchedKeys.push(key);
        });
        result.ok = result.mismatchedKeys.length === 0;
    } catch (e) {
        result.ok = false;
        result.warnings.push("verifyAgainst failed: " + e);
    }
    return result;
}

/* ------------------------------------------------------------------ *
 * Parsers
 * ------------------------------------------------------------------ */

/* enabled-applets entry: "panel<Id>:<zone>:<pos>:<uuid>[:<id>]". Both the
 * 5-field form (explicit instance id, current Cinnamon), legacy 4-field
 * form, and future override fields after field five parse. Unknown tails
 * stay in raw and tail. Ids stay strings: id "0" is real (menu@cinnamon.org ships with
 * it) and any falsy check on an id is a bug. parseInt plus Number.isFinite
 * guards every numeric field. */
var VALID_ZONES = ["left", "center", "right"];

/**
 * parseEnabledApplets:
 * @strv (array): raw enabled-applets strings.
 *
 * Returns (object): { entries: [{panelId, zone, order, uuid, instanceId,
 * raw}], malformed: [raw] }. instanceId is null for 4-field entries.
 */
function parseEnabledApplets(strv) {
    const result = { entries: [], malformed: [] };
    try {
        if (!Array.isArray(strv))
            return result;
        strv.forEach(function (raw) {
            if (typeof raw !== "string") {
                result.malformed.push(String(raw));
                return;
            }
            const fields = raw.split(":");
            if (fields.length < 4) {
                result.malformed.push(raw);
                return;
            }
            if (fields[0].indexOf("panel") !== 0) {
                result.malformed.push(raw);
                return;
            }
            const panelId = parseInt(fields[0].substring(5), 10);
            const order = parseInt(fields[2], 10);
            if (!Number.isFinite(panelId) || !Number.isFinite(order) ||
                VALID_ZONES.indexOf(fields[1]) === -1 ||
                fields[3].length === 0) {
                result.malformed.push(raw);
                return;
            }
            result.entries.push({
                panelId: panelId,
                zone: fields[1],
                order: order,
                uuid: fields[3],
                instanceId: (fields[4] !== undefined && fields[4] !== "")
                    ? fields[4] : null,
                tail: fields.slice(5),
                raw: raw
            });
        });
    } catch (e) {
        _log("warn", "parseEnabledApplets failed: " + e);
    }
    return result;
}

/**
 * parseEnabledDesklets:
 * @strv (array): raw enabled-desklets strings.
 *
 * Entry format (verified live on Cinnamon 6.6):
 * "uuid:instanceId:x:y" with x/y pixel positions; instance ids exist even
 * for single-instance desklets (their config still files as <uuid>.json).
 * Exactly four fields parse; anything else is malformed and preserved
 * verbatim by callers. The instance id stays a string (id "0" is real) and
 * negative x/y are legal, so only finiteness is checked.
 *
 * Returns (object): { entries: [{uuid, instanceId, x, y, raw}],
 * malformed: [raw] }.
 */
function parseEnabledDesklets(strv) {
    const result = { entries: [], malformed: [] };
    try {
        if (!Array.isArray(strv))
            return result;
        strv.forEach(function (raw) {
            if (typeof raw !== "string") {
                result.malformed.push(String(raw));
                return;
            }
            const fields = raw.split(":");
            if (fields.length !== 4 || fields[0].length === 0) {
                result.malformed.push(raw);
                return;
            }
            const instanceId = parseInt(fields[1], 10);
            const x = parseInt(fields[2], 10);
            const y = parseInt(fields[3], 10);
            if (!Number.isFinite(instanceId) || !Number.isFinite(x) ||
                !Number.isFinite(y)) {
                result.malformed.push(raw);
                return;
            }
            result.entries.push({
                uuid: fields[0],
                instanceId: fields[1],
                x: x,
                y: y,
                raw: raw
            });
        });
    } catch (e) {
        _log("warn", "parseEnabledDesklets failed: " + e);
    }
    return result;
}

/**
 * parsePanelsEnabled:
 * @strv (array): raw panels-enabled strings ("id:monitor:edge").
 *
 * Returns (object): { panels: [{id, monitor, position}], malformed: [raw] }.
 */
function parsePanelsEnabled(strv) {
    const result = { panels: [], malformed: [] };
    try {
        if (!Array.isArray(strv))
            return result;
        const edges = ["top", "bottom", "left", "right"];
        strv.forEach(function (raw) {
            if (typeof raw !== "string") {
                result.malformed.push(String(raw));
                return;
            }
            const fields = raw.split(":");
            const id = parseInt(fields[0], 10);
            const monitor = parseInt(fields[1], 10);
            if (fields.length !== 3 || !Number.isFinite(id) ||
                !Number.isFinite(monitor) || edges.indexOf(fields[2]) === -1) {
                result.malformed.push(raw);
                return;
            }
            result.panels.push({
                id: id,
                monitor: monitor,
                position: fields[2]
            });
        });
    } catch (e) {
        _log("warn", "parsePanelsEnabled failed: " + e);
    }
    return result;
}

/* ------------------------------------------------------------------ *
 * Canonicalization (fingerprint input)
 * ------------------------------------------------------------------ */

/* GVariant text form for a string array. Values are single-quoted with
 * backslash and quote escaped, matching what Variant.parse accepts. */
function _quote(s) {
    return "'" + String(s).replace(/\\/g, "\\\\").replace(/'/g, "\\'") + "'";
}

function _printStrv(arr) {
    return "[" + arr.map(_quote).join(", ") + "]";
}

/* Parse a print string back into its string array; null when it is not a
 * parseable `as` value. */
function _strvFromValue(valueStr) {
    const variant = parseVariant(null, valueStr);
    if (!variant || variant.get_type_string() !== "as")
        return null;
    try {
        return variant.get_strv();
    } catch (ignored) {
        return null;
    }
}

function _canonPanelsEnabled(strv) {
    const parsed = parsePanelsEnabled(strv);
    const rows = parsed.panels.slice().sort(function (a, b) {
        return a.id - b.id;
    }).map(function (p) {
        return p.id + ":" + p.monitor + ":" + p.position;
    });
    return rows.concat(parsed.malformed.slice().sort());
}

function _canonEnabledApplets(strv) {
    const parsed = parseEnabledApplets(strv);
    const zoneRank = { left: 0, center: 1, right: 2 };
    /* Stable sort: same-(panel,zone,order) ties keep input order, which is
     * still deterministic for identical multisets. */
    const sorted = parsed.entries.slice().sort(function (a, b) {
        return (a.panelId - b.panelId) ||
            (zoneRank[a.zone] - zoneRank[b.zone]) ||
            (a.order - b.order);
    }).map(function (e) {
        return e.raw;
    });
    return sorted.concat(parsed.malformed.slice().sort());
}

/* Desklet rows have no panel/zone; (uuid, id) is the semantic key, so the
 * canonical order sorts entries by uuid then numeric id (x/y as tiebreak)
 * and appends sorted malformed entries, mirroring _canonEnabledApplets. */
function _canonEnabledDesklets(strv) {
    const parsed = parseEnabledDesklets(strv);
    const sorted = parsed.entries.slice().sort(function (a, b) {
        const byUuid = a.uuid < b.uuid ? -1 : (a.uuid > b.uuid ? 1 : 0);
        const aId = parseInt(a.instanceId, 10);
        const bId = parseInt(b.instanceId, 10);
        const byId = aId - bId;
        return byUuid || byId || (a.x - b.x) || (a.y - b.y);
    }).map(function (e) {
        return e.raw;
    });
    return sorted.concat(parsed.malformed.slice().sort());
}

/* Per-panel "id:value" strings (panels-height, delays, autohide): map
 * id -> value with last-wins on duplicates, numeric ids first in numeric
 * order, anything else after in string order. */
function _canonPerPanel(strv) {
    const values = {};
    const numeric = [];
    const other = [];
    strv.forEach(function (s) {
        const colon = s.indexOf(":");
        const id = colon === -1 ? s : s.substring(0, colon);
        const value = colon === -1 ? "" : s.substring(colon + 1);
        if (!(id in values)) {
            const n = parseInt(id, 10);
            if (Number.isFinite(n) && String(n) === id.trim())
                numeric.push(id);
            else
                other.push(id);
        }
        values[id] = value;
    });
    numeric.sort(function (a, b) { return parseInt(a, 10) - parseInt(b, 10); });
    other.sort();
    return numeric.concat(other).map(function (id) {
        return id + ":" + values[id];
    });
}

/* Canonical JSON object string: keys sorted, compact separators. Number
 * formatting is JSON.stringify's, which is stable for the same value. */
function _canonJson(obj) {
    const out = {};
    Object.keys(obj).sort().forEach(function (k) {
        out[k] = obj[k];
    });
    return JSON.stringify(out);
}

/* The three panel-zone-*-sizes keys hold JSON-in-string per-panel objects
 * with arbitrary key order (verified live on Cinnamon 6.6: the variant is a
 * single "s" string whose text is the whole JSON array; an "as" shape with
 * one JSON object per element is tolerated too). Parse, canonicalize each
 * object, sort by panelId. Any unparseable value falls back to the raw
 * string: that is a real difference, not a formatting artifact. */
function _canonZoneSizes(valueStr) {
    const variant = parseVariant(null, valueStr);
    if (!variant)
        return valueStr;
    let rows = null;
    try {
        const t = variant.get_type_string();
        if (t === "s") {
            /* get_string returns [text] in some gjs versions, text in others. */
            const got = variant.get_string();
            const text = Array.isArray(got) ? got[0] : got;
            const parsed = JSON.parse(text);
            if (Array.isArray(parsed))
                rows = parsed;
            else if (parsed !== null && typeof parsed === "object")
                rows = [parsed];
        } else if (t === "as") {
            rows = variant.get_strv().map(function (element) {
                return JSON.parse(element);
            });
        }
    } catch (ignored) {
        rows = null;
    }
    if (!rows || rows.some(function (r) {
        return r === null || typeof r !== "object" || Array.isArray(r);
    }))
        return valueStr;
    rows.sort(function (a, b) {
        const pa = Number(a.panelId);
        const pb = Number(b.panelId);
        const aNum = Number.isFinite(pa);
        const bNum = Number.isFinite(pb);
        if (aNum && bNum && pa !== pb)
            return pa - pb;
        if (aNum !== bNum)
            return aNum ? -1 : 1;
        return _canonJson(a) < _canonJson(b) ? -1 : 1;
    });
    return "[" + rows.map(_canonJson).join(",") + "]";
}

/**
 * canonicalizeKeyValue:
 * @key (string): org.cinnamon key name.
 * @valueStr (string): variant print form of the key's value.
 *
 * Deterministic canonical form used for fingerprinting and verification.
 * Semantically identical values (reordered arrays, duplicate-id collapse,
 * zone-JSON with different key order or spacing) canonicalize identically;
 * any semantic difference survives. Non-`as` values (booleans, ints) pass
 * through unchanged, as do values that fail to parse: an unparseable value
 * is its own canonical self, so two broken captures still compare equal only
 * when byte-identical.
 *
 * Returns (string): the canonical form (falls back to valueStr on failure).
 */
function canonicalizeKeyValue(key, valueStr) {
    try {
        if (typeof valueStr !== "string" || valueStr.length === 0)
            return typeof valueStr === "string" ? valueStr : String(valueStr);
        if (key.indexOf("panel-zone-") === 0)
            return _canonZoneSizes(valueStr);
        const strv = _strvFromValue(valueStr);
        if (!strv)
            return valueStr;
        if (key === "panels-enabled")
            return _printStrv(_canonPanelsEnabled(strv));
        if (key === "enabled-applets")
            return _printStrv(_canonEnabledApplets(strv));
        if (key === "enabled-desklets")
            return _printStrv(_canonEnabledDesklets(strv));
        return _printStrv(_canonPerPanel(strv));
    } catch (e) {
        _log("warn", "canonicalizeKeyValue failed for " + key + ": " + e);
        return valueStr;
    }
}

/**
 * fingerprintSettingsPart:
 * @snapshot (object): capture/profile shape with .cinnamonSettings.
 * @kind (string): profile kind; keys outside the kind's family are skipped.
 *
 * Returns (string): the canonical settings part of the fingerprint: each
 * captured in-scope key's canonical value in PANEL_SETTING_KEYS order,
 * joined with unit separators. Missing keys are skipped, so a profile
 * captured without one key still fingerprints consistently against live
 * state that also lacks it.
 *
 * Compat invariant: with kind "panel" the emitted string is
 * byte-identical to the pre-desklet-support digest (the desklet keys sit at
 * the end of the key list and are filtered out), so schema v1 profiles keep
 * verifying after the upgrade. Never reorder the key list.
 */
function fingerprintSettingsPart(snapshot, kind) {
    try {
        const keys = _panelKeys();
        if (!keys)
            return "";
        const store = snapshot && snapshot.cinnamonSettings;
        if (!store)
            return "";
        const parts = [];
        keys.forEach(function (key) {
            if (!_kindAllowsKey(kind, key))
                return;
            const rec = store[key];
            if (rec && typeof rec.value === "string")
                parts.push(canonicalizeKeyValue(key, rec.value));
        });
        return parts.join("\x1e");
    } catch (e) {
        _log("warn", "fingerprintSettingsPart failed: " + e);
        return "";
    }
}

/* ------------------------------------------------------------------ *
 * next-applet-id allocator
 * ------------------------------------------------------------------ */

/**
 * readNextAppletId:
 *
 * Returns (int): the live next-applet-id, or 0 if unreadable. The key is an
 * allocator counter, never captured into profiles; rewinding it could
 * collide instance ids, so the only legal mutation is bumpNextAppletId.
 */
function readNextAppletId() {
    try {
        const variant = _settings().get_value("next-applet-id");
        if (!variant || variant.get_type_string() !== "i")
            return 0;
        /* get_int32, not get_int: the gjs introspection of GLib.Variant
         * only exposes the width-explicit accessors. */
        const value = variant.get_int32();
        return Number.isFinite(value) ? value : 0;
    } catch (e) {
        return 0;
    }
}

/**
 * bumpNextAppletId:
 * @minId (int): lowest acceptable value for the counter.
 *
 * Forward-only: writes max(current, minId) and never lowers the counter.
 * A no-op bump (minId already satisfied) still returns true.
 *
 * Returns (boolean): true unless the write was needed and failed.
 */
function bumpNextAppletId(minId) {
    try {
        const target = parseInt(minId, 10);
        if (!Number.isFinite(target))
            return false;
        const current = readNextAppletId();
        if (target <= current)
            return true;
        _settings().set_value("next-applet-id", GLib.Variant.new_int32(target));
        return true;
    } catch (e) {
        _log("warn", "bumpNextAppletId failed: " + e);
        return false;
    }
}

/* ------------------------------------------------------------------ *
 * next-desklet-id allocator (mirror of the applet counter)
 * ------------------------------------------------------------------ */

/**
 * readNextDeskletId:
 *
 * Returns (int): the live next-desklet-id, or 0 if unreadable. Same
 * contract as readNextAppletId: allocator counter, never captured, only
 * ever bumped forward.
 */
function readNextDeskletId() {
    try {
        const variant = _settings().get_value("next-desklet-id");
        if (!variant || variant.get_type_string() !== "i")
            return 0;
        const value = variant.get_int32();
        return Number.isFinite(value) ? value : 0;
    } catch (e) {
        return 0;
    }
}

/**
 * bumpNextDeskletId:
 * @minId (int): lowest acceptable value for the counter.
 *
 * Forward-only, like bumpNextAppletId.
 *
 * Returns (boolean): true unless the write was needed and failed.
 */
function bumpNextDeskletId(minId) {
    try {
        const target = parseInt(minId, 10);
        if (!Number.isFinite(target))
            return false;
        const current = readNextDeskletId();
        if (target <= current)
            return true;
        _settings().set_value("next-desklet-id",
            GLib.Variant.new_int32(target));
        return true;
    } catch (e) {
        _log("warn", "bumpNextDeskletId failed: " + e);
        return false;
    }
}

/* ------------------------------------------------------------------ *
 * Manager anchor
 * ------------------------------------------------------------------ */

/* Lowest panel id among panels on the given monitor, or null. */
function _lowestPanelOnMonitor(panels, monitor) {
    let best = null;
    panels.forEach(function (p) {
        if (p.monitor === monitor && (best === null || p.id < best.id))
            best = p;
    });
    return best;
}

/**
 * ensureManagerAnchor:
 * @state (object): { enabledApplets (array), liveEnabledApplets (array),
 *   panelsEnabled (array), nextAppletId (int), primaryMonitorIndex (int) }
 *
 * Anchor repair per the plan: a profile must never remove the only Panel
 * Profiles instance. Target self entries collapse to one. Its placement is
 * kept when that panel survives. If the profile has no manager entry, the
 * live manager's placement is kept when its panel survives. Its instance id
 * and override tail also come from the live manager whenever collision-free.
 * This avoids moving the transaction owner during anchor repair and lets a
 * profile delete the manager's old host panel without losing it. With no
 * valid target or live placement, the lowest panel on the primary monitor
 * wins, then monitor 0, then the lowest panel anywhere.
 * With no panels, panel 1 is created. Fallback allocation is
 * max(nextAppletId, maxExistingId + 1), so it never collides.
 *
 * Pure: nothing is written to settings, inputs are not mutated.
 *
 * Returns (object): { enabledApplets, panelsEnabled, allocatedId (string|
 * null), nextAppletId, repaired (boolean) }.
 */
function ensureManagerAnchor(state) {
    const fail = {
        enabledApplets: [],
        panelsEnabled: [],
        allocatedId: null,
        nextAppletId: 0,
        repaired: false
    };
    try {
        if (!state || typeof state !== "object")
            return fail;

        const enabledApplets = Array.isArray(state.enabledApplets)
            ? state.enabledApplets.slice() : [];
        const liveEnabledApplets = Array.isArray(state.liveEnabledApplets)
            ? state.liveEnabledApplets.slice() : [];
        const panelsEnabled = Array.isArray(state.panelsEnabled)
            ? state.panelsEnabled.slice() : [];
        const nextAppletId = Number.isFinite(state.nextAppletId)
            ? state.nextAppletId : 0;
        let primaryMonitorIndex = parseInt(state.primaryMonitorIndex, 10);
        if (!Number.isFinite(primaryMonitorIndex) || primaryMonitorIndex < 0)
            primaryMonitorIndex = 0;

        const uuid = _selfUuid();
        const parsedPanels = parsePanelsEnabled(panelsEnabled);
        const panelIds = {};
        parsedPanels.panels.forEach(function (p) {
            panelIds[p.id] = true;
        });
        const parsed = parseEnabledApplets(enabledApplets);

        const targetSelf = parsed.entries.find(function (entry) {
            return entry.uuid === uuid && panelIds[entry.panelId];
        }) || null;
        const liveSelf = parseEnabledApplets(liveEnabledApplets).entries
            .find(function (entry) { return entry.uuid === uuid; }) || null;

        let panelId = targetSelf ? targetSelf.panelId : null;
        if (panelId === null && liveSelf && panelIds[liveSelf.panelId])
            panelId = liveSelf.panelId;
        if (panelId === null) {
            let panel = _lowestPanelOnMonitor(parsedPanels.panels,
                primaryMonitorIndex);
            if (!panel)
                panel = _lowestPanelOnMonitor(parsedPanels.panels, 0);
            if (panel) {
                panelId = panel.id;
            } else if (parsedPanels.panels.length > 0) {
                panelId = parsedPanels.panels.reduce(function (best, p) {
                    return best === null || p.id < best ? p.id : best;
                }, null);
            } else {
                panelsEnabled.push("1:" + primaryMonitorIndex + ":bottom");
                panelIds[1] = true;
                panelId = 1;
            }
        }

        let maxOrder = -1;
        let maxNumericId = 0;
        const usedByOther = {};
        parsed.entries.forEach(function (entry) {
            if (entry.panelId === panelId && entry.zone === "right" &&
                    entry.order > maxOrder)
                maxOrder = entry.order;
            if (entry.instanceId === null)
                return;
            const n = parseInt(entry.instanceId, 10);
            if (Number.isFinite(n) && n > maxNumericId)
                maxNumericId = n;
            if (entry.uuid !== uuid)
                usedByOther[entry.instanceId] = true;
        });

        let allocatedId = null;
        let newlyAllocated = false;
        const identity = liveSelf || targetSelf;
        if (identity && identity.instanceId !== null &&
                !usedByOther[identity.instanceId]) {
            allocatedId = identity.instanceId;
        } else {
            allocatedId = String(Math.max(nextAppletId, maxNumericId + 1));
            newlyAllocated = true;
        }
        const livePlacement = !targetSelf && liveSelf &&
            liveSelf.panelId === panelId ? liveSelf : null;
        const placement = targetSelf || livePlacement;
        const zone = placement ? placement.zone : "right";
        const order = placement ? placement.order : maxOrder + 1;
        const tail = liveSelf && Array.isArray(liveSelf.tail)
            ? liveSelf.tail : (targetSelf && Array.isArray(targetSelf.tail)
                ? targetSelf.tail : []);
        let anchorRaw = "panel" + panelId + ":" + zone + ":" + order +
            ":" + uuid + ":" + allocatedId;
        if (tail.length > 0)
            anchorRaw += ":" + tail.join(":");

        const outEntries = [];
        let inserted = false;
        enabledApplets.forEach(function (raw) {
            const one = parseEnabledApplets([raw]).entries[0];
            if (one && one.uuid === uuid) {
                if (!inserted) {
                    outEntries.push(anchorRaw);
                    inserted = true;
                }
                return;
            }
            outEntries.push(raw);
        });
        if (!inserted)
            outEntries.push(anchorRaw);

        const selfRows = parsed.entries.filter(function (entry) {
            return entry.uuid === uuid;
        });
        const repaired = selfRows.length !== 1 || selfRows[0].raw !== anchorRaw ||
            panelsEnabled.join("\x00") !==
                (Array.isArray(state.panelsEnabled)
                    ? state.panelsEnabled.join("\x00") : "");
        const allocatedNumber = parseInt(allocatedId, 10);
        const outNextAppletId = Number.isFinite(allocatedNumber)
            ? Math.max(nextAppletId, allocatedNumber + 1) : nextAppletId;

        return {
            enabledApplets: outEntries,
            panelsEnabled: panelsEnabled,
            allocatedId: newlyAllocated ? String(allocatedId) : null,
            nextAppletId: outNextAppletId,
            repaired: repaired
        };
    } catch (e) {
        _log("warn", "ensureManagerAnchor failed: " + e);
        return fail;
    }
}
