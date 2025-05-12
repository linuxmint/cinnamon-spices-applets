const Gio = imports.gi.Gio;

/** A listenener for changes in the color scheme which calls a provided callback */
module.exports = class Color_scheme_change_listener {
    #interface = Gio.Settings.new('org.x.apps.portal');
    #callback;
    #signal_id;

    /** @param {() => void} callback_when_color_scheme_changes - The function to be executed when the color scheme changes. */
    constructor(callback_when_color_scheme_changes) {
        this.#callback = callback_when_color_scheme_changes;
    }

    enable() {
        this.disable(); // Ensures only one signal is connected
        this.#signal_id =
            this.#interface.connect('changed::color-scheme', this.#callback);
    }

    disable() {
        if (this.#signal_id !== undefined) {
            this.#interface.disconnect(this.#signal_id);
            this.#signal_id = undefined;
        }
    }

    /** Declares the object as finished to release any ressource acquired. */
    finalize() {
        this.disable();
    }
}
