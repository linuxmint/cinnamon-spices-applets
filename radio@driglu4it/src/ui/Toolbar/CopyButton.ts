import { COPY_ICON_NAME } from "consts";
import { createControlBtn } from "ui/Toolbar/ControlBtn";

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
        onClick()
        showCopyInTooltip()
    }

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