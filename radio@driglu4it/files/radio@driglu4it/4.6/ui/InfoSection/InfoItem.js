"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createInfoItem = void 0;
const consts = require("consts");
const IconMenuItem_1 = require("ui/IconMenuItem");
function createInfoItem(args) {
    const { iconName } = args;
    const iconMenuItem = IconMenuItem_1.createIconMenuItem({
        text: ' ',
        maxCharNumber: consts.MAX_STRING_LENGTH,
        params: { hover: false },
        iconName
    });
    return {
        actor: iconMenuItem.actor,
        setText: iconMenuItem.setText
    };
}
exports.createInfoItem = createInfoItem;
