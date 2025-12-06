const { gnomeSession } = imports.misc;

/** @typedef {import('../../../../types').Observer} Observer */

/**
 * An interface to read and listen to the screen presence state for i.e. detecting when entering and leaving sleep.
 * @implements {Observer}
 */
export class Screen_presence_listener {
    /** @private @type {number | null} */
    _signal_id = null;

    /** @private @readonly @type {imports.gi.Gio.DBusProxy} */
    _presence_proxy = gnomeSession.Presence();

    /** @type {((is_present: boolean) => void) | null} */
    callback = null;

    enable() {
        if (this._signal_id !== null)
            return;
        this._signal_id = this._presence_proxy.connectSignal('StatusChanged',
            /**
             * @param {any} _0
             * @param {any} _1
             * @param {[number]} params
             */
            (_0, _1, [presenceStatus]) => {
                this.callback?.(
                    presenceStatus === gnomeSession.PresenceStatus.AVAILABLE
                );
            }
        );
    }

    disable() {
        if (this._signal_id === null)
            return;
        this._presence_proxy.disconnectSignal(this._signal_id);
        this._signal_id = null;
    }

    dispose() {
        this.disable();
    }
}
