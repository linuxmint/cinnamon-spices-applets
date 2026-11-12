// Copyright (c) 2026 tedacodder. Released under the MIT License (see LICENSE).
// Portions derived from check_ur_todo (Copyright (c) 2026 Dejan Vitasovic and
// Copyright (c) 2026 Aston Lewis), itself based on omarchy-priority-todos. The
// upstream MIT notice is in LICENSE-third-party.txt.

// Todo List: a Cinnamon panel applet for a short, prioritized task list.
// Port of check_ur_todo (MIT, Aston Lewis), itself based on
// omarchy-priority-todos by Dejan V. (MIT). See README.md for credits.
//
// Sections: constants, pure task logic (no Cinnamon calls, so the Node
// tests can run it), store file, the applet class.

const Applet = imports.ui.applet;
const ModalDialog = imports.ui.modalDialog;
const St = imports.gi.St;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Clutter = imports.gi.Clutter;
const ByteArray = imports.byteArray;
const Main = imports.ui.main;
const Gettext = imports.gettext;

const UUID = 'todo-list@tedacodder';

// Translations: the .po files live in the applet's locale folder.
Gettext.bindtextdomain(UUID, GLib.get_user_data_dir() + '/locale');
function _(text) {
    return Gettext.dgettext(UUID, text);
}
const APPLET_DIR = GLib.get_user_data_dir() + '/cinnamon/applets/' + UUID;

// Themes. The window's colours come from stylesheet.css, where each theme has
// its own block. The values here are used for the badge and the daily edge.
// Priority colours are the same in both themes, so a priority means the same
// thing wherever you are.
const THEMES = {
    neon: { label: 'Neon', accent: '#39FF14' },
    omarchy: { label: 'Omarchy', accent: '#7AA2F7' },   // Tokyo Night, Omarchy's default palette
    ember: { label: 'Ember', accent: '#FFB547' },        // warm graphite with amber
    paper: { label: 'Paper', accent: '#A34A08', chipText: '#1F1B16' },  // light theme
    sakura: { label: 'Sakura', accent: '#FF8FB1' },     // plum-black with blossom pink
    lagoon: { label: 'Lagoon', accent: '#4FD1C5' },     // deep sea-teal with aqua
};
const THEME_ORDER = ['neon', 'omarchy', 'ember', 'paper', 'sakura', 'lagoon'];

