"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createChannelList = void 0;
const PopupSubMenu_1 = require("lib/PopupSubMenu");
const ChannelMenuItem_1 = require("ui/ChannelList/ChannelMenuItem");
function createChannelList(args) {
    const { stationNames, onChannelClicked } = args;
    const subMenu = PopupSubMenu_1.createSubMenu({ text: 'My Stations' });
    let currentChannelName;
    let playbackStatus = 'Stopped';
    const channelItems = new Map();
    function setStationNames(names) {
        channelItems.clear();
        subMenu.box.remove_all_children();
        names.forEach(name => {
            const channelPlaybackstatus = (name === currentChannelName) ? playbackStatus : 'Stopped';
            const channelItem = ChannelMenuItem_1.createChannelMenuItem({
                channelName: name,
                onActivated: onChannelClicked,
                playbackStatus: channelPlaybackstatus
            });
            channelItems.set(name, channelItem);
            subMenu.box.add_child(channelItem.actor);
        });
    }
    function setPlaybackStatus(newStatus) {
        playbackStatus = newStatus;
        if (!currentChannelName)
            return;
        const channelMenuItem = channelItems.get(currentChannelName);
        channelMenuItem === null || channelMenuItem === void 0 ? void 0 : channelMenuItem.setPlaybackStatus(playbackStatus);
        if (playbackStatus === 'Stopped')
            currentChannelName = null;
    }
    function setCurrentChannel(name) {
        const currentChannelItem = channelItems.get(currentChannelName);
        currentChannelItem === null || currentChannelItem === void 0 ? void 0 : currentChannelItem.setPlaybackStatus('Stopped');
        if (name) {
            const newChannelItem = channelItems.get(name);
            if (!newChannelItem)
                throw new Error(`No channelItem exist for ${name}`);
            newChannelItem.setPlaybackStatus(playbackStatus);
        }
        currentChannelName = name;
    }
    setStationNames(stationNames);
    return {
        actor: subMenu.actor,
        setPlaybackStatus,
        setStationNames,
        setCurrentChannel
    };
}
exports.createChannelList = createChannelList;
