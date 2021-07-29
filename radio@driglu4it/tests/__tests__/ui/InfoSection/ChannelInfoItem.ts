import { createChannelInfoItem } from 'ui/InfoSection/ChannelInfoItem'
import { limitString } from 'functions/limitString';
import * as consts from 'consts'

const { SignalManager } = imports.misc.signalManager

const channel1 = 'Austrian Rock Radio'
const channel2 = 'WDR 2 Rhein und Ruhr'

jest.mock('consts', () => ({
    ...jest.requireActual('consts'),
    MAX_STRING_LENGTH: 10
}))

function getChildren(ChannelInfoItem: ReturnType<typeof createChannelInfoItem>) {
    return ChannelInfoItem.actor["_children"]
}

function limitStringToMaxLength(text: string) {
    return limitString(text, consts.MAX_STRING_LENGTH)
}

describe('initialization is working', () => {

    it('icon and label set correctly', () => {
        const channelInfoItem = createChannelInfoItem()

        const children = getChildren(channelInfoItem)

        const icon = children[0].actor as imports.gi.St.Icon
        const label = children[1].actor as imports.gi.St.Label

        expect(icon.icon_name).toBe(consts.RADIO_SYMBOLIC_ICON_NAME)
        expect(label.text).toBe(' ')
    })

    it('no effects on hover', () => {
        const spy = jest.spyOn(SignalManager.prototype, 'connect')

        const channelInfoItem = createChannelInfoItem()

        expect(spy).not.toHaveBeenCalledWith(channelInfoItem.actor.actor, 'notify::hover', expect.anything())
    })
})

describe('channel can be set/chaned', () => {
    it('changing channel first time working', () => {
        const channelInfoItem = createChannelInfoItem()

        channelInfoItem.setChannel(channel1)

        const children = getChildren(channelInfoItem)

        const icon = children[0].actor as imports.gi.St.Icon
        const label = children[1].actor as imports.gi.St.Label

        expect(icon.icon_name).toBe(consts.RADIO_SYMBOLIC_ICON_NAME)
        expect(label.text).toBe(limitStringToMaxLength(channel1))
    })

    it('changing channel multiple times is working', () => {
        const channelInfoItem = createChannelInfoItem()

        channelInfoItem.setChannel(channel1)
        channelInfoItem.setChannel(channel2)

        const children = getChildren(channelInfoItem)

        const icon = children[0].actor as imports.gi.St.Icon
        const label = children[1].actor as imports.gi.St.Label

        expect(icon.icon_name).toBe(consts.RADIO_SYMBOLIC_ICON_NAME)
        expect(label.text).toBe(limitStringToMaxLength(channel2))
    })

    it("changing channel to null doesn't throw an error", () => {
        const channelInfoItem = createChannelInfoItem()
        channelInfoItem.setChannel(channel1)
        channelInfoItem.setChannel(null)
    })
})