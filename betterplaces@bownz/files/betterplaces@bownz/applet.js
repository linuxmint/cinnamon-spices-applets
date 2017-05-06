
const SHOW_DESKTOP      		     	   = true;
const SHOW_BOOKMARKS     		     	   = true;
const COLLAPSE_BOOKMARKS  		     	   = false;
const SHOW_DEVICES       		     	   = true;
const COLLAPSE_DEVICES     		     	   = false;
const SHOW_NETWORK                           	   = true;
const COLLAPSE_NETWORK                       	   = false;
const SHOW_RECENT_DOCUMENTS 		           = true;
	/*↳*/const AMMOUNT_OF_RECENT_DOCUMENTS    = 5;
const ICON_SIZE             		   	   = 18;
const SUB_ICON_SIZE         		  	   = 16;

const DocInfo = imports.misc.docInfo;
const GLib = imports.gi.GLib;
const Lang = imports.lang;
const St = imports.gi.St;
const ModalDialog = imports.ui.modalDialog;
const Clutter = imports.gi.Clutter;
const Applet = imports.ui.applet;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const Gettext = imports.gettext;
const UUID = "betterplaces@bownz";
const Gtk = imports.gi.Gtk;
const Gio = imports.gi.Gio;
const FileUtils = imports.misc.fileUtils;

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale")

function _(str) {
  return Gettext.dgettext(UUID, str);
}

const EJECT_DEVICE_LABEL    = _("Eject");
const EJECT_DEVICE_MESSAGE  = _("Are you sure you want to eject this device ?") + "\n";
const CLEAR_RECENT_LABEL    = _("Recent documents");
const CLEAR_RECENT_MESSAGE  = _("Clear the Recent Documents list?") + "\n";



function MenuItem()
{
    this._init.apply(this, arguments);
}

MenuItem.prototype =
{
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,
    
    _init: function(icon, text, params)
    {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, params);
            
        this.box = new St.BoxLayout({ style_class: 'popup-combobox-item' });

        this.icon = icon;
        this.box.add(this.icon);
        this.label = new St.Label({ text: text });
        this.box.add(this.label);
        this.addActor(this.box);
    }
};

function DeviceMenuItem()
{
    this._init.apply(this, arguments);
}

DeviceMenuItem.prototype =
{
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,
    
    _init: function(device, icon, text, params)
    {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, params);
        
        this.device = device;
        
        this.box = new St.BoxLayout({ style_class: 'popup-combobox-item' });

        this.icon = icon;
        this.box.add(this.icon);
        this.label = new St.Label({ text: text });
        this.box.add(this.label);
        this.addActor(this.box);
        
        let ejectIcon = new St.Icon({ icon_name: 'media-eject', icon_type: St.IconType.SYMBOLIC, style_class: 'popup-menu-icon ' });
        let ejectButton = new St.Button({ child: ejectIcon, tooltip_text: _("Eject") });
        ejectButton.connect('clicked', Lang.bind(this, this._ejectDevice));
        this.addActor(ejectButton);
    },
    
    _ejectDevice: function()
    {
        new ConfirmationDialog(Lang.bind(this, this._doEjectDevice), EJECT_DEVICE_LABEL, EJECT_DEVICE_MESSAGE, _("Cancel"), _("OK")).open();
    },
    
    _doEjectDevice: function()
    {
        this.device.remove();
    },
    
    activate: function(event)
    {
        this.device.launch({ timestamp: event.get_time() });
        PopupMenu.PopupBaseMenuItem.prototype.activate.call(this, event);
    }
};


function ConfirmationDialog()
{
    this._init.apply(this, arguments);
}

