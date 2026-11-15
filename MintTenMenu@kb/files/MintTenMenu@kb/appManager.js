// appManager.js — MintTenMenu app enumeration via CMenu + Cinnamon.AppSystem
'use strict';

const Cinnamon = imports.gi.Cinnamon;
const CMenu    = imports.gi.CMenu;
const {SignalManager} = imports.misc.signalManager;

// 'installed-changed' is emitted before the desktop-file database reflects the
// new entry: reloading immediately misses an app that was just installed
// (confirmed at +0ms vs +300ms on Cinnamon 6.6). Wait for the scan to settle.
const INSTALL_SETTLE_MS = 800;

class AppManager {
    constructor() {
        this._signals    = new SignalManager(null);
        this._appSystem  = Cinnamon.AppSystem.get_default();
        // Prefer AppSystem's own tree, which stays in sync with the app list.
        // Older Cinnamon versions may not expose it; fall back to a private tree.
        this._tree       = this._appSystem.get_tree
            ? null
            : new CMenu.Tree({ menu_basename: 'applications.menu' });
        this._apps       = [];
        this._onChangedCb = null;
        this._reloadTimeoutId = null;

        this._signals.connect(this._appSystem, 'installed-changed',
            () => this._scheduleReload());
        this._reload();
    }

    onChanged(cb) { this._onChangedCb = cb; }

    getApps() { return this._apps; }

    searchApps(query, utils) {
        if (!query || !query.trim()) return [];
        const q = query.trim();
        const results = [];
        for (const app of this._apps) {
            const ns = utils.scoreMatch(q, app.name);
            const ks = app.keywords ? utils.scoreMatch(q, app.keywords) : { score: 0 };
            const ds = app.description ? utils.scoreMatch(q, app.description) : { score: 0 };
            let best = ns;
            if (ks.score * 0.9  > best.score) best = { score: ks.score  * 0.9,  markup: ns.markup };
            if (ds.score * 0.75 > best.score) best = { score: ds.score * 0.75, markup: ns.markup };
            if (best.score > 0.25) results.push({ app, score: best.score, nameMarkup: best.markup });
        }
        return results.sort((a, b) => b.score - a.score);
    }

    getCinnamonApp(appId) { return this._appSystem.lookup_app(appId); }

    destroy() {
        if (this._reloadTimeoutId) {
            clearTimeout(this._reloadTimeoutId);
            this._reloadTimeoutId = null;
        }
        this._signals.disconnectAllSignals();
    }

    // ---- private -----------------------------------------------------------

    _scheduleReload() {
        if (this._reloadTimeoutId) clearTimeout(this._reloadTimeoutId);
        this._reloadTimeoutId = setTimeout(() => {
            this._reloadTimeoutId = null;
            this._reload();
            if (this._onChangedCb) this._onChangedCb();
        }, INSTALL_SETTLE_MS);
    }

    _reload() {
        this._apps = [];
        try {
            let root;
            if (this._tree) {
                this._tree.load_sync();
                root = this._tree.get_root_directory();
            } else {
                root = this._appSystem.get_tree().get_root_directory();
            }
            this._walkDirectory(root);
        } catch (e) {
            global.logWarning('MintTenMenu: AppManager._reload error: ' + e);
        }
        // Deduplicate flat list
        const seen = new Set();
        this._apps = this._apps.filter(a => { if (seen.has(a.id)) return false; seen.add(a.id); return true; });
        // Sort alphabetically
        this._apps.sort((a, b) => a.name.localeCompare(b.name));
    }

    _walkDirectory(dir) {
        const iter = dir.iter();
        let type;
        while ((type = iter.next()) !== CMenu.TreeItemType.INVALID) {
            if (type === CMenu.TreeItemType.DIRECTORY) {
                const sub = iter.get_directory();
                if (sub.get_is_nodisplay && sub.get_is_nodisplay()) continue;
                this._walkEntries(sub);
                this._walkDirectory(sub);
            }
        }
    }

    _walkEntries(dir) {
        const iter = dir.iter();
        let type;
        while ((type = iter.next()) !== CMenu.TreeItemType.INVALID) {
            if (type !== CMenu.TreeItemType.ENTRY) continue;
            const entry   = iter.get_entry();
            const appInfo = entry.get_app_info();
            if (!appInfo) continue;
            if (appInfo.get_nodisplay && appInfo.get_nodisplay()) continue;
            if (appInfo.get_is_hidden && appInfo.get_is_hidden()) continue;
            const cinnamonApp = this._appSystem.lookup_app(entry.get_desktop_file_id());
            if (!cinnamonApp) continue;
            const info = {
                id:          appInfo.get_id() || appInfo.get_filename() || entry.get_desktop_file_id(),
                name:        appInfo.get_display_name() || appInfo.get_name() || '',
                description: (appInfo.get_description() || '').split('\n')[0],
                keywords:    (appInfo.get_keywords ? (appInfo.get_keywords() || []) : []).join(' '),
                icon:        appInfo.get_icon ? appInfo.get_icon() : null,
                cinnamonApp,
                desktopFile: appInfo.get_filename(),
            };
            this._apps.push(info);
        }
    }
}

module.exports = { AppManager };
