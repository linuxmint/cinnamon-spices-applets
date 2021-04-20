import { createControlBtn } from "ui/ControlBtn";

interface Arguments {
    onClick: { (): void }
}

export function createCopyButton(args: Arguments) {

    const {
        onClick
    } = args

    const defaultTooltipTxt = "Copy current song title to Clipboard"

    const copyButton = createControlBtn({
        iconName: "edit-copy",
        tooltipTxt: defaultTooltipTxt,
        onClick: handleClick
    })

    function handleClick() {
        onClick()
        copyButton.tooltipTxt = "Copied"
        copyButton.showTooltip()

        setTimeout(() => {
            copyButton.hideTooltip()
            copyButton.tooltipTxt = defaultTooltipTxt
        }, 500)
    }


    return copyButton

}