ConfirmationDialog.prototype =
{
    __proto__: ModalDialog.ModalDialog.prototype,

    _init: function(doMethod, dialogLabel, dialogMessage, cancelButtonLabel, doButtonLabel)
    {
        ModalDialog.ModalDialog.prototype._init.call(this, { styleClass: null });

        let mainContentBox = new St.BoxLayout({ style_class: 'polkit-dialog-main-layout', vertical: false });
        this.contentLayout.add(mainContentBox, { x_fill: true, y_fill: true });

        let messageBox = new St.BoxLayout({ style_class: 'polkit-dialog-message-layout', vertical: true });
        mainContentBox.add(messageBox, { y_align: St.Align.START });

        this._subjectLabel = new St.Label({ style_class: 'polkit-dialog-headline', text: dialogLabel });

        messageBox.add(this._subjectLabel, { y_fill: false, y_align: St.Align.START });

        this._descriptionLabel = new St.Label({ style_class: 'polkit-dialog-description', text: dialogMessage });

        messageBox.add(this._descriptionLabel, { y_fill: true, y_align: St.Align.START });

        this.setButtons([
            {
                label: cancelButtonLabel,
                action: Lang.bind(this, function() {
                    this.close();
                }),
                key: Clutter.Escape
            },
            {
                label: doButtonLabel,
                action: Lang.bind(this, function() {
                    this.close();
                    doMethod();
                })
            }
        ]);
    }
};



function MyApplet(orientation)
{
    this._init(orientation);
}

