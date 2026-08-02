import { Background_accessor as Background } from '../../lib/cinnamon/Background_accessor.js';

/** @typedef {import('../ui/Applet.js').Applet} Applet */
/** @typedef {import('../ui/Settings.js').Settings} Settings */

export class Background_handler {
    /** @private @readonly @type {Settings} */
    _settings;

    /**
     * @param {Applet} applet
     * @param {Settings} settings
     */
    constructor(applet, settings) {
        this._settings = settings;

        applet.on_button_detect_background_light =
            () => this.detect_light_background();
        applet.on_button_detect_background_dark =
            () => this.detect_dark_background();
        applet.on_button_apply_background_light =
            () => this.apply_light_background();
        applet.on_button_apply_background_dark =
            () => this.apply_dark_background();
    }

    /** @returns {void} */
    detect_light_background() {
        const is_slideshow = Background.is_slideshow;
        this._settings.light_background_is_slideshow = is_slideshow;
        if (is_slideshow)
            this._settings.light_background_slideshow_folder =
                Background.slideshow_folder
                    .replace('directory://', "file://"); // https://github.com/linuxmint/cinnamon/issues/12374
        else
            this._settings.light_background_file = Background.picture_file;
    }
    /** @returns {void} */
    detect_dark_background() {
        const is_slideshow = Background.is_slideshow;
        this._settings.dark_background_is_slideshow = is_slideshow;
        if (is_slideshow)
            this._settings.dark_background_slideshow_folder =
                Background.slideshow_folder
                    .replace('directory://', "file://"); // https://github.com/linuxmint/cinnamon/issues/12374
        else
            this._settings.dark_background_file = Background.picture_file;
    }
    /** @returns {void} */
    apply_light_background() {
        const is_slideshow = this._settings.light_background_is_slideshow;
        Background.is_slideshow = is_slideshow;
        if (is_slideshow)
            Background.slideshow_folder =
                decodeURIComponent( // If the folder was chosen via a filechooser, it may contain non-ASCII characters
                    this._settings.light_background_slideshow_folder
                        .replace('file://', "directory://") // https://github.com/linuxmint/cinnamon/issues/12374
                );
        else
            Background.picture_file =
                this._settings.light_background_file;
    }
    /** @returns {void} */
    apply_dark_background() {
        const is_slideshow = this._settings.dark_background_is_slideshow;
        Background.is_slideshow = is_slideshow;
        if (is_slideshow)
            Background.slideshow_folder =
                decodeURIComponent( // If the folder was chosen via a filechooser, it may contain non-ASCII characters
                    this._settings.dark_background_slideshow_folder
                        .replace('file://', "directory://") // https://github.com/linuxmint/cinnamon/issues/12374
                );
        else
            Background.picture_file = this._settings.dark_background_file;
    }
}
