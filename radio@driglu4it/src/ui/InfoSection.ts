import { RADIO_SYMBOLIC_ICON_NAME, MAX_STRING_LENGTH, SONG_INFO_ICON_NAME } from "../consts";
import { createSimpleMenuItem } from "../lib/SimpleMenuItem";
import { mpvHandler } from "../services/mpv/MpvHandler";
const { BoxLayout } = imports.gi.St


export function createInfoSection() {

    const {
        addChannelChangeHandler,
        addTitleChangeHandler,
        getCurrentChannelName,
        getCurrentTitle
    } = mpvHandler

    const channelInfoItem = createSimpleMenuItem({
        iconName: RADIO_SYMBOLIC_ICON_NAME,
        text: getCurrentChannelName(),
        maxCharNumber: MAX_STRING_LENGTH
    })

    const songInfoItem = createSimpleMenuItem({
        iconName: SONG_INFO_ICON_NAME,
        text: getCurrentTitle(),
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