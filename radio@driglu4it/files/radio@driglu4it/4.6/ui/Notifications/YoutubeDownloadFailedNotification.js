"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notifyYoutubeDownloadFailed = void 0;
const consts_1 = require("consts");
const NotificationBase_1 = require("ui/Notifications/NotificationBase");
const { spawnCommandLine } = imports.misc.util;
const { get_home_dir } = imports.gi.GLib;
function notifyYoutubeDownloadFailed() {
    const notificationText = `Couldn't download Song from Youtube due to an Error. Make Sure you have the newest version of youtube-dl installed. 
        \n<b>Important:</b> Don't use apt for the installation but follow the installation instruction given on the Radio Applet Site in the Cinnamon Store instead
        \nFor more information see the logs`;
    const notification = NotificationBase_1.createBasicNotification({
        notificationText,
        isMarkup: true,
        transient: false
    });
    const viewStoreBtnId = 'viewStoreBtn';
    const viewLogBtnId = 'viewLogBtn';
    notification.addButton(viewStoreBtnId, 'View Installation Instruction');
    notification.addButton(viewLogBtnId, "View Logs");
    notification.connect('action-invoked', (actor, id) => {
        if (id === viewStoreBtnId) {
            spawnCommandLine(`xdg-open ${consts_1.APPLET_SITE} `);
        }
        if (id === viewLogBtnId) {
            spawnCommandLine(`xdg-open ${get_home_dir()}/.xsession-errors`);
        }
    });
    notification.notify();
}
exports.notifyYoutubeDownloadFailed = notifyYoutubeDownloadFailed;
