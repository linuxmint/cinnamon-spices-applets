const Applet = imports.ui.applet;
const Mainloop = imports.mainloop;
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
const AccountsService = imports.gi.AccountsService;
const SearchProviderManager = imports.ui.searchProviderManager;
const SignalManager = imports.misc.signalManager;
const Params = imports.misc.params;

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

const AppUtils = require('./appUtils');

let appsys = Cinnamon.AppSystem.get_default();
let visiblePane = "favs";
const RefreshFlags = Object.freeze({
    APP:    0b00001,
    FAV:    0b00010,
    PLACE:  0b00100,
    RECENT: 0b01000,
    SYSTEM: 0b10000
});
const REFRESH_ALL_MASK = 0b11111;

const NO_MATCH = 99999;
const APP_MATCH_ADDERS = [
    0, // name
    1000, // keywords
    2000, // desc
    3000 // id
];
const RECENT_PLACES_ADDER = 4000;

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

    getNextVisible(curChild) {
        return this.getVisibleItem(this.array.indexOf(curChild) + 1);
    }

    getPrevVisible(curChild) {
        return this.getVisibleItem(this.array.indexOf(curChild) - 1);
    }

    getFirstVisible() {
        return this.array[0];
    }

    getLastVisible() {
        return this.array[this.array.length - 1];
    }

    getVisibleIndex(curChild) {
        return this.array.indexOf(curChild);
    }

    getVisibleItem(index) {
        let len = this.array.length;
        index = ((index % len) + len) % len;
        return this.array[index];
    }

    getNumVisibleChildren() {
        return this.array.length;
    }

    getAbsoluteIndexOfChild(child) {
        return this.container.get_children().indexOf(child);
    }
}

/**
 * SimpleMenuItem type strings in use:
 * -------------------------------------------------
 * app              ApplicationButton
 * category         CategoryButton
 * fav              FavoritesButton
 * no-recent        "No recent documents" button
 * none             Default type
 * place            PlaceButton
 * recent           RecentsButton
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
 * @param {boolean} params.reactive    - Item recieves events.
 * @param {boolean} params.activatable - Activates via primary click. Must provide an 'activate' function on
 *                                       the prototype or instance.
 * @param {boolean} params.withMenu    - Shows menu via secondary click. Must provide a 'populateMenu' function
 *                                       on the prototype or instance.
 */
class SimpleMenuItem {
    constructor(applet, params) {
        params = Params.parse(params, SMI_DEFAULT_PARAMS, true);
        this._signals = new SignalManager.SignalManager();

        this.actor = new St.BoxLayout({ style_class: params.styleClass,
                                        style: MAX_BUTTON_WIDTH,
                                        reactive: params.reactive,
                                        accessible_role: Atk.Role.MENU_ITEM });

        this._signals.connect(this.actor, 'destroy', () => this.destroy(true));

        this.actor._delegate = this;
        this.applet = applet;
        this.label = null;
        this.icon = null;

        this.matchIndex = NO_MATCH;

        for (let prop in params)
            this[prop] = params[prop];

        if (params.reactive) {
            this._signals.connect(this.actor, 'enter-event', () => applet._buttonEnterEvent(this));
            this._signals.connect(this.actor, 'leave-event', () => applet._buttonLeaveEvent(this));
            if (params.activatable || params.withMenu) {
                this._signals.connect(this.actor, 'button-release-event', Lang.bind(this, this._onButtonReleaseEvent));
                this._signals.connect(this.actor, 'key-press-event', Lang.bind(this, this._onKeyPressEvent));
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
             symbol === Clutter.KP_Enter)) {
            this.activate();
            return Clutter.EVENT_STOP;
        }
        return Clutter.EVENT_PROPAGATE;
    }

    /**
     * Adds an StIcon as the next child, acessible as `this.icon`.
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
     * Removes the icon previously added with addIcon()
     */
    removeIcon() {
        if (!this.icon)
            return;
        this.icon.destroy();
        this.icon = null;
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

        this.label = new St.Label({ text: label, y_expand: true, y_align: Clutter.ActorAlign.CENTER });
        if (styleClass)
            this.label.set_style_class_name(styleClass);
        this.label.clutter_text.ellipsize = Pango.EllipsizeMode.END;
        this.actor.add_actor(this.label);
    }

    addDescription(appName, appDescription) {
        if (appDescription == '')
            appDescription = _("No description available");
        this.label.get_clutter_text().set_markup(appName.replace(/\&/g, "&amp;").replace(/\</g, "&lt;").replace(/\>/g, "&gt;") + '\n' + '<span size="small">'
                                                 + appDescription.replace(/\&/g, "&amp;").replace(/\</g, "&lt;").replace(/\>/g, "&gt;") + '</span>');
    }

    /**
     * Removes the label previously added with addLabel()
     */
    removeLabel() {
        if (!this.label)
            return;
        this.label.destroy();
        this.label = null;
    }

    /**
     * Adds a ClutterActor as the next child.
     *
     * @param {ClutterActor} child
     */
    addActor(child) {
        this.actor.add_actor(child);
    }

    /**
     * Removes a ClutterActor.
     *
     * @param {ClutterActor} child
     */
    removeActor(child) {
        this.actor.remove_actor(child);
    }

    destroy(actorDestroySignal=false) {
        this._signals.disconnectAllSignals();

        if (this.label)
            this.label.destroy();
        if (this.icon)
            this.icon.destroy();
        if (!actorDestroySignal)
            this.actor.destroy();

        delete this.actor._delegate;
        delete this.actor;
        delete this.label;
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
            this.icon = new St.Icon({ icon_name: iconName, icon_size: 12, icon_type: St.IconType.SYMBOLIC });
            if (this.icon)
                this.addActor(this.icon);
        }

        this.addActor(this.label);
    }

    activate (event) {
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
                break;
            case "remove_from_favorites":
                AppFavorites.getAppFavorites().removeFavorite(this._appButton.app.get_id());
                break;
            case "uninstall":
                Util.spawnCommandLine("/usr/bin/cinnamon-remove-application '" + this._appButton.app.get_app_info().get_filename() + "'");
                break;
            case "run_with_nvidia_gpu":
                Util.spawnCommandLine("optirun gtk-launch " + this._appButton.app.get_id());
                break;
            case "offload_launch":
                try {
                    this._appButton.app.launch_offloaded(0, [], -1);
                } catch (e) {
                    logError(e, "Could not launch app with dedicated gpu: ");
                }
                break;
            default:
                return true;
        }
        this._appButton.applet.toggleContextMenu(this._appButton);
        this._appButton.applet.menu.close();
        return false;
    }

}

class GenericApplicationButton extends SimpleMenuItem {
    constructor(applet, app, type, withMenu=false, styleClass="") {
        let desc = app.get_description() || "";
        super(applet, { name: app.get_name(),
                        description: desc.split("\n")[0],
                        type: type,
                        withMenu: withMenu,
                        styleClass: styleClass,
                        app: app });
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
            menuItem = new ApplicationContextMenuItem(this, _("Run with NVIDIA GPU"), "offload_launch", "cpu");
            menu.addMenuItem(menuItem);
        } else if (this.applet._isBumblebeeInstalled) {
            menuItem = new ApplicationContextMenuItem(this, _("Run with NVIDIA GPU"), "run_with_nvidia_gpu", "cpu");
            menu.addMenuItem(menuItem);
        }

        menuItem = new ApplicationContextMenuItem(this, _("Add to panel"), "add_to_panel", "list-add");
        menu.addMenuItem(menuItem);

        if (USER_DESKTOP_PATH){
            menuItem = new ApplicationContextMenuItem(this, _("Add to desktop"), "add_to_desktop", "computer");
            menu.addMenuItem(menuItem);
        }

        if (AppFavorites.getAppFavorites().isFavorite(this.app.get_id())){
            menuItem = new ApplicationContextMenuItem(this, _("Remove from favorites"), "remove_from_favorites", "starred");
            menu.addMenuItem(menuItem);
        } else {
            menuItem = new ApplicationContextMenuItem(this, _("Add to favorites"), "add_to_favorites", "non-starred");
            menu.addMenuItem(menuItem);
        }

