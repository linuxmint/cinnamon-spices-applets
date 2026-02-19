/**
 * applet.js — Essentials Backgrounds for Cinnamon
 *
 * Fetches wallpapers from Bing, Unsplash, and other sources,
 * then periodically sets them as the desktop background.
 *
 * @author Luan Schons Griebler <luan@twizer.com.br>
 * @license MIT
 * @see https://github.com/Luan1Schons/cinnamon-essentials-backgrounds
 */

const Applet = imports.ui.applet;
const Settings = imports.ui.settings;
const PopupMenu = imports.ui.popupMenu;
const Main = imports.ui.main;
const MessageTray = imports.ui.messageTray;
const Util = imports.misc.util;
const Lang = imports.lang;
const St = imports.gi.St;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Gettext = imports.gettext;

const UUID = "essentials-backgrounds@luanschons";

// i18n
Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");
function _(str) {
    return Gettext.dgettext(UUID, str);
}

// Import providers relative to applet directory
const AppletDir = imports.ui.appletManager.appletMeta[UUID].path;
imports.searchPath.unshift(AppletDir);
const Providers = imports.providers;

const WALLPAPER_DIR = GLib.build_filenamev([GLib.get_user_cache_dir(), "essentials-backgrounds"]);
const FAVORITES_DIR = GLib.build_filenamev([GLib.get_home_dir(), "Pictures", "Essentials Backgrounds"]);
const MAX_HISTORY = 5;

class EssentialsBackgroundsApplet extends Applet.IconApplet {

    constructor(metadata, orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId);

        this.metadata = metadata;
        this._timerId = null;
        this._paused = false;
        this._currentInfo = null;
        this._currentFilePath = null;
        this._history = []; // { filePath, info }

        // --- Settings ---
        this.settings = new Settings.AppletSettings(this, UUID, instanceId);

        this.settings.bind("provider", "provider", this._onProviderChanged.bind(this));
        this.settings.bind("interval", "interval", this._onIntervalChanged.bind(this));
        this.settings.bind("auto-start", "autoStart");
        this.settings.bind("notification", "showNotification");
        this.settings.bind("unsplash-api-key", "unsplashApiKey", this._onUnsplashSettingsChanged.bind(this));
        this.settings.bind("unsplash-query", "unsplashQuery", this._onUnsplashSettingsChanged.bind(this));

        // Effects
        this.settings.bind("effect-blur", "effectBlur");
        this.settings.bind("effect-blur-radius", "effectBlurRadius");
        this.settings.bind("effect-brightness", "effectBrightness");
        this.settings.bind("effect-brightness-value", "effectBrightnessValue");
        this.settings.bind("effect-grayscale", "effectGrayscale");
        this.settings.bind("effect-vignette", "effectVignette");
        this.settings.bind("effect-sepia", "effectSepia");
        this.settings.bind("effect-saturation", "effectSaturation");
        this.settings.bind("effect-saturation-value", "effectSaturationValue");
        this.settings.bind("effect-contrast", "effectContrast");
        this.settings.bind("effect-contrast-value", "effectContrastValue");

        // --- Screen resolution ---
        this._screenWidth = 1920;
        this._screenHeight = 1080;
        this._detectResolution();

        // --- Providers ---
        this._providers = {
            bing: new Providers.BingProvider(),
            wallhaven: new Providers.WallhavenProvider(),
            nasa: new Providers.NasaApodProvider(),
            picsum: new Providers.PicsumProvider(),
            unsplash: new Providers.UnsplashProvider(this.unsplashApiKey, this.unsplashQuery)
        };

        // --- Background Settings ---
        this._bgSettings = new Gio.Settings({ schema_id: "org.cinnamon.desktop.background" });

        // --- Ensure directories ---
        this._ensureDir(WALLPAPER_DIR);
        this._ensureDir(FAVORITES_DIR);

