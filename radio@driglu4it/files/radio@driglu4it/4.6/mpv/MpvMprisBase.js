"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMpvMprisBase = void 0;
const consts_1 = require("consts");
const { getDBusProxyWithOwner } = imports.misc.interfaces;
function createMpvMprisBase() {
    const mediaServerPlayer = getDBusProxyWithOwner(consts_1.MEDIA_PLAYER_2_PLAYER_NAME, consts_1.MPV_MPRIS_BUS_NAME);
    let stopped;
    if (!mediaServerPlayer.PlaybackStatus)
        stopped = true;
    function getPlaybackStatus() {
        const playbackStatus = stopped ? "Stopped" : mediaServerPlayer.PlaybackStatus;
        return playbackStatus;
    }
    function getVolume() {
        if (mediaServerPlayer.Volume == null)
            return null;
        let currentVolume = Math.round(mediaServerPlayer.Volume * 100);
        if (currentVolume > consts_1.MAX_VOLUME) {
            mediaServerPlayer.Volume = consts_1.MAX_VOLUME / 100;
            currentVolume = consts_1.MAX_VOLUME;
        }
        return currentVolume;
    }
    function setStop(stoppedNew) {
        stopped = stoppedNew;
    }
    return {
        mediaServerPlayer,
        getPlaybackStatus,
        getVolume,
        setStop
    };
}
exports.createMpvMprisBase = createMpvMprisBase;
