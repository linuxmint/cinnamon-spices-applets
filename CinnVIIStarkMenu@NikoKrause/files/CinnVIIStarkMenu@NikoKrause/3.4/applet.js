const Applet = imports.ui.applet;
const Mainloop = imports.mainloop;
const CMenu = imports.gi.CMenu;
const Lang = imports.lang;
const Cinnamon = imports.gi.Cinnamon;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const Main = imports.ui.main;
const MessageTray = imports.ui.messageTray;
const PopupMenu = imports.ui.popupMenu;
const AppFavorites = imports.ui.appFavorites;
const Gtk = imports.gi.Gtk;
const Atk = imports.gi.Atk;
const Gio = imports.gi.Gio;
const GnomeSession = imports.misc.gnomeSession;
const ScreenSaver = imports.misc.screenSaver;
const FileUtils = imports.misc.fileUtils;
const Util = imports.misc.util;
const Tweener = imports.ui.tweener;
const DND = imports.ui.dnd;
const Meta = imports.gi.Meta;
const DocInfo = imports.misc.docInfo;
const GLib = imports.gi.GLib;
const Settings = imports.ui.settings;
const Pango = imports.gi.Pango;
const SearchProviderManager = imports.ui.searchProviderManager;

const AccountsService = imports.gi.AccountsService;
const Tooltips = imports.ui.tooltips;
const Session = new GnomeSession.SessionManager();

const ICON_SIZE = 16;
const MAX_FAV_ICON_SIZE = 64;
const CATEGORY_ICON_SIZE = 22;
const APPLICATION_ICON_SIZE = 22;
const HOVER_ICON_SIZE = 48;

const INITIAL_BUTTON_LOAD = 30;
const MAX_BUTTON_WIDTH = "max-width: 20em;";

const USER_DESKTOP_PATH = FileUtils.getUserDesktopDir();

const PRIVACY_SCHEMA = "org.cinnamon.desktop.privacy";
const REMEMBER_RECENT_KEY = "remember-recent-files";

let appsys = Cinnamon.AppSystem.get_default();
let visiblePane = "favs";

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

function VisibleChildIterator(container) {
    this._init(container);
}

VisibleChildIterator.prototype = {
    _init: function(container) {
        this.container = container;
        this.reloadVisible();
    },

    reloadVisible: function() {
        this.array = this.container.get_focus_chain()
            .filter(x => !(x._delegate instanceof PopupMenu.PopupSeparatorMenuItem));
    },

    getNextVisible: function(curChild) {
        return this.getVisibleItem(this.array.indexOf(curChild) + 1);
    },

    getPrevVisible: function(curChild) {
        return this.getVisibleItem(this.array.indexOf(curChild) - 1);
    },

    getFirstVisible: function() {
        return this.array[0];
    },

    getLastVisible: function() {
        return this.array[this.array.length - 1];
    },

    getVisibleIndex: function(curChild) {
        return this.array.indexOf(curChild);
    },

    getVisibleItem: function(index) {
        let len = this.array.length;
        index = ((index % len) + len) % len;
        return this.array[index];
    },

    getNumVisibleChildren: function() {
        return this.array.length;
    },

    getAbsoluteIndexOfChild: function(child) {
        return this.container.get_children().indexOf(child);
    }
};

function ApplicationContextMenuItem(appButton, label, action, iconName, showIcon) {
    this._init(appButton, label, action, iconName, showIcon);
}

ApplicationContextMenuItem.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    _init: function (appButton, label, action, iconName, showIcon) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {focusOnHover: false});

        this._appButton = appButton;
        this._action = action;
        this.label = new St.Label({ text: label });

        if (iconName != null && showIcon) {
            this.icon = new St.Icon({ icon_name: iconName, icon_size: 12, icon_type: St.IconType.SYMBOLIC });
            if (this.icon) {
                this.addActor(this.icon);
                this.icon.realize();
            }
        }

        this.addActor(this.label);
    },

    activate: function (event) {
        switch (this._action){
            case "add_to_panel": {
                if (!Main.AppletManager.get_role_provider_exists(Main.AppletManager.Roles.PANEL_LAUNCHER)) {
                    let new_applet_id = global.settings.get_int("next-applet-id");
                    global.settings.set_int("next-applet-id", (new_applet_id + 1));
                    let enabled_applets = global.settings.get_strv("enabled-applets");
                    enabled_applets.push("panel1:right:0:panel-launchers@cinnamon.org:" + new_applet_id);
                    global.settings.set_strv("enabled-applets", enabled_applets);
                }

                let launcherApplet = Main.AppletManager.get_role_provider(Main.AppletManager.Roles.PANEL_LAUNCHER);
                launcherApplet.acceptNewLauncher(this._appButton.app.get_id());

                this._appButton.toggleMenu();
                break;
            } case "add_to_desktop": {
                let file = Gio.file_new_for_path(this._appButton.app.get_app_info().get_filename());
                let destFile = Gio.file_new_for_path(USER_DESKTOP_PATH+"/"+file.get_basename());
                try{
                    file.copy(destFile, 0, null, function(){});
                    FileUtils.changeModeGFile(destFile, 755);
                }catch(e){
                    global.log(e);
                }
                this._appButton.toggleMenu();
                break;
            } case "add_to_favorites": {
                AppFavorites.getAppFavorites().addFavorite(this._appButton.app.get_id());
                this._appButton.toggleMenu();
                break;
            } case "remove_from_favorites": {
                AppFavorites.getAppFavorites().removeFavorite(this._appButton.app.get_id());
                this._appButton.toggleMenu();
                break;
            } case "uninstall": {
                Util.spawnCommandLine("/usr/bin/cinnamon-remove-application '" + this._appButton.app.get_app_info().get_filename() + "'");
                this._appButton.appsMenuButton.menu.close();
                break;
            } case "run_with_nvidia_gpu": {
                Util.spawnCommandLine("optirun gtk-launch " + this._appButton.app.get_id());
                this._appButton.appsMenuButton.menu.close();
                break;
            }
        }
        return false;
    }

};

function GenericApplicationButton(appsMenuButton, app) {
    this._init(appsMenuButton, app);
}

GenericApplicationButton.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    _init: function(appsMenuButton, app, withMenu) {
        this.app = app;
        this.appsMenuButton = appsMenuButton;
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {hover: false});

        this.withMenu = withMenu;
        if (this.withMenu){
            this.menu = new PopupMenu.PopupSubMenu(this.actor);
            this.menu.actor.set_style_class_name('menu-context-menu');
            this.menu.connect('open-state-changed', Lang.bind(this, this._subMenuOpenStateChanged));
        }

        this.showContextIcon = false;
    },

    highlight: function() {
        this.actor.add_style_pseudo_class('highlighted');
    },

    unhighlight: function() {
        var app_key = this.app.get_id();
        if (app_key == null) {
            app_key = this.app.get_name() + ":" + this.app.get_description();
        }
        this.appsMenuButton._knownApps.push(app_key);
        this.actor.remove_style_pseudo_class('highlighted');
    },

    _onButtonReleaseEvent: function (actor, event) {
        if (event.get_button()==1){
            this.activate(event);
        }
        if (event.get_button()==3){
            this.activateContextMenus(event);
        }
        return true;
    },

    activate: function(event) {
        this.unhighlight();
        this.app.open_new_window(-1);
        this.appsMenuButton.menu.close();
    },

    activateContextMenus: function(event) {
        if (this.withMenu && !this.menu.isOpen)
            this.appsMenuButton.closeContextMenus(this.app, true);
        this.toggleMenu();
    },

    closeMenu: function() {
        if (this.withMenu) this.menu.close();
    },

    toggleMenu: function() {
        if (!this.withMenu) return;

        if (!this.menu.isOpen){
            let children = this.menu.box.get_children();
            for (var i in children) {
                this.menu.box.remove_actor(children[i]);
            }
            let menuItem;
            menuItem = new ApplicationContextMenuItem(this, _("Add to panel"), "add_to_panel", "list-add", this.showContextIcon);
            this.menu.addMenuItem(menuItem);
            if (USER_DESKTOP_PATH){
                menuItem = new ApplicationContextMenuItem(this, _("Add to desktop"), "add_to_desktop", "computer", this.showContextIcon);
                this.menu.addMenuItem(menuItem);
            }
            if (AppFavorites.getAppFavorites().isFavorite(this.app.get_id())){
                menuItem = new ApplicationContextMenuItem(this, _("Remove from favorites"), "remove_from_favorites", "starred", this.showContextIcon);
                this.menu.addMenuItem(menuItem);
            }else{
                menuItem = new ApplicationContextMenuItem(this, _("Add to favorites"), "add_to_favorites", "non-starred", this.showContextIcon);
                this.menu.addMenuItem(menuItem);
            }
            if (this.appsMenuButton._canUninstallApps) {
                menuItem = new ApplicationContextMenuItem(this, _("Uninstall"), "uninstall", "edit-delete", this.showContextIcon);
                this.menu.addMenuItem(menuItem);
            }
            if (this.appsMenuButton._isBumblebeeInstalled) {
                menuItem = new ApplicationContextMenuItem(this, _("Run with NVIDIA GPU"), "run_with_nvidia_gpu", "cpu", this.showContextIcon);
                this.menu.addMenuItem(menuItem);
            }
        }
        this.menu.toggle();
    },

    _subMenuOpenStateChanged: function() {
        if (this.menu.isOpen) {
            this.appsMenuButton._activeContextMenuParent = this;
            this.appsMenuButton._scrollToButton(this.menu);
        } else {
            this.appsMenuButton._activeContextMenuItem = null;
            this.appsMenuButton._activeContextMenuParent = null;
        }
    },

    get _contextIsOpen() {
        return this.menu.isOpen;
    },

    destroy: function() {
        this.label.destroy();

        if (this.icon) {
            this.icon.destroy();
        }

        if (this.withMenu) {
            this.menu.destroy();
        }

        PopupMenu.PopupBaseMenuItem.prototype.destroy.call(this);
    }
};

function TransientButton(appsMenuButton, pathOrCommand) {
    this._init(appsMenuButton, pathOrCommand);
}

TransientButton.prototype = {
    __proto__: PopupMenu.PopupSubMenuMenuItem.prototype,

    _init: function(appsMenuButton, pathOrCommand) {
        let displayPath = pathOrCommand;
        if (pathOrCommand.charAt(0) == '~') {
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

        this.appsMenuButton = appsMenuButton;
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {hover: false});

        // We need this fake app to help appEnterEvent/appLeaveEvent
        // work with our search result.
        this.app = {
            get_app_info: {
                get_filename: function() {
                    return pathOrCommand;
                }
            },
            get_id: function() {
                return -1;
            },
            get_description: function() {
                return this.pathOrCommand;
            },
            get_name: function() {
                return '';
            }
        };



        this.file = Gio.file_new_for_path(this.pathOrCommand);

        try {
            this.handler = this.file.query_default_handler(null);
            let contentType = Gio.content_type_guess(this.pathOrCommand, null);
            let themedIcon = Gio.content_type_get_icon(contentType[0]);
            this.icon = new St.Icon({gicon: themedIcon, icon_size: APPLICATION_ICON_SIZE, icon_type: St.IconType.FULLCOLOR });
            this.actor.set_style_class_name('menu-application-button');
        } catch (e) {
            this.handler = null;
            let iconName = this.isPath ? 'folder' : 'unknown';
            this.icon = new St.Icon({icon_name: iconName, icon_size: APPLICATION_ICON_SIZE, icon_type: St.IconType.FULLCOLOR,});
            // @todo Would be nice to indicate we don't have a handler for this file.
            this.actor.set_style_class_name('menu-application-button');
        }

        this.addActor(this.icon);

        this.label = new St.Label({ text: displayPath, style_class: 'menu-application-button-label' });
        this.label.clutter_text.ellipsize = Pango.EllipsizeMode.END;
        this.label.set_style(MAX_BUTTON_WIDTH);
        this.addActor(this.label);
        this.isDraggableApp = false;
    },

    _onButtonReleaseEvent: function (actor, event) {
        if (event.get_button()==1){
            this.activate(event);
        }
        return true;
    },

    activate: function(event) {
        if (this.handler != null) {
            this.handler.launch([this.file], null);
        } else {
            // Try anyway, even though we probably shouldn't.
            try {
                Util.spawn(['gvfs-open', this.file.get_uri()]);
            } catch (e) {
                global.logError("No handler available to open " + this.file.get_uri());
            }

        }

        this.appsMenuButton.menu.close();
    }
};

String.prototype.replaceAt=function(index, character) {
    return this.substr(0, index) + character + this.substr(index+character.length);
};

function TooltipCustom(actor, string, multiline) {
    this._init(actor, string, multiline);
}

TooltipCustom.prototype = {
    __proto__: Tooltips.Tooltip.prototype,

    _init: function(actor, string, multiline) {
        let formatString = string;
        if (multiline) {
            let lastSpacePos = -1;
            let tooltipWidth = 80;
            let tooltipLines = Math.ceil(1.0 * formatString.length / tooltipWidth) - 1;

            for (let i = 0; i < tooltipLines; i++) {
                lastSpacePos = formatString.lastIndexOf(" ", lastSpacePos + tooltipWidth);
                formatString = formatString.replaceAt(lastSpacePos, "\n");
            }
        }

        if(formatString == "null")
            formatString = _("No description available");

        Tooltips.Tooltip.prototype._init.call(this, actor, formatString);
        this._tooltip.set_style("text-align: left;");
        this._tooltip.get_clutter_text().set_line_wrap(true);
        this._tooltip.get_clutter_text().set_line_wrap_mode(Pango.WrapMode.WORD_CHAR);
        this._tooltip.get_clutter_text().ellipsize = Pango.EllipsizeMode.NONE;
    }
};

function ApplicationButton(appsMenuButton, app, showIcon, showContextIcon, showAppsDescription) {
    this._init(appsMenuButton, app, showIcon, showContextIcon, showAppsDescription);
}

ApplicationButton.prototype = {
    __proto__: GenericApplicationButton.prototype,

    _init: function(appsMenuButton, app, showIcon, showContextIcon, showAppsDescription) {
        GenericApplicationButton.prototype._init.call(this, appsMenuButton, app, true);
        this.category = [];
        this.actor.set_style_class_name('menu-application-button');

        if (showIcon) {
            this.icon = this.app.create_icon_texture(APPLICATION_ICON_SIZE);
            this.addActor(this.icon);
        }
        this.name = this.app.get_name();
        this.label = new St.Label({ text: this.name, style_class: 'menu-application-button-label' });
        this.label.clutter_text.ellipsize = Pango.EllipsizeMode.END;
        this.label.set_style(MAX_BUTTON_WIDTH);

        if (showAppsDescription) {
            let appDescription = this.app.get_description();
            if (appDescription == null)
                appDescription = _("No description available");
            this.label.get_clutter_text().set_markup(this.name.replace("&", "&amp;") + '\n' + '<span size="small">' + appDescription + '</span>');
        }

        this.addActor(this.label);
        this._draggable = DND.makeDraggable(this.actor);
        this._draggable.connect('drag-end', Lang.bind(this, this._onDragEnd));
        this.isDraggableApp = true;
        this.actor.label_actor = this.label;
        if (showIcon) {
            this.icon.realize();
        }
        this.label.realize();

        this.showContextIcon = showContextIcon;

        let tooltipString = this.app.get_description() + "";
        this.tooltip = new TooltipCustom(this.actor, tooltipString, true);
    },

    get_app_id: function() {
        return this.app.get_id();
    },

    getDragActor: function() {
        let favorites = AppFavorites.getAppFavorites().getFavorites();
        let nbFavorites = favorites.length;
        let monitorHeight = Main.layoutManager.primaryMonitor.height;
        let real_size = (0.7 * monitorHeight) / nbFavorites;
        let icon_size = 0.6 * real_size;
        if (icon_size > MAX_FAV_ICON_SIZE)
            icon_size = MAX_FAV_ICON_SIZE;
        return this.app.create_icon_texture(icon_size);
    },

    // Returns the original actor that should align with the actor
    // we show as the item is being dragged.
    getDragActorSource: function() {
        return this.actor;
    },

    _onDragEnd: function() {
        this.appsMenuButton.favoritesBox._delegate._clearDragPlaceholder();
    }
};

function SearchProviderResultButton(appsMenuButton, provider, result) {
    this._init(appsMenuButton, provider, result);
}

SearchProviderResultButton.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    _init: function(appsMenuButton, provider, result) {
        this.provider = provider;
        this.result = result;

        this.appsMenuButton = appsMenuButton;
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {hover: false});
        this.actor.set_style_class_name('menu-application-button');

        // We need this fake app to help appEnterEvent/appLeaveEvent
        // work with our search result.
        this.app = {
            get_app_info: {
                get_filename: function() {
                    return result.id;
                }
            },
            get_id: function() {
                return -1;
            },
            get_description: function() {
                return result.description;
            },
            get_name: function() {
                return result.label;
            }
        };

        this.icon = null;
        if (result.icon){
            this.icon = result.icon;
        }else if (result.icon_app){
            this.icon = result.icon_app.create_icon_texture(APPLICATION_ICON_SIZE);
        }else if (result.icon_filename){
            this.icon = new St.Icon({gicon: new Gio.FileIcon({file: Gio.file_new_for_path(result.icon_filename)}), icon_size: APPLICATION_ICON_SIZE});
        }

        if (this.icon){
            this.addActor(this.icon);
        }
        this.label = new St.Label({ text: result.label, style_class: 'menu-application-button-label' });
        this.addActor(this.label);
        this.isDraggableApp = false;
        if (this.icon) {
            this.icon.realize();
        }
        this.label.realize();
    },

    _onButtonReleaseEvent: function (actor, event) {
        if (event.get_button() == 1){
            this.activate(event);
        }
        return true;
    },

    activate: function(event) {
        try{
            this.provider.on_result_selected(this.result);
            this.appsMenuButton.menu.close();
        }
        catch(e)
        {
            global.logError(e);
        }
    }
};

function PlaceButton(appsMenuButton, place, button_name, showIcon, showAppsDescription) {
    this._init(appsMenuButton, place, button_name, showIcon, showAppsDescription);
}

