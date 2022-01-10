
import { createAppletContainer } from "../../lib/AppletContainer"
import { mpvHandler } from "../../services/mpv/MpvHandler"
import { createRadioAppletLabel } from "./RadioAppletLabel"
import { createRadioAppletTooltip } from "./RadioAppletTooltip"
import { createRadioAppletIcon } from "./RadioAppletIcon"
import { APPLET_SITE, MPRIS_PLUGIN_PATH, VOLUME_DELTA } from "../../consts"
import { createRadioPopupMenu } from "../RadioPopupMenu/RadioPopupMenu"
import { installMpvWithMpris } from "../../services/mpv/CheckInstallation"
import { notify } from "../Notifications/GenericNotification"
import { createYoutubeDownloadIcon } from "./YoutubeDownloadIcon"

const { ScrollDirection } = imports.gi.Clutter;

export function createRadioAppletContainer() {

    let installationInProgress = false

    const appletContainer = createAppletContainer({
        onMiddleClick: () => mpvHandler.togglePlayPause(),
        onMoved: () => mpvHandler.deactivateAllListener(),
        onRemoved: handleAppletRemoved,
        onClick: handleClick,
        onRightClick: () => popupMenu?.close(),
        onScroll: handleScroll
    });

    [createRadioAppletIcon(), createYoutubeDownloadIcon(), createRadioAppletLabel()].forEach(widget => {
        appletContainer.actor.add_child(widget)
    })

    const tooltip = createRadioAppletTooltip({ appletContainer })

    const popupMenu = createRadioPopupMenu({ launcher: appletContainer.actor })

    popupMenu.connect('notify::visible', () => {
        popupMenu.visible && tooltip.hide()
    })

    function handleAppletRemoved() {
        mpvHandler?.deactivateAllListener()
        mpvHandler?.stop()
    }

    function handleScroll(scrollDirection: imports.gi.Clutter.ScrollDirection) {
        const volumeChange =
            scrollDirection === ScrollDirection.UP ? VOLUME_DELTA : -VOLUME_DELTA
        mpvHandler.increaseDecreaseVolume(volumeChange)
    }

    async function handleClick() {
        if (installationInProgress) return

        try {
            installationInProgress = true
            await installMpvWithMpris()
            popupMenu?.toggle()
        } catch (error) {
            const notificationText =
                `Couldn't start the applet. Make sure mpv is installed and the mpv mpris plugin is located at ${MPRIS_PLUGIN_PATH} and correctly compiled for your environment. Refer to ${APPLET_SITE} (section Known Issues)`

            notify({ text: notificationText, transient: false })
            global.logError(error)
        } finally {
            installationInProgress = false
        }

    }

    return appletContainer
}