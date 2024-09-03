
/**
 * Wine Utils Applet
 * License: MIT
 */

const Applet = imports.ui.applet;
const Util = imports.misc.util;
const PopupMenu = imports.ui.popupMenu;
const Lang = imports.lang;
const Gio = imports.gi.Gio;
const ByteArray = imports.byteArray;
const GLib = imports.gi.GLib;
const Settings = imports.ui.settings;
const Gettext = imports.gettext;

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
const DEFAULT_WINEPREFIX = '~/.wine';

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function (metadata, orientation, panel_height, instance_id) {
        try {
            Applet.IconApplet.prototype._init.call(this, orientation, panel_height, instance_id);

            uuid = metadata["uuid"];

            Gettext.bindtextdomain(uuid, GLib.get_home_dir() + "/.local/share/locale");
            
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

            this._wine = DEFAULT_WINE;
            this._wineconsole = DEFAULT_WINECONSOLE;
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
                "use-dark-theme-icons",
                "useDarkThemeIcons",
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

            let admin_programs_file = 'admin-programs.list';
            let launchers_file = 'launchers.list';
            this.load_files([
                        this.script_path(admin_programs_file),
                        this.script_path(launchers_file)],
                Lang.bind(this, function (text) {
                    let admin_programs_list = [];
                    let lines = this.parse_list(text[0]);
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
                        if (arr[0] === '%') {
                            /* Replace the percent sign with run-wine.sh */
                            arr.shift();
                            arr.unshift(this._wine);
                            arr.unshift(this._prefix);
                            arr.unshift(this.script_path('run-wine.sh'));
                        }
                        
                        let ico = iconname;
                        admin_programs_list.push([_util_name(ret_0), arr, ico]);
                    }
                    this.admin_programs_list = admin_programs_list;

                    let launcher_list = [];
                    lines = this.parse_list(text[1]);
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
                        launcher_list.push([_util_name(ret_0), arr]);
                    }
                    this.launcher_list = launcher_list;

                    this.update_flatpak_list(
                        Lang.bind(this, function () {
                            this.update_available_launcher_list();
                            this.rebuild_menu();
                        }));
                }
            ));
        } catch (e) {
            global.log('ERROR: ' + e.toString());
        }
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
                if (typeof ret[3] == 'undefined') {
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
        let have_launchers = false;
        this.menu.removeAll();

        if (this.showLaunchers) {
            for (let i = 0; i < this.launcher_list.length; ++i) {
                if (this._found_launchers[i] !== false) {
                    let program_name = this.launcher_list[i][0];
                    let program_to_run = this._found_launchers[i];
                    this.menu_new_item(
                        this,
                        program_name,
                        'none',
                        Lang.bind(this,
                            function () {
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
                            }));
                    have_launchers = true;
                }
            }
        }

        if (have_launchers) {
            this.menu_separator();
        }
        
        if (this.prefixFileList !== '') {
            this.menu_prefixes = this.menu_tools(_('Prefixes'), []);
            this.menu_separator();
        } else {
            this.menu_prefixes = null;
        }
        
        if (this.showRunCommand) {
            this.menu_new_item(
                this,
                _("Run Command..."),
                'none',
                Lang.bind(this, this.run_command));
        }
        
        if (this.showCommandPrompt) {
            this.menu_new_item(
                this,
                _("Command Prompt"),
                'wine-cmd',
                Lang.bind(this, this.use_cmd));
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
    },

    script_path: function (name) {
        return this._path + "/scripts/" + name;
    },

    load_files: function (list, callback) {
        function load_file (applet, list, results) {
            if (list.length == 0) {
                callback(results);
                return;
            }
            let filename = list.shift();
            Gio.file_new_for_path(filename).
                load_contents_async(null, 
                    Lang.bind(applet, function (file, ready) {
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
                    })
                );
        }

        load_file(this, list, []);
    },

    update_programs_list: function () {
        if (this.showProgramsMenu == true) {
            try {
                Util.spawn_async([
                            this.script_path('list-programs.pl'),
                            this._prefix,
                            this._wine],
                Lang.bind(this, function (vals) {
                    let prog_l = [];
                    let vals_l = vals.toString().split("\n");
                    for (let i = 0; i < vals_l.length; i++) {
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
                                    let ico = 'none';
                                    if (pname.match(/\.url$/i)) {
                                        ico = 'wine-web-link';
                                    }
                                    prog_l.push([name, Lang.bind(this, function (event) {
                                        Util.spawn([
                                            this.script_path('run-wine-start.sh'),
                                            this._prefix,
                                            this._wine, 
                                            pname]);
                                    }), ico]);
                                }
                            }
                        }
                    }
                    this.menu_tools_update(this.menu_programs, prog_l);
                }));
            } catch (e) {
                global.log('ERROR: ' + e.toString());
            }
        }
    },

    menu_tools_update: function (menuItem, la) {
        let menuItem_1 = menuItem;
        menuItem.menu.removeAll();
        for (let i = 0; i < la.length; i++) {
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
                let ico = 'none';
                if ((la[i].length > 2) && (la[i][2] !== '')) {
                    ico = la[i][2];
                }
                this.menu_new_item(menuItem_1, name_sm, ico, la[i][1]);
            }
        }
    },

    update_prefix_list: function () {
        if (this.prefixFileList !== '') {
            try {
                this.load_files([decodeURIComponent(this.prefixFileList.replace(/^file:\/\//i, ''))],
                    Lang.bind(this, function (text) {
                        let lines = this.parse_list(text[0]);
                        let default_prefix = this.expand_path(DEFAULT_WINEPREFIX);
                        let default_found = false;
                        for (let i = 0; i < lines.length; ++i) {
                            let [ret_0, ret_1] = lines[i];
                            if (ret_0 === '') {
                                ret_0 = ret_1;
                            }
                            ret_1 = this.expand_path(ret_1);
                            if (ret_1 === default_prefix) {
                                default_found = true;
                            }
                            lines[i] = [ret_0, ret_1];
                        }
                        
                        if (!default_found) {
                            lines.unshift([_('Default'), default_prefix]);
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
                            prefix_l.push([ret_0,
                                Lang.bind(this, function (event) {
                                    this._prefix = ret_1;
                                }),
                                ico]);
                        }
                        this.menu_tools_update(this.menu_prefixes, prefix_l);
                    }
                ));
            } catch (e) {
                global.log('ERROR: ' + e.toString());
            }
        }

    },

    menu_separator: function () {
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
    },
    
    menu_new_item: function (menuItem_1, name, iconstr, callback) {
        if (iconstr.substr(0, 1) === ':') {
            let ornament = iconstr.substr(1,1);
            if (ornament === '1') {
                iconstr = 'selected-prefix';
            } else if (ornament === '0') {
                iconstr = 'none';
            }
        }
        let menuItem = new PopupMenu.PopupImageMenuItem(name, iconstr, {});
        menuItem_1.menu.addMenuItem(menuItem);
        menuItem.connect("activate", Lang.bind(this, callback));
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
                let to_run = la[i][1];
                la[i][1] = Lang.bind(this, function(event) {
                    Util.spawn(to_run);
                });
            }
        }
        return la;
    },

    run_command: function () {
        Util.spawn([
            this.script_path('run-command.sh'),
            this._prefix,
            this._wine]);
    },

    use_cmd: function() {
        Util.spawn([
            this.script_path('use-cmd.sh'),
            this._prefix,
            this._wineconsole]);
    },

    update_flatpak_list: function (callback) {
        if (this._flatpak_available) {
            try {
                Util.spawn_async(["flatpak", "list"],
                    Lang.bind(this, function (vals) {
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
                    }));
            } catch (e) {
                global.log("Error: " + e.toString());
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
            let launcher_paths = this.launcher_list[i][1];
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
            if (this.useDarkThemeIcons) {
                ico += '_dark';
            }
        }
        return "wine-utils-icon" + ico;
    },


    on_setting_changed: function() {
        if (this.specifyWineExec) {
            this._wine =
                (this.wineExec !== '') ?
                    this.wineExec : DEFAULT_WINE;
            this._wineconsole =
                (this.wineconsoleExec !== '') ?
                    this.wineconsoleExec : DEFAULT_WINECONSOLE;
        } else {
            this._wine = DEFAULT_WINE;
            this._wineconsole = DEFAULT_WINECONSOLE;
        }

        this.set_applet_icon_name(this.get_icon_for_panel());

        this.update_flatpak_list(
            Lang.bind(this, function () {
                this.update_available_launcher_list();
                this.rebuild_menu();
            }));
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