PlaceButton.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    _init: function(appsMenuButton, place, button_name, showIcon, showAppsDescription) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {hover: false});
        this.appsMenuButton = appsMenuButton;
        this.place = place;
        this.button_name = button_name;
        this.actor.set_style_class_name('menu-application-button');
        this.actor._delegate = this;
        this.label = new St.Label({ text: this.button_name, style_class: 'menu-application-button-label' });
        this.label.clutter_text.ellipsize = Pango.EllipsizeMode.END;
        this.label.set_style(MAX_BUTTON_WIDTH);

        let selectedAppId = place.idDecoded;
        selectedAppId = selectedAppId.substr(selectedAppId.indexOf(':') + 1);
        let fileIndex = selectedAppId.indexOf('file:///');
        if (fileIndex !== -1)
            selectedAppId = selectedAppId.substr(fileIndex + 7);
        this.description = selectedAppId;

        if (showAppsDescription) {
            this.label.get_clutter_text().set_markup(this.button_name + '\n' + '<span size="small">' + this.description + '</span>');
        }

        if (showIcon) {
            this.icon = place.iconFactory(APPLICATION_ICON_SIZE);
            if (!this.icon)
                this.icon = new St.Icon({icon_name: "folder", icon_size: APPLICATION_ICON_SIZE, icon_type: St.IconType.FULLCOLOR});
            if (this.icon)
                this.addActor(this.icon);
        }
        this.addActor(this.label);
        if (showIcon)
            this.icon.realize();
        this.label.realize();

        let tooltipString = "";
        this.tooltip = new TooltipCustom(this.actor, tooltipString, true);
    },

    _onButtonReleaseEvent: function (actor, event) {
        if (event.get_button()==1){
            this.place.launch();
            this.appsMenuButton.menu.close();
        }
    },

    activate: function(event) {
        this.place.launch();
        this.appsMenuButton.menu.close();
    }
};

function RecentContextMenuItem(recentButton, label, is_default, callback) {
    this._init(recentButton, label, is_default, callback);
}

RecentContextMenuItem.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    _init: function (recentButton, label, is_default, callback) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {focusOnHover: false});

        this._recentButton = recentButton;
        this._callback = callback;
        this.label = new St.Label({ text: label });
        this.addActor(this.label);

        if (is_default)
            this.label.style = "font-weight: bold;";
    },

    activate: function (event) {
        this._callback();
        return false;
    }
};

function RecentButton(appsMenuButton, file, showIcon, showAppsDescription) {
    this._init(appsMenuButton, file, showIcon, showAppsDescription);
}

RecentButton.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    _init: function(appsMenuButton, file, showIcon, showAppsDescription) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {hover: false});
        this.mimeType = file.mimeType;
        this.uri = file.uri;

        this.appsMenuButton = appsMenuButton;
        this.button_name = file.name;

        this.menu = null;

        this.actor.set_style_class_name('menu-application-button');
        this.actor._delegate = this;
        this.label = new St.Label({ text: this.button_name, style_class: 'menu-application-button-label' });
        this.label.clutter_text.ellipsize = Pango.EllipsizeMode.END;
        this.label.set_style(MAX_BUTTON_WIDTH);

        let selectedAppUri = file.uriDecoded;
        let fileIndex = selectedAppUri.indexOf("file:///");
        if (fileIndex !== -1)
            selectedAppUri = selectedAppUri.substr(fileIndex + 7);
        this.description = selectedAppUri;

        if (showAppsDescription) {
            this.label.get_clutter_text().set_markup(this.button_name + '\n' + '<span size="small">' + this.description + '</span>');
        }

        if (showIcon) {
            this.icon = file.createIcon(APPLICATION_ICON_SIZE);
            this.addActor(this.icon);
        }
        this.addActor(this.label);
        if (showIcon)
            this.icon.realize();
        this.label.realize();

        let tooltipString = "";
        this.tooltip = new TooltipCustom(this.actor, tooltipString, false);
    },

    _onButtonReleaseEvent: function (actor, event) {
        if (event.get_button()==1){
            this.activate(event);
        }
        if (event.get_button()==3){
            this.activateContextMenus(event);
        }
        return true;
    },

    activate: function(event) {
        try {
            Gio.app_info_launch_default_for_uri(this.uri, global.create_app_launch_context());
            this.appsMenuButton.menu.close();
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
    },

    activateContextMenus: function(event) {
        let menu = this.appsMenuButton.recentContextMenu;

        if (menu != null && menu.sourceActor._delegate != this)
            this.appsMenuButton.closeContextMenus(this, true);

        this.toggleMenu();
    },

    closeMenu: function() {
        this.menu = null;
        this.menu.close();
    },

    hasLocalPath: function(file) {
        return file.is_native() || file.get_path() != null;
    },

    toggleMenu: function() {
        if (this.appsMenuButton.recentContextMenu == null) {
            this.appsMenuButton.createRecentContextMenu(this.actor);
        }

        let menu = this.appsMenuButton.recentContextMenu;
        this.menu = menu;

        if (!menu.isOpen) {
            let parent = menu.actor.get_parent();
            if (parent != null) {
                parent.remove_child(menu.actor);
            }

            menu.sourceActor = this.actor;
            this.actor.get_parent().insert_child_above(menu.actor, this.actor);

            let children = menu.box.get_children();
            for (var i in children) {
                menu.box.remove_actor(children[i]);
            }

            let menuItem;

            menuItem = new PopupMenu.PopupMenuItem(_("Open with"), { reactive: false });
            menuItem.actor.style = "font-weight: bold";
            menu.addMenuItem(menuItem);

            let file = Gio.File.new_for_uri(this.uri);

            let default_info = Gio.AppInfo.get_default_for_type(this.mimeType, !this.hasLocalPath(file));

            if (default_info) {
                menuItem = new RecentContextMenuItem(this,
                                                     default_info.get_display_name(),
                                                     false,
                                                     Lang.bind(this, function() {
                                                         default_info.launch([file], null, null);
                                                         this.toggleMenu();
                                                         this.appsMenuButton.menu.close();
                                                     }));
                menu.addMenuItem(menuItem);
            }

            let infos = Gio.AppInfo.get_all_for_type(this.mimeType);

            for (let i = 0; i < infos.length; i++) {
                let info = infos[i];

                file = Gio.File.new_for_uri(this.uri);

                if (!this.hasLocalPath(file) && !info.supports_uris())
                    continue;

                if (info.equal(default_info))
                    continue;

                menuItem = new RecentContextMenuItem(this,
                                                     info.get_display_name(),
                                                     false,
                                                     Lang.bind(this, function() {
                                                         info.launch([file], null, null);
                                                         this.toggleMenu();
                                                         this.appsMenuButton.menu.close();
                                                     }));
                menu.addMenuItem(menuItem);
            }

            if (GLib.find_program_in_path ("nemo-open-with") != null) {
                menuItem = new RecentContextMenuItem(this,
                                                     _("Other application..."),
                                                     false,
                                                     Lang.bind(this, function() {
                                                         Util.spawnCommandLine("nemo-open-with " + this.uri);
                                                         this.toggleMenu();
                                                         this.appsMenuButton.menu.close();
                                                     }));
                menu.addMenuItem(menuItem);
            }
        }
        this.appsMenuButton.recentContextMenu.toggle();
    },

    get _contextIsOpen() {
        return this.menu != null && this.menu.isOpen;
    },

    destroy: function() {
        this.file = null;
        this.appsMenuButton = null;
        this.label.destroy();
        if (this.icon)
            this.icon.destroy();

        PopupMenu.PopupBaseMenuItem.prototype.destroy.call(this);
    },
};

function NoRecentDocsButton(label, icon, reactive, callback) {
    this._init(label, icon, reactive, callback);
}

NoRecentDocsButton.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    _init: function(label, icon, reactive, callback) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {hover: false});
        this.actor.set_style_class_name('menu-application-button');
        this.actor._delegate = this;
        this.button_name = "";

        this.label = new St.Label({ text: label, style_class: 'menu-application-button-label' });
        this.label.clutter_text.ellipsize = Pango.EllipsizeMode.END;
        this.label.set_style(MAX_BUTTON_WIDTH);

        if (icon != null) {
            let icon_actor = new St.Icon({ icon_name: icon, icon_type: St.IconType.FULLCOLOR, icon_size: APPLICATION_ICON_SIZE});
            this.addActor(icon_actor);
        }

        this.addActor(this.label);
        this.label.realize();

        this.actor.reactive = reactive;
        this.callback = callback;
    },

    _onButtonReleaseEvent: function (actor, event) {
        if (event.get_button() == 1) {
            this.callback();
        }
    }
};

function RecentClearButton(appsMenuButton) {
    this._init(appsMenuButton);
}

RecentClearButton.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    _init: function(appsMenuButton) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {hover: false});
        this.appsMenuButton = appsMenuButton;
        this.actor.set_style_class_name('menu-application-button');
        this.button_name = _("Clear list");
        this.actor._delegate = this;
        this.label = new St.Label({ text: this.button_name, style_class: 'menu-application-button-label' });
        this.icon = new St.Icon({ icon_name: 'edit-clear', icon_type: St.IconType.SYMBOLIC, icon_size: APPLICATION_ICON_SIZE });
        this.addActor(this.icon);
        this.addActor(this.label);
    },

    _onButtonReleaseEvent: function (actor, event) {
        if (event.get_button()==1){
            this.activate(event);
        }
    },

    activate: function(event) {
        this.appsMenuButton.menu.close();
        let GtkRecent = new Gtk.RecentManager();
        GtkRecent.purge_items();
    }
};

function CategoryButton(app, showIcon) {
    this._init(app, showIcon);
}

CategoryButton.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    _init: function(category, showIcon) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {hover: false});

        this.actor.set_style_class_name('menu-category-button');
        var label;
        let icon = null;
        if (category) {
            if (showIcon) {
                icon = category.get_icon();
                if (icon && icon.get_names)
                    this.icon_name = icon.get_names().toString();
                else
                    this.icon_name = "";
            } else {
                this.icon_name = "";
            }
            label = category.get_name();
        } else
            label = _("All Applications");

        this.actor._delegate = this;
        this.label = new St.Label({ text: label, style_class: 'menu-category-button-label' });
        if (category && this.icon_name) {
            this.icon = new St.Icon({gicon: icon, icon_size: CATEGORY_ICON_SIZE, icon_type: St.IconType.FULLCOLOR});

            if (this.icon) {
                this.addActor(this.icon);
                this.icon.realize();
            }
        }
        this.actor.accessible_role = Atk.Role.LIST_ITEM;
        this.addActor(this.label);
        this.label.realize();
    }
};

function PlaceCategoryButton(app, showIcon) {
    this._init(app, showIcon);
}

PlaceCategoryButton.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    _init: function(category, showIcon) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {hover: false});
        this.actor.set_style_class_name('menu-category-button');
        this.actor._delegate = this;
        this.label = new St.Label({ text: _("Places"), style_class: 'menu-category-button-label' });
        if (showIcon) {
            this.icon = new St.Icon({icon_name: "folder", icon_size: CATEGORY_ICON_SIZE, icon_type: St.IconType.FULLCOLOR});
            this.addActor(this.icon);
            this.icon.realize();
        } else {
            this.icon = null;
        }
        this.addActor(this.label);
        this.label.realize();
    }
};

function RecentCategoryButton(app, showIcon) {
    this._init(app, showIcon);
}

RecentCategoryButton.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    _init: function(category, showIcon) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {hover: false});
        this.actor.set_style_class_name('menu-category-button');
        this.actor._delegate = this;
        this.label = new St.Label({ text: _("Recent Files"), style_class: 'menu-category-button-label' });
        if (showIcon) {
            this.icon = new St.Icon({icon_name: "folder-recent", icon_size: CATEGORY_ICON_SIZE, icon_type: St.IconType.FULLCOLOR});
            this.addActor(this.icon);
            this.icon.realize();
        } else {
            this.icon = null;
        }
        this.addActor(this.label);
        this.label.realize();
    }
};

function FavoritesButton(appsMenuButton, app, nbFavorites, iconSize, showIcon, showContextIcon) {
    this._init(appsMenuButton, app, nbFavorites, iconSize, showIcon, showContextIcon);
}

FavoritesButton.prototype = {
    __proto__: GenericApplicationButton.prototype,

    _init: function(appsMenuButton, app, nbFavorites, iconSize, showIcon, showContextIcon) {
        GenericApplicationButton.prototype._init.call(this, appsMenuButton, app, true);
        let monitorHeight = Main.layoutManager.primaryMonitor.height;
        let real_size = (0.7 * monitorHeight) / nbFavorites;
        let icon_size = iconSize; //0.6*real_size;
        if (icon_size > MAX_FAV_ICON_SIZE)
            icon_size = MAX_FAV_ICON_SIZE;

        this.actor.add_style_class_name('menu-favorites-button');

        if (showIcon) {
            let icon = app.create_icon_texture(icon_size);
            this.addActor(icon);
            icon.realize();
        }

        this.label = new St.Label({ text: this.app.get_name(), style_class: 'menu-application-button-label' });
        this.addActor(this.label);

        this._draggable = DND.makeDraggable(this.actor);
        this._draggable.connect('drag-end', Lang.bind(this, this._onDragEnd));
        this.isDraggableApp = true;

        this.showContextIcon = showContextIcon;

        let tooltipString = this.app.get_description() + "";
        this.tooltip = new TooltipCustom(this.actor, tooltipString, true);
    },

    _onDragEnd: function() {
        this.actor.get_parent()._delegate._clearDragPlaceholder();
    },

    get_app_id: function() {
        return this.app.get_id();
    },

    getDragActor: function() {
        return new Clutter.Clone({ source: this.actor });
    },

    // Returns the original actor that should align with the actor
    // we show as the item is being dragged.
    getDragActorSource: function() {
        return this.actor;
    }
};

function AppPopupSubMenuMenuItem() {
    this._init.apply(this, arguments);
}

AppPopupSubMenuMenuItem.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    _init: function(text) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this);

        this.actor.add_style_class_name('popup-submenu-menu-item');

        this.label = new St.Label({
            text: text
        });
        this.actor.label_actor = this.label;

        this.menu = new PopupMenu.PopupSubMenu(this.actor, null);
        this.menu.connect('open-state-changed', Lang.bind(this, this._subMenuOpenStateChanged));
    },

    _subMenuOpenStateChanged: function(menu, open) {
        this.actor.change_style_pseudo_class('open', open);
    },

    destroy: function() {
        this.menu.destroy();
        PopupMenu.PopupBaseMenuItem.prototype.destroy.call(this);
    },

    activate: function(event) {
        this.menu.open(true);
    },

    _onButtonReleaseEvent: function(actor) {
        this.menu.toggle();
    }
};

function TextBoxItem(label, description, icon, func, parent, hoverIcon, addStyleClassName) {
    this._init(label, description, icon, func, parent, hoverIcon, addStyleClassName);
}

TextBoxItem.prototype = {
    __proto__: AppPopupSubMenuMenuItem.prototype,

    _init: function(label, description, icon, func, parent, hoverIcon, addStyleClassName) {
        this.parent = parent;
        this.hoverIcon = hoverIcon;
        this.icon = icon;
        this.func = func;
        this.active = false;
        AppPopupSubMenuMenuItem.prototype._init.call(this, label);

        this.addStyleClassName = addStyleClassName;

        this.actor.set_style_class_name('menu-category-button');
        this.actor.add_style_class_name('menu-text-item-button');
        this.actor.add_style_class_name('starkmenu-' + this.addStyleClassName + '-button');
        this.actor.connect('leave-event', Lang.bind(this, this._onLeaveEvent));
        //this.removeActor(this.label);
        this.label.destroy();
        this.label_text = label;

        if(this.label_text == "") {
            this.label_text = "  ";
            this.leftLabel = new St.Label({ text: this.label_text, style_class: 'menu-category-button-label' });
            this.leftLabel.add_style_class_name('starkmenu-' + this.addStyleClassName + '-button-label');
            this.addActor(this.leftLabel);
            this.actor.style = "padding-top: 4px; padding-bottom: 4px;";
        }

        this.label_icon = new St.Icon({
            icon_name: this.icon,
            icon_size: 18,
            icon_type: St.IconType.FULLCOLOR,
        });

        this.label = new St.Label({ text: this.label_text, style_class: 'menu-category-button-label' });
        this.label.add_style_class_name('starkmenu-' + this.addStyleClassName + '-button-label');

        this.addActor(this.label_icon);
        this.labelIconAdded = true;
        this.addActor(this.label);
        this.labelAdded = true;

        this.description = description;
        if (this.description != "No tooltip")
            this.tooltip = new TooltipCustom(this.actor, this.description, true);
    },

    _update: function(quicklauncherLayout, shutdownMenuLayout) {

        if (this.labelAdded) {
            this.removeActor(this.label);
            this.labelAdded = false;
        }
        if (this.labelIconAdded) {
            this.removeActor(this.label_icon);
            this.labelIconAdded = false;
        }

        if (quicklauncherLayout == 'both' || quicklauncherLayout == 'icons' || shutdownMenuLayout == "horizontal") {

            let iconSize = 18;
            if(quicklauncherLayout == 'icons')
                iconSize = 26;
            else if(shutdownMenuLayout == "horizontal")
                iconSize = 22;
            else
                iconSize = 18;

            this.name_icon = new St.Icon({
                icon_name: this.icon,
                icon_size: iconSize,
                icon_type: St.IconType.FULLCOLOR,
            });

            let iconFileName = this.icon;
            let iconFile = Gio.file_new_for_path(iconFileName);
            let icon;

            if (iconFile.query_exists(null)) {
                icon = new Gio.FileIcon({
                    file: iconFile
                });
            } else {
                icon = new Gio.ThemedIcon({
                    name: this.icon
                });
            }

            this.label_icon.set_gicon(icon);
            this.label_icon.set_icon_size(iconSize);

            if (!iconFile.query_exists(null)) {
                this.label_icon = this.name_icon;

            }

            this.addActor(this.label_icon);
            this.labelIconAdded = true;
        }

        if (quicklauncherLayout == 'both' || quicklauncherLayout == 'labels') {
            this.label = new St.Label({ text: this.label_text, style_class: 'menu-category-button-label' });
            this.label.add_style_class_name('starkmenu-' + this.addStyleClassName + '-button-label');
            this.addActor(this.label);
            this.labelAdded = true;
        }
    },

    _onLeaveEvent: function() {
        this.hoverIcon.showUser = true;
        Tweener.addTween(this, {
            time: 1,
            onComplete: function() {
                if (!this.active) {
                    this.hoverIcon._onUserChanged();
                }
            }
        });
    },

    setActive: function(active) {
        if (active) {
            this.hoverIcon.showUser = false;
            this.actor.set_style_class_name('menu-category-button-selected');
            this.actor.add_style_class_name('starkmenu-' + this.addStyleClassName + '-button-selected');
            if (this.parent.quicklauncherLayout != 'icons') {
                this.hoverIcon._refresh(this.icon);
            }
        } else {
            this.actor.set_style_class_name('menu-category-button');
            this.actor.add_style_class_name('starkmenu-' + this.addStyleClassName + '-button');
        }
    },

    _onButtonReleaseEvent: function(actor, event) {
        if (event.get_button() == 1) {
            this.activate(event);
        }
    },

    activate: function(event) {
        eval(this.func);
        this.parent.close();
    }
};

function AllProgramsItem(label, icon, parent) {
    this._init(label, icon, parent);
}

