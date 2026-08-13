const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const Pango = imports.gi.Pango;
const GObject = imports.gi.GObject;
const ModalDialog = imports.ui.modalDialog;
const Dialog = imports.ui.dialog;
const DND = imports.ui.dnd;
const CinnamonEntry = imports.ui.cinnamonEntry;
const GLib = imports.gi.GLib;
const Gettext = imports.gettext;

const UUID = "zen-pomodoro@vtestah";
Gettext.bindtextdomain(UUID, GLib.get_user_data_dir() + "/locale");

function _(str) {
    return Gettext.dgettext(UUID, str);
}

var PomodoroFocusTaskDialog = GObject.registerClass({
    GTypeName: `pomodoro_applet_PomodoroFocusTaskDialog_${Date.now()}`,
    Signals: {
        'focus-task-confirmed': { param_types: [GObject.TYPE_STRING] },
        'focus-task-cancelled': {}
    }
}, class PomodoroFocusTaskDialog extends ModalDialog.ModalDialog {
    _init() {
        super._init({destroyOnClose: false});

        // Effective accent (overridden per-open via setTaskList); selection title
        // for the live highlight; and the rows we restyle as it changes.
        this._accentRgb = [227, 90, 60];
        this._taskRows = [];
        this._visibleRows = [];
        this._selectedIndex = -1;

        let content = new Dialog.MessageDialogContent({
            title: _("Focus task"),
            description: _("What are you focusing on?")
        });

        this._entry = new St.Entry({ style_class: 'run-dialog-entry', can_focus: true });
        this._entryHint = new St.Label({ text: _("e.g. Write the report") });
        this._entry.set_hint_actor(this._entryHint);
        this._entry.clutter_text.connect('key-focus-in', () => this._entryHint.hide());
        this._entry.clutter_text.connect('key-focus-out', () => { if (!this._entry.get_text()) { this._entryHint.show(); } });
        CinnamonEntry.addContextMenu(this._entry);
        this._entryText = this._entry.clutter_text;
        // Typing filters the list and re-targets the highlight.
        this._entryText.connect('text-changed', () => this._applyFilter(this._entry.get_text()));
        content.add_child(this._entry);

        // Subtle hint of what Enter will do (start the highlighted task, or — with
        // a leading "+" — create the typed one). Makes the keyboard path obvious.
        this._enterHint = new St.Label({ text: "", style: 'font-size: 0.85em; padding-top: 4px;' });
        this._enterHint.clutter_text.set_ellipsize(Pango.EllipsizeMode.END);
        this._enterHint.set_opacity(150);
        this._enterHint.hide();
        content.add_child(this._enterHint);

        this._hintLabel = new St.Label({
            text: _("Choose or type a focus task"),
            style: 'color: rgba(255, 190, 64, 0.95); padding-top: 6px;'
        });
        this._hintLabel.hide();
        content.add_child(this._hintLabel);

        this._taskListBox = new St.BoxLayout({
            vertical: true,
            x_expand: true,
            style: 'spacing: 6px; padding-top: 8px;'
        });
        // Cap the list height and scroll instead of letting a long task list
        // push the dialog past the screen edge.
        this._taskScroll = new St.ScrollView({ x_expand: true, style: 'max-height: 280px;' });
        this._taskScroll.set_policy(St.PolicyType.NEVER, St.PolicyType.AUTOMATIC);
        this._taskScroll.add_actor(this._taskListBox);
        content.add_child(this._taskScroll);

        this._content = content;
        this.contentLayout.add(content);
        this.setInitialKeyFocus(this._entryText);

        this._entryText.connect('key-press-event', (_actor, event) => {
            let symbol = event.get_key_symbol();
            if (symbol === Clutter.KEY_Return || symbol === Clutter.KEY_KP_Enter) {
                this._confirm();
                return true;
            }
            if (symbol === Clutter.KEY_Down) { this._moveSelection(1); return true; }
            if (symbol === Clutter.KEY_Up) { this._moveSelection(-1); return true; }
            return false;
        });

        this._setDialogButtons(_("Start"));

        // run-dialog-entry is tuned for Cinnamon's always-dark run dialog (light
        // text); on a light theme that text is invisible, so recolour the entry
        // and hint from the dialog's own theme foreground when it opens.
        this.connect('opened', () => this._applyEntryTheme());

        // Softer than a hard modal: a click outside the dialog box cancels it
        // (Esc and Cancel still work). Clicks inside the box are left alone.
        if (this._eventBlocker) {
            this._eventBlocker.connect('button-press-event', (actor, event) => {
                try {
                    let [x, y] = event.get_coords();
                    let [bx, by] = this.dialogLayout.get_transformed_position();
                    let [bw, bh] = this.dialogLayout.get_size();
                    if (x >= bx && x <= bx + bw && y >= by && y <= by + bh) {
                        return Clutter.EVENT_PROPAGATE;
                    }
                } catch (e) {}
                this._cancel();
                return Clutter.EVENT_STOP;
            });
        }
    }

    _applyEntryTheme() {
        if (!this._content) { return; }
        try {
            let c = this._content.get_theme_node().get_foreground_color();
            if (this._entryHint && this._entry) {
                // Placeholder sits inside the entry (which can have its own, e.g.
                // white, background), so dim the entry's text colour — not the
                // dialog's — or it washes out on a light entry.
                let ec = this._entry.get_theme_node().get_foreground_color();
                this._entryHint.set_style("color: rgba(" + ec.red + ", " + ec.green + ", " + ec.blue + ", 0.55);");
            }
            let lum = (0.2126 * c.red + 0.7152 * c.green + 0.0722 * c.blue) / 255;
            if (this._hintLabel) {
                let hint = (lum < 0.5) ? "rgb(150, 92, 8)" : "rgba(255, 190, 64, 0.95)";
                this._hintLabel.set_style("color: " + hint + "; padding-top: 6px;");
            }
        } catch (e) {}
    }

    _setDialogButtons(confirmLabel) {
        this.setButtons([
            { label: _("Cancel"), action: () => { this._cancel(); }, key: Clutter.KEY_Escape },
            { label: confirmLabel, action: () => { this._confirm(); }, default: true }
        ]);
    }

    _applyMode(selectOnly, running) {
        if (this._content) {
            this._content.title = selectOnly ? _("Current task") : _("Focus task");
            this._content.description = selectOnly ? _("Choose a task to focus on") : _("What are you focusing on?");
        }
        this._confirmVerb = selectOnly ? (running ? _("Switch") : _("Select")) : _("Start");
        this._setDialogButtons(this._confirmVerb);
    }

    setTaskList(tasks, currentTitle, requireTask, selectOnly, running, accentRgb) {
        this._taskItems = Array.isArray(tasks) ? tasks : [];
        this._currentTitle = currentTitle || "";
        this._requireTask = Boolean(requireTask);
        if (Array.isArray(accentRgb) && accentRgb.length >= 3) {
            this._accentRgb = [accentRgb[0], accentRgb[1], accentRgb[2]];
        }
        // On open the active task is the highlighted one; typing re-targets it.
        this._applyMode(Boolean(selectOnly), Boolean(running));
        this._reloadTaskList();
        this._hideTaskRequiredHint();
        this._entryText.set_text("");
        // Empty filter: show all rows and preselect the current task (Enter starts it).
        this._applyFilter("");
    }

    _reloadTaskList() {
        if (!this._taskListBox) { return; }
        for (let child of this._taskListBox.get_children()) { child.destroy(); }
        this._taskRows = [];
        let tasks = Array.isArray(this._taskItems) ? this._taskItems : [];
        let active = tasks.filter((t) => !t.completed);
        for (let t of active) {
            // Title fills the row; the preset tag (if any) sits dim to its right.
            // The 🍅 estimate/progress belongs in the Task list, not in this quick
            // picker — keep these rows clean and title-first.
            let row = new St.BoxLayout({ vertical: false, x_expand: true, style: 'spacing: 8px;' });
            let titleLab = new St.Label({
                text: this._clipLabel(t.title), x_expand: true,
                y_align: Clutter.ActorAlign.CENTER
            });
            // Ellipsize on width so long titles degrade to "…" on any dialog width.
            titleLab.clutter_text.set_ellipsize(Pango.EllipsizeMode.END);
            row.add_child(titleLab);
            if (t.preset && t.preset.name) {
                let presetLab = new St.Label({
                    text: t.preset.name, y_align: Clutter.ActorAlign.CENTER,
                    style: 'max-width: 9em;'
                });
                presetLab.set_opacity(140);
                presetLab.clutter_text.set_ellipsize(Pango.EllipsizeMode.END);
                row.add_child(presetLab);
            }

            let button = new St.Button({
                style_class: 'dialog-button', can_focus: true, x_expand: true, reactive: true, child: row,
                style: 'border-radius: 6px;'
            });
            let title = t.title;
            button.connect('clicked', () => { this.close(); this.emit('focus-task-confirmed', title); });
            // Hover gives the rows a clear "clickable" cue without relying on the
            // theme's dialog-button hover, which varies between themes.
            button.connect('notify::hover', () => this._refreshSelection());
            this._taskListBox.add_child(button);
            this._taskRows.push({ button: button, titleLab: titleLab, title: title });
        }
        // Visibility + selection are applied by _applyFilter() (from setTaskList).
    }

    // rgba() built from the applet's effective accent, so the highlight matches
    // the rest of the applet (including a user's custom accent colour).
    _accentTint(alpha) {
        let c = (Array.isArray(this._accentRgb) && this._accentRgb.length >= 3) ? this._accentRgb : [227, 90, 60];
        return 'rgba(' + Math.round(c[0]) + ', ' + Math.round(c[1]) + ', ' + Math.round(c[2]) + ', ' + alpha + ')';
    }

    // Filter the list to rows whose title contains the typed text, pick a
    // sensible default selection, then refresh the highlight + Enter hint.
    _applyFilter(rawText) {
        let text = (rawText || "").replace(/\s+/g, " ").trim().toLowerCase();
        let rows = this._taskRows || [];
        this._visibleRows = [];
        for (let r of rows) {
            let show = !text || (r.title && r.title.toLowerCase().indexOf(text) !== -1);
            if (r.button) { r.button.visible = show; }
            if (show) { this._visibleRows.push(r); }
        }
        let idx = -1;
        if (text) {
            // Auto-select only an exact match; partial matches stay unselected so
            // Enter creates the typed task (use ↑/↓ to pick an existing one).
            idx = this._visibleRows.findIndex((r) => r.title && r.title.toLowerCase() === text);
        } else if (this._currentTitle) {
            idx = this._visibleRows.findIndex((r) => r.title === this._currentTitle);
        }
        this._selectedIndex = idx;
        if (this._taskScroll) { this._taskScroll.visible = (this._visibleRows.length > 0); }
        this._refreshSelection();
        this._updateEnterHint();
        this._scrollSelectedIntoView();
    }

    // Move the highlight through the visible rows (keyboard ↑/↓).
    _moveSelection(delta) {
        let n = this._visibleRows.length;
        if (!n) { return; }
        let i = this._selectedIndex;
        if (i < 0) { i = (delta > 0) ? 0 : n - 1; }
        else { i = (i + delta + n) % n; }
        this._selectedIndex = i;
        this._refreshSelection();
        this._updateEnterHint();
        this._scrollSelectedIntoView();
    }

    _selectedRow() {
        return (this._selectedIndex >= 0 && this._visibleRows[this._selectedIndex])
            ? this._visibleRows[this._selectedIndex] : null;
    }

    // Re-style every row from the current selection + hover. Active and inactive
    // rows share one border-radius; only the background differs.
    _refreshSelection() {
        let sel = this._selectedRow();
        for (let r of this._taskRows || []) {
            if (!r || !r.button) { continue; }
            let selected = (r === sel);
            let hovered = false;
            try { hovered = r.button.hover; } catch (e) {}
            let bg = selected ? (' background-color: ' + this._accentTint(0.16) + ';')
                              : (hovered ? ' background-color: rgba(150, 150, 150, 0.16);' : '');
            r.button.set_style('border-radius: 6px;' + bg);
            if (r.titleLab) { r.titleLab.set_style(selected ? 'font-weight: bold;' : ''); }
        }
    }

    // Tell the user what Enter will do: start the highlighted task, create the
    // typed one (leading "+"), or start the current task.
    _updateEnterHint() {
        if (!this._enterHint) { return; }
        let verb = this._confirmVerb || _("Start");
        let sel = this._selectedRow();
        let text = (this._entry ? this._entry.get_text() : "").replace(/\s+/g, " ").trim();
        let msg = "";
        if (sel) {
            msg = "\u21B5  " + verb + "  \u00AB" + this._clipLabel(sel.title) + "\u00BB";
        } else if (text) {
            msg = "\u21B5  +  \u00AB" + this._clipLabel(text) + "\u00BB";
        } else if (this._currentTitle) {
            msg = "\u21B5  " + verb + "  \u00AB" + this._clipLabel(this._currentTitle) + "\u00BB";
        }
        if (msg) { this._enterHint.set_text(msg); this._enterHint.show(); }
        else { this._enterHint.hide(); }
    }

    // Best-effort: keep the highlighted row visible when navigating a long list.
    _scrollSelectedIntoView() {
        try {
            let r = this._selectedRow();
            if (!r || !r.button || !this._taskScroll) { return; }
            let adj = this._taskScroll.get_vscroll_bar().get_adjustment();
            let box = r.button.get_allocation_box();
            if (box.y1 < adj.value) { adj.value = box.y1; }
            else if (box.y2 > adj.value + adj.page_size) { adj.value = box.y2 - adj.page_size; }
        } catch (e) {}
    }

    _isTaskRequired() {
        return Boolean(this._requireTask);
    }

    _showTaskRequiredHint() {
        if (this._hintLabel) { this._hintLabel.show(); }
        this.setInitialKeyFocus(this._entryText);
        this._entryText.grab_key_focus();
    }

    _hideTaskRequiredHint() {
        if (this._hintLabel) { this._hintLabel.hide(); }
    }

    _clipLabel(task) {
        let maxLength = 48;
        if (task.length <= maxLength) {
            return task;
        }

        return `${task.slice(0, maxLength - 3)}...`;
    }

    _getTask() {
        return this._entryText.get_text().replace(/\s+/g, " ").trim();
    }

    _confirm() {
        let text = this._getTask();
        let sel = this._selectedRow();
        let task;
        if (sel) {
            // A row is highlighted (exact-typed name or chosen with ↑/↓).
            task = sel.title;
        } else if (text) {
            // No match: start/create the typed task as-is.
            task = this._canonicalTitle(text);
        } else {
            task = this._currentTitle || "";
        }
        if (!task && this._isTaskRequired()) {
            this._showTaskRequiredHint();
            return;
        }
        this.close();
        this.emit('focus-task-confirmed', task);
    }

    // Resolve typed text to an existing active task's exact title when it matches
    // case-insensitively (the same set the highlight considers); otherwise return
    // the text unchanged so brand-new tasks are still created as typed.
    _canonicalTitle(text) {
        let t = (text || "").replace(/\s+/g, " ").trim();
        if (!t) { return text; }
        let rows = this._taskRows || [];
        let match = rows.find((r) => r.title && r.title.toLowerCase() === t.toLowerCase());
        return match ? match.title : text;
    }

    _cancel() {
        this.close();
        this.emit('focus-task-cancelled');
    }
});

