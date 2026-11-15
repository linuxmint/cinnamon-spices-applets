// widgets/todoWidget.js
'use strict';

const St = imports.gi.St;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Clutter = imports.gi.Clutter;
const Gtk = imports.gi.Gtk;
const Mainloop = imports.mainloop;
const WidgetBase = require('./widgets/widgetBase');

const DEFAULT_LOCAL_DIR = GLib.get_home_dir() + '/.config/wintenmenu';
const DEFAULT_LOCAL_FILE = DEFAULT_LOCAL_DIR + '/todo.json';

class TodoWidget extends WidgetBase {
    constructor(tileData, applet) {
        super(tileData, applet);
        this._lastData = null;
        this._lastFetchTime = 0;
        this._addTaskModal = null;

        this._scrollBox = new St.ScrollView({
            hscrollbar_policy: Gtk.PolicyType.NEVER,
            vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
            x_expand: true,
            y_expand: true,
            style_class: 'wintenmenu-widget-scroll'
        });
        this._scrollBox.set_auto_scrolling(true);
        this._scrollBox.connect('scroll-event', (actor, event) => this._onScrollEvent(event));
        this.contentActor.add_child(this._scrollBox);

        this._layoutBox = new St.BoxLayout({
            vertical: true,
            x_expand: true
        });
        this._scrollBox.add_actor(this._layoutBox);
    }

    // ---- Wheel scroll chaining ---------------------------------------------
    // St.ScrollView consumes wheel events even when its own list cannot move,
    // so the tile area would stop scrolling while the pointer is over this
    // tile. Scroll the task list first, then hand the event to the tiles.

    _onScrollEvent(event) {
        const direction = event.get_scroll_direction();
        let delta = 0;

        if (direction === Clutter.ScrollDirection.SMOOTH) {
            const [, dy] = event.get_scroll_delta();
            if (!dy) return Clutter.EVENT_PROPAGATE;
            delta = dy;
        } else if (direction === Clutter.ScrollDirection.UP) {
            delta = -1;
        } else if (direction === Clutter.ScrollDirection.DOWN) {
            delta = 1;
        } else {
            return Clutter.EVENT_PROPAGATE;
        }

        if (this._innerCanScroll(delta)) return Clutter.EVENT_PROPAGATE;

        const outer = this._getOuterScrollView();
        if (!outer) return Clutter.EVENT_PROPAGATE;

        outer.emit('scroll-event', event);
        return Clutter.EVENT_STOP;
    }

    _innerCanScroll(delta) {
        const adj = this._scrollBox.vscroll ? this._scrollBox.vscroll.adjustment : null;
        if (!adj) return false;
        if (delta > 0) return adj.value < adj.upper - adj.page_size - 0.5;
        return adj.value > adj.lower + 0.5;
    }

    _getOuterScrollView() {
        let actor = this.contentActor.get_parent();
        while (actor) {
            if (actor instanceof St.ScrollView) return actor;
            actor = actor.get_parent();
        }
        return null;
    }

    _getLocalFilePath() {
        const config = this.tileData.config || {};
        let path = (config.filePath || '').trim() || DEFAULT_LOCAL_FILE;
        return path.replace('~', GLib.get_home_dir());
    }

    _loadLocalData() {
        const path = this._getLocalFilePath();
        let rawData = { list: 'ToDo', tasks: [] };

        try {
            if (GLib.file_test(path, GLib.FileTest.EXISTS)) {
                let [ok, contents] = GLib.file_get_contents(path);
                if (ok) {
                    let text = typeof contents === 'string'
                        ? contents
                        : new TextDecoder('utf-8').decode(contents);
                    rawData = JSON.parse(text);
                }
            } else {
                this._saveLocalData(rawData);
            }
        } catch (e) {
            global.logWarning('TodoWidget: Error loading local JSON file ' + path + ': ' + e);
        }

        const allTasks = Array.isArray(rawData.tasks) ? rawData.tasks : [];
        const pendingTasks = allTasks.filter(t => !t.completed);

        return {
            list: rawData.list || 'ToDo',
            count: pendingTasks.length,
            tasks: pendingTasks
        };
    }

