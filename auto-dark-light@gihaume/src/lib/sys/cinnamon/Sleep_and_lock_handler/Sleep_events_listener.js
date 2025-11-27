const { Gio } = imports.gi;

/** @typedef {import('../../../../types').Observer} Observer */

/**
 * An interface to listen to the sleep entering and waking events.
 *
 * @implements {Observer}
 */
export class Sleep_events_listener {
    /** @private @type {number | null} */
    _signal_id = null;

    /** The function to call when the system is entering sleep or has just wake up (`is_entering_sleep` at `false`).
     * @type {((is_entering_sleep: boolean) => void) | null} */
    callback = null;

    enable() {
        if (this._signal_id)
            return;
        this._signal_id = Gio.DBus.system.signal_subscribe(
            'org.freedesktop.login1',             // sender
            'org.freedesktop.login1.Manager',     // interface_name
            'PrepareForSleep',                    // member
            '/org/freedesktop/login1',            // object_path
            null,                                 // arg0
            Gio.DBusSignalFlags.NONE,             // flags
            (_1, _2, _3, _4, _5, parameters) => { // callback
                const is_entering_sleep = parameters.deep_unpack()[0];
                this.callback?.(is_entering_sleep);
            }
        );
    }

    disable() {
        if (!this._signal_id)
            return;
        Gio.DBus.system.signal_unsubscribe(this._signal_id);
        this._signal_id = null;
    }

    dispose() {
        this.disable();
    }
}
