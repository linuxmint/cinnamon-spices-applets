/* Derived from the bundled user-adapted Cinnamon menu.
 * Modified by rasmarc: own UUID, two panel controls and a simple menu.
 * SPDX-License-Identifier: GPL-2.0-or-later
 * Original source information and hash: source-info.json.
 */

/*
 * SuperMenu translations. Copyright (C) 2026 rasmarc
 * SPDX-License-Identifier: GPL-2.0-or-later
 */
const PM_Gettext = imports.gettext;
const PM_TRANSLATION_DOMAIN = "supermenu@rasmarc";
PM_Gettext.bindtextdomain(PM_TRANSLATION_DOMAIN,
    imports.gi.GLib.get_home_dir() + "/.local/share/locale");

function _(text) {
    const translated = PM_Gettext.dgettext(PM_TRANSLATION_DOMAIN, text);
    return translated === text ? PM_Gettext.dgettext("cinnamon", text) : translated;
}


const Applet = imports.ui.applet;
const Mainloop = imports.mainloop;
const Cinnamon = imports.gi.Cinnamon;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const Main = imports.ui.main;
const MessageTray = imports.ui.messageTray;
const PopupMenu = imports.ui.popupMenu;
const UserWidget = imports.ui.userWidget;
const AppFavorites = imports.ui.appFavorites;
const Gtk = imports.gi.Gtk;
const Atk = imports.gi.Atk;
const Gio = imports.gi.Gio;
const XApp = imports.gi.XApp;
const AccountsService = imports.gi.AccountsService;
const GnomeSession = imports.misc.gnomeSession;
const ScreenSaver = imports.misc.screenSaver;
const FileUtils = imports.misc.fileUtils;
const Util = imports.misc.util;
const DND = imports.ui.dnd;
const Meta = imports.gi.Meta;
const DocInfo = imports.misc.docInfo;
const GLib = imports.gi.GLib;
const Settings = imports.ui.settings;
const Pango = imports.gi.Pango;
const SearchProviderManager = imports.ui.searchProviderManager;
const SignalManager = imports.misc.signalManager;
const Params = imports.misc.params;

const INITIAL_BUTTON_LOAD = 30;

const USER_DESKTOP_PATH = FileUtils.getUserDesktopDir();

const PRIVACY_SCHEMA = "org.cinnamon.desktop.privacy";
const REMEMBER_RECENT_KEY = "remember-recent-files";

const AppUtils = require('./appUtils');

let appsys = Cinnamon.AppSystem.get_default();

const POPUP_MIN_WIDTH = 500;
const POPUP_MAX_WIDTH = 900;
const POPUP_MIN_HEIGHT = 400;
const POPUP_MAX_HEIGHT = 1400;

const RefreshFlags = Object.freeze({
    APP:      0b000001,
    FAV_APP:  0b000010,
    FAV_DOC:  0b000100,
    PLACE:    0b001000,
    RECENT:   0b010000,
    SYSTEM:   0b100000
});
const REFRESH_ALL_MASK = 0b111111;

const NO_MATCH = 99999;
const MATCH_ADDERS = [
    0, // name
    1000, // keywords
    2000, // desc
    3000 // id
];

function calc_angle(x, y) {
    if (x === 0) { x = .001 }
    if (y === 0) { y = .001 }

    let r = Math.atan2(y, x) * (180 / Math.PI);
    return r;
}

function shorten_path(path, filename) {
    let str = path.replace("file://", "");
    str = str.replace(GLib.get_home_dir(), "~");
    str = str.replace("/" + filename, "");
    return str;
}


/* VisibleChildIterator takes a container (boxlayout, etc.)
 * and creates an array of its visible children and their index
 * positions.  We can then work through that list without
 * mucking about with positions and math, just give a
 * child, and it'll give you the next or previous, or first or
 * last child in the list.
 *
 * We could have this object regenerate off a signal
 * every time the visibles have changed in our applicationBox,
 * but we really only need it when we start keyboard
 * navigating, so increase speed, we reload only when we
 * want to use it.
 */
class VisibleChildIterator {
    constructor(container) {
        this.container = container;
        this.reloadVisible();
    }

    reloadVisible() {
        this.array = this.container.get_focus_chain()
            .filter(x => !(x._delegate instanceof PopupMenu.PopupSeparatorMenuItem));
    }

    next(curChild) {
        return this.getVisibleItem(this.array.indexOf(curChild) + 1);
    }

    prev(curChild) {
        return this.getVisibleItem(this.array.indexOf(curChild) - 1);
    }

    first() {
        return this.array[0];
    }

    last() {
        return this.array[this.array.length - 1];
    }

    getVisibleItem(index) {
        let len = this.array.length;
        index = ((index % len) + len) % len;
        return this.array[index];
    }

}

/**
 * SimpleMenuItem type strings in use:
 * -------------------------------------------------
 * app              ApplicationButton
 * category         CategoryButton
 * fav              FavoritesButton
 * no-recent        "No recent documents" button
 * no-favorites     "No favorite documents" button
 * none             Default type
 * place            PlaceButton
 * favorite         PathButton
 * recent           PathButton
 * recent-clear     "Clear recent documents" button
 * search-provider  SearchProviderResultButton
 * system           SystemButton
 * transient        TransientButton
 */

/**
 * SimpleMenuItem default parameters.
 */
const SMI_DEFAULT_PARAMS = Object.freeze({
    name:        '',
    description: '',
    type:        'none',
    styleClass:  'popup-menu-item',
    reactive:    true,
    activatable: true,
    withMenu:    false
});

/**
 * A simpler alternative to PopupBaseMenuItem - does not implement all interfaces of PopupBaseMenuItem. Any
 * additional properties in the params object beyond defaults will also be set on the instance.
 * @param {Object}  applet             - The menu applet instance
 * @param {Object}  params             - Object containing item parameters, all optional.
 * @param {string}  params.name        - The name for the menu item.
 * @param {string}  params.description - The description for the menu item.
 * @param {string}  params.type        - A string describing the type of item.
 * @param {string}  params.styleClass  - The item's CSS style class.
 * @param {boolean} params.reactive    - Item receives events.
 * @param {boolean} params.activatable - Activates via primary click. Must provide an 'activate' function on
 *                                       the prototype or instance.
 * @param {boolean} params.withMenu    - Shows menu via secondary click. Must provide a 'populateMenu' function
 *                                       on the prototype or instance.
 */
class SimpleMenuItem {
    constructor(applet, params) {
        params = Params.parse(params, SMI_DEFAULT_PARAMS, true);
        this._signals = new SignalManager.SignalManager();

        this.actor = new St.BoxLayout({
            style_class: params.styleClass,
            reactive: params.reactive,
            accessible_role: Atk.Role.MENU_ITEM,
        });

        this._signals.connect(this.actor, 'destroy', () => this.destroy(true));

        this.actor._delegate = this;
        this.applet = applet;
        this.labelContainer = new St.BoxLayout({
            vertical: true,
            y_expand: true,
            y_align: Clutter.ActorAlign.CENTER,
        });
        this.label = null;
        this.descriptionLabel = null;
        this.icon = null;

        this.matchIndex = NO_MATCH;

        for (let prop in params)
            this[prop] = params[prop];

        if (params.reactive) {
            this._signals.connect(this.actor, 'enter-event', () => applet._buttonEnterEvent(this));
            this._signals.connect(this.actor, 'leave-event', () => applet._buttonLeaveEvent(this));
            if (params.activatable || params.withMenu) {
                this._signals.connect(this.actor, 'button-release-event', this._onButtonReleaseEvent.bind(this));
                this._signals.connect(this.actor, 'key-press-event', this._onKeyPressEvent.bind(this));
            }
        }
    }

    _onButtonReleaseEvent(actor, event) {
        let button = event.get_button();
        if (this.activate && button === Clutter.BUTTON_PRIMARY) {
            this.activate();
            return Clutter.EVENT_STOP;
        } else if (this.populateMenu && button === Clutter.BUTTON_SECONDARY) {
            this.applet.toggleContextMenu(this);
            return Clutter.EVENT_STOP;
        }
        return Clutter.EVENT_PROPAGATE;
    }

    _onKeyPressEvent(actor, event) {
        let symbol = event.get_key_symbol();
        if (this.activate &&
            (symbol === Clutter.KEY_space ||
             symbol === Clutter.KEY_Return ||
             symbol === Clutter.KEY_KP_Enter)) {
            this.activate();
            return Clutter.EVENT_STOP;
        }
        return Clutter.EVENT_PROPAGATE;
    }

    /**
     * Adds an StIcon as the next child, accessible as `this.icon`.
     *
     * Either an icon name or gicon is required. Only one icon is supported by the
     * base SimpleMenuItem.
     *
     * @param {number}  iconSize - The icon size in px.
     * @param {string}  iconName - (optional) The icon name string.
     * @param {object}  gicon    - (optional) A gicon.
     * @param {boolean} symbolic - (optional) Whether the icon should be symbolic. Default: false.
     */
    addIcon(iconSize, iconName='', gicon=null, symbolic=false) {
        if (this.icon)
            return;

        let params = { icon_size: iconSize };

        if (iconName)
            params.icon_name = iconName;
        else if (gicon)
            params.gicon = gicon;

        params.icon_type = symbolic ? St.IconType.SYMBOLIC : St.IconType.FULLCOLOR;

        this.icon = new St.Icon(params);
        this.actor.add_actor(this.icon);
    }

    /**
     * Adds an StLabel as the next child, accessible as `this.label`.
     *
     * Only one label is supported by the base SimpleMenuItem prototype.
     *
     * @param {string} label      - (optional) An unformatted string. If markup is required, use
     *                               native methods directly: `this.label.clutter_text.set_markup()`.
     * @param {string} styleClass - (optional) A style class for the label.
     */
    addLabel(label='', styleClass=null) {
        if (this.label)
            return;

        this.label = new St.Label({ text: label });
        if (styleClass)
            this.label.set_style_class_name(styleClass);
        this.label.clutter_text.ellipsize = Pango.EllipsizeMode.END;
        this.actor.add_actor(this.labelContainer);
        this.labelContainer.add_actor(this.label);
        this.actor.set_label_actor(this.label);
    }

    addDescription(label='', styleClass=null) {
        if (this.descriptionLabel)
            return;

        if (label === '')
            return;

        this.descriptionLabel = new St.Label({
            text: label,
            y_expand: true,
            y_align: Clutter.ActorAlign.CENTER
        });

        if (styleClass)
            this.descriptionLabel.set_style_class_name(styleClass);
        this.descriptionLabel.clutter_text.ellipsize = Pango.EllipsizeMode.END;
        this.labelContainer.add_actor(this.descriptionLabel);
    }

    updateAccessibleName() {
        this.actor.set_label_actor(null);

        let name = "";
        if (this.label)
            name += this.label.get_text();
        if (this.descriptionLabel) {
            if (name.length > 0)
                name += ". ";
            name += this.descriptionLabel.get_text();
        }
        this.actor.set_accessible_name(name);
    }

    /**
     * Adds a ClutterActor as the next child.
     *
     * @param {ClutterActor} child
     */
    addActor(child) {
        this.actor.add_actor(child);
    }

    destroy(actorDestroySignal=false) {
        this._signals.disconnectAllSignals();

        if (this.label)
            this.label.destroy();
        if (this.descriptionLabel)
            this.descriptionLabel.destroy();
        if (this.icon)
            this.icon.destroy();
        if (!actorDestroySignal)
            this.actor.destroy();

        delete this.actor._delegate;
        delete this.actor;
        delete this.label;
        delete this.descriptionLabel;
        delete this.icon;
    }
}

class ApplicationContextMenuItem extends PopupMenu.PopupBaseMenuItem {
    constructor(appButton, label, action, iconName) {
        super({focusOnHover: false});

        this._appButton = appButton;
        this._action = action;
        this.label = new St.Label({ text: label });

        if (iconName != null) {
            this.icon = new St.Icon({
                icon_name: iconName,
                icon_size: 12,
                icon_type: St.IconType.SYMBOLIC,
            });
            if (this.icon)
                this.addActor(this.icon);
        }

        this.addActor(this.label);
        this.actor.set_label_actor(this.label);

        this._signals.connect(this, "active-changed", () => {
            if (this.active)
                this.actor.add_accessible_state(Atk.StateType.FOCUSED);
            else
                this.actor.remove_accessible_state(Atk.StateType.FOCUSED);
        });
    }

    activate (event) {
        let closeMenu = true;
        switch (this._action) {
            case "add_to_panel":
                if (!Main.AppletManager.get_role_provider_exists(Main.AppletManager.Roles.PANEL_LAUNCHER)) {
                    let new_applet_id = global.settings.get_int("next-applet-id");
                    global.settings.set_int("next-applet-id", (new_applet_id + 1));
                    let enabled_applets = global.settings.get_strv("enabled-applets");
                    enabled_applets.push("panel1:right:0:panel-launchers@cinnamon.org:" + new_applet_id);
                    global.settings.set_strv("enabled-applets", enabled_applets);
                }
                // wait until the panel launchers instance is actually loaded
                // 10 tries, delay 100ms
                let retries = 10;
                Mainloop.timeout_add(100, () => {
                    if (retries--) {
                        let launcherApplet = Main.AppletManager.get_role_provider(Main.AppletManager.Roles.PANEL_LAUNCHER);
                        if (!launcherApplet)
                            return true;
                        launcherApplet.acceptNewLauncher(this._appButton.app.get_id());
                    }
                    return false;
                });
                break;
            case "add_to_desktop":
                let file = Gio.file_new_for_path(this._appButton.app.get_app_info().get_filename());
                let destFile = Gio.file_new_for_path(USER_DESKTOP_PATH+"/"+file.get_basename());
                try{
                    file.copy(destFile, 0, null, function(){});
                    FileUtils.changeModeGFile(destFile, 755);
                }catch(e){
                    global.log(e);
                }
                break;
            case "add_to_favorites":
                AppFavorites.getAppFavorites().addFavorite(this._appButton.app.get_id());
                this.label.set_text(_("Remove from favorites"));
                this.icon.icon_name = "xsi-starred";
                this._action = "remove_from_favorites";
                closeMenu = false;
                break;
            case "remove_from_favorites":
                AppFavorites.getAppFavorites().removeFavorite(this._appButton.app.get_id());
                this.label.set_text(_("Add to favorites"));
                this.icon.icon_name = "xsi-non-starred";
                this._action = "add_to_favorites";
                closeMenu = false;
                break;
            case "app_properties":
                Util.spawnCommandLine("cinnamon-desktop-editor -mlauncher -o" + GLib.shell_quote(this._appButton.app.get_app_info().get_filename()));
                break;
            case "uninstall":
                Util.spawnCommandLine("/usr/bin/cinnamon-remove-application '" + this._appButton.app.get_app_info().get_filename() + "'");
                break;
            case "offload_launch":
                try {
                    this._appButton.app.launch_offloaded(0, [], -1);
                } catch (e) {
                    logError(e, "Could not launch app with dedicated gpu: ");
                }
                break;
            default:
                if (this._action.startsWith("action_")) {
                    let action = this._action.substring(7);
                    this._appButton.app.get_app_info().launch_action(action, global.create_app_launch_context());
                } else return true;
        }
        if (closeMenu) {
            this._appButton.applet.toggleContextMenu(this._appButton);
            this._appButton.applet.menu.close();
        }
        return false;
    }

}

class GenericApplicationButton extends SimpleMenuItem {
    constructor(applet, app, type, withMenu=false, styleClass="") {
        let desc = app.get_description() || "";
        super(applet, {
            name: app.get_name(),
            description: desc.split("\n")[0],
            type: type,
            withMenu: withMenu,
            styleClass: styleClass,
            app: app,
        });
    }

    set_application_icon(icon_size) {
        this.icon = this.app.create_icon_texture(icon_size);
        if (this.icon instanceof St.Icon) {
            let gicon = this.icon.get_gicon();
            if (gicon?.get_names) {
                let iconTheme = Gtk.IconTheme.get_default();
                let hasAnyIcon = gicon.get_names()
                    .some(name => iconTheme.lookup_icon(name, this.icon.icon_size, 0));
                if (!hasAnyIcon) {
                    this.icon = new St.Icon({
                        icon_name: 'application-x-executable',
                        icon_size: icon_size,
                        icon_type: St.IconType.FULLCOLOR
                    });
                }
            }
        }
    }

    highlight() {
        if (this.actor.has_style_pseudo_class('highlighted'))
            return;

        this.actor.add_style_pseudo_class('highlighted');
    }

    unhighlight() {
        if (!this.actor.has_style_pseudo_class('highlighted'))
            return;

        let appKey = this.app.get_id() || `${this.name}:${this.description}`;
        this.applet._knownApps.add(appKey);
        this.actor.remove_style_pseudo_class('highlighted');
    }

    activate() {
        this.unhighlight();
        this.app.open_new_window(-1);
        this.applet.menu.close();
    }

    populateMenu(menu) {
        let menuItem;
        if (Main.gpu_offload_supported) {
            menuItem = new ApplicationContextMenuItem(this, _("Run with dedicated GPU"), "offload_launch", "xsi-cpu");
            menu.addMenuItem(menuItem);
        }

        menuItem = new ApplicationContextMenuItem(this, _("Add to panel"), "add_to_panel", "xsi-list-add");
        menu.addMenuItem(menuItem);

        if (USER_DESKTOP_PATH){
            menuItem = new ApplicationContextMenuItem(this, _("Add to desktop"), "add_to_desktop", "xsi-computer");
            menu.addMenuItem(menuItem);
        }

        if (AppFavorites.getAppFavorites().isFavorite(this.app.get_id())){
            menuItem = new ApplicationContextMenuItem(this, _("Remove from favorites"), "remove_from_favorites", "xsi-starred");
            menu.addMenuItem(menuItem);
        } else {
            menuItem = new ApplicationContextMenuItem(this, _("Add to favorites"), "add_to_favorites", "xsi-non-starred");
            menu.addMenuItem(menuItem);
        }

        const appinfo = this.app.get_app_info();

        if (appinfo.get_filename() != null) {
            menuItem = new ApplicationContextMenuItem(this, _("Properties"), "app_properties", "xsi-document-properties-symbolic");
            menu.addMenuItem(menuItem);
        }

        if (this.applet._canUninstallApps) {
            menuItem = new ApplicationContextMenuItem(this, _("Uninstall"), "uninstall", "xsi-edit-delete");
            menu.addMenuItem(menuItem);
        }

        for (const action of appinfo.list_actions()) {
            let icon = Util.getDesktopActionIcon(action);
            let label = appinfo.get_action_name(action);
            menuItem = new ApplicationContextMenuItem(this, label, "action_" + action, icon);
            menu.addMenuItem(menuItem);
        }
    }
}

class TransientButton extends SimpleMenuItem {
    constructor(applet, pathOrCommand) {
        super(applet, {
            description: pathOrCommand,
            type: 'transient',
            styleClass: 'appmenu-application-button',
        });

        if (pathOrCommand.startsWith('~')) {
            pathOrCommand = pathOrCommand.slice(1);
            pathOrCommand = GLib.get_home_dir() + pathOrCommand;
        }

        this.isPath = pathOrCommand.substr(pathOrCommand.length - 1) == '/';
        if (this.isPath) {
            this.path = pathOrCommand;
        } else {
            let n = pathOrCommand.lastIndexOf('/');
            if (n != 1) {
                this.path = pathOrCommand.substr(0, n);
            }
        }

        this.pathOrCommand = pathOrCommand;

        this.file = Gio.file_new_for_path(this.pathOrCommand);

        try {
            this.handler = this.file.query_default_handler(null);
            let contentType = Gio.content_type_guess(this.pathOrCommand, null);
            let themedIcon = Gio.content_type_get_icon(contentType[0]);
            this.icon = new St.Icon({
                gicon: themedIcon,
                icon_size: applet.applicationIconSize,
                icon_type: St.IconType.FULLCOLOR,
            });
        } catch (e) {
            this.handler = null;
            let iconName = this.isPath ? 'folder' : 'unknown';
            this.icon = new St.Icon({
                icon_name: iconName,
                icon_size: applet.applicationIconSize,
                icon_type: St.IconType.FULLCOLOR,
            });
            // @todo Would be nice to indicate we don't have a handler for this file.
        }

        this.addActor(this.icon);

        this.addLabel(this.description, 'appmenu-application-button-label');

        this.isDraggableApp = false;
    }

    activate() {
        if (this.handler != null) {
            this.handler.launch([this.file], null);
        } else {
            // Try anyway, even though we probably shouldn't.
            try {
                Util.spawn(['gio', 'open', this.file.get_uri()]);
            } catch (e) {
                global.logError("No handler available to open " + this.file.get_uri());
            }
        }

        this.applet.menu.close();
    }
}

class ApplicationButton extends GenericApplicationButton {
    constructor(applet, app) {
        super(applet, app, 'app', true, 'appmenu-application-button');
        this.category = [];
        this.set_application_icon(applet.applicationIconSize);
        this.addActor(this.icon);

        this.addLabel(this.name, 'appmenu-application-button-label');
        if (applet.showDescription)
            this.addDescription(this.description, 'appmenu-application-button-description');

        this.updateAccessibleName();

        this._draggable = DND.makeDraggable(this.actor);
        this._signals.connect(this._draggable, 'drag-end', this._onDragEnd.bind(this));
        this.isDraggableApp = true;

        this.searchStrings = [
            AppUtils.decomp_string(app.get_name()).replace(/\s/g, ''),
            app.get_keywords() ? AppUtils.decomp_string(app.get_keywords()) : "",
            app.get_description() ? AppUtils.decomp_string(app.get_description()).replace(/\s/g, '') : "",
            app.get_id() ? AppUtils.decomp_string(app.get_id()) : ""
        ];
    }

    get_app_id() {
        return this.app.get_id();
    }

    getDragActor() {
        return this.app.create_icon_texture(this.applet.sidebarIconSize);
    }

    // Returns the original actor that should align with the actor
    // we show as the item is being dragged.
    getDragActorSource() {
        return this.actor;
    }

    _onDragEnd() {
        this.applet.favoriteAppsBox._delegate._clearDragPlaceholder();
    }

    destroy() {
        delete this._draggable;
        super.destroy();
    }
}

class SearchProviderResultButton extends SimpleMenuItem {
    constructor(applet, provider, result) {
        super(applet, {
            name:result.label,
            description: result.description,
            type: 'search-provider',
            styleClass: 'appmenu-application-button',
            provider: provider,
            result: result,
        });

        if (result.icon) {
            this.icon = result.icon;
        } else if (result.icon_app) {
            this.icon = result.icon_app.create_icon_texture(applet.applicationIconSize);
        } else if (result.icon_filename) {
            this.icon = new St.Icon({
                gicon: new Gio.FileIcon({ file: Gio.file_new_for_path(result.icon_filename) }),
                icon_size: applet.applicationIconSize,
            });
        }

        if (this.icon)
            this.addActor(this.icon);

        this.addLabel(result.label, 'appmenu-application-button-label');
    }

    activate() {
        try {
            this.provider.on_result_selected(this.result);
            this.applet.menu.close();
        } catch(e) {
            global.logError(e);
        }
    }

    destroy() {
        delete this.provider;
        delete this.result;
        super.destroy();
    }
}

class PlaceButton extends SimpleMenuItem {
    constructor(applet, place) {
        let selectedAppId = place.idDecoded.substr(place.idDecoded.indexOf(':') + 1);
        let fileIndex = selectedAppId.indexOf('file:///');
        if (fileIndex !== -1)
            selectedAppId = selectedAppId.substr(fileIndex + 7);

        if (selectedAppId === "home" || selectedAppId === "desktop" || selectedAppId === "connect") {
            selectedAppId = place.name
        }

        super(applet, {
            name: place.name,
            type: 'place',
            styleClass: 'appmenu-sidebar-button',
            place: place,
        });

        this.icon = place.iconFactory(applet.sidebarIconSize);
        if (this.icon)
            this.addActor(this.icon);
        else
            this.addIcon(applet.applicationIconSize, 'folder');

        this.addLabel(this.name, 'appmenu-application-button-label');
    }

    activate() {
        this.place.launch();
        this.applet.menu.close();
    }
}

class RecentButton extends SimpleMenuItem {
    constructor(applet, recent) {
        let path = recent.uriDecoded.replace("file://", "");
        path = path.replace(GLib.get_home_dir(), "~").replace("/" + recent.name, "");

        super(applet, {
            name: recent.name,
            description: path,
            type: 'recent',
            styleClass: 'appmenu-application-button',
            withMenu: true,
            uri: recent.uri,
        });

        this.icon = recent.createIcon(applet.applicationIconSize);
        this.addActor(this.icon);

        this.addLabel(this.name, 'appmenu-application-button-label');
        if (applet.showDescription)
            this.addDescription(this.description, 'appmenu-application-button-description');

        this.searchStrings = [
            AppUtils.decomp_string(recent.name).replace(/\s/g, '')
        ];
    }

    activate() {
        try {
            Gio.app_info_launch_default_for_uri(this.uri, global.create_app_launch_context());
            this.applet.menu.close();
        } catch (e) {
            let source = new MessageTray.SystemNotificationSource();
            Main.messageTray.add(source);
            let notification = new MessageTray.Notification(source,
                _("This file is no longer available"),
                e.message);
            notification.setTransient(true);
            notification.setUrgency(MessageTray.Urgency.NORMAL);
            source.notify(notification);
        }
    }
}

class PathButton extends SimpleMenuItem {
    constructor(applet, type, name, uri, icon) {
        super(applet, {
            name: name,
            description: shorten_path(uri, name),
            type: type,
            styleClass: 'appmenu-application-button',
            withMenu: false,
            uri: uri,
        });

        this.icon = icon;
        this.addActor(this.icon);

        this.addLabel(name, 'appmenu-application-button-label');

        if (applet.showDescription)
            this.addDescription(this.description, 'appmenu-application-button-description');

        this.searchStrings = [
            AppUtils.decomp_string(name).replace(/\s/g, '')
        ];
    }

    activate() {
        try {
            Gio.app_info_launch_default_for_uri(this.uri, global.create_app_launch_context());
            this.applet.menu.close();
        } catch (e) {
            let source = new MessageTray.SystemNotificationSource();
            Main.messageTray.add(source);
            let notification = new MessageTray.Notification(source,
                _("This file is no longer available"),
                e.message);
            notification.setTransient(true);
            notification.setUrgency(MessageTray.Urgency.NORMAL);
            source.notify(notification);
        }
    }
}

class CategoryButton extends SimpleMenuItem {
    constructor(applet, categoryId, label, icon, symbolic=false) {
        super(applet, {
            name: label,
            type: 'category',
            styleClass: 'appmenu-category-button',
            categoryId: categoryId,
        });

        let size = applet.categoryIconSize;
        if (applet.symbolicCategoryIcons) {
            symbolic = true;
            if (typeof icon !== 'string')
                if (icon?.get_names)
                    icon = icon.get_names()[0];
                else
                    icon = "";
            if (icon.startsWith("applications-") || icon === "folder-recent")
                icon = "xsi-" + icon;
            else if (icon == "xapp-user-favorites")
                icon = "xsi-user-favorites-symbolic";
            else if (icon == "preferences-system")
                icon = "xsi-applications-administration";
            else if (icon == "preferences-desktop")
                icon = "xsi-applications-preferences";
            else if (icon == "wine")
                icon = "xsi-applications-wine";
            else
                icon = "xsi-applications-other";
        }

        if (typeof icon === 'string')
            this.addIcon(size, icon, null, symbolic);
        else if (icon)
            this.addIcon(size, null, icon, symbolic);

        this.addLabel(this.name, 'appmenu-category-button-label');

        this.actor_motion_id = 0;
    }

    activate() {
        if(this.applet.searchActive || this.categoryId === this.applet.lastSelectedCategory)
            return;
        this.applet._select_category(this.categoryId);
        this.applet.hoveredApp = null;
        this.applet.categoriesBox.get_children().forEach(child =>
            child.set_style_class_name("appmenu-category-button"));
        this.actor.style_class = "appmenu-category-button-selected";
    }
}

class FavoritesButton extends GenericApplicationButton {
    constructor(applet, app) {
        super(applet, app, 'fav', false, 'appmenu-sidebar-button');
        this.set_application_icon(applet.sidebarIconSize);
        this.addActor(this.icon);
        this.addLabel(this.name, 'appmenu-application-button-label');

        this._draggable = DND.makeDraggable(this.actor);
        this._signals.connect(this._draggable, 'drag-end', this._onDragEnd.bind(this));
        this.isDraggableApp = true;
    }

    _onDragEnd() {
        this.actor.get_parent()._delegate._clearDragPlaceholder();
    }

    get_app_id() {
        return this.app.get_id();
    }

    getDragActor() {
        return new Clutter.Clone({ source: this.actor });
    }

    // Returns the original actor that should align with the actor
    // we show as the item is being dragged.
    getDragActorSource() {
        return this.actor;
    }

    destroy() {
        delete this._draggable;
        super.destroy();
    }
}

class SystemButton extends SimpleMenuItem {
    constructor(applet, iconName, name, desc) {
        super(applet, {
            name: name,
            description: desc,
            type: 'system',
            styleClass: 'appmenu-system-button',
        });
        this.addIcon(16, iconName, null, true);
        this.actor.set_accessible_name(name);
        this.actor.set_accessible_role(Atk.Role.BUTTON);
    }
}

class CategoriesApplicationsBox {
    constructor() {
        this.actor = new St.BoxLayout({ vertical: false, style_class: 'appmenu-categories-applications-box' });
        this.actor._delegate = this;
    }

    acceptDrop (source, actor, x, y, time) {
        if (source instanceof FavoritesButton){
            source.actor.destroy();
            actor.destroy();
            AppFavorites.getAppFavorites().removeFavorite(source.app.get_id());
            return true;
        }
        return false;
    }

    handleDragOver (source, actor, x, y, time) {
        if (source instanceof FavoritesButton)
            return DND.DragMotionResult.POINTING_DROP;

        return DND.DragMotionResult.CONTINUE;
    }
}

class SidebarScrollBox {
    constructor() {
        this.actor = new St.BoxLayout({
            vertical: true,
            y_expand: true,
            y_align: Clutter.ActorAlign.START,
            style_class: 'appmenu-sidebar-scrollbox'
        });
        this.actor._delegate = this;
    }
}

class FavoriteAppsBox {
    constructor() {
        this.actor = new St.BoxLayout({
            vertical: true,
            y_expand: true,
            y_align: Clutter.ActorAlign.START,
            style_class: 'appmenu-favs-box'
        });
        this.actor._delegate = this;

        this._dragPlaceholder = null;
        this._dragPlaceholderPos = -1;
        this._animatingPlaceholdersCount = 0;
    }

    _clearDragPlaceholder() {
        if (this._dragPlaceholder) {
            this._dragPlaceholder.animateOutAndDestroy();
            this._dragPlaceholder = null;
            this._dragPlaceholderPos = -1;
        }
    }

    handleDragOver (source, actor, x, y, time) {
        let app = source.app;

        let favorites = AppFavorites.getAppFavorites().getFavorites();
        let numFavorites = favorites.length;

        let favPos = favorites.indexOf(app);

        let children = this.actor.get_children();
        let numChildren = children.length;
        let boxHeight = this.actor.height;

        // Keep the placeholder out of the index calculation; assuming that
        // the remove target has the same size as "normal" items, we don't
        // need to do the same adjustment there.
        if (this._dragPlaceholder) {
            boxHeight -= this._dragPlaceholder.actor.height;
            numChildren--;
        }

        let pos = Math.round(y * numChildren / boxHeight);

        if (pos != this._dragPlaceholderPos && pos <= numFavorites) {
            if (this._animatingPlaceholdersCount > 0) {
                let appChildren = children.filter(function(actor) {
                    return (actor._delegate instanceof FavoritesButton);
                });
                this._dragPlaceholderPos = children.indexOf(appChildren[pos]);
            } else {
                this._dragPlaceholderPos = pos;
            }

            // Don't allow positioning before or after self
            if (favPos != -1 && (pos == favPos || pos == favPos + 1)) {
                if (this._dragPlaceholder) {
                    this._dragPlaceholder.animateOutAndDestroy();
                    this._animatingPlaceholdersCount++;
                    this._dragPlaceholder.actor.connect('destroy', () => {
                        this._animatingPlaceholdersCount--;
                    });
                }
                this._dragPlaceholder = null;

                return DND.DragMotionResult.CONTINUE;
            }

            // If the placeholder already exists, we just move
            // it, but if we are adding it, expand its size in
            // an animation
            let fadeIn;
            if (this._dragPlaceholder) {
                this._dragPlaceholder.actor.destroy();
                fadeIn = false;
            } else {
                fadeIn = true;
            }

            this._dragPlaceholder = new DND.GenericDragPlaceholderItem();
            this._dragPlaceholder.child.set_width (source.actor.height);
            this._dragPlaceholder.child.set_height (source.actor.height);
            this.actor.insert_child_at_index(this._dragPlaceholder.actor,
                                             this._dragPlaceholderPos);
            if (fadeIn)
                this._dragPlaceholder.animateIn();
        }

        let id = app.get_id();
        let favoritesMap = AppFavorites.getAppFavorites().getFavoriteMap();
        let srcIsFavorite = (id in favoritesMap);

        if (!srcIsFavorite)
            return DND.DragMotionResult.COPY_DROP;

        return DND.DragMotionResult.MOVE_DROP;
    }

    // Draggable target interface
    acceptDrop (source, actor, x, y, time) {
        let app = source.app;

        let id = app.get_id();

        let favorites = AppFavorites.getAppFavorites().getFavoriteMap();

        let srcIsFavorite = (id in favorites);

        let favPos = 0;
        let children = this.actor.get_children();
        for (let i = 0; i < this._dragPlaceholderPos; i++) {
            if (this._dragPlaceholder &&
                children[i] == this._dragPlaceholder.actor)
                continue;

            if (!(children[i]._delegate instanceof FavoritesButton)) continue;

            let childId = children[i]._delegate.app.get_id();
            if (childId == id)
                continue;
            if (childId in favorites)
                favPos++;
        }

        Meta.later_add(Meta.LaterType.BEFORE_REDRAW, () => {
                let appFavorites = AppFavorites.getAppFavorites();
                if (srcIsFavorite)
                    appFavorites.moveFavoriteToPos(id, favPos);
                else
                    appFavorites.addFavoriteAtPos(id, favPos);
                return false;
            });

        return true;
    }
}

/* This is so we can override the default key-press-event handler in PopupMenu.PopupMenu
 * and prevent animation when the menu via Escape. */
class Menu extends Applet.AppletPopupMenu {
    constructor(launcher, orientation) {
        super(launcher, orientation);
    }

    _onKeyPressEvent(actor, event) {
        if (event.get_key_symbol() === Clutter.KEY_Escape) {
            this.close(false);
            return true;
        }

        return false;
    }
}

class CinnamonMenuApplet extends Applet.TextIconApplet {
    constructor(orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        this.setAllowedLayout(Applet.AllowedLayout.BOTH);

        this.set_applet_tooltip(_("Menu"));
        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Menu(this, orientation);
        this.menuManager.addMenu(this.menu);

        const edit_item = new PopupMenu.PopupIconMenuItem(_("Edit applications menu"), "xsi-document-edit", St.IconType.SYMBOLIC);
        edit_item.connect("activate", () => Util.spawnCommandLine("cinnamon-menu-editor"));
        this._applet_context_menu.addMenuItem(edit_item);

        this.settings = new Settings.AppletSettings(this, "supermenu@rasmarc", instance_id);
        this.settings.connect("settings-changed", () => {
            this._size_dirty = true;
        });

        global.connect("scale-changed", () => {
            this._size_dirty = true;
        })

        this._resizer = new Applet.PopupResizeHandler(this.menu.actor,
            () => this._orientation,
            (w,h) => this._onBoxResized(w,h),
            () => this.popup_width * global.ui_scale,
            () => this.popup_height * global.ui_scale);

        this.settings.bind("show-favorites", "showFavorites", () => this.queueRefresh(RefreshFlags.FAV_DOC));
        this.settings.bind("show-recents", "showRecents", () => this.queueRefresh(RefreshFlags.RECENT));

        this._appletEnterEventId = 0;
        this._appletLeaveEventId = 0;
        this._appletHoverDelayId = 0;

        this.settings.bind("hover-delay", "hover_delay_ms", this._updateActivateOnHover);
        this.settings.bind("activate-on-hover", "activateOnHover", this._updateActivateOnHover);
        this._updateActivateOnHover();

        this.menu.setCustomStyleClass('appmenu-background');
        this.menu.connect('open-state-changed', this._onOpenStateChanged.bind(this));
        this.menu.connect('menu-animated-closed', () => {
            this._clearAllSelections();
            this._hideAllAppActors();
        });

        this.settings.bind("menu-custom", "menuCustom", this._updateIconAndLabel);
        this.settings.bind("menu-icon", "menuIcon", this._updateIconAndLabel);
        this.settings.bind("menu-icon-size", "menuIconSize", this._updateIconAndLabel);
        this.settings.bind("menu-label", "menuLabel", this._updateIconAndLabel);
        this.settings.bind("pm-menu-shortcut", "overlayKey", this._updateKeybinding);
        this.settings.bind("symbolic-category-icons", "symbolicCategoryIcons", () => this.queueRefresh(REFRESH_ALL_MASK));
        this.settings.bind("category-icon-size", "categoryIconSize", () => this.queueRefresh(REFRESH_ALL_MASK));
        this.settings.bind("category-hover", "categoryHover", this._updateCategoryHover);
        this.settings.bind("application-icon-size", "applicationIconSize", () => this.queueRefresh(REFRESH_ALL_MASK));
        this.settings.bind("search-position", "searchPosition", () => this._layout());
        this.settings.bind("system-position", "systemPosition", () => this._layout());
        this.settings.bind("show-description", "showDescription", () => this.queueRefresh(REFRESH_ALL_MASK));
        this.settings.bind("show-sidebar", "showSidebar", this._sidebarToggle);
        this.settings.bind("sidebar-max-width", "sidebarMaxWidth", this._sidebarToggle);
        this.settings.bind("show-avatar", "showAvatar", this._avatarToggle);
        this.settings.bind("show-home", "showHome", () => this.queueRefresh(REFRESH_ALL_MASK));
        this.settings.bind("show-desktop", "showDesktop", () => this.queueRefresh(REFRESH_ALL_MASK));
        this.settings.bind("show-downloads", "showDownloads", () => this.queueRefresh(REFRESH_ALL_MASK));
        this.settings.bind("show-documents", "showDocuments", () => this.queueRefresh(REFRESH_ALL_MASK));
        this.settings.bind("show-music", "showMusic", () => this.queueRefresh(REFRESH_ALL_MASK));
        this.settings.bind("show-pictures", "showPictures", () => this.queueRefresh(REFRESH_ALL_MASK));
        this.settings.bind("show-videos", "showVideos", () => this.queueRefresh(REFRESH_ALL_MASK));
        this.settings.bind("show-bookmarks", "showBookmarks", () => this.queueRefresh(REFRESH_ALL_MASK));
        this.settings.bind("sidebar-icon-size", "sidebarIconSize", () => this.queueRefresh(REFRESH_ALL_MASK));
        this.settings.bind("enable-animation", "enableAnimation", null);
        this.settings.bind("popup-width", "popup_width");
        this.settings.bind("popup-height", "popup_height");

        this._updateKeybinding();

        Main.themeManager.connect("theme-set", this._theme_set.bind(this));
        this._updateIconAndLabel();

        this._searchInactiveIcon = new St.Icon({
            style_class: 'appmenu-search-entry-icon',
            icon_name: 'xsi-edit-find',
            icon_type: St.IconType.SYMBOLIC,
        });
        this._searchActiveIcon = new St.Icon({
            style_class: 'appmenu-search-entry-icon',
            icon_name: 'xsi-edit-clear',
            icon_type: St.IconType.SYMBOLIC,
        });
        this._searchIconClickedId = 0;
        this._applicationsButtons = [];
        this._placesButtons = [];
        this._transientButtons = [];
        this.recentButton = null;
        this._recentButtons = [];
        this.favoriteDocsButton = null;
        this._favoriteDocButtons = [];
        this._categoryButtons = [];
        this._searchProviderButtons = [];
        this.hoveredApp = null;
        this.hoveredCategory = null;
        this._activeContainer = null;
        this._activeActor = null;
        this._knownApps = new Set(); // Used to keep track of apps that are already installed, so we can highlight newly installed ones
        this._appsWereRefreshed = false;
        this._canUninstallApps = GLib.file_test("/usr/bin/cinnamon-remove-application", GLib.FileTest.EXISTS);
        this.RecentManager = DocInfo.getDocManager();
        this.privacy_settings = new Gio.Settings( {schema_id: PRIVACY_SCHEMA} );
        this.noRecentDocuments = true;
        this._activeContextMenuParent = null;
        this._activeContextMenuItem = null;
        this._display();
        appsys.connect('installed-changed', () => this.queueRefresh(RefreshFlags.APP | RefreshFlags.FAV_APP));
        AppFavorites.getAppFavorites().connect('changed', () => this.queueRefresh(RefreshFlags.FAV_APP));
        Main.placesManager.connect('places-updated', () => this.queueRefresh(RefreshFlags.PLACE));
        this.RecentManager.connect('changed', () => this.queueRefresh(RefreshFlags.RECENT));
        this.privacy_settings.connect("changed::" + REMEMBER_RECENT_KEY, () => this.queueRefresh(RefreshFlags.RECENT));
        XApp.Favorites.get_default().connect("changed", () => this.queueRefresh(RefreshFlags.FAV_DOC));
        this._pathCompleter = new Gio.FilenameCompleter();
        this._pathCompleter.set_dirs_only(false);
        this.contextMenu = null;
        this.lastSelectedCategory = null;

        this.orderDirty = false;

        this._session = new GnomeSession.SessionManager();
        this._screenSaverProxy = new ScreenSaver.ScreenSaverProxy();

        // We shouldn't need to call refreshAll() here... since we get a "icon-theme-changed" signal when CSD starts.
        // The reason we do is in case the Cinnamon icon theme is the same as the one specified in GTK itself (in .config)
        // In that particular case we get no signal at all.
        this.refreshId = 0;
        this.refreshMask = REFRESH_ALL_MASK;
        this._doRefresh();

        this.set_show_label_in_vertical_panels(false);
    }

    _onBoxResized(width, height) {
        width = (width / global.ui_scale).clamp(POPUP_MIN_WIDTH, POPUP_MAX_WIDTH);
        height = (height / global.ui_scale).clamp(POPUP_MIN_HEIGHT, POPUP_MAX_HEIGHT);

        //Only update settings when resizing is completed to avoid excessive disk writes.
        if (!this._resizer.resizingInProgress) {
            this.popup_width = width;
            this.popup_height = height;
        }

        this._setMenuSize(width, height);
    }

    _updateKeybinding() {
        Main.keybindingManager.addXletHotKey(this, "overlay-key", this.overlayKey, () => {
            if (!Main.overview.visible && !Main.expo.visible) {
                this.menu.toggle_with_options(this.enableAnimation);
            }
        });
    }

    _updateCategoryHover() {
        this.categoriesBox.get_children().forEach(child => {
            if (child._delegate.actor_motion_id > 0) {
                child.disconnect(child._delegate.actor_motion_id);
                child._delegate.actor_motion_id = 0;
            }

            if (this.categoryHover) {
                child._delegate.actor_motion_id = child.connect("motion-event", this._categoryMotionEvent.bind(this));
            }
        }, this);
    }

    queueRefresh(refreshFlags) {
        if (!refreshFlags)
            return;
        this.refreshMask |= refreshFlags;
        if (this.refreshId)
            Mainloop.source_remove(this.refreshId);
        this.refreshId = Mainloop.timeout_add(500, () => this._doRefresh(), Mainloop.PRIORITY_LOW);
    }

    _doRefresh() {
        this.refreshId = 0;
        if (this.refreshMask === 0)
            return;

        let m = this.refreshMask;
        if ((m & RefreshFlags.APP) === RefreshFlags.APP)
            this._refreshApps();
        if ((m & RefreshFlags.SYSTEM) === RefreshFlags.SYSTEM)
            this._refreshSystemButtons();
        if ((m & RefreshFlags.FAV_DOC) === RefreshFlags.FAV_DOC)
            this._refreshFavDocs();
        if ((m & RefreshFlags.PLACE) === RefreshFlags.PLACE)
            this._refreshSidebar();
        if ((m & RefreshFlags.FAV_APP) === RefreshFlags.FAV_APP)
            this._refreshSidebar();
        if ((m & RefreshFlags.RECENT) === RefreshFlags.RECENT)
            this._refreshRecent();

        this.refreshMask = 0;

        // Repack the three special categories at the bottom of the category list.
        if (this.favoriteDocsButton) {
            this.categoriesBox.set_child_at_index(this.favoriteDocsButton.actor, -1);
        }

        if (this.recentButton) {
            this.categoriesBox.set_child_at_index(this.recentButton.actor, -1);
        }

        this._size_dirty = true;

        this._updateCategoryHover();
    }

    openMenu() {
        if (!this._applet_context_menu.isOpen) {
            this.menu.open(this.enableAnimation);
        }
    }

    _clearDelayCallbacks() {
        if (this._appletHoverDelayId > 0) {
            Mainloop.source_remove(this._appletHoverDelayId);
            this._appletHoverDelayId = 0;
        }
        if (this._appletLeaveEventId > 0) {
            this.actor.disconnect(this._appletLeaveEventId);
            this._appletLeaveEventId = 0;
        }

        return false;
    }

    _updateActivateOnHover() {
        if (this._appletEnterEventId > 0) {
            this.actor.disconnect(this._appletEnterEventId);
            this._appletEnterEventId = 0;
        }

        this._clearDelayCallbacks();

        if (!this.activateOnHover)
            return;

        this._appletEnterEventId = this.actor.connect('enter-event', () => {
            if (this.hover_delay_ms > 0) {
                this._appletLeaveEventId = this.actor.connect('leave-event', () => { this._clearDelayCallbacks });
                this._appletHoverDelayId = Mainloop.timeout_add(this.hover_delay_ms,
                    () => {
                        this.openMenu();
                        this._clearDelayCallbacks();
                    });
            } else {
                this.openMenu();
            }
        });
    }

    _setMenuSize(width, height) {
        this.main_container.natural_height = (height * global.ui_scale);
        this.main_container.natural_width = (width * global.ui_scale);
        this._size_dirty = false;
    }

    on_orientation_changed (orientation) {
        this._updateIconAndLabel();
        this._size_dirty = true;
    }

    on_applet_removed_from_panel () {
        Main.keybindingManager.removeXletHotKey(this, "overlay-key");
    }

    // settings button callbacks
    _launch_editor() {
        Util.spawnCommandLine("cinnamon-menu-editor");
    }

    _reset_menu_size() {
        this.popup_width = this.settings.getDefaultValue("popup-width");
        this.popup_height = this.settings.getDefaultValue("popup-height");

        this._setMenuSize(this.popup_width, this.popup_height);
    }

    on_applet_clicked(event) {
        this.menu.toggle_with_options(this.enableAnimation);
    }

    _onOpenStateChanged(menu, open) {
        if (open) {
            this.actor.add_style_pseudo_class('active');
            global.stage.set_key_focus(this.searchEntry);
            this._activeContainer = null;
            this._activeActor = null;

            this.lastSelectedCategory = null;

            if (this._size_dirty) {
                this._setMenuSize(this.popup_width, this.popup_height);
            }

            let n = Math.min(this._applicationsButtons.length,
                             INITIAL_BUTTON_LOAD);
            for (let i = 0; i < n; i++) {
                this._applicationsButtons[i].actor.show();
            }
            this._allAppsCategoryButton.actor.style_class = "appmenu-category-button-selected";

            Mainloop.idle_add(() => {
                if(this.lastSelectedCategory !== null) //if a category is already selected
                    return;
                for (let i = n; i < this._applicationsButtons.length; i++)
                    this._applicationsButtons[i].actor.show();
            });
        } else {
            this.actor.remove_style_pseudo_class('active');
            if (this.searchActive) {
                this.resetSearch();
            }

            this.hoveredCategory = null;
            this.hoveredApp = null;
            this.closeContextMenu(false);

            this._disableVectorMask();
            this._scrollToButton(null, this.applicationsScrollView);
            this._scrollToButton(null, this.categoriesScrollView);
            this._scrollToButton(null, this.sidebarScrollView);
        }
    }

    destroy() {
        this.actor._delegate = null;
        this.menu.destroy();
        this.actor.destroy();
        this.emit('destroy');
    }

    _sidebarToggle() {
        if (!this.showSidebar)
            this.sidebar.hide();
        else {
            this.sidebar.show();
            this.sidebar.set_style(`max-width: ${this.sidebarMaxWidth}px;`);
        }

        this.updateNavigation();
    }

    _avatarToggle() {
        if (!this.showAvatar) {
            this.userIcon.hide();
            this.avatarSeparator.hide();
        }
        else {
            this.userIcon.show();
            this.avatarSeparator.show();
        }
    }

    // Override js/applet.js so _updateIconAndLabel doesn't have to fight with size changes
    // from the panel configuration. This gets called any time set_applet_icon() variants are
    // called.
    _setStyle() {
        let icon_type = this._applet_icon.get_icon_type();
        let size;

        if (this.menuCustom) {
            size = Math.min(this.menuIconSize, this.panel.height);
        } else {
            size = this.getPanelIconSize(icon_type);
        }

        if (icon_type === St.IconType.FULLCOLOR) {
            this._applet_icon.set_style_class_name('applet-icon');
        } else {
            this._applet_icon.set_style_class_name('system-status-icon');
        }

        this._applet_icon.set_icon_size(size);
    }

    on_panel_icon_size_changed() {
        this._updateIconAndLabel();
    }

    _theme_set() {
        this._size_dirty = true;
        this._updateIconAndLabel();
    }

    _updateIconAndLabel(){
        try {
            if (this.menuCustom) {
                if (this.menuIcon == "") {
                    this.set_applet_icon_name("");
                } else if (GLib.path_is_absolute(this.menuIcon) && GLib.file_test(this.menuIcon, GLib.FileTest.EXISTS)) {
                    if (this.menuIcon.search("-symbolic") != -1)
                        this.set_applet_icon_symbolic_path(this.menuIcon);
                    else
                        this.set_applet_icon_path(this.menuIcon);
                } else if (Gtk.IconTheme.get_default().has_icon(this.menuIcon)) {
                    if (this.menuIcon.search("-symbolic") != -1)
                        this.set_applet_icon_symbolic_name(this.menuIcon);
                    else
                        this.set_applet_icon_name(this.menuIcon);
                }
            } else {
                let icon_name = global.settings.get_string('app-menu-icon-name');
                if (icon_name.search("-symbolic") != -1) {
                    this.set_applet_icon_symbolic_name(icon_name);
                }
                else {
                    this.set_applet_icon_name(icon_name);
                }
            }
        } catch(e) {
            global.logWarning("Could not load icon file \""+this.menuIcon+"\" for menu button");
        }

        // Hide the icon box if the icon name/path is empty
        if ((this.menuCustom && this.menuIcon == "") || (!this.menuCustom && global.settings.get_string('app-menu-icon-name') == "")){
            this._applet_icon_box.hide();
        } else {
            this._applet_icon_box.show();
        }

        // Hide the menu label in vertical panels
        if (this._orientation == St.Side.LEFT || this._orientation == St.Side.RIGHT)
        {
            this.set_applet_label("");
        }
        else {
            if (this.menuCustom) {
                if (this.menuLabel != "")
                    this.set_applet_label(_(this.menuLabel));
                else
                    this.set_applet_label("");
            }
            else {
                this.set_applet_label(global.settings.get_string('app-menu-label'));
            }
        }
    }

    _contextMenuOpenStateChanged(menu) {
        if (menu.isOpen) {
            this._activeContextMenuParent = menu.sourceActor._delegate;
            this._scrollToButton(menu);
        } else {
            this._activeContextMenuItem = null;
            this._activeContextMenuParent = null;
            menu.sourceActor = null;
        }
    }

    toggleContextMenu(button) {
        if (!button.withMenu)
            return;

        if (!this.contextMenu) {
            let menu = new PopupMenu.PopupSubMenu(null); // hack: creating without actor

            // More hack! Let the application box adjust its scrollbar instead of allowing this
            // context menu to have one (which ends up with a tiny allocation) - this occurs when
            // the menu is restrained by the work area.
            menu._needsScrollbar = function() {
                return false;
            };

            menu.actor.set_style_class_name('appmenu-context-menu');
            menu.connect('open-state-changed', this._contextMenuOpenStateChanged.bind(this));
            this.contextMenu = menu;
            this.applicationsBox.add_actor(menu.actor);
        } else if (this.contextMenu.isOpen &&
                   this.contextMenu.sourceActor != button.actor) {
            this.contextMenu.close();
        }

        if (!this.contextMenu.isOpen) {
            this.contextMenu.box.destroy_all_children();
            this.applicationsBox.set_child_above_sibling(this.contextMenu.actor, button.actor);
            this.contextMenu.sourceActor = button.actor;
            button.populateMenu(this.contextMenu);
        }

        this.contextMenu.toggle();
    }

    _navigateContextMenu(button, symbol, ctrlKey) {
        if (symbol === Clutter.KEY_Menu || symbol === Clutter.KEY_Escape ||
            (ctrlKey && (symbol === Clutter.KEY_Return || symbol === Clutter.KEY_KP_Enter))) {
            this.toggleContextMenu(button);
            return;
        }

        let minIndex = 0;
        let goUp = symbol === Clutter.KEY_Up || symbol === Clutter.KEY_KP_Up;
        let nextActive = null;
        let menuItems = this.contextMenu._getMenuItems(); // The context menu items

        // The first context menu item of a RecentButton is used just as a label.
        // So remove it from the iteration.
        if (button && button instanceof RecentButton) {
            minIndex = 1;
        }

        let menuItemsLength = menuItems.length;

        switch (symbol) {
            case Clutter.KEY_Page_Up:
                this._activeContextMenuItem = menuItems[minIndex];
                this._activeContextMenuItem.setActive(true);
                return;
            case Clutter.KEY_Page_Down:
                this._activeContextMenuItem = menuItems[menuItemsLength - 1];
                this._activeContextMenuItem.setActive(true);
                return;
        }

        if (!this._activeContextMenuItem) {
            if (symbol === Clutter.KEY_Return || symbol === Clutter.KEY_KP_Enter) {
                button.activate();
            } else {
                this._activeContextMenuItem = menuItems[goUp ? menuItemsLength - 1 : minIndex];
                this._activeContextMenuItem.setActive(true);
            }
            return;
        } else if (this._activeContextMenuItem &&
            (symbol === Clutter.KEY_Return || symbol === Clutter.KEY_KP_Enter)) {
            this._activeContextMenuItem.activate();
            this._activeContextMenuItem = null;
            return;
        }

        for (let i = minIndex; i < menuItemsLength; i++) {
            if (menuItems[i] === this._activeContextMenuItem) {
                let nextActiveIndex = (goUp ? i - 1 : i + 1);

                if (nextActiveIndex < minIndex) {
                    nextActiveIndex = menuItemsLength - 1;
                } else if (nextActiveIndex > menuItemsLength - 1) {
                    nextActiveIndex = minIndex;
                }

                nextActive = menuItems[nextActiveIndex];
                nextActive.setActive(true);
                this._activeContextMenuItem = nextActive;

                break;
            }
        }
    }

    _onMenuKeyPress(actor, event) {
        let symbol = event.get_key_symbol();
        let item_actor;
        this.appBoxIter.reloadVisible();
        this.catBoxIter.reloadVisible();
        this.placesBoxIter.reloadVisible();
        this.favBoxIter.reloadVisible();
        this.sysBoxIter.reloadVisible();

        let keyCode = event.get_key_code();
        let modifierState = Cinnamon.get_event_state(event);

        /* Accounts for mirrored RTL layout.
           Switches between left/right key presses */
        if(St.Widget.get_default_direction() === St.TextDirection.RTL) {
            switch(symbol) {
                case Clutter.KEY_Right:
                    symbol = Clutter.KEY_Left;
                    break;
                case Clutter.KEY_KP_Right:
                    symbol = Clutter.KEY_RP_Left;
                    break;
                case Clutter.KEY_Left:
                    symbol = Clutter.KEY_Right;
                    break;
                case Clutter.KEY_KP_Left:
                    symbol = Clutter.KEY_KP_Right;
                    break;
            }
        }

        /* check for a keybinding and quit early, otherwise we get a double hit
           of the keybinding callback */
        let action = global.display.get_keybinding_action(keyCode, modifierState);

        if (action == Meta.KeyBindingAction.CUSTOM) {
            return Clutter.EVENT_STOP;
        }

        if (this.searchEntryText.has_preedit()) {
            // There is an uncommitted text in the search box, let the input method to handle this.
            return Clutter.EVENT_PROPAGATE;
        }

        let ctrlKey = modifierState & Clutter.ModifierType.CONTROL_MASK;

        // If a context menu is open, hijack keyboard navigation and concentrate on the context menu.
        if (this._activeContextMenuParent &&
            this._activeContainer === this.applicationsBox) {
            let continueNavigation = false;
            switch (symbol) {
                case Clutter.KEY_Up:
                case Clutter.KEY_KP_Up:
                case Clutter.KEY_Down:
                case Clutter.KEY_KP_Down:
                case Clutter.KEY_Return:
                case Clutter.KEY_KP_Enter:
                case Clutter.KEY_Menu:
                case Clutter.KEY_Page_Up:
                case Clutter.KEY_Page_Down:
                case Clutter.KEY_Escape:
                    this._navigateContextMenu(this._activeContextMenuParent, symbol, ctrlKey);
                    break;
                case Clutter.KEY_Right:
                case Clutter.KEY_KP_Right:
                case Clutter.KEY_Left:
                case Clutter.KEY_KP_Left:
                case Clutter.KEY_Tab:
                case Clutter.KEY_ISO_Left_Tab:
                    continueNavigation = true;
                    break;
            }
            if (!continueNavigation)
                return Clutter.EVENT_STOP;
        }

        if (this._activeContainer === null) {
            this._setKeyFocusToCurrentCategoryButton();
        }

        if (this._activeContainer === null) {
            // Likely there are no categories or apps visible due to a bad search, let the key event
            // event continue to the search entry.
            return Clutter.EVENT_PROPAGATE;
        }

        let iter = this._activeContainer._vis_iter;
        let active = this._activeActor;
        switch (symbol) {
            case Clutter.KEY_Up:
            case Clutter.KEY_KP_Up:
                item_actor = iter.prev(active);
                if (iter.up && active === iter.first())
                    item_actor = iter.up.last();
                break;
            case Clutter.KEY_Down:
            case Clutter.KEY_KP_Down:
                item_actor = iter.next(active);
                if (iter.down && active === iter.last())
                    item_actor = iter.down.first();
                break;
            case Clutter.KEY_Right:
            case Clutter.KEY_KP_Right:
            case Clutter.KEY_Tab:
                if (!this.searchActive) {
                    item_actor = iter.right.first();
                    if (iter.right === this.catBoxIter)
                        item_actor = this.hoveredCategory || iter.right.first();
                    else if (iter.right === this.appBoxIter)
                        item_actor = this.hoveredApp || iter.right.first();
                    if (this._activeContainer === this.systemBox) {
                        if (active === iter.last())
                            item_actor = iter.right.first();
                        else
                            item_actor = iter.next(active);
                    }
                }
                break;
            case Clutter.KEY_Left:
            case Clutter.KEY_KP_Left:
            case Clutter.KEY_ISO_Left_Tab:
                if (!this.searchActive)  {
                    item_actor = iter.left.first();
                    if (iter.left === this.catBoxIter)
                        item_actor = this.hoveredCategory || iter.left.first();
                    else if (iter.left === this.appBoxIter)
                        item_actor = this.hoveredApp || iter.left.first();
                    else if (iter.left === this.sysBoxIter)
                        item_actor = iter.left.last();
                    if (this._activeContainer === this.systemBox) {
                        if (active === iter.first())
                            item_actor = iter.left.first();
                        else
                            item_actor = iter.prev(active);
                    }
                }
                break;
            case Clutter.KEY_Return:
            case Clutter.KEY_KP_Enter:
                if (ctrlKey && this._activeContainer === this.applicationsBox) {
                    this.toggleContextMenu(active._delegate);
                    return Clutter.EVENT_STOP;
                }
                else {
                    active._delegate.activate();
                    return Clutter.EVENT_STOP;
                }
                break;
            case Clutter.KEY_Menu:
                if (this._activeContainer === this.applicationsBox) {
                    this.toggleContextMenu(active._delegate);
                    return Clutter.EVENT_STOP;
                }
            default:
                break;
        }

        if (!item_actor || item_actor === this.searchEntry) {
            return Clutter.EVENT_PROPAGATE;
        }

        if (item_actor._delegate instanceof CategoryButton)
            this._scrollToButton(item_actor._delegate, this.categoriesScrollView);
        else if (item_actor._delegate instanceof FavoritesButton)
            this._scrollToButton(item_actor._delegate, this.sidebarScrollView);
        else if (item_actor.get_parent() === this.applicationsBox)
            this._scrollToButton(item_actor._delegate, this.applicationsScrollView);

        this._buttonEnterEvent(item_actor._delegate);
        return Clutter.EVENT_STOP;
    }

    _buttonEnterEvent(button) {
        this.categoriesBox.get_children().forEach(child => child.remove_style_pseudo_class("hover"));
        this.categoriesBox.get_children().forEach(child => child.remove_accessible_state(Atk.StateType.FOCUSED));
        this.applicationsBox.get_children().forEach(child => child.set_style_class_name("appmenu-application-button"));
        this.favoriteAppsBox.get_children().forEach(child => child.remove_style_pseudo_class("hover"));
        this.placesBox.get_children().forEach(child => child.remove_style_pseudo_class("hover"));
        this.systemBox.get_children().forEach(child => child.remove_style_pseudo_class("hover"));

        if (button instanceof CategoryButton) {
            if (this.searchActive)
                return;

            if (button.categoryId !== this.lastSelectedCategory) {
                if (this.categoryHover) {
                    this.categoriesBox.get_children().forEach(child =>
                        child.set_style_class_name("appmenu-category-button"));
                    button.activate();
                } else {
                    button.actor.add_style_pseudo_class("hover");
                }
            }
            this.hoveredCategory = button.actor;
        } else {
            const isFav = button instanceof FavoritesButton || button instanceof SystemButton || button instanceof PlaceButton;
            if (isFav) {
                button.actor.add_style_pseudo_class("hover");
            } else {
                button.actor.set_style_class_name(`${button.styleClass}-selected`);
                this.hoveredApp = button.actor;
            }
        }

        button.actor.add_accessible_state(Atk.StateType.FOCUSED);

        let parent = button.actor.get_parent();
        this._activeContainer = parent;
        this._activeActor = button.actor;
    }

    _buttonLeaveEvent (button) {
        if (button instanceof CategoryButton) {
            if (button.categoryId !== this.lastSelectedCategory && !this.searchActive) {
                button.actor.set_style_class_name("appmenu-category-button");
                if (button.actor.has_style_pseudo_class("hover")) {
                    button.actor.remove_style_pseudo_class("hover");
                }
            }
        } else {
            if (button instanceof FavoritesButton || button instanceof SystemButton)
                button.actor.remove_style_pseudo_class("hover");
            else
                button.actor.set_style_class_name(button.styleClass);
        }

        button.actor.remove_accessible_state(Atk.StateType.FOCUSED);

        // This method is only called on mouse leave so return key focus to the
        // currently active category button.
        this._setKeyFocusToCurrentCategoryButton();
    }

    _setKeyFocusToCurrentCategoryButton() {
        const currentSelectedCategoryActor = this.categoriesBox.get_children().find(child =>
            child._delegate.categoryId === this.lastSelectedCategory);
        if (currentSelectedCategoryActor) {
            this._activeContainer = this.categoriesBox;
            this._activeActor = currentSelectedCategoryActor;
        }
    }

     /* Category Box
     *   _____
     *  |    /|T
     *  |   / |
     *  |  /__|__________pointer Y
     *  | |\  |
     *  | | \ |
     *  |_|__\|B
     *    |
     *    |
     *    |pointer X
     */

    /*
     * The vector mask activates on any motion from a category button. At this point, all
     * category buttons are made non-reactive.
     *
     * The starting point and two corners of the category box are taken, and two angles are
     * calculated to intersect with the right box corners. If a movement is within those two
     * angles, the current position is made the last position and used on the next interval.
     *
     * In this manner the left vertex of the triangle follows the mouse and category-switching
     * is disabled as long as the pointer stays in bounds.
     *
     * If the poll interval is made too large, category switching will become sluggish. Polling
     * stops when there is no movement.
     */

    static DEBUG_VMASK = false;
    static POLL_INTERVAL = 30;
    static MIN_MOVEMENT = 2; // Movement smaller than this disables the mask.

    _getNewVectorInfo() {
        let [mx, my, mask] = global.get_pointer();
        let [bx, by] = this.categoriesScrollView.get_transformed_position();

        // The allocation is the only thing that works here - the 'height'
        // property (and natural height) are the size of the entire scrollable
        // area (the inner categoriesBox), which is weird...
        let alloc = this.categoriesScrollView.get_allocation_box();
        let bw = alloc.x2 - alloc.x1;
        let bh = alloc.y2 - alloc.y1;

        let x_dist = bx + bw - mx;
        let y_dist = my - by;

        // Calculate their angle from 3 o'clock.
        let top_angle = calc_angle(x_dist, y_dist);
        y_dist -= bh;
        let bottom_angle = calc_angle(x_dist, y_dist);

        let debug_actor = null;

        if (CinnamonMenuApplet.DEBUG_VMASK) {
            debug_actor = new St.Polygon({
                ulc_x: mx,        ulc_y: my,
                llc_x: mx,        llc_y: my,
                urc_x: bx + bw,   urc_y: by,
                lrc_x: bx + bw,   lrc_y: by + bh,
                reactive: false,
                debug: true
            });

            global.stage.add_actor(debug_actor);
        }

        return {
            start_x: mx,
            start_y: my,
            bx: bx,
            by1: by,
            by2: by + bh,
            bw: bw,
            bh: bh,
            top_angle: top_angle,
            bottom_angle: bottom_angle,
            debug_actor: debug_actor
        };
    }

    _updateVectorInfo(mx, my) {
        let bx = this.vector_mask_info.bx;
        let by = this.vector_mask_info.by1;
        let bw = this.vector_mask_info.bw;
        let bh = this.vector_mask_info.bh;

        let x_dist = bx + bw - mx;
        let y_dist = my - by;

        // Calculate their angle from 3 o'clock.
        let top_angle = calc_angle(x_dist, y_dist);
        y_dist -= bh;

        let bottom_angle = calc_angle(x_dist, y_dist);

        // Padding moves the saved x position slightly left, this makes the mask
        // more forgiving of random small movement when starting to choose an
        // app button.
        this.vector_mask_info.start_x = mx;
        this.vector_mask_info.start_y = my;
        this.vector_mask_info.top_angle = top_angle;
        this.vector_mask_info.bottom_angle = bottom_angle;

        if (CinnamonMenuApplet.DEBUG_VMASK) {
            this.vector_mask_info.debug_actor.ulc_x = mx;
            this.vector_mask_info.debug_actor.llc_x = mx;
            this.vector_mask_info.debug_actor.ulc_y = my;
            this.vector_mask_info.debug_actor.llc_y = my;
        }
    }

    _keepMaskActive() {
        let ret = false;
        let angle = 0;

        let [mx, my, mask] = global.get_pointer();

        // Check for out of range entirely.
        if (mx >= this.vector_mask_info.bx + this.vector_mask_info.bw ||
            my < this.vector_mask_info.by1 ||
            my > this.vector_mask_info.by2) {
            return false;
        }

        let x_dist = mx - this.vector_mask_info.start_x;
        let y_dist = this.vector_mask_info.start_y - my;

        if (Math.abs(Math.hypot(x_dist, y_dist)) < CinnamonMenuApplet.MIN_MOVEMENT) {
            return false;
        }

        angle = calc_angle(x_dist, y_dist);

        ret = angle <= this.vector_mask_info.top_angle &&
              angle >= this.vector_mask_info.bottom_angle;

        this._updateVectorInfo(mx, my);

        if (CinnamonMenuApplet.DEBUG_VMASK) {
            log(`${this.vector_mask_info.top_angle.toFixed()} <---${angle.toFixed()}---> ${this.vector_mask_info.bottom_angle.toFixed()} - Continue? ${ret}`);
        }

        return ret;
    }

    _enableVectorMask(actor) {
        this._disableVectorMask();

        this.vector_mask_info = this._getNewVectorInfo(actor);

        // While the mask is active, disable category buttons.
        this._setCategoryButtonsReactive(false);

        this.vector_update_loop = Mainloop.timeout_add(CinnamonMenuApplet.POLL_INTERVAL, this._maskPollTimeout.bind(this));
    }

    _maskPollTimeout() {
        if (this._keepMaskActive()) {
            return GLib.SOURCE_CONTINUE;
        }

        this._disableVectorMask();
        return GLib.SOURCE_REMOVE;
    }

    _categoryMotionEvent(actor, event) {
        // Always keep the mask engaged - motion-events on the category buttons
        // trigger this.

        if (this.vector_update_loop == 0) {
            this._enableVectorMask(actor);
        }

        return Clutter.EVENT_PROPAGATE;
    }

    _disableVectorMask() {
        if (this.vector_update_loop > 0) {
            this._setCategoryButtonsReactive(true);
            Mainloop.source_remove(this.vector_update_loop);
            this.vector_update_loop = 0;

            if (CinnamonMenuApplet.DEBUG_VMASK) {
                this.vector_mask_info.debug_actor.destroy();
            }
        }
    }

    _setCategoryButtonsReactive(active) {
        for (let button of this._categoryButtons) {
            button.actor.reactive = active;
            button.actor.queue_redraw();
        }
    }

    _refreshSidebar() {
        //Remove all places
        this.placesBox.destroy_all_children();

        //Load places again
        this._placesButtons = [];

        let places = [...Main.placesManager.getDefaultPlaces(), ...Main.placesManager.getBookmarks()];
        for (let place of places) {
            let path = place.idDecoded.replace("bookmark:file://", "")
            switch (path) {
                case "special:home":
                    if (!this.showHome)
                        continue;
                    break;
                case "special:desktop":
                     if (!this.showDesktop)
                        continue;
                    break;
                case GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_DOWNLOAD):
                    if (!this.showDownloads)
                        continue;
                    break;
                case GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_DOCUMENTS):
                    if (!this.showDocuments)
                        continue;
                    break;
                case GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_MUSIC):
                    if (!this.showMusic)
                        continue;
                    break;
                case GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_PICTURES):
                    if (!this.showPictures)
                        continue;
                    break;
                case GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_VIDEOS):
                    if (!this.showVideos)
                        continue;
                    break;
                default:
                    if (!this.showBookmarks)
                        continue;
                    break;
            }
            let button = new PlaceButton(this, place);
            this._placesButtons.push(button);
            this.placesBox.add(button.actor, {
                y_align: St.Align.END,
                y_fill: false
            });
        }
        this.placesBox.queue_relayout();

        // Update navigation because the presence/absence of places
        // can impact it.
        this.updateNavigation();

        // FAV APPS
        this.favoriteAppsBox.destroy_all_children();
        let showingSomeFavorites = false;
        let launchers = global.settings.get_strv('favorite-apps');
        for (let launcher of launchers) {
            let app = appsys.lookup_app(launcher);
            if (app) {
                let button = new FavoritesButton(this, app);
                showingSomeFavorites = true;
                this.favoriteAppsBox.add(button.actor, { y_align: St.Align.END, y_fill: false });
            }
        }
        this.favoriteAppsBox.queue_relayout();

        // Separator between favs and places
        if (this._placesButtons.length > 0 && showingSomeFavorites)
            this.placesSeparator.show();
        else
            this.placesSeparator.hide();
        this.sidebarScrollBox.queue_relayout();
    }

    _refreshRecent () {
        this._recentButtons.forEach(button => button.destroy());
        this._recentButtons = [];

        const index = this._categoryButtons.findIndex(button => button.categoryId === 'recent');
        if (index !== -1) {
            this._categoryButtons[index].destroy();
            this._categoryButtons.splice(index, 1);
            this.recentButton = null;
        }

        if (!this.showRecents || !this.privacy_settings.get_boolean(REMEMBER_RECENT_KEY)) {
            return;
        }

        if (!this.recentButton) {
            this.recentButton = new CategoryButton(this, 'recent', _('Recent Files'), 'folder-recent');
            this._categoryButtons.push(this.recentButton);
            this.categoriesBox.add_actor(this.recentButton.actor);
        }

        let recents = this.RecentManager._infosByTimestamp.filter(info => !info.name.startsWith("."));
        if (recents.length > 0) {
            this.noRecentDocuments = false;
            recents.forEach( info => {
                let icon = info.createIcon(this.applicationIconSize);
                let button = new PathButton(this, 'recent', info.name, info.uri, icon);
                this._recentButtons.push(button);
                this.applicationsBox.add_actor(button.actor);
                button.actor.visible = this.menu.isOpen && this.lastSelectedCategory === "recent";
            });

            let button = new SimpleMenuItem(this, { name: _("Clear list"),
                                                    description: _("Clear all recent documents"),
                                                    type: 'recent-clear',
                                                    styleClass: 'appmenu-application-button' });
            button.addIcon(22, 'edit-clear', null, true);
            button.addLabel(button.name, 'appmenu-application-button-label');
            button.label.set_style('font-weight: bold;');
            button.activate = () => {
                this.menu.close();
                (new Gtk.RecentManager()).purge_items();
            };

            this._recentButtons.push(button);
            this.applicationsBox.add_actor(button.actor);
            button.actor.visible = this.menu.isOpen && this.lastSelectedCategory === "recent";
        } else {
            this.noRecentDocuments = true;
            let button = new SimpleMenuItem(this, { name: _("No recent documents"),
                                                    type: 'no-recent',
                                                    styleClass: 'appmenu-application-button',
                                                    reactive: false,
                                                    activatable: false });
            button.addLabel(button.name, 'appmenu-application-button-label');
            this._recentButtons.push(button);
            this.applicationsBox.add_actor(button.actor);
            button.actor.visible = this.menu.isOpen && this.lastSelectedCategory === "recent";
        }
    }

    _refreshFavDocs() {
        this._favoriteDocButtons.forEach(button => button.destroy());
        this._favoriteDocButtons = [];

        const index = this._categoryButtons.findIndex(button => button.categoryId === 'favorite');
        if (index !== -1) {
            this._categoryButtons[index].destroy();
            this._categoryButtons.splice(index, 1);
            this.favoriteDocsButton = null;
        }

        let favorite_infos = XApp.Favorites.get_default().get_favorites(null);

        if (!this.showFavorites) {
            return;
        }

        if (!this.favoriteDocsButton) {
            this.favoriteDocsButton = new CategoryButton(this, 'favorite', _('Favorites'), 'xapp-user-favorites');
            this._categoryButtons.push(this.favoriteDocsButton);
            this.categoriesBox.add_actor(this.favoriteDocsButton.actor);
        }

        if (favorite_infos.length > 0) {
            favorite_infos.forEach( info => {
                let icon = new St.Icon({
                    gicon: Gio.content_type_get_icon(info.cached_mimetype),
                    icon_size: this.applicationIconSize
                });
                let button = new PathButton(this, 'favorite', info.display_name, info.uri, icon);
                this._favoriteDocButtons.push(button);
                this.applicationsBox.add_actor(button.actor);
                button.actor.visible = this.menu.isOpen && this.lastSelectedCategory === "favorite";
            });
        }
        else {
            let button = new SimpleMenuItem(this, { name: _("No favorite documents"),
                                                    type: 'no-favorites',
                                                    styleClass: 'appmenu-application-button',
                                                    reactive: false,
                                                    activatable: false });
            button.addLabel(button.name, 'appmenu-application-button-label');
            this._favoriteDocButtons.push(button);
            this.applicationsBox.add_actor(button.actor);
            button.actor.visible = this.menu.isOpen && this.lastSelectedCategory === "favorite";
        }
    }

    _refreshApps() {
        /* iterate in reverse, so multiple splices will not upset
         * the remaining elements */
        for (let i = this._categoryButtons.length - 1; i > -1; i--) {
            let b = this._categoryButtons[i];
            if (['recent', 'favorite'].includes(b.categoryId))
                continue;
            this._categoryButtons[i].destroy();
            this._categoryButtons.splice(i, 1);
        }

        this._applicationsButtons.forEach(button => button.destroy());
        this._applicationsButtons = [];

        const index = this._categoryButtons.findIndex(button => button.categoryId == null);
        if (index !== -1) {
            this._categoryButtons[index].destroy();
            this._categoryButtons.splice(index, 1);
            this._allAppsCategoryButton = null;
        }
        this._allAppsCategoryButton = new CategoryButton(this, null, _("All Applications"), "cinnamon-all-applications", true);
        this.categoriesBox.add_actor(this._allAppsCategoryButton.actor);
        this._categoryButtons.push(this._allAppsCategoryButton);

        // grab top level directories and all apps in them
        let [apps, dirs] = AppUtils.getApps();

        // generate all category buttons from top-level directories
        dirs.forEach( d => {
            let categoryButton = new CategoryButton(this, d.get_menu_id(), d.get_name(), d.get_icon());
            this._categoryButtons.push(categoryButton);
            this.categoriesBox.add_actor(categoryButton.actor);
        });

        /* we add them in reverse at index 0 so they are always above places and
         * recent buttons, and below */
        for (let i = apps.length - 1; i > -1; i--) {
            let app = apps[i][0];
            let button = new ApplicationButton(this, app);
            button.category = apps[i][1];
            let appKey = app.get_id() || `${app.get_name()}:${app.get_description()}`;

            // appsWereRefreshed if this is not initial load. on initial load every
            // app is marked known.
            if (this._appsWereRefreshed && !this._knownApps.has(appKey))
                button.highlight();
            else
                this._knownApps.add(appKey);

            this._applicationsButtons.push(button);
            this.applicationsBox.insert_child_at_index(button.actor, 0);
            button.actor.visible = this.menu.isOpen &&
                                   (this.lastSelectedCategory === button.category ||
                                   this.lastSelectedCategory == null);
        }

        // we expect this array to be in the same order as the child list
        this._applicationsButtons.reverse();
        this._appsWereRefreshed = true;
    }

    _refreshSystemButtons() {
        // Remove all system buttons
        this.systemBox.destroy_all_children();

        // Load system buttons again
        let button;

        //Lock screen
        button = _superMenuSessionButton(SystemButton, this, "lock-screen", "xsi-lock-screen",
                                  _("Lock Screen"),
                                  _("Lock the screen"));
        button.actor.add_style_class_name("appmenu-system-button-lock");

        button.activate = () => {
            this.menu.close();

            let screensaver_settings = new Gio.Settings({ schema_id: "org.cinnamon.desktop.screensaver" });
            let screensaver_dialog = GLib.find_program_in_path("cinnamon-screensaver-command");
            if (screensaver_dialog) {
                if (screensaver_settings.get_boolean("ask-for-away-message")) {
                    Util.spawnCommandLine("cinnamon-screensaver-lock-dialog");
                }
                else {
                    Util.spawnCommandLine("cinnamon-screensaver-command --lock");
                }
            }
            else {
                this._screenSaverProxy.LockRemote("");
            }
        };

        this.systemBox.add(button.actor, { y_align: St.Align.MIDDLE, y_fill: false });

        //Logout button
        button = _superMenuSessionButton(SystemButton, this, "log-out", "xsi-log-out",
                                  _("Log Out"),
                                  _("Leave the session"));
        button.actor.add_style_class_name("appmenu-system-button-logout");

        button.activate = () => {
            this.menu.close();
            this._session.LogoutRemote(0);
        };

        this.systemBox.add(button.actor, { y_align: St.Align.MIDDLE, y_fill: false });

        //Shutdown button
        button = _superMenuSessionButton(SystemButton, this, "shutdown", "xsi-shutdown",
                                  _("Shut Down"),
                                  _("Shut down the computer"));
        button.actor.add_style_class_name("appmenu-system-button-logout");

        button.activate = () => {
            this.menu.close();
            this._session.ShutdownRemote();
        };

        this.systemBox.add(button.actor, { y_align: St.Align.MIDDLE, y_fill: false });
    }

    _scrollToButton(button, scrollBox = this.applicationsScrollView) {
        let adj = scrollBox.get_vscroll_bar().get_adjustment();
        if (button) {
            let box = scrollBox.get_allocation_box();
            let boxHeight = box.y2 - box.y1;
            let actorBox = button.actor.get_allocation_box();
            let currentValue = adj.get_value();
            let newValue = currentValue;

            if (currentValue > actorBox.y1 - 10)
                newValue = actorBox.y1 - 10;
            if (boxHeight + currentValue < actorBox.y2 + 10)
                newValue = actorBox.y2 - boxHeight + 10;

            if (newValue != currentValue)
                adj.set_value(newValue);
        } else {
            adj.set_value(0);
        }
    }

    _layout() {
        // Position the search bar
        this.right_box.remove_all_children();
        if (this.searchPosition == "top") {
            this.right_box.add(this.searchBox, {span: 1});
            this.right_box.add(this.searchSeparator);
            this.right_box.add(this.categoriesApplicationsBox.actor, {
                expand: true,
                span: 1,
            });
            this.categoriesApplicationsBox.actor.remove_style_pseudo_class("top");
        }
        else {
            this.right_box.add(this.categoriesApplicationsBox.actor, {
                expand: true,
                span: 1,
            });
            this.categoriesApplicationsBox.actor.add_style_pseudo_class("top");
            this.right_box.add(this.searchSeparator);
            this.right_box.add(this.searchBox, {span: 1});
        }

        // Position the system box
        if (this.systemPosition == "sidebar")
            global.reparentActor(this.systemBox, this.sidebar);
        else
            global.reparentActor(this.systemBox, this.searchBox);
    }

    _buildSidebar() {
        this.sidebar = new St.BoxLayout({
            style_class: 'appmenu-sidebar',
            vertical: true
        });

        this.userBox = new St.BoxLayout({
            style_class: 'appmenu-sidebar-user-box',
            vertical: true,
            reactive: false
        });

        let user = AccountsService.UserManager.get_default().get_user(GLib.get_user_name());
        this.userIcon = new UserWidget.UserWidget(user, Clutter.Orientation.VERTICAL, false);
        this.userIcon.set_reactive(true);
        this.userIcon.track_hover = true;
        this.userIcon.set_accessible_role(Atk.Role.BUTTON);
        this.userIcon.set_accessible_name(_("Account details"));
        this.userIcon.connect('button-press-event', () => {
            this.menu.toggle();
            Util.spawnCommandLine("cinnamon-settings user");
        });

        this.userBox.add(this.userIcon);

        this.avatarSeparator = new PopupMenu.PopupSeparatorMenuItem().actor;
        this.placesSeparator = new PopupMenu.PopupSeparatorMenuItem().actor;

        this.sidebarScrollBox = new SidebarScrollBox().actor;
        this.sidebarScrollView = new St.ScrollView({
            y_align: St.Align.START,
            style_class: 'appmenu-sidebar-scrollview'
        });
        this.sidebarScrollView.set_policy(St.PolicyType.NEVER, St.PolicyType.AUTOMATIC);
        this.sidebarScrollView.add_actor(this.sidebarScrollBox);
        this.sidebarScrollView.get_vscroll_bar().hide();

        this.placesBox = new St.BoxLayout({
            vertical: true,
            y_align: Clutter.ActorAlign.START,
            style_class: 'appmenu-places-box'
        });

        this.favoriteAppsBox = new FavoriteAppsBox().actor;

        this.main_container.add(this.sidebar, { span: 1 });

        this.sidebar.add(this.userBox, {
            x_fill:  true,
            y_fill:  true,
            x_align: St.Align.MIDDLE,
            y_align: St.Align.START
        });
        this.sidebar.add(this.avatarSeparator);
        this.sidebar.add(this.sidebarScrollView, { expand: true });
        this.sidebarScrollBox.add(this.placesBox);
        this.sidebarScrollBox.add(this.placesSeparator);
        this.sidebarScrollBox.add(this.favoriteAppsBox);
    }

    _display() {
        this._activeContainer = null;
        this._activeActor = null;
        this.actor_motion_id = 0;
        this.vector_update_loop = 0;
        let section = new PopupMenu.PopupMenuSection();
        this.menu.addMenuItem(section);

        this.main_container = new St.BoxLayout({
            vertical: false,
            style_class: 'appmenu-main-box'
        });
        this.main_container._delegate = null;
        section.addActor(this.main_container, {
            expand: true,
            span: -1,
            align: St.Align.START,
        });

        this._buildSidebar();

        this.right_box = new St.BoxLayout({ vertical: true, style_class: 'appmenu-right-box'});
        this.main_container.add(this.right_box, { expand: true });

        this.searchBox = new St.BoxLayout({
            style_class: 'appmenu-search-box',
            vertical: false,
        });
        this.searchEntry = new St.Entry({
            name: 'appmenu-search-entry',
            track_hover: true,
            can_focus: true,
            accessible_name: _("Search"),
            accessible_role: Atk.Role.ENTRY,
        });
        this.searchEntry.add_accessible_state(Atk.StateType.EDITABLE);

        this.searchEntry.set_secondary_icon(this._searchInactiveIcon);
        this.searchActive = false;
        this.searchEntryText = this.searchEntry.clutter_text;
        this.searchEntryText.connect('text-changed', this._onSearchTextChanged.bind(this));
        this.searchEntryText.connect('key-press-event', this._onMenuKeyPress.bind(this));
        this._previousSearchPattern = "";

        this.categoriesApplicationsBox = new CategoriesApplicationsBox();

        this.categoriesBox = new St.BoxLayout({
            style_class: 'appmenu-categories-box',
            vertical: true,
            accessible_role: Atk.Role.LIST
        });

        this.categoriesScrollView = new St.ScrollView({ style_class: 'appmenu-categories-scrollview' });
        this.categoriesScrollView.add_actor(this.categoriesBox);
        this.categoriesScrollView.set_policy(St.PolicyType.NEVER, St.PolicyType.AUTOMATIC);
        this.categoriesScrollView.set_clip_to_allocation(true);
        this.categoriesScrollView.get_vscroll_bar().hide();

        this.categoriesApplicationsBox.actor.add(this.categoriesScrollView);

        this.applicationsBox = new St.BoxLayout({
            style_class: 'appmenu-applications-box',
            vertical:true
        });
        this.applicationsScrollView = new St.ScrollView({ style_class: 'vfade appmenu-applications-scrollview'});
        this.applicationsScrollView.add_actor(this.applicationsBox);
        this.applicationsScrollView.set_policy(St.PolicyType.NEVER, St.PolicyType.AUTOMATIC);
        this.applicationsScrollView.set_clip_to_allocation(true);

        let vscroll = this.applicationsScrollView.get_vscroll_bar();
        vscroll.connect('scroll-start', () => {
            this.menu.passEvents = true;
        });
        vscroll.connect('scroll-stop', () => {
            this.menu.passEvents = false;
        });

        let vscrollCat = this.categoriesScrollView.get_vscroll_bar();
        vscrollCat.connect('scroll-start', () => {
            this.menu.passEvents = true;
        });
        vscrollCat.connect('scroll-stop', () => {
            this.menu.passEvents = false;
        });

        this.categoriesApplicationsBox.actor.add(this.applicationsScrollView, {span: -1, expand: true});

        this.systemBox = new St.BoxLayout({
            style_class: 'appmenu-system-box',
            y_expand: false,
            x_expand: false,
            x_align: Clutter.ActorAlign.CENTER
        });

        this.searchSeparator = new PopupMenu.PopupSeparatorMenuItem().actor;

        this.searchBox.add(this.searchEntry, {
            x_align: St.Align.START,
            y_align: St.Align.MIDDLE,
            expand: true,
        });

        this._layout();

        this.appBoxIter = new VisibleChildIterator(this.applicationsBox);
        this.applicationsBox._vis_iter = this.appBoxIter;
        this.catBoxIter = new VisibleChildIterator(this.categoriesBox);
        this.categoriesBox._vis_iter = this.catBoxIter;
        this.placesBoxIter = new VisibleChildIterator(this.placesBox);
        this.placesBox._vis_iter = this.placesBoxIter;
        this.favBoxIter = new VisibleChildIterator(this.favoriteAppsBox);
        this.favoriteAppsBox._vis_iter = this.favBoxIter;
        this.sysBoxIter = new VisibleChildIterator(this.systemBox);
        this.systemBox._vis_iter = this.sysBoxIter;

        this.updateNavigation();

        Mainloop.idle_add(() => {
            this._clearAllSelections();
            this._hideAllAppActors();
        });

        this.a11y_settings = new Gio.Settings({ schema_id: "org.cinnamon.desktop.a11y.applications" });
        this.a11y_settings.connect("changed::screen-magnifier-enabled", this._updateVFade.bind(this));
        this.a11y_mag_settings = new Gio.Settings({ schema_id: "org.cinnamon.desktop.a11y.magnifier" });
        this.a11y_mag_settings.connect("changed::mag-factor", this._updateVFade.bind(this));
        this._updateVFade();

        this.settings.bind("enable-autoscroll", "autoscroll_enabled", this._update_autoscroll);
        this._update_autoscroll();

        this._sidebarToggle();
        this._avatarToggle();
    }

    updateNavigation() {
        this.placesBoxIter.left = this.sysBoxIter;
        this.placesBoxIter.right = this.catBoxIter;
        this.placesBoxIter.up = this.favBoxIter;
        this.placesBoxIter.down = this.favBoxIter;
        this.favBoxIter.left = this.sysBoxIter;
        this.favBoxIter.right = this.catBoxIter;
        this.favBoxIter.up = null;
        this.favBoxIter.down = null;
        this.catBoxIter.right = this.appBoxIter;
        this.catBoxIter.left = this.sysBoxIter;
        this.appBoxIter.left = this.catBoxIter;
        this.appBoxIter.right = this.sysBoxIter;
        this.sysBoxIter.left = this.appBoxIter;
        this.sysBoxIter.right = this.catBoxIter;
        if (this.showSidebar) {
            if (this._placesButtons.length > 0) {
                this.favBoxIter.up = this.placesBoxIter;
                this.favBoxIter.down = this.placesBoxIter;
                this.catBoxIter.left = this.placesBoxIter;
                this.sysBoxIter.right = this.placesBoxIter;
            }
            else {
                this.catBoxIter.left = this.favBoxIter;
                this.sysBoxIter.right = this.favBoxIter;
            }
        }
    }

    _updateVFade() {
        let mag_on = this.a11y_settings.get_boolean("screen-magnifier-enabled") &&
                     this.a11y_mag_settings.get_double("mag-factor") > 1.0;
        if (mag_on) {
            this.applicationsScrollView.style_class = "appmenu-applications-scrollbox";
        } else {
            this.applicationsScrollView.style_class = "vfade appmenu-applications-scrollbox";
        }
    }

    _update_autoscroll() {
        this.applicationsScrollView.set_auto_scrolling(this.autoscroll_enabled);
        this.categoriesScrollView.set_auto_scrolling(this.autoscroll_enabled);
        this.sidebarScrollView.set_auto_scrolling(this.autoscroll_enabled);
    }

    _hideAllAppActors() {
        this.applicationsBox.get_children().forEach(actor => {
            actor.hide();
        });
    }

    _clearAllSelections() {
        this.applicationsBox.get_children().forEach(actor => {
            actor.style_class = "appmenu-application-button";
        });
        this.categoriesBox.get_children().forEach(actor => {
            actor.remove_style_pseudo_class("hover")
            actor.style_class = "appmenu-category-button";
            actor.show();
        });
        this.placesBox.get_children().forEach(actor => {
            actor.remove_style_pseudo_class("hover");
            actor.show();
        });
        this.favoriteAppsBox.get_children().forEach(actor => {
            actor.remove_style_pseudo_class("hover");
            actor.show();
        });
        this.systemBox.get_children().forEach(actor => {
            actor.remove_style_pseudo_class("hover");
            actor.show();
        });
    }

    _resetSortOrder() {
        let pos = 0;

        for (let i = 0; i < this._applicationsButtons.length; i++) {
            this.applicationsBox.set_child_at_index(this._applicationsButtons[i].actor, pos++);
        }

        for (let i = 0; i < this._favoriteDocButtons.length; i++) {
            this.applicationsBox.set_child_at_index(this._favoriteDocButtons[i].actor, pos++);
        }

        for (let i = 0; i < this._recentButtons.length; i++) {
            this.applicationsBox.set_child_at_index(this._recentButtons[i].actor, pos++);
        }
    }

    _select_category (name = null) {
        if (name === this.lastSelectedCategory){
            return;
        }
        this.lastSelectedCategory = name;
        this._displayButtons(name || 'app');
        this.closeContextMenu(false);
        this._scrollToButton(null);
    }

    closeContextMenu(animate) {
        if (!this.contextMenu || !this.contextMenu.isOpen)
            return;

        if (animate)
            this.contextMenu.toggle();
        else
            this.contextMenu.close();
    }

    /**
     * Reset the ApplicationsBox to a specific category or list of buttons.
     * @param {String} category     (optional) The button type or application category to be displayed.
     * @param {Array} buttons       (optional) A list of existing buttons to show.
     * @param {Array} autoCompletes (optional) A list of autocomplete strings to add buttons for and show.
     */
    _displayButtons(category, buttons=[], autoCompletes=[]){
        /* We only operate on SimpleMenuItems here. If any other menu item types
         * are added, they should be managed independently. */
        if (category) {
            if (this.orderDirty) {
                this._resetSortOrder();
                this.orderDirty = false;
            }

            this.applicationsBox.get_children().forEach( c => {
                let b = c._delegate;
                if (!(b instanceof SimpleMenuItem))
                    return;

                // destroy temporary buttons
                if (b.type === 'transient' || b.type === 'search-provider') {
                    b.destroy();
                    return;
                }

                c.visible = b.type.includes(category) || b.type === 'app' && b.category.includes(category);
            });
        } else {
            this.orderDirty = true;

            this.applicationsBox.get_children().forEach( c => {
                let b = c._delegate;
                if (!(b instanceof SimpleMenuItem))
                    return;

                // destroy temporary buttons
                if (b.type === 'transient' || b.type === 'search-provider' || b.type === 'search-result') {
                    b.destroy();
                    return;
                }

                c.visible = false;
            });

            buttons.sort((ba, bb) => {
                if (ba.matchIndex < bb.matchIndex) {
                    return -1;
                } else
                if (bb.matchIndex < ba.matchIndex) {
                    return 1;
                }

                return ba.name.localeCompare(bb.name);
            });

            for (let i = 0; i < buttons.length; i++) {
                this.applicationsBox.set_child_at_index(buttons[i].actor, i);
                buttons[i].actor.visible = true;
            }
        }

        // reset temporary button storage
        this._transientButtons = [];
        this._searchProviderButtons = [];

        if (autoCompletes) {
            autoCompletes.forEach( item => {
                let button = new TransientButton(this, item);
                this._transientButtons.push(button);
                this.applicationsBox.add_actor(button.actor);
            });
        }
    }

    _setCategoriesButtonActive(active) {
        try {
            let categoriesButtons = this.categoriesBox.get_children();
            for (var i in categoriesButtons) {
                let button = categoriesButtons[i];
                let icon = button._delegate.icon;
                if (active){
                    button.set_style_class_name("appmenu-category-button");
                    if (icon) {
                        icon.set_opacity(255);
                    }
                } else {
                    button.set_style_class_name("appmenu-category-button-greyed");
                    if (icon) {
                        let icon_opacity = icon.get_theme_node().get_double('opacity');
                        icon_opacity = Math.min(Math.max(0, icon_opacity), 1);
                        if (icon_opacity) // Don't set opacity to 0 if not defined
                            icon.set_opacity(icon_opacity * 255);
                    }
                }
            }
        } catch (e) {
            global.log(e);
        }
    }

    resetSearch(){
        this.searchEntry.set_text("");
    }

    _onSearchTextChanged (se, prop) {
        let searchString = this.searchEntry.get_text().trim();
        let searchActive = !(searchString == '');
        if (!this.searchActive && !searchActive)
            return;

        if (searchString == this._previousSearchPattern)
            return;
        this._previousSearchPattern = searchString;

        this.searchActive = searchActive;
        this._clearAllSelections();

        if (searchActive) {
            this.searchEntry.set_secondary_icon(this._searchActiveIcon);
            if (!this._searchIconClickedId) {
                this._searchIconClickedId =
                    this.searchEntry.connect('secondary-icon-clicked', () => {
                        this.resetSearch();
                        this._select_category();
                    });
            }
            this._setCategoriesButtonActive(false);
            this.lastSelectedCategory = "search"

            this._doSearch(searchString);
        } else {
            if (this._searchIconClickedId > 0)
                this.searchEntry.disconnect(this._searchIconClickedId);
            this._searchIconClickedId = 0;
            this.searchEntry.set_secondary_icon(this._searchInactiveIcon);
            this._previousSearchPattern = "";
            this._setCategoriesButtonActive(true);
            this._select_category();
            this._allAppsCategoryButton.actor.style_class = "appmenu-category-button-selected";
            this._activeContainer = null;
        }
    }

    _matchNames(buttons, pattern){
        let ret = [];
        let regexpPattern = new RegExp(Util.escapeRegExp(pattern));

        for (let button of buttons) {
            if (button.type == "recent-clear" || button.type == "no-recent" || button.type == "no-favorites") {
                continue;
            }
            let res = button.searchStrings[0].match(regexpPattern);
            if (res) {
                button.matchIndex = res.index;
                ret.push(button);
            } else {
                button.matchIndex = NO_MATCH;
            }
        }

        return ret;
    }

    _listApplications(pattern){
        if (!pattern)
            return [];

        let apps = [];
        let regexpPattern = new RegExp(Util.escapeRegExp(pattern));

        for (let button of this._applicationsButtons) {
            for (let i = 0; i < button.searchStrings.length; i++) {
                let res = button.searchStrings[i].match(regexpPattern);
                if (res) {
                    button.matchIndex = res.index + MATCH_ADDERS[i];
                    apps.push(button);
                    break;
                } else {
                    button.matchIndex = NO_MATCH;
                }
            }
        }

        return apps;
    }

    _doSearch(rawPattern){
        let lowerPattern = AppUtils.decomp_unstripped(rawPattern);
        let pattern = AppUtils.decomp_stripped(rawPattern);

        this._searchTimeoutId = 0;
        this._activeContainer = null;
        this._activeActor = null;
        this.hoveredCategory = null;

        var acResultButtons = []; // search box autocompletion results
        var buttons = []

        buttons = this._listApplications(pattern);

        let result = this._matchNames(this._favoriteDocButtons, pattern);
        buttons = [...buttons, ...result];

        result = this._matchNames(this._recentButtons, pattern);
        buttons = [...buttons, ...result];

        this._displayButtons(null, buttons, acResultButtons);

        if (buttons.length || acResultButtons.length) {
            this.appBoxIter.reloadVisible();
            this._activeActor = this.appBoxIter.first();
            this._activeContainer = this.applicationsBox;
            this._scrollToButton(this._activeActor._delegate);
            this._buttonEnterEvent(this._activeActor._delegate);
        }

        SearchProviderManager.launch_all(lowerPattern, (provider, results) => {
            try {
                for (let result of results) {
                    if (result.type != 'software') {
                        let button = new SearchProviderResultButton(this, provider, result);
                        this._searchProviderButtons.push(button);
                        this.applicationsBox.add_actor(button.actor);
                        if (this._activeActor === null) {
                            this.appBoxIter.reloadVisible();
                            this._activeActor = this.appBoxIter.first();
                            this._activeContainer = this.applicationsBox;
                            if (this._activeActor && this._activeActor != this.searchEntry) {
                                this._buttonEnterEvent(this._activeActor._delegate);
                            }
                        }
                    }
                }
            } catch(e) {
                global.log(e);
            }
        });

        return false;
    }
};

function main(metadata, orientation, panel_height, instance_id) {
    return _superMenuCreate(CinnamonMenuApplet, metadata, orientation, panel_height, instance_id);
}


/*
 * SuperMenu panel/menu integration
 * Copyright (C) 2026 rasmarc
 * SPDX-License-Identifier: GPL-2.0-or-later
 *
 * This factory is appended to the bundled menu template by install.py.
 * The native program, search and session actions are inherited. Their layout
 * and the panel controls are adapted here, without a second applet instance.
 */

function _superMenuSelectionBackground(color) {
    // Opaque accent paint must not blend into or sit below theme artwork.
    return " background-image: none; background-gradient-direction: none;" +
        " border-image: none; background-color: rgb(" +
        [color.red, color.green, color.blue].join(", ") + ");";
}

const PM_St = imports.gi.St;
const PM_Clutter = imports.gi.Clutter;
const PM_Atk = imports.gi.Atk;
const PM_Gio = imports.gi.Gio;
const PM_GLib = imports.gi.GLib;
const PM_Gtk = imports.gi.Gtk;
const PM_GdkPixbuf = imports.gi.GdkPixbuf;
const PM_Pango = imports.gi.Pango;
const PM_ByteArray = imports.byteArray;
const PM_Mainloop = imports.mainloop;
const PM_Main = imports.ui.main;
const PM_AppletManager = imports.ui.appletManager;
const PM_Extension = imports.ui.extension;
const PM_StandardMenuUuid = "menu@cinnamon.org";
const PM_PopupMenu = imports.ui.popupMenu;
const PM_BoxPointer = imports.ui.boxpointer;
const PM_Tooltips = imports.ui.tooltips;

function _superMenuPopover(source, applet, borderColor = null) {
    // Keep Cinnamon's menu manager and keyboard handling.
    // Its current PopupMenu has no arrow; BoxPointer supplies that native frame.
    const menu = new PM_PopupMenu.PopupMenu(source, PM_St.Side.TOP);
    menu.setCustomStyleClass("pm-popover-root");
    const pointer = new PM_BoxPointer.BoxPointer(PM_St.Side.TOP, { x_fill: true, y_fill: true });
    menu.actor.remove_child(menu._boxWrapper);
    pointer.bin.set_child(menu._boxWrapper);
    menu.actor.set_child(pointer);
    pointer.add_style_class_name("pm-system-popover");
    pointer.setArrowActor(source);
    menu._pmAnchorX = null;
    const syncArrow = () => {
        if (!Number.isFinite(menu._pmAnchorX)) return;
        const [px] = pointer.get_transformed_position();
        const [width] = pointer.get_transformed_size();
        const node = pointer.get_theme_node();
        const inset = Math.min(width / 2, node.get_length("-arrow-border-width") / 2 +
            node.get_length("-arrow-border-radius") + node.get_length("-arrow-base") / 2);
        pointer.setArrowOrigin(Math.max(inset, Math.min(width - inset, menu._pmAnchorX - px)));
    };
    // Account for the frame's actual allocation, including theme insets.
    pointer.connect("notify::allocation", syncArrow);
    menu.actor.connect("notify::allocation", syncArrow);
    pointer.open(PM_BoxPointer.PopupAnimation.NONE);
    menu.box.set_style("border-width: 0; box-shadow: none;");
    const syncColors = () => {
        const node = menu.box.get_theme_node();
        // The content can be transparent; the parent menu owns the visible fill.
        const parentNode = applet.menu.actor.get_theme_node();
        const background = node.get_background_color();
        const border = borderColor ? borderColor() : parentNode.get_border_color(PM_St.Side.TOP);
        const rgba = color => `rgba(${color.red},${color.green},${color.blue},${color.alpha / 255})`;
        const style = `-arrow-background-color: ${rgba(background.alpha ? background : parentNode.get_background_color())}; ` +
            `-arrow-border-color: ${rgba(border)};`;
        if (pointer.style !== style) pointer.set_style(style);
    };
    menu.box.connect("style-changed", syncColors);
    syncColors();
    menu._calculatePosition = () => {
        menu.box.show();
        const monitor = PM_Main.layoutManager.findMonitorForActor(source);
        const workspace = global.workspace_manager ? global.workspace_manager.get_active_workspace() :
            global.screen.get_active_workspace();
        const area = workspace.get_work_area_for_monitor(monitor.index);
        const [sx, sy] = source.get_transformed_position();
        const [sw, sh] = source.get_transformed_size();
        const [, , width, height] = menu.actor.get_preferred_size();
        const gap = 4 * Math.max(1, Number(global.ui_scale) || 1);
        const above = sy - gap - area.y;
        const below = area.y + area.height - sy - sh - gap;
        let onTop = applet._pmSearchPosition !== "top";
        if ((onTop ? above : below) < height && (onTop ? below : above) > (onTop ? above : below))
            onTop = !onTop;
        const side = onTop ? PM_St.Side.BOTTOM : PM_St.Side.TOP;
        if (pointer.arrowSide !== side) pointer.updateArrowSide(side);
        if (menu._orientation !== side) menu.setOrientation(side);
        menu.sideFlipped = onTop;
        const anchored = Number.isFinite(menu._pmAnchorX);
        pointer.setArrowActor(anchored ? null : source);
        const center = anchored ? menu._pmAnchorX : sx + sw / 2;
        const x = Math.max(area.x, Math.min(area.x + area.width - width, center - width / 2));
        const y = onTop ? sy - gap - height : sy + sh + gap;
        return [Math.round(x), Math.round(Math.max(area.y, Math.min(area.y + area.height - height, y)))];
    };
    return menu;
}

function _superMenuSessionButton(ButtonClass, applet, action, iconName, name, description) {
    const button = new ButtonClass(applet, iconName, name, description);
    button.actor._pmSessionAction = action;
    return button;
}

function _superMenuSessionGlyph(icon, action, applet) {
    const names = { "lock-screen": "system-lock-screen-symbolic.svg",
        "log-out": "system-log-out-symbolic.svg", "shutdown": "system-shutdown-symbolic.svg" };
    icon.set_gicon(new PM_Gio.FileIcon({
        file: PM_Gio.file_new_for_path(applet._pmSourcePath + "/" + names[action])
    }));
    icon.set_icon_type(PM_St.IconType.SYMBOLIC);
}

function _superMenuEdgeDelta(x, y, bounds, scale, panelHeight) {
    const [left, top, width, height] = bounds;
    if (width <= 0 || height <= 0 || x < left || x > left + width) return 0;
    const distance = Math.max(1, Number(panelHeight) || 40 * scale);
    let direction = 0, depth = 0;
    if (y < top) {
        direction = -1; depth = (top - y) / distance;
    } else if (y > top + height) {
        direction = 1; depth = (y - top - height) / distance;
    }
    // Start outside the visible list. One physical panel height of travel
    // reaches the approved maximum, equally above and below the viewport.
    const progress = Math.max(0, Math.min(1, depth));
    const curve = Math.log1p(4 * progress) / Math.log(5);
    return direction * (1 + 25 * curve) * scale;
}

function _superMenuNaturalHeight(actor, width = -1) {
    return actor && actor.visible ? actor.get_preferred_height(width)[1] : 0;
}

function _superMenuTextTooltip(item) {
    if (!item || !item.actor || !item.label) return null;
    if (item._pmNameTooltip) return item._pmNameTooltip;
    const actor = item.actor;
    // Passive messages and insensitive actions still need a hover target.
    // Their text never activates the surrounding disabled menu item.
    const owner = actor.reactive ? actor : item.label;
    if (owner !== actor) owner.reactive = true;
    const tooltip = new PM_Tooltips.Tooltip(owner, "");
    if (owner !== actor) {
        for (const signal of ["button-press-event", "button-release-event"])
            owner.connect(signal, () => actor.reactive ? PM_Clutter.EVENT_PROPAGATE : PM_Clutter.EVENT_STOP);
    }
    const show = tooltip.show;
    tooltip.show = () => {
        if (actor.is_finalized() || !actor.is_mapped()) return;
        const labels = [item.label, item.descriptionLabel].filter(label => label && !label.is_finalized());
        if (item.label.visible && !labels.some(label => label.visible &&
            label.clutter_text.get_layout().is_ellipsized())) return;
        tooltip.set_text(labels.filter(label => label === item.label || label.visible)
            .map(label => label.get_text()).filter(Boolean).join("\n"));
        show.call(tooltip);
    };
    item._pmNameTooltip = tooltip;
    return tooltip;
}

function _superMenuContextTooltips(menu) {
    for (const item of menu._getMenuItems()) {
        _superMenuTextTooltip(item);
        if (item.menu) _superMenuContextTooltips(item.menu);
    }
}

function _superMenuVerticalChrome(actor) {
    const node = actor.get_theme_node();
    return node.get_vertical_padding() + node.get_border_width(PM_St.Side.TOP) +
        node.get_border_width(PM_St.Side.BOTTOM) + node.get_margin(PM_St.Side.TOP) +
        node.get_margin(PM_St.Side.BOTTOM);
}

function _superMenuSpacing(actor) {
    return actor.get_theme_node().get_length("spacing");
}

function _superMenuCreate(NativeMenu, metadata, orientation, panelHeight, instanceId) {
    class SuperMenuApplet extends NativeMenu {
        constructor() {
            super(orientation, panelHeight, instanceId);

            this.searchFilesystem = false;
            this._pmFallbackHeight = panelHeight;
            this._pmDisposed = false;
            this._pmReady = false;
            this._pmHoverTimer = 0;
            this._pmPersonalFeedbackTimer = 0;
            this._pmPersonalFeedbackStyle = "";
            this._pmAutoScrollTimer = 0;
            this._pmSb = false;
            this._pmScrollView = null;
            this._pmIconAllocationSignal = 0;
            this._pmDebugVersion = "1.0.8-pre56";
            this._pmSourcePath = metadata.path;
            this._pmSearchStyle = this.searchBox ? this.searchBox.style || "" : "";
            this._pmContextRequests = 0;
            this._pmPersonalActive = false;
            this._pmPersonal = null;

            // Keep the native tooltip object alive for the inherited drag hooks.
            // Its empty text prevents a tooltip on the surrounding free space.
            this.set_applet_tooltip("");
            this._applet_tooltip.preventShow = true;

            this.actor.remove_style_class_name("applet-box");
            this.actor.add_style_class_name("pm-container");
            this.actor.set_style("padding: 0px; margin: 0px; spacing: 0px;");

            this._pmPrimary = this._pmMakeButton("pm-primary", _("All programs"));
            this._pmSecondary = this._pmMakeButton("pm-secondary", _("Custom menu"));
            this._pmInnerGap = new PM_St.Bin({ reactive: true, can_focus: false });
            this._pmOuterGap = new PM_St.Bin({ reactive: true, can_focus: false });

            // Reuse the native icon box, including the native icon-size hooks.
            this.actor.remove_child(this._applet_icon_box);
            this._pmPrimary.add_child(this._applet_icon_box);
            if (this._layoutBin) {
                this.actor.remove_child(this._layoutBin);
                this._layoutBin.hide();
            }

            this._pmSecondaryIcon = new PM_St.Icon({ reactive: false, style_class: "applet-icon" });
            this._pmSecondary.add_child(this._pmSecondaryIcon);
            for (const child of [this._pmPrimary, this._pmInnerGap, this._pmSecondary, this._pmOuterGap])
                this.actor.add(child, { x_fill: true, y_fill: true });

            // Register the real button as the menu source. This keeps outside
            // clicks, focus restoration and popup positioning out of the gaps.
            this.menuManager.removeMenu(this.menu);
            this.menu.sourceActor = this._pmPrimary;
            this.menuManager = new PM_PopupMenu.PopupMenuManager(this);
            this.menuManager.addMenu(this.menu);
            this._pmNativeMenuPosition = this.menu._calculatePosition;
            if (typeof this._pmNativeMenuPosition === "function")
                this.menu._calculatePosition = (...args) => this._pmCalculateMenuPosition(args);

            this._pmPrimaryTooltip = new PM_Tooltips.PanelItemTooltip(
                { actor: this._pmPrimary, _applet: this }, _("All programs"), orientation);
            this._pmSecondaryTooltip = new PM_Tooltips.PanelItemTooltip(
                { actor: this._pmSecondary, _applet: this },
                _("Custom menu"), orientation);

            this._pmPrimary.connect("button-press-event", (actor, event) => this._pmPress(true, event));
            this._pmSecondary.connect("button-press-event", (actor, event) => this._pmPress(false, event));
            for (const gap of [this._pmInnerGap, this._pmOuterGap]) {
                gap.connect("button-press-event", (actor, event) => this._pmGapPress(event));
            }
            this._pmPrimary.connect("key-press-event", (actor, event) => this._pmKey(true, event));
            this._pmSecondary.connect("key-press-event", (actor, event) => this._pmKey(false, event));
            this._pmPrimary.connect("enter-event", () => this._pmEnter());
            this._pmPrimary.connect("leave-event", () => this._clearDelayCallbacks());
            this._pmSecondary.connect("enter-event", () => this._pmEnter(true));
            this._pmSecondary.connect("leave-event", () => this._clearDelayCallbacks());

            this.settings.bind("pm-personal-enabled", "_pmPersonalEnabled", this._pmPersonalEnabledChanged);
            this.settings.bind("pm-spacing-percent", "_pmSpacingPercent", this._pmUpdateLayout);
            this.settings.bind("pm-spacing-side", "_pmSpacingSide", this._pmUpdateLayout);
            this.settings.bind("pm-primary-style", "_pmPrimaryStyle", this._updateIconAndLabel);
            this.settings.bind("pm-primary-icon", "_pmPrimaryCustomIcon", this._updateIconAndLabel);
            this.settings.bind("pm-secondary-style", "_pmSecondaryStyle", this._pmUpdateSecondary);
            this.settings.bind("pm-secondary-icon", "_pmSecondaryCustomIcon", this._pmUpdateSecondary);
            this.settings.bind("pm-search-position", "_pmSearchPosition", this._layout);
            this.settings.bind("pm-program-layout", "_pmProgramLayout", this._pmMenuLayoutChanged);
            this.settings.bind("pm-program-drawer-mode", "_pmProgramDrawerMode", this._pmMenuLayoutChanged);
            this.settings.bind("pm-personal-layout", "_pmPersonalView", this._pmPersonalListChanged);
            this.settings.bind("pm-personal-drawer-mode", "_pmPersonalDrawerMode", this._pmPersonalDrawersChanged);
            this.settings.bind("pm-personal-full-drawer", "_pmPersonalFullDrawer", () => {
                if (this._pmReady && this._pmPersonalActive) this._pmFitMenuHeight();
            });
            this.settings.bind("pm-personal-list-icons-only", "_pmPersonalListIconsOnly", this._pmPersonalListChanged);
            this.settings.bind("pm-personal-grid-icons-only", "_pmPersonalGridIconsOnly", this._pmPersonalListChanged);
            this.settings.bind("pm-personal-grid-columns", "_pmPersonalGridColumns", this._pmPersonalListChanged);
            this.settings.bind("pm-personal-grid-width", "_pmPersonalGridWidth", this._pmGridWidthChanged);
            this.settings.bind("pm-personal-list-sort", "_pmPersonalListSort", this._pmPersonalListChanged);
            this.settings.bind("pm-personal-grid-sort", "_pmPersonalGridSort", this._pmPersonalListChanged);
            this.settings.bind("pm-editor-block-execution", "_pmEditorBlockExecution");
            this.settings.bind("pm-editor-hint", "_pmEditorHint", () => {
                if (!this._pmEditorHint && this._pmEditor) this._pmEditor.hideFrameHint();
            });
            this.settings.bind("pm-editor-hint-blink", "_pmEditorHintBlink", () => {
                if (!this._pmEditorHintBlink && this._pmEditor) this._pmEditor.stopFrameHintBlink();
            });
            this.settings.bind("pm-editor-hint-hide-on-actions", "_pmEditorHintHideOnActions");
            this.settings.bind("pm-personal-recent", "_pmPersonalRecent", () => {
                if (this._pmReady && this._pmPersonalActive && this._pmDrawer)
                    this._pmDrawer.refreshPrograms(true);
                if (this._pmEditor) this._pmEditor.publishCategories();
            });
            this.settings.bind("pm-personal-default-category", "_pmPersonalDefaultCategory");
            this.settings.bind("pm-personal-recent-visible-limit", "_pmPersonalRecentVisibleLimit", () => this._pmFitMenuHeight());
            this.settings.bind("pm-personal-places", "_pmPersonalPlaces", this._pmPlacesChanged);
            for (const name of ["Home", "Desktop", "Documents", _("Downloads"), "Music", "Pictures", _("Videos"), "Bookmarks"])
                this.settings.bind("pm-place-" + name.toLowerCase(), "_pmPlace" + name, this._pmPlacesChanged);
            this.settings.bind("pm-personal-centered", "_pmPersonalCentered", () => {
                if (this.menu.isOpen) this.menu.actor.queue_relayout();
            });
            this.settings.bind("pm-show-lock", "_pmShowLock", this._pmConfigureSessionButtons);
            this.settings.bind("pm-show-logout", "_pmShowLogout", this._pmConfigureSessionButtons);
            this.settings.bind("pm-show-shutdown", "_pmShowShutdown", this._pmConfigureSessionButtons);
            this.settings.bind("pm-shutdown-red", "_pmShutdownRed", this._pmConfigureSessionButtons);
            this.settings.bind("pm-flat-system-buttons", "_pmFlatSystemButtons", this._pmConfigureSessionButtons);
            this.settings.bind("pm-group-system-buttons", "_pmGroupSystemButtons", this._pmConfigureSessionButtons);
            this.settings.bind("pm-program-follow-panel-icon-size", "_pmProgramFollowPanelIconSize", () => this._pmUpdateMenuIcons());
            this.settings.bind("pm-program-icon-size", "_pmProgramIconSize", () => this._pmUpdateMenuIcons());
            this.settings.bind("pm-personal-follow-panel-icon-size", "_pmPersonalFollowPanelIconSize", () => this._pmUpdateMenuIcons());
            this.settings.bind("pm-personal-icon-size", "_pmPersonalIconSize", () => this._pmUpdateMenuIcons());
            // The inherited property writes straight back to the JSON setting.
            // Release it before using it as a view-dependent display flag.
            this.settings.unbind("show-description");
            this.settings.bind("show-description", "_pmShowDescription", this._pmDescriptionChanged);
            this.settings.bind("pm-personal-menu-shortcut", "_pmPersonalMenuShortcut", this._pmUpdatePersonalKeybinding);
            this._pmWatchPersonalKeybinding();
            this._pmReady = true;
            this._pmAttachCategoryContext();
            this._pmPersonalKeySignal = this.menu.actor.connect("key-press-event", (actor, event) => {
                if (this._pmPersonalActive && global.stage.get_key_focus() === this.menu.actor)
                    return this._pmDrawer.handleSearchKey(event);
                return PM_Clutter.EVENT_PROPAGATE;
            });
            this._pmUpdateLayout();
            this._updateIconAndLabel();
            this._pmUpdateSecondary();
            this._layout();
            this._pmConfigureSessionButtons();
            this._pmUpdateMenuIcons();
            this._pmDescriptionChanged();
            this._update_autoscroll();
            this._setAppletReactivity();
            this._pmEditor = new PM_MenuEditor(this);
            this._pmEditor.syncAppletContext();
            this.settings.bind("pm-editor-shortcut", "_pmEditorShortcut", this._pmUpdateEditorKeybinding);
            this.settings.bind("pm-extended-context-menu", "_pmExtendedContextMenu", () => {
                if (this._pmEditor) this._pmEditor.closeModeMenu();
            });
            this._pmUpdateEditorKeybinding();
            this._pmWatchPanelIconPreview();

            this._pmScaleSignal = global.connect("scale-changed", () => {
                this._pmUpdateLayout();
                this._updateIconAndLabel();
                this._pmUpdateSecondary();
                this._pmUpdateMenuIcons();
                this._pmFitMenuHeight();
            });
            this._pmThemeSignal = this.main_container && this.main_container.connect(
                "style-changed", () => {
                    if (this._pmDrawer) this._pmDrawer.invalidateWidth();
                    this._pmFitMenuHeight();
                });
            this._pmWorkAreaSignal = global.display && global.display.connect(
                "workareas-changed", () => this._pmFitMenuHeight());
        }

        _display() {
            // Keep the unused native panes out of the simplified menu during
            // construction as well as during native settings refreshes.
            this.showFavorites = false;
            this.showPlaces = false;
            this.favBoxShow = false;
            this.showSidebar = false;
            this.showAvatar = false;
            this.showRecents = false;
            this.symbolicCategoryIcons = false;
            super._display();
            this.main_container.add_style_class_name("pm-menu-content");
            this.right_box.add_style_class_name("pm-menu-column");
            if (this.left_box) this.left_box.hide();
            if (this.sidebar) this.sidebar.hide();
            this._layout();
        }

        _pmIsDrawerView() {
            return this._pmReady && (this._pmPersonalActive || this._pmAllProgramsTable !== true);
        }

        _pmIsPersonalList() {
            return this._pmPersonalActive === true && this._pmPersonalList === true;
        }

        get _pmPersonalList() {
            return ["list", "grid"].includes(this._pmPersonalView);
        }

        get _pmPersonalOpenAll() {
            return this._pmPersonalView === "drawers" && this._pmPersonalDrawerMode === "all";
        }

        get _pmPersonalSingle() { return this._pmPersonalDrawerMode === "single"; }
        get _pmAllProgramsSingle() { return this._pmProgramDrawerMode === "single"; }
        get _pmAllProgramsTable() { return this._pmProgramLayout === "table"; }
        get _pmPersonalSort() {
            return this._pmPersonalView === "grid" ? this._pmPersonalGridSort :
                this._pmPersonalView === "list" ? this._pmPersonalListSort : "categories";
        }
        get _pmPersonalIconsOnly() {
            return !this._pmIsEditing() && this._pmPersonalIconsOnlyConfigured;
        }
        get _pmPersonalIconsOnlyConfigured() {
            return this._pmPersonalView === "grid" ? this._pmPersonalGridIconsOnly === true :
                this._pmPersonalView === "list" ? this._pmPersonalListIconsOnly === true : false;
        }

        _pmIsPersonalGrid() {
            return this._pmPersonalActive === true && this._pmPersonalView === "grid";
        }

        _pmIsEditing() {
            return !!(this._pmEditor && this._pmEditor.enabled && this._pmPersonalActive);
        }

        _pmExecutionBlocked() {
            return this._pmIsEditing() && this._pmEditorBlockExecution === true;
        }

        _pmCalculateMenuPosition(args) {
            const menu = this.menu;
            if (this._pmGridWidthPending && this._pmIsPersonalGrid() && this._pmDrawer) {
                // PopupMenu measures before open-state-changed, also when it
                // opens without animation. Refit after revealing the content,
                // before that first preferred-size request and panel anchor.
                this._pmGridWidthPending = false;
                if (!menu.actor.visible && menu.box) menu.box.show();
                this._pmDrawer.invalidateWidth();
                this._pmFitMenuHeight();
                menu.actor.queue_relayout();
            }
            const previous = menu._slidePosition;
            try {
                if (this._pmPersonalActive && this._pmPersonalCentered !== true &&
                    [PM_St.Side.TOP, PM_St.Side.BOTTOM].includes(this._orientation)) {
                    if (!menu.actor.visible && menu.box) menu.box.show();
                    const [left] = this._pmSecondary.get_transformed_position();
                    const [, , width] = menu.actor.get_preferred_size();
                    // Cinnamon positions the popup by its center, then clamps
                    // it to the monitor/panels. Supply a center whose left
                    // edge is exactly the button's selection background.
                    const center = left + width / 2;
                    menu._slidePosition = center === -1 ? center + 1e-6 : center;
                }
                return this._pmNativeMenuPosition.apply(menu, args);
            } finally {
                menu._slidePosition = previous;
            }
        }

        _pmFocusMenu(force = false) {
            if (!this.menu.isOpen) return;
            if (this._pmIsEditing() && !force && !this._pmEditor.hasMenuFocus()) return;
            if (this._pmPersonalActive) {
                this.menu.actor.can_focus = true;
                if (this._pmIsEditing()) this._pmEditor.focusActor(this.menu.actor);
                else this.menu.actor.grab_key_focus();
            } else this.searchEntryText.grab_key_focus();
        }

        _pmPersonalListChanged() {
            if (!this._pmReady || !this._pmPersonalActive) return;
            this._pmFocusMenu();
            const drawer = this._pmDrawer;
            // Bound values already describe the new view. Do not measure old
            // list actors as grid tiles while closing the previous projection.
            if (drawer) drawer._rebuilding = true;
            try {
                if (drawer) drawer.closeAll(false);
                this._pmPersonal.activate(true, true);
            } finally {
                if (drawer) drawer._rebuilding = false;
            }
            this._pmFitMenuHeight();
        }

        _pmEnsureDrawerView() {
            if (!this._pmDrawer) this._pmDrawer = new PM_DrawerView(this);
        }

        _pmEnsurePersonalMenu() {
            if (!this._pmPersonal) this._pmPersonal = new PM_PersonalMenu(this);
            return this._pmPersonal;
        }

        _pmPersonalDrawersChanged() {
            if (!this._pmReady || !this._pmPersonalActive) return;
            if (this._pmDrawer) {
                this._pmDrawer.closeAll(false);
                this._pmDrawer.prepareOpen();
            }
            this._pmFitMenuHeight();
        }

        _pmPersonalEnabledChanged() {
            if (!this._pmReady || this._pmDisposed) return;
            this._clearDelayCallbacks();
            if (!this._pmPersonalEnabled) {
                this._pmClearPersonalFeedback();
                if (this._pmEditor) {
                    this._pmEditor.closeModeMenu();
                    this._pmEditor.setEnabled(false);
                    this._pmEditor.cancelOpen();
                    this._pmEditor.cancelDismiss();
                    this._pmEditor.cancelIconPicker();
                    this._pmEditor.cancelContentPicker();
                }
                if (this._pmDrawer) this._pmDrawer.closeApplicationContextMenu(false, true);
                if (typeof this.closeContextMenu === "function") this.closeContextMenu(false);
                this._applet_context_menu.close(false);
                if (this._pmPersonalActive) {
                    this.menu.close(false);
                    this._pmPersonal.activate(false);
                }
                const focus = global.stage.get_key_focus();
                if (focus && this._pmSecondary.contains(focus)) global.stage.set_key_focus(null);
            }
            this._pmUpdateLayout();
            this._setAppletReactivity();
            this._pmUpdatePersonalKeybinding();
            if (this._pmEditor) {
                this._pmUpdateEditorKeybinding();
                this._pmEditor.syncAppletContext();
            }
        }

        _pmToggleMenu(personal) {
            if (personal && !this._pmPersonalEnabled) return;
            this._clearDelayCallbacks();
            if (this._pmIsEditing()) {
                this._pmEditor.queueOpen();
                return;
            }
            const wasOpen = this.menu.isOpen;
            const sameMenu = this._pmPersonalActive === personal;
            if (wasOpen && sameMenu) {
                this.menu.toggle_with_options(this.enableAnimation);
                return;
            }
            if (wasOpen) this.menu.close(false);
            if (personal || this._pmPersonal)
                this._pmEnsurePersonalMenu().activate(personal);
            this.menu.sourceActor = personal ? this._pmSecondary : this._pmPrimary;
            this.menu.toggle_with_options(this.enableAnimation);
        }

        openMenu() {
            if (!this._pmReady) return super.openMenu();
            this._pmOpenMenu(false);
        }

        _pmOpenMenu(personal) {
            if (personal && !this._pmPersonalEnabled) return;
            if (this._applet_context_menu.isOpen) return;
            if (!this.menu.isOpen || this._pmPersonalActive !== personal) this._pmToggleMenu(personal);
        }

        _updateKeybinding() {
            if (!PM_Main.keybindingManager) return;
            PM_Main.keybindingManager.addXletHotKey(this, "overlay-key", this.overlayKey, () => {
                if (!PM_Main.overview.visible && !PM_Main.expo.visible && this._pmReady)
                    this._pmToggleMenu(false);
            });
        }

        _pmWatchPersonalKeybinding() {
            if (!PM_Main.keybindingManager) return;
            const signals = new SignalManager.SignalManager();
            this._pmShortcutSignals = signals;
            let standardSettings = [];
            const refresh = () => {
                for (const settings of standardSettings) signals.disconnect(null, settings);
                standardSettings = PM_AppletManager.filterDefinitionsByUUID(PM_StandardMenuUuid)
                    .map(({ applet }) => applet && applet.settings).filter(Boolean);
                for (const settings of standardSettings)
                    signals.connect(settings, "changed::overlay-key", () => this._pmUpdatePersonalKeybinding());
                this._pmUpdatePersonalKeybinding();
            };
            signals.connect(global.settings, "changed::enabled-applets", refresh);
            for (const name of ["extension-loaded", "extension-unloaded"]) {
                signals.connect(PM_Extension.Type.APPLET, name, (_type, uuid) => {
                    if (uuid === PM_StandardMenuUuid) refresh();
                });
            }
            refresh();
        }

        _pmUpdatePersonalKeybinding() {
            const manager = PM_Main.keybindingManager;
            if (!manager || !this._pmShortcutSignals || this._pmDisposed) return;
            const reserved = new Set();
            if (this._pmPersonalEnabled && this._pmPersonalMenuShortcut) {
                for (const definition of PM_AppletManager.filterDefinitionsByUUID(PM_StandardMenuUuid)) {
                    const settings = definition.applet && definition.applet.settings;
                    // Reserve the stock defaults while an enabled menu is still loading.
                    const value = settings ? settings.getValue("overlay-key") : "Super_L::Super_R";
                    for (const binding of String(value || "").split("::")) reserved.add(binding);
                }
            }
            const shortcut = this._pmPersonalEnabled ?
                String(this._pmPersonalMenuShortcut || "").split("::")
                    .filter(binding => binding && !reserved.has(binding)).join("::") : "";
            if (shortcut === this._pmEffectivePersonalShortcut) return;
            this._pmEffectivePersonalShortcut = shortcut;
            if (!shortcut) {
                manager.removeXletHotKey(this, "pm-personal-menu-shortcut");
                return;
            }
            manager.addXletHotKey(this, "pm-personal-menu-shortcut", shortcut, () => {
                if (!PM_Main.overview.visible && !PM_Main.expo.visible && this._pmReady && !this._pmDisposed)
                    this._pmToggleMenu(true);
            });
        }

        _pmUpdateEditorKeybinding() {
            if (!PM_Main.keybindingManager) return;
            if (!this._pmPersonalEnabled) {
                PM_Main.keybindingManager.removeXletHotKey(this, "pm-editor-shortcut");
                return;
            }
            PM_Main.keybindingManager.addXletHotKey(this, "pm-editor-shortcut", this._pmEditorShortcut, () => {
                if (!PM_Main.overview.visible && !PM_Main.expo.visible && this._pmReady && !this._pmDisposed)
                    this._pmEditor.setEnabled(!this._pmEditor.enabled, { keepOpen: true });
            });
        }

        _pmMenuLayoutChanged() {
            if (!this._pmReady || this._pmDisposed || this._pmPersonalActive) return;
            this._pmStopAutoScroll();
            if (this.contextMenu && this.contextMenu.isOpen) this.closeContextMenu(false);
            if (this._pmDrawer) this._pmDrawer.closeAll(false);
            this._activeContainer = null;
            this._activeActor = null;
            this._layout();
            this._pmUpdateMenuIcons(false);
            const query = this.searchEntry.get_text().trim();
            if (typeof RefreshFlags !== "undefined") this.queueRefresh(RefreshFlags.APP);
            if (this._pmIsDrawerView()) this._pmDrawer.applySearch(query, true);
            else if (query) this._doSearch(query);
            this._pmFocusMenu();
            this._pmFitMenuHeight();
            this._pmUpdateAutoScroll();
        }

        _setMenuSize(width, height) {
            if (!this._pmPersonalActive) super._setMenuSize(width, height);
            this._pmFitMenuHeight();
        }

        _pmGridWidthChanged() {
            this._pmGridWidthPending = true;
            if (!this._pmReady || this._pmDisposed || !this._pmIsPersonalGrid() || !this.menu.isOpen) return;
            // Editing already updates an open grid correctly. Closed menus
            // apply the new value before PopupMenu's first size calculation.
            this._pmFitMenuHeight();
            this._pmGridWidthPending = false;
        }

        _pmFitMenuHeight() {
            if (!this._pmReady || this._pmDisposed || !this.main_container || !this.right_box ||
                !this.categoriesApplicationsBox || this._pmFitting) return;
            this._pmFitting = true;
            try {
                const drawers = this._pmIsDrawerView();
                const maximum = this._pmAvailableHeight(this._pmPersonalActive || drawers && this._pmAllProgramsSingle === false ? 0.9 : drawers ? 0.8 : 1);
                // The editing bar sits above the unchanged content budget.
                const bar = this._pmEditor && this._pmEditor.frameBar;
                const outerMaximum = maximum + (bar && bar.visible ? _superMenuNaturalHeight(bar) : 0);
                const style = String(this.menu.actor.style || "").replace(/max-height\s*:[^;]+;?/g, "");
                const limitedStyle = drawers ? style.trim() + " max-height: " +
                    Math.floor(outerMaximum / global.ui_scale) + "px;" : style.trim();
                if (this.menu.actor.style !== limitedStyle) this.menu.actor.set_style(limitedStyle);
                if (drawers) {
                    this.main_container.set_width(-1);
                    this.main_container.natural_width_set = false;
                    if (this._pmDrawer) this._pmDrawer.fitHeight(maximum);
                } else {
                    if (Number.isFinite(this.popup_width) && this.popup_width > 0) {
                        this.main_container.natural_width = this.popup_width * global.ui_scale;
                        this.main_container.natural_width_set = true;
                    }
                    this._pmFitTableHeight();
                }
                this._pmApplyContentHeight();
            } finally {
                this._pmFitting = false;
            }
        }

        _pmAvailableHeight(fraction) {
            const monitor = PM_Main.layoutManager.findMonitorForActor(this._pmPrimary || this.actor);
            const workspace = global.workspace_manager ? global.workspace_manager.get_active_workspace() :
                global.screen.get_active_workspace();
            const area = workspace.get_work_area_for_monitor(monitor.index);
            return Math.floor(Math.min(monitor.height, area.height) * fraction);
        }

        _pmApplyContentHeight() {
            // Give the complete column a current numeric height. Child
            // preferred-size caches cannot keep the previous menu height.
            const rows = this.right_box.get_children().filter(actor => actor.visible);
            const content = rows.reduce((height, actor) => height +
                (this._pmDrawer && actor === this._pmDrawer.actor ?
                    this._pmDrawer.programHeight + _superMenuVerticalChrome(actor) :
                    actor === this.categoriesApplicationsBox.actor ? this._pmTableHeight :
                    _superMenuNaturalHeight(actor)), 0);
            const rightHeight = Math.ceil(content + Math.max(0, rows.length - 1) *
                _superMenuSpacing(this.right_box) + _superMenuVerticalChrome(this.right_box));
            this.right_box.set_height(rightHeight);
            this._pmContentHeight = rightHeight + _superMenuVerticalChrome(this.main_container);
            this.main_container.set_height(this._pmContentHeight);
        }

        _pmMenuChromeHeight() {
            let height = 0;
            for (let actor = this.right_box; actor; actor = actor.get_parent()) {
                height += _superMenuVerticalChrome(actor);
                if (actor === this.menu.actor) break;
            }
            return height;
        }

        _pmFitTableHeight() {
            if (!this.categoriesBox || !this.categoriesApplicationsBox) return;
            const actors = this.categoriesBox.get_children().filter(actor => !!actor._delegate);
            const iconHeight = (Number(this.categoryIconSize) || 24) * global.ui_scale;
            const rowHeight = actors.reduce((height, actor) => {
                const label = actor._delegate ? actor._delegate.labelContainer || actor._delegate.label : actor;
                return Math.max(height, Math.max(iconHeight, _superMenuNaturalHeight(label)) +
                    _superMenuVerticalChrome(actor));
            }, iconHeight);
            const columns = this.categoriesApplicationsBox.actor;
            const desired = actors.length * rowHeight + Math.max(0, actors.length - 1) *
                _superMenuSpacing(this.categoriesBox) + _superMenuVerticalChrome(this.categoriesBox) +
                _superMenuVerticalChrome(this.categoriesScrollView) + _superMenuVerticalChrome(columns);
            this._pmTableHeight = Math.max(1, Math.ceil(desired));
            // Programs and search results do not participate in table sizing.
            // Every category fits; only the application column may scroll.
            this.categoriesScrollView.vscrollbar_policy = PM_St.PolicyType.NEVER;
            this.categoriesScrollView.set_mouse_scrolling(false);
            this.categoriesScrollView.get_vscroll_bar().get_adjustment().set_value(0);
            columns.set_height(this._pmTableHeight);
        }

        _onSearchTextChanged(actor, property) {
            this._pmResetAutoScroll();
            if (this._pmPersonalActive) return;
            if (this._pmIsDrawerView() && this._pmDrawer)
                this._pmDrawer.prepareSearchChange();
            super._onSearchTextChanged(actor, property);
            if (this._pmIsDrawerView() && this._pmDrawer)
                this._pmDrawer.applySearch(this.searchEntry.get_text());
            this._pmFitMenuHeight();
        }

        _doSearch(query) {
            if (this._pmPersonalActive) {
                this._searchTimeoutId = 0;
                return;
            }
            if (this._pmIsDrawerView() && this._pmDrawer) {
                this._searchTimeoutId = 0;
                this._pmDrawer.applySearch(query);
            } else super._doSearch(query);
            this._pmFitMenuHeight();
        }

        _update_autoscroll() {
            // St's built-in implementation starts only on motion in a 10px
            // overlap. Disable it and poll for the entire time the menu is open.
            for (const view of [this.applicationsScrollView, this.categoriesScrollView, this.sidebarScrollView]) {
                if (view) view.set_auto_scrolling(false);
            }
            this._pmUpdateAutoScroll();
        }

        _pmUpdateAutoScroll() {
            if (!this._pmReady || this._pmDisposed || !this.menu.isOpen || !this.autoscroll_enabled) {
                this._pmStopAutoScroll();
                return;
            }
            if (!this._pmAutoScrollTimer)
                this._pmAutoScrollTimer = PM_Mainloop.timeout_add(25, () => this._pmAutoScrollTick());
        }

        _pmStopAutoScroll() {
            if (this._pmAutoScrollTimer) PM_Mainloop.source_remove(this._pmAutoScrollTimer);
            this._pmAutoScrollTimer = 0;
            this._pmResetAutoScroll();
        }

        _pmResetAutoScroll() {
            this._pmSb = false;
            this._pmScrollView = null;
            this._pmScrollPointer = global.get_pointer().slice(0, 2);
        }

        _pmAutoScrollTick() {
            if (this._pmDisposed || !this.menu.isOpen || !this.autoscroll_enabled) {
                this._pmAutoScrollTimer = 0;
                this._pmResetAutoScroll();
                return false;
            }
            if (this.menu.passEvents || (this._pmSystemMenu && this._pmSystemMenu.isOpen) ||
                (this._pmEditor && this._pmEditor.modeMenu && this._pmEditor.modeMenu.isOpen)) {
                this._pmResetAutoScroll();
                return true;
            }
            const [x, y] = global.get_pointer();
            const moved = this._pmScrollPointer &&
                (x !== this._pmScrollPointer[0] || y !== this._pmScrollPointer[1]);
            this._pmScrollPointer = [x, y];
            const scale = Math.max(1, Number(global.ui_scale) || 1);
            const view = this._pmIsDrawerView() ? this._pmDrawer.getScrollView() : this.applicationsScrollView;
            if (view !== this._pmScrollView) {
                this._pmSb = false;
                this._pmScrollView = view;
            }
            if (!view || !view.is_mapped()) {
                this._pmResetAutoScroll();
                return true;
            }
            const bounds = [...view.get_transformed_position(), ...view.get_transformed_size()];
            const [left, top, width, height] = bounds;
            if (width <= 0 || height <= 0 || x < left || x > left + width) this._pmSb = false;
            // An opening/growing popup must not arm itself underneath a
            // stationary pointer. Only a real visit to its interior arms it.
            else if (moved && y > top && y < top + height) this._pmSb = true;
            if (!this._pmSb) return true;
            const adjustment = view.get_vscroll_bar().get_adjustment();
            const maximum = Math.max(adjustment.lower, adjustment.upper - adjustment.page_size);
            if (maximum <= adjustment.lower) return true;
            const delta = _superMenuEdgeDelta(x, y, bounds, scale, this._pmThickness());
            if (delta) adjustment.set_value(Math.max(adjustment.lower,
                Math.min(maximum, adjustment.get_value() + delta)));
            return true;
        }

        _layout() {
            // Cinnamon 6.6 also calls this from inside its native constructor.
            const system = this.systemBox || this.systemButtonsBox;
            if (!this.right_box || !this.searchBox || !this.categoriesApplicationsBox || !system || this._pmDisposed)
                return;
            this.right_box.remove_all_children();
            const drawers = this._pmIsDrawerView();
            if (this.menu && this.menu.actor) {
                const narrow = this._pmIsPersonalList() && !this._pmIsPersonalGrid() && this._pmPersonalIconsOnly;
                if (narrow) this.menu.actor.add_style_class_name("pm-symbol-list");
                else this.menu.actor.remove_style_class_name("pm-symbol-list");
            }
            // Activate only the horizontal drawer overrides on these two
            // native containers. Preserve every existing class and popup style.
            for (const box of [this.main_container, this.right_box]) {
                if (!box) continue;
                if (drawers) box.add_style_class_name("pm-drawer-layout");
                else box.remove_style_class_name("pm-drawer-layout");
            }
            if (this._pmReady) this.showDescription = !drawers && this._pmShowDescription === true;
            if (!drawers && this._pmReady) this.searchBox.set_style(this._pmSearchStyle);
            const searchAtBottom = drawers || this._pmSearchPosition === "bottom";
            this.searchBox.visible = !this._pmPersonalActive;
            // Search and session buttons always form one row. Moving that row
            // also moves the buttons, without rebuilding their action handlers.
            const sessionParent = this.searchBox;
            const parent = system.get_parent();
            if (parent !== sessionParent) {
                if (parent) parent.remove_child(system);
                sessionParent.add(system, {
                    expand: false, x_fill: false, x_align: PM_St.Align.END,
                    y_align: PM_St.Align.MIDDLE, y_fill: false
                });
            }
            system.set_vertical(false);
            if (!this.systemBox) system.add_style_class_name("pm-system-box");

            const programs = this.categoriesApplicationsBox.actor;
            programs.change_style_pseudo_class("top", searchAtBottom);
            if (!searchAtBottom && !this._pmPersonalActive) this.right_box.add(this.searchBox);
            if (drawers) {
                this._pmEnsureDrawerView();
                this._pmDrawer.actor.show();
                this.right_box.add(this._pmDrawer.actor, { expand: false, span: 1,
                    x_fill: true, y_fill: false, y_align: PM_St.Align.START });
            } else {
                if (this._pmDrawer) this._pmDrawer.actor.hide();
                this.right_box.add(programs, { expand: true, span: 1 });
            }
            if (!drawers && this.selectedAppBox && this.showDescription) {
                this.selectedAppBox.show();
                this.right_box.add(this.selectedAppBox);
            } else if (this.selectedAppBox) {
                this.selectedAppBox.hide();
            }
            if (searchAtBottom && !this._pmPersonalActive) this.right_box.add(this.searchBox);
            if (this._pmReady) this._pmConfigureSessionButtons();
            this._pmFitMenuHeight();
            this._size_dirty = true;
        }

        _refreshFavDocs() {
            this.showFavorites = false;
            super._refreshFavDocs();
        }

        _refreshRecent() {
            this.showRecents = false;
            super._refreshRecent();
            if (this._pmReady && this._pmPersonalActive && this._pmPersonalRecent && this._pmDrawer)
                this._pmDrawer.refreshPrograms(true);
        }

        _refreshApps() {
            this.showRecents = false;
            this.symbolicCategoryIcons = false;
            if (this.contextMenu && this.contextMenu._pmCategoryContext && this.contextMenu.isOpen) {
                this._pmFocusMenu();
                this.contextMenu.close(false);
            }
            if (this._pmPersonal) this._pmPersonal.beforeCatalogRefresh();
            if (this._pmReady) this._pmUpdateMenuIcons(false);
            super._refreshApps();
            if (this._pmReady) this._pmAttachCategoryContext();
            if (this._pmPersonal) this._pmPersonal.afterCatalogRefresh();
            if (this._pmDrawer) this._pmDrawer.refreshPrograms();
            if (this._pmReady && this.selectedAppBox) this._layout();
            this._pmFitMenuHeight();
            if (this._pmReady) this._pmFitIconsAfterAllocation();
            if (this._pmEditor) this._pmEditor.publishCategories();
        }

        _pmUpdateMenuIcons(refresh = true) {
            if (!this._pmReady || this._pmDisposed) return;
            const personal = this._pmPersonalActive === true;
            const manual = Number(personal ? this._pmPersonalIconSize : this._pmProgramIconSize);
            let size = Number.isFinite(manual) && manual > 0 ? manual : 24;
            if (personal ? this._pmPersonalFollowPanelIconSize : this._pmProgramFollowPanelIconSize) {
                const panelSize = this.getPanelIconSize(PM_St.IconType.FULLCOLOR);
                if (Number.isFinite(panelSize) && panelSize > 0) size = panelSize;
            }
            size = Math.max(8, Math.min(128, Math.round(size)));
            const changed = this.categoryIconSize !== size || this.applicationIconSize !== size ||
                this.symbolicCategoryIcons !== false;
            this.categoryIconSize = size;
            this.applicationIconSize = size;
            this.symbolicCategoryIcons = false;
            for (const button of [...(this._categoryButtons || []), ...(this._applicationsButtons || [])]) {
                if (button.icon && typeof button.icon.set_icon_size === "function")
                    button.icon.set_icon_size(size);
            }
            if (this._pmDrawer) this._pmDrawer.updateIconSizes();
            if (changed && refresh && typeof RefreshFlags !== "undefined")
                this.queueRefresh(RefreshFlags.APP);
            this._size_dirty = true;
            this._pmFitMenuHeight();
            if (changed) this._pmFitIconsAfterAllocation();
        }

        _pmFitIconsAfterAllocation() {
            if (this._pmDisposed || this._pmIconAllocationSignal || !this.main_container) return;
            // Fit again after invalidated icon measurements have been laid
            // out, before painting; no pointer event is needed to correct it.
            this._pmIconAllocationSignal = this.main_container.connect("notify::allocation", () => {
                this.main_container.disconnect(this._pmIconAllocationSignal);
                this._pmIconAllocationSignal = 0;
                this._pmFitMenuHeight();
            });
            this.main_container.queue_relayout();
        }

        _pmDescriptionChanged() {
            if (!this._pmReady || this._pmDisposed) return;
            this.showDescription = !this._pmIsDrawerView() && this._pmShowDescription === true;
            if (this._pmDrawer) this._pmDrawer.refreshPrograms();
            this._layout();
            if (typeof RefreshFlags !== "undefined") this.queueRefresh(RefreshFlags.APP);
        }

        _refreshFavApps() {
            // Keep the native container alive for its navigation/drag hooks.
            this.favoritesBox.destroy_all_children();
            this._favoriteAppButtons = [];
        }

        _refreshPlaces() {
            this.showPlaces = false;
            super._refreshPlaces();
            this._pmPlacesChanged();
        }

        _refreshSidebar() {
            this.placesBox.destroy_all_children();
            this.favoriteAppsBox.destroy_all_children();
            this._placesButtons = [];
            this.placesSeparator.hide();
            this.sidebar.hide();
            this.updateNavigation();
            this._pmPlacesChanged();
        }

        _pmPlacesChanged() {
            if (this._pmReady && !this._pmDisposed && this._pmPersonalActive && this._pmDrawer)
                this._pmDrawer.refreshPrograms(true);
            if (this._pmEditor) this._pmEditor.publishCategories();
        }

        _pmCategoryChoices() {
            const personal = this._pmEnsurePersonalMenu();
            const choices = personal.store.state.categories.map(group => ({ id: "category:" + group.id, name: group.name }));
            if (this._pmPersonalPlaces) choices.push({ id: "places", name: _("Places") });
            if (this._pmPersonalRecent) choices.push({ id: "recent", name: _("Recently used") });
            return choices;
        }

        _pmSelectedPlaces() {
            const manager = PM_Main.placesManager;
            if (!manager) return [];
            const directories = ["Documents", "Downloads", "Music", "Pictures", "Videos"];
            const paths = new Map([[PM_GLib.get_home_dir(), "Home"],
                [PM_GLib.get_user_special_dir(PM_GLib.UserDirectory.DIRECTORY_DESKTOP), "Desktop"]]);
            paths.delete(null);
            for (const name of directories) {
                const path = PM_GLib.get_user_special_dir(PM_GLib.UserDirectory[
                    "DIRECTORY_" + (name === "Downloads" ? "DOWNLOAD" : name.toUpperCase())]);
                if (path && !paths.has(path)) paths.set(path, name);
            }
            const seen = new Set();
            return [...manager.getDefaultPlaces(), ...manager.getBookmarks()].filter(place => {
                if (!place || typeof place.id !== "string" || typeof place.launch !== "function") return false;
                let key, uri;
                if (place.id === "special:home" || place.id === "special:desktop") {
                    key = place.id === "special:home" ? "Home" : "Desktop";
                    const path = key === "Home" ? PM_GLib.get_home_dir() :
                        PM_GLib.get_user_special_dir(PM_GLib.UserDirectory.DIRECTORY_DESKTOP);
                    if (!path) return false;
                    uri = PM_Gio.file_new_for_path(path).get_uri();
                } else if (place.id.startsWith("bookmark:")) {
                    uri = place.id.slice("bookmark:".length);
                    key = paths.get(PM_Gio.file_new_for_uri(uri).get_path()) || "Bookmarks";
                } else return false;
                if (this["_pmPlace" + key] !== true || seen.has(uri)) return false;
                seen.add(uri);
                return true;
            });
        }

        _pmAttachCategoryContext() {
            for (const item of [...(this._categoryButtons || []), ...(this._applicationsButtons || [])])
                _superMenuTextTooltip(item);
            for (const category of this._categoryButtons || []) {
                if (category.categoryId == null || ["recent", "favorite"].includes(category.categoryId)) continue;
                category._pmProgramCategory = true;
                category.withMenu = true;
                // PopupSubMenu's directional keyboard handler expects this
                // focus hook; native SimpleMenuItem categories do not have it.
                if (typeof category.setActive !== "function") category.setActive = active => {
                    if (active && category.actor.is_mapped()) category.actor.grab_key_focus();
                };
                category.populateMenu = menu => this._pmEnsurePersonalMenu().addCategoryContextAction(menu, category);
                if (category._pmCategoryContextKey || !category._signals) continue;
                category._pmCategoryContextKey = true;
                category._signals.connect(category.actor, "key-press-event", (actor, event) => {
                    const key = event.get_key_symbol();
                    const state = event.get_state ? event.get_state() : 0;
                    if (key !== PM_Clutter.KEY_Menu && !(key === PM_Clutter.KEY_F10 &&
                        (state & PM_Clutter.ModifierType.SHIFT_MASK))) return PM_Clutter.EVENT_PROPAGATE;
                    this.toggleContextMenu(category);
                    return PM_Clutter.EVENT_STOP;
                });
            }
        }

        toggleContextMenu(button, fromKeyboard = false) {
            if (this._pmPersonalActive) {
                if (this._pmIsEditing()) this._pmEditor.toggleActions(button);
                else if (this._pmEditor) this._pmEditor.toggleModeMenu(button, fromKeyboard);
                return;
            }
            if (button && button._pmProgramCategory) {
                if (!this._pmPersonalEnabled) return;
                if (this._pmIsDrawerView()) {
                    const header = button.view === this._pmDrawer ? button :
                        this._pmDrawer.categories.find(item => item.id === button.categoryId)?.header;
                    if (header) this._pmDrawer.toggleInlineContextMenu(header, menu => button.populateMenu(menu));
                } else this._pmToggleCategoryTableContext(button);
                return;
            }
            if (this._pmIsDrawerView()) {
                this._pmDrawer.toggleApplicationContextMenu(button);
                return;
            }
            // The native application context always belongs to applicationsBox.
            // Restore it after using that same popup below a table category.
            if (this.contextMenu && this.contextMenu._pmCategoryContext) {
                this.contextMenu.close(false);
                this.contextMenu._pmCategoryContext = false;
                const parent = this.contextMenu.actor.get_parent();
                if (parent) parent.remove_child(this.contextMenu.actor);
                this.applicationsBox.add_actor(this.contextMenu.actor);
            }
            super.toggleContextMenu(button);
            // A second right click only closes the native context menu.
            // Do not destroy/recreate its focused action while it closes.
            if (this.contextMenu && this.contextMenu.isOpen !== false)
                this._pmFilterApplicationContextMenu(this.contextMenu, button);
        }

        _pmToggleCategoryTableContext(button) {
            if (!this._pmPersonalEnabled) return;
            this._pmResetAutoScroll();
            let menu = this.contextMenu;
            if (menu && menu.isOpen && menu._pmCategoryContext && menu.sourceActor === button.actor) {
                menu.close(false);
                return;
            }
            if (!menu) {
                menu = new PM_PopupMenu.PopupSubMenu(null);
                menu.actor.set_style_class_name("appmenu-context-menu");
                menu._needsScrollbar = () => false;
                menu._getTopMenu = () => this.menu;
                menu.connect("open-state-changed", item => this._contextMenuOpenStateChanged(item));
                this.contextMenu = menu;
            }
            this._pmGuardTableContext(menu);
            menu.close(false);
            menu.removeAll();
            menu._pmCategoryContext = true;
            const parent = menu.actor.get_parent();
            if (parent) parent.remove_child(menu.actor);
            const container = button.actor.get_parent();
            container.insert_child_at_index(menu.actor, container.get_children().indexOf(button.actor) + 1);
            menu.sourceActor = button.actor;
            button.populateMenu(menu);
            // St.Widget emits popup-menu and consumes Menu/Shift-F10 before
            // they can bubble out of a focused action.
            for (const item of menu._getMenuItems())
                item.actor.connect("popup-menu", () => {
                    this._pmFocusMenu();
                    menu.close(false);
                });
            _superMenuContextTooltips(menu);
            menu.open(false);
            if (menu.firstMenuItem) menu.firstMenuItem.actor.grab_key_focus();
        }

        _pmGuardTableContext(menu) {
            if (menu._pmTableCloseGuard) return;
            // Category actions take actual focus. Route their bubbling keys
            // through the same handler used by the table's search field.
            menu.actor.connect("key-press-event", (actor, event) =>
                menu._pmCategoryContext ? this._onMenuKeyPress(actor, event) : PM_Clutter.EVENT_PROPAGATE);
            const close = menu.close;
            menu.close = animate => {
                const focused = global.stage.get_key_focus();
                if (menu.isOpen && this.menu.isOpen && focused &&
                    (menu.actor.contains(focused) || focused === menu.sourceActor))
                    this._pmFocusMenu();
                // Category contexts open immediately. A delayed native close
                // must not hide a newly opened category context.
                return close.call(menu, menu._pmCategoryContext ? false : animate);
            };
            menu._pmTableCloseGuard = true;
        }

        _contextMenuOpenStateChanged(menu) {
            if (!menu._pmCategoryContext) return super._contextMenuOpenStateChanged(menu);
            this._activeContextMenuItem = null;
            this._activeContextMenuParent = menu.isOpen ? menu.sourceActor._delegate : null;
            if (menu.isOpen) this._scrollToButton(menu, this.categoriesScrollView);
            else {
                menu.sourceActor = null;
                menu._pmCategoryContext = false;
                // Native category resets only know category actors. Keep a
                // closed context out of that list and ready for app actions.
                const parent = menu.actor.get_parent();
                if (parent) parent.remove_child(menu.actor);
                this.applicationsBox.add_actor(menu.actor);
            }
        }

        _pmFilterApplicationContextMenu(menu, button, categoryId = this.lastSelectedCategory) {
            if (!menu) return;
            // Own entries use the editor's complete action list.
            if (button && button._pmEntryId) return;
            if (!this._pmIsDrawerView()) this._pmGuardTableContext(menu);
            for (const item of menu._getMenuItems()) {
                if (item._action === "add_to_favorites" || item._action === "remove_from_favorites" || item._pmPersonalAction)
                    item.destroy();
            }
            if (button && button.app)
                this._pmEnsurePersonalMenu().addContextAction(menu, button, categoryId);
            _superMenuContextTooltips(menu);
        }

        _displayButtons(category, buttons = [], autoCompletes = []) {
            if (!this._pmPersonalActive) super._displayButtons(category, buttons, autoCompletes);
            for (const actor of this.applicationsBox ? this.applicationsBox.get_children() : [])
                _superMenuTextTooltip(actor._delegate);
            if (this._pmPersonal) this._pmPersonal.filterActors();
        }

        _favboxtoggle() {
            this.favBoxShow = false;
            if (this.left_box) this.left_box.hide();
        }

        _sidebarToggle() {
            this.showSidebar = false;
            if (this.sidebar) this.sidebar.hide();
            if (this.sysBoxIter) this.updateNavigation();
        }

        _avatarToggle() {
            this.showAvatar = false;
            if (this.userBox) this.userBox.hide();
            if (this.avatarSeparator) this.avatarSeparator.hide();
        }

        _refreshSystemButtons() {
            // Native refresh destroys only children still attached to the box.
            // Dispose detached actions too before their replacements are built.
            this._pmDestroyGroupedSystemMenu();
            if (this._pmSessionButtons) {
                for (const actor of this._pmSessionButtons.values()) {
                    if (!actor.get_parent()) actor.destroy();
                }
                this._pmSessionButtons.clear();
            }
            super._refreshSystemButtons();
            const system = this.systemBox || this.systemButtonsBox;
            if (this._activeContainer === system) {
                this._activeContainer = null;
                this._activeActor = null;
            }
            this._pmConfigureSessionButtons();
        }

        _clearAllSelections() {
            // Native reset runs after the closing animation and after menu
            // construction. It shows every session action, so restore our
            // visibility choices before the next frame or menu opening.
            super._clearAllSelections();
            this._pmConfigureSessionButtons();
            if (this._pmPersonal) this._pmPersonal.filterActors();
        }

        _pmSessionActionEnabled(action) {
            if (this._pmPersonalActive) return false;
            return action === "lock-screen" ? this._pmShowLock !== false :
                action === "log-out" ? this._pmShowLogout !== false : this._pmShowShutdown !== false;
        }

        _pmDestroyGroupedSystemMenu() {
            if (this._pmSystemMenu) {
                this.menu.removeChildMenu(this._pmSystemMenu);
                this._pmSystemMenu.destroy();
            }
            if (this._pmSystemMenuButton) {
                if (this._pmSystemMenuButton._pmTooltip) this._pmSystemMenuButton._pmTooltip.destroy();
                this._pmSystemMenuButton.destroy();
            }
            this._pmSystemMenu = null;
            this._pmSystemMenuButton = null;
            this._pmSystemMenuStamp = null;
        }

        _pmSyncGroupedSystemMenu(system, enabled) {
            const actions = ["lock-screen", "log-out", "shutdown"].filter(action =>
                this._pmSessionActionEnabled(action) && this._pmSessionButtons.has(action));
            if (!enabled || !actions.length) {
                if (this._pmSystemMenu && this._pmSystemMenu.isOpen && this.menu.isOpen) this._pmFocusMenu();
                if (this._pmSystemMenu) this._pmSystemMenu.close(false);
                if (this._pmSystemMenuButton) {
                    const actor = this._pmSystemMenuButton.actor;
                    if (actor.get_parent()) actor.get_parent().remove_child(actor);
                    actor.hide();
                }
                return false;
            }
            if (!this._pmSystemMenu) {
                const button = new SystemButton(this, "system-shutdown-symbolic", _("Quit"), _("Quit"));
                button.actor._pmSessionAction = "system-menu";
                button.actor.can_focus = true;
                button.actor.add_style_class_name("appmenu-system-button-logout");
                _superMenuSessionGlyph(button.icon, "shutdown", this);
                const menu = _superMenuPopover(button.actor, this);
                PM_Main.uiGroup.add_actor(menu.actor);
                menu.actor.hide();
                this.menu.addChildMenu(menu);
                menu.connect("open-state-changed", () => this._pmResetAutoScroll());
                button.activate = () => menu.toggle();
                button._pmTooltip = new PM_Tooltips.Tooltip(button.actor, _("Quit"));
                this._pmSystemMenuButton = button;
                this._pmSystemMenu = menu;
            }
            const button = this._pmSystemMenuButton, menu = this._pmSystemMenu;
            const stamp = actions.join(":") + ":" + this._pmShutdownRed;
            if (stamp !== this._pmSystemMenuStamp) {
                menu.removeAll();
                for (const action of actions) {
                    const original = this._pmSessionButtons.get(action)._delegate;
                    const row = new PM_PopupMenu.PopupIconMenuItem(original.name,
                        "system-" + action + "-symbolic", PM_St.IconType.SYMBOLIC);
                    row._icon.set_icon_size(16);
                    _superMenuSessionGlyph(row._icon, action, this);
                    if (action === "shutdown" && this._pmShutdownRed)
                        row._icon.add_style_class_name("pm-shutdown-symbol-red");
                    row.connect("activate", () => {
                        menu.close(false);
                        this._pmSessionButtons.get(action)._delegate.activate();
                    });
                    menu.addMenuItem(row);
                }
                this._pmSystemMenuStamp = stamp;
            }
            if (this._pmFlatSystemButtons) button.actor.add_style_class_name("pm-system-flat");
            else button.actor.remove_style_class_name("pm-system-flat");
            if (!button.actor.get_parent()) system.add(button.actor, { y_align: PM_St.Align.MIDDLE, y_fill: false });
            button.actor.show();
            return true;
        }

        _pmConfigureSessionButtons() {
            const system = this.systemBox || this.systemButtonsBox;
            if (!system || this._pmDisposed) return;
            const flat = this._pmFlatSystemButtons === true;
            const drawers = this._pmIsDrawerView();
            const grouped = !drawers && this._pmGroupSystemButtons === true;
            if (flat) system.add_style_class_name("pm-system-flat-box");
            else system.remove_style_class_name("pm-system-flat-box");
            if (!this._pmSessionButtons) this._pmSessionButtons = new Map();
            for (const actor of system.get_children()) {
                const button = actor._delegate;
                if (!button || !button.icon) continue;
                const action = actor._pmSessionAction || String(button.icon.icon_name || "")
                    .replace(/^(system-|xsi-)/, "").replace(/-symbolic$/, "");
                if (["lock-screen", "log-out", "shutdown"].indexOf(action) === -1) continue;
                actor._pmSessionAction = action;
                this._pmSessionButtons.set(action, actor);
            }
            // Disabled actions have no place in the visible actor tree. A
            // native show()/selection reset therefore cannot resurrect them.
            for (const action of ["lock-screen", "log-out", "shutdown"]) {
                const actor = this._pmSessionButtons.get(action);
                if (!actor) continue;
                const button = actor._delegate;
                const visible = !drawers && !grouped && this._pmSessionActionEnabled(action);
                // The optional flat style changes decoration, retaining the
                // template's icons, actions and neutral/red variants.
                if (flat) actor.add_style_class_name("pm-system-flat");
                else actor.remove_style_class_name("pm-system-flat");
                if (action === "shutdown") {
                    const red = this._pmShutdownRed === true;
                    actor.remove_style_class_name("appmenu-system-button-shutdown");
                    actor.remove_style_class_name("appmenu-system-button-logout");
                    actor.remove_style_class_name("pm-shutdown-red");
                    actor.add_style_class_name(red && !flat ? "appmenu-system-button-shutdown" :
                        "appmenu-system-button-logout");
                    if (red) actor.add_style_class_name("pm-shutdown-red");
                    button.icon.add_style_class_name("pm-system-action-icon");
                    if (red && flat) button.icon.add_style_class_name("pm-shutdown-symbol-red");
                    else button.icon.remove_style_class_name("pm-shutdown-symbol-red");
                    if (red && !flat) button.icon.add_style_class_name("pm-shutdown-symbol-white");
                    else button.icon.remove_style_class_name("pm-shutdown-symbol-white");
                }
                actor.can_focus = visible;
                if (!visible && actor.get_parent() === system) system.remove_child(actor);
                if (visible && !actor.get_parent()) system.add(actor, {
                    y_align: PM_St.Align.MIDDLE, y_fill: false
                });
                actor.visible = visible;
                actor.set_accessible_name(button.name);
                actor.set_accessible_role(PM_Atk.Role.BUTTON);
                // The supported native systemButtonsBox arrangement has no
                // template variants; use its neutral symbolic fallback.
                if (!this.systemBox) {
                    actor.add_style_class_name("pm-legacy-system-button");
                    button.icon.set_icon_name("system-" + action + "-symbolic");
                    button.icon.set_icon_type(PM_St.IconType.SYMBOLIC);
                    button.icon.set_icon_size(16);
                }
                _superMenuSessionGlyph(button.icon, action, this);
                if (!actor._pmTooltip)
                    actor._pmTooltip = new PM_Tooltips.Tooltip(actor, button.name);
                if (!visible && this._activeActor === actor) {
                    actor.remove_style_pseudo_class("hover");
                    this._activeContainer = null;
                    this._activeActor = null;
                }
            }
            // Re-enabling an action must restore lock/logout/shutdown order.
            let index = 0;
            for (const action of ["lock-screen", "log-out", "shutdown"]) {
                const actor = this._pmSessionButtons.get(action);
                if (actor && actor.get_parent() === system)
                    system.set_child_at_index(actor, index++);
            }
            system.visible = this._pmSyncGroupedSystemMenu(system, grouped) || index > 0;
            if (this._pmDrawer) this._pmDrawer.refreshSystemActions();
            this._pmFitMenuHeight();
            if (this.sysBoxIter) this.sysBoxIter.reloadVisible();
            this._size_dirty = true;
        }

        _pmRegionActors(container) {
            return container.get_focus_chain().filter(actor => actor.visible && actor._delegate);
        }

        _pmCycleRegion(backwards) {
            const system = this.systemBox || this.systemButtonsBox;
            const regions = [this.categoriesBox, this.applicationsBox, system]
                .filter(box => this._pmRegionActors(box).length > 0);
            if (regions.length === 0) return;
            const current = regions.indexOf(this._activeContainer);
            const next = current === -1 ? (backwards ? regions.length - 1 : 0) :
                (current + (backwards ? -1 : 1) + regions.length) % regions.length;
            const actors = this._pmRegionActors(regions[next]);
            this._buttonEnterEvent(actors[backwards ? actors.length - 1 : 0]._delegate);
        }

        _onMenuKeyPress(actor, event) {
            if (this._pmIsDrawerView() && this._pmDrawer)
                return this._pmDrawer.handleSearchKey(event);
            const key = event.get_key_symbol();
            const categoryMenuKey = key === PM_Clutter.KEY_Menu || (key === PM_Clutter.KEY_F10 &&
                event.get_state && (event.get_state() & PM_Clutter.ModifierType.SHIFT_MASK));
            const context = this.contextMenu;
            if (this._pmPersonal && this._pmPersonal.handleTableContextKey(context, event) === PM_Clutter.EVENT_STOP)
                return PM_Clutter.EVENT_STOP;
            if (context && context.isOpen && context._pmCategoryContext) {
                if (key === PM_Clutter.KEY_Escape || categoryMenuKey) {
                    this._pmFocusMenu();
                    context.close(false);
                    return PM_Clutter.EVENT_STOP;
                }
                if ([PM_Clutter.KEY_Return, PM_Clutter.KEY_KP_Enter, PM_Clutter.KEY_space].includes(key)) {
                    context.firstMenuItem.activate();
                    return PM_Clutter.EVENT_STOP;
                }
                if ([PM_Clutter.KEY_Up, PM_Clutter.KEY_KP_Up, PM_Clutter.KEY_Down,
                    PM_Clutter.KEY_KP_Down, PM_Clutter.KEY_Page_Up, PM_Clutter.KEY_Page_Down].includes(key)) {
                    context.firstMenuItem.actor.grab_key_focus();
                    return PM_Clutter.EVENT_STOP;
                }
            }
            if (!this._pmReady || this.searchActive || this._activeContextMenuParent)
                return super._onMenuKeyPress(actor, event);
            const selected = this._activeActor && this._activeActor._delegate;
            if (categoryMenuKey && this._activeContainer === this.categoriesBox &&
                selected && selected._pmProgramCategory) {
                this.toggleContextMenu(selected);
                return PM_Clutter.EVENT_STOP;
            }
            if (key === PM_Clutter.KEY_Tab || key === PM_Clutter.KEY_ISO_Left_Tab) {
                this._pmCycleRegion(key === PM_Clutter.KEY_ISO_Left_Tab);
                return PM_Clutter.EVENT_STOP;
            }
            const system = this.systemBox || this.systemButtonsBox;
            if (this._activeContainer === system) {
                const buttons = this._pmRegionActors(system);
                const index = buttons.indexOf(this._activeActor);
                let target = null;
                if (key === PM_Clutter.KEY_Right || key === PM_Clutter.KEY_KP_Right)
                    target = buttons[(index + 1) % buttons.length];
                else if (key === PM_Clutter.KEY_Left || key === PM_Clutter.KEY_KP_Left)
                    target = buttons[(index - 1 + buttons.length) % buttons.length];
                else if ([PM_Clutter.KEY_Up, PM_Clutter.KEY_KP_Up, PM_Clutter.KEY_Down, PM_Clutter.KEY_KP_Down].indexOf(key) !== -1) {
                    this._pmCycleRegion(key === PM_Clutter.KEY_Up || key === PM_Clutter.KEY_KP_Up);
                    return PM_Clutter.EVENT_STOP;
                } else if (key === PM_Clutter.KEY_space && this._activeActor) {
                    this._activeActor._delegate.activate();
                    return PM_Clutter.EVENT_STOP;
                }
                if (target) {
                    this._buttonEnterEvent(target._delegate);
                    return PM_Clutter.EVENT_STOP;
                }
            }
            return super._onMenuKeyPress(actor, event);
        }

        _pmMakeButton(style, name) {
            const button = new imports.gi.Cinnamon.GenericContainer({
                style_class: "applet-box pm-launcher " + style,
                reactive: true, track_hover: true, can_focus: true,
                accessible_role: PM_Atk.Role.PUSH_BUTTON,
                accessible_name: name
            });
            // Match grouped-window-list's integer centering. St.Bin rounds
            // half pixels up, moving a 32 px icon down in a 45 px panel.
            button.connect("get-preferred-width", (actor, height, allocation) => {
                const child = actor.get_first_child();
                const [minimum, natural] = child ? child.get_preferred_width(height) : [0, 0];
                allocation.min_size = minimum;
                allocation.natural_size = natural;
            });
            button.connect("get-preferred-height", (actor, width, allocation) => {
                const child = actor.get_first_child();
                const [minimum, natural] = child ? child.get_preferred_height(width) : [0, 0];
                allocation.min_size = minimum;
                allocation.natural_size = natural;
            });
            button.connect("allocate", (actor, box, flags) => {
                const child = actor.get_first_child();
                if (!child) return;
                const [, , naturalWidth, naturalHeight] = child.get_preferred_size();
                const width = Math.max(0, box.x2 - box.x1), height = Math.max(0, box.y2 - box.y1);
                const childBox = new PM_Clutter.ActorBox();
                childBox.x1 = box.x1 + Math.floor(Math.max(0, width - naturalWidth) / 2);
                childBox.y1 = box.y1 + Math.floor(Math.max(0, height - naturalHeight) / 2);
                childBox.x2 = childBox.x1 + Math.min(width, naturalWidth);
                childBox.y2 = childBox.y1 + Math.min(height, naturalHeight);
                child.allocate(childBox, flags);
            });
            button._applet = this;
            return button;
        }

        _pmThickness() {
            // panel.height and the constructor argument are physical pixels.
            const size = this.panel && this.panel.height > 0 ? this.panel.height :
                (this._pmFallbackHeight || panelHeight);
            return Math.max(16, Number(size) || 40);
        }

        _pmIsVertical() {
            return this._orientation === PM_St.Side.LEFT || this._orientation === PM_St.Side.RIGHT;
        }

        _pmFlashPersonalButton() {
            if (!this._pmReady || this._pmDisposed || !this._pmPersonalEnabled) return;
            this._pmEditor.ensureProbe();
            const color = this._pmEditor.selectionColor();
            if (this._pmPersonalFeedbackTimer) PM_Mainloop.source_remove(this._pmPersonalFeedbackTimer);
            this._pmPersonalFeedbackStyle = _superMenuSelectionBackground(color);
            this._pmUpdateLayout();
            // This cue belongs to the destination on the panel, independently
            // of the source menu or its action list remaining open.
            this._pmPersonalFeedbackTimer = PM_Mainloop.timeout_add(2000, () => {
                this._pmPersonalFeedbackTimer = 0;
                this._pmClearPersonalFeedback();
                return false;
            });
        }

        _pmClearPersonalFeedback() {
            if (this._pmPersonalFeedbackTimer) PM_Mainloop.source_remove(this._pmPersonalFeedbackTimer);
            this._pmPersonalFeedbackTimer = 0;
            if (!this._pmPersonalFeedbackStyle) return;
            this._pmPersonalFeedbackStyle = "";
            this._pmUpdateLayout();
        }

        _pmUpdateLayout() {
            if (!this._pmReady || this._pmDisposed) return;
            const thickness = this._pmThickness();
            const both = this._pmSpacingSide === "both";
            const limit = both ? 300 : 600;
            const percent = this._pmPersonalEnabled ? Math.max(0, Math.min(limit, Number(this._pmSpacingPercent) || 0)) : 0;
            this._pmSecondary.visible = !!this._pmPersonalEnabled;
            const gap = this._pmSpacingSide === "right" ? 0 : Math.round(thickness * percent / 100);
            const totalGap = Math.round(thickness * percent * (both ? 2 : 1) / 100);
            const vertical = this._pmIsVertical();
            this.actor.set_vertical(vertical);

            for (const button of [this._pmPrimary, this._pmSecondary]) {
                button.set_style("padding: 0px; margin: 0px;" +
                    (button === this._pmSecondary ? this._pmPersonalFeedbackStyle : ""));
                button.set_width(vertical ? -1 : thickness);
                button.set_height(vertical ? thickness : -1);
                button.set_x_expand(vertical);
                button.set_y_expand(!vertical);
            }
            for (const spacer of [this._pmInnerGap, this._pmOuterGap]) {
                const size = spacer === this._pmOuterGap ? totalGap - gap : gap;
                spacer.set_width(vertical ? -1 : size);
                spacer.set_height(vertical ? size : -1);
                spacer.set_x_expand(vertical);
                spacer.set_y_expand(!vertical);
                spacer.visible = size > 0;
            }
        }

        _setStyle() {
            if (!this._applet_icon || this._pmDisposed) return;
            this._pmSizePanelIcon(this._applet_icon, !this._pmPrimaryStyle || this._pmPrimaryStyle === "arrow");
            this._applet_icon.reactive = false;
            this._applet_icon.track_hover = false;
        }

        _updateIconAndLabel() {
            if (!this._applet_icon_box || this._pmDisposed) return;
            const custom = this._pmPrimaryStyle === "user-icon";
            const fallback = "cinnamon-all-applications-symbolic";
            const icon = custom ? String(this._pmPrimaryCustomIcon || "").trim() || fallback :
                this._pmPrimaryStyle === "all-applications" ? fallback :
                this._pmPrimaryStyle === "supermenu" ? this._pmSuperMenuIcon() :
                this._pmPrimaryStyle === "system-menu" ? this._pmSystemMenuIcon() : this._pmArrowIcon();
            // Native construction calls this virtual method before settings
            // are bound. The same safe arrow default applies in that phase.
            if (!this._applet_icon) this.set_applet_icon_symbolic_path(this._pmArrowIcon());
            this._pmSetPanelIcon(this._applet_icon, icon, fallback);
            this._setStyle();
            this._applet_icon_box.show();
            this.set_applet_label("");
            if (this._layoutBin) this._layoutBin.hide();
            if (this._pmEditor) this._pmEditor.publishPanelPreview();
        }

        _pmSystemMenuIcon() {
            return (this.menuCustom ? this.menuIcon : global.settings.get_string("app-menu-icon-name")) || "cinnamon-symbolic";
        }

        _pmSuperMenuIcon() {
            return metadata.path + "/supermenu-main-symbolic.svg";
        }

        openAbout() {
            PM_Gio.Subprocess.new(["python3", metadata.path + "/about.py"], PM_Gio.SubprocessFlags.NONE);
        }

        _pmOwnPanelIcons() {
            return [
                { id: "mint", name: "SuperMenu", icon: this._pmSuperMenuIcon() },
                { id: "star4", name: _("Four-pointed star with transparent Super-S"), icon: metadata.path + "/supermenu-star4-transparent.svg" },
                { id: "star4-theme", name: _("Four-pointed star with Super-S in text color"), icon: metadata.path + "/supermenu-star4-theme.svg", themeColor: true },
                { id: "star4-symbolic", name: _("Symbolic four-pointed star"), icon: metadata.path + "/supermenu-star4-symbolic.svg" },
                { id: "star5", name: _("Five-pointed star with transparent Super-S"), icon: metadata.path + "/supermenu-star5-transparent.svg" },
                { id: "star5-theme", name: _("Five-pointed star with Super-S in text color"), icon: metadata.path + "/supermenu-star5-theme.svg", themeColor: true },
                { id: "star5-symbolic", name: _("Symbolic five-pointed star"), icon: metadata.path + "/supermenu-star5-symbolic.svg" },
                { id: "arrow", name: _("Expansion arrow"), icon: this._pmArrowIcon() }
            ];
        }

        _pmUpdateSecondary() {
            if (!this._pmReady || this._pmDisposed) return;
            const choices = this._pmOwnPanelIcons();
            const selected = choices.find(item => item.id === this._pmSecondaryStyle) || choices[0];
            const icon = this._pmSecondaryStyle === "user-icon" ? String(this._pmSecondaryCustomIcon || "").trim() : selected.icon;
            this._pmSetPanelIcon(this._pmSecondaryIcon, icon, choices[0].icon);
            this._pmRefreshThemedStar();
            this._pmSizePanelIcon(this._pmSecondaryIcon, this._pmSecondaryStyle === "arrow");
            if (this._pmEditor) this._pmEditor.publishPanelPreview();
        }

        _pmRefreshThemedStar() {
            if (!this._pmReady || this._pmDisposed) return;
            const choice = this._pmOwnPanelIcons().find(item => item.id === this._pmSecondaryStyle);
            if (!choice || !choice.themeColor) return;
            const color = this._pmSecondaryIcon.get_theme_node().get_foreground_color();
            const css = `rgba(${color.red},${color.green},${color.blue},${color.alpha / 255})`;
            const size = this._pmPanelIconSize(PM_St.IconType.FULLCOLOR, false) * Math.max(1, global.ui_scale);
            const key = choice.icon + ":" + css + ":" + size;
            if (!this._pmThemedStar || this._pmThemedStar.key !== key) {
                const [ok, contents] = PM_GLib.file_get_contents(choice.icon);
                if (!ok) return;
                const svg = PM_ByteArray.toString(contents).replace(/(<svg\b[^>]*\bcolor=)"[^"]*"/,
                    `$1"${css}"`);
                const loader = PM_GdkPixbuf.PixbufLoader.new_with_type("svg");
                loader.set_size(size, size);
                loader.write(PM_ByteArray.fromString(svg));
                loader.close();
                // Pixbuf implements GIcon. Render SVG at the physical target
                // size before St loads it, avoiding an enlarged 32px bitmap.
                this._pmThemedStar = { key, icon: loader.get_pixbuf() };
            }
            this._pmSecondaryIcon.set_gicon(this._pmThemedStar.icon);
        }

        _pmWatchPanelIconPreview() {
            for (const [actor, signal] of this._pmPreviewSignals || []) actor.disconnect(signal);
            this._pmPreviewSignals = [];
            for (const actor of [this.panel && this.panel.actor, this._applet_icon, this._pmSecondaryIcon]) {
                if (actor) this._pmPreviewSignals.push([actor, actor.connect("style-changed", () => {
                    this._pmRefreshThemedStar();
                    if (this._pmEditor) this._pmEditor.publishPanelPreview();
                })]);
            }
        }

        _pmPanelIconPreview() {
            const panel = this.panel && this.panel.actor;
            if (!panel) return {};
            const node = panel.get_theme_node();
            if (typeof node.get_background_color !== "function") return {};
            const rgba = color => [color.red / 255, color.green / 255, color.blue / 255, color.alpha / 255];
            const background = rgba(node.get_background_color());
            // A solid swatch keeps the GTK window from showing through a
            // translucent panel color; its RGB comes from Cinnamon's theme.
            background[3] = 1;
            const choose = value => ({ id: "user-icon", name: _("Choose a custom icon or image"), icon: "image-x-generic-symbolic",
                choose: true, size: this._pmPanelIconSize(String(value || "").includes("-symbolic") ?
                    PM_St.IconType.SYMBOLIC : PM_St.IconType.FULLCOLOR, false) });
            const describe = item => ({ ...item, size: this._pmPanelIconSize(item.icon.includes("-symbolic") ?
                PM_St.IconType.SYMBOLIC : PM_St.IconType.FULLCOLOR, item.id === "arrow") });
            return { background, height: Math.max(1, Math.round(this._pmThickness() / Math.max(1, global.ui_scale))),
                primary: { foreground: rgba(this._applet_icon.get_theme_node().get_foreground_color()), icons: [
                    describe({ id: "arrow", name: _("Expansion arrow"), icon: this._pmArrowIcon() }),
                    describe({ id: "all-applications", name: _("All applications"), icon: "cinnamon-all-applications-symbolic" }),
                    describe({ id: "supermenu", name: "SuperMenu", icon: this._pmSuperMenuIcon() }),
                    describe({ id: "system-menu", name: _("System menu icon"), icon: this._pmSystemMenuIcon() }),
                    choose(this._pmPrimaryCustomIcon)] },
                secondary: { foreground: rgba(this._pmSecondaryIcon.get_theme_node().get_foreground_color()),
                    icons: [...this._pmOwnPanelIcons().map(describe), choose(this._pmSecondaryCustomIcon)] } };
        }

        _pmArrowIcon() {
            const directions = { [PM_St.Side.BOTTOM]: "up", [PM_St.Side.TOP]: "down",
                [PM_St.Side.LEFT]: "right", [PM_St.Side.RIGHT]: "left" };
            return metadata.path + "/arrow-" + (directions[this._orientation] || "up") + "-symbolic.svg";
        }

        _pmSetPanelIcon(actor, requested, fallback) {
            const isFile = name => PM_GLib.path_is_absolute(name) && PM_GLib.file_test(name, PM_GLib.FileTest.EXISTS);
            const icon = isFile(requested) || PM_Gtk.IconTheme.get_default().has_icon(requested) ? requested : fallback;
            const symbolic = icon.indexOf("-symbolic") !== -1;
            const type = symbolic ? PM_St.IconType.SYMBOLIC : PM_St.IconType.FULLCOLOR;
            if (isFile(icon)) actor.set_gicon(new PM_Gio.FileIcon({ file: PM_Gio.file_new_for_path(icon) }));
            else actor.set_icon_name(icon);
            actor.set_icon_type(type);
            actor.set_style_class_name(symbolic ? "system-status-icon" : "applet-icon");
        }

        _pmSizePanelIcon(actor, arrow) {
            actor.set_icon_size(this._pmPanelIconSize(actor.get_icon_type(), arrow));
        }

        _pmPanelIconSize(type, arrow) {
            const scale = Math.max(1, Number(global.ui_scale) || 1);
            const maxSize = Math.max(8, Math.round(this._pmThickness() / scale));
            const configured = this.getPanelIconSize(type);
            const preferred = Number.isFinite(configured) && configured > 0 ? configured : 32;
            return arrow ? Math.min(24, Math.max(8, Math.round(maxSize * 0.55))) : Math.min(maxSize, preferred);
        }

        _pmPress(primary, event) {
            if (event.get_button() === 3) return this._pmOpenContextMenu();
            if (!this._applet_enabled || !this._draggable.inhibit)
                return PM_Clutter.EVENT_PROPAGATE;
            if (event.get_button() === 1) {
                this._clearDelayCallbacks();
                if (this._applet_context_menu.isOpen) this._applet_context_menu.close(false);
                this._pmToggleMenu(!primary);
            }
            return PM_Clutter.EVENT_STOP;
        }

        _pmGapPress(event) {
            if (event.get_button() === 3) return this._pmOpenContextMenu();
            if (event.get_button() === 1 && this._applet_enabled && !this._pmDisposed &&
                this._draggable.inhibit && this._applet_context_menu.isOpen) {
                this._clearDelayCallbacks();
                this._applet_context_menu.close(false);
                return PM_Clutter.EVENT_STOP;
            }
            return PM_Clutter.EVENT_PROPAGATE;
        }

        _pmOpenContextMenu() {
            if (!this._applet_enabled || this._pmDisposed) return PM_Clutter.EVENT_PROPAGATE;
            this._clearDelayCallbacks();
            if (this._pmIsEditing()) this._pmEditor.prepareContextMenu();
            else if (this.menu.isOpen) this.menu.close(false);
            this._pmContextRequests++;
            this._applet_context_menu.toggle();
            return PM_Clutter.EVENT_STOP;
        }

        menuEventFilter(event) {
            // A popup's modal capture can run before the click-face handlers.
            // Route right-clicks on our panel actors to the applet menu there
            // as well, so an open program menu cannot swallow the first click.
            if (!this._pmReady || !this._applet_enabled || this._pmDisposed)
                return false;
            if (this._pmEditor && this._pmEditor.filterEvent(event)) return true;
            if (event.type() === PM_Clutter.EventType.BUTTON_PRESS) {
                const source = event.get_source();
                // Capture runs before Entry/Text/Icon handlers can consume the
                // press. Reset permission without interrupting the native click.
                if (this.searchEntry && this.searchEntry.contains(source)) this._pmResetAutoScroll();
                if (event.get_button() === 1 && this.actor.contains(source) &&
                    !this._pmPrimary.contains(source) && !this._pmSecondary.contains(source) &&
                    this._pmGapPress(event) === PM_Clutter.EVENT_STOP) return true;
                if (event.get_button() === 1 && this._draggable.inhibit &&
                    (this._pmPrimary.contains(source) || this._pmSecondary.contains(source))) {
                    this._pmPress(this._pmPrimary.contains(source), event);
                    return true;
                }
                if (event.get_button() === 3 && this.actor.contains(source))
                    return this._pmOpenContextMenu();
            }
            return false;
        }

        _pmKey(primary, event) {
            const key = event.get_key_symbol();
            if ([PM_Clutter.KEY_Return, PM_Clutter.KEY_KP_Enter, PM_Clutter.KEY_space].indexOf(key) === -1)
                return PM_Clutter.EVENT_PROPAGATE;
            if (!this._applet_enabled || !this._draggable.inhibit)
                return PM_Clutter.EVENT_PROPAGATE;
            this._pmToggleMenu(!primary);
            return PM_Clutter.EVENT_STOP;
        }

        _onButtonPressEvent(actor, event) {
            if (this._pmReady && event.get_button() === 3)
                return this._pmOpenContextMenu();
            // Panel-edit dragging still goes through the native parent.
            // Left-clicks on the wide outer actor must never open the program menu.
            if (!this._pmReady || !this._draggable.inhibit)
                return super._onButtonPressEvent(actor, event);
            if (event.get_button() === 1) return this._pmGapPress(event);
            return PM_Clutter.EVENT_PROPAGATE;
        }

        on_applet_clicked(event) {
            if (!this._pmReady) return;
            const source = event && event.get_source();
            if (source && this._pmPrimary.contains(source))
                this._pmToggleMenu(false);
            else if (source && this._pmSecondary.contains(source))
                this._pmToggleMenu(true);
        }

        _onOpenStateChanged(menu, open) {
            if (!open && this._pmEditor) {
                this._pmEditor.closeModeMenu();
                this._pmEditor.modeDismissClick = false;
            }
            if (!open && this._pmSystemMenu) this._pmSystemMenu.close(false);
            if (open && this._pmReady) this._pmResetAutoScroll();
            if (!open && this._pmDrawer) this._pmDrawer.closeAll(false);
            if (!open) this._pmStopAutoScroll();
            if (this._pmReady) this._pmConfigureSessionButtons();
            if (this._pmPersonalActive) {
                // Personal contents use drawer/list metadata, never native
                // table sizing, automatic All Applications loading or Search.
                this._activeContainer = null;
                this._activeActor = null;
                this.hoveredCategory = null;
                this.hoveredApp = null;
                if (open) {
                    this._pmDrawer.prepareOpen(true);
                    this._pmFocusMenu();
                }
            } else super._onOpenStateChanged(menu, open);
            if (!this._pmReady) return;
            this._pmConfigureSessionButtons();
            if (open && this._pmIsDrawerView()) this._pmDrawer.applySearch(this.searchEntry.get_text(), true);
            this._pmFitMenuHeight();
            this._pmUpdateAutoScroll();
            this.actor.remove_style_pseudo_class("active");
            this.actor.remove_style_pseudo_class("checked");
            this._pmPrimary.change_style_pseudo_class("active", open && !this._pmPersonalActive);
            this._pmPrimary.change_style_pseudo_class("checked", open && !this._pmPersonalActive);
            this._pmSecondary.change_style_pseudo_class("active", open && this._pmPersonalActive);
            this._pmSecondary.change_style_pseudo_class("checked", open && this._pmPersonalActive);
        }

        _updateActivateOnHover() {
            // Native settings still control hover behavior, but only on the arrow.
            this._clearDelayCallbacks();
        }

        _pmEnter(personal = false) {
            if (personal && !this._pmPersonalEnabled) return PM_Clutter.EVENT_PROPAGATE;
            if (!this._pmReady || !this.activateOnHover || !this._applet_enabled || !this._draggable.inhibit || this._pmDisposed)
                return PM_Clutter.EVENT_PROPAGATE;
            this._clearDelayCallbacks();
            const button = personal ? this._pmSecondary : this._pmPrimary;
            const delay = Math.max(0, Number(this.hover_delay_ms) || 0);
            if (delay === 0) {
                this._pmOpenMenu(personal);
            } else {
                this._pmHoverTimer = PM_Mainloop.timeout_add(delay, () => {
                    this._pmHoverTimer = 0;
                    if (!this._pmDisposed && button.hover) this._pmOpenMenu(personal);
                    return false;
                });
            }
            return PM_Clutter.EVENT_PROPAGATE;
        }

        _clearDelayCallbacks() {
            if (this._pmHoverTimer > 0) PM_Mainloop.source_remove(this._pmHoverTimer);
            this._pmHoverTimer = 0;
            return PM_Clutter.EVENT_PROPAGATE;
        }

        _setAppletReactivity() {
            super._setAppletReactivity();
            if (!this._pmReady) return;
            const editing = !this._draggable.inhibit;
            if (editing && this._pmEditor && this._pmEditor.enabled) this._pmEditor.setEnabled(false);
            // Keep the native actor reactive for panel-edit events and any
            // clicks falling on its own area rather than the child faces.
            this.actor.reactive = true;
            this._pmPrimary.reactive = !editing;
            this._pmSecondary.reactive = !editing && !!this._pmPersonalEnabled;
            this._pmInnerGap.reactive = !editing && !!this._pmPersonalEnabled;
            this._pmOuterGap.reactive = !editing && !!this._pmPersonalEnabled;
            this._pmPrimary.can_focus = !editing;
            this._pmSecondary.can_focus = !editing && !!this._pmPersonalEnabled;
            if (editing) this._clearDelayCallbacks();
        }

        on_orientation_changed(newOrientation) {
            super.on_orientation_changed(newOrientation);
            this._pmUpdateLayout();
            this._pmUpdateSecondary();
        }

        on_panel_height_changed() {
            super.on_panel_height_changed();
            this._pmUpdateLayout();
            this._updateIconAndLabel();
            this._pmUpdateSecondary();
            this._pmUpdateMenuIcons();
        }

        on_panel_icon_size_changed() {
            super.on_panel_icon_size_changed();
            this._pmUpdateSecondary();
            this._pmUpdateMenuIcons();
        }

        on_panel_icon_size_changed_internal() {
            // The native hook tracks one icon type. Our two buttons may use
            // different symbolic/fullcolor sizes, so refresh both on every
            // panel notification, even if the last queried type is unchanged.
            this.on_panel_icon_size_changed();
        }

        on_applet_added_to_panel(userEnabled) {
            super.on_applet_added_to_panel(userEnabled);
            if (this._pmReady) this._pmWatchPanelIconPreview();
            this._pmUpdateLayout();
            this._pmUpdateSecondary();
            this._pmUpdateMenuIcons();
        }

        _pmCleanup() {
            if (this._pmDisposed) return;
            this._pmDisposed = true;
            this._pmClearPersonalFeedback();
            for (const [actor, signal] of this._pmPreviewSignals || []) actor.disconnect(signal);
            this._pmPreviewSignals = [];
            this._pmThemedStar = null;
            this._pmDestroyGroupedSystemMenu();
            if (this._pmShortcutSignals) {
                this._pmShortcutSignals.disconnectAllSignals();
                this._pmShortcutSignals = null;
            }
            if (PM_Main.keybindingManager)
                for (const key of ["pm-personal-menu-shortcut", "pm-editor-shortcut"])
                    PM_Main.keybindingManager.removeXletHotKey(this, key);
            if (this._pmEditor) this._pmEditor.destroy();
            this._pmEditor = null;
            if (typeof this._pmNativeMenuPosition === "function")
                this.menu._calculatePosition = this._pmNativeMenuPosition;
            this._pmNativeMenuPosition = null;
            if (this._pmIconAllocationSignal) {
                this.main_container.disconnect(this._pmIconAllocationSignal);
                this._pmIconAllocationSignal = 0;
            }
            this._pmStopAutoScroll();
            if (this._pmPersonalKeySignal) {
                this.menu.actor.disconnect(this._pmPersonalKeySignal);
                this._pmPersonalKeySignal = 0;
            }
            if (this._pmPersonal) this._pmPersonal.destroy();
            this._pmPersonal = null;
            if (this._pmDrawer) this._pmDrawer.destroy();
            this._pmDrawer = null;
            // Detached native panes still belong to the applet. Reattach them
            // for the inherited menu destruction, including hidden Search.
            if (this.right_box) {
                for (const actor of [this.searchBox, this.categoriesApplicationsBox &&
                    this.categoriesApplicationsBox.actor, this.selectedAppBox])
                    if (actor && !actor.get_parent()) this.right_box.add_actor(actor);
            }
            this._clearDelayCallbacks();
            if (this._pmScaleSignal) {
                global.disconnect(this._pmScaleSignal);
                this._pmScaleSignal = 0;
            }
            if (this._pmThemeSignal) {
                this.main_container.disconnect(this._pmThemeSignal);
                this._pmThemeSignal = 0;
            }
            if (this._pmWorkAreaSignal) {
                global.display.disconnect(this._pmWorkAreaSignal);
                this._pmWorkAreaSignal = 0;
            }
            if (this._pmPrimaryTooltip) this._pmPrimaryTooltip.destroy();
            if (this._pmSecondaryTooltip) this._pmSecondaryTooltip.destroy();
            this._pmPrimaryTooltip = null;
            this._pmSecondaryTooltip = null;
            if (this._pmSessionButtons) {
                for (const actor of this._pmSessionButtons.values()) {
                    if (actor._pmTooltip) actor._pmTooltip.destroy();
                    actor._pmTooltip = null;
                    if (!actor.get_parent()) actor.destroy();
                }
                this._pmSessionButtons.clear();
            }
        }

        on_applet_removed_from_panel(deleteConfig) {
            this._pmCleanup();
            super.on_applet_removed_from_panel(deleteConfig);
        }

        destroy() {
            this._pmCleanup();
            super.destroy();
        }
    }

    return new SuperMenuApplet();
}


/*
 * SuperMenu drawer view
 * Copyright (C) 2026 rasmarc
 * SPDX-License-Identifier: GPL-2.0-or-later
 *
 * This presentation uses Cinnamon's inline PopupSubMenu widgets. Program
 * data, search matching and session actions still come from the menu template.
 */

function _pmCopyDrawerIcon(target, source, size) {
    if (source && source.gicon) target.set_gicon(source.gicon);
    else target.set_icon_name(source && source.icon_name || "application-x-executable");
    target.set_icon_type(PM_St.IconType.FULLCOLOR);
    target.set_icon_size(size);
}

function _pmSizeDrawerArrow(item) {
    // Keep the chosen 16 px glyph budget independent of texture loading.
    // The native arrow, alignment and rotation remain Cinnamon's own.
    const size = 16 * global.ui_scale;
    if (item._triangle.width !== size) item._triangle.set_width(size);
    if (item._triangle.height !== size) item._triangle.set_height(size);
}

function _pmPrepareDrawerArrow(item) {
    item._triangle.y_expand = false;
    item._triangle.x_expand = false;
    item._triangle.set_icon_size(16);
    item._triangleBin.x_align = PM_St.Align.END;
    item._triangleBin.y_align = PM_St.Align.MIDDLE;
    _pmSizeDrawerArrow(item);
}

function _pmDrawerCompactRow(item, view) {
    // Native arrow icons expand vertically. Stop that request at the row,
    // so surplus space goes to the bottom filler rather than its heading.
    item.actor.set_y_expand(false);
    item.actor.y_align = PM_Clutter.ActorAlign.START;
    if (!item.label) return;
    item.label.clutter_text.ellipsize = PM_Pango.EllipsizeMode.END;
    _superMenuTextTooltip(item);
    // The final label column must get the available width, not its full
    // natural text width. Keep the complete string for accessibility/search.
    if (!item._triangleBin) {
        item.removeActor(item.label);
        item.addActor(item.label, { span: -1, expand: true });
        item.actor.connect("get-preferred-width", (actor, height, alloc) => {
            const limit = view.rowWidth(actor);
            alloc.min_size = Math.min(alloc.min_size, limit);
            alloc.natural_size = Math.min(alloc.natural_size, limit);
        });
    }
}

class PM_RecentFile {
    constructor(applet, info) {
        this.applet = applet;
        this.name = info.name;
        this.uri = info.uri;
        this.description = info.uri;
        const image = info.createIcon(applet.applicationIconSize);
        this.icon = { icon_name: image.icon_name, gicon: image.gicon };
        image.destroy();
        this.app = { get_id: () => "pm-recent:" + info.uri };
        this.category = ["pm-recent-files"];
        this._pmRecent = true;
        this.withMenu = false;
    }

    activate() {
        if (this.applet._pmExecutionBlocked()) return;
        try {
            PM_Gio.app_info_launch_default_for_uri(this.uri, global.create_app_launch_context());
            this.applet.menu.close();
        } catch (error) {
            PM_Main.notifyError("SuperMenu", _("Could not open the file: %s").format(String(error)));
        }
    }
}

class PM_Place {
    constructor(applet, place) {
        this.applet = applet;
        this.place = place;
        this.name = place.name;
        this.app = { get_id: () => "pm-place:" + place.id };
        const image = place.iconFactory(applet.applicationIconSize);
        this.icon = image ? { icon_name: image.icon_name, gicon: image.gicon } : { icon_name: "folder" };
        if (image) image.destroy();
        this._pmPlace = true;
        this.withMenu = false;
    }

    activate() {
        if (this.applet._pmExecutionBlocked()) return;
        try {
            this.place.launch();
            if (!this.applet._pmIsEditing()) this.applet.menu.close();
        } catch (error) {
            PM_Main.notifyError("SuperMenu", _("Could not open the place: %s").format(String(error)));
        }
    }
}

class PM_DrawerProgramItem extends PM_PopupMenu.PopupIconMenuItem {
    activate(event, keepMenu) {
        if (this.view && this.view.applet._pmExecutionBlocked()) return;
        const editing = this.view && this.view.applet._pmIsEditing();
        if (editing) this.view.closeApplicationContextMenu(false);
        // Launch normally while the editing workspace and its drawer stay open.
        super.activate(event, editing ? true : keepMenu);
    }

    _onButtonReleaseEvent(actor, event) {
        if (event.get_button() === 3) {
            if (this.withMenu === false && !this.view.applet._pmPersonalActive) return PM_Clutter.EVENT_STOP;
            this.view.applet.toggleContextMenu(this);
            return PM_Clutter.EVENT_STOP;
        }
        if (event.get_button() !== 1) return PM_Clutter.EVENT_PROPAGATE;
        return super._onButtonReleaseEvent(actor, event);
    }

    _onKeyPressEvent(actor, event) {
        const key = event.get_key_symbol();
        const state = event.get_state ? event.get_state() : 0;
        const modifiers = PM_Clutter.ModifierType || {};
        if (key === PM_Clutter.KEY_Menu ||
            (key === PM_Clutter.KEY_F10 && (state & modifiers.SHIFT_MASK)) ||
            ((key === PM_Clutter.KEY_Return || key === PM_Clutter.KEY_KP_Enter) &&
                (state & modifiers.CONTROL_MASK))) {
            if (this.withMenu === false && !this.view.applet._pmPersonalActive) return PM_Clutter.EVENT_STOP;
            this.view.applet.toggleContextMenu(this, true);
            const menu = this.view.contextMenu;
            const first = menu && menu.isOpen && menu._getMenuItems().find(item => item.actor.can_focus);
            if (first) this.view.focusActor(first.actor);
            return PM_Clutter.EVENT_STOP;
        }
        return super._onKeyPressEvent(actor, event);
    }
}

class PM_DrawerEmptyItem extends PM_PopupMenu.PopupMenuItem {
    constructor(view, header = null, text = _("No entries yet")) {
        super(text, { focusOnHover: false });
        this.view = view;
        this._pmEmpty = true;
        this._pmCategoryId = header ? header.id : null;
        this.actor.connect("key-press-event", (actor, event) => view.handleRowKey(actor, event, header));
        _pmDrawerCompactRow(this, view);
    }

    activate() {}

    _onButtonReleaseEvent(actor, event) {
        return PM_DrawerProgramItem.prototype._onButtonReleaseEvent.call(this, actor, event);
    }

    _onKeyPressEvent(actor, event) {
        return PM_DrawerProgramItem.prototype._onKeyPressEvent.call(this, actor, event);
    }
}

class PM_DrawerSeparatorItem extends PM_PopupMenu.PopupSeparatorMenuItem {
    constructor(view, entry, header) {
        super();
        this.view = view;
        this._pmSeparator = true;
        this._pmEntryId = entry.id;
        this._pmCategoryId = header.id;
        this.actor.accessible_name = "Trennstrich";
        this.actor.set_y_expand(false);
        if (!view.applet._pmIsEditing()) return;
        this._activatable = true;
        this.sensitive = false;
        this.setSensitive(true);
        this.actor.track_hover = true;
        this.focusOnHover = false;
        this.actor.set_style("min-height: 12px;");
        this.actor.connect("button-release-event", (actor, event) => this._onButtonReleaseEvent(actor, event));
        this.actor.connect("key-press-event", (actor, event) => {
            if (view.handleRowKey(actor, event, header)) return PM_Clutter.EVENT_STOP;
            return PM_DrawerProgramItem.prototype._onKeyPressEvent.call(this, actor, event);
        });
        this.actor.connect("key-focus-in", () => this.setActive(true));
        this.actor.connect("key-focus-out", () => this.setActive(false));
        this.actor.connect("notify::hover", () => this.setActive(this.actor.hover));
    }

    activate() {}

    _onButtonReleaseEvent(actor, event) {
        if (event.get_button() === 3) {
            this.view.applet.toggleContextMenu(this);
            return PM_Clutter.EVENT_STOP;
        }
        return event.get_button() === 1 ? PM_Clutter.EVENT_STOP : PM_Clutter.EVENT_PROPAGATE;
    }
}

class PM_DrawerActionItem extends PM_PopupMenu.PopupIconMenuItem {
    _onButtonReleaseEvent(actor, event) {
        if (event.get_button() !== 1) return PM_Clutter.EVENT_PROPAGATE;
        return super._onButtonReleaseEvent(actor, event);
    }
}

class PM_GridProgramItem extends PM_DrawerProgramItem {
    constructor(text, icon, type) {
        super(text, icon, type);
        this.actor.add_style_class_name("pm-grid-tile");
        // The grid owns its gaps and inset. Keep the caption's side padding
        // without adding vertical padding from regular menu rows.
        this.actor.set_style("margin-left: 0px; margin-right: 0px; padding: 0px 4px;");
        this.removeActor(this._icon);
        this.removeActor(this.label);
        const box = new PM_St.BoxLayout({ vertical: true, style_class: "pm-grid-tile-content" });
        this._icon.set_y_expand(false);
        this._icon.y_align = PM_Clutter.ActorAlign.CENTER;
        box.add(this._icon, { expand: false, x_fill: false, x_align: PM_St.Align.MIDDLE });
        this.label.add_style_class_name("pm-grid-caption");
        box.add(this.label, { expand: false, x_fill: true });
        this.addActor(box, { span: -1, expand: true });
        this.actor.accessible_name = text;
        _superMenuTextTooltip(this);
    }

    fitTile(width) {
        const node = this.actor.get_theme_node();
        const chrome = [PM_St.Side.LEFT, PM_St.Side.RIGHT].reduce((sum, side) =>
            sum + node.get_padding(side) + node.get_border_width(side), 0);
        const caption = Math.max(1, width - chrome);
        this.actor.set_width(width);
        if (this.view.iconsOnly()) {
            this.label.hide();
            this.captionLines = 0;
            return;
        }
        this.label.show();
        this.label.set_width(caption);
        const text = this.label.clutter_text;
        text.single_line_mode = true;
        text.line_wrap = false;
        this.label.set_height(-1);
        const line = this.label.get_preferred_height(-1)[1];
        text.single_line_mode = false;
        text.line_wrap = true;
        text.line_wrap_mode = PM_Pango.WrapMode.WORD_CHAR;
        text.ellipsize = PM_Pango.EllipsizeMode.END;
        text.line_alignment = PM_Pango.Alignment.CENTER;
        this.label.set_height(Math.max(1, line) * 2);
        this.captionLines = 2;
    }
}

class PM_GridCategoryItem extends PM_PopupMenu.PopupMenuItem {
    constructor(view, category) {
        const ownCategory = Array.isArray(category._pmItems);
        super(category.name, { reactive: ownCategory, hover: view.applet._pmIsEditing(), focusOnHover: false });
        this.view = view;
        this.id = category.categoryId;
        this._pmCategory = ownCategory;
        this.actor.can_focus = ownCategory && view.applet._pmIsEditing();
        this.actor.add_style_class_name("pm-grid-heading");
        // Titles share the grid inset and never acquire a drawer or arrow.
        this.actor.set_style("margin-left: 0px; margin-right: 0px; padding: 0px;");
        this.label.set_style("text-align: left;");
        _pmDrawerCompactRow(this, view);
    }

    activate() {
        if (this._pmCategory && this.view.applet._pmIsEditing())
            this.view.applet._pmEditor.selectCategory(this);
    }

    _onButtonReleaseEvent(actor, event) {
        return PM_DrawerProgramItem.prototype._onButtonReleaseEvent.call(this, actor, event);
    }

    _onKeyPressEvent(actor, event) {
        if (this.view.handleRowKey(actor, event)) return PM_Clutter.EVENT_STOP;
        return PM_DrawerProgramItem.prototype._onKeyPressEvent.call(this, actor, event);
    }
}

class PM_DrawerHeaderItem extends PM_PopupMenu.PopupSubMenuMenuItem {
    constructor(view, text, icon = null) {
        super(text);
        this.view = view;
        this.rows = [];
        this.actor.add_style_class_name("pm-drawer-header");
        _pmPrepareDrawerArrow(this);
        this.removeActor(this.label);
        this.removeActor(this._triangleBin);
        if (icon) {
            const image = new PM_St.Icon({ style_class: "popup-menu-icon" });
            _pmCopyDrawerIcon(image, icon, view.applet.categoryIconSize);
            this.addActor(image, { span: 0 });
            this.icon = image;
        }
        this.addActor(this.label, { expand: true });
        this.addActor(this._triangleBin, { expand: true, span: -1, align: PM_St.Align.END });
        this.menu._getTopMenu = () => view.applet.menu;
        const nativeOpen = this.menu.open;
        const nativeClose = this.menu.close;
        this.menu.open = animate => {
            if (this.menu.isOpen) return;
            view.beginDrawerMotion(this, true, animate);
            if (!view.animateScrollableDrawer(this, true, animate)) nativeOpen.call(this.menu, animate);
        };
        this.menu.close = animate => {
            // Also cover the native submenu keyboard handler, which calls
            // close() directly rather than the view's closeDrawer().
            if (!view.canCloseDrawer(this)) return;
            if (!this.menu.isOpen) return;
            view.beginDrawerMotion(this, false, animate);
            if (!view.animateScrollableDrawer(this, false, animate)) nativeClose.call(this.menu, animate);
        };
        this.menu.actor.connect("notify::height", () => view.drawerMotionFrame(this));
        this.menu._needsScrollbar = () => view.drawerNeedsScrollbar(this);
        this.menu.actor.set_y_expand(false);
        this.menu.actor.y_align = PM_Clutter.ActorAlign.START;
        this.menu.box.set_y_expand(false);
        this.menu.box.y_align = PM_Clutter.ActorAlign.START;
        _pmDrawerCompactRow(this, view);
        this.menu.connect("open-state-changed", (menu, open) => view.drawerStateChanged(this, open));
        this.actor.connect("motion-event", () => {
            this.setActive(true);
            return PM_Clutter.EVENT_PROPAGATE;
        });
    }

    activate() {
        if (this.view.applet._pmIsEditing()) this.view.closeApplicationContextMenu(false);
        if (this === this.view.searchDrawer) this.view.clearSearch();
        else this.view.toggleDrawer(this);
    }

    setColumnWidths() {
        // Header labels must not inherit columns from long program/action rows.
        this._columnWidths = null;
    }

    _getPreferredWidth(actor, height, allocation) {
        super._getPreferredWidth(actor, height, allocation);
        if (!this.view) return;
        // A viewport may become narrower after changing view/editing state.
        // Old label allocations must never force this row past its right edge.
        const limit = this.view.rowWidth(actor);
        allocation.min_size = Math.min(allocation.min_size, limit);
        allocation.natural_size = Math.min(allocation.natural_size, limit);
    }

    _allocate(actor, box, flags) {
        // Give the native allocator a label column that leaves the arrow's
        // natural width available, even on the first frame after rebuilding.
        const arrow = this._triangleBin.get_preferred_width(-1)[1];
        this._columnWidths = [Math.max(0, box.x2 - box.x1 - arrow - (this._spacing || 0)), arrow];
        try {
            super._allocate(actor, box, flags);
        } finally {
            // Allocation columns are temporary. Keeping them made the native
            // preferred-width query turn yesterday's width into today's minimum.
            this._columnWidths = null;
        }
    }

    _subMenuOpenStateChanged() {
        this.actor.remove_style_pseudo_class("open");
    }

    _onButtonReleaseEvent(actor, event) {
        if (event.get_button() === 3) {
            this.view.applet.toggleContextMenu(this);
            return PM_Clutter.EVENT_STOP;
        }
        if (event.get_button() !== 1) return PM_Clutter.EVENT_PROPAGATE;
        this.activate();
        this.setActive(false);
        this.actor.remove_style_pseudo_class("hover");
        return PM_Clutter.EVENT_STOP;
    }

    _onKeyPressEvent(actor, event) {
        const key = event.get_key_symbol();
        const state = event.get_state ? event.get_state() : 0;
        if ((this._pmProgramCategory || this._pmCategory) && (key === PM_Clutter.KEY_Menu ||
            key === PM_Clutter.KEY_F10 && (state & PM_Clutter.ModifierType.SHIFT_MASK) ||
            (key === PM_Clutter.KEY_Return || key === PM_Clutter.KEY_KP_Enter) &&
                (state & PM_Clutter.ModifierType.CONTROL_MASK))) {
            this.view.applet.toggleContextMenu(this, true);
            const menu = this.view.contextMenu;
            const first = menu && menu.isOpen && menu._getMenuItems().find(item => item.actor.can_focus);
            if (first) this.view.focusActor(first.actor);
            return PM_Clutter.EVENT_STOP;
        }
        const rtl = this.actor.get_direction() === PM_St.TextDirection.RTL;
        const openKey = rtl ? PM_Clutter.KEY_Left : PM_Clutter.KEY_Right;
        const closeKey = rtl ? PM_Clutter.KEY_Right : PM_Clutter.KEY_Left;
        if (key === openKey) {
            this.view.openDrawer(this);
            const row = this.rows.find(item => item.actor.visible && item.actor.can_focus);
            if (row && this.menu.isOpen) this.view.focusActor(row.actor);
            else if (row) this.view._pendingFocusHeader = this;
            return PM_Clutter.EVENT_STOP;
        }
        if (key === closeKey && this.menu.isOpen) {
            this.view.closeDrawer(this);
            return PM_Clutter.EVENT_STOP;
        }
        if (this.view.handleRowKey(this.actor, event)) return PM_Clutter.EVENT_STOP;
        return PM_PopupMenu.PopupBaseMenuItem.prototype._onKeyPressEvent.call(this, actor, event);
    }
}

class PM_DrawerView {
    constructor(applet) {
        this.applet = applet;
        this.destroyed = false;
        this.categories = [];
        this.flatRows = [];
        this.gridGroups = [];
        this.gridLines = [];
        this.resultRows = [];
        this.systemRows = new Map();
        this._searchQuery = null;
        this.activeHeader = null;
        this.contextMenu = null;
        this.contextRow = null;
        this._pendingContext = null;
        this._contextNeedsRefresh = false;
        this._contextActionId = 0;
        this._systemEnabled = false;
        this.actor = new PM_St.BoxLayout({ vertical: true, y_expand: false,
            y_align: PM_Clutter.ActorAlign.START, style_class: "pm-drawer-root" });
        this.scrollView = new PM_St.ScrollView({
            style_class: "pm-drawer-scrollbox", clip_to_allocation: true,
            hscrollbar_policy: PM_St.PolicyType.NEVER,
            vscrollbar_policy: PM_St.PolicyType.AUTOMATIC
        });
        this.scrollView.set_auto_scrolling(false);
        this.programBox = new PM_St.BoxLayout({ vertical: true, y_expand: false });
        this.categorySection = new PM_PopupMenu.PopupMenuSection();
        this.resultSection = new PM_PopupMenu.PopupMenuSection();
        this.searchDrawer = new PM_DrawerHeaderItem(this, "Suche", { icon_name: "edit-find-symbolic" });
        this.resultSection.addMenuItem(this.searchDrawer);
        for (const section of [this.categorySection, this.resultSection]) {
            section.actor.set_y_expand(false);
            section.actor.y_align = PM_Clutter.ActorAlign.START;
            this.programBox.add(section.actor, { expand: false, x_fill: true,
                y_fill: false, y_align: PM_St.Align.START });
        }
        this.scrollView.add_actor(this.programBox);
        this.scrollView.set_mouse_scrolling(true);
        this.actor.add(this.scrollView, { expand: true, x_fill: true, y_fill: true });

        this.systemSection = new PM_PopupMenu.PopupMenuSection();
        this.systemSection.actor.set_y_expand(false);
        this.systemSection.actor.y_align = PM_Clutter.ActorAlign.START;
        this.systemSection.actor.add_style_class_name("pm-drawer-system-section");
        this.systemDrawer = new PM_DrawerHeaderItem(this, _("Quit"), {
            gicon: new PM_Gio.FileIcon({ file: PM_Gio.file_new_for_path(applet._pmSourcePath + "/system-actions.svg") })
        });
        this.systemSection.addMenuItem(this.systemDrawer);
        // All drawer headings share one viewport, including its scrollbar
        // allowance. A separate footer outside it made Beenden look wider.
        this.programBox.add(this.systemSection.actor, { expand: false, x_fill: true,
            y_fill: false, y_align: PM_St.Align.START });
        // Give unused height an explicit owner. An expanding spacer propagates
        // expansion through the ScrollView/BoxLayout chain, whose legacy child
        // packing may center otherwise compact sections in their larger cells.
        this.bottomSpace = new PM_St.BoxLayout({ reactive: false, y_expand: false, height: 0 });
        this.programBox.add(this.bottomSpace, {
            expand: false, x_fill: true, y_fill: true, y_align: PM_St.Align.START
        });
        // Native scrollbar dragging releases the popup's event grab temporarily.
        const scrollbar = this.scrollView.get_vscroll_bar();
        this._scrollStart = scrollbar.connect("scroll-start", () => { applet.menu.passEvents = true; });
        this._scrollStop = scrollbar.connect("scroll-stop", () => { applet.menu.passEvents = false; });
        this.refreshPrograms();
        this.refreshSystemActions();
    }

    _makeProgramRow(button, header = null) {
        const appId = button.app.get_id();
        const Item = this.isGrid() ? PM_GridProgramItem : PM_DrawerProgramItem;
        const row = new Item(button.name,
            "application-x-executable", PM_St.IconType.FULLCOLOR);
        _pmCopyDrawerIcon(row._icon, button.icon, this.programIconSize());
        row.actor.add_style_class_name("pm-drawer-application");
        row.appId = appId;
        row._pmEntryId = button._pmEntryId || null;
        row._pmRecent = button._pmRecent === true;
        row._pmPlace = button._pmPlace === true;
        row._pmCategoryId = header && header.id;
        row.view = this;
        row.withMenu = button.withMenu !== false;
        row.actor.accessible_name = button.name;
        if (this.iconsOnly() && !this.isGrid()) {
            // Keep the label alive for actions/accessibility, but remove it
            // from the native column measurement along with the icon column.
            row.removeActor(row._icon);
            row.removeActor(row.label);
            const box = new PM_St.BoxLayout({ vertical: true });
            box.add(row._icon, { expand: false, x_fill: false, x_align: PM_St.Align.MIDDLE });
            box.add(row.label);
            row.label.hide();
            row.addActor(box, { span: -1, expand: true });
        }
        if (!this.isGrid() && !this.iconsOnly()) _pmDrawerCompactRow(row, this);
        _superMenuTextTooltip(row);
        row.connect("activate", () => {
            if (this.destroyed || !this.applet.menu.isOpen) return;
            const original = this._buttonForRow(row);
            if (original) original.activate();
        });
        row.actor.connect("key-press-event", (actor, event) => this.handleRowKey(actor, event, header));
        return row;
    }

    _buttonForRow(row) {
        return [...(this.applet._applicationsButtons || []), ...(this.placesEntries || []),
            ...(this.recentEntries || [])].find(item => row._pmEntryId ?
            item._pmEntryId === row._pmEntryId : item.app.get_id() === row.appId);
    }

    addRecentSection(expanded) {
        this.recentEntries = [];
        this.recentHeader = null;
        if (!this.applet._pmPersonalActive || !this.applet._pmPersonalRecent ||
            this.applet._pmPersonalIconsOnlyConfigured) return;
        const privacy = this.applet.privacy_settings;
        const allowed = privacy && privacy.get_boolean("remember-recent-files");
        const infos = allowed && this.applet.RecentManager && this.applet.RecentManager._infosByTimestamp || [];
        const seen = new Set();
        this.recentEntries = infos.filter(info => info && typeof info.uri === "string" &&
            typeof info.name === "string" && !info.name.startsWith(".") &&
            !seen.has(info.uri) && seen.add(info.uri)).map(info => new PM_RecentFile(this.applet, info));
        const category = { categoryId: "pm-recent-files", name: _("Recently used"),
            icon: { icon_name: "document-open-recent-symbolic" } };
        const empty = allowed ? _("No recent files") : _("File history is disabled");
        this.recentHeader = this.addSupplementSection(category, this.recentEntries, expanded, empty);
        if (this.recentHeader) this.recentHeader._pmRecent = true;
    }

    addPlacesSection(expanded) {
        this.placesEntries = [];
        this.placesHeader = null;
        if (!this.applet._pmPersonalActive || !this.applet._pmPersonalPlaces ||
            this.applet._pmPersonalIconsOnlyConfigured) return;
        this.placesEntries = this.applet._pmSelectedPlaces().map(place => new PM_Place(this.applet, place));
        this.placesHeader = this.addSupplementSection({ categoryId: "pm-places", name: _("Places"),
            icon: { icon_name: "folder-symbolic" } }, this.placesEntries, expanded, _("No places selected or available"));
        if (this.placesHeader) this.placesHeader._pmPlace = true;
    }

    addSupplementSection(category, entries, expanded, empty) {
        if (this.isGrid()) {
            this.addGridGroup(category, entries, false);
            if (!entries.length) this.gridGroups[this.gridGroups.length - 1].section
                .addMenuItem(this._makeMessageRow(empty));
            return null;
        }
        const header = new PM_DrawerHeaderItem(this, category.name, category.icon);
        header.id = category.categoryId;
        header._pmSupplement = true;
        header.actor.add_style_class_name("pm-supplement-header");
        header.actor.accessible_name = category.name;
        for (const button of entries) {
            const row = this._makeProgramRow(button, header);
            header.menu.addMenuItem(row);
            header.rows.push(row);
        }
        if (!header.rows.length) header.menu.addMenuItem(this._makeMessageRow(empty));
        this.categorySection.addMenuItem(header);
        this.categories.push({ id: header.id, header });
        if (expanded.has(header.id)) header.menu.open(false);
        return header;
    }

    _makeMessageRow(text) {
        const row = new PM_PopupMenu.PopupMenuItem(text, { reactive: false });
        row.actor.accessible_name = text;
        row.label.clutter_text.single_line_mode = true;
        row.label.clutter_text.line_wrap = false;
        _pmDrawerCompactRow(row, this);
        return row;
    }

    toggleApplicationContextMenu(button) {
        if (this.destroyed || !this.applet.menu.isOpen || !button || button.withMenu === false) return;
        if (this.applet._pmPersonalActive) {
            this.applet.toggleContextMenu(button);
            return;
        }
        const appId = button.appId || (button.app && button.app.get_id());
        const entryId = button._pmEntryId;
        const rows = this._searchQuery ? this.resultRows :
            this.isFlat() ? this.flatRows : this.categories.flatMap(item => item.header.rows);
        const row = button.view === this ? button : rows.find(item =>
            (entryId ? item._pmEntryId === entryId : item.appId === appId) && item.actor.is_mapped());
        const original = row && this._buttonForRow(row);
        if (!row || !row.actor.is_mapped() || !original || typeof original.populateMenu !== "function") return;
        this.toggleInlineContextMenu(row, menu => {
            // Native application population and handlers remain untouched.
            original.populateMenu(menu);
            this.applet._pmFilterApplicationContextMenu(menu, original, row._pmCategoryId);
        });
    }

    toggleInlineContextMenu(row, populate, editorActions = false) {
        if (this.destroyed || !this.applet.menu.isOpen || !row || !row.actor.is_mapped()) return;
        this.applet._pmResetAutoScroll();
        if (this.contextMenu && this.contextMenu.isOpen && this.contextRow === row &&
            this.contextMenu._pmEditorActions === editorActions) {
            this.closeApplicationContextMenu(editorActions);
            return;
        }
        // Read the input-time hint state before opening or switching animations.
        if (editorActions) this.applet._pmEditor.frameHintActionsOpening();
        if (editorActions && this.contextMenu && this.contextMenu._pmEditorActions &&
            (this.contextMenu.isOpen || this.contextMenu._pmAnimating)) {
            this.closeApplicationContextMenu(false, false, { row, populate, editorActions });
            return;
        }
        this.closeApplicationContextMenu(false, true);
        if (!this.contextMenu) {
            const menu = new PM_PopupMenu.PopupSubMenu(null);
            this.watchInlineMotion(menu);
            menu._needsScrollbar = () => false;
            menu._getTopMenu = () => this.applet.menu;
            menu.actor.set_style_class_name("appmenu-context-menu");
            menu.connect("open-state-changed", (item, open) => {
                if (this.destroyed) return;
                this.applet._activeContextMenuParent = open ? this.contextRow : null;
                this.applet._activeContextMenuItem = null;
                if (!open) {
                    for (const child of this.contextItems().reverse()) if (child.menu) child.menu.close(false);
                    this.contextRow = null;
                    menu.sourceActor = null;
                }
                this.syncContextLayout();
                if (!open) {
                    const next = this._pendingContext;
                    this._pendingContext = null;
                    if (this._contextNeedsRefresh && !this._rebuilding && !this._closingAll)
                        this.refreshPrograms();
                    const row = next && this.resolveContextRow(next.row);
                    if (next && this.applet._pmIsEditing() && this.applet.menu.isOpen &&
                        row && row.actor.is_mapped())
                        this.toggleInlineContextMenu(row, next.populate, next.editorActions);
                }
            });
            this.contextMenu = menu;
        }
        const menu = this.contextMenu;
        menu.removeAll();
        menu._pmEditorActions = editorActions;
        this.contextRow = row;
        menu.sourceActor = row.actor;
        const anchor = row._pmGridLine || row.actor;
        const parent = anchor.get_parent();
        parent.insert_child_at_index(menu.actor, parent.get_children().indexOf(anchor) + 1);
        populate(menu, row);
        this.prepareContextItems(menu);
        if (this.applet._pmIsEditing()) this.applet._pmEditor.updateHoverPolicy();
        menu.open(editorActions && this.applet.enableAnimation === true);
        this.syncContextLayout();
        if (editorActions) this.applet._pmEditor.focusActor(row.actor);
        else if (menu.firstMenuItem) menu.firstMenuItem.actor.grab_key_focus();
    }

    categoryViews() {
        // Resolve current actors on every call: refreshes replace them while
        // the category IDs and the editor's selection remain unchanged.
        const views = new Map();
        for (const category of this.applet._categoryButtons || []) {
            if (category.categoryId != null)
                views.set(category.categoryId, { id: category.categoryId,
                    heading: null, rows: [], scrollView: null });
        }
        for (const row of this.flatRows) {
            const category = views.get(row._pmCategoryId);
            if (category) category.rows.push(row);
        }
        for (const { id, header } of this.categories)
            views.set(id, { id, heading: header, rows: header.rows, scrollView: header.menu.actor });
        for (const group of this.gridGroups) {
            if (group.id != null)
                views.set(group.id, { id: group.id, heading: group.heading,
                    rows: group.empty ? [...group.rows, group.empty] : group.rows, scrollView: null });
        }
        return [...views.values()];
    }

    categoryView(id) {
        return this.categoryViews().find(category => category.id === id);
    }

    itemRows() {
        const rows = [...this.flatRows];
        for (const category of this.categoryViews()) {
            const heading = category.heading;
            // Static grid titles remain noninteractive in this refactor.
            if (heading && (heading._pmCategory || heading._pmSupplement)) rows.push(heading);
            rows.push(...category.rows);
        }
        if (this.emptyItem) rows.push(this.emptyItem);
        return [...new Set(rows)];
    }

    findItemRow(reference) {
        if (reference.type === "category") {
            const category = this.categoryView(reference.id);
            return category && category.heading && category.heading._pmCategory ? category.heading : undefined;
        }
        if (reference.type === "empty")
            return this.itemRows().find(row => row._pmEmpty && row._pmCategoryId === reference.id);
        if (reference.id == null) return undefined;
        return this.itemRows().find(row => row._pmEntryId === reference.id);
    }

    openCategory(id) {
        if (this.isFlat()) return;
        const category = this.categoryView(id);
        if (category && category.scrollView && !category.heading.menu.isOpen)
            this.openDrawer(category.heading);
    }

    captureScrollPositions() {
        return [[null, this.scrollView.get_vscroll_bar().get_adjustment().get_value()],
            ...this.categoryViews().filter(category => category.scrollView).map(category => [category.id,
                category.scrollView.get_vscroll_bar().get_adjustment().get_value()])];
    }

    restoreScrollPositions(positions) {
        for (const [id, value] of positions) {
            const category = id !== null && this.categoryView(id);
            const actor = id === null ? this.scrollView : category && category.scrollView;
            if (!actor) continue;
            const adjustment = actor.get_vscroll_bar().get_adjustment();
            adjustment.set_value(Math.max(adjustment.lower,
                Math.min(Math.max(adjustment.lower, adjustment.upper - adjustment.page_size), value)));
        }
    }

    resolveContextRow(row) {
        if (!row.actor.is_finalized() && row.actor.is_mapped()) return row;
        return this.findItemRow(row._pmCategory ? { type: "category", id: row.id } :
            row._pmEmpty ? { type: "empty", id: row._pmCategoryId } :
                { type: "entry", id: row._pmEntryId });
    }

    prepareContextItems(menu) {
        for (const item of menu._getMenuItems()) {
            _superMenuTextTooltip(item);
            // Disabled labels still participate in the menu's width request.
            if (item.label) _pmDrawerCompactRow(item, this);
            if (!item.actor.can_focus) continue;
            if (item.menu) {
                this.watchInlineMotion(item.menu);
                item.menu._getTopMenu = () => this.applet.menu;
                item.menu._needsScrollbar = () => false;
                item.menu.connect("open-state-changed", () => {
                    if (this.destroyed) return;
                    this.syncContextLayout();
                });
                this.prepareContextItems(item.menu);
                item.actor.connect("key-press-event", (actor, event) => this.handleContextKey(actor, event));
                continue;
            }
            const nativeActivate = item.activate;
            item.activate = event => {
                // Secondary clicks open editor lists; choosing an action is
                // primary-click or keyboard only, including copy/remove.
                if (this.contextMenu._pmEditorActions && event && event.get_button &&
                    (!event.type || event.type() === PM_Clutter.EventType.BUTTON_RELEASE) && event.get_button() !== 1)
                    return false;
                return this.queueContextAction(item, nativeActivate);
            };
            item.actor.connect("key-press-event", (actor, event) => this.handleContextKey(actor, event));
        }
    }

    contextItems(menu = this.contextMenu, visibleOnly = false) {
        if (!menu) return [];
        return menu._getMenuItems().flatMap(item => [item, ...(item.menu && (!visibleOnly || item.menu.isOpen) ?
            this.contextItems(item.menu, visibleOnly) : [])]);
    }

    watchInlineMotion(menu) {
        if (menu._pmMotionWatched) return;
        menu._pmMotionWatched = true;
        const open = menu.open, close = menu.close;
        menu.open = animate => {
            if (menu.isOpen) return;
            menu.actor.remove_all_transitions();
            menu.actor.set_height(-1);
            menu._pmAnimating = animate === true && PM_Main.wm.desktop_effects_menus;
            open.call(menu, animate);
        };
        menu.close = animate => {
            if (!menu.isOpen && menu._pmAnimating && animate === true) return;
            const closing = !menu.isOpen && menu._pmAnimating;
            menu.actor.remove_all_transitions();
            menu._pmAnimating = animate === true && PM_Main.wm.desktop_effects_menus && menu.isOpen;
            if (closing) {
                // Native close() returns once isOpen=false, even if its old
                // animation was cancelled by a rebuild or parent close.
                menu.actor.hide();
                if (menu._arrow) menu._arrow.rotation_angle_z = 0;
                menu.emit("open-state-changed", false);
            } else close.call(menu, animate);
            if (!menu._pmAnimating && !menu.actor.is_finalized()) menu.actor.set_height(-1);
        };
        menu.actor.connect("notify::height", () => {
            if (menu._pmAnimating) this.syncContextLayout();
        });
        menu.connect("open-state-changed", (item, open) => {
            menu._pmAnimating = false;
            this.syncContextLayout();
            if (!open && menu._pmAfterClose) {
                const complete = menu._pmAfterClose;
                menu._pmAfterClose = null;
                menu._pmCancelClose = null;
                if (!this.destroyed && !this._rebuilding) complete();
            }
        });
    }

    syncContextLayout() {
        if (this.destroyed || this._rebuilding || this.applet._pmFitting) return;
        this.applet._pmFitMenuHeight();
        const root = this.applet.menu;
        // Commit size and the panel anchor within the same input dispatch.
        // Waiting for PopupMenu's allocation-changed handler paints the child
        // below the old frame once, then moves the complete popup upwards.
        if (root.isOpen && !root.animating && typeof root._calculatePosition === "function") {
            root.actor.set_position(...root._calculatePosition());
            root.actor.get_allocation_box();
        }
        this.scrollContextIntoView();
    }

    scrollContextIntoView() {
        const menu = this.contextMenu;
        if (!menu || !menu.isOpen || !this.contextRow) return;
        const viewport = this.getScrollView();
        // Use the table's native routine for the entire context menu. Its
        // allocation queries force layout before computing the scroll target;
        // transformed positions alone can still describe the closed popup.
        // Unfolded personal drawers scroll as one list. Their local action
        // allocation omits the headings and drawer bodies above it, just as
        // grid actions omit their enclosing group. Empty categories in a flat
        // list also have a nested body. Use viewport coordinates in every flat view.
        const nested = this.isFlat() || this.applet._pmPersonalActive && this.isInline();
        if (!nested) this.applet._scrollToButton(menu, viewport);
        else {
            this.applet._scrollToButton({ actor: { get_allocation_box: () => {
                menu.actor.get_allocation_box();
                const [, menuTop] = menu.actor.get_transformed_position();
                const [, viewTop] = viewport.get_transformed_position();
                const [, height] = menu.actor.get_transformed_size();
                const top = menuTop - viewTop + viewport.get_vscroll_bar().get_adjustment().get_value();
                return { x1: 0, x2: this.fixedWidth, y1: top, y2: top + height };
            } } }, viewport);
        }
    }

    queueContextAction(item, nativeActivate) {
        if (this.destroyed || this._contextActionId || !this.contextMenu.isOpen) return false;
        const row = this.contextRow;
        // Finish Clutter's button/key dispatch before the native action
        // closes popups, changes focus, resets search or reloads launchers.
        // Do not retain the event's native boxed data beyond its lifetime.
        this._contextActionId = PM_Mainloop.idle_add(() => {
            this._contextActionId = 0;
            if (this.destroyed || !this.contextMenu.isOpen || this.contextRow !== row) return false;
            this.lastContextAction = item._action;
            this.contextActionError = null;
            if (typeof global.log === "function")
                global.log("SuperMenu " + this.applet._pmDebugVersion + ": context action " +
                    item._action + " for " + row.appId);
            try {
                nativeActivate.call(item);
            } catch (error) {
                this.contextActionError = String(error);
                global.logError(error, "SuperMenu: application context action");
                this.closeApplicationContextMenu(true);
            }
            return false;
        });
        return false;
    }

    closeApplicationContextMenu(restoreFocus = false, detach = false, next = null) {
        this._pendingContext = next;
        if (this._contextActionId) {
            PM_Mainloop.source_remove(this._contextActionId);
            this._contextActionId = 0;
        }
        if (!this.contextMenu) return;
        if (this.applet._pmEditor) {
            this.applet._pmEditor.input = null;
            this.applet._pmEditor.clearCopyFeedback();
        }
        const row = this.contextRow;
        const menu = this.contextMenu;
        const animate = !detach && !this.destroyed && !this._rebuilding && !this._closingAll &&
            this.applet.menu.isOpen && this.applet._pmIsEditing() && menu._pmEditorActions &&
            this.applet.enableAnimation === true;
        const focused = global.stage.get_key_focus();
        if (focused && menu.actor.contains(focused) && !this.destroyed) {
            if (restoreFocus && row && row.actor.is_mapped()) row.actor.grab_key_focus();
            else this.applet._pmFocusMenu();
        }
        for (const item of this.contextItems().reverse()) if (item.menu) {
            const cancel = item.menu._pmCancelClose;
            item.menu._pmAfterClose = null;
            item.menu._pmCancelClose = null;
            if (cancel && !this._rebuilding && !this.destroyed) cancel();
            if (!animate) item.menu.close(false);
        }
        menu.close(animate);
        if (!animate && !menu.isOpen) {
            menu.actor.hide();
            menu.actor.set_height(-1);
        }
        const parent = menu.actor.get_parent();
        // Like the original table menu, keep the hidden actor attached while
        // closing. Only detach before rebuilding/reparenting/destroying rows.
        if (detach && parent) parent.remove_child(menu.actor);
        if (!menu._pmAnimating && !menu.isOpen) {
            menu.sourceActor = null;
            this.contextRow = null;
        }
        if (restoreFocus && row && !row.actor.is_finalized()) this.focusActor(row.actor);
        if (!this.destroyed) this.applet._pmFitMenuHeight();
    }

    handleContextKey(actor, event) {
        const key = event.get_key_symbol();
        if (key === PM_Clutter.KEY_Menu || (key === PM_Clutter.KEY_F10 && event.get_state &&
            (event.get_state() & PM_Clutter.ModifierType.SHIFT_MASK))) {
            this.closeApplicationContextMenu(true);
            return PM_Clutter.EVENT_STOP;
        }
        const closeKey = actor.get_direction() === PM_St.TextDirection.RTL ? PM_Clutter.KEY_Right : PM_Clutter.KEY_Left;
        if (key === PM_Clutter.KEY_Escape || key === closeKey) {
            if (!this.closeContextLevel(actor)) this.closeApplicationContextMenu(true);
            return PM_Clutter.EVENT_STOP;
        }
        return this.handleRowKey(actor, event);
    }

    closeContextLevel(actor) {
        const item = this.contextItems().reverse().find(item => item.menu && item.menu.isOpen &&
            (item.menu.actor.contains(actor) || item.actor.contains(actor)));
        if (!item) return false;
        if (this._contextActionId) PM_Mainloop.source_remove(this._contextActionId);
        this._contextActionId = 0;
        this.focusActor(item.actor);
        item.menu.close(this.applet.enableAnimation === true);
        return true;
    }

    refreshPrograms(preserveEditorActions = false) {
        if (this.destroyed) return;
        if (this.applet._pmEditor) this.applet._pmEditor.closeModeMenu();
        this._pendingContext = null;
        const source = preserveEditorActions && this.contextMenu && this.contextMenu.isOpen &&
            this.contextMenu._pmEditorActions && this.contextRow;
        const retained = source && { category: source._pmCategory === true,
            id: source._pmCategory ? source.id : source._pmEntryId };
        const adjustment = this.getScrollView().get_vscroll_bar().get_adjustment();
        const scroll = adjustment.get_value();
        this._rebuilding = true;
        this._pendingHeader = null;
        this._pendingFocusHeader = null;
        this.invalidateWidth();
        if (retained) {
            this.applet._pmEditor.clearCopyFeedback();
            this.applet._pmFocusMenu();
            const parent = this.contextMenu.actor.get_parent();
            if (parent) parent.remove_child(this.contextMenu.actor);
            this.contextRow = null;
            this.contextMenu.sourceActor = null;
        } else this.closeApplicationContextMenu(false, true);
        const expanded = new Set(this.categories.filter(item => item.header.menu.isOpen).map(item => item.id));
        const activeId = this.activeHeader ? this.activeHeader.id : undefined;
        this.activeHeader = null;
        const query = this.applet.searchEntry.get_text();
        const focused = global.stage.get_key_focus();
        const focusInPrograms = focused && (this.categorySection.actor.contains(focused) ||
            this.resultSection.actor.contains(focused));
        if (focusInPrograms && this.applet.menu.isOpen && this.applet._pmIsDrawerView())
            this.applet._pmFocusMenu();
        this.clearGrid();
        this.categorySection.removeAll();
        this.categories = [];
        this.flatRows = [];
        const programs = this.applet._applicationsButtons || [];
        const alphabetical = this.isFlat() && this.applet._pmPersonalSort === "alphabetical";
        for (const category of alphabetical ? [{ categoryId: null }] : this.applet._categoryButtons || []) {
            const matches = programs.filter(button => category.categoryId == null ||
                button.category.includes(category.categoryId));
            if (alphabetical) matches.sort((left, right) => left.name.localeCompare(right.name,
                undefined, { numeric: true, sensitivity: "base" }));
            const emptyCategory = matches.length === 0 && Array.isArray(category._pmItems);
            if (matches.length === 0 && !emptyCategory) continue;
            if (emptyCategory && this.isFlat() && !this.isGrid() && !this.applet._pmIsEditing()) continue;
            if (this.isGrid()) {
                this.addGridGroup(category, matches, alphabetical);
                continue;
            }
            if (this.isFlat() && !emptyCategory) {
                if (this.flatRows.length)
                    this.categorySection.addMenuItem(new PM_PopupMenu.PopupSeparatorMenuItem());
                for (const button of matches) {
                    const row = this._makeProgramRow(button);
                    row._pmCategoryId = alphabetical ? button.category[0] : category.categoryId;
                    this.categorySection.addMenuItem(row);
                    this.flatRows.push(row);
                }
                continue;
            }
            const header = new PM_DrawerHeaderItem(this, category.name, category.icon);
            header.id = category.categoryId;
            header._pmCategory = true;
            header._pmEditableEmpty = emptyCategory;
            if (!this.applet._pmPersonalActive && category.categoryId != null &&
                !["recent", "favorite"].includes(category.categoryId)) {
                header._pmProgramCategory = true;
                header.populateMenu = menu => this.applet._pmEnsurePersonalMenu().addCategoryContextAction(menu, category);
            }
            const available = new Map(matches.map(button => [button._pmEntryId, button]));
            const items = this.applet._pmPersonalActive && category._pmItems || matches;
            let pending = null, hasProgram = false;
            for (const item of items) {
                if (item.type === "separator") {
                    if (hasProgram && !pending) pending = item;
                    continue;
                }
                const button = category._pmItems ? available.get(item.id) : item;
                if (!button) continue;
                if (pending) {
                    const separator = new PM_DrawerSeparatorItem(this, pending, header);
                    header.menu.addMenuItem(separator);
                    header.rows.push(separator);
                    pending = null;
                }
                const row = this._makeProgramRow(button, header);
                header.menu.addMenuItem(row);
                header.rows.push(row);
                hasProgram = true;
            }
            if (emptyCategory) {
                const unavailable = category._pmItems.some(item => item.type !== "separator");
                const empty = new PM_DrawerEmptyItem(this, header,
                    unavailable ? _("No available entries") : _("No entries yet"));
                header.menu.addMenuItem(empty);
                header.rows.push(empty);
            }
            this.categorySection.addMenuItem(header);
            this.categories.push({ id: category.categoryId, header });
            if (activeId === category.categoryId) this.activeHeader = header;
            if (expanded.has(category.categoryId) || this.isLocked(header)) header.menu.open(false);
        }
        this.emptyItem = null;
        if (this.categories.length === 0 && this.flatRows.length === 0 && this.gridGroups.length === 0) {
            this.emptyItem = this.applet._pmPersonalActive ? new PM_DrawerEmptyItem(this) :
                new PM_PopupMenu.PopupMenuItem(_("No applications available"), { reactive: false });
            this.categorySection.addMenuItem(this.emptyItem);
        }
        this.addPlacesSection(expanded);
        this.addRecentSection(expanded);
        if (this.emptyItem && this.applet._pmPersonalActive && !this.applet._pmIsEditing() &&
            (this.placesHeader || this.recentHeader || this.gridGroups.some(group =>
                ["pm-places", "pm-recent-files"].includes(group.id))))
            this.emptyItem.actor.hide();
        for (const header of [this.placesHeader, this.recentHeader])
            if (header && activeId === header.id && header.menu.isOpen) this.activeHeader = header;
        this._searchQuery = retained ? "" : null;
        this._rebuilding = false;
        // Closing an old inline context may have measured the previous rows
        // already. The new actors need their own first layout immediately.
        this.invalidateWidth();
        this.systemDrawer.icon.set_icon_size(this.applet.categoryIconSize);
        for (const row of this.systemRows.values()) row._icon.set_icon_size(this.applet.applicationIconSize);
        this.applySearch(query);
        if (retained) {
            this._updateCategoryVisibility();
            // Build/reflow the fresh grid before reattaching the still-open
            // action popup. Its callbacks must reference fresh row actors.
            this.fitWidth();
            const row = this.findItemRow({ type: retained.category ? "category" : "entry", id: retained.id });
            if (row) {
                const menu = this.contextMenu;
                this.contextRow = row;
                menu.sourceActor = row.actor;
                menu.removeAll();
                const anchor = row._pmGridLine || row.actor, parent = anchor.get_parent();
                parent.insert_child_at_index(menu.actor, parent.get_children().indexOf(anchor) + 1);
                this.applet._pmEditor.populateActions(menu, row);
                this.prepareContextItems(menu);
                this.applet._activeContextMenuParent = row;
                this.applet._activeContextMenuItem = null;
                adjustment.set_value(scroll);
                this.syncContextLayout();
            } else this.closeApplicationContextMenu(false, true);
        }
        if (this.applet._pmEditor) this.applet._pmEditor.refreshSelection();
        if (this.applet._pmEditor) this.applet._pmEditor.publishCategories();
        this._contextNeedsRefresh = false;
    }

    updateIconSizes() {
        if (this.destroyed) return;
        for (const { header } of this.categories) {
            if (header.icon) header.icon.set_icon_size(this.applet.categoryIconSize);
            for (const row of header.rows) if (row._icon) row._icon.set_icon_size(this.applet.applicationIconSize);
        }
        for (const row of this.resultRows) row._icon.set_icon_size(this.applet.applicationIconSize);
        for (const row of this.flatRows) row._icon.set_icon_size(this.programIconSize());
        this.searchDrawer.icon.set_icon_size(this.applet.categoryIconSize);
        this.systemDrawer.icon.set_icon_size(this.applet.categoryIconSize);
        for (const row of this.systemRows.values()) row._icon.set_icon_size(this.applet.applicationIconSize);
        this.invalidateWidth();
    }

    _headingHeight(header) {
        // Do not inherit a GenericContainer's previous preferred-height cache
        // after resizing icons. Match the explicit row budget used by the table.
        _pmSizeDrawerArrow(header);
        const icon = this.applet.categoryIconSize * global.ui_scale;
        const label = header.label.get_preferred_height(this.rowWidth(header.actor))[1];
        const arrow = header._triangle ? header._triangle.get_preferred_height(-1)[1] : 0;
        const height = Math.ceil(Math.max(icon, label, arrow) + _superMenuVerticalChrome(header.actor));
        if (header.actor.height !== height) header.actor.set_height(height);
        return height;
    }

    prepareSearchChange() {
        const focused = global.stage.get_key_focus();
        // Hiding/destroying the focused drawer actor clears stage focus.
        // Cinnamon's popup manager then closes the whole menu immediately.
        if (this.applet.menu.isOpen && focused && this.actor.contains(focused))
            this.applet._pmFocusMenu();
    }

    clearSearch() {
        if (this.destroyed) return;
        this.applet.searchEntryText.grab_key_focus();
        this.applet.searchEntry.set_text("");
        // Native text-changed handles the search field and its clear icon.
        // Apply directly too if that handler returns early or is disconnected.
        this.applySearch("");
    }

    applySearch(rawQuery, reopen = false) {
        if (this.destroyed) return;
        const query = this.applet._pmPersonalActive ? "" : rawQuery.trim();
        if (query === this._searchQuery) {
            if (reopen && query) this.openDrawer(this.searchDrawer);
            return;
        }
        this.prepareSearchChange();
        this.closeApplicationContextMenu(false, true);
        this._searchQuery = query;
        this.searchDrawer.menu.removeAll();
        this.resultRows = [];
        this.searchDrawer.rows = this.resultRows;
        this.categorySection.actor.visible = query.length === 0;
        this.resultSection.actor.visible = query.length > 0;
        if (query) {
            const matches = this.applet._listApplications(AppUtils.decomp_stripped(query));
            for (const button of matches) {
                const row = this._makeProgramRow(button, this.searchDrawer);
                this.searchDrawer.menu.addMenuItem(row);
                this.resultRows.push(row);
            }
            if (matches.length === 0)
                this.searchDrawer.menu.addMenuItem(new PM_PopupMenu.PopupMenuItem(_("No applications found"), { reactive: false }));
            this.openDrawer(this.searchDrawer);
        } else this.closeDrawer(this.searchDrawer, false);
        this.searchDrawer.menu.actor.get_vscroll_bar().get_adjustment().set_value(0);
        this.scrollView.get_vscroll_bar().get_adjustment().set_value(0);
        this._updateCategoryVisibility();
        this.applet._pmFitMenuHeight();
    }

    refreshSystemActions() {
        if (this.destroyed) return;
        let enabledCount = 0;
        for (const action of ["lock-screen", "log-out", "shutdown"]) {
            const original = this.applet._pmSessionButtons && this.applet._pmSessionButtons.get(action);
            if (!original) continue;
            let row = this.systemRows.get(action);
            if (!row) {
                row = new PM_DrawerActionItem(original._delegate.name,
                    "system-" + action + "-symbolic", PM_St.IconType.FULLCOLOR);
                row.actor.add_style_class_name("pm-drawer-system-action");
                _pmDrawerCompactRow(row, this);
                row.connect("activate", () => {
                    if (this.destroyed || !this.applet.menu.isOpen || !this.applet._pmSessionActionEnabled(action)) return;
                    const button = this.applet._pmSessionButtons.get(action);
                    if (button) button._delegate.activate();
                });
                row.actor.connect("key-press-event", (actor, event) => this.handleRowKey(actor, event, this.systemDrawer));
                this.systemDrawer.menu.addMenuItem(row);
                this.systemDrawer.rows.push(row);
                this.systemRows.set(action, row);
            }
            const icons = { "lock-screen": "system-lock.svg", "log-out": "system-logout.svg",
                "shutdown": this.applet._pmShutdownRed === true ? "system-actions-red.svg" : "system-actions.svg" };
            row._icon.set_gicon(new PM_Gio.FileIcon({
                file: PM_Gio.file_new_for_path(this.applet._pmSourcePath + "/" + icons[action])
            }));
            row._icon.set_icon_type(PM_St.IconType.FULLCOLOR);
            row._icon.set_icon_size(this.applet.applicationIconSize);
            const enabled = this.applet._pmSessionActionEnabled(action);
            row.actor.visible = enabled;
            row.setSensitive(enabled);
            row.actor.remove_style_class_name("pm-shutdown-red");
            if (enabled) enabledCount++;
        }
        this._systemEnabled = enabledCount > 0;
        if (enabledCount === 0) this.closeDrawer(this.systemDrawer, false);
        this._updateCategoryVisibility();
        const focused = global.stage.get_key_focus();
        if (focused && this.systemSection.actor.contains(focused) &&
            (!this.systemSection.actor.visible || Array.from(this.systemRows.values())
                .some(row => row.actor === focused && !row.actor.visible)))
            this.applet._pmFocusMenu();
        this.applet._pmFitMenuHeight();
    }

    openDrawer(header) {
        if (this.destroyed) return;
        // Closing is asynchronous. Keep the newest requested category and
        // open it only after the old body has completely disappeared.
        if (header !== this.searchDrawer && !this.isLocked(header)) {
            const previous = [...this.categories.map(item => item.header), this.systemDrawer]
                .filter(other => other !== header && !this.isLocked(other) && (other.menu.isOpen || other._pmAnimating));
            if (previous.length) {
                this._pendingHeader = header;
                for (const other of previous) if (other.menu.isOpen) this.closeDrawer(other);
                return;
            }
        }
        this._pendingHeader = null;
        this.applet._pmResetAutoScroll();
        this.closeApplicationContextMenu();
        if (header === this.searchDrawer) {
            // Search temporarily replaces the categories. Keep the selected
            // program drawer so clearing the query restores the same view.
            this.closeDrawer(this.systemDrawer, false);
        } else if (this.isInline()) {
            // Personal-menu drawers unfold in place without hiding or closing
            // neighboring categories. One outer ScrollView owns the full list.
            if (header !== this.systemDrawer) this.activeHeader = header;
        } else if (header === this.systemDrawer) {
            // Beenden can only be opened from the overview. Restore it also
            // for keyboard/programmatic requests while a category is selected.
            this.activeHeader = null;
            for (const { header: other } of this.categories) this.closeDrawer(other, false);
        } else {
            this.activeHeader = header;
            this.closeDrawer(this.systemDrawer, false);
            for (const { header: other } of this.categories)
                if (other !== header) this.closeDrawer(other, false);
        }
        this._updateCategoryVisibility();
        if (!header.menu.isOpen) {
            header.menu.actor.get_vscroll_bar().get_adjustment().set_value(0);
        }
        header.menu.open(this.applet.enableAnimation === true);
        this.applet._pmFitMenuHeight();
        if (header._pmSupplement) this.resetOpenedSupplement(header);
    }

    resetOpenedSupplement(header) {
        const reset = () => {
            header.menu.actor.get_vscroll_bar().get_adjustment().set_value(0);
            if (this.isFlat() || this.isInline()) {
                const adjustment = this.scrollView.get_vscroll_bar().get_adjustment();
                const maximum = Math.max(adjustment.lower, adjustment.upper - adjustment.page_size);
                const top = header.actor.get_transformed_position()[1] - this.scrollView.get_transformed_position()[1];
                adjustment.set_value(Math.max(adjustment.lower, Math.min(maximum, adjustment.get_value() + top)));
            }
        };
        reset();
        if (!header._pmScrollResetSignal) {
            header._pmScrollResetSignal = header.menu.actor.connect("notify::allocation", () => {
                if (this.destroyed || !header.menu.isOpen || header._pmAnimating) return;
                header.menu.actor.disconnect(header._pmScrollResetSignal);
                header._pmScrollResetSignal = 0;
                reset();
            });
        }
    }

    beginDrawerMotion(header, opening, animate) {
        header._pmAnimating = false;
        header.menu.actor.remove_all_transitions();
        if (opening) header.menu.actor.set_height(-1);
        header._pmOpening = opening;
        header._pmAnimating = animate === true;
        // A closing native submenu sets isOpen=false before its height starts
        // shrinking. Keep its visible contribution until the last frame.
        header._pmMotionHeight = opening ? 0 : Math.max(0,
            header.menu.actor.get_preferred_height(-1)[1]);
        if (!this._rebuilding && !this._closingAll && !this.destroyed)
            this.applet._pmFitMenuHeight();
    }

    animateScrollableDrawer(header, opening, animate) {
        // Cinnamon deliberately skips native animation when a scrollbar is
        // needed. Keep AUTO from the first frame so its zero content minimum
        // respects our height cap, then animate the bounded viewport instead.
        if (animate !== true || !PM_Main.wm.desktop_effects_menus || !this.drawerNeedsScrollbar(header))
            return false;
        const menu = header.menu, actor = menu.actor;
        menu.isOpen = opening;
        actor.vscrollbar_policy = PM_St.PolicyType.AUTOMATIC;
        if (opening) actor.show();
        else if (menu._activeMenuItem) menu._activeMenuItem.setActive(false);
        const height = Math.max(1, opening ? actor.get_preferred_height(-1)[1] : actor.height);
        const angle = opening ? (actor.get_direction() === PM_St.TextDirection.RTL ? -90 : 90) :
            menu._arrow ? menu._arrow.rotation_angle_z : 0;
        if (opening) actor.set_height(0);
        actor.ease({
            height: opening ? height : 0,
            duration: 250,
            onUpdate: () => {
                if (menu._arrow) menu._arrow.rotation_angle_z = angle * actor.height / height;
            },
            onComplete: () => {
                if (!opening) actor.hide();
                actor.set_height(-1);
                if (menu._arrow) menu._arrow.rotation_angle_z = opening ? angle : 0;
                menu.emit("open-state-changed", opening);
            }
        });
        return true;
    }

    drawerMotionFrame(header) {
        if (this.destroyed || this._rebuilding || this._closingAll || !header._pmAnimating) return;
        header._pmMotionHeight = header.menu.actor.visible ? Math.max(0, header.menu.actor.height) : 0;
        this.applet._pmFitMenuHeight();
    }

    visibleDrawerHeight(header, fullHeight, spacing = 0) {
        if (!header._pmAnimating) return header.menu.isOpen || header._pmOpening ? fullHeight + spacing : 0;
        const visible = Math.max(0, Math.min(fullHeight, header._pmMotionHeight || 0));
        return visible + (fullHeight > 0 ? spacing * visible / fullHeight : 0);
    }

    closeDrawer(header, animate = this.applet.enableAnimation === true) {
        if (!this.canCloseDrawer(header)) return;
        if (header._pmScrollResetSignal) {
            header.menu.actor.disconnect(header._pmScrollResetSignal);
            header._pmScrollResetSignal = 0;
        }
        this.applet._pmResetAutoScroll();
        if (header === this.activeHeader || header === this.searchDrawer) this.closeApplicationContextMenu();
        const wasOpen = header.menu.isOpen;
        if (!animate) header.menu.actor.remove_all_transitions();
        header.menu.close(animate);
        header.menu.actor.get_vscroll_bar().get_adjustment().set_value(0);
        if (!animate) {
            // Native close() returns immediately once a closing animation
            // has set isOpen=false. Cancelling that animation must still hide
            // its actor, otherwise its full list reappears in the overview.
            header.menu.actor.hide();
            header.menu.actor.set_height(-1);
            header._pmOpening = false;
            header._pmAnimating = false;
            header._pmMotionHeight = 0;
            header.actor.remove_style_pseudo_class("open");
            if (!wasOpen) this.drawerStateChanged(header, false);
        }
    }

    toggleDrawer(header) {
        if (this.isLocked(header)) return;
        if (header.menu.isOpen) this.closeDrawer(header);
        else this.openDrawer(header);
    }

    closeAll(animate = false) {
        this._pendingHeader = null;
        this._pendingFocusHeader = null;
        this._closingAll = true;
        this.closeApplicationContextMenu();
        for (const { header } of this.categories) this.closeDrawer(header, animate);
        this.closeDrawer(this.searchDrawer, animate);
        this.closeDrawer(this.systemDrawer, animate);
        this._closingAll = false;
        this.activeHeader = null;
        this._updateCategoryVisibility();
        this.scrollView.get_vscroll_bar().get_adjustment().set_value(0);
    }

    drawerStateChanged(header, open) {
        header._pmOpening = false;
        header._pmAnimating = false;
        header._pmMotionHeight = 0;
        if (this.destroyed) return;
        if (open && header._pmSupplement && !this._rebuilding) this.resetOpenedSupplement(header);
        if (!open) {
            header.menu.actor.get_vscroll_bar().get_adjustment().set_value(0);
            header.setActive(false);
            header.actor.remove_style_pseudo_class("hover");
        }
        if (this._rebuilding || this._closingAll) return;
        if (open && header !== this.systemDrawer && header !== this.searchDrawer) this.activeHeader = header;
        else if (this.activeHeader === header) this.activeHeader = null;
        this._updateCategoryVisibility();
        this.applet._pmFitMenuHeight();
        if (open && this._pendingFocusHeader === header) {
            this._pendingFocusHeader = null;
            const row = header.rows.find(item => item.actor.visible && item.actor.can_focus);
            if (row) this.focusActor(row.actor);
        }
        if (!open && this._pendingHeader) {
            const waiting = [...this.categories.map(item => item.header), this.systemDrawer]
                .some(other => !this.isLocked(other) && (other.menu.isOpen || other._pmAnimating));
            if (!waiting) {
                const next = this._pendingHeader;
                this._pendingHeader = null;
                if (this.applet.menu.isOpen) this.openDrawer(next);
            }
        }
    }

    _updateCategoryVisibility() {
        this.categorySection.actor.visible = !this._searchQuery;
        this.resultSection.actor.visible = !!this._searchQuery;
        this.systemSection.actor.visible = !this.applet._pmPersonalActive && this._systemEnabled && !this._searchQuery &&
            (this.isInline() || !this.activeHeader);
        for (const { header } of this.categories) {
            const supplementOutsideSingle = header._pmSupplement && (this.isFlat() || !this.applet._pmPersonalSingle);
            const visible = this.isFlat() || supplementOutsideSingle || this.isInline() || !this.activeHeader || this.activeHeader === header;
            header.actor.visible = visible;
            if (!visible) header.menu.actor.hide();
        }
    }

    drawerNeedsScrollbar(header) {
        if (this.isInline() && this.applet._pmPersonalActive && !this._searchQuery && !header._pmRecent) return false;
        return header._pmHeightLimit !== undefined &&
            _superMenuNaturalHeight(header.menu.box) > header._pmHeightLimit;
    }

    getContentHeader() {
        if (this.isInline() && !this.applet._pmPersonalActive &&
            (this.systemDrawer.menu.isOpen || this.systemDrawer._pmAnimating)) return this.systemDrawer;
        return this._searchQuery ? this.searchDrawer : this.activeHeader;
    }

    getScrollView() {
        if (this.isFlat()) return this.scrollView;
        if (this.isInline() && this.activeHeader && this.activeHeader._pmRecent &&
            this.activeHeader.menu.isOpen && this.drawerNeedsScrollbar(this.activeHeader)) return this.activeHeader.menu.actor;
        if (this.isInline() && this.applet._pmPersonalActive && !this._searchQuery) return this.scrollView;
        const header = this.getContentHeader();
        return header && (header.menu.isOpen || header._pmOpening || header._pmAnimating) ? header.menu.actor : this.scrollView;
    }

    isInline() {
        return !this.isFlat() && (this.applet._pmPersonalActive === true ?
            (this.applet._pmPersonalSingle !== true || this.applet._pmPersonalOpenAll === true) :
            this.applet._pmAllProgramsSingle === false);
    }

    isLocked(header) {
        return this.applet._pmPersonalActive === true && header._pmCategory === true &&
            (this.isFlat() && !this.isGrid() && header._pmEditableEmpty ||
                !this.isFlat() && this.applet._pmPersonalOpenAll === true);
    }

    canCloseDrawer(header) {
        return !this.isLocked(header) || this.destroyed || this._closingAll || this._rebuilding ||
            !this.applet.menu.isOpen;
    }

    prepareOpen(openingMenu = false) {
        if (this.destroyed || !this.applet._pmPersonalActive) return;
        if (this._contextNeedsRefresh) this.refreshPrograms();
        // Default selection belongs only to the two selectable own drawer modes.
        // Refreshes and editing never undo a manual collapse.
        const key = this.applet._pmPersonalDefaultCategory;
        const selected = openingMenu && !this.applet._pmIsEditing() && !this.isFlat() &&
            this.applet._pmPersonalOpenAll !== true ? this.categories.find(({ header }) =>
                key === (header._pmPlace ? "places" : header._pmRecent ? "recent" : "category:" + header.id)) : null;
        const startup = selected ? selected.header : null;
        if ((!this.isFlat() && this.applet._pmPersonalOpenAll === true) || startup ||
            this.isFlat() && this.categories.some(({ header }) => this.isLocked(header) && !header.menu.isOpen)) {
            const rebuilding = this._rebuilding;
            this._rebuilding = true;
            for (const { header } of this.categories) {
                if (!this.isLocked(header) && header !== startup) continue;
                header.menu.actor.remove_all_transitions();
                header.menu.actor.set_height(-1);
                header.menu.open(false);
            }
            this.activeHeader = startup;
            this._rebuilding = rebuilding;
            this._updateCategoryVisibility();
            this.applet._pmFitMenuHeight();
            this.applet._pmResetAutoScroll();
            this.scrollView.get_vscroll_bar().get_adjustment().set_value(0);
            if (startup && startup._pmSupplement) this.resetOpenedSupplement(startup);
        }
    }

    isFlat() {
        return this.applet._pmIsPersonalList();
    }

    isGrid() {
        return this.applet._pmIsPersonalGrid();
    }

    iconsOnly() {
        return this.isFlat() && this.applet._pmPersonalIconsOnly === true;
    }

    isNarrowList() {
        return this.isFlat() && !this.isGrid() && this.iconsOnly();
    }

    programIconSize() {
        return this.applet.applicationIconSize;
    }

    outerHorizontalChrome() {
        let chrome = 0;
        for (let actor = this.actor.get_parent(); actor; actor = actor.get_parent()) {
            const node = actor.get_theme_node();
            for (const side of [PM_St.Side.LEFT, PM_St.Side.RIGHT])
                chrome += node.get_padding(side) + node.get_border_width(side) + node.get_margin(side);
            if (actor === this.applet.menu.actor) break;
        }
        return chrome;
    }

    clearGrid() {
        for (const group of this.gridGroups) for (const row of group.rows) row.destroy();
        this.gridGroups = [];
        this.gridLines = [];
    }

    addGridGroup(category, buttons, alphabetical) {
        const section = new PM_PopupMenu.PopupMenuSection();
        section.actor.add_style_class_name("pm-grid-group");
        let heading = null;
        if (!alphabetical) {
            heading = new PM_GridCategoryItem(this, category);
            section.addMenuItem(heading);
        }
        const rows = buttons.map(button => {
            const row = this._makeProgramRow(button);
            row._pmCategoryId = alphabetical ? button.category[0] : category.categoryId;
            return row;
        });
        let empty = null;
        if (!rows.length && Array.isArray(category._pmItems)) {
            const unavailable = category._pmItems.some(item => item.type !== "separator");
            empty = new PM_DrawerEmptyItem(this, { id: category.categoryId },
                unavailable ? _("No available entries") : _("No entries yet"));
            section.addMenuItem(empty);
        }
        this.gridGroups.push({ id: category.categoryId, heading, section, rows, empty, lines: [] });
        this.flatRows.push(...rows);
        this.categorySection.addMenuItem(section);
    }

    fitGrid(chrome) {
        const scale = global.ui_scale;
        const monitor = PM_Main.layoutManager.findMonitorForActor(this.applet.actor);
        const area = global.workspace_manager.get_active_workspace().get_work_area_for_monitor(monitor.index);
        const available = Math.max(1, Math.floor((area.width || monitor.width || 1024 * scale) * 0.9) -
            chrome - this.scrollbarWidth());
        const gap = 8 * scale;
        const configuredWidth = Number(this.applet._pmPersonalGridWidth);
        const minimum = Number.isFinite(configuredWidth) ?
            Math.max(72, Math.min(104, Math.round(configuredWidth))) : 80;
        const preferred = Math.max(this.iconsOnly() ? 40 : minimum, this.applet.applicationIconSize + 24) * scale;
        const configured = Math.max(3, Math.min(10, Math.round(Number(this.applet._pmPersonalGridColumns)) || 3));
        const columns = Math.max(1, Math.min(configured, Math.floor((available + gap) / (preferred + gap))));
        const tile = Math.max(1, Math.min(preferred,
            Math.floor((available - (columns - 1) * gap) / columns)));
        if (columns !== this.gridColumns || this.gridGroups.some(group => group.rows.length > 0 && group.lines.length === 0)) {
            const focused = global.stage.get_key_focus();
            const hadFocus = focused && this.actor.contains(focused);
            if (hadFocus && this.applet.menu.isOpen) this.applet._pmFocusMenu();
            if (this.contextRow) this.closeApplicationContextMenu(false, true);
            this.gridLines = [];
            for (const group of this.gridGroups) {
                for (const row of group.rows) {
                    const parent = row.actor.get_parent();
                    if (parent) parent.remove_child(row.actor);
                }
                for (const line of group.lines) line.destroy();
                group.lines = [];
                for (let index = 0; index < group.rows.length; index += columns) {
                    const line = new PM_St.BoxLayout({ style_class: "pm-grid-line", vertical: false });
                    line._pmRows = group.rows.slice(index, index + columns);
                    for (const row of line._pmRows) {
                        row._pmGridLine = line;
                        line.add(row.actor, { expand: false, x_fill: true, y_fill: true });
                    }
                    group.section.addActor(line);
                    group.lines.push(line);
                    this.gridLines.push(line);
                }
            }
            this.gridColumns = columns;
            if (hadFocus && !focused.is_finalized() && focused.is_mapped()) this.focusActor(focused);
        }
        for (const row of this.flatRows) row.fitTile(tile);
        return tile * columns + gap * (columns - 1) + chrome + this.scrollbarWidth();
    }

    rowWidth(actor) {
        let chrome = 0;
        for (let parent = actor; parent && parent !== this.actor; parent = parent.get_parent()) {
            const node = parent.get_theme_node();
            for (const side of [PM_St.Side.LEFT, PM_St.Side.RIGHT])
                chrome += node.get_padding(side) + node.get_border_width(side) + node.get_margin(side);
        }
        return Math.max(1, (this.fixedWidth || (this.applet._pmPersonalActive ? 220 : 280) * global.ui_scale) -
            chrome - this.scrollbarWidth());
    }

    scrollbarWidth() {
        return this.isNarrowList() ? 0 : this.scrollView.get_vscroll_bar().get_preferred_width(-1)[1];
    }

    fitWidth() {
        const scale = global.ui_scale;
        const personal = this.applet._pmPersonalActive === true;
        const narrow = this.isNarrowList();
        if (narrow) this.applet.menu.actor.add_style_class_name("pm-symbol-list");
        else this.applet.menu.actor.remove_style_class_name("pm-symbol-list");
        this.scrollView.overlay_scrollbars = narrow;
        const outerChrome = this.outerHorizontalChrome();
        const names = personal ? (this.applet._categoryButtons || []).map(category => category.name) :
            this.categories.map(item => item.header.label.get_text());
        const monitor = PM_Main.layoutManager.findMonitorForActor(this.applet.actor);
        const area = global.workspace_manager.get_active_workspace().get_work_area_for_monitor(monitor.index);
        const stamp = JSON.stringify([personal, this.isFlat(), this.isGrid(), this.iconsOnly(), narrow,
            this.applet._pmThickness(), outerChrome,
            this.applet._pmPersonalGridColumns, this.applet._pmPersonalGridWidth, scale, area.width,
            this.applet.categoryIconSize, this.applet.applicationIconSize, names]);
        if (this._widthStamp === stamp) return;
        // The shared stylesheet keeps the program menu's 280 px minimum.
        // Override it only here for the personal presentation.
        this.actor.set_style(this.isGrid() || narrow ? "min-width: 0px;" : personal ? "min-width: 220px;" : "");
        // One shared inset aligns heading text with the tile edges. The
        // regular chrome measurement below also includes it in the frame.
        const gridInset = 12;
        this.categorySection.actor.set_style(this.isGrid() ?
            `padding-left: ${gridInset}px; padding-right: ${gridInset}px;` : "");
        let chrome = 0;
        for (const actor of [this.actor, this.scrollView, this.programBox, this.categorySection.actor]) {
            const node = actor.get_theme_node();
            for (const side of [PM_St.Side.LEFT, PM_St.Side.RIGHT])
                chrome += node.get_padding(side) + node.get_border_width(side) + node.get_margin(side);
        }
        const headings = [...this.categories.map(item => item.header), this.systemDrawer];
        for (const header of headings) this._headingHeight(header);
        const headingWidth = personal ? this.personalHeadingWidth(names) :
            Math.max(0, ...headings.map(header => header.actor.get_preferred_width(-1)[1]));
        // Derive width only from the overview. Programs, search results,
        // scrollbar visibility and context actions cannot enlarge the frame.
        let narrowWidth = 0;
        if (narrow) {
            const rowChrome = Math.max(0, ...this.flatRows.map(row => {
                const node = row.actor.get_theme_node();
                return [PM_St.Side.LEFT, PM_St.Side.RIGHT].reduce((sum, side) =>
                    sum + node.get_padding(side) + node.get_border_width(side) + node.get_margin(side), 0);
            }));
            narrowWidth = Math.max(1, 1.5 * this.applet._pmThickness() - outerChrome,
                this.programIconSize() * scale + chrome + rowChrome);
        }
        const width = Math.ceil(narrow ? narrowWidth :
            this.isGrid() ? this.fitGrid(chrome) : Math.max((personal ? 220 : 280) * scale,
            headingWidth + chrome + this.scrollbarWidth()));
        if (width !== this.fixedWidth) {
            this.fixedWidth = width;
            this.actor.set_width(width);
        }
        this._widthStamp = stamp;
    }

    personalHeadingWidth(names) {
        if (!names.length) return 0;
        const header = this.categories.length ? this.categories[0].header : this.systemDrawer;
        // St.Label's preferred width can retain its allocated width or the
        // program popup's column widths. Always measure unrestricted text,
        // including when real drawer headings already exist.
        header.label.get_preferred_width(-1);
        const layout = header.label.clutter_text.get_layout().copy();
        layout.set_width(-1);
        layout.set_ellipsize(PM_Pango.EllipsizeMode.NONE);
        const textWidth = Math.max(...names.map(name => {
            layout.set_text(name, -1);
            return layout.get_pixel_size()[0];
        }));
        let width = textWidth + (header._children.length - 1) * _superMenuSpacing(header.actor);
        for (const child of header._children)
            if (child.actor !== header.label) width += child.actor.get_preferred_width(-1)[1];
        const node = header.actor.get_theme_node();
        for (const side of [PM_St.Side.LEFT, PM_St.Side.RIGHT])
            width += node.get_padding(side) + node.get_border_width(side) + node.get_margin(side);
        return width;
    }

    invalidateWidth() {
        this._widthStamp = null;
    }

    fitHeight(maximum) {
        if (this.destroyed || this._rebuilding) return;
        // St.ScrollView consumes wheel events even with NEVER scrollbar
        // policy. Let full-height inner views pass them to the outer list.
        const outerScroll = this.isFlat() || this.isInline() && this.applet._pmPersonalActive && !this._searchQuery;
        for (const header of [...this.categories.map(item => item.header), this.searchDrawer, this.systemDrawer])
            header.menu.actor.set_mouse_scrolling(!outerScroll);
        if (this.contextMenu) {
            this.contextMenu.actor.set_mouse_scrolling(!outerScroll && !this.contextMenu._pmEditorActions);
            for (const item of this.contextItems()) if (item.menu) item.menu.actor.set_mouse_scrolling(false);
        }
        if (this.isFlat()) {
            this._fitFlatHeight(maximum);
            return;
        }
        if (this.isInline() && !this._searchQuery) {
            if (this.applet._pmPersonalActive) this._fitInlineHeight(maximum);
            else this._fitMainInlineHeight(maximum);
            return;
        }
        if (this.applet._pmPersonalActive && this.applet._pmPersonalSingle && this.applet._pmPersonalFullDrawer) {
            this._fitPersonalFullHeight(maximum);
            return;
        }
        this.fitWidth();
        const scale = global.ui_scale;
        const searchHeight = this.applet._pmPersonalActive ? 0 : _superMenuNaturalHeight(this.applet.searchBox);
        const reserved = this.applet._pmMenuChromeHeight() + _superMenuVerticalChrome(this.actor) +
            searchHeight + (this.applet._pmPersonalActive ? 0 : _superMenuSpacing(this.applet.right_box));
        const available = Math.max(1, Math.floor(maximum - reserved));
        // Measure the closed overview, even while its headings are hidden.
        // Programs and search results use this fixed budget. Beenden is the
        // one exception: its own rows enlarge the popup above a bottom panel.
        const categoryHeight = this.categoryOverviewHeight();
        const systemHeight = this._systemEnabled ? this._headingHeight(this.systemDrawer) +
            _superMenuVerticalChrome(this.systemSection.actor) : 0;
        this.overviewHeight = categoryHeight + _superMenuVerticalChrome(this.categorySection.actor) +
            systemHeight + (this._systemEnabled ? _superMenuSpacing(this.programBox) : 0) +
            _superMenuVerticalChrome(this.programBox) + _superMenuVerticalChrome(this.scrollView);
        this.baseProgramHeight = Math.max(1, Math.min(available, Math.ceil(this.overviewHeight)));
        const outerChrome = _superMenuVerticalChrome(this.scrollView) +
            _superMenuVerticalChrome(this.programBox);
        const system = this.systemDrawer;
        system._pmHeightLimit = Math.max(1, available - outerChrome -
            this._headingHeight(system) -
            _superMenuVerticalChrome(this.systemSection.actor) -
            _superMenuVerticalChrome(system.menu.actor) - _superMenuSpacing(this.systemSection.actor));
        const systemStyle = "max-height: " + Math.floor(system._pmHeightLimit / scale) + "px;";
        if (system.menu.actor.style !== systemStyle) system.menu.actor.set_style(systemStyle);
        system.menu.actor.vscrollbar_policy = this.drawerNeedsScrollbar(system) ?
            PM_St.PolicyType.AUTOMATIC : PM_St.PolicyType.NEVER;
        this.systemExtraHeight = this.systemSection.actor.visible ? this.visibleDrawerHeight(system,
            this._drawerBodyHeight(system), _superMenuSpacing(this.systemSection.actor)) : 0;
        const categoryContext = this.inlineContextHeight(this.categorySection.actor);
        this.programHeight = Math.min(available, this.baseProgramHeight + Math.ceil(this.systemExtraHeight + categoryContext));
        const header = this.getContentHeader();
        const compactPersonal = this.applet._pmPersonalActive && this.applet._pmPersonalSingle &&
            !this.applet._pmPersonalFullDrawer;
        if (header && (header.menu.isOpen || header._pmOpening || compactPersonal && header._pmAnimating)) {
            const headingHeight = this._headingHeight(header);
            const innerChrome = _superMenuVerticalChrome(header.menu.actor);
            const section = header === this.searchDrawer ? this.resultSection : this.categorySection;
            const sectionChrome = _superMenuVerticalChrome(section.actor) +
                _superMenuSpacing(section.actor);
            const footer = this.supplementHeadingHeight(header, _superMenuSpacing(this.categorySection.actor));
            const fixedHeight = this.programHeight;
            const contextHeight = compactPersonal ? categoryContext : 0;
            const placeholder = compactPersonal ? this.categoryPlaceholderHeight(_superMenuSpacing(section.actor)) : 0;
            const overhead = headingHeight + innerChrome + outerChrome + sectionChrome + footer + contextHeight + placeholder;
            // Native _getMenuItems() excludes the inserted PopupSubMenu.
            // Extend the compact budget by its visible, animated height.
            const entryContext = compactPersonal ? this.inlineContextHeight(header.menu.box) : 0;
            // A small category overview cannot supply a useful body budget.
            // Reserve up to three actual entries, plus intervening separators;
            // the work-area cap always takes priority over that minimum.
            const target = compactPersonal ? Math.min(available, Math.max(fixedHeight,
                Math.ceil(overhead + this.compactPersonalBodyMinimum(header))) + entryContext) : fixedHeight;
            header._pmHeightLimit = Math.max(1, target - overhead);
            if (compactPersonal) {
                const spacing = _superMenuSpacing(section.actor);
                const body = Math.floor(header._pmHeightLimit / scale) * scale + innerChrome;
                this.programHeight = Math.min(available, Math.max(fixedHeight, Math.ceil(
                    overhead - innerChrome - spacing + this.visibleDrawerHeight(header, body, spacing))));
            }
            const pixels = Math.floor(header._pmHeightLimit / scale);
            // The native submenu background now fills the entire list budget.
            // Rows remain compact at the top; the remaining area stays inside
            // this ScrollView rather than in a separate transparent spacer.
            const style = "min-height: " + pixels + "px; max-height: " + pixels + "px;";
            if (header.menu.actor.style !== style) header.menu.actor.set_style(style);
            header.menu.actor.vscrollbar_policy = this.drawerNeedsScrollbar(header) ?
                PM_St.PolicyType.AUTOMATIC : PM_St.PolicyType.NEVER;
            this.scrollView.vscrollbar_policy = PM_St.PolicyType.NEVER;
        } else {
            this.scrollView.vscrollbar_policy = !this._searchQuery &&
                this.overviewHeight + this.systemExtraHeight + categoryContext > this.programHeight ?
                PM_St.PolicyType.AUTOMATIC : PM_St.PolicyType.NEVER;
        }
        this.heightLimit = maximum;
        this._fitBottomSpace();
        this.scrollView.set_height(this.programHeight);
        this.actor.set_height(this.programHeight + _superMenuVerticalChrome(this.actor));
        this._alignSearchEdges();
    }

    _fitInlineHeight(maximum) {
        this.fitWidth();
        const searchHeight = this.applet._pmPersonalActive ? 0 : _superMenuNaturalHeight(this.applet.searchBox);
        const reserved = this.applet._pmMenuChromeHeight() + _superMenuVerticalChrome(this.actor) +
            searchHeight + (this.applet._pmPersonalActive ? 0 : _superMenuSpacing(this.applet.right_box));
        const available = Math.max(1, Math.floor(maximum - reserved));
        const headers = this.categories.map(item => item.header);
        if (this._systemEnabled) headers.push(this.systemDrawer);
        let extra = 0;
        extra += this.inlineContextHeight(this.categorySection.actor);
        for (const header of [...headers, this.searchDrawer]) {
            // Remove the replacement view's full-height constraints. The
            // submenu contributes only its natural content height here.
            if (header.menu.actor.style) header.menu.actor.set_style("");
            header.menu.actor.vscrollbar_policy = PM_St.PolicyType.NEVER;
            header._pmHeightLimit = undefined;
            const requestedLimit = this.recentBodyLimit(header);
            const recentLimit = requestedLimit === null ? null : Math.min(requestedLimit,
                Math.max(1, available - this._headingHeight(header) - _superMenuVerticalChrome(header.menu.actor) -
                    _superMenuVerticalChrome(this.scrollView) - _superMenuVerticalChrome(this.programBox) -
                    _superMenuVerticalChrome(this.categorySection.actor)));
            if (recentLimit !== null) {
                header._pmHeightLimit = recentLimit;
                header.menu.actor.set_style("max-height: " + Math.floor(recentLimit / global.ui_scale) + "px;");
                header.menu.actor.vscrollbar_policy = this.drawerNeedsScrollbar(header) ?
                    PM_St.PolicyType.AUTOMATIC : PM_St.PolicyType.NEVER;
            }
            header.menu.actor.set_mouse_scrolling(this.drawerNeedsScrollbar(header));
            this._headingHeight(header);
            if (header !== this.searchDrawer) {
                extra += this.visibleDrawerHeight(header, Math.min(_superMenuNaturalHeight(header.menu.box),
                    recentLimit === null ? Infinity : recentLimit) +
                    _superMenuVerticalChrome(header.menu.actor),
                    _superMenuSpacing(header === this.systemDrawer ? this.systemSection.actor : this.categorySection.actor));
            }
        }
        const categories = this.categoryOverviewHeight();
        this.overviewHeight = categories + _superMenuVerticalChrome(this.categorySection.actor) +
            (this._systemEnabled ? this.systemDrawer.actor.height + _superMenuVerticalChrome(this.systemSection.actor) +
                _superMenuSpacing(this.programBox) : 0) +
            _superMenuVerticalChrome(this.programBox) + _superMenuVerticalChrome(this.scrollView);
        this.baseProgramHeight = Math.max(1, Math.min(available, Math.ceil(this.overviewHeight)));
        this.inlineExtraHeight = extra;
        this.systemExtraHeight = 0;
        this.programHeight = Math.max(1, Math.min(available, Math.ceil(this.overviewHeight + extra)));
        this.heightLimit = maximum;
        this.bottomSpace.hide();
        this.bottomSpace.set_height(0);
        this.scrollView.vscrollbar_policy = this.overviewHeight + extra > this.programHeight ?
            PM_St.PolicyType.AUTOMATIC : PM_St.PolicyType.NEVER;
        this.scrollView.set_height(this.programHeight);
        this.actor.set_height(this.programHeight + _superMenuVerticalChrome(this.actor));
        this._alignSearchEdges();
    }

    _fitPersonalFullHeight(maximum) {
        this.fitWidth();
        const available = Math.max(1, Math.floor(maximum - this.applet._pmMenuChromeHeight() -
            _superMenuVerticalChrome(this.actor)));
        const spacing = _superMenuSpacing(this.categorySection.actor);
        const outer = _superMenuVerticalChrome(this.scrollView) + _superMenuVerticalChrome(this.programBox) +
            _superMenuVerticalChrome(this.categorySection.actor);
        this.overviewHeight = this.categoryOverviewHeight() + outer;
        this.baseProgramHeight = Math.max(1, Math.min(available, Math.ceil(this.overviewHeight)));
        const header = this.activeHeader;
        const categoryContext = this.inlineContextHeight(this.categorySection.actor);
        let content = this.baseProgramHeight;
        if (header && (header.menu.isOpen || header._pmOpening || header._pmAnimating)) {
            const heading = this._headingHeight(header), chrome = _superMenuVerticalChrome(header.menu.actor);
            const footer = this.supplementHeadingHeight(header, spacing);
            const placeholder = this.categoryPlaceholderHeight(spacing);
            header._pmHeightLimit = Math.max(1, available - heading - outer - chrome - spacing - footer - categoryContext - placeholder);
            const recentLimit = this.recentBodyLimit(header);
            if (recentLimit !== null) header._pmHeightLimit = Math.min(header._pmHeightLimit, recentLimit);
            const pixels = Math.floor(header._pmHeightLimit / global.ui_scale);
            // Keep unused overview space inside the native drawer background.
            // Longer lists still grow naturally up to the existing height cap.
            const minimum = Math.min(pixels, Math.max(0, Math.ceil((this.baseProgramHeight -
                heading - outer - chrome - spacing - footer - placeholder) / global.ui_scale)));
            const style = "min-height: " + minimum + "px; max-height: " + pixels + "px;";
            if (header.menu.actor.style !== style) header.menu.actor.set_style(style);
            header.menu.actor.vscrollbar_policy = this.drawerNeedsScrollbar(header) ?
                PM_St.PolicyType.AUTOMATIC : PM_St.PolicyType.NEVER;
            content = Math.max(content, heading + outer + footer + placeholder + this.visibleDrawerHeight(header,
                Math.max(minimum * global.ui_scale,
                    Math.min(_superMenuNaturalHeight(header.menu.box), header._pmHeightLimit)) + chrome, spacing));
        }
        this.programHeight = Math.max(1, Math.min(available, Math.ceil(content + categoryContext)));
        this.inlineExtraHeight = this.programHeight - this.baseProgramHeight;
        this.systemExtraHeight = 0;
        this.heightLimit = maximum;
        this.bottomSpace.hide();
        this.bottomSpace.set_height(0);
        this.scrollView.vscrollbar_policy = !header && this.overviewHeight + categoryContext > this.programHeight ?
            PM_St.PolicyType.AUTOMATIC : PM_St.PolicyType.NEVER;
        this.scrollView.set_height(this.programHeight);
        this.actor.set_height(this.programHeight + _superMenuVerticalChrome(this.actor));
    }

    _fitMainInlineHeight(maximum) {
        this.fitWidth();
        const scale = global.ui_scale;
        const reserved = this.applet._pmMenuChromeHeight() + _superMenuVerticalChrome(this.actor) +
            _superMenuNaturalHeight(this.applet.searchBox) + _superMenuSpacing(this.applet.right_box);
        const available = Math.max(1, Math.floor(maximum - reserved));
        const spacing = _superMenuSpacing(this.categorySection.actor);
        const categoryHeight = this.categories.length ? this.categories.reduce((height, { header }) =>
            height + this._headingHeight(header), 0) + Math.max(0, this.categories.length - 1) * spacing :
            this.categorySection.actor.get_children().reduce((height, actor) =>
                height + actor.get_preferred_height(-1)[1], 0);
        const outerChrome = _superMenuVerticalChrome(this.scrollView) + _superMenuVerticalChrome(this.programBox);
        this.overviewHeight = categoryHeight + _superMenuVerticalChrome(this.categorySection.actor) +
            (this._systemEnabled ? this._headingHeight(this.systemDrawer) +
                _superMenuVerticalChrome(this.systemSection.actor) + _superMenuSpacing(this.programBox) : 0) + outerChrome;
        this.baseProgramHeight = Math.max(1, Math.min(available, Math.ceil(this.overviewHeight)));
        let extra = 0;
        for (const header of [...this.categories.map(item => item.header), this.systemDrawer]) {
            const first = header.rows.find(row => row.actor.visible);
            const rowHeight = first ? first.actor.get_preferred_height(-1)[1] : this.applet.applicationIconSize * scale;
            const rowLimit = Math.max(1, this.categories.length) * rowHeight +
                Math.max(0, this.categories.length - 1) * _superMenuSpacing(header.menu.box);
            const chrome = _superMenuVerticalChrome(header.menu.actor);
            header._pmHeightLimit = Math.max(1, Math.floor(Math.min(rowLimit,
                Math.max(rowHeight, available - this.overviewHeight - chrome - spacing)) / scale) * scale);
            const style = "max-height: " + Math.floor(header._pmHeightLimit / scale) + "px;";
            if (header.menu.actor.style !== style) header.menu.actor.set_style(style);
            header.menu.actor.vscrollbar_policy = this.drawerNeedsScrollbar(header) ?
                PM_St.PolicyType.AUTOMATIC : PM_St.PolicyType.NEVER;
            if (header !== this.systemDrawer || this._systemEnabled)
                extra += this.visibleDrawerHeight(header,
                    Math.min(_superMenuNaturalHeight(header.menu.box), header._pmHeightLimit) + chrome, spacing);
        }
        this.inlineExtraHeight = extra;
        this.systemExtraHeight = 0;
        this.programHeight = Math.max(1, Math.min(available, Math.ceil(this.overviewHeight + extra)));
        this.heightLimit = maximum;
        this.bottomSpace.hide();
        this.bottomSpace.set_height(0);
        this.scrollView.vscrollbar_policy = this.overviewHeight + extra > this.programHeight ?
            PM_St.PolicyType.AUTOMATIC : PM_St.PolicyType.NEVER;
        this.scrollView.set_height(this.programHeight);
        this.actor.set_height(this.programHeight + _superMenuVerticalChrome(this.actor));
        this._alignSearchEdges();
    }

    _fitFlatHeight(maximum) {
        this.fitWidth();
        const available = Math.max(1, Math.floor(maximum - this.applet._pmMenuChromeHeight() -
            _superMenuVerticalChrome(this.actor)));
        this.overviewHeight = _superMenuNaturalHeight(this.categorySection.actor) +
            _superMenuVerticalChrome(this.programBox) + _superMenuVerticalChrome(this.scrollView);
        this.programHeight = Math.max(1, Math.min(available, Math.ceil(this.overviewHeight)));
        this.baseProgramHeight = this.programHeight;
        this.systemExtraHeight = 0;
        this.inlineExtraHeight = 0;
        this.heightLimit = maximum;
        this.bottomSpace.hide();
        this.bottomSpace.set_height(0);
        this.scrollView.vscrollbar_policy = this.overviewHeight > this.programHeight ?
            PM_St.PolicyType.AUTOMATIC : PM_St.PolicyType.NEVER;
        this.scrollView.set_height(this.programHeight);
        this.actor.set_height(this.programHeight + _superMenuVerticalChrome(this.actor));
    }

    inlineContextHeight(parent) {
        const menu = this.contextMenu;
        // Only the direct parent needs an extra budget. Full-height drawers
        // already measure their nested action popup as part of the body.
        return menu && (menu.isOpen || menu._pmAnimating) && menu.actor.get_parent() === parent ?
            _superMenuNaturalHeight(menu.actor) + _superMenuSpacing(parent) : 0;
    }

    categoryPlaceholderHeight(spacing = 0) {
        return this.emptyItem && this.emptyItem.actor.visible ?
            this.emptyItem.actor.get_preferred_height(-1)[1] + spacing : 0;
    }

    recentBodyLimit(header) {
        if (!header._pmRecent || this.applet._pmPersonalOpenAll === true) return null;
        const count = Math.max(5, Math.min(19, Math.round(Number(this.applet._pmPersonalRecentVisibleLimit) || 10)));
        const rows = header.rows.filter(row => row.actor.visible).slice(0, count);
        if (!rows.length) return null;
        return rows.reduce((height, row) => height + row.actor.get_preferred_height(-1)[1],
            _superMenuVerticalChrome(header.menu.box)) + Math.max(0, rows.length - 1) * _superMenuSpacing(header.menu.box);
    }

    supplementHeadingHeight(current, spacing) {
        return this.categories.reduce((height, { header }) => height +
            (header._pmSupplement && header !== current && header.actor.visible ?
                this._headingHeight(header) + spacing : 0), 0);
    }

    categoryOverviewHeight() {
        // The empty row remains above Recent even though it is not a category.
        const placeholder = this.categoryPlaceholderHeight();
        const count = this.categories.length + (this.emptyItem && this.emptyItem.actor.visible ? 1 : 0);
        return this.categories.reduce((height, { header }) => height + this._headingHeight(header), placeholder) +
            Math.max(0, count - 1) * _superMenuSpacing(this.categorySection.actor);
    }

    compactPersonalBodyMinimum(header) {
        const spacing = _superMenuSpacing(header.menu.box);
        let height = _superMenuVerticalChrome(header.menu.box), entries = 0, rows = 0;
        for (const item of header.menu._getMenuItems()) {
            if (!item.actor.visible) continue;
            if (rows++) height += spacing;
            height += item.actor.get_preferred_height(-1)[1];
            if (!item._pmSeparator && ++entries === 3) break;
        }
        return Math.ceil(height / global.ui_scale) * global.ui_scale;
    }

    _drawerBodyHeight(header) {
        // Ignore temporary actor.height values used by native opening effects.
        const logicalLimit = Math.floor(header._pmHeightLimit / global.ui_scale) * global.ui_scale;
        const content = header === this.systemDrawer ?
            Math.min(_superMenuNaturalHeight(header.menu.box), logicalLimit) : logicalLimit;
        return content +
            _superMenuVerticalChrome(header.menu.actor);
    }

    _fitBottomSpace() {
        this.bottomSpace.hide();
        // Drawer/action frames already have their complete row budget. A
        // cached BoxLayout request can still contain the previous icon size
        // and would insert a spurious spacer during manual size changes.
        if (!this._searchQuery || this.searchDrawer.menu.isOpen || this.searchDrawer._pmOpening) {
            this.bottomSpace.set_height(0);
            return;
        }
        const contentHeight = this._headingHeight(this.searchDrawer) + _superMenuVerticalChrome(this.resultSection.actor) +
            _superMenuVerticalChrome(this.programBox) + _superMenuVerticalChrome(this.scrollView);
        const remaining = Math.max(0, this.programHeight - contentHeight - _superMenuSpacing(this.programBox));
        this.bottomSpace.set_height(Math.floor(remaining));
        this.bottomSpace.visible = remaining >= 1;
    }

    _alignSearchEdges() {
        if (this.applet._pmPersonalActive) return;
        const header = this.activeHeader || (this.categories[0] && this.categories[0].header) || this.systemDrawer;
        const section = header === this.systemDrawer ? this.systemSection : this.categorySection;
        const actors = [this.actor, this.scrollView, this.programBox, section.actor, header.actor];
        const edge = side => actors.reduce((width, actor) => {
            const node = actor.get_theme_node();
            return width + node.get_padding(side) + node.get_border_width(side) + node.get_margin(side);
        }, 0);
        // Search is outside the scrolling area. Adding its scrollbar width
        // here made the field shrink whenever a query enabled that scrollbar.
        const left = edge(PM_St.Side.LEFT), right = edge(PM_St.Side.RIGHT);
        this.searchInsets = { left, right };
        const style = this.applet._pmSearchStyle + " padding: 0px; margin-left: " +
            left / global.ui_scale + "px; margin-right: " + right / global.ui_scale + "px;";
        if (this.applet.searchBox.style !== style) this.applet.searchBox.set_style(style);
    }

    _focusActors() {
        const actors = [];
        const appendRow = row => {
            actors.push(row.actor);
            if (this.contextMenu && this.contextMenu.isOpen && this.contextRow === row)
                for (const item of this.contextItems(this.contextMenu, true)) actors.push(item._pmInputEntry || item.actor);
        };
        if (this.emptyItem) appendRow(this.emptyItem);
        if (this.isFlat()) {
            if (this.isGrid()) {
                for (const group of this.gridGroups) {
                    if (group.heading) appendRow(group.heading);
                    for (const row of group.rows) appendRow(row);
                    if (group.empty) appendRow(group.empty);
                }
            } else for (const row of this.flatRows) appendRow(row);
            for (const { header } of this.categories.filter(item => item.header._pmSupplement || item.header._pmEditableEmpty)) {
                appendRow(header);
                if (header.menu.isOpen) for (const row of header.rows) appendRow(row);
            }
        } else if (this._searchQuery) {
            actors.push(this.searchDrawer.actor);
            if (this.searchDrawer.menu.isOpen)
                for (const row of this.resultRows) appendRow(row);
        } else {
            for (const { header } of this.categories) {
                if (!header.actor.visible) continue;
                appendRow(header);
                if (header.menu.isOpen)
                    for (const row of header.rows) appendRow(row);
            }
        }
        if (this.systemSection.actor.visible) {
            actors.push(this.systemDrawer.actor);
            if (this.systemDrawer.menu.isOpen)
                for (const row of this.systemDrawer.rows) actors.push(row.actor);
        }
        return actors.filter(actor => actor.visible && actor.can_focus);
    }

    focusActor(actor) {
        actor.grab_key_focus();
        const scrollView = this.getScrollView();
        if (!scrollView.contains(actor) || !actor.is_mapped()) return;
        scrollView.get_allocation_box();
        actor.get_allocation_box();
        const [, top] = scrollView.get_transformed_position();
        const [, height] = scrollView.get_transformed_size();
        const [, rowTop] = actor.get_transformed_position();
        const [, rowHeight] = actor.get_transformed_size();
        const adjustment = scrollView.get_vscroll_bar().get_adjustment();
        let delta = 0;
        if (rowTop < top) delta = rowTop - top;
        else if (rowTop + rowHeight > top + height) delta = rowTop + rowHeight - top - height;
        if (delta) adjustment.set_value(Math.max(adjustment.lower,
            Math.min(adjustment.upper - adjustment.page_size, adjustment.get_value() + delta)));
    }

    handleRowKey(actor, event, header = null) {
        const key = event.get_key_symbol();
        const gridRow = this.isGrid() && this.flatRows.find(row => row.actor === actor);
        if (gridRow) {
            const down = key === PM_Clutter.KEY_Down || key === PM_Clutter.KEY_KP_Down;
            const up = key === PM_Clutter.KEY_Up || key === PM_Clutter.KEY_KP_Up;
            const rtl = actor.get_direction() === PM_St.TextDirection.RTL;
            const left = key === PM_Clutter.KEY_Left, right = key === PM_Clutter.KEY_Right;
            if ((up || down || left || right) && !(down && this.contextRow === gridRow && this.contextMenu.isOpen)) {
                let target;
                if (left || right) target = this.flatRows[this.flatRows.indexOf(gridRow) + ((right !== rtl) ? 1 : -1)];
                else {
                    const index = this.gridLines.indexOf(gridRow._pmGridLine);
                    const line = this.gridLines[index + (down ? 1 : -1)];
                    const groupIndex = this.gridGroups.findIndex(group => group.rows.includes(gridRow));
                    const group = this.gridGroups[groupIndex];
                    const heading = up && group.lines[0] === gridRow._pmGridLine ? group.heading :
                        down && group.lines[group.lines.length - 1] === gridRow._pmGridLine &&
                            this.gridGroups[groupIndex + 1] && this.gridGroups[groupIndex + 1].heading;
                    if (heading && heading.actor.can_focus) target = heading;
                    else if (line) target = line._pmRows[Math.min(gridRow._pmGridLine._pmRows.indexOf(gridRow), line._pmRows.length - 1)];
                }
                if (target) this.focusActor(target.actor);
                return PM_Clutter.EVENT_STOP;
            }
        }
        const actors = this._focusActors();
        const index = actors.indexOf(actor);
        if (index === -1) return PM_Clutter.EVENT_PROPAGATE;
        const backwards = key === PM_Clutter.KEY_Up || key === PM_Clutter.KEY_KP_Up || key === PM_Clutter.KEY_ISO_Left_Tab;
        const forwards = key === PM_Clutter.KEY_Down || key === PM_Clutter.KEY_KP_Down || key === PM_Clutter.KEY_Tab;
        if (backwards || forwards) {
            const target = actors[index + (backwards ? -1 : 1)];
            if (target) this.focusActor(target);
            else if (this.applet._pmPersonalActive && actors.length)
                this.focusActor(actors[backwards ? actors.length - 1 : 0]);
            else this.applet._pmFocusMenu();
            return PM_Clutter.EVENT_STOP;
        }
        const rtl = actor.get_direction() === PM_St.TextDirection.RTL;
        if (header && key === (rtl ? PM_Clutter.KEY_Right : PM_Clutter.KEY_Left)) {
            this.closeDrawer(header);
            header.actor.grab_key_focus();
            return PM_Clutter.EVENT_STOP;
        }
        return PM_Clutter.EVENT_PROPAGATE;
    }

    handleSearchKey(event) {
        const key = event.get_key_symbol();
        if ((key === PM_Clutter.KEY_Return || key === PM_Clutter.KEY_KP_Enter) && this.resultRows.length > 0) {
            this.resultRows[0].activate(event);
            return PM_Clutter.EVENT_STOP;
        }
        const actors = this._focusActors();
        const backwards = key === PM_Clutter.KEY_Up || key === PM_Clutter.KEY_KP_Up || key === PM_Clutter.KEY_ISO_Left_Tab;
        const forwards = key === PM_Clutter.KEY_Down || key === PM_Clutter.KEY_KP_Down || key === PM_Clutter.KEY_Tab;
        if ((backwards || forwards) && actors.length) {
            this.focusActor(actors[backwards ? actors.length - 1 : 0]);
            return PM_Clutter.EVENT_STOP;
        }
        return PM_Clutter.EVENT_PROPAGATE;
    }

    destroy() {
        if (this.destroyed) return;
        this.destroyed = true;
        this.closeAll(false);
        this.closeApplicationContextMenu(false, true);
        this.clearGrid();
        const scrollbar = this.scrollView.get_vscroll_bar();
        scrollbar.disconnect(this._scrollStart);
        scrollbar.disconnect(this._scrollStop);
        this.applet.menu.passEvents = false;
        this.categorySection.destroy();
        this.resultSection.destroy();
        this.systemSection.destroy();
        if (this.contextMenu) this.contextMenu.destroy();
        this.contextMenu = null;
        this.actor.destroy();
    }
}


/*
 * CustomApplicationsMenu data import
 * Copyright (C) 2026 rasmarc
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

// Parse data only. Importing never executes a command or changes the source.
function _pmParseCustomApplications(value, resolve, otherName = _("Other")) {
    if (!Array.isArray(value)) throw new Error(_("The file must contain a list of menu entries."));
    const groups = new Map();
    let count = 0, ignored = 0, unavailable = 0;
    const text = (item, key) => {
        if (item[key] !== undefined && typeof item[key] !== "string")
            throw new Error(_("Invalid text field: %s").format(key));
        return item[key];
    };
    const groupFor = (path, icon) => {
        const id = "pm-custom:" + JSON.stringify(path);
        if (!groups.has(id)) groups.set(id, { id, name: path.length ? path.map(part => part[0]).join(" › ") :
            otherName, icon: icon || "applications-other", entries: [], occurrences: new Map() });
        return groups.get(id);
    };
    const visit = (items, path, icon) => {
        if (path.length > 32) throw new Error(_("The menu nesting is too deep."));
        const names = new Map();
        for (const item of items) {
            if (++count > 10000) throw new Error(_("The import file contains too many entries."));
            if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error(_("Invalid menu entry."));
            if (item.active !== undefined && typeof item.active !== "boolean") throw new Error(_("Invalid enabled value."));
            if (item.active === false) { ignored++; continue; }
            const name = text(item, "displayName"), image = text(item, "iconName");
            const command = text(item, "command"), desktop = text(item, "desktopFile");
            if ("menu" in item) {
                if (!Array.isArray(item.menu)) throw new Error(_("A submenu does not contain a valid list."));
                const label = name || _("Submenu"), number = (names.get(label) || 0) + 1;
                names.set(label, number);
                const child = [...path, [label, number]];
                groupFor(child, image);
                visit(item.menu, child, image);
                continue;
            }
            if (command === "S") {
                const group = groups.get("pm-custom:" + JSON.stringify(path));
                if (group) group.entries.push({ type: "separator" });
                else ignored++;
                continue;
            }
            const desktopId = desktop ? desktop.endsWith(".desktop") ? desktop : desktop + ".desktop" : null;
            const original = desktopId && resolve(desktopId);
            if (command !== undefined && !command.trim()) throw new Error(_("A command is empty."));
            if (!command && !desktopId) throw new Error(_("An entry has neither an application ID nor a command."));
            if (!command && !original) unavailable++;
            const entry = { appId: command ? "pm-command:" + command : desktopId,
                name: name || original && original.name || desktop || command.trim().split(/\s+/)[0] };
            if (command) entry.command = command;
            if (desktopId && command) entry.desktopId = desktopId;
            if (image) entry.icon = image;
            const group = groupFor(path, icon);
            const identity = JSON.stringify([desktopId, command || null, entry.name, image || null]);
            const number = (group.occurrences.get(identity) || 0) + 1;
            group.occurrences.set(identity, number);
            entry.importKey = JSON.stringify([group.id, identity, number]);
            group.entries.push(entry);
        }
    };
    visit(value, [], null);
    for (const group of groups.values()) {
        const entries = [];
        let pending = false;
        for (const entry of group.entries) {
            if (entry.type === "separator") {
                if (!entries.length || pending) ignored++;
                else pending = true;
                continue;
            }
            if (pending) entries.push({ type: "separator", importKey: JSON.stringify([
                group.id, "separator", entries[entries.length - 1].importKey, entry.importKey]) });
            pending = false;
            entries.push(entry);
        }
        if (pending) ignored++;
        group.entries = entries;
    }
    return { groups: Array.from(groups.values(), group => ({ id: group.id, name: group.name,
        icon: group.icon, entries: group.entries })), ignored, unavailable };
}


/*
 * SuperMenu personal entries
 * Copyright (C) 2026 rasmarc
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

class PM_PersonalStore {
    constructor(commandForApp = () => "") {
        this.commandForApp = commandForApp;
        this.path = PM_GLib.build_filenamev([PM_GLib.get_user_config_dir(),
            "cinnamon", "spices", "supermenu@rasmarc", "personal-menu.json"]);
        this.state = { version: 4, nextId: 1, categories: [] };
        this.error = null;
        const file = PM_Gio.file_new_for_path(this.path);
        try {
            if (file.query_exists(null)) {
                const [ok, bytes] = file.load_contents(null);
                if (!ok) throw new Error(_("Could not read the custom menu"));
                const saved = JSON.parse(imports.byteArray.toString(bytes));
                this.state = this.validate(saved);
            }
        } catch (error) {
            // Preserve unreadable/unknown files rather than overwriting them.
            this.error = String(error);
            global.logError(error, "SuperMenu: read custom menu");
        }
    }

    validate(value) {
        if (!value || value.version !== 4 || !Array.isArray(value.categories))
            throw new Error(_("Unknown custom menu format"));
        let nextId = value.nextId;
        if (!Number.isSafeInteger(nextId) || nextId < 1)
            throw new Error(_("Invalid entry ID"));
        const seen = new Set(), categoryIds = new Set(), categories = [];
        for (const source of value.categories) {
            const entries = source && source.entries;
            if (!source || typeof source.id !== "string" || !source.id || !Array.isArray(entries))
                throw new Error(_("Invalid custom menu category"));
            if (categoryIds.has(source.id)) throw new Error(_("Duplicate custom menu category ID"));
            categoryIds.add(source.id);
            const category = { id: source.id, name: String(source.name || _("Miscellaneous")),
                icon: String(source.icon || "applications-other"), entries: [] };
            if (source.iconOverride !== undefined) {
                if (typeof source.iconOverride !== "boolean") throw new Error(_("Invalid icon assignment"));
                if (source.iconOverride) category.iconOverride = true;
            }
            if (source.imports !== undefined) {
                if (!Array.isArray(source.imports) || source.imports.some(id => typeof id !== "string"))
                    throw new Error(_("Invalid import assignment"));
                category.imports = [...new Set(source.imports)];
            }
            categories.push(category);
            for (const saved of entries) {
                let entry;
                if (!saved || typeof saved.id !== "string" || !/^entry-[1-9]\d*$/.test(saved.id) || seen.has(saved.id))
                    throw new Error(_("Invalid application entry"));
                const number = Number(saved.id.slice(6));
                if (!Number.isSafeInteger(number) || number >= Number.MAX_SAFE_INTEGER)
                    throw new Error(_("Invalid entry ID"));
                nextId = Math.max(nextId, number + 1);
                if (saved.type === "separator") {
                    entry = { id: saved.id, type: "separator" };
                    if (saved.importKey !== undefined) {
                        if (typeof saved.importKey !== "string" || !saved.importKey)
                            throw new Error(_("Invalid import assignment"));
                        entry.importKey = saved.importKey;
                    }
                    seen.add(entry.id);
                    category.entries.push(entry);
                    continue;
                }
                if (saved.type !== undefined || typeof saved.appId !== "string" || !saved.appId ||
                    typeof saved.name !== "string" || !Number.isSafeInteger(saved.copy) || saved.copy < 0)
                    throw new Error(_("Invalid application entry"));
                entry = { id: saved.id, appId: saved.appId, name: saved.name, copy: saved.copy };
                for (const key of ["command", "icon", "desktopId", "importKey"]) {
                    if (saved[key] !== undefined) {
                        if (typeof saved[key] !== "string" || !saved[key])
                            throw new Error(_("Invalid custom application entry"));
                        entry[key] = saved[key];
                    }
                }
                seen.add(entry.id);
                category.entries.push(entry);
            }
        }
        return { version: 4, nextId, categories };
    }

    has(appId) {
        return this.state.categories.some(category => category.entries.some(entry => entry.appId === appId));
    }

    validText(value) {
        return typeof value === "string" && value.trim().length > 0 && !/[\0\r\n]/.test(value);
    }

    rename(categoryId, entryId, name) {
        if (this.error || !this.validText(name)) return false;
        const next = this.validate(this.state);
        const category = next.categories.find(item => item.id === categoryId);
        const target = entryId ? category && category.entries.find(item => item.id === entryId &&
            item.type !== "separator") : category;
        if (!target) return false;
        target.name = name.trim();
        return this.save(next);
    }

    createCategory(name) {
        if (this.error || !this.validText(name)) return false;
        const next = this.validate(this.state);
        const category = this.newCategory(next, name.trim());
        return category && this.save(next) ? category.id : false;
    }

    newCategory(next, name) {
        const id = "pm-category:" + PM_GLib.uuid_string_random();
        if (next.categories.some(item => item.id === id || (item.imports || []).includes(id))) return null;
        const category = { id, name, icon: "folder", entries: [] };
        next.categories.push(category);
        return category;
    }

    createEntry(categoryId, name, command) {
        if (this.error || !this.validText(name) || !this.validText(command)) return false;
        const next = this.validate(this.state);
        const category = categoryId ? next.categories.find(item => item.id === categoryId) :
            next.categories[0] || this.newCategory(next, _("Custom entries"));
        if (!category || next.nextId >= Number.MAX_SAFE_INTEGER) return false;
        const id = "entry-" + next.nextId++;
        category.entries.push({ id, appId: "pm-command:" + PM_GLib.uuid_string_random(), name: name.trim(), copy: 0,
            command: command.trim(), icon: "application-x-executable" });
        return this.save(next) ? { id, categoryId: category.id } : false;
    }

    setCommand(entryId, command) {
        if (this.error || !this.validText(command)) return false;
        const next = this.validate(this.state);
        const entry = next.categories.flatMap(category => category.entries)
            .find(item => item.id === entryId && item.type !== "separator");
        if (!entry) return false;
        entry.command = command.trim();
        return this.save(next);
    }

    setIcon(categoryId, entryId, icon, defaultIcon) {
        if (this.error || !this.validText(icon)) return false;
        try { PM_Gio.icon_new_for_string(icon); }
        catch (error) { return false; }
        const next = this.validate(this.state);
        const category = next.categories.find(item => item.id === categoryId);
        const target = entryId ? category && category.entries.find(item => item.id === entryId &&
            item.type !== "separator") : category;
        if (!target) return false;
        target.icon = icon.trim();
        if (!entryId) {
            if (target.icon === defaultIcon) delete target.iconOverride;
            else target.iconOverride = true;
        }
        return this.save(next);
    }

    removeCategory(categoryId) {
        if (this.error || !this.state.categories.some(category => category.id === categoryId)) return false;
        const next = this.validate(this.state);
        next.categories = next.categories.filter(category => category.id !== categoryId);
        return this.save(next);
    }

    entryAppId(entry) {
        return entry.desktopId || entry.appId;
    }

    entryCommand(entry) {
        return entry.command || this.commandForApp(this.entryAppId(entry)) || "";
    }

    commandKey(command) {
        if (!command) return null;
        // Multiple commands use the existing semicolon convention. Compare
        // those verbatim rather than treating them as one argument vector.
        if (command.includes(";")) return JSON.stringify({ commands: command.trim() });
        try {
            const [ok, argv] = PM_GLib.shell_parse_argv(command);
            if (!ok || !argv.length) return null;
            argv[0] = PM_GLib.find_program_in_path(argv[0]) || argv[0];
            return JSON.stringify(argv);
        } catch (error) {
            return null;
        }
    }

    sameProgram(entry, source) {
        if (entry.type === "separator" || source.type === "separator") return false;
        const id = this.entryAppId(entry);
        if (id && id === this.entryAppId(source)) return true;
        // Different desktop IDs remain distinct. Command-only imports and
        // edited entries can also identify a program by its complete command.
        if (!entry.command && !source.command) return false;
        const command = this.commandKey(this.entryCommand(entry));
        return command !== null && command === this.commandKey(this.entryCommand(source));
    }

    matchCategory(source, categories = this.state.categories) {
        const exact = categories.find(category => category.id === source.id);
        if (exact) return exact;
        const imported = categories.filter(category => (category.imports || []).includes(source.id));
        if (imported.length) return imported.length === 1 ? imported[0] : null;
        const named = categories.filter(category => category.name === source.name);
        // Equal names are allowed in the editor. Only an unambiguous name
        // can identify the program category without an explicit target choice.
        return named.length === 1 ? named[0] : null;
    }

    categoryTargets(entry, source = null) {
        const current = source && this.matchCategory(source);
        const targets = this.state.categories.map(category => ({ category, existing: true,
            current: !!current && category.id === current.id,
            count: category.entries.filter(item => this.sameProgram(item, entry)).length }));
        if (source && !current)
            targets.push({ category: source, existing: false, current: true, count: 0 });
        return targets;
    }

    add(appId, name, sourceCategory, existingOnly = false) {
        if (this.error) return false;
        const next = this.validate(this.state);
        const copies = next.categories.flatMap(category => category.entries)
            .filter(entry => this.sameProgram(entry, { appId }));
        const copy = copies.length ? Math.max(...copies.map(entry => entry.copy)) + 1 : 0;
        if (next.nextId >= Number.MAX_SAFE_INTEGER || !Number.isSafeInteger(copy)) return false;
        let category = existingOnly ? next.categories.find(item => item.id === sourceCategory.id) :
            this.matchCategory(sourceCategory, next.categories);
        if (!category && existingOnly) return false;
        if (!category) {
            category = { ...sourceCategory, entries: [] };
            next.categories.push(category);
        }
        category.entries.push({ id: "entry-" + next.nextId++, appId, name, copy });
        return this.save(next);
    }

    mergeCategory(sourceCategory, programs) {
        if (this.error) return false;
        const next = this.validate(this.state);
        let category = this.matchCategory(sourceCategory, next.categories);
        const present = category ? category.entries.slice() : [];
        const missing = programs.filter(program => {
            if (present.some(entry => this.sameProgram(entry, program))) return false;
            present.push(program);
            return true;
        });
        // Repeating a category action is a successful no-op. Existing copies,
        // names and independent entry IDs are never changed by a bulk merge.
        if (!missing.length && category) return true;
        if (next.nextId > Number.MAX_SAFE_INTEGER - missing.length) return false;
        if (!category) {
            category = { ...sourceCategory, entries: [] };
            next.categories.push(category);
        }
        for (const program of missing)
            category.entries.push({ id: "entry-" + next.nextId++, appId: program.appId,
                name: program.name, copy: 0 });
        return this.save(next);
    }

    importCategories(groups, replace = false) {
        if (this.error) throw new Error(this.error);
        const next = replace ? { version: 4, nextId: 1, categories: [] } : this.validate(this.state);
        let added = 0, created = 0, separators = 0, changed = false;
        for (const source of groups) {
            const other = source.id === "pm-custom:[]";
            let category = (other && (next.categories.find(group => group.name === source.name) ||
                next.categories.find(group => [_("Other"), "Other"].includes(group.name)))) ||
                next.categories.find(group => group.id === source.id ||
                (group.imports || []).includes(source.id)) ||
                next.categories.find(group => group.name === source.name);
            if (!category) {
                category = { id: source.id, name: source.name, icon: source.icon, entries: [] };
                next.categories.push(category);
                created++;
            }
            if (other && category.id === source.id && category.name === _("General")) {
                category.name = source.name;
                changed = true;
            }
            if (!(category.imports || []).includes(source.id)) {
                category.imports = [...(category.imports || []), source.id];
                changed = true;
            }
            const present = new Set(category.entries.map(entry => entry.importKey).filter(Boolean));
            for (const entry of source.entries) {
                if (entry.type === "separator" || present.has(entry.importKey)) continue;
                if (next.nextId >= Number.MAX_SAFE_INTEGER) throw new Error(_("Too many custom entries"));
                category.entries.push({ ...entry, id: "entry-" + next.nextId++, copy: 0 });
                present.add(entry.importKey);
                added++; changed = true;
            }
            // Existing target entries keep their order. Insert imported lines
            // between their stable source neighbours, including imports made
            // before separators were supported. Reversed target neighbours
            // retain their order; the line still separates the two sides.
            for (let index = 0; index < source.entries.length; index++) {
                const entry = source.entries[index];
                if (entry.type !== "separator" || present.has(entry.importKey)) continue;
                const left = source.entries[index - 1], right = source.entries[index + 1];
                const before = left && category.entries.findIndex(item => item.importKey === left.importKey);
                const after = right && category.entries.findIndex(item => item.importKey === right.importKey);
                if (!(before >= 0 && after >= 0 && before !== after)) continue;
                if (next.nextId >= Number.MAX_SAFE_INTEGER) throw new Error(_("Too many custom entries"));
                category.entries.splice(Math.max(before, after), 0, { type: "separator", id: "entry-" + next.nextId++,
                    importKey: entry.importKey });
                present.add(entry.importKey);
                separators++; changed = true;
            }
        }
        if ((changed || replace) && !this.save(next)) throw new Error(_("Could not save the custom menu."));
        return { added, created, separators };
    }

    exportContent() {
        if (this.error) throw new Error(this.error);
        return { format: "SuperMenu", ...this.validate(this.state) };
    }

    importContent(value, replace = false) {
        if (this.error) throw new Error(this.error);
        const source = this.validate(value);
        if (replace) {
            if (!this.save(source)) throw new Error(_("Could not save the custom menu."));
            return { added: source.categories.reduce((sum, group) => sum + group.entries
                .filter(entry => entry.type !== "separator").length, 0), created: source.categories.length,
                separators: source.categories.reduce((sum, group) => sum + group.entries
                    .filter(entry => entry.type === "separator").length, 0) };
        }
        const next = this.validate(this.state);
        const identity = entry => JSON.stringify([entry.appId, entry.name, entry.copy,
            entry.command || null, entry.icon || null, entry.desktopId || null]);
        const usedCategories = new Set();
        let added = 0, created = 0, separators = 0, changed = false;
        const allocate = entry => {
            if (next.nextId >= Number.MAX_SAFE_INTEGER) throw new Error(_("Too many custom entries"));
            return { ...entry, id: "entry-" + next.nextId++ };
        };
        for (const group of source.categories) {
            let target = next.categories.find(category => !usedCategories.has(category.id) &&
                (category.id === group.id || (category.imports || []).includes(group.id))) ||
                next.categories.find(category => !usedCategories.has(category.id) && category.name === group.name);
            if (!target) {
                // An earlier source group may already have matched this ID's
                // local category by name. Give the second group its own ID
                // and remember the source identity for repeat imports.
                const id = next.categories.some(category => category.id === group.id) ?
                    "pm-category:" + PM_GLib.uuid_string_random() : group.id;
                if (next.categories.some(category => category.id === id))
                    throw new Error(_("Could not create a unique category ID."));
                target = { ...group, id, entries: group.entries.map(allocate) };
                if (id !== group.id)
                    target.imports = [...new Set([...(group.imports || []), group.id])];
                next.categories.push(target);
                usedCategories.add(target.id);
                added += group.entries.filter(entry => entry.type !== "separator").length;
                separators += group.entries.filter(entry => entry.type === "separator").length;
                created++; changed = true;
                continue;
            }
            usedCategories.add(target.id);
            const aliases = [...new Set([...(target.imports || []), ...(group.imports || []),
                ...(group.id !== target.id ? [group.id] : [])])];
            if (aliases.length !== (target.imports || []).length) {
                target.imports = aliases;
                changed = true;
            }
            // Local entry-N IDs are scoped to one menu. Match complete content
            // and occurrence counts, then allocate fresh IDs only for additions.
            // Equal-looking independent copies are never collapsed into one.
            const available = new Map(), mapped = new Map();
            for (const entry of target.entries.filter(entry => entry.type !== "separator")) {
                const key = identity(entry);
                if (!available.has(key)) available.set(key, []);
                available.get(key).push(entry);
            }
            for (const entry of group.entries.filter(entry => entry.type !== "separator")) {
                const matching = available.get(identity(entry));
                let saved = matching && matching.shift();
                if (!saved) {
                    saved = allocate(entry);
                    target.entries.push(saved);
                    added++; changed = true;
                } else if (!saved.importKey && entry.importKey) {
                    saved.importKey = entry.importKey;
                    changed = true;
                }
                mapped.set(entry.id, saved);
            }
            let previous = null, pending = null;
            for (const entry of group.entries) {
                if (entry.type === "separator") {
                    if (previous && !pending) pending = entry;
                    continue;
                }
                const current = mapped.get(entry.id);
                if (pending) {
                    const left = target.entries.indexOf(previous), right = target.entries.indexOf(current);
                    const start = Math.min(left, right), end = Math.max(left, right);
                    const existing = target.entries.slice(start + 1, end).find(item => item.type === "separator");
                    if (!existing) {
                        target.entries.splice(end, 0, allocate(pending));
                        separators++; changed = true;
                    } else if (!existing.importKey && pending.importKey) {
                        existing.importKey = pending.importKey;
                        changed = true;
                    }
                }
                previous = current;
                pending = null;
            }
        }
        if (changed && !this.save(next)) throw new Error(_("Could not save the custom menu."));
        return { added, created, separators };
    }

    remove(entryId) {
        if (this.error) return false;
        const next = this.validate(this.state);
        if (!next.categories.some(category => category.entries.some(entry => entry.id === entryId))) return false;
        for (const category of next.categories) {
            const entries = [];
            let pending = null;
            for (const entry of category.entries) {
                if (entry.id === entryId) continue;
                if (entry.type === "separator") {
                    if (entries.length && !pending) pending = entry;
                } else {
                    if (pending) entries.push(pending);
                    pending = null;
                    entries.push(entry);
                }
            }
            category.entries = entries;
        }
        // Categories are independent editable objects, including empty ones.
        return this.save(next);
    }

    copy(entryId, categoryId) {
        if (this.error) return false;
        const next = this.validate(this.state);
        const source = next.categories.find(group => group.entries.some(entry => entry.id === entryId));
        const category = next.categories.find(item => item.id === categoryId);
        if (!source || !category || next.nextId >= Number.MAX_SAFE_INTEGER) return false;
        const entry = source.entries.find(item => item.id === entryId);
        if (entry.type === "separator") return false;
        const copy = source.id === categoryId ? Math.max(...category.entries
            .filter(item => item.appId === entry.appId && item.name === entry.name).map(item => item.copy)) + 1 : entry.copy;
        if (!Number.isSafeInteger(copy)) return false;
        category.entries.push({ ...entry, id: "entry-" + next.nextId++, copy });
        return this.save(next);
    }

    move(categoryId, entryId, direction, visibleIds = null) {
        if (this.error || ![-1, 1].includes(direction)) return false;
        const next = this.validate(this.state);
        const category = entryId && next.categories.find(item => item.id === categoryId);
        const items = entryId ? category && category.entries : next.categories;
        if (!items) return false;
        const visible = visibleIds && new Set(visibleIds);
        const ordered = items.filter(item => item.type !== "separator" && (!visible || visible.has(item.id)));
        const index = ordered.findIndex(item => item.id === (entryId || categoryId));
        const target = ordered[index + direction];
        if (index < 0 || !target) return false;
        // Swap program slots, leaving separator boundaries in place. List and
        // grid therefore move one program per click just as drawers do.
        const from = items.indexOf(ordered[index]), to = items.indexOf(target);
        [items[from], items[to]] = [items[to], items[from]];
        return this.save(next);
    }

    addSeparator(entryId) {
        if (this.error) return false;
        const next = this.validate(this.state);
        const category = next.categories.find(group => group.entries.some(entry => entry.id === entryId));
        if (!category || next.nextId >= Number.MAX_SAFE_INTEGER) return false;
        const index = category.entries.findIndex(entry => entry.id === entryId);
        if (category.entries[index].type === "separator" || !category.entries[index + 1] ||
            category.entries[index + 1].type === "separator") return false;
        category.entries.splice(index + 1, 0, { id: "entry-" + next.nextId++, type: "separator" });
        return this.save(next);
    }

    save(next) {
        try {
            if (this.error) return false;
            if (PM_GLib.mkdir_with_parents(PM_GLib.path_get_dirname(this.path), 0o700) !== 0)
                throw new Error(_("Could not create the storage directory"));
            const result = PM_Gio.file_new_for_path(this.path).replace_contents(
                JSON.stringify(next, null, 2) + "\n", null, false,
                PM_Gio.FileCreateFlags.REPLACE_DESTINATION | PM_Gio.FileCreateFlags.PRIVATE, null);
            if (Array.isArray(result) && result[0] === false) throw new Error(_("Save failed."));
            this.state = next;
            return true;
        } catch (error) {
            global.logError(error, "SuperMenu: save custom menu");
            return false;
        }
    }
}

// Personal entries are data for the drawer/list presentation, with no native
// table actors, hover handlers or table selection state.
class PM_PersonalEntry {
    constructor(applet, entry, original, categoryId) {
        this.applet = applet;
        original = original || {};
        this.app = entry.command ? { get_id: () => entry.appId, open_new_window: () => {
            for (const command of entry.command.split(";").map(value => value.trim()).filter(Boolean))
                imports.misc.util.spawnCommandLine(command);
        } } : original.app;
        this.name = entry.name || original.name;
        this.description = entry.command || original.description || "";
        this.icon = original.icon || { icon_name: "application-x-executable" };
        if (entry.icon) {
            try { this.icon = { gicon: PM_Gio.icon_new_for_string(entry.icon) }; }
            catch (error) { this.icon = { icon_name: "application-x-executable" }; }
        }
        this.category = [categoryId];
        this._pmEntryId = entry.id;
        this.withMenu = true;
    }

    activate() {
        if (this.applet._pmExecutionBlocked()) return;
        try { this.app.open_new_window(-1); }
        catch (error) {
            PM_Main.notifyError("SuperMenu", _("Could not launch the entry: %s").format(String(error)));
            return;
        }
        this.applet.menu.close();
    }

}

class PM_PersonalMenu {
    constructor(applet) {
        this.applet = applet;
        this.store = new PM_PersonalStore(id => this.programCommand(id));
        this.active = false;
        this.refreshing = false;
        this.pendingRefresh = 0;
        this.captureCatalog();
    }

    iconString(icon) {
        if (!icon) return "applications-other";
        const gicon = icon.gicon || (typeof icon.get_gicon === "function" && icon.get_gicon());
        return gicon && typeof gicon.to_string === "function" && gicon.to_string() ||
            icon.icon_name || "applications-other";
    }

    programCommand(appId) {
        const button = (this.catalogApps || []).find(item => item.app.get_id() === appId);
        const info = button && typeof button.app.get_app_info === "function" && button.app.get_app_info();
        const command = info && typeof info.get_commandline === "function" && info.get_commandline();
        // The menu starts without file/URI arguments. Retain all actual
        // options and quoting; these standalone desktop fields add no argument.
        return command ? command.replace(/(^|\s)%[fFuU](?=\s|$)/g, "").trim() : "";
    }

    categoryIcon(group) {
        const native = this.catalogCategories.find(category => String(category.categoryId) === group.id);
        if (native && native.icon && !group.iconOverride) return native.icon;
        try {
            return { gicon: PM_Gio.icon_new_for_string(group.icon) };
        } catch (error) {
            return { icon_name: "applications-other" };
        }
    }

    captureCatalog() {
        this.catalogApps = (this.applet._applicationsButtons || []).slice();
        this.catalogCategories = (this.applet._categoryButtons || []).slice();
        this.catalogAll = this.applet._allAppsCategoryButton;
        const names = new Map(this.catalogApps.map(button => [button.app.get_id(), button.name]));
        for (const group of this.store.state.categories) {
            for (const entry of group.entries)
                if (!entry.name && names.has(entry.appId)) entry.name = names.get(entry.appId);
            // Follow the catalog's current theme icon unless the category
            // has an explicitly chosen icon of its own.
            const native = this.catalogCategories.find(category => String(category.categoryId) === group.id);
            if (native && native.icon && !group.iconOverride) group.icon = this.iconString(native.icon);
        }
    }

    restoreCatalog() {
        const a = this.applet;
        a._applicationsButtons = this.catalogApps.slice();
        a._categoryButtons = this.catalogCategories.slice();
        a._allAppsCategoryButton = this.catalogAll;
        for (const category of this.catalogCategories) if (category.actor) category.actor.show();
    }

    beforeCatalogRefresh() {
        this.refreshing = true;
        if (this.active) {
            this.applet._pmFocusMenu();
            this.restoreCatalog();
        }
    }

    afterCatalogRefresh() {
        this.captureCatalog();
        this.refreshing = false;
        if (this.active) this.activate(true, true);
    }

    sourceCategory(button, preferred) {
        const candidates = this.catalogCategories.filter(category => category.categoryId != null &&
            !["recent", "favorite"].includes(category.categoryId) && (button.category || []).includes(category.categoryId));
        const category = (!this.applet.searchActive && candidates.find(item => item.categoryId === preferred)) || candidates[0];
        return category ? { id: String(category.categoryId), name: category.name, icon: this.iconString(category.icon) } :
            { id: "pm-personal-other", name: _("Miscellaneous"), icon: "applications-other" };
    }

    isProgramCategory(category) {
        return category && category.categoryId != null &&
            !["recent", "favorite"].includes(category.categoryId);
    }

    importMenu(path, replace = false) {
        try {
            if (!path) throw new Error(_("Please choose a file to import."));
            const file = path.startsWith("file://") ? PM_Gio.file_new_for_uri(path) : PM_Gio.file_new_for_path(path);
            if (!file.is_native()) throw new Error(_("Could not read the file."));
            const info = file.query_info("standard::type,standard::size", PM_Gio.FileQueryInfoFlags.NONE, null);
            // A pipe or device can block the shell even when its reported size is zero.
            if (info.get_file_type() !== PM_Gio.FileType.REGULAR)
                throw new Error(_("Could not read the file."));
            if (info.get_size() > 32 * 1024 * 1024)
                throw new Error(_("The import file exceeds 32 MB."));
            const [ok, bytes] = file.load_contents(null);
            if (!ok) throw new Error(_("Could not read the file."));
            const contents = imports.byteArray.toString(bytes);
            if (bytes.length > 32 * 1024 * 1024 || contents.length > 32 * 1024 * 1024)
                throw new Error(_("The import file is too large."));
            const catalog = new Map(this.catalogApps.map(button => [button.app.get_id(), button]));
            const value = JSON.parse(contents.replace(/^\uFEFF/, ""));
            let result, ignored = 0, unavailable = 0;
            replace = replace === true;
            if (Array.isArray(value)) {
                if (bytes.length > 2 * 1024 * 1024 || contents.length > 2 * 1024 * 1024)
                    throw new Error(_("The CustomApplicationsMenu file exceeds 2 MB."));
                const parsed = _pmParseCustomApplications(value, id => catalog.get(id), _("Other"));
                result = this.store.importCategories(parsed.groups, replace);
                ignored = parsed.ignored;
                unavailable = parsed.unavailable;
            } else {
                if (!value || typeof value !== "object" ||
                    (value.format !== undefined && value.format !== "SuperMenu" && value.format !== "EigenMenu"))
                    throw new Error(_("The file does not contain a supported menu format."));
                const source = this.store.validate(value);
                // Localize bundled examples once, before they become user data.
                // Backups with the same filename elsewhere remain verbatim.
                const templatePath = file.get_path();
                const bundledTemplate = ["simple.json", "with-categories.json"].some(name =>
                    templatePath === this.applet._pmSourcePath + "/templates/" + name);
                if (bundledTemplate) {
                    for (const group of source.categories) {
                        group.name = _(group.name);
                        for (const entry of group.entries)
                            if (entry.type !== "separator") entry.name = _(entry.name);
                    }
                }
                for (const group of source.categories) for (const entry of group.entries) {
                    if (entry.type === "separator") continue;
                    if (!entry.command && !catalog.has(entry.appId)) unavailable++;
                    if (!entry.name && catalog.has(entry.appId)) entry.name = catalog.get(entry.appId).name;
                }
                result = this.store.importContent(source, replace);
            }
            if (replace && this.applet && this.applet._pmEditor) {
                this.applet._pmEditor.cancelIconPicker();
                this.applet._pmEditor.clearSelection();
            }
            if (this.active) this.queueRefresh();
            return { ok: true, ...result, replaced: replace, ignored, unavailable };
        } catch (error) {
            return { ok: false, message: String(error.message || error) };
        }
    }

    exportMenu(path) {
        try {
            if (!path) throw new Error(_("Please choose a backup file."));
            const file = path.startsWith("file://") ? PM_Gio.file_new_for_uri(path) : PM_Gio.file_new_for_path(path);
            if (file.equal(PM_Gio.file_new_for_path(this.store.path)))
                throw new Error(_("Please choose a file other than the active menu data."));
            const value = this.store.exportContent();
            const bytes = imports.byteArray.fromString(JSON.stringify(value, null, 2) + "\n");
            if (bytes.length > 32 * 1024 * 1024) throw new Error(_("The backup exceeds 32 MB."));
            const saved = file.replace_contents(bytes, null, false,
                PM_Gio.FileCreateFlags.REPLACE_DESTINATION | PM_Gio.FileCreateFlags.PRIVATE, null);
            if (Array.isArray(saved) && saved[0] === false) throw new Error(_("Save failed."));
            return { ok: true, categories: value.categories.length,
                entries: value.categories.reduce((sum, group) => sum + group.entries
                    .filter(entry => entry.type !== "separator").length, 0) };
        } catch (error) {
            return { ok: false, message: String(error.message || error) };
        }
    }

    addCategoryContextAction(menu, category) {
        if (!this.applet._pmPersonalEnabled) return;
        if (this.applet._pmPersonalActive || !this.isProgramCategory(category)) return;
        const item = new PM_PopupMenu.PopupIconMenuItem(_("Add to custom menu"),
            "starred-symbolic", PM_St.IconType.SYMBOLIC);
        item._pmPersonalAction = true;
        item._action = "add_category_to_personal_menu";
        item.activate = () => {
            if (!this.applet._pmPersonalEnabled) return false;
            const programs = this.catalogApps.filter(button =>
                (button.category || []).includes(category.categoryId)).map(button =>
                ({ appId: button.app.get_id(), name: button.name }));
            const saved = this.store.mergeCategory({ id: String(category.categoryId),
                name: category.name, icon: this.iconString(category.icon) }, programs);
            if (!saved) {
                if (typeof PM_Main.notifyError === "function")
                    PM_Main.notifyError("SuperMenu", _("Could not add the category to the custom menu."));
                return false;
            }
            this.confirmAdded(menu, item, category);
            return false;
        };
        menu.addMenuItem(item);
    }

    confirmAdded(menu, action, category) {
        this.applet._pmFlashPersonalButton();
        // Keep the source action visible. Collapse only its category picker;
        // native release dispatch can finish without replacing its source row.
        action.actor.grab_key_focus();
        if (action.menu) action.menu.close(false);
        this.applet._pmEditor.showActionFeedback(action, _("Added to: %s").format(category.name), null, menu);
        if (this.applet._pmIsDrawerView()) this.applet._pmDrawer.syncContextLayout();
        else this.applet._scrollToButton(menu);
    }

    closeAddedContext(menu) {
        if (this.applet._pmIsDrawerView() && this.applet._pmDrawer)
            this.applet._pmDrawer.closeApplicationContextMenu(true);
        else {
            this.applet._pmFocusMenu();
            menu.close(false);
        }
    }

    activate(personal, force = false) {
        if (personal && !this.applet._pmPersonalEnabled) return;
        if (this.active === personal && !force) return;
        const a = this.applet;
        a._pmFocusMenu();
        if (a._searchTimeoutId) PM_Mainloop.source_remove(a._searchTimeoutId);
        a._searchTimeoutId = 0;
        if (a._pmDrawer) a._pmDrawer.closeApplicationContextMenu(false, true);
        if (typeof a.closeContextMenu === "function") a.closeContextMenu(false);
        this.restoreCatalog();
        this.active = personal;
        a._pmPersonalActive = personal;
        a._pmUpdateMenuIcons(false);
        a.menu.sourceActor = personal ? a._pmSecondary : a._pmPrimary;
        a.searchEntry.set_text("");
        a.searchActive = false;
        a._previousSearchPattern = "";
        a._activeActor = null;
        a._activeContainer = null;
        if (personal) {
            this.populateEntries();
            // Prevent a previously scheduled native All Applications load from
            // operating on personal metadata after a scope change.
            a.lastSelectedCategory = "pm-personal";
        } else {
            a.lastSelectedCategory = undefined;
            if (a._allAppsCategoryButton) a._allAppsCategoryButton.activate();
            else if (typeof a._select_category === "function") a._select_category(null);
        }
        this.filterActors();
        if (a._pmDrawer) a._pmDrawer.refreshPrograms();
        a._layout();
        a._size_dirty = true;
    }

    populateEntries() {
        const available = new Map(this.catalogApps.map(button => [button.app.get_id(), button]));
        const visible = entry => entry.command || available.has(entry.appId);
        const groups = this.store.state.categories;
        this.applet._categoryButtons = groups.map(group => ({
            categoryId: group.id, name: group.name, icon: this.categoryIcon(group),
            _pmItems: group.entries
        }));
        this.applet._applicationsButtons = groups.flatMap(group => group.entries
            .filter(visible)
            .map(entry => new PM_PersonalEntry(this.applet, entry,
                available.get(entry.appId) || available.get(entry.desktopId), group.id)));
    }

    filterActors() {
        if (!this.active || this.refreshing) return;
        for (const button of this.catalogApps) button.actor.hide();
        for (const category of this.catalogCategories) if (category.actor) category.actor.hide();
    }

    addContextAction(menu, button, preferredCategory) {
        if (!this.applet._pmPersonalEnabled) return;
        if (!button || !button.app) return;
        const personal = !!button._pmEntryId;
        if (personal && !this.applet._pmIsEditing()) return;
        if (!personal) {
            const appId = button.app.get_id();
            const item = _pmCategoryItem(this.applet, menu, _("Add to custom menu…"), "starred-symbolic");
            item._pmPersonalAction = true;
            item._action = "add_to_personal_menu";
            item.populateMenu = (prepare = true) => {
                item.menu.removeAll();
                for (const target of this.store.categoryTargets({ appId }, this.sourceCategory(button, preferredCategory))) {
                    const category = target.category;
                    const choice = new PM_PopupMenu.PopupMenuItem(category.name +
                        (target.existing ? "" : " (neu)") + (target.count ? " (" + target.count + "×)" : ""),
                        { focusOnHover: false });
                    choice._pmCategoryId = category.id;
                    choice.setShowDot(target.current);
                    choice.activate = event => {
                        if (!this.applet._pmPersonalEnabled) return false;
                        if (event && event.get_button && event.get_button() !== 1) return false;
                        if (!menu.isOpen || !item.menu.isOpen) return false;
                        if (!this.store.add(appId, button.name, category, target.existing)) {
                            PM_Main.notifyError("SuperMenu", _("Could not save the custom menu."));
                            return false;
                        }
                        this.confirmAdded(menu, item, category);
                        return false;
                    };
                    item.menu.addMenuItem(choice);
                }
                if (prepare) {
                    if (this.applet._pmIsDrawerView()) this.applet._pmDrawer.prepareContextItems(item.menu);
                    else this.prepareTableContext(menu, item);
                }
            };
            item.populateMenu(false);
            menu.addMenuItem(item, 0);
            if (!this.applet._pmIsDrawerView()) this.prepareTableContext(menu, item);
            return;
        }
        const item = new ApplicationContextMenuItem(button,
            _("Remove…"), "remove_from_personal_menu", "list-remove-symbolic");
        item._pmPersonalAction = true;
        item.activate = () => {
            if (!this.applet._pmIsEditing()) return false;
            const row = this.applet._pmDrawer.contextRow;
            if (row && row._pmEntryId === button._pmEntryId)
                this.applet._pmEditor.beginInput("remove-entry", row);
            return false;
        };
        menu.addMenuItem(item);
    }

    prepareTableContext(menu, picker) {
        if (!picker._pmTableContextPrepared) {
            picker._pmTableContextPrepared = true;
            picker.menu._getTopMenu = () => this.applet.menu;
            picker.menu._needsScrollbar = () => false;
            // Target labels have no icon column. Keep their natural widths out
            // of the parent actions' icon/label/arrow column alignment.
            picker.menu.getColumnWidths = () => [];
            picker.menu.setColumnWidths = () => {};
            picker.menu.connect("open-state-changed", () => {
                if (menu.isOpen) this.applet._scrollToButton(menu);
            });
        }
        for (const item of menu._getMenuItems().flatMap(item => [item, ...(item.menu ? item.menu._getMenuItems() : [])])) {
            if (item._pmCategoryKeys) continue;
            item._pmCategoryKeys = true;
            item.actor.connect("key-press-event", (actor, event) => this.handleTableContextKey(menu, event));
        }
    }

    handleTableContextKey(menu, event) {
        if (!menu || !menu.isOpen || this.applet._pmIsDrawerView()) return PM_Clutter.EVENT_PROPAGATE;
        const picker = menu._getMenuItems().find(item => item._action === "add_to_personal_menu");
        if (!picker) return PM_Clutter.EVENT_PROPAGATE;
        const items = menu._getMenuItems().flatMap(item => [item,
            ...(item.menu && item.menu.isOpen ? item.menu._getMenuItems() : [])])
            .filter(item => item.actor.visible && item.actor.can_focus && item.sensitive !== false);
        const focus = global.stage.get_key_focus();
        const current = items.find(item => focus && item.actor.contains(focus)) || this.applet._activeContextMenuItem;
        const key = event.get_key_symbol(), rtl = menu.actor.get_direction() === PM_St.TextDirection.RTL;
        const closeKey = rtl ? PM_Clutter.KEY_Right : PM_Clutter.KEY_Left;
        if (picker.menu.isOpen && (key === PM_Clutter.KEY_Escape || key === closeKey)) {
            picker.focusActor(picker.actor);
            picker.menu.close(this.applet.enableAnimation === true);
            return PM_Clutter.EVENT_STOP;
        }
        if (key === PM_Clutter.KEY_Escape || key === PM_Clutter.KEY_Menu || key === closeKey) {
            this.closeAddedContext(menu);
            return PM_Clutter.EVENT_STOP;
        }
        if (current === picker && key === (rtl ? PM_Clutter.KEY_Left : PM_Clutter.KEY_Right))
            return picker._onKeyPressEvent(picker.actor, event);
        const up = [PM_Clutter.KEY_Up, PM_Clutter.KEY_KP_Up, PM_Clutter.KEY_ISO_Left_Tab].includes(key);
        const down = [PM_Clutter.KEY_Down, PM_Clutter.KEY_KP_Down, PM_Clutter.KEY_Tab].includes(key);
        const first = key === PM_Clutter.KEY_Page_Up, last = key === PM_Clutter.KEY_Page_Down;
        if (!up && !down && !first && !last) return PM_Clutter.EVENT_PROPAGATE;
        const index = items.indexOf(current);
        const target = items[first ? 0 : last ? items.length - 1 :
            index < 0 ? (up ? items.length - 1 : 0) : (index + (up ? -1 : 1) + items.length) % items.length];
        if (target) {
            this.applet._activeContextMenuItem = target;
            target.actor.grab_key_focus();
            const viewport = this.applet.applicationsScrollView;
            // Target rows are nested below the action and category menus.
            // Convert their coordinates before using Cinnamon's scroll routine.
            this.applet._scrollToButton({ actor: { get_allocation_box: () => {
                target.actor.get_allocation_box();
                const [, top] = target.actor.get_transformed_position();
                const [, viewTop] = viewport.get_transformed_position();
                const [, height] = target.actor.get_transformed_size();
                const y = top - viewTop + viewport.get_vscroll_bar().get_adjustment().get_value();
                return { y1: y, y2: y + height };
            } } }, viewport);
        }
        return PM_Clutter.EVENT_STOP;
    }

    queueRefresh() {
        if (this.pendingRefresh) return;
        this.pendingRefresh = PM_Mainloop.idle_add(() => {
            this.pendingRefresh = 0;
            if (!this.applet._pmDisposed && this.active) this.activate(true, true);
            return false;
        });
    }

    destroy() {
        if (this.pendingRefresh) PM_Mainloop.source_remove(this.pendingRefresh);
        this.pendingRefresh = 0;
        this.restoreCatalog();
        this.active = false;
        this.applet._pmPersonalActive = false;
    }
}


/*
 * SuperMenu editing mode
 * Copyright (C) 2026 rasmarc
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

function _pmEditorFileGlyph(icon, applet, name) {
    icon.set_gicon(new PM_Gio.FileIcon({ file: PM_Gio.file_new_for_path(applet._pmSourcePath + "/" + name + ".svg") }));
    icon.set_icon_type(PM_St.IconType.SYMBOLIC);
}

function _pmCategoryItem(applet, parentMenu, label = _("Copy to"), iconName = "view-app-grid-symbolic") {
    const drawer = applet._pmIsDrawerView() ? applet._pmDrawer : null;
    class CategoryItem extends PM_PopupMenu.PopupSubMenuMenuItem {
        setColumnWidths(widths) {
            if (drawer) this._columnWidths = null;
            else super.setColumnWidths(widths);
        }

        _allocate(actor, box, flags) {
            if (drawer) PM_DrawerHeaderItem.prototype._allocate.call(this, actor, box, flags);
            else super._allocate(actor, box, flags);
        }

        focusActor(actor) {
            if (applet._pmIsEditing()) applet._pmEditor.focusActor(actor);
            else if (drawer) drawer.focusActor(actor);
            else actor.grab_key_focus();
        }

        activate() {
            if (this.sensitive === false || !parentMenu.isOpen || this.menu._pmAfterClose) return;
            if (!this.menu.isOpen && this.populateMenu) this.populateMenu();
            this.menu.toggle_with_options(applet.enableAnimation === true);
            this.focusActor(this.actor);
        }

        _onButtonReleaseEvent(actor, event) {
            if (event.get_button() !== 1) return PM_Clutter.EVENT_PROPAGATE;
            this.activate();
            return PM_Clutter.EVENT_STOP;
        }

        _onKeyPressEvent(actor, event) {
            if (!parentMenu.isOpen || this.menu._pmAfterClose) return PM_Clutter.EVENT_STOP;
            const key = event.get_key_symbol(), rtl = actor.get_direction() === PM_St.TextDirection.RTL;
            if (key === (rtl ? PM_Clutter.KEY_Left : PM_Clutter.KEY_Right)) {
                if (this.sensitive === false) return PM_Clutter.EVENT_STOP;
                if (!this.menu.isOpen && this.populateMenu) this.populateMenu();
                this.menu.open(applet.enableAnimation === true);
                if (this.menu.firstMenuItem) this.focusActor(this.menu.firstMenuItem.actor);
                return PM_Clutter.EVENT_STOP;
            }
            if ((key === PM_Clutter.KEY_Escape || key === (rtl ? PM_Clutter.KEY_Right : PM_Clutter.KEY_Left)) && this.menu.isOpen) {
                this.menu.close(applet.enableAnimation === true);
                this.focusActor(this.actor);
                return PM_Clutter.EVENT_STOP;
            }
            return PM_PopupMenu.PopupBaseMenuItem.prototype._onKeyPressEvent.call(this, actor, event);
        }
    }
    const item = new CategoryItem(label);
    // Stop expansion at its source: a false row flag is a no-op when the
    // native actor already defaults to false, so its label still propagates.
    item.label.set_y_expand(false);
    const icon = new PM_St.Icon({ style_class: "popup-menu-icon", icon_name: iconName,
        icon_type: PM_St.IconType.SYMBOLIC });
    if (iconName === "view-app-grid-symbolic") _pmEditorFileGlyph(icon, applet, iconName);
    item.removeActor(item.label);
    item.removeActor(item._triangleBin);
    item.addActor(icon, { span: drawer ? 0 : 1 });
    item.addActor(item.label, { expand: true });
    item.addActor(item._triangleBin, { expand: true, span: -1, align: PM_St.Align.END });
    item._icon = icon;
    item.icon = icon;
    _pmPrepareDrawerArrow(item);
    if (drawer) item.actor.connect("get-preferred-width", (actor, height, allocation) => {
        const limit = drawer.rowWidth(actor);
        allocation.min_size = Math.min(allocation.min_size, limit);
        allocation.natural_size = Math.min(allocation.natural_size, limit);
    });
    return item;
}

class PM_MenuEditor {
    constructor(applet) {
        this.applet = applet;
        this.enabled = false;
        this.selection = null;
        this.selectedActor = null;
        this.selectionName = null;
        this.pendingOpen = 0;
        this.frameHintTimer = 0;
        this.frameHintStopBlinkOnShow = false;
        this.frameHintScrollToEnd = true;
        this.frameHintScrollTarget = 0;
        this.managers = [];
        this.trackedActors = [];
        this.paintStates = new Map();
        this.hoverRows = new Map();
        this.contextRows = new Map();
        this.stageSignal = 0;
        this.windowSignal = 0;
        this.probe = null;
        this.destroyed = false;
        this.pendingDismiss = 0;
        this.iconPicker = null;
        this.contentPicker = null;
        this.item = new PM_PopupMenu.PopupSwitchMenuItem(_("Edit custom menu"), false);
        this.separator = new PM_PopupMenu.PopupSeparatorMenuItem();
        this.item.connect("toggled", (item, state) => this.setEnabled(state));
        applet._applet_context_menu.addMenuItem(this.item, 0);
        applet._applet_context_menu.addMenuItem(this.separator, 1);
        this.contextSignal = applet._applet_context_menu.connect("open-state-changed", (menu, open) => {
            if (!open) return;
            _superMenuContextTooltips(menu);
            this.syncAppletContext();
            if (!this.enabled) return;
            this.updateHoverPolicy();
            const actor = menu.actor, parent = actor.get_parent();
            if (parent && parent === applet.menu.actor.get_parent())
                parent.set_child_above_sibling(actor, applet.menu.actor);
            // Focus the container, not the switch. Native row focus paints
            // the whole first line as selected before the user reaches it.
            actor.can_focus = true;
            this.focusActor(actor);
            for (const item of menu._getMenuItems())
                if (typeof item.setActive === "function") item.setActive(false);
        });
        // Keep the real popup and its native event manager. A focused row
        // disappearing during a rebuild must not end the editing session.
        this.nativeClose = applet.menu.close;
        applet.menu.close = (...args) => {
            if (this.enabled && applet._pmPersonalActive && !applet._pmDisposed)
                return;
            return this.nativeClose.apply(applet.menu, args);
        };
        this.exportSettingsControl();
    }

    exportSettingsControl() {
        const xml = '<node><interface name="org.rasmarc.SuperMenu.Editor">' +
            '<method name="SetEnabled"><arg type="b" direction="in" name="enabled"/></method>' +
            '<method name="ImportMenu"><arg type="s" direction="in" name="path"/>' +
            '<arg type="b" direction="in" name="replace"/>' +
            '<arg type="s" direction="out" name="result"/></method>' +
            '<method name="ExportMenu"><arg type="s" direction="in" name="path"/>' +
            '<arg type="s" direction="out" name="result"/></method>' +
            '<property name="Enabled" type="b" access="read"/>' +
            '<property name="Categories" type="s" access="read"/>' +
            '<property name="PanelIconPreview" type="s" access="read"/></interface></node>';
        try {
            this.settingsBridge = PM_Gio.DBusExportedObject.wrapJSObject(xml, this);
            this.settingsBridge.export(PM_Gio.DBus.session, "/org/rasmarc/SuperMenu/Editor");
        } catch (error) {
            global.logError(error, "SuperMenu: connect editing mode to settings");
        }
    }

    get Enabled() { return this.enabled; }
    get Categories() { return JSON.stringify(this.applet._pmCategoryChoices()); }
    get PanelIconPreview() { return JSON.stringify(this.applet._pmPanelIconPreview()); }

    publishPanelPreview() {
        if (!this.settingsBridge || this.destroyed) return;
        const value = this.PanelIconPreview;
        if (value === this._panelPreviewStamp) return;
        this._panelPreviewStamp = value;
        this.settingsBridge.emit_property_changed("PanelIconPreview", new PM_GLib.Variant("s", value));
    }

    publishCategories() {
        if (this.settingsBridge && this.applet._pmPersonal && !this.destroyed)
            this.settingsBridge.emit_property_changed("Categories", new PM_GLib.Variant("s", this.Categories));
    }

    SetEnabled(enabled) { this.setEnabled(enabled, { fromSettings: true }); }

    ImportMenu(path, replace) {
        return JSON.stringify(this.applet._pmEnsurePersonalMenu().importMenu(path, replace));
    }

    ExportMenu(path) {
        return JSON.stringify(this.applet._pmEnsurePersonalMenu().exportMenu(path));
    }

    publishState() {
        if (this.settingsBridge)
            this.settingsBridge.emit_property_changed("Enabled", new PM_GLib.Variant("b", this.enabled));
    }

    setEnabled(enabled, { fromSettings = false, keepOpen = false } = {}) {
        if (this.destroyed || this.applet._pmDisposed) return;
        enabled = enabled === true;
        if (enabled && !this.applet._pmPersonalEnabled) return;
        if (enabled === this.enabled) return;
        this.cancelContentPicker();
        const a = this.applet, wasOpen = a.menu.isOpen && a._pmPersonalActive;
        const scrolls = wasOpen && a._pmDrawer ? a._pmDrawer.captureScrollPositions() : null;
        this.closeModeMenu();
        this.cancelOpen();
        this.cancelDismiss();
        this.enabled = enabled;
        this.item.setToggleState(enabled);
        this.syncAppletContext();
        a._clearDelayCallbacks();
        a._pmResetAutoScroll();
        if (enabled) {
            if (a.menu.isOpen && !a._pmPersonalActive) a.menu.close(false);
            this.startInput();
            this.ensureFrame();
            a._pmEnsurePersonalMenu().activate(true, true);
            this.ensureProbe();
            this.syncFrame();
            a._layout();
            this.refreshSelection();
            a._applet_context_menu.close(false);
            this.queueOpen(!fromSettings);
            this.showFrameHint();
        } else {
            this.hideFrameHint();
            this.clearCopyFeedback();
            this.clearSelection();
            this.updateHoverPolicy();
            this.syncFrame();
            this.stopInput();
            if (a._pmDrawer) a._pmDrawer.closeApplicationContextMenu(false, true);
            if (!keepOpen || !wasOpen) a.menu.close(false);
            a._applet_context_menu.close(false);
            if (a._pmPersonal && a._pmPersonalActive) a._pmPersonal.activate(true, true);
            a._layout();
            if (keepOpen && wasOpen) {
                // The editing handoff already consumed the popup's gesture.
                a.menuManager._didPop = false;
                if (a.menuManager.shouldGrab && !a.menuManager.grabbed) a.menuManager._grab();
                a._pmFocusMenu(true);
            }
        }
        if (scrolls && a.menu.isOpen) a._pmDrawer.restoreScrollPositions(scrolls);
        this.publishState();
    }

    toggleModeMenu(button, fromKeyboard = false) {
        const a = this.applet;
        if (!a._pmPersonalEnabled || this.enabled || this.destroyed || !a._pmPersonalActive || !a.menu.isOpen ||
            !button || !button.actor || !button.actor.is_mapped()) return;
        if (this.modeMenu && this.modeMenu.isOpen && this.modeMenu.sourceActor === button.actor) {
            this.closeModeMenu();
            return;
        }
        this.closeModeMenu();
        let menu = this.modeMenu;
        if (menu && (menu.sourceActor !== button.actor || menu._pmExtended !== a._pmExtendedContextMenu)) {
            menu.destroy();
            menu = null;
        }
        if (!menu) {
            this.ensureProbe();
            menu = _superMenuPopover(button.actor, a, () => this.selectionColor());
            menu.actor.get_child().add_style_class_name("pm-editor-mode-popover");
            menu.actor.can_focus = true;
            menu.actor.connect("popup-menu", () => menu.close(false));
            const item = new PM_PopupMenu.PopupSwitchMenuItem(_("Editing mode"), false);
            item.actor.connect("popup-menu", () => menu.close(false));
            item.connect("toggled", (row, state) => {
                this.closeModeMenu();
                this.setEnabled(state, { keepOpen: true });
            });
            menu.addMenuItem(item);
            menu._pmExtended = a._pmExtendedContextMenu;
            if (menu._pmExtended) {
                menu.addMenuItem(new PM_PopupMenu.PopupSeparatorMenuItem());
                this.addProgramMenuAction(menu);
                this.addTemplateAction(menu);
            }
            PM_Main.uiGroup.add_actor(menu.actor);
            this.modeMenu = menu;
        }
        if (fromKeyboard) {
            const [x] = a.menu.actor.get_transformed_position();
            const [width] = a.menu.actor.get_transformed_size();
            menu._pmAnchorX = x + width / 2;
        } else {
            menu._pmAnchorX = global.get_pointer()[0];
        }
        a.menu.addChildMenu(menu);
        // Register after the native manager: it restores its parent first.
        const signal = menu.connect("open-state-changed", (popup, open) => {
            a._pmResetAutoScroll();
            if (!open) {
                a.menu.removeChildMenu(menu);
                menu.disconnect(signal);
            }
        });
        a._pmResetAutoScroll();
        menu.open(false);
        menu.actor.grab_key_focus();
    }

    navigateModeMenu(menu, event) {
        const key = event.get_key_symbol();
        if (![PM_Clutter.KEY_Up, PM_Clutter.KEY_Down, PM_Clutter.KEY_KP_Up, PM_Clutter.KEY_KP_Down,
            PM_Clutter.KEY_Tab, PM_Clutter.KEY_ISO_Left_Tab].includes(key))
            return PM_Clutter.EVENT_PROPAGATE;
        const rows = menu._getMenuItems().filter(row => row.actor.visible && row.actor.can_focus && row.sensitive !== false);
        if (!rows.length) return PM_Clutter.EVENT_PROPAGATE;
        const backwards = key === PM_Clutter.KEY_Up || key === PM_Clutter.KEY_KP_Up || key === PM_Clutter.KEY_ISO_Left_Tab ||
            (key === PM_Clutter.KEY_Tab && (event.get_state() & PM_Clutter.ModifierType.SHIFT_MASK));
        const focus = global.stage.get_key_focus();
        const index = focus ? rows.findIndex(row => row.actor.contains(focus)) : -1;
        const next = index < 0 ? (backwards ? rows.length - 1 : 0) :
            (index + (backwards ? rows.length - 1 : 1)) % rows.length;
        rows[next].actor.grab_key_focus();
        return PM_Clutter.EVENT_STOP;
    }

    addProgramMenuAction(menu) {
        const item = new PM_PopupMenu.PopupIconMenuItem(_("Copy from applications menu"),
            "view-app-grid-symbolic", PM_St.IconType.SYMBOLIC);
        _pmEditorFileGlyph(item._icon, this.applet, "view-app-grid-symbolic");
        item._action = "pm_edit_copy-from-program-menu";
        item.activate = () => {
            const a = this.applet;
            if (this.destroyed || a._pmDisposed || !a._pmPersonalEnabled ||
                !a._pmPersonalActive || !a.menu.isOpen) return;
            this.closeModeMenu();
            if (this.enabled) this.setEnabled(false);
            else a.menu.close(false);
            a._pmOpenMenu(false);
        };
        menu.addMenuItem(item);
    }

    addTemplateAction(menu) {
        const item = new PM_PopupMenu.PopupIconMenuItem(_("Load template…"),
            "document-open-symbolic", PM_St.IconType.SYMBOLIC);
        item._action = "pm_load-template";
        item.activate = () => this.loadTemplate();
        menu.addMenuItem(item);
    }

    loadTemplate() {
        const a = this.applet;
        if (this.destroyed || a._pmDisposed || !a._pmPersonalEnabled ||
            (!this.enabled && !a._pmExtendedContextMenu) ||
            !a._pmPersonalActive || !a.menu.isOpen) return;
        const editing = this.enabled;
        const personal = a._pmEnsurePersonalMenu(), previous = personal.store.state;
        this.cancelContentPicker();
        this.closeModeMenu();
        if (editing) {
            this.cancelIconPicker();
            a._pmDrawer.closeApplicationContextMenu(false);
            this.releaseKeyboard();
        } else {
            a.menu.close(false);
            personal.activate(false);
        }
        const picker = {};
        this.contentPicker = picker;
        try {
            const flags = PM_Gio.SubprocessFlags;
            const args = ["python3", a._pmSourcePath + "/content_dialog.py"];
            if (previous.categories.length) args.push("--replace");
            picker.process = PM_Gio.Subprocess.new(args, flags.STDOUT_PIPE | flags.STDERR_PIPE);
            if (editing) this.watchPickerWindow(picker);
            picker.process.communicate_utf8_async(null, null, (process, result) => {
                let reply, failure;
                try {
                    const [ok, output] = process.communicate_utf8_finish(result);
                    if (!ok || !process.get_successful()) throw new Error(_("The file chooser closed unexpectedly."));
                    reply = JSON.parse(output);
                } catch (error) { failure = error; }
                if (this.contentPicker !== picker) return;
                this.contentPicker = null;
                this.finishPickerLayer(picker);
                if (this.destroyed || a._pmDisposed || !a._pmPersonalEnabled) return;
                try {
                    if (failure) throw failure;
                    if (!reply || reply.ok !== true)
                        throw new Error(reply && reply.message || _("Invalid file selection."));
                    if (reply.cancelled) return;
                    if (typeof reply.path !== "string" || !reply.path || reply.path.includes("\0"))
                        throw new Error(_("No valid import file selected."));
                    if (personal.store.state !== previous)
                        throw new Error(_("The custom menu changed. Open the template chooser again."));
                    const loaded = personal.importMenu(reply.path, true);
                    if (!loaded.ok) throw new Error(loaded.message);
                    if (!a.menu.isOpen) a._pmOpenMenu(true);
                    if (loaded.unavailable)
                        PM_Main.notify("SuperMenu", _("Unavailable applications: %d. Their entries remain saved.").format(loaded.unavailable));
                } catch (error) {
                    PM_Main.notifyError("SuperMenu", _("Could not load content: %s").format(String(error.message || error)));
                } finally {
                    if (editing && this.enabled && a.menu.isOpen) this.focusActor(a.menu.actor);
                }
            });
        } catch (error) {
            this.cancelContentPicker();
            PM_Main.notifyError("SuperMenu", _("Could not load content: %s").format(String(error)));
        }
    }

    cancelContentPicker() {
        const picker = this.contentPicker;
        this.contentPicker = null;
        if (picker) this.finishPickerLayer(picker);
        if (picker && picker.process) {
            try { picker.process.force_exit(); }
            catch (error) { /* The native dialog may already have exited. */ }
        }
    }

    closeModeMenu() {
        if (this.modeMenu) this.modeMenu.close(false);
    }

    ensureFrame() {
        if (this.frameBox) return;
        const menu = this.applet.menu;
        this.frameBox = new PM_St.BoxLayout({ vertical: true, style_class: "pm-editor-frame" });
        this.frameBar = new PM_St.BoxLayout({ style_class: "pm-editor-bar" });
        // The viewport takes only the space left of the switch. EXTERNAL keeps
        // its minimum width at zero without displaying a horizontal scrollbar.
        this.frameHintView = new PM_St.ScrollView({ style_class: "pm-editor-hint",
            reactive: false, can_focus: false, width: 0 });
        this.frameHintView.set_policy(PM_St.PolicyType.EXTERNAL, PM_St.PolicyType.NEVER);
        this.frameHintView.set_mouse_scrolling(false);
        this.frameHintView.set_auto_scrolling(false);
        this.frameHintView.set_clip_to_allocation(true);
        const hintBox = new PM_St.BoxLayout();
        this.frameHint = new PM_St.Label({ text: _("Actions: right-click"),
            reactive: false, can_focus: false, opacity: 0 });
        this.frameHint.clutter_text.single_line_mode = true;
        this.frameHint.clutter_text.line_wrap = false;
        this.frameHint.clutter_text.ellipsize = PM_Pango.EllipsizeMode.NONE;
        hintBox.add(this.frameHint, { x_fill: false, y_fill: false });
        this.frameHintView.add_actor(hintBox);
        this.frameHintAdjustment = this.frameHintView.get_hscroll_bar().get_adjustment();
        this.frameHintAdjustment.connect("changed", () => this.syncFrameHintScroll(false));
        this.frameHintView.connect("notify::mapped", () => this.syncFrameHintScroll());
        this.frameBar.add(this.frameHintView, { expand: true, x_fill: true,
            y_fill: false, y_align: PM_St.Align.MIDDLE });
        this.frameSwitch = new PM_PopupMenu.Switch(true);
        this.frameButton = new PM_St.Button({ style_class: "pm-editor-switch", reactive: true,
            can_focus: true, toggle_mode: true, checked: true,
            x_fill: false, y_fill: false, x_align: PM_St.Align.MIDDLE, y_align: PM_St.Align.END,
            accessible_role: PM_Atk.Role.CHECK_BOX, accessible_name: _("Editing mode") });
        this.frameButton.set_child(this.frameSwitch.actor);
        this.frameButton.connect("clicked", () => this.setEnabled(false, { keepOpen: true }));
        this.frameTooltip = new PM_Tooltips.Tooltip(this.frameButton, _("End editing mode"));
        this.frameBar.add(this.frameButton, { expand: false, x_fill: false,
            x_align: PM_St.Align.END, y_fill: false, y_align: PM_St.Align.END });
        this.frameBar.hide();
        menu.actor.remove_child(menu._boxWrapper);
        this.frameBox.add(this.frameBar, { x_fill: true, y_fill: false });
        this.frameBox.add(menu._boxWrapper, { x_fill: true, y_fill: false });
        menu.actor.set_child(this.frameBox);
    }

    showFrameHint() {
        this.hideFrameHint();
        if (!this.applet._pmEditorHint) return;
        this.frameHint.opacity = 255;
        if (!this.applet._pmEditorHintBlink) {
            this.syncFrameHintScroll();
            return;
        }
        let halfSteps = 0;
        this.frameHintTimer = PM_Mainloop.timeout_add(500, () => {
            halfSteps++;
            this.frameHint.opacity = halfSteps % 2 ? 0 : 255;
            if (halfSteps < 6 && !(this.frameHintStopBlinkOnShow && this.frameHint.opacity === 255)) return true;
            // A finish requested while dark waits for its scheduled show,
            // never a shortened interval or a replacement blink clock.
            this.frameHintTimer = 0;
            this.frameHintStopBlinkOnShow = false;
            this.syncFrameHintScroll();
            return false;
        });
    }

    stopFrameHintBlink(keepVisible = true) {
        this.frameHintStopBlinkOnShow = false;
        if (!this.frameHintTimer) return;
        PM_Mainloop.source_remove(this.frameHintTimer);
        this.frameHintTimer = 0;
        if (keepVisible) {
            this.frameHint.opacity = 255;
            this.syncFrameHintScroll();
        }
    }

    frameHintActionsOpening() {
        if (this.applet._pmEditorHintHideOnActions) this.hideFrameHint();
        else if (this.frameHintTimer) {
            if (this.frameHint.opacity === 255) this.stopFrameHintBlink();
            else this.frameHintStopBlinkOnShow = true;
        }
    }

    hideFrameHint() {
        this.stopFrameHintBlink(false);
        if (this.frameHint) this.frameHint.opacity = 0;
        this.syncFrameHintScroll();
    }

    syncFrameHintScroll(reset = true) {
        if (this.destroyed) return;
        const adjustment = this.frameHintAdjustment;
        if (!adjustment) return;
        const maximum = Math.max(adjustment.lower, adjustment.upper - adjustment.page_size);
        const value = adjustment.get_value(), transition = adjustment.get_transition("value");
        const target = this.frameHintScrollToEnd ? maximum : adjustment.lower;
        // StViewport emits changed for bounds and scroll increments separately.
        // An unchanged destination must not restart a moving or paused leg.
        if (!reset && transition && adjustment.page_size > 0 && maximum - adjustment.lower >= 1 &&
            value >= adjustment.lower && value <= maximum && target === this.frameHintScrollTarget) return;
        adjustment.remove_transition("value");
        if (reset || !transition) {
            const rtl = this.frameHint.get_direction() === PM_St.TextDirection.RTL;
            adjustment.set_value(rtl ? maximum : adjustment.lower);
            this.scrollFrameHint(!rtl);
        } else {
            // Retarget from the visible position; only the new bounds may clamp
            // it. Keep the direction and continue without another reading pause.
            adjustment.set_value(value);
            this.scrollFrameHint(this.frameHintScrollToEnd, false);
        }
    }

    scrollFrameHint(toEnd, pause = true) {
        const adjustment = this.frameHintAdjustment;
        if (this.destroyed || !this.enabled || this.frameHintTimer || this.frameHint.opacity !== 255 ||
            !this.frameHintView.is_mapped() || adjustment.page_size <= 0) return;
        const maximum = Math.max(adjustment.lower, adjustment.upper - adjustment.page_size);
        if (maximum - adjustment.lower < 1) return;
        let target = toEnd ? maximum : adjustment.lower;
        let distance = Math.abs(target - adjustment.get_value());
        if (distance < 1) {
            toEnd = !toEnd;
            target = toEnd ? maximum : adjustment.lower;
            distance = Math.abs(target - adjustment.get_value());
            pause = true;
        }
        this.frameHintScrollToEnd = toEnd;
        this.frameHintScrollTarget = target;
        // Native easing handles every frame; each leg leaves one second to read
        // its end. Required animation also reveals text with desktop effects off.
        adjustment.ease(target, { duration: Math.round(distance * 1000 / (30 * global.ui_scale)),
            delay: pause ? 1000 : 0, mode: PM_Clutter.AnimationMode.LINEAR, animationRequired: true,
            onComplete: () => this.scrollFrameHint(!toEnd) });
    }

    ensureProbe() {
        if (this.probe) return;
        const a = this.applet;
        // Resolve exactly the active popup-row color from the current theme.
        // The hidden probe has no size and never participates in navigation.
        this.probe = new PM_St.Bin({ style_class: "popup-menu-item", reactive: false, can_focus: false });
        this.probe.add_style_pseudo_class("active");
        a.menu.box.add_actor(this.probe);
        this.probe.hide();
        this.probeSignal = this.probe.connect("style-changed", () => this.syncFrame());
        // Text selection carries the theme's accent even when popup rows
        // use transparent fills, neutral highlights or background images.
        this.colorEntry = new PM_St.Entry({ name: "appmenu-search-entry",
            reactive: false, can_focus: false });
        a.menu.box.add_actor(this.colorEntry);
        this.colorEntry.hide();
        this.colorEntrySignal = this.colorEntry.connect("style-changed", () => this.syncFrame());
    }

    syncAppletContext() {
        const a = this.applet, rows = a._applet_context_menu._getMenuItems();
        if (this.enabled) {
            for (const row of rows) {
                if (row === this.item || row === this.separator) continue;
                if (!this.contextRows.has(row)) this.contextRows.set(row, row.actor.visible);
                row.actor.visible = row === a.context_menu_item_configure;
            }
        } else {
            for (const [row, visible] of this.contextRows)
                if (!row.actor.is_finalized()) row.actor.visible = visible;
            this.contextRows.clear();
        }
        this.item.actor.visible = !!a._pmPersonalEnabled;
        this.separator.actor.visible = !!a._pmPersonalEnabled && rows.some(row => row !== this.item && row !== this.separator && row.actor.visible);
    }

    selectionColor() {
        if (this.colorEntry) {
            const [found, color] = this.colorEntry.get_theme_node().lookup_color("selection-background-color", true);
            if (found && color.alpha) return color;
        }
        const node = this.probe.get_theme_node();
        const [type, start, end] = node.get_background_gradient();
        if (type && (start.alpha || end.alpha)) return start.alpha ? start : end;
        const background = node.get_background_color();
        if (background.alpha) return background;
        for (const side of [PM_St.Side.TOP, PM_St.Side.BOTTOM, PM_St.Side.LEFT, PM_St.Side.RIGHT]) {
            const color = node.get_border_color(side);
            if (color.alpha) return color;
        }
        // A theme with no selection paint must still have a visible mode
        // indicator. Never substitute the (often white) foreground text.
        return { red: 53, green: 132, blue: 228 };
    }

    startInput() {
        if (this.stageSignal) return;
        const a = this.applet;
        this.contextCanFocus = a._applet_context_menu.actor.can_focus === true;
        // Both native managers keep their widgets and open-state handlers.
        // Only their modal grab is disabled for this editing session.
        for (const manager of new Set([a.menuManager, a._menuManager])) {
            this.managers.push({ manager, shouldGrab: manager.shouldGrab });
            manager.shouldGrab = false;
            if (manager.grabbed) manager._ungrab();
        }
        // Without a modal grab X11 needs the actual popup rectangles in its
        // input region. Tracking them also follows animation and scrolling.
        for (const actor of [a.menu.actor, a._applet_context_menu.actor]) {
            if (!PM_Main.layoutManager.isTrackingChrome(actor)) {
                if (actor.get_parent() === PM_Main.uiGroup)
                    this.paintStates.set(actor, PM_Main.uiGroup.get_skip_paint(actor));
                PM_Main.layoutManager.trackChrome(actor, { affectsInputRegion: true,
                    affectsStruts: false, visibleInFullscreen: true, doNotAdd: true });
                this.trackedActors.push(actor);
            }
        }
        this.stageSignal = global.stage.connect("captured-event", (stage, event) => this.handleStageEvent(event));
        this.windowSignal = global.display.connect("notify::focus-window", () => this.windowFocused());
    }

    stopInput() {
        this.cancelIconPicker();
        this.cancelDismiss();
        if (this.stageSignal) global.stage.disconnect(this.stageSignal);
        if (this.windowSignal) global.display.disconnect(this.windowSignal);
        this.stageSignal = this.windowSignal = 0;
        this.releaseKeyboard();
        if (this.contextCanFocus !== undefined) {
            this.applet._applet_context_menu.actor.can_focus = this.contextCanFocus;
            delete this.contextCanFocus;
        }
        for (const actor of this.trackedActors) {
            PM_Main.layoutManager.untrackChrome(actor);
            if (actor.get_parent() === PM_Main.uiGroup && this.paintStates.has(actor))
                PM_Main.uiGroup.set_skip_paint(actor, this.paintStates.get(actor));
        }
        this.trackedActors = [];
        this.paintStates.clear();
        for (const { manager, shouldGrab } of this.managers) {
            manager.shouldGrab = shouldGrab;
            if (manager._activeMenu && !manager._activeMenu.isOpen && !manager._menuStack.length)
                manager._activeMenu = null;
        }
        this.managers = [];
    }

    hasMenuFocus() {
        const focus = global.stage.get_key_focus();
        const a = this.applet;
        return !!(focus && (a.menu.actor.contains(focus) ||
            a._applet_context_menu.actor.contains(focus) || a.actor.contains(focus)));
    }

    focusActor(actor) {
        if (this.iconPicker || this.contentPicker || !this.enabled || !actor || actor.is_finalized() || PM_Main.modalCount > 0) return;
        this.keyboardOwned = true;
        // FOCUSED gives the shell keyboard focus while preserving the same
        // limited mouse region as NORMAL. It returns to NORMAL on window focus.
        global.set_stage_input_mode(imports.gi.Cinnamon.StageInputMode.FOCUSED);
        actor.grab_key_focus();
    }

    releaseKeyboard() {
        const modes = imports.gi.Cinnamon.StageInputMode;
        if (this.keyboardOwned && this.hasMenuFocus() && !(PM_Main.modalCount > 0) &&
            global.stage_input_mode === modes.FOCUSED) {
            global.stage.set_key_focus(null);
            global.set_stage_input_mode(modes.NORMAL);
            // Drop shell keyboard focus without activating a remembered or
            // fallback window. It may have been minimized in the meantime.
        }
        this.keyboardOwned = false;
    }

    windowFocused() {
        if (!this.enabled || !global.display.get_focus_window()) return;
        this.keyboardOwned = false;
        if (this.hasMenuFocus()) global.stage.set_key_focus(null);
        this.closeContextMenus();
        this.applet._pmResetAutoScroll();
    }

    closeContextMenus() {
        const a = this.applet;
        if (a._applet_context_menu.isOpen) a._applet_context_menu.close(false);
        if (a._pmDrawer) a._pmDrawer.closeApplicationContextMenu(false);
    }

    handleStageEvent(event) {
        if (this.iconPicker || this.contentPicker) return PM_Clutter.EVENT_PROPAGATE;
        if (!this.enabled || this.destroyed) return PM_Clutter.EVENT_PROPAGATE;
        const a = this.applet, source = event.get_source();
        // Main forwards ordinary presses only while modal. Muffin consumes
        // modifier presses itself and activates their bindings on release.
        if (!PM_Main.modalCount && PM_Main.keybindingManager && this.hasMenuFocus() &&
            global.stage_input_mode === imports.gi.Cinnamon.StageInputMode.FOCUSED &&
            (event.type() === PM_Clutter.EventType.KEY_PRESS || event.type() === PM_Clutter.EventType.KEY_RELEASE) &&
            !(source instanceof PM_Clutter.Text && (event.get_flags() & PM_Clutter.EventFlags.FLAG_INPUT_METHOD))) {
            const key = event.get_key_symbol();
            let ownModifier = 0;
            if (key === PM_Clutter.KEY_Super_L || key === PM_Clutter.KEY_Super_R)
                ownModifier = PM_Clutter.ModifierType.MOD4_MASK;
            else if (key === PM_Clutter.KEY_Alt_L || key === PM_Clutter.KEY_Alt_R)
                ownModifier = PM_Clutter.ModifierType.MOD1_MASK;
            else if (key === PM_Clutter.KEY_Control_L || key === PM_Clutter.KEY_Control_R)
                ownModifier = PM_Clutter.ModifierType.CONTROL_MASK;
            else if (key === PM_Clutter.KEY_Shift_L || key === PM_Clutter.KEY_Shift_R)
                ownModifier = PM_Clutter.ModifierType.SHIFT_MASK;
            // Match Muffin's release lookup without firing ordinary keys twice.
            if (event.type() === PM_Clutter.EventType.KEY_PRESS ? !ownModifier : !!ownModifier) {
                const manager = PM_Main.keybindingManager;
                const action = global.display.get_keybinding_action(event.get_key_code(),
                    imports.gi.Cinnamon.get_event_state(event) & ~ownModifier);
                const binding = manager.bindings.get(action);
                if (binding && binding.name.startsWith(a._uuid + "::pm-editor-shortcut::")) {
                    manager.invoke_keybinding_action_by_id(action);
                    return PM_Clutter.EVENT_STOP;
                }
            }
        }
        if (event.type() === PM_Clutter.EventType.BUTTON_PRESS) {
            this.cancelDismiss();
            const context = a._applet_context_menu;
            const appletRightClick = event.get_button() === 3 && a.actor.contains(source);
            if (context.isOpen && !context.actor.contains(source) && !appletRightClick) context.close(false);
            const drawer = a._pmDrawer;
            if (drawer && drawer.contextMenu && drawer.contextMenu.isOpen &&
                !drawer.contextMenu.actor.contains(source) &&
                (event.get_button() === 1 || !(drawer.contextRow && drawer.contextRow.actor.contains(source)))) {
                if ([1, 3].includes(event.get_button()) && a.menu.actor.contains(source))
                    this.pressedContext = { menu: drawer.contextMenu, row: drawer.contextRow };
                else drawer.closeApplicationContextMenu(false);
            }
            if (a.menu.actor.contains(source) && event.get_button() === 1)
                this.focusActor(a.menu.actor);
        } else if (event.type() === PM_Clutter.EventType.BUTTON_RELEASE && this.pressedContext) {
            const pressed = this.pressedContext;
            this.pressedContext = null;
            // Let the original row receive its release before removing the
            // old list. Shrinking a bottom-anchored popup during press moves
            // rows above it away from the pointer and consumes their click.
            this.pendingDismiss = PM_Mainloop.idle_add(() => {
                this.pendingDismiss = 0;
                const drawer = a._pmDrawer;
                if (this.enabled && !this.destroyed && drawer && drawer.contextMenu === pressed.menu &&
                    drawer.contextRow === pressed.row && pressed.menu.isOpen)
                    drawer.closeApplicationContextMenu(false);
                return false;
            });
        }
        // Observe outside events without swallowing them; the native widgets
        // still receive clicks, and windows receive their own input directly.
        return a.menuEventFilter(event);
    }

    cancelDismiss() {
        if (this.pendingDismiss) PM_Mainloop.source_remove(this.pendingDismiss);
        this.pendingDismiss = 0;
        this.pressedContext = null;
    }

    syncFrame() {
        if (this.destroyed) return;
        const actor = this.applet.menu.actor;
        const active = this.enabled && this.applet._pmPersonalActive;
        if (active) actor.add_style_class_name("pm-menu-editing");
        else actor.remove_style_class_name("pm-menu-editing");
        if (this.frameBar) {
            this.frameBar.visible = active;
            this.frameSwitch.setToggleState(active);
            this.frameButton.checked = active;
        }
        let style = String(actor.style || "").replace(
            /\/\* pm-edit-frame \*\/[\s\S]*?\/\* \/pm-edit-frame \*\//g, "").trim();
        if (active && this.probe) {
            const color = this.selectionColor();
            this.color = "rgb(" + [color.red, color.green, color.blue].join(", ") + ")";
            style += " /* pm-edit-frame */ border-image: none; border-width: 4px; border-color: " + this.color +
                "; /* /pm-edit-frame */";
        }
        if (actor.style !== style) actor.set_style(style);
        if (active && this.selectedActor && !this.selectedActor.is_finalized())
            this.selectedActor.set_style(this.selectedStyle + " border-color: " + this.color + ";");
    }

    queueOpen(takeFocus = true) {
        this.openWithFocus = takeFocus;
        if (this.pendingOpen || !this.enabled || this.destroyed) return;
        this.pendingOpen = PM_Mainloop.idle_add(() => {
            this.pendingOpen = 0;
            const a = this.applet;
            if (!this.enabled || this.destroyed || a._pmDisposed) return false;
            if (!a._pmPersonalActive) a._pmEnsurePersonalMenu().activate(true);
            if (!a.menu.isOpen) a.menu.open(false);
            this.syncFrame();
            if (this.openWithFocus && !a._applet_context_menu.isOpen) a._pmFocusMenu(true);
            a._pmFitMenuHeight();
            return false;
        });
    }

    cancelOpen() {
        if (this.pendingOpen) PM_Mainloop.source_remove(this.pendingOpen);
        this.pendingOpen = 0;
    }

    prepareContextMenu() {
        this.cancelIconPicker();
        this.syncAppletContext();
        if (this.applet._pmDrawer) this.applet._pmDrawer.closeApplicationContextMenu(false);
    }

    filterEvent(event) {
        if (this.iconPicker || this.contentPicker) return false;
        const a = this.applet;
        const type = event.type();
        const mode = this.modeMenu;
        if (mode && mode.isOpen && type === PM_Clutter.EventType.KEY_PRESS &&
            mode.actor.contains(event.get_source())) {
            const key = event.get_key_symbol();
            if (key === PM_Clutter.KEY_Escape || key === PM_Clutter.KEY_Menu ||
                (key === PM_Clutter.KEY_F10 && (event.get_state() & PM_Clutter.ModifierType.SHIFT_MASK))) {
                this.closeModeMenu();
                // A keyboard dismissal has no pointer release for the native guard to consume.
                a.menuManager._didPop = false;
                return true;
            }
            if (this.navigateModeMenu(mode, event)) return true;
        }
        if (this.modeDismissClick && type === PM_Clutter.EventType.BUTTON_RELEASE && event.get_button() === 1) {
            this.modeDismissClick = false;
            // We consumed the release that normally drains this native guard.
            a.menuManager._didPop = false;
            return true;
        }
        if (this.modeMenu && this.modeMenu.isOpen && type === PM_Clutter.EventType.BUTTON_PRESS &&
            event.get_button() === 1 && !this.modeMenu.actor.contains(event.get_source())) {
            this.modeDismissClick = true;
            this.closeModeMenu();
            return true;
        }
        if (!this.enabled || !a._pmPersonalActive || !a.menu.isOpen) return false;
        const context = a._applet_context_menu;
        if (type === PM_Clutter.EventType.KEY_PRESS && context.isOpen && event.get_source() === context.actor &&
            [PM_Clutter.KEY_Down, PM_Clutter.KEY_Up, PM_Clutter.KEY_Tab, PM_Clutter.KEY_ISO_Left_Tab]
                .includes(event.get_key_symbol())) {
            this.focusActor(this.item.actor);
            return true;
        }
        if (type === PM_Clutter.EventType.KEY_PRESS && event.get_key_symbol() === PM_Clutter.KEY_Escape) {
            const source = event.get_source();
            if (!a.menu.actor.contains(source) && !context.actor.contains(source) && !a.actor.contains(source))
                return false;
            if (context.isOpen) {
                context.close(false);
                this.focusActor(a.menu.actor);
            } else if (this.input) {
                if (!a._pmDrawer.closeContextLevel(source)) this.cancelInput();
            } else if (a._pmDrawer && a._pmDrawer.contextMenu && a._pmDrawer.contextMenu.isOpen) {
                if (!a._pmDrawer.closeContextLevel(source)) a._pmDrawer.closeApplicationContextMenu(true);
            }
            return true;
        }
        return false;
    }

    updateHoverPolicy() {
        const drawer = this.applet._pmDrawer;
        const rows = drawer ? drawer.itemRows() : [];
        if (drawer && drawer.contextMenu) rows.push(...drawer.contextItems());
        rows.push(...this.applet._applet_context_menu._getMenuItems());
        if (this.enabled) {
            for (const [row] of this.hoverRows) if (row.actor.is_finalized()) this.hoverRows.delete(row);
            for (const row of rows) {
                if (!this.hoverRows.has(row)) this.hoverRows.set(row, row.focusOnHover);
                row.focusOnHover = false;
            }
        } else {
            for (const [row, value] of this.hoverRows) if (!row.actor.is_finalized()) row.focusOnHover = value;
            this.hoverRows.clear();
        }
    }

    selectProgram(row) {
        if (!this.enabled || !this.applet._pmPersonalActive || !row._pmEntryId) return;
        this.selection = { type: row._pmSeparator ? "separator" : "entry", id: row._pmEntryId };
        this.refreshSelection();
        this.focusActor(this.selectedActor);
    }

    selectCategory(row) {
        if (!this.enabled || !this.applet._pmPersonalActive || !row._pmCategory) return;
        this.selection = { type: "category", id: row.id };
        this.refreshSelection();
        this.focusActor(this.selectedActor);
    }

    toggleActions(button) {
        const a = this.applet, drawer = a._pmDrawer;
        if (!button || button._pmSupplement || button._pmRecent || button._pmPlace) return;
        if (!this.enabled || !a._pmPersonalActive || !a.menu.isOpen || !drawer) return;
        this.cancelIconPicker();
        const row = button.view === drawer ? button :
            drawer.findItemRow({ type: "entry", id: button._pmEntryId });
        if (!row || !row.actor.is_mapped()) return;
        if (row._pmEmpty) this.clearSelection();
        else if (row._pmCategory) this.selectCategory(row);
        else this.selectProgram(row);
        a._applet_context_menu.close(false);
        drawer.toggleInlineContextMenu(row, (menu, source) => this.populateActions(menu, source), true);
    }

    populateActions(menu, row) {
        if (row._pmSeparator) {
            const item = new PM_PopupMenu.PopupIconMenuItem(_("Remove"), "list-remove-symbolic", PM_St.IconType.SYMBOLIC);
            item._action = "pm_edit_remove-separator";
            item.activate = () => this.removeSeparator(row);
            menu.addMenuItem(item);
            return;
        }
        if (row._pmEmpty) {
            for (const [action, label, icon] of [
                ["new-category", _("Create category…"), "folder-new-symbolic"],
                ["new-entry", _("Create entry…"), "list-add-symbolic"]
            ]) {
                const item = new PM_PopupMenu.PopupIconMenuItem(label, icon, PM_St.IconType.SYMBOLIC);
                item._action = "pm_edit_" + action;
                item.activate = () => this.beginInput(action, row);
                menu.addMenuItem(item);
            }
            if (row._pmCategoryId == null) {
                menu.addMenuItem(new PM_PopupMenu.PopupSeparatorMenuItem());
                this.addProgramMenuAction(menu);
                this.addTemplateAction(menu);
            }
            return;
        }
        const alphabetical = this.applet._pmIsPersonalList() && this.applet._pmPersonalSort === "alphabetical";
        const ordered = this.orderedIds(row);
        const index = ordered.indexOf(row._pmCategory ? String(row.id) : row._pmEntryId);
        const actions = [
            ["rename", _("Rename…"), "edit-rename-symbolic"],
            ["icon", _("Change icon…"), "image-x-generic-symbolic"]
        ];
        if (!row._pmCategory) actions.push(
            ["command", _("Change launch command…"), "system-run-symbolic"]);
        actions.push(["up", _("Move up"), "go-up-symbolic"], ["down", _("Move down"), "go-down-symbolic"]);
        for (const [action, label, icon] of actions) {
            const item = new PM_PopupMenu.PopupIconMenuItem(label, icon, PM_St.IconType.SYMBOLIC);
            if (action === "rename") _pmEditorFileGlyph(item._icon, this.applet, "edit-rename-symbolic");
            item._action = "pm_edit_" + action;
            if (action === "up" || action === "down")
                item.setSensitive(!alphabetical && index >= 0 && (action === "up" ? index > 0 : index < ordered.length - 1));
            item.activate = () => item.sensitive !== false && (action === "up" || action === "down" ?
                this.move(row, action === "up" ? -1 : 1) :
                action === "icon" ? this.chooseIcon(row) :
                    this.beginInput(action, row));
            menu.addMenuItem(item);
        }
        if (!row._pmCategory) {
            const category = _pmCategoryItem(this.applet, menu);
            category._action = "pm_edit_category";
            category.setSensitive(!alphabetical);
            const store = this.applet._pmPersonal.store;
            const entry = store.state.categories.flatMap(group => group.entries).find(item => item.id === row._pmEntryId);
            for (const { category: group, count } of store.categoryTargets(entry)) {
                const current = group.id === row._pmCategoryId;
                const item = new PM_PopupMenu.PopupMenuItem(group.name + (count ? " (" + count + "×)" : ""), { focusOnHover: false });
                item._action = "pm_edit_category_" + group.id;
                item.setShowDot(current);
                item.activate = () => this.copyEntry(row, group.id);
                category.menu.addMenuItem(item);
            }
            menu.addMenuItem(category);
        }
        if (!row._pmCategory) this.applet._pmPersonal.addContextAction(menu, this.applet._pmDrawer._buttonForRow(row));
        else {
            const item = new PM_PopupMenu.PopupIconMenuItem(_("Remove…"), "list-remove-symbolic", PM_St.IconType.SYMBOLIC);
            item._action = "pm_edit_remove-category";
            item.activate = () => this.beginInput("remove-category", row);
            menu.addMenuItem(item);
        }
        if (!row._pmCategory) this.addListCategoryActions(menu, row);
        menu.addMenuItem(new PM_PopupMenu.PopupSeparatorMenuItem());
        for (const [action, label, icon] of [
            ["new-category", _("Create category…"), "folder-new-symbolic"],
            ["new-entry", _("Create entry…"), "list-add-symbolic"]
        ]) {
            const item = new PM_PopupMenu.PopupIconMenuItem(label, icon, PM_St.IconType.SYMBOLIC);
            item._action = "pm_edit_" + action;
            item.activate = () => this.beginInput(action, row);
            menu.addMenuItem(item);
        }
        if (!row._pmCategory && !this.applet._pmIsPersonalList()) {
            const separator = new PM_PopupMenu.PopupIconMenuItem(_("Add separator"),
                "list-remove-symbolic", PM_St.IconType.SYMBOLIC);
            separator._action = "pm_edit_separator";
            const rows = this.applet._pmDrawer.categoryView(row._pmCategoryId).rows;
            const nextRow = rows[rows.indexOf(row) + 1];
            separator.setSensitive(index >= 0 && index < ordered.length - 1 && !nextRow._pmSeparator);
            separator.activate = () => separator.sensitive !== false && this.addSeparator(row);
            menu.addMenuItem(separator);
        }
    }

    addListCategoryActions(menu, row) {
        const a = this.applet;
        if (!a._pmIsPersonalList() || a._pmIsPersonalGrid() || a._pmPersonalSort === "alphabetical") return;
        const ordered = this.orderedIds(row, true), index = ordered.indexOf(String(row._pmCategoryId));
        if (index < 0) return;
        const category = _pmCategoryItem(a, menu, _("This category…"), "folder-symbolic");
        category._action = "pm_edit_this-category";
        for (const [action, label, icon] of [
            ["up", _("Move up"), "go-up-symbolic"], ["down", _("Move down"), "go-down-symbolic"],
            ["remove", _("Remove…"), "list-remove-symbolic"]
        ]) {
            const item = new PM_PopupMenu.PopupIconMenuItem(label, icon, PM_St.IconType.SYMBOLIC);
            item._action = "pm_edit_this-category_" + action;
            item.setSensitive(action === "remove" || (action === "up" ? index > 0 : index < ordered.length - 1));
            item.activate = () => item.sensitive !== false && (action === "remove" ?
                this.beginInput("remove-category", row) : this.move(row, action === "up" ? -1 : 1, true));
            category.menu.addMenuItem(item);
        }
        menu.addMenuItem(new PM_PopupMenu.PopupSeparatorMenuItem());
        menu.addMenuItem(category);
    }

    orderedIds(row, category = row._pmCategory === true) {
        return category ? this.applet._categoryButtons.map(item => String(item.categoryId)) :
            this.applet._applicationsButtons.filter(item => item.category.includes(row._pmCategoryId))
                .map(item => item._pmEntryId);
    }

    chooseIcon(row) {
        const a = this.applet, personal = a._pmPersonal;
        if (!this.enabled || !a._pmPersonalActive || this.destroyed || !personal) return;
        const category = personal.store.state.categories.find(item => item.id ===
            (row._pmCategory ? row.id : row._pmCategoryId));
        const entry = !row._pmCategory && category && category.entries.find(item => item.id === row._pmEntryId);
        if (!category || !row._pmCategory && (!entry || entry.type === "separator")) return;
        const original = row._pmCategory ? personal.catalogCategories.find(item => String(item.categoryId) === category.id) :
            personal.catalogApps.find(item => [entry.appId, entry.desktopId].includes(item.app.get_id()));
        const chooserName = value => {
            // XApp searches names/paths; GIcon serialization may also contain
            // fallback names, which are useful for rendering but not searching.
            try {
                const icon = PM_Gio.icon_new_for_string(value);
                if (typeof icon.get_names === "function") return icon.get_names()[0] || value;
                if (typeof icon.get_file === "function") return icon.get_file().get_path() || value;
            } catch (error) { /* Keep a usable name if a theme icon disappeared. */ }
            return value;
        };
        const defaultIcon = chooserName(original && original.icon ? personal.iconString(original.icon) :
            row._pmCategory ? "folder" : "application-x-executable");
        const current = chooserName(row._pmCategory ? personal.iconString(personal.categoryIcon(category)) : entry.icon || defaultIcon);
        this.cancelIconPicker();
        a._pmDrawer.closeApplicationContextMenu(false);
        const picker = { categoryId: category.id, entryId: entry ? entry.id : null, defaultIcon };
        this.releaseKeyboard();
        this.iconPicker = picker;
        try {
            const flags = PM_Gio.SubprocessFlags;
            picker.process = PM_Gio.Subprocess.new(["python3", a._pmSourcePath + "/icon_chooser.py"],
                flags.STDIN_PIPE | flags.STDOUT_PIPE | flags.STDERR_PIPE);
            this.watchPickerWindow(picker);
            picker.process.communicate_utf8_async(JSON.stringify({ current, default: defaultIcon }), null, (process, result) => {
                let received = false;
                try {
                    const [ok, output] = process.communicate_utf8_finish(result);
                    if (this.iconPicker !== picker) return;
                    this.iconPicker = null;
                    this.finishPickerLayer(picker);
                    received = true;
                    if (!this.enabled || this.destroyed || a._pmDisposed || !a._pmPersonalActive) return;
                    if (!ok || !process.get_successful()) throw new Error(_("The icon chooser closed unexpectedly."));
                    const reply = JSON.parse(output);
                    if (!reply || reply.ok !== true) throw new Error(reply && reply.message || _("Invalid icon selection."));
                    if (!reply.cancelled) {
                        if (!personal.store.setIcon(picker.categoryId, picker.entryId, reply.icon, picker.defaultIcon))
                            throw new Error(_("Could not save the icon."));
                        this.refreshAfterChange(false);
                    }
                    const actor = this.selectedActor;
                    this.focusActor(actor && actor.is_mapped() ? actor : a.menu.actor);
                } catch (error) {
                    if (!received && this.iconPicker !== picker) return;
                    if (this.iconPicker === picker) this.cancelIconPicker();
                    if (this.enabled && !this.destroyed && !a._pmDisposed)
                        PM_Main.notifyError("SuperMenu", String(error));
                }
            });
        } catch (error) {
            if (this.iconPicker === picker) this.cancelIconPicker();
            PM_Main.notifyError("SuperMenu", _("Could not open the icon chooser: %s").format(String(error)));
        }
    }

    cancelIconPicker() {
        const picker = this.iconPicker;
        this.iconPicker = null;
        if (picker) {
        this.finishPickerLayer(picker);
            try { picker.process.force_exit(); }
            catch (error) { /* The native dialog may already have exited. */ }
        }
    }

    watchPickerWindow(picker) {
        const processId = typeof picker.process.get_identifier === "function" ? Number(picker.process.get_identifier()) : 0;
        if (!processId) return;
        picker.layerSignals = [];
        const attach = (window, actor = null) => {
            if ((this.iconPicker !== picker && this.contentPicker !== picker) ||
                picker.window || !window || window.get_pid() !== processId) return;
            actor = actor || window.get_compositor_private();
            if (!actor || !actor.get_parent()) return;
            picker.window = window;
            picker.windowActor = actor;
            const menu = this.applet.menu.actor, parent = menu.get_parent();
            picker.previousLayer = { parent, index: parent.get_children().indexOf(menu), reactive: menu.reactive };
            picker.suspendedChrome = [];
            // X11's shell input region would otherwise cover the dialog even
            // when it paints above the menu. Suspend both editor popup regions.
            for (const candidate of [menu, this.applet._applet_context_menu.actor]) {
                if (PM_Main.layoutManager.isTrackingChrome(candidate)) {
                    PM_Main.layoutManager.untrackChrome(candidate);
                    picker.suspendedChrome.push(candidate);
                }
            }
            menu.reactive = false;
            const position = () => {
                if (!picker.previousLayer || actor.is_finalized() || menu.is_finalized()) return;
                const windowParent = actor.get_parent();
                if (!windowParent) return;
                if (menu.get_parent() !== windowParent) {
                    if (menu.get_parent()) menu.get_parent().remove_child(menu);
                    windowParent.add_child(menu);
                }
                windowParent.set_child_below_sibling(menu, actor);
            };
            position();
            picker.layerSignals.push([global.display, global.display.connect("restacked", position)]);
            picker.layerSignals.push([actor, actor.connect("destroy", () => this.finishPickerLayer(picker))]);
        };
        picker.layerSignals.push([global.display, global.display.connect("window-created", (_display, window) => attach(window))]);
        if (global.window_manager && typeof global.window_manager.connect === "function")
            picker.layerSignals.push([global.window_manager, global.window_manager.connect("map", (_manager, actor) =>
                attach(actor.meta_window, actor))]);
        if (typeof global.get_window_actors === "function")
            for (const actor of global.get_window_actors()) attach(actor.meta_window, actor);
    }

    finishPickerLayer(picker) {
        for (const [object, signal] of picker.layerSignals || []) object.disconnect(signal);
        picker.layerSignals = [];
        const previous = picker.previousLayer;
        picker.previousLayer = null;
        if (!previous) return;
        const menu = this.applet.menu.actor;
        if (!menu.is_finalized() && !previous.parent.is_finalized()) {
            if (menu.get_parent()) menu.get_parent().remove_child(menu);
            previous.parent.insert_child_at_index(menu, Math.min(previous.index, previous.parent.get_children().length));
            menu.reactive = previous.reactive;
        }
        for (const actor of picker.suspendedChrome || []) {
            if (!actor.is_finalized() && !PM_Main.layoutManager.isTrackingChrome(actor))
                PM_Main.layoutManager.trackChrome(actor, { affectsInputRegion: true,
                    affectsStruts: false, visibleInFullscreen: true, doNotAdd: true });
        }
        picker.suspendedChrome = [];
    }

    beginInput(action, row) {
        const a = this.applet, drawer = a._pmDrawer, store = a._pmPersonal.store;
        if (!this.enabled || !a._pmPersonalActive || !drawer.contextMenu || !drawer.contextMenu.isOpen) return;
        const group = store.state.categories.find(item => item.id === (row._pmCategory ? row.id : row._pmCategoryId));
        const entry = group && group.entries.find(item => item.id === row._pmEntryId);
        if ((action === "rename" && !(row._pmCategory ? group : entry)) || action === "command" && !entry ||
            action === "remove-category" && !group || action === "remove-entry" && !entry) return;
        const menu = drawer.contextMenu;
        this.clearCopyFeedback();
        a._pmFocusMenu();
        menu.removeAll();
        const input = { action, row, menu, categoryId: group ? group.id : null,
            entryId: entry ? entry.id : null, fields: [] };
        this.input = input;
        const headings = { rename: _("Rename"), command: _("Change launch command"), "new-entry": _("New entry"),
            "new-category": _("New category"), "remove-category": _("Remove category?"), "remove-entry": _("Remove entry?") };
        menu.addMenuItem(new PM_PopupMenu.PopupMenuItem(headings[action], { reactive: false }));
        const removing = action === "remove-category" || action === "remove-entry";
        if (removing) {
            menu.addMenuItem(new PM_PopupMenu.PopupMenuItem(action === "remove-category" ?
                group.name : row.label.get_text(), { reactive: false }));
            const count = action === "remove-category" ? group.entries.filter(item => item.type !== "separator").length : 0;
            if (count) menu.addMenuItem(new PM_PopupMenu.PopupMenuItem(
                _("Entries: %d").format(count), { reactive: false }));
        } else {
            const field = (key, label, text, icon) => {
                const item = new PM_PopupMenu.PopupBaseMenuItem({ reactive: false });
                const edit = new PM_St.Entry({ name: "appmenu-search-entry", hint_text: label,
                    can_focus: true, reactive: true, track_hover: true, accessible_name: label,
                    accessible_role: PM_Atk.Role.ENTRY, style: "min-width: 0px;" });
                edit.set_primary_icon(new PM_St.Icon({ icon_name: icon, icon_type: PM_St.IconType.SYMBOLIC,
                    icon_size: 16 }));
                edit.set_text(text);
                item.addActor(edit, { span: -1, expand: true });
                item._pmInputEntry = edit;
                item.actor.connect("get-preferred-width", (actor, height, allocation) => {
                    const limit = drawer.rowWidth(actor);
                    allocation.min_size = Math.min(allocation.min_size, limit);
                    allocation.natural_size = Math.min(allocation.natural_size, limit);
                });
                edit.clutter_text.connect("text-changed", () => this.validateInput());
                edit.clutter_text.connect("activate", () => {
                    if (this.input !== input) return;
                    const index = input.fields.indexOf(edit);
                    if (index < input.fields.length - 1) this.focusActor(input.fields[index + 1]);
                    else this.commitInput();
                });
                edit.clutter_text.connect("key-press-event", (actor, event) => {
                    const key = event.get_key_symbol();
                    if ([PM_Clutter.KEY_Tab, PM_Clutter.KEY_ISO_Left_Tab].includes(key))
                        return drawer.handleRowKey(edit, event);
                    // Editing/caret keys belong to Clutter.Text, including IME.
                    return PM_Clutter.EVENT_PROPAGATE;
                });
                menu.addMenuItem(item);
                input[key] = edit;
                input.fields.push(edit);
            };
            const categoryName = action === "new-category" || action === "rename" && row._pmCategory;
            if (action !== "command") field("name", categoryName ?
                _("Category name") : _("Entry name"), action === "rename" ? (row._pmCategory ? group.name :
                    entry.name || row.label.get_text()) : action === "new-category" ? _("New category") : _("New entry"),
                categoryName ? "folder-symbolic" : "application-x-executable-symbolic");
            if (action === "command" || action === "new-entry") {
                input.initialCommand = action === "command" ? store.entryCommand(entry) : "";
                field("command", _("Launch command"), input.initialCommand, "system-run-symbolic");
            }
            if (action === "new-entry" && store.state.categories.length > 0) {
                input.categoryId = group ? group.id : store.state.categories[0].id;
                const picker = _pmCategoryItem(a, menu);
                const select = category => {
                    input.categoryId = category.id;
                    picker.label.set_text(_("Category: %s").format(category.name));
                    picker.menu.close(a.enableAnimation === true);
                    drawer.syncContextLayout();
                    this.focusActor(picker.actor);
                };
                picker.label.set_text(_("Category: %s").format(store.state.categories.find(item => item.id === input.categoryId).name));
                for (const category of store.state.categories) {
                    const choice = new PM_PopupMenu.PopupMenuItem(category.name, { focusOnHover: false });
                    choice.activate = () => select(category);
                    picker.menu.addMenuItem(choice);
                }
                menu.addMenuItem(picker);
            }
        }
        input.status = new PM_PopupMenu.PopupMenuItem("", { reactive: false });
        menu.addMenuItem(input.status);
        input.status.actor.hide();
        input.commit = new PM_PopupMenu.PopupIconMenuItem(removing ? _("Remove") :
            action.startsWith("new-") ? _("Create") : _("Apply"), removing ?
                "list-remove-symbolic" : "object-select-symbolic", PM_St.IconType.SYMBOLIC);
        input.commit._action = "pm_edit_input-save";
        input.commit.activate = () => this.commitInput();
        menu.addMenuItem(input.commit);
        const cancel = new PM_PopupMenu.PopupIconMenuItem(_("Cancel"), "edit-undo-symbolic", PM_St.IconType.SYMBOLIC);
        cancel._action = "pm_edit_input-cancel";
        cancel.activate = () => this.cancelInput();
        menu.addMenuItem(cancel);
        drawer.prepareContextItems(menu);
        for (const item of menu._getMenuItems()) if (item.label && !item.actor.can_focus) _pmDrawerCompactRow(item, drawer);
        this.validateInput();
        this.updateHoverPolicy();
        drawer.syncContextLayout();
        const first = input.fields[0];
        if (first) {
            this.focusActor(first);
            first.clutter_text.set_selection(0, -1);
        } else this.focusActor(cancel.actor);
    }

    validateInput() {
        const input = this.input;
        if (!input || !input.commit) return;
        const store = this.applet._pmPersonal.store;
        input.commit.setSensitive(input.fields.every(field => store.validText(field.get_text())));
        const hadError = input.status.actor.visible;
        input.status.actor.hide();
        if (hadError) this.applet._pmDrawer.syncContextLayout();
    }

    cancelInput() {
        const input = this.input;
        if (!input) return;
        this.input = null;
        const drawer = this.applet._pmDrawer;
        this.applet._pmFocusMenu();
        input.menu.removeAll();
        this.populateActions(input.menu, input.row);
        drawer.prepareContextItems(input.menu);
        this.updateHoverPolicy();
        drawer.syncContextLayout();
        this.focusActor(input.row.actor);
    }

    commitInput() {
        const input = this.input, a = this.applet;
        if (!input || !this.enabled || !a._pmPersonalActive || !input.commit.sensitive) return;
        const store = a._pmPersonal.store;
        const name = input.name && input.name.get_text(), command = input.command && input.command.get_text();
        let saved;
        if (input.action === "rename") saved = store.rename(input.categoryId, input.entryId, name);
        else if (input.action === "command") saved = command === input.initialCommand || store.setCommand(input.entryId, command);
        else if (input.action === "new-category") saved = store.createCategory(name);
        else if (input.action === "new-entry") saved = store.createEntry(input.categoryId, name, command);
        else if (input.action === "remove-category") saved = store.removeCategory(input.categoryId);
        else if (input.action === "remove-entry") saved = store.remove(input.entryId);
        if (!saved) {
            input.status.label.set_text(_("Could not save the change."));
            input.status.actor.show();
            a._pmDrawer.syncContextLayout();
            return;
        }
        this.input = null;
        if (input.action === "new-category") this.selection = { type: "category", id: saved };
        else if (input.action === "new-entry") this.selection = { type: "entry", id: saved.id };
        else if (input.action === "remove-category" || input.action === "remove-entry") this.clearSelection();
        this.refreshAfterChange(false);
        if (input.action === "new-entry" && !a._pmIsPersonalList()) {
            a._pmDrawer.openCategory(saved.categoryId);
            if (this.selectedActor && this.selectedActor.is_mapped()) {
                a._pmDrawer.focusActor(this.selectedActor);
                this.focusActor(this.selectedActor);
            }
        }
    }

    move(row, direction, moveCategory = false) {
        const a = this.applet;
        if (!this.enabled || !a._pmPersonalActive || row._pmSeparator ||
            a._pmIsPersonalList() && a._pmPersonalSort === "alphabetical") return;
        const category = moveCategory || row._pmCategory === true;
        if (!a._pmPersonal.store.move(row._pmCategory ? row.id : row._pmCategoryId,
            category ? null : row._pmEntryId, direction, this.orderedIds(row, category))) {
            PM_Main.notifyError("SuperMenu", _("Could not save the order."));
            return;
        }
        const prefix = moveCategory ? "pm_edit_this-category_" : "pm_edit_";
        this.refreshAfterChange(true, prefix + (direction === -1 ? "up" : "down"));
    }

    addSeparator(row) {
        const a = this.applet;
        if (!this.enabled || !a._pmPersonalActive || a._pmIsPersonalList()) return;
        if (!a._pmPersonal.store.addSeparator(row._pmEntryId)) {
            PM_Main.notifyError("SuperMenu", _("Could not save the separator."));
            return;
        }
        this.refreshAfterChange(false);
    }

    removeSeparator(row) {
        const a = this.applet;
        if (!this.enabled || !a._pmPersonalActive || !row._pmSeparator) return;
        if (!a._pmPersonal.store.remove(row._pmEntryId)) {
            PM_Main.notifyError("SuperMenu", _("Could not remove the separator."));
            return;
        }
        const rows = a._pmDrawer.categoryView(row._pmCategoryId).rows;
        const previous = rows.slice(0, rows.indexOf(row)).reverse().find(item => !item._pmSeparator);
        this.selection = previous ? { type: "entry", id: previous._pmEntryId } : null;
        this.refreshAfterChange(false);
    }

    refreshAfterChange(keepActions, action = null) {
        const a = this.applet, drawer = a._pmDrawer;
        const scrolls = drawer.captureScrollPositions();
        a._pmFocusMenu();
        a._pmPersonal.populateEntries();
        drawer.refreshPrograms(keepActions);
        a._size_dirty = true;
        drawer.syncContextLayout();
        drawer.restoreScrollPositions(scrolls);
        if (!this.selectedActor || !this.selectedActor.is_mapped()) return;
        drawer.focusActor(this.selectedActor);
        const menu = keepActions && drawer.contextMenu && drawer.contextMenu.isOpen && drawer.contextMenu;
        const parent = menu && action && menu._getMenuItems().find(item => item.menu &&
            item.menu._getMenuItems().some(child => child._action === action));
        if (parent) parent.menu.open(false);
        const item = menu && drawer.contextItems(menu, true).find(item => item._action === action && item.sensitive !== false);
        this.focusActor(item ? item.actor : parent ? parent.actor : this.selectedActor);
        // Restoring scroll positions and revealing the source can conceal the
        // lower actions again. The retained popup is the final scroll target.
        if (keepActions) drawer.scrollContextIntoView();
    }

    copyEntry(row, categoryId) {
        const a = this.applet, personal = a._pmPersonal, drawer = a._pmDrawer;
        if (!this.enabled || !personal.active || !row._pmEntryId) return;
        if (a._pmIsPersonalList() && a._pmPersonalSort === "alphabetical") return;
        if (!personal.store.copy(row._pmEntryId, categoryId)) {
            PM_Main.notifyError("SuperMenu", _("Could not copy the entry."));
            return;
        }
        personal.populateEntries();
        // Retain the open action popup while replacing its source projection.
        // Let the old picker finish shrinking before its rows are replaced.
        const refresh = () => {
            if (drawer.destroyed || !this.enabled || !personal.active) return;
            drawer.refreshPrograms(true);
            a._size_dirty = true;
            const action = drawer.contextMenu._getMenuItems().find(item => item._action === "pm_edit_category");
            if (!action || !drawer.contextMenu.isOpen) return;
            this.focusActor(action.actor);
            // Retain the keyboard location without selecting the confirmation.
            // Native key-focus-in otherwise leaves it active until the mouse moves.
            action.setActive(false);
            const target = personal.store.state.categories.find(group => group.id === categoryId);
            this.showCopyFeedback(action, target);
            drawer.syncContextLayout();
        };
        const picker = drawer.contextMenu._getMenuItems().find(item => item._action === "pm_edit_category");
        if (picker && picker.menu.isOpen) {
            picker.menu._pmAfterClose = refresh;
            picker.menu._pmCancelClose = () => { drawer._contextNeedsRefresh = true; };
            picker.menu.close(a.enableAnimation === true);
        } else refresh();
    }

    showCopyFeedback(action, target) {
        const drawer = this.applet._pmDrawer;
        const category = drawer.categoryView(target.id);
        const heading = category && category.heading;
        const shown = heading && heading.actor.is_mapped() ? heading : null;
        // The personal panel face is already selected while editing.
        // Copying only paints a destination heading when the view exposes it.
        this.showActionFeedback(action, _("Copied to: %s").format(target.name), shown, drawer.contextMenu);
    }

    showActionFeedback(action, text, heading, menu) {
        this.clearCopyFeedback();
        this.copyFeedback = { action, label: action.label.get_text(),
            heading: heading && { actor: heading.actor, style: String(heading.actor.style || "") }, menu,
            signal: menu.connect("open-state-changed", (popup, open) => {
                if (!open) this.clearCopyFeedback();
            }) };
        action.label.set_text(text);
        // Keep the source confirmation as text. Only its destination gets
        // a timed color cue, without changing selection, focus or scroll.
        if (heading) {
            this.ensureProbe();
            const actor = heading.actor;
            actor.set_style(String(actor.style || "") + _superMenuSelectionBackground(this.selectionColor()));
        }
        this.copyFeedbackTimer = PM_Mainloop.timeout_add(2000, () => {
            this.copyFeedbackTimer = 0;
            this.clearCopyFeedback();
            return false;
        });
    }

    clearCopyFeedback() {
        if (this.copyFeedbackTimer) PM_Mainloop.source_remove(this.copyFeedbackTimer);
        this.copyFeedbackTimer = 0;
        const feedback = this.copyFeedback;
        this.copyFeedback = null;
        if (!feedback) return;
        feedback.menu.disconnect(feedback.signal);
        if (!feedback.action.actor.is_finalized()) feedback.action.label.set_text(feedback.label);
        const heading = feedback.heading;
        if (heading && !heading.actor.is_finalized()) heading.actor.set_style(heading.style);
    }

    clearSelection() {
        if (this.selectedActor && !this.selectedActor.is_finalized()) {
            this.selectedActor.remove_style_class_name("pm-edit-selected");
            this.selectedActor.set_style(this.selectedStyle);
        }
        this.selectedActor = null;
        this.selection = null;
        this.selectionName = null;
    }

    refreshSelection() {
        if (!this.enabled || !this.applet._pmPersonalActive) return;
        this.updateHoverPolicy();
        this.syncFrame();
        const selection = this.selection;
        this.clearSelection();
        if (!selection) return;
        const drawer = this.applet._pmDrawer;
        const row = drawer.findItemRow(selection);
        if (!row) return;
        this.selection = selection;
        this.selectedActor = row.actor;
        this.selectedStyle = String(row.actor.style || "");
        row.actor.add_style_class_name("pm-edit-selected");
        row.actor.set_style(this.selectedStyle + " border-color: " + this.color + ";");
        this.selectionName = row._pmSeparator ? "Trennstrich" : row.label.get_text();
    }

    destroy() {
        const wasEnabled = this.enabled;
        this.cancelContentPicker();
        this.closeModeMenu();
        if (this.modeMenu) this.modeMenu.destroy();
        this.modeMenu = null;
        this.cancelOpen();
        this.clearCopyFeedback();
        this.hideFrameHint();
        this.enabled = false;
        this.publishState();
        if (this.settingsBridge) this.settingsBridge.unexport();
        this.settingsBridge = null;
        this.syncAppletContext();
        this.clearSelection();
        this.updateHoverPolicy();
        this.syncFrame();
        this.stopInput();
        this.destroyed = true;
        this.applet.menu.close = this.nativeClose;
        if (wasEnabled) this.applet.menu.close(false);
        if (wasEnabled) this.applet._applet_context_menu.close(false);
        this.applet._applet_context_menu.disconnect(this.contextSignal);
        this.item.destroy();
        this.separator.destroy();
        if (this.probe) this.probe.destroy();
        if (this.colorEntry) this.colorEntry.destroy();
        if (this.frameBox) {
            const menu = this.applet.menu;
            this.frameTooltip.destroy();
            this.frameBox.remove_child(menu._boxWrapper);
            menu.actor.set_child(menu._boxWrapper);
            this.frameBox.destroy();
        }
    }
}
