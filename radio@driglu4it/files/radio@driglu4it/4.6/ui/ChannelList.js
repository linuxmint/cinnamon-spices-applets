"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createChannelList = void 0;
const { PopupSubMenuMenuItem } = imports.ui.popupMenu;
const limitString_1 = require("functions/limitString");
const ChannelMenuItem_1 = require("ui/ChannelMenuItem");
function createChannelList(args) {
    const { stationNames, onChannelClicked } = args;
    const container = new PopupSubMenuMenuItem('My Stations');
    let state = { stationNames };
    function updateState(changes) {
        const newState = Object.assign(Object.assign({}, state), changes);
        const { playbackStatus, channelName } = newState;
        if (playbackStatus !== 'Stopped' && !channelName) {
            global.logError('It must be defined a station when playbackstatus is !== Stopped');
            return;
        }
        state = newState;
        setUpdateGui();
    }
    function setUpdateGui() {
        container.menu.removeAll();
        const { playbackStatus, channelName, stationNames } = state;
        stationNames.forEach(name => {
            const channelPlaybackstatus = (name === channelName) ? playbackStatus : 'Stopped';
            const channelItem = new ChannelMenuItem_1.ChannelMenuItem(limitString_1.limitString(name), channelPlaybackstatus);
            channelItem.connect('activate', () => onChannelClicked(name));
            container.menu.addMenuItem(channelItem);
        });
    }
    function open() {
        container.menu.open(true);
    }
    setUpdateGui();
    return Object.assign(container, { open, updateState });
}
exports.createChannelList = createChannelList;
