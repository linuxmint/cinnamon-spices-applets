const { keybindingManager } = imports.ui.main;

import { Disposable } from '../../../types';

/** A responsible handler to set a Cinnamon keybinding. */
export class Keybinding_handler implements Disposable {
    private readonly _uuid: string;
    private static _unicity_count: number = 0;

    /** @param unique_namespace - A specific enough id to avoid name collisions with any other system keybinding name, typically the application name. */
    constructor(unique_namespace: string) {
        this._uuid = unique_namespace + Keybinding_handler._unicity_count++;
    }

    /** The function to be called when the keybinding has been pressed */
    callback: (() => void) | null = null;

    /** @param keybinding - In the format accepted by Cinnamon (e.g. '<Super>F1'), which can be multiple ones separated with `::`. */
    set(keybinding: string): boolean {
        return keybindingManager.addHotKey(
            this._uuid, keybinding, () => { this.callback?.(); }
        );
    }

    unset(): void {
        keybindingManager.removeHotKey(this._uuid);
    }

    dispose() {
        this.unset();
    }
}
