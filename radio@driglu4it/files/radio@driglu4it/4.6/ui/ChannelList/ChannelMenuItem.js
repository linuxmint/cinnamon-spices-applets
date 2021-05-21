"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createChannelMenuItem = void 0;
const consts = require("consts");
const IconMenuItem_1 = require("ui/IconMenuItem");
function createChannelMenuItem(args) {
    const { channelName } = args;
    const playbackIconMap = new Map([
        ["Playing", consts.PLAY_ICON_NAME],
        ["Paused", consts.PAUSE_ICON_NAME],
        ["Loading", consts.LOADING_ICON_NAME],
        ["Stopped", null]
    ]);
    const iconMenuItem = IconMenuItem_1.createIconMenuItem({
        text: channelName,
        maxCharNumber: consts.MAX_STRING_LENGTH
    });
    function setPlaybackStatus(playbackStatus) {
        const iconName = playbackIconMap.get(playbackStatus);
        iconMenuItem.setIconName(iconName);
    }
    return {
        setPlaybackStatus,
        actor: iconMenuItem.actor
    };
}
exports.createChannelMenuItem = createChannelMenuItem;
