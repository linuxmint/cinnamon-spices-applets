const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const XApp = imports.gi.XApp;
const Meta = imports.gi.Meta;
const Main = imports.ui.main;
const {PopupBaseMenuItem, PopupMenu, PopupSeparatorMenuItem} = imports.ui.popupMenu;
const {changeModeGFile} = imports.misc.fileUtils;
const {SignalManager} = imports.misc.signalManager;
const Util = imports.misc.util;

const {_, launchPamacForApp} = require('./utils');
const {MODABLE, MODED} = require('./emoji');

class ContextMenuItem extends PopupBaseMenuItem {
    constructor(applet, label, iconName, action, insensitive = false) {
        super({focusOnHover: false});
        this.applet = applet;
        if (iconName) {
            const icon = new St.Icon({ style_class: 'popup-menu-icon', icon_name: iconName,
                                                                icon_type: St.IconType.SYMBOLIC});
            this.addActor(icon, {span: 0});
        }
        this.addActor(new St.Label({text: label}));

        this.signals = new SignalManager(null);
        this.action = action;
        if (this.action === null && !insensitive) {//"Open with" item
            this.actor.add_style_class_name('popup-subtitle-menu-item');
        } else if (insensitive) {//greyed out item
            this.actor.add_style_pseudo_class('insensitive');
        }
        this.signals.connect(this.actor, 'enter-event', this.handleEnter.bind(this));
        this.signals.connect(this.actor, 'leave-event', this.handleLeave.bind(this));
    }

    handleEnter(actor, e) {
        if (this.action === null) {
            return Clutter.EVENT_STOP;
        }
        this.has_focus = true;
        this.actor.add_style_pseudo_class('hover');
        this.actor.add_style_pseudo_class('active');
        return Clutter.EVENT_STOP;
    }

    handleLeave(actor, e) {
        this.has_focus = false;
        this.actor.remove_style_pseudo_class('hover');
        this.actor.remove_style_pseudo_class('active');
        return Clutter.EVENT_STOP;
    }

    activate(event) {
        if (!this.action || event && event.get_button() !== Clutter.BUTTON_PRIMARY) {
            return Clutter.EVENT_STOP;
        }
        this.action();
        return Clutter.EVENT_STOP;
    }

    destroy() {
        this.signals.disconnectAllSignals();
        PopupBaseMenuItem.prototype.destroy.call(this);
    }
}

class ContextMenu {
    constructor(applet) {
        this.applet = applet;
        this.menu = new PopupMenu(this.applet.actor /*,St.Side.TOP*/);
        this.menu.actor.hide();
        this.contextMenuBox = new St.BoxLayout({ style_class: '', vertical: true, reactive: true });
        this.contextMenuBox.add_actor(this.menu.actor);

        this.contextMenuButtons = [];
        this._openContainingFolderUsingDBus = true;
        this.isOpen = false;
    }

