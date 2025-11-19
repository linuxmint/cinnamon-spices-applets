const { GLib } = imports.gi;

import * as system_time from "../system_time";
import type { Time_of_day } from "../../core/Time_of_day";
import { Timer_absolute } from "./Timer_absolute";

/**
 * A single-event scheduler which call a function at a specific next time of day.
 *
 * Under the hood it uses a monotonic timeout delay and so doesn't take into account system sleep or time changes. So to the user can check if the event should already have occurred with `get_if_should_be_expired`.
 *
 * When the instance is not wanted anymore, `dispose` must be called.
 */
export class Event_scheduler {
    private _event_id: number | undefined = undefined;
    private readonly _timer_absolute = new Timer_absolute();

    /** @returns `true` if the scheduled event should have already occurred, `false` otherwise. If the event is not set, `false` is returned. */
    get_if_should_be_expired(): boolean {
        return this._timer_absolute.get_if_has_expired();
    }

    /**
     * Calls a function at a specific next time of day.
     *
     * If the event is already scheduled, it will be replaced.
     *
     * @param time - When the event should occur.
     * @param callback_on_event - The function to be executed when the event occurs.
     */
    set_the_event(time: Time_of_day, callback_on_event: () => void): void {
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

    get is_set(): boolean {
        return this._event_id !== undefined;
    }

    /** If the event is not already scheduled, nothing is done. */
    unset_the_event(): void {
        if (!this._event_id)
            return;
        GLib.source_remove(this._event_id);
        this._event_id = undefined;
        this._timer_absolute.reset();
    }

    /** Releases acquired resources */
    dispose(): void {
        this.unset_the_event();
    }
}
