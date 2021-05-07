"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createStopBtn = void 0;
const ControlBtn_1 = require("ui/ControlBtn");
function createStopBtn(args) {
    const { onClick } = args;
    const stopBtn = ControlBtn_1.createControlBtn({
        iconName: "media-playback-stop",
        tooltipTxt: "Stop",
        onClick
    });
    return stopBtn;
}
exports.createStopBtn = createStopBtn;
