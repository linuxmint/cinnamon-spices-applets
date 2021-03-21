"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RadioApplet = void 0;
const { TextIconApplet, AllowedLayout, AppletPopupMenu } = imports.ui.applet;
const { PopupMenuManager, PopupSeparatorMenuItem, PopupMenuItem, PopupSubMenuMenuItem } = imports.ui.popupMenu;
const { Clipboard, ClipboardType } = imports.gi.St;
const MpvPlayerHandler_1 = require("./MpvPlayerHandler");
const PopupMenu_1 = require("./PopupMenu");
const ChannelStore_1 = require("./ChannelStore");
const utils_1 = require("./utils");
const { get_home_dir } = imports.gi.GLib;
const { ScrollDirection } = imports.gi.Clutter;
const { AppletSettings } = imports.ui.settings;
class RadioApplet extends TextIconApplet {
    constructor(metadata, orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId);
        this.uuid = metadata.uuid;
        this.orientation = orientation;
        this.setAllowedLayout(AllowedLayout.BOTH);
        this.settings = new AppletSettings(this, this.uuid, instanceId);
    }
    async init(orientation) {
        this.initSettings();
        this.initChannelStore(this.channelList);
        await this.initMpvPlayer();
        this.initGui();
        this.actor.connect('scroll-event', (actor, event) => this.handleMouseScroll(event));
    }
    initSettings() {
        this.settings.bind("icon-type", "iconType", () => this.setIcon());
        this.settings.bind("color-on", "symbolicIconColorWhenPlaying", () => this.setIconColor());
        this.settings.bind("channel-on-panel", "channelNameOnPanel", () => this.setAppletLabel());
        this.settings.bind("initial-volume", "customInitVolume", () => this.updateMpvInitialVolume());
        this.settings.bind("keep-volume-between-sessions", "keepVolume", () => this.updateMpvInitialVolume());
        this.settings.bind("last-volume", "lastVolume", () => this.updateMpvInitialVolume());
        this.settings.bind("tree", "channelList", (channelList) => this.handleChannelListChanged(channelList));
        this.settings.bind("current-url", "currentUrl");
        this.settings.bind("music-download-dir-select", "music_dir");
    }
    initGui() {
        this.setIcon();
        const playbackStatus = this.mpvPlayer.playbackStatus;
        const channelName = this.mpvPlayer.currentUrl ?
            this.channelStore.getChannelName(this.mpvPlayer.currentUrl) : null;
        this.setIconColor(playbackStatus);
        this.setAppletLabel(playbackStatus, channelName);
        this.setAppletTooltip(this.mpvPlayer.volume);
        this.createMenu(channelName, playbackStatus);
        this.createContextMenu();
    }
    initChannelStore(channelList) {
        this.channelStore = new ChannelStore_1.ChannelStore(channelList);
    }
    async initMpvPlayer() {
        this.mpvPlayer = new MpvPlayerHandler_1.MpvPlayerHandler({
            validUrls: this.channelStore.getActivatedChannelUrls(),
            currentUrl: this.currentUrl,
            initialVolume: this.initialVolume,
            onStopped: (...args) => this.handleRadioStopped(...args),
            onVolumeChanged: (...args) => this.handleVolumeChanged(...args),
            onStarted: (...args) => this.handleRadioStarted(...args),
            onChannelChanged: (...args) => this.handleChannelChanged(...args),
            onPaused: (...args) => this.handleRadioPaused(...args),
            onResumed: (...args) => this.handleRadioResumed(...args),
        });
        await this.mpvPlayer.init();
    }
    createMenu(channelName, playbackStatus) {
        const stationNames = this.channelStore.getActivatedChannelNames();
        if (!this.menuManager)
            this.menuManager = new PopupMenuManager(this);
        this.mainMenu = new PopupMenu_1.PopupMenu(this, this.orientation, stationNames, (...args) => this.handleChannelClicked(...args), () => this.mpvPlayer.stop(), channelName, playbackStatus);
        this.menuManager.addMenu(this.mainMenu);
    }
    createContextMenu() {
        const copyTitleItem = new PopupMenuItem("Copy current song title");
        copyTitleItem.connect("activate", () => this.handleCopySong());
        const youtubeDownloadItem = new PopupMenuItem("Download from Youtube");
        youtubeDownloadItem.connect('activate', () => utils_1.downloadSongFromYoutube(this.mpvPlayer.currentSong, this.music_dir));
        this._applet_context_menu.addMenuItem(copyTitleItem, 0);
        this._applet_context_menu.addMenuItem(youtubeDownloadItem, 1);
        this._applet_context_menu.addMenuItem(new PopupSeparatorMenuItem());
    }
    handleCopySong() {
        const currentSong = this.mpvPlayer.currentSong;
        if (currentSong) {
            Clipboard.get_default().set_text(ClipboardType.CLIPBOARD, currentSong);
        }
    }
    setIcon() {
        if (this.iconType === "SYMBOLIC")
            this.set_applet_icon_symbolic_name('radioapplet');
        else
            this.set_applet_icon_name(`radioapplet-${this.iconType.toLowerCase()}`);
    }
    setIconColor(playbackStatus) {
        playbackStatus !== null && playbackStatus !== void 0 ? playbackStatus : (playbackStatus = this.mpvPlayer.playbackStatus);
        const color = playbackStatus === "Playing" ? this.symbolicIconColorWhenPlaying : true;
        this.actor.style = `color: ${color}`;
    }
    setAppletLabel(playbackStatus, currentChannelName) {
        playbackStatus !== null && playbackStatus !== void 0 ? playbackStatus : (playbackStatus = this.mpvPlayer.playbackStatus);
        if (playbackStatus === "Playing") {
            currentChannelName !== null && currentChannelName !== void 0 ? currentChannelName : (currentChannelName = this.channelStore.getChannelName(this.currentUrl));
        }
        const label = (this.channelNameOnPanel && playbackStatus === "Playing")
            ? ' ' + currentChannelName : '';
        this.set_applet_label(label);
    }
    setAppletTooltip(volume) {
        const tooltipTxt = volume ? `Volume: ${volume.toString()}%` : "Radio++";
        this.set_applet_tooltip(tooltipTxt);
    }
    handleRadioStopped(previousChannelUrl) {
        this.currentUrl = null;
        const previousChannelName = this.channelStore.getChannelName(previousChannelUrl);
        this.setAppletLabel('Stopped');
        this.setIconColor('Stopped');
        this.setAppletTooltip(null);
        this.mainMenu.activateStopItem(previousChannelName);
    }
    handleRadioPaused(channelUrl) {
        const channelName = this.channelStore.getChannelName(channelUrl);
        this.mainMenu.pauseChannelItem(channelName);
        this.setIconColor('Paused');
        this.setAppletLabel('Paused');
    }
    handleRadioResumed(channelUrl) {
        const channelName = this.channelStore.getChannelName(channelUrl);
        this.mainMenu.resumeChannelItem(channelName);
        this.setIconColor('Playing');
        this.setAppletLabel('Playing');
    }
    handleRadioStarted(channelUrl) {
        this.currentUrl = channelUrl;
        const channelName = this.channelStore.getChannelName(channelUrl);
        this.mainMenu.activateChannelItem(channelName);
        this.setIconColor('Playing');
        this.setAppletLabel('Playing', channelName);
    }
    handleChannelChanged(oldUrl, newUrl) {
        this.currentUrl = newUrl;
        const newChannelName = this.channelStore.getChannelName(newUrl);
        const oldChannelName = this.channelStore.getChannelName(oldUrl);
        this.mainMenu.changeChannelItem(newChannelName, oldChannelName);
        this.setIconColor('Playing');
        this.setAppletLabel('Playing', newChannelName);
    }
    handleChannelListChanged(channelList) {
        this.initChannelStore(channelList);
        this.mainMenu.updateStationList(this.channelStore.getActivatedChannelNames(), this.mpvPlayer.playbackStatus, this.channelStore.getChannelName(this.currentUrl));
        this.mpvPlayer.updateValidUrls(this.channelStore.getActivatedChannelUrls());
    }
    handleChannelClicked(channelName) {
        const url = this.channelStore.getChannelUrl(channelName);
        const playbackStatus = this.mpvPlayer.playbackStatus;
        if (playbackStatus === "Stopped") {
            this.mpvPlayer.start(url);
            return;
        }
        if (this.mpvPlayer.currentUrl !== url) {
            this.mpvPlayer.changeChannel(url);
            return;
        }
        if (playbackStatus === "Paused")
            this.mpvPlayer.togglePlayPause();
    }
    handleVolumeChanged(volume) {
        this.setAppletTooltip(volume);
        this.lastVolume = volume;
    }
    get initialVolume() {
        return this.keepVolume ? this.lastVolume : this.customInitVolume;
    }
    updateMpvInitialVolume() {
        this.mpvPlayer.initialVolume = this.initialVolume;
    }
    on_applet_removed_from_panel(deleteConfig) {
    }
    async on_applet_clicked(event) {
        try {
            await utils_1.checkInstallMrisPlugin();
            await utils_1.checkInstallMpv();
            this.mainMenu.toggle();
        }
        catch (error) {
            global.log(`error occured: ${error}`);
            utils_1.notifySend("couldn't start the applet. Make sure mpv is installed and the mpv mpris plugin saved in the configs folder.");
        }
    }
    handleMouseScroll(event) {
        const direction = event.get_scroll_direction();
        const volumeChange = (direction === ScrollDirection.UP) ? 5 : -5;
        this.mpvPlayer.increaseDecreaseVolume(volumeChange);
    }
    on_applet_middle_clicked(event) {
        this.mpvPlayer.togglePlayPause();
    }
}
exports.RadioApplet = RadioApplet;
