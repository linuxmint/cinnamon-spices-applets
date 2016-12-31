/**
 * All-in-one Places applet for Cinnamon.
 * http://jferrao.github.com/gtk
 * 
 * 
 * @author jferrao <jferrao@ymail.com>
 * @version 2.0
 * 
 */



/**
 * Import stuff ...
 */
const Applet = imports.ui.applet;
const Cinnamon = imports.gi.Cinnamon;

const GLib = imports.gi.GLib;
const Lang = imports.lang;
const St = imports.gi.St;
const ModalDialog = imports.ui.modalDialog;
const Clutter = imports.gi.Clutter;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const Gettext = imports.gettext;
const _ = Gettext.gettext;
const Gtk = imports.gi.Gtk;
const Gio = imports.gi.Gio;

const EXTENSION_UUID = "all-in-one-places@jofer";
const SCHEMA_NAME = "org.cinnamon.applets.AllInOnePlaces";
const APPLET_DIR = imports.ui.appletManager.appletMeta["all-in-one-places@jofer"].path;

let settings;



/**
 * Messages for the confirmation dialog boxes.
 */
const EMPTY_TRASH_LABEL     = _("Empty Trash");
const EMPTY_TRASH_MESSAGE   = _("Are you sure you want to delete all items from the trash?") + "\n" + _("This operation cannot be undone.") + "\n";
const EJECT_DEVICE_LABEL    = _("Eject");
const EJECT_DEVICE_MESSAGE  = _("Are you sure you want to eject this device ?") + "\n";
const CLEAR_RECENT_LABEL    = _("Recent documents");
const CLEAR_RECENT_MESSAGE  = _("Clear the Recent Documents list?") + "\n";





/**
 * Device menu item base class
 */
function MenuItemBase()
{
    this._init.apply(this, arguments);
}

MenuItemBase.prototype =
{
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,
    
    _init: function(icon, text, params)
    {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, params);

        let box = new St.BoxLayout({ style_class: 'popup-combobox-item' });
        if (icon.substring) {
            icon = new St.Icon({ icon_name: icon, icon_size: settings.get_int('item-icon-size'), icon_type: St.IconType.FULLCOLOR });
        }
        box.add(icon);
        let label = new St.Label({ text: text });
        box.add(label);
        this.addActor(box);
        
        return this;
    }
};

/**
 * Device menu item class
 */
function MenuItem()
{
    this._init.apply(this, arguments);
}

MenuItem.prototype =
{
    __proto__: MenuItemBase.prototype,
    
    _init: function(icon, text, launcher, params)
    {
        MenuItemBase.prototype._init.call(this, icon, text, params);

        if (launcher != undefined) {
            this.connect('activate', function(actor, event) {
                new launch().command(launcher);
            });
        }
        
        return this;
    }
};

/**
 * Device menu item with eject button
 */
function DeviceMenuItem()
{
    this._init.apply(this, arguments);
}

