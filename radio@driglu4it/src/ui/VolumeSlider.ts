import { createActivWidget } from "lib/ActivWidget";
import { createSlider } from "lib/Slider";
import { getVolumeIcon, POPUP_ICON_CLASS, POPUP_MENU_ITEM_CLASS, VOLUME_DELTA } from 'consts'

const { BoxLayout, Icon, IconType } = imports.gi.St
const { Tooltip } = imports.ui.tooltips
const { KEY_Right, KEY_Left, ScrollDirection } = imports.gi.Clutter

interface Arguments {
    onVolumeChanged: (value: number) => void
}

export function createVolumeSlider(args: Arguments) {

    const {
        onVolumeChanged
    } = args

    let tooltip: imports.ui.tooltips.Tooltip

    const container = new BoxLayout({
        style_class: POPUP_MENU_ITEM_CLASS,
    })

    createActivWidget({
        widget: container
    })

    /** in Percent and rounded! */
    let volume: number

    const slider = createSlider({
        onValueChanged: handleSliderValueChanged
    })

    const icon = new Icon({
        icon_type: IconType.SYMBOLIC,
        style_class: POPUP_ICON_CLASS,
        reactive: true
    });

    [icon, slider.actor].forEach(widget => {
        container.add_child(widget)
    })


    container.connect('key-press-event', (actor, event) => {
        const key = event.get_key_symbol();

        if (key === KEY_Right || key === KEY_Left) {
            const direction = (key === KEY_Right) ? 'increase' : 'decrease'
            deltaChange(direction)
        }
    })

    container.connect('scroll-event', (actor, event) => {
        const scrollDirection = event.get_scroll_direction()
        const direction = (scrollDirection === ScrollDirection.UP) ? 'increase' : 'decrease'
        deltaChange(direction)
    })

    icon.connect('button-press-event', () => {
        slider.setValue(0)
    })

    /**
     * 
     * @param newValue between 0 and 1
     */
    function handleSliderValueChanged(newValue: number) {
        updateVolume(newValue * 100, true)
    }

    function deltaChange(direction: 'increase' | 'decrease') {
        const delta = (direction === 'increase') ? VOLUME_DELTA : -VOLUME_DELTA
        const newValue = slider.getValue() + delta / 100
        slider.setValue(newValue)
    }

    /**
     * 
     * @param newVolume in percent but doesn't need to be rounded
     * @param showTooltip
     */
    function updateVolume(newVolume: number, showTooltip: boolean) {
        const newVolumeRounded = Math.round(newVolume)

        if (newVolumeRounded === volume) return

        volume = newVolumeRounded

        slider.setValue(volume / 100)
        icon.set_icon_name(getVolumeIcon({ volume }))
        setTooltip(volume)

        showTooltip && tooltip.show()
        onVolumeChanged?.(volume)
    }

    /**
     * 
     * @param volume in Percent and rounded!
     */
    function setTooltip(volume: number) {

        if (!tooltip)
            tooltip = new Tooltip(slider.actor, ' ')

        tooltip.set_text(`Volume: ${volume.toString()} %`)
    }

    /**
     * 
     * @param newVolume in percent (0-100)
     */
    function setVolume(newVolume: number) {
        updateVolume(newVolume, false)
    }

    return {
        actor: container,
        setVolume
    }
}