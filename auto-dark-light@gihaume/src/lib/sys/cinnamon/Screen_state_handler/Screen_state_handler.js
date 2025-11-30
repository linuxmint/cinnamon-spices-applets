/** @typedef {import('../../../../types.js').Observer} Observer */
import { Screen_presence_listener } from './Screen_presence_listener.js';
import { Screen_unlock_waiter } from './Screen_unlock_waiter.js';

/**
 * A handler to react when the system is entering sleep or has just wake up and is unlocked.
 * @implements {Observer}
 */
export class Screen_state_handler {
    /** @private @readonly */
    _unlock_waiter = new Screen_unlock_waiter();

    /** @private @readonly */
    _presence_listener = new Screen_presence_listener();

    /** The function to call when the system is entering sleep or has just wake up and is unlocked (`is_present` at `false`).
     * @type {((is_present: boolean) => void) | null} */
    callback = null;

    constructor() {
        this._presence_listener.callback = async is_present => {
            if (!is_present)
                await this._unlock_waiter.wait_if_locked();
            this.callback?.(!is_present);
        };
    }

    enable() {
        this._presence_listener.enable();
    }

    disable() {
        this._unlock_waiter.unblock_wait_if_locked();
        this._presence_listener.disable();
    }

    dispose() {
        this._unlock_waiter.dispose();
        this._presence_listener.dispose();
    }
}
