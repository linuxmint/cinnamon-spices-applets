/* [Quick Menu Applet]
 * License: GPLv3
 *
 * Applet based on code found on the following applets:
 *    Custom Applications Menu 2.0 by Nicolas LLOBERA. https://cinnamon-spices.linuxmint.com/applets/view/113
 *    Scripts Menu 0.3 by Pau Capó. https://cinnamon-spices.linuxmint.com/applets/view/185
 */
const $ = imports.applet.__init__;
const _ = $._;
const Applet = imports.ui.applet;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;
const Lang = imports.lang;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const Settings = imports.ui.settings;
const Tooltips = imports.ui.tooltips;
const Util = imports.misc.util;
const Mainloop = imports.mainloop;

function MyApplet() {
    this._init.apply(this, arguments);
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

        try {
            this._bindSettings();
            this.metadata = aMetadata;
            this.orientation = aOrientation;
            this.instance_id = aInstance_id;
            this.menuManager = new PopupMenu.PopupMenuManager(this);

            this.directory_last = this.pref_directory;

            this._expand_applet_context_menu();
            this._onSettingsCustomTooltip();

            this.main_folder_monitor = null;
            this.monitor_id = 0;
            this.update_menu_id = 0;
            this.folder_changed_id = 0;

            // on_orientation_changed also triggers this.menu creation and this._updateIconAndLabel()
            this.on_orientation_changed(this.orientation);
            this.dealWithFolderMonitor();
            this._updateMenu(true);
        } catch (aErr) {
            global.logError(aErr);
        }
    },

    dealWithFolderMonitor: function(aRem) {
        if (this.monitor_id > 0) {
            this.main_folder_monitor.disconnect(this.monitor_id);
        }

        if (!this.pref_autoupdate || aRem)
            return;

        if (this.directory_last && GLib.file_test(this.directory_last, GLib.FileTest.IS_DIR)) {
            this.main_folder_monitor = Gio.file_new_for_path(this.directory_last)
                .monitor_directory(Gio.FileMonitorFlags.NONE, null);
            this.monitor_id = this.main_folder_monitor.connect("changed",
                Lang.bind(this, this._onMainFolderChanged));
        }
    },

    _onMainFolderChanged: function(aMonitor, aFileObj, aN, aEventType) {
        if (this.folder_changed_id > 0) {
            Mainloop.source_remove(this.folder_changed_id);
            this.folder_changed_id = null;
        }

        if (aEventType &&
            (aEventType === Gio.FileMonitorEvent.DELETED ||
                aEventType === Gio.FileMonitorEvent.RENAMED ||
                aEventType === Gio.FileMonitorEvent.CREATED ||
                aEventType === Gio.FileMonitorEvent.MOVED)) {

            this.folder_changed_id = Mainloop.timeout_add(1000, Lang.bind(this, this._updateMenu));
        }
    },

    _subMenuOpenStateChanged: function(aMenu, aOpen) {
        if (aOpen) {
            let children = aMenu._getTopMenu()._getMenuItems();
            let i = 0,
                iLen = children.length;
            for (; i < iLen; i++) {
                let item = children[i];
                if (item instanceof $.CustomSubMenuMenuItem) {
                    if (aMenu !== item.menu) {
                        item.menu.close(true);
                    }
                }
            }
        }
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
            [bD.BIDIRECTIONAL, "pref_directory", this._onSettingsDirectory],
            [bD.BIDIRECTIONAL, "pref_sub_menu_icons_file_name", null],
            [bD.IN, "pref_auto_close_opened_sub_menus", this._updateMenu],
            [bD.IN, "pref_ignore_sub_folders", this._updateMenu],
            [bD.IN, "pref_show_only_desktop_files", this._updateMenu],
            [bD.IN, "pref_show_submenu_icons", this._updateMenu],
            [bD.IN, "pref_show_applications_icons", this._updateMenu],
            [bD.IN, "pref_show_applet_title", this._updateIconAndLabel],
            [bD.IN, "pref_applet_title", this._updateIconAndLabel],
            [bD.IN, "pref_show_hidden_files", this._updateMenu],
            [bD.IN, "pref_show_hidden_folders", this._updateMenu],
            [bD.IN, "pref_autoupdate", this._onSettingsAutoupdate],
            [bD.IN, "pref_customtooltip", this._onSettingsCustomTooltip],
            [bD.IN, "pref_show_customicon", this._updateIconAndLabel],
            [bD.IN, "pref_customicon", this._updateIconAndLabel],
            [bD.IN, "pref_icon_for_menus", this._updateMenu],
            [bD.IN, "pref_hotkey", this._updateKeybinding],
            [bD.IN, "pref_use_different_icons_for_sub_menus", this._updateMenu],
            [bD.IN, "pref_style_for_sub_menus", this._updateMenu],
            [bD.IN, "pref_style_for_menu_items", this._updateMenu],
            [bD.IN, "pref_sub_menu_icon_size", this._updateMenu],
            [bD.IN, "pref_menu_item_icon_size", this._updateMenu],
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

    updateLabelVisibility: function() {
        // Condition needed for retro-compatibility.
        // Mark for deletion on EOL.
        if (typeof this.hide_applet_label !== "function")
            return;

        if (this.orientation == St.Side.LEFT || this.orientation == St.Side.RIGHT) {
            this.hide_applet_label(true);
        } else {
            if (this.pref_applet_title === "") {
                this.hide_applet_label(true);
            } else {
                this.hide_applet_label(false);
            }
        }
    },

    on_orientation_changed: function(orientation) {
        this.orientation = orientation;

        if (this.menu)
            this.menu.destroy();

        this.menu = new Applet.AppletPopupMenu(this, orientation, this.instance_id);
        this.menuManager.addMenu(this.menu);
        this._updateIconAndLabel();
        this._updateMenu();

        // Temporarily added to fix an upstream bug.
        Mainloop.timeout_add_seconds(5, Lang.bind(this, function() {
            if (this.context_menu_item_remove) {
                // NOTE: This string could be left blank because it's a default string,
                // so it's already translated by Cinnamon. It's up to the translators.
                this.context_menu_item_remove.label.set_text(_("Remove '%s'")
                    .format(_(this.metadata.name)));
            }
        }));
    },

    _updateMenu: function(aRightNow) {
        if (this.update_menu_id > 0) {
            Mainloop.source_remove(this.update_menu_id);
            this.update_menu_id = null;
        }

        this.update_menu_id = Mainloop.timeout_add((aRightNow ? 10 : 1000),
            Lang.bind(this, function() {
                this.menu.removeAll();
                this._loadDir(this.pref_directory, this.menu);
            }));
    },

    _loadDir: function(aDir, aMenu) {
        if (!aDir || !aMenu)
            return;

        // Workaround for Cinnamon 3.2.x settings window path selectors.
        // They return an URI instead of a path like they used to. ¬¬
        if (/^file:\/\//.test(aDir))
            aDir = aDir.substr(7);

        let currentDir = Gio.file_new_for_path(aDir);

        if (currentDir.query_exists(null)) {
            let iconsForFolders = null;

            if (this.pref_use_different_icons_for_sub_menus) {
                if (this.pref_sub_menu_icons_file_name === "")
                    this.pref_sub_menu_icons_file_name = "0_icons_for_sub_menus.json";

                let iconsForSubMenusFile = Gio.file_new_for_path(aDir + "/" +
                    this.pref_sub_menu_icons_file_name);

                if (iconsForSubMenusFile.query_exists(null)) {
                    iconsForSubMenusFile.load_contents_async(null,
                        Lang.bind(this, function(aFile, aResponce) {
                            let rawData;
                            try {
                                rawData = aFile.load_contents_finish(aResponce)[1];
                                iconsForFolders = JSON.parse(rawData);
                            } catch (aErr) {
                                global.logError("ERROR: " + aErr.message);
                                this._handleDir(aDir, currentDir, aMenu, null);
                                return;
                            }
                            this._handleDir(aDir, currentDir, aMenu, iconsForFolders);
                        }));
                }
            } else {
                this._handleDir(aDir, currentDir, aMenu, iconsForFolders);
            }
        }
    },

    _handleDir: function(aDir, aCurrentDir, aMenu, aIconsForFolders) {
        let dirs = [];
        let files = [];
        let filter = "standard::name,standard::is-symlink,standard::is-hidden," +
            "standard::type,standard::size";
        let enumerator = aCurrentDir.enumerate_children(
            filter,
            Gio.FileQueryInfoFlags.NONE,
            null,
            null
        );
        let file;

        try {
            // Get all dirs and files
            while ((file = enumerator.next_file(null)) !== null) {
                let fileName = file.get_name();
                let fileType = file.get_file_type();

                if (fileType === Gio.FileType.DIRECTORY) {
                    if (this.pref_ignore_sub_folders)
                        continue;

                    if (/^\./.test(fileName) && !this.pref_show_hidden_folders)
                        continue;

                    let iconName = this.pref_icon_for_menus;
                    if (this.pref_show_submenu_icons &&
                        this.pref_use_different_icons_for_sub_menus &&
                        aIconsForFolders !== null &&
                        aIconsForFolders[fileName]) {
                        iconName = aIconsForFolders[fileName];

                        if (/^\~\//.test(iconName))
                            iconName = iconName.replace(/^\~/, GLib.get_home_dir());
                    }

                    dirs.push({
                        folderName: fileName,
                        iconName: iconName,
                    });
                } else {
                    if (!/.desktop$/.test(fileName) && this.pref_show_only_desktop_files)
                        continue;

                    if (/^\./.test(fileName) && !this.pref_show_hidden_files)
                        continue;

                    if (fileName === this.pref_sub_menu_icons_file_name)
                        continue;

                    let filePath = aDir + "/" + fileName;
                    let isSymlink = GLib.file_test(filePath, GLib.FileTest.IS_SYMLINK);

                    // If in the presence of a symlink, use the path to the "real file",
                    // not the path to the symlink.
                    if (isSymlink)
                        filePath = GLib.file_read_link(filePath);

                    // If the symlink leads to an invalid file, ignore it.
                    if (isSymlink && !GLib.file_test(filePath, GLib.FileTest.EXISTS))
                        continue;

                    let contentType = Gio.content_type_guess(filePath, null);

                    let isDeskFile = contentType.indexOf("application/x-desktop") !== -1;
                    let app = Gio.file_new_for_path(filePath);
                    if (!app) {
                        global.logError("File " + filePath + " not found");
                        continue;
                    }

                    if (isDeskFile)
                        app = Gio.DesktopAppInfo.new_from_filename(filePath);

                    if (!app)
                        continue;

                    files.push({
                        app: app,
                        name: (isDeskFile ?
                            app.get_name() :
                            fileName)
                    });
                }
            }
        } finally {
            // Populate dirs first
            if (dirs.length > 0 && !this.pref_ignore_sub_folders) {
                dirs = dirs.sort(function(a, b) {
                    return a.folderName.localeCompare(b.folderName);
                });
                let d = 0,
                    dLen = dirs.length;
                for (; d < dLen; d++) {
                    let dirPath = aCurrentDir.get_path() + "/" + dirs[d].folderName;
                    let submenu = new $.CustomSubMenuMenuItem(this, {
                        folderName: dirs[d].folderName,
                        iconName: dirs[d].iconName
                    });

                    this._loadDir(dirPath, submenu.menu);

                    if (aDir === this.pref_directory && this.pref_auto_close_opened_sub_menus)
                        submenu.menu.connect("open-state-changed",
                            Lang.bind(this, this._subMenuOpenStateChanged));

                    aMenu.addMenuItem(submenu);
                }
            }

            // Populate files
            if (files.length > 0) {
                files = files.sort(function(a, b) {
                    return a.name.localeCompare(b.name);
                });
                let f = 0,
                    fLen = files.length;
                for (; f < fLen; f++) {
                    let item = new $.FileMenuItem(this, files[f]);

                    if (!item)
                        continue;

                    aMenu.addMenuItem(item);
                }
            }
        }
    },

    _onSettingsAutoupdate: function() {
        this.dealWithFolderMonitor();
        this._updateMenu();
    },

    _onSettingsDirectory: function() {
        if (this.pref_directory !== this.directory_last) {
            this.directory_last = this.pref_directory;
            this.dealWithFolderMonitor();
            this._updateMenu();
        }
    },

    _onSettingsCustomTooltip: function() {
        this.set_applet_tooltip(this.pref_customtooltip);
    },

    _updateIconAndLabel: function() {
        try {
            if (this.pref_show_customicon ||
                !(this.orientation === St.Side.TOP || this.orientation === St.Side.BOTTOM)) {
                if (this.pref_customicon === "") {
                    this.set_applet_icon_name("");
                } else if (GLib.path_is_absolute(this.pref_customicon) &&
                    GLib.file_test(this.pref_customicon, GLib.FileTest.EXISTS)) {
                    if (this.pref_customicon.search("-symbolic") != -1)
                        this.set_applet_icon_symbolic_path(this.pref_customicon);
                    else
                        this.set_applet_icon_path(this.pref_customicon);
                } else if (Gtk.IconTheme.get_default().has_icon(this.pref_customicon)) {
                    if (this.pref_customicon.search("-symbolic") != -1)
                        this.set_applet_icon_symbolic_name(this.pref_customicon);
                    else
                        this.set_applet_icon_name(this.pref_customicon);
                }
            } else {
                this.hide_applet_icon();
            }
        } catch (aErr) {
            global.logWarning("Could not load icon file \"" + this.pref_customicon +
                "\" for menu button.");
        }

        if (this.pref_customicon === "") {
            if (this.orientation === St.Side.TOP || this.orientation === St.Side.BOTTOM)
                this._applet_icon_box.hide();
            else // Display icon box anyways in vertical panels.
                this._applet_icon_box.show();
        } else {
            this._applet_icon_box.show();
        }

        if (this.orientation === St.Side.TOP || this.orientation === St.Side.BOTTOM) { // no menu label if in a vertical panel
            if (this.pref_show_applet_title && this.pref_applet_title !== "")
                this.set_applet_label(_(this.pref_applet_title));
            else
                this.set_applet_label("");
        } else {
            this.set_applet_label("");
        }

        this.updateLabelVisibility();
    },

    _expand_applet_context_menu: function() {
        this.update_menu_item = new PopupMenu.PopupIconMenuItem(_("Update menu"),
            "edit-redo",
            St.IconType.SYMBOLIC);
        this.update_menu_item.connect("activate", Lang.bind(this, this._updateMenu, true));
        new Tooltips.Tooltip(this.update_menu_item.actor,
            _("Scan the main folder to re-create the menu."), this.orientation);
        this._applet_context_menu.addMenuItem(this.update_menu_item);

        this.open_dir_menu_item = new PopupMenu.PopupIconMenuItem(_("Open folder"),
            "folder",
            St.IconType.SYMBOLIC);
        this.open_dir_menu_item.connect("activate", Lang.bind(this, function() {
            Util.spawn_async(["xdg-open", this.pref_directory]);
        }));
        new Tooltips.Tooltip(this.open_dir_menu_item.actor, _("Open the main folder."),
            this.orientation);
        this._applet_context_menu.addMenuItem(this.open_dir_menu_item);

        this.help_menu_item = new PopupMenu.PopupIconMenuItem(_("Help"),
            "dialog-information",
            St.IconType.SYMBOLIC);
        this.help_menu_item.connect("activate", Lang.bind(this, function() {
            Util.spawn_async(["xdg-open", this.metadata.path + "/HELP.html"]);
        }));
        new Tooltips.Tooltip(this.help_menu_item.actor, _("Open the help file."), this.orientation);
        this._applet_context_menu.addMenuItem(this.help_menu_item);
    },

    _updateKeybinding: function() {
        Main.keybindingManager.addHotKey("quick_menu_hotkey_" + this.instance_id, this.pref_hotkey,
            Lang.bind(this, function() {
                if (!Main.overview.visible && !Main.expo.visible)
                    this.menu.toggle();
            }));
    },

    on_applet_removed_from_panel: function() {
        this.dealWithFolderMonitor(true);
        this.settings.finalize();
        Main.keybindingManager.removeHotKey("quick_menu_hotkey_" + this.instance_id);
    },

    on_applet_clicked: function(event) { // jshint ignore:line
        this.menu.toggle();
    }
};

function main(aMetadata, aOrientation, aPanel_height, aInstance_id) {
    let myApplet = new MyApplet(aMetadata, aOrientation, aPanel_height, aInstance_id);
    return myApplet;
}
