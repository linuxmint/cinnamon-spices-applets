// name： ShutdownMenu-change
// description： 修改 ShutdownMenuWithIcons@LLOBERA，使其更易于使用。
// version: 1.0 (09-02-2026)
// License: GPLv3
// Copyright © 2026 yoo

const Gettext = imports.gettext;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;
const St = imports.gi.St;
const Util = imports.misc.util;
const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;

const UUID = "ShutdownMenu-change@yoo";
const AppletUUID = "ShutdownMenu-change@yoo";

const AppletDirectory = imports.ui.appletManager.appletMeta[AppletUUID].path;
imports.searchPath.push(AppletDirectory);
const PopupMenuExtension = imports.popupImageLeftMenuItem;

Gettext.bindtextdomain(UUID, GLib.get_user_data_dir() + "/locale")

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
            this.settings = new Settings.AppletSettings(this, AppletUUID, instanceId);
            this.bindSettings();    

            let iconName = this.panel_icon || "system-shutdown";
            this.set_applet_icon_symbolic_name(iconName);
            // 应用用户配置的图标大小
            let size = parseInt(this.icon_size, 10);
            if (!isNaN(size) && size > 0) {
                this._applet_icon.set_icon_size(size);
            }
            this.set_applet_tooltip(_("Shutdown Menu"));
                      
            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager.addMenu(this.menu);        

            this.createMenu();
        }
        catch (e) {
            global.logError(e);
        }
    },
    
    bindSettings: function() {
        this.settings.bindProperty(Settings.BindingDirection.IN,
            "panel_icon", "panel_icon", this.on_settings_changed, null
        );
        this.settings.bindProperty(Settings.BindingDirection.IN,
            "icon_size", "icon_size", this.on_settings_changed, null
        );

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

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        
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

    on_settings_changed: function() {
        // 实时更新面板图标
        let iconName = this.panel_icon || "system-shutdown";
        this.set_applet_icon_symbolic_name(iconName);
        
        // 实时更新面板图标大小
        let size = parseInt(this.icon_size, 10);
        if (!isNaN(size) && size > 0) {
            this._applet_icon.set_icon_size(size);
        }

        this.menu.removeAll();
        this.createMenu();
    }
};

function main(metadata, orientation, panel_height, instanceId) {
    var myApplet = new MyApplet(metadata, orientation, panel_height, instanceId);
    return myApplet;      
}
