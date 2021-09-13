const { Actor } = imports.gi.Clutter

const mockedSliderActor = new Actor()

const createSlider = jest.fn(() => {

    return {
        actor: mockedSliderActor
    }

})

jest.mock('lib/Slider', () => ({
    createSlider
}))

import { POPUP_ICON_CLASS } from "consts"
import { createVolumeSlider } from "ui/VolumeSlider";
import { IconType } from "../../global/gi/St"

function getChildren(volumeSlider: ReturnType<typeof createVolumeSlider>) {
    const children = volumeSlider.actor.get_children()

    if (children.length !== 2)
        throw new Error("volume Slider actor should have two children");


    return children
}


it('initialization is working', () => {

    const volumeSlider = createVolumeSlider({
        onVolumeChanged: () => { }
    })

    const children = getChildren(volumeSlider)

    const icon = children[0] as imports.gi.St.Icon

    expect(icon.style_class).toBe(POPUP_ICON_CLASS)
    expect(icon.icon_type).toBe(IconType.SYMBOLIC)
    expect(icon.icon_name).toBeUndefined()
});

describe.only('changing value from outside has no unwanted effects', () => {

    it("changing value from outside doesn't trigger callback", () => {
        const onVolumeChanged = jest.fn(() => {})

        const volumeSlider = createVolumeSlider({
            onVolumeChanged
        })

        volumeSlider.setValue(50)

    })

});

