import { PAUSE_ICON_NAME, PLAY_ICON_NAME } from "../../consts"
import { PlayPause } from "../../types"
import { createControlBtn } from "./ControlBtn"

interface Arguments {
    onClick: { (): void }
}

export function createPlayPauseButton(args: Arguments) {

    const {
        onClick
    } = args

    const controlBtn = createControlBtn({
        iconName: PLAY_ICON_NAME,
        tooltipTxt: 'Play',
        onClick
    })

    /**
     * 
     * @param playPause he current state of the radio, which means that the opposite is shown (e.g. when the radio is playing, it is shown a pause item)
     * 
     */
    function setPlaybackStatus(playPause: PlayPause) {

        let tooltipTxt: string | undefined
        let iconName: string | undefined

        if (playPause === 'Playing') {
            tooltipTxt = 'Pause'
            iconName = PAUSE_ICON_NAME
        }

        if (playPause === 'Paused') {
            tooltipTxt = 'Play'
            iconName = PLAY_ICON_NAME
        }

        tooltipTxt && controlBtn.tooltip.set_text(tooltipTxt)
        if (iconName) controlBtn.icon.icon_name = iconName

    }

    return {
        actor: controlBtn.actor,
        setPlaybackStatus
    }

}