// Text colours used when a priority chip is picked, so the words read well
// on every priority colour.
const INK = '#111318';
function luminance(hex) {
    const h = hex.replace('#', '');
    const c = [0, 2, 4]
        .map(i => parseInt(h.substr(i, 2), 16) / 255)
        .map(v => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function contrastRatio(a, b) {
    const la = luminance(a);
    const lb = luminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
// Dark or white text, whichever reads better on the given background.
function readableTextOn(background) {
    return contrastRatio(background, INK) >= contrastRatio(background, '#FFFFFF') ? INK : '#FFFFFF';
}

// Colours and timings. Change them here, and the theme blocks in stylesheet.css.
const PRIORITY_COLORS = {
    critical: '#E24B4A',
    high: '#E8892D',
    medium: '#D4B43C',
    low: '#3D8FD9',
};
const DAILY_CHECK_SECONDS = 60;   // how often the daily reset is checked

// The keyboard shortcut that opens and closes the window. To use another key,
// change HOTKEY, for example to '<Super>t'. Format: <Primary> Ctrl, <Alt>, <Super>, <Shift>.
const HOTKEY_NAME = 'todo-list-toggle';
const HOTKEY = '<Primary><Alt>d';

// Turns a Cinnamon key string into the text shown to the user.
// '<Primary><Alt>d' becomes 'Ctrl+Alt+D'.
function hotkeyLabel(combo) {
    const names = { Primary: 'Ctrl', Control: 'Ctrl', Alt: 'Alt', Super: 'Super', Shift: 'Shift' };
    const parts = [];
    const pattern = /<([A-Za-z]+)>/g;
    let match;
    while ((match = pattern.exec(combo)) !== null) {
        parts.push(names[match[1]] || match[1]);
    }
    const rest = combo.replace(pattern, '');
    if (rest.length > 0) parts.push(rest.length === 1 ? rest.toUpperCase() : rest);
    return parts.join('+');
}

// ---------------------------------------------------------------------------
// Pure task logic. Each function returns new arrays or objects; nothing
// mutates its input. Ported from Todos.js in check_ur_todo.
// ---------------------------------------------------------------------------

const RANK = { critical: 0, high: 1, medium: 2, low: 3 };
const PRIORITY_LABELS = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' };
const PRIORITY_OPTIONS = ['critical', 'high', 'medium', 'low'];
const TAB_OPTIONS = [
    { value: 'daily', label: 'Daily' },
    { value: 'backlog', label: 'Backlog' },
    { value: 'ongoing', label: 'Ongoing' },
    { value: 'complete', label: 'Completed' },
];
const STATUSES = ['backlog', 'ongoing', 'complete'];

function has(obj, key) {
    return Object.prototype.hasOwnProperty.call(obj, key);
}

function trim(value) {
    return String(value || '').replace(/^\s+|\s+$/g, '');
}

function localDateKey(date) {
    const d = date || new Date();
    let month = String(d.getMonth() + 1);
    let day = String(d.getDate());
    if (month.length < 2) month = '0' + month;
    if (day.length < 2) day = '0' + day;
    return d.getFullYear() + '-' + month + '-' + day;
}

function normalizePriority(value) {
    const p = String(value || '').toLowerCase();
    return has(RANK, p) ? p : 'medium';
}

function normalizeStatus(status, completed) {
    const v = String(status || '').toLowerCase();
    if (STATUSES.indexOf(v) >= 0) return v;
    return completed === true ? 'complete' : 'ongoing';
}

function normalizeTab(tab) {
    const v = String(tab || '').toLowerCase();
    const values = TAB_OPTIONS.map(t => t.value);
    return values.indexOf(v) >= 0 ? v : 'ongoing';
}

function addStatusForTab(tab) {
    return String(tab || '') === 'backlog' ? 'backlog' : 'ongoing';
}

function cycleTab(current, direction) {
    const n = TAB_OPTIONS.length;
    let i = TAB_OPTIONS.findIndex(t => t.value === current);
    if (i < 0) i = 1;
    let next = i + (direction > 0 ? 1 : -1);
    if (next < 0) next = n - 1;
    if (next >= n) next = 0;
    return TAB_OPTIONS[next].value;
}

function rank(priority) {
    return RANK[normalizePriority(priority)];
}

function priorityColor(priority) {
    return PRIORITY_COLORS[normalizePriority(priority)];
}

function priorityLabel(priority) {
    return PRIORITY_LABELS[normalizePriority(priority)];
}

function statusLabel(status) {
    const v = normalizeStatus(status, false);
    if (v === 'backlog') return 'Backlog';
    if (v === 'complete') return 'Completed';
    return 'Ongoing';
}

function newId() {
    return Date.now().toString(36) + '-' + Math.floor(Math.random() * 1e9).toString(36);
}

function withFields(task, fields) {
    const next = {};
    Object.keys(task).forEach(k => { next[k] = task[k]; });
    Object.keys(fields).forEach(k => { next[k] = fields[k]; });
    return next;
}

function createTask(title, description, priority, status) {
    let nextStatus = normalizeStatus(status, false);
    if (nextStatus === 'complete') nextStatus = 'ongoing';
    return {
        id: newId(),
        title: trim(title),
        description: trim(description),
        priority: normalizePriority(priority),
        status: nextStatus,
        completed: false,
        createdAt: Date.now(),
        completedAt: 0,
    };
}

function createDailyTask(title, description) {
    return {
        id: 'daily-' + newId(),
        title: trim(title),
        description: trim(description),
        completed: false,
        createdAt: Date.now(),
        completedAt: 0,
    };
}

function normalizeTask(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const title = trim(raw.title);
    if (title === '') return null;
    const status = normalizeStatus(raw.status, raw.completed);
    return {
        id: String(raw.id || newId()),
        title: title,
        description: trim(raw.description),
        priority: normalizePriority(raw.priority),
        status: status,
        completed: status === 'complete',
        createdAt: Number(raw.createdAt) || 0,
        completedAt: Number(raw.completedAt) || 0,
    };
}

function normalizeDailyTask(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const title = trim(raw.title);
    if (title === '') return null;
    return {
        id: String(raw.id || ('daily-' + newId())),
        title: title,
        description: trim(raw.description),
        completed: raw.completed === true,
        createdAt: Number(raw.createdAt) || 0,
        completedAt: Number(raw.completedAt) || 0,
    };
}

// Parses the todos.json text. Accepts the v2 object form and a bare array.
// valid is false when the text is not JSON, so the caller can refuse to
// overwrite a file it cannot read.
function parseStore(raw) {
    const text = trim(raw);
    const empty = { tasks: [], dailyTasks: [], dailyResetDate: '', activeTab: 'ongoing', valid: true };
    if (text === '') return empty;
    let data;
    try {
        data = JSON.parse(text);
    } catch (e) {
        return { tasks: [], dailyTasks: [], dailyResetDate: '', activeTab: 'ongoing', valid: false };
    }
    const list = Array.isArray(data) ? data : (data && Array.isArray(data.tasks) ? data.tasks : []);
    const dailyList = data && Array.isArray(data.dailyTasks) ? data.dailyTasks : [];
    const resetDate = data && /^\d{4}-\d{2}-\d{2}$/.test(String(data.dailyResetDate || ''))
        ? String(data.dailyResetDate)
        : '';
    return {
        tasks: list.map(normalizeTask).filter(t => t !== null),
        dailyTasks: dailyList.map(normalizeDailyTask).filter(t => t !== null),
        dailyResetDate: resetDate,
        activeTab: normalizeTab(data && data.activeTab),
        valid: true,
    };
}

function serialize(tasks, activeTab, dailyTasks, dailyResetDate) {
    return JSON.stringify({
        version: 2,
        activeTab: normalizeTab(activeTab),
        tasks: tasks || [],
        dailyTasks: dailyTasks || [],
        dailyResetDate: String(dailyResetDate || ''),
    }, null, 2) + '\n';
}

function matches(task, query) {
    const needle = trim(query).toLowerCase();
    if (needle === '') return true;
    return String(task.title || '').toLowerCase().indexOf(needle) >= 0
        || String(task.description || '').toLowerCase().indexOf(needle) >= 0
        || priorityLabel(task.priority).toLowerCase().indexOf(needle) >= 0
        || statusLabel(task.status).toLowerCase().indexOf(needle) >= 0;
}

function compareTasks(a, b) {
    const delta = rank(a.priority) - rank(b.priority);
    if (delta !== 0) return delta;
    if (a.status === 'complete' && b.status === 'complete') {
        return (Number(b.completedAt) || 0) - (Number(a.completedAt) || 0);
    }
    return (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0);
}

function listed(tasks, query, status) {
    const want = normalizeStatus(status, false);
    return (tasks || [])
        .filter(t => t && normalizeStatus(t.status, t.completed) === want && matches(t, query))
        .sort(compareTasks);
}

function listedDaily(tasks, query) {
    const needle = trim(query).toLowerCase();
    return (tasks || [])
        .filter(t => t && (needle === ''
            || String(t.title || '').toLowerCase().indexOf(needle) >= 0
            || String(t.description || '').toLowerCase().indexOf(needle) >= 0))
        .sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0));
}

function addItem(list, task) {
    if (!task || !task.title) return list || [];
    return [task].concat(list || []);
}

// Returns the same array when nothing changed, otherwise a new one.
function mapById(list, id, fn) {
    const source = list || [];
    let changed = false;
    const out = source.map(t => {
        if (!t || t.id !== id) return t;
        const next = fn(t);
        if (next !== t) changed = true;
        return next;
    });
    return changed ? out : source;
}

function setStatus(tasks, id, status) {
    const next = normalizeStatus(status, false);
    const now = Date.now();
    return mapById(tasks, id, t => {
        if (t.status === next) return t;
        return withFields(t, {
            status: next,
            completed: next === 'complete',
            completedAt: next === 'complete' ? now : 0,
        });
    });
}

function setCompleted(tasks, id, completed) {
    return setStatus(tasks, id, completed === true ? 'complete' : 'ongoing');
}

function setDailyCompleted(tasks, id, completed) {
    const value = completed === true;
    return mapById(tasks, id, t => {
        if ((t.completed === true) === value) return t;
        return withFields(t, { completed: value, completedAt: value ? Date.now() : 0 });
    });
}

function removeById(list, id) {
    return (list || []).filter(t => t && t.id !== id);
}

function removeCompleted(tasks) {
    return (tasks || []).filter(t => t && normalizeStatus(t.status, t.completed) !== 'complete');
}

function updateTask(tasks, id, title, description, priority) {
    const nextTitle = trim(title);
    const nextDescription = trim(description);
    const nextPriority = normalizePriority(priority);
    if (nextTitle === '') return tasks || [];
    return mapById(tasks, id, t => {
        if (t.title === nextTitle && t.description === nextDescription && t.priority === nextPriority) return t;
        return withFields(t, { title: nextTitle, description: nextDescription, priority: nextPriority });
    });
}

function updateDailyTask(tasks, id, title, description) {
    const nextTitle = trim(title);
    const nextDescription = trim(description);
    if (nextTitle === '') return tasks || [];
    return mapById(tasks, id, t => {
        if (t.title === nextTitle && t.description === nextDescription) return t;
        return withFields(t, { title: nextTitle, description: nextDescription });
    });
}

// Daily tasks: clear the completed flag on the first check of a new day.
// Titles and descriptions are kept. Returns changed=false on the same day.
function rollDailyTasks(tasks, previousDate, currentDate) {
    const date = String(currentDate || '');
    if (String(previousDate || '') === date) {
        return { tasks: tasks || [], dailyResetDate: date, changed: false };
    }
    const reset = (tasks || []).map(t => {
        if (!t || t.completed !== true) return t;
        return withFields(t, { completed: false, completedAt: 0 });
    });
    return { tasks: reset, dailyResetDate: date, changed: true };
}

function ongoingCount(tasks) {
    return (tasks || []).filter(t => t && normalizeStatus(t.status, t.completed) === 'ongoing').length;
}

// The highest priority among ongoing tasks, or '' when there are none.
// Backlog and completed tasks do not count.
function highestOngoing(tasks) {
    let best = '';
    let bestRank = 99;
    (tasks || []).forEach(t => {
        if (!t || normalizeStatus(t.status, t.completed) !== 'ongoing') return;
        const r = rank(t.priority);
        if (r < bestRank) {
            bestRank = r;
            best = normalizePriority(t.priority);
        }
    });
    return best;
}

function emptyMessage(query, activeTab, taskCount) {
    if (trim(query) !== '') return 'No tasks match \u201c' + query + '\u201d';
    if (activeTab === 'daily') return taskCount === 0 ? 'No daily tasks yet' : 'No daily tasks match';
    if (activeTab === 'complete') return 'Nothing completed yet';
    if (activeTab === 'backlog') return 'Nothing in the backlog';
    return taskCount === 0 ? 'Nothing on the list yet' : 'Nothing ongoing';
}

function badgeTooltip(count, highest) {
    if (count <= 0) return 'Todo List';
    const head = count === 1 ? '1 ongoing' : count + ' ongoing';
    if (highest === 'critical' || highest === 'high') return head + ' \u00b7 ' + priorityLabel(highest);
    return head;
}

function themeClass(name) {
    return 'todo-theme-' + name;
}

function settingsPath() {
    return GLib.build_filenamev([GLib.get_user_state_dir(), 'todo-list', 'settings.json']);
}

// The saved theme, or neon if nothing is saved or the saved name is unknown.
function loadThemeAsync(callback) {
    readTextAsync(settingsPath(), (text) => {
        let name = 'neon';
        try {
            if (text !== null && has(THEMES, JSON.parse(text).theme)) name = JSON.parse(text).theme;
        } catch (e) {
            name = 'neon';
        }
        callback(name);
    });
}

function saveThemeAsync(name) {
    writeTextAsync(settingsPath(), JSON.stringify({ theme: name }, null, 2) + '\n', (error) => {
        if (error) global.log('[todo-list] could not save the theme: ' + error);
    });
}

function freshState() {
    return { tasks: [], dailyTasks: [], dailyResetDate: '', activeTab: 'ongoing' };
}

// Sets the chip buttons so only the selected priority is highlighted.
// unselectedText: the theme's own text colour for unpicked chips, or null to
// use each priority's colour.
function paintChips(chips, selected, unselectedText) {
    chips.forEach(c => {
        const colour = PRIORITY_COLORS[c.p];
        if (c.p === selected) {
            c.btn.add_style_class_name('todo-chip-selected');
            c.btn.set_style('background-color: ' + colour + '; border-color: ' + colour
                + '; color: ' + readableTextOn(colour) + ';');
        } else {
            c.btn.remove_style_class_name('todo-chip-selected');
            c.btn.set_style('background-color: transparent; color: ' + (unselectedText || colour) + ';');
        }
    });
}

// ---------------------------------------------------------------------------
// Store file. The new file is ~/.local/state/todo-list/todos.json. The old
// Omarchy file (~/.local/state/omarchy/todos.json) is read once, only when
// the new file does not exist, and is never written.
// ---------------------------------------------------------------------------

function newStorePath() {
    return GLib.build_filenamev([GLib.get_user_state_dir(), 'todo-list', 'todos.json']);
}

function oldStorePath() {
    return GLib.build_filenamev([GLib.get_user_state_dir(), 'omarchy', 'todos.json']);
}

// Reads a file without blocking the panel. The callback gets (text, error).
// text is null when the file does not exist. error is set when the file exists
// but cannot be read.
function readTextAsync(path, callback) {
    Gio.File.new_for_path(path).load_contents_async(null, (file, res) => {
        try {
            const result = file.load_contents_finish(res);
            callback(ByteArray.toString(result[1]), null);
        } catch (e) {
            if (e.matches && e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.NOT_FOUND)) callback(null, null);
            else callback(null, e);
        }
    });
}

