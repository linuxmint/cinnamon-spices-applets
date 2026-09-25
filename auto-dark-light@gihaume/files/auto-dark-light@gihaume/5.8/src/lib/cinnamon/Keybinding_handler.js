const { keybindingManager } = imports.ui.main;

/** @typedef {import('../../types.js').Disposable} Disposable */

/**
 * A responsible handler to set a Cinnamon keybinding.
 * @implements {Disposable}
 */
export class Keybinding_handler {
    /** @private @readonly @type {string} */
    _uuid;
    /** @private @type {number} */
    static _unicity_count = 0;

    /** @param {string} unique_namespace - A specific enough id to avoid name collisions with any other system keybinding name, typically the application name. */
    constructor(unique_namespace) {
        this._uuid = unique_namespace + Keybinding_handler._unicity_count++;
    }

    /** The function to be called when the keybinding has been pressed
     * @type {(() => void) | null} */
    callback = null;

    /**
     * @param {string} keybinding - In the format accepted by Cinnamon (e.g. '<Super>F1'), which can be multiple ones separated with `::`.
     * @returns {boolean}
     */
    set(keybinding) {
        return keybindingManager.addHotKey(
            this._uuid, keybinding, () => { this.callback?.(); }
        );
    }

    /** @returns {void} */
    unset() {
        keybindingManager.removeHotKey(this._uuid);
    }

    dispose() {
        this.unset();
    }
}
