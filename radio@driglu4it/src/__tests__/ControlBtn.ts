import { setGlobal } from 'test_utils/global'
setGlobal()

import { createControlBtn, ControlBtn } from 'ui/ControlBtn'

const handleClick = jest.fn(() => { })
const initIconName = "media-playback-start"
const initTooltipTxt = "Play"

let controlBtn: ControlBtn

describe('ControlBtn working as expected', () => {

    beforeEach(() => {
        controlBtn = createControlBtn({
            iconName: initIconName,
            tooltipTxt: initTooltipTxt,
            onClick: handleClick
        })
    })

    afterEach(() => {
        jest.clearAllMocks();
    })

    it('initialized values can be returned', () => {
        expect(controlBtn.iconName).toBe(initIconName)
        expect(controlBtn.tooltipTxt).toBe(initTooltipTxt)
        expect(controlBtn.onClick).toBe(handleClick)
    })

    it('tooltip text can be changed', () => {
        const newText = "Pause"
        controlBtn.tooltipTxt = newText
        expect(controlBtn.tooltipTxt).toBe(newText)
    })

    it('icon can be changed', () => {
        const newIconName = "media-playback-pause"
        controlBtn.iconName = newIconName
        expect(controlBtn.iconName).toBe(newIconName)
    })

    it('callback executed on click', () => {
        // @ts-ignore
        controlBtn.click()
        expect(handleClick).toHaveBeenCalledTimes(1)
    })

})