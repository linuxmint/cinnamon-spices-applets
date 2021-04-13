"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listenToMpvMpris = void 0;
const promiseHelpers_1 = require("functions/promiseHelpers");
const CONSTANTS_1 = require("CONSTANTS");
async function listenToMpvMpris(args) {
    const { onInitialized, onStarted, onChannelChanged, onVolumeChanged, ckeckUrlValid, onPaused, onResumed, onTitleChanged, mprisBase } = args;
    const { getPlaybackStatus, getVolume } = mprisBase;
    const initialPlaybackStatus = getPlaybackStatus();
    let currentUrl = onInitialized(initialPlaybackStatus, getVolume());
    let currentTitle = null;
    let propsChangeListener;
    const mediaProps = await promiseHelpers_1.getDBusPropertiesPromise(CONSTANTS_1.MPV_MPRIS_BUS_NAME, CONSTANTS_1.MEDIA_PLAYER_2_PATH);
    if (initialPlaybackStatus !== "Stopped")
        activateListener();
    function activateListener() {
        propsChangeListener = mediaProps.connectSignal('PropertiesChanged', (...args) => {
            var _a, _b, _c;
            const props = args[2][1];
            const metadata = (_a = props === null || props === void 0 ? void 0 : props.Metadata) === null || _a === void 0 ? void 0 : _a.deep_unpack();
            const volume = (_b = props === null || props === void 0 ? void 0 : props.Volume) === null || _b === void 0 ? void 0 : _b.deep_unpack();
            const playbackStatus = (_c = props === null || props === void 0 ? void 0 : props.PlaybackStatus) === null || _c === void 0 ? void 0 : _c.deep_unpack();
            metadata && handleMetadataChange(metadata);
            playbackStatus && handlePlaybackStatusChange(playbackStatus);
            if (volume != null)
                handleVolumeChanged(volume);
        });
    }
    function handlePlaybackStatusChange(plackbackStatus) {
        plackbackStatus === "Paused" && onPaused();
        plackbackStatus === "Playing" && onResumed();
    }
    function handleVolumeChanged(mprisVolume) {
        const normalizedVolume = Math.round(mprisVolume * 100);
        onVolumeChanged(normalizedVolume);
    }
    function deactivateListener() {
        currentUrl = null;
        mediaProps.disconnectSignal(propsChangeListener);
    }
    function handleMetadataChange(metadata) {
        var _a, _b;
        const url = (_a = metadata["xesam:url"]) === null || _a === void 0 ? void 0 : _a.unpack();
        const title = (_b = metadata["xesam:title"]) === null || _b === void 0 ? void 0 : _b.unpack();
        if (url !== currentUrl && ckeckUrlValid(url)) {
            currentUrl ? onChannelChanged(url)
                : onStarted(getVolume(), url);
            currentUrl = url;
        }
        if (title !== currentTitle) {
            onTitleChanged(title);
            currentTitle = title;
        }
    }
    return {
        activateListener,
        deactivateListener
    };
}
exports.listenToMpvMpris = listenToMpvMpris;
