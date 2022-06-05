const { SystemNotificationSource, Notification } = imports.ui.messageTray;
const { messageTray } = imports.ui.main;
const { Icon, IconType } = imports.gi.St
const { spawnCommandLine } = imports.misc.util
const { get_home_dir } = imports.gi.GLib;

import { RADIO_SYMBOLIC_ICON_NAME } from "../consts";

const messageSource = new SystemNotificationSource('Radio Applet')
messageTray.add(messageSource)

interface NotificationBtn {
    text: string
    onClick: () => void
}

interface NotifyOptions {
    isMarkup?: boolean
    transient?: boolean
    buttons?: NotificationBtn[]
}

export function notify(text: string, options?: NotifyOptions) {

    const {
        // TODO: is there a reason to ever set this to false??
        isMarkup = true,
        transient = true,
        buttons
    } = options || {}

    const icon = new Icon({
        icon_type: IconType.SYMBOLIC,
        icon_name: RADIO_SYMBOLIC_ICON_NAME,
        icon_size: 25
    })

    const notification = new Notification(
        messageSource,
        __meta.name,
        text,
        { icon })

    notification.setTransient(transient)

    if (buttons && buttons.length > 0) {
        buttons.forEach(({ text }) => {
            notification.addButton(text, text)
        })

        notification.connect('action-invoked', (_, id) => {
            const clickedBtn = buttons.find(({ text }) => text === id)
            clickedBtn?.onClick()
        })
    }

    // workaround to remove the underline of the downloadPath
    isMarkup && notification["_bodyUrlHighlighter"].actor.clutter_text.set_markup(text)

    messageSource.notify(notification)
}

interface NotifcationErrorOptions {
    /** if set to true, it is added a prefix that the user needs to be connted to the internet */
    showInternetInfo?: boolean
    showViewLogBtn?: boolean
    additionalBtns?: NotificationBtn[]
}

export function notifyError(prefix: string, errMessage: string, options?: NotifcationErrorOptions) {

    const { showInternetInfo, showViewLogBtn = true, additionalBtns = [] } = options || {}

    global.logError(errMessage);

    const notificationSentences: string[] = [prefix]

    if (showInternetInfo) {
        notificationSentences.push('Make sure you are connected to the internet and try again')
    }

    notificationSentences.push("Don't hesitate to open an issue on github if the problem remains.")

    if (showViewLogBtn) {
        notificationSentences.push(`\n\nFor more information see the logs`)
    }

    const notificationText = notificationSentences.join('')

    const buttons: NotificationBtn[] = []

    if (showViewLogBtn) {
        buttons.push({
            text: 'View Logs',
            onClick: () => spawnCommandLine(`xdg-open ${get_home_dir()}/.xsession-errors`)
        })
    }

    additionalBtns.forEach((additionalBtn) => buttons.push(additionalBtn))

    return notify(notificationText, {
        buttons,
        transient: false
    })
}