var PomodoroSetFinishedDialog = GObject.registerClass({
    // The GTypeName must be unique, so we use the current timestamp here to avoid
    // exceptions at runtime when reloading the applet.
    GTypeName: `pomodoro_applet_PomodoroSetFinishedDialog_${Date.now()}`,
    Signals: {
        'switch-off-pomodoro': {},
        'start-new-pomodoro': {},
        'hide-pomodoro-modal': {}
    }
}, class PomodoroSetFinishedDialog extends ModalDialog.ModalDialog {
    _init() {
        super._init({destroyOnClose: false});

        this._content = new Dialog.MessageDialogContent();
        this.contentLayout.add(this._content);

        this.setButtons([
            {
                label: _("Hide"),
                action: () => {
                    this.emit('hide-pomodoro-modal');
                },
                key: Clutter.KEY_Escape,
            },
            {
                label: _("Switch Off Pomodoro"),
                action: () => {
                    this.emit('switch-off-pomodoro');
                }
            },
            {
                label: _("Start a new Pomodoro"),
                action: () => {
                    this.emit('start-new-pomodoro');
                }
            },
        ]);

        this.setDefaultLabels();
    }

    setDefaultLabels() {
        this._content.title = _("Pomodoro set finished, you deserve a break!") + "\n";
        // Reset the time label text
        this._content.description = '';
    }

    setTimeRemaining(timer) {
        let tickCount = timer.getTicksRemaining();

        if (tickCount === 0) {
            this._content.title = _("Your break is over, start another pomodoro!") + "\n";
            this._content.description = '';
            return;
        }

        // Update the time label text based on the time remaining
        this._setTimeLabelText(_("A new pomodoro begins in %s.").format(this._getTimeString(tickCount)));
    }

    _setTimeLabelText(label) {
        this._content.description = label + "\n";
    }

    _getTimeString(totalSeconds) {
        // Convert total seconds to minutes and seconds
        let minutes = parseInt(totalSeconds / 60);
        let seconds = parseInt(totalSeconds % 60);

        let min = Gettext.dngettext(UUID, "%d minute", "%d minutes", minutes).format(minutes);
        let sec = Gettext.dngettext(UUID, "%d second", "%d seconds", seconds).format(seconds);

        return _("%s and %s").format(min, sec);
    }
});

