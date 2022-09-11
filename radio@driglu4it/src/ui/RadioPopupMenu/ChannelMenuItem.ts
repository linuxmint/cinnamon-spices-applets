import * as consts from '../../consts'
import { createRotateAnimation } from '../../functions/tweens';
import { createSimpleMenuItem, SimpleMenuItem } from '../../lib/SimpleMenuItem';
import { AdvancedPlaybackStatus } from '../../types';
const { BoxLayout } = imports.gi.St

export interface ChannelMenuItemProps {
    channelName: string,
    onActivated: () => void,
    initialPlaybackStatus: AdvancedPlaybackStatus
    onRemoveClick: () => void
}

const playbackIconMap: Map<AdvancedPlaybackStatus, string | null> = new Map([
    ["Playing", consts.PLAY_ICON_NAME],
    ["Paused", consts.PAUSE_ICON_NAME],
    ["Loading", consts.LOADING_ICON_NAME],
    ["Stopped", null]
])

const createMainMenuItem = (props: { channelName: string, onActivated: () => void, onRightClick: () => void, initialPlaybackStatus: AdvancedPlaybackStatus }) => {
    const { channelName, onActivated, onRightClick, initialPlaybackStatus } = props

    const mainMenuItem = createSimpleMenuItem({
        maxCharNumber: consts.MAX_STRING_LENGTH,
        text: channelName,
        onActivated,
        onRightClick
    })

    const { startResumeRotation, stopRotation } = createRotateAnimation(mainMenuItem.getIcon())

    const setPlaybackStatus = (playbackStatus: AdvancedPlaybackStatus) => {
        const iconName = playbackIconMap.get(playbackStatus)
        playbackStatus === 'Loading' ? startResumeRotation() : stopRotation()
        mainMenuItem.setIconName(iconName)
    }

    initialPlaybackStatus && setPlaybackStatus(initialPlaybackStatus)

    return {
        actor: mainMenuItem.actor,
        setPlaybackStatus
    }

}

export const createChannelMenuItem = (props: ChannelMenuItemProps) => {

    const {
        channelName,
        onActivated,
        initialPlaybackStatus,
        onRemoveClick,
    } = props

    const removeChannelItem = createSimpleMenuItem({
        text: 'Remove Channel',
        onActivated: onRemoveClick,
        iconName: 'edit-delete',
    })

    const contextMenuContainer = new BoxLayout({ vertical: true, style: `padding-left:20px;` })
    contextMenuContainer.add_child(removeChannelItem.actor)

    const menuItemContainer = new BoxLayout({ vertical: true })


    const handleMainMenuItemRightClicked = () => {
        if (menuItemContainer.get_child_at_index(1) === contextMenuContainer) {
            menuItemContainer.remove_child(contextMenuContainer)
            return
        }
        menuItemContainer.add_child(contextMenuContainer)
    }

    const mainMenuItem = createMainMenuItem({
        channelName,
        onActivated: () => onActivated(),
        onRightClick: handleMainMenuItemRightClicked,
        initialPlaybackStatus
    })

    menuItemContainer.add_child(mainMenuItem.actor)


    return {
        setPlaybackStatus: mainMenuItem.setPlaybackStatus,
        actor: menuItemContainer,
        getChannelName: () => channelName
    }
}