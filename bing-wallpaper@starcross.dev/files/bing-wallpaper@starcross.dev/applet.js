const Applet = imports.ui.applet;
const Soup = imports.gi.Soup;
const ByteArray = imports.byteArray;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Mainloop = imports.mainloop;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;

// Cinnamon Translation Support
const Gettext = imports.gettext;
const UUID = "bing-wallpaper@starcross.dev";
Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");

function _(str) {
    let customTranslation = Gettext.dgettext(UUID, str);
    if (customTranslation !== str) {
        return customTranslation;
    }
    return Gettext.gettext(str);
}

const logging = false;

let _httpSession;
if (Soup.MAJOR_VERSION == 2) {
    _httpSession = new Soup.SessionAsync();
    Soup.Session.prototype.add_feature.call(_httpSession, new Soup.ProxyResolverDefault());
} else { // version 3
    _httpSession = new Soup.Session();
}

const bingHost = 'https://www.bing.com';
const bingRequestPath = '/HPImageArchive.aspx?format=js&idx=0&n=8&mbl=1';

function log(message) {
    if (logging) global.log(`[bing-wallpaper@starcross.dev]: ${message}`);
}

function BingWallpaperApplet(orientation, panel_height, instance_id) {
    this._init(orientation, panel_height, instance_id);
}

BingWallpaperApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function (orientation, panel_height, instance_id) {
        // Generic Setup
        Applet.IconApplet.prototype._init.call(this, orientation, panel_height, instance_id);
        this.set_applet_icon_symbolic_name("bing-wallpaper");
        this.set_applet_tooltip('Bing Desktop Wallpaper');

        // Path to store data in
        this.wallpaperDir = `${GLib.get_user_config_dir()}/bingwallpaper`;
        let dir = Gio.file_new_for_path(this.wallpaperDir);

        try {
            dir.make_directory_with_parents(null);
        } catch (e) {
            // Ignore if directory already exists
        }

        this.wallpaperPath = `${this.wallpaperDir}/BingWallpaper.jpg`;
        this.metaDataPath = `${this.wallpaperDir}/meta.json`;
        
        // Manual override flag to stop daily refresh if user picks a history wallpaper
        this.manualOverride = false; 

        let refreshBg = new PopupMenu.PopupIconMenuItem(_("Refresh Now"), "view-refresh", St.IconType.SYMBOLIC);
        refreshBg.connect('activate', () => {
            this.manualOverride = false; // Reset manual override on explicit refresh
            this._downloadMetaData();
        });
        this._applet_context_menu.addMenuItem(refreshBg);

        // History Submenu
        this.historyMenu = new PopupMenu.PopupSubMenuMenuItem(_("Wallpaper History (8 days)"));
        this._applet_context_menu.addMenuItem(this.historyMenu);

        // Begin refresh loop
        this._refresh();
    },

    _buildHistoryMenu: function(json) {
        if (!this.historyMenu) return;

        this.historyMenu.menu.removeAll();

        if (json && json.images) {
            for (let i = 0; i < json.images.length; i++) {
                let imgData = json.images[i];
                let labelText = imgData.copyright ? imgData.copyright : _("Bing Wallpaper");

                let menuItem = new PopupMenu.PopupMenuItem(labelText);
                menuItem.connect('activate', () => {
                    log(`User selected historical background: ${imgData.url}`);
                    this.manualOverride = true; // Pause daily refresh logic
                    this.imageData = imgData;
                    this.set_applet_tooltip(this.imageData.copyright);

                    this.wallpaperPath = `${this.wallpaperDir}/bing_${this.imageData.startdate}.jpg`;

                    let gFile = Gio.file_new_for_path(this.wallpaperPath);
                    gFile.query_info_async('standard::size', Gio.FileQueryInfoFlags.NONE, GLib.PRIORITY_DEFAULT, null, (file, res) => {
                        try {
                            file.query_info_finish(res);
                            log('Image already in cache, applying directly.');
                            this._setBackground();
                        } catch (e) {
                            log('Image not in cache, downloading...');
                            this._downloadImage();
                        }
                    });
                });
                this.historyMenu.menu.addMenuItem(menuItem);
            }
            
            // Clean up old images to prevent disk space bloat
            this._cleanupOldImages(json);
        }
    },

    _cleanupOldImages: function(json) {
        let validDates = new Set();
        if (json && json.images) {
            json.images.forEach(img => validDates.add(img.startdate));
        }

        let dir = Gio.file_new_for_path(this.wallpaperDir);
        dir.enumerate_children_async('standard::name', Gio.FileQueryInfoFlags.NONE, GLib.PRIORITY_DEFAULT, null, (obj, res) => {
            try {
                let enumerator = obj.enumerate_children_finish(res);
                let info;
                while ((info = enumerator.next_file(null)) != null) {
                    let name = info.get_name();
                    if (name.startsWith("bing_") && name.endsWith(".jpg")) {
                        let datePart = name.substring(5, 13);
                        if (!validDates.has(datePart)) {
                            let fileToDelete = dir.get_child(name);
                            fileToDelete.delete_async(GLib.PRIORITY_DEFAULT, null, (f, r) => {
                                try { 
                                    f.delete_finish(r); 
                                    log(`Deleted old wallpaper from cache: ${name}`); 
                                } catch(e) {}
                            });
                        }
                    }
                }
            } catch (e) {
                log(`Cleanup error: ${e.message}`);
            }
        });
    },

    _refresh: function () {
        log(`Beginning refresh`);
        this._getMetaData();
        this._setTimeout(300);
    },

    _removeTimeout: function () {
        if (this._timeout) {
            Mainloop.source_remove(this._timeout);
            this._timeout = null;
        }
    },

    _setTimeout: function (seconds) {
        this._removeTimeout();
        log(`Setting timeout (${seconds}s)`);
        this._timeout = Mainloop.timeout_add_seconds(seconds, () => this._refresh());
    },

    destroy: function () {
        this._removeTimeout();
    },

    on_applet_removed_from_panel: function () {
        this._removeTimeout();
    },

    _getMetaData: function () {
        try {
            const jsonString = GLib.file_get_contents(this.metaDataPath)[1];
            const json = JSON.parse(jsonString);

            this._buildHistoryMenu(json);

            this.imageData = json.images[0];
            this.wallpaperPath = `${this.wallpaperDir}/bing_${this.imageData.startdate}.jpg`;

            this.set_applet_tooltip(this.imageData.copyright);
            log(`Got image url from local file : ${this.imageData.url}`);

            const start_date = GLib.DateTime.new(
                GLib.TimeZone.new_utc(),
                this.imageData.fullstartdate.substring(0,4),
                this.imageData.fullstartdate.substring(4,6),
                this.imageData.fullstartdate.substring(6,8),
                this.imageData.fullstartdate.substring(8,10),
                this.imageData.fullstartdate.substring(10,12),
                0
            );
            const end_date = start_date.add_days(1);
            const now = GLib.DateTime.new_now_utc();

            if (now.to_unix() < end_date.to_unix()) {
                log('Metadata up to date');

                let image_file = Gio.file_new_for_path(this.wallpaperPath);
                image_file.query_info_async('standard::size,time::modified', Gio.FileQueryInfoFlags.NONE, GLib.PRIORITY_DEFAULT, null, (file, res) => {
                    try {
                        let image_file_info = file.query_info_finish(res);
                        let image_file_size = image_file_info.get_size();

                        let modTimeSecs;
                        if (image_file_info.get_modification_date_time) {
                            modTimeSecs = image_file_info.get_modification_date_time().to_unix();
                        } else {
                            modTimeSecs = image_file_info.get_modification_time().tv_sec;
                        }

                        if ((modTimeSecs > end_date.to_unix()) || !image_file_size) {
                            if (!this.manualOverride) {
                                this._downloadImage();
                            } else {
                                log("Auto-update skipped due to manual history selection.");
                            }
                        } else {
                            log("Image appears up to date");
                        }
                    } catch (e) {
                        log("No image file found");
                        if (!this.manualOverride) this._downloadImage();
                    }
                });
            } else {
                log('Metadata is old, requesting new...');
                this._downloadMetaData();
            }

        } catch (err) {
            log(`Unable to get local metadata ${err}`);
            this._downloadMetaData();
        }
    },

    _downloadMetaData: function () {
        const process_result = data => {
            let gFile = Gio.file_new_for_path(this.metaDataPath);
            let fStream = gFile.replace(null, false, Gio.FileCreateFlags.NONE, null);
            let toWrite = data.length;
            while (toWrite > 0)
                toWrite -= fStream.write(data, null);
            fStream.close(null);

            const json = JSON.parse(data);

            this._buildHistoryMenu(json);

            this.imageData = json.images[0];
            this.wallpaperPath = `${this.wallpaperDir}/bing_${this.imageData.startdate}.jpg`;

            this.set_applet_tooltip(this.imageData.copyright);
            log(`Got image url from download: ${this.imageData.url}`);

            this._downloadImage();
        };

        let request = Soup.Message.new('GET', `${bingHost}${bingRequestPath}`);
        if (Soup.MAJOR_VERSION === 2) {
            _httpSession.queue_message(request, (_httpSession, message) => {
                if (message.status_code === 200) {
                    process_result(message.response_body.data);
                } else {
                    log(`Failed to acquire image metadata (${message.status_code})`);
                    this._setTimeout(60);
                }
            });
        } else {
            _httpSession.send_and_read_async(request, Soup.MessagePriority.NORMAL, null, (_httpSession, message) => {
                if (request.get_status() === 200) {
                    const bytes = _httpSession.send_and_read_finish(message);
                    process_result(ByteArray.toString(bytes.get_data()));
                } else {
                    log(`Failed to acquire image metadata (${request.get_status()})`);
                    this._setTimeout(60);
                }
            });
        }
    },

    _downloadImage: function () {
        log('Downloading new image');
        const url = `${bingHost}${this.imageData.url}`;
        const regex = /_\d+x\d+./gm;
        const urlUHD = url.replace(regex, `_UHD.`);

        let gFile = Gio.file_new_for_path(this.wallpaperPath);
        let fStream = gFile.replace(null, false, Gio.FileCreateFlags.NONE, null);
        let request = Soup.Message.new('GET', urlUHD);
        let bytesTotal = 0;

        if (Soup.MAJOR_VERSION === 2) {
            request.connect('got_chunk', function (message, chunk) {
                if (message.status_code === 200) {
                    bytesTotal += fStream.write(chunk.get_data(), null);
                }
            });

            _httpSession.queue_message(request, (httpSession, message) => {
                fStream.close(null);
                const contentLength = message.response_headers.get_content_length();
                if (message.status_code === 200 && contentLength === bytesTotal) {
                    this._setBackground();
                } else {
                    log("Couldn't fetch image from " + urlUHD);
                    gFile.delete(null);
                    this._setTimeout(60);
                }
            });
        } else {
            _httpSession.send_and_read_async(request, Soup.MessagePriority.NORMAL, null, (httpSession, message) => {
                if (request.get_status() === 200) {
                    const bytes = _httpSession.send_and_read_finish(message);
                    if (bytes && bytes.get_size() > 0) {
                        fStream.write(bytes.get_data(), null);
                    }
                    fStream.close(null);
                    log('Download successful');
                    this._setBackground();
                } else {
                    log("Couldn't fetch image from " + urlUHD);
                    this._setTimeout(60);
                }
            });
        }
    },

    _setBackground: function () {
        let gSetting = new Gio.Settings({schema: 'org.cinnamon.desktop.background'});
        const uri = 'file://' + this.wallpaperPath;

        gSetting.set_string('picture-uri', uri);
        gSetting.set_string('picture-options', 'zoom');
        Gio.Settings.sync();
        gSetting.apply();
    }
};

function main(metadata, orientation, panelHeight, instanceId) {
    let bingApplet = new BingWallpaperApplet(orientation, panelHeight, instanceId);
    return bingApplet;
}
