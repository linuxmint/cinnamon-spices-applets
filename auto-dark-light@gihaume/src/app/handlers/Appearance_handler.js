import * as mobx from 'mobx';

import * as system_time from '../../lib/gnome/system_time.js';

/** @typedef {import('../../types.js').Twilights} Twilights */
/** @typedef {import('../../core/Time_of_day.js').Time_of_day} Time_of_day */

export class Appearance_handler {
    /** @private */
    _time = system_time.get_now_as_time_of_day();
    update_time() {
        this._time = system_time.get_now_as_time_of_day();
    }
    /** @type {Twilights} */
    twilights = /** @type {any} */ (undefined);
    /** @returns {boolean} */
    get auto_is_dark() {
        return this._time.is_between(
            this.twilights.sunset, this.twilights.sunrise
        );
    }

    /** @type {boolean} */
    manual_is_dark = /** @type {any} */ (undefined);
    toggle_is_dark() {
        this.manual_is_dark = !this.manual_is_dark;
    }

    /** @type {boolean} */
    is_auto = /** @type {any} */ (undefined);
    toggle_is_auto() {
        this.is_auto = !this.is_auto;
    }

    /** @returns {boolean} */
    get is_dark() {
        return this.is_auto
            ? this.auto_is_dark
            : this.manual_is_dark;
    }

    /** @returns {boolean} */
    get is_unsynced() {
        return this.manual_is_dark !== this.auto_is_dark;
    }

    sync_is_dark() {
        this.manual_is_dark = this.auto_is_dark;
    }

    /** @returns {Time_of_day} */
    get next_twilight() {
        return this.auto_is_dark
            ? this.twilights.sunrise
            : this.twilights.sunset;
    }

    /**
     * @param {Required<Pick<Appearance_handler,
     *     'twilights' | 'manual_is_dark' | 'is_auto'
     * >>} initial_controls
     */
    constructor(initial_controls) {
        Object.assign(this, initial_controls);
        mobx.makeAutoObservable(this);
    }
}
