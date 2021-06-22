"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Config_1 = require("Config");
const ChannelStore_1 = require("ChannelStore");
const ChannelList_1 = require("ui/ChannelList/ChannelList");
const MpvHandler_1 = require("mpv/MpvHandler");
const VolumeSlider_1 = require("ui/VolumeSlider");
const PopupMenu_1 = require("lib/PopupMenu");
const PopupSeperator_1 = require("lib/PopupSeperator");
const MediaControlToolbar_1 = require("ui/Toolbar/MediaControlToolbar");
const PlayPauseButton_1 = require("ui/Toolbar/PlayPauseButton");
const StopButton_1 = require("ui/Toolbar/StopButton");
const InfoSection_1 = require("ui/InfoSection");
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
const Seeker_1 = require("ui/Seeker");
const consts_1 = require("consts");
const { ScrollDirection } = imports.gi.Clutter;
const { getAppletDefinition } = imports.ui.appletManager;
const { panelManager } = imports.ui.main;
const { IconType, BoxLayout } = imports.gi.St;
function main(metadata, orientation, panelHeight, instanceId) {
    let lastVolume;
    let mpvHandler;
    const appletDefinition = getAppletDefinition({
        applet_id: instanceId,
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
        onMiddleClick: () => mpvHandler === null || mpvHandler === void 0 ? void 0 : mpvHandler.togglePlayPause(),
        onAppletRemovedFromPanel: () => mpvHandler === null || mpvHandler === void 0 ? void 0 : mpvHandler.stop(),
        onRightClick: () => popupMenu === null || popupMenu === void 0 ? void 0 : popupMenu.close()
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
    const volumeSlider = VolumeSlider_1.createVolumeSlider({
        onVolumeChanged: (volume) => mpvHandler === null || mpvHandler === void 0 ? void 0 : mpvHandler.setVolume(volume)
    });
    const popupMenu = PopupMenu_1.createPopupMenu({ launcher: applet.actor });
    const infoSection = InfoSection_1.createInfoSection();
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
    const seeker = Seeker_1.createSeeker({
        onPositionChanged: (value) => mpvHandler === null || mpvHandler === void 0 ? void 0 : mpvHandler.setPosition(value)
    });
    const radioActiveSection = new BoxLayout({
        vertical: true,
        visible: false
    });
    [
        infoSection.actor,
        mediaControlToolbar,
        volumeSlider.actor,
        seeker.actor
    ].forEach(widget => {
        radioActiveSection.add_child(PopupSeperator_1.createSeparatorMenuItem());
        radioActiveSection.add_child(widget);
    });
    popupMenu.add_child(channelList.actor);
    popupMenu.add_child(radioActiveSection);
    mpvHandler = MpvHandler_1.createMpvHandler({
        getInitialVolume: () => { return configs.initialVolume; },
        onVolumeChanged: handleVolumeChanged,
        onLengthChanged: hanldeLengthChanged,
        onPositionChanged: handlePositionChanged,
        checkUrlValid: (url) => channelStore.checkUrlValid(url),
        onTitleChanged: handleTitleChanged,
        onPlaybackstatusChanged: handlePlaybackstatusChanged,
        lastUrl: configs.lastUrl,
        onUrlChanged: handleUrlChanged
    });
    async function handleAppletClicked() {
        try {
            await CheckInstallation_1.installMpvWithMpris();
            popupMenu.toggle();
        }
        catch (error) {
            const notificationText = "Couldn't start the applet. Make sure mpv is installed and the mpv mpris plugin saved in the configs folder.";
            GenericNotification_1.notify({ text: notificationText });
        }
    }
    function handleScroll(scrollDirection) {
        const volumeChange = scrollDirection === ScrollDirection.UP ? consts_1.VOLUME_DELTA : -consts_1.VOLUME_DELTA;
        mpvHandler.increaseDecreaseVolume(volumeChange);
    }
    function handleChannelClicked(name) {
        const channelUrl = channelStore.getChannelUrl(name);
        mpvHandler.setUrl(channelUrl);
    }
    function handleTitleChanged(title) {
        infoSection.setSongTitle(title);
    }
    function handleVolumeChanged(volume) {
        volumeSlider.setVolume(volume);
        appletTooltip.setVolume(volume);
        lastVolume = volume;
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
    function handlePlaybackstatusChanged(playbackstatus) {
        if (playbackstatus === 'Stopped') {
            radioActiveSection.hide();
            configs.lastVolume = lastVolume;
            configs.lastUrl = null;
            appletLabel.setText(null);
            handleVolumeChanged(null);
            popupMenu.close();
        }
        if (playbackstatus !== 'Stopped' && !radioActiveSection.visible)
            radioActiveSection.show();
        channelList.setPlaybackStatus(playbackstatus);
        appletIcon.setPlaybackStatus(playbackstatus);
        if (playbackstatus === 'Playing' || playbackstatus === 'Paused') {
            playPauseBtn.setPlaybackStatus(playbackstatus);
        }
    }
    function handleUrlChanged(url) {
        const channelName = url ? channelStore.getChannelName(url) : null;
        appletLabel.setText(channelName);
        channelList.setCurrentChannel(channelName);
        infoSection.setChannel(channelName);
        configs.lastUrl = url;
    }
    function hanldeLengthChanged(length) {
        seeker.setLength(length);
    }
    function handlePositionChanged(position) {
        seeker === null || seeker === void 0 ? void 0 : seeker.setPosition(position);
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
    return applet;
}
