const { Gio } = imports.gi;

import { Color_scheme } from "../../types";

const settings = Gio.Settings.new('org.x.apps.portal');

/** A listener and accessor to the Cinnamon system color scheme setting. */
export class System_color_scheme {
    private readonly _callback_on_change: (color_scheme: Color_scheme) => void;
    private _signal_id: number | undefined = undefined;

    /** @param callback_on_change - The function to be executed when the color scheme changes. */
    constructor(callback_on_change: (color_scheme: Color_scheme) => void) {
        this._callback_on_change = callback_on_change;
    }

    enable() {
        this.disable(); // Ensures only one signal is connected
        this._signal_id = settings.connect('changed::color-scheme', () => {
            this._callback_on_change(System_color_scheme.value);
        });
    }

    disable() {
        if (this._signal_id === undefined)
            return;
        settings.disconnect(this._signal_id);
        this._signal_id = undefined;
    }

    /** Releases acquired resources */
    dispose() {
        this.disable();
    }

    static get value(): Color_scheme {
        return settings.get_string('color-scheme') as Color_scheme;
    }
    static set value(value: Color_scheme) {
        settings.set_string('color-scheme', value);
    }
}
