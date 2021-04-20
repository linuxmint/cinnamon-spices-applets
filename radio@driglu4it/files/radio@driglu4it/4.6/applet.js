"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Config_1 = require("Config");
const ChannelStore_1 = require("ChannelStore");
const ChannelList_1 = require("ui/ChannelList");
const RadioApplet_1 = require("ui/RadioApplet");
const MpvHandler_1 = require("mpv/MpvHandler");
const VolumeSlider_1 = require("ui/VolumeSlider");
const RadioPopupMenu_1 = require("ui/RadioPopupMenu");
const MediaControlToolbar_1 = require("ui/MediaControlToolbar");
const PlayPauseButton_1 = require("ui/PlayPauseButton");
const StopButton_1 = require("ui/StopButton");
const SongInfoItem_1 = require("ui/SongInfoItem");
const ChannelInfoItem_1 = require("ui/ChannelInfoItem");
const DownloadButton_1 = require("ui/DownloadButton");
const CopyButton_1 = require("ui/CopyButton");
const downloadFromYoutube_1 = require("functions/downloadFromYoutube");
const notify_1 = require("functions/notify");
const CheckInstallation_1 = require("mpv/CheckInstallation");
const copyText_1 = require("functions/copyText");
const { ScrollDirection } = imports.gi.Clutter;
let mpvHandler;
function main(metadata, orientation, panelHeight, instanceId) {
    const configs = Config_1.createConfig({
        uuid: __meta.uuid,
        instanceId,
        onIconChanged: (iconType) => {
            radioApplet.updateState({ iconType });
        },
        onIconColorChanged: (color) => {
            radioApplet.updateState({ colorWhenPlaying: color });
        },
        onChannelOnPanelChanged: (channelOnPanel) => {
            radioApplet.updateState({ channelOnPanel });
        },
        onMyStationsChanged: handleStationsUpdated,
    });
    const radioApplet = RadioApplet_1.createRadioApplet({
        iconType: configs.iconType,
        colorWhenPlaying: configs.symbolicIconColorWhenPlaying,
        channelOnPanel: configs.channelNameOnPanel,
        orientation,
        panelHeight,
        instanceId,
        onAppletClick: handleAppletClicked,
        onScroll: handleScroll,
        onAppletMiddleClick: () => mpvHandler.togglePlayPause(),
        onAppletRemovedFromPanel: () => mpvHandler.stop()
    });
    const channelStore = new ChannelStore_1.ChannelStore(configs.userStations);
    const channelList = ChannelList_1.createChannelList({
        stationNames: channelStore.activatedChannelNames,
        onChannelClicked: handleChannelClicked
    });
    const volumeSlider = new VolumeSlider_1.VolumeSlider({
        onValueChanged: (volume) => mpvHandler.volume = volume
    });
    const songInfoItem = SongInfoItem_1.createSongInfoItem();
    const channelInfoItem = ChannelInfoItem_1.createChannelInfoItem();
    const playPauseBtn = PlayPauseButton_1.createPlayPauseButton({
        onClick: () => mpvHandler.togglePlayPause()
    });
    const stopBtn = StopButton_1.createStopBtn({
        onClick: () => mpvHandler.stop()
    });
    const downloadBtn = DownloadButton_1.createDownloadButton({
        onClick: () => downloadFromYoutube_1.downloadSongFromYoutube(mpvHandler.currentTitle, configs.musicDownloadDir)
    });
    const copyBtn = CopyButton_1.createCopyButton({
        onClick: () => copyText_1.copyText(mpvHandler.currentTitle)
    });
    const mediaControlToolbar = MediaControlToolbar_1.createMediaControlToolbar({
        controlBtns: [playPauseBtn, downloadBtn, copyBtn, stopBtn]
    });
    const popupMenu = RadioPopupMenu_1.createRadioPopupMenu({
        radioApplet,
        orientation,
        channelList,
        volumeSlider,
        songInfoItem,
        channelInfoItem,
        mediaControlToolbar
    });
    async function handleAppletClicked() {
        try {
            await CheckInstallation_1.checkInstallMrisPlugin();
            await CheckInstallation_1.checkInstallMpv();
            popupMenu.toggle();
            channelList.open();
        }
        catch (error) {
            notify_1.notifySend("couldn't start the applet. Make sure mpv is installed and the mpv mpris plugin saved in the configs folder.");
        }
    }
    function handleScroll(scrollDirection) {
        const volumeChange = scrollDirection === ScrollDirection.UP ? 5 : -5;
        mpvHandler.increaseDecreaseVolume(volumeChange);
    }
    function handleRadioInitialized(playbackStatus, volume) {
        const url = configs.lastUrl;
        if (playbackStatus === 'Stopped' || !url) {
            return;
        }
        popupMenu.running = true;
        const channelName = channelStore.getChannelName(url);
        playPauseBtn.playPause = playbackStatus;
        volumeSlider.value = volume;
        radioApplet.updateState({ playbackStatus, channelName, volume });
        channelList.updateState({ channelName, playbackStatus });
        channelInfoItem.channel = channelName;
        return url;
    }
    function handleRadioStarted(volume, url) {
        popupMenu.running = true;
        const channelName = channelStore.getChannelName(url);
        const playbackStatus = "Playing";
        volumeSlider.value = volume;
        configs.lastUrl = url;
        radioApplet.updateState({ channelName, playbackStatus, volume });
        channelList.updateState({ channelName, playbackStatus });
        channelInfoItem.channel = channelName;
    }
    function handleChannelClicked(name) {
        mpvHandler.channelUrl = channelStore.getChannelUrl(name);
    }
    function handleRadioPaused() {
        playPauseBtn.playPause = "Paused";
        radioApplet.updateState({ playbackStatus: "Paused" });
        channelList.updateState({ playbackStatus: "Paused" });
    }
    function handleRadioResumed() {
        playPauseBtn.playPause = "Playing";
        radioApplet.updateState({ playbackStatus: "Playing" });
        channelList.updateState({ playbackStatus: "Playing" });
    }
    function handleChannelChanged(url) {
        const channelName = channelStore.getChannelName(url);
        configs.lastUrl = url;
        radioApplet.updateState({ channelName });
        channelList.updateState({ channelName });
        channelInfoItem.channel = channelName;
    }
    async function handleRadioStopped(volume) {
        radioApplet.updateState({ playbackStatus: "Stopped" });
        channelList.updateState({ playbackStatus: "Stopped" });
        popupMenu.running = false;
        configs.lastVolume = volume;
    }
    function handleTitleChanged(title) {
        songInfoItem.title = title;
    }
    function handleVolumeChanged(volume) {
        volumeSlider.value = volume;
        radioApplet.updateState({ volume });
    }
    function handleStationsUpdated(stations) {
        const stationsChanged = channelStore.checkListChanged(stations);
        if (!stationsChanged)
            return;
        channelStore.channelList = stations;
        channelList.updateState({ stationNames: channelStore.activatedChannelNames });
        const lastUrlValid = channelStore.checkUrlValid(configs.lastUrl);
        if (!lastUrlValid)
            mpvHandler.stop();
    }
    async function initMpvHandler() {
        mpvHandler = await MpvHandler_1.createMpvHandler({
            getInitialVolume: () => { return configs.initialVolume; },
            onChannelChanged: handleChannelChanged,
            onInitialized: handleRadioInitialized,
            onStarted: handleRadioStarted,
            onStopped: handleRadioStopped,
            onVolumeChanged: handleVolumeChanged,
            ckeckUrlValid: (url) => channelStore.checkUrlValid(url),
            onPaused: handleRadioPaused,
            onResumed: handleRadioResumed,
            onTitleChanged: handleTitleChanged,
        });
    }
    initMpvHandler();
    return radioApplet;
}
