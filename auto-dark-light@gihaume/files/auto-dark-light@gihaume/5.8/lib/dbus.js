const {Gio, GLib} = imports.gi;

module.exports = class Dbus { // namespace-like
    /** An interface to read and subscribe to changes in the system screensaver lock state. */
    static Screen_lock = class {
        #signal_id;

        /**
         * Listens to the screensaver lock state changes.
         * @param {(is_locked: boolean) => void} callback - The callback function to be executed when the screen saver lock state changes.
         */
        subscribe_to_changes(callback) {
            if (this.#signal_id)
                return;
            this.#signal_id = Gio.DBus.session.signal_subscribe(
                'org.cinnamon.ScreenSaver',           // sender
                'org.cinnamon.ScreenSaver',           // interface_name
                'ActiveChanged',                      // member
                '/org/cinnamon/ScreenSaver',          // object_path
                null,                                 // arg0
                Gio.DBusSignalFlags.NONE,             // flags
                (_1, _2, _3, _4, _5, parameters) => { // callback
                    const is_locked = parameters.deep_unpack()[0];
                    callback(is_locked);
                }
            );
        }

        unsubscribe_to_changes() {
            if (!this.#signal_id)
                return;
            Gio.DBus.session.signal_unsubscribe(this.#signal_id);
            this.#signal_id = undefined;
        }

        /**
         * Gets the current screensaver lock state asynchronously.
         * @param {object} callback - The callback object to handle the result.
         * @property {boolean} callback.is_locked - The lock state.
         */
        static get_state_async(callback) {
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
                    callback(is_locked);
                }
            );
        }
    }

    /** An interface subscribe to changes in the system sleep/wakeup state. */
    static Sleep = class {
        #signal_id;

        /**
         * Listens to the system sleep/wakeup state changes.
         * @param {(is_sleeping: boolean) => void} callback - The callback function to be executed when the system sleep state changes.
         */
        subscribe_to_changes(callback) {
            if (this.#signal_id)
                return;
            this.#signal_id = Gio.DBus.system.signal_subscribe(
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

        unsubscribe_to_changes() {
            if (!this.#signal_id)
                return;
            Gio.DBus.system.signal_unsubscribe(this.#signal_id);
            this.#signal_id = undefined;
        }
    }

    /** An interface to read and subscribe to changes in the system timezone. */
    static Timezone = class {
        #signal_id;

        /**
         * Listens to the system timezone changes.
         * @param {(new_timezone: string) => void} callback - The callback function to be executed when the timezone changes.
         */
        subscribe_to_changes(callback) {
            if (this.#signal_id)
                return;
            this.#signal_id = Gio.DBus.system.signal_subscribe(
                'org.freedesktop.timedate1',          // sender
                'org.freedesktop.DBus.Properties',    // interface_name
                'PropertiesChanged',                  // member
                '/org/freedesktop/timedate1',         // object_path
                null,                                 // arg0
                Gio.DBusSignalFlags.NONE,             // flags
                (_1, _2, _3, _4, _5, parameters) => { // callback
                    const changed_properties = parameters.deep_unpack()[1];
                    if (changed_properties['Timezone']) {
                        const new_timezone = changed_properties['Timezone'].deep_unpack();
                        callback(new_timezone);
                    }
                }
            );
        }

        unsubscribe_to_changes() {
            if (!this.#signal_id)
                return;
            Gio.DBus.system.signal_unsubscribe(this.#signal_id);
            this.#signal_id = undefined;
        }

        /** @returns {string} The current system timezone. */
        static get_current() {
            const reply = Gio.DBus.system.call_sync(
                'org.freedesktop.timedate1',       // bus_name
                '/org/freedesktop/timedate1',      // object_path
                'org.freedesktop.DBus.Properties', // interface_name
                'Get',                             // method_name
                new GLib.Variant(                  // parameters
                    '(ss)',
                    ['org.freedesktop.timedate1', 'Timezone']
                ),
                GLib.VariantType.new('(v)'),       // reply_type
                Gio.DBusCallFlags.NONE,            // flags
                -1,                                // timeout_msec
                null                               // cancellable
            );
            const variant = reply.deep_unpack()[0];
            const timezone = variant.deep_unpack();
            return timezone;
        }
    }
}
