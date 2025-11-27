const { keybindingManager } = imports.ui.main;

import { Disposable } from '../../types';

/** A responsible handler to set a Cinnamon keybinding. */
export class Keybinding_handler implements Disposable {
    private readonly _uuid: string;
    private static _unicity_count: number = 0;
    private readonly _callback: () => void;

    /**
     * @param unique_namespace - a specific enough id to avoid name collisions with any other system keybinding name, typically the application name
     * @param callback - the function to be called when the keybinding has been pressed
     */
    constructor(unique_namespace: string, callback: () => void) {
        this._uuid = unique_namespace + Keybinding_handler._unicity_count++;
        this._callback = callback;
    }

    /** @param keybinding - the keybinding to set, in the format accepted by Cinnamon (e.g. '<Super>F1') */
    set(keybinding: string): boolean {
        return keybindingManager.addHotKey(
            this._uuid, keybinding, this._callback
        );
    }

    unset(): void {
        keybindingManager.removeHotKey(this._uuid);
    }

    dispose() {
        this.unset();
    }
}
