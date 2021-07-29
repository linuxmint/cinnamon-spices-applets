import { Arguments as ChannelMenuItemArguments } from "ui/ChannelList/ChannelMenuItem";
const { Label } = imports.gi.St

interface ChannelState {
    channelName: string,
    playbackStatus: AdvancedPlaybackStatus
}

const createChannelMenuItem = jest.fn((args: ChannelMenuItemArguments) => {

    let {
        channelName,
        onActivated,
        playbackStatus
    } = args

    const label = new Label()
    const box = new BoxLayout({})
    box.add_child(label)

    saveStateToLabel()

    function saveStateToLabel() {

        const state: ChannelState = { channelName, playbackStatus }
        label.set_text(JSON.stringify(state))
    }

    function setPlaybackStatus(newStatus: AdvancedPlaybackStatus) {
        playbackStatus = newStatus
        saveStateToLabel()
    }

    return {
        actor: box,
        setPlaybackStatus
    }
})

jest.mock('ui/ChannelList/ChannelMenuItem', () => ({
    createChannelMenuItem
}))

jest.mock('lib/PopupSubMenu', () => ({
    createSubMenu() {

        const box = new BoxLayout()
        return {
            box,
            actor: box
        }
    }
}))

import { createChannelList } from "ui/ChannelList/ChannelList";
import { AdvancedPlaybackStatus } from "types";

const sharedChannel = "Austrian Rock Radio"
const stationNames1 = ["WDR2", sharedChannel, "Austrian Pop Radio"]
const stationNames2 = [sharedChannel, "Radio Torino", "Deutschlandfunk"]

const invalidStationName = 'InvalidName'

const onChannelClicked = jest.fn(() => { })

const { BoxLayout } = imports.gi.St


interface CheckChannelListArgs {
    currentChannel: string,
    playbackStatus: AdvancedPlaybackStatus,
    channelList: ReturnType<typeof createChannelList>
}

/** checks if the playbackstatus of the current Channel is set correctly and the playbackstatus for all other channels is set to stop */
function checkCurrentChannel(args: CheckChannelListArgs) {
    const { currentChannel, playbackStatus, channelList } = args

    const state = channelList.actor.get_children().map(box => {
        const label = box.get_child_at_index(0) as imports.gi.St.Label
        return JSON.parse(label.text) as ChannelState
    })

    state.forEach(channelState => {

        const { channelName, playbackStatus: channelPlaybackstatus } = channelState

        if (channelName === currentChannel) {
            expect(channelPlaybackstatus).toBe(playbackStatus)
        } else {
            expect(channelPlaybackstatus).toBe('Stopped')
        }
    })
}

function getState(channelList: ReturnType<typeof createChannelList>) {
    return channelList.actor.get_children().map(box => {
        const label = box.get_child_at_index(0) as imports.gi.St.Label
        return label.text
    })
}

describe('initialization is working', () => {

    it('ChannelListItem created for each station', () => {
        createChannelList({
            stationNames: stationNames1,
            onChannelClicked
        })

        stationNames1.forEach(channelName => {
            const expectedArgs: ChannelMenuItemArguments = {
                channelName,
                onActivated: onChannelClicked,
                playbackStatus: 'Stopped'
            }
            expect(createChannelMenuItem).toHaveBeenCalledWith(expectedArgs)
        })

    })

    it('All ChannelListItems added correctly to ChannelList', () => {
        const channelList = createChannelList({
            stationNames: stationNames1,
            onChannelClicked
        })

        const expectedState = stationNames1.map(channelName => {
            const playbackStatus: AdvancedPlaybackStatus = 'Stopped'
            return JSON.stringify({ channelName, playbackStatus })
        })

        const realState = getState(channelList)

        expect(expectedState).toEqual(realState)
    })
});

