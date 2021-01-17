"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Notifications = exports.NotificationService = void 0;
const utils_1 = require("./utils");
const { messageTray } = imports.ui.main;
const { SystemNotificationSource, Notification } = imports.ui.messageTray;
class NotificationService {
    constructor() {
        this.MessageSource = new SystemNotificationSource(utils_1._("Weather Applet"));
        messageTray.add(this.MessageSource);
    }
    Send(title, message, transient) {
        let notification = new Notification(this.MessageSource, utils_1._("Weather Applet") + ": " + title, message);
        if (transient)
            notification.setTransient((!transient) ? false : true);
        this.MessageSource.notify(notification);
    }
}
exports.NotificationService = NotificationService;
exports.Notifications = new NotificationService();
