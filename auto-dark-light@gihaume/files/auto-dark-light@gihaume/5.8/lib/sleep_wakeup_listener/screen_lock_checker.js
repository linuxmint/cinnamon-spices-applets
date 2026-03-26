const Dbus = require('lib/dbus.js');

/** A gatekeeper for the screen locked state. */
module.exports = class Screen_lock_checker {
    #dbus_screen_lock = new Dbus.Screen_lock();

    /**
     * Tries now or postpones until the screen is unlocked to execute a procedure.
     * @param {() => void} callback_when_unlocked - The function to be executed when the screen is unlocked.
     */
    try_now_or_postpone_until_unlocked(callback_when_unlocked) {
        Dbus.Screen_lock.get_state_async((is_locked) => {
            if (!is_locked)
                callback_when_unlocked();
            else
                this.#dbus_screen_lock.subscribe_to_changes((is_locked) => {
                    if (!is_locked) {
                        this.#dbus_screen_lock.unsubscribe_to_changes();
                        callback_when_unlocked();
                    }
                });
        });
    }

    /** Cancels the `try_now_or_postpone_until_unlocked` procedure. */
    cancel() {
        this.#dbus_screen_lock.unsubscribe_to_changes();
    }

    /** Declares the object as finished to release any ressource acquired. */
    finalize() {
        this.cancel();
    }
}