        if (this.applet._canUninstallApps) {
            menuItem = new ApplicationContextMenuItem(this, _("Uninstall"), "uninstall", "edit-delete");
            menu.addMenuItem(menuItem);
        }
    }
}

class TransientButton extends SimpleMenuItem {
    constructor(applet, pathOrCommand) {
        super(applet, { description: pathOrCommand,
                        type: 'transient',
                        styleClass: 'menu-application-button' });
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

        if (applet.showApplicationIcons) {
            try {
                this.handler = this.file.query_default_handler(null);
                let contentType = Gio.content_type_guess(this.pathOrCommand, null);
                let themedIcon = Gio.content_type_get_icon(contentType[0]);
                this.icon = new St.Icon({gicon: themedIcon, icon_size: APPLICATION_ICON_SIZE, icon_type: St.IconType.FULLCOLOR });
            } catch (e) {
                this.handler = null;
                let iconName = this.isPath ? 'folder' : 'unknown';
                this.icon = new St.Icon({icon_name: iconName, icon_size: APPLICATION_ICON_SIZE, icon_type: St.IconType.FULLCOLOR});
                // @todo Would be nice to indicate we don't have a handler for this file.
            }

            this.addActor(this.icon);
        }

        this.addLabel(this.description, 'menu-application-button-label');

        this.isDraggableApp = false;
    }

    activate() {
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

        this.applet.menu.close();
    }
}

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

class ApplicationButton extends GenericApplicationButton {
    constructor(applet, app) {
        super(applet, app, 'app', true, 'menu-application-button');
        this.category = [];

        this.icon = this.app.create_icon_texture(APPLICATION_ICON_SIZE);
        this.addActor(this.icon);
        if (!applet.showApplicationIcons)
            this.icon.visible = false;

        this.addLabel(this.name, 'menu-application-button-label');

        if (applet.showAppsDescriptionOnButtons) {
            this.addDescription(this.name, this.description);
        }

        this._draggable = DND.makeDraggable(this.actor);
        this._signals.connect(this._draggable, 'drag-end', Lang.bind(this, this._onDragEnd));
        this.isDraggableApp = true;

        this.searchStrings = [
            Util.latinise(app.get_name().toLowerCase()),
            app.get_keywords() ? Util.latinise(app.get_keywords().toLowerCase()) : "",
            app.get_description() ? Util.latinise(app.get_description().toLowerCase()) : "",
            app.get_id() ? Util.latinise(app.get_id().toLowerCase()) : ""
        ];

        this.tooltip = new TooltipCustom(this.actor, this.description, true);
    }

    get_app_id() {
        return this.app.get_id();
    }

    getDragActor() {
        return this.app.create_icon_texture(APPLICATION_ICON_SIZE);
    }

    // Returns the original actor that should align with the actor
    // we show as the item is being dragged.
    getDragActorSource() {
        return this.actor;
    }

    _onDragEnd() {
        this.applet.favoritesBox._delegate._clearDragPlaceholder();
    }
    destroy() {
        delete this._draggable;
        super.destroy();
    }
}

class WebSearchButton extends SimpleMenuItem {
    constructor(applet, pattern, icon, searchEngine, url) {
        super(applet, { name: pattern,
                        description: _("Search for results on the web"),
                        type: 'web-search-engine',
                        styleClass: 'menu-application-button',
                        iconName : icon,
                        searchEngineName : searchEngine,
                        searchEngineURL : url });

        this.icon = new St.Icon({
            icon_type: St.IconType.FULLCOLOR,
            icon_name: 'web-browser',
            icon_size: APPLICATION_ICON_SIZE
        });

        if (Gtk.IconTheme.get_default().has_icon(this.iconName)) {
            this.icon.icon_name = this.iconName;
        }

        this.addActor(this.icon);
        if (!applet.showApplicationIcons)
            this.icon.visible = false;

        this.addLabel(this.name, 'menu-application-button-label');

        this.searchStrings = [
            Util.latinise(this.name.toLowerCase())
        ];

        this.tooltip = new TooltipCustom(this.actor, this.description, true);
    }

    changeLabel(pattern) {
        this.name = pattern;
        let searchLabel = pattern.replace(/\&/g, "&amp;").replace(/\</g, "&lt;").replace(/\>/g, "&gt;");
        if (this.searchEngineName != '')
            searchLabel += ' - ' + '<span size="small">' + this.searchEngineName + '</span>';
        this.label.clutter_text.set_markup(searchLabel);
        if (this.applet.showAppsDescriptionOnButtons) {
            this.addDescription(this.label.text, this.description);
        }
    }

