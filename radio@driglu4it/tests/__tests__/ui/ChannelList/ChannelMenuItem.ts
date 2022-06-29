import * as consts from "consts"
import { limitString } from "functions/limitString"
import { createChannelMenuItem } from "ui/ChannelList/ChannelMenuItem"
import { triggerEvent } from "../../../utils/TriggerEvent"

const channelName = 'WDR 2 Rhein und Ruhr'
const channelNameShortened = limitStringToMaxLength(channelName)
const onActivated = jest.fn(() => { })

type LabelType = InstanceType<typeof imports.gi.St.Label>
type IconType = InstanceType<typeof imports.gi.St.Icon>

jest.mock('consts', () => ({
    ...jest.requireActual<typeof consts>('consts'),
    MAX_STRING_LENGTH: 10
}))

function limitStringToMaxLength(text: string) {
    return limitString(text, consts.MAX_STRING_LENGTH)
}


describe('initialization is working', () => {

    it('only channelName added to MenuItem when playbackStatus is stopped', () => {
        const channelMenuItem = createChannelMenuItem({
            channelName,
            onActivated,
            playbackStatus: 'Stopped'
        })

        expect(channelMenuItem.actor.get_children().length).toBe(1)

        const expectedLabel = channelMenuItem.actor.get_child_at_index<LabelType>(0)

        expect(expectedLabel.text).toBe(channelNameShortened)
    });

    it('icon and ChannelName set when playbackStatus is not stopped', () => {
        const channelMenuItem = createChannelMenuItem({
            channelName,
            onActivated,
            playbackStatus: 'Playing'
        })

        const children = channelMenuItem.actor.get_children<[IconType, LabelType]>()

        expect(children[0].icon_name).toBe(consts.PLAY_ICON_NAME)
        expect(children[1].text).toBe(channelNameShortened)
    });

    // this actually also should be triggered on similar Actions such as pressing enter
    it('Callback executed onClick', () => {

        const channelMenuItem = createChannelMenuItem({
            channelName,
            onActivated,
            playbackStatus: 'Playing'
        })

        triggerEvent(channelMenuItem.actor, 'button-release-event')

    })
})

describe('setting playbackstatus is working', () => {
    it('Icon and Text shown when changing first time to non stop', () => {
        const channelMenuItem = createChannelMenuItem({
            channelName,
            onActivated,
            playbackStatus: 'Stopped'
        })

        channelMenuItem.setPlaybackStatus('Playing')

        const children = channelMenuItem.actor.get_children<[IconType, LabelType]>()

        expect(children[0].icon_name).toBe(consts.PLAY_ICON_NAME)
        expect(children[1].text).toBe(channelNameShortened)
    })

    it('Only Text shown when changing to stop', () => {
        const channelMenuItem = createChannelMenuItem({
            channelName,
            onActivated,
            playbackStatus: 'Playing'
        })

        channelMenuItem.setPlaybackStatus('Stopped')
        const children = channelMenuItem.actor.get_children<[LabelType]>()
        expect(children.length).toBe(1)
        expect(children[0].text).toBe(channelNameShortened)

    })
})