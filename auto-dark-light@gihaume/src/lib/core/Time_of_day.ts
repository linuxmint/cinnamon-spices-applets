import type { Time_hms } from '../../types';

const SECONDS_PER_DAY = 24 * 60 * 60;

/** An immutable 24-hour clock time representation. */
export class Time_of_day {
    private readonly _h: number;
    private readonly _m: number;
    private readonly _s: number;

    constructor(hms: Time_hms) {
        ({ h: this._h, m: this._m, s: this._s } = hms);
    }

    static create_from_js_date(date: Date) {
        return new Time_of_day({
            h: date.getHours(),
            m: date.getMinutes(),
            s: date.getSeconds()
        });
    }

    /** @param hhmm - `HH:MM` */
    static create_from_hhmm_string(hhmm: string) {
        const [h, m] = hhmm.split(':').map(Number);
        return new Time_of_day({ h, m, s: 0 });
    }

    get hour(): number { return this._h; }
    get minute(): number { return this._m; }
    get second(): number { return this._s; }

    get_as_hms(): Time_hms {
        return { h: this._h, m: this._m, s: this._s };
    }

    /** @returns `(H)H:MM:SS` */
    get_as_string_hmmss(): string {
        const [mm, ss] = [this._m, this._s].map(
            value => String(value).padStart(2, '0')
        );
        return `${this._h}:${mm}:${ss}`;
    }

    /** @returns `HH:MM` */
    get_as_string_hhmm(): string {
        const [hh, mm] = [this._h, this._m].map(
            value => String(value).padStart(2, '0')
        );
        return `${hh}:${mm}`;
    }

    /**
     * @param value - The offset to add.
     * @returns A new instance with the added time.
     */
    add_minutes(value: number): Time_of_day {
        const date = new Date(0, 0, 1, this._h, this._m, this._s);
        date.setMinutes(date.getMinutes() + value);
        return Time_of_day.create_from_js_date(date);
    }

    /** Gets the delay from `this` until the next occurrence of `target`. */
    get_seconds_until_next_target(target: Time_of_day): number {
        const [target_s, this_s] = [target, this].map(
            time => time._seconds_since_midnight
        );
        return this_s < target_s ? target_s - this_s
                                 : target_s - this_s + SECONDS_PER_DAY;
    }

    is_between(start: Time_of_day, end: Time_of_day): boolean {
        const [this_s, start_s, end_s] = [this, start, end].map(
            time => time._seconds_since_midnight
        );
        return start_s < end_s ? start_s <= this_s && this_s < end_s
                               : start_s <= this_s || this_s < end_s;
    }

    private get _seconds_since_midnight() {
        return this._h * 3600 + this._m * 60 + this._s;
    }
};
