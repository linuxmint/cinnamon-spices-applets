import { SONG_INFO_ICON_NAME } from 'consts';
import { createInfoItem } from 'ui/InfoSection/InfoItem';

export function createSongInfoItem() {

    const infoItem = createInfoItem({
        iconName: SONG_INFO_ICON_NAME,
    })

    function setSongTitle(title: string) {
        infoItem.setText(title)
    }

    return {
        actor: infoItem.actor,
        setSongTitle
    }

}