"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCopyButton = void 0;
const consts_1 = require("consts");
const ControlBtn_1 = require("ui/Toolbar/ControlBtn");
function createCopyButton(args) {
    const { onClick } = args;
    const defaultTooltipTxt = "Copy current song title to Clipboard";
    const controlBtn = ControlBtn_1.createControlBtn({
        iconName: consts_1.COPY_ICON_NAME,
        tooltipTxt: defaultTooltipTxt,
        onClick: handleClick
    });
    function handleClick() {
        controlBtn.tooltip.show();
        onClick();
    }
    function showCopyInTooltip() {
        const tooltip = controlBtn.tooltip;
        tooltip.set_text("Copied");
        tooltip.show();
        setTimeout(() => {
            tooltip.hide();
            tooltip.set_text(defaultTooltipTxt);
        }, 500);
    }
    return {
        actor: controlBtn.actor,
    };
}
exports.createCopyButton = createCopyButton;
