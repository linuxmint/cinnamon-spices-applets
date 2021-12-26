import { STOP_ICON_NAME } from "../../../consts";
import { mpvHandler } from "../../../services/mpv/MpvHandler";
import { createControlBtn } from "./ControlBtn";


export function createStopBtn() {

    const {
        stop
    } = mpvHandler

    const stopBtn = createControlBtn({
        iconName: STOP_ICON_NAME,
        tooltipTxt: "Stop",
        onClick: stop
    });

    return stopBtn.actor
}