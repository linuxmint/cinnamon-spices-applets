const $ = imports.applet.__init__;
const _ = $._;

const Applet = imports.ui.applet;
const Settings = imports.ui.settings;
const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;
const St = imports.gi.St;
const PopupMenu = imports.ui.popupMenu;
const Main = imports.ui.main;
const Lang = imports.lang;
const Util = imports.misc.util;
const Clutter = imports.gi.Clutter;
const Mainloop = imports.mainloop;
const ModalDialog = imports.ui.modalDialog;
const Cinnamon = imports.gi.Cinnamon;
const Gio = imports.gi.Gio;

function MyApplet(aMetadata, aOrientation, aPanel_height, aInstance_id) {
    this._init(aMetadata, aOrientation, aPanel_height, aInstance_id);
}

MyApplet.prototype = {
    __proto__: Applet.TextIconApplet.prototype,

    _init: function(aMetadata, aOrientation, aPanel_height, aInstance_id) {
        Applet.TextIconApplet.prototype._init.call(this, aOrientation, aPanel_height, aInstance_id);

        // Condition needed for retro-compatibility.
        // Mark for deletion on EOL.
        if (Applet.hasOwnProperty("AllowedLayout"))
            this.setAllowedLayout(Applet.AllowedLayout.BOTH);

        this.settings = new Settings.AppletSettings(this, aMetadata.uuid, aInstance_id);
        this._bindSettings();

        try {
            this.metadata = aMetadata;
            this.instance_id = aInstance_id;
            this.orientation = aOrientation;
            this.mainBox = null;
            this._request_rebuild = false;
            this._update_label_id = 0;
            this._build_ui_id = 0;
            this._save_tasks_id = 0;
            this._log = this.pref_logging_enabled;

            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, aOrientation);
            this.menu.connect("open-state-changed", Lang.bind(this, this._onOpenStateChanged));
            this.menuManager.addMenu(this.menu);

            this._load();
            this._buildUI();

            this._expandAppletContextMenu();
            this._updateKeybindings();
            this._updateIconAndLabel();
        } catch (aErr) {
            global.logError(aErr);
        }
    },

    _buildUI: function() {
        if (this._build_ui_id > 0) {
            Mainloop.source_remove(this._build_ui_id);
            this._build_ui_id = 0;
        }

        this._build_ui_id = Mainloop.timeout_add(500,
            Lang.bind(this, function() {
                // Destroy previous box
                if (this.mainBox !== null)
                    this.mainBox.destroy();

                // Create main box
                this.mainBox = new St.BoxLayout();
                this.mainBox.set_vertical(true);

                // Create ToDos box
                this.todosSec = new PopupMenu.PopupMenuSection();

                this.mainBox.add(this.todosSec.actor);

                // Separator
                let separator = new PopupMenu.PopupSeparatorMenuItem();
                this.mainBox.add_actor(separator.actor);

                // Text entry
                this.newTaskList = new St.Entry({
                    hint_text: _("New tasks list..."),
                    track_hover: true,
                    can_focus: true
                });
                this.newTaskList.set_style("padding: 7px 9px !important;min-width: 150px;");

                let entryNewTask = this.newTaskList.get_clutter_text();
                entryNewTask.set_max_length($.TODO_LIST_MAX_LENGTH);

                // Callback to add section when Enter is pressed
                entryNewTask.connect("key-press-event", Lang.bind(this, function(aActor, aEvent) {
                    let symbol = aEvent.get_key_symbol();
                    if (symbol == Clutter.KEY_Return || symbol == Clutter.KEY_KP_Enter) {
                        this._create_section(aActor.get_text());
                        entryNewTask.set_text("");
                    }
                }));

                // Bottom section
                let bottomSection = new PopupMenu.PopupMenuSection();
                bottomSection.actor.set_style("padding: 0 20px !important;");

                bottomSection.actor.add_actor(this.newTaskList);
                this.mainBox.add_actor(bottomSection.actor);
                this.menu.box.add_actor(this.mainBox);

                this._fill_ui();
            }));
    },

    // Fill UI with the section items
    _fill_ui: function() {
        try {

            this._log && this._log && $.debug("Fill UI");

            // Check if tasks file exists
            this._clear();
            this.n_tasks = 0;

            for (let id in this.sections) {
                if (typeof this.sections[id] === "function")
                    continue;

                this._add_section(this.sections[id]);
            }
        } finally {
            if (!this.pref_initial_load) {
                // This bit me hard. Luckily, I found the solution very quickly.
                this._create_section("", JSON.parse(JSON.stringify($.DefaultExampleTasks)));
                this.pref_initial_load = true;
            }

            if (this.pref_show_tasks_counter_on_applet)
                this._updateLabel();

            this.newTaskList.hint_text = _("New tasks list...");
            this.newTaskList.grab_key_focus();
        }
    },

    _add_section: function(aSection) {
        let item = new $.TasksListItem(this, aSection);

        this.todosSec.addMenuItem(item);

        this.n_tasks += item.n_tasks;

        item.connect("save_signal", Lang.bind(this, this._saveTasks));
        item.connect("remove_section_signal", Lang.bind(this, this._remove_section));
        item.connect("task_count_changed", Lang.bind(this, this._update_counter));
    },

    _update_counter: function(aItem, aDiff) {
        this.n_tasks -= aDiff;

        if (this.pref_show_tasks_counter_on_applet)
            this._updateLabel();
    },

    _clear: function() {
        Array.prototype.slice.call(this.todosSec._getMenuItems()).forEach(function(aSection) {
            aSection._clear();
        });

        this.todosSec.removeAll();
    },

    _create_section: function(aText, aSection) {
        let id = this.next_id;
        let section;

        if (aSection) {
            section = aSection;
            section["id"] = id;
        } else { // Don't add empty task
            if (aText === "" || aText == "\n")
                return;

            // Add the new section to the sections dictionary
            section = {
                "id": id,
                "name": aText,
                "sort-tasks-alphabetically": true,
                "sort-tasks-by-completed": true,
                "display-remove-task-buttons": true,
                "keep-completed-tasks-hidden": false,
                "tasks": []
            };
        }

        this.sections[id] = section;
        this.next_id += 1;
        this._log && $.debug("_saveTasks triggered by MyApplet._create_section");
        this._saveTasks();

        // Add the section to the UI
        this._add_section(section);
    },

    _remove_section: function(aActor, aSection) {
        // Remove the section from the internal database and synchronize it with the setting.
        delete this.sections[aSection.id];

        // Clean-up the section
        aSection.destroy();

        this._log && $.debug("_saveTasks triggered by MyApplet._remove_section");
        this._saveTasks();
    },

    _saveTasks: function(aCallback) {
        // This function is triggered quite a lot by several events and actions.
        // Adding a timeout will avoid excessive writes to disk when saving.
        if (this._save_tasks_id > 0) {
            Mainloop.source_remove(this._save_tasks_id);
            this._save_tasks_id = 0;
        }

        this._save_tasks_id = Mainloop.timeout_add(500, Lang.bind(this, function() {
            this._log && $.debug("Tasks saved.");
            this.pref_todo_list = this.sections;
            this.pref_todo_list.save();

            if (aCallback)
                aCallback();
        }));
    },

    _load: function() {
        this.sections = this.pref_todo_list;

        // Compute the next id to avoid collapse of the the ToDo list
        this.next_id = 0;

        for (let id in this.sections) {
            if (typeof this.sections[id] !== "object")
                continue;

            if (this.sections[id]["tasks"].length > 0) {
                if (this.sections[id]["sort-tasks-by-completed"]) {
                    let completed = [];
                    let not_completed = [];
                    let tasks = this.sections[id]["tasks"];
                    let i = 0,
                        iLen = tasks.length;

                    for (; i < iLen; i++) {
                        if (tasks[i]["completed"])
                            completed.push(tasks[i]);
                        else
                            not_completed.push(tasks[i]);
                    }

                    if (this.sections[id]["sort-tasks-alphabetically"]) {
                        completed = completed.sort(function(a, b) {
                            return a["name"].localeCompare(b["name"], undefined, {
                                numeric: true,
                                sensitivity: "base"
                            });
                        });
                        not_completed = not_completed.sort(function(a, b) {
                            return a["name"].localeCompare(b["name"], undefined, {
                                numeric: true,
                                sensitivity: "base"
                            });
                        });
                    }

                    this.sections[id]["tasks"] = not_completed.concat(completed);
                } else if (!this.sections[id]["sort-tasks-by-completed"] &&
                    this.sections[id]["sort-tasks-alphabetically"]) {
                    this.sections[id]["tasks"] = this.sections[id]["tasks"].sort(function(a, b) {
                        return a["name"].localeCompare(b["name"], undefined, {
                            numeric: true,
                            sensitivity: "base"
                        });
                    });
                }
            }

            this.next_id = Math.max(this.next_id, id);
        }
        this.next_id++;
    },

    _toggleMenu: function() {
        if (this.menu.isOpen)
            this.menu.close(this.pref_animate_menu);
        else {
            this.menu.open(this.pref_animate_menu);
            this.newTaskList.grab_key_focus();
        }
    },

    _onOpenStateChanged: function(aActor, aOpen) {
        if (aOpen) {
            let i = 0;
            let items = this.todosSec._getMenuItems();
            let itemsLen = items.length;

            for (; i < itemsLen; i++) {
                items[i].menu.close();
            }
        } else {
            // Rebuild the menu on closing if needed.
            if (this.request_rebuild) {
                this._log && $.debug("_saveTasks triggered by MyApplet._onOpenStateChanged");
                this._rebuildRequested();
            }
        }
    },

    _rebuildRequested: function() {
        // Async needed. Otherwise, the UI is built before the tasks are saved.
        this._saveTasks(Lang.bind(this, function() {
            this._load();
            this._buildUI();
            this.request_rebuild = false;
        }));
    },

    _bindSettings: function() {
        // Needed for retro-compatibility.
        // Mark for deletion on EOL.
        let bD = {
            IN: 1,
            OUT: 2,
            BIDIRECTIONAL: 3
        };
        let settingsArray = [
            [bD.IN, "pref_custom_icon_for_applet", this._updateIconAndLabel],
            [bD.IN, "pref_custom_label_for_applet", this._updateIconAndLabel],
            [bD.IN, "pref_show_tasks_counter_on_applet", this._updateLabel],
            [bD.IN, "pref_overlay_key", this._updateKeybindings],
            [bD.IN, "pref_use_fail_safe", this._buildUI],
            [bD.IN, "pref_animate_menu", null],
            [bD.IN, "pref_keep_one_menu_open", null],
            [bD.IN, "pref_section_font_size", this._buildUI],
            [bD.IN, "pref_section_set_min_width", this._buildUI],
            [bD.IN, "pref_section_set_max_width", this._buildUI],
            [bD.IN, "pref_section_set_bold", this._buildUI],
            [bD.IN, "pref_section_remove_native_entry_theming", this._buildUI],
            [bD.IN, "pref_section_remove_native_entry_theming_sizing", this._buildUI],
            [bD.IN, "pref_task_font_size", this._buildUI],
            [bD.IN, "pref_task_set_min_width", this._buildUI],
            [bD.IN, "pref_task_set_max_width", this._buildUI],
            [bD.IN, "pref_task_set_custom_spacing", this._buildUI],
            [bD.IN, "pref_task_set_bold", this._buildUI],
            [bD.IN, "pref_task_remove_native_entry_theming", this._buildUI],
            [bD.IN, "pref_task_remove_native_entry_theming_sizing", this._buildUI],
            [bD.IN, "pref_task_completed_character", null],
            [bD.IN, "pref_task_notcompleted_character", null],
            [bD.IN, "pref_tasks_priorities_colors_enabled", this._buildUI],
            [bD.IN, "pref_tasks_priorities_highlight_entire_row", this._buildUI],
            [bD.IN, "pref_tasks_priorities_critical_background", this._buildUI],
            [bD.IN, "pref_tasks_priorities_critical_foreground", this._buildUI],
            [bD.IN, "pref_tasks_priorities_high_background", this._buildUI],
            [bD.IN, "pref_tasks_priorities_high_foreground", this._buildUI],
            [bD.IN, "pref_tasks_priorities_medium_background", this._buildUI],
            [bD.IN, "pref_tasks_priorities_medium_foreground", this._buildUI],
            [bD.IN, "pref_tasks_priorities_today_background", this._buildUI],
            [bD.IN, "pref_tasks_priorities_today_foreground", this._buildUI],
            [bD.IN, "pref_tasks_priorities_low_background", this._buildUI],
            [bD.IN, "pref_tasks_priorities_low_foreground", this._buildUI],
            [bD.IN, "pref_logging_enabled", null],
            [bD.BIDIRECTIONAL, "pref_initial_load", null],
            [bD.BIDIRECTIONAL, "pref_todo_list", null],
            [bD.BIDIRECTIONAL, "pref_imp_exp_last_selected_directory", null],
            [bD.BIDIRECTIONAL, "pref_save_last_selected_directory", null],
        ];
        let newBinding = typeof this.settings.bind === "function";
        for (let [binding, property_name, callback] of settingsArray) {
            // Condition needed for retro-compatibility.
            // Mark for deletion on EOL.
            if (newBinding)
                this.settings.bind(property_name, property_name, callback);
            else
                this.settings.bindProperty(binding, property_name, property_name, callback, null);
        }
    },

    _updateKeybindings: function() {
        Main.keybindingManager.removeHotKey("odyseus-simple-todo-list-overlay-key-" + this.instance_id);

        if (this.pref_overlay_key !== "") {
            Main.keybindingManager.addHotKey(
                "odyseus-simple-todo-list-overlay-key-" + this.instance_id,
                this.pref_overlay_key,
                Lang.bind(this, function() {
                    if (!Main.overview.visible && !Main.expo.visible)
                        this._toggleMenu();
                })
            );
        }
    },

    _updateIconAndLabel: function() {
        try {
            if (this.pref_custom_icon_for_applet === "") {
                this.set_applet_icon_name("");
            } else if (GLib.path_is_absolute(this.pref_custom_icon_for_applet) &&
                GLib.file_test(this.pref_custom_icon_for_applet, GLib.FileTest.EXISTS)) {
                if (this.pref_custom_icon_for_applet.search("-symbolic") != -1)
                    this.set_applet_icon_symbolic_path(this.pref_custom_icon_for_applet);
                else
                    this.set_applet_icon_path(this.pref_custom_icon_for_applet);
            } else if (Gtk.IconTheme.get_default().has_icon(this.pref_custom_icon_for_applet)) {
                if (this.pref_custom_icon_for_applet.search("-symbolic") != -1)
                    this.set_applet_icon_symbolic_name(this.pref_custom_icon_for_applet);
                else
                    this.set_applet_icon_name(this.pref_custom_icon_for_applet);
                /**
                 * START mark Odyseus
                 * I added the last condition without checking Gtk.IconTheme.get_default.
                 * Otherwise, if there is a valid icon name added by
                 *  Gtk.IconTheme.get_default().append_search_path, it will not be recognized.
                 * With the following extra condition, the worst that can happen is that
                 *  the applet icon will not change/be set.
                 */
            } else {
                try {
                    if (this.pref_custom_icon_for_applet.search("-symbolic") != -1)
                        this.set_applet_icon_symbolic_name(this.pref_custom_icon_for_applet);
                    else
                        this.set_applet_icon_name(this.pref_custom_icon_for_applet);
                } catch (aErr) {
                    global.logError(aErr);
                }
            }
        } catch (aErr) {
            global.logWarning("Could not load icon file \"%s\" for menu button")
                .format(this.pref_custom_icon_for_applet);
        }

        if (this.pref_custom_icon_for_applet === "") {
            this._applet_icon_box.hide();
        } else {
            this._applet_icon_box.show();
        }

        this._updateLabel();
    },

    _updateLabel: function() {
        if (this._update_label_id > 0) {
            Mainloop.source_remove(this._update_label_id);
            this._update_label_id = 0;
        }

        // this._buildUI is triggered after a delay. If I call _updateLabel without a delay,
        // this.n_tasks will be undefined.
        this._update_label_id = Mainloop.timeout_add(500, Lang.bind(this, function() {
            if (this.orientation == St.Side.LEFT || this.orientation == St.Side.RIGHT) { // no menu label if in a vertical panel
                this.set_applet_label("");
            } else {
                if (this.pref_custom_label_for_applet !== "" || this.pref_show_tasks_counter_on_applet) {
                    let label = _(this.pref_custom_label_for_applet);
                    // Add an empty space only if the label isn't empty.
                    label += ((this.pref_show_tasks_counter_on_applet &&
                            this.pref_custom_label_for_applet !== "") ?
                        " " :
                        "");
                    label += (this.pref_show_tasks_counter_on_applet ?
                        "(" + (this.n_tasks || 0) + ")" :
                        "");

                    this.set_applet_label(label);

                    // Just in case.
                    if (typeof this.n_tasks !== "number")
                        this._updateLabel();
                } else {
                    this.set_applet_label("");
                }
            }

            this.updateLabelVisibility();
        }));
    },

    _importTasks: function() {
        Util.spawn_async([this.metadata.path + "/appletHelper.py",
                "import",
                this.pref_imp_exp_last_selected_directory
            ],
            Lang.bind(this, function(aOutput) {
                let path = aOutput.trim();

                if (!Boolean(path))
                    return;

                // Trying the following asynchronous function in replacement of
                // Cinnamon.get_file_contents*utf8_sync.
                let file = Gio.file_new_for_path(path);
                this.pref_imp_exp_last_selected_directory = path;
                file.load_contents_async(null, Lang.bind(this, function(aFile, aResponce) {
                    let rawData;
                    try {
                        rawData = aFile.load_contents_finish(aResponce)[1];
                    } catch (aErr) {
                        global.logError("ERROR: " + aErr.message);
                        return;
                    }

                    try {
                        let sections = JSON.parse(rawData);

                        for (let i in sections) {
                            if (sections.hasOwnProperty(i)) {
                                this._create_section("", sections[i]);
                            }
                        }
                    } finally {
                        this._buildUI();
                    }
                }));
            }));
    },

    _exportTasks: function(aActor, aEvent, aUnknown, aSection) {
        Util.spawn_async([this.metadata.path + "/appletHelper.py",
                "export",
                this.pref_imp_exp_last_selected_directory
            ],
            Lang.bind(this, function(aOutput) {
                let path = aOutput.trim();

                if (!Boolean(path))
                    return;

                let sectionsContainer;

                if (aSection) {
                    sectionsContainer = {};
                    sectionsContainer["0"] = aSection;
                } else {
                    sectionsContainer = this.sections;
                }

                let rawData = JSON.stringify(sectionsContainer, null, 4);
                let file = Gio.file_new_for_path(path);
                this.pref_imp_exp_last_selected_directory = path;
                this._saveToFile(rawData, file);
            }));
    },

    _saveAsTODOFile: function(aActor, aEvent, aUnknown, aSection) {
        Util.spawn_async([this.metadata.path + "/appletHelper.py",
                "save",
                this.pref_save_last_selected_directory
            ],
            Lang.bind(this, function(aOutput) {
                let path = aOutput.trim();

                if (!Boolean(path))
                    return;

                let rawData = "";
                let file = Gio.file_new_for_path(path);
                this.pref_save_last_selected_directory = path;
                let sectionsContainer;

                if (aSection) {
                    sectionsContainer = {};
                    sectionsContainer["0"] = aSection;
                } else {
                    sectionsContainer = this.sections;
                }

                try {
                    for (let id in sectionsContainer) {
                        if (sectionsContainer.hasOwnProperty(id) &&
                            typeof sectionsContainer[id] === "object") {
                            rawData += sectionsContainer[id]["name"] + ":";
                            rawData += "\n";
                            let i = 0,
                                iLen = sectionsContainer[id]["tasks"].length;
                            for (; i < iLen; i++) {
                                let task = sectionsContainer[id]["tasks"][i];
                                rawData += (task["completed"] ?
                                        this.pref_task_completed_character :
                                        this.pref_task_notcompleted_character) +
                                    " ";
                                rawData += task["name"];
                                rawData += "\n";

                                if (i === iLen - 1)
                                    rawData += "\n";
                            }
                        }
                    }
                } finally {
                    this._saveToFile(rawData, file);
                }
            }));
    },

    _saveToFile: function(aData, aFile) {
        let raw = aFile.replace(null, false, Gio.FileCreateFlags.NONE, null);
        let out_file = Gio.BufferedOutputStream.new_sized(raw, 4096);
        Cinnamon.write_string_to_stream(out_file, aData);
        out_file.close(null);
    },

    _expandAppletContextMenu: function() {
        let menuItem;

        // Save as TODO
        menuItem = new PopupMenu.PopupIconMenuItem(
            _("Save as TODO"),
            "document-save-as",
            St.IconType.SYMBOLIC);
        menuItem._icon.icon_size = 14;
        menuItem.connect("activate", Lang.bind(this, function() {
            this._saveAsTODOFile();
        }));
        menuItem.tooltip = new $.MyTooltip(
            menuItem.actor,
            _("Save all current tasks lists as a TODO file.")
        );
        this._applet_context_menu.addMenuItem(menuItem);

        // Export tasks
        menuItem = new PopupMenu.PopupIconMenuItem(
            _("Export tasks"),
            "simple-todo-list-export-tasks",
            St.IconType.SYMBOLIC);
        menuItem._icon.icon_size = 14;
        menuItem.connect("activate", Lang.bind(this, function() {
            this._exportTasks();
        }));
        menuItem.tooltip = new $.MyTooltip(
            menuItem.actor,
            _("Export all current tasks lists into a JSON file.") + "\n\n" +
            _("JSON files exported by this applet can be imported back into the applet and the tasks list found inside the files are added to the tasks lists currently loaded into the applet.")
        );
        this._applet_context_menu.addMenuItem(menuItem);

        // Import tasks
        menuItem = new PopupMenu.PopupIconMenuItem(
            _("Import tasks"),
            "simple-todo-list-import-tasks",
            St.IconType.SYMBOLIC);
        menuItem._icon.icon_size = 14;
        menuItem.connect("activate", Lang.bind(this, function() {
            this._importTasks();
        }));
        menuItem.tooltip = new $.MyTooltip(
            menuItem.actor,
            _("Import tasks lists from a previously exported JSON file into this applet.") + "\n\n" +
            _("JSON files exported by this applet can be imported back into the applet and the tasks list found inside the files are added to the tasks lists currently loaded into the applet.")
        );
        this._applet_context_menu.addMenuItem(menuItem);

        // Separator
        this._applet_context_menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Restore example tasks
        menuItem = new PopupMenu.PopupIconMenuItem(
            _("Restore example tasks"),
            "edit-redo",
            St.IconType.SYMBOLIC);
        menuItem._icon.icon_size = 14;
        menuItem.connect("activate", Lang.bind(this, function() {
            try {
                // This bit me hard. Luckily, I found the solution very quickly.
                this._create_section("", JSON.parse(JSON.stringify($.DefaultExampleTasks)));
            } finally {
                this._buildUI();
            }
        }));
        menuItem.tooltip = new $.MyTooltip(
            menuItem.actor,
            _("Restore the example tasks list that were present when the applet was first loaded.")
        );
        this._applet_context_menu.addMenuItem(menuItem);

        // Reset tasks
        menuItem = new PopupMenu.PopupIconMenuItem(
            _("Reset tasks"),
            "dialog-warning",
            St.IconType.SYMBOLIC);
        menuItem._icon.icon_size = 14;
        menuItem.connect("activate", Lang.bind(this, function() {
            new ModalDialog.ConfirmDialog(
                _("WARNING!!!") + "\n" +
                _("Do you really want to remove all your current tasks?") + "\n" +
                _("This operation cannot be reverted!!!") + "\n",
                Lang.bind(this, function() {
                    try {
                        this.pref_todo_list = {};
                    } finally {
                        this._load();
                        this._buildUI();
                    }
                })
            ).open(global.get_current_time());
        }));
        menuItem.tooltip = new $.MyTooltip(
            menuItem.actor,
            _("Remove all currently loaded tasks lists from this applet.") + "\n\n" +
            _("WARNING!!!") + " " + _("This operation cannot be reverted!!!")
        );
        this._applet_context_menu.addMenuItem(menuItem);

        // Separator
        this._applet_context_menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Help
        menuItem = new PopupMenu.PopupIconMenuItem(
            _("Help"),
            "dialog-information",
            St.IconType.SYMBOLIC);
        menuItem._icon.icon_size = 14;
        menuItem.tooltip = new $.MyTooltip(menuItem.actor, _("Open this applet help file."));
        menuItem.connect("activate", Lang.bind(this, function() {
            Util.spawn_async(["xdg-open", this.metadata.path + "/HELP.html"], null);
        }));
        this._applet_context_menu.addMenuItem(menuItem);
    },

    updateLabelVisibility: function() {
        // Condition needed for retro-compatibility.
        // Mark for deletion on EOL.
        if (typeof this.hide_applet_label !== "function")
            return;

        if (this.orientation == St.Side.LEFT || this.orientation == St.Side.RIGHT) {
            this.hide_applet_label(true);
        } else {
            if (this.pref_custom_label_for_applet === "" && !this.pref_show_tasks_counter_on_applet) {
                this.hide_applet_label(true);
            } else {
                this.hide_applet_label(false);
            }
        }
    },

    on_applet_clicked: function() {
        this._toggleMenu();
    },

    on_applet_removed_from_panel: function() {
        if (this._build_ui_id > 0) {
            Mainloop.source_remove(this._build_ui_id);
            this._build_ui_id = 0;
        }

        if (this._save_tasks_id > 0) {
            Mainloop.source_remove(this._save_tasks_id);
            this._save_tasks_id = 0;
        }

        if (this._update_label_id > 0) {
            Mainloop.source_remove(this._update_label_id);
            this._update_label_id = 0;
        }

        this._clear();
        this.settings.finalize();
        Main.keybindingManager.removeHotKey("odyseus-simple-todo-list-overlay-key-" + this.instance_id);
    },

    get request_rebuild() {
        return this._request_rebuild;
    },

    set request_rebuild(aVal) {
        this._request_rebuild = aVal;
    }
};

function main(aMetadata, aOrientation, aPanel_height, aInstance_id) {
    return new MyApplet(aMetadata, aOrientation, aPanel_height, aInstance_id);
}
