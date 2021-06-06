"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notifyYoutubeDownloadFinished = void 0;
const NotificationBase_1 = require("ui/Notifications/NotificationBase");
const { spawnCommandLine } = imports.misc.util;
function notifyYoutubeDownloadFinished(args) {
    const { downloadPath } = args;
    const notification = NotificationBase_1.createBasicNotification({
        notificationText: `Download finished. File saved to ${downloadPath}`
    });
    const playBtnId = 'openBtn';
    notification.addButton(playBtnId, 'Play');
    notification.connect('action-invoked', (actor, id) => {
        if (id === playBtnId) {
            spawnCommandLine(`xdg-open '${downloadPath}'`);
        }
    });
    notification.notify();
}
exports.notifyYoutubeDownloadFinished = notifyYoutubeDownloadFinished;
