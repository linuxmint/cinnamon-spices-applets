const Cinnamon = imports.gi.Cinnamon;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const CMenu = imports.gi.CMenu;
const Gtk = imports.gi.Gtk;
const Pango = imports.gi.Pango;
const St = imports.gi.St;

const Applet = imports.ui.applet;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;
const Tooltips = imports.ui.tooltips;

const Lang = imports.lang;

const MENU_ITEM_TEXT_LENGTH = 25;

let menu_item_icon_size;


function MenuItem(title, icon){
    this._init(title, icon);
}

MenuItem.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,
    
    _init: function(title, icon, params){
        try {
            
            PopupMenu.PopupBaseMenuItem.prototype._init.call(this, params);
            this.actor.add_style_class_name("xCenter-menuItem");
            if ( icon != null ) this.addActor(icon);
            
            let label = new St.Label({ style_class: "xCenter-menuItemLabel", text: title });
            this.addActor(label);
            label.clutter_text.ellipsize = Pango.EllipsizeMode.END;
            
            this.actor._delegate = this;
            
            let tooltip = new Tooltips.Tooltip(this.actor, title);
            
            this.connect("activate", Lang.bind(this, this.launch));
            
        } catch (e) {
            global.logError(e);
        }
    }
}


function LauncherMenuItem(app) {
    this._init(app);
}

LauncherMenuItem.prototype = {
    __proto__: MenuItem.prototype,
    
    _init: function(app) {
        try {
            
            this.app = app;
            
            let title = app.get_name();
            let icon = app.create_icon_texture(menu_item_icon_size);
            MenuItem.prototype._init.call(this, title, icon);
            
        } catch(e) {
            global.logError(e);
        }
    },
    
    launch: function() {
        try {
            
            this.app.open_new_window(-1);
            
        } catch(e) {
            global.logError(e);
        }
    }
}


function PictureMenuItem(file, pictureSize) {
    this._init(file, pictureSize);
}

PictureMenuItem.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,
    
    _init: function(file, pictureSize, params) {
        try {
            
            PopupMenu.PopupBaseMenuItem.prototype._init.call(this, params);
            let fileInfo = file.query_info("*", Gio.FileQueryInfoFlags.NONE, null);
            this.uri = file.get_uri();
            
            let image = St.TextureCache.get_default().load_uri_async(this.uri, pictureSize, pictureSize);
            this.addActor(image);
            
            let tooltip = new Tooltips.Tooltip(this.actor, fileInfo.get_name());
            
            this.connect("activate", Lang.bind(this, this.launch));
            
        } catch(e) {
            global.logError(e);
        }
    },
    
    launch: function(event) {
        try {
            
            Gio.app_info_launch_default_for_uri(this.uri, global.create_app_launch_context());
            
        } catch(e) {
            global.logError(e);
        }
    }
}


function RecentMenuItem(title, iName, file) {
    this._init(title, iName, file);
}

RecentMenuItem.prototype = {
    __proto__: MenuItem.prototype,
    
    _init: function(title, iName, file) {
        try {
            
            this.file = file;
            
            let icon = new St.Icon({icon_name: iName, icon_size: menu_item_icon_size, icon_type: St.IconType.FULLCOLOR});
            MenuItem.prototype._init.call(this, title, icon);
            
        } catch(e) {
            global.logError(e);
        }
    },
    
    launch: function(event) {
        try {
            
            Gio.app_info_launch_default_for_uri(this.file, global.create_app_launch_context());
            
        } catch(e) {
            global.logError(e);
        }
    }
}


function ClearRecentMenuItem(recentManager) {
    this._init(recentManager);
}

ClearRecentMenuItem.prototype = {
    __proto__: MenuItem.prototype,
    
    _init: function(recentManager) {
        try {
            
            this.recentManager = recentManager;
            
            let icon = new St.Icon({icon_name: "edit-clear", icon_size: menu_item_icon_size, icon_type: St.IconType.FULLCOLOR});
            MenuItem.prototype._init.call(this, _("Clear"), icon);
            
        } catch(e) {
            global.logError(e);
        }
    },
    
    launch: function(event) {
        try {
            
            this.recentManager.purge_items();
            
        } catch(e) {
            global.logError(e);
        }
    }
}


