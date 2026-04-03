/*
 * Copyright (C) 2026 hisovereign
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const St = imports.gi.St;
const Main = imports.ui.main;
const Gettext = imports.gettext;  // Added for translations

let UUID = "ultraspan@hisovereign";

// Get standard XDG directories (HOME defined once here)
const HOME = GLib.get_home_dir();
const USER_DATA_DIR = GLib.get_user_data_dir();      // ~/.local/share
const USER_CONFIG_DIR = GLib.get_user_config_dir();  // ~/.config
const USER_CACHE_DIR = GLib.get_user_cache_dir();    // ~/.cache
const USER_BIN_DIR = HOME + "/.local/bin";           // No XDG equivalent

// Construct paths properly
const SCRIPT_PATH = GLib.build_filenamev([USER_BIN_DIR, "ultraspan"]);
const RANDOM_FOLDER = GLib.build_filenamev([HOME, "Pictures", "ultraspan"]);
const CONFIG_DIR = GLib.build_filenamev([USER_CONFIG_DIR, "ultraspan"]);

// Translation setup with proper locale path
const LOCALE_DIR = GLib.build_filenamev([USER_DATA_DIR, "locale"]);
Gettext.bindtextdomain(UUID, LOCALE_DIR);

function _(text) {
    return Gettext.dgettext(UUID, text);
}

class UltraspanApplet extends Applet.IconApplet {
    constructor(metadata, orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId);

        this.set_applet_icon_symbolic_name("preferences-desktop-wallpaper");
        this.set_applet_tooltip(_("Ultraspan Wallpaper Manager"));

        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menuManager.addMenu(this.menu);
        
        // Store timer and signal IDs for cleanup
        this._menuTimer = null;
        this._stageSignalId = null;
        this._timeoutIds = [];  // Track all timeouts
        
        this._addCustomStyles();
        this._buildMenu();
        
        this._originalAllocate = null;
        this._protectFromBlur();
    }

    // Proper lifecycle cleanup
    on_applet_removed_from_panel() {
        // Clear interval timer
        if (this._menuTimer) {
            clearInterval(this._menuTimer);
            this._menuTimer = null;
        }
        
        // Disconnect stage signal
        if (this._stageSignalId) {
            global.stage.disconnect(this._stageSignalId);
            this._stageSignalId = null;
        }
        
        // Clear any pending timeouts
        this._timeoutIds.forEach(id => clearTimeout(id));
        this._timeoutIds = [];
        
        // Destroy menu to clean up its signals
        if (this.menu) {
            this.menu.destroy();
            this.menu = null;
        }
        
        // Remove menu manager reference
        if (this.menuManager) {
            this.menuManager = null;
        }
    }

    // Helper to track timeouts for cleanup
    _setTimeout(callback, delay) {
        let id = setTimeout(() => {
            // Remove from array when it fires
            let index = this._timeoutIds.indexOf(id);
            if (index > -1) this._timeoutIds.splice(index, 1);
            callback();
        }, delay);
        this._timeoutIds.push(id);
        return id;
    }

    on_applet_clicked() {
        this.menu.toggle();
    }

    _protectFromBlur() {
        // Store reference to our applet
        let applet = this;
        
        // Function to check if a menu belongs to our applet
        function isOurMenu(menu) {
            try {
                let parent = menu.actor;
                while (parent) {
                    if (parent._delegate && parent._delegate._applet === applet) {
                        return true;
                    }
                    parent = parent.get_parent();
                }
            } catch (e) {}
            return false;
        }
        
        // Function to find and process menus
        let processMenus = () => {
            try {
                let menus = [];
                
                // Recursive function to find all menus
                let findMenus = (actor) => {
                    if (actor instanceof PopupMenu.PopupMenu) {
                        menus.push(actor);
                    }
                    let children = actor.get_children();
                    if (children) {
                        children.forEach(findMenus);
                    }
                };
                
                // Start search from the main UI group
                findMenus(Main.uiGroup);
                
                // Process each menu
                menus.forEach(menu => {
                    if (!isOurMenu(menu)) return;
                    
                    // Save original allocate function
                    if (!applet._originalAllocate && menu.actor.allocate) {
                        applet._originalAllocate = menu.actor.allocate;
                        
                        // Override allocate to ensure correct sizing
                        menu.actor.allocate = function(box, flags) {
                            applet._originalAllocate.call(this, box, flags);
                            
                            // Force scrollview to recalculate after allocation
                            if (this instanceof St.ScrollView) {
                                this.queue_relayout();
                                
                                // Also force scrollbars to update
                                let vscroll = this.get_vscroll_bar();
                                if (vscroll) {
                                    vscroll.queue_relayout();
                                }
                            }
                        };
                    }
                    
                    // Directly fix any scrollviews in this menu
                    let fixScrollView = (actor) => {
                        if (actor instanceof St.ScrollView) {
                            // Ensure scrollview properties are correct
                            actor.set_style('overflow-y: auto; max-height: 400px;');
                            actor.queue_relayout();
                        }
                        
                        let children = actor.get_children();
                        if (children) {
                            children.forEach(fixScrollView);
                        }
                    };
                    
                    fixScrollView(menu.actor);
                });
            } catch (e) {
                global.log("Error in processMenus: " + e);
            }
        };
        
        // Run immediately
        processMenus();
        
        // Run at intervals to catch new menus - STORE THE TIMER ID
        this._menuTimer = setInterval(processMenus, 500);
        
        // Store signal ID for cleanup
        this._stageSignalId = global.stage.connect('notify::focus-key', () => {
            this._setTimeout(processMenus, 50);
        });
    }

    /* ---------------- Custom Styles ---------------- */
    
    _addCustomStyles() {
        const css = `
            .ultraspan-submenu {
                max-width: 250px !important;
                min-width: 200px !important;
            }
            .ultraspan-filename {
                max-width: 230px;
                min-width: 180px;
                text-overflow: ellipsis;
                overflow: hidden;
                white-space: nowrap;
            }
            .ultraspan-header {
                font-weight: bold;
                color: #555;
            }
        `;
        try {
            const style = new St.StyleSheet();
            style.from_string(css);
            this.actor.add_style(style);
        } catch (e) {}
    }

    /* ---------------- Force Submenu Styles ---------------- */

    _forceSubmenuStyles(menu) {
        menu.connect('open-state-changed', (subMenu, open) => {
            if (open) {
                // Use tracked timeouts instead of direct setTimeout
                [10, 50, 100, 200].forEach(delay => {
                    this._setTimeout(() => {
                        try {
                            let actor = subMenu.actor;
                            
                            if (actor instanceof imports.gi.St.ScrollView) {
                                // Force scrollview to reallocate
                                let [width, height] = actor.get_size();
                                
                                // Temporarily modify and restore to force recalculation
                                actor.set_height(-1);
                                actor.set_width(-1);
                                
                                // Trigger allocation cycle
                                actor.queue_relayout();
                                
                                // Restore after a tiny delay
                                this._setTimeout(() => {
                                    actor.set_height(height);
                                    actor.set_width(width);
                                    actor.queue_relayout();
                                    
                                    // Force scrollbars to re-evaluate
                                    let vscroll = actor.get_vscroll_bar();
                                    if (vscroll) {
                                        vscroll.queue_relayout();
                                    }
                                }, 5);
                            }
                            
                            // Also force parents to reallocate
                            let parent = actor.get_parent();
                            while (parent) {
                                parent.queue_relayout();
                                parent = parent.get_parent();
                            }
                            
                        } catch (e) {
                            global.log("Error forcing allocation: " + e);
                        }
                    }, delay);
                });
            }
        });
    }

    /* ---------------- Menu ---------------- */

    _buildMenu() {
        this.menu.removeAll();

        this._addFolderSubMenu();
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        
        this._addSettingsSubMenu();
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        let refreshItem = new PopupMenu.PopupMenuItem("⟳ " + _("Refresh"));
        refreshItem.connect('activate', () => {
            this._rebuildMenu();
        });
        this.menu.addMenuItem(refreshItem);


        this._addRandomControl();
    }
    
    _addFolderSubMenu() {
        const folderItem = new PopupMenu.PopupSubMenuMenuItem(_("Set wallpaper"));
        this._forceSubmenuStyles(folderItem);
        folderItem.menu.actor.add_style_class_name('ultraspan-submenu');
        this.menu.addMenuItem(folderItem);
        
        // Use async check instead of GLib.file_test
        let folder = Gio.File.new_for_path(RANDOM_FOLDER);
        folder.query_info_async('*', Gio.FileQueryInfoFlags.NONE, GLib.PRIORITY_DEFAULT, null, (obj, res) => {
            try {
                obj.query_info_finish(res);
                // Folder exists, load images
                this._getImagesFromFolderAsync(RANDOM_FOLDER, 30, (images) => {
                    this._populateFolderMenu(folderItem, images);
                });
            } catch (e) {
                if (e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.NOT_FOUND)) {
                    // Folder doesn't exist
                    const noFolderItem = new PopupMenu.PopupMenuItem(_("Folder does not exist"));
                    noFolderItem.setSensitive(false);
                    folderItem.menu.addMenuItem(noFolderItem);
                    
                    const createItem = new PopupMenu.PopupMenuItem(_("Create folder"));
                    createItem.connect("activate", () => {
                        GLib.mkdir_with_parents(RANDOM_FOLDER, 0o755);
                        this._setTimeout(() => this._rebuildMenu(), 300);
                    });
                    folderItem.menu.addMenuItem(createItem);
                } else {
                    global.logError("Error checking folder: " + e);
                }
            }
        });
    }

    _populateFolderMenu(folderItem, images) {
        if (images.length === 0) {
            const noImagesItem = new PopupMenu.PopupMenuItem(_("No images found"));
            noImagesItem.setSensitive(false);
            noImagesItem.actor.add_style_class_name('ultraspan-header');
            folderItem.menu.addMenuItem(noImagesItem);
            
            const openItem = new PopupMenu.PopupMenuItem(_("Open folder to add images"));
            openItem.connect("activate", () => {
                this._openFolderInFileManager(RANDOM_FOLDER);
            });
            folderItem.menu.addMenuItem(openItem);
        } else {
            const countItem = new PopupMenu.PopupMenuItem(
                _("%d images found").format(images.length)
            );
            countItem.setSensitive(false);
            countItem.actor.add_style_class_name('ultraspan-header');
            folderItem.menu.addMenuItem(countItem);
            
            images.forEach(image => {
                const item = new PopupMenu.PopupMenuItem(this._truncateName(image.name, 25));
                item.actor.add_style_class_name('ultraspan-filename');
                item.connect("activate", () => {
                    this._setWallpaper(image.path);
                });
                folderItem.menu.addMenuItem(item);
            });
            
            folderItem.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            const openFolderItem = new PopupMenu.PopupMenuItem(_("Open folder"));
            openFolderItem.connect("activate", () => {
                this._openFolderInFileManager(RANDOM_FOLDER);
            });
            folderItem.menu.addMenuItem(openFolderItem);
        }
    }

    _addSettingsSubMenu() {
        const settingsItem = new PopupMenu.PopupSubMenuMenuItem(_("Settings"));
        this._forceSubmenuStyles(settingsItem);
        settingsItem.menu.actor.add_style_class_name('ultraspan-submenu');
        this.menu.addMenuItem(settingsItem);

        // Read config asynchronously
        this._readConfigAsync((currentConfig) => {
            // Wallpaper Mode section
            let modeHeader = new PopupMenu.PopupMenuItem(_("Wallpaper Mode"));
            modeHeader.setSensitive(false);
            modeHeader.actor.add_style_class_name('ultraspan-header');
            settingsItem.menu.addMenuItem(modeHeader);

            const modes = ["zoom", "fit", "center"];
            modes.forEach(mode => {
                let modeItem = new PopupMenu.PopupMenuItem(_(mode.charAt(0).toUpperCase() + mode.slice(1)));
                if (currentConfig.mode === mode) {
                    modeItem.setOrnament(1);
                }
                modeItem.connect("activate", () => {
                    this._runCommandInBackground(["mode", mode]);
                    this._setTimeout(() => this._rebuildMenu(), 100);
                });
                settingsItem.menu.addMenuItem(modeItem);
            });

            settingsItem.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            // Background Type section
            let bgHeader = new PopupMenu.PopupMenuItem(_("Background Type"));
            bgHeader.setSensitive(false);
            bgHeader.actor.add_style_class_name('ultraspan-header');
            settingsItem.menu.addMenuItem(bgHeader);

            const bgTypes = ["blur", "solid"];
            bgTypes.forEach(type => {
                let bgItem = new PopupMenu.PopupMenuItem(_(type.charAt(0).toUpperCase() + type.slice(1)));
                if (currentConfig.bg_type === type) {
                    bgItem.setOrnament(1);
                }
                bgItem.connect("activate", () => {
                    this._runCommandInBackground(["bg-type", type]);
                    this._setTimeout(() => this._rebuildMenu(), 100);
                });
                settingsItem.menu.addMenuItem(bgItem);
            });

            // Blur Amount section (only if blur is active)
            if (currentConfig.bg_type === "blur") {
                settingsItem.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
                
                let blurHeader = new PopupMenu.PopupMenuItem(_("Blur Amount"));
                blurHeader.setSensitive(false);
                blurHeader.actor.add_style_class_name('ultraspan-header');
                settingsItem.menu.addMenuItem(blurHeader);
                
                const blurAmounts = [5, 15, 30, 75];
                blurAmounts.forEach(amount => {
                    let blurItem = new PopupMenu.PopupMenuItem(_("Blur: %d").format(amount));
                    if (currentConfig.blur == amount) {
                        blurItem.setOrnament(1);
                    }
                    blurItem.connect("activate", () => {
                        this._runCommandInBackground(["blur", amount.toString()]);
                        this._setTimeout(() => this._rebuildMenu(), 100);
                    });
                    settingsItem.menu.addMenuItem(blurItem);
                });
            }

            settingsItem.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            // Random Interval section
            let intervalHeader = new PopupMenu.PopupMenuItem(_("Random Interval"));
            intervalHeader.setSensitive(false);
            intervalHeader.actor.add_style_class_name('ultraspan-header');
            settingsItem.menu.addMenuItem(intervalHeader);
            
            const intervals = [1, 5, 15, 30, 60, 120];
            intervals.forEach(minutes => {
                let intervalItem = new PopupMenu.PopupMenuItem(
                    _("%d min").format(minutes)
                );
                if (currentConfig.random_interval == minutes) {
                    intervalItem.setOrnament(1);
                }
                intervalItem.connect("activate", () => {
                    this._runCommandInBackground(["interval", minutes.toString()]);
                    this._setTimeout(() => this._rebuildMenu(), 100);
                });
                settingsItem.menu.addMenuItem(intervalItem);
            });

            settingsItem.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            // Clear cache button
            let clearCacheItem = new PopupMenu.PopupMenuItem(_("Clear cache"));
            clearCacheItem.connect('activate', () => {
                this._runCommandInBackground(["clean"]);
                this._setTimeout(() => {
                    // Read state file asynchronously
                    const statePath = GLib.build_filenamev([CONFIG_DIR, "state"]);
                    let stateFile = Gio.File.new_for_path(statePath);
                    
                    stateFile.load_contents_async(null, (obj, res) => {
                        try {
                            let [success, contents] = obj.load_contents_finish(res);
                            if (success) {
                                const lines = contents.toString().split('\n');
                                const lastImage = lines[0];
                                
                                // Async check if file exists
                                let imageFile = Gio.File.new_for_path(lastImage);
                                imageFile.query_info_async('*', Gio.FileQueryInfoFlags.NONE, 
                                    GLib.PRIORITY_DEFAULT, null, (obj2, res2) => {
                                    try {
                                        obj2.query_info_finish(res2);
                                        // File exists
                                        this._setWallpaper(lastImage);
                                    } catch (e) {
                                        if (e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.NOT_FOUND)) {
                                            Main.notify(_("Ultraspan"), 
                                                _("Last wallpaper file no longer exists."));
                                        }
                                    }
                                });
                            }
                        } catch (e) {
                            global.logError("Error reading state file: " + e);
                        }
                    });
                }, 500);
            });
            settingsItem.menu.addMenuItem(clearCacheItem);
        });
    }

    _addRandomControl() {
        const randomFile = GLib.build_filenamev([CONFIG_DIR, "random"]);
        
        // Async check if random file exists
        let file = Gio.File.new_for_path(randomFile);
        file.query_info_async('*', Gio.FileQueryInfoFlags.NONE, GLib.PRIORITY_DEFAULT, null, (obj, res) => {
            try {
                obj.query_info_finish(res);
                // File exists - random is active
                const stopItem = new PopupMenu.PopupMenuItem("⏹️ " + _("Stop Random Rotation"));
                stopItem.connect("activate", () => {
                    this._runCommandInBackground(["random-stop"]);
                    this._setTimeout(() => this._rebuildMenu(), 100);
                });
                this.menu.addMenuItem(stopItem);
            } catch (e) {
                if (e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.NOT_FOUND)) {
                    // File doesn't exist - random is inactive
                    const startItem = new PopupMenu.PopupMenuItem("▶️ " + _("Start Random Rotation"));
                    startItem.connect("activate", () => {
                        // Check if folder exists
                        let folder = Gio.File.new_for_path(RANDOM_FOLDER);
                        folder.query_info_async('*', Gio.FileQueryInfoFlags.NONE, 
                            GLib.PRIORITY_DEFAULT, null, (obj2, res2) => {
                            try {
                                obj2.query_info_finish(res2);
                                // Folder exists
                                this._readConfigAsync((currentConfig) => {
                                    let mode = currentConfig.mode || 'zoom';
                                    this._runCommandInBackground(["random", RANDOM_FOLDER, mode]);
                                    this._setTimeout(() => this._rebuildMenu(), 100);
                                });
                            } catch (e) {
                                if (e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.NOT_FOUND)) {
                                    // Folder doesn't exist - create it
                                    GLib.mkdir_with_parents(RANDOM_FOLDER, 0o755);
                                    this._readConfigAsync((currentConfig) => {
                                        let mode = currentConfig.mode || 'zoom';
                                        this._runCommandInBackground(["random", RANDOM_FOLDER, mode]);
                                        this._setTimeout(() => this._rebuildMenu(), 100);
                                    });
                                }
                            }
                        });
                    });
                    this.menu.addMenuItem(startItem);
                }
            }
        });
    }

    /* ---------------- Async Config Reader ---------------- */
    
    _readConfigAsync(callback) {
        let config = {
            mode: 'zoom',
            bg_type: 'blur',
            blur: 15,
            random_interval: 30
        };
        
        const configPath = GLib.build_filenamev([CONFIG_DIR, "config"]);
        let configFile = Gio.File.new_for_path(configPath);
        
        configFile.load_contents_async(null, (obj, res) => {
            try {
                let [success, contents] = obj.load_contents_finish(res);
                if (success) {
                    const lines = contents.toString().split('\n');
                    lines.forEach(line => {
                        line = line.trim();
                        if (line.includes('=')) {
                            const [key, value] = line.split('=', 2);
                            if (key === 'blur' || key === 'random_interval') {
                                config[key] = parseInt(value, 10);
                            } else if (value) {
                                config[key] = value;
                            }
                        }
                    });
                }
            } catch (e) {
                global.logError("Error reading config: " + e);
            }
            callback(config);
        });
    }
    
    /* ---------------- Core Operations ---------------- */
    
    _setWallpaper(imagePath) {
        this._readConfigAsync((currentConfig) => {
            let mode = currentConfig.mode || 'zoom';
            this._runCommandInBackground(["set", imagePath, mode]);
        });
    }
    
    _openFolderInFileManager(folderPath) {
        try {
            // Use argument array version for safety
            GLib.spawn_async(null, ['xdg-open', folderPath], null,
                GLib.SpawnFlags.SEARCH_PATH | GLib.SpawnFlags.DO_NOT_REAP_CHILD,
                null);
        } catch (e) {
            global.logError("Error opening folder: " + e);
        }
    }
    
    /* ---------------- Safe Command Execution ---------------- */
    
    _runCommandInBackground(args) {
        // Async check if script exists
        let scriptFile = Gio.File.new_for_path(SCRIPT_PATH);
        scriptFile.query_info_async('*', Gio.FileQueryInfoFlags.NONE, GLib.PRIORITY_DEFAULT, null, (obj, res) => {
            try {
                obj.query_info_finish(res);
                // Script exists, run command
                this._setTimeout(() => {
                    try {
                        const fullArgs = [SCRIPT_PATH].concat(args);
                        GLib.spawn_async(null, fullArgs, null,
                            GLib.SpawnFlags.SEARCH_PATH | GLib.SpawnFlags.DO_NOT_REAP_CHILD,
                            null);
                    } catch (e) {
                        global.logError("Error running command: " + e);
                    }
                }, 10);
            } catch (e) {
                if (e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.NOT_FOUND)) {
                    global.log("Ultraspan script not found at: " + SCRIPT_PATH);
                } else {
                    global.logError("Error checking script: " + e);
                }
            }
        });
    }
    
    /* ---------------- Async Image Loading ---------------- */
    
    _getImagesFromFolderAsync(folderPath, maxCount, callback) {
        const images = [];
        
        let dir = Gio.File.new_for_path(folderPath);
        
        dir.enumerate_children_async('standard::name', Gio.FileQueryInfoFlags.NONE,
            GLib.PRIORITY_DEFAULT, null, (obj, res) => {
            try {
                let enumerator = obj.enumerate_children_finish(res);
                this._enumerateNextAsync(enumerator, folderPath, images, maxCount, callback);
            } catch (e) {
                global.logError("Error enumerating directory: " + e);
                callback(images);
            }
        });
    }
    
    _enumerateNextAsync(enumerator, folderPath, images, maxCount, callback) {
        enumerator.next_files_async(10, GLib.PRIORITY_DEFAULT, null, (obj, res) => {
            try {
                let files = obj.next_files_finish(res);
                if (files === null || files.length === 0 || images.length >= maxCount) {
                    enumerator.close_async(GLib.PRIORITY_DEFAULT, null, () => {});
                    images.sort((a, b) => a.name.localeCompare(b.name));
                    callback(images);
                    return;
                }
                
                files.forEach(fileInfo => {
                    if (images.length >= maxCount) return;
                    
                    const fileName = fileInfo.get_name();
                    const lowerName = fileName.toLowerCase();
                    if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg') || 
                        lowerName.endsWith('.png') || lowerName.endsWith('.webp')) {
                        
                        const filePath = GLib.build_filenamev([folderPath, fileName]);
                        
                        // Check if file exists asynchronously
                        let file = Gio.File.new_for_path(filePath);
                        file.query_info_async('*', Gio.FileQueryInfoFlags.NONE, 
                            GLib.PRIORITY_DEFAULT, null, (obj2, res2) => {
                            try {
                                obj2.query_info_finish(res2);
                                images.push({ name: fileName, path: filePath });
                            } catch (e) {
                                // File doesn't exist or error, skip it
                            }
                        });
                    }
                });
                
                // Continue to next batch
                this._enumerateNextAsync(enumerator, folderPath, images, maxCount, callback);
                
            } catch (e) {
                global.logError("Error reading files: " + e);
                callback(images);
            }
        });
    }
    
    /* ---------------- Utility Functions ---------------- */
    
    _truncateName(name, maxLength) {
        if (name.length <= maxLength) return name;
        return name.substring(0, maxLength - 3) + "...";
    }
    
    _rebuildMenu() {
        this._buildMenu();
        this.menu.open();
    }
}

function main(metadata, orientation, panelHeight, instanceId) {
    return new UltraspanApplet(metadata, orientation, panelHeight, instanceId);
}
