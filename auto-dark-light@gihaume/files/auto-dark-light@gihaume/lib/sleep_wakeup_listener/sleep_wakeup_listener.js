const Dbus                = require('./lib/dbus.js');
const Screen_lock_checker = require('./lib/sleep_wakeup_listener/screen_lock_checker.js');

/** A gatekeeper for the sleep combined with the screen locked on wakeup. */
class Sleep_wakeup_listener {
    #sleep_dbus   = new Dbus.Sleep();
    #lock_checker = new Screen_lock_checker();
    #on_sleep_entry_callback;
    #on_wakeup_unlocked_callback;

    /**
     * @param {function(): void} on_sleep_entry_callback - The function to be executed when the system goes to sleep. Will be called again even without unlock.
     * @param {function(): void} on_wakeup_unlocked_callback - The function to be executed when the system wakes up and the screen is unlocked.
     */
    constructor(on_sleep_entry_callback, on_wakeup_unlocked_callback) {
        this.#on_sleep_entry_callback     = on_sleep_entry_callback;
        this.#on_wakeup_unlocked_callback = on_wakeup_unlocked_callback;
    }

    enable() {
        this.#sleep_dbus.subscribe_to_changes((is_sleeping) => {
            if (is_sleeping)
                this.#on_sleep_entry_callback();
            else
                this.#lock_checker.try_now_or_postpone_until_unlocked(
                    this.#on_wakeup_unlocked_callback.bind(this)
                );
        });
    }

    disable() {
        this.#sleep_dbus.unsubscribe_to_changes();
        this.#lock_checker.cancel();
    }

    /** Declare the object as finished to release any ressource acquired. */
    finalize() {
        this.#sleep_dbus.unsubscribe_to_changes();
        this.#lock_checker.finalize();
    }
}

module.exports = Sleep_wakeup_listener;
