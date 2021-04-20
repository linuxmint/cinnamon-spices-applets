"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDownloadButton = void 0;
const ControlBtn_1 = require("ui/ControlBtn");
function createDownloadButton(args) {
    const { onClick } = args;
    const downloadButton = ControlBtn_1.createControlBtn({
        iconName: "south-arrow-weather-symbolic",
        tooltipTxt: "Download current song from Youtube",
        onClick
    });
    return downloadButton;
}
exports.createDownloadButton = createDownloadButton;