var PomodoroShortBreakFinishedDialog = GObject.registerClass({
    // The GTypeName must be unique, so we use the current timestamp here to avoid
    // exceptions at runtime when reloading the applet.
    GTypeName: `pomodoro_applet_PomodoroShortBreakFinishedDialog_${Date.now()}`,
    Signals: {
        'continue-current-pomodoro': {},
        'pause-pomodoro': {},
    }
}, class PomodoroShortBreakFinishedDialog extends ModalDialog.ModalDialog {
    _init() {
        super._init({destroyOnClose: false});

        this._content = new Dialog.MessageDialogContent();
        this.contentLayout.add(this._content);

        this.setButtons([
            {
                label: _("Pause Pomodoro"),
                action: () => {
                    this.emit('pause-pomodoro');
                }
            },
            {
                label: _("Continue Current Pomodoro"),
                default: true,
                action: () => {
                    this.emit('continue-current-pomodoro');
                }
            },
        ]);

        this.setDefaultLabels();
    }

    setDefaultLabels() {
        this._content.title = _("Short break finished, ready to continue?") + "\n";
        this._content.description = '';
    }
});

var PomodoroFinishedDialog = GObject.registerClass({
    // The GTypeName must be unique, so we use the current timestamp here to avoid
    // exceptions at runtime when reloading the applet.
    GTypeName: `pomodoro_applet_PomodoroFinishedDialog_${Date.now()}`,
    Signals: {
        'continue-current-pomodoro': {},
        'pause-pomodoro': {},
        'extend-pomodoro': {},
    }
}, class PomodoroFinishedDialog extends ModalDialog.ModalDialog {
    _init() {
        super._init({destroyOnClose: false});

        this._content = new Dialog.MessageDialogContent();
        this.contentLayout.add(this._content);

        this._extendMinutes = 0;
        this._buildButtons();
        this.setDefaultLabels();
    }

    setExtend(minutes) {
        this._extendMinutes = (typeof minutes === "number" && minutes > 0) ? minutes : 0;
        this._buildButtons();
    }

    _buildButtons() {
        let buttons = [
            {
                label: _("Pause Pomodoro"),
                action: () => {
                    this.emit('pause-pomodoro');
                }
            },
        ];
        if (this._extendMinutes > 0) {
            buttons.push({
                label: _("Extend +%d min").format(this._extendMinutes),
                action: () => {
                    this.emit('extend-pomodoro');
                }
            });
        }
        buttons.push({
            label: _("Start break"),
            default: true,
            action: () => {
                this.emit('continue-current-pomodoro');
            }
        });
        this.setButtons(buttons);
    }

    setDefaultLabels() {
        this._content.title = _("Pomodoro finished, ready to take a break?") + "\n";
        this._content.description = '';
    }

    setTip(text) {
        this._content.description = text ? (text + "\n") : '';
    }
});

