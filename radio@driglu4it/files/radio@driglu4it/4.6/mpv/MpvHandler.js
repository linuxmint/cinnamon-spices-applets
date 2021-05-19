"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMpvHandler = void 0;
const MpvMprisListener_1 = require("mpv/MpvMprisListener");
const MpvMprisController_1 = require("mpv/MpvMprisController");
const dbus_1 = require("mpv/dbus");
const CvcHandler_1 = require("mpv/CvcHandler");
const MpvMprisBase_1 = require("mpv/MpvMprisBase");
function createMpvHandler(args) {
    const { checkUrlValid, getInitialVolume, onUrlChanged, onInitialized, onVolumeChanged, onTitleChanged, onPlaybackstatusChanged, initialUrl } = args;
    const dbus = dbus_1.listenToDbus({
        onMpvRegistered: () => mprisListener.activateListener(),
        onMpvStopped: () => handlePlaybackStatusChanged('Stopped')
    });
    const mprisBase = MpvMprisBase_1.createMpvMprisBase();
    const mprisListener = MpvMprisListener_1.listenToMpvMpris({
        onInitialized,
        onVolumeChanged: handleMprisVolumeChanged,
        checkUrlValid,
        onTitleChanged,
        onUrlChanged,
        onPlaybackstatusChanged: handlePlaybackStatusChanged,
        mprisBase,
        initialUrl
    });
    function handlePlaybackStatusChanged(playbackStatus) {
        let lastVolume = null;
        if (playbackStatus === 'Playing') {
            mprisBase.setStop(false);
            cvcHandler.setVolume(mprisController.getVolume());
        }
        if (playbackStatus === 'Stopped') {
            mprisListener.deactivateListener();
            mprisBase.setStop(true);
            lastVolume = mprisListener.getLastVolume();
        }
        onPlaybackstatusChanged(playbackStatus, lastVolume);
    }
    const mprisController = MpvMprisController_1.createMpvMprisController({
        getInitialVolume,
        mprisBase
    });
    const cvcHandler = CvcHandler_1.createCvcHandler({
        onVolumeChanged: mprisController.setVolume
    });
    function handleMprisVolumeChanged(newVolume) {
        cvcHandler.setVolume(newVolume);
        onVolumeChanged(newVolume);
    }
    return {
        setChannelUrl: mprisController.setChannel,
        setVolume: mprisController.setVolume,
        getCurrentTitle: mprisController.getCurrentTitle,
        togglePlayPause: mprisController.togglePlayPause,
        increaseDecreaseVolume: mprisController.increaseDecreaseVolume,
        stop: mprisController.stop,
        dbus
    };
}
exports.createMpvHandler = createMpvHandler;
