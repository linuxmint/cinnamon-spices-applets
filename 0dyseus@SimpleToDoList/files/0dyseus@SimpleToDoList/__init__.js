const AppletUUID = "0dyseus@SimpleToDoList";
const Gettext = imports.gettext;
const GLib = imports.gi.GLib;
const St = imports.gi.St;
const Lang = imports.lang;
const Clutter = imports.gi.Clutter;
const PopupMenu = imports.ui.popupMenu;
const Gtk = imports.gi.Gtk;
const Tooltips = imports.ui.tooltips;
const Pango = imports.gi.Pango;
const DND = imports.ui.dnd;
const Meta = imports.gi.Meta;

const OrnamentType = {
    NONE: 0,
    CHECK: 1,
    DOT: 2,
    ICON: 3
};

const TODO_LIST_MAX_LENGTH = 100;
const ENTRY_ITEM_MAX_LENGTH = 75;

Gettext.bindtextdomain(AppletUUID, GLib.get_home_dir() + "/.local/share/locale");

function _(aStr) {
    let customTrans = Gettext.dgettext(AppletUUID, aStr);

    if (customTrans !== aStr && aStr !== "")
        return customTrans;

    return Gettext.gettext(aStr);
}

// This is used to create an example tasks list.
// I chose to do this so the example can be localized.
const DefaultExampleTasks = {
    "name": _("Tasks list - Some examples"),
    "sort-tasks-alphabetically": true,
    "sort-tasks-by-completed": true,
    "display-remove-task-buttons": true,
    "keep-completed-tasks-hidden": false,
    "tasks": [{
        "name": _("Tasks can be \"tagged\" by simply writing \"@tagname\" as part of the task text. For now, there are 5 priority tags available."),
        "completed": false
    }, {
        "name": _("This is a @critical priority task"),
        "completed": false
    }, {
        "name": _("This is a @high priority task"),
        "completed": false
    }, {
        "name": _("This is a @medium priority task"),
        "completed": false
    }, {
        "name": _("This is a @today priority task"),
        "completed": false
    }, {
        "name": _("This is a @low priority task"),
        "completed": false
    }]
};

function TaskItem() {
    this._init.apply(this, arguments);
}

