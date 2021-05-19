
import { Applet } from './applet'
import { Label, Side } from '../gi/St'

export class Tooltip {

    private _tooltip: Label

    constructor(item: any, initTitle: string) {
        this._tooltip = new Label({
            name: 'Tooltip'
        })

        if (initTitle) this._tooltip.set_text(initTitle)
    }

    set_text(text) {
        this._tooltip.set_text(text)
    }
}

export class PanelItemTooltip extends Tooltip {

    private _panelItem: Applet
    public orientation: Side

    constructor(panelItem: Applet, initTitle: string, orientation: Side) {

        super(panelItem.actor, initTitle)

        this._panelItem = panelItem
        this.orientation = orientation
    }



}
