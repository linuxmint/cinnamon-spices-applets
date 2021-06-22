import { DOWNLOAD_ICON_NAME } from "consts";
import { createControlBtn } from "ui/Toolbar/ControlBtn";

interface Arguments {
    onClick: { (): void }
}

export function createDownloadButton(args: Arguments) {

    const {
        onClick
    } = args

    const downloadButton = createControlBtn({
        iconName: DOWNLOAD_ICON_NAME,
        tooltipTxt: "Download current song from Youtube",
        onClick
    })

    return {
        actor: downloadButton.actor
    }

}