TaskItem.prototype = {
    __proto__: PopupMenu.PopupIndicatorMenuItem.prototype,

    _init: function(aApplet, aTask, aInitialOptions) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {
            reactive: true,
            activate: true,
            hover: false,
        });

        this._applet = aApplet;
        this._log = this._applet.pref_logging_enabled;
        this._moved = false;
        this.task = aTask;
        this.isMovable = !aInitialOptions.sort_tasks_alphabetically &&
            !aInitialOptions.sort_tasks_by_completed;
        this.connections = [];

        this._ornament = new St.Bin();
        this.setOrnament(OrnamentType.CHECK, this.task.completed || false);

        // Add an editable label to the layout to display the task
        this._label = new St.Entry({
            text: this.task.name,
            x_expand: true,
            can_focus: true
        });
        this._label.clutter_text.set_single_line_mode(false);
        this._label.clutter_text.set_line_wrap(true);
        this._label.clutter_text.set_line_wrap_mode(Pango.WrapMode.WORD_CHAR);

        // Set custom styles to the entry.
        this._setTaskStyle();

        let del_icon = new St.Icon({
            icon_name: "edit-delete",
            icon_size: 16,
            icon_type: St.IconType.SYMBOLIC,
            style_class: "popup-menu-icon"
        });
        this._del_btn = new St.Button({
            child: del_icon
        });
        this._del_btn.tooltip = new RemoveTaskButtonTooltip(this._del_btn, {
            applet: this._applet,
            is_section: false
        });

        this.addActor(this._ornament, {
            span: 0
        });

        this.addActor(this._del_btn, {
            align: St.Align.START
        });

        this.addActor(this._label, {
            expand: true,
            align: St.Align.START,
            // Setting span to -1 causes the entry to span beyond the right border
            // of the menu on Cinnamon 2.8.x. ¬¬
            span: 1
        });

        // Only make item draggable if none of the sorting options are enabled.
        if (this.isMovable)
            this._draggable = DND.makeDraggable(this.actor);

        // Set initial visibility of the remove task buttons.
        if (!aInitialOptions.display_remove_task_buttons) {
            this._del_btn.set_width(0);
            this._del_btn.hide();
        }

        // Set initial visibility of the task.
        if (aInitialOptions.keep_completed_tasks_hidden && this.task.completed) {
            this.actor.set_height(0);
            this.actor.hide();
        }

        // Create connection for rename and clicks
        let _ct = this._label.get_clutter_text();
        _ct.set_line_wrap(true);

        let conn = _ct.connect("key_focus_in", Lang.bind(this, this._onKeyFocusIn));
        this.connections.push([_ct, conn]);

        conn = _ct.connect("key_focus_out", Lang.bind(this, this._rename));
        this.connections.push([_ct, conn]);

        conn = _ct.connect("key-press-event", Lang.bind(this, this._onKeyPressEvent));
        this.connections.push([_ct, conn]);

        conn = this._ornament.child.connect("clicked", Lang.bind(this, this._setCheckedState));
        this.connections.push([this._ornament.child, conn]);

        conn = this._del_btn.connect("clicked", Lang.bind(this, this._emit_delete));
        this.connections.push([this._del_btn, conn]);

        conn = this.actor.connect("button-release-event", Lang.bind(this, this._onButtonReleaseEvent));
        this.connections.push([this.actor, conn]);
    },

    _onButtonReleaseEvent: function(aActor, aEvent) {
        this.activate(aEvent, true);
        return true;
    },

    getDragActor: function() {
        return new Clutter.Clone({
            source: this.actor
        });
    },

    // Returns the original actor that should align with the actor
    // we show as the item is being dragged.
    getDragActorSource: function() {
        return this.actor;
    },

    _setTaskStyle: function() {
        let backgroundColor = null;
        let color = null;
        // TO TRANSLATORS: This is a priority tag.
        let low = new RegExp("@%s".format(_("low"))),
            // TO TRANSLATORS: This is a priority tag.
            today = new RegExp("@%s".format(_("today"))),
            // TO TRANSLATORS: This is a priority tag.
            medium = new RegExp("@%s".format(_("medium"))),
            // TO TRANSLATORS: This is a priority tag.
            high = new RegExp("@%s".format(_("high"))),
            // TO TRANSLATORS: This is a priority tag.
            critical = new RegExp("@%s".format(_("critical")));

        if (this._applet.pref_tasks_priorities_colors_enabled) {
            if (low.test(this.task.name)) {
                backgroundColor = this._applet.pref_tasks_priorities_low_background;
                color = this._applet.pref_tasks_priorities_low_foreground;
            }

            if (today.test(this.task.name)) {
                backgroundColor = this._applet.pref_tasks_priorities_today_background;
                color = this._applet.pref_tasks_priorities_today_foreground;
            }

            if (medium.test(this.task.name)) {
                backgroundColor = this._applet.pref_tasks_priorities_medium_background;
                color = this._applet.pref_tasks_priorities_medium_foreground;
            }

            if (high.test(this.task.name)) {
                backgroundColor = this._applet.pref_tasks_priorities_high_background;
                color = this._applet.pref_tasks_priorities_high_foreground;
            }

            if (critical.test(this.task.name)) {
                backgroundColor = this._applet.pref_tasks_priorities_critical_background;
                color = this._applet.pref_tasks_priorities_critical_foreground;
            }

            if (this._applet.pref_tasks_priorities_highlight_entire_row) {
                this.actor.set_style(
                    (backgroundColor ? "background-color: " + backgroundColor + ";" : "")
                );
            }
        }

        this._label.set_style(
            (this._applet.pref_tasks_priorities_colors_enabled && color ?
                "color: " + color + ";" :
                "") +
            (this._applet.pref_task_set_bold ?
                "font-weight: bold !important;" :
                "") +
            (this._applet.pref_task_set_min_width !== 0 ?
                "min-width: " + this._applet.pref_task_set_min_width + "px !important;" :
                "") +
            (this._applet.pref_task_set_max_width !== 0 ?
                "max-width: " + this._applet.pref_task_set_max_width + "px !important;" :
                "") +
            "font-size: " + this._applet.pref_task_font_size + "em !important;" +
            (this._applet.pref_task_remove_native_entry_theming ?
                "background: transparent !important;" +
                "background-image: none !important;" +
                (this._applet.pref_tasks_priorities_colors_enabled &&
                    !this._applet.pref_tasks_priorities_highlight_entire_row &&
                    backgroundColor ?
                    "background-color: " + backgroundColor + ";" :
                    "background-color: transparent !important;") +
                "border: none !important;" +
                "border-style: none !important;" +
                "border-image: none !important;" +
                "border-width: 0 !important;" +
                (this._applet.pref_task_remove_native_entry_theming_sizing ?
                    "border-color: transparent !important;" +
                    "border-radius: 0 !important;" +
                    "padding: 0 !important;" +
                    "margin: 0 !important;" : "") :
                (this._applet.pref_tasks_priorities_colors_enabled &&
                    !this._applet.pref_tasks_priorities_highlight_entire_row &&
                    backgroundColor ?
                    "background-color: " + backgroundColor + ";" :
                    "")
            )
        );
    },

    _onStyleChanged: function(aActor) {
        if (this._applet.pref_task_set_custom_spacing !== 0)
            this._spacing = this._applet.pref_task_set_custom_spacing;
        else
            this._spacing = Math.round(aActor.get_theme_node().get_length("spacing"));
    },

    _navigateEntries: function(aDirection) {
        if (aDirection === "up") {
            let prev = this.actor.get_previous_sibling();

            try {
                // "Filter out" hidden/completed tasks.
                while (prev !== null) {
                    if (!prev.get_paint_visibility()) {
                        prev = prev.get_previous_sibling();
                        continue;
                    } else {
                        break;
                    }
                }
            } finally {
                let prev_obj = prev ? prev._delegate : null;

                if (prev_obj && prev_obj instanceof TaskItem && prev_obj._label) {
                    prev_obj._label.grab_key_focus();
                    return true;
                }
            }

            if (this._delegated_section && this._delegated_section._label) {
                this._delegated_section._label.grab_key_focus();
                return true;
            }
        } else if (aDirection === "down") {
            let next = this.actor.get_next_sibling();

            try {
                // "Filter out" hidden/completed tasks.
                while (next !== null) {
                    if (!next.get_paint_visibility()) {
                        next = next.get_next_sibling();
                        continue;
                    } else {
                        break;
                    }
                }
            } finally {
                let next_obj = next ? next._delegate : null;

                if (next_obj && next_obj instanceof TaskItem && next_obj._label) {
                    next_obj._label.grab_key_focus();
                    return true;
                }
            }

            if (this._delegated_section && this._delegated_section.newTaskEntry &&
                this._delegated_section.newTaskEntry.newTask) {
                this._delegated_section.newTaskEntry.newTask.grab_key_focus();
                return true;
            }
        }

        return false;
    },

    _onKeyPressEvent: function(aActor, aEvent) {
        let symbol = aEvent.get_key_symbol();

        // Insert: Jump to the "New task..." entry.
        if (!this.ctrlKey && symbol === Clutter.KEY_Insert) {
            this._delegated_section.newTaskEntry.newTask.grab_key_focus();
            return false;
        }

        // Shift + Delete: deletes the current task entry and focuses the previous task entry or
        // the section entry.
        // Alt + Delete: deletes the current task entry and focuses the next task entry or
        // the new task entry creator.
        // The cursor needs to be inside the task that one wishes to delete.
        if ((this.altKey || this.shiftKey) && symbol === Clutter.Delete) {
            this._log && debug("'remove_task_signal' signal emitted");
            this.emit("remove_task_signal", this.task);
            this._navigateEntries(this.shiftKey ? "up" : "down");
            this.destroy();
            return true;
        }

        // Ctrl + Spacebar: toggle the completed state of the current focused task entry.
        // The cursor needs to be inside the task that one wishes to toggle its completed state.
        if (this.ctrlKey && symbol === Clutter.KEY_space) {
            this._ornament.child.checked = !this.checked;

            // If completed tasks are set to hide, navigate one element up.
            // Otherwise, the entire menu will close due to the loss of focus.
            if (this._delegated_section.section["keep-completed-tasks-hidden"])
                this._navigateEntries("up");

            this._setCheckedState();
            return true;
        }

        // Ctrl + Arrow Down or Arrow Up keys: moves the currently focused task up/down.
        if (this.isMovable && this.ctrlKey &&
            (symbol === Clutter.KEY_Up || symbol === Clutter.KEY_Down)) {
            this._moveItem(symbol === Clutter.KEY_Up ? -1 : 1);
            return true;
        }

        // Arrow Down and Arrow Up keys: triggers a custom navigation that ensures
        // the focus on just the editable entries.
        if (!this.ctrlKey && (symbol === Clutter.KEY_Up || symbol === Clutter.KEY_Down)) {
            this._navigateEntries(symbol === Clutter.KEY_Up ? "up" : "down");
            return true;
        }

        return false;
    },

    _moveItem: function(aDirection) {
        let dir = aDirection === 1 ? "down" : "up";
        let dummy;

        if (dir === "up") {
            dummy = this.actor.get_previous_sibling();
        } else {
            dummy = this.actor.get_next_sibling();
        }

        if (dummy === null)
            return true;

        if (dummy && !(dummy._delegate instanceof TaskItem)) {
            if (dir === "up") {
                dummy = this.actor.get_next_sibling();
            } else {
                dummy = this.actor.get_previous_sibling();
            }
        }

        if (!dummy || !(dummy._delegate instanceof TaskItem))
            return true;

        let children = this._delegated_section.tasksContainer.box.get_children();
        let taskCurPos = children.indexOf(this.actor);
        this.log_ && debug("taskCurPos = " + taskCurPos);

        let taskNewPos = taskCurPos + aDirection;
        this.log_ && debug("taskNewPos = " + taskNewPos);

        if (taskNewPos !== taskCurPos) {
            dummy._delegate._label.grab_key_focus();
            this._delegated_section.tasksContainer.box.remove_actor(this.actor);
            this._delegated_section.tasksContainer.box.insert_actor(this.actor, taskNewPos);
            arrayMove(this._delegated_section.tasks, taskCurPos, taskNewPos);
            this._log && debug("_saveTasks triggered by _moveItem");
            this._delegated_section._saveTasks();
            this._label.grab_key_focus();
        }

        return true;
    },

    _onKeyFocusIn: function(aActor) { // jshint ignore:line
        let _ct = this._label.get_clutter_text();
        _ct.set_selection(0, _ct.text.length);
        this._delegated_section._scrollToItem(this);
    },

    destroy: function() {
        for (let i = this.connections.length - 1; i >= 0; i--) {
            // Just in case. See TasksListItem.destroy()
            try {
                this.connections[i][0].disconnect(this.connections[i][1]);
            } catch (aErr) {
                continue;
            }
        }

        this.connections.length = 0;

        this.actor.destroy();
    },

    isEntry: function() {
        return false;
    },

    _emit_delete: function() {
        if (this._applet.pref_use_fail_safe && !this.ctrlKey) {
            return;
        } else {
            this._log && debug("'remove_task_signal' signal emitted");
            this.emit("remove_task_signal", this.task);
            this.destroy();
        }
    },

    _setCheckedState: function() {
        let completed = this.checked;

        // Return if completed state wasn't changed.
        if (completed === this.task.completed)
            return;

        this._applet.request_rebuild = true;

        this._ornament.child._delegate.setToggleState(completed);

        this._log && debug("Set task completed state " + this.task.name + " to " + completed);

        this.task.completed = completed;
        this._log && debug("'completed_state_changed' signal emitted");
        this.emit("completed_state_changed");

        this._delegated_section._set_text();

        if (this._delegated_section.section["keep-completed-tasks-hidden"] && this.task.completed) {
            this.actor.set_height(0);
            this.actor.hide();
        }
    },

    _rename: function() {
        // Rename the task and notify the ToDo list so it is updated.
        let name = this._label.get_text();

        // Return if the name did not changed or is not set
        if (name == this.task.name || name.length === 0)
            return;

        this._log && debug("Rename task " + this.task.name + " to " + name);

        this.task.name = name;

        if (this.tooltip)
            this._setTooltip();

        this._setTaskStyle();

        this._applet.request_rebuild = true;

        this._log && debug("'name_changed' signal emitted");
        this.emit("name_changed");
    },

    _setTooltip: function() {
        this.tooltip.set_text(this.task.name);
    },

    get checked() {
        return this._ornament.child.checked;
    },

    get ctrlKey() {
        return (Clutter.ModifierType.CONTROL_MASK & global.get_pointer()[2]) !== 0;
    },

    get shiftKey() {
        return (Clutter.ModifierType.SHIFT_MASK & global.get_pointer()[2]) !== 0;
    },

    get altKey() {
        return (Clutter.ModifierType.MOD1_MASK & global.get_pointer()[2]) !== 0;
    },
};

