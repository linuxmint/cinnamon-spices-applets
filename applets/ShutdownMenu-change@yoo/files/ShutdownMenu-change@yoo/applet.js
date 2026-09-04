// name： ShutdownMenu-change
// description： 这是一个 Cinnamon 面板小工具，提供包含关机选项的菜单，并支持通过鼠标中键交互进行个性化操作。本工具通过重构 ShutdownMenuWithIcons@LLOBERA 的代码而来，使其更易于使用。
// version: 1.2 (09-04-2026)
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
const Main = imports.ui.main;          

const UUID = "ShutdownMenu-change@yoo";
const AppletUUID = "ShutdownMenu-change@yoo";

Gettext.bindtextdomain(UUID, GLib.get_user_data_dir() + "/locale");
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

            this._updatePanelIcon();
            this.set_applet_tooltip(_("Shutdown Menu"));
                      
            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager.addMenu(this.menu);        

            this.createMenu();

            this.actor.connect('scroll-event', this._on_scroll_event.bind(this));
        }
        catch (e) {
            global.logError(e);
        }
    },
    
    bindSettings: function() {
        this.settings.bindProperty(Settings.BindingDirection.IN,
            "panel_icon", "panel_icon", this._updatePanelIcon, null
        );
        this.settings.bindProperty(Settings.BindingDirection.IN,
            "icon_size", "icon_size", this._updateIconSize, null
        );

        this.settings.bindProperty(Settings.BindingDirection.IN,
            "quit", "quit_enable", this._rebuildMenu, null
        );
        this.settings.bindProperty(Settings.BindingDirection.IN,
            "quit_icon", "quit_icon", this._rebuildMenu, null
        );
        this.settings.bindProperty(Settings.BindingDirection.IN,
            "quit_cmd", "quit_cmd", this._rebuildMenu, null
        );

        this.settings.bindProperty(Settings.BindingDirection.IN,
            "show_separator", "show_separator", this._rebuildMenu, null
        );
        
        this.settings.bindProperty(Settings.BindingDirection.IN,
            "log_out", "log_out_enable", this._rebuildMenu, null
        );
        this.settings.bindProperty(Settings.BindingDirection.IN,
            "log_out_icon", "log_out_icon", this._rebuildMenu, null
        );
        this.settings.bindProperty(Settings.BindingDirection.IN,
            "log_out_cmd", "log_out_cmd", this._rebuildMenu, null
        );
        
        this.settings.bindProperty(Settings.BindingDirection.IN,
            "screen_lock", "screen_lock_enable", this._rebuildMenu, null
        );
        this.settings.bindProperty(Settings.BindingDirection.IN,
            "screen_lock_icon", "screen_lock_icon", this._rebuildMenu, null
        );
        this.settings.bindProperty(Settings.BindingDirection.IN,
            "screen_lock_cmd", "screen_lock_cmd", this._rebuildMenu, null
        );

        this.settings.bindProperty(Settings.BindingDirection.IN,
            "scroll_switch", "scroll_switch", null, null
        );

        this.settings.bindProperty(Settings.BindingDirection.IN,
            "middle_click_action", "middle_click_action", null, null
        );
    },

    _updatePanelIcon: function() {
        let iconName = this.panel_icon || "system-shutdown";
        if (iconName === '') {
            this._applet_icon_box.hide();
            return;
        }
        this._applet_icon_box.show();

        if (GLib.path_is_absolute(iconName)) {
            let file = Gio.file_new_for_path(iconName);
            try {
                file.query_info('standard::*', Gio.FileQueryInfoFlags.NONE, null);
                if (iconName.includes('-symbolic')) {
                    this.set_applet_icon_symbolic_path(iconName);
                } else {
                    this.set_applet_icon_path(iconName);
                }
            } catch (e) {
                this.set_applet_icon_symbolic_name("system-shutdown-symbolic");
            }
        } else {
            if (this._iconThemeHasIcon(iconName)) {
                if (iconName.includes('-symbolic')) {
                    this.set_applet_icon_symbolic_name(iconName);
                } else {
                    this.set_applet_icon_name(iconName);
                }
            } else {
                this.set_applet_icon_symbolic_name("system-shutdown-symbolic");
            }
        }
        this._updateIconSize();
    },

    _iconThemeHasIcon: function(iconName) {
        let iconTheme = Gtk.IconTheme.get_default();
        let iconInfo = iconTheme.lookup_icon(iconName, 24, Gtk.IconLookupFlags.FORCE_SIZE);
        return iconInfo !== null;
    },

    _updateIconSize: function() {
        let size = parseInt(this.icon_size, 10);
        if (!isNaN(size) && size > 0) {
            this._applet_icon.set_icon_size(size);
        }
    },

    createMenu: function() {
        this.menu.removeAll();

        if (this.quit_enable) {
            this._createMenuItem(_("Quit"), this.quit_icon, this.quit_cmd);
            if (this.show_separator) {
                this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            }
        }
        
        if (this.log_out_enable)
            this._createMenuItem(_("Log out"), this.log_out_icon, this.log_out_cmd);
        
        if (this.screen_lock_enable)
            this._createMenuItem(_("Screen Lock"), this.screen_lock_icon, this.screen_lock_cmd);
    },
    
    _createMenuItem: function(displayName, iconName, command) {
        let iconParam = null;
        if (iconName) {
            if (GLib.path_is_absolute(iconName)) {
                let file = Gio.file_new_for_path(iconName);
                try {
                    file.query_info('standard::*', Gio.FileQueryInfoFlags.NONE, null);
                    iconParam = new Gio.FileIcon({ file: file });
                } catch (e) {
                    iconParam = "image-missing";
                }
            } else {
                iconParam = iconName;
            }
        }
        if (!iconParam) {
            iconParam = "image-missing";
        }

        let menuItem = new PopupMenu.PopupIconMenuItem(displayName, iconParam, St.IconType.FULLCOLOR);
        menuItem._command = command;
        menuItem.connect("activate", function() {
            Util.trySpawnCommandLine(command);
        });
        this.menu.addMenuItem(menuItem);
    },
    
    on_applet_clicked: function(event) {
        this.menu.toggle();        
    },

    on_applet_middle_clicked: function(event) {
        let action = this.middle_click_action || "nothing";
        this._performAction(action);
    },
    
    _performAction: function(action) {
        if (action == "show_expo") {
            if (Main.expo && !Main.expo.animationInProgress)
                Main.expo.toggle();
        } else if (action == "show_scale") {
            if (Main.overview && !Main.overview.animationInProgress)
                Main.overview.toggle();
        } else if (action == "toggle_desktop_icons") {
            this._toggleDesktopIcons();
        }
    },
    
    _toggleDesktopIcons: function() {
        let nemoSettings = new Gio.Settings({ schema_id: 'org.nemo.desktop' });
        let current = nemoSettings.get_boolean('show-desktop-icons');
        nemoSettings.set_boolean('show-desktop-icons', !current);
    },

    _on_scroll_event: function(actor, event) {
        if (!this.scroll_switch) {
            return true;
        }

        let direction = event.get_scroll_direction();
        if (direction == Clutter.ScrollDirection.SMOOTH) {
            return true;
        }

        let wsManager = global.workspace_manager;
        let current_index = wsManager.get_active_workspace_index();
        let n_workspaces = wsManager.n_workspaces;

        if (n_workspaces < 2) {
            return true;
        }

        if (direction == Clutter.ScrollDirection.UP) {
            let target_index = (current_index - 1 + n_workspaces) % n_workspaces;
            wsManager.get_workspace_by_index(target_index).activate(global.get_current_time());
        } 
        else if (direction == Clutter.ScrollDirection.DOWN) {
            let target_index = (current_index + 1) % n_workspaces;
            wsManager.get_workspace_by_index(target_index).activate(global.get_current_time());
        }
        return true;
    },

    _rebuildMenu: function() {
        this.createMenu();
    }
};

function main(metadata, orientation, panel_height, instanceId) {
    var myApplet = new MyApplet(metadata, orientation, panel_height, instanceId);
    return myApplet;      
}