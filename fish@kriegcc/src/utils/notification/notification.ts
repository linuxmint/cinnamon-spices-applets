import { _ } from "utils/translation"

const { MessageTray, SystemNotificationSource, Notification, Urgency } = imports.ui.messageTray
const Main = imports.ui.main

export type NotificationType = "Info" | "Warning" | "Error"
export type NotificationButton = {
  label: string
  callback: () => void
}

export type NotificationProps = {
  message: string
  title?: string
  type?: NotificationType // unused yet, see TODO below, "Info" should be the default
  isPersistent?: boolean
  buttons?: NotificationButton[]
}

const messageTray = new MessageTray()

export function showNotification(props: NotificationProps): void {
  const { message, title = _("Fish Applet"), isPersistent = false, buttons = [] } = props
  const source = new SystemNotificationSource(title)

  if (Main.messageTray) {
    messageTray.add(source)
    const notification = new Notification(source, title, message)
    // Somehow, only when urgency is set to critical, the message will stay.
    notification.setTransient(true)
    notification.setUrgency(isPersistent ? Urgency.CRITICAL : Urgency.NORMAL)

    // TODO: adjust notification icon based on type or add a nice image

    // setup and add buttons
    if (buttons.length !== 0) {
      const actionIdPrefix = "notification-button-"
      buttons.forEach((button, index) => {
        const actionId = actionIdPrefix + index
        notification.addButton(actionId, button.label)
      })
      notification.connect("action-invoked", (_, actionId) => {
        const buttonIndex = parseInt(actionId.split(actionIdPrefix)[1], 10)
        if (buttonIndex >= 0 && buttonIndex < buttons.length) {
          buttons[buttonIndex].callback()
        }
      })
    }

    source.notify(notification)
  }
}
