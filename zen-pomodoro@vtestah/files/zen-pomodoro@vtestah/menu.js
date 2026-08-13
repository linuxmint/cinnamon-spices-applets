const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const GLib = imports.gi.GLib;
const Pango = imports.gi.Pango;
const Gettext = imports.gettext;
const Tooltips = imports.ui.tooltips;

const UUID = "zen-pomodoro@vtestah";
Gettext.bindtextdomain(UUID, GLib.get_user_data_dir() + "/locale");

function _(str) {
    return Gettext.dgettext(UUID, str);
}

var PomodoroMenu = class extends Applet.AppletPopupMenu {
    constructor(launcher, orientation) {
        super(launcher, orientation);
        this._pomodoroCount = 0;
        this._pomodoroSetCount = 0;
        this._pomodoriTotal = 4;
        this._primaryActionMode = "start";

        // Layout category: "idle" (stopped / break-over) or "active" (running / paused).
        this._layoutCategory = "idle";
        // Cache of the last runtime object so a rebuild can restore in-place state.
        this._lastRuntimeState = null;
        // Cache of the preset indicator so a rebuild can restore DOT ornaments.
        this._presetState = {
            activePreset: ""
        };
        this._presets = [];
        this._presetItems = [];
        // Progress bar state (drawn in the status header during active/paused).
        this._progressBarPercent = 0;
        this._progressBarActive = false;
        this._progressBarColor = [0.84, 0.60, 0.19];

        // Appearance (accent colours + font scale), pushed by the applet via
        // setAppearance(); defaults reproduce the original look.
        this._accentFocusCss = "rgb(235, 175, 75)";
        this._accentBreakCss = "rgb(120, 205, 155)";
        this._menuFontScale = 100;

        this._nullWidgetRefs();

        this._applyMenuActorStyle();

        this._rebuildMenu();
        this.updateCounts(0, 0);

        // Re-derive menu colours from the live theme whenever the menu opens, so
        // switching to a light theme (e.g. Mint-X) is reflected immediately.
        this.connect('open-state-changed', (m, isOpen) => {
            if (!isOpen) { return; }
            // The theme node is only reliable once the menu is realised, so
            // recompute every colour (timer, badge, neutral text) on open.
            if (this._lastRuntimeState) {
                this._applyRuntimeToWidgets(this._lastRuntimeState);
            } else {
                this._applyThemePalette();
            }
        });
    }

    _applyMenuActorStyle() {
        if (this.actor && typeof this.actor.set_style === "function") {
            let scale = this._menuFontScale || 100;
            let minW = Math.round(320 * scale / 100);
            this.actor.set_style(`min-width: ${minW}px; font-size: ${scale}%;`);
        }
    }

    _nullWidgetRefs() {
        this._statusItem = null;
        this._stateBadgeLabel = null;
        this._timeLeftLabel = null;
        this._progressLabel = null;
        this._progressBar = null;
        this._cycleLabel = null;
        this._dailyLabel = null;
        this._taskLabel = null;
        this._sitesLabel = null;
        this._presetSummaryLabel = null;
        this._presetSubmenu = null;
        this._compactInfoLabel = null;
        this._chooseTaskItem = null;
        this._zenItem = null;
        this._focusUntilItem = null;
        this._ambientItem = null;
        this._focusLength = 0;
        this._primaryActionItem = null;
        this._preset25Item = null;
        this._preset50Item = null;
        this._resetTimerItem = null;
        this._resetAllItem = null;
        this._skipTimerItem = null;
        this._sessionSubmenu = null;
        this._statsSubmenu = null;
        this._statTodayItem = null;
        this._statValueLabel = null;
        this._statWeekItem = null;
        this._statMonthItem = null;
        this._statTotalItem = null;
        this._statTimeItem = null;
        this._statStreakItem = null;
        this._statBestItem = null;
        this._statAchieveItem = null;
        this._tasksSubmenu = null;
        this._tasks = [];
        this._tasksCurrentId = "";
        this._dimLabels = [];
        this._taskItems = [];
        this._tasksFinishText = "";
        this._taskTemplates = [];
    }

    _getLayoutCategory(state) {
        if (state === "pomodoro-stop" || state === "break-over") {
            return "idle";
        }
        return "active";
    }

    _rebuildMenu() {
        // Preserve task data (it's state, not widgets) across the teardown.
        let keepTasks = this._tasks;
        let keepCurrentId = this._tasksCurrentId;
        let keepFinish = this._tasksFinishText;
        let keepTemplates = this._taskTemplates;
        this.removeAll();
        this._nullWidgetRefs();
        this._tasks = keepTasks;
        this._tasksCurrentId = keepCurrentId;
        this._tasksFinishText = keepFinish;
        this._taskTemplates = keepTemplates;

        try {
            if (this._layoutCategory === "active") {
                this._buildActiveLayout();
            } else {
                this._buildIdleLayout();
            }
        } catch (e) {
            global.logError(`PomodoroMenu rebuild error: ${e.message}`);
            let fallback = new PopupMenu.PopupMenuItem(_("Error: menu unavailable"));
            fallback.setSensitive(false);
            this.addMenuItem(fallback);
            return;
        }

        // Restore cached visual state into the freshly created widgets.
        this._applyCachedPreset();
        this._updateCycleIndicator();
        if (this._lastRuntimeState) {
            this._applyRuntimeToWidgets(this._lastRuntimeState);
        }
    }

    _stylePrimaryAction() {
        if (!this._primaryActionItem || !this._primaryActionItem.label) {
            return;
        }

        this._primaryActionItem.label.set_style_class_name("pomodoro-primary");
    }

    setAppearance(opts) {
        opts = opts || {};
        if (opts.accentFocus) {
            this._accentFocusCss = opts.accentFocus;
        }
        if (opts.accentBreak) {
            this._accentBreakCss = opts.accentBreak;
        }
        if (typeof opts.fontScale === "number" && opts.fontScale > 0) {
            this._menuFontScale = opts.fontScale;
        }
        this._applyMenuActorStyle();
        // Re-apply colours to whatever is currently shown.
        if (this._lastRuntimeState) {
            this._applyRuntimeToWidgets(this._lastRuntimeState);
        }
    }

    _setPrimaryActionAccent(state) {
        if (!this._primaryActionItem || !this._primaryActionItem.actor) {
            return;
        }

        let breakish = (state === "short-break" || state === "long-break" ||
            state === "short-break-paused" || state === "long-break-paused" || state === "break-over");
        if (this._primaryActionItem.actor) {
            this._primaryActionItem.actor.set_style(null);
        }
        if (this._primaryActionItem.label) {
            this._primaryActionItem.label.set_style_class_name("pomodoro-primary");
            this._primaryActionItem.label.set_style(
                `color: ${breakish ? this._accentColor(this._accentBreakCss) : this._accentColor(this._accentFocusCss)};`
            );
        }
    }

    _buildStatusHeader() {
        this._statusItem = new PopupMenu.PopupBaseMenuItem({ reactive: false });
        let statusBox = new St.BoxLayout({
            vertical: true,
            x_expand: true,
            style_class: "pomodoro-status"
        });

        this._stateBadgeLabel = new St.Label({
            text: _("Ready to focus"),
            style_class: "pomodoro-badge pomodoro-badge-idle"
        });
        this._timeLeftLabel = new St.Label({
            text: "--:--",
            style_class: "pomodoro-time"
        });

        this._progressBar = new St.DrawingArea({
            x_expand: true,
            style: "height: 6px; margin: 1px 0 2px 0;"
        });
        this._progressBar.connect('repaint', (area) => {
            this._repaintProgressBar(area);
        });

        this._progressLabel = new St.Label({
            text: _("Ready to start"),
            style_class: "pomodoro-progress"
        });
        this._cycleLabel = new St.Label({
            text: "",
            style_class: "pomodoro-cycle"
        });
        this._taskLabel = new St.Label({
            text: _("No task yet — tap to choose one"),
            style_class: "pomodoro-task"
        });
        this._taskLabel.set_reactive(true);
        this._taskLabel.set_track_hover(true);
        this._taskLabel.connect('button-press-event', () => { this.emit('choose-task'); return true; });
        this._taskLabel.connect('notify::hover', () => this._refreshTaskLabelColor());
        new Tooltips.Tooltip(this._taskLabel, _("Change task"));
        this._dailyLabel = new St.Label({
            text: "",
            style_class: "pomodoro-cycle"
        });
        this._dimLabels.push(this._progressLabel, this._cycleLabel, this._taskLabel, this._dailyLabel);

        statusBox.add_actor(this._stateBadgeLabel);
        statusBox.add_actor(this._timeLeftLabel);
        statusBox.add_actor(this._progressBar);
        statusBox.add_actor(this._progressLabel);
        statusBox.add_actor(this._taskLabel);
        statusBox.add_actor(this._dailyLabel);
        this._statusItem.addActor(statusBox, { expand: true, span: -1, align: St.Align.START });
        this.addMenuItem(this._statusItem);
    }

    _repaintProgressBar(area) {
        let cr = area.get_context();
        try {
            let [w, h] = area.get_surface_size();

            // Track. A white track is invisible on a light popup, so use a faint
            // dark track there and keep the faint light track on dark themes.
            let lt = this._isLightTheme();
            let tv = lt ? 0 : 1;
            cr.setSourceRGBA(tv, tv, tv, lt ? 0.18 : 0.12);
            cr.rectangle(0, 0, w, h);
            cr.fill();

            if (this._progressBarActive) {
                let pct = Math.max(0, Math.min(100, this._progressBarPercent)) / 100;
                let fw = Math.round(w * pct);
                if (fw > 0) {
                    let c = this._progressBarColor || [0.84, 0.60, 0.19];
                    cr.setSourceRGBA(c[0], c[1], c[2], 0.95);
                    cr.rectangle(0, 0, fw, h);
                    cr.fill();
                }
            }
        } finally {
            cr.$dispose();
        }
    }

    _milestoneTier(value, tiers) {
        let best = 0;
        for (let t of tiers) {
            if (value >= t) {
                best = t;
            }
        }
        return best;
    }

    _fmtDuration(min) {
        min = Math.max(0, Math.round(min || 0));
        if (min < 60) {
            return _("%d min").format(min);
        }
        let hrs = Math.floor(min / 60);
        let rem = min % 60;
        return rem ? _("%dh %dm").format(hrs, rem) : _("%dh").format(hrs);
    }

    _updateProgressBar(state, progressPercent) {
        let active = (typeof progressPercent === "number");
        this._progressBarActive = active;
        this._progressBarPercent = active ? progressPercent : 0;

        let breakish = (state === "short-break" || state === "long-break" ||
            state === "short-break-paused" || state === "long-break-paused");
        this._progressBarColor = breakish ? [0.36, 0.78, 0.55] : [0.84, 0.60, 0.19];

        if (this._progressBar) {
            if (active) {
                this._progressBar.show();
            } else {
                this._progressBar.hide();
            }
            this._progressBar.queue_repaint();
        }
    }

    _updateCycleIndicator() {
        if (!this._cycleLabel) {
            return;
        }

        let st = this._lastRuntimeState && this._lastRuntimeState.state;
        if (st === "pomodoro-stop") {
            this._cycleLabel.hide();
            return;
        }
        this._cycleLabel.show();

        let total = this._pomodoriTotal > 0 ? this._pomodoriTotal : 4;
        let current = Math.min(this._pomodoroCount + 1, total);
        let text = _("Pomodoro %d / %d").format(current, total);
        if (this._pomodoroSetCount > 0) {
            text += "  \u00B7  " + Array(this._pomodoroSetCount + 1).join("\u25cf");
        }
        this._cycleLabel.set_text(text);
    }

    _buildPrimaryAction() {
        this._primaryActionItem = new PopupMenu.PopupMenuItem(_("Start focus"));
        this._primaryActionItem.connect("activate", () => {
            if (this._primaryActionMode === "none") {
                return;
            }
            if (this._primaryActionMode === "pause") {
                this.emit('stop-timer');
            } else {
                this.emit('start-timer');
            }
        });
        this.addMenuItem(this._primaryActionItem);
        this._stylePrimaryAction();
    }

    _makeSkipResetItems() {
        let skipItem = new PopupMenu.PopupMenuItem(_("Skip phase"));
        this._skipTimerItem = skipItem;
        new Tooltips.Tooltip(skipItem.actor, _("Skip the current phase and move on to the next."));
        skipItem.connect('activate', () => {
            this.emit('skip-timer');
        });

        let resetItem = new PopupMenu.PopupMenuItem(_("Reset timer"));
        this._resetTimerItem = resetItem;
        new Tooltips.Tooltip(resetItem.actor, _("Stop the current timer and return to the start. Your pomodoro count for this set is kept."));
        resetItem.connect('activate', () => {
            this.toggleTimerState(false);
            this.emit('reset-timer');
        });

        return { skipItem: skipItem, resetItem: resetItem };
    }

    _makeResetAllSubmenu() {
        // A submenu acts as the confirmation step, guarding the more destructive
        // reset (it also clears this set's pomodoro count, not just the timer).
        let submenu = new PopupMenu.PopupSubMenuMenuItem(_("Reset timer & count"));
        new Tooltips.Tooltip(submenu.actor, _("Reset the timer and clear this set's pomodoro count. Your saved statistics aren't affected."));
        let confirm = new PopupMenu.PopupMenuItem(_("Confirm reset"));
        if (confirm.label) {
            confirm.label.set_style_class_name("pomodoro-reset-confirm");
            confirm.label.set_style("color: " + this._accentColor("rgb(220, 120, 120)") + ";");
        }
        confirm.connect('activate', () => {
            this.toggleTimerState(false);
            this.emit('reset-counts');
            this.emit('reset-timer');
        });
        submenu.menu.addMenuItem(confirm);
        this._resetAllItem = submenu;
        return submenu;
    }

    _buildIdleLayout() {
        this._buildStatusHeader();

        this._buildPrimaryAction();

        // Tasks — the header task line is the quick picker; this manages the list.
        this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this._tasksSubmenu = new PopupMenu.PopupSubMenuMenuItem(_("Task list"));
        this.addMenuItem(this._tasksSubmenu);
        this._populateTasksSubmenu();
        // Cap + scroll the task list instead of growing toward full screen.
        // open() resets the scrollbar policy from the top menu's max-height, so
        // re-apply it (deferred, after open settles) when the list is long.
        if (this._tasksSubmenu.menu && this._tasksSubmenu.menu.actor) {
            this._tasksSubmenu.menu.actor.add_style_class_name("pomodoro-tasks-scroll");
            this._tasksSubmenu.menu.connect('open-state-changed', (menu, isOpen) => {
                if (!isOpen || !menu.actor) { return; }
                GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
                    if (menu.actor) {
                        let adj = menu.actor.get_vscroll_bar().get_adjustment();
                        menu.actor.vscrollbar_policy = (adj.upper > 322) ? St.PolicyType.AUTOMATIC : St.PolicyType.NEVER;
                    }
                    return GLib.SOURCE_REMOVE;
                });
            });
        }

        // Distractions: jot a thought and keep working; review / clear here.
        this._distractSubmenu = new PopupMenu.PopupSubMenuMenuItem(_("Distractions"));
        this.addMenuItem(this._distractSubmenu);
        this._buildDistractEntry();
        this._populateDistractions();
        this._distractSubmenu.menu.connect('open-state-changed', (m, isOpen) => {
            // Don't auto-focus the entry: holding key focus here means a later
            // click (e.g. delete) blurs it and closes the menu. Just recolour
            // the placeholder from the entry's theme. Click the field to type.
            if (isOpen && this._distractEntry && this._distractHint) {
                GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
                    if (this._distractEntry && this._distractHint) {
                        try {
                            let ec = this._distractEntry.get_theme_node().get_foreground_color();
                            this._distractHint.set_style("color: rgba(" + ec.red + ", " + ec.green + ", " + ec.blue + ", 0.55);");
                        } catch (e) {}
                    }
                    return GLib.SOURCE_REMOVE;
                });
            }
        });

        // Session setup — preset (focus + breaks + cycle).
        this._presetSubmenu = new PopupMenu.PopupSubMenuMenuItem(_("Preset"));
        this.addMenuItem(this._presetSubmenu);
        this._populatePresetSubmenu();
        // The label gets a value appended; don't let it ellipsize to "Прес…".
        if (this._presetSubmenu.label) { this._presetSubmenu.label.clutter_text.set_ellipsize(Pango.EllipsizeMode.NONE); }

        // Optional modes + toggles, grouped by a separator instead of a header.
        this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this._focusUntilItem = new PopupMenu.PopupMenuItem(_("Focus until\u2026"));
        this._focusUntilItem.connect('activate', () => { this.emit('focus-until'); });
        this.addMenuItem(this._focusUntilItem);

        this._zenItem = new PopupMenu.PopupSwitchMenuItem(_("Zen mode"), false);
        this._zenItem.connect('toggled', (item, state) => this.emit('toggle-zen', state));
        new Tooltips.Tooltip(this._zenItem.actor, _("Focus spotlight: while a focus session runs, every other window dims so the one you're working in stands out. Click the on-screen pill to exit."));
        this.addMenuItem(this._zenItem);

        this._ambientItem = new PopupMenu.PopupSwitchMenuItem(_("Ambient sound"), false);
        this._ambientItem.connect('toggled', (item, state) => this.emit('set-ambient', state));
        this.addMenuItem(this._ambientItem);

        let sitesItem = new PopupMenu.PopupBaseMenuItem();
        let sitesKeyLabel = new St.Label({ text: _("Site blocking"), style_class: "pomodoro-info-label" });
        this._dimLabels.push(sitesKeyLabel);
        sitesItem.addActor(sitesKeyLabel);
        this._sitesLabel = new St.Label({ text: _("off"), style_class: "pomodoro-info-value" });
        sitesItem.addActor(this._sitesLabel, { expand: true, align: St.Align.END });
        sitesItem.connect('activate', () => { this.emit('open-blocking-settings'); });
        new Tooltips.Tooltip(sitesItem.actor, _("Manage blocked sites"));
        this.addMenuItem(sitesItem);

        // Statistics — one compact clickable row that opens the dashboard.
        this._statTodayItem = new PopupMenu.PopupBaseMenuItem();
        let statKeyLabel = new St.Label({ text: _("Statistics"), style_class: "pomodoro-info-label" });
        this._dimLabels.push(statKeyLabel);
        this._statTodayItem.addActor(statKeyLabel);
        this._statValueLabel = new St.Label({ text: "", style_class: "pomodoro-info-value" });
        this._statTodayItem.addActor(this._statValueLabel, { expand: true, align: St.Align.END });
        this._statTodayItem.connect('activate', () => { this.emit('open-stats'); });
        new Tooltips.Tooltip(this._statTodayItem.actor, _("Open the statistics dashboard"));
        this.addMenuItem(this._statTodayItem);

        // Less used.
        this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        let quickStart = new PopupMenu.PopupMenuItem(_("Setup wizard\u2026"));
        quickStart.connect('activate', () => this.emit('open-onboarding'));
        this.addMenuItem(quickStart);
    }

    _buildActiveLayout() {
        this._buildStatusHeader();

        this._buildPrimaryAction();

        let sr = this._makeSkipResetItems();
        this.addMenuItem(sr.skipItem);
        this._zenItem = new PopupMenu.PopupSwitchMenuItem(_("Zen mode"), false);
        this._zenItem.connect('toggled', (item, state) => this.emit('toggle-zen', state));
        new Tooltips.Tooltip(this._zenItem.actor, _("Focus spotlight: while a focus session runs, every other window dims so the one you're working in stands out. Click the on-screen pill to exit."));
        this.addMenuItem(this._zenItem);
        this._ambientItem = new PopupMenu.PopupSwitchMenuItem(_("Ambient sound"), false);
        this._ambientItem.connect('toggled', (item, state) => this.emit('set-ambient', state));
        this.addMenuItem(this._ambientItem);
        this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.addMenuItem(sr.resetItem);
        this.addMenuItem(this._makeResetAllSubmenu());
    }

    toggleTimerState(state) {
        this._primaryActionMode = state ? "pause" : "start";
    }

    updateRuntimeState(runtime) {
        runtime = runtime || {};
        let state = runtime.state || "pomodoro-stop";
        let newCategory = this._getLayoutCategory(state);

        this._lastRuntimeState = runtime;

        if (newCategory !== this._layoutCategory) {
            // Category changed: tear down and rebuild. The rebuild re-applies
            // the cached runtime to the new widgets, so no further work needed.
            this._layoutCategory = newCategory;
            this._rebuildMenu();
            return;
        }

        // Same category: update labels and styles in-place.
        this._applyRuntimeToWidgets(runtime);
    }

    // The theme's own menu text colour, read from St. On a dark theme this is a
    // light colour; on a light theme (e.g. Mint-X) it is dark. Every menu colour
    // is derived from it so the menu adapts instead of assuming a dark popup.
    // (The content box is transparent, so reading its *background* never worked —
    // we read the inherited *foreground* colour, which the theme always sets.)
    _themeFgRgb() {
        try {
            let node = (this.box || this.actor).get_theme_node();
            let c = node.get_foreground_color();
            if (c) return [c.red, c.green, c.blue];
        } catch (e) {}
        return [235, 235, 235]; // assume a dark theme (light text) by default
    }

    _isLightTheme() {
        let rgb = this._themeFgRgb();
        // Dark menu text => light popup.
        return (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255 < 0.5;
    }

    _fgColor(alpha) {
        let rgb = this._themeFgRgb();
        return "rgba(" + rgb[0] + ", " + rgb[1] + ", " + rgb[2] + ", " + alpha + ")";
    }

    // Neutral secondary text. On dark themes keep the exact mid-grey (no visual
    // change); on light themes use the theme's dark text so it stays legible.
    _dimText() {
        return this._isLightTheme() ? this._fgColor(0.80) : "rgba(150, 150, 150, 0.95)";
    }

    // Faint tertiary text (e.g. the preset tag in the task list).
    _faintText() {
        return this._isLightTheme() ? this._fgColor(0.58) : "rgba(255, 255, 255, 0.45)";
    }

    // Semantic accent (focus amber / break green / user colour). Unchanged on
    // dark themes; darkened on light popups where a bright accent washes out.
    _accentColor(css) {
        if (!this._isLightTheme()) return css;
        let m = /(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(css || "");
        if (!m) return css;
        return "rgb(" + Math.round(parseInt(m[1], 10) * 0.5) + ", " +
            Math.round(parseInt(m[2], 10) * 0.5) + ", " +
            Math.round(parseInt(m[3], 10) * 0.5) + ")";
    }

    // The prominent time label: the theme text colour on light popups, the
    // original near-white on dark ones.
    _brightTextColor() {
        return this._isLightTheme() ? this._fgColor(0.95) : "rgba(255, 255, 255, 0.96)";
    }

    // Recolour every neutral label collected during build from the live theme.
    _applyThemePalette() {
        let dim = this._dimText();
        let labels = this._dimLabels || [];
        for (let i = 0; i < labels.length; i++) {
            let l = labels[i];
            if (l) {
                try { l.set_style("color: " + dim + ";"); } catch (e) {}
            }
        }
        // The current-task line is hoverable: brighten it on hover. Re-applied
        // here so the per-tick recolour above doesn't fight the hover state.
        this._refreshTaskLabelColor();
    }

    // Brighten the clickable current-task line on hover; dim otherwise.
    _refreshTaskLabelColor() {
        if (!this._taskLabel) { return; }
        let hovered = false;
        try { hovered = this._taskLabel.hover; } catch (e) {}
        try {
            this._taskLabel.set_style("color: " + (hovered ? this._brightTextColor() : this._dimText()) + ";");
        } catch (e) {}
    }

    _applyRuntimeToWidgets(runtime) {
        runtime = runtime || {};
        let state = runtime.state || "pomodoro-stop";
        let activePreset = runtime.activePreset || "unknown";
        let task = runtime.task || "";
        let selectedTask = runtime.selectedTask || "";
        let timeLeft = runtime.timeLeft || "";
        let progressPercent = runtime.progressPercent;
        let isIdle = (state === "pomodoro-stop" || state === "break-over");

        if (typeof runtime.pomodoriTotal === "number") {
            this._pomodoriTotal = runtime.pomodoriTotal;
        }
        if (typeof runtime.pomodoriDone === "number") {
            this._pomodoroCount = runtime.pomodoriDone;
        }
        if (typeof runtime.setsDone === "number") {
            this._pomodoroSetCount = runtime.setsDone;
        }
        this._updateCycleIndicator();

        if (this._dailyLabel) {
            let goal = runtime.dailyGoal || 0;
            if (goal > 0) {
                let count = runtime.dailyCount || 0;
                let cap = Math.min(goal, 8);
                // Scale the bar to the goal so it only reads "full" when the goal
                // is actually met. The old 1:1 fill saturated at 8 for goals > 8
                // (e.g. a full bar already at 8/20); for goals <= 8 this stays 1:1.
                let filled = (count >= goal) ? cap : Math.max(0, Math.min(cap, Math.floor((count / goal) * cap)));
                let bar = "🍅".repeat(filled) + "⚪".repeat(Math.max(0, cap - filled));
                let text = bar + "  " + count + " / " + goal;
                if (count >= goal) {
                    text += "  \u2713";
                }
                if (runtime.streak && runtime.streak > 0) {
                    text += "   \u{1F525}" + runtime.streak;
                }
                this._dailyLabel.set_text(text);
                this._dailyLabel.show();
            } else {
                this._dailyLabel.hide();
            }
        }

        // Reflect quick-access state (idle-layout widgets only).
        if (this._ambientItem && typeof runtime.ambientOn === "boolean") {
            this._ambientItem.setToggleState(runtime.ambientOn);
        }
        if (this._zenItem && typeof this._zenItem.setToggleState === "function" &&
            typeof runtime.zenActive === "boolean") {
            this._zenItem.setToggleState(runtime.zenActive);
        }
        if (typeof runtime.focusLength === "number" &&
            runtime.focusLength !== this._focusLength) {
            this._focusLength = runtime.focusLength;
        }

        if (this._statTodayItem && runtime.stats) {
            let st = runtime.stats;
            let hasGoal = (runtime.dailyGoal || 0) > 0;
            if (this._statValueLabel) {
                // When a daily goal is set, the goal-progress line already shows
                // today's count + streak, so keep this row's value clear to avoid
                // duplication — but the row itself stays visible and clickable so
                // the statistics dashboard is always reachable from the menu.
                let parts = [];
                if (!hasGoal) {
                    if ((st.today || 0) > 0) { parts.push((st.today || 0) + " 🍅"); }
                    if ((st.streak || 0) >= 2) { parts.push("🔥 " + (st.streak || 0)); }
                }
                this._statValueLabel.set_text(parts.join("  ·  "));
            }
            if (this._statTodayItem) {
                this._statTodayItem.actor.show();
            }
            if (this._statWeekItem) {
                let wk = st.week || 0;
                let lw = st.lastWeek || 0;
                let txt = _("Last 7 days: %d").format(wk);
                if (lw > 0) {
                    let pct = Math.round((wk - lw) / lw * 100);
                    let arrow = (pct > 0) ? "▲" : ((pct < 0) ? "▼" : "■");
                    txt += "  " + arrow + " " + Math.abs(pct) + "%";
                }
                this._statWeekItem.label.set_text(txt);
            }
            if (this._statMonthItem) {
                this._statMonthItem.label.set_text(_("Last 30 days: %d").format(st.month || 0));
            }
            if (this._statTotalItem) {
                this._statTotalItem.label.set_text(_("All time: %d").format(st.total || 0));
            }
            if (this._statTimeItem) {
                this._statTimeItem.label.set_text(_("Focus time: %s today · %s total").format(this._fmtDuration(st.todayMin || 0), this._fmtDuration(st.totalMinutes || 0)));
            }
            if (this._statBestItem) {
                this._statBestItem.label.set_text(_("Best day: %d").format(st.bestDay || 0));
            }
            if (this._statAchieveItem) {
                let tot = this._milestoneTier(st.total || 0, [10, 25, 50, 100, 250, 500, 1000, 2000]);
                let stk = this._milestoneTier(st.longestStreak || 0, [3, 7, 14, 30, 60, 100, 365]);
                let badges = [];
                if (tot > 0) {
                    badges.push("🏆 " + tot);
                }
                if (stk > 0) {
                    badges.push("🔥 " + stk);
                }
                this._statAchieveItem.label.set_text(_("Milestones: %s").format(badges.length ? badges.join("   ") : _("none yet")));
            }
        }

        let badge = runtime.stateLabel || _("Ready to focus");

        if (this._progressLabel) {
            if (state === "pomodoro-stop") {
                if (runtime.finishEstimate) {
                    this._progressLabel.show();
                    this._progressLabel.set_text(_("Finish your tasks by ~%s").format(runtime.finishEstimate.time));
                } else {
                    this._progressLabel.hide();
                }
            } else {
                this._progressLabel.show();
                if (typeof progressPercent === "number") {
                    let line;
                    if (state === "pomodoro" || state === "pomodoro-paused") {
                        let total = runtime.pomodoriTotal || 4;
                        let cur = Math.min(total, (runtime.pomodoriDone || 0) + 1);
                        line = _("Pomodoro %d of %d").format(cur, total);
                    } else if (state === "long-break" || state === "long-break-paused") {
                        line = _("Long break");
                    } else {
                        line = _("Short break");
                    }
                    if (runtime.endTime && state !== "pomodoro" && state !== "pomodoro-paused") {
                        line += ` \u00B7 ` + _("until %s").format(runtime.endTime);
                    }
                    if ((state === "pomodoro" || state === "pomodoro-paused") && runtime.finishEstimate) {
                        line += ` \u00B7 ` + _("\u2248 finish %s").format(runtime.finishEstimate.time);
                    }
                    this._progressLabel.set_text(line);
                } else if (state === "break-over") {
                    this._progressLabel.set_text(_("Break finished — press Start for focus"));
                } else if (runtime.finishEstimate) {
                    this._progressLabel.set_text(_("Finish your tasks by ~%s").format(runtime.finishEstimate.time));
                } else {
                    this._progressLabel.set_text(_("%d min focus — press Start").format(runtime.focusMinutes || 25));
                }
            }
        }

        this._updateProgressBar(state, progressPercent);

        let badgeAccent = null;
        if (state === "pomodoro" || state === "pomodoro-paused") {
            badgeAccent = this._accentFocusCss;
        } else if (state === "short-break" || state === "long-break" ||
            state === "short-break-paused" || state === "long-break-paused" || state === "break-over") {
            badgeAccent = this._accentBreakCss;
        }

        if (this._stateBadgeLabel) {
            this._stateBadgeLabel.set_text(badge.toUpperCase());
            this._stateBadgeLabel.set_style_class_name(badgeAccent ? "pomodoro-badge" : "pomodoro-badge pomodoro-badge-idle");
            this._stateBadgeLabel.set_style("color: " + (badgeAccent ? this._accentColor(badgeAccent) : this._dimText()) + ";");
        }
        if (this._timeLeftLabel) {
            let tl = timeLeft;
            if (!tl && isIdle) {
                let mins = runtime.focusMinutes || this._focusLength || 25;
                tl = mins + ":00";
            }
            this._timeLeftLabel.set_text(tl || "--:--");
            this._timeLeftLabel.set_style_class_name("pomodoro-time");
            this._timeLeftLabel.set_style("color: " + this._brightTextColor() + ";");
        }
        this._applyThemePalette();

        if (this._taskLabel) {
            let name = task || ((selectedTask && isIdle) ? selectedTask : "");
            if (name) {
                // Markup so the leading focus dot can be rendered smaller.
                this._taskLabel.clutter_text.set_markup(this._taskHeaderText(name));
            } else if (state === "pomodoro-stop") {
                this._taskLabel.clutter_text.set_use_markup(false);
                this._taskLabel.set_text(_("No task yet — tap to choose one"));
            } else {
                this._taskLabel.clutter_text.set_use_markup(false);
                this._taskLabel.set_text(_("Task: none"));
            }
        }

        let listN = (typeof runtime.blockedSitesCount === "number") ? runtime.blockedSitesCount : 0;
        let hostsN = (typeof runtime.blockingHostsCount === "number") ? runtime.blockingHostsCount : 0;
        let sitesText = (runtime.blockingSectionActive && hostsN > 0) ? _("blocking %d").format(hostsN)
            : (listN > 0 ? _("%d in list").format(listN) : _("off"));

        // Idle layout: separate Sites and Preset info rows.
        if (this._sitesLabel) {
            this._sitesLabel.set_text(sitesText);
        }
        if (this._presetSummaryLabel) {
            this._presetSummaryLabel.set_text(activePreset);
        }
        if (this._presetSubmenu && this._presetSubmenu.label) {
            this._presetSubmenu.label.set_text(_("Preset") + ": " + activePreset + this._activePresetRhythm(activePreset));
        }

        // Active layout: single compact "preset · status" row.
        if (this._compactInfoLabel) {
            this._compactInfoLabel.set_text(`${activePreset} \u00B7 ${sitesText}`);
        }




        if (this._chooseTaskItem) {
            this._chooseTaskItem.setSensitive(state === "pomodoro-stop");
        }
        if (this._zenItem && this._zenItem.actor) {
            if (runtime.zenEnabled) {
                this._zenItem.actor.show();
            } else {
                this._zenItem.actor.hide();
            }
        }
        if (this._focusUntilItem && this._focusUntilItem.actor) {
            this._focusUntilItem.actor.show();
        }

        if (this._primaryActionItem) {
            this._primaryActionItem.setSensitive(true);
            if (runtime.timerPaused) {
                let resumeLabel = (state === "short-break-paused" || state === "long-break-paused")
                    ? _("Resume break") : _("Resume focus");
                this._primaryActionItem.setLabel(resumeLabel);
                this._primaryActionItem.setOrnament(PopupMenu.OrnamentType.NONE);
                this._primaryActionMode = "resume";
            } else if (runtime.timerRunning) {
                if (runtime.strictFocus && state === "pomodoro") {
                    // Strict focus: no casual pause — stay with the block.
                    this._primaryActionItem.setLabel(_("Focusing — stay with it"));
                    this._primaryActionItem.setOrnament(PopupMenu.OrnamentType.NONE);
                    this._primaryActionItem.setSensitive(false);
                    this._primaryActionMode = "none";
                } else {
                    this._primaryActionItem.setLabel(state === "pomodoro" ? _("Pause focus") : _("Pause break"));
                    this._primaryActionItem.setOrnament(PopupMenu.OrnamentType.NONE);
                    this._primaryActionMode = "pause";
                }
            } else if (state === "break-over") {
                this._primaryActionItem.setLabel(_("Start next focus"));
                this._primaryActionItem.setOrnament(PopupMenu.OrnamentType.NONE);
                this._primaryActionMode = "start";
            } else {
                this._primaryActionItem.setLabel(_("Start focus"));
                this._primaryActionItem.setOrnament(PopupMenu.OrnamentType.NONE);
                this._primaryActionMode = "start";
            }
            this._stylePrimaryAction();
            this._setPrimaryActionAccent(state);
        }

        if (this._skipTimerItem) {
            let canSkip = Boolean(runtime.timerRunning || runtime.timerPaused);
            if (runtime.strictFocus && state === "pomodoro" && runtime.timerRunning) {
                canSkip = false;
            }
            this._skipTimerItem.setSensitive(canSkip);
        }
        if (this._resetTimerItem) {
            this._resetTimerItem.setSensitive(state !== "pomodoro-stop" || Boolean(runtime.timerRunning || runtime.timerPaused));
        }
    }

    // Returns Pango markup: the leading focus dot is rendered smaller, to match
    // the dot used in the task and preset lists. Dynamic text is markup-escaped.
    _taskHeaderText(fallbackName) {
        let dot = "<span size='60%' rise='1700'>\u25cf</span> ";
        let cur = this._tasks && this._tasks.find((t) => t.id === this._tasksCurrentId);
        if (cur) {
            let s = dot + GLib.markup_escape_text(cur.title || "", -1);
            let dt = cur.doneToday || 0;
            if (cur.est > 0) {
                s += "   " + dt + "/" + cur.est + " \ud83c\udf45";
            } else if (dt > 0) {
                s += "   " + dt + " \ud83c\udf45";
            }
            return s;
        }
        return dot + GLib.markup_escape_text(fallbackName || "", -1);
    }

    setDistractions(list) {
        this._distractions = Array.isArray(list) ? list : [];
        if (this._distractSubmenu) { this._populateDistractions(); }
    }

    _buildDistractEntry() {
        // Built once and kept across refreshes: destroying a focused entry on
        // every add/delete drops the menu's key focus and closes the menu.
        let entryItem = new PopupMenu.PopupBaseMenuItem({ reactive: false });
        let entry = new St.Entry({ style_class: 'run-dialog-entry', can_focus: true, x_expand: true });
        let hint = new St.Label({ text: _("Jot a distraction, press Enter") });
        entry.set_hint_actor(hint);
        this._distractEntry = entry;
        this._distractHint = hint;
        // Hide the placeholder while focused so the caret isn't drawn over it.
        entry.clutter_text.connect('key-focus-in', () => hint.hide());
        entry.clutter_text.connect('key-focus-out', () => { if (!entry.get_text()) { hint.show(); } });
        // Enter adds and keeps the menu open (deferred so the rebuild is safe).
        entry.clutter_text.connect('key-press-event', (a, ev) => {
            let sym = ev.get_key_symbol();
            if (sym === Clutter.KEY_Return || sym === Clutter.KEY_KP_Enter) {
                let t = entry.get_text();
                if (t && t.trim()) {
                    entry.set_text("");
                    GLib.idle_add(GLib.PRIORITY_DEFAULT, () => { this.emit('add-distraction', t); return GLib.SOURCE_REMOVE; });
                }
                return true;
            }
            return false;
        });
        entryItem.addActor(entry, { expand: true, span: -1 });
        this._distractSubmenu.menu.addMenuItem(entryItem);
    }

    _populateDistractions() {
        if (!this._distractSubmenu) { return; }
        // Rebuild only the list rows; the persistent entry item is left alone so
        // focus is kept and the menu stays open after add/delete.
        if (this._distractListItems) {
            for (let it of this._distractListItems) { try { it.destroy(); } catch (e) {} }
        }
        this._distractListItems = [];
        let items = this._distractions || [];
        // Review surface: only show the section when there's something captured.
        if (this._distractSubmenu.actor) { this._distractSubmenu.actor.visible = (items.length > 0); }

        for (let d of items) {
            let item = new PopupMenu.PopupBaseMenuItem();
            let row = new St.BoxLayout({ vertical: false, x_expand: true });
            let lab = new St.Label({ text: "• " + d.text, x_expand: true });
            row.add_child(lab);
            let id = d.id;
            let del = new St.Button({
                style_class: 'pomodoro-task-btn', can_focus: false,
                child: new St.Icon({ icon_name: 'edit-delete-symbolic', icon_size: 14 })
            });
            new Tooltips.Tooltip(del, _("Delete"));
            del.connect('button-press-event', () => true);
            del.connect('button-release-event', (a, ev) => {
                if (ev.get_button() === 1) {
                    GLib.idle_add(GLib.PRIORITY_DEFAULT, () => { this.emit('delete-distraction', id); return GLib.SOURCE_REMOVE; });
                }
                return true;
            });
            row.add_child(del);
            item.addActor(row, { expand: true, span: -1 });
            this._distractSubmenu.menu.addMenuItem(item);
            this._distractListItems.push(item);
        }
        if (items.length) {
            let sep = new PopupMenu.PopupSeparatorMenuItem();
            this._distractSubmenu.menu.addMenuItem(sep);
            this._distractListItems.push(sep);
            let clear = new PopupMenu.PopupMenuItem(_("Clear all"));
            clear.connect('activate', () => this.emit('clear-distractions'));
            this._distractSubmenu.menu.addMenuItem(clear);
            this._distractListItems.push(clear);
        }
        if (this._distractSubmenu.label) {
            this._distractSubmenu.label.set_text(_("Distractions") + (items.length ? " (" + items.length + ")" : ""));
        }
    }

    setTasks(list, currentId, finishText, templates) {
        this._tasks = Array.isArray(list) ? list : [];
        this._tasksCurrentId = currentId || "";
        this._tasksFinishText = finishText || "";
        this._taskTemplates = Array.isArray(templates) ? templates : [];
        this._populateTasksSubmenu();
        if (this._tasksSubmenu && this._tasksSubmenu.label) {
            this._tasksSubmenu.label.set_text(_("Task list"));
        }
    }

    _populateTasksSubmenu() {
        if (!this._tasksSubmenu) {
            return;
        }
        // Destroying the focused row would move key focus out of the menu and
        // close it. Park focus on the stable submenu header first.
        if (this._tasksSubmenu.menu.isOpen && this._tasksSubmenu.actor) {
            this._tasksSubmenu.actor.grab_key_focus();
        }
        this._tasksSubmenu.menu.removeAll();
        this._taskItems = [];
        let add = new PopupMenu.PopupMenuItem(_("Add task…"));
        add.connect('activate', () => this.emit('add-task'));
        this._tasksSubmenu.menu.addMenuItem(add);
        if ((this._tasks || []).length >= 2) {
            let reorder = new PopupMenu.PopupMenuItem(_("Reorder…"));
            reorder.connect('activate', () => this.emit('reorder-tasks'));
            this._tasksSubmenu.menu.addMenuItem(reorder);
        }
        if (this._tasksFinishText) {
            let fin = new PopupMenu.PopupMenuItem(this._tasksFinishText);
            fin.setSensitive(false);
            this._tasksSubmenu.menu.addMenuItem(fin);
        }
        let list = this._tasks || [];
        if (!list.length) {
            let hint = new PopupMenu.PopupMenuItem(_("No tasks yet — add what you'll focus on, with a 🍅 estimate."));
            hint.setSensitive(false);
            hint.label.clutter_text.line_wrap = true;
            hint.label.clutter_text.line_wrap_mode = Pango.WrapMode.WORD_CHAR;
            hint.label.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
            hint.label.set_style("max-width: 25em;");
            this._tasksSubmenu.menu.addMenuItem(hint);
            return;
        }
        this._tasksSubmenu.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        for (let task of list) {
            let t = task;
            let item = new PopupMenu.PopupBaseMenuItem();
            let row = new St.BoxLayout({ vertical: false, x_expand: true });
            let isCurrent = (!t.completed && t.id === this._tasksCurrentId);
            // Fixed-width leading slot keeps every title aligned regardless of
            // which marker (dot / ✓ / none) the row shows.
            let markSlot = new St.BoxLayout({ style: "width: 14px;", y_align: Clutter.ActorAlign.CENTER });
            if (t.completed) {
                let chk = new St.Label({
                    text: "✓", x_expand: true,
                    x_align: Clutter.ActorAlign.CENTER, y_align: Clutter.ActorAlign.CENTER
                });
                chk.set_style("color: " + this._accentColor("rgb(120, 205, 155)") + ";");
                markSlot.add_child(chk);
            } else if (isCurrent) {
                // The familiar dot, just a touch smaller, in the accent colour;
                // it pairs with the bold accent title below.
                let dot = new St.Label({
                    text: "●", x_expand: true,
                    x_align: Clutter.ActorAlign.CENTER, y_align: Clutter.ActorAlign.CENTER,
                    style: "font-size: 0.6em; color: " + this._accentColor("rgb(235, 175, 75)") + ";"
                });
                markSlot.add_child(dot);
            }
            row.add_child(markSlot);
            let dt = t.doneToday || 0;
            let prog = (t.est > 0) ? (dt + "/" + t.est + " 🍅") : (dt > 0 ? (dt + " 🍅") : "");
            let label = new St.Label({ x_expand: true, text: t.title + (prog ? "   " + prog : "") });
            if (isCurrent) {
                // The current focus task: bold + accent so it stands out by weight
                // and colour, matching how it's highlighted in the task dialog.
                label.set_style("font-weight: bold; color: " + this._accentColor("rgb(235, 175, 75)") + ";");
            } else if (t.completed) {
                // Done tasks recede so the live ones read first.
                label.set_style("color: " + this._faintText() + ";");
            }
            row.add_child(label);
            if (t.preset && t.preset.name) {
                let rlab = new St.Label({ text: t.preset.name + " " });
                rlab.set_style("color: " + this._faintText() + "; max-width: 9em;");
                rlab.clutter_text.set_ellipsize(Pango.EllipsizeMode.END);
                row.add_child(rlab);
            }
            let editBtn = new St.Button({
                style_class: "pomodoro-task-btn", can_focus: false,
                child: new St.Icon({ icon_name: "document-edit-symbolic", icon_size: 14 })
            });
            editBtn.connect('clicked', () => { this.emit('task-edit', t.id); return true; });
            new Tooltips.Tooltip(editBtn, _("Edit task"));
            row.add_child(editBtn);
            let doneBtn = new St.Button({
                style_class: "pomodoro-task-btn", can_focus: false,
                child: new St.Icon({ icon_name: t.completed ? "edit-undo-symbolic" : "object-select-symbolic", icon_size: 14 })
            });
            doneBtn.connect('button-release-event', (a, ev) => { if (ev.get_button() === 1) { GLib.idle_add(GLib.PRIORITY_DEFAULT, () => { this.emit('task-complete', t.id); return GLib.SOURCE_REMOVE; }); } return true; });
            new Tooltips.Tooltip(doneBtn, t.completed ? _("Reopen task") : _("Mark done"));
            row.add_child(doneBtn);
            let delBtn = new St.Button({
                style_class: "pomodoro-task-btn", can_focus: false,
                child: new St.Icon({ icon_name: "edit-delete-symbolic", icon_size: 14 })
            });
            delBtn.connect('button-release-event', (a, ev) => { if (ev.get_button() === 1) { GLib.idle_add(GLib.PRIORITY_DEFAULT, () => { this.emit('task-delete', t.id); return GLib.SOURCE_REMOVE; }); } return true; });
            new Tooltips.Tooltip(delBtn, _("Delete task"));
            row.add_child(delBtn);
            item.addActor(row, { expand: true, span: -1 });
            item.connect('activate', () => this.emit('select-task', t.id));
            this._tasksSubmenu.menu.addMenuItem(item);
            this._taskItems.push({ item: item, task: t });
        }
    }


    setPresets(list, activeName) {
        this._presets = Array.isArray(list) ? list : [];
        if (typeof activeName === "string") {
            this._presetState.activePreset = activeName;
        }
        this._populatePresetSubmenu();
        this._applyCachedPreset();
    }

    _presetItemLabel(p) {
        return p.name + "   " + p.pomodoro + "/" + p.short_break + "/" + p.long_break + "  \u00d7" + p.pomodori;
    }

    // Active preset's "focus/short/long" rhythm, for the collapsed Preset row.
    _activePresetRhythm(name) {
        let list = (this._presets && this._presets.length) ? this._presets : [];
        let p = list.find(x => x.name === name);
        return p ? ("  \u00b7  " + p.pomodoro + "/" + p.short_break + "/" + p.long_break) : "";
    }

    _populatePresetSubmenu() {
        if (!this._presetSubmenu) {
            return;
        }
        // Like the task list: park focus on the header before rebuilding so
        // destroying the focused row doesn't close the menu.
        if (this._presetSubmenu.menu.isOpen && this._presetSubmenu.actor) {
            this._presetSubmenu.actor.grab_key_focus();
        }
        this._presetSubmenu.menu.removeAll();
        this._presetItems = [];
        this._presetEditPending = false;
        let active = this._presetState ? this._presetState.activePreset : "";
        let list = (this._presets && this._presets.length) ? this._presets : [
            { name: "Classic", pomodoro: 25, short_break: 5, long_break: 15, pomodori: 4 },
            { name: "Long focus", pomodoro: 50, short_break: 10, long_break: 20, pomodori: 4 }
        ];
        let add = new PopupMenu.PopupMenuItem(_("Add preset…"));
        add.connect('activate', () => this.emit('preset-add'));
        this._presetSubmenu.menu.addMenuItem(add);
        if (list.length >= 2) {
            let reorderP = new PopupMenu.PopupMenuItem(_("Reorder…"));
            reorderP.connect('activate', () => this.emit('reorder-presets'));
            this._presetSubmenu.menu.addMenuItem(reorderP);
        }
        this._presetSubmenu.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        for (let i = 0; i < list.length; i++) {
            let preset = list[i];
            let idx = i;
            let item = new PopupMenu.PopupBaseMenuItem();
            let row = new St.BoxLayout({ vertical: false, x_expand: true });
            let isActive = (preset.name === active);
            // Mirror the task list: a fixed 14px slot with a centred, smaller dot
            // keeps preset names aligned and the marker vertically centred.
            let markSlot = new St.BoxLayout({ style: "min-width: 14px;", y_align: Clutter.ActorAlign.CENTER });
            // Dot is always present (transparent when inactive) so active and
            // inactive rows are exactly the same width — no indent jump.
            let mark = new St.Label({
                text: "●", x_expand: true,
                x_align: Clutter.ActorAlign.CENTER, y_align: Clutter.ActorAlign.CENTER,
                style: "font-size: 0.6em; color: " + (isActive ? this._accentColor("rgb(235, 175, 75)") : "rgba(0,0,0,0)") + ";"
            });
            markSlot.add_child(mark);
            row.add_child(markSlot);
            let label = new St.Label({ x_expand: true, text: this._presetItemLabel(preset) });
            if (isActive) {
                // Same emphasis as the current task in the task list.
                label.set_style("font-weight: bold; color: " + this._accentColor("rgb(235, 175, 75)") + ";");
            }
            row.add_child(label);
            let editBtn = new St.Button({
                style_class: "pomodoro-task-btn", can_focus: false,
                child: new St.Icon({ icon_name: "document-edit-symbolic", icon_size: 14 })
            });
            editBtn.connect('clicked', () => {
                this._presetEditPending = true;
                this.emit('preset-edit', idx);
                GLib.idle_add(GLib.PRIORITY_DEFAULT, () => { this._presetEditPending = false; return GLib.SOURCE_REMOVE; });
                return true;
            });
            new Tooltips.Tooltip(editBtn, _("Edit preset"));
            row.add_child(editBtn);
            let delBtn = new St.Button({
                style_class: "pomodoro-task-btn", can_focus: false,
                child: new St.Icon({ icon_name: "edit-delete-symbolic", icon_size: 14 })
            });
            delBtn.connect('button-release-event', (a, ev) => { if (ev.get_button() === 1) { GLib.idle_add(GLib.PRIORITY_DEFAULT, () => { this.emit('preset-delete', idx); return GLib.SOURCE_REMOVE; }); } return true; });
            new Tooltips.Tooltip(delBtn, _("Delete preset"));
            row.add_child(delBtn);
            item.addActor(row, { expand: true, span: -1 });
            item.connect('activate', () => {
                if (this._presetEditPending) { this._presetEditPending = false; return; }
                this.emit('apply-preset', preset);
            });
            this._presetSubmenu.menu.addMenuItem(item);
            this._presetItems.push({ item: item, preset: preset, mark: mark, label: label });
        }
    }

    _applyCachedPreset() {
        let preset = this._presetState || {};

        if (this._presetSummaryLabel && preset.activePreset) {
            this._presetSummaryLabel.set_text(preset.activePreset);
        }
        if (this._presetSubmenu && this._presetSubmenu.label && preset.activePreset) {
            this._presetSubmenu.label.set_text(_("Preset") + ": " + preset.activePreset + this._activePresetRhythm(preset.activePreset));
        }
        if (this._compactInfoLabel && preset.activePreset && this._lastRuntimeState) {
            let rt = this._lastRuntimeState;
            let listN = (typeof rt.blockedSitesCount === "number") ? rt.blockedSitesCount : 0;
            let hostsN = (typeof rt.blockingHostsCount === "number") ? rt.blockingHostsCount : 0;
            let t = (rt.blockingSectionActive && hostsN > 0) ? _("blocking %d").format(hostsN)
                : (listN > 0 ? _("%d in list").format(listN) : _("off"));
            this._compactInfoLabel.set_text(`${preset.activePreset} \u00B7 ${t}`);
        }
        let active = preset.activePreset || "";
        for (let entry of (this._presetItems || [])) {
            let on = entry.preset.name === active;
            if (entry.mark) {
                entry.mark.set_style("font-size: 0.6em; color: " + (on ? this._accentColor("rgb(235, 175, 75)") : "rgba(0,0,0,0)") + ";");
            }
            if (entry.label) {
                entry.label.set_style(on
                    ? ("font-weight: bold; color: " + this._accentColor("rgb(235, 175, 75)") + ";")
                    : "font-weight: normal;");
            }
        }
    }

    showPomodoroInProgress(pomodoriNumber) {
        if (typeof pomodoriNumber === "number" && pomodoriNumber > 0) {
            this._pomodoriTotal = pomodoriNumber;
        }
        this._updateCycleIndicator();
    }

    updateCounts(setCount, pomodoroCount) {
        this._pomodoroSetCount = setCount;
        this._pomodoroCount = pomodoroCount;
        this._updateCycleIndicator();
    }
}
