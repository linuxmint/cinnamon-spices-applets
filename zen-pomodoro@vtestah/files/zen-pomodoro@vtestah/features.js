const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
let Soup = null;
try {
    imports.gi.versions.Soup = '3.0';
    Soup = imports.gi.Soup;
} catch (e) {
    try { Soup = imports.gi.Soup; } catch (e2) { Soup = null; }
}
const Meta = imports.gi.Meta;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;
const Util = imports.misc.util;
const ByteArray = imports.byteArray;
const Gettext = imports.gettext;
const ModalDialog = imports.ui.modalDialog;
const Dialog = imports.ui.dialog;
const CinnamonEntry = imports.ui.cinnamonEntry;

const UUID = "zen-pomodoro@vtestah";
function _(str) { return Gettext.dgettext(UUID, str); }

let C, SoundModule, DialogsModule, RecommendModule, FlowModule, DateMath;
if (typeof require !== 'undefined') {
    C = require('./constants');
    SoundModule = require('./sound');
    DialogsModule = require('./dialogs');
    RecommendModule = require('./recommend');
    FlowModule = require('./flow');
    DateMath = require('./datemath');
} else {
    const AppletDir = imports.ui.appletManager.applets[UUID];
    C = AppletDir.constants;
    SoundModule = AppletDir.sound;
    DialogsModule = AppletDir.dialogs;
    RecommendModule = AppletDir.recommend;
    FlowModule = AppletDir.flow;
    DateMath = AppletDir.datemath;
}
const {
    POMODORO_STATE_FILE,
    POMODORO_STATE_MAX_AGE_MS,
    POMODORO_STATS_FILE,
    POMODORO_TASKS_DATA_FILE,
    POMODORO_HOSTS_HELPER_INSTALLED,
    POMODORO_HOSTS_POLICY_INSTALLED,
    POMODORO_HOSTS_FILE,
    POMODORO_HOSTS_BLOCK_BEGIN,
    POMODORO_HOSTS_BLOCK_END,
    POMODORO_FOCUS_FRAME_BOTTOM_SAFE,
    POMODORO_FOCUS_FRAME_NORMAL_STYLE,
    POMODORO_FOCUS_FRAME_WARNING_STYLE,
    POMODORO_BREAK_OVER_FRAME_STYLE,
    POMODORO_FOCUS_FRAME_PULSE_INTERVAL_MS,
    POMODORO_FOCUS_FRAME_TRANSITION,
    POMODORO_FOCUS_FRAME_PULSE_STYLES,
    POMODORO_BREAK_FRAME_PULSE_STYLES,
    POMODORO_FOCUS_FRAME_STYLE,
    POMODORO_PANEL_FOCUS_CUE_STYLE,
    POMODORO_PANEL_BREAK_CUE_STYLE,
    POMODORO_PANEL_FOCUS_LABEL_STYLE,
    POMODORO_PANEL_BREAK_LABEL_STYLE,
    POMODORO_FOCUS_TASK_CHIP_STYLE,
    POMODORO_FOCUS_TASK_CHIP_PAUSED_STYLE,
    POMODORO_FOCUS_CHIP_MARGIN,
    POMODORO_FOCUS_RITUAL_STYLE,
    POMODORO_FOCUS_RITUAL_FADE_IN_MS,
    POMODORO_FOCUS_RITUAL_HOLD_MS,
    POMODORO_FOCUS_RITUAL_FADE_OUT_MS,
    POMODORO_FOCUS_RITUAL_FRAME_FADE_MS,
    POMODORO_FOCUS_RITUAL_STEP_MS,
    POMODORO_FOCUS_GLOW_FOCUS_RGB,
    POMODORO_FOCUS_GLOW_FOCUS_END_RGB,
    POMODORO_FOCUS_GLOW_BREAK_RGB,
    POMODORO_FOCUS_GLOW_END_SHIFT_START,
    POMODORO_FOCUS_GLOW_DEPTH_RATIO,
    POMODORO_FOCUS_GLOW_DEPTH_MAX,
    POMODORO_FOCUS_GLOW_DEPTH_MIN,
    POMODORO_FOCUS_GLOW_MAX_ALPHA,
    POMODORO_FOCUS_GLOW_PROGRESS_WIDTH,
    POMODORO_FOCUS_GLOW_PROGRESS_ALPHA,
    POMODORO_FOCUS_GLOW_TRACK_ALPHA,
    POMODORO_FOCUS_GLOW_TICK_ALPHA,
    POMODORO_FOCUS_GLOW_TICK_RADIUS,
    POMODORO_FOCUS_GLOW_BREATH_BOOST,
    POMODORO_FOCUS_GLOW_BREATH_MS
} = C;

