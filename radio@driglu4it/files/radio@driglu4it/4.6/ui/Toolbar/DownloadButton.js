"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDownloadButton = void 0;
const consts_1 = require("consts");
const ControlBtn_1 = require("ui/Toolbar/ControlBtn");
function createDownloadButton(args) {
    const { onClick } = args;
    const downloadButton = ControlBtn_1.createControlBtn({
        iconName: consts_1.DOWNLOAD_ICON_NAME,
        tooltipTxt: "Download current song from Youtube",
        onClick
    });
    return {
        actor: downloadButton.actor
    };
}
exports.createDownloadButton = createDownloadButton;
