const Dbus = require('./lib/dbus.js');

/**
 * A listener for the system timezone changes.
 */
class Timezone_change_listener {
    #timezone_dbus = new Dbus.Timezone();
    #callback;

    /**
     * @param {function(): void} on_timezone_change_callback - The callback function to be executed when the system timezone changes.
     */
    constructor(on_timezone_change_callback) {
        this.#callback = on_timezone_change_callback;
    }

    /**
     * Enable the listener.
     */
    enable() {
        this.#timezone_dbus.subscribe_to_changes(this.#callback.bind(this));
    }

    /**
     * Disable the listener.
     */
    disable() { this.#timezone_dbus.unsubscribe_to_changes(); }

    /**
     * Declare the object as finished to release any ressource acquired.
     */
    finalize() { this.disable(); }
}

module.exports = Timezone_change_listener;