MyApplet.prototype =
{
    __proto__: Applet.IconApplet.prototype,

    _init: function(orientation)
    {
        Applet.IconApplet.prototype._init.call(this, orientation);

        try {
		this.set_applet_icon_symbolic_name('folder');
                this.set_applet_tooltip(_("Better Places"));

            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager.addMenu(this.menu);

            this.RecentManager = new DocInfo.DocManager();
            this._display();
            this.RecentManager.connect('changed', Lang.bind(this, this._redisplay));
        }
        catch (e) {
            global.logError(e);
        };
    },

    on_applet_clicked: function(event)
    {
        this.menu.toggle();        
    },

    _display : function()
    {
        
        this._createHome();

        if (SHOW_DESKTOP) {
            this._createDesktop();
        }


        if (SHOW_BOOKMARKS) {
		if(COLLAPSE_BOOKMARKS){
this._bookmarksSection = new PopupMenu.PopupSubMenuMenuItem(_("Bookmarks"));
}else{
                this._bookmarksSection = new PopupMenu.PopupMenuSection();
}
                this._createBookmarks();
                this.menu.addMenuItem(this._bookmarksSection);

            Main.placesManager.connect('bookmarks-updated', Lang.bind(this, this._redisplayBookmarks));
        }   
 
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this._createComputer();

        this._createFS();

        if (SHOW_DEVICES) {
            if (COLLAPSE_DEVICES) {
                this._devicesSection = new PopupMenu.PopupSubMenuMenuItem(_("Removable Devices"));
                this.menu.addMenuItem(this._devicesSection);
                this._createDevices();
            } else {
                this._devicesSection = new PopupMenu.PopupMenuSection();
                this._createDevices();
                this.menu.addMenuItem(this._devicesSection);
            }
            
            Main.placesManager.connect('mounts-updated', Lang.bind(this, this._redisplayDevices));
        }

        if (SHOW_NETWORK) {
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            if (COLLAPSE_NETWORK) {
                this._networkSection = new PopupMenu.PopupSubMenuMenuItem(_("Network"));
                this.menu.addMenuItem(this._networkSection);
                this._createNetwork();
            } else {
                this._networkSection = new PopupMenu.PopupMenuSection();
                this._createNetwork();
                this.menu.addMenuItem(this._networkSection);
            }
        }

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this._createSearch();

if (SHOW_RECENT_DOCUMENTS){
	   this.recentsItem = new PopupMenu.PopupSubMenuMenuItem(_("Recent Documents"));      
        for (let id = 0; id < AMMOUNT_OF_RECENT_DOCUMENTS && id < this.RecentManager._infosByTimestamp.length; id++) {
            let icon = this.RecentManager._infosByTimestamp[id].createIcon(SUB_ICON_SIZE);
            let menuItem = new MenuItem(icon, this.RecentManager._infosByTimestamp[id].name, {});
            this.recentsItem.menu.addMenuItem(menuItem);
            menuItem.connect('activate', Lang.bind(this, this._launchFile, this.RecentManager._infosByTimestamp[id].uri));
        }
        if (this.RecentManager._infosByTimestamp.length > 0) {
            this.recentsItem.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            let icon = new St.Icon({ icon_name: 'edit-clear', icon_type: St.IconType.SYMBOLIC, icon_size: SUB_ICON_SIZE });
            let menuItem = new MenuItem(icon, _("Clear list"), {});
           this.recentsItem.menu.addMenuItem(menuItem);
            menuItem.connect('activate', Lang.bind(this, this._clearAll));
        }
	this.menu.addMenuItem(this.recentsItem);  
}



    },
    
    _redisplay: function() {
        this.menu.removeAll();
        this._display();
    },

    _launchFile: function(a, b, c) {        
        Gio.app_info_launch_default_for_uri(c, global.create_app_launch_context());
    },
    
    _clearAll: function() {
        let GtkRecent = new Gtk.RecentManager();
        GtkRecent.purge_items();
    },
    
    destroy: function() {
        this.RecentManager.disconnectAll();
        this.actor._delegate = null;
        this.menu.destroy();
        this.actor.destroy();
        this.emit('destroy');
    },

    _createComputer: function()
    {
        let icon = new St.Icon({icon_name: "computer", icon_size: ICON_SIZE, icon_type: St.IconType.FULLCOLOR});
        this.computerItem = new MenuItem(icon, _("Computer"));
        this.computerItem.connect('activate', function(actor, event) {
            new launch().command("nautilus computer://");
        });
        this.menu.addMenuItem(this.computerItem);
    },

    _createFS: function()
    {
        let icon = new St.Icon({icon_name: "harddrive", icon_size: ICON_SIZE, icon_type: St.IconType.FULLCOLOR});
        this.computerItem = new MenuItem(icon, _("File System"));
        this.computerItem.connect('activate', function(actor, event) {
            new launch().command("gksudo nautilus /");
        });
        this.menu.addMenuItem(this.computerItem);
    },
    _createHome: function()
    {
        let icon = new St.Icon({icon_name: "user-home", icon_size: ICON_SIZE, icon_type: St.IconType.FULLCOLOR});
        this.homeItem = new MenuItem(icon, _("Home Folder"));
        this.homeItem.connect('activate', function(actor, event) {
            new launch().command("nautilus");
        });
        this.menu.addMenuItem(this.homeItem);
    },

    _createDesktop: function()
    {
        let icon = new St.Icon({icon_name: "user-desktop", icon_size: ICON_SIZE, icon_type: St.IconType.FULLCOLOR});
        this.desktopItem = new MenuItem(icon, _("Desktop"));
        this.desktopItem.connect('activate', function(actor, event) {
            new launch().command("nautilus \"" + FileUtils.getUserDesktopDir().replace(" ","\ ") + "\"");
        });
        this.menu.addMenuItem(this.desktopItem);
    },

    _createDefaultPlaces : function()
    {
        this.defaultPlaces = Main.placesManager.getDefaultPlaces();
        for (let placeid = 0; placeid < this.defaultPlaces.length; placeid++) {
            let icon = this.defaultPlaces[placeid].iconFactory(ICON_SIZE);
            let defaultItem = new MenuItem(icon, _(this.defaultPlaces[placeid].name));
            defaultItem.place = this.defaultPlaces[placeid];
            
            defaultItem.connect('activate', function(actor, event) {
                actor.place.launch();
            });
            this.menu.addMenuItem(defaultItem);
        }
    },


    _createBookmarks : function()
    {
        this.bookmarks = Main.placesManager.getBookmarks();

        sectionMenu = (this._bookmarksSection.menu) ? this._bookmarksSection.menu : this._bookmarksSection;

        for (let bookmarkid = 0; bookmarkid < this.bookmarks.length; bookmarkid++) {
            let icon = this.bookmarks[bookmarkid].iconFactory(ICON_SIZE);
            let bookmarkItem = new MenuItem(icon, this.bookmarks[bookmarkid].name);
            bookmarkItem.place = this.bookmarks[bookmarkid];
            
            bookmarkItem.connect('activate', function(actor, event) {
                actor.place.launch();
            });           
 sectionMenu.addMenuItem(bookmarkItem);

        }
    },

    _addBookmarksWatch: function()
    {
        this.bookmarks_file = Gio.file_new_for_path("~/.gtk-bookmarks");
        this.monitor = this.bookmarks_file.monitor_file(0, null, null);
        this.monitor.connect('changed', Lang.bind(this, this._redisplayBookmarks));
    },
    
    _clearBookmarks : function()
    {
        sectionMenu = (this._bookmarksSection.menu) ?  this._bookmarksSection.menu : this._bookmarksSection;
        this._bookmarksSection.removeAll();
    },

    _redisplayBookmarks: function()
    {
        this._clearBookmarks();
        this._createBookmarks();
    },

    _createDevices : function()
    {
        this.devices = Main.placesManager.getMounts();
        
        sectionMenu = (this._devicesSection.menu) ? this._devicesSection.menu : this._devicesSection;

        for (let devid = 0; devid < this.devices.length; devid++) {
            let icon = this.devices[devid].iconFactory(ICON_SIZE);
            let deviceItem = new DeviceMenuItem(this.devices[devid], icon, this.devices[devid].name);
            sectionMenu.addMenuItem(deviceItem);
        }

        if (this.devices.length == 0) {
            this._devicesSection.actor.hide();
        } else {
            this._devicesSection.actor.show();
        }
    },

    _clearDevices : function()
    {
        sectionMenu = (this._devicesSection.menu) ? this._devicesSection.menu : this._devicesSection;
        sectionMenu.removeAll();
    },

    _redisplayDevices: function()
    {
        this._clearDevices();
        this._createDevices();
    },

    _createNetwork: function()
    {
        sectionMenu = (this._networkSection.menu) ? this._networkSection.menu : this._networkSection;
        
        let icon = new St.Icon({icon_name: "network-workgroup", icon_size: ICON_SIZE, icon_type: St.IconType.FULLCOLOR});
        this.networkItem = new MenuItem(icon, _("Network"));
        this.networkItem.connect('activate', function(actor, event) {
            new launch().command("nautilus network:///");
        });
        sectionMenu.addMenuItem(this.networkItem);
        
        icon = new St.Icon({icon_name: "gnome-globe", icon_size: ICON_SIZE, icon_type: St.IconType.FULLCOLOR});
        this.connectItem = new MenuItem(icon, _("Connect to..."));
        this.connectItem.connect('activate', function(actor, event) {
            new launch().command("nautilus-connect-server");
        });        
        sectionMenu.addMenuItem(this.connectItem);
    },

    _createSearch: function()
    {
        let icon = new St.Icon({icon_name: "preview-file", icon_size: ICON_SIZE, icon_type: St.IconType.FULLCOLOR});
        this.searchItem = new MenuItem(icon, _("Search"));
        this.menu.addMenuItem(this.searchItem);

        this.searchItem.connect('activate', function(actor, event) {
            new launch().command("gnome-search-tool");
        });
    },
};


function launch() {}

launch.prototype =
{
    file: function(file)
    {
        Gio.app_info_launch_default_for_uri(file, global.create_app_launch_context());
    },
    
    command: function(location)
    {
        Main.Util.spawnCommandLine(location);
    }
}

function main(metadata, orientation)
{
    let myApplet = new MyApplet(orientation);
    return myApplet;
}
