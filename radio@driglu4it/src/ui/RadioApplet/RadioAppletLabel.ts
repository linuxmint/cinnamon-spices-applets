import { configs } from "../../services/Config"
import { createAppletLabel } from "../../lib/AppletLabel"
import { mpvHandler } from "../../services/mpv/MpvHandler"

export function createRadioAppletLabel() {

    const {
        getCurrentChannelName,
        addChannelChangeHandler,
        addPlaybackStatusChangeHandler
    } = mpvHandler

    const {
        settingsObject,
        addChannelOnPanelChangeHandler
    } = configs

    const label = createAppletLabel({
        visible: settingsObject.channelNameOnPanel,
        text: getCurrentChannelName() || ''
    })

    addChannelOnPanelChangeHandler((channelOnPanel) => label.visible = channelOnPanel)
    addChannelChangeHandler((channel) => label.set_text(channel))
    addPlaybackStatusChangeHandler((newStatus) => {
        if (newStatus === 'Stopped')
            label.set_text('')
    })

    return label
}