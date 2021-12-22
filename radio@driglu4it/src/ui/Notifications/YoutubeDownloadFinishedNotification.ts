import { createBasicNotification } from "./NotificationBase";

const { spawnCommandLine } = imports.misc.util

interface Arguments {
    downloadPath: string,
    fileAlreadExist?: boolean
}

export function notifyYoutubeDownloadFinished(args: Arguments) {

    const {
        downloadPath,
        fileAlreadExist = false
    } = args

    const notificationText = fileAlreadExist ?
        'Downloaded Song not saved as a file with the same name already exists' :
        `Download finished. File saved to ${downloadPath}`


    const notification = createBasicNotification({
        notificationText,
        isMarkup: false,
        transient: false
    })

    // workaround to remove the underline of the downloadPath
    notification["_bodyUrlHighlighter"].actor.clutter_text.set_markup(notificationText)

    const playBtnId = 'openBtn'

    notification.addButton(playBtnId, 'Play')

    notification.connect('action-invoked', (actor, id) => {

        if (id === playBtnId) {
            spawnCommandLine(`xdg-open '${downloadPath}'`)
        }
    })

    notification.notify()
}