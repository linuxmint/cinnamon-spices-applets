const { ScreenSaverProxy } = imports.misc.screenSaver;

/** @typedef {import('../../../../types').Observer} Observer */

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

    /** @returns {boolean} */
    get is_locked() {
        return this._screen_saver_proxy.screenSaverActive;
    }

    /** @type {((is_locked: boolean) => void) | null} */
    callback = null;

    enable() {
        if (this._signal_id !== null)
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
        if (this._signal_id === null)
            return;
        this._screen_saver_proxy.disconnectSignal(this._signal_id);
        this._signal_id = null;
    }

    dispose() {
        this.disable();
    }
}
