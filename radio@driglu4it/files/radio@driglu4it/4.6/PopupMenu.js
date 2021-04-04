"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PopupMenu = void 0;
const PlayPauseMenuItem_1 = require("./PlayPauseMenuItem");
const VolumeSlider_1 = require("./VolumeSlider");
const { AppletPopupMenu } = imports.ui.applet;
const { PopupMenuItem, PopupSubMenuMenuItem } = imports.ui.popupMenu;
;
class PopupMenu extends AppletPopupMenu {
    constructor({ launcher, orientation, stations, onChannelClicked, onStopClicked, initialChannel, initialPlaybackstatus, volume, onVolumeSliderChanged }) {
        super(launcher, orientation);
        this.channelMap = new Map();
        this.onChannelClicked = onChannelClicked;
        this.onVolumeSliderChanged = onVolumeSliderChanged;
        this._volume = volume;
        this.onStopClicked = onStopClicked;
        const myStationsSubMenuWrapper = new PopupSubMenuMenuItem("My Stations");
        this.myStationsSubMenu = myStationsSubMenuWrapper.menu;
        this.addMenuItem(myStationsSubMenuWrapper);
        this.addStationsToMenu(stations);
        initialChannel && this.setChannel(initialChannel, initialPlaybackstatus);
    }
    initVolumeSlider() {
        this.volumeSlider = new VolumeSlider_1.VolumeSlider(this._volume, (volume) => this.handleSliderChanged(volume, this.onVolumeSliderChanged));
        this.addMenuItem(this.volumeSlider);
    }
    handleSliderChanged(volume, cb) {
        this._volume = volume;
        cb(volume);
    }
    set volume(newVolume) {
        var _a;
        if (this._volume === newVolume)
            return;
        (_a = this.volumeSlider) === null || _a === void 0 ? void 0 : _a.setValue(newVolume);
        this._volume = newVolume;
    }
    initStopItem() {
        this.stopItem = new PopupMenuItem("Stop");
        this.addMenuItem(this.stopItem);
        this.stopItem.connect('activate', () => this.onStopClicked());
    }
    addStationsToMenu(stations) {
        stations.forEach(name => {
            const channelItem = new PlayPauseMenuItem_1.PlayMausMenuItem(name);
            this.myStationsSubMenu.addMenuItem(channelItem);
            channelItem.connect('activate', () => this.onChannelClicked(name));
            this.channelMap.set(name, channelItem);
        });
    }
    set stationsList(stations) {
        var _a, _b;
        const currentChannelName = stations.find(station => { var _a; return station === ((_a = this.currentChannelMenuItem) === null || _a === void 0 ? void 0 : _a.label.text); });
        const playbackStatus = (_b = (_a = this.currentChannelMenuItem) === null || _a === void 0 ? void 0 : _a.playbackStatus) !== null && _b !== void 0 ? _b : 'Stopped';
        this.channelMap.forEach(channelItem => channelItem.destroy());
        this.channelMap.clear();
        this.addStationsToMenu(stations);
        currentChannelName ? this.setChannel(currentChannelName, playbackStatus) : this.playbackStatus = "Stopped";
    }
    open(animate) {
        super.open(animate);
        this.myStationsSubMenu.open(animate);
    }
    setChannel(name, playbackStatus = "Playing") {
        if (this.currentChannelMenuItem)
            this.currentChannelMenuItem.playbackStatus = "Stopped";
        this.currentChannelMenuItem = this.channelMap.get(name);
        this.playbackStatus = playbackStatus;
    }
    set playbackStatus(playbackStatus) {
        var _a, _b;
        if (!this.currentChannelMenuItem && playbackStatus !== "Stopped") {
            global.logError(`can't change playbackStatus to ${playbackStatus} as no channel is defined`);
        }
        if (this.currentChannelMenuItem)
            this.currentChannelMenuItem.playbackStatus = playbackStatus;
        if (playbackStatus === 'Stopped') {
            this.currentChannelMenuItem = null;
            (_a = this.volumeSlider) === null || _a === void 0 ? void 0 : _a.destroy();
            this.volumeSlider = null;
            (_b = this.stopItem) === null || _b === void 0 ? void 0 : _b.destroy();
            this.stopItem = null;
            return;
        }
        !this.volumeSlider && this.initVolumeSlider();
        !this.stopItem && this.initStopItem();
    }
}
exports.PopupMenu = PopupMenu;
