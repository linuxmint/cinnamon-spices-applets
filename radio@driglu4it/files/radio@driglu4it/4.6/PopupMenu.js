"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PopupMenu = void 0;
const PlayPauseMenuItem_1 = require("./PlayPauseMenuItem");
const { AppletPopupMenu } = imports.ui.applet;
const { PopupMenuManager, PopupSeparatorMenuItem, PopupMenuItem, PopupSubMenuMenuItem } = imports.ui.popupMenu;
class PopupMenu extends AppletPopupMenu {
    constructor(launcher, orinentation, stations, onChannelClicked, onStopClick, initialChannel, initialPlaybackstatus) {
        super(launcher, orinentation);
        this.channelMap = new Map();
        this.onChannelCb = onChannelClicked;
        const myStationsSubMenuWrapper = new PopupSubMenuMenuItem("My Stations");
        this.myStationsSubMenu = myStationsSubMenuWrapper.menu;
        this.addMenuItem(myStationsSubMenuWrapper);
        this.addStationsToMenu(stations);
        this.initStopItem(onStopClick);
        if (initialPlaybackstatus === "Stopped") {
            this.stopItem.setShowDot(true);
        }
        else {
            const channelItem = this.channelMap.get(initialChannel);
            channelItem.changePlayPauseOffStatus(initialPlaybackstatus);
        }
    }
    initStopItem(onStopClick) {
        this.stopItem = new PopupMenuItem("Stop");
        this.addMenuItem(this.stopItem);
        this.stopItem.connect('activate', () => onStopClick());
    }
    addStationsToMenu(stations) {
        stations.forEach(name => {
            const channelItem = new PlayPauseMenuItem_1.PlayMausMenuItem(name);
            this.myStationsSubMenu.addMenuItem(channelItem);
            channelItem.connect('activate', () => this.onChannelCb(name));
            this.channelMap.set(name, channelItem);
        });
    }
    activateStopItem(deactivatedChannel) {
        this.stopItem.setShowDot(true);
        const deactivatedChannelItem = this.channelMap.get(deactivatedChannel);
        deactivatedChannelItem === null || deactivatedChannelItem === void 0 ? void 0 : deactivatedChannelItem.changePlayPauseOffStatus("Stopped");
    }
    changeChannelItem(activatedChannel, deactivatedChannel) {
        const activatedChannelItem = this.channelMap.get(activatedChannel);
        activatedChannelItem === null || activatedChannelItem === void 0 ? void 0 : activatedChannelItem.changePlayPauseOffStatus("Playing");
        const deactivatedChannelItem = this.channelMap.get(deactivatedChannel);
        deactivatedChannelItem === null || deactivatedChannelItem === void 0 ? void 0 : deactivatedChannelItem.changePlayPauseOffStatus("Stopped");
    }
    activateChannelItem(activatedChannel) {
        const activatedChannelItem = this.channelMap.get(activatedChannel);
        activatedChannelItem === null || activatedChannelItem === void 0 ? void 0 : activatedChannelItem.changePlayPauseOffStatus("Playing");
        this.stopItem.setShowDot(false);
    }
    pauseChannelItem(pausedChannel) {
        const pausedChannelItem = this.channelMap.get(pausedChannel);
        pausedChannelItem === null || pausedChannelItem === void 0 ? void 0 : pausedChannelItem.changePlayPauseOffStatus("Paused");
    }
    resumeChannelItem(resumedChannel) {
        const resumedChannelItem = this.channelMap.get(resumedChannel);
        resumedChannelItem === null || resumedChannelItem === void 0 ? void 0 : resumedChannelItem.changePlayPauseOffStatus("Playing");
    }
    open(animate) {
        super.open(animate);
        this.myStationsSubMenu.open(animate);
    }
    updateStationList(stationList, playbackStatus, channel) {
        this.myStationsSubMenu.removeAll;
        for (let channelItem of this.channelMap.values()) {
            channelItem.destroy();
        }
        this.channelMap.clear();
        this.addStationsToMenu(stationList);
        if (!stationList.includes(channel) || playbackStatus === "Stopped") {
            this.stopItem.setShowDot(true);
        }
        else {
            const channelItem = this.channelMap.get(channel);
            channelItem.changePlayPauseOffStatus(playbackStatus);
        }
    }
}
exports.PopupMenu = PopupMenu;
