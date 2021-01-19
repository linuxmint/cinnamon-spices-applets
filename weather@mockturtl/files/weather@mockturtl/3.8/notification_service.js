"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationService = void 0;
const utils_1 = require("./utils");
const { messageTray } = imports.ui.main;
const { SystemNotificationSource, Notification } = imports.ui.messageTray;
class NotificationService {
    constructor() {
        this.Title = utils_1._("Weather Applet");
        this.MessageSource = new SystemNotificationSource(this.Title);
        messageTray.add(this.MessageSource);
    }
    static get Instance() {
        if (this.instance == null)
            this.instance = new NotificationService();
        return this.instance;
    }
    Send(title, message, transient) {
        let notification = new Notification(this.MessageSource, this.Title + ": " + title, message);
        if (transient)
            notification.setTransient((!transient) ? false : true);
        this.MessageSource.notify(notification);
    }
}
exports.NotificationService = NotificationService;
NotificationService.instance = null;
