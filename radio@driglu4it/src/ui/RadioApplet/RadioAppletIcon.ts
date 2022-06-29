import { createAppletIcon } from "../../lib/AppletIcon"
import { mpvHandler } from "../../services/mpv/MpvHandler"
import { RADIO_SYMBOLIC_ICON_NAME, LOADING_ICON_NAME } from "../../consts"
import { AdvancedPlaybackStatus } from "../../types"
import { configs } from "../../services/Config"
import { createRotateAnimation } from "../../functions/tweens"
const { IconType } = imports.gi.St


export function createRadioAppletIcon() {

    const {
        getPlaybackStatus,
        addPlaybackStatusChangeHandler
    } = mpvHandler

    const {
        settingsObject,
        addIconTypeChangeHandler,
        addColorPlayingChangeHandler,
        addColorPausedChangeHandler
    } = configs

    function getIconType() {
        return settingsObject.iconType === 'SYMBOLIC' ?
            IconType.SYMBOLIC : IconType.FULLCOLOR
    }

    const icon  = createAppletIcon({
        icon_type: getIconType()
    })

    const { startResumeRotation, stopRotation } = createRotateAnimation(icon)


    function getStyle(props: { playbackStatus: AdvancedPlaybackStatus }): string {
        const { playbackStatus: playbackstatus } = props

        if (playbackstatus === 'Paused')
            return `color: ${settingsObject.symbolicIconColorWhenPaused}`

        if (playbackstatus === 'Playing')
            return `color: ${settingsObject.symbolicIconColorWhenPlaying}`

        return ' '
    }

    function getIconName(props: { isLoading: boolean }): string {
        const { isLoading } = props
        const defaultIconType = settingsObject.iconType

        if (isLoading) return LOADING_ICON_NAME
        if (defaultIconType === 'SYMBOLIC') return RADIO_SYMBOLIC_ICON_NAME
        return `radioapplet-${defaultIconType.toLowerCase()}`
    }

    function setRefreshIcon(): void {

        const playbackStatus = getPlaybackStatus()
 
        const isLoading = playbackStatus === 'Loading'
        icon.icon_name = getIconName({ isLoading })
        isLoading ? startResumeRotation() : stopRotation()
        icon.style = getStyle({ playbackStatus })
    }


    addIconTypeChangeHandler(() => {
        icon.icon_type = getIconType()
        setRefreshIcon()
    })

    addPlaybackStatusChangeHandler(() => setRefreshIcon())
    addColorPlayingChangeHandler(() => setRefreshIcon())
    addColorPausedChangeHandler(() => setRefreshIcon())

    setRefreshIcon()

    return icon

}