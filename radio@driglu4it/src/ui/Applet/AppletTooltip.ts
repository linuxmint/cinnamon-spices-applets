import { DEFAULT_TOOLTIP_TXT } from "consts"

const { PanelItemTooltip } = imports.ui.tooltips

interface Arguments {
    applet: imports.ui.applet.Applet
    orientation: imports.gi.St.Side
}

export function createAppletTooltip(args: Arguments) {

    const {
        orientation,
        applet
    } = args

    const tooltip = new PanelItemTooltip(applet, null, orientation)

    function setVolume(volume: number | null) {
        if (volume == null) {
            tooltip.set_text(DEFAULT_TOOLTIP_TXT)
            return
        }

        tooltip.set_text(`Volume: ${volume.toString()} %`)
    }

    return {
        setVolume
    }
}