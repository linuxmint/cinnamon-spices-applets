import * as system_time from '../../lib/gnome/system_time.js';
import * as uSunCalc from './uSunCalc.ts';

import type { Location, Twilights } from '../../types.d.ts';

export function compute_twilights(
    date: imports.gi.GLib.DateTime, location: Location
): Twilights {
    const [sunrise, sunset] = uSunCalc.compute_twilights(
        date.to_unix(), location.latitude, location.longitude
    );
    return {
        sunrise: system_time.new_local_time_of_day_from_unix(sunrise),
        sunset: system_time.new_local_time_of_day_from_unix(sunset)
    };
}
