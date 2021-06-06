import { createBasicNotification } from "ui/Notifications/NotificationBase";

const { spawnCommandLine } = imports.misc.util

interface Arguments {
    downloadPath: string
}

export function notifyYoutubeDownloadFinished(args: Arguments) {

    const {
        downloadPath
    } = args


    const notification = createBasicNotification({
        notificationText: `Download finished. File saved to ${downloadPath}`
    })

    const playBtnId = 'openBtn'

    notification.addButton(playBtnId, 'Play')

    notification.connect('action-invoked', (actor, id) => {

        if (id === playBtnId) {
            spawnCommandLine(`xdg-open '${downloadPath}'`)
        }
    })

    notification.notify()
}