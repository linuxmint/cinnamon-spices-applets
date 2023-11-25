const Main = imports.ui.main;
const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;
const SignalManager = imports.misc.signalManager;
const Util = imports.misc.util;
const MessageTray = imports.ui.messageTray;
const Tooltips = imports.ui.tooltips;
const DND = imports.ui.dnd;
const Cinnamon = imports.gi.Cinnamon;
const St = imports.gi.St;
const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const Clutter = imports.gi.Clutter;

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
            this.groupBuffer = [];

            this.dragging = false;
            this.dragPlaceholder = null;
            this.dragPlaceholderParent = null;
            this.dragOverSubMenu = false;
            this.dragIndex = null;

            this.setAllowedLayout(Applet.AllowedLayout.BOTH);
            if (this.orientation == St.Side.RIGHT || this.orientation == St.Side.LEFT) {
                this.hide_applet_label(true);
            }

            this.bindSettings();
            this.initMenu();
            this.connectSignals();
            this.addHotkey();
            this.initIcons();
            this.initLabel();
        } catch (e) {
            global.logError(e);
        }
    }

    bindSettings() {
        this.settings = new Settings.AppletSettings(this, this.uuid, this.instanceId);

        this.settings.bind('list-applications', 'listApplications', this.updateGroups);
        this.settings.bind('list-groups', 'listGroups', this.updateMenu);

        this.settings.bind('visible-launcher-label', 'visibleLauncherLabel', this.initLabel);
        this.settings.bind('launcher-label', 'launcherLabel', this.initLabel);
        this.settings.bind('custom-launcher-icon', 'customLauncherIcon', this.initIcons);
        this.settings.bind('launcher-icon', 'launcherIcon', this.initIcons);
        this.settings.bind('notification-enabled', 'notificationEnabled');
        this.settings.bind('notification-text', 'notificationText');
        this.settings.bind('hotkey-binding', 'hotkeyBinding', this.addHotkey);

        this.settings.bind('fixed-menu-width', 'fixedMenuWidth', this.updateMenu);
        this.settings.bind('visible-app-icons', 'visibleAppIcons', this.updateMenu);
        this.settings.bind('use-symbolic-icons', 'useSymbolicIcons', this.updateMenu);
        this.settings.bind('app-icon-size', 'appIconSize', this.updateMenu);
    }

    connectSignals() {
        this.signalManager = new SignalManager.SignalManager(null);

        this.signalManager.connect(
            this.menu,
            'open-state-changed',
            this.on_menu_state_changed,
            this
        );
    }

    initMenu() {
        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new MyPopupMenu(this, this.orientation);
        this.menuManager.addMenu(this.menu);
        this.updateMenu();
    }

    updateMenu() {
        this.menu.clearMenu();

        let groups = {};

        if (this.listApplications.length === 0) {
            let item = new PopupMenu.PopupMenuItem(_('Edit Applications'));
            item.connect('activate', () => {
                this.configureApplet();
            });
            this.menu.addMenuItem(item);
        } else {
            let itemWidths = [];

            this.listApplications.forEach((application, index) => {
                let name = application.name;
                let group = application.group;
                let icon = application.icon;
                let command = application.command;
                let item = this.createMenuItem(name, icon, group, command);

                if (group == '') {
                    this.menu.addMenuItem(item);
                } else {
                    if (Object.keys(groups).includes(group)) {
                        groups[group].addMenuItem(item);
                    } else {
                        let subMenu = this.createSubMenuItem(group, index);
                        groups[group] = subMenu;
                        subMenu.addMenuItem(item);
                        this.menu.addMenuGroupItem(subMenu);
                        this.menu.addMenuItem(subMenu);
                    }
                    if (item instanceof MyPopupMenuItem) {
                        itemWidths.push(item.getWidth());
                    }
                }
                if (item instanceof MyPopupMenuItem || item instanceof MyPopupSeparatorMenuItem) {
                    this.menu.addMenuAppItem(item);
                }
            });
            if (this.fixedMenuWidth) {
                this.menu.getMenuGroupItems().forEach((group) => {
                    // largest item + (basic icon size + icon size) or (basic size)
                    group.setWidth(
                        Math.max(...itemWidths) +
                            (this.visibleAppIcons ? 40 + this.appIconSize : 28)
                    );
                });
            }
        }
    }

    updateGroups() {
        const allGroups = new Set();
        let existGroupIcons = {};
        this.listGroups.map((value) => {
            if (Object.keys(this.groupBuffer).includes(value.name)) {
                existGroupIcons[value.name] = this.popFromGroupBuffer(value.name);
            } else {
                existGroupIcons[value.name] = value.icon;
            }
        });
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

    createSubMenuItem(name, index) {
        let existGroupIcons = {};
        this.listGroups.map((e) => (existGroupIcons[e.name] = e.icon));
        let icon =
            Object.keys(existGroupIcons).includes(name) && existGroupIcons[name] != null
                ? existGroupIcons[name]
                : this.settings.settingsData['list-groups'].columns[1].default;

        return new MyPopupSubMenuItem({
            applet: this,
            name: name,
            index: index,
            visibleAppIcons: this.visibleAppIcons,
            icon: icon,
            useSymbolicIcons: this.useSymbolicIcons,
            iconSize: this.appIconSize,
        });
    }

    createMenuItem(name, icon, group, command) {
        if (name === '$eparator$') {
            return new MyPopupSeparatorMenuItem({
                red: command[0],
                green: command[1],
                blue: command[2],
            });
        } else {
            return new MyPopupMenuItem({
                applet: this,
                name: name,
                group: group,
                visibleAppIcons: this.visibleAppIcons,
                icon: icon,
                useSymbolicIcons: this.useSymbolicIcons,
                iconSize: this.appIconSize,
                command: command,
            });
        }
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

    editGroup(oldName, newName) {
        let newList = this.listApplications;
        newList.map((value) => {
            if (value.group === oldName) {
                value.group = newName;
            }
        });
        this.settings.setValue('list-applications', newList);
    }

    removeGroup(name) {
        let newList = this.listApplications;
        newList.map((value) => {
            if (value.group === name) {
                value.group = '';
            }
        });
        this.settings.setValue('list-applications', newList);
    }

    addApp(name, icon, group, command, index = 0) {
        let newList = this.listApplications;
        newList.splice(index, 0, {
            name: name,
            group: group,
            icon: icon,
            command: command,
        });
        this.settings.setValue('list-applications', newList);
    }

    removeApp(index, update = true) {
        let newList = this.listApplications;
        newList.splice(index, 1);
        if (update) {
            this.settings.setValue('list-applications', newList);
        }
    }

    appendToGroupBuffer(name, icon) {
        // hack to set the choosed icon for a new group
        this.groupBuffer[name] = icon;
    }

    popFromGroupBuffer(key) {
        let icon = this.groupBuffer[key];
        delete this.groupBuffer[key];
        return icon;
    }

    addHotkey() {
        Main.keybindingManager.addHotKey(
            `app-launcher-${this.instanceId}`,
            this.hotkeyBinding,
            () => {
                this.menu.toggle();
            }
        );
    }

    removeHotkey() {
        Main.keybindingManager.removeHotKey(`app-launcher-${this.instanceId}`);
    }

    run(name, icon, command) {
        if (this.notificationEnabled) {
            let text = this._replaceAll(this.notificationText, '%s', name);
            this.showNotification(APPNAME, text, icon);
        }
        Util.spawnCommandLine(command);
    }

    on_applet_clicked(event) {
        if (this.activeDrag()) {
            this.endDrag();
        }
        this.menu.toggle();
    }

    on_applet_reloaded() {
        this.settings.finalize();
        this.signalManager.disconnectAllSignals();
        this.removeHotkey();
    }

    on_applet_removed_from_panel() {
        this.removeHotkey();
    }

    on_menu_state_changed(menu, isOpen, sourceActor) {
        this.toggleIcon();
        if (!isOpen && this.menu.isContextOpen()) {
            this.menu.closeContext();
        }
    }

    handleDragOver(source, actor, x, y, time) {
        if (!source.isDraggableApp) {
            return DND.DragMotionResult.NO_DROP;
        }

        if (!this.menu.isOpen) {
            this.menu.open();
            this.beginDrag();
        }

        return DND.DragMotionResult.MOVE_DROP;
    }

    beginDrag() {
        this.dragging = true;

        this.menu.expandMenu();
    }

    endDrag() {
        this.clearDragPlaceholder();

        this.menu.collapseMenu();

        if (this.menu.isOpen) {
            this.menu.close();
        }

        this.dragging = false;
    }

    activeDrag() {
        return this.dragging;
    }

    handleDrag(source, x, y, box, indent) {
        let children = box.get_children();
        let boxSize = box.height;
        let mousePos = y;

        let dropIndex = Math.floor((mousePos / boxSize) * children.length);

        if (dropIndex >= children.length) {
            dropIndex = -1;
        } else if (dropIndex < -1) {
            dropIndex = 0;
        }

        if (this.dragIndex !== dropIndex) {
            if (!this.dragPlaceholder) {
                this.createDragPlaceholder(box, source, dropIndex, indent);
            } else {
                this.setDragPlaceholder(box, dropIndex, indent);
            }
            this.dragIndex = dropIndex;
        }
    }

    createDragPlaceholder(parent, source, index, indent = false) {
        if (this.dragPlaceholder) {
            return;
        }

        let app = this.getAppInfo(source);
        let name = app.get_display_name();
        let icon = app.get_icon().to_string();

        this.dragPlaceholder = this.createMenuItem(name, icon);
        this.setDragPlaceholder(parent, index, indent);
    }

    setDragPlaceholder(parent, index, indent = false) {
        if (parent !== this.dragPlaceholderParent) {
            if (this.dragPlaceholderParent) {
                this.dragPlaceholderParent.remove_child(this.dragPlaceholder.actor);
            }
            this.dragPlaceholderParent = parent;
            this.dragPlaceholder.setIndentation(indent);
            parent.insert_child_at_index(this.dragPlaceholder.actor, index);
        } else {
            parent.set_child_at_index(this.dragPlaceholder.actor, index);
        }
    }

    clearDragPlaceholder() {
        if (this.dragPlaceholder) {
            this.dragPlaceholderParent.remove_child(this.dragPlaceholder.actor);
        }

        this.dragPlaceholder = null;
        this.dragPlaceholderParent = null;
        this.dragIndex = null;
    }

    getAppInfo(source) {
        if (source.hasOwnProperty('app')) {
            return source.app.get_app_info();
        } else if (source.hasOwnProperty('id')) {
            return appSystem.lookup_app(source.id).get_app_info();
        }

        throw new Error(`${UUID}: cant get app info`);
    }

    prepareAppInfo(source) {
        let app = this.getAppInfo(source);

        let name = app.get_display_name();
        let icon = app.get_icon().to_string();

        let execTokens = /\s%[uU]|\s%[fF]/g;
        let command = app.get_commandline().replace(execTokens, '');

        return {
            name: name,
            icon: icon,
            command: command,
        };
    }
}

class MyPopupMenu extends Applet.AppletPopupMenu {
    _init(applet, orientation) {
        try {
            super._init(applet, orientation);
            this.applet = applet;
            this._menuAppItems = [];
            this._menuGroupItems = [];

            this.contextOpen = false;
        } catch (error) {
            global.log(error);
        }
    }

    clearMenu() {
        this.removeAll();
        this.clearMenuGroupItems();
        this.clearMenuAppItems();
    }

    addMenuGroupItem(item) {
        this._menuGroupItems.push(item);
    }

    getMenuGroupItems() {
        return this._menuGroupItems;
    }

    clearMenuGroupItems() {
        this._menuGroupItems = [];
    }

    setMenuGroupItemsShowTriangle(show) {
        this.getMenuGroupItems().forEach((group) => {
            group.setShowTriangle(show);
        });
    }

    unselectMenuGroupItems() {
        this.getMenuGroupItems().forEach((group) => {
            group.unselect();
        });
    }

    getSelectedMenuGroupItem() {
        let groups = this.getMenuGroupItems();
        for (let index = 0; index < groups.length; index++) {
            const group = groups[index];
            if (group.isSelected()) {
                return [group, index];
            }
        }
    }

    editSelectedMenuGroupItem(name, icon) {
        let [group, index] = this.getSelectedMenuGroupItem();
        this.closeContext();
        this.applet.appendToGroupBuffer(name, icon);
        this.applet.editGroup(group.name, name);
    }

    removeSelectedMenuGroupItem() {
        let [group, index] = this.getSelectedMenuGroupItem();
        this.closeContext();
        this.applet.removeGroup(group.name);
    }

    openMenuGroupItems() {
        this.getMenuGroupItems().forEach((group) => {
            group.menu.open(true);
        });
    }

    closeMenuGroupItems() {
        this.getMenuGroupItems().forEach((group) => {
            group.menu.close(true);
        });
    }

    addMenuAppItem(item) {
        this._menuAppItems.push(item);
    }

    getMenuAppItems() {
        return this._menuAppItems;
    }

    clearMenuAppItems() {
        this._menuAppItems = [];
    }

    unselectMenuAppItems() {
        this.getMenuAppItems().forEach((item) => {
            item.unselect();
        });
    }

    getSelectedMenuAppItem() {
        let items = this.getMenuAppItems();
        for (let index = 0; index < items.length; index++) {
            const item = items[index];
            if (item.isSelected()) {
                return [item, index];
            }
        }
    }

    editSelectedMenuAppItem(name, icon, group, command) {
        let [item, index] = this.getSelectedMenuAppItem();
        this.closeContext();
        this.applet.removeApp(index, false);
        this.applet.addApp(name, icon, group, command, index);
    }

    removeSelectedMenuAppItem() {
        let [item, index] = this.getSelectedMenuAppItem();
        this.closeContext();
        this.applet.removeApp(index);
    }

    unselectMenuItems() {
        this.unselectMenuGroupItems();
        this.unselectMenuAppItems();
    }

    expandMenu() {
        this.openMenuGroupItems();
        this.setMenuGroupItemsShowTriangle(false);
        this.getMenuGroupItems().forEach((group) => {
            group.setItemsIndentation(true);
        });
    }

    collapseMenu() {
        this.closeMenuGroupItems();
        this.setMenuGroupItemsShowTriangle(true);
        this.getMenuGroupItems().forEach((group) => {
            group.setItemsIndentation(false);
        });
    }

    openContext() {
        this.contextOpen = true;
        this.expandMenu();
    }

    closeContext() {
        this.contextOpen = false;
        this.unselectMenuItems();
        this.collapseMenu();
        this.actor.grab_key_focus(); // necessary to recalc the width
    }

    isContextOpen() {
        return this.contextOpen;
    }

    handleDragOver(source, actor, x, y, time) {
        if (this.applet.dragOverSubMenu) {
            return DND.DragMotionResult.COPY_DROP;
        }

        this.applet.handleDrag(source, x, y, this.box, false);

        return DND.DragMotionResult.COPY_DROP;
    }

    handleDragOut() {
        if (this.isOpen) {
            this.close();
        }

        this.applet.endDrag();
    }

    acceptDrop(source, actor, x, y, time) {
        if (!source.isDraggableApp || this.applet.dragOverSubMenu) {
            return false;
        }
        let app = this.applet.prepareAppInfo(source);

        this.applet.addApp(app.name, app.icon, '', app.command, this.applet.dragIndex);

        this.applet.endDrag();

        return true;
    }
}

class MyPopupSubMenuItem extends PopupMenu.PopupSubMenuMenuItem {
    _init({
        applet = undefined,
        name = 'PopupMenuItem',
        index = 0,
        visibleAppIcons = true,
        icon = 'application-x-executable',
        iconSize = 24,
        useSymbolicIcons = false,
    } = {}) {
        try {
            super._init(name);

            this.applet = applet;
            this.actor.type = 'popup-item';
            this._selected = false;
            this.name = name;
            this.index = index;
            this.icon = icon;
            this.iconSize = iconSize;
            this.iconType = useSymbolicIcons ? St.IconType.SYMBOLIC : St.IconType.FULLCOLOR;

            this._menuItems = [];

            this.buttonDelete = this._createButton('delete');
            this.buttonEdit = this._createButton('edit');
            this.buttonCancel = this._createButton('cancel');
            new Tooltips.Tooltip(this.buttonDelete, _('Delete'));
            new Tooltips.Tooltip(this.buttonEdit, _('Edit'));
            new Tooltips.Tooltip(this.buttonCancel, _('Cancel'));

            if (visibleAppIcons) {
                this._createIcon(useSymbolicIcons);
            }

            this.menu.handleDragOver = (source, actor, x, y, time) => {
                return this.handleMenuDragOver(source, actor, x, y, time);
            };

            this.menu.handleDragOut = () => {
                this.handleMenuDragOut();
            };

            this.menu.acceptDrop = (source, actor, x, y, time) => {
                return this.acceptMenuDrop(source, actor, x, y, time);
            };
        } catch (error) {
            global.log(error);
        }
    }

    _createIcon(useSymbolicIcons) {
        this._icon = new St.Icon({
            gicon: this.applet.createGIcon(this.icon, useSymbolicIcons),
            icon_name: null,
            icon_type: this.iconType,
            icon_size: this.iconSize,
        });

        let params = {
            span: 0,
            expand: false,
            align: St.Align.START,
            actor: this._icon,
        };

        this._children.unshift(params);
        this._signals.connect(this.actor, 'destroy', this._removeChild.bind(this, this._icon));
        this.actor.add_actor(this._icon);
    }

    _onButtonReleaseEvent(actor, event) {
        let button = event.get_button();
        switch (actor.type) {
            case 'context-button':
                switch (actor.name) {
                    case 'delete':
                        this._onButtonDelete();
                        break;
                    case 'edit':
                        this._onButtonEdit();
                        break;
                    case 'cancel':
                        this._onButtonCancel();
                        break;
                    default:
                        break;
                }
                break;
            case 'popup-item':
                this._onItemClicked(button);
                break;
            default:
                break;
        }
        return true;
    }

    _onButtonHoverEvent(actor, event) {
        actor.set_opacity(actor.hover ? 255 : 125);
        actor.hover ? global.set_cursor(Cinnamon.Cursor.POINTING_HAND) : global.unset_cursor();
    }

    _onItemClicked(button) {
        switch (button) {
            case 1:
                if (this.applet.menu.isContextOpen()) {
                    if (!this._selected) {
                        this.applet.menu.unselectMenuItems();
                        this.select();
                    }
                } else {
                    this.menu.toggle();
                }
                break;
            case 3:
                if (this.applet.menu.isContextOpen()) {
                    if (!this._selected) {
                        this.applet.menu.unselectMenuItems();
                        this.select();
                    } else {
                        this._closeContext();
                    }
                } else {
                    this.select();
                    this._openContext();
                }
                break;
            default:
                break;
        }
    }

    _onButtonDelete() {
        this.applet.menu.close();
        Util.spawn_async(
            ['python3', `${this.applet.metadata.path}/dialogs.py`, 'confirm', this.icon, this.name],
            (response) => {
                response = JSON.parse(response);
                if (response === Gtk.ResponseType.YES) {
                    this.select();
                    this.applet.menu.removeSelectedMenuGroupItem();
                }
            }
        );
    }

    _onButtonEdit() {
        this.applet.menu.close();
        Util.spawn_async(
            [
                'python3',
                `${this.applet.metadata.path}/dialogs.py`,
                'edit',
                JSON.stringify(this.applet.listGroups),
                JSON.stringify([
                    {
                        type: 'group',
                        group: '',
                    },
                    this.icon,
                    this.name,
                ]),
            ],
            (response) => {
                response = JSON.parse(response);
                if (response !== null) {
                    let group = response[0];
                    if (group.name !== this.name || group.icon !== this.icon) {
                        this.select();
                        this.applet.menu.editSelectedMenuGroupItem(group.name, group.icon);
                    }
                }
            }
        );
    }

    _onButtonCancel() {
        this._closeContext();
    }

    setWidth(width) {
        this.actor.set_width(width);
    }

    getWidth() {
        return this.actor.get_width();
    }

    addMenuItem(item) {
        this.menu.addMenuItem(item);
        if (item instanceof MyPopupMenuItem) {
            this._menuItems.push(item);
        }
    }

    getMenuItems() {
        return this._menuItems;
    }

    setItemsIndentation(indent) {
        this.getMenuItems().forEach((item) => {
            item.setIndentation(indent);
        });
    }

    select() {
        this._selected = true;
        this.setShowDot(true);

        this.addActor(this.buttonEdit);
        this.addActor(this.buttonDelete);
        this.addActor(this.buttonCancel);
    }

    unselect() {
        this._selected = false;
        this.setShowDot(false);

        this.removeActor(this.buttonEdit);
        this.removeActor(this.buttonDelete);
        this.removeActor(this.buttonCancel);
    }

    setShowTriangle(show) {
        if (show) {
            this.addActor(this._triangleBin, { expand: true, span: -1, align: St.Align.END });
        } else {
            this.removeActor(this._triangleBin);
        }
    }

    isSelected() {
        return this._selected;
    }

    _createButton(name) {
        let button = new St.Icon({
            name: name,
            gicon: Gio.Icon.new_for_string(
                `${this.applet.metadata.path}/icons/${name}-symbolic.svg`
            ),
            icon_size: this.iconSize,
            icon_type: St.IconType.SYMBOLIC,
            opacity: 125,
            reactive: true,
            track_hover: true,
        });
        button.type = 'context-button';

        this._signals.connect(button, 'button-release-event', this._onButtonReleaseEvent, this);
        this._signals.connect(button, 'notify::hover', this._onButtonHoverEvent, this);

        return button;
    }

    _openContext() {
        this.applet.menu.openContext();
    }

    _closeContext() {
        this.applet.menu.closeContext();
    }

    handleMenuDragOver(source, actor, x, y, time) {
        this.applet.dragOverSubMenu = true;

        this.applet.handleDrag(source, x, y, this.menu.box, true);

        return DND.DragMotionResult.COPY_DROP;
    }

    handleMenuDragOut() {
        this.applet.dragOverSubMenu = false;
        this.applet.clearDragPlaceholder();
    }

    acceptMenuDrop(source, actor, x, y, time) {
        if (!source.isDraggableApp) {
            return false;
        }
        let app = this.applet.prepareAppInfo(source);
        let group = this.name;
        let index = this.index;

        this.applet.addApp(app.name, app.icon, group, app.command, index + this.applet.dragIndex);

        this.applet.endDrag();

        return true;
    }
}

class MyPopupMenuItem extends PopupMenu.PopupIconMenuItem {
    _init({
        applet = undefined,
        name = 'PopupMenuItem',
        group = '',
        visibleAppIcons = true,
        icon = 'application-x-executable',
        iconSize = 24,
        useSymbolicIcons = false,
        command = undefined,
        params = undefined,
    } = {}) {
        try {
            super._init(name, null, null, params);

            this.applet = applet;
            this.actor.type = 'popup-item';
            this._selected = false;
            this.name = name;
            this.group = group;
            this.icon = icon;
            this.iconSize = iconSize;
            this.iconType = useSymbolicIcons ? St.IconType.SYMBOLIC : St.IconType.FULLCOLOR;
            this.command = command;

            this.buttonDelete = this._createButton('delete');
            this.buttonEdit = this._createButton('edit');
            this.buttonCancel = this._createButton('cancel');
            new Tooltips.Tooltip(this.buttonDelete, _('Delete'));
            new Tooltips.Tooltip(this.buttonEdit, _('Edit'));
            new Tooltips.Tooltip(this.buttonCancel, _('Cancel'));

            if (visibleAppIcons) {
                this._icon.set_gicon(this.applet.createGIcon(this.icon, useSymbolicIcons));
                this._icon.set_icon_size(this.iconSize);
                this._icon.set_icon_type(this.iconType);
            } else {
                this._removeIcon();
            }
        } catch (error) {
            global.log(error);
        }
    }

    _onButtonReleaseEvent(actor, event) {
        let button = event.get_button();
        switch (actor.type) {
            case 'context-button':
                switch (actor.name) {
                    case 'delete':
                        this._onButtonDelete();
                        break;
                    case 'edit':
                        this._onButtonEdit();
                        break;
                    case 'cancel':
                        this._onButtonCancel();
                        break;
                    default:
                        break;
                }
                break;
            case 'popup-item':
                this._onItemClicked(button);
                break;
            default:
                break;
        }
        return true;
    }

    _onKeyPressEvent(actor, event) {
        let symbol = event.get_key_symbol();
        if (
            symbol === Clutter.KEY_space ||
            symbol === Clutter.KEY_Return ||
            symbol === Clutter.KEY_KP_Enter
        ) {
            this._onItemClicked(1);
            return true;
        }
        return false;
    }

    _onButtonHoverEvent(actor, event) {
        actor.set_opacity(actor.hover ? 255 : 125);
        actor.hover ? global.set_cursor(Cinnamon.Cursor.POINTING_HAND) : global.unset_cursor();
    }

    _onItemClicked(button) {
        switch (button) {
            case 1:
                if (this.applet.menu.isContextOpen()) {
                    if (!this._selected) {
                        this.applet.menu.unselectMenuItems();
                        this.select();
                    }
                } else {
                    this.applet.run(this.name, this.icon, this.command);
                    this.applet.menu.close(true);
                }
                break;
            case 2:
                if (!this.applet.menu.isContextOpen()) {
                    this.applet.run(this.name, this.icon, this.command);
                }
                break;
            case 3:
                if (this.applet.menu.isContextOpen()) {
                    if (!this._selected) {
                        this.applet.menu.unselectMenuItems();
                        this.select();
                    } else {
                        this._closeContext();
                    }
                } else {
                    this.select();
                    this._openContext();
                }
                break;
            default:
                break;
        }
    }

    _onButtonDelete() {
        this.applet.menu.close();
        Util.spawn_async(
            ['python3', `${this.applet.metadata.path}/dialogs.py`, 'confirm', this.icon, this.name],
            (response) => {
                response = JSON.parse(response);
                if (response === Gtk.ResponseType.YES) {
                    this.select();
                    this.applet.menu.removeSelectedMenuAppItem();
                }
            }
        );
    }

    _onButtonEdit() {
        this.applet.menu.close();
        Util.spawn_async(
            [
                'python3',
                `${this.applet.metadata.path}/dialogs.py`,
                'edit',
                JSON.stringify(this.applet.listGroups),
                JSON.stringify([
                    {
                        type: 'app',
                        group: this.group,
                    },
                    this.icon,
                    this.name,
                    this.command,
                ]),
            ],
            (response) => {
                response = JSON.parse(response);
                if (response !== null) {
                    let app = response[0];
                    let group = response[1];
                    if (group !== null) {
                        this.applet.appendToGroupBuffer(group.name, group.icon);
                    }
                    if (
                        app.name !== this.name ||
                        app.icon !== this.icon ||
                        app.group !== this.group ||
                        app.command !== this.command
                    ) {
                        this.select();
                        this.applet.menu.editSelectedMenuAppItem(
                            app.name,
                            app.icon,
                            app.group,
                            app.command
                        );
                    }
                }
            }
        );
    }

    _onButtonCancel() {
        this._closeContext();
    }

    setWidth(width) {
        this.actor.set_width(width);
    }

    getWidth() {
        return this.actor.get_width();
    }

    select() {
        this._selected = true;
        this.setShowDot(true);

        this.addActor(this.buttonEdit);
        this.addActor(this.buttonDelete);
        this.addActor(this.buttonCancel);
    }

    unselect() {
        this._selected = false;
        this.setShowDot(false);

        this.removeActor(this.buttonEdit);
        this.removeActor(this.buttonDelete);
        this.removeActor(this.buttonCancel);
    }

    isSelected() {
        return this._selected;
    }

    _removeIcon() {
        this.removeActor(this._icon);
    }

    _createButton(name) {
        let button = new St.Icon({
            name: name,
            gicon: Gio.Icon.new_for_string(
                `${this.applet.metadata.path}/icons/${name}-symbolic.svg`
            ),
            icon_size: this.iconSize,
            icon_type: St.IconType.SYMBOLIC,
            opacity: 125,
            reactive: true,
            track_hover: true,
        });
        button.type = 'context-button';

        this._signals.connect(button, 'button-release-event', this._onButtonReleaseEvent, this);
        this._signals.connect(button, 'notify::hover', this._onButtonHoverEvent, this);

        return button;
    }

    setIndentation(indent) {
        if (indent) {
            this.actor.get_children()[0].set_style('margin-left: 20px');
        } else {
            this.actor.get_children()[0].set_style(null);
        }
    }

    _openContext() {
        this.applet.menu.openContext();
    }

    _closeContext() {
        this.applet.menu.closeContext();
    }
}

class MyPopupSeparatorMenuItem extends PopupMenu.PopupBaseMenuItem {
    _init({ red = 255, green = 255, blue = 255, alpha = 255 } = {}) {
        try {
            super._init.call(this, { reactive: false });

            this._drawingArea = new St.DrawingArea({ style_class: 'popup-separator-menu-item' });
            this.addActor(this._drawingArea, { span: -1, expand: true });
            this._signals.connect(this._drawingArea, 'repaint', (area) => {
                this._onRepaint(area);
            });

            this.red = red;
            this.green = green;
            this.blue = blue;
            this.alpha = alpha;
        } catch (error) {
            global.log(error);
        }
    }

    _onRepaint(area) {
        let cr = area.get_context();
        let themeNode = area.get_theme_node();
        let [width, height] = area.get_surface_size();
        let margin = themeNode.get_length('-margin-horizontal');
        let gradientHeight = themeNode.get_length('-gradient-height');
        let gradientWidth = width - margin * 2;
        let gradientOffset = (height - gradientHeight) / 2;

        cr.setSourceRGBA(this.red / 255, this.green / 255, this.blue / 255, this.alpha / 255);
        cr.rectangle(margin, gradientOffset, gradientWidth, gradientHeight);
        cr.fill();

        cr.$dispose();
    }

    // fix: let the seperator count like an item for editing
    unselect() {}
    isSelected() {}
}

function main(metadata, orientation, panelHeight, instanceId) {
    return new MyApplet(metadata, orientation, panelHeight, instanceId);
}
