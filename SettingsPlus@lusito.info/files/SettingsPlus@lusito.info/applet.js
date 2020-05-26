// Customizable settings menu by Lusito
const Lang = imports.lang;
const St = imports.gi.St;
const Applet = imports.ui.applet;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const Tooltips = imports.ui.tooltips;
const Util = imports.misc.util;
const ModalDialog = imports.ui.modalDialog;
const Gtk = imports.gi.Gtk;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;

const AppletDir = imports.ui.appletManager.appletMeta['SettingsPlus@lusito.info'].path;
const ConfigFile = AppletDir + '/config.json';

function ConfirmDialog(question, success) {
    this._init(question, success);
}

ConfirmDialog.prototype = {
    __proto__: ModalDialog.ModalDialog.prototype,

    _init: function(question, success) {
        ModalDialog.ModalDialog.prototype._init.call(this);
        let label = new St.Label({text: question});
        this.contentLayout.add(label);

        this.setButtons([
            {
                label: _('Proceed'),
                action: Lang.bind(this, function() {
                    this.close();
                    success();
                })
            },
            {
                label: _('Cancel'),
                action: Lang.bind(this, function() {
                    this.close();
                })
            }
        ]);
    }
};

function SettingsLauncher(menu, settings) {
    this._init(menu, settings);
}

SettingsLauncher.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    _init: function(menu, settings) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {});

        this._menu = menu;
        this._settings = settings;
        this.label = new St.Label({text: settings.text});
        this.addActor(this.label);

        if (settings.icon && settings.icon != '') {
            this._icon = new St.Icon({icon_name: settings.icon, icon_size: 16, icon_type: St.IconType.FULLCOLOR});
            this.addActor(this._icon, {expand: true});
        }

        if (settings.hint && settings.hint != '') {
            this._tooltip = new Tooltips.Tooltip(this.actor, settings.hint);
        }
    },

    activate: function(event) {
        if (this._settings.prompt && this._settings.prompt != '') {
            let confirm = new ConfirmDialog(this._settings.prompt + '\n\n', Lang.bind(this, this.execute));
            confirm.open();
        } else {
            this.execute();
        }
        return true;
    },

    execute: function() {
        if (this._settings.exec) {
            let command = this._settings.exec;
            let i = 1;
            do {
                if (command == '[reload-theme]') {
                    Main.loadTheme();
                } else if (command == '[looking-glass]') {
                    Main.createLookingGlass().open();
                } else {
                    command = command.replace(/\${HOME}/g, GLib.get_home_dir());
                    command = command.replace(/\${APPLET_DIR}/g, AppletDir);
                    Util.spawnCommandLine(command);
                }

                i++;
                command = this._settings['exec' + i];
            } while (command);
        }

        if (this._settings.restart) {
            global.reexec_self();
        }
        this._menu.close();
    }
};

function SettingsToggler(menu, settings) {
    this._init(menu, settings);
}

SettingsToggler.prototype = {
    __proto__: PopupMenu.PopupSwitchMenuItem.prototype,

    _init: function(menu, settings) {
        let value = global.settings.get_boolean(settings.toggle);
        PopupMenu.PopupSwitchMenuItem.prototype._init.call(this, _(settings.text), value);

        this._menu = menu;
        this._settings = settings;

        this.connect('toggled', Lang.bind(this, this.onToggled));
        global.settings.connect('changed::' + settings.toggle, Lang.bind(this, this.onSettingChanged));

        if (settings.hint && settings.hint != '') {
            this._tooltip = new Tooltips.Tooltip(this.actor, settings.hint);
        }
    },

    onSettingChanged: function() {
        this.setToggleState(global.settings.get_boolean(this._settings.toggle));
    },

    onToggled: function(item) {
        this._menu.actor.hide();
        if (this._settings.prompt && this._settings.prompt != '') {
            let confirm = new ConfirmDialog(this._settings.prompt + '\n\n', Lang.bind(this, this.execute));
            confirm.open();
        } else {
            this.execute();
        }
        return true;
    },

    execute: function() {
        global.settings.set_boolean(this._settings.toggle, this.state);
    }
};

function SettingsPlus(orientation) {
    this._init(orientation);
}

SettingsPlus.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(orientation) {
        Applet.IconApplet.prototype._init.call(this, orientation);

        this.orientation = orientation;
        this.set_applet_icon_symbolic_name('emblem-system-symbolic');
        this.set_applet_tooltip(_('Settings Plus'));

        this.menu = null;
        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.changed = false;

        // watch for file changes
        let file = Gio.file_new_for_path(ConfigFile);
        this._monitor = file.monitor(Gio.FileMonitorFlags.NONE, null);
        this.lastUpdate = 0;
        this._monitor.connect('changed', Lang.bind(this, this.load_menu_json));

        this.load_menu_json();

        // Add edit settings context menu item
        let settings_menu_item = new Applet.MenuItem(
            _('Edit Menu'),
            Gtk.STOCK_EDIT,
            Lang.bind(this, function(event) {
                Util.spawnCommandLine('gnome-open ' + ConfigFile);
            })
        );

        this._applet_context_menu.addMenuItem(settings_menu_item);
    },

    on_applet_clicked: function(event) {
        this.menu.toggle();
    },

    load_menu: function(config) {
        if (this.menu) {
            this.menuManager.removeMenu(this.menu);
        }

        this.menu = new Applet.AppletPopupMenu(this, this.orientation);
        this.menuManager.addMenu(this.menu);

        this._contentSection = new PopupMenu.PopupMenuSection();
        this.menu.addMenuItem(this._contentSection);

        for (let i = 0; i < config.length; i++) {
            let entry = config[i];
            if (entry === 'separator') {
                this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            } else if ('toggle' in entry) {
                this.menu.addMenuItem(new SettingsToggler(this.menu, entry));
            } else if ('children' in entry) {
                let popup = new PopupMenu.PopupSubMenuMenuItem(_(entry.text));

                if (entry.hint && entry.hint != '') popup._tooltip = new Tooltips.Tooltip(popup.actor, entry.hint);

                for (let j = 0; j < entry.children.length; j++) {
                    let entry2 = entry.children[j];
                    if (entry2 === 'separator') popup.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
                    else if ('toggle' in entry2) popup.menu.addMenuItem(new SettingsToggler(this.menu, entry2));
                    else popup.menu.addMenuItem(new SettingsLauncher(this.menu, entry2));
                }

                this.menu.addMenuItem(popup);
            } else {
                this.menu.addMenuItem(new SettingsLauncher(this.menu, entry));
            }
        }
    },

    load_menu_json: function() {
        let t = new Date().getTime();
        if (t - this.lastUpdate < 500) return;
        this.lastUpdate = t;

        try {
            let file = Gio.file_new_for_path(ConfigFile);
            if (file.query_exists(null)) {
                let [success, data] = file.load_contents(null);
                if (success) {
                    let isFirstLoad = this.menu == null;
                    let config;
                    try {
                        config = JSON.parse(data);
                    } catch (e) {
                        global.log(e);
                        return;
                    }
                    this.load_menu(config);
                    if (!isFirstLoad) {
                        Util.spawnCommandLine('notify-send --icon=gtk-yes "Settings Plus Updated" "Successfully updated config."');
                    }
                    return;
                }
            }
            Util.spawnCommandLine('notify-send --icon=gtk-stop "Settings Plus Error" "Could not load config.js."');
        } catch (e) {
            global.log(e);
            Util.spawnCommandLine('notify-send --icon=gtk-stop "Settings Plus Error" "Error parsing config.js."');
        }
    }
};

function main(metadata, orientation) {
    return new SettingsPlus(orientation);
}
