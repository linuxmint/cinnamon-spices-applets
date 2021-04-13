"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMpvMprisController = void 0;
const { spawnCommandLine } = imports.misc.util;
const CONSTANTS_1 = require("CONSTANTS");
async function createMpvMprisController(args) {
    let { getInitialVolume, mprisBase } = args;
    const { mediaServerPlayer, getPlaybackStatus, getVolume, } = mprisBase;
    function increaseDecreaseVolume(volumeChange) {
        const newVolume = Math.min(CONSTANTS_1.MAX_VOLUME, Math.max(0, getVolume() + volumeChange));
        setVolume(newVolume);
    }
    function setVolume(newVolume) {
        if (getVolume() === newVolume)
            return;
        mediaServerPlayer.Volume = newVolume / 100;
    }
    function setChannel(url) {
        const mpvRunning = getPlaybackStatus() !== 'Stopped';
        if (!mpvRunning) {
            const command = `mpv --script=${CONSTANTS_1.MPRIS_PLUGIN_PATH} ${url} 
                --volume=${getInitialVolume()}`;
            spawnCommandLine(command);
            return;
        }
        mediaServerPlayer.OpenUriRemote(url);
    }
    function togglePlayPause() {
        if (getPlaybackStatus() === "Stopped")
            return;
        mediaServerPlayer.PlayPauseRemote();
    }
    function stop() {
        if (getPlaybackStatus() === "Stopped")
            return;
        mediaServerPlayer.StopRemote();
    }
    function getCurrentTitle() {
        if (getPlaybackStatus() === "Stopped")
            return;
        return mediaServerPlayer
            .Metadata["xesam:title"].unpack();
    }
    const mpvMprisController = {
        setChannel,
        togglePlayPause,
        increaseDecreaseVolume,
        getInitialVolume,
        setVolume,
        getVolume,
        stop,
        getCurrentTitle
    };
    return mpvMprisController;
}
exports.createMpvMprisController = createMpvMprisController;
