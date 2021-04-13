import { createControlBtn } from "ui/ControlBtn";

interface Arguments {
    onClick: { (): void }
}

export function createDownloadButton(args: Arguments) {

    const {
        onClick
    } = args

    const downloadButton = createControlBtn({
        iconName: "south-arrow-weather-symbolic",
        tooltipTxt: "Download current song from Youtube",
        onClick
    })

    return downloadButton

}