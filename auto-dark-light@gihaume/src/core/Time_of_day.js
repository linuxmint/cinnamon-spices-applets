/** @typedef {import('../types.js').Time_hms} Time_hms */

const SECONDS_PER_DAY = 24 * 60 * 60;

/** An immutable 24-hour clock time representation. */
export class Time_of_day {
    /** @private @readonly @type {number} */
    _h;
    /** @private @readonly @type {number} */
    _m;
    /** @private @readonly @type {number} */
    _s;

    /** @param {Time_hms} hms */
    constructor(hms) {
        ({ h: this._h, m: this._m, s: this._s } = hms);
    }

    /** @param {Date} date */
    static create_from_js_date(date) {
        return new Time_of_day({
            h: date.getHours(),
            m: date.getMinutes(),
            s: date.getSeconds()
        });
    }

    /** @param {string} hhmm - `HH:MM` */
    static create_from_hhmm_string(hhmm) {
        const [h, m] = hhmm.split(':').map(Number);
        return new Time_of_day({ h, m, s: 0 });
    }

    /** @returns {number} */
    get hour() { return this._h; }
    /** @returns {number} */
    get minute() { return this._m; }
    /** @returns {number} */
    get second() { return this._s; }

    /** @returns {Time_hms} */
    get_as_hms() {
        return { h: this._h, m: this._m, s: this._s };
    }

    /** @returns {string} `(H)H:MM:SS` */
    get_as_string_hmmss() {
        const [mm, ss] = [this._m, this._s].map(
            value => String(value).padStart(2, '0')
        );
        return `${this._h}:${mm}:${ss}`;
    }

    /** @returns {string} `HH:MM` */
    get_as_string_hhmm() {
        const [hh, mm] = [this._h, this._m].map(
            value => String(value).padStart(2, '0')
        );
        return `${hh}:${mm}`;
    }

    /**
     * @param {number} value - The offset to add.
     * @returns {Time_of_day} A new instance with the added time.
     */
    add_minutes(value) {
        const date = new Date(0, 0, 1, this._h, this._m, this._s);
        date.setMinutes(date.getMinutes() + value);
        return Time_of_day.create_from_js_date(date);
    }

    /**
     * Gets the delay from `this` until the next occurrence of `target`.
     * @param {Time_of_day} target
     * @returns {number}
     */
    get_seconds_until_next_target(target) {
        const [target_s, this_s] = [target, this].map(
            time => time._seconds_since_midnight
        );
        return this_s < target_s ? target_s - this_s
                                 : target_s - this_s + SECONDS_PER_DAY;
    }

    /**
     * @param {Time_of_day} start
     * @param {Time_of_day} end
     * @returns {boolean}
     */
    is_between(start, end) {
        const [this_s, start_s, end_s] = [this, start, end].map(
            time => time._seconds_since_midnight
        );
        return start_s < end_s ? start_s <= this_s && this_s < end_s
                               : start_s <= this_s || this_s < end_s;
    }

    /** @private */
    get _seconds_since_midnight() {
        return this._h * 3600 + this._m * 60 + this._s;
    }
};
