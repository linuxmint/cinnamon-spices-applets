/*
 * AppMan Manager — Cinnamon applet for AppMan / AM (https://github.com/ivan-hc/AM)
 *
 * Power design:
 *  - No polling. A single one-shot timer fires at the next scheduled check.
 *  - Missed checks (machine off/asleep) are caught up after login/resume,
 *    driven by the logind PrepareForSleep signal.
 *  - Automatic work waits for AC power and an unmetered network. UPower and
 *    GNetworkMonitor signals resume it, so nothing is polled.
 *  - The installed-app list comes from a ~80 ms helper that reads the app
 *    folders, never "appman -f" (which runs du on every app).
 *  - Update checks run under nice/ionice with limited parallelism and timeouts.
 *  - Terminal operations report completion through a stamp file watched with
 *    inotify only while the operation runs.
 *  - The search database loads on first keystroke and is freed when the menu
 *    closes. The installed-app rows are built only when that submenu opens.
 *  - All file I/O is asynchronous, and the applet does no synchronous PATH
 *    lookups: helper.sh resolves appman and applies nice/ionice itself.
 */

const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;
const Main = imports.ui.main;
const MessageTray = imports.ui.messageTray;
const ModalDialog = imports.ui.modalDialog;
const Tooltips = imports.ui.tooltips;
const Gettext = imports.gettext;
const { Gio, GLib, St, Clutter, Pango, Cinnamon } = imports.gi;

let UUID = 'appman-manager@z3n0e';   // replaced by metadata.uuid in main()
let CACHE_DIR, STATE_FILE, STAMP_FILE, LOG_FILE;

const HOME = GLib.get_home_dir();
const LIST_STALE_SECS = 30;
const OP_START_GRACE_SECS = 30;
const OP_WATCHDOG_SECS = 4 * 3600;
const MAX_UPDATE_ROWS = 6;
const ANSI_RE = /\x1b\[[0-9;?]*[A-Za-z]|\x1b\][^\x07]*\x07/g;
const DB_ARCHES = ['x86_64', 'aarch64', 'i686', 'armv7l'];

const decoder = new TextDecoder('utf-8');
const encoder = new TextEncoder();

function _(str) {
    return Gettext.dgettext(UUID, str);
}

function setupPaths(uuid) {
    UUID = uuid;
    Gettext.bindtextdomain(UUID, GLib.build_filenamev([HOME, '.local', 'share', 'locale']));
    CACHE_DIR = GLib.build_filenamev([GLib.get_user_cache_dir(), UUID]);
    STATE_FILE = GLib.build_filenamev([CACHE_DIR, 'state.json']);
    STAMP_FILE = GLib.build_filenamev([CACHE_DIR, 'operation']);
    LOG_FILE = GLib.build_filenamev([CACHE_DIR, 'last-operation.log']);
}

function nowSecs() {
    return Math.floor(Date.now() / 1000);
}

/* ------------------------------------------------------------ async files */

function loadText(path, cb) {
    Gio.File.new_for_path(path).load_contents_async(null, (file, res) => {
        let text = null;
        try {
            let [ok, bytes] = file.load_contents_finish(res);
            if (ok)
                text = decoder.decode(bytes);
        } catch (e) {
            // missing file: text stays null
        }
        cb(text);
    });
}

function saveText(path, text, cb = null) {
    let bytes = new GLib.Bytes(encoder.encode(text));
    Gio.File.new_for_path(path).replace_contents_bytes_async(bytes, null, false,
        Gio.FileCreateFlags.REPLACE_DESTINATION, null, (file, res) => {
            try {
                file.replace_contents_finish(res);
            } catch (e) {
                global.logError(`${UUID}: cannot write ${path}: ${e.message}`);
            }
            if (cb)
                cb();
        });
}

function ensureCacheDir(cb) {
    Gio.File.new_for_path(CACHE_DIR).make_directory_async(GLib.PRIORITY_DEFAULT, null, (file, res) => {
        try {
            file.make_directory_finish(res);
        } catch (e) {
            if (!e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.EXISTS))
                global.logError(`${UUID}: cannot create ${CACHE_DIR}: ${e.message}`);
        }
        cb();
    });
}

/* ---------------------------------------------------------------- helpers */

function fmtTime(ts) {
    if (!ts)
        return _("never");
    let dt = GLib.DateTime.new_from_unix_local(ts);
    let now = GLib.DateTime.new_now_local();
    let midnight = d => GLib.DateTime.new_local(d.get_year(), d.get_month(), d.get_day_of_month(), 0, 0, 0).to_unix();
    let days = Math.round((midnight(dt) - midnight(now)) / 86400);
    let hm = dt.format('%H:%M');
    if (days === 0)
        return hm;
    if (days === 1)
        return _("tomorrow %s").format(hm);
    if (days === -1)
        return _("yesterday %s").format(hm);
    if (Math.abs(days) < 7)
        return dt.format('%a %H:%M');
    return dt.format('%d %b %H:%M');
}

function detailText(code) {
    switch (code) {
    case 'checksum': return _("checksum failed, will be downloaded again");
    case 'no-updater': return _("no AM-updater script");
    case 'nonstandard': return _("non-standard updater script");
    case 'unsafe': return _("updater script does more than a version lookup");
    case 'failed': return _("lookup failed or timed out");
    case 'empty': return _("empty response");
    default: return code || '';
    }
}

function makeIcon(name, size = 16) {
    return new St.Icon({ icon_name: name, icon_type: St.IconType.SYMBOLIC, icon_size: size });
}

/* ------------------------------------------------------------------- rows */

class IconButton {
    constructor(iconName, tip, cb, danger = false) {
        this.actor = new St.Button({
            style_class: 'appman-icon-button' + (danger ? ' appman-icon-button-danger' : ''),
            child: makeIcon(iconName, 16),
            can_focus: true,
            reactive: true,
            track_hover: true,
        });
        this._tip = new Tooltips.Tooltip(this.actor, tip);
        this.actor.connect('clicked', () => cb());
    }
}

/* A menu item laid out as one full-width row. Cinnamon aligns columns across
 * all items of a menu; opting out keeps wide rows from shifting the icons of
 * the standard items (and vice versa). */
class FlatItem extends PopupMenu.PopupBaseMenuItem {
    constructor(params) {
        super(params);
        this.row = new St.BoxLayout({ x_expand: true, style: 'spacing: 10px;' });
        this.addActor(this.row, { span: -1, expand: true });
    }

