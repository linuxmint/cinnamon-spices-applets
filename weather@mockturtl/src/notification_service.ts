import { _ } from "./utils";

const { messageTray } = imports.ui.main;
const { SystemNotificationSource, Notification } = imports.ui.messageTray;

export class NotificationService {
    Title: string = _("Weather Applet");
	MessageSource: imports.ui.messageTray.SystemNotificationSource;

	constructor() {
		this.MessageSource = new SystemNotificationSource(this.Title);
        messageTray.add(this.MessageSource);
	}

	public Send(title: string, message: string, transient?: boolean) {
        let notification = new Notification(this.MessageSource, this.Title + ": " + title, message);
        if (transient) notification.setTransient((!transient) ? false : true);
        this.MessageSource.notify(notification);
    }
}

export const Notifications = new NotificationService();