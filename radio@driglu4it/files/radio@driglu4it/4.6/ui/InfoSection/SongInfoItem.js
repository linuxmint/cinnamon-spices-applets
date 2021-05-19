"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSongInfoItem = void 0;
const consts_1 = require("consts");
const InfoItem_1 = require("ui/InfoSection/InfoItem");
function createSongInfoItem() {
    const infoItem = InfoItem_1.createInfoItem({
        iconName: consts_1.SONG_INFO_ICON_NAME,
    });
    function setSongTitle(title) {
        infoItem.setText(title);
    }
    return {
        actor: infoItem.actor,
        setSongTitle
    };
}
exports.createSongInfoItem = createSongInfoItem;
