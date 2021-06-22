"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMpvHandler = void 0;
const consts_1 = require("consts");
const { getDBusProperties, getDBus, getDBusProxyWithOwner } = imports.misc.interfaces;
const { spawnCommandLine } = imports.misc.util;
const { MixerControl } = imports.gi.Cvc;
function createMpvHandler(args) {
    const { onPlaybackstatusChanged, onUrlChanged, onVolumeChanged, onTitleChanged, onLengthChanged, onPositionChanged, checkUrlValid, lastUrl, getInitialVolume, } = args;
    const dbus = getDBus();
    const mediaServerPlayer = getDBusProxyWithOwner(consts_1.MEDIA_PLAYER_2_PLAYER_NAME, consts_1.MPV_MPRIS_BUS_NAME);
    const mediaProps = getDBusProperties(consts_1.MPV_MPRIS_BUS_NAME, consts_1.MEDIA_PLAYER_2_PATH);
    const control = new MixerControl({ name: __meta.name });
    let cvcStream;
    control.open();
    control.connect('stream-added', (ctrl, id) => {
        const addedStream = control.lookup_stream_id(id);
        if ((addedStream === null || addedStream === void 0 ? void 0 : addedStream.name) !== consts_1.MPV_CVC_NAME)
            return;
        cvcStream = addedStream;
        cvcStream.connect('notify::volume', () => {
            handleCvcVolumeChanged();
        });
    });
    const initialPlaybackStatus = !lastUrl ? 'Stopped' : getPlaybackStatus();
    let currentUrl = initialPlaybackStatus !== "Stopped" ? lastUrl : null;
    let currentLength = getLength();
    let positionTimerId;
    let bufferExceeded = false;
    let mediaPropsListenerId;
    let seekListenerId;
    if (initialPlaybackStatus !== "Stopped") {
        activateMprisPropsListener();
        activeSeekListener();
        onUrlChanged(currentUrl);
        onPlaybackstatusChanged(initialPlaybackStatus);
        onVolumeChanged(getVolume());
        onTitleChanged(getCurrentTitle());
        onLengthChanged(currentLength);
        onPositionChanged(getPosition());
        startPositionTimer();
    }
    dbus.connectSignal('NameOwnerChanged', (...args) => {
        const name = args[2][0];
        const oldOwner = args[2][1];
        const newOwner = args[2][2];
        if (name !== consts_1.MPV_MPRIS_BUS_NAME)
            return;
        if (newOwner) {
            activateMprisPropsListener();
            activeSeekListener();
            pauseAllOtherMediaPlayers();
        }
        if (oldOwner) {
            currentLength = 0;
            currentUrl = null;
            stopPositionTimer();
            mediaProps.disconnectSignal(mediaPropsListenerId);
            mediaServerPlayer.disconnectSignal(seekListenerId);
            onPlaybackstatusChanged('Stopped');
        }
    });
    function activateMprisPropsListener() {
        mediaPropsListenerId = mediaProps.connectSignal('PropertiesChanged', (proxy, nameOwner, [interfaceName, props]) => {
            var _a, _b, _c, _d, _e, _f;
            const metadata = (_a = props.Metadata) === null || _a === void 0 ? void 0 : _a.deep_unpack();
            const volume = (_b = props.Volume) === null || _b === void 0 ? void 0 : _b.unpack();
            const playbackStatus = (_c = props.PlaybackStatus) === null || _c === void 0 ? void 0 : _c.unpack();
            const url = (_d = metadata === null || metadata === void 0 ? void 0 : metadata['xesam:url']) === null || _d === void 0 ? void 0 : _d.unpack();
            const title = (_e = metadata === null || metadata === void 0 ? void 0 : metadata['xesam:title']) === null || _e === void 0 ? void 0 : _e.unpack();
            const length = (_f = metadata === null || metadata === void 0 ? void 0 : metadata["mpris:length"]) === null || _f === void 0 ? void 0 : _f.unpack();
            const newUrlValid = checkUrlValid(url);
            const relevantEvent = newUrlValid || currentUrl;
            if (!relevantEvent)
                return;
            if (length != null)
                handleLengthChanged(length);
            if (volume != null)
                handleMprisVolumeChanged(volume);
            playbackStatus && handleMprisPlaybackStatusChanged(playbackStatus);
            url && newUrlValid && url !== currentUrl && handleUrlChanged(url);
            title && handleTitleSet(title);
        });
    }
    function activeSeekListener() {
        seekListenerId = mediaServerPlayer.connectSignal('Seeked', (id, sender, value) => {
            handlePositionChanged(microSecondsToRoundedSeconds(value));
        });
    }
    function handleLengthChanged(length) {
        const lengthInSeconds = microSecondsToRoundedSeconds(length);
        onLengthChanged(lengthInSeconds);
        const startLoading = (length === 0);
        const finishedLoading = length !== 0 && currentLength === 0;
        currentLength = lengthInSeconds;
        if (startLoading) {
            onPlaybackstatusChanged('Loading');
        }
        if (finishedLoading || bufferExceeded) {
            const position = finishedLoading ? 0 : getPosition();
            handlePositionChanged(position);
            onPlaybackstatusChanged(getPlaybackStatus());
            bufferExceeded = false;
        }
    }
    function handlePositionChanged(position) {
        stopPositionTimer();
        onPositionChanged(position);
        startPositionTimer();
    }
    function startPositionTimer() {
        if (getPlaybackStatus() !== 'Playing')
            return;
        positionTimerId = setInterval(() => {
            const position = Math.min(getPosition(), currentLength);
            onPositionChanged(position);
            if (position === currentLength) {
                onPlaybackstatusChanged('Loading');
                bufferExceeded = true;
                stopPositionTimer();
            }
        }, 1000);
    }
    function stopPositionTimer() {
        if (!positionTimerId)
            return;
        clearInterval(positionTimerId);
        positionTimerId = null;
    }
    function handleMprisPlaybackStatusChanged(playbackStatus) {
        if (currentLength !== 0) {
            onPlaybackstatusChanged(playbackStatus);
            playbackStatus === 'Paused' ? stopPositionTimer()
                : handlePositionChanged(getPosition());
        }
    }
    function handleUrlChanged(newUrl) {
        currentUrl = newUrl;
        handleLengthChanged(0);
        if (positionTimerId)
            stopPositionTimer();
        onPositionChanged(0);
        onUrlChanged(newUrl);
    }
    function handleMprisVolumeChanged(mprisVolume) {
        if (mprisVolume * 100 > consts_1.MAX_VOLUME) {
            mediaServerPlayer.Volume = consts_1.MAX_VOLUME / 100;
            return;
        }
        const normalizedVolume = Math.round(mprisVolume * 100);
        setCvcVolume(normalizedVolume);
        onVolumeChanged(normalizedVolume);
    }
    function handleCvcVolumeChanged() {
        const normalizedVolume = Math.round(cvcStream.volume / control.get_vol_max_norm() * 100);
        setMprisVolume(normalizedVolume);
    }
    function handleTitleSet(title) {
        onTitleChanged(title);
    }
    function getLength() {
        var _a, _b;
        const lengthMicroSeconds = ((_b = (_a = mediaServerPlayer.Metadata) === null || _a === void 0 ? void 0 : _a["mpris:length"]) === null || _b === void 0 ? void 0 : _b.unpack()) || 0;
        return microSecondsToRoundedSeconds(lengthMicroSeconds);
    }
    function getPosition() {
        if (getPlaybackStatus() === 'Stopped')
            return 0;
        const positionMicroSeconds = mediaProps.GetSync('org.mpris.MediaPlayer2.Player', 'Position')[0].deep_unpack();
        return microSecondsToRoundedSeconds(positionMicroSeconds);
    }
    function setUrl(url) {
        if (getPlaybackStatus() === 'Stopped') {
            const initialVolume = getInitialVolume();
            if (initialVolume == null) {
                throw new Error('initial Volume must not be undefined or null');
            }
            const command = `mpv --script=${consts_1.MPRIS_PLUGIN_PATH} ${url} 
                --volume=${initialVolume}`;
            spawnCommandLine(command);
            return;
        }
        mediaServerPlayer.OpenUriRemote(url);
        mediaServerPlayer.PlaySync();
    }
    function increaseDecreaseVolume(volumeChange) {
        const newVolume = Math.min(consts_1.MAX_VOLUME, Math.max(0, getVolume() + volumeChange));
        setMprisVolume(newVolume);
    }
    function setMprisVolume(newVolume) {
        if (getVolume() === newVolume || getPlaybackStatus() === 'Stopped')
            return;
        mediaServerPlayer.Volume = newVolume / 100;
    }
    function setCvcVolume(newVolume) {
        const newStreamVolume = newVolume / 100 * control.get_vol_max_norm();
        if (!cvcStream)
            return;
        if (cvcStream.volume === newStreamVolume)
            return;
        cvcStream.is_muted && cvcStream.change_is_muted(false);
        cvcStream.volume = newStreamVolume;
        cvcStream.push_volume();
    }
    function togglePlayPause() {
        if (getPlaybackStatus() === "Stopped")
            return;
        mediaServerPlayer.PlayPauseSync();
    }
    function stop() {
        if (getPlaybackStatus() === "Stopped")
            return;
        mediaServerPlayer.StopSync();
    }
    function getCurrentTitle() {
        if (getPlaybackStatus() === "Stopped")
            return;
        return mediaServerPlayer.Metadata["xesam:title"].unpack();
    }
    function pauseAllOtherMediaPlayers() {
        dbus.ListNamesSync()[0].forEach(busName => {
            if (!busName.includes(consts_1.MEDIA_PLAYER_2_NAME) || busName === consts_1.MPV_MPRIS_BUS_NAME)
                return;
            const nonMpvMediaServerPlayer = getDBusProxyWithOwner(consts_1.MEDIA_PLAYER_2_PLAYER_NAME, busName);
            nonMpvMediaServerPlayer.PauseSync();
        });
    }
    function getPlaybackStatus() {
        const mpvRunning = dbus.ListNamesSync()[0].includes(consts_1.MPV_MPRIS_BUS_NAME);
        return mpvRunning ? mediaServerPlayer.PlaybackStatus : 'Stopped';
    }
    function getVolume() {
        if (getPlaybackStatus() === 'Stopped')
            return null;
        return Math.round(mediaServerPlayer.Volume * 100);
    }
    function microSecondsToRoundedSeconds(microSeconds) {
        const seconds = microSeconds / 1000000;
        const secondsRounded = Math.round(seconds);
        return secondsRounded;
    }
    function setPosition(newPosition) {
        const positioninMicroSeconds = Math.min(newPosition * 1000000, currentLength * 1000000);
        const trackId = mediaServerPlayer.Metadata['mpris:trackid'].unpack();
        mediaServerPlayer === null || mediaServerPlayer === void 0 ? void 0 : mediaServerPlayer.SetPositionRemote(trackId, positioninMicroSeconds);
    }
    return {
        increaseDecreaseVolume,
        setVolume: setMprisVolume,
        setUrl,
        togglePlayPause,
        stop,
        getCurrentTitle,
        setPosition,
        dbus
    };
}
exports.createMpvHandler = createMpvHandler;
