const GLib = imports.gi.GLib;

/**
 * A time handler in hour, minute and second and 24-hour format.
 */
class Time_of_day {
    #hour;
    #minute;
    #second;

    /**
     * @param {GLib.DateTime} date - The object to take the hour, minute and second from.
     * `GLib.DateTime` type is chosen over `Date` to take into account timezone changes during runtime.
     */
    constructor(date) {
        this.#hour   = date.get_hour();
        this.#minute = date.get_minute();
        this.#second = date.get_second();
    }

    /**
     * @returns {Time_of_day} The current local time of day.
     */
    static now() { return new Time_of_day(GLib.DateTime.new_now_local()); }

    /**
     * @returns {string} The time of day as a string in the format "(H)H:MM:SS".
     */
    as_string() {
        const minute = String(this.#minute).padStart(2, '0'),
              second = String(this.#second).padStart(2, '0');
        return `${this.#hour}:${minute}:${second}`;
    }

    /**
     * Get the delay from now until the next occurence of `this`.
     * @returns {number} The delay in seconds from now.
     */
    get_seconds_from_now() {
        const [now, time] = [Time_of_day.now(), this].map(time =>
            time.#get_seconds_since_midnight()
        );
        const ONE_DAY = 24 * 3600;
        return now < time ? time - now
                          : time - now + ONE_DAY;
    }

    /**
     * Test if `this` is between two other `Time_of_day`.
     * @param {Time_of_day} start - The start time.
     * @param {Time_of_day} end - The end time.
     * @returns {boolean} Wether the time is between the start and end times.
     */
    is_between(start, end) {
        let time;
        [time, start, end] = [this, start, end].map(time =>
            time.#get_seconds_since_midnight()
        );
        return start < end ? start <= time && time < end
                           : start <= time || time < end;
    }

    #get_seconds_since_midnight() {
        return this.#hour * 3600 + this.#minute * 60 + this.#second;
    }
}

module.exports = Time_of_day;
