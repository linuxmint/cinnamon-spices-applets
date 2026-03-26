const {XletSettingsBase} = imports.ui.settings;  // Only for JSDoc
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

/** A `Cinnamon desktop` background handler that detects and applies the background settings. */
module.exports = class Background_handler {
    /**
    * @param {XletSettingsBase} settings - The settings of the desk/applet.
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

    /** Detects and saves the current background settings applied to Cinnamon desktop. */
    detect() {
        this.is_slideshow = IO.SLIDESHOW.get_boolean(IO.KEYS.IS_SLIDESHOW);
        if (!this.is_slideshow)  // Irrelevant to get both
            this.background_file = IO.BACKGROUND.get_string(IO.KEYS.BACKGROUND_FILE);
        else
            // The widget filechooser set as 'folderchooser' gives the URI prefixed with `file://` instead of `directory://`.
            // https://github.com/linuxmint/cinnamon/issues/12374
            // This "replace" is done so the widget display the folder correctly (it wants 'file://'):
            this.slideshow_folder = IO.SLIDESHOW.get_string(IO.KEYS.SLIDESHOW_FOLDER).replace('directory://', "file://");
            // Replace the above line by the below one once solved.
            // this.slideshow_folder = IO.SLIDESHOW.get_string( IO.KEYS.SLIDESHOW_FOLDER);
    }

    /** Applies the saved background settings to Cinnamon desktop. */
    apply() {
        IO.SLIDESHOW.set_boolean(IO.KEYS.IS_SLIDESHOW, this.is_slideshow);
        if (!this.is_slideshow)  // Important to not set both
            IO.BACKGROUND.set_string(IO.KEYS.BACKGROUND_FILE, this.background_file);
        else
            // The widget filechooser set as 'folderchooser' gives the URI prefixed with `file://` instead of `directory://`.
            // https://github.com/linuxmint/cinnamon/issues/12374
            // This "replace" is done so the saved value from the widget is applied correctly to Cinnamon settings:
            IO.SLIDESHOW. set_string(IO.KEYS.SLIDESHOW_FOLDER, decodeURIComponent(this.slideshow_folder.replace('file://', "directory://")));
            // Replace the above line by the below one once solved.
            // IO.SLIDESHOW. set_string(IO.KEYS.SLIDESHOW_FOLDER, decodeURIComponent(this.slideshow_folder));
    }
}
