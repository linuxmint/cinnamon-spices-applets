const Applet = imports.ui.applet;
const Soup = imports.gi.Soup;
const ByteArray = imports.byteArray;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Mainloop = imports.mainloop;
const Lang = imports.lang;
const Util = imports.misc.util;
const Settings = imports.ui.settings;
const PopupMenu = imports.ui.popupMenu;

const SAVE_IMAGE_PATH = `${GLib.get_home_dir()}/Pictures/`;

const ANIME_URL = 'https://www.loliapi.com/acg/pc/';

let _httpSession;
if (Soup.MAJOR_VERSION == 2) {
    _httpSession = new Soup.SessionAsync();
    Soup.Session.prototype.add_feature.call(_httpSession, new Soup.ProxyResolverDefault());
} else { //version 3
    _httpSession = new Soup.Session();
}

const LOG_LEVELS = {
    ERROR: 0,
    WARNING: 1,
    INFO: 2,
    DEBUG: 3
};

let currentLogLevel = LOG_LEVELS.INFO; // Default log level

function setLogLevel(level) {
    if (LOG_LEVELS.hasOwnProperty(level)) {
        currentLogLevel = LOG_LEVELS[level];
    } else {
        global.log(`[anime-wallpaper@flyflyan]: Invalid log level: ${level}`);
    }
}

function log(level, message) {
    if (LOG_LEVELS[level] <= currentLogLevel) {
        global.log(`[anime-wallpaper@flyflyan: ${level}]: ${message}`);
    }
}

// Set log level
setLogLevel('INFO');

class AnimeWallpaperApplet extends Applet.TextIconApplet {
    constructor(metadata, orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        this.setAllowedLayout(Applet.AllowedLayout.BOTH);
        this.detecting = false;
        this.set_applet_icon_symbolic_name("image-x-generic");
        this.set_applet_tooltip('Anime Desktop Wallpaper');

        this.settings = new Settings.AppletSettings(this, metadata.uuid, instance_id);

        // Path to store data in
        this.wallpaperDir = `${GLib.get_user_config_dir()}/animewallpaper`;
        let dir = Gio.file_new_for_path(this.wallpaperDir);
        if (!dir.query_exists(null))
            dir.make_directory(null);
        this.wallpaperPath = `${this.wallpaperDir}/AnimeWallpaper`;

        this.autoRefresh = true;
        this.saveImage = true;
        this.saveImagePath = SAVE_IMAGE_PATH;
        this.reloadTime = 600;
        this.click = true;
        this.apiUrl = ANIME_URL;

        this._bind_settings();

        // get Settings
        this._on_settings_changed();

        //Context menu
        this._add_context_menu();

        // Begin refresh loop
        this._refresh();
    }

    _bind_settings() {
        for (let [binding, property_name, callback] of [
            [Settings.BindingDirection.IN, "resource", this._on_settings_changed],
            [Settings.BindingDirection.IN, "saveImage", this._on_settings_changed],
            [Settings.BindingDirection.IN, "saveImagePath", this._on_settings_changed],
            [Settings.BindingDirection.IN, "slideshow", this._on_settings_changed],
            [Settings.BindingDirection.IN, "delay", this._on_settings_changed],
            [Settings.BindingDirection.IN, "click", this._on_settings_changed]]) {
            this.settings.bindProperty(binding, property_name, property_name, callback, null);
        }
    }

    _add_context_menu() {
        this.saveImageOption = new PopupMenu.PopupSwitchMenuItem(_('Automatically save background images'), this.saveImage);
        this.saveImageOption.connect('toggled', Lang.bind(this, this._on_save_image_changed));
        this._applet_context_menu.addMenuItem(this.saveImageOption);

        this.autoRefreshOption = new PopupMenu.PopupSwitchMenuItem(_('Play backgrounds as a slideshow'), this.autoRefresh);
        this.autoRefreshOption.connect('toggled', Lang.bind(this, this._on_auto_refresh_changed));
        this._applet_context_menu.addMenuItem(this.autoRefreshOption);

        this.clickOption = new PopupMenu.PopupSwitchMenuItem(_('Enable click to switch images'), this.click);
        this.clickOption.connect('toggled', Lang.bind(this, this._on_click_changed));
        this._applet_context_menu.addMenuItem(this.clickOption);
    }

