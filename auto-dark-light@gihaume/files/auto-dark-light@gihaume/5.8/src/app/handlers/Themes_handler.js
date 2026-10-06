import { Color_scheme_handler as Color_scheme } from '../../lib/cinnamon/Color_scheme_handler.js';
import { Themes_accessor as Themes } from '../../lib/cinnamon/Themes_accessor.js';

/** @typedef {import('../ui/Applet.js').Applet} Applet */
/** @typedef {import('../ui/Settings.js').Settings} Settings */

export class Themes_handler {
    /** @private @readonly @type {Settings} */ _settings;

    /**
     * @param {Applet} applet
     * @param {Settings} settings
     */
    constructor(applet, settings) {
        this._settings = settings;

        applet.on_button_detect_themes_light = () => this.detect_light_themes();
        applet.on_button_detect_themes_dark = () => this.detect_dark_themes();
        applet.on_button_apply_themes_light = () => this.apply_light_themes();
        applet.on_button_apply_themes_dark = () => this.apply_dark_themes();
    }

    /** @returns {void} */
    detect_light_themes() {
        this._settings.setValue('light_themes_mouse',   Themes.mouse);
        this._settings.setValue('light_themes_apps',    Themes.apps);
        this._settings.setValue('light_themes_icons',   Themes.icons);
        this._settings.setValue('light_themes_desktop', Themes.desktop);
        this._settings.light_themes_have_been_detected = true;
    }

    /** @returns {void} */
    detect_dark_themes() {
        this._settings.setValue('dark_themes_mouse',   Themes.mouse);
        this._settings.setValue('dark_themes_apps',    Themes.apps);
        this._settings.setValue('dark_themes_icons',   Themes.icons);
        this._settings.setValue('dark_themes_desktop', Themes.desktop);
        this._settings.dark_themes_have_been_detected = true;
    }

    /** @returns {void} */
    apply_light_themes() {
        Themes.mouse   = this._settings.getValue('light_themes_mouse');
        Themes.apps    = this._settings.getValue('light_themes_apps');
        Themes.icons   = this._settings.getValue('light_themes_icons');
        Themes.desktop = this._settings.getValue('light_themes_desktop');
        Color_scheme.value = 'prefer-light';
    }

    /** @returns {void} */
    apply_dark_themes() {
        Themes.mouse   = this._settings.getValue('dark_themes_mouse');
        Themes.apps    = this._settings.getValue('dark_themes_apps');
        Themes.icons   = this._settings.getValue('dark_themes_icons');
        Themes.desktop = this._settings.getValue('dark_themes_desktop');
        Color_scheme.value = 'prefer-dark';
    }
}