    openAppContextMenu(app, e, buttonActor) {
        //e is used to position context menu at mouse coords. If keypress opens menu then
        //e is undefined and buttonActor position is used instead.
        this.contextMenuButtons.forEach(button => button.destroy());
        this.contextMenuButtons = [];

        //------populate menu
        if (app.isApplication) {
            this._populateContextMenu_apps(app);
        } else if (app.isFolderviewFile || app.isDirectory ||
                   app.isRecentFile || app.isFavoriteFile) {
            if (!this._populateContextMenu_files(app)) {
                return;
            }
        } else if (app.isSearchResult && app.emoji) {
            const i = MODABLE.indexOf(app.emoji);//Find if emoji is in list of emoji that can have
                                                 //skin tone modifiers.
            if (i < 0) {
                return;
            }
            const addMenuItem = (char, text) => {
                const newEmoji = MODED[i].replace(/\u{1F3FB}/ug, char); //replace light skin tone character in
                                                                       // MODED[i] with skin tone option.
                const item = new ContextMenuItem(this.applet, newEmoji + ' ' + text, null,
                    () => {
                        this.applet.menu.close();
                        const clipboard = St.Clipboard.get_default();
                        clipboard.set_text(St.ClipboardType.CLIPBOARD, newEmoji);
                        Meta.later_add(Meta.LaterType.IDLE,
                            () => {
                                // Simulate "ctrl+v".
                                const seat = Clutter.get_default_backend().get_default_seat();
                                const virtualDevice = seat.create_virtual_device(Clutter.InputDeviceType.KEYBOARD_DEVICE);
                                const time_us = GLib.get_monotonic_time();
                                virtualDevice.notify_keyval(time_us, Clutter.KEY_Control_L, Clutter.KeyState.PRESSED);
                                virtualDevice.notify_keyval(time_us, Clutter.KEY_v, Clutter.KeyState.PRESSED);
                                virtualDevice.notify_keyval(time_us, Clutter.KEY_v, Clutter.KeyState.RELEASED);
                                virtualDevice.notify_keyval(time_us, Clutter.KEY_Control_L, Clutter.KeyState.RELEASED);
                            }
                        );
                    }
                );
                this.menu.addMenuItem(item);
                this.contextMenuButtons.push(item);
            };
            addMenuItem('\u{1F3FB}', _('light skin tone'));
            addMenuItem('\u{1F3FC}', _('medium-light skin tone'));
            addMenuItem('\u{1F3FD}', _('medium skin tone'));
            addMenuItem('\u{1F3FE}', _('medium-dark skin tone'));
            addMenuItem('\u{1F3FF}', _('dark skin tone'));
        } else {
            return;
        }
        this._showMenu(e, buttonActor);
    }

    openCategoryContextMenu(categoryId, e, buttonActor) {
        //e is used to position context menu at mouse coords. If keypress opens menu then
        //e is undefined and buttonActor position is used instead.
        this.contextMenuButtons.forEach(button => button.destroy());
        this.contextMenuButtons = [];

        //------populate menu
        const addMenuItem = (item) => {
            this.menu.addMenuItem(item);
            this.contextMenuButtons.push(item);
        };
        if (categoryId.startsWith('/')) {
            addMenuItem(new ContextMenuItem(this.applet, _('Remove category'), 'user-trash',
                () => {
                    if (categoryId === GLib.get_home_dir()) {
                        this.applet.settings.showHomeFolder = false;
                        this.applet._onShowHomeFolderChange();
                    } else {
                        this.applet.removeFolderCategory(categoryId);
                    }
                    this.applet.display.categoriesView.update();
                    this.close();
                }
            ));
            this.menu.addMenuItem(new PopupSeparatorMenuItem(this.applet));
        }
        addMenuItem(new ContextMenuItem(this.applet, _('Reset category order'), 'edit-undo-symbolic',
            () => {
                this.applet.settings.categories = [];
                this.applet.display.categoriesView.update();
                this.close();
            }
        ));

        this._showMenu(e, buttonActor);
    }

    openAppsViewContextMenu(event) {
        //event is used to position context menu at mouse coords.
        this.contextMenuButtons.forEach(button => button.destroy());
        this.contextMenuButtons = [];

        //------populate menu
        const addMenuItem = (item) => {
            this.menu.addMenuItem(item);
            this.contextMenuButtons.push(item);
        };
        if (this.applet.currentCategory === 'all') {
            if (this.applet.settings.allAppsOldStyle) {
                addMenuItem(new ContextMenuItem(this.applet, _('List settings apps separately'), null,
                            () => {
                                this.applet.settings.allAppsOldStyle = false;
                                this.close();
                                this.applet.setActiveCategory(this.applet.currentCategory);
                            }));
            } else {
                addMenuItem(new ContextMenuItem(this.applet, _('Single list style'), null,
                            () => {
                                this.applet.settings.allAppsOldStyle = true;
                                this.close();
                                this.applet.setActiveCategory(this.applet.currentCategory);
                            }));
            }
        } else if (this.applet.currentCategory.startsWith('/')) {
            if (this.applet.settings.showHiddenFiles) {
                addMenuItem(new ContextMenuItem(this.applet, _('Hide hidden files'), null,
                            () => {
                                this.applet.settings.showHiddenFiles = false;
                                this.close();
                                this.applet.setActiveCategory(this.applet.currentCategory);
                            }));
            } else {
                addMenuItem(new ContextMenuItem(this.applet, _('Show hidden files'), null,
                            () => {
                                this.applet.settings.showHiddenFiles = true;
                                this.close();
                                this.applet.setActiveCategory(this.applet.currentCategory);
                            }));
            }
        }

        this._showMenu(event);
    }

