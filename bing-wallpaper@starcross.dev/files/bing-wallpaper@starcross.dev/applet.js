const Applet = imports.ui.applet;
const Soup = imports.gi.Soup;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Mainloop = imports.mainloop;
const Lang = imports.lang;

const logging = false;

const _httpSession = new Soup.SessionAsync();
Soup.Session.prototype.add_feature.call(_httpSession, new Soup.ProxyResolverDefault());

const bingHost = 'https://www.bing.com';
const bingRequestPath = '/HPImageArchive.aspx?format=js&idx=0&n=1&mbl=1';

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
        this.set_applet_icon_name("bing-wallpaper-symbolic");
        this.set_applet_tooltip('Bing Desktop Wallpaper');

        // Path to store data in
        this.wallpaperDir = `${GLib.get_user_config_dir()}/bingwallpaper`;
        let dir = Gio.file_new_for_path(this.wallpaperDir);
        if (!dir.query_exists(null))
            dir.make_directory(null);
        this.wallpaperPath = `${this.wallpaperDir}/BingWallpaper.jpg`;
        this.metaDataPath = `${this.wallpaperDir}/meta.json`;

        // Begin refresh loop
        this._refresh();
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
        this._timeout = Mainloop.timeout_add_seconds(seconds, Lang.bind(this, this._refresh));
    },

    destroy: function () {
        this._removeTimeout();
    },
    on_applet_removed_from_panel() {
        this._removeTimeout();
    },

    _getMetaData: function () {

        /** Check for local metadata  */
        try {
            const jsonString = GLib.file_get_contents(this.metaDataPath)[1];
            const json = JSON.parse(jsonString);

            this.imageData = json.images[0];
            this.set_applet_tooltip(this.imageData.copyright);
            log(`Got image url from local file : ${this.imageData.url}`);

            /** See if this data is current */
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
                log('metadata up to date');

                // Look for image file, check this is up to date
                let image_file = Gio.file_new_for_path(this.wallpaperPath);

                if (image_file.query_exists(null)) {

                    let image_file_info = image_file.query_info('*', Gio.FileQueryInfoFlags.NONE, null);
                    let image_file_size = image_file_info.get_size();
                    let image_file_mod_secs = image_file_info.get_modification_time().tv_sec;

                    if ((image_file_mod_secs > end_date.to_unix()) || !image_file_size) { // Is the image old, or empty?
                        this._downloadImage();

                    } else {
                        log("image appears up to date");
                    }

                } else {
                    log("No image file found");
                    this._downloadImage();
                }

            }
            else {
                log('metadata is old, requesting new...');
                this._downloadMetaData();
            }


        } catch (err) {
            log(`Unable to get local metadata ${err}`);
            /** File does not exist or there was an error processing it */
            this._downloadMetaData();
        }
    },

    _downloadMetaData: function () {
        // Retrieve json metadata, either from local file or remote
        let request = Soup.Message.new('GET', `${bingHost}${bingRequestPath}`);
        _httpSession.queue_message(request, (_httpSession, message) => {
            if (message.status_code === 200) {

                // Write to meta data file
                let gFile = Gio.file_new_for_path(this.metaDataPath);
                let fStream = gFile.replace(null, false, Gio.FileCreateFlags.NONE, null);
                let toWrite  = message.response_body.data.length;
                while (toWrite > 0)
                    toWrite -= fStream.write(message.response_body.data, null);
                fStream.close(null);

                const json = JSON.parse(message.response_body.data);
                this.imageData = json.images[0];
                this.set_applet_tooltip(this.imageData.copyright);
                log(`Got image url from download: ${this.imageData.url}`);

                this._downloadImage();

            } else {
                log(`Failed to acquire image metadata (${message.status_code})`);
                this._setTimeout(60)  // Try again
            }
        });
    },

    _downloadImage: function () {

        log('downloading new image');
        const url = `${bingHost}${this.imageData.url}`;
        let gFile = Gio.file_new_for_path(this.wallpaperPath);

        // open the file
        let fStream = gFile.replace(null, false, Gio.FileCreateFlags.NONE, null);

        // create an http message
        let request = Soup.Message.new('GET', url);

        // got_chunk event
        request.connect('got_chunk', function (message, chunk) {
            if (message.status_code === 200) { // only save the data we want, not content of 301 redirect page
                fStream.write(chunk.get_data(), null);
            }
        });

        // queue the http request
        _httpSession.queue_message(request, (httpSession, message) => {
            // request completed
            fStream.close(null);
            if (message.status_code === 200) {
                log('Download successful');
                this._setBackground();
            } else {
                log("Couldn't fetch image from " + url);
                this._setTimeout(60)  // Try again
            }
        });
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
