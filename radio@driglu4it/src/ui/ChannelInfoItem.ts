import { limitString } from "functions/limitString";
import { IconMenuItem } from "ui/IconMenuItem";

export interface ChannelInfoItem extends IconMenuItem {
    channel: string
}

export function createChannelInfoItem() {
    const channelInfoItem = new IconMenuItem("", "radioapplet", { hover: false })

    function setChannel(channel: string) {
        channelInfoItem.text = limitString(channel)
    }

    Object.defineProperties(channelInfoItem, {
        channel: {
            set(channel: string) {
                setChannel(channel)
            }
        }
    })

    return channelInfoItem
}