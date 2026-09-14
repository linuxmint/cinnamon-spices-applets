// name： ShutdownMenu-change
// description： Offers a shutdown menu with scroll workspace switching, middle-click actions, custom menu items, and grid layout — unlocking more ways to play.
// version: 1.4.0 (14-09-2026)
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

const DEFAULT_PANEL_ICON = "system-shutdown";
const DEFAULT_PANEL_ICON_SYMBOLIC = "system-shutdown-symbolic";
const DEFAULT_CUSTOM_ICON = "application-x-executable";
const FALLBACK_ICON = "image-missing";
const SEPARATOR_ROW_NAME = "-";

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
            this._rebuildMenuId = 0;
            this._iconThemeCache = {};

            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager.addMenu(this.menu);

            this.settings = new Settings.AppletSettings(this, UUID, instanceId);
            this.bindSettings();

            this._iconTheme = Gtk.IconTheme.get_default();
            this._iconTheme.connect('changed', () => {
                this._iconThemeCache = {};
            });

            this._updatePanelIcon();
            this.set_applet_tooltip(_("Shutdown Menu"));

            this.createMenu();

            this.actor.connect('scroll-event', this._on_scroll_event.bind(this));
        }
        catch (e) {
            global.logError(e);
        }
    },

    bindSettings: function() {
        let menuBound = [
            ["quit", "quit_enable"],
            ["quit_icon", "quit_icon"],
            ["quit_cmd", "quit_cmd"],
            ["show_separator", "show_separator"],
            ["log_out", "log_out_enable"],
            ["log_out_icon", "log_out_icon"],
            ["log_out_cmd", "log_out_cmd"],
            ["screen_lock", "screen_lock_enable"],
            ["screen_lock_icon", "screen_lock_icon"],
            ["screen_lock_cmd", "screen_lock_cmd"],
            ["custom_items", "custom_items"],
            ["custom_position", "custom_position"],
            ["show_custom_separator", "show_custom_separator"],
            ["menu_text_size", "menu_text_size"],
            ["menu_icon_size", "menu_icon_size"],
            ["custom_grid_mode", "custom_grid_mode"],
            ["custom_grid_columns", "custom_grid_columns"],
            ["custom_grid_show_label", "custom_grid_show_label"],
            ["custom_grid_icon_size", "custom_grid_icon_size"],
            ["custom_grid_hide_builtin", "custom_grid_hide_builtin"],
            ["custom_grid_label_spacing", "custom_grid_label_spacing"],
            ["custom_grid_cell_width", "custom_grid_cell_width"],
            ["custom_grid_cell_height", "custom_grid_cell_height"],
        ];
        menuBound.forEach(([key, prop]) => {
            this.settings.bindProperty(Settings.BindingDirection.IN, key, prop, this._rebuildMenu, null);
        });

        this.settings.bindProperty(Settings.BindingDirection.IN,
            "panel_icon", "panel_icon", this._updatePanelIcon, null);
        this.settings.bindProperty(Settings.BindingDirection.IN,
            "icon_size", "icon_size", this._updateIconSize, null);
        this.settings.bindProperty(Settings.BindingDirection.IN,
            "scroll_switch", "scroll_switch", null, null);
        this.settings.bindProperty(Settings.BindingDirection.IN,
            "middle_click_action", "middle_click_action", null, null);
    },

    _fileExists: function(path) {
        try {
            Gio.file_new_for_path(path).query_info(
                'standard::*', Gio.FileQueryInfoFlags.NONE, null);
            return true;
        } catch (e) {
            return false;
        }
    },

    _resolveGIcon: function(iconName) {
        if (!iconName) return null;
        if (GLib.path_is_absolute(iconName)) {
            if (!this._fileExists(iconName)) return null;
            return new Gio.FileIcon({ file: Gio.file_new_for_path(iconName) });
        }
        return new Gio.ThemedIcon({ name: iconName });
    },

    _updatePanelIcon: function() {
        let iconName = this.panel_icon || DEFAULT_PANEL_ICON;
        if (iconName === '') {
            this._applet_icon_box.hide();
            return;
        }
        this._applet_icon_box.show();

        this._setPanelIcon(iconName);
        this._updateIconSize();
    },

    _setPanelIcon: function(iconName) {
        let isPath = GLib.path_is_absolute(iconName);
        let isSymbolic = iconName.includes('-symbolic');
        let exists = isPath ? this._fileExists(iconName) : this._iconThemeHasIcon(iconName);

        if (!exists) {
            this.set_applet_icon_symbolic_name(DEFAULT_PANEL_ICON_SYMBOLIC);
            return;
        }

        if (isPath) {
            if (isSymbolic) this.set_applet_icon_symbolic_path(iconName);
            else this.set_applet_icon_path(iconName);
        } else {
            if (isSymbolic) this.set_applet_icon_symbolic_name(iconName);
            else this.set_applet_icon_name(iconName);
        }
    },

    _iconThemeHasIcon: function(iconName) {
        if (Object.prototype.hasOwnProperty.call(this._iconThemeCache, iconName)) {
            return this._iconThemeCache[iconName];
        }
        let iconInfo = this._iconTheme.lookup_icon(iconName, 24, Gtk.IconLookupFlags.FORCE_SIZE);
        let exists = iconInfo !== null;
        this._iconThemeCache[iconName] = exists;
        return exists;
    },

    _updateIconSize: function() {
        let size = parseInt(this.icon_size, 10);
        if (!isNaN(size) && size > 0) {
            this._applet_icon.set_icon_size(size);
        }
    },

    createMenu: function() {
        if (!this.menu) return;
        this.menu.removeAll();

        let hasCustom = this.custom_items && this.custom_items.length > 0;
        let hideBuiltin = this.custom_grid_mode && this.custom_grid_hide_builtin;
        let hasBuiltin = !hideBuiltin &&
            (this.quit_enable || this.log_out_enable || this.screen_lock_enable);
        let customAbove = (this.custom_position === 0);

        if (hasCustom && customAbove) {
            this._addCustomItems();
            this._addSeparatorIf(this.show_custom_separator && hasBuiltin);
        }

        if (!hideBuiltin) {
            this._addBuiltinItems();
        }

        if (hasCustom && !customAbove) {
            this._addSeparatorIf(this.show_custom_separator && hasBuiltin);
            this._addCustomItems();
        }
    },

    _addSeparatorIf: function(condition) {
        if (condition) {
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        }
    },

    _addBuiltinItems: function() {
        if (this.quit_enable) {
            this._createMenuItem(_("Quit"), this.quit_icon, this.quit_cmd);
            this._addSeparatorIf(this.show_separator);
        }
        if (this.log_out_enable) {
            this._createMenuItem(_("Log out"), this.log_out_icon, this.log_out_cmd);
        }
        if (this.screen_lock_enable) {
            this._createMenuItem(_("Screen Lock"), this.screen_lock_icon, this.screen_lock_cmd);
        }
    },

    _addCustomItems: function() {
        if (this.custom_grid_mode) {
            this._addCustomItemsGrid();
        } else {
            this._addCustomItemsList();
        }
    },

    _addCustomItemsList: function() {
        this.custom_items.forEach(item => {
            if (!item || !item.name) return;

            if (item.name === SEPARATOR_ROW_NAME && !item.command) {
                this._addSeparatorIf(true);
                return;
            }

            if (item.command) {
                this._createMenuItem(item.name, item.icon || DEFAULT_CUSTOM_ICON, item.command);
            }
        });
    },

    _addCustomItemsGrid: function() {
        let items = this.custom_items.filter(item =>
            item && item.name && item.command
        );
        if (items.length === 0) return;

        try {
            let cols = this.custom_grid_columns || 4;
            let showLabel = this.custom_grid_show_label;
            let iconSize = this.custom_grid_icon_size || this.menu_icon_size || 32;
            let textSize = parseInt(this.menu_text_size, 10);

            let cellWidth = parseInt(this.custom_grid_cell_width, 10);
            if (isNaN(cellWidth) || cellWidth < 0) cellWidth = 0;
            let cellHeight = parseInt(this.custom_grid_cell_height, 10);
            if (isNaN(cellHeight) || cellHeight < 0) cellHeight = 0;

            let spacing = parseInt(this.custom_grid_label_spacing, 10);
            if (isNaN(spacing) || spacing < 0) spacing = 6;

            let gridBox = new St.Bin({
                style_class: 'menu-applications-grid-box',
                x_fill: true,
                y_fill: true
            });
            let gridLayout = new Clutter.Actor({
                layout_manager: new Clutter.GridLayout({
                    column_homogeneous: true,
                    row_homogeneous: false
                })
            });
            gridBox.set_child(gridLayout);
            let gridMgr = gridLayout.layout_manager;

            let column = 0;
            let rownum = 0;

            items.forEach((item) => {
                let button = new St.Button({
                    style_class: 'popup-menu-item',
                    can_focus: true,
                    x_expand: true,
                    y_expand: true
                });
                if (cellWidth > 0) button.set_width(cellWidth);
                if (cellHeight > 0) button.set_height(cellHeight);

                let vbox = new St.BoxLayout({
                    vertical: true,
                    x_align: Clutter.ActorAlign.CENTER,
                    y_align: Clutter.ActorAlign.CENTER,
                    style: 'padding: 4px; spacing: ' + spacing + 'px;'
                });

                let gicon = this._resolveGIcon(item.icon || DEFAULT_CUSTOM_ICON);
                let icon = gicon
                    ? new St.Icon({ gicon: gicon, icon_size: iconSize })
                    : new St.Icon({ icon_name: FALLBACK_ICON, icon_size: iconSize });
                vbox.add_child(icon);

                if (showLabel) {
                    let label = new St.Label({
                        text: item.name,
                        x_align: Clutter.ActorAlign.CENTER
                    });
                    if (!isNaN(textSize) && textSize > 0) {
                        label.set_style('font-size: ' + textSize + 'px;');
                    }
                    vbox.add_child(label);
                }

                button.set_child(vbox);

                button.connect('clicked', () => {
                    Util.trySpawnCommandLine(item.command);
                    this.menu.close();
                });

                button.connect('enter-event', () => {
                    if (!button.has_style_pseudo_class('active')) {
                        button.add_style_pseudo_class('active');
                    }
                });
                button.connect('leave-event', () => {
                    if (button.has_style_pseudo_class('active')) {
                        button.remove_style_pseudo_class('active');
                    }
                });

                gridMgr.attach(button, column, rownum, 1, 1);

                column++;
                if (column >= cols) {
                    column = 0;
                    rownum++;
                }
            });

            let section = new PopupMenu.PopupMenuSection();
            section.actor.add_actor(gridBox);
            this.menu.addMenuItem(section);
        } catch (e) {
            global.logError('ShutdownMenu-change grid error: ' + e.message);
            this._addCustomItemsList();
        }
    },

    _createMenuItem: function(displayName, iconName, command) {
        let menuItem = new PopupMenu.PopupBaseMenuItem();
        let size = this.menu_icon_size || 24;

        let gicon = this._resolveGIcon(iconName);
        let icon = gicon
            ? new St.Icon({ gicon: gicon, icon_size: size })
            : new St.Icon({ icon_name: FALLBACK_ICON, icon_size: size });
        menuItem.addActor(icon);

        let label = new St.Label({
            text: displayName,
            y_align: Clutter.ActorAlign.CENTER
        });
        let textSize = parseInt(this.menu_text_size, 10);
        if (!isNaN(textSize) && textSize > 0) {
            label.set_style('font-size: ' + textSize + 'px;');
        }
        menuItem.addActor(label, { expand: true });

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
        let actions = {
            "show_desktop": () => {
                global.workspace_manager.toggle_desktop(global.get_current_time());
            },
            "show_expo": () => {
                if (Main.expo && !Main.expo.animationInProgress) Main.expo.toggle();
            },
            "show_scale": () => {
                if (Main.overview && !Main.overview.animationInProgress) Main.overview.toggle();
            },
            "toggle_desktop_icons": () => this._toggleDesktopIcons(),
        };
        let fn = actions[action];
        if (fn) fn();
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
        if (this._rebuildMenuId) {
            GLib.source_remove(this._rebuildMenuId);
            this._rebuildMenuId = 0;
        }
        this._rebuildMenuId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 80, () => {
            this._rebuildMenuId = 0;
            this.createMenu();
            return GLib.SOURCE_REMOVE;
        });
    }
};

function main(metadata, orientation, panel_height, instanceId) {
    var myApplet = new MyApplet(metadata, orientation, panel_height, instanceId);
    return myApplet;
}