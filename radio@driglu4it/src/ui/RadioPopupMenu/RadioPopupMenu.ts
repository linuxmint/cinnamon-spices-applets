import { createPopupMenu } from "../../lib/PopupMenu"
import { createSeparatorMenuItem } from "../../lib/PopupSeperator"
import { mpvHandler } from "../../services/mpv/MpvHandler"
import { createInfoSection } from "../InfoSection"
import { createSeeker } from "../Seeker"
import { createVolumeSlider } from "../VolumeSlider"
import { createChannelList } from "./ChannelList"
import { createMediaControlToolbar } from "./MediaControlToolbar/MediaControlToolbar"

const { BoxLayout } = imports.gi.St

export function createRadioPopupMenu(props: { launcher: imports.gi.St.BoxLayout }) {
    const {
        launcher,
    } = props

    const {
        getPlaybackStatus,
        addPlaybackStatusChangeHandler
    } = mpvHandler

    const popupMenu = createPopupMenu({ launcher })

    const radioActiveSection = new BoxLayout({
        vertical: true,
        visible: getPlaybackStatus() !== 'Stopped'
    });

    [createInfoSection(), createMediaControlToolbar(), createVolumeSlider(), createSeeker()].forEach(widget => {
        radioActiveSection.add_child(createSeparatorMenuItem())
        radioActiveSection.add_child(widget)
    })

    popupMenu.add_child(createChannelList())
    popupMenu.add_child(radioActiveSection)

    addPlaybackStatusChangeHandler((newValue) => {
        radioActiveSection.visible = newValue !== 'Stopped'
    })

    return popupMenu
}