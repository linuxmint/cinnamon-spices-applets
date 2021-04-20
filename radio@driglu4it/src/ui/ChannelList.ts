const { PopupSubMenuMenuItem } = imports.ui.popupMenu;

import { limitString } from "functions/limitString";
import { PlaybackStatus } from "types";
import { ChannelMenuItem } from "ui/ChannelMenuItem";

interface InitialState {
    stationNames: string[]
}

interface Arguments extends InitialState {
    onChannelClicked: { (name: string): void },
}

interface State extends InitialState {
    channelName?: string
    playbackStatus?: PlaybackStatus,
}

export function createChannelList(args: Arguments) {

    const {
        stationNames,
        onChannelClicked
    } = args

    const container = new PopupSubMenuMenuItem('My Stations')

    let state: State = { stationNames }

    function updateState(changes: Partial<State>) {
        const newState = { ...state, ...changes }

        const {
            playbackStatus,
            channelName
        } = newState

        if (playbackStatus !== 'Stopped' && !channelName) {
            global.logError('It must be defined a station when playbackstatus is !== Stopped')
            return
        }

        state = newState
        setUpdateGui()
    }

    function setUpdateGui() {

        container.menu.removeAll()

        const {
            playbackStatus,
            channelName,
            stationNames
        } = state

        stationNames.forEach(name => {

            const channelPlaybackstatus =
                (name === channelName) ? playbackStatus : 'Stopped'

            const channelItem = new ChannelMenuItem(
                limitString(name), channelPlaybackstatus
            )
            channelItem.connect('activate', () => onChannelClicked(name))
            container.menu.addMenuItem(channelItem)
        })
    }

    function open() {
        container.menu.open(true)
    }

    setUpdateGui()
    return Object.assign(container, { open, updateState })
}