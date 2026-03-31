// Bing-Daily 
// Copyright (c) 2026 Keith Driscoll
// https://keithdriscoll.nyc/projects/bing-daily
// Licensed under the MIT License. See LICENSE file for details.

// Bing Daily Cinnamon Applet
// Works on Cinnamon 5.x (Mint 21.x) and Cinnamon 6.x (Mint 22.x).
// All network operations are delegated to the Python engine via subprocess —
// no Soup import is needed and there are no Soup2/Soup3 compatibility issues.

const Applet = imports.ui.applet;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const St = imports.gi.St;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;
const Util = imports.misc.util;
const Gettext = imports.gettext;

// Cinnamon version (informational — no Soup-related branching needed)
const CINNAMON_VERSION = imports.misc.config.PACKAGE_VERSION;
const CINNAMON_MAJOR = parseInt(CINNAMON_VERSION.split('.')[0]);

// Translations
const UUID = "bing-daily@keithdriscoll.nyc";
Gettext.bindtextdomain(UUID, GLib.get_user_data_dir() + "/locale");
function _(text) {
    return Gettext.dgettext(UUID, text);
}

// ---------------------------------------------------------------------------
// Applet class
// ---------------------------------------------------------------------------

class BingWallpaperApplet extends Applet.IconApplet {

    constructor(metadata, orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        this.metadata = metadata;
        this._enginePath = metadata.path + '/engine/bing_engine.py';

        // Panel icon — symbolic SVG follows panel text colour on supporting themes
        try {
            this.set_applet_icon_path(metadata.path + '/icons/bing-daily-symbolic.svg');
        } catch (e) {
            // Fall back to a named icon if the SVG is missing
            this.set_applet_icon_name('photo');
        }
        this.set_applet_tooltip(_("Bing Daily"));

        // Settings
        this.settings = new Settings.AppletSettings(
            this, 'bing-daily@keithdriscoll.nyc', this.instance_id
        );
        this.settings.bindProperty(
            Settings.BindingDirection.IN,
            'auto_update', 'auto_update',
            this._onSettingsChanged.bind(this), null
        );
        this.settings.bindProperty(
            Settings.BindingDirection.IN,
            'update_time', 'update_time',
            this._onSettingsChanged.bind(this), null
        );
        this.settings.bindProperty(
            Settings.BindingDirection.IN,
            'frequency', 'frequency',
            this._onSettingsChanged.bind(this), null
        );
        this.settings.bindProperty(
            Settings.BindingDirection.IN,
            'region', 'region',
            this._onSettingsChanged.bind(this), null
        );
        this.settings.bindProperty(
            Settings.BindingDirection.IN,
            'history_limit', 'history_limit',
            this._onSettingsChanged.bind(this), null
        );

        // Build menu
        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);
        this._buildMenu();

        // Silently refresh on startup — only notify if a new image is downloaded
        this._runEngine(['refresh'], (exitCode, stdout, stderr) => {
            this._handleRefreshResult(exitCode, stdout, stderr, /*silent=*/true);
        });

