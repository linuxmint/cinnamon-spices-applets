const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;
const Clutter = imports.gi.Clutter;
const Pango = imports.gi.Pango;
const St = imports.gi.St;

const windowTracker = imports.gi.Cinnamon.WindowTracker.get_default();

const CMenu = imports.gi.CMenu;
const Cinnamon = imports.gi.Cinnamon;
const { getAppFavorites } = imports.ui.appFavorites;

const Applet = imports.ui.applet;
const Main = imports.ui.main;
const ModalDialog = imports.ui.modalDialog;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;
const Tooltips = imports.ui.tooltips;

const Util = imports.misc.util;
const Gettext = imports.gettext;
const Lang = imports.lang;

const XApp = imports.gi.XApp;

const HOME_DIR = GLib.get_home_dir();
const MENU_ITEM_TEXT_LENGTH = 25;

const ICONBROWSER_PROGRAM = "yad-icon-browser";

var menu_item_icon_size;
const UUID = "Direct@claudiux";
Gettext.bindtextdomain(UUID, HOME_DIR + "/.local/share/locale");

function _(str) {
   let customTranslation = Gettext.dgettext(UUID, str);
   if(customTranslation != str) {
      return customTranslation;
   }
   return Gettext.gettext(str);
}

const orig_names = [GLib.get_user_name().toUpperCase(), _("SYSTEM"), _("FAVORITES"), _("APPLICATIONS"), _("RECENT DOCUMENTS")];
const orig_sections = ["User", "System", "Favorites", "FavoriteApps", "RecentDocuments"];

function icon_exists( iconName ) {
    return Gtk.IconTheme.get_default().has_icon( iconName );
}

class IconMenuItem extends PopupMenu.PopupBaseMenuItem {
    constructor(text, icon){
        super();

        this.actor.add_style_class_name("xCenter-menuItem");

        if ( typeof icon == "string" ) {
            icon = new St.Icon({icon_name: icon, icon_size: menu_item_icon_size, icon_type: St.IconType.FULLCOLOR});
        }

        this.addActor(icon);

        let label = new St.Label({ style_class: "xCenter-menuItemLabel", text: text });
        label.clutter_text.ellipsize = Pango.EllipsizeMode.END;
        this.addActor(label);

        let tooltip = new Tooltips.Tooltip(this.actor, text);
    }
}

class FolderTypeMenuItem extends PopupMenu.PopupBaseMenuItem {
    constructor(text, icon, location){
        super();

        this.actor.add_style_class_name("xCenter-menuItem");

        this.addActor(icon);

        let label = new St.Label({ style_class: "xCenter-menuItemLabel", text: text });
        label.clutter_text.ellipsize = Pango.EllipsizeMode.END;
        this.addActor(label);

        let tooltip = new Tooltips.Tooltip(this.actor, text);
    }
}

class VolumeMenuItem extends IconMenuItem {
    constructor(volume, mounted) {
        let icon = volume.get_icon();
        super(volume.get_name(), St.TextureCache.get_default().load_gicon(null, icon, menu_item_icon_size));

        if ( mounted ) {
            let ejectIcon = new St.Icon({ icon_name: "media-eject", icon_size: menu_item_icon_size, icon_type: St.IconType.FULLCOLOR });
            let ejectButton = new St.Button({ child: ejectIcon });
            this.addActor(ejectButton, { span: -1, align: St.Align.END });

            ejectButton.connect("clicked", function() {
                let mount = volume.get_mount();
                mount.eject_with_operation(0, null, null, function(mount, res) {
                    volume.eject_with_operation_finish(res);
                });
            });

            this.connect("activate", function() {
                Gio.app_info_launch_default_for_uri(volume.get_mount().get_root().get_uri(), global.create_app_launch_context());
            });
        }
        else {
            this.connect("activate", function() {
                volume.mount(0, null, null, function(volume, res) {
                    volume.mount_finish(res);
                    Gio.app_info_launch_default_for_uri(volume.get_mount().get_root().get_uri(), global.create_app_launch_context());
                });
            });
        }
    }
}

class PlaceMenuItem extends FolderTypeMenuItem {
    constructor(uri, text, iconName) {
        let fileInfo = Gio.File.new_for_uri(uri).query_info("*", 0, null);

        let icon;
        if ( iconName && icon_exists(iconName) ) {
            icon = new St.Icon({icon_name: iconName, icon_size: menu_item_icon_size, icon_type: St.IconType.FULLCOLOR});
        }
        else {
            icon = St.TextureCache.get_default().load_gicon(null, fileInfo.get_icon(), menu_item_icon_size)
        }

        if ( !text ) text = fileInfo.get_name();

        super(text, icon);

        this.uri = uri;

        this.connect( "activate", (event) => this.launch(event) );
    }

    launch(event) {
        Gio.app_info_launch_default_for_uri(this.uri, global.create_app_launch_context());
    }
}

class RecentFileMenuItem extends IconMenuItem {
    constructor(text, icon, gicon = null, uri, folderApp, showUri=false){
        if ( gicon ) {
            icon = new St.Icon({gicon: gicon, icon_size: menu_item_icon_size, icon_type: St.IconType.FULLCOLOR});
        }

        super(text, icon);

        //~ this.connect("activate", Lang.bind(this, function(actor, event) {
        this.connect("activate", (actor, event) => {
            let button = event.get_button();
            if (button == 3) {
                // Opens the folder containing the file with this file selected:
                let command = "%s %s".format(folderApp, uri);
                Util.spawnCommandLine(command);
            } else {
                Gio.app_info_launch_default_for_uri(uri, global.create_app_launch_context());
            }
        //~ }));
        });

        let info = (showUri) ? decodeURIComponent(uri.replace("file://", "").replace(HOME_DIR, "~")) : text;
        let tooltip = new Tooltips.Tooltip(this.actor, info + '\n' + _("(Right click to open folder)"));
    }
}