function NewTaskEntry() {
    this._init.apply(this, arguments);
}

NewTaskEntry.prototype = {
    __proto__: PopupMenu.PopupSubMenuMenuItem.prototype,

    _init: function(aApplet) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {
            reactive: false,
            activate: false,
            hover: false,
        });

        this._applet = aApplet;
        this._log = aApplet._log;
        this.connections = [];

        // Add a text entry in the BaseMenuItem layout
        this.newTask = new St.Entry({
            hint_text: _("New task..."),
            x_expand: true,
            track_hover: true,
            can_focus: true
        });

        let icon = new St.Icon({
            icon_name: "system-run",
            icon_size: 16,
            icon_type: St.IconType.SYMBOLIC,
            style_class: "popup-menu-icon"
        });
        this.opt_btn = new St.Button({
            child: icon
        });
        this.opt_btn.tooltip = new MyTooltip(this.opt_btn, _("Tasks list options"));

        this.addActor(this.opt_btn, {
            align: St.Align.START,
            expand: false,
            span: 0
        });
        this.addActor(this.newTask, {
            align: St.Align.START,
            expand: true,
            span: -1
        });

        let _ct = this.newTask.get_clutter_text();
        _ct.set_max_length(ENTRY_ITEM_MAX_LENGTH);

        // Callback to add section when ENTER is press
        let conn = _ct.connect("key-press-event", Lang.bind(this, this._onKeyPressEvent));
        this.connections.push([_ct, conn]);

        conn = _ct.connect("key_focus_in", Lang.bind(this, this._onKeyFocusIn));
        this.connections.push([_ct, conn]);

        conn = this.opt_btn.connect("clicked", Lang.bind(this, this.toggleMenu));
        this.connections.push([this.opt_btn, conn]);
    },

    // This function was the only thing that I could come up with to overcome the absolutely
    // retarded behavior of a sub-menu item inside another sub-menu item.
    toggleMenu: function(aActor, aEvent) { // jshint ignore:line
        this.newTask.grab_key_focus();

        let children = this.menu._getMenuItems();

        let lastChild = children[children.length - 1];

        if (lastChild) {
            if (lastChild instanceof TaskItem) {
                this._buildMenu();
            } else {
                this.menu.box.remove_actor(lastChild.actor);
            }
        }
    },

    _buildMenu: function() {
        let contextMenu = new PopupMenu.PopupMenuSection();
        contextMenu.actor.set_style_class_name("popup-sub-menu");

        this.menu.addMenuItem(contextMenu);

        let section = this._delegated_section.section;

        let exportSection = new PopupMenu.PopupMenuItem(
            _("Export this tasks list")
        );
        contextMenu.addMenuItem(exportSection);

        this.saveSectionAsToDo = new PopupMenu.PopupMenuItem(
            _("Save this tasks list as TODO")
        );
        contextMenu.addMenuItem(this.saveSectionAsToDo);

        let sortAlphaSwitch = new PopupMenu.PopupSwitchMenuItem(
            _("Sort tasks alphabetically"),
            section["sort-tasks-alphabetically"]
        );
        sortAlphaSwitch.tooltip = new MyTooltip(
            sortAlphaSwitch.actor,
            _("Takes effect after closing and re-opening the main menu.")
        );
        contextMenu.addMenuItem(sortAlphaSwitch);

        let sortCompletedSwitch = new PopupMenu.PopupSwitchMenuItem(
            _("Sort tasks by completed state"),
            section["sort-tasks-by-completed"]
        );
        sortCompletedSwitch.tooltip = new MyTooltip(
            sortCompletedSwitch.actor,
            _("Takes effect after closing and re-opening the main menu.")
        );
        contextMenu.addMenuItem(sortCompletedSwitch);

        let showRemoveTaskSwitch = new PopupMenu.PopupSwitchMenuItem(
            _("Display remove tasks buttons"),
            section["display-remove-task-buttons"]
        );
        showRemoveTaskSwitch.tooltip = new MyTooltip(
            showRemoveTaskSwitch.actor,
            _("Takes effect immediately.")
        );
        contextMenu.addMenuItem(showRemoveTaskSwitch);

        let keepCompletedHiddenSwitch = new PopupMenu.PopupSwitchMenuItem(
            _("Keep completed tasks hidden"),
            section["keep-completed-tasks-hidden"]
        );
        keepCompletedHiddenSwitch.tooltip = new MyTooltip(
            keepCompletedHiddenSwitch.actor,
            _("Takes effect immediately.")
        );
        contextMenu.addMenuItem(keepCompletedHiddenSwitch);

        // Pay attention to the binding context!!!
        exportSection.connect("activate",
            Lang.bind(this._applet,
                this._applet._exportTasks,
                this._delegated_section.section)
        );

        // Pay attention to the binding context!!!
        this.saveSectionAsToDo.connect("activate",
            Lang.bind(this._applet,
                this._applet._saveAsTODOFile,
                this._delegated_section.section)
        );

        sortAlphaSwitch.connect("toggled",
            Lang.bind(this, this._toggleSwitch, "sort-tasks-alphabetically"));

        sortCompletedSwitch.connect("toggled",
            Lang.bind(this, this._toggleSwitch, "sort-tasks-by-completed"));

        showRemoveTaskSwitch.connect("toggled",
            Lang.bind(this, this._toggleSwitch, "display-remove-task-buttons"));

        keepCompletedHiddenSwitch.connect("toggled",
            Lang.bind(this, this._toggleSwitch, "keep-completed-tasks-hidden"));

        this._delegated_section._scrollToItem(this);
    },

    _toggleSwitch: function(aActor, aEvent, aOption) {
        this._delegated_section.section[aOption] = !this._delegated_section.section[aOption];
        aActor.setToggleState(this._delegated_section.section[aOption]);

        this._applet.request_rebuild = true;

        if (aOption === "display-remove-task-buttons" || aOption === "keep-completed-tasks-hidden")
            this._delegated_section._setTasksElementsVisibility();
    },

    _onKeyFocusIn: function() {
        this._delegated_section._scrollToItem(this);
    },

    destroy: function() {
        for (let i = this.connections.length - 1; i >= 0; i--) {
            // Just in case. See TasksListItem.destroy()
            try {
                this.connections[i][0].disconnect(this.connections[i][1]);
            } catch (aErr) {
                continue;
            }
        }

        this.connections.length = 0;

        PopupMenu.PopupBaseMenuItem.prototype.destroy.call(this);
    },

    isEntry: function() {
        return true;
    },

    _onKeyPressEvent: function(aEntry, aEvent) {
        let symbol = aEvent.get_key_symbol();

        // Ctrl + Spacebar: Opens/Closes the tasks list options menu.
        if (this.ctrlKey && symbol === Clutter.KEY_space) {
            this.toggleMenu();
            return true;
        }

        if (symbol == Clutter.KEY_Return ||
            symbol == Clutter.KEY_KP_Enter) {
            this._log && debug("'new_task' signal emitted");
            this.emit("new_task", aEntry.get_text());
            aEntry.set_text("");
            this._delegated_section._scrollToItem(this);
            return false;
        } else if (symbol === Clutter.KEY_Up) {
            let boxChildren = this._delegated_section.tasksContainer.box.get_children();
            let prev = boxChildren[boxChildren.length - 1];

            if (prev) {
                try {
                    // "Filter out" hidden/completed tasks.
                    while (prev !== null) {
                        if (!prev.get_paint_visibility()) {
                            prev = prev.get_previous_sibling();
                            continue;
                        } else {
                            break;
                        }
                    }
                } finally {
                    let prev_obj = prev ? prev._delegate : null;

                    if (prev_obj)
                        prev_obj._label.grab_key_focus();
                    else
                        return false;
                }

                return true;
            } else {
                return false;
            }
        } else if (symbol === Clutter.KEY_Down) {
            this._delegated_section.menu.navigate_focus(this.actor, Gtk.DirectionType.DOWN, false);
            return true;
        }

        return false;
    },

    get ctrlKey() {
        return (Clutter.ModifierType.CONTROL_MASK & global.get_pointer()[2]) !== 0;
    },

    get shiftKey() {
        return (Clutter.ModifierType.SHIFT_MASK & global.get_pointer()[2]) !== 0;
    },

    get altKey() {
        return (Clutter.ModifierType.MOD1_MASK & global.get_pointer()[2]) !== 0;
    },
};