AllProgramsItem.prototype = {
    __proto__: AppPopupSubMenuMenuItem.prototype,

    _init: function(label, icon, parent) {
        AppPopupSubMenuMenuItem.prototype._init.call(this, label);

        this.actor.set_style_class_name('');
        this.box = new St.BoxLayout({
            style_class: 'menu-category-button'
        });
        this.parent = parent;
        this.label.destroy();
        this.label = new St.Label({ text: label, style: "padding-left: 20px" });
        this.icon = new St.Icon({
            style_class: 'popup-menu-icon',
            icon_type: St.IconType.SYMBOLIC,
            icon_name: icon,
            icon_size: ICON_SIZE
        });
        this.box.add_actor(this.icon);
        this.box.add_actor(this.label);
        this.addActor(this.box);
    },

    setActive: function(active) {
        if (active)
            this.box.set_style_class_name('menu-category-button-selected');
        else
            this.box.set_style_class_name('menu-category-button');
    },

    _onButtonReleaseEvent: function(actor, event) {
        if (event.get_button() == 1) {
            this.activate(event);
        }
    },

    activate: function(event) {
        if (this.parent.leftPane.get_child() == this.parent.favsBox) this.parent.switchPanes("apps");
        else this.parent.switchPanes("favs");
    }
};

function ResultsFoundItem(label, icon, parent) {
    this._init(label, icon, parent);
}

ResultsFoundItem.prototype = {
    __proto__: AppPopupSubMenuMenuItem.prototype,

    _init: function(label, icon, parent) {
        AppPopupSubMenuMenuItem.prototype._init.call(this, label);

        this.actor.set_style_class_name('');
        this.box = new St.BoxLayout({
            style_class: 'menu-category-button'
        });
        this.parent = parent;
        this.label.destroy();
        this.label = new St.Label({ text: label, style: "padding-left: 5px" });
        this.icon = new St.Icon({
            style_class: 'popup-menu-icon',
            icon_type: St.IconType.SYMBOLIC,
            icon_name: icon,
            icon_size: ICON_SIZE
        });
        this.box.add_actor(this.icon);
        this.box.add_actor(this.label);
        this.addActor(this.box);
    },

    setActive: function(active) {
        if (active)
            this.box.set_style_class_name('menu-category-button-selected');
        else
            this.box.set_style_class_name('menu-category-button');
    },

    _onButtonReleaseEvent: function(actor, event) {
    }
};

function HoverIcon(parent) {
    this._init(parent);
}

HoverIcon.prototype = {
    _init: function(parent) {
        this.actor = new St.Bin();
        this.icon = new St.Icon({
            icon_size: HOVER_ICON_SIZE,
            icon_type: St.IconType.FULLCOLOR,
            style_class: 'hover-icon'
        });
        this.actor.cild = this.icon;

        this.showUser = true;

        this.userBox = new St.BoxLayout({
            style_class: 'hover-box',
            reactive: true,
            vertical: false
        });
        this.userBox.add_style_class_name("starkhover-box");

        this.userBox.set_x_align(Clutter.ActorAlign.CENTER);

        this._userIcon = new St.Icon({
            style_class: 'hover-user-icon'
        });

        this.userBox.connect('button-press-event', Lang.bind(this, function() {
            parent.toggle();
            Util.spawnCommandLine("cinnamon-settings user");
        }));

        this._userIcon.hide();
        this.userBox.add(this.icon, {
            x_fill: true,
            y_fill: false,
            x_align: St.Align.END,
            y_align: St.Align.START
        });
        this.userBox.add(this._userIcon, {
            x_fill: true,
            y_fill: false,
            x_align: St.Align.END,
            y_align: St.Align.START
        });

        this.userLabelColor = new St.BoxLayout(({
            style_class: 'menu-background'
        }));

        this.userLabel = new St.Label();
        this.userLabel.set_style("font-size: 16px;");
        this.userLabel.add_style_class_name("starkmenu-user-label");

        this.userBox.add(this.userLabel, {
            x_fill: true,
            y_fill: false,
            x_align: St.Align.END,
            y_align: St.Align.MIDDLE
        });

        var icon = new Gio.ThemedIcon({
            name: 'avatar-default'
        });
        this._userIcon.set_gicon(icon);
        this._userIcon.show();

        this._user = AccountsService.UserManager.get_default().get_user(GLib.get_user_name());
        this._userLoadedId = this._user.connect('notify::is_loaded', Lang.bind(this, this._onUserChanged));
        this._userChangedId = this._user.connect('changed', Lang.bind(this, this._onUserChanged));
        this._onUserChanged();

        //this._refresh('folder-home');
    },

    _onUserChanged: function() {
        if (this._user.is_loaded && this.showUser) {
            //this.set_applet_tooltip(this._user.get_real_name());
            this.userLabel.set_text(this._user.get_real_name()); // Cinnamon WARNING: Possible orphan label being accessed via st_label_set_text().
            if (this._userIcon) {
                let iconFileName = this._user.get_icon_file();
                let iconFile = Gio.file_new_for_path(iconFileName);
                let icon;
                if (iconFile.query_exists(null)) {
                    icon = new Gio.FileIcon({
                        file: iconFile
                    });
                } else {
                    icon = new Gio.ThemedIcon({
                        name: 'avatar-default'
                    });
                }
                this._userIcon.set_gicon(icon);
                this.icon.hide();
                this._userIcon.show();
            }
        }
    },

    _refresh: function(icon) {
        this._userIcon.hide();

        let iconFileName = icon;
        let iconFile = Gio.file_new_for_path(iconFileName);
        let newicon;

        if (iconFile.query_exists(null)) {
            newicon = new Gio.FileIcon({
                file: iconFile
            });
        } else {
            newicon = new Gio.ThemedIcon({
                name: icon
            });
        }

        if (iconFile.query_exists(null)) {
            this.icon.set_gicon(newicon);
        }
        else {
            this.icon.set_icon_name(icon);
        }

        this.icon.show();
    }
};

function ShutdownContextMenuItem(parentMenu, menu, label, action, hoverIcon) {
    this._init(parentMenu, menu, label, action, hoverIcon);
}

