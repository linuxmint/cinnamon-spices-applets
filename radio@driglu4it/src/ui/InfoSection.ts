import { RADIO_SYMBOLIC_ICON_NAME, MAX_STRING_LENGTH, SONG_INFO_ICON_NAME } from "../consts";
import { createIconMenuItem } from "../lib/IconMenuItem";
import { mpvHandler } from "../services/mpv/MpvHandler";
const { BoxLayout } = imports.gi.St


export function createInfoSection() {

    const {
        addChannelChangeHandler,
        addTitleChangeHandler,
        getCurrentChannelName,
        getCurrentTitle
    } = mpvHandler

    const channelInfoItem = createIconMenuItem({
        iconName: RADIO_SYMBOLIC_ICON_NAME,
        initialText: getCurrentChannelName(),
        maxCharNumber: MAX_STRING_LENGTH
    })

    const songInfoItem = createIconMenuItem({
        iconName: SONG_INFO_ICON_NAME,
        initialText: getCurrentTitle(),
        maxCharNumber: MAX_STRING_LENGTH
    })

    const infoSection = new BoxLayout({
        vertical: true
    });

    [channelInfoItem, songInfoItem].forEach(infoItem => {
        infoSection.add_child(infoItem.actor)
    })

    addChannelChangeHandler((newChannel) => {
        channelInfoItem.setText(newChannel)
    })

    addTitleChangeHandler((newTitle) => {
        songInfoItem.setText(newTitle)
    })

    return infoSection

}