function MyApplet(metadata, orientation, panel_height, instanceId) {
    this._init(metadata, orientation, panel_height, instanceId);
}

MyApplet.prototype = {
    __proto__: Applet.TextIconApplet.prototype,
    
    _init: function(metadata, orientation, panel_height, instanceId) {
        try {
            
            this.metadata = metadata;
            this.instanceId = instanceId;
            this.orientation = orientation;
            Applet.TextIconApplet.prototype._init.call(this, this.orientation, panel_height);
            
            this._bindSettings(instanceId);
            
            //set up panel
            this.setPanelIcon();
            this.setPanelText();
            this.set_applet_tooltip(_("Graphics"));
            
            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.appSys = Cinnamon.AppSystem.get_default();
            this.recentManager = new Gtk.RecentManager();
            
            //listen for changes
            this.appSysId = this.appSys.connect("installed-changed", Lang.bind(this, this.buildLaunchersSection));
            
            this.buildMenu();
            
        } catch (e) {
            global.logError(e);
        }
    },
    
    on_applet_clicked: function(event) {
        this.menu.toggle();
    },
    
    on_applet_removed_from_panel: function() {
        if ( this.keyId ) Main.keybindingManager.removeHotKey(this.keyId);
        this.destroyMenu();
        this.appSys.disconnect(this.appSysId);
    },
    
    openMenu: function(){
        this.menu.toggle();
    },
    
    _bindSettings: function(instanceId) {
        this.settings = new Settings.AppletSettings(this, this.metadata["uuid"], this.instanceId);
        this.settings.bindProperty(Settings.BindingDirection.IN, "panelIcon", "panelIcon", this.setPanelIcon);
        this.settings.bindProperty(Settings.BindingDirection.IN, "panelText", "panelText", this.setPanelText);
        this.settings.bindProperty(Settings.BindingDirection.IN, "iconSize", "iconSize", this.buildMenu);
        this.settings.bindProperty(Settings.BindingDirection.IN, "showPictures", "showPictures", this.buildMenu);
        this.settings.bindProperty(Settings.BindingDirection.IN, "altDir", "altDir", this.buildMenu);
        this.settings.bindProperty(Settings.BindingDirection.IN, "recursePictures", "recursePictures", this.updatePicturesSection);
        this.settings.bindProperty(Settings.BindingDirection.IN, "pictureSize", "pictureSize", this.updatePicturesSection);
        this.settings.bindProperty(Settings.BindingDirection.IN, "showRecentDocuments", "showRecentDocuments", this.buildMenu);
        this.settings.bindProperty(Settings.BindingDirection.IN, "recentSizeLimit", "recentSizeLimit", this.updateRecentDocumentsSection);
        this.settings.bindProperty(Settings.BindingDirection.IN, "keyOpen", "keyOpen", this._setKeybinding);
        this._setKeybinding();
    },
    
    _setKeybinding: function() {
        if ( this.keyId ) Main.keybindingManager.removeHotKey(this.keyId);
        if ( this.keyOpen == "" ) return;
        this.keyId = "graphicsCenter-open";
        Main.keybindingManager.addHotKey(this.keyId, this.keyOpen, Lang.bind(this, this.openMenu));
    },
    
    buildMenu: function() {
        try {
            
            this.destroyMenu();
            
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
            
            //launchers section
            let launchersPaneBox = new St.BoxLayout({ style_class: "xCenter-pane" });
            mainBox.add_actor(launchersPaneBox);
            let launchersPane = new PopupMenu.PopupMenuSection();
            launchersPaneBox.add_actor(launchersPane.actor);
            this.menu._connectSubMenuSignals(launchersPane, launchersPane);
            
            let launchersTitle = new PopupMenu.PopupMenuItem(_("LAUNCHERS") , { style_class: "xCenter-title", reactive: false });
            launchersPane.addMenuItem(launchersTitle);
            this.launchersSection = new PopupMenu.PopupMenuSection();
            launchersPane.addMenuItem(this.launchersSection);
            
            this.buildLaunchersSection();
            
            //pictures section
            if ( this.showPictures ) {
                //determine directory
                if ( this.altDir == "" ) this.picturesPath = GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_PICTURES);
                else this.picturesPath = this.altDir;
                
                //if directory exists, build pictures section
                if ( this.picturesPath && GLib.file_test(this.picturesPath, GLib.FileTest.IS_DIR) ) {
                    let dirMonitor = Gio.file_new_for_path(this.picturesPath).monitor_directory(Gio.FileMonitorFlags.SEND_MOVED, null);
                    this.monitorId = dirMonitor.connect("changed", Lang.bind(this, this.updatePicturesSection));
                    
                    let picturesPaneBox = new St.BoxLayout({ style_class: "xCenter-pane" });
                    mainBox.add_actor(picturesPaneBox);
                    let picturesPane = new PopupMenu.PopupMenuSection();
                    picturesPaneBox.add_actor(picturesPane.actor);
                    this.menu._connectSubMenuSignals(picturesPane, picturesPane);
                    
                    let picturesTitle = new PopupMenu.PopupBaseMenuItem({ style_class: "xCenter-title", reactive: false });
                    picturesTitle.addActor(new St.Label({ text: _("PICTURES") }));
                    picturesPane.addMenuItem(picturesTitle);
                    
                    //add link to documents folder
                    let linkButton = new St.Button();
                    picturesTitle.addActor(linkButton);
                    let file = Gio.file_new_for_path(this.metadata.path + "/link-symbolic.svg");
                    let gicon = new Gio.FileIcon({ file: file });
                    let image = new St.Icon({ gicon: gicon, icon_size: 10, icon_type: St.IconType.SYMBOLIC });
                    linkButton.add_actor(image);
                    linkButton.connect("clicked", Lang.bind(this, this.openPicturesFolder));
                    new Tooltips.Tooltip(linkButton, _("Open folder"));
                    
                    let pictureScrollBox = new St.ScrollView({ style_class: "xCenter-scrollBox", x_fill: true, y_fill: false, y_align: St.Align.START });
                    picturesPane.actor.add_actor(pictureScrollBox);
                    pictureScrollBox.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC);
                    let vscroll = pictureScrollBox.get_vscroll_bar();
                    vscroll.connect("scroll-start", Lang.bind(this, function() { this.menu.passEvents = true; }));
                    vscroll.connect("scroll-stop", Lang.bind(this, function() { this.menu.passEvents = false; }));
                    
                    this.pictureSection = new PopupMenu.PopupMenuSection();
                    pictureScrollBox.add_actor(this.pictureSection.actor);
                    picturesPane._connectSubMenuSignals(this.pictureSection, this.pictureSection);
                    
                    this.updatePicturesSection();
                }
            }
            
            //recent documents section
            if ( this.showRecentDocuments ) {
                this.recentManagerId = this.recentManager.connect("changed", Lang.bind(this, this.updateRecentDocumentsSection));
                
                let recentPaneBox = new St.BoxLayout({ style_class: "xCenter-pane" });
                mainBox.add_actor(recentPaneBox);
                let recentPane = new PopupMenu.PopupMenuSection();
                recentPaneBox.add_actor(recentPane.actor);
                this.menu._connectSubMenuSignals(recentPane, recentPane);
                
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
                
                let clearRecent = new ClearRecentMenuItem(this.recentManager);
                recentPane.addMenuItem(clearRecent);
                
                this.updateRecentDocumentsSection();
            }
            
        } catch(e) {
            global.logError(e);
        }
    },
    
    destroyMenu: function() {
        if ( this.monitorId ) this.dirMonitor.disconnect(this.monitorId);
        if ( this.recentManagerId ) this.recentManager.disconnect(this.recentManagerId);
        
        if ( this.menu ) this.menu.destroy();
    },
    
    buildLaunchersSection: function() {
        
        this.launchersSection.removeAll();
        
        let apps = [];
        let tree = this.appSys.get_tree();
        let root = tree.get_root_directory();
        let iter = root.iter();
        let nextType;
        while ( (nextType = iter.next()) != CMenu.TreeItemType.INVALID ) {
            if ( nextType == CMenu.TreeItemType.DIRECTORY ) {
                let dir = iter.get_directory();
                if ( dir.get_menu_id() == _("Graphics") ) {
                    let dirIter = dir.iter();
                    while (( nextType = dirIter.next()) != CMenu.TreeItemType.INVALID ) {
                        if ( nextType == CMenu.TreeItemType.ENTRY ) {
                            let entry = dirIter.get_entry();
                            if (!entry.get_app_info().get_nodisplay()) {
                                var app = this.appSys.lookup_app_by_tree_entry(entry);
                                let launcherItem = new LauncherMenuItem(app);
                                this.launchersSection.addMenuItem(launcherItem);
                            }
                        }
                    }
                }
            }
        }
        
    },
    
    updatePicturesSection: function() {
        
        if ( !this.pictureSection ) return;
        this.pictureSection.removeAll();
        
        let dir = Gio.file_new_for_path(this.picturesPath);
        let pictures = this.getPictures(dir);
        for ( let i = 0; i < pictures.length; i++ ) {
            let picture = pictures[i];
            let pictureItem = new PictureMenuItem(picture, this.pictureSize);
            this.pictureSection.addMenuItem(pictureItem);
        }
        
    },
    
    getPictures: function(dir) {
        
        let pictures = [];
        let gEnum = dir.enumerate_children("*", Gio.FileQueryInfoFlags.NONE, null);
        
        let info;
        while ( (info = gEnum.next_file(null)) != null ) {
            if ( info.get_is_hidden() ) continue;
            if ( info.get_file_type() == Gio.FileType.DIRECTORY && this.recursePictures ) {
                let childDir = dir.get_child(info.get_name());
                pictures = pictures.concat(this.getPictures(childDir));
            }
            else {
                if ( info.get_content_type().search("image") == -1 ) continue;
                pictures.push(dir.get_child(info.get_name()));
            }
        }
        return pictures;
        
    },
    
    updateRecentDocumentsSection: function() {
        
        if ( !this.recentSection ) return;
        this.recentSection.removeAll();
        
        let recentDocuments = this.recentManager.get_items();
        
        let showCount;
        if ( this.recentSizeLimit == 0 ) showCount = recentDocuments.length;
        else showCount = ( this.recentSizeLimit < recentDocuments.length ) ? this.recentSizeLimit : recentDocuments.length;
        for ( let i = 0; i < showCount; i++ ) {
            let recentInfo = recentDocuments[i];
            let mimeType = recentInfo.get_mime_type().replace("\/","-");
            let recentItem = new RecentMenuItem(recentInfo.get_display_name(), mimeType, recentInfo.get_uri());
            this.recentSection.addMenuItem(recentItem);
        }
        
    },
    
    openPicturesFolder: function() {
        this.menu.close();
        Gio.app_info_launch_default_for_uri("file://" + this.picturesPath, global.create_app_launch_context());
    },
    
    setPanelIcon: function() {
        if ( this.panelIcon == "" ||
           ( GLib.path_is_absolute(this.panelIcon) &&
             GLib.file_test(this.panelIcon, GLib.FileTest.EXISTS) ) ) {
            if ( this.panelIcon.search("-symbolic.svg") == -1 ) this.set_applet_icon_path(this.panelIcon);
            else this.set_applet_icon_symbolic_path(this.panelIcon);
        }
        else if ( Gtk.IconTheme.get_default().has_icon(this.panelIcon) ) {
            if ( this.panelIcon.search("-symbolic") != -1 ) this.set_applet_icon_symbolic_name(this.panelIcon);
            else this.set_applet_icon_name(this.panelIcon);
        }
        else this.set_applet_icon_name("applications-graphics");
    },
    
    setPanelText: function() {
        if ( this.panelText ) this.set_applet_label(this.panelText);
        else this.set_applet_label("");
    },
    
    set_applet_icon_symbolic_path: function(icon_path) {
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
};


function main(metadata, orientation, panel_height, instanceId) {
    let myApplet = new MyApplet(metadata, orientation, panel_height, instanceId);
    return myApplet;
}