    _showMenu(e, buttonActor) {
        //----Position and open context menu----
        this.isOpen = true;
        this.applet.resizer.inhibit_resizing = true;

        const monitor = Main.layoutManager.findMonitorForActor(this.menu.actor);
        let mx, my;
        if (e) {
            [mx, my] = e.get_coords(); //get mouse position
        } else {//activated by keypress, no e supplied
            [mx, my] = buttonActor.get_transformed_position();
            mx += 20;
            my += 20;
        }
        if (mx > monitor.x + monitor.width - this.menu.actor.width) {
            mx -= this.menu.actor.width;
        }
        if (my > monitor.y + monitor.height - this.menu.actor.height - 40/*allow for panel*/) {
            my -= this.menu.actor.height;
        }

        let [cx, cy] = this.contextMenuBox.get_transformed_position();

        this.menu.actor.set_anchor_point(Math.round(cx - mx), Math.round(cy - my));

        // This context menu doesn't have an St.Side and so produces errors in .xsession-errors.
        // Enable animation here for the sole reason that it spams .xsession-errors less. Can't add an
        // St.Side because in some themes it looks like it should be attached to a panel but isn't.
        // Ideally, a proper floating popup menu should be coded.
        this.menu.open(true);
        return;
    }

    _populateContextMenu_apps(app) {
        const addMenuItem = (item) => {
            this.menu.addMenuItem(item);
            this.contextMenuButtons.push(item);
        };

        //Run with NVIDIA GPU
        if (Main.gpu_offload_supported) {
            addMenuItem( new ContextMenuItem(this.applet, _('Run with NVIDIA GPU'), 'cpu',
                () => {
                    try {
                        app.launch_offloaded(0, [], -1);
                    } catch (e) {
                        global.logError('Could not launch app with dedicated gpu: ', e);
                    }
                    this.applet.menu.close();
                }
            ));
        }

        //Add to panel
        addMenuItem(new ContextMenuItem(this.applet, _('Add to panel'), 'list-add',
            () => {
                if (!Main.AppletManager.get_role_provider_exists(Main.AppletManager.Roles.PANEL_LAUNCHER)) {
                    const new_applet_id = global.settings.get_int('next-applet-id');
                    global.settings.set_int('next-applet-id', (new_applet_id + 1));
                    const enabled_applets = global.settings.get_strv('enabled-applets');
                    enabled_applets.push('panel1:right:0:panel-launchers@cinnamon.org:' + new_applet_id);
                    global.settings.set_strv('enabled-applets', enabled_applets);
                }
                const launcherApplet =
                            Main.AppletManager.get_role_provider(Main.AppletManager.Roles.PANEL_LAUNCHER);
                if (launcherApplet) {
                    launcherApplet.acceptNewLauncher(app.id);
                }
                this.close();
            }
        ));

        //Add to desktop
        const userDesktopPath = GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_DESKTOP);
        if (userDesktopPath) {
            addMenuItem( new ContextMenuItem(this.applet, _('Add to desktop'), 'computer',
                () => {
                    const file = Gio.file_new_for_path(app.get_app_info().get_filename());
                    const destFile = Gio.file_new_for_path(userDesktopPath + '/' + file.get_basename());
                    try {
                        file.copy( destFile, 0, null, null);
                        changeModeGFile(destFile, "755");
                    } catch(e) {
                        global.logError('Cinnamenu: Error creating desktop file', e.message);
                    }
                    this.close();
                }
            ));
        }

        // add/remove favorite
        if (this.applet.appFavorites.isFavorite(app.id)) {
            addMenuItem( new ContextMenuItem(this.applet, _('Remove from favorites'), 'starred',
                () => {
                    this.applet.appFavorites.removeFavorite(app.id);
                    this.close();
                }
            ));
        } else {
            addMenuItem( new ContextMenuItem(this.applet, _('Add to favorites'), 'non-starred',
                () => {
                    this.applet.appFavorites.addFavorite(app.id);
                    this.close();
                }
            ));
        }

