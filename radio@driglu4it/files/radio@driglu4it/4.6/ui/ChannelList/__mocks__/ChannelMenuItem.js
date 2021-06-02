"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createChannelMenuItem = void 0;
const consts_1 = require("consts");
const limitString_1 = require("functions/limitString");
const { PopupBaseMenuItem } = imports.ui.popupMenu;
function createChannelMenuItem(args) {
    const { channelName } = args;
    const dummyActor = Object.create(new PopupBaseMenuItem());
    dummyActor.channelName = limitString_1.limitString(channelName, consts_1.MAX_STRING_LENGTH);
    function setPlaybackStatus(playbackStatus) {
        dummyActor.playbackStatus = playbackStatus;
    }
    return {
        setPlaybackStatus,
        actor: dummyActor
    };
}
exports.createChannelMenuItem = createChannelMenuItem;
