"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createChannelInfoItem = void 0;
const consts = require("consts");
const InfoItem_1 = require("ui/InfoSection/InfoItem");
function createChannelInfoItem() {
    const infoItem = InfoItem_1.createInfoItem({
        iconName: consts.RADIO_SYMBOLIC_ICON_NAME,
    });
    function setChannel(channel) {
        infoItem.setText(channel);
    }
    return {
        actor: infoItem.actor,
        setChannel
    };
}
exports.createChannelInfoItem = createChannelInfoItem;
