"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChannelMenuItem = void 0;
const IconMenuItem_1 = require("ui/IconMenuItem");
class ChannelMenuItem extends IconMenuItem_1.IconMenuItem {
    constructor(text, playbackStatus) {
        super(text);
        this.playbackIconMap = new Map([
            ["Playing", "media-playback-start"],
            ["Paused", "media-playback-pause"],
            ["Stopped", null]
        ]);
        this.playbackStatus = playbackStatus;
    }
    set playbackStatus(playbackStatus) {
        this.iconName = this.playbackIconMap.get(playbackStatus);
    }
}
exports.ChannelMenuItem = ChannelMenuItem;
