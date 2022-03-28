import { POPUP_MENU_ITEM_CLASS } from "../consts"
import { createActivWidget } from "../lib/ActivWidget";
import { createSlider } from "../lib/Slider";
import { mpvHandler } from "../services/mpv/MpvHandler";

const { BoxLayout, Label } = imports.gi.St

// used to ensure that the width doesn't change on some fonts
const LABEL_STYLE = 'font-family: mono'

export function createSeeker() {
    const {
        getLength,
        getPosition,
        setPosition, 
        addLengthChangeHandler,
        addPositionChangeHandler
    } = mpvHandler

    const container = new BoxLayout({
        style_class: POPUP_MENU_ITEM_CLASS
    })

    createActivWidget({
        widget: container
    })

    const positionLabel = new Label({
        style: LABEL_STYLE,
        text: secondsToFormatedMin(getPosition())
    })
    const lengthLabel = new Label({
        style: LABEL_STYLE,
        text: secondsToFormatedMin(getLength())
    })

    const slider = createSlider({
        initialValue: getPosition() / getLength(),
        onValueChanged: (newSliderPos) => setPosition(newSliderPos * getLength()) 
    });

    [positionLabel, slider.actor, lengthLabel].forEach(widget => {
        container.add_child(widget)
    })


    function updateSeeker() {
        positionLabel.set_text(secondsToFormatedMin(getPosition()))
        lengthLabel.set_text(secondsToFormatedMin(getLength()))
        slider.setValue(getPosition() / getLength(), true)
    }

    /**
     * converts seconds to a string in the form of: mm:ss 
     * 
     * e.g. 10 seconds = 00:10, 100 seconds = 01:40,  6000 seconds = 100:00
     *       
     * @param seconds 
     * @returns 
     */
    function secondsToFormatedMin(seconds: number): string {
        const minutes = Math.floor(seconds / 60)
        const remainingSeconds = seconds - minutes * 60;

        // ensures minutes and seconds are shown with at least two digits
        return [minutes, remainingSeconds].map(value => {
            const valueString = value.toString().padStart(2, '0')
            return valueString
        }).join(":")
    }

    addLengthChangeHandler(updateSeeker)
    addPositionChangeHandler(updateSeeker)

    return container
}