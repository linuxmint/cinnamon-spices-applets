/*
* Dark Mode applet lets you easily switch between dark mode and light mode with one click.

* Copyright (C) 2021  Gobinath Loganathan

* This program is free software: you can redistribute it and/or modify
* it under the terms of the GNU General Public License as published by
* the Free Software Foundation, either version 3 of the License, or
* (at your option) any later version.

* This program is distributed in the hope that it will be useful,
* but WITHOUT ANY WARRANTY; without even the implied warranty of
* MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
* GNU General Public License for more details.

* You should have received a copy of the GNU General Public License
* along with this program.  If not, see <http:*www.gnu.org/licenses/>.
*/

const Lang = imports.lang;
const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Util = imports.misc.util;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Settings = imports.ui.settings;
const FileUtils = imports.misc.fileUtils;
const Gettext = imports.gettext;

//----------------------------------------------------------------------
//
// Constants
//
//----------------------------------------------------------------------

const UUID = "darkMode@linuxedo.com";
const HOME_DIR = GLib.get_home_dir();
const DESKLET_PATH = HOME_DIR + '/.local/share/cinnamon/applets/darkMode@linuxedo.com/';
const ICON_SUN = DESKLET_PATH + "icons/sun-symbolic.svg";
const ICON_MOON = DESKLET_PATH + "icons/moon-symbolic.svg";
const LOCAL_THEMES_DIR = HOME_DIR + "/.themes";
const SYSTEM_THEMES_DIR = "/usr/share/themes";
const LOCAL_ICONS_DIR = HOME_DIR + "/.local/share/icons";
const SYSTEM_ICONS_DIR = "/usr/share/icons";

Gettext.bindtextdomain(UUID, HOME_DIR + "/.local/share/locale")

function _(text) {
    let locText = Gettext.dgettext(UUID, text);
    return locText;
}

