const { TextIconApplet, AllowedLayout } = imports.ui.applet;
import { PlaybackStatus, IconType } from '../types'

interface initialState {
    iconType: IconType,
    colorWhenPlaying: string,
    channelOnPanel: boolean,
}

interface Arguments extends initialState {
    orientation: imports.gi.St.Side,
    panelHeight: number,
    instanceId: number,
    onAppletClick: { (): void },
    onScroll: { (scrollDirection: imports.gi.Clutter.ScrollDirection): void }
    onAppletMiddleClick: { (): void },
    onAppletRemovedFromPanel: { (): void }
}

interface State extends initialState {
    playbackStatus: PlaybackStatus,
    channelName?: string,
    volume?: number
}

export interface RadioApplet extends imports.ui.applet.TextIconApplet {
    updateState: { (changes: Partial<State>): void },
}

export function createRadioApplet(args: Arguments) {

    const {
        iconType,
        colorWhenPlaying,
        channelOnPanel,
        orientation,
        panelHeight,
        instanceId,
        onAppletClick,
        onAppletMiddleClick,
        onScroll,
        onAppletRemovedFromPanel
    } = args

    const textIconApplet = new TextIconApplet(
        orientation, panelHeight, instanceId)

    textIconApplet.setAllowedLayout(AllowedLayout.BOTH)
    textIconApplet.on_applet_clicked = onAppletClick
    textIconApplet.on_applet_middle_clicked = onAppletMiddleClick
    textIconApplet.on_applet_removed_from_panel = onAppletRemovedFromPanel

    textIconApplet.actor.connect('scroll-event', (actor: any, event: any) => {
        const direction: imports.gi.Clutter.ScrollDirection
            = event.get_scroll_direction();
        onScroll(direction)
    })


    let state: State = {
        iconType,
        playbackStatus: "Stopped",
        colorWhenPlaying,
        channelOnPanel
    }

    function updateState(changes: Partial<State>) {
        const newState = { ...state, ...changes }

        const valid = validateNewState(newState)
        if (!valid) return

        state = newState
        setUpdateGui()
    }


    function validateNewState(newState: State) {

        let valid = true

        const {
            playbackStatus,
            channelName,
            volume
        } = newState

        if (playbackStatus !== 'Stopped' && (!channelName || volume == null)) {
            global.logError(`RadioApplet.ts: Station and volume must be defined when 
                playbackstatus is !== Stopped`)
            valid = false
            return valid
        }

        return valid
    }


    function setUpdateGui() {
        setIcon()
        setIconColor()
        setAppletLabel()
        setAppletTooltip()
    }

    function setIcon() {
        const { iconType } = state

        if (iconType === "SYMBOLIC") {
            textIconApplet.set_applet_icon_symbolic_name('radioapplet')
            return
        }

        textIconApplet.set_applet_icon_name(
            `radioapplet-${iconType.toLowerCase()}`
        )
    }

    function setIconColor() {
        const { playbackStatus, colorWhenPlaying, iconType } = state

        if (iconType !== 'SYMBOLIC') return

        textIconApplet.actor.style =
            `color: ${playbackStatus === 'Playing' ? colorWhenPlaying : true}`
    }

    function setAppletLabel() {
        const {
            playbackStatus,
            channelName,
            channelOnPanel
        } = state

        const label = (channelOnPanel && playbackStatus === "Playing")
            ? ' ' + channelName : ''

        textIconApplet.set_applet_label(label)
    }

    function setAppletTooltip() {
        const {
            playbackStatus,
            volume
        } = state

        const tooltipTxt = playbackStatus === "Stopped"
            ? "Radio++" : `Volume: ${volume.toString()} %`

        textIconApplet.set_applet_tooltip(tooltipTxt)
    }

    const radioApplet: RadioApplet = Object.create(textIconApplet)
    radioApplet.updateState = updateState


    setUpdateGui()
    return radioApplet
}