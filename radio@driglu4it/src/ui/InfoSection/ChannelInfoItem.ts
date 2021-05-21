import * as consts from "consts";
import { createInfoItem } from "ui/InfoSection/InfoItem";

export function createChannelInfoItem() {

    const infoItem = createInfoItem({
        iconName: consts.RADIO_SYMBOLIC_ICON_NAME,
    })

    function setChannel(channel: string) {
        // TODO: handle channel is null
        infoItem.setText(channel)
    }

    return {
        actor: infoItem.actor,
        setChannel
    }
}