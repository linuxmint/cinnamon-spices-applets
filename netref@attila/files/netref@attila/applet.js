const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Gio = imports.gi.Gio;
const St = imports.gi.St;
const MessageTray = imports.ui.messageTray;
const Main = imports.ui.main;
const Pango = imports.gi.Pango;
const Clutter = imports.gi.Clutter;
const Tooltips = imports.ui.tooltips;
const Settings = imports.ui.settings;
const GLib = imports.gi.GLib;
const Gettext = imports.gettext;
const ByteArray = imports.byteArray;
const Util = imports.misc.util;
const UUID = "netref@attila";

Gettext.bindtextdomain(UUID, GLib.get_user_data_dir() + "/locale");

function _(str) {
    return Gettext.dgettext(UUID, str);
}

const APPLET_PATH = global.userdatadir + "/applets/" + UUID;
const ICON = APPLET_PATH + "/icon.svg";
const REFDOCS = APPLET_PATH + "/refdocs";

// ============================================================
// CUSTOM MENU ITEMS (from Cheaty)
// ============================================================

function SheetMenuItem() {
    this._init.apply(this, arguments);
}

SheetMenuItem.prototype = {
    __proto__: PopupMenu.PopupSubMenuMenuItem.prototype,

    _init: function(sheet, icon, params) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this);

        this._triangle = null;

        if (typeof sheet.name === 'string') {
            this.actor.add_style_class_name('popup-submenu-menu-item');
            this.actor.add_style_class_name('cheatsheet');

            let iconFile = Gio.file_new_for_path(icon);
            try {
                let gicon = new Gio.FileIcon({ file: iconFile });
                this.icon = new St.Icon({
                    gicon: gicon,
                    icon_size: 32,
                    icon_type: St.IconType.FULLCOLOR,
                    style_class: "sheeticon"
                });
                this.addActor(this.icon);
            } catch (e) {
                // Icon not found, continue without it
            }

            this.label = new St.Label({
                text: sheet.name,
                y_expand: true,
                y_align: Clutter.ActorAlign.CENTER
            });
            this.addActor(this.label);
            this.actor.label_actor = this.label;

            this._triangleBin = new St.Bin({
                x_align: St.Align.END
            });
            this.addActor(
                this._triangleBin, {
                    expand: true,
                    span: -1,
                    align: St.Align.END
                }
            );

            this._triangle = PopupMenu.arrowIcon(St.Side.RIGHT);
            this._triangle.pivot_point = new Clutter.Point({ x: 0.5, y: 0.5 });
            this._triangleBin.child = this._triangle;
        }

        this.menu = new PopupMenu.PopupSubMenu(this.actor, this._triangle);
        this._signals.connect(this.menu, 'open-state-changed', () => this._subMenuOpenStateChanged());
        this._tooltip = new Tooltips.Tooltip(this.actor, sheet.name + " (" + _("version") + " " + sheet.version + ")\n" + sheet.description + "\n" + _("Author:") + " " + sheet.author);
    }
};

function DescriptionMenuItem() {
    this._init.apply(this, arguments);
}

DescriptionMenuItem.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    _init: function(item, callback, params) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, params);

        this.actor.add_style_class_name("sheet-item");

        this.code = item.code;

        let container = new St.BoxLayout({});
        container.set_vertical(true);

        // Windows label
        let win_box = new St.BoxLayout({});
        let win_label = new St.Label({ text: 'Windows:', style_class: 'sheet-item-win-label' });
        win_label.get_clutter_text().set_line_wrap(true);
        win_label.get_clutter_text().set_line_wrap_mode(Pango.WrapMode.WORD_CHAR);
        win_label.set_width(400);
        win_label.get_clutter_text().ellipsize = Pango.EllipsizeMode.NONE;
        win_box.add(win_label);
        container.add_actor(win_box);

        // Windows command
        let win_cmd = new St.Label({ text: item.windows || '', style_class: 'sheet-item-win-cmd'});
        win_cmd.get_clutter_text().set_line_wrap(true);
        win_cmd.get_clutter_text().set_line_wrap_mode(Pango.WrapMode.WORD_CHAR);
        win_cmd.set_width(400);
        win_cmd.get_clutter_text().ellipsize = Pango.EllipsizeMode.NONE;
        container.add_actor(win_cmd);

        // Description
        let description_box = new St.BoxLayout({});
        let description = new St.Label({ text: item.description, style_class: 'sheet-item-description' });
        description.get_clutter_text().set_line_wrap(true);
        description.get_clutter_text().set_line_wrap_mode(Pango.WrapMode.WORD_CHAR);
        description.set_width(400);
        description.get_clutter_text().ellipsize = Pango.EllipsizeMode.NONE;
        description_box.add(description);
        container.add_actor(description_box);

        // Linux label
        let lin_box = new St.BoxLayout({});
        let lin_label = new St.Label({ text: 'Linux:', style_class: 'sheet-item-lin-label' });
        lin_label.get_clutter_text().set_line_wrap(true);
        lin_label.get_clutter_text().set_line_wrap_mode(Pango.WrapMode.WORD_CHAR);
        lin_label.set_width(400);
        lin_label.get_clutter_text().ellipsize = Pango.EllipsizeMode.NONE;
        lin_box.add(lin_label);
        container.add_actor(lin_box);

        // Linux command (clickable to copy)
        let code_box = new St.BoxLayout({});
        code_box.set_vertical(true);
        let code_label = new St.Label({ text: item.code, style_class: 'sheet-item-code'});
        code_box.add(code_label);

        if (item.alternatives) {
            for (var alternative in item.alternatives) {
                let alt_label = new St.Label({ text: 'Alt: ' + item.alternatives[alternative].code, style_class: 'sheet-item-code-alternative'});
                code_box.add(alt_label);
            }
        }

        container.add_actor(code_box);

        this.addActor(container);

        return this;
    }
};