describe('Setting PlaybackStatus is working', () => {
    it('playbackstatus saved internally when set to non-stop and applied when currentChannel is set ', () => {
        const channelList = createChannelList({
            stationNames: stationNames1, onChannelClicked
        })

        const playbackStatus: AdvancedPlaybackStatus = 'Playing'
        const currentChannel = stationNames1[0]

        channelList.setPlaybackStatus(playbackStatus)
        channelList.setCurrentChannel(currentChannel)

        checkCurrentChannel({
            channelList,
            currentChannel,
            playbackStatus
        })
    });

    it('changing playbackStatus multiple times is working', () => {
        const channelList = createChannelList({
            stationNames: stationNames1, onChannelClicked
        })

        const currentChannel = stationNames1[0]
        const finalPlaybackStatus: AdvancedPlaybackStatus = 'Playing'

        channelList.setCurrentChannel(currentChannel)
        channelList.setPlaybackStatus('Loading')
        channelList.setPlaybackStatus(finalPlaybackStatus)

        checkCurrentChannel({
            channelList,
            currentChannel,
            playbackStatus: finalPlaybackStatus
        })
    })
})

describe('Setting CurrentChannel is working', () => {


    it('currentChannel is saved internally while playbackstatus = stopped and applied when changing playbackstatus to non-stop ', () => {
        const channelList = createChannelList({
            stationNames: stationNames1, onChannelClicked
        })

        const currentChannel = stationNames1[0]
        channelList.setCurrentChannel(currentChannel)

        const playbackStatus: AdvancedPlaybackStatus = 'Loading'
        channelList.setPlaybackStatus(playbackStatus)

        checkCurrentChannel({
            channelList,
            currentChannel,
            playbackStatus
        })
    });

    it('setting currentChannel to null throws no error', () => {
        const channelList = createChannelList({
            stationNames: stationNames1, onChannelClicked
        })

        expect(() => channelList.setCurrentChannel(null)).not.toThrowError()

    })

    it('setting currentChannel to invalid value throws an error', () => {
        const channelList = createChannelList({
            stationNames: stationNames1, onChannelClicked
        })

        expect(() => channelList.setCurrentChannel(invalidStationName)).toThrowError()
    })

    it('changing channelName multiple times is working', () => {
        const channelList = createChannelList({
            stationNames: stationNames1, onChannelClicked
        })

        const finalChannel = stationNames1[1]
        const playbackStatus: AdvancedPlaybackStatus = 'Playing'
        channelList.setPlaybackStatus(playbackStatus)
        channelList.setCurrentChannel(stationNames1[0])
        channelList.setCurrentChannel(finalChannel)

        checkCurrentChannel({
            channelList,
            currentChannel: finalChannel,
            playbackStatus
        })

    })
});

describe('Setting StationNames is working', () => {
    it('changing stationNames without including current station is working', () => {
        const channelList = createChannelList({
            stationNames: stationNames1, onChannelClicked
        })

        channelList.setPlaybackStatus('Playing')
        channelList.setCurrentChannel(stationNames1[0])

        channelList.setStationNames(stationNames2)

        checkCurrentChannel({
            currentChannel: null,
            playbackStatus: 'Stopped',
            channelList
        })
    });

    it('setting currentChannel, change stationNames not including channel and afterwards setting playbackstatus should not throw an error', () => {
        const channelList = createChannelList({
            stationNames: stationNames1, onChannelClicked
        })

        channelList.setCurrentChannel(stationNames1[0])
        channelList.setStationNames(stationNames2)

        expect(() => channelList.setPlaybackStatus('Loading')).not.toThrowError()

    });


    it('changing stationNames with including current station is working', () => {
        const channelList = createChannelList({
            stationNames: stationNames1, onChannelClicked
        })

        const playbackStatus = 'Playing'
        const currentChannel = sharedChannel

        channelList.setCurrentChannel(currentChannel)
        channelList.setPlaybackStatus(playbackStatus)

        channelList.setStationNames(stationNames2)

        checkCurrentChannel({
            currentChannel,
            playbackStatus,
            channelList
        })

    })
});