function install(proto) {
    proto._todayStr = function(d = new Date()) {
        return DateMath.dayKey(d);
    };

    proto._loadDailyStatsAsync = function(onDone) {
        this._readJsonAsync(POMODORO_STATS_FILE, (parsed) => {
            let data = { date: "", count: 0, streak: 0, lastGoalMetDate: "", history: {}, total: 0, totalMinutes: 0, totalInterruptions: 0, hours: new Array(24).fill(0) };
            if (parsed && typeof parsed === "object") {
                data.date = parsed.date || "";
                data.count = parseInt(parsed.count) || 0;
                data.streak = parseInt(parsed.streak) || 0;
                data.lastGoalMetDate = parsed.lastGoalMetDate || "";
                if (parsed.history && typeof parsed.history === "object") {
                    for (let k in parsed.history) {
                        let v = parsed.history[k];
                        if (typeof v === "number") {
                            if (v > 0) {
                                data.history[k] = { c: parseInt(v) || 0, m: 0, i: 0 };
                            }
                        } else if (v && typeof v === "object") {
                            let c = parseInt(v.c) || 0;
                            let m = parseInt(v.m) || 0;
                            let ii = parseInt(v.i) || 0;
                            if (c > 0 || m > 0 || ii > 0) {
                                data.history[k] = { c: c, m: m, i: ii };
                            }
                        }
                    }
                }
                data.total = parseInt(parsed.total) || 0;
                data.totalMinutes = parseInt(parsed.totalMinutes) || 0;
                data.totalInterruptions = parseInt(parsed.totalInterruptions) || 0;
                if (Object.keys(data.history).length === 0 && data.date && data.count > 0) {
                    data.history[data.date] = { c: data.count, m: 0, i: 0 };
                }
                if (!data.total) {
                    let sum = 0;
                    for (let k in data.history) { sum += data.history[k].c; }
                    data.total = sum;
                }
                if (!data.totalMinutes) {
                    let sum = 0;
                    for (let k in data.history) { sum += data.history[k].m; }
                    data.totalMinutes = sum;
                }
                if (!data.totalInterruptions) {
                    let sum = 0;
                    for (let k in data.history) { sum += (data.history[k].i || 0); }
                    data.totalInterruptions = sum;
                }
                if (Array.isArray(parsed.hours)) {
                    for (let i = 0; i < 24; i++) { data.hours[i] = parseInt(parsed.hours[i]) || 0; }
                }
            }
            this._dailyStatsData = data;
            if (onDone) {
                onDone(data);
            }
        });
    };

    proto._refreshDailyStatsCache = function() {
        this._loadDailyStatsAsync((s) => {
            let today = this._todayStr();
            this._dailyCount = (s.date === today) ? s.count : 0;
            this._dailyStreak = s.streak || 0;
            if (typeof this._updateMenuRuntime === "function") {
                this._updateMenuRuntime();
            }
        });
    };

    proto._daysBetween = function(a, b) {
        return DateMath.daysBetween(a, b);
    };

    // Calendar date N days before today, at local midnight (see datemath.js).
    proto._dateDaysAgo = function(n) {
        return DateMath.dateDaysAgo(new Date(), n);
    };

    proto._recordPomodoroCompleted = function() {
        let today = this._todayStr();
        let s = this._dailyStatsData || { date: "", count: 0, streak: 0, lastGoalMetDate: "", history: {}, total: 0, totalMinutes: 0, totalInterruptions: 0, hours: new Array(24).fill(0) };
        if (!s.history) { s.history = {}; }
        if (typeof s.total !== "number") { s.total = 0; }
        if (typeof s.totalMinutes !== "number") { s.totalMinutes = 0; }
        if (typeof s.totalInterruptions !== "number") { s.totalInterruptions = 0; }
        if (!Array.isArray(s.hours) || s.hours.length !== 24) { s.hours = new Array(24).fill(0); }
        if (s.date !== today) {
            s.date = today;
            s.count = 0;
        }
        let dur = this._opt_pomodoroTimeMinutes || 25;
        s.count += 1;
        s.hours[new Date().getHours()] += 1;
        let cell = s.history[today] || { c: 0, m: 0, i: 0 };
        cell.c += 1;
        cell.m += dur;
        s.history[today] = cell;
        s.total += 1;
        s.totalMinutes += dur;
        // Keep the per-day history bounded (~18 weeks).
        let cutoff = this._todayStr(this._dateDaysAgo(126));
        for (let k in s.history) {
            if (k < cutoff) { delete s.history[k]; }
        }
        let goal = this._opt_dailyGoal || 0;
        if (goal > 0 && s.count === goal) {
            if (s.lastGoalMetDate && this._daysBetween(s.lastGoalMetDate, today) === 1) {
                s.streak = (s.streak || 0) + 1;
            } else if (s.lastGoalMetDate !== today) {
                s.streak = 1;
            }
            s.lastGoalMetDate = today;
            // Celebrate locally (everyone), not only via Pushover.
            let body = Gettext.dngettext(UUID, "%d focus block today — great work!", "%d focus blocks today — great work!", goal).format(goal);
            if ((s.streak || 0) > 1) {
                body += "  " + Gettext.dngettext(UUID, "\ud83d\udd25 %d-day streak", "\ud83d\udd25 %d-day streak", s.streak).format(s.streak);
            }
            Main.notify(_("Daily goal reached \ud83c\udf45"), body);
            this._sendPushover(this._opt_pushoverMsgGoal);
            this._runEventCommand('goal');
        }
        this._dailyStatsData = s;
        this._writeJsonAsync(POMODORO_STATS_FILE, s);
        this._dailyCount = s.count;
        this._dailyStreak = s.streak || 0;
        this._updateMenuRuntime();
        this._incrementCurrentTaskProgress();
    };

    proto._recordInterruption = function() {
        let today = this._todayStr();
        let s = this._dailyStatsData || { date: "", count: 0, streak: 0, lastGoalMetDate: "", history: {}, total: 0, totalMinutes: 0, totalInterruptions: 0, hours: new Array(24).fill(0) };
        if (!s.history) { s.history = {}; }
        if (typeof s.totalInterruptions !== "number") { s.totalInterruptions = 0; }
        let cell = s.history[today] || { c: 0, m: 0, i: 0 };
        if (typeof cell.i !== "number") { cell.i = 0; }
        cell.i += 1;
        s.history[today] = cell;
        s.totalInterruptions += 1;
        this._dailyStatsData = s;
        this._writeJsonAsync(POMODORO_STATS_FILE, s);
        this._updateMenuRuntime();
    };

    // Rich stats: counts + focus time, current/longest active-day streak, best day,
    // and a 12-week heatmap (84 daily counts, oldest -> newest).
    proto._computeStats = function() {
        let h = (this._dailyStatsData && this._dailyStatsData.history) ? this._dailyStatsData.history : {};
        let cellOf = (d) => h[d] || { c: 0, m: 0 };
        let today = this._todayStr();
        let weekC = 0, weekM = 0, monthC = 0, monthM = 0, weekI = 0;
        for (let i = 0; i < 30; i++) {
            let cl = cellOf(this._todayStr(this._dateDaysAgo(i)));
            monthC += cl.c; monthM += cl.m;
            if (i < 7) { weekC += cl.c; weekM += cl.m; weekI += (cl.i || 0); }
        }
        let lastWeek = 0;
        for (let i = 7; i < 14; i++) {
            lastWeek += cellOf(this._todayStr(this._dateDaysAgo(i))).c;
        }
        let total = (this._dailyStatsData && this._dailyStatsData.total) || 0;
        let totalMinutes = (this._dailyStatsData && this._dailyStatsData.totalMinutes) || 0;
        let todayCell = cellOf(today);
        let best = 0;
        for (let k in h) { if (h[k].c > best) { best = h[k].c; } }
        let cur = 0;
        let startI = (todayCell.c > 0) ? 0 : 1;
        for (let i = startI; i < 400; i++) {
            if (cellOf(this._todayStr(this._dateDaysAgo(i))).c >= 1) { cur++; } else { break; }
        }
        let longest = 0, run = 0, prev = null;
        let activeDates = Object.keys(h).filter((k) => h[k].c >= 1).sort();
        for (let d of activeDates) {
            run = (prev && this._daysBetween(prev, d) === 1) ? run + 1 : 1;
            if (run > longest) { longest = run; }
            prev = d;
        }
        // Keep a single, consistent 🔥 number: when a daily goal is set the streak
        // follows the goal streak (same value the menu and the goal celebration
        // use, and unbounded); otherwise it's the run of consecutive days with any
        // focus (bounded by the ~18-week history retention).
        let hasGoal = (this._opt_dailyGoal || 0) > 0;
        let goalStreak = (this._dailyStatsData && this._dailyStatsData.streak) || 0;
        return {
            today: todayCell.c,
            todayMin: todayCell.m,
            week: weekC,
            weekMin: weekM,
            lastWeek: lastWeek,
            month: monthC,
            monthMin: monthM,
            total: total,
            totalMinutes: totalMinutes,
            interruptionsToday: (todayCell.i || 0),
            interruptionsWeek: weekI,
            interruptionsTotal: (this._dailyStatsData && this._dailyStatsData.totalInterruptions) || 0,
            streak: hasGoal ? goalStreak : cur,
            longestStreak: longest,
            bestDay: best,
            hours: (this._dailyStatsData && Array.isArray(this._dailyStatsData.hours) && this._dailyStatsData.hours.length === 24) ? this._dailyStatsData.hours : new Array(24).fill(0)
        };
    };

    // ---- Tasks: estimate in pomodoros, per-task progress ----
    proto._defaultTasksData = function() {
        return { tasks: [], currentId: "", date: this._todayStr(), templates: [], distractions: [] };
    };

    proto._newTaskId = function() {
        return Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
    };

    proto._loadTasksAsync = function(onDone) {
        this._readJsonAsync(POMODORO_TASKS_DATA_FILE, (parsed) => {
            let data = this._defaultTasksData();
            if (parsed && typeof parsed === "object" && Array.isArray(parsed.tasks)) {
                data.currentId = (typeof parsed.currentId === "string") ? parsed.currentId : "";
                data.date = (typeof parsed.date === "string") ? parsed.date : this._todayStr();
                for (let t of parsed.tasks) {
                    if (!t || typeof t !== "object") { continue; }
                    let title = (t.title || "").toString().trim();
                    if (!title) { continue; }
                    data.tasks.push({
                        id: (t.id || this._newTaskId()).toString(),
                        title: title.slice(0, 120),
                        est: Math.max(1, Math.min(99, parseInt(t.est) || 1)),
                        done: Math.max(0, parseInt(t.done) || 0),
                        doneToday: Math.max(0, parseInt(t.doneToday) || 0),
                        completed: Boolean(t.completed),
                        preset: this._sanitizeTaskPreset(t.preset)
                    });
                }
            }
            if (parsed && typeof parsed === "object" && Array.isArray(parsed.templates)) {
                for (let tpl of parsed.templates) {
                    if (!tpl || typeof tpl !== "object") { continue; }
                    let name = (tpl.name || "").toString().trim();
                    if (!name || !Array.isArray(tpl.tasks)) { continue; }
                    let tlist = [];
                    for (let tt of tpl.tasks) {
                        let ttl = (tt && tt.title || "").toString().trim();
                        if (ttl) { tlist.push({ title: ttl.slice(0, 120), est: Math.max(1, Math.min(99, parseInt(tt.est) || 1)) }); }
                    }
                    if (tlist.length) { data.templates.push({ name: name.slice(0, 80), tasks: tlist }); }
                }
            }
            if (parsed && typeof parsed === "object" && Array.isArray(parsed.distractions)) {
                for (let d of parsed.distractions) {
                    if (!d || typeof d !== "object") { continue; }
                    let text = (d.text || "").toString().trim();
                    if (!text) { continue; }
                    data.distractions.push({
                        id: (d.id || this._newTaskId()).toString(),
                        text: text.slice(0, 200),
                        ts: Math.max(0, parseInt(d.ts) || Date.now())
                    });
                }
            }
            let today = this._todayStr();
            if (data.date !== today) {
                for (let t of data.tasks) { t.doneToday = 0; }
                data.date = today;
            }
            this._tasksData = data;
            if (onDone) { onDone(data); }
        });
    };

    proto._saveTasks = function() {
        if (!this._tasksData) { this._tasksData = this._defaultTasksData(); }
        this._tasksData.date = this._todayStr();
        this._writeJsonAsync(POMODORO_TASKS_DATA_FILE, this._tasksData);
    };

    proto._taskList = function() {
        return (this._tasksData && Array.isArray(this._tasksData.tasks)) ? this._tasksData.tasks : [];
    };

    proto._currentTask = function() {
        if (!this._tasksData || !this._tasksData.currentId) { return null; }
        return this._taskList().find((t) => t.id === this._tasksData.currentId) || null;
    };

    // A snapshot of the timer's current rhythm, used as the default preset for
    // new tasks and to label "what's active right now".
    proto._currentPresetSnapshot = function() {
        return {
            name: this._getActivePresetLabel(),
            pomodoro: this._opt_pomodoroTimeMinutes || 25,
            short_break: this._opt_shortBreakTimeMinutes || 5,
            long_break: this._opt_longBreakTimeMinutes || 15,
            pomodori: this._opt_pomodoriNumber || 4
        };
    };

    proto._sanitizeTaskPreset = function(p) {
        if (!p || typeof p !== "object") { return null; }
        let pom = parseInt(p.pomodoro) || 0, sb = parseInt(p.short_break) || 0,
            lb = parseInt(p.long_break) || 0, n = parseInt(p.pomodori) || 0;
        if (pom <= 0 || sb <= 0 || lb <= 0 || n <= 0) { return null; }
        return { name: (p.name || "").toString().slice(0, 80), pomodoro: pom, short_break: sb, long_break: lb, pomodori: n };
    };

    // Apply a task's saved rhythm to the timer when it becomes current — but
    // only while idle, so we never reshape a running pomodoro.
    proto._applyTaskPreset = function(t) {
        if (!t || !t.preset) { return; }
        if (this._timerQueue && (this._timerQueue.isRunning() || this._isPausedState())) { return; }
        let p = t.preset;
        this._applyDurationPreset(p.pomodoro, p.short_break, p.long_break, p.pomodori, true);
    };

    // Save a preset onto the current task (used when picking a preset from the
    // menu while a task is current).
    proto._saveCurrentTaskPreset = function(preset) {
        let t = this._currentTask();
        if (!t) { return false; }
        let p = this._sanitizeTaskPreset(preset);
        if (!p) { return false; }
        t.preset = p;
        this._saveTasks();
        this._refreshTasksMenu();
        return true;
    };

    proto._addTask = function(title, est, preset) {
        title = (title || "").toString().trim();
        if (!title) { return; }
        if (!this._tasksData) { this._tasksData = this._defaultTasksData(); }
        let task = {
            id: this._newTaskId(),
            title: title.slice(0, 120),
            est: Math.max(0, Math.min(99, parseInt(est) || 0)),
            done: 0, doneToday: 0, completed: false,
            preset: this._sanitizeTaskPreset(preset) || this._currentPresetSnapshot()
        };
        this._tasksData.tasks.push(task);
        if (!this._tasksData.currentId) {
            this._tasksData.currentId = task.id;
            this._currentFocusTask = task.title;
            this._applyTaskPreset(task);
        }
        this._saveTasks();
        this._refreshTasksMenu();
    };

    proto._setCurrentTaskId = function(id) {
        if (!this._tasksData) { this._tasksData = this._defaultTasksData(); }
        this._tasksData.currentId = id || "";
        let t = this._currentTask();
        this._currentFocusTask = t ? t.title : "";
        this._applyTaskPreset(t);
        this._saveTasks();
        this._refreshTasksMenu();
    };

    proto._editTask = function(id, title, est, preset) {
        let t = this._taskList().find((x) => x.id === id);
        if (!t) { return; }
        title = (title || "").toString().trim();
        if (title) { t.title = title.slice(0, 120); }
        let pe = parseInt(est);
        t.est = Math.max(0, Math.min(99, isNaN(pe) ? (t.est || 0) : pe));
        let p = this._sanitizeTaskPreset(preset);
        if (p) { t.preset = p; }
        if (this._tasksData && this._tasksData.currentId === id) {
            this._currentFocusTask = t.title;
            this._applyTaskPreset(t);
        }
        this._saveTasks();
        this._refreshTasksMenu();
    };

    proto._toggleTaskCompleted = function(id) {
        let t = this._taskList().find((x) => x.id === id);
        if (!t) { return; }
        t.completed = !t.completed;
        // Celebrate only a meaningful completion: estimate met, or >=1 pomodoro.
        if (t.completed) {
            let earned = (t.est > 0) ? ((t.done || 0) >= t.est) : ((t.done || 0) >= 1);
            if (earned && typeof this._celebrateTaskDone === 'function') {
                this._celebrateTaskDone(t);
            }
        }
        this._saveTasks();
        this._refreshTasksMenu();
    };

    proto._deleteTask = function(id) {
        if (!this._tasksData) { return; }
        this._tasksData.tasks = this._taskList().filter((t) => t.id !== id);
        if (this._tasksData.currentId === id) { this._tasksData.currentId = ""; }
        this._saveTasks();
        this._refreshTasksMenu();
    };

    proto._ensureReorderDialog = function() {
        if (!this._reorderDialog) {
            this._reorderDialog = new DialogsModule.PomodoroReorderDialog();
            this._scaleDialogOnOpen(this._reorderDialog);
        }
        return this._reorderDialog;
    };

    proto._openReorderTasks = function() {
        let all = this._taskList() || [];
        if (all.length < 2) { return; }
        let items = all.map((t) => ({
            key: t.id,
            label: (t.completed ? "\u2713 " : "") + t.title + (t.est > 0 ? ("   " + (t.doneToday || 0) + "/" + t.est + " \ud83c\udf45") : "")
        }));
        this._ensureReorderDialog().openReorder(_("Reorder tasks"), items, (order) => this._reorderTasks(order));
    };

    // Reorder active tasks to match the given id order; completed/other tasks
    // keep their relative order after them. Pure given _tasksData.tasks.
    proto._reorderTasks = function(orderedIds) {
        if (!this._tasksData || !Array.isArray(this._tasksData.tasks)) { return; }
        let byId = {};
        for (let t of this._tasksData.tasks) { byId[t.id] = t; }
        let inSet = new Set(orderedIds);
        let reordered = orderedIds.map((id) => byId[id]).filter(Boolean);
        let rest = this._tasksData.tasks.filter((t) => !inSet.has(t.id));
        this._tasksData.tasks = reordered.concat(rest);
        this._saveTasks();
        this._refreshTasksMenu();
    };

    proto._openReorderPresets = function() {
        let list = this._presetList() || [];
        if (list.length < 2) { return; }
        let items = list.map((p) => ({
            key: p.name,
            label: p.name + "   " + p.pomodoro + "/" + p.short_break + "/" + p.long_break + " \u00d7" + p.pomodori
        }));
        this._ensureReorderDialog().openReorder(_("Reorder presets"), items, (order) => this._reorderPresets(order));
    };

    // Reorder presets to match the given name order, materializing the built-in
    // defaults into custom_presets when none were saved yet.
    proto._reorderPresets = function(orderedNames) {
        let base = (this._opt_customPresets && this._opt_customPresets.length)
            ? this._opt_customPresets.slice() : (this._presetList() || []).slice();
        let byName = {};
        for (let p of base) { byName[p.name] = p; }
        let inSet = new Set(orderedNames);
        let reordered = orderedNames.map((n) => byName[n]).filter(Boolean);
        let rest = base.filter((p) => !inSet.has(p.name));
        let final = reordered.concat(rest);
        try { this._settingsProvider.setValue('custom_presets', final); } catch (e) {}
        if (typeof this._updatePresetIndicator === 'function') { this._updatePresetIndicator(); }
    };

    proto._incrementCurrentTaskProgress = function() {
        let t = this._currentTask();
        if (!t) { return; }
        t.done = (t.done || 0) + 1;
        t.doneToday = (t.doneToday || 0) + 1;
        // The estimate is a real target: gently suggest closing when it's hit.
        if (!t.completed && t.est > 0 && t.doneToday === t.est) {
            Main.notify(_("Hit your %d 🍅 estimate for: %s. Mark it done when ready.").format(t.est, t.title));
        }
        this._saveTasks();
        this._refreshTasksMenu();
    };

    proto._refreshTasksMenu = function() {
        if (this._appletMenu && typeof this._appletMenu.setTasks === "function") {
            let est = this._estimateFinish();
            let finishText = est ? _("\u2248 finish %s \u00b7 %d \ud83c\udf45 left").format(est.time, est.remaining) : "";
            this._appletMenu.setTasks(this._taskList(), this._tasksData ? this._tasksData.currentId : "", finishText, (this._tasksData && this._tasksData.templates) || []);
        }
    };

    proto._estimateFinish = function() {
        let remaining = 0, focusMins = 0;
        let work = this._opt_pomodoroTimeMinutes || 25;
        for (let t of this._taskList()) {
            if (t.completed) { continue; }
            let left = (t.est || 0) - (t.doneToday || 0);
            if (left > 0) {
                remaining += left;
                let f = (t.preset && t.preset.pomodoro) ? t.preset.pomodoro : work;
                focusMins += left * f;
            }
        }
        if (remaining <= 0) { return null; }
        let brk = this._opt_shortBreakTimeMinutes || 5;
        let longBrk = this._opt_longBreakTimeMinutes || 15;
        let perSet = this._opt_pomodoriNumber || 4;
        // Gaps between the remaining blocks: roughly every perSet-th gap is a long
        // break, the rest are short — so the estimate doesn't run early.
        let gaps = Math.max(0, remaining - 1);
        let longBreaks = Math.floor(remaining / perSet);
        let shortBreaks = Math.max(0, gaps - longBreaks);
        let mins = focusMins + shortBreaks * brk + longBreaks * longBrk;
        let end = new Date(Date.now() + mins * 60000);
        let hh = end.getHours().toString().padStart(2, '0');
        let mm = end.getMinutes().toString().padStart(2, '0');
        return { remaining: remaining, mins: mins, time: `${hh}:${mm}` };
    };

    // A short, calm suggestion for what to actually do on a break — the part
    // most timers skip. Rotates so it doesn't feel repetitive.
    proto._distractionList = function() {
        return (this._tasksData && Array.isArray(this._tasksData.distractions)) ? this._tasksData.distractions : [];
    };

    proto._addDistraction = function(text) {
        let t = (text || "").toString().trim();
        if (!t) { return; }
        if (!this._tasksData) { this._tasksData = this._defaultTasksData(); }
        if (!Array.isArray(this._tasksData.distractions)) { this._tasksData.distractions = []; }
        this._tasksData.distractions.push({ id: this._newTaskId(), text: t.slice(0, 200), ts: Date.now() });
        this._saveTasks();
        this._refreshDistractions();
    };

    proto._deleteDistraction = function(id) {
        if (!this._tasksData || !Array.isArray(this._tasksData.distractions)) { return; }
        this._tasksData.distractions = this._tasksData.distractions.filter((d) => d.id !== id);
        this._saveTasks();
        this._refreshDistractions();
    };

    proto._clearDistractions = function() {
        if (!this._tasksData) { return; }
        this._tasksData.distractions = [];
        this._saveTasks();
        this._refreshDistractions();
    };

    proto._refreshDistractions = function() {
        if (this._appletMenu && typeof this._appletMenu.setDistractions === 'function') {
            this._appletMenu.setDistractions(this._distractionList());
        }
    };

    // Lightweight quick-capture: a small focused input (no screen-dimming modal)
    // so you can jot a distracting thought and get straight back to work.
    // Opened by the global hotkey or from the menu. Enter saves; Esc / click
    // outside dismisses.
    proto._showDistractionCapture = function() {
        if (this._capturePopover) {
            if (this._captureEntry) { this._captureEntry.grab_key_focus(); }
            return;
        }
        let monitor = Main.layoutManager.focusMonitor || Main.layoutManager.primaryMonitor;
        let container = new St.BoxLayout({ vertical: true, reactive: true });
        container.set_position(monitor.x, monitor.y);
        container.set_size(monitor.width, monitor.height);

        let card = new St.BoxLayout({
            vertical: true,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.START,
            style: 'background-color: rgba(40,40,40,0.97); border: 1px solid rgba(227,90,60,0.55); border-radius: 12px; padding: 16px; spacing: 8px; margin-top: ' + Math.floor(monitor.height * 0.26) + 'px;'
        });
        card.add_child(new St.Label({ text: _("Capture distraction"), style: 'color: #f5f5f5; font-weight: bold;' }));
        let entry = new St.Entry({ style_class: 'run-dialog-entry', can_focus: true, style: 'min-width: 380px;' });
        let hint = new St.Label({ text: _("Type it, press Enter — then back to work") });
        entry.set_hint_actor(hint);
        entry.clutter_text.connect('key-focus-in', () => hint.hide());
        entry.clutter_text.connect('key-focus-out', () => { if (!entry.get_text()) { hint.show(); } });
        CinnamonEntry.addContextMenu(entry);
        card.add_child(entry);
        container.add_child(card);

        Main.uiGroup.add_actor(container);
        let pushed = false;
        try { pushed = Main.pushModal(container); } catch (e) { pushed = false; }

        this._capturePopover = container;
        this._captureEntry = entry;
        let self = this;
        let closed = false;
        let close = function() {
            if (closed) { return; }
            closed = true;
            try { if (pushed) { Main.popModal(container); } } catch (e) {}
            container.destroy();
            self._capturePopover = null;
            self._captureEntry = null;
        };
        entry.clutter_text.connect('activate', () => {
            let txt = entry.get_text();
            if (txt && txt.trim()) { self._addDistraction(txt); }
            close();
        });
        container.connect('key-press-event', (a, ev) => {
            if (ev.get_key_symbol() === Clutter.KEY_Escape) { close(); return true; }
            return false;
        });
        container.connect('button-press-event', (a, ev) => {
            let [px, py] = ev.get_coords();
            let [cx, cy] = card.get_transformed_position();
            if (px < cx || px > cx + card.get_width() || py < cy || py > cy + card.get_height()) { close(); return true; }
            return false;
        });
        entry.grab_key_focus();
        // The placeholder must dim the entry's own (white) text colour, not the
        // dark card's, so it stays legible inside the input field.
        GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            try {
                let ec = entry.get_theme_node().get_foreground_color();
                hint.set_style("color: rgba(" + ec.red + ", " + ec.green + ", " + ec.blue + ", 0.55);");
            } catch (e) {}
            return GLib.SOURCE_REMOVE;
        });
    };

    proto._restTip = function(isLong) {
        let shortTips = [
            _("Look ~20 ft away for 20 seconds — rest your eyes."),
            _("Stand up and stretch."),
            _("Drink some water."),
            _("Look out a window and relax your shoulders."),
            _("Close your eyes and take a few slow breaths."),
            _("Step away from screens — don't check your phone."),
            _("Unclench your jaw and drop your shoulders.")
        ];
        let longTips = [
            _("Take a short walk."),
            _("Step outside for some fresh air."),
            _("Stretch and move around a little."),
            _("Grab a snack and some water."),
            _("Rest your eyes and look into the distance."),
            _("Rest away from screens — no phone, no feeds, no news."),
            _("Move your body and let your mind wander.")
        ];
        let tips = isLong ? longTips : shortTips;
        // Rotate through tips rather than repeating the same one.
        this._restTipIndex = ((this._restTipIndex || 0) + 1) % 1000;
        return tips[this._restTipIndex % tips.length];
    };

    proto._showAddTaskDialog = function(existing) {
        let dialog = new ModalDialog.ModalDialog({ destroyOnClose: true });
        this._scaleDialog(dialog);
        let content = new Dialog.MessageDialogContent({
            title: existing ? _("Edit task") : _("New task"),
            description: _("What do you want to work on?")
        });
        let entry = new St.Entry({ style_class: 'run-dialog-entry', can_focus: true });
        let entryHint = new St.Label({ text: _("e.g. Write the report") });
        entry.set_hint_actor(entryHint);
        entry.clutter_text.connect('key-focus-in', () => entryHint.hide());
        entry.clutter_text.connect('key-focus-out', () => { if (!entry.get_text()) { entryHint.show(); } });
        CinnamonEntry.addContextMenu(entry);
        if (existing && existing.title) { entry.set_text(existing.title); }
        content.add_child(entry);

        let est = { value: existing ? Math.max(0, Math.min(99, existing.est || 0)) : 0 };
        let taskPreset = (existing && this._sanitizeTaskPreset(existing.preset)) || this._currentPresetSnapshot();
        let focusLen = taskPreset.pomodoro || 25;
        let fmtMins = (mins) => {
            let h = Math.floor(mins / 60), m = mins % 60;
            if (h > 0) { return m > 0 ? _("%d h %d min").format(h, m) : _("%d h").format(h); }
            return _("%d min").format(m);
        };
        let qLabel = new St.Label({ text: '', style: 'padding-top: 10px;' });
        content.add_child(qLabel);
        // A pomodoro's length comes from the active preset. You can switch the
        // preset right here — the estimate stays counted in pomodoros, only the
        // minutes change. "Custom" lights up when durations match no preset.
        let presetList = this._presetList();
        let presetRow = new St.BoxLayout({ vertical: false, style: 'spacing: 6px; padding-top: 4px;' });
        let presetKeyLabel = new St.Label({ text: _("Preset") + ":", style: 'padding-top: 3px; color: rgba(255,255,255,0.6);' });
        presetRow.add(presetKeyLabel);
        let presetBtns = [];
        let customChip = new St.Label({ text: _("Custom") });

        let estRow = new St.BoxLayout({ vertical: false, style: 'spacing: 6px; padding-top: 4px;' });
        let estBtns = [];
        let estVals = [0, 1, 2, 3, 4, 5, 6];
        let estReadout = new St.Label({ text: '', style: 'padding-top: 4px; color: rgba(255,255,255,0.6);' });
        let plusBtn = new St.Button({ label: "+", style_class: 'button' });
        let restyle = () => {
            focusLen = taskPreset.pomodoro || 25;
            qLabel.set_text(_("How many pomodoros? (1 🍅 = %d min)").format(focusLen));
            for (let k = 0; k < estBtns.length; k++) {
                estBtns[k].set_style('padding: 2px 8px; border-radius: 6px;' + ((estVals[k] === est.value) ? ' background-color: rgba(227,90,60,0.55);' : ''));
            }
            plusBtn.set_style('padding: 2px 8px; border-radius: 6px;' + ((est.value > 6) ? ' background-color: rgba(227,90,60,0.55);' : ''));
            let prefix = (est.value > 6) ? (est.value + " \ud83c\udf45 \u00b7 ") : "";
            estReadout.set_text(est.value === 0 ? _("No estimate — just counts your 🍅") : (prefix + fmtMins(est.value * focusLen)));
            let active = taskPreset.name;
            let matched = false;
            for (let pb of presetBtns) {
                let on = (pb.preset.name === active);
                if (on) { matched = true; }
                pb.btn.set_style('padding: 2px 8px; border-radius: 6px;' + (on ? ' background-color: rgba(227,90,60,0.55);' : ''));
            }
            if (matched) { customChip.hide(); } else { customChip.show(); }
            customChip.set_style('padding: 2px 8px; border-radius: 6px;' + (matched ? '' : ' background-color: rgba(227,90,60,0.55);'));
        };
        presetList.forEach((p) => {
            let b = new St.Button({ label: p.name, style_class: 'button' });
            b.connect('clicked', () => {
                taskPreset = { name: p.name, pomodoro: p.pomodoro, short_break: p.short_break, long_break: p.long_break, pomodori: p.pomodori };
                restyle();
            });
            presetBtns.push({ btn: b, preset: p });
            presetRow.add(b);
        });
        presetRow.add(customChip);
        content.add_child(presetRow);
        estVals.forEach((v) => {
            let b = new St.Button({ label: (v === 0 ? "\u2014" : (v + " \ud83c\udf45")), style_class: 'button' });
            b.connect('clicked', () => { est.value = v; restyle(); });
            estBtns.push(b);
            estRow.add(b);
        });
        plusBtn.connect('clicked', () => { est.value = Math.min(99, Math.max(est.value, 6) + 1); restyle(); });
        estRow.add(plusBtn);
        restyle();
        content.add_child(estRow);
        content.add_child(estReadout);

        // Secondary text here (placeholder, "Preset:" caption, estimate readout) is
        // fixed-white for dark themes; recolour it from the dialog's own theme
        // foreground on open so it stays legible on light themes too.
        dialog.connect('opened', () => {
            try {
                let c = content.get_theme_node().get_foreground_color();
                let dim = "color: rgba(" + c.red + ", " + c.green + ", " + c.blue + ", 0.6);";
                presetKeyLabel.set_style("padding-top: 3px; " + dim);
                estReadout.set_style("padding-top: 4px; " + dim);
                // The placeholder sits inside the entry, which has its own (often
                // white) background — so dim the ENTRY's text colour, not the
                // dialog's, or it washes out.
                let ec = entry.get_theme_node().get_foreground_color();
                entryHint.set_style("color: rgba(" + ec.red + ", " + ec.green + ", " + ec.blue + ", 0.55);");
            } catch (e) {}
        });

        dialog.contentLayout.add(content);
        dialog.setInitialKeyFocus(entry.clutter_text);
        let confirm = () => {
            let t = entry.clutter_text.get_text().trim();
            dialog.close();
            if (t) {
                if (existing) { this._editTask(existing.id, t, est.value, taskPreset); }
                else { this._addTask(t, est.value, taskPreset); }
            }
        };
        entry.clutter_text.connect('key-press-event', (actor, ev) => {
            let s = ev.get_key_symbol();
            if (s === Clutter.KEY_Return || s === Clutter.KEY_KP_Enter) { confirm(); return true; }
            return false;
        });
        dialog.setButtons([
            { label: _("Cancel"), key: Clutter.KEY_Escape, action: () => dialog.close() },
            { label: existing ? _("Save") : _("Add"), default: true, action: confirm }
        ]);
        dialog.open();
    };

    // Add or edit a timer preset (name + focus / short / long / pomodori),
    // managed straight from the menu's Preset submenu.
    proto._showPresetDialog = function(existing, index) {
        let dialog = new ModalDialog.ModalDialog({ destroyOnClose: true });
        this._scaleDialog(dialog);
        let content = new Dialog.MessageDialogContent({
            title: existing ? _("Edit preset") : _("New preset"),
            description: _("Name it and set its rhythm.")
        });
        let entry = new St.Entry({ style_class: 'run-dialog-entry', can_focus: true });
        let entryHint = new St.Label({ text: _("e.g. Deep work") });
        entry.set_hint_actor(entryHint);
        entry.clutter_text.connect('key-focus-in', () => entryHint.hide());
        entry.clutter_text.connect('key-focus-out', () => { if (!entry.get_text()) { entryHint.show(); } });
        CinnamonEntry.addContextMenu(entry);
        if (existing && existing.name) { entry.set_text(existing.name); }
        content.add_child(entry);
        dialog.connect('opened', () => { try { let ec = entry.get_theme_node().get_foreground_color(); entryHint.set_style("color: rgba(" + ec.red + ", " + ec.green + ", " + ec.blue + ", 0.55);"); } catch (e) {} });

        let vals = {
            pomodoro: existing ? (parseInt(existing.pomodoro) || 25) : 25,
            short_break: existing ? (parseInt(existing.short_break) || 5) : 5,
            long_break: existing ? (parseInt(existing.long_break) || 15) : 15,
            pomodori: existing ? (parseInt(existing.pomodori) || 4) : 4
        };
        let minFmt = (v) => _("%d min").format(v);
        let numFmt = (v) => "" + v;
        let mkStepper = (labelText, key, min, max, step, fmt) => {
            let row = new St.BoxLayout({ vertical: false, style: 'spacing: 8px; padding-top: 6px;' });
            row.add(new St.Label({ text: labelText, style: 'min-width: 150px; padding-top: 4px;' }));
            let minus = new St.Button({ label: "\u2212", style_class: 'button', style: 'padding: 2px 12px;' });
            let valLab = new St.Label({ text: fmt(vals[key]), style: 'min-width: 64px; padding-top: 4px; text-align: center;' });
            let plus = new St.Button({ label: "+", style_class: 'button', style: 'padding: 2px 12px;' });
            minus.connect('clicked', () => { vals[key] = Math.max(min, vals[key] - step); valLab.set_text(fmt(vals[key])); });
            plus.connect('clicked', () => { vals[key] = Math.min(max, vals[key] + step); valLab.set_text(fmt(vals[key])); });
            row.add(minus); row.add(valLab); row.add(plus);
            content.add_child(row);
        };
        mkStepper(_("Focus (min)"), 'pomodoro', 1, 180, 5, minFmt);
        mkStepper(_("Short break (min)"), 'short_break', 1, 120, 5, minFmt);
        mkStepper(_("Long break (min)"), 'long_break', 1, 180, 5, minFmt);
        mkStepper(_("Pomodori"), 'pomodori', 1, 16, 1, numFmt);

        dialog.contentLayout.add(content);
        dialog.setInitialKeyFocus(entry.clutter_text);
        let confirm = () => {
            let name = entry.clutter_text.get_text().trim();
            dialog.close();
            if (!name) { return; }
            if (existing) { this._editPreset(index, name, vals.pomodoro, vals.short_break, vals.long_break, vals.pomodori); }
            else { this._addPreset(name, vals.pomodoro, vals.short_break, vals.long_break, vals.pomodori); }
        };
        entry.clutter_text.connect('key-press-event', (actor, ev) => {
            let s = ev.get_key_symbol();
            if (s === Clutter.KEY_Return || s === Clutter.KEY_KP_Enter) { confirm(); return true; }
            return false;
        });
        dialog.setButtons([
            { label: _("Cancel"), key: Clutter.KEY_Escape, action: () => dialog.close() },
            { label: existing ? _("Save") : _("Add"), default: true, action: confirm }
        ]);
        dialog.open();
    };

    // Translation + formatting hooks passed to the pure recommendation engine,
    // so 6.4/recommend.js stays free of GJS dependencies and unit-testable.
    proto._recoDeps = function() {
        return {
            _: _,
            format: function(tmpl) {
                let args = Array.prototype.slice.call(arguments, 1);
                return tmpl.format.apply(tmpl, args);
            }
        };
    };

    // Recommendation engine for the smart onboarding wizard. Thin adapter over
    // the pure module in 6.4/recommend.js: it returns the structured plan items
    // plus the flat { settings, reasons } shape the wizard has always used (the
    // settings are the union of applied items; reasons are their labels). No
    // side effects — the wizard applies the result only when the user accepts.
    proto._computeFocusPlan = function(a) {
        let plan = RecommendModule.computeFocusPlan(a || {}, this._recoDeps());
        return { items: plan.items || [] };
    };

    // Smart, adaptive onboarding: ask a few diagnostic questions, then compute
    // and apply a tailored setup instead of making the user pick raw presets.
    // A short, persistent explanation of the technique (Settings button), so it
    // is available without re-running the onboarding wizard.
    proto._showAboutTechnique = function() {
        let dialog = new ModalDialog.ModalDialog({ destroyOnClose: true });
        this._scaleDialog(dialog);
        let scroll = new St.ScrollView({ style: 'max-height: 460px;' });
        scroll.set_policy(St.PolicyType.NEVER, St.PolicyType.AUTOMATIC);
        let box = new St.BoxLayout({ vertical: true, style: 'spacing: 9px; width: 540px; padding: 8px 16px;' });
        scroll.add_actor(box);
        dialog.contentLayout.add(scroll);
        box.add(new St.Label({ text: _("The Pomodoro technique \ud83c\udf45"), style: 'font-size: 1.35em; font-weight: bold;' }));
        let para = (s) => { let l = new St.Label({ text: s }); l.clutter_text.line_wrap = true; box.add(l); };
        para(_("In the late 1980s, university student Francesco Cirillo couldn't focus on his studies. He bet himself he could stay concentrated for just a few minutes and reached for the first timer he could find — a kitchen one shaped like a tomato. In Italian, a tomato is a \u201cpomodoro\u201d, and that's how the method got its name."));
        para(_("The idea is simple: big tasks feel daunting, but a single pomodoro doesn't. Promise yourself just 25 minutes of focus on one task, and starting becomes easy."));
        para(_("The classic rhythm:\n\u2022 About 25 minutes — one task, nothing else.\n\u2022 A 5-minute breather — step away from the screen.\n\u2022 After four pomodoros, take a longer 15–30 minute break."));
        para(_("This is a starting point, not a rule — the applet lets you change any interval and save your own presets."));
        para(_("And it's not just a productivity fad: the exact numbers are flexible, but the principles behind them are backed by attention research. Staying on one task without switching saves energy — getting back on track after an interruption takes about 23 minutes on average. And regular pauses help you hold focus for longer without burning out."));
        para(_("Tip: when something distracts you, don't drop what you're doing — jot the thought down and come back to it on your break. Every finished pomodoro is a small win that keeps your momentum going."));
        dialog.setButtons([{ label: _("Close"), default: true, action: () => dialog.close() }]);
        dialog.open();
    };

    // A tiny one-message modal used by the onboarding undo flow.
    proto._onboardingNotice = function(heading, body) {
        let dialog = new ModalDialog.ModalDialog({ destroyOnClose: true });
        this._scaleDialog(dialog);
        let box = new St.BoxLayout({ vertical: true, style: 'spacing: 8px; width: 460px; padding: 8px 16px;' });
        box.add(new St.Label({ text: heading, style: 'font-size: 1.2em; font-weight: bold;' }));
        let p = new St.Label({ text: body });
        p.clutter_text.line_wrap = true;
        box.add(p);
        dialog.contentLayout.add(box);
        dialog.setButtons([{ label: _("OK"), default: true, action: () => dialog.close() }]);
        dialog.open();
        return dialog;
    };

    // Undo the last applied setup: restore each setting captured in the
    // onboarding_backup snapshot, then clear the snapshot so a repeat click is
    // a harmless no-op. Wired to the "Undo last setup" button in Settings.
    proto._restoreOnboardingBackup = function() {
        let sp = this._settingsProvider;
        let backup = null;
        try { backup = sp.getValue('onboarding_backup'); } catch (e) {}
        if (!backup || !backup.values || typeof backup.values !== 'object' || !Object.keys(backup.values).length) {
            return this._onboardingNotice(_("Nothing to undo"),
                _("Apply a setup from the guide first — then you can undo it here."));
        }
        Object.keys(backup.values).forEach((k) => { try { sp.setValue(k, backup.values[k]); } catch (e) {} });
        try { sp.setValue('onboarding_backup', null); } catch (e) {}
        return this._onboardingNotice(_("Previous settings restored \u2713"),
            _("Your settings from just before the last setup have been put back."));
    };

    proto._showOnboardingWizard = function() {
        let dialog = new ModalDialog.ModalDialog({ destroyOnClose: true });
        this._scaleDialog(dialog);
        let sp = this._settingsProvider;
        let answers = {};
        let st = { step: 0 };
        let content = new St.BoxLayout({ vertical: true, style: 'spacing: 10px; width: 560px; padding: 6px 14px;' });
        dialog.contentLayout.add(content);

        let title = (s) => new St.Label({ text: s, style: 'font-size: 1.35em; font-weight: bold;' });
        let para = (s) => { let l = new St.Label({ text: s }); l.clutter_text.line_wrap = true; return l; };
        let BASE = 'margin: 5px 0 0 0; padding: 9px 14px; border-radius: 8px;';
        let SEL = BASE + ' background-color: rgba(227,90,60,0.92); color: #ffffff; font-weight: bold; border: 1px solid #e3593c;';

        // Keyboard navigation, layered on top of native focus so it stays
        // accessible: options/checkboxes are real focusable buttons, so Tab moves
        // between them and Space/Enter activate the focused one (handled by St),
        // and screen readers announce their labels. On top of that we add
        // accelerators — digits 1-9 select/toggle the matching option, Up/Down
        // move focus between options, Backspace goes Back. Enter (default button),
        // Escape (Skip) and Tab are left to the dialog's own handling. The handler
        // sits on `content`, an ancestor of the options, so it catches these keys
        // as they bubble up from the focused option.
        let onKey = (actor, ev) => {
            let sym = ev.get_key_symbol();
            let nav = st.nav || {};
            if (sym === Clutter.KEY_BackSpace) { if (nav.back) { nav.back(); return true; } return false; }
            if (sym === Clutter.KEY_Up) { if (nav.move) { nav.move(-1); return true; } return false; }
            if (sym === Clutter.KEY_Down) { if (nav.move) { nav.move(1); return true; } return false; }
            let n = RecommendModule.keysymToOptionIndex(sym);
            if (n >= 0 && nav.selectIndex && n < (nav.count || 0)) { nav.selectIndex(n); return true; }
            return false;
        };
        content.connect('key-press-event', onKey);

        // A question's option rows: real focusable buttons (Tab/AT reach them,
        // Space/Enter activate the focused one). Single-select highlights one
        // choice; multi-select (obstacles) toggles up to `cap` with a "Selected n
        // of cap" hint, refusing further picks at the cap. Returns a controller so
        // the keyboard accelerators can select and move focus by index.
        let ask = (key, opts, multi, cap, onNext) => {
            let col = new St.BoxLayout({ vertical: true, style: 'spacing: 2px;' });
            let btns = [];
            if (multi && !Array.isArray(answers[key])) {
                answers[key] = (answers[key] === undefined || answers[key] === null) ? [] : [answers[key]];
            }
            let isSel = (v) => multi ? (answers[key].indexOf(v) !== -1) : (answers[key] === v);
            let RING = ' border: 2px solid rgba(255,255,255,0.92);'; // visible keyboard-focus ring
            let focusedIdx = -1;
            let hint = null;
            let styleOne = (i) => {
                let x = btns[i];
                if (!x) { return; }
                let s = isSel(x.v) ? SEL : BASE;
                if (i === focusedIdx) { s += RING; }
                x.b.set_style(s);
            };
            let repaint = () => {
                btns.forEach((x, i) => { styleOne(i); this._dashSetA11y(x.b, opts[i].label); });
                if (hint) { hint.set_text(_("Selected %d of %d").format(answers[key].length, cap)); }
            };
            // Select (single) or toggle (multi) an option — click / Space / number.
            // Never changes step; advancing is Enter or the Next button.
            let select = (i) => {
                let o = opts[i];
                if (!o) { return; }
                let capped = false;
                if (multi) {
                    let arr = answers[key];
                    let idx = arr.indexOf(o.value);
                    if (idx !== -1) { arr.splice(idx, 1); }
                    else if (arr.length < cap) { arr.push(o.value); }
                    else { capped = true; }   // already at the limit — say why, don't silently ignore
                } else {
                    answers[key] = o.value;
                }
                repaint();
                if (capped && hint) { hint.set_text(_("You can pick up to %d — deselect one first").format(cap)); }
                if (btns[i]) { btns[i].b.grab_key_focus(); }
            };
            opts.forEach((o, i) => {
                let b = new St.Button({ x_expand: true, style_class: 'button' });
                b.can_focus = true;   // St.Button ignores the constructor arg; set it so Tab/AT reach it
                b.set_label(o.label);
                // Click / Space select (toggle for multi) — never change step.
                b.connect('clicked', () => select(i));
                // Enter on a focused option advances instead of toggling it, so the
                // model stays consistent: Space = select, Enter = next.
                b.connect('key-press-event', (actor, ev) => {
                    let s = ev.get_key_symbol();
                    if (s === Clutter.KEY_Return || s === Clutter.KEY_KP_Enter || s === Clutter.KEY_ISO_Enter) {
                        if (onNext) { onNext(); }
                        return true; // stop: don't let the button toggle on Enter
                    }
                    return false; // Space (and others) fall through to native activation
                });
                // Visible ring on the keyboard-focused option, so arrows/Tab read clearly.
                b.connect('key-focus-in', () => { focusedIdx = i; styleOne(i); });
                b.connect('key-focus-out', () => { if (focusedIdx === i) { focusedIdx = -1; } styleOne(i); });
                btns.push({ b: b, v: o.value });
                col.add(b);
            });
            if (multi) {
                hint = new St.Label({ style: 'font-size: 0.8em; padding: 4px 2px 0 2px; color: rgba(160,160,160,0.95);' });
                col.add(hint);
            }
            repaint();
            return {
                actor: col,
                count: opts.length,
                select: select,
                move: (d) => {
                    // Arrows just move the visible focus ring (Space selects, Enter advances).
                    let cur = global.stage.get_key_focus();
                    let i = btns.findIndex((x) => x.b === cur);
                    if (i === -1) { i = 0; }
                    let ni = Math.max(0, Math.min(btns.length - 1, i + d));
                    if (btns[ni]) { btns[ni].b.grab_key_focus(); }
                },
                focusFirst: () => {
                    let i = 0;
                    if (!multi) { let j = opts.findIndex((o) => o.value === answers[key]); if (j >= 0) { i = j; } }
                    else { let j = opts.findIndex((o) => answers[key].indexOf(o.value) !== -1); if (j >= 0) { i = j; } }
                    if (btns[i]) { btns[i].b.grab_key_focus(); }
                }
            };
        };

        // The question set is computed adaptively per answer by the engine's
        // buildQuestionFlow(); see build() below. No static list lives here.

        let finish = () => { try { sp.setValue('onboarding_done', true); } catch (e) {} dialog.close(); };
        let applyPlan = (plan, thenStart) => {
            // Snapshot the current value of every key this plan could touch (even
            // ones the user unticked) so the whole setup can be undone later via
            // Settings → "Undo last setup".
            try {
                let values = {};
                RecommendModule.collectBackupKeys(plan.items).forEach((k) => {
                    try { values[k] = sp.getValue(k); } catch (e) {}
                });
                sp.setValue('onboarding_backup', { ts: Date.now(), values: values });
            } catch (e) {}
            // Apply only the core items plus the ones still ticked on the review.
            let settings = RecommendModule.selectKeys(plan.items);
            Object.keys(settings).forEach((k) => { try { sp.setValue(k, settings[k]); } catch (e) {} });
            try { sp.setValue('onboarding_done', true); } catch (e) {}
            dialog.close();
            this._onboardingNotice(_("Setup applied \u2713"), _("You can undo it anytime in Settings \u2192 \u201cUndo last setup\u201d."));
            if (thenStart) { try { this._startTimerFromMenu(); } catch (e) {} }
        };

        let build = () => {
            content.destroy_all_children();
            // Recompute the adaptive flow each time — branches appear/disappear as
            // answers change. Steps: 0 = intro, 1..nQ = questions, nQ+1 = review.
            let flow = RecommendModule.buildQuestionFlow(answers, this._recoDeps());
            let nQ = flow.length;
            let reviewStep = nQ + 1;
            if (st.step > reviewStep) { st.step = reviewStep; } // a branch vanished
            if (st.step < 0) { st.step = 0; }
            let s = st.step;

            let phase = (s === 0) ? _("Intro")
                      : (s <= nQ) ? _("Step %d of %d").format(s, nQ)
                      : _("Review");
            let head = new St.BoxLayout({ vertical: false, style: 'padding-bottom: 2px;' });
            head.add(new St.Label({ text: "\ud83c\udf45 " + _("Smart setup") + "  \u00b7  " + phase,
                style: 'font-size: 0.8em; color: rgba(160,160,160,0.95);' }));
            content.add(head);

            let buttons = [{ label: _("Skip"), action: finish, key: Clutter.KEY_Escape }];
            st.focusFirst = null;

            if (s === 0) {
                content.add(title(_("What is the Pomodoro technique? \ud83c\udf45")));
                content.add(para(_("Focus in short sprints with deliberate rest: about 25 minutes on one task, then a 5-minute break; after four sprints, take a longer 15–30 minute break. The finite countdown keeps a task approachable and the regular breaks protect your attention.")));
                content.add(para(_("Let's tune it to how you work — a few quick questions, and you can change anything later in Settings.")));
                st.nav = { count: 0 };
                buttons.push({ label: _("About the Pomodoro technique"), action: () => { this._showAboutTechnique(); } });
                buttons.push({ label: _("Let's go"), default: true, action: () => { st.step++; build(); } });
            } else if (s <= nQ) {
                let q = flow[s - 1];
                let isMulti = q.type === 'multi';
                content.add(title(q.title));
                if (q.help) { content.add(para(q.help)); }
                // Advancing to the next step (Enter or Next), deferred to idle so we
                // never tear the row down from inside its own key/click handler.
                // `committed` guards against a double-advance on rapid input.
                let committed = false;
                let advance = () => {
                    if (committed) { return; }
                    committed = true;
                    GLib.idle_add(GLib.PRIORITY_DEFAULT, () => { st.step++; build(); return GLib.SOURCE_REMOVE; });
                };
                let ctrl = ask(q.key, q.opts, isMulti, q.cap, advance);
                content.add(ctrl.actor);
                let hintText = isMulti
                    ? _("Space or 1–%d to toggle · ↑↓ to move · Enter for next").format(q.opts.length)
                    : _("Space or 1–%d to choose · ↑↓ to move · Enter for next").format(q.opts.length);
                let kbHint = new St.Label({ text: hintText,
                    style: 'font-size: 0.78em; padding: 8px 2px 0 2px; color: rgba(150,150,150,0.9);' });
                kbHint.clutter_text.line_wrap = true;
                content.add(kbHint);
                st.nav = {
                    count: ctrl.count,
                    selectIndex: (i) => ctrl.select(i),
                    move: (d) => ctrl.move(d),
                    back: () => { st.step--; build(); }
                };
                st.focusFirst = ctrl.focusFirst;
                buttons.push({ label: _("Back"), action: () => { st.step--; build(); } });
                buttons.push({ label: _("Next"), default: true, action: advance });
            } else {
                let plan = this._computeFocusPlan(answers);
                content.add(title(_("Your tailored setup \ud83c\udf45")));
                content.add(para(_("Based on your answers, here's what I'll set up. Untick anything you'd rather skip, then apply.")));
                let list = new St.BoxLayout({ vertical: true, style: 'spacing: 4px; padding: 6px 0 2px 0;' });
                let toggles = [];           // optional items, in display order
                let focusedBox = null;
                plan.items.filter((it) => it.label).forEach((it) => {
                    if (it.core) {
                        // Core recommendation (the focus rhythm) — always applied.
                        let row = new St.BoxLayout({ vertical: false, style: 'spacing: 8px; padding: 5px 6px;' });
                        row.add(new St.Label({ text: "\u2713", style: 'color: #6fcf97; font-weight: bold;' }));
                        let t = new St.Label({ text: it.label });
                        t.clutter_text.line_wrap = true;
                        row.add(t);
                        list.add(row);
                    } else {
                        // Optional recommendation — a focusable checkbox the user can untick.
                        if (it.enabled === undefined) { it.enabled = true; }
                        let box = new St.Button({ x_expand: true, style_class: 'button' });
                        box.can_focus = true;   // St.Button ignores the constructor arg; set it so Tab/AT reach it
                        let inner = new St.BoxLayout({ vertical: false, x_expand: true, style: 'spacing: 8px;' });
                        let check = new St.Label({ y_align: Clutter.ActorAlign.START });
                        let label = new St.Label({ text: it.label, x_expand: true });
                        label.clutter_text.line_wrap = true;
                        inner.add(check);
                        inner.add(label);
                        box.set_child(inner);
                        let paint = () => {
                            check.set_text(it.enabled ? "\u2611" : "\u2610");
                            check.set_style((it.enabled ? 'color: #6fcf97;' : 'color: rgba(150,150,150,0.9);') + ' font-weight: bold;');
                            label.set_opacity(it.enabled ? 255 : 120);
                            // Visible ring on the keyboard-focused row, plus an accessible
                            // name that carries the checkbox state (glyph is language-neutral).
                            let ring = (focusedBox === box) ? ' border: 2px solid rgba(255,255,255,0.92);' : '';
                            box.set_style('padding: 5px 6px; border-radius: 6px;' + ring);
                            this._dashSetA11y(box, (it.enabled ? "\u2611 " : "\u2610 ") + it.label);
                        };
                        box.connect('clicked', () => { it.enabled = !it.enabled; paint(); });
                        box.connect('key-focus-in', () => { focusedBox = box; paint(); });
                        box.connect('key-focus-out', () => { if (focusedBox === box) { focusedBox = null; } paint(); });
                        // Space toggles (native click); Enter applies, consistent with the
                        // questions where Enter means "proceed".
                        box.connect('key-press-event', (actor, ev) => {
                            let s = ev.get_key_symbol();
                            if (s === Clutter.KEY_Return || s === Clutter.KEY_KP_Enter || s === Clutter.KEY_ISO_Enter) {
                                applyPlan(plan, true);
                                return true;
                            }
                            return false;
                        });
                        paint();
                        toggles.push({ it: it, box: box });
                        list.add(box);
                    }
                });
                content.add(list);
                if (toggles.length) {
                    let rHint = new St.Label({ text: _("Space to toggle · ↑↓ to move · Enter to apply"),
                        style: 'font-size: 0.78em; padding: 8px 2px 0 2px; color: rgba(150,150,150,0.9);' });
                    rHint.clutter_text.line_wrap = true;
                    content.add(rHint);
                }
                let toggleAt = (i) => { if (toggles[i]) { toggles[i].box.emit('clicked', 1); toggles[i].box.grab_key_focus(); } };
                st.nav = {
                    count: toggles.length,
                    selectIndex: (i) => toggleAt(i),
                    move: (d) => {
                        let cur = global.stage.get_key_focus();
                        let i = toggles.findIndex((t) => t.box === cur);
                        i = (i === -1) ? 0 : Math.max(0, Math.min(toggles.length - 1, i + d));
                        if (toggles[i]) { toggles[i].box.grab_key_focus(); }
                    },
                    back: () => { st.step--; build(); }
                };
                if (toggles.length) { st.focusFirst = () => toggles[0].box.grab_key_focus(); }
                buttons.push({ label: _("Back"), action: () => { st.step--; build(); } });
                buttons.push({ label: _("Apply"), action: () => applyPlan(plan, false) });
                buttons.push({ label: "\ud83c\udf45  " + _("Apply & start"), default: true, action: () => applyPlan(plan, true) });
            }
            dialog.setButtons(buttons);
            // Land keyboard focus on the first option/checkbox so keyboard and
            // screen-reader users start inside the content (not on a footer button).
            // Deferred to idle so the new rows are realized before we grab focus.
            if (st.focusFirst) {
                let ff = st.focusFirst;
                GLib.idle_add(GLib.PRIORITY_DEFAULT, () => { try { ff(); } catch (e) {} return GLib.SOURCE_REMOVE; });
            }
        };
        build();
        dialog.open();
        return dialog;
    };

    proto._dashFmtMin = function(min) {
        min = Math.max(0, Math.round(min || 0));
        if (min < 60) {
            return _("%d min").format(min);
        }
        let hrs = Math.floor(min / 60);
        let rem = min % 60;
        return rem ? _("%dh %dm").format(hrs, rem) : _("%dh").format(hrs);
    };

    proto._dashMilestoneTier = function(value, tiers) {
        let best = 0;
        for (let t of tiers) {
            if (value >= t) {
                best = t;
            }
        }
        return best;
    };

    proto._dashStatCard = function(caption, value, sub, accent) {
        let col = `rgb(${Math.round(accent[0] * 255)},${Math.round(accent[1] * 255)},${Math.round(accent[2] * 255)})`;
        let card = new St.BoxLayout({
            vertical: true,
            x_expand: true,
            style: 'spacing: 3px; padding: 12px; border-radius: 10px; background-color: rgba(128,128,128,0.16); min-width: 118px;'
        });
        card.add(new St.Label({ text: caption, style: 'font-size: 0.82em;' }));
        card.add(new St.Label({ text: value, style: 'font-size: 1.7em; font-weight: bold; color: ' + col + ';' }));
        card.add(new St.Label({ text: sub || "", style: 'font-size: 0.82em;' }));
        this._dashSetA11y(card, caption + ": " + value + (sub ? (", " + sub) : ""));
        return card;
    };

    proto._paintDashBars = function(area) {
        let cr = area.get_context();
        try {
            let [w, h] = area.get_surface_size();
            let bars = this._dashBars || [];
            let n = bars.length || 14;
            let maxv = 1;
            for (let b of bars) {
                if (b.min > maxv) { maxv = b.min; }
            }
            let gap = 6;
            let bottomPad = 4;
            let bw = Math.max(2, (w - gap * (n - 1)) / n);
            let chartH = Math.max(4, h - bottomPad);
            let acc = this._dashAccent || [0.93, 0.42, 0.31];
            for (let i = 0; i < n; i++) {
                let b = bars[i] || { min: 0 };
                let x = Math.round(i * (bw + gap));
                cr.setSourceRGBA(0.5, 0.5, 0.5, 0.16);
                cr.rectangle(x, 0, Math.round(bw), chartH);
                cr.fill();
                let bh = Math.round((b.min / maxv) * (chartH - 2));
                if (bh > 0) {
                    cr.setSourceRGBA(acc[0], acc[1], acc[2], b.today ? 1.0 : 0.62);
                    cr.rectangle(x, chartH - bh, Math.round(bw), bh);
                    cr.fill();
                }
            }
            // Daily-goal reference line, drawn on top of the bars. Only shown when
            // it falls within the current chart scale (hidden if no day reached it).
            let goalMin = this._dashGoalMin || 0;
            if (goalMin > 0 && goalMin <= maxv) {
                let gy = Math.round(chartH - (goalMin / maxv) * (chartH - 2)) + 0.5;
                cr.setSourceRGBA(0.55, 0.55, 0.55, 0.9);
                cr.setLineWidth(1);
                cr.setDash([3, 3], 0);
                cr.moveTo(0, gy);
                cr.lineTo(w, gy);
                cr.stroke();
                cr.setDash([], 0);
            }
        } finally {
            cr.$dispose();
        }
    };

    // Map a raw activity value to a discrete level: 0 = none, 1..4 = increasing.
    proto._dashHeatLevel = function(v, maxv) {
        if (!(v > 0)) { return 0; }
        if (maxv <= 0) { return 1; }
        return Math.max(1, Math.min(4, Math.ceil((v / maxv) * 4)));
    };

    // Discrete 5-step intensity ramp for the activity heatmap and its legend.
    // A single-hue luminance ramp (accent at well-separated, discrete alphas) is
    // the colour-vision-safe choice: all CVD types preserve luminance ordering,
    // and the discrete steps give clear boundaries between levels. The ordering
    // stays monotonic over both dark and light dialog backgrounds.
    // level 0 = no activity (faint neutral); levels 1..4 = increasing focus.
    proto._dashHeatColor = function(cr, level) {
        if (level <= 0) {
            cr.setSourceRGBA(0.5, 0.5, 0.5, 0.16);
            return;
        }
        let acc = this._dashAccent || [0.93, 0.42, 0.31];
        let alpha = [0.28, 0.48, 0.70, 0.95][Math.max(1, Math.min(4, level)) - 1];
        cr.setSourceRGBA(acc[0], acc[1], acc[2], alpha);
    };

    proto._paintDashHeatmap = function(area) {
        let cr = area.get_context();
        try {
            let [w, h] = area.get_surface_size();
            let data = this._dashHeatmap || [];
            let cols = 12;
            let rows = 7;
            let maxv = 1;
            for (let v of data) {
                if (v > maxv) { maxv = v; }
            }
            let gap = 3;
            let cw = Math.max(3, (w - gap * (cols - 1)) / cols);
            let ch = Math.max(3, (h - gap * (rows - 1)) / rows);
            for (let col = 0; col < cols; col++) {
                for (let row = 0; row < rows; row++) {
                    let idx = col * rows + row;
                    let v = (idx < data.length) ? data[idx] : 0;
                    let x = Math.round(col * (cw + gap));
                    let y = Math.round(row * (ch + gap));
                    this._dashHeatColor(cr, this._dashHeatLevel(v, maxv));
                    cr.rectangle(x, y, Math.round(cw), Math.round(ch));
                    cr.fill();
                }
            }
        } finally {
            cr.$dispose();
        }
    };

    proto._paintDashLegend = function(area) {
        let cr = area.get_context();
        try {
            let [w, h] = area.get_surface_size();
            let n = 5;
            let gap = 3;
            let cw = Math.max(3, (w - gap * (n - 1)) / n);
            for (let i = 0; i < n; i++) {
                let x = Math.round(i * (cw + gap));
                this._dashHeatColor(cr, i);
                cr.rectangle(x, 0, Math.round(cw), h);
                cr.fill();
            }
        } finally {
            cr.$dispose();
        }
    };

    proto._paintMiniBar = function(area, frac) {
        let cr = area.get_context();
        try {
            let [w, h] = area.get_surface_size();
            let acc = this._dashAccent || [0.93, 0.42, 0.31];
            let y = Math.round(h * 0.2);
            let bh = Math.max(3, Math.round(h * 0.6));
            cr.setSourceRGBA(0.5, 0.5, 0.5, 0.18);
            cr.rectangle(0, y, w, bh);
            cr.fill();
            let fw = Math.max(0, Math.min(1, frac)) * w;
            cr.setSourceRGBA(acc[0], acc[1], acc[2], 0.9);
            cr.rectangle(0, y, fw, bh);
            cr.fill();
        } finally {
            cr.$dispose();
        }
    };

    // Clear all tracked focus statistics (today, streak, history, totals,
    // heatmap). Useful to start fresh or wipe test data. Guarded by a
    // two-step confirmation in the dashboard.
    proto._resetStatistics = function() {
        this._dailyStatsData = {
            date: "", count: 0, streak: 0, lastGoalMetDate: "",
            history: {}, total: 0, totalMinutes: 0, totalInterruptions: 0,
            hours: new Array(24).fill(0)
        };
        try {
            this._writeJsonAsync(POMODORO_STATS_FILE, this._dailyStatsData);
        } catch (e) {
            global.logError("Zen Pomodoro: reset statistics failed: " + e);
        }
        this._dailyCount = 0;
        this._dailyStreak = 0;
        if (typeof this._updateMenuRuntime === "function") {
            this._updateMenuRuntime();
        }
        Main.notify(_("Statistics reset."));
    };

    proto._peakFocusHour = function(hours) {
        if (!Array.isArray(hours)) { return null; }
        let total = hours.reduce((a, b) => a + (b || 0), 0);
        if (total < 8) { return null; }
        let bestStart = 0, bestSum = -1;
        for (let hh = 0; hh < 24; hh++) {
            let s = (hours[hh] || 0) + (hours[(hh + 1) % 24] || 0);
            if (s > bestSum) { bestSum = s; bestStart = hh; }
        }
        let fmt = (x) => (x < 10 ? "0" : "") + x + ":00";
        return { hour: bestStart, label: fmt(bestStart) + "\u2013" + fmt((bestStart + 2) % 24) };
    };

    proto._statsInsight = function(st) {
        let goal = this._opt_dailyGoal || 0;
        if (goal > 0) {
            let left = goal - (st.today || 0);
            if (left > 0) {
                let est = this._estimateFinish();
                if (est) { return _("%d to go today — at your pace, done by about %s.").format(left, est.time); }
                return _("%d more to reach today's goal of %d.").format(left, goal);
            }
            return _("Daily goal reached — %d done today. Nice.").format(st.today || 0);
        }
        if ((st.interruptionsWeek || 0) >= 5) {
            return Gettext.dngettext(UUID, "%d interruption this week — what keeps pulling you away?", "%d interruptions this week — what keeps pulling you away?", st.interruptionsWeek).format(st.interruptionsWeek);
        }
        let peak = this._peakFocusHour(st.hours);
        if (peak) { return _("Most focused around %s — good time for deep work.").format(peak.label); }
        let tasks = this._taskList().slice().sort((a, b) => (b.done || 0) - (a.done || 0));
        if (tasks.length && (tasks[0].done || 0) > 0) {
            return _("Most focus went to \u201c%s\u201d.").format(tasks[0].title);
        }
        if ((st.week || 0) > 0) { return Gettext.dngettext(UUID, "%d pomodoro this week. Keep it going.", "%d pomodoros this week. Keep it going.", st.week).format(st.week); }
        return _("Start a focus session — your insights will appear here.");
    };

    proto._paintHours = function(area) {
        let cr = area.get_context();
        try {
            let [w, h] = area.get_surface_size();
            let data = this._dashHours || new Array(24).fill(0);
            let maxv = 1;
            for (let v of data) { if (v > maxv) { maxv = v; } }
            let n = 24, gap = 2;
            let bw = Math.max(1, (w - gap * (n - 1)) / n);
            let acc = this._dashAccent || [0.93, 0.42, 0.31];
            let peak = this._dashPeakHour;
            for (let i = 0; i < n; i++) {
                let x = Math.round(i * (bw + gap));
                cr.setSourceRGBA(0.5, 0.5, 0.5, 0.16);
                cr.rectangle(x, 0, Math.round(bw), h);
                cr.fill();
                let bh = Math.round((data[i] / maxv) * (h - 2));
                if (bh > 0) {
                    let isPeak = (peak !== null && (i === peak || i === (peak + 1) % 24));
                    cr.setSourceRGBA(acc[0], acc[1], acc[2], isPeak ? 1.0 : 0.5);
                    cr.rectangle(x, h - bh, Math.round(bw), bh);
                    cr.fill();
                }
            }
        } finally {
            cr.$dispose();
        }
    };

    proto._dashDateLabel = function(d) {
        try {
            // Translators: short date used on chart axes and tooltips (strftime
            // tokens). Reorder for your locale, e.g. "%m/%d". %d = day, %m = month.
            let dt = GLib.DateTime.new_local(d.getFullYear(), d.getMonth() + 1, d.getDate(), 0, 0, 0);
            if (dt) {
                let s = dt.format(_("%d.%m"));
                if (s) { return s; }
            }
        } catch (e) {}
        // Fallback to numeric DD.MM if GLib date formatting is unavailable.
        let dd = d.getDate(), mm = d.getMonth() + 1;
        return (dd < 10 ? "0" : "") + dd + "." + (mm < 10 ? "0" : "") + mm;
    };

    // Keep the floating dashboard tooltip fully inside the given monitor: offset
    // from the cursor by default, but flip to the left / above when it would spill
    // past the right / bottom edge, then hard-clamp to the monitor rectangle so it
    // never leaves the screen. mon = { x, y, width, height }.
    proto._dashClampTip = function(ex, ey, tw, th, mon) {
        let ox = 14, oy = 10, margin = 6;
        let px = Math.round(ex) + ox;
        let py = Math.round(ey) + oy;
        if (mon && mon.width && mon.height) {
            if (px + tw > mon.x + mon.width - margin) { px = Math.round(ex) - tw - ox; }
            if (py + th > mon.y + mon.height - margin) { py = Math.round(ey) - th - oy; }
            px = Math.max(mon.x + margin, Math.min(px, mon.x + mon.width - tw - margin));
            py = Math.max(mon.y + margin, Math.min(py, mon.y + mon.height - th - margin));
        }
        return [Math.round(px), Math.round(py)];
    };

    // Best-effort accessible name for a chart/card actor, so screen readers can
    // announce a text summary of canvas-drawn graphics (mirrors the panel a11y).
    proto._dashSetA11y = function(actor, name) {
        try {
            if (actor && typeof actor.get_accessible === 'function') {
                let acc = actor.get_accessible();
                if (acc && typeof acc.set_name === 'function') { acc.set_name(name); }
            }
        } catch (e) {}
    };

    // Immediate in-dialog feedback for Copy / Export. Stays visible until the
    // next action, and works even when system notifications are suppressed
    // (e.g. Do-Not-Disturb during a focus session).
    proto._dashFlashStatus = function(text) {
        let l = this._dashStatusLabel;
        if (!l) { return; }
        try { l.set_text(text); l.show(); } catch (e) {}
    };

    // Write a text file asynchronously (mirrors _writeJsonAsync's IO style).
    // Calls onDone(true|false) when finished. Best-effort: never throws.
    proto._writeTextAsync = function(path, text, onDone) {
        try {
            GLib.mkdir_with_parents(GLib.path_get_dirname(path), 0o755);
            let file = Gio.File.new_for_path(path);
            let bytes = GLib.Bytes.new(ByteArray.fromString(text));
            file.replace_contents_bytes_async(bytes, null, false,
                Gio.FileCreateFlags.REPLACE_DESTINATION, null, (f, res) => {
                    let ok = false;
                    try { f.replace_contents_finish(res); ok = true; } catch (e) { ok = false; }
                    if (onDone) { onDone(ok); }
                });
        } catch (e) {
            if (onDone) { onDone(false); }
        }
    };

    // A visible, user-owned destination for the export: the Documents folder,
    // falling back to the home directory. The filename is time-stamped so
    // repeated exports never silently overwrite each other.
    proto._statsExportPath = function() {
        let dir = null;
        try { dir = GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_DOCUMENTS); } catch (e) { dir = null; }
        if (!dir) { dir = GLib.get_home_dir(); }
        let now = GLib.DateTime.new_now_local();
        let stamp = now ? now.format("%Y%m%d-%H%M%S") : "export";
        return GLib.build_filenamev([dir, "zen-pomodoro-stats-" + stamp + ".csv"]);
    };

    // Pure, machine-readable CSV of the full daily history (header + rows only,
    // so it opens cleanly in any spreadsheet / parser). The human-readable
    // summary lives in the clipboard "Copy" action instead, to keep this a valid
    // CSV. Column headers stay in English for consistent parsing across locales.
    proto._statsExportCsv = function() {
        let h = (this._dailyStatsData && this._dailyStatsData.history) ? this._dailyStatsData.history : {};
        let dates = Object.keys(h).filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k)).sort();
        let lines = ["date,pomodoros,minutes,interruptions"];
        for (let d of dates) {
            let c = h[d] || {};
            lines.push([d, (c.c || 0), (c.m || 0), (c.i || 0)].join(","));
        }
        return lines.join("\n") + "\n";
    };

    // Export the full history as a CSV file under Documents (or home). The exact
    // destination is shown in the dialog (status line) and reachable via the
    // "Open folder" button — no pop-up notification, to keep things calm.
    // onSaved(path) runs on success.
    proto._dashExportStats = function(onSaved) {
        let path = this._statsExportPath();
        this._writeTextAsync(path, this._statsExportCsv(), (ok) => {
            if (ok) {
                this._dashFlashStatus(_("Saved \u2713 \u2014 %s").format(GLib.path_get_basename(path)));
                if (typeof onSaved === 'function') { onSaved(path); }
            } else {
                this._dashFlashStatus(_("Could not save statistics export."));
            }
        });
    };

    // Reveal an exported file in the file manager: open its folder with the file
    // selected, via the freedesktop FileManager1 D-Bus API (supported by Nemo and
    // others). Falls back to just opening the containing folder if unavailable.
    proto._revealInFileManager = function(path) {
        try {
            let uri = Gio.File.new_for_path(path).get_uri();
            Gio.DBus.session.call(
                'org.freedesktop.FileManager1', '/org/freedesktop/FileManager1',
                'org.freedesktop.FileManager1', 'ShowItems',
                new GLib.Variant('(ass)', [[uri], '']),
                null, Gio.DBusCallFlags.NONE, -1, null,
                (conn, res) => {
                    try { conn.call_finish(res); }
                    catch (e) { this._openFolder(path); }
                }
            );
        } catch (e) {
            this._openFolder(path);
        }
    };

    // Open the folder that contains the given file in the default file manager.
    proto._openFolder = function(path) {
        try {
            let uri = Gio.File.new_for_path(GLib.path_get_dirname(path)).get_uri();
            Gio.AppInfo.launch_default_for_uri(uri, null);
        } catch (e) {
            this._dashFlashStatus(_("Could not open the folder."));
        }
    };

    // Apply the user's "Menu font scale" to a modal dialog's content, so the
    // readable surfaces (dashboard, onboarding, dialogs) honour the same scale
    // as the dropdown menu. font-size cascades to the added children.
    proto._scaleDialog = function(dialog) {
        let scale = this._opt_menuFontScale || 100;
        if (dialog && dialog.contentLayout && typeof dialog.contentLayout.set_style === "function") {
            dialog.contentLayout.set_style("font-size: " + scale + "%;");
        }
    };

    // Wrap a reused dialog's open() so it re-applies the current font scale every
    // time it shows. Used for the class dialogs created once at startup, since
    // their content persists between opens.
    proto._scaleDialogOnOpen = function(dialog) {
        if (!dialog || dialog.__scaleOnOpen || typeof dialog.open !== "function") { return; }
        dialog.__scaleOnOpen = true;
        let orig = dialog.open;
        let self = this;
        dialog.open = function() {
            try { self._scaleDialog(dialog); } catch (e) {}
            return orig.apply(this, arguments);
        };
    };

    proto._showStatsDashboard = function() {
        let st = this._computeStats();
        let accent = [0.93, 0.42, 0.31];
        let green = [0.36, 0.78, 0.55];
        this._dashAccent = accent;

        let h = (this._dailyStatsData && this._dailyStatsData.history) ? this._dailyStatsData.history : {};
        let cellOf = (d) => h[d] || { c: 0, m: 0 };
        let bars = [];
        for (let i = 13; i >= 0; i--) {
            let bd = this._dateDaysAgo(i);
            let cell = cellOf(this._todayStr(bd));
            bars.push({ min: cell.m, count: cell.c, today: (i === 0), dateLabel: this._dashDateLabel(bd) });
        }
        this._dashBars = bars;
        // Daily goal is configured in pomodoros, but the 14-day bars are scaled
        // by minutes — convert via the configured focus length for the goal line.
        this._dashGoalMin = (this._opt_dailyGoal > 0) ? this._opt_dailyGoal * (this._opt_pomodoroTimeMinutes || 25) : 0;
        let hmMeta = [];
        let now0 = new Date(); now0.setHours(0, 0, 0, 0);
        let dow0 = now0.getDay();
        let dowShort = [_("Sun"), _("Mon"), _("Tue"), _("Wed"), _("Thu"), _("Fri"), _("Sat")];
        for (let col = 0; col < 12; col++) {
            for (let row = 0; row < 7; row++) {
                let daysBack = (11 - col) * 7 + (dow0 - row);
                let m = { value: 0, future: daysBack < 0, label: "" };
                if (daysBack >= 0) {
                    let dd = this._dateDaysAgo(daysBack);
                    let ds = this._todayStr(dd);
                    m.value = (h[ds] && h[ds].c) || 0;
                    m.label = dowShort[dd.getDay()] + " " + this._dashDateLabel(dd);
                }
                hmMeta[col * 7 + row] = m;
            }
        }
        this._dashHeatmapMeta = hmMeta;
        this._dashHeatmap = hmMeta.map((m) => m.value);
        this._dashHours = st.hours || new Array(24).fill(0);
        let peak = this._peakFocusHour(st.hours);
        this._dashPeakHour = peak ? peak.hour : null;

        let dialog = new ModalDialog.ModalDialog({ destroyOnClose: true });
        this._scaleDialog(dialog);
        let root = new St.BoxLayout({ vertical: true, style: 'spacing: 9px; width: 680px; padding: 8px 16px;' });

        // Floating hover tooltip shared by all charts (sits above the dialog).
        let dashTip = new St.Label({ visible: false, style: 'background-color: rgba(20,20,20,0.96); color: #fff; padding: 4px 9px; border-radius: 6px; font-size: 0.86em;' });
        Main.uiGroup.add_child(dashTip);
        let wireHover = (area, infoFn) => {
            area.reactive = true;
            area.connect('motion-event', (a, ev) => {
                let [ex, ey] = ev.get_coords();
                let [ax, ay] = a.get_transformed_position();
                let text = infoFn(ex - ax, ey - ay, a.width, a.height);
                if (text) {
                    dashTip.set_text(text);
                    dashTip.show();
                    let pref = dashTip.get_preferred_size();
                    let mon = Main.layoutManager.focusMonitor || Main.layoutManager.primaryMonitor;
                    let [px, py] = this._dashClampTip(ex, ey, pref[1] || 0, pref[3] || 0, mon);
                    dashTip.set_position(px, py);
                } else {
                    dashTip.hide();
                }
                return false;
            });
            area.connect('leave-event', () => { dashTip.hide(); return false; });
        };

        root.add(new St.Label({ text: _("Focus statistics"), style: 'font-size: 1.4em; font-weight: bold;' }));

        let insight = new St.Label({ text: this._statsInsight(st), style: 'font-size: 1.05em; padding: 8px 12px; border-radius: 8px; background-color: rgba(227,90,60,0.16);' });
        insight.clutter_text.line_wrap = true;
        root.add(insight);

        // Today / week cards (full width).
        let cards = new St.BoxLayout({ vertical: false, style: 'spacing: 10px;' });
        let trend = "";
        if ((st.lastWeek || 0) > 0) {
            let p = Math.round(((st.week || 0) - st.lastWeek) / st.lastWeek * 100);
            trend = (p > 0 ? "\u25b2 " : (p < 0 ? "\u25bc " : "")) + Math.abs(p) + "%";
        }
        let goal = this._opt_dailyGoal || 0;
        let todaySub = (goal > 0) ? _("%d / %d goal").format(st.today || 0, goal) : this._dashFmtMin(st.todayMin || 0);
        cards.add(this._dashStatCard(_("Today"), (st.today || 0) + " \ud83c\udf45", todaySub, accent));
        cards.add(this._dashStatCard(_("Last 7 days"), (st.week || 0) + " \ud83c\udf45", this._dashFmtMin(st.weekMin || 0) + (trend ? ("   " + trend) : ""), accent));
        cards.add(this._dashStatCard(_("Streak"), (st.streak || 0) + " \ud83d\udd25", _("best %d").format(st.longestStreak || 0), green));
        cards.add(this._dashStatCard(_("All time"), (st.total || 0) + " \ud83c\udf45", this._dashFmtMin(st.totalMinutes || 0), accent));
        root.add(cards);

        if ((st.total || 0) > 0) {
            let dowSum = [0, 0, 0, 0, 0, 0, 0];
            for (let k in h) { dowSum[new Date(k + "T00:00:00").getDay()] += (h[k].c || 0); }
            let bestDow = 0;
            for (let i = 1; i < 7; i++) { if (dowSum[i] > dowSum[bestDow]) { bestDow = i; } }
            let dowNames = [_("Sun"), _("Mon"), _("Tue"), _("Wed"), _("Thu"), _("Fri"), _("Sat")];
            let review = new St.Label({ text: _("Last 7 days: %d \ud83c\udf45 \u00b7 %s \u00b7 best weekday %s").format(st.week || 0, this._dashFmtMin(st.weekMin || 0), dowNames[bestDow]) });
            review.clutter_text.line_wrap = true;
            root.add(review);

            let monthReview = new St.Label({ text: _("Last 30 days: %d \ud83c\udf45 \u00b7 %s \u00b7 best day ever %d \ud83c\udf45").format(st.month || 0, this._dashFmtMin(st.monthMin || 0), st.bestDay || 0) });
            monthReview.clutter_text.line_wrap = true;
            root.add(monthReview);
        }

        let harvestN = Math.min(st.today || 0, 20);
        let harvestStr = harvestN > 0 ? "\ud83c\udf45".repeat(harvestN) : _("Nothing harvested yet today");
        if ((st.today || 0) > 20) { harvestStr += "  +" + ((st.today || 0) - 20); }
        let harvestLabel = new St.Label({ text: _("Today's harvest") + ":  " + harvestStr });
        harvestLabel.clutter_text.line_wrap = true;
        root.add(harvestLabel);

        let estF = this._estimateFinish();
        let infoParts = [];
        if (estF) { infoParts.push(_("\u2248 finish %s \u00b7 %d \ud83c\udf45 left").format(estF.time, estF.remaining)); }
        infoParts.push(_("Interruptions: %d today \u00b7 %d this week").format(st.interruptionsToday || 0, st.interruptionsWeek || 0));
        let infoLabel = new St.Label({ text: infoParts.join("      ") });
        infoLabel.clutter_text.line_wrap = true;
        root.add(infoLabel);

        // The hourly histogram reads best full-width across the dialog.
        root.add(new St.Label({ text: _("When you focus (by hour)"), style: 'font-weight: bold; padding-top: 2px;' }));
        let hoursArea = new St.DrawingArea({ x_expand: true, style: 'height: 70px;' });
        hoursArea.connect('repaint', (a) => this._paintHours(a));
        wireHover(hoursArea, (x, y, w, hh) => {
            let i = Math.floor(x / (w / 24));
            if (i < 0 || i > 23) { return null; }
            return ((i < 10 ? "0" : "") + i) + ":00 · " + (this._dashHours[i] || 0) + " \ud83c\udf45";
        });
        this._dashSetA11y(hoursArea, peak
            ? _("Focus by hour; most focused around %s").format(peak.label)
            : _("Focus by hour; not enough data yet"));
        root.add(hoursArea);
        let axis = new St.BoxLayout({ vertical: false });
        [_("night"), _("morning"), _("afternoon"), _("evening")].forEach((t) => {
            axis.add(new St.Label({ text: t, x_expand: true, style: 'font-size: 0.7em; opacity: 0.65;' }));
        });
        root.add(axis);
        root.add(new St.Label({
            text: peak ? _("Most focused around %s — good time for deep work.").format(peak.label)
                       : _("Not enough data yet to spot your best focus time."),
            style: 'font-size: 0.85em;'
        }));

        // Two balanced charts side by side keep the dialog compact.
        let cols = new St.BoxLayout({ vertical: false, style: 'spacing: 18px; padding-top: 8px;' });
        let colA = new St.BoxLayout({ vertical: true, x_expand: true, style: 'spacing: 5px;' });
        let colB = new St.BoxLayout({ vertical: true, x_expand: true, style: 'spacing: 5px;' });

        colA.add(new St.Label({ text: _("Focus time \u2014 last 14 days"), style: 'font-weight: bold;' }));
        if (this._dashGoalMin > 0) {
            colA.add(new St.Label({ text: _("\u2504\u2504 daily goal (%d \ud83c\udf45)").format(this._opt_dailyGoal || 0), style: 'font-size: 0.72em; opacity: 0.7;' }));
        }
        let barArea = new St.DrawingArea({ x_expand: true, style: 'height: 92px;' });
        barArea.connect('repaint', (a) => this._paintDashBars(a));
        wireHover(barArea, (x, y, w, hh) => {
            let i = Math.floor(x / (w / 14));
            let b = (this._dashBars || [])[i];
            if (!b) { return null; }
            return b.dateLabel + " · " + (b.count || 0) + " \ud83c\udf45 · " + this._dashFmtMin(b.min || 0);
        });
        colA.add(barArea);
        let barAxis = new St.BoxLayout({ vertical: false });
        barAxis.add(new St.Label({ text: bars[0].dateLabel, style: 'font-size: 0.7em; opacity: 0.6;' }));
        barAxis.add(new St.Label({ text: bars[6].dateLabel, x_expand: true, x_align: Clutter.ActorAlign.CENTER, style: 'font-size: 0.7em; opacity: 0.6;' }));
        barAxis.add(new St.Label({ text: bars[13].dateLabel, style: 'font-size: 0.7em; opacity: 0.6;' }));
        colA.add(barAxis);
        let bars14Total = bars.reduce((s, b) => s + (b.count || 0), 0);
        let bestBar = bars.reduce((bestB, b) => ((b.count || 0) > (bestB.count || 0) ? b : bestB), { count: 0, dateLabel: "" });
        let barsSummary = (bars14Total > 0)
            ? _("Last 14 days: %d \ud83c\udf45 \u00b7 best %s (%d \ud83c\udf45)").format(bars14Total, bestBar.dateLabel, bestBar.count || 0)
            : _("Last 14 days: no focus yet");
        this._dashSetA11y(barArea, barsSummary);

        colB.add(new St.Label({ text: _("Activity \u2014 last 12 weeks"), style: 'font-weight: bold;' }));
        let heatArea = new St.DrawingArea({ x_expand: true, style: 'height: 74px;' });
        heatArea.connect('repaint', (a) => this._paintDashHeatmap(a));
        wireHover(heatArea, (x, y, w, hh) => {
            let col = Math.floor(x / (w / 12)), row = Math.floor(y / (hh / 7));
            if (col < 0 || col > 11 || row < 0 || row > 6) { return null; }
            let m = (this._dashHeatmapMeta || [])[col * 7 + row];
            if (!m || m.future || !m.label) { return null; }
            return m.label + " · " + (m.value || 0) + " \ud83c\udf45";
        });
        let dayCol = new St.BoxLayout({ vertical: true, style: 'width: 26px;' });
        for (let drow = 0; drow < 7; drow++) {
            let dtxt = (drow === 1 || drow === 3 || drow === 5) ? dowShort[drow] : "";
            dayCol.add(new St.Label({ text: dtxt, y_expand: true, style: 'font-size: 0.62em; opacity: 0.6;' }));
        }
        let heatRow = new St.BoxLayout({ vertical: false });
        heatRow.add(dayCol);
        heatRow.add(heatArea);
        colB.add(heatRow);
        let legend = new St.BoxLayout({ vertical: false, style: 'spacing: 6px;' });
        legend.add(new St.Label({ text: _("Less"), style: 'font-size: 0.8em;' }));
        let legendCells = new St.DrawingArea({ style: 'width: 80px; height: 13px;' });
        legendCells.connect('repaint', (a) => this._paintDashLegend(a));
        legend.add(legendCells);
        legend.add(new St.Label({ text: _("More"), style: 'font-size: 0.8em;' }));
        colB.add(legend);
        let hmMetaArr = this._dashHeatmapMeta || [];
        let activeDays = hmMetaArr.filter((m) => m && !m.future && (m.value || 0) > 0).length;
        let busiest = hmMetaArr.reduce((bestM, m) => ((m && !m.future && (m.value || 0) > (bestM.value || 0)) ? m : bestM), { value: 0, label: "" });
        let heatSummary = (activeDays > 0)
            ? _("Last 12 weeks: %d active days \u00b7 busiest %s (%d \ud83c\udf45)").format(activeDays, busiest.label, busiest.value || 0)
            : _("Last 12 weeks: no focus yet");
        this._dashSetA11y(heatArea, heatSummary);

        cols.add(colA);
        cols.add(colB);
        root.add(cols);

        // By task spans the full width so an empty list never leaves a side gap.
        let tasksByDone = this._taskList().slice()
            .sort((a, b) => (b.done || 0) - (a.done || 0))
            .filter((t) => (t.done || 0) > 0)
            .slice(0, 5);
        if (tasksByDone.length) {
            root.add(new St.Label({ text: _("By task"), style: 'font-weight: bold; padding-top: 10px;' }));
            let maxDone = tasksByDone[0].done || 1;
            for (let t of tasksByDone) {
                let frac = (t.done || 0) / maxDone;
                let title = (t.title.length > 28) ? (t.title.slice(0, 27) + "\u2026") : t.title;
                let rowB = new St.BoxLayout({ vertical: false, style: 'spacing: 8px;' });
                rowB.add(new St.Label({ text: title, style: 'width: 240px;' }));
                let mb = new St.DrawingArea({ x_expand: true, style: 'height: 13px;' });
                mb.connect('repaint', (a) => this._paintMiniBar(a, frac));
                let tTitle = t.title, tDone = (t.done || 0);
                wireHover(mb, () => tTitle + " · " + tDone + " \ud83c\udf45");
                this._dashSetA11y(mb, _("%s: %d \ud83c\udf45").format(tTitle, tDone));
                rowB.add(mb);
                rowB.add(new St.Label({ text: (t.done || 0) + " \ud83c\udf45", style: 'width: 48px;' }));
                root.add(rowB);
            }
        }

        let tot = this._dashMilestoneTier(st.total || 0, [10, 25, 50, 100, 250, 500, 1000, 2000]);
        let stk = this._dashMilestoneTier(st.longestStreak || 0, [3, 7, 14, 30, 60, 100, 365]);
        let badges = [];
        if (tot > 0) { badges.push("\ud83c\udfc6 " + tot); }
        if (stk > 0) { badges.push("\ud83d\udd25 " + stk); }
        if (badges.length) {
            root.add(new St.Label({ text: _("Milestones: %s").format(badges.join("    ")), style: 'padding-top: 4px;' }));
        }

        let dashStatus = new St.Label({ visible: false, style: 'font-size: 0.82em; opacity: 0.85; padding-top: 6px;' });
        dashStatus.clutter_text.line_wrap = true;
        this._dashStatusLabel = dashStatus;
        root.add(dashStatus);

        dialog.contentLayout.add(root);
        let setDashButtons, confirmReset, lastExportPath = null;
        confirmReset = () => {
            dialog.setButtons([
                { label: _("Cancel"), action: () => setDashButtons() },
                { label: _("Delete all statistics"), action: () => { this._resetStatistics(); dialog.close(); } }
            ]);
        };
        setDashButtons = () => {
            let buttons = [
                { label: _("Export\u2026"), action: () => this._dashExportStats((p) => { lastExportPath = p; setDashButtons(); }) }
            ];
            if (lastExportPath) {
                buttons.push({ label: _("Open folder"), action: () => this._revealInFileManager(lastExportPath) });
            }
            buttons.push({ label: _("Reset statistics\u2026"), action: () => confirmReset() });
            buttons.push({ label: _("Close"), key: Clutter.KEY_Escape, default: true, action: () => dialog.close() });
            dialog.setButtons(buttons);
        };
        setDashButtons();
        dialog.connect('closed', () => { this._dashStatusLabel = null; try { dashTip.destroy(); } catch (e) {} });
        dialog.open();
        return dialog;
    };

    proto._clearIdleWatches = function() {
        if (this._idleMonitor) {
            if (this._idleWatchId) {
                try { this._idleMonitor.remove_watch(this._idleWatchId); } catch (e) {}
            }
            if (this._activeWatchId) {
                try { this._idleMonitor.remove_watch(this._activeWatchId); } catch (e) {}
            }
        }
        this._idleWatchId = 0;
        this._activeWatchId = 0;
    };

    proto._initIdleMonitor = function() {
        if (this._idleMonitor) {
            return;
        }
        try {
            if (typeof global !== 'undefined' && global.core_idle_monitor) {
                this._idleMonitor = global.core_idle_monitor;
            } else if (imports.gi.Cinnamon && imports.gi.Cinnamon.IdleMonitor) {
                this._idleMonitor = imports.gi.Cinnamon.IdleMonitor.get_core();
            } else if (imports.gi.Meta && imports.gi.Meta.IdleMonitor) {
                this._idleMonitor = imports.gi.Meta.IdleMonitor.get_core();
            }
        } catch (e) {
            this._idleMonitor = null;
        }
    };

    proto._updateIdleWatch = function() {
        this._clearIdleWatches();

        if (!this._opt_autoPauseIdle || this._currentState !== 'pomodoro') {
            return;
        }

        this._initIdleMonitor();
        if (!this._idleMonitor) {
            return;
        }

        let minutes = this._opt_autoPauseIdleMinutes || 5;
        this._idleWatchId = this._idleMonitor.add_idle_watch(minutes * 60 * 1000, () => {
            try {
                if (this._currentState !== 'pomodoro') {
                    return;
                }
                this._pauseTimerFromMenu();
                if (this._opt_autoResumeOnActivity && this._idleMonitor) {
                    this._activeWatchId = this._idleMonitor.add_user_active_watch(() => {
                        try {
                            this._activeWatchId = 0;
                            if (this._isPausedState()) {
                                this._startTimerFromMenu();
                            }
                        } catch (e) {}
                    });
                }
            } catch (e) {}
        });
    };

    // --- Flow Soft Landing: activity probe + watch/cap arming ------------
    //
    // These are deliberately separate from the auto-pause idle watch above
    // (_updateIdleWatch / _clearIdleWatches). They are NOT cleared by
    // _clearIdleWatches, because that runs on every _setCurrentState and would
    // otherwise cancel an armed soft landing the moment we enter the overrun
    // state. Disarm happens from the explicit transition/cancel paths and on
    // teardown instead.

    // Current user idle time in ms. 0 (treated as "active" by the decision) if
    // the idle monitor is unavailable, so a missing monitor never silently
    // holds a finished pomodoro forever.
    proto._flowProbeIdleMs = function() {
        this._initIdleMonitor();
        if (this._idleMonitor) {
            try { return this._idleMonitor.get_idletime(); } catch (e) {}
        }
        return 0;
    };

    // Arm the soft-landing watches: a one-shot pause-watch that fires once the
    // user has been idle for the natural-pause threshold, and a hard cap
    // timeout measured cumulatively from _flowGraceStartMs. Both callbacks fire
    // at most once. Idempotent: any previously armed watches are disarmed first.
    proto._armSoftLanding = function(onPause, onCap) {
        this._disarmSoftLanding();

        let capMs = FlowModule.flowGraceCapMs(10);
        let remainingMs = capMs;
        if (typeof this._flowGraceStartMs === 'number') {
            remainingMs = Math.max(0, capMs - (Date.now() - this._flowGraceStartMs));
        }
        this._flowCapTimeoutId = Mainloop.timeout_add(Math.max(1, Math.round(remainingMs)), () => {
            this._flowCapTimeoutId = 0;
            if (typeof onCap === 'function') {
                try { onCap(); } catch (e) { global.logError('zen-pomodoro flow cap: ' + e); }
            }
            return false; // one-shot
        });

        this._initIdleMonitor();
        if (this._idleMonitor) {
            let thresholdMs = FlowModule.flowPauseThresholdMs(20);
            this._flowPauseWatchId = this._idleMonitor.add_idle_watch(thresholdMs, () => {
                if (typeof onPause === 'function') {
                    try { onPause(); } catch (e) { global.logError('zen-pomodoro flow pause: ' + e); }
                }
            });
        }
    };

    // Tear down any armed soft-landing watches/timeouts. Safe to call any
    // number of times (e.g. from cancel paths and from teardown).
    proto._disarmSoftLanding = function() {
        if (this._flowCapTimeoutId) {
            try { Mainloop.source_remove(this._flowCapTimeoutId); } catch (e) {}
            this._flowCapTimeoutId = 0;
        }
        if (this._flowPauseWatchId) {
            if (this._idleMonitor) {
                try { this._idleMonitor.remove_watch(this._flowPauseWatchId); } catch (e) {}
            }
            this._flowPauseWatchId = 0;
        }
    };

    // --- Flow Soft Landing: orchestration at the pomodoro -> break boundary --

    // Called from the timer-queue handler when a focus pomodoro has just ended
    // and a short break is pending. Returns true if soft landing has taken over
    // (the caller must NOT open the break prompt); false to proceed as classic.
    proto._maybeSoftLanding = function() {
        if (!this._opt_flowSoftLanding) {
            return false;
        }
        // Start the grace clock on the first boundary and keep it across
        // extensions, so the cap is measured cumulatively.
        if (typeof this._flowGraceStartMs !== 'number') {
            this._flowGraceStartMs = Date.now();
        }
        return this._evaluateSoftLanding();
    };

    proto._evaluateSoftLanding = function() {
        let graceElapsedMs = (typeof this._flowGraceStartMs === 'number')
            ? (Date.now() - this._flowGraceStartMs) : 0;
        let decision = FlowModule.flowLandingDecision({
            enabled: this._opt_flowSoftLanding,
            behavior: this._opt_flowSoftLandingBehavior || 'wait',
            idleMs: this._flowProbeIdleMs(),
            pauseThresholdMs: FlowModule.flowPauseThresholdMs(20),
            graceElapsedMs: graceElapsedMs,
            graceCapMs: FlowModule.flowGraceCapMs(10)
        });

        // Fallback: If we can't monitor idle time, "wait" mode will hang indefinitely.
        if (decision === 'wait' && !this._idleMonitor) {
            decision = 'break-now';
        }

        if (decision === 'break-now') {
            this._flowGraceStartMs = null;
            this._disarmSoftLanding();
            return false; // caller opens the break prompt as usual
        }

        let onPause = () => this._concludeSoftLanding();
        let onCap = () => this._concludeSoftLanding();

        if (decision === 'extend') {
            // Quietly add focus time and keep counting down (reuses the proven
            // "extend focus" path). Re-arm so a mid-block pause or the cap still
            // lands us in a break.
            this._extendFocusFromDialog();
            this._armSoftLanding(onPause, onCap);
            return true;
        }

        // 'wait': hold quietly in the overrun state until a pause or the cap.
        this._setCurrentState('pomodoro-overrun');
        this._setTimerLabel(0);
        this._armSoftLanding(onPause, onCap);
        return true;
    };

    // A natural pause or the cap ended the soft landing: stop any still-running
    // focus block, position the queue at the pending short break, and open the
    // normal end-of-pomodoro break prompt.
    proto._concludeSoftLanding = function() {
        this._disarmSoftLanding();
        // Phase 2 hook: the soft-landing duration is (Date.now() -
        // this._flowGraceStartMs) here — the place to record flow-session stats
        // (longest unbroken focus, number of flow sessions). v1 records nothing.
        this._flowGraceStartMs = null;

        if (this._timerQueue && this._timerQueue.isRunning()) {
            // extend mode: a focus block is still counting down. Stop it and
            // step the queue to the short break that follows this pomodoro.
            this._timerQueue.stop();
            if (typeof this._timerQueue.getPosition === 'function' &&
                typeof this._timerQueue.setPosition === 'function') {
                this._timerQueue.setPosition(this._timerQueue.getPosition() + 1);
            }
        }
        this._timerQueue.preventStart(true);
        this._appletMenu.toggleTimerState(false);
        this._setAppletTooltip(0);
        this._openPomodoroFinishedPrompt();
    };

    // Open the end-of-pomodoro break prompt. Extracted from the queue handler so
    // soft landing can defer it; mirrors the classic behaviour exactly.
    proto._openPomodoroFinishedPrompt = function() {
        if (this._currentState !== 'focus-over') {
            this._setFocusOverState();
        }
        if (this._opt_showDialogMessages) {
            this._playStartSound();
            this._pomodoroFinishedDialog.setExtend(this._opt_flowExtend ? (this._opt_flowExtendMinutes || 5) : 0);
            this._pomodoroFinishedDialog.setTip(this._restTip(false));
            this._pomodoroFinishedDialog.open();
        } else if (!this._opt_autoStartBreak) {
            // Dialogs are off and the next phase won't auto-start: without a
            // cue here the panel would just sit at 00:00 indistinguishable from
            // idle, with no hint that a break is waiting on a manual start.
            this._playBreakSound();
            this._playCompletionFlourish(_("Focus finished"));
            Main.notify(_("Focus finished"), _("Break ready — open the menu to start it."));
        }
    };

    // Abort an in-progress soft landing (manual start / pause / skip / reset /
    // turn off). Safe to call when no soft landing is active.
    proto._cancelSoftLanding = function() {
        let wasArmed = (this._flowPauseWatchId || this._flowCapTimeoutId ||
            this._currentState === 'pomodoro-overrun');
        this._disarmSoftLanding();
        this._flowGraceStartMs = null;
        if (this._currentState === 'pomodoro-overrun') {
            this._setCurrentState('pomodoro-stop');
        }
        return !!wasArmed;
    };

    // Ambient is on when a sound (not "off") is chosen.
    proto._ambientEnabled = function() {
        let c = this._opt_focusAmbientChoice;
        return !!c && c !== 'off';
    };

    // Chosen sound changed: remember a real choice (for the menu toggle), then
    // switch or stop the loop live.
    proto._onAmbientChoiceChanged = function() {
        if (this._ambientEnabled()) { this._ambientLastChoice = this._opt_focusAmbientChoice; }
        // A different sound was picked — stop any running preview of the old one.
        this._stopAmbientPreview();
        this._updateAmbientSound();
        if (typeof this._updateMenuRuntime === 'function') { this._updateMenuRuntime(); }
    };

    proto._updateAmbientSound = function() {
        if (this._ambientEnabled() && (this._currentState === 'pomodoro' || this._currentState === 'pomodoro-overrun')) {
            this._startAmbientSound();
        } else {
            this._stopAmbientSound();
        }
    };

    // Resolve the ambient sound path from the chosen built-in noise, or the
    // user's own file when "Custom file" is selected.
    proto._ambientPath = function() {
        let map = { white: 'white.ogg', pink: 'pink.ogg', brown: 'brown.ogg', rain: 'rain.ogg', sea: 'sea.ogg', fan: 'fan.ogg', wind: 'wind.ogg', stream: 'stream.ogg', street: 'street.ogg' };
        let choice = this._opt_focusAmbientChoice || 'off';
        let f;
        if (choice === 'custom') {
            f = (this._opt_focusAmbientFile || "").trim() || 'brown.ogg';
        } else {
            f = map[choice] || 'brown.ogg';
        }
        return SoundModule.addPathIfRelative(f, this._defaultSoundPath);
    };

    proto._ensureAmbientSound = function() {
        let path = this._ambientPath();
        if (!this._ambientSound || this._ambientSoundPath !== path) {
            if (this._ambientSound) { this._ambientSound.stop(); }
            // Gapless looping background player (GStreamer), so the loop has no
            // restart gap; falls back to a looping SoundEffect without GStreamer.
            this._ambientSound = new SoundModule.AmbientLoop(path);
            this._ambientSoundPath = path;
        }
        return this._ambientSound;
    };

    proto._startAmbientSound = function() {
        if (!SoundModule || typeof SoundModule.isPlayable !== 'function' || !SoundModule.isPlayable()) {
            return;
        }
        let snd = this._ensureAmbientSound();
        if (snd.isPlaying()) {
            return;
        }
        let vol = Math.max(0, Math.min(1, (this._opt_focusAmbientVolume || 40) / 100));
        snd.play({ loop: true, volume: vol });
    };

    proto._stopAmbientSound = function() {
        if (this._ambientVolTimeout) {
            Mainloop.source_remove(this._ambientVolTimeout);
            this._ambientVolTimeout = 0;
        }
        if (this._ambientSound) {
            this._ambientSound.stop();
        }
    };

    // Short preview of the chosen ambient sound from settings. Uses a separate
    // player (preview auto-stops after a couple of seconds) so it never disturbs
    // a loop that may be running during focus.
    proto._previewAmbientSound = function() {
        if (!SoundModule || typeof SoundModule.isPlayable !== 'function' || !SoundModule.isPlayable()) {
            Main.notify(_("No sound backend available for preview."));
            return;
        }
        if (!this._ambientEnabled()) {
            Main.notify(_("Choose an ambient sound first (it's set to Off)."));
            return;
        }
        this._stopAmbientPreview();
        this._ambientPreview = new SoundModule.AmbientLoop(this._ambientPath());
        this._ambientPreview.play({ loop: true, volume: this._ambientPreviewVolume() });
        // Safety net: never let a forgotten preview loop forever (e.g. the
        // settings window was closed without pressing Stop).
        this._ambientPreviewTimeout = Mainloop.timeout_add(45000, () => {
            this._ambientPreviewTimeout = 0;
            this._stopAmbientPreview();
            return false;
        });
    };

    proto._ambientPreviewVolume = function() {
        return Math.max(0, Math.min(1, (this._opt_focusAmbientVolume || 40) / 100));
    };

    // Stop the looping settings preview and cancel its safety timer.
    proto._stopAmbientPreview = function() {
        if (this._ambientPreviewTimeout) { try { Mainloop.source_remove(this._ambientPreviewTimeout); } catch (e) {} this._ambientPreviewTimeout = 0; }
        if (this._ambientPreview) { try { this._ambientPreview.stop(); } catch (e) {} this._ambientPreview = null; }
    };

    // Live volume: replay the ambient loop at the new level while focusing.
    // Debounced so dragging the slider doesn't stutter the audio.
    // Live update while focusing: apply a new volume or a newly chosen sound by
    // replaying the loop. Debounced so dragging the slider doesn't stutter.
    proto._restartAmbientLive = function() {
        if (this._ambientVolTimeout) {
            Mainloop.source_remove(this._ambientVolTimeout);
        }
        this._ambientVolTimeout = Mainloop.timeout_add(220, () => {
            this._ambientVolTimeout = 0;
            try {
                // Live volume for the looping settings preview while you listen.
                if (this._ambientPreview) {
                    this._ambientPreview.play({ loop: true, volume: this._ambientPreviewVolume() });
                }
                if (this._ambientEnabled() && this._currentState === 'pomodoro' &&
                    this._ambientSound && this._ambientSound.isPlaying()) {
                    let snd = this._ensureAmbientSound();
                    let vol = Math.max(0, Math.min(1, (this._opt_focusAmbientVolume || 40) / 100));
                    snd.play({ loop: true, volume: vol });
                }
            } catch (e) {}
            return false;
        });
    };

    // Do Not Disturb: mute Cinnamon notifications while focusing, restoring the
    // previous value afterwards. Uses the native gsettings schema; opt-in.
    proto._getNotificationSettings = function() {
        if (this._notificationSettings !== null) {
            return this._notificationSettings;
        }
        this._notificationSettings = false; // sentinel: tried, unavailable
        try {
            let src = Gio.SettingsSchemaSource.get_default();
            if (src && src.lookup('org.cinnamon.desktop.notifications', true)) {
                this._notificationSettings = new Gio.Settings({ schema_id: 'org.cinnamon.desktop.notifications' });
            }
        } catch (e) {
            this._notificationSettings = false;
        }
        return this._notificationSettings;
    };

    proto._updateDnd = function() {
        if (this._opt_focusDnd && (this._currentState === 'pomodoro' || this._currentState === 'pomodoro-overrun')) {
            this._enableDnd();
        } else {
            this._disableDnd();
        }
    };

    proto._enableDnd = function() {
        if (this._dndActive) {
            return;
        }
        let s = this._getNotificationSettings();
        if (!s) {
            return;
        }
        try {
            this._dndPrevValue = s.get_boolean('display-notifications');
            s.set_boolean('display-notifications', false);
            this._dndActive = true;
        } catch (e) {
            this._dndActive = false;
        }
    };

    proto._disableDnd = function() {
        if (!this._dndActive) {
            return;
        }
        this._dndActive = false;
        let s = this._getNotificationSettings();
        if (!s) {
            return;
        }
        try {
            s.set_boolean('display-notifications', this._dndPrevValue !== false);
        } catch (e) {
            // ignore
        }
    };

    // Pause external media players (browser tab, music app) during breaks and
    // pauses, then resume only the ones we paused when focus continues. Uses
    // the standard MPRIS D-Bus interface, so there is no external dependency.
    proto._mediaShouldBePaused = function() {
        if (!this._opt_pauseMedia) {
            return false;
        }
        let s = this._currentState;
        return (s === 'short-break' || s === 'long-break' ||
                s === 'pomodoro-paused' || s === 'short-break-paused' ||
                s === 'long-break-paused');
    };

    proto._updateMediaPause = function() {
        if (this._mediaShouldBePaused()) {
            this._pausePlayingMedia();
        } else {
            this._resumePausedMedia();
        }
    };

    proto._mprisPlayerCall = function(busName, method) {
        try {
            Gio.DBus.session.call(
                busName, '/org/mpris/MediaPlayer2',
                'org.mpris.MediaPlayer2.Player', method, null, null,
                Gio.DBusCallFlags.NONE, 1500, null,
                (conn, res) => { try { conn.call_finish(res); } catch (e) {} });
        } catch (e) {}
    };

    proto._pausePlayingMedia = function() {
        if (this._mediaPauseInFlight) {
            return;
        }
        this._mediaPauseInFlight = true;
        try {
            Gio.DBus.session.call(
                'org.freedesktop.DBus', '/org/freedesktop/DBus',
                'org.freedesktop.DBus', 'ListNames', null,
                GLib.VariantType.new('(as)'), Gio.DBusCallFlags.NONE, 1500, null,
                (conn, res) => {
                    this._mediaPauseInFlight = false;
                    let names;
                    try { names = conn.call_finish(res).get_child_value(0).deep_unpack(); }
                    catch (e) { return; }
                    for (let name of names) {
                        if (typeof name === 'string' && name.indexOf('org.mpris.MediaPlayer2.') === 0) {
                            this._pauseIfPlaying(name);
                        }
                    }
                });
        } catch (e) {
            this._mediaPauseInFlight = false;
        }
    };

    proto._pauseIfPlaying = function(busName) {
        try {
            Gio.DBus.session.call(
                busName, '/org/mpris/MediaPlayer2',
                'org.freedesktop.DBus.Properties', 'Get',
                GLib.Variant.new('(ss)', ['org.mpris.MediaPlayer2.Player', 'PlaybackStatus']),
                GLib.VariantType.new('(v)'), Gio.DBusCallFlags.NONE, 1500, null,
                (conn, res) => {
                    let status = '';
                    try { status = conn.call_finish(res).get_child_value(0).get_variant().get_string()[0]; }
                    catch (e) { return; }
                    // Re-check state: a short break may have ended before this returned.
                    if (status === 'Playing' && this._mediaShouldBePaused()) {
                        if (this._pausedMediaPlayers.indexOf(busName) === -1) {
                            this._pausedMediaPlayers.push(busName);
                        }
                        this._mprisPlayerCall(busName, 'Pause');
                    }
                });
        } catch (e) {}
    };

    proto._resumePausedMedia = function() {
        if (!this._pausedMediaPlayers || this._pausedMediaPlayers.length === 0) {
            return;
        }
        let players = this._pausedMediaPlayers.slice();
        this._pausedMediaPlayers = [];
        for (let name of players) {
            this._mprisPlayerCall(name, 'Play');
        }
    };

    // Run a user-configured command (argv, no shell) when focus or a break
    // starts. Opt-in and empty by default.
    proto._runEventCommand = function(which) {
        if (!this._opt_runCommandEnabled) {
            return;
        }
        let cmd;
        if (which === 'focus') { cmd = this._opt_focusStartCommand; }
        else if (which === 'goal') { cmd = this._opt_goalCommand; }
        else { cmd = this._opt_breakStartCommand; }
        if (!cmd || !cmd.trim()) {
            return;
        }
        cmd = cmd.trim();
        if (cmd.startsWith('file://')) {
            cmd = decodeURIComponent(cmd.substr(7));
        }
        let argv;
        if (GLib.file_test(cmd, GLib.FileTest.EXISTS)) {
            // A chosen script file — run it directly (handles spaces in the path).
            if (!GLib.file_test(cmd, GLib.FileTest.IS_EXECUTABLE)) {
                global.logError("Zen Pomodoro: chosen file is not executable: " + cmd);
                return;
            }
            // Pass context so one script can react: $1 = event, $2 = current task.
            argv = [cmd, which, this._currentFocusTask || ""];
        } else {
            // Fall back to treating the value as an inline command.
            try {
                let [ok, parsed] = GLib.shell_parse_argv(cmd);
                if (!ok || !parsed || parsed.length === 0) {
                    return;
                }
                argv = parsed;
            } catch (e) {
                global.logError("Zen Pomodoro: cannot parse command '" + cmd + "': " + e.message);
                return;
            }
        }
        try {
            let proc = Gio.Subprocess.new(argv,
                Gio.SubprocessFlags.STDOUT_SILENCE | Gio.SubprocessFlags.STDERR_SILENCE);
            proc.wait_async(null, (p, res) => {
                try {
                    p.wait_finish(res);
                } catch (e) {
                    // ignore
                }
            });
        } catch (e) {
            global.logError("Zen Pomodoro: failed to run command: " + e.message);
        }
    };

    // Optional, opt-in: when a break starts, warn briefly and then lock the
    // screen so you actually step away. Only on breaks (never focus); the lock
    // is cancelled if the break ends/pauses before the grace period elapses.
    proto._maybeLockForBreak = function() {
        this._cancelBreakLock();
        if (!this._opt_breakLockEnabled) {
            return;
        }
        let s = this._currentState;
        if (s !== 'short-break' && s !== 'long-break') {
            return;
        }
        if (this._opt_breakLockLongOnly && s !== 'long-break') {
            return;
        }
        let lockState = s;
        // A clearly cancellable warning, so the lock never feels like a trap.
        this._notifyWithActions(
            _("Break — locking the screen"),
            _("Locking in a few seconds so you can step away."),
            [{ id: 'zen-no-lock', label: _("Don't lock now"), fn: () => this._cancelBreakLock() }]
        );
        this._breakLockTimeoutId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 6, () => {
            this._breakLockTimeoutId = 0;
            // Lock only if still in the same break and nothing full-screen is
            // playing (a video/call/presentation) — don't interrupt that.
            if (this._currentState === lockState && !this._anyMonitorFullscreen()) {
                this._breakLockActive = true;
                this._armScreensaverWatch();
                this._lockScreen();
            }
            return GLib.SOURCE_REMOVE;
        });
    };

    proto._cancelBreakLock = function() {
        if (this._breakLockTimeoutId) {
            try { GLib.source_remove(this._breakLockTimeoutId); } catch (e) {}
            this._breakLockTimeoutId = 0;
        }
    };

    // Watch for the screen actually being unlocked — i.e. only after real
    // authentication has already succeeded — so we can offer a calm "welcome
    // back" cue. This never unlocks or bypasses anything; it purely reacts to
    // cinnamon-screensaver's own ActiveChanged(false) signal, which it emits
    // once the correct password has been entered. Safe to call repeatedly.
    proto._armScreensaverWatch = function() {
        if (this._screensaverSubId) {
            return;
        }
        try {
            this._screensaverSubId = Gio.DBus.session.signal_subscribe(
                'org.cinnamon.ScreenSaver',
                'org.cinnamon.ScreenSaver',
                'ActiveChanged',
                '/org/cinnamon/ScreenSaver',
                null,
                Gio.DBusSignalFlags.NONE,
                (connection, sender, path, iface, signal, params) => {
                    try {
                        let [isActive] = params.deep_unpack();
                        if (!isActive) {
                            this._onScreensaverDeactivated();
                        }
                    } catch (e) {
                        global.logError("Zen Pomodoro: screensaver signal handling failed: " + e.message);
                    }
                }
            );
        } catch (e) {
            // No cinnamon-screensaver on the bus (different locker, or it
            // isn't running) — the courtesy cue simply won't fire; nothing
            // else depends on this subscription existing.
            this._screensaverSubId = 0;
        }
    };

    proto._disarmScreensaverWatch = function() {
        if (this._screensaverSubId) {
            try { Gio.DBus.session.signal_unsubscribe(this._screensaverSubId); } catch (e) {}
            this._screensaverSubId = 0;
        }
        this._breakLockActive = false;
    };

    // Fires once real authentication has already happened (this signal only
    // exists because the screensaver just deactivated). Only acts if WE were
    // the ones who locked for a break — never for a lock/unlock the user
    // triggers on their own, unrelated to Zen Pomodoro.
    proto._onScreensaverDeactivated = function() {
        if (!this._breakLockActive) {
            return;
        }
        this._breakLockActive = false;
        Main.notify(_("Welcome back"), _("Break's over, whenever you're ready."));
    };

    proto._anyMonitorFullscreen = function() {
        try {
            let n = global.display.get_n_monitors();
            for (let i = 0; i < n; i++) {
                if (global.display.get_monitor_in_fullscreen(i)) { return true; }
            }
        } catch (e) {}
        return false;
    };

    proto._lockScreen = function() {
        // Try the Cinnamon locker first, then a generic logind fallback so the
        // option works beyond cinnamon-screensaver. Wait for each to actually
        // succeed (exit 0) before giving up — a locker that's installed but fails
        // (e.g. the screensaver isn't running) shouldn't silently skip the fallback.
        let tries = [
            ['cinnamon-screensaver-command', '--lock'],
            ['loginctl', 'lock-session']
        ];
        let tryNext = (i) => {
            if (i >= tries.length) {
                try { Main.notify(_("Couldn't lock the screen"), _("No screen locker was available.")); } catch (e) {}
                return;
            }
            let proc;
            try {
                proc = Gio.Subprocess.new(tries[i], Gio.SubprocessFlags.STDOUT_SILENCE | Gio.SubprocessFlags.STDERR_SILENCE);
            } catch (e) {
                global.logError("Zen Pomodoro: lock via " + tries[i][0] + " failed to start: " + e.message);
                tryNext(i + 1);
                return;
            }
            proc.wait_check_async(null, (p, res) => {
                let ok = false;
                try { ok = p.wait_check_finish(res); } catch (e) {
                    global.logError("Zen Pomodoro: lock via " + tries[i][0] + " did not succeed: " + e.message);
                }
                if (!ok) { tryNext(i + 1); }
            });
        };
        tryNext(0);
    };

    // Optional push notification (Pushover) on key events, opt-in. Uses the
    // user's own credentials and posts only to the official Pushover API.
    proto._sendPushover = function(message) {
        if (!this._opt_pushoverEnabled || !Soup) {
            return;
        }
        let user = (this._opt_pushoverUserKey || '').trim();
        let token = (this._opt_pushoverAppToken || '').trim();
        if (!user || !token) {
            return;
        }
        message = (message || '').trim();
        if (!message) {
            return;
        }
        let title = (this._opt_pushoverTitle || '').trim() || 'Zen Pomodoro';
        let task = (this._currentFocusTask && this._currentFocusTask.trim()) ? this._currentFocusTask.trim() : _("No task");
        let mins = "";
        let curTimer = this._timerQueue ? this._timerQueue.getCurrentTimer() : null;
        if (curTimer) {
            mins = String(Math.max(0, Math.ceil(curTimer.getTicksRemaining() / 60)));
        }
        // html=1 is set below, so HTML-escape the interpolated task name (a user
        // value) so stray markup can't break the rendered notification.
        let esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        message = message.replace(/\{task\}/g, esc(task)).replace(/\{minutes\}/g, mins);
        try {
            if (!this._pushoverSession) {
                this._pushoverSession = new Soup.Session();
            }
            let msg = Soup.Message.new('POST', 'https://api.pushover.net/1/messages.json');
            let body = 'token=' + encodeURIComponent(token) +
                '&user=' + encodeURIComponent(user) +
                '&title=' + encodeURIComponent(title) +
                '&message=' + encodeURIComponent(message) +
                '&html=1' +
                '&priority=' + encodeURIComponent(this._opt_pushoverPriority || '0') +
                '&sound=' + encodeURIComponent(this._opt_pushoverSound || 'pushover');
            msg.set_request_body_from_bytes('application/x-www-form-urlencoded',
                new GLib.Bytes(ByteArray.fromString(body)));
            this._pushoverSession.send_and_read_async(msg, GLib.PRIORITY_DEFAULT, null, (s, res) => {
                try {
                    s.send_and_read_finish(res);
                } catch (e) {
                    global.logError("Zen Pomodoro: Pushover request failed: " + e.message);
                }
            });
        } catch (e) {
            global.logError("Zen Pomodoro: Pushover error: " + e.message);
        }
    };

    // Settings "Send a test notification" button. Unlike _sendPushover this
    // gives explicit feedback so the user can confirm their keys are correct.
    proto._pushoverTest = function() {
        if (!Soup) {
            Main.notify(_("Push notifications need libsoup, which isn't available here."));
            return;
        }
        let user = (this._opt_pushoverUserKey || '').trim();
        let token = (this._opt_pushoverAppToken || '').trim();
        if (!user || !token) {
            Main.notify(_("Enter your Pushover user key and app token first."));
            return;
        }
        let title = (this._opt_pushoverTitle || '').trim() || 'Zen Pomodoro';
        let body = 'token=' + encodeURIComponent(token) +
            '&user=' + encodeURIComponent(user) +
            '&title=' + encodeURIComponent(title) +
            '&message=' + encodeURIComponent(_("Test notification from Zen Pomodoro \ud83c\udf45")) +
            '&priority=0';
        try {
            if (!this._pushoverSession) {
                this._pushoverSession = new Soup.Session();
            }
            let msg = Soup.Message.new('POST', 'https://api.pushover.net/1/messages.json');
            msg.set_request_body_from_bytes('application/x-www-form-urlencoded',
                new GLib.Bytes(ByteArray.fromString(body)));
            this._pushoverSession.send_and_read_async(msg, GLib.PRIORITY_DEFAULT, null, (s, res) => {
                let ok = false;
                try {
                    let bytes = s.send_and_read_finish(res);
                    let status = (typeof msg.get_status === 'function') ? msg.get_status() : 0;
                    let txt = '';
                    try { txt = ByteArray.toString(bytes.get_data()); } catch (e) { txt = ''; }
                    ok = (status === 200) && /"status"\s*:\s*1/.test(txt);
                } catch (e) {
                    global.logError("Zen Pomodoro: Pushover test failed: " + e.message);
                    ok = false;
                }
                Main.notify(ok
                    ? _("Pushover test sent \u2713 — check your device.")
                    : _("Pushover test failed. Double-check your user key and app token."));
            });
        } catch (e) {
            global.logError("Zen Pomodoro: Pushover test error: " + e.message);
            Main.notify(_("Pushover test failed. Double-check your user key and app token."));
        }
    };

    // Opt-in convenience: open /etc/hosts in the system's admin-capable editor
    // via the GVfs admin backend (interactive polkit prompt). This does NOT block
    // anything automatically; the user edits the file themselves.
    proto._collectBlockDomains = function() {
        let domains = [];
        let list = this._opt_blockDomains || [];
        for (let row of list) {
            // Accept pasted URLs; reduce to a bare hostname. See
            // RecommendModule.normalizeBlockDomain (pure + unit-tested).
            let d = RecommendModule.normalizeBlockDomain(row && row.domain);
            if (d) { domains.push(d); }
        }
        return domains;
    };

    // Path of the root-owned helper that "Set up passwordless blocking" installs
    // (with a polkit policy so pkexec runs it without a prompt). Used for
    // automatic blocking during focus.
    proto._passwordlessHelperPath = function() {
        return POMODORO_HOSTS_HELPER_INSTALLED;
    };

    // Bundled (user-dir) helper + setup script, run via interactive pkexec.
    proto._bundledHelperPath = function() {
        let base = (this._metadata && this._metadata.path) ? this._metadata.path : '';
        return base + '/hosts-helper.py';
    };
    proto._setupScriptPath = function() {
        let base = (this._metadata && this._metadata.path) ? this._metadata.path : '';
        return base + '/setup-passwordless.py';
    };

    // Snapshot of the blocking state, for UI and decisions:
    //  - passwordlessInstalled: root helper + polkit policy both present
    //  - sectionActive: our marked section currently exists in /etc/hosts
    //  - hostsDomains/hostsCount: domains that section blocks right now
    //  - listCount: domains configured in settings
    // /etc/hosts is world-readable, so this needs no privilege.
    proto._blockingStatus = function() {
        let passwordless = GLib.file_test(POMODORO_HOSTS_HELPER_INSTALLED, GLib.FileTest.IS_REGULAR)
            && GLib.file_test(POMODORO_HOSTS_POLICY_INSTALLED, GLib.FileTest.IS_REGULAR);
        let sectionActive = false;
        let hostsDomains = [];
        try {
            let [ok, contents] = GLib.file_get_contents(POMODORO_HOSTS_FILE);
            if (ok) {
                let text = ByteArray.toString(contents);
                let inSection = false;
                for (let line of text.split("\n")) {
                    let s = line.trim();
                    if (s === POMODORO_HOSTS_BLOCK_BEGIN) { inSection = true; sectionActive = true; continue; }
                    if (s === POMODORO_HOSTS_BLOCK_END) { inSection = false; continue; }
                    if (inSection) {
                        let m = /^0\.0\.0\.0\s+(\S+)/.exec(s);
                        if (m && m[1].indexOf("www.") !== 0) { hostsDomains.push(m[1]); }
                    }
                }
            }
        } catch (e) {
            global.logError("Zen Pomodoro: cannot read hosts for status: " + e.message);
        }
        return {
            passwordlessInstalled: passwordless,
            sectionActive: sectionActive,
            hostsCount: hostsDomains.length,
            hostsDomains: hostsDomains,
            listCount: this._collectBlockDomains().length
        };
    };

    // Pull the domains from the marked /etc/hosts section into the configured
    // list, so the list reflects what is actually blocked right now (a block
    // left from a previous session, or a hand-edit of the section). Safe at
    // startup: it matches the list to the section, so the reconcile that follows
    // is a no-op and never prompts.
    proto._syncBlockListFromHosts = function() {
        let st;
        try { st = this._blockingStatus(); } catch (e) { return; }
        if (!st || !st.sectionActive) { return; }
        let hostsDomains = (st.hostsDomains || []).slice();
        if (hostsDomains.length === 0) { return; }
        let current = this._collectBlockDomains();
        if (current.slice().sort().join(",") === hostsDomains.slice().sort().join(",")) { return; }
        let newList = hostsDomains.map((d) => ({ domain: d }));
        try {
            this._settingsProvider.setValue("block_domains", newList);
            global.log("Zen Pomodoro: imported " + hostsDomains.length + " blocked domain(s) from /etc/hosts");
        } catch (e) {
            global.logError("Zen Pomodoro: failed to import block list from /etc/hosts: " + e.message);
        }
    };

    // The helper to run a block/unblock with: the installed passwordless one
    // (no prompt) if present, otherwise the bundled one (interactive pkexec).
    proto._blockHelperBinary = function() {
        return this._blockingStatus().passwordlessInstalled
            ? this._passwordlessHelperPath() : this._bundledHelperPath();
    };

    // Manually (re)apply the current block list to /etc/hosts now. Removing a
    // site from the list and pressing Apply rewrites the section without it.
    proto._applyBlockNow = function() {
        let domains = this._collectBlockDomains();
        if (!domains.length) { this._clearBlockNow(); return; }
        this._runHostsHelper(['pkexec', this._blockHelperBinary(), 'block'].concat(domains),
            _("Blocking updated — %d site(s).").format(domains.length),
            () => { if (typeof this._updateMenuRuntime === 'function') { this._updateMenuRuntime(); } });
    };

    // Remove our section from /etc/hosts now (unblock everything we added).
    proto._clearBlockNow = function() {
        this._runHostsHelper(['pkexec', this._blockHelperBinary(), 'unblock'],
            _("Site blocking cleared."),
            () => { if (typeof this._updateMenuRuntime === 'function') { this._updateMenuRuntime(); } });
    };

    // The toggle (and the domain list) drive blocking directly: on => block now,
    // off => unblock now. Skip until init has settled so we never prompt at login.
    proto._onBlockDomainsChanged = function() {
        if (typeof this._updateMenuRuntime === 'function') { this._updateMenuRuntime(); }
        if (!this._blockingReady) { return; }
        this._syncBlocking(true);
    };

    // Bring /etc/hosts to the desired state: blocked with exactly the listed
    // domains when the toggle is on, otherwise unblocked. Idempotent — only runs
    // the helper when the live state differs, so it won't re-prompt needlessly.
    // interactive=false suppresses the password prompt (startup/background): it
    // then only reconciles when passwordless blocking is set up.
    proto._syncBlocking = function(interactive) {
        let domains = this._opt_enableBlocking ? this._collectBlockDomains() : [];
        let want = domains.length > 0;
        let st = this._blockingStatus();
        if (want) {
            let cur = st.hostsDomains.slice().sort().join(",");
            let desired = domains.slice().sort().join(",");
            if (st.sectionActive && cur === desired) { return; }
        } else if (!st.sectionActive) {
            return;
        }
        if (!st.passwordlessInstalled && !interactive) { return; }
        if (want) { this._applyBlockNow(); } else { this._clearBlockNow(); }
    };

    // Drop a stale block section left by a crash/reload when we are not actively
    // focusing — but only when passwordless is installed, so we never trigger a
    // password prompt at startup/exit. Without passwordless the user clears it
    // once from settings.
    proto._reconcileStaleBlock = function() {
        // Variant 1: blocking persists while the toggle is on, so there is no
        // "stale" block to clear on remove. Reconciliation runs via _syncBlocking.
    };

    // Cached blocking status for the menu row. /etc/hosts is read only while the
    // menu is open (the row is only visible then) and cached, so we don't read it
    // on every tick.
    proto._menuBlockStatus = function() {
        if (this._appletMenu && this._appletMenu.isOpen) {
            this._blockStatusCache = this._blockingStatus();
        }
        return this._blockStatusCache || {
            passwordlessInstalled: false, sectionActive: false,
            hostsCount: 0, hostsDomains: [], listCount: this._getBlockedSitesCount()
        };
    };

    // Block/unblock via a bundled helper run with pkexec (interactive admin
    // prompt). The helper only manages its own marked section of /etc/hosts.
    proto._runHostsHelper = function(argv, okMessage, onDone) {
        try {
            let proc = Gio.Subprocess.new(argv,
                Gio.SubprocessFlags.STDOUT_SILENCE | Gio.SubprocessFlags.STDERR_SILENCE);
            proc.wait_async(null, (p, res) => {
                let ok = false;
                try {
                    p.wait_finish(res);
                    ok = (p.get_exit_status() === 0);
                } catch (e) {
                    global.logError("Zen Pomodoro: hosts update failed: " + e.message);
                    return;
                }
                if (ok && okMessage) {
                    Main.notify(okMessage);
                }
                if (typeof onDone === 'function') { try { onDone(ok); } catch (e) {} }
                // non-zero (e.g. the user dismissed the password prompt): stay silent
            });
        } catch (e) {
            global.logError("Zen Pomodoro: could not run pkexec: " + e.message);
        }
    };

    proto._setupPasswordlessBlocking = function() {
        let mode = (this._opt_blockingAuthMode === 'keep') ? 'keep' : 'yes';
        let okMsg = (mode === 'keep')
            ? _("Blocking set up — you'll be asked for your password once per login session.")
            : _("Passwordless blocking enabled (no prompt).");
        this._runHostsHelper(['pkexec', this._setupScriptPath(), 'install', mode, this._bundledHelperPath()], okMsg);
    };

    proto._removePasswordlessBlocking = function() {
        this._runHostsHelper(['pkexec', this._setupScriptPath(), 'uninstall'], _("Passwordless blocking removed."));
    };

    proto._toggleZenMode = function(forceState) {
        this._zenActive = (typeof forceState === "boolean") ? forceState : !this._zenActive;
        this._updateZenOverlay();
        // Keep the menu switch in sync (e.g. after the overlay is dismissed too).
        this._updateMenuRuntime();
        if (this._zenActive) {
            this._maybeShowZenIntro();
        }
    };

    // First time Zen is switched on, explain what it does — and, crucially, why
    // nothing seems to happen when it's armed outside a focus session.
    proto._maybeShowZenIntro = function() {
        let shown = false;
        try { shown = this._settingsProvider.getValue("zen_intro_shown"); } catch (e) {}
        if (shown) { return; }
        try { this._settingsProvider.setValue("zen_intro_shown", true); } catch (e) {}
        let isFocus = (this._currentState === 'pomodoro' || this._currentState === 'pomodoro-paused');
        let body = isFocus
            ? _("Focus spotlight is on — every other window is dimmed so the one you're working in stands out. Slide your pointer to the top of the screen to see the time left and a way out.")
            : _("Focus spotlight is armed. When your next focus session starts, every window except the one you're working in dims, so your task stands out. Slide your pointer to the top of the screen to see the time left and a way out.");
        try { Main.notify(_("Zen mode"), body); } catch (e) {}
    };

    proto._updateZenOverlay = function() {
        let isFocus = (this._currentState === 'pomodoro' || this._currentState === 'pomodoro-paused' || this._currentState === 'pomodoro-overrun');
        let show = this._zenActive && this._opt_zenModeEnabled && isFocus;
        if (!show) {
            this._teardownZenSpotlight();
            return;
        }
        this._ensureZenHud();
        if (!this._zenFocusSignal) {
            this._zenFocusSignal = global.display.connect('notify::focus-window', () => {
                this._applyZenDim();
                this._positionZenHud();
                this._updateFocusFrame();
            });
        }
        this._startZenPointerWatch();
        this._applyZenDim();
        if (this._zenTopStrip) { this._zenTopStrip.show(); }
        this._positionZenHud();
        this._revealZenHud();
    };

    // Focus spotlight: darken every other window so the one you're working in
    // stays bright. Keyed by a named effect we can always strip back off.
    proto._setZenDimOnActor = function(actor, on, brightness) {
        if (!actor) { return; }
        try {
            let fx = actor.get_effect("zen-spotlight");
            let target = on ? brightness : 0;
            if (!on && !fx) { return; }
            if (on && fx && !fx._zenTweenId && typeof fx._zenB === 'number' && Math.abs(fx._zenB - target) < 0.005) {
                return; // already where it should be — don't restart a tween
            }
            if (on && !fx) {
                fx = new Clutter.BrightnessContrastEffect();
                fx._zenB = 0;
                fx.set_brightness(0);
                actor.add_effect_with_name("zen-spotlight", fx);
            }
            if (!fx) { return; }
            this._tweenZenEffect(actor, fx, target, !on);
        } catch (e) {}
    };

    // Fade an effect's brightness toward target over ~180ms (Mainloop-stepped to
    // match the rest of the applet). When fading out, drop the effect at the end.
    proto._tweenZenEffect = function(actor, fx, target, removeAtEnd) {
        if (fx._zenTweenId) {
            try { Mainloop.source_remove(fx._zenTweenId); } catch (e) {}
            fx._zenTweenId = 0;
        }
        // Reduce motion: jump straight to the target brightness, no fade.
        if (this._opt_reduceMotion) {
            fx._zenB = target;
            try { fx.set_brightness(target); } catch (e) {}
            if (removeAtEnd && Math.abs(target) < 0.001) {
                try { actor.remove_effect_by_name("zen-spotlight"); } catch (e) {}
            }
            return;
        }
        let start = (typeof fx._zenB === 'number') ? fx._zenB : 0;
        let steps = 9;
        let i = 0;
        fx._zenTweenId = Mainloop.timeout_add(20, () => {
            i++;
            let t = i / steps;
            let eased = 1 - (1 - t) * (1 - t); // easeOutQuad
            let v = start + (target - start) * eased;
            fx._zenB = v;
            try { fx.set_brightness(v); } catch (e) {}
            if (i >= steps) {
                fx._zenTweenId = 0;
                fx._zenB = target;
                try { fx.set_brightness(target); } catch (e) {}
                if (removeAtEnd && Math.abs(target) < 0.001) {
                    try { actor.remove_effect_by_name("zen-spotlight"); } catch (e) {}
                }
                return false;
            }
            return true;
        });
    };

    proto._applyZenDim = function() {
        let focus = global.display.get_focus_window ? global.display.get_focus_window() : null;
        let strength = (typeof this._opt_zenDimStrength === 'number' && this._opt_zenDimStrength > 0) ? this._opt_zenDimStrength : 50;
        let brightness = -(Math.max(5, Math.min(90, strength)) / 100);
        let actors = global.get_window_actors ? global.get_window_actors() : [];
        for (let i = 0; i < actors.length; i++) {
            let a = actors[i];
            let mw = a.meta_window || (a.get_meta_window && a.get_meta_window());
            this._setZenDimOnActor(a, this._zenShouldDim(mw, focus), brightness);
        }
        // Also dim the compositor wallpaper layer so the desktop option works
        // even when the wallpaper isn't painted by the Nemo desktop window.
        this._setZenDimOnActor(global.background_actor, Boolean(this._opt_zenDimDesktop), brightness);
    };

    // Which windows recede: never panels/docks; the desktop only if the user
    // opted in; everything else (except the one in focus) dims.
    proto._zenShouldDim = function(mw, focus) {
        if (!mw || mw === focus) { return false; }
        try {
            let wt = mw.get_window_type();
            if (wt === Meta.WindowType.DOCK) { return false; }
            if (wt === Meta.WindowType.DESKTOP) { return Boolean(this._opt_zenDimDesktop); }
            // Light up a whole *other* monitor the pointer moves to, but keep the
            // spotlight (only the focused window lit) on the monitor that holds it.
            if (typeof this._zenPointerMonitor === 'number' && this._zenPointerMonitor >= 0 && mw.get_monitor) {
                let focusMon = (focus && focus.get_monitor) ? focus.get_monitor() : -1;
                if (this._zenPointerMonitor !== focusMon && mw.get_monitor() === this._zenPointerMonitor) { return false; }
            }
            return true;
        } catch (e) {
            try { return !(mw.is_skip_taskbar && mw.is_skip_taskbar()); } catch (e2) { return true; }
        }
    };

    // The spotlight keeps the monitor under the pointer fully lit. Poll the
    // pointer's monitor and re-apply the dim whenever it changes, so moving to
    // another screen brightens it right away.
    proto._startZenPointerWatch = function() {
        try { this._zenPointerMonitor = global.display.get_current_monitor(); } catch (e) { this._zenPointerMonitor = -1; }
        // Single monitor: the pointer can't move to another screen, so there's
        // nothing to follow — skip the 200ms poll entirely.
        try { if (global.display.get_n_monitors() <= 1) { return; } } catch (e) {}
        if (this._zenPointerPollId) { return; }
        this._zenPointerPollId = Mainloop.timeout_add(200, () => {
            let isFocus = (this._currentState === 'pomodoro' || this._currentState === 'pomodoro-paused' || this._currentState === 'pomodoro-overrun');
            if (!(this._zenActive && this._opt_zenModeEnabled && isFocus)) { this._zenPointerPollId = 0; return false; }
            let m = -1;
            try { m = global.display.get_current_monitor(); } catch (e) {}
            if (m !== this._zenPointerMonitor) { this._zenPointerMonitor = m; this._applyZenDim(); }
            return true;
        });
    };

    proto._stopZenPointerWatch = function() {
        if (this._zenPointerPollId) { try { Mainloop.source_remove(this._zenPointerPollId); } catch (e) {} this._zenPointerPollId = 0; }
    };

    // Re-apply live when the dim settings change (only while the spotlight is up).
    proto._reapplyZenDim = function() {
        let isFocus = (this._currentState === 'pomodoro' || this._currentState === 'pomodoro-paused' || this._currentState === 'pomodoro-overrun');
        if (this._zenActive && this._opt_zenModeEnabled && isFocus) {
            this._applyZenDim();
        }
    };

    // Always strip the dim from every window — used on exit/break/disable so the
    // screen can never get stuck dark.
    proto._clearZenDim = function() {
        let list = global.get_window_actors ? global.get_window_actors().slice() : [];
        if (global.background_actor) { list.push(global.background_actor); }
        for (let i = 0; i < list.length; i++) {
            try {
                let fx = list[i].get_effect("zen-spotlight");
                if (fx && fx._zenTweenId) { try { Mainloop.source_remove(fx._zenTweenId); } catch (e) {} fx._zenTweenId = 0; }
                list[i].remove_effect_by_name("zen-spotlight");
            } catch (e) {}
        }
    };

    proto._teardownZenSpotlight = function() {
        if (this._zenFocusSignal) {
            try { global.display.disconnect(this._zenFocusSignal); } catch (e) {}
            this._zenFocusSignal = 0;
        }
        this._stopZenPointerWatch();
        if (this._zenHudHideId) { try { Mainloop.source_remove(this._zenHudHideId); } catch (e) {} this._zenHudHideId = 0; }
        if (this._zenHudTweenId) { try { Mainloop.source_remove(this._zenHudTweenId); } catch (e) {} this._zenHudTweenId = 0; }
        try { global.display.set_cursor(Meta.Cursor.DEFAULT); } catch (e) {}
        this._clearZenDim();
        if (this._zenHud) { try { this._zenHud.hide(); } catch (e) {} }
        if (this._zenTopStrip) { try { this._zenTopStrip.hide(); } catch (e) {} }
    };

    // Hidden by default so nothing sits over your work. Slide the pointer to the
    // top edge and a small pill fades in with the time left and a way out. Both
    // the pill and the edge trigger are registered as tracked chrome, so pointer
    // events actually land on them (added straight to uiGroup, clicks fall through).
    proto._ensureZenHud = function() {
        if (this._zenHud) { return; }
        this._zenHud = new St.Button({
            reactive: true,
            can_focus: true,
            track_hover: true,
            label: "--:--",
            style: "background-color: rgba(8,8,8,0.85); border-radius: 12px; padding: 6px 16px; color: rgba(255,255,255,0.96); font-size: 1.0em; font-weight: bold;"
        });
        this._zenHud.connect('clicked', () => {
            this._zenActive = false;
            this._updateZenOverlay();
            this._updateMenuRuntime();
        });
        this._zenHud.connect('enter-event', () => { try { global.display.set_cursor(Meta.Cursor.POINTING_HAND); } catch (e) {} this._revealZenHud(); return Clutter.EVENT_PROPAGATE; });
        this._zenHud.connect('leave-event', () => { try { global.display.set_cursor(Meta.Cursor.DEFAULT); } catch (e) {} this._armZenHudHide(); return Clutter.EVENT_PROPAGATE; });
        Main.layoutManager.addChrome(this._zenHud, { visibleInFullscreen: true, affectsInputRegion: true, affectsStruts: false });
        this._zenHud.opacity = 0;
        this._zenHud.hide();

        this._zenTopStrip = new St.Widget({ reactive: true });
        this._zenTopStrip.connect('enter-event', () => { this._revealZenHud(); return Clutter.EVENT_PROPAGATE; });
        Main.layoutManager.addChrome(this._zenTopStrip, { visibleInFullscreen: true, affectsInputRegion: true, affectsStruts: false });
    };

    // Fade the pill in with the current time and (re)start the idle hide timer.
    // A Mainloop-stepped tween — the actor .ease() resolves instantly in this
    // context, but a manual step animates reliably (same approach as the dim
    // fade). Honors the reduce-motion option.
    proto._zenHudTween = function(toOpacity, toTransY, durationMs, onDone) {
        if (!this._zenHud) { if (onDone) { onDone(); } return; }
        if (this._zenHudTweenId) { try { Mainloop.source_remove(this._zenHudTweenId); } catch (e) {} this._zenHudTweenId = 0; }
        if (this._opt_reduceMotion || !durationMs || durationMs <= 0) {
            try { this._zenHud.opacity = toOpacity; this._zenHud.translation_y = toTransY; } catch (e) {}
            if (onDone) { onDone(); }
            return;
        }
        let startOp = this._zenHud.opacity;
        let startTy = this._zenHud.translation_y || 0;
        let steps = Math.max(1, Math.round(durationMs / 16));
        let i = 0;
        this._zenHudTweenId = Mainloop.timeout_add(16, () => {
            i++;
            let t = i / steps; if (t > 1) { t = 1; }
            let eased = 1 - (1 - t) * (1 - t);
            try {
                this._zenHud.opacity = Math.round(startOp + (toOpacity - startOp) * eased);
                this._zenHud.translation_y = startTy + (toTransY - startTy) * eased;
            } catch (e) {}
            if (i >= steps) {
                this._zenHudTweenId = 0;
                try { this._zenHud.opacity = toOpacity; this._zenHud.translation_y = toTransY; } catch (e) {}
                if (onDone) { onDone(); }
                return false;
            }
            return true;
        });
    };

    // Slide the pill down from the top edge with a fade as it appears.
    proto._revealZenHud = function() {
        if (!this._zenHud) { return; }
        if (this._zenHudHideId) { try { Mainloop.source_remove(this._zenHudHideId); } catch (e) {} this._zenHudHideId = 0; }
        let wasHidden = (!this._zenHud.visible || this._zenHud.opacity < 30);
        this._zenHud.show();
        this._refreshZenLabels();
        if (wasHidden) { this._zenHud.opacity = 0; this._zenHud.translation_y = -12; }
        if (typeof this._zenHud.raise_top === 'function') { this._zenHud.raise_top(); }
        this._zenHudTween(255, 0, wasHidden ? 220 : 120);
        this._armZenHudHide();
    };

    // Tuck the pill away again a few seconds after the pointer leaves it.
    proto._armZenHudHide = function() {
        if (this._zenHudHideId) { try { Mainloop.source_remove(this._zenHudHideId); } catch (e) {} this._zenHudHideId = 0; }
        this._zenHudHideId = Mainloop.timeout_add(2600, () => {
            this._zenHudHideId = 0;
            if (this._zenHud) {
                this._zenHudTween(0, -8, 320, () => { try { this._zenHud.hide(); this._zenHud.translation_y = 0; } catch (e) {} });
            }
            return false;
        });
    };

    proto._positionZenHud = function() {
        if (!this._zenHud) { return; }
        let mon = Main.layoutManager ? (Main.layoutManager.focusMonitor || Main.layoutManager.primaryMonitor) : null;
        if (!mon) { return; }
        let w = 0;
        try { w = this._zenHud.get_preferred_width(-1)[1] || 0; } catch (e) {}
        this._zenHud.set_position(mon.x + Math.round((mon.width - w) / 2), mon.y + 12);
        if (this._zenTopStrip) {
            this._zenTopStrip.set_position(mon.x, mon.y);
            this._zenTopStrip.set_size(mon.width, 6);
            if (typeof this._zenTopStrip.raise_top === 'function') { this._zenTopStrip.raise_top(); }
        }
        if (typeof this._zenHud.raise_top === 'function') { this._zenHud.raise_top(); }
    };

    proto._refreshZenLabels = function() {
        if (!this._zenHud || !this._zenHud.visible) { return; }
        let timer = this._timerQueue ? this._timerQueue.getCurrentTimer() : null;
        let ticks = timer ? timer.getTicksRemaining() : 0;
        let t = this._getFormattedTimeLeft(ticks) || "--:--";
        try { this._zenHud.set_label(t + "    \u2715 " + _("Exit focus")); } catch (e) {}
        this._positionZenHud();
    };

    proto._updateBreathingGuide = function() {
        if (this._opt_breakBreathing && (this._currentState === 'short-break' || this._currentState === 'long-break')) {
            this._startBreathing();
        } else {
            this._stopBreathing();
        }
    };

    proto._startBreathing = function() {
        if (this._breathSourceId) {
            return;
        }
        if (!this._breathOverlay) {
            this._breathOverlay = new St.BoxLayout({
                vertical: true,
                reactive: false,
                x_align: Clutter.ActorAlign.CENTER,
                y_align: Clutter.ActorAlign.CENTER,
                style: "spacing: 22px;"
            });
            this._breathCircleBin = new St.Bin({ x_align: St.Align.MIDDLE, x_expand: true });
            this._breathCircle = new St.Widget({
                width: 120,
                height: 120,
                style: "background-color: rgba(108, 224, 148, 0.22); border: 2px solid rgba(108, 224, 148, 0.7); border-radius: 200px;"
            });
            this._breathCircleBin.add_actor(this._breathCircle);
            this._breathPhaseLabel = new St.Label({ style: "color: rgba(200, 220, 210, 0.9); font-size: 1.3em;" });
            let plabel = new St.Bin({ x_align: St.Align.MIDDLE, x_expand: true });
            plabel.add_actor(this._breathPhaseLabel);
            this._breathOverlay.add_actor(this._breathCircleBin);
            this._breathOverlay.add_actor(plabel);
            Main.uiGroup.add_actor(this._breathOverlay);
        }

        let primary = Main.layoutManager ? (Main.layoutManager.focusMonitor || Main.layoutManager.primaryMonitor) : null;
        if (primary) {
            this._breathOverlay.set_position(primary.x, primary.y + Math.round(primary.height * 0.32));
            this._breathOverlay.set_size(primary.width, Math.round(primary.height * 0.36));
        }
        this._breathOverlay.show();
        if (typeof this._breathOverlay.raise_top === 'function') {
            this._breathOverlay.raise_top();
        }
        this._breathStartMs = GLib.get_monotonic_time() / 1000;
        this._tickBreathing();
        // The circle is static under reduce-motion, so a slow tick keeps the phase
        // label current with far fewer wakeups; otherwise animate smoothly.
        let breathMs = this._opt_reduceMotion ? 250 : 60;
        this._breathSourceId = Mainloop.timeout_add(breathMs, () => {
            this._tickBreathing();
            return true;
        });
    };

    proto._tickBreathing = function() {
        if (!this._breathCircle) {
            return;
        }
        // Phase durations [in, hold, out, hold] in seconds.
        let pat = this._opt_breathingPattern || 'box';
        let phases = (pat === '478') ? [4, 7, 8, 0]
            : (pat === 'relax') ? [4, 0, 6, 0]
            : [4, 4, 4, 4];
        let cycle = (phases[0] + phases[1] + phases[2] + phases[3]) * 1000;
        if (cycle <= 0) {
            cycle = 16000;
        }
        let reduce = Boolean(this._opt_reduceMotion);
        let t = ((GLib.get_monotonic_time() / 1000) - this._breathStartMs) % cycle;
        let minR = 90, maxR = 240, r, phase;
        let inEnd = phases[0] * 1000;
        let hold1End = inEnd + phases[1] * 1000;
        let outEnd = hold1End + phases[2] * 1000;
        if (t < inEnd) {
            r = reduce ? maxR : (minR + (maxR - minR) * (t / (phases[0] * 1000)));
            phase = _("Breathe in");
        } else if (t < hold1End) {
            r = maxR;
            phase = _("Hold");
        } else if (t < outEnd) {
            r = reduce ? minR : (maxR - (maxR - minR) * ((t - hold1End) / (phases[2] * 1000)));
            phase = _("Breathe out");
        } else {
            r = minR;
            phase = _("Hold");
        }
        r = Math.round(r);
        this._breathCircle.set_size(r, r);
        if (this._breathPhaseLabel) {
            this._breathPhaseLabel.set_text(phase);
        }
    };

    proto._stopBreathing = function() {
        if (this._breathSourceId) {
            Mainloop.source_remove(this._breathSourceId);
            this._breathSourceId = 0;
        }
        if (this._breathOverlay) {
            this._breathOverlay.hide();
        }
    };

    proto._extendFocusFromDialog = function() {
        // At this point the queue points at the short break that follows the
        // just-finished pomodoro; step back to that pomodoro and run it again
        // for the configured extension, so the user stays in flow.
        let minutes = this._opt_flowExtendMinutes || 5;
        let pos = (typeof this._timerQueue.getPosition === "function") ? this._timerQueue.getPosition() : 0;
        let targetPos = Math.max(0, pos - 1);
        if (!this._timerQueue.setPosition(targetPos)) {
            return;
        }
        let timer = this._timerQueue.getCurrentTimer();
        if (timer !== this._timers.pomodoro) {
            return;
        }
        timer.setRemaining(minutes * 60);
        this._warnArmed = true;            // re-arm the pre-end warning for the extended focus
        this._pushReminderArmed = true;    // and the pre-end Pushover reminder
        this._timerQueue.preventStart(false);
        this._appletMenu.toggleTimerState(true);
        this._timerQueue.start();
    };
}
