const { Gio } = imports.gi;

/** @typedef {import('../../../types').Observer} Observer */

/**
 * A listener for the system timezone changes.
 * @implements {Observer}
 */
export class Timezone_change_listener {
    /** @private @type {number | null} */
    _signal_id = null;

    /** The function to call when the system timezone changes.
     * @type {((new_timezone: string) => void) | null} */
    callback = null;

    enable() {
        if (this._signal_id !== null)
            return;
        this._signal_id = Gio.DBus.system.signal_subscribe(
            'org.freedesktop.timedate1',          // sender
            'org.freedesktop.DBus.Properties',    // interface_name
            'PropertiesChanged',                  // member
            '/org/freedesktop/timedate1',         // object_path
            null,                                 // arg0
            Gio.DBusSignalFlags.NONE,             // flags
            (_1, _2, _3, _4, _5, parameters) => { // callback
                const changed_properties = parameters.deep_unpack()[1];
                if (changed_properties['Timezone']) {
                    const new_timezone =
                        changed_properties['Timezone'].deep_unpack();
                    this.callback?.(new_timezone);
                }
            }
        );
    }

    disable() {
        if (this._signal_id === null)
            return;
        Gio.DBus.system.signal_unsubscribe(this._signal_id);
        this._signal_id = null;
    }

    dispose() {
        this.disable();
    }
}
