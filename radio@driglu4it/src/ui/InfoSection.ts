import * as consts from "consts";
import { createIconMenuItem } from "lib/IconMenuItem";
const { BoxLayout } = imports.gi.St

export function createInfoSection() {

    const channelInfoItem = createInfoItem(consts.RADIO_SYMBOLIC_ICON_NAME)
    const songInfoItem = createInfoItem(consts.SONG_INFO_ICON_NAME)

    const infoSection = new BoxLayout({
        vertical: true
    });

    [channelInfoItem, songInfoItem].forEach(infoItem => {
        infoSection.add_child(infoItem.actor)
    })

    function createInfoItem(iconName: string) {
        const iconMenuItem = createIconMenuItem({
            iconName,
            maxCharNumber: consts.MAX_STRING_LENGTH,
        })

        return iconMenuItem
    }

    function setChannel(channeName: string) {
        channelInfoItem.setText(channeName)
    }

    function setSongTitle(songTitle: string) {
        songInfoItem.setText(songTitle)
    }

    return {
        actor: infoSection,
        setSongTitle,
        setChannel
    }

}