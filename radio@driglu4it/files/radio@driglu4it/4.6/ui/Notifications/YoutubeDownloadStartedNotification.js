"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notifyYoutubeDownloadStarted = void 0;
const NotificationBase_1 = require("ui/Notifications/NotificationBase");
function notifyYoutubeDownloadStarted(args) {
    const { title, onCancelClicked } = args;
    const notification = NotificationBase_1.createBasicNotification({
        notificationText: `Downloading ${title} ...`,
    });
    const cancelBtnId = 'cancelBtn';
    notification.addButton(cancelBtnId, 'Cancel');
    notification.connect('action-invoked', (actor, id) => {
        if (id === cancelBtnId)
            onCancelClicked();
    });
    notification.notify();
}
exports.notifyYoutubeDownloadStarted = notifyYoutubeDownloadStarted;
