"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMpvMprisBase = void 0;
const promiseHelpers_1 = require("functions/promiseHelpers");
const CONSTANTS_1 = require("CONSTANTS");
async function createMpvMprisBase() {
    const mediaServerPlayer = await promiseHelpers_1.getDBusProxyWithOwnerPromise(CONSTANTS_1.MEDIA_PLAYER_2_PLAYER_NAME, CONSTANTS_1.MPV_MPRIS_BUS_NAME);
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
        if (currentVolume > CONSTANTS_1.MAX_VOLUME) {
            mediaServerPlayer.Volume = CONSTANTS_1.MAX_VOLUME / 100;
            currentVolume = CONSTANTS_1.MAX_VOLUME;
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