    activate() {
        Main.Util.spawnCommandLine("xdg-open " + this.searchEngineURL + "'" + this.name.replace(/'/g,"%27") + "'");
        this.applet.menu.close();
    }
}

class SearchProviderResultButton extends SimpleMenuItem {
    constructor(applet, provider, result) {
        super(applet, { name:result.label,
                        description: result.description,
                        type: 'search-provider',
                        styleClass: 'menu-application-button',
                        provider: provider,
                        result: result });

        if (applet.showApplicationIcons) {
            if (result.icon) {
                this.icon = result.icon;
            } else if (result.icon_app) {
                this.icon = result.icon_app.create_icon_texture(APPLICATION_ICON_SIZE);
            } else if (result.icon_filename) {
                this.icon = new St.Icon({gicon: new Gio.FileIcon({file: Gio.file_new_for_path(result.icon_filename)}), icon_size: APPLICATION_ICON_SIZE});
            }

            if (this.icon)
                this.addActor(this.icon);
        }

        this.addLabel(result.label, 'menu-application-button-label');
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

        super(applet, { name: place.name,
                        description: selectedAppId,
                        type: 'place',
                        styleClass: 'menu-application-button',
                        place: place });

        this.icon = place.iconFactory(APPLICATION_ICON_SIZE);
        if (this.icon)
            this.addActor(this.icon);
        else
            this.addIcon(APPLICATION_ICON_SIZE, 'folder');

        if (!applet.showApplicationIcons)
            this.icon.visible = false;

        this.addLabel(this.name, 'menu-application-button-label');

        this.searchStrings = [
            Util.latinise(place.name.toLowerCase())
        ];

        if (applet.showAppsDescriptionOnButtons) {
            this.addDescription(this.name, this.description);
        }

        this.tooltip = new TooltipCustom(this.actor, this.description, true);
    }

    activate() {
        this.place.launch();
        this.applet.menu.close();
    }
}

class RecentContextMenuItem extends PopupMenu.PopupBaseMenuItem {
    constructor(recentButton, label, is_default, cbParams, callback) {
        super({focusOnHover: false});

        this._recentButton = recentButton;
        this._cbParams = cbParams;
        this._callback = callback;
        this.label = new St.Label({ text: label });
        this.addActor(this.label);

        if (is_default)
            this.label.style = "font-weight: bold;";
    }

    activate (event) {
        this._callback(...this._cbParams);
        return false;
    }
}

class RecentButton extends SimpleMenuItem {
    constructor(applet, recent) {
        let fileIndex = recent.uriDecoded.indexOf("file:///");
        let selectedAppUri = fileIndex === -1 ? "" : recent.uriDecoded.substr(fileIndex + 7);

        super(applet, { name: recent.name,
                        description: selectedAppUri,
                        type: 'recent',
                        styleClass: 'menu-application-button',
                        withMenu: true,
                        mimeType: recent.mimeType,
                        uri: recent.uri,
                        uriDecoded: recent.uriDecoded });

        this.icon = recent.createIcon(APPLICATION_ICON_SIZE);
        this.addActor(this.icon);
        if (!applet.showApplicationIcons)
            this.icon.visible = false;

        this.addLabel(this.name, 'menu-application-button-label');

        this.searchStrings = [
            Util.latinise(recent.name.toLowerCase())
        ];

        if (applet.showAppsDescriptionOnButtons) {
            this.addDescription(this.name, this.description);
        }
        this.tooltip = new TooltipCustom(this.actor, this.description, false);
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

    hasLocalPath(file) {
        return file.is_native() || file.get_path() != null;
    }

    populateMenu(menu) {
        let menuItem;
        menuItem = new PopupMenu.PopupMenuItem(_("Open with"), { reactive: false });
        menuItem.actor.style = "font-weight: bold";
        menu.addMenuItem(menuItem);

        let file = Gio.File.new_for_uri(this.uri);

        let default_info = Gio.AppInfo.get_default_for_type(this.mimeType, !this.hasLocalPath(file));

        let infoLaunchFunc = (info, file) => {
            info.launch([file], null);
            this.applet.toggleContextMenu(this);
            this.applet.menu.close();
        };

        if (default_info) {
            menuItem = new RecentContextMenuItem(this,
                                                 default_info.get_display_name(),
                                                 false,
                                                 [default_info, file],
                                                 infoLaunchFunc);
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
                                                 [info, file],
                                                 infoLaunchFunc);
            menu.addMenuItem(menuItem);
        }

        if (GLib.find_program_in_path ("nemo-open-with") != null) {
            menuItem = new RecentContextMenuItem(this,
                                                 _("Other application..."),
                                                 false,
                                                 [],
                                                 () => {
                                                     Util.spawnCommandLine("nemo-open-with " + this.uri);
                                                     this.applet.toggleContextMenu(this);
                                                     this.applet.menu.close();
                                                 });
            menu.addMenuItem(menuItem);
        }
    }
}

class CategoryButton extends SimpleMenuItem {
    constructor(applet, categoryId, label, icon) {
        super(applet, { name: label || _("All Applications"),
                        type: 'category',
                        styleClass: 'menu-category-button',
                        categoryId: categoryId });
        this.actor.accessible_role = Atk.Role.LIST_ITEM;

        if (typeof icon === 'string')
            this.addIcon(CATEGORY_ICON_SIZE, icon);
        else if (icon)
            this.addIcon(CATEGORY_ICON_SIZE, null, icon);

        if (this.icon && !applet.showCategoryIcons)
            this.icon.visible = false;

        this.addLabel(this.name, 'menu-category-button-label');
    }
}

class FavoritesButton extends GenericApplicationButton {
    constructor(applet, app, nbFavorites, iconSize, showIcon) {
        super(applet, app, 'fav', true, 'menu-favorites-button');
        let monitorHeight = Main.layoutManager.primaryMonitor.height;
        let real_size = (0.7 * monitorHeight) / nbFavorites;
        let icon_size = iconSize; //0.6*real_size;
        if (icon_size > MAX_FAV_ICON_SIZE)
            icon_size = MAX_FAV_ICON_SIZE;

    this.icon = app.create_icon_texture(icon_size);
        this.addActor(this.icon);
        if (!showIcon)
            this.icon.visible = false;


        this.addLabel(this.name, 'menu-application-button-label');

        this._draggable = DND.makeDraggable(this.actor);
        this._signals.connect(this._draggable, 'drag-end', Lang.bind(this, this._onDragEnd));
        this.isDraggableApp = true;

        if (applet.showAppsDescriptionOnButtons) {
            this.addDescription(this.name, this.description);
        }

        this.tooltip = new TooltipCustom(this.actor, this.description, true);
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

class TextBoxItem extends AppPopupSubMenuMenuItem {
    constructor(label, description, icon, func, parent, hoverIcon, addStyleClassName) {
        super(label);
        this.parent = parent;
        this.hoverIcon = hoverIcon;
        this.icon = icon;
        this.func = func;
        this.active = false;

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
    }

    _update(quicklauncherLayout, shutdownMenuLayout) {

        if (this.labelAdded) {
            this.removeActor(this.label);
            this.labelAdded = false;
        }
        if (this.labelIconAdded) {
            this.removeActor(this.label_icon);
            this.labelIconAdded = false;
        }

        if (quicklauncherLayout == 'both' || quicklauncherLayout == 'icons' || shutdownMenuLayout == "horizontal") {

            let iconSize = 16;
            if(quicklauncherLayout == 'icons')
                iconSize = 24;
            else if(shutdownMenuLayout == "horizontal")
                iconSize = 22;

            this.name_icon = new St.Icon({
                icon_name: this.icon,
                icon_size: iconSize,
                icon_type: St.IconType.FULLCOLOR,
            });

            if (this.icon.search("-symbolic") != -1)
                this.name_icon.icon_type = St.IconType.SYMBOLIC

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
    }

    _onLeaveEvent() {
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

    setActive(active) {
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
    }

    _onButtonReleaseEvent(actor, event) {
        if (event.get_button() == 1) {
            this.activate(event);
        }
    }

    activate(event) {
        eval(this.func);
        this.parent.close();
    }
}

class AllProgramsItem extends AppPopupSubMenuMenuItem {
    constructor(label, icon, parent) {
        super(label);

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
    }

    setActive(active) {
        if (active)
            this.box.set_style_class_name('menu-category-button-selected');
        else
            this.box.set_style_class_name('menu-category-button');
    }

    _onButtonReleaseEvent(actor, event) {
        if (event.get_button() == 1) {
            this.activate(event);
        }
    }

    activate(event) {
        if (this.parent.leftPane.get_child() == this.parent.favsBox) this.parent.switchPanes("apps");
        else this.parent.switchPanes("favs");
    }
}

class ResultsFoundItem extends AppPopupSubMenuMenuItem {
    constructor(label, icon, parent) {
        super(label);

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
    }

    setActive(active) {
        if (active)
            this.box.set_style_class_name('menu-category-button-selected');
        else
            this.box.set_style_class_name('menu-category-button');
    }

    _onButtonReleaseEvent(actor, event) {
    }
}

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
                    icon = new Gio.FileIcon({file: iconFile});
                } else {
                    icon = new Gio.ThemedIcon({name: 'avatar-default'});
                }
                this._userIcon.set_gicon(icon);
                this.icon.hide();
                this._userIcon.show();
            }
        }
    },

    _refresh: function(icon) {
        this._userIcon.hide();

        if (icon.search("-symbolic") != -1)
            this.icon.icon_type = St.IconType.SYMBOLIC
        else
            this.icon.icon_type = St.IconType.FULLCOLOR

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

class ShutdownContextMenuItem extends PopupMenu.PopupBaseMenuItem {
    constructor(parentMenu, menu, label, action, hoverIcon) {
        super({focusOnHover: false});
        this.parentMenu = parentMenu;

        this._appButton = menu;
        this._action = action;
        this.label = new St.Label({ text: label });

        this.addActor(this.label);

        this._screenSaverProxy = new ScreenSaver.ScreenSaverProxy();
        this.hoverIcon = hoverIcon;

        this.actor.connect('enter-event', Lang.bind(this, this._onEnterEvent));
        this.actor.connect('leave-event', Lang.bind(this, this._onLeaveEvent));
    }

    activate(event) {
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
    }

    _onEnterEvent() {
        let icon;
        if (this._action == "logout")
            icon = "system-log-out";
        else
            icon = "system-lock-screen";
        this.hoverIcon.showUser = false;
        this.hoverIcon._refresh(icon);
    }

    _onLeaveEvent() {
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
}

class ShutdownMenu extends AppPopupSubMenuMenuItem {
    constructor(parent, hoverIcon) {
        let label = '';
        super(label);

        this.hoverIcon = hoverIcon;
        this.parent = parent;

        this.actor.set_style_class_name('menu-category-button');
        this.actor.add_style_class_name('starkmenu-arrow-dropdown-button');
        //this.removeActor(this.label);
        this.label.destroy();
        this.icon = new St.Icon({
            style_class: 'popup-menu-icon',
            icon_type: St.IconType.SYMBOLIC,
            icon_name: 'pan-end',
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

    }

    _onLeaveEvent() {
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

    setActive(active) {
        if (active) {
            this.hoverIcon.showUser = false;
            this.actor.set_style_class_name('menu-category-button-selected');
            this.actor.add_style_class_name('starkmenu-arrow-dropdown-button-selected');
            this.hoverIcon._refresh('forward');
        } else {
            this.actor.set_style_class_name('menu-category-button');
            this.actor.add_style_class_name('starkmenu-arrow-dropdown-button');
        }
    }

    _onButtonReleaseEvent(actor, event) {
        if (event.get_button() == 1) {
            this.menu.toggle();
        }
    }
}

class CategoriesApplicationsBox {
    constructor() {
        this.actor = new St.BoxLayout();
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

class FavoritesBox {
    constructor() {
        this.actor = new St.BoxLayout({ vertical: true });
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
}

/* This is so we can override the default key-press-event handler in PopupMenu.PopupMenu
 * and prevent animation when the menu via Escape. */
class Menu extends Applet.AppletPopupMenu {
    constructor(launcher, orientation) {
        super(launcher, orientation);
    }

    _onKeyPressEvent(actor, event) {
        if (event.get_key_symbol() == Clutter.Escape) {
            this.close(false);
            return true;
        }

        return false;
    }
}

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

class CinnamonMenuApplet extends Applet.TextIconApplet {
    constructor(orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        this.setAllowedLayout(Applet.AllowedLayout.BOTH);

        this.set_applet_tooltip(_("Menu"));
        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Menu(this, orientation);
        this.menuManager.addMenu(this.menu);

        this.settings = new Settings.AppletSettings(this, "CinnVIIStarkMenu@NikoKrause", instance_id);

        this.settings.bind("show-places", "showPlaces", () => this.queueRefresh(RefreshFlags.PLACE));

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

        this.settings.bind("menu-custom", "menuCustom", this._updateIconAndLabel);
        this.settings.bind("menu-icon", "menuIcon", this._updateIconAndLabel);
        this.settings.bind("menu-label", "menuLabel", this._updateIconAndLabel);
        this.settings.bind("overlay-key", "overlayKey", this._updateKeybinding);
        this.settings.bind("show-category-icons", "showCategoryIcons", () => this._updateShowIcons(this.categoriesBox, this.showCategoryIcons));
        this.settings.bind("show-application-icons", "showApplicationIcons", () => this._updateShowIcons(this.applicationsBox, this.showApplicationIcons));
        this.settings.bind("show-favorite-icons", "showFavoriteIcons", () => this._updateShowIcons(this.favoritesBox, this.showFavoriteIcons));
        this.settings.bind("show-apps-description-on-buttons", "showAppsDescriptionOnButtons", () => this.queueRefresh(REFRESH_ALL_MASK));

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
        this._webSearchButtons = [];
        this._selectedItemIndex = null;
        this._previousSelectedActor = null;
        this._previousVisibleIndex = null;
        this._previousTreeSelectedActor = null;
        this._activeContainer = null;
        this._activeActor = null;
        this._knownApps = new Set(); // Used to keep track of apps that are already installed, so we can highlight newly installed ones
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

        appsys.connect('installed-changed', () => this.queueRefresh(RefreshFlags.APP | RefreshFlags.FAV));
        AppFavorites.getAppFavorites().connect('changed', () => this.queueRefresh(RefreshFlags.FAV));
        Main.placesManager.connect('places-updated', () => this.queueRefresh(RefreshFlags.PLACE));
        this.RecentManager.connect('changed', () => this.queueRefresh(RefreshFlags.RECENT));
        this.privacy_settings.connect("changed::" + REMEMBER_RECENT_KEY, () => this.queueRefresh(RefreshFlags.RECENT));

        this.settings.bind("show-sidebar", "showSidebar", this._updateQuickLinksView);
        this._updateQuickLinksView();

        this.settings.bind("show-shutdown-menu", "showShutdownMenu", this._updateQuickLinksShutdownView);
        this.settings.bind("shutdown-menu-layout", "shutdownMenuLayout", this._updateQuickLinks);
        this.settings.bind("shutdown-menu-reverse-order", "shutdownMenuReverseOrder", this._updateQuickLinksShutdownView);

        this._fileFolderAccessActive = false;
        this._pathCompleter = new Gio.FilenameCompleter();
        this._pathCompleter.set_dirs_only(false);
        this.lastAcResults = [];
        this.settings.bind("search-filesystem", "searchFilesystem");
        this.contextMenu = null;
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

        this.settings.bind("web-search", "webSearch", this._updateSearchEngineButtons);
        this._updateSearchEngineButtons();

        // We shouldn't need to call refreshAll() here... since we get a "icon-theme-changed" signal when CSD starts.
        // The reason we do is in case the Cinnamon icon theme is the same as the one specificed in GTK itself (in .config)
        // In that particular case we get no signal at all.
        this.refreshId = 0;
        this.refreshMask = REFRESH_ALL_MASK;
        this._doRefresh();

        this.set_show_label_in_vertical_panels(false);
    }

    _updateShowIcons(container, show) {
        Util.each(container.get_children(), c => {
            let b = c._delegate;
            if (!(b instanceof SimpleMenuItem))
                return;
            if (b.icon)
                b.icon.visible = show;
        })
    }

    _updateKeybinding() {
        Main.keybindingManager.addHotKey("overlay-key-" + this.instance_id, this.overlayKey, Lang.bind(this, function() {
            if (!Main.overview.visible && !Main.expo.visible)
                this.menu.toggle_with_options(this.enableAnimation);
        }));
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
        if ((m & RefreshFlags.FAV) === RefreshFlags.FAV)
            this._refreshFavs();
        if ((m & RefreshFlags.PLACE) === RefreshFlags.PLACE)
            this._refreshPlaces();
        if ((m & RefreshFlags.RECENT) === RefreshFlags.RECENT)
            this._refreshRecent();

        this.refreshMask = 0;

        // recent category is always last
        if (this.recentButton)
            this.categoriesBox.set_child_at_index(this.recentButton.actor, -1);

        // places is before recents, or last in list if recents is disabled/not generated
        if (this.placesButton) {
            if (this.recentButton)
                this.categoriesBox.set_child_below_sibling(this.placesButton.actor, this.recentButton.actor);
            else
                this.categoriesBox.set_child_at_index(this.placesButton.actor, -1);
        }
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

    _resizeAppsBoxHeight() {
        let scrollBoxHeight = this.favsBox.get_height() + this.separator.actor.get_height() + this.favExpandBin.get_height();
        this.applicationsScrollBox.set_height(scrollBoxHeight);
        this.categoriesScrollBox.set_height(scrollBoxHeight);
    }

    _resizeAppsBoxWidth() {
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
    }

    _updateQuickLinksView() {
        this.menu.showSidebar = this.showSidebar;
        if (this.menu.showSidebar) {
            this.rightButtonsBox.actor.show();
        }
        else {
            this.rightButtonsBox.actor.hide();
        }

        this.quicklinksupdated = true;
    }

    _updateQuickLinksShutdownView() {
        this.menu.showShutdownMenu = this.showShutdownMenu;
        this.menu.shutdownMenuLayout = this.shutdownMenuLayout;
        this.menu.shutdownMenuReverseOrder = this.shutdownMenuReverseOrder;
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

        if (this.shutdownMenuReverseOrder) {
            this.rightButtonsBox.shutDownIconBox.remove_actor(this.rightButtonsBox.shutdown2.actor);
            this.rightButtonsBox.shutDownIconBox.remove_actor(this.rightButtonsBox.logout.actor);
            this.rightButtonsBox.shutDownIconBox.add_actor(this.rightButtonsBox.logout.actor);
            this.rightButtonsBox.shutDownIconBox.add_actor(this.rightButtonsBox.shutdown2.actor);

            this.rightButtonsBox.shutDownIconBoxXP.remove_actor(this.rightButtonsBox.shutdown3.actor);
            this.rightButtonsBox.shutDownIconBoxXP.remove_actor(this.rightButtonsBox.logout2.actor);
            this.rightButtonsBox.shutDownIconBoxXP.add_actor(this.rightButtonsBox.logout2.actor);
            this.rightButtonsBox.shutDownIconBoxXP.add_actor(this.rightButtonsBox.shutdown3.actor);
        }
        else {
            this.rightButtonsBox.shutDownIconBox.remove_actor(this.rightButtonsBox.lock.actor);
            this.rightButtonsBox.shutDownIconBox.remove_actor(this.rightButtonsBox.logout.actor);
            this.rightButtonsBox.shutDownIconBox.add_actor(this.rightButtonsBox.logout.actor);
            this.rightButtonsBox.shutDownIconBox.add_actor(this.rightButtonsBox.lock.actor);

            this.rightButtonsBox.shutDownIconBoxXP.remove_actor(this.rightButtonsBox.lock2.actor);
            this.rightButtonsBox.shutDownIconBoxXP.remove_actor(this.rightButtonsBox.logout2.actor);
            this.rightButtonsBox.shutDownIconBoxXP.add_actor(this.rightButtonsBox.logout2.actor);
            this.rightButtonsBox.shutDownIconBoxXP.add_actor(this.rightButtonsBox.lock2.actor);
        }

        this._updateCustomLabels();

        this.quicklinksupdated = true;
    }

    _updateQuickLinks() {
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
    }

    on_orientation_changed (orientation) {
        this._updateIconAndLabel();
    }

    on_applet_removed_from_panel () {
        Main.keybindingManager.removeHotKey("overlay-key-" + this.instance_id);
    }

    // settings button callback
    _launch_editor() {
        Util.spawnCommandLine("cinnamon-menu-editor");
    }

    on_applet_clicked(event) {
        this.menu.toggle_with_options(this.enableAnimation);
    }

    _onOpenStateChanged(menu, open) {
        if (open) {
            this.actor.add_style_pseudo_class('active');
            global.stage.set_key_focus(this.searchEntry);
            this._selectedItemIndex = null;
            this._activeContainer = null;
            this._activeActor = null;
            this._appsBoxWidthResized = false;

            this.lastSelectedCategory = null;

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
            this._allAppsCategoryButton.actor.style_class = "menu-category-button-selected";

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
            this.closeContextMenu(false);
            this._previousVisibleIndex = null;

            this._clearAllSelections(false);
            this._scrollToButton(null, this.applicationsScrollBox);
            this._scrollToButton(null, this.categoriesScrollBox);
            this.destroyVectorBox();
        }
    }

    _initial_cat_selection (start_index) {
        let n = this._applicationsButtons.length;
        for (let i = start_index; i < n; i++) {
            this._applicationsButtons[i].actor.show();
        }
    }

    fit_favsbox(elem) {
        let parent = elem.get_parent().get_theme_node();
        let p_hpadding = parent.get_padding(St.Side.LEFT) + parent.get_padding(St.Side.RIGHT);
        let favsbox_width = this.favsBox.get_allocation_box().x2 - this.favsBox.get_allocation_box().x1;

        elem.set_width(favsbox_width - p_hpadding);
    }

    destroy() {
        this.actor._delegate = null;
        this.menu.destroy();
        this.actor.destroy();
        this.emit('destroy');
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

    _updateCustomLabels(){
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
            menu.actor.set_style_class_name('menu-context-menu');
            menu.connect('open-state-changed', Lang.bind(this, this._contextMenuOpenStateChanged));
            this.contextMenu = menu;
            if (button instanceof FavoritesButton)
                this.favoritesBox.add_actor(menu.actor);
            else
                this.applicationsBox.add_actor(menu.actor);
        } else if (this.contextMenu.isOpen &&
                   this.contextMenu.sourceActor != button.actor) {
            this.contextMenu.close();
        }

        if (!this.contextMenu.isOpen) {
            this.contextMenu.box.destroy_all_children();
            if (button instanceof FavoritesButton)
                this.favoritesBox.set_child_above_sibling(this.contextMenu.actor, button.actor);
            else
                this.applicationsBox.set_child_above_sibling(this.contextMenu.actor, button.actor);
            this.contextMenu.sourceActor = button.actor;
            button.populateMenu(this.contextMenu);
        }

        this.contextMenu.toggle();
    }

    _navigateContextMenu(button, symbol, ctrlKey) {
        if (symbol === Clutter.KEY_Menu || symbol === Clutter.Escape ||
            (ctrlKey && (symbol === Clutter.KEY_Return || symbol === Clutter.KP_Enter))) {
            this.toggleContextMenu(button);
            return;
        }

        let minIndex = 0;
        let goUp = symbol === Clutter.KEY_Up;
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
    }

    _onMenuKeyPress(actor, event) {
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
        if (this._activeContextMenuParent &&
            this._activeContainer === this.applicationsBox) {
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
                         (this.categoriesBox.get_child_at_index(index))._delegate.categoryId === "recent")
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
                                this._scrollToButton(item_actor._delegate, this.categoriesScrollBox);
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
                                this._scrollToButton(item_actor._delegate, this.categoriesScrollBox);
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
                                this._scrollToButton();
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
                                this._scrollToButton(item_actor._delegate, this.categoriesScrollBox);
                            }
                            break;
                        case "bottom":
                            if(visiblePane == "favs") {
                                this._activeContainer = this.favoritesBox;
                                item_actor = this.favBoxIter.getLastVisible();
                            } else {
                                this._activeContainer = this.categoriesBox;
                                item_actor = this.catBoxIter.getLastVisible();
                                this._scrollToButton(item_actor._delegate, this.categoriesScrollBox);
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
                            this._scrollToButton(item_actor._delegate, this.categoriesScrollBox);
                            break;
                        case "down":
                            this._previousTreeSelectedActor = this.categoriesBox.get_child_at_index(index);
                            this._previousTreeSelectedActor._delegate.isHovered = false;
                            item_actor = this.catBoxIter.getNextVisible(this._activeActor);
                            this._scrollToButton(item_actor._delegate, this.categoriesScrollBox);
                            break;
                        case "right":
                            if ((this.categoriesBox.get_child_at_index(index))._delegate.categoryId === "recent" &&
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
                            this._scrollToButton(item_actor._delegate, this.categoriesScrollBox);
                            break;
                        case "bottom":
                            this._previousTreeSelectedActor = this.categoriesBox.get_child_at_index(index);
                            this._previousTreeSelectedActor._delegate.isHovered = false;
                            item_actor = this.catBoxIter.getLastVisible();
                            this._scrollToButton(item_actor._delegate, this.categoriesScrollBox);
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

                            this._buttonEnterEvent(item_actor._delegate);
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

                            this._buttonEnterEvent(item_actor._delegate);
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
            if ((this._activeContainer && this._activeContainer !== this.categoriesBox) && (symbol === Clutter.KEY_Return || symbol === Clutter.KP_Enter)) {
                if (!ctrlKey) {
                    item_actor = this._activeContainer.get_child_at_index(this._selectedItemIndex);
                    item_actor._delegate.activate();
                } else if (ctrlKey && (this._activeContainer === this.applicationsBox || this._activeContainer === this.favoritesBox)) {
                    item_actor = this._activeContainer.get_child_at_index(this._selectedItemIndex);
                    this.toggleContextMenu(item_actor._delegate);
                }
                return true;
            } else if ((this._activeContainer === this.applicationsBox || this._activeContainer === this.favoritesBox) &&
                       symbol === Clutter.KEY_Menu) {
                item_actor = this._activeContainer.get_child_at_index(this._selectedItemIndex);
                this.toggleContextMenu(item_actor._delegate);
                return true;
            } else if (!this.searchActive && this._activeContainer === this.favoritesBox && symbol === Clutter.Delete) {
                item_actor = this.favoritesBox.get_child_at_index(this._selectedItemIndex);
                if (item_actor._delegate instanceof FavoritesButton) {
                    let favorites = AppFavorites.getAppFavorites().getFavorites();
                    let numFavorites = favorites.length;
                    AppFavorites.getAppFavorites().removeFavorite(item_actor._delegate.app.get_id());
                    this.toggleContextMenu(item_actor._delegate)
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
                    if (!text.includes(' '))
                        prefix = text;
                    else
                        prefix = text.substr(text.lastIndexOf(' ') + 1);
                    this._getCompletion(prefix);

                    return false;
                }
                if (symbol === Clutter.Tab) {
                    let text = actor.get_text();
                    let prefix;
                    if (!text.includes(' '))
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
        this._buttonEnterEvent(item_actor._delegate);
        return true;
    }

    _buttonEnterEvent(button) {
        let parent = button.actor.get_parent();
        if (this._activeContainer === this.categoriesBox && parent !== this._activeContainer) {
            this._previousTreeSelectedActor = this._activeActor;
            this._previousSelectedActor = null;
        }
        if (this._previousTreeSelectedActor && this._activeContainer !== this.categoriesBox &&
                parent !== this._activeContainer && button !== this._previousTreeSelectedActor && !this.searchActive) {
            this._previousTreeSelectedActor.style_class = "menu-category-button";
        }
        if (parent != this._activeContainer && parent._vis_iter) {
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

        if (this._activeContainer._vis_iter) {
            this._selectedItemIndex = this._activeContainer._vis_iter.getAbsoluteIndexOfChild(this._activeActor);
        }

        let isFav = false;
        if (button instanceof CategoryButton) {
            if (this.searchActive)
                return;
            button.isHovered = true;
            this._clearPrevCatSelection(button.actor);
            this._select_category(button.categoryId);
            this.makeVectorBox(button.actor);
        } else {
            this._previousVisibleIndex = parent._vis_iter.getVisibleIndex(button.actor);

            isFav = button instanceof FavoritesButton;
            if (!isFav)
                this._clearPrevSelection(button.actor);
            this.selectedAppTitle.set_text(button.name);
            this.selectedAppDescription.set_text(button.description);
        }

        if (isFav)
            button.actor.add_style_pseudo_class("hover");
        else
            button.actor.set_style_class_name(`${button.styleClass}-selected`);
    }

    _buttonLeaveEvent (button) {
        if (button instanceof CategoryButton) {
            if (this._previousTreeSelectedActor === null) {
                this._previousTreeSelectedActor = button.actor;
            } else {
                let prevIdx = this.catBoxIter.getVisibleIndex(this._previousTreeSelectedActor);
                let nextIdx = this.catBoxIter.getVisibleIndex(button.actor);

                if (Math.abs(prevIdx - nextIdx) <= 1) {
                    this._previousTreeSelectedActor = button.actor;
                }
            }
            button.isHovered = false;
        } else {
            this._previousSelectedActor = button.actor;
            this.selectedAppTitle.set_text("");
            this.selectedAppDescription.set_text("");

            // category unselects are handled when the category actually changes
            if (button instanceof FavoritesButton)
                button.actor.remove_style_pseudo_class("hover");
            else
                button.actor.set_style_class_name(button.styleClass);
        }
    }

    _clearPrevSelection(actor) {
        if (this._previousSelectedActor
            && !this._previousSelectedActor.is_finalized()
            && this._previousSelectedActor != actor) {
            if (this._previousSelectedActor._delegate instanceof FavoritesButton)
                this._previousSelectedActor.remove_style_pseudo_class("hover");
            else if (!(this._previousSelectedActor._delegate instanceof CategoryButton))
                this._previousSelectedActor.style_class = "menu-application-button";
        }
    }

    _clearPrevCatSelection(actor) {
        if (this._previousTreeSelectedActor && this._previousTreeSelectedActor != actor) {
            this._previousTreeSelectedActor.style_class = "menu-category-button";

            if (this._previousTreeSelectedActor._delegate) {
                this._buttonLeaveEvent(this._previousTreeSelectedActor._delegate);
            }

            if (actor !== undefined) {
                this._previousVisibleIndex = null;
                this._previousTreeSelectedActor = actor;
            }
        } else {
            this.categoriesBox.get_children().forEach(child => child.style_class = "menu-category-button");
        }
    }

    /*
     * The vectorBox overlays the the categoriesBox to aid in navigation from categories to apps
     * by preventing misselections. It is set to the same size as the categoriesOverlayBox and
     * categoriesBox.
     *
     * The actor is a quadrilateral that we turn into a triangle by setting the A and B vertices to
     * the same position. The size and origin of the vectorBox are calculated in _getVectorInfo().
     * Using those properties, the bounding box is sized as (w, h) and the triangle is defined as
     * follows:
     *   _____
     *  |    /|D
     *  |   / |     AB: (mx, my)
     *  | A/  |      C: (w, h)
     *  | B\  |      D: (w, 0)
     *  |   \ |
     *  |____\|C
     */

    _getVectorInfo() {
        let [mx, my, mask] = global.get_pointer();
        let [bx, by] = this.categoriesOverlayBox.get_transformed_position();
        let [bw, bh] = this.categoriesOverlayBox.get_transformed_size();

        let xformed_mx = mx - bx;
        let xformed_my = my - by;

        if (xformed_mx < 0 || xformed_mx > bw || xformed_my < 0 || xformed_my > bh) {
            return null;
        }

        return { mx: xformed_mx,
                 my: xformed_my,
                 w: this.categoriesOverlayBox.width,
                 h: this.categoriesOverlayBox.height };
    }

    makeVectorBox(actor) {
        this.destroyVectorBox(actor);
        let vi = this._getVectorInfo();
        if (!vi)
            return;

        if (this.vectorBox) {
            this.vectorBox.visible = true;
        } else {
            this.vectorBox = new St.Polygon({ debug: false,  reactive: true });

            this.categoriesOverlayBox.add_actor(this.vectorBox);

            this.vectorBox.connect("leave-event", Lang.bind(this, this.destroyVectorBox));
            this.vectorBox.connect("motion-event", Lang.bind(this, this.maybeUpdateVectorBox));
        }

        Object.assign(this.vectorBox, { width: vi.w,   height:   vi.h,
                                        ulc_x: vi.mx,  ulc_y:    vi.my,
                                        llc_x: vi.mx,  llc_y:    vi.my,
                                        urc_x: vi.w,   urc_y:    0,
                                        lrc_x: vi.w,   lrc_y:    vi.h });

        this.actor_motion_id = actor.connect("motion-event", Lang.bind(this, this.maybeUpdateVectorBox));
        this.current_motion_actor = actor;
    }

    maybeUpdateVectorBox() {
        if (this.vector_update_loop) {
            Mainloop.source_remove(this.vector_update_loop);
            this.vector_update_loop = 0;
        }
        this.vector_update_loop = Mainloop.timeout_add(50, Lang.bind(this, this.updateVectorBox));
    }

    updateVectorBox(actor) {
        if (!this.current_motion_actor)
            return;
        let vi = this._getVectorInfo();
        if (vi) {
            this.vectorBox.ulc_x = vi.mx;
            this.vectorBox.llc_x = vi.mx;
            this.vectorBox.queue_repaint();
        } else {
            this.destroyVectorBox(actor);
        }
        this.vector_update_loop = 0;
        return false;
    }

    destroyVectorBox(actor) {
        if (!this.vectorBox)
            return;

        if (this.vector_update_loop) {
            Mainloop.source_remove(this.vector_update_loop);
            this.vector_update_loop = 0;
        }

        if (this.actor_motion_id > 0 && this.current_motion_actor != null) {
            this.current_motion_actor.disconnect(this.actor_motion_id);
            this.actor_motion_id = 0;
            this.current_motion_actor = null;
            this.vectorBox.visible = false;
        }
    }

    _refreshPlaces () {
        for (let i = 0; i < this._placesButtons.length; i ++) {
            this._placesButtons[i].actor.destroy();
        }

        this._placesButtons = [];

        for (let i = 0; i < this._categoryButtons.length; i++) {
            if (this._categoryButtons[i].categoryId === 'place') {
                this._categoryButtons[i].destroy();
                this._categoryButtons.splice(i, 1);
                this.placesButton = null;
                break;
            }
        }

        if (!this.showPlaces) {
            return;
        }

        // Now generate Places category and places buttons and add to the list
        if (!this.placesButton) {
            this.placesButton = new CategoryButton(this, 'place', _('Places'),  'folder');
            this._categoryButtons.push(this.placesButton);
            this.categoriesBox.add_actor(this.placesButton.actor);
        }

        // places go after applications. we add them in reverse starting below the last ApplicationButton
        let sibling = this._applicationsButtons[this._applicationsButtons.length - 1].actor;
        let places = Main.placesManager.getAllPlaces();
        for (let i = places.length - 1; i >= 0; i--) {
            let button = new PlaceButton(this, places[i]);
            this._placesButtons.push(button);
            this.applicationsBox.insert_child_below(button.actor, sibling);
            button.actor.visible = this.menu.isOpen;
            sibling = button.actor;
        }
    }

    _refreshRecent () {
        for (let i = 0; i < this._recentButtons.length; i++) {
            this._recentButtons[i].destroy();
        }

        this._recentButtons = [];

        for (let i = 0; i < this._categoryButtons.length; i++) {
            if (this._categoryButtons[i].categoryId === 'recent') {
                this._categoryButtons[i].destroy();
                this._categoryButtons.splice(i, 1);
                this.recentButton = null;
                break;
            }
        }

        if (!this.privacy_settings.get_boolean(REMEMBER_RECENT_KEY)) {
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
            Util.each(recents, (info) => {
                let button = new RecentButton(this, info);
                this._recentButtons.push(button);
                this.applicationsBox.add_actor(button.actor);
                button.actor.visible = this.menu.isOpen;
            });

            let button = new SimpleMenuItem(this, { name: _("Clear list"),
                                                    description: _("Clear all recent documents"),
                                                    type: 'recent-clear',
                                                    styleClass: 'menu-application-button' });
            button.addIcon(APPLICATION_ICON_SIZE, 'edit-clear', null, true);
            button.addLabel(button.name, 'menu-application-button-label');
            button.label.set_style('font-weight: bold;');
            button.activate = () => {
                this.menu.close();
                (new Gtk.RecentManager()).purge_items();
            };

            if (!this.showApplicationIcons)
                button.icon.visible = false;

            this._recentButtons.push(button);
            this.applicationsBox.add_actor(button.actor);
            button.actor.visible = this.menu.isOpen;
        } else {
            this.noRecentDocuments = true;
            let button = new SimpleMenuItem(this, { name: _("No recent documents"),
                                                    type: 'no-recent',
                                                    styleClass: 'menu-application-button',
                                                    reactive: false,
                                                    activatable: false });
            button.addLabel(button.name, 'menu-application-button-label');
            this._recentButtons.push(button);
            this.applicationsBox.add_actor(button.actor);
            button.actor.visible = this.menu.isOpen;
        }

    }

    _refreshApps() {
        /* iterate in reverse, so multiple splices will not upset
         * the remaining elements */
        for (let i = this._categoryButtons.length - 1; i > -1; i--) {
            let b = this._categoryButtons[i];
            if (b === this._allAppsCategoryButton ||
                ['place', 'recent'].includes(b.categoryId))
                continue;
            this._categoryButtons[i].destroy();
            this._categoryButtons.splice(i, 1);
        }

        this._applicationsButtons.forEach(button => button.destroy());
        this._applicationsButtons = [];

        if (!this._allAppsCategoryButton) {
            this._allAppsCategoryButton = new CategoryButton(this);
            this.categoriesBox.add_actor(this._allAppsCategoryButton.actor);
            this._categoryButtons.push(this._allAppsCategoryButton);
        }

        // grab top level directories and all apps in them
        let [apps, dirs] = AppUtils.getApps();

        // generate all category buttons from top-level directories
        Util.each(dirs, (d) => {
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
            button.actor.visible = this.menu.isOpen;
        }

        // we expect this array to be in the same order as the child list
        this._applicationsButtons.reverse();
        this._appsWereRefreshed = true;
    }

    _refreshFavs() {
        //Remove all favorites
        this.favoritesBox.destroy_all_children();

        //Load favorites again
        this._favoritesButtons = [];
        let launchers = global.settings.get_strv('favorite-apps');
        for ( let i = 0; i < launchers.length; ++i ) {
            let app = appsys.lookup_app(launchers[i]);
            if (app) {
                let button = new FavoritesButton(this, app, launchers.length, this.favorite_button_size, this.showFavoriteIcons); // + 3 because we're adding 3 system buttons at the bottom
                this._favoritesButtons[app] = button;
                this.favoritesBox.add(button.actor, { y_align: St.Align.END, y_fill: false });
            }
        }
    }


    _scrollToButton(button, scrollBox = null) {
        if (!scrollBox)
            scrollBox = this.applicationsScrollBox;

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

    _display() {
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
        this.searchBox.add(this.searchEntry, {x_fill: true, x_align: St.Align.START, y_align: St.Align.MIDDLE, y_fill: false, expand: true});
        this.searchActive = false;
        this.searchEntryText = this.searchEntry.clutter_text;
        this.searchEntryText.connect('text-changed', Lang.bind(this, this._onSearchTextChanged));
        this.searchEntryText.connect('key-press-event', Lang.bind(this, this._onMenuKeyPress));
        this._previousSearchPattern = "";

        this.categoriesApplicationsBox = new CategoriesApplicationsBox();
        this.appsBox.add_actor(this.categoriesApplicationsBox.actor);
        this.categoriesOverlayBox = new Clutter.Actor();
        this.categoriesBox = new St.BoxLayout({ style_class: 'menu-categories-box',
                                                vertical: true,
                                                accessible_role: Atk.Role.LIST });
        this.applicationsScrollBox = new St.ScrollView({ x_fill: true, y_fill: false, y_align: St.Align.START, style_class: 'vfade menu-applications-scrollbox' });

        this.categoriesScrollBox = new St.ScrollView({ x_fill: true, y_fill: false, y_align: St.Align.START, style_class: 'vfade menu-applications-scrollbox' });
        this.categoriesOverlayBox.add_actor(this.categoriesScrollBox);

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
        this.categoriesApplicationsBox.actor.add_actor(this.categoriesOverlayBox);
        this.categoriesApplicationsBox.actor.add_actor(this.applicationsScrollBox);

        this.favoritesBox = new FavoritesBox().actor;
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

        //if (this.selectedAppBox.peek_theme_node() == null ||
        //    this.selectedAppBox.get_theme_node().get_length('height') == 0)
        //    this.selectedAppBox.set_height(30 * global.ui_scale);

        this.favExpandBin = new St.Bin();

        this.selectedAppTitle = new St.Label({ style_class: 'menu-selected-app-title', text: "" });
        this.selectedAppBox.add_actor(this.selectedAppTitle);
        this.selectedAppDescription = new St.Label({ style_class: 'menu-selected-app-description', text: "" });
        this.selectedAppBox.add_actor(this.selectedAppDescription);
        this.selectedAppBox._delegate = null;

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
    }

    _updateMenuLayout() {
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
    }

    switchPanes(pane) {
        this.closeContextMenu(false);
        this.contextMenu = null;
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
    }

    _updateVFade() {
        let mag_on = this.a11y_settings.get_boolean("screen-magnifier-enabled") &&
                     this.a11y_mag_settings.get_double("mag-factor") > 1.0;
        if (mag_on) {
            this.applicationsScrollBox.style_class = "menu-applications-scrollbox";
            this.categoriesScrollBox.style_class = "menu-applications-scrollbox";
        } else {
            this.applicationsScrollBox.style_class = "vfade menu-applications-scrollbox";
            this.categoriesScrollBox.style_class = "vfade menu-applications-scrollbox";
        }
    }

    _update_autoscroll() {
        this.applicationsScrollBox.set_auto_scrolling(this.autoscroll_enabled);
        this.categoriesScrollBox.set_auto_scrolling(this.autoscroll_enabled);
    }

    _clearAllSelections(hide_apps) {
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
    }

    _resetSortOrder() {
        let pos = 0;

        for (let i = 0; i < this._applicationsButtons.length; i++) {
            this.applicationsBox.set_child_at_index(this._applicationsButtons[i].actor, pos++);
        }

        for (let i = 0; i < this._placesButtons.length; i++) {
            this.applicationsBox.set_child_at_index(this._placesButtons[i].actor, pos++);
        }

        for (let i = 0; i < this._recentButtons.length; i++) {
            this.applicationsBox.set_child_at_index(this._recentButtons[i].actor, pos++);
        }
    }

    _select_category (name) {
        if (name === this.lastSelectedCategory)
            return;
        this.lastSelectedCategory = name;
        this._displayButtons(name || 'app');
        this.closeContextMenu(false);
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

            Util.each(this.applicationsBox.get_children(), c => {
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

            Util.each(this.applicationsBox.get_children(), c => {
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

                return ba.searchStrings < bb.searchStrings ? -1 : 1;
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
            Util.each(autoCompletes, item => {
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
                    button.set_style_class_name("menu-category-button");
                    if (icon) {
                        icon.set_opacity(255);
                    }
                } else {
                    button.set_style_class_name("menu-category-button-greyed");
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

    _updateSearchEngineButtons() {
        for (let i = 0; i < this._webSearchButtons.length; i++) {
            this._webSearchButtons[i].destroy();
        }

        this._webSearchButtons = [];

        for (let i = this.webSearch.length-1; i >= 0; i--) {
            if (this.webSearch[i].checkbox) {
                let webSearchButton = new WebSearchButton(this, '', this.webSearch[i].icon, this.webSearch[i].engine, this.webSearch[i].url);
                this._webSearchButtons.push(webSearchButton);
                this.applicationsBox.add_actor(webSearchButton.actor);
                webSearchButton.actor.visible = this.menu.isOpen;
            }
        }
    }

    resetSearch(){
        this.searchEntry.set_text("");
    }

    _onSearchTextChanged (se, prop) {
        let searchString = this.searchEntry.get_text().trim();
        let searchActive = !(searchString == '' || searchString == this.searchEntry.hint_text);
        if (!this.searchActive && !searchActive)
            return;

        if (searchString == this._previousSearchPattern)
            return;
        this._previousSearchPattern = searchString;

        this.searchActive = searchActive;
        this._fileFolderAccessActive = searchActive && this.searchFilesystem;
        this._clearAllSelections();

        if (searchActive) {
            if (this.leftPane.get_child() == this.favsBox)
                this.switchPanes("apps");

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

            for (let i = 0; i < this._webSearchButtons.length; i++) {
                this._webSearchButtons[i].changeLabel(searchString);
            }

            this._doSearch(searchString);
            this.appsButton.actor.hide();
            this.resultsFoundButton.actor.show();
        } else {
            if (this._searchIconClickedId > 0)
                this.searchEntry.disconnect(this._searchIconClickedId);
            this._searchIconClickedId = 0;
            this.searchEntry.set_secondary_icon(this._searchInactiveIcon);
            this._previousSearchPattern = "";
            this._setCategoriesButtonActive(true);
            this._select_category();
            this._allAppsCategoryButton.actor.style_class = "menu-category-button-selected";
            this._activeContainer = null;
            this.selectedAppTitle.set_text("");
            this.selectedAppDescription.set_text("");
            this.appsButton.actor.show();
            this.resultsFoundButton.actor.hide();
        }
    }

    // This is included in util.js since Mint 19.3, but we need it also in Mint 19.2 for improved search.
    _escapeRegExp(str) {
        // from: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
    }

    _matchNames(buttons, pattern){
        let ret = [];
        let regexpPattern = new RegExp(this._escapeRegExp(pattern));

        for (let i = 0; i < buttons.length; i++) {
            if (buttons[i].type == "recent-clear" || buttons[i].type == "no-recent") {
                continue;
            }
            let res = buttons[i].searchStrings[0].match(regexpPattern);
            if (res) {
                buttons[i].matchIndex = res.index + RECENT_PLACES_ADDER;
                ret.push(buttons[i]);
            } else {
                buttons[i].matchIndex = NO_MATCH;
            }
        }

        return ret;
    }

    _listApplications(pattern){
        if (!pattern)
            return [];

        let apps = [];
        let regexpPattern = new RegExp(this._escapeRegExp(pattern));

        for (let i in this._applicationsButtons) {
            let button = this._applicationsButtons[i];

            for (let j = 0; j < button.searchStrings.length; j++) {
                let res = button.searchStrings[j].match(regexpPattern);
                if (res) {
                    button.matchIndex = res.index + APP_MATCH_ADDERS[j];
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
        let pattern = Util.latinise(rawPattern.toLowerCase());

        this._searchTimeoutId = 0;
        this._activeContainer = null;
        this._activeActor = null;
        this._selectedItemIndex = null;
        this._previousTreeSelectedActor = null;
        this._previousSelectedActor = null;

        let buttons = this._listApplications(pattern);

        let result = this._matchNames(this._placesButtons, pattern);
        buttons = buttons.concat(result);

        result = this._matchNames(this._recentButtons, pattern);
        buttons = buttons.concat(result);

        buttons = buttons.concat(this._webSearchButtons);

        var acResults = []; // search box autocompletion results
        if (this.searchFilesystem) {
            // Don't use the pattern here, as filesystem is case sensitive
            acResults = this._getCompletions(rawPattern);
        }

        this._displayButtons(null, buttons, acResults);

        let numberResults = buttons.length + acResults.length;
        if (numberResults == 0)
            this.resultsFoundButton.label.set_text(_("No results found"));
        else
            this.resultsFoundButton.label.set_text(Gettext.dngettext(UUID, "%d result found", "%d results found", numberResults).format(numberResults));

        if (buttons.length || acResults.length) {
            this.appBoxIter.reloadVisible();
            let item_actor = this.appBoxIter.getFirstVisible();
            this._selectedItemIndex = this.appBoxIter.getAbsoluteIndexOfChild(item_actor);
            this._activeContainer = this.applicationsBox;
            this._scrollToButton(item_actor._delegate);
            this._buttonEnterEvent(item_actor._delegate);
        } else {
            this.selectedAppTitle.set_text("");
            this.selectedAppDescription.set_text("");
        }

        SearchProviderManager.launch_all(pattern, Lang.bind(this, function(provider, results) {
            try {
                for (var i in results) {
                    if (results[i].type != 'software')
                    {
                        let button = new SearchProviderResultButton(this, provider, results[i]);
                        this._searchProviderButtons.push(button);
                        this.applicationsBox.add_actor(button.actor);
                        if (this._selectedItemIndex === null) {
                            this.appBoxIter.reloadVisible();
                            let item_actor = this.appBoxIter.getFirstVisible();
                            this._selectedItemIndex = this.appBoxIter.getAbsoluteIndexOfChild(item_actor);
                            this._activeContainer = this.applicationsBox;
                            if (item_actor && item_actor != this.searchEntry) {
                                this._buttonEnterEvent(item_actor._delegate);
                            }
                        }
                    }
                }
            } catch(e) {
                global.log(e);
            }
        }));

        return false;
    }

    _getCompletion (text) {
        if (!text.includes('/') || text.endsWith('/'))
            return '';
        return this._pathCompleter.get_completion_suffix(text);
    }

    _getCompletions (text) {
        if (!text.includes('/'))
            return [];
        return this._pathCompleter.get_completions(text);
    }

    _run (input) {
        this._commandError = false;
        if (input) {
            let path = null;
            if (input.startsWith('/')) {
                path = input;
            } else {
                if (input.startsWith('~'))
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
    return new CinnamonMenuApplet(orientation, panel_height, instance_id);
}
