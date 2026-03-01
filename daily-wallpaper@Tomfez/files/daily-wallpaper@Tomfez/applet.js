const { Utils } = require("./utils");
const { Source } = require("./source");

const Applet = imports.ui.applet;
const { Clipboard, ClipboardType } = imports.gi.St;
const Clutter = imports.gi.Clutter;
const Gettext = imports.gettext;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const PopupMenu = imports.ui.popupMenu; // /usr/share/cinnamon/js/ui/popupMenu.js
const Settings = imports.ui.settings;   // /usr/share/cinnamon/js/ui/settings.js
const St = imports.gi.St;
const Util = imports.misc.util;

const currentDateTime = GLib.DateTime.new_now_local();
const UUID = "daily-wallpaper@Tomfez";
const ICON_SIZE = 24;

let _lastRefreshTime;
let _nextRefresh;
let _idxWallpaper = 0;

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale")
function _(str) {
    const customTrans = Gettext.dgettext(UUID, str);

    if (customTrans !== str && customTrans !== "")
        return customTrans;

    return Gettext.gettext(str);
}

function DailyWallpaperApplet(metadata, orientation, panel_height, instance_id) {
    this._init(metadata, orientation, panel_height, instance_id);
}

DailyWallpaperApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    //#region Init
    _init: function (metadata, orientation, panel_height, instance_id) {
        // Generic Setup
        Applet.IconApplet.prototype._init.call(this, orientation, panel_height, instance_id);
        this.set_applet_icon_symbolic_name("appicon");
        this.set_applet_tooltip(_('Daily desktop wallpaper'));

        this._bindSettings(metadata, instance_id);

        global.DEBUG = this.debug;

        // We use this directory to store the current wallpaper and metadata
        const configPath = `${GLib.get_user_config_dir()}/dailywallpaper`;

        const configPathObj = Gio.file_new_for_path(configPath);

        if (!configPathObj.query_exists(null))
            configPathObj.make_directory(null);

        this.wallpaperPath = `${configPath}/wallpaper.jpg`;
        this.metaDataPath = `${configPath}/meta.json`;

        this.Source = new Source(this.currentSource, this.metaDataPath, this.wallpaperPath);

        const file = Gio.file_new_for_path(this.metaDataPath);
        if (!file.query_exists(null))
            file.create(Gio.FileCreateFlags.NONE, null);

        this.getWallpaperDatePreferences();
        this.initMarket();

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);

        this.initMenu();
        this.setWallpaperDirectory();

        // Begin refresh loop
        this._refresh();
    },

    _bindSettings: function (metadata, instance_id) {
        this._settings = new Settings.AppletSettings(this, UUID, instance_id);
        this._settings.bindProperty(null, "wallpaperDir", "wallpaperDir", this.setWallpaperDirectory, null);
        this._settings.bindProperty(null, "saveWallpaper", "saveWallpaper", () => this._saveWallpaperToImageFolder, null);
        this._settings.bindProperty(null, "wallpaperNamePreferences", "wallpaperNamePreferences", null, null);
        this._settings.bindProperty(null, "refreshInterval", "refreshInterval", this._refresh, null);
        this._settings.bindProperty(null, "dailyRefreshState", "dailyRefreshState", this.on_toggle_enableDailyrefreshPSMI, null);
        this._settings.bindProperty(null, "selectedImagePreferences", "selectedImagePreferences", null, null);
        this._settings.bindProperty(null, "market", "market", null, null);
        this._settings.bindProperty(null, "apiKey", "apiKey", null, null);
        this._settings.bindProperty(null, "image-width-option", "imageWidth", null, null);
        this._settings.bindProperty(null, "image-height-option", "imageHeight", null, null);
        this._settings.bindProperty(null, "image-blur-option", "imageBlur", null, null);
        this._settings.bindProperty(null, "image-blur-amount", "imageBlurAmount", null, null);
        this._settings.bindProperty(null, "image-grayscale-option", "imageGrayscale", null, null);
        this._settings.bindProperty(null, "image-aspect-options", "pictureOptions", this._setBackground, null);
        this._settings.bindProperty(null, 'debugToggle', 'debug', (val) => { global.DEBUG = val; }, null);
        this._settings.bindProperty(null, 'currentSource', 'currentSource', this._changeCurrentSource, null);
    },

    initMenu: function () {
        this.wallpaperTextPMI = new PopupMenu.PopupMenuItem("", {
            hover: false,
            style_class: 'copyright-text'
        });

        this.copyrightTextPMI = new PopupMenu.PopupMenuItem("", {
            sensitive: false,
        });

        const wallpaperDateFormatted = currentDateTime.format("%Y-%m-%d");
        const wallpaperDayText = (_(`Daily wallpaper of the day for ${wallpaperDateFormatted}`));
        this.dayOfWallpaperPMI = new PopupMenu.PopupMenuItem(wallpaperDayText, {
            hover: false,
            style_class: 'text-popupmenu'
        });

        this.nextRefreshPMI = new PopupMenu.PopupMenuItem("", { sensitive: false });

        const refreshNowPMI = new PopupMenu.PopupMenuItem(_("Refresh"));
        refreshNowPMI.connect('activate', Lang.bind(this, this._refresh));

        this.initControlsBox();

        this.menu.addMenuItem(this.wallpaperTextPMI);
        this.menu.addMenuItem(this.copyrightTextPMI);
        this.menu.addMenuItem(this.dayOfWallpaperPMI);
        this.menu.addActor(this.controlsBox);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.menu.addMenuItem(this.nextRefreshPMI);
        this.menu.addMenuItem(refreshNowPMI);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.menu.addAction(_("Copy image URL to clipboard"), () => Clipboard.get_default().set_text(ClipboardType.CLIPBOARD, this.Source.imageURL));
        this.menu.addAction(_("Open image folder"), () => Util.spawnCommandLine(`nemo ${this.wallpaperDir}`));
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.menu.addAction(_("Settings"), () => Util.spawnCommandLine("cinnamon-settings applets " + UUID));
    },

    initControlsBox: function () {
        this.controlsBox = new St.BoxLayout(
            {
                style_class: "popup-menu-item",
                vertical: false,
                visible: true,
                reactive: true,
                x_align: Clutter.ActorAlign.CENTER
            }
        );

        // #region Previous button
        const prevCtrlBtn = new St.Button({ style_class: "button", width: 75 });
        prevCtrlBtn.connect('clicked', Lang.bind(this, () => this.getWallpaperByIndex("prev")));

        const prevCtrlLayout = new St.BoxLayout({ vertical: false });

        const prevCtrlIcon = new St.Icon(
            {
                style_class: "popup-menu-icon",
                icon_name: 'go-previous-symbolic',
                icon_type: St.IconType.SYMBOLIC,
                x_expand: true,
                y_expand: true,
                icon_size: ICON_SIZE
            }
        );

        prevCtrlLayout.add_actor(prevCtrlIcon, { span: 0 });
        prevCtrlBtn.add_actor(prevCtrlLayout);
        //#endregion

        // #region Randomize button
        const randCtrlBtn = new St.Button({ style_class: "button", width: 75 });
        randCtrlBtn.connect('clicked', Lang.bind(this, () => { this.getWallpaperByIndex("rand"); }));

        const randCtrlLayout = new St.BoxLayout({ vertical: false });

        const randCtrlIcon = new St.Icon(
            {
                style_class: "popup-menu-icon",
                icon_name: 'media-playlist-shuffle-symbolic',
                icon_type: St.IconType.SYMBOLIC,
                x_expand: true,
                y_expand: true,
                icon_size: ICON_SIZE
            }
        );

        randCtrlLayout.add_actor(randCtrlIcon, { span: 0 });
        randCtrlBtn.add_actor(randCtrlLayout);
        //#endregion

        //#region Next button
        const nextCtrlBtn = new St.Button({ style_class: "button", width: 75 });
        nextCtrlBtn.connect('clicked', Lang.bind(this, () => { this.getWallpaperByIndex("next"); }));

        const nextCtrlLayout = new St.BoxLayout({ vertical: false });

        const nextCtrlIcon = new St.Icon(
            {
                style_class: "popup-menu-icon",
                icon_name: 'go-next-symbolic',
                icon_type: St.IconType.SYMBOLIC,
                x_expand: true,
                y_expand: true,
                icon_size: ICON_SIZE
            }
        );

        nextCtrlLayout.add_actor(nextCtrlIcon, { span: 0 });
        nextCtrlBtn.add_actor(nextCtrlLayout);
        //#endregion

        //#region Reset button
        const resetCtrlBtn = new St.Button({ style_class: "button", width: 75 });
        resetCtrlBtn.connect('clicked', Lang.bind(this, () => this.getWallpaperByIndex("reset")));

        const resetCtrlLayout = new St.BoxLayout({ vertical: false });

        const resetCtrlIcon = new St.Icon(
            {
                style_class: "popup-menu-icon",
                icon_name: 'go-first-symbolic-rtl',
                icon_type: St.IconType.SYMBOLIC,
                x_expand: true,
                y_expand: true,
                icon_size: ICON_SIZE
            }
        );

        resetCtrlLayout.add_actor(resetCtrlIcon, { span: 0 });
        resetCtrlBtn.add_actor(resetCtrlLayout);
        //#endregion

        // Add all buttons to the main box
        this.controlsBox.add_actor(prevCtrlBtn);
        this.controlsBox.add_actor(randCtrlBtn);
        this.controlsBox.add_actor(nextCtrlBtn);
        this.controlsBox.add_actor(resetCtrlBtn);
    },

    initMarket: function () {
        if (this.market === "auto") {
            const usrLang = Utils.getUserLanguage();
            const options = this._settings.getOptions("market");

            let res = false;
            for (let k in options) {
                if (options[k] === usrLang) {
                    res = true;
                    break;
                }
            }

            // If language not found, we use en-US as default
            if (!res)
                this.market = "en-US"
        }
    },

    on_applet_clicked: function () {
        // Show/Hide the menu.
        this.menu.toggle();
    },

    destroy: function () {
        this._removeTimeout();
    },
    on_applet_removed_from_panel: function () {
        this._removeTimeout();
        this.menu.destroy();
        this._settings.finalize();
    },
    //#endregion

    on_toggle_enableDailyrefreshPSMI: function () {
        if (!this.dailyRefreshState) {
            this._removeTimeout();
            Utils.log("daily refresh disabled");
        } else {
            this._refresh();
            Utils.log("daily refresh enabled");
        }
    },

    _changeCurrentSource: function () {
        this.Source = new Source(this.currentSource, this.metaDataPath, this.wallpaperPath);
    },

    _updateNextRefreshTextPopup: function () {
        _nextRefresh = Utils.friendly_time_diff(_lastRefreshTime, true);

        this.refreshduetext =
            _("Next refresh") + ": " + (_lastRefreshTime ? _lastRefreshTime.format("%Y-%m-%d %X") : '-') +
            " (" + _nextRefresh + ")";

        if (this.nextRefreshPMI) {
            this.nextRefreshPMI.setLabel(this.refreshduetext);
        }
    },

    setWallpaperDirectory: function () {
        this.wallpaperDir = Utils.formatFolderName(this.wallpaperDir);
        Utils.log("Wallpaper directory: " + this.wallpaperDir);
    },

    _saveWallpaperToImageFolder: function () {
        if (!this.saveWallpaper)
            return;

        const dir = Gio.file_new_for_path(`${this.wallpaperDir}`);

        if (!dir.query_exists(null))
            dir.make_directory(null);

        let filename = this.Source.filename;
        if (this.wallpaperNamePreferences === 1) {
            // this.checkExtension();
            filename = this.currentSource + "Wallpaper_" + currentDateTime.add_days(-_idxWallpaper).format("%Y%m%d") + ".jpg";
        }

        const imagePath = Gio.file_new_for_path(this.wallpaperDir + "/" + filename);

        if (!imagePath.query_exists(null)) {
            const source = Gio.file_new_for_path(this.wallpaperPath);

            try {
                source.copy(imagePath, Gio.FileCopyFlags.NONE, null, null);
            } catch (error) {
                Utils.log("error _saveWallpaperToImageFolder: " + error);
            }
        }
    },

    getWallpaperByIndex: function (navigate) {
        switch (navigate) {
            case "next":
                if (_idxWallpaper > 0) {
                    _idxWallpaper -= 1;
                } else if (_idxWallpaper == 0) {
                    Utils.showDesktopNotification(_("This is the most recent image."), "dialog-information");
                }
                break;
            case "prev":
                // 7 is the maximum number of days to get the wallpapers
                if (_idxWallpaper < 7) {
                    _idxWallpaper += 1;
                } else if (_idxWallpaper == 7) {
                    Utils.showDesktopNotification(_("Last image. Unable to get more images."), "dialog-information");
                }
                break;
            case "rand":
                const rand = Utils.getRandomInt(7);
                _idxWallpaper = rand;
                break;
            case "reset":
            default:
                _idxWallpaper = 0;
                break;
        }

        this._downloadMetaData();
        this._setTimeout(this.refreshInterval);
    },

    getWallpaperDatePreferences: function () {
        switch (this.selectedImagePreferences) {
            case 1:
                let rand = _idxWallpaper;

                while (rand === _idxWallpaper) {
                    rand = Utils.getRandomInt(7);
                }

                _idxWallpaper = rand;
                break;
            default:
            case 0:
                _idxWallpaper = 0;
                break;
        }
    },

    //#region Timeout
    _refresh: function () {
        if (this.dailyRefreshState) {
            Utils.log(`Beginning refresh`);
            this._setTimeout(this.refreshInterval);
            this._getMetaData();
        } else {
            Utils.log("Timeout removed");
            this._removeTimeout();
            this.nextRefreshPMI.setLabel(_("Refresh deactivated"));

            this.Source.getMetaDataLocal();

            this.wallpaperTextPMI.setLabel(this.Source.description);
            this.copyrightTextPMI.setLabel(this.Source.copyrightsAutor);
            this.set_applet_tooltip(this.Source.copyrights);
        }
    },

    _removeTimeout: function () {
        if (this._timeout) {
            Mainloop.source_remove(this._timeout);
            this._timeout = null;
        }
    },

    _setTimeout: function (minutes) {
        /** Cancel current timeout in event of an error and try again shortly */
        this._removeTimeout();
        // Utils.log(`Setting timeout (${minutes}min)`);
        this._timeout = Mainloop.timeout_add_seconds(minutes * 60, Lang.bind(this, this._refresh));

        _lastRefreshTime = GLib.DateTime.new_now_local().add_seconds(minutes * 60);
        this._updateNextRefreshTextPopup();
    },
    //#endregion

    //#region Metadata and wallpaper download
    _getMetaData: function () {
        try {
            /** Check for local metadata  */
            if (this.Source.imageData === undefined)
                this.Source.getMetaDataLocal();

            this.wallpaperTextPMI.setLabel(this.Source.description);
            this.copyrightTextPMI.setLabel(this.Source.copyrightsAutor);

            if (this.Source.wallpaperDate === undefined || this.Source.wallpaperDate === "")
                this.Source.getWallpaperDate();

            const metadataFile = Gio.file_new_for_path(this.metaDataPath);

            if (metadataFile.query_exists(null) && this.selectedImagePreferences === 0) {
                // Look for image file, check this is up to date
                const image_file = Gio.file_new_for_path(this.wallpaperPath);

                if (image_file.query_exists(null)) {
                    const image_file_info = image_file.query_info('*', Gio.FileQueryInfoFlags.NONE, null);
                    const image_file_size = image_file_info.get_size();

                    if ((this.Source.wallpaperDate.get_day_of_year() < currentDateTime.get_day_of_year()) || !image_file_size) { // Is the image old, or empty?
                        Utils.log('image is old, downloading new metadata');
                        this._downloadMetaData();
                    } else {
                        this.set_applet_tooltip(this.Source.copyrights);
                        this.wallpaperTextPMI.setLabel(this.Source.description);
                        this.copyrightTextPMI.setLabel(this.Source.copyrightsAutor);

                        const wallpaperDate = currentDateTime.add_days(-_idxWallpaper).format("%Y-%m-%d");
                        const labelText = _("Wallpaper of the day at %s for %s").format(this.currentSource, wallpaperDate);

                        this.dayOfWallpaperPMI.setLabel(labelText);
                        Utils.log("image appears up to date");
                    }
                } else {
                    Utils.log("No image file found");
                    this._downloadImage();
                }
            } else {
                Utils.log('metadata is old, requesting new...');
                this._downloadMetaData();
            }
        } catch (err) {
            Utils.log(`Unable to get local metadata ${err}`);
            /** File does not exist or there was an error processing it */
            this._downloadMetaData();
        }
    },

    _downloadMetaData: function () {
        const write_file = data => {
            this.set_applet_tooltip(this.Source.copyrights);
            this.wallpaperTextPMI.setLabel(this.Source.description);
            this.copyrightTextPMI.setLabel(this.Source.copyrightsAutor);

            const wallpaperDate = currentDateTime.add_days(-_idxWallpaper).format("%Y-%m-%d");
            const labelText = _("Wallpaper of the day at %s for %s").format(this.currentSource, wallpaperDate);

            this.dayOfWallpaperPMI.setLabel(labelText);
            this._downloadImage();
        };

        let url = "";
        if (this.currentSource === "Bing") {
            url = `/HPImageArchive.aspx?format=js&idx=${_idxWallpaper}&n=1&mbl=1&mkt=${this.market}`;
        } else if (this.currentSource === "Wikimedia") {
            const newDate = currentDateTime.add_days(-_idxWallpaper);
            url = newDate.format("%Y/%m/%d");
        } else if (this.currentSource === "APOD") {
            let date = currentDateTime.add_days(-_idxWallpaper);
            date = date.format("%Y-%m-%d");
            url = `${this.apiKey}&date=${date}`;
        } else if (this.currentSource === "Picsum Photos") {
            if (this.imageGrayscale === true)
                url += "?&grayscale";

            if (this.imageGrayscale === true && this.imageBlur === true)
                url += `&blur=${this.imageBlurAmount}`;

            if (this.imageGrayscale === false && this.imageBlur === true)
                url += `?&blur=${this.imageBlurAmount}`;

            this.Source.callUrl(url, write_file, () => this._setTimeout(1));
            return;
        }

        this.Source.getMetaData(url, write_file, () => this._setTimeout(1));
    },

    _downloadImage: function () {
        const process_result = () => {
            this._saveWallpaperToImageFolder();
            this._setBackground();
        };
        this.Source.downloadImage(process_result, () => this._setTimeout(1));
    },

    _setBackground: function () {
        Utils.log("setting background");
        const gSetting = new Gio.Settings({ schema: 'org.cinnamon.desktop.background' });
        const uri = 'file://' + this.wallpaperPath;
        gSetting.set_string('picture-uri', uri);
        gSetting.set_string('picture-options', this.pictureOptions);
        Gio.Settings.sync();
        gSetting.apply();
    }
    //#endregion
};


function main(metadata, orientation, panelHeight, instanceId) {
    return new DailyWallpaperApplet(metadata, orientation, panelHeight, instanceId);
}
