import * as system_time from '../system_time';
import type { Time_of_day } from '../../core/Time_of_day';

/** A basic request-based absolute timer to be set for a next occurring time of day. */
export class Timer_absolute {
    /** Unix time in seconds (s) */
    private _expiration_time = 0;

    /** The next time of day the timer has to expire. */
    set expiration_time(value: Time_of_day) {
        const now = system_time.get_now_as_time_of_day();
        const due_delay = now.get_seconds_until_next_target(value);
        this._expiration_time = system_time.get_now_as_unix() + due_delay;
    }

    get_if_has_expired(): boolean {
        return system_time.get_now_as_unix() > this._expiration_time;
    }

    /** Ensures `get_if_has_expired` returns `true` */
    reset(): void {
        this._expiration_time = 0;
    }
}