function MyApplet(orientation, panelHeight, instanceId) {
    this.settings = new Settings.AppletSettings(this, UUID, instanceId);
    this.gtk_themes = {};
    this.cinnamon_themes = {};
    this.window_border_themes = {};
    this.icons = {};
    this._init(orientation, panelHeight, instanceId);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function (orientation, panelHeight, instanceId) {
        Applet.IconApplet.prototype._init.call(this, orientation, panelHeight, instanceId);
        this.set_applet_icon_symbolic_path(ICON_SUN);
        this.set_applet_tooltip(_("Dark Mode")); // applet tooltip

        // Bind settings to variables
        this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL,
            "enable_dark_mode",
            "enable_dark_mode",
            this.on_settings_changed,
            null);
        this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL,
            "light_gtk_theme",
            "light_gtk_theme",
            this.on_settings_changed,
            null);
        this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL,
            "dark_gtk_theme",
            "dark_gtk_theme",
            this.on_settings_changed,
            null);
        this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL,
            "light_win_border_theme",
            "light_win_border_theme",
            this.on_settings_changed,
            null);
        this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL,
            "dark_win_border_theme",
            "dark_win_border_theme",
            this.on_settings_changed,
            null);
        this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL,
            "light_cinnamon_theme",
            "light_cinnamon_theme",
            this.on_settings_changed,
            null);
        this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL,
            "dark_cinnamon_theme",
            "dark_cinnamon_theme",
            this.on_settings_changed,
            null);
        this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL,
            "light_icon_theme",
            "light_icon_theme",
            this.on_settings_changed,
            null);
        this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL,
            "dark_icon_theme",
            "dark_icon_theme",
            this.on_settings_changed,
            null);

        this.menu_manager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menu_manager.addMenu(this.menu);

        this.dark_mode_switch = new PopupMenu.PopupSwitchMenuItem(_("Dark Mode"), this.darkMode);
        this.dark_mode_switch.connect('toggled', Lang.bind(this, this.on_change_theme));
        this.menu.addMenuItem(this.dark_mode_switch);

        // Update the UI
        this.set_dark_mode(this.enable_dark_mode);
        this.refresh_themes();
    },

    on_applet_clicked: function (event) {
        this.dark_mode_switch.setToggleState(this.enable_dark_mode);
        this.menu.toggle();
    },

    on_settings_changed: function () {
        this.enable_dark_mode = this.settings.getValue("enable_dark_mode");
        this.light_gtk_theme = this.settings.getValue("light_gtk_theme");
        this.dark_gtk_theme = this.settings.getValue("dark_gtk_theme");
        this.light_cinnamon_theme = this.settings.getValue("light_cinnamon_theme");
        this.dark_cinnamon_theme = this.settings.getValue("dark_cinnamon_theme");
        this.light_win_border_theme = this.settings.getValue("light_win_border_theme");
        this.dark_win_border_theme = this.settings.getValue("dark_win_border_theme");
        this.light_icon_theme = this.settings.getValue("light_icon_theme");
        this.dark_icon_theme = this.settings.getValue("dark_icon_theme");
        this.set_dark_mode(this.enable_dark_mode);
    },

    on_change_theme: function (item) {
        this.menu.toggle();
        this.set_dark_mode(item.state);
        this.enable_dark_mode = item.state;
    },

    set_dark_mode: function (dark_mode) {
        let win_border_theme = null;
        let gtk_theme = null;
        let cinnamon_theme = null;
        let icon_theme = null;
        if (dark_mode) {
            win_border_theme = this.dark_win_border_theme;
            gtk_theme = this.dark_gtk_theme;
            cinnamon_theme = this.dark_cinnamon_theme;
            icon_theme = this.dark_icon_theme;
            this.set_applet_icon_symbolic_path(ICON_MOON);
        }
        else {
            win_border_theme = this.light_win_border_theme;
            gtk_theme = this.light_gtk_theme;
            cinnamon_theme = this.light_cinnamon_theme;
            icon_theme = this.light_icon_theme;
            this.set_applet_icon_symbolic_path(ICON_SUN);
        }
        if (this.is_valid_theme_name(win_border_theme)) {
            Util.spawnCommandLine('gsettings set org.cinnamon.desktop.wm.preferences theme ' + win_border_theme);
        }
        if (this.is_valid_theme_name(gtk_theme)) {
            Util.spawnCommandLine('gsettings set org.cinnamon.desktop.interface gtk-theme ' + gtk_theme);
        }
        if (this.is_valid_theme_name(cinnamon_theme)) {
            Util.spawnCommandLine('gsettings set org.cinnamon.theme name ' + cinnamon_theme);
        }
        if (this.is_valid_theme_name(icon_theme)) {
            Util.spawnCommandLine('gsettings set org.cinnamon.desktop.interface icon-theme ' + icon_theme);
        }
    },

    is_valid_theme_name: function (theme) {
        return theme != "" && theme != null && theme != "none";
    },

    refresh_themes: function () {
        this.gtk_themes = {};
        this.icons = {};
        this.cinnamon_themes = {};
        this.window_border_themes = {};
        let local_themes_dir = Gio.File.new_for_path(LOCAL_THEMES_DIR);
        let local_icons_dir = Gio.File.new_for_path(LOCAL_ICONS_DIR);
        FileUtils.listDirAsync(local_themes_dir, Lang.bind(this, this.collect_local_themes));
        FileUtils.listDirAsync(local_icons_dir, Lang.bind(this, this.collect_local_icons));
    },

    collect_local_themes: function (dir_entry) {
        this.collect_themes(LOCAL_THEMES_DIR, dir_entry);
    },

    collect_system_themes: function (dir_entry) {
        this.collect_themes(SYSTEM_THEMES_DIR, dir_entry);
    },

    collect_local_icons: function (dir_entry) {
        this.collect_icons(LOCAL_ICONS_DIR, dir_entry);
    },

    collect_system_icons: function (dir_entry) {
        this.collect_icons(SYSTEM_ICONS_DIR, dir_entry);
    },

    collect_themes: function (parent, dir_entry) {
        let gtk_theme_names = [];
        let cinnamon_theme_names = [];
        let win_border_theme_names = [];
        for (let i in dir_entry) {
            let theme_name = dir_entry[i].get_name();
            let theme_path = parent + "/" + theme_name;
            if (this.is_dir(theme_path)) {
                if (this.is_gtk_theme(theme_path)) {
                    gtk_theme_names.push(theme_name);
                }
                if (this.is_cinnamon_theme(theme_path)) {
                    cinnamon_theme_names.push(theme_name);
                }
                if (this.is_win_border_theme(theme_path)) {
                    win_border_theme_names.push(theme_name);
                }
            }
        }
        this.add_to_map(gtk_theme_names, this.gtk_themes);
        this.add_to_map(cinnamon_theme_names, this.cinnamon_themes);
        this.add_to_map(win_border_theme_names, this.window_border_themes);

        if (parent == LOCAL_THEMES_DIR) {
            let system_themes_dir = Gio.File.new_for_path(SYSTEM_THEMES_DIR);
            FileUtils.listDirAsync(system_themes_dir, Lang.bind(this, this.collect_system_themes));
        } else {
            this.settings.setOptions("light_win_border_theme", this.window_border_themes);
            this.settings.setOptions("dark_win_border_theme", this.window_border_themes);

            this.settings.setOptions("light_gtk_theme", this.gtk_themes);
            this.settings.setOptions("dark_gtk_theme", this.gtk_themes);

            this.settings.setOptions("light_cinnamon_theme", this.cinnamon_themes);
            this.settings.setOptions("dark_cinnamon_theme", this.cinnamon_themes);
        }
    },

    collect_icons: function (parent, dir_entry) {
        let icon_names = [];
        for (let i in dir_entry) {
            let icon_name = dir_entry[i].get_name();
            let icon_path = parent + "/" + icon_name;
            if (this.is_dir(icon_path)) {
                icon_names.push(icon_name);
            }
        }
        this.add_to_map(icon_names, this.icons);

        if (parent == LOCAL_ICONS_DIR) {
            let system_icons_dir = Gio.File.new_for_path(SYSTEM_ICONS_DIR);
            FileUtils.listDirAsync(system_icons_dir, Lang.bind(this, this.collect_system_icons));
        } else {
            this.settings.setOptions("light_icon_theme", this.icons);
            this.settings.setOptions("dark_icon_theme", this.icons);
        }
    },

    add_to_map: function (list, map) {
        let sorted = list.sort();
        sorted.forEach(name => {
            map[name] = name;
        });
        return map;
    },

    is_gtk_theme: function (dir) {
        return this.file_exists(dir + "/index.theme");
    },

    is_cinnamon_theme: function (dir) {
        return this.file_exists(dir + "/cinnamon");
    },

    is_win_border_theme: function (dir) {
        return this.file_exists(dir + "/metacity-1");
    },

    file_exists: function (path) {
        return GLib.file_test(path, GLib.FileTest.EXISTS);
    },

    is_dir: function (path) {
        return GLib.file_test(path, GLib.FileTest.IS_DIR);
    }
}

function main(metadata, orientation, panelHeight, instanceId) {
    let myApplet = new MyApplet(orientation, panelHeight, instanceId);
    return myApplet;
}
