// utils.js — MintTenMenu shared utilities
'use strict';

const GLib = imports.gi.GLib;
const Gio  = imports.gi.Gio;
const St   = imports.gi.St;
const Clutter = imports.gi.Clutter;
const Main = imports.ui.main;

// ---------------------------------------------------------------------------
// Theme detection — reads live theme node of the menu actor (Cinnamenu style)
// ---------------------------------------------------------------------------

function isThemeDark(menuActor) {
    try {
        const bg = menuActor.get_theme_node().get_background_color();
        const lum = 0.2126 * (bg.red / 255) + 0.7152 * (bg.green / 255) + 0.0722 * (bg.blue / 255);
        return lum < 0.5;
    } catch (e) { return true; }
}

function getThemeForegroundHex(menuActor) {
    try {
        return menuActor.get_theme_node().get_foreground_color().to_string().substring(0, 7);
    } catch (e) { return '#ffffff'; }
}

function getThemeBackgroundHex(menuActor) {
    try {
        return menuActor.get_theme_node().get_background_color().to_string().substring(0, 7);
    } catch (e) { return '#1e1e1e'; }
}

// ---------------------------------------------------------------------------
// User info via AccountsService
// ---------------------------------------------------------------------------

function getUserRealName() {
    try {
        const AccountsService = imports.gi.AccountsService;
        const manager = AccountsService.UserManager.get_default();
        const user = manager.get_user(GLib.get_user_name());
        if (user) {
            const rn = user.get_real_name ? user.get_real_name() : null;
            if (rn && rn.length > 0) return rn;
        }
    } catch (e) {}
    const envName = GLib.get_real_name();
    if (envName && envName !== 'Unknown') return envName;
    return GLib.get_user_name();
}

function getUserAvatarPath() {
    try {
        const AccountsService = imports.gi.AccountsService;
        const manager = AccountsService.UserManager.get_default();
        const user = manager.get_user(GLib.get_user_name());
        if (user) {
            const icon = user.get_icon_file ? user.get_icon_file() : null;
            if (icon && GLib.file_test(icon, GLib.FileTest.EXISTS)) return icon;
        }
    } catch (e) {}
    return null;
}

// ---------------------------------------------------------------------------
// JSON persistence in ~/.config/wintenmenu/
// ---------------------------------------------------------------------------

const CONFIG_DIR = GLib.build_filenamev([GLib.get_home_dir(), '.config', 'wintenmenu']);

function ensureConfigDir() {
    const dir = Gio.File.new_for_path(CONFIG_DIR);
    if (!dir.query_exists(null)) {
        try { dir.make_directory_with_parents(null); } catch (e) {}
    }
}

function loadJSON(filename, defaultValue) {
    ensureConfigDir();
    const path = GLib.build_filenamev([CONFIG_DIR, filename]);
    try {
        if (GLib.file_test(path, GLib.FileTest.EXISTS)) {
            const [ok, contents] = GLib.file_get_contents(path);
            if (ok) {
                const text = typeof contents === 'string'
                    ? contents
                    : new TextDecoder('utf-8').decode(contents);
                return JSON.parse(text);
            }
        }
    } catch (e) {
        global.logWarning('MintTenMenu: Failed to load ' + path + ': ' + e);
    }
    return defaultValue;
}

const pendingSaveData = {};
const saveTimeoutIds = {};

function saveJSONAsync(filename, data) {
    const t0 = GLib.get_monotonic_time();
    ensureConfigDir();
    const path = GLib.build_filenamev([CONFIG_DIR, filename]);
    const file = Gio.File.new_for_path(path);
    const content = JSON.stringify(data, null, 2);
    try {
        file.replace_contents_bytes_async(
            new GLib.Bytes(content),
            null,
            false,
            Gio.FileCreateFlags.REPLACE_DESTINATION,
            null,
            (fileObj, res) => {
                try {
                    fileObj.replace_contents_finish(res);
                    const t1 = GLib.get_monotonic_time();
                    global.log(`[PROFILE] saveJSON async write to ${filename}: ${(t1 - t0) / 1000}ms`);
                } catch (e) {
                    global.logWarning('MintTenMenu: Failed to save async ' + path + ': ' + e);
                }
            }
        );
    } catch (e) {
        global.logWarning('MintTenMenu: Failed to start async save for ' + path + ': ' + e);
    }
}

function saveJSON(filename, data) {
    pendingSaveData[filename] = data;
    if (saveTimeoutIds[filename]) {
        clearTimeout(saveTimeoutIds[filename]);
    }
    saveTimeoutIds[filename] = setTimeout(() => {
        flushSave(filename);
    }, 400);
}

function flushSave(filename) {
    if (saveTimeoutIds[filename]) {
        clearTimeout(saveTimeoutIds[filename]);
        delete saveTimeoutIds[filename];
    }
    if (pendingSaveData[filename] !== undefined) {
        const data = pendingSaveData[filename];
        delete pendingSaveData[filename];
        saveJSONAsync(filename, data);
    }
}

function flushAllSaves() {
    for (const filename of Object.keys(pendingSaveData)) {
        flushSave(filename);
    }
}

const iconCache = {};

