import * as mobx from 'mobx';

import type { Twilights } from '../../types.d.ts';
import * as system_time from '../../lib/gnome/system_time.js';
import type { Time_of_day } from '../../core/Time_of_day.ts';

export class Appearance_handler {
    private _time = system_time.get_now_as_time_of_day();
    update_time() {
        this._time = system_time.get_now_as_time_of_day();
    }
    twilights!: Twilights;
    get auto_is_dark(): boolean {
        return this._time.is_between(
            this.twilights.sunset, this.twilights.sunrise
        );
    }

    manual_is_dark!: boolean;
    toggle_is_dark() {
        this.manual_is_dark = !this.manual_is_dark;
    }

    is_auto!: boolean;
    toggle_is_auto() {
        this.is_auto = !this.is_auto;
    }

    get is_dark(): boolean {
        return this.is_auto
            ? this.auto_is_dark
            : this.manual_is_dark;
    }

    get is_unsynced(): boolean {
        return this.manual_is_dark !== this.auto_is_dark;
    }

    sync_is_dark() {
        this.manual_is_dark = this.auto_is_dark;
    }

    get next_twilight(): Time_of_day {
        return this.auto_is_dark
            ? this.twilights.sunrise
            : this.twilights.sunset;
    }

    constructor(initial_controls: Required<Pick<Appearance_handler,
        'twilights' | 'manual_is_dark' | 'is_auto'
    >>) {
        Object.assign(this, initial_controls);
        mobx.makeAutoObservable(this);
    }
}