function TasksContainer() {
    this._init.apply(this, arguments);
}

TasksContainer.prototype = {
    __proto__: PopupMenu.PopupMenuSection.prototype,

    _init: function() {
        PopupMenu.PopupMenuSection.prototype._init.call(this);

        this._dragPlaceholder = null;
        this._dragPlaceholderPos = -1;
        this._animatingPlaceholdersCount = 0;
    },

    handleDragOver: function(aSource, aActor, aX, aY, aTime) { // jshint ignore:line
        try {
            let task = aSource.task;
            let taskPos = this._delegated_section.tasks.indexOf(task);

            if (!task || !(aSource instanceof TaskItem)) {
                this._clearDragPlaceholder();
                return DND.DragMotionResult.NO_DROP;
            }

            let n_tasks = this._delegated_section.tasks.length;
            let children = this.box.get_children();
            let numChildren = children.length;
            let boxHeight = this.box.height;

            // Keep the placeholder out of the index calculation; assuming that
            // the remove target has the same size as "normal" items, we don't
            // need to do the same adjustment there.
            if (this._dragPlaceholder) {
                boxHeight -= this._dragPlaceholder.actor.height;
                numChildren--;
            }
            let pos = Math.round(aY * n_tasks / boxHeight);

            if (pos <= n_tasks) {
                this._dragPlaceholderPos = pos;
                let fadeIn;

                if (this._dragPlaceholder) {
                    let parentPlaceHolder = this._dragPlaceholder.actor.get_parent();
                    if (parentPlaceHolder)
                        parentPlaceHolder.remove_actor(this._dragPlaceholder.actor);
                    this._dragPlaceholder.actor.destroy();
                    fadeIn = false;
                } else {
                    fadeIn = true;
                }

                this._dragPlaceholder = new DND.GenericDragPlaceholderItem();
                this._dragPlaceholder.child.set_width(aSource.actor.width);
                this._dragPlaceholder.child.set_height(aSource.actor.height);
                this.box.insert_actor(this._dragPlaceholder.actor,
                    this._dragPlaceholderPos);

                if (fadeIn)
                    this._dragPlaceholder.animateIn();
            }

            let srcIsCurrentItem = (taskPos !== -1);

            if (srcIsCurrentItem)
                return DND.DragMotionResult.MOVE_DROP;

            return DND.DragMotionResult.COPY_DROP;
        } catch (aErr) {
            global.logError(aErr.message);
        }

        this._clearDragPlaceholder();
        return DND.DragMotionResult.NO_DROP;
    },

    acceptDrop: function(aSource, aActor, aX, aY, aTime) { // jshint ignore:line
        try {
            let task = aSource.task;

            if (!task || !(aSource instanceof TaskItem))
                return DND.DragMotionResult.NO_DROP;

            let taskCurPos = this._delegated_section.tasks.indexOf(task);
            let taskNewPos = this._dragPlaceholderPos;

            Meta.later_add(Meta.LaterType.BEFORE_REDRAW,
                Lang.bind(this, function() {
                    try {
                        if (taskNewPos !== taskCurPos) {
                            this.box.remove_actor(aSource.actor);
                            this.box.insert_actor(aSource.actor, taskNewPos);
                            arrayMove(this._delegated_section.tasks, taskCurPos, taskNewPos);
                            this._delegated_section._applet.request_rebuild = true;
                            this._log && debug("_saveTasks triggered by acceptDrop");
                            this._delegated_section._saveTasks();
                        }

                        this.box.show();
                        this._clearDragPlaceholder();
                    } catch (aErr) {
                        global.logError((aErr));
                    }
                    return false;
                }));

        } catch (aErr) {
            global.logError(aErr);
        }

        return true;
    },

    _clearDragPlaceholder: function() {
        if (this._dragPlaceholder) {
            this._dragPlaceholder.animateOutAndDestroy();
            this._dragPlaceholder = null;
            this._dragPlaceholderPos = -1;
        }
    },
};

