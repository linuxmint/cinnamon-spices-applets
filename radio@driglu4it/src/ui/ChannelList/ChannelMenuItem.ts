import * as consts from 'consts'
import { AdvancedPlaybackStatus, PlaybackStatus } from 'types';
import { createIconMenuItem } from 'ui/IconMenuItem';

interface Arguments {
    channelName: string,
}

export function createChannelMenuItem(args: Arguments) {

    const {
        channelName
    } = args

    const playbackIconMap: Map<AdvancedPlaybackStatus, string | null> = new Map([
        ["Playing", consts.PLAY_ICON_NAME],
        ["Paused", consts.PAUSE_ICON_NAME],
        ["Loading", consts.LOADING_ICON_NAME],
        ["Stopped", null]
    ])

    const iconMenuItem = createIconMenuItem({
        text: channelName,
        maxCharNumber: consts.MAX_STRING_LENGTH
    })

    function setPlaybackStatus(playbackStatus: AdvancedPlaybackStatus) {
        const iconName = playbackIconMap.get(playbackStatus)
        iconMenuItem.setIconName(iconName)

    }

    return {
        setPlaybackStatus,
        actor: iconMenuItem.actor
    }
}