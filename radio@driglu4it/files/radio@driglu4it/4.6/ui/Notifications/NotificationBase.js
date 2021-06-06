"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBasicNotification = void 0;
const { SystemNotificationSource, Notification } = imports.ui.messageTray;
const { messageTray } = imports.ui.main;
const { Icon, IconType } = imports.gi.St;
const consts_1 = require("consts");
const messageSource = new SystemNotificationSource('Radio Applet');
messageTray.add(messageSource);
function createBasicNotification(args) {
    const { notificationText, isMarkup = false, transient = true } = args;
    const icon = new Icon({
        icon_type: IconType.SYMBOLIC,
        icon_name: consts_1.RADIO_SYMBOLIC_ICON_NAME,
        icon_size: 25
    });
    const notification = new Notification(messageSource, __meta.name, notificationText, { icon, bodyMarkup: isMarkup });
    notification.setTransient(transient);
    notification.notify = () => {
        messageSource.notify(notification);
    };
    return notification;
}
exports.createBasicNotification = createBasicNotification;
