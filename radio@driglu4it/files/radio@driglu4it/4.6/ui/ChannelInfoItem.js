"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createChannelInfoItem = void 0;
const limitString_1 = require("functions/limitString");
const IconMenuItem_1 = require("ui/IconMenuItem");
function createChannelInfoItem() {
    const channelInfoItem = new IconMenuItem_1.IconMenuItem("", "radioapplet", { hover: false });
    function setChannel(channel) {
        channelInfoItem.text = limitString_1.limitString(channel);
    }
    Object.defineProperties(channelInfoItem, {
        channel: {
            set(channel) {
                setChannel(channel);
            }
        }
    });
    return channelInfoItem;
}
exports.createChannelInfoItem = createChannelInfoItem;
