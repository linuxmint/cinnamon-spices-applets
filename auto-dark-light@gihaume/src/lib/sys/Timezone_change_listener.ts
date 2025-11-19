const { Gio } = imports.gi;

/**
 * A listener for the system timezone changes.
 *
 * When the instance is not wanted anymore, `dispose` must be called.
 */
export class Timezone_change_listener {
    private readonly _callback_on_change: (new_timezone: string) => void;

    /** @param callback_on_change - The function to be executed when the system timezone changes. */
    constructor(callback_on_change: (new_timezone: string) => void) {
        this._callback_on_change = callback_on_change;
    }

    enable(): void {
        this._subscribe_to_changes(this._callback_on_change.bind(this));
    }

    disable(): void {
        this._unsubscribe_to_changes();
    }

    /** Releases acquired resources */
    dispose(): void {
        this.disable();
    }

    private _signal_id: number | undefined = undefined;

    private _subscribe_to_changes(
        callback_when_changes: (new_timezone: string) => void
    ): void {
        if (this._signal_id)
            this._unsubscribe_to_changes();
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
                    callback_when_changes(new_timezone);
                }
            }
        );
    }

    private _unsubscribe_to_changes(): void {
        if (!this._signal_id)
            return;
        Gio.DBus.system.signal_unsubscribe(this._signal_id);
        this._signal_id = undefined;
    }
}