        // --- Build UI ---
        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);

        this._buildMainMenu();
        this._buildContextMenu();
        this._updateIcon();
        this.set_applet_tooltip(_("Essentials Backgrounds"));

        // --- Auto-start ---
        if (this.autoStart) {
            GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 10, () => {
                this._fetchAndApply();
                this._startTimer();
                return GLib.SOURCE_REMOVE;
            });
        }
    }

    // ========================
    //  Screen Resolution
    // ========================

    _detectResolution() {
        try {
            let display = global.display || global.screen;
            if (display) {
                let monitor = display.get_current_monitor ? display.get_current_monitor() : 0;
                let rect = null;
                if (global.display && global.display.get_monitor_geometry) {
                    rect = global.display.get_monitor_geometry(monitor);
                } else if (global.screen && global.screen.get_monitor_geometry) {
                    rect = global.screen.get_monitor_geometry(monitor);
                }
                if (rect) {
                    this._screenWidth = rect.width;
                    this._screenHeight = rect.height;
                }
            }
        } catch (e) {
            global.logWarning("[EssentialsBackgrounds] Could not detect resolution: " + e.message);
        }
    }

    getScreenWidth() { return this._screenWidth; }
    getScreenHeight() { return this._screenHeight; }

    // ========================
    //  Main Menu (left-click)
    // ========================

    _buildMainMenu() {
        // --- Change background now ---
        let changeNowItem = new PopupMenu.PopupIconMenuItem(
            _("Change Background Now"),
            "media-skip-forward-symbolic",
            St.IconType.SYMBOLIC
        );
        changeNowItem.connect("activate", () => this._fetchAndApply());
        this.menu.addMenuItem(changeNowItem);

        // --- Favorite current ---
        let favoriteItem = new PopupMenu.PopupIconMenuItem(
            _("Save to Favorites"),
            "starred-symbolic",
            St.IconType.SYMBOLIC
        );
        favoriteItem.connect("activate", () => this._saveToFavorites());
        this.menu.addMenuItem(favoriteItem);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // --- Current wallpaper info ---
        this._infoMenuItem = new PopupMenu.PopupMenuItem(_("No wallpaper set yet"), { reactive: false });
        this.menu.addMenuItem(this._infoMenuItem);

        this._creditsMenuItem = new PopupMenu.PopupMenuItem("", { reactive: false });
        this.menu.addMenuItem(this._creditsMenuItem);
        this._creditsMenuItem.actor.hide();

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // --- History submenu ---
        this._historyMenu = new PopupMenu.PopupSubMenuMenuItem(_("History"));
        this._historyEmptyLabel = new PopupMenu.PopupMenuItem(_("No history yet"), { reactive: false });
        this._historyMenu.menu.addMenuItem(this._historyEmptyLabel);
        this.menu.addMenuItem(this._historyMenu);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // --- Provider indicator ---
        this._providerMenuItem = new PopupMenu.PopupMenuItem(
            _("Source: ") + this._getProviderName(),
            { reactive: false }
        );
        this.menu.addMenuItem(this._providerMenuItem);

        // --- Open cache folder ---
        let openCacheItem = new PopupMenu.PopupIconMenuItem(
            _("Open Cache Folder"),
            "folder-symbolic",
            St.IconType.SYMBOLIC
        );
        openCacheItem.connect("activate", () => {
            Util.spawnCommandLine("xdg-open '" + WALLPAPER_DIR + "'");
        });
        this.menu.addMenuItem(openCacheItem);

        // --- Open favorites folder ---
        let openFavItem = new PopupMenu.PopupIconMenuItem(
            _("Open Favorites Folder"),
            "folder-pictures-symbolic",
            St.IconType.SYMBOLIC
        );
        openFavItem.connect("activate", () => {
            Util.spawnCommandLine("xdg-open '" + FAVORITES_DIR + "'");
        });
        this.menu.addMenuItem(openFavItem);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // --- Settings ---
        let settingsItem = new PopupMenu.PopupIconMenuItem(
            _("Settings"),
            "preferences-system-symbolic",
            St.IconType.SYMBOLIC
        );
        settingsItem.connect("activate", () => {
            Util.spawnCommandLine("xlet-settings applet " + UUID);
        });
        this.menu.addMenuItem(settingsItem);
    }

    // ========================
    //  Context Menu (right-click)
    // ========================

    _buildContextMenu() {
        // --- Pause / Resume ---
        this._pauseMenuItem = new PopupMenu.PopupIconMenuItem(
            _("Pause"),
            "media-playback-pause-symbolic",
            St.IconType.SYMBOLIC
        );
        this._pauseMenuItem.connect("activate", () => this._togglePause());
        this._applet_context_menu.addMenuItem(this._pauseMenuItem);
    }

    // ========================
    //  Applet Events
    // ========================

    on_applet_clicked(event) {
        this.menu.toggle();
    }

    on_applet_removed_from_panel() {
        this._stopTimer();
        this.settings.finalize();
    }

    // ========================
    //  Timer
    // ========================

    _startTimer() {
        this._stopTimer();
        if (this._paused) return;

        let intervalSecs = this.interval * 60;
        this._timerId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, intervalSecs, () => {
            this._fetchAndApply();
            return GLib.SOURCE_CONTINUE;
        });
    }

    _stopTimer() {
        if (this._timerId) {
            GLib.source_remove(this._timerId);
            this._timerId = null;
        }
    }

    _togglePause() {
        this._paused = !this._paused;

        if (this._paused) {
            this._stopTimer();
            this._pauseMenuItem.label.set_text(_("Resume"));
            this._pauseMenuItem.setIconSymbolicName("media-playback-start-symbolic");
        } else {
            this._startTimer();
            this._fetchAndApply();
            this._pauseMenuItem.label.set_text(_("Pause"));
            this._pauseMenuItem.setIconSymbolicName("media-playback-pause-symbolic");
        }
        this._updateIcon();
    }

    // ========================
    //  Core Logic
    // ========================

    _getActiveProvider() {
        // Random mode: pick a random provider each time
        if (this.provider === "random") {
            let keys = Object.keys(this._providers).filter(k => {
                // Skip unsplash if no API key
                if (k === "unsplash" && !this.unsplashApiKey) return false;
                return true;
            });
            let idx = Math.floor(Math.random() * keys.length);
            return this._providers[keys[idx]];
        }
        return this._providers[this.provider];
    }

    _fetchAndApply() {
        let provider = this._getActiveProvider();
        if (!provider) {
            this._showError(_("Unknown provider: ") + this.provider);
            return;
        }

        this.set_applet_tooltip(_("Fetching wallpaper..."));

        provider.fetchWallpaper((error, info) => {
            if (error) {
                this._showError(error.message || String(error));
                this.set_applet_tooltip(_("Essentials Backgrounds — Error"));
                return;
            }

            let destPath = GLib.build_filenamev([WALLPAPER_DIR, info.filename]);

            // Check if already downloaded
            let destFile = Gio.File.new_for_path(destPath);
            if (destFile.query_exists(null)) {
                this._applyWallpaper(destPath, info);
                return;
            }

            Providers.downloadImage(info.url, destPath, (dlError, filePath) => {
                if (dlError) {
                    this._showError(_("Download failed: ") + (dlError.message || String(dlError)));
                    return;
                }
                this._applyWallpaper(filePath, info);
            });
        });
    }

    _applyWallpaper(filePath, info) {
        if (this._hasEffects()) {
            this._processEffects(filePath, (error, processedPath) => {
                if (error) {
                    this._showError("Effects failed: " + error.message);
                    this._setWallpaper(filePath, info);
                } else {
                    this._setWallpaper(processedPath, info);
                }
            });
        } else {
            this._setWallpaper(filePath, info);
        }
    }

    _setWallpaper(filePath, info) {
        let uri = "file://" + filePath;
        this._bgSettings.set_string("picture-uri", uri);
        this._bgSettings.set_string("picture-options", "zoom");

        // Save to history before updating current
        if (this._currentInfo && this._currentFilePath) {
            this._addToHistory(this._currentFilePath, this._currentInfo);
        }

        this._currentInfo = info;
        this._currentFilePath = filePath;
        this._updateInfoMenu(info);
        this._updateIcon();
        this.set_applet_tooltip(info.title || _("Essentials Backgrounds"));

        if (this.showNotification) {
            let source = new MessageTray.SystemNotificationSource(_("Essentials Backgrounds"));
            Main.messageTray.add(source);
            let notification = new MessageTray.Notification(
                source,
                _("Wallpaper Changed"),
                info.title + (info.credits ? "\n" + info.credits : "")
            );
            notification.setTransient(true);
            source.notify(notification);
        }

        this._cleanOldFiles(filePath);
    }

    // ========================
    //  Favorites
    // ========================

    _saveToFavorites() {
        if (!this._currentFilePath || !this._currentInfo) {
            return;
        }

        try {
            let srcFile = Gio.File.new_for_path(this._currentFilePath);
            let destFile = Gio.File.new_for_path(
                GLib.build_filenamev([FAVORITES_DIR, this._currentInfo.filename])
            );

            if (destFile.query_exists(null)) {
                return; // Already saved
            }

            srcFile.copy(destFile, Gio.FileCopyFlags.NONE, null, null);

            if (this.showNotification) {
                let source = new MessageTray.SystemNotificationSource(_("Essentials Backgrounds"));
                Main.messageTray.add(source);
                let notification = new MessageTray.Notification(
                    source,
                    _("Saved to Favorites"),
                    this._currentInfo.title || this._currentInfo.filename
                );
                notification.setTransient(true);
                source.notify(notification);
            }
        } catch (e) {
            this._showError("Favorite save failed: " + e.message);
        }
    }

    // ========================
    //  History
    // ========================

    _addToHistory(filePath, info) {
        this._history.unshift({ filePath: filePath, info: info });
        if (this._history.length > MAX_HISTORY) {
            this._history.pop();
        }
        this._rebuildHistoryMenu();
    }

    _rebuildHistoryMenu() {
        this._historyMenu.menu.removeAll();

        if (this._history.length === 0) {
            this._historyEmptyLabel = new PopupMenu.PopupMenuItem(_("No history yet"), { reactive: false });
            this._historyMenu.menu.addMenuItem(this._historyEmptyLabel);
            return;
        }

        for (let i = 0; i < this._history.length; i++) {
            let entry = this._history[i];
            let title = entry.info.title || entry.info.filename || _("Unknown");
            if (title.length > 40) title = title.substring(0, 37) + "...";

            let item = new PopupMenu.PopupMenuItem(title);
            item.connect("activate", () => {
                let file = Gio.File.new_for_path(entry.filePath);
                if (file.query_exists(null)) {
                    this._applyWallpaper(entry.filePath, entry.info);
                }
            });
            this._historyMenu.menu.addMenuItem(item);
        }
    }

    // ========================
    //  Effects Processing
    // ========================

    _hasEffects() {
        return this.effectBlur || this.effectBrightness || this.effectGrayscale
            || this.effectVignette || this.effectSepia || this.effectSaturation
            || this.effectContrast;
    }

    _processEffects(inputPath, callback) {
        let outputPath = inputPath.replace(/(\.[^.]+)$/, "_fx$1");
        let outFile = Gio.File.new_for_path(outputPath);
        if (outFile.query_exists(null)) {
            try { outFile.delete(null); } catch (e) { }
        }

        let args = ["convert", inputPath];

        // Blur
        if (this.effectBlur) {
            let r = this.effectBlurRadius || 5;
            args.push("-blur", "0x" + r);
        }

        // Brightness
        if (this.effectBrightness) {
            let val = this.effectBrightnessValue || 0;
            let brightnessPercent = 100 + val;
            args.push("-modulate", brightnessPercent + ",100,100");
        }

        // Saturation
        if (this.effectSaturation) {
            let sat = this.effectSaturationValue || 100;
            args.push("-modulate", "100," + sat + ",100");
        }

        // Contrast
        if (this.effectContrast) {
            let c = this.effectContrastValue || 0;
            if (c > 0) {
                for (let i = 0; i < Math.min(c, 5); i++) args.push("-contrast");
            } else if (c < 0) {
                for (let i = 0; i < Math.min(Math.abs(c), 5); i++) args.push("+contrast");
            }
        }

        // Grayscale
        if (this.effectGrayscale) {
            args.push("-colorspace", "Gray");
        }

        // Sepia
        if (this.effectSepia) {
            args.push("-sepia-tone", "80%");
        }

        // Vignette
        if (this.effectVignette) {
            args.push("-vignette", "0x40");
        }

        args.push(outputPath);

        try {
            let proc = Gio.Subprocess.new(
                args,
                Gio.SubprocessFlags.STDOUT_SILENCE | Gio.SubprocessFlags.STDERR_PIPE
            );
            proc.wait_check_async(null, (proc, result) => {
                try {
                    proc.wait_check_finish(result);
                    callback(null, outputPath);
                } catch (e) {
                    callback(e, null);
                }
            });
        } catch (e) {
            callback(e, null);
        }
    }

    // ========================
    //  UI Updates
    // ========================

    _updateIcon() {
        if (this._paused) {
            this.set_applet_icon_symbolic_name("media-playback-pause-symbolic");
        } else {
            let iconPath = this.metadata.path + "/icon.png";
            let iconFile = Gio.File.new_for_path(iconPath);
            if (iconFile.query_exists(null)) {
                this.set_applet_icon_path(iconPath);
            } else {
                this.set_applet_icon_symbolic_name("preferences-desktop-wallpaper");
            }
        }
    }

    _updateInfoMenu(info) {
        if (!info) return;

        let titleText = info.title || _("Unknown");
        if (titleText.length > 50) {
            titleText = titleText.substring(0, 47) + "...";
        }
        this._infoMenuItem.label.set_text("🖼 " + titleText);

        if (info.credits) {
            this._creditsMenuItem.label.set_text("📷 " + info.credits);
            this._creditsMenuItem.actor.show();
        } else {
            this._creditsMenuItem.actor.hide();
        }

        this._providerMenuItem.label.set_text(_("Source: ") + this._getProviderName());
    }

    _getProviderName() {
        let names = {
            bing: "Bing Daily", wallhaven: "Wallhaven", nasa: "NASA APOD",
            picsum: "Picsum", unsplash: "Unsplash", random: _("Random")
        };
        return names[this.provider] || this.provider;
    }

    _showError(message) {
        global.logError("[EssentialsBackgrounds] " + message);
    }

    // ========================
    //  Settings Callbacks
    // ========================

    _onProviderChanged() {
        this._providerMenuItem.label.set_text(_("Source: ") + this._getProviderName());
    }

    _onIntervalChanged() {
        if (!this._paused) {
            this._startTimer();
        }
    }

    _onUnsplashSettingsChanged() {
        if (this._providers.unsplash) {
            this._providers.unsplash.setApiKey(this.unsplashApiKey);
            this._providers.unsplash.setQuery(this.unsplashQuery);
        }
    }

    // ========================
    //  Housekeeping
    // ========================

    _ensureDir(path) {
        let dir = Gio.File.new_for_path(path);
        if (!dir.query_exists(null)) {
            try {
                dir.make_directory_with_parents(null);
            } catch (e) {
                global.logWarning("[EssentialsBackgrounds] Cannot create dir: " + path);
            }
        }
    }

    _cleanOldFiles(keepPath) {
        try {
            let dir = Gio.File.new_for_path(WALLPAPER_DIR);
            let enumerator = dir.enumerate_children("standard::name,standard::type,time::modified",
                Gio.FileQueryInfoFlags.NONE, null);

            let files = [];
            let info;
            while ((info = enumerator.next_file(null)) !== null) {
                if (info.get_file_type() === Gio.FileType.REGULAR) {
                    let fullPath = GLib.build_filenamev([WALLPAPER_DIR, info.get_name()]);
                    files.push({
                        path: fullPath,
                        modified: info.get_modification_date_time()
                    });
                }
            }
            enumerator.close(null);

            const MAX_FILES = 20;
            if (files.length > MAX_FILES) {
                files.sort((a, b) => {
                    if (!a.modified || !b.modified) return 0;
                    return b.modified.compare(a.modified);
                });

                // Also protect history files from deletion
                let protectedPaths = [keepPath];
                this._history.forEach(h => protectedPaths.push(h.filePath));

                for (let i = MAX_FILES; i < files.length; i++) {
                    if (protectedPaths.indexOf(files[i].path) === -1) {
                        let f = Gio.File.new_for_path(files[i].path);
                        try { f.delete(null); } catch (e) { }
                    }
                }
            }
        } catch (e) {
            global.logWarning("[EssentialsBackgrounds] Cleanup error: " + e.message);
        }
    }
}

function main(metadata, orientation, panelHeight, instanceId) {
    return new EssentialsBackgroundsApplet(metadata, orientation, panelHeight, instanceId);
}