class FavoriteMenuItem extends PopupMenu.PopupBaseMenuItem {
    constructor(info, applet, params) {
        super(params);
        let show_full_uri = applet.favoriteShowUri;
        let icon_is_star = applet.favoriteIconIsStar;
        this.box = new St.BoxLayout({ style_class: 'popup-combobox-item', style: 'padding: 0px;' });
        this.info = info;

        let icon;
        if (icon_is_star)
            icon = St.TextureCache.get_default().load_icon_name(null, "starred", St.IconType.FULLCOLOR, applet.iconSize);
        else
            icon = St.TextureCache.get_default().load_gicon(null, Gio.content_type_get_icon(info.cached_mimetype), applet.iconSize);

        let display_text = info.display_name;

        let uri = null;
        let tooltip = null;

        if (show_full_uri) {
            let file = Gio.File.new_for_uri(info.uri);
            if (file.is_native() || file.get_path() != null) {
                uri = file.get_path().replace(HOME_DIR, "~");
            } else {
                uri = info.uri;
            }
            if (uri != null) tooltip = new Tooltips.Tooltip(this.actor, uri);
        }

        this.box.add(icon);

        let label = new St.Label({ text: display_text, y_align: Clutter.ActorAlign.CENTER });
        label.clutter_text.ellipsize = Pango.EllipsizeMode.END;

        this.box.add(label);
        this.addActor(this.box);
    }
}

class FavoriteAppMenuItem extends PopupMenu.PopupBaseMenuItem {
    constructor(name, app, applet, params) {
        super(params);
        if (!app) return;
        this.name = name;
        this.app = app;
        this.box = new St.BoxLayout({ style_class: 'popup-combobox-item', style: 'padding: 0px;' });
        let gicon = app.create_icon_texture(applet.iconSize);
        this.box.add(gicon);
        let label = new St.Label({ text: this.name, y_align: Clutter.ActorAlign.CENTER });
        label.clutter_text.ellipsize = Pango.EllipsizeMode.END;
        this.box.add(label);
        this.addActor(this.box);
    }
}