ShutdownContextMenuItem.prototype = {
    __proto__: ApplicationContextMenuItem.prototype,

    _init: function(parentMenu, menu, label, action, hoverIcon) {
        this.parentMenu = parentMenu;
        ApplicationContextMenuItem.prototype._init.call(this, menu, label, action, null, false);
        this._screenSaverProxy = new ScreenSaver.ScreenSaverProxy();
        this.hoverIcon = hoverIcon;

        this.actor.connect('enter-event', Lang.bind(this, this._onEnterEvent));
        this.actor.connect('leave-event', Lang.bind(this, this._onLeaveEvent));
    },

    activate: function(event) {
        switch (this._action) {
            case "logout": {
                Session.LogoutRemote(0);
                break;
            } case "lock": {
                let screensaver_settings = new Gio.Settings({
                    schema: "org.cinnamon.desktop.screensaver"
                });
                let screensaver_dialog = Gio.file_new_for_path("/usr/bin/cinnamon-screensaver-command");
                if (screensaver_dialog.query_exists(null)) {
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
                break;
            }
        }
        this._appButton.toggle();
        this.parentMenu.toggle();
        return false;
    },

    _onEnterEvent: function() {
        let icon;
        if (this._action == "logout")
            icon = "system-log-out";
        else
            icon = "system-lock-screen";
        this.hoverIcon.showUser = false;
        this.hoverIcon._refresh(icon);
    },

    _onLeaveEvent: function() {
        this.hoverIcon.showUser = true;
        Tweener.addTween(this, {
            time: 1,
            onComplete: function() {
                if (!this.active) {
                    this.hoverIcon._onUserChanged();
                }
            }
        });
    }

};

function ShutdownMenu(parent, hoverIcon) {
    this._init(parent, hoverIcon);
}

ShutdownMenu.prototype = {
    __proto__: AppPopupSubMenuMenuItem.prototype,

    _init: function(parent, hoverIcon) {
        let label = '';
        this.hoverIcon = hoverIcon;
        this.parent = parent;
        AppPopupSubMenuMenuItem.prototype._init.call(this, label);
        this.actor.set_style_class_name('menu-category-button');
        this.actor.add_style_class_name('starkmenu-arrow-dropdown-button');
        //this.removeActor(this.label);
        this.label.destroy();
        this.icon = new St.Icon({
            style_class: 'popup-menu-icon',
            icon_type: St.IconType.FULLCOLOR,
            icon_name: 'forward',
            icon_size: ICON_SIZE
        });
        this.addActor(this.icon);

        this.actor.connect('leave-event', Lang.bind(this, this._onLeaveEvent));

        this.menu = new PopupMenu.PopupSubMenu(this.actor);
        this.menu.actor.remove_style_class_name("popup-sub-menu");

        let menuItem;
        menuItem = new ShutdownContextMenuItem(this.parent, this.menu, _("Logout"), "logout", this.hoverIcon);
        this.menu.addMenuItem(menuItem);
        menuItem = new ShutdownContextMenuItem(this.parent, this.menu, _("Lock Screen"), "lock", this.hoverIcon);
        this.menu.addMenuItem(menuItem);

    },

    _onLeaveEvent: function() {
        this.hoverIcon.showUser = true;
        Tweener.addTween(this, {
            time: 1,
            onComplete: function() {
                if (!this.active) {
                    this.hoverIcon._onUserChanged();
                }
            }
        });
    },

    setActive: function(active) {
        if (active) {
            this.hoverIcon.showUser = false;
            this.actor.set_style_class_name('menu-category-button-selected');
            this.actor.add_style_class_name('starkmenu-arrow-dropdown-button-selected');
            this.hoverIcon._refresh('forward');
        } else {
            this.actor.set_style_class_name('menu-category-button');
            this.actor.add_style_class_name('starkmenu-arrow-dropdown-button');
        }
    },

    _onButtonReleaseEvent: function(actor, event) {
        if (event.get_button() == 1) {
            this.menu.toggle();
        }

    }
};

function CategoriesApplicationsBox() {
    this._init();
}

CategoriesApplicationsBox.prototype = {
    _init: function() {
        this.actor = new St.BoxLayout();
        this.actor._delegate = this;
    },

    acceptDrop : function(source, actor, x, y, time) {
        if (source instanceof FavoritesButton){
            source.actor.destroy();
            actor.destroy();
            AppFavorites.getAppFavorites().removeFavorite(source.app.get_id());
            return true;
        }
        return false;
    },

    handleDragOver : function(source, actor, x, y, time) {
        if (source instanceof FavoritesButton)
            return  global.set_cursor(Cinnamon.Cursor.POINTING_HAND);

        return DND.DragMotionResult.CONTINUE;
    }
};

function RightButtonsBox(appsMenuButton, menu) {
    this._init(appsMenuButton, menu);
}

RightButtonsBox.prototype = {
    _init: function(appsMenuButton, menu) {
        this.appsMenuButton = appsMenuButton;
        this.actor = new St.BoxLayout({ vertical: true });
        this.itemsBox = new St.BoxLayout({ vertical: true });

        this.actor._delegate = this;
        this.menu = menu;

        this.hoverIcon = new HoverIcon(this.menu);
        this.actor.add_actor(this.hoverIcon.userBox);
        this.actor.add_actor(this.itemsBox);
        this.addShutdownBoxes();
    },

    acceptDrop: function(source, actor, x, y, time) {
        if (source instanceof FavoritesButton) {
            source.actor.destroy();
            actor.destroy();
            AppFavorites.getAppFavorites().removeFavorite(source.app.get_id());
            return true;
        }
        return false;
    },

    _update_quicklinks: function(quicklauncherLayout, userBoxLayout, shutdownMenuLayout) {

        for (let i in this.quicklinks) {
            this.quicklinks[i]._update(quicklauncherLayout);
        }

        this.shutdown._update(quicklauncherLayout, shutdownMenuLayout);
        this.shutdown2._update(quicklauncherLayout, shutdownMenuLayout);
        this.shutdown3._update(quicklauncherLayout, shutdownMenuLayout);
        this.logout._update(quicklauncherLayout, shutdownMenuLayout);
        this.logout2._update(quicklauncherLayout, shutdownMenuLayout);
        this.lock._update(quicklauncherLayout, shutdownMenuLayout);
        this.lock2._update(quicklauncherLayout, shutdownMenuLayout);

        switch (userBoxLayout) {
            case "userHide":
                this.hoverIcon.userBox.hide();
                break;
            case "userNameAndIcon":
                this.hoverIcon.userBox.show();
                this.hoverIcon.userLabel.show();
                break;
            case "userIcon":
                this.hoverIcon.userBox.show();
                this.hoverIcon.userLabel.hide();
                break;
        }

        if (quicklauncherLayout == 'icons') {
            this.hoverIcon.userLabel.hide();
            this.hoverIcon._userIcon.set_icon_size(22);
            this.hoverIcon.icon.set_icon_size(22);
            this.shutDownMenuBox.set_style('min-height: 1px');
            this.shutdownMenu.actor.hide();

        }
        else {
            this.hoverIcon._userIcon.set_icon_size(HOVER_ICON_SIZE);
            this.hoverIcon.icon.set_icon_size(HOVER_ICON_SIZE);
            this.shutDownIconBox.hide();
            this.shutdownMenu.actor.show();
            this.shutDownMenuBox.set_style('min-height: 80px');
        }
    },

    addItems: function() {
        this.itemsBox.destroy_all_children();

        this.quicklinks = [];
        for (let i in this.menu.quicklinks) {
            if (this.menu.quicklinks[i] != ',Dr Who,' && this.menu.quicklinks[i] != ',,') {
                let split = this.menu.quicklinks[i].split(',');
                if (split[0] == 'separator') {
                    let separator = new PopupMenu.PopupSeparatorMenuItem();
                    this.itemsBox.add_actor(separator.actor);
                }
                else {
                    let split = this.menu.quicklinks[i].split(',');
                    if (split.length == 3) {
                        this.quicklinks[i] = new TextBoxItem(_(split[0]), "No tooltip", _(split[1]), "Util.spawnCommandLine('" + _(split[2]) + "')", this.menu, this.hoverIcon, 'quicklink');
                        this.itemsBox.add_actor(this.quicklinks[i].actor);
                    }
                }
            }
        }
    },

    addShutdownBoxes: function() {
        this.shutDownMenuBox = new St.BoxLayout({ style_class: 'hover-box', vertical: true });
        this.shutDownMenuBox.add_style_class_name("starkhover-box");

        this.shutDownIconBox = new St.BoxLayout({ vertical: true });
        this.shutDownIconBoxXP = new St.BoxLayout({ vertical: false });
        this.shutdownBox = new St.BoxLayout({ vertical: false });


        this.actor.add(new St.Bin(), { expand: true });

        this.actor.add_actor(this.shutDownMenuBox);
        this.actor.add_actor(this.shutDownIconBox);
        this.actor.add_actor(this.shutDownIconBoxXP);

        let shutdownDescription = _("Shutdown the computer");
        let logoutDescription = _("Leave the session");
        let lockDescription = _("Lock the screen");

        this.shutdown = new TextBoxItem(_("Quit"), shutdownDescription, "system-shutdown", "Session.ShutdownRemote()", this.menu, this.hoverIcon, 'quit-dropdown');
        this.shutdown2 = new TextBoxItem(_("Quit"), shutdownDescription, "system-shutdown", "Session.ShutdownRemote()", this.menu, this.hoverIcon, 'quit-vertical');
        this.shutdown3 = new TextBoxItem("", shutdownDescription, "system-shutdown", "Session.ShutdownRemote()", this.menu, this.hoverIcon, 'quit-horizontal');
        this.logout = new TextBoxItem(_("Logout"), logoutDescription, "system-log-out", "Session.LogoutRemote(0)", this.menu, this.hoverIcon, 'logout-vertical');
        this.logout2 = new TextBoxItem("", logoutDescription, "system-log-out", "Session.LogoutRemote(0)", this.menu, this.hoverIcon, 'logout-horizontal');

        let screensaver_settings = new Gio.Settings({
            schema: "org.cinnamon.desktop.screensaver"
        });
        let screensaver_dialog = Gio.file_new_for_path("/usr/bin/cinnamon-screensaver-command");
        if (screensaver_dialog.query_exists(null)) {
            if (screensaver_settings.get_boolean("ask-for-away-message")) {
                this.lock = new TextBoxItem(_("Lock screen"), lockDescription, "system-lock-screen", "Util.spawnCommandLine('cinnamon-screensaver-lock-dialog')", this.menu, this.hoverIcon, 'lockscreen-vertical');
                this.lock2 = new TextBoxItem("", lockDescription, "system-lock-screen", "Util.spawnCommandLine('cinnamon-screensaver-lock-dialog')", this.menu, this.hoverIcon, 'lockscreen-horizontal');
            }
            else {
                this.lock = new TextBoxItem(_("Lock screen"), lockDescription, "system-lock-screen", "Util.spawnCommandLine('cinnamon-screensaver-command --lock')", this.menu, this.hoverIcon, 'lockscreen-vertical');
                this.lock2 = new TextBoxItem("", lockDescription, "system-lock-screen", "Util.spawnCommandLine('cinnamon-screensaver-command --lock')", this.menu, this.hoverIcon, 'lockscreen-horizontal');
            }
        }

        this.shutdownMenu = new ShutdownMenu(this.menu, this.hoverIcon);

        this.shutdownBox.add_actor(this.shutdown.actor);
        this.shutdownBox.add_actor(this.shutdownMenu.actor);

        this.shutDownMenuBox.add(this.shutdownBox);
        this.shutDownMenuBox.add_actor(this.shutdownMenu.menu.actor);

        this.shutDownIconBox.add_actor(this.shutdown2.actor);
        this.shutDownIconBox.add_actor(this.logout.actor);
        this.shutDownIconBox.add_actor(this.lock.actor);

        this.shutDownIconBoxXP.add_actor(this.shutdown3.actor);
        this.shutDownIconBoxXP.add_actor(this.logout2.actor);
        this.shutDownIconBoxXP.add_actor(this.lock2.actor);
    },

    _getPreferredHeight: function(actor, forWidth, alloc) {
        let[minSize, naturalSize] = this.itemsBox.get_preferred_height(forWidth);
        alloc.min_size = minSize;
        alloc.natural_size = naturalSize;
    },

    _getPreferredWidth: function(actor, forHeight, alloc) {
        let[minSize, naturalSize] = this.itemsBox.get_preferred_width(forHeight);
        alloc.min_size = minSize;
        alloc.natural_size = naturalSize;
    },

    _allocate: function(actor, box, flags) {
        let childBox = new Clutter.ActorBox();

        let[minWidth, minHeight, naturalWidth, naturalHeight] = this.itemsBox.get_preferred_size();

        childBox.y1 = 0;
        childBox.y2 = childBox.y1 + naturalHeight;
        childBox.x1 = 0;
        childBox.x2 = childBox.x1 + naturalWidth;
        this.itemsBox.allocate(childBox, flags);

        let mainBoxHeight = this.appsMenuButton.mainBox.get_height();

        // [minWidth, minHeight, naturalWidth, naturalHeight] = this.shutDownItemsBox.get_preferred_size();
        // childBox.y1 = mainBoxHeight - 110;
        // childBox.y2 = childBox.y1;
        // childBox.x1 = 0;
        // childBox.x2 = childBox.x1 + naturalWidth;
        // this.shutDownItemsBox.allocate(childBox, flags);
    }
};

function FavoritesBox() {
    this._init();
}

FavoritesBox.prototype = {
    _init: function() {
        this.actor = new St.BoxLayout({ vertical: true });
        this.actor._delegate = this;

        this._dragPlaceholder = null;
        this._dragPlaceholderPos = -1;
        this._animatingPlaceholdersCount = 0;
    },

    _clearDragPlaceholder: function() {
        if (this._dragPlaceholder) {
            this._dragPlaceholder.animateOutAndDestroy();
            this._dragPlaceholder = null;
            this._dragPlaceholderPos = -1;
        }
    },

    handleDragOver : function(source, actor, x, y, time) {
        let app = source.app;

        /*let favorites = AppFavorites.getAppFavorites().getFavorites();
        let numFavorites = favorites.length;
        let favPos = favorites.indexOf(app);*/

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

        if (pos != this._dragPlaceholderPos && pos <= numChildren) {
            if (this._animatingPlaceholdersCount > 0) {
                let appChildren = children.filter(function(actor) {
                    return (actor._delegate instanceof FavoritesButton);
                });
                this._dragPlaceholderPos = children.indexOf(appChildren[pos]);
            } else {
                this._dragPlaceholderPos = pos;
            }

            /* // Don't allow positioning before or after self
            if (favPos != -1 && (pos == favPos || pos == favPos + 1)) {
                if (this._dragPlaceholder) {
                    this._dragPlaceholder.animateOutAndDestroy();
                    this._animatingPlaceholdersCount++;
                    this._dragPlaceholder.actor.connect('destroy',
                        Lang.bind(this, function() {
                            this._animatingPlaceholdersCount--;
                        }));
                }
                this._dragPlaceholder = null;

                return DND.DragMotionResult.CONTINUE;
            } */

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
    },

    // Draggable target interface
    acceptDrop : function(source, actor, x, y, time) {
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

        Meta.later_add(Meta.LaterType.BEFORE_REDRAW, Lang.bind(this,
            function () {
                let appFavorites = AppFavorites.getAppFavorites();
                if (srcIsFavorite)
                    appFavorites.moveFavoriteToPos(id, favPos);
                else
                    appFavorites.addFavoriteAtPos(id, favPos);
                return false;
            }));

        return true;
    }
};

const Gettext = imports.gettext;
const UUID = "CinnVIIStarkMenu@NikoKrause";
Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");

function _(str) {
    let customTranslation = Gettext.dgettext(UUID, str);
    if(customTranslation != str) {
        return customTranslation;
    }
    return Gettext.gettext(str);
}

function MyApplet(orientation, panel_height, instance_id) {
    this._init(orientation, panel_height, instance_id);
}

MyApplet.prototype = {
    __proto__: Applet.TextIconApplet.prototype,

    _init: function(orientation, panel_height, instance_id) {
        Applet.TextIconApplet.prototype._init.call(this, orientation, panel_height, instance_id);

        this.setAllowedLayout(Applet.AllowedLayout.BOTH);

        this.initial_load_done = false;

        this.set_applet_tooltip(_("Menu"));
        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);
        this.orientation = orientation;

        this.actor.connect('key-press-event', Lang.bind(this, this._onSourceKeyPress));

        this.settings = new Settings.AppletSettings(this, "CinnVIIStarkMenu@NikoKrause", instance_id);

        this.settings.bind("show-places", "showPlaces", this._refreshBelowApps);

        this._appletEnterEventId = 0;
        this._appletLeaveEventId = 0;
        this._appletHoverDelayId = 0;

        this.settings.bind("hover-delay", "hover_delay_ms", this._updateActivateOnHover);
        this.settings.bind("activate-on-hover", "activateOnHover", this._updateActivateOnHover);
        this._updateActivateOnHover();

        this.menu.setCustomStyleClass('menu-background');
        this.menu.setCustomStyleClass("starkmenu-background");
        this.menu.connect('open-state-changed', Lang.bind(this, this._onOpenStateChanged));
        this.settings.bind("menu-layout", "menuLayout", this._updateMenuLayout);

        this.settings.bind("menu-icon-custom", "menuIconCustom", this._updateIconAndLabel);
        this.settings.bind("menu-icon", "menuIcon", this._updateIconAndLabel);
        this.settings.bind("menu-label", "menuLabel", this._updateIconAndLabel);
        this.settings.bind("overlay-key", "overlayKey", this._updateKeybinding);
        this.settings.bind("show-category-icons", "showCategoryIcons", this._refreshAll);
        this.settings.bind("show-application-icons", "showApplicationIcons", this._refreshAll);
        this.settings.bind("show-context-menu-icons", "showContextMenuIcons", this._refreshAll);
        this.settings.bind("show-favorite-icons", "showFavoriteIcons", this._refreshFavs);
        this.settings.bind("show-apps-description-on-buttons", "showAppsDescriptionOnButtons", this._refreshAll);

        this.settings.bind("enable-animation", "enableAnimation", null);

        this._updateKeybinding();

        this.settings.bind("all-programs-label", "allProgramsLabel", this._updateCustomLabels);
        this.settings.bind("favorites-label", "favoritesLabel", this._updateCustomLabels);
        this.settings.bind("shutdown-label", "shutdownLabel", this._updateCustomLabels);

        Main.themeManager.connect("theme-set", Lang.bind(this, this._updateIconAndLabel));
        this._updateIconAndLabel();

        this._searchInactiveIcon = new St.Icon({ style_class: 'menu-search-entry-icon',
            icon_name: 'edit-find',
            icon_type: St.IconType.SYMBOLIC });
        this._searchActiveIcon = new St.Icon({ style_class: 'menu-search-entry-icon',
            icon_name: 'edit-clear',
            icon_type: St.IconType.SYMBOLIC });
        this._searchIconClickedId = 0;
        this._applicationsButtons = [];
        this._applicationsButtonFromApp = {};
        this._favoritesButtons = [];
        this._placesButtons = [];
        this._transientButtons = [];
        this.recentButton = null;
        this._recentButtons = [];
        this._categoryButtons = [];
        this._searchProviderButtons = [];
        this._selectedItemIndex = null;
        this._previousSelectedActor = null;
        this._previousVisibleIndex = null;
        this._previousTreeSelectedActor = null;
        this._activeContainer = null;
        this._activeActor = null;
        this.menuIsOpening = false;
        this._knownApps = []; // Used to keep track of apps that are already installed, so we can highlight newly installed ones
        this._appsWereRefreshed = false;
        this._canUninstallApps = GLib.file_test("/usr/bin/cinnamon-remove-application", GLib.FileTest.EXISTS);
        this._isBumblebeeInstalled = GLib.file_test("/usr/bin/optirun", GLib.FileTest.EXISTS);
        this.RecentManager = DocInfo.getDocManager();
        this.privacy_settings = new Gio.Settings( {schema_id: PRIVACY_SCHEMA} );
        this.noRecentDocuments = true;
        this._activeContextMenuParent = null;
        this._activeContextMenuItem = null;
        this._display();
        this._updateMenuLayout();
        this._updateCustomLabels();
        this._appsBoxWidthResized = false;

        appsys.connect('installed-changed', Lang.bind(this, this.onAppSysChanged));
        AppFavorites.getAppFavorites().connect('changed', Lang.bind(this, this._refreshFavs));
        Main.placesManager.connect('places-updated', Lang.bind(this, this._refreshBelowApps));
        this.RecentManager.connect('changed', Lang.bind(this, this._refreshRecent));
        this.privacy_settings.connect("changed::" + REMEMBER_RECENT_KEY, Lang.bind(this, this._refreshRecent));

        this.settings.bind("show-sidebar", "showSidebar", this._updateQuickLinksView);
        this._updateQuickLinksView();

        this.settings.bind("show-shutdown-menu", "showShutdownMenu", this._updateQuickLinksShutdownView);
        this.settings.bind("shutdown-menu-layout", "shutdownMenuLayout", this._updateQuickLinks);

        this._fileFolderAccessActive = false;
        this._pathCompleter = new Gio.FilenameCompleter();
        this._pathCompleter.set_dirs_only(false);
        this.lastAcResults = [];
        this.settings.bind("search-filesystem", "searchFilesystem");
        this.refreshing = false; // used as a flag to know if we're currently refreshing (so we don't do it more than once concurrently)

        this.recentContextMenu = null;
        this.appsContextMenu = null;

        this.lastSelectedCategory = null;

        this.settings.bind("quicklauncher-places", "quicklauncher_places", this._updateQuickLinks);
        this.settings.bind("quicklauncher-apps", "quicklauncher_apps", this._updateQuickLinks);
        this.settings.bind("quicklauncher-separator1", "quicklauncher_separator1", this._updateQuickLinks);
        this.settings.bind("quicklauncher-separator2", "quicklauncher_separator2", this._updateQuickLinks);
        this.settings.bind("quicklauncher-separator3", "quicklauncher_separator3", this._updateQuickLinks);

        this.quicklinksupdated = false;
        this.settings.bind("quicklauncher-layout", "quicklauncherLayout", this._updateQuickLinks);
        this.settings.bind("user-box-layout", "userBoxLayout", this._updateQuickLinks);
        this._updateQuickLinksShutdownView();
        this._updateQuickLinks();

        // We shouldn't need to call refreshAll() here... since we get a "icon-theme-changed" signal when CSD starts.
        // The reason we do is in case the Cinnamon icon theme is the same as the one specificed in GTK itself (in .config)
        // In that particular case we get no signal at all.
        this._refreshAll();

        this.set_show_label_in_vertical_panels(false);
    },

    _updateKeybinding: function() {
        Main.keybindingManager.addHotKey("overlay-key-" + this.instance_id, this.overlayKey, Lang.bind(this, function() {
            if (!Main.overview.visible && !Main.expo.visible)
                this.menu.toggle_with_options(this.enableAnimation);
        }));
    },

    onAppSysChanged: function() {
        if (this.refreshing == false) {
            this.refreshing = true;
            Mainloop.timeout_add_seconds(1, Lang.bind(this, this._refreshAll));
        }
    },

    _refreshAll: function() {
        try {
            this._refreshApps();
            this._refreshFavs();
            this._refreshPlaces();
            this._refreshRecent();
        }
        catch (exception) {
            global.log(exception);
        }
        this.refreshing = false;
    },

    _refreshBelowApps: function() {
        this._refreshPlaces();
        this._refreshRecent();
    },

    openMenu: function() {
        if (!this._applet_context_menu.isOpen) {
            this.menu.open(this.enableAnimation);
        }
    },

    _clearDelayCallbacks: function() {
        if (this._appletHoverDelayId > 0) {
            Mainloop.source_remove(this._appletHoverDelayId);
            this._appletHoverDelayId = 0;
        }
        if (this._appletLeaveEventId > 0) {
            this.actor.disconnect(this._appletLeaveEventId);
            this._appletLeaveEventId = 0;
        }

        return false;
    },

    _updateActivateOnHover: function() {
        if (this._appletEnterEventId > 0) {
            this.actor.disconnect(this._appletEnterEventId);
            this._appletEnterEventId = 0;
        }

        this._clearDelayCallbacks();

        if (this.activateOnHover) {
            this._appletEnterEventId = this.actor.connect('enter-event', Lang.bind(this, function() {
                if (this.hover_delay_ms > 0) {
                    this._appletLeaveEventId = this.actor.connect('leave-event', Lang.bind(this, this._clearDelayCallbacks));
                    this._appletHoverDelayId = Mainloop.timeout_add(this.hover_delay_ms,
                        Lang.bind(this, function() {
                            this.openMenu();
                            this._clearDelayCallbacks();
                        }));
                } else {
                    this.openMenu();
                }
            }));
        }
    },

    _resizeAppsBoxHeight: function() {
        let scrollBoxHeight = this.favsBox.get_height() + this.separator.actor.get_height() + this.favExpandBin.get_height();
        this.applicationsScrollBox.set_height(scrollBoxHeight);
        this.categoriesScrollBox.set_height(scrollBoxHeight);
    },

    _resizeAppsBoxWidth: function() {
        let min_width = 0;
        let child = this.applicationsScrollBox.get_first_child();
        this.applicationsScrollBox.set_width(-1);

        while (child) {
            let [min, nat] = child.get_preferred_width(-1.0);
            min_width = Math.max(nat, min_width);
            child = child.get_next_sibling();
        }

        let theme_node = this.applicationsScrollBox.get_theme_node();
        let scrollWidth = this.applicationsScrollBox.get_vscroll_bar().get_width();
        let borders = theme_node.get_border_width(St.Side.LEFT) + theme_node.get_border_width(St.Side.RIGHT);
        this.applicationsScrollBox.set_width(min_width + scrollWidth + borders);
    },

    _updateQuickLinksView: function() {
        this.menu.showSidebar = this.showSidebar;
        if (this.menu.showSidebar) {
            this.rightButtonsBox.actor.show();
        }
        else {
            this.rightButtonsBox.actor.hide();
        }

        this.quicklinksupdated = true;
    },

    _updateQuickLinksShutdownView: function() {
        this.menu.showShutdownMenu = this.showShutdownMenu;
        this.menu.shutdownMenuLayout = this.shutdownMenuLayout;
        if (this.menu.showShutdownMenu) {
            if (this.quicklauncherLayout != 'icons') {
                if (this.shutdownMenuLayout == 'dropdown') {
                    this.rightButtonsBox.shutdown.actor.show();
                    this.rightButtonsBox.shutdownMenu.actor.show();
                    this.rightButtonsBox.shutDownIconBox.hide();
                    this.rightButtonsBox.shutDownIconBoxXP.hide();
                    this.rightButtonsBox.shutDownMenuBox.show();
                    this.rightButtonsBox.shutDownMenuBox.set_style('min-height: 80px');
                } else if (this.shutdownMenuLayout == 'vertical') {
                    this.rightButtonsBox.shutdown.actor.hide();
                    this.rightButtonsBox.shutdownMenu.actor.hide();
                    this.rightButtonsBox.shutDownIconBox.show();
                    this.rightButtonsBox.shutDownIconBoxXP.hide();
                    this.rightButtonsBox.shutDownMenuBox.hide();
                } else {
                    this.rightButtonsBox.shutdown.actor.hide();
                    this.rightButtonsBox.shutdownMenu.actor.hide();
                    this.rightButtonsBox.shutDownIconBox.hide();
                    this.rightButtonsBox.shutDownIconBoxXP.show();
                    this.rightButtonsBox.shutDownMenuBox.hide();
                }
            }
            else {
                this.rightButtonsBox.shutdown.actor.hide();
                this.rightButtonsBox.shutdownMenu.actor.hide();
                this.rightButtonsBox.shutDownMenuBox.hide();
                this.rightButtonsBox.shutDownIconBoxXP.hide();
                this.rightButtonsBox.shutDownIconBox.show();
            }
        }
        else {
            this.rightButtonsBox.shutdown.actor.hide();
            this.rightButtonsBox.shutdownMenu.actor.hide();
            this.rightButtonsBox.shutDownIconBoxXP.hide();
            this.rightButtonsBox.shutDownIconBox.hide();
            this.rightButtonsBox.shutDownMenuBox.hide();
        }

        this._updateCustomLabels();

        this.quicklinksupdated = true;
    },

    _updateQuickLinks: function() {
        let nr_quicklinks = 0;

        this.menu.quicklinksCheckboxes = [];
        this.menu.quicklinks = [];

        // first separator
        this.menu.quicklinksCheckboxes[nr_quicklinks] = this.quicklauncher_separator1;
        this.menu.quicklinks[nr_quicklinks] = "separator,,";
        nr_quicklinks++;

        // read Quicklauncher places
        for (let i = 0; i < this.quicklauncher_places.length; i++) {
            // Quicklauncher places checkbox
            this.menu.quicklinksCheckboxes[nr_quicklinks] = this.quicklauncher_places[i].checkbox;

            // Quicklauncher places directory
            let quicklauncher_places_directory = this.quicklauncher_places[i].directory;
            if (quicklauncher_places_directory == null) {
                quicklauncher_places_directory = "---";
            } else if (quicklauncher_places_directory.charAt(0) == "~") {
                let sliced_directory = quicklauncher_places_directory.slice(2);
                if (sliced_directory == "Documents")
                    quicklauncher_places_directory = GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_DOCUMENTS);
                else if (sliced_directory == "Pictures")
                    quicklauncher_places_directory = GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_PICTURES);
                else if (sliced_directory == "Music")
                    quicklauncher_places_directory = GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_MUSIC);
                else if (sliced_directory == "Videos")
                    quicklauncher_places_directory = GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_VIDEOS);
                else if (sliced_directory == "Downloads")
                    quicklauncher_places_directory = GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_DOWNLOAD);
                else
                    quicklauncher_places_directory = GLib.get_home_dir() + '/' + sliced_directory;

                if (quicklauncher_places_directory == null)
                    continue;
            }

            // Quicklauncher places label
            let quicklauncher_places_label = this.quicklauncher_places[i].label;
            if (quicklauncher_places_label == "") {
                quicklauncher_places_label = quicklauncher_places_directory.split("/").pop();
                // root '/' directory
                if (quicklauncher_places_label == "")
                    quicklauncher_places_label = "File System";
                else
                    quicklauncher_places_label = decodeURIComponent(quicklauncher_places_label);
            }

            // Quicklauncher places icon
            let quicklauncher_places_icon = this.quicklauncher_places[i].icon;
            if (quicklauncher_places_icon == "")
                quicklauncher_places_icon = "folder";

            // Quicklauncher places button
            this.menu.quicklinks[nr_quicklinks] = quicklauncher_places_label + "," + quicklauncher_places_icon + "," + "xdg-open " + quicklauncher_places_directory;
            nr_quicklinks++;
        }

        // second separator
        this.menu.quicklinksCheckboxes[nr_quicklinks] = this.quicklauncher_separator2;
        this.menu.quicklinks[nr_quicklinks] = "separator,,";
        nr_quicklinks++;

        // read Quicklauncher apps
        for (let i = 0; i < this.quicklauncher_apps.length; i++) {
            // Quicklauncher apps checkbox
            this.menu.quicklinksCheckboxes[nr_quicklinks] = this.quicklauncher_apps[i].checkbox;

            // Quicklauncher apps command
            let quicklauncher_apps_command = this.quicklauncher_apps[i].command;

            // Quicklauncher apps label
            let quicklauncher_apps_label = this.quicklauncher_apps[i].label;
            if (quicklauncher_apps_label == "")
                quicklauncher_apps_label = quicklauncher_apps_command;

            // Quicklauncher apps icon
            let quicklauncher_apps_icon = this.quicklauncher_apps[i].icon;
            if (quicklauncher_apps_icon == "")
                quicklauncher_apps_icon = "exec";
            else if (!Gtk.IconTheme.get_default().has_icon(quicklauncher_apps_icon))
                quicklauncher_apps_icon = "image-missing";

            // Quicklauncher apps button
            this.menu.quicklinks[nr_quicklinks] = quicklauncher_apps_label + "," + quicklauncher_apps_icon + "," + quicklauncher_apps_command;
            nr_quicklinks++;
        }

        // third separator
        this.menu.quicklinksCheckboxes[nr_quicklinks] = this.quicklauncher_separator3;
        this.menu.quicklinks[nr_quicklinks] = "separator,,";
        nr_quicklinks++;

        /* remove quicklink if checkbox "Show Quicklink" is false */
        for (let i in this.menu.quicklinksCheckboxes) {
            if (!this.menu.quicklinksCheckboxes[i]) {
                this.menu.quicklinks[i] = "";
            }
        }

        this.menu.quicklauncherLayout = this.quicklauncherLayout;
        this.rightButtonsBox.addItems();
        this.rightButtonsBox._update_quicklinks(this.quicklauncherLayout, this.userBoxLayout, this.shutdownMenuLayout);

        this._updateQuickLinksShutdownView();

        this.quicklinksupdated = true;
    },

    on_orientation_changed: function (orientation) {
        this.orientation = orientation;

        this.menu.destroy();
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);

        this.menu.setCustomStyleClass('menu-background');
        this.menu.setCustomStyleClass("starkmenu-background");

        this.menu.connect('open-state-changed', Lang.bind(this, this._onOpenStateChanged));
        this._display();

        if (this.initial_load_done)
            this._refreshAll();
        this._updateIconAndLabel();

        this._updateQuickLinksShutdownView();
        this._updateQuickLinksView();
        this._updateQuickLinks();
    },

    on_applet_added_to_panel: function () {
        this.initial_load_done = true;
    },

    on_applet_removed_from_panel: function () {
        Main.keybindingManager.removeHotKey("overlay-key-" + this.instance_id);
    },

    _launch_editor: function() {
        Util.spawnCommandLine("cinnamon-menu-editor");
    },

    on_applet_clicked: function(event) {
        this.menu.toggle_with_options(this.enableAnimation);
    },

    _onSourceKeyPress: function(actor, event) {
        let symbol = event.get_key_symbol();

        if (symbol == Clutter.KEY_space || symbol == Clutter.KEY_Return) {
            this.menu.toggle();
            return true;
        } else if (symbol == Clutter.KEY_Escape && this.menu.isOpen) {
            this.menu.close();
            return true;
        } else if (symbol == Clutter.KEY_Down) {
            if (!this.menu.isOpen)
                this.menu.toggle();
            this.menu.actor.navigate_focus(this.actor, Gtk.DirectionType.DOWN, false);
            return true;
        } else
            return false;
    },

    _onOpenStateChanged: function(menu, open) {
        if (open) {
            this.menuIsOpening = true;
            this.actor.add_style_pseudo_class('active');
            global.stage.set_key_focus(this.searchEntry);
            this._selectedItemIndex = null;
            this._activeContainer = null;
            this._activeActor = null;
            this._appsBoxWidthResized = false;

            this.lastSelectedCategory = null;

            if(visiblePane == "apps") {
                this._allAppsCategoryButton.actor.style_class = "menu-category-button-selected";
                this._select_category(null);
            }

            if(this.menuLayout == "stark-menu" || this.quicklinksupdated) {
                if (visiblePane == "apps")
                    this.switchPanes("favs");
                this.quicklinksupdated = false;
            }


            let n = Math.min(this._applicationsButtons.length,
                             INITIAL_BUTTON_LOAD);
            for (let i = 0; i < n; i++) {
                this._applicationsButtons[i].actor.show();
            }
            //this._allAppsCategoryButton.actor.style_class = "menu-category-button-selected";
            Mainloop.idle_add(Lang.bind(this, this._initial_cat_selection, n));

            this.fit_favsbox(this.searchEntry);
            this.fit_favsbox(this.appsButton.box);
            this.fit_favsbox(this.resultsFoundButton.box);

        } else {
            this.actor.remove_style_pseudo_class('active');
            if (this.searchActive) {
                this.resetSearch();
            }
            this.selectedAppTitle.set_text("");
            this.selectedAppDescription.set_text("");
            this._previousTreeSelectedActor = null;
            this._previousSelectedActor = null;
            this.closeContextMenus(null, false);

            this._clearAllSelections(false);
            this.destroyVectorBox();
        }
    },

    _initial_cat_selection: function (start_index) {
        let n = this._applicationsButtons.length;
        for (let i = start_index; i < n; i++) {
            this._applicationsButtons[i].actor.show();
        }
    },

    fit_favsbox: function(elem) {
        let parent = elem.get_parent().get_theme_node();
        let p_hpadding = parent.get_padding(St.Side.LEFT) + parent.get_padding(St.Side.RIGHT);
        let favsbox_width = this.favsBox.get_allocation_box().x2 - this.favsBox.get_allocation_box().x1;

        elem.set_width(favsbox_width - p_hpadding);
    },

    destroy: function() {
        this.actor._delegate = null;
        this.menu.destroy();
        this.actor.destroy();
        this.emit('destroy');
    },

    _set_default_menu_icon: function() {
        let path = global.datadir + "/theme/menu.svg";
        if (GLib.file_test(path, GLib.FileTest.EXISTS)) {
            this.set_applet_icon_path(path);
            return;
        }

        path = global.datadir + "/theme/menu-symbolic.svg";
        if (GLib.file_test(path, GLib.FileTest.EXISTS)) {
            this.set_applet_icon_symbolic_path(path);
            return;
        }
        /* If all else fails, this will yield no icon */
        this.set_applet_icon_path("");
    },

    _updateIconAndLabel: function(){
        try {
            if (this.menuIconCustom) {
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
                this._set_default_menu_icon();
            }
        } catch(e) {
           global.logWarning("Could not load icon file \""+this.menuIcon+"\" for menu button");
        }

        if (this.menuIconCustom && this.menuIcon == "") {
            this._applet_icon_box.hide();
        } else {
            this._applet_icon_box.show();
        }

        if (this.orientation == St.Side.LEFT || this.orientation == St.Side.RIGHT)  // no menu label if in a vertical panel
        {
            this.set_applet_label("");
        }
        else {
            if (this.menuLabel != "")
                this.set_applet_label(_(this.menuLabel));
            else
                this.set_applet_label("");
        }
    },

    _updateCustomLabels: function(){
        if (this.shutdownLabel != "") {
            this.rightButtonsBox.shutdown.label.set_text(_(this.shutdownLabel));
            this.rightButtonsBox.shutdown2.label.set_text(_(this.shutdownLabel));
        } else {
            this.rightButtonsBox.shutdown.label.set_text("");
            this.rightButtonsBox.shutdown2.label.set_text("");
        }
        if (visiblePane == "apps") {
            if (this.favoritesLabel != "")
                this.appsButton.label.set_text(_(this.favoritesLabel));
            else
                this.appsButton.label.set_text("");
        }
        else {
            if (this.allProgramsLabel != "")
                this.appsButton.label.set_text(_(this.allProgramsLabel));
            else
                this.appsButton.label.set_text("");
        }
    },

    _recentMenuOpenStateChanged: function(recentContextMenu) {
        if (recentContextMenu.isOpen) {
            this._activeContextMenuParent = recentContextMenu.sourceActor._delegate;
            this._scrollToButton(recentContextMenu);
        } else {
            this._activeContextMenuItem = null;
            this._activeContextMenuParent = null;
            for (let item in this._recentButtons) {
                if (this._recentButtons[item].menu) {
                    this._recentButtons[item].menu = null;
                }
            }
        }
    },

    createRecentContextMenu: function(actor) {
        let menu = new PopupMenu.PopupSubMenu(actor);
        menu.actor.set_style_class_name('menu-context-menu');
        menu.connect('open-state-changed', Lang.bind(this, this._recentMenuOpenStateChanged));
        this.recentContextMenu = menu;
    },

    _navigateContextMenu: function(button, symbol, ctrlKey) {
        if (symbol === Clutter.KEY_Menu || symbol === Clutter.Escape ||
            (ctrlKey && (symbol === Clutter.KEY_Return || symbol === Clutter.KP_Enter))) {
            button.activateContextMenus();
            return;
        }

        let minIndex = 0;
        let goUp = symbol === Clutter.KEY_Up;
        let nextActive = null;
        let menuItems = button.menu._getMenuItems(); // The context menu items

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
            if (symbol === Clutter.KEY_Return || symbol === Clutter.KP_Enter) {
                button.activate();
            } else {
                this._activeContextMenuItem = menuItems[goUp ? menuItemsLength - 1 : minIndex];
                this._activeContextMenuItem.setActive(true);
            }
            return;
        } else if (this._activeContextMenuItem &&
            (symbol === Clutter.KEY_Return || symbol === Clutter.KP_Enter)) {
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
    },

    _onMenuKeyPress: function(actor, event) {
        let symbol = event.get_key_symbol();
        let item_actor;
        let index = 0;
        this.appBoxIter.reloadVisible();
        this.catBoxIter.reloadVisible();
        this.favBoxIter.reloadVisible();

        let keyCode = event.get_key_code();
        let modifierState = Cinnamon.get_event_state(event);

        /* check for a keybinding and quit early, otherwise we get a double hit
           of the keybinding callback */
        let action = global.display.get_keybinding_action(keyCode, modifierState);

        if (action == Meta.KeyBindingAction.CUSTOM) {
            return true;
        }

        index = this._selectedItemIndex;

        let ctrlKey = modifierState & Clutter.ModifierType.CONTROL_MASK;

        // If a context menu is open, hijack keyboard navigation and concentrate on the context menu.
        if (this._activeContextMenuParent && this._activeContextMenuParent._contextIsOpen &&
            (this._activeContainer === this.applicationsBox &&
            (this._activeContextMenuParent instanceof ApplicationButton ||
                this._activeContextMenuParent instanceof RecentButton)) ||
            (this._activeContainer === this.favoritesBox &&
                this._activeContextMenuParent instanceof FavoritesButton)) {
            let continueNavigation = false;
            switch (symbol) {
                case Clutter.KEY_Up:
                case Clutter.KEY_Down:
                case Clutter.KEY_Return:
                case Clutter.KP_Enter:
                case Clutter.KEY_Menu:
                case Clutter.KEY_Page_Up:
                case Clutter.KEY_Page_Down:
                case Clutter.Escape:
                    this._navigateContextMenu(this._activeContextMenuParent, symbol, ctrlKey);
                    break;
                case Clutter.KEY_Right:
                case Clutter.KEY_Left:
                case Clutter.Tab:
                case Clutter.ISO_Left_Tab:
                    continueNavigation = true;
                    break;
            }
            if (!continueNavigation)
                return true;
        }

        let navigationKey = true;
        let whichWay = "none";

        switch (symbol) {
            case Clutter.KEY_Up:
                whichWay = "up";
                if (this._activeContainer === this.favoritesBox && ctrlKey &&
                    (this.favoritesBox.get_child_at_index(index))._delegate instanceof FavoritesButton)
                    navigationKey = false;
                break;
            case Clutter.KEY_Down:
                whichWay = "down";
                if (this._activeContainer === this.favoritesBox && ctrlKey &&
                    (this.favoritesBox.get_child_at_index(index))._delegate instanceof FavoritesButton)
                    navigationKey = false;
                break;
            case Clutter.KEY_Page_Up:
                whichWay = "top"; break;
            case Clutter.KEY_Page_Down:
                whichWay = "bottom"; break;
            case Clutter.KEY_Right:
                if (!this.searchActive)
                    whichWay = "right";
                if (this._activeContainer === this.applicationsBox)
                    whichWay = "none";
                else if (this._activeContainer === this.categoriesBox && this.noRecentDocuments &&
                         (this.categoriesBox.get_child_at_index(index))._delegate instanceof RecentCategoryButton)
                    whichWay = "none";
                break;
            case Clutter.KEY_Left:
                if (!this.searchActive)
                    whichWay = "left";
                if (this._activeContainer === this.favoritesBox)
                    whichWay = "none";
                break;
            case Clutter.Tab:
                if (!this.searchActive)
                    whichWay = "right";
                else
                    navigationKey = false;
                break;
            case Clutter.ISO_Left_Tab:
                if (!this.searchActive)
                    whichWay = "left";
                else
                    navigationKey = false;
                break;
            default:
                navigationKey = false;
        }

        if (navigationKey) {
            switch (this._activeContainer) {
                case null:
                    switch (whichWay) {
                        case "up":
                            if(visiblePane == "favs") {
                                this._activeContainer = this.favoritesBox;
                                item_actor = this.favBoxIter.getLastVisible();
                            } else {
                                this._activeContainer = this.categoriesBox;
                                item_actor = this.catBoxIter.getLastVisible();
                                this._scrollToButton(this.appBoxIter.getFirstVisible()._delegate);
                                this._scrollToCategoryButton(item_actor._delegate);
                            }
                            break;
                        case "down":
                            if(visiblePane == "favs") {
                                this._activeContainer = this.favoritesBox;
                                item_actor = this.favBoxIter.getFirstVisible();
                            } else {
                                this._activeContainer = this.categoriesBox;
                                item_actor = this.catBoxIter.getFirstVisible();
                                item_actor = this._activeContainer._vis_iter.getNextVisible(item_actor);
                                this._scrollToButton(this.appBoxIter.getFirstVisible()._delegate);
                                this._scrollToCategoryButton(item_actor._delegate);
                            }
                            break;
                        case "right":
                            if(visiblePane == "favs") {
                                this._activeContainer = this.categoriesBox;
                                item_actor = this.catBoxIter.getFirstVisible();
                                this.switchPanes("apps");
                            } else {
                                this._activeContainer = this.applicationsBox;
                                item_actor = this.appBoxIter.getFirstVisible();
                                this._scrollToButton(item_actor._delegate);
                            }
                            break;
                        case "left":
                            this._activeContainer = this.favoritesBox;
                            item_actor = this.favBoxIter.getFirstVisible();
                            if(visiblePane == "apps")
                                this.switchPanes("favs");
                            break;
                        case "top":
                            if(visiblePane == "favs") {
                                this._activeContainer = this.favoritesBox;
                                item_actor = this.favBoxIter.getFirstVisible();
                            } else {
                                this._activeContainer = this.categoriesBox;
                                item_actor = this.catBoxIter.getFirstVisible();
                                this._scrollToButton(this.appBoxIter.getFirstVisible()._delegate);
                                this._scrollToCategoryButton(item_actor._delegate);
                            }
                            break;
                        case "bottom":
                            if(visiblePane == "favs") {
                                this._activeContainer = this.favoritesBox;
                                item_actor = this.favBoxIter.getLastVisible();
                            } else {
                                this._activeContainer = this.categoriesBox;
                                item_actor = this.catBoxIter.getLastVisible();
                                this._scrollToButton(this.appBoxIter.getFirstVisible()._delegate);
                                this._scrollToCategoryButton(item_actor._delegate);
                            }
                            break;
                    }
                    break;
                case this.categoriesBox:
                    switch (whichWay) {
                        case "up":
                            this._previousTreeSelectedActor = this.categoriesBox.get_child_at_index(index);
                            this._previousTreeSelectedActor._delegate.isHovered = false;
                            item_actor = this.catBoxIter.getPrevVisible(this._activeActor);
                            this._scrollToButton(this.appBoxIter.getFirstVisible()._delegate);
                            this._scrollToCategoryButton(item_actor._delegate);
                            break;
                        case "down":
                            this._previousTreeSelectedActor = this.categoriesBox.get_child_at_index(index);
                            this._previousTreeSelectedActor._delegate.isHovered = false;
                            item_actor = this.catBoxIter.getNextVisible(this._activeActor);
                            this._scrollToButton(this.appBoxIter.getFirstVisible()._delegate);
                            this._scrollToCategoryButton(item_actor._delegate);
                            break;
                        case "right":
                            if ((this.categoriesBox.get_child_at_index(index))._delegate instanceof RecentCategoryButton &&
                                this.noRecentDocuments) {
                                this._previousSelectedActor = this.categoriesBox.get_child_at_index(index);
                                item_actor = this.favBoxIter.getFirstVisible();
                                this.switchPanes("favs");
                            }
                            else {
                                item_actor = (this._previousVisibleIndex != null) ?
                                                this.appBoxIter.getVisibleItem(this._previousVisibleIndex) :
                                                this.appBoxIter.getFirstVisible();
                            }
                            break;
                        case "left":
                            this._previousSelectedActor = this.categoriesBox.get_child_at_index(index);
                            item_actor = this.favBoxIter.getFirstVisible();
                            //index = this.favBoxIter.getAbsoluteIndexOfChild(item_actor);
                            this.switchPanes("favs");
                            break;
                        case "top":
                            this._previousTreeSelectedActor = this.categoriesBox.get_child_at_index(index);
                            this._previousTreeSelectedActor._delegate.isHovered = false;
                            item_actor = this.catBoxIter.getFirstVisible();
                            this._scrollToButton(this.appBoxIter.getFirstVisible()._delegate);
                            this._scrollToCategoryButton(item_actor._delegate);
                            break;
                        case "bottom":
                            this._previousTreeSelectedActor = this.categoriesBox.get_child_at_index(index);
                            this._previousTreeSelectedActor._delegate.isHovered = false;
                            item_actor = this.catBoxIter.getLastVisible();
                            this._scrollToButton(this.appBoxIter.getFirstVisible()._delegate);
                            this._scrollToCategoryButton(item_actor._delegate);
                            break;
                    }
                    break;
                case this.applicationsBox:
                    switch (whichWay) {
                        case "up":
                            this._previousSelectedActor = this.applicationsBox.get_child_at_index(index);
                            item_actor = this.appBoxIter.getPrevVisible(this._previousSelectedActor);
                            this._previousVisibleIndex = this.appBoxIter.getVisibleIndex(item_actor);
                            this._scrollToButton(item_actor._delegate);
                            break;
                        case "down":
                            this._previousSelectedActor = this.applicationsBox.get_child_at_index(index);
                            item_actor = this.appBoxIter.getNextVisible(this._previousSelectedActor);
                            this._previousVisibleIndex = this.appBoxIter.getVisibleIndex(item_actor);
                            this._scrollToButton(item_actor._delegate);
                            break;
                        case "right":
                            this._previousSelectedActor = this.applicationsBox.get_child_at_index(index);
                            item_actor = (this._previousTreeSelectedActor != null) ?
                                            this._previousTreeSelectedActor :
                                            this.catBoxIter.getFirstVisible();
                            this._previousTreeSelectedActor = item_actor;
                            index = item_actor.get_parent()._vis_iter.getAbsoluteIndexOfChild(item_actor);

                            item_actor._delegate.emit('enter-event');
                            this._previousSelectedActor = this.categoriesBox.get_child_at_index(index);
                            item_actor = this.favBoxIter.getFirstVisible();
                            this.switchPanes("favs");
                            break;
                        case "left":
                            this._previousSelectedActor = this.applicationsBox.get_child_at_index(index);
                            item_actor = (this._previousTreeSelectedActor != null) ?
                                            this._previousTreeSelectedActor :
                                            this.catBoxIter.getFirstVisible();
                            this._previousTreeSelectedActor = item_actor;
                            break;
                        case "top":
                            item_actor = this.appBoxIter.getFirstVisible();
                            this._previousVisibleIndex = this.appBoxIter.getVisibleIndex(item_actor);
                            this._scrollToButton(item_actor._delegate);
                            break;
                        case "bottom":
                            item_actor = this.appBoxIter.getLastVisible();
                            this._previousVisibleIndex = this.appBoxIter.getVisibleIndex(item_actor);
                            this._scrollToButton(item_actor._delegate);
                            break;
                    }
                    break;
                case this.favoritesBox:
                    switch (whichWay) {
                        case "up":
                            this._previousSelectedActor = this.favoritesBox.get_child_at_index(index);
                            item_actor = this.favBoxIter.getPrevVisible(this._previousSelectedActor);
                            break;
                        case "down":
                            this._previousSelectedActor = this.favoritesBox.get_child_at_index(index);
                            item_actor = this.favBoxIter.getNextVisible(this._previousSelectedActor);
                            break;
                        case "right":
                            item_actor = (this._previousTreeSelectedActor != null) ?
                                            this._previousTreeSelectedActor :
                                            this.catBoxIter.getFirstVisible();
                            this._previousTreeSelectedActor = item_actor;
                            this.switchPanes("apps");
                            break;
                        case "left":
                            item_actor = (this._previousTreeSelectedActor != null) ?
                                            this._previousTreeSelectedActor :
                                            this.catBoxIter.getFirstVisible();
                            this._previousTreeSelectedActor = item_actor;
                            index = item_actor.get_parent()._vis_iter.getAbsoluteIndexOfChild(item_actor);

                            item_actor._delegate.emit('enter-event');
                            item_actor = (this._previousVisibleIndex != null) ?
                                            this.appBoxIter.getVisibleItem(this._previousVisibleIndex) :
                                            this.appBoxIter.getFirstVisible();
                            this.switchPanes("apps");
                            break;
                        case "top":
                            item_actor = this.favBoxIter.getFirstVisible();
                            break;
                        case "bottom":
                            item_actor = this.favBoxIter.getLastVisible();
                            break;
                    }
                    break;
                default:
                    break;
            }
            if (!item_actor)
                return false;
            index = item_actor.get_parent()._vis_iter.getAbsoluteIndexOfChild(item_actor);
        } else {
            if (this._activeContainer !== this.categoriesBox && (symbol === Clutter.KEY_Return || symbol === Clutter.KP_Enter)) {
                if (!ctrlKey) {
                    item_actor = this._activeContainer.get_child_at_index(this._selectedItemIndex);
                    item_actor._delegate.activate();
                } else if (ctrlKey && (this._activeContainer === this.applicationsBox || this._activeContainer === this.favoritesBox)) {
                    item_actor = this._activeContainer.get_child_at_index(this._selectedItemIndex);
                    if (item_actor._delegate instanceof ApplicationButton ||
                        item_actor._delegate instanceof RecentButton ||
                        item_actor._delegate instanceof FavoritesButton)
                        item_actor._delegate.activateContextMenus();
                }
                return true;
            } else if ((this._activeContainer === this.applicationsBox || this._activeContainer === this.favoritesBox) &&
                       symbol === Clutter.KEY_Menu) {
                item_actor = this._activeContainer.get_child_at_index(this._selectedItemIndex);
                    if (item_actor._delegate instanceof ApplicationButton ||
                        item_actor._delegate instanceof RecentButton ||
                        item_actor._delegate instanceof FavoritesButton)
                        item_actor._delegate.activateContextMenus();
                return true;
            } else if (this._activeContainer === this.favoritesBox && symbol === Clutter.Delete) {
               item_actor = this.favoritesBox.get_child_at_index(this._selectedItemIndex);
                if (item_actor._delegate instanceof FavoritesButton) {
                    let favorites = AppFavorites.getAppFavorites().getFavorites();
                    let numFavorites = favorites.length;
                    AppFavorites.getAppFavorites().removeFavorite(item_actor._delegate.app.get_id());
                    if (this._selectedItemIndex == (2*numFavorites-2))
                        item_actor = this.favoritesBox.get_child_at_index(this._selectedItemIndex-2);
                    else
                        item_actor = this.favoritesBox.get_child_at_index(this._selectedItemIndex);
                }
            } else if (this._activeContainer === this.favoritesBox &&
                        (symbol === Clutter.KEY_Down || symbol === Clutter.KEY_Up) && ctrlKey &&
                        (this.favoritesBox.get_child_at_index(index))._delegate instanceof FavoritesButton) {
                item_actor = this.favoritesBox.get_child_at_index(this._selectedItemIndex);
                let id = item_actor._delegate.app.get_id();
                let appFavorites = AppFavorites.getAppFavorites();
                let favorites = appFavorites.getFavorites();
                let numFavorites = favorites.length;
                let favPos = 0;
                if (this._selectedItemIndex == (2*numFavorites-2) && symbol === Clutter.KEY_Down)
                    favPos = 0;
                else if (this._selectedItemIndex == 0 && symbol === Clutter.KEY_Up)
                    favPos = 2*numFavorites-2;
                else if (symbol === Clutter.KEY_Down)
                    favPos = this._selectedItemIndex + 2;
                else
                    favPos = this._selectedItemIndex - 2;
                appFavorites.moveFavoriteToPos(id, favPos/2);
                item_actor = this.favoritesBox.get_child_at_index(favPos);
            } else if (this.searchFilesystem && (this._fileFolderAccessActive || symbol === Clutter.slash)) {
                if (symbol === Clutter.Return || symbol === Clutter.KP_Enter) {
                    if (this._run(this.searchEntry.get_text())) {
                        this.menu.close();
                    }
                    return true;
                }
                if (symbol === Clutter.Escape) {
                    this.searchEntry.set_text('');
                    this._fileFolderAccessActive = false;
                }
                if (symbol === Clutter.slash) {
                    // Need preload data before get completion. GFilenameCompleter load content of parent directory.
                    // Parent directory for /usr/include/ is /usr/. So need to add fake name('a').
                    let text = this.searchEntry.get_text().concat('/a');
                    let prefix;
                    if (text.lastIndexOf(' ') == -1)
                        prefix = text;
                    else
                        prefix = text.substr(text.lastIndexOf(' ') + 1);
                    this._getCompletion(prefix);

                    return false;
                }
                if (symbol === Clutter.Tab) {
                    let text = actor.get_text();
                    let prefix;
                    if (text.lastIndexOf(' ') == -1)
                        prefix = text;
                    else
                        prefix = text.substr(text.lastIndexOf(' ') + 1);
                    let postfix = this._getCompletion(prefix);
                    if (postfix != null && postfix.length > 0) {
                        actor.insert_text(postfix, -1);
                        actor.set_cursor_position(text.length + postfix.length);
                        if (postfix[postfix.length - 1] == '/')
                            this._getCompletion(text + postfix + 'a');
                    }
                    return true;
                }
                if (symbol === Clutter.ISO_Left_Tab) {
                    return true;
                }
                return false;
            } else if (symbol === Clutter.Tab || symbol === Clutter.ISO_Left_Tab) {
                return true;
            } else {
                return false;
            }
        }

        this.selectedAppTitle.set_text("");
        this.selectedAppDescription.set_text("");

        this._selectedItemIndex = index;
        if (!item_actor || item_actor === this.searchEntry) {
            return false;
        }
        item_actor._delegate.emit('enter-event');
        return true;
    },

    _addEnterEvent: function(button, callback) {
        let _callback = Lang.bind(this, function() {
            let parent = button.actor.get_parent();
            if (this._activeContainer === this.categoriesBox && parent !== this._activeContainer) {
                this._previousTreeSelectedActor = this._activeActor;
                this._previousSelectedActor = null;
            }
            if (this._previousTreeSelectedActor && this._activeContainer !== this.categoriesBox &&
                    parent !== this._activeContainer && button !== this._previousTreeSelectedActor && !this.searchActive) {
                this._previousTreeSelectedActor.style_class = "menu-category-button";
            }
            if (parent != this._activeContainer) {
                parent._vis_iter.reloadVisible();
            }
            let _maybePreviousActor = this._activeActor;
            if (_maybePreviousActor && this._activeContainer !== this.categoriesBox) {
                this._previousSelectedActor = _maybePreviousActor;
                this._clearPrevSelection();
            }
            if (parent === this.categoriesBox && !this.searchActive) {
                this._previousSelectedActor = _maybePreviousActor;
                this._clearPrevCatSelection();
            }
            this._activeContainer = parent;
            this._activeActor = button.actor;
            this._selectedItemIndex = this._activeContainer._vis_iter.getAbsoluteIndexOfChild(this._activeActor);
            callback();
        });
        button.connect('enter-event', _callback);
        button.actor.connect('enter-event', _callback);
    },

    _clearPrevSelection: function(actor) {
        if (this._previousSelectedActor && this._previousSelectedActor != actor) {
            if (this._previousSelectedActor._delegate instanceof ApplicationButton ||
                this._previousSelectedActor._delegate instanceof RecentButton ||
                this._previousSelectedActor._delegate instanceof SearchProviderResultButton ||
                this._previousSelectedActor._delegate instanceof PlaceButton ||
                this._previousSelectedActor._delegate instanceof RecentClearButton ||
                this._previousSelectedActor._delegate instanceof TransientButton)
                this._previousSelectedActor.style_class = "menu-application-button";
            else if (this._previousSelectedActor._delegate instanceof FavoritesButton)
                this._previousSelectedActor.remove_style_pseudo_class("hover");
        }
    },

    _clearPrevCatSelection: function(actor) {
        if (this._previousTreeSelectedActor && this._previousTreeSelectedActor != actor) {
            this._previousTreeSelectedActor.style_class = "menu-category-button";

            if (this._previousTreeSelectedActor._delegate) {
                this._previousTreeSelectedActor._delegate.emit('leave-event');
            }

            if (actor !== undefined) {
                this._previousVisibleIndex = null;
                this._previousTreeSelectedActor = actor;
            }
        } else {
            this.categoriesBox.get_children().forEach(Lang.bind(this, function (child) {
                child.style_class = "menu-category-button";
            }));
        }
    },

    makeVectorBox: function(actor) {
        this.destroyVectorBox(actor);
        let [mx, my, mask] = global.get_pointer();
        let [bx, by] = this.categoriesApplicationsBox.actor.get_transformed_position();
        let [bw, bh] = this.categoriesApplicationsBox.actor.get_transformed_size();
        let [appbox_x, appbox_y] = this.applicationsBox.get_transformed_position();

        let right_x = appbox_x - bx;
        let xformed_mouse_x = mx-bx;
        let xformed_mouse_y = my-by;
        let w = Math.max(right_x-xformed_mouse_x, 0);

        let ulc_y = xformed_mouse_y + 0;
        let llc_y = xformed_mouse_y + 0;

        this.vectorBox = new St.Polygon({ debug: false, width: w, height: bh,
                                          ulc_x: 0, ulc_y: ulc_y,
                                          llc_x: 0, llc_y: llc_y,
                                          urc_x: w, urc_y: 0,
                                          lrc_x: w, lrc_y: bh });

        this.categoriesOverlayBox.add_actor(this.vectorBox);
        this.vectorBox.set_position(xformed_mouse_x, 0);

        this.vectorBox.show();
        this.vectorBox.set_reactive(true);
        this.vectorBox.raise_top();

        this.vectorBox.connect("leave-event", Lang.bind(this, this.destroyVectorBox));
        this.vectorBox.connect("motion-event", Lang.bind(this, this.maybeUpdateVectorBox));
        this.actor_motion_id = actor.connect("motion-event", Lang.bind(this, this.maybeUpdateVectorBox));
        this.current_motion_actor = actor;
    },

    maybeUpdateVectorBox: function() {
        if (this.vector_update_loop) {
            Mainloop.source_remove(this.vector_update_loop);
            this.vector_update_loop = 0;
        }
        this.vector_update_loop = Mainloop.timeout_add(50, Lang.bind(this, this.updateVectorBox));
    },

    updateVectorBox: function(actor) {
        if (this.vectorBox) {
            let [mx, my, mask] = global.get_pointer();
            let [bx, by] = this.categoriesApplicationsBox.actor.get_transformed_position();
            let xformed_mouse_x = mx-bx;
            let [appbox_x, appbox_y] = this.applicationsBox.get_transformed_position();
            let right_x = appbox_x - bx;
            if ((right_x-xformed_mouse_x) > 0) {
                this.vectorBox.width = Math.max(right_x-xformed_mouse_x, 0);
                this.vectorBox.set_position(xformed_mouse_x, 0);
                this.vectorBox.urc_x = this.vectorBox.width;
                this.vectorBox.lrc_x = this.vectorBox.width;
                this.vectorBox.queue_repaint();
            } else {
                this.destroyVectorBox(actor);
            }
        }
        this.vector_update_loop = 0;
        return false;
    },

    destroyVectorBox: function(actor) {
        if (this.vectorBox != null) {
            this.vectorBox.destroy();
            this.vectorBox = null;
        }
        if (this.actor_motion_id > 0 && this.current_motion_actor != null) {
            this.current_motion_actor.disconnect(this.actor_motion_id);
            this.actor_motion_id = 0;
            this.current_motion_actor = null;
        }
    },

    _refreshPlaces : function() {
        for (let i = 0; i < this._placesButtons.length; i ++) {
            this._placesButtons[i].actor.destroy();
        }

        this._placesButtons = [];

        for (let i = 0; i < this._categoryButtons.length; i++) {
            if (this._categoryButtons[i] instanceof PlaceCategoryButton) {
                this._categoryButtons[i].destroy();
                this._categoryButtons.splice(i, 1);
                this.placesButton = null;
                break;
            }
        }

        // Now generate Places category and places buttons and add to the list
        if (this.showPlaces) {
            this.placesButton = new PlaceCategoryButton(null, this.showCategoryIcons);
            this._addEnterEvent(this.placesButton, Lang.bind(this, function() {
                if (!this.searchActive) {
                    this.placesButton.isHovered = true;

                    this._clearPrevCatSelection(this.placesButton);
                    this.placesButton.actor.style_class = "menu-category-button-selected";
                    this.closeContextMenus(null, false);
                    this._select_category("places");

                    this.makeVectorBox(this.placesButton.actor);
                }
            }));
            this.placesButton.actor.connect('leave-event', Lang.bind(this, function () {
                if (this._previousTreeSelectedActor === null) {
                    this._previousTreeSelectedActor = this.placesButton.actor;
                } else {
                    let prevIdx = this.catBoxIter.getVisibleIndex(this._previousTreeSelectedActor);
                    let nextIdx = this.catBoxIter.getVisibleIndex(this.placesButton.actor);
                    let idxDiff = Math.abs(prevIdx - nextIdx);
                    if (idxDiff <= 1 || Math.min(prevIdx, nextIdx) < 0) {
                        this._previousTreeSelectedActor = this.placesButton.actor;
                    }
                }

                this.placesButton.isHovered = false;
            }));
            this._categoryButtons.push(this.placesButton);
            this.categoriesBox.add_actor(this.placesButton.actor);

            let bookmarks = this._listBookmarks();
            let devices = this._listDevices();
            let places = bookmarks.concat(devices);

            let handleEnterEvent = (button) => {
                this._addEnterEvent(button, () => {
                    this._clearPrevSelection(button.actor);
                    button.actor.style_class = "menu-application-button-selected";
                    this.selectedAppTitle.set_text("");
                    this.selectedAppDescription.set_text(button.description);
                    button.tooltip._tooltip.get_clutter_text().set_markup(button.description);
                });
            };

            let handleLeaveEvent = (button) => {
                button.actor.connect('leave-event', () => {
                    this._previousSelectedActor = button.actor;
                    this.selectedAppTitle.set_text("");
                    this.selectedAppDescription.set_text("");
                });
            };

            for (let i = 0; i < places.length; i++) {
                let place = places[i];
                let button = new PlaceButton(this, place, place.name, this.showApplicationIcons, this.showAppsDescriptionOnButtons);
                handleEnterEvent(button);
                handleLeaveEvent(button);
                this._placesButtons.push(button);
                this.applicationsBox.add_actor(button.actor);
            }
        }

        this._setCategoriesButtonActive(!this.searchActive);
    },

    _refreshRecent : function() {
        if (this.privacy_settings.get_boolean(REMEMBER_RECENT_KEY)) {
            if (this.recentButton == null) {
                this.recentButton = new RecentCategoryButton(null, this.showCategoryIcons);
                this._addEnterEvent(this.recentButton, Lang.bind(this, function() {
                    if (!this.searchActive) {
                        this.recentButton.isHovered = true;

                        this._clearPrevCatSelection(this.recentButton.actor);
                        this.recentButton.actor.style_class = "menu-category-button-selected";
                        this.closeContextMenus(null, false);
                        this._select_category("recent");

                        this.makeVectorBox(this.recentButton.actor);
                    }
                }));
                this.recentButton.actor.connect('leave-event', Lang.bind(this, function () {

                    if (this._previousTreeSelectedActor === null) {
                        this._previousTreeSelectedActor = this.recentButton.actor;
                    } else {
                        let prevIdx = this.catBoxIter.getVisibleIndex(this._previousTreeSelectedActor);
                        let nextIdx = this.catBoxIter.getVisibleIndex(this.recentButton.actor);

                        if (Math.abs(prevIdx - nextIdx) <= 1) {
                            this._previousTreeSelectedActor = this.recentButton.actor;
                        }
                    }

                    this.recentButton.isHovered = false;
                }));

                this._categoryButtons.push(this.recentButton);
            }

            /* Make sure the recent category is at the bottom (can happen when refreshing places
             * or apps, since we don't destroy the recent category button each time we refresh recents,
             * as it happens a lot) */

            let parent = this.recentButton.actor.get_parent();

            if (parent != null) {
                parent.remove_child(this.recentButton.actor);
            }

            this.categoriesBox.add_actor(this.recentButton.actor);
            this._categoryButtons.splice(this._categoryButtons.indexOf(this.recentButton), 1);
            this._categoryButtons.push(this.recentButton);

            let new_recents = [];

            if (this.RecentManager._infosByTimestamp.length > 0) {

                let handleEnterEvent = (button) => {
                    this._addEnterEvent(button, () => {
                        this._clearPrevSelection(button.actor);
                        button.actor.style_class = "menu-application-button-selected";
                        this.selectedAppTitle.set_text("");
                        this.selectedAppDescription.set_text(button.description);
                        button.tooltip._tooltip.get_clutter_text().set_markup(button.description);
                    });
                };

                let handleLeaveEvent = (button) => {
                    button.actor.connect('leave-event', () => {
                        button.actor.style_class = "menu-application-button";
                        this._previousSelectedActor = button.actor;
                        this.selectedAppTitle.set_text("");
                        this.selectedAppDescription.set_text("");
                    });
                };

                let handleNewButton = (id) => {
                    let uri = this.RecentManager._infosByTimestamp[id].uri;
                    return this._recentButtons.find(button => ((button instanceof RecentButton) &&
                                                                     (button.uri) && (button.uri == uri)));
                };

                let id = 0;
                while (id < this.RecentManager._infosByTimestamp.length) {
                    let new_button = null;

                    new_button = handleNewButton(id);

                    if (new_button == undefined) {
                        let button = new RecentButton(this, this.RecentManager._infosByTimestamp[id], this.showApplicationIcons, this.showAppsDescriptionOnButtons);
                        handleEnterEvent(button);
                        handleLeaveEvent(button);

                        new_button = button;
                    }

                    new_recents.push(new_button);

                    id++;
                }

                let recent_clear_button = null;

                recent_clear_button = this._recentButtons.find(button => (button instanceof RecentClearButton));

                if (recent_clear_button == undefined) {
                    let button = new RecentClearButton(this);
                    this._addEnterEvent(button, Lang.bind(this, function() {
                        this._clearPrevSelection(button.actor);
                        button.actor.style_class = "menu-application-button-selected";
                    }));
                    button.actor.connect('leave-event', Lang.bind(this, function() {
                        button.actor.style_class = "menu-application-button";
                        this._previousSelectedActor = button.actor;
                    }));

                    recent_clear_button = button;
                }

                new_recents.push(recent_clear_button);

                this.noRecentDocuments = false;
            } else {
                let new_button = null;

                for (let existing_button in this._recentButtons) {
                    let button = this._recentButtons[existing_button];

                    if (button instanceof NoRecentDocsButton) {
                        new_button = button;
                        break;
                    }
                }

                if (new_button == null) {
                    new_button = new NoRecentDocsButton(_("No recent documents"), null, false, null);
                }

                this.noRecentDocuments = true;
                new_recents.push(new_button);
            }

            let to_remove = [];

            /* Remove no-longer-valid items */
            for (let i = 0; i < this._recentButtons.length; i++) {
                let button = this._recentButtons[i];

                if (button instanceof NoRecentDocsButton && !this.noRecentDocuments) {
                    to_remove.push(button);
                } else if (button instanceof RecentButton) {
                    if (new_recents.indexOf(button) == -1) {
                        to_remove.push(button);
                    }
                }
            }

            if (to_remove.length > 0) {
                for (let i in to_remove) {
                    to_remove[i].destroy();
                    this._recentButtons.splice(this._recentButtons.indexOf(to_remove[i]), 1);
                }
            }

            to_remove = [];

            /* Now, add new actors, shuffle existing actors */

            let placeholder = null;

            /* Find the first occurrence of a RecentButton, if it exists */
            let children = this.applicationsBox.get_children();
            for (let i = children.length - 1; i > 0; i--) {
                if ((children[i]._delegate instanceof RecentButton) ||
                    (children[i]._delegate instanceof RecentClearButton) ||
                    (i == children.length - 1)) {
                    placeholder = children[i - 1];
                    break;
                }
            }

            children = null;

            for (let i = 0; i < new_recents.length; i++) {
                let actor = new_recents[i].actor;

                let parent = actor.get_parent();
                if (parent != null) {
                    parent.remove_child(actor);
                }

                if (placeholder != actor) {
                    this.applicationsBox.insert_child_above(actor, placeholder);
                } else {
                    this.applicationsBox.add_child(actor);
                }

                placeholder = actor;
            }

            this._recentButtons = new_recents;
        } else {
            for (let i = 0; i < this._recentButtons.length; i ++) {
                this._recentButtons[i].destroy();
            }

            this._recentButtons = [];

            for (let i = 0; i < this._categoryButtons.length; i++) {
                if (this._categoryButtons[i] instanceof RecentCategoryButton) {
                    this._categoryButtons[i].destroy();
                    this._categoryButtons.splice(i, 1);
                    this.recentButton = null;
                    break;
                }
            }
        }

        this._setCategoriesButtonActive(!this.searchActive);
    },

    _refreshApps : function() {
        /* iterate in reverse, so multiple splices will not upset
         * the remaining elements */
        for (let i = this._categoryButtons.length - 1; i > -1; i--) {
            if (this._categoryButtons[i] instanceof CategoryButton) {
                this._categoryButtons[i].destroy();
                this._categoryButtons.splice(i, 1);
            }
        }

        this._applicationsButtons.forEach(Lang.bind(this, function(button) {
            button.destroy();
        }));

        this._applicationsButtons = [];
        // this.applicationsBox.destroy_all_children();

        this._transientButtons = [];
        this._applicationsButtonFromApp = {};

        this._allAppsCategoryButton = new CategoryButton(null);
        this._addEnterEvent(this._allAppsCategoryButton, Lang.bind(this, function() {
            if (!this.searchActive) {
                this._allAppsCategoryButton.isHovered = true;

                this._clearPrevCatSelection(this._allAppsCategoryButton.actor);
                this._allAppsCategoryButton.actor.style_class = "menu-category-button-selected";
                this._select_category(null);

                this.makeVectorBox(this._allAppsCategoryButton.actor);
            }
         }));
         this._allAppsCategoryButton.actor.connect('leave-event', Lang.bind(this, function () {
            this._previousSelectedActor = this._allAppsCategoryButton.actor;
            this._allAppsCategoryButton.isHovered = false;
         }));

         this.categoriesBox.add_actor(this._allAppsCategoryButton.actor);
         this._categoryButtons.push(this._allAppsCategoryButton);

        let tree = appsys.get_tree();
        let root = tree.get_root_directory();
        let dirs = [];
        let iter = root.iter();
        let nextType;

        while ((nextType = iter.next()) != CMenu.TreeItemType.INVALID) {
            if (nextType == CMenu.TreeItemType.DIRECTORY) {
                dirs.push(iter.get_directory());
            }
        }

        let prefCats = ["administration", "preferences"];

        let sortDirs = function(a, b) {
            let menuIdA = a.get_menu_id().toLowerCase();
            let menuIdB = b.get_menu_id().toLowerCase();

            let prefIdA = prefCats.indexOf(menuIdA);
            let prefIdB = prefCats.indexOf(menuIdB);

            if (prefIdA < 0 && prefIdB >= 0) {
              return -1;
            }
            if (prefIdA >= 0 && prefIdB < 0) {
              return 1;
            }

            let nameA = a.get_name().toLowerCase();
            let nameB = b.get_name().toLowerCase();

            if (nameA > nameB) {
                return 1;
            }
            if (nameA < nameB) {
                return -1;
            }
            return 0;
        };

        dirs = dirs.sort(sortDirs);

        let handleEnterEvent = (categoryButton, dir) => {
            this._addEnterEvent(categoryButton, () => {
                if (!this.searchActive) {
                    categoryButton.isHovered = true;

                    this._clearPrevCatSelection(categoryButton.actor);
                    categoryButton.actor.style_class = "menu-category-button-selected";
                    this._select_category(dir.get_menu_id());

                    this.makeVectorBox(categoryButton.actor);
                }
            });
        };

        let handleLeaveEvent = (categoryButton, dir) => {
            categoryButton.actor.connect('leave-event', () => {
                if (this._previousTreeSelectedActor === null) {
                    this._previousTreeSelectedActor = categoryButton.actor;
                } else {
                    let prevIdx = this.catBoxIter.getVisibleIndex(this._previousTreeSelectedActor);
                    let nextIdx = this.catBoxIter.getVisibleIndex(categoryButton.actor);
                    if (Math.abs(prevIdx - nextIdx) <= 1) {
                        this._previousTreeSelectedActor = categoryButton.actor;
                    }
                }
                categoryButton.isHovered = false;
            });
        };

        for (let i = 0; i < dirs.length; i++) {
            let dir = dirs[i];
            if (dir.get_is_nodisplay())
                continue;
            if (this._loadCategory(dir)) {
                let categoryButton = new CategoryButton(dir, this.showCategoryIcons);
                handleEnterEvent(categoryButton, dir);
                handleLeaveEvent(categoryButton, dir);

              this._categoryButtons.push(categoryButton);
              this.categoriesBox.add_actor(categoryButton.actor);
            }
        }

        // Sort apps and add to applicationsBox
        this._applicationsButtons.sort(function(a, b) {
            a = Util.latinise(a.app.get_name().toLowerCase());
            b = Util.latinise(b.app.get_name().toLowerCase());
            return a > b;
        });

        for (let i = 0; i < this._applicationsButtons.length; i++) {
            this.applicationsBox.add_actor(this._applicationsButtons[i].actor);
            this.applicationsBox.add_actor(this._applicationsButtons[i].menu.actor);
        }

        this._appsWereRefreshed = true;
    },

    _favEnterEvent : function(button) {
        button.actor.add_style_pseudo_class("hover");
        if (button instanceof FavoritesButton) {
            this.selectedAppTitle.set_text(button.app.get_name());
            if (button.app.get_description())
                this.selectedAppDescription.set_text(button.app.get_description().split("\n")[0]);
            else
                this.selectedAppDescription.set_text("");
        } else {
            this.selectedAppTitle.set_text(button.name);
            this.selectedAppDescription.set_text(button.desc);
        }
    },

    _favLeaveEvent : function(widget, event, button) {
        this._previousSelectedActor = button.actor;
        button.actor.remove_style_pseudo_class("hover");
        this.selectedAppTitle.set_text("");
        this.selectedAppDescription.set_text("");
    },

    _refreshFavs : function() {
        //Remove all favorites
        this.favoritesBox.destroy_all_children();

        //Load favorites again
        this._favoritesButtons = [];
        let launchers = global.settings.get_strv('favorite-apps');
        let appSys = Cinnamon.AppSystem.get_default();
        for ( let i = 0; i < launchers.length; ++i ) {
            let app = appSys.lookup_app(launchers[i]);
            if (app) {
                let button = new FavoritesButton(this, app, launchers.length, this.favorite_button_size, this.showFavoriteIcons, this.showContextMenuIcons); // + 3 because we're adding 3 system buttons at the bottom
                this._favoritesButtons[app] = button;
                this.favoritesBox.add(button.actor, { y_align: St.Align.END, y_fill: false });
                this.favoritesBox.add(button.menu.actor, { y_align: St.Align.END, y_fill: false });

                this._addEnterEvent(button, Lang.bind(this, this._favEnterEvent, button));
                button.actor.connect('leave-event', Lang.bind(this, this._favLeaveEvent, button));
            }
        }
    },

    _loadCategory: function(dir, top_dir) {
        var iter = dir.iter();
        var has_entries = false;
        var nextType;
        if (!top_dir) top_dir = dir;
        while ((nextType = iter.next()) != CMenu.TreeItemType.INVALID) {
            if (nextType == CMenu.TreeItemType.ENTRY) {
                var entry = iter.get_entry();
                if (!entry.get_app_info().get_nodisplay()) {
                    has_entries = true;
                    var app = appsys.lookup_app(entry.get_desktop_file_id());
                    var app_key = app.get_id();
                    if (app_key == null) {
                        app_key = app.get_name() + ":" +
                            app.get_description();
                    }
                    if (!(app_key in this._applicationsButtonFromApp)) {

                        let applicationButton = new ApplicationButton(this, app, this.showApplicationIcons, this.showContextMenuIcons, this.showAppsDescriptionOnButtons);

                        var app_is_known = false;
                        for (var i = 0; i < this._knownApps.length; i++) {
                            if (this._knownApps[i] == app_key) {
                                app_is_known = true;
                            }
                        }
                        if (!app_is_known) {
                            if (this._appsWereRefreshed) {
                                applicationButton.highlight();
                            }
                            else {
                                this._knownApps.push(app_key);
                            }
                        }

                        applicationButton.actor.connect('leave-event', Lang.bind(this, this._appLeaveEvent, applicationButton));
                        this._addEnterEvent(applicationButton, Lang.bind(this, this._appEnterEvent, applicationButton));
                        this._applicationsButtons.push(applicationButton);
                        applicationButton.category.push(top_dir.get_menu_id());
                        this._applicationsButtonFromApp[app_key] = applicationButton;
                    } else {
                        this._applicationsButtonFromApp[app_key].category.push(dir.get_menu_id());
                    }
                }
            } else if (nextType == CMenu.TreeItemType.DIRECTORY) {
                let subdir = iter.get_directory();
                if (this._loadCategory(subdir, top_dir)) {
                    has_entries = true;
                }
            }
        }
        return has_entries;
    },

    _appLeaveEvent: function(a, b, applicationButton) {
        this._previousSelectedActor = applicationButton.actor;
        applicationButton.actor.style_class = "menu-application-button";
        this.selectedAppTitle.set_text("");
        this.selectedAppDescription.set_text("");
    },

    _appEnterEvent: function(applicationButton) {
        this.selectedAppTitle.set_text(applicationButton.app.get_name());
        if (applicationButton.app.get_description())
            this.selectedAppDescription.set_text(applicationButton.app.get_description());
        else
            this.selectedAppDescription.set_text("");
        this._previousVisibleIndex = this.appBoxIter.getVisibleIndex(applicationButton.actor);
        this._clearPrevSelection(applicationButton.actor);
        applicationButton.actor.style_class = "menu-application-button-selected";
    },

    _scrollToButton: function(button) {
        var current_scroll_value = this.applicationsScrollBox.get_vscroll_bar().get_adjustment().get_value();
        var box_height = this.applicationsScrollBox.get_allocation_box().y2-this.applicationsScrollBox.get_allocation_box().y1;
        var new_scroll_value = current_scroll_value;
        if (current_scroll_value > button.actor.get_allocation_box().y1-10) new_scroll_value = button.actor.get_allocation_box().y1-10;
        if (box_height+current_scroll_value < button.actor.get_allocation_box().y2+10) new_scroll_value = button.actor.get_allocation_box().y2-box_height+10;
        if (new_scroll_value!=current_scroll_value) this.applicationsScrollBox.get_vscroll_bar().get_adjustment().set_value(new_scroll_value);
    },

    _scrollToCategoryButton: function(button) {
        var current_scroll_value = this.categoriesScrollBox.get_vscroll_bar().get_adjustment().get_value();
        var box_height = this.categoriesScrollBox.get_allocation_box().y2 - this.categoriesScrollBox.get_allocation_box().y1;
        var new_scroll_value = current_scroll_value;
        if (current_scroll_value > button.actor.get_allocation_box().y1 - 10) new_scroll_value = button.actor.get_allocation_box().y1 - 10;
        if (box_height + current_scroll_value < button.actor.get_allocation_box().y2 + 10) new_scroll_value = button.actor.get_allocation_box().y2 - box_height + 10;
        if (new_scroll_value != current_scroll_value) this.categoriesScrollBox.get_vscroll_bar().get_adjustment().set_value(new_scroll_value);
    },

    _display : function() {
        this._activeContainer = null;
        this._activeActor = null;
        this.vectorBox = null;
        this.actor_motion_id = 0;
        this.vector_update_loop = null;
        this.current_motion_actor = null;
        let section = new PopupMenu.PopupMenuSection();
        this.menu.addMenuItem(section);
        this._appsBoxWidthResized = false;

        this.leftPane = new St.Bin();

        this.favsBox = new St.BoxLayout({ vertical: true });
        this.favsBox.style = "min-height: 300px;min-width: 235px;";

        this.appsBox = new St.BoxLayout({ vertical: true });

        this.searchBox = new St.BoxLayout({ style_class: 'starkmenu-search-box' });

        this.searchEntry = new St.Entry({ name: 'menu-search-entry',
                                     hint_text: _("Type to search..."),
                                     track_hover: true,
                                     can_focus: true });
        this.searchEntry.set_secondary_icon(this._searchInactiveIcon);
        this.searchActive = false;
        this.searchEntryText = this.searchEntry.clutter_text;
        this.searchEntryText.connect('text-changed', Lang.bind(this, this._onSearchTextChanged));
        this.searchEntryText.connect('key-press-event', Lang.bind(this, this._onMenuKeyPress));
        this._previousSearchPattern = "";

        this.categoriesOverlayBox = new Clutter.Actor();
        this.categoriesApplicationsBox = new CategoriesApplicationsBox();
        this.categoriesOverlayBox.add_actor(this.categoriesApplicationsBox.actor);
        this.appsBox.add_actor(this.categoriesOverlayBox);
        this.categoriesBox = new St.BoxLayout({ style_class: 'menu-categories-box',
                                                vertical: true,
                                                accessible_role: Atk.Role.LIST });
        this.applicationsScrollBox = new St.ScrollView({ x_fill: true, y_fill: false, y_align: St.Align.START, style_class: 'vfade menu-applications-scrollbox' });

        this.categoriesScrollBox = new St.ScrollView({ x_fill: true, y_fill: false, y_align: St.Align.START, style_class: 'vfade menu-applications-scrollbox' });

        this.a11y_settings = new Gio.Settings({ schema_id: "org.cinnamon.desktop.a11y.applications" });
        this.a11y_settings.connect("changed::screen-magnifier-enabled", Lang.bind(this, this._updateVFade));
        this.a11y_mag_settings = new Gio.Settings({ schema_id: "org.cinnamon.desktop.a11y.magnifier" });
        this.a11y_mag_settings.connect("changed::mag-factor", Lang.bind(this, this._updateVFade));

        this._updateVFade();

        this.settings.bind("enable-autoscroll", "autoscroll_enabled", this._update_autoscroll);
        this._update_autoscroll();

        this.settings.bind("favorite-button-size", "favorite_button_size", this._refreshFavs);

        let vscroll = this.applicationsScrollBox.get_vscroll_bar();
        vscroll.connect('scroll-start',
                        Lang.bind(this, function() {
                                      this.menu.passEvents = true;
                                  }));
        vscroll.connect('scroll-stop',
                        Lang.bind(this, function() {
                                      this.menu.passEvents = false;
                                  }));

        let vscrollCat = this.categoriesScrollBox.get_vscroll_bar();
        vscrollCat.connect('scroll-start',
                        Lang.bind(this, function() {
                                      this.menu.passEvents = true;
                                  }));
        vscrollCat.connect('scroll-stop',
                        Lang.bind(this, function() {
                                       this.menu.passEvents = false;
                                  }));

        this.applicationsBox = new St.BoxLayout({ style_class: 'menu-applications-inner-box', vertical:true });
        this.applicationsBox.add_style_class_name('menu-applications-box'); //this is to support old themes
        this.applicationsBox.add_style_class_name('starkmenu-applications-inner-box');
        this.applicationsScrollBox.add_actor(this.applicationsBox);
        this.categoriesScrollBox.add_actor(this.categoriesBox);
        this.applicationsScrollBox.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC);
        this.categoriesScrollBox.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC);
        this.categoriesApplicationsBox.actor.add_actor(this.categoriesScrollBox);
        this.categoriesApplicationsBox.actor.add_actor(this.applicationsScrollBox);

        let fav_obj = new FavoritesBox();
        this.favoritesBox = fav_obj.actor;
        this.favsBox.add(this.favoritesBox, { y_align: St.Align.END, y_fill: false });

        this.separator = new PopupMenu.PopupSeparatorMenuItem();

        this.appsButton = new AllProgramsItem("", "go-next", this);
        this.resultsFoundButton = new ResultsFoundItem("5 results found", "edit-find", this, false);
        this.resultsFoundButton.actor.hide();

        this.leftPaneBox = new St.BoxLayout({
            style_class: 'menu-favorites-box',
            vertical: true
        });
        this.leftPaneBox.add_style_class_name("starkmenu-favorites-box");

        this.rightButtonsBox = new RightButtonsBox(this, this.menu);

        this.rightButtonsBox.actor.style_class = "right-buttons-box";

        this.mainBox = new St.BoxLayout({ style_class: 'menu-applications-outer-box', vertical:false });
        this.mainBox.add_style_class_name('menu-applications-box'); //this is to support old themes
        this.mainBox.add_style_class_name("starkmenu-applications-box");

        this.leftPane.set_child(this.favsBox);

        this.selectedAppBox = new St.BoxLayout({ style_class: 'menu-selected-app-box', vertical: true });
        //this.selectedAppBox.add_style_class_name("starkmenu-selected-app-box");

        //if (this.selectedAppBox.peek_theme_node() == null ||
        //    this.selectedAppBox.get_theme_node().get_length('height') == 0)
        //    this.selectedAppBox.set_height(30 * global.ui_scale);

        this.favExpandBin = new St.Bin();

        this.selectedAppTitle = new St.Label({ style_class: 'menu-selected-app-title', text: "" });
        this.selectedAppBox.add_actor(this.selectedAppTitle);
        this.selectedAppDescription = new St.Label({ style_class: 'menu-selected-app-description', text: "" });
        this.selectedAppBox.add_actor(this.selectedAppDescription);
        this.selectedAppBox._delegate = null;
        //this.appsBox.add_actor(this.selectedAppBox);
        this.searchBox.add_actor(this.searchEntry);
        this.leftPaneBox.add_actor(this.leftPane);
        this.leftPaneBox.add(this.favExpandBin, { expand: true });
        this.leftPaneBox.add_actor(this.separator.actor);
        this.leftPaneBox.add_actor(this.appsButton.actor);
        this.leftPaneBox.add_actor(this.resultsFoundButton.actor);
        this.leftPaneBox.add_actor(this.searchBox);
        this.mainBox.add(this.leftPaneBox);
        this.mainBox.add(this.rightButtonsBox.actor);
        this.mainBox._delegate = null;
        section.actor.add(this.mainBox);
        //section.actor.add_actor(this.selectedAppBox);

        this.appBoxIter = new VisibleChildIterator(this.applicationsBox);
        this.applicationsBox._vis_iter = this.appBoxIter;
        this.catBoxIter = new VisibleChildIterator(this.categoriesBox);
        this.categoriesBox._vis_iter = this.catBoxIter;
        this.favBoxIter = new VisibleChildIterator(this.favoritesBox);
        this.favoritesBox._vis_iter = this.favBoxIter;
        Mainloop.idle_add(Lang.bind(this, function() {
            this._clearAllSelections(false);
        }));
    },

    _updateMenuLayout: function() {
        this.mainBox.remove_actor(this.rightButtonsBox.actor);
        this.mainBox.remove_actor(this.leftPaneBox);
        if(this.menuLayout == "mate-menu") {
            this.rightButtonsBox.actor.set_style("padding-right: 8px;");
            this.mainBox.add_actor(this.rightButtonsBox.actor);
            this.mainBox.add_actor(this.leftPaneBox);
        } else {
            this.rightButtonsBox.actor.set_style("padding-left: 8px;");
            this.mainBox.add_actor(this.leftPaneBox);
            this.mainBox.add_actor(this.rightButtonsBox.actor);
        }
    },

    switchPanes: function(pane) {
        if (pane == "apps") {
            this.leftPane.set_child(this.appsBox);
            this.separator.actor.hide();
            if (this.favoritesLabel != "")
                this.appsButton.label.set_text(_(this.favoritesLabel));
            else
                this.appsButton.label.set_text("");
            this.appsButton.icon.set_icon_name("go-previous");
            if(this.menuLayout == "stark-menu")
                this.rightButtonsBox.actor.hide();
            if (!this._appsBoxWidthResized) {
                this._resizeAppsBoxWidth();
                this._appsBoxWidthResized = true;
            }
            this._resizeAppsBoxHeight();
            visiblePane = "apps";
            if (this._previousTreeSelectedActor == null)
                this._allAppsCategoryButton.actor.style_class = "menu-category-button-selected";
        } else {
            this.leftPane.set_child(this.favsBox);
            this.separator.actor.show();
            if (this.allProgramsLabel != "")
                this.appsButton.label.set_text(_(this.allProgramsLabel));
            else
                this.appsButton.label.set_text("");
            this.appsButton.icon.set_icon_name("go-next");
            if (this.menu.showSidebar) {
                this.rightButtonsBox.actor.show();
            }
            this._resizeAppsBoxHeight();
            visiblePane = "favs";
            if (this._previousTreeSelectedActor == null)
                this._allAppsCategoryButton.actor.style_class = "menu-category-button-selected";
        }
    },

    _updateVFade: function() {
        let mag_on = this.a11y_settings.get_boolean("screen-magnifier-enabled") &&
                     this.a11y_mag_settings.get_double("mag-factor") > 1.0;
        if (mag_on) {
            this.applicationsScrollBox.style_class = "menu-applications-scrollbox";
            this.categoriesScrollBox.style_class = "menu-applications-scrollbox";
        } else {
            this.applicationsScrollBox.style_class = "vfade menu-applications-scrollbox";
            this.categoriesScrollBox.style_class = "vfade menu-applications-scrollbox";
        }
    },

    _update_autoscroll: function() {
        this.applicationsScrollBox.set_auto_scrolling(this.autoscroll_enabled);
        this.categoriesScrollBox.set_auto_scrolling(this.autoscroll_enabled);
    },

    _clearAllSelections: function(hide_apps) {
        let actors = this.applicationsBox.get_children();
        for (let i = 0; i < actors.length; i++) {
            let actor = actors[i];
            actor.style_class = "menu-application-button";
            if (hide_apps) {
                actor.hide();
            }
        }
        actors = this.categoriesBox.get_children();
        for (let i = 0; i < actors.length; i++){
            let actor = actors[i];
            actor.style_class = "menu-category-button";
            actor.show();
        }
        actors = this.favoritesBox.get_children();
        for (let i = 0; i < actors.length; i++){
            let actor = actors[i];
            actor.remove_style_pseudo_class("hover");
            if (hide_apps) {
                actor.hide();
            }
        }
    },

    _select_category : function(name) {
        if (name === this.lastSelectedCategory) {
            return;
        }

        this.lastSelectedCategory = name;

        if (name === "places") {
            this._displayButtons(null, -1);
        } else
        if (name === "recent") {
            this._displayButtons(null, null, -1);
        } else
        if (name == null) {
            this._displayButtons(this._listApplications(null));
        } else
        {
            this._displayButtons(this._listApplications(name));
        }

        this.closeContextMenus(null, false);
    },

    closeContextMenus: function(excluded, animate) {
        for (let app in this._applicationsButtons){
            if (this._applicationsButtons[app] != excluded && this._applicationsButtons[app].menu.isOpen){
                if (animate)
                    this._applicationsButtons[app].toggleMenu();
                else
                    this._applicationsButtons[app].closeMenu();
            }
        }

        for (let app in this._favoritesButtons){
            if (this._favoritesButtons[app] != excluded && this._favoritesButtons[app].menu.isOpen){
                if (animate)
                    this._favoritesButtons[app].toggleMenu();
                else
                    this._favoritesButtons[app].closeMenu();
            }
        }

        if (!this.recentContextMenu) {
            return;
        }

        let item = this.recentContextMenu.sourceActor._delegate;

        if ((item != excluded || excluded == null) && item.menu && item.menu.isOpen) {
            if (animate)
                this.recentContextMenu.toggle();
            else
                this.recentContextMenu.close();
            this._activeContextMenuParent = null;
            this._activeContextMenuItem = null;
        }

    },

    _displayButtons: function(appCategory, places, recent, apps, autocompletes){
        let innerapps = this.applicationsBox.get_children();
        for (var i in innerapps) {
            innerapps[i].hide();
        }
        if (appCategory) {
            if (appCategory == "all") {
                this._applicationsButtons.forEach( function (item, index) {
                    item.actor.show();
                });
            } else {
                this._applicationsButtons.forEach( function (item, index) {
                    if (item.category.indexOf(appCategory) != -1) {
                            item.actor.show();
                    } else {
                            item.actor.hide();
                    }
                });
            }
        } else if (apps) {
            for (let i = 0; i < this._applicationsButtons.length; i++) {
                    if (apps.indexOf(this._applicationsButtons[i].app.get_id()) != -1) {
                            this._applicationsButtons[i].actor.show();
                    } else {
                            this._applicationsButtons[i].actor.hide();
                    }
            }
        } else {
            this._applicationsButtons.forEach( function (item, index) {
                        item.actor.hide();
            });
        }
        if (places) {
            if (places == -1) {
                this._placesButtons.forEach( function (item, index) {
                   item.actor.show();
                });
            } else {
                for (let i = 0; i < this._placesButtons.length; i++) {
                    if (places.indexOf(this._placesButtons[i].button_name) != -1) {
                            this._placesButtons[i].actor.show();
                    } else {
                            this._placesButtons[i].actor.hide();
                    }
                }
            }
        } else {
            this._placesButtons.forEach( function (item, index) {
                        item.actor.hide();
            });
        }
        if (recent) {
            if (recent == -1) {
                this._recentButtons.forEach( function (item, index) {
                        item.actor.show();
                });
            } else {
                for (let i = 0; i < this._recentButtons.length; i++) {
                    if (recent.indexOf(this._recentButtons[i].button_name) != -1) {
                            this._recentButtons[i].actor.show();
                    } else {
                            this._recentButtons[i].actor.hide();
                    }
                }
            }
        } else {
            this._recentButtons.forEach( function (item, index) {
                        item.actor.hide();
            });
        }
        if (autocompletes) {

            this._transientButtons.forEach( function (item, index) {
                item.actor.destroy();
            });
            this._transientButtons = [];

            for (let i = 0; i < autocompletes.length; i++) {
                let button = new TransientButton(this, autocompletes[i]);
                button.actor.connect('leave-event', Lang.bind(this, this._appLeaveEvent, button));
                this._addEnterEvent(button, Lang.bind(this, this._appEnterEvent, button));
                this._transientButtons.push(button);
                this.applicationsBox.add_actor(button.actor);
                button.actor.realize();
            }
        }

        this._searchProviderButtons.forEach( function (item, index) {
            if (item.actor.visible) {
                item.actor.hide();
            }
        });
    },

    _setCategoriesButtonActive: function(active) {
        try {
            let categoriesButtons = this.categoriesBox.get_children();
            for (var i in categoriesButtons) {
                let button = categoriesButtons[i];
                if (active){
                    button.set_style_class_name("menu-category-button");
                } else {
                    button.set_style_class_name("menu-category-button-greyed");
                }
             }
        } catch (e) {
            global.log(e);
        }
     },

     resetSearch: function(){
        this.searchEntry.set_text("");
        this._previousSearchPattern = "";
        this.searchActive = false;
        this._clearAllSelections(false);
        this._setCategoriesButtonActive(true);
        global.stage.set_key_focus(this.searchEntry);
     },

     _onSearchTextChanged: function (se, prop) {
        if (this.menuIsOpening) {
            this.menuIsOpening = false;
            return;
        } else {
            let searchString = this.searchEntry.get_text();
            if (searchString == '' && !this.searchActive)
                return;
            this.searchActive = searchString != '';
            this._fileFolderAccessActive = this.searchActive && this.searchFilesystem;
            this._clearAllSelections();

            if (this.searchActive) {
                this.searchEntry.set_secondary_icon(this._searchActiveIcon);
                if (this._searchIconClickedId == 0) {
                    this._searchIconClickedId = this.searchEntry.connect('secondary-icon-clicked',
                        Lang.bind(this, function() {
                            this.resetSearch();
                            this._select_category(null);
                        }));
                }
                this._setCategoriesButtonActive(false);
                this._doSearch();
                this.appsButton.actor.hide();
                this.resultsFoundButton.actor.show();
            } else {
                if (this._searchIconClickedId > 0)
                    this.searchEntry.disconnect(this._searchIconClickedId);
                this._searchIconClickedId = 0;
                this.searchEntry.set_secondary_icon(this._searchInactiveIcon);
                this._previousSearchPattern = "";
                this._setCategoriesButtonActive(true);
                this._select_category(null);
                this._allAppsCategoryButton.actor.style_class = "menu-category-button-selected";
                this._activeContainer = null;
                this.selectedAppTitle.set_text("");
                this.selectedAppDescription.set_text("");
                this.appsButton.actor.show();
                this.resultsFoundButton.actor.hide();
            }
            return;
        }
    },

    _listBookmarks: function(pattern){
       let bookmarks = Main.placesManager.getBookmarks();
       var res = [];
       for (let id = 0; id < bookmarks.length; id++) {
          if (!pattern || bookmarks[id].name.toLowerCase().indexOf(pattern)!=-1) res.push(bookmarks[id]);
       }
       return res;
    },

    _listDevices: function(pattern){
       let devices = Main.placesManager.getMounts();
       var res = [];
       for (let id = 0; id < devices.length; id++) {
          if (!pattern || devices[id].name.toLowerCase().indexOf(pattern)!=-1) res.push(devices[id]);
       }
       return res;
    },

    _listApplications: function(category_menu_id, pattern){
        var applist = [];
        if (category_menu_id) {
            applist = category_menu_id;
        } else {
            applist = "all";
        }
        let res;
        if (pattern){
            res = [];
            for (var i in this._applicationsButtons) {
                let app = this._applicationsButtons[i].app;
                if (Util.latinise(app.get_name().toLowerCase()).indexOf(pattern)!=-1 ||
                    (app.get_description() && Util.latinise(app.get_description().toLowerCase()).indexOf(pattern)!=-1) ||
                    (app.get_id() && Util.latinise(app.get_id().slice(0, -8).toLowerCase()).indexOf(pattern)!=-1))
                         res.push(app.get_id());
            }
        } else res = applist;
        return res;
    },

    _doSearch: function(){
        if (this.leftPane.get_child() == this.favsBox)
            this.switchPanes("apps");
        this._searchTimeoutId = 0;
        let pattern = this.searchEntryText.get_text().replace(/^\s+/g, '').replace(/\s+$/g, '').toLowerCase();
        pattern = Util.latinise(pattern);
        if (pattern==this._previousSearchPattern) return false;
        this._previousSearchPattern = pattern;
        this._activeContainer = null;
        this._activeActor = null;
        this._selectedItemIndex = null;
        this._previousTreeSelectedActor = null;
        this._previousSelectedActor = null;

       // _listApplications returns all the applications when the search
       // string is zero length. This will happened if you type a space
       // in the search entry.
        if (pattern.length == 0) {
            return false;
        }

        var appResults = this._listApplications(null, pattern);
        var placesResults = [];
        var bookmarks = this._listBookmarks(pattern);
        for (let i in bookmarks)
            placesResults.push(bookmarks[i].name);
        var devices = this._listDevices(pattern);
        for (let i in devices)
            placesResults.push(devices[i].name);
        var recentResults = [];
        for (let i = 0; i < this._recentButtons.length; i++) {
            if (!(this._recentButtons[i] instanceof RecentClearButton) && this._recentButtons[i].button_name.toLowerCase().indexOf(pattern) != -1)
                recentResults.push(this._recentButtons[i].button_name);
        }

        var acResults = []; // search box autocompletion results
        if (this.searchFilesystem) {
            // Don't use the pattern here, as filesystem is case sensitive
            acResults = this._getCompletions(this.searchEntryText.get_text());
        }

        this._displayButtons(null, placesResults, recentResults, appResults, acResults);

        let numberResults = appResults.length + placesResults.length + recentResults.length + acResults.length;
        if (numberResults == 0)
            this.resultsFoundButton.label.set_text(_("No results found"));
        else
            this.resultsFoundButton.label.set_text(Gettext.dngettext(UUID, "%d result found", "%d results found", numberResults).format(numberResults));

        this.appBoxIter.reloadVisible();
        if (this.appBoxIter.getNumVisibleChildren() > 0) {
            let item_actor = this.appBoxIter.getFirstVisible();
            this._selectedItemIndex = this.appBoxIter.getAbsoluteIndexOfChild(item_actor);
            this._activeContainer = this.applicationsBox;
            if (item_actor && item_actor != this.searchEntry) {
                item_actor._delegate.emit('enter-event');
            }
        } else {
            this.selectedAppTitle.set_text("");
            this.selectedAppDescription.set_text("");
        }

        SearchProviderManager.launch_all(pattern, Lang.bind(this, function(provider, results){
            try{
            for (var i in results){
                if (results[i].type != 'software')
                {
                    let button = new SearchProviderResultButton(this, provider, results[i]);
                    button.actor.connect('leave-event', Lang.bind(this, this._appLeaveEvent, button));
                    this._addEnterEvent(button, Lang.bind(this, this._appEnterEvent, button));
                    this._searchProviderButtons.push(button);
                    this.applicationsBox.add_actor(button.actor);
                    button.actor.realize();
                }
            }
            }catch(e){global.log(e);}
        }));

        return false;
    },

    _getCompletion : function(text) {
        if (text.indexOf('/') != -1) {
            if (text.substr(text.length - 1) == '/') {
                return '';
            } else {
                return this._pathCompleter.get_completion_suffix(text);
            }
        } else {
            return false;
        }
    },

    _getCompletions : function(text) {
        if (text.indexOf('/') != -1) {
            return this._pathCompleter.get_completions(text);
        } else {
            return [];
        }
    },

    _run : function(input) {
        this._commandError = false;
        if (input) {
            let path = null;
            if (input.charAt(0) == '/') {
                path = input;
            } else {
                if (input.charAt(0) == '~')
                    input = input.slice(1);
                path = GLib.get_home_dir() + '/' + input;
            }

            if (GLib.file_test(path, GLib.FileTest.EXISTS)) {
                let file = Gio.file_new_for_path(path);
                try {
                    Gio.app_info_launch_default_for_uri(file.get_uri(),
                                                        global.create_app_launch_context());
                } catch (e) {
                    // The exception from gjs contains an error string like:
                    //     Error invoking Gio.app_info_launch_default_for_uri: No application
                    //     is registered as handling this file
                    // We are only interested in the part after the first colon.
                    //let message = e.message.replace(/[^:]*: *(.+)/, '$1');
                    return false;
                }
            } else {
                return false;
            }
        }

        return true;
    }
};

function main(metadata, orientation, panel_height, instance_id) {
    let myApplet = new MyApplet(orientation, panel_height, instance_id);
    return myApplet;
}
