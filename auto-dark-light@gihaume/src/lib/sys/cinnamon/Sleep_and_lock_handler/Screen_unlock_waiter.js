/** @typedef {import('../../../../types.js').Disposable} Disposable */
import { Screen_lock_change_listener } from './Screen_lock_change_listener.js';

/**
 * A handler to wait until the screen is unlocked.
 * @implements {Disposable}
 */
export class Screen_unlock_waiter {
    /** @private @readonly */
    _screen_lock = new Screen_lock_change_listener();

    /** @private @type {(() => void) | null} */
    _unblock_wait_if_locked = null;

    /** Waits until the screen is unlocked or returns immediately if it is already unlocked.
     * @returns {Promise<void>} */
    wait_if_locked() {
        return new Promise(resolve => {
            if (!this._screen_lock.is_locked) {
                resolve();
                return;
            }
            this._unblock_wait_if_locked = resolve;
            this._screen_lock.callback = (/**@type {boolean} */ is_locked) => {
                if (is_locked)
                    return;
                this._screen_lock.disable();
                this._screen_lock.callback = null;
                this._unblock_wait_if_locked = null;
                resolve();
            };
            this._screen_lock.enable();
        });
    }

    /** Note: it doesn't do anything if not currently waiting.
     * @returns {void} */
    unblock_wait_if_locked() {
        if (!this._unblock_wait_if_locked)
            return;
        this._unblock_wait_if_locked();
        this._unblock_wait_if_locked = null;
    }

    dispose() {
        this.unblock_wait_if_locked();
        this._screen_lock.dispose();
    }
}
