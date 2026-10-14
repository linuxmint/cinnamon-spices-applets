const Applet = imports.ui.applet;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;
const Cinnamon = imports.gi.Cinnamon;
const Meta = imports.gi.Meta;
const Mainloop = imports.mainloop;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Util = imports.misc.util;

class WindowSearchApplet extends Applet.Applet {
    constructor(metadata, orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        this.metadata = metadata;
        this.max_results = 7;
        this.isUpdatingMenu = false;
        this.keybindingId = null;

        // Default values
        this.use_custom_icon = false;
        this.icon_preset = "system-search-symbolic";
        this.custom_icon = "folder";
        this.custom_placeholder = "Search app / calc / run script...";
        this.script_prefix = "sh";
        this.script_paths = GLib.build_filenamev([GLib.get_home_dir(), 'scripts']);
        this.terminal_app = "x-terminal-emulator -e";

        try {
            this.settings = new Settings.AppletSettings(this, metadata.uuid, instance_id);
            
            this.settings.bindProperty(Settings.BindingDirection.IN, "max_results", "max_results", this._onSettingUpdated, null);
            this.settings.bindProperty(Settings.BindingDirection.IN, "script_prefix", "script_prefix", this._onSettingUpdated, null);
            this.settings.bindProperty(Settings.BindingDirection.IN, "script_paths", "script_paths", this._onSettingUpdated, null);
            this.settings.bindProperty(Settings.BindingDirection.IN, "terminal_app", "terminal_app", this._onSettingUpdated, null);
            
            this.settings.bindProperty(Settings.BindingDirection.IN, "keybinding", "keybinding", this._onKeybindingChanged, null);
            this.settings.bindProperty(Settings.BindingDirection.IN, "use_custom_icon", "use_custom_icon", this._onIconChanged, null);
            this.settings.bindProperty(Settings.BindingDirection.IN, "icon_preset", "icon_preset", this._onIconChanged, null);
            this.settings.bindProperty(Settings.BindingDirection.IN, "custom_icon", "custom_icon", this._onIconChanged, null);
            this.settings.bindProperty(Settings.BindingDirection.IN, "custom_placeholder", "custom_placeholder", this._onPlaceholderChanged, null);
        } catch (e) {
            global.logError("WindowSearch: Settings failed to load.");
        }

        let initialIcon = this.use_custom_icon ? this.custom_icon : this.icon_preset;

        this.mainBox = new St.BoxLayout({ vertical: false });

        this.appletIcon = new St.Icon({
            icon_name: initialIcon,
            icon_size: 20,
            icon_type: St.IconType.SYMBOLIC,
            style: 'margin-right: 8px;'
        });

        this.searchEntry = new St.Entry({
            name: 'windowSearchEntry',
            hint_text: this.custom_placeholder,
            track_hover: true,
            can_focus: true,
            reactive: true,
            style: 'min-width: 150px; padding: 2px 10px; border-radius: 12px; background-color: rgba(0,0,0,0.2); color: white;'
        });

        this.mainBox.add_child(this.appletIcon);
        this.mainBox.add_child(this.searchEntry);
        this.actor.add_child(this.mainBox); 

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);

        this.searchEntry.clutter_text.set_reactive(true);
        this.searchEntry.clutter_text.connect('button-press-event', () => {
            this._openAndFocus();
            return Clutter.EVENT_PROPAGATE;
        });

        this.menu.connect('open-state-changed', (menu, isOpen) => {
            if (!isOpen && !this.isUpdatingMenu) {
                this.searchEntry.set_text('');
                global.stage.set_key_focus(null);
            }
        });

        this.searchEntry.clutter_text.connect('text-changed', this._onSearchChange.bind(this));
        this.searchEntry.clutter_text.connect('key-press-event', this._onKeyPress.bind(this));

        this.windowItems = [];
        this.selectedIndex = -1;

