"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PopupMenu = void 0;
const PlayPauseMenuItem_1 = require("./PlayPauseMenuItem");
const VolumeSlider_1 = require("./VolumeSlider");
const { AppletPopupMenu } = imports.ui.applet;
const { PopupMenuItem, PopupSubMenuMenuItem } = imports.ui.popupMenu;
;
class PopupMenu extends AppletPopupMenu {
    constructor({ launcher, orientation, stations, onChannelClicked, onStopClicked, initialChannel, initialPlaybackstatus, onVolumeSliderChanged }) {
        super(launcher, orientation);
        this.channelMap = new Map();
        this.onChannelClicked = onChannelClicked;
        const myStationsSubMenuWrapper = new PopupSubMenuMenuItem("My Stations");
        this.myStationsSubMenu = myStationsSubMenuWrapper.menu;
        this.addMenuItem(myStationsSubMenuWrapper);
        this.volumeSlider = new VolumeSlider_1.VolumeSlider(50, onVolumeSliderChanged);
        this.addMenuItem(this.volumeSlider);
        this.addStationsToMenu(stations);
        this.initStopItem(onStopClicked, initialPlaybackstatus === "Stopped");
        initialChannel && this.setChannelName(initialChannel, initialPlaybackstatus);
    }
    set volume(newVolume) {
        this.volumeSlider.setValue(newVolume);
    }
    initStopItem(onClick, stopped) {
        this.stopItem = new PopupMenuItem("Stop");
        this.addMenuItem(this.stopItem);
        this.stopItem.connect('activate', () => onClick());
        if (stopped)
            this.playbackStatus = "Stopped";
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
        currentChannelName ? this.setChannelName(currentChannelName, playbackStatus) : this.playbackStatus = "Stopped";
    }
    open(animate) {
        super.open(animate);
        this.myStationsSubMenu.open(animate);
    }
    setChannelName(name, playbackStatus = "Playing") {
        if (this.currentChannelMenuItem)
            this.currentChannelMenuItem.playbackStatus = "Stopped";
        this.currentChannelMenuItem = this.channelMap.get(name);
        this.currentChannelMenuItem.playbackStatus = playbackStatus;
        this.stopItem.setShowDot(false);
    }
    set playbackStatus(playbackStatus) {
        if (!this.currentChannelMenuItem && playbackStatus !== "Stopped") {
            global.logError(`can't change playbackStatus to ${playbackStatus} as no channel is defined`);
        }
        if (this.currentChannelMenuItem)
            this.currentChannelMenuItem.playbackStatus = playbackStatus;
        this.stopItem.setShowDot(playbackStatus === 'Stopped');
        if (playbackStatus === 'Stopped')
            this.currentChannelMenuItem = null;
    }
}
exports.PopupMenu = PopupMenu;
