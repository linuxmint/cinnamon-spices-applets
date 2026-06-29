const Applet = imports.ui.applet;
const Cinnamon = imports.gi.Cinnamon;
const Lang = imports.lang;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;
const Gettext = imports.gettext;
const UUID = "spicy-clipboard-applet@Twilight0";
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Settings = imports.ui.settings;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const Util = imports.misc.util;
const Tooltips = imports.ui.tooltips;

Gettext.bindtextdomain(UUID, GLib.get_user_data_dir() + "/locale");

function _(str) {
    return Gettext.dgettext(UUID, str);
}

const ScrollableMenuSection = class ScrollableMenuSection extends PopupMenu.PopupMenuSection {
    _init(maxHeight) {
        super._init();
        
        this.scrollView = new St.ScrollView({
            style_class: "spicy-clipboard-scrollbox",
            hscrollbar_policy: St.PolicyType.NEVER,
            vscrollbar_policy: St.PolicyType.AUTOMATIC,
            enable_mouse_scrolling: true
        });
        this.scrollView.set_clip_to_allocation(true);
        this.scrollView.set_style("max-height: " + (maxHeight || 350) + "px;");
        this.scrollView.add_actor(this.box);
        
        this.actor = this.scrollView;
        this.actor._delegate = this;
        this.isOpen = true;
    }
};

