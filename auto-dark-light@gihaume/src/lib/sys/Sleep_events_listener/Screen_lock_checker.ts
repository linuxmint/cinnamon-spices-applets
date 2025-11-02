const { Gio } = imports.gi;

/**
 * A gatekeeper for the screen locked state.
 *
 * When the instance is not wanted anymore, `dispose` must be called.
 */
export class Screen_lock_checker {
    /**
     * Asynchronously tries now or postpones until the screen is unlocked to execute a procedure.
     * @param callback_when_unlocked - The function to be executed when the screen is unlocked.
     */
    try_now_or_postpone_until_unlocked(
        callback_when_unlocked: () => void): void {
        Screen_lock_checker._get_state_async(is_locked => {
            if (!is_locked)
                callback_when_unlocked();
            else
                this._subscribe_to_changes(is_locked => {
                    if (is_locked)
                        return;
                    this._unsubscribe_to_changes();
                    callback_when_unlocked();
                });
        });
    }

    /** Cancels the `try_now_or_postpone_until_unlocked` procedure. */
    cancel(): void {
        this._unsubscribe_to_changes();
    }

    /** Releases acquired resources */
    dispose(): void {
        this.cancel();
    }

    private _signal_id: number | undefined = undefined;

    /** @param callback_when_changes - The function to be executed when the screen lock state changes. */
    _subscribe_to_changes(
        callback_when_changes: (is_locked: boolean) => void
    ): void {
        if (this._signal_id)
            this._unsubscribe_to_changes();
        this._signal_id = Gio.DBus.session.signal_subscribe(
            'org.cinnamon.ScreenSaver',           // sender
            'org.cinnamon.ScreenSaver',           // interface_name
            'ActiveChanged',                      // member
            '/org/cinnamon/ScreenSaver',          // object_path
            null,                                 // arg0
            Gio.DBusSignalFlags.NONE,             // flags
            (_1, _2, _3, _4, _5, parameters) => { // callback
                const is_locked = parameters.deep_unpack()[0];
                callback_when_changes(is_locked);
            }
        );
    }

    _unsubscribe_to_changes(): void {
        if (!this._signal_id)
            return;
        Gio.DBus.session.signal_unsubscribe(this._signal_id);
        this._signal_id = undefined;
    }

    /**
     * Gets the current screen lock state asynchronously.
     * @param callback_for_result - The callback object to handle the result.
     */
    static _get_state_async(
        callback_for_result: (is_locked: boolean) => void
    ): void {
        Gio.DBus.session.call(
            'org.cinnamon.ScreenSaver',  // bus_name
            '/org/cinnamon/ScreenSaver', // object_path
            'org.cinnamon.ScreenSaver',  // interface_name
            'GetActive',                 // method_name
            null,                        // parameters
            null,                        // reply_type
            Gio.DBusCallFlags.NONE,      // flags
            -1,                          // timeout_msec
            null,                        // cancellable
            (connection, result) => {    // callback
                const reply = connection.call_finish(result);
                const is_locked = reply.deep_unpack()[0];
                callback_for_result(is_locked);
            }
        );
    }
}
