const { ScreenSaverProxy } = imports.misc.screenSaver;

/** @typedef {import('../../../types').Observer} Observer */

/**
 * An interface to read and listen to the screen locked state.
 *
 * @implements {Observer}
 */
export class Screen_lock_change_listener {
    /** @private @type {number | null} */
    _signal_id = null;

    /** @private @readonly @type {imports.gi.Gio.DBusProxy} */
    _screen_saver_proxy = ScreenSaverProxy();

    // /**
    //  * Asynchronously tries now or postpones until the screen is unlocked to execute a procedure.
    //  * @param {() => void} callback_when_unlocked - The function to be executed when the screen is unlocked.
    //  */
    // try_now_or_postpone_until_unlocked(callback_when_unlocked) {
    //     if (!this.is_locked) {
    //         callback_when_unlocked();
    //     } else {
    //         this._subscribe_to_changes(is_locked => {
    //             if (is_locked)
    //                 return;
    //             this._unsubscribe_to_changes();
    //             callback_when_unlocked();
    //         });
    //     }
    // }

    /** @returns {boolean} */
    get is_locked() {
        return this._screen_saver_proxy.screenSaverActive;
    }

    /** @type {((is_locked: boolean) => void) | null} */
    callback = null;

    enable() {
        if (this._signal_id)
            return;
        this._signal_id = this._screen_saver_proxy.connectSignal('ActiveChanged',
            /**
             * @param {any} _0
             * @param {any} _1
             * @param {[boolean]} params
             */
            (_0, _1, [screenSaverActive]) => {
                this.callback?.(screenSaverActive);
            }
        );
    }

    disable() {
        if (!this._signal_id)
            return;
        this._screen_saver_proxy.disconnectSignal(this._signal_id);
        this._signal_id = null;
    }

    dispose() {
        this.disable();
    }
}
