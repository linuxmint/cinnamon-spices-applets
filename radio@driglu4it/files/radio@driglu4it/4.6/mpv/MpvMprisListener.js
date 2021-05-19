"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listenToMpvMpris = void 0;
const consts_1 = require("consts");
const { getDBusProperties } = imports.misc.interfaces;
function listenToMpvMpris(args) {
    const { onInitialized, onPlaybackstatusChanged, onUrlChanged, onVolumeChanged, onTitleChanged, checkUrlValid, initialUrl, mprisBase } = args;
    const { mediaServerPlayer, getPlaybackStatus, getVolume } = mprisBase;
    const initialPlaybackStatus = !initialUrl ? 'Stopped' : getPlaybackStatus();
    const initialVolume = initialPlaybackStatus === 'Stopped' ? null : getVolume();
    onInitialized(initialPlaybackStatus, initialVolume);
    let currentUrl = initialPlaybackStatus !== "Stopped" ? initialUrl : null;
    let currentTitle = null;
    let currentLength = getLength();
    let lastVolume = initialVolume || null;
    let propsChangeListener;
    const mediaProps = getDBusProperties(consts_1.MPV_MPRIS_BUS_NAME, consts_1.MEDIA_PLAYER_2_PATH);
    if (initialPlaybackStatus !== "Stopped")
        activateListener();
    function activateListener() {
        propsChangeListener = mediaProps.connectSignal('PropertiesChanged', (...args) => {
            var _a, _b, _c, _d, _e, _f;
            const props = args[2][1];
            const metadata = (_a = props.Metadata) === null || _a === void 0 ? void 0 : _a.deep_unpack();
            const volume = (_b = props.Volume) === null || _b === void 0 ? void 0 : _b.deep_unpack();
            const playbackStatus = (_c = props.PlaybackStatus) === null || _c === void 0 ? void 0 : _c.deep_unpack();
            const url = (_d = metadata === null || metadata === void 0 ? void 0 : metadata['xesam:url']) === null || _d === void 0 ? void 0 : _d.deep_unpack();
            const title = (_e = metadata === null || metadata === void 0 ? void 0 : metadata['xesam:title']) === null || _e === void 0 ? void 0 : _e.deep_unpack();
            const length = (_f = metadata === null || metadata === void 0 ? void 0 : metadata["mpris:length"]) === null || _f === void 0 ? void 0 : _f.deep_unpack();
            const newUrlValid = checkUrlValid(url);
            const relevantEvent = newUrlValid || currentUrl;
            if (!relevantEvent)
                return;
            if (length != null)
                handleLengthChanged(length);
            if (volume != null)
                handleVolumeChanged(volume);
            playbackStatus && handleMprisPlaybackStatusChanged(playbackStatus);
            url && newUrlValid && url !== currentUrl && handleUrlChanged(url);
            title && handleTitleSet(title);
        });
    }
    function handleLengthChanged(length) {
        if (length === 0) {
            onPlaybackstatusChanged('Loading');
        }
        if (currentLength === 0 && length !== 0)
            onPlaybackstatusChanged('Playing');
        currentLength = length;
    }
    function handleMprisPlaybackStatusChanged(playbackStatus) {
        if (currentLength === 0) {
            onPlaybackstatusChanged('Loading');
        }
        else {
            onPlaybackstatusChanged(playbackStatus);
        }
    }
    function handleUrlChanged(newUrl) {
        currentUrl = newUrl;
        handleLengthChanged(0);
        onUrlChanged(newUrl);
    }
    function handleVolumeChanged(mprisVolume) {
        const normalizedVolume = Math.round(mprisVolume * 100);
        lastVolume = normalizedVolume;
        onVolumeChanged(normalizedVolume);
    }
    function handleTitleSet(title) {
        if (title === currentTitle)
            return;
        currentTitle = title;
        onTitleChanged(title);
    }
    function deactivateListener() {
        currentLength = 0;
        currentUrl = null;
        currentTitle = null;
        mediaProps.disconnectSignal(propsChangeListener);
    }
    function getLength() {
        var _a, _b;
        let length = ((_b = (_a = mediaServerPlayer === null || mediaServerPlayer === void 0 ? void 0 : mediaServerPlayer.Metadata) === null || _a === void 0 ? void 0 : _a["mpris:length"]) === null || _b === void 0 ? void 0 : _b.unpack()) || 0;
        return length;
    }
    return {
        getLastVolume: () => lastVolume,
        activateListener,
        deactivateListener
    };
}
exports.listenToMpvMpris = listenToMpvMpris;
