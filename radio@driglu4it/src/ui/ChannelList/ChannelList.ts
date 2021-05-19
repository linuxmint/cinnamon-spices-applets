const { PopupSubMenuMenuItem } = imports.ui.popupMenu;

import { AdvancedPlaybackStatus, PlaybackStatus } from "types";
import { createChannelMenuItem } from "ui/ChannelList/ChannelMenuItem";

interface Arguments {
    stationNames: string[],
    onChannelClicked: (name: string) => void
}

export function createChannelList(args: Arguments) {
    const {
        stationNames,
        onChannelClicked
    } = args

    const container = new PopupSubMenuMenuItem('My Stations')

    let currentChannel: string
    let playbackStatus: AdvancedPlaybackStatus = 'Stopped'

    // the channelItems are saved here to the map and to the container as on the container only the reduced name are shown. Theoretically it therefore couldn't be differentiated between two long channel names with the same first 30 (or so) characters   
    const channelItems = new Map<string, ReturnType<typeof createChannelMenuItem>>()

    function open() {
        container.menu.open(true)
    }

    function setStationNames(stationNames: string[]) {
        channelItems.clear()
        container.menu.removeAll()

        stationNames.forEach(name => {
            const channelPlaybackstatus =
                (name === currentChannel) ? playbackStatus : 'Stopped'

            const channelItem = createChannelMenuItem({
                channelName: name
            })

            channelItem.setPlaybackStatus(channelPlaybackstatus)
            channelItems.set(name, channelItem)
            channelItem.actor.connect('activate', () => onChannelClicked(name))
            container.menu.addMenuItem(channelItem.actor)
        })
    }


    function setPlaybackstatus(plStatus: AdvancedPlaybackStatus) {

        playbackStatus = plStatus

        if (!currentChannel) return

        const channelMenuItem = channelItems.get(currentChannel)
        channelMenuItem.setPlaybackStatus(plStatus)

        if (plStatus === "Stopped") {
            currentChannel = null
        }
    }

    function setCurrentChannel(name: string) {

        channelItems.get(currentChannel)?.setPlaybackStatus('Stopped')
        channelItems.get(name)?.setPlaybackStatus(playbackStatus)

        currentChannel = name
    }

    setStationNames(stationNames)

    return {
        actor: container,
        open,
        setStationNames,
        setPlaybackstatus,
        setCurrentChannel
    }

}