    getColumnWidths() {
        return [];
    }

    setColumnWidths() {
        this._columnWidths = null;
    }
}

/* One installed app or one available update. */
class AppRow extends FlatItem {
    constructor(applet, app, opts) {
        super();
        let icon = applet.appIcon(app, 22);
        icon.y_align = Clutter.ActorAlign.CENTER;
        this.row.add_child(icon);

        let box = new St.BoxLayout({ vertical: true, x_expand: true, y_align: Clutter.ActorAlign.CENTER });
        box.add_child(new St.Label({ text: app.name }));
        let sub = new St.BoxLayout({ style: 'spacing: 6px;' });
        if (opts.kind === 'update') {
            sub.add_child(new St.Label({ text: `${app.version}  →`, style_class: 'appman-dim' }));
            sub.add_child(new St.Label({ text: opts.result.latest || '?', style_class: 'appman-version-new' }));
            if (opts.result.detail)
                sub.add_child(new St.Label({ text: `(${detailText(opts.result.detail)})`, style_class: 'appman-dim' }));
        } else {
            sub.add_child(new St.Label({ text: app.version, style_class: 'appman-dim' }));
            if (app.state === 'locked')
                sub.add_child(new St.Label({ text: _("locked"), style_class: 'appman-badge' }));
            else if (app.state === 'self')
                sub.add_child(new St.Label({ text: _("self-updating"), style_class: 'appman-badge' }));
            if (opts.result && opts.result.status === 'update' && app.state === 'updatable')
                sub.add_child(new St.Label({ text: `→ ${opts.result.latest}`, style_class: 'appman-version-new' }));
        }
        box.add_child(sub);
        this.row.add_child(box);

        let buttons = new St.BoxLayout({ style_class: 'appman-row-buttons', y_align: Clutter.ActorAlign.CENTER });
        let add = (iconName, tip, cb, danger) => buttons.add_child(new IconButton(iconName, tip, () => {
            applet.menu.close();
            cb();
        }, danger).actor);

        if (opts.kind === 'update') {
            add('xsi-changes-prevent', _("Keep the current version (lock)"), () => applet.lockApp(app.name, true));
        } else {
            if (app.state === 'updatable')
                add('xsi-document-save', _("Update now"), () => applet.updateApps([app.name]));
            add('xsi-view-refresh', _("Reinstall"), () => applet.reinstallApp(app.name));
            if (app.state === 'locked')
                add('xsi-changes-allow', _("Unlock updates"), () => applet.lockApp(app.name, false));
            else if (app.state === 'updatable')
                add('xsi-changes-prevent', _("Lock at the current version"), () => applet.lockApp(app.name, true));
            add('xsi-user-trash', _("Remove"), () => applet.removeApp(app.name), true);
        }
        this.row.add_child(buttons);

        this.connect('activate', () => {
            if (opts.kind === 'update')
                applet.updateApps([app.name]);
            else
                applet.launchApp(app);
        });
    }
}

/* A search hit from the AppMan database. */
class ResultRow extends FlatItem {
    constructor(applet, entry, installed) {
        super();
        let box = new St.BoxLayout({ vertical: true, x_expand: true });
        let top = new St.BoxLayout({ style: 'spacing: 6px;' });
        top.add_child(new St.Label({ text: entry.n }));
        if (installed)
            top.add_child(new St.Label({ text: _("installed"), style_class: 'appman-badge' }));
        box.add_child(top);
        let desc = new St.Label({ text: entry.d, style_class: 'appman-desc' });
        desc.clutter_text.ellipsize = Pango.EllipsizeMode.END;
        box.add_child(desc);
        let icon = makeIcon(installed ? 'xsi-emblem-ok' : 'xsi-list-add', 16);
        icon.y_align = Clutter.ActorAlign.CENTER;
        this.row.add_child(icon);
        this.row.add_child(box);
        this.connect('activate', () => {
            if (installed)
                applet.reinstallApp(entry.n);
            else
                applet.installApp(entry.n, entry.d);
        });
    }
}

/* ----------------------------------------------------------------- applet */

class AppManApplet extends Applet.TextIconApplet {
    constructor(metadata, orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId);
        this._dir = metadata.path;
        this._helper = GLib.build_filenamev([this._dir, 'helper.sh']);

        this._apps = [];          // [{name, version, state, icon, path}]
        this._amVersion = '';
        this._appsPath = '';
        this._appmanPath = '';    // resolved by helper.sh (list header)
        this._listTime = 0;
        this._results = {};       // name -> {status, latest, detail}
        this._lastCheck = 0;
        this._notified = [];
        this._nextDue = 0;
        this._lastAttempt = 0;
        this._checking = false;
        this._checkProc = null;
        this._checkCancel = null;
        this._op = null;          // running operation
        this._lastOp = null;      // {title, ok, time, log}
        this._lastOpSeen = true;
        this._pendingAuto = false;
        this._postponedWhy = '';
        this._installedDirty = true;
        this._db = null;
        this._dbLoading = false;
        this._timers = {};
        this._source = null;
        this._saveQueued = false;
        this._destroyed = false;

        this._bindSettings(instanceId, metadata.uuid);
        this._buildMenu(orientation);
        this._updatePanel();
        this._connectSystemSignals();

