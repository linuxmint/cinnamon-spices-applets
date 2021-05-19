import * as consts from "consts";
import { createIconMenuItem } from "ui/IconMenuItem";

interface Arguments {
    iconName: string
}

export function createInfoItem(args: Arguments) {

    const {
        iconName
    } = args

    const iconMenuItem = createIconMenuItem({
        text: ' ',
        maxCharNumber: consts.MAX_STRING_LENGTH,
        params: { hover: false },
        iconName
    })

    return {
        actor: iconMenuItem.actor,
        setText: iconMenuItem.setText
    }
}