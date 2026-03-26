const Dbus = require('lib/dbus.js');

/** A listener for the system timezone changes.
 *
 * The user has to call `finalize` when it is not needed anymore.
 */
module.exports = class Timezone_change_listener {
    #timezone_dbus = new Dbus.Timezone();
    #callback;

    /** @param {() => void} callback_when_changes - The function to be executed when the system timezone changes. */
    constructor(callback_when_changes) {
        this.#callback = callback_when_changes;
    }

    enable() {
        this.#timezone_dbus.subscribe_to_changes(this.#callback.bind(this));
    }

    disable() {
        this.#timezone_dbus.unsubscribe_to_changes();
    }

    /** Declares the object as finished to release any ressource acquired. */
    finalize() {
        this.disable();
    }
}