    _saveLocalData(data) {
        const path = this._getLocalFilePath();
        try {
            const file = Gio.File.new_for_path(path);
            const parent = file.get_parent();
            if (parent && !parent.query_exists(null)) {
                try { parent.make_directory_with_parents(null); } catch (_) {}
            }
            const content = JSON.stringify(data, null, 2);
            GLib.file_set_contents(path, content);
        } catch (e) {
            global.logWarning('TodoWidget: Error saving local JSON file ' + path + ': ' + e);
        }
    }

    _addLocalTask(title) {
        const text = (title || '').trim();
        if (!text) return;

        const path = this._getLocalFilePath();
        let rawData = { list: 'ToDo', tasks: [] };
        try {
            if (GLib.file_test(path, GLib.FileTest.EXISTS)) {
                let [ok, contents] = GLib.file_get_contents(path);
                if (ok) {
                    let jsonText = typeof contents === 'string'
                        ? contents
                        : new TextDecoder('utf-8').decode(contents);
                    rawData = JSON.parse(jsonText);
                }
            }
        } catch (e) {}

        if (!Array.isArray(rawData.tasks)) {
            rawData.tasks = [];
        }

        rawData.tasks.push({
            id: 'local_' + Date.now(),
            title: text,
            due: '',
            urgency: '',
            completed: false,
            createdAt: new Date().toISOString()
        });

        this._saveLocalData(rawData);
        this.refresh();
    }

    _completeLocalTask(taskId) {
        const path = this._getLocalFilePath();
        let rawData = { list: 'ToDo', tasks: [] };
        try {
            if (GLib.file_test(path, GLib.FileTest.EXISTS)) {
                let [ok, contents] = GLib.file_get_contents(path);
                if (ok) {
                    let jsonText = typeof contents === 'string'
                        ? contents
                        : new TextDecoder('utf-8').decode(contents);
                    rawData = JSON.parse(jsonText);
                }
            }
        } catch (e) {}

        if (Array.isArray(rawData.tasks)) {
            for (let t of rawData.tasks) {
                if (t.id === taskId) {
                    t.completed = true;
                    t.completedAt = new Date().toISOString();
                    break;
                }
            }
        }

        this._saveLocalData(rawData);
        // Force the reload — a plain refresh() can be served from the cached
        // task list, which still contains the task that was just completed.
        Mainloop.timeout_add(300, () => {
            this.refresh(true);
            return GLib.SOURCE_REMOVE;
        });
    }

    _renameLocalTask(taskId, newTitle) {
        const text = (newTitle || '').trim();
        if (!text) return;

        const path = this._getLocalFilePath();
        let rawData = { list: 'ToDo', tasks: [] };
        try {
            if (GLib.file_test(path, GLib.FileTest.EXISTS)) {
                let [ok, contents] = GLib.file_get_contents(path);
                if (ok) {
                    let jsonText = typeof contents === 'string'
                        ? contents
                        : new TextDecoder('utf-8').decode(contents);
                    rawData = JSON.parse(jsonText);
                }
            }
        } catch (e) {}

        if (Array.isArray(rawData.tasks)) {
            for (let t of rawData.tasks) {
                if (t.id === taskId) {
                    t.title = text;
                    t.updatedAt = new Date().toISOString();
                    break;
                }
            }
        }

        this._saveLocalData(rawData);
        this.refresh();
    }