function MyApplet(metadata, orientation, panel_height, instance_id) {
    this._init(metadata, orientation, panel_height, instance_id);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function (metadata, orientation, panel_height, instance_id) {
        Applet.IconApplet.prototype._init.call(this, orientation, panel_height, instance_id);

        try {
            this.set_applet_icon_symbolic_name("edit-paste-symbolic");
            this.set_applet_tooltip(_("Spicy Clipboard Manager"));

            this._history = [];
            this._lastText = "";
            this._lastImageHash = "";

            // Bind settings
            this.settings = new Settings.AppletSettings(this, metadata.uuid, this.instance_id);
            this.settings.bind("historySize", "_historySize", this.settings_changed);
            this.settings.bind("autoPaste", "_autoPaste", this.settings_changed);
            this.settings.bind("pasteTool", "_pasteTool", this.settings_changed);
            this.settings.bind("notifyOnCopy", "_notifyOnCopy", this.settings_changed);
            this.settings.bind("menuMaxHeight", "_menuMaxHeight", this.settings_changed);
            this.settings.bind("leftClickAction", "_leftClickAction", this.settings_changed);
            this.settings.bind("middleClickAction", "_middleClickAction", this.settings_changed);
            this.settings.bind("rightClickAction", "_rightClickAction", this.settings_changed);

            // Set up UI Menu
            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager.addMenu(this.menu);

            // Load saved history
            this._loadHistory();

            // Setup Clipboard Monitor
            this._clipboard = St.Clipboard.get_default();
            this._monitorTimeout = Mainloop.timeout_add(300, () => this._monitorClipboard());
        } catch (e) {
            global.logError(e);
        }
    },

    settings_changed: function () {
        // Enforce max history size limit immediately
        if (this._history.length > this._historySize) {
            this._history = this._history.slice(0, this._historySize);
            this._saveHistory();
        }
    },

    _monitorClipboard: function () {
        if (!this._clipboard) return true;

        this._clipboard.get_text(St.ClipboardType.CLIPBOARD, (clipboard, text) => {
            if (text && text.trim() !== "") {
                if (text !== this._lastText) {
                    // Ignore duplicate bubble up checks
                    if (this._history.length > 0 && text === this._history[0]) {
                        this._lastText = text;
                        return;
                    }
                    this._lastText = text;
                    this._lastImageHash = ""; // Clear active image tracking
                    this._addToHistory(text);
                }
            } else {
                // If text is empty/null, it might be an image in the clipboard
                this._checkImageClipboard();
            }
        });

        return true;
    },

    _checkImageClipboard: function () {
        let cmd = [
            "bash",
            "-c",
            "if xclip -selection clipboard -t TARGETS -o | grep -q 'image/png'; then hash=$(xclip -selection clipboard -t image/png -o | md5sum | cut -d' ' -f1); echo \"IMAGE:$hash\"; fi"
        ];
        
        try {
            let launcher = new Gio.SubprocessLauncher({
                flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_SILENCE
            });
            let proc = launcher.spawnv(cmd);
            let stdoutStream = new Gio.DataInputStream({
                base_stream: proc.get_stdout_pipe(),
                close_base_stream: true
            });
            
            stdoutStream.read_line_async(GLib.PRIORITY_LOW, null, (stream, result) => {
                try {
                    let [line] = stream.read_line_finish_utf8(result);
                    if (line) {
                        line = line.trim();
                        if (line.startsWith("IMAGE:")) {
                            let hash = line.substring(6);
                            if (hash && hash !== this._lastImageHash) {
                                this._lastImageHash = hash;
                                this._lastText = ""; // Clear active text tracking
                                this._saveImageAndAddToHistory(hash);
                            }
                        }
                    }
                } catch (e) {
                    // Ignore stream read errors
                }
            });
            
            proc.wait_async(null, null);
        } catch (e) {
            global.logError("Failed to check image clipboard: " + e);
        }
    },

    _saveImageAndAddToHistory: function (hash) {
        let cacheDir = GLib.get_user_config_dir() + "/cinnamon/spices/" + UUID + "/cache";
        let imagePath = cacheDir + "/" + hash + ".png";
        
        let cmd = [
            "bash",
            "-c",
            "mkdir -p \"" + cacheDir + "\" && xclip -selection clipboard -t image/png -o > \"" + imagePath + "\""
        ];
        
        try {
            let launcher = new Gio.SubprocessLauncher({
                flags: Gio.SubprocessFlags.NONE
            });
            let proc = launcher.spawnv(cmd);
            proc.wait_async(null, (proc, result) => {
                let itemIdentifier = "[Image]:" + hash;
                this._addToHistory(itemIdentifier);
            });
        } catch (e) {
            global.logError("Failed to save clipboard image: " + e);
        }
    },

    _addToHistory: function (text) {
        // Remove existing duplicates to bubble up the copied item
        this._history = this._history.filter(item => item !== text);
        this._history.unshift(text);

        // Limit size
        if (this._history.length > this._historySize) {
            this._history = this._history.slice(0, this._historySize);
        }

        this._saveHistory();

        if (this._notifyOnCopy) {
            let label = text.startsWith("[Image]:") ? _("[Image Copied]") : this._formatLabel(text);
            Main.notify(_("Clipboard Copied"), label);
        }
    },

    _formatLabel: function (text) {
        let label = text.trim();
        label = label.replace(/\s+/g, ' '); // Replace newlines/tabs with spaces
        if (label.length > 45) {
            label = label.substring(0, 42) + "...";
        }
        return label;
    },

    _saveHistory: function () {
        let configDir = GLib.get_user_config_dir() + "/cinnamon/spices/" + UUID;
        let historyPath = configDir + "/history.dat";
        let file = Gio.File.new_for_path(historyPath);
        let parent = file.get_parent();
        
        parent.make_directory_with_parents_async(GLib.PRIORITY_DEFAULT, null, (parentDir, dir_res) => {
            try {
                parentDir.make_directory_with_parents_finish(dir_res);
            } catch (err) {
                if (!err.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.EXISTS)) {
                    global.logError("Failed to create history directory: " + err);
                    return;
                }
            }
            
            try {
                let data = JSON.stringify(this._history, null, 2);
                let bytes = GLib.Bytes.new(data);
                file.replace_contents_async(
                    bytes,
                    null,
                    false,
                    Gio.FileCreateFlags.REPLACE_DESTINATION,
                    null,
                    (f, replace_res) => {
                        try {
                            f.replace_contents_finish(replace_res);
                        } catch (err) {
                            global.logError("Failed to save clipboard history contents: " + err);
                        }
                    }
                );
            } catch (e) {
                global.logError("Failed to serialize history: " + e);
            }
        });
    },

    _loadHistory: function () {
        let configDir = GLib.get_user_config_dir() + "/cinnamon/spices/" + UUID;
        let historyPath = configDir + "/history.dat";
        let file = Gio.File.new_for_path(historyPath);
        
        file.load_contents_async(null, (file, res) => {
            try {
                let [success, contents, etag] = file.load_contents_finish(res);
                if (success && contents) {
                    let decoder = new TextDecoder("utf-8");
                    this._history = JSON.parse(decoder.decode(contents));
                    if (this._history && this._history.length > 0) {
                        let first = this._history[0];
                        if (first.startsWith("[Image]:")) {
                            this._lastImageHash = first.substring(8);
                            this._lastText = "";
                        } else {
                            this._lastText = first;
                            this._lastImageHash = "";
                        }
                    }
                }
            } catch (e) {
                if (!e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.NOT_FOUND)) {
                    global.logError("Failed to load clipboard history: " + e);
                }
                this._history = [];
            }
        });
    },

    on_applet_clicked: function (event) {
        this._buildMenu();
        this.menu.toggle();
    },

    _buildMenu: function () {
        this.menu.removeAll();

        let getActionLabel = (actionName) => {
            if (actionName === "select") return _("Select (Copy/Paste)");
            if (actionName === "edit") return _("Edit Item");
            if (actionName === "delete") return _("Delete Item");
            return _("None");
        };
        let getTooltipSuffix = () => {
            return "\n\n" + _("Left-Click: ") + getActionLabel(this._leftClickAction) +
                   "\n" + _("Middle-Click: ") + getActionLabel(this._middleClickAction) +
                   "\n" + _("Right-Click: ") + getActionLabel(this._rightClickAction);
        };

        // Header Title
        let headerText = _("Clipboard History");
        if (this._history.length > 0) {
            headerText += " (" + this._history.length + ")";
        }
        let headerItem = new PopupMenu.PopupMenuItem(headerText, { reactive: false });
        this.menu.addMenuItem(headerItem);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // History List
        if (this._history.length === 0) {
            let emptyItem = new PopupMenu.PopupMenuItem(_("Clipboard is empty"), { reactive: false });
            this.menu.addMenuItem(emptyItem);
        } else {
            let historySection = new ScrollableMenuSection(this._menuMaxHeight);
            for (let itemText of this._history) {
                if (itemText.startsWith("[Image]:")) {
                    let hash = itemText.substring(8);
                    let cacheDir = GLib.get_user_config_dir() + "/cinnamon/spices/" + UUID + "/cache";
                    let imagePath = cacheDir + "/" + hash + ".png";
                    
                    let imageFile = Gio.File.new_for_path(imagePath);
                    let gicon = Gio.FileIcon.new(imageFile);
                    let label = _("[Image Preview] (" + hash.substring(0, 6) + ")");
                    let menuItem = new PopupMenu.PopupIconMenuItem(label, "image-x-generic", St.IconType.FULLCOLOR);
                    
                    try {
                        menuItem._icon.gicon = gicon;
                        menuItem._icon.icon_size = 32; 
                    } catch (err) {
                        global.logError("Failed to set thumbnail icon: " + err);
                    }

                    let handleImageAction = (action) => {
                        if (action === "select") {
                            this._onImageItemClicked(hash);
                            return true;
                        } else if (action === "edit") {
                            let infoCmd = [
                                "yad",
                                "--info",
                                "--title=" + _("Edit Clipboard Item"),
                                "--text=" + _("Image entries cannot be edited."),
                                "--width=300"
                            ];
                            Util.spawn(infoCmd);
                            return true;
                        } else if (action === "delete") {
                            this._deleteHistoryItem(itemText);
                            return true;
                        }
                        return false;
                    };

                    menuItem.connect('activate', () => {
                        handleImageAction(this._leftClickAction);
                    });

                    menuItem.actor.connect('button-press-event', (actor, event) => {
                        let button = event.get_button();
                        if (button === 2) {
                            return handleImageAction(this._middleClickAction);
                        } else if (button === 3) {
                            return handleImageAction(this._rightClickAction);
                        }
                        return false;
                    });

                    new Tooltips.Tooltip(menuItem.actor, _("Image File: ") + imagePath + getTooltipSuffix());
                    
                    if (hash === this._lastImageHash) {
                        menuItem.label.set_style("font-weight: bold;");
                    }
                    
                    historySection.addMenuItem(menuItem);

                    // --- AUDITOR FIX: Async validation of file existence ---
                    imageFile.query_info_async(
                        "standard::type",
                        Gio.FileQueryInfoFlags.NONE,
                        GLib.PRIORITY_DEFAULT,
                        null,
                        (fileObj, res) => {
                            try {
                                fileObj.query_info_finish(res);
                                // File exists and is accessible. Keep it.
                            } catch (e) {
                                // File doesn't exist or is unreadable. Remove item safely from UI.
                                menuItem.destroy();
                            }
                        }
                    );
                } else {
                    let formatted = this._formatLabel(itemText);
                    let menuItem = new PopupMenu.PopupMenuItem(formatted);
                    
                    let handleTextAction = (action) => {
                        if (action === "select") {
                            this._onItemClicked(itemText);
                            return true;
                        } else if (action === "edit") {
                            this._editHistoryItem(itemText);
                            return true;
                        } else if (action === "delete") {
                            this._deleteHistoryItem(itemText);
                            return true;
                        }
                        return false;
                    };

                    menuItem.connect('activate', () => {
                        handleTextAction(this._leftClickAction);
                    });

                    menuItem.actor.connect('button-press-event', (actor, event) => {
                        let button = event.get_button();
                        if (button === 2) {
                            return handleTextAction(this._middleClickAction);
                        } else if (button === 3) {
                            return handleTextAction(this._rightClickAction);
                        }
                        return false;
                    });

                    new Tooltips.Tooltip(menuItem.actor, itemText + getTooltipSuffix());
                    
                    if (itemText === this._lastText) {
                        menuItem.label.set_style("font-weight: bold;");
                    }
                    
                    historySection.addMenuItem(menuItem);
                }
            }
            this.menu.addMenuItem(historySection);
        }

        // Action Options
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        let clearItem = new PopupMenu.PopupIconMenuItem(_("Clear History"), "edit-clear-symbolic", St.IconType.SYMBOLIC);
        clearItem.connect('activate', () => this._clearHistory());
        if (this._history.length === 0) {
            clearItem.setSensitive(false);
        }
        this.menu.addMenuItem(clearItem);
    },

    _onItemClicked: function (text) {
        this._clipboard.set_text(St.ClipboardType.CLIPBOARD, text);
        this._lastText = text;

        // Move to the top of the history list
        this._history = this._history.filter(item => item !== text);
        this._history.unshift(text);
        this._saveHistory();

        this.menu.close();

        if (this._autoPaste && this._pasteTool !== "none") {
            Mainloop.timeout_add(150, () => {
                this._pasteText();
                return false;
            });
        }
    },

    _onImageItemClicked: function (hash) {
        let cacheDir = GLib.get_user_config_dir() + "/cinnamon/spices/" + UUID + "/cache";
        let imagePath = cacheDir + "/" + hash + ".png";
        
        let cmd = [
            "xclip",
            "-selection",
            "clipboard",
            "-t",
            "image/png",
            "-i",
            imagePath
        ];
        
        try {
            let launcher = new Gio.SubprocessLauncher({
                flags: Gio.SubprocessFlags.NONE
            });
            let proc = launcher.spawnv(cmd);
            proc.wait_async(null, (proc, result) => {
                // Move this image item to the top of the history list
                let itemIdentifier = "[Image]:" + hash;
                this._history = this._history.filter(item => item !== itemIdentifier);
                this._history.unshift(itemIdentifier);
                this._saveHistory();
                
                this._lastImageHash = hash;
                this._lastText = ""; // Reset text so image is active selection
            });
        } catch (e) {
            global.logError("Failed to copy image to clipboard: " + e);
        }
        
        this.menu.close();
        
        if (this._autoPaste && this._pasteTool !== "none") {
            Mainloop.timeout_add(150, () => {
                this._pasteText();
                return false;
            });
        }
    },

    _pasteText: function () {
        let tool = this._pasteTool;
        try {
            if (tool === "xdotool") {
                if (GLib.find_program_in_path("xdotool")) {
                    Util.spawn(["xdotool", "key", "--clearmodifiers", "ctrl+v"]);
                } else {
                    Main.notify(_("Clipboard Error"), _("xdotool is not installed. Please install it or select another paste tool in settings."));
                }
            } else if (tool === "dotool") {
                if (GLib.find_program_in_path("dotool")) {
                    try {
                        let launcher = new Gio.SubprocessLauncher({
                            flags: Gio.SubprocessFlags.STDIN_PIPE
                        });
                        let proc = launcher.spawnv(["dotool"]);
                        let stdin = proc.get_stdin_pipe();
                        stdin.write_all_async("key ctrl+v\n", GLib.PRIORITY_DEFAULT, null, (stream, result) => {
                            try {
                                stream.write_all_finish(result);
                            } catch (err) {
                                global.logError("Failed to write to dotool: " + err);
                            }
                            try {
                                stream.close_async(GLib.PRIORITY_DEFAULT, null, null);
                            } catch (e) {}
                        });
                    } catch (err) {
                        global.logError("Failed to run dotool: " + err);
                    }
                } else {
                    Main.notify(_("Clipboard Error"), _("dotool is not installed. Please install it or select another paste tool in settings."));
                }
            }
        } catch (e) {
            global.logError("Failed to simulate paste: " + e);
        }
    },

    _clearHistory: function () {
        this._history = [];
        this._saveHistory();

        // Clean cache directory asynchronously
        let cacheDir = GLib.get_user_config_dir() + "/cinnamon/spices/" + UUID + "/cache";
        let cacheFolder = Gio.File.new_for_path(cacheDir);
        
        cacheFolder.enumerate_children_async(
            "standard::name",
            Gio.FileQueryInfoFlags.NONE,
            GLib.PRIORITY_DEFAULT,
            null,
            (folder, res) => {
                try {
                    let enumerator = folder.enumerate_children_finish(res);
                    this._deleteNextFile(enumerator, folder);
                } catch (e) {
                    if (!e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.NOT_FOUND)) {
                        global.logError("Failed to enumerate cache files: " + e);
                    }
                }
            }
        );

        this._buildMenu();
    },

    _deleteNextFile: function (enumerator, folder) {
        enumerator.next_files_async(100, GLib.PRIORITY_DEFAULT, null, (enum_obj, res) => {
            try {
                let files = enum_obj.next_files_finish(res);
                if (files && files.length > 0) {
                    let deletedCount = 0;
                    for (let info of files) {
                        let file = folder.get_child(info.get_name());
                        file.delete_async(GLib.PRIORITY_DEFAULT, null, (f, r) => {
                            try {
                                f.delete_finish(r);
                            } catch (e) {
                                // Ignore file deletion errors
                            }
                            deletedCount++;
                            if (deletedCount === files.length) {
                                this._deleteNextFile(enumerator, folder);
                            }
                        });
                    }
                } else {
                    enumerator.close_async(GLib.PRIORITY_DEFAULT, null, (e_obj, c_res) => {
                        try {
                            e_obj.close_finish(c_res);
                        } catch (err) {
                            // Ignore error closing enumerator
                        }
                    });
                }
            } catch (e) {
                global.logError("Failed to delete cache files: " + e);
            }
        });
    },

    _editHistoryItem: function (oldText) {
        let index = this._history.indexOf(oldText);
        if (index !== -1) {
            this._editHistoryItemAtIndex(index);
        }
    },

    _editHistoryItemAtIndex: function (idx) {
        let oldText = this._history[idx];
        let editCmd = [
            "yad",
            "--entry",
            "--title=" + _("Edit Clipboard Item"),
            "--text=" + _("Modify the clipboard entry:"),
            "--entry-text=" + oldText,
            "--width=500"
        ];
        
        try {
            let launcher = new Gio.SubprocessLauncher({
                flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_SILENCE
            });
            let proc = launcher.spawnv(editCmd);
            let stdoutStream = new Gio.DataInputStream({
                base_stream: proc.get_stdout_pipe(),
                close_base_stream: true
            });
            
            stdoutStream.read_line_async(GLib.PRIORITY_LOW, null, (stream, result) => {
                try {
                    let [line] = stream.read_line_finish_utf8(result);
                    if (line !== null) {
                        let editedText = line.trim();
                        if (editedText !== "" && editedText !== oldText) {
                            this._history[idx] = editedText;
                            this._saveHistory();
                            this._buildMenu();
                            if (this._lastText === oldText) {
                                this._lastText = editedText;
                                this._clipboard.set_text(St.ClipboardType.CLIPBOARD, editedText);
                            }
                        }
                    }
                } catch (err) {
                    global.logError("Failed to read edited text: " + err);
                }
            });
        } catch (e) {
            global.logError("Failed to edit clipboard item: " + e);
        }
    },

    launchHistoryManager: function () {
        if (this._history.length === 0) {
            let infoCmd = [
                "yad",
                "--info",
                "--title=" + _("Manage Clipboard History"),
                "--text=" + _("Clipboard history is empty."),
                "--width=300"
            ];
            Util.spawn(infoCmd);
            return;
        }

        let listCmd = [
            "yad",
            "--list",
            "--title=" + _("Manage Clipboard History"),
            "--text=" + _("Select an item to edit:"),
            "--column=Index",
            "--column=Content",
            "--column=@fore@",
            "--column=@font@",
            "--hide-column=1",
            "--print-column=1",
            "--width=600",
            "--height=400"
        ];

        for (let i = 0; i < this._history.length; i++) {
            let item = this._history[i];
            let isActive = false;
            if (item.startsWith("[Image]:")) {
                let hash = item.substring(8);
                isActive = (hash === this._lastImageHash);
            } else {
                isActive = (item === this._lastText);
            }

            let label = item.startsWith("[Image]:") ? _("[Image] (") + item.substring(8, 14) + ")" : item;
            if (label.length > 80) {
                label = label.substring(0, 77) + "...";
            }
            
            listCmd.push(i.toString());
            listCmd.push(label);
            listCmd.push(isActive ? "#3584e4" : "");
            listCmd.push(isActive ? "bold" : "");
        }

        try {
            let launcher = new Gio.SubprocessLauncher({
                flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_SILENCE
            });
            let proc = launcher.spawnv(listCmd);
            let stdoutStream = new Gio.DataInputStream({
                base_stream: proc.get_stdout_pipe(),
                close_base_stream: true
            });
            
            stdoutStream.read_line_async(GLib.PRIORITY_LOW, null, (stream, result) => {
                try {
                    let [line] = stream.read_line_finish_utf8(result);
                    if (line !== null) {
                        let idx = parseInt(line.trim(), 10);
                        if (!isNaN(idx) && idx >= 0 && idx < this._history.length) {
                            let oldText = this._history[idx];
                            if (oldText.startsWith("[Image]:")) {
                                let infoCmd = [
                                    "yad",
                                    "--info",
                                    "--title=" + _("Edit Clipboard Item"),
                                    "--text=" + _("Image entries cannot be edited."),
                                    "--width=300"
                                ];
                                Util.spawn(infoCmd);
                            } else {
                                this._editHistoryItemAtIndex(idx);
                            }
                        }
                    }
                } catch (err) {
                    global.logError("Failed to read selection: " + err);
                }
            });
        } catch (e) {
            global.logError("Failed to launch history manager: " + e);
        }
    },

    _deleteHistoryItem: function (itemText) {
        this._history = this._history.filter(item => item !== itemText);
        this._saveHistory();
        this._buildMenu();

        if (itemText === this._lastText) {
            this._lastText = "";
        }
        if (itemText.startsWith("[Image]:")) {
            let hash = itemText.substring(8);
            if (hash === this._lastImageHash) {
                this._lastImageHash = "";
            }
            let cacheDir = GLib.get_user_config_dir() + "/cinnamon/spices/" + UUID + "/cache";
            let imagePath = cacheDir + "/" + hash + ".png";
            let imageFile = Gio.File.new_for_path(imagePath);
            imageFile.delete_async(GLib.PRIORITY_DEFAULT, null, (f, res) => {
                try {
                    f.delete_finish(res);
                } catch (e) {
                    // Ignore deletion errors
                }
            });
        }
    },

    on_applet_removed_from_panel: function () {
        if (this._monitorTimeout) {
            Mainloop.source_remove(this._monitorTimeout);
            this._monitorTimeout = null;
        }
    }
};

function main(metadata, orientation, panel_height, instance_id) {
    return new MyApplet(metadata, orientation, panel_height, instance_id);
}
