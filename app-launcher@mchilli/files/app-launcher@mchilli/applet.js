const Main = imports.ui.main;
const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;
const SignalManager = imports.misc.signalManager;
const Util = imports.misc.util;
const MessageTray = imports.ui.messageTray;
const DND = imports.ui.dnd;
const Cinnamon = imports.gi.Cinnamon;
const St = imports.gi.St;
const Gio = imports.gi.Gio;

const GLib = imports.gi.GLib;
const Gettext = imports.gettext;

const APPNAME = 'App Launcher';
let appSystem = Cinnamon.AppSystem.get_default();

// l10n/translation support
const UUID = 'app-launcher@mchilli';
Gettext.bindtextdomain(UUID, GLib.get_home_dir() + '/.local/share/locale');

function _(str) {
    return Gettext.dgettext(UUID, str);
}

class MyApplet extends Applet.TextIconApplet {
    constructor(metadata, orientation, panelHeight, instanceId) {
        try {
            super(orientation, panelHeight, instanceId);

            this.metadata = metadata;
            this.uuid = metadata.uuid;
            this.orientation = orientation;
            this.panelHeight = panelHeight;
            this.instanceId = instanceId;

            this.setAllowedLayout(Applet.AllowedLayout.BOTH);
            if (this.orientation == St.Side.RIGHT || this.orientation == St.Side.LEFT) {
                this.hide_applet_label(true);
            }

            this.bindSettings();
            this.initMenu();
            this.connectSignals();
            this.initIcons();
            this.initLabel();
        } catch (e) {
            global.logError(e);
        }
    }

    bindSettings() {
        this.settings = new Settings.AppletSettings(this, this.uuid, this.instanceId);

        this.settings.bind('list-applications', 'listApplications', () => {
            this.updateMenu(true);
        });
        this.settings.bind('list-applications', 'listApplications', this.updateGroups);
        this.settings.bind('list-groups', 'listGroups', this.updateMenu);

        this.settings.bind('visible-launcher-label', 'visibleLauncherLabel', this.initLabel);
        this.settings.bind('launcher-label', 'launcherLabel', this.initLabel);
        this.settings.bind('custom-launcher-icon', 'customLauncherIcon', this.initIcons);
        this.settings.bind('launcher-icon', 'launcherIcon', this.initIcons);
        this.settings.bind('notification-enabled', 'notificationEnabled');
        this.settings.bind('notification-text', 'notificationText');

        this.settings.bind('visible-app-icons', 'visibleAppIcons', this.updateMenu);
        this.settings.bind('use-symbolic-icons', 'useSymbolicIcons', this.updateMenu);
        this.settings.bind('app-icon-size', 'appIconSize', this.updateMenu);
    }

    connectSignals() {
        this.signalManager = new SignalManager.SignalManager(null);

        this.signalManager.connect(this.menu, 'open-state-changed', this.toggleIcon, this);
    }

    initMenu() {
        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new MyPopupMenu(this, this.orientation);
        this.menuManager.addMenu(this.menu);
        this.updateMenu();
    }

    updateMenu() {
        this.menu.removeAll();

        let groups = {};

        if (this.listApplications.length === 0) {
            let item = new PopupMenu.PopupMenuItem(_('Edit Applications'));
            item.connect('activate', () => {
                this.configureApplet();
            });
            this.menu.addMenuItem(item);
        } else {
            this.listApplications.forEach((application) => {
                let name = application.name;
                let group = application.group;
                let icon = application.icon;
                let command = application.command;

                let item = this.createMenuItem(name, icon);
                item.connect('activate', () => {
                    this.run(name, icon, command);
                });

                if (group == '') {
                    this.menu.addMenuItem(item);
                } else {
                    if (Object.keys(groups).includes(group)) {
                        groups[group].menu.addMenuItem(item);
                    } else {
                        let subMenu = new PopupMenu.PopupSubMenuMenuItem(group);
                        if (this.visibleAppIcons) {
                            this._addSubMenuIcon(subMenu, group);
                        }

                        groups[group] = subMenu;
                        subMenu.menu.addMenuItem(item);
                        this.menu.addMenuItem(subMenu);
                    }
                }
            });
        }
    }

