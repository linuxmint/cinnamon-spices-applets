import { createBasicNotification } from "ui/Notifications/NotificationBase";

interface Arguments {
    title: string,
    onCancelClicked: () => void
}

export function notifyYoutubeDownloadStarted(args: Arguments) {

    const {
        title,
        onCancelClicked
    } = args

    const notification = createBasicNotification({
        notificationText: `Downloading ${title} ...`,
    })

    const cancelBtnId = 'cancelBtn'
    notification.addButton(cancelBtnId, 'Cancel')

    notification.connect('action-invoked', (actor, id) => {
        if (id === cancelBtnId) onCancelClicked()
    })

    notification.notify()
}