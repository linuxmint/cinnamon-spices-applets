"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCopyButton = void 0;
const ControlBtn_1 = require("ui/ControlBtn");
function createCopyButton(args) {
    const { onClick } = args;
    const defaultTooltipTxt = "Copy current song title to Clipboard";
    const copyButton = ControlBtn_1.createControlBtn({
        iconName: "edit-copy",
        tooltipTxt: defaultTooltipTxt,
        onClick: handleClick
    });
    function handleClick() {
        onClick();
        copyButton.tooltipTxt = "Copied";
        copyButton.showTooltip();
        setTimeout(() => {
            copyButton.hideTooltip();
            copyButton.tooltipTxt = defaultTooltipTxt;
        }, 500);
    }
    return copyButton;
}
exports.createCopyButton = createCopyButton;
