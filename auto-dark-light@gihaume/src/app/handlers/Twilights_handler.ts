const { DateTime } = imports.gi.GLib; // Preferred over JS's `Date` to take into account timezone changes during runtime.

import * as mobx from "mobx";

import { compute_twilights } from "../../lib/core/compute_twilights/compute_twilights";
import type { Location, Twilights } from "../../types";
import { Time_of_day } from "../../lib/core/Time_of_day";

export class Twilights_handler {
    private _date = DateTime.new_now_local(); // TODO: could be `null` if timezone is bad or missing?
    update() {
        this._date = DateTime.new_now_local(); // TODO: same as above
    }
    location!: Location;
    private get _location_twilights(): Twilights {
        return compute_twilights(this._date, this.location);
    }

    auto_sunrise_offset!: number;
    auto_sunset_offset!: number;

    get auto_sunrise(): Time_of_day {
        return this._location_twilights.sunrise.add_minutes(
            this.auto_sunrise_offset
        );
    }
    get auto_sunset(): Time_of_day {
        return this._location_twilights.sunset.add_minutes(
            this.auto_sunset_offset
        );
    }

    manual_sunrise!: Time_of_day;
    manual_sunset!: Time_of_day;

    is_sunrise_auto!: boolean;
    is_sunset_auto!: boolean;

    private get _sunrise(): Time_of_day {
        return this.is_sunrise_auto ? this.auto_sunrise : this.manual_sunrise;
    }
    private get _sunset(): Time_of_day {
        return this.is_sunset_auto ? this.auto_sunset : this.manual_sunset;
    }
    get twilights(): Twilights {
        return { sunrise: this._sunrise, sunset: this._sunset };
    }

    constructor(initial_values: Required<Pick<Twilights_handler,
        'location' |
        'auto_sunrise_offset' | 'auto_sunset_offset' |
        'manual_sunrise' | 'manual_sunset' |
        'is_sunrise_auto' | 'is_sunset_auto'
    >>) {
        Object.assign(this, initial_values);
        mobx.makeAutoObservable(this);
    }
}
