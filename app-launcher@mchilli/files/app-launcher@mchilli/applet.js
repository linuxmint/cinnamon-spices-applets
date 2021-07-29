const Main = imports.ui.main;
const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;
const SignalManager = imports.misc.signalManager;
const Util = imports.misc.util;
const MessageTray = imports.ui.messageTray;
const St = imports.gi.St;

const GLib = imports.gi.GLib;
const Gettext = imports.gettext;

const APPNAME = 'App Launcher';

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

            if (this.orientation == 3 || this.orientation == 1) {
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
        this.menu = new Applet.AppletPopupMenu(this, this.orientation);
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

                let item;
                if (this.visibleAppIcons) {
                    item = new PopupMenu.PopupIconMenuItem(
                        name,
                        icon,
                        this.useSymbolicIcons ? St.IconType.SYMBOLIC : St.IconType.FULLCOLOR
                    );
                    item._icon.set_icon_size(this.appIconSize);
                } else {
                    item = new PopupMenu.PopupMenuItem(name);
                }
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

    _addSubMenuIcon(subMenu, groupName) {
        let existGroupIcons = {};
        this.listGroups.map((e) => (existGroupIcons[e.name] = e.icon));
        let icon =
            Object.keys(existGroupIcons).includes(groupName) && existGroupIcons[groupName] != null
                ? existGroupIcons[groupName]
                : this.settings.settingsData['list-groups'].columns[1].default;

        let _icon = new St.Icon({
            icon_name: icon,
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
            if (this.icons[0].endsWith('symbolic')) {
                this.set_applet_icon_symbolic_name(this.icons[0]);
            } else {
                this.set_applet_icon_name(this.icons[0]);
            }
        }
    }

    initLabel() {
        this.set_applet_tooltip(this.launcherLabel);
        if (this.orientation == 3 || this.orientation == 1) {
            return;
        }
        this.set_applet_label(this.launcherLabel);
        this.hide_applet_label(!this.visibleLauncherLabel);
    }

    showNotification(title, body, appIcon) {
        let source = new MessageTray.SystemNotificationSource();
        Main.messageTray.add(source);

        let icon = new St.Icon({
            icon_name: appIcon,
            icon_type: St.IconType.FULLCOLOR,
            icon_size: 30,
        });

        let notification = new MessageTray.Notification(source, title, body, { icon: icon });
        notification.setTransient(true);
        source.notify(notification);
    }

    _replaceAll(string, search, replace) {
        return string.split(search).join(replace);
    }

    run(name, icon, cmd) {
        if (this.notificationEnabled) {
            let text = this._replaceAll(this.notificationText, '%s', name);
            this.showNotification(APPNAME, text, icon);
        }
        Util.spawnCommandLine(cmd);
    }

    on_applet_clicked(event) {
        this.menu.toggle();
    }

    on_applet_reloaded() {
        this.settings.finalize();
        this.signalManager.disconnectAllSignals();
    }
}

function main(metadata, orientation, panelHeight, instanceId) {
    return new MyApplet(metadata, orientation, panelHeight, instanceId);
}
