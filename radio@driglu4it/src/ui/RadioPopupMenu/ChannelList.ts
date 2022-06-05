import { createSubMenu } from "../../lib/PopupSubMenu";
import { createChannelMenuItem } from "./ChannelMenuItem";
import { AdvancedPlaybackStatus } from "../../types";
import { mpvHandler } from "../../services/mpv/MpvHandler";
import { configs } from "../../services/Config";


export function createChannelList() {

    const {
        getPlaybackStatus,
        getCurrentChannelName: getCurrentChannel,
        addChannelChangeHandler,
        addPlaybackStatusChangeHandler,
        setUrl
    } = mpvHandler

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

    // the channelItems are saved here to the map as well as to the container as on the container only the reduced name are shown. Theoretically it therefore couldn't be differentiated between two long channel names with the same first 30 (or so) characters   
    let channelItems: ReturnType<typeof createChannelMenuItem>[] = []

    function setRefreshList(names: string[]) {
        channelItems = []
        subMenu.box.destroy_all_children()

        names.forEach(name => {
            const channelPlaybackstatus =
                (name === getCurrentChannel()) ? getPlaybackStatus() : 'Stopped'

            const channelItem = createChannelMenuItem({
                channelName: name,
                onActivated: () => setUrl(findUrl(name)),
                playbackStatus: channelPlaybackstatus
            })

            channelItems.push(channelItem)
            subMenu.box.add_child(channelItem.actor)
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

    addChannelChangeHandler((newChannel) => updateChannel(newChannel))
    addPlaybackStatusChangeHandler((newStatus) => updatePlaybackStatus(newStatus))
    addStationsListChangeHandler(() => setRefreshList(getUserStationNames()))

    return subMenu.actor
}