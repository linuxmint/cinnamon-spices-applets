"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMpvHandler = void 0;
const MpvMprisListener_1 = require("mpv/MpvMprisListener");
const MpvMprisController_1 = require("mpv/MpvMprisController");
const dbus_1 = require("mpv/dbus");
const CvcHandler_1 = require("mpv/CvcHandler");
const MpvMprisBase_1 = require("mpv/MpvMprisBase");
async function createMpvHandler(args) {
    const { ckeckUrlValid, getInitialVolume, onChannelChanged, onInitialized, onStarted, onVolumeChanged, onStopped, onPaused, onResumed, onTitleChanged } = args;
    const dbus = await dbus_1.listenToDbus({
        onMpvRegistered: () => mprisListener.activateListener(),
        onMpvStopped: handleMpvStopped
    });
    function handleMpvStopped() {
        mprisListener.deactivateListener();
        mprisBase.setStop(true);
        onStopped(mprisController.getVolume());
    }
    const mprisBase = await MpvMprisBase_1.createMpvMprisBase();
    const mprisListener = await MpvMprisListener_1.listenToMpvMpris({
        onChannelChanged,
        onInitialized,
        onStarted: handleStarted,
        onVolumeChanged: handleMprisVolumeChanged,
        ckeckUrlValid,
        onPaused,
        onResumed,
        onTitleChanged,
        mprisBase
    });
    function handleStarted(volume, url) {
        onStarted(volume, url);
        cvcHandler.setVolume(volume);
        mprisBase.setStop(false);
    }
    const mprisController = await MpvMprisController_1.createMpvMprisController({
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
    const mpvHandler = {
        set channelUrl(url) {
            mprisController.setChannel(url);
        },
        set volume(newVolume) {
            mprisController.setVolume(newVolume);
        },
        get currentTitle() {
            return mprisController.getCurrentTitle();
        },
        togglePlayPause: mprisController.togglePlayPause,
        increaseDecreaseVolume: mprisController.increaseDecreaseVolume,
        dbus,
        stop: mprisController.stop
    };
    return mpvHandler;
}
exports.createMpvHandler = createMpvHandler;
