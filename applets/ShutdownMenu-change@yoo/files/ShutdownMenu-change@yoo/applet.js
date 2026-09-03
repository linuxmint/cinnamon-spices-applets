// name： ShutdownMenu-change
// description： 修改 ShutdownMenuWithIcons@LLOBERA，使其更易于使用。
// version: 1.1 (09-04-2026)
// License: GPLv3
// Copyright © 2026 yoo

const Gettext = imports.gettext;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;
const Clutter = imports.gi.Clutter;
const St = imports.gi.St;
const Util = imports.misc.util;
const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;
const Lang = imports.lang;
const Main = imports.ui.main;          // 新增：用于 Expo / Scale
const Cinnamon = imports.gi.Cinnamon;  // 新增：用于获取事件修饰键

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

            // 滚轮事件
            this.actor.connect('scroll-event', Lang.bind(this, this._on_scroll_event));
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

        // 新增：滚动切换工作区开关
        this.settings.bindProperty(Settings.BindingDirection.IN,
            "scroll_switch", "scroll_switch", this.on_settings_changed, null
        );

        // 新增：中键点击动作
        this.settings.bindProperty(Settings.BindingDirection.IN,
            "middle_click_action", "middle_click_action", this.on_settings_changed, null
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
            Util.trySpawnCommandLine(actor.command);
        });
        this.menu.addMenuItem(menuItem);
    },
    
    on_applet_clicked: function(event) {
        this.menu.toggle();        
    },

    // ===== 新增：中键点击处理 =====
    on_applet_middle_clicked: function(event) {
        let action = this.middle_click_action || "nothing";
        this.perform_action(action);
    },
    
    perform_action: function(action) {
        if (action == "show_expo") {
            if (!Main.expo.animationInProgress)
                Main.expo.toggle();
        } else if (action == "show_scale") {
            if (!Main.overview.animationInProgress)
                Main.overview.toggle();
        }
        // "nothing" 或其他值则不执行任何操作
    },
    // ===== 新增结束 =====

    // ===== 滚轮事件处理 =====
    _on_scroll_event: function(actor, event) {
        if (!this.scroll_switch) {
            return true;
        }

        let direction = event.get_scroll_direction();
        if (direction == Clutter.ScrollDirection.SMOOTH) {
            return true;
        }

        let workspace_manager = global.screen;
        let current_index = workspace_manager.get_active_workspace_index();
        let n_workspaces = workspace_manager.n_workspaces;

        if (n_workspaces < 2) {
            return true;
        }

        if (direction == Clutter.ScrollDirection.UP) {
            let target_index = (current_index - 1 + n_workspaces) % n_workspaces;
            workspace_manager.get_workspace_by_index(target_index).activate(global.get_current_time());
        } else if (direction == Clutter.ScrollDirection.DOWN) {
            let target_index = (current_index + 1) % n_workspaces;
            workspace_manager.get_workspace_by_index(target_index).activate(global.get_current_time());
        }
        return true;
    },
    // ===== 滚轮事件处理结束 =====

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