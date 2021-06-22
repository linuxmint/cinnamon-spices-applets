const { SystemNotificationSource, Notification } = imports.ui.messageTray;
const { messageTray } = imports.ui.main;
const { Icon, IconType } = imports.gi.St

import { RADIO_SYMBOLIC_ICON_NAME } from "consts";

const messageSource = new SystemNotificationSource('Radio Applet')
messageTray.add(messageSource)

interface Arguments {
    notificationText: string,
    isMarkup?: boolean
    transient?: boolean
}

interface CustomNotification extends imports.ui.messageTray.Notification {
    notify: () => void
}

export function createBasicNotification(args: Arguments) {

    const {
        notificationText,
        isMarkup = false,
        transient = true
    } = args

    const icon = new Icon({
        icon_type: IconType.SYMBOLIC,
        icon_name: RADIO_SYMBOLIC_ICON_NAME,
        icon_size: 25
    })

    const notification = new Notification(
        messageSource,
        __meta.name,
        notificationText,
        { icon, bodyMarkup: isMarkup }) as CustomNotification

    notification.setTransient(transient)

    notification.notify = () => {
        messageSource.notify(notification)
    }

    return notification
}