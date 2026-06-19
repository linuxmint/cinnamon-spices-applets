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

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");

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

            // Set up UI Menu
            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager.addMenu(this.menu);

            // Load saved history
            this._loadHistory();

            // Setup Clipboard Monitor
            this._clipboard = St.Clipboard.get_default();
            this._monitorTimeout = Mainloop.timeout_add(300, Lang.bind(this, this._monitorClipboard));
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

        this._clipboard.get_text(St.ClipboardType.CLIPBOARD, Lang.bind(this, function (clipboard, text) {
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
        }));

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
            
            stdoutStream.read_line_async(GLib.PRIORITY_LOW, null, Lang.bind(this, function(stream, result) {
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
            }));
            
            proc.wait_async(null, null);
        } catch (e) {
            global.logError("Failed to check image clipboard: " + e);
        }
    },

    _saveImageAndAddToHistory: function (hash) {
        let cacheDir = GLib.get_home_dir() + "/.config/cinnamon/spices/" + UUID + "/cache";
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
            proc.wait_async(null, Lang.bind(this, function(proc, result) {
                let itemIdentifier = "[Image]:" + hash;
                this._addToHistory(itemIdentifier);
            }));
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
        let configDir = GLib.get_home_dir() + "/.config/cinnamon/spices/" + UUID;
        let historyPath = configDir + "/history.dat";
        let file = Gio.File.new_for_path(historyPath);
        try {
            let parent = file.get_parent();
            if (!parent.query_exists(null)) {
                parent.make_directory_with_parents(null);
            }
            let data = JSON.stringify(this._history, null, 2);
            file.replace_contents(
                data,
                null,
                false,
                Gio.FileCreateFlags.REPLACE_DESTINATION,
                null
            );
        } catch (e) {
            global.logError("Failed to save clipboard history: " + e);
        }
    },

    _loadHistory: function () {
        let historyPath = GLib.get_home_dir() + "/.config/cinnamon/spices/" + UUID + "/history.dat";
        let file = Gio.File.new_for_path(historyPath);
        try {
            if (file.query_exists(null)) {
                let [ok, contents] = GLib.file_get_contents(historyPath);
                if (ok && contents) {
                    this._history = JSON.parse(imports.byteArray.toString(contents));
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
            }
        } catch (e) {
            global.logError("Failed to load clipboard history: " + e);
            this._history = [];
        }
    },

    on_applet_clicked: function (event) {
        this._buildMenu();
        this.menu.toggle();
    },

    _buildMenu: function () {
        this.menu.removeAll();

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
                    let cacheDir = GLib.get_home_dir() + "/.config/cinnamon/spices/" + UUID + "/cache";
                    let imagePath = cacheDir + "/" + hash + ".png";
                    
                    let imageFile = Gio.File.new_for_path(imagePath);
                    if (imageFile.query_exists(null)) {
                        let gicon = Gio.FileIcon.new(imageFile);
                        let label = _("[Image Preview] (" + hash.substring(0, 6) + ")");
                        let menuItem = new PopupMenu.PopupIconMenuItem(label, "image-x-generic", St.IconType.FULLCOLOR);
                        
                        try {
                            menuItem._icon.gicon = gicon;
                            menuItem._icon.icon_size = 32; // Larger size for preview
                        } catch (err) {
                            global.logError("Failed to set thumbnail icon: " + err);
                        }

                        menuItem.connect('activate', Lang.bind(this, function () {
                            this._onImageItemClicked(hash);
                        }));

                        new Tooltips.Tooltip(menuItem.actor, _("Image File: ") + imagePath);
                        historySection.addMenuItem(menuItem);
                    }
                } else {
                    let formatted = this._formatLabel(itemText);
                    let menuItem = new PopupMenu.PopupMenuItem(formatted);
                    
                    menuItem.connect('activate', Lang.bind(this, function () {
                        this._onItemClicked(itemText);
                    }));

                    new Tooltips.Tooltip(menuItem.actor, itemText);
                    historySection.addMenuItem(menuItem);
                }
            }
            this.menu.addMenuItem(historySection);
        }

        // Action Options
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        let clearItem = new PopupMenu.PopupIconMenuItem(_("Clear History"), "edit-clear-symbolic", St.IconType.SYMBOLIC);
        clearItem.connect('activate', Lang.bind(this, this._clearHistory));
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
            Mainloop.timeout_add(150, Lang.bind(this, function () {
                this._pasteText();
                return false;
            }));
        }
    },

    _onImageItemClicked: function (hash) {
        let cacheDir = GLib.get_home_dir() + "/.config/cinnamon/spices/" + UUID + "/cache";
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
            proc.wait_async(null, Lang.bind(this, function (proc, result) {
                // Move this image item to the top of the history list
                let itemIdentifier = "[Image]:" + hash;
                this._history = this._history.filter(item => item !== itemIdentifier);
                this._history.unshift(itemIdentifier);
                this._saveHistory();
                
                this._lastImageHash = hash;
                this._lastText = ""; // Reset text so image is active selection
            }));
        } catch (e) {
            global.logError("Failed to copy image to clipboard: " + e);
        }
        
        this.menu.close();
        
        if (this._autoPaste && this._pasteTool !== "none") {
            Mainloop.timeout_add(150, Lang.bind(this, function () {
                this._pasteText();
                return false;
            }));
        }
    },

    _pasteText: function () {
        let tool = this._pasteTool;
        try {
            if (tool === "xdotool") {
                if (GLib.find_program_in_path("xdotool")) {
                    Util.spawnCommandLine("xdotool key --clearmodifiers ctrl+v");
                } else {
                    Main.notify(_("Clipboard Error"), _("xdotool is not installed. Please install it or select another paste tool in settings."));
                }
            } else if (tool === "dotool") {
                if (GLib.find_program_in_path("dotool")) {
                    Util.spawnCommandLine("echo 'key ctrl+v' | dotool");
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

        // Clean cache directory
        let cacheDir = GLib.get_home_dir() + "/.config/cinnamon/spices/" + UUID + "/cache";
        let cacheFolder = Gio.File.new_for_path(cacheDir);
        try {
            if (cacheFolder.query_exists(null)) {
                let enumerator = cacheFolder.enumerate_children(
                    'standard::name',
                    Gio.FileQueryInfoFlags.NONE,
                    null
                );
                let info;
                while ((info = enumerator.next_file(null)) !== null) {
                    let file = cacheFolder.get_child(info.get_name());
                    file.delete(null);
                }
            }
        } catch (e) {
            global.logError("Failed to clean clipboard cache: " + e);
        }

        this._buildMenu();
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