// Writes a file without blocking. Gio replaces the file in one step, so a crash
// cannot leave half a file. The callback gets an error, or null on success.
function writeTextAsync(path, text, callback) {
    GLib.mkdir_with_parents(path.slice(0, path.lastIndexOf('/')), 0o755);
    Gio.File.new_for_path(path).replace_contents_async(
        ByteArray.fromString(text), null, false, Gio.FileCreateFlags.NONE, null,
        (file, res) => {
            try {
                file.replace_contents_finish(res);
                callback(null);
            } catch (e) {
                callback(e);
            }
        });
}

// Finds the store on disk, and calls back with { text, source } where source is
// 'new', 'old' or 'none'. Calls back with { error, source } if a file exists but
// cannot be read.
function loadStoreAsync(callback) {
    readTextAsync(newStorePath(), (text, error) => {
        if (error) return callback({ error: error, source: 'new' });
        if (text !== null) return callback({ text: text, source: 'new' });
        readTextAsync(oldStorePath(), (oldText, oldError) => {
            if (oldError) return callback({ error: oldError, source: 'old' });
            if (oldText !== null) return callback({ text: oldText, source: 'old' });
            callback({ text: '', source: 'none' });
        });
    });
}

// Runs a command and returns its stdout. Kept from the Omarchy-to-Cinnamon
// port pattern. Nothing in this applet calls it yet.
function runCapture(argv, callback) {
    let proc;
    try {
        proc = new Gio.Subprocess({
            argv: argv,
            flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_SILENCE
        });
        proc.init(null);
    } catch (e) {
        global.log('[todo-list] could not start ' + argv[0] + ': ' + e);
        callback('');
        return;
    }
    proc.communicate_utf8_async(null, null, (p, res) => {
        let stdout = '';
        try {
            let result = p.communicate_utf8_finish(res);
            stdout = result[1] || '';
        } catch (e) {
            global.log('[todo-list] command failed: ' + e);
        }
        callback(stdout);
    });
}