function TasksListItem() {
    this._init.apply(this, arguments);
}

TasksListItem.prototype = {
    __proto__: PopupMenu.PopupSubMenuMenuItem.prototype,

    _init: function(aApplet, aSection) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {
            hover: false
        });

        this._applet = aApplet;
        this._log = this._applet.pref_logging_enabled;
        this.section = aSection;
        this.id = aSection.id;
        this.name = aSection.name;
        this.tasks = aSection.tasks;
        this._log && debug("Got section with name: " + this.name);

        this.n_tasks = 0;
        this.connections = [];

        this._triangleBin = new St.Bin({
            x_expand: true,
            x_align: St.Align.END
        });
        this._triangle = arrowIcon(St.Side.RIGHT);
        this._triangle.pivot_point = new Clutter.Point({
            x: 0.5,
            y: 0.6
        });
        this._triangleBin.child = this._triangle;
        this.menu = new PopupMenu.PopupSubMenu(this.actor, this._triangle);
        this.menu.connect("open-state-changed", Lang.bind(this, this._subMenuOpenStateChanged));
        this.menu.box.set_y_expand = true;
        this.menu.box.set_x_expand = true;

        // Add an editable label to display the section title.
        this._label = new St.Entry({
            text: this.section.name,
            x_expand: false,
            y_expand: false,
            track_hover: true,
            can_focus: true
        });

        // Add an editable label to display the section title.
        this._counter = new St.Label({
            x_expand: false
        });

        // Set custom styles to the entry.
        this._setSectionStyle();

        let icon = new St.Icon({
            icon_name: "edit-delete",
            icon_size: 16,
            icon_type: St.IconType.SYMBOLIC,
            style_class: "popup-menu-icon"
        });
        this.delete_btn = new St.Button({
            child: icon
        });
        this.delete_btn.tooltip = new RemoveTaskButtonTooltip(this.delete_btn, {
            applet: this._applet,
            is_section: true
        });

        // Add a delete button that will be showed if there is no more task in the section.
        this.addActor(this.delete_btn);

        // Add our label by replacing the default label in PopupSubMenuMenuItem
        this.addActor(this._label, {
            align: St.Align.START,
            expand: false,
            span: 0
        });

        // Add our label by replacing the default label in PopupSubMenuMenuItem
        this.addActor(this._counter, {
            align: St.Align.START,
            expand: false,
            span: 0
        });

        // Add the triangle to emulate accurately a sub menu item.
        this.addActor(this._triangleBin, {
            expand: true,
            span: -1,
            align: St.Align.END
        });

        // Create connection for rename and clicks
        let _ct = this._label.get_clutter_text();
        let conn = _ct.connect("key_focus_out", Lang.bind(this, this._rename));
        this.connections.push([_ct, conn]);

        conn = _ct.connect("key-press-event", Lang.bind(this, this._onKeyPressEvent));
        this.connections.push([_ct, conn]);

        // Create connection for delete button
        conn = this.delete_btn.connect("clicked", Lang.bind(this, this._supr_call));
        this.connections.push([this.delete_btn, conn]);

        // Draw the section
        this._draw_section();
    },

    _setSectionStyle: function() {
        let baseStyle = (this._applet.pref_section_set_bold ?
                "font-weight: bold !important;" :
                "") +
            "font-size: " + this._applet.pref_section_font_size + "em !important;";

        this._counter.set_style(baseStyle);

        this._label.set_style(baseStyle +
            (this._applet.pref_section_set_min_width !== 0 ?
                "min-width: " + this._applet.pref_section_set_min_width + "px !important;" :
                "") +
            (this._applet.pref_section_set_max_width !== 0 ?
                "max-width: " + this._applet.pref_section_set_max_width + "px !important;" :
                "") +
            (this._applet.pref_section_remove_native_entry_theming ?
                "background: transparent !important;" +
                "background-image: none !important;" +
                "background-color: transparent !important;" +
                "border: none !important;" +
                "border-style: none !important;" +
                "border-image: none !important;" +
                "border-color: transparent !important;" +
                (this._applet.pref_section_remove_native_entry_theming_sizing ?
                    "border-width: 0 !important;" +
                    "border-radius: 0 !important;" +
                    "padding: 0 !important;" +
                    "margin: 0 !important;" :
                    "") :
                "")
        );
    },

    _onButtonReleaseEvent: function(aActor, aEvent) { // jshint ignore:line
        // Always force the focus on the section entry. Otherwise, if the focus is inside
        // an entry inside an opened sub-menu, and then the sub-menu is closed, the
        // closing of the sub-menu will force the closing of the applet's main menu.
        this._label.grab_key_focus();

        if (this.menu.isOpen) {
            this.menu.close(this._applet.pref_animate_menu);
            return;
        }

        PopupMenu.PopupBaseMenuItem.prototype._onButtonReleaseEvent.call(this);
    },

    // Taken from the default Cinnamon menu applet.
    // Works beautifully!!!
    _scrollToItem: function(aItem) {
        let current_scroll_value = this.menu.actor.get_vscroll_bar().get_adjustment().get_value();
        let box_height = this.menu.actor.get_allocation_box().y2 -
            this.menu.actor.get_allocation_box().y1;
        let new_scroll_value = current_scroll_value;

        if (current_scroll_value > aItem.actor.get_allocation_box().y1 - 10)
            new_scroll_value = aItem.actor.get_allocation_box().y1 - 10;

        if (box_height + current_scroll_value < aItem.actor.get_allocation_box().y2 + 20)
            new_scroll_value = aItem.actor.get_allocation_box().y2 - box_height + 20;

        if (new_scroll_value != current_scroll_value)
            this.menu.actor.get_vscroll_bar().get_adjustment().set_value(new_scroll_value);
    },

    _setTasksElementsVisibility: function() {
        let children = this.tasksContainer.box.get_children();
        let i = 0,
            iLen = children.length;

        for (; i < iLen; i++) {
            let taskItem = children[i]._delegate;

            if (taskItem instanceof TaskItem) { // Just to be sure.
                let del_btn = taskItem._del_btn;

                if (del_btn) {
                    if (this.section["display-remove-task-buttons"]) {
                        del_btn.set_width(-1);
                        del_btn.show();
                    } else {
                        del_btn.set_width(0);
                        del_btn.hide();
                    }
                }

                if (this.section["keep-completed-tasks-hidden"] && taskItem.task.completed) {
                    taskItem.actor.set_height(0);
                    taskItem.actor.hide();
                } else {
                    taskItem.actor.set_height(-1);
                    taskItem.actor.show();
                }
            }
        }
    },

    _onKeyFocusIn: function() {
        let _ct = this._label.get_clutter_text();
        this._label.grab_key_focus();

        _ct.set_selection(
            this._applet.pref_auto_select_all ? 0 : -1,
            _ct.text.length
        );
    },

    _onKeyPressEvent: function(aActor, aEvent) {
        let symbol = aEvent.get_key_symbol();
        let cursor = this._label.get_clutter_text().get_cursor_position();

        // Insert: Jump to the "New task..." entry. If sub menu isn't open, open it.
        if (!this.ctrlKey && symbol === Clutter.KEY_Insert) {
            if (!this.menu.isOpen)
                this.menu.open(this._applet.pref_animate_menu);

            this.newTaskEntry.newTask.grab_key_focus();
            return false;
        }

        // Do not let the Right Arrow key open the menu unless the menu is closed and
        // the cursor position is at the end of the section label text.
        if (!this.ctrlKey && ((symbol === Clutter.KEY_Right && cursor !== -1 && this.menu.isOpen) ||
                // Do not let the Left Arrow key close the menu unless the menu is opened and
                // the cursor position is at the beginning of the section label text.
                (symbol === Clutter.KEY_Left && cursor !== 0 && this.menu.isOpen))) {
            return false;
        }

        if (!this.ctrlKey && symbol == Clutter.KEY_Down && this.menu.isOpen) {
            // Explicitly focus the first menu item if it exists.
            // I have no idea how navigate_focus works nor how to use it.
            if (this.tasksContainer.firstMenuItem) {
                this.tasksContainer.firstMenuItem.actor._delegate._label.grab_key_focus();
                return true;
            } else {
                return false;
            }
        }

        if (!this.ctrlKey && symbol === Clutter.KEY_Right) {
            this.menu.open(this._applet.pref_animate_menu);
            // Explicitly focus the first menu item if it exists.
            // I have no idea how navigate_focus works nor how to use it.
            if (this.tasksContainer.firstMenuItem) {
                this.tasksContainer.firstMenuItem.actor._delegate._label.grab_key_focus();
                return true;
            } else {
                this._applet.menu.actor.navigate_focus(this.actor, Gtk.DirectionType.DOWN, false);
                return false;
            }
        } else if (!this.ctrlKey && symbol === Clutter.KEY_Left && this.menu.isOpen) {
            this.menu.close(this._applet.pref_animate_menu);
            return true;
        }

        // Shift/Alt + Delete: Removes a section but only if it's empty.
        if (!this.ctrlKey && (this.altKey || this.shiftKey) &&
            symbol === Clutter.Delete &&
            this.delete_btn.get_paint_visibility()) {
            try {
                this._applet.menu.actor.navigate_focus(this.actor, Gtk.DirectionType.UP, false);
                this.menu.close(this._applet.pref_animate_menu);
            } finally {
                this._log && debug("'remove_section_signal' signal emitted");
                this.emit("remove_section_signal", this);
            }
            return false;
        }

        // Do not let Spacebar to activate the sub menu opening/closing.
        // Let it actually type the space.
        if (!this.ctrlKey && symbol === Clutter.KEY_space)
            return false;

        if (this.ctrlKey)
            return false;
        else
            return PopupMenu.PopupBaseMenuItem.prototype._onKeyPressEvent.call(this, aActor, event);
    },

    _draw_section: function() {
            this._clear();

            this.tasksContainer = new TasksContainer();
            this.tasksContainer._delegated_section = this;
            this.menu.addMenuItem(this.tasksContainer);

            // Initiate the task count
            this.n_tasks = 0;

            // Initiate completed count
            this.n_completed = 0;

            // Add tasks item in the section
            let i = 0,
                iLen = this.tasks.length;
            for (; i < iLen; i++)
                this._add_task(i);

            // Update the title of the section with the right task count
            // and notify the ToDo list applet if this count changed.
            this._set_text();

            // If there is no task in the section,show the delete button.
            if (this.n_tasks === 0) {
                this.delete_btn.set_width(-1);
                this.delete_btn.show();
            }

            // Add the NewTaskEntry to allow adding new tasks in this section.
            this.newTaskEntry = new NewTaskEntry(this._applet);
            this.newTaskEntry._delegated_section = this;
            this.newTaskEntry.menu = this.tasksContainer;

            let conn = this.newTaskEntry.connect("new_task", Lang.bind(this, this._create_task));
            this.connections.push([this.newTaskEntry, conn]);

            this.menu.addMenuItem(this.newTaskEntry);
    },

    destroy: function() {
        this.menu.close(this._applet.pref_animate_menu);

        // Clean up all the connection
        for (let i = this.connections.length - 1; i >= 0; i--) {
            // I have no idea why this throws when trying to disconnect one of
            // the signals on applet removal. So, lets try/catch it and move on. ¬¬
            try {
                this.connections[i][0].disconnect(this.connections[i][1]);
            } catch (aErr) {
                continue;
            }
        }

        this.connections.length = 0;
        this.disconnectAll();

        // Remove all sub items
        if (this.newTaskEntry)
            this.newTaskEntry.destroy();

        this.menu.removeAll();

        this.actor.destroy();

        this._log && debug("Section clean-up done");
    },

    _add_task: function(aI) {
        // Create a task item and set its callback
        let taskItem = new TaskItem(this._applet, this.section.tasks[aI], {
            sort_tasks_alphabetically: this.section["sort-tasks-alphabetically"],
            sort_tasks_by_completed: this.section["sort-tasks-by-completed"],
            display_remove_task_buttons: this.section["display-remove-task-buttons"],
            keep_completed_tasks_hidden: this.section["keep-completed-tasks-hidden"]
        });

        taskItem._delegated_section = this;

        // Connect the signals to taskItem
        let conn = taskItem.connect("name_changed", Lang.bind(this, this._saveTasks));
        this.connections.push([taskItem, conn]);

        conn = taskItem.connect("completed_state_changed", Lang.bind(this, this._rename));
        this.connections.push([taskItem, conn]);

        conn = taskItem.connect("remove_task_signal", Lang.bind(this, this._remove_task));
        this.connections.push([taskItem, conn]);

        // Add the task to the section
        this.tasksContainer.addMenuItem(taskItem, aI);

        this.n_tasks++;

        if (taskItem.task.completed)
            this.n_completed++;

        // If it is the first task added, hide the delete button for the section.
        if (this.n_tasks > 0) {
            this.delete_btn.set_width(0);
            this.delete_btn.hide();
        }
    },

    _create_task: function(aItem, aText) {
        // Create a new task to add in the ToDo list and displays it while
        // updating the counters of our widget.

        // Don't add empty task
        if (aText === "" || aText == "\n")
            return;

        // New task object
        let task = {
            completed: false,
            name: aText
        };

        let id = this.tasks.push(task) - 1;
        this._add_task(id);
        this._set_text();

        this._log && debug("'task_count_changed' signal emitted");
        this.emit("task_count_changed", -1);
        this._log && debug("_saveTasks triggered by _create_task");
        this._saveTasks();
    },

    _remove_task: function(aActor, aTask) {
        // Remove task from the section
        let id = this.section.tasks.indexOf(aTask);
        this.section.tasks.splice(id, 1);
        this.n_tasks--;

        if (aTask.completed)
            this.n_completed--;

        // If there is no more tasks, show the delete button
        if (this.n_tasks === 0) {
            this.delete_btn.set_width(-1);
            this.delete_btn.show();
        }

        // Set section title
        this._set_text();
        this._log && debug("'task_count_changed' signal emitted");
        this.emit("task_count_changed", 1);
        this._log && debug("_saveTasks triggered by _remove_task");
        this._saveTasks();
    },

    _rename: function(aTaskItem) {
        // Update number of completed tasks inside this tasks list.
        if (aTaskItem && aTaskItem.task) {
            if (aTaskItem.task.completed)
                this.n_completed++;
            else
                this.n_completed--;
        }

        let name = this._label.get_text();

        // No change needed.
        if (!aTaskItem || (name === this.name || name.length === 0))
            return;

        // Update
        this.section.name = name;
        this.name = name;
        this._set_text();

        if (this.tooltip)
            this._setTooltip();

        this._log && debug("_saveTasks triggered by _rename");
        this._saveTasks();
    },

    _setTooltip: function() {
        this.tooltip.set_text(this.section.name);
    },

    _clear: function() {
        let item = null;
        let items = this.menu._getMenuItems();
        let i = 0,
            iLen = items.length;

        for (; i < iLen; i++) {
            item = items[i];
            item.disconnectAll();
            item.destroy();
        }

        this.menu.removeAll();
    },

    _supr_call: function() {
        if (this._applet.pref_use_fail_safe && !this.ctrlKey) {
            return;
        } else {
            this._log && debug("'remove_section_signal' signal emitted");
            this.emit("remove_section_signal", this);
        }
    },

    _set_text: function() {
        // Set the label text with the amount of tasks and how many are completed
        this._label.set_text(this.section.name);
        this._counter.set_text(this.n_completed + "/" + this.n_tasks);
    },

    _saveTasks: function() {
        try {
            // This might not be needed anymore, since I now store all task items
            // inside their own menu section. But I will keep it just in case.
            //
            // I have to "clean up" the tasks array because the Drag&Drop operation could
            // create a task with a value of null.
            // Instead of allowing to save those null "objects" and be forced to
            // check the tasks everywhere they are used, I just clean them before saving.
            for (let i = this.tasks.length - 1; i >= 0; i--) {
                if (typeof this.tasks[i] !== "object")
                    this.tasks.splice(i, 1);
            }
        } finally {
            this._log && debug("'save_signal' signal emitted");
            this.emit("save_signal", false);
        }
    },

    _subMenuOpenStateChanged: function(aMenu, aOpen) {
        if (aOpen && this._applet.pref_keep_one_menu_open) {
            let menu = this._applet.todosSec;

            let children = menu._getMenuItems();
            let i = 0,
                iLen = children.length;

            for (; i < iLen; i++) {
                let item = children[i];

                if (item instanceof TasksListItem) {
                    if (this.menu !== item.menu)
                        item.menu.close(this._applet.pref_animate_menu);
                }
            }
        }
    },

    get ctrlKey() {
        return (Clutter.ModifierType.CONTROL_MASK & global.get_pointer()[2]) !== 0;
    },

    get shiftKey() {
        return (Clutter.ModifierType.SHIFT_MASK & global.get_pointer()[2]) !== 0;
    },

    get altKey() {
        return (Clutter.ModifierType.MOD1_MASK & global.get_pointer()[2]) !== 0;
    },
};