    _on_save_image_changed() {
        log('DEBUG', "_on_save_image_changed:active");
        log('DEBUG', this.settings.getValue("saveImage"));
        if (this.settings.getValue("saveImage")) {
            this.settings.setValue("saveImage", false);
            log('INFO', "_on_save_image_changed " + "get saveImage " + this.settings.getValue("saveImage"));
        } else {
            this.settings.setValue("saveImage", true);
            log('INFO', "_on_save_image_changed " + "get saveImage " + this.settings.getValue("saveImage"));
        }

        this._on_settings_changed();
    }

    _on_auto_refresh_changed() {
        log('DEBUG', "_on_auto_refresh_changed:active");
        log('DEBUG', this.settings.getValue("slideshow"));
        if (this.settings.getValue("slideshow")) {
            this.settings.setValue("slideshow", false);
            log('INFO', "_on_auto_refresh_changed " + "get slideshow " + this.settings.getValue("slideshow"));
        } else {
            this.settings.setValue("slideshow", true);
            log('INFO', "_on_auto_refresh_changed " + "get slideshow " + this.settings.getValue("slideshow"));
        }

        this._on_settings_changed();
    }

    _on_click_changed() {
        log('DEBUG', "_on_click_changed:active");
        log('DEBUG', this.settings.getValue("click"));
        if (this.settings.getValue("click")) {
            this.settings.setValue("click", false);
            log('INFO', "_on_save_image_changed " + "get click " + this.settings.getValue("click"));
        } else {
            this.settings.setValue("click", true);
            log('INFO', "_on_save_image_changed " + "get click " + this.settings.getValue("click"));
        }

        this._on_settings_changed();
    }

    _on_settings_changed() {
        log('DEBUG', "_on_settings_changed");
        log('DEBUG', this.settings.getValue("resource"));
        log('DEBUG', this.settings.getValue("slideshow"));
        log('DEBUG', this.settings.getValue("saveImage"));
        log('DEBUG', this.settings.getValue("saveImagePath"));
        log('DEBUG', this.settings.getValue("delay"));
        log('DEBUG', this.settings.getValue("click"));

        this.autoRefresh = (this.settings.getValue("slideshow") != null) ? this.settings.getValue("slideshow") : true;
        this.saveImage = (this.settings.getValue("saveImage") != null) ? this.settings.getValue("saveImage") : true;
        this.reloadTime = (this.settings.getValue("delay") != null) ? this.settings.getValue("delay") * 60 : 600;
        this.click = (this.settings.getValue("click") != null) ? this.settings.getValue("click") : true;

        let apiURL = this.settings.getValue("resource");
        if ((apiURL != null) && (apiURL != "")) {
            this.apiUrl = apiURL;
            log('INFO', "resource:" + apiURL);
        } else {
            log('WARNING', "not set apiURL, set to " + ANIME_URL);
            this.apiUrl = ANIME_URL;
        }

        let saveImagePath = this.settings.getValue("saveImagePath");
        if ((saveImagePath != null) && (saveImagePath != "")) {
            this.saveImagePath = saveImagePath;
        } else {
            log('WARNING', "not set saveImagePath, set to " + SAVE_IMAGE_PATH);
            this.saveImagePath = SAVE_IMAGE_PATH;
            if (this.saveImage) {
                this.settings.setValue("saveImagePath", SAVE_IMAGE_PATH);
            }
        }

        log('DEBUG', this.apiUrl);
        this.set_applet_tooltip(this.apiUrl);
        this.saveImagePath = this.saveImagePath.replace("file://", "");
        log('DEBUG', this.saveImagePath);

        log('DEBUG', "set auto-refresh");
        this._remove_timeout();
        if (this.autoRefresh) {
            this._set_timeout(this.reloadTime);
        }

        // update context menu state
        if (this.saveImageOption)
            this.saveImageOption.setToggleState(this.saveImage);
        if (this.autoRefreshOption)
            this.autoRefreshOption.setToggleState(this.autoRefresh);
        if (this.clickOption)
            this.clickOption.setToggleState(this.click);
    }

    _remove_timeout() {
        if (this._timeout) {
            Mainloop.source_remove(this._timeout);
            this._timeout = null;
        }
    }

    _set_timeout(seconds) {
        /** Cancel current timeout in event of an error and try again shortly */
        this._remove_timeout();
        log('DEBUG', `Setting timeout (${seconds}s)`);
        this._timeout = Mainloop.timeout_add_seconds(seconds, Lang.bind(this, this._refresh));
    }

