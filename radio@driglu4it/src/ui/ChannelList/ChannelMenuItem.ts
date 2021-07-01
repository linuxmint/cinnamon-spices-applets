import * as consts from 'consts'
import { createIconMenuItem } from 'lib/IconMenuItem';
import { AdvancedPlaybackStatus } from 'types';

export interface Arguments {
    channelName: string,
    onActivated: (channelName: string) => void,
    playbackStatus?: AdvancedPlaybackStatus
}

export function createChannelMenuItem(args: Arguments) {

    const {
        channelName,
        onActivated,
        playbackStatus
    } = args

    const playbackIconMap: Map<AdvancedPlaybackStatus, string | null> = new Map([
        ["Playing", consts.PLAY_ICON_NAME],
        ["Paused", consts.PAUSE_ICON_NAME],
        ["Loading", consts.LOADING_ICON_NAME],
        ["Stopped", null]
    ])

    const iconMenuItem = createIconMenuItem({
        maxCharNumber: consts.MAX_STRING_LENGTH,
        text: channelName,
        onActivated: () => onActivated(channelName)
    })

    function setPlaybackStatus(playbackStatus: AdvancedPlaybackStatus) {
        const iconName = playbackIconMap.get(playbackStatus)
        iconMenuItem.setIconName(iconName)
    }

    playbackStatus && setPlaybackStatus(playbackStatus)

    return {
        setPlaybackStatus,
        actor: iconMenuItem.actor
    }
}