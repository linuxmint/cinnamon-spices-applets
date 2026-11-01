
/**
 * Wine Utils Applet
 * License: MIT
 */

const Applet = imports.ui.applet;
const Util = imports.misc.util;
const PopupMenu = imports.ui.popupMenu;
const Gio = imports.gi.Gio;
const St = imports.gi.St;
const ByteArray = imports.byteArray;
const GLib = imports.gi.GLib;
const Settings = imports.ui.settings;
const Gettext = imports.gettext;

const Cinnamon = imports.gi.Cinnamon;

var uuid;
function _(str) {
    let str1 = Gettext.dgettext(uuid, str);
    if (str1 === '') {
        return str;
    }
    return str1;
}
function _util_name(str) {
    return _(str);
}


function MyApplet(orientation,panel_height,instance_id) {
    this._init(orientation,panel_height,instance_id);
}

const DEFAULT_WINE = 'wine';
const DEFAULT_WINECONSOLE = 'wineconsole';
const DEFAULT_WINE_STABLE = 'wine-stable';
const DEFAULT_WINECONSOLE_STABLE = 'wineconsole-stable';
const DEFAULT_WINEPREFIX = '~/.wine';
const DEFAULT_TERMINAL = 'gnome-terminal';

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function (metadata, orientation, panel_height, instance_id) {
        try {
            Applet.IconApplet.prototype._init.call(this, orientation, panel_height, instance_id);

            uuid = metadata["uuid"];

            Gettext.bindtextdomain(uuid, GLib.get_user_data_dir() + "/locale");
            
            // This array is so the translation strings can be found, when normally they only
            // show up in config files.
            let UTIL_NAMES = [
                
                // admin-programs.list
                _("Config"),
                _("Control Panel"),
                _("Files"),
                _("Files (winefile)"),
                _("Registry Editor"),
                _("Task Manager"),
                
                // launchers.list
                _("Bottles"),
                _("Lutris"),
                _("PlayOnLinux"),
                _("Q4Wine")
            ];

            this._path = imports.ui.appletManager.appletMeta[uuid].path;

            this.set_wine_exec();
            this._prefix = this.expand_path(DEFAULT_WINEPREFIX);

            this.settings = new Settings.AppletSettings(this, uuid, instance_id);

            this.settings.bindProperty(
                Settings.BindingDirection.IN,
                "show-run-command",
                "showRunCommand",
                this.on_setting_changed);
            this.settings.bindProperty(
                Settings.BindingDirection.IN,
                "show-cmd",
                "showCommandPrompt",
                this.on_setting_changed);

            this.settings.bindProperty(
                Settings.BindingDirection.IN,
                "show-terminal",
                "showTerminal",
                this.on_setting_changed);
            this.settings.bindProperty(
                Settings.BindingDirection.IN,
                "show-browse-drive-c",
                "showBrowseDriveC",
                this.on_setting_changed);
            this.settings.bindProperty(
                Settings.BindingDirection.IN,
                "show-browse-home-folder",
                "showBrowseHomeFolder",
                this.on_setting_changed);

    		this.settings.bindProperty(
                Settings.BindingDirection.IN,
                "show-tools-menu",
                "showToolsMenu",
                this.on_setting_changed);
            this.settings.bindProperty(
                Settings.BindingDirection.IN,
                "show-admin-programs-menu",
                "showAdminProgramsMenu",
                this.on_setting_changed);
            this.settings.bindProperty(
                Settings.BindingDirection.IN,
                "show-programs-menu",
                "showProgramsMenu",
                this.on_setting_changed);

            this.settings.bindProperty(
                Settings.BindingDirection.IN,
                "automatically-find-prefixes",
                "automaticallyFindPrefixes",
                this.on_setting_changed);
            this.settings.bindProperty(
                Settings.BindingDirection.IN,
                "prefix-file-list",
                "prefixFileList",
                this.on_setting_changed);

            this.settings.bindProperty(
                Settings.BindingDirection.IN,
                "specify-wine-exec",
                "specifyWineExec",
                this.on_setting_changed);
            this.settings.bindProperty(
                Settings.BindingDirection.IN,
                "wine-exec",
                "wineExec",
                this.on_setting_changed);
            this.settings.bindProperty(
                Settings.BindingDirection.IN,
                "wineconsole-exec",
                "wineconsoleExec",
                this.on_setting_changed);

            this.settings.bindProperty(
                Settings.BindingDirection.IN,
                "icon-style",
                "iconStyle",
                this.on_setting_changed);
            this.settings.bindProperty(
                Settings.BindingDirection.IN,
                "specify-custom-icon",
                "specifyCustomIcon",
                this.on_setting_changed);
            this.settings.bindProperty(
                Settings.BindingDirection.IN,
                "custom-icon",
                "customIcon",
                this.on_setting_changed);

            this.settings.bindProperty(
                Settings.BindingDirection.IN,
                "show-launchers",
                "showLaunchers",
                this.on_setting_changed);
            this.settings.bindProperty(
                Settings.BindingDirection.IN,
                "launchers-style",
                "launchersStyle",
                this.on_setting_changed);
            this.settings.bindProperty(
                Settings.BindingDirection.IN,
                "run-command-prompt-style",
                "runCommandPromptStyle",
                this.on_setting_changed);

            this.settings.bindProperty(
                Settings.BindingDirection.IN,
                "run-terminal-style",
                "runTerminalStyle",
                this.on_setting_changed);
            this.settings.bindProperty(
                Settings.BindingDirection.IN,
                "browse-drive-c-style",
                "browseDriveCStyle",
                this.on_setting_changed);
            this.settings.bindProperty(
                Settings.BindingDirection.IN,
                "browse-drive-c-icon",
                "browseDriveCIcon",
                this.on_setting_changed);
            this.settings.bindProperty(
                Settings.BindingDirection.IN,
                "browse-home-folder-style",
                "browseHomeFolderStyle",
                this.on_setting_changed);
            this.settings.bindProperty(
                Settings.BindingDirection.IN,
                "browse-home-folder-icon",
                "browseHomeFolderIcon",
                this.on_setting_changed);

            this.settings.bindProperty(
                Settings.BindingDirection.IN,
                "run-terminal-folder",
                "runTerminalFolder",
                this.on_setting_changed);
            this.settings.bindProperty(
                Settings.BindingDirection.IN,
                "specify-terminal-exec",
                "specifyTerminalExec",
                this.on_setting_changed);
            this.settings.bindProperty(
                Settings.BindingDirection.IN,
                "terminal-exec",
                "terminalExec",
                this.on_setting_changed);


            this._flatpak_available = false;
            if (GLib.find_program_in_path("flatpak")) {
                this._flatpak_available = true;
            }
            this._flatpak_installed = {};
            
            this.set_applet_icon_name(this.get_icon_for_panel());
            this.set_applet_tooltip(_("Wine Utils"));

            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this._orientation = orientation;
            this.menu = new Applet.AppletPopupMenu(this, this._orientation);
            this.menuManager.addMenu(this.menu);

            this.launcher_icon_menu = null;
            this.launcher_icon_menu_list = null;

            this.launcher_desktop_file = {};
            let admin_programs_file = 'admin-programs.list';
            let launchers_file = 'launchers.list';
            let launchers_desktop_file = 'launchers-desktop.list';
            let termargs_file = 'termargs.list';
            this.load_files([
                        this.script_path(admin_programs_file),
                        this.script_path(launchers_file),
                        this.script_path(launchers_desktop_file),
                        this.script_path(termargs_file)],
                (text) => {
                    try {
                        this.read_admin_programs_file(text[0]);
                        this.read_launchers_file(text[1]);
                        this.read_launchers_desktop_file(text[2]);
                        this.read_termargs_file(text[3]);
                    } catch (e) {
                        global.log('ERROR: ' + e.toString());
                    }
                    this.update_flatpak_list(this.update_launcher_list_rebuild_menu.bind(this));
                });
        } catch (e) {
            global.log('ERROR: ' + e.toString());
        }
    },

    read_admin_programs_file: function (text) {
        let admin_programs_list = [];
        let lines = this.parse_list(text);
        for (let i = 0; i < lines.length; ++i) {
            let [ret_0, ret_1] = lines[i];
            let arr = ret_1.split(/\s+/);
            let iconname = '';
            if (ret_0 === '') {
                if (arr.length > 1) {
                    ret_0 = arr[1];
                } else {
                    ret_0 = arr[0];
                }
            } else {
                [ret_0, iconname] = this.parse_icon(ret_0);
            }
            
            let ico = iconname;
            admin_programs_list.push([_util_name(ret_0), arr, ico]);
        }
        this.admin_programs_list = admin_programs_list;
    },

    read_launchers_file: function (text) {
        let launcher_list = [];
        let lines = this.parse_list(text);
        for (let i = 0; i < lines.length; ++i) {
            let [ret_0, ret_1] = lines[i];
            let arr_0 = ret_1.split(/\s+/);
            if (ret_0 === '') {
                ret_0 = arr_0[0];
            }
            let arr = [];
            let arr_1 = [];
            for (let j = 0; j < arr_0.length; ++j) {
                if (arr_0[j] === ';;') {
                    if ((arr_1.length > 0) && (arr_1[0].length > 0)) {
                        arr.push(arr_1);
                    }
                    arr_1 = [];
                    continue;
                }
                arr_1.push(arr_0[j]);
            }
            if ((arr_1.length > 0) && (arr_1[0].length > 0)) {
                arr.push(arr_1);
            }
            launcher_list.push([ret_0, _util_name(ret_0), arr]);
        }

        // Flatpaks
        let launcher_flatpak = {};
        for (let i = 0; i < lines.length; ++i) {
            let launcher_paths = launcher_list[i][2];
            let name = launcher_list[i][0];
            let found = false;
            for (let j = 0; j < launcher_paths.length; ++j) {
                let arg_0 = launcher_paths[j][0];
                if (arg_0.indexOf(':') > 0) {
                    let arg_ = arg_0.split(':');
                    if (arg_[0] === 'flatpak') {
                        launcher_flatpak[name] = arg_[1];
                        break;
                    }
                    continue;
                }
            }
        }

        this.launcher_list = launcher_list;
        this.launcher_flatpak = launcher_flatpak;
    },

    read_launchers_desktop_file: function (text) {
        let launcher_desktop_file = {};
        let lines = this.parse_list(text);
        for (let i = 0; i < lines.length; ++i) {
            let [ret_0, ret_1] = lines[i];
            let arr_0 = ret_1.split(/\s+/);
            if (ret_0 === '') {
                ret_0 = arr_0[0];
            }
            let arr = [];
            for (let j = 0; j < arr_0.length; ++j) {
                arr.push(arr_0[j]);
            }
            launcher_desktop_file[ret_0] = arr;
        }
        this.launcher_desktop_file = launcher_desktop_file;
    },

    read_termargs_file: function (text) {
        let termargs_file = {};
        let lines = this.parse_list(text);
        for (let i = 0; i < lines.length; ++i) {
            let [ret_0, ret_1] = lines[i];
            termargs_file[ret_0] = ret_1.split(/\s+/);
        }
        this.termargs_file = termargs_file;
    },

    remove_trailing_slash: function (dir) {
        while (dir.substr(-1) === '/') {
            dir = dir.substr(0, dir.length-1);
        }
        return dir;
    },

    expand_path: function (a) {
        let char1 = a.substr(0,1);
        if ((char1 === '~') && (a.substr(1,1) === '/')) {
            // A file path where the squiggle will be substituted with
            // the home directory.
            let dir = this.remove_trailing_slash(GLib.get_home_dir());
            a = dir + a.substr(1);
            char1 = a.substr(0,1);
        }
        if (char1 !== '/') {
            // A file path probably relative from the home directory.
            let dir = this.remove_trailing_slash(GLib.get_home_dir());
            a = dir + '/' + a;
        }
        return this.remove_trailing_slash(a);
    },

    parse_list: function (text) {
        let list = [];
        let lines = text.split('\n');
        for (let i = 0; i < lines.length; ++i) {
            let a = lines[i].trim();
            if (a === '') {
                continue;
            }
            if (a.substr(0,1) !== '#') {
                while (a.endsWith('\\')) {
                    ++i;
                    a = a.substr(0, a.length-1) + lines[i];
                    a = a.trim();
                }
                let ret = a.match(/^([^:]+?)(:(.+))?$/);
                if (typeof ret[3] === 'undefined') {
                    list.push(['', ret[1]]);
                } else {
                    list.push([ret[1].trim(), ret[3].trim()]);
                }
            }
        }
        return list;
    },

    parse_icon: function (name) {
        let arr = name.match(/^(.+)\s+\(icon;([^()]+)\)\s*$/);
        if ((arr !== null) && (arr.length > 2)) {
            return [arr[1].trim(), arr[2].trim()];
        } else {
            return [name, ''];
        }
    },

    rebuild_menu: function () {
        this.prefix_file_exists(
            // Rebuild menu after
            (has_prefix_file) => {
                this.menu.removeAll();
                if (this.launcher_icon_menu !== null) {
                    this.launcher_icon_menu_list.remove_all_children();
                    this.launcher_icon_menu.remove_all_children();
                    this.launcher_icon_menu_list = null;
                }
                
                if ((this.showLaunchers) &&
                        ((this.launchersStyle === 'both') ||
                        (this.launchersStyle === 'icons')))
                {
                    this.add_icon_list();
                    let have_launchers = false;
                    for (let i = 0; i < this.launcher_list.length; ++i) {
                        if (this._found_launchers[i] !== false) {
                            have_launchers = true;
                        }
                    }
                    if (have_launchers === true) {
                        this.rebuild_menu_launcher_icons();
                    }
                }

                if ((this.showCommandPrompt) &&
                        ((this.runCommandPromptStyle === 'icon') ||
                        (this.runCommandPromptStyle === 'both')))
                {
                    this.add_icon_list();
                    this.icon_for_console();
                }

                if ((this.showTerminal) &&
                        ((this.runTerminalStyle === 'icon') ||
                        (this.runTerminalStyle === 'both')))
                {
                    this.add_icon_list();
                    this.icon_for_terminal();
                }
                
                if ((this.showBrowseDriveC) &&
                        ((this.browseDriveCStyle === 'icon') ||
                        (this.browseDriveCStyle === 'both')))
                {
                    this.add_icon_list();
                    this.icon_for_browse_drive_c();
                }
                
                if ((this.showBrowseHomeFolder) &&
                        ((this.browseHomeFolderStyle === 'icon') ||
                        (this.browseHomeFolderStyle === 'both')))
                {
                    this.add_icon_list();
                    this.icon_for_browse_home_folder();
                }
                
                if ((this.showLaunchers) &&
                        ((this.launchersStyle === 'both') ||
                        (this.launchersStyle === 'label')))
                {
                    let have_launchers = this.rebuild_menu_launchers_labels();
                    if (have_launchers) {
                        this.menu_separator();
                    }
                }
                
                if (has_prefix_file) {
                    this.menu_prefixes = this.menu_tools(_('Prefixes'), []);
                    this.menu_separator();
                } else {
                    this.menu_prefixes = null;
                }
                
                if (this.showRunCommand) {
                    this.menu_new_item(
                        this,
                        _("Run Command..."),
                        'none-symbolic',
                        this.run_command.bind(this));
                }
                
                if ((this.showCommandPrompt) &&
                        ((this.runCommandPromptStyle === 'label') ||
                        (this.runCommandPromptStyle === 'both')))
                {
                    this.menu_new_item(
                        this,
                        _("Command Prompt"),
                        'wine-cmd',
                        this.use_cmd.bind(this));
                }

                if ((this.showTerminal) &&
                        ((this.runTerminalStyle === 'label') ||
                        (this.runTerminalStyle === 'both'))) {
                    this.menu_new_item(
                        this,
                        _("Terminal"),
                        'terminal',
                        this.use_terminal.bind(this));
                }

                if ((this.showBrowseDriveC) &&
                        ((this.browseDriveCStyle === 'label') ||
                        (this.browseDriveCStyle === 'both'))) {
                    this.menu_new_item(
                        this,
                        _("Drive C"),
                        this.icon_name_drive_c(),
                        this.browse.bind(this));
                }

                if ((this.showBrowseHomeFolder) &&
                        ((this.browseHomeFolderStyle === 'label') ||
                        (this.browseHomeFolderStyle === 'both'))) {
                    this.menu_new_item(
                        this,
                        _("Home Folder"),
                        this.icon_name_home_folder(),
                        this.browse_user_dir.bind(this));
                }

                if (this.showToolsMenu) {
                    this.menu_tools(_('Tools'), [
                        [_('Edit Colors'), this.edit_colors.bind(this)],
                        [_('Customize Fonts'), this.customize_fonts.bind(this)],
                        [_('Map Drive'), this.map_drive.bind(this)]
                    ]);
                }

                if (this.showAdminProgramsMenu) {
                    this.menu_tools(_('Configuration'), this.menu_to_binds(
                        this.admin_programs_list));
                }
                if (this.showProgramsMenu) {
                    this.menu_programs = this.menu_tools(_('Programs'), []);
                } else {
                    this.menu_programs = null;
                }
            });
    },

    remove_from_icon_list: function () {
        if (this.launcher_icon_menu_list !== null) {
            this.launcher_icon_menu_list.remove_all_children();
        }
    },

    add_icon_list: function () {
        if (this.launcher_icon_menu_list === null) {
            if (this.launcher_icon_menu === null) {
                this.launcher_icon_menu = new St.BoxLayout({
                    vertical: true
                });
                this.menu.addActor(this.launcher_icon_menu);
            }
            let icon_menu = this.create_launcher_icon_menu();
            this.launcher_icon_menu.add_actor(icon_menu);
        }
    },

    rebuild_menu_launchers_labels: function () {
        let have_launchers = false;
        for (let i = 0; i < this.launcher_list.length; ++i) {
            if (this._found_launchers[i] !== false) {
                let program_label = this.launcher_list[i][1];
                let program_to_run = this._found_launchers[i];
                this.menu_new_item(
                    this,
                    program_label,
                    'none',
                    () => {
                        this.run_launcher(program_to_run);
                    });
                have_launchers = true;
            }
        }
        return have_launchers;
    },

    create_launcher_icon_menu: function () {
        let icon_size = 32;
        let boxbook = new St.ScrollView({
            style:
                'padding-left: 20px;'+
                'padding-right: 20px;'+
                'max-width:400px;' ,
            hscrollbar_policy: St.PolicyType.AUTOMATIC,
            vscrollbar_policy: St.PolicyType.NEVER,
            height: icon_size + 50
        });
        boxbook.set_auto_scrolling(true);

        this.launcher_icon_menu_list = new St.BoxLayout({
            style:
                'padding:3px;'
        });
        boxbook.add_actor(this.launcher_icon_menu_list);
        
        return boxbook;
    },

    rebuild_menu_launcher_icons: function () {
        let have_launchers = false;
        let icon_margin = 10;
        let icon_size = 32;

        let appSys = Cinnamon.AppSystem.get_default();
        
        for (let i = 0; i < this.launcher_list.length; ++i) {
            if (this._found_launchers[i] !== false) {
                let program_name = this.launcher_list[i][0];
                let program_label = this.launcher_list[i][1];
                let program_to_run = this._found_launchers[i];

                let iconm = null;
                if (this.launcher_desktop_file.hasOwnProperty(program_name)) {
                    let name = this.launcher_desktop_file[program_name];
                    let app = appSys.lookup_app(name[0]);
                    if (app !== null) {
                        if (app.create_icon_texture) {
                            iconm = app.create_icon_texture(icon_size);
                        } else {
                            iconm = St.TextureCache.get_default().load_gicon(null, app.get_icon(), icon_size);
                        }
                    }
                }
                if ((iconm === null) && (this.launcher_flatpak.hasOwnProperty(program_name))) {
                    let app = appSys.lookup_flatpak_app_id(this.launcher_flatpak[program_name]);
                    if (app !== null) {
                        if (app.create_icon_texture) {
                            iconm = app.create_icon_texture(icon_size);
                        } else {
                            iconm = St.TextureCache.get_default().load_gicon(null, app.get_icon(), icon_size);
                        }
                    }
                }
                if (iconm === null) {
                    iconm = St.TextureCache.get_default().load_icon_name(null, "application-x-executable", St.IconType.FULLCOLOR, icon_size);
                }

                let btn1 = this.new_icon(icon_size, icon_margin, iconm);
                
                btn1.connect('activate', () => {
                    this.run_launcher(program_to_run);
                    this.menu.toggle();
                });
                this.launcher_icon_menu_list.add_child(btn1.actor);

                have_launchers = true;
            }
        }
        if (have_launchers === false) {
            return false;
        }
        return true;
    },

    run_launcher: function (program_to_run) {
        if (program_to_run[0].indexOf(':') > 0) {
            let arg_ = program_to_run[0].split(':');
            if (arg_[0] === 'flatpak') {
                Util.spawn([
                    "flatpak",
                    "run",
                    arg_[1]
                    ]);
            }
        } else {
            Util.spawn(program_to_run);
        }
    },

    icon_for_console: function () {
        let program_label = _("Command Prompt");
        let path = Gio.file_new_for_path(this._path + "/icons/wine-cmd.svg");
        let btn1 = this.icon_using_icon_path(program_label, path);
        btn1.connect('activate', () => {
            this.use_cmd();
            this.menu.toggle();
        });
    },

    icon_for_terminal: function () {
        let program_label = _("Terminal");
        let btn1 = this.icon_using_icon_name(program_label, "terminal");
        btn1.connect('activate', () => {
            this.use_terminal();
            this.menu.toggle();
        });
    },

    icon_for_browse_drive_c: function () {
        let program_label = _("Drive C");
        let btn1 = this.icon_using_icon_name(program_label, this.icon_name_drive_c());
        btn1.connect('activate', () => {
            this.browse();
            this.menu.toggle();
        });
    },

    icon_for_browse_home_folder: function () {
        let program_label = _("Home Folder");
        let btn1 = this.icon_using_icon_name(program_label, this.icon_name_home_folder());
        btn1.connect('activate', () => {
            this.browse_user_dir();
            this.menu.toggle();
        });
    },

    icon_name_drive_c: function () {
        let name = 'folder';
        if ((typeof this.browseDriveCIcon === 'string') && (this.browseDriveCIcon.length > 0)) {
            name = this.browseDriveCIcon;
        }
        return name;
    },
    icon_name_home_folder: function () {
        let name = 'folder';
        if ((typeof this.browseHomeFolderIcon === 'string') && (this.browseHomeFolderIcon.length > 0)) {
            name = this.browseHomeFolderIcon;
        }
        return name;
    },

    icon_using_icon_path: function (program_label, path) {
        let icon_margin = 10;
        let icon_size = 32;

        let iconm0 = new Gio.FileIcon({file: path});
        let iconm = St.TextureCache.get_default().load_gicon(null, iconm0, icon_size);
        let btn1 = this.new_icon(icon_size, icon_margin, iconm);

        this.launcher_icon_menu_list.add_child(btn1.actor);
        return btn1;
    },

    icon_using_icon_name: function (program_label, name) {
        let icon_margin = 10;
        let icon_size = 32;

        let iconm = St.TextureCache.get_default().load_icon_name(null, name, St.IconType.FULLCOLOR, icon_size);
        let btn1 = this.new_icon(icon_size, icon_margin, iconm);

        this.launcher_icon_menu_list.add_child(btn1.actor);
        return btn1;
    },

    new_icon: function (icon_size, icon_margin, iconm) {
        let btn1 = new PopupMenu.PopupBaseMenuItem({});
        btn1.actor.set_style(
            'padding:0px;' +
            '' // btn1.actor.get_style()
        );
        btn1.box = new St.BoxLayout({
            width: icon_size+(icon_margin*2),
            height: icon_size+(icon_margin*2)
        });
        btn1.box.set_style(
            "padding:" + icon_margin + "px;"
        );
                btn1.box.add_actor(iconm);
                btn1.addActor(btn1.box);
        return btn1;
    },


    prefix_file_exists: function (callback) {
        const after_query_info = function (file, ready) {
            try {
                let info = file.query_info_finish(ready);
                if ((info !== null) && (info.get_attribute_boolean("access::can-read"))) {
                    callback(true);
                } else {
                    callback(false);
                }
            } catch (e) {
                callback(false);
            }
        };
        if ((typeof this.prefixFileList === 'string') && (this.prefixFileList !== '')) {
            let prefixfilepath = Gio.file_new_for_path(this.prefix_file_list_path());
            prefixfilepath.query_info_async("access::can-read", Gio.FileQueryInfoFlags.NONE, 300, null, after_query_info);
        } else {
            callback(false);
        }
    },

    script_path: function (name) {
        return this._path + "/scripts/" + name;
    },

    load_files: function (list, callback) {
        function load_file (applet, list, results) {
            if (list.length === 0) {
                callback(results);
                return;
            }
            let filename = list.shift();
            const after_load_contents = function (file, ready) {
                let text = null;
                try {
                    let [loaded, bytes, unused] = file.load_contents_finish(ready);
                    if (loaded) {
                        text = ByteArray.toString(bytes);
                    }
                    GLib.free(bytes);
                } catch (e) {
                    global.log("ERROR loading " + filename + ": " + e.toString());
                }
                results.push(text);
                load_file(applet, list, results);
            };
            Gio.file_new_for_path(filename).load_contents_async(null, after_load_contents.bind(applet));
        }

        load_file(this, list, []);
    },

    update_programs_list: function () {
        if (this.showProgramsMenu === true) {
            try {
                Util.spawn_async([
                            this.script_path('list-programs.pl'),
                            this._prefix,
                            this._wine],
                // After getting programs list
                (vals) => {
                    let prog_l = [];
                    let vals_l = vals.toString().split("\n");
                    for (let i = 0; i < vals_l.length; ++i) {
                        let prog = vals_l[i];
                        prog = prog.trim();
                        if (prog.length > 0) {
                            if (prog[0] === "\\") {
                                prog_l.push([prog.substr(1)]);
                            } else {
                                let w = prog.match(/^<([^<>]+)> <([^<>]+)>/);
                                if (w.length > 1) {
                                    let name = w[1];
                                    let pname = w[2];
                                    let ico = 'none-symbolic';
                                    if (pname.match(/\.url$/i)) {
                                        ico = 'wine-web-link';
                                    }
                                    const program_clicked = (event) => {
                                        Util.spawn([
                                            this.script_path('run-wine-start.sh'),
                                            this._prefix,
                                            this._wine, 
                                            pname]);
                                    };
                                    prog_l.push([name,
                                        program_clicked,
                                        ico]);
                                }
                            }
                        }
                    }
                    this.menu_tools_update(this.menu_programs, prog_l);
                });
            } catch (e) {
                global.log('ERROR: ' + e.toString());
            }
        }
    },

    menu_tools_update: function (menuItem, la) {
        let menuItem_1 = menuItem;
        menuItem.menu.removeAll();
        for (let i = 0; i < la.length; ++i) {
            let name_sm = la[i][0];
            if (la[i].length === 1) {
                if (name_sm === '-') {
                    menuItem_1 = new PopupMenu.PopupSeparatorMenuItem();
                    menuItem.menu.addMenuItem(menuItem_1);
                    menuItem_1 = menuItem;
                } else {
                    menuItem_1 = new PopupMenu.PopupSubMenuMenuItem(name_sm, true, {});
                    menuItem_1.label.text = name_sm;
                    menuItem.menu.addMenuItem(menuItem_1);
                }
            } else {
                let ico = 'none-symbolic';
                if ((la[i].length > 2) && (la[i][2] !== '')) {
                    ico = la[i][2];
                }
                this.menu_new_item(menuItem_1, name_sm, ico, la[i][1]);
            }
        }
    },

    get_prefix_list_automatically: function (callback) {
        if (this.automaticallyFindPrefixes === true) {
            try {
                Util.spawn_async([this.script_path('auto-prefix.py')],
                    (vals) => {
                        let prefix_names = {};
                        let prefix_l = [];
                        let vals_l = vals.toString().split("\n");
                        for (let i = 0; i < vals_l.length; ++i) {
                            let prefix = vals_l[i];
                            prefix = prefix.trim();
                            if (prefix.length > 0) {
                                let w = prefix.match(/^<([^<>]+)> <([^<>]+)>/);
                                if (w.length > 1) {
                                    let name = w[1];
                                    let pname = w[2];
                                    prefix_names[name] = pname;
                                    prefix_l.push(name)
                                }
                            }
                        }
                        callback(prefix_names, prefix_l);
                    });
            } catch (e) {
                global.log('ERROR: ' + e.toString());
                callback({}, []);
            }
        } else {
            callback({}, []);
        }
    },

    update_prefix_list: function () {
        this.get_prefix_list_automatically(
            // After getting prefixes
            (prefix_names, prefix_list) => {
                if ((typeof this.prefixFileList === 'string') && (this.prefixFileList !== '')) {
                    let prefixfilepath = this.prefix_file_list_path();
                    let prefixfile = Gio.file_new_for_path(prefixfilepath);
                    if (this.menu_prefixes !== null) {
                        try {
                            this.load_files([prefixfilepath],
                                // After loading prefixes
                                (text) => {
                                    let prefix_specified = {};
                                    for (let i = 0; i < prefix_list.length; ++ i) {
                                        prefix_specified[prefix_list[i]] = false;
                                    }
                                    let lines = this.parse_list(text[0]);
                                    let default_prefix = this.expand_path(DEFAULT_WINEPREFIX);
                                    let default_found = false;
                                    for (let i = 0; i < lines.length; ++i) {
                                        let [ret_0, ret_1] = lines[i];
                                        if (ret_0 === '') {
                                            let expanded = this.expand_path(ret_1);
                                            if (prefix_names.hasOwnProperty(expanded)) {
                                                ret_0 = prefix_names[expanded];
                                            } else {
                                                ret_0 = ret_1;
                                            }
                                        }
                                        ret_1 = this.expand_path(ret_1);
                                        prefix_specified[ret_1] = true;
                                        if (ret_1 === default_prefix) {
                                            default_found = true;
                                        }
                                        lines[i] = [ret_0, ret_1];
                                    }
                                    
                                    if (!default_found) {
                                        prefix_specified[default_prefix] = true;
                                        lines.unshift([_('Default'), default_prefix]);
                                    }
                                    for (let i = 0; i < prefix_list.length; ++i) {
                                        let prefix = prefix_list[i];
                                        if (prefix_specified.hasOwnProperty(prefix) && (!prefix_specified[prefix])) {
                                            lines.push([prefix_names[prefix], prefix]);
                                            prefix_specified[prefix] = true;
                                        }
                                    }
                                    
                                    let prefix_l = [];
                                    for (let i = 0; i < lines.length; ++i) {
                                        let [ret_0, ret_1] = lines[i];
                                        let iconname = '';
                                        [ret_0, iconname] = this.parse_icon(ret_0);
                                        let ico = '';
                                        if (this._prefix === ret_1) {
                                            ico = ':1:';
                                        } else {
                                            ico = ':0:';
                                        }
                                        ico += iconname;
                                        const prefix_clicked = (event) => {
                                            this._prefix = ret_1;
                                        };
                                        prefix_l.push([ret_0,
                                            prefix_clicked,
                                            ico]);
                                    }
                                    this.menu_tools_update(this.menu_prefixes, prefix_l);
                                });
                        } catch (e) {
                            global.log('ERROR: ' + e.toString());
                        }
                    }
                }
            });
    },

    prefix_file_list_path: function () {
        return decodeURIComponent(this.prefixFileList.replace(/^file:\/\//i, ''));
    },

    menu_separator: function () {
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
    },
    
    menu_new_item: function (menuItem_1, name, iconstr, callback) {
        if (iconstr.substr(0, 1) === ':') {
            let ornament = iconstr.substr(1,1);
            if (ornament === '1') {
                iconstr = 'selected-prefix-symbolic';
            } else if (ornament === '0') {
                iconstr = 'none-symbolic';
            }
        }
        
        let menuItem = new PopupMenu.PopupIconMenuItem(name, iconstr, St.IconType.FULLCOLOR, {});
        menuItem_1.menu.addMenuItem(menuItem);
        menuItem.connect("activate", callback.bind(this));
    },

    menu_tools: function (name, la) {
        let menuItem = new PopupMenu.PopupSubMenuMenuItem(name, true, {});
        menuItem.label.text = name;
        this.menu_tools_update(menuItem, la);
        this.menu.addMenuItem(menuItem);
        return menuItem;
    },

    menu_to_binds: function (la) {
        for (let i = 0; i < la.length; ++i) {
            if ((la[i].length > 1) && (typeof la[i][1] === 'object')) {
                let to_run_ = la[i][1];
                la[i][1] = (event) => {
                    let to_run = to_run_.slice();
                    if (to_run[0] === '%') {
                        /* Replace the percent sign with run-wine.sh */
                        to_run.shift();
                        to_run.unshift(this._wine);
                        to_run.unshift(this._prefix);
                        to_run.unshift(this.script_path('run-wine.sh'));
                    }
                    Util.spawn(to_run);
                };
            }
        }
        return la;
    },

    run_command: function () {
        Util.spawn([
            this.script_path('run-command.sh'),
            this._prefix,
            this._wine,
            this._wineconsole]);
    },

    use_cmd: function() {
        Util.spawn([
            this.script_path('use-cmd.sh'),
            this._prefix,
            this._wineconsole]);
    },

    use_terminal: function() {
        if (this.runTerminalFolder === 'home') {
            this.prefix_home_folder((folder) => {
                this.use_terminal_folder(folder);
            });
        } else {
            this.use_terminal_folder(this.prefix_drive_c());
        }
    },

    use_terminal_folder: function(folder) {
        let terminal_cmd = DEFAULT_TERMINAL;
        if (this.specifyTerminalExec === true) {
            if ((typeof this.terminalExec === 'string') && (this.terminalExec !== '')) {
                terminal_cmd = this.terminalExec;
            }
        }
        let args = [terminal_cmd];
        if (this.termargs_file.hasOwnProperty(terminal_cmd)) {
            let termargs = this.termargs_file[terminal_cmd];
            for (let i = 0; i < termargs.length; ++ i) {
                let val = termargs[i];
                val = val.replace('%W', folder);
                args.push(val);
            }
        }
        args.unshift(folder);
        args.unshift(this.script_path('start-term.sh'));
        Util.spawn(args);
    },

    browse: function() {
        let folder = this.prefix_drive_c();
        Util.spawn([
            'xdg-open',
            folder]);
    },

    browse_user_dir: function() {
        this.prefix_home_folder(function (folder) {
            Util.spawn([
                'xdg-open',
                folder]);
        });
    },

    prefix_drive_c: function () {
        return this._prefix + '/drive_c/';
    },

    prefix_home_folder: function (callback) {
        Util.spawn_async([
                    this.script_path('user_dir.sh'),
                    this._prefix,
                    this._wine],
            (val) => {
                val = val.toString().replaceAll("\r","").trim();
                val = val.substr(0,1).toLowerCase() + val.substr(1);
                val = val.replaceAll(/\\+/g,'/');
                callback(this._prefix + "/dosdevices/" + val);
            });
    },

    // Edit Colors
    edit_colors: function () {
        Util.spawn([
            this.script_path('theme-utils/color_edit.py'),
            this._prefix,
            this._wine]);
    },
    // Customize Fonts
    customize_fonts: function () {
        Util.spawn([
            this.script_path('theme-utils/customize_font.py'),
            this._prefix,
            this._wine]);
    },
    // Map Drive
    map_drive: function () {
        Util.spawn([
            this.script_path('map-drive.py'),
            'map-drive',
            this._prefix,
            this._wine]);
    },
    

    update_flatpak_list: function (callback) {
        if (this._flatpak_available) {
            try {
                Util.spawn_async(["flatpak", "list"],
                    (vals) => {
                        let lines = vals.split("\n");
                        let flatpak_installed = {};
                        for (let i = 0; i < lines.length; ++i) {
                            let flat = lines[i].split("\t");
                            if (flat.length > 1) {
                                flatpak_installed[flat[1]] = true;
                            }
                        }
                        this._flatpak_installed = flatpak_installed;
                        callback();
                    });
            } catch (e) {
                global.log("ERROR: " + e.toString());
                this._flatpak_installed = {};
                callback();
            }
        } else {
            this._flatpak_installed = {};
            callback();
        }
        
    },

    update_available_launcher_list: function () {
        let found_launchers = [];
        for (let i = 0; i < this.launcher_list.length; ++i) {
            let launcher_paths = this.launcher_list[i][2];
            let found = false;
            for (let j = 0; j < launcher_paths.length; ++j) {
                let arg_0 = launcher_paths[j][0];
                if (arg_0.indexOf(':') > 0) {
                    let arg_ = arg_0.split(':');
                    if (arg_[0] === 'flatpak') {
                        if (this._flatpak_installed.hasOwnProperty(arg_[1])) {
                            found = launcher_paths[j];
                            break;
                        }
                    }
                    continue;
                }
                if (GLib.find_program_in_path(arg_0)) {
                    found = launcher_paths[j];
                    break;
                }
            }
            found_launchers.push(found);
        }
        this._found_launchers = found_launchers;
    },

    get_icon_for_panel: function () {
        let ico = '';
        if (this.specifyCustomIcon) {
            if ((typeof this.customIcon === 'string') && (this.customIcon.length > 0)) {
                return this.customIcon;
            }
        }

        if ((typeof this.iconStyle === 'string') && (this.iconStyle.length > 0)) {
            ico = this.iconStyle;
        }
        if (ico !== '') {
            ico += '-symbolic';
        }
        return "wine-utils-icon" + ico;
    },


    on_setting_changed: function() {
        this.set_wine_exec();
        this.set_applet_icon_name(this.get_icon_for_panel());
        this.update_flatpak_list(this.update_launcher_list_rebuild_menu.bind(this));
    },

    set_wine_exec: function () {
        let wine_default = DEFAULT_WINE;
        let wineconsole_default = DEFAULT_WINECONSOLE;
        if (GLib.find_program_in_path(DEFAULT_WINE_STABLE)) {
            wine_default = DEFAULT_WINE_STABLE;
        }
        if (GLib.find_program_in_path(DEFAULT_WINECONSOLE_STABLE)) {
            wineconsole_default = DEFAULT_WINECONSOLE_STABLE;
        }
        if (this.specifyWineExec) {
            this._wine =
                ((typeof this.wineExec === 'string') && (this.wineExec !== '')) ?
                    this.wineExec : wine_default;
            this._wineconsole =
                ((typeof this.wineconsoleExec === 'string') && (this.wineconsoleExec !== '')) ?
                    this.wineconsoleExec : wineconsole_default;
        } else {
            this._wine = wine_default;
            this._wineconsole = wineconsole_default;
        }
    },

    update_launcher_list_rebuild_menu: function () {
        this.update_available_launcher_list();
        this.rebuild_menu();
    },

    on_applet_clicked: function () {
        this.update_programs_list();
        this.update_prefix_list();
        this.menu.toggle();
    }
};

function main(metadata,orientation,panel_height,instance_id) {
    return new MyApplet(metadata, orientation,panel_height,instance_id);
}

