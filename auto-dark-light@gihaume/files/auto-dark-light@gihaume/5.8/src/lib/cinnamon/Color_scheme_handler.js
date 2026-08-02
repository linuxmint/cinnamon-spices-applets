const { Gio } = imports.gi;

/** @typedef {import('../../types.js').Color_scheme} Color_scheme */
/** @typedef {import('../../types.js').Observer} Observer */

const settings = Gio.Settings.new('org.x.apps.portal');

/**
 * A listener and accessor to the Cinnamon system color scheme setting.
 * @implements {Observer}
 */
export class Color_scheme_handler {

    /** The function to be called when the color scheme has changed
     * @type {((color_scheme: Color_scheme) => void) | null} */
    callback = null;

    /** @private @type {number | null} */
    _signal_id = null;

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

    /** @returns {Color_scheme} */
    static get value() {
        return /** @type {Color_scheme} */ (settings.get_string('color-scheme'));
    }
    static set value(/** @type {Color_scheme} */ value) {
        settings.set_string('color-scheme', value);
    }
}
