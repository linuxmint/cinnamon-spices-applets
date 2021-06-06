"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Config_1 = require("Config");
const ChannelStore_1 = require("ChannelStore");
const ChannelList_1 = require("ui/ChannelList/ChannelList");
const MpvHandler_1 = require("mpv/MpvHandler");
const VolumeSlider_1 = require("ui/VolumeSlider");
const RadioPopupMenu_1 = require("ui/RadioPopupMenu");
const MediaControlToolbar_1 = require("ui/Toolbar/MediaControlToolbar");
const PlayPauseButton_1 = require("ui/Toolbar/PlayPauseButton");
const StopButton_1 = require("ui/Toolbar/StopButton");
const SongInfoItem_1 = require("ui/InfoSection/SongInfoItem");
const ChannelInfoItem_1 = require("ui/InfoSection/ChannelInfoItem");
const DownloadButton_1 = require("ui/Toolbar/DownloadButton");
const CopyButton_1 = require("ui/Toolbar/CopyButton");
const downloadFromYoutube_1 = require("functions/downloadFromYoutube");
const CheckInstallation_1 = require("mpv/CheckInstallation");
const copyText_1 = require("functions/copyText");
const Applet_1 = require("ui/Applet/Applet");
const AppletIcon_1 = require("ui/Applet/AppletIcon");
const AppletLabel_1 = require("ui/Applet/AppletLabel");
const AppletTooltip_1 = require("ui/Applet/AppletTooltip");
const YoutubeDownloadFinishedNotification_1 = require("ui/Notifications/YoutubeDownloadFinishedNotification");
const YoutubeDownloadStartedNotification_1 = require("ui/Notifications/YoutubeDownloadStartedNotification");
const YoutubeDownloadFailedNotification_1 = require("ui/Notifications/YoutubeDownloadFailedNotification");
const GenericNotification_1 = require("ui/Notifications/GenericNotification");
const { ScrollDirection } = imports.gi.Clutter;
const { getAppletDefinition } = imports.ui.appletManager;
const { panelManager } = imports.ui.main;
const { IconType } = imports.gi.St;
function main(metadata, orientation, panelHeight, instanceId) {
    const appletDefinition = getAppletDefinition({
        applet_id: instanceId
    });
    const panel = panelManager.panels.find(panel => (panel === null || panel === void 0 ? void 0 : panel.panelId) === appletDefinition.panelId);
    panel.connect('icon-size-changed', () => appletIcon.updateIconSize());
    const appletIcon = AppletIcon_1.createAppletIcon({
        locationLabel: appletDefinition.location_label,
        panel
    });
    const appletLabel = AppletLabel_1.createAppletLabel();
    const applet = Applet_1.createApplet({
        icon: appletIcon.actor,
        label: appletLabel.actor,
        instanceId,
        orientation,
        panelHeight,
        onClick: handleAppletClicked,
        onScroll: handleScroll,
        onMiddleClick: () => mpvHandler.togglePlayPause(),
        onAppletRemovedFromPanel: () => mpvHandler.stop()
    });
    const appletTooltip = AppletTooltip_1.createAppletTooltip({
        applet,
        orientation
    });
    const configs = Config_1.createConfig({
        uuid: __meta.uuid,
        instanceId,
        onIconChanged: handleIconTypeChanged,
        onIconColorPlayingChanged: (color) => {
            appletIcon.setColorWhenPlaying(color);
        },
        onIconColorPausedChanged: (color) => {
            appletIcon.setColorWhenPaused(color);
        },
        onChannelOnPanelChanged: (channelOnPanel) => {
            appletLabel.setVisibility(channelOnPanel);
        },
        onMyStationsChanged: handleStationsUpdated,
    });
    const channelStore = new ChannelStore_1.ChannelStore(configs.userStations);
    const channelList = ChannelList_1.createChannelList({
        stationNames: channelStore.activatedChannelNames,
        onChannelClicked: handleChannelClicked
    });
    const volumeSlider = new VolumeSlider_1.VolumeSlider({
        onValueChanged: (volume) => mpvHandler.setVolume(volume)
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
        onClick: handleDownloadBtnClicked
    });
    const copyBtn = CopyButton_1.createCopyButton({
        onClick: () => copyText_1.copyText(mpvHandler.getCurrentTitle())
    });
    const mediaControlToolbar = MediaControlToolbar_1.createMediaControlToolbar({
        controlBtns: [playPauseBtn.actor, downloadBtn.actor, copyBtn.actor, stopBtn.actor]
    });
    const popupMenu = RadioPopupMenu_1.createRadioPopupMenu({
        radioApplet: applet,
        orientation,
        channelList: channelList.actor,
        volumeSlider,
        songInfoItem: songInfoItem.actor,
        channelInfoItem: channelInfoItem.actor,
        mediaControlToolbar
    });
    async function handleAppletClicked() {
        try {
            await CheckInstallation_1.installMpvWithMpris();
            popupMenu.toggle();
            channelList.open();
        }
        catch (error) {
            const notificationText = "Couldn't start the applet. Make sure mpv is installed and the mpv mpris plugin saved in the configs folder.";
            GenericNotification_1.notify({ text: notificationText });
        }
    }
    function handleScroll(scrollDirection) {
        const volumeChange = scrollDirection === ScrollDirection.UP ? 5 : -5;
        mpvHandler.increaseDecreaseVolume(volumeChange);
    }
    function handleRadioInitialized(playbackStatus, volume) {
        if (playbackStatus === 'Stopped') {
            return;
        }
        popupMenu.radioActive = true;
        handlePlaybackstatusChanged(playbackStatus);
        handleVolumeChanged(volume);
        handleUrlChanged(configs.lastUrl);
    }
    function handleChannelClicked(name) {
        const channelUrl = channelStore.getChannelUrl(name);
        mpvHandler.setChannelUrl(channelUrl);
    }
    function handleTitleChanged(title) {
        songInfoItem.setSongTitle(title);
    }
    function handleVolumeChanged(volume) {
        volumeSlider.value = volume;
        appletTooltip.setVolume(volume);
    }
    function handleIconTypeChanged(iconType) {
        appletIcon.setIconType(iconType);
    }
    function handleStationsUpdated(stations) {
        const stationsChanged = channelStore.checkListChanged(stations);
        if (!stationsChanged)
            return;
        channelStore.channelList = stations;
        channelList.setStationNames(channelStore.activatedChannelNames);
        const lastUrlValid = channelStore.checkUrlValid(configs.lastUrl);
        if (!lastUrlValid)
            mpvHandler.stop();
    }
    function handlePlaybackstatusChanged(playbackstatus, lastVolume) {
        if (playbackstatus === 'Stopped')
            handleVolumeChanged(null);
        if (playbackstatus === 'Stopped')
            handleUrlChanged(null);
        channelList.setPlaybackstatus(playbackstatus);
        appletIcon.setPlaybackStatus(playbackstatus);
        popupMenu.radioActive = (playbackstatus !== 'Stopped');
        if (playbackstatus === 'Playing' || playbackstatus === 'Paused') {
            playPauseBtn.setPlaybackStatus(playbackstatus);
        }
        if (lastVolume != null)
            configs.lastVolume = lastVolume;
    }
    function handleUrlChanged(url) {
        const channelName = url ? channelStore.getChannelName(url) : null;
        appletLabel.setText(channelName);
        channelList.setCurrentChannel(channelName);
        channelInfoItem.setChannel(channelName);
        configs.lastUrl = url;
    }
    function handleDownloadBtnClicked() {
        const title = mpvHandler.getCurrentTitle();
        const downloadProcess = downloadFromYoutube_1.downloadSongFromYoutube({
            downloadDir: configs.musicDownloadDir,
            title,
            onDownloadFinished: (path) => YoutubeDownloadFinishedNotification_1.notifyYoutubeDownloadFinished({
                downloadPath: path
            }),
            onDownloadFailed: YoutubeDownloadFailedNotification_1.notifyYoutubeDownloadFailed
        });
        YoutubeDownloadStartedNotification_1.notifyYoutubeDownloadStarted({
            title,
            onCancelClicked: () => downloadProcess.cancel()
        });
    }
    const mpvHandler = MpvHandler_1.createMpvHandler({
        getInitialVolume: () => { return configs.initialVolume; },
        onInitialized: handleRadioInitialized,
        onVolumeChanged: handleVolumeChanged,
        checkUrlValid: (url) => channelStore.checkUrlValid(url),
        onTitleChanged: handleTitleChanged,
        onPlaybackstatusChanged: handlePlaybackstatusChanged,
        initialUrl: configs.lastUrl,
        onUrlChanged: handleUrlChanged
    });
    return applet;
}
