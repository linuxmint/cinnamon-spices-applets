"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RadioApplet = void 0;
const { TextIconApplet, AllowedLayout, AppletPopupMenu } = imports.ui.applet;
const { PopupMenuManager, PopupSeparatorMenuItem, PopupMenuItem } = imports.ui.popupMenu;
const { Clipboard, ClipboardType } = imports.gi.St;
const MpvPlayerHandler_1 = require("./MpvPlayerHandler");
const PopupMenu_1 = require("./PopupMenu");
const ChannelStore_1 = require("./ChannelStore");
const utils_1 = require("./utils");
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
        this.channelStore = new ChannelStore_1.ChannelStore(this.channelList);
        await this.initMpvPlayer();
        this.currentUrl = this.mpvPlayer.currentUrl;
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
        var _a;
        this.setIcon();
        const playbackStatus = this.mpvPlayer.playbackStatus;
        this.setIconColor(playbackStatus);
        this.setAppletLabel(playbackStatus, this.currentChannelName);
        this.setAppletTooltip(playbackStatus, (_a = this.mpvPlayer) === null || _a === void 0 ? void 0 : _a.volume);
        this.createMenu(playbackStatus);
        this.createContextMenu();
    }
    async initMpvPlayer() {
        this.mpvPlayer = new MpvPlayerHandler_1.MpvPlayerHandler({
            validUrls: this.activatedChannelUrls,
            currentUrl: this.currentUrl,
            initialVolume: this.initialVolume,
            onStopped: (...args) => this.handleRadioStopped(),
            onVolumeChanged: (...args) => this.handleVolumeChanged(...args),
            onStarted: (...args) => this.handleRadioStarted(...args),
            onChannelChanged: (...args) => this.handleChannelChanged(args[0]),
            onPaused: (...args) => this.handleRadioPaused(),
            onResumed: (...args) => this.handleRadioResumed(),
        });
        await this.mpvPlayer.init();
    }
    createMenu(playbackStatus) {
        var _a;
        (_a = this.menuManager) !== null && _a !== void 0 ? _a : (this.menuManager = new PopupMenuManager(this));
        this.mainMenu = new PopupMenu_1.PopupMenu({
            launcher: this,
            orientation: this.orientation,
            stations: this.activatedChannelNames,
            onChannelClicked: (...args) => this.handleChannelClicked(...args),
            onStopClicked: () => this.mpvPlayer.stop(),
            initialChannel: this.currentChannelName,
            initialPlaybackstatus: playbackStatus
        });
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
        const label = (this.channelNameOnPanel && playbackStatus === "Playing")
            ? ' ' + this.currentChannelName : '';
        this.set_applet_label(label);
    }
    setAppletTooltip(playbackStatus, volume) {
        const tooltipTxt = playbackStatus === "Stopped" ? "Radio++" : `Volume: ${volume.toString()}%`;
        this.set_applet_tooltip(tooltipTxt);
    }
    handleRadioStopped() {
        this.currentUrl = null;
        this.setAppletLabel('Stopped');
        this.setIconColor('Stopped');
        this.setAppletTooltip('Stopped');
        this.mainMenu.playbackStatus = "Stopped";
        this.lastVolume = this.mpvPlayer.volume;
        this.updateMpvInitialVolume();
    }
    handleRadioPaused() {
        this.setAppletLabel('Paused');
        this.setIconColor('Paused');
        this.mainMenu.playbackStatus = 'Paused';
    }
    handleRadioResumed() {
        this.setAppletLabel('Playing');
        this.setIconColor('Playing');
        this.mainMenu.playbackStatus = 'Playing';
    }
    handleRadioStarted(channelUrl) {
        this.currentUrl = channelUrl;
        this.setAppletLabel('Playing', this.currentChannelName);
        this.setIconColor('Playing');
        this.setAppletTooltip('Playing', this.mpvPlayer.volume);
        this.mainMenu.setChannelName(this.currentChannelName);
    }
    handleChannelChanged(newUrl) {
        this.currentUrl = newUrl;
        this.setAppletLabel('Playing', this.currentChannelName);
        this.setIconColor('Playing');
        this.mainMenu.setChannelName(this.currentChannelName);
    }
    handleChannelListChanged(channelList) {
        this.channelStore = new ChannelStore_1.ChannelStore(channelList);
        this.mainMenu.stationsList = this.activatedChannelNames;
        this.mpvPlayer.validUrls = this.activatedChannelUrls;
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
        this.setAppletTooltip('Playing', volume);
        this.mainMenu.volume = volume;
    }
    get initialVolume() {
        const initvolume = this.keepVolume ? this.lastVolume : this.customInitVolume;
        return initvolume;
    }
    updateMpvInitialVolume() {
        this.mpvPlayer.initialVolume = this.initialVolume;
    }
    on_applet_removed_from_panel() {
        this.mpvPlayer.stop();
    }
    async on_applet_clicked(event) {
        try {
            await utils_1.checkInstallMrisPlugin();
            await utils_1.checkInstallMpv();
            this.mainMenu.toggle();
        }
        catch (error) {
            utils_1.notifySend("couldn't start the applet. Make sure mpv is installed and the mpv mpris plugin saved in the configs folder.");
        }
    }
    handleMouseScroll(event) {
        const direction = event.get_scroll_direction();
        const volumeChange = (direction === ScrollDirection.UP) ? 5 : -5;
        this.mpvPlayer.increaseDecreaseVolume(volumeChange);
    }
    get currentChannelName() {
        return this.channelStore.getChannelName(this.currentUrl);
    }
    get activatedChannelNames() {
        return this.channelStore.activatedChannelNames;
    }
    get activatedChannelUrls() {
        return this.channelStore.activatedChannelUrls;
    }
    on_applet_middle_clicked(event) {
        this.mpvPlayer.togglePlayPause();
    }
}
exports.RadioApplet = RadioApplet;