function getIconTexture(cinnamonApp, size, cacheContainer) {
    if (!cinnamonApp) return null;
    const appId = cinnamonApp.get_id ? cinnamonApp.get_id() : cinnamonApp.toString();
    const cacheKey = appId;

    if (!iconCache[cacheKey]) {
        let texture = null;
        try {
            texture = cinnamonApp.create_icon_texture(128);
        } catch (e) {
            texture = new St.Icon({
                icon_name: 'application-x-executable',
                icon_size: 128,
                icon_type: St.IconType.FULLCOLOR,
            });
        }
        iconCache[cacheKey] = texture;
    }

    if (cacheContainer && !iconCache[cacheKey].get_parent()) {
        try {
            cacheContainer.add_actor(iconCache[cacheKey]);
        } catch (e) {}
    }

    const clone = new Clutter.Clone({
        source: iconCache[cacheKey],
        x_align: Clutter.ActorAlign.CENTER,
        y_align: Clutter.ActorAlign.CENTER,
    });
    clone.set_size(size, size);
    return clone;
}

function clearIconCache() {
    for (const key of Object.keys(iconCache)) {
        try {
            iconCache[key].destroy();
        } catch (e) {}
        delete iconCache[key];
    }
}



// ---------------------------------------------------------------------------
// Fuzzy search (same bigram strategy as Cinnamenu)
// ---------------------------------------------------------------------------

function decompString(s) {
    return s.normalize('NFKD').replace(/[\u0300-\u036F\u1AB0-\u1AFF\u1DC0-\u1DFF]/g, '');
}

function escapeRe(s) {
    return s.replace(/[-\/.*+?^${}()|[\]\\]/g, '\\$&');
}

function scoreMatch(query, target) {
    if (!query || !target) return { score: 0, markup: target || '' };
    const q = decompString(query).toLocaleUpperCase();
    const t = decompString(target).toLocaleUpperCase();

    if (new RegExp('\\b' + escapeRe(q)).test(t)) {
        const pos = t.indexOf(q);
        const score = pos === 0 ? 1.21 : 1.2;
        return { score, markup: target.slice(0, pos) + '<b>' + target.slice(pos, pos + q.length) + '</b>' + target.slice(pos + q.length) };
    }
    const sub = t.indexOf(q);
    if (sub !== -1) {
        return { score: 1.1, markup: target.slice(0, sub) + '<b>' + target.slice(sub, sub + q.length) + '</b>' + target.slice(sub + q.length) };
    }
    const found = t.match(new RegExp('[' + escapeRe(q) + ']+', 'g'));
    if (found) {
        const longest = found.reduce((a, b) => a.length >= b.length ? a : b, '');
        let bigrams = 1;
        if (q.length >= 2) {
            let bg = 0;
            for (let i = 0; i < q.length - 1; i++) if (longest.indexOf(q[i] + q[i+1]) >= 0) bg++;
            bigrams = bg / (q.length - 1);
        }
        const score = Math.min(longest.length / q.length, 1.0) * bigrams;
        if (score > 0) {
            const pos = t.indexOf(longest);
            return { score, markup: target.slice(0, pos) + '<b>' + target.slice(pos, pos + longest.length) + '</b>' + target.slice(pos + longest.length) };
        }
    }
    return { score: 0, markup: target };
}

// ---------------------------------------------------------------------------
// Animation helpers
// ---------------------------------------------------------------------------

function animateWidth(actor, targetWidth, durationMs) {
    actor.save_easing_state();
    actor.set_easing_duration(durationMs);
    actor.set_easing_mode(Clutter.AnimationMode.EASE_OUT_QUAD);
    actor.set_width(targetWidth);
    actor.restore_easing_state();
}

function animatePress(actor, onComplete) {
    actor.save_easing_state();
    actor.set_easing_duration(80);
    actor.set_easing_mode(Clutter.AnimationMode.EASE_OUT_QUAD);
    actor.set_scale(0.93, 0.93);
    actor.restore_easing_state();
    setTimeout(() => {
        actor.save_easing_state();
        actor.set_easing_duration(100);
        actor.set_easing_mode(Clutter.AnimationMode.EASE_OUT_BACK);
        actor.set_scale(1.0, 1.0);
        actor.restore_easing_state();
        if (onComplete) setTimeout(onComplete, 80);
    }, 80);
}

// ---------------------------------------------------------------------------
// XDG directories
// ---------------------------------------------------------------------------

const XDG_DIRS = {
    documents: { icon: 'folder-documents', label: 'Documents', dir: GLib.UserDirectory.DIRECTORY_DOCUMENTS },
    downloads: { icon: 'folder-downloads', label: 'Downloads', dir: GLib.UserDirectory.DIRECTORY_DOWNLOAD  },
    music:     { icon: 'folder-music',     label: 'Music',     dir: GLib.UserDirectory.DIRECTORY_MUSIC     },
    pictures:  { icon: 'folder-pictures',  label: 'Pictures',  dir: GLib.UserDirectory.DIRECTORY_PICTURES  },
    videos:    { icon: 'folder-videos',    label: 'Videos',    dir: GLib.UserDirectory.DIRECTORY_VIDEOS    },
};

function getXdgDir(key) {
    const info = XDG_DIRS[key];
    if (!info) return null;
    const path = GLib.get_user_special_dir(info.dir);
    return path ? { path, icon: info.icon, label: info.label } : null;
}

// ---------------------------------------------------------------------------

module.exports = {
    isThemeDark, getThemeForegroundHex, getThemeBackgroundHex,
    getUserRealName, getUserAvatarPath,
    loadJSON, saveJSON, flushAllSaves, getIconTexture, clearIconCache,
    scoreMatch,
    animateWidth, animatePress,
    getXdgDir, XDG_DIRS, CONFIG_DIR,
};
