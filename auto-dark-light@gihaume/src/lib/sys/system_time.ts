const { DateTime } = imports.gi.GLib; // Preferred over JS's `Date` to take into account timezone changes during runtime.

import { Time_of_day } from "../core/Time_of_day";
import type { Time_hms } from '../../types';

/** @returns seconds (s) */
export function get_now_as_unix(): number {
    return DateTime.new_now_local().to_unix();
}

export function get_now_as_hms(): Time_hms {
    const datetime = DateTime.new_now_local();
    return _datetime_to_hms(datetime);
}

export function get_now_as_time_of_day(): Time_of_day {
    const datetime = DateTime.new_now_local();
    const hms = _datetime_to_hms(datetime);
    return new Time_of_day(hms);
}

/** @param unix_time - seconds (s) */
export function new_local_time_of_day_from_unix(
    unix_time: number
): Time_of_day {
    const datetime = DateTime.new_from_unix_local(unix_time);
    const hms = _datetime_to_hms(datetime);
    return new Time_of_day(hms);
}

function _datetime_to_hms(datetime: imports.gi.GLib.DateTime): Time_hms {
    return {
        h: datetime.get_hour(),
        m: datetime.get_minute(),
        s: datetime.get_second()
    };
}
