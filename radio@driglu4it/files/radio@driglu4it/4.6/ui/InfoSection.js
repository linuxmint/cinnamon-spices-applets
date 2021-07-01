"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createInfoSection = void 0;
const consts = require("consts");
const IconMenuItem_1 = require("lib/IconMenuItem");
const { BoxLayout } = imports.gi.St;
function createInfoSection() {
    const channelInfoItem = createInfoItem(consts.RADIO_SYMBOLIC_ICON_NAME);
    const songInfoItem = createInfoItem(consts.SONG_INFO_ICON_NAME);
    const infoSection = new BoxLayout({
        vertical: true
    });
    [channelInfoItem, songInfoItem].forEach(infoItem => {
        infoSection.add_child(infoItem.actor);
    });
    function createInfoItem(iconName) {
        const iconMenuItem = IconMenuItem_1.createIconMenuItem({
            iconName,
            maxCharNumber: consts.MAX_STRING_LENGTH,
        });
        return iconMenuItem;
    }
    function setChannel(channeName) {
        channelInfoItem.setText(channeName);
    }
    function setSongTitle(songTitle) {
        songInfoItem.setText(songTitle);
    }
    return {
        actor: infoSection,
        setSongTitle,
        setChannel
    };
}
exports.createInfoSection = createInfoSection;