class DirectApplet extends Applet.TextIconApplet {
    constructor(metadata, orientation, panel_height, instanceId) {
        try {
            super(orientation, panel_height, instanceId);
            this.metadata = metadata;
            this.instanceId = instanceId;
            this.setAllowedLayout(Applet.AllowedLayout.BOTH);
            this.on_orientation_changed(orientation);

            this.appSystem = Cinnamon.AppSystem.get_default();
            this.appFavorites = getAppFavorites();

            this.enterEventId = null;
            this.leaveEventId = null;
            this.iconIsHovered = false;
            this.userSection = new PopupMenu.PopupMenuSection();
            this.systemSection = new PopupMenu.PopupMenuSection();
            this.devicesSection = new PopupMenu.PopupMenuSection();
            this.recentSection = new PopupMenu.PopupMenuSection();
            this.favoriteSection = new PopupMenu.PopupMenuSection();
            this.favAppsSection = new PopupMenu.PopupMenuSection();

            //initiate settings
            this.settings = new Settings.AppletSettings(this, UUID, this.instanceId);
            this.bindSettings();

            //set up panel
            this.setPanelIcon();
            this.setPanelText();
            this._setTooltip();

            //listen for changes
            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, this.orientation);
            // cinna 3.2 and above uses a different func
            if (typeof this.menu.setCustomStyleClass === "function") {
                this.menu.setCustomStyleClass("xCenter-menu");
            } else {
                this.menu.actor.add_style_class_name("xCenter-menu");
            }
            this.menuManager.addMenu(this.menu);
            // (Do not use a new RecentManager but the default one, synchronous with the Cinnamon menu.)
            this.recentManager = Gtk.RecentManager.get_default();
            this.favorites = XApp.Favorites.get_default();
            this._favoriteButtons = [];
            this.favoritesId = this.favorites.connect('changed', () => { this._toggle_menu_when_open() } );
            this.recentManager.connect("changed", () => { this._toggle_menu_when_open() } ); // Becomes useless.
            Main.placesManager.connect("bookmarks-updated", () => { this._toggle_menu_when_open() });
            this.volumeMonitor = Gio.VolumeMonitor.get();
            this.volumeMonitor.connect("volume-added", () => { this._toggle_menu_when_open() } );
            this.volumeMonitor.connect("volume-removed", () => { this._toggle_menu_when_open() } );
            this.volumeMonitor.connect("mount-added", () => { this._toggle_menu_when_open() } );
            this.volumeMonitor.connect("mount-removed", () => { this._toggle_menu_when_open() } );
        } catch(e) {
            global.logError("constructor: " + e);
        }
    }

    _setTooltip() {
        if (this.dontDisplayTooltip)
            this.set_applet_tooltip("");
        else
            this.set_applet_tooltip(_("Direct"));
    }

    _toggle_menu_when_open() {
        if ( this.menu && this.menu.isOpen ) this.menu.toggle();
    }

    _onButtonPressEvent(actor, event) {
        if ( event.get_button() == 2 ) {
            let uri = this.getMiddleClickUri();
            if ( uri ) Gio.app_info_launch_default_for_uri(uri, global.create_app_launch_context());
        }
        return super._onButtonPressEvent(actor, event);
    }

    on_applet_clicked(event) {
        this.menu.toggle();
    }

    on_applet_added_to_panel() {
        this.enterEventId = this.actor.connect("enter-event", (actor, event) => {
            this.iconIsHovered = true;
            this.controlDisplayOrder();
            if ( ! this.menu.isOpen ) {
                this.buildMenu();
                if ( this.openHoveringOver ) {
                    let _to = setTimeout( () => {
                        clearTimeout(_to);
                        if ( this.iconIsHovered )
                            this.menu.open(true);

                    }, 500);
                }
            }
        });
        this.leaveEventId = this.actor.connect("leave-event", (actor, event) => { this.iconIsHovered = false } );
        this.iconBrowserIsPresent = GLib.find_program_in_path(ICONBROWSER_PROGRAM) != null;
    }

    on_applet_removed_from_panel() {
        if ( this.enterEventId )
            this.actor.disconnect(this.enterEventId); // "enter-event"
        if ( this.leaveEventId )
            this.actor.disconnect(this.leaveEventId); // "leave-event"
        if ( this.keyId ) {
            Main.keybindingManager.removeHotKey(this.keyId);
            this.keyId = null;
        }
    }

    on_orientation_changed(orientation) {
        this.orientation = orientation;
        if (orientation == St.Side.LEFT || orientation == St.Side.RIGHT) {
            this.hide_applet_label(true);
        }
        else {
            this.hide_applet_label(false);
        }
    }

    openMenu() {
        this.controlDisplayOrder();
        if ( ! this.menu.isOpen ) this.buildMenu();
        this.menu.toggle();
    }

    bindSettings() {
        this.settings.bind("noIconOnPanel", "noIconOnPanel", this.setPanelIcon);
        this.settings.bind("panelIcon", "panelIcon", this.setPanelIcon);
        this.settings.bind("panelText", "panelText", this.setPanelText);
        this.settings.bind("iconSize", "iconSize");
        this.settings.bind("middleClickPath", "middleClickPath");
        this.settings.bind("dontDisplayTooltip", "dontDisplayTooltip", this._setTooltip);
        this.settings.bind("displayOrder", "displayOrder");
        this.controlDisplayOrder();
        this.settings.bind("showUserSection", "showUserSection");
        this.settings.bind("showDesktop", "showDesktop");
        this.settings.bind("listUserCustomPlaces", "listUserCustomPlaces");
        this.settings.bind("showTrash", "showTrash");
        this.settings.bind("showSystemSection", "showSystemSection");
        this.settings.bind("showComputer", "showComputer");
        this.settings.bind("showRoot", "showRoot");
        this.settings.bind("showVolumes", "showVolumes");
        this.settings.bind("onlyShowMounted", "onlyShowMounted");
        this.settings.bind("showNetwork", "showNetwork");
        this.settings.bind("listSystemCustomPlaces", "listSystemCustomPlaces");
        this.settings.bind("showRecentDocuments", "showRecentDocuments");
        this.settings.bind("showFavorites", "showFavorites");
        this.settings.bind("showFavoriteApps", "showFavoriteApps");
        this.settings.bind("recentSizeLimit", "recentSizeLimit");
        this.settings.bind("favoriteSizeLimit", "favoriteSizeLimit");
        this.settings.bind("sortingMethod", "sortingMethod");
        this.settings.bind("favoriteSortingMethod", "favoriteSortingMethod");
        this.settings.bind("recentShowUri", "recentShowUri");
        this.settings.bind("favoriteShowUri", "favoriteShowUri");
        this.settings.bind("favoriteIconIsStar", "favoriteIconIsStar");
        this.settings.bind("favoriteIconIsStar", "favoriteIconIsStar");
        this.settings.bind("favApps", "favApps");
        this.settings.bind("openHoveringOver", "openHoveringOver");
        this.settings.bind("keyOpen", "keyOpen", this.setKeybinding);
        let recentSizeLimit = this.recentSizeLimit;
        if ( recentSizeLimit % 5 !== 0 ) this.recentSizeLimit = Math.ceil(recentSizeLimit / 5) * 5;
        let favoriteSizeLimit = this.favoriteSizeLimit;
        if ( favoriteSizeLimit % 5 !== 0 ) this.favoriteSizeLimit = Math.ceil(favoriteSizeLimit / 5) * 5;
        this.setKeybinding();
    }

    controlDisplayOrder() {
        var order = [];
        for (let d of this.displayOrder) {
            let section = d["id"];
            if (order.indexOf(section) < 0 && orig_names.indexOf(section) >= 0) order.push(section);
        }
        if (order.length < orig_names.length) {
            for (let name of orig_names) {
                if (order.indexOf(name) < 0 ) order.push(name);
            }
        }
        let displayOrder = [];
        for (let name of order)
            displayOrder.push({"id": name});

        let _to = setTimeout( () => {
            clearTimeout(_to);
            this.displayOrder = displayOrder;
        }, 0);
    }

    setKeybinding() {
        if ( this.keyId ) {
            Main.keybindingManager.removeHotKey(this.keyId);
            this.keyId = null;
        }
        if ( this.keyOpen.length === 0 ) return;
        this.keyId = "Direct-open";
        //~ Main.keybindingManager.addHotKey(this.keyId, this.keyOpen, Lang.bind(this, this.openMenu));
        Main.keybindingManager.addHotKey(this.keyId, this.keyOpen, () => this.openMenu());
    }

    favAppsPopulateList() {
        var favApps = this.favApps;
        var ids = [];
        favApps.forEach(app => { ids.push(app["id"]) });

        let favAppValues = this.appFavorites.getFavorites();
        favAppValues.forEach(value => {
                let name = value.get_name();
                let id = value.get_id();
                if (ids.indexOf(id) < 0) {
                    favApps.push({"menu": true, "name": name, "id": id});
                }
            }
        );

        let _to = setTimeout(() => {
                clearTimeout(_to);
                this.settings.setValue("favApps", favApps);
            },
            2100
        );
    }

    buildMenu() {
        menu_item_icon_size = this.iconSize;

        if ( this.menu ) {
            this.menu.removeAll();
            // As they have been removed, we need to recreate them:
            this.userSection = new PopupMenu.PopupMenuSection();
            this.systemSection = new PopupMenu.PopupMenuSection();
            this.devicesSection = new PopupMenu.PopupMenuSection();
            this.recentSection = new PopupMenu.PopupMenuSection();
            this.favoriteSection = new PopupMenu.PopupMenuSection();
            this.favAppsSection = new PopupMenu.PopupMenuSection();
        } else return;

        let section = new PopupMenu.PopupMenuSection();
        let mainBox = new St.BoxLayout({ style_class: "xCenter-mainBox", vertical: false });
        let userPaneBox = new St.BoxLayout({ style_class: "xCenter-pane" });
        let userPane = new PopupMenu.PopupMenuSection();
        let userTitle = new PopupMenu.PopupBaseMenuItem({ style_class: "xCenter-title", reactive: false });
        let userSearchButton = new St.Button();
        let userSearchImage = new St.Icon({ icon_name: "edit-find", icon_size: 16, icon_type: St.IconType.SYMBOLIC });
        let userScrollBox = new St.ScrollView({ style_class: "xCenter-scrollBox", x_fill: true, y_fill: false, y_align: St.Align.START });
        let userVscroll = userScrollBox.get_vscroll_bar();

        this.menu.addMenuItem(section);
        section.actor.add_actor(mainBox);

        let systemPaneBox = new St.BoxLayout({ style_class: "xCenter-pane" });
        let favoritesPaneBox = new St.BoxLayout({ style_class: "xCenter-pane" });
        let favAppsPaneBox = new St.BoxLayout({ style_class: "xCenter-pane" });
        let recentPaneBox = new St.BoxLayout({ style_class: "xCenter-pane" });

		let userSettingsImage = new St.Icon({ icon_name: "system-settings", icon_size: 16, icon_type: St.IconType.SYMBOLIC });
		let systemSettingsImage = new St.Icon({ icon_name: "system-settings", icon_size: 16, icon_type: St.IconType.SYMBOLIC });
		let favoritesSettingsImage = new St.Icon({ icon_name: "system-settings", icon_size: 16, icon_type: St.IconType.SYMBOLIC });
		let favAppsSettingsImage = new St.Icon({ icon_name: "system-settings", icon_size: 16, icon_type: St.IconType.SYMBOLIC });
		let recentSettingsImage = new St.Icon({ icon_name: "system-settings", icon_size: 16, icon_type: St.IconType.SYMBOLIC });
        let userSettingsButton = new St.Button();
        let systemSettingsButton = new St.Button();
        let favoritesSettingsButton = new St.Button();
        let favAppsSettingsButton = new St.Button();
        let recentSettingsButton = new St.Button();
        
        
        let order = [];
            for (let d of this.displayOrder) order.push(d["id"]);
            for (let o of order) {
                switch(orig_sections[orig_names.indexOf(o)]) {
                    case "User":
                        if (this.showUserSection) {
                            mainBox.add_actor(userPaneBox);
                        }
                        break;
                    case "System":
                        if (this.showSystemSection) {
                            mainBox.add_actor(systemPaneBox);
                        }
                        break;
                    case "Favorites":
                        if (this.showFavorites) {
                            mainBox.add_actor(favoritesPaneBox);
                        }
                        break;
                    case "FavoriteApps":
                        if (this.showFavoriteApps) {
                            mainBox.add_actor(favAppsPaneBox);
                        }
                        break;
                    case "RecentDocuments":
                        if (this.showRecentDocuments) {
                            mainBox.add_actor(recentPaneBox);
                        }
                        break;

                }
            }


        try {

            //User section
            if (this.showUserSection) {
                userPaneBox.add_actor(userPane.actor);

                userPane.addMenuItem(userTitle);
                userTitle.addActor(new St.Label({ text: GLib.get_user_name().toUpperCase() }));
                section._connectSubMenuSignals(userPane, userPane);

                //add link to search tool
                userTitle.addActor(userSearchButton);

                userSearchButton.add_actor(userSearchImage);
                //~ userSearchButton.connect("clicked", Lang.bind(this, this.search, HOME_DIR));
                userSearchButton.connect("clicked", (a, b) => this.search(a, b, HOME_DIR));
                new Tooltips.Tooltip(userSearchButton, _("Search Home Folder"));
                
                //add link to user settings tab
                userTitle.addActor(userSettingsButton);
                userSettingsButton.add_actor(userSettingsImage);
                userSettingsButton.connect("clicked", () => { this.menu.toggle(); this.configureApplet(1); });
                new Tooltips.Tooltip(userSettingsButton, _("Configure"));

                // create a scrollbox for large user section, if any

                userPane.actor.add_actor(userScrollBox);
                userScrollBox.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC);

                userVscroll.connect("scroll-start", () => { this.menu.passEvents = true; });
                userVscroll.connect("scroll-stop", () => { this.menu.passEvents = false; });

                userScrollBox.add_actor(this.userSection.actor);
                userPane._connectSubMenuSignals(this.userSection, this.userSection);

                this.buildUserSection();
            }

            //system section
            if (this.showSystemSection) {
                let systemPane = new PopupMenu.PopupMenuSection();
                systemPaneBox.add_actor(systemPane.actor);
                let systemTitle = new PopupMenu.PopupBaseMenuItem({ style_class: "xCenter-title", reactive: false });
                systemPane.addMenuItem(systemTitle);
                systemTitle.addActor(new St.Label({ text: _("SYSTEM") }));
                section._connectSubMenuSignals(systemPane, systemPane);

                //add link to search tool
                let systemSearchButton = new St.Button();
                systemTitle.addActor(systemSearchButton);
                systemTitle.addActor(systemSettingsButton);
                let systemSearchImage = new St.Icon({ icon_name: "edit-find", icon_size: 16, icon_type: St.IconType.SYMBOLIC });
                systemSearchButton.add_actor(systemSearchImage);
                //~ systemSearchButton.connect("clicked", Lang.bind(this, this.search));
                systemSearchButton.connect("clicked", (a, b) => this.search(a, b));
                new Tooltips.Tooltip(systemSearchButton, _("Search File System"));
                
                //add link to system settings tab
                systemTitle.addActor(systemSettingsButton);
                systemSettingsButton.add_actor(systemSettingsImage);
                systemSettingsButton.connect("clicked", () => {  this.menu.toggle(); this.configureApplet(2); });
                new Tooltips.Tooltip(systemSettingsButton, _("Configure"));

                // create a scrollbox for large system section, if any
                let systemScrollBox = new St.ScrollView({ style_class: "xCenter-scrollBox", x_fill: true, y_fill: false, y_align: St.Align.START });
                systemPane.actor.add_actor(systemScrollBox);
                systemScrollBox.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC);
                let systemVscroll = systemScrollBox.get_vscroll_bar();
                //~ systemVscroll.connect("scroll-start", Lang.bind(this, function() { this.menu.passEvents = true; }));
                //~ systemVscroll.connect("scroll-stop", Lang.bind(this, function() { this.menu.passEvents = false; }));
                systemVscroll.connect("scroll-start", () => { this.menu.passEvents = true; });
                systemVscroll.connect("scroll-stop", () => { this.menu.passEvents = false; });

                systemScrollBox.add_actor(this.systemSection.actor);
                systemPane._connectSubMenuSignals(this.systemSection, this.systemSection);

                this.buildSystemSection();
            }

            //favorite documents section
            if ( this.showFavorites && this.favorites.get_n_favorites() > 0 ) {
                let favoritesPane = new PopupMenu.PopupMenuSection();
                favoritesPaneBox.add_actor(favoritesPane.actor);
                section._connectSubMenuSignals(favoritesPane, favoritesPane);

                let favoritesTitle = new PopupMenu.PopupMenuItem(_("FAVORITES"), { style_class: "xCenter-title", reactive: false });
                favoritesPane.addMenuItem(favoritesTitle);
                
                //add link to favorites settings tab
                favoritesTitle.addActor(favoritesSettingsButton);
                favoritesSettingsButton.add_actor(favoritesSettingsImage);
                favoritesSettingsButton.connect("clicked", () => { this.menu.toggle(); this.configureApplet(3); });
                new Tooltips.Tooltip(favoritesSettingsButton, _("Configure"));

				// create a scrollbox for large favorites section, if any
                let favoritesScrollBox = new St.ScrollView({ style_class: "xCenter-scrollBox", x_fill: true, y_fill: false, y_align: St.Align.START });
                favoritesPane.actor.add_actor(favoritesScrollBox);
                favoritesScrollBox.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC);
                let favVscroll = favoritesScrollBox.get_vscroll_bar();
                //~ favVscroll.connect("scroll-start", Lang.bind(this, function() { this.menu.passEvents = true; }));
                //~ favVscroll.connect("scroll-stop", Lang.bind(this, function() { this.menu.passEvents = false; }));
                favVscroll.connect("scroll-start", () => { this.menu.passEvents = true; });
                favVscroll.connect("scroll-stop", () => { this.menu.passEvents = false; });

                favoritesScrollBox.add_actor(this.favoriteSection.actor);
                favoritesPane._connectSubMenuSignals(this.favoriteSection, this.favoriteSection);

                this.buildFavoritesSection();
            }

            //favorite apps section
            if ( this.showFavoriteApps && this.favApps.length > 0 ) {
                let favAppsPane = new PopupMenu.PopupMenuSection();
                favAppsPaneBox.add_actor(favAppsPane.actor);
                section._connectSubMenuSignals(favAppsPane, favAppsPane);

                let favAppsTitle = new PopupMenu.PopupMenuItem(_("APPLICATIONS"), { style_class: "xCenter-title", reactive: false });
                favAppsPane.addMenuItem(favAppsTitle);

                //add link to favorites settings tab
                favAppsTitle.addActor(favAppsSettingsButton);
                favAppsSettingsButton.add_actor(favAppsSettingsImage);
                favAppsSettingsButton.connect("clicked", () => { this.menu.toggle(); this.configureApplet(3); });
                new Tooltips.Tooltip(favAppsSettingsButton, _("Configure"));

				// create a scrollbox for large favorites section, if any
				let favAppsScrollBox = new St.ScrollView({ style_class: "xCenter-scrollBox", x_fill: true, y_fill: false, y_align: St.Align.START });
                favAppsPane.actor.add_actor(favAppsScrollBox);
                favAppsScrollBox.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC);
                let favAppsVscroll = favAppsScrollBox.get_vscroll_bar();
                //~ favAppsVscroll.connect("scroll-start", Lang.bind(this, function() { this.menu.passEvents = true; }));
                //~ favAppsVscroll.connect("scroll-stop", Lang.bind(this, function() { this.menu.passEvents = false; }));
                favAppsVscroll.connect("scroll-start", () => { this.menu.passEvents = true; });
                favAppsVscroll.connect("scroll-stop", () => { this.menu.passEvents = false; });

                favAppsScrollBox.add_actor(this.favAppsSection.actor);
                favAppsPane._connectSubMenuSignals(this.favAppsSection, this.favAppsSection);

                this.buildFavAppsSection();
            }

            //recent documents section
            if ( this.showRecentDocuments ) {
                let recentPane = new PopupMenu.PopupMenuSection();
                recentPaneBox.add_actor(recentPane.actor);
                section._connectSubMenuSignals(recentPane, recentPane);

                let recentTitle = new PopupMenu.PopupMenuItem(_("RECENT DOCUMENTS"), { style_class: "xCenter-title", reactive: false });
                recentPane.addMenuItem(recentTitle);
                
                //add link to recent documents settings tab
                recentTitle.addActor(recentSettingsButton);
                recentSettingsButton.add_actor(recentSettingsImage);
                recentSettingsButton.connect("clicked", () => { this.menu.toggle(); this.configureApplet(4); });
                new Tooltips.Tooltip(recentSettingsButton, _("Configure"));

				// create a scrollbox for large recent documents section, if any
                let recentScrollBox = new St.ScrollView({ style_class: "xCenter-scrollBox", x_fill: true, y_fill: false, y_align: St.Align.START });
                recentPane.actor.add_actor(recentScrollBox);
                recentScrollBox.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC);
                let vscroll = recentScrollBox.get_vscroll_bar();
                vscroll.connect("scroll-start", Lang.bind(this, function() { this.menu.passEvents = true; }));
                vscroll.connect("scroll-stop", Lang.bind(this, function() { this.menu.passEvents = false; }));

                recentScrollBox.add_actor(this.recentSection.actor);
                recentPane._connectSubMenuSignals(this.recentSection, this.recentSection);

                this.clearRecent = new IconMenuItem(_("Clear"), "edit-clear");
                recentPane.addMenuItem(this.clearRecent);
                this.clearRecent.connect("activate", Lang.bind(this, function() {
                    this.recentManager.purge_items();
                    this.recentSection.removeAll();
                }));

                this.openRecent = new IconMenuItem(_("Recent"), "folder-recent");
                recentPane.addMenuItem(this.openRecent);
                this.openRecent.connect("activate", () => {
                    Util.spawnCommandLineAsync("xdg-open recent:///");
                });

                this.buildRecentDocumentsSection();
            }


        } catch(e) {
            global.logError("buildMenu(): " + e);
        }
    }

    buildUserSection() {
        if (this.userSection) this.userSection.removeAll();
        else this.userSection = new PopupMenu.PopupMenuSection();

        this.trashItem = null;

        let defaultPlaces = Main.placesManager.getDefaultPlaces();
        let bookmarks = [defaultPlaces[0]]
        if ( this.showDesktop ) bookmarks.push(defaultPlaces[1]);
        bookmarks = bookmarks.concat(Main.placesManager.getBookmarks());

        for ( let bookmark of bookmarks ) {
            let bookmarkItem = new FolderTypeMenuItem(bookmark.name, bookmark.iconFactory(menu_item_icon_size));
            this.userSection.addMenuItem(bookmarkItem);
            let launch = bookmark.launch;
            bookmarkItem.connect("activate", Lang.bind(this, function() {
                launch();
            }));
        }

        //custom places
        this.buildCustomPlaces(this.listUserCustomPlaces, this.userSection);

        //trash
        this.buildTrashItem();
    }

    buildSystemSection() {
        if ( this.systemSection ) this.systemSection.removeAll();
        else this.systemSection = new PopupMenu.PopupMenuSection();

        //computer
        if ( this.showComputer ) {
            let computer = new PlaceMenuItem("computer:///", _("Computer"), "computer");
            this.systemSection.addMenuItem(computer);
        }

        //file system
        if ( this.showRoot) {
            let fileSystem = new PlaceMenuItem("file:///", _("File System"), "drive-harddisk");
            this.systemSection.addMenuItem(fileSystem);
        }

        //volumes and mounts
        if ( this.showVolumes ) {
            if ( ! this.devicesSection )
                this.devicesSection = new PopupMenu.PopupMenuSection();
            this.systemSection.addMenuItem(this.devicesSection);
            this.buildDevicesSection();
        }

        //custom places
        this.buildCustomPlaces(this.listSystemCustomPlaces, this.systemSection);

        //network items
        if ( this.showNetwork ) {
            let network = new PlaceMenuItem("network:///", _("Network"), "network-workgroup");
            this.systemSection.addMenuItem(network);

            if (Main.placesManager.getDefaultPlaces().length > 2) {
                let bookmark = Main.placesManager.getDefaultPlaces()[2];
                let connectToItem = new IconMenuItem(bookmark.name, bookmark.iconFactory(menu_item_icon_size));
                this.systemSection.addMenuItem(connectToItem);
                connectToItem.connect("activate", Lang.bind(this, function() {
                    bookmark.launch();
                }));
            }
        }
    }

    buildCustomPlaces(list, container) {
        if ( list.length === 0 ) return;
        for (let item of list) {
            let place = item["uri"].trim();
            if ( place.length === 0) continue;
            place = place.replace("~/", HOME_DIR + "/");
            if ( place.search("://") == -1 ) place = "file://" + place;
            let file = Gio.File.new_for_uri(place);
            if ( file.query_exists(null) ) {
                let text = ( item["name"].trim().length > 0 ) ? item["name"] : GLib.basename( item["uri"].trim() );
                let iconName = ( item["icon"].trim().length > 0 ) ? item["icon"] : null;
                let customPlace = new PlaceMenuItem(place, text, iconName);
                container.addMenuItem(customPlace);
            }
        }
    }

    buildDevicesSection() {
        if ( this.devicesSection ) this.devicesSection.removeAll();
        else this.devicesSection = new PopupMenu.PopupMenuSection();

        let volumes = this.volumeMonitor.get_volumes();
        let mounts = this.volumeMonitor.get_mounts();

        for ( let volume of volumes ) {
            let mounted = false;
            for ( let j = 0; j < mounts.length; j++ ) {
                if ( volume.get_name() == mounts[j].get_name() ) mounted = true;
            }

            if ( !mounted && this.onlyShowMounted ) continue;
            let volumeMenuItem = new VolumeMenuItem(volume, mounted);
            this.devicesSection.addMenuItem(volumeMenuItem);
        }
    }

    buildFavoritesSection() {
        if ( !this.showFavorites || this.favorites.get_n_favorites() === 0 ) return;
        if ( this.favoriteSection ) this.favoriteSection.removeAll();
        else this.favoriteSection = new PopupMenu.PopupMenuSection();

        for (let i = 0; i < this._favoriteButtons.length; i ++) {
            this._favoriteButtons[i].destroy();
        }
        this._favoriteButtons = [];
        var infos = this.favorites.get_favorites(null);

        for (let i = infos.length - 1; i >= 0 ; i-- ) {
            const _file = Gio.File.new_for_uri(infos[i].uri);
            if ( ! _file.query_exists(null) )
                infos.splice(i, 1);
        }

        if (this.favoriteSortingMethod === "byName") {
            infos = infos.sort ( function(a, b) {
                    const aName = a.display_name.toLowerCase();
                    const bName = b.display_name.toLowerCase();
                    if ( aName < bName ) return -1;
                    else if ( aName > bName ) return 1;
                    else return 0;
                }
            );
        } else if (this.favoriteSortingMethod === "byPath") {
            infos = infos.sort ( function(a, b) {
                    if (a.uri < b.uri) return -1;
                    else if (a.uri > b.uri) return 1;
                    else return 0;
                }
            );
        }

        if ( this.favoriteSizeLimit !== 0 && this.favorites.get_n_favorites() > this.favoriteSizeLimit )
            infos = infos.slice( 0, this.favoriteSizeLimit );

        if (infos.length > 0) {
            for (let i = 0; i < infos.length; i++) {
                let info = infos[i];

                let button = new FavoriteMenuItem(info, this);

                button.connect("activate", (button, event)=> {
                    this.favorites.launch(button.info.uri, event.get_time());
                    this.menu.toggle();
                })

                this._favoriteButtons.push(button);
                this.favoriteSection.addMenuItem(button);
            }
        }
    }

    buildFavAppsSection() {
        if ( !this.showFavoriteApps || this.favApps.length === 0 ) return;
        if ( this.favAppsSection ) this.favAppsSection.removeAll();
        else this.favAppsSection = new PopupMenu.PopupMenuSection();

        let favAppValues = this.appFavorites.getFavorites();

        for (let app of this.favApps) {
            if (!app["menu"]) continue;
            let _app = this.appSystem.lookup_app(app["id"]);
            if (_app) {
                let button = new FavoriteAppMenuItem(app["name"], _app, this);
                button.connect("activate", (button, event)=> {
                    button.app.activate();
                    this.menu.toggle();
                })

                this.favAppsSection.addMenuItem(button);
            }
        }
    }

    buildRecentDocumentsSection() {
        if ( !this.showRecentDocuments ) return;
        if ( this.recentSection ) this.recentSection.removeAll();
        else this.recentSection = new PopupMenu.PopupMenuSection();

        var recentDocuments = this.recentManager.get_items();

        if (this.sortingMethod === "added") {
            recentDocuments = recentDocuments.sort(
                function(a, b) {
                    if (!a || !b) return 0;
                    const aAddedTime = a.get_added();
                    const bAddedTime = b.get_added();
                    if (!aAddedTime || !bAddedTime) return 0;
                    return Math.sign(bAddedTime - aAddedTime);
                }
            );
        } else if (this.sortingMethod === "access") {
            recentDocuments = recentDocuments.sort(
                function(a, b) {
                    if (!a || !b) return 0;
                    const aAccessTime = a.get_visited();
                    const bAccessTime = b.get_visited();
                    if (!aAccessTime || !bAccessTime) return 0;
                    return Math.sign(bAccessTime - aAccessTime);
                }
            );
        } else if (this.sortingMethod === "modification") {
            recentDocuments = recentDocuments.sort(
                function(a, b) {
                    if (!a || !b) return 0;
                    const aModifTime = a.get_modified();
                    const bModifTime = b.get_modified();
                    if (!aModifTime || !bModifTime) return 0;
                    return Math.sign(bModifTime - aModifTime);
                }
            );
        }

        let appOpeningFolders = Gio.app_info_get_default_for_type('inode/directory', false).get_executable(); // usually returns: nemo

        let showCount;
        if ( this.recentSizeLimit == 0 ) showCount = recentDocuments.length;
        else showCount = ( this.recentSizeLimit < recentDocuments.length ) ? this.recentSizeLimit : recentDocuments.length;

        if ( showCount == 0 ) this.clearRecent.actor.hide();
        else this.clearRecent.actor.show();

        let i = 0;
        while ( i < showCount ) {
            let recentInfo = recentDocuments[i];

            let file = Gio.file_new_for_path( "%s".format(recentInfo.get_uri_display()) );
            if ( file.query_exists(null) ) {
                let mimeType = "unknown";
                let gicon = null;
                let recentItem;

                let default_for_type = Gio.app_info_get_default_for_type(recentInfo.get_mime_type(), false);
                if ( default_for_type ) {
                    let application = default_for_type.get_executable();
                    gicon = default_for_type.get_icon();
                    if ( !gicon && application && !icon_exists(mimeType) ) {
                        mimeType = application; // Try replacing the unknown mimeType icon with the application's one.
                        if ( !icon_exists(mimeType) ) mimeType = "unknown"; // Desperate case. (Apps without mime type recognized nor icon.)
                    }
                } else {
                    mimeType = recentInfo.get_mime_type().replace("\/","-");

                    // Fixes some oversights in Gtk's mime types (example: for .xcf Gimp files ):
                    if ( mimeType.substr(0, 6) === "image-" && mimeType.substr(0, 8) !== "image-x-" && !icon_exists(mimeType) ) {
                        mimeType = mimeType.replace("image-", "image-x-");
                        if ( !icon_exists(mimeType) ) mimeType = "unknown";
                    }
                }

                if ( gicon ) {
                    recentItem = new RecentFileMenuItem(recentInfo.get_display_name(), null, gicon, recentInfo.get_uri(), appOpeningFolders, this.recentShowUri );
                } else {
                    recentItem = new RecentFileMenuItem(recentInfo.get_display_name(), mimeType, null, recentInfo.get_uri(), appOpeningFolders, this.recentShowUri );
                }
                this.recentSection.addMenuItem(recentItem);
            } else if ( showCount < recentDocuments.length ) {
                showCount++; // To be sure to show as much as possible the number of recent files requested.
            }

            i++;
        }
    }

    updateVolumes() {
        if ( this.updatingDevices ) return;
        this.updatingDevices = true;
        this.buildDevicesSection();
        this.updatingDevices = false;
        this.buildUserSection();
    }

    buildTrashItem() {
        if ( this.trashItem != null ) return;
        if ( this.showTrash == 0 ) return;

        let uri = "trash:///";
        let trash = Gio.File.new_for_uri(uri);
        if ( !this.trashMonitor ) {
            this.trashMonitor = trash.monitor_directory(0, null);
            this.trashMonitor.connect("changed", Lang.bind(this, this.buildTrashItem));
        }

        let enumerator = trash.enumerate_children("*", 0, null);
        let trashcanEmpty = enumerator.next_file(null) == null;

        if ( this.showTrash == 2 && trashcanEmpty ) return;

        let iName = ( trashcanEmpty ) ? "trashcan_empty" : "trashcan_full";

        this.trashItem = new PlaceMenuItem(uri, _("Trash"), iName);
        this.userSection.addMenuItem(this.trashItem);
    }

    setPanelIcon() {
        if ( this.panelIcon == "" ||
           ( GLib.path_is_absolute(this.panelIcon) &&
             GLib.file_test(this.panelIcon, GLib.FileTest.EXISTS) ) ) {
            if ( this.panelIcon.search("-symbolic.svg") == -1 ) this.set_applet_icon_path(this.panelIcon);
            else this.set_applet_icon_symbolic_path(this.panelIcon);
        }
        else if ( icon_exists(this.panelIcon) ) {
            if ( this.panelIcon.search("-symbolic") != -1 ) this.set_applet_icon_symbolic_name(this.panelIcon);
            else this.set_applet_icon_name(this.panelIcon);
        }
        else this.set_applet_icon_name("folder-saved-search");

        if ( this.noIconOnPanel && this.panelText.length > 0 ) this._applet_icon_box.hide();
        else this._applet_icon_box.show();
    }

    setPanelText() {
        if ( this.panelText ) {
            this.set_applet_label(this.panelText);
        } else {
            this.noIconOnPanel = false;
            this.set_applet_label("");
        }
        this.setPanelIcon();
    }

    getMiddleClickUri() {
        if ( this.middleClickPath == "") return false;

        let path = this.middleClickPath.replace("~", HOME_DIR);
        if ( path.search("://") != -1 ) return path;

        if ( GLib.path_is_absolute(path) &&
             GLib.file_test(path, GLib.FileTest.EXISTS) ) {
            return Gio.file_new_for_path(path).get_uri();
        }

        return Gio.file_new_for_path(HOME_DIR).get_uri();
    }

    search(a, b, directory) {
        this.menu.close();
        let command = this.metadata.path + "/search.py ";
        if ( directory ) command += directory;
        Util.spawnCommandLine(command);
    }

    set_applet_icon_symbolic_path(icon_path) {
        if (this._applet_icon_box.child) this._applet_icon_box.child.destroy();

        if (icon_path){
            let file = Gio.file_new_for_path(icon_path);
            let gicon = new Gio.FileIcon({ file: file });
            if (this._scaleMode) {
                let height = (this._panelHeight / DEFAULT_PANEL_HEIGHT) * PANEL_SYMBOLIC_ICON_DEFAULT_HEIGHT;
                this._applet_icon = new St.Icon({gicon: gicon, icon_size: height,
                                                icon_type: St.IconType.SYMBOLIC, reactive: true, track_hover: true, style_class: "applet-icon" });
            } else {
                this._applet_icon = new St.Icon({gicon: gicon, icon_size: 22, icon_type: St.IconType.FULLCOLOR, reactive: true, track_hover: true, style_class: "applet-icon" });
            }
            this._applet_icon_box.child = this._applet_icon;
        }
        this.__icon_type = -1;
        this.__icon_name = icon_path;
    }

    on_btnPrivacy_pressed() {
        Util.spawnCommandLine("bash -c 'cinnamon-settings privacy'");
    }

    on_btnIconBrowser_pressed() {
        Util.spawnCommandLineAsync(ICONBROWSER_PROGRAM);
    }
    
    closeSettingsWindow() {
        if (this.settingsWindow != undefined) {
            try {
                this.settingsWindow.delete(300);
            } catch(e) {}
        }
        this.settingsWindow = undefined;
    }

    configureApplet(tab=0) {
        const maximize_vertically = true;
        const VERTICAL = 2;
        this._applet_context_menu.close(false);

        this.closeSettingsWindow();

        let pid = Util.spawnCommandLine(`cinnamon-settings applets ${UUID} -i ${this.instanceId} -t ${tab}`);

        if (maximize_vertically) {
          var app = null;
          var intervalId = null;
          intervalId = setTimeout(() => {
                clearTimeout(intervalId);
                app = windowTracker.get_app_from_pid(pid);
                if (app != null) {
                    let window = app.get_windows()[0];
                    this.settingsTab = tab;

                    window.maximize(VERTICAL);
                    window.activate(300);
                    this.settingsWindow = window;
                    app.connect("windows-changed", () => { this.settingsWindow = undefined; });
                    this._removeEnlightenment();
                }
            }, 600);
        }
        // Returns the pid:
        return pid;
    }

    _removeEnlightenment() {
        this.highlight(false);
    }
}


function main(metadata, orientation, panel_height, instanceId) {
    let directApplet = new DirectApplet(metadata, orientation, panel_height, instanceId);
    return directApplet;
}
