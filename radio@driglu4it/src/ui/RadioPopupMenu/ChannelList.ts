import { createSubMenu } from "../../lib/PopupSubMenu";
import { ChannelMenuItem, createChannelMenuItem } from "./ChannelMenuItem";
import { AdvancedPlaybackStatus } from "../../types";
import { mpvHandler } from "../../services/mpv/MpvHandler";
import { configs } from "../../services/Config";
import { radioPopupMenu } from "./RadioPopupMenu";

const { BoxLayout } = imports.gi.St

export function createChannelList() {

    const {
        getPlaybackStatus,
        getCurrentChannelName: getCurrentChannel,
        addChannelChangeHandler,
        addPlaybackStatusChangeHandler,
        setUrl
    } = mpvHandler || {}

    const {
        addStationsListChangeHandler,
        settingsObject
    } = configs

    const subMenu = createSubMenu({ text: 'My Stations' })

    const getUserStationNames = () => {
        return settingsObject.userStations.flatMap(station => station.inc ? [station.name] : [])
    }

    const findUrl = (channelName: string) => {
        const channel = settingsObject.userStations.find(station => station.name === channelName && station.inc)

        if (!channel) throw new Error(`couldn't find a url for the provided name. That should not have happened :-/`)

        return channel.url
    }

    const handleChannelRemoveClicked = (channelName: string) => {
        const previousStations = configs.settingsObject.userStations

        configs.settingsObject.userStations = previousStations.filter((cnl) => cnl.name !== channelName)
    }


    // the channelItems are saved here to the map as well as to the container as on the container only the reduced name are shown. Theoretically it therefore couldn't be differentiated between two long channel names with the same first 30 (or so) characters   
    let channelItems: ChannelMenuItem[] = []

    const closeAllChannelContextMenus = (props?: { exceptionChannelName?: string }) => {
        const { exceptionChannelName } = props || {}

        channelItems.forEach((channelItem) => {
            if (channelItem.getChannelName() !== exceptionChannelName) {
                channelItem.closeContextMenu()
            }
        })
    }


    const setRefreshList = (names: string[]) => {
        channelItems = []
        subMenu.box.destroy_all_children()

        names.forEach((name, index) => {
            const channelPlaybackstatus =
                (name === getCurrentChannel()) ? getPlaybackStatus() : 'Stopped'

            // TODO: addd this to createChannelMenuItem
            const channelItemContainer = new BoxLayout({ vertical: true })


            const channelItem = createChannelMenuItem({
                channelName: name,
                onActivated: () => {
                    closeAllChannelContextMenus()
                    setUrl(findUrl(name))
                },
                initialPlaybackStatus: channelPlaybackstatus,
                onRemoveClick: () => handleChannelRemoveClicked(name),
                onContextMenuOpened: () => closeAllChannelContextMenus({ exceptionChannelName: name })
            })

            channelItemContainer.add_child(channelItem.actor)

            channelItems.push(channelItem)
            subMenu.box.add_child(channelItemContainer)
        })
    }

    function updateChannel(name: string | undefined) {
        channelItems.forEach(item => {
            item.getChannelName() === name ? item.setPlaybackStatus(getPlaybackStatus()) : item.setPlaybackStatus('Stopped')
        })
    }

    function updatePlaybackStatus(playbackStatus: AdvancedPlaybackStatus) {

        if (playbackStatus === 'Stopped') channelItems.forEach(item => item.setPlaybackStatus('Stopped'))

        const currentChannel = channelItems.find(channelItem => channelItem.getChannelName() === getCurrentChannel())
        currentChannel?.setPlaybackStatus(playbackStatus)
    }

    setRefreshList(getUserStationNames())

    addChannelChangeHandler?.((newChannel) => updateChannel(newChannel))
    addPlaybackStatusChangeHandler((newStatus) => updatePlaybackStatus(newStatus))
    addStationsListChangeHandler(() => setRefreshList(getUserStationNames()))

    radioPopupMenu.addPopupMenuCloseHandler(() => closeAllChannelContextMenus())

    return subMenu.actor
}