// ============================================================
// SEARCHABLE LIST WIDGET
// ============================================================

function SearchableListWidget() {
    this._init.apply(this, arguments);
}

SearchableListWidget.prototype = {
    _init: function(copyCallback) {
        this._copyCallback = copyCallback;
        this._allItems = [];
        this._buildUI();
    },

    _buildUI: function() {
        this.mainBox = new St.BoxLayout({
            vertical: true,
            style: 'min-width: 380px; max-width: 500px;'
        });

        this.searchEntry = new St.Entry({
            name: 'searchEntry',
            hint_text: 'Search commands...',
            track_hover: true,
            can_focus: true,
            style: 'background-color: #1a1a1a; color: #e0e0e0; border: 1px solid #3c3c3c; border-radius: 4px; padding: 6px 10px; font-size: 12px; margin: 6px;'
        });

        this.searchEntry.clutter_text.connect('text-changed', () => this._onSearchChanged());

        this.scrollView = new St.ScrollView({
            style: 'max-height: 450px;',
            hscrollbar_policy: St.PolicyType.NEVER,
            vscrollbar_policy: St.PolicyType.AUTOMATIC
        });

        this.itemsBox = new St.BoxLayout({
            vertical: true,
            style: 'spacing: 4px; padding: 4px;'
        });

        this.scrollView.add_actor(this.itemsBox);

        this.mainBox.add(this.searchEntry);
        this.mainBox.add(this.scrollView);
    },

    _onSearchChanged: function(entry) {
        let searchText = entry.get_text().toLowerCase().trim();
        this._filterItems(searchText);
    },

    _filterItems: function(searchText) {
        this.itemsBox.destroy_all_children();

        for (let i = 0; i < this._allItems.length; i++) {
            let item = this._allItems[i];
            let matches = !searchText ||
                item.name.toLowerCase().includes(searchText) ||
                item.description.toLowerCase().includes(searchText) ||
                item.code.toLowerCase().includes(searchText);

            if (matches) {
                let menuItem = this._createMenuItem(item);
                this.itemsBox.add(menuItem.actor);
            }
        }
    },

    _createMenuItem: function(item) {
        let menuItem = new PopupMenu.PopupBaseMenuItem();
        menuItem.actor.add_style_class_name("sheet-item");

        let container = new St.BoxLayout({ vertical: true });

        let winLabel = new St.Label({
            text: 'Windows:',
            style_class: 'sheet-item-win-label'
        });
        winLabel.get_clutter_text().set_line_wrap(true);
        winLabel.get_clutter_text().set_line_wrap_mode(Pango.WrapMode.WORD_CHAR);
        winLabel.set_width(380);
        winLabel.get_clutter_text().ellipsize = Pango.EllipsizeMode.NONE;
        container.add_actor(winLabel);

        let winCmd = new St.Label({
            text: item.windows || '',
            style_class: 'sheet-item-win-cmd'
        });
        winCmd.get_clutter_text().set_line_wrap(true);
        winCmd.get_clutter_text().set_line_wrap_mode(Pango.WrapMode.WORD_CHAR);
        winCmd.set_width(380);
        winCmd.get_clutter_text().ellipsize = Pango.EllipsizeMode.NONE;
        container.add_actor(winCmd);

        let descLabel = new St.Label({
            text: item.description,
            style_class: 'sheet-item-description'
        });
        descLabel.get_clutter_text().set_line_wrap(true);
        descLabel.get_clutter_text().set_line_wrap_mode(Pango.WrapMode.WORD_CHAR);
        descLabel.set_width(380);
        descLabel.get_clutter_text().ellipsize = Pango.EllipsizeMode.NONE;
        container.add_actor(descLabel);

        let linLabel = new St.Label({
            text: 'Linux:',
            style_class: 'sheet-item-lin-label'
        });
        linLabel.get_clutter_text().set_line_wrap(true);
        linLabel.get_clutter_text().set_line_wrap_mode(Pango.WrapMode.WORD_CHAR);
        linLabel.set_width(380);
        linLabel.get_clutter_text().ellipsize = Pango.EllipsizeMode.NONE;
        container.add_actor(linLabel);

        let codeLabel = new St.Label({
            text: item.code,
            style_class: 'sheet-item-code'
        });
        container.add_actor(codeLabel);

        if (item.alternatives) {
            for (let alt of item.alternatives) {
                let altLabel = new St.Label({
                    text: 'Alt: ' + alt,
                    style_class: 'sheet-item-code-alternative'
                });
                container.add_actor(altLabel);
            }
        }

        menuItem.addActor(container);

        menuItem.code = item.code;
        menuItem.connect('activate', () => {
            if (this._copyCallback) {
                this._copyCallback(item.code);
            }
        });

        return menuItem;
    },

    addItems: function(items) {
        this._allItems = items;
        this._filterItems('');
    },

    clearSearch: function() {
        this.searchEntry.set_text('');
    },

    getActor: function() {
        return this.mainBox;
    }
};

