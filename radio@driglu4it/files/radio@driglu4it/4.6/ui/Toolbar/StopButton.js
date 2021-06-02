"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createStopBtn = void 0;
const consts_1 = require("consts");
const ControlBtn_1 = require("ui/Toolbar/ControlBtn");
function createStopBtn(args) {
    const { onClick } = args;
    const stopBtn = ControlBtn_1.createControlBtn({
        iconName: consts_1.STOP_ICON_NAME,
        tooltipTxt: "Stop",
        onClick
    });
    return {
        actor: stopBtn.actor
    };
}
exports.createStopBtn = createStopBtn;
