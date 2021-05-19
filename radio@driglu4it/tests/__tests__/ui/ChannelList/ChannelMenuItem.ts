import * as consts from "consts"
import { limitString } from "functions/limitString"
import { createChannelMenuItem } from "ui/ChannelList/ChannelMenuItem"

const channelName = 'WDR 2 Rhein und Ruhr'
const channelNameShortened = limitStringToMaxLength(channelName)

jest.mock('consts', () => ({
    ...jest.requireActual('consts'),
    MAX_STRING_LENGTH: 10
}))

function limitStringToMaxLength(text: string) {
    return limitString(text, consts.MAX_STRING_LENGTH)
}

function getChildren(channelMenuItem: ReturnType<typeof createChannelMenuItem>) {
    //@ts-ignore
    return channelMenuItem.actor._children
}

describe('initialization is working', () => {

    it('Only channelName is added to menuItem', () => {
        const channelMenuItem = createChannelMenuItem({
            channelName
        })

        const [{ actor: label }] = getChildren(channelMenuItem)
        expect(label.text).toBe(channelNameShortened)
    })
})

describe('setting playbackstatus is working', () => {
    it('changing first time to non stop is working', () => {
        const channelMenuItem = createChannelMenuItem({
            channelName
        })

        channelMenuItem.setPlaybackStatus('Playing')

        const [
            { actor: icon },
            { actor: label }
        ] = getChildren(channelMenuItem)

        expect(icon.icon_name).toBe(consts.PLAY_ICON_NAME)
        expect(label.text).toBe(channelNameShortened)
    })

    it('changing back to stop is working', () => {
        const channelMenuItem = createChannelMenuItem({
            channelName
        })

        channelMenuItem.setPlaybackStatus('Paused')
        channelMenuItem.setPlaybackStatus('Stopped')
        channelMenuItem.setPlaybackStatus('Paused')

        const [
            { actor: icon },
            { actor: label }
        ] = getChildren(channelMenuItem)

        expect(icon.icon_name).toBe(consts.PAUSE_ICON_NAME)
        expect(label.text).toBe(channelNameShortened)

    })

    it('changing to non-stop there and back is working', () => {
        const channelMenuItem = createChannelMenuItem({
            channelName
        })

        channelMenuItem.setPlaybackStatus('Paused')
        channelMenuItem.setPlaybackStatus('Stopped')

        const [
            { actor: label }
        ] = getChildren(channelMenuItem)

        expect(label.text).toBe(channelNameShortened)
    })
})