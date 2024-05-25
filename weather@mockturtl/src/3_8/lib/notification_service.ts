import { _ } from "../utils";

const { messageTray } = imports.ui.main;
const { SystemNotificationSource, Notification } = imports.ui.messageTray;

export class NotificationService {
	private static instance: NotificationService;
	/** Single instance of log */
	public static get Instance(): NotificationService {
		if (this.instance == null)
			this.instance = new NotificationService();
		return this.instance;
	}

	Title: string = _("Weather Applet");
	MessageSource: imports.ui.messageTray.SystemNotificationSource;

	private constructor() {
		this.MessageSource = new SystemNotificationSource(this.Title);
		messageTray.add(this.MessageSource);
	}

	public Send(title: string, message: string, transient?: boolean): void {
		const notification = new Notification(this.MessageSource, this.Title + ": " + title, message);
		if (transient) notification.setTransient((!transient) ? false : true);
		this.MessageSource.notify(notification);
	}
}