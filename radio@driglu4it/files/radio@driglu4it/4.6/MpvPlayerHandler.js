"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MpvPlayerHandler = void 0;
const { spawnCommandLine } = imports.misc.util;
const Cvc = imports.gi.Cvc;
const utils_1 = require("./utils");
const constants_1 = require("./constants");
const MEDIA_PLAYER_2_NAME = "org.mpris.MediaPlayer2";
const MEDIA_PLAYER_2_PLAYER_NAME = "org.mpris.MediaPlayer2.Player";
const MEDIA_PLAYER_2_PATH = "/org/mpris/MediaPlayer2";
const MPV_MPRIS_BUS_NAME = `${MEDIA_PLAYER_2_NAME}.mpv`;
const MAX_VOLUME = 100;
class MpvPlayerHandler {
    constructor(args) {
        Object.assign(this, args);
    }
    async init() {
        this.dbus = await utils_1.getDBusPromise();
        this.mediaServerPlayer = await utils_1.getDBusProxyWithOwnerPromise(MEDIA_PLAYER_2_PLAYER_NAME, MPV_MPRIS_BUS_NAME);
        this.mediaProps = await utils_1.getDBusPropertiesPromise(MPV_MPRIS_BUS_NAME, MEDIA_PLAYER_2_PATH);
        const mpvRunning = (await this.getAllMrisPlayerBusNames()).includes(MPV_MPRIS_BUS_NAME);
        if (mpvRunning) {
            this.playbackStatus = this.mediaServerPlayer.PlaybackStatus;
            this.propsChangeListener = this.initMediaPropsChangeListener();
            this.volume = this.normalizeMprisVolume(this.mediaServerPlayer.Volume);
        }
        else {
            this.playbackStatus = "Stopped";
            this.currentUrl = null;
        }
        this.listenToDBus();
        this.listenToCvcStream();
    }
    listenToCvcStream() {
        this.control = new Cvc.MixerControl({ name: __meta.name });
        this.control.open();
        this.control.connect('stream-added', (...args) => {
            const id = args[1];
            const stream = this.control.lookup_stream_id(id);
            if ((stream === null || stream === void 0 ? void 0 : stream.name) === "mpv Media Player") {
                this.stream = stream;
                this.updateCvcVolume(this.normalizeMprisVolume(this.mediaServerPlayer.Volume));
                this.stream.connect("notify::volume", () => {
                    this.handleCvcVolumeChanged();
                });
            }
        });
    }
    handleCvcVolumeChanged() {
        const normalizedVolume = this.normalizeCvcStreamVolume(this.stream.volume);
        this.updateVolume('mpris', normalizedVolume);
    }
    initMediaPropsChangeListener() {
        return this.mediaProps.connectSignal('PropertiesChanged', (...args) => {
            var _a, _b, _c;
            const props = args[2][1];
            const playbackStatus = (_a = props === null || props === void 0 ? void 0 : props.PlaybackStatus) === null || _a === void 0 ? void 0 : _a.deep_unpack();
            const metadata = (_b = props === null || props === void 0 ? void 0 : props.Metadata) === null || _b === void 0 ? void 0 : _b.deep_unpack();
            const volume = (_c = props === null || props === void 0 ? void 0 : props.Volume) === null || _c === void 0 ? void 0 : _c.deep_unpack();
            volume && this.handleMprisVolumeChanged(volume);
            metadata && this.handleMetadataChange(metadata);
            playbackStatus && this.handlePlaybackStatusChanged(playbackStatus);
        });
    }
    listenToDBus() {
        this.dbus.connectSignal('NameOwnerChanged', (...args) => {
            const name = args[2][0];
            const newOwner = args[2][2];
            if (name !== MPV_MPRIS_BUS_NAME)
                return;
            if (newOwner) {
                this.propsChangeListener = this.initMediaPropsChangeListener();
            }
            else {
                this.onStopped(this.currentUrl);
                this.currentUrl = null;
                this.playbackStatus = "Stopped";
                this.mediaProps.disconnectSignal(this.propsChangeListener);
            }
        });
    }
    updateValidUrls(urls) {
        this.validUrls = urls;
        if (!this.validUrls.includes(this.currentUrl)) {
            this.stop();
        }
    }
    handleMetadataChange(metadata) {
        const url = metadata["xesam:url"].unpack();
        if (url === this.currentUrl || !this.validUrls.includes(url)) {
            return;
        }
        this.currentUrl ? this.onChannelChanged(this.currentUrl, url) : this.onStarted(url);
        this.currentUrl = url;
        this.playbackStatus = this.mediaServerPlayer.PlaybackStatus;
    }
    handlePlaybackStatusChanged(playbackStatus) {
        if (this.playbackStatus === playbackStatus)
            return;
        playbackStatus === "Paused" && this.onPaused(this.currentUrl);
        playbackStatus === "Playing" && this.onResumed(this.currentUrl);
        this.playbackStatus = playbackStatus;
    }
    handleMprisVolumeChanged(newMprisVolume) {
        const normalizedVolume = this.normalizeMprisVolume(newMprisVolume);
        this.updateVolume('cvcStream', normalizedVolume);
    }
    normalizeMprisVolume(mprisVolume) {
        return Math.round(mprisVolume * 100);
    }
    normalizedVolumeToMprisVolume(normalizedVolume) {
        return normalizedVolume / 100;
    }
    normalizedVolumeToCvcStreamVolume(normalizedVolume) {
        return normalizedVolume / 100 * this.control.get_vol_max_norm();
    }
    normalizeCvcStreamVolume(streamVolume) {
        return Math.round(streamVolume / this.control.get_vol_max_norm() * 100);
    }
    getAllMrisPlayerBusNames() {
        const name_regex = /^org\.mpris\.MediaPlayer2\./;
        return new Promise((resolve, reject) => {
            this.dbus.ListNamesRemote((names) => {
                const busNames = names[0].filter(busName => name_regex.test(busName));
                const busNamesArr = Object.values(busNames);
                resolve(busNamesArr);
            });
        });
    }
    async pauseAllOtherMediaPlayer() {
        const allMprisPlayerBusNames = await this.getAllMrisPlayerBusNames();
        allMprisPlayerBusNames.forEach(async (busName) => {
            if (busName === MPV_MPRIS_BUS_NAME)
                return;
            const mediaServerPlayer = await utils_1.getDBusProxyWithOwnerPromise(MEDIA_PLAYER_2_PLAYER_NAME, busName);
            mediaServerPlayer.PauseRemote();
        });
    }
    start(channelUrl) {
        this.pauseAllOtherMediaPlayer();
        this.volume = this.initialVolume;
        const command = `mpv --script=${constants_1.MPRIS_PLUGIN_PATH} ${channelUrl} --volume=${this.initialVolume}`;
        spawnCommandLine(command);
    }
    changeChannel(channelUrl) {
        if (this.currentUrl === channelUrl)
            return;
        this.mediaServerPlayer.PlayRemote();
        this.mediaServerPlayer.OpenUriRemote(channelUrl);
    }
    togglePlayPause() {
        if (this.playbackStatus === "Stopped")
            return;
        this.mediaServerPlayer.PlayPauseRemote();
    }
    stop() {
        if (this.playbackStatus === "Stopped")
            return;
        this.mediaServerPlayer.StopRemote();
    }
    increaseDecreaseVolume(volumeChange) {
        if (this.playbackStatus === "Stopped")
            return;
        this.updateVolume('both', this.volume + volumeChange);
    }
    updateCvcVolume(newNormalizedVolume) {
        this.stream.is_muted && this.stream.change_is_muted(false);
        this.stream.volume = this.normalizedVolumeToCvcStreamVolume(newNormalizedVolume);
        this.stream.push_volume();
    }
    updateMprisVolume(newNormalizedVolume) {
        this.mediaServerPlayer.Volume = this.normalizedVolumeToMprisVolume(newNormalizedVolume);
    }
    updateVolume(target, newVolume) {
        newVolume = Math.min(MAX_VOLUME, Math.max(0, newVolume));
        if (newVolume === this.volume)
            return;
        if (target === "cvcStream" || target === "both") {
            if (!this.stream || this.normalizeCvcStreamVolume(this.stream.volume) === newVolume)
                return;
            this.updateCvcVolume(newVolume);
        }
        if (target === "mpris" || target === "both") {
            if (this.normalizeMprisVolume(this.mediaServerPlayer.Volume) === newVolume)
                return;
            this.updateMprisVolume(newVolume);
        }
        this.volume = newVolume;
        this.onVolumeChanged(newVolume);
    }
    get currentSong() {
        if (this.playbackStatus === "Stopped")
            return;
        return this.mediaServerPlayer.Metadata["xesam:title"].unpack();
    }
}
exports.MpvPlayerHandler = MpvPlayerHandler;
