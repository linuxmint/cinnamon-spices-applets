const Applet = imports.ui.applet;
const Soup = imports.gi.Soup;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Mainloop = imports.mainloop;
const Gettext = imports.gettext;
const Lang = imports.lang;
const Settings = imports.ui.settings;
const PopupMenu = imports.ui.popupMenu;

<<<<<<< Updated upstream
const SAVE_IMAGE_PATH = `${GLib.get_home_dir()}/Pictures/`;

const ANIME_URL = 'https://www.loliapi.com/acg/pc/';
=======
const UUID = 'anime-wallpaper@flyflyan';

// Without this the applet would call the translation stub and never load the
// .mo files installed under ~/.local/share/locale or /usr/share/locale.
Gettext.bindtextdomain(UUID, `${GLib.get_home_dir()}/.local/share/locale`);

function _(text) {
    return Gettext.dgettext(UUID, text);
}

const SAVE_IMAGE_PATH = `${GLib.get_home_dir()}/Pictures/`;

/*
 * Built-in wallpaper sources.
 *
 * Probed on 2026-11-15 with libsoup (the same stack the applet uses):
 *   app.zichen.zone  -> HTTP 567 + HTML error page        => removed
 *   api.vvhan.com    -> expired TLS certificate / DNS fail => removed
 *   t.alcy.cc        -> "/" serves an HTML page, "/pc" and "/moe" serve images
 *                       => registered as "/pc"
 *   api.btstu.cn     -> https resets the connection; only plain http answers
 *                       => removed (built-in sources must use https)
 *   all others       -> HTTP 200 + real image data
 */
const DEFAULT_SOURCES = [
    { name: 'LoliAPI (loliapi.com)', url: 'https://www.loliapi.com/acg/pc/' },
    { name: '栗次元 t.alcy.cc', url: 'https://t.alcy.cc/pc' },
    { name: '樱花二次元 (dmoe.cc)', url: 'https://www.dmoe.cc/random.php' },
    { name: '保罗 paugram.com', url: 'https://api.paugram.com/wallpaper/' },
    { name: '妖狐 acg.yaohud.cn', url: 'https://acg.yaohud.cn/dm/acg.php' },
    { name: 'Jitsu moe.jitsu.top', url: 'https://moe.jitsu.top/img/?sort=pc' },
    { name: '东方 Project (paulzzh)', url: 'https://img.paulzzh.com/touhou/random' },
    { name: '栗次元镜像 t.mwm.moe', url: 'https://t.mwm.moe/pc' }
];

const DEFAULT_SOURCE_URL = DEFAULT_SOURCES[0].url;

const CLICK_SWITCH = 'switch';
const CLICK_SAVE = 'save';

/* Settings values written by older versions of this applet. */
const LEGACY_URL_FIX = {
    'https://t.alcy.cc/': 'https://t.alcy.cc/pc',
    'https://app.zichen.zone/api/acg.php': DEFAULT_SOURCE_URL,
    'https://api.vvhan.com/api/acgimg': DEFAULT_SOURCE_URL,
    'http://api.btstu.cn/sjbz/api.php': DEFAULT_SOURCE_URL
};
>>>>>>> Stashed changes

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
        log('ERROR', `Invalid log level: ${level}`);
    }
}

function log(level, message) {
    if (LOG_LEVELS[level] <= currentLogLevel) {
        global.log(`[anime-wallpaper@flyflyan: ${level}]: ${message}`);
    }
}

<<<<<<< Updated upstream
=======
/* Turn the "one URL per line" setting into a clean, de-duplicated list. */
function parse_url_list(raw) {
    let urls = [];
    if (raw == null) return urls;

    let lines = String(raw).split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
        let url = lines[i].trim();
        if (!/^https?:\/\/[^\s]+$/i.test(url)) continue;
        if (urls.indexOf(url) === -1) urls.push(url);
    }
    return urls;
}

