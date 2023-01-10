import { createPopupMenu, PopupMenu } from "../../lib/PopupMenu"
import { createSeparatorMenuItem } from "../../lib/PopupSeperator"
import { mpvHandler } from "../../services/mpv/MpvHandler"
import { ChangeHandler } from "../../types"
import { createInfoSection } from "../InfoSection"
import { createSeeker } from "../Seeker"
import { createVolumeSlider } from "../VolumeSlider"
import { createChannelList } from "./ChannelList"
import { createMediaControlToolbar } from "./MediaControlToolbar/MediaControlToolbar"

const { BoxLayout } = imports.gi.St

export let radioPopupMenu: PopupMenu

export const initRadioPopupMenu = (props: { launcher: imports.gi.St.BoxLayout }) => {
    if (radioPopupMenu) {
        global.logWarning('radioPopupMenu already initiallized')
        return
    }

    const {
        launcher,
    } = props

    const {
        getPlaybackStatus,
        addPlaybackStatusChangeHandler
    } = mpvHandler

    radioPopupMenu = createPopupMenu({ launcher })

    const radioActiveSection = new BoxLayout({
        vertical: true,
        visible: getPlaybackStatus() !== 'Stopped'
    });

    [createInfoSection(), createMediaControlToolbar(), createVolumeSlider(), createSeeker()].forEach(widget => {
        radioActiveSection.add_child(createSeparatorMenuItem())
        radioActiveSection.add_child(widget)
    })

    radioPopupMenu.add_child(createChannelList())
    radioPopupMenu.add_child(radioActiveSection)

    addPlaybackStatusChangeHandler((newValue) => {
        radioActiveSection.visible = newValue !== 'Stopped'
    })
}