        this._onKeybindingChanged();
    }

    _onSettingUpdated() {}

    _onIconChanged() {
        let iconToUse = this.use_custom_icon ? this.custom_icon : this.icon_preset;
        this.appletIcon.set_icon_name(iconToUse);
    }

    _onPlaceholderChanged() {
        this.searchEntry.set_hint_text(this.custom_placeholder);
    }

    _openAndFocus() {
        this._searchWindows();
    }

    _onKeybindingChanged() {
        if (this.keybindingId) {
            Main.keybindingManager.removeHotKey(this.keybindingId);
        }
        if (this.keybinding) {
            this.keybindingId = this.metadata.uuid + "_" + this.instance_id;
            Main.keybindingManager.addHotKey(this.keybindingId, this.keybinding, () => {
                if (!this.menu.isOpen) {
                    this._openAndFocus();
                } else {
                    this.menu.close();
                }
            });
        }
    }

    on_applet_removed_from_panel() {
        if (this.keybindingId) {
            Main.keybindingManager.removeHotKey(this.keybindingId);
        }
        this.settings.finalize();
    }

    _searchWindows() {
        let queryRaw = this.searchEntry.get_text();
        let query = queryRaw.toLowerCase().trim();
        
        this.isUpdatingMenu = true; 

        if (!this.menu.isOpen) {
            this.menu.open(true);
        }

        this.menu.removeAll();
        this.windowItems = [];
        this.selectedIndex = -1;

        let windows = [];
        let n_workspaces = global.workspace_manager.get_n_workspaces();
        for (let i = 0; i < n_workspaces; i++) {
            let ws = global.workspace_manager.get_workspace_by_index(i);
            windows.push(...ws.list_windows());
        }

        let windowMatches = windows.filter(w => {
            if (w.is_skip_taskbar() || w.get_window_type() === Meta.WindowType.DESKTOP) return false;
            let title = w.get_title() ? w.get_title().toLowerCase() : "";
            let appClass = w.get_wm_class() ? w.get_wm_class().toLowerCase() : "";
            return title.includes(query) || appClass.includes(query);
        });

        windowMatches = windowMatches.slice(0, this.max_results);

        if (windowMatches.length > 0) {
            let tracker = Cinnamon.WindowTracker.get_default();

            windowMatches.forEach((item) => {
                let menuItem = new PopupMenu.PopupBaseMenuItem();
                let icon;
                let labelText = "";
                let labelStyle = "margin-left: 10px;";

                let app = tracker.get_window_app(item);
                icon = app ? app.create_icon_texture(22) : new St.Icon({
                    icon_name: 'application-default-icon',
                    icon_size: 22,
                    icon_type: St.IconType.SYMBOLIC
                });
                
                labelText = `[Opened] ${item.get_title() || "Unknown"}`;
                labelStyle += " font-weight: bold;";
                
                menuItem.connect('activate', () => this._activateWindow(item));
                menuItem.window = item;

                menuItem.addActor(icon);
                menuItem.addActor(new St.Label({ text: labelText, style: labelStyle }));
                
                this.windowItems.push(menuItem);
                this.menu.addMenuItem(menuItem);
            });

            this._setSelectedIndex(0);
        } else {
            let notFoundItem = new PopupMenu.PopupMenuItem("Type to search app/window...", { reactive: false });
            this.menu.addMenuItem(notFoundItem);
        }

        this.isUpdatingMenu = false; 

        Mainloop.timeout_add(50, () => {
            global.stage.set_key_focus(this.searchEntry);
            return false;
        });
    }

    _onSearchChange() {
        let queryRaw = this.searchEntry.get_text();
        let query = queryRaw.toLowerCase().trim();
        
        this.isUpdatingMenu = true; 

        if (!this.menu.isOpen) {
            this.menu.open(true);
        }

        this.menu.removeAll();
        this.windowItems = [];
        this.selectedIndex = -1;

        let isScriptMode = (query === this.script_prefix) || query.startsWith(this.script_prefix + " ");
        if (isScriptMode) {
            let scriptQuery = query.startsWith(this.script_prefix + " ") ? query.substring(this.script_prefix.length + 1).trim() : "";
            this._showScriptResults(scriptQuery);
            return; 
        }

        let isMath = /^[\d+\-*/().\s]+$/.test(query) && /[+\-*/]/.test(query) && /\d/.test(query);
        if (isMath) {
            try {
                let mathQuery = query.replace(/[^\d+\-*/().]/g, '');
                let result = eval(mathQuery);
                
                if (result !== undefined && !isNaN(result) && isFinite(result)) {
                    let menuItem = new PopupMenu.PopupBaseMenuItem();
                    let icon = new St.Icon({
                        icon_name: 'accessories-calculator',
                        icon_size: 22,
                        icon_type: St.IconType.SYMBOLIC
                    });
                    
                    let label = new St.Label({ 
                        text: `${query} = ${result}   (Press Enter to Copy)`, 
                        style: 'margin-left: 10px; font-weight: bold;' 
                    });

                    menuItem.addActor(icon);
                    menuItem.addActor(label);
                    menuItem.connect('activate', () => this._copyToClipboard(result));
                    
                    menuItem.isCalc = true;
                    menuItem.calcResult = result;
                    
                    this.windowItems.push(menuItem);
                    this.menu.addMenuItem(menuItem);
                    
                    this._setSelectedIndex(0);
                    this.isUpdatingMenu = false; 

                    Mainloop.timeout_add(10, () => {
                        global.stage.set_key_focus(this.searchEntry);
                        return false;
                    });
                    return; 
                }
            } catch (e) {}
        }

        let combinedResults = [];

        let windows = [];
        let n_workspaces = global.workspace_manager.get_n_workspaces();
        for (let i = 0; i < n_workspaces; i++) {
            let ws = global.workspace_manager.get_workspace_by_index(i);
            windows.push(...ws.list_windows());
        }

        let windowMatches = windows.filter(w => {
            if (w.is_skip_taskbar() || w.get_window_type() === Meta.WindowType.DESKTOP) return false;
            let title = w.get_title() ? w.get_title().toLowerCase() : "";
            let appClass = w.get_wm_class() ? w.get_wm_class().toLowerCase() : "";
            return title.includes(query) || appClass.includes(query);
        });

        windowMatches.forEach(w => combinedResults.push({ type: 'window', data: w }));

        let appSystem = Cinnamon.AppSystem.get_default();
        let allApps = appSystem.get_all();
        let appMatches = allApps.filter(app => {
            let name = app.get_name() ? app.get_name().toLowerCase() : "";
            return name.includes(query);
        });

        appMatches.forEach(app => combinedResults.push({ type: 'app', data: app }));

        combinedResults = combinedResults.slice(0, this.max_results);

        if (combinedResults.length > 0) {
            let tracker = Cinnamon.WindowTracker.get_default();

            combinedResults.forEach((item) => {
                let menuItem = new PopupMenu.PopupBaseMenuItem();
                let icon;
                let labelText = "";
                let labelStyle = "margin-left: 10px;";

                if (item.type === 'window') {
                    let w = item.data;
                    let app = tracker.get_window_app(w);
                    icon = app ? app.create_icon_texture(22) : new St.Icon({
                        icon_name: 'application-default-icon',
                        icon_size: 22,
                        icon_type: St.IconType.SYMBOLIC
                    });
                    
                    labelText = `[Opened] ${w.get_title() || "Unknown"}`;
                    labelStyle += " font-weight: bold;";
                    
                    menuItem.connect('activate', () => this._activateWindow(w));
                    menuItem.window = w;
                } else if (item.type === 'app') {
                    let app = item.data;
                    icon = app.create_icon_texture(22) || new St.Icon({
                        icon_name: 'application-default-icon',
                        icon_size: 22,
                        icon_type: St.IconType.SYMBOLIC
                    });
                    
                    labelText = app.get_name();
                    menuItem.connect('activate', () => this._launchApp(app));
                    menuItem.app = app; 
                }

                menuItem.addActor(icon);
                menuItem.addActor(new St.Label({ text: labelText, style: labelStyle }));
                
                this.windowItems.push(menuItem);
                this.menu.addMenuItem(menuItem);
            });

            this._setSelectedIndex(0);
        } else {
            let notFoundItem = new PopupMenu.PopupMenuItem("Not found...", { reactive: false });
            this.menu.addMenuItem(notFoundItem);
        }

        this.isUpdatingMenu = false; 

        Mainloop.timeout_add(10, () => {
            global.stage.set_key_focus(this.searchEntry);
            return false;
        });
    }

    async _showScriptResults(scriptQuery) {
        let scripts = await this._getScriptFiles();
        let matches = scripts.filter(s => s.name.toLowerCase().includes(scriptQuery));
        matches = matches.slice(0, this.max_results);

        if (matches.length > 0) {
            matches.forEach((script) => {
                let menuItem = new PopupMenu.PopupBaseMenuItem();
                let icon = new St.Icon({
                    icon_name: 'utilities-terminal',
                    icon_size: 22,
                    icon_type: St.IconType.SYMBOLIC
                });

                let ext = script.name.split('.').pop().toLowerCase();
                let typeName = "Script";
                let color = "#a8ffb2"; 

                if (ext === 'py') {
                    typeName = "Python";
                    color = "#ffe873"; 
                } else if (ext === 'sh') {
                    typeName = "Shell";
                } else if (ext === 'js') {
                    typeName = "Node.js";
                    color = "#6cc24a"; 
                }

                let labelText = `[${typeName}] ${script.name}`;
                menuItem.addActor(icon);
                menuItem.addActor(new St.Label({ text: labelText, style: `margin-left: 10px; color: ${color};` }));

                menuItem.connect('activate', () => this._runScript(script.path));
                
                menuItem.isScript = true;
                menuItem.scriptPath = script.path;

                this.windowItems.push(menuItem);
                this.menu.addMenuItem(menuItem);
            });
            this._setSelectedIndex(0);
        } else {
            let notFoundItem = new PopupMenu.PopupMenuItem("No matching scripts...", { reactive: false });
            this.menu.addMenuItem(notFoundItem);
        }

        this.isUpdatingMenu = false; 
        Mainloop.timeout_add(10, () => {
            global.stage.set_key_focus(this.searchEntry);
            return false;
        });
    }

    async _getScriptFiles() {
        let scripts = [];
        if (!this.script_paths) return scripts;

        let pathArray = this.script_paths.split(',').map(p => p.trim()).filter(p => p.length > 0);
        let homeDir = GLib.get_home_dir();
        
        for (let p of pathArray) {
            let resolvedPath = p;
            let prefixHome = "~";
            if (p.startsWith(prefixHome.concat("/"))) {
                resolvedPath = GLib.build_filenamev([homeDir, p.slice(2)]);
            } else if (p === prefixHome) {
                resolvedPath = homeDir;
            }
            
            try {
                let dir = GLib.Dir.open(resolvedPath, 0);
                let name;
                while ((name = dir.read_name()) !== null) {
                    let fullPath = GLib.build_filenamev([resolvedPath, name]);
                    let file = Gio.File.new_for_path(fullPath);
                    
                    // Bungkus fungsi async Gio dengan Promise agar await berfungsi dengan benar di CJS
                    let info = await new Promise((resolve) => {
                        file.query_info_async(
                            'standard::type',
                            Gio.FileQueryInfoFlags.NONE,
                            GLib.PRIORITY_DEFAULT,
                            null,
                            (source_obj, res) => {
                                try {
                                    // Wajib menggunakan _finish untuk mengambil hasil dari _async
                                    let resultInfo = source_obj.query_info_finish(res);
                                    resolve(resultInfo);
                                } catch (e) {
                                    resolve(null); // Jika gagal (misal file dihapus saat dibaca), kembalikan null
                                }
                            }
                        );
                    });
                    
                    if (info && info.get_file_type() === Gio.FileType.REGULAR) {
                        scripts.push({
                            name: name,
                            path: fullPath
                        });
                    }
                }
            } catch(e) {
                // Abaikan jika path folder tidak ditemukan atau gagal dibuka
            }
        }
        return scripts;
    }

    _runScript(path) {
        try {
            let interpreter = null;
            let ext = path.split('.').pop().toLowerCase();

            if (ext === 'py') {
                interpreter = 'python3';
            } else if (ext === 'sh') {
                interpreter = 'bash';
            } else if (ext === 'js') {
                interpreter = 'node';
            }

            // Perbaikan: Menggunakan argument vector (array) untuk menghindari shell injection
            let terminalCmds = this.terminal_app.split(' ').map(c => c.trim()).filter(c => c.length > 0);
            let argv = [];
            
            if (terminalCmds.length > 0) {
                argv = argv.concat(terminalCmds);
            } else {
                argv.push('x-terminal-emulator', '-e');
            }

            if (interpreter) {
                argv.push(interpreter, path);
            } else {
                argv.push(path);
            }

            Util.spawn(argv);
        } catch(e) {
            global.logError(e);
            Main.notify("WindowSearch Error", "Failed to run script: " + path);
        }
        this.menu.close();
    }

    _openSettings() {
        // Perbaikan: Menggunakan argument vector untuk membuka pengaturan applet
        Util.spawn(['cinnamon-settings', 'applets', this.metadata.uuid, this.instance_id.toString()]);
        this.menu.close();
    }

    _onKeyPress(actor, event) {
        let symbol = event.get_key_symbol();
        
        if (!this.menu.isOpen || this.windowItems.length === 0) {
            if (symbol === Clutter.KEY_Escape) {
                this.menu.close();
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        }

        if (symbol === Clutter.KEY_Up) {
            if (this.selectedIndex > 0) {
                this._setSelectedIndex(this.selectedIndex - 1);
            }
            return Clutter.EVENT_STOP; 
        } 
        else if (symbol === Clutter.KEY_Down) {
            if (this.selectedIndex < this.windowItems.length - 1) {
                this._setSelectedIndex(this.selectedIndex + 1);
            }
            return Clutter.EVENT_STOP;
        } 
        else if (symbol === Clutter.KEY_Return || symbol === Clutter.KEY_KP_Enter) {
            if (this.selectedIndex >= 0 && this.selectedIndex < this.windowItems.length) {
                let item = this.windowItems[this.selectedIndex];
                
                if (item.isAction) {
                    item.actionFunc();
                } else if (item.isCalc) {
                    this._copyToClipboard(item.calcResult);
                } else if (item.isScript) {
                    this._runScript(item.scriptPath); 
                } else if (item.window) {
                    this._activateWindow(item.window);
                } else if (item.app) {
                    this._launchApp(item.app);
                }
            }
            return Clutter.EVENT_STOP;
        } 
        else if (symbol === Clutter.KEY_Escape) {
            this.menu.close();
            return Clutter.EVENT_STOP;
        }

        return Clutter.EVENT_PROPAGATE; 
    }

    _setSelectedIndex(index) {
        if (this.selectedIndex >= 0 && this.selectedIndex < this.windowItems.length) {
            this.windowItems[this.selectedIndex].setActive(false);
        }
        
        this.selectedIndex = index;
        if (this.selectedIndex >= 0 && this.selectedIndex < this.windowItems.length) {
            this.windowItems[this.selectedIndex].setActive(true);
        }
    }

    _activateWindow(win) {
        Main.activateWindow(win, global.get_current_time());
        this.menu.close(); 
    }

    _launchApp(app) {
        app.open_new_window(-1);
        this.menu.close();
    }

    _copyToClipboard(text) {
        let clipboard = St.Clipboard.get_default();
        clipboard.set_text(St.ClipboardType.CLIPBOARD, text.toString());
        Main.notify("Calculator", "Result copied to clipboard: " + text);
        this.menu.close();
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new WindowSearchApplet(metadata, orientation, panel_height, instance_id);
}
