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

const APPLET_PATH = imports.ui.appletManager.appletMeta['anime-wallpaper@flyflyan'].path;
const SAVE_IMAGE_PATH = `${GLib.get_home_dir()}/Pictures/`;

const SAVE_SCRIPT = `${APPLET_PATH}/savefile.sh`;
const ANIME_URL = 'https://www.loliapi.com/acg/pc/';

const logging = false;

let _httpSession;
if (Soup.MAJOR_VERSION == 2) {
    _httpSession = new Soup.SessionAsync();
    Soup.Session.prototype.add_feature.call(_httpSession, new Soup.ProxyResolverDefault());
} else { //version 3
    _httpSession = new Soup.Session();
}

function log(message) {
    if (logging) global.log(`[anime-wallpaper@flyflyan]: ${message}`);
}

class AnimeWallpaperApplet extends Applet.TextIconApplet {
    constructor(metadata, orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        this.setAllowedLayout(Applet.AllowedLayout.BOTH);

        this.set_applet_icon_symbolic_name("anime-wallpaper");
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

        this._init_scripts();
        this._bind_settings();

        // get Settings
        this._on_settings_changed();

        //Context menu
        this._add_context_menu();

        // Begin refresh loop
        this._refresh();
    }

    _init_scripts() {
        Util.spawn_async(['chmod', '0755', SAVE_SCRIPT], Lang.bind(this, function (out) {
            log("chmod 755 [" + SAVE_SCRIPT + "]");
        }));
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
        log("_on_save_image_changed:active");
        log(this.settings.getValue("saveImage"));
        if (this.settings.getValue("saveImage")) {
            this.settings.setValue("saveImage", false);
            log("_on_save_image_changed " + "get saveImage " + this.settings.getValue("saveImage"));
        } else {
            this.settings.setValue("saveImage", true);
            log("_on_save_image_changed " + "get saveImage " + this.settings.getValue("saveImage"));
        }

        this._on_settings_changed();
    }

    _on_auto_refresh_changed() {
        log("_on_auto_refresh_changed:active");
        log(this.settings.getValue("slideshow"));
        if (this.settings.getValue("slideshow")) {
            this.settings.setValue("slideshow", false);
            log("_on_auto_refresh_changed " + "get slideshow " + this.settings.getValue("slideshow"));
        } else {
            this.settings.setValue("slideshow", true);
            log("_on_auto_refresh_changed " + "get slideshow " + this.settings.getValue("slideshow"));
        }

        this._on_settings_changed();
    }

    _on_click_changed() {
        log("_on_click_changed:active");
        log(this.settings.getValue("click"));
        if (this.settings.getValue("click")) {
            this.settings.setValue("click", false);
            log("_on_save_image_changed " + "get click " + this.settings.getValue("click"));
        } else {
            this.settings.setValue("click", true);
            log("_on_save_image_changed " + "get click " + this.settings.getValue("click"));
        }

        this._on_settings_changed();
    }

    _on_settings_changed() {
        log("_on_settings_changed");
        log(this.settings.getValue("resource"));
        log(this.settings.getValue("slideshow"));
        log(this.settings.getValue("saveImage"));
        log(this.settings.getValue("saveImagePath"));
        log(this.settings.getValue("delay"));
        log(this.settings.getValue("click"));

        this.autoRefresh = (this.settings.getValue("slideshow") != null) ? this.settings.getValue("slideshow") : true;
        this.saveImage = (this.settings.getValue("saveImage") != null) ? this.settings.getValue("saveImage") : true;
        this.reloadTime = (this.settings.getValue("delay") != null) ? this.settings.getValue("delay") * 60 : 600;
        this.click = (this.settings.getValue("click") != null) ? this.settings.getValue("click") : true;

        let apiURL = this.settings.getValue("resource");
        if ((apiURL != null) && (apiURL != "")) {
            this.apiUrl = apiURL;
            log(apiURL);
        } else {
            log("not set apiURL, set to " + ANIME_URL);
            this.apiUrl = ANIME_URL;
        }

        let saveImagePath = this.settings.getValue("saveImagePath");
        if ((saveImagePath != null) && (saveImagePath != "")) {
            this.saveImagePath = saveImagePath;
        } else {
            log("not set saveImagePath, set to " + SAVE_IMAGE_PATH);
            this.saveImagePath = SAVE_IMAGE_PATH;
            if (this.saveImage) {
                this.settings.setValue("saveImagePath", SAVE_IMAGE_PATH);
            }
        }

        log(this.apiUrl);
        this.set_applet_tooltip(this.apiUrl);
        this.saveImagePath = this.saveImagePath.replace("file://", "");
        log(this.saveImagePath);

        log("set auto-refresh");
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
        log(`Setting timeout (${seconds}s)`);
        this._timeout = Mainloop.timeout_add_seconds(seconds, Lang.bind(this, this._refresh));
    }

    _refresh() {
        log(`Beginning refresh`);
        this._download_image();

        if (this.autoRefresh) {
            this._set_timeout(this.reloadTime);
        } else {
            this._remove_timeout();
        }
    }

    _download_image() {
        log('downloading new image');
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
                    log("Couldn't fetch image from " + url);
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
                    log('Download successful');
                    this._set_background();
                } else {
                    log("Couldn't fetch image from " + url);
                    this._set_timeout(60)  // Try again
                }
            });
        }
    }

    _save_image() {
        let time = GLib.get_real_time();
        let savePath = this.saveImagePath;

        log(APPLET_PATH);
        Util.spawn_async([SAVE_SCRIPT, this.wallpaperPath, savePath], Lang.bind(this, function (out) {
            log("save image [" + this.wallpaperPath + "] to " + savePath);
        }));
    }

    _set_background() {

        let gSetting = new Gio.Settings({ schema: 'org.cinnamon.desktop.background' });
        const uri = 'file://' + this.wallpaperPath;
        log(uri);

        if (this.saveImage) {
            this._save_image();
        }

        // Util.spawn(['dwebp', this.wallpaperPath, '-o', this.wallpaperPath + '.png']);
        Util.spawn_async(['dwebp', this.wallpaperPath, '-o', this.wallpaperPath], Lang.bind(this, function (out) {
            log("The conversion was successful using dewbp")
        }));

        gSetting.set_string('picture-uri', uri);
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
