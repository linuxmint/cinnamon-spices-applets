import { createChannelList } from 'ui/ChannelList/ChannelList'
import { limitString } from "functions/limitString";
import { MAX_STRING_LENGTH } from 'consts';
import { PlaybackStatus } from 'types';

const { PopupBaseMenuItem } = imports.ui.popupMenu

const sharedChannel = "Austrian Rock Radio"
const stationNames1 = ["WDR2", sharedChannel, "Austrian Pop Radio"]
const stationNames2 = [sharedChannel, "Radio Torino", "Deutschlandfunk"]

const onChannelClicked = jest.fn(() => { })

jest.mock('ui/ChannelList/ChannelMenuItem')

jest.mock('consts', () => ({
    ...jest.requireActual('consts'),
    MAX_STRING_LENGTH: 10
}))

const stationNames1Shortened = stationNames1.map(name => limitStringToMax(name))

afterEach(() => {
    jest.restoreAllMocks();
})

function getMenuItems(channelList: ReturnType<typeof createChannelList>) {
    return channelList.actor.menu["_getMenuItems"]()
}

function limitStringToMax(text: string) {
    return limitString(text, MAX_STRING_LENGTH)
}

interface CheckChannelListArgs {
    currentChannel: string,
    playbackStatus: PlaybackStatus,
    channelList: ReturnType<typeof createChannelList>
}

function checkChannelList(args: CheckChannelListArgs) {

    const { currentChannel, playbackStatus, channelList } = args

    const menuItems = getMenuItems(channelList)

    menuItems.forEach(menuItem => {
        // @ts-ignore
        if (menuItem.channelName !== limitStringToMax(currentChannel)) {
            // @ts-ignore
            expect(menuItem.playbackStatus).toBe('Stopped')
            return
        }
        // @ts-ignore
        expect(menuItem.playbackStatus).toBe(playbackStatus)
    })


}

describe('initialization is working', () => {

    it('channelItem created for each channel and added to the menu', () => {
        const channelList = createChannelList({
            stationNames: stationNames1, onChannelClicked
        })

        const menuItems = getMenuItems(channelList)

        const menuItemNames = menuItems.map(menuItem => {
            // @ts-ignore
            return menuItem.channelName
        })

        expect(stationNames1Shortened).toEqual(menuItemNames)
    })

    it('playbackstatus set to stop initially for all items', () => {
        const channelList = createChannelList({
            stationNames: stationNames1, onChannelClicked
        })

        checkChannelList({
            currentChannel: null,
            playbackStatus: 'Stopped',
            channelList
        })
    })

    it('onChannelClicked passed to child elements', () => {
        jest
            .spyOn(PopupBaseMenuItem.prototype, 'connect')
            .mockImplementation((signal: string, cb: () => void) => {
                if (signal === 'activate') {
                    cb()
                }
            })

        createChannelList({
            stationNames: stationNames1, onChannelClicked
        })

        stationNames1.forEach(name => {
            expect(onChannelClicked).toHaveBeenCalledWith(name)
        })
    })
})

describe('setters are working', () => {
    it('playbackstatus saved internally when set to non-stop and applied when currentChannel is set', () => {
        const channelList = createChannelList({
            stationNames: stationNames1, onChannelClicked
        })

        const playbackStatus = 'Playing'
        channelList.setPlaybackstatus(playbackStatus)
        let currentChannel = null

        check()

        currentChannel = stationNames1[0]
        channelList.setCurrentChannel(currentChannel)

        check()

        function check() {
            checkChannelList({
                currentChannel,
                playbackStatus,
                channelList
            })
        }
    })

    it('currentChannel is saved internally while playbackstatus = stopped and applied when changing playbackstatus to non-stop', () => {
        const channelList = createChannelList({
            stationNames: stationNames1, onChannelClicked
        })

        const currentChannel = stationNames1[0]
        channelList.setCurrentChannel(currentChannel)
        let playbackStatus: PlaybackStatus = 'Stopped'

        check()

        playbackStatus = 'Playing'
        channelList.setPlaybackstatus(playbackStatus)

        check()

        function check() {
            checkChannelList({
                currentChannel,
                playbackStatus,
                channelList
            })
        }
    })

    it("changing channelName to null doesn't throw an error", () => {
        const channelList = createChannelList({
            stationNames: stationNames1, onChannelClicked
        })

        channelList.setCurrentChannel(null)
    })

    it('changing channelName from a valid station name to another valid station is working', () => {
        const channelList = createChannelList({
            stationNames: stationNames1, onChannelClicked
        })

        const playbackStatus = 'Playing'
        channelList.setPlaybackstatus('Playing')
        channelList.setCurrentChannel(stationNames1[1])

        const currentChannel = stationNames1[0]

        channelList.setCurrentChannel(currentChannel)

        checkChannelList({
            currentChannel,
            playbackStatus,
            channelList
        })
    })

    it('changing to non-stop and back is working', () => {
        const channelList = createChannelList({
            stationNames: stationNames1, onChannelClicked
        })

        const currentChannel = stationNames1[0]
        channelList.setPlaybackstatus('Paused')
        channelList.setCurrentChannel(currentChannel)

        const playbackStatus = 'Stopped'
        channelList.setPlaybackstatus(playbackStatus)

        checkChannelList({
            currentChannel,
            playbackStatus,
            channelList
        })

    })

    it('changing stationNames without including current station is working', () => {
        const channelList = createChannelList({
            stationNames: stationNames1, onChannelClicked
        })

        channelList.setPlaybackstatus('Playing')
        channelList.setCurrentChannel(stationNames1[0])

        channelList.setStationNames(stationNames2)

        checkChannelList({
            currentChannel: null,
            playbackStatus: 'Stopped',
            channelList
        })
    })

    it('changing stationNames with including current Station is working', () => {
        const channelList = createChannelList({
            stationNames: stationNames1, onChannelClicked
        })

        const playbackStatus = 'Playing'
        const currentChannel = sharedChannel
        channelList.setCurrentChannel(currentChannel)
        channelList.setPlaybackstatus(playbackStatus)

        channelList.setStationNames(stationNames2)

        checkChannelList({
            currentChannel,
            playbackStatus,
            channelList
        })

    })
})