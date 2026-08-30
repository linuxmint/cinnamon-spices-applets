import GLib from 'gi://GLib';

import { compute_twilights } from '../../core/compute_twilights/compute_twilights.js';
import { Time_of_day } from '../../core/Time_of_day.js';
import * as mobx from '../../lib/mobx.js';


/** @typedef {import('../../types.js').Location} Location */
/** @typedef {import('../../types.js').Twilights} Twilights */

export class Twilights_handler {
    /** @private */ _date = GLib.DateTime.new_now_local(); // TODO: could be `null` if timezone is bad or missing?

    update() {
        this._date = GLib.DateTime.new_now_local(); // TODO: same as above
    }

    /** @type {Location} */ location;

    /** @private @returns {Twilights} */
    get _location_twilights() {
        return compute_twilights(this._date, this.location);
    }

    /** @type {number} */ auto_sunrise_offset;
    /** @type {number} */ auto_sunset_offset;

    /** @returns {Time_of_day} */
    get auto_sunrise() {
        return this._location_twilights.sunrise.add_minutes(
            this.auto_sunrise_offset
        );
    }

    /** @returns {Time_of_day} */
    get auto_sunset() {
        return this._location_twilights.sunset.add_minutes(
            this.auto_sunset_offset
        );
    }

    /** @type {Time_of_day} */ manual_sunrise;
    /** @type {Time_of_day} */ manual_sunset;

    /** @type {boolean} */ is_sunrise_auto;
    /** @type {boolean} */ is_sunset_auto;

    /** @private @returns {Time_of_day} */
    get _sunrise() {
        return this.is_sunrise_auto ? this.auto_sunrise : this.manual_sunrise;
    }
    /** @private @returns {Time_of_day} */
    get _sunset() {
        return this.is_sunset_auto ? this.auto_sunset : this.manual_sunset;
    }
    /** @returns {Twilights} */
    get twilights() {
        return { sunrise: this._sunrise, sunset: this._sunset };
    }

    /**
     * @param {Required<Pick<Twilights_handler,
     *     'location' |
     *     'auto_sunrise_offset' | 'auto_sunset_offset' |
     *     'manual_sunrise' | 'manual_sunset' |
     *     'is_sunrise_auto' | 'is_sunset_auto'
     * >>} initial_values
     */
    constructor(initial_values) {
        Object.assign(this, initial_values);
        mobx.makeAutoObservable(this);
    }
}
