import * as system_time from '../../lib/gnome/system_time.js';
import * as uSunCalc from './uSunCalc.js';

/** @typedef {import('gi://GLib').default.DateTime} DateTime */
/** @typedef {import('../../types.js').Location} Location */
/** @typedef {import('../../types.js').Twilights} Twilights */

/**
 * @param {DateTime} date
 * @param {Location} location
 * @returns {Twilights}
 */
export function compute_twilights(date, location) {
    const [sunrise, sunset] = uSunCalc.compute_twilights(
        date.to_unix(), location.latitude, location.longitude
    );
    return {
        sunrise: system_time.new_local_time_of_day_from_unix(sunrise),
        sunset: system_time.new_local_time_of_day_from_unix(sunset)
    };
}
