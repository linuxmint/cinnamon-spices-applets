const Time_of_day = require('lib/time_of_day.js');

/** A basic query-based absolute timer in time of day. */
module.exports = class Timer_absolute {
    #expiration_time = 0;

    /** @param {Time_of_day} value - The next time of day at which the timer has to expire. */
    set expiration_time(value) {
        const due_delay = value.get_seconds_from_now(); // [s]
        this.#expiration_time = new Date().getTime() + due_delay * 1000; // [ms]
    }

    get_if_has_expired() {
        return new Date().getTime() > this.#expiration_time;
    }
}
