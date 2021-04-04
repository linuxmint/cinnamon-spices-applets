"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RadioApplet = void 0;
const { TextIconApplet, AllowedLayout, AppletPopupMenu } = imports.ui.applet;
const { PopupMenuManager, PopupSeparatorMenuItem, PopupMenuItem, PopupSubMenuMenuItem } = imports.ui.popupMenu;
const mpvPlayerHandler_1 = require("./mpvPlayerHandler");
const playPauseMenuItem_1 = require("./playPauseMenuItem");
const { get_home_dir } = imports.gi.GLib;
const { AppletSettings } = imports.ui.settings;
class RadioApplet extends TextIconApplet {
    constructor(metadata, orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId);
        this.uuid = metadata.uuid;
        this.setAllowedLayout(AllowedLayout.BOTH);
        this.settings = new AppletSettings(this, this.uuid, instanceId);
    }
    async init(orientation) {
        this.initSettings();
        await this.initMpvPlayer();
        this.initGui(orientation);
    }
    initSettings() {
        this.settings.bind("icon-type", "iconType", this.setIcon);
        this.settings.bind("color-on", "symbolicIconColorWhenPlaying", this.setIconColor);
        this.settings.bind("channel-on-panel", "channelNameOnPanel", this.setAppletLabel);
        this.settings.bind("keep-volume-between-sessions", "keepVolume");
        this.settings.bind("last-volume", "lastVolume");
        this.settings.bind("tree", "channelList");
    }
    async initMpvPlayer() {
        const configPath = `${get_home_dir()}/.cinnamon/configs/${this.uuid}`;
        const mprisPluginPath = configPath + '/.mpris.so';
        this.mpvPlayer = new mpvPlayerHandler_1.MpvPlayerHandler({
            mprisPluginPath,
            onRadioStopped: () => this.handleRadioStopped(),
            onVolumeChanged: (volume) => this.handleVolumeChanged(volume),
            getInitialVolume: () => this.getInitialVolume(),
            onChannelStarted: (url) => this.handleRadioStarted(url)
        });
        await this.mpvPlayer.init();
    }
    initGui(orientation) {
        this.setIcon();
        this.setIconColor();
        this.setAppletLabel();
        this.createMenu(orientation);
        const playbackStatus = this.mpvPlayer.getPlaybackStatus();
        const currentUrl = playbackStatus === "Stop" ? null : this.mpvPlayer.getRunningRadioUrl();
        this.addIconToCurrentMenuItem(playbackStatus, currentUrl);
    }
    createMenu(orientation) {
        if (!this.menu) {
            const menuManager = new PopupMenuManager(this);
            this.menu = new AppletPopupMenu(this, orientation);
            menuManager.addMenu(this.menu);
        }
        const myStationsSubMenuWrapper = this.createMyStationsSubMenu();
        this.stopItem = new PopupMenuItem("Stop");
        [myStationsSubMenuWrapper, this.stopItem].forEach(item => this.menu.addMenuItem(item));
    }
    createMyStationsSubMenu() {
        const myStationsSubMenuWrapper = new PopupSubMenuMenuItem("My stations");
        this.myStationsSubMenu = myStationsSubMenuWrapper.menu;
        this.channelList.forEach(channel => {
            if (!channel.inc)
                return;
            const channelItem = new playPauseMenuItem_1.PlayMausMenuItem(channel.name);
            channelItem.connect('activate', () => this.handleChannelClicked(channel));
            this.myStationsSubMenu.addMenuItem(channelItem);
        });
        return myStationsSubMenuWrapper;
    }
    setIcon() {
        if (this.iconType === "SYMBOLIC")
            this.set_applet_icon_symbolic_name('radioapplet');
        else
            this.set_applet_icon_name(`radioapplet-${this.iconType.toLowerCase()}`);
    }
    setIconColor(playbackStatus) {
        if (playbackStatus === "Playing") {
            this.actor.style = `color: ${this.symbolicIconColorWhenPlaying}`;
        }
    }
    setAppletLabel() {
        if (!this.channelNameOnPanel || this.mpvPlayer.getPlaybackStatus() === "Stopped")
            return;
        const currentChannelUrl = this.mpvPlayer.getRunningRadioUrl();
        const currentChannelName = this.getChannelName(currentChannelUrl);
        this.set_applet_label(' ' + currentChannelName);
    }
    getInitialVolume() {
        return this.keepVolume ? this.lastVolume : this.customInitVolume;
    }
    on_applet_removed_from_panel(deleteConfig) {
    }
    handleChannelClicked(channel) {
        this.mpvPlayer.startChangeRadioChannel(channel.url);
    }
    on_applet_clicked(event) {
        this.menu.toggle();
        this.myStationsSubMenu.open(true);
    }
    on_applet_middle_clicked(event) {
    }
    handleRadioStopped() {
    }
    handleRadioStarted(channelUrl) {
        const menuItem = this.getChannelMenuItem(channelUrl);
        menuItem.changePlayPauseOffStatus("Playing");
    }
    handleVolumeChanged(volume) {
        const tooltipTxt = `Volume: ${volume.toString()}%`;
        this.set_applet_tooltip(tooltipTxt);
    }
    addIconToCurrentMenuItem(playbackStatus, channelUrl) {
        if (playbackStatus === "Stopped") {
            this.stopItem.setShowDot(true);
        }
        else {
            const channelItem = this.getChannelMenuItem(channelUrl);
            const playbackStatus = this.mpvPlayer.getPlaybackStatus();
            channelItem.changePlayPauseOffStatus(playbackStatus);
        }
    }
    getChannelName(channelUrl) {
        let channel = this.channelList.find(cnl => cnl.url === channelUrl);
        return (!channel || channel.inc === false) ? "" : channel.name;
    }
    getChannelMenuItem(channelUrl) {
        const channelName = this.getChannelName(channelUrl);
        const menuItems = this.myStationsSubMenu._getMenuItems();
        const channelMenuItem = menuItems.find((menuItem) => {
            global.log(`label text: ${menuItem.label.text}`);
            return (menuItem.label.text === channelName);
        });
        return channelMenuItem;
    }
}
exports.RadioApplet = RadioApplet;
