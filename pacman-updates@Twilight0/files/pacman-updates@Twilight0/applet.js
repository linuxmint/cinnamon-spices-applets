const Applet = imports.ui.applet;
const Cinnamon = imports.gi.Cinnamon;
const Lang = imports.lang;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;
const Gettext = imports.gettext;
const UUID = "pacman-updates@Twilight0";
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Settings = imports.ui.settings;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const Util = imports.misc.util;
const Tooltips = imports.ui.tooltips;

Gettext.bindtextdomain(UUID, GLib.get_user_data_dir() + "/locale");

function _(str) {
    return Gettext.dgettext(UUID, str);
}

function MyApplet(metadata, orientation, panel_height, instance_id) {
    this._init(metadata, orientation, panel_height, instance_id);
}

MyApplet.prototype = {
    __proto__: Applet.TextIconApplet.prototype,

    _init: function (metadata, orientation, panel_height, instance_id) {
        Applet.TextIconApplet.prototype._init.call(this, orientation, panel_height, instance_id);

        try {
            this._updates = [];
            this._isChecking = false;
            this._checkTimeoutId = null;

            // Check if checkupdates is installed
            this._hasCheckupdates = (GLib.find_program_in_path("checkupdates") !== null);

            // Bind settings
            this.settings = new Settings.AppletSettings(this, metadata.uuid, this.instance_id);
            this.settings.bind("checkInterval", "_checkInterval", this.settings_changed);
            this.settings.bind("showDesktopNotifications", "_showDesktopNotifications", this.settings_changed);
            this.settings.bind("terminalEmulator", "_terminalEmulator", this.settings_changed);
            this.settings.bind("updateCommand", "_updateCommand", this.settings_changed);
            this.settings.bind("checkAur", "_checkAur", this.settings_changed);
            this.settings.bind("aurHelper", "_aurHelper", this.settings_changed);

            // Set up UI Menu
            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager.addMenu(this.menu);

            // Setup Pacman Lock Monitor
            this._dbLckFile = Gio.File.new_for_path("/var/lib/pacman/db.lck");
            this._dbLckExists = false;
            this._pacmanMonitor = null;
            this._pacmanMonitorId = 0;
            this._lckTimeoutId = null;

            this._pacmanDir = Gio.File.new_for_path("/var/lib/pacman");
            try {
                this._pacmanMonitor = this._pacmanDir.monitor_directory(Gio.FileMonitorFlags.NONE, null);
                this._pacmanMonitorId = this._pacmanMonitor.connect("changed", (monitor, file, other_file, event_type) => {
                    let basename = file.get_basename();
                    if (basename === "db.lck") {
                        this._dbLckFile.query_info_async(
                            "standard::type",
                            Gio.FileQueryInfoFlags.NONE,
                            GLib.PRIORITY_DEFAULT,
                            null,
                            (fileObj, res) => {
                                let isLocked = false;
                                try {
                                    fileObj.query_info_finish(res);
                                    isLocked = true;
                                } catch (e) {
                                    isLocked = false;
                                }
                                
                                if (isLocked !== this._dbLckExists) {
                                    this._dbLckExists = isLocked;
                                    this._updateUI();
                                    if (!isLocked) {
                                        // Wait 1 second after lock release to check updates
                                        if (this._lckTimeoutId) {
                                            Mainloop.source_remove(this._lckTimeoutId);
                                        }
                                        this._lckTimeoutId = Mainloop.timeout_add(1000, () => {
                                            this._lckTimeoutId = null;
                                            if (this._pacmanMonitor) {
                                                this._checkUpdates();
                                            }
                                            return false;
                                        });
                                    }
                                }
                            }
                        );
                    }
                });
            } catch (err) {
                global.logError("Failed to set up pacman directory monitor: " + err);
            }

            // Perform initial async check for existing lock, then initialize UI and checks
            this._dbLckFile.query_info_async(
                "standard::type",
                Gio.FileQueryInfoFlags.NONE,
                GLib.PRIORITY_DEFAULT,
                null,
                (fileObj, res) => {
                    try {
                        fileObj.query_info_finish(res);
                        this._dbLckExists = true;
                    } catch (e) {
                        this._dbLckExists = false;
                    }
                    this._updateUI();

                    let hasRepo = this._hasCheckupdates;
                    let hasAur = this._checkAur && this._aurHelper && (GLib.find_program_in_path(this._aurHelper) !== null);

                    if (hasRepo || hasAur) {
                        // Initial check
                        this._checkUpdates();
                        // Schedule periodic check
                        this._scheduleCheck();
                    } else {
                        global.logError("pacman-updates error: No update tools found. Please install 'pacman-contrib', 'yay', or 'paru'.");
                    }
                }
            );
        } catch (e) {
            global.logError(e);
        }
    },

    settings_changed: function () {
        let hasRepo = this._hasCheckupdates;
        let hasAur = this._checkAur && terminalEmulator._aurHelper && (GLib.find_program_in_path(this._aurHelper) !== null);
        if (hasRepo || hasAur) {
            this._scheduleCheck();
        }
    },

    _scheduleCheck: function () {
        if (this._checkTimeoutId) {
            Mainloop.source_remove(this._checkTimeoutId);
            this._checkTimeoutId = null;
        }
        
        let intervalMs = this._checkInterval * 60 * 1000;
        this._checkTimeoutId = Mainloop.timeout_add(intervalMs, () => {
            this._checkUpdates();
            return true; // Keep timeout alive
        });
    },

    _updateUI: function () {
        let iconName = "system-software-update-symbolic";
        let tooltip = _("Pacman Update Checker");
        let labelText = "";

        let hasRepo = this._hasCheckupdates;
        let hasAur = this._checkAur && this._aurHelper && (GLib.find_program_in_path(this._aurHelper) !== null);

        if (!hasRepo && !hasAur) {
            iconName = "dialog-error-symbolic";
            tooltip = _("Error: No update tools found! Please install 'pacman-contrib', 'yay', or 'paru'.");
            labelText = _("Error");
            this.set_applet_icon_symbolic_name(iconName);
            this.set_applet_tooltip(tooltip);
            this.set_applet_label(labelText);
            return;
        }

        if (this._dbLckExists) {
            iconName = "changes-prevent-symbolic";
            tooltip = _("Pacman database is locked (updates are active)");
            labelText = _("Busy");
        } else if (this._isChecking) {
            iconName = "view-refresh-symbolic";
            tooltip = _("Checking for updates...");
            labelText = "";
        } else if (this._updates.length === 0) {
            iconName = "system-software-update-symbolic";
            tooltip = _("System is up to date");
            labelText = "";
        } else {
            iconName = "software-update-available-symbolic";
            tooltip = _(this._updates.length + " updates available (click to inspect/apply)");
            labelText = this._updates.length.toString();
        }

        this.set_applet_icon_symbolic_name(iconName);
        this.set_applet_tooltip(tooltip);
        this.set_applet_label(labelText);
    },

    _checkUpdates: function () {
        let hasRepo = this._hasCheckupdates;
        let hasAur = this._checkAur && this._aurHelper && (GLib.find_program_in_path(this._aurHelper) !== null);
        
        if (!hasRepo && !hasAur) return;
        if (this._dbLckExists) return;
        if (this._isChecking) return;

        this._isChecking = true;
        this._updateUI();

        let newUpdates = [];
        let pending = 0;
        
        let onFinished = () => {
            pending--;
            if (pending <= 0) {
                this._sortUpdatesByDate(newUpdates, (sortedUpdates) => {
                    this._isChecking = false;
                    this._processUpdates(sortedUpdates);
                });
            }
        };

        // 1. Repo check
        if (hasRepo) {
            pending++;
            let cmdRepo = ["checkupdates"];
            try {
                let launcher = new Gio.SubprocessLauncher({
                    flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_SILENCE
                });
                let proc = launcher.spawnv(cmdRepo);
                let stdoutStream = new Gio.DataInputStream({
                    base_stream: proc.get_stdout_pipe(),
                    close_base_stream: true
                });
                this._readUpdatesOutput(stdoutStream, newUpdates, proc, onFinished);
            } catch (e) {
                global.logError("Failed to run checkupdates: " + e);
                onFinished();
            }
        }

        // 2. AUR check
        if (hasAur) {
            pending++;
            let cmdAur = [this._aurHelper, "-Qua"];
            try {
                let launcher = new Gio.SubprocessLauncher({
                    flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_SILENCE
                });
                let proc = launcher.spawnv(cmdAur);
                let stdoutStream = new Gio.DataInputStream({
                    base_stream: proc.get_stdout_pipe(),
                    close_base_stream: true
                });
                this._readUpdatesOutput(stdoutStream, newUpdates, proc, onFinished);
            } catch (e) {
                global.logError("Failed to run " + this._aurHelper + ": " + e);
                onFinished();
            }
        }

        if (pending === 0) {
            this._isChecking = false;
            this._updates = [];
            this._updateUI();
        }
    },

    _readUpdatesOutput: function (stream, newUpdates, proc, onFinished) {
        stream.read_line_async(GLib.PRIORITY_LOW, null, (stream, result) => {
            try {
                let [line] = stream.read_line_finish_utf8(result);
                if (line !== null) {
                    let trimLine = line.trim();
                    if (trimLine) {
                        if (newUpdates.indexOf(trimLine) === -1) {
                            newUpdates.push(trimLine);
                        }
                    }
                    this._readUpdatesOutput(stream, newUpdates, proc, onFinished);
                } else {
                    // Stream finished
                    proc.wait_async(null, (p, res) => {
                        onFinished();
                    });
                }
            } catch (e) {
                onFinished();
            }
        });
    },

    _sortUpdatesByDate: function (newUpdates, callback) {
        if (newUpdates.length === 0) {
            callback(newUpdates);
            return;
        }

        let pkgNames = [];
        for (let line of newUpdates) {
            let parts = line.split(/\s+/);
            if (parts.length > 0 && parts[0]) {
                pkgNames.push(parts[0]);
            }
        }

        if (pkgNames.length === 0 || GLib.find_program_in_path("expac") === null) {
            callback(newUpdates);
            return;
        }

        let cmd = ["expac", "-S", "-t", "%s", "%b %n"].concat(pkgNames);
        try {
            let launcher = new Gio.SubprocessLauncher({
                flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_SILENCE
            });
            let proc = launcher.spawnv(cmd);
            let stdoutStream = new Gio.DataInputStream({
                base_stream: proc.get_stdout_pipe(),
                close_base_stream: true
            });

            let timestamps = {};
            
            let readOutput = (stream) => {
                stream.read_line_async(GLib.PRIORITY_LOW, null, (stream, result) => {
                    try {
                        let [line] = stream.read_line_finish_utf8(result);
                        if (line !== null) {
                            let trimLine = line.trim();
                            if (trimLine) {
                                let parts = trimLine.split(/\s+/);
                                if (parts.length >= 2) {
                                    let ts = parseInt(parts[0], 10);
                                    let name = parts.slice(1).join(" ");
                                    if (!isNaN(ts)) {
                                        timestamps[name] = ts;
                                    }
                                }
                            }
                            readOutput(stream);
                        } else {
                            proc.wait_async(null, (p, res) => {
                                newUpdates.sort((a, b) => {
                                    let nameA = a.split(/\s+/)[0];
                                    let nameB = b.split(/\s+/)[0];
                                    let tsA = timestamps[nameA] || 0;
                                    let tsB = timestamps[nameB] || 0;
                                    return tsB - tsA;
                                });
                                callback(newUpdates);
                            });
                        }
                    } catch (e) {
                        callback(newUpdates);
                    }
                });
            };
            readOutput(stdoutStream);
        } catch (e) {
            callback(newUpdates);
        }
    },

    _processUpdates: function (newUpdates) {
        let oldCount = this._updates.length;
        this._updates = newUpdates;
        this._updateUI();

        if (this._showDesktopNotifications && this._updates.length > oldCount) {
            let diff = this._updates.length - oldCount;
            Main.notify(_("Software Updates Available"), 
                _("There are " + this._updates.length + " updates available (" + diff + " new)."));
        }
    },

    on_applet_clicked: function (event) {
        this._buildMenu();
        this.menu.toggle();
    },

    _buildMenu: function () {
        this.menu.removeAll();

        let hasRepo = this._hasCheckupdates;
        let hasAur = this._checkAur && this._aurHelper && (GLib.find_program_in_path(this._aurHelper) !== null);

        if (!hasRepo && !hasAur) {
            let errorItem = new PopupMenu.PopupMenuItem(_("Please install update tools (pacman-contrib, yay, paru)!"), { reactive: false });
            this.menu.addMenuItem(errorItem);
            return;
        }

        // Header Title
        let headerText = _("Pacman Package Updates");
        if (this._dbLckExists) {
            headerText = _("Database locked (updates active)");
        } else if (this._updates.length > 0) {
            headerText += " (" + this._updates.length + ")";
        } else if (this._isChecking) {
            headerText = _("Checking for updates...");
        }
        let headerItem = new PopupMenu.PopupMenuItem(headerText, { reactive: false });
        this.menu.addMenuItem(headerItem);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Update list
        if (this._dbLckExists) {
            let activeItem = new PopupMenu.PopupMenuItem(_("Pacman is currently installing/updating..."), { reactive: false });
            this.menu.addMenuItem(activeItem);
        } else if (this._isChecking) {
            let loadingItem = new PopupMenu.PopupMenuItem(_("Syncing package list..."), { reactive: false });
            this.menu.addMenuItem(loadingItem);
        } else if (this._updates.length === 0) {
            let cleanItem = new PopupMenu.PopupMenuItem(_("All packages are up to date!"), { reactive: false });
            this.menu.addMenuItem(cleanItem);
        } else {
            // Display first 20 updates
            let maxItems = 20;
            let count = 0;
            for (let line of this._updates) {
                if (count >= maxItems) break;
                
                // Format: pkgname oldversion -> newversion
                let parts = line.split(/\s+/);
                let pkgLabel = line;
                if (parts.length >= 4 && parts[2] === "->") {
                    pkgLabel = parts[0] + " (" + parts[1] + " → " + parts[3] + ")";
                }

                let menuItem = new PopupMenu.PopupMenuItem(pkgLabel, { reactive: false });
                this.menu.addMenuItem(menuItem);
                count++;
            }

            if (this._updates.length > maxItems) {
                let remaining = this._updates.length - maxItems;
                let moreItem = new PopupMenu.PopupMenuItem(_("... and " + remaining + " more packages"), { reactive: false });
                this.menu.addMenuItem(moreItem);
            }
        }

        // Action Options
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        let refreshItem = new PopupMenu.PopupIconMenuItem(_("Check for Updates"), "view-refresh-symbolic", St.IconType.SYMBOLIC);
        refreshItem.connect('activate', () => this._checkUpdates());
        if (this._isChecking || this._dbLckExists) {
            refreshItem.setSensitive(false);
        }
        this.menu.addMenuItem(refreshItem);

        let applyItem = new PopupMenu.PopupIconMenuItem(_("Apply Updates (Terminal)"), "system-run-symbolic", St.IconType.SYMBOLIC);
        applyItem.connect('activate', () => this._applyUpdates());
        if (this._updates.length === 0 || this._isChecking || this._dbLckExists) {
            applyItem.setSensitive(false);
        }
        this.menu.addMenuItem(applyItem);
    },

    _applyUpdates: function () {
        let term = this._terminalEmulator;
        let cmd = this._updateCommand;
        
        try {
            if (term === "gnome-terminal") {
                Util.spawn(["gnome-terminal", "--", "sh", "-c", cmd + "; echo; echo 'Press Enter to close...'; read"]);
            } else if (term === "kitty") {
                Util.spawn(["kitty", "sh", "-c", cmd + "; echo; echo 'Press Enter to close...'; read"]);
            } else if (term === "konsole") {
                Util.spawn(["konsole", "-e", "sh", "-c", cmd + "; echo; echo 'Press Enter to close...'; read"]);
            } else if (term === "alacritty") {
                Util.spawn(["alacritty", "-e", "sh", "-c", cmd + "; echo; echo 'Press Enter to close...'; read"]);
            } else {
                Util.spawn([term, "-e", "sh", "-c", cmd + "; echo; echo 'Press Enter to close...'; read"]);
            }
        } catch (e) {
            global.logError("Failed to launch terminal to update: " + e);
            Main.notify(_("Update Error"), _("Could not launch terminal. Try running '" + cmd + "' manually."));
        }
    },

    on_applet_removed_from_panel: function () {
        if (this._checkTimeoutId) {
            Mainloop.source_remove(this._checkTimeoutId);
            this._checkTimeoutId = null;
        }
        if (this._lckTimeoutId) {
            Mainloop.source_remove(this._lckTimeoutId);
            this._lckTimeoutId = null;
        }
        if (this._pacmanMonitor) {
            if (this._pacmanMonitorId) {
                this._pacmanMonitor.disconnect(this._pacmanMonitorId);
                this._pacmanMonitorId = 0;
            }
            this._pacmanMonitor.cancel();
            this._pacmanMonitor = null;
        }
    }
};

function main(metadata, orientation, panel_height, instance_id) {
    return new MyApplet(metadata, orientation, panel_height, instance_id);
}
