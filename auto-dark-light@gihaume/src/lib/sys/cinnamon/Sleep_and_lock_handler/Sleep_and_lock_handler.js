/** @typedef {import('../../../../types.js').Observer} Observer */
import { Screen_unlock_waiter } from './Screen_unlock_waiter.js';
import { Sleep_events_listener } from './Sleep_events_listener.js';

/**
 * A handler to wait until the screen is unlocked.
 * @implements {Observer}
 */
export class Sleep_and_lock_handler {
    /** @private @readonly */
    _unlock_waiter = new Screen_unlock_waiter();

    /** @private @readonly */
    _sleep_events = new Sleep_events_listener();

    /** The function to call when the system is entering sleep or has just wake up and is unlocked (`is_entering_sleep` at `false`).
     * @type {((is_entering_sleep: boolean) => void) | null} */
    callback = null;

    constructor() {
        this._sleep_events.callback = async is_entering_sleep => {
            if (!is_entering_sleep)
                await this._unlock_waiter.wait_if_locked();
            this.callback?.(is_entering_sleep);
        };
    }

    enable() {
        this._sleep_events.enable();
    }

    disable() {
        this._unlock_waiter.unblock_wait_if_locked();
        this._sleep_events.disable();
    }

    dispose() {
        this._unlock_waiter.dispose();
        this._sleep_events.dispose();
    }
}
