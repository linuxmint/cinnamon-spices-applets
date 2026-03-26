const Dbus                = require('lib/dbus.js');
const Screen_lock_checker = require('lib/sleep_wakeup_listener/screen_lock_checker.js');

/** A gatekeeper for the sleep combined with the screen locked on wakeup. */
module.exports = class Sleep_wakeup_listener {
    #dbus_sleep   = new Dbus.Sleep();
    #screen_lock_checker = new Screen_lock_checker();
    #callback_when_sleep_entries;
    #callback_when_wakeup_unlocked;

    /**
     * @param {() => void} callback_when_sleep_entries - The function to be executed when the system goes to sleep. Will be called again even without unlock.
     * @param {() => void} callback_when_wakeup_unlocked - The function to be executed when the system wakes up and the screen is unlocked.
     */
    constructor(callback_when_sleep_entries, callback_when_wakeup_unlocked) {
        this.#callback_when_sleep_entries   = callback_when_sleep_entries;
        this.#callback_when_wakeup_unlocked = callback_when_wakeup_unlocked;
    }

    enable() {
        this.#dbus_sleep.subscribe_to_changes((is_sleeping) => {
            if (is_sleeping)
                this.#callback_when_sleep_entries();
            else
                this.#screen_lock_checker.try_now_or_postpone_until_unlocked(
                    this.#callback_when_wakeup_unlocked.bind(this)
                );
        });
    }

    disable() {
        this.#dbus_sleep.unsubscribe_to_changes();
        this.#screen_lock_checker.cancel();
    }

    /** Declares the object as finished to release any ressource acquired. */
    finalize() {
        this.#dbus_sleep.unsubscribe_to_changes();
        this.#screen_lock_checker.finalize();
    }
}