DeviceMenuItem.prototype =
{
    __proto__: MenuItemBase.prototype,
    
    _init: function(device, icon, text, params)
    {
        this.device = device;

        MenuItemBase.prototype._init.call(this, icon, text, params);
        
        // Add eject button
        let eject_icon = new St.Icon({ icon_name: 'media-eject', icon_type: St.IconType.SYMBOLIC, style_class: 'popup-menu-icon' });
        let eject_button = new St.Button({ child: eject_icon });
        eject_button.connect('clicked', Lang.bind(this, this._confirmEjectDevice));
        this.addActor(eject_button);
        
        return this;
    },
    
    _confirmEjectDevice: function()
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

/**
 * Trash menu item with empty button
 */
function TrashMenuItem()
{
    this._init.apply(this, arguments);
}

TrashMenuItem.prototype =
{
    __proto__: MenuItemBase.prototype,
    
    _init: function(trash_file, params)
    {
        this.trash_file = trash_file;
        let icon = (this._isTrashEmpty()) ? "trashcan_empty" : "trashcan_full";
        
        MenuItemBase.prototype._init.call(this, icon, _("Trash"), params);

        if (!this._isTrashEmpty()) {
            // Add empty button
            let empty_icon = new St.Icon({ icon_name: 'edit-clear', icon_type: St.IconType.SYMBOLIC, style_class: 'popup-menu-icon' });
            let empty_button = new St.Button({ child: empty_icon, tooltip_text: _("Empty Trash")  });
            empty_button.connect('clicked', Lang.bind(this, this._confirmEmptyTrash));
            this.addActor(empty_button);
        }

        // Hide trash item if trash is empty
        if (settings.get_boolean('hide-empty-trash-item')) {
            if (this._isTrashEmpty()) this.actor.visible = false;
        }
        
        return this;
    },

    _isTrashEmpty: function()
    {
        let children = this.trash_file.enumerate_children('*', 0, null, null);
        if (children.next_file(null, null) == null) {
            return true;
        }
        return false;
    },
    
    _confirmEmptyTrash: function()
    {
        new ConfirmationDialog(Lang.bind(this, this._doEmptyTrash), EMPTY_TRASH_LABEL, EMPTY_TRASH_MESSAGE, _("Cancel"), _("Empty Trash")).open();
    },

    _doEmptyTrash: function()
    {
        let children = this.trash_file.enumerate_children('*', 0, null, null);
        let child_info = null;
        while ((child_info = children.next_file(null, null)) != null) {
            this.trash_file.get_child(child_info.get_name()).delete(null);
        }
    },

    activate: function(event)
    {
        new launch().file(this.trash_file.get_uri());
        PopupMenu.PopupBaseMenuItem.prototype.activate.call(this, event);
    }
};



/**
 * Modal confirmation dialog box
 */
function ConfirmationDialog()
{
    this._init.apply(this, arguments);
}

ConfirmationDialog.prototype =
{
    __proto__: ModalDialog.ModalDialog.prototype,

    _init: function(callback, label, message, cancel_button_label, callback_button_layer)
    {
        ModalDialog.ModalDialog.prototype._init.call(this, { styleClass: null });

        let mainContentBox = new St.BoxLayout({ style_class: 'polkit-dialog-main-layout', vertical: false });
        this.contentLayout.add(mainContentBox, { x_fill: true, y_fill: true });

        let messageBox = new St.BoxLayout({ style_class: 'polkit-dialog-message-layout', vertical: true });
        mainContentBox.add(messageBox, { y_align: St.Align.START });

        this._subjectLabel = new St.Label({ style_class: 'polkit-dialog-headline', text: label });
        messageBox.add(this._subjectLabel, { y_fill: false, y_align: St.Align.START });

        this._descriptionLabel = new St.Label({ style_class: 'polkit-dialog-description', text: message });
        messageBox.add(this._descriptionLabel, { y_fill: true, y_align: St.Align.START });
        
        this.setButtons([
            {
                label: cancel_button_label,
                action: Lang.bind(this, function() {
                    this.close();
                }),
                key: Clutter.Escape
            },
            {
                label: callback_button_layer,
                action: Lang.bind(this, function() {
                    this.close();
                    callback();
                })
            }
        ]);
    }
};



/**
 * The applet class
 */
function MyApplet(orientation)
{
    this._init(orientation);
}

MyApplet.prototype =
{
    __proto__: Applet.TextIconApplet.prototype,

    _init: function(orientation)
    {
        Applet.TextIconApplet.prototype._init.call(this, orientation);

        try {
            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager.addMenu(this.menu);

            // Monitor settings changes and refresh menu on change
            this._settingsChanged = settings.connect('changed', Lang.bind(this, this._refreshApplet));

            // Add edit settings context menu item
            let settings_menu_item = new Applet.MenuItem(_("Settings"), Gtk.STOCK_EDIT, Lang.bind(this, this._launchSettings));
            this._applet_context_menu.addMenuItem(settings_menu_item);

            // Build panel and menu applet components
            this._displayOnPanel();
            this._displayMenu();
            
        }
        catch (e) {
            global.logError(e);
        };
    },

    on_applet_clicked: function(event)
    {
        this.menu.toggle();        
    },
    
    _refreshApplet: function()
    {
        // Reset applet values in panel
        this.set_applet_icon_name('');
        this.set_applet_icon_symbolic_name('');
        this.set_applet_label('');
        this.set_applet_tooltip('');
        
        this._displayOnPanel();
        
        // Clean up all menu items
        this.menu.removeAll();

        this._displayMenu();
    },
    
    _displayOnPanel: function()
    {
        let show_panel_icon;
        
        // Do not allow both icon and text to be false
        if (!settings.get_boolean('show-panel-icon') && !settings.get_boolean('show-panel-text')) {
            show_panel_icon = true;
        } else {
            show_panel_icon = settings.get_boolean('show-panel-icon');
        }

        if (show_panel_icon) {
            if (settings.get_boolean('full-color-panel-icon')) {
                this.set_applet_icon_name('user-home');
            } else {
                this.set_applet_icon_symbolic_name('folder');
            }
        }

        if (settings.get_boolean('show-panel-text')) {
            let text = (settings.get_string('panel-text')) ? settings.get_string('panel-text') : _("Places");
            if (show_panel_icon) {
                this.set_applet_label(" " + text);
            } else {
                this.set_applet_label(text);
            }
        } else {
            this.set_applet_tooltip(_("Places"));
        }
    },

    _displayMenu : function()
    {
        // Show home item
        this.menu.addMenuItem(new MenuItem('user-home', _("Home Folder"), settings.get_string('file-manager')));

        // Show desktop item
        if (settings.get_boolean('show-desktop-item')) {
            let desktop_folder = GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_DESKTOP);
            this.menu.addMenuItem(new MenuItem('user-desktop', _("Desktop"), settings.get_string('file-manager') + " \"" + desktop_folder.replace(" ","\ ") + "\""));
        }

        // Show trash item
        if (settings.get_boolean('show-trash-item')) {
            this.trash_file = Gio.file_new_for_uri("trash:///");
            
            // Monitor trash changes
            this.monitor = this.trash_file.monitor_directory(0, null, null);
            this._trashChanged = this.monitor.connect('changed', Lang.bind(this, this._refreshTrashSection));

            this._trash_section = new PopupMenu.PopupMenuSection();
            this._trash_section.addMenuItem(new TrashMenuItem(this.trash_file));
            this.menu.addMenuItem(this._trash_section);
        }

        // Show bookmarks section
        if (settings.get_boolean('show-bookmarks-section')) {
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            
            // Monitor bookmarks changes
            this._bookmarksChanged = Main.placesManager.connect('bookmarks-updated', Lang.bind(this, this._refreshBookmarksSection));
            
            if (settings.get_boolean('collapse-bookmarks-section')) {
                this._bookmarks_section = new PopupMenu.PopupSubMenuMenuItem(_("Bookmarks"));
            } else {
                this._bookmarks_section = new PopupMenu.PopupMenuSection();
            }
            this._createBookmarksSection();
            this.menu.addMenuItem(this._bookmarks_section);
        }
        
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        
        // Show computer item
        this.menu.addMenuItem(new MenuItem('computer', _("Computer"), settings.get_string('file-manager') + " computer:///"));

        // Show file system item
        if (settings.get_boolean('show-filesystem-item')) {
            this.menu.addMenuItem(new MenuItem('drive-harddisk', _("File System"), settings.get_string('file-manager') + " /"));
        }

        // Show devices section
        if (settings.get_boolean('show-devices-section')) {
            // Monitor mounts changes
            this._devicesChanged = Main.placesManager.connect('mounts-updated', Lang.bind(this, this._refreshDevicesSection));

            if (settings.get_boolean('collapse-devices-section')) {
                this._devices_section = new PopupMenu.PopupSubMenuMenuItem(_("Removable Devices"));
            } else {
                this._devices_section = new PopupMenu.PopupMenuSection();
            }
            this._createDevicesSection();
            this.menu.addMenuItem(this._devices_section);
        }

        // Show network section
        if (settings.get_boolean('show-network-section')) {
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            if (settings.get_boolean('collapse-network-section')) {
                this._network_section = new PopupMenu.PopupSubMenuMenuItem(_("Network"));
            } else {
                this._network_section = new PopupMenu.PopupMenuSection();
            }
            
            let network_item = new MenuItem('network-workgroup', _("Network"), settings.get_string('file-manager') + " network:///");
            if (this._network_section.menu) { this._network_section.menu.addMenuItem(network_item) } else { this._network_section.addMenuItem(network_item) }
            let connect_item = new MenuItem('gnome-globe', _("Connect to..."), settings.get_string('connect-command'));
            if (this._network_section.menu) { this._network_section.menu.addMenuItem(connect_item) } else { this._network_section.addMenuItem(connect_item) }
            
            this.menu.addMenuItem(this._network_section);
        }

        if (settings.get_boolean('show-search-item') || settings.get_boolean('show-documents-section')) {
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            // Show search section
            if (settings.get_boolean('show-search-item')) {
                this.menu.addMenuItem(new MenuItem('search', _("Search"), settings.get_string('search-command')));
            }
            // Show recent documents section
            if (settings.get_boolean('show-documents-section')) {
                this.recentManager = new Gtk.RecentManager();
                
                // Monitor recent documents changes 
                this._recentChanged = this.recentManager.connect('changed', Lang.bind(this, this._refreshRecentSection));
                
                this._recent_section = new PopupMenu.PopupSubMenuMenuItem(_("Recent documents"));
                this._createRecentSection();
                this.menu.addMenuItem(this._recent_section);
            }
        }
        
    },

    /**
     * Disconnect signals
     */
    destroy: function()
    {
        // Disconnecting signals
        if (this._settingsChanged) settings.disconnect(this._settingsChanged);
        if (this._trashChanged) this.monitor.disconnect(this._trashChanged);
        if (this._bookmarksChanged) Main.placesManager.disconnect(this._bookmarksChanged);
        if (this._devicesChanged) Main.placesManager.disconnect(this._devicesChanged);
        if (this._recentChanged) this.recentManager.disconnect(this._recentChanged);
        
        Applet.TextIconApplet.prototype.destroy.call(this);
    },

    /**
     * Refresh trash section
     */
    _refreshTrashSection: function()
    {
        this._trash_section.removeAll();
        this._trash_section.addMenuItem(new TrashMenuItem(this.trash_file));
    },

    /**
     * Build bookmarks section
     */
    _createBookmarksSection: function()
    {
        this.bookmarks = Main.placesManager.getBookmarks();
        for (let bookmarkid = 0; bookmarkid < this.bookmarks.length; bookmarkid++) {
            let icon = this.bookmarks[bookmarkid].iconFactory(settings.get_int('item-icon-size'));
            let bookmark_item = new MenuItem(icon, this.bookmarks[bookmarkid].name);
            bookmark_item.place = this.bookmarks[bookmarkid];
            
            bookmark_item.connect('activate', function(actor, event) {
                actor.place.launch();
            });
            if (this._bookmarks_section.menu) { this._bookmarks_section.menu.addMenuItem(bookmark_item) } else { this._bookmarks_section.addMenuItem(bookmark_item) }
        }
    },
    
    /**
     * Refresh bookmarks section
     */
    _refreshBookmarksSection: function()
    {
        if (this._bookmarks_section.menu) { this._bookmarks_section.menu.removeAll() } else { this._bookmarks_section.removeAll() }
        this._createBookmarksSection();
    },
    
    /**
     * Build devices section
     */
    _createDevicesSection: function()
    {
        this.devices = Main.placesManager.getMounts();
        for (let devid = 0; devid < this.devices.length; devid++) {
            let icon = this.devices[devid].iconFactory(settings.get_int('item-icon-size'));
            let device_item = new DeviceMenuItem(this.devices[devid], icon, this.devices[devid].name);
            if (this._devices_section.menu) { this._devices_section.menu.addMenuItem(device_item) } else { this._devices_section.addMenuItem(device_item) }
        }

        if (this.devices.length == 0) {
            this._devices_section.actor.hide();
        } else {
            this._devices_section.actor.show();
        }
    },

    /**
     * Refresh devices section
     */
    _refreshDevicesSection: function()
    {
        if (this._devices_section.menu) { this._devices_section.menu.removeAll() } else { this._devices_section.removeAll() }
        this._createDevicesSection();
    },

    /**
     * Build recent documents section
     */
    _createRecentSection: function()
    {
        let id = 0;

        if (this.recentManager.size > 0) {
            let items = this.recentManager.get_items();
            while (id < settings.get_int('max-documents-documents') && id < this.recentManager.size) {
                let recent_item = new MenuItem(items[id].get_mime_type().replace("\/","-"), items[id].get_display_name());
                recent_item.connect('activate', Lang.bind(this, this._openRecentFile, items[id].get_uri()));
                this._recent_section.menu.addMenuItem(recent_item);
                id++;
            }
            
            // Clear list item
            this._recent_section.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            menuItem = new PopupMenu.PopupBaseMenuItem();
            let label = new St.Label({ text: _("Clear list") });
            menuItem.addActor(label, { align: St.Align.END });
            let icon = new St.Icon({ icon_name: 'edit-clear', icon_type: St.IconType.SYMBOLIC, style_class: 'popup-menu-icon' });
            menuItem.addActor(icon, { align: St.Align.MIDDLE });
            menuItem.connect('activate', Lang.bind(this, this._confirmClearRecent));
            this._recent_section.menu.addMenuItem(menuItem);
        }

        if (this.recentManager.size == 0) {
            this._recent_section.actor.hide();
        } else {
            this._recent_section.actor.show();
        }
    },

    /**
     * Refresh recent documents section
     */
    _refreshRecentSection: function()
    {
        this._recent_section.menu.removeAll();
        if (this.recentManager.size == 0) {
            this._recent_section.actor.visible = false;
        } else {
            this._recent_section.actor.show();
            this._recent_section.actor.visible = true;
            this._createRecentSection();
        }
    },

    /**
     * Dialog for confirmation on recent documents cleaning
     */
    _confirmClearRecent: function()
    {
        new ConfirmationDialog(Lang.bind(this, this._doClearRecent), CLEAR_RECENT_LABEL, CLEAR_RECENT_MESSAGE, _("Cancel"), _("Clear")).open();
    },

    /**
     * Action to clear recent documents
     */
    _doClearRecent: function()
    {
        this.recentManager.purge_items();
    },

    /**
     * Open file listed on recent documents list
     */
    _openRecentFile: function(object, event, recent_file)
    {
        new launch().file(recent_file);
    },
    
    /**
     * Launch applet's settings panel
     */
    _launchSettings: function()
    {
        //let settingsFile = GLib.build_filenamev([global.userdatadir, "applets/all-in-one-places@jofer/settings.py"]); 
        let settingsFile = APPLET_DIR + "/settings.py";
        new launch().command("python " + settingsFile);
    },

};



/**
 * Trying to centralize code to launch files or locations using different methods.
 */
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



/**
 * Load settings 
 */
function getSettings(schema_name, applet_dir)
{
    let schema_dir = applet_dir + "/schemas"

    // Check if schemas are available in .local or if it's installed system-wide
    if (GLib.file_test(schema_dir + '/gschemas.compiled', GLib.FileTest.EXISTS)) {
        schema_source = Gio.SettingsSchemaSource.new_from_directory(schema_dir, Gio.SettingsSchemaSource.get_default(), false);
        let schema = schema_source.lookup(SCHEMA_NAME, false);
        return new Gio.Settings({ settings_schema: schema });
    } else {
        if (Gio.Settings.list_schemas().indexOf(schema_name) == -1)
            throw "Schema \"%s\" not found.".format(schema_name);
        return new Gio.Settings({ schema: schema_name });
    }

}



/**
 * Go!!!!!!!
 */
function main(metadata, orientation)
{
    settings = getSettings(SCHEMA_NAME, APPLET_DIR);
        
    let all_in_one_places_applet = new MyApplet(orientation);
    return all_in_one_places_applet;
}