// ============================================================
// MAIN APPLET CLASS
// ============================================================

function NetRef(metadata, orientation, panelHeight, instanceId) {
    this.instance_id = instanceId;
    this.settings = new Settings.AppletSettings(this, UUID, instanceId);
    this._init(orientation, panelHeight, instanceId);
}

NetRef.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _addStyleClass: function(styleClass) {
        this.actor.add_style_class_name(styleClass);
    },

    _init: function(orientation, panelHeight, instanceId) {
        Applet.IconApplet.prototype._init.call(this, orientation, panelHeight, instanceId);
        this.set_applet_icon_path(ICON);
        this.set_applet_tooltip(_("NetRef: Windows to Linux Command Reference"));

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);

        this.settingsApiCheck();

        this.cheatsheetFolder = REFDOCS;

        this.cheatsheets = [];

        this.settings.bindProperty(
            Settings.BindingDirection.IN,
            "cheatsheetFolder",
            "cheatsheetFolder",
            this.onCheatsheetFolderUpdate,
            null
        );
        this.settings.bind("keyOpen", "keyOpen", this._setKeybinding);
        this._setKeybinding();
        this.settings.bindProperty(
            Settings.BindingDirection.BIDIRECTIONAL,
            "cheatsheets",
            "cheatsheets",
            this.onCheatsheetsUpdate,
            null
        );

        this._msgsrc = new MessageTray.SystemNotificationSource("NetRef");
        Main.messageTray.add(this._msgsrc);
        this.refresh(true);
    },

    refresh: function(updateSettings=false) {
        this.menu.removeAll();

        let currentDir = Gio.file_new_for_path(resolveHome(this.cheatsheetFolder));

        currentDir.enumerate_children_async(
            "standard::*,standard::type",
            Gio.FileQueryInfoFlags.NONE,
            GLib.PRIORITY_DEFAULT,
            null,
            (source, result) => {
                let enumerator;
                try {
                    enumerator = currentDir.enumerate_children_finish(result);
                } catch (e) {
                    global.log('NetRef: Error enumerating directory: ' + e);
                    return;
                }

                this._sheets = [];
                let current_sheets = [];
                let tmp_sheets = this.settings.getValue("cheatsheets");
                tmp_sheets.forEach((sheet) => {
                    current_sheets.push(sheet.name);
                });

                let file;
                let files = [];
                while ((file = enumerator.next_file(null)) !== null) {
                    if (file.get_file_type() === Gio.FileType.DIRECTORY) {
                        files.push(file.get_name());
                    }
                }

                this._processFolders(files, current_sheets, tmp_sheets, updateSettings, 0);
            }
        );
    },

    _processFolders: function(files, current_sheets, tmp_sheets, updateSettings, index) {
        if (index >= files.length) {
            if (updateSettings) {
                this.settings.setValue("cheatsheets", tmp_sheets);
            }
            return;
        }

        let sheetName = files[index];
        let sheetPath = resolveHome(this.cheatsheetFolder) + '/' + sheetName + '/sheet.json';
        let sheet = Gio.file_new_for_path(sheetPath);

        sheet.load_contents_async(null, (file, result) => {
            try {
                let [ok, data, etag] = sheet.load_contents_finish(result);
                if (!ok) {
                    global.log('NetRef: Failed to load sheet.json in "' + sheetName + '"');
                    this._processFolders(files, current_sheets, tmp_sheets, updateSettings, index + 1);
                    return;
                }

                let contents = JSON.parse(ByteArray.toString(data));

                if (!current_sheets.includes(contents.name)) {
                    tmp_sheets.push({
                        "enabled": true,
                        "name": contents.name,
                        "description": contents.description,
                        "author": contents.author
                    });
                } else {
                    let breaker = false;
                    tmp_sheets.forEach((sheet) => {
                        if (sheet.name == contents.name && !sheet.enabled) {
                            breaker = true;
                        }
                    });
                    if (breaker) {
                        this._processFolders(files, current_sheets, tmp_sheets, updateSettings, index + 1);
                        return;
                    }
                }

                let iconPath = resolveHome(this.cheatsheetFolder) + '/' + sheetName + '/icon.svg';

                this._sheets[sheetName] = new SheetMenuItem(contents, iconPath);
                this._sheets[sheetName]._sections = [];

                let allItems = [];
                for (var section in contents.sections) {
                    for (var item in contents.sections[section]) {
                        let itemData = contents.sections[section][item];
                        let alternatives = [];
                        if (itemData.alternatives) {
                            for (var alt in itemData.alternatives) {
                                alternatives.push(itemData.alternatives[alt].code);
                            }
                        }
                        allItems.push({
                            name: item,
                            windows: itemData.windows || item,
                            description: itemData.description,
                            code: itemData.code,
                            alternatives: alternatives,
                            options: itemData.options || [],
                            section: section
                        });
                    }
                }

                let searchableList = new SearchableListWidget((code) => {
                    this.copyToClipboard({code: code});
                });
                searchableList.addItems(allItems);

                this._sheets[sheetName].menu.addActor(searchableList.getActor());
                this.menu.addMenuItem(this._sheets[sheetName]);

            } catch (e) {
                global.log('NetRef: Exception: ' + e);
            }

            this._processFolders(files, current_sheets, tmp_sheets, updateSettings, index + 1);
        });
    },

    _setKeybinding: function () {
        Main.keybindingManager.addHotKey("netref-show-" + this.instance_id, this.keyOpen, () => this._openMenu());
    },

    on_applet_removed_from_panel: function () {
        Main.keybindingManager.removeHotKey("netref-show-" + this.instance_id);
    },

    _openMenu: function () {
        this.menu.toggle();
    },

    onCheatsheetFolderUpdate: function() {
    },

    onCheatsheetsUpdate: function(newValue) {
        this.refresh(false);
    },

    settingsApiCheck: function() {
        const Config = imports.misc.config;
        const SETTINGS_API_MIN_VERSION = 2;
        const CMD_SETTINGS = ["cinnamon-settings", "applets", UUID];

        let cinnamonVersion = Config.PACKAGE_VERSION.split('.');
        let majorVersion = parseInt(cinnamonVersion[0]);

        if (majorVersion >= SETTINGS_API_MIN_VERSION) {
            return;
        }

        let mi = new PopupMenu.PopupIconMenuItem(_("Configure..."), "document-edit", St.IconType.SYMBOLIC);
        mi.connect('activate', () => {
            Util.spawn(CMD_SETTINGS);
        });
        this._applet_context_menu.addMenuItem(mi);
    },

    notification: function(message) {
        let notification = new MessageTray.Notification(this._msgsrc, "NetRef", message);
        notification.setTransient(true);
        this._msgsrc.notify(notification);
    },

    copyToClipboard: function(text) {
        St.Clipboard.get_default().set_text(St.ClipboardType.CLIPBOARD, text.code);
        this.notification(_("Command copied to the clipboard"));
    },

    on_applet_clicked: function(event) {
        this._openMenu();
    }
};

function resolveHome(path) {
    let home = GLib.get_home_dir();
    return path.replace('~', home);
}

function main(metadata, orientation, panelHeight, instanceId) {
    return new NetRef(metadata, orientation, panelHeight, instanceId);
}
