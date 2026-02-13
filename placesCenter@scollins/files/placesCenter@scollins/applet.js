const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;
const Pango = imports.gi.Pango;
const St = imports.gi.St;

const Applet = imports.ui.applet;
const Main = imports.ui.main;
const ModalDialog = imports.ui.modalDialog;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;
const Tooltips = imports.ui.tooltips;

const Util = imports.misc.util;
const Gettext = imports.gettext;
const Lang = imports.lang;

const HOME_DIR = GLib.get_home_dir();
const MENU_ITEM_TEXT_LENGTH = 25;
let menu_item_icon_size;
let uuid;


function _(str) {
   let customTranslation = Gettext.dgettext(uuid, str);
   if(customTranslation != str) {
      return customTranslation;
   }
   return Gettext.gettext(str);
}

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

        if ( !text ) text = fileInfo.get_name()

        super(text, icon);

        this.uri = uri;

        this.connect("activate", Lang.bind(this, this.launch));
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

        this.connect("activate", Lang.bind(this, function(actor, event) {
            let button = event.get_button();
            if (button == 3) {
                // Opens the folder containing the file with this file selected:
                let command = "%s %s".format(folderApp, uri);
                Util.spawnCommandLine(command);
            } else {
                Gio.app_info_launch_default_for_uri(uri, global.create_app_launch_context());
            }
        }));

        let info = (showUri) ? decodeURIComponent(uri.replace("file://", "").replace(HOME_DIR, "~")) : text;
        let tooltip = new Tooltips.Tooltip(this.actor, info + '\n' + _("(Right click to open folder)"));
    }
}

class MyApplet extends Applet.TextIconApplet {
    constructor(metadata, orientation, panel_height, instanceId) {
        try {
            super(orientation, panel_height, instanceId);
            this.metadata = metadata;
            this.instanceId = instanceId;
            this.setAllowedLayout(Applet.AllowedLayout.BOTH);
            this.on_orientation_changed(orientation);

            uuid = metadata.uuid;
            Gettext.bindtextdomain(uuid, HOME_DIR + "/.local/share/locale");

            //initiate settings
            this.bindSettings();

            //set up panel
            this.setPanelIcon();
            this.setPanelText();
            this.set_applet_tooltip(_("Places"));

            //listen for changes
            this.menuManager = new PopupMenu.PopupMenuManager(this);
            // (Do not use a new RecentManager but the default one, synchronous with the Cinnamon menu.)
            this.recentManager = Gtk.RecentManager.get_default();
            this.recentManager.connect("changed", Lang.bind(this, this.buildRecentDocumentsSection));
            Main.placesManager.connect("bookmarks-updated", Lang.bind(this, this.buildUserSection));
            this.volumeMonitor = Gio.VolumeMonitor.get();
            this.volumeMonitor.connect("volume-added", Lang.bind(this, this.updateVolumes));
            this.volumeMonitor.connect("volume-removed", Lang.bind(this, this.updateVolumes));
            this.volumeMonitor.connect("mount-added", Lang.bind(this, this.updateVolumes));
            this.volumeMonitor.connect("mount-removed", Lang.bind(this, this.updateVolumes));

            this.buildMenu();
        } catch(e) {
            global.logError(e);
        }
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

    on_applet_removed_from_panel() {
        if ( this.keyId ) Main.keybindingManager.removeHotKey(this.keyId);
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
        this.menu.toggle();
    }

    bindSettings() {
        this.settings = new Settings.AppletSettings(this, this.metadata.uuid, this.instanceId);
        this.settings.bindProperty(Settings.BindingDirection.IN, "panelIcon", "panelIcon", this.setPanelIcon);
        this.settings.bindProperty(Settings.BindingDirection.IN, "panelText", "panelText", this.setPanelText);
        this.settings.bindProperty(Settings.BindingDirection.IN, "iconSize", "iconSize", this.buildMenu);
        this.settings.bindProperty(Settings.BindingDirection.IN, "middleClickPath", "middleClickPath");
        this.settings.bindProperty(Settings.BindingDirection.IN, "showDesktop", "showDesktop", this.buildUserSection);
        this.settings.bindProperty(Settings.BindingDirection.IN, "userCustomPlaces", "userCustomPlaces", this.buildUserSection);
        this.settings.bindProperty(Settings.BindingDirection.IN, "showTrash", "showTrash", this.buildTrashItem);
        this.settings.bindProperty(Settings.BindingDirection.IN, "showComputer", "showComputer", this.buildSystemSection);
        this.settings.bindProperty(Settings.BindingDirection.IN, "showRoot", "showRoot", this.buildSystemSection);
        this.settings.bindProperty(Settings.BindingDirection.IN, "showVolumes", "showVolumes", this.buildSystemSection);
        this.settings.bindProperty(Settings.BindingDirection.IN, "onlyShowMounted", "onlyShowMounted", this.buildSystemSection);
        this.settings.bindProperty(Settings.BindingDirection.IN, "showNetwork", "showNetwork", this.buildSystemSection);
        this.settings.bindProperty(Settings.BindingDirection.IN, "systemCustomPlaces", "systemCustomPlaces", this.buildSystemSection);
        this.settings.bindProperty(Settings.BindingDirection.IN, "showRecentDocuments", "showRecentDocuments", this.buildMenu);
        this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "recentSizeLimit", "recentSizeLimit", this.buildRecentDocumentsSection);
        this.settings.bindProperty(Settings.BindingDirection.IN, "recentShowUri", "recentShowUri", this.buildRecentDocumentsSection);
        this.settings.bindProperty(Settings.BindingDirection.IN, "keyOpen", "keyOpen", this.setKeybinding);
        let recentSizeLimit = this.recentSizeLimit;
        if ( recentSizeLimit % 5 !== 0 ) this.recentSizeLimit = Math.ceil(recentSizeLimit / 5) * 5;
        this.setKeybinding();
    }

