const Gio = imports.gi.Gio;

const IO = {
    DESKTOP:  Gio.Settings.new('org.cinnamon.desktop.interface'),
    CINNAMON: Gio.Settings.new('org.cinnamon.theme'),
    X_APPS:   Gio.Settings.new('org.x.apps.portal'),
    KEYS: {
        MOUSE_POINTER: 'cursor-theme',
        APPLICATIONS:  'gtk-theme',
        ICONS:         'icon-theme',
        DESKTOP:       'name',
        COLOR_SCHEME:  'color-scheme'
    }
};

/**
 * A `Cinnamon desktop` themes handler that detects and applies the themes.
 */
class Themes_handler {
    #color_scheme;

    /**
     * @param {Settings.XletSettingsBase} settings - The settings of the desk/applet.
     * @param {boolean} is_dark - Wether the color scheme is light (false) or dark (true).
     * @param {object} keys - The keys of the settings' memorized variables.
     * @param {string} keys.mouse_pointer - The key for the mouse pointer theme.
     * @param {string} keys.applications - The key for the applications theme.
     * @param {string} keys.icons - The key for the icons theme.
     * @param {string} keys.desktop - The key for the desktop theme.
     * @param {string} keys.has_detected - The key for the "has detected" indicator.
     */
    constructor(settings, is_dark, keys) {
        settings.bindWithObject(this, keys.mouse_pointer, "mouse_pointer");
        settings.bindWithObject(this, keys.applications,  "applications");
        settings.bindWithObject(this, keys.icons,         "icons");
        settings.bindWithObject(this, keys.desktop,       "desktop");
        settings.bindWithObject(this, keys.has_detected,  "has_detected");
        this.#color_scheme = is_dark ? 'prefer-dark' : 'prefer-light';
    }

    /**
     * Detects and save the current themes applied to Cinnamon desktop.
     */
    detect() {
        this.mouse_pointer = IO.DESKTOP .get_string(IO.KEYS.MOUSE_POINTER);
        this.applications  = IO.DESKTOP .get_string(IO.KEYS.APPLICATIONS);
        this.icons         = IO.DESKTOP .get_string(IO.KEYS.ICONS);
        this.desktop       = IO.CINNAMON.get_string(IO.KEYS.DESKTOP);
        this.has_detected  = true;
    }

    /**
     * Applies the saved themes to Cinnamon desktop.
     */
    apply() {
        if (!this.has_detected)
            return;
        IO.DESKTOP .set_string(IO.KEYS.MOUSE_POINTER, this.mouse_pointer);
        IO.DESKTOP .set_string(IO.KEYS.APPLICATIONS,  this.applications);
        IO.DESKTOP .set_string(IO.KEYS.ICONS,         this.icons);
        IO.CINNAMON.set_string(IO.KEYS.DESKTOP,       this.desktop);
        IO.X_APPS  .set_string(IO.KEYS.COLOR_SCHEME,  this.#color_scheme);
    }

    get_if_has_detected() { return this.has_detected; }

    static get_system_color_scheme() {
        return IO.X_APPS.get_string(IO.KEYS.COLOR_SCHEME);
    }
}

module.exports = Themes_handler;
