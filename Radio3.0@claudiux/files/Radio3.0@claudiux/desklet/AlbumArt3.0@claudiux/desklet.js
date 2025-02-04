//"use strict";
const Main = imports.ui.main;
const Gio = imports.gi.Gio;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const Desklet = imports.ui.desklet;
const Lang = imports.lang;
//~ const Mainloop = imports.mainloop;
const Clutter = imports.gi.Clutter;
const GLib = imports.gi.GLib;
const Tweener = imports.ui.tweener;
const Util = imports.misc.util;
const Settings = imports.ui.settings;
const Gettext = imports.gettext;
//Mainloop:
const { timeout_add_seconds, timeout_add, setTimeout, clearTimeout, setInterval, clearInterval, source_exists, source_remove, remove_all_sources } = require("mainloopTools");


const APPLET_UUID = "Radio3.0@claudiux";
const DESKLET_UUID = "AlbumArt3.0@claudiux";
Gettext.bindtextdomain(APPLET_UUID, GLib.get_home_dir() + "/.local/share/locale");
Gettext.bindtextdomain("cinnamon", "/usr/share/locale");

function _(str) {
    let customTrans = Gettext.dgettext(APPLET_UUID, str);
    if (customTrans !== str && customTrans.length > 0)
        return customTrans;

    customTrans = Gettext.dgettext("cinnamon", str);
    if (customTrans !== str && customTrans.length > 0)
        return customTrans;

    return Gettext.gettext(str);
}


class AlbumArtRadio30 extends Desklet.Desklet {
    constructor(metadata, desklet_id) {
        super(metadata, desklet_id);

        this.metadata = metadata;
        this._bin = null;
        this.update_id = null;
        this.old_image_path = null;
        this.isLooping = true;
        this.dir_monitor_loop_is_active = true;

        this.dir = "file://"+GLib.get_home_dir()+"/.config/Radio3.0/song-art";
        this.shuffle = false;
        this.delay = 3;
        //this.fade_delay = 0;
        this.effect = "";

        this._updateDecoration();

        this.settings = new Settings.DeskletSettings(this, DESKLET_UUID, this.instance_id);
        this.settings.bind('height', 'height', this.on_setting_changed);
        this.settings.bind('width', 'width', this.on_setting_changed);
        this.settings.bind('fade-delay', 'fade_delay', this.on_setting_changed);
        this.settings.bind('fade-effect', 'fade_effect', this.on_setting_changed);

        this.dir_monitor_id = null;
        this.dir_monitor = null;
        this.dir_file = null;

        this.setHeader(_("Radio3.0 Album Art"));
        this._setup_dir_monitor();
        this.setup_display();
        this._updateDecoration(); // once again?
    }

    on_setting_changed() {
        this.isLooping = false;

        this._setup_dir_monitor();
        if (this.currentPicture) {
            this.currentPicture.destroy();
        }
        if (this._photoFrame) {
            this._photoFrame.destroy();
        }
        this.isLooping = true;
        this.setup_display();
    }

    _setup_dir_monitor() {
        if (this.dir_monitor_id != null) return;

        this.dir_file = Gio.file_new_for_uri(this.dir);
        this.dir_monitor = this.dir_file.monitor_directory(0, new Gio.Cancellable());
        //~ this.dir_monitor_id = this.dir_monitor.connect('changed', Lang.bind(this, this.dir_monitor_loop));
        this.dir_monitor_id = this.dir_monitor.connect('changed', () => { this.dir_monitor_loop(); });
    }

    dir_monitor_loop() {
        if (!this.dir_monitor_loop_is_active) {
            if (this.dir_monitor_id != null) {
                this.dir_monitor.disconnect(this.dir_monitor_id);
                this.dir_monitor.cancel();
            }
            this.dir_monitor_id = null;
            this.dir_monitor = null;
            return false;
        }
        this.on_setting_changed();
        return true;
    }

    on_desklet_removed() {
        //~ if (this.dir_monitor) {
            //~ this.dir_monitor.disconnectAllSignals();
            //~ this.dir_monitor.disconnect(this.dir_monitor_id);
            //~ this.dir_monitor_id = null;
        //~ }
        //~ this.dir_monitor_id = null;
        if (this.dir_monitor != null) {
            if (this.dir_monitor_id != null) {
                this.dir_monitor.disconnect(this.dir_monitor_id);
            }
            this.dir_monitor.cancel();
        }
        this.dir_monitor_id = null;
        this.dir_monitor = null;
        this.isLooping = false;
        this.dir_monitor_loop_is_active = false;

        if (this._bin != null) {
            if (Tweener.getTweenCount(this._bin) > 0)
                Tweener.removeTweens(this._bin);
            this._bin.destroy_all_children();
            this._bin.destroy();
            this._bin = null;
        }

        remove_all_sources();
    }

