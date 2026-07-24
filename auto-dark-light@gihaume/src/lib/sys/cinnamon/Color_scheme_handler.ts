const { Gio } = imports.gi;

import { Color_scheme, Observer } from "../../../types";

const settings = Gio.Settings.new('org.x.apps.portal');

/** A listener and accessor to the Cinnamon system color scheme setting. */
export class Color_scheme_handler implements Observer {

    /** The function to be called when the color scheme has changed */
    callback: ((color_scheme: Color_scheme) => void) | null = null;

    private _signal_id: number | null = null;

    enable() {
        if (this._signal_id !== null)
            return;
        this._signal_id = settings.connect('changed::color-scheme', () => {
            this.callback?.(Color_scheme_handler.value);
        });
    }

    disable() {
        if (this._signal_id === null)
            return;
        settings.disconnect(this._signal_id);
        this._signal_id = null;
    }

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