    setKeybinding() {
        if ( this.keyId ) Main.keybindingManager.removeHotKey(this.keyId);
        if ( this.keyOpen == "" ) return;
        this.keyId = "placesCenter-open";
        Main.keybindingManager.addHotKey(this.keyId, this.keyOpen, Lang.bind(this, this.openMenu));
    }

    buildMenu() {
        try {
            if ( this.menu ) this.menu.destroy();

            menu_item_icon_size = this.iconSize;

            this.menu = new Applet.AppletPopupMenu(this, this.orientation);
            // cinna 3.2 and above uses a different func
            if (typeof this.menu.setCustomStyleClass === "function") {
                this.menu.setCustomStyleClass("xCenter-menu");
            } else {
                this.menu.actor.add_style_class_name("xCenter-menu");
            }
            this.menuManager.addMenu(this.menu);
            let section = new PopupMenu.PopupMenuSection();
            this.menu.addMenuItem(section);
            let mainBox = new St.BoxLayout({ style_class: "xCenter-mainBox", vertical: false });
            section.actor.add_actor(mainBox);

            //User section
            let userPaneBox = new St.BoxLayout({ style_class: "xCenter-pane" });
            let userPane = new PopupMenu.PopupMenuSection();
            userPaneBox.add_actor(userPane.actor);
            let userTitle = new PopupMenu.PopupBaseMenuItem({ style_class: "xCenter-title", reactive: false });
            userPane.addMenuItem(userTitle);
            userTitle.addActor(new St.Label({ text: GLib.get_user_name().toUpperCase() }));
            section._connectSubMenuSignals(userPane, userPane);

            //add link to search tool
            let userSearchButton = new St.Button();
            userTitle.addActor(userSearchButton);
            let userSearchImage = new St.Icon({ icon_name: "edit-find", icon_size: 10, icon_type: St.IconType.SYMBOLIC });
            userSearchButton.add_actor(userSearchImage);
            userSearchButton.connect("clicked", Lang.bind(this, this.search, HOME_DIR));
            new Tooltips.Tooltip(userSearchButton, _("Search Home Folder"));

            // create a scrollbox for large user section, if any
            let userScrollBox = new St.ScrollView({ style_class: "xCenter-scrollBox", x_fill: true, y_fill: false, y_align: St.Align.START });
            userPane.actor.add_actor(userScrollBox);
            userScrollBox.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC);
            let userVscroll = userScrollBox.get_vscroll_bar();
            userVscroll.connect("scroll-start", Lang.bind(this, function() { this.menu.passEvents = true; }));
            userVscroll.connect("scroll-stop", Lang.bind(this, function() { this.menu.passEvents = false; }));

            this.userSection = new PopupMenu.PopupMenuSection();
            userScrollBox.add_actor(this.userSection.actor);
            userPane._connectSubMenuSignals(this.userSection, this.userSection);

            mainBox.add_actor(userPaneBox);
            this.buildUserSection();

            //system section
            let systemPaneBox = new St.BoxLayout({ style_class: "xCenter-pane" });
            let systemPane = new PopupMenu.PopupMenuSection();
            systemPaneBox.add_actor(systemPane.actor);
            let systemTitle = new PopupMenu.PopupBaseMenuItem({ style_class: "xCenter-title", reactive: false });
            systemPane.addMenuItem(systemTitle);
            systemTitle.addActor(new St.Label({ text: _("SYSTEM") }));
            section._connectSubMenuSignals(systemPane, systemPane);

            //add link to search tool
            let systemSearchButton = new St.Button();
            systemTitle.addActor(systemSearchButton);
            let systemSearchImage = new St.Icon({ icon_name: "edit-find", icon_size: 10, icon_type: St.IconType.SYMBOLIC });
            systemSearchButton.add_actor(systemSearchImage);
            systemSearchButton.connect("clicked", Lang.bind(this, this.search));
            new Tooltips.Tooltip(systemSearchButton, _("Search File System"));

            // create a scrollbox for large system section, if any
            let systemScrollBox = new St.ScrollView({ style_class: "xCenter-scrollBox", x_fill: true, y_fill: false, y_align: St.Align.START });
            systemPane.actor.add_actor(systemScrollBox);
            systemScrollBox.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC);
            let systemVscroll = systemScrollBox.get_vscroll_bar();
            systemVscroll.connect("scroll-start", Lang.bind(this, function() { this.menu.passEvents = true; }));
            systemVscroll.connect("scroll-stop", Lang.bind(this, function() { this.menu.passEvents = false; }));

