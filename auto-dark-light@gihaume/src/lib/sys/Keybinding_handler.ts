const Main = imports.ui.main;

import { metadata } from "../../globals";

let counter = 0;

export class Keybinding_handler {
    private readonly _name: string;
    private readonly _callback: () => void;

    constructor(callback: () => void) {
        this._name = metadata.uuid + counter++;
        this._callback = callback;
    }

    set keybinding(value: string) {
        Main.keybindingManager.addHotKey(this._name, value, this._callback);
    }

    dispose() {
        Main.keybindingManager.removeHotKey(this._name);
    }
}
