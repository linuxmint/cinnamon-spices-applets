import { COPY_ICON_NAME } from "../../consts";
import { createControlBtn } from "./ControlBtn";

interface Arguments {
    onClick: { (): void }
}

export function createCopyButton(args: Arguments) {

    const {
        onClick
    } = args

    const defaultTooltipTxt = "Copy current song title to Clipboard"

    const controlBtn = createControlBtn({
        iconName: COPY_ICON_NAME,
        tooltipTxt: defaultTooltipTxt,
        onClick: handleClick
    })

    function handleClick() {
        controlBtn.tooltip.show()
        onClick()
        // showCopyInTooltip()
    }

    // For some reasons I don't understand, this function has stopped working after refactoring the popup Menu. No idea how to debug this. Therefore deactivating this for now :-(. It is thrown an  warning when clicking on the button but this has nothing to do with the tooltip
    function showCopyInTooltip() {
        const tooltip = controlBtn.tooltip
        tooltip.set_text("Copied")
        tooltip.show()

        setTimeout(() => {
            tooltip.hide()
            tooltip.set_text(defaultTooltipTxt)
        }, 500)
    }

    return {
        actor: controlBtn.actor,
    }
}