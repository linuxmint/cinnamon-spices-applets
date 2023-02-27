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
const Mainloop = imports.mainloop;

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
const POSTPONE_AUTO_MODE_UNTIL = "postpone-auto-until";

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
    this.timer = null;
    this.light_start_time = new Time(6, 0);
    this.dark_start_time = new Time(18, 0);
    this.next_schedule = 0;
    this.is_current_mode_dark = false;
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
        this.settings.bindProperty(Settings.BindingDirection.IN,
            "light_gtk_theme",
            "light_gtk_theme",
            this.on_settings_changed,
            null);
        this.settings.bindProperty(Settings.BindingDirection.IN,
            "dark_gtk_theme",
            "dark_gtk_theme",
            this.on_settings_changed,
            null);
        this.settings.bindProperty(Settings.BindingDirection.IN,
            "light_win_border_theme",
            "light_win_border_theme",
            this.on_settings_changed,
            null);
        this.settings.bindProperty(Settings.BindingDirection.IN,
            "dark_win_border_theme",
            "dark_win_border_theme",
            this.on_settings_changed,
            null);
        this.settings.bindProperty(Settings.BindingDirection.IN,
            "light_cinnamon_theme",
            "light_cinnamon_theme",
            this.on_settings_changed,
            null);
        this.settings.bindProperty(Settings.BindingDirection.IN,
            "dark_cinnamon_theme",
            "dark_cinnamon_theme",
            this.on_settings_changed,
            null);
        this.settings.bindProperty(Settings.BindingDirection.IN,
            "light_icon_theme",
            "light_icon_theme",
            this.on_settings_changed,
            null);
        this.settings.bindProperty(Settings.BindingDirection.IN,
            "dark_icon_theme",
            "dark_icon_theme",
            this.on_settings_changed,
            null);
        this.settings.bindProperty(Settings.BindingDirection.IN,
            "enable_light_background_switch",
            "enable_light_background_switch",
            this.on_settings_changed,
            null);
        this.settings.bindProperty(Settings.BindingDirection.IN,
            "enable_dark_background_switch",
            "enable_dark_background_switch",
            this.on_settings_changed,
            null);
        this.settings.bindProperty(Settings.BindingDirection.IN,
            "light_background_dir",
            "light_background_dir",
            this.on_settings_changed,
            null);
        this.settings.bindProperty(Settings.BindingDirection.IN,
            "dark_background_dir",
            "dark_background_dir",
            this.on_settings_changed,
            null);
        this.settings.bindProperty(Settings.BindingDirection.IN,
            "enable_auto_mode_switch",
            "enable_auto_mode_switch",
            this.on_settings_changed,
            null);
        this.settings.bind("light_mode_start",
            "_light_mode_start",
            (value) => {
                // For some reason this callback for timechoorser is called on every setting update so this workaround is required.
                if (this.light_start_time.hour != value.h || this.light_start_time.minute != value.m) {
                    this.light_start_time = new Time(value.h, value.m);
                    this.allow_auto_mode_change();
                    this.change_mode_automatically();
                }
            });
        this.settings.bind("dark_mode_start",
            "_dark_mode_start",
            (value) => {
                // For some reason this callback for timechoorser is called on every setting update so this workaround is required.
                if (this.dark_start_time.hour != value.h || this.dark_start_time.minute != value.m) {
                    this.dark_start_time = new Time(value.h, value.m);
                    this.allow_auto_mode_change();
                    this.change_mode_automatically();
                }
            });
        this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL,
            "postpone_auto_mode_until",
            "postpone_auto_mode_until",
            null,
            null);
        this.menu_manager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menu_manager.addMenu(this.menu);

        this.dark_mode_switch = new PopupMenu.PopupSwitchMenuItem(_("Dark Mode"), this.enable_dark_mode);
        this.dark_mode_switch.connect('toggled', Lang.bind(this, this.on_change_theme));
        this.menu.addMenuItem(this.dark_mode_switch);

        // Update the UI
        this.set_dark_mode(this.enable_dark_mode);
        this.refresh_themes();
        if (this.enable_auto_mode_switch) {
            this.change_mode_automatically();
        }
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
        this.enable_light_background_switch = this.settings.getValue("enable_light_background_switch");
        this.enable_dark_background_switch = this.settings.getValue("enable_dark_background_switch");
        this.light_background_dir = this.settings.getValue("light_background_dir");
        this.dark_background_dir = this.settings.getValue("dark_background_dir");
        this.enable_auto_mode_switch = this.settings.getValue("enable_auto_mode_switch");
        this.postpone_auto_mode_until = this.settings.getValue("postpone_auto_mode_until");

        let original_mode = this.is_current_mode_dark;
        let new_mode = this.enable_dark_mode;

        this.allow_auto_mode_change();
        if (this.enable_auto_mode_switch) {
            this.change_mode_automatically();
        }
        if (original_mode != new_mode) {
            this.block_auto_mode_change();
        }
        this.set_dark_mode(new_mode);
    },

    on_change_theme: function (item) {
        // Disable automode until next schedule
        this.block_auto_mode_change();
        this.menu.toggle();
        this.set_dark_mode(item.state);
    },

    set_dark_mode: function (dark_mode) {
        let win_border_theme = null;
        let gtk_theme = null;
        let cinnamon_theme = null;
        let icon_theme = null;
        // Save the current mode for later reference in `on_settings_changed`
        this.is_current_mode_dark = dark_mode;
        // Change the setting to reflect the changes in UI
        this.enable_dark_mode = dark_mode;
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
        // Change the wallpaper at last
        if (dark_mode && this.enable_dark_background_switch) {
            this.set_random_dark_wallpaper();
        } else if (!dark_mode && this.enable_light_background_switch) {
            this.set_random_light_wallpaper();
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
        let system_themes_dir = Gio.File.new_for_path(SYSTEM_THEMES_DIR);
        let local_icons_dir = Gio.File.new_for_path(LOCAL_ICONS_DIR);
        let system_icons_dir = Gio.File.new_for_path(SYSTEM_ICONS_DIR);

        if (local_themes_dir.query_exists(null)) {
            FileUtils.listDirAsync(local_themes_dir, Lang.bind(this, this.collect_local_themes));
        }
        FileUtils.listDirAsync(system_themes_dir, Lang.bind(this, this.collect_system_themes));

        if (local_icons_dir.query_exists(null)) {
            FileUtils.listDirAsync(local_icons_dir, Lang.bind(this, this.collect_local_icons));
        }
        FileUtils.listDirAsync(system_icons_dir, Lang.bind(this, this.collect_system_icons));
    },

    change_mode_automatically: function () {
        if (this.timer != null) {
            Mainloop.source_remove(this.timer);
            this.timer = null;
        }

        if (!this.enable_auto_mode_switch) {
            return;
        }

        let now = this.now();
        let is_dark_mode = true;

        if (this.dark_start_time.is_after(this.light_start_time)) {
            // Light mode comes first
            is_dark_mode = !(now.is_equal_or_after(this.light_start_time) && this.dark_start_time.is_after(now));
        } else {
            // Dark mode comes first
            is_dark_mode = (now.is_equal_or_after(this.dark_start_time) && this.light_start_time.is_after(now));
        }
        if (is_dark_mode) {
            this.next_schedule = this.light_start_time.get_next_schedule();
        } else {
            this.next_schedule = this.dark_start_time.get_next_schedule();
        }

        if (this.is_auto_mode_change_allowed()) {
            // Do not change the theme if auto switch is postponed until the next schedule
            this.allow_auto_mode_change();
            this.set_dark_mode(is_dark_mode);
        }
        this.timer = Mainloop.timeout_add_seconds(this.next_schedule, Lang.bind(this, this.change_mode_automatically));
    },

    is_auto_mode_change_allowed: function () {
        let now_epoch = new Date().valueOf();
        return this.postpone_auto_mode_until == null || this.postpone_auto_mode_until <= now_epoch
    },

    block_auto_mode_change: function () {
        if (this.enable_auto_mode_switch) {
            let now = this.now();
            let next_schedule_epoch = 0;
            if (this.dark_start_time.is_after(this.light_start_time)) {
                // Light mode comes first
                if (this.light_start_time.is_after(now)) {
                    // Next schedule is for light mode today
                    next_schedule_epoch = this.light_start_time.get_next_schedule();
                } else if (this.dark_start_time.is_after(now)) {
                    // Next schedule is for dark mode today
                    next_schedule_epoch = this.dark_start_time.get_next_schedule();
                } else {
                    // Next schedule is for light mode tomorrow
                    next_schedule_epoch = this.light_start_time.get_next_schedule();
                }
            } else {
                // Dark mode comes first
                if (this.dark_start_time.is_after(now)) {
                    // Next schedule is for dark mode
                    next_schedule_epoch = this.dark_start_time.get_next_schedule();
                } else if (this.light_start_time.is_after(now)) {
                    // Next schedule is for light mode
                    next_schedule_epoch = this.light_start_time.get_next_schedule();
                } else {
                    // Next schedule is for dark mode tomorrow
                    next_schedule_epoch = this.dark_start_time.get_next_schedule();
                }
            }

            let postponed_time = new Date();
            postponed_time.setSeconds(postponed_time.getSeconds() + next_schedule_epoch - 60);
            this.postpone_auto_mode_until = postponed_time.valueOf();
        } else {
            this.postpone_auto_mode_until = null;
        }
    },

    allow_auto_mode_change: function () {
        this.postpone_auto_mode_until = -1;
    },

    now: function () {
        let today = new Date();
        return new Time(today.getHours(), today.getMinutes());
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
        
        this.settings.setOptions("light_win_border_theme", Object.assign({}, this.window_border_themes));
        this.settings.setOptions("dark_win_border_theme", Object.assign({}, this.window_border_themes));

        this.settings.setOptions("light_gtk_theme", Object.assign({}, this.gtk_themes));
        this.settings.setOptions("dark_gtk_theme", Object.assign({}, this.gtk_themes));

        this.settings.setOptions("light_cinnamon_theme", Object.assign({}, this.cinnamon_themes));
        this.settings.setOptions("dark_cinnamon_theme", Object.assign({}, this.cinnamon_themes));
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
        
        this.settings.setOptions("light_icon_theme", Object.assign({}, this.icons));
        this.settings.setOptions("dark_icon_theme", Object.assign({}, this.icons));
    },

    set_random_light_wallpaper: function () {
        if (this.light_background_dir != null && this.light_background_dir != "") {
            let absolute_path = decodeURIComponent(this.light_background_dir.replace("file://", ""));
            if (absolute_path != "") {
                let path = Gio.File.new_for_path(absolute_path);
                FileUtils.listDirAsync(path, Lang.bind(this, this.collect_light_pictures));
            }
        }
    },

    set_random_dark_wallpaper: function () {
        if (this.dark_background_dir != null && this.dark_background_dir != "") {
            let absolute_path = decodeURIComponent(this.dark_background_dir.replace("file://", ""));
            if (absolute_path != "") {
                let path = Gio.File.new_for_path(absolute_path);
                FileUtils.listDirAsync(path, Lang.bind(this, this.collect_dark_pictures));
            }
        }
    },

    collect_light_pictures: function (files) {
        this.set_random_wallpaper(this.light_background_dir, files);
    },

    collect_dark_pictures: function (files) {
        this.set_random_wallpaper(this.dark_background_dir, files);
    },

    set_random_wallpaper: function (parent, files) {
        let pictures = [];
        for (let i in files) {
            let file = files[i].get_name();
            let file_name = file.toLowerCase();
            if (file_name.endsWith(".jpg") || file_name.endsWith(".jpeg") || file_name.endsWith(".png")) {
                pictures.push(file);
            }
        }
        if (pictures.length > 0) {
            let random_picture = pictures[Math.floor(Math.random() * pictures.length)];
            if (parent.length > 1 && !parent.endsWith("/")) {
                parent = parent + "/";
            }
            let wallpaper = parent + random_picture;
            Util.spawnCommandLine('gsettings set org.cinnamon.desktop.background picture-uri "' + wallpaper + '"');
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

class Time {
    constructor(hour, minute) {
        this.hour = hour;
        this.minute = minute;
        this.epoch = hour * 60 * 60 + minute * 60;
    }

    is_after(time) {
        return time.epoch < this.epoch;
    }

    is_equal_or_after(time) {
        return time.epoch <= this.epoch;
    }

    get_next_schedule() {
        let today = new Date();
        let now = today.getHours() * 60 * 60 + today.getMinutes() * 60;
        if (this.epoch == 0) {
            // Next day
            return 24 * 60 * 60 - now;
        } else if (now < this.epoch) {
            // Next epoch
            return this.epoch - now;
        } else {
            // Next day epoch
            return this.epoch + 24 * 60 * 60 - now;
        }
    }
}

function main(metadata, orientation, panelHeight, instanceId) {
    let myApplet = new MyApplet(orientation, panelHeight, instanceId);
    return myApplet;
}
