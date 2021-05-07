import { Label } from './Label'

export class Tooltip {

    private _tooltip: Label

    constructor(item: imports.gi.Clutter.Actor, initTitle: string) {
        this._tooltip = new Label()
        this._tooltip.set_text(initTitle)
    }

    set_text(newText: string) {
        this._tooltip.set_text(newText)
    }
}