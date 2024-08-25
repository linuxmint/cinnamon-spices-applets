const Time_of_day = require('./lib/time_of_day.js');

/**
 * A basic query-based absolute timer in time of day.
 */
class Timer_absolute {
    /**
     * @param {Time_of_day} due_time - The next time of day at which the timer has to expire.
     */
    set(due_time) {
        const due_delay = due_time.get_seconds_from_now(); // [s]
        this.timeout = new Date().getTime() + due_delay * 1000; // [ms]
    }

    /**
     * @returns {boolean} Wether the timeout has expired.
     */
    has_expired() { return new Date().getTime() > this.timeout; }
}

module.exports = Timer_absolute;
