const { GLib } = imports.gi;

/** @typedef {import('../../../../types').Disposable} Disposable */
import * as system_time from '../system_time.js';
/** @typedef {import('../../../core/Time_of_day').Time_of_day} Time_of_day */
import { Timer_absolute } from './Timer_absolute.js';

/**
 * A single-event scheduler which call a function at a specific next time of day.
 *
 * Under the hood it uses a monotonic timeout delay and so doesn't take into account system sleep or time changes. So to the user can check if the event should already have occurred with `get_if_should_be_expired`.
 *
 * When the instance is not wanted anymore, `dispose` must be called.
 *
 * @implements {Disposable}
 */
export class Event_scheduler {
    /** @private @type {number | null} */
    _event_id = null;

    /** @private @readonly */
    _timer_absolute = new Timer_absolute();

    /** @returns {boolean} `true` if the scheduled event should have already occurred, `false` otherwise. If the event is not set, `false` is returned. */
    get_if_should_be_expired() {
        return this._timer_absolute.get_if_has_expired();
    }

    /**
     * Calls a function at a specific next time of day.
     *
     * Note: if the event is already scheduled, it will be replaced.
     *
     * @param {Time_of_day} time - When the event should occur.
     * @param {() => void} callback_on_event - The function to be executed when the event occurs.
     * @returns {void}
     */
    set_the_event(time, callback_on_event) {
        this.unset_the_event();
        const now = system_time.get_now_as_time_of_day();
        const due_delay = now.get_seconds_until_next_target(time);
        this._event_id = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT,
            due_delay,
            () => {
                callback_on_event();
                return GLib.SOURCE_REMOVE;
            }
        );
        this._timer_absolute.expiration_time = time;
    }

    /** @returns {boolean} `true` if an event is currently scheduled, `false` otherwise. */
    get is_set() {
        return this._event_id !== null;
    }

    /**
     * Note: if the event is not already scheduled, nothing is done.
     * @returns {void}
     */
    unset_the_event() {
        if (this._event_id === null)
            return;
        GLib.source_remove(this._event_id);
        this._event_id = null;
        this._timer_absolute.reset();
    }

    dispose() {
        this.unset_the_event();
    }
}