    updateGroups() {
        const allGroups = new Set();
        let existGroupIcons = {};
        this.listGroups.map((e) => (existGroupIcons[e.name] = e.icon));
        let newGroupValue = [];

        this.listApplications.forEach((application) => {
            let group = application.group;
            if (group !== '') {
                if (!allGroups.has(group)) {
                    allGroups.add(group);
                    newGroupValue.push({
                        name: group,
                        icon: Object.keys(existGroupIcons).includes(group)
                            ? existGroupIcons[group]
                            : this.settings.settingsData['list-groups'].columns[1].default,
                    });
                }
            }
        });

        if (JSON.stringify(newGroupValue) !== JSON.stringify(this.listGroups)) {
            this.settings.setValue('list-groups', newGroupValue);
        }

        this.updateMenu();
    }

    forceUpdateGroups() {
        // this will be used, to display the changes in the group list without
        // close and reopen the settings. Although it is already set internally!
        this.settings.setValue('list-groups', this.listGroups);
    }

    createMenuItem(name, icon) {
        let item;
        if (this.visibleAppIcons) {
            item = new PopupMenu.PopupIconMenuItem(
                name,
                null,
                this.useSymbolicIcons ? St.IconType.SYMBOLIC : St.IconType.FULLCOLOR
            );

            item._icon.set_gicon(this.createGIcon(icon, this.useSymbolicIcons));
            item._icon.set_icon_size(this.appIconSize);
        } else {
            item = new PopupMenu.PopupMenuItem(name);
        }
        return item;
    }

    _addSubMenuIcon(subMenu, groupName) {
        let existGroupIcons = {};
        this.listGroups.map((e) => (existGroupIcons[e.name] = e.icon));
        let icon =
            Object.keys(existGroupIcons).includes(groupName) && existGroupIcons[groupName] != null
                ? existGroupIcons[groupName]
                : this.settings.settingsData['list-groups'].columns[1].default;

        let _icon = new St.Icon({
            gicon: this.createGIcon(icon, this.useSymbolicIcons),
            icon_name: null,
            icon_type: this.useSymbolicIcons ? St.IconType.SYMBOLIC : St.IconType.FULLCOLOR,
            icon_size: this.appIconSize,
        });

        let params = {
            span: 0,
            expand: false,
            align: St.Align.START,
            actor: _icon,
        };

        subMenu._children.unshift(params);
        subMenu._signals.connect(
            subMenu.actor,
            'destroy',
            subMenu._removeChild.bind(subMenu, _icon)
        );
        subMenu.actor.add_actor(_icon);
    }

    initIcons() {
        let iconMap = [
            ['pan-down-symbolic', 'pan-up-symbolic'],
            ['pan-start-symbolic', 'pan-end-symbolic'],
            ['pan-up-symbolic', 'pan-down-symbolic'],
            ['pan-end-symbolic', 'pan-start-symbolic'],
        ];
        this.icons = iconMap[this.orientation];

        if (this.customLauncherIcon) {
            this.icons[0] = this.launcherIcon;
        }

        this.toggleIcon();
    }

    toggleIcon() {
        if (this.menu.isOpen && !this.customLauncherIcon) {
            this.set_applet_icon_symbolic_name(this.icons[1]);
        } else {
            let _isSymbolicIcon = this.icons[0].endsWith('symbolic');
            this._ensureIcon();
            this._applet_icon.set_gicon(this.createGIcon(this.icons[0]));
            this._applet_icon.set_icon_type(
                _isSymbolicIcon ? St.IconType.SYMBOLIC : St.IconType.FULLCOLOR
            );
            this._setStyle();
        }
    }

    createGIcon(icon, useSymbolicIcons = false) {
        let iconFile = Gio.file_new_for_path(icon);

        if (iconFile.query_exists(null)) {
            return new Gio.FileIcon({ file: iconFile });
        } else {
            let params;
            if (useSymbolicIcons) {
                params = { names: [`${icon}-symbolic`, `${icon}-symbolic.symbolic`, icon] };
            } else {
                params = { name: icon };
            }
            return new Gio.ThemedIcon(params);
        }
    }

    initLabel() {
        this.set_applet_tooltip(this.launcherLabel);
        if (this.orientation == St.Side.RIGHT || this.orientation == St.Side.LEFT) {
            return;
        }
        this.set_applet_label(this.launcherLabel);
        this.hide_applet_label(!this.visibleLauncherLabel);
    }

    showNotification(title, body, icon) {
        let source = new MessageTray.SystemNotificationSource();
        Main.messageTray.add(source);

        let _icon = new St.Icon({
            gicon: this.createGIcon(icon),
            icon_name: null,
            icon_type: St.IconType.FULLCOLOR,
            icon_size: 30,
        });

        let notification = new MessageTray.Notification(source, title, body, { icon: _icon });
        notification.setTransient(true);
        source.notify(notification);
    }

