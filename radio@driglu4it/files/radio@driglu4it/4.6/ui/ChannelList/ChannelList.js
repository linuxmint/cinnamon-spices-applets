"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createChannelList = void 0;
const { PopupSubMenuMenuItem } = imports.ui.popupMenu;
const ChannelMenuItem_1 = require("ui/ChannelList/ChannelMenuItem");
function createChannelList(args) {
    const { stationNames, onChannelClicked } = args;
    const container = new PopupSubMenuMenuItem('My Stations');
    let currentChannel;
    let playbackStatus = 'Stopped';
    const channelItems = new Map();
    function open() {
        container.menu.open(true);
    }
    function setStationNames(stationNames) {
        channelItems.clear();
        container.menu.removeAll();
        stationNames.forEach(name => {
            const channelPlaybackstatus = (name === currentChannel) ? playbackStatus : 'Stopped';
            const channelItem = ChannelMenuItem_1.createChannelMenuItem({
                channelName: name
            });
            channelItem.setPlaybackStatus(channelPlaybackstatus);
            channelItems.set(name, channelItem);
            channelItem.actor.connect('activate', () => onChannelClicked(name));
            container.menu.addMenuItem(channelItem.actor);
        });
    }
    function setPlaybackstatus(plStatus) {
        playbackStatus = plStatus;
        if (!currentChannel)
            return;
        const channelMenuItem = channelItems.get(currentChannel);
        channelMenuItem.setPlaybackStatus(plStatus);
        if (plStatus === "Stopped") {
            currentChannel = null;
        }
    }
    function setCurrentChannel(name) {
        var _a, _b;
        (_a = channelItems.get(currentChannel)) === null || _a === void 0 ? void 0 : _a.setPlaybackStatus('Stopped');
        (_b = channelItems.get(name)) === null || _b === void 0 ? void 0 : _b.setPlaybackStatus(playbackStatus);
        currentChannel = name;
    }
    setStationNames(stationNames);
    return {
        actor: container,
        open,
        setStationNames,
        setPlaybackstatus,
        setCurrentChannel
    };
}
exports.createChannelList = createChannelList;
