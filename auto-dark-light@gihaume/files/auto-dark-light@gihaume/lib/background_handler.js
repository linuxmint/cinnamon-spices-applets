const Gio = imports.gi.Gio;

const IO = {
    BACKGROUND : new Gio.Settings({schema: "org.cinnamon.desktop.background"}),
    SLIDESHOW :  new Gio.Settings({schema: "org.cinnamon.desktop.background.slideshow"}),
    KEYS: {
        IS_SLIDESHOW:     'slideshow-enabled',
        BACKGROUND_FILE:  'picture-uri',
        SLIDESHOW_FOLDER: 'image-source'
    }
};

/**
 * A `Cinnamon desktop` background handler that detects and applies the background settings.
 */
class Background_handler {
    /**
    * @param {Settings.XletSettingsBase} settings - The settings of the desk/applet.
    * @param {object} keys - The keys of the settings' memorized variables.
    * @param {string} keys.is_slideshow - The key for the slideshow state.
    * @param {string} keys.background_file - The key for the background file.
    * @param {string} keys.slideshow_folder - The key for the slideshow folder.
    */
    constructor(settings, keys) {
        settings.bindWithObject(this, keys.is_slideshow,     "is_slideshow");
        settings.bindWithObject(this, keys.background_file,  "background_file");
        settings.bindWithObject(this, keys.slideshow_folder, "slideshow_folder");
    }

    /**
     * Detects and save the current background settings applied to Cinnamon desktop.
     */
    detect() {
        this.is_slideshow     = IO.SLIDESHOW. get_boolean(IO.KEYS.IS_SLIDESHOW);
        this.background_file  = IO.BACKGROUND.get_string( IO.KEYS.BACKGROUND_FILE);

        // https://github.com/linuxmint/cinnamon/issues/12374
        // Replace the uncommented line by the commented one once solved.
        // this.slideshow_folder = IO.SLIDESHOW. get_string( IO.KEYS.SLIDESHOW_FOLDER);
        this.slideshow_folder = IO.SLIDESHOW.get_string(IO.KEYS.SLIDESHOW_FOLDER).replace('directory://', "file://");
    }

    /**
     * Applies the saved background settings to Cinnamon desktop.
     */
    apply() {
        IO.SLIDESHOW. set_boolean(IO.KEYS.IS_SLIDESHOW,     this.is_slideshow);
        IO.BACKGROUND.set_string( IO.KEYS.BACKGROUND_FILE,  this.background_file);

        // https://github.com/linuxmint/cinnamon/issues/12374
        // Replace the uncommented line by the commented one once solved.
        // IO.SLIDESHOW. set_string( IO.KEYS.SLIDESHOW_FOLDER, this.slideshow_folder);
        IO.SLIDESHOW. set_string( IO.KEYS.SLIDESHOW_FOLDER, this.slideshow_folder.replace('file://', "directory://"));
    }
}

module.exports = Background_handler;
