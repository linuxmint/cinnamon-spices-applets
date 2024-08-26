const Gio = imports.gi.Gio;

/**
 * Listens for changes in the color scheme and calls the provided callback
 */
class Color_scheme_change_listener {
    #interface = Gio.Settings.new('org.x.apps.portal');
    #callback;
    #signal_id;

    constructor(on_color_scheme_change_callback) {
        this.#callback = on_color_scheme_change_callback;
    }

    enable() {
        this.disable(); // Ensure only one signal is connected
        this.#signal_id =
            this.#interface.connect('changed::color-scheme', this.#callback);
    }

    disable() {
        if (this.#signal_id !== undefined) {
            this.#interface.disconnect(this.#signal_id);
            this.#signal_id = undefined;
        }
    }

    /**
     * Declare the object as finished to release any ressource acquired.
     */
    finalize() { this.disable(); }
}

module.exports = Color_scheme_change_listener;
