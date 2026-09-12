const Applet = imports.ui.applet;
const Soup = imports.gi.Soup;
const ByteArray = imports.byteArray;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Mainloop = imports.mainloop;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const Tooltips = imports.ui.tooltips; // Importación para los Tooltips emergentes

// Cinnamon Translation Support
const Gettext = imports.gettext;
const UUID = "bing-wallpaper@starcross.dev";
// FIX 3: Use GLib.get_user_data_dir() instead of hardcoding .local/share
Gettext.bindtextdomain(UUID, GLib.get_user_data_dir() + "/locale");

function _(str) {
    return Gettext.dgettext(UUID, str);
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

        this.metaDataPath = `${this.wallpaperDir}/meta.json`;
        this.overrideStatePath = `${this.wallpaperDir}/override.json`;
        
        this.manualOverride = false;
        this.manualOverrideDate = null;

        let refreshBg = new PopupMenu.PopupIconMenuItem(_("Refresh Now"), "view-refresh", St.IconType.SYMBOLIC);
        refreshBg.connect('activate', () => {
            this._saveOverrideState(false, null); // Reset manual override on explicit refresh
            this._downloadMetaData();
        });
        this._applet_context_menu.addMenuItem(refreshBg);

        // History Submenu
        this.historyMenu = new PopupMenu.PopupSubMenuMenuItem(_("Recent Images"));
        this._applet_context_menu.addMenuItem(this.historyMenu);

        // Load manual override state to persist through restarts, then start refresh loop
        this._loadOverrideState(() => {
            this._refresh();
        });
    },

    _saveOverrideState: function(isOverride, dateStr) {
        this.manualOverride = isOverride;
        this.manualOverrideDate = dateStr;
        let state = { manualOverride: isOverride, date: dateStr };
        let gFile = Gio.file_new_for_path(this.overrideStatePath);
        
        // Convertimos el string JSON a un Array de Bytes para GJS
        let contents = ByteArray.fromString(JSON.stringify(state));

        gFile.replace_contents_async(
            contents,
            null,
            false,
            Gio.FileCreateFlags.NONE,
            null,
            (file, res) => {
                try {
                    file.replace_contents_finish(res);
                } catch (e) {
                    log(`Error saving override state: ${e.message}`);
                }
            }
        );
    },

    _loadOverrideState: function(callback) {
        let gFile = Gio.file_new_for_path(this.overrideStatePath);
        
        // FIX 1: Use load_contents_async instead of sync
        gFile.load_contents_async(null, (file, res) => {
            try {
                let [success, contents] = file.load_contents_finish(res);
                if (success) {
                    let state = JSON.parse(ByteArray.toString(contents));
                    this.manualOverride = state.manualOverride;
                    this.manualOverrideDate = state.date;
                }
            } catch (e) {
                this.manualOverride = false;
                this.manualOverrideDate = null;
            }
            if (callback) callback();
        });
    },

    _buildHistoryMenu: function(json) {
        if (!this.historyMenu) return;

        this.historyMenu.menu.removeAll();

        if (json && Array.isArray(json.images) && json.images.length > 0) {
            for (let i = 0; i < json.images.length; i++) {
                let imgData = json.images[i];
                if (!imgData || !imgData.startdate) continue;

                // Usamos el copyright, pero lo recortamos inteligentemente para no romper el menú
                let fullText = imgData.copyright ? imgData.copyright : _("Bing Wallpaper");
                let labelText = fullText;

                // Si el texto es muy largo, lo cortamos a 40 caracteres y le agregamos "..."
                if (labelText.length > 40) {
                    labelText = labelText.substring(0, 40) + "...";
                }

                let menuItem = new PopupMenu.PopupMenuItem(labelText);
                
                // El tooltip nativo muestra el texto completo sin recortar
                let tooltip = new Tooltips.Tooltip(menuItem.actor, fullText);

                menuItem.connect('activate', () => {
                    log(`User selected historical background: ${imgData.url}`);
                    this._saveOverrideState(true, imgData.startdate);
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
        if (json && Array.isArray(json.images) && json.images.length > 0) {
            json.images.forEach(img => {
                if (img && img.startdate) {
                    validDates.add(img.startdate);
                }
            });
        } else {
            return; // Abort cleanup if JSON data is invalid
        }

        // Prevent deletion of manually selected image if it's older than 8 days
        if (this.manualOverride && this.manualOverrideDate) {
            validDates.add(this.manualOverrideDate);
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
                                } catch(e) {
                                    log(`Failed to delete old wallpaper ${name}: ${e.message}`);
                                }
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
        /** Cancel current timeout in event of an error and try again shortly */
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

            if (this.manualOverride && this.manualOverrideDate) {
                let historicalImg = json.images.find(img => img.startdate === this.manualOverrideDate);
                if (historicalImg) {
                    this.imageData = historicalImg;
                } else {
                    this.imageData = { startdate: this.manualOverrideDate, url: "", copyright: _("Historical Bing Wallpaper") };
                }
            } else {
                this.imageData = json.images[0];
            }

            this.wallpaperPath = `${this.wallpaperDir}/bing_${this.imageData.startdate}.jpg`;
            this.set_applet_tooltip(this.imageData.copyright);
            log(`Got image url from local file : ${this.imageData.url}`);

            if (!json.images[0] || !json.images[0].fullstartdate) {
                this._downloadMetaData();
                return;
            }

            const refImage = json.images[0];
            const start_date = GLib.DateTime.new(
                GLib.TimeZone.new_utc(),
                refImage.fullstartdate.substring(0,4),
                refImage.fullstartdate.substring(4,6),
                refImage.fullstartdate.substring(6,8),
                refImage.fullstartdate.substring(8,10),
                refImage.fullstartdate.substring(10,12),
                0
            );
            const end_date = start_date.add_days(1);
            const now = GLib.DateTime.new_now_utc();

            if (now.to_unix() < end_date.to_unix()) {
                log('Metadata up to date');

                let image_file = Gio.file_new_for_path(this.wallpaperPath);
                image_file.query_info_async('standard::size,time::modified', Gio.FileQueryInfoFlags.NONE, GLib.PRIORITY_DEFAULT, null, (file, res) => {
                    let image_file_info;
                    try {
                        image_file_info = file.query_info_finish(res);
                    } catch (e) {
                        log(`No image file found: ${e.message}`);
                        if (!this.manualOverride) this._downloadImage();
                        return;
                    }

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
        if (!this.imageData || !this.imageData.url) return;

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
