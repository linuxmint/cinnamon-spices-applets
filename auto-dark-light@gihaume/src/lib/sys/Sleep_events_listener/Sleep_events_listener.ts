const {Gio} = imports.gi;

import { Screen_lock_checker } from './Screen_lock_checker';

/**
 * A gatekeeper for the sleep combined with the screen locked on wakeup.
 *
 * When the instance is not wanted anymore, `dispose` must be called.
 */
export class Sleep_events_listener {
    private readonly _callback_when_sleep_entries: () => void;
    private readonly _callback_when_wakeup_unlocked: () => void;

    /**
     * @param callback_when_sleep_entries - The function to be executed when the system goes to sleep. Will be called again even without unlock.
     * @param callback_when_wakeup_unlocked - The function to be executed when the system wakes up and the screen is unlocked.
     */
    constructor(
        callback_when_sleep_entries: () => void,
        callback_when_wakeup_unlocked: () => void
    ) {
        this._callback_when_sleep_entries = callback_when_sleep_entries;
        this._callback_when_wakeup_unlocked = callback_when_wakeup_unlocked;
    }

    private readonly _screen_lock_checker = new Screen_lock_checker();

    enable(): void {
        this._subscribe_to_changes(is_sleeping => {
            if (is_sleeping)
                this._callback_when_sleep_entries();
            else
                this._screen_lock_checker.try_now_or_postpone_until_unlocked(
                    () => this._callback_when_wakeup_unlocked()
                );
        });
    }

    disable(): void {
        this._unsubscribe_to_changes();
        this._screen_lock_checker.cancel();
    }

    /** Releases acquired resources */
    dispose(): void {
        this._unsubscribe_to_changes();
        this._screen_lock_checker.dispose();
    }

    private _signal_id: number | undefined = undefined;

    /** @param callback - The function to be executed when the system sleep state changes. */
    _subscribe_to_changes(callback: (is_sleeping: boolean) => void): void {
        if (this._signal_id)
            this._unsubscribe_to_changes();
        this._signal_id = Gio.DBus.system.signal_subscribe(
            'org.freedesktop.login1',             // sender
            'org.freedesktop.login1.Manager',     // interface_name
            'PrepareForSleep',                    // member
            '/org/freedesktop/login1',            // object_path
            null,                                 // arg0
            Gio.DBusSignalFlags.NONE,             // flags
            (_1, _2, _3, _4, _5, parameters) => { // callback
                const is_sleeping = parameters.deep_unpack()[0];
                callback(is_sleeping);
            }
        );
    }

    _unsubscribe_to_changes(): void {
        if (!this._signal_id)
            return;
        Gio.DBus.system.signal_unsubscribe(this._signal_id);
        this._signal_id = undefined;
    }
}