function MyTooltip() {
    this._init.apply(this, arguments);
}

MyTooltip.prototype = {
    __proto__: Tooltips.Tooltip.prototype,

    _init: function(aActor, aText) {
        Tooltips.Tooltip.prototype._init.call(this, aActor, aText);

        this._tooltip.set_style("text-align: left;width:auto;max-width: 450px;");
        this._tooltip.get_clutter_text().set_line_wrap(true);
        this._tooltip.get_clutter_text().set_line_wrap_mode(Pango.WrapMode.WORD_CHAR);
        this._tooltip.get_clutter_text().ellipsize = Pango.EllipsizeMode.NONE; // Just in case

        aActor.connect("destroy", Lang.bind(this, function() {
            this.destroy();
        }));
    },

    destroy: function() {
        Tooltips.Tooltip.prototype.destroy.call(this);
    }
};

function RemoveTaskButtonTooltip() {
    this._init.apply(this, arguments);
}

RemoveTaskButtonTooltip.prototype = {
    __proto__: MyTooltip.prototype,

    _init: function(aActor, aObj) {
        // TO TRANSLATORS: Full sentence.
        // "Remove this section/task"
        let tt = _("Remove this %s".format(aObj.is_section ? "section" : "task"));

        if (aObj.applet.pref_use_fail_safe)
            tt += " " + _("(Hold Ctrl key)");

        MyTooltip.prototype._init.call(this, aActor, tt);
    }
};