// ---------------------------------------------------------------------------
// The applet
// ---------------------------------------------------------------------------

class TodoListApplet extends Applet.TextIconApplet {
    constructor(orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId);
        this.state = freshState();
        this.ui = { query: '', draftPriority: 'medium', expanded: {}, editing: {}, theme: 'neon' };
        this._storeInvalid = false;
        this._dirty = false;
        this._writing = false;
        this._editEntries = [];
        this._pendingFocus = null;
        this._pendingRowFocus = null;
        this._rowTitles = [];
        this._tabButtons = [];
        this._isOpen = false;

        this.set_applet_icon_symbolic_path(APPLET_DIR + '/icon-symbolic.svg');
        this.set_applet_tooltip('Todo List');

        this._buildBadge();
        this._buildPopup();
        this._registerHotkey();
        this._loadFromDisk();
        this._loadTheme();
        this._render();

        this._timerId = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT, DAILY_CHECK_SECONDS, () => this._onTick());
        this._log('loaded; store is ' + newStorePath());
    }

    on_applet_clicked() {
        if (this._isOpen) this._closeDialog();
        else this._openDialog();
    }

    // Ctrl+Alt+D is registered by the applet itself, with Cinnamon's keybinding
    // manager. It works while the applet is loaded. If registration fails, the
    // applet still loads, and the log says so.
    _registerHotkey() {
        try {
            Main.keybindingManager.addHotKey(HOTKEY_NAME, HOTKEY, () => this.on_applet_clicked());
            this._hotkeyOn = true;
        } catch (e) {
            this._hotkeyOn = false;
            this._log('built-in shortcut ' + HOTKEY + ' is off: ' + e);
        }
    }

    _openDialog() {
        this._isOpen = true;
        this._dialog.open();
        this._installOutsideClick();
        this._log('opened');
    }

    _closeDialog() {
        this._isOpen = false;
        this._removeOutsideClick();
        this._dialog.close();
        this._log('closed');
    }

    // A mouse press anywhere outside the window closes it. A press on the panel
    // icon is left to the icon, so the click toggles the window once, not twice.
    _installOutsideClick() {
        if (this._outsideClickId) return;
        this._outsideClickId = global.stage.connect('captured-event', (stage, event) => {
            if (event.type() !== Clutter.EventType.BUTTON_PRESS) return Clutter.EVENT_PROPAGATE;
            const src = event.get_source();
            if (this._dialog.dialogLayout.contains(src)) return Clutter.EVENT_PROPAGATE;
            if (this.actor.contains(src)) return Clutter.EVENT_PROPAGATE;
            this._log('closed by a click outside the window');
            this._closeDialog();
            return Clutter.EVENT_PROPAGATE;
        });
    }

    _removeOutsideClick() {
        if (!this._outsideClickId) return;
        global.stage.disconnect(this._outsideClickId);
        this._outsideClickId = 0;
    }

    // ----- themes -----

    cycleTheme() {
        const i = THEME_ORDER.indexOf(this.ui.theme);
        return this.setTheme(THEME_ORDER[(i + 1) % THEME_ORDER.length]);
    }

    setTheme(name) {
        if (!has(THEMES, name)) {
            this._log('unknown theme: ' + name);
            return this.ui.theme;
        }
        this.ui.theme = name;
        this._applyTheme();
        saveThemeAsync(this.ui.theme);
        this._log('theme: ' + this.ui.theme);
        return this.ui.theme;
    }

    _palette() {
        return THEMES[this.ui.theme];
    }

    _applyTheme() {
        THEME_ORDER.forEach(name => this._dialog.dialogLayout.remove_style_class_name(themeClass(name)));
        this._dialog.dialogLayout.add_style_class_name(themeClass(this.ui.theme));
        this._themeButton.set_label(_('Theme: %s').format(_(THEMES[this.ui.theme].label)));
        this._updateBadge();
    }

    // The panel icon turns the critical colour while a critical task is ongoing,
    // as the original widget did. Otherwise it keeps the theme's own colour.
    _setIconColour(colour) {
        if (!this._applet_icon) {
            if (!this._iconWarned) {
                this._iconWarned = true;
                this._log('icon colour is not available on this Cinnamon version');
            }
            return;
        }
        this._applet_icon.set_style(colour ? 'color: ' + colour + ';' : '');
    }

    on_applet_removed_from_panel() {
        if (this._hotkeyOn) Main.keybindingManager.removeHotKey(HOTKEY_NAME);
        this._hotkeyOn = false;
        this._removeOutsideClick();
        if (this._timerId) GLib.source_remove(this._timerId);
        this._timerId = 0;
        this._dialog.close();
        this._dialog.destroy();
        this._log('removed from panel');
    }

    _log(message) {
        global.log('[todo-list] ' + message);
    }

    // ----- store -----

    _loadFromDisk() {
        loadStoreAsync(found => {
            if (found.error) {
                this._storeInvalid = true;
                this._log('todos.json could not be read; leaving it untouched: ' + found.error);
                this._render();
                return;
            }
            const store = parseStore(found.text);
            if (!store.valid) {
                this._storeInvalid = true;
                this._log('todos.json is not valid JSON; leaving it untouched and not saving');
                this._render();
                return;
            }
            this.state = {
                tasks: store.tasks,
                dailyTasks: store.dailyTasks,
                dailyResetDate: store.dailyResetDate,
                activeTab: store.activeTab,
            };
            const rolled = this._applyRollover();
            if (found.source === 'old') {
                this._log('imported tasks once from the Omarchy file; that file is not changed');
                this._save();
            } else if (found.source === 'new' && rolled) {
                this._save();
            }
            this._render();
        });
    }

    _loadTheme() {
        loadThemeAsync(name => {
            this.ui.theme = name;
            this._applyTheme();
        });
    }

    // Saves are queued. Only one write runs at a time, and it always writes the
    // latest state, so an older save can never overwrite a newer one.
    _save() {
        if (this._storeInvalid) return;
        this._dirty = true;
        this._flush();
    }

    _flush() {
        if (this._writing || !this._dirty) return;
        this._dirty = false;
        this._writing = true;
        const text = serialize(this.state.tasks, this.state.activeTab,
            this.state.dailyTasks, this.state.dailyResetDate);
        writeTextAsync(newStorePath(), text, error => {
            this._writing = false;
            if (error) this._log('could not save: ' + error);
            this._flush();
        });
    }

    _persist() {
        this._applyRollover();
        this._save();
        this._updateBadge();
    }

    _applyRollover() {
        const result = rollDailyTasks(this.state.dailyTasks, this.state.dailyResetDate, localDateKey(new Date()));
        if (!result.changed) return false;
        this.state.dailyTasks = result.tasks;
        this.state.dailyResetDate = result.dailyResetDate;
        return true;
    }

    // Runs every DAILY_CHECK_SECONDS. It only applies the daily reset. It never
    // changes the tab, search, expanded rows or anything being typed.
    _onTick() {
        if (this._applyRollover()) {
            this._save();
            this._log('daily tasks reset for ' + this.state.dailyResetDate);
            this._updateBadge();
            if (Object.keys(this.ui.editing).length === 0) this._renderList();
        }
        return GLib.SOURCE_CONTINUE;
    }

    // ----- building the widgets -----

    _buildBadge() {
        this._badge = new St.Label({ style_class: 'todo-badge', text: '' });
        this._badge.visible = false;
        this.actor.add_child(this._badge);
    }

    _buildPopup() {
        // destroyOnClose is false, so the list, the tab and any typed text
        // survive closing and reopening.
        this._dialog = new ModalDialog.ModalDialog({
            styleClass: 'todo-dialog',
            destroyOnClose: false,
        });
        this._dialog.connect('key-press-event', (actor, event) => this._onKey(event));

        this._root = new St.BoxLayout({ vertical: true, style_class: 'todo-root' });

        const header = new St.BoxLayout({ style_class: 'todo-header' });
        const title = new St.Label({ style_class: 'todo-title', text: _('Todo List') });
        title.x_expand = true;
        header.add_child(title);
        this._themeButton = new St.Button({ label: '', style_class: 'todo-action todo-theme-button' });
        this._themeButton.connect('clicked', () => this.cycleTheme());
        header.add_child(this._themeButton);
        this._closeButton = new St.Button({ label: _('Close'), style_class: 'todo-action' });
        this._closeButton.connect('clicked', () => this._closeDialog());
        header.add_child(this._closeButton);
        this._root.add_child(header);

        this._search = new St.Entry({ style_class: 'todo-entry', hint_text: _('Search tasks') });
        this._search.clutter_text.connect('text-changed', () => {
            this.ui.query = this._search.get_text();
            this._renderList();
        });
        this._root.add_child(this._search);

        this._tabRow = new St.BoxLayout({ style_class: 'todo-tabs' });
        this._root.add_child(this._tabRow);

        this._listBox = new St.BoxLayout({ vertical: true, style_class: 'todo-list' });
        this._listScroll = new St.ScrollView({ style_class: 'todo-list-scroll' });
        this._listScroll.set_policy(St.PolicyType.NEVER, St.PolicyType.AUTOMATIC);
        this._listScroll.add_actor(this._listBox);
        this._root.add_child(this._listScroll);

        this._composer = new St.BoxLayout({ vertical: true, style_class: 'todo-composer' });
        this._titleEntry = new St.Entry({ style_class: 'todo-entry', hint_text: _('Add a task') });
        this._titleEntry.clutter_text.connect('activate', () => this.addTask());
        this._descEntry = new St.Entry({
            style_class: 'todo-entry todo-desc',
            hint_text: _('Short description  \u00b7  Shift+Enter for a new line'),
        });
        this._descEntry.clutter_text.set_single_line_mode(false);
        this._descEntry.clutter_text.set_line_wrap(true);
        this._descEntry.connect('key-press-event', (actor, event) => this._onDescKey(event));
        this._composer.add_child(this._titleEntry);
        this._composer.add_child(this._descEntry);

        const bottom = new St.BoxLayout({ style_class: 'todo-composer-bottom' });
        this._chipRow = new St.BoxLayout({ style_class: 'todo-chips' });
        this._chipRow.x_expand = true;
        this._chips = PRIORITY_OPTIONS.map(p => {
            const btn = new St.Button({ label: PRIORITY_LABELS[p], style_class: 'todo-chip' });
            btn.set_style('color: ' + PRIORITY_COLORS[p] + ';');
            btn.connect('clicked', () => {
                this.ui.draftPriority = p;
                this._renderComposer();
            });
            this._chipRow.add_child(btn);
            return { p: p, btn: btn };
        });
        this._addButton = new St.Button({ label: _('Add'), style_class: 'todo-add' });
        this._addButton.connect('clicked', () => this.addTask());
        bottom.add_child(this._chipRow);
        bottom.add_child(this._addButton);
        this._composer.add_child(bottom);
        this._root.add_child(this._composer);

        // Bottom bar: the keys on the left, the shortcut on the right.
        this._footer = new St.BoxLayout({ style_class: 'todo-footer todo-footer-row' });
        this._footerKeys = new St.Label({
            style_class: 'todo-footer-keys',
            text: _('Tab move  \u00b7  n add  \u00b7  / search  \u00b7  \u2190 \u2192 tabs  \u00b7  t theme  \u00b7  Esc close'),
        });
        this._footerKeys.x_expand = true;
        this._footerHotkey = new St.Label({
            style_class: 'todo-footer-hotkey',
            text: _('%s open / close').format(hotkeyLabel(HOTKEY)),
        });
        this._footer.add_child(this._footerKeys);
        this._footer.add_child(this._footerHotkey);
        this._root.add_child(this._footer);

        this._dialog.contentLayout.add_child(this._root);
        this._dialog.setInitialKeyFocus(this._closeButton);
        this._applyTheme();
    }


    // ----- rendering -----

    _render() {
        this._renderTabs();
        this._renderList();
        this._renderComposer();
        this._updateBadge();
    }

    _tabCount(tab) {
        if (tab === 'daily') return listedDaily(this.state.dailyTasks, this.ui.query).length;
        return listed(this.state.tasks, this.ui.query, tab).length;
    }

    _renderTabs() {
        this._tabRow.destroy_all_children();
        this._tabButtons = [];
        TAB_OPTIONS.forEach(tab => {
            const selected = this.state.activeTab === tab.value;
            const btn = new St.Button({
                label: _(tab.label) + ' (' + this._tabCount(tab.value) + ')',
                style_class: selected ? 'todo-tab todo-tab-selected' : 'todo-tab',
            });
            btn.connect('clicked', () => this.setTab(tab.value));
            this._tabRow.add_child(btn);
            this._tabButtons.push({ value: tab.value, btn: btn });
        });
    }

    _visibleTasks() {
        if (this.state.activeTab === 'daily') return listedDaily(this.state.dailyTasks, this.ui.query);
        return listed(this.state.tasks, this.ui.query, this.state.activeTab);
    }

    _renderList() {
        this._listBox.destroy_all_children();
        this._editEntries = [];
        this._rowTitles = [];
        this._pendingFocus = null;
        const rowFocus = this._pendingRowFocus;
        this._pendingRowFocus = null;
        const tab = this.state.activeTab;
        const rows = this._visibleTasks();
        if (rows.length === 0) {
            const total = tab === 'daily' ? this.state.dailyTasks.length : this.state.tasks.length;
            this._listBox.add_child(new St.Label({
                style_class: 'todo-empty',
                text: emptyMessage(this.ui.query, tab, total),
            }));
        }
        rows.forEach(task => this._listBox.add_child(this._buildRow(task)));
        if (tab === 'complete' && this.ui.query === ''
            && listed(this.state.tasks, '', 'complete').length > 0) {
            const clear = new St.Button({ label: _('Clear'), style_class: 'todo-clear' });
            clear.connect('clicked', () => this.clearCompleted());
            this._listBox.add_child(clear);
        }
        if (this._pendingFocus) {
            this._pendingFocus.grab_key_focus();
            this._pendingFocus = null;
        } else if (rowFocus !== null) {
            // A keyboard action removed or moved the row: focus the row now at that position.
            if (this._rowTitles.length > 0) {
                const i = Math.min(rowFocus, this._rowTitles.length - 1);
                this._rowTitles[i].button.grab_key_focus();
            } else {
                this._search.grab_key_focus();
            }
        }
    }

    _buildRow(task) {
        const daily = this.state.activeTab === 'daily';
        const id = String(task.id);
        const completed = daily ? task.completed === true : task.status === 'complete';
        const expanded = !!this.ui.expanded[id];
        const editing = !!this.ui.editing[id];

        const row = new St.BoxLayout({
            vertical: true,
            style_class: completed ? 'todo-row todo-row-done' : 'todo-row',
            reactive: true,
        });
        // The coloured left edge shows priority at a glance. Daily tasks use the accent.
        row.set_style('border-left: 3px solid '
            + (daily ? this._palette().accent : priorityColor(task.priority)) + ';');
        row.track_hover = true;
        const head = new St.BoxLayout({ style_class: 'todo-row-head' });

        const check = new St.Button({ label: completed ? '\u2713' : '\u25cb', style_class: 'todo-check' });
        check.connect('clicked', () => this.toggleCompleted(id, !completed));
        head.add_child(check);

        if (!daily) {
            const pill = new St.Label({
                style_class: 'todo-pill',
                text: priorityLabel(task.priority).toUpperCase(),
            });
            pill.set_style('background-color: ' + priorityColor(task.priority) + ';');
            head.add_child(pill);
        }

        const title = new St.Button({ label: task.title, style_class: 'todo-row-title' });
        title.connect('clicked', () => this.toggleExpanded(id));
        head.add_child(title);
        this._rowTitles.push({ id: id, button: title });

        const actions = new St.BoxLayout({ style_class: 'todo-row-actions' });
        if (!daily) {
            const parked = task.status === 'backlog';
            const startPark = new St.Button({
                label: parked ? '\u25b6' : '\u275a\u275a',
                style_class: 'todo-action',
            });
            startPark.connect('clicked', () => this.moveTask(id, parked ? 'ongoing' : 'backlog'));
            actions.add_child(startPark);
        }
        const edit = new St.Button({ label: '\u270e', style_class: 'todo-action' });
        edit.connect('clicked', () => this.toggleEditing(id));
        actions.add_child(edit);
        const remove = new St.Button({
            label: daily ? _('Delete') : '\u2715',
            style_class: 'todo-action todo-action-danger',
        });
        remove.connect('clicked', () => this.removeTask(id));
        actions.add_child(remove);
        head.add_child(actions);
        row.add_child(head);

        // Actions show on hover, and stay shown while the row is open.
        actions.visible = expanded || editing;
        row.connect('key-press-event', (actor, event) => this._onRowKey(id, event));
        row.connect('enter-event', () => { actions.visible = true; });
        row.connect('leave-event', () => {
            actions.visible = !!(this.ui.expanded[id] || this.ui.editing[id]);
        });

        if (editing) {
            row.add_child(this._buildEditor(task, daily));
        } else if (expanded) {
            const desc = new St.Label({
                style_class: 'todo-row-desc',
                text: task.description || _('No description'),
            });
            desc.clutter_text.set_line_wrap(true);
            row.add_child(desc);
        }
        return row;
    }

    _buildEditor(task, daily) {
        const id = String(task.id);
        const box = new St.BoxLayout({ vertical: true, style_class: 'todo-editor' });
        const title = new St.Entry({ style_class: 'todo-entry', hint_text: _('Title') });
        title.set_text(task.title);
        const desc = new St.Entry({ style_class: 'todo-entry todo-desc', hint_text: _('Description') });
        desc.clutter_text.set_single_line_mode(false);
        desc.clutter_text.set_line_wrap(true);
        desc.set_text(task.description);

        let priority = normalizePriority(task.priority);
        if (!daily) {
            const row = new St.BoxLayout({ style_class: 'todo-chips' });
            const chips = PRIORITY_OPTIONS.map(p => {
                const btn = new St.Button({ label: PRIORITY_LABELS[p], style_class: 'todo-chip' });
                row.add_child(btn);
                return { p: p, btn: btn };
            });
            chips.forEach(c => c.btn.connect('clicked', () => {
                priority = c.p;
                paintChips(chips, c.p, this._palette().chipText);
            }));
            paintChips(chips, priority, this._palette().chipText);
            box.add_child(row);
        }

        const commit = () => this.editTask(id, title.get_text(), desc.get_text(), priority);
        const buttons = new St.BoxLayout({ style_class: 'todo-composer-bottom' });
        const save = new St.Button({ label: _('Save'), style_class: 'todo-add' });
        save.connect('clicked', commit);
        title.clutter_text.connect('activate', commit);
        const cancel = new St.Button({ label: _('Cancel'), style_class: 'todo-action' });
        cancel.connect('clicked', () => this.toggleEditing(id));
        buttons.add_child(save);
        buttons.add_child(cancel);

        box.add_child(title);
        box.add_child(desc);
        box.add_child(buttons);
        this._editEntries.push(title, desc);
        this._pendingFocus = title;
        return box;
    }

    _renderComposer() {
        const daily = this.state.activeTab === 'daily';
        this._chipRow.visible = !daily;
        paintChips(this._chips, this.ui.draftPriority, this._palette().chipText);
    }

    _updateBadge() {
        const count = ongoingCount(this.state.tasks);
        const highest = highestOngoing(this.state.tasks);
        this._badge.set_text(count > 9 ? '9+' : String(count));
        this._badge.visible = count > 0;
        this._badge.set_style('background-color: ' + (highest ? PRIORITY_COLORS[highest] : this._palette().accent) + ';');
        this._setIconColour(highest === 'critical' ? PRIORITY_COLORS.critical : '');
        this.set_applet_tooltip(badgeTooltip(count, highest));
    }

    // ----- actions (each one persists and re-renders) -----

    setTab(tab) {
        this.state.activeTab = normalizeTab(tab);
        this._log('tab: ' + this.state.activeTab);
        this._persist();
        this._render();
    }

    // New normal tasks land on the tab you are viewing (Ongoing from
    // Completed), and the view moves to that tab. Daily tasks stay on Daily.
    addTask() {
        const title = this._titleEntry.get_text();
        const description = this._descEntry.get_text();
        if (this.state.activeTab === 'daily') {
            const task = createDailyTask(title, description);
            if (!task.title) {
                this._titleEntry.grab_key_focus();
                return false;
            }
            this.state.dailyTasks = addItem(this.state.dailyTasks, task);
            this._log('added daily task');
        } else {
            const task = createTask(title, description, this.ui.draftPriority,
                addStatusForTab(this.state.activeTab));
            if (!task.title) {
                this._titleEntry.grab_key_focus();
                return false;
            }
            this.state.tasks = addItem(this.state.tasks, task);
            this.state.activeTab = task.status;
            this._log('added ' + task.priority + ' task to ' + task.status);
        }
        this._titleEntry.set_text('');
        this._descEntry.set_text('');
        this._persist();
        this._render();
        this._titleEntry.grab_key_focus();
        return true;
    }

    toggleCompleted(id, completed) {
        if (this.state.activeTab === 'daily') {
            this.state.dailyTasks = setDailyCompleted(this.state.dailyTasks, id, completed);
        } else {
            this.state.tasks = setCompleted(this.state.tasks, id, completed);
        }
        this._persist();
        this._render();
    }

    moveTask(id, status) {
        this.state.tasks = setStatus(this.state.tasks, id, status);
        this._log('moved task to ' + status);
        this._persist();
        this._render();
    }

    removeTask(id) {
        if (this.state.activeTab === 'daily') {
            this.state.dailyTasks = removeById(this.state.dailyTasks, id);
        } else {
            this.state.tasks = removeById(this.state.tasks, id);
        }
        delete this.ui.expanded[id];
        delete this.ui.editing[id];
        this._log('removed task');
        this._persist();
        this._render();
    }

    clearCompleted() {
        const next = removeCompleted(this.state.tasks);
        if (next.length === this.state.tasks.length) return false;
        this.state.tasks = next;
        this._log('cleared completed tasks');
        this._persist();
        this._render();
        return true;
    }

    editTask(id, title, description, priority) {
        if (trim(title) === '') return false;
        if (this.state.activeTab === 'daily') {
            this.state.dailyTasks = updateDailyTask(this.state.dailyTasks, id, title, description);
        } else {
            this.state.tasks = updateTask(this.state.tasks, id, title, description, priority);
        }
        delete this.ui.editing[id];
        this._log('edited task');
        this._persist();
        this._render();
        return true;
    }

    toggleExpanded(id) {
        if (this.ui.expanded[id]) {
            delete this.ui.expanded[id];
            delete this.ui.editing[id];
        } else {
            this.ui.expanded[id] = true;
        }
        this._renderList();
    }

    toggleEditing(id) {
        if (this.ui.editing[id]) {
            delete this.ui.editing[id];
        } else {
            this.ui.expanded[id] = true;
            this.ui.editing[id] = true;
        }
        this._renderList();
    }

    // ----- keys -----

    _textFieldHasFocus() {
        return [this._search, this._titleEntry, this._descEntry]
            .concat(this._editEntries)
            .some(e => e.has_key_focus());
    }

    // Every control in visual order. Tab and Shift+Tab walk this list.
    _focusOrder() {
        const order = [this._search];
        this._tabButtons.forEach(t => order.push(t.btn));
        this._rowTitles.forEach(r => order.push(r.button));
        order.push(...this._editEntries);
        order.push(this._titleEntry, this._descEntry);
        this._chips.forEach(c => order.push(c.btn));
        order.push(this._addButton, this._themeButton, this._closeButton);
        return order;
    }

    _moveFocus(delta) {
        const order = this._focusOrder();
        let i = order.findIndex(a => a.has_key_focus());
        if (i < 0) i = delta > 0 ? -1 : 0;
        order[(i + delta + order.length) % order.length].grab_key_focus();
    }

    _focusTab(value) {
        const tab = this._tabButtons.find(t => t.value === value);
        if (tab) tab.btn.grab_key_focus();
    }

    // Keys pressed while a row title (or any control in the row) has focus.
    _onRowKey(id, event) {
        if (this._textFieldHasFocus()) return Clutter.EVENT_PROPAGATE;
        const sym = event.get_key_symbol();
        const daily = this.state.activeTab === 'daily';
        const list = daily ? this.state.dailyTasks : this.state.tasks;
        const task = list.find(t => String(t.id) === id);
        const index = this._rowTitles.findIndex(r => r.id === id);
        if (!task || index < 0) return Clutter.EVENT_PROPAGATE;
        const completed = daily ? task.completed === true : task.status === 'complete';

        if (sym === Clutter.KEY_Up) {
            if (index > 0) this._rowTitles[index - 1].button.grab_key_focus();
            else this._search.grab_key_focus();
            return Clutter.EVENT_STOP;
        }
        if (sym === Clutter.KEY_Down) {
            if (index < this._rowTitles.length - 1) this._rowTitles[index + 1].button.grab_key_focus();
            return Clutter.EVENT_STOP;
        }
        if (sym === Clutter.KEY_c) {
            this._pendingRowFocus = index;
            this.toggleCompleted(id, !completed);
            return Clutter.EVENT_STOP;
        }
        if (sym === Clutter.KEY_p && !daily) {
            this._pendingRowFocus = index;
            this.moveTask(id, task.status === 'backlog' ? 'ongoing' : 'backlog');
            return Clutter.EVENT_STOP;
        }
        if (sym === Clutter.KEY_e) {
            this.toggleEditing(id);
            return Clutter.EVENT_STOP;
        }
        if (sym === Clutter.KEY_x || sym === Clutter.KEY_Delete) {
            this._pendingRowFocus = index;
            this.removeTask(id);
            return Clutter.EVENT_STOP;
        }
        return Clutter.EVENT_PROPAGATE;
    }

    _onKey(event) {
        const sym = event.get_key_symbol();
        const inText = this._textFieldHasFocus();

        if (sym === Clutter.KEY_Tab || sym === Clutter.KEY_ISO_Left_Tab) {
            const back = sym === Clutter.KEY_ISO_Left_Tab || (event.get_state() & Clutter.ModifierType.SHIFT_MASK);
            this._moveFocus(back ? -1 : 1);
            return Clutter.EVENT_STOP;
        }
        if (sym === Clutter.KEY_Down && this._search.has_key_focus()) {
            if (this._rowTitles.length > 0) this._rowTitles[0].button.grab_key_focus();
            return Clutter.EVENT_STOP;
        }

        if (sym === Clutter.KEY_Escape) {
            if (inText) {
                if (this._search.has_key_focus() && this._search.get_text() !== '') {
                    this._search.set_text('');
                } else {
                    this._closeButton.grab_key_focus();
                }
            } else {
                this._closeDialog();
            }
            return Clutter.EVENT_STOP;
        }
        if (inText) return Clutter.EVENT_PROPAGATE;

        if (sym === Clutter.KEY_t) {
            this.cycleTheme();
            return Clutter.EVENT_STOP;
        }
        if (sym === Clutter.KEY_Left || sym === Clutter.KEY_Right) {
            this.setTab(cycleTab(this.state.activeTab, sym === Clutter.KEY_Left ? -1 : 1));
            this._focusTab(this.state.activeTab);
            return Clutter.EVENT_STOP;
        }
        if (sym === Clutter.KEY_Down && this._rowTitles.length > 0) {
            this._rowTitles[0].button.grab_key_focus();
            return Clutter.EVENT_STOP;
        }
        if (sym === Clutter.KEY_Up) {
            this._search.grab_key_focus();
            return Clutter.EVENT_STOP;
        }
        if (sym === Clutter.KEY_slash) {
            this._search.grab_key_focus();
            return Clutter.EVENT_STOP;
        }
        if (sym === Clutter.KEY_n || sym === Clutter.KEY_N) {
            this._titleEntry.grab_key_focus();
            return Clutter.EVENT_STOP;
        }
        return Clutter.EVENT_PROPAGATE;
    }

    // Enter adds the task. Shift+Enter falls through and starts a new line.
    _onDescKey(event) {
        const sym = event.get_key_symbol();
        if (sym === Clutter.KEY_Return || sym === Clutter.KEY_KP_Enter) {
            if (event.get_state() & Clutter.ModifierType.SHIFT_MASK) return Clutter.EVENT_PROPAGATE;
            this.addTask();
            return Clutter.EVENT_STOP;
        }
        return Clutter.EVENT_PROPAGATE;
    }
}

function main(metadata, orientation, panelHeight, instanceId) {
    return new TodoListApplet(orientation, panelHeight, instanceId);
}