    _replaceAll(string, search, replace) {
        return string.split(search).join(replace);
    }

    addDropApp(name, icon, cmd, index = 0) {
        let newList = this.listApplications;
        newList.splice(index, 0, {
            name: name,
            group: '',
            icon: icon,
            command: cmd,
        });
        this.settings.setValue('list-applications', newList);
    }

    run(name, icon, cmd) {
        if (this.notificationEnabled) {
            let text = this._replaceAll(this.notificationText, '%s', name);
            this.showNotification(APPNAME, text, icon);
        }
        Util.spawnCommandLine(cmd);
    }

    handleDragOver(source, actor, x, y, time) {
        if (!source.isDraggableApp) {
            return DND.DragMotionResult.NO_DROP;
        }

        if (!this.menu.isOpen) {
            this.menu.open();
            this.menu.beginDrag();
        }

        return DND.DragMotionResult.MOVE_DROP;
    }

    on_applet_clicked(event) {
        if (this.menu.activeDrag()) {
            this.menu.endDrag(true);
        }
        this.menu.toggle();
    }

    on_applet_reloaded() {
        this.settings.finalize();
        this.signalManager.disconnectAllSignals();
    }
}

class MyPopupMenu extends Applet.AppletPopupMenu {
    _init(applet, orientation) {
        super._init(applet, orientation);
        this.applet = applet;
        this._dragging = false;
        this._draggable = DND.makeDraggable(this.applet.actor);
        this._dragPlaceholder = null;
        this._dragIndex = null;
    }

    beginDrag() {
        // this delete all hidden items(in groups), so the drag is more presice
        this._dragging = true;
        let children = this.box.get_children();
        children.forEach((element) => {
            if (!element.is_visible()) {
                element.destroy();
            }
        });
    }

    endDrag(updateMenu = false) {
        // if (updateMenu = true) this updates the menu to bring back the deleted items
        this._clearPlaceholder();

        if (updateMenu) {
            this.applet.updateMenu();
        }

        this._dragging = false;
    }

    activeDrag() {
        return this._dragging;
    }

    _createPlaceholder(name, icon, index) {
        if (this._dragPlaceholder) {
            return;
        }

        this._dragPlaceholder = this.applet.createMenuItem(name, icon);
        this.box.insert_child_at_index(this._dragPlaceholder.actor, index);
    }

    _clearPlaceholder() {
        if (this._dragPlaceholder) {
            this.box.remove_child(this._dragPlaceholder.actor);
        }

        this._dragPlaceholder = null;
        this._dragIndex = null;
    }

    _getAppInfo(source) {
        if (source.hasOwnProperty('app')) {
            return source.app.get_app_info();
        } else if (source.hasOwnProperty('id')) {
            return appSystem.lookup_app(source.id).get_app_info();
        }
        throw new Error(`${UUID}: cant get app info`);
    }

    handleDragOver(source, actor, x, y, time) {
        let children = this.box.get_children();
        let boxSize = this.box.height;
        let mousePos = y;

        let dropIndex = Math.floor((mousePos / boxSize) * children.length);

        if (dropIndex >= children.length) {
            dropIndex = -1;
        } else if (dropIndex < -1) {
            dropIndex = 0;
        }

        if (this._dragIndex != dropIndex) {
            if (!this._dragPlaceholder) {
                try {
                    let app = this._getAppInfo(source);
                    let name = app.get_display_name();
                    let icon = app.get_icon().to_string();
                    this._createPlaceholder(name, icon, dropIndex);
                } catch (error) {
                    global.logError(error);
                }
            } else {
                this.box.set_child_at_index(this._dragPlaceholder.actor, dropIndex);
            }
            this._dragIndex = dropIndex;
        }

        return DND.DragMotionResult.COPY_DROP;
    }

    handleDragOut() {
        if (this.isOpen) {
            this.close();
        }

        this.endDrag(true);
    }

    acceptDrop(source, actor, x, y, time) {
        if (!source.isDraggableApp) {
            return false;
        }

        try {
            let app = this._getAppInfo(source);
            let name = app.get_display_name();
            let icon = app.get_icon().to_string();
            let cmd = app.get_commandline();
            this.applet.addDropApp(name, icon, cmd, this._dragIndex);
        } catch (error) {
            global.logError(error);
        }

        if (this.isOpen) {
            this.close();
        }
        this.endDrag();

        return true;
    }
}

function main(metadata, orientation, panelHeight, instanceId) {
    return new MyApplet(metadata, orientation, panelHeight, instanceId);
}