        // uninstall (Mint only)
        if (this.applet._canUninstallApps) {
            addMenuItem( new ContextMenuItem(this.applet, _('Uninstall'), 'edit-delete',
                () => {
                    Util.spawn(["cinnamon-remove-application", app.get_app_info().get_filename()]);
                    this.applet.menu.close();
                }
            ));
        }

        // show app info
        if (this.applet._pamacManagerAvailable) {
            addMenuItem( new ContextMenuItem(this.applet, _('App Info'), 'dialog-information',
                () => {
                    launchPamacForApp(app);
                    this.applet.menu.close();
                }
            ));
        }

        // Properties
        addMenuItem( new ContextMenuItem(this.applet, _('Properties'), 'document-properties-symbolic',
            () => {
                Util.spawn(["cinnamon-desktop-editor", "-mlauncher", "-o", app.desktop_file_path]);
                this.applet.menu.close();
            }
        ));

        // Desktop Actions
        const appInfo = app.get_app_info();
        const actions = appInfo.list_actions();

        if (actions.length > 0) {
            let keyFile = null;
            const filename = appInfo.get_filename();

            if (filename) {
                try {
                    keyFile = new GLib.KeyFile();
                    keyFile.load_from_file(filename, GLib.KeyFileFlags.NONE);
                } catch (e) {
                    global.logError(`Cinnamenu: Error loading desktop file ${filename}: ${e}`);
                    keyFile = null;
                }
            }

            for (const action of actions) {
                let icon = null;

                // Gio.DesktopAppInfo exposes the action name and launcher, but not
                // the Icon= key from the corresponding [Desktop Action ...] group.
                // Read it directly from the application's .desktop file.
                if (keyFile) {
                    try {
                        const group = `Desktop Action ${action}`;
                        icon = keyFile.get_string(group, 'Icon');
                    } catch (e) {
                        // Icon= is optional. Fall through to secondary fallbacks.
                    }
                }

                // First fallback: Cinnamon's known desktop-action icon mapping.
                if (!icon)
                    icon = Util.getDesktopActionIcon(action);

                // Final fallback for custom actions with no icon information.
                if (!icon)
                    icon = 'application-x-executable';

                const label = appInfo.get_action_name(action);

                addMenuItem(new ContextMenuItem(this.applet, label, icon,
                    () => {
                        appInfo.launch_action(
                            action,
                            global.create_app_launch_context()
                        );
                        this.applet.menu.close();
                    }
                ));
            }
        }
    }

    _populateContextMenu_files(app) {
        const addMenuItem = (item) => {
            this.menu.addMenuItem(item);
            this.contextMenuButtons.push(item);
        };

        const hasLocalPath = (file) => (file.is_native() && file.get_path() != null);
        const file = Gio.File.new_for_uri(app.uri);
        const fileExists = file.query_exists(null);
        if (!fileExists && !app.isFavoriteFile) {
            Main.notify(_('This file is no longer available'),'');
            return false; //no context menu
        }
        //Note: a file can be an isFavoriteFile and also not exist so continue below and add option to
        //remove from favorites.

        //Open with...
        if (fileExists) {
            addMenuItem( new ContextMenuItem(this.applet, _('Open with'), null, null));
            const defaultInfo = Gio.AppInfo.get_default_for_type(app.mimeType, !hasLocalPath(file));
            if (defaultInfo) {
                addMenuItem( new ContextMenuItem(this.applet, defaultInfo.get_display_name(), null,
                    () => {
                        defaultInfo.launch([file], null);
                        this.applet.menu.close();
                    }
                ));
            }
            Gio.AppInfo.get_all_for_type(app.mimeType).forEach(info => {
                if (!hasLocalPath(file) || !info.supports_uris() || info.equal(defaultInfo)) {
                    return;
                }
                addMenuItem( new ContextMenuItem(this.applet, info.get_display_name(), null,
                    () => {
                        info.launch([file], null);
                        this.applet.menu.close();
                    }
                ));
            });
            addMenuItem( new ContextMenuItem(this.applet, _('Other application...'), null,
                () => {
                    Util.spawn(['nemo-open-with', app.uri]);
                    this.applet.menu.close();
                }
            ));
        }

        // add/remove favorite
        this.menu.addMenuItem(new PopupSeparatorMenuItem(this.applet));
        if (XApp.Favorites.get_default().find_by_uri(app.uri) !== null) { //favorite
            addMenuItem( new ContextMenuItem(this.applet, _('Remove from favorites'), 'starred',
                () => {
                    XApp.Favorites.get_default().remove(app.uri);
                    this.close();
                }
            ));
        } else {
            addMenuItem( new ContextMenuItem(this.applet, _('Add to favorites'), 'non-starred',
                () => {
                    XApp.Favorites.get_default().add(app.uri);
                    this.close();
                }
            ));
        }

        // Add folder as category
        if (app.isDirectory && this.applet.settings.showCategories) {
            const path = Gio.file_new_for_uri(app.uri).get_path();
            if (!this.applet.getIsFolderCategory(path)) {
                this.menu.addMenuItem(new PopupSeparatorMenuItem(this.applet));
                addMenuItem(new ContextMenuItem(this.applet, _('Add folder as category'), 'list-add',
                    () => {
                        if (path === GLib.get_home_dir()) {
                            this.applet.settings.showHomeFolder = true;
                        }
                        this.applet.addFolderCategory(path);
                        this.applet.display.categoriesView.update();
                        this.close();
                    }
                ));
            }
        }

        // Open containing folder
        const folder = file.get_parent();
        if (app.isRecentFile || app.isFavoriteFile || app.isFolderviewFile) {
            this.menu.addMenuItem(new PopupSeparatorMenuItem(this.applet));
            addMenuItem(new ContextMenuItem(this.applet, _('Open containing folder'), 'go-jump',
                () => {
                    if (!(this._openContainingFolderUsingDBus && this._openContainingFolderViaDBus(app.uri))) {
                        // Do not attempt to use DBus again once it's failed.
                        this._openContainingFolderUsingDBus = false;
                        const fileBrowser = Gio.AppInfo.get_default_for_type('inode/directory', true);
                        fileBrowser.launch([folder], null);
                    }
                    this.applet.menu.close();
                }
            ));
        }

        // Move to trash
        if (!app.isFavoriteFile) {
            this.menu.addMenuItem(new PopupSeparatorMenuItem(this.applet));

            const fileInfo = file.query_info('access::can-trash', Gio.FileQueryInfoFlags.NONE, null);
            const canTrash = fileInfo.get_attribute_boolean('access::can-trash');
            if (canTrash) {
                addMenuItem(new ContextMenuItem(this.applet, _('Move to trash'), 'user-trash',
                    () => {
                        const file = Gio.File.new_for_uri(app.uri);
                        try {
                            file.trash(null);
                        } catch (e) {
                            Main.notify(_('Error while moving file to trash:'), e.message);
                        }
                        this.applet.setActiveCategory(this.applet.currentCategory);
                        this.close();
                    }
                ));
            } else { // show insensitive item
                addMenuItem( new ContextMenuItem(this.applet, _('Move to trash'), 'user-trash',
                                                                        null, true /*insensitive*/));
            }
        }
        return true; // success.
    }

    _openContainingFolderViaDBus(uri) {
        try {
            Gio.DBus.session.call_sync(
                "org.freedesktop.FileManager1",
                "/org/freedesktop/FileManager1",
                "org.freedesktop.FileManager1",
                "ShowItems",
                new GLib.Variant("(ass)", [
                    [uri],
                    global.get_pid().toString()
                ]),
                null,
                Gio.DBusCallFlags.NONE,
                1000,
                null
            );
        } catch (e) {
            global.log(`Could not open containing folder via DBus: ${e}`);
            return false;
        }
        return true;
    }

    getCurrentlyFocusedMenuItem() {
        if (!this.isOpen) {
            return -1;
        }

        let focusedButton = this.contextMenuButtons.findIndex(button => button.has_focus);
        if (focusedButton < 0) {
            focusedButton = 0;
        }
        return focusedButton;
    }

    close() {
        this.menu.close();
        this.isOpen = false;
        this.applet.resizer.inhibit_resizing = false;
    }

    destroy() {
        this.contextMenuButtons.forEach(button => button.destroy());
        this.contextMenuButtons = null;
        //this.menu.destroy(); //causes errors in .xsession-errors??
        this.contextMenuBox.destroy();
    }
}

module.exports = {ContextMenu};
