import { PlayPause } from "types"
import { ControlBtn, createControlBtn } from "ui/ControlBtn";

interface Arguments {
    onClick: { (): void }
}

export interface PlayPauseButton extends ControlBtn {
    playPause: PlayPause
}

export function createPlayPauseButton(args: Arguments) {

    const {
        onClick
    } = args

    const playPauseBtn = createControlBtn({
        iconName: getPlayPauseIconName("Playing"),
        tooltipTxt: getPlayPauseTooltipTxt("Playing"),
        onClick
    });

    function getPlayPauseTooltipTxt(playPause: PlayPause) {
        return (playPause === "Paused") ? "Play" : "Pause"
    }

    function getPlayPauseIconName(playPause: PlayPause) {
        return `media-playback-${playPause === "Playing" ? "pause" : "start"}`
    }

    /**
     * 
     * @param playPause  the current state of the radio, which means that the opposite is shown (when the radio is playing, it is shown a pause item)
     */
    function setPlayPause(playPause: PlayPause) {
        playPauseBtn.tooltipTxt = getPlayPauseTooltipTxt(playPause)
        playPauseBtn.iconName = getPlayPauseIconName(playPause)
    }

    Object.defineProperties(playPauseBtn, {
        playPause: {
            set(playPause: PlayPause) {
                setPlayPause(playPause)
            }
        }
    })

    return playPauseBtn
}