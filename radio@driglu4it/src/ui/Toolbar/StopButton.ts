import { STOP_ICON_NAME } from "../../consts";
import { createControlBtn } from "./ControlBtn";

interface Arguments {
    onClick: { (): void }
}

export function createStopBtn(args: Arguments) {

    const {
        onClick
    } = args

    const stopBtn = createControlBtn({
        iconName: STOP_ICON_NAME,
        tooltipTxt: "Stop",
        onClick
    });

    return {
        actor: stopBtn.actor
    }
}