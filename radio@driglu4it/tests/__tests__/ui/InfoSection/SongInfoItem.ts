import { createSongInfoItem } from "ui/InfoSection/SongInfoItem"
import { MAX_STRING_LENGTH, SONG_INFO_ICON_NAME } from 'consts';
import { limitString } from 'functions/limitString';

const { SignalManager } = imports.misc.signalManager

const songTitle1 = 'My Chemical Romance - Welcome To The Black Parade'
const songTitle2 = 'R.E.M. - Daysleeper'

jest.mock('consts', () => ({
    ...jest.requireActual('consts'),
    MAX_STRING_LENGTH: 10
}))

function getChildren(songInfoItem: ReturnType<typeof createSongInfoItem>) {
    return songInfoItem.actor["_children"]
}

function limitStringToMaxLength(text: string) {
    return limitString(text, MAX_STRING_LENGTH)
}

describe('initialization is working', () => {
    it('icon and label set correctly', () => {
        const songInfoItem = createSongInfoItem()

        const children = getChildren(songInfoItem)

        const icon = children[0].actor as imports.gi.St.Icon
        const label = children[1].actor as imports.gi.St.Label

        expect(icon.icon_name).toBe(SONG_INFO_ICON_NAME)
        expect(label.text).toBe(' ')
    })

    it('no effects on hover', () => {
        const spy = jest.spyOn(SignalManager.prototype, 'connect')

        const songInfoItem = createSongInfoItem()

        expect(spy).not.toHaveBeenCalledWith(songInfoItem.actor.actor, 'notify::hover', expect.anything())
    })
})

describe('title can be set/changed', () => {

    it('changing title first time working', () => {
        const songInfoItem = createSongInfoItem()

        songInfoItem.setSongTitle(songTitle1)

        const children = getChildren(songInfoItem)

        const icon = children[0].actor as imports.gi.St.Icon
        const label = children[1].actor as imports.gi.St.Label

        expect(icon.icon_name).toBe(SONG_INFO_ICON_NAME)
        expect(label.text).toBe(limitStringToMaxLength(songTitle1))
    })

    it('changing title multiple times working', () => {
        const songInfoItem = createSongInfoItem()

        songInfoItem.setSongTitle(songTitle1)
        songInfoItem.setSongTitle(songTitle2)

        const children = getChildren(songInfoItem)

        const icon = children[0].actor as imports.gi.St.Icon
        const label = children[1].actor as imports.gi.St.Label

        expect(icon.icon_name).toBe(SONG_INFO_ICON_NAME)
        expect(label.text).toBe(limitStringToMaxLength(songTitle2))
    })

})