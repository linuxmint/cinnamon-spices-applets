const { GLib } = imports.gi;

/** @typedef {import('../../../types').Observer} Observer */

/** @implements {Observer} */
export class Wall_clock_adjustment_monitor {
    /** In seconds (s)
     * @private */
    _monitoring_interval = 10;

    /** Check interval, in integer seconds (s) greater or equal to 1, defaults to 10
     * @returns {number} */
    get monitoring_interval() {
        return this._monitoring_interval;
    }

    set monitoring_interval(/** @type {number} */ value) {
        value = Math.max(1, value);
        value = Math.round(value);
        this._monitoring_interval = value;
        if (this._timeout_id) {
            this.disable();
            this.enable();
        }
    }

    /** Function to call when the wall clock has been modified, defaults to null
     * @type {(() => void) | null} */
    callback = null;

    /** @private @type {ReturnType<typeof GLib.timeout_add_seconds> | null} */
    _timeout_id = null;

    /** In microseconds (µs)
     * @private */
    _last_wall_clock_time = Number();

    /** In microseconds (µs)
     * @private */
    _last_monotonic_time = Number();

    enable() {
        if (this._timeout_id)
            return;
        this._last_wall_clock_time = GLib.get_real_time();
        this._last_monotonic_time = GLib.get_monotonic_time();
        this._timeout_id = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT,
            this._monitoring_interval,
            this._timeout_function
        );
    }

    /** In microseconds (µs)
     * @private */
    _time_difference_tolerance = 2e6;

    /** Maximum for time difference between wall clock and monotonic times to not trigger the callback, in seconds (s) greater or equal to 1, defaults to 2
     * @returns {number} */
    get time_difference_tolerance() {
        return this._time_difference_tolerance / 1e6;
    }

    set time_difference_tolerance(/** @type {number} */ value) {
        value *= 1e6;
        value = Math.max(1, value);
        this._time_difference_tolerance = value;
    }

    /** @private @type {Parameters<typeof GLib.timeout_add_seconds>[2]} */
    _timeout_function = () => {
        const wall_clock_time = GLib.get_real_time(),
            monotonic_time = GLib.get_monotonic_time();
        const delta_wall_clock =
            wall_clock_time - this._last_wall_clock_time;
        const delta_monotonic = monotonic_time - this._last_monotonic_time;
        const difference = Math.abs(delta_wall_clock - delta_monotonic);
        if (difference > this._time_difference_tolerance)
            this.callback?.();
        this._last_wall_clock_time = wall_clock_time;
        this._last_monotonic_time = monotonic_time;
        return GLib.SOURCE_CONTINUE;
    };

    disable() {
        if (!this._timeout_id)
            return;
        GLib.source_remove(this._timeout_id);
        this._timeout_id = null;
    }

    dispose() {
        this.disable();
    }
}