function arrowIcon(side) {
    let iconName;
    switch (side) {
        case St.Side.TOP:
            iconName = "pan-up";
            break;
        case St.Side.RIGHT:
            iconName = "pan-end";
            break;
        case St.Side.BOTTOM:
            iconName = "pan-down";
            break;
        case St.Side.LEFT:
            iconName = "pan-start";
            break;
    }

    let arrow = new St.Icon({
        style_class: "popup-menu-arrow",
        icon_name: iconName,
        icon_type: St.IconType.SYMBOLIC,
        y_expand: true,
        y_align: Clutter.ActorAlign.CENTER,
        important: true
    });

    return arrow;
}

function arrayMove(array, old_index, new_index) {
    if (new_index >= array.length) {
        let k = new_index - array.length;
        while ((k--) + 1) {
            array.push(undefined);
        }
    }
    array.splice(new_index, 0, array.splice(old_index, 1)[0]);
    // return this; // for testing purposes
}

function debug(message) {
    let caller = getCaller();
    let output = "[" + AppletUUID + "/" + caller.split("/").pop() + "] " + message;
    global.log(output);
}

/**
 * Implemented the two functions below using tweaked code from:
 * http://stackoverflow.com/a/13227808
 */

function getCaller() {
    let stack = getStack();

    // Remove superfluous function calls on stack
    stack.shift(); // getCaller --> getStack
    stack.shift(); // debug --> getCaller

    // Return caller's caller
    return stack[0];
}

function getStack() {
    // Save original Error.prepareStackTrace
    let origPrepareStackTrace = Error.prepareStackTrace;

    // Override with function that just returns `stack`
    Error.prepareStackTrace = function(_, stack) {
        return stack;
    };

    // Create a new `Error`, which automatically gets `stack`
    let err = new Error();

    // Evaluate `err.stack`, which calls our new `Error.prepareStackTrace`
    let stack = err.stack.split("\n");

    // Restore original `Error.prepareStackTrace`
    Error.prepareStackTrace = origPrepareStackTrace;

    // Remove superfluous function call on stack
    stack.shift(); // getStack --> Error

    return stack;
}

/*
exported TODO_LIST_MAX_LENGTH,
         DefaultExampleTasks
 */