    _scan_dir(dir) {
        if (!this.isLooping) return;
        let dir_file = Gio.file_new_for_uri(dir);
        //~ let fileEnum = dir_file.enumerate_children('standard::type,standard::name,standard::is-hidden', Gio.FileQueryInfoFlags.NONE, null);
        let fileEnum = dir_file.enumerate_children('standard::*', Gio.FileQueryInfoFlags.NONE, null);

        let info;
        while ((info = fileEnum.next_file(null)) != null) {
            if (info.get_is_hidden()) {
                continue;
            }

            let fileType = info.get_file_type();
            let fileName = dir + '/' + info.get_name();
            if (fileType != Gio.FileType.DIRECTORY) {
                this._images.push(fileName);
            } else {
                this._scan_dir(fileName);
            }
        }

        fileEnum.close(null);
    }

    setup_display() {
        if (!this.isLooping) return;
        this._photoFrame = new St.Bin({style_class: 'albumart30-box', x_align: St.Align.START});

        this._bin = new St.Bin();
        this._bin.set_size(this.width, this.height);

        this._images = [];
        if (this._photoFrame && (this._bin != null)) {
            this._photoFrame.set_child(this._bin);
            this.setContent(this._photoFrame);
        }

        if (this.dir_file != null && this.dir_file.query_exists(null)) {
            this._scan_dir(this.dir);

            this.updateInProgress = false;
            this.currentPicture = null;

            this.update_id = null;
            this._update_loop();
        }
    }

    _update_loop() {
        if (!this.isLooping) return false;
        this._update();
        if (this.isLooping)
            //~ this.update_id = Mainloop.timeout_add_seconds(this.delay, Lang.bind(this, this._update_loop));
            this.update_id = timeout_add_seconds(this.delay, () => { this._update_loop() });
        else
            return false;
    }

    _size_pic(image) {
        image.disconnect(image._notif_id);

        let height, width;
        let imageRatio = image.width / image.height;
        let frameRatio = this.width / this.height;

        if (imageRatio > frameRatio) {
            width = this.width;
            height = this.width / imageRatio;
        } else {
            height = this.height;
            width = this.height * imageRatio;
        }

        image.set_size(width, height);
    }

    _update() {
        if (this.updateInProgress) {
            return;
        }
        this.updateInProgress = true;
        let image_path;
        if (!this.shuffle) {
            image_path = this._images.shift();
            this._images.push(image_path);
        } else {
            image_path = this._images[Math.floor(Math.random() * this._images.length)];
        }

        if (this.currentPicture && this.old_image_path && this.old_image_path == image_path) {
            this.updateInProgress = false;
            return;
        }

        this.old_image_path = image_path;

        if (!image_path) {
            this.updateInProgress = false;
            return;
        }

        let image = this._loadImage(image_path);

        if (image == null) {
            this.updateInProgress = false;
            return;
        }

        let old_pic = this.currentPicture;
        this.currentPicture = image;
        this.currentPicture.path = image_path;

        if (this.fade_delay > 0) {
            let _transition = "easeNone";
            if (this.fade_effect != "None")
                _transition = "easeOut"+this.fade_effect;
            if (this._bin != null) {
                Tweener.addTween(this._bin, {
                    opacity: 255,
                    time: 0,
                    transition: _transition,
                    onComplete: () => {
                        if (this._bin != null) {
                            this._bin.set_child(this.currentPicture);
                            Tweener.addTween(this._bin, {
                                opacity: 0,
                                time: this.fade_delay,
                                transition: _transition,
                            });
                        }
                    }
                });
            }
        } else {
            if (this._bin != null) this._bin.set_child(this.currentPicture);
        }
        //~ if (old_pic) {
            //~ old_pic.destroy();
        //~ }

        this.updateInProgress = false;
    }

    on_desklet_clicked(event) {
        try {
            if (event.get_button() == 1) {
                this.on_setting_changed();
            } else if (event.get_button() == 2) {
                if (this.currentPicture != null)
                    Util.spawn(['xdg-open', this.currentPicture.path]);
            }
        } catch (e) {
            global.logError(e);
        }
    }

    /**
     * on_desklet_added_to_desktop:
     *
     * This function is called by deskletManager when the desklet is added to the desktop.
     */
     on_desklet_added_to_desktop(userEnabled) {
         // Set "Display Album Art at full size" menu item, in top position:
        let displayCoverArtInRealSize = new PopupMenu.PopupIconMenuItem(_("Display Album Art at full size"), "image-x-generic-symbolic", St.IconType.SYMBOLIC);
        displayCoverArtInRealSize.connect("activate", (event) => {
            if (this.currentPicture != null)
                GLib.spawn_command_line_async("xdg-open "+this.currentPicture.path);
        });
        this._menu.addMenuItem(displayCoverArtInRealSize, 0); // 0 for top position.
    }

    _loadImage(filePath) {
        try {
            let image = St.TextureCache.get_default().load_uri_async(filePath, this.width, this.height);

            //~ image._notif_id = image.connect('notify::size', Lang.bind(this, this._size_pic));
            image._notif_id = image.connect('notify::size', (image) => { this._size_pic(image); });

            return image;
        } catch (x) {
            // Probably a non-image is in the folder
            return null;
        }
    }
}

function main(metadata, desklet_id) {
    return new AlbumArtRadio30(metadata, desklet_id);
}
