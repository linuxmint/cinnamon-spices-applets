const { GLib } = imports.gi;

import * as mobx from "mobx";

import type { Location } from "../../types";
import { metadata } from '../../globals';
import { Timezone_change_listener } from '../../lib/sys/Timezone_change_listener';
import { Timezone_location_finder } from "../../lib/core/Timezone_location_finder/Timezone_location_finder";

export class Location_handler {
    private readonly _timezone_change_listener = new Timezone_change_listener(
        new_timezone => this._timezone = new_timezone
    );
    private _timezone: string = GLib.TimeZone.new_local().get_identifier();
    get timezone(): string {
        return this._timezone;
    }

    private readonly _timezone_location_finder = new Timezone_location_finder(
        `${metadata.path}/Timezone_location_finder`
    );
    get auto_location(): Location {
        return this._timezone_location_finder.find(this.timezone);
    }

    manual_location!: Location;

    is_location_auto!: boolean;

    get location(): Location {
        return this.is_location_auto
            ? this.auto_location
            : this.manual_location;
    }

    constructor(initial_values: Required<Pick<Location_handler,
        'manual_location' | 'is_location_auto'
    >>) {
        Object.assign(this, initial_values);
        mobx.makeAutoObservable<
            Location_handler,
            '_timezone_change_listener' | '_timezone_location_finder'
        >(this, {
            _timezone_change_listener: false,
            _timezone_location_finder: false,
            manual_location: mobx.observable.deep,
        });
        this._timezone_change_listener.enable();
    }

    /** Releases acquired resources */
    dispose(): void {
        this._timezone_change_listener.dispose();
    }
}
