import { RADIO_SYMBOLIC_ICON_NAME } from "consts"
import { AppletIcon } from "types"
import { createAppletIcon } from "ui/Applet/AppletIcon"

const { Panel } = imports.ui.panel
const { IconType } = imports.gi.St

const panel = new Panel(2, 0, 0, 0, 0, [0])

const locationLabel = 'left'

const colorWhenPlaying1 = 'rgb(39,174,96)'
const colorWhenPlaying2 = 'rgb(49,74,193)'

const colorWhenPaused1 = 'rgb(19,74,196)'
const colorWhenPaused2 = 'rgb(191,124,36)'

function testSymbolicIcon(appletIcon: ReturnType<typeof createAppletIcon>) {
    const expectedIconSize = panel.getPanelZoneIconSize(locationLabel, IconType.SYMBOLIC)

    expect(appletIcon.actor.icon_size).toBe(expectedIconSize)
    expect(appletIcon.actor.icon_type).toBe(IconType.SYMBOLIC)
    expect(appletIcon.actor.icon_name).toBe(RADIO_SYMBOLIC_ICON_NAME)
    expect(appletIcon.actor.style_class).toBe('system-status-icon')
}

function testFullBiColorIcon(appletIcon: ReturnType<typeof createAppletIcon>, iconType: AppletIcon) {
    const expectedIconSize = panel.getPanelZoneIconSize(locationLabel, IconType.FULLCOLOR)

    expect(appletIcon.actor.icon_size).toBe(expectedIconSize)
    expect(appletIcon.actor.icon_type).toBe(IconType.FULLCOLOR)
    expect(appletIcon.actor.icon_name).toBe(`radioapplet-${iconType.toLowerCase()}`)
    expect(appletIcon.actor.style_class).toBe('applet-icon')
}


describe('Setting icon type is working', () => {

    it('setting icon type to symbolic initially is working', () => {
        const appletIcon = createAppletIcon({
            panel,
            locationLabel
        })

        appletIcon.setIconType('SYMBOLIC')
        testSymbolicIcon(appletIcon)
    })

    it('symbolic icon type keeps working after applying playback and icon color', () => {
        const appletIcon = createAppletIcon({
            panel,
            locationLabel
        })

        appletIcon.setIconType('SYMBOLIC')
        appletIcon.setPlaybackStatus('Playing')
        appletIcon.setColorWhenPlaying(colorWhenPlaying1)

        testSymbolicIcon(appletIcon)
    })

    it('setting icon type to non symbolic initially is working', () => {
        const appletIcon = createAppletIcon({
            panel,
            locationLabel
        })

        const iconType = 'FULLCOLOR'
        appletIcon.setIconType(iconType)
        testFullBiColorIcon(appletIcon, iconType)
    })

    it('non symbolic icon type keeps working after applying playback and icon color', () => {
        const appletIcon = createAppletIcon({
            panel,
            locationLabel
        })

        const iconType = 'BICOLOR'
        appletIcon.setIconType(iconType)
        appletIcon.setPlaybackStatus('Playing')
        appletIcon.setColorWhenPlaying(colorWhenPlaying1)
    })

    it('changing icon type is working', () => {
        const appletIcon = createAppletIcon({
            panel,
            locationLabel
        })

        appletIcon.setIconType('SYMBOLIC')
        const newIconType = 'FULLCOLOR'
        appletIcon.setIconType(newIconType)
        testFullBiColorIcon(appletIcon, newIconType)
    })
})

describe('Setting playbackstatus is working', () => {
    it('playbackstatus is applied when iconColor has been set before', () => {
        const appletIcon = createAppletIcon({
            panel,
            locationLabel
        })

        appletIcon.setColorWhenPlaying(colorWhenPlaying1)
        appletIcon.setPlaybackStatus('Playing')

        expect(appletIcon.actor.get_style()).toBe(`color: ${colorWhenPlaying1}`)
    })

    it('playbackstatus is saved internally and applied when IconColor is set', () => {
        const appletIcon = createAppletIcon({
            panel,
            locationLabel
        })
        appletIcon.setPlaybackStatus('Paused')
        appletIcon.setColorWhenPaused(colorWhenPaused1)

        expect(appletIcon.actor.get_style()).toBe(`color: ${colorWhenPaused1}`)
    })

    it('setting to stop is working', () => {
        const appletIcon = createAppletIcon({
            panel,
            locationLabel
        })
        appletIcon.setPlaybackStatus('Paused')
        appletIcon.setColorWhenPaused(colorWhenPaused1)
        appletIcon.setPlaybackStatus('Stopped')

        expect(appletIcon.actor.get_style()).toBe(' ')
    })
})

describe('Changing icon Color is working', () => {
    it('changing iconcolor while same playbackstatus is working', () => {
        const appletIcon = createAppletIcon({
            panel,
            locationLabel
        })

        appletIcon.setPlaybackStatus('Playing')
        appletIcon.setColorWhenPlaying(colorWhenPlaying1)
        expect(appletIcon.actor.get_style()).toBe(`color: ${colorWhenPlaying1}`)

        appletIcon.setColorWhenPlaying(colorWhenPlaying2)
        expect(appletIcon.actor.get_style()).toBe(`color: ${colorWhenPlaying2}`)
    })

    it('changing icon color while stopped is applied when changing to playbackstatus', () => {
        const appletIcon = createAppletIcon({
            panel,
            locationLabel
        })

        appletIcon.setColorWhenPaused(colorWhenPaused1)
        expect(appletIcon.actor.get_style()).toBeUndefined()

        appletIcon.setPlaybackStatus('Paused')
        expect(appletIcon.actor.get_style()).toBe(`color: ${colorWhenPaused1}`)


    })
})