import { limitString } from "functions/limitString";
import { IconMenuItem } from "ui/IconMenuItem";

export interface SongInfoItem extends IconMenuItem {
    title: string
}

export function createSongInfoItem() {
    const songInfoItem = new IconMenuItem("", "audio-x-generic", { hover: false })

    function setTitle(title: string) {
        songInfoItem.text = limitString(title)
    }

    Object.defineProperties(songInfoItem, {
        title: {
            set(title: string) {
                setTitle(title)
            }
        }
    })

    return songInfoItem
}