    _refresh() {
        log('DEBUG', 'Beginning refresh');
        this._download_image();

        if (this.autoRefresh) {
            this._set_timeout(this.reloadTime);
        } else {
            this._remove_timeout();
        }
    }

    _download_image() {
        log('DEBUG', 'downloading new image');
        let gFile = Gio.file_new_for_path(this.wallpaperPath);
        let url = this.apiUrl;
        // open the file
        let fStream = gFile.replace(null, false, Gio.FileCreateFlags.NONE, null);

        // create a http message
        let request = Soup.Message.new('GET', url);

        // keep track of total bytes written
        let bytesTotal = 0;

        if (Soup.MAJOR_VERSION === 2) {
            // got_chunk event
            request.connect('got_chunk', function (message, chunk) {
                if (message.status_code === 200) { // only save the data we want, not content of 301 redirect page
                    bytesTotal += fStream.write(chunk.get_data(), null);
                }
            });

            // queue the http request
            _httpSession.queue_message(request, (httpSession, message) => {
                // request completed
                fStream.close(null);
                const contentLength = message.response_headers.get_content_length();
                if (message.status_code === 200 && contentLength === bytesTotal) {
                    this._set_background();
                } else {
                    log('ERROR', "Couldn't fetch image from " + url);
                    gFile.delete(null);
                    this._set_timeout(60)  // Try again
                }
            });
        } else { //version 3
            _httpSession.send_and_read_async(request, Soup.MessagePriority.NORMAL, null, (httpSession, message) => {
                if (request.get_status() === 200) {
                    const bytes = _httpSession.send_and_read_finish(message);
                    if (bytes && bytes.get_size() > 0) {
                        fStream.write(bytes.get_data(), null);
                    }
                    // request completed
                    fStream.close(null);
                    log('DEBUG', 'Download successful');
                    this._set_background();
                } else {
                    log('ERROR', "Couldn't fetch image from " + url);
                    this._set_timeout(60)  // Try again
                }
            });
        }
    }

    _save_image() {
        let sourceUri = 'file://' + this.wallpaperPath;

        // Create a GFile object for the specified URI
        let sourceFile = Gio.File.new_for_uri(sourceUri);
        // Query the file info
        let fileInfo = sourceFile.query_info('standard::*', Gio.FileQueryInfoFlags.NONE, null);
        // Get the MIME type
        let mimeType = fileInfo.get_content_type();

        log('DEBUG', 'The MIME type of the file is: ' + mimeType.slice(6));

        let [success, contents] = sourceFile.load_contents(null);
        if (!success) {
            log('ERROR', "Read file failed");
        }

        let md5Hash = GLib.compute_checksum_for_data(GLib.ChecksumType.MD5, contents);

        if (!md5Hash) {
            log('ERROR', "Create MD5 failed");
        }
        log('DEBUG', "MD5: " + md5Hash);

        let saveUri = 'file://' + this.saveImagePath + '/' + md5Hash + '.' + mimeType.slice(6);
        let destinationFile = Gio.File.new_for_uri(saveUri);
        try {
            // Copy the file
            sourceFile.copy(destinationFile, Gio.FileCopyFlags.OVERWRITE, null, null);
            log('DEBUG', 'File copied from ' + sourceUri + ' to ' + saveUri);
        } catch (e) {
            log('ERROR', 'Error copying file: ' + e.message);
        }
    }

    _set_background() {

        let gSetting = new Gio.Settings({ schema: 'org.cinnamon.desktop.background' });
        let wallpaperUri = 'file://' + this.wallpaperPath;
        log('DEBUG', 'wallpaperUri: ' + wallpaperUri);

        if (this.saveImage) {
            this._save_image();
        }

        Util.spawn_async(['dwebp', this.wallpaperPath, '-o', this.wallpaperPath], Lang.bind(this, function (out) {
            log('DEBUG', "The conversion was successful using dewbp")
        }));

        gSetting.set_string('picture-uri', wallpaperUri);
        gSetting.set_string('picture-options', 'zoom');
        Gio.Settings.sync();
        gSetting.apply();

    }

    destroy() {
        this._remove_timeout();
    }

    on_applet_removed_from_panel() {
        this._remove_timeout();
    }

    // Override
    on_applet_clicked(event) {
        if (this.click) {
            this._refresh();
        }
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new AnimeWallpaperApplet(metadata, orientation, panel_height, instance_id);
}
