"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notify = void 0;
const NotificationBase_1 = require("ui/Notifications/NotificationBase");
function notify(args) {
    const { text } = args;
    const notification = NotificationBase_1.createBasicNotification({
        notificationText: text
    });
    notification.notify();
}
exports.notify = notify;
