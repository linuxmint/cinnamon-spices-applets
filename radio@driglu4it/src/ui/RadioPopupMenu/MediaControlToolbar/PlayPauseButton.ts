import { PAUSE_ICON_NAME, PLAY_ICON_NAME } from "../../../consts"
import { mpvHandler } from "../../../services/mpv/MpvHandler"
import { createControlBtn } from "./ControlBtn"

export function createPlayPauseButton() {

    const {
        getPlaybackStatus, 
        togglePlayPause, 
        addPlaybackStatusChangeHandler
    } = mpvHandler

    const radioStarted = () => {
        return getPlaybackStatus() === 'Playing' ||  getPlaybackStatus() === 'Loading'
    }

    const controlBtn = createControlBtn({
        onClick: () => togglePlayPause()
    })

    function initUpdateControlBtn(){
        if (radioStarted()){
            controlBtn.icon.set_icon_name(PAUSE_ICON_NAME)
            controlBtn.tooltip.set_text('Pause')
        } else {
            controlBtn.icon.set_icon_name(PLAY_ICON_NAME)
            controlBtn.tooltip.set_text('Play')
        }
    }

    addPlaybackStatusChangeHandler(() => {
        initUpdateControlBtn()
    })

    initUpdateControlBtn()

    return controlBtn.actor
}