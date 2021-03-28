"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RadioApplet = void 0;
const { TextIconApplet, AllowedLayout } = imports.ui.applet;
const { PopupMenuManager } = imports.ui.popupMenu;
const { Clipboard, ClipboardType } = imports.gi.St;
const MpvPlayerHandler_1 = require("./MpvPlayerHandler");
const PopupMenu_1 = require("./PopupMenu");
const ChannelStore_1 = require("./ChannelStore");
const utils_1 = require("./utils");
const { ScrollDirection } = imports.gi.Clutter;
const { AppletSettings } = imports.ui.settings;
class RadioApplet extends TextIconApplet {
    constructor(orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId);
        this.orientation = orientation;
        this.setAllowedLayout(AllowedLayout.BOTH);
        this.settings = new AppletSettings(this, __meta.uuid, instanceId);
    }
    async init(orientation) {
        this.initSettings();
        this.createContextMenu();
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
        this.setIcon();
        this.setIconColor();
        this.setAppletLabel();
        this.setAppletTooltip();
        this.createMenu(this.playbackStatus);
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
            onVolumeSliderChanged: (volume) => this.volume = volume,
            initialChannel: this.currentChannelName,
            initialPlaybackstatus: playbackStatus,
            volume: this.volume
        });
        this.menuManager.addMenu(this.mainMenu);
    }
    createContextMenu() {
        this._applet_context_menu.addAction("Copy current song title", () => this.handleCopySong());
        this._applet_context_menu.addAction("Download from Youtube", () => utils_1.downloadSongFromYoutube(this.mpvPlayer.currentSong, this.music_dir));
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
    setIconColor() {
        const color = this.playbackStatus === "Playing" ? this.symbolicIconColorWhenPlaying : true;
        this.actor.style = `color: ${color}`;
    }
    setAppletLabel() {
        const label = (this.channelNameOnPanel && this.playbackStatus === "Playing")
            ? ' ' + this.currentChannelName : '';
        this.set_applet_label(label);
    }
    setAppletTooltip() {
        const tooltipTxt = this.playbackStatus === "Stopped" ? "Radio++" : `Volume: ${this.volume.toString()}%`;
        this.set_applet_tooltip(tooltipTxt);
    }
    handleRadioStopped() {
        this.currentUrl = null;
        this.setAppletLabel();
        this.setIconColor();
        this.setAppletTooltip();
        this.mainMenu.playbackStatus = "Stopped";
        this.lastVolume = this.mpvPlayer.volume;
        this.updateMpvInitialVolume();
    }
    handleRadioPaused() {
        this.setAppletLabel();
        this.setIconColor();
        this.mainMenu.playbackStatus = 'Paused';
    }
    handleRadioResumed() {
        this.setAppletLabel();
        this.setIconColor();
        this.mainMenu.playbackStatus = 'Playing';
    }
    handleRadioStarted(channelUrl) {
        this.currentUrl = channelUrl;
        this.setAppletLabel();
        this.setIconColor();
        this.setAppletTooltip();
        this.mainMenu.setChannel(this.currentChannelName);
    }
    handleChannelChanged(newUrl) {
        this.currentUrl = newUrl;
        this.setAppletLabel();
        this.setIconColor();
        this.mainMenu.setChannel(this.currentChannelName);
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
        this.setAppletTooltip();
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
        this.volume += volumeChange;
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
    get playbackStatus() {
        return this.mpvPlayer.playbackStatus;
    }
    get volume() {
        var _a, _b;
        return (_b = (_a = this.mpvPlayer) === null || _a === void 0 ? void 0 : _a.volume) !== null && _b !== void 0 ? _b : this.initialVolume;
    }
    set volume(newVolume) {
        this.mpvPlayer.volume = newVolume;
    }
    on_applet_middle_clicked(event) {
        this.mpvPlayer.togglePlayPause();
    }
}
exports.RadioApplet = RadioApplet;
