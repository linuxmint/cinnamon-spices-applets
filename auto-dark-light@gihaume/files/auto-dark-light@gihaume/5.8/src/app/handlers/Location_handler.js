const { GLib } = imports.gi;

import * as mobx from '../../lib/mobx.js';

import { Timezone_location_finder } from '../../core/Timezone_location_finder/Timezone_location_finder.js';
import { metadata } from '../../globals.js';
import { Timezone_change_listener } from '../../lib/gnome/Timezone_change_listener.js';

/** @typedef {import('../../types.js').Disposable} Disposable */
/** @typedef {import('../../types.js').Location} Location */

/** @implements {Disposable} */
export class Location_handler {
    /** @private @readonly */
    _timezone_change_listener = new Timezone_change_listener(
        new_timezone => this._timezone = new_timezone
    );

    /** @private @type {string} */
    _timezone = GLib.TimeZone.new_local().get_identifier();

    /** @returns {string} */
    get timezone() {
        return this._timezone;
    }

    /** @private @readonly */
    _timezone_location_finder = new Timezone_location_finder(
        `${metadata.path}/src/core/Timezone_location_finder`
    );

    /** @returns {Location} */
    get auto_location() {
        return this._timezone_location_finder.find(this.timezone);
    }

    /** @type {Location} */ manual_location;

    /** @type {boolean} */ is_location_auto;

    /** @returns {Location} */
    get location() {
        return this.is_location_auto
            ? this.auto_location
            : this.manual_location;
    }

    /**
     * @param {Required<Pick<Location_handler,
     *     'manual_location' | 'is_location_auto'
     * >>} initial_values
     */
    constructor(initial_values) {
        Object.assign(this, initial_values);
        /**
         * @type {typeof mobx.makeAutoObservable<Location_handler,
         *     '_timezone_change_listener' | '_timezone_location_finder'
         * >}
         */
        (mobx.makeAutoObservable)(this, {
            _timezone_change_listener: false,
            _timezone_location_finder: false,
            manual_location: mobx.observableDeep, // TODO?: necessary?
        });
        this._timezone_change_listener.enable();
    }

    dispose() {
        this._timezone_change_listener.dispose();
    }
}
