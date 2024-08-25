const Dbus = require('./lib/dbus.js');

/**
 * A gatekeeper for the screen locked state.
 */
class Screen_lock_handler {
    #lock = new Dbus.Screen_lock();

    /**
     * Try now or postpone until the screen is unlocked to execute a procedure.
     * @param {function(): void} on_unlock_callback - The function to be executed when the screen is unlocked.
     */
    try_now_or_postpone_until_unlocked(on_unlock_callback) {
        Dbus.Screen_lock.get_state_async((is_locked) => {
            if (!is_locked)
                on_unlock_callback();
            else
                this.#lock.subscribe_to_changes((is_locked) => {
                    if (!is_locked) {
                        this.#lock.unsubscribe_to_changes();
                        on_unlock_callback();
                    }
                });
        });
    }

    /**
     * Cancel the `try_now_or_postpone` procedure.
     */
    cancel() { this.#lock.unsubscribe_to_changes(); }

    /**
     * Declare the object as finished to release any ressource acquired.
     */
    finalize() { this.cancel(); }
}

module.exports = Screen_lock_handler;