/* Short label for a custom URL, used as the drop-down entry text. */
/* Concatenate the buffered Soup 2 chunks into a single GLib.Bytes. */
function concat_chunks(chunks, length) {
    const buffer = new Uint8Array(length);
    let offset = 0;
    for (let i = 0; i < chunks.length; i++) {
        buffer.set(chunks[i], offset);
        offset += chunks[i].length;
    }
    return GLib.Bytes.new(buffer);
}

/* Extensions must come from the payload itself now that we no longer query the
   written file's MIME type. Unknown formats fall back to "png". */
function image_extension(data) {
    const matches = (bytes) => bytes.every((byte, index) => data[index] === byte);
    if (matches([0x89, 0x50, 0x4E, 0x47])) return 'png';
    if (matches([0xFF, 0xD8, 0xFF])) return 'jpeg';
    if (matches([0x47, 0x49, 0x46, 0x38])) return 'gif';
    if (matches([0x52, 0x49, 0x46, 0x46]) && data.length > 11 &&
        data[8] === 0x57 && data[9] === 0x45 && data[10] === 0x42 && data[11] === 0x50)
        return 'webp';
    return 'png';
}

function url_host(url) {
    let match = /^https?:\/\/([^\/?#]+)/i.exec(String(url));
    return match ? match[1] : String(url);
}

>>>>>>> Stashed changes
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

        // Downloaded wallpapers are throw-away data, so keep them in the cache
        // directory instead of ~/.config (which is meant for configuration).
        this.wallpaperDir = `${GLib.get_user_cache_dir()}/${UUID}`;
        let dir = Gio.file_new_for_path(this.wallpaperDir);
        dir.make_directory_async(GLib.PRIORITY_DEFAULT, null, (source, result) => {
            try {
                source.make_directory_finish(result);
                log('DEBUG', `created wallpaper cache directory ${this.wallpaperDir}`);
            } catch (e) {
                // G_IO_ERROR_EXISTS is what happens on every start after the first one.
                log('DEBUG', 'wallpaper cache directory unusable: ' + e.message);
            }
        });
        this.wallpaperPath = `${this.wallpaperDir}/AnimeWallpaper`;

        this.autoRefresh = true;
        this.saveImage = true;
        this.saveImagePath = SAVE_IMAGE_PATH;
        this.reloadTime = 600;
        this.click = true;
        this.apiUrl = ANIME_URL;

<<<<<<< Updated upstream
=======
        // Callback bookkeeping: everything that must be torn down when the
        // applet leaves the panel.
        this._removed = false;
        this._timeout = null;
        this._retryTimeout = null;
        this._currentRequest = null;
        this._chunkHandler = 0;

        this._migratingResource = false;
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
        log('DEBUG', this.settings.getValue("slideshow"));
        if (this.settings.getValue("slideshow")) {
            this.settings.setValue("slideshow", false);
            log('INFO', "_on_auto_refresh_changed " + "get slideshow " + this.settings.getValue("slideshow"));
        } else {
            this.settings.setValue("slideshow", true);
            log('INFO', "_on_auto_refresh_changed " + "get slideshow " + this.settings.getValue("slideshow"));
=======
        this.settings.setValue("slideshow", !this.settings.getValue("slideshow"));
        this.autoRefresh = this.settings.getValue("slideshow");
        log('INFO', `slideshow -> ${this.autoRefresh}`);
        // Same reason as above: reschedule the loop ourselves.
        this._remove_timeout();
        if (this.autoRefresh) {
            this._set_timeout(this.reloadTime);
        }
    }

    /* All wallpaper sources: the built-in ones plus the user's own URLs. */
    _get_sources() {
        let sources = DEFAULT_SOURCES.slice();

        for (let i = 0; i < this.customSourceUrls.length; i++) {
            let url = this.customSourceUrls[i];
            let duplicated = false;
            for (let j = 0; j < sources.length; j++) {
                if (sources[j].url === url) {
                    duplicated = true;
                    break;
                }
            }
            if (duplicated) continue;
            sources.push({ name: _('Custom · %s').format(url_host(url)), url: url });
>>>>>>> Stashed changes
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
        this._remove_periodic_timeout();
        if (this._retryTimeout) {
            Mainloop.source_remove(this._retryTimeout);
            this._retryTimeout = null;
        }
    }

    _remove_periodic_timeout() {
        if (this._timeout) {
            Mainloop.source_remove(this._timeout);
            this._timeout = null;
        }
    }

    _set_timeout(seconds) {
        /* Arm the slideshow timer. Its callback returns GLib.SOURCE_CONTINUE, so
           the same source keeps firing instead of being torn down and rebuilt. */
        this._remove_periodic_timeout();
        log('DEBUG', `Setting timeout (${seconds}s)`);
        this._timeout = Mainloop.timeout_add_seconds(seconds, () => this._refresh());
    }

    /* One-shot retry after a failed download, tracked separately so it can never
       overwrite the periodic slideshow timer. */
    _set_retry(seconds) {
        if (this._retryTimeout) return;
        log('DEBUG', `Retrying in ${seconds}s`);
        this._retryTimeout = Mainloop.timeout_add_seconds(seconds, () => {
            this._retryTimeout = null;
            this._refresh();
            return GLib.SOURCE_REMOVE;
        });
    }

    _refresh() {
        log('DEBUG', 'Beginning refresh');
<<<<<<< Updated upstream
        this._download_image();
=======
        if (this._removed) return GLib.SOURCE_REMOVE;

        try {
            this._download_image();
        } catch (e) {
            log('ERROR', 'refresh failed: ' + e.message);
        }
>>>>>>> Stashed changes

        return this.autoRefresh ? GLib.SOURCE_CONTINUE : GLib.SOURCE_REMOVE;
    }

    _download_image() {
<<<<<<< Updated upstream
        log('DEBUG', 'downloading new image');
        let gFile = Gio.file_new_for_path(this.wallpaperPath);
        let url = this.apiUrl;
        // open the file
        let fStream = gFile.replace(null, false, Gio.FileCreateFlags.NONE, null);

        // create a http message
        let request = Soup.Message.new('GET', url);

        // keep track of total bytes written
        let bytesTotal = 0;
=======
        if (this._removed) return;

        if (this._downloading) {
            // The user may have just picked another source: remember it and start
            // over as soon as the current transfer ends.
            log('DEBUG', 'download in progress, queueing one more attempt');
            this._reloadRequested = true;
            return;
        }
        log('DEBUG', 'downloading new image');
        let url = this.apiUrl;

        // A malformed custom URL must not leave the applet stuck in "downloading".
        let request;
        try {
            request = Soup.Message.new('GET', url);
        } catch (e) {
            log('ERROR', `invalid wallpaper source "${url}": ${e.message}`);
            return;
        }
        if (!request) {
            log('ERROR', `invalid wallpaper source "${url}"`);
            return;
        }

        this._downloading = true;
        this._currentRequest = request;

        let gFile = Gio.file_new_for_path(this.wallpaperPath);
>>>>>>> Stashed changes

        if (Soup.MAJOR_VERSION === 2) {
            // Buffer the chunks: writing them inside got_chunk would put a
            // synchronous file write on the UI thread for every packet.
            let chunks = [];
            let received = 0;
            this._chunkHandler = request.connect('got_chunk', (message, chunk) => {
                if (this._removed) return;
                if (message.status_code === 200) { // only save the data we want, not content of 301 redirect page
                    const data = chunk.get_data();
                    chunks.push(data);
                    received += data.length;
                }
            });

            // queue the http request
            _httpSession.queue_message(request, (httpSession, message) => {
                // request completed
<<<<<<< Updated upstream
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
=======
                this._downloading = false;
                this._currentRequest = null;
                if (this._removed) return;

                const contentLength = message.response_headers.get_content_length();
                if (message.status_code === 200 && received > 0 &&
                    (contentLength < 0 || contentLength === received)) {
                    this._store_image(gFile, concat_chunks(chunks, received));
                } else {
                    log('ERROR', "Couldn't fetch image from " + url);
                    this._set_retry(60); // Try again
                    this._run_queued_refresh();
                }
            });
        } else { //version 3
            _httpSession.send_and_read_async(request, Soup.MessagePriority.NORMAL, null, (httpSession, result) => {
                this._downloading = false;
                this._currentRequest = null;
                if (this._removed) return;

                let bytes = null;
                try {
                    bytes = _httpSession.send_and_read_finish(result);
                } catch (e) {
                    log('ERROR', 'Download failed: ' + e.message);
                }

                if (bytes && bytes.get_size() > 0) {
                    log('DEBUG', 'Download successful');
                    this._store_image(gFile, bytes);
                } else {
                    log('ERROR', "Couldn't fetch image from " + url);
                    this._set_retry(60); // Try again
                    this._run_queued_refresh();
>>>>>>> Stashed changes
                }
            });
        }
    }

<<<<<<< Updated upstream
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
=======
    /* Single asynchronous write for the downloaded payload. */
    _store_image(gFile, bytes) {
        gFile.replace_contents_bytes_async(bytes, null, false,
            Gio.FileCreateFlags.REPLACE_DESTINATION, null, (file, result) => {
                let stored = false;
                try {
                    stored = file.replace_contents_finish(result);
                } catch (e) {
                    log('ERROR', 'Could not store the downloaded image: ' + e.message);
                }

                if (this._removed) return;

                if (stored) {
                    this._set_background(bytes);
                } else {
                    this._set_retry(60);
                }

                this._run_queued_refresh();
            });
    }

    /* A download was skipped while another one was running. */
    _run_queued_refresh() {
        if (!this._reloadRequested) return;
        this._reloadRequested = false;
        log('DEBUG', 'running queued refresh');
        this._download_image();
    }

    /* Archive the image that was just downloaded. The bytes are already in
       memory, so this never reads the wallpaper file back from disk and it
       never writes synchronously. */
    _save_image(bytes) {
        if (!bytes || bytes.get_size() === 0) {
            log('WARNING', 'nothing to save: the image data is empty');
            return;
>>>>>>> Stashed changes
        }

        const contents = bytes.get_data();
        const md5Hash = GLib.compute_checksum_for_data(GLib.ChecksumType.MD5, contents);
        if (!md5Hash) {
            log('ERROR', "Create MD5 failed");
        }
        log('DEBUG', "MD5: " + md5Hash);

<<<<<<< Updated upstream
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
=======
        const ext = image_extension(contents);
        const savePath = `${this._saveDir}/${md5Hash}.${ext}`;

        const saveDir = Gio.file_new_for_path(this._saveDir);
        const destinationFile = Gio.file_new_for_path(savePath);

        saveDir.make_directory_async(GLib.PRIORITY_DEFAULT, null, (dir, result) => {
            try {
                dir.make_directory_finish(result);
            } catch (e) {
                // G_IO_ERROR_EXISTS is the normal case, log anything else.
                if (!e.matches || !e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.EXISTS))
                    log('WARNING', 'Cannot create save directory ' + this._saveDir + ': ' + e.message);
            }

            destinationFile.replace_contents_bytes_async(bytes, null, false,
                Gio.FileCreateFlags.REPLACE_DESTINATION, null, (file, res) => {
                    if (this._removed) return;
                    try {
                        file.replace_contents_finish(res);
                        log('DEBUG', 'File copied from ' + this.wallpaperPath + ' to ' + savePath);
                    } catch (e) {
                        log('ERROR', 'Error copying file: ' + e.message);
                    }
                });
        });
    }

    /* Left click in "save" mode: keep the current wallpaper, only archive it. */
    _save_current_image() {
        const current = Gio.file_new_for_path(this.wallpaperPath);
        current.load_contents_async(null, (file, result) => {
            let contents = null;
            try {
                [, contents] = file.load_contents_finish(result);
            } catch (e) {
                log('WARNING', 'no wallpaper downloaded yet, nothing to save');
                return;
            }
            if (!contents) {
                log('WARNING', 'no wallpaper downloaded yet, nothing to save');
                return;
            }
            this._save_image(GLib.Bytes.new(contents));
        });
    }

    _apply_wallpaper(wallpaperUri) {
        if (this._removed) return;

        let gSetting = new Gio.Settings({ schema: 'org.cinnamon.desktop.background' });
        log('DEBUG', 'wallpaperUri: ' + wallpaperUri);
        gSetting.set_string('picture-uri', wallpaperUri);
        gSetting.set_string('picture-options', 'zoom');
        gSetting.apply();
    }

    _set_background(bytes) {
        if (this._removed) return;
>>>>>>> Stashed changes

        if (this.saveImage) {
            this._save_image(bytes);
        }

<<<<<<< Updated upstream
        Util.spawn_async(['dwebp', this.wallpaperPath, '-o', this.wallpaperPath], Lang.bind(this, function (out) {
            log('DEBUG', "The conversion was successful using dewbp")
        }));

        gSetting.set_string('picture-uri', wallpaperUri);
        gSetting.set_string('picture-options', 'zoom');
        Gio.Settings.sync();
        gSetting.apply();

=======
        if (GLib.find_program_in_path('dwebp')) {
            this._transcode_with_dwebp();
        } else {
            log('WARNING', 'dwebp not found, setting webp as wallpaper directly');
            this._apply_wallpaper(Gio.file_new_for_path(this.wallpaperPath).get_uri());
        }
>>>>>>> Stashed changes
    }

    /* Transcode the downloaded file to PNG, and only use the PNG when dwebp
       actually succeeded; otherwise fall back to the original file. */
    _transcode_with_dwebp() {
        let pngPath = `${this.wallpaperPath}.png`;
        let subprocess;
        try {
            subprocess = Gio.Subprocess.new(['dwebp', this.wallpaperPath, '-o', pngPath],
                Gio.SubprocessFlags.STDOUT_SILENCE | Gio.SubprocessFlags.STDERR_SILENCE);
        } catch (e) {
            log('WARNING', `could not run dwebp: ${e.message}`);
            this._apply_wallpaper(Gio.file_new_for_path(this.wallpaperPath).get_uri());
            return;
        }

        subprocess.wait_check_async(null, (proc, result) => {
            if (this._removed) return;

            let succeeded = false;
            try {
                succeeded = proc.wait_check_finish(result);
            } catch (e) {
                log('WARNING', `dwebp failed: ${e.message}`);
            }

            if (succeeded) {
                log('DEBUG', 'The conversion was successful using dwebp');
                this._apply_wallpaper(Gio.file_new_for_path(pngPath).get_uri());
            } else {
                log('WARNING', 'dwebp conversion failed, using the original file');
                this._apply_wallpaper(Gio.file_new_for_path(this.wallpaperPath).get_uri());
            }
        });
    }

    destroy() {
        this._shutdown();
    }

    on_applet_removed_from_panel() {
        this._shutdown();
    }

    /* Tear down everything that could still call back into a removed applet:
       timers, the in-flight download and its chunk handler. */
    _shutdown() {
        if (this._removed) return;
        this._removed = true;

        this._remove_timeout();
<<<<<<< Updated upstream
=======

        let request = this._currentRequest;
        this._currentRequest = null;
        if (request) {
            if (this._chunkHandler) {
                try {
                    request.disconnect(this._chunkHandler);
                } catch (e) {}
                this._chunkHandler = 0;
            }
            try {
                if (Soup.MAJOR_VERSION === 2) {
                    _httpSession.cancel_message(request, Soup.KnownStatusCode.CANCELLED);
                } else {
                    _httpSession.abort();
                }
            } catch (e) {
                log('DEBUG', 'cancelling the in-flight download failed: ' + e.message);
            }
        }

        if (this.settings) {
            this.settings.finalize();
            this.settings = null;
        }
>>>>>>> Stashed changes
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
