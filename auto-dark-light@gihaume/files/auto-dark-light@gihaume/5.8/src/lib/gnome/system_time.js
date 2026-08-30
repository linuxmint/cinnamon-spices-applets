import GLib from 'gi://GLib';

import { Time_of_day } from '../../core/Time_of_day.js';

/** @typedef {import('../../types').Time_hms} Time_hms */

// GLib.DateTime is used over Date as it takes into account timezone changes during runtime

/** @returns {number} seconds (s) */
export function get_now_as_unix() {
    return GLib.DateTime.new_now_local().to_unix();
}

/** @returns {Time_hms} */
export function get_now_as_hms() {
    const datetime = GLib.DateTime.new_now_local();
    return _datetime_to_hms(datetime);
}

/** @returns {Time_of_day} */
export function get_now_as_time_of_day() {
    const datetime = GLib.DateTime.new_now_local();
    const hms = _datetime_to_hms(datetime);
    return new Time_of_day(hms);
}

/**
 * @param {number} unix_time - seconds (s)
 * @returns {Time_of_day}
 */
export function new_local_time_of_day_from_unix(unix_time) {
    const datetime = GLib.DateTime.new_from_unix_local(unix_time);
    const hms = _datetime_to_hms(datetime);
    return new Time_of_day(hms);
}

/**
 * @param {GLib.DateTime} datetime
 * @returns {Time_hms}
*/
function _datetime_to_hms(datetime) {
    return {
        h: datetime.get_hour(),
        m: datetime.get_minute(),
        s: datetime.get_second()
    };
}