    _openRenameTaskModal(task) {
        if (!task) return;
        if (this.applet._settingsPopover) {
            try { this.applet._settingsPopover.close(); } catch(e) {}
        }
        if (this._addTaskModal) {
            try { this._closeAddTaskModal(); } catch(e) {}
        }

        const modal = new St.BoxLayout({
            vertical: true,
            reactive: true,
            style: 'background-color: #1c1c1c; border: 1px solid rgba(255,255,255,0.15); border-radius: 10px; padding: 18px 20px; min-width: 280px; max-width: 340px;'
        });
        this._addTaskModal = modal;
        this.applet._settingsPopover = this;
        this.applet._settingsPopoverActor = modal;

        modal.connect('button-press-event', () => Clutter.EVENT_STOP);
        modal.connect('button-release-event', () => Clutter.EVENT_STOP);

        // Header
        const headerRow = new St.BoxLayout({ vertical: false, style: 'margin-bottom: 12px;' });
        modal.add_child(headerRow);

        headerRow.add_child(new St.Label({
            text: 'Rename Task',
            x_expand: true,
            style: 'color: white; font-size: 13px; font-weight: bold; font-family: "Inter", sans-serif;'
        }));

        const closeBtn = new St.Button({
            label: '✕',
            reactive: true,
            style: 'color: rgba(255,255,255,0.5); font-size: 13px; background-color: transparent; padding: 0 2px;'
        });
        closeBtn.connect('enter-event', () => { closeBtn.style = 'color: white; font-size: 13px; background-color: transparent; padding: 0 2px;'; });
        closeBtn.connect('leave-event', () => { closeBtn.style = 'color: rgba(255,255,255,0.5); font-size: 13px; background-color: transparent; padding: 0 2px;'; });
        closeBtn.connect('button-press-event', () => Clutter.EVENT_STOP);
        closeBtn.connect('button-release-event', (actor, event) => {
            this._closeAddTaskModal();
            return Clutter.EVENT_STOP;
        });
        headerRow.add_child(closeBtn);

        // Task Name Input Entry (pre-filled with current title)
        const entry = new St.Entry({
            text: task.title || '',
            hint_text: 'Enter new title...',
            can_focus: true,
            x_expand: true,
            style: 'background-color: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; padding: 7px 10px; color: white; font-size: 12px; font-family: "Inter", sans-serif; margin-bottom: 14px;'
        });
        modal.add_child(entry);

        // Action Buttons Row
        const btnRow = new St.BoxLayout({
            vertical: false,
            style: 'spacing: 8px;',
            x_align: Clutter.ActorAlign.END
        });
        modal.add_child(btnRow);

        const cancelBtn = new St.Button({
            label: 'Cancel',
            reactive: true,
            style: 'background-color: rgba(255,255,255,0.07); color: rgba(255,255,255,0.8); padding: 6px 14px; border-radius: 6px; font-size: 11px; border: 1px solid rgba(255,255,255,0.12); font-family: "Inter", sans-serif;'
        });
        cancelBtn.connect('enter-event', () => { cancelBtn.style = 'background-color: rgba(255,255,255,0.14); color: white; padding: 6px 14px; border-radius: 6px; font-size: 11px; border: 1px solid rgba(255,255,255,0.2); font-family: "Inter", sans-serif;'; });
        cancelBtn.connect('leave-event', () => { cancelBtn.style = 'background-color: rgba(255,255,255,0.07); color: rgba(255,255,255,0.8); padding: 6px 14px; border-radius: 6px; font-size: 11px; border: 1px solid rgba(255,255,255,0.12); font-family: "Inter", sans-serif;'; });
        cancelBtn.connect('button-press-event', () => Clutter.EVENT_STOP);
        cancelBtn.connect('button-release-event', (actor, event) => {
            this._closeAddTaskModal();
            return Clutter.EVENT_STOP;
        });
        btnRow.add_child(cancelBtn);

        const submitRename = () => {
            const val = entry.get_text();
            this._closeAddTaskModal();
            if (val && val.trim().length > 0 && val.trim() !== task.title) {
                this._renameLocalTask(task.id, val.trim());
            }
        };

        const okBtn = new St.Button({
            label: 'OK',
            reactive: true,
            style: 'background-color: #0078D4; color: white; padding: 6px 16px; border-radius: 6px; font-size: 11px; font-weight: bold; font-family: "Inter", sans-serif;'
        });
        okBtn.connect('enter-event', () => { okBtn.style = 'background-color: #1084e4; color: white; padding: 6px 16px; border-radius: 6px; font-size: 11px; font-weight: bold; font-family: "Inter", sans-serif;'; });
        okBtn.connect('leave-event', () => { okBtn.style = 'background-color: #0078D4; color: white; padding: 6px 16px; border-radius: 6px; font-size: 11px; font-weight: bold; font-family: "Inter", sans-serif;'; });
        okBtn.connect('button-press-event', () => Clutter.EVENT_STOP);
        okBtn.connect('button-release-event', (actor, event) => {
            submitRename();
            return Clutter.EVENT_STOP;
        });
        btnRow.add_child(okBtn);

        entry.clutter_text.connect('key-press-event', (actor, event) => {
            const sym = event.get_key_symbol();
            if (sym === Clutter.KEY_Return || sym === Clutter.KEY_KP_Enter) {
                submitRename();
                return Clutter.EVENT_STOP;
            }
            if (sym === Clutter.KEY_Escape) {
                this._closeAddTaskModal();
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        });

        if (this.applet._menuContainer) {
            modal.hide();
            this.applet._menuContainer.add_actor(modal);
            this.applet._settingsPopoverActor = modal;
            GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
                if (!modal || !modal.get_parent()) return GLib.SOURCE_REMOVE;
                const W = (this.applet.settings.customMenuWidth || 940) * global.ui_scale;
                const H = (this.applet.settings.customMenuHeight || 640) * global.ui_scale;
                const [,, mw, mh] = modal.get_preferred_size();
                const pw = mw || 280;
                const ph = mh || 150;
                modal.set_position(Math.round((W - pw) / 2), Math.round((H - ph) / 2));
                modal.show();
                global.stage.set_key_focus(entry.clutter_text);
                return GLib.SOURCE_REMOVE;
            });
        }
    }

    _openAddTaskModal() {
        if (this.applet._settingsPopover) {
            try { this.applet._settingsPopover.close(); } catch(e) {}
        }
        if (this._addTaskModal) {
            try { this._closeAddTaskModal(); } catch(e) {}
        }

        const modal = new St.BoxLayout({
            vertical: true,
            reactive: true,
            style: 'background-color: #1c1c1c; border: 1px solid rgba(255,255,255,0.15); border-radius: 10px; padding: 18px 20px; min-width: 280px; max-width: 340px;'
        });
        this._addTaskModal = modal;
        this.applet._settingsPopover = this;
        this.applet._settingsPopoverActor = modal;

        modal.connect('button-press-event', () => Clutter.EVENT_STOP);
        modal.connect('button-release-event', () => Clutter.EVENT_STOP);

        // Header
        const headerRow = new St.BoxLayout({ vertical: false, style: 'margin-bottom: 12px;' });
        modal.add_child(headerRow);

        headerRow.add_child(new St.Label({
            text: 'Add New Task',
            x_expand: true,
            style: 'color: white; font-size: 13px; font-weight: bold; font-family: "Inter", sans-serif;'
        }));

        const closeBtn = new St.Button({
            label: '✕',
            reactive: true,
            style: 'color: rgba(255,255,255,0.5); font-size: 13px; background-color: transparent; padding: 0 2px;'
        });
        closeBtn.connect('enter-event', () => { closeBtn.style = 'color: white; font-size: 13px; background-color: transparent; padding: 0 2px;'; });
        closeBtn.connect('leave-event', () => { closeBtn.style = 'color: rgba(255,255,255,0.5); font-size: 13px; background-color: transparent; padding: 0 2px;'; });
        closeBtn.connect('button-press-event', () => Clutter.EVENT_STOP);
        closeBtn.connect('button-release-event', (actor, event) => {
            this._closeAddTaskModal();
            return Clutter.EVENT_STOP;
        });
        headerRow.add_child(closeBtn);

        // Task Name Input Entry
        const entry = new St.Entry({
            hint_text: 'Enter task name...',
            can_focus: true,
            x_expand: true,
            style: 'background-color: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; padding: 7px 10px; color: white; font-size: 12px; font-family: "Inter", sans-serif; margin-bottom: 14px;'
        });
        modal.add_child(entry);

        // Action Buttons Row
        const btnRow = new St.BoxLayout({
            vertical: false,
            style: 'spacing: 8px;',
            x_align: Clutter.ActorAlign.END
        });
        modal.add_child(btnRow);

        const cancelBtn = new St.Button({
            label: 'Cancel',
            reactive: true,
            style: 'background-color: rgba(255,255,255,0.07); color: rgba(255,255,255,0.8); padding: 6px 14px; border-radius: 6px; font-size: 11px; border: 1px solid rgba(255,255,255,0.12); font-family: "Inter", sans-serif;'
        });
        cancelBtn.connect('enter-event', () => { cancelBtn.style = 'background-color: rgba(255,255,255,0.14); color: white; padding: 6px 14px; border-radius: 6px; font-size: 11px; border: 1px solid rgba(255,255,255,0.2); font-family: "Inter", sans-serif;'; });
        cancelBtn.connect('leave-event', () => { cancelBtn.style = 'background-color: rgba(255,255,255,0.07); color: rgba(255,255,255,0.8); padding: 6px 14px; border-radius: 6px; font-size: 11px; border: 1px solid rgba(255,255,255,0.12); font-family: "Inter", sans-serif;'; });
        cancelBtn.connect('button-press-event', () => Clutter.EVENT_STOP);
        cancelBtn.connect('button-release-event', (actor, event) => {
            this._closeAddTaskModal();
            return Clutter.EVENT_STOP;
        });
        btnRow.add_child(cancelBtn);

        const submitTask = () => {
            const val = entry.get_text();
            this._closeAddTaskModal();
            if (val && val.trim().length > 0) {
                this._addLocalTask(val.trim());
            }
        };

        const okBtn = new St.Button({
            label: 'OK',
            reactive: true,
            style: 'background-color: #0078D4; color: white; padding: 6px 16px; border-radius: 6px; font-size: 11px; font-weight: bold; font-family: "Inter", sans-serif;'
        });
        okBtn.connect('enter-event', () => { okBtn.style = 'background-color: #1084e4; color: white; padding: 6px 16px; border-radius: 6px; font-size: 11px; font-weight: bold; font-family: "Inter", sans-serif;'; });
        okBtn.connect('leave-event', () => { okBtn.style = 'background-color: #0078D4; color: white; padding: 6px 16px; border-radius: 6px; font-size: 11px; font-weight: bold; font-family: "Inter", sans-serif;'; });
        okBtn.connect('button-press-event', () => Clutter.EVENT_STOP);
        okBtn.connect('button-release-event', (actor, event) => {
            submitTask();
            return Clutter.EVENT_STOP;
        });
        btnRow.add_child(okBtn);

        entry.clutter_text.connect('key-press-event', (actor, event) => {
            const sym = event.get_key_symbol();
            if (sym === Clutter.KEY_Return || sym === Clutter.KEY_KP_Enter) {
                submitTask();
                return Clutter.EVENT_STOP;
            }
            if (sym === Clutter.KEY_Escape) {
                this._closeAddTaskModal();
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        });

        if (this.applet._menuContainer) {
            modal.hide();
            this.applet._menuContainer.add_actor(modal);
            this.applet._settingsPopoverActor = modal;
            GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
                if (!modal || !modal.get_parent()) return GLib.SOURCE_REMOVE;
                const W = (this.applet.settings.customMenuWidth || 940) * global.ui_scale;
                const H = (this.applet.settings.customMenuHeight || 640) * global.ui_scale;
                const [,, mw, mh] = modal.get_preferred_size();
                const pw = mw || 280;
                const ph = mh || 150;
                modal.set_position(Math.round((W - pw) / 2), Math.round((H - ph) / 2));
                modal.show();
                global.stage.set_key_focus(entry.clutter_text);
                return GLib.SOURCE_REMOVE;
            });
        }
    }

    _closeAddTaskModal() {
        if (this.applet._settingsPopover === this) {
            this.applet._settingsPopover = null;
        }
        if (this._addTaskModal && this.applet._settingsPopoverActor === this._addTaskModal) {
            this.applet._settingsPopoverActor = null;
        }
        if (this._addTaskModal) {
            // CRITICAL: Transfer key focus to menu.actor BEFORE destroying the modal.
            // Destroying the modal while it holds key focus causes Clutter to set
            // key_focus=null, which fires PopupMenuManager._onKeyFocusChanged,
            // which then calls _closeMenu() because null is not inside menu.actor.
            try {
                if (this.applet && this.applet.menu && this.applet.menu.actor) {
                    this.applet.menu.actor.grab_key_focus();
                }
            } catch(e) {}
            try {
                const parent = this._addTaskModal.get_parent();
                if (parent) parent.remove_child(this._addTaskModal);
            } catch(e) {}
            try { this._addTaskModal.destroy(); } catch(e) {}
            this._addTaskModal = null;
        }
    }

    close() {
        this._closeAddTaskModal();
    }

    destroy() {
        this._closeAddTaskModal();
        super.destroy();
    }

    buildUI() {
        this._showLoading();
    }

    refresh(forceRefresh = false) {
        const config = this.tileData.config || {};
        const refreshRate = config.refreshIntervalSec || 60;
        const cacheTTL = Math.max(30000, refreshRate * 1000);

        if (!forceRefresh && this._lastData && (Date.now() - this._lastFetchTime < cacheTTL)) {
            this._renderUI(this._lastData);
            this._scheduleRefresh(refreshRate, () => this.refresh());
            return;
        }

        const data = this._loadLocalData();
        this._lastData = data;
        this._lastFetchTime = Date.now();
        this._renderUI(data);

        this._scheduleRefresh(refreshRate, () => this.refresh());
    }

    _renderUI(data) {
        this._layoutBox.remove_all_children();

        const size = this._getSize();
        this._layoutBox.set_size(size.w - 16, -1);

        const config = this.tileData.config || {};
        const showCompleteBtn = (config.showCompleteBtn !== undefined) ? config.showCompleteBtn : true;
        const showDueChips = (config.showDueChips !== undefined) ? config.showDueChips : true;

        // Root box
        const root = new St.BoxLayout({
            vertical: true,
            style: 'background-color: transparent; padding: 10px 12px;',
            x_expand: true,
            y_expand: true
        });
        this._layoutBox.add_child(root);

        // Header Row
        const header = new St.BoxLayout({
            vertical: false,
            style: 'margin-bottom: 8px;',
            y_align: Clutter.ActorAlign.CENTER
        });
        root.add_child(header);

        header.add_child(new St.Label({
            text: '✓ ' + (data.list || 'ToDo'),
            x_expand: true,
            style: 'color: #ffffff; font-size: 13px; font-weight: bold; font-family: "Inter", sans-serif;'
        }));

        // Replace task count badge with + button at the same position
        const addBtn = new St.Button({
            label: '+',
            reactive: true,
            style: 'color: #ffffff; background-color: rgba(255, 255, 255, 0.15); font-size: 13px; font-weight: bold; border-radius: 10px; padding: 0px 8px; font-family: "Inter", sans-serif;'
        });
        addBtn.connect('enter-event', () => {
            addBtn.style = 'color: #ffffff; background-color: rgba(255, 255, 255, 0.28); font-size: 13px; font-weight: bold; border-radius: 10px; padding: 0px 8px; font-family: "Inter", sans-serif;';
        });
        addBtn.connect('leave-event', () => {
            addBtn.style = 'color: #ffffff; background-color: rgba(255, 255, 255, 0.15); font-size: 13px; font-weight: bold; border-radius: 10px; padding: 0px 8px; font-family: "Inter", sans-serif;';
        });
        addBtn.connect('clicked', () => this._openAddTaskModal());
        header.add_child(addBtn);

        // Divider
        root.add_child(new St.Widget({
            style: 'background-color: rgba(255, 255, 255, 0.08); height: 1px; min-height: 1px; margin-bottom: 8px;'
        }));

        // Tasks List
        const tasks = data.tasks || [];
        if (tasks.length === 0) {
            root.add_child(new St.Label({
                text: "No tasks - you're all caught up! 🎉",
                style: 'color: rgba(255, 255, 255, 0.5); font-size: 12px; font-family: "Inter", sans-serif; padding: 12px 0;'
            }));
            return;
        }

        tasks.forEach((task) => {
            const row = new St.BoxLayout({
                vertical: false,
                style: 'padding: 6px; border-radius: 6px; margin-bottom: 2px;',
                reactive: true,
                track_hover: true,
                y_align: Clutter.ActorAlign.CENTER
            });
            row.connect('enter-event', () => {
                row.style = 'padding: 6px; border-radius: 6px; margin-bottom: 2px; background-color: rgba(255, 255, 255, 0.05);';
            });
            row.connect('leave-event', () => {
                row.style = 'padding: 6px; border-radius: 6px; margin-bottom: 2px;';
            });

            // Check circle button
            if (showCompleteBtn) {
                const checkBtn = new St.Button({
                    style: 'border: 1.5px solid rgba(255, 255, 255, 0.4); background-color: transparent; min-width: 14px; min-height: 14px; border-radius: 7px; padding: 0; margin-right: 8px;',
                    reactive: true
                });
                checkBtn.connect('enter-event', () => {
                    checkBtn.style = 'border: 1.5px solid #ffffff; background-color: rgba(255, 255, 255, 0.15); min-width: 14px; min-height: 14px; border-radius: 7px; padding: 0; margin-right: 8px;';
                });
                checkBtn.connect('leave-event', () => {
                    checkBtn.style = 'border: 1.5px solid rgba(255, 255, 255, 0.4); background-color: transparent; min-width: 14px; min-height: 14px; border-radius: 7px; padding: 0; margin-right: 8px;';
                });
                checkBtn.connect('clicked', () => {
                    checkBtn.style = 'border: 1.5px solid #a8d5a2; background-color: #a8d5a2; min-width: 14px; min-height: 14px; border-radius: 7px; padding: 0; margin-right: 8px;';
                    this._completeLocalTask(task.id);
                });
                row.add_child(checkBtn);
            }

            // Task title
            row.add_child(new St.Label({
                text: task.title || '(No title)',
                x_expand: true,
                y_align: Clutter.ActorAlign.CENTER,
                style: 'color: #ffffff; font-size: 12px; font-family: "Inter", sans-serif;'
            }));

            row.connect('button-press-event', (actor, event) => {
                if (event.get_button() === Clutter.BUTTON_PRIMARY) {
                    if (event.get_click_count() === 2) {
                        this._openRenameTaskModal(task);
                        return Clutter.EVENT_STOP;
                    }
                }
                return Clutter.EVENT_PROPAGATE;
            });

            // Due Chip
            if (showDueChips && task.due && task.due !== '') {
                let chipColor = '#ffffff';
                let chipBg = 'rgba(255, 255, 255, 0.12)';

                if (task.urgency === 'overdue') {
                    chipColor = '#ffb3b0';
                    chipBg = 'rgba(255,179,176,0.18)';
                } else if (task.urgency === 'today') {
                    chipColor = '#ffb874';
                    chipBg = 'rgba(255,184,116,0.18)';
                } else if (task.urgency === 'soon') {
                    chipColor = '#f9de7f';
                    chipBg = 'rgba(249,222,127,0.15)';
                } else if (task.urgency === 'upcoming') {
                    chipColor = '#a8d5a2';
                    chipBg = 'rgba(168,213,162,0.15)';
                } else if (task.urgency === 'future') {
                    chipColor = '#a8c7fa';
                    chipBg = 'rgba(168,199,250,0.15)';
                }

                row.add_child(new St.Label({
                    text: task.due,
                    y_align: Clutter.ActorAlign.CENTER,
                    style: 'color: ' + chipColor + '; background-color: ' + chipBg + '; border-radius: 8px; padding: 1px 6px; font-size: 9px; font-family: "Inter", sans-serif; margin-left: 6px;'
                }));
            }

            root.add_child(row);
        });
    }
}

module.exports = TodoWidget;
