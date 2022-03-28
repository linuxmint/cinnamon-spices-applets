import { DEFAULT_TOOLTIP_TXT } from "consts"
import { createAppletTooltip } from "ui/Applet/AppletTooltip"

const { Applet } = imports.ui.applet
const { PanelItemTooltip } = imports.ui.tooltips

const panelHeight = 40
const topOrientation = imports.gi.St.Side.TOP
const instanceId = 96
const applet = new Applet(topOrientation, panelHeight, instanceId)


afterEach(() => {
    jest.restoreAllMocks();
})


xit('initialization is working', () => {
    // TODO
})


describe('setting volume is working', () => {
    it('setting volume to normal value is working', () => {

        const spy = jest.spyOn(PanelItemTooltip.prototype, 'set_text')

        const tooltip = createAppletTooltip({
            applet,
            orientation: topOrientation
        })

        tooltip.setVolume(50)

        expect(spy).toHaveBeenCalledWith('Volume: 50 %')
    })


    it('setting volume to 0 is working', () => {
        const spy = jest.spyOn(PanelItemTooltip.prototype, 'set_text')

        const tooltip = createAppletTooltip({
            applet,
            orientation: topOrientation
        })

        tooltip.setVolume(0)

        expect(spy).toHaveBeenCalledWith('Volume: 0 %')
    })
})