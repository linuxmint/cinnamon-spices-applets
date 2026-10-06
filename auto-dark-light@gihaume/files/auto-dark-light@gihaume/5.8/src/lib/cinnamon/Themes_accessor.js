import Gio from 'gi://Gio';

const settings = /** @type {const} */ ({
    desktop:  Gio.Settings.new('org.cinnamon.desktop.interface'),
    cinnamon: Gio.Settings.new('org.cinnamon.theme')
});

/** An accessor to the Cinnamon system themes settings. */
export class Themes_accessor {
    /** @returns {string} */
    static get mouse() {
        return settings.desktop.get_string('cursor-theme');
    }
    static set mouse(/** @type {string} */ value) {
        settings.desktop.set_string('cursor-theme', value);
    }

    /** @returns {string} */
    static get apps() {
        return settings.desktop.get_string('gtk-theme');
    }
    static set apps(/** @type {string} */ value) {
        settings.desktop.set_string('gtk-theme', value);
    }

    /** @returns {string} */
    static get icons() {
        return settings.desktop.get_string('icon-theme');
    }
    static set icons(/** @type {string} */ value) {
        settings.desktop.set_string('icon-theme', value);
    }

    /** @returns {string} */
    static get desktop() {
        return settings.cinnamon.get_string('name');
    }
    static set desktop(/** @type {string} */ value) {
        settings.cinnamon.set_string('name', value);
    }
}