// A modal dialog that lists items as draggable rows; dragging reorders them,
// and "Done" reports the new order. Reused for tasks and presets.
var PomodoroReorderDialog = GObject.registerClass({
    GTypeName: `pomodoro_applet_PomodoroReorderDialog_${Date.now()}`,
}, class PomodoroReorderDialog extends ModalDialog.ModalDialog {
    _init() {
        super._init({ destroyOnClose: false });
        this._onApply = null;

        this._content = new Dialog.MessageDialogContent({
            title: _("Reorder"),
            description: _("Drag the rows to reorder, then press Done.")
        });
        this.contentLayout.add(this._content);

        this._listBox = new St.BoxLayout({
            vertical: true, x_expand: true,
            style: 'spacing: 4px; padding-top: 10px; min-width: 380px;'
        });
        this.contentLayout.add(this._listBox);

        let self = this;
        // The list is the drop target: on drag-over / drop we move the dragged
        // row live to the slot under the pointer (the order lives in the children).
        this._listBox._delegate = {
            handleDragOver: function (source, actor, x, y, time) {
                self._moveRowTo(source, y);
                return DND.DragMotionResult.MOVE_DROP;
            },
            acceptDrop: function (source, actor, x, y, time) {
                self._moveRowTo(source, y);
                return true;
            }
        };

        this.setButtons([
            { label: _("Cancel"), key: Clutter.KEY_Escape, action: () => this.close() },
            { label: _("Done"), default: true, action: () => this._apply() }
        ]);
    }

    // items: [{ key, label }]; onApply(orderedKeys) is called on Done.
    openReorder(title, items, onApply) {
        this._onApply = onApply;
        if (this._content) { this._content.title = title || _("Reorder"); }
        this._buildRows(Array.isArray(items) ? items : []);
        this.open();
    }

    _buildRows(items) {
        for (let c of this._listBox.get_children()) { c.destroy(); }
        for (let it of items) {
            let row = new St.BoxLayout({
                vertical: false, reactive: true, x_expand: true,
                style: 'spacing: 8px; padding: 7px 10px; border-radius: 6px;'
            });
            let handle = new St.Label({ text: "\u2261", y_align: Clutter.ActorAlign.CENTER });
            handle.set_opacity(150);
            row.add_child(handle);
            let lab = new St.Label({ text: it.label, x_expand: true, y_align: Clutter.ActorAlign.CENTER });
            row.add_child(lab);
            row._reorderKey = it.key;
            let label = it.label;
            row._delegate = {
                _key: it.key,
                getDragActor: function () {
                    return new St.Label({
                        text: label,
                        style: 'background-color: rgba(227, 90, 60, 0.92); color: #ffffff; padding: 7px 12px; border-radius: 6px;'
                    });
                },
                getDragActorSource: function () { return row; }
            };
            row._draggable = DND.makeDraggable(row);
            row._draggable.connect('drag-begin', () => { row.set_opacity(45); });
            row._draggable.connect('drag-end', () => { row.set_opacity(255); });
            row._draggable.connect('drag-cancelled', () => { row.set_opacity(255); });
            this._listBox.add_child(row);
        }
    }

    // Move the dragged row to the slot under pointer-y (list-local coordinates).
    _moveRowTo(source, y) {
        if (!source || typeof source.getDragActorSource !== 'function') { return; }
        let row = source.getDragActorSource();
        let children = this._listBox.get_children();
        if (children.indexOf(row) < 0) { return; }
        let idx = 0;
        for (let c of children) {
            if (c === row) { continue; }
            if (c.y + c.height / 2 < y) { idx++; } else { break; }
        }
        if (children.indexOf(row) !== idx) {
            this._listBox.set_child_at_index(row, idx);
        }
    }

    _apply() {
        let order = this._listBox.get_children().map((c) => c._reorderKey);
        let cb = this._onApply;
        this.close();
        if (typeof cb === 'function') { try { cb(order); } catch (e) {} }
    }
});