            this.systemSection = new PopupMenu.PopupMenuSection();
            systemScrollBox.add_actor(this.systemSection.actor);
            systemPane._connectSubMenuSignals(this.systemSection, this.systemSection);

            mainBox.add_actor(systemPaneBox);
            this.buildSystemSection();

            //recent documents section
            if ( this.showRecentDocuments ) {
                let recentPaneBox = new St.BoxLayout({ style_class: "xCenter-pane" });
                mainBox.add_actor(recentPaneBox);
                let recentPane = new PopupMenu.PopupMenuSection();
                recentPaneBox.add_actor(recentPane.actor);
                section._connectSubMenuSignals(recentPane, recentPane);

                let recentTitle = new PopupMenu.PopupMenuItem(_("RECENT DOCUMENTS"), { style_class: "xCenter-title", reactive: false });
                recentPane.addMenuItem(recentTitle);

                let recentScrollBox = new St.ScrollView({ style_class: "xCenter-scrollBox", x_fill: true, y_fill: false, y_align: St.Align.START });
                recentPane.actor.add_actor(recentScrollBox);
                recentScrollBox.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC);
                let vscroll = recentScrollBox.get_vscroll_bar();
                vscroll.connect("scroll-start", Lang.bind(this, function() { this.menu.passEvents = true; }));
                vscroll.connect("scroll-stop", Lang.bind(this, function() { this.menu.passEvents = false; }));

                this.recentSection = new PopupMenu.PopupMenuSection();
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
            global.logError(e);
        }
    }

    buildUserSection() {
        this.userSection.removeAll();
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
        this.buildCustomPlaces(this.userCustomPlaces, this.userSection);

        //trash
        this.buildTrashItem();
    }

    buildSystemSection() {
        this.systemSection.removeAll();

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
            this.devicesSection = new PopupMenu.PopupMenuSection();
            this.systemSection.addMenuItem(this.devicesSection);
            this.buildDevicesSection();
        }

        //custom places
        this.buildCustomPlaces(this.systemCustomPlaces, this.systemSection);

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
        if ( list == "" ) return;
        let uris = [];
        let customPlace;
        let customPlaces = list.split(/, *|\n/);

        for ( let i = 0; i < customPlaces.length; i++ ) {
            if ( customPlaces[i] == "" ) continue;
            try {
                let entry = customPlaces[i].split(":");
                let place = entry[0].replace("~/", HOME_DIR + "/");
                while ( place[0] == " " ) place = place.substr(1);
                if ( place.search("://") == -1 ) place = "file://" + place;
                let file = Gio.File.new_for_uri(place);
                if ( file.query_exists(null) ) {
                    let text = null;
                    let iconName = null;
                    if ( entry.length > 1 ) text = entry[1];
                    if ( entry.length > 2 ) iconName = entry[2];
                    customPlace = new PlaceMenuItem(place, text, iconName);
                    container.addMenuItem(customPlace);
                }

            } catch(e) { continue; }
        }
    }

    buildDevicesSection() {
        this.devicesSection.removeAll();

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

    buildRecentDocumentsSection() {
        if ( !this.showRecentDocuments ) return;
        this.recentSection.removeAll();

        let recentDocuments = this.recentManager.get_items();

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
        if ( this.trashItem ) this.trashItem.destroy();
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
        else this.set_applet_icon_name("folder");
    }

    setPanelText() {
        if ( this.panelText ) this.set_applet_label(this.panelText);
        else this.set_applet_label("");
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
}


function main(metadata, orientation, panel_height, instanceId) {
    let myApplet = new MyApplet(metadata, orientation, panel_height, instanceId);
    return myApplet;
}
