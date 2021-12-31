import * as consts from '../../consts'
import { createRotateAnimation } from '../../functions/tweens';
import { createIconMenuItem } from '../../lib/IconMenuItem';
import { AdvancedPlaybackStatus } from '../../types';


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
        initialText: channelName,
        onActivated: () => {
            onActivated(channelName)
        }
    })

    const { startResumeRotation, stopRotation } = createRotateAnimation(iconMenuItem.getIcon())
    
    function setPlaybackStatus(playbackStatus: AdvancedPlaybackStatus) {
        const iconName = playbackIconMap.get(playbackStatus)
        playbackStatus === 'Loading' ? startResumeRotation() : stopRotation()

        iconMenuItem.setIconName(iconName)
    }

    playbackStatus && setPlaybackStatus(playbackStatus)

    return {
        setPlaybackStatus,
        actor: iconMenuItem.actor,
        getChannelName: () => channelName
    }
}