        // Re-refresh silently on any network connect event (including reconnecting to the same network)
        this._networkMonitor = Gio.NetworkMonitor.get_default();
        this._networkRefreshTimeout = null;
        this._networkChangedId = this._networkMonitor.connect('network-changed', (monitor, available) => {
            if (available) {
                // Debounce: cancel any pending refresh so rapid signals don't stack up
                if (this._networkRefreshTimeout) {
                    GLib.source_remove(this._networkRefreshTimeout);
                    this._networkRefreshTimeout = null;
                }
                // Wait 5s for connection to stabilize before refreshing
                this._networkRefreshTimeout = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 5, () => {
                    this._networkRefreshTimeout = null;
                    this._runEngine(['refresh'], (exitCode, stdout, stderr) => {
                        this._handleRefreshResult(exitCode, stdout, stderr, /*silent=*/true);
                    });
                    return GLib.SOURCE_REMOVE;
                });
            }
        });
    }

    // -----------------------------------------------------------------------
    // Menu
    // -----------------------------------------------------------------------

    _buildMenu() {
        this.menu.removeAll();

        // Refresh Now
        let refreshItem = new PopupMenu.PopupMenuItem(_("Refresh Now"));
        refreshItem.connect('activate', () => {
            this._runEngine(['refresh'], (exitCode, stdout, stderr) => {
                this._handleRefreshResult(exitCode, stdout, stderr, /*silent=*/false);
            });
        });
        this.menu.addMenuItem(refreshItem);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Previous Image (older)
        let prevItem = new PopupMenu.PopupMenuItem(_("\u25C0 Previous Image"));
        prevItem.connect('activate', () => {
            this._runEngine(['prev'], (exitCode, stdout, stderr) => {
                this._handleNavResult(exitCode, stdout, stderr);
            });
        });
        this.menu.addMenuItem(prevItem);

        // Next Image (newer)
        let nextItem = new PopupMenu.PopupMenuItem(_("\u25B6 Next Image"));
        nextItem.connect('activate', () => {
            this._runEngine(['next'], (exitCode, stdout, stderr) => {
                this._handleNavResult(exitCode, stdout, stderr);
            });
        });
        this.menu.addMenuItem(nextItem);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Open Current Image
        let openItem = new PopupMenu.PopupMenuItem(_("Open Current Image"));
        openItem.connect('activate', () => {
            this._runEngine(['open'], (exitCode, stdout, stderr) => {
                if (exitCode !== 0) {
                    this._notify(_("Error opening image — see log for details"));
                }
            });
        });
        this.menu.addMenuItem(openItem);

        // Image Info
        let infoItem = new PopupMenu.PopupMenuItem(_("Image Info"));
        infoItem.connect('activate', () => {
            this._runEngine(['info'], (exitCode, stdout, stderr) => {
                if (exitCode === 0 && stdout) {
                    try {
                        let info = JSON.parse(stdout);
                        let msg = info.title || _("No title");
                        if (info.copyright) msg += "\n" + info.copyright;
                        this._notify(msg);
                    } catch (e) {
                        this._notify(stdout.substring(0, 200));
                    }
                } else {
                    this._notify(_("Could not retrieve image info"));
                }
            });
        });
        this.menu.addMenuItem(infoItem);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Populate History
        let populateItem = new PopupMenu.PopupMenuItem(_("Populate History"));
        populateItem.connect('activate', () => {
            this._notify(_("Downloading wallpaper history..."));
            this._runEngine(['populate'], (exitCode, stdout, stderr) => {
                if (exitCode !== 0) {
                    this._notify(_("Bing Daily: Error during populate — see log for details"));
                } else if (stdout.startsWith('populated:')) {
                    let parts = stdout.split(':');
                    let dl = parseInt(parts[1]) || 0;
                    let failed = parseInt(parts[2]) || 0;
                    let msg = _("%d image(s) downloaded").format(dl);
                    if (failed > 0) msg += _(", %d failed").format(failed);
                    this._notify(msg);
                }
            });
        });
        this.menu.addMenuItem(populateItem);

        // Clear All Images
        let clearItem = new PopupMenu.PopupMenuItem(_("Clear All Images"));
        clearItem.connect('activate', () => {
            this._runEngine(['clear'], (exitCode, stdout, stderr) => {
                if (exitCode !== 0) {
                    this._notify(_("Bing Daily: Error during clear — see log for details"));
                } else {
                    this._notify(_("All images cleared"));
                }
            });
        });
        this.menu.addMenuItem(clearItem);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Settings
        let settingsItem = new PopupMenu.PopupMenuItem(_("Settings"));
        settingsItem.connect('activate', () => {
            this._openSettings();
        });
        this.menu.addMenuItem(settingsItem);

        // About
        let aboutItem = new PopupMenu.PopupMenuItem(_("About"));
        aboutItem.connect('activate', () => {
            this._notify(
                _("Bing Daily v1.0.1\nBy Keith Driscoll\nSets your desktop to the Bing Image of the Day.\nWorks on Cinnamon 5.x and 6.x.")
            );
        });
        this.menu.addMenuItem(aboutItem);
    }

    // -----------------------------------------------------------------------
    // Engine runner
    // -----------------------------------------------------------------------

    _runEngine(args, callback) {
        try {
            let proc = new Gio.Subprocess({
                argv: ['/usr/bin/python3', this._enginePath].concat(args),
                flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
            });
            proc.init(null);
            proc.communicate_utf8_async(null, null, (proc, res) => {
                try {
                    let [, stdout, stderr] = proc.communicate_utf8_finish(res);
                    let exitCode = proc.get_exit_status();
                    if (callback) {
                        callback(
                            exitCode,
                            stdout ? stdout.trim() : '',
                            stderr ? stderr.trim() : ''
                        );
                    }
                } catch (e) {
                    global.logError('BingWallpaper: subprocess result error: ' + e);
                }
            });
        } catch (e) {
            global.logError('BingWallpaper: failed to launch engine: ' + e);
            if (callback) callback(1, '', String(e));
        }
    }

    // -----------------------------------------------------------------------
    // Result handlers
    // -----------------------------------------------------------------------

    _handleRefreshResult(exitCode, stdout, stderr, silent) {
        if (exitCode !== 0) {
            // Always notify on error — never silent
            if (stderr && stderr.toLowerCase().includes('network')) {
                this._notify(_("Bing Daily: Network error — check your connection"));
            } else {
                this._notify(
                    _("Bing Daily: Error — see ~/.cache/bing-daily/log.txt")
                );
            }
            return;
        }

        if (stdout.includes("Wallpaper set to today's image")) {
            if (!silent) {
                this._notify(_("Wallpaper set to today's image"));
            }
            // silent=true on startup: do not notify when already up to date
        } else {
            // New image was downloaded — always notify
            this._notify(_("Wallpaper updated"));
        }
    }

    _handleNavResult(exitCode, stdout, stderr) {
        if (exitCode !== 0) {
            if (stderr && stderr.toLowerCase().includes('network')) {
                this._notify(_("Bing Daily: Network error — check your connection"));
            } else {
                this._notify(
                    _("Bing Daily: Error — see ~/.cache/bing-daily/log.txt")
                );
            }
            return;
        }

        if (stdout === 'BOUNDARY:oldest') {
            this._notify(_("Already at oldest image"));
        } else if (stdout === 'BOUNDARY:newest') {
            this._notify(_("Already at newest image"));
        }
        // Otherwise wallpaper changed silently — no notification needed
    }

    // -----------------------------------------------------------------------
    // Notifications
    // -----------------------------------------------------------------------

    _notify(message) {
        Main.notify(_("Bing Daily"), message);
    }

    // -----------------------------------------------------------------------
    // Settings change handler
    // -----------------------------------------------------------------------

    _onSettingsChanged() {
        let config = {
            region: (this.region !== undefined && this.region !== null) ? this.region : 'us',
            history_limit: this.history_limit || 30,
            frequency: this.frequency || 'daily'
        };
        let configDir = GLib.get_user_config_dir() + '/bing-daily';
        GLib.mkdir_with_parents(configDir, 0o755);
        let configPath = configDir + '/config.json';
        let file = Gio.File.new_for_path(configPath);
        let bytes = GLib.Bytes.new(JSON.stringify(config, null, 2));
        file.replace_contents_async(bytes.get_data(), null, false,
            Gio.FileCreateFlags.REPLACE_DESTINATION, null, (f, res) => {
                try {
                    f.replace_contents_finish(res);
                    f.set_attribute_uint32('unix::mode', 0o600,
                        Gio.FileQueryInfoFlags.NONE, null);
                } catch (e) {
                    global.logError('BingWallpaper: failed to write config: ' + e);
                }
            });

        // Compute time string from update_time (seconds since midnight)
        let hours = Math.floor(this.update_time / 3600).toString().padStart(2, '0');
        let minutes = Math.floor((this.update_time % 3600) / 60).toString().padStart(2, '0');
        let timeString = hours + ':' + minutes;

        // Build OnCalendar expression based on frequency
        let onCalendar;
        if (this.frequency === 'weekly') {
            onCalendar = 'Mon *-*-* ' + timeString + ':00';
        } else if (this.frequency === 'monthly') {
            onCalendar = '*-*-01 ' + timeString + ':00';
        } else {
            onCalendar = '*-*-* ' + timeString + ':00';
        }

        // Write the systemd timer file dynamically
        let timerContent = '[Unit]\nDescription=Bing Daily Wallpaper Refresh Timer\n\n[Timer]\nOnCalendar=' + onCalendar + '\nPersistent=true\nUnit=bing-daily.service\n\n[Install]\nWantedBy=timers.target\n';
        let timerPath = GLib.get_user_config_dir() + '/systemd/user/bing-daily.timer';
        let timerFile = Gio.File.new_for_path(timerPath);
        let timerBytes = GLib.Bytes.new(timerContent);
        timerFile.replace_contents_async(timerBytes.get_data(), null, false,
            Gio.FileCreateFlags.REPLACE_DESTINATION, null, (f, res) => {
                try {
                    f.replace_contents_finish(res);
                } catch (e) {
                    global.logError('BingWallpaper: failed to write timer: ' + e);
                }
                // Reload systemd timer after file is written
                Util.spawn(['systemctl', '--user', 'daemon-reload']);
                if (this.auto_update) {
                    Util.spawn(['systemctl', '--user', 'enable', '--now', 'bing-daily.timer']);
                } else {
                    Util.spawn(['systemctl', '--user', 'disable', '--now', 'bing-daily.timer']);
                }
            });
    }

    // -----------------------------------------------------------------------
    // Settings launcher
    // -----------------------------------------------------------------------

    _openSettings() {
        Util.spawn(['cinnamon-settings', 'applets']);
    }

    // -----------------------------------------------------------------------
    // Applet click
    // -----------------------------------------------------------------------

    on_applet_clicked() {
        this.menu.toggle();
    }

    // -----------------------------------------------------------------------
    // Cleanup
    // -----------------------------------------------------------------------

    on_applet_removed_from_panel() {
        Util.spawn(['systemctl', '--user', 'disable', '--now', 'bing-daily.timer']);
        if (this._networkRefreshTimeout) {
            GLib.source_remove(this._networkRefreshTimeout);
            this._networkRefreshTimeout = null;
        }
        if (this._networkChangedId) {
            this._networkMonitor.disconnect(this._networkChangedId);
            this._networkChangedId = null;
        }
        if (this.settings) {
            this.settings.finalize();
        }
    }
}

// ---------------------------------------------------------------------------
// Factory function required by Cinnamon
// ---------------------------------------------------------------------------

function main(metadata, orientation, panel_height, instance_id) {
    return new BingWallpaperApplet(metadata, orientation, panel_height, instance_id);
}
