import { createControlBtn } from "ui/ControlBtn";

interface Arguments {
    onClick: { (): void }
}

export function createStopBtn(args: Arguments) {

    const {
        onClick
    } = args

    const stopBtn = createControlBtn({
        iconName: "media-playback-stop",
        tooltipTxt: "Stop",
        onClick
    });

    return stopBtn
}