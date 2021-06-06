import { APPLET_SITE } from "consts";
import { createBasicNotification } from "ui/Notifications/NotificationBase";
const { spawnCommandLine } = imports.misc.util
const { get_home_dir } = imports.gi.GLib;

export function notifyYoutubeDownloadFailed() {


    const notificationText =
        `Couldn't download Song from Youtube due to an Error. Make Sure you have the newest version of youtube-dl installed. 
        \n<b>Important:</b> Don't use apt for the installation but follow the installation instruction given on the Radio Applet Site in the Cinnamon Store instead
        \nFor more information see the logs`

    const notification = createBasicNotification({
        notificationText,
        isMarkup: true,
        transient: false
    })

    const viewStoreBtnId = 'viewStoreBtn'
    const viewLogBtnId = 'viewLogBtn'

    notification.addButton(viewStoreBtnId, 'View Installation Instruction')
    notification.addButton(viewLogBtnId, "View Logs")

    notification.connect('action-invoked', (actor, id) => {
        if (id === viewStoreBtnId) {
            spawnCommandLine(`xdg-open ${APPLET_SITE} `)
        }
        if (id === viewLogBtnId) {
            spawnCommandLine(`xdg-open ${get_home_dir()}/.xsession-errors`)
        }

    })

    notification.notify()
}