        // Defer all work until the session has settled. The list is cheap;
        // the check only runs if one is due.
        ensureCacheDir(() => this._loadState(() => {
            this._setTimer('startup', 8, () => {
                this._refreshList(() => {
                    this._rebuildDynamic();
                    this._scheduleNext(true);
                });
            });
        }));
    }

    /* ---------------- settings ---------------- */

    _bindSettings(instanceId, uuid) {
        this.settings = new Settings.AppletSettings(this, uuid, instanceId);
        const schedule = () => this._scheduleNext(false);
        const panel = () => this._updatePanel();
        const conditions = () => this._onConditionsChanged();
        const bind = (key, prop, cb) => this.settings.bind(key, prop, cb || null);
        bind('check-mode', 'checkMode', schedule);
        bind('check-interval', 'checkInterval', schedule);
        bind('check-time', 'checkTime', schedule);
        bind('check-weekday', 'checkWeekday', schedule);
        bind('check-weekly-time', 'checkWeeklyTime', schedule);
        bind('check-at-login', 'checkAtLogin');
        bind('login-delay', 'loginDelay');
        bind('skip-on-battery', 'skipOnBattery', conditions);
        bind('skip-on-metered', 'skipOnMetered', conditions);
        bind('on-updates', 'onUpdates');
        bind('update-all-syncs', 'updateAllSyncs');
        bind('use-terminal', 'useTerminal');
        bind('terminal-command', 'terminalCommand');
        bind('appman-path', 'appmanPath', () => this._refreshList(() => this._rebuildDynamic()));
        bind('check-jobs', 'checkJobs');
        bind('check-timeout', 'checkTimeout');
        bind('show-count', 'showCount', panel);
        bind('max-search-results', 'maxSearchResults');
    }

    checkNowFromSettings() {
        this.runCheck({ manual: true });
    }

    /* ---------------- state ---------------- */

    _loadState(done) {
        loadText(STATE_FILE, (txt) => {
            if (txt) {
                try {
                    let s = JSON.parse(txt);
                    this._lastCheck = s.lastCheck || 0;
                    this._results = s.results || {};
                    this._notified = s.notified || [];
                    this._lastOp = s.lastOp || null;
                    this._lastOpSeen = s.lastOpSeen !== false;
                } catch (e) {
                    global.logWarning(`${UUID}: ignoring a corrupt state file`);
                }
            }
            done();
        });
    }

    // Coalesces several changes into one asynchronous write.
    _saveState() {
        if (this._saveQueued)
            return;
        this._saveQueued = true;
        this._timers.save = GLib.idle_add(GLib.PRIORITY_LOW, () => {
            delete this._timers.save;
            this._saveQueued = false;
            saveText(STATE_FILE, JSON.stringify({
                lastCheck: this._lastCheck,
                results: this._results,
                notified: this._notified,
                lastOp: this._lastOp,
                lastOpSeen: this._lastOpSeen,
            }));
            return GLib.SOURCE_REMOVE;
        });
    }

    /* ---------------- timers ---------------- */

    _setTimer(name, secs, fn) {
        this._clearTimer(name);
        this._timers[name] = GLib.timeout_add_seconds(GLib.PRIORITY_LOW, Math.max(1, Math.round(secs)), () => {
            delete this._timers[name];
            fn();
            return GLib.SOURCE_REMOVE;
        });
    }

    // Millisecond variant, used only for the search-as-you-type debounce.
    _setTimerMs(name, ms, fn) {
        this._clearTimer(name);
        this._timers[name] = GLib.timeout_add(GLib.PRIORITY_DEFAULT, ms, () => {
            delete this._timers[name];
            fn();
            return GLib.SOURCE_REMOVE;
        });
    }

    _clearTimer(name) {
        if (this._timers[name]) {
            GLib.source_remove(this._timers[name]);
            delete this._timers[name];
        }
    }

    /* ---------------- schedule ---------------- */

    _computeNextDue(from) {
        if (!from)
            return 0;
        switch (this.checkMode) {
        case 'interval':
            return from + Math.max(1, this.checkInterval) * 3600;
        case 'daily':
        case 'weekly': {
            let t = this.checkMode === 'daily' ? this.checkTime : this.checkWeeklyTime;
            let h = (t && t.h) || 0, m = (t && t.m) || 0;
            let d = GLib.DateTime.new_from_unix_local(from);
            let c = GLib.DateTime.new_local(d.get_year(), d.get_month(), d.get_day_of_month(), h, m, 0);
            if (this.checkMode === 'daily') {
                if (c.to_unix() <= from)
                    c = c.add_days(1);
            } else {
                let want = this.checkWeekday === 0 ? 7 : this.checkWeekday; // GLib: 1=Mon..7=Sun
                c = c.add_days((want - c.get_day_of_week() + 7) % 7);
                if (c.to_unix() <= from)
                    c = c.add_days(7);
            }
            return c.to_unix();
        }
        default:
            return 0;
        }
    }

    // afterWake: called at login/resume, when the network may not be up yet.
    _scheduleNext(afterWake) {
        this._clearTimer('check');
        if (this.checkMode === 'manual') {
            this._nextDue = 0;
            this._updatePanel();
            return;
        }
        let now = nowSecs();
        let due = this._computeNextDue(this._lastCheck);
        let delay;
        if (due <= now) {
            if (afterWake && !this.checkAtLogin && this._lastCheck) {
                // No catch-up wanted: skip to the next slot.
                due = this._computeNextDue(now);
                delay = due - now;
            } else if (afterWake) {
                delay = Math.max(1, this.loginDelay) * 60;
                due = now + delay;
            } else {
                // Overdue: check soon, but never retry a failed attempt more
                // than once every 30 minutes.
                delay = now - this._lastAttempt < 1800 ? 1800 - (now - this._lastAttempt) : 2;
                due = now + delay;
            }
        } else {
            delay = due - now;
        }
        this._nextDue = due;
        // Monotonic timers stop during suspend; resume is handled via logind.
        // Cap at a day so clock changes (DST, NTP) can't push us far off.
        this._setTimer('check', Math.min(delay, 86400), () => {
            if (nowSecs() + 30 < this._nextDue)
                this._scheduleNext(false);
            else
                this._autoCheck();
        });
        this._updatePanel();
    }

    /* ---------------- power / network / sleep (event-driven) ---------------- */

    _connectSystemSignals() {
        this._netMon = Gio.NetworkMonitor.get_default();
        this._netSig = this._netMon.connect('network-changed', () => this._onConditionsChanged());

        Gio.DBusProxy.new_for_bus(Gio.BusType.SYSTEM, Gio.DBusProxyFlags.DO_NOT_AUTO_START, null,
            'org.freedesktop.UPower', '/org/freedesktop/UPower', 'org.freedesktop.UPower', null,
            (o, res) => {
                try {
                    this._upower = Gio.DBusProxy.new_for_bus_finish(res);
                    if (this._destroyed)
                        return;
                    this._upowerSig = this._upower.connect('g-properties-changed', () => this._onConditionsChanged());
                } catch (e) {
                    this._upower = null;
                }
            });

        this._sleepSub = Gio.DBus.system.signal_subscribe('org.freedesktop.login1',
            'org.freedesktop.login1.Manager', 'PrepareForSleep', '/org/freedesktop/login1', null,
            Gio.DBusSignalFlags.NONE, (c, s, p, i, sig, params) => {
                let [sleeping] = params.deep_unpack();
                if (!sleeping)
                    this._scheduleNext(true);
            });
    }

    _onBattery() {
        let v = this._upower ? this._upower.get_cached_property('OnBattery') : null;
        return v ? v.unpack() : false;
    }

    // Returns '' when automatic work may run, otherwise the reason it can't.
    _autoBlockedReason() {
        if (!this._netMon.network_available)
            return _("offline");
        if (this.skipOnMetered && this._netMon.network_metered)
            return _("metered connection");
        if (this.skipOnBattery && this._onBattery())
            return _("on battery");
        return '';
    }

    _onConditionsChanged() {
        if (!this._pendingAuto)
            return;
        if (this._autoBlockedReason() === '') {
            // Give the network a moment to settle after (re)connecting.
            this._setTimer('pending', 20, () => this._autoCheck());
        }
    }

    _autoCheck() {
        if (this._checking || this._op) {
            this._pendingAuto = true;
            return;
        }
        let why = this._autoBlockedReason();
        if (why) {
            this._pendingAuto = true;
            this._postponedWhy = why;
            this._updatePanel();
            return;
        }
        this._pendingAuto = false;
        this._postponedWhy = '';
        this.runCheck({ auto: true });
    }

    /* ---------------- processes ---------------- */

    _launcher(flags) {
        let l = new Gio.SubprocessLauncher({ flags });
        l.set_cwd(HOME);
        let localBin = GLib.build_filenamev([HOME, '.local', 'bin']);
        let path = GLib.getenv('PATH') || '/usr/bin:/bin';
        if (!path.split(':').includes(localBin))
            l.setenv('PATH', `${localBin}:${path}`, true);
        l.setenv('APPMAN_SETTING', (this.appmanPath || '').trim(), true);
        l.setenv('APPMAN_APPLET_JOBS', String(this.checkJobs || 4), true);
        l.setenv('APPMAN_APPLET_TIMEOUT', String(this.checkTimeout || 45), true);
        return l;
    }

    // Run argv asynchronously, collect stdout+stderr, call cb(output, exitStatus).
    _capture(argv, cb, cancellable = null, env = {}) {
        let proc;
        try {
            let l = this._launcher(Gio.SubprocessFlags.STDIN_PIPE | Gio.SubprocessFlags.STDOUT_PIPE |
                Gio.SubprocessFlags.STDERR_MERGE);
            for (let [k, v] of Object.entries(env))
                l.setenv(k, v, true);
            proc = l.spawnv(argv);
        } catch (e) {
            cb(null, -1);
            return null;
        }
        proc.communicate_utf8_async(null, cancellable, (p, res) => {
            try {
                let [, out] = p.communicate_utf8_finish(res);
                cb(out || '', p.get_if_exited() ? p.get_exit_status() : -1);
            } catch (e) {
                cb(null, -1);
            }
        });
        return proc;
    }

    /* ---------------- data ---------------- */

    _refreshList(done) {
        if (done)
            (this._listWaiters = this._listWaiters || []).push(done);
        if (this._listing)
            return;
        this._listing = true;
        this._capture(['bash', this._helper, 'list'], (out) => {
            this._listing = false;
            if (this._destroyed)
                return;
            if (out !== null) {
                let apps = [];
                for (let line of out.split('\n')) {
                    if (!line)
                        continue;
                    let f = line.split('\t');
                    if (f[0] === '#') {
                        this._amVersion = f[1] || '';
                        this._appsPath = f[2] || '';
                        this._appmanPath = f[3] || '';
                        continue;
                    }
                    if (f.length >= 5)
                        apps.push({ name: f[0], version: f[1], state: f[2], icon: f[3], path: f[4] });
                }
                this._apps = apps;
                this._listTime = nowSecs();
                this._pruneResults();
                this._installedDirty = true;
            }
            let waiters = this._listWaiters || [];
            this._listWaiters = [];
            waiters.forEach(w => w());
        });
    }

    // Drop results for removed apps and for apps updated outside the applet.
    _pruneResults() {
        let byName = new Map(this._apps.map(a => [a.name, a]));
        let changed = false;
        for (let n of Object.keys(this._results)) {
            let app = byName.get(n);
            let r = this._results[n];
            if (!app || (r.status === 'update' && !r.detail && app.version === r.latest)) {
                delete this._results[n];
                changed = true;
            }
        }
        if (changed)
            this._saveState();
    }

    _updates() {
        return this._apps.filter(a => a.state === 'updatable' &&
            this._results[a.name] && this._results[a.name].status === 'update');
    }

    _errors() {
        return this._apps.filter(a => a.state === 'updatable' &&
            this._results[a.name] && this._results[a.name].status === 'error');
    }

    /* ---------------- update check ---------------- */

    runCheck(opts = {}) {
        if (this._checking || this._destroyed)
            return;
        this._checking = true;
        this._lastAttempt = nowSecs();
        this._updatePanel();
        this._updateHeader();

        // helper.sh lowers its own CPU and I/O priority.
        let argv = ['bash', this._helper, 'check'].concat(opts.apps || []);
        this._checkCancel = new Gio.Cancellable();
        this._checkProc = this._capture(argv, (out) => {
            this._checking = false;
            this._checkProc = null;
            if (this._destroyed)
                return;
            if (out !== null) {
                let fresh = {};
                for (let line of out.split('\n')) {
                    let f = line.split('\t');
                    if (f.length >= 2 && f[0])
                        fresh[f[0]] = { status: f[1], latest: f[2] || '', detail: f[3] || '' };
                }
                if (opts.apps) {
                    Object.assign(this._results, fresh);
                } else {
                    this._results = fresh;
                    this._lastCheck = nowSecs();
                }
                this._saveState();
            }
            this._refreshList(() => {
                this._rebuildDynamic();
                if (out !== null)
                    this._afterCheck(opts);
                if (!opts.apps)
                    this._scheduleNext(false);
                if (this._pendingAuto && !this._op)
                    this._autoCheck();
            });
        }, this._checkCancel);
    }

    _afterCheck(opts) {
        let updates = this._updates().map(a => a.name);
        let newOnes = updates.filter(n => !this._notified.includes(n));
        this._notified = updates;
        this._saveState();

        if (opts.manual && updates.length === 0) {
            let errs = this._errors().length;
            this._notify(_("All AppImages are up to date"), errs
                ? _("Apps checked: %d. Could not check: %d.").format(this._apps.length, errs)
                : _("Apps checked: %d.").format(this._apps.length));
            return;
        }
        if (!opts.manual && (!opts.auto || newOnes.length === 0))
            return;
        if (opts.auto && this.onUpdates === 'install') {
            if (!this._op)
                this.updateApps(updates, { background: true, auto: true });
        } else if (opts.manual || this.onUpdates === 'notify') {
            let lines = this._updates().map(a => `${a.name}  ${a.version} → ${this._results[a.name].latest}`);
            let body = lines.slice(0, 8).join('\n');
            if (lines.length > 8)
                body += '\n' + _("… and %d more").format(lines.length - 8);
            this._notify(_("AppImage updates available: %d").format(updates.length), body,
                [{ id: 'update', label: _("Update now"), cb: () => this.updateApps(this._updates().map(a => a.name)) }]);
        }
    }

    /* ---------------- operations ---------------- */

    _terminalArgv() {
        let custom = (this.terminalCommand || '').trim();
        if (custom) {
            try {
                return GLib.shell_parse_argv(custom)[1];
            } catch (e) {
                global.logError(`${UUID}: invalid terminal command: ${e.message}`);
            }
        }
        let exec = 'x-terminal-emulator', arg = '-e';
        try {
            let s = new Gio.Settings({ schema_id: 'org.cinnamon.desktop.default-applications.terminal' });
            exec = s.get_string('exec') || exec;
            arg = s.get_string('exec-arg') || arg;
        } catch (e) {
            // keep the defaults
        }

        // Program names are resolved by GSubprocess at spawn time.
        let base = GLib.path_get_basename(exec);
        // Ghostty wrappers (e.g. "ghostty-here") may not forward -e: call ghostty itself.
        if (/ghostty/.test(base))
            return ['ghostty', '-e'];

        const table = {
            // Debian policy: x-terminal-emulator must accept "-e command args".
            'x-terminal-emulator': ['-e'],
            'gnome-terminal': ['--'], 'kgx': ['--'], 'ptyxis': ['--'],
            'xfce4-terminal': ['-x'], 'mate-terminal': ['-x'], 'terminator': ['-x'],
            'kitty': [], 'foot': [], 'footclient': [],
            'wezterm': ['start', '--'],
            'konsole': ['-e'], 'tilix': ['-e'], 'alacritty': ['-e'], 'xterm': ['-e'],
            'uxterm': ['-e'], 'lxterminal': ['-e'], 'qterminal': ['-e'], 'terminology': ['-e'],
        };
        return [exec].concat(table[base] || [arg]);
    }

    // args: appman arguments (without -y). opts: {title, background, apps, kind, auto, quiet}
    _runAppman(args, opts) {
        if (this._op) {
            this._notify(_("AppMan is busy"), _("Wait for \"%s\" to finish.").format(this._op.title));
            return;
        }
        if (!this._appmanPath && !this._listTime) {
            // Called before the first list refresh: resolve appman, then retry.
            this._refreshList(() => {
                if (this._listTime)
                    this._runAppman(args, opts);
            });
            return;
        }
        let bin = this._appmanPath;
        if (!bin) {
            this._notify(_("AppMan not found"), _("Set the path to appman in the applet settings."));
            return;
        }
        let background = opts.background || !this.useTerminal;
        let op = Object.assign({ id: String(Date.now()), started: false, background, startedAt: nowSecs(), args }, opts);
        this._op = op;
        this._updatePanel();
        this._updateHeader();
        this._setTimer('watchdog', OP_WATCHDOG_SECS, () => this._finishOp(op, null, -1));

        if (background) {
            // No tty: give appman's tput/fold a terminal type and a width.
            // helper.sh lowers the priority (idle I/O for automatic updates), then execs appman.
            this._capture(['bash', this._helper, 'bg', op.auto ? 'auto' : 'user', bin, '-y'].concat(args),
                (out, status) => this._finishOp(op, out, status), null, { TERM: 'dumb', COLUMNS: '100' });
            return;
        }

        // Terminal: completion comes back through the stamp file (inotify).
        try {
            this._stampMon = Gio.File.new_for_path(STAMP_FILE).monitor_file(Gio.FileMonitorFlags.NONE, null);
            this._stampMon.connect('changed', (m, f, o, ev) => {
                if (ev === Gio.FileMonitorEvent.CHANGES_DONE_HINT || ev === Gio.FileMonitorEvent.CREATED)
                    this._readStamp(op);
            });
            // "env bash" rather than "bash": some terminals (e.g. Ghostty)
            // inject shell integration flags when the command is bash itself.
            let argv = this._terminalArgv().concat(['env', 'bash', this._helper, 'run', STAMP_FILE, op.id, bin]).concat(args);
            // GSubprocess reaps the child by itself; nothing to wait for.
            this._launcher(Gio.SubprocessFlags.STDOUT_SILENCE | Gio.SubprocessFlags.STDERR_SILENCE).spawnv(argv);
        } catch (e) {
            this._finishOp(op, null, -1);
            this._notify(_("Could not open a terminal"),
                _("Check the terminal setting, or turn off \"Run menu actions in a terminal window\"."));
            return;
        }
        this._setTimer('opstart', OP_START_GRACE_SECS, () => {
            this._readStamp(op, () => {
                if (this._op === op && !op.started) {
                    this._finishOp(op, null, -1);
                    this._notify(_("The terminal did not start the command"),
                        _("Check \"Terminal command\" in the applet settings (for example \"gnome-terminal --\" or \"ghostty -e\")."));
                }
            });
        });
    }

    _readStamp(op, then = null) {
        loadText(STAMP_FILE, (txt) => {
            if (this._op === op) {
                let s = (txt || '').trim().split(/\s+/);
                if (s[1] === op.id) {
                    if (s[0] === 'start') {
                        op.started = true;
                    } else if (s[0] === 'done') {
                        op.started = true;
                        this._finishOp(op, null, parseInt(s[2]));
                    }
                }
            }
            if (then)
                then();
        });
    }

    _finishOp(op, output, status) {
        if (this._op !== op)
            return;
        this._op = null;
        this._clearTimer('watchdog');
        this._clearTimer('opstart');
        if (this._stampMon) {
            this._stampMon.cancel();
            this._stampMon = null;
        }
        if (this._destroyed)
            return;

        if (op.kind === 'remove' && status === 0)
            (op.apps || []).forEach(n => delete this._results[n]);

        // Record the outcome in the applet itself: desktop notifications may
        // be disabled (Do Not Disturb drops them entirely).
        let failed = status !== 0;
        let hasLog = false;
        if (op.background && output !== null) {
            let clean = output.replace(ANSI_RE, '').replace(/\r/g, '\n').split('\n')
                .map(l => l.trimEnd()).filter(l => l.trim() && !/^\s*[-─━=]{6,}\s*$/.test(l));
            // appman exits 0 even on errors, so read its messages.
            failed = failed || clean.some(l => /✖|💀|\bERROR\b|cannot be|cannot manage/i.test(l));
            let started = GLib.DateTime.new_from_unix_local(op.startedAt).format('%Y-%m-%d %H:%M:%S');
            saveText(LOG_FILE, [
                `# ${op.title}`,
                `# appman -y ${op.args.join(' ')}`,
                `# started ${started}, ${nowSecs() - op.startedAt}s, exit code ${status}`,
                '',
            ].concat(clean).join('\n') + '\n');
            hasLog = true;
            if (!op.quiet || failed) {
                let tail = clean.filter(l => !/^\s*>>/.test(l)).slice(-5).map(l => l.trim()).join('\n');
                this._notify(failed ? _("%s: finished with problems").format(op.title)
                    : _("%s: done").format(op.title), tail);
            }
        }
        this._lastOp = { title: op.title, ok: !failed, time: nowSecs(), log: hasLog };
        this._lastOpSeen = !failed;

        this._refreshList(() => {
            this._rebuildDynamic();
            this._saveState();
            if (this._pendingAuto)
                this._autoCheck();
        });
    }

    updateApps(names, opts = {}) {
        if (!names.length)
            return;
        this._runAppman(['-u'].concat(names), {
            title: names.length === 1 ? _("Update %s").format(names[0]) : _("Update %d apps").format(names.length),
            apps: names, kind: 'update', background: opts.background, auto: opts.auto,
        });
    }

    fullUpdate() {
        this._runAppman(this.updateAllSyncs ? ['-u'] : ['-u', '--apps'],
            { title: _("Full update"), kind: 'update' });
    }

    installApp(name, desc) {
        this._confirm(_("Install \"%s\"?").format(name) + (desc ? `\n\n${desc}` : ''), () =>
            this._runAppman(['-i', name], { title: _("Install %s").format(name), apps: [name], kind: 'install' }));
    }

    reinstallApp(name) {
        this._confirm(_("Reinstall \"%s\"?\nAppMan removes it and installs it again from its database.").format(name), () =>
            this._runAppman(['reinstall', name], { title: _("Reinstall %s").format(name), apps: [name], kind: 'reinstall' }));
    }

    removeApp(name) {
        this._confirm(_("Remove \"%s\"?\nThe app and its launcher will be deleted.").format(name), () =>
            // Already confirmed here, so -R (no second prompt) in both modes.
            this._runAppman(['-R', name], { title: _("Remove %s").format(name), apps: [name], kind: 'remove' }));
    }

    lockApp(name, lock) {
        this._runAppman([lock ? 'lock' : 'unlock', name], {
            title: lock ? _("Lock %s").format(name) : _("Unlock %s").format(name),
            apps: [name], kind: 'lock', background: true, quiet: true,
        });
    }

    launchApp(app) {
        // AppMan installs launchers as "<app>-AM.desktop"; Cinnamon already has them cached.
        let cinnamonApp = Cinnamon.AppSystem.get_default().lookup_app(`${app.name}-AM.desktop`);
        if (cinnamonApp) {
            cinnamonApp.activate();
            return;
        }
        try {
            let exe = GLib.build_filenamev([app.path, app.name]);
            this._launcher(Gio.SubprocessFlags.STDOUT_SILENCE | Gio.SubprocessFlags.STDERR_SILENCE).spawnv([exe]);
        } catch (e) {
            this._notify(_("Could not launch %s").format(app.name), e.message);
        }
    }

    _openUri(path) {
        try {
            Gio.app_info_launch_default_for_uri(Gio.File.new_for_path(path).get_uri(),
                global.create_app_launch_context());
        } catch (e) {
            global.logError(`${UUID}: cannot open ${path}: ${e.message}`);
        }
    }

    _confirm(text, cb) {
        new ModalDialog.ConfirmDialog(text, cb).open();
    }

    _notify(title, body, actions = []) {
        if (this._destroyed)
            return;
        if (!this._source) {
            this._source = new MessageTray.Source('AppMan');
            let iconPath = GLib.build_filenamev([this._dir, 'icon.png']);
            this._source.createNotificationIcon = () => new St.Icon({
                gicon: new Gio.FileIcon({ file: Gio.File.new_for_path(iconPath) }),
                icon_size: this._source.ICON_SIZE,
            });
            this._source._setSummaryIcon(this._source.createNotificationIcon());
            this._source.connect('destroy', () => {
                this._source = null;
            });
            Main.messageTray.add(this._source);
        }
        let n = new MessageTray.Notification(this._source, title, body);
        n.setTransient(actions.length === 0);
        for (let a of actions)
            n.addButton(a.id, a.label);
        if (actions.length) {
            n.connect('action-invoked', (notification, id) => {
                let a = actions.find(x => x.id === id);
                if (a)
                    a.cb();
            });
        }
        this._source.notify(n);
    }

    /* ---------------- panel ---------------- */

    _updatePanel() {
        if (this._destroyed)
            return;
        let count = this._updates().length;
        let icon = 'appman-symbolic';
        if (this._checking || this._op)
            icon = 'appman-busy-symbolic';
        else if (this._lastOp && !this._lastOp.ok && !this._lastOpSeen)
            icon = 'appman-error-symbolic';
        else if (count > 0)
            icon = 'appman-update-symbolic';
        if (icon !== this._iconName) {
            this._iconName = icon;
            this.set_applet_icon_symbolic_path(GLib.build_filenamev([this._dir, 'icons', `${icon}.svg`]));
        }
        this.set_applet_label(this.showCount && count > 0 ? String(count) : '');

        let tip = ['AppMan'];
        if (this._op)
            tip.push(_("Running: %s").format(this._op.title));
        else if (this._checking)
            tip.push(_("Checking for updates…"));
        else
            tip.push(count ? _("Updates available: %d").format(count) : _("All apps are up to date"));
        tip.push(_("Last check: %s").format(fmtTime(this._lastCheck)));
        if (this._lastOp && !this._op) {
            tip.push(this._lastOp.ok ? _("Last operation: %s (done)").format(this._lastOp.title)
                : _("Last operation: %s (problems)").format(this._lastOp.title));
        }
        if (this._pendingAuto && this._postponedWhy)
            tip.push(_("Check postponed (%s)").format(this._postponedWhy));
        else if (this.checkMode === 'manual')
            tip.push(_("Automatic checks are off"));
        else if (this._nextDue)
            tip.push(_("Next check: %s").format(fmtTime(this._nextDue)));
        this.set_applet_tooltip(tip.join('\n'));
    }

    /* ---------------- menu ---------------- */

    _buildMenu(orientation) {
        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);
        this.menu.actor.add_style_class_name('appman-menu');

        // Header
        this._header = new FlatItem({ reactive: false });
        let hbox = new St.BoxLayout({ vertical: true, style_class: 'appman-header' });
        this._titleLabel = new St.Label({ text: 'AppMan', style_class: 'appman-title' });
        this._subLabel = new St.Label({ text: '', style_class: 'appman-subtitle' });
        hbox.add_child(this._titleLabel);
        hbox.add_child(this._subLabel);
        this._header.row.add_child(hbox);
        this._header.actor.remove_style_pseudo_class('insensitive');
        this.menu.addMenuItem(this._header);

        this._checkItem = new PopupMenu.PopupIconMenuItem(_("Check for updates"), 'xsi-view-refresh', St.IconType.SYMBOLIC);
        this._checkItem.connect('activate', () => this.runCheck({ manual: true }));
        this.menu.addMenuItem(this._checkItem);

        this._updateAllItem = new PopupMenu.PopupIconMenuItem(_("Update all"), 'xsi-document-save', St.IconType.SYMBOLIC);
        this._updateAllItem.connect('activate', () => this.updateApps(this._updates().map(a => a.name)));
        this.menu.addMenuItem(this._updateAllItem);

        this._updatesSection = new PopupMenu.PopupMenuSection();
        this.menu.addMenuItem(this._updatesSection);

        this._lastOpItem = new PopupMenu.PopupIconMenuItem('', 'xsi-emblem-ok', St.IconType.SYMBOLIC);
        this._lastOpItem.connect('activate', () => {
            if (this._lastOp && this._lastOp.log)
                this._openUri(LOG_FILE);
        });
        this.menu.addMenuItem(this._lastOpItem);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Installed apps (rows built lazily when opened)
        this._installedItem = new PopupMenu.PopupSubMenuMenuItem(_("Installed apps"));
        this._installedItem.menu.connect('open-state-changed', (m, open) => {
            if (!open || this._destroyed)
                return;
            if (this._installedDirty)
                this._buildInstalled();
            // PopupSubMenu only scrolls when the whole menu hits the screen
            // edge; this list should scroll within its own max-height.
            m.actor.vscrollbar_policy = St.PolicyType.AUTOMATIC;
        });
        this.menu.addMenuItem(this._installedItem);

        // Install: search box
        this._searchItem = new FlatItem({ reactive: false });
        this._searchEntry = new St.Entry({
            name: 'menu-search-entry',
            style_class: 'appman-search-entry',
            hint_text: _("Search the AppMan database to install…"),
            can_focus: true,
            track_hover: true,
            x_expand: true,
        });
        this._searchEntry.clutter_text.connect('text-changed', () => {
            this._setTimerMs('search', 250, () => this._doSearch());
        });
        this._searchItem.row.add_child(this._searchEntry);
        this.menu.addMenuItem(this._searchItem);
        this._resultsSection = new PopupMenu.PopupMenuSection();
        this.menu.addMenuItem(this._resultsSection);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Tools
        let tools = new PopupMenu.PopupSubMenuMenuItem(_("AppMan tools"));
        let addTool = (label, icon, cb) => {
            let it = new PopupMenu.PopupIconMenuItem(label, icon, St.IconType.SYMBOLIC);
            it.connect('activate', cb);
            tools.menu.addMenuItem(it);
        };
        addTool(_("Full update (appman -u)"), 'xsi-document-save', () => this.fullUpdate());
        addTool(_("Reinstall apps whose install script changed"), 'xsi-view-refresh',
            () => this._runAppman(['reinstall'], { title: _("Reinstall changed apps"), kind: 'reinstall' }));
        addTool(_("Update AppMan itself (appman -s)"), 'xsi-emblem-synchronizing',
            () => this._runAppman(['-s'], { title: _("Update AppMan"), kind: 'sync' }));
        addTool(_("Clean up leftovers (appman -c)"), 'xsi-user-trash',
            () => this._runAppman(['-c'], { title: _("Clean up"), kind: 'clean' }));
        addTool(_("Open the apps folder"), 'xsi-folder-open', () => {
            if (this._appsPath)
                this._openUri(this._appsPath);
        });
        addTool(_("Applet settings"), 'xsi-applications-preferences', () => this.configureApplet());
        this.menu.addMenuItem(tools);

        this.menu.connect('open-state-changed', (m, open) => {
            if (this._destroyed)
                return;
            if (open) {
                if (!this._lastOpSeen) {
                    this._lastOpSeen = true;
                    this._updatePanel();
                    this._saveState();
                }
                this._updateHeader();
                if (nowSecs() - this._listTime > LIST_STALE_SECS && !this._op)
                    this._refreshList(() => this._rebuildDynamic());
            } else {
                // Free the search database and results.
                if (this._searchEntry.get_text())
                    this._searchEntry.set_text('');
                this._clearTimer('search');
                this._resultsSection.removeAll();
                this._db = null;
            }
        });
    }

    on_applet_clicked() {
        this.menu.toggle();
    }

    _updateHeader() {
        if (this._destroyed)
            return;
        let count = this._updates().length;
        this._titleLabel.set_text(this._amVersion ? `AppMan ${this._amVersion}` : 'AppMan');
        let parts = [];
        if (this._op) {
            parts.push(_("Running: %s (since %s)").format(this._op.title, fmtTime(this._op.startedAt)));
        } else if (this._checking) {
            parts.push(_("Checking for updates…"));
        } else {
            parts.push(_("Apps: %d").format(this._apps.length));
            parts.push(count ? _("Updates: %d").format(count) : _("up to date"));
            parts.push(_("checked %s").format(fmtTime(this._lastCheck)));
        }
        this._subLabel.set_text(parts.join('  ·  '));

        let lo = this._lastOp;
        this._lastOpItem.actor.visible = !!lo && !this._op;
        if (lo) {
            let text = lo.ok ? _("%s: done at %s").format(lo.title, fmtTime(lo.time))
                : _("%s: problems at %s").format(lo.title, fmtTime(lo.time));
            if (lo.log)
                text += '  ·  ' + _("show log");
            this._lastOpItem.label.set_text(text);
            this._lastOpItem.setIconSymbolicName(lo.ok ? 'xsi-emblem-ok' : 'xsi-dialog-warning');
            this._lastOpItem.setSensitive(!!lo.log);
        }
        this._checkItem.label.set_text(this._checking ? _("Checking…") : _("Check for updates"));
        this._checkItem.setSensitive(!this._checking && !this._op);
        this._updateAllItem.label.set_text(count > 1 ? _("Update all (%d)").format(count) : _("Update"));
        this._updateAllItem.actor.visible = count > 0;
        this._updateAllItem.setSensitive(!this._op);
    }

    _rebuildDynamic() {
        if (this._destroyed)
            return;
        this._updatePanel();
        this._updateHeader();

        this._updatesSection.removeAll();
        let updates = this._updates();
        for (let app of updates.slice(0, MAX_UPDATE_ROWS))
            this._updatesSection.addMenuItem(new AppRow(this, app, { kind: 'update', result: this._results[app.name] }));
        if (updates.length > MAX_UPDATE_ROWS) {
            let more = new PopupMenu.PopupMenuItem(
                _("… and %d more (see Installed apps)").format(updates.length - MAX_UPDATE_ROWS), { reactive: false });
            more.label.add_style_class_name('appman-dim');
            this._updatesSection.addMenuItem(more);
        }
        let errs = this._errors();
        if (errs.length) {
            let it = new PopupMenu.PopupMenuItem(
                _("Could not check: %s").format(errs.map(a => a.name).join(', ')), { reactive: false });
            it.label.add_style_class_name('appman-dim');
            this._updatesSection.addMenuItem(it);
        }

        this._installedItem.label.set_text(_("Installed apps (%d)").format(this._apps.length));
        this._installedDirty = true;
        if (this._installedItem.menu.isOpen)
            this._buildInstalled();
    }

    _buildInstalled() {
        this._installedDirty = false;
        let menu = this._installedItem.menu;
        let mon = Main.layoutManager.findMonitorForActor(this.actor) || Main.layoutManager.primaryMonitor;
        menu.actor.set_style(`max-height: ${Math.floor(mon.height * 0.4 / global.ui_scale)}px;`);
        menu.removeAll();
        for (let app of this._apps)
            menu.addMenuItem(new AppRow(this, app, { kind: 'installed', result: this._results[app.name] }));
        if (!this._apps.length)
            menu.addMenuItem(new PopupMenu.PopupMenuItem(_("No apps installed with AppMan"), { reactive: false }));
    }

    appIcon(app, size) {
        if (app.icon)
            return new St.Icon({ gicon: new Gio.FileIcon({ file: Gio.File.new_for_path(app.icon) }), icon_size: size });
        return new St.Icon({ icon_name: 'application-x-executable', icon_size: size, icon_type: St.IconType.FULLCOLOR });
    }

    /* ---------------- search ---------------- */

    // Loads AppMan's app list (<user data dir>/AM/<arch>-apps) asynchronously, then calls done().
    _loadDb(done, i = 0) {
        if (i >= DB_ARCHES.length) {
            this._db = [];
            done();
            return;
        }
        let path = GLib.build_filenamev([GLib.get_user_data_dir(), 'AM', `${DB_ARCHES[i]}-apps`]);
        loadText(path, (txt) => {
            if (!txt) {
                this._loadDb(done, i + 1);
                return;
            }
            let db = [];
            for (let line of txt.split('\n')) {
                let m = /^◆ (\S+) : (.*)$/.exec(line);
                if (m)
                    db.push({ n: m[1], d: m[2], l: m[2].toLowerCase() });
            }
            this._db = db;
            done();
        });
    }

    _doSearch() {
        if (this._destroyed)
            return;
        let q = this._searchEntry.get_text().trim().toLowerCase();
        if (q.length < 2) {
            this._resultsSection.removeAll();
            return;
        }
        if (!this._db) {
            if (!this._dbLoading) {
                this._dbLoading = true;
                this._loadDb(() => {
                    this._dbLoading = false;
                    if (this.menu.isOpen)
                        this._doSearch();
                    else
                        this._db = null;
                });
            }
            return;
        }
        this._resultsSection.removeAll();
        let db = this._db;
        if (!db.length) {
            this._resultsSection.addMenuItem(new PopupMenu.PopupMenuItem(
                _("AppMan database not found: run \"appman -l\" once"), { reactive: false }));
            return;
        }
        let max = this.maxSearchResults || 12;
        let exact = [], starts = [], contains = [], desc = [];
        for (let e of db) {
            if (e.n === q)
                exact.push(e);
            else if (e.n.startsWith(q))
                starts.push(e);
            else if (e.n.includes(q))
                contains.push(e);
            else if (desc.length < max && e.l.includes(q))
                desc.push(e);
        }
        let hits = exact.concat(starts, contains, desc).slice(0, max);
        let installed = new Set(this._apps.map(a => a.name));
        for (let e of hits)
            this._resultsSection.addMenuItem(new ResultRow(this, e, installed.has(e.n)));
        if (!hits.length)
            this._resultsSection.addMenuItem(new PopupMenu.PopupMenuItem(_("No matches"), { reactive: false }));
    }

    /* ---------------- teardown ---------------- */

    on_applet_removed_from_panel() {
        this._destroyed = true;
        for (let name of Object.keys(this._timers))
            this._clearTimer(name);
        if (this._checkProc) {
            this._checkCancel.cancel();
            this._checkProc.force_exit();
        }
        if (this._stampMon)
            this._stampMon.cancel();
        if (this._netSig)
            this._netMon.disconnect(this._netSig);
        if (this._upower && this._upowerSig)
            this._upower.disconnect(this._upowerSig);
        if (this._sleepSub)
            Gio.DBus.system.signal_unsubscribe(this._sleepSub);
        if (this._source)
            this._source.destroy();
        this.settings.finalize();
        this.menu.destroy();
    }
}

function main(metadata, orientation, panelHeight, instanceId) {
    setupPaths(metadata.uuid);
    return new AppManApplet(metadata, orientation, panelHeight, instanceId);
}
