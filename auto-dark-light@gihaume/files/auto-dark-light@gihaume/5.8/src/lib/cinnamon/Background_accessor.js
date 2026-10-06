import Gio from 'gi://Gio';

const settings = /** @type {const} */ ({
    background:  Gio.Settings.new('org.cinnamon.desktop.background'),
    slideshow:   Gio.Settings.new('org.cinnamon.desktop.background.slideshow'),
});

/** An accessor to the Cinnamon system background settings. */
export class Background_accessor {
    /** @returns {boolean} */
    static get is_slideshow() {
        return settings.slideshow.get_boolean('slideshow-enabled');
    }
    static set is_slideshow(/** @type {boolean} */ value) {
        settings.slideshow.set_boolean('slideshow-enabled', value);
    }

    /** Irrelevant to get when slideshow is enabled
     * @returns {string} */
    static get picture_file() {
        return settings.background.get_string('picture-uri');
    }
    /** /!\ To not set when slideshow is enabled */
    static set picture_file(/** @type {string} */ value) {
        settings.background.set_string('picture-uri', value);
    }

    /** Irrelevant to get when slideshow is disabled
     * @returns {string} */
    static get slideshow_folder() {
        return settings.slideshow.get_string('image-source');
    }
    /** /!\ To not set when slideshow is disabled */
    static set slideshow_folder(/** @type {string} */ value) {
        settings.slideshow.set_string('image-source', value);
    }
}
