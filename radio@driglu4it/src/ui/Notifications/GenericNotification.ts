import { createBasicNotification } from "./NotificationBase"

interface Arguments {
    text: string, 
    isMarkup?: boolean, 
    transient?: boolean
}

export function notify(args: Arguments) {

    const {
        text,
        isMarkup = false, 
        transient = true
    } = args

    const notification = createBasicNotification({
        notificationText: text, 
        isMarkup, 
        transient
    })

    notification.notify()
}