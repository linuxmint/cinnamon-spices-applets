// Shutdown Menu With Icons Cinnamon Applet
// Developed by Nicolas LLOBERA from the System Shutdown and Restart Applet by Shelley
// version: 2.3 (08-02-2024)
// License: GPLv3
// Copyright © 2024 Nicolas LLOBERA

const Gettext = imports.gettext;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;
const St = imports.gi.St;
const Util = imports.misc.util;
const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;

const UUID = "ShutdownMenuWithIcons@LLOBERA";
const AppletUUID = "ShutdownMenuWithIcons@LLOBERA";

const AppletDirectory = imports.ui.appletManager.appletMeta[AppletUUID].path;
imports.searchPath.push(AppletDirectory);
const PopupMenuExtension = imports.popupImageLeftMenuItem;

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale")

function _(str) {
  return Gettext.dgettext(UUID, str);
}

function MyApplet(metadata, orientation, panel_height, instanceId) {
    this._init(metadata, orientation, panel_height, instanceId);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(metadata, orientation, panel_height, instanceId) {
        Applet.IconApplet.prototype._init.call(this, orientation);
        
        try {        
            this.set_applet_icon_symbolic_name("system-shutdown");
            this.set_applet_tooltip(_("Shutdown Menu With Icons"));
                      
            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager.addMenu(this.menu);

            this.settings = new Settings.AppletSettings(this, AppletUUID, instanceId);
            this.bindSettings();            

            this.createMenu();
            this.createContextMenu();
        }
        catch (e) {
            global.logError(e);
        }
    },
    
    bindSettings: function() {
        this.settings.bindProperty(Settings.BindingDirection.IN,
            "quit", "quit_enable", this.on_settings_changed, null
        );
        this.settings.bindProperty(Settings.BindingDirection.IN,
            "quit_icon", "quit_icon", this.on_settings_changed, null
        );
        this.settings.bindProperty(Settings.BindingDirection.IN,
            "quit_cmd", "quit_cmd", this.on_settings_changed, null
        );
        
        this.settings.bindProperty(Settings.BindingDirection.IN,
            "suspend", "suspend_enable", this.on_settings_changed, null
        );
        this.settings.bindProperty(Settings.BindingDirection.IN,
            "suspend_icon", "suspend_icon", this.on_settings_changed, null
        );
        this.settings.bindProperty(Settings.BindingDirection.IN,
            "suspend_cmd", "suspend_cmd", this.on_settings_changed, null
        );
        
        this.settings.bindProperty(Settings.BindingDirection.IN,
            "hibernate", "hibernate_enable", this.on_settings_changed, null
        );
        this.settings.bindProperty(Settings.BindingDirection.IN,
            "hibernate_icon", "hibernate_icon", this.on_settings_changed, null
        );
        this.settings.bindProperty(Settings.BindingDirection.IN,
            "hibernate_cmd", "hibernate_cmd", this.on_settings_changed, null
        );
        
        this.settings.bindProperty(Settings.BindingDirection.IN,
            "hybrid_sleep", "hybrid_sleep_enable", this.on_settings_changed, null
        );
        this.settings.bindProperty(Settings.BindingDirection.IN,
            "hybrid_sleep_icon", "hybrid_sleep_icon", this.on_settings_changed, null
        );
        this.settings.bindProperty(Settings.BindingDirection.IN,
            "hybrid_sleep_cmd", "hybrid_sleep_cmd", this.on_settings_changed, null
        );
        
        this.settings.bindProperty(Settings.BindingDirection.IN,
            "restart", "restart_enable", this.on_settings_changed, null
        );
        this.settings.bindProperty(Settings.BindingDirection.IN,
            "restart_icon", "restart_icon", this.on_settings_changed, null
        );
        this.settings.bindProperty(Settings.BindingDirection.IN,
            "restart_cmd", "restart_cmd", this.on_settings_changed, null
        );
        
        this.settings.bindProperty(Settings.BindingDirection.IN,
            "switch_users", "switch_users_enable", this.on_settings_changed, null
        );
        this.settings.bindProperty(Settings.BindingDirection.IN,
            "switch_users_icon", "switch_users_icon", this.on_settings_changed, null
        );
        this.settings.bindProperty(Settings.BindingDirection.IN,
            "switch_users_cmd", "switch_users_cmd", this.on_settings_changed, null
        );
        
        this.settings.bindProperty(Settings.BindingDirection.IN,
            "log_out", "log_out_enable", this.on_settings_changed, null
        );
        this.settings.bindProperty(Settings.BindingDirection.IN,
            "log_out_icon", "log_out_icon", this.on_settings_changed, null
        );
        this.settings.bindProperty(Settings.BindingDirection.IN,
            "log_out_cmd", "log_out_cmd", this.on_settings_changed, null
        );
        
        this.settings.bindProperty(Settings.BindingDirection.IN,
            "screen_lock", "screen_lock_enable", this.on_settings_changed, null
        );
        this.settings.bindProperty(Settings.BindingDirection.IN,
            "screen_lock_icon", "screen_lock_icon", this.on_settings_changed, null
        );
        this.settings.bindProperty(Settings.BindingDirection.IN,
            "screen_lock_cmd", "screen_lock_cmd", this.on_settings_changed, null
        );
    },
    
    createMenu: function() {
        if (this.quit_enable)
            this.createMenuItem(_("Quit"), this.quit_icon, this.quit_cmd);
        
        if (this.suspend_enable)
            this.createMenuItem(_("Suspend"), this.suspend_icon, this.suspend_cmd);
        
        if (this.hibernate_enable)
            this.createMenuItem(_("Hibernate"), this.hibernate_icon, this.hibernate_cmd);
        
        if (this.hybrid_sleep_enable)
            this.createMenuItem(_("Hybrid sleep"), this.hybrid_sleep_icon, this.hybrid_sleep_cmd);
        
        if (this.restart_enable)
            this.createMenuItem(_("Restart"), this.restart_icon, this.restart_cmd);
        
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        
        if (this.switch_users_enable)
            this.createMenuItem(_("Switch users"), this.switch_users_icon, this.switch_users_cmd);
        
        if (this.log_out_enable)
            this.createMenuItem(_("Log out"), this.log_out_icon, this.log_out_cmd);
        
        if (this.screen_lock_enable)
            this.createMenuItem(_("Screen Lock"), this.screen_lock_icon, this.screen_lock_cmd);
    },
    
    createMenuItem: function(displayName, iconName, command) {
        var menuItem = new PopupMenuExtension.PopupImageLeftMenuItem(displayName, iconName, command);
        menuItem.connect("activate", function(actor, event) {
            // As application variable is not accessible here, 
            // the application variable is passed to the PopupImageLeftMenuItem ctor to be accessible throw the actor argument
            // which is the menuItem itself
            Util.trySpawnCommandLine(actor.command);
        });
        this.menu.addMenuItem(menuItem);
    },
    
    on_applet_clicked: function(event) {
        this.menu.toggle();        
    },
    
    createContextMenu: function () {    
        this.settings_menu_item = new Applet.MenuItem(_("Settings"), Gtk.STOCK_EDIT, function() {
            Util.trySpawnCommandLine("cinnamon-settings applets " + AppletUUID);
        });
        this._applet_context_menu.addMenuItem(this.settings_menu_item);
        
        this.help_menu_item = new Applet.MenuItem(_("Help"), Gtk.STOCK_HELP, function() {
            Util.spawnCommandLine("xdg-open " + AppletDirectory + "/README.txt");
        });
        this._applet_context_menu.addMenuItem(this.help_menu_item);
        
        this.about_menu_item = new Applet.MenuItem(_("About"), Gtk.STOCK_ABOUT,  function() {
            Util.spawnCommandLine("xdg-open " + AppletDirectory + "/ABOUT.txt");
        });
        this._applet_context_menu.addMenuItem(this.about_menu_item);
    },
    
    on_settings_changed: function() {
        this.menu.removeAll();
        this.createMenu();
    }
};

function main(metadata, orientation, panel_height, instanceId) {
    var myApplet = new MyApplet(metadata, orientation, panel_height, instanceId);